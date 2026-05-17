// v7.9.9 — RackInternalCanvas: ersetzt das frühere 1194-Zeilen
// RackInternalWireDialog. Reuse der echten <CanvasArea /> aus dem
// Hauptcanvas; die Verkabelungs-Bearbeitung läuft gegen einen
// Scratch-ProjectStore, der über den ProjectStoreContext durchgereicht
// wird. Damit erbt das Rack-Canvas automatisch:
//
//  - Vollständige ReactFlow-Implementierung (Drag, Snap, Routing,
//    Waypoints, A*-Routing)
//  - EquipmentNode mit Ports, Click-to-Connect, Plugged-Status
//  - Cable-Edges mit Length-Color, Brücken, Pfeilen
//  - Cable-Right-Click-Context-Menü (gerendert hier innerhalb des
//    Scope, damit es gegen den Scratch-Store läuft)
//  - Waypoint-Bearbeitung, Segment-Drag
//
// Was abweicht:
//  - Cable-Erstellung: queueConnection wird gepatcht und legt das
//    Kabel mit Defaults direkt an, statt den CableDialog zu öffnen.
//    Dauerhaftes Editieren passiert dann per Rechtsklick → Bearbeiten.
//  - CanvasToolbar + AnnotationCanvasOverlay sind ausgeblendet (mode='rack').
//  - Lock-Banner ausgeblendet (kein projectMode im Rack).

import { useEffect, useMemo, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { CanvasArea } from '../Canvas/CanvasArea'
import { CableContextMenu } from '../Canvas/CableContextMenu'
import { ProjectStoreProvider } from '../../store/projectStoreContext'
import { createProjectStoreInstance } from '../../store/projectStore'
import type {
  EquipmentItem,
  EquipmentTemplate,
  GroupPreset,
} from '../../types/equipment'
import type { Cable, CableType } from '../../types/cable'
import type { CablePlannerProject } from '../../types/project'
import type { SignalStandard } from '../../types/cableSpec'

export interface RackPlacementForCanvas {
  id: string
  name: string
  category: string
  startUnit: number
  rackUnits: number
  inputs: EquipmentTemplate['inputs']
  outputs: EquipmentTemplate['outputs']
  isRackDevice: boolean
}

export interface RackInternalCanvasProps {
  rackName: string
  placements: RackPlacementForCanvas[]
  initialCables: GroupPreset['cables']
  /** Wird bei jeder Cable-Mutation aufgerufen (live), damit das Parent-
   *  Dialog den Draft mitführen und beim Speichern den letzten Stand
   *  übernehmen kann. */
  onCablesChanged: (cables: GroupPreset['cables']) => void
  /** Optional: wenn ein Gerät im Canvas umbenannt wird (z.B. via
   *  EquipmentProperties), propagieren wir das in den Builder-Draft. */
  onPlacementRenamed?: (id: string, newName: string) => void
}

const NODE_WIDTH = 280
// Pixel pro HE im Rack-Canvas. 38 px sind groß genug damit ein
// Port-Row je HE problemlos lesbar ist; Höhe wird per Geräte-Layout
// von EquipmentNode selbst berechnet, dies ist nur der Stack-Abstand.
const HE_TO_PX = 38
const X_OFFSET = 100
const Y_OFFSET = 80

/** Map placements → EquipmentItem[]. Y-Position wird aus startUnit
 *  abgeleitet, damit das Layout sofort die richtige Reihenfolge zeigt. */
const buildScratchEquipment = (
  placements: RackPlacementForCanvas[],
): EquipmentItem[] =>
  placements.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    inputs: p.inputs,
    outputs: p.outputs,
    x: X_OFFSET,
    y: Y_OFFSET + (p.startUnit - 1) * HE_TO_PX,
    width: NODE_WIDTH,
    height: 0,
    isRackDevice: p.isRackDevice,
    rackUnits: p.rackUnits,
  }))

/** Map GroupPreset.cables → Cable[]. Port-Refs werden von Index+Name
 *  auf id+portId aufgelöst. */
const buildScratchCables = (
  equipment: EquipmentItem[],
  groupPresetCables: GroupPreset['cables'],
): Cable[] => {
  const portIdByName = new Map<string, Map<string, string>>()
  for (const eq of equipment) {
    const m = new Map<string, string>()
    for (const p of [...eq.inputs, ...eq.outputs]) m.set(p.name, p.id)
    portIdByName.set(eq.id, m)
  }
  const result: Cable[] = []
  for (const c of groupPresetCables) {
    const fromEq = equipment[c.fromItemIndex]
    const toEq = equipment[c.toItemIndex]
    if (!fromEq || !toEq) continue
    const fromPortId = portIdByName.get(fromEq.id)?.get(c.fromPortName)
    const toPortId = portIdByName.get(toEq.id)?.get(c.toPortName)
    if (!fromPortId || !toPortId) continue
    result.push({
      id: uuidv4(),
      name: c.name,
      type: c.type as CableType,
      length: c.length,
      color: c.color ?? '#64748b',
      fromEquipmentId: fromEq.id,
      fromPortId,
      toEquipmentId: toEq.id,
      toPortId,
      notes: '',
      standard: c.standard as SignalStandard | undefined,
      arrowEnd: true,
      strokeWidth: 2.5,
    })
  }
  return result
}

const buildScratchProject = (
  rackName: string,
  placements: RackPlacementForCanvas[],
  cables: GroupPreset['cables'],
): CablePlannerProject => {
  const equipment = buildScratchEquipment(placements)
  return {
    metadata: {
      name: `Rack: ${rackName}`,
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      defaultVideoFormat: '1080p50',
    },
    equipment,
    cables: buildScratchCables(equipment, cables),
    locations: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }
}

/** Map scratch Cable[] zurück in GroupPreset.cables Format (Index+Name). */
const extractGroupPresetCables = (
  project: CablePlannerProject,
): GroupPreset['cables'] => {
  const equipmentIndexById = new Map(project.equipment.map((e, i) => [e.id, i]))
  const portNameByIdPerEq = new Map<string, Map<string, string>>()
  for (const eq of project.equipment) {
    const m = new Map<string, string>()
    for (const p of [...eq.inputs, ...eq.outputs]) m.set(p.id, p.name)
    portNameByIdPerEq.set(eq.id, m)
  }
  const out: GroupPreset['cables'] = []
  for (const c of project.cables) {
    const fromIdx = equipmentIndexById.get(c.fromEquipmentId)
    const toIdx = equipmentIndexById.get(c.toEquipmentId)
    if (fromIdx === undefined || toIdx === undefined) continue
    const fromPortName = portNameByIdPerEq.get(c.fromEquipmentId)?.get(c.fromPortId)
    const toPortName = portNameByIdPerEq.get(c.toEquipmentId)?.get(c.toPortId)
    if (!fromPortName || !toPortName) continue
    out.push({
      fromItemIndex: fromIdx,
      fromPortName,
      toItemIndex: toIdx,
      toPortName,
      name: c.name,
      type: c.type,
      length: c.length,
      color: c.color,
      standard: c.standard,
    })
  }
  return out
}

export const RackInternalCanvas = ({
  rackName,
  placements,
  initialCables,
  onCablesChanged,
  onPlacementRenamed,
}: RackInternalCanvasProps) => {
  // Scratch store nur einmal pro Mount initialisieren. Spätere
  // Placement-Updates aus dem Parent-Builder werden über einen
  // dedizierten Sync-useEffect propagiert (nicht über Re-Init weil
  // das die offene Verkabelung verlieren würde).
  const scratchStore = useMemo(
    () => createProjectStoreInstance(buildScratchProject(rackName, placements, initialCables)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Live propagation: scratch → parent draft. Verwendet die scratch-
  // store-eigene subscribe (nicht die globale).
  const lastEmittedCablesRef = useRef<string>('')
  useEffect(() => {
    const unsub = scratchStore.subscribe((state, prev) => {
      if (state.project === prev.project) return
      const next = extractGroupPresetCables(state.project)
      // Cheap dirty-check via JSON, vermeidet ping-pong wenn der Parent
      // wieder denselben Inhalt setzt.
      const key = JSON.stringify(next)
      if (key !== lastEmittedCablesRef.current) {
        lastEmittedCablesRef.current = key
        onCablesChanged(next)
      }
      if (onPlacementRenamed) {
        for (const eq of state.project.equipment) {
          const prevEq = prev.project.equipment.find((e) => e.id === eq.id)
          if (prevEq && prevEq.name !== eq.name) {
            onPlacementRenamed(eq.id, eq.name)
          }
        }
      }
    })
    return unsub
  }, [scratchStore, onCablesChanged, onPlacementRenamed])

  // Cable-Erstellung: statt den CableDialog zu öffnen, direkt mit
  // sinnvollen Defaults anlegen. Connector-Type wird aus den
  // beteiligten Ports inferiert.
  useEffect(() => {
    const originalQueue = scratchStore.getState().queueConnection
    scratchStore.setState({
      queueConnection: (connection, waypoints) => {
        if (!connection?.source || !connection?.target) return
        if (!connection.sourceHandle || !connection.targetHandle) return
        const state = scratchStore.getState()
        const fromEq = state.project.equipment.find((e) => e.id === connection.source)
        const toEq = state.project.equipment.find((e) => e.id === connection.target)
        const fromPort = fromEq
          ? [...fromEq.inputs, ...fromEq.outputs].find((p) => p.id === connection.sourceHandle)
          : undefined
        const toPort = toEq
          ? [...toEq.inputs, ...toEq.outputs].find((p) => p.id === connection.targetHandle)
          : undefined
        const connectorType = (fromPort?.connectorType ??
          toPort?.connectorType ??
          'Custom') as CableType
        // Pending in store legen, direkt commit, kein Dialog.
        scratchStore.setState({
          pendingConnection: connection,
          pendingWaypoints: waypoints && waypoints.length > 0 ? waypoints : undefined,
          showCableDialog: false,
        })
        scratchStore.getState().createCableFromPending({
          name: connectorType,
          type: connectorType,
          length: 0.5,
          color: '#64748b',
          notes: '',
        })
      },
    })
    return () => {
      scratchStore.setState({ queueConnection: originalQueue })
    }
  }, [scratchStore])

  // Placement-Sync vom Parent (z.B. der User benennt eine Karte im
  // Properties-Panel um, oder ändert die HE-Position). Wir patchen
  // nur die geänderten Felder in die scratch-equipment, OHNE die
  // bestehenden Kabel-IDs anzufassen.
  useEffect(() => {
    const current = scratchStore.getState().project.equipment
    const nextById = new Map(placements.map((p) => [p.id, p]))
    const patched: EquipmentItem[] = current.map((eq) => {
      const incoming = nextById.get(eq.id)
      if (!incoming) return eq
      return {
        ...eq,
        name: incoming.name,
        category: incoming.category,
        y: Y_OFFSET + (incoming.startUnit - 1) * HE_TO_PX,
        rackUnits: incoming.rackUnits,
        isRackDevice: incoming.isRackDevice,
        // Ports nicht überschreiben — der User darf sie hier im
        // Canvas via EquipmentProperties editieren ohne dass der
        // Builder das überschreibt.
      }
    })
    // Add new placements (vom Parent neu hinzugefügte Geräte)
    for (const p of placements) {
      if (!current.find((eq) => eq.id === p.id)) {
        patched.push(buildScratchEquipment([p])[0])
      }
    }
    // Remove deleted placements (parent hat sie entfernt)
    const allowedIds = new Set(placements.map((p) => p.id))
    const filtered = patched.filter((eq) => allowedIds.has(eq.id))
    // Auch verwaiste Kabel rauswerfen
    const filteredEqIds = new Set(filtered.map((e) => e.id))
    const filteredCables = scratchStore
      .getState()
      .project.cables.filter(
        (c) => filteredEqIds.has(c.fromEquipmentId) && filteredEqIds.has(c.toEquipmentId),
      )
    scratchStore.setState((state) => ({
      project: {
        ...state.project,
        equipment: filtered,
        cables: filteredCables,
      },
    }))
  }, [placements, scratchStore])

  return (
    <ProjectStoreProvider store={scratchStore}>
      <div style={{ width: '100%', height: '100%', position: 'relative', minHeight: 320 }}>
        <CanvasArea mode="rack" />
        {/* CableContextMenu muss innerhalb des Providers gerendert
            sein, damit seine Mutationen den Scratch-Store treffen. */}
        <CableContextMenu />
      </div>
    </ProjectStoreProvider>
  )
}
