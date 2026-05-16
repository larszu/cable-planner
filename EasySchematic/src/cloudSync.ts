/**
 * Coordination layer between the network API (templateApi) and local cache (cloudCache).
 * Provides cache-aware schematic operations for offline reading.
 * Cloud saves always require an internet connection — no offline write queue.
 */

import {
  listCloudSchematics,
  loadCloudSchematic,
} from "./templateApi";
import {
  getCachedSchematics,
  getCachedSchematic,
  cacheSchematicList,
  cacheSchematicContent,
  type CachedSchematic,
} from "./cloudCache";

/** List schematics: API first, cache fallback. */
export async function listSchematics(): Promise<CachedSchematic[]> {
  if (navigator.onLine) {
    try {
      const list = await listCloudSchematics();
      await cacheSchematicList(list);
      backgroundFetchContent(list);
      // Return server list with cached content attached
      const cached = await getCachedSchematics();
      const dataMap = new Map(cached.map((s) => [s.id, s.data]));
      return list.map((s) => ({ ...s, data: dataMap.get(s.id) ?? null }));
    } catch {
      // Online but API failed (captive portal, server down) — fall through
    }
  }
  return getCachedSchematics();
}

/** Load a single schematic: API first, cache fallback. */
export async function loadSchematic(id: string): Promise<unknown> {
  if (navigator.onLine) {
    try {
      const data = await loadCloudSchematic(id);
      await cacheSchematicContent(id, data);
      return data;
    } catch {
      // Fall through to cache
    }
  }
  const cached = await getCachedSchematic(id);
  if (cached) return cached;
  throw new Error("Schematic not available offline");
}

/**
 * Refresh the cloud cache: fetch list + content for stale entries.
 * Call on reconnect and app focus.
 */
export async function refreshCloudCache(): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const list = await listCloudSchematics();
    await cacheSchematicList(list);
    await backgroundFetchContent(list);
  } catch {
    // Silently fail — cache is still usable
  }
}

// ─── Internal ────────────────────────────────────────────

/** Fetch full content for schematics that are stale or uncached. */
async function backgroundFetchContent(list: import("./templateApi").CloudSchematic[]): Promise<void> {
  const cached = await getCachedSchematics();
  const cacheMap = new Map(cached.map((s) => [s.id, s]));

  for (const s of list) {
    const c = cacheMap.get(s.id);
    if (!c?.data || c.updated_at < s.updated_at) {
      try {
        const data = await loadCloudSchematic(s.id);
        await cacheSchematicContent(s.id, data);
      } catch {
        // Individual fetch failed — skip, try again later
      }
    }
  }
}
