/**
 * IndexedDB read cache for cloud schematics.
 * Stores schematic metadata + full content locally so they're accessible offline.
 * This is a READ CACHE only — cloud saves always require an internet connection.
 */

import type { CloudSchematic } from "./templateApi";

const DB_NAME = "easyschematic-cloud-cache";
const DB_VERSION = 1;
const SCHEMATICS_STORE = "schematics";

export interface CachedSchematic extends CloudSchematic {
  data: unknown | null; // full SchematicFile content, null if not yet fetched
}

// ─── Database ────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function openCache(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SCHEMATICS_STORE)) {
        db.createObjectStore(SCHEMATICS_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

// ─── Schematic Cache ─────────────────────────────────────

export async function getCachedSchematics(): Promise<CachedSchematic[]> {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCHEMATICS_STORE, "readonly");
    const req = tx.objectStore(SCHEMATICS_STORE).getAll();
    req.onsuccess = () => resolve(req.result as CachedSchematic[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedSchematic(id: string): Promise<unknown | null> {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCHEMATICS_STORE, "readonly");
    const req = tx.objectStore(SCHEMATICS_STORE).get(id);
    req.onsuccess = () => {
      const cached = req.result as CachedSchematic | undefined;
      resolve(cached?.data ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Cache metadata for all schematics. Preserves existing `data` fields. */
export async function cacheSchematicList(schematics: CloudSchematic[]): Promise<void> {
  const db = await openCache();
  const existing = await getCachedSchematics();
  const dataMap = new Map(existing.map((s) => [s.id, s.data]));

  // Remove cached schematics that no longer exist on the server
  const serverIds = new Set(schematics.map((s) => s.id));

  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCHEMATICS_STORE, "readwrite");
    const store = tx.objectStore(SCHEMATICS_STORE);

    for (const cached of existing) {
      if (!serverIds.has(cached.id)) {
        store.delete(cached.id);
      }
    }

    for (const s of schematics) {
      const entry: CachedSchematic = { ...s, data: dataMap.get(s.id) ?? null };
      store.put(entry);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Cache full content for a single schematic. */
export async function cacheSchematicContent(id: string, data: unknown): Promise<void> {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCHEMATICS_STORE, "readwrite");
    const store = tx.objectStore(SCHEMATICS_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as CachedSchematic | undefined;
      if (existing) {
        store.put({ ...existing, data });
      } else {
        store.put({ id, name: "", size_bytes: 0, shared: 0, share_token: null, created_at: "", updated_at: "", data });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removeCachedSchematic(id: string): Promise<void> {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCHEMATICS_STORE, "readwrite");
    tx.objectStore(SCHEMATICS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Wipe all cached data (for logout). */
export async function clearCache(): Promise<void> {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SCHEMATICS_STORE, "readwrite");
    tx.objectStore(SCHEMATICS_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
