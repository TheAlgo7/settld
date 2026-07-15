// Ledger math tests. Run: npm test (or node tests/ledger.test.mjs)

import assert from "node:assert/strict";
import { distribute, computeShares, toPaise, fromPaise } from "../js/money.js";
import { computeBalances, simplify, upiLink } from "../js/settle.js";

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
});

t("fromPaise round-trips", () => {
  assert.equal(fromPaise(123456), "1234.56");
  assert.equal(fromPaise(50000), "500");
  assert.equal(toPaise(fromPaise(123456)), 123456);
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

t("exact split passes through", () => {
  const out = computeShares({
    amountP: 500,
    split: { mode: "exact", participants: [{ memberId: "a", valueP: 200 }, { memberId: "b", valueP: 300 }] },
  });
  assert.deepEqual([out.get("a"), out.get("b")], [200, 300]);
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
