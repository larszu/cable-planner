import type { StateCreator } from 'zustand'
import { isProjectLocked, sanitizePort, touchProject } from '../projectStoreHelpers'
import type { ProjectState } from '../projectStore'

/**
 * #597 — NetBox-Import-Slice.
 *
 * Eigenständige Slice, weil ein NetBox-Abgleich als EINE Mutation über
 * vier Bereiche des Projekts geht (Equipment, Kabel, Locations, Metadata)
 * und dabei atomar bleiben muss: der Undo-Stack soll einen Import als
 * einen Schritt sehen, nicht als vier. Die eigentliche Diff-Logik liegt
 * bewusst ausserhalb des Stores in `lib/netboxMapping.ts` (rein, testbar) —
 * hier wird nur noch angewendet.
 *
 * Additiv per Konstruktion: es wird nur angehängt und ergänzt, nie ersetzt
 * oder gelöscht. Bereits vorhandene Geräte/Kabel bleiben inklusive aller
 * manuellen Nacharbeit (Position, Farbe, Wegpunkte, Labels) unangetastet.
 */
export type NetboxImportSlice = Pick<ProjectState, 'applyNetboxImport'>

export const createNetboxImportSlice: StateCreator<ProjectState, [], [], NetboxImportSlice> = (
  set,
) => ({
  applyNetboxImport: (payload) =>
    set((state) => {
      if (isProjectLocked(state)) return state

      // Ports an bereits vorhandenen Geräten ergänzen (in NetBox neu
      // angelegte Interfaces). Die Ports tragen fertige uuids aus dem
      // Mapping — `sanitizePort` heilt trotzdem, falls eines fehlt.
      const additionsById = new Map(payload.portAdditions.map((p) => [p.equipmentId, p]))
      const equipment = state.project.equipment.map((item) => {
        const addition = additionsById.get(item.id)
        if (!addition) return item
        return {
          ...item,
          inputs: [
            ...item.inputs,
            ...addition.inputs.map((p) => sanitizePort(p, p.name ?? 'Input')),
          ],
          outputs: [
            ...item.outputs,
            ...addition.outputs.map((p) => sanitizePort(p, p.name ?? 'Output')),
          ],
          // Sobald echte Ports da sind, ist die Belegung nicht mehr unbekannt.
          ...(addition.inputs.length + addition.outputs.length > 0
            ? { portsUnknown: undefined }
            : {}),
        }
      })

      return {
        project: touchProject({
          ...state.project,
          // Neue Geräte behalten ihre im Mapping vergebenen IDs — die neuen
          // Kabel referenzieren genau diese Equipment-/Port-IDs.
          equipment: [...equipment, ...payload.newEquipment],
          cables: [...state.project.cables, ...payload.newCables],
          locations: [...(state.project.locations ?? []), ...payload.newLocations],
          metadata: {
            ...state.project.metadata,
            netboxSourceUrl: payload.source.baseUrl,
            netboxScope: payload.source.scope,
            netboxScopeId: payload.source.scopeId,
            netboxScopeName: payload.source.scopeName,
            netboxLastSyncAt: new Date().toISOString(),
          },
        }),
      }
    }),
})
