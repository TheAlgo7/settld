// Repeating expenses: rent, the maid, a shared subscription. The latest
// occurrence carries the schedule (`repeat`); when the next date arrives a copy
// is posted with an id derived from the series and the date, so two devices
// posting the same month write the same record instead of a duplicate.

export const FREQS = [
  { id: "weekly", label: "Weekly", every: "week" },
  { id: "fortnightly", label: "Fortnightly", every: "fortnight" },
  { id: "monthly", label: "Monthly", every: "month" },
  { id: "yearly", label: "Yearly", every: "year" },
];
export const freqOf = (id) => FREQS.find((f) => f.id === id) ?? null;

const pad = (n) => String(n).padStart(2, "0");
const noon = (y, m, d) => new Date(y, m, d, 12).getTime();

export function makeRepeat(freq, date) {
  if (!freqOf(freq)) return null;
  const repeat = { freq };
  if (freq === "monthly" || freq === "yearly") repeat.day = new Date(date).getDate();
  return repeat;
}

// Months keep the day they started on: a series from the 31st lands on the
// 30th in September and goes back to the 31st in October.
export function nextDate(ts, repeat) {
  const d = new Date(ts);
  if (repeat?.freq === "weekly") return noon(d.getFullYear(), d.getMonth(), d.getDate() + 7);
  if (repeat?.freq === "fortnightly") return noon(d.getFullYear(), d.getMonth(), d.getDate() + 14);
  if (repeat?.freq !== "monthly" && repeat?.freq !== "yearly") return null;
  const anchor = Number.isInteger(repeat.day) && repeat.day >= 1 && repeat.day <= 31 ? repeat.day : d.getDate();
  const month = d.getMonth() + (repeat.freq === "monthly" ? 1 : 12);
  const y = d.getFullYear() + Math.floor(month / 12);
  const m = month % 12;
  const last = new Date(y, m + 1, 0).getDate();
  return noon(y, m, Math.min(anchor, last));
}

export function occurrenceId(seriesId, ts) {
  const d = new Date(ts);
  return `${seriesId}_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

// Dates that are due by the end of `now`'s day, oldest first. The cap stops a
// weekly series left for years from flooding the ledger in one go.
export function dueDates(head, now = Date.now(), max = 60) {
  if (!head?.repeat || !Number.isFinite(head.date)) return [];
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const out = [];
  let ts = head.date;
  while (out.length < max) {
    ts = nextDate(ts, head.repeat);
    if (ts == null || ts > end.getTime()) break;
    out.push(ts);
  }
  return out;
}
