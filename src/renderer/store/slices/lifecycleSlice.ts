import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { CablePlannerProject } from '../../types/project'
import type {
  ChangeLogEntry,
  ChangeLogKind,
  CableTestResult,
  InstallStatus,
  ServiceRecord,
} from '../../types/lifecycle'
import { INSTALL_STATUS_LABEL } from '../../types/lifecycle'
import { cableLabelId, makeDocId } from '../../lib/docIds'
import { sourceDestLabel } from '../../lib/cableLabel'
import { touchProject } from '../projectStoreHelpers'
import { useSettingsStore } from '../settingsStore'
import type { ProjectState } from '../projectStore'

/**
 * Festinstallation — Lebenszyklus-Slice (mitwachsende Doku).
 *
 * Trägt die Setter, die aus dem Plan ein lebendes Dokument machen:
 *  - Betriebs-Status je Kabel/Gerät (geplant…außer Betrieb)
 *  - Mess-/Test-Ergebnis je Kabel
 *  - Service-/Wartungs-Historie je Gerät
 *  - attribuiertes Änderungsprotokoll (MAC/IMACD) — wer/was/wann
 *  - Vergabe stabiler QR-/Asset-IDs für Etiketten ↔ Datensatz
 *
 * Bewusst KEIN Lock-Check: Lebenszyklus-Pflege ist der Post-Install-Use-Case
 * — sie muss auch auf einem als „finalized"/As-built markierten Plan möglich
 * sein (analog metaSlice, das im Viewer-Modus Metadaten erlaubt).
 */

export type LifecycleSlice = Pick<
  ProjectState,
  | 'addChangeLogEntry'
  | 'clearChangelog'
  | 'setCableInstallStatus'
  | 'setEquipmentInstallStatus'
  | 'setCableTestResult'
  | 'addServiceRecord'
  | 'removeServiceRecord'
  | 'assignDocIds'
  | 'applySourceDestLabels'
>

const currentAuthor = (): string =>
  useSettingsStore.getState().editorName?.trim() || 'Unbekannt'

/** Hängt einen Änderungs-Eintrag an (capped auf die letzten 500). */
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
  return {
    ...project,
    changelog: [...(project.changelog ?? []), entry].slice(-500),
  }
}

export const createLifecycleSlice: StateCreator<ProjectState, [], [], LifecycleSlice> = (
  set,
) => ({
  addChangeLogEntry: (kind, summary, target) =>
    set((state) => ({
      project: touchProject(appendLog(state.project, kind, summary, target)),
    })),

  clearChangelog: () =>
    set((state) => ({
      project: touchProject({ ...state.project, changelog: [] }),
    })),

  setCableInstallStatus: (id, status) =>
    set((state) => {
      const cable = state.project.cables.find((c) => c.id === id)
      if (!cable) return state
      const next = {
        ...state.project,
        cables: state.project.cables.map((c) =>
          c.id === id ? { ...c, installStatus: status } : c,
        ),
      }
      const label = status ? INSTALL_STATUS_LABEL[status] : 'kein Status'
      return {
        project: touchProject(
          appendLog(next, 'status', `Kabel „${cableLabelId(cable)}" → ${label}`, {
            type: 'cable',
            id,
            name: cable.name,
          }),
        ),
      }
    }),

  setEquipmentInstallStatus: (id, status) =>
    set((state) => {
      const eq = state.project.equipment.find((e) => e.id === id)
      if (!eq) return state
      const next = {
        ...state.project,
        equipment: state.project.equipment.map((e) =>
          e.id === id ? { ...e, installStatus: status } : e,
        ),
      }
      const label = status ? INSTALL_STATUS_LABEL[status] : 'kein Status'
      return {
        project: touchProject(
          appendLog(next, 'status', `Gerät „${eq.name}" → ${label}`, {
            type: 'equipment',
            id,
            name: eq.name,
          }),
        ),
      }
    }),

  setCableTestResult: (id, result) =>
    set((state) => {
      const cable = state.project.cables.find((c) => c.id === id)
      if (!cable) return state
      const next = {
        ...state.project,
        cables: state.project.cables.map((c) =>
          c.id === id ? { ...c, testResult: result } : c,
        ),
      }
      const summary = result
        ? `Test „${cableLabelId(cable)}": ${result.result === 'pass' ? 'PASS' : 'FAIL'}`
        : `Test „${cableLabelId(cable)}" gelöscht`
      return {
        project: touchProject(
          appendLog(next, 'commission', summary, { type: 'cable', id, name: cable.name }),
        ),
      }
    }),

  addServiceRecord: (equipmentId, record) =>
    set((state) => {
      const eq = state.project.equipment.find((e) => e.id === equipmentId)
      if (!eq) return state
      const full: ServiceRecord = { ...record, id: uuidv4() }
      const next = {
        ...state.project,
        equipment: state.project.equipment.map((e) =>
          e.id === equipmentId
            ? { ...e, serviceHistory: [...(e.serviceHistory ?? []), full] }
            : e,
        ),
      }
      return {
        project: touchProject(
          appendLog(next, 'service', `Service „${eq.name}": ${record.summary}`, {
            type: 'equipment',
            id: equipmentId,
            name: eq.name,
          }),
        ),
      }
    }),

  removeServiceRecord: (equipmentId, recordId) =>
    set((state) => {
      const eq = state.project.equipment.find((e) => e.id === equipmentId)
      if (!eq) return state
      return {
        project: touchProject({
          ...state.project,
          equipment: state.project.equipment.map((e) =>
            e.id === equipmentId
              ? {
                  ...e,
                  serviceHistory: (e.serviceHistory ?? []).filter(
                    (r) => r.id !== recordId,
                  ),
                }
              : e,
          ),
        }),
      }
    }),

  assignDocIds: () => {
    let cableCount = 0
    let equipmentCount = 0
    set((state) => {
      // Bereits vergebene IDs sammeln, damit wir keine Kollision erzeugen.
      const used = new Set<string>()
      for (const c of state.project.cables) if (c.qrId) used.add(c.qrId)
      for (const e of state.project.equipment) if (e.qrId) used.add(e.qrId)

      let cn = 0
      const cables = state.project.cables.map((c) => {
        if (c.qrId) return c
        cn += 1
        let id = makeDocId('C', cn)
        while (used.has(id)) {
          cn += 1
          id = makeDocId('C', cn)
        }
        used.add(id)
        cableCount += 1
        return { ...c, qrId: id }
      })

      let en = 0
      const equipment = state.project.equipment.map((e) => {
        if (e.qrId) return e
        en += 1
        let id = makeDocId('A', en)
        while (used.has(id)) {
          en += 1
          id = makeDocId('A', en)
        }
        used.add(id)
        equipmentCount += 1
        return { ...e, qrId: id }
      })

      if (cableCount === 0 && equipmentCount === 0) return state
      const next = { ...state.project, cables, equipment }
      return {
        project: touchProject(
          appendLog(
            next,
            'change',
            `QR-/Asset-IDs vergeben (${cableCount} Kabel, ${equipmentCount} Geräte)`,
            { type: 'project' },
          ),
        ),
      }
    })
    return { cables: cableCount, equipment: equipmentCount }
  },

  applySourceDestLabels: (opts) => {
    const overwrite = opts?.overwrite ?? false
    let count = 0
    set((state) => {
      const eqById = new Map(state.project.equipment.map((e) => [e.id, e]))
      const cables = state.project.cables.map((c) => {
        // Ohne Overwrite nur leere Namen füllen — vorhandene (oft vom User
        // vergebene) Namen werden nicht überschrieben.
        if (!overwrite && c.name?.trim()) return c
        const label = sourceDestLabel(c, eqById)
        if (!label || label === c.name) return c
        count += 1
        return { ...c, name: label }
      })
      if (count === 0) return state
      const next = { ...state.project, cables }
      return {
        project: touchProject(
          appendLog(
            next,
            'change',
            `Kabel-Labels aus Quelle→Ziel erzeugt (${count}${overwrite ? ', überschrieben' : ''})`,
            { type: 'project' },
          ),
        ),
      }
    })
    return count
  },
})

// Re-export für Konsumenten, die nur die Typen brauchen.
export type { CableTestResult, InstallStatus, ServiceRecord }
