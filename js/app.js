// Settld UI. One screen per group: your position, who owes whom, then the
// expenses. Everything secondary (summary, history, members, invites) hangs
// off the group menu instead of competing for a tab. Plain DOM only.

import * as store from "./store.js";
import * as cloud from "./cloud.js";
import { fmt, toPaise, fromPaise, computeShares } from "./money.js";
import { computeBalances, simplify, totalSpend, upiLink } from "./settle.js";
import { liquidGlass } from "./glass.js";
import { svg } from "./icons.js";
import { CATS, catOf, catIcon, GROUP_ICONS, groupIcon, groupIconId, guessCategory } from "./catalog.js";
import { FREQS, freqOf, makeRepeat, nextDate } from "./recurring.js";
import { CURRENCIES, currencyName, currencySymbol, fmtForeign, rateFor, roundRate, spreadInr, toInrPaise } from "./fx.js";
import { parseSplitwise, buildImport, nameFromFile } from "./splitwise.js";

// A hero amount, set like Dueline's: the rupee sign small and muted, the digits large.
const heroMoney = (paise) => `<span class="rupee">₹</span>${fmt(paise).replace(/^₹\s?/, "")}`;

/* ---------- constants ---------- */

// Swatch fills live in CSS so they track the theme; this list only names them.
const ACCENTS = [
  { id: "coral", label: "Coral" },
  { id: "amber", label: "Amber" },
  { id: "mint", label: "Mint" },
  { id: "azure", label: "Azure" },
  { id: "violet", label: "Violet" },
  { id: "rose", label: "Rose" },
];

const I = {
  groups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M7.5 9.5h9M7.5 13.5h6"/></svg>',
  friends: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.3"/><path d="M2.8 19.2c.45-3.5 2.6-5.2 6.2-5.2s5.75 1.7 6.2 5.2"/><path d="M16.2 5.1a3.1 3.1 0 0 1 0 5.8M18.4 19.2c-.2-2.1-.85-3.6-2.1-4.5"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12h4L10 5.5l4 13 2.5-6.5h4"/></svg>',
  settle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7.5h11.5M13.5 4.5l3 3-3 3M19 16.5H7.5M10.5 13.5l-3 3 3 3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.5-4 2.8-6 6.5-6s6 2 6.5 6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9Z"/><path d="M15 3.5A7.5 7.5 0 0 1 20.5 9H15Z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5.5 16 12l-6.5 6.5"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.4 13.3 7.2 4.2M15.6 6.5 8.4 10.7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5h11V20l-2.2-1.5-2.1 1.5-2.2-1.5-2.1 1.5-2.4-1.5z"/><path d="M9.5 8.5h5M9.5 12h5"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M13 6.5 19 12l-6 5.5"/></svg>',
  upi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8.5 7H17v8.5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3A5 5 0 0 0 13.5 3.5l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3A5 5 0 0 0 10.5 20.5l1.7-1.7"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.3"/><path d="M2.8 19.2c.45-3.5 2.6-5.2 6.2-5.2s5.75 1.7 6.2 5.2"/><path d="M16.2 5.1a3.1 3.1 0 0 1 0 5.8M18.4 19.2c-.2-2.1-.85-3.6-2.1-4.5"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="15" cy="7" r="2.4" fill="var(--bg)"/><circle cx="9" cy="12" r="2.4" fill="var(--bg)"/><circle cx="16" cy="17" r="2.4" fill="var(--bg)"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V10h5.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
  search: svg("search"),
  chat: svg("chat"),
  repeat: svg("repeat"),
  undo: svg("undo"),
  globe: svg("globe"),
  items: svg("items"),
  upload: svg("upload"),
  send: svg("send"),
  bars: svg("bars"),
  person: svg("person"),
};
const evIcon = { expense: "receipt", edit: "pen", delete: "trash", settle: "check", member: "plus", group: "plus", comment: "chat", restore: "undo" };

const MARK = `<svg class="brand-mark" viewBox="0 0 512 512" aria-hidden="true">
  <g class="brand-glyph">
    <path d="M230 98h108a34 34 0 0 1 0 68H217c-32 0-57 25-57 57v80c-27-14-43-45-43-80 0-70 51-125 113-125Z"/>
    <path d="M340 218v64c0 39-32 70-71 70H164a34 34 0 0 0 0 68h115c64 0 110-45 110-111 0-40-19-74-49-91Z"/>
    <path d="m189 273 29-29 21 21 50-53h34l-84 98-21-1-29-36Z"/>
  </g>
</svg>`;

/* ---------- tiny helpers ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const pad = (n) => String(n).padStart(2, "0");
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
function dayLabel(ts) {
  const now = new Date();
  if (dayKey(ts) === dayKey(now)) return "Today";
  if (dayKey(ts) === dayKey(now.getTime() - 86400000)) return "Yesterday";
  return new Date(ts).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
// For use inside a sentence: "today", "yesterday", "on Mon, 5 Oct".
function dayPhrase(ts) {
  const label = dayLabel(ts);
  return label === "Today" || label === "Yesterday" ? label.toLowerCase() : `on ${label}`;
}
const timeLabel = (ts) => new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const toDateInput = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fromDateInput = (v) => new Date(`${v}T12:00:00`).getTime();

const HUES = [214, 262, 330, 22, 165, 95];
function hueOf(name) {
  let h = 0;
  for (const ch of String(name)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return HUES[h % HUES.length];
}
function initials(name) {
  return String(name)
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
const avatarHtml = (m, cls = "") => {
  const name = m?.name ?? "?";
  return `<span class="avatar ${cls}" style="background:hsl(${hueOf(name)} 42% 30%)">${esc(initials(name))}</span>`;
};
const avatarStackHtml = (members) =>
  `<span class="avatar-stack">${members.slice(0, 4).map((m) => avatarHtml(m, "sm")).join("")}${members.length > 4 ? `<span class="avatar sm avatar-more">+${members.length - 4}</span>` : ""}</span>`;
const displayName = (m) => (m?.isYou ? "You" : (m?.name ?? "?"));
const nameList = (members) => members.map((m) => displayName(m)).join(", ");

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* attachment blob -> object URL cache */
const attUrls = new Map();
async function attUrl(id) {
  if (attUrls.has(id)) return attUrls.get(id);
  const rec = await store.getAttachment(id);
  if (!rec) return "";
  const url = URL.createObjectURL(rec.blob);
  attUrls.set(id, url);
  return url;
}
function hydrate(root) {
  root.querySelectorAll("img[data-att]").forEach(async (img) => {
    const url = await attUrl(img.dataset.att);
    if (url) img.src = url;
  });
}

function groupCalc(g) {
  const exps = store.expensesOf(g.id);
  const setts = store.settlementsOf(g.id);
  const bal = computeBalances(g.members.map((m) => m.id), exps, setts);
  return { exps, setts, bal, spend: totalSpend(exps) };
}

/* ---------- theme + accent ---------- */

function applyTheme(pref) {
  const resolved =
    pref === "system"
      ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : pref || "dark";
  document.documentElement.dataset.theme = resolved;
  $('meta[name="theme-color"]').setAttribute("content", resolved === "light" ? "#F5F2EC" : "#090807");
  localStorage.setItem("settld-theme", pref || "dark");
}

function applyAccent(id) {
  const accent = ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
  document.documentElement.dataset.accent = accent.id;
  localStorage.setItem("settld-accent", accent.id);
}

matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if ((store.state.profile?.theme ?? "dark") === "system") applyTheme("system");
});

/* ---------- sheets ---------- */

const sheetStack = [];
let suppressPop = false;
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function setShellInert(on) {
  for (const id of ["app", "dock", "appbar"]) {
    const node = document.getElementById(id);
    if (node) node.inert = on;
  }
  const skip = $(".skip-link");
  if (skip) skip.inert = on;
  const top = sheetStack[sheetStack.length - 1]?.wrap;
  for (const entry of sheetStack) {
    const obscured = Boolean(on && entry.wrap !== top);
    entry.wrap.inert = obscured;
    if (obscured) entry.wrap.setAttribute("aria-hidden", "true");
    else entry.wrap.removeAttribute("aria-hidden");
  }
}

function restoreSheetFocus(entry) {
  setShellInert(sheetStack.length > 0);
  const next = sheetStack[sheetStack.length - 1]?.wrap.querySelector(FOCUSABLE);
  const previous = entry?.previousFocus;
  const target = previous?.isConnected && previous !== document.body ? previous : next;
  if (target?.isConnected) requestAnimationFrame(() => target.focus());
}

function openSheet({ title, body, footer, locked = false, onClose }) {
  const previousFocus = document.activeElement;
  const wrap = el(`
    <div class="sheetwrap">
      <div class="scrim"></div>
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title ?? "Settld")}" tabindex="-1">
        <div class="grab"></div>
        ${title ? `<div class="shead"><h2>${esc(title)}</h2><button class="icon-btn s-close" aria-label="Close">${I.x}</button></div>` : ""}
        <div class="sbody"></div>
        <div class="sfoot"></div>
      </div>
    </div>`);
  const sbody = $(".sbody", wrap);
  const sfoot = $(".sfoot", wrap);
  if (body) sbody.append(body);
  if (footer) sfoot.append(footer);
  else sfoot.remove();
  if (!locked) {
    $(".scrim", wrap).addEventListener("click", () => closeSheet());
    $(".s-close", wrap)?.addEventListener("click", () => closeSheet());
    history.pushState({ sheet: sheetStack.length + 1 }, "");
  } else {
    $(".s-close", wrap)?.remove();
  }
  document.getElementById("sheets").append(wrap);
  const onKeydown = (e) => {
    if (e.key === "Escape" && !locked) {
      e.preventDefault();
      closeSheet();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = [...wrap.querySelectorAll(FOCUSABLE)].filter((node) => !node.hidden && node.getClientRects().length);
    if (!focusable.length) {
      e.preventDefault();
      $(".sheet", wrap).focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (active === $(".sheet", wrap) || !wrap.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  wrap.addEventListener("keydown", onKeydown);
  sheetStack.push({ wrap, locked, onClose, previousFocus, onKeydown });
  setShellInert(true);
  hydrate(wrap);
  // Focus the dialog itself, not its first control: auto-focusing a button
  // paints a focus ring on every open, which reads as a broken double border.
  requestAnimationFrame(() => $(".sheet", wrap).focus({ preventScroll: true }));
  return wrap;
}

function closeSheet(viaPop = false, then) {
  const top = sheetStack[sheetStack.length - 1];
  if (!top || top.locked) return;
  sheetStack.pop();
  top.wrap.inert = true;
  top.wrap.setAttribute("aria-hidden", "true");
  top.wrap.classList.add("out");
  setTimeout(() => top.wrap.remove(), 230);
  top.onClose?.();
  restoreSheetFocus(top);
  if (!viaPop) {
    suppressPop = true;
    history.back();
  }
  if (then) setTimeout(then, 60);
}

function closeLocked() {
  const top = sheetStack.pop();
  if (!top) return;
  top.wrap.inert = true;
  top.wrap.setAttribute("aria-hidden", "true");
  top.wrap.classList.add("out");
  setTimeout(() => top.wrap.remove(), 230);
  restoreSheetFocus(top);
}

window.addEventListener("popstate", () => {
  if (suppressPop) {
    suppressPop = false;
    return;
  }
  if (sheetStack.length && !sheetStack[sheetStack.length - 1].locked) closeSheet(true);
});

function armDanger(btn, fn) {
  const original = btn.innerHTML;
  btn.addEventListener("click", () => {
    if (btn.dataset.armed) {
      delete btn.dataset.armed;
      fn();
      return;
    }
    btn.dataset.armed = "1";
    btn.textContent = "Tap again to confirm";
    setTimeout(() => {
      if (btn.isConnected && btn.dataset.armed) {
        delete btn.dataset.armed;
        btn.innerHTML = original;
      }
    }, 2600);
  });
}

function openViewer(url, { onRemove } = {}) {
  const body = el(`<div class="proof-viewer"><img src="${url}" alt="Receipt or payment proof"></div>`);
  let footer;
  if (onRemove) {
    footer = el(`<button class="btn danger">Remove this proof</button>`);
    armDanger(footer, () => {
      onRemove();
      closeSheet();
    });
  }
  openSheet({ title: "Proof", body, footer });
}

// A plain action list used by the group menu and other pick-one sheets.
function menuSheet(title, items) {
  const body = el(`<div class="list"></div>`);
  for (const item of items) {
    if (!item) continue;
    const row = el(`<button class="row pressable">
      <span class="tile">${I[item.icon] ?? I.chevR}</span>
      <span class="grow"><span class="ttl${item.danger ? " danger-text" : ""}">${esc(item.label)}</span>
        ${item.cap ? `<span class="cap">${esc(item.cap)}</span>` : ""}</span>
      <span class="chev">${I.chevR}</span>
    </button>`);
    row.addEventListener("click", () => closeSheet(false, item.run));
    body.append(row);
  }
  openSheet({ title, body });
}

/* ---------- appbar + dock ---------- */

function setAppbar({ title, left, right }) {
  $("#bar-title").textContent = title ?? "";
  const l = $("#bar-left");
  const r = $("#bar-right");
  l.replaceChildren();
  r.replaceChildren();
  if (left) l.append(left);
  if (right) for (const b of [].concat(right)) r.append(b);
}

function iconBtn(icon, label, fn) {
  const b = el(`<button class="icon-btn" aria-label="${esc(label)}">${I[icon]}</button>`);
  b.addEventListener("click", fn);
  return b;
}

addEventListener("scroll", () => {
  $("#appbar").classList.toggle("on", scrollY > 44);
}, { passive: true });

function initDock() {
  const tabs = {
    home: ["Groups", I.groups],
    friends: ["Friends", I.friends],
    activity: ["Activity", I.pulse],
    settings: ["You", I.user],
  };
  for (const a of document.querySelectorAll("#dock a")) {
    const [label, icon] = tabs[a.dataset.tab];
    a.setAttribute("aria-label", label);
    a.innerHTML = `${icon}<span class="label">${label}</span>`;
  }
  const add = $("#dock .dock-add");
  add.innerHTML = I.plus;
  add.addEventListener("click", quickAdd);
  liquidGlass($("#dock .dock-glass"), "settld-dock-glass");
}

// The one global action, like Dueline's +: an expense, into the only group
// there is, or into the one you pick. With no group yet it starts one.
function quickAdd() {
  const groups = [...store.state.groups].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  if (!groups.length) return newGroupSheet();
  if (groups.length === 1) return expenseSheet(groups[0]);
  const body = el(`<div class="list"></div>`);
  for (const g of groups) {
    const row = el(`<button class="row group-row pressable">
      <span class="tile">${groupIcon(g)}</span>
      <span class="grow"><span class="ttl">${esc(g.name)}</span>
        <span class="cap">${g.members.length} people</span></span>
      <span class="chev">${I.chevR}</span>
    </button>`);
    row.addEventListener("click", () => closeSheet(false, () => expenseSheet(g)));
    body.append(row);
  }
  openSheet({ title: "Add to which group?", body });
}

/* ---------- router ---------- */

let lastRouteKey = "";

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("group/")) return { name: "group", id: h.slice(6) };
  if (h.startsWith("join/")) return { name: "join", code: h.slice(5) };
  if (h === "friends") return { name: "friends" };
  if (h === "activity") return { name: "activity" };
  if (h === "settings") return { name: "settings" };
  return { name: "home" };
}

function render() {
  if (!store.state.ready) return;
  const route = parseRoute();
  const key = route.name + (route.id ?? route.code ?? "");
  const keepScroll = key === lastRouteKey;
  const y = scrollY;
  lastRouteKey = key;

  const screen = document.getElementById("screen");
  let view;
  if (route.name === "group") view = GroupScreen(route.id);
  else if (route.name === "join") view = JoinScreen(route.code);
  else if (route.name === "friends") view = FriendsScreen();
  else if (route.name === "activity") view = ActivityScreen();
  else if (route.name === "settings") view = SettingsScreen();
  else view = HomeScreen();

  screen.replaceChildren(view);
  if (!keepScroll) view.classList.add("enter");
  hydrate(view);

  const dock = $("#dock");
  const dockOff = route.name === "group" || route.name === "join";
  dock.classList.toggle("off", dockOff);
  dock.inert = dockOff;
  if (dockOff) dock.setAttribute("aria-hidden", "true");
  else dock.removeAttribute("aria-hidden");
  for (const a of dock.querySelectorAll("a")) {
    const active = a.dataset.tab === (route.name === "home" ? "home" : route.name);
    a.classList.toggle("on", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  scrollTo(0, keepScroll ? y : 0);
  $("#appbar").classList.toggle("on", scrollY > 44);
}

addEventListener("hashchange", render);
addEventListener("online", render);
addEventListener("offline", render);

/* ---------- sync status ---------- */

function syncState() {
  const status = cloud.backupStatus();
  if (status === "offline") return { label: "Offline", cls: "offline", detail: "Changes stay here and will retry after reconnecting." };
  if (status === "pending") {
    const count = cloud.pendingWriteCount();
    return { label: `${count} waiting`, cls: "offline", detail: `${count} change${count === 1 ? " is" : "s are"} waiting to back up.` };
  }
  if (status === "syncing") return { label: "Checking backup", cls: "local", detail: "Checking this device against your private backup." };
  if (status === "synced") return { label: "Backed up", cls: "synced", detail: "Backed up. Groups, receipts and the trail are current." };
  if (status === "error") return { label: "Backup paused", cls: "offline", detail: "Backup could not connect. Your device copy is safe; use Sync now to retry." };
  if (status === "unconfirmed") return { label: "Backup not checked", cls: "local", detail: "Signed in, but this device has not completed a backup check yet." };
  return { label: "On this device", cls: "local", detail: "This ledger currently lives on this device." };
}

/* ---------- home ---------- */

function HomeScreen() {
  const name = store.state.profile?.name?.split(/\s+/)[0] ?? "there";
  const sync = syncState();
  let overall = 0;
  const rows = store.state.groups.map((g) => {
    const you = store.youOf(g);
    const { bal, exps } = groupCalc(g);
    const net = bal.get(you?.id) ?? 0;
    overall += net;
    return { g, net, count: exps.length };
  });

  const sub =
    rows.length === 0
      ? store.state.profile?.name
        ? `Ready when you are, ${esc(name)}.`
        : "Ready when you are."
      : overall === 0
        ? "Everything is clear. Hisab barabar."
        : overall > 0
          ? `Overall you get back <b class="pos money">${fmt(overall)}</b>`
          : `Overall you owe <b class="money">${fmt(-overall)}</b>`;

  const view = el(`<div>
    <div class="brand-line"><span class="brand-symbol">${MARK}</span><span class="brand-name">Settld</span>
      <span class="device-status ${sync.cls}"><i></i>${sync.label}</span></div>
    <div class="display"><h1>Groups</h1><div class="sub">${sub}</div></div>
    <div class="home-body"></div>
  </div>`);
  const body = $(".home-body", view);

  if (!rows.length) {
    const empty = el(`<div class="empty">
      <div class="mark">${MARK}</div>
      <h3>Your first shared ledger</h3>
      <p>Create one for a trip, a flat, or tonight's dinner. Every receipt and edit stays with the expense.</p>
      <button class="btn primary" id="e-new">${I.plus} Create a group</button>
      <button class="btn quiet" id="e-demo">Explore a sample trip</button>
      <button class="btn quiet" id="e-import">${I.upload} Bring a group from Splitwise</button>
    </div>`);
    $("#e-new", empty).addEventListener("click", () => newGroupSheet());
    $("#e-import", empty).addEventListener("click", () => importSheet());
    $("#e-demo", empty).addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      const g = await store.seedDemo();
      toast("Sample trip added");
      location.hash = `#/group/${g.id}`;
    });
    body.append(empty);
  } else {
    const list = el(`<div class="list ruled" style="margin-top:22px"></div>`);
    for (const { g, net, count } of rows) {
      const endHtml =
        net === 0
          ? `<span class="balance-label">All settled</span>`
          : net > 0
            ? `<span class="balance-label">You get</span><span class="amt money pos">${fmt(net)}</span>`
            : `<span class="balance-label">You owe</span><span class="amt money debt">${fmt(-net)}</span>`;
      const row = el(`<button class="row group-row pressable">
        <span class="tile">${groupIcon(g)}</span>
        <span class="grow"><span class="ttl">${esc(g.name)}</span>
          <span class="cap">${g.members.length} people · ${count} expense${count === 1 ? "" : "s"}</span></span>
        <span class="end">${endHtml}</span>
      </button>`);
      row.addEventListener("click", () => (location.hash = `#/group/${g.id}`));
      list.append(row);
    }
    body.append(list);
    const actions = el(`<div class="home-actions">
      <button class="btn ghost h-new">${I.plus} New group</button>
      <button class="btn quiet h-import">${I.upload} Bring a group from Splitwise</button>
    </div>`);
    $(".h-new", actions).addEventListener("click", () => newGroupSheet());
    $(".h-import", actions).addEventListener("click", () => importSheet());
    body.append(actions);
  }

  setAppbar({
    title: "Groups",
    right: rows.length ? iconBtn("search", "Search expenses", () => searchSheet()) : null,
  });
  return view;
}

/* ---------- friends ---------- */

// People are still per-group records, so friends are matched on normalised
// name. Once members carry an account id this keys on that instead.
function friendIndex() {
  const map = new Map();
  for (const g of store.state.groups) {
    const you = store.youOf(g);
    const { bal } = groupCalc(g);
    for (const m of g.members) {
      if (m.id === you?.id) continue;
      const key = m.name.trim().toLowerCase();
      if (!key) continue;
      const entry = map.get(key) ?? { name: m.name, net: 0, groups: [] };
      // Their balance is the mirror of what they owe you inside this group.
      const theirs = bal.get(m.id) ?? 0;
      entry.net -= theirs;
      entry.groups.push({ g, amount: -theirs, memberId: m.id });
      map.set(key, entry);
    }
  }
  return [...map.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

function FriendsScreen() {
  const friends = friendIndex();
  const owed = friends.reduce((n, f) => n + Math.max(0, f.net), 0);
  const owing = friends.reduce((n, f) => n + Math.max(0, -f.net), 0);

  const view = el(`<div>
    <div class="display"><h1>Friends</h1>
      <div class="sub">${friends.length ? "Everyone you share a group with, netted across all of them." : "People you share groups with show up here."}</div></div>
    <div class="friends-body"></div>
  </div>`);
  const body = $(".friends-body", view);

  const addOne = el(`<button class="btn ghost" style="margin-top:22px">${I.plus} Expense with one person</button>`);
  addOne.addEventListener("click", () => oneToOneSheet());
  if (!friends.length) {
    body.append(el(`<div class="empty"><h3>No one yet</h3><p>Add people to a group, or split something with one person, and your running balance with them appears here.</p></div>`));
    body.append(addOne);
  } else {
    if (owed || owing) {
      body.append(el(`<div class="summary-metrics" style="margin-top:20px">
        <div><span>You get back</span><strong class="money pos">${fmt(owed)}</strong></div>
        <div><span>You owe</span><strong class="money debt">${fmt(owing)}</strong></div>
      </div>`));
    }
    const list = el(`<div class="list" style="margin-top:8px"></div>`);
    for (const f of friends) {
      const endHtml =
        f.net === 0
          ? `<span class="balance-label">Settled</span>`
          : f.net > 0
            ? `<span class="balance-label">Owes you</span><span class="amt money pos">${fmt(f.net)}</span>`
            : `<span class="balance-label">You owe</span><span class="amt money debt">${fmt(-f.net)}</span>`;
      const row = el(`<button class="row pressable">
        ${avatarHtml(f)}
        <span class="grow"><span class="ttl">${esc(f.name)}</span>
          <span class="cap">${f.groups.length} group${f.groups.length === 1 ? "" : "s"}</span></span>
        <span class="end">${endHtml}</span>
      </button>`);
      row.addEventListener("click", () => friendSheet(f));
      list.append(row);
    }
    body.append(list);
    body.append(addOne);
  }

  setAppbar({ title: "Friends" });
  return view;
}

// Splitting with one person, outside any group: pick or type their name and
// the expense goes into your one-to-one ledger with them.
function oneToOneSheet(prefill = "") {
  const known = friendIndex().map((f) => f.name);
  const body = el(`<div>
    <label class="cap-label" for="oo-name" style="margin-top:4px">With whom?</label>
    <input class="in" id="oo-name" placeholder="Their name" value="${esc(prefill)}" maxlength="${store.LIMITS.memberName}" autocomplete="off">
    ${known.length ? `<div class="chips oo-known" style="margin-top:12px"></div>` : ""}
    <div class="hint">Kept in its own ledger with them, apart from your groups, and counted in their balance here.</div>
  </div>`);
  const input = $("#oo-name", body);
  const knownBox = $(".oo-known", body);
  for (const name of known.slice(0, 12)) {
    const chip = el(`<button class="chip">${avatarHtml({ name }, "sm")} ${esc(name)}</button>`);
    chip.addEventListener("click", () => {
      input.value = name;
      go();
    });
    knownBox.append(chip);
  }
  const foot = el(`<button class="btn primary">Continue</button>`);
  const go = async () => {
    const name = input.value.trim();
    if (!name) return toast("Whose expense is it?");
    foot.disabled = true;
    const g = await store.friendGroup(name);
    closeSheet(false, () => expenseSheet(g));
  };
  foot.addEventListener("click", go);
  input.addEventListener("keydown", (e) => e.key === "Enter" && go());
  openSheet({ title: "Expense with one person", body, footer: foot });
}

// A WhatsApp message asking for what someone owes you, with your UPI ID so
// they can pay without asking for it.
function remindLink(name, amountP, where) {
  const upi = store.state.profile?.upi;
  const lines = [
    `Hi ${name}, a quick reminder from Settld: you owe me ${fmt(amountP)}${where ? ` for ${where}` : ""}.`,
    upi ? `My UPI ID is ${upi}.` : "",
  ].filter(Boolean);
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}

function friendSheet(friend) {
  const body = el(`<div>
    <div class="money-block" style="margin-top:4px">
      <div class="lbl ${friend.net > 0 ? "pos" : ""}">${friend.net === 0 ? "Between you" : friend.net > 0 ? `${esc(friend.name)} owes you` : `You owe ${esc(friend.name)}`}</div>
      <div class="val money ${friend.net === 0 ? "clear" : ""}">${friend.net === 0 ? "All clear" : heroMoney(Math.abs(friend.net))}</div>
    </div>
    <div class="section-cap">Group by group</div>
    <div class="list ruled friend-groups"></div>
  </div>`);
  const list = $(".friend-groups", body);
  for (const { g, amount } of friend.groups) {
    const endHtml =
      amount === 0
        ? `<span class="balance-label">Settled</span>`
        : amount > 0
          ? `<span class="balance-label">Owes you</span><span class="amt money pos">${fmt(amount)}</span>`
          : `<span class="balance-label">You owe</span><span class="amt money debt">${fmt(-amount)}</span>`;
    const row = el(`<button class="row pressable">
      <span class="tile">${groupIcon(g)}</span>
      <span class="grow"><span class="ttl">${esc(g.name)}</span></span>
      <span class="end">${endHtml}</span>
    </button>`);
    row.addEventListener("click", () => closeSheet(false, () => (location.hash = `#/group/${g.id}`)));
    list.append(row);
  }
  const open = friend.groups.filter((x) => x.amount !== 0);
  const where = open.length === 1 && open[0].g.emoji !== "person" ? open[0].g.name : "";
  const foot = el(`<div class="btn-row">
    ${friend.net > 0
      ? `<a class="btn ghost" href="${remindLink(friend.name, friend.net, where)}" target="_blank" rel="noopener">${I.send} Remind</a>`
      : friend.net < 0
        ? `<button class="btn ghost f-settle">${I.settle} Settle up</button>`
        : ""}
    <button class="btn primary f-add">${I.plus} Add expense</button>
  </div>`);
  $(".f-add", foot).addEventListener("click", () => closeSheet(false, () => oneToOneSheet(friend.name)));
  $(".f-settle", foot)?.addEventListener("click", () => {
    // You owe them: settle group by group, starting with the largest.
    const target = [...open].sort((a, b) => a.amount - b.amount)[0];
    const you = store.youOf(target.g);
    closeSheet(false, () => settleSheet(target.g, you.id, target.memberId, -target.amount));
  });
  openSheet({ title: friend.name, body, footer: foot });
}

/* ---------- activity ---------- */

function ActivityScreen() {
  const events = store.allEvents();
  const view = el(`<div>
    <div class="display"><h1>Activity</h1><div class="sub">Every add, edit and payment, newest first.</div></div>
    <div class="act-body"></div>
  </div>`);
  const body = $(".act-body", view);
  if (!events.length) {
    body.append(el(`<div class="empty"><h3>Nothing yet</h3><p>Group activity shows up here the moment it happens.</p></div>`));
  } else {
    body.append(trailList(events, true));
  }
  setAppbar({ title: "Activity" });
  return view;
}

function trailList(events, showGroup = false, openable = true) {
  const box = el(`<div></div>`);
  let lastDay = "";
  let list = null;
  for (const ev of events) {
    const k = dayKey(ev.ts);
    if (k !== lastDay) {
      lastDay = k;
      box.append(el(`<div class="day">${dayLabel(ev.ts)}</div>`));
      list = el(`<div class="list"></div>`);
      box.append(list);
    }
    const group = store.groupById(ev.groupId);
    const gname = showGroup ? group?.name : null;
    const expense = ev.data?.expenseId ? store.state.expenses.find((x) => x.id === ev.data.expenseId) : null;
    const text =
      ev.type === "comment"
        ? `<b>${esc(ev.actor)}</b> on ${esc(expense?.desc ?? "an expense")}: “${esc(ev.summary)}”`
        : esc(ev.summary);
    const tag = expense && group && openable ? "button" : "div";
    const row = el(`<${tag} class="trail-row${tag === "button" ? " pressable" : ""}">
      <span class="trail-dot ${ev.type}">${I[evIcon[ev.type] ?? "receipt"]}</span>
      <span class="trail-txt">${text}
        <span class="cap">${gname ? esc(gname) + " · " : ""}${timeLabel(ev.ts)}</span></span>
    </${tag}>`);
    if (tag === "button") row.addEventListener("click", () => expenseDetailSheet(group, expense));
    list.append(row);
  }
  return box;
}

/* ---------- group screen ---------- */

function GroupScreen(id) {
  const g = store.groupById(id);
  if (!g) {
    location.hash = "#/";
    return el("<div></div>");
  }
  const you = store.youOf(g);
  const { exps, bal } = groupCalc(g);
  const net = bal.get(you?.id) ?? 0;
  const plan = simplify(bal);

  const view = el(`<div>
    <div class="group-title-line">
      <span class="group-emoji">${groupIcon(g)}</span>
      <h1>${esc(g.name)}</h1>
    </div>
    <div class="group-people">${avatarStackHtml(g.members)}<span>${esc(nameList(g.members))}</span></div>

    <div class="money-block">
      <div class="lbl ${net > 0 ? "pos" : ""}">${net > 0 ? "You get back" : net < 0 ? "You owe" : "Your balance"}</div>
      <div class="val money ${net === 0 ? "clear" : ""}">${net === 0 ? "All clear" : heroMoney(Math.abs(net))}</div>
      <div class="note">${net === 0 ? "Hisab barabar. Nothing is pending in this group." : `${fmt(totalSpend(exps))} spent across ${exps.length} expense${exps.length === 1 ? "" : "s"}`}</div>
    </div>

    <div class="act-row">
      <button class="btn primary g-settle">${I.settle} Settle up</button>
      <button class="btn secondary g-add">${I.plus} Add expense</button>
    </div>

    <div class="g-owe"></div>
    <div class="g-list"></div>
  </div>`);

  $(".g-add", view).addEventListener("click", () => expenseSheet(g));
  const settleBtn = $(".g-settle", view);
  if (!plan.length) settleBtn.disabled = true;
  settleBtn.addEventListener("click", () => settleUpSheet(g));

  // Who owes whom, straight from the settle plan so every line is actionable.
  const oweBox = $(".g-owe", view);
  if (plan.length) {
    const list = el(`<div class="owe-list"></div>`);
    const ordered = [...plan].sort((a, b) => {
      const aYou = a.fromId === you?.id || a.toId === you?.id ? 0 : 1;
      const bYou = b.fromId === you?.id || b.toId === you?.id ? 0 : 1;
      return aYou - bYou || b.amountP - a.amountP;
    });
    for (const t of ordered) {
      const from = store.memberOf(g, t.fromId);
      const to = store.memberOf(g, t.toId);
      const youGet = to?.id === you?.id;
      const label = youGet
        ? `${esc(displayName(from))} owes you`
        : from?.id === you?.id
          ? `You owe ${esc(displayName(to))}`
          : `${esc(displayName(from))} owes ${esc(displayName(to))}`;
      const row = el(`<button class="owe-row pressable">
        ${avatarHtml(youGet ? from : to, "sm")}
        <span class="who">${label}</span>
        <span class="amt money ${youGet ? "pos" : ""}">${fmt(t.amountP)}</span>
      </button>`);
      row.addEventListener("click", () => settleSheet(g, t.fromId, t.toId, t.amountP));
      list.append(row);
    }
    oweBox.append(list);
  }

  const listBox = $(".g-list", view);
  if (exps.length) {
    listBox.append(expenseRows(g, exps, you));
  } else {
    listBox.append(el(`<div class="empty">
      <div class="mark">${MARK}</div>
      <h3>No expenses yet</h3>
      <p>Add the first one in a few taps. The receipt can come now or whenever you find it.</p>
    </div>`));
  }

  setAppbar({
    title: g.name,
    left: iconBtn("chevL", "Back to groups", () => (location.hash = "#/")),
    right: [
      iconBtn("search", `Search ${g.name}`, () => searchSheet(g)),
      iconBtn("more", "Group menu", () => groupMenuSheet(g)),
    ],
  });
  return view;
}

function groupMenuSheet(g) {
  const deleted = store.deletedOf(g.id);
  menuSheet(g.name, [
    { icon: "people", label: "People", cap: `${g.members.length} in this group`, run: () => membersSheet(g) },
    {
      icon: "link",
      label: g.shared ? "Invite someone" : "Share this group",
      cap: g.shared
        ? `${g.members.filter((m) => m.uid).length} of ${g.members.length} have joined`
        : "Let others add expenses too",
      run: () => inviteSheet(g),
    },
    { icon: "chart", label: "Summary", cap: "Spend by category, over time and by person", run: () => summarySheet(g) },
    { icon: "history", label: "History", cap: "Every add, edit, comment and payment", run: () => historySheet(g) },
    deleted.length
      ? { icon: "undo", label: "Deleted expenses", cap: `${deleted.length} you can bring back`, run: () => deletedSheet(g) }
      : null,
    { icon: "sliders", label: "Group settings", cap: "Name, icon, default split, delete", run: () => groupSettingsSheet(g) },
  ]);
}

function deletedSheet(g) {
  const body = el(`<div>
    <p class="hint" style="margin-top:4px">Deleting only hides an expense. Open one to bring it back; the history keeps both steps.</p>
  </div>`);
  const list = el(`<div class="list ex-list"></div>`);
  // After a restore the list redraws, and closes once nothing is left in it.
  const draw = () => {
    const gone = store.deletedOf(g.id);
    if (!gone.length) return closeSheet();
    list.replaceChildren();
    for (const e of gone) {
      const row = el(`<button class="ex-row pressable">
        <span class="ico">${catIcon(e.category)}</span>
        <span class="m"><b>${esc(e.desc)}</b><span>Deleted ${dayPhrase(e.updatedAt ?? e.date)}</span></span>
        <span class="e"><b class="money">${fmt(e.amountP)}</b></span>
      </button>`);
      row.addEventListener("click", () => expenseDetailSheet(g, e, { onRestore: draw }));
      list.append(row);
    }
  };
  body.append(list);
  openSheet({ title: "Deleted expenses", body });
  draw();
}

function expenseRows(g, exps, you) {
  const box = el(`<div></div>`);
  const comments = new Map();
  const editedIds = new Set();
  for (const ev of store.eventsOf(g.id)) {
    const id = ev.data?.expenseId;
    if (!id) continue;
    if (ev.type === "comment") comments.set(id, (comments.get(id) ?? 0) + 1);
    else if (ev.type === "edit") editedIds.add(id);
  }
  let lastDay = "";
  let list = null;
  for (const e of exps) {
    const k = dayKey(e.date);
    if (k !== lastDay) {
      lastDay = k;
      box.append(el(`<div class="day">${dayLabel(e.date)}</div>`));
      list = el(`<div class="list ex-list"></div>`);
      box.append(list);
    }
    const payers = e.payers.map((p) => displayName(store.memberOf(g, p.memberId))).join(", ");
    const shares = computeShares(e);
    const paid = e.payers.filter((p) => p.memberId === you?.id).reduce((a, p) => a + p.amountP, 0);
    const mine = paid - (shares.get(you?.id) ?? 0);
    const mineHtml =
      mine === 0
        ? shares.has(you?.id)
          ? `<span>your share is even</span>`
          : `<span>not your split</span>`
        : mine > 0
          ? `<span class="pos money">you lent ${fmt(mine)}</span>`
          : `<span class="money">you owe ${fmt(-mine)}</span>`;
    // Posting a repeat moves the schedule and touches updatedAt, so only an
    // edit that made it into the history counts as "edited".
    const edited = editedIds.has(e.id);
    const said = comments.get(e.id) ?? 0;
    const marks = [
      e.fx ? `<span class="fx-note">${esc(fmtForeign(e.fx.amount, e.fx.currency))}</span>` : "",
      e.repeat ? `<span class="proof-dot" title="Repeats ${freqOf(e.repeat.freq)?.label.toLowerCase() ?? ""}">${I.repeat}</span>` : "",
      e.attachments?.length ? `<span class="proof-dot">${I.clip}${e.attachments.length}</span>` : "",
      said ? `<span class="proof-dot">${I.chat}${said}</span>` : "",
      edited ? `<span class="proof-dot">${I.pen}</span>` : "",
    ].join("");
    const row = el(`<button class="ex-row pressable">
      <span class="ico">${catIcon(e.category)}</span>
      <span class="m"><b>${esc(e.desc)}</b>
        <span>${esc(payers)} paid${marks}</span></span>
      <span class="e"><b class="money">${fmt(e.amountP)}</b>${mineHtml}</span>
    </button>`);
    row.addEventListener("click", () => expenseDetailSheet(g, e));
    list.append(row);
  }
  return box;
}

/* ---------- settle up ---------- */

function settleUpSheet(g) {
  const { bal } = groupCalc(g);
  const plan = simplify(bal);
  const you = store.youOf(g);
  const body = el(`<div>
    <p class="hint" style="margin-bottom:6px">${plan.length} transfer${plan.length === 1 ? "" : "s"} clear every current balance. Settld suggests the plan and records it; it never moves money.</p>
    <div class="list settle-list"></div>
  </div>`);
  const list = $(".settle-list", body);
  for (const t of plan) {
    const from = store.memberOf(g, t.fromId);
    const to = store.memberOf(g, t.toId);
    const relation =
      from?.id === you?.id
        ? `You pay ${displayName(to)}`
        : to?.id === you?.id
          ? `${displayName(from)} pays you`
          : `${displayName(from)} pays ${displayName(to)}`;
    const row = el(`<div class="settle-row">
      <span class="avatar-pair">${avatarHtml(from, "sm")}${avatarHtml(to, "sm")}</span>
      <span class="grow"><span class="ttl">${esc(relation)}</span><span class="cap">Suggested transfer</span></span>
      <span class="amt money">${fmt(t.amountP)}</span>
      <button class="btn ghost small">Record</button>
    </div>`);
    row.querySelector("button").addEventListener("click", () => closeSheet(false, () => settleSheet(g, t.fromId, t.toId, t.amountP)));
    list.append(row);
  }
  if (!plan.length) {
    list.append(el(`<div class="empty compact"><h3>All clear</h3><p>Nothing is pending in this group.</p></div>`));
  }

  const history = store.state.settlements
    .filter((s) => s.groupId === g.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (history.length) {
    body.append(el(`<div class="section-cap">Payments recorded</div>`));
    const hl = el(`<div class="list"></div>`);
    for (const s of history) {
      const from = store.memberOf(g, s.fromId);
      const to = store.memberOf(g, s.toId);
      const badge = s.deleted
        ? `<span class="badge edited">Reversed</span>`
        : s.attachments?.length
          ? `<span class="badge ok">${I.clip}Proof</span>`
          : "";
      const row = el(`<button class="row pressable">
        <span class="tile">${I.check}</span>
        <span class="grow"><span class="ttl">${esc(displayName(from))} paid ${esc(displayName(to))}</span>
          <span class="cap">${dayLabel(s.createdAt)}${s.note ? " · " + esc(s.note) : ""} ${badge}</span></span>
        <span class="end"><span class="amt money">${fmt(s.amountP)}</span></span>
      </button>`);
      row.addEventListener("click", () => closeSheet(false, () => settlementDetailSheet(g, s)));
      hl.append(row);
    }
    body.append(hl);
  }

  openSheet({ title: "Settle up", body });
}

function settlementDetailSheet(g, settlement) {
  const from = store.memberOf(g, settlement.fromId);
  const to = store.memberOf(g, settlement.toId);
  const body = el(`<div>
    <div class="expense-hero">
      <div class="expense-hero-top"><span>${settlement.deleted ? "Reversed payment" : "Recorded payment"}</span><span>${dayLabel(settlement.createdAt)}</span></div>
      <div class="val money">${heroMoney(settlement.amountP)}</div>
      <div class="note">${esc(displayName(from))} paid ${esc(displayName(to))}.</div>
      ${settlement.note ? `<blockquote>${esc(settlement.note)}</blockquote>` : ""}
    </div>
    <div class="settlement-proofs"></div>
  </div>`);
  const proofs = $(".settlement-proofs", body);
  if (settlement.attachments?.length) {
    proofs.append(el(`<div class="section-cap">Payment proof</div>`));
    const thumbs = el(`<div class="thumbs proof-gallery"></div>`);
    for (const [index, id] of settlement.attachments.entries()) {
      const button = el(`<button class="thumb-button pressable" aria-label="View payment proof ${index + 1}"><img class="thumb" data-att="${id}" alt=""></button>`);
      button.addEventListener("click", async () => openViewer(await attUrl(id)));
      thumbs.append(button);
    }
    proofs.append(thumbs);
  } else {
    proofs.append(el(`<div class="empty compact"><h3>No proof attached</h3><p>The payment was recorded without an image.</p></div>`));
  }
  const foot = settlement.deleted ? null : el(`<button class="btn danger">Reverse this payment</button>`);
  if (foot) {
    armDanger(foot, async () => {
      await store.voidSettlement(g, settlement);
      closeSheet();
      toast("Payment reversed. The history keeps both records.");
    });
  }
  const wrap = openSheet({ title: "Payment record", body, footer: foot });
  hydrate(wrap);
}

function historySheet(g) {
  const events = store.eventsOf(g.id);
  const body = el(`<div>
    <div class="trail-note"><span>${I.check}</span><div><strong>Nothing is silently overwritten</strong><p>Corrections create a new entry so the group can always see what changed.</p></div></div>
  </div>`);
  if (events.length) body.append(trailList(events));
  else body.append(el(`<div class="empty compact"><h3>No activity yet</h3><p>Add an expense and its record begins here.</p></div>`));
  openSheet({ title: "History", body });
}

/* ---------- settings ---------- */

function SettingsScreen() {
  const p = store.state.profile ?? { name: "", upi: "", phone: "", theme: "dark", accent: "coral" };
  const view = el(`<div>
    <div class="display"><h1>You</h1><div class="sub">Profile, backup and how Settld looks.</div></div>

    <div class="section-cap">Profile</div>
    <label class="cap-label" for="st-name" style="margin-top:0">Your name</label>
    <input class="in" id="st-name" value="${esc(p.name)}" autocomplete="name" maxlength="${store.LIMITS.profileName}">
    <label class="cap-label" for="st-upi">Your UPI ID</label>
    <input class="in" id="st-upi" value="${esc(p.upi ?? "")}" placeholder="name@bank" autocapitalize="none" maxlength="${store.LIMITS.upi}">
    <div class="hint">Used only to build payment links. Settld never moves money.</div>
    <label class="cap-label" for="st-phone">Your phone number <span class="dim">(optional)</span></label>
    <input class="in" id="st-phone" type="tel" value="${esc(p.phone ?? "")}" placeholder="+91 98765 43210" autocomplete="tel" maxlength="${store.LIMITS.phone}">
    <div class="hint">Lets people you already share a group with find you. Never shown publicly.</div>
    <button class="btn ghost" id="st-save" style="margin-top:14px">Save profile</button>

    <div class="section-cap">Account</div>
    <div class="st-account"></div>

    <div class="section-cap">Theme</div>
    <div class="seg" id="st-theme">
      <button data-t="dark">Dark</button>
      <button data-t="light">Light</button>
      <button data-t="system">System</button>
    </div>

    <div class="section-cap">Accent</div>
    <div class="swatches" id="st-accent" role="group" aria-label="Accent colour"></div>

    <div class="section-cap">Data</div>
    <div class="list ruled">
      <button class="row pressable" id="st-import">
        <span class="grow"><span class="ttl">Bring a group from Splitwise</span>
        <span class="cap">From the spreadsheet Splitwise exports, balances intact</span></span>
        <span class="chev">${I.chevR}</span>
      </button>
      <button class="row pressable" id="st-export">
        <span class="grow"><span class="ttl">Export ledger</span>
        <span class="cap">Groups, expenses, settlements and history as JSON</span></span>
        <span class="chev">${I.chevR}</span>
      </button>
      <button class="row pressable" id="st-erase">
        <span class="grow"><span class="ttl danger-text">Erase all data</span>
        <span class="cap">${cloud.currentUser() ? "Deletes this device copy and your Firebase backup" : "Removes every group and receipt from this device"}</span></span>
      </button>
      ${cloud.currentUser() ? `<button class="row pressable" id="st-delete">
        <span class="grow"><span class="ttl danger-text">Delete account</span>
        <span class="cap">Erases your data, leaves shared groups and deletes your Google sign-in</span></span>
      </button>` : ""}
    </div>

    <div class="empty" style="padding-top:40px">
      <div class="mark">${MARK}</div>
      <h3>Settld 0.6</h3>
      <p>Split. Prove. Settle.<br>Core splitting stays free. Your device remains the source of truth.</p>
      <a class="made-by" href="https://thealgothrim.com" target="_blank" rel="noopener">Designed and built by Gaurav Kumar · The Algothrim</a>
      <div><a class="made-by" href="privacy.html">Privacy</a></div>
    </div>
  </div>`);

  $("#st-save", view).addEventListener("click", async () => {
    const name = $("#st-name", view).value.trim();
    const upi = $("#st-upi", view).value.trim();
    const phone = $("#st-phone", view).value.trim();
    if (!name) return toast("Your name can't be empty");
    await store.saveProfile({ name, upi, phone });
    for (const g of store.state.groups) {
      const you = store.youOf(g);
      if (you && (you.name !== name || you.upi !== upi)) await store.updateMember(g, you.id, { name, upi });
    }
    toast("Saved");
  });

  const acc = $(".st-account", view);
  if (!cloud.cloudAvailable()) {
    acc.append(el(`<div class="list ruled"><div class="row">
      <span class="grow"><span class="ttl">Cloud backup</span>
      <span class="cap">Unavailable right now. Everything stays on this device meanwhile.</span></span>
    </div></div>`));
  } else if (cloud.currentUser()) {
    const backup = syncState();
    const list = el(`<div class="list ruled">
      <div class="row"><span class="grow"><span class="ttl">${esc(cloud.accountLabel())}</span>
        <span class="cap">${esc(backup.detail)}</span></span></div>
      <button class="row pressable" id="st-sync"><span class="grow"><span class="ttl">Sync now</span></span><span class="chev">${I.chevR}</span></button>
      <button class="row pressable" id="st-signout"><span class="grow"><span class="ttl">Sign out</span>
        <span class="cap">Data stays here and remains linked to this Google account</span></span></button>
    </div>`);
    $("#st-sync", list).addEventListener("click", async (e) => {
      e.target.closest(".row").style.opacity = ".6";
      try {
        await cloud.syncNow();
        if (cloud.backupStatus() === "synced") toast("Backup is current");
        else if (cloud.pendingWriteCount()) toast(`${cloud.pendingWriteCount()} change${cloud.pendingWriteCount() === 1 ? " is" : "s are"} still waiting to back up`);
        else toast("Backup check finished, but it is not current yet");
      } catch {
        toast("Sync failed, will retry when online");
      }
      render();
    });
    $("#st-signout", list).addEventListener("click", async () => {
      await cloud.signOutCloud();
      toast("Signed out");
      render();
    });
    acc.append(list);
  } else {
    const list = el(`<div class="list ruled">
      <button class="row pressable" id="st-signin">
        <span class="grow"><span class="ttl">Sign in</span>
        <span class="cap">Google sign-in backs up groups, receipts and history.</span></span>
        <span class="chev">${I.chevR}</span>
      </button>
    </div>`);
    $("#st-signin", list).addEventListener("click", () => authSheet());
    acc.append(list);
  }

  const seg = $("#st-theme", view);
  const markTheme = () => {
    for (const b of seg.querySelectorAll("button")) {
      const active = b.dataset.t === (store.state.profile?.theme ?? "dark");
      b.classList.toggle("on", active);
      b.setAttribute("aria-pressed", String(active));
    }
  };
  markTheme();
  seg.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-t]");
    if (!b) return;
    applyTheme(b.dataset.t);
    await store.saveProfile({ theme: b.dataset.t });
    markTheme();
  });

  const swatchBox = $("#st-accent", view);
  const currentAccent = store.state.profile?.accent ?? localStorage.getItem("settld-accent") ?? "coral";
  for (const a of ACCENTS) {
    const on = a.id === currentAccent;
    const sw = el(`<button class="swatch ${on ? "on" : ""}" data-a="${a.id}" aria-label="${a.label}" aria-pressed="${on}">${I.check}</button>`);
    sw.addEventListener("click", async () => {
      applyAccent(a.id);
      await store.saveProfile({ accent: a.id });
      for (const other of swatchBox.children) {
        const active = other === sw;
        other.classList.toggle("on", active);
        other.setAttribute("aria-pressed", String(active));
      }
    });
    swatchBox.append(sw);
  }

  $("#st-import", view).addEventListener("click", () => importSheet());
  $("#st-export", view).addEventListener("click", async () => {
    const data = await store.exportJson();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `settld-export-${toDateInput(Date.now())}.json`;
    a.click();
    toast("Export downloaded");
  });

  const eraseBtn = $("#st-erase", view);
  let eraseArmed = false;
  eraseBtn.addEventListener("click", async () => {
    const ttl = eraseBtn.querySelector(".ttl");
    if (!eraseArmed) {
      eraseArmed = true;
      ttl.textContent = "Tap again to erase everything";
      setTimeout(() => {
        if (eraseBtn.isConnected) {
          eraseArmed = false;
          ttl.textContent = "Erase all data";
        }
      }, 2600);
      return;
    }
    eraseBtn.disabled = true;
    let cloudErase = null;
    if (cloud.currentUser()) {
      try {
        cloudErase = await cloud.eraseCloudData();
        await cloud.signOutCloud();
      } catch {
        eraseBtn.disabled = false;
        eraseArmed = false;
        ttl.textContent = "Erase all data";
        toast("Connect to the internet to erase your Firebase backup");
        return;
      }
    }
    await store.eraseAll(cloudErase ?? undefined);
    location.hash = "#/";
    await welcomeSheet();
    toast(cloudErase?.cleanupPending ? "Data erased. Cloud cleanup will finish next time you sign in." : "All data erased");
  });

  const deleteBtn = $("#st-delete", view);
  let deleteArmed = false;
  deleteBtn?.addEventListener("click", async () => {
    const ttl = deleteBtn.querySelector(".ttl");
    const reset = () => {
      deleteBtn.disabled = false;
      deleteArmed = false;
      ttl.textContent = "Delete account";
    };
    if (!deleteArmed) {
      deleteArmed = true;
      ttl.textContent = "Tap again to delete your account";
      setTimeout(() => {
        if (deleteBtn.isConnected && !deleteBtn.disabled) reset();
      }, 2600);
      return;
    }
    deleteBtn.disabled = true;
    await finishAccountDeletion(reset);
  });

  setAppbar({ title: "You" });
  return view;
}

// Also runs at boot when the app comes back from confirming with Google.
async function finishAccountDeletion(onFail) {
  let result;
  try {
    result = await cloud.deleteAccount();
  } catch (error) {
    onFail?.();
    toast(error?.message === "cloud/offline" ? "Connect to the internet to delete your account" : "Couldn't delete the account. Try again.");
    return;
  }
  if (result.redirected) return;
  await store.eraseAll(result);
  location.hash = "#/";
  await welcomeSheet();
  toast("Account deleted");
}

/* ---------- summary and charts ---------- */

const DAY = 86400000;
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "short" });

// Spend per bucket of time: days for anything up to a month (a trip), months
// beyond that (a flat), capped to the latest twelve.
function spendOverTime(exps, amountOf) {
  const dated = exps.filter((e) => amountOf(e) > 0);
  if (!dated.length) return null;
  const first = Math.min(...dated.map((e) => e.date));
  const last = Math.max(...dated.map((e) => e.date));
  const byDay = last - first <= 31 * DAY;
  const buckets = new Map();
  if (byDay) {
    for (let t = new Date(first).setHours(12, 0, 0, 0); t <= last + DAY / 2; t += DAY) {
      buckets.set(dayKey(t), { label: String(new Date(t).getDate()), title: dayLabel(t), amount: 0 });
    }
  } else {
    const start = new Date(first);
    const end = new Date(last);
    for (let y = start.getFullYear(), m = start.getMonth(); y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth()); m === 11 ? ((m = 0), (y += 1)) : (m += 1)) {
      const d = new Date(y, m, 1);
      buckets.set(`${y}-${m}`, { label: MONTH.format(d), title: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }), amount: 0 });
    }
  }
  for (const e of dated) {
    const d = new Date(e.date);
    const k = byDay ? dayKey(e.date) : `${d.getFullYear()}-${d.getMonth()}`;
    const b = buckets.get(k);
    if (b) b.amount += amountOf(e);
  }
  return { byDay, buckets: [...buckets.values()].slice(-12) };
}

// The donut's centre is small: whole rupees, and lakhs past ₹1,00,000.
const WHOLE = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const LAKHS = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 2 });
const donutMoney = (paise) => (paise >= 10000000 ? LAKHS : WHOLE).format(paise / 100);

function summarySheet(g) {
  const { exps, setts, bal } = groupCalc(g);
  const you = store.youOf(g);
  const net = bal.get(you?.id) ?? 0;
  const shares = new Map(exps.map((e) => [e.id, computeShares(e)]));
  const paidBy = (id) =>
    exps.reduce((sum, e) => sum + e.payers.filter((p) => p.memberId === id).reduce((n, p) => n + p.amountP, 0), 0);
  const shareOf = (id) => exps.reduce((sum, e) => sum + (shares.get(e.id).get(id) ?? 0), 0);
  const cleared = setts.reduce((sum, s) => sum + s.amountP, 0);
  let scope = "all";

  const body = el(`<div>
    <div class="seg sum-scope" role="tablist" aria-label="Whose spending">
      <button data-s="all">Everyone</button>
      <button data-s="you">Your share</button>
    </div>
    <div class="sum-charts"></div>
    <div class="section-cap">Balances</div>
    <div class="summary-metrics">
      <div><span>You paid</span><strong class="money">${fmt(paidBy(you?.id))}</strong></div>
      <div><span>${net > 0 ? "You get" : net < 0 ? "You owe" : "Your balance"}</span><strong class="money ${net > 0 ? "pos" : net < 0 ? "debt" : ""}">${net === 0 ? "All clear" : fmt(Math.abs(net))}</strong></div>
      <div><span>Payments recorded</span><strong class="money">${fmt(cleared)}</strong></div>
    </div>
    <p class="summary-note">What was spent, what you paid and your balance are kept apart because they are not parts of one total.</p>
  </div>`);
  const charts = $(".sum-charts", body);
  const seg = $(".sum-scope", body);

  const draw = () => {
    for (const b of seg.querySelectorAll("button")) {
      const on = b.dataset.s === scope;
      b.setAttribute("role", "tab");
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", String(on));
    }
    const amountOf = scope === "you" ? (e) => shares.get(e.id).get(you?.id) ?? 0 : (e) => e.amountP;
    const total = exps.reduce((sum, e) => sum + amountOf(e), 0);
    charts.replaceChildren();

    // By category: the six largest get a colour, the rest are grouped.
    const cats = CATS.map((cat) => ({ ...cat, amount: exps.filter((e) => e.category === cat.id).reduce((s, e) => s + amountOf(e), 0) }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    const shown = cats.slice(0, cats.length > 6 ? 5 : 6).map((c, i) => ({ ...c, color: `var(--chart-${i + 1})` }));
    if (cats.length > 6) {
      shown.push({ id: "rest", label: `${cats.length - 5} more`, icon: "receipt", color: "var(--text-3)", amount: cats.slice(5).reduce((s, c) => s + c.amount, 0) });
    }
    let cursor = 0;
    const segments = shown.map((c) => {
      const start = cursor;
      cursor += total ? (c.amount / total) * 100 : 0;
      return `${c.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    const donut = segments.length ? `conic-gradient(${segments.join(",")})` : "var(--line)";
    const catBox = el(`<div class="summary-chart-row">
      <div class="spend-donut" style="--chart:${donut}" role="img" aria-label="${scope === "you" ? "Your share" : "Group spend"} by category">
        <div><span>${scope === "you" ? "Your share" : "Total spent"}</span><strong class="money" title="${fmt(total)}">${donutMoney(total)}</strong><small>${exps.length} expense${exps.length === 1 ? "" : "s"}</small></div>
      </div>
      <div class="summary-legend"></div>
    </div>`);
    const legend = $(".summary-legend", catBox);
    for (const c of shown) {
      legend.append(el(`<div class="legend-row"><i style="background:${c.color}"></i><span>${c.id === "rest" ? "" : svg(c.icon)}${esc(c.label)}</span><strong class="money">${fmt(c.amount)}</strong></div>`));
    }
    if (!shown.length) legend.append(el(`<p class="hint">Nothing spent yet.</p>`));
    charts.append(catBox);

    // Over time.
    const time = spendOverTime(exps, amountOf);
    if (time && time.buckets.length > 1) {
      const peak = time.buckets.reduce((a, b) => (b.amount > a.amount ? b : a));
      const bars = el(`<div>
        <div class="section-cap">${time.byDay ? "Day by day" : "Month by month"}</div>
        <div class="bars" role="img" aria-label="${esc(`${time.byDay ? "Daily" : "Monthly"} spend, highest ${fmt(peak.amount)} on ${peak.title}`)}"></div>
        <div class="hint">Highest: ${fmt(peak.amount)}, ${esc(peak.title)}</div>
      </div>`);
      const box = $(".bars", bars);
      const dense = time.buckets.length > 16;
      time.buckets.forEach((b, i) => {
        const h = peak.amount ? Math.max(b.amount ? 4 : 0, Math.round((b.amount / peak.amount) * 100)) : 0;
        const label = !dense || i % 5 === 0 || i === time.buckets.length - 1 ? esc(b.label) : "";
        box.append(el(`<div class="bar${b === peak ? " peak" : ""}" title="${esc(`${b.title}: ${fmt(b.amount)}`)}"><div class="bar-fill"><i style="height:${h}%"></i></div><span>${label}</span></div>`));
      });
      charts.append(bars);
    }

    // By person: who paid and whose share it was.
    if (scope === "all" && g.members.length > 1) {
      const rows = g.members.map((m) => ({ m, paid: paidBy(m.id), share: shareOf(m.id) }));
      const max = Math.max(1, ...rows.map((r) => Math.max(r.paid, r.share)));
      const people = el(`<div><div class="section-cap">Who paid, and whose share it was</div><div class="person-bars"></div></div>`);
      const list = $(".person-bars", people);
      for (const r of rows.sort((a, b) => b.paid - a.paid)) {
        list.append(el(`<div class="person-bar">
          ${avatarHtml(r.m, "sm")}
          <div class="pb-main">
            <div class="pb-top"><span>${esc(displayName(r.m))}</span><span class="money">paid ${fmt(r.paid)}</span></div>
            <div class="pb-track" aria-hidden="true"><i style="width:${(r.paid / max) * 100}%"></i><b style="left:${(r.share / max) * 100}%"></b></div>
            <div class="pb-cap money">share ${fmt(r.share)}</div>
          </div>
        </div>`));
      }
      charts.append(people);
    }
  };
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-s]");
    if (!b || b.dataset.s === scope) return;
    scope = b.dataset.s;
    draw();
  });
  draw();
  const foot = el(`<button class="btn primary">${I.share} Share summary</button>`);
  openSheet({ title: "Summary", body, footer: foot });
  foot.addEventListener("click", () => shareSummary(g));
}

async function shareSummary(g) {
  const { bal, spend } = groupCalc(g);
  const lines = [`${g.name} · Settld`, `Spent so far: ${fmt(spend)}`, ""];
  for (const m of g.members) {
    const v = bal.get(m.id) ?? 0;
    lines.push(`${m.name}: ${v === 0 ? "settled" : (v > 0 ? "gets back " : "owes ") + fmt(Math.abs(v))}`);
  }
  const plan = simplify(bal);
  if (plan.length) {
    lines.push("", "To settle:");
    for (const t of plan) {
      const fn = store.memberOf(g, t.fromId)?.name ?? "?";
      const tn = store.memberOf(g, t.toId)?.name ?? "?";
      lines.push(`${fn} pays ${tn} ${fmt(t.amountP)}`);
    }
  }
  const text = lines.join("\n");
  try {
    await navigator.share({ text });
  } catch {
    await navigator.clipboard.writeText(text);
    toast("Summary copied");
  }
}

/* ---------- welcome + auth ---------- */

let interactiveAuth = false;
let welcomeAuthWrap = null;
let authRestoreTask = Promise.resolve();

async function restorePersistedSession() {
  const signedIn = cloud.currentUser();
  if (!signedIn) return;
  let syncFailed = false;
  try {
    await cloud.syncNow();
  } catch (error) {
    if (cloud.isAccountMismatch(error)) {
      await cloud.signOutCloud();
      toast("This device is linked to another Google account. Export or erase its data before switching.");
      return;
    }
    syncFailed = true;
  }
  if (cloud.currentUser()?.uid !== signedIn.uid) return;
  await store.init();
  render();
  if (welcomeAuthWrap?.isConnected && sheetStack[sheetStack.length - 1]?.wrap === welcomeAuthWrap) {
    closeLocked();
    welcomeAuthWrap = null;
    if (!store.state.profile) welcomeNameSheet(signedIn.displayName ?? "");
    else toast(syncFailed ? "Signed in. Backup is paused, but your device copy is ready." : `Welcome back, ${store.state.profile.name.split(/\s+/)[0]}`);
  } else if (syncFailed) {
    toast("Backup couldn't connect. Your device copy is still ready.");
  }
}

function scheduleAuthRestore() {
  authRestoreTask = authRestoreTask.catch(() => {}).then(restorePersistedSession);
  return authRestoreTask;
}

async function welcomeSheet() {
  if (!cloud.cloudAvailable()) return welcomeNameSheet("");
  if (cloud.cloudReady && cloud.currentUser()) {
    try {
      await cloud.syncNow();
    } catch (error) {
      if (cloud.isAccountMismatch(error)) {
        await cloud.signOutCloud();
        toast("This device is linked to another Google account. Export or erase its data before switching.");
        return welcomeAuthSheet();
      }
    }
    await store.init();
    if (store.state.profile) return;
    return welcomeNameSheet(cloud.currentUser()?.displayName ?? "");
  }
  return welcomeAuthSheet();
}

function authOptions(onSignedIn) {
  const box = el(`<div>
    <button class="btn google au-google">Continue with Google</button>
  </div>`);
  $(".au-google", box).addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    interactiveAuth = true;
    try {
      await cloud.signInGoogle();
      // A redirect sign-in navigates away; nothing after this runs.
      if (!cloud.currentUser()) return;
      const signedIn = await onSignedIn();
      if (signedIn === false) button.disabled = false;
    } catch (err) {
      button.disabled = false;
      if (err?.code === "auth/popup-blocked") toast("Allow the Google sign-in pop-up, then try again");
      else if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request") toast("Google sign-in didn't go through, try again");
    } finally {
      interactiveAuth = false;
    }
  });
  return box;
}

async function afterSignIn(fromLocked) {
  let syncFailed = false;
  try {
    await cloud.syncNow();
  } catch (error) {
    if (cloud.isAccountMismatch(error)) {
      await cloud.signOutCloud();
      toast("This device is linked to another Google account. Export or erase its data before switching.");
      return false;
    }
    syncFailed = true;
  }
  await store.init();
  if (fromLocked) {
    closeLocked();
    welcomeAuthWrap = null;
  } else {
    closeSheet();
  }
  if (!store.state.profile) welcomeNameSheet(cloud.currentUser()?.displayName ?? "");
  else toast(syncFailed ? "Signed in. Backup is paused, but your device copy is ready." : `Welcome back, ${store.state.profile.name.split(/\s+/)[0]}`);
  return true;
}

function welcomeAuthSheet() {
  if (welcomeAuthWrap?.isConnected) return welcomeAuthWrap;
  const body = el(`<div>
    <div class="welcome-hero">
      <div class="welcome-lockup"><span class="mark">${MARK}</span><strong>Settld</strong></div>
      <h2>Split. Prove. Settle.</h2>
      <p>Shared expenses with the receipt, the payment proof and the edit history kept together.</p>
      <div class="trust-points"><span>${I.clip} Proof stays attached</span><span>${I.pulse} Every edit stays visible</span></div>
    </div>
    <div class="au-slot"></div>
    <button class="btn quiet au-skip">Continue on this device</button>
  </div>`);
  $(".au-slot", body).append(authOptions(() => afterSignIn(true)));
  welcomeAuthWrap = openSheet({ body, locked: true });
  $(".au-skip", body).addEventListener("click", () => {
    closeLocked();
    welcomeAuthWrap = null;
    welcomeNameSheet("");
  });
  return welcomeAuthWrap;
}

function authSheet() {
  const body = el(`<div style="padding-top:6px"></div>`);
  body.append(authOptions(() => afterSignIn(false)));
  openSheet({ title: "Sign in", body });
}

function welcomeNameSheet(prefill) {
  const body = el(`<div>
    <div class="welcome-hero compact">
      <div class="welcome-lockup"><span class="mark">${MARK}</span><strong>Settld</strong></div>
      <h2>Make it yours</h2>
      <p>Your name appears on expenses and in the history. UPI can wait.</p>
    </div>
    <label class="cap-label" for="w-name">Your name</label>
    <input class="in" id="w-name" placeholder="Your name" autocomplete="name" value="${esc(prefill)}" maxlength="${store.LIMITS.profileName}">
    <label class="cap-label" for="w-upi">Your UPI ID <span class="dim">(optional)</span></label>
    <input class="in" id="w-upi" placeholder="name@bank" autocapitalize="none" maxlength="${store.LIMITS.upi}">
  </div>`);
  const foot = el(`<button class="btn primary">Get started</button>`);
  openSheet({ body, footer: foot, locked: true });
  foot.addEventListener("click", async () => {
    const name = $("#w-name", body).value.trim();
    if (!name) return toast("Tell us your name first");
    await store.saveProfile({
      name,
      upi: $("#w-upi", body).value.trim(),
      theme: localStorage.getItem("settld-theme") ?? "dark",
      accent: localStorage.getItem("settld-accent") ?? "coral",
    });
    closeLocked();
    render();
  });
}

/* ---------- group creation and settings ---------- */

function iconChips(selected) {
  const box = el(`<div class="icon-picks" role="group" aria-label="Group icon"></div>`);
  const current = groupIconId(selected);
  for (const gi of GROUP_ICONS) {
    const active = gi.id === current;
    const c = el(`<button class="icon-pick ${active ? "on" : ""}" data-e="${gi.id}" aria-label="${esc(gi.label)}" aria-pressed="${active}">${svg(gi.icon)}</button>`);
    c.addEventListener("click", () => {
      for (const x of box.children) {
        const on = x === c;
        x.classList.toggle("on", on);
        x.setAttribute("aria-pressed", String(on));
      }
    });
    box.append(c);
  }
  return box;
}

function newGroupSheet() {
  const names = [];
  const body = el(`<div>
    <label class="cap-label" for="ng-name" style="margin-top:4px">Group name</label>
    <input class="in" id="ng-name" placeholder="Goa trip, Flat 302, Office lunch" maxlength="${store.LIMITS.groupName}">
    <label class="cap-label">Icon</label>
    <div class="ng-emoji"></div>
    <label class="cap-label" for="ng-member">Who else is in <span class="dim">(you're already in)</span></label>
    <div style="display:flex;gap:8px">
      <input class="in" id="ng-member" placeholder="Add a name" maxlength="${store.LIMITS.memberName}" style="flex:1">
      <button class="btn ghost small" id="ng-add" style="min-height:54px">Add</button>
    </div>
    <div class="chips" id="ng-chips" style="margin-top:10px"></div>
    <div class="hint">You can invite them to join with their own account once the group exists.</div>
  </div>`);
  const emo = iconChips("trip");
  $(".ng-emoji", body).append(emo);

  const chips = $("#ng-chips", body);
  const input = $("#ng-member", body);
  const addName = () => {
    const n = input.value.trim();
    if (!n) return;
    if (names.length >= store.LIMITS.members - 1) return toast(`A group can have up to ${store.LIMITS.members} people`);
    names.push(n);
    const chip = el(`<span class="chip on member-tag">${esc(n)} <button class="chip-remove" aria-label="Remove ${esc(n)}">${I.x}</button></span>`);
    chip.querySelector("button").addEventListener("click", () => {
      names.splice(names.indexOf(n), 1);
      chip.remove();
    });
    chips.append(chip);
    input.value = "";
    input.focus();
  };
  $("#ng-add", body).addEventListener("click", addName);
  input.addEventListener("keydown", (e) => e.key === "Enter" && addName());

  const foot = el(`<button class="btn primary">Create group</button>`);
  openSheet({ title: "New group", body, footer: foot });
  foot.addEventListener("click", async () => {
    const name = $("#ng-name", body).value.trim();
    if (!name) return toast("Give the group a name");
    if (input.value.trim()) addName();
    const emoji = emo.querySelector(".on")?.dataset.e ?? "trip";
    const g = await store.createGroup({ name, emoji, memberNames: names });
    closeSheet(false, () => (location.hash = `#/group/${g.id}`));
  });
}

function membersSheet(g) {
  const body = el(`<div>
    <div class="list ruled" id="gs-members" style="margin-top:4px"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <input class="in" id="gs-new" placeholder="Add a person" maxlength="${store.LIMITS.memberName}" style="flex:1">
      <button class="btn ghost small" id="gs-add" style="min-height:54px">Add</button>
    </div>
  </div>`);

  const renderMembers = () => {
    const box = $("#gs-members", body);
    box.replaceChildren();
    for (const m of g.members) {
      const state = g.shared
        ? `<span class="member-state ${m.uid ? "joined" : ""}">${m.uid ? `${I.check}Joined` : "Not joined yet"}</span>`
        : "";
      const row = el(`<button class="row pressable">
        ${avatarHtml(m)}
        <span class="grow"><span class="ttl">${esc(m.name)}${m.isYou ? " (you)" : ""}</span>
          <span class="cap">${m.upi ? esc(m.upi) : "No UPI ID yet"}</span></span>
        <span class="end">${state}</span>
        <span class="chev">${I.chevR}</span>
      </button>`);
      row.addEventListener("click", () => memberSheet(g, m, renderMembers));
      box.append(row);
    }
  };
  renderMembers();

  $("#gs-add", body).addEventListener("click", async () => {
    const n = $("#gs-new", body).value.trim();
    if (!n) return;
    if (g.members.length >= store.LIMITS.members) return toast(`A group can have up to ${store.LIMITS.members} people`);
    await store.addMember(g, n);
    $("#gs-new", body).value = "";
    renderMembers();
  });

  openSheet({ title: "People", body });
}

const inviteLink = (gid) => `${location.origin}${location.pathname}#/join/${gid}`;

function inviteSheet(g) {
  if (!cloud.cloudAvailable()) {
    const body = el(`<div><p class="hint" style="margin-top:4px">Sharing needs a connection. Try again once you are back online.</p></div>`);
    openSheet({ title: "Invite someone", body });
    return;
  }
  if (!cloud.currentUser()) {
    const body = el(`<div>
      <p class="hint" style="margin-top:4px">Sharing needs an account, so the people you invite have somewhere to join. Your ledger stays on this device either way.</p>
    </div>`);
    const foot = el(`<button class="btn primary">Sign in to share</button>`);
    openSheet({ title: "Invite someone", body, footer: foot });
    foot.addEventListener("click", () => closeSheet(false, () => authSheet()));
    return;
  }
  if (!g.shared) {
    const body = el(`<div>
      <p class="hint" style="margin-top:4px">Turning on sharing moves this group to a space everyone in it can reach. The people you invite sign in, pick their name, and can add expenses themselves. Your other groups are untouched.</p>
    </div>`);
    const foot = el(`<button class="btn primary">Turn on sharing</button>`);
    openSheet({ title: `Share ${g.name}`, body, footer: foot });
    foot.addEventListener("click", async () => {
      foot.disabled = true;
      foot.textContent = "Setting up";
      try {
        const info = await cloud.shareGroup(g);
        await store.markShared(g, info);
        // A backup sync can reload the group list while sharing runs, leaving
        // state with a copy that never saw markShared; reread from disk.
        await store.init();
        closeSheet(false, () => inviteSheet(store.groupById(g.id) ?? g));
        toast("Sharing is on");
      } catch {
        foot.disabled = false;
        foot.textContent = "Turn on sharing";
        toast("Could not turn on sharing, try again");
      }
    });
    return;
  }

  const link = inviteLink(g.id);
  const waiting = g.members.filter((m) => !m.uid);
  const body = el(`<div>
    <p class="hint" style="margin-top:4px">Send this on WhatsApp. They open it, sign in, pick which name is theirs, and the balance already against that name becomes theirs.</p>
    <div class="invite-code">${esc(link)}</div>
    <div class="section-cap">Who has joined</div>
    <div class="list ruled inv-members"></div>
    ${waiting.length ? `<div class="hint">${waiting.length} ${waiting.length === 1 ? "person is" : "people are"} still just a name. The maths works either way.</div>` : ""}
  </div>`);
  const list = $(".inv-members", body);
  for (const m of g.members) {
    list.append(el(`<div class="row">
      ${avatarHtml(m)}
      <span class="grow"><span class="ttl">${esc(m.name)}${m.isYou ? " (you)" : ""}</span></span>
      <span class="end"><span class="member-state ${m.uid ? "joined" : ""}">${m.uid ? `${I.check}Joined` : "Not joined"}</span></span>
    </div>`));
  }
  const foot = el(`<div class="btn-row">
    <button class="btn ghost inv-copy">Copy link</button>
    <button class="btn primary inv-share">${I.share} Share</button>
  </div>`);
  openSheet({ title: "Invite someone", body, footer: foot });
  $(".inv-copy", foot).addEventListener("click", async () => {
    await navigator.clipboard.writeText(link);
    toast("Invite link copied");
  });
  $(".inv-share", foot).addEventListener("click", async () => {
    try {
      await navigator.share({ title: `Join ${g.name} on Settld`, text: `Join ${g.name} on Settld`, url: link });
    } catch {
      await navigator.clipboard.writeText(link);
      toast("Invite link copied");
    }
  });
}

/* ---------- joining a shared group ---------- */

function JoinScreen(gid) {
  const view = el(`<div>
    <div class="display"><h1>Join group</h1><div class="sub">Checking the invite.</div></div>
    <div class="join-body"></div>
  </div>`);
  const body = $(".join-body", view);
  setAppbar({ title: "Join group" });

  const existing = store.groupById(gid);
  if (existing && store.youOf(existing)) {
    setTimeout(() => (location.hash = `#/group/${gid}`), 0);
    return view;
  }

  const fail = (heading, detail, action) => {
    const empty = el(`<div class="empty"><h3>${esc(heading)}</h3><p>${esc(detail)}</p></div>`);
    if (action) empty.append(action);
    body.replaceChildren(empty);
    $(".sub", view).textContent = "";
  };

  (async () => {
    if (!cloud.cloudReady || !cloud.cloudAvailable()) {
      return fail("Cannot reach Settld", "An invite needs a connection. Open the link again once you are back online.");
    }
    if (!cloud.currentUser()) {
      const btn = el(`<button class="btn primary">Sign in</button>`);
      btn.addEventListener("click", () => authSheet());
      return fail("Sign in to join", "Joining a shared group needs an account, so the group knows which balance is yours.", btn);
    }
    let remote;
    try {
      remote = await cloud.peekGroup(gid);
    } catch {
      return fail("Could not open the invite", "Check the link, or ask whoever sent it to send it again.");
    }
    if (!remote) return fail("This invite is not valid", "The group may have been deleted, or the link is incomplete.");

    $(".sub", view).textContent = `${remote.members?.length ?? 0} people are already in this group.`;
    const unclaimed = (remote.members ?? []).filter((m) => !m.uid);
    const box = el(`<div>
      <div class="group-title-line" style="margin-top:10px">
        <span class="group-emoji">${groupIcon(remote)}</span>
        <h1>${esc(remote.name ?? "Group")}</h1>
      </div>
      <div class="section-cap">Which one is you?</div>
      <div class="list ruled join-list"></div>
    </div>`);
    const list = $(".join-list", box);

    const join = async (memberId, label) => {
      for (const b of list.querySelectorAll("button")) b.disabled = true;
      try {
        await cloud.joinGroup(gid, {
          memberId,
          name: store.state.profile?.name || cloud.currentUser()?.displayName || label,
          upi: store.state.profile?.upi ?? "",
        });
        await store.init();
        toast(`Joined ${remote.name}`);
        location.hash = `#/group/${gid}`;
      } catch {
        for (const b of list.querySelectorAll("button")) b.disabled = false;
        toast("Could not join, try again");
      }
    };

    for (const m of unclaimed) {
      const row = el(`<button class="row pressable">
        ${avatarHtml(m)}
        <span class="grow"><span class="ttl">${esc(m.name)}</span><span class="cap">Take this name and its balance</span></span>
        <span class="chev">${I.chevR}</span>
      </button>`);
      row.addEventListener("click", () => join(m.id, m.name));
      list.append(row);
    }
    const fresh = el(`<button class="row pressable">
      <span class="tile">${I.plus}</span>
      <span class="grow"><span class="ttl">None of these, add me</span><span class="cap">Join with a clean balance</span></span>
      <span class="chev">${I.chevR}</span>
    </button>`);
    fresh.addEventListener("click", () => join(null, store.state.profile?.name ?? "You"));
    list.append(fresh);
    body.replaceChildren(box);
  })();

  return view;
}

// The group's saved split, limited to people still in the group; null when
// there is none or nobody in it is left.
function validDefaultSplit(g) {
  const d = g.defaultSplit;
  if (!d || !["equal", "percent", "shares"].includes(d.mode)) return null;
  const ids = new Set(g.members.map((m) => m.id));
  const participants = (d.participants ?? []).filter((p) => ids.has(p.memberId));
  return participants.length ? { mode: d.mode, participants } : null;
}

function describeDefaultSplit(g) {
  const d = validDefaultSplit(g);
  if (!d) return "Equally between everyone";
  const name = (p) => displayName(store.memberOf(g, p.memberId));
  if (d.mode === "equal") {
    return d.participants.length === g.members.length ? "Equally between everyone" : `Equally between ${d.participants.map(name).join(", ")}`;
  }
  if (d.mode === "percent") return d.participants.map((p) => `${name(p)} ${p.value}%`).join(", ");
  return d.participants.map((p) => `${name(p)} ${p.value} share${Number(p.value) === 1 ? "" : "s"}`).join(", ");
}

function groupSettingsSheet(g) {
  const body = el(`<div>
    <label class="cap-label" for="gs-name" style="margin-top:4px">Group name</label>
    <input class="in" id="gs-name" value="${esc(g.name)}" maxlength="${store.LIMITS.groupName}">
    <label class="cap-label">Icon</label>
    <div class="gs-emoji"></div>
    <label class="cap-label">New expenses start split</label>
    <div class="list ruled gs-split"></div>
    <button class="btn danger" id="gs-del" style="margin-top:26px">Delete group</button>
  </div>`);
  const emo = iconChips(g.emoji);
  $(".gs-emoji", body).append(emo);

  const splitBox = $(".gs-split", body);
  const drawSplit = () => {
    const custom = validDefaultSplit(g);
    const row = el(`<div class="row">
      <span class="tile">${I.sliders}</span>
      <span class="grow"><span class="ttl">${esc(describeDefaultSplit(g))}</span>
        <span class="cap">${custom ? "Saved from an expense" : "Save another split from any expense with “Use for new expenses”"}</span></span>
      ${custom ? `<button class="btn quiet small gs-reset">Reset</button>` : ""}
    </div>`);
    $(".gs-reset", row)?.addEventListener("click", async () => {
      await store.setDefaultSplit(g, null);
      drawSplit();
      toast("New expenses split equally again");
    });
    splitBox.replaceChildren(row);
  };
  drawSplit();

  armDanger($("#gs-del", body), async () => {
    await store.deleteGroup(g);
    closeSheet(false, () => (location.hash = "#/"));
    toast("Group deleted");
  });

  const foot = el(`<button class="btn primary">Save</button>`);
  openSheet({ title: "Group settings", body, footer: foot });
  foot.addEventListener("click", async () => {
    const name = $("#gs-name", body).value.trim();
    if (!name) return toast("Name can't be empty");
    await store.renameGroup(g, name, emo.querySelector(".on")?.dataset.e ?? groupIconId(g.emoji));
    closeSheet();
  });
}

function memberSheet(g, m, onDone) {
  const body = el(`<div>
    <label class="cap-label" for="ms-name" style="margin-top:4px">Name</label>
    <input class="in" id="ms-name" value="${esc(m.name)}" maxlength="${store.LIMITS.memberName}">
    <label class="cap-label" for="ms-upi">UPI ID</label>
    <input class="in" id="ms-upi" value="${esc(m.upi ?? "")}" placeholder="name@bank" autocapitalize="none" maxlength="${store.LIMITS.upi}">
    <div class="hint">Used for one-tap UPI when someone clears up with ${esc(displayName(m))}.</div>
    ${m.isYou ? "" : `<button class="btn danger" id="ms-remove" style="margin-top:22px">Remove from group</button>`}
  </div>`);
  const foot = el(`<button class="btn primary">Save</button>`);
  openSheet({ title: m.isYou ? "Your details" : m.name, body, footer: foot });

  const rm = $("#ms-remove", body);
  if (rm) {
    armDanger(rm, async () => {
      const { bal } = groupCalc(g);
      if ((bal.get(m.id) ?? 0) !== 0) return toast("Settle up first, their balance isn't zero");
      await store.removeMember(g, m.id);
      closeSheet();
      onDone?.();
    });
  }
  foot.addEventListener("click", async () => {
    const name = $("#ms-name", body).value.trim();
    if (!name) return toast("Name can't be empty");
    await store.updateMember(g, m.id, { name, upi: $("#ms-upi", body).value.trim() });
    if (m.isYou) await store.saveProfile({ name, upi: $("#ms-upi", body).value.trim() });
    closeSheet();
    onDone?.();
  });
}

/* ---------- expense sheet ---------- */

const MODE_LABEL = { equal: "equally", exact: "by exact amounts", percent: "by percent", shares: "by shares", items: "by items" };

const lastCurrency = (g) => {
  try {
    return localStorage.getItem(`settld.cur.${g.id}`) ?? "INR";
  } catch {
    return "INR";
  }
};
const rememberCurrency = (g, code) => {
  try {
    localStorage.setItem(`settld.cur.${g.id}`, code);
  } catch {
    /* only a convenience */
  }
};

function currencySheet(current, onPick) {
  const body = el(`<div class="list ruled"></div>`);
  for (const [code, name] of CURRENCIES) {
    const on = code === current;
    const row = el(`<button class="row pressable" aria-pressed="${on}">
      <span class="tile cur-tile">${esc(currencySymbol(code))}</span>
      <span class="grow"><span class="ttl">${esc(name)}</span><span class="cap">${code}</span></span>
      ${on ? `<span class="chev on-mark">${I.check}</span>` : ""}
    </button>`);
    row.addEventListener("click", () => closeSheet(false, () => onPick(code)));
    body.append(row);
  }
  openSheet({ title: "Currency", body });
}

function expenseSheet(g, existing) {
  const fx0 = existing?.fx ?? null;
  const cur0 = fx0?.currency ?? (existing ? "INR" : lastCurrency(g));
  // An expense entered abroad is edited in the currency it was typed in; its
  // rupee parts are spread back over the foreign total so they still add up.
  const back = (partsP) => (fx0 ? spreadInr(Math.round(fx0.amount * 100), partsP) : partsP);
  const def = existing ? null : validDefaultSplit(g);
  const s = existing
    ? {
        desc: existing.desc,
        amountStr: fromPaise(fx0 ? Math.round(fx0.amount * 100) : existing.amountP),
        date: existing.date,
        category: existing.category,
        catTouched: true,
        multi: existing.payers.length > 1,
        payers: (() => {
          const amounts = back(existing.payers.map((p) => p.amountP));
          return existing.payers.map((p, i) => ({ memberId: p.memberId, amountStr: fromPaise(amounts[i]) }));
        })(),
        parts: new Set(existing.split.participants.map((p) => p.memberId)),
        mode: existing.split.mode,
        values: (() => {
          const ps = existing.split.participants;
          if (existing.split.mode !== "exact") return new Map(ps.map((p) => [p.memberId, String(p.value ?? "")]));
          const amounts = back(ps.map((p) => p.valueP ?? 0));
          return new Map(ps.map((p, i) => [p.memberId, fromPaise(amounts[i])]));
        })(),
        items: (existing.split.items ?? []).map((it) => ({
          name: it.name ?? "",
          amountStr: fromPaise(fx0 ? Math.round(it.amountP / fx0.rate) : it.amountP),
          ids: new Set(it.memberIds),
        })),
        repeat: existing.repeat?.freq ?? "none",
        att: [...(existing.attachments ?? []).map((id) => ({ id }))],
        notes: existing.notes ?? "",
      }
    : {
        desc: "",
        amountStr: "",
        date: Date.now(),
        category: "other",
        catTouched: false,
        multi: false,
        payers: [{ memberId: store.youOf(g)?.id ?? g.members[0].id, amountStr: "" }],
        parts: new Set(def ? def.participants.map((p) => p.memberId) : g.members.map((m) => m.id)),
        mode: def?.mode ?? "equal",
        values: new Map(def && def.mode !== "equal" ? def.participants.map((p) => [p.memberId, String(p.value ?? "")]) : []),
        items: [],
        repeat: "none",
        att: [],
        notes: "",
      };
  s.cur = cur0;
  s.rate = fx0?.rate ?? null;
  s.rateSource = fx0 ? "saved" : null;
  s.saveDefault = false;
  const entry = (cents) => (s.cur === "INR" ? fmt(cents) : fmtForeign(cents / 100, s.cur));

  const body = el(`<div>
    <div class="amount-shell">
      <button class="cur-btn" type="button"></button>
      <input class="amount-in money" inputmode="decimal" placeholder="0" value="${esc(s.amountStr)}">
    </div>
    <div class="fx-line" role="status" aria-live="polite"></div>
    <div class="desc-row">
      <button class="tile desc-cat" type="button"></button>
      <label class="sr-only" for="x-desc">Expense description</label>
      <input class="in expense-desc" id="x-desc" placeholder="What was it?" value="${esc(s.desc)}" maxlength="${store.LIMITS.expenseDesc}" autocomplete="off">
    </div>
    <label class="cap-label">Paid by</label>
    <div class="x-payers"></div>
    <label class="cap-label">Split between</label>
    <div class="chips x-parts"></div>
    <div class="hint x-parts-hint"></div>
    <details class="expense-more" ${existing ? "open" : ""}>
      <summary><span class="summary-icon">${I.clip}</span><span><strong>More details and proof</strong><small>Split method, category, date, repeats, receipt, notes</small></span><span class="summary-chev">${I.chevR}</span></summary>
      <div class="expense-more-body">
        <label class="cap-label">How to split</label>
        <div class="seg x-mode" role="tablist" aria-label="Split method">
          <button data-m="equal">Equally</button>
          <button data-m="exact">Exact</button>
          <button data-m="percent">Percent</button>
          <button data-m="shares">Shares</button>
          <button data-m="items">Items</button>
        </div>
        <div class="x-values" style="margin-top:14px"></div>
        <label class="check-row x-default-row" hidden>
          <input type="checkbox" class="x-default">
          <span>Use this split for new expenses in ${esc(g.name)}</span>
        </label>
        <label class="cap-label">Category</label>
        <div class="chips x-cats"></div>
        <label class="cap-label" for="x-date">Date</label>
        <input class="in" id="x-date" type="date" value="${toDateInput(s.date)}">
        <label class="cap-label">Repeats</label>
        <div class="chips x-repeat" role="group" aria-label="Repeats"></div>
        <div class="hint x-repeat-hint"></div>
        <label class="cap-label">Proof <span class="dim">(receipt or payment screenshot)</span></label>
        <div class="proof-add-copy">${I.receipt}<span><strong>Keep the record clear</strong><small>Images are compressed on this device before backup.</small></span></div>
        <div class="thumbs x-thumbs"></div>
        <input type="file" accept="image/*" multiple hidden class="x-file">
        <label class="cap-label" for="x-notes">Notes <span class="dim">(optional)</span></label>
        <input class="in" id="x-notes" placeholder="Anything the group should know" value="${esc(s.notes)}" maxlength="${store.LIMITS.expenseNotes}">
      </div>
    </details>
  </div>`);

  /* amount and currency */
  const amountIn = $(".amount-in", body);
  const curBtn = $(".cur-btn", body);
  const fxLine = $(".fx-line", body);
  let editingRate = false;
  function drawCurrency() {
    curBtn.textContent = currencySymbol(s.cur);
    curBtn.setAttribute("aria-label", `Currency: ${currencyName(s.cur)}. Change`);
    amountIn.setAttribute("aria-label", `Amount in ${currencyName(s.cur)}`);
    curBtn.classList.toggle("foreign", s.cur !== "INR");
  }
  function drawFx() {
    if (s.cur === "INR") {
      fxLine.hidden = true;
      fxLine.replaceChildren();
      return;
    }
    fxLine.hidden = false;
    const cents = toPaise(s.amountStr) || 0;
    const credit = `<a class="fx-credit" href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates by ExchangeRate-API</a>`;
    if (s.rateSource === "loading") {
      fxLine.innerHTML = `<span>Getting today's rate for ${esc(s.cur)}</span>`;
      return;
    }
    const ask = editingRate || !(s.rate > 0);
    fxLine.innerHTML = `
      <span class="fx-sum">${s.rate > 0 ? `${cents ? `<b class="money">${fmt(toInrPaise(cents, s.rate))}</b> · ` : ""}1 ${esc(s.cur)} = ${fmt(Math.round(s.rate * 100))}` : `No rate for ${esc(s.cur)} yet${navigator.onLine ? "" : " while offline"}`}</span>
      ${ask
        ? `<span class="fx-edit"><label for="x-rate">₹ per ${esc(s.cur)}</label><input class="in money" id="x-rate" inputmode="decimal" value="${s.rate > 0 ? esc(String(s.rate)) : ""}" placeholder="0.00"></span>`
        : `<button class="fx-change" type="button">Change rate</button>`}
      ${s.rateSource === "live" && !ask ? credit : s.rateSource === "saved" && !ask ? `<span class="fx-src">Saved rate</span>` : ""}`;
    $(".fx-change", fxLine)?.addEventListener("click", () => {
      editingRate = true;
      drawFx();
      $("#x-rate", fxLine)?.focus();
    });
    $("#x-rate", fxLine)?.addEventListener("input", (e) => {
      const r = Number(e.target.value);
      s.rate = Number.isFinite(r) && r > 0 ? roundRate(r) : null;
      s.rateSource = "manual";
      const sum = $(".fx-sum", fxLine);
      if (sum) sum.innerHTML = s.rate > 0 && cents ? `<b class="money">${fmt(toInrPaise(cents, s.rate))}</b>` : "";
    });
  }
  async function loadRate() {
    if (s.cur === "INR") return drawFx();
    const want = s.cur;
    s.rateSource = "loading";
    drawFx();
    const r = await rateFor(want);
    if (s.cur !== want) return;
    s.rate = r?.rate ?? null;
    s.rateSource = r?.source ?? "none";
    drawFx();
  }
  curBtn.addEventListener("click", () =>
    currencySheet(s.cur, (code) => {
      if (code === s.cur) return;
      s.cur = code;
      s.rate = null;
      editingRate = false;
      drawCurrency();
      loadRate();
      renderValues();
      updatePayerHint();
    }),
  );
  drawCurrency();
  if (s.cur !== "INR" && !s.rate) loadRate();
  else drawFx();

  amountIn.addEventListener("input", () => {
    s.amountStr = amountIn.value;
    renderValues();
    updatePayerHint();
    if (s.cur !== "INR" && !editingRate) drawFx();
  });

  /* description and category */
  const descCat = $(".desc-cat", body);
  const catBox = $(".x-cats", body);
  const details = $("details.expense-more", body);
  function markCats() {
    descCat.innerHTML = catIcon(s.category);
    descCat.setAttribute("aria-label", `Category: ${catOf(s.category).label}. Change`);
    for (const x of catBox.children) {
      const on = x.dataset.c === s.category;
      x.classList.toggle("on", on);
      x.setAttribute("aria-pressed", String(on));
    }
  }
  for (const c of CATS) {
    const chip = el(`<button class="chip" data-c="${c.id}">${svg(c.icon)} ${c.label}</button>`);
    chip.addEventListener("click", () => {
      s.category = c.id;
      s.catTouched = true;
      markCats();
    });
    catBox.append(chip);
  }
  markCats();
  descCat.addEventListener("click", () => {
    details.open = true;
    catBox.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  $("#x-desc", body).addEventListener("input", (e) => {
    s.desc = e.target.value;
    if (s.catTouched) return;
    s.category = guessCategory(s.desc) ?? "other";
    markCats();
  });
  $("#x-date", body).addEventListener("change", (e) => {
    s.date = fromDateInput(e.target.value);
    drawRepeat();
  });
  $("#x-notes", body).addEventListener("input", (e) => (s.notes = e.target.value));

  /* repeats */
  const repeatBox = $(".x-repeat", body);
  const repeatHint = $(".x-repeat-hint", body);
  function drawRepeat() {
    repeatBox.replaceChildren();
    for (const f of [{ id: "none", label: "Never" }, ...FREQS]) {
      const on = s.repeat === f.id;
      const chip = el(`<button class="chip ${on ? "on" : ""}" aria-pressed="${on}">${f.label}</button>`);
      chip.addEventListener("click", () => {
        s.repeat = f.id;
        drawRepeat();
      });
      repeatBox.append(chip);
    }
    const next = s.repeat === "none" ? null : nextDate(s.date, makeRepeat(s.repeat, s.date));
    repeatHint.textContent = next
      ? `Added again automatically ${dayPhrase(next)}, and every ${freqOf(s.repeat).every} after, until you stop it.`
      : "";
  }
  drawRepeat();

  /* payers */
  const payersBox = $(".x-payers", body);
  function renderPayers() {
    payersBox.replaceChildren();
    if (!s.multi) {
      const chips = el(`<div class="chips"></div>`);
      for (const m of g.members) {
        const on = s.payers[0]?.memberId === m.id;
        const chip = el(`<button class="chip ${on ? "on" : ""}" aria-pressed="${on}" aria-label="${esc(displayName(m))} paid">${avatarHtml(m, "sm")} ${esc(displayName(m))}</button>`);
        chip.addEventListener("click", () => {
          s.payers = [{ memberId: m.id, amountStr: "" }];
          renderPayers();
        });
        chips.append(chip);
      }
      payersBox.append(chips);
      if (g.members.length > 1) {
        const link = el(`<button class="payer-multi-toggle">+ More than one person paid</button>`);
        link.addEventListener("click", () => {
          s.multi = true;
          renderPayers();
        });
        payersBox.append(link);
      }
    } else {
      for (const m of g.members) {
        const cur = s.payers.find((p) => p.memberId === m.id);
        const row = el(`<div class="split-row">
          <button class="chip ${cur ? "on" : ""}" aria-pressed="${Boolean(cur)}" aria-label="Toggle ${esc(displayName(m))} as a payer" style="flex:1;justify-content:flex-start">${avatarHtml(m, "sm")} ${esc(displayName(m))}</button>
          <input class="in money" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${esc(cur?.amountStr ?? "")}" aria-label="Amount paid by ${esc(displayName(m))}" ${cur ? "" : "disabled"}>
        </div>`);
        row.querySelector(".chip").addEventListener("click", () => {
          if (cur) s.payers = s.payers.filter((p) => p.memberId !== m.id);
          else s.payers.push({ memberId: m.id, amountStr: "" });
          renderPayers();
        });
        row.querySelector("input").addEventListener("input", (e) => {
          const p = s.payers.find((x) => x.memberId === m.id);
          if (p) p.amountStr = e.target.value;
          updatePayerHint();
        });
        payersBox.append(row);
      }
      payersBox.append(el(`<div class="hint x-payhint" role="status" aria-live="polite"></div>`));
      updatePayerHint();
    }
  }
  function updatePayerHint() {
    const hint = $(".x-payhint", payersBox);
    if (!hint) return;
    const total = toPaise(s.amountStr) || 0;
    const sum = s.payers.reduce((a, p) => a + (toPaise(p.amountStr) || 0), 0);
    const left = total - sum;
    hint.className = `hint x-payhint ${left === 0 && total > 0 ? "good" : "bad"}`;
    hint.textContent =
      total <= 0
        ? "Enter the total amount above first"
        : left === 0
          ? "Payments match the total"
          : left > 0
            ? `${entry(left)} left to assign`
            : `${entry(-left)} over the total`;
  }
  renderPayers();

  /* participants */
  const partsBox = $(".x-parts", body);
  const partsHint = $(".x-parts-hint", body);
  function renderParts() {
    partsBox.replaceChildren();
    for (const m of g.members) {
      const on = s.parts.has(m.id);
      const chip = el(`<button class="chip ${on ? "on" : ""}" aria-pressed="${on}" aria-label="Include ${esc(displayName(m))} in the split">${avatarHtml(m, "sm")} ${esc(displayName(m))}</button>`);
      chip.addEventListener("click", () => {
        if (s.parts.has(m.id)) s.parts.delete(m.id);
        else s.parts.add(m.id);
        renderParts();
        renderValues();
      });
      partsBox.append(chip);
    }
    partsHint.textContent = s.mode === "items" ? "New items start with these people. Each item says who had it." : "";
    partsHint.hidden = s.mode !== "items";
  }
  renderParts();

  /* split method */
  const modeSeg = $(".x-mode", body);
  const valuesBox = $(".x-values", body);
  const defaultRow = $(".x-default-row", body);
  const defaultBox = $(".x-default", body);
  defaultBox.addEventListener("change", () => (s.saveDefault = defaultBox.checked));
  const markMode = () => {
    for (const b of modeSeg.querySelectorAll("button")) {
      const active = b.dataset.m === s.mode;
      b.setAttribute("role", "tab");
      b.classList.toggle("on", active);
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
    }
  };
  markMode();
  modeSeg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-m]");
    if (!b) return;
    s.mode = b.dataset.m;
    if (s.mode === "items" && !s.items.length) s.items.push({ name: "", amountStr: "", ids: new Set(s.parts) });
    markMode();
    renderParts();
    renderValues();
  });
  modeSeg.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const buttons = [...modeSeg.querySelectorAll("button[data-m]")];
    const current = buttons.indexOf(e.target.closest("button[data-m]"));
    if (current < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (current + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next].click();
    buttons[next].focus();
  });

  function drawDefaultToggle() {
    const everyoneEqual = s.mode === "equal" && s.parts.size === g.members.length;
    const can = ["equal", "percent", "shares"].includes(s.mode) && !(everyoneEqual && !validDefaultSplit(g)) && s.parts.size > 0;
    defaultRow.hidden = !can;
    if (!can) {
      s.saveDefault = false;
      defaultBox.checked = false;
    }
  }

  function renderItems() {
    const members = g.members;
    s.items.forEach((item, index) => {
      const row = el(`<div class="item-row">
        <div class="item-top">
          <input class="in item-name" placeholder="Item ${index + 1}" value="${esc(item.name)}" maxlength="120" aria-label="Item ${index + 1} name">
          <input class="in money item-amt" inputmode="decimal" placeholder="0" value="${esc(item.amountStr)}" aria-label="Item ${index + 1} amount">
          <button class="icon-btn item-del" aria-label="Remove item ${index + 1}">${I.x}</button>
        </div>
        <div class="item-who" role="group" aria-label="Who had item ${index + 1}"></div>
      </div>`);
      $(".item-name", row).addEventListener("input", (e) => (item.name = e.target.value));
      $(".item-amt", row).addEventListener("input", (e) => {
        item.amountStr = e.target.value;
        updateValueHint();
      });
      $(".item-del", row).addEventListener("click", () => {
        s.items.splice(index, 1);
        renderValues();
      });
      const who = $(".item-who", row);
      for (const m of members) {
        const on = item.ids.has(m.id);
        const b = el(`<button class="who-pick ${on ? "on" : ""}" aria-pressed="${on}" aria-label="${esc(displayName(m))} had this">${avatarHtml(m, "sm")}<span>${esc(displayName(m))}</span></button>`);
        b.addEventListener("click", () => {
          if (item.ids.has(m.id)) item.ids.delete(m.id);
          else item.ids.add(m.id);
          b.classList.toggle("on", item.ids.has(m.id));
          b.setAttribute("aria-pressed", String(item.ids.has(m.id)));
          updateValueHint();
        });
        who.append(b);
      }
      valuesBox.append(row);
    });
    const add = el(`<button class="payer-multi-toggle">+ Add an item</button>`);
    add.addEventListener("click", () => {
      s.items.push({ name: "", amountStr: "", ids: new Set(s.parts) });
      renderValues();
      const names = valuesBox.querySelectorAll(".item-name");
      names[names.length - 1]?.focus();
    });
    valuesBox.append(add);
  }

  function renderValues() {
    valuesBox.replaceChildren();
    drawDefaultToggle();
    if (s.mode === "items") {
      renderItems();
      valuesBox.append(el(`<div class="hint x-valhint" role="status" aria-live="polite"></div>`));
      updateValueHint();
      return;
    }
    const ids = [...s.parts];
    const total = toPaise(s.amountStr) || 0;
    if (!ids.length) {
      valuesBox.append(el(`<div class="hint bad">Pick at least one person to split between</div>`));
      return;
    }
    if (s.mode === "equal") {
      valuesBox.append(el(`<div class="hint">${total > 0 ? `About ${entry(Math.round(total / ids.length))} each, ${ids.length} ${ids.length === 1 ? "person" : "people"}` : `${ids.length} ${ids.length === 1 ? "person" : "people"}, equal shares`}</div>`));
      return;
    }
    const unit = s.mode === "exact" ? esc(currencySymbol(s.cur)) : s.mode === "percent" ? "%" : "shares";
    for (const idm of ids) {
      const m = store.memberOf(g, idm);
      const row = el(`<div class="split-row">
        ${avatarHtml(m, "sm")}
        <span class="nm">${esc(displayName(m))}</span>
        <input class="in money" type="number" min="0" step="${s.mode === "shares" ? "1" : "0.01"}" inputmode="decimal" placeholder="0" value="${esc(s.values.get(idm) ?? "")}" aria-label="${s.mode === "exact" ? "Amount" : s.mode === "percent" ? "Percentage" : "Shares"} for ${esc(displayName(m))}">
        <span class="unit">${unit}</span>
      </div>`);
      row.querySelector("input").addEventListener("input", (e) => {
        s.values.set(idm, e.target.value);
        updateValueHint();
      });
      valuesBox.append(row);
    }
    valuesBox.append(el(`<div class="hint x-valhint" role="status" aria-live="polite"></div>`));
    updateValueHint();
  }
  function updateValueHint() {
    const hint = $(".x-valhint", valuesBox);
    if (!hint) return;
    const ids = [...s.parts];
    const total = toPaise(s.amountStr) || 0;
    let text = "";
    let ok = false;
    if (s.mode === "items") {
      const filled = s.items.filter((it) => (toPaise(it.amountStr) || 0) > 0);
      const sum = filled.reduce((a, it) => a + toPaise(it.amountStr), 0);
      const orphan = filled.some((it) => !it.ids.size);
      ok = sum > 0 && !orphan;
      text = orphan
        ? "Pick who had each item"
        : !sum
          ? "Add what each item cost"
          : !total || total === sum
            ? `Items come to ${entry(sum)}${!total ? ", which becomes the total" : ", the whole bill"}`
            : total > sum
              ? `Items ${entry(sum)}. The other ${entry(total - sum)} (tax, service, tip) is shared in proportion.`
              : `Items ${entry(sum)}. The ${entry(sum - total)} off the bill is shared out in proportion.`;
    } else if (s.mode === "exact") {
      const sum = ids.reduce((a, idm) => a + (toPaise(s.values.get(idm)) || 0), 0);
      const left = total - sum;
      ok = left === 0 && total > 0;
      text = ok ? "Adds up perfectly" : left > 0 ? `${entry(left)} left to assign` : `${entry(-left)} over the total`;
    } else if (s.mode === "percent") {
      const values = ids.map((idm) => Number(s.values.get(idm) || 0));
      const invalid = values.some((value) => !Number.isFinite(value) || value < 0);
      const sum = values.reduce((a, value) => a + value, 0);
      ok = !invalid && Math.abs(sum - 100) < 0.01;
      text = invalid ? "Percentages cannot be negative" : ok ? "That's 100%" : `${sum}% assigned, needs 100%`;
    } else {
      const values = ids.map((idm) => Number(s.values.get(idm) || 0));
      const invalid = values.some((value) => !Number.isFinite(value) || value < 0);
      const sum = values.reduce((a, value) => a + value, 0);
      ok = !invalid && sum > 0;
      text = invalid ? "Shares cannot be negative" : ok ? `${sum} shares total` : "Give at least one share";
    }
    hint.className = `hint x-valhint ${ok ? "good" : "bad"}`;
    hint.textContent = text;
  }
  renderValues();

  /* proof */
  const thumbs = $(".x-thumbs", body);
  const fileIn = $(".x-file", body);
  function renderThumbs() {
    thumbs.replaceChildren();
    s.att.forEach((a, i) => {
      const button = a.id
        ? el(`<button class="thumb-button pressable" aria-label="View proof ${i + 1}"><img class="thumb" data-att="${a.id}" alt=""></button>`)
        : el(`<button class="thumb-button pressable" aria-label="View proof ${i + 1}"><img class="thumb" src="${a.url}" alt=""></button>`);
      button.addEventListener("click", async () => {
        openViewer(a.id ? await attUrl(a.id) : a.url, {
          onRemove: () => {
            s.att.splice(i, 1);
            renderThumbs();
          },
        });
      });
      thumbs.append(button);
    });
    if (s.att.length < store.LIMITS.attachments) {
      const add = el(`<button class="thumb-add pressable" aria-label="Attach proof">${I.camera}</button>`);
      add.addEventListener("click", () => fileIn.click());
      thumbs.append(add);
    }
    hydrate(thumbs);
  }
  fileIn.addEventListener("change", () => {
    const room = Math.max(0, store.LIMITS.attachments - s.att.length);
    const files = [...fileIn.files];
    if (files.length > room) toast(`Up to ${store.LIMITS.attachments} proofs can be attached`);
    for (const f of files.slice(0, room)) s.att.push({ blob: f, url: URL.createObjectURL(f), name: f.name });
    fileIn.value = "";
    renderThumbs();
  });
  renderThumbs();

  const foot = el(`<button class="btn primary">${existing ? "Save changes" : "Add expense"}</button>`);
  openSheet({ title: existing ? "Edit expense" : "Add expense", body, footer: foot });
  if (!existing) setTimeout(() => amountIn.focus(), 350);

  foot.addEventListener("click", async () => {
    const foreign = s.cur !== "INR";
    const rate = foreign ? s.rate : 1;
    if (foreign && !(rate > 0)) {
      editingRate = true;
      drawFx();
      return toast(`Enter how many rupees one ${s.cur} is`);
    }
    // Everything typed is in the entry currency; convert once, at the end,
    // spreading rupees over the typed parts so every total stays exact.
    const itemRows = s.items
      .map((it) => ({ name: it.name.trim().slice(0, 120), cents: toPaise(it.amountStr) || 0, ids: [...it.ids] }))
      .filter((it) => it.cents > 0);
    let totalCents = toPaise(s.amountStr);
    if (s.mode === "items" && !(totalCents > 0)) totalCents = itemRows.reduce((a, it) => a + it.cents, 0);
    if (!Number.isFinite(totalCents) || totalCents <= 0) return toast("Enter the amount first");
    const amountP = foreign ? toInrPaise(totalCents, rate) : totalCents;
    if (!(amountP > 0)) return toast("That amount is too small to record");
    const desc = s.desc.trim();
    if (!desc) return toast("Give it a name");
    if (s.att.length > store.LIMITS.attachments) return toast(`Remove proofs until ${store.LIMITS.attachments} remain`);
    const toRupees = (partsCents) => (foreign ? spreadInr(amountP, partsCents) : partsCents);

    let split;
    if (s.mode === "items") {
      if (!itemRows.length) return toast("Add what each item cost");
      if (itemRows.some((it) => !it.ids.length)) return toast("Pick who had each item");
      const itemsCents = itemRows.map((it) => it.cents);
      const itemsP = foreign ? spreadInr(toInrPaise(itemsCents.reduce((a, v) => a + v, 0), rate), itemsCents) : itemsCents;
      const everyone = [...new Set(itemRows.flatMap((it) => it.ids))];
      split = {
        mode: "items",
        participants: everyone.map((memberId) => ({ memberId })),
        items: itemRows.map((it, i) => ({ name: it.name, amountP: itemsP[i], memberIds: it.ids })),
      };
    } else {
      const ids = [...s.parts];
      if (!ids.length) return toast("Pick who shares this");
      let participants;
      if (s.mode === "equal") participants = ids.map((idm) => ({ memberId: idm }));
      else if (s.mode === "exact") {
        const cents = ids.map((idm) => toPaise(s.values.get(idm)) || 0);
        if (cents.reduce((a, v) => a + v, 0) !== totalCents) return toast("Exact amounts must add up to the total");
        const rupees = toRupees(cents);
        participants = ids.map((idm, i) => ({ memberId: idm, valueP: rupees[i] }));
      } else {
        const rows = ids.map((idm) => ({ memberId: idm, value: Number(s.values.get(idm) || 0) }));
        if (rows.some((row) => !Number.isFinite(row.value) || row.value < 0)) return toast("Split values cannot be negative");
        const sum = rows.reduce((a, r) => a + r.value, 0);
        if (s.mode === "percent" && Math.abs(sum - 100) > 0.01) return toast("Percentages must add up to 100");
        if (s.mode === "shares" && sum <= 0) return toast("Give at least one share");
        participants = rows;
      }
      split = { mode: s.mode, participants };
    }

    let payers;
    if (!s.multi) payers = [{ memberId: s.payers[0].memberId, amountP }];
    else {
      const rows = s.payers.map((p) => ({ memberId: p.memberId, cents: toPaise(p.amountStr) || 0 })).filter((p) => p.cents > 0);
      if (!rows.length) return toast("Who paid?");
      if (rows.reduce((a, p) => a + p.cents, 0) !== totalCents) return toast("Payments must add up to the total");
      const rupees = toRupees(rows.map((p) => p.cents));
      payers = rows.map((p, i) => ({ memberId: p.memberId, amountP: rupees[i] }));
    }

    foot.disabled = true;
    const attIds = [];
    try {
      for (const a of s.att) attIds.push(a.id ?? (await store.addAttachment(a.blob, a.name)));
    } catch {
      foot.disabled = false;
      return toast("That proof image is too large to back up. Try a screenshot or smaller photo.");
    }

    const repeat = s.repeat === "none" ? null : makeRepeat(s.repeat, s.date);
    const fx = foreign ? { currency: s.cur, amount: totalCents / 100, rate } : null;
    const data = {
      desc,
      amountP,
      category: s.category,
      date: s.date,
      payers,
      split,
      attachments: attIds,
      notes: s.notes.trim(),
    };
    if (existing) {
      data.repeat = repeat;
      data.fx = fx;
      // Turning a copy from an old series into a schedule of its own.
      if (repeat && !existing.repeat && existing.seriesId && existing.seriesId !== existing.id) data.seriesId = existing.id;
    } else {
      if (repeat) data.repeat = repeat;
      if (fx) data.fx = fx;
    }
    if (!existing) rememberCurrency(g, s.cur);

    if (s.saveDefault && split.mode !== "items" && split.mode !== "exact") {
      await store.setDefaultSplit(g, split);
    }

    if (existing) {
      const changes = [];
      if (existing.amountP !== amountP) changes.push(`amount ${fmt(existing.amountP)} to ${fmt(amountP)}`);
      if (existing.desc !== desc) changes.push(`renamed from ${existing.desc}`);
      if (dayKey(existing.date) !== dayKey(s.date)) changes.push(`date to ${dayLabel(s.date)}`);
      if (existing.split.participants.length !== split.participants.length)
        changes.push(`${existing.split.participants.length} to ${split.participants.length} people`);
      if (existing.split.mode !== split.mode) changes.push(`split ${MODE_LABEL[split.mode]}`);
      if ((existing.fx?.currency ?? "INR") !== s.cur) changes.push(`currency to ${s.cur}`);
      if ((existing.repeat?.freq ?? "none") !== s.repeat) changes.push(repeat ? `repeats ${freqOf(s.repeat).label.toLowerCase()}` : "stopped repeating");
      if ((existing.attachments?.length ?? 0) !== attIds.length) changes.push("proof updated");
      await store.updateExpense(g, existing, data, changes.join(", ") || "details updated");
      closeSheet();
      toast("Saved");
      if (repeat) postDue();
    } else {
      await store.addExpense(g, data);
      if (repeat) postDue();
      closeSheet();
      toast(`${fmt(amountP)} added${repeat ? `, repeats ${freqOf(s.repeat).label.toLowerCase()}` : ""}`);
    }
  });
}

/* ---------- expense detail ---------- */

function commentRow(ev) {
  return el(`<div class="comment">
    ${avatarHtml({ name: ev.actor }, "sm")}
    <div><div class="comment-head"><b>${esc(ev.actor)}</b><span>${dayLabel(ev.ts)}, ${timeLabel(ev.ts)}</span></div>
      <p>${esc(ev.summary)}</p></div>
  </div>`);
}

function expenseDetailSheet(g, e, { onRestore } = {}) {
  const shares = computeShares(e);
  const paidBy = e.payers
    .map((p) => `${displayName(store.memberOf(g, p.memberId))}${e.payers.length > 1 ? " " + fmt(p.amountP) : ""}`)
    .join(", ");
  const next = e.repeat ? nextDate(e.date, e.repeat) : null;
  const items = e.split.mode === "items" ? (e.split.items ?? []) : [];
  const itemsTotal = items.reduce((a, it) => a + it.amountP, 0);

  const body = el(`<div>
    ${e.deleted ? `<div class="status-note deleted">${I.trash}<span><strong>Deleted ${dayPhrase(e.updatedAt ?? e.date)}</strong><small>It counts towards no balance until it's brought back.</small></span></div>` : ""}
    <div class="expense-hero">
      <div class="expense-hero-top"><span>${catIcon(e.category)}${esc(catOf(e.category).label)}</span><span>${dayLabel(e.date)}</span></div>
      <div class="val money">${heroMoney(e.amountP)}</div>
      ${e.fx ? `<div class="fx-was">${esc(fmtForeign(e.fx.amount, e.fx.currency))} at ${fmt(Math.round(e.fx.rate * 100))} per ${esc(e.fx.currency)}</div>` : ""}
      <div class="note">Paid by ${esc(paidBy)}. Split ${MODE_LABEL[e.split.mode] ?? ""} between ${e.split.participants.length}.</div>
      ${e.notes ? `<blockquote>${esc(e.notes)}</blockquote>` : ""}
      ${e.repeat && !e.deleted && next ? `<div class="status-note">${I.repeat}<span><strong>Repeats ${freqOf(e.repeat.freq)?.label.toLowerCase() ?? ""}</strong><small>The next one is added ${dayPhrase(next)}</small></span><button class="btn quiet small detail-stop">Stop</button></div>` : ""}
      ${e.deleted ? "" : `<div class="proof-status ${e.attachments?.length ? "has-proof" : "no-proof"}">${e.attachments?.length ? `${I.clip}<span><strong>Proof attached</strong><small>${e.attachments.length} image${e.attachments.length === 1 ? "" : "s"} kept with this expense</small></span>` : `${I.receipt}<span><strong>No proof attached</strong><small>Add the receipt now or whenever you find it</small></span><button class="btn quiet small detail-add-proof">Add</button>`}</div>`}
    </div>
    <div class="x-items"></div>
    <div class="section-cap">Who owes what</div>
    <div class="list x-shares"></div>
    <div class="x-proofwrap"></div>
    <div class="section-cap">Comments</div>
    <div class="x-comments"></div>
    <div class="comment-box">
      <label class="sr-only" for="x-comment">Add a comment</label>
      <input class="in" id="x-comment" placeholder="Add a comment" maxlength="${store.LIMITS.comment}" autocomplete="off">
      <button class="icon-btn comment-send" aria-label="Post comment">${I.send}</button>
    </div>
    <div class="x-trailwrap"></div>
  </div>`);

  if (items.length) {
    const wrap = $(".x-items", body);
    wrap.append(el(`<div class="section-cap">Items</div>`));
    const list = el(`<div class="list ruled"></div>`);
    items.forEach((it, i) => {
      list.append(el(`<div class="row item-line">
        <span class="grow"><span class="ttl">${esc(it.name || `Item ${i + 1}`)}</span>
          <span class="cap">${esc(it.memberIds.map((id) => displayName(store.memberOf(g, id))).join(", "))}</span></span>
        <span class="end"><span class="amt money">${fmt(it.amountP)}</span></span>
      </div>`));
    });
    const extra = e.amountP - itemsTotal;
    if (extra) {
      list.append(el(`<div class="row item-line">
        <span class="grow"><span class="ttl">${extra > 0 ? "Tax, service and tip" : "Discount"}</span><span class="cap">Shared in proportion to the items</span></span>
        <span class="end"><span class="amt money">${extra > 0 ? "" : "−"}${fmt(Math.abs(extra))}</span></span>
      </div>`));
    }
    wrap.append(list);
  }

  const sl = $(".x-shares", body);
  for (const p of e.split.participants) {
    const m = store.memberOf(g, p.memberId);
    const paid = e.payers.filter((x) => x.memberId === p.memberId).reduce((a, x) => a + x.amountP, 0);
    sl.append(el(`<div class="row" style="min-height:54px">
      ${avatarHtml(m, "sm")}
      <span class="grow"><span class="ttl" style="font-size:14.5px">${esc(displayName(m))}</span>
        ${paid ? `<span class="cap">paid ${fmt(paid)}</span>` : ""}</span>
      <span class="end"><span class="amt money">${fmt(shares.get(p.memberId) ?? 0)}</span></span>
    </div>`));
  }

  if (e.attachments?.length) {
    const wrap = $(".x-proofwrap", body);
    wrap.append(el(`<div class="section-cap">Proof</div>`));
    const t = el(`<div class="thumbs proof-gallery"></div>`);
    for (const [index, id] of e.attachments.entries()) {
      const button = el(`<button class="thumb-button pressable" aria-label="View proof ${index + 1}"><img class="thumb" data-att="${id}" alt=""></button>`);
      button.addEventListener("click", async () => openViewer(await attUrl(id)));
      t.append(button);
    }
    wrap.append(t);
  }

  const commentsBox = $(".x-comments", body);
  const drawComments = () => {
    const said = store.commentsOf(e.id);
    commentsBox.replaceChildren(...(said.length ? said.map(commentRow) : [el(`<p class="hint" style="margin-top:0">Ask about it here. Everyone in the group sees comments in the history.</p>`)]));
  };
  drawComments();
  const commentIn = $("#x-comment", body);
  const send = async () => {
    const text = commentIn.value.trim();
    if (!text) return;
    commentIn.value = "";
    await store.addComment(g, e, text);
    drawComments();
  };
  $(".comment-send", body).addEventListener("click", send);
  commentIn.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      send();
    }
  });

  const evs = store.eventsOf(g.id).filter((ev) => ev.data?.expenseId === e.id && ev.type !== "comment");
  if (evs.length) {
    const wrap = $(".x-trailwrap", body);
    wrap.append(el(`<div class="section-cap">History</div>`));
    wrap.append(trailList(evs, false, false));
  }

  const foot = e.deleted
    ? el(`<button class="btn primary">${I.undo} Bring it back</button>`)
    : el(`<div class="btn-row">
        <button class="btn ghost">${I.pen} Edit</button>
        <button class="btn danger">${I.trash} Delete</button>
      </div>`);
  openSheet({ title: e.desc, body, footer: foot });

  if (e.deleted) {
    foot.addEventListener("click", async () => {
      foot.disabled = true;
      await store.restoreExpense(g, e);
      closeSheet(false, onRestore);
      toast(`${e.desc} is back`);
    });
    return;
  }

  $(".detail-add-proof", body)?.addEventListener("click", () => {
    closeSheet(false, () => expenseSheet(g, e));
  });
  $(".detail-stop", body)?.addEventListener("click", async (ev) => {
    ev.currentTarget.disabled = true;
    await store.stopRepeating(g, e);
    $(".detail-stop", body)?.closest(".status-note")?.remove();
    toast("It won't repeat any more");
  });
  foot.querySelector(".ghost").addEventListener("click", () => {
    closeSheet(false, () => expenseSheet(g, e));
  });
  armDanger(foot.querySelector(".danger"), async () => {
    const repeating = Boolean(e.repeat);
    await store.deleteExpense(g, e);
    closeSheet();
    toast(repeating ? "Deleted, and it stops repeating. Bring it back from the group menu." : "Deleted. Bring it back from the group menu.");
  });
}

/* ---------- settle sheet ---------- */

function settleSheet(g, fromId, toId, amountP) {
  const from = store.memberOf(g, fromId);
  const to = store.memberOf(g, toId);
  const att = [];

  const body = el(`<div>
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:12px 0 2px">
      <span style="display:flex;flex-direction:column;align-items:center;gap:7px">${avatarHtml(from)}<b style="font-size:13px">${esc(displayName(from))}</b></span>
      <span class="dim" style="width:24px">${I.arrowR}</span>
      <span style="display:flex;flex-direction:column;align-items:center;gap:7px">${avatarHtml(to)}<b style="font-size:13px">${esc(displayName(to))}</b></span>
    </div>
    <div class="amount-shell"><span aria-hidden="true">₹</span><input class="amount-in money" inputmode="decimal" value="${esc(fromPaise(amountP))}" aria-label="Amount"></div>
    ${from?.isYou && to.upi
      ? `<a class="btn ghost" id="se-upi">${I.upi} Pay ${esc(displayName(to))} via UPI</a>
         <div class="hint" style="text-align:center">Opens your UPI app with the amount filled in. Settld does not process the payment.</div>`
      : from?.isYou
        ? `<div class="hint" style="text-align:center">${esc(displayName(to))} has no UPI ID saved. Add one under People, or record the payment after paying another way.</div>`
        : to?.isYou
          ? `<a class="btn ghost" id="se-remind" target="_blank" rel="noopener">${I.send} Remind ${esc(displayName(from))} on WhatsApp</a>
             <div class="hint" style="text-align:center">Record this only after ${esc(displayName(from))} has paid you.</div>`
          : `<div class="hint" style="text-align:center">Record this only after ${esc(displayName(from))} confirms the payment.</div>`}
    <label class="cap-label">Payment proof <span class="dim">(screenshot, optional)</span></label>
    <div class="thumbs se-thumbs"></div>
    <input type="file" accept="image/*" multiple hidden class="se-file">
    <label class="cap-label" for="se-note">Note <span class="dim">(optional)</span></label>
    <input class="in" id="se-note" placeholder="GPay, cash, adjusted in rent" maxlength="${store.LIMITS.settlementNote}">
  </div>`);

  const amountIn = $(".amount-in", body);
  const upiBtn = $("#se-upi", body);
  const remindBtn = $("#se-remind", body);
  const setUpi = () => {
    const p = toPaise(amountIn.value) || 0;
    if (remindBtn) remindBtn.href = remindLink(from.name, p, g.emoji === "person" ? "" : g.name);
    if (!upiBtn) return;
    upiBtn.href = upiLink({ vpa: to.upi, name: to.name, amountP: p, note: `Settld · ${g.name}` });
  };
  setUpi();
  amountIn.addEventListener("input", setUpi);

  const thumbs = $(".se-thumbs", body);
  const fileIn = $(".se-file", body);
  function renderThumbs() {
    thumbs.replaceChildren();
    att.forEach((a, i) => {
      const button = el(`<button class="thumb-button pressable" aria-label="View proof ${i + 1}"><img class="thumb" src="${a.url}" alt=""></button>`);
      button.addEventListener("click", () =>
        openViewer(a.url, { onRemove: () => { att.splice(i, 1); renderThumbs(); } }),
      );
      thumbs.append(button);
    });
    if (att.length < store.LIMITS.attachments) {
      const add = el(`<button class="thumb-add pressable" aria-label="Attach proof">${I.camera}</button>`);
      add.addEventListener("click", () => fileIn.click());
      thumbs.append(add);
    }
  }
  fileIn.addEventListener("change", () => {
    const room = Math.max(0, store.LIMITS.attachments - att.length);
    const files = [...fileIn.files];
    if (files.length > room) toast(`Up to ${store.LIMITS.attachments} proofs can be attached`);
    for (const f of files.slice(0, room)) att.push({ blob: f, url: URL.createObjectURL(f), name: f.name });
    fileIn.value = "";
    renderThumbs();
  });
  renderThumbs();

  const foot = el(`<button class="btn primary">${I.check} Mark as paid</button>`);
  openSheet({ title: "Record payment", body, footer: foot });

  foot.addEventListener("click", async () => {
    const p = toPaise(amountIn.value);
    if (!Number.isFinite(p) || p <= 0) return toast("Enter the amount");
    foot.disabled = true;
    const ids = [];
    try {
      for (const a of att) ids.push(await store.addAttachment(a.blob, a.name));
    } catch {
      foot.disabled = false;
      return toast("That proof image is too large to back up. Try a screenshot or smaller photo.");
    }
    await store.addSettlement(g, {
      fromId,
      toId,
      amountP: p,
      note: $("#se-note", body).value.trim(),
      attachments: ids,
    });
    closeSheet();
    toast(`${fmt(p)} payment recorded`);
  });
}

/* ---------- search ---------- */

function searchSheet(scope) {
  const body = el(`<div>
    <div class="search-field">
      ${I.search}
      <input class="in" type="search" placeholder="${scope ? `Search ${esc(scope.name)}` : "Search every group"}" aria-label="Search expenses" autocomplete="off" enterkeyhint="search">
    </div>
    <div class="search-results" role="status" aria-live="polite"></div>
  </div>`);
  const input = $("input", body);
  const results = $(".search-results", body);
  const clean = (text) => String(text ?? "").toLowerCase().replace(/[₹,]/g, "");
  const haystack = (e, g) =>
    clean(
      [
        e.desc,
        e.notes,
        catOf(e.category).label,
        g.name,
        ...e.payers.map((p) => store.memberOf(g, p.memberId)?.name ?? ""),
        ...(e.split.items ?? []).map((it) => it.name),
        fromPaise(e.amountP),
        e.fx ? `${e.fx.currency} ${e.fx.amount}` : "",
      ].join(" "),
    );
  const draw = () => {
    const words = clean(input.value).split(/\s+/).filter(Boolean);
    results.replaceChildren();
    if (!words.length) {
      results.append(el(`<p class="hint">Search by name, note, person, category, item or amount.</p>`));
      return;
    }
    const hits = store.state.expenses
      .filter((e) => !scope || e.groupId === scope.id)
      .map((e) => ({ e, g: store.groupById(e.groupId) }))
      .filter(({ e, g }) => g && words.every((w) => haystack(e, g).includes(w)))
      .sort((a, b) => Number(a.e.deleted) - Number(b.e.deleted) || b.e.date - a.e.date);
    if (!hits.length) {
      results.append(el(`<p class="hint">Nothing matches “${esc(input.value.trim())}”.</p>`));
      return;
    }
    results.append(el(`<div class="section-cap" style="margin-top:18px">${hits.length} expense${hits.length === 1 ? "" : "s"}</div>`));
    const list = el(`<div class="list ex-list"></div>`);
    for (const { e, g } of hits.slice(0, 80)) {
      const row = el(`<button class="ex-row pressable">
        <span class="ico">${catIcon(e.category)}</span>
        <span class="m"><b>${esc(e.desc)}</b><span>${scope ? "" : `${esc(g.name)} · `}${dayLabel(e.date)}${e.deleted ? ` <span class="badge edited">Deleted</span>` : ""}</span></span>
        <span class="e"><b class="money">${fmt(e.amountP)}</b>${e.fx ? `<span>${esc(fmtForeign(e.fx.amount, e.fx.currency))}</span>` : ""}</span>
      </button>`);
      row.addEventListener("click", () => expenseDetailSheet(g, e));
      list.append(row);
    }
    results.append(list);
  };
  input.addEventListener("input", draw);
  draw();
  openSheet({ title: "Search", body });
  setTimeout(() => input.focus(), 320);
}

/* ---------- import from Splitwise ---------- */

function importSheet() {
  const body = el(`<div>
    <p class="hint" style="margin-top:4px">Settld reads the spreadsheet Splitwise exports for a group, and the balances come across exactly as they were.</p>
    <ol class="steps">
      <li>In Splitwise, open the group and find <b>Export as spreadsheet</b> in its settings.</li>
      <li>Save the CSV file it gives you.</li>
      <li>Pick that file here. It's read on this device.</li>
    </ol>
    <input type="file" accept=".csv,text/csv,text/comma-separated-values" hidden class="imp-file">
  </div>`);
  const fileIn = $(".imp-file", body);
  const foot = el(`<button class="btn primary">${I.upload} Choose the CSV file</button>`);
  foot.addEventListener("click", () => fileIn.click());
  fileIn.addEventListener("change", async () => {
    const file = fileIn.files?.[0];
    fileIn.value = "";
    if (!file) return;
    let parsed;
    try {
      parsed = parseSplitwise(await file.text());
    } catch (error) {
      return toast(error?.code === "splitwise/no-people" ? "That export has fewer than two people in it" : "That file isn't a Splitwise export");
    }
    if (!parsed.entries.length) return toast("That export has no expenses in it");
    closeSheet(false, () => importPreviewSheet(parsed, file.name));
  });
  openSheet({ title: "Bring a group from Splitwise", body, footer: foot });
}

function importPreviewSheet(parsed, fileName) {
  const me = (store.state.profile?.name ?? "").trim().toLowerCase();
  const first = me.split(/\s+/)[0];
  let youIndex = parsed.members.findIndex((n) => n.trim().toLowerCase() === me);
  if (youIndex < 0 && first) youIndex = parsed.members.findIndex((n) => n.trim().toLowerCase().split(/\s+/)[0] === first);
  const expenses = parsed.entries.filter((x) => !x.payment).length;
  const payments = parsed.entries.length - expenses;
  const foreign = [...new Set(parsed.entries.map((x) => x.currency).filter((c) => c !== "INR"))];

  const body = el(`<div>
    <label class="cap-label" for="ip-name" style="margin-top:4px">Group name</label>
    <input class="in" id="ip-name" value="${esc(nameFromFile(fileName))}" maxlength="${store.LIMITS.groupName}">
    <label class="cap-label">Icon</label>
    <div class="ip-icon"></div>
    <label class="cap-label">Which one is you?</label>
    <div class="chips ip-you" role="group" aria-label="Which one is you"></div>
    <div class="section-cap">What comes across</div>
    <div class="list ruled">
      <div class="row"><span class="tile">${I.receipt}</span><span class="grow"><span class="ttl">${expenses} expense${expenses === 1 ? "" : "s"}</span><span class="cap">With who paid and each person's share</span></span></div>
      <div class="row"><span class="tile">${I.check}</span><span class="grow"><span class="ttl">${payments} payment${payments === 1 ? "" : "s"}</span><span class="cap">Recorded as settled</span></span></div>
      ${foreign.length ? `<div class="row"><span class="tile">${I.globe}</span><span class="grow"><span class="ttl">${esc(foreign.join(", "))}</span><span class="cap">Converted to rupees at today's rate</span></span></div>` : ""}
    </div>
    ${parsed.skipped ? `<div class="hint">${parsed.skipped} row${parsed.skipped === 1 ? "" : "s"} couldn't be read and will be left out.</div>` : ""}
  </div>`);
  const icon = iconChips("ledger");
  $(".ip-icon", body).append(icon);
  const youBox = $(".ip-you", body);
  const drawYou = () => {
    youBox.replaceChildren();
    parsed.members.forEach((name, i) => {
      const on = i === youIndex;
      const chip = el(`<button class="chip ${on ? "on" : ""}" aria-pressed="${on}">${avatarHtml({ name }, "sm")} ${esc(name)}</button>`);
      chip.addEventListener("click", () => {
        youIndex = i;
        drawYou();
      });
      youBox.append(chip);
    });
  };
  drawYou();

  const foot = el(`<button class="btn primary">Import the group</button>`);
  openSheet({ title: "Check the import", body, footer: foot });
  foot.addEventListener("click", async () => {
    const name = $("#ip-name", body).value.trim();
    if (!name) return toast("Give the group a name");
    if (youIndex < 0) return toast("Pick which one is you");
    foot.disabled = true;
    foot.textContent = foreign.length ? "Getting today's rates" : "Importing";
    const rates = {};
    for (const code of foreign) rates[code] = (await rateFor(code))?.rate;
    const result = await store.importGroup({
      name,
      icon: icon.querySelector(".on")?.dataset.e ?? "ledger",
      memberNames: parsed.members,
      youIndex,
      source: "Splitwise",
      build: (ids) => buildImport(parsed, ids, rates),
    });
    // With no conversions and nothing skipped, the balances must equal the
    // export's own "Total balance" row; say so, or say that they don't.
    let check = "";
    if (parsed.total && !result.converted && !result.skipped) {
      const { bal } = groupCalc(result.group);
      const same = result.memberIds.every((id, i) => (bal.get(id) ?? 0) === parsed.total[i]);
      check = same ? " Balances match Splitwise." : " Some balances differ from Splitwise; check the group.";
    } else if (result.skipped) {
      check = ` ${result.skipped} row${result.skipped === 1 ? " was" : "s were"} left out.`;
    }
    closeSheet(false, () => (location.hash = `#/group/${result.group.id}`));
    toast(`Imported ${result.expenses.length} expenses and ${result.settlements.length} payments.${check}`);
  });
}
/* ---------- boot ---------- */

applyTheme(localStorage.getItem("settld-theme") ?? "dark");
applyAccent(localStorage.getItem("settld-accent") ?? "coral");
initDock();
store.subscribe(render);
// Repeating expenses are posted once a sync has pulled what other devices and
// members already posted, so a month is never added twice.
const postDue = () => store.postRecurring().catch(() => {});
cloud.setOnSynced(() => store.init().then(postDue));
cloud.setOnStatus(() => {
  if (store.state.ready) render();
});
cloud.onAuth((signedIn) => {
  if (store.state.ready) render();
  if (signedIn && store.state.ready && !interactiveAuth) scheduleAuthRestore();
});
store.init().then(async () => {
  applyTheme(store.state.profile?.theme ?? localStorage.getItem("settld-theme") ?? "dark");
  applyAccent(store.state.profile?.accent ?? localStorage.getItem("settld-accent") ?? "coral");
  render();
  if (cloud.cloudReady) {
    try {
      await cloud.initCloud();
      await Promise.race([cloud.authReady, new Promise((resolve) => setTimeout(resolve, 5000))]);
      if (cloud.currentUser()) await authRestoreTask;
      if (cloud.takePendingDeletion()) {
        await finishAccountDeletion();
        return;
      }
    } catch {
      /* local mode remains fully usable when Firebase cannot load */
    }
  }
  await postDue();
  if (!store.state.profile) welcomeSheet();
});

// Shared groups are pulled when the app comes back to the foreground rather
// than held open on a live listener, which keeps read volume inside the free
// Firestore tier no matter how many groups a person is in.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (!cloud.currentUser() || !navigator.onLine) return void postDue();
  cloud.syncSharedGroups().catch(() => {}).then(postDue);
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
