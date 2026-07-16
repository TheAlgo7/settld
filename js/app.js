// Settld UI. Proof-first coral product system with large headers, grouped
// records, bottom sheets, and a restrained floating dock. Plain DOM only.

import * as store from "./store.js";
import * as cloud from "./cloud.js";
import { fmt, toPaise, fromPaise, computeShares } from "./money.js";
import { computeBalances, simplify, totalSpend, upiLink } from "./settle.js";

/* ---------- constants ---------- */

const CATS = [
  { id: "food", label: "Food", emoji: "🍜" },
  { id: "travel", label: "Travel", emoji: "🚕" },
  { id: "stay", label: "Stay", emoji: "🏨" },
  { id: "tickets", label: "Tickets", emoji: "🎟️" },
  { id: "groceries", label: "Groceries", emoji: "🛒" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "other", label: "Other", emoji: "🧾" },
];
const catOf = (id) => CATS.find((c) => c.id === id) ?? CATS[CATS.length - 1];
const GROUP_EMOJIS = ["🏝️", "🏠", "🍕", "🎉", "✈️", "🎬", "🏔️", "💼"];

const I = {
  groups: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M7.5 9.5h9M7.5 13.5h6"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12h4L10 5.5l4 13 2.5-6.5h4"/></svg>',
  settle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7.5h11.5M13.5 4.5l3 3-3 3M19 16.5H7.5M10.5 13.5l-3 3 3 3"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.5-4 2.8-6 6.5-6s6 2 6.5 6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 9 9h-9Z"/><path d="M15 3.5A7.5 7.5 0 0 1 20.5 9H15Z"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="15" cy="7" r="2.4" fill="var(--surface)"/><circle cx="9" cy="12" r="2.4" fill="var(--surface)"/><circle cx="16" cy="17" r="2.4" fill="var(--surface)"/></svg>',
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
};
const evIcon = { expense: "receipt", edit: "pen", delete: "trash", settle: "check", member: "plus", group: "plus" };

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
  return `<span class="avatar ${cls}" style="background:hsl(${hueOf(name)} 42% 26%)">${esc(initials(name))}</span>`;
};
const avatarStackHtml = (members) =>
  `<span class="avatar-stack">${members.slice(0, 4).map((m) => avatarHtml(m, "sm")).join("")}${members.length > 4 ? `<span class="avatar sm avatar-more">+${members.length - 4}</span>` : ""}</span>`;
const displayName = (m) => (m?.isYou ? "You" : (m?.name ?? "?"));

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
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

/* ---------- theme ---------- */

function applyTheme(pref) {
  const resolved =
    pref === "system"
      ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : pref || "dark";
  document.documentElement.dataset.theme = resolved;
  $('meta[name="theme-color"]').setAttribute("content", resolved === "light" ? "#F3F0EA" : "#090A0B");
  localStorage.setItem("settld-theme", pref || "dark");
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
  if (!top || top.locked) {
    if (top?.locked) return;
    return;
  }
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
    activity: ["Activity", I.pulse],
    settlements: ["Settlements", I.settle],
    settings: ["You", I.user],
  };
  for (const a of document.querySelectorAll("#dock a")) {
    const [label, icon] = tabs[a.dataset.tab];
    a.innerHTML = `${icon}<span>${label}</span>`;
  }
}

/* ---------- router ---------- */

const ui = { groupTab: new Map() };
let lastRouteKey = "";

function parseRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  if (h.startsWith("group/")) return { name: "group", id: h.slice(6) };
  if (h === "activity") return { name: "activity" };
  if (h === "settlements") return { name: "settlements" };
  if (h === "settings") return { name: "settings" };
  return { name: "home" };
}

function render() {
  if (!store.state.ready) return;
  const route = parseRoute();
  const key = route.name + (route.id ?? "");
  const keepScroll = key === lastRouteKey;
  const y = scrollY;
  lastRouteKey = key;

  const screen = document.getElementById("screen");
  let view;
  if (route.name === "group") view = GroupScreen(route.id);
  else if (route.name === "activity") view = ActivityScreen();
  else if (route.name === "settlements") view = SettlementsScreen();
  else if (route.name === "settings") view = SettingsScreen();
  else view = HomeScreen();

  screen.replaceChildren(view);
  if (!keepScroll) view.classList.add("enter");
  hydrate(view);

  const dock = $("#dock");
  dock.classList.toggle("off", route.name === "group");
  for (const a of dock.querySelectorAll("a")) {
    const active = a.dataset.tab === (route.name === "home" ? "home" : route.name);
    a.classList.toggle("on", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  scrollTo(0, keepScroll ? y : 0);
}

addEventListener("hashchange", render);
addEventListener("online", render);
addEventListener("offline", render);

/* ---------- screens ---------- */

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

function HomeScreen() {
  const name = store.state.profile?.name?.split(/\s+/)[0] ?? "there";
  const sync = syncState();
  let overall = 0;
  const rows = store.state.groups.map((g) => {
    const you = store.youOf(g);
    const { bal, spend, exps } = groupCalc(g);
    const net = bal.get(you?.id) ?? 0;
    overall += net;
    return { g, net, spend, count: exps.length };
  });

  const sub =
    rows.length === 0
      ? store.state.profile?.name
        ? `Ready when you are, ${esc(name)}.`
        : "Ready when you are."
      : overall === 0
        ? "Everything is clear. Hisab barabar."
        : overall > 0
          ? `Across your groups, you get <b class="pos money">${fmt(overall)}</b>`
          : `Across your groups, you owe <b class="money">${fmt(-overall)}</b>`;

  const view = el(`<div class="screen-home">
    <div class="display home-display">
      <div class="brand-line"><span class="brand-symbol">${MARK}</span><span class="brand-name">Settld</span>
        <span class="device-status ${sync.cls}"><i></i>${sync.label}</span></div>
      <h1>Groups</h1><div class="sub">${sub}</div>
    </div>
    <div class="home-body"></div>
  </div>`);
  const body = $(".home-body", view);

  if (!rows.length) {
    const empty = el(`<div class="empty empty-first-group">
      <div class="mark">${MARK}</div>
      <h3>Your first shared ledger</h3>
      <p>Create one for a trip, a flat, or tonight's dinner. Every receipt and edit stays with the expense.</p>
      <button class="btn primary" id="e-new">${I.plus} Create a group</button>
      <button class="btn quiet" id="e-demo">Explore a sample trip</button>
    </div>`);
    $("#e-new", empty).addEventListener("click", () => newGroupSheet());
    $("#e-demo", empty).addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      const g = await store.seedDemo();
      toast("Sample trip added");
      location.hash = `#/group/${g.id}`;
    });
    body.append(empty);
  } else {
    const list = el(`<div class="list group-list" style="margin-top:26px"></div>`);
    for (const { g, net, spend, count } of rows) {
      const endHtml =
        net === 0
          ? `<span class="balance-label">All settled</span>`
          : net > 0
            ? `<span class="balance-label">You get</span><span class="amt money pos">${fmt(net)}</span>`
            : `<span class="balance-label">You owe</span><span class="amt money debt">${fmt(-net)}</span>`;
      const row = el(`<button class="row group-row pressable">
        <span class="tile group-tile">${esc(g.emoji ?? "🧾")}</span>
        <span class="grow"><span class="ttl">${esc(g.name)}</span>
          <span class="cap">${g.members.length} members · ${count} expense${count === 1 ? "" : "s"}</span></span>
        <span class="end">${endHtml}</span>
        <span class="chev">${I.chevR}</span>
      </button>`);
      row.addEventListener("click", () => (location.hash = `#/group/${g.id}`));
      list.append(row);
    }
    body.append(list);
    const nb = el(`<button class="btn primary home-new">${I.plus} New group</button>`);
    nb.addEventListener("click", () => newGroupSheet());
    body.append(nb);
  }

  setAppbar({ title: "Groups" });
  return view;
}

function ActivityScreen() {
  const events = store.allEvents();
  const view = el(`<div class="screen-activity">
    <div class="display"><h1>Activity</h1><div class="sub">Every add, edit, and payment stays visible.</div></div>
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

function SettlementsScreen() {
  const groups = store.state.groups
    .map((g) => {
      const { bal } = groupCalc(g);
      return { g, plan: simplify(bal) };
    })
    .filter(({ plan }) => plan.length);
  const transfers = groups.reduce((n, item) => n + item.plan.length, 0);
  const view = el(`<div class="screen-settlements">
    <div class="display"><h1>Settlements</h1>
      <div class="sub">${transfers ? `${transfers} transfer${transfers === 1 ? "" : "s"} can clear every current balance.` : "No payments are pending across your groups."}</div></div>
    <div class="settlements-body"></div>
  </div>`);
  const body = $(".settlements-body", view);

  if (!groups.length) {
    body.append(el(`<div class="empty"><div class="settle-seal">${I.check}</div><h3>All clear</h3><p>When a group has money left to clear, the simplest payment plan will show up here.</p></div>`));
  } else {
    for (const { g, plan } of groups) {
      const section = el(`<section class="settlement-group"><button class="section-heading link-heading"><div><h2>${esc(g.emoji ?? "🧾")} ${esc(g.name)}</h2><span class="section-cap">${plan.length} transfer${plan.length === 1 ? "" : "s"} to clear up</span></div><span class="chev">${I.chevR}</span></button><div class="list plain"></div></section>`);
      $(".link-heading", section).addEventListener("click", () => {
        ui.groupTab.set(g.id, "balances");
        location.hash = `#/group/${g.id}`;
      });
      const list = $(".list", section);
      const you = store.youOf(g);
      for (const t of plan) {
        const from = store.memberOf(g, t.fromId);
        const to = store.memberOf(g, t.toId);
        const relation =
          from?.id === you?.id
            ? `You pay ${displayName(to)}`
            : to?.id === you?.id
              ? `${displayName(from)} pays you`
              : `${displayName(from)} pays ${displayName(to)}`;
        const row = el(`<div class="row settle-row">
          <span class="avatar-pair">${avatarHtml(from, "sm")}${avatarHtml(to, "sm")}</span>
          <span class="grow"><span class="ttl">${esc(relation)}</span><span class="cap">Suggested by Smart settle</span></span>
          <span class="end"><span class="amt money">${fmt(t.amountP)}</span></span>
          <button class="btn secondary small">Record</button>
        </div>`);
        row.querySelector("button").addEventListener("click", () => settleSheet(g, t.fromId, t.toId, t.amountP));
        list.append(row);
      }
      body.append(section);
    }
  }

  setAppbar({ title: "Settlements" });
  return view;
}

function trailList(events, showGroup = false) {
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
    const gname = showGroup ? store.groupById(ev.groupId)?.name : null;
    list.append(el(`<div class="trail-row">
      <span class="trail-dot ${ev.type}">${I[evIcon[ev.type] ?? "receipt"]}</span>
      <span class="trail-txt">${esc(ev.summary)}
        <span class="cap">${gname ? esc(gname) + " · " : ""}${timeLabel(ev.ts)}</span></span>
    </div>`));
  }
  return box;
}

function SettingsScreen() {
  const p = store.state.profile ?? { name: "", upi: "", theme: "dark" };
  const view = el(`<div class="screen-you">
    <div class="display"><h1>You</h1><div class="sub">Profile, backup and preferences.</div></div>

    <div class="section-cap">You</div>
    <label class="cap-label" for="st-name">Your name</label>
    <input class="in" id="st-name" value="${esc(p.name)}" autocomplete="name" maxlength="${store.LIMITS.profileName}">
    <label class="cap-label" for="st-upi">Your UPI ID</label>
    <input class="in" id="st-upi" value="${esc(p.upi ?? "")}" placeholder="name@bank" autocapitalize="none" maxlength="${store.LIMITS.upi}">
    <div class="hint">Used only to create payment links. When signed in, it is included in your private Firebase backup.</div>
    <button class="btn ghost" id="st-save" style="margin-top:12px">Save profile</button>

    <div class="section-cap">Account</div>
    <div class="st-account"></div>

    <div class="section-cap">Appearance</div>
    <div class="seg" id="st-theme">
      <button data-t="dark">Dark</button>
      <button data-t="light">Light</button>
      <button data-t="system">System</button>
    </div>

    <div class="section-cap">Data</div>
    <div class="list plain">
      <button class="row pressable" id="st-export">
        <span class="grow"><span class="ttl">Export ledger</span>
        <span class="cap">Groups, expenses, settlements and the trail as JSON; proof images stay separate</span></span>
        <span class="chev">${I.chevR}</span>
      </button>
      <button class="row pressable" id="st-erase">
        <span class="grow"><span class="ttl neg">Erase all data</span>
        <span class="cap">${cloud.currentUser() ? "Deletes this device copy and your Firebase backup" : "Removes every group and receipt from this device"}</span></span>
      </button>
    </div>

    <div class="empty" style="padding-top:36px">
      <div class="mark">${MARK}</div>
      <h3>Settld 0.3.1</h3>
      <p>Split. Prove. Settle.<br>Core splitting stays free. Your device remains the source of truth.</p>
      <a class="made-by" href="https://thealgothrim.com" target="_blank" rel="noopener">Designed and built by Gaurav Kumar · The Algothrim</a>
    </div>
  </div>`);

  $("#st-save", view).addEventListener("click", async () => {
    const name = $("#st-name", view).value.trim();
    const upi = $("#st-upi", view).value.trim();
    if (!name) return toast("Your name can't be empty");
    await store.saveProfile({ name, upi });
    for (const g of store.state.groups) {
      const you = store.youOf(g);
      if (you && (you.name !== name || you.upi !== upi)) await store.updateMember(g, you.id, { name, upi });
    }
    toast("Saved");
  });

  const acc = $(".st-account", view);
  if (!cloud.cloudAvailable()) {
    acc.append(el(`<div class="list plain"><div class="row">
      <span class="grow"><span class="ttl">Cloud backup</span>
      <span class="cap">Unavailable right now. Everything stays on this device meanwhile.</span></span>
    </div></div>`));
  } else if (cloud.currentUser()) {
    const backup = syncState();
    const list = el(`<div class="list plain">
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
    const list = el(`<div class="list plain">
      <button class="row pressable" id="st-signin">
        <span class="grow"><span class="ttl">Sign in</span>
        <span class="cap">Google sign-in backs up groups, receipts and the trail.</span></span>
        <span class="chev">${I.chevR}</span>
      </button>
    </div>`);
    $("#st-signin", list).addEventListener("click", () => authSheet());
    acc.append(list);
  }

  const seg = $("#st-theme", view);
  const mark = () => {
    for (const b of seg.querySelectorAll("button")) {
      const active = b.dataset.t === (store.state.profile?.theme ?? "dark");
      b.classList.toggle("on", active);
      b.setAttribute("aria-pressed", String(active));
    }
  };
  mark();
  seg.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-t]");
    if (!b) return;
    applyTheme(b.dataset.t);
    await store.saveProfile({ theme: b.dataset.t });
    mark();
  });

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

  setAppbar({ title: "You" });
  return view;
}

/* ---------- group screen ---------- */

function GroupScreen(id) {
  const g = store.groupById(id);
  if (!g) {
    location.hash = "#/";
    return el("<div></div>");
  }
  const you = store.youOf(g);
  const { exps, setts, bal, spend } = groupCalc(g);
  const tab = ui.groupTab.get(id) ?? "overview";

  const view = el(`<div class="screen-group">
    <div class="display group-display">
      <div class="group-title-line"><span class="group-emoji">${esc(g.emoji ?? "🧾")}</span><div><h1>${esc(g.name)}</h1></div></div>
      <div class="group-meta">${avatarStackHtml(g.members)}<span>${g.members.length} members</span><span class="meta-dot"></span><span class="money">${fmt(spend)} spent</span></div>
    </div>
    <div class="seg group-tabs" role="tablist" aria-label="Group sections">
      <button role="tab" id="group-tab-overview" aria-controls="group-panel" data-tab="overview">Overview</button>
      <button role="tab" id="group-tab-expenses" aria-controls="group-panel" data-tab="expenses">Expenses</button>
      <button role="tab" id="group-tab-balances" aria-controls="group-panel" data-tab="balances">Balances</button>
      <button role="tab" id="group-tab-trail" aria-controls="group-panel" data-tab="trail">Trail</button>
    </div>
    <div class="g-body" id="group-panel" role="tabpanel" aria-labelledby="group-tab-${tab}"></div>
  </div>`);

  const seg = $(".seg", view);
  for (const b of seg.querySelectorAll("button")) {
    b.setAttribute("role", "tab");
    const active = b.dataset.tab === tab;
    b.classList.toggle("on", active);
    b.setAttribute("aria-selected", String(active));
    b.tabIndex = active ? 0 : -1;
  }
  const chooseTab = (b) => {
    ui.groupTab.set(id, b.dataset.tab);
    render();
    requestAnimationFrame(() => $(`.group-tabs [data-tab="${b.dataset.tab}"]`)?.focus());
  };
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    chooseTab(b);
  });
  seg.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const buttons = [...seg.querySelectorAll("button[data-tab]")];
    const current = buttons.indexOf(e.target.closest("button[data-tab]"));
    if (current < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : (current + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
    chooseTab(buttons[next]);
  });

  const body = $(".g-body", view);
  if (tab === "overview") body.append(overviewTab(g, exps, bal, setts, you, spend));
  else if (tab === "expenses") body.append(expensesTab(g, exps, you));
  else if (tab === "balances") body.append(balancesTab(g, bal, setts, you));
  else body.append(trailTab(g));

  if (tab === "overview" || tab === "expenses") {
    const fab = el(`<button class="fab">${I.plus} Add expense</button>`);
    fab.addEventListener("click", () => expenseSheet(g));
    view.append(fab);
  }

  setAppbar({
    title: g.name,
    left: iconBtn("chevL", "Back", () => (location.hash = "#/")),
    right: [
      iconBtn("chart", "Trip summary", () => tripSummarySheet(g)),
      iconBtn("sliders", "Group settings", () => groupSettingsSheet(g)),
    ],
  });
  return view;
}

function overviewTab(g, exps, bal, setts, you, spend) {
  const box = el(`<div class="overview-tab"></div>`);
  const net = bal.get(you?.id) ?? 0;
  const plan = simplify(bal);
  const withProof = exps.filter((e) => e.attachments?.length).length;
  const balanceLabel = net > 0 ? "You get" : net < 0 ? "You owe" : "Your balance";
  const balanceValue = net === 0 ? "All clear" : fmt(Math.abs(net));
  const balanceClass = net > 0 ? "pos" : net < 0 ? "debt" : "";

  box.append(el(`<section class="ledger-hero">
    <div class="ledger-label">Total group spend</div>
    <div class="ledger-amount money">${fmt(spend)}</div>
    <div class="ledger-stats">
      <span><b>${exps.length}</b> expenses</span>
      <span><b>${withProof}</b> with proof</span>
      <span><b>${setts.length}</b> payment${setts.length === 1 ? "" : "s"} recorded</span>
    </div>
  </section>`));

  const actions = el(`<div class="overview-actions">
    <button class="overview-action balance-action">
      <span class="action-icon">${I.settle}</span><span><small>${balanceLabel}</small><strong class="money ${balanceClass}">${balanceValue}</strong></span><span class="chev">${I.chevR}</span>
    </button>
    <button class="overview-action summary-action">
      <span class="action-icon">${I.chart}</span><span><small>Trip summary</small><strong>Spend by category</strong></span><span class="chev">${I.chevR}</span>
    </button>
  </div>`);
  $(".balance-action", actions).addEventListener("click", () => {
    ui.groupTab.set(g.id, "balances");
    render();
  });
  $(".summary-action", actions).addEventListener("click", () => tripSummarySheet(g));
  box.append(actions);

  if (plan.length) {
    const settle = el(`<button class="smart-settle-callout">
      <span class="settle-seal">${I.check}</span>
      <span><small>Smart settle</small><strong>${plan.length} transfer${plan.length === 1 ? "" : "s"} clear the group</strong><span>See the simplest payment plan</span></span>
      <span class="chev">${I.chevR}</span>
    </button>`);
    settle.addEventListener("click", () => {
      ui.groupTab.set(g.id, "balances");
      render();
    });
    box.append(settle);
  }

  box.append(el(`<div class="section-heading recent-heading"><div><h2>Recent expenses</h2></div></div>`));
  if (exps.length) box.append(expenseRows(g, exps.slice(0, 3), you, false));
  else box.append(el(`<div class="empty compact"><h3>No expenses yet</h3><p>Add the first one and the hisab begins.</p></div>`));
  if (exps.length > 3) {
    const more = el(`<button class="btn quiet more-expenses">View all ${exps.length} expenses</button>`);
    more.addEventListener("click", () => {
      ui.groupTab.set(g.id, "expenses");
      render();
    });
    box.append(more);
  }
  return box;
}

function expenseRows(g, exps, you, byDay = true) {
  const box = el(`<div class="expense-records"></div>`);
  let lastDay = "";
  let list = null;
  if (!byDay) {
    list = el(`<div class="list expense-list"></div>`);
    box.append(list);
  }
  for (const e of exps) {
    const k = dayKey(e.date);
    if (byDay && k !== lastDay) {
      lastDay = k;
      box.append(el(`<div class="day">${dayLabel(e.date)}</div>`));
      list = el(`<div class="list expense-list"></div>`);
      box.append(list);
    }
    const payers = e.payers.map((p) => displayName(store.memberOf(g, p.memberId))).join(", ");
    const shares = computeShares(e);
    const paid = e.payers.filter((p) => p.memberId === you?.id).reduce((a, p) => a + p.amountP, 0);
    const mine = paid - (shares.get(you?.id) ?? 0);
    const badges = [];
    if (e.attachments?.length) badges.push(`<span class="badge proof">${I.clip}Proof ${e.attachments.length}</span>`);
    if (e.updatedAt - e.createdAt > 1500) badges.push(`<span class="badge edited">${I.pen}Edited</span>`);
    const mineHtml =
      mine === 0
        ? shares.has(you?.id)
          ? `<span class="cap">Your share is even</span>`
          : `<span class="cap">Not in your split</span>`
        : mine > 0
          ? `<span class="cap money pos">You get ${fmt(mine)}</span>`
          : `<span class="cap money debt">You owe ${fmt(-mine)}</span>`;
    const row = el(`<button class="row expense-row pressable">
      <span class="tile expense-tile">${catOf(e.category).emoji}</span>
      <span class="grow"><span class="ttl">${esc(e.desc)}</span>
        <span class="cap meta-line"><span>${esc(payers)} paid</span>${badges.join("")}</span></span>
      <span class="end"><span class="amt money">${fmt(e.amountP)}</span>${mineHtml}</span>
      <span class="chev">${I.chevR}</span>
    </button>`);
    row.addEventListener("click", () => expenseDetailSheet(g, e));
    list.append(row);
  }
  return box;
}

function expensesTab(g, exps, you) {
  const box = el(`<div class="expenses-tab"></div>`);
  if (!exps.length) {
    box.append(el(`<div class="empty">
      <div class="mark">${MARK}</div>
      <h3>No expenses yet</h3>
      <p>Add the first one in a few taps. Proof can come now or later.</p>
    </div>`));
    return box;
  }
  const proofCount = exps.reduce((n, e) => n + (e.attachments?.length ? 1 : 0), 0);
  box.append(el(`<div class="record-summary"><span><b>${exps.length}</b> expenses</span><span><b>${proofCount}</b> with proof</span></div>`));
  box.append(expenseRows(g, exps, you));
  return box;
}

function balancesTab(g, bal, setts, you) {
  const box = el(`<div class="balances-tab"></div>`);
  const paymentHistory = store.state.settlements.filter((settlement) => settlement.groupId === g.id).sort((a, b) => b.createdAt - a.createdAt);
  const net = bal.get(you?.id) ?? 0;
  const netLabel = net > 0 ? "You get back" : net < 0 ? "You owe" : "Your balance";
  const netValue = net === 0 ? "All clear" : fmt(Math.abs(net));

  box.append(el(`<div class="position balance-position">
    <div class="position-icon">${I.settle}</div>
    <div class="lbl">${netLabel}</div>
    <div class="val money ${net > 0 ? "pos" : net < 0 ? "debt" : ""}">${netValue}</div>
    <div class="note">${net > 0 ? "This is what the group currently owes you." : net < 0 ? "Smart settle shows a simple payment plan below." : "Hisab barabar. Nothing is pending."}</div>
  </div>`));

  box.append(el(`<div class="section-heading"><div><h2>Balances</h2></div></div>`));
  const list = el(`<div class="list plain"></div>`);
  for (const m of g.members) {
    const v = bal.get(m.id) ?? 0;
    const amount = v > 0 ? `Gets ${fmt(v)}` : v < 0 ? `Owes ${fmt(-v)}` : "Settled";
    list.append(el(`<div class="row">
      ${avatarHtml(m)}
      <span class="grow"><span class="ttl">${esc(displayName(m))}</span></span>
      <span class="end"><span class="amt money ${v > 0 ? "pos" : v < 0 ? "debt" : "dim"}">${amount}</span></span>
    </div>`));
  }
  box.append(list);

  const plan = simplify(bal);
  if (plan.length) {
    box.append(el(`<div class="settle-intro"><span class="settle-seal">${I.check}</span><div><h2>Smart settle</h2><p>${plan.length} transfer${plan.length > 1 ? "s" : ""} clear every current balance. Settld suggests the plan; it never moves money.</p></div></div>`));
    const pl = el(`<div class="list plain settle-plan"></div>`);
    for (const t of plan) {
      const from = store.memberOf(g, t.fromId);
      const to = store.memberOf(g, t.toId);
      const row = el(`<div class="row settle-row">
        <span class="avatar-pair">${avatarHtml(from, "sm")}${avatarHtml(to, "sm")}</span>
        <span class="grow"><span class="ttl">${esc(displayName(from))} pays ${esc(displayName(to))}</span><span class="cap">Suggested transfer</span></span>
        <span class="end"><span class="amt money">${fmt(t.amountP)}</span></span>
      </div>`);
      const btn = el(`<button class="btn secondary small">Record</button>`);
      btn.addEventListener("click", () => settleSheet(g, t.fromId, t.toId, t.amountP));
      row.append(btn);
      pl.append(row);
    }
    box.append(pl);
  }

  if (paymentHistory.length) {
    box.append(el(`<div class="section-heading"><div><h2>Payment history</h2></div></div>`));
    const sl = el(`<div class="list"></div>`);
    for (const s of paymentHistory) {
      const from = store.memberOf(g, s.fromId);
      const to = store.memberOf(g, s.toId);
      const badge = s.deleted ? `<span class="badge edited">Reversed</span>` : s.attachments?.length ? `<span class="badge ok">${I.clip}Proof attached</span>` : "";
      const row = el(`<button class="row pressable">
        <span class="tile">${I.check}</span>
        <span class="grow"><span class="ttl">${esc(displayName(from))} paid ${esc(displayName(to))}</span>
          <span class="cap">${dayLabel(s.createdAt)}${s.note ? " · " + esc(s.note) : ""} ${badge}</span></span>
        <span class="end"><span class="amt money">${fmt(s.amountP)}</span></span>
      </button>`);
      row.addEventListener("click", () => settlementDetailSheet(g, s));
      sl.append(row);
    }
    box.append(sl);
  }
  return box;
}

function settlementDetailSheet(g, settlement) {
  const from = store.memberOf(g, settlement.fromId);
  const to = store.memberOf(g, settlement.toId);
  const body = el(`<div class="expense-detail">
    <div class="expense-hero">
      <div class="expense-hero-top"><span class="category-label">${I.check} ${settlement.deleted ? "Reversed payment" : "Recorded payment"}</span><span>${dayLabel(settlement.createdAt)}</span></div>
      <div class="val money">${fmt(settlement.amountP)}</div>
      <div class="note">${esc(displayName(from))} paid ${esc(displayName(to))}.</div>
      ${settlement.note ? `<blockquote>${esc(settlement.note)}</blockquote>` : ""}
    </div>
    <div class="settlement-proofs"></div>
  </div>`);
  const proofs = $(".settlement-proofs", body);
  if (settlement.attachments?.length) {
    proofs.append(el(`<div class="section-heading"><div><h2>Payment proof</h2></div></div>`));
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
  if (foot) armDanger(foot, async () => {
      await store.voidSettlement(g, settlement);
      closeSheet();
      toast("Payment reversed. The trail keeps both records.");
    });
  const wrap = openSheet({ title: "Payment record", body, footer: foot });
  hydrate(wrap);
}

function trailTab(g) {
  const box = el(`<div class="trail-tab"></div>`);
  const events = store.eventsOf(g.id);
  box.append(el(`<div class="trail-note"><span>${I.check}</span><div><strong>Nothing is silently overwritten</strong><p>Corrections create a new event so the group can always see what changed.</p></div></div>`));
  if (events.length) box.append(trailList(events));
  else box.append(el(`<div class="empty compact"><h3>No activity yet</h3><p>Add an expense and its record will begin here.</p></div>`));
  return box;
}

function tripSummarySheet(g) {
  const { exps, setts, bal, spend } = groupCalc(g);
  const you = store.youOf(g);
  const net = bal.get(you?.id) ?? 0;
  const paid = exps.reduce(
    (sum, expense) => sum + expense.payers.filter((p) => p.memberId === you?.id).reduce((n, p) => n + p.amountP, 0),
    0,
  );
  const cleared = setts.reduce((sum, settlement) => sum + settlement.amountP, 0);
  const breakdown = CATS.map((cat, index) => ({
    ...cat,
    color: `var(--chart-${(index % 6) + 1})`,
    amount: exps.filter((e) => e.category === cat.id).reduce((sum, e) => sum + e.amountP, 0),
  })).filter((cat) => cat.amount > 0);
  let cursor = 0;
  const segments = breakdown.map((cat) => {
    const start = cursor;
    cursor += spend ? (cat.amount / spend) * 100 : 0;
    return `${cat.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });
  const chart = segments.length ? `conic-gradient(${segments.join(",")})` : "var(--line)";

  const body = el(`<div class="trip-summary">
    <div class="summary-chart-row">
      <div class="spend-donut" style="--chart:${chart}" role="img" aria-label="Group spend by category">
        <div><span>Total spent</span><strong class="money">${fmt(spend)}</strong><small>${exps.length} expenses</small></div>
      </div>
      <div class="summary-legend"></div>
    </div>
    <div class="summary-metrics">
      <div><span>You paid</span><strong class="money">${fmt(paid)}</strong></div>
      <div><span>${net > 0 ? "You get" : net < 0 ? "You owe" : "Your balance"}</span><strong class="money ${net > 0 ? "pos" : net < 0 ? "debt" : ""}">${net === 0 ? "All clear" : fmt(Math.abs(net))}</strong></div>
      <div><span>Payments recorded</span><strong class="money">${fmt(cleared)}</strong></div>
    </div>
    <p class="summary-note">Category spend, contribution, and balance are shown separately so the numbers stay truthful.</p>
  </div>`);
  const legend = $(".summary-legend", body);
  for (const cat of breakdown) {
    legend.append(el(`<div class="legend-row"><i style="background:${cat.color}"></i><span>${cat.emoji} ${esc(cat.label)}</span><strong class="money">${fmt(cat.amount)}</strong></div>`));
  }
  if (!breakdown.length) legend.append(el(`<p class="hint">No category spend yet.</p>`));
  const foot = el(`<button class="btn primary">${I.share} Share summary</button>`);
  openSheet({ title: "Trip summary", body, footer: foot });
  foot.addEventListener("click", () => shareSummary(g));
}

async function shareSummary(g) {
  const { bal, spend } = groupCalc(g);
  const lines = [`${g.emoji ?? ""} ${g.name} · Settld`, `Spent so far: ${fmt(spend)}`, ""];
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

/* ---------- welcome + group sheets ---------- */

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

// Google sign-in control, shared by the welcome sheet and settings.
function authOptions(onSignedIn) {
  const box = el(`<div>
    <button class="btn primary au-google">Continue with Google</button>
  </div>`);
  $(".au-google", box).addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    interactiveAuth = true;
    try {
      await cloud.signInGoogle();
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
  }
  else closeSheet();
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
      <p>Shared expenses with the receipt, payment proof, and edit history kept together.</p>
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
      <p>Your name appears on expenses and the trail. Add UPI now or later.</p>
    </div>
    <label class="cap-label" for="w-name">Your name</label>
    <input class="in" id="w-name" placeholder="Gaurav" autocomplete="name" value="${esc(prefill)}" maxlength="${store.LIMITS.profileName}">
    <label class="cap-label" for="w-upi">Your UPI ID <span class="dim">(optional)</span></label>
    <input class="in" id="w-upi" placeholder="name@bank" autocapitalize="none" maxlength="${store.LIMITS.upi}">
  </div>`);
  const foot = el(`<button class="btn primary">Get started</button>`);
  openSheet({ body, footer: foot, locked: true });
  foot.addEventListener("click", async () => {
    const name = $("#w-name", body).value.trim();
    if (!name) return toast("Tell us your name first");
    await store.saveProfile({ name, upi: $("#w-upi", body).value.trim(), theme: localStorage.getItem("settld-theme") ?? "dark" });
    closeLocked();
    render();
  });
}

function emojiChips(selected) {
  const box = el(`<div class="chips" role="group" aria-label="Group icon" style="margin-top:8px"></div>`);
  for (const e of GROUP_EMOJIS) {
    const active = e === selected;
    const c = el(`<button class="chip ${active ? "on" : ""}" data-e="${e}" aria-label="Use ${e} as the group icon" aria-pressed="${active}" style="padding:0 12px">${e}</button>`);
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
    <label class="cap-label" for="ng-name">Group name</label>
    <input class="in" id="ng-name" placeholder="Goa trip, Flat 302, Office lunch" maxlength="${store.LIMITS.groupName}">
    <label class="cap-label">Icon</label>
    <div class="ng-emoji"></div>
    <label class="cap-label" for="ng-member">Members <span class="dim">(you're already in)</span></label>
    <div style="display:flex;gap:8px">
      <input class="in" id="ng-member" placeholder="Add a name" maxlength="${store.LIMITS.memberName}" style="flex:1">
      <button class="btn ghost small" id="ng-add" style="height:54px;border-radius:18px">Add</button>
    </div>
    <div class="chips" id="ng-chips" style="margin-top:10px"></div>
  </div>`);
  const emo = emojiChips(GROUP_EMOJIS[0]);
  $(".ng-emoji", body).append(emo);

  const chips = $("#ng-chips", body);
  const input = $("#ng-member", body);
  const addName = () => {
    const n = input.value.trim();
    if (!n) return;
    if (names.length >= store.LIMITS.members - 1) return toast(`A group can have up to ${store.LIMITS.members} members`);
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
    const emoji = emo.querySelector(".on")?.dataset.e ?? GROUP_EMOJIS[0];
    const g = await store.createGroup({ name, emoji, memberNames: names });
    closeSheet(false, () => (location.hash = `#/group/${g.id}`));
  });
}

function groupSettingsSheet(g) {
  const body = el(`<div>
    <label class="cap-label" for="gs-name">Group name</label>
    <input class="in" id="gs-name" value="${esc(g.name)}" maxlength="${store.LIMITS.groupName}">
    <label class="cap-label">Icon</label>
    <div class="gs-emoji"></div>
    <div class="section-cap" style="margin-left:4px">Members</div>
    <div class="list plain" id="gs-members"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <input class="in" id="gs-new" placeholder="Add a member" maxlength="${store.LIMITS.memberName}" style="flex:1">
      <button class="btn ghost small" id="gs-add" style="height:54px;border-radius:18px">Add</button>
    </div>
    <button class="btn danger" id="gs-del" style="margin-top:20px">Delete group</button>
  </div>`);
  const emo = emojiChips(g.emoji ?? GROUP_EMOJIS[0]);
  $(".gs-emoji", body).append(emo);

  const renderMembers = () => {
    const box = $("#gs-members", body);
    box.replaceChildren();
    for (const m of g.members) {
      const row = el(`<button class="row pressable">
        ${avatarHtml(m)}
        <span class="grow"><span class="ttl">${esc(m.name)}${m.isYou ? " (you)" : ""}</span>
          <span class="cap">${m.upi ? esc(m.upi) : "No UPI ID yet"}</span></span>
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
    if (g.members.length >= store.LIMITS.members) return toast(`A group can have up to ${store.LIMITS.members} members`);
    await store.addMember(g, n);
    $("#gs-new", body).value = "";
    renderMembers();
  });

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
    await store.renameGroup(g, name, emo.querySelector(".on")?.dataset.e ?? g.emoji);
    closeSheet();
  });
}

function memberSheet(g, m, onDone) {
  const body = el(`<div>
    <label class="cap-label" for="ms-name">Name</label>
    <input class="in" id="ms-name" value="${esc(m.name)}" maxlength="${store.LIMITS.memberName}">
    <label class="cap-label" for="ms-upi">UPI ID</label>
    <input class="in" id="ms-upi" value="${esc(m.upi ?? "")}" placeholder="name@bank" autocapitalize="none" maxlength="${store.LIMITS.upi}">
    <div class="hint">Used for one-tap UPI when someone clears up with ${esc(displayName(m))}.</div>
    ${m.isYou ? "" : `<button class="btn danger" id="ms-remove" style="margin-top:18px">Remove from group</button>`}
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

function expenseSheet(g, existing) {
  const s = existing
    ? {
        desc: existing.desc,
        amountStr: fromPaise(existing.amountP),
        date: existing.date,
        category: existing.category,
        multi: existing.payers.length > 1,
        payers: existing.payers.map((p) => ({ memberId: p.memberId, amountStr: fromPaise(p.amountP) })),
        parts: new Set(existing.split.participants.map((p) => p.memberId)),
        mode: existing.split.mode,
        values: new Map(
          existing.split.participants.map((p) => [
            p.memberId,
            existing.split.mode === "exact" ? fromPaise(p.valueP ?? 0) : String(p.value ?? ""),
          ]),
        ),
        att: [...(existing.attachments ?? []).map((id) => ({ id }))],
        notes: existing.notes ?? "",
      }
    : {
        desc: "",
        amountStr: "",
        date: Date.now(),
        category: "other",
        multi: false,
        payers: [{ memberId: store.youOf(g)?.id ?? g.members[0].id, amountStr: "" }],
        parts: new Set(g.members.map((m) => m.id)),
        mode: "equal",
        values: new Map(),
        att: [],
        notes: "",
      };

  const body = el(`<div class="expense-form">
    <div class="amount-shell"><span aria-hidden="true">₹</span><input class="amount-in money" inputmode="decimal" placeholder="0" value="${esc(s.amountStr)}" aria-label="Amount in rupees"></div>
    <label class="sr-only" for="x-desc">Expense description</label>
    <input class="in expense-desc" id="x-desc" placeholder="What was it? Dinner, cab, tickets" value="${esc(s.desc)}" maxlength="${store.LIMITS.expenseDesc}">
    <label class="cap-label">Paid by</label>
    <div class="x-payers"></div>
    <label class="cap-label">Split between</label>
    <div class="chips x-parts"></div>
    <details class="expense-more" ${existing ? "open" : ""}>
      <summary><span class="summary-icon">${I.clip}</span><span><strong>More details and proof</strong><small>Split method, date, category, receipt, notes</small></span><span class="summary-chev">${I.chevR}</span></summary>
      <div class="expense-more-body">
        <label class="cap-label">How to split</label>
        <div class="seg x-mode" role="tablist" aria-label="Split method">
          <button data-m="equal">Equally</button>
          <button data-m="exact">Exact</button>
          <button data-m="percent">Percent</button>
          <button data-m="shares">Shares</button>
        </div>
        <div class="x-values"></div>
        <label class="cap-label">Category</label>
        <div class="chips x-cats"></div>
        <label class="cap-label" for="x-date">Date</label>
        <input class="in" id="x-date" type="date" value="${toDateInput(s.date)}">
        <label class="cap-label">Proof <span class="dim">(receipt or payment screenshot)</span></label>
        <div class="proof-add-copy">${I.receipt}<span><strong>Keep the record clear</strong><small>Images are compressed on this device before backup.</small></span></div>
        <div class="thumbs x-thumbs"></div>
        <input type="file" accept="image/*" multiple hidden class="x-file">
        <label class="cap-label" for="x-notes">Notes <span class="dim">(optional)</span></label>
        <input class="in" id="x-notes" placeholder="Anything the group should know" value="${esc(s.notes)}" maxlength="${store.LIMITS.expenseNotes}">
      </div>
    </details>
  </div>`);

  const amountIn = $(".amount-in", body);
  amountIn.addEventListener("input", () => {
    s.amountStr = amountIn.value;
    renderValues();
    renderPayers();
  });
  $("#x-desc", body).addEventListener("input", (e) => (s.desc = e.target.value));
  $("#x-date", body).addEventListener("change", (e) => (s.date = fromDateInput(e.target.value)));
  $("#x-notes", body).addEventListener("input", (e) => (s.notes = e.target.value));

  // categories
  const catBox = $(".x-cats", body);
  for (const c of CATS) {
    const active = c.id === s.category;
    const chip = el(`<button class="chip ${active ? "on" : ""}" data-c="${c.id}" aria-pressed="${active}" style="padding-left:12px">${c.emoji} ${c.label}</button>`);
    chip.addEventListener("click", () => {
      s.category = c.id;
      for (const x of catBox.children) {
        const on = x === chip;
        x.classList.toggle("on", on);
        x.setAttribute("aria-pressed", String(on));
      }
    });
    catBox.append(chip);
  }

  // payers
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
      const link = el(`<button class="hint payer-multi-toggle">+ Multiple people paid</button>`);
      link.addEventListener("click", () => {
        s.multi = true;
        renderPayers();
      });
      payersBox.append(link);
    } else {
      for (const m of g.members) {
        const cur = s.payers.find((p) => p.memberId === m.id);
        const row = el(`<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <button class="chip ${cur ? "on" : ""}" aria-pressed="${Boolean(cur)}" aria-label="Toggle ${esc(displayName(m))} as a payer" style="flex:1;justify-content:flex-start">${avatarHtml(m, "sm")} ${esc(displayName(m))}</button>
          <input class="in money" type="number" min="0" step="0.01" inputmode="decimal" placeholder="₹0" value="${esc(cur?.amountStr ?? "")}" aria-label="Amount paid by ${esc(displayName(m))} in rupees"
            style="width:110px;height:48px;border-radius:14px;text-align:right" ${cur ? "" : "disabled"}>
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
      const hint = el(`<div class="hint x-payhint" role="status" aria-live="polite"></div>`);
      payersBox.append(hint);
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
            ? `${fmt(left)} left to assign`
            : `${fmt(-left)} over the total`;
  }
  renderPayers();

  // participants
  const partsBox = $(".x-parts", body);
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
  }
  renderParts();

  // split mode + per-person values
  const modeSeg = $(".x-mode", body);
  const valuesBox = $(".x-values", body);
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
    markMode();
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

  function renderValues() {
    valuesBox.replaceChildren();
    const ids = [...s.parts];
    const total = toPaise(s.amountStr) || 0;
    if (!ids.length) {
      valuesBox.append(el(`<div class="hint bad">Pick at least one person to split between</div>`));
      return;
    }
    if (s.mode === "equal") {
      valuesBox.append(el(`<div class="hint">${total > 0 ? `About ${fmt(Math.round(total / ids.length))} each, ${ids.length} people` : `${ids.length} people, equal shares`}</div>`));
      return;
    }
    const unit = s.mode === "exact" ? "₹" : s.mode === "percent" ? "%" : "share";
    for (const idm of ids) {
      const m = store.memberOf(g, idm);
      const row = el(`<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
        ${avatarHtml(m, "sm")}
        <span style="flex:1;font-weight:600;font-size:14px">${esc(displayName(m))}</span>
        <input class="in money" type="number" min="0" step="${s.mode === "shares" ? "1" : "0.01"}" inputmode="decimal" placeholder="0" value="${esc(s.values.get(idm) ?? "")}" aria-label="${s.mode === "exact" ? "Amount" : s.mode === "percent" ? "Percentage" : "Shares"} for ${esc(displayName(m))}"
          style="width:110px;height:48px;border-radius:14px;text-align:right">
        <span class="dim" style="width:38px;font-size:13px">${unit}</span>
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
    if (s.mode === "exact") {
      const sum = ids.reduce((a, idm) => a + (toPaise(s.values.get(idm)) || 0), 0);
      const left = total - sum;
      ok = left === 0 && total > 0;
      text = ok ? "Adds up perfectly" : left > 0 ? `${fmt(left)} left to assign` : `${fmt(-left)} over the total`;
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

  // proof
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
    const amountP = toPaise(s.amountStr);
    if (!Number.isFinite(amountP) || amountP <= 0) return toast("Enter the amount first");
    const desc = s.desc.trim();
    if (!desc) return toast("Give it a name");
    if (s.att.length > store.LIMITS.attachments) return toast(`Remove proofs until ${store.LIMITS.attachments} remain`);
    const ids = [...s.parts];
    if (!ids.length) return toast("Pick who shares this");

    let participants;
    if (s.mode === "equal") participants = ids.map((idm) => ({ memberId: idm }));
    else if (s.mode === "exact") {
      const rows = ids.map((idm) => ({ memberId: idm, valueP: toPaise(s.values.get(idm)) || 0 }));
      if (rows.reduce((a, r) => a + r.valueP, 0) !== amountP) return toast("Exact amounts must add up to the total");
      participants = rows;
    } else {
      const rows = ids.map((idm) => ({ memberId: idm, value: Number(s.values.get(idm) || 0) }));
      if (rows.some((row) => !Number.isFinite(row.value) || row.value < 0)) return toast("Split values cannot be negative");
      const sum = rows.reduce((a, r) => a + r.value, 0);
      if (s.mode === "percent" && Math.abs(sum - 100) > 0.01) return toast("Percentages must add up to 100");
      if (s.mode === "shares" && sum <= 0) return toast("Give at least one share");
      participants = rows;
    }

    let payers;
    if (!s.multi) payers = [{ memberId: s.payers[0].memberId, amountP }];
    else {
      payers = s.payers
        .map((p) => ({ memberId: p.memberId, amountP: toPaise(p.amountStr) || 0 }))
        .filter((p) => p.amountP > 0);
      if (!payers.length) return toast("Who paid?");
      if (payers.reduce((a, p) => a + p.amountP, 0) !== amountP) return toast("Payments must add up to the total");
    }

    foot.disabled = true;
    const attIds = [];
    try {
      for (const a of s.att) attIds.push(a.id ?? (await store.addAttachment(a.blob, a.name)));
    } catch {
      foot.disabled = false;
      return toast("That proof image is too large to back up. Try a screenshot or smaller photo.");
    }

    const data = {
      desc,
      amountP,
      category: s.category,
      date: s.date,
      payers,
      split: { mode: s.mode, participants },
      attachments: attIds,
      notes: s.notes.trim(),
    };

    if (existing) {
      const changes = [];
      if (existing.amountP !== amountP) changes.push(`amount ${fmt(existing.amountP)} to ${fmt(amountP)}`);
      if (existing.desc !== desc) changes.push(`renamed from ${existing.desc}`);
      if (dayKey(existing.date) !== dayKey(s.date)) changes.push(`date to ${dayLabel(s.date)}`);
      if (existing.split.participants.length !== participants.length)
        changes.push(`${existing.split.participants.length} to ${participants.length} people`);
      if (existing.split.mode !== s.mode) changes.push(`split by ${s.mode}`);
      if ((existing.attachments?.length ?? 0) !== attIds.length) changes.push("proof updated");
      await store.updateExpense(g, existing, data, changes.join(", ") || "details updated");
      closeSheet();
      toast("Saved");
    } else {
      await store.addExpense(g, data);
      closeSheet();
      toast(`${fmt(amountP)} added`);
    }
  });
}

/* ---------- expense detail ---------- */

function expenseDetailSheet(g, e) {
  const shares = computeShares(e);
  const paidBy = e.payers
    .map((p) => `${displayName(store.memberOf(g, p.memberId))}${e.payers.length > 1 ? " " + fmt(p.amountP) : ""}`)
    .join(", ");
  const modeLabel = { equal: "equally", exact: "by exact amounts", percent: "by percent", shares: "by shares" }[e.split.mode];

  const body = el(`<div class="expense-detail">
    <div class="expense-hero">
      <div class="expense-hero-top"><span class="category-label">${catOf(e.category).emoji} ${esc(catOf(e.category).label)}</span><span>${dayLabel(e.date)}</span></div>
      <div class="val money">${fmt(e.amountP)}</div>
      <div class="note">Paid by ${esc(paidBy)}. Split ${modeLabel} between ${e.split.participants.length}.</div>
      ${e.notes ? `<blockquote>${esc(e.notes)}</blockquote>` : ""}
      <div class="proof-status ${e.attachments?.length ? "has-proof" : "no-proof"}">${e.attachments?.length ? `${I.clip}<span><strong>Proof attached</strong><small>${e.attachments.length} image${e.attachments.length === 1 ? "" : "s"} kept with this expense</small></span>` : `${I.receipt}<span><strong>No proof attached</strong><small>Add the receipt now or whenever you find it</small></span><button class="btn quiet small detail-add-proof">Add proof</button>`}</div>
    </div>
    <div class="section-heading"><div><h2>Who owes what</h2></div></div>
    <div class="list plain x-shares"></div>
    <div class="x-proofwrap"></div>
    <div class="x-trailwrap"></div>
  </div>`);

  const sl = $(".x-shares", body);
  for (const p of e.split.participants) {
    const m = store.memberOf(g, p.memberId);
    const paid = e.payers.filter((x) => x.memberId === p.memberId).reduce((a, x) => a + x.amountP, 0);
    sl.append(el(`<div class="row" style="min-height:52px">
      ${avatarHtml(m, "sm")}
      <span class="grow"><span class="ttl" style="font-size:14.5px">${esc(displayName(m))}</span>
        ${paid ? `<span class="cap">paid ${fmt(paid)}</span>` : ""}</span>
      <span class="end"><span class="amt money">${fmt(shares.get(p.memberId) ?? 0)}</span></span>
    </div>`));
  }

  if (e.attachments?.length) {
    const wrap = $(".x-proofwrap", body);
    wrap.append(el(`<div class="section-heading"><div><h2>Proof</h2></div></div>`));
    const t = el(`<div class="thumbs proof-gallery"></div>`);
    for (const [index, id] of e.attachments.entries()) {
      const button = el(`<button class="thumb-button pressable" aria-label="View proof ${index + 1}"><img class="thumb" data-att="${id}" alt=""></button>`);
      button.addEventListener("click", async () => openViewer(await attUrl(id)));
      t.append(button);
    }
    wrap.append(t);
  }

  const evs = store.eventsOf(g.id).filter((ev) => ev.data?.expenseId === e.id);
  if (evs.length) {
    const wrap = $(".x-trailwrap", body);
    wrap.append(el(`<div class="section-cap" style="margin-left:4px">Trail</div>`));
    wrap.append(trailList(evs));
  }

  const foot = el(`<div class="btn-row">
    <button class="btn ghost">${I.pen} Edit</button>
    <button class="btn danger">${I.trash} Delete</button>
  </div>`);
  openSheet({ title: e.desc, body, footer: foot });

  $(".detail-add-proof", body)?.addEventListener("click", () => {
    closeSheet(false, () => expenseSheet(g, e));
  });

  foot.querySelector(".ghost").addEventListener("click", () => {
    closeSheet(false, () => expenseSheet(g, e));
  });
  armDanger(foot.querySelector(".danger"), async () => {
    await store.deleteExpense(g, e);
    closeSheet();
    toast("Deleted. It stays on the trail.");
  });
}

/* ---------- settle sheet ---------- */

function settleSheet(g, fromId, toId, amountP) {
  const from = store.memberOf(g, fromId);
  const to = store.memberOf(g, toId);
  const att = [];

  const body = el(`<div>
    <div style="display:flex;align-items:center;justify-content:center;gap:14px;padding:14px 0 4px">
      <span style="display:flex;flex-direction:column;align-items:center;gap:6px">${avatarHtml(from)}<b style="font-size:13px">${esc(displayName(from))}</b></span>
      <span class="dim" style="width:26px">${I.arrowR}</span>
      <span style="display:flex;flex-direction:column;align-items:center;gap:6px">${avatarHtml(to)}<b style="font-size:13px">${esc(displayName(to))}</b></span>
    </div>
    <input class="amount-in money" inputmode="decimal" value="${esc(fromPaise(amountP))}" aria-label="Amount">
    ${from?.isYou && to.upi
      ? `<a class="btn ghost" id="se-upi">${I.upi} Pay ${esc(displayName(to))} via UPI</a>
         <div class="hint" style="text-align:center">Opens your UPI app with the amount filled in. Settld does not process the payment.</div>`
      : from?.isYou
        ? `<div class="hint" style="text-align:center">${esc(displayName(to))} has no UPI ID saved. Add one in group settings, or record the payment after paying another way.</div>`
        : `<div class="hint" style="text-align:center">Record this only after ${esc(displayName(from))} confirms the payment.</div>`}
    <label class="cap-label">Payment proof <span class="dim">(screenshot, optional)</span></label>
    <div class="thumbs se-thumbs"></div>
    <input type="file" accept="image/*" multiple hidden class="se-file">
    <label class="cap-label" for="se-note">Note <span class="dim">(optional)</span></label>
    <input class="in" id="se-note" placeholder="GPay, cash, adjusted in rent" maxlength="${store.LIMITS.settlementNote}">
  </div>`);

  const amountIn = $(".amount-in", body);
  const upiBtn = $("#se-upi", body);
  const setUpi = () => {
    if (!upiBtn) return;
    const p = toPaise(amountIn.value) || 0;
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

/* ---------- boot ---------- */

applyTheme(localStorage.getItem("settld-theme") ?? "dark");
initDock();
store.subscribe(render);
cloud.setOnSynced(() => store.init());
cloud.setOnStatus(() => {
  if (store.state.ready) render();
});
cloud.onAuth((signedIn) => {
  if (store.state.ready) render();
  if (signedIn && store.state.ready && !interactiveAuth) scheduleAuthRestore();
});
store.init().then(async () => {
  applyTheme(store.state.profile?.theme ?? localStorage.getItem("settld-theme") ?? "dark");
  render();
  if (cloud.cloudReady) {
    try {
      await cloud.initCloud();
      await Promise.race([cloud.authReady, new Promise((resolve) => setTimeout(resolve, 5000))]);
      if (cloud.currentUser()) await authRestoreTask;
    } catch {
      /* local mode remains fully usable when Firebase cannot load */
    }
  }
  if (!store.state.profile) welcomeSheet();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
