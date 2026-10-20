// Semantic resolver: turns the neutral GraphmlDocument from parser.ts
// into cable-planner's domain model (EquipmentItem + Cable). Handles the
// two real-world yEd conventions we verified against actual files:
//
//   1. INSTALLATION DIAGRAM: top-level ShapeNodes for devices, and
//      separate sibling ShapeNodes positioned visually inside each
//      device's bounding box for the ports. (Missionswerk_VOH file.)
//
//   2. TEMPLATE LIBRARY: a few category GroupNodes at the top, each
//      with nested device sub-nodes that themselves contain port
//      child-nodes. (Standardgeräte file.)
//
// The resolver picks one strategy per top-level subgraph based on the
// shape mix it sees, then in both cases produces the same output shape:
// a list of ResolvedDevice with ResolvedPort children, plus
// ResolvedCable entries that connect specific port IDs.

import type { ConnectorType, Port } from '../../types/equipment'
import { inferConnectorType, inferDirection } from './connectorInference'
import type {
  GraphmlDocument,
  GraphmlEdge,
  GraphmlGeometry,
  GraphmlNode,
} from './types'

export interface ResolvedPort {
  /** Stable id we generate for the cable-planner Port (uuid-free here so
   *  re-imports keep the same identity; the store assigns the real uuid
   *  during import). Composite of "device-graphmlId|port-graphmlId". */
  importKey: string
  /** Original GraphML node id ("n1::n3", or "" for synthetic ports). */
  graphmlId: string
  name: string
  connectorType: ConnectorType
  direction: 'in' | 'out' | 'bidirectional'
  /** Original label text (verbatim, before connector matching). */
  rawLabel: string
  /** 0..1 — how confident the connector inference is. */
  confidence: number
  /** Signal carried, from the function cell next to the port ("Cam 1",
   *  "ME1 IMAG"). Becomes Port.contentLabel. */
  signal?: string
}

export type DeviceCategory = string

export interface ResolvedDevice {
  /** Stable composite import key used to de-duplicate on re-import. */
  importKey: string
  /** Original GraphML node id of the device's primary node. */
  graphmlId: string
  name: string
  subtitle: string | null
  ipAddress: string | null
  category: DeviceCategory
  inputs: ResolvedPort[]
  outputs: ResolvedPort[]
  position: { x: number; y: number }
  size: { width: number; height: number } | null
  fillColor: string | null
  /** Additional semantic data carried over verbatim (DeviceType,
   *  DeviceGroup, Supplier, Function, …). */
  rawData: Record<string, string>
  /** How confident the resolver is about this device — see classify(). */
  confidence: 'high' | 'medium' | 'low'
  /** Optional human note about why confidence is not high. */
  notes: string[]
}

export interface ResolvedCable {
  /** Composite stable id ("graphml-edge:<edgeId>"). */
  importKey: string
  graphmlEdgeId: string
  sourceDeviceImportKey: string
  sourcePortImportKey: string
  targetDeviceImportKey: string
  targetPortImportKey: string
  /** Picked from edge data CableType first, falling back to the connector
   *  type inferred from the source port. */
  inferredCableType: ConnectorType
  /** Verbatim cable type string from the edge (e.g. "OS2", "Coax-75"). */
  rawCableType: string | null
  videoStandard: string | null
  signalName: string | null
  cableLengthMeters: number | null
  rawData: Record<string, string>
  lineColor: string | null
  /** Cables whose source/target couldn't be resolved are still kept here
   *  so the UI can surface them; orphan = true means at least one end
   *  doesn't map to an imported device. */
  orphan: boolean
  /** Polyline bend points the user drew in yEd between source and
   *  target, in absolute flow coordinates. Carried verbatim from the
   *  parsed edge — without these the cable-planner canvas auto-routes
   *  and the import no longer looks like the source diagram. */
  waypoints: { x: number; y: number }[]
}

export interface ImportPreview {
  devices: ResolvedDevice[]
  cables: ResolvedCable[]
  unresolvedEdges: GraphmlEdge[]
  /** GraphmlNodes the resolver chose not to import (purely visual
   *  artifacts: legends, titles, decorative shapes). */
  skippedNodes: Array<{ id: string; reason: string }>
  /** Source document metadata — surfaced in the import dialog header. */
  meta: {
    fileSize: number
    nodeCount: number
    edgeCount: number
    description: string | null
  }
}

// (The old strict `contains` helper was replaced by distanceToRect once
// we learned that real yEd files attach port shapes adjacent to the
// device's bbox rather than strictly inside it.)

const center = (g: GraphmlGeometry) => ({
  x: g.x + g.width / 2,
  y: g.y + g.height / 2,
})

/** Distance from point p to the nearest edge of rect r. 0 if inside. */
const distanceToRect = (r: GraphmlGeometry, p: { x: number; y: number }) => {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.width))
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.height))
  return Math.sqrt(dx * dx + dy * dy)
}

/** A node is "port-sized" if its area is small relative to a typical
 *  device rectangle. Empirically yEd ports drawn by hand are 20-90 px
 *  wide and 15-30 px tall; device rectangles in the real files are
 *  ≥100 px wide AND simultaneously big in area. The cap is generous
 *  here because some venues use larger port shapes for clarity. */
const isPortShaped = (g: GraphmlGeometry | null) => {
  if (!g) return false
  const area = g.width * g.height
  return area <= 6000 && g.width <= 200 && g.height <= 50
}

/** A node is "label-shaped" if it's small, has visible text, and looks
 *  like a free-floating text annotation rather than a port shape. We
 *  treat ports separately (filled rectangles next to the device edge);
 *  label-shaped nodes are usually wider than tall (text runs sideways)
 *  and frequently have no fill color OR a near-transparent fill, since
 *  yEd's default text-tool produces that. We accept both because some
 *  templates do paint a light backdrop behind port names. */
const isLabelShaped = (n: GraphmlNode): boolean => {
  if (!n.geometry) return false
  if (n.labels.every((l) => !l.text.trim())) return false
  const { width, height } = n.geometry
  // Labels are typically narrower than 200 px (~12-15 chars) and short
  // in height. The check is generous: a single line of 10pt text in
  // yEd lands around 16-18 px tall, a 14pt one around 22 px.
  if (height > 40) return false
  if (width > 240) return false
  // Wide-and-short bias: ratio at least 1.3 distinguishes text from a
  // square port marker. Very narrow nodes (numeric port labels like
  // "1", "2") still pass because the geometry is small enough overall.
  const ratio = width / Math.max(height, 1)
  if (width >= 30 && ratio < 1.2) return false
  return true
}

/** A device rectangle is large enough to contain ports (≥160×80) AND has
 *  at least one non-empty visual label. */
const looksLikeDeviceRect = (n: GraphmlNode) => {
  if (!n.geometry) return false
  const big = n.geometry.width >= 160 || n.geometry.height >= 80
  const hasLabel = n.labels.some((l) => l.text.trim().length > 0)
  return big && hasLabel
}

/** Decorative shapes we deliberately skip: legends, headings, title
 *  blocks. Identified by the presence of a recognisable section
 *  keyword in the main label and zero edges incident on them. */
const DECORATIVE_LABELS = /^(Legende|Titel|Legend|Title|Header|Footer|Index|Datum|Autor|Auftraggeber|Kunde)$|^(Kabel|Signal|Farb)?legende\b|^(cable |signal |colou?r )?legend\b/i

const looksDecorative = (n: GraphmlNode) => {
  const main = n.labels[0]?.text.trim()
  return !!main && DECORATIVE_LABELS.test(main)
}

/** Pick the IP-address-looking label out of a device's label set, in
 *  display order. Tolerates "IP:", "IP-Adresse:", "Address:" prefixes. */
const extractIp = (labels: GraphmlNode['labels']): string | null => {
  for (const l of labels) {
    const t = l.text.trim()
    const m = /\b(?:ip(?:[-\s]?addr(?:ess|esse)?)?|address)\s*[:=]\s*([0-9a-fxA-FX.]+)/i.exec(t)
    if (m) return m[1]
    // Bare dotted-quad (or x.x.x.x placeholder) without prefix.
    if (/^[0-9]{1,3}(\.[0-9]{1,3}){3}$/.test(t)) return t
    if (/^x{2,3}(\.x{2,3}){3}$/i.test(t)) return t
  }
  return null
}

const extractCableLength = (raw: string | null): number | null => {
  if (!raw) return null
  // Pull the first number that looks like a length in metres.
  const m = /([\d.,]+)\s*m\b/i.exec(raw) ?? /([\d.,]+)/.exec(raw)
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

interface DeviceCandidate {
  node: GraphmlNode
  portNodes: GraphmlNode[]
}

/** Floating "port-name" labels: small text nodes the yEd user dropped
 *  next to a port shape to name it ("SDI 1", "AES Out 4", "PGM"). The
 *  resolver maps each such label to the closest port across all
 *  devices, within a generous proximity radius. Returns a map keyed by
 *  port node id, with the label text to graft onto the port. The
 *  matched label nodes' IDs are added to `consumedLabelIds` so the
 *  resolver doesn't surface them as "skipped — unattached". */
const associateFloatingPortLabels = (
  candidates: DeviceCandidate[],
  topNodes: GraphmlNode[],
  consumedLabelIds: Set<string>,
): Map<string, string> => {
  const portIds = new Set<string>()
  const portCenters = new Map<string, { x: number; y: number; node: GraphmlNode }>()
  for (const c of candidates) {
    for (const p of c.portNodes) {
      if (!p.geometry) continue
      portIds.add(p.id)
      portCenters.set(p.id, { ...center(p.geometry), node: p })
    }
  }

  // Candidate label-nodes: small text-shaped nodes that are NOT already
  // a recognised port and NOT a recognised device. Empty labels also
  // disqualify them.
  const labelNodes = topNodes.filter((n) => {
    if (portIds.has(n.id)) return false
    if (candidates.some((c) => c.node.id === n.id)) return false
    if (!isLabelShaped(n)) return false
    return true
  })

  // Adjacency radius scales with port size — for tiny BNC port markers
  // (20×20 px) labels usually sit within ~40 px; for big PowerCON
  // labels (~80×30 px) the user may place them up to ~80 px away.
  const baseRadius = 50

  const result = new Map<string, string>()
  for (const label of labelNodes) {
    if (!label.geometry) continue
    const lc = center(label.geometry)
    let bestPortId: string | null = null
    let bestScore = Infinity
    for (const [portId, pc] of portCenters) {
      const dx = lc.x - pc.x
      const dy = lc.y - pc.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const portRadius = Math.max(
        pc.node.geometry ? Math.max(pc.node.geometry.width, pc.node.geometry.height) : 30,
        30,
      )
      const radius = baseRadius + portRadius
      if (dist > radius) continue
      // Prefer the closer port; ties broken by smaller port (labels
      // usually annotate the nearest small marker, not the big device).
      const score = dist
      if (score < bestScore) {
        bestPortId = portId
        bestScore = score
      }
    }
    if (bestPortId) {
      const text = label.labels.map((l) => l.text.trim()).filter(Boolean).join(' ').trim()
      if (text) {
        const existing = result.get(bestPortId)
        // If two labels match the same port (rare: e.g. signal name +
        // connector type both floating), join them with " — ".
        result.set(bestPortId, existing ? `${existing} — ${text}` : text)
        consumedLabelIds.add(label.id)
      }
    }
  }
  return result
}

/** Gap (px) under which two rectangles count as touching. yEd's grid
 *  snap leaves sub-pixel seams between cells drawn edge to edge. */
const TOUCH_GAP_PX = 3

/** Distance between two rectangles (0 when they touch or overlap). */
const rectGap = (a: GraphmlGeometry, b: GraphmlGeometry) => {
  const dx = Math.max(a.x - (b.x + b.width), 0, b.x - (a.x + a.width))
  const dy = Math.max(a.y - (b.y + b.height), 0, b.y - (a.y + a.height))
  return Math.sqrt(dx * dx + dy * dy)
}

/** Table header cells ("Type | Func. | Input | Source | Dest") that
 *  name a column instead of a port or signal. */
const HEADER_LABELS = /^(type|typ|func\.?|function|funktion|input|output|in|out|source|quelle|dest|destination|ziel|signal|position|port|anschluss|nr\.?|#)$/i

const mainText = (n: GraphmlNode) => n.labels.map((l) => l.text.trim()).filter(Boolean).join(' ')

/** A device body must be a real block, not a one-line caption (179×20
 *  "Hyperdeck 1 Oben Links") or a vertical bracket (20×80 "HD Out"). */
const DOTTED_QUAD = /\b\d{1,3}(?:\.\d{1,3}){3}\b/

/** "Net. 192.168.5.21" cells annotate a device; they are never one. */
const isIpCell = (n: GraphmlNode) => DOTTED_QUAD.test(mainText(n)) && mainText(n).length <= 32

const looksLikeDeviceBody = (n: GraphmlNode) => {
  if (!n.geometry || isIpCell(n) || HEADER_LABELS.test(mainText(n))) return false
  const { width, height } = n.geometry
  if (looksLikeDeviceRect(n) && width >= 100 && height >= 40) return true
  // Vertical name strip along a device's side ("Kamerazug DOLLY /
  // Blackmagic URSA Broadcast G2", 40×260): the device's only label.
  return mainText(n).length >= 6 && width >= 30 && height >= 80 && height >= width * 1.5
}

/** Pattern 1: spatial inference for flat installation diagrams.
 *
 *  Real yEd plans draw a device as a body rectangle plus a column of
 *  small cells per side: connector cells ("3G/SDI In 1") hang OUTSIDE
 *  the body, touching its edge, and function cells ("Cam 1") sit inside
 *  or next to them in the same row. Some devices are drawn as a whole
 *  table (Videohub: Input | Source | Signal | Dest) with the body only a
 *  caption block under it. Port cells therefore are not necessarily
 *  near the body's centre — what holds is that they are part of one
 *  contiguous patch of touching cells that also touches the body.
 *
 *  1. Cells (small nodes) are grouped into clusters of touching rects;
 *     every device body touching a cluster joins it.
 *  2. A port is a cell that some edge ends on, or a connector-looking
 *     cell in the same column as such a port (unused inputs of a matrix).
 *  3. Each port goes to the nearest body of its cluster, or to the
 *     nearest body overall within a small radius when it floats.
 *  4. The non-port, non-header cell nearest in the same row becomes the
 *     port's signal label (contentLabel). */
const collectFlatCandidates = (
  topNodes: GraphmlNode[],
  edges: GraphmlEdge[],
): {
  candidates: DeviceCandidate[]
  portToDevice: Map<string, string>
  rowLabels: Map<string, string>
  consumed: Set<string>
  ownerOfNode: Map<string, string>
  ipByDevice: Map<string, string>
  subtitleOf: Map<string, string>
} => {
  const devices = topNodes.filter((n) => looksLikeDeviceBody(n) && !looksDecorative(n))
  const deviceIds = new Set(devices.map((d) => d.id))
  // Cells: everything small, plus unlabeled frames (the empty 80×440
  // strip of a patch panel, the 160×170 body behind a computer's name
  // strip) — those carry no meaning of their own but connect the cells
  // around them, and cables are sometimes drawn onto them.
  const cells = topNodes.filter(
    (n) =>
      !!n.geometry &&
      !deviceIds.has(n.id) &&
      !looksDecorative(n) &&
      n.geometry.width <= 260 &&
      (n.geometry.height <= 60 || !mainText(n)),
  )

  const endpointIds = new Set<string>()
  for (const e of edges) {
    endpointIds.add(e.sourceId)
    endpointIds.add(e.targetId)
  }

  // Union-find over cells + devices. Devices never merge with each
  // other directly — two bodies drawn side by side stay two devices.
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let r = id
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(id, r)
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  for (const n of [...cells, ...devices]) parent.set(n.id, n.id)
  // Bucket cells on a coarse grid so the pairwise touch test stays
  // linear-ish on 1000+ node plans.
  const BUCKET = 200
  const buckets = new Map<string, GraphmlNode[]>()
  const keysFor = (g: GraphmlGeometry) => {
    const out: string[] = []
    for (let bx = Math.floor((g.x - TOUCH_GAP_PX) / BUCKET); bx <= Math.floor((g.x + g.width + TOUCH_GAP_PX) / BUCKET); bx += 1) {
      for (let by = Math.floor((g.y - TOUCH_GAP_PX) / BUCKET); by <= Math.floor((g.y + g.height + TOUCH_GAP_PX) / BUCKET); by += 1) {
        out.push(`${bx}:${by}`)
      }
    }
    return out
  }
  for (const c of cells) {
    for (const k of keysFor(c.geometry!)) {
      const list = buckets.get(k)
      if (list) list.push(c)
      else buckets.set(k, [c])
    }
  }
  for (const c of cells) {
    for (const k of keysFor(c.geometry!)) {
      for (const o of buckets.get(k) ?? []) {
        if (o.id <= c.id) continue
        if (rectGap(c.geometry!, o.geometry!) <= TOUCH_GAP_PX) union(c.id, o.id)
      }
    }
  }
  const devicesByCluster = new Map<string, GraphmlNode[]>()
  for (const d of devices) {
    for (const k of keysFor(d.geometry!)) {
      for (const c of buckets.get(k) ?? []) {
        if (rectGap(c.geometry!, d.geometry!) <= TOUCH_GAP_PX) union(c.id, d.id)
      }
    }
  }
  const isHeader = (n: GraphmlNode) => HEADER_LABELS.test(mainText(n))
  const portIds = new Set<string>()
  for (const c of cells) {
    if (endpointIds.has(c.id) && !isHeader(c) && mainText(c) && c.geometry!.height <= 60) portIds.add(c.id)
  }

  // Clusters with cabled cells but no body: small boxes drawn at cell
  // size (a 96×40 converter, a 140×40 LED controller, a lone 164×20
  // "BenqPD3200u" monitor). The biggest labelled non-port cell is the
  // device; failing that, the cabled cell itself stands for the device.
  {
    const groups = new Map<string, GraphmlNode[]>()
    for (const c of cells) {
      const r = find(c.id)
      const list = groups.get(r)
      if (list) list.push(c)
      else groups.set(r, [c])
    }
    const rootsWithDevice = new Set(devices.map((d) => find(d.id)))
    for (const [root, members] of groups) {
      if (rootsWithDevice.has(root)) continue
      if (!members.some((m) => endpointIds.has(m.id))) continue
      const area = (n: GraphmlNode) => n.geometry!.width * n.geometry!.height
      const body =
        members
          .filter((m) => !portIds.has(m.id) && mainText(m) && !isHeader(m) && !isIpCell(m) && !/^tba$/i.test(mainText(m)))
          .sort((a, b) => area(b) - area(a))[0] ??
        (members.length === 1 ? members[0] : null)
      if (!body) continue
      portIds.delete(body.id)
      devices.push(body)
      deviceIds.add(body.id)
    }
  }

  // Two "devices" in one drawing:
  //  - a caption box sitting inside a computer's empty frame
  //    ("ProPresenter 7 / LED Background" inside the Mac mini) is the
  //    software running there, not a second box;
  //  - a body overlapped by a vertical name strip is that strip's
  //    device (the strip names it; the body's own text is kept as
  //    subtitle).
  const subtitleOf = new Map<string, string>()
  {
    const frames = cells.filter((c) => !mainText(c) && c.geometry!.height > 60)
    const inside = (a: GraphmlGeometry, b: GraphmlGeometry) =>
      a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.width <= b.x + b.width + 1 && a.y + a.height <= b.y + b.height + 1
    const overlapArea = (a: GraphmlGeometry, b: GraphmlGeometry) =>
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
    const isStrip = (d: GraphmlNode) => d.geometry!.height >= d.geometry!.width * 1.5 && d.geometry!.width <= 60
    const demote = new Set<string>()
    for (const d of devices) {
      const frame = frames.find((f) => inside(d.geometry!, f.geometry!))
      if (!frame) continue
      const other = devices.find((o) => o !== d && !demote.has(o.id) && find(o.id) === find(frame.id) && !inside(o.geometry!, frame.geometry!))
      if (other) demote.add(d.id)
    }
    for (const strip of devices.filter(isStrip)) {
      for (const body of devices) {
        if (body === strip || isStrip(body) || demote.has(body.id)) continue
        if (overlapArea(strip.geometry!, body.geometry!) <= 0) continue
        demote.add(body.id)
        subtitleOf.set(strip.id, mainText(body).replace(/\s+/g, ' '))
      }
    }
    for (let i = devices.length - 1; i >= 0; i -= 1) {
      const d = devices[i]
      if (!demote.has(d.id)) continue
      devices.splice(i, 1)
      deviceIds.delete(d.id)
      cells.push(d)
      // Bodies never merged with other bodies; as a cell it now joins
      // everything it touches, the naming strip included.
      for (const o of [...cells, ...devices]) {
        if (o.id !== d.id && rectGap(d.geometry!, o.geometry!) <= TOUCH_GAP_PX) union(d.id, o.id)
      }
    }
  }

  // A device may have joined a cluster through any of its cells; group
  // the bodies per final root afterwards.
  for (const d of devices) {
    const r = find(d.id)
    const list = devicesByCluster.get(r)
    if (list) list.push(d)
    else devicesByCluster.set(r, [d])
  }

  // Same-column connector cells: unused inputs/outputs of a matrix.
  const columnKey = (g: GraphmlGeometry) => `${Math.round(g.x)}|${Math.round(g.width)}`
  // Cables drawn onto an empty strip or a body end at a row: the
  // labelled cell of the same patch at that height is the port.
  {
    const nodeById = new Map([...cells, ...devices].map((n) => [n.id, n]))
    const byRoot = new Map<string, GraphmlNode[]>()
    for (const c of cells) {
      if (!mainText(c) || isHeader(c) || isIpCell(c) || c.geometry!.height > 60) continue
      const r = find(c.id)
      const list = byRoot.get(r)
      if (list) list.push(c)
      else byRoot.set(r, [c])
    }
    const adopt = (nodeId: string, ox: number, oy: number) => {
      const n = nodeById.get(nodeId)
      if (!n || portIds.has(n.id) || (mainText(n) && !deviceIds.has(n.id))) return
      const c = center(n.geometry!)
      const pt = { x: c.x + ox, y: c.y + oy }
      let best: GraphmlNode | null = null
      let bestDist = 200
      for (const cell of byRoot.get(find(n.id)) ?? []) {
        if (cell.id === n.id || deviceIds.has(cell.id)) continue
        const g = cell.geometry!
        if (pt.y < g.y || pt.y > g.y + g.height) continue
        const dist = distanceToRect(g, pt)
        if (dist < bestDist) {
          best = cell
          bestDist = dist
        }
      }
      if (best) portIds.add(best.id)
    }
    for (const e of edges) {
      adopt(e.sourceId, e.pathOffset.sx, e.pathOffset.sy)
      adopt(e.targetId, e.pathOffset.tx, e.pathOffset.ty)
    }
  }

  // Uncabled rows of a port column are ports too (spare inputs of a
  // matrix, the second SDI out of a camera). One cabled cell is enough
  // for connector-looking text; free text needs two, so a lone network
  // cell does not turn the function column it sits in into ports.
  const columnHits = new Map<string, number>()
  for (const c of cells) {
    if (!portIds.has(c.id)) continue
    const k = `${find(c.id)}|${columnKey(c.geometry!)}|${Math.round(c.geometry!.height)}`
    columnHits.set(k, (columnHits.get(k) ?? 0) + 1)
  }
  const portColumns = new Set(columnHits.keys())
  for (const c of cells) {
    if (portIds.has(c.id) || deviceIds.has(c.id) || isHeader(c)) continue
    const k = `${find(c.id)}|${columnKey(c.geometry!)}|${Math.round(c.geometry!.height)}`
    if (!portColumns.has(k) || !mainText(c) || isIpCell(c)) continue
    if ((columnHits.get(k) ?? 0) >= 2 || inferConnectorType(mainText(c)).confidence >= 0.9) portIds.add(c.id)
  }

  const deviceMap = new Map<string, DeviceCandidate>(devices.map((d) => [d.id, { node: d, portNodes: [] }]))
  const portToDevice = new Map<string, string>()
  const FLOATING_RADIUS_PX = 40
  const nearestOf = (n: GraphmlNode, pool: GraphmlNode[]) => {
    let best: GraphmlNode | null = null
    let bestDist = Infinity
    for (const d of pool) {
      if (d.id === n.id) continue
      const dist = rectGap(n.geometry!, d.geometry!)
      if (dist < bestDist || (dist === bestDist && best && d.geometry!.width * d.geometry!.height < best.geometry!.width * best.geometry!.height)) {
        best = d
        bestDist = dist
      }
    }
    return best
  }
  // Every cluster member knows its device, so a cable drawn onto a
  // frame or a function cell still finds the right box.
  const ownerOfNode = new Map<string, string>()
  const ipByDevice = new Map<string, string>()
  for (const c of cells) {
    if (deviceIds.has(c.id)) continue
    const own = devicesByCluster.get(find(c.id))
    if (!own?.length) continue
    const owner = nearestOf(c, own)
    if (!owner) continue
    ownerOfNode.set(c.id, owner.id)
    const ip = isIpCell(c) ? DOTTED_QUAD.exec(mainText(c))?.[0] : undefined
    if (ip && !ipByDevice.has(owner.id)) ipByDevice.set(owner.id, ip)
  }
  for (const c of cells) {
    if (!portIds.has(c.id)) continue
    const own = devicesByCluster.get(find(c.id))
    const pool = own && own.length > 0 ? own : devices
    let best: GraphmlNode | null = null
    let bestDist = Infinity
    for (const d of pool) {
      const dist = rectGap(c.geometry!, d.geometry!)
      if (dist < bestDist || (dist === bestDist && best && d.geometry!.width * d.geometry!.height < best.geometry!.width * best.geometry!.height)) {
        best = d
        bestDist = dist
      }
    }
    if (!best) continue
    if (!own?.length && bestDist > FLOATING_RADIUS_PX) continue
    deviceMap.get(best.id)!.portNodes.push(c)
    portToDevice.set(c.id, best.id)
  }

  // Row labels: nearest labelled non-port cell in the same row and
  // cluster. Ties go toward the device body (inputs read rightwards,
  // outputs leftwards — the function column sits between port and body).
  const rowLabels = new Map<string, string>()
  const consumed = new Set<string>()
  const labelCells = cells.filter((c) => !portIds.has(c.id) && !deviceIds.has(c.id) && !isHeader(c) && !isIpCell(c) && mainText(c) && !/^tba$/i.test(mainText(c)))
  const labelsByCluster = new Map<string, GraphmlNode[]>()
  for (const c of cells) {
    if (devicesByCluster.has(find(c.id))) consumed.add(c.id)
  }
  for (const l of labelCells) {
    const r = find(l.id)
    const list = labelsByCluster.get(r)
    if (list) list.push(l)
    else labelsByCluster.set(r, [l])
  }
  for (const [portId, devId] of portToDevice) {
    const port = cells.find((c) => c.id === portId)!
    const pc = center(port.geometry!)
    const dc = center(deviceMap.get(devId)!.node.geometry!)
    let best: GraphmlNode | null = null
    let bestScore = Infinity
    for (const l of labelsByCluster.get(find(portId)) ?? []) {
      const lc = center(l.geometry!)
      if (Math.abs(lc.y - pc.y) > Math.min(port.geometry!.height, l.geometry!.height) / 2) continue
      const towardBody = Math.sign(lc.x - pc.x) === Math.sign(dc.x - pc.x)
      const score = Math.abs(lc.x - pc.x) + (towardBody ? 0 : 10000)
      if (score < bestScore) {
        best = l
        bestScore = score
      }
    }
    if (best) rowLabels.set(portId, mainText(best))
  }

  return { candidates: [...deviceMap.values()], portToDevice, rowLabels, consumed, ownerOfNode, ipByDevice, subtitleOf }
}

/** Pattern 2: nested-graph inference. Walks a single container group
 *  and treats its DIRECT child nodes as the devices; for each of those
 *  devices it looks one more level deep for its ports. */
const collectNestedCandidates = (
  doc: GraphmlDocument,
  containerId: string,
): { candidates: DeviceCandidate[]; portToDevice: Map<string, string> } => {
  const container = doc.nodes.find((n) => n.id === containerId)
  if (!container) return { candidates: [], portToDevice: new Map() }
  const directChildren = container.childIds
    .map((id) => doc.nodes.find((n) => n.id === id))
    .filter((n): n is GraphmlNode => !!n)

  const portToDevice = new Map<string, string>()
  const candidates: DeviceCandidate[] = []
  for (const dev of directChildren) {
    if (!looksLikeDeviceRect(dev) || looksDecorative(dev)) continue
    const ports = dev.childIds
      .map((id) => doc.nodes.find((n) => n.id === id))
      .filter((n): n is GraphmlNode => !!n && isPortShaped(n.geometry))
    for (const p of ports) portToDevice.set(p.id, dev.id)
    candidates.push({ node: dev, portNodes: ports })
  }
  return { candidates, portToDevice }
}

/** Convert a single device candidate into a ResolvedDevice, including
 *  every port. Edges are not wired here; cables() does that in a second
 *  pass once every device's ports have stable importKeys.
 *
 *  `floatingPortLabels` carries text from sibling label-nodes that the
 *  yEd user drew adjacent to a specific port shape — these win over the
 *  port's own (often empty) labels because the user clearly intended
 *  them as the port name. Falls back to the port's own label, then to
 *  "Port N". */
const buildResolvedDevice = (
  candidate: DeviceCandidate,
  category: DeviceCategory,
  edgeIncidenceByPort: Map<string, { asSource: number; asTarget: number }>,
  floatingPortLabels: Map<string, string>,
  rowLabels: Map<string, string> = new Map(),
): ResolvedDevice => {
  const dev = candidate.node
  const mainLabel = dev.labels.find((l) => !/^ip[:\s]/i.test(l.text))?.text.trim() ?? dev.labels[0]?.text.trim() ?? dev.id
  const subtitle = dev.labels
    .slice(1)
    .find((l) => l.text.trim() && !/^ip[:\s]/i.test(l.text) && l.text.trim() !== mainLabel)?.text.trim() ?? null
  const ip = extractIp(dev.labels)

  const inputs: ResolvedPort[] = []
  const outputs: ResolvedPort[] = []
  const notes: string[] = []

  const sortedPorts = [...candidate.portNodes].sort((a, b) => {
    // Sort top-to-bottom, then left-to-right so the device's visual
    // layout maps onto the input/output order in cable-planner.
    if (!a.geometry || !b.geometry) return 0
    if (Math.abs(a.geometry.y - b.geometry.y) > 5) return a.geometry.y - b.geometry.y
    return a.geometry.x - b.geometry.x
  })

  // Position-based fallback direction: the schematic convention in
  // every yEd installation diagram we tested is left-of-device = input,
  // right-of-device = output. Top / bottom go to in / out by default
  // too but with lower confidence; only used when the explicit data
  // field, the label text, AND edge incidence all yield nothing.
  const devCenter = dev.geometry ? center(dev.geometry) : null
  const inferDirectionByPosition = (port: GraphmlNode): 'in' | 'out' | null => {
    if (!devCenter || !port.geometry) return null
    const pc = center(port.geometry)
    const dx = pc.x - devCenter.x
    const dy = pc.y - devCenter.y
    // Pick the dominant axis to avoid ambiguous diagonal ports.
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx < 0 ? 'in' : 'out'
    }
    return dy < 0 ? 'in' : 'out'
  }

  for (const port of sortedPorts) {
    const ownLabel = port.labels.map((l) => l.text).join(' ').trim()
    const floating = floatingPortLabels.get(port.id) ?? ''
    // If a floating label exists, prefer it but keep the port's own
    // label as additional context (it sometimes carries connector type
    // info like "BNC"). Otherwise fall back to the port id.
    const rawLabel = floating
      ? (ownLabel && ownLabel !== floating ? `${floating} ${ownLabel}` : floating)
      : (ownLabel || port.id)
    // The Connector / SignalType data field is more authoritative than
    // the label text when present (templates put it there explicitly).
    const conn = inferConnectorType(
      port.data['Connector'],
      port.data['SignalType'],
      rawLabel,
    )
    const hint = edgeIncidenceByPort.get(port.id) ?? null
    let dir: 'in' | 'out' | 'bidirectional'
    if (port.data['Direction']) {
      const d = port.data['Direction'].toLowerCase()
      dir = d.startsWith('out') ? 'out' : d.startsWith('in') ? 'in' : 'bidirectional'
    } else if (
      hint &&
      (hint.asSource === 0) !== (hint.asTarget === 0) &&
      !(conn.confidence >= 0.9 && inferDirection(rawLabel, null) !== 'bidirectional')
    ) {
      // A drawn cable says more than a signal name: a Videohub output
      // cell is often labelled with its destination ("ATEM In 10").
      // A connector cell that states its direction ("3G/SDI Out") is
      // trusted over the arrow, which yEd users draw either way round.
      dir = hint.asSource > 0 ? 'out' : 'in'
    } else {
      dir = inferDirection(rawLabel, hint)
      if (dir === 'bidirectional') {
        const positional = inferDirectionByPosition(port)
        if (positional) dir = positional
      }
    }

    // Prefer a clean floating-label-only name for the port name field
    // (which the user sees on the canvas), keep the joined rawLabel for
    // inference. Trims connector noise from the visible name when it's
    // already represented by `connectorType`.
    const displayName =
      (floating || ownLabel || rawLabel || '').trim() ||
      `Port ${candidate.portNodes.indexOf(port) + 1}`
    const resolved: ResolvedPort = {
      importKey: `${dev.id}|${port.id}`,
      graphmlId: port.id,
      name: displayName,
      connectorType: conn.type,
      direction: dir,
      rawLabel,
      confidence: conn.confidence,
      signal: rowLabels.get(port.id),
    }
    if (dir === 'in') inputs.push(resolved)
    else if (dir === 'out') outputs.push(resolved)
    else {
      // Truly bidirectional (e.g. RJ45 networking): surface as both an
      // input and an output entry so cable-planner can attach edges to
      // either side. Both entries share the same graphmlId so re-import
      // matches; importKey is suffixed to keep them distinct.
      inputs.push({ ...resolved, importKey: `${dev.id}|${port.id}|in`, direction: 'bidirectional' })
      outputs.push({ ...resolved, importKey: `${dev.id}|${port.id}|out`, direction: 'bidirectional' })
    }
  }

  // Confidence rubric: device has both a name and at least one port = high.
  // Has a name but no ports = medium (will need manual port wiring).
  // Falls back to "Device <id>" = low.
  const named = !!mainLabel && mainLabel !== dev.id
  const havePorts = inputs.length + outputs.length > 0
  let confidence: ResolvedDevice['confidence']
  if (named && havePorts) confidence = 'high'
  else if (named) {
    confidence = 'medium'
    notes.push('No ports detected — the diagram drew this device as a single block without sub-shapes.')
  } else {
    confidence = 'low'
    notes.push('Could not extract a device name from the label set.')
  }

  return {
    importKey: `graphml:${dev.id}`,
    graphmlId: dev.id,
    name: mainLabel || `Device ${dev.id}`,
    subtitle,
    ipAddress: ip,
    category,
    inputs,
    outputs,
    position: dev.geometry ? { x: Math.round(dev.geometry.x), y: Math.round(dev.geometry.y) } : { x: 0, y: 0 },
    size: dev.geometry ? { width: Math.round(dev.geometry.width), height: Math.round(dev.geometry.height) } : null,
    fillColor: dev.fillColor,
    rawData: dev.data,
    confidence,
    notes,
  }
}

const buildEdgeIncidence = (
  edges: GraphmlEdge[],
): Map<string, { asSource: number; asTarget: number }> => {
  const m = new Map<string, { asSource: number; asTarget: number }>()
  for (const e of edges) {
    const s = m.get(e.sourceId) ?? { asSource: 0, asTarget: 0 }
    s.asSource += 1
    m.set(e.sourceId, s)
    const t = m.get(e.targetId) ?? { asSource: 0, asTarget: 0 }
    t.asTarget += 1
    m.set(e.targetId, t)
  }
  return m
}

export const resolveGraphml = (doc: GraphmlDocument): ImportPreview => {
  const edgeIncidenceByPort = buildEdgeIncidence(doc.edges)

  // Decide which pattern to use: if more than half of the top-level nodes
  // have children AND the children themselves look device-shaped, treat
  // the top-level nodes as categories (pattern 2). Otherwise treat the
  // diagram as flat (pattern 1).
  const topLevel = doc.nodes.filter((n) => n.parentId == null)
  const containers = topLevel.filter((n) => n.childIds.length > 0)
  // A container is "category-like" if its direct children themselves have
  // sub-children (the ports nest one more level inside).
  const categoryLikeContainers = containers.filter((c) => {
    const directs = c.childIds
      .map((id) => doc.nodes.find((n) => n.id === id))
      .filter((n): n is GraphmlNode => !!n)
    return directs.some((d) => d.childIds.length > 0)
  })

  const candidates: DeviceCandidate[] = []
  const portToDevice = new Map<string, string>()
  const deviceCategory = new Map<string, DeviceCategory>()
  const skippedNodes: Array<{ id: string; reason: string }> = []
  let rowLabels = new Map<string, string>()
  const consumedLabelIds = new Set<string>()
  let ownerOfNode = new Map<string, string>()
  let ipByDevice = new Map<string, string>()
  let subtitleOf = new Map<string, string>()
  let flatMode = false

  if (categoryLikeContainers.length >= 2) {
    // Pattern 2 — template library
    for (const cat of categoryLikeContainers) {
      const catName = cat.labels[0]?.text.trim() || cat.id
      const r = collectNestedCandidates(doc, cat.id)
      for (const c of r.candidates) {
        candidates.push(c)
        deviceCategory.set(c.node.id, catName)
      }
      for (const [port, dev] of r.portToDevice) portToDevice.set(port, dev)
    }
    // The flat top-level nodes that are NOT inside any container are
    // also kept (they might be legends or decorations).
    for (const n of topLevel) {
      if (n.childIds.length === 0 && !categoryLikeContainers.includes(n)) {
        skippedNodes.push({ id: n.id, reason: 'Top-level node sits outside any category container' })
      }
    }
  } else {
    // Pattern 1 — flat installation diagram
    const flat = collectFlatCandidates(topLevel, doc.edges)
    for (const c of flat.candidates) {
      candidates.push(c)
      deviceCategory.set(c.node.id, 'Importiert')
    }
    for (const [port, dev] of flat.portToDevice) portToDevice.set(port, dev)
    rowLabels = flat.rowLabels
    ownerOfNode = flat.ownerOfNode
    ipByDevice = flat.ipByDevice
    subtitleOf = flat.subtitleOf
    flatMode = true
    for (const id of flat.consumed) consumedLabelIds.add(id)

    // Nested groups in flat diagrams are typically the legend / title
    // blocks — skip them with a reason.
    for (const c of containers) {
      if (looksDecorative(c)) {
        skippedNodes.push({ id: c.id, reason: `Decorative group "${c.labels[0]?.text}"` })
      }
    }
  }

  // Heuristic: floating "port-name" text nodes the user dropped next
  // to port shapes (a very common yEd convention — the port itself is
  // a tiny coloured rectangle and the name lives in a separate label
  // node beside it). Match each label to its closest port within an
  // adjacency radius. Consumed label IDs are remembered so they don't
  // surface as "skipped — Decorative shape" below.
  // Cells already explained by a device table are not free labels.
  const floatingPortLabels = flatMode ? new Map<string, string>() : associateFloatingPortLabels(
    candidates,
    doc.nodes.filter((n) => n.parentId == null && !consumedLabelIds.has(n.id) && !portToDevice.has(n.id)),
    consumedLabelIds,
  )

  // Drop nodes the resolver classified as decorative or as unattached
  // port-shapes (port-sized nodes that didn't land in any device's bbox).
  for (const n of doc.nodes) {
    if (n.parentId) continue
    if (candidates.some((c) => c.node.id === n.id)) continue
    if (categoryLikeContainers.includes(n)) continue
    if (consumedLabelIds.has(n.id)) continue
    if (looksDecorative(n)) {
      skippedNodes.push({ id: n.id, reason: 'Decorative shape' })
    } else if (isPortShaped(n.geometry) && !portToDevice.has(n.id)) {
      skippedNodes.push({ id: n.id, reason: 'Port-sized node not contained by any device rect' })
    }
  }

  const devices = candidates.map((c) =>
    buildResolvedDevice(
      c,
      deviceCategory.get(c.node.id) ?? 'Importiert',
      edgeIncidenceByPort,
      floatingPortLabels,
      rowLabels,
    ),
  )
  for (const dev of devices) {
    if (!dev.ipAddress && ipByDevice.has(dev.graphmlId)) dev.ipAddress = ipByDevice.get(dev.graphmlId)!
    if (subtitleOf.has(dev.graphmlId)) dev.subtitle = subtitleOf.get(dev.graphmlId)!
    // Multi-line yEd captions ("Blackmagic\nSmart Videohub 20") read as
    // one name on the canvas.
    dev.name = dev.name.replace(/\s*\n\s*/g, ' ').trim()
  }

  // Index ports by their original GraphML node id to wire edges later.
  const portByGraphmlId = new Map<string, { device: ResolvedDevice; port: ResolvedPort }>()
  for (const dev of devices) {
    for (const p of [...dev.inputs, ...dev.outputs]) {
      // For bidirectional ports we duplicated entries; map both to the
      // first one so edges resolve consistently.
      if (!portByGraphmlId.has(p.graphmlId)) {
        portByGraphmlId.set(p.graphmlId, { device: dev, port: p })
      }
    }
  }

  // Index devices by their graphmlId so we can resolve device-level
  // edge endpoints (a frequent yEd convention: the edge sources from
  // the device's main rectangle rather than from one of its port shapes).
  const deviceByGraphmlId = new Map<string, ResolvedDevice>(
    devices.map((d) => [d.graphmlId, d]),
  )

  const cables: ResolvedCable[] = []
  const unresolvedEdges: GraphmlEdge[] = []

  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]))
  // Cable drawn onto a frame, function cell or device body: the line
  // still ends at a specific row. Take the port of the owning device
  // nearest to where yEd draws the endpoint; only if none is close does
  // the device get a synthesized port.
  const SNAP_PX = 25
  const resolveEndpoint = (
    nodeId: string,
    offset: { x: number; y: number },
  ): { device: ResolvedDevice; port: ResolvedPort } | ResolvedDevice | null => {
    const direct = portByGraphmlId.get(nodeId)
    if (direct) return direct
    const devId = deviceByGraphmlId.has(nodeId) ? nodeId : ownerOfNode.get(nodeId)
    const device = devId ? deviceByGraphmlId.get(devId) : undefined
    if (!device) return null
    const node = nodeById.get(nodeId)
    if (!node?.geometry) return device
    const c = center(node.geometry)
    const pt = { x: c.x + offset.x, y: c.y + offset.y }
    let best: { device: ResolvedDevice; port: ResolvedPort } | null = null
    let bestDist = SNAP_PX
    // Second chance: same row, beside the strip the line was drawn on.
    let rowBest: { device: ResolvedDevice; port: ResolvedPort } | null = null
    let rowDist = 200
    for (const p of [...device.inputs, ...device.outputs]) {
      const pn = nodeById.get(p.graphmlId)
      if (!pn?.geometry) continue
      const dist = distanceToRect(pn.geometry, pt)
      if (dist <= bestDist) {
        best = { device, port: p }
        bestDist = dist
      }
      if (pt.y >= pn.geometry.y && pt.y <= pn.geometry.y + pn.geometry.height && dist < rowDist) {
        rowBest = { device, port: p }
        rowDist = dist
      }
    }
    return best ?? rowBest ?? device
  }
  const isPortRef = (v: unknown): v is { device: ResolvedDevice; port: ResolvedPort } =>
    !!v && typeof v === 'object' && 'port' in v

  for (const edge of doc.edges) {
    let srcRef = resolveEndpoint(edge.sourceId, { x: edge.pathOffset.sx, y: edge.pathOffset.sy })
    let dstRef = resolveEndpoint(edge.targetId, { x: edge.pathOffset.tx, y: edge.pathOffset.ty })
    // Output wired back into an input of the same device (a scaler's
    // screen re-entry) is a real cable; input -> output on one device
    // only marks a loop-through and is skipped below.
    const loopback =
      isPortRef(srcRef) && isPortRef(dstRef) && srcRef.device === dstRef.device &&
      srcRef.port.direction === 'out' && dstRef.port.direction === 'in'
    // Arrow drawn from the input to the output: the cable still runs
    // output -> input.
    if (
      (isPortRef(srcRef) && srcRef.port.direction === 'in' && (!isPortRef(dstRef) || dstRef.port.direction !== 'in')) ||
      (isPortRef(dstRef) && dstRef.port.direction === 'out' && (!isPortRef(srcRef) || srcRef.port.direction !== 'out'))
    ) {
      ;[srcRef, dstRef] = [dstRef, srcRef]
    }
    const srcPort = isPortRef(srcRef) ? srcRef : undefined
    const dstPort = isPortRef(dstRef) ? dstRef : undefined
    const srcDev = srcRef && !isPortRef(srcRef) ? srcRef : undefined
    const dstDev = dstRef && !isPortRef(dstRef) ? dstRef : undefined

    // Decorative case: an edge from a device's main rect to one of its
    // own port shapes ("this is a port marker for me"). yEd uses this
    // to keep the port shape visually anchored to the device. Skip —
    // these are not cables.
    if (srcDev && dstPort && dstPort.device.graphmlId === srcDev.graphmlId) continue
    if (dstDev && srcPort && srcPort.device.graphmlId === dstDev.graphmlId) continue

    // Same-device port-to-port (intra-device patch): also decorative.
    if (srcPort && dstPort && srcPort.device.graphmlId === dstPort.device.graphmlId && !loopback) continue

    // Real cable: port → port across two different devices.
    if (srcPort && dstPort) {
      const rawCableType = edge.data['CableType'] ?? null
      const matched = inferConnectorType(
        rawCableType,
        edge.labels.join(' '),
        srcPort.port.connectorType,
        dstPort.port.connectorType,
      )
      cables.push({
        importKey: `graphml-edge:${edge.id}`,
        graphmlEdgeId: edge.id,
        sourceDeviceImportKey: srcPort.device.importKey,
        sourcePortImportKey: srcPort.port.importKey,
        targetDeviceImportKey: dstPort.device.importKey,
        targetPortImportKey: dstPort.port.importKey,
        inferredCableType: matched.type,
        rawCableType,
        videoStandard: edge.data['VideoStandard'] ?? null,
        signalName: edge.data['SignalName'] ?? edge.labels[0] ?? null,
        cableLengthMeters: extractCableLength(edge.data['CableLength'] ?? null),
        rawData: edge.data,
        lineColor: edge.lineColor,
        orphan: false,
        waypoints: edge.waypoints,
      })
      continue
    }

    // Mixed cable: one endpoint is a device's main rect, the other is a
    // port of another device. yEd users sometimes route the cable to
    // the device body rather than to a specific port shape. We
    // synthesize an "Open End" port on the device-side endpoint so
    // cable-planner has a Port id to point to — the import dialog
    // surfaces this so the user can pick a specific port if they want.
    if (srcDev && dstPort && srcDev.graphmlId !== dstPort.device.graphmlId) {
      const synthesized = ensureSynthesizedPort(srcDev, edge.sourceId, 'out')
      cables.push(buildCableRecord(edge, srcDev, synthesized, dstPort.device, dstPort.port))
      continue
    }
    if (dstDev && srcPort && dstDev.graphmlId !== srcPort.device.graphmlId) {
      const synthesized = ensureSynthesizedPort(dstDev, edge.targetId, 'in')
      cables.push(buildCableRecord(edge, srcPort.device, srcPort.port, dstDev, synthesized))
      continue
    }

    // Device-to-device with no specific port info: synthesize both ends.
    if (srcDev && dstDev && srcDev.graphmlId !== dstDev.graphmlId) {
      const sp = ensureSynthesizedPort(srcDev, edge.sourceId, 'out')
      const dp = ensureSynthesizedPort(dstDev, edge.targetId, 'in')
      cables.push(buildCableRecord(edge, srcDev, sp, dstDev, dp))
      continue
    }

    unresolvedEdges.push(edge)
  }

  // Helper closures defined after the main loop relies on them via
  // hoisted const-functions below.
  function ensureSynthesizedPort(
    dev: ResolvedDevice,
    syntheticGraphmlRef: string,
    side: 'in' | 'out',
  ): ResolvedPort {
    const key = `${dev.graphmlId}|synthetic-${side}-${syntheticGraphmlRef}`
    const existing = (side === 'in' ? dev.inputs : dev.outputs).find((p) => p.importKey === key)
    if (existing) return existing
    const port: ResolvedPort = {
      importKey: key,
      graphmlId: syntheticGraphmlRef,
      name: side === 'in' ? 'Input (Import)' : 'Output (Import)',
      connectorType: 'Custom',
      direction: side,
      rawLabel: '',
      confidence: 0.3,
    }
    if (side === 'in') dev.inputs.push(port)
    else dev.outputs.push(port)
    if (!dev.notes.some((n) => n.startsWith('Synthesized'))) {
      dev.notes.push('Synthesized ports for edges that targeted the device body instead of a port shape.')
    }
    return port
  }

  function buildCableRecord(
    edge: GraphmlEdge,
    srcDev: ResolvedDevice,
    srcPort: ResolvedPort,
    dstDev: ResolvedDevice,
    dstPort: ResolvedPort,
  ): ResolvedCable {
    const rawCableType = edge.data['CableType'] ?? null
    const matched = inferConnectorType(
      rawCableType,
      edge.labels.join(' '),
      srcPort.connectorType,
      dstPort.connectorType,
    )
    return {
      importKey: `graphml-edge:${edge.id}`,
      graphmlEdgeId: edge.id,
      sourceDeviceImportKey: srcDev.importKey,
      sourcePortImportKey: srcPort.importKey,
      targetDeviceImportKey: dstDev.importKey,
      targetPortImportKey: dstPort.importKey,
      inferredCableType: matched.type,
      rawCableType,
      videoStandard: edge.data['VideoStandard'] ?? null,
      signalName: edge.data['SignalName'] ?? edge.labels[0] ?? null,
      cableLengthMeters: extractCableLength(edge.data['CableLength'] ?? null),
      rawData: edge.data,
      lineColor: edge.lineColor,
      orphan: false,
      waypoints: edge.waypoints,
    }
  }

  return {
    devices,
    cables,
    unresolvedEdges,
    skippedNodes,
    meta: {
      fileSize: doc.stats.fileSize,
      nodeCount: doc.stats.nodeCount,
      edgeCount: doc.stats.edgeCount,
      description: doc.description,
    },
  }
}

/** Turn a ResolvedDevice into the cable-planner EquipmentItem shape that
 *  importEquipment() accepts. The store assigns final uuids during
 *  insertion. */
const portToDomainPort = (p: ResolvedPort): Port => ({
  id: '',
  name: p.name,
  type: p.connectorType,
  connectorType: p.connectorType,
  direction: p.direction,
  ...(p.signal ? { contentLabel: p.signal } : {}),
})

export const toEquipmentItem = (dev: ResolvedDevice) => ({
  id: '',
  name: dev.name,
  subtitle: dev.subtitle ?? undefined,
  category: dev.category,
  inputs: dev.inputs.map(portToDomainPort),
  outputs: dev.outputs.map(portToDomainPort),
  x: dev.position.x,
  y: dev.position.y,
  width: dev.size?.width ?? 240,
  height: dev.size?.height ?? Math.max(80, 60 + 22 * Math.max(dev.inputs.length, dev.outputs.length)),
  nodeColor: dev.fillColor ?? undefined,
  ipAddress: dev.ipAddress ?? undefined,
  notes: dev.notes.length > 0 ? dev.notes.join('\n') : undefined,
  graphmlId: dev.graphmlId,
})

/** Build the exact payload shape importGraphml() expects from an
 *  ImportPreview. Devices and cables can be filtered by the dialog
 *  before this is called (skipFlags below). */
export interface BuildPayloadOptions {
  /** Devices to omit (by importKey). */
  skipDeviceKeys?: Set<string>
  /** Cables to omit (by importKey). */
  skipCableKeys?: Set<string>
  /** Per-device category overrides set by the mapping UI. */
  categoryOverrides?: Record<string, string>
  /** Per-device name overrides (the user can rename in the table). */
  nameOverrides?: Record<string, string>
}

export const buildImportPayload = (
  preview: ImportPreview,
  options: BuildPayloadOptions = {},
) => {
  const skipDev = options.skipDeviceKeys ?? new Set<string>()
  const skipCab = options.skipCableKeys ?? new Set<string>()
  const includedDevices = preview.devices.filter((d) => !skipDev.has(d.importKey))

  const portIndex: Record<string, { deviceImportKey: string; side: 'in' | 'out'; index: number }> = {}
  const devices = includedDevices.map((dev) => {
    dev.inputs.forEach((p, idx) => {
      portIndex[p.importKey] = { deviceImportKey: dev.importKey, side: 'in', index: idx }
    })
    dev.outputs.forEach((p, idx) => {
      portIndex[p.importKey] = { deviceImportKey: dev.importKey, side: 'out', index: idx }
    })
    const base = toEquipmentItem(dev)
    return {
      ...base,
      name: options.nameOverrides?.[dev.importKey] ?? base.name,
      category: options.categoryOverrides?.[dev.importKey] ?? base.category,
      importKey: dev.importKey,
      graphmlId: dev.graphmlId,
    }
  })

  const includedDeviceKeys = new Set(includedDevices.map((d) => d.importKey))
  const cables = preview.cables
    .filter((c) => !skipCab.has(c.importKey))
    .filter((c) => includedDeviceKeys.has(c.sourceDeviceImportKey) && includedDeviceKeys.has(c.targetDeviceImportKey))
    .map((c) => ({
      importKey: c.importKey,
      graphmlEdgeId: c.graphmlEdgeId,
      sourceDeviceImportKey: c.sourceDeviceImportKey,
      sourcePortImportKey: c.sourcePortImportKey,
      targetDeviceImportKey: c.targetDeviceImportKey,
      targetPortImportKey: c.targetPortImportKey,
      type: c.inferredCableType as import('../../types/cable').CableType,
      length: c.cableLengthMeters ?? 1,
      color: c.lineColor ?? '#64748b',
      name: c.signalName ?? `${c.inferredCableType} cable`,
      standard: c.videoStandard ? (c.videoStandard as import('../../types/cableSpec').SignalStandard | undefined) : undefined,
      notes: [c.rawCableType ? `CableType: ${c.rawCableType}` : '', c.videoStandard ? `Standard: ${c.videoStandard}` : '']
        .filter(Boolean)
        .join('\n') || undefined,
      // Carry yEd's polyline bend points through so the store can apply
      // them to Cable.waypoints — without this the canvas auto-routes
      // every cable and the import no longer matches the source diagram.
      waypoints: c.waypoints.map((w) => ({ x: Math.round(w.x), y: Math.round(w.y) })),
    }))

  return { devices, portIndex, cables }
}
