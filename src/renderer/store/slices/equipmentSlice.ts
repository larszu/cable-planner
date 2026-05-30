import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Cable } from '../../types/cable'
import type { EquipmentItem, Port } from '../../types/equipment'
import { useUiStore } from '../uiStore'
import { cableTypePatchFromPorts } from '../../lib/cableInheritance'
import { upsertCachedRentmanTemplateFromEquipment } from '../../lib/rentmanTemplateCache'
import { isProjectLocked, sanitizePort, touchProject } from '../projectStoreHelpers'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'

/**
 * #308 — Equipment-Slice. Equipment-CRUD-Actions:
 *  - addEquipment / importEquipment: Library-Drag/Drop + GraphML/JSON-
 *    Import. Beide gehen durch sanitizePort um Default-Port-IDs zu
 *    generieren falls die Template/Datei-Quelle leere IDs liefert.
 *  - updateEquipment: in-place Patch mit Cable-Waypoint-Mitziehen
 *    (drawio-Style — draggen zieht nur den naechsten waypoint mit,
 *    nicht den ganzen Pfad) + Cable-Type-Inheritance bei
 *    ConnectorType-Aenderungen.
 *  - deleteEquipment: cascading Cable-Cleanup.
 *  - setActiveDeviceMode (Issue #113): Port-Layout-Snapshot des
 *    aktivierten Modus auf die live inputs/outputs kopieren +
 *    nachgelagert Cable-Type-Inheritance auf betroffene Kabel
 *    anwenden.
 *  - addOpenEndStub: virtuelles 1-Port-"Open"-Device um einen
 *    losen Stecker auf dem Canvas zu repraesentieren.
 *
 * Nicht hier (bleibt in projectStore.ts):
 *  - pasteEquipment (Cross-Domain mit Cable-Copy + remap-Logik)
 *  - importGraphml (eigene Section mit Cable+Viewport-Logik)
 *  - deleteSelected (Quer-Funktional ueber Equipment+Cable+Location)
 *  - loadProject / clear (Heal-Library + Reset-State)
 */

const shouldSyncRentmanTemplateCache = (patch: Partial<EquipmentItem>): boolean => {
  const keys = Object.keys(patch) as Array<keyof EquipmentItem>
  // Ignore pure position updates to avoid excessive localStorage writes while dragging.
  return keys.some((key) => key !== 'x' && key !== 'y')
}

export type EquipmentSlice = Pick<
  ProjectState,
  | 'addEquipment'
  | 'importEquipment'
  | 'insertGeneratedPlan'
  | 'updateEquipment'
  | 'deleteEquipment'
  | 'setActiveDeviceMode'
  | 'addOpenEndStub'
  | 'replaceEquipmentWithTemplate'
>

export const createEquipmentSlice: StateCreator<ProjectState, [], [], EquipmentSlice> = (set) => ({
  addEquipment: (equipment) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return {
        // Adding from the Library (click / drag-drop) must NOT keep any prior
        // selection live, because React Flow's internal multi-select would
        // otherwise cause the next pointer-down on the canvas to start a
        // group-drag that visibly moves the previously selected device(s).
        selectedEquipmentId: undefined,
        selectedCableId: undefined,
        selectedLocationId: undefined,
        project: touchProject({
          ...state.project,
          equipment: [
            ...state.project.equipment,
            {
              ...equipment,
              id: uuidv4(),
              // v7.9.63 / #172 — Default-Gerätefarbe aus uiStore wenn der
              // Caller selber keine nodeColor mitschickt. So kann der User
              // in Settings einmal eine Standardfarbe wählen, die für alle
              // neu hinzugefügten Geräte gilt.
              nodeColor: equipment.nodeColor ?? useUiStore.getState().defaultDeviceColor,
              // CRITICAL: Ensure x/y are valid numbers. If somehow they're undefined/NaN,
              // default to (0, 0) so equipment doesn't disappear.
              x: equipment.x !== undefined && !Number.isNaN(equipment.x) ? equipment.x : 0,
              y: equipment.y !== undefined && !Number.isNaN(equipment.y) ? equipment.y : 0,
              // Ensure every port gets a unique id. Some library helpers seed
              // templates with `id: ''` and rely on the store to assign ids on
              // placement — without this, all handles on the node would share
              // the empty string and ReactFlow would always snap new cables to
              // the first handle.
              inputs: equipment.inputs.map((p) =>
                sanitizePort(p, p.name ?? 'Input'),
              ),
              outputs: equipment.outputs.map((p) =>
                sanitizePort(p, p.name ?? 'Output'),
              ),
            },
          ],
        }),
      }
    }),
  importEquipment: (equipment) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return {
        project: touchProject({
          ...state.project,
          equipment: [
            ...state.project.equipment,
            ...equipment.map((item) => ({
              ...item,
              id: item.id || uuidv4(),
              // CRITICAL: Ensure x/y are valid numbers. Equipment being imported
              // should have positions, but if somehow they don't, default to (0, 0)
              // to prevent disappearing equipment.
              x: item.x !== undefined && !Number.isNaN(item.x) ? item.x : 0,
              y: item.y !== undefined && !Number.isNaN(item.y) ? item.y : 0,
              inputs: item.inputs.map((p, index) => sanitizePort(p, `In ${index + 1}`)),
              outputs: item.outputs.map((p, index) => sanitizePort(p, `Out ${index + 1}`)),
            })),
          ],
        }),
      }
    }),
  insertGeneratedPlan: (equipment, cables) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      // #414 — Geräte UND Kabel atomar einfügen, OHNE die IDs neu zu
      // vergeben (die Kabel referenzieren die mitgelieferten Equipment-/
      // Port-IDs). Daher kein Re-ID wie in importEquipment.
      return {
        project: touchProject({
          ...state.project,
          equipment: [...state.project.equipment, ...equipment],
          cables: [...state.project.cables, ...cables],
        }),
      }
    }),
  updateEquipment: (id, patch) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const prev = state.project.equipment.find((e) => e.id === id)
      let updatedItem: EquipmentItem | undefined
      const nextEquipment = state.project.equipment.map((item) =>
        item.id === id
          ? ((updatedItem = {
              ...item,
              ...patch,
              // CRITICAL: Never allow position to become undefined or NaN.
              // If patch accidentally omits x/y or sets them to undefined,
              // preserve the previous values to prevent equipment from disappearing.
              x: patch.x !== undefined && !Number.isNaN(patch.x) ? patch.x : item.x,
              y: patch.y !== undefined && !Number.isNaN(patch.y) ? patch.y : item.y,
            }),
            updatedItem)
          : item,
      )
      // If the equipment moved, also shift waypoints of cables attached to it
      // so the cable visually travels with the device (draw.io-style). When
      // only ONE endpoint moves, shifting *all* waypoints by the full delta
      // would break the path on the *other* (still-anchored) side and produce
      // an erratic, "spinning" orthogonal route. So we only shift the single
      // waypoint adjacent to the moving port (first for source, last for
      // target). When both endpoints sit on the same device we translate the
      // whole path.
      let nextCables: Cable[] = state.project.cables
      if (
        prev &&
        patch.x !== undefined &&
        patch.y !== undefined &&
        (patch.x !== prev.x || patch.y !== prev.y)
      ) {
        const dx = patch.x - prev.x
        const dy = patch.y - prev.y
        nextCables = state.project.cables.map((c) => {
          if (!c.waypoints || c.waypoints.length === 0) return c
          const touchesSource = c.fromEquipmentId === id
          const touchesTarget = c.toEquipmentId === id
          if (!touchesSource && !touchesTarget) return c
          if (touchesSource && touchesTarget) {
            return {
              ...c,
              waypoints: c.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })),
            }
          }
          const next = c.waypoints.slice()
          if (touchesSource) {
            const w = next[0]
            next[0] = { x: w.x + dx, y: w.y + dy }
          } else {
            const lastIdx = next.length - 1
            const w = next[lastIdx]
            next[lastIdx] = { x: w.x + dx, y: w.y + dy }
          }
          return { ...c, waypoints: next }
        })
      }
      if (updatedItem?.rentmanId && shouldSyncRentmanTemplateCache(patch)) {
        upsertCachedRentmanTemplateFromEquipment(updatedItem)
      }

      // v7.9.125 — propagate port ConnectorType changes to connected
      // cables (Cable Connector Type Inheritance). Only kicks in when
      // ports actually changed connector type on THIS equipment.
      if (prev && updatedItem && useUiStore.getState().inheritCableTypeFromPort) {
        const oldPorts = new Map<string, string>(
          [...prev.inputs, ...prev.outputs].map((p) => [p.id, p.connectorType]),
        )
        const changedPortIds = new Set<string>()
        for (const p of [...updatedItem.inputs, ...updatedItem.outputs]) {
          const old = oldPorts.get(p.id)
          if (old !== undefined && old !== p.connectorType) changedPortIds.add(p.id)
        }
        if (changedPortIds.size > 0) {
          nextCables = nextCables.map((c) => {
            const touches =
              (c.fromEquipmentId === id && changedPortIds.has(c.fromPortId)) ||
              (c.toEquipmentId === id && changedPortIds.has(c.toPortId))
            if (!touches) return c
            const cableTypePatch = cableTypePatchFromPorts(c, nextEquipment)
            return cableTypePatch ? { ...c, ...cableTypePatch } : c
          })
        }
      }

      return {
        project: touchProject({
          ...state.project,
          equipment: nextEquipment,
          cables: nextCables,
        }),
      }
    }),
  setActiveDeviceMode: (equipmentId, modeId) =>
    set((state) => {
      const eq = state.project.equipment.find((e) => e.id === equipmentId)
      if (!eq || !eq.modes || eq.modes.length === 0) return {}
      const mode = modeId ? eq.modes.find((m) => m.id === modeId) : null
      if (modeId && !mode) return {}
      // Replace the live port arrays with the mode's snapshot (or
      // leave them as-is when clearing the active mode — the user can
      // still edit ports manually).
      const nextEquipment = state.project.equipment.map((item) =>
        item.id === equipmentId
          ? {
              ...item,
              activeModeId: mode?.id,
              inputs: mode ? mode.inputs.map((p) => ({ ...p })) : item.inputs,
              outputs: mode ? mode.outputs.map((p) => ({ ...p })) : item.outputs,
            }
          : item,
      )
      // v7.9.125 — mode switching replaces ports wholesale; matching
      // port-ids may now expose a different ConnectorType, so feed
      // affected cables through the inheritance helper too.
      let nextCables = state.project.cables
      if (mode && useUiStore.getState().inheritCableTypeFromPort) {
        nextCables = state.project.cables.map((c) => {
          if (c.fromEquipmentId !== equipmentId && c.toEquipmentId !== equipmentId) return c
          const cableTypePatch = cableTypePatchFromPorts(c, nextEquipment)
          return cableTypePatch ? { ...c, ...cableTypePatch } : c
        })
      }
      const updated = touchProject({
        ...state.project,
        equipment: nextEquipment,
        cables: nextCables,
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  deleteEquipment: (id) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return {
        project: touchProject({
          ...state.project,
          equipment: state.project.equipment.filter((item) => item.id !== id),
          cables: state.project.cables.filter(
            (cable) => cable.fromEquipmentId !== id && cable.toEquipmentId !== id,
          ),
        }),
        selectedEquipmentId:
          state.selectedEquipmentId === id ? undefined : state.selectedEquipmentId,
      }
    }),
  addOpenEndStub: (at, connectorType, side) => {
    const id = uuidv4()
    const portId = uuidv4()
    const stubPort: Port = {
      id: portId,
      name: 'Open End',
      type: connectorType,
      connectorType,
    }
    const stub: EquipmentItem = {
      id,
      name: `Open ${connectorType}`,
      category: 'Open End',
      inputs: side === 'input' ? [stubPort] : [],
      outputs: side === 'output' ? [stubPort] : [],
      x: at.x,
      y: at.y,
      width: 140,
      height: 60,
    }
    set((state) => ({
      project: touchProject({
        ...state.project,
        equipment: [...state.project.equipment, stub],
      }),
    }))
    // expose port id via returned stub id lookup — caller knows portId is first port
    // Actually caller needs the portId — we encode as `${id}|${portId}` for simplicity.
    return `${id}|${portId}`
  },

  // #314 — Geraet auf dem Canvas durch ein anderes Template ersetzen,
  // ohne die Kabel zu verlieren. Ports werden gematcht nach
  //  1. (connectorType, contentLabel||name)  — beste Uebereinstimmung
  //  2. (connectorType, positional) fuer noch nicht zugeordnete Ports
  // Cables die kein Mapping kriegen werden geloescht (sonst zeigt
  // ReactFlow ein "broken edge" auf einen nicht-existenten Port).
  // Caller (UI) bestaetigt vorher in einem Summary-Dialog.
  replaceEquipmentWithTemplate: (equipmentId, template) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const oldEq = state.project.equipment.find((e) => e.id === equipmentId)
      if (!oldEq) return state

      // Fresh port ids fuer die Template-Ports (Templates kommen oft mit '' als id).
      const newInputs = template.inputs.map((p, idx) =>
        sanitizePort({ ...p, id: uuidv4() }, p.name ?? `In ${idx + 1}`),
      )
      const newOutputs = template.outputs.map((p, idx) =>
        sanitizePort({ ...p, id: uuidv4() }, p.name ?? `Out ${idx + 1}`),
      )

      // Mapping bauen — getrennt fuer Inputs/Outputs damit ein BNC-In nie
      // mit einem BNC-Out gemappt wird.
      const buildMap = (oldPorts: Port[], newPorts: Port[]): Map<string, string> => {
        const map = new Map<string, string>()
        const used = new Set<string>()
        const oldKey = (p: Port) => (p.contentLabel || p.name || '').trim().toLowerCase()
        // Pass 1: exact (connectorType, contentLabel||name) match
        for (const op of oldPorts) {
          const ok = oldKey(op)
          const m = newPorts.find(
            (np) =>
              !used.has(np.id) &&
              np.connectorType === op.connectorType &&
              ok &&
              oldKey(np) === ok,
          )
          if (m) {
            map.set(op.id, m.id)
            used.add(m.id)
          }
        }
        // Pass 2: positional within connectorType
        for (const op of oldPorts) {
          if (map.has(op.id)) continue
          const m = newPorts.find(
            (np) => !used.has(np.id) && np.connectorType === op.connectorType,
          )
          if (m) {
            map.set(op.id, m.id)
            used.add(m.id)
          }
        }
        return map
      }
      const inMap = buildMap(oldEq.inputs, newInputs)
      const outMap = buildMap(oldEq.outputs, newOutputs)

      // Cables migrieren — wenn ein Endpunkt am alten Equipment haengt
      // und kein Mapping existiert, faellt das Kabel raus.
      const nextCables: Cable[] = []
      for (const c of state.project.cables) {
        let drop = false
        let nextC = { ...c }
        if (c.fromEquipmentId === equipmentId) {
          const mapped = inMap.get(c.fromPortId) ?? outMap.get(c.fromPortId)
          if (mapped) {
            nextC = { ...nextC, fromPortId: mapped }
          } else {
            drop = true
          }
        }
        if (c.toEquipmentId === equipmentId) {
          const mapped = inMap.get(c.toPortId) ?? outMap.get(c.toPortId)
          if (mapped) {
            nextC = { ...nextC, toPortId: mapped }
          } else {
            drop = true
          }
        }
        if (!drop) nextCables.push(nextC)
      }

      const nextEq: EquipmentItem = {
        ...oldEq,
        // Template-Identitaet uebernehmen — Categorie, Inputs/Outputs,
        // physische Maße, Hersteller. Position + nodeColor + manuelle
        // Name-Edits bleiben am Equipment. libraryRef.name updaten damit
        // Library-Sync den neuen Template-Namen kennt.
        libraryRef: template.libraryRef
          ? template.libraryRef
          : oldEq.libraryRef
            ? { ...oldEq.libraryRef, name: template.name }
            : undefined,
        category: template.category,
        inputs: newInputs,
        outputs: newOutputs,
        rackUnits: template.rackUnits ?? oldEq.rackUnits,
        isRackDevice: template.isRackDevice ?? oldEq.isRackDevice,
        manufacturerUrl: template.manufacturerUrl ?? oldEq.manufacturerUrl,
        imageUrl: template.imageUrl ?? oldEq.imageUrl,
        icon: template.icon ?? oldEq.icon,
        depthMm: template.depthMm ?? oldEq.depthMm,
        powerWatts: template.powerWatts ?? oldEq.powerWatts,
        weightKg: template.weightKg ?? oldEq.weightKg,
      }

      const nextEquipment = state.project.equipment.map((e) =>
        e.id === equipmentId ? nextEq : e,
      )

      const updatedProject = touchProject({
        ...state.project,
        equipment: nextEquipment,
        cables: nextCables,
      })
      scheduleProjectAutosave(updatedProject)
      return { project: updatedProject }
    }),
})
