// Foreign currency. The ledger itself stays in rupees, because everyone
// settles in rupees over UPI; an expense paid abroad keeps what was typed in
// `fx` ({ currency, amount, rate }) and its rupee value in `amountP`.
// Rates come from open.er-api.com (free, no key, updated daily) and are cached
// on the device, so an expense added offline uses the last rate seen, or one
// the person types.

import { distribute } from "./money.js";

export const CURRENCIES = [
  ["INR", "Indian rupee"],
  ["USD", "US dollar"],
  ["EUR", "Euro"],
  ["GBP", "British pound"],
  ["AED", "UAE dirham"],
  ["THB", "Thai baht"],
  ["SGD", "Singapore dollar"],
  ["MYR", "Malaysian ringgit"],
  ["IDR", "Indonesian rupiah"],
  ["VND", "Vietnamese dong"],
  ["LKR", "Sri Lankan rupee"],
  ["NPR", "Nepalese rupee"],
  ["BDT", "Bangladeshi taka"],
  ["MVR", "Maldivian rufiyaa"],
  ["JPY", "Japanese yen"],
  ["KRW", "South Korean won"],
  ["CNY", "Chinese yuan"],
  ["HKD", "Hong Kong dollar"],
  ["AUD", "Australian dollar"],
  ["NZD", "New Zealand dollar"],
  ["CAD", "Canadian dollar"],
  ["CHF", "Swiss franc"],
  ["SAR", "Saudi riyal"],
  ["QAR", "Qatari riyal"],
  ["OMR", "Omani rial"],
  ["TRY", "Turkish lira"],
  ["EGP", "Egyptian pound"],
  ["ZAR", "South African rand"],
];
export const currencyName = (code) => CURRENCIES.find(([c]) => c === code)?.[1] ?? code;

export function currencySymbol(code) {
  if (code === "INR") return "₹";
  try {
    const part = new Intl.NumberFormat("en-IN", { style: "currency", currency: code, currencyDisplay: "symbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    return code;
  }
}

export function fmtForeign(amount, code) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

// Cents of the foreign currency times rupees per unit is paise.
export const toInrPaise = (cents, rate) => Math.round(cents * rate);

// Parts typed in the foreign currency (payers, exact shares, items) become
// rupee parts that add up to exactly `totalP`, in proportion to what was typed.
export function spreadInr(totalP, partsCents) {
  if (!partsCents.length) return [];
  const map = distribute(totalP, partsCents.map((w, i) => ({ id: String(i).padStart(4, "0"), w })));
  return map ? partsCents.map((_, i) => map.get(String(i).padStart(4, "0"))) : null;
}

export const roundRate = (rate) => Number(Number(rate).toPrecision(6));

const KEY = "settld.fx";
const FRESH = 12 * 3600 * 1000;

function cached() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

// Rupees per one unit of `code`, and where the number came from.
export async function rateFor(code) {
  if (code === "INR") return { rate: 1, source: "same" };
  const saved = cached();
  const fromSaved = saved?.rates?.[code] ? { rate: roundRate(1 / saved.rates[code]), source: "saved", at: saved.at } : null;
  if (fromSaved && Date.now() - saved.at < FRESH) return { ...fromSaved, source: "live" };
  if (typeof navigator !== "undefined" && navigator.onLine === false) return fromSaved;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/INR", { cache: "no-store" });
    const data = await res.json();
    if (data?.result !== "success" || !data.rates?.[code]) return fromSaved;
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), rates: data.rates }));
    } catch {
      /* private mode: still use the rate for this expense */
    }
    return { rate: roundRate(1 / data.rates[code]), source: "live", at: Date.now() };
  } catch {
    return fromSaved;
  }
}
