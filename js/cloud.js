// Firebase cloud layer: Google sign-in and a per-user Firestore
// mirror of the local ledger. IndexedDB stays the source of truth; every
// local write is forwarded up, failures land in an outbox that flushes when
// back online. Sign-in merges cloud and device (newer record wins), while
// tombstones carry hard deletions and account ownership prevents UID mixing.
// Receipts are compressed client-side and mirrored as base64 inside
// Firestore docs, which keeps the whole thing on the free Spark plan.

import { db, setMirror } from "./db.js";
import { firebaseConfig } from "./firebase-config.js";
import { LIMITS, normalizeProfile, state as storeState } from "./store.js";

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

let redirectResult = null;

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
  // Local testing only: on a localhost server, localStorage "settld.emulators"
  // = "1" points the app at the Firebase emulators (tests/e2e/delete-account).
  if (["localhost", "127.0.0.1"].includes(location.hostname) && localStorage.getItem("settld.emulators") === "1") {
    au.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    f.connectFirestoreEmulator(fs, "127.0.0.1", 8080);
  }
  available = true;
  // Completes a redirect sign-in started on a previous page load. It has to
  // run before the auth listener settles, otherwise a returning redirect looks
  // like a signed-out boot and the welcome sheet flashes.
  redirectResult = await au.getRedirectResult(auth).catch(() => null);
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

// Installed PWAs and several mobile browsers either block the auth popup or
// open it without an opener, so the promise never settles. Those cases fall
// back to a full-page redirect, which boot completes via getRedirectResult.
const POPUP_UNAVAILABLE = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
  "auth/internal-error",
]);

const standalone = () =>
  matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export async function signInGoogle() {
  const p = new mods.GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  if (standalone()) {
    await mods.signInWithRedirect(auth, p);
    return;
  }
  try {
    await mods.signInWithPopup(auth, p);
  } catch (error) {
    if (!POPUP_UNAVAILABLE.has(error?.code)) throw error;
    await mods.signInWithRedirect(auth, p);
    return;
  }
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

/* ---- shared groups ----
 *
 * A shared group lives at groups/{gid} and is readable and writable by every
 * member, instead of at users/{uid}/... where only its creator could see it.
 * Sharing is opt-in per group: until someone taps Invite, nothing changes and
 * the group keeps using the personal backup path below.
 */

const groupRef = (gid) => mods.doc(fs, `groups/${gid}`);
const sharedRef = (gid, sub, id) => mods.doc(fs, `groups/${gid}/${sub}/${id}`);
const sharedCol = (gid, sub) => mods.collection(fs, `groups/${gid}/${sub}`);

const localGroup = (gid) => storeState.groups.find((g) => g.id === gid);
const isSharedGroup = (gid) => Boolean(localGroup(gid)?.shared);

// Attachments carry no group reference, so the owning record is what places
// them on the shared side or the personal side.
function attachmentGroupId(attachmentId) {
  const holder =
    storeState.expenses.find((e) => e.attachments?.includes(attachmentId)) ??
    storeState.settlements.find((s) => s.attachments?.includes(attachmentId));
  return holder?.groupId ?? null;
}

function sharedGroupIdFor(storeName, payload) {
  if (storeName === "groups") {
    const gid = typeof payload === "string" ? payload : payload?.id;
    // The record itself is the truth: the in-memory list can be a copy that a
    // background sync loaded before markShared ran.
    return payload?.shared || isSharedGroup(gid) ? gid : null;
  }
  if (storeName === "attachments") {
    const id = typeof payload === "string" ? payload : payload?.id;
    const gid = attachmentGroupId(id);
    return gid && isSharedGroup(gid) ? gid : null;
  }
  if (typeof payload === "string") {
    // A hard delete only gives us the key, so find the record's group locally.
    const bucket = { expenses: storeState.expenses, settlements: storeState.settlements, events: storeState.events }[storeName];
    const gid = bucket?.find((r) => r.id === payload)?.groupId;
    return gid && isSharedGroup(gid) ? gid : null;
  }
  const gid = payload?.groupId;
  return gid && isSharedGroup(gid) ? gid : null;
}

// The shared document must not carry this device's idea of who "you" are.
const shareableMembers = (members) =>
  (members ?? []).map(({ isYou, ...rest }) => (rest.uid ? rest : { ...rest, uid: rest.uid ?? null }));

function groupToDoc(group) {
  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji ?? "🧾",
    currency: group.currency ?? "INR",
    members: shareableMembers(group.members),
    memberUids: [...new Set(group.memberUids ?? [])],
    ownerUid: group.ownerUid,
    createdAt: group.createdAt ?? Date.now(),
    updatedAt: group.updatedAt ?? Date.now(),
  };
}

function docToGroup(remote, uid, previous) {
  const members = (remote.members ?? []).map((m) => {
    const member = { ...m };
    if (member.uid == null) delete member.uid;
    if (member.uid && member.uid === uid) member.isYou = true;
    else delete member.isYou;
    return member;
  });
  // Before anybody has claimed a row, keep this device's own marker so the
  // owner does not lose track of themselves mid-migration.
  if (!members.some((m) => m.isYou) && previous) {
    const mine = previous.members?.find((m) => m.isYou);
    const match = mine && members.find((m) => m.id === mine.id);
    if (match) match.isYou = true;
  }
  return { ...remote, members, shared: true };
}

async function applySharedMirror(op, storeName, payload, gid) {
  if (storeName === "groups") {
    if (op === "del") return leaveOrDeleteShared(gid);
    return mods.setDoc(groupRef(gid), groupToDoc(payload));
  }
  const id = typeof payload === "string" ? payload : payload.id;
  if (op === "del") {
    // History is append-only on the shared side; a local prune must not try to
    // remove somebody else's record of what happened.
    if (storeName === "events") return;
    return mods.deleteDoc(sharedRef(gid, storeName, id));
  }
  if (storeName === "attachments") {
    return mods.setDoc(sharedRef(gid, "attachments", id), await attToDoc(payload));
  }
  if (storeName === "events") {
    const existing = await mods.getDoc(sharedRef(gid, "events", id));
    if (existing.exists()) return;
    return mods.setDoc(sharedRef(gid, "events", id), payload);
  }
  return mods.setDoc(sharedRef(gid, storeName, id), payload);
}

async function leaveOrDeleteShared(gid) {
  const snap = await mods.getDoc(groupRef(gid));
  if (!snap.exists()) return;
  if (snap.data().ownerUid === user?.uid) {
    for (const sub of ["expenses", "settlements", "events", "attachments"]) {
      await deleteSharedCollection(gid, sub);
    }
    await mods.deleteDoc(groupRef(gid));
    return;
  }
  const remote = snap.data();
  await mods.updateDoc(groupRef(gid), {
    memberUids: (remote.memberUids ?? []).filter((u) => u !== user?.uid),
    members: (remote.members ?? []).map((m) => (m.uid === user?.uid ? { ...m, uid: null } : m)),
    updatedAt: Date.now(),
  });
}

async function deleteSharedCollection(gid, sub) {
  while (true) {
    const snap = await mods.getDocs(mods.query(sharedCol(gid, sub), mods.limit(400)));
    if (snap.empty) return;
    const batch = mods.writeBatch(fs);
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
  }
}

// Removes a group's documents from the personal backup once it goes shared, so
// the two paths never both claim it. No tombstones: those would tell every
// other device to delete the group outright.
async function detachFromPersonal(group) {
  const uid = user?.uid;
  if (!uid) return;
  const ids = { expenses: [], settlements: [], events: [], attachments: [] };
  for (const e of storeState.expenses.filter((x) => x.groupId === group.id)) {
    ids.expenses.push(e.id);
    ids.attachments.push(...(e.attachments ?? []));
  }
  for (const s of storeState.settlements.filter((x) => x.groupId === group.id)) {
    ids.settlements.push(s.id);
    ids.attachments.push(...(s.attachments ?? []));
  }
  for (const ev of storeState.events.filter((x) => x.groupId === group.id)) ids.events.push(ev.id);
  for (const [sub, list] of Object.entries(ids)) {
    for (const id of list) await mods.deleteDoc(userRef(uid, `${sub}/${id}`)).catch(() => {});
  }
  await mods.deleteDoc(userRef(uid, `groups/${group.id}`)).catch(() => {});
}

export async function shareGroup(group) {
  if (!user) throw new Error("cloud/no-user");
  await claimLocalData();
  const you = group.members.find((m) => m.isYou);
  const prepared = {
    ...group,
    ownerUid: group.ownerUid ?? user.uid,
    memberUids: [...new Set([...(group.memberUids ?? []), user.uid])],
    members: group.members.map((m) => (m.id === you?.id ? { ...m, uid: user.uid } : m)),
    updatedAt: Date.now(),
  };
  const existing = await mods.getDoc(groupRef(group.id));
  if (!existing.exists()) {
    // create must present exactly the caller as the only member
    await mods.setDoc(groupRef(group.id), {
      ...groupToDoc(prepared),
      memberUids: [user.uid],
      ownerUid: user.uid,
    });
  }
  await mods.setDoc(groupRef(group.id), groupToDoc(prepared));

  for (const e of storeState.expenses.filter((x) => x.groupId === group.id)) {
    await mods.setDoc(sharedRef(group.id, "expenses", e.id), e);
  }
  for (const s of storeState.settlements.filter((x) => x.groupId === group.id)) {
    await mods.setDoc(sharedRef(group.id, "settlements", s.id), s);
  }
  for (const ev of storeState.events.filter((x) => x.groupId === group.id)) {
    await mods.setDoc(sharedRef(group.id, "events", ev.id), ev).catch(() => {});
  }
  await pushSharedAttachments(group.id);
  await detachFromPersonal(group);
  return { ownerUid: prepared.ownerUid, memberUids: prepared.memberUids, youMemberId: you?.id };
}

async function pushSharedAttachments(gid) {
  const wanted = new Set();
  for (const e of storeState.expenses.filter((x) => x.groupId === gid)) for (const id of e.attachments ?? []) wanted.add(id);
  for (const s of storeState.settlements.filter((x) => x.groupId === gid)) for (const id of s.attachments ?? []) wanted.add(id);
  for (const id of wanted) {
    const rec = await db.get("attachments", id);
    if (!rec) continue;
    const already = await mods.getDoc(sharedRef(gid, "attachments", id));
    if (already.exists() && already.data()?.b64) continue;
    try {
      await mods.setDoc(sharedRef(gid, "attachments", id), await attToDoc(rec));
    } catch {
      /* an oversized legacy proof stays local rather than failing the share */
    }
  }
}

// Reads a group by id so an invitee can see what they are joining.
export async function peekGroup(gid) {
  if (!user) throw new Error("cloud/no-user");
  const snap = await mods.getDoc(groupRef(gid));
  return snap.exists() ? snap.data() : null;
}

export async function joinGroup(gid, { memberId, name, upi }) {
  if (!user) throw new Error("cloud/no-user");
  await claimLocalData();
  const uid = user.uid;
  await mods.runTransaction(fs, async (transaction) => {
    const snap = await transaction.get(groupRef(gid));
    if (!snap.exists()) throw new Error("cloud/group-missing");
    const remote = snap.data();
    if ((remote.memberUids ?? []).includes(uid)) return;
    const members = [...(remote.members ?? [])];
    const index = memberId ? members.findIndex((m) => m.id === memberId) : -1;
    if (index >= 0) {
      members[index] = { ...members[index], uid, name: members[index].name || name || "You", upi: members[index].upi || upi || "" };
    } else {
      members.push({ id: crypto.randomUUID(), name: name || "You", upi: upi ?? "", uid });
    }
    transaction.update(groupRef(gid), {
      memberUids: [...remote.memberUids, uid],
      members,
      updatedAt: Date.now(),
    });
  });
  return pullSharedGroup(gid);
}

// Two-way merge for one shared group. Newer updatedAt wins, same as the
// personal mirror, so the arithmetic stays deterministic across devices.
async function pullSharedGroup(gid) {
  const uid = user.uid;
  const snap = await mods.getDoc(groupRef(gid));
  const localBefore = await db.get("groups", gid);
  if (!snap.exists()) {
    if (localBefore?.shared) {
      for (const s of ["expenses", "settlements", "events"]) {
        for (const r of await db.all(s)) if (r.groupId === gid) await db.del(s, r.id, true);
      }
      await db.del("groups", gid, true);
    }
    return false;
  }
  const remote = snap.data();
  if (!(remote.memberUids ?? []).includes(uid)) {
    // Removed from the group: drop the local copy rather than keep a ledger
    // that can no longer be reconciled.
    if (localBefore) await db.del("groups", gid, true);
    return false;
  }

  if (localBefore?.shared && tsOf(localBefore) > tsOf(remote)) {
    await mods.setDoc(groupRef(gid), groupToDoc({ ...localBefore, ownerUid: remote.ownerUid, memberUids: remote.memberUids }));
  } else {
    await db.put("groups", docToGroup(remote, uid, localBefore), true);
  }

  for (const sub of ["expenses", "settlements"]) {
    const remoteDocs = await mods.getDocs(sharedCol(gid, sub));
    const seen = new Set();
    for (const d of remoteDocs.docs) {
      const r = d.data();
      seen.add(r.id);
      const local = await db.get(sub, r.id);
      const direction = mergeDirection(local, r);
      if (direction === "remote") await db.put(sub, r, true);
      else if (direction === "local" && local) await mods.setDoc(sharedRef(gid, sub, r.id), local);
    }
    for (const local of await db.all(sub)) {
      if (local.groupId === gid && !seen.has(local.id)) await mods.setDoc(sharedRef(gid, sub, local.id), local);
    }
  }

  const remoteEvents = await mods.getDocs(sharedCol(gid, "events"));
  const eventIds = new Set();
  for (const d of remoteEvents.docs) {
    const r = d.data();
    eventIds.add(r.id);
    if (!(await db.get("events", r.id))) await db.put("events", r, true);
  }
  for (const local of await db.all("events")) {
    if (local.groupId === gid && !eventIds.has(local.id)) {
      await mods.setDoc(sharedRef(gid, "events", local.id), local).catch(() => {});
    }
  }

  const remoteAtt = await mods.getDocs(sharedCol(gid, "attachments"));
  for (const d of remoteAtt.docs) {
    const r = d.data();
    if (!r.b64) continue;
    if (!(await db.get("attachments", r.id))) {
      await db.put("attachments", { id: r.id, blob: b64ToBlob(r.b64, r.mime), mime: r.mime, name: r.name, ts: r.ts }, true);
    }
  }
  await pushSharedAttachments(gid);
  return true;
}

export async function syncSharedGroups() {
  if (!user || !available) return;
  const ids = storeState.groups.filter((g) => g.shared).map((g) => g.id);
  for (const gid of ids) {
    try {
      await pullSharedGroup(gid);
    } catch {
      failedUid = user.uid;
    }
  }
  if (ids.length) await syncedCb?.();
}

function mirrorWrite(op, storeName, payload) {
  const sharedGid = user && available ? sharedGroupIdFor(storeName, payload) : null;
  if (sharedGid) {
    inFlightWrites += 1;
    notifyStatus();
    const task = applySharedMirror(op, storeName, payload, sharedGid)
      .then(() => {
        if (failedUid === user.uid) failedUid = null;
      })
      .catch(() => {
        failedUid = user.uid;
      })
      .finally(() => {
        inFlightWrites = Math.max(0, inFlightWrites - 1);
        notifyStatus();
      });
    mirrorWrites.add(task);
    task.finally(() => mirrorWrites.delete(task));
    return op === "del" ? task : undefined;
  }

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

    // Shared groups are owned by groups/{gid} and must not be mirrored here as
    // well, or the two paths take turns resurrecting each other's copy.
    const sharedIds = new Set(storeState.groups.filter((g) => g.shared).map((g) => g.id));
    const isSharedRecord = (s, record) => (s === "groups" ? sharedIds.has(record.id) : sharedIds.has(record.groupId));

    for (const s of ["groups", "expenses", "settlements", "events"]) {
      const remote = await mods.getDocs(mods.collection(fs, `users/${uid}/${s}`));
      const remoteIds = new Set();
      for (const d of remote.docs) {
        const r = d.data();
        if (tombstones.has(`${s}:${r.id}`) || (remoteResetAt && tsOf(r) <= remoteResetAt)) {
          await mods.deleteDoc(d.ref).catch(() => {});
          continue;
        }
        if (isSharedRecord(s, r)) {
          // Left over from before this group was shared.
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
        if (isSharedRecord(s, l)) continue;
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
      if (sharedIds.has(attachmentGroupId(l.id))) continue;
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
    await syncSharedGroups();
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

/* ---- delete account ---- */

// Google Play requires deleting the account itself, not only its data.
// Firebase deletes only an account signed into in the last few minutes, so an
// older session confirms with Google first. Installed apps can't open the
// popup, so there the confirmation is a redirect and boot finishes the job
// (takePendingDeletion).

const PENDING_DELETE = "settld.pendingDelete";

function signedInRecently(u) {
  const at = Date.parse(u?.metadata?.lastSignInTime ?? "");
  return Number.isFinite(at) && Date.now() - at < 4 * 60_000;
}

async function confirmByRedirect(u, provider) {
  localStorage.setItem(PENDING_DELETE, u.uid);
  await mods.reauthenticateWithRedirect(u, provider);
}

// Leaves every shared group, so the people still in it keep their ledger;
// your member row stays on past entries without a linked account. A group
// nobody else ever joined is deleted outright, history included.
async function leaveSharedGroups(uid) {
  for (const g of storeState.groups.filter((x) => x.shared)) {
    const snap = await mods.getDoc(groupRef(g.id)).catch(() => null);
    if (!snap?.exists()) continue;
    const remote = snap.data();
    if (!(remote.memberUids ?? []).includes(uid)) continue;
    const others = remote.memberUids.filter((u) => u !== uid);
    if (!others.length && remote.ownerUid === uid) {
      for (const sub of ["expenses", "settlements", "attachments", "events"]) await deleteSharedCollection(g.id, sub);
      await mods.deleteDoc(groupRef(g.id));
    } else {
      await mods.updateDoc(groupRef(g.id), {
        memberUids: others,
        members: (remote.members ?? []).map((m) => (m.uid === uid ? { ...m, uid: null } : m)),
        updatedAt: Date.now(),
      });
    }
  }
}

/**
 * Leaves shared groups, erases the personal backup, then deletes the login.
 * Returns { redirected: true } when the page is leaving to confirm with
 * Google, otherwise the erase result for store.eraseAll().
 */
export async function deleteAccount() {
  user = auth?.currentUser ?? user;
  if (!user) throw new Error("cloud/signed-out");
  if (!navigator.onLine) throw new Error("cloud/offline");
  if (!signedInRecently(user)) {
    const provider = new mods.GoogleAuthProvider();
    if (standalone()) {
      await confirmByRedirect(user, provider);
      return { redirected: true };
    }
    try {
      await mods.reauthenticateWithPopup(user, provider);
    } catch (error) {
      if (!POPUP_UNAVAILABLE.has(error?.code)) throw error;
      await confirmByRedirect(user, provider);
      return { redirected: true };
    }
  }
  const target = user;
  await leaveSharedGroups(target.uid);
  const erased = await eraseCloudData();
  await mods.deleteDoc(userRef(target.uid, "meta/state")).catch(() => {});
  await mods.deleteUser(target);
  erasingUid = null;
  return { redirected: false, ...erased };
}

/** True once, on the boot that returns from confirming a deletion with Google. */
export function takePendingDeletion() {
  let pending = null;
  try {
    pending = localStorage.getItem(PENDING_DELETE);
    localStorage.removeItem(PENDING_DELETE);
  } catch {
    return false;
  }
  return Boolean(pending && redirectResult?.operationType === "reauthenticate" && auth?.currentUser?.uid === pending);
}
