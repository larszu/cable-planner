import type { StateCreator } from 'zustand'
import { v4 as uuid } from 'uuid'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'
import type { CablePlannerProject, RevisionSnapshot } from '../../types/project'

/**
 * #412 — Revisionen/Snapshots. Schreibt benannte Plan-Stände in
 * `project.revisions` und stellt einen früheren Stand wieder her.
 *
 * Pattern wie AnnotationSlice: `state.project` patchen + Autosave. Die
 * Snapshots enthalten selbst KEINE `revisions` (kein rekursives Wachstum),
 * und beim Restore bleibt die Revisions-Historie erhalten — man verliert
 * also nie seine festgeschriebenen Stände.
 */
export type RevisionSlice = Pick<
  ProjectState,
  'commitRevision' | 'restoreRevision' | 'deleteRevision'
>

/** Project ohne `revisions` — der reine Plan-Stand für einen Snapshot. */
const stripRevisions = (project: CablePlannerProject): RevisionSnapshot => {
  // Bewusst destrukturieren statt delete, damit der Typ exakt passt.
  const { revisions: _revisions, ...rest } = project
  void _revisions
  return rest
}

export const createRevisionSlice: StateCreator<ProjectState, [], [], RevisionSlice> = (
  set,
) => ({
  commitRevision: (label, note, asBuilt) =>
    set((state) => {
      const existing = state.project.revisions ?? []
      const revision = {
        id: uuid(),
        label: label.trim() || `Rev ${existing.length + 1}`,
        note: note.trim(),
        createdAt: new Date().toISOString(),
        asBuilt: !!asBuilt,
        snapshot: stripRevisions(state.project),
      }
      // #412 — Aktuelle Revision in die Metadaten stempeln, damit der
      // PDF-Titelblock sie zeigt. As-Built bekommt einen Zusatz.
      const stamp = revision.asBuilt ? `${revision.label} (As-Built)` : revision.label
      const updated = {
        ...state.project,
        revisions: [...existing, revision],
        metadata: { ...state.project.metadata, revision: stamp },
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  restoreRevision: (id) =>
    set((state) => {
      const revision = (state.project.revisions ?? []).find((r) => r.id === id)
      if (!revision) return {}
      // Snapshot wird zum aktuellen Plan; die Revisions-Historie bleibt
      // erhalten (an den wiederhergestellten Stand drangehaengt).
      const stamp = revision.asBuilt ? `${revision.label} (As-Built)` : revision.label
      const updated: CablePlannerProject = {
        ...revision.snapshot,
        revisions: state.project.revisions ?? [],
        metadata: { ...revision.snapshot.metadata, revision: stamp },
      }
      scheduleProjectAutosave(updated)
      return {
        project: updated,
        projectVersion: state.projectVersion + 1,
        selectedEquipmentId: undefined,
        selectedCableId: undefined,
        selectedLocationId: undefined,
      }
    }),
  deleteRevision: (id) =>
    set((state) => {
      const existing = state.project.revisions ?? []
      const updated = { ...state.project, revisions: existing.filter((r) => r.id !== id) }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
