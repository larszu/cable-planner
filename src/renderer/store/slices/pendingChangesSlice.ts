import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CablePlannerProject } from '../../types/project'
import type { ChangeLogEntry, ChangeLogKind, PendingChange } from '../../types/lifecycle'
import { touchProject } from '../projectStoreHelpers'
import { scheduleProjectAutosave } from '../projectAutosave'
import { useSettingsStore } from '../settingsStore'
import type { ProjectState } from '../projectStore'

/**
 * Feld-Rückkanal — Review-Queue für vom Mobile-Companion/Viewer gemeldete
 * Änderungen.
 *
 * Der Techniker vor Ort korrigiert z.B. eine Kabellänge oder meldet ein
 * Problem; das landet als `PendingChange` im Plan (nicht direkt angewandt).
 * Der Planer am Desktop übernimmt (`applyPendingChange`) — dann wird der
 * whitelistete Patch auf das Ziel gemerged und ein `ChangeLogEntry`
 * geschrieben — oder verwirft (`rejectPendingChange`). So fließt Feldwissen
 * kontrolliert und nachvollziehbar ins lebende Dokument.
 *
 * Bewusst KEIN Lock-Check (analog lifecycleSlice): Post-Install-Pflege muss
 * auch auf einem „finalized"/As-built-Plan möglich sein.
 */

export type PendingChangesSlice = Pick<
  ProjectState,
  'addPendingChange' | 'applyPendingChange' | 'rejectPendingChange'
>

const currentAuthor = (): string => useSettingsStore.getState().editorName?.trim() || 'Unbekannt'

/** Hängt einen Änderungs-Eintrag an (capped auf die letzten 500) — gespiegelt
 *  aus lifecycleSlice, damit Übernehmen/Verwerfen denselben Verlauf füttern. */
const appendLog = (
  project: CablePlannerProject,
  kind: ChangeLogKind,
  summary: string,
  target?: ChangeLogEntry['target'],
): CablePlannerProject => {
  const entry: ChangeLogEntry = {
    id: uuidv4(),
    ts: new Date().toISOString(),
    author: currentAuthor(),
    kind,
    summary,
    target,
  }
  return { ...project, changelog: [...(project.changelog ?? []), entry].slice(-500) }
}

/** Felder, die eine Feld-Meldung tatsächlich auf ein Kabel schreiben darf. */
const CABLE_PATCH_KEYS = new Set([
  'name',
  'length',
  'notes',
  'color',
  'type',
  'installStatus',
  'jacketRating',
  'terminationFrom',
  'terminationTo',
  'pathway',
])
/** Felder, die eine Feld-Meldung tatsächlich auf ein Gerät schreiben darf. */
const EQUIP_PATCH_KEYS = new Set([
  'name',
  'notes',
  'serialNumber',
  'assetTag',
  'firmware',
  'ipAddress',
  'installStatus',
])

const pickWhitelisted = (
  patch: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (allowed.has(k) && v !== undefined) out[k] = v
  }
  return out
}

export const createPendingChangesSlice: StateCreator<
  ProjectState,
  [],
  [],
  PendingChangesSlice
> = (set) => ({
  addPendingChange: (input) =>
    set((state) => {
      const entry: PendingChange = {
        id: input.id ?? uuidv4(),
        ts: input.ts ?? new Date().toISOString(),
        author: input.author?.trim() || 'Feld',
        source: input.source,
        kind: input.kind,
        summary: input.summary,
        ...(input.target ? { target: input.target } : {}),
        ...(input.patch ? { patch: input.patch } : {}),
      }
      const updated = touchProject({
        ...state.project,
        pendingChanges: [...(state.project.pendingChanges ?? []), entry].slice(-200),
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  applyPendingChange: (id) => {
    let ok = false
    set((state) => {
      const list = state.project.pendingChanges ?? []
      const pc = list.find((p) => p.id === id)
      if (!pc) return state
      let project = state.project

      // (1) Patch auf das Ziel mergen (nur whitelistete Felder).
      if (pc.target?.id && pc.patch) {
        if (pc.target.type === 'cable') {
          const patch = pickWhitelisted(pc.patch, CABLE_PATCH_KEYS)
          if (Object.keys(patch).length > 0) {
            project = {
              ...project,
              cables: project.cables.map((c) =>
                c.id === pc.target!.id ? { ...c, ...patch } : c,
              ),
            }
          }
        } else if (pc.target.type === 'equipment') {
          const patch = pickWhitelisted(pc.patch, EQUIP_PATCH_KEYS)
          if (Object.keys(patch).length > 0) {
            project = {
              ...project,
              equipment: project.equipment.map((e) =>
                e.id === pc.target!.id ? { ...e, ...patch } : e,
              ),
            }
          }
        }
      }

      // (2) Ins Änderungsprotokoll + (3) aus der Queue entfernen.
      project = appendLog(project, 'change', `Feld-Meldung übernommen: ${pc.summary}`, pc.target)
      project = { ...project, pendingChanges: list.filter((p) => p.id !== id) }

      ok = true
      const updated = touchProject(project)
      scheduleProjectAutosave(updated)
      return { project: updated, projectVersion: state.projectVersion + 1 }
    })
    return ok
  },

  rejectPendingChange: (id) =>
    set((state) => {
      const list = state.project.pendingChanges ?? []
      const pc = list.find((p) => p.id === id)
      if (!pc) return state
      let project = appendLog(
        state.project,
        'change',
        `Feld-Meldung verworfen: ${pc.summary}`,
        pc.target,
      )
      project = { ...project, pendingChanges: list.filter((p) => p.id !== id) }
      const updated = touchProject(project)
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
