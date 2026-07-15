// Balance and settlement math. Pure functions over ledger records.

import { computeShares } from "./money.js";

// Net position per member in paise. Positive = should receive,
// negative = owes. Deleted records never count.
export function computeBalances(memberIds, expenses, settlements) {
  const bal = new Map(memberIds.map((id) => [id, 0]));
  const add = (id, v) => bal.set(id, (bal.get(id) ?? 0) + v);
  for (const e of expenses) {
    if (e.deleted) continue;
    for (const p of e.payers) add(p.memberId, p.amountP);
    for (const [id, share] of computeShares(e)) add(id, -share);
  }
  for (const s of settlements) {
    if (s.deleted) continue;
    add(s.fromId, s.amountP);
    add(s.toId, -s.amountP);
  }
  return bal;
}

// Greedy min-transfer plan: largest debtor pays largest creditor.
// Produces at most (members - 1) transfers, deterministic order.
export function simplify(balances) {
  const debtors = [];
  const creditors = [];
  for (const [id, v] of balances) {
    if (v < 0) debtors.push({ id, v: -v });
    else if (v > 0) creditors.push({ id, v });
  }
  const byAmt = (a, b) => b.v - a.v || (a.id < b.id ? -1 : 1);
  debtors.sort(byAmt);
  creditors.sort(byAmt);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    out.push({ fromId: debtors[i].id, toId: creditors[j].id, amountP: amt });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v === 0) i += 1;
    if (creditors[j].v === 0) j += 1;
  }
  return out;
}

export function totalSpend(expenses) {
  return expenses.reduce((a, e) => a + (e.deleted ? 0 : e.amountP), 0);
}

// upi://pay deep link. Amount in paise, name optional.
export function upiLink({ vpa, name, amountP, note }) {
  const q = new URLSearchParams();
  q.set("pa", vpa);
  if (name) q.set("pn", name);
  if (amountP > 0) q.set("am", (amountP / 100).toFixed(2));
  q.set("cu", "INR");
  if (note) q.set("tn", note);
  return "upi://pay?" + q.toString();
}
