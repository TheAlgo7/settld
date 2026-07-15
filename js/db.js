// Thin promise wrapper over IndexedDB. Stores:
// groups, expenses, settlements, events (all keyPath id, groupId index),
// attachments (id -> { id, blob, mime, name, ts }), kv (out-of-line keys).

const NAME = "settld";
const VERSION = 1;
let opening = null;
const deleteVersions = new Map();
const mutationKey = (store, key) => `${store}:${String(key)}`;

function open() {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore("groups", { keyPath: "id" });
      for (const s of ["expenses", "settlements", "events"]) {
        d.createObjectStore(s, { keyPath: "id" }).createIndex("groupId", "groupId");
      }
      d.createObjectStore("attachments", { keyPath: "id" });
      d.createObjectStore("kv");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

function run(store, mode, work) {
  return open().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = work(t.objectStore(store));
        t.oncomplete = () => resolve(req ? req.result : undefined);
        t.onabort = () => reject(t.error);
        t.onerror = () => reject(t.error);
      }),
  );
}

// Optional cloud mirror. cloud.js registers a hook here; every write that
// isn't flagged quiet is forwarded so the signed-in user's data backs up.
let mirror = null;
export function setMirror(fn) {
  mirror = fn;
}

export const db = {
  put: async (store, value, quiet = false) => {
    const r = await run(store, "readwrite", (s) => s.put(value));
    if (!quiet) mirror?.("put", store, value);
    return r;
  },
  get: (store, key) => run(store, "readonly", (s) => s.get(key)),
  del: async (store, key, quiet = false) => {
    const versionKey = mutationKey(store, key);
    deleteVersions.set(versionKey, (deleteVersions.get(versionKey) ?? 0) + 1);
    if (!quiet) {
      const durability = mirror?.("del", store, key);
      if (durability?.then) await durability;
    }
    const r = await run(store, "readwrite", (s) => s.delete(key));
    return r;
  },
  deleteVersion: (store, key) => deleteVersions.get(mutationKey(store, key)) ?? 0,
  all: (store) => run(store, "readonly", (s) => s.getAll()),
  allBy: (store, index, value) =>
    run(store, "readonly", (s) => s.index(index).getAll(value)),
  kvGet: (key) => run("kv", "readonly", (s) => s.get(key)),
  kvSet: async (key, value, quiet = false) => {
    const r = await run("kv", "readwrite", (s) => s.put(value, key));
    if (!quiet) mirror?.("kv", key, value);
    return r;
  },
  async wipe() {
    const d = await open();
    const names = [...d.objectStoreNames];
    await Promise.all(names.map((n) => run(n, "readwrite", (s) => s.clear())));
  },
};
