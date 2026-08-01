// Ledger math tests. Run: npm test (or node tests/ledger.test.mjs)

import assert from "node:assert/strict";
import { distribute, computeShares, toPaise, fromPaise } from "../js/money.js";
import { computeBalances, simplify, upiLink } from "../js/settle.js";
import { mergeDirection } from "../js/cloud.js";
import { LIMITS, normalizeProfile, normalizeStoredRecord } from "../js/store.js";

let passed = 0;
function t(name, fn) {
  fn();
  passed += 1;
  console.log("ok - " + name);
}

t("toPaise parses human input", () => {
  assert.equal(toPaise("1,234.56"), 123456);
  assert.equal(toPaise("₹99"), 9900);
  assert.equal(toPaise("0.01"), 1);
  assert.ok(Number.isNaN(toPaise("abc")));
  assert.ok(Number.isNaN(toPaise("")));
  assert.ok(Number.isNaN(toPaise("-50")));
});

t("fromPaise round-trips", () => {
  assert.equal(fromPaise(123456), "1234.56");
  assert.equal(fromPaise(50000), "500");
  assert.equal(toPaise(fromPaise(123456)), 123456);
});

t("cloud merge chooses the newer side", () => {
  assert.equal(mergeDirection({ id: "x", updatedAt: 20 }, { id: "x", updatedAt: 10 }), "local");
  assert.equal(mergeDirection({ id: "x", updatedAt: 10 }, { id: "x", updatedAt: 20 }), "remote");
  assert.equal(mergeDirection(null, { id: "x", createdAt: 1 }), "remote");
  assert.equal(mergeDirection({ id: "x", createdAt: 1 }, null), "local");
});

t("legacy profiles migrate to the cloud-safe shape", () => {
  assert.deepEqual(normalizeProfile({ name: "Gaurav", upi: "g@upi", extra: true }, 1234), {
    name: "Gaurav",
    upi: "g@upi",
    phone: "",
    theme: "dark",
    accent: "coral",
    updatedAt: 1234,
  });
  const current = { name: "Gaurav", upi: "", phone: "", theme: "light", accent: "azure", updatedAt: 99 };
  assert.deepEqual(normalizeProfile(current, 1234), current);
  const bounded = normalizeProfile({ name: "n".repeat(500), upi: "u".repeat(500), phone: "9".repeat(80), theme: "dark" }, 1);
  assert.equal(bounded.name.length, LIMITS.profileName);
  assert.equal(bounded.upi.length, LIMITS.upi);
  assert.equal(bounded.phone.length, LIMITS.phone);
  // An unknown accent must fall back rather than reach Firestore and be rejected.
  assert.equal(normalizeProfile({ name: "G", accent: "neon" }, 1).accent, "coral");
});

t("legacy ledger text is bounded without dropping references", () => {
  const attachments = Array.from({ length: 30 }, (_, index) => `proof-${index}`);
  const expense = normalizeStoredRecord("expenses", {
    id: "x",
    desc: "d".repeat(500),
    notes: "n".repeat(1500),
    attachments,
  });
  assert.equal(expense.desc.length, LIMITS.expenseDesc);
  assert.equal(expense.notes.length, LIMITS.expenseNotes);
  assert.deepEqual(expense.attachments, attachments);
});

t("equal split distributes remainder deterministically", () => {
  const out = distribute(100, [{ id: "a", w: 1 }, { id: "b", w: 1 }, { id: "c", w: 1 }]);
  assert.equal(out.get("a") + out.get("b") + out.get("c"), 100);
  assert.deepEqual([out.get("a"), out.get("b"), out.get("c")], [34, 33, 33]);
  const out2 = distribute(101, [{ id: "b", w: 1 }, { id: "a", w: 1 }]);
  assert.deepEqual([out2.get("a"), out2.get("b")], [51, 50]);
});

t("weighted and percent splits sum exactly to the total", () => {
  for (const total of [999, 100001, 7]) {
    const out = distribute(total, [{ id: "a", w: 2 }, { id: "b", w: 1 }, { id: "c", w: 1 }]);
    assert.equal([...out.values()].reduce((x, y) => x + y, 0), total);
  }
  const pct = computeShares({
    amountP: 100000,
    split: {
      mode: "percent",
      participants: [
        { memberId: "a", value: 50 },
        { memberId: "b", value: 30 },
        { memberId: "c", value: 20 },
      ],
    },
  });
  assert.deepEqual([pct.get("a"), pct.get("b"), pct.get("c")], [50000, 30000, 20000]);
});

t("weighted splits reject negative and non-finite shares", () => {
  assert.equal(distribute(10000, [{ id: "a", w: -50 }, { id: "b", w: 150 }]), null);
  assert.equal(distribute(10000, [{ id: "a", w: 1 }, { id: "b", w: Infinity }]), null);
  assert.deepEqual([...computeShares({
    amountP: 10000,
    split: { mode: "shares", participants: [{ memberId: "a", value: -1 }, { memberId: "b", value: 2 }] },
  }).entries()], []);
});

t("exact split passes through", () => {
  const out = computeShares({
    amountP: 500,
    split: { mode: "exact", participants: [{ memberId: "a", valueP: 200 }, { memberId: "b", valueP: 300 }] },
  });
  assert.deepEqual([out.get("a"), out.get("b")], [200, 300]);
  assert.deepEqual([...computeShares({
    amountP: 500,
    split: { mode: "exact", participants: [{ memberId: "a", valueP: -100 }, { memberId: "b", valueP: 600 }] },
  }).entries()], []);
});

t("balances always sum to zero", () => {
  const members = ["a", "b", "c", "d"];
  const expenses = [
    {
      amountP: 479360,
      payers: [{ memberId: "a", amountP: 479360 }],
      split: { mode: "equal", participants: members.map((m) => ({ memberId: m })) },
    },
    {
      amountP: 48000,
      payers: [{ memberId: "d", amountP: 48000 }],
      split: { mode: "equal", participants: [{ memberId: "b" }, { memberId: "c" }, { memberId: "d" }] },
    },
    {
      amountP: 1000,
      payers: [{ memberId: "a", amountP: 400 }, { memberId: "b", amountP: 600 }],
      split: { mode: "shares", participants: [{ memberId: "a", value: 3 }, { memberId: "c", value: 1 }] },
    },
  ];
  const settlements = [{ fromId: "b", toId: "a", amountP: 100000 }];
  const bal = computeBalances(members, expenses, settlements);
  assert.equal([...bal.values()].reduce((x, y) => x + y, 0), 0);
});

t("smart settle clears everything with at most n-1 transfers", () => {
  const members = ["a", "b", "c"];
  const expenses = [
    {
      amountP: 300,
      payers: [{ memberId: "a", amountP: 300 }],
      split: { mode: "equal", participants: members.map((m) => ({ memberId: m })) },
    },
  ];
  const bal = computeBalances(members, expenses, []);
  const plan = simplify(bal);
  assert.equal(plan.length, 2);
  assert.ok(plan.length <= members.length - 1);
  const after = computeBalances(members, expenses, plan);
  for (const v of after.values()) assert.equal(v, 0);
});

t("smart settle keeps the n-1 bound on non-minimal greedy cases", () => {
  const balances = new Map([["a", -500], ["b", -400], ["c", 100], ["d", 400], ["e", 400]]);
  const plan = simplify(balances);
  assert.ok(plan.length <= balances.size - 1);
  const after = new Map(balances);
  for (const payment of plan) {
    after.set(payment.fromId, after.get(payment.fromId) + payment.amountP);
    after.set(payment.toId, after.get(payment.toId) - payment.amountP);
  }
  for (const value of after.values()) assert.equal(value, 0);
});

t("simplify conserves money", () => {
  const bal = new Map([["a", 523], ["b", -223], ["c", -300], ["d", 0]]);
  const plan = simplify(bal);
  const paid = plan.reduce((x, y) => x + y.amountP, 0);
  assert.equal(paid, 523);
  const after = new Map(bal);
  for (const p of plan) {
    after.set(p.fromId, after.get(p.fromId) + p.amountP);
    after.set(p.toId, after.get(p.toId) - p.amountP);
  }
  for (const v of after.values()) assert.equal(v, 0);
});

t("deleted records never count", () => {
  const bal = computeBalances(
    ["a", "b"],
    [{
      amountP: 1000,
      deleted: true,
      payers: [{ memberId: "a", amountP: 1000 }],
      split: { mode: "equal", participants: [{ memberId: "a" }, { memberId: "b" }] },
    }],
    [{ fromId: "b", toId: "a", amountP: 500, deleted: true }],
  );
  for (const v of bal.values()) assert.equal(v, 0);
});

t("upi link formats amount in rupees", () => {
  const link = upiLink({ vpa: "gaurav@upi", name: "Gaurav", amountP: 184050, note: "Settld" });
  assert.ok(link.startsWith("upi://pay?"));
  assert.ok(link.includes("am=1840.50"));
  assert.ok(link.includes("pa=gaurav%40upi"));
});

console.log(`\n${passed} tests passed`);
