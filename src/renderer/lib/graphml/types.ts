// Data shapes produced by the GraphML parser. The parser stops at a
// neutral, deserialized representation; semantic interpretation (device
// detection, connector classification, cable construction) happens in
// graphmlSemantics.ts so the parser can be tested independently.

export type GraphmlShapeKind =
  | 'ShapeNode'
  | 'GenericNode'
  | 'GroupNode'
  | 'ProxyAutoBoundsNode'
  | 'SVGNode'
  | 'TableNode'
  | 'unknown'

export interface GraphmlGeometry {
  x: number
  y: number
  width: number
  height: number
}

/** Visual label attached to a node in display order (first = main name). */
export interface GraphmlNodeLabel {
  text: string
  fontSize?: number
  fontStyle?: string
  /** Position hint as set by yEd, e.g. 't' (top), 'b' (bottom), 'internal'. */
  modelPosition?: string
}

export interface GraphmlNode {
  /** Full ID, including any '::'-separated parent prefix (yEd nested-group). */
  id: string
  /** Immediate parent node ID if this node sits inside another node's <graph>. */
  parentId: string | null
  /** Direct child node IDs (one level only). */
  childIds: string[]
  labels: GraphmlNodeLabel[]
  geometry: GraphmlGeometry | null
  fillColor: string | null
  borderColor: string | null
  shapeType: GraphmlShapeKind
  /** y:Shape "type" attribute (rectangle, ellipse, roundrectangle, …). */
  shapePrimitive: string | null
  /** Custom data fields keyed by the human-readable attr.name from the key
   *  registry (DeviceType, IpAddress, Connector, …). Empty strings dropped. */
  data: Record<string, string>
}

export interface GraphmlEdge {
  id: string
  sourceId: string
  targetId: string
  labels: string[]
  data: Record<string, string>
  lineColor: string | null
  lineType: string | null
  /** Intermediate bend points the user drew in yEd between source and
   *  target (absolute graph coordinates). Empty when the edge runs as
   *  a straight line. */
  waypoints: { x: number; y: number }[]
  /** Offsets from source/target node center to the actual line endpoints
   *  inside yEd (`y:Path sx/sy/tx/ty`). Used when re-creating the visual
   *  start/end of the polyline. */
  pathOffset: { sx: number; sy: number; tx: number; ty: number }
}

export type GraphmlKeyDomain = 'node' | 'edge' | 'graph' | 'graphml' | 'port' | 'all'

export interface GraphmlKey {
  id: string
  domain: GraphmlKeyDomain
  /** Human-readable name from attr.name (the prompt's "Custom Data Keys"). */
  name: string | null
  type: string | null
  /** yfiles.type if present (nodegraphics, edgegraphics, …). */
  yfilesType: string | null
}

export interface GraphmlDocument {
  /** All nodes flattened, including nested children. Iteration order
   *  matches yEd's document order. */
  nodes: GraphmlNode[]
  edges: GraphmlEdge[]
  keys: GraphmlKey[]
  /** d0 "Beschreibung" on the root graph, if present. */
  description: string | null
  /** Total node count for progress reporting. */
  stats: {
    nodeCount: number
    edgeCount: number
    groupCount: number
    fileSize: number
  }
}

/** Soft-fail entry recorded for fields the parser couldn't make sense of. */
export interface GraphmlParseWarning {
  code:
    | 'unknown_key_id'
    | 'orphan_edge_endpoint'
    | 'duplicate_node_id'
    | 'missing_geometry'
    | 'malformed_data'
  message: string
  /** Context — node or edge ID. */
  ref?: string
}

export interface GraphmlParseResult {
  document: GraphmlDocument
  warnings: GraphmlParseWarning[]
}
