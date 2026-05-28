import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Cable } from '../../types/cable'
import { useUiStore } from '../uiStore'
import { cableCatalog } from '../../types/cableSpec'
import { detectLayerForConnector } from '../../lib/cableLayers'
import { inheritedCableType } from '../../lib/cableInheritance'
import { isProjectLocked, touchProject } from '../projectStoreHelpers'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'

/**
 * #308 — Mobile-Sync-Slice. Bridge zwischen Canvas und Mobile-Viewer:
 *  - setCheckState: full replace der ✓-Haken (Mobile -> Canvas-Sync)
 *  - clearPortCheck / clearCableCheck / clearAllMobileChecks:
 *    User-Request "Haken im Canvas auch wieder loeschen koennen"
 *  - addCableFromMobile: vom Mobile-Viewer ergaenztes Kabel (mit
 *    cableSpec-Lookup + Type-Inheritance-Fallback + addedFromMobile-
 *    Badge fuer Canvas-Anzeige)
 *
 * isProjectLocked-Guard nur bei addCableFromMobile (Defense-in-Depth
 * gegen finalized/viewer Bypass) — checks duerfen auch im viewer-Modus
 * gesetzt werden, das ist Teil der "Plan abhaken"-UX.
 */
export type MobileSyncSlice = Pick<
  ProjectState,
  'setCheckState' | 'clearPortCheck' | 'clearCableCheck' | 'clearAllMobileChecks' | 'addCableFromMobile'
>

export const createMobileSyncSlice: StateCreator<ProjectState, [], [], MobileSyncSlice> = (set) => ({
  setCheckState: (checks) =>
    set((state) => {
      const updated = { ...state.project, checkState: checks }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  clearPortCheck: (deviceId, portId) =>
    set((state) => {
      const cur = state.project.checkState
      if (!cur) return state
      const key = `${deviceId}|${portId}`
      if (!cur.ports[key]) return state
      const nextPorts = { ...cur.ports }
      delete nextPorts[key]
      const updated = {
        ...state.project,
        checkState: { ports: nextPorts, cables: cur.cables },
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  clearCableCheck: (cableId) =>
    set((state) => {
      const cur = state.project.checkState
      if (!cur) return state
      if (!cur.cables[cableId]) return state
      const nextCables = { ...cur.cables }
      delete nextCables[cableId]
      const updated = {
        ...state.project,
        checkState: { ports: cur.ports, cables: nextCables },
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  clearAllMobileChecks: () =>
    set((state) => {
      const cur = state.project.checkState
      if (!cur) return state
      if (
        Object.keys(cur.ports).length === 0 &&
        Object.keys(cur.cables).length === 0
      ) {
        return state
      }
      const updated = {
        ...state.project,
        checkState: { ports: {}, cables: {} },
      }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  addCableFromMobile: (input) =>
    set((state) => {
      // #295 — Auch der Mobile-Pfad darf bei finalized/viewer-Mode keine
      // Kabel mehr einspielen. Der Mobile-Viewer sollte das eigentlich
      // bereits clientseitig unterbinden (read-only beim finalized Plan),
      // aber wir validieren server-side als Defense-in-Depth.
      if (isProjectLocked(state)) return {}
      // v7.9.54 — Kabel-Add vom Mobile-Viewer. Validiert dass beide
      // Endpoints (Equipment+Port-Pair) im aktuellen Projekt existieren;
      // sonst silently skip (Mobile zeigt eh nur das was im Projekt war).
      const fromEq = state.project.equipment.find((e) => e.id === input.fromEquipmentId)
      const toEq = state.project.equipment.find((e) => e.id === input.toEquipmentId)
      if (!fromEq || !toEq) return {}
      const fromPort =
        [...fromEq.inputs, ...fromEq.outputs].find((p) => p.id === input.fromPortId) ?? null
      const toPort =
        [...toEq.inputs, ...toEq.outputs].find((p) => p.id === input.toPortId) ?? null
      if (!fromPort || !toPort) return {}
      // Doppelte verhindern: gleiche Port-Combo schon mal verbunden? skip.
      const dupe = state.project.cables.some(
        (c) =>
          (c.fromPortId === input.fromPortId && c.toPortId === input.toPortId) ||
          (c.fromPortId === input.toPortId && c.toPortId === input.fromPortId),
      )
      if (dupe) return {}
      // v7.9.88 / #210 — Cable-Type-String → cableSpecId Lookup. Vorher
      // wurde nur `type` als Connector-String gesetzt; cableSpecId blieb
      // undefined → das Properties-Panel in der Hauptapp zeigte das
      // Kabel als "Custom" weil es keinen Spec-Eintrag gefunden hat.
      // Jetzt suchen wir im cableCatalog (+ uiStore.customCableSpecs)
      // einen Spec, dessen Name oder connectorType zum Input passt, und
      // setzen ihn. Plus Layer-Auto-Detect aus dem Connector-Typ.
      let resolvedSpecId: string | undefined
      let resolvedColor = input.color
      const typeStr = (input.type ?? '').trim()
      if (typeStr) {
        const ui = useUiStore.getState()
        const allSpecs = [
          ...cableCatalog,
          ...(ui.customCableSpecs ?? []),
        ]
        // Exakter Name-Match first, dann Substring-Fallback auf
        // connectorType, dann gar nichts.
        const exact = allSpecs.find((s) => s.name.toLowerCase() === typeStr.toLowerCase())
        const byConnector = !exact && allSpecs.find(
          (s) => String(s.connectorType).toLowerCase() === typeStr.toLowerCase(),
        )
        const match = exact ?? byConnector
        if (match) {
          resolvedSpecId = match.id
          if (!resolvedColor) resolvedColor = match.color
        }
      }
      const autoLayer = detectLayerForConnector(typeStr as Cable['type'])
      // v7.9.125 — wenn das Mobile keinen Type liefert, leiten wir
      // ihn aus den Ports ab statt 'unbekannt' zu stempeln (nur wenn
      // der Inheritance-Toggle an ist; sonst Legacy-Fallback).
      const fallbackType: Cable['type'] = useUiStore.getState().inheritCableTypeFromPort
        ? inheritedCableType(
            {
              fromEquipmentId: input.fromEquipmentId,
              fromPortId: input.fromPortId,
              toEquipmentId: input.toEquipmentId,
              toPortId: input.toPortId,
            },
            state.project.equipment,
          ) ?? ('unbekannt' as Cable['type'])
        : ('unbekannt' as Cable['type'])
      const cable: Cable = {
        id: uuidv4(),
        name: input.name?.trim() || `${fromEq.name} → ${toEq.name}`,
        type: (input.type as Cable['type']) || fallbackType,
        length: input.length ?? 0,
        color: resolvedColor ?? '#64748b',
        fromEquipmentId: input.fromEquipmentId,
        fromPortId: input.fromPortId,
        toEquipmentId: input.toEquipmentId,
        toPortId: input.toPortId,
        notes: input.notes ?? '',
        addedFromMobile: true,
        layer: autoLayer,
        ...(resolvedSpecId ? { cableSpecId: resolvedSpecId } : {}),
      }
      const updated = touchProject({
        ...state.project,
        cables: [...state.project.cables, cable],
      })
      scheduleProjectAutosave(updated)
      return { project: updated, projectVersion: state.projectVersion + 1 }
    }),
})
