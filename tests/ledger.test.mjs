// Ledger math tests. Run: npm test (or node tests/ledger.test.mjs)

import assert from "node:assert/strict";
import { distribute, computeShares, toPaise, fromPaise } from "../js/money.js";
import { computeBalances, simplify, upiLink } from "../js/settle.js";
import { mergeDirection } from "../js/cloud.js";
import { LIMITS, normalizeProfile, normalizeStoredRecord } from "../js/store.js";
import { makeRepeat, nextDate, dueDates, occurrenceId } from "../js/recurring.js";
import { guessCategory, groupIconId } from "../js/catalog.js";
import { spreadInr, toInrPaise } from "../js/fx.js";
import { parseSplitwise, buildImport, nameFromFile } from "../js/splitwise.js";

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

/* ---------- 0.6 ---------- */

t("itemised bill: each item split by who had it, tax shared in proportion", () => {
  // Paneer 600 (a, b), beer 400 (b), naan 200 (a, b, c); bill 1380 with 15% extra.
  const e = {
    amountP: 138000,
    split: {
      mode: "items",
      participants: [{ memberId: "a" }, { memberId: "b" }, { memberId: "c" }],
      items: [
        { name: "Paneer", amountP: 60000, memberIds: ["a", "b"] },
        { name: "Beer", amountP: 40000, memberIds: ["b"] },
        { name: "Naan", amountP: 20000, memberIds: ["a", "b", "c"] },
      ],
    },
  };
  const s = computeShares(e);
  const total = [...s.values()].reduce((x, y) => x + y, 0);
  assert.equal(total, 138000);
  // Subtotals: a 36667, b 76667, c 6666 (paise, largest remainder), then x1.15.
  assert.ok(Math.abs(s.get("a") - 42167) <= 1);
  assert.ok(Math.abs(s.get("b") - 88167) <= 1);
  assert.ok(Math.abs(s.get("c") - 7667) <= 1);
});

t("itemised bill without extras keeps item shares exact", () => {
  const s = computeShares({
    amountP: 90000,
    split: {
      mode: "items",
      participants: [{ memberId: "a" }, { memberId: "b" }],
      items: [
        { name: "Pizza", amountP: 60000, memberIds: ["a", "b"] },
        { name: "Soda", amountP: 30000, memberIds: ["a"] },
      ],
    },
  });
  assert.equal(s.get("a"), 60000);
  assert.equal(s.get("b"), 30000);
});

t("itemised bill with a discount shares the saving in proportion", () => {
  const s = computeShares({
    amountP: 80000,
    split: {
      mode: "items",
      participants: [{ memberId: "a" }, { memberId: "b" }],
      items: [
        { name: "Shirt", amountP: 75000, memberIds: ["a"] },
        { name: "Socks", amountP: 25000, memberIds: ["b"] },
      ],
    },
  });
  assert.equal(s.get("a"), 60000);
  assert.equal(s.get("b"), 20000);
});

t("an item nobody had makes the expense invalid rather than lost", () => {
  const e = {
    amountP: 1000,
    payers: [{ memberId: "a", amountP: 1000 }],
    split: { mode: "items", participants: [{ memberId: "a" }], items: [{ name: "x", amountP: 1000, memberIds: [] }] },
  };
  assert.equal(computeShares(e).size, 0);
  const bal = computeBalances(["a"], [e], []);
  assert.equal(bal.get("a"), 0);
});

t("monthly repeats keep their day, clamped to short months", () => {
  const r = makeRepeat("monthly", new Date(2026, 0, 31, 12).getTime());
  assert.deepEqual(r, { freq: "monthly", day: 31 });
  const feb = nextDate(new Date(2026, 0, 31, 12).getTime(), r);
  assert.equal(new Date(feb).getDate(), 28);
  assert.equal(new Date(feb).getMonth(), 1);
  const mar = nextDate(feb, r);
  assert.equal(new Date(mar).getDate(), 31);
  const dec = nextDate(new Date(2026, 11, 15, 12).getTime(), { freq: "monthly", day: 15 });
  assert.equal(new Date(dec).getFullYear(), 2027);
  assert.equal(new Date(dec).getMonth(), 0);
});

t("weekly, fortnightly and yearly repeats", () => {
  const start = new Date(2026, 8, 28, 12).getTime();
  assert.equal(new Date(nextDate(start, { freq: "weekly" })).getDate(), 5);
  assert.equal(new Date(nextDate(start, { freq: "fortnightly" })).getDate(), 12);
  const leap = new Date(2028, 1, 29, 12).getTime();
  const r = makeRepeat("yearly", leap);
  const y1 = nextDate(leap, r);
  assert.equal(new Date(y1).getDate(), 28);
  const y4 = nextDate(nextDate(nextDate(y1, r), r), r);
  assert.equal(new Date(y4).getFullYear(), 2032);
  assert.equal(new Date(y4).getDate(), 29);
});

t("due dates catch up to today and never run away", () => {
  const head = { date: new Date(2026, 5, 1, 12).getTime(), repeat: { freq: "monthly", day: 1 } };
  const due = dueDates(head, new Date(2026, 8, 30, 9).getTime());
  assert.deepEqual(due.map((ts) => new Date(ts).getMonth()), [6, 7, 8]);
  assert.equal(dueDates({ ...head, repeat: { freq: "weekly" } }, new Date(2031, 0, 1).getTime()).length, 60);
  assert.equal(dueDates({ date: head.date, repeat: null }, Date.now()).length, 0);
  assert.equal(occurrenceId("abc", new Date(2026, 9, 1, 12).getTime()), "abc_20261001");
});

t("category is read from what people type", () => {
  assert.equal(guessCategory("Uber to airport"), "travel");
  assert.equal(guessCategory("Cab to the hotel"), "travel");
  assert.equal(guessCategory("Dinner at the hotel"), "food");
  assert.equal(guessCategory("Hotel, two nights"), "stay");
  assert.equal(guessCategory("Blinkit order"), "groceries");
  assert.equal(guessCategory("Movie tickets"), "fun");
  assert.equal(guessCategory("Fort Aguada tickets"), "tickets");
  assert.equal(guessCategory("Flat rent October"), "rent");
  assert.equal(guessCategory("Petrol"), "fuel");
  assert.equal(guessCategory("Jio recharge"), "bills");
  assert.equal(guessCategory("Daaru"), "drinks");
  assert.equal(guessCategory("Something"), null);
});

t("old emoji group icons map to line icons", () => {
  assert.equal(groupIconId("🏝️"), "trip");
  assert.equal(groupIconId("🏠"), "home");
  assert.equal(groupIconId("🧾"), "ledger");
  assert.equal(groupIconId("party"), "party");
  assert.equal(groupIconId(undefined), "ledger");
  assert.equal(groupIconId("🦄"), "ledger");
});

t("foreign parts spread to rupees that add up exactly", () => {
  const totalP = toInrPaise(4550, 83.4217); // $45.50
  assert.equal(totalP, 379569);
  const parts = spreadInr(totalP, [1517, 1517, 1516]);
  assert.equal(parts.reduce((a, b) => a + b, 0), totalP);
  assert.ok(Math.max(...parts) - Math.min(...parts) <= 84);
});

const SPLITWISE_CSV = [
  "Date,Description,Category,Cost,Currency,Aarav,Isha,Dev",
  "",
  "2026-03-01,Hotel,Hotel,4800.00,INR,3200.00,-1600.00,-1600.00",
  '2026-03-01,"Dinner, beach shack",Dining out,1500.00,INR,-500.00,1000.00,-500.00',
  "2026-03-02,Two payers,General,900.00,INR,300.00,300.00,-600.00",
  "2026-03-03,Isha paid Aarav,Payment,500.00,INR,-500.00,500.00,0.00",
  "2026-03-03,Cab,Taxi,30.00,USD,20.00,-10.00,-10.00",
  "",
  "2026-03-09,Total balance, , ,INR,2500.00,200.00,-2700.00",
].join("\r\n");

t("Splitwise export parses, with quoted descriptions and the total row", () => {
  const parsed = parseSplitwise(SPLITWISE_CSV);
  assert.deepEqual(parsed.members, ["Aarav", "Isha", "Dev"]);
  assert.equal(parsed.entries.length, 5);
  assert.equal(parsed.entries[1].desc, "Dinner, beach shack");
  assert.equal(parsed.entries[3].payment, true);
  assert.deepEqual(parsed.total, [250000, 20000, -270000]);
  assert.throws(() => parseSplitwise("a,b,c\n1,2,3"), /Splitwise/);
});

t("Splitwise rows rebuild into expenses with the same balances", () => {
  const parsed = parseSplitwise(SPLITWISE_CSV);
  const ids = ["m1", "m2", "m3"];
  const out = buildImport(parsed, ids, { USD: 83.5 });
  assert.equal(out.expenses.length, 4);
  assert.equal(out.settlements.length, 1);
  assert.equal(out.converted, 1);
  assert.equal(out.skipped, 0);
  assert.deepEqual(out.settlements[0], { fromId: "m2", toId: "m1", amountP: 50000, date: parsed.entries[3].date });
  const inr = out.expenses.filter((e) => !e.fx);
  const bal = computeBalances(ids, inr, out.settlements);
  // Rupee rows only: 3200-500+300-500 for Aarav, and so on.
  assert.equal(bal.get("m1"), 250000);
  assert.equal(bal.get("m2"), 20000);
  assert.equal(bal.get("m3"), -270000);
  const two = out.expenses[2];
  assert.equal(two.payers.reduce((a, p) => a + p.amountP, 0), 90000);
  assert.equal(two.category, "other");
  assert.equal(out.expenses[0].category, "stay");
  assert.equal(out.expenses[1].category, "food");
  const cab = out.expenses[3];
  assert.equal(cab.amountP, 250500);
  assert.deepEqual(cab.fx, { currency: "USD", amount: 30, rate: 83.5 });
  assert.equal(computeBalances(ids, [cab], []).get("m1"), 167000);
  for (const e of out.expenses) {
    assert.equal([...computeShares(e).values()].reduce((a, b) => a + b, 0), e.amountP);
  }
});

t("Splitwise rows in a currency with no rate are left out, not guessed", () => {
  const out = buildImport(parseSplitwise(SPLITWISE_CSV), ["m1", "m2", "m3"], {});
  assert.equal(out.expenses.length, 3);
  assert.equal(out.skipped, 1);
  assert.equal(nameFromFile("goa-trip_2026-03-09_export.csv"), "Goa trip");
});

console.log(`\n${passed} tests passed`);
