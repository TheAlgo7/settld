// Settld UI. One UI 9 language: big collapsing headers, grouped lists,
// bottom sheets, floating glass dock. All rendering is plain DOM.

import * as store from "./store.js";
import * as cloud from "./cloud.js";
import { fmt, fmtSigned, toPaise, fromPaise, computeShares } from "./money.js";
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
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4.5l8 7V19a1.5 1.5 0 0 1-1.5 1.5h-4V15h-5v5.5h-4A1.5 1.5 0 0 1 4 19Z"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12h4L10 5.5l4 13 2.5-6.5h4"/></svg>',
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

const MARK =
  '<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="118" fill="var(--surface)"/><g fill="none" stroke="#D7FF45" stroke-width="62" stroke-linecap="round"><path d="M 347 175 C 347 133 303 114 257 114 C 207 114 169 139 169 183 C 169 221 199 238 246 249"/><path d="M 269 265 C 316 276 345 293 345 331 C 345 375 307 397 256 397 C 206 397 166 377 163 335"/></g></svg>';

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
  return `<span class="avatar ${cls}" style="background:hsl(${hueOf(name)} 38% 40%)">${esc(initials(name))}</span>`;
};
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
  $('meta[name="theme-color"]').setAttribute("content", resolved === "light" ? "#F2F2F7" : "#0A0A0C");
  localStorage.setItem("settld-theme", pref || "dark");
}
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  if ((store.state.profile?.theme ?? "dark") === "system") applyTheme("system");
});

/* ---------- sheets ---------- */

const sheetStack = [];
let suppressPop = false;

function openSheet({ title, body, footer, locked = false, onClose }) {
  const wrap = el(`
    <div class="sheetwrap">
      <div class="scrim"></div>
      <div class="sheet" role="dialog" aria-label="${esc(title ?? "")}">
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
  sheetStack.push({ wrap, locked, onClose });
  hydrate(wrap);
  return wrap;
}

function closeSheet(viaPop = false, then) {
  const top = sheetStack[sheetStack.length - 1];
  if (!top || top.locked) {
    if (top?.locked) return;
    return;
  }
  sheetStack.pop();
  top.wrap.classList.add("out");
  setTimeout(() => top.wrap.remove(), 230);
  top.onClose?.();
  if (!viaPop) {
    suppressPop = true;
    history.back();
  }
  if (then) setTimeout(then, 60);
}

function closeLocked() {
  const top = sheetStack.pop();
  if (!top) return;
  top.wrap.classList.add("out");
  setTimeout(() => top.wrap.remove(), 230);
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
  const v = el(`<div class="viewer"><img src="${url}" alt="Proof"></div>`);
  if (onRemove) {
    const rm = el(`<button class="btn danger small" style="position:absolute;bottom:calc(28px + var(--safe-b));left:50%;translate:-50% 0;background:var(--surface)">Remove this proof</button>`);
    rm.addEventListener("click", (e) => {
      e.stopPropagation();
      onRemove();
      v.remove();
    });
    v.append(rm);
  }
  v.addEventListener("click", () => v.remove());
  document.body.append(v);
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
  const tabs = { home: ["Home", I.home], activity: ["Activity", I.pulse], settings: ["Settings", I.sliders] };
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
  else if (route.name === "settings") view = SettingsScreen();
  else view = HomeScreen();

  screen.replaceChildren(view);
  if (!keepScroll) view.classList.add("enter");
  hydrate(view);

  const dock = $("#dock");
  dock.classList.toggle("off", route.name === "group");
  for (const a of dock.querySelectorAll("a")) {
    a.classList.toggle("on", a.dataset.tab === (route.name === "home" ? "home" : route.name));
  }
  scrollTo(0, keepScroll ? y : 0);
}

addEventListener("hashchange", render);

/* ---------- screens ---------- */

function HomeScreen() {
  const name = store.state.profile?.name?.split(/\s+/)[0] ?? "there";
  let overall = 0;
  const rows = store.state.groups.map((g) => {
    const you = store.youOf(g);
    const { bal, spend } = groupCalc(g);
    const net = bal.get(you?.id) ?? 0;
    overall += net;
    return { g, net, spend };
  });

  const sub =
    rows.length === 0
      ? "Split. Prove. Settle."
      : overall === 0
        ? "All clear. Hisab barabar."
        : overall > 0
          ? `Overall, you are owed <b class="pos money">${fmt(overall)}</b>`
          : `Overall, you owe <b class="neg money">${fmt(-overall)}</b>`;

  const view = el(`<div>
    <div class="display"><h1>Hi, ${esc(name)}</h1><div class="sub">${sub}</div></div>
    <div class="home-body"></div>
  </div>`);
  const body = $(".home-body", view);

  if (!rows.length) {
    const empty = el(`<div class="empty">
      <div class="mark">${MARK}</div>
      <h3>No groups yet</h3>
      <p>Make one for the trip, the flat or the gang. Every expense keeps its proof.</p>
      <button class="btn primary" id="e-new">New group</button>
      <div style="height:10px"></div>
      <button class="btn ghost" id="e-demo">Try a sample trip</button>
    </div>`);
    $("#e-new", empty).addEventListener("click", () => newGroupSheet());
    $("#e-demo", empty).addEventListener("click", async (e) => {
      e.target.disabled = true;
      const g = await store.seedDemo();
      toast("Sample trip added");
      location.hash = `#/group/${g.id}`;
    });
    body.append(empty);
  } else {
    body.append(el(`<div class="section-cap">Groups</div>`));
    const list = el(`<div class="list"></div>`);
    for (const { g, net, spend } of rows) {
      const endHtml =
        net === 0
          ? `<div class="amt dim money">settled</div>`
          : `<div class="amt money ${net > 0 ? "pos" : "neg"}">${fmtSigned(net)}</div>`;
      const row = el(`<button class="row pressable">
        <span class="tile">${esc(g.emoji ?? "🧾")}</span>
        <span class="grow"><span class="ttl">${esc(g.name)}</span>
          <span class="cap">${g.members.length} members · ${fmt(spend)} so far</span></span>
        <span class="end">${endHtml}</span>
        <span class="chev">${I.chevR}</span>
      </button>`);
      row.addEventListener("click", () => (location.hash = `#/group/${g.id}`));
      list.append(row);
    }
    body.append(list);
    const nb = el(`<button class="btn primary" style="margin-top:16px">${I.plus} New group</button>`);
    nb.addEventListener("click", () => newGroupSheet());
    body.append(nb);
  }

  setAppbar({ title: "Settld" });
  return view;
}

function ActivityScreen() {
  const events = store.allEvents();
  const view = el(`<div>
    <div class="display"><h1>Activity</h1><div class="sub">Every add, edit and settle, in the open.</div></div>
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
  const view = el(`<div>
    <div class="display"><h1>Settings</h1></div>

    <div class="section-cap">You</div>
    <label class="cap-label" for="st-name">Your name</label>
    <input class="in" id="st-name" value="${esc(p.name)}" autocomplete="name">
    <label class="cap-label" for="st-upi">Your UPI ID</label>
    <input class="in" id="st-upi" value="${esc(p.upi ?? "")}" placeholder="name@bank" autocapitalize="none">
    <div class="hint">Friends settle with you through this. It never leaves your phone.</div>
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
        <span class="grow"><span class="ttl">Export everything</span>
        <span class="cap">Groups, expenses, settlements and the trail, as JSON</span></span>
        <span class="chev">${I.chevR}</span>
      </button>
      <button class="row pressable" id="st-erase">
        <span class="grow"><span class="ttl neg">Erase all data</span>
        <span class="cap">Removes every group and receipt from this device</span></span>
      </button>
    </div>

    <div class="empty" style="padding-top:36px">
      <div class="mark">${MARK}</div>
      <h3>Settld 0.1.0</h3>
      <p>Split. Prove. Settle.<br>Free at the core, forever. Your data lives on your device.</p>
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
  if (!cloud.cloudReady) {
    acc.append(el(`<div class="list plain"><div class="row">
      <span class="grow"><span class="ttl">Cloud backup</span>
      <span class="cap">Coming online soon. Everything stays safe on this device meanwhile.</span></span>
    </div></div>`));
  } else if (cloud.currentUser()) {
    const list = el(`<div class="list plain">
      <div class="row"><span class="grow"><span class="ttl">${esc(cloud.accountLabel())}</span>
        <span class="cap">Backed up. Groups, receipts and the trail sync to your account.</span></span></div>
      <button class="row pressable" id="st-sync"><span class="grow"><span class="ttl">Sync now</span></span><span class="chev">${I.chevR}</span></button>
      <button class="row pressable" id="st-signout"><span class="grow"><span class="ttl">Sign out</span>
        <span class="cap">Data stays on this device</span></span></button>
    </div>`);
    $("#st-sync", list).addEventListener("click", async (e) => {
      e.target.closest(".row").style.opacity = ".6";
      try {
        await cloud.syncNow();
        toast("Synced");
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
        <span class="cap">Google or phone. Backs up groups, receipts and the trail.</span></span>
        <span class="chev">${I.chevR}</span>
      </button>
    </div>`);
    $("#st-signin", list).addEventListener("click", () => authSheet());
    acc.append(list);
  }

  const seg = $("#st-theme", view);
  const mark = () => {
    for (const b of seg.querySelectorAll("button")) {
      b.classList.toggle("on", b.dataset.t === (store.state.profile?.theme ?? "dark"));
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
    await store.eraseAll();
    location.hash = "#/";
    welcomeSheet();
  });

  setAppbar({ title: "Settings" });
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
  const tab = ui.groupTab.get(id) ?? "expenses";

  const view = el(`<div>
    <div class="display"><h1>${esc(g.emoji ?? "")} ${esc(g.name)}</h1>
      <div class="sub">${g.members.length} members · <b class="money">${fmt(spend)}</b> so far</div></div>
    <div class="seg" style="margin:8px 0 16px">
      <button data-tab="expenses">Expenses</button>
      <button data-tab="balances">Balances</button>
      <button data-tab="trail">Trail</button>
    </div>
    <div class="g-body"></div>
  </div>`);

  const seg = $(".seg", view);
  for (const b of seg.querySelectorAll("button")) b.classList.toggle("on", b.dataset.tab === tab);
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    ui.groupTab.set(id, b.dataset.tab);
    render();
  });

  const body = $(".g-body", view);
  if (tab === "expenses") body.append(expensesTab(g, exps, you));
  else if (tab === "balances") body.append(balancesTab(g, bal, setts, you));
  else body.append(trailTab(g));

  if (tab === "expenses") {
    const fab = el(`<button class="fab">${I.plus} Add expense</button>`);
    fab.addEventListener("click", () => expenseSheet(g));
    view.append(fab);
  }

  setAppbar({
    title: g.name,
    left: iconBtn("chevL", "Back", () => (location.hash = "#/")),
    right: [
      iconBtn("share", "Share summary", () => shareSummary(g)),
      iconBtn("sliders", "Group settings", () => groupSettingsSheet(g)),
    ],
  });
  return view;
}

function expensesTab(g, exps, you) {
  const box = el(`<div style="padding-bottom:60px"></div>`);
  if (!exps.length) {
    const empty = el(`<div class="empty">
      <div class="mark">${MARK}</div>
      <h3>No expenses yet</h3>
      <p>Add the first one and the hisab begins. Receipts welcome.</p>
    </div>`);
    box.append(empty);
    return box;
  }
  let lastDay = "";
  let list = null;
  for (const e of exps) {
    const k = dayKey(e.date);
    if (k !== lastDay) {
      lastDay = k;
      box.append(el(`<div class="day">${dayLabel(e.date)}</div>`));
      list = el(`<div class="list"></div>`);
      box.append(list);
    }
    const payers = e.payers.map((p) => displayName(store.memberOf(g, p.memberId))).join(", ");
    const shares = computeShares(e);
    const paid = e.payers.filter((p) => p.memberId === you?.id).reduce((a, p) => a + p.amountP, 0);
    const mine = paid - (shares.get(you?.id) ?? 0);
    const badges = [];
    if (e.attachments?.length) badges.push(`<span class="badge">${I.clip}${e.attachments.length}</span>`);
    if (e.updatedAt - e.createdAt > 1500) badges.push(`<span class="badge">${I.pen}edited</span>`);
    const mineHtml =
      mine === 0
        ? shares.has(you?.id)
          ? `<span class="cap">even</span>`
          : `<span class="cap">not involved</span>`
        : `<span class="cap money ${mine > 0 ? "pos" : "neg"}">${fmtSigned(mine)}</span>`;
    const row = el(`<button class="row pressable">
      <span class="tile">${catOf(e.category).emoji}</span>
      <span class="grow"><span class="ttl">${esc(e.desc)}</span>
        <span class="cap">${esc(payers)} paid ${badges.join("")}</span></span>
      <span class="end"><span class="amt money">${fmt(e.amountP)}</span>${mineHtml}</span>
    </button>`);
    row.addEventListener("click", () => expenseDetailSheet(g, e));
    list.append(row);
  }
  return box;
}

function balancesTab(g, bal, setts, you) {
  const box = el(`<div></div>`);
  const net = bal.get(you?.id) ?? 0;

  box.append(el(`<div class="position">
    <div class="lbl">Your position</div>
    <div class="val money ${net > 0 ? "pos" : net < 0 ? "neg" : ""}">${net === 0 ? "All clear" : fmtSigned(net)}</div>
    <div class="note">${net > 0 ? "Friends owe you. Nudge them nicely." : net < 0 ? "You owe friends. Clear up below." : "Hisab barabar. Nothing pending."}</div>
  </div>`));

  const list = el(`<div class="list plain"></div>`);
  for (const m of g.members) {
    const v = bal.get(m.id) ?? 0;
    list.append(el(`<div class="row">
      ${avatarHtml(m)}
      <span class="grow"><span class="ttl">${esc(displayName(m))}</span></span>
      <span class="end"><span class="amt money ${v > 0 ? "pos" : v < 0 ? "neg" : "dim"}">${v === 0 ? "settled" : fmtSigned(v)}</span></span>
    </div>`));
  }
  box.append(list);

  const plan = simplify(bal);
  if (plan.length) {
    box.append(el(`<div class="section-cap">Smart settle · ${plan.length} transfer${plan.length > 1 ? "s" : ""}</div>`));
    const pl = el(`<div class="list plain"></div>`);
    for (const t of plan) {
      const from = store.memberOf(g, t.fromId);
      const to = store.memberOf(g, t.toId);
      const row = el(`<div class="row">
        ${avatarHtml(from, "sm")}
        <span class="chev">${I.arrowR}</span>
        ${avatarHtml(to, "sm")}
        <span class="grow"><span class="ttl">${esc(displayName(from))} pays ${esc(displayName(to))}</span></span>
        <span class="end"><span class="amt money">${fmt(t.amountP)}</span></span>
      </div>`);
      const btn = el(`<button class="btn primary small">Clear up</button>`);
      btn.addEventListener("click", () => settleSheet(g, t.fromId, t.toId, t.amountP));
      row.append(btn);
      pl.append(row);
    }
    box.append(pl);
  }

  if (setts.length) {
    box.append(el(`<div class="section-cap">Cleared</div>`));
    const sl = el(`<div class="list"></div>`);
    for (const s of setts) {
      const from = store.memberOf(g, s.fromId);
      const to = store.memberOf(g, s.toId);
      const badge = s.attachments?.length ? `<span class="badge ok">${I.clip}proof</span>` : "";
      const row = el(`<button class="row pressable">
        <span class="tile">${I.check}</span>
        <span class="grow"><span class="ttl">${esc(displayName(from))} paid ${esc(displayName(to))}</span>
          <span class="cap">${dayLabel(s.createdAt)}${s.note ? " · " + esc(s.note) : ""} ${badge}</span></span>
        <span class="end"><span class="amt money pos">${fmt(s.amountP)}</span></span>
      </button>`);
      row.addEventListener("click", async () => {
        if (s.attachments?.length) openViewer(await attUrl(s.attachments[0]));
      });
      sl.append(row);
    }
    box.append(sl);
  }
  return box;
}

function trailTab(g) {
  const box = el(`<div></div>`);
  const events = store.eventsOf(g.id);
  box.append(trailList(events));
  box.append(el(`<p class="hint" style="text-align:center;margin-top:18px">The trail is append-only. Nothing here can be edited or deleted.</p>`));
  return box;
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

async function welcomeSheet() {
  if (cloud.cloudReady && cloud.currentUser()) {
    await cloud.syncNow().catch(() => {});
    await store.init();
    if (store.state.profile) return;
    return welcomeNameSheet(cloud.currentUser()?.displayName ?? "");
  }
  if (cloud.cloudReady) return welcomeAuthSheet();
  welcomeNameSheet("");
}

// Google + phone sign-in controls, shared by the welcome sheet and the
// settings sign-in sheet.
function authOptions(onSignedIn) {
  const box = el(`<div>
    <button class="btn primary au-google">Continue with Google</button>
    <div style="height:10px"></div>
    <button class="btn ghost au-phone">Continue with phone number</button>
    <div class="au-phone-box" hidden>
      <label class="cap-label" for="au-num">Phone number</label>
      <input class="in" id="au-num" inputmode="tel" autocomplete="tel" value="+91 ">
      <button class="btn ghost au-send" style="margin-top:10px">Send code</button>
      <div class="au-code-box" hidden>
        <label class="cap-label" for="au-otp">Code from SMS</label>
        <input class="in money" id="au-otp" inputmode="numeric" autocomplete="one-time-code" placeholder="6 digits">
        <button class="btn primary au-verify" style="margin-top:10px">Verify and continue</button>
      </div>
    </div>
  </div>`);
  let confirmation = null;
  $(".au-google", box).addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      await cloud.signInGoogle();
      await onSignedIn();
    } catch (err) {
      e.target.disabled = false;
      if (err?.code !== "auth/popup-closed-by-user" && err?.code !== "auth/cancelled-popup-request")
        toast("Google sign-in didn't go through, try again");
    }
  });
  $(".au-phone", box).addEventListener("click", () => {
    $(".au-phone-box", box).hidden = false;
    $("#au-num", box).focus();
  });
  $(".au-send", box).addEventListener("click", async (e) => {
    const phone = $("#au-num", box).value.replace(/[^\d+]/g, "");
    if (!/^\+\d{8,15}$/.test(phone)) return toast("Enter the number with country code, like +91");
    e.target.disabled = true;
    try {
      confirmation = await cloud.sendPhoneCode(phone, e.target);
      $(".au-code-box", box).hidden = false;
      $("#au-otp", box).focus();
      toast("Code sent");
    } catch {
      toast("Couldn't send the code, check the number");
    }
    e.target.disabled = false;
  });
  $(".au-verify", box).addEventListener("click", async (e) => {
    const code = $("#au-otp", box).value.trim();
    if (!confirmation || code.length < 6) return toast("Enter the 6-digit code");
    e.target.disabled = true;
    try {
      await confirmation.confirm(code);
      await onSignedIn();
    } catch {
      e.target.disabled = false;
      toast("Wrong code, try again");
    }
  });
  return box;
}

async function afterSignIn(fromLocked) {
  await cloud.syncNow().catch(() => {});
  await store.init();
  if (fromLocked) closeLocked();
  else closeSheet();
  if (!store.state.profile) welcomeNameSheet(cloud.currentUser()?.displayName ?? "");
  else toast(`Welcome back, ${store.state.profile.name.split(/\s+/)[0]}`);
}

function welcomeAuthSheet() {
  const body = el(`<div>
    <div class="empty" style="padding:20px 8px 8px">
      <div class="mark">${MARK}</div>
      <h3>Settld</h3>
      <p>Split. Prove. Settle. Sign in so your groups, receipts and trail are backed up and follow you across devices.</p>
    </div>
    <div class="au-slot"></div>
    <div style="height:10px"></div>
    <button class="btn ghost au-skip" style="background:none;color:var(--text-2)">Not now, keep it on this device</button>
  </div>`);
  $(".au-slot", body).append(authOptions(() => afterSignIn(true)));
  openSheet({ body, locked: true });
  $(".au-skip", body).addEventListener("click", () => {
    closeLocked();
    welcomeNameSheet("");
  });
}

function authSheet() {
  const body = el(`<div style="padding-top:6px"></div>`);
  body.append(authOptions(() => afterSignIn(false)));
  openSheet({ title: "Sign in", body });
}

function welcomeNameSheet(prefill) {
  const body = el(`<div>
    <div class="empty" style="padding:20px 8px 8px">
      <div class="mark">${MARK}</div>
      <h3>Settld</h3>
      <p>Split. Prove. Settle. Shared expenses with receipts, a transparent trail and easy UPI clearing.</p>
    </div>
    <label class="cap-label" for="w-name">Your name</label>
    <input class="in" id="w-name" placeholder="Gaurav" autocomplete="name" value="${esc(prefill)}">
    <label class="cap-label" for="w-upi">Your UPI ID <span class="dim">(optional)</span></label>
    <input class="in" id="w-upi" placeholder="name@bank" autocapitalize="none">
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
  const box = el(`<div class="chips" style="margin-top:8px"></div>`);
  for (const e of GROUP_EMOJIS) {
    const c = el(`<button class="chip ${e === selected ? "on" : ""}" data-e="${e}" style="padding:0 12px">${e}</button>`);
    c.addEventListener("click", () => {
      for (const x of box.children) x.classList.toggle("on", x === c);
    });
    box.append(c);
  }
  return box;
}

function newGroupSheet() {
  const names = [];
  const body = el(`<div>
    <label class="cap-label" for="ng-name">Group name</label>
    <input class="in" id="ng-name" placeholder="Goa trip, Flat 302, Office lunch">
    <label class="cap-label">Icon</label>
    <div class="ng-emoji"></div>
    <label class="cap-label" for="ng-member">Members <span class="dim">(you're already in)</span></label>
    <div style="display:flex;gap:8px">
      <input class="in" id="ng-member" placeholder="Add a name" style="flex:1">
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
    names.push(n);
    const chip = el(`<span class="chip on">${esc(n)} <button aria-label="Remove ${esc(n)}" style="display:grid;color:inherit">${I.x}</button></span>`);
    chip.querySelector("button").firstElementChild?.setAttribute("style", "width:13px;height:13px");
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
    <input class="in" id="gs-name" value="${esc(g.name)}">
    <label class="cap-label">Icon</label>
    <div class="gs-emoji"></div>
    <div class="section-cap" style="margin-left:4px">Members</div>
    <div class="list plain" id="gs-members"></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <input class="in" id="gs-new" placeholder="Add a member" style="flex:1">
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
    <input class="in" id="ms-name" value="${esc(m.name)}">
    <label class="cap-label" for="ms-upi">UPI ID</label>
    <input class="in" id="ms-upi" value="${esc(m.upi ?? "")}" placeholder="name@bank" autocapitalize="none">
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

  const body = el(`<div>
    <input class="amount-in money" inputmode="decimal" placeholder="₹0" value="${esc(s.amountStr)}" aria-label="Amount">
    <input class="in" id="x-desc" placeholder="What was it? Dinner, cab, tickets" value="${esc(s.desc)}">
    <label class="cap-label">Category</label>
    <div class="chips x-cats"></div>
    <label class="cap-label" for="x-date">Date</label>
    <input class="in" id="x-date" type="date" value="${toDateInput(s.date)}">
    <label class="cap-label">Paid by</label>
    <div class="x-payers"></div>
    <label class="cap-label">Split between</label>
    <div class="chips x-parts"></div>
    <label class="cap-label">How to split</label>
    <div class="seg x-mode">
      <button data-m="equal">Equally</button>
      <button data-m="exact">Exact</button>
      <button data-m="percent">Percent</button>
      <button data-m="shares">Shares</button>
    </div>
    <div class="x-values"></div>
    <label class="cap-label">Proof <span class="dim">(receipt, UPI screenshot)</span></label>
    <div class="thumbs x-thumbs"></div>
    <input type="file" accept="image/*" multiple hidden class="x-file">
    <label class="cap-label" for="x-notes">Notes <span class="dim">(optional)</span></label>
    <input class="in" id="x-notes" placeholder="Anything the group should know" value="${esc(s.notes)}">
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
    const chip = el(`<button class="chip ${c.id === s.category ? "on" : ""}" data-c="${c.id}" style="padding-left:12px">${c.emoji} ${c.label}</button>`);
    chip.addEventListener("click", () => {
      s.category = c.id;
      for (const x of catBox.children) x.classList.toggle("on", x === chip);
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
        const chip = el(`<button class="chip ${on ? "on" : ""}">${avatarHtml(m, "sm")} ${esc(displayName(m))}</button>`);
        chip.addEventListener("click", () => {
          s.payers = [{ memberId: m.id, amountStr: "" }];
          renderPayers();
        });
        chips.append(chip);
      }
      payersBox.append(chips);
      const link = el(`<button class="hint" style="background:none;font-weight:650;color:var(--text-2);margin-top:8px">+ Multiple people paid</button>`);
      link.addEventListener("click", () => {
        s.multi = true;
        renderPayers();
      });
      payersBox.append(link);
    } else {
      for (const m of g.members) {
        const cur = s.payers.find((p) => p.memberId === m.id);
        const row = el(`<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
          <button class="chip ${cur ? "on" : ""}" style="flex:1;justify-content:flex-start">${avatarHtml(m, "sm")} ${esc(displayName(m))}</button>
          <input class="in money" inputmode="decimal" placeholder="₹0" value="${esc(cur?.amountStr ?? "")}"
            style="width:110px;height:42px;border-radius:14px;text-align:right" ${cur ? "" : "disabled"}>
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
      const hint = el(`<div class="hint x-payhint"></div>`);
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
      const chip = el(`<button class="chip ${on ? "on" : ""}">${avatarHtml(m, "sm")} ${esc(displayName(m))}</button>`);
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
    for (const b of modeSeg.querySelectorAll("button")) b.classList.toggle("on", b.dataset.m === s.mode);
  };
  markMode();
  modeSeg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-m]");
    if (!b) return;
    s.mode = b.dataset.m;
    markMode();
    renderValues();
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
        <input class="in money" inputmode="decimal" placeholder="0" value="${esc(s.values.get(idm) ?? "")}"
          style="width:110px;height:42px;border-radius:14px;text-align:right">
        <span class="dim" style="width:38px;font-size:13px">${unit}</span>
      </div>`);
      row.querySelector("input").addEventListener("input", (e) => {
        s.values.set(idm, e.target.value);
        updateValueHint();
      });
      valuesBox.append(row);
    }
    valuesBox.append(el(`<div class="hint x-valhint"></div>`));
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
      const sum = ids.reduce((a, idm) => a + (Number(s.values.get(idm)) || 0), 0);
      ok = Math.abs(sum - 100) < 0.01;
      text = ok ? "That's 100%" : `${sum}% assigned, needs 100%`;
    } else {
      const sum = ids.reduce((a, idm) => a + (Number(s.values.get(idm)) || 0), 0);
      ok = sum > 0;
      text = ok ? `${sum} shares total` : "Give at least one share";
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
      const img = a.id
        ? el(`<img class="thumb pressable" data-att="${a.id}" alt="Proof">`)
        : el(`<img class="thumb pressable" src="${a.url}" alt="Proof">`);
      img.addEventListener("click", async () => {
        openViewer(a.id ? await attUrl(a.id) : a.url, {
          onRemove: () => {
            s.att.splice(i, 1);
            renderThumbs();
          },
        });
      });
      thumbs.append(img);
    });
    const add = el(`<button class="thumb-add pressable" aria-label="Attach proof">${I.camera}</button>`);
    add.addEventListener("click", () => fileIn.click());
    thumbs.append(add);
    hydrate(thumbs);
  }
  fileIn.addEventListener("change", () => {
    for (const f of fileIn.files) s.att.push({ blob: f, url: URL.createObjectURL(f), name: f.name });
    fileIn.value = "";
    renderThumbs();
  });
  renderThumbs();

  const foot = el(`<button class="btn primary">${existing ? "Save changes" : "Add expense"}</button>`);
  openSheet({ title: existing ? "Edit expense" : "New expense", body, footer: foot });
  if (!existing) setTimeout(() => amountIn.focus(), 350);

  foot.addEventListener("click", async () => {
    const amountP = toPaise(s.amountStr);
    if (!Number.isFinite(amountP) || amountP <= 0) return toast("Enter the amount first");
    const desc = s.desc.trim();
    if (!desc) return toast("Give it a name");
    const ids = [...s.parts];
    if (!ids.length) return toast("Pick who shares this");

    let participants;
    if (s.mode === "equal") participants = ids.map((idm) => ({ memberId: idm }));
    else if (s.mode === "exact") {
      const rows = ids.map((idm) => ({ memberId: idm, valueP: toPaise(s.values.get(idm)) || 0 }));
      if (rows.reduce((a, r) => a + r.valueP, 0) !== amountP) return toast("Exact amounts must add up to the total");
      participants = rows;
    } else {
      const rows = ids.map((idm) => ({ memberId: idm, value: Number(s.values.get(idm)) || 0 }));
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
    for (const a of s.att) attIds.push(a.id ?? (await store.addAttachment(a.blob, a.name)));

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

  const body = el(`<div>
    <div class="position" style="margin-top:4px;background:var(--surface-2)">
      <div class="lbl">${catOf(e.category).emoji} ${esc(catOf(e.category).label)} · ${dayLabel(e.date)}</div>
      <div class="val money">${fmt(e.amountP)}</div>
      <div class="note">Paid by ${esc(paidBy)}, split ${modeLabel} between ${e.split.participants.length}</div>
      ${e.notes ? `<div class="note">"${esc(e.notes)}"</div>` : ""}
    </div>
    <div class="section-cap" style="margin-left:4px">Who owes what</div>
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
    wrap.append(el(`<div class="section-cap" style="margin-left:4px">Proof</div>`));
    const t = el(`<div class="thumbs"></div>`);
    for (const id of e.attachments) {
      const img = el(`<img class="thumb pressable" data-att="${id}" alt="Proof">`);
      img.addEventListener("click", async () => openViewer(await attUrl(id)));
      t.append(img);
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
    ${to.upi
      ? `<a class="btn ghost" id="se-upi">${I.upi} Pay ${esc(displayName(to))} via UPI</a>
         <div class="hint" style="text-align:center">Opens your UPI app with the amount filled in</div>`
      : `<div class="hint" style="text-align:center">${esc(displayName(to))} has no UPI ID saved. Add one in group settings for one-tap payment.</div>`}
    <label class="cap-label">Payment proof <span class="dim">(screenshot, optional)</span></label>
    <div class="thumbs se-thumbs"></div>
    <input type="file" accept="image/*" multiple hidden class="se-file">
    <label class="cap-label" for="se-note">Note <span class="dim">(optional)</span></label>
    <input class="in" id="se-note" placeholder="GPay, cash, adjusted in rent">
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
      const img = el(`<img class="thumb pressable" src="${a.url}" alt="Proof">`);
      img.addEventListener("click", () =>
        openViewer(a.url, { onRemove: () => { att.splice(i, 1); renderThumbs(); } }),
      );
      thumbs.append(img);
    });
    const add = el(`<button class="thumb-add pressable" aria-label="Attach proof">${I.camera}</button>`);
    add.addEventListener("click", () => fileIn.click());
    thumbs.append(add);
  }
  fileIn.addEventListener("change", () => {
    for (const f of fileIn.files) att.push({ blob: f, url: URL.createObjectURL(f), name: f.name });
    fileIn.value = "";
    renderThumbs();
  });
  renderThumbs();

  const foot = el(`<button class="btn primary">${I.check} Mark as settled</button>`);
  openSheet({ title: "Clear up", body, footer: foot });

  foot.addEventListener("click", async () => {
    const p = toPaise(amountIn.value);
    if (!Number.isFinite(p) || p <= 0) return toast("Enter the amount");
    foot.disabled = true;
    const ids = [];
    for (const a of att) ids.push(await store.addAttachment(a.blob, a.name));
    await store.addSettlement(g, {
      fromId,
      toId,
      amountP: p,
      note: $("#se-note", body).value.trim(),
      attachments: ids,
    });
    closeSheet();
    toast(`${fmt(p)} cleared`);
  });
}

/* ---------- boot ---------- */

applyTheme(localStorage.getItem("settld-theme") ?? "dark");
initDock();
store.subscribe(render);
cloud.setOnSynced(() => store.init());
cloud.onAuth(() => {
  if (store.state.ready) render();
});
store.init().then(async () => {
  applyTheme(store.state.profile?.theme ?? localStorage.getItem("settld-theme") ?? "dark");
  render();
  if (cloud.cloudReady) {
    await cloud.initCloud();
    await cloud.authReady;
  }
  if (!store.state.profile) welcomeSheet();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
