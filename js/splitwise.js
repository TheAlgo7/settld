// Import from Splitwise's "Export as spreadsheet" CSV:
//
//   Date,Description,Category,Cost,Currency,Aisha,Rohan,Kabir
//   2026-03-01,Hotel,Hotel,4800.00,INR,3600.00,-1200.00,-2400.00
//   ...
//   2026-03-09,Total balance, , ,INR,1800.00,-600.00,-1200.00
//
// Each person's column is what they paid minus their share. Splitwise does
// not export who paid and who shared separately, so every row is rebuilt as
// the simplest expense with the same effect: people below zero owe exactly
// that much, people above zero paid for it. Balances come out identical.

import { distribute } from "./money.js";
import { fromSplitwiseCategory, guessCategory } from "./catalog.js";
import { spreadInr, toInrPaise } from "./fx.js";

export function parseCsv(text) {
  const s = String(text ?? "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

const cents = (value) => {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

function parseDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? "").trim());
  if (!m) return null;
  const ts = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12).getTime();
  return Number.isFinite(ts) ? ts : null;
}

export function parseSplitwise(text) {
  const rows = parseCsv(text);
  const h = rows.findIndex(
    (r) => r[0]?.trim().toLowerCase() === "date" && r[1]?.trim().toLowerCase() === "description" && r[3]?.trim().toLowerCase() === "cost",
  );
  if (h < 0) {
    const error = new Error("This isn't a Splitwise export");
    error.code = "splitwise/not-export";
    throw error;
  }
  const cols = rows[h].map((c, i) => ({ name: c.trim(), i })).slice(5).filter((c) => c.name);
  if (cols.length < 2) {
    const error = new Error("The export needs at least two people");
    error.code = "splitwise/no-people";
    throw error;
  }
  const entries = [];
  let total = null;
  let skipped = 0;
  for (const r of rows.slice(h + 1)) {
    if (!r.some((c) => c.trim())) continue;
    const desc = (r[1] ?? "").trim();
    const nets = cols.map((c) => cents(r[c.i]));
    if (desc.toLowerCase() === "total balance") {
      total = nets;
      continue;
    }
    const date = parseDate(r[0]);
    const cost = cents(r[3]);
    if (!date || !(cost > 0) || nets.some((n) => !Number.isFinite(n))) {
      skipped += 1;
      continue;
    }
    const category = (r[2] ?? "").trim();
    entries.push({
      date,
      desc: desc || "Expense",
      category,
      payment: category.toLowerCase() === "payment",
      cost,
      currency: ((r[4] ?? "").trim() || "INR").toUpperCase(),
      nets,
    });
  }
  return { members: cols.map((c) => c.name), entries, total, skipped };
}

const key = (i) => String(i).padStart(4, "0");

// One row, in the row's own currency cents: who paid what and who owes what.
export function rebuildRow(entry) {
  const { nets, cost } = entry;
  if (entry.payment) {
    let from = -1;
    let to = -1;
    nets.forEach((n, i) => {
      if (n > 0 && (from < 0 || n > nets[from])) from = i;
      if (n < 0 && (to < 0 || n < nets[to])) to = i;
    });
    return from >= 0 && to >= 0 ? { kind: "payment", from, to, amount: cost } : null;
  }
  const shares = nets.map((n) => (n < 0 ? -n : 0));
  const owed = shares.reduce((a, v) => a + v, 0);
  const payers = nets.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
  const rest = cost - owed;
  if (!payers.length || rest < 0) return null;
  const payerShares = distribute(rest, payers.map((i) => ({ id: key(i), w: nets[i] })));
  if (!payerShares) return null;
  for (const i of payers) shares[i] = payerShares.get(key(i));
  const paid = nets.map((n, i) => (n > 0 ? n + shares[i] : 0));
  const diff = cost - paid.reduce((a, v) => a + v, 0);
  if (diff) {
    const top = payers.reduce((a, i) => (paid[i] > paid[a] ? i : a), payers[0]);
    paid[top] += diff;
    if (paid[top] <= 0) return null;
  }
  return { kind: "expense", paid, shares };
}

// Settld records for a parsed export. `memberIds[i]` is the member for column
// i; `rates` maps a currency code to rupees per unit for any non-rupee rows.
export function buildImport(parsed, memberIds, rates = {}) {
  const expenses = [];
  const settlements = [];
  let skipped = parsed.skipped;
  let converted = 0;
  for (const entry of parsed.entries) {
    const rate = entry.currency === "INR" ? 1 : rates[entry.currency];
    if (!rate) {
      skipped += 1;
      continue;
    }
    const row = rebuildRow(entry);
    if (!row) {
      skipped += 1;
      continue;
    }
    const amountP = entry.currency === "INR" ? entry.cost : toInrPaise(entry.cost, rate);
    if (!(amountP > 0)) {
      skipped += 1;
      continue;
    }
    if (entry.currency !== "INR") converted += 1;
    if (row.kind === "payment") {
      settlements.push({ fromId: memberIds[row.from], toId: memberIds[row.to], amountP, date: entry.date });
      continue;
    }
    const paidP = entry.currency === "INR" ? row.paid : spreadInr(amountP, row.paid);
    const sharesP = entry.currency === "INR" ? row.shares : spreadInr(amountP, row.shares);
    const expense = {
      desc: entry.desc,
      amountP,
      category: fromSplitwiseCategory(entry.category) ?? guessCategory(entry.desc) ?? "other",
      date: entry.date,
      payers: paidP.map((v, i) => ({ memberId: memberIds[i], amountP: v })).filter((p) => p.amountP > 0),
      split: {
        mode: "exact",
        participants: sharesP.map((v, i) => ({ memberId: memberIds[i], valueP: v })).filter((p) => p.valueP > 0),
      },
      attachments: [],
      notes: "",
    };
    if (entry.currency !== "INR") expense.fx = { currency: entry.currency, amount: entry.cost / 100, rate };
    expenses.push(expense);
  }
  return { expenses, settlements, skipped, converted };
}

// "goa-trip_2026-03-09_export.csv" -> "Goa trip"
export function nameFromFile(fileName) {
  const base = String(fileName ?? "")
    .replace(/\.csv$/i, "")
    .replace(/_\d{4}-\d{2}-\d{2}_export$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "Imported group";
}
