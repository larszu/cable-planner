import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { LocationFrame } from '../../types/location'
import { EQUIPMENT_LAYOUT } from '../../lib/layoutConstants'
import { isProjectLocked, touchProject } from '../projectStoreHelpers'
import type { ProjectState } from '../projectStore'

/**
 * #308 — Location-Slice. Verwaltet das Anlegen, Verschieben, Aendern und
 * Löschen von Location-Frames (Bühnen-/Raum-Markierungen auf dem Canvas).
 *
 * Eigenständige Slice weil:
 *  - klar abgegrenzte Domain (alle 6 Actions arbeiten primaer auf
 *    `state.project.locations`)
 *  - keine ueberlappenden Schreib-Pfade mit anderen Slices
 *  - klein genug fuer einen ueberschaubaren Migration-Schritt
 */
export type LocationSlice = Pick<
  ProjectState,
  | 'addLocation'
  | 'addLocationAroundEquipment'
  | 'updateLocation'
  | 'deleteLocation'
  | 'deleteLocationWithContents'
  | 'moveLocationWithContents'
>

export const createLocationSlice: StateCreator<ProjectState, [], [], LocationSlice> = (set) => ({
  addLocation: (partial) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const loc: LocationFrame = {
        id: uuidv4(),
        name: partial?.name ?? 'Location',
        x: partial?.x ?? 100,
        y: partial?.y ?? 100,
        width: partial?.width ?? 360,
        height: partial?.height ?? 240,
        color: partial?.color ?? '#38bdf8',
        // v7.9.81 / #194 — Default ist jetzt 'Inhalt mitbewegen' = true.
        // Erwartung: wenn ich eine Location verschiebe, geht der Inhalt
        // mit (Equipment, Cable-Waypoints). User kann das pro Location
        // in den Properties wieder ausschalten falls gewünscht. Resize
        // ist davon unberührt — der zieht nur den Rahmen.
        moveContents: partial?.moveContents ?? true,
      }
      return {
        project: touchProject({
          ...state.project,
          locations: [...(state.project.locations ?? []), loc],
        }),
        selectedLocationId: loc.id,
      }
    }),
  addLocationAroundEquipment: (equipmentIds, partial) =>
    set((state) => {
      const ids = new Set(equipmentIds)
      const items = state.project.equipment.filter((e) => ids.has(e.id))
      if (items.length === 0) return {}
      const PAD = 40
      const TITLE_PAD = 24
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const e of items) {
        const w = e.width ?? EQUIPMENT_LAYOUT.DEFAULT_WIDTH
        const h = e.height ?? 140
        if (e.x < minX) minX = e.x
        if (e.y < minY) minY = e.y
        if (e.x + w > maxX) maxX = e.x + w
        if (e.y + h > maxY) maxY = e.y + h
      }
      const loc: LocationFrame = {
        id: uuidv4(),
        name: partial?.name ?? 'Neue Location',
        x: minX - PAD,
        y: minY - TITLE_PAD - PAD,
        width: maxX - minX + PAD * 2,
        height: maxY - minY + TITLE_PAD + PAD * 2,
        color: partial?.color ?? '#38bdf8',
        ...(partial?.width ? { width: partial.width } : {}),
        ...(partial?.height ? { height: partial.height } : {}),
        // v7.9.81 / #194 — Default Move-Contents = true (siehe addLocation).
        moveContents: partial?.moveContents ?? true,
      }
      return {
        project: touchProject({
          ...state.project,
          locations: [...(state.project.locations ?? []), loc],
        }),
        selectedLocationId: loc.id,
      }
    }),
  updateLocation: (id, patch) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return {
        project: touchProject({
          ...state.project,
          locations: (state.project.locations ?? []).map((l) =>
            l.id === id ? { ...l, ...patch } : l,
          ),
        }),
      }
    }),
  deleteLocation: (id) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      return {
        project: touchProject({
          ...state.project,
          locations: (state.project.locations ?? []).filter((l) => l.id !== id),
        }),
        selectedLocationId:
          state.selectedLocationId === id ? undefined : state.selectedLocationId,
      }
    }),
  deleteLocationWithContents: (id) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const loc = (state.project.locations ?? []).find((l) => l.id === id)
      if (!loc) return {}
      const containedIds = new Set(
        state.project.equipment
          .filter((e) => {
            const cx = e.x + (e.width ?? 0) / 2
            const cy = e.y + (e.height ?? 0) / 2
            return (
              cx >= loc.x &&
              cx <= loc.x + loc.width &&
              cy >= loc.y &&
              cy <= loc.y + loc.height
            )
          })
          .map((e) => e.id),
      )
      return {
        project: touchProject({
          ...state.project,
          locations: (state.project.locations ?? []).filter((l) => l.id !== id),
          equipment: state.project.equipment.filter((e) => !containedIds.has(e.id)),
          cables: state.project.cables.filter(
            (c) =>
              !containedIds.has(c.fromEquipmentId) && !containedIds.has(c.toEquipmentId),
          ),
        }),
        selectedLocationId:
          state.selectedLocationId === id ? undefined : state.selectedLocationId,
      }
    }),
  moveLocationWithContents: (id, dx, dy, containedEquipmentIds) =>
    set((state) => {
      if (!dx && !dy) return {}
      const containedSet = new Set(containedEquipmentIds)
      // Shift waypoints of any cable where at least one endpoint is a contained
      // equipment item - keeps the cable aligned with the moved device.
      const nextCables = state.project.cables.map((c) => {
        if (!c.waypoints || c.waypoints.length === 0) return c
        if (!containedSet.has(c.fromEquipmentId) && !containedSet.has(c.toEquipmentId)) {
          return c
        }
        return {
          ...c,
          waypoints: c.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy })),
        }
      })
      return {
        project: touchProject({
          ...state.project,
          locations: (state.project.locations ?? []).map((l) =>
            l.id === id ? { ...l, x: l.x + dx, y: l.y + dy } : l,
          ),
          equipment: state.project.equipment.map((e) =>
            containedSet.has(e.id) ? { ...e, x: e.x + dx, y: e.y + dy } : e,
          ),
          cables: nextCables,
        }),
      }
    }),
})
