import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'
import type { SourceIdentity } from '../../types/sourceIdentity'
import { renameRefusal } from '../../lib/renameImpact'

/**
 * ADR-001, Inkrement 2 — Signalquellen-Rollen.
 *
 * Eine Rolle („Kamera 1") ueberlebt den Geraetetausch; deshalb liegt sie
 * neben den Geraeten und nicht in ihnen. Mehrere Geraete duerfen dieselbe
 * Rolle tragen (Haupt-/Backup-Paar), ein Geraet traegt hoechstens eine.
 *
 * Beim Loeschen einer Rolle werden alle Bindungen mitgeloescht — ein
 * Fehlzeiger sieht im Plan aus wie eine zugewiesene Tally-Adresse und ist
 * damit schlimmer als gar keine Bindung. `healProjectPositions` raeumt
 * dieselben Zeiger beim Laden auf, falls eine Datei sie doch mitbringt.
 */
export type SourceIdentitySlice = Pick<
  ProjectState,
  | 'addSourceIdentity'
  | 'updateSourceIdentity'
  | 'renameSourceIdentity'
  | 'removeSourceIdentity'
  | 'bindEquipmentToSourceIdentity'
>

export const createSourceIdentitySlice: StateCreator<
  ProjectState,
  [],
  [],
  SourceIdentitySlice
> = (set) => ({
  addSourceIdentity: (identity) => {
    // Liefert undefined, wenn nichts angelegt wurde. Sonst bekaeme der
    // Aufrufer eine Id zurueck, hinter der keine Rolle steht, und wuerde ein
    // Geraet an ein Phantom binden.
    const name = identity.name.trim()
    if (!name) return undefined
    const id = identity.id?.trim() || uuidv4()
    let created = false
    set((state) => {
      const existing = state.project.sourceIdentities ?? []
      if (existing.some((s) => s.id === id)) {
        // Explizit vorgegebene Id existiert schon — der Aufrufer meint diese
        // Rolle, also gilt sie als "da" und die Id ist gueltig.
        created = true
        return {}
      }
      const next: SourceIdentity = { ...identity, id, name }
      const updated = { ...state.project, sourceIdentities: [...existing, next] }
      scheduleProjectAutosave(updated)
      created = true
      return { project: updated }
    })
    return created ? id : undefined
  },
  updateSourceIdentity: (id, patch) =>
    set((state) => {
      const existing = state.project.sourceIdentities ?? []
      if (!existing.some((s) => s.id === id)) return {}
      // `name` steht nicht im Typ des Patches — umbenannt wird ueber
      // `renameSourceIdentity`. Sollte ein ungetypter Aufrufer ihn doch
      // mitschicken, faellt er hier weg, statt an der Pruefung vorbeizukommen.
      const { name: _verworfen, ...rest } = patch as Partial<SourceIdentity>
      const next = existing.map((s) => (s.id === id ? { ...s, ...rest, id: s.id } : s))
      const updated = { ...state.project, sourceIdentities: next }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  /**
   * BEDARF 101 — die eine Aenderung, mit einem Grund statt eines Schweigens.
   *
   * Der Beleg (`bitfocus/companion#1266`, `#4324`) beschreibt das Nachtippen
   * auf jedem Knopf. Hier folgt jedes abgeleitete Blatt der Rolle von selbst,
   * weil es ihren Namen ueber `deriveLabels` nachliest — diese Funktion ist
   * die einzige Stelle, an der er sich aendert.
   *
   * Abgelehnt wird mit `RenameRefusal` und nicht mit `false`: „name-taken"
   * und „empty-name" verlangen verschiedene Antworten des Bedienenden, und
   * ein Boolean zwaenge die Oberflaeche, den Grund zu erraten.
   */
  renameSourceIdentity: (id, newName) => {
    let absage: ReturnType<typeof renameRefusal> = null
    set((state) => {
      const existing = state.project.sourceIdentities ?? []
      absage = renameRefusal(existing, id, newName)
      if (absage) return {}
      const trimmed = newName.trim()
      const updated = {
        ...state.project,
        sourceIdentities: existing.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    })
    return absage ?? undefined
  },
  removeSourceIdentity: (id) =>
    set((state) => {
      const existing = state.project.sourceIdentities ?? []
      if (!existing.some((s) => s.id === id)) return {}
      const updated = {
        ...state.project,
        sourceIdentities: existing.filter((s) => s.id !== id),
        equipment: state.project.equipment.map((e) =>
          e.sourceIdentityId === id ? { ...e, sourceIdentityId: undefined } : e,
        ),
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  bindEquipmentToSourceIdentity: (equipmentId, identityId) =>
    set((state) => {
      const existing = state.project.sourceIdentities ?? []
      if (identityId !== undefined && !existing.some((s) => s.id === identityId)) return {}
      const updated = {
        ...state.project,
        equipment: state.project.equipment.map((e) =>
          e.id === equipmentId ? { ...e, sourceIdentityId: identityId } : e,
        ),
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
