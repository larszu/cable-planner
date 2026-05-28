import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Cable } from '../../types/cable'
import { useUiStore } from '../uiStore'
import {
  cableTypePatchFromPorts,
  isBidirectionalCableType,
} from '../../lib/cableInheritance'
import { detectLayerForConnector } from '../../lib/cableLayers'
import { isProjectLocked, touchProject } from '../projectStoreHelpers'
import type { ProjectState } from '../projectStore'

/**
 * #308 — Cable-Slice (Phase 1). Die zentrale Cable-Create-Pipeline:
 * queueConnection (mit Port-Conflict-Check), resolvePortConflictByReplace,
 * cancelPortConflict, closeCableDialog, createCableFromPending, updateCable.
 *
 * deleteCable und reconnectCable bleiben vorerst in projectStore.ts —
 * deleteSelected ist quer-funktional (Equipment/Cable/Location) und
 * gehoert in keine Single-Domain-Slice.
 */

type CableDraft = Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'> &
  Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>

export type CableSlice = Pick<
  ProjectState,
  | 'queueConnection'
  | 'resolvePortConflictByReplace'
  | 'cancelPortConflict'
  | 'closeCableDialog'
  | 'createCableFromPending'
  | 'updateCable'
>

export const createCableSlice: StateCreator<ProjectState, [], [], CableSlice> = (set) => ({
  queueConnection: (connection, waypoints) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      // #294 — Port-Konflikt-Check. Wenn der ZIEL-Port (targetHandle)
      // bereits in einem anderen Kabel als toPortId verwendet wird, oeffnen
      // wir den PortConflictDialog statt direkt den CableDialog. Source-
      // Ports werden bewusst NICHT geprueft — Outputs koennen sinnvoll
      // mehrere parallel Kabel speisen (1-to-many Distribution).
      const targetHandle = connection.targetHandle
      const conflictingCables = targetHandle
        ? state.project.cables.filter((c) => c.toPortId === targetHandle)
        : []
      if (conflictingCables.length > 0) {
        return {
          portConflict: {
            connection,
            waypoints,
            conflictingCableIds: conflictingCables.map((c) => c.id),
          },
        }
      }
      return {
        pendingConnection: connection,
        pendingWaypoints: waypoints && waypoints.length > 0 ? waypoints : undefined,
        showCableDialog: true,
      }
    }),
  resolvePortConflictByReplace: () =>
    set((state) => {
      if (!state.portConflict) return state
      const { connection, waypoints, conflictingCableIds } = state.portConflict
      const conflictSet = new Set(conflictingCableIds)
      return {
        project: touchProject({
          ...state.project,
          cables: state.project.cables.filter((c) => !conflictSet.has(c.id)),
        }),
        pendingConnection: connection,
        pendingWaypoints: waypoints && waypoints.length > 0 ? waypoints : undefined,
        showCableDialog: true,
        portConflict: undefined,
      }
    }),
  cancelPortConflict: () => set({ portConflict: undefined }),
  closeCableDialog: () =>
    set({ pendingConnection: undefined, pendingWaypoints: undefined, showCableDialog: false }),
  createCableFromPending: (draft: CableDraft) =>
    set((state) => {
      // #295 — Hard-Block bei finalized/viewer-Mode. queueConnection blockt
      // schon das Setzen von pendingConnection, aber falls der Lock zwischen
      // den beiden Calls hineinkommt (Race) oder pendingConnection von
      // anderem Pfad gesetzt wurde, fangen wir das hier nochmal.
      if (isProjectLocked(state)) {
        return { pendingConnection: undefined, pendingWaypoints: undefined, showCableDialog: false }
      }
      if (!state.pendingConnection || !state.pendingConnection.source || !state.pendingConnection.target) {
        return { pendingConnection: undefined, pendingWaypoints: undefined, showCableDialog: false }
      }

      const ui = useUiStore.getState()
      // v7.9.85 / #123 — Layer-Auto-Detect aus dem Cable-Type.
      // v7.9.95: Fallback ist 'other', also nie undefined.
      const autoLayer = detectLayerForConnector(draft.type)
      const cable: Cable = {
        id: uuidv4(),
        name: draft.name,
        type: draft.type,
        length: draft.length,
        color: draft.color,
        fromEquipmentId: state.pendingConnection.source,
        fromPortId: state.pendingConnection.sourceHandle ?? '',
        toEquipmentId: state.pendingConnection.target,
        toPortId: state.pendingConnection.targetHandle ?? '',
        notes: draft.notes,
        cableSpecId: draft.cableSpecId,
        standard: draft.standard,
        needsConverter: draft.needsConverter,
        routing: ui.defaultRouting,
        arrowEnd: ui.defaultArrow,
        // Inherently two-way cable types get the bidirectional flag set
        // by default (issue #67). The user can still untick it in
        // CableProperties if they want to show a one-way arrow anyway.
        bidirectional: isBidirectionalCableType(draft.type),
        strokeWidth: 2.5,
        waypoints: state.pendingWaypoints,
        layer: autoLayer,
      }

      return {
        project: touchProject({
          ...state.project,
          cables: [...state.project.cables, cable],
        }),
        pendingConnection: undefined,
        pendingWaypoints: undefined,
        showCableDialog: false,
        selectedCableId: cable.id,
      }
    }),
  updateCable: (id, patch) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      // v7.9.125 — wenn CableProperties einen Endpoint umsetzt (eq/port-id),
      // muss die Connector-Type-Inheritance auch hier greifen.
      // updateCable wird sonst nur fuer Name/Color/Notes/etc. genutzt
      // — die brauchen kein Typ-Update.
      const endpointChanged =
        patch.fromEquipmentId !== undefined ||
        patch.fromPortId !== undefined ||
        patch.toEquipmentId !== undefined ||
        patch.toPortId !== undefined
      const inheritType =
        endpointChanged && useUiStore.getState().inheritCableTypeFromPort
      return {
        project: touchProject({
          ...state.project,
          cables: state.project.cables.map((item) => {
            if (item.id !== id) return item
            const merged = { ...item, ...patch }
            if (!inheritType) return merged
            const typePatch = cableTypePatchFromPorts(merged, state.project.equipment)
            return typePatch ? { ...merged, ...typePatch } : merged
          }),
        }),
      }
    }),
})
