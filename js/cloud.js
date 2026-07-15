// Firebase cloud layer: Google sign-in and a per-user Firestore
// mirror of the local ledger. IndexedDB stays the source of truth; every
// local write is forwarded up, failures land in an outbox that flushes when
// back online. Sign-in merges cloud and device (newer record wins), while
// tombstones carry hard deletions and account ownership prevents UID mixing.
// Receipts are compressed client-side and mirrored as base64 inside
// Firestore docs, which keeps the whole thing on the free Spark plan.

import { db, setMirror } from "./db.js";
import { firebaseConfig } from "./firebase-config.js";
import { LIMITS, normalizeProfile } from "./store.js";

export const cloudReady = Boolean(firebaseConfig?.apiKey);
let available = false;
export const cloudAvailable = () => available;

const SDK = "https://www.gstatic.com/firebasejs/12.1.0/";
let mods = null;
let auth = null;
let fs = null;
let user = null;
let activeOwnerUid = null;
let syncPromise = null;
let syncUid = null;
let outboxLock = Promise.resolve();
let outboxCount = 0;
let inFlightWrites = 0;
let verifiedUid = null;
let failedUid = null;
const mirrorWrites = new Set();
let erasingUid = null;
let resetApplyPromise = Promise.resolve();
let resetEpoch = 0;
export const pendingWriteCount = () => outboxCount + inFlightWrites;

let statusCb = null;
export function setOnStatus(fn) {
  statusCb = fn;
}
function notifyStatus() {
  statusCb?.();
}
export function backupStatus() {
  if (!navigator.onLine) return "offline";
  if (!user) return "local";
  if (!available) return "unavailable";
  if (syncPromise) return "syncing";
  if (pendingWriteCount()) return "pending";
  if (verifiedUid === user.uid) return "synced";
  if (failedUid === user.uid) return "error";
  return "unconfirmed";
}

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
  available = true;
  addEventListener("online", () => syncNow().catch(() => {}));
  au.onAuthStateChanged(auth, (u) => {
    user = u;
    if (!u) {
      activeOwnerUid = null;
      verifiedUid = null;
      failedUid = null;
    }
    notifyStatus();
    authReadyResolve?.();
    authReadyResolve = null;
    for (const cb of authCbs) cb(u);
  });
}

/* ---- sign in / out ---- */

export async function signInGoogle() {
  const p = new mods.GoogleAuthProvider();
  await mods.signInWithPopup(auth, p);
  user = auth.currentUser;
}

export async function signOutCloud() {
  try {
    await mods.signOut(auth);
  } finally {
    erasingUid = null;
  }
}

export function accountLabel() {
  if (!user) return "";
  return user.displayName || user.email || user.phoneNumber || "Signed in";
}

/* ---- mirror: local write -> Firestore ---- */

const DATA_STORES = ["groups", "expenses", "settlements", "events", "attachments"];
const MIRRORED = new Set(DATA_STORES);
const userRef = (uid, path) => mods.doc(fs, `users/${uid}/${path}`);
const resetKey = (uid) => `cloudResetAt:${uid}`;
const tombstoneId = (storeName, key) => encodeURIComponent(`${storeName}:${key}`);
const tsOf = (record) => Number(record?.updatedAt ?? record?.ts ?? record?.createdAt ?? 0);

function accountMismatch() {
  const error = new Error("This device is linked to another Settld account");
  error.code = "cloud/account-mismatch";
  return error;
}

export const isAccountMismatch = (error) => error?.code === "cloud/account-mismatch";

async function claimLocalData(expectedUid = user?.uid) {
  const uid = expectedUid;
  if (!uid) return null;
  if (auth?.currentUser?.uid !== uid) throw new Error("cloud/account-changed");
  const ownerUid = await db.kvGet("cloudOwnerUid");
  if (ownerUid && ownerUid !== uid) throw accountMismatch();
  if (!ownerUid) await db.kvSet("cloudOwnerUid", uid, true);
  activeOwnerUid = uid;
  return uid;
}

async function applyRemoteReset(ownerUid, resetAt, force = false) {
  const task = resetApplyPromise.catch(() => {}).then(async () => {
    const current = Number((await db.kvGet(resetKey(ownerUid))) ?? 0);
    if (!resetAt || (!force && resetAt <= current)) return false;
    const localOwner = await db.kvGet("cloudOwnerUid");
    if (localOwner && localOwner !== ownerUid) throw accountMismatch();
    const appliedResetAt = Math.max(resetAt, current);
    await db.wipe();
    await db.kvSet("cloudOwnerUid", ownerUid, true);
    await db.kvSet(resetKey(ownerUid), appliedResetAt, true);
    activeOwnerUid = ownerUid;
    outboxCount = 0;
    verifiedUid = null;
    failedUid = null;
    resetEpoch += 1;
    notifyStatus();
    return true;
  });
  resetApplyPromise = task.catch(() => {});
  return task;
}

function mirrorWrite(op, storeName, payload) {
  const durableDelete = op === "del" && MIRRORED.has(storeName)
    ? queueOutbox(op, storeName, payload)
    : Promise.resolve();
  if (user && erasingUid === user.uid) {
    verifiedUid = null;
    notifyStatus();
    return op === "del" ? durableDelete : undefined;
  }
  if (!user || activeOwnerUid !== user.uid) {
    if (!user) return op === "del" ? durableDelete : undefined;
    verifiedUid = null;
    notifyStatus();
    return op === "del" ? durableDelete : undefined;
  }
  const ownerUid = user.uid;
  inFlightWrites += 1;
  notifyStatus();
  const remoteWrite = durableDelete
    .then(() => applyMirror(op, storeName, payload, ownerUid))
    .then(async (result) => {
      if (op === "del") return removeOutboxItem(storeName, payload);
      if (result?.localChanged) await syncedCb?.();
      if (failedUid === ownerUid) failedUid = null;
    })
    .catch(async () => {
      failedUid = ownerUid;
      if (op !== "del") {
        try {
          await queueOutbox(op, storeName, payload);
        } catch {
          /* the status remains failed; a later local write can retry the queue */
        }
      }
    })
    .finally(() => {
      inFlightWrites = Math.max(0, inFlightWrites - 1);
      notifyStatus();
    });
  mirrorWrites.add(remoteWrite);
  remoteWrite.then(
    () => mirrorWrites.delete(remoteWrite),
    () => mirrorWrites.delete(remoteWrite),
  );
  return op === "del" ? durableDelete : undefined;
}

// Register immediately so signed-out/offline hard deletes still become local
// tombstones even when the Firebase SDK cannot load on this visit.
setMirror(mirrorWrite);

async function applyMirror(op, storeName, payload, ownerUid = user?.uid) {
  if (!ownerUid) throw new Error("cloud/no-user");
  const ref = (path) => userRef(ownerUid, path);
  if (op === "kv") {
    if (storeName !== "profile" || !payload) return;
    return writeProfileIfNewer(ownerUid, ref("meta/profile"), payload);
  }
  if (!MIRRORED.has(storeName)) return;
  if (op === "del") {
    await mods.setDoc(ref(`tombstones/${tombstoneId(storeName, payload)}`), {
      store: storeName,
      key: String(payload),
      deletedAt: Date.now(),
    });
    await mods.deleteDoc(ref(`${storeName}/${payload}`));
    return;
  }
  let rec = payload;
  if (storeName === "attachments") rec = await attToDoc(payload);
  return writeRecordIfNewer(ownerUid, storeName, rec, ref(`${storeName}/${rec.id}`));
}

async function writeProfileIfNewer(ownerUid, docRef, record) {
  const localResetAt = Number((await db.kvGet(resetKey(ownerUid))) ?? 0);
  const stateRef = userRef(ownerUid, "meta/state");
  const outcome = await mods.runTransaction(fs, async (transaction) => {
    const stateSnap = await transaction.get(stateRef);
    const snap = await transaction.get(docRef);
    const remoteResetAt = Number(stateSnap.data()?.resetAt ?? 0);
    if (remoteResetAt > localResetAt) return { resetAt: remoteResetAt };
    if (!snap.exists() || tsOf(record) > tsOf(snap.data())) {
      transaction.set(docRef, record);
      return { written: true };
    }
    return { remote: normalizeProfile(snap.data()) };
  });
  if (outcome.resetAt) {
    outcome.localChanged = await applyRemoteReset(ownerUid, outcome.resetAt);
  } else if (outcome.remote) {
    const current = await db.kvGet("profile");
    if (current && tsOf(current) === tsOf(record) && JSON.stringify(current) === JSON.stringify(record)) {
      await db.kvSet("profile", outcome.remote, true);
      outcome.localChanged = true;
    }
  }
  return outcome;
}

async function writeRecordIfNewer(ownerUid, storeName, record, docRef) {
  const tombRef = userRef(ownerUid, `tombstones/${tombstoneId(storeName, record.id)}`);
  const stateRef = userRef(ownerUid, "meta/state");
  const localResetAt = Number((await db.kvGet(resetKey(ownerUid))) ?? 0);
  const deleteVersion = db.deleteVersion(storeName, record.id);
  const outcome = await mods.runTransaction(fs, async (transaction) => {
    const stateSnap = await transaction.get(stateRef);
    const tombstone = await transaction.get(tombRef);
    const snap = await transaction.get(docRef);
    const remoteResetAt = Number(stateSnap.data()?.resetAt ?? 0);
    if (remoteResetAt > localResetAt) return { resetAt: remoteResetAt };
    if (tombstone.exists()) return { deleted: true };
    const remote = snap.data();
    const shouldWrite = !snap.exists()
      || (storeName === "attachments" ? !remote?.b64 : tsOf(record) > tsOf(remote));
    if (shouldWrite) {
      transaction.set(docRef, record);
      return { written: true };
    }
    return { remote };
  });
  if (outcome.resetAt) {
    outcome.localChanged = await applyRemoteReset(ownerUid, outcome.resetAt);
  } else if (outcome.deleted) {
    await db.del(storeName, record.id, true);
    outcome.localChanged = true;
  } else if (outcome.remote && storeName !== "attachments") {
    const current = await db.get(storeName, record.id);
    if (current
      && db.deleteVersion(storeName, record.id) === deleteVersion
      && tsOf(current) === tsOf(record)
      && JSON.stringify(current) === JSON.stringify(record)) {
      await db.put(storeName, outcome.remote, true);
      outcome.localChanged = true;
    }
  }
  return outcome;
}

async function attToDoc(a) {
  const b64 = await blobToB64(a.blob);
  const meta = {
    id: a.id,
    mime: String(a.mime || a.blob?.type || "image/jpeg"),
    name: String(a.name ?? "proof").slice(0, LIMITS.attachmentName),
    ts: Number.isInteger(a.ts) ? a.ts : Date.now(),
  };
  // Firestore docs cap at ~1 MiB. The store compressor targets a safe size;
  // older oversized blobs stay pending rather than pretending they backed up.
  if (b64.length > 900000) throw new Error("proof/too-large");
  return { ...meta, b64 };
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

function withOutboxLock(work) {
  const task = outboxLock.catch(() => {}).then(work);
  outboxLock = task.catch(() => {});
  return task;
}

async function queueOutbox(op, storeName, payload) {
  const key = op === "del" ? payload : op === "kv" ? storeName : payload.id;
  return withOutboxLock(async () => {
    let ob = (await db.kvGet("outbox")) ?? [];
    const same = (x) => x.store === storeName && x.key === key;
    if (op === "del") {
      ob = ob.filter((x) => !same(x));
      ob.push({ op, store: storeName, key });
    } else if (!ob.some((x) => same(x) && x.op === "del")) {
      ob = ob.filter((x) => !same(x));
      ob.push({ op, store: storeName, key });
    }
    await db.kvSet("outbox", ob, true);
    outboxCount = ob.length;
    notifyStatus();
  });
}

async function removeOutboxItem(storeName, key) {
  return withOutboxLock(async () => {
    const ob = (await db.kvGet("outbox")) ?? [];
    const rest = ob.filter((item) => !(item.op === "del" && item.store === storeName && item.key === key));
    await db.kvSet("outbox", rest, true);
    outboxCount = rest.length;
    notifyStatus();
  });
}

export async function flushOutbox(expectedUid, mode = "all") {
  if (!user) return [];
  const ownerUid = expectedUid ?? (activeOwnerUid === user.uid ? user.uid : await claimLocalData());
  if (auth?.currentUser?.uid !== ownerUid) throw new Error("cloud/account-changed");
  return withOutboxLock(async () => {
    const ob = (await db.kvGet("outbox")) ?? [];
    outboxCount = ob.length;
    notifyStatus();
    if (!ob.length) return [];
    const rest = [];
    for (const item of ob) {
      if (mode === "deletes" && item.op !== "del") {
        rest.push(item);
        continue;
      }
      try {
        if (item.op === "del") await applyMirror("del", item.store, item.key, ownerUid);
        else if (item.op === "kv") await applyMirror("kv", "profile", await db.kvGet("profile"), ownerUid);
        else {
          const rec = await db.get(item.store, item.key);
          if (rec) await applyMirror("put", item.store, rec, ownerUid);
        }
      } catch {
        rest.push(item);
      }
    }
    await db.kvSet("outbox", rest, true);
    outboxCount = rest.length;
    if (rest.length) failedUid = ownerUid;
    notifyStatus();
    return rest;
  });
}

/* ---- full two-way merge ---- */

export const mergeDirection = (local, remote) => {
  if (!local && remote) return "remote";
  if (local && !remote) return "local";
  if (!local && !remote) return "equal";
  if (tsOf(remote) > tsOf(local)) return "remote";
  if (tsOf(local) > tsOf(remote)) return "local";
  return "equal";
};

async function runSync(expectedUid, resetAttempt = 0) {
  const uid = await claimLocalData(expectedUid);
  if (!uid) return;
  const ref = (path) => userRef(uid, path);
  try {
    const stateSnap = await mods.getDoc(ref("meta/state"));
    const remoteResetAt = Number(stateSnap.data()?.resetAt ?? 0);
    const localResetAt = Number((await db.kvGet(resetKey(uid))) ?? 0);
    if (remoteResetAt > localResetAt) {
      await applyRemoteReset(uid, remoteResetAt);
    }
    const syncResetEpoch = resetEpoch;

    // Deletes must land before reading remote collections, while queued puts
    // wait until after the newer-side merge so stale offline data cannot win.
    const deferred = await flushOutbox(uid, "deletes");
    const tombstones = new Set(
      deferred.filter((item) => item.op === "del").map((item) => `${item.store}:${item.key}`),
    );
    for (const key of tombstones) {
      const split = key.indexOf(":");
      await db.del(key.slice(0, split), key.slice(split + 1), true);
    }
    const remoteTombstones = await mods.getDocs(mods.collection(fs, `users/${uid}/tombstones`));
    for (const d of remoteTombstones.docs) {
      const t = d.data();
      if (!MIRRORED.has(t.store) || !t.key) continue;
      tombstones.add(`${t.store}:${t.key}`);
      await db.del(t.store, t.key, true);
      await mods.deleteDoc(ref(`${t.store}/${t.key}`)).catch(() => {});
    }

    for (const s of ["groups", "expenses", "settlements", "events"]) {
      const remote = await mods.getDocs(mods.collection(fs, `users/${uid}/${s}`));
      const remoteIds = new Set();
      for (const d of remote.docs) {
        const r = d.data();
        if (tombstones.has(`${s}:${r.id}`) || (remoteResetAt && tsOf(r) <= remoteResetAt)) {
          await mods.deleteDoc(d.ref).catch(() => {});
          continue;
        }
        remoteIds.add(r.id);
        const local = await db.get(s, r.id);
        const direction = mergeDirection(local, r);
        if (direction === "remote") await db.put(s, r, true);
        else if (direction === "local") await applyMirror("put", s, local, uid);
      }
      for (const l of await db.all(s)) {
        if (!remoteIds.has(l.id) && !tombstones.has(`${s}:${l.id}`) && (!remoteResetAt || tsOf(l) > remoteResetAt)) {
          await applyMirror("put", s, l, uid);
        }
      }
    }
    const remoteAtt = await mods.getDocs(mods.collection(fs, `users/${uid}/attachments`));
    const attIds = new Set();
    let unresolvedRemoteProof = false;
    for (const d of remoteAtt.docs) {
      const r = d.data();
      if (tombstones.has(`attachments:${r.id}`) || (remoteResetAt && tsOf(r) <= remoteResetAt)) {
        await mods.deleteDoc(d.ref).catch(() => {});
        continue;
      }
      const local = await db.get("attachments", r.id);
      if (!r.b64) {
        // v0.2 wrote metadata-only placeholders for oversized proofs. Repair
        // them from the original device when possible; never count a missing
        // blob as a successful backup on a fresh device.
        if (local) {
          attIds.add(r.id);
          try {
            await applyMirror("put", "attachments", local, uid);
          } catch {
            await queueOutbox("put", "attachments", local);
          }
        } else {
          unresolvedRemoteProof = true;
        }
        continue;
      }
      attIds.add(r.id);
      if (!local) {
        await db.put("attachments", { id: r.id, blob: b64ToBlob(r.b64, r.mime), mime: r.mime, name: r.name, ts: r.ts }, true);
      }
    }
    for (const l of await db.all("attachments")) {
      if (!attIds.has(l.id) && !tombstones.has(`attachments:${l.id}`) && (!remoteResetAt || tsOf(l) > remoteResetAt)) {
        try {
          await applyMirror("put", "attachments", l, uid);
        } catch {
          await queueOutbox("put", "attachments", l);
        }
      }
    }
    const remoteProfile = await mods.getDoc(ref("meta/profile"));
    const localProfile = await db.kvGet("profile");
    const rawRemoteProfile = remoteProfile.data();
    const remoteProfileData = normalizeProfile(rawRemoteProfile);
    if (remoteProfile.exists() && remoteResetAt && tsOf(rawRemoteProfile) <= remoteResetAt) {
      await mods.deleteDoc(remoteProfile.ref).catch(() => {});
    } else if (remoteProfile.exists() && (!localProfile || tsOf(rawRemoteProfile) > tsOf(localProfile))) {
      await db.kvSet("profile", remoteProfileData, true);
      if (JSON.stringify(rawRemoteProfile) !== JSON.stringify(remoteProfileData)) {
        await applyMirror("kv", "profile", remoteProfileData, uid);
      }
    } else if (localProfile && (!remoteResetAt || tsOf(localProfile) > remoteResetAt)) {
      await applyMirror("kv", "profile", localProfile, uid);
    }
    await flushOutbox(uid);
    const finalState = await mods.getDoc(ref("meta/state"));
    const finalResetAt = Number(finalState.data()?.resetAt ?? 0);
    if (finalResetAt > remoteResetAt || resetEpoch !== syncResetEpoch) {
      if (resetAttempt >= 2) throw new Error("cloud/reset-churn");
      const appliedResetAt = Math.max(finalResetAt, Number((await db.kvGet(resetKey(uid))) ?? 0));
      await applyRemoteReset(uid, appliedResetAt, true);
      return runSync(uid, resetAttempt + 1);
    }
    if (unresolvedRemoteProof) throw new Error("proof/missing-cloud-data");
    verifiedUid = uid;
    failedUid = null;
    syncedCb?.();
  } catch (error) {
    if (user?.uid === uid) {
      verifiedUid = null;
      failedUid = uid;
    }
    throw error;
  } finally {
    notifyStatus();
  }
}

export function syncNow() {
  user = auth?.currentUser ?? user;
  if (!user) return Promise.resolve();
  const requestedUid = user.uid;
  if (syncPromise && syncUid !== requestedUid) return syncPromise.catch(() => {}).then(() => syncNow());
  if (!syncPromise) {
    syncUid = requestedUid;
    syncPromise = runSync(requestedUid).finally(() => {
      syncPromise = null;
      syncUid = null;
      notifyStatus();
    });
    notifyStatus();
  }
  return syncPromise;
}

async function deleteUserCollection(name, uid) {
  while (true) {
    const snap = await mods.getDocs(mods.query(mods.collection(fs, `users/${uid}/${name}`), mods.limit(400)));
    if (snap.empty) return;
    const batch = mods.writeBatch(fs);
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  }
}

export async function eraseCloudData() {
  user = auth?.currentUser ?? user;
  if (!user) return { ownerUid: null, resetAt: null, cleanupPending: false };
  if (!navigator.onLine) throw new Error("cloud/offline");
  const ownerUid = await claimLocalData();
  erasingUid = ownerUid;
  verifiedUid = null;
  notifyStatus();
  try {
    if (syncPromise) await syncPromise.catch(() => {});
    while (mirrorWrites.size) await Promise.allSettled([...mirrorWrites]);
    const ref = (path) => userRef(ownerUid, path);
    const requestedResetAt = Date.now();
    const resetAt = await mods.runTransaction(fs, async (transaction) => {
      const stateRef = ref("meta/state");
      const snap = await transaction.get(stateRef);
      const next = Math.max(requestedResetAt, Number(snap.data()?.resetAt ?? 0) + 1);
      transaction.set(stateRef, { resetAt: next });
      return next;
    });
    let cleanupPending = false;
    for (const name of [...DATA_STORES, "tombstones"]) {
      try {
        await deleteUserCollection(name, ownerUid);
      } catch {
        cleanupPending = true;
      }
    }
    try {
      await mods.deleteDoc(ref("meta/profile"));
    } catch {
      cleanupPending = true;
    }
    return { ownerUid, resetAt, cleanupPending };
  } catch (error) {
    erasingUid = null;
    throw error;
  }
}
