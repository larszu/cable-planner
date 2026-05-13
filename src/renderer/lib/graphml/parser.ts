// yEd / yWorks GraphML parser. Reads a complete .graphml document into the
// neutral GraphmlDocument representation in types.ts. Designed for the
// shapes actually produced by yEd 3.x (verified against two 2.4 MB real
// files containing 1000+ nodes each), not the GraphML reference spec in
// the abstract — so it is permissive about missing fields but strict
// about the namespaced y:* elements that carry every visual signal.
//
// Strategy:
//   1. fast-xml-parser turns the document into a plain JS tree. We keep
//      attributes prefixed with '@_' and namespaced elements with their
//      'y:' prefix. allowBooleanAttributes is needed because yEd emits
//      attributes like xml:space="preserve" on empty data fields.
//   2. We walk the parsed tree recursively. yEd nests sub-graphs under a
//      parent <node> via a single <graph> child; the child node IDs are
//      already qualified as "parent::child" by yEd itself, so we don't
//      have to fabricate them.
//   3. Custom data fields are resolved through a key registry that maps
//      the cryptic id="d4" to the human attr.name="IsDevice". yfiles-only
//      keys (yfiles.type="nodegraphics" / "edgegraphics") are handled
//      separately because they carry the visual <y:ShapeNode> tree.

import { XMLParser } from 'fast-xml-parser'
import type {
  GraphmlEdge,
  GraphmlKey,
  GraphmlKeyDomain,
  GraphmlNode,
  GraphmlNodeLabel,
  GraphmlParseResult,
  GraphmlParseWarning,
  GraphmlShapeKind,
} from './types'

const SHAPE_TAG_TO_KIND: Record<string, GraphmlShapeKind> = {
  'y:ShapeNode': 'ShapeNode',
  'y:GenericNode': 'GenericNode',
  'y:GroupNode': 'GroupNode',
  'y:ProxyAutoBoundsNode': 'ProxyAutoBoundsNode',
  'y:SVGNode': 'SVGNode',
  'y:TableNode': 'TableNode',
}

/** Tags inside a node's nodegraphics data that carry visual info. */
const ALL_SHAPE_TAGS = Object.keys(SHAPE_TAG_TO_KIND)

interface RawAttrs {
  [k: string]: unknown
}

const toArray = <T>(value: T | T[] | undefined): T[] => {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

const readAttr = (obj: unknown, attr: string): string | null => {
  if (!obj || typeof obj !== 'object') return null
  const v = (obj as RawAttrs)[`@_${attr}`]
  return v == null ? null : String(v)
}

const readNumberAttr = (obj: unknown, attr: string): number | null => {
  const s = readAttr(obj, attr)
  if (s == null) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Read the textual content of an element. fast-xml-parser stores text
 *  either as the plain string (for leaf elements with only text) or under
 *  '#text' when mixed with attributes. CDATA wrapping is stripped by the
 *  parser automatically. */
const readText = (obj: unknown): string => {
  if (obj == null) return ''
  if (typeof obj === 'string') return obj
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj)
  if (typeof obj === 'object') {
    const t = (obj as RawAttrs)['#text']
    if (t != null) return String(t)
  }
  return ''
}

const buildXmlParser = () =>
  new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    // Don't try to coerce: yEd emits e.g. boolean default values inside
    // <default> elements where coercion would mask the original string.
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: false,
    // Keep yfiles namespaces intact: y:ShapeNode, y:NodeLabel, etc.
    removeNSPrefix: false,
    // CDATA is the dominant payload format in yEd files (every custom
    // data value is wrapped in CDATA); fast-xml-parser preserves it as
    // text by default.
    processEntities: true,
  })

/** Pick the first shape element that yEd uses to draw a node. yEd may
 *  embed ShapeNode either directly under the <data> key (the common case)
 *  or one level deeper inside <y:ProxyAutoBoundsNode><y:Realizers>. */
const extractShapeElement = (
  nodegraphics: unknown,
): { tag: string; element: RawAttrs } | null => {
  if (!nodegraphics || typeof nodegraphics !== 'object') return null
  const obj = nodegraphics as RawAttrs
  for (const tag of ALL_SHAPE_TAGS) {
    const direct = obj[tag]
    if (direct) {
      // Use the first one if it's an array (rare).
      const first = Array.isArray(direct) ? direct[0] : direct
      if (first && typeof first === 'object') {
        // Special handling for ProxyAutoBoundsNode: dive one more level.
        if (tag === 'y:ProxyAutoBoundsNode') {
          const realizers = (first as RawAttrs)['y:Realizers']
          if (realizers && typeof realizers === 'object') {
            for (const innerTag of ALL_SHAPE_TAGS) {
              if (innerTag === 'y:ProxyAutoBoundsNode') continue
              const inner = (realizers as RawAttrs)[innerTag]
              if (inner) {
                const innerFirst = Array.isArray(inner) ? inner[0] : inner
                if (innerFirst && typeof innerFirst === 'object') {
                  return { tag: innerTag, element: innerFirst as RawAttrs }
                }
              }
            }
          }
        }
        return { tag, element: first as RawAttrs }
      }
    }
  }
  return null
}

const extractLabels = (shape: RawAttrs | null): GraphmlNodeLabel[] => {
  if (!shape) return []
  const raw = (shape as RawAttrs)['y:NodeLabel']
  const out: GraphmlNodeLabel[] = []
  for (const entry of toArray(raw)) {
    const text = readText(entry).trim()
    if (!text) continue
    out.push({
      text,
      fontSize: readNumberAttr(entry, 'fontSize') ?? undefined,
      fontStyle: readAttr(entry, 'fontStyle') ?? undefined,
      modelPosition: readAttr(entry, 'modelPosition') ?? undefined,
    })
  }
  return out
}

const extractGeometry = (shape: RawAttrs | null) => {
  if (!shape) return null
  const g = (shape as RawAttrs)['y:Geometry']
  if (!g) return null
  const x = readNumberAttr(g, 'x')
  const y = readNumberAttr(g, 'y')
  const width = readNumberAttr(g, 'width')
  const height = readNumberAttr(g, 'height')
  if (x == null || y == null || width == null || height == null) return null
  return { x, y, width, height }
}

const extractFillBorder = (
  shape: RawAttrs | null,
): { fill: string | null; border: string | null; shape: string | null } => {
  if (!shape) return { fill: null, border: null, shape: null }
  const fill = (shape as RawAttrs)['y:Fill']
  const border = (shape as RawAttrs)['y:BorderStyle']
  const sh = (shape as RawAttrs)['y:Shape']
  return {
    fill: readAttr(fill, 'color'),
    border: readAttr(border, 'color'),
    shape: readAttr(sh, 'type'),
  }
}

const KEY_DOMAIN_VALUES: ReadonlyArray<GraphmlKeyDomain> = [
  'node',
  'edge',
  'graph',
  'graphml',
  'port',
  'all',
]

const normalizeKeyDomain = (raw: string | null): GraphmlKeyDomain => {
  if (!raw) return 'all'
  const lower = raw.toLowerCase()
  return (KEY_DOMAIN_VALUES as ReadonlyArray<string>).includes(lower)
    ? (lower as GraphmlKeyDomain)
    : 'all'
}

const buildKeyRegistry = (raw: unknown): GraphmlKey[] => {
  return toArray(raw).map((entry) => ({
    id: readAttr(entry, 'id') ?? '',
    domain: normalizeKeyDomain(readAttr(entry, 'for')),
    name: readAttr(entry, 'attr.name'),
    type: readAttr(entry, 'attr.type'),
    yfilesType: readAttr(entry, 'yfiles.type'),
  }))
}

/** Resolves custom `<data key="d4">value</data>` entries into a map keyed
 *  by the human attr.name from the registry. Skips entries that map to a
 *  yfiles graphics key (those are handled by extractShapeElement). */
const extractDataMap = (
  raw: unknown,
  keysById: Map<string, GraphmlKey>,
  domain: 'node' | 'edge' | 'graph',
  warnings: GraphmlParseWarning[],
  ref: string,
): { data: Record<string, string>; nodegraphics?: unknown; edgegraphics?: unknown } => {
  const data: Record<string, string> = {}
  let nodegraphics: unknown
  let edgegraphics: unknown
  for (const entry of toArray(raw)) {
    const keyId = readAttr(entry, 'key')
    if (!keyId) continue
    const key = keysById.get(keyId)
    if (!key) {
      warnings.push({
        code: 'unknown_key_id',
        message: `Data references unknown key id "${keyId}"`,
        ref,
      })
      continue
    }
    // yfiles graphics: don't merge into the human map.
    if (key.yfilesType === 'nodegraphics' && domain === 'node') {
      nodegraphics = entry
      continue
    }
    if (key.yfilesType === 'edgegraphics' && domain === 'edge') {
      edgegraphics = entry
      continue
    }
    // Skip port-only and resources keys; they don't carry semantic data
    // we care about.
    if (key.yfilesType === 'portgraphics' || key.yfilesType === 'portgeometry'
        || key.yfilesType === 'portuserdata' || key.yfilesType === 'resources') {
      continue
    }
    const name = key.name
    if (!name) continue
    const text = readText(entry).trim()
    if (text) data[name] = text
  }
  return { data, nodegraphics, edgegraphics }
}

/** Walk a <graph> element (which has <node> and <edge> children).
 *  Recurses into any node that has its own nested <graph>. */
const walkGraph = (
  graphObj: unknown,
  parentId: string | null,
  keysById: Map<string, GraphmlKey>,
  nodes: GraphmlNode[],
  edges: GraphmlEdge[],
  warnings: GraphmlParseWarning[],
  seenNodeIds: Set<string>,
  stats: { groupCount: number },
): void => {
  if (!graphObj || typeof graphObj !== 'object') return
  const obj = graphObj as RawAttrs
  for (const rawNode of toArray(obj.node)) {
    const id = readAttr(rawNode, 'id') ?? ''
    if (!id) continue
    if (seenNodeIds.has(id)) {
      warnings.push({
        code: 'duplicate_node_id',
        message: `Duplicate node id "${id}"`,
        ref: id,
      })
      // We still keep the second occurrence — yEd doesn't actually emit
      // duplicates in practice, but if it ever does we'd rather show
      // both than silently drop one.
    }
    seenNodeIds.add(id)

    const { data, nodegraphics } = extractDataMap(
      (rawNode as RawAttrs).data,
      keysById,
      'node',
      warnings,
      id,
    )
    const shape = extractShapeElement(nodegraphics)
    const shapeTag = shape?.tag ?? null
    const labels = extractLabels(shape?.element ?? null)
    const geometry = extractGeometry(shape?.element ?? null)
    const fb = extractFillBorder(shape?.element ?? null)
    if (!geometry) {
      warnings.push({ code: 'missing_geometry', message: `Node missing geometry`, ref: id })
    }

    // Group / nested children. yEd lifts the inner <graph> directly under
    // the <node> element, NOT nested inside the nodegraphics data.
    const nestedGraph = (rawNode as RawAttrs).graph
    const isGroup = !!nestedGraph || shapeTag === 'y:GroupNode' || shapeTag === 'y:ProxyAutoBoundsNode'
    if (isGroup) stats.groupCount += 1

    const node: GraphmlNode = {
      id,
      parentId,
      childIds: [],
      labels,
      geometry,
      fillColor: fb.fill,
      borderColor: fb.border,
      shapeType: shapeTag ? SHAPE_TAG_TO_KIND[shapeTag] : 'unknown',
      shapePrimitive: fb.shape,
      data,
    }
    nodes.push(node)

    // Recurse into nested sub-graph BEFORE finalising childIds so we know
    // what they are. The child node IDs already include the parent prefix
    // ("n1::n0") because yEd emits qualified ids.
    if (nestedGraph) {
      const beforeLen = nodes.length
      walkGraph(nestedGraph, id, keysById, nodes, edges, warnings, seenNodeIds, stats)
      // Direct children = nodes appended at depth-first arrival whose
      // parentId is this node. Walk just-added entries.
      for (let i = beforeLen; i < nodes.length; i += 1) {
        if (nodes[i].parentId === id) node.childIds.push(nodes[i].id)
      }
    }
  }

  for (const rawEdge of toArray(obj.edge)) {
    const id = readAttr(rawEdge, 'id') ?? ''
    const source = readAttr(rawEdge, 'source') ?? ''
    const target = readAttr(rawEdge, 'target') ?? ''
    if (!id || !source || !target) continue
    const { data, edgegraphics } = extractDataMap(
      (rawEdge as RawAttrs).data,
      keysById,
      'edge',
      warnings,
      id,
    )

    // Edge graphics (y:PolyLineEdge / y:BezierEdge / …) carries the
    // visual labels, line style, AND the polyline waypoints + path
    // offsets we need to recreate the original yEd routing 1:1.
    let labels: string[] = []
    let lineColor: string | null = null
    let lineType: string | null = null
    let waypoints: { x: number; y: number }[] = []
    let pathOffset = { sx: 0, sy: 0, tx: 0, ty: 0 }
    if (edgegraphics && typeof edgegraphics === 'object') {
      const eg = edgegraphics as RawAttrs
      // Pick whatever edge realizer is present.
      for (const realizerTag of ['y:PolyLineEdge', 'y:BezierEdge', 'y:GenericEdge', 'y:ArcEdge', 'y:QuadCurveEdge', 'y:SplineEdge']) {
        const r = eg[realizerTag]
        if (r) {
          const first = Array.isArray(r) ? r[0] : r
          if (first && typeof first === 'object') {
            const fr = first as RawAttrs
            // Edge labels: yEd may emit zero, one, or many.
            const rawLabels = fr['y:EdgeLabel']
            labels = toArray(rawLabels)
              .map((l) => readText(l).trim())
              .filter(Boolean)
            lineColor = readAttr(fr['y:LineStyle'], 'color')
            lineType = readAttr(fr['y:LineStyle'], 'type')
            // y:Path holds the start/end offset attributes (sx/sy/tx/ty)
            // AND any y:Point bend points the user dragged into the
            // polyline. Both are needed to recreate the routing in
            // cable-planner — otherwise the canvas auto-routes a
            // straight or L-shaped path and the diagram looks nothing
            // like the source.
            const path = fr['y:Path']
            if (path && typeof path === 'object') {
              const p = path as RawAttrs
              pathOffset = {
                sx: readNumberAttr(p, 'sx') ?? 0,
                sy: readNumberAttr(p, 'sy') ?? 0,
                tx: readNumberAttr(p, 'tx') ?? 0,
                ty: readNumberAttr(p, 'ty') ?? 0,
              }
              waypoints = toArray(p['y:Point'])
                .map((pt) => {
                  const x = readNumberAttr(pt, 'x')
                  const y = readNumberAttr(pt, 'y')
                  return x != null && y != null ? { x, y } : null
                })
                .filter((w): w is { x: number; y: number } => w != null)
            }
            break
          }
        }
      }
    }

    edges.push({
      id,
      sourceId: source,
      targetId: target,
      labels,
      data,
      lineColor,
      lineType,
      waypoints,
      pathOffset,
    })
  }
}

export const parseGraphmlText = (xmlText: string): GraphmlParseResult => {
  const warnings: GraphmlParseWarning[] = []
  const parser = buildXmlParser()
  const tree = parser.parse(xmlText) as RawAttrs

  const graphmlRoot = (tree.graphml ?? tree.GRAPHML) as RawAttrs | undefined
  if (!graphmlRoot) {
    return {
      document: {
        nodes: [],
        edges: [],
        keys: [],
        description: null,
        stats: { nodeCount: 0, edgeCount: 0, groupCount: 0, fileSize: xmlText.length },
      },
      warnings: [
        { code: 'malformed_data', message: 'Document has no <graphml> root element' },
      ],
    }
  }

  // The document declares its keys at the top level.
  const keys = buildKeyRegistry(graphmlRoot.key)
  const keysById = new Map(keys.map((k) => [k.id, k]))

  // Graph-level description (key d0 "Beschreibung").
  const rootGraph = graphmlRoot.graph as RawAttrs | undefined
  let description: string | null = null
  if (rootGraph) {
    const { data } = extractDataMap(
      rootGraph.data,
      keysById,
      'graph',
      warnings,
      'root-graph',
    )
    description = data['Beschreibung'] ?? data['description'] ?? null
  }

  const nodes: GraphmlNode[] = []
  const edges: GraphmlEdge[] = []
  const stats = { groupCount: 0 }
  if (rootGraph) {
    walkGraph(rootGraph, null, keysById, nodes, edges, warnings, new Set(), stats)
  }

  // Sanity pass: every edge endpoint should resolve to a known node.
  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceId)) {
      warnings.push({
        code: 'orphan_edge_endpoint',
        message: `Edge "${edge.id}" source "${edge.sourceId}" not found`,
        ref: edge.id,
      })
    }
    if (!nodeIds.has(edge.targetId)) {
      warnings.push({
        code: 'orphan_edge_endpoint',
        message: `Edge "${edge.id}" target "${edge.targetId}" not found`,
        ref: edge.id,
      })
    }
  }

  return {
    document: {
      nodes,
      edges,
      keys,
      description,
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        groupCount: stats.groupCount,
        fileSize: xmlText.length,
      },
    },
    warnings,
  }
}
