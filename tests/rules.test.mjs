// Security rules for shared groups, exercised against the Firestore emulator
// with several distinct signed-in users. Run via:
//   npm run test:rules
//
// These guard real money: a member must be able to keep the ledger, an
// outsider must not, and joining must never let somebody rewrite the group.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const OWNER = "uid-owner";
const MEMBER = "uid-member";
const OUTSIDER = "uid-outsider";
const GID = "group-1";

const env = await initializeTestEnvironment({
  projectId: "settld-rules-test",
  firestore: {
    rules: readFileSync("firestore.rules", "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

const owner = env.authenticatedContext(OWNER).firestore();
const member = env.authenticatedContext(MEMBER).firestore();
const outsider = env.authenticatedContext(OUTSIDER).firestore();
const anon = env.unauthenticatedContext().firestore();

const groupDoc = (overrides = {}) => ({
  id: GID,
  name: "Goa trip",
  emoji: "🏝️",
  currency: "INR",
  members: [{ id: "m1", name: "Gaurav", upi: "", uid: OWNER }],
  memberUids: [OWNER],
  ownerUid: OWNER,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const expenseDoc = (overrides = {}) => ({
  id: "e1",
  groupId: GID,
  createdAt: 1,
  updatedAt: 1,
  deleted: false,
  desc: "Dinner",
  amountP: 100000,
  category: "food",
  date: 1,
  payers: [{ memberId: "m1", amountP: 100000 }],
  split: { mode: "equal", participants: [{ memberId: "m1" }] },
  attachments: [],
  notes: "",
  ...overrides,
});

let passed = 0;
async function t(name, fn) {
  await env.clearFirestore();
  await fn();
  passed += 1;
  console.log("ok -", name);
}

await t("a signed-in user can create a group only with themselves as sole member", async () => {
  await assertFails(setDoc(doc(owner, "groups", GID), groupDoc({ ownerUid: OUTSIDER })));
  await assertFails(setDoc(doc(owner, "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER] })));
  await assertSucceeds(setDoc(doc(owner, "groups", GID), groupDoc()));
});

await t("anonymous callers get nothing", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc());
  });
  await assertFails(getDoc(doc(anon, "groups", GID)));
  await assertFails(setDoc(doc(anon, "groups", GID), groupDoc({ name: "hijack" })));
});

await t("the group can never be listed, only fetched by id", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc());
  });
  await assertSucceeds(getDoc(doc(outsider, "groups", GID)));
  await assertFails(getDocs(collection(outsider, "groups")));
});

await t("an invitee can add themselves once and nothing else", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc());
  });
  // cannot seize ownership while joining
  await assertFails(updateDoc(doc(member, "groups", GID), {
    memberUids: [OWNER, MEMBER],
    ownerUid: MEMBER,
    updatedAt: 2,
  }));
  // cannot rename the group while joining
  await assertFails(updateDoc(doc(member, "groups", GID), {
    memberUids: [OWNER, MEMBER],
    name: "renamed",
    updatedAt: 2,
  }));
  // cannot drop the existing members
  await assertFails(updateDoc(doc(member, "groups", GID), {
    memberUids: [MEMBER],
    members: [],
    updatedAt: 2,
  }));
  // cannot add somebody who is not them
  await assertFails(updateDoc(doc(member, "groups", GID), {
    memberUids: [OWNER, OUTSIDER],
    updatedAt: 2,
  }));
  // claiming an unclaimed name row is the supported path
  await assertSucceeds(updateDoc(doc(member, "groups", GID), {
    memberUids: [OWNER, MEMBER],
    members: [
      { id: "m1", name: "Gaurav", upi: "", uid: OWNER },
      { id: "m2", name: "Aisha", upi: "", uid: MEMBER },
    ],
    updatedAt: 2,
  }));
});

await t("a member keeps the ledger, an outsider cannot touch it", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER] }));
  });
  await assertSucceeds(setDoc(doc(member, "groups", GID, "expenses", "e1"), expenseDoc()));
  await assertSucceeds(getDoc(doc(owner, "groups", GID, "expenses", "e1")));
  await assertSucceeds(deleteDoc(doc(owner, "groups", GID, "expenses", "e1")));

  await assertFails(setDoc(doc(outsider, "groups", GID, "expenses", "e2"), expenseDoc({ id: "e2" })));
  await assertFails(getDocs(collection(outsider, "groups", GID, "expenses")));
});

await t("expense shape is enforced, including a positive amount in the right group", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc());
  });
  await assertFails(setDoc(doc(owner, "groups", GID, "expenses", "e1"), expenseDoc({ amountP: 0 })));
  await assertFails(setDoc(doc(owner, "groups", GID, "expenses", "e1"), expenseDoc({ amountP: 12.5 })));
  await assertFails(setDoc(doc(owner, "groups", GID, "expenses", "e1"), expenseDoc({ groupId: "other" })));
  await assertFails(setDoc(doc(owner, "groups", GID, "expenses", "e1"), expenseDoc({ desc: "x".repeat(301) })));
  await assertFails(setDoc(doc(owner, "groups", GID, "expenses", "e1"), expenseDoc({ sneaky: true })));
  await assertSucceeds(setDoc(doc(owner, "groups", GID, "expenses", "e1"), expenseDoc()));
});

await t("history is append-only for everyone, including the owner", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER] }));
  });
  const event = { id: "v1", groupId: GID, ts: 1, actor: "Gaurav", type: "expense", summary: "added dinner", data: {} };
  await assertSucceeds(setDoc(doc(member, "groups", GID, "events", "v1"), event));
  await assertFails(setDoc(doc(member, "groups", GID, "events", "v1"), { ...event, summary: "rewritten" }));
  await assertFails(setDoc(doc(owner, "groups", GID, "events", "v1"), { ...event, summary: "rewritten" }));
  await assertFails(deleteDoc(doc(owner, "groups", GID, "events", "v1")));
});

await t("an owner left alone in the group may clear its history", async () => {
  const event = { id: "v1", groupId: GID, ts: 1, actor: "Gaurav", type: "expense", summary: "added dinner", data: {} };
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc());
    await setDoc(doc(ctx.firestore(), "groups", GID, "events", "v1"), event);
  });
  await assertFails(deleteDoc(doc(outsider, "groups", GID, "events", "v1")));
  await assertSucceeds(deleteDoc(doc(owner, "groups", GID, "events", "v1")));
});

await t("deleting an account leaves shared groups: the rest keep the ledger", async () => {
  const both = [
    { id: "m1", name: "Gaurav", upi: "", uid: OWNER },
    { id: "m2", name: "Aisha", upi: "", uid: MEMBER },
  ];
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER], members: both }));
  });
  // A member steps out; their row stays on past entries without a login.
  await assertSucceeds(updateDoc(doc(member, "groups", GID), {
    memberUids: [OWNER],
    members: [both[0], { ...both[1], uid: null }],
    updatedAt: 2,
  }));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER], members: both }));
  });
  // The owner can step out too; the group carries on for the others.
  await assertSucceeds(updateDoc(doc(owner, "groups", GID), {
    memberUids: [MEMBER],
    members: [{ ...both[0], uid: null }, both[1]],
    updatedAt: 2,
  }));
  await assertSucceeds(getDoc(doc(member, "groups", GID)));
});

await t("only the owner deletes the group", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER] }));
  });
  await assertFails(deleteDoc(doc(member, "groups", GID)));
  await assertSucceeds(deleteDoc(doc(owner, "groups", GID)));
});

await t("proof stays within the document size guard", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc());
  });
  const proof = { id: "a1", mime: "image/jpeg", name: "receipt.jpg", ts: 1, b64: "x".repeat(100) };
  await assertSucceeds(setDoc(doc(owner, "groups", GID, "attachments", "a1"), proof));
  await assertFails(setDoc(doc(owner, "groups", GID, "attachments", "a1"), { ...proof, b64: "x".repeat(900001) }));
});

await t("the personal backup is still sealed to its own uid", async () => {
  await assertSucceeds(setDoc(doc(owner, "users", OWNER, "groups", GID), {
    id: GID, name: "Solo", emoji: "🧾", currency: "INR", members: [], createdAt: 1, updatedAt: 1,
  }));
  await assertFails(getDoc(doc(member, "users", OWNER, "groups", GID)));
  await assertFails(setDoc(doc(member, "users", OWNER, "groups", GID), {
    id: GID, name: "hijack", emoji: "🧾", currency: "INR", members: [], createdAt: 1, updatedAt: 1,
  }));
});

await t("a profile carrying the new accent and phone fields is accepted", async () => {
  await assertSucceeds(setDoc(doc(owner, "users", OWNER, "meta", "profile"), {
    name: "Gaurav", upi: "g@upi", phone: "+919999999999", theme: "dark", accent: "azure", updatedAt: 1,
  }));
  await assertFails(setDoc(doc(owner, "users", OWNER, "meta", "profile"), {
    name: "Gaurav", upi: "g@upi", phone: "+919999999999", theme: "dark", accent: "neon", updatedAt: 1,
  }));
});

await t("repeating and foreign-currency expenses are accepted in a shared group", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER] }));
  });
  await assertSucceeds(setDoc(doc(member, "groups", GID, "expenses", "e1"), expenseDoc({
    repeat: { freq: "monthly", day: 31 },
    seriesId: "e1",
    fx: { currency: "USD", amount: 45.5, rate: 83.42 },
  })));
  await assertSucceeds(setDoc(doc(member, "groups", GID, "expenses", "e2"), expenseDoc({ id: "e2", repeat: null, seriesId: "e1", fx: null })));
  await assertSucceeds(setDoc(doc(member, "groups", GID, "expenses", "e3"), expenseDoc({
    id: "e3",
    split: {
      mode: "items",
      participants: [{ memberId: "m1" }],
      items: [{ name: "Paneer", amountP: 100000, memberIds: ["m1"] }],
    },
  })));
  await assertFails(setDoc(doc(member, "groups", GID, "expenses", "e4"), expenseDoc({ id: "e4", repeat: { freq: "hourly" } })));
  await assertFails(setDoc(doc(member, "groups", GID, "expenses", "e5"), expenseDoc({ id: "e5", repeat: { freq: "monthly", day: 32 } })));
  await assertFails(setDoc(doc(member, "groups", GID, "expenses", "e6"), expenseDoc({ id: "e6", fx: { currency: "DOLLARS", amount: 1, rate: 80 } })));
  await assertFails(setDoc(doc(member, "groups", GID, "expenses", "e7"), expenseDoc({ id: "e7", fx: { currency: "USD", amount: 1, rate: 0 } })));
  await assertFails(setDoc(doc(outsider, "groups", GID, "expenses", "e8"), expenseDoc({ id: "e8", repeat: { freq: "weekly" } })));
});

await t("a group can carry the split new expenses start from", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER] }));
  });
  const split = { mode: "percent", participants: [{ memberId: "m1", value: 60 }, { memberId: "m2", value: 40 }] };
  await assertSucceeds(setDoc(doc(member, "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER], defaultSplit: split, updatedAt: 2 })));
  await assertSucceeds(setDoc(doc(member, "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER], defaultSplit: null, updatedAt: 3 })));
  await assertFails(setDoc(doc(member, "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER], defaultSplit: { mode: "items", participants: [] }, updatedAt: 4 })));
  await assertSucceeds(setDoc(doc(owner, "users", OWNER, "groups", "solo"), {
    id: "solo", name: "Flat", emoji: "home", currency: "INR", defaultSplit: split, members: [], createdAt: 1, updatedAt: 1,
  }));
});

await t("the personal backup takes the new expense fields and still rejects strays", async () => {
  await assertSucceeds(setDoc(doc(owner, "users", OWNER, "expenses", "e1"), expenseDoc({
    repeat: { freq: "weekly" },
    seriesId: "e1",
    fx: { currency: "THB", amount: 1200, rate: 2.47 },
  })));
  await assertFails(setDoc(doc(owner, "users", OWNER, "expenses", "e2"), expenseDoc({ id: "e2", stray: true })));
});

await t("comments are history entries only members can add, and nobody can edit", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "groups", GID), groupDoc({ memberUids: [OWNER, MEMBER] }));
  });
  const comment = { id: "c1", groupId: GID, ts: 5, actor: "Aisha", type: "comment", summary: "Was the tip included?", data: { expenseId: "e1" } };
  await assertSucceeds(setDoc(doc(member, "groups", GID, "events", "c1"), comment));
  await assertFails(setDoc(doc(outsider, "groups", GID, "events", "c2"), { ...comment, id: "c2" }));
  await assertFails(setDoc(doc(member, "groups", GID, "events", "c1"), { ...comment, summary: "edited" }));
  await assertFails(deleteDoc(doc(member, "groups", GID, "events", "c1")));
});

await env.cleanup();
console.log(`\n${passed} rules tests passed`);
