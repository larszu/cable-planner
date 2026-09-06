import type { StateCreator } from 'zustand'
import type { CablePlannerProject } from '../../types/project'
import { touchProject } from '../projectStoreHelpers'
import { scheduleProjectAutosave } from '../projectAutosave'
import { applyNamingScheme } from '../../lib/namingScheme'
import type { ProjectState } from '../projectStore'

/**
 * #308 — MetaSlice. Kleine Setter ohne komplexes Cross-Domain-State:
 *  - File-State: setRecentProjects, setFilePath
 *  - Metadata: setProjectMeta (name+description), updateProjectMetadata
 *    (partieller Patch), setDefaultVideoFormat
 *  - Canvas-Viewport: setCanvasState (x/y/zoom — persistiert mit dem
 *    Projekt damit Reopen den Viewport restored)
 *  - Selection-State: setSelection, setSelectedTemplateName
 *  - Sonstiges: updateGreenGoConfig (eine eigene Slice waere overkill)
 *
 * Lock-Check fehlt absichtlich — Metadata-Felder duerfen auch im
 * Viewer-Modus angepasst werden (Project-Author bei Plan-Annahme,
 * RecentProjects-Liste sowieso).
 */
export type MetaSlice = Pick<
  ProjectState,
  | 'setRecentProjects'
  | 'setFilePath'
  | 'setProjectMeta'
  | 'updateProjectMetadata'
  | 'setDefaultVideoFormat'
  | 'setCanvasState'
  | 'setSelection'
  | 'setSelectedTemplateName'
  | 'updateGreenGoConfig'
  | 'setDrumKit'
  | 'setWirelessRig'
  | 'setMulticastConfig'
  | 'setFallbackPlan'
  | 'setEventMetadata'
  | 'setTransmissionRecord'
  | 'setCostPlan'
  | 'setNamingScheme'
  | 'applyNaming'
>

export const createMetaSlice: StateCreator<ProjectState, [], [], MetaSlice> = (set) => ({
  setRecentProjects: (items) => set({ recentProjects: items }),
  setFilePath: (path) => set({ filePath: path }),
  setProjectMeta: (name, description) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          name,
          description,
        },
      }),
    })),
  updateProjectMetadata: (patch) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          ...patch,
        },
      }),
    })),
  setDefaultVideoFormat: (id) =>
    set((state) => ({
      project: touchProject({
        ...state.project,
        metadata: {
          ...state.project.metadata,
          defaultVideoFormat: id as CablePlannerProject['metadata']['defaultVideoFormat'],
        },
      }),
    })),
  setCanvasState: (x, y, zoom) =>
    set((state) => ({
      project: {
        ...state.project,
        canvasState: { x, y, zoom },
      },
    })),
  setSelection: (equipmentId, cableId, locationId) =>
    set({
      selectedEquipmentId: equipmentId,
      selectedCableId: cableId,
      selectedLocationId: locationId,
      selectedTemplateName: undefined,
    }),
  setSelectedTemplateName: (name) =>
    set({
      selectedTemplateName: name,
      selectedEquipmentId: undefined,
      selectedCableId: undefined,
      selectedLocationId: undefined,
    }),
  updateGreenGoConfig: (config) =>
    set((state) => {
      const updated = { ...state.project, greengoConfig: config }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setDrumKit: (plan) =>
    set((state) => {
      const updated = { ...state.project, drumKit: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  setWirelessRig: (plan) =>
    set((state) => {
      const updated = { ...state.project, wirelessRig: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 72 — Pool, Port und die vergebenen Gruppen.
  //
  // Ein Setter fuer das ganze Objekt und keiner je Vergabe: der Aufrufer ist
  // `allocateMulticast`, das die vollstaendige Liste zurueckgibt. Ein
  // Einzel-Setter verfuehrte dazu, in einer Schleife zu vergeben — und jede
  // Zwischenstufe waere ein Zustand, in dem die Alias-Pruefung die eigenen
  // frisch vergebenen Adressen noch nicht kennt.
  setMulticastConfig: (config) =>
    set((state) => {
      const updated = { ...state.project, multicast: config }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 89 — das Sicherheitsnetz. Wieder ein Setter fuer das ganze Objekt:
  // Szenenliste, Waechter und Regeln haengen aneinander, und ein Einzel-Setter
  // je Regel liesse einen Zustand zu, in dem eine Regel auf eine Szene zeigt,
  // die die Liste noch nicht kennt — genau der Zustand, den die Pruefung
  // meldet, nur diesmal von der Oberflaeche selbst erzeugt.
  setFallbackPlan: (plan) =>
    set((state) => {
      const updated = { ...state.project, fallback: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 88 — die Veranstaltungsangaben. Ein Setter fuer das ganze Objekt,
  // aus demselben Grund wie oben: die Abweichungen je Ziel haengen an den
  // Projektwerten, gegen die sie abweichen. Ein Einzel-Setter je Abweichung
  // liesse den Zustand zu, in dem ein Ueberschreiber gegen einen Projektwert
  // steht, den es in derselben Aktion gar nicht mehr gibt.
  setEventMetadata: (plan) =>
    set((state) => {
      const updated = { ...state.project, eventMetadata: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 87 — der Sendebericht. Wieder ein Setter fuer das ganze Objekt:
  // Zusammenfassung und Eintraege gehoeren zusammen, und eine Zusammenfassung
  // ohne die Eintraege, auf die sie sich bezieht, waere eine Bewertung ohne
  // Beleg.
  setTransmissionRecord: (record) =>
    set((state) => {
      const updated = { ...state.project, transmissionRecord: record }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 79 — der Kostenvergleich. Wieder ein Setter fuer das ganze Objekt:
  // Waehrung, Toleranz und Positionen gehoeren zusammen, und eine Summe ueber
  // Positionen in zwei Waehrungen waere eine Zahl, die nichts bedeutet.
  setCostPlan: (plan) =>
    set((state) => {
      const updated = { ...state.project, costPlan: plan }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // BEDARF 74 — die Namensregel.
  setNamingScheme: (scheme) =>
    set((state) => {
      const updated = { ...state.project, namingScheme: scheme }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  // BEDARF 74 — die Regel ANWENDEN. Der Store rechnet hier nichts selbst: er
  // ruft `applyNamingScheme`, und wenn die verweigert (doppelte Namen, nichts
  // zu tun), bleibt der Zustand unveraendert. Eine Verweigerung im Store still
  // in ein Teil-Umbenennen zu verwandeln waere genau das Ueberschreiben, gegen
  // das Bedarf 96 geschrieben ist.
  applyNaming: (scheme) =>
    set((state) => {
      const result = applyNamingScheme(state.project, scheme)
      if (!result.project) return {}
      scheduleProjectAutosave(result.project)
      return { project: result.project }
    }),
})
