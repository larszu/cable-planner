import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { Cable } from '../../types/cable'
import type { EquipmentItem, Port } from '../../types/equipment'
import { useUiStore } from '../uiStore'
import { cableTypePatchFromPorts } from '../../lib/cableInheritance'
import { stampGroupLibraryRef } from '../../lib/librarySync'
import { isProjectLocked, touchProject } from '../projectStoreHelpers'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'

/**
 * #308 — GroupPreset-Spawner-Slice. Drei Actions die Equipment +
 * Kabel aus Presets auf den Canvas instanzieren:
 *
 *  - placeGroupPreset: klassisches Drop einer Group/Rack-Vorlage.
 *    Erzeugt N Geraete + interne Kabel; bei `preset.rack` werden
 *    rackInstanceId + Placement-Metadaten gestempelt damit der
 *    Rack-Editor das Sub-Canvas darauf filtern kann (#61).
 *
 *  - insertBlackBoxRack: gleiches Preset als einzelnes "Black-Box"-
 *    Equipment mit aussen liegenden Ports + rackInternalSnapshot
 *    fuer den Rack-Editor (v7.9.17 — interne Ports werden auch
 *    exponiert aber `rackInternallyConnected=true` markiert).
 *
 *  - replaceCanvasRackWithPreset: Rack-Editor schreibt Aenderungen
 *    zurueck. Identische Port-Synthese wie insertBlackBoxRack, aber
 *    existierende Port-IDs werden via (rackOriginDeviceIndex,
 *    rackOriginPortName) wiederverwendet damit externe Kabel ihre
 *    Verbindungen behalten (Issue #224).
 *
 * Alle 3 gehen durch touchProject + scheduleProjectAutosave. Lock-
 * Guards bei insertBlackBoxRack/replaceCanvasRackWithPreset
 * (placeGroupPreset ist im Lock-Mode bereits durch das UI gesperrt
 * — Library-Drag landet nicht auf dem read-only Canvas).
 */

const portsFromPreset = (
  presetItems: { name: string; inputs: Port[]; outputs: Port[] }[],
  usedPortNames: Set<string>,
  portIdLookup?: Map<string, string>,
): { externalIns: Port[]; externalOuts: Port[] } => {
  const externalIns: Port[] = []
  const externalOuts: Port[] = []
  presetItems.forEach((item, idx) => {
    for (const p of item.inputs) {
      const isInternal = usedPortNames.has(`${idx}:${p.name}`)
      const reusedId = portIdLookup?.get(`in:${idx}:${p.name}`)
      externalIns.push({
        ...p,
        id: reusedId ?? uuidv4(),
        name: `${item.name} · ${p.name}`,
        rackOriginDeviceIndex: idx,
        rackOriginDeviceName: item.name,
        rackOriginPortName: p.name,
        rackInternallyConnected: isInternal,
      })
    }
    for (const p of item.outputs) {
      const isInternal = usedPortNames.has(`${idx}:${p.name}`)
      const reusedId = portIdLookup?.get(`out:${idx}:${p.name}`)
      externalOuts.push({
        ...p,
        id: reusedId ?? uuidv4(),
        name: `${item.name} · ${p.name}`,
        rackOriginDeviceIndex: idx,
        rackOriginDeviceName: item.name,
        rackOriginPortName: p.name,
        rackInternallyConnected: isInternal,
      })
    }
  })
  return { externalIns, externalOuts }
}

const buildRackInternalSnapshot = (preset: import('../../types/equipment').GroupPreset) => {
  const totalUnits =
    preset.rack?.totalUnits ??
    preset.items.reduce((sum, item) => sum + (item.rackUnits ?? 1), 0)
  return {
    items: preset.items.map((item, idx) => ({
      name: item.name,
      startUnit:
        preset.rack?.placements?.find((pl) => pl.itemIndex === idx)?.startUnit ??
        idx + 1,
      rackUnits:
        preset.rack?.placements?.find((pl) => pl.itemIndex === idx)?.heightUnits ??
        item.rackUnits ??
        1,
      // #335 — Rentman-ID des Inhalts mitschnappen (für späteren Sync/Export).
      ...(item.rentmanId ? { rentmanId: item.rentmanId } : {}),
    })),
    cables: preset.cables.map((c) => ({
      fromItemIndex: c.fromItemIndex,
      fromPortName: c.fromPortName,
      toItemIndex: c.toItemIndex,
      toPortName: c.toPortName,
      color: c.color,
    })),
    totalUnits,
  }
}

export type GroupPresetSpawnSlice = Pick<
  ProjectState,
  'placeGroupPreset' | 'insertBlackBoxRack' | 'replaceCanvasRackWithPreset'
>

export const createGroupPresetSpawnSlice: StateCreator<
  ProjectState,
  [],
  [],
  GroupPresetSpawnSlice
> = (set) => ({
  placeGroupPreset: (presetId, x, y) =>
    set((state) => {
      const preset = state.groupPresets.find((p) => p.id === presetId)
      if (!preset) return {}
      // Issue #61: when the preset carries `rack` metadata it represents
      // a 19" rack layout. Tag every spawned equipment item with a fresh
      // `rackInstanceId` + the preset name so the Rack-Editor can later
      // filter the canvas down to "just this rack" without us needing a
      // dedicated rack entity in the data model.
      const rackInstanceId = preset.rack ? `rack:${uuidv4()}` : undefined
      const rackInstanceLabel = preset.rack ? preset.name : undefined
      const placementByIndex = new Map<number, { startUnit: number; heightUnits: number }>()
      if (preset.rack) {
        for (const p of preset.rack.placements) {
          placementByIndex.set(p.itemIndex, { startUnit: p.startUnit, heightUnits: p.heightUnits })
        }
      }
      // v7.9.33 — Stempelt jedes platzierte Gerät mit dem aktuellen
      // Group-File-Stand damit Update-Prompt beim Projekt-Öffnen erkennt
      // wenn die Gruppe in der Library aktualisiert wurde.
      const groupRef = stampGroupLibraryRef(preset.name)
      // Create new equipment items with fresh IDs and port IDs.
      const newEquipment: EquipmentItem[] = preset.items.map((item, idx) => ({
        ...item,
        id: uuidv4(),
        x: x + item.offsetX,
        y: y + item.offsetY,
        inputs: item.inputs.map((p) => ({ ...p, id: uuidv4() })),
        outputs: item.outputs.map((p) => ({ ...p, id: uuidv4() })),
        rackInstanceId,
        rackInstanceLabel,
        rackInstanceStartUnit: placementByIndex.get(idx)?.startUnit,
        libraryRef: groupRef,
      }))
      // Build (itemIndex:portName) → new port ID lookup
      const portIdMap = new Map<string, string>()
      newEquipment.forEach((eq, idx) => {
        for (const p of [...eq.inputs, ...eq.outputs]) {
          portIdMap.set(`${idx}:${p.name}`, p.id)
        }
      })
      // Recreate cables between the newly placed items.
      const inheritType = useUiStore.getState().inheritCableTypeFromPort
      const newCables = preset.cables
        .map((stub): Cable | null => {
          const fromEqId = newEquipment[stub.fromItemIndex]?.id
          const toEqId = newEquipment[stub.toItemIndex]?.id
          const fromPortId = portIdMap.get(`${stub.fromItemIndex}:${stub.fromPortName}`)
          const toPortId = portIdMap.get(`${stub.toItemIndex}:${stub.toPortName}`)
          if (!fromEqId || !toEqId || !fromPortId || !toPortId) return null
          const cable: Cable = {
            id: uuidv4(),
            name: stub.name,
            type: stub.type as Cable['type'],
            length: stub.length,
            color: stub.color ?? '#64748b',
            fromEquipmentId: fromEqId,
            fromPortId,
            toEquipmentId: toEqId,
            toPortId,
            notes: '',
            standard: stub.standard as Cable['standard'],
          }
          // v7.9.125 — Snapshot-erzeugte Presets tragen oft type='unbekannt'
          // weil zum Snapshot-Zeitpunkt kein Typ verfuegbar war (siehe
          // LibraryPanel.tsx:786). Inheritance leitet den Typ frisch aus
          // den neuen Ports ab.
          if (inheritType) {
            const typePatch = cableTypePatchFromPorts(cable, newEquipment)
            if (typePatch) Object.assign(cable, typePatch)
          }
          return cable
        })
        .filter((c): c is Cable => c !== null)
      const updated = touchProject({
        ...state.project,
        equipment: [...state.project.equipment, ...newEquipment],
        cables: [...state.project.cables, ...newCables],
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  insertBlackBoxRack: (presetId, x, y) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const preset = state.groupPresets.find((p) => p.id === presetId)
      if (!preset) return state
      // v7.9.17 — ALLE Ports werden jetzt exponiert (vorher wurden
      // intern verkabelte Ports rausgefiltert). Internal-Ports tragen
      // rackInternallyConnected=true → EquipmentNode rendert sie
      // ausgegraut + non-connectable, damit der User sieht welche Ports
      // intern belegt sind. Die internen Kabel-Linien können dann
      // direkt zwischen den realen Port-Positionen gezeichnet werden.
      const usedPortNames = new Set<string>()
      for (const stub of preset.cables) {
        usedPortNames.add(`${stub.fromItemIndex}:${stub.fromPortName}`)
        usedPortNames.add(`${stub.toItemIndex}:${stub.toPortName}`)
      }
      const { externalIns, externalOuts } = portsFromPreset(preset.items, usedPortNames)
      const newItem: EquipmentItem = {
        id: uuidv4(),
        name: `${preset.name} (Rack)`,
        category: 'Rack',
        inputs: externalIns,
        outputs: externalOuts,
        x,
        y,
        width: 280,
        height: 0,
        icon: '🗄',
        notes: `Black-Box-Rack: ${preset.items.length} Geräte, ${preset.cables.length} interne Verbindungen.`,
        // #335 — Wenn das Rack aus einer Rentman-Kombination stammt, trägt das
        // Rack als Einheit die Kombi-ID; die Inhalte behalten ihre eigenen IDs
        // im Snapshot.
        ...(preset.rack?.rentmanId ? { rentmanId: preset.rack.rentmanId } : {}),
        rackInternalSnapshot: buildRackInternalSnapshot(preset),
      }
      const updated = touchProject({
        ...state.project,
        equipment: [...state.project.equipment, newItem],
      })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
  // v7.9.105 / Issue #224 — Toolbar 'Rack bearbeiten' soll das im Canvas
  // selektierte Rack bearbeiten, nicht die Library-Preset. Diese Action
  // wendet die im RackBuilder editierten Aenderungen auf das konkrete
  // Equipment im Canvas an — Library bleibt unangetastet.
  replaceCanvasRackWithPreset: (equipmentId, preset) =>
    set((state) => {
      if (isProjectLocked(state)) return state
      const target = state.project.equipment.find((e) => e.id === equipmentId)
      if (!target) return state
      // Identische Logic wie insertBlackBoxRack — Ports synthesieren aus
      // dem Preset, dann aber Port-IDs aus dem existing Equipment uebernehmen
      // wo (rackOriginDeviceIndex, rackOriginPortName) matcht, damit externe
      // Kabel ihre Verbindungen behalten.
      const portIdLookup = new Map<string, string>()
      for (const p of target.inputs) {
        if (typeof p.rackOriginDeviceIndex === 'number' && p.rackOriginPortName) {
          portIdLookup.set(`in:${p.rackOriginDeviceIndex}:${p.rackOriginPortName}`, p.id)
        }
      }
      for (const p of target.outputs) {
        if (typeof p.rackOriginDeviceIndex === 'number' && p.rackOriginPortName) {
          portIdLookup.set(`out:${p.rackOriginDeviceIndex}:${p.rackOriginPortName}`, p.id)
        }
      }
      const usedPortNames = new Set<string>()
      for (const stub of preset.cables) {
        usedPortNames.add(`${stub.fromItemIndex}:${stub.fromPortName}`)
        usedPortNames.add(`${stub.toItemIndex}:${stub.toPortName}`)
      }
      const { externalIns, externalOuts } = portsFromPreset(preset.items, usedPortNames, portIdLookup)
      const updatedEquipment = state.project.equipment.map((e) =>
        e.id === equipmentId
          ? {
              ...e,
              inputs: externalIns,
              outputs: externalOuts,
              rackInternalSnapshot: buildRackInternalSnapshot(preset),
              notes: `Black-Box-Rack: ${preset.items.length} Geräte, ${preset.cables.length} interne Verbindungen.`,
            }
          : e,
      )
      const updated = touchProject({ ...state.project, equipment: updatedEquipment })
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),
})
