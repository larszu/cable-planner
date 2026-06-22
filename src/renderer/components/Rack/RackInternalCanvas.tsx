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
import { CableProperties } from '../Properties/CableProperties'
import { EquipmentProperties } from '../Properties/EquipmentProperties'
import { useCanvasProjectStore } from '../../store/projectStoreContext'
import { format, useTranslation } from '../../lib/i18n'
import { ProjectStoreProvider } from '../../store/ProjectStoreProvider'
import { createProjectStoreInstance } from '../../store/projectStore'
import { routeCable } from '../../lib/canvasViewport'
import { computeEquipmentLayout } from '../../lib/equipmentLayout'
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
  /** v7.9.14 — Falls der User die Position im RackInternalCanvas
   *  bereits manuell gesetzt hat, wird sie hier durchgereicht und
   *  ersetzt die Default-Berechnung aus startUnit. */
  canvasX?: number
  canvasY?: number
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
  /** v7.9.14 — Live-Sync der Canvas-Positionen zurück in den Builder-
   *  Draft. Wird bei jeder x/y-Änderung eines Geräts gefeuert, damit
   *  der Draft die User-gesetzten Positionen persistiert. */
  onPlacementMoved?: (id: string, x: number, y: number) => void
}

const NODE_WIDTH = 280
// Pixel pro HE im Rack-Canvas. 38 px sind groß genug damit ein
// Port-Row je HE problemlos lesbar ist; Höhe wird per Geräte-Layout
// von EquipmentNode selbst berechnet, dies ist nur der Stack-Abstand.
const HE_TO_PX = 38
const X_OFFSET = 100
const Y_OFFSET = 80

/** Map placements → EquipmentItem[]. Y-Position wird aus startUnit
 *  abgeleitet, damit das Layout sofort die richtige Reihenfolge zeigt.
 *
 *  v7.9.12 — Port-IDs werden hier zwingend mit UUIDs versorgt. Die
 *  Catalog-Templates (Blackmagic, Misc, Camera, …) emittieren Ports
 *  mit `id: ''` und verlassen sich darauf dass `addEquipment` im
 *  projectStore sie sanitisiert. Da RackInternalCanvas die Templates
 *  aber direkt in den Scratch-Store überträgt (ohne addEquipment),
 *  blieben die IDs leer — Folge: ReactFlow/ React benutzten die
 *  Port-IDs als Keys → identische Keys ('') → nur EIN Port wurde
 *  gerendert, der Rest "gestapelt". Templates mit bereits gefüllten
 *  IDs (z.B. Rentman-Imports) waren nicht betroffen, daher zeigte
 *  Videohub korrekt aber X32 nicht. */
const sanitizePorts = <T extends { id: string }>(ports: T[]): T[] => {
  const seen = new Set<string>()
  return ports.map((p) => {
    let id = p.id
    if (!id || seen.has(id)) {
      // crypto.randomUUID wird breit unterstützt (Electron + alle
      // modernen Browser). Fallback auf Math.random für Test-Envs.
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `port-${Math.random().toString(36).slice(2, 11)}`
    }
    seen.add(id)
    return { ...p, id }
  })
}

const buildScratchEquipment = (
  placements: RackPlacementForCanvas[],
): EquipmentItem[] =>
  placements.map((p) => {
    const eq: EquipmentItem = {
      id: p.id,
      name: p.name,
      category: p.category,
      inputs: sanitizePorts(p.inputs),
      outputs: sanitizePorts(p.outputs),
      // v7.9.14 — User-gespeicherte Position bevorzugt, sonst Default
      // aus startUnit (vertikaler Stack im Rack-internen Canvas).
      x: p.canvasX ?? X_OFFSET,
      y: p.canvasY ?? Y_OFFSET + (p.startUnit - 1) * HE_TO_PX,
      width: NODE_WIDTH,
      height: 0,
      isRackDevice: p.isRackDevice,
      rackUnits: p.rackUnits,
    }
    // #528 / #206 — Initiale Node-Dimensionen EXAKT so berechnen wie der
    // spätere ReactFlow-Measure: über computeEquipmentLayout, dieselbe Quelle
    // aus der auch EquipmentNode rendert. Vorher stand hier eine grobe
    // HEADER/ROW/PADDING-Schätzung, die vom gemessenen Wert abwich — beim
    // ersten Measure (onNodesChange dimensions) sprangen Node- und damit
    // Handle-Positionen dann einen Frame weit. Das war der "Display-Bug beim
    // ersten Kabel" während des Verkabelns: die in-progress-Connection-Line
    // (und die frisch gemessenen Handles) verschoben sich kurz, ehe sich der
    // Wert stabilisierte. Mit exakter Vorab-Größe ist estimate == measured →
    // der onNodesChange-Diff bleibt unter der 2px-Schwelle, kein Sprung. Hält
    // auch den hasOverlap-Check (#206) von Anfang an stabil.
    const layout = computeEquipmentLayout(eq)
    eq.width = layout.width
    eq.height = layout.height
    return eq
  })

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
      // v7.9.115 / Issue #223 — Waypoints aus dem Preset wieder
      // herstellen, damit Kabel-Positionen ueber Save/Reload erhalten
      // bleiben. Wenn der Preset noch keine Waypoints traegt (alte
      // Daten), bleibt das Feld undefined und A* / Auto-Routing
      // generiert frische.
      ...(c.waypoints && c.waypoints.length > 0 ? { waypoints: c.waypoints } : {}),
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
      // v7.9.115 / Issue #223 — Waypoints in den Preset zurueck
      // schreiben damit User-Position nach Save/Reload erhalten bleibt.
      ...(c.waypoints && c.waypoints.length > 0
        ? { waypoints: c.waypoints.map((wp) => ({ x: wp.x, y: wp.y })) }
        : {}),
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
  onPlacementMoved,
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
  // #515 — Letzter bekannter HE-Stand je Placement, damit der Placement-Sync
  // eine echte HE-Änderung (Properties) von einem bloßen Re-Render (z.B. nach
  // dem Verkabeln) unterscheiden kann.
  const prevStartUnit = useRef<Map<string, number>>(new Map())
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
      for (const eq of state.project.equipment) {
        const prevEq = prev.project.equipment.find((e) => e.id === eq.id)
        if (!prevEq) continue
        if (onPlacementRenamed && prevEq.name !== eq.name) {
          onPlacementRenamed(eq.id, eq.name)
        }
        // v7.9.14 — Position-Sync. Bei Drag im Canvas-Mode landen die
        // neuen x/y im scratch-equipment. Wir propagieren sie zurück
        // in den Builder-Draft, damit sie beim Speichern in der
        // GroupPreset.rack.internalCanvasPositions landen.
        if (onPlacementMoved && (prevEq.x !== eq.x || prevEq.y !== eq.y)) {
          onPlacementMoved(eq.id, eq.x, eq.y)
        }
      }
    })
    return unsub
  }, [scratchStore, onCablesChanged, onPlacementRenamed, onPlacementMoved])

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
        // v7.9.118 / Issue #223 — Auto-Route via A* fuer neu angelegtes
        // Kabel. Im Rack-Mode hat ReactFlow's Standard-L-Routing dazu
        // gefuehrt dass mehrere Kabel sich ueberlappen / durcheinander
        // laufen. A* mit padding=0 (siehe CanvasArea-Branch fuer
        // mode='rack') findet sauberere Pfade, weicht Geraeten aus.
        //
        // Zwei requestAnimationFrame: der erste damit ReactFlow das
        // neue Edge gerendert + die Node-Layouts gemessen hat, der
        // zweite damit das Layout ueber den render-Loop stabil ist.
        // Sonst hat A* keine validen Obstacle-Rects.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const newCable = scratchStore.getState().project.cables.slice(-1)[0]
            if (newCable) routeCable(newCable.id)
          })
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
    const prevSU = prevStartUnit.current
    const patched: EquipmentItem[] = current.map((eq) => {
      const incoming = nextById.get(eq.id)
      if (!incoming) return eq
      // #515 — y NUR neu aus startUnit ableiten, wenn sich die HE-Position
      // wirklich geändert hat (z.B. via Properties). Beim Verkabeln/Umbenennen
      // die aktuelle (ggf. gezogene) Position behalten — sonst „verspringen"
      // Geräte, sobald ein Kabel gesetzt wird, und das frisch geroutete Kabel
      // sieht falsch aus.
      const heChanged = prevSU.has(eq.id) && prevSU.get(eq.id) !== incoming.startUnit
      return {
        ...eq,
        name: incoming.name,
        category: incoming.category,
        y: heChanged ? Y_OFFSET + (incoming.startUnit - 1) * HE_TO_PX : eq.y,
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
    // #515 — HE-Stände für den nächsten Sync merken (Änderungserkennung).
    prevStartUnit.current = new Map(placements.map((p) => [p.id, p.startUnit]))
  }, [placements, scratchStore])

  return (
    <ProjectStoreProvider store={scratchStore}>
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: 320,
          display: 'grid',
          gridTemplateColumns: '1fr 280px',
          gap: 8,
        }}
      >
        <div style={{ position: 'relative', minWidth: 0 }}>
          <CanvasArea mode="rack" />
          {/* CableContextMenu muss innerhalb des Providers gerendert
              sein, damit seine Mutationen den Scratch-Store treffen. */}
          <CableContextMenu />
        </div>
        {/* v7.9.11 — Inline-Properties-Pane: zeigt EquipmentProperties
            wenn ein Rack-Gerät ausgewählt ist, CableProperties wenn ein
            Kabel ausgewählt ist. Beide nutzen useCanvasProjectStore
            (via dem Provider drumherum) und arbeiten daher gegen den
            Scratch-Store. */}
        <RackSidePropertiesPane />
      </div>
    </ProjectStoreProvider>
  )
}

const RackSidePropertiesPane = () => {
  const t = useTranslation()
  const selectedEquipmentId = useCanvasProjectStore((s) => s.selectedEquipmentId)
  const selectedCableId = useCanvasProjectStore((s) => s.selectedCableId)
  const selectedEquipment = useCanvasProjectStore((s) =>
    selectedEquipmentId ? s.project.equipment.find((e) => e.id === selectedEquipmentId) : undefined,
  )
  const selectedCable = useCanvasProjectStore((s) =>
    selectedCableId ? s.project.cables.find((c) => c.id === selectedCableId) : undefined,
  )
  const title = selectedEquipment
    ? format(t('rack.inspector.deviceTitle', 'Gerät: {name}'), { name: selectedEquipment.name })
    : selectedCable
      ? format(t('rack.inspector.cableTitle', 'Kabel: {name}'), { name: selectedCable.name })
      : t('rack.inspector.title', 'Inspector')
  return (
    <aside className="flex h-full min-h-0 flex-col rounded border border-cp-border bg-cp-surface-3">
      <div className="border-b border-cp-border-muted px-3 py-2">
        <h3 className="truncate text-cp-xs font-semibold text-cp-text">{title}</h3>
        <div className="mt-0.5 text-[9px] uppercase tracking-wide text-cp-text-muted">
          {t('rack.inspector.scope', 'Eigenschaften (Rack-Scope)')}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-2 text-cp-xs">
        {selectedEquipmentId && <EquipmentProperties />}
        {selectedCableId && <CableProperties />}
        {!selectedEquipmentId && !selectedCableId && (
          <div className="rounded border border-cp-border-muted bg-cp-surface-1/40 p-3 text-[11px] text-cp-text-muted">
            {t('rack.inspector.empty', 'Klick auf ein Rack-Gerät oder eine Verbindung im Canvas → die Eigenschaften erscheinen hier.')}
          </div>
        )}
      </div>
    </aside>
  )
}
