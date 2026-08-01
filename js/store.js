// App state and actions. Reads land in an in-memory cache, writes go to
// IndexedDB and append an event to the group's trail. History is
// append-only: expenses are soft-deleted, edits log a summary of what
// changed, events are never rewritten.

import { db } from "./db.js";
import { fmt } from "./money.js";

export const LIMITS = Object.freeze({
  profileName: 120,
  upi: 200,
  phone: 24,
  groupName: 160,
  memberName: 120,
  members: 100,
  expenseDesc: 300,
  expenseNotes: 1000,
  settlementNote: 500,
  attachments: 20,
  attachmentName: 300,
  eventSummary: 1000,
});

const limited = (value, max, trim = true) => {
  const text = String(value ?? "");
  return (trim ? text.trim() : text).slice(0, max);
};

function limitedAttachments(values) {
  const ids = Array.isArray(values) ? values : [];
  if (ids.length > LIMITS.attachments) {
    const error = new Error(`No more than ${LIMITS.attachments} proofs can be attached`);
    error.code = "proof/too-many";
    throw error;
  }
  return [...ids];
}

export const state = {
  ready: false,
  profile: null, // { name, upi, theme }
  groups: [],
  expenses: [],
  settlements: [],
  events: [],
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn();
}

export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Alias for functions that take an account id called `uid` and still need to
// mint a record id.
const newId = uid;

export const ACCENT_IDS = Object.freeze(["coral", "amber", "mint", "azure", "violet", "rose"]);

export function normalizeProfile(profile, now = Date.now()) {
  if (!profile) return null;
  const themes = new Set(["dark", "light", "system"]);
  return {
    name: limited(typeof profile.name === "string" ? profile.name : "", LIMITS.profileName),
    upi: limited(typeof profile.upi === "string" ? profile.upi : "", LIMITS.upi),
    phone: limited(typeof profile.phone === "string" ? profile.phone : "", LIMITS.phone),
    theme: themes.has(profile.theme) ? profile.theme : "dark",
    accent: ACCENT_IDS.includes(profile.accent) ? profile.accent : "coral",
    updatedAt: Number.isInteger(profile.updatedAt) && profile.updatedAt > 0 ? profile.updatedAt : now,
  };
}

export function normalizeStoredRecord(storeName, record) {
  if (!record) return record;
  if (storeName === "groups") {
    return {
      ...record,
      name: limited(record.name, LIMITS.groupName),
      members: (Array.isArray(record.members) ? record.members : []).map((member) => ({
        ...member,
        name: limited(member.name, LIMITS.memberName),
        upi: limited(member.upi, LIMITS.upi),
      })),
    };
  }
  if (storeName === "expenses") {
    return {
      ...record,
      desc: limited(record.desc, LIMITS.expenseDesc),
      notes: limited(record.notes, LIMITS.expenseNotes, false),
      attachments: Array.isArray(record.attachments) ? record.attachments : [],
    };
  }
  if (storeName === "settlements") {
    return {
      ...record,
      note: limited(record.note, LIMITS.settlementNote, false),
      attachments: Array.isArray(record.attachments) ? record.attachments : [],
    };
  }
  if (storeName === "events") {
    return {
      ...record,
      actor: limited(record.actor ?? "You", LIMITS.profileName),
      summary: limited(record.summary, LIMITS.eventSummary, false),
    };
  }
  return record;
}

export async function init() {
  const [groups, expenses, settlements, events, profile] = await Promise.all([
    db.all("groups"),
    db.all("expenses"),
    db.all("settlements"),
    db.all("events"),
    db.kvGet("profile"),
  ]);
  const migrateRecords = async (storeName, records) => Promise.all(records.map(async (record) => {
    const normalized = normalizeStoredRecord(storeName, record);
    if (JSON.stringify(record) !== JSON.stringify(normalized)) await db.put(storeName, normalized, true);
    return normalized;
  }));
  const [migratedGroups, migratedExpenses, migratedSettlements, migratedEvents] = await Promise.all([
    migrateRecords("groups", groups),
    migrateRecords("expenses", expenses),
    migrateRecords("settlements", settlements),
    migrateRecords("events", events),
  ]);
  const migratedProfile = normalizeProfile(profile);
  if (profile && JSON.stringify(profile) !== JSON.stringify(migratedProfile)) {
    await db.kvSet("profile", migratedProfile, true);
  }
  state.groups = migratedGroups.sort((a, b) => b.updatedAt - a.updatedAt);
  state.expenses = migratedExpenses;
  state.settlements = migratedSettlements;
  state.events = migratedEvents;
  state.profile = migratedProfile;
  state.ready = true;
  emit();
}

// ---- selectors ----

export const groupById = (id) => state.groups.find((g) => g.id === id);
export const expensesOf = (gid) =>
  state.expenses
    .filter((e) => e.groupId === gid && !e.deleted)
    .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
export const settlementsOf = (gid) =>
  state.settlements.filter((s) => s.groupId === gid && !s.deleted).sort((a, b) => b.createdAt - a.createdAt);
export const eventsOf = (gid) =>
  state.events.filter((e) => e.groupId === gid).sort((a, b) => b.ts - a.ts);
export const allEvents = () => [...state.events].sort((a, b) => b.ts - a.ts);
export const memberOf = (group, id) => group.members.find((m) => m.id === id);
export const youOf = (group) => group.members.find((m) => m.isYou);
export const isShared = (group) => Boolean(group?.shared);
export const sharedGroupIds = () => new Set(state.groups.filter(isShared).map((g) => g.id));
export const groupOfRecord = (record) => (record?.groupId ? groupById(record.groupId) : null);

// In a shared group "you" is whoever carries your account id, so the flag is
// recomputed per device instead of travelling inside the shared document.
export function applyIdentity(group, uid) {
  if (!isShared(group) || !uid) return group;
  for (const m of group.members) {
    if (m.uid) m.isYou = m.uid === uid;
    else delete m.isYou;
  }
  return group;
}

// ---- internals ----

async function touchGroup(group) {
  group.updatedAt = Date.now();
  await db.put("groups", group);
  state.groups.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function logEvent(groupId, type, summary, data = {}) {
  const ev = {
    id: uid(),
    groupId,
    ts: Date.now(),
    actor: limited(state.profile?.name ?? "You", LIMITS.profileName),
    type,
    summary: limited(summary, LIMITS.eventSummary, false),
    data,
  };
  await db.put("events", ev);
  state.events.push(ev);
  return ev;
}

// ---- actions ----

export async function saveProfile(patch) {
  state.profile = normalizeProfile({ name: "", upi: "", phone: "", theme: "dark", accent: "coral", ...state.profile, ...patch, updatedAt: Date.now() });
  await db.kvSet("profile", state.profile);
  emit();
}

export async function createGroup({ name, emoji, memberNames = [] }) {
  const now = Date.now();
  const otherNames = memberNames.map((n) => limited(n, LIMITS.memberName)).filter(Boolean).slice(0, LIMITS.members - 1);
  const members = [
    { id: uid(), name: limited(state.profile?.name || "You", LIMITS.memberName), upi: limited(state.profile?.upi || "", LIMITS.upi), isYou: true },
    ...otherNames.map((n) => ({ id: uid(), name: n, upi: "" })),
  ];
  const group = { id: uid(), name: limited(name, LIMITS.groupName), emoji, currency: "INR", members, createdAt: now, updatedAt: now };
  await db.put("groups", group);
  state.groups.unshift(group);
  await logEvent(group.id, "group", `${group.members[0].name} created the group`);
  emit();
  return group;
}

export async function renameGroup(group, name, emoji) {
  const nextName = limited(name, LIMITS.groupName);
  const changed = group.name !== nextName;
  group.name = nextName;
  group.emoji = emoji;
  await touchGroup(group);
  if (changed) await logEvent(group.id, "group", `Group renamed to ${name}`);
  emit();
}

export async function deleteGroup(group) {
  const gone = [
    ...state.expenses.filter((e) => e.groupId === group.id),
    ...state.settlements.filter((s) => s.groupId === group.id),
  ];
  const attIds = gone.flatMap((r) => r.attachments ?? []);
  await Promise.all([
    db.del("groups", group.id),
    ...state.expenses.filter((e) => e.groupId === group.id).map((e) => db.del("expenses", e.id)),
    ...state.settlements.filter((s) => s.groupId === group.id).map((s) => db.del("settlements", s.id)),
    ...state.events.filter((e) => e.groupId === group.id).map((e) => db.del("events", e.id)),
    ...attIds.map((id) => db.del("attachments", id)),
  ]);
  state.groups = state.groups.filter((g) => g.id !== group.id);
  state.expenses = state.expenses.filter((e) => e.groupId !== group.id);
  state.settlements = state.settlements.filter((s) => s.groupId !== group.id);
  state.events = state.events.filter((e) => e.groupId !== group.id);
  emit();
}

// ---- shared group membership ----

export async function markShared(group, { ownerUid, memberUids, youMemberId }) {
  group.shared = true;
  group.ownerUid = ownerUid;
  group.memberUids = [...new Set(memberUids)];
  const you = youMemberId ? memberOf(group, youMemberId) : youOf(group);
  if (you) you.uid = ownerUid;
  applyIdentity(group, ownerUid);
  await touchGroup(group);
  emit();
  return group;
}

// Joining either claims an existing name row, so their balance carries over,
// or adds a new person when none of the names is them.
export async function joinAs(group, { uid, memberId, name, upi }) {
  group.shared = true;
  group.memberUids = [...new Set([...(group.memberUids ?? []), uid])];
  let member = memberId ? memberOf(group, memberId) : null;
  if (member) {
    member.uid = uid;
    if (name) member.name = limited(name, LIMITS.memberName);
    if (upi) member.upi = limited(upi, LIMITS.upi);
  } else {
    member = {
      id: newId(),
      name: limited(name || "You", LIMITS.memberName),
      upi: limited(upi ?? "", LIMITS.upi),
      uid,
    };
    group.members.push(member);
  }
  applyIdentity(group, uid);
  await db.put("groups", group, true);
  if (!state.groups.some((g) => g.id === group.id)) state.groups.unshift(group);
  emit();
  return member;
}

export async function addMember(group, name) {
  if (group.members.length >= LIMITS.members) {
    const error = new Error(`A group can have up to ${LIMITS.members} members`);
    error.code = "group/member-limit";
    throw error;
  }
  const m = { id: uid(), name: limited(name, LIMITS.memberName), upi: "" };
  group.members.push(m);
  await touchGroup(group);
  await logEvent(group.id, "member", `${m.name} joined the group`);
  emit();
  return m;
}

export async function updateMember(group, memberId, patch) {
  const m = memberOf(group, memberId);
  const before = { name: m.name, upi: m.upi ?? "" };
  const safePatch = { ...patch };
  if ("name" in safePatch) safePatch.name = limited(safePatch.name, LIMITS.memberName);
  if ("upi" in safePatch) safePatch.upi = limited(safePatch.upi, LIMITS.upi);
  Object.assign(m, safePatch);
  await touchGroup(group);
  if (before.name !== m.name) {
    await logEvent(group.id, "member", `${before.name} was renamed to ${m.name}`, { memberId });
  }
  if (before.upi !== (m.upi ?? "")) {
    const action = m.upi ? (before.upi ? "changed" : "added") : "removed";
    await logEvent(group.id, "member", `${m.name}'s payment address was ${action}`, { memberId });
  }
  emit();
}

export async function removeMember(group, memberId) {
  const m = memberOf(group, memberId);
  group.members = group.members.filter((x) => x.id !== memberId);
  await touchGroup(group);
  await logEvent(group.id, "member", `${m.name} left the group`);
  emit();
}

// Downscale and re-encode camera photos before storing: a 4 MB receipt
// photo becomes a ~150-300 KB JPEG, which keeps IndexedDB lean and lets the
// cloud mirror fit images inside Firestore documents.
async function compressImage(blob) {
  if (!blob.type?.startsWith("image/")) return blob;
  try {
    const bmp = await createImageBitmap(blob);
    let maxSide = 1600;
    let quality = 0.82;
    let out = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bmp.width * scale));
      c.height = Math.max(1, Math.round(bmp.height * scale));
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      out = await new Promise((res) => c.toBlob(res, "image/jpeg", quality));
      if (out?.size <= 650000) break;
      maxSide = Math.round(maxSide * 0.78);
      quality = Math.max(0.56, quality - 0.08);
    }
    bmp.close?.();
    if (out?.size <= 650000) return out;
    throw new Error("proof/too-large");
  } catch {
    if (blob.size <= 650000) return blob;
    throw new Error("proof/too-large");
  }
}

export async function addAttachment(blob, name) {
  const small = await compressImage(blob);
  const rec = { id: uid(), blob: small, mime: small.type, name: limited(name ?? "proof", LIMITS.attachmentName, false), ts: Date.now() };
  await db.put("attachments", rec);
  return rec.id;
}

export const getAttachment = (id) => db.get("attachments", id);
export const deleteAttachment = (id) => db.del("attachments", id);

export async function addExpense(group, data) {
  const now = Date.now();
  const safeData = {
    ...data,
    desc: limited(data.desc, LIMITS.expenseDesc),
    notes: limited(data.notes, LIMITS.expenseNotes, false),
    attachments: limitedAttachments(data.attachments),
  };
  const e = { id: uid(), groupId: group.id, createdAt: now, updatedAt: now, deleted: false, ...safeData };
  await db.put("expenses", e);
  state.expenses.push(e);
  await logEvent(
    group.id,
    "expense",
    `${payerNames(group, e)} paid ${fmt(e.amountP)} for ${e.desc}`,
    { expenseId: e.id },
  );
  await touchGroup(group);
  emit();
  return e;
}

export async function updateExpense(group, expense, patch, changeSummary) {
  const previousAttachments = [...(expense.attachments ?? [])];
  const safePatch = { ...patch };
  if ("desc" in safePatch) safePatch.desc = limited(safePatch.desc, LIMITS.expenseDesc);
  if ("notes" in safePatch) safePatch.notes = limited(safePatch.notes, LIMITS.expenseNotes, false);
  if ("attachments" in safePatch) safePatch.attachments = limitedAttachments(safePatch.attachments);
  Object.assign(expense, safePatch, { updatedAt: Date.now() });
  await db.put("expenses", expense);
  const stillUsed = new Set([
    ...state.expenses.flatMap((item) => item.attachments ?? []),
    ...state.settlements.flatMap((item) => item.attachments ?? []),
  ]);
  await Promise.all(previousAttachments.filter((id) => !stillUsed.has(id)).map((id) => deleteAttachment(id)));
  await logEvent(group.id, "edit", `${expense.desc} edited: ${changeSummary}`, {
    expenseId: expense.id,
  });
  await touchGroup(group);
  emit();
}

export async function deleteExpense(group, expense) {
  expense.deleted = true;
  expense.updatedAt = Date.now();
  await db.put("expenses", expense);
  await logEvent(group.id, "delete", `${expense.desc} (${fmt(expense.amountP)}) was deleted`, {
    expenseId: expense.id,
  });
  await touchGroup(group);
  emit();
}

export async function addSettlement(group, { fromId, toId, amountP, note, attachments }) {
  const s = {
    id: uid(),
    groupId: group.id,
    fromId,
    toId,
    amountP,
    note: limited(note, LIMITS.settlementNote, false),
    attachments: limitedAttachments(attachments),
    createdAt: Date.now(),
    deleted: false,
  };
  await db.put("settlements", s);
  state.settlements.push(s);
  const from = memberOf(group, fromId)?.name ?? "?";
  const to = memberOf(group, toId)?.name ?? "?";
  await logEvent(group.id, "settle", `${from} paid ${to} ${fmt(amountP)}`, { settlementId: s.id });
  await touchGroup(group);
  emit();
  return s;
}

export async function voidSettlement(group, settlement) {
  if (settlement.deleted) return;
  settlement.deleted = true;
  settlement.updatedAt = Date.now();
  await db.put("settlements", settlement);
  const from = memberOf(group, settlement.fromId)?.name ?? "?";
  const to = memberOf(group, settlement.toId)?.name ?? "?";
  await logEvent(group.id, "settle", `${from} to ${to} payment of ${fmt(settlement.amountP)} was reversed`, {
    settlementId: settlement.id,
  });
  await touchGroup(group);
  emit();
}

function payerNames(group, expense) {
  return expense.payers.map((p) => memberOf(group, p.memberId)?.name ?? "?").join(", ");
}

export async function exportJson() {
  return {
    app: "settld",
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: state.profile ? { name: state.profile.name, upi: state.profile.upi } : null,
    groups: state.groups,
    expenses: state.expenses,
    settlements: state.settlements,
    events: state.events,
  };
}

export async function eraseAll({ ownerUid, resetAt } = {}) {
  await db.wipe();
  if (ownerUid && resetAt) await db.kvSet(`cloudResetAt:${ownerUid}`, resetAt, true);
  state.groups = [];
  state.expenses = [];
  state.settlements = [];
  state.events = [];
  state.profile = null;
  emit();
}

// ---- demo seed ----

function receiptBlob(lines) {
  const c = document.createElement("canvas");
  c.width = 480;
  c.height = 120 + lines.length * 44;
  const x = c.getContext("2d");
  x.fillStyle = "#f6f3ea";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#26241f";
  x.font = "700 26px monospace";
  x.fillText(lines[0], 32, 56);
  x.font = "400 22px monospace";
  lines.slice(1).forEach((l, i) => x.fillText(l, 32, 110 + i * 44));
  return new Promise((res) => c.toBlob(res, "image/png"));
}

export async function seedDemo() {
  const g = await createGroup({
    name: "Ahmedabad trip",
    emoji: "🏝️",
    memberNames: ["Ishita", "Rushi", "Ishaan"],
  });
  const [you, ishita, rushi, ishaan] = g.members;
  const day = 86400000;
  const t = Date.now();
  const eq = (ids) => ({ mode: "equal", participants: ids.map((id) => ({ memberId: id })) });
  const proof = await addAttachment(
    await receiptBlob(["HOTEL SHIVAY", "2 x Deluxe room  4280.00", "GST 12%        513.60", "TOTAL         4793.60"]),
    "hotel-receipt.png",
  );
  await addExpense(g, {
    desc: "Hotel, two nights",
    amountP: 479360,
    category: "stay",
    date: t - 2 * day,
    payers: [{ memberId: you.id, amountP: 479360 }],
    split: eq([you.id, ishita.id, rushi.id, ishaan.id]),
    attachments: [proof],
    notes: "Deluxe rooms, breakfast included",
  });
  await addExpense(g, {
    desc: "Manek Chowk dinner",
    amountP: 142000,
    category: "food",
    date: t - 2 * day,
    payers: [{ memberId: rushi.id, amountP: 142000 }],
    split: eq([you.id, ishita.id, rushi.id, ishaan.id]),
    attachments: [],
    notes: "",
  });
  await addExpense(g, {
    desc: "Cab, airport to hotel",
    amountP: 64500,
    category: "travel",
    date: t - 2 * day,
    payers: [{ memberId: ishita.id, amountP: 64500 }],
    split: eq([you.id, ishita.id, rushi.id, ishaan.id]),
    attachments: [],
    notes: "",
  });
  await addExpense(g, {
    desc: "Sabarmati riverfront tickets",
    amountP: 48000,
    category: "tickets",
    date: t - day,
    payers: [{ memberId: ishaan.id, amountP: 48000 }],
    split: eq([ishita.id, rushi.id, ishaan.id]),
    attachments: [],
    notes: "You skipped this one",
  });
  await addSettlement(g, { fromId: ishaan.id, toId: you.id, amountP: 100000, note: "GPay" });
  return g;
}
