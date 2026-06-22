import { Handle, Position, useUpdateNodeInternals, type NodeProps } from 'reactflow'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Headphones, Lock, Check } from 'lucide-react'
import type { EquipmentItem } from '../../types/equipment'
import { useUiStore } from '../../store/uiStore'
import { useModule } from '../../store/settingsStore'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { AlertTriangle } from 'lucide-react'
import { useTranslation, format } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { colorForConnector } from '../../lib/cableColors'
import { defaultIconForEquipment } from '../../lib/deviceKind'
import { findGreenGoUserForEquipment } from '../../lib/greengoSync'
import { rackBandColor } from '../../lib/rackBandColors'
import { portDisplayLabel, genderSymbol } from '../../lib/portLabel'
import {
  RackBandsOverlay,
  RackInternalCablesOverlay,
  type BlackBoxBand,
  type BlackBoxCable,
} from '../Rack/blackBoxShared'

type EquipmentNodeData = EquipmentItem & {
  exportThemeOverride?: 'dark' | 'light'
}

// v7.9.23 — Layout-Konstanten aus zentraler lib/layoutConstants.ts.
// Vorher waren diese Werte zwischen EquipmentNode.tsx und
// equipmentLayout.ts dupliziert — Bug-Garantie wenn einer der beiden
// geändert wurde.
import { EQUIPMENT_LAYOUT } from '../../lib/layoutConstants'
const HEADER_HEIGHT = EQUIPMENT_LAYOUT.HEADER_HEIGHT
const HEADER_HEIGHT_WITH_IP = EQUIPMENT_LAYOUT.HEADER_HEIGHT_WITH_IP
const PORT_ROW = EQUIPMENT_LAYOUT.PORT_ROW
const HANDLE_SIZE = EQUIPMENT_LAYOUT.HANDLE_SIZE
const PADDING = EQUIPMENT_LAYOUT.PADDING

// v7.9.39 — rackBandColor lebt jetzt in '../../lib/rackBandColors' damit
// die RackLivePreview im 2D Rack Builder identische Band-Farben rendert.

const resolvePortSide = (
  port: EquipmentItem['inputs'][number] | EquipmentItem['outputs'][number],
  defaultSide: 'left' | 'right',
  mirrored: boolean,
): 'left' | 'right' => {
  if (port.side) return port.side
  if (!mirrored) return defaultSide
  return defaultSide === 'left' ? 'right' : 'left'
}

export const EquipmentNode = ({ id, data, selected }: NodeProps<EquipmentNodeData>) => {
  const t = useTranslation()
  const pendingCable = useUiStore((s) => s.pendingCable)
  const startPendingCable = useUiStore((s) => s.startPendingCable)
  const clearPendingCable = useUiStore((s) => s.clearPendingCable)
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const colorPortsByType = useUiStore((s) => s.colorPortsByType)
  // v7.9.59 — User-anpassbare Geräte-Karten-Farben pro Theme. Vorher
  // waren die Farben inline (#f8fafc / #0f172a etc.) was zu Karten
  // führte die im Dark-Mode komplett mit dem Canvas-BG verschmolzen.
  const equipmentColors = useUiStore((s) => s.equipmentColors)
  // Issue #62: user-editable per-connector-type colour overrides.
  // The override map is sparse — empty/missing entries fall back to
  // the built-in palette inside colorForConnector().
  const connectorTypeColors = useUiStore((s) => s.connectorTypeColors)
  // Issue #274 — Kategorie-Farben. Wenn ein Geraet keinen eigenen
  // `nodeColor` hat aber die Kategorie eine Default-Farbe definiert
  // (z.B. "Monitor" = blau), nutzt der Node die Kategorie-Farbe.
  // Per-Geraet-`nodeColor` gewinnt weiter — der User kann immer einzeln
  // ueberschreiben.
  const categoryColors = useUiStore((s) => s.categoryColors)
  const rentmanEnabled = useModule('rentman')
  // #291 — User-konfigurierbare Port-Label-Schriftgroesse. Skaliert
  // beide Port-Spalten + die Collapsed-View. Header bleibt fix damit
  // headerHeight nicht recomputet werden muss.
  const portLabelFontSize = useUiStore((s) => s.portLabelFontSize)
  const isLight = (data.exportThemeOverride ?? canvasTheme) === 'light'
  const tokens = isLight ? equipmentColors.light : equipmentColors.dark
  // Effektive Geraete-Farbe: per-Geraet > Kategorie > undefined (= Theme-Default).
  const effectiveNodeColor: string | undefined =
    data.nodeColor ?? categoryColors[data.category] ?? undefined
  const queueConnection = useProjectStore((s) => s.queueConnection)
  // #295 — Plan-Lock-Status. Bei finalized/viewer-Modus duerfen User keine
  // neuen Kabel mehr ziehen, auch nicht das visuelle Open-End-Pending.
  const projectMode = useProjectStore((s) => s.project.mode)
  const isProjectLocked = projectMode === 'finalized' || projectMode === 'viewer'
  // Mobile-Haken-Entfernung (User-Request: "im normalen canvas auch wieder
  // loeschen koennen"). Klick aufs ✓ entfernt den Check fuer diesen Port.
  const clearPortCheck = useProjectStore((s) => s.clearPortCheck)
  // Issue #56: GreenGo beltpack name is the canvas-visible identifier
  // for intercom devices. Reads from project.greengoConfig.users —
  // same source the EquipmentProperties beltpack section and the GG
  // dialog write to, so all three views stay in sync.
  const greengoConfig = useProjectStore((s) => s.project.greengoConfig)
  const greengoUser = findGreenGoUserForEquipment(id, greengoConfig)
  // Issue #68: if the user hovers an edge, we want to light up the
  // port handles on both endpoints. Resolve the hovered cable's source
  // and target port IDs that live on THIS device, so the handle
  // renderer below can apply the glow.
  // v7.8.2 — Previously this selector built a fresh `Set` every call
  // (`new Set() !== new Set()`), so zustand thought the value changed
  // on every store update and forced a re-render of every Equipment
  // node, even when no cable was hovered. We now return a stable
  // string key ("port1|port2" or null) and derive a Set per-render
  // locally — cheap and stable across selector calls.
  const hoveredCableId = useUiStore((s) => s.hoveredCableId)
  const hoveredEndpointKey = useProjectStore((s) => {
    if (!hoveredCableId) return null
    const cable = s.project.cables.find((c) => c.id === hoveredCableId)
    if (!cable) return null
    const parts: string[] = []
    if (cable.fromEquipmentId === id) parts.push(cable.fromPortId)
    if (cable.toEquipmentId === id) parts.push(cable.toPortId)
    return parts.length > 0 ? parts.join('|') : null
  })
  const hoveredEndpointPortIds = hoveredEndpointKey
    ? new Set(hoveredEndpointKey.split('|'))
    : null
  const updateNodeInternals = useUpdateNodeInternals()

  // v7.9.1 — Rack-internal port detection (User-Request).
  // Wenn dieses Gerät zu einem Rack gehört (rackInstanceId gesetzt),
  // markieren wir Ports die mit anderen Geräten desselben Racks
  // verkabelt sind als "rack-intern verkabelt". Visuell: kleines
  // 🔒-Icon + dim color. Datenmodell-frei — rein render-zeit.
  const projectCables = useProjectStore((s) => s.project.cables)
  const projectEquipment = useProjectStore((s) => s.project.equipment)
  // v7.9.3 — Plugged-Status aus Mobile-Viewer. Wenn ein Port am Handy
  // als "gesteckt" markiert wurde, zeigen wir am Canvas-Port ein
  // kleines Häkchen (User-Request: "wenn ich in der handy zugriff
  // html einen port als gesteckt markiere, muss in dem cable planner
  // auch ein kleiner haken an dem port erscheinen").
  // Stable string key zum Vermeiden des zustand-Set-Reference-Bugs (v7.8.2).
  const pluggedPortKey = useProjectStore((s) => {
    const checks = s.project.checkState?.ports
    if (!checks) return ''
    const pluggedHere: string[] = []
    for (const port of data.inputs) {
      if (checks[`${id}|${port.id}`]) pluggedHere.push(port.id)
    }
    for (const port of data.outputs) {
      if (checks[`${id}|${port.id}`]) pluggedHere.push(port.id)
    }
    return pluggedHere.sort().join('|')
  })
  const pluggedPortIds = useMemo(
    () => (pluggedPortKey ? new Set(pluggedPortKey.split('|')) : null),
    [pluggedPortKey],
  )
  const rackInternalPortKey = useMemo(() => {
    const rackId = data.rackInstanceId
    if (!rackId) return ''
    const sameRackIds = new Set(
      projectEquipment.filter((e) => e.rackInstanceId === rackId).map((e) => e.id),
    )
    // Sammle alle Port-IDs an MEINEM Gerät die auf ein anderes Gerät
    // desselben Racks zeigen.
    const portIds: string[] = []
    for (const c of projectCables) {
      if (c.fromEquipmentId === id && sameRackIds.has(c.toEquipmentId)) {
        portIds.push(c.fromPortId)
      } else if (c.toEquipmentId === id && sameRackIds.has(c.fromEquipmentId)) {
        portIds.push(c.toPortId)
      }
    }
    return portIds.sort().join('|')
  }, [data.rackInstanceId, id, projectCables, projectEquipment])
  const rackInternalPortIds = useMemo(
    () => (rackInternalPortKey ? new Set(rackInternalPortKey.split('|')) : null),
    [rackInternalPortKey],
  )

  // Re-register handle positions whenever the data that affects port placement
  // actually changes — portsFlipped (ports spiegeln), per-port `side` overrides,
  // or input/output port additions/reorders. The previous fix in CanvasArea
  // called updateNodeInternals from the store-sync useEffect, but at that point
  // EquipmentNode hadn't re-rendered with the new handle positions yet, so
  // ReactFlow re-measured the OLD layout. Calling it from inside EquipmentNode
  // guarantees the call happens *after* this component has committed the new
  // handle DOM, so existing cables snap to the moved ports.
  const portsLayoutKey = JSON.stringify({
    flipped: !!data.portsFlipped,
    inputs: data.inputs.map((p) => `${p.id}:${p.side ?? ''}`),
    outputs: data.outputs.map((p) => `${p.id}:${p.side ?? ''}`),
  })
  const lastLayoutKey = useRef(portsLayoutKey)
  useEffect(() => {
    if (lastLayoutKey.current === portsLayoutKey) return
    lastLayoutKey.current = portsLayoutKey
    updateNodeInternals(id)
  }, [id, portsLayoutKey, updateNodeInternals])

  /**
   * Port click handler: enables draw.io-style click-to-connect.
   * - First click on a port starts a pending cable.
   * - Next click on any other port finishes the cable (queues the cable
   *   dialog with the collected waypoints).
   * - Click on the same port cancels the pending draw.
   * Waypoints between the two clicks are added from pane clicks in
   * CanvasArea.
   */
  // #460 — Kern der Click-to-Connect-Logik ohne Event, damit sie sowohl per
  // Maus-Klick als auch per Tastatur (Enter/Space) ausgeloest werden kann.
  // Der Canvas war vorher reine Maus-Bedienung (kein Tastatur-Pfad zum
  // Kabel-Anlegen).
  const activatePort = (portId: string, side: 'input' | 'output') => {
    // #295 — Bei abgeschlossenem Plan oder im Viewer ist Click-to-Connect
    // komplett blockiert. Vorher konnte der User trotz "Plan abgeschlossen"
    // ein pendingCable starten + Open-End-Waypoints klicken — wurde zwar
    // nie als echtes Kabel angelegt (queueConnection prueft den Lock), aber
    // das visuelle Dangle-Verhalten war irritierend.
    if (isProjectLocked) {
      return
    }
    // v7.9.1 — Rack-intern verkabelte Ports sind "belegt" — kein externes
    // Click-to-Connect erlaubt. Sowohl als Startpunkt als auch als
    // Endpunkt einer pending-Cable verboten.
    if (rackInternalPortIds?.has(portId)) {
      return
    }
    const handleType: 'source' | 'target' = side === 'output' ? 'source' : 'target'
    if (!pendingCable) {
      startPendingCable({ nodeId: id, handleId: portId, handleType })
      return
    }
    // Cancel if clicked the same port again.
    if (
      pendingCable.nodeId === id &&
      pendingCable.handleId === portId &&
      pendingCable.handleType === handleType
    ) {
      clearPendingCable()
      return
    }
    // Build the Connection payload. We orient it so that source is an output
    // and target is an input, regardless of which end the user started from.
    const startIsSource = pendingCable.handleType === 'source'
    const endIsSource = handleType === 'source'
    let connection: {
      source: string
      sourceHandle: string
      target: string
      targetHandle: string
    }
    let waypoints = pendingCable.waypoints
    if (startIsSource && !endIsSource) {
      connection = {
        source: pendingCable.nodeId,
        sourceHandle: pendingCable.handleId,
        target: id,
        targetHandle: portId,
      }
    } else if (!startIsSource && endIsSource) {
      connection = {
        source: id,
        sourceHandle: portId,
        target: pendingCable.nodeId,
        targetHandle: pendingCable.handleId,
      }
      // Waypoints were recorded in the direction start -> end; reverse so they
      // run source -> target.
      waypoints = [...waypoints].reverse()
    } else {
      // Two outputs or two inputs clicked. With ConnectionMode.Loose we still
      // allow it; pick the first as source.
      connection = {
        source: pendingCable.nodeId,
        sourceHandle: pendingCable.handleId,
        target: id,
        targetHandle: portId,
      }
    }
    clearPendingCable()
    queueConnection(connection, waypoints)
  }

  const handlePortClick =
    (portId: string, side: 'input' | 'output') => (event: React.MouseEvent) => {
      event.stopPropagation()
      activatePort(portId, side)
    }

  // #460 — Tastatur-Pfad: Enter/Space auf einem fokussierten Port startet
  // bzw. schliesst eine Verbindung (analog zum Klick). Escape-zum-Abbrechen
  // haengt bereits am globalen CanvasArea-Keydown (clearPendingCable).
  const handlePortKeyDown =
    (portId: string, side: 'input' | 'output') => (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      activatePort(portId, side)
    }

  const isPendingStart = (portId: string, side: 'input' | 'output'): boolean => {
    if (!pendingCable) return false
    const handleType: 'source' | 'target' = side === 'output' ? 'source' : 'target'
    return (
      pendingCable.nodeId === id &&
      pendingCable.handleId === portId &&
      pendingCable.handleType === handleType
    )
  }

  // Hover state for port rows — gives visual feedback before click
  const [hoveredPort, setHoveredPort] = useState<string | null>(null)

  // v7.9.26 — Optionale Header-Zeilen (Subtitle / Beltpack-Name)
  // erweitern den Header um 11 px (1 Grid-Step) statt 14, sodass der
  // headerHeight immer ein Vielfaches von gridSize bleibt und die
  // Ports auf Dot-Reihen landen.
  const EXTRA_HEADER_LINE = EQUIPMENT_LAYOUT.GRID_SIZE
  const beltpackLine = greengoUser ? EXTRA_HEADER_LINE : 0
  const headerHeight = (
    data.ipAddress
      ? (data.subtitle ? HEADER_HEIGHT_WITH_IP + EXTRA_HEADER_LINE : HEADER_HEIGHT_WITH_IP)
      : (data.subtitle ? HEADER_HEIGHT + EXTRA_HEADER_LINE : HEADER_HEIGHT)
  ) + beltpackLine
  const inputPlacement = new Map<string, { side: 'left' | 'right'; slot: number }>()
  const outputPlacement = new Map<string, { side: 'left' | 'right'; slot: number }>()
  const sideCounts: Record<'left' | 'right', number> = { left: 0, right: 0 }

  // v7.9.14 — Black-Box-Rack-Mode: wenn das Equipment einen
  // rackInternalSnapshot hat UND die Ports rackOriginDeviceIndex
  // mitbringen, gruppieren wir die Ports nach Quell-Gerät und stapeln
  // sie als "Bänder" — In + Out desselben Geräts landen auf gleicher
  // horizontaler Höhe. Jedes Gerät bekommt zusätzlich ein farbiges
  // Hintergrund-Band (siehe rackBandColor) und Geräte-Name-Label,
  // damit man auf einen Blick erkennt welcher Port zu welchem Gerät
  // gehört (User-Request: "in der blackbox ist nicht ersichtlich
  // welche ports zu welchem gerät gehören").
  type RackBand = {
    deviceIndex: number
    deviceName: string
    color: string
    topSlot: number
    rowSpan: number
    inputs: typeof data.inputs
    outputs: typeof data.outputs
  }
  const rackBands: RackBand[] = []
  const isRackBlackBox =
    !!data.rackInternalSnapshot &&
    (data.inputs.some((p) => p.rackOriginDeviceIndex !== undefined) ||
      data.outputs.some((p) => p.rackOriginDeviceIndex !== undefined))

  if (isRackBlackBox) {
    const snap = data.rackInternalSnapshot!
    const portsByDevice = new Map<number, RackBand>()
    const ensureBand = (idx: number, name: string): RackBand => {
      let band = portsByDevice.get(idx)
      if (!band) {
        band = {
          deviceIndex: idx,
          deviceName: name,
          color: rackBandColor(name),
          topSlot: 0,
          rowSpan: 0,
          inputs: [],
          outputs: [],
        }
        portsByDevice.set(idx, band)
      }
      return band
    }
    for (const port of data.inputs) {
      if (port.rackOriginDeviceIndex == null) continue
      const item = snap.items[port.rackOriginDeviceIndex]
      const name = port.rackOriginDeviceName ?? item?.name ?? `#${port.rackOriginDeviceIndex}`
      ensureBand(port.rackOriginDeviceIndex, name).inputs.push(port)
    }
    for (const port of data.outputs) {
      if (port.rackOriginDeviceIndex == null) continue
      const item = snap.items[port.rackOriginDeviceIndex]
      const name = port.rackOriginDeviceName ?? item?.name ?? `#${port.rackOriginDeviceIndex}`
      ensureBand(port.rackOriginDeviceIndex, name).outputs.push(port)
    }
    // Sort by HE-position (snap.items[idx].startUnit)
    const sortedBands = Array.from(portsByDevice.values()).sort((a, b) => {
      const aTop = snap.items[a.deviceIndex]?.startUnit ?? a.deviceIndex
      const bTop = snap.items[b.deviceIndex]?.startUnit ?? b.deviceIndex
      return aTop - bTop
    })
    // 1 Slot Gap zwischen Geräten (= sichtbare Trennung im Body).
    const GAP_BETWEEN_BANDS = 1
    // 1 Header-Row pro Band für den Geräte-Namen (kleines Label oben).
    const HEADER_ROW_PER_BAND = 1
    let cursor = 0
    for (const band of sortedBands) {
      const ports = Math.max(band.inputs.length, band.outputs.length, 1)
      band.topSlot = cursor
      band.rowSpan = HEADER_ROW_PER_BAND + ports
      band.inputs.forEach((p, i) => {
        const side = resolvePortSide(p, 'left', !!data.portsFlipped)
        const slot = band.topSlot + HEADER_ROW_PER_BAND + i
        inputPlacement.set(p.id, { side, slot })
        sideCounts[side] = Math.max(sideCounts[side], slot + 1)
      })
      band.outputs.forEach((p, i) => {
        const side = resolvePortSide(p, 'right', !!data.portsFlipped)
        const slot = band.topSlot + HEADER_ROW_PER_BAND + i
        outputPlacement.set(p.id, { side, slot })
        sideCounts[side] = Math.max(sideCounts[side], slot + 1)
      })
      cursor += band.rowSpan + GAP_BETWEEN_BANDS
    }
    rackBands.push(...sortedBands)
  } else {
    // Standard layout: slots per side, fortlaufend in Definitionsreihenfolge.
    for (const port of data.inputs) {
      const side = resolvePortSide(port, 'left', !!data.portsFlipped)
      const slot = sideCounts[side]
      sideCounts[side] += 1
      inputPlacement.set(port.id, { side, slot })
    }
    for (const port of data.outputs) {
      const side = resolvePortSide(port, 'right', !!data.portsFlipped)
      const slot = sideCounts[side]
      sideCounts[side] += 1
      outputPlacement.set(port.id, { side, slot })
    }
  }

  // Collapsed view (issue #37): render a small label-only badge with port
  // dots evenly distributed on the edges. No port labels, just the icon and
  // name. Useful for converters / passive devices where the full port list
  // is visual noise on the canvas. Toggleable per device in EquipmentProperties.
  if (data.collapsed) {
    const icon = data.icon ?? defaultIconForEquipment(data)
    const inLeft = data.inputs.filter((p) => resolvePortSide(p, 'left', !!data.portsFlipped) === 'left')
    const inRight = data.inputs.filter((p) => resolvePortSide(p, 'left', !!data.portsFlipped) === 'right')
    const outLeft = data.outputs.filter((p) => resolvePortSide(p, 'right', !!data.portsFlipped) === 'left')
    const outRight = data.outputs.filter((p) => resolvePortSide(p, 'right', !!data.portsFlipped) === 'right')
    const leftPorts = [...inLeft, ...outLeft]
    const rightPorts = [...inRight, ...outRight]
    const cWidth = 130
    const cHeight = Math.max(36, Math.max(leftPorts.length, rightPorts.length) * 12 + 14)
    return (
      <div
        style={{
          position: 'relative',
          width: cWidth,
          height: cHeight,
          background: effectiveNodeColor
            ? `${effectiveNodeColor}${isLight ? '22' : '33'}`
            : tokens.body,
          border: `1px solid ${selected ? '#38bdf8' : (effectiveNodeColor ?? tokens.border)}`,
          borderRadius: 6,
          color: tokens.text,
          fontSize: portLabelFontSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          padding: '4px 12px',
          boxShadow: isLight ? '0 2px 6px rgba(0,0,0,0.12)' : '0 2px 6px rgba(0,0,0,0.4)',
        }}
        title={`${data.name}${data.subtitle ? ' — ' + data.subtitle : ''}`}
      >
        {icon && <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
          {data.name}
        </span>
        {/* Port dots — left side */}
        {leftPorts.map((port, i) => {
          const isInput = data.inputs.includes(port)
          // #241 — Float-Y zu Sub-Pixel-Werten wie 22.5 — Browser
          // runden uneinheitlich, das Linien-Ende landet 1 px off.
          // Math.round zwingt die Mitte des Handle-Dots auf einen
          // ganzen Pixel.
          const y = Math.round((i + 0.5) * (cHeight / leftPorts.length))
          return (
            <Handle
              key={port.id}
              id={port.id}
              type={isInput ? 'target' : 'source'}
              position={Position.Left}
              isConnectable
              style={{
                top: y,
                left: 0,
                width: 10,
                height: 10,
                background: isInput ? '#22d3ee' : '#34d399',
                border: '1px solid #0f172a',
              }}
            />
          )
        })}
        {/* Port dots — right side */}
        {rightPorts.map((port, i) => {
          const isInput = data.inputs.includes(port)
          const y = Math.round((i + 0.5) * (cHeight / rightPorts.length))
          return (
            <Handle
              key={port.id}
              id={port.id}
              type={isInput ? 'target' : 'source'}
              position={Position.Right}
              isConnectable
              style={{
                top: y,
                right: 0,
                width: 10,
                height: 10,
                background: isInput ? '#22d3ee' : '#34d399',
                border: '1px solid #0f172a',
              }}
            />
          )
        })}
      </div>
    )
  }

  const portRows = Math.max(sideCounts.left, sideCounts.right, 1)
  // Auto-grow node width so the longest port label (name + connector type) is
  // not truncated by the 50%-width port columns. Without this, long names like
  // "REF IN BNC" got ellipsised to "REF…" on the canvas. ~7px per character is
  // a conservative estimate for the 11px UI font; 32px reserves space for the
  // handle dot, padding, and the "·" separator.
  const longestPortText = [...data.inputs, ...data.outputs].reduce(
    (max, p) => Math.max(max, (p.name?.length ?? 0) + (p.connectorType?.length ?? 0) + 3),
    0,
  )
  const labelWidth = longestPortText * 7 + 32
  // v7.9.26 — Width rastet auf gridSize-Vielfache (11 px) ein, sodass
  // die Außenkanten der Karte mit Dot-Spalten zusammenfallen. Auto-
  // Expand für lange Port-Labels rundet entsprechend AUF.
  const GRID = EQUIPMENT_LAYOUT.GRID_SIZE
  const snapUp = (n: number) => Math.ceil(n / GRID) * GRID
  const intrinsicWidth = snapUp(Math.max(EQUIPMENT_LAYOUT.DEFAULT_WIDTH, labelWidth * 2))
  const width = Math.max(snapUp(data.width ?? intrinsicWidth), intrinsicWidth)
  // computedHeight ist per Konstruktion bereits Vielfaches von GRID
  // (headerHeight, PORT_ROW, PADDING sind alle Vielfache); data.height
  // wird zur Sicherheit aufgerundet falls der User es manuell setzt.
  const computedHeight = headerHeight + portRows * PORT_ROW + PADDING
  const height = Math.max(snapUp(data.height ?? computedHeight), computedHeight)

  // Y offset for the handle dot: aligns to vertical center of the row.
  const rowCenter = (index: number) => headerHeight + index * PORT_ROW + PORT_ROW / 2

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background: effectiveNodeColor
          ? `${effectiveNodeColor}${isLight ? '18' : '22'}`
          : tokens.body,
        border: `1px solid ${selected ? '#38bdf8' : (effectiveNodeColor ?? tokens.border)}`,
        borderRadius: 6,
        color: tokens.text,
        fontSize: 12,
        boxShadow: isLight
          ? '0 2px 6px rgba(0,0,0,0.12)'
          : '0 2px 6px rgba(0,0,0,0.4)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: `${PADDING}px ${PADDING}px 0 ${PADDING}px`,
        borderBottom: `1px solid ${effectiveNodeColor ?? tokens.border}`,
        background: effectiveNodeColor
          ? `${effectiveNodeColor}${isLight ? '18' : '33'}`
          : tokens.header,
        borderRadius: '5px 5px 0 0',
      }}>
        <div style={{ fontWeight: 600, lineHeight: '16px', display: 'flex', alignItems: 'center', gap: 4 }}>
          {rentmanEnabled && (
            data.rentmanId && !data.rentmanRemoved ? (
              <span
                style={{
                  background: '#c2410c',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 3,
                  padding: '0 3px',
                  lineHeight: '13px',
                  flexShrink: 0,
                }}
                title={`Rentman-ID: ${data.rentmanId}`}
              >
                R
              </span>
            ) : data.rentmanRemoved ? (
              <span
                style={{
                  background: '#92400e',
                  color: '#fef3c7',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 3,
                  padding: '0 3px',
                  lineHeight: '13px',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                title={t('eqNode.rentmanRemoved', 'In Rentman nicht mehr vorhanden!')}
              >
                <Icon icon={AlertTriangle} size={12} />
              </span>
            ) : (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#92400e',
                  flexShrink: 0,
                  opacity: 0.7,
                }}
                title={t('eqNode.noRentman', 'Kein Rentman-Eintrag')}
              />
            )
          )}
          {(() => {
            // Issue #46: small leading icon glyph derived from category/name,
            // overridable per device via data.icon. Empty string suppresses.
            const icon = data.icon ?? defaultIconForEquipment(data)
            if (!icon) return null
            return (
              <span style={{ fontSize: 14, lineHeight: '16px', flexShrink: 0 }} title={`Icon: ${icon}`}>
                {icon}
              </span>
            )
          })()}
          <span>{data.name}</span>
          {data.packed && (
            <span
              style={{
                marginLeft: 4,
                background: '#10b981',
                color: '#022c22',
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 3,
                padding: '0 4px',
                lineHeight: '14px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title={t('eqNode.packed', 'Gepackt — bereit zum Versand')}
            >
              <Icon icon={Check} size={12} />
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: tokens.subtext, lineHeight: '14px' }}>{data.category}</div>
        {data.subtitle && (
          <div style={{ fontSize: 11, color: tokens.subtext, lineHeight: '14px', fontStyle: 'italic' }}>{data.subtitle}</div>
        )}
        {greengoUser && (
          <div
            style={{
              fontSize: 10,
              color: isLight ? '#047857' : '#34d399',
              lineHeight: '13px',
              fontWeight: 600,
              marginTop: 1,
            }}
            title={`GreenGo Beltpack #${greengoUser.user.id}${greengoUser.groupNames.length > 0 ? ` · ${t('eqNode.greengoGroups', 'Gruppen')}: ${greengoUser.groupNames.join(', ')}` : ''}`}
          >
            <Icon icon={Headphones} size="xs" className="mr-1 inline-block align-text-bottom" />{greengoUser.user.name}
          </div>
        )}
        {data.ipAddress && (
          <div
            style={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: 10,
              color: isLight ? '#0369a1' : '#38bdf8',
              lineHeight: '12px',
              marginTop: 2,
            }}
            title={
              data.subnetMask
                ? `IP: ${data.ipAddress} / ${data.subnetMask}`
                : `IP: ${data.ipAddress}`
            }
          >
            {data.ipAddress}
            {data.subnetMask ? ` /${data.subnetMask}` : ''}
          </div>
        )}
      </div>

      {/* v7.9.14 — Rack-Bänder: Hintergrund-Rechtecke + Geräte-Name-Labels
          für jedes interne Rack-Gerät. Mit subtilem farbigen Akzent
          links + Glyph-Name oben im Band. Rendert NUR im Black-Box-Mode. */}
      {/* v7.9.40 — Bänder-Stripes via geteilter Komponente. Pre-v7.9.40
          war das Rendering inline hier; RackLivePreview im 2D-Builder
          hatte eine eigene Implementierung — beide sind jetzt eine
          geteilte Komponente. */}
      {isRackBlackBox && (
        <RackBandsOverlay
          bands={rackBands.map((band): BlackBoxBand => ({
            key: String(band.deviceIndex),
            topSlot: band.topSlot,
            rowSpan: band.rowSpan,
            color: band.color,
            deviceName: band.deviceName,
            inputCount: band.inputs.length,
            outputCount: band.outputs.length,
          }))}
          headerHeight={headerHeight}
          isLight={isLight}
        />
      )}

      {/* Inputs */}
      {data.inputs.map((port, index) => {
        const placement = inputPlacement.get(port.id) ?? { side: 'left' as const, slot: index }
        const top = headerHeight + placement.slot * PORT_ROW
        const side = placement.side
        const isLeft = side === 'left'
        const isHovered = hoveredPort === `in-${port.id}`
        const isActive = isPendingStart(port.id, 'input')
        const isRackInternal = (rackInternalPortIds?.has(port.id) ?? false) || !!port.rackInternallyConnected
        const isPlugged = pluggedPortIds?.has(port.id) ?? false
        return (
          <div
            key={port.id}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handlePortClick(port.id, 'input')}
            onMouseEnter={() => setHoveredPort(`in-${port.id}`)}
            onMouseLeave={() => setHoveredPort(null)}
            role="button"
            tabIndex={isProjectLocked || isRackInternal ? -1 : 0}
            onKeyDown={handlePortKeyDown(port.id, 'input')}
            aria-label={`${port.name} · ${port.connectorType} — ${t('eqNode.portConnectHint', 'Enter verbindet')}`}
            style={{
              position: 'absolute',
              top,
              ...(isLeft ? { left: 0 } : { right: 0 }),
              width: '50%',
              height: PORT_ROW,
              ...(isLeft
                ? { paddingLeft: 14, paddingRight: 4 }
                : { paddingRight: 14, paddingLeft: 4 }),
              display: 'flex',
              alignItems: 'center',
              justifyContent: isLeft ? 'flex-start' : 'flex-end',
              textAlign: isLeft ? 'left' : 'right',
              fontSize: portLabelFontSize,
              cursor: isRackInternal ? 'not-allowed' : 'crosshair',
              opacity: isRackInternal ? 0.55 : 1,
              borderRadius: 3,
              background: isActive
                ? 'rgba(251,191,36,0.15)'
                : isHovered
                  ? 'rgba(14,165,233,0.12)'
                  : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <span
              title={
                isRackInternal
                  ? format(t('eqNode.portRackInternal', '{port} · {type} — Rack-intern verkabelt'), { port: port.name, type: port.connectorType })
                  : isPlugged
                    ? format(t('eqNode.portPluggedOnSite', '{port} · {type} — vor Ort gesteckt'), { port: port.name, type: port.connectorType })
                    : `${port.name} · ${port.connectorType}`
              }
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}
            >
              {isPlugged && (
                <span
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    clearPortCheck(id, port.id)
                  }}
                  style={{
                    marginRight: 3,
                    color: '#10b981',
                    fontWeight: 700,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    // #503 — Wrapper als inline-flex (wie Lock/Headphones), sonst
                    // sitzt das lucide-Check-SVG auf der Baseline und macht das
                    // Port-Label 2-zeilig (Sprung). align-middle hält es 1-zeilig.
                    display: 'inline-flex',
                    alignItems: 'center',
                    verticalAlign: 'middle',
                  }}
                  title={t('eqNode.mobileChecked', 'Vor Ort gesteckt (Mobile-Viewer) — Klick entfernt den Haken')}
                  aria-label={t('eqNode.mobileChecked', 'Vor Ort gesteckt (Mobile-Viewer) — Klick entfernt den Haken')}
                >
                  <Icon icon={Check} size="xs" />
                </span>
              )}
              {isRackInternal && <span style={{ marginRight: 3 }} className="inline-flex align-middle"><Icon icon={Lock} size="xs" /></span>}
              {isLeft ? (
                <>{portDisplayLabel(port)}<span style={{ color: isLight ? '#94a3b8' : '#64748b' }}> · {port.connectorType}{genderSymbol(port.gender) && ` ${genderSymbol(port.gender)}`}</span></>
              ) : (
                <><span style={{ color: isLight ? '#94a3b8' : '#64748b' }}>{genderSymbol(port.gender) && `${genderSymbol(port.gender)} `}{port.connectorType} · </span>{portDisplayLabel(port)}</>
              )}
            </span>
          </div>
        )
      })}
      {data.inputs.map((port, index) => {
        const bi = port.direction === 'bidirectional'
        const isStart = isPendingStart(port.id, 'input')
        const placement = inputPlacement.get(port.id) ?? { side: 'left' as const, slot: index }
        const side = placement.side
        const pos = side === 'left' ? Position.Left : Position.Right
        const dotColor = colorPortsByType
          ? colorForConnector(port.connectorType, connectorTypeColors)
          : (bi ? '#a855f7' : '#0ea5e9')
        // Issue #68: glow when this port is an endpoint of the hovered cable.
        const isHoveredEndpoint = hoveredEndpointPortIds?.has(port.id) ?? false
        const isRackInternal = (rackInternalPortIds?.has(port.id) ?? false) || !!port.rackInternallyConnected
        return (
          <Fragment key={`h-in-${port.id}`}>
            <Handle
              type="target"
              id={port.id}
              position={pos}
              isConnectable={!isRackInternal}
              onClick={handlePortClick(port.id, 'input')}
              style={{
                top: rowCenter(placement.slot),
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: isRackInternal ? (isLight ? '#cbd5e1' : '#475569') : dotColor,
                opacity: isRackInternal ? 0.65 : 1,
                border: isStart
                  ? '2px solid #fbbf24'
                  : isHoveredEndpoint
                    ? '2px solid #38bdf8'
                    : `2px solid ${isLight ? '#e2e8f0' : '#0f172a'}`,
                boxShadow: isStart
                  ? '0 0 0 3px rgba(251,191,36,0.45)'
                  : isHoveredEndpoint
                    ? '0 0 0 3px rgba(56,189,248,0.55)'
                    : undefined,
                cursor: isRackInternal ? 'not-allowed' : 'crosshair',
              }}
            />
            <Handle
              type="source"
              id={port.id}
              position={pos}
              // v7.9.128 — Overlay-Handle NICHT connectable. Vorher waren
              // beide Stacked-Handles fuer ReactFlow connectable und
              // teilten dieselbe handleId — die (nodeId, handleId)-
              // Registry konnte den Drop nicht eindeutig aufloesen,
              // onConnect feuerte mal nicht. Mit ConnectionMode.Loose
              // genuegt das real-Handle alleine fuer beide Richtungen,
              // das Overlay ist nur noch da damit Klicks UND Drags
              // ueber den ganzen Port-Hit-Bereich gehen (onClick laeuft
              // weiterhin unabhaengig vom isConnectable-Flag).
              isConnectable={false}
              onClick={handlePortClick(port.id, 'input')}
              style={{
                top: rowCenter(placement.slot),
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: 'transparent',
                border: 'none',
              }}
            />
          </Fragment>
        )
      })}

      {/* Outputs */}
      {data.outputs.map((port, index) => {
        const placement = outputPlacement.get(port.id) ?? { side: 'right' as const, slot: index }
        const top = headerHeight + placement.slot * PORT_ROW
        const side = placement.side
        const isLeft = side === 'left'
        const isHovered = hoveredPort === `out-${port.id}`
        const isActive = isPendingStart(port.id, 'output')
        const isRackInternal = (rackInternalPortIds?.has(port.id) ?? false) || !!port.rackInternallyConnected
        const isPlugged = pluggedPortIds?.has(port.id) ?? false
        return (
          <div
            key={port.id}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handlePortClick(port.id, 'output')}
            onMouseEnter={() => setHoveredPort(`out-${port.id}`)}
            onMouseLeave={() => setHoveredPort(null)}
            role="button"
            tabIndex={isProjectLocked || isRackInternal ? -1 : 0}
            onKeyDown={handlePortKeyDown(port.id, 'output')}
            aria-label={`${port.name} · ${port.connectorType} — ${t('eqNode.portConnectHint', 'Enter verbindet')}`}
            style={{
              position: 'absolute',
              top,
              ...(isLeft ? { left: 0 } : { right: 0 }),
              width: '50%',
              height: PORT_ROW,
              ...(isLeft
                ? { paddingLeft: 14, paddingRight: 4 }
                : { paddingRight: 14, paddingLeft: 4 }),
              display: 'flex',
              alignItems: 'center',
              justifyContent: isLeft ? 'flex-start' : 'flex-end',
              textAlign: isLeft ? 'left' : 'right',
              fontSize: portLabelFontSize,
              cursor: isRackInternal ? 'not-allowed' : 'crosshair',
              opacity: isRackInternal ? 0.55 : 1,
              borderRadius: 3,
              background: isActive
                ? 'rgba(251,191,36,0.15)'
                : isHovered
                  ? 'rgba(34,197,94,0.12)'
                  : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <span
              title={
                isRackInternal
                  ? format(t('eqNode.portRackInternal', '{port} · {type} — Rack-intern verkabelt'), { port: port.name, type: port.connectorType })
                  : isPlugged
                    ? format(t('eqNode.portPluggedOnSite', '{port} · {type} — vor Ort gesteckt'), { port: port.name, type: port.connectorType })
                    : `${port.name} · ${port.connectorType}`
              }
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}
            >
              {isPlugged && (
                <span
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    clearPortCheck(id, port.id)
                  }}
                  style={{
                    marginRight: 3,
                    color: '#10b981',
                    fontWeight: 700,
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    // #503 — Wrapper als inline-flex (wie Lock/Headphones), sonst
                    // sitzt das lucide-Check-SVG auf der Baseline und macht das
                    // Port-Label 2-zeilig (Sprung). align-middle hält es 1-zeilig.
                    display: 'inline-flex',
                    alignItems: 'center',
                    verticalAlign: 'middle',
                  }}
                  title={t('eqNode.mobileChecked', 'Vor Ort gesteckt (Mobile-Viewer) — Klick entfernt den Haken')}
                  aria-label={t('eqNode.mobileChecked', 'Vor Ort gesteckt (Mobile-Viewer) — Klick entfernt den Haken')}
                >
                  <Icon icon={Check} size="xs" />
                </span>
              )}
              {isRackInternal && <span style={{ marginRight: 3 }} className="inline-flex align-middle"><Icon icon={Lock} size="xs" /></span>}
              {isLeft ? (
                <>{portDisplayLabel(port)}<span style={{ color: isLight ? '#94a3b8' : '#64748b' }}> · {port.connectorType}{genderSymbol(port.gender) && ` ${genderSymbol(port.gender)}`}</span></>
              ) : (
                <><span style={{ color: isLight ? '#94a3b8' : '#64748b' }}>{genderSymbol(port.gender) && `${genderSymbol(port.gender)} `}{port.connectorType} · </span>{portDisplayLabel(port)}</>
              )}
            </span>
          </div>
        )
      })}
      {data.outputs.map((port, index) => {
        const bi = port.direction === 'bidirectional'
        const isStart = isPendingStart(port.id, 'output')
        const placement = outputPlacement.get(port.id) ?? { side: 'right' as const, slot: index }
        const side = placement.side
        const pos = side === 'left' ? Position.Left : Position.Right
        const dotColor = colorPortsByType
          ? colorForConnector(port.connectorType, connectorTypeColors)
          : (bi ? '#a855f7' : '#22c55e')
        const isHoveredEndpoint = hoveredEndpointPortIds?.has(port.id) ?? false
        const isRackInternal = (rackInternalPortIds?.has(port.id) ?? false) || !!port.rackInternallyConnected
        return (
          <Fragment key={`h-out-${port.id}`}>
            <Handle
              type="source"
              id={port.id}
              position={pos}
              isConnectable={!isRackInternal}
              onClick={handlePortClick(port.id, 'output')}
              style={{
                top: rowCenter(placement.slot),
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: isRackInternal ? (isLight ? '#cbd5e1' : '#475569') : dotColor,
                opacity: isRackInternal ? 0.65 : 1,
                border: isStart
                  ? '2px solid #fbbf24'
                  : isHoveredEndpoint
                    ? '2px solid #38bdf8'
                    : `2px solid ${isLight ? '#e2e8f0' : '#0f172a'}`,
                boxShadow: isStart
                  ? '0 0 0 3px rgba(251,191,36,0.45)'
                  : isHoveredEndpoint
                    ? '0 0 0 3px rgba(56,189,248,0.55)'
                    : undefined,
                cursor: isRackInternal ? 'not-allowed' : 'crosshair',
              }}
            />
            <Handle
              type="target"
              id={port.id}
              position={pos}
              // v7.9.128 — siehe Input-Overlay oben: nicht-connectable
              // damit ReactFlow's Drag-Detection eindeutig auf das
              // real-Handle faellt. Click-Handler bleibt aktiv.
              isConnectable={false}
              onClick={handlePortClick(port.id, 'output')}
              style={{
                top: rowCenter(placement.slot),
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                background: 'transparent',
                border: 'none',
              }}
            />
          </Fragment>
        )
      })}

      {/* v7.9.9 — Black-Box-Rack Internal-Wiring-Overlay. Wenn das Item
          aus "Black-Box-Einfügen" stammt und einen rackInternalSnapshot
          hat, zeichnen wir die internen Verbindungen als gestrichelte
          Linien zwischen den HE-Slots im Body. So sieht der User auf
          dem Canvas was im Rack passiert.

          v7.9.10 — Pro Gerät bekommt jeder beteiligte Port-Name einen
          eigenen Slot entlang der Geräte-Höhe. Vorher landeten alle
          Kabel-Enden auf dem gleichen Punkt (Geräte-Center), was bei
          mehreren Kabeln pro Gerät zu Stack-Overlap führte. Jetzt wird
          jeder Port als eigener Anschlusspunkt mit kleinem Label
          ausgegeben — der User sieht welcher Port welche Verbindung
          trägt. */}
      {/* v7.9.17 — Internal-Wiring-Overlay verbindet jetzt REALE
          Port-Handles statt Stubs. Vorher waren die internen Ports
          gefiltert (nicht sichtbar) und die Kabel landeten auf
          symbolischen Punkten im rechten Viertel — daraus war für
          den User nicht ersichtlich welcher Port wohin geht.
          Jetzt:
          1) Die ports stehen alle sichtbar im Black-Box (intern
             ausgegraut + locked, extern voll),
          2) die Kabel-Curves gehen direkt von Port-Handle-Position
             zur anderen Port-Handle-Position, in Cable-Farbe und mit
             Hover-Title.
          So sieht der User auf einen Blick: "Output X von Device A
          geht intern an Input Y von Device B". */}
      {isRackBlackBox && rackBands.length > 0 && data.rackInternalSnapshot && data.rackInternalSnapshot.cables.length > 0 && (
        (() => {
          const snap = data.rackInternalSnapshot
          // (deviceIndex, originPortName) → portId
          const portIdByDeviceAndName = new Map<string, string>()
          for (const p of [...data.inputs, ...data.outputs]) {
            if (p.rackOriginDeviceIndex == null || !p.rackOriginPortName) continue
            portIdByDeviceAndName.set(
              `${p.rackOriginDeviceIndex}:${p.rackOriginPortName}`,
              p.id,
            )
          }
          const allPlacements = new Map<string, { side: 'left' | 'right'; slot: number }>()
          for (const [id, pl] of inputPlacement) allPlacements.set(id, pl)
          for (const [id, pl] of outputPlacement) allPlacements.set(id, pl)
          // v7.9.18 — Port-Handle-Position exakt auf der Karten-Kante
          // (x=0 left / x=width right, y=rowCenter), damit Kabel-Linien
          // an den ReactFlow-Handles ankern.
          const cables: BlackBoxCable[] = []
          for (let ci = 0; ci < snap.cables.length; ci++) {
            const c = snap.cables[ci]
            const fromId = portIdByDeviceAndName.get(`${c.fromItemIndex}:${c.fromPortName}`)
            const toId = portIdByDeviceAndName.get(`${c.toItemIndex}:${c.toPortName}`)
            if (!fromId || !toId) continue
            const aPl = allPlacements.get(fromId)
            const bPl = allPlacements.get(toId)
            if (!aPl || !bPl) continue
            cables.push({
              key: String(ci),
              ax: aPl.side === 'left' ? 0 : width,
              ay: headerHeight + aPl.slot * PORT_ROW + PORT_ROW / 2,
              aSide: aPl.side,
              bx: bPl.side === 'left' ? 0 : width,
              by: headerHeight + bPl.slot * PORT_ROW + PORT_ROW / 2,
              bSide: bPl.side,
              color: c.color ?? '#94a3b8',
              label: `${t('eqNode.internalPrefix', 'Intern')}: ${snap.items[c.fromItemIndex]?.name ?? '?'}:${c.fromPortName} ↔ ${snap.items[c.toItemIndex]?.name ?? '?'}:${c.toPortName}`,
            })
          }
          return (
            <RackInternalCablesOverlay
              cables={cables}
              width={width}
              isLight={isLight}
            />
          )
        })()
      )}

      {/* Legacy-Fallback (alte Black-Boxes ohne Origin-Marker): zeichne
          das HE-Slot-SVG-Overlay wie früher. */}
      {!isRackBlackBox && data.rackInternalSnapshot && data.rackInternalSnapshot.cables.length > 0 && (
        (() => {
          const snap = data.rackInternalSnapshot
          const innerTop = headerHeight + 4
          const innerBottom = height - 6
          const innerH = Math.max(20, innerBottom - innerTop)
          const innerW = Math.max(40, width - 24)
          const innerLeft = 12
          const HE_HEIGHT = innerH / Math.max(1, snap.totalUnits)

          // v7.9.10 — Sammle alle Port-Namen pro Gerät (in Reihenfolge
          // ihres ersten Auftauchens in den Cables) damit jeder Port
          // eine stabile vertikale Position innerhalb des Geräte-
          // Rechtecks bekommt.
          const portSlotsByItem = new Map<number, string[]>()
          for (const c of snap.cables) {
            if (!portSlotsByItem.has(c.fromItemIndex)) portSlotsByItem.set(c.fromItemIndex, [])
            if (!portSlotsByItem.has(c.toItemIndex)) portSlotsByItem.set(c.toItemIndex, [])
            const fromList = portSlotsByItem.get(c.fromItemIndex)!
            if (!fromList.includes(c.fromPortName)) fromList.push(c.fromPortName)
            const toList = portSlotsByItem.get(c.toItemIndex)!
            if (!toList.includes(c.toPortName)) toList.push(c.toPortName)
          }

          const portSlotY = (itemIdx: number, portName: string): number => {
            const item = snap.items[itemIdx]
            if (!item) return innerTop + innerH / 2
            const itemTop = innerTop + (item.startUnit - 1) * HE_HEIGHT
            const itemH = item.rackUnits * HE_HEIGHT
            const slots = portSlotsByItem.get(itemIdx) ?? [portName]
            const idx = Math.max(0, slots.indexOf(portName))
            const count = slots.length
            // Nutze die mittleren 80 % der Geräte-Höhe, mit gleichem
            // Abstand zwischen den Slots. Bei einem einzigen Slot
            // landen wir in der Mitte.
            if (count <= 1) return itemTop + itemH / 2
            const usable = itemH * 0.8
            const startY = itemTop + itemH * 0.1
            return startY + (idx / (count - 1)) * usable
          }

          // x-Position der Port-Stub-Punkte: rechts in der Gerätekarte,
          // mit dezentem Hinausragen damit die Bezier-Kurven Luft haben.
          const stubX = innerLeft + innerW - 4

          return (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
            >
              <rect
                x={innerLeft - 2}
                y={innerTop - 2}
                width={innerW + 4}
                height={innerH + 4}
                fill="none"
                stroke={isLight ? 'rgba(100,116,139,0.3)' : 'rgba(148,163,184,0.25)'}
                strokeWidth={0.5}
                rx={3}
              />
              {snap.items.map((item, idx) => {
                const top = innerTop + (item.startUnit - 1) * HE_HEIGHT
                const h = item.rackUnits * HE_HEIGHT
                const labelFontSize = Math.min(8, Math.max(6, h * 0.45))
                return (
                  <g key={`rack-item-${idx}`}>
                    <rect
                      x={innerLeft}
                      y={top}
                      width={innerW}
                      height={h - 1}
                      fill={isLight ? 'rgba(100,116,139,0.10)' : 'rgba(71,85,105,0.30)'}
                      stroke={isLight ? 'rgba(100,116,139,0.30)' : 'rgba(148,163,184,0.30)'}
                      strokeWidth={0.5}
                    />
                    {/* v7.9.10 — Geräte-Name im Slot, damit der User
                        sieht zu welchem Gerät die Port-Stubs gehören. */}
                    <text
                      x={innerLeft + 3}
                      y={top + Math.min(h - 1, labelFontSize + 2)}
                      fill={isLight ? '#334155' : '#cbd5e1'}
                      fontSize={labelFontSize}
                      fontWeight={600}
                      style={{ pointerEvents: 'none' }}
                    >
                      {item.name.length > 18 ? `${item.name.slice(0, 17)}…` : item.name}
                    </text>
                  </g>
                )
              })}
              {/* Port-Stubs pro Gerät + Port-Namen-Labels */}
              {Array.from(portSlotsByItem.entries()).map(([itemIdx, ports]) =>
                ports.map((portName, slotIdx) => {
                  const y = portSlotY(itemIdx, portName)
                  return (
                    <g key={`stub-${itemIdx}-${slotIdx}`}>
                      <circle
                        cx={stubX}
                        cy={y}
                        r={1.8}
                        fill={isLight ? '#334155' : '#94a3b8'}
                      />
                      <text
                        x={stubX - 4}
                        y={y + 2}
                        fill={isLight ? '#475569' : '#94a3b8'}
                        fontSize={6}
                        textAnchor="end"
                        style={{ pointerEvents: 'none' }}
                      >
                        {portName.length > 10 ? `${portName.slice(0, 9)}…` : portName}
                      </text>
                    </g>
                  )
                }),
              )}
              {/* Cables verbinden jetzt Port-Stub → Port-Stub statt
                  Geräte-Center → Geräte-Center. Die seitliche Bezier-
                  Kurve geht nach rechts aus der Karte raus und wieder
                  rein, damit die Linien klar erkennbar bleiben. */}
              {snap.cables.map((c, ci) => {
                const y1 = portSlotY(c.fromItemIndex, c.fromPortName)
                const y2 = portSlotY(c.toItemIndex, c.toPortName)
                const x1 = stubX
                const x2 = stubX
                const bulge = innerW * 0.18 + Math.min(12, Math.abs(y2 - y1) * 0.15)
                const midX = x1 + bulge
                const color = c.color ?? (isLight ? '#0369a1' : '#38bdf8')
                return (
                  <path
                    key={`internal-cable-${ci}`}
                    d={`M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.2}
                    strokeDasharray="3 2"
                    opacity={0.85}
                  />
                )
              })}
            </svg>
          )
        })()
      )}
    </div>
  )
}

