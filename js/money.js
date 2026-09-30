// Settld money core. Every amount is an integer number of paise.
// No floating-point value ever leaves this module as money.

const inrFull = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2,
});
const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0,
});

export function fmt(paise) {
  if (!Number.isFinite(paise)) return "";
  const v = paise / 100;
  return paise % 100 === 0 ? inrWhole.format(v) : inrFull.format(v);
}

export function fmtSigned(paise) {
  if (paise === 0) return fmt(0);
  return (paise > 0 ? "+" : "-") + fmt(Math.abs(paise));
}

// "1,234.56" / "₹1234" / 1234.5 -> paise. NaN when unparseable.
export function toPaise(input) {
  const raw = String(input ?? "").trim();
  if (raw.includes("-")) return NaN;
  const s = raw.replace(/[^\d.]/g, "");
  if (!s || s === ".") return NaN;
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

// Paise -> plain editable string ("342.5" stays "342.50", whole stays whole).
export function fromPaise(paise) {
  if (!Number.isFinite(paise)) return "";
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

// Deterministic largest-remainder distribution. totalP integer paise,
// weights [{ id, w }] with w >= 0 and sum > 0. Every device computes the
// same result: remainders tie-break on ascending id.
export function distribute(totalP, weights) {
  if (!Number.isInteger(totalP) || totalP < 0) return null;
  if (!Array.isArray(weights) || !weights.length) return null;
  if (weights.some((x) => !Number.isFinite(x?.w) || x.w < 0)) return null;
  const sum = weights.reduce((a, x) => a + x.w, 0);
  if (!Number.isFinite(sum) || !(sum > 0)) return null;
  const rows = weights.map((x) => {
    const exact = (totalP * x.w) / sum;
    const base = Math.floor(exact);
    return { id: x.id, base, frac: exact - base };
  });
  let left = totalP - rows.reduce((a, r) => a + r.base, 0);
  const order = [...rows].sort(
    (a, b) => b.frac - a.frac || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const out = new Map(rows.map((r) => [r.id, r.base]));
  for (let i = 0; left > 0; i = (i + 1) % order.length) {
    out.set(order[i].id, out.get(order[i].id) + 1);
    left -= 1;
  }
  return out;
}

// An itemised bill: each item is shared equally by the people who had it, and
// whatever the bill adds on top of the items (tax, service, tip) or takes off
// (a discount) is shared in proportion to what each person had.
// items = [{ name, amountP, memberIds }]
function itemShares(amountP, items) {
  if (!Array.isArray(items) || !items.length) return null;
  const subtotal = new Map();
  for (const item of items) {
    const ids = [...new Set(item?.memberIds ?? [])];
    if (!Number.isInteger(item?.amountP) || item.amountP < 0 || !ids.length) return null;
    const each = distribute(item.amountP, ids.map((id) => ({ id, w: 1 })));
    if (!each) return null;
    for (const [id, v] of each) subtotal.set(id, (subtotal.get(id) ?? 0) + v);
  }
  return distribute(amountP, [...subtotal].map(([id, w]) => ({ id, w })));
}

// expense.split = { mode: "equal"|"exact"|"percent"|"shares"|"items",
//   participants: [{ memberId, value?, valueP? }], items? }
// Returns Map memberId -> share in paise.
export function computeShares(expense) {
  const parts = expense?.split?.participants ?? [];
  if (!parts.length) return new Map();
  const mode = expense.split.mode;
  if (mode === "items") return itemShares(expense.amountP, expense.split.items) ?? new Map();
  if (mode === "exact") {
    const rows = parts.map((p) => [p.memberId, Number(p.valueP)]);
    if (rows.some(([, value]) => !Number.isInteger(value) || value < 0)) return new Map();
    if (rows.reduce((sum, [, value]) => sum + value, 0) !== expense.amountP) return new Map();
    return new Map(rows);
  }
  const weightOf = (p) => (mode === "equal" ? 1 : Number(p.value) || 0);
  return (
    distribute(expense.amountP, parts.map((p) => ({ id: p.memberId, w: weightOf(p) }))) ??
    new Map()
  );
}
