import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { GroupPreset } from '../../types/equipment'
import { persistGroupPresets } from '../groupPresetsPersist'
import type { ProjectState } from '../projectStore'

/**
 * #308 — GroupPreset-CRUD-Slice. Reine Verwaltungs-Actions auf
 * state.groupPresets: addGroupPreset (Import), saveGroupPreset
 * (aktuelle Auswahl als Preset einfangen), deleteGroupPreset,
 * renameGroupPreset, setGroupPresets, reorderGroupPresets.
 *
 * Nicht hier: placeGroupPreset / insertBlackBoxRack /
 * replaceCanvasRackWithPreset — die instanzieren Equipment+Cables auf
 * dem Canvas und brauchen `project`-Schreibzugriff inkl. touchProject
 * + scheduleProjectAutosave. Die bleiben vorerst in projectStore.ts
 * weil sie kreuzdomain mutieren.
 */
export type GroupPresetSlice = Pick<
  ProjectState,
  | 'addGroupPreset'
  | 'saveGroupPreset'
  | 'deleteGroupPreset'
  | 'renameGroupPreset'
  | 'setGroupPresets'
  | 'reorderGroupPresets'
>

export const createGroupPresetSlice: StateCreator<ProjectState, [], [], GroupPresetSlice> = (set) => ({
  addGroupPreset: (preset) =>
    set((state) => {
      const next = [...state.groupPresets.filter((p) => p.id !== preset.id), preset]
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  saveGroupPreset: (name, equipmentIds) =>
    set((state) => {
      const items = state.project.equipment.filter((e) => equipmentIds.includes(e.id))
      if (items.length < 2) return {}
      const minX = Math.min(...items.map((e) => e.x))
      const minY = Math.min(...items.map((e) => e.y))
      const idToIndex = new Map(items.map((e, i) => [e.id, i]))
      // Auf idToIndex filtern (nicht auf die rohen equipmentIds): idToIndex
      // enthält nur Geräte die tatsächlich in state.project.equipment
      // existieren. Sonst könnte ein Kabel auf eine Phantom-ID zeigen, die
      // zwar in equipmentIds steht aber kein Gerät hat → idToIndex.get(...)!
      // wäre undefined → items[undefined].outputs crasht die Aktion.
      const internalCables = state.project.cables.filter(
        (c) => idToIndex.has(c.fromEquipmentId) && idToIndex.has(c.toEquipmentId),
      )
      const cableStubs = internalCables.map((c) => {
        const fromIdx = idToIndex.get(c.fromEquipmentId)!
        const toIdx = idToIndex.get(c.toEquipmentId)!
        const fromItem = items[fromIdx]
        const toItem = items[toIdx]
        const fromPort = [...fromItem.outputs, ...fromItem.inputs].find((p) => p.id === c.fromPortId)
        const toPort = [...toItem.inputs, ...toItem.outputs].find((p) => p.id === c.toPortId)
        return {
          fromItemIndex: fromIdx,
          fromPortName: fromPort?.name ?? '',
          toItemIndex: toIdx,
          toPortName: toPort?.name ?? '',
          name: c.name,
          type: c.type,
          length: c.length,
          color: c.color,
          standard: c.standard,
        }
      })
      const preset: GroupPreset = {
        id: uuidv4(),
        name,
        items: items.map((e) => ({
          name: e.name,
          category: e.category,
          inputs: e.inputs,
          outputs: e.outputs,
          width: e.width,
          height: e.height,
          notes: e.notes,
          ipAddress: e.ipAddress,
          resolution: e.resolution,
          displaySizeInch: e.displaySizeInch,
          offsetX: e.x - minX,
          offsetY: e.y - minY,
        })),
        cables: cableStubs,
      }
      const next = [...state.groupPresets, preset]
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  deleteGroupPreset: (id) =>
    set((state) => {
      const next = state.groupPresets.filter((p) => p.id !== id)
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  renameGroupPreset: (id, newName) =>
    set((state) => {
      const trimmed = newName.trim()
      if (!trimmed) return state
      const next = state.groupPresets.map((p) =>
        p.id === id ? { ...p, name: trimmed } : p,
      )
      persistGroupPresets(next)
      return { groupPresets: next }
    }),
  setGroupPresets: (presets) =>
    set(() => {
      persistGroupPresets(presets)
      return { groupPresets: presets }
    }),
  /** v7.9.6 — Reorder groupPresets. Accepts the desired ID order;
   *  anything not in the list is appended at the end so partial
   *  reorders (e.g. only racks, only non-racks) don't lose entries. */
  reorderGroupPresets: (newOrder) =>
    set((state) => {
      const idToPreset = new Map(state.groupPresets.map((p) => [p.id, p]))
      const ordered: GroupPreset[] = []
      const seen = new Set<string>()
      for (const id of newOrder) {
        const p = idToPreset.get(id)
        if (p && !seen.has(id)) {
          ordered.push(p)
          seen.add(id)
        }
      }
      for (const p of state.groupPresets) {
        if (!seen.has(p.id)) ordered.push(p)
      }
      persistGroupPresets(ordered)
      return { groupPresets: ordered }
    }),
})
