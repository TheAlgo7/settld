// App state and actions. Reads land in an in-memory cache, writes go to
// IndexedDB and append an event to the group's trail. History is
// append-only: expenses are soft-deleted, edits log a summary of what
// changed, events are never rewritten.

import { db } from "./db.js";
import { fmt } from "./money.js";

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

export async function init() {
  const [groups, expenses, settlements, events, profile] = await Promise.all([
    db.all("groups"),
    db.all("expenses"),
    db.all("settlements"),
    db.all("events"),
    db.kvGet("profile"),
  ]);
  state.groups = groups.sort((a, b) => b.updatedAt - a.updatedAt);
  state.expenses = expenses;
  state.settlements = settlements;
  state.events = events;
  state.profile = profile ?? null;
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
  state.settlements.filter((s) => s.groupId === gid).sort((a, b) => b.createdAt - a.createdAt);
export const eventsOf = (gid) =>
  state.events.filter((e) => e.groupId === gid).sort((a, b) => b.ts - a.ts);
export const allEvents = () => [...state.events].sort((a, b) => b.ts - a.ts);
export const memberOf = (group, id) => group.members.find((m) => m.id === id);
export const youOf = (group) => group.members.find((m) => m.isYou);

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
    actor: state.profile?.name ?? "You",
    type,
    summary,
    data,
  };
  await db.put("events", ev);
  state.events.push(ev);
  return ev;
}

// ---- actions ----

export async function saveProfile(patch) {
  state.profile = { name: "", upi: "", theme: "dark", ...state.profile, ...patch };
  await db.kvSet("profile", state.profile);
  emit();
}

export async function createGroup({ name, emoji, memberNames = [] }) {
  const now = Date.now();
  const members = [
    { id: uid(), name: state.profile?.name || "You", upi: state.profile?.upi || "", isYou: true },
    ...memberNames
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => ({ id: uid(), name: n, upi: "" })),
  ];
  const group = { id: uid(), name, emoji, currency: "INR", members, createdAt: now, updatedAt: now };
  await db.put("groups", group);
  state.groups.unshift(group);
  await logEvent(group.id, "group", `${group.members[0].name} created the group`);
  emit();
  return group;
}

export async function renameGroup(group, name, emoji) {
  const changed = group.name !== name;
  group.name = name;
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

export async function addMember(group, name) {
  const m = { id: uid(), name: name.trim(), upi: "" };
  group.members.push(m);
  await touchGroup(group);
  await logEvent(group.id, "member", `${m.name} joined the group`);
  emit();
  return m;
}

export async function updateMember(group, memberId, patch) {
  const m = memberOf(group, memberId);
  Object.assign(m, patch);
  await touchGroup(group);
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
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.82));
    return out && out.size < blob.size ? out : blob;
  } catch {
    return blob;
  }
}

export async function addAttachment(blob, name) {
  const small = await compressImage(blob);
  const rec = { id: uid(), blob: small, mime: small.type, name: name ?? "proof", ts: Date.now() };
  await db.put("attachments", rec);
  return rec.id;
}

export const getAttachment = (id) => db.get("attachments", id);

export async function addExpense(group, data) {
  const now = Date.now();
  const e = { id: uid(), groupId: group.id, createdAt: now, updatedAt: now, deleted: false, ...data };
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
  Object.assign(expense, patch, { updatedAt: Date.now() });
  await db.put("expenses", expense);
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
    note: note ?? "",
    attachments: attachments ?? [],
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

export async function eraseAll() {
  await db.wipe();
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
