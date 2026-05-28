import type { GroupPreset } from '../types/equipment'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { syncPresetsToFolder } from '../lib/librarySync'

/**
 * #308 — Persist-Helpers fuer GroupPresets aus projectStore.ts
 * ausgelagert. Wird vom (kommenden) GroupPresetSlice und vom
 * Default-Initializer von useProjectStore (loadGroupPresets als
 * lazy initializer) gebraucht.
 *
 * healGroupPresetPorts (v7.9.13) reicht die Migration ein: alte
 * Presets aus Vor-Sanitize-Versionen koennen Ports mit leerer/
 * doppelter ID enthalten — beim Laden geben wir jedem solchen Port
 * eine frische UUID damit ReactFlow keine Key-Kollisionen ausloest.
 * Idempotent.
 */

const GROUP_PRESETS_KEY = STORAGE_KEYS.groupPresets

const healGroupPresetPorts = (presets: GroupPreset[]): GroupPreset[] => {
  let needsRewrite = false
  const out = presets.map((preset) => {
    const items = preset.items.map((item) => {
      const sanitizePortList = <T extends { id?: string }>(ports: T[]): T[] => {
        const seen = new Set<string>()
        return ports.map((p) => {
          let id = p.id ?? ''
          if (!id || seen.has(id)) {
            needsRewrite = true
            id = typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `port-${Math.random().toString(36).slice(2, 11)}`
          }
          seen.add(id)
          return { ...p, id }
        })
      }
      return {
        ...item,
        inputs: sanitizePortList(item.inputs),
        outputs: sanitizePortList(item.outputs),
      }
    })
    return { ...preset, items }
  })
  if (needsRewrite) {
    try {
      localStorage.setItem(GROUP_PRESETS_KEY, JSON.stringify(out))
    } catch {
      /* ignore */
    }
  }
  return out
}

export const loadGroupPresets = (): GroupPreset[] => {
  try {
    const raw = localStorage.getItem(GROUP_PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GroupPreset[]
    return healGroupPresetPorts(parsed)
  } catch {
    return []
  }
}

export const persistGroupPresets = (presets: GroupPreset[]) => {
  try {
    localStorage.setItem(GROUP_PRESETS_KEY, JSON.stringify(presets))
  } catch {
    /* ignore */
  }
  syncPresetsToFolder(presets)
}
