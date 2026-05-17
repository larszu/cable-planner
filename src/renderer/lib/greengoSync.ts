// Bidirectional sync between the GreenGo planner config in the project
// store and the equipment properties / canvas labels (issue #56).
//
// Single source of truth: `project.greengoConfig.users` — each user has
// an `equipmentId` pointing at the cable-planner device that physically
// hosts that beltpack/station. We provide:
//
//   - findGreenGoUserForEquipment()  — look up the user assigned to a
//     given device, plus the list of groups they belong to.
//   - useGreenGoBeltpack()           — React hook returning the user
//     and a renaming callback. Used by EquipmentProperties.
//   - upsertEquipmentBeltpackName()  — atomic update applied by both
//     the equipment-properties UI and the GreenGo dialog.
//   - global preset slot helpers     — load/save named presets to
//     localStorage so the user can keep a library of standard intercom
//     configs independent of any single project.

import { useCallback, useMemo } from 'react'
import type { GreenGoConfig, GreenGoUser } from '../types/greengo'
import { useProjectStore } from '../store/projectStore'
import { STORAGE_KEYS } from './storageKeys'

const PRESETS_KEY = STORAGE_KEYS.greengoPresets

export interface GreenGoBeltpackInfo {
  user: GreenGoUser
  /** Group entries the user belongs to. Sorted by group id. */
  groupNames: string[]
}

export const findGreenGoUserForEquipment = (
  equipmentId: string,
  config: GreenGoConfig | undefined,
): GreenGoBeltpackInfo | null => {
  if (!config) return null
  const user = config.users.find((u) => u.equipmentId === equipmentId)
  if (!user) return null
  const groupNames = (user.groupIds ?? [])
    .map((gid) => config.groups.find((g) => g.id === gid)?.name)
    .filter((n): n is string => !!n)
    .sort()
  return { user, groupNames }
}

/** React hook bundling the lookup + a renaming callback. The callback
 *  patches `project.greengoConfig.users[*].name` (and `displayName` if
 *  set) so the GreenGo dialog and the canvas pick up the new name
 *  immediately. */
export const useGreenGoBeltpack = (equipmentId: string) => {
  const config = useProjectStore((s) => s.project.greengoConfig)
  const updateGreenGoConfig = useProjectStore((s) => s.updateGreenGoConfig)

  const info = useMemo(
    () => findGreenGoUserForEquipment(equipmentId, config),
    [equipmentId, config],
  )

  const rename = useCallback(
    (newName: string) => {
      if (!config) return
      const trimmed = newName.trim()
      const next: GreenGoConfig = {
        ...config,
        users: config.users.map((u) =>
          u.equipmentId === equipmentId
            ? {
                ...u,
                name: trimmed || u.name,
                // Keep displayName in sync with `name` when the user
                // hasn't customised the display variant separately.
                displayName:
                  u.displayName && u.displayName !== u.name
                    ? u.displayName
                    : trimmed || u.name,
              }
            : u,
        ),
      }
      updateGreenGoConfig(next)
    },
    [config, updateGreenGoConfig, equipmentId],
  )

  /** Link a GreenGo user (by id) to the equipment we're currently
   *  inspecting. Lets the user assign a beltpack inline without
   *  jumping over to the GreenGo dialog. */
  const assignUser = useCallback(
    (userId: number | null) => {
      if (!config) return
      const next: GreenGoConfig = {
        ...config,
        users: config.users.map((u) => {
          if (u.id === userId) return { ...u, equipmentId }
          // If another user was previously linked to this equipment,
          // unlink them — equipmentId is exclusive 1:1.
          if (u.equipmentId === equipmentId && u.id !== userId) {
            return { ...u, equipmentId: undefined }
          }
          return u
        }),
      }
      updateGreenGoConfig(next)
    },
    [config, updateGreenGoConfig, equipmentId],
  )

  return { config, info, rename, assignUser }
}

// ── Global preset slots ────────────────────────────────────────────────

export interface GreenGoPreset {
  id: string
  name: string
  savedAt: string
  config: GreenGoConfig
}

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export const loadGreenGoPresets = (): GreenGoPreset[] => {
  return safeParse<GreenGoPreset[]>(localStorage.getItem(PRESETS_KEY), [])
}

const persistPresets = (presets: GreenGoPreset[]) => {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
  } catch {
    /* quota — non-fatal, the preset library is convenience-only */
  }
}

export const saveGreenGoPreset = (name: string, config: GreenGoConfig): GreenGoPreset => {
  const presets = loadGreenGoPresets()
  // Replace by name if one already exists, otherwise append. Saves the
  // user from accumulating duplicates when iterating on a config.
  const trimmed = name.trim() || `Preset ${new Date().toLocaleString()}`
  const id = `gg-preset-${Date.now()}`
  const preset: GreenGoPreset = {
    id,
    name: trimmed,
    savedAt: new Date().toISOString(),
    config,
  }
  const next = [...presets.filter((p) => p.name !== trimmed), preset]
  persistPresets(next)
  return preset
}

export const deleteGreenGoPreset = (id: string) => {
  const next = loadGreenGoPresets().filter((p) => p.id !== id)
  persistPresets(next)
}

/** Replace the current project's GreenGo config with the named preset.
 *  Equipment links from the preset are kept verbatim — if the preset
 *  references equipment ids that don't exist in this project they're
 *  simply ignored at render time. */
export const applyGreenGoPreset = (preset: GreenGoPreset) => {
  useProjectStore.getState().updateGreenGoConfig(preset.config)
}
