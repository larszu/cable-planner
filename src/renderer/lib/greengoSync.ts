// Die Bruecke zwischen dem Intercom-Slot des Projekts und den
// Geraete-Eigenschaften / Canvas-Beschriftungen (Issue #56).
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS SICH MIT E-2 GEAENDERT HAT
// ═══════════════════════════════════════════════════════════════════════════
//
// Hier stand: „Single source of truth: `project.greengoConfig.users`". Das ist
// sie nicht mehr — seit E-2 fuehrt das Projekt den herstellerneutralen Slot
// (`project.intercom`), und `GreenGoConfig` ist seine Ausgabe-Projektion.
//
// DIE NACHSCHLAGE GEHT DESHALB DIREKT AUF DEN SLOT und nicht ueber die
// Projektion. Der Unterschied ist kein Stilfrage: `greengoFromPlan` baut bei
// jedem Aufruf ein neues Objekt. Auf dem Canvas laeuft diese Nachschlage
// einmal je Geraet und Render — die Projektion dort einzusetzen hiesse, bei
// jedem Frame die ganze Anlage neu zu bauen, und der zustand-Vergleich saehe
// jedes Mal etwas Neues. Genau diese Defektform steht in `EquipmentNode`
// dokumentiert („Previously this selector built a fresh Set every call").
//
// Was hier bereitsteht:
//
//   - findIntercomStationForEquipment() — die Sprechstelle an einem Geraet,
//     samt Anlagen-Nummer und Konferenz-Namen.
//   - useGreenGoBeltpack()              — React-Hook mit Umbenennen und
//     Zuordnen. Der Hook arbeitet auf der PROJEKTION, weil die
//     Eigenschaften-Leiste Green-GO-Begriffe zeigt; er baut sie einmal je
//     Slot-Aenderung und nicht je Render.
//   - Preset-Slots                      — benannte Konfigurationen im
//     localStorage, projektunabhaengig.

import { useCallback, useMemo } from 'react'
import type { GreenGoConfig } from '../types/greengo'
import type { IntercomPlan, IntercomPlanStation } from '../types/intercomPlan'
import { greengoFromPlan } from './intercomPlan'
import { useProjectStore } from '../store/projectStore'
import { STORAGE_KEYS } from './storageKeys'

const PRESETS_KEY = STORAGE_KEYS.greengoPresets

export interface IntercomStationInfo {
  station: IntercomPlanStation
  /**
   * Die Anlagen-Nummer, wie sie auf dem Beltpack steht — aus dem
   * `vendor`-Block, also DEKLARIERT und nicht aus der Listenposition
   * abgeleitet (ADR-002). Fehlt sie, hat der Slot fuer diese Stelle noch
   * keine; dann wird auch keine angezeigt statt eine zu erfinden.
   */
  number?: number
  /** Namen der Konferenzen, an denen die Stelle haengt. Sortiert. */
  channelNames: string[]
}

export const findIntercomStationForEquipment = (
  equipmentId: string,
  plan: IntercomPlan | undefined,
): IntercomStationInfo | null => {
  if (!plan) return null
  const station = plan.stations.find((s) => s.equipmentId === equipmentId)
  if (!station) return null
  const name = new Map(plan.channels.map((c) => [c.id, c.name]))
  const channelNames = station.memberships
    // Eine Zugehoerigkeit ohne Sprechen UND ohne Hoeren ist keine — sie hier
    // aufzuzaehlen behauptete auf dem Canvas eine Verbindung, die es nicht
    // gibt.
    .filter((m) => m.talk || m.listen)
    .map((m) => name.get(m.channelId))
    .filter((n): n is string => !!n)
    .sort()
  return {
    station,
    ...(typeof plan.vendor?.greengo?.stationNumbers?.[station.id] === 'number'
      ? { number: plan.vendor.greengo.stationNumbers[station.id] }
      : {}),
    channelNames,
  }
}

/** React-Hook: Nachschlage plus Umbenennen und Zuordnen. Beides schreibt
 *  ueber `updateGreenGoConfig` in den Slot zurueck, sodass Dialog, Canvas und
 *  Eigenschaften-Leiste denselben Stand sehen. */
export const useGreenGoBeltpack = (equipmentId: string) => {
  const plan = useProjectStore((s) => s.project.intercom)
  const updateGreenGoConfig = useProjectStore((s) => s.updateGreenGoConfig)

  // EINMAL JE SLOT-AENDERUNG, nicht je Render. Der Selektor liefert den Slot
  // selbst — ein stabiler Verweis —, und die Projektion entsteht dahinter im
  // `useMemo`. Andersherum (Projektion im Selektor) baute jeder Render ein
  // neues Objekt, und zustand hielte jeden fuer eine Aenderung.
  const config = useMemo(() => (plan ? greengoFromPlan(plan) : undefined), [plan])

  const info = useMemo(
    () => findIntercomStationForEquipment(equipmentId, plan),
    [equipmentId, plan],
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
