// Firebase cloud layer: sign-in (Google, phone) and a per-user Firestore
// mirror of the local ledger. IndexedDB stays the source of truth; every
// local write is forwarded up, failures land in an outbox that flushes when
// back online, and sign-in merges cloud and device (newer record wins,
// events and settlements are immutable so missing ones just copy across).
// Receipts are compressed client-side and mirrored as base64 inside
// Firestore docs, which keeps the whole thing on the free Spark plan.

import { db, setMirror } from "./db.js";
import { firebaseConfig } from "./firebase-config.js";

export const cloudReady = Boolean(firebaseConfig?.apiKey);

const SDK = "https://www.gstatic.com/firebasejs/12.1.0/";
let mods = null;
let auth = null;
let fs = null;
let user = null;
let syncing = false;

const authCbs = new Set();
export function onAuth(cb) {
  authCbs.add(cb);
  cb(user);
}
export const currentUser = () => user;

let syncedCb = null;
export function setOnSynced(fn) {
  syncedCb = fn;
}

// Resolves after Firebase restores the persisted session (or reports none),
// so boot can decide between the sign-in sheet and the local name sheet.
let authReadyResolve = null;
export const authReady = new Promise((r) => {
  authReadyResolve = r;
});

export async function initCloud() {
  if (!cloudReady) return;
  const [a, au, f] = await Promise.all([
    import(SDK + "firebase-app.js"),
    import(SDK + "firebase-auth.js"),
    import(SDK + "firebase-firestore.js"),
  ]);
  mods = { ...au, ...f };
  const app = a.initializeApp(firebaseConfig);
  auth = au.getAuth(app);
  fs = f.getFirestore(app);
  setMirror(mirrorWrite);
  addEventListener("online", () => flushOutbox().catch(() => {}));
  au.onAuthStateChanged(auth, (u) => {
    user = u;
    authReadyResolve?.();
    authReadyResolve = null;
    for (const cb of authCbs) cb(u);
    if (u) syncNow().catch(() => {});
  });
  try {
    await au.getRedirectResult(auth);
  } catch {
    /* redirect result is best-effort */
  }
}

/* ---- sign in / out ---- */

export async function signInGoogle() {
  const p = new mods.GoogleAuthProvider();
  try {
    await mods.signInWithPopup(auth, p);
  } catch (e) {
    if (e?.code === "auth/popup-blocked" || e?.code === "auth/operation-not-supported-in-this-environment") {
      await mods.signInWithRedirect(auth, p);
      return;
    }
    throw e;
  }
  user = auth.currentUser;
}

let recaptcha = null;
export async function sendPhoneCode(phone, anchorEl) {
  try {
    recaptcha?.clear();
  } catch {
    /* stale verifier from a closed sheet */
  }
  recaptcha = new mods.RecaptchaVerifier(auth, anchorEl, { size: "invisible" });
  return mods.signInWithPhoneNumber(auth, phone, recaptcha);
}

export async function signOutCloud() {
  await mods.signOut(auth);
}

export function accountLabel() {
  if (!user) return "";
  return user.displayName || user.email || user.phoneNumber || "Signed in";
}

/* ---- mirror: local write -> Firestore ---- */

const MIRRORED = new Set(["groups", "expenses", "settlements", "events", "attachments"]);
const uref = (path) => mods.doc(fs, `users/${user.uid}/${path}`);

function mirrorWrite(op, storeName, payload) {
  if (!user) return;
  applyMirror(op, storeName, payload).catch(() => queueOutbox(op, storeName, payload));
}

async function applyMirror(op, storeName, payload) {
  if (op === "kv") {
    if (storeName !== "profile" || !payload) return;
    await mods.setDoc(uref("meta/profile"), payload);
    return;
  }
  if (!MIRRORED.has(storeName)) return;
  if (op === "del") {
    await mods.deleteDoc(uref(`${storeName}/${payload}`));
    return;
  }
  let rec = payload;
  if (storeName === "attachments") rec = await attToDoc(payload);
  await mods.setDoc(uref(`${storeName}/${rec.id}`), rec);
}

async function attToDoc(a) {
  const b64 = await blobToB64(a.blob);
  const meta = { id: a.id, mime: a.mime, name: a.name ?? "proof", ts: a.ts };
  // Firestore docs cap at ~1 MiB; compressed receipts fit comfortably,
  // anything that somehow doesn't keeps its metadata only.
  return b64.length > 900000 ? { ...meta, tooBig: true } : { ...meta, b64 };
}

function blobToB64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
}

/* ---- outbox: failed mirrors retry when back online ---- */

async function queueOutbox(op, storeName, payload) {
  const key = op === "del" ? payload : op === "kv" ? storeName : payload.id;
  const ob = (await db.kvGet("outbox")) ?? [];
  if (!ob.some((x) => x.op === op && x.store === storeName && x.key === key)) {
    ob.push({ op, store: storeName, key });
    await db.kvSet("outbox", ob, true);
  }
}

export async function flushOutbox() {
  if (!user) return;
  const ob = (await db.kvGet("outbox")) ?? [];
  if (!ob.length) return;
  const rest = [];
  for (const item of ob) {
    try {
      if (item.op === "del") await applyMirror("del", item.store, item.key);
      else if (item.op === "kv") await applyMirror("kv", "profile", await db.kvGet("profile"));
      else {
        const rec = await db.get(item.store, item.key);
        if (rec) await applyMirror("put", item.store, rec);
      }
    } catch {
      rest.push(item);
    }
  }
  await db.kvSet("outbox", rest, true);
}

/* ---- full two-way merge ---- */

const tsOf = (r) => r?.updatedAt ?? r?.ts ?? r?.createdAt ?? 0;

export async function syncNow() {
  user = auth?.currentUser ?? user;
  if (!user || syncing) return;
  syncing = true;
  try {
    await flushOutbox();
    for (const s of ["groups", "expenses", "settlements", "events"]) {
      const remote = await mods.getDocs(mods.collection(fs, `users/${user.uid}/${s}`));
      const remoteIds = new Set();
      for (const d of remote.docs) {
        const r = d.data();
        remoteIds.add(r.id);
        const local = await db.get(s, r.id);
        if (!local || tsOf(r) > tsOf(local)) await db.put(s, r, true);
      }
      for (const l of await db.all(s)) {
        if (!remoteIds.has(l.id)) await applyMirror("put", s, l).catch(() => {});
      }
    }
    const remoteAtt = await mods.getDocs(mods.collection(fs, `users/${user.uid}/attachments`));
    const attIds = new Set();
    for (const d of remoteAtt.docs) {
      const r = d.data();
      attIds.add(r.id);
      const local = await db.get("attachments", r.id);
      if (!local && r.b64) {
        await db.put("attachments", { id: r.id, blob: b64ToBlob(r.b64, r.mime), mime: r.mime, name: r.name, ts: r.ts }, true);
      }
    }
    for (const l of await db.all("attachments")) {
      if (!attIds.has(l.id)) await applyMirror("put", "attachments", l).catch(() => {});
    }
    const remoteProfile = await mods.getDoc(uref("meta/profile"));
    const localProfile = await db.kvGet("profile");
    if (remoteProfile.exists() && !localProfile) await db.kvSet("profile", remoteProfile.data(), true);
    else if (localProfile) await applyMirror("kv", "profile", localProfile).catch(() => {});
  } finally {
    syncing = false;
  }
  syncedCb?.();
}
