// ───────────────────────────────────────────────────────────────────────────
// Geraeteprofil als MS-05-02-Blockbaum (#1240, Stufe 6). Nur Ausgabe.
//
// AMWA MS-05-02 v1.0 beschreibt ein Geraet als Baum aus Objekten: Bloecke
// (NcBlock, Klasse 1.1) enthalten Worker (NcWorker, 1.2) und weitere Bloecke;
// im Wurzelblock stehen DeviceManager (1.3.1) und ClassManager (1.3.2). Ein
// IS-12-Controller liest genau diesen Baum. Damit ist das Profilformat nicht
// selbst erfunden: dieselbe Zusammensetzung aus Bausteinen, die
// `internalMatrix.ts` rechnet, steht hier in der Sprache der Norm.
//
// ABBILDUNG
//   M/E                -> NcBlock `ME<n>`: LzBus Program/Preview, LzTransition,
//                         LzKeyer je Upstream-Keyer
//   SuperSource        -> NcBlock `SuperSource<n>`: LzBox je Box, LzBus Art
//   Mediaplayer, Aux   -> LzBus
//   Downstream-Keyer   -> LzKeyer
//   Kreuzschiene       -> LzCrosspoints (alle Ebenen, Sperren)
//
// EIGENE KLASSEN. Was die Norm nicht hat (Bus, Keyer, Uebergang, Box,
// Kreuzpunkte), sind eigene Klassen. MS-05-02, Framework „NcClassId“:
// Organisationen ohne eigene OUI/CID setzen den Authority-Key 0 direkt hinter
// die Klasse, von der sie erben — also `[1, 2, 0, n]` unter NcWorker. Ihre
// Eigenschaften liegen auf Ebene 3 (Klassen-ID ohne Authority-Key gezaehlt).
//
// FORM DER AUSGABE. Jedes Objekt traegt seine Eigenschaften als Liste
// `{ id, name, typeName, isReadOnly, value }` — dieselbe Form wie
// NcPropertyValueHolder im Bulk-Properties-Modell (IS-14). Der ClassManager
// fuehrt nur die eigenen Klassen und Datentypen; die Standardklassen stehen
// in der Norm.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../../types/equipment'
import { buildInnerMatrix, routeOf, type InnerBlock, type InnerMatrix } from '../switching/internalMatrix'
import { routerMatrixOf } from '../switching/matrix'
import { switchingProfileFor } from '../switching/state'
import { TRANSITION_STYLES, WIPE_PATTERNS, type SwitchingProfile } from '../switching/types'
import type { Json } from './is04'

export type NcClassId = number[]
export interface NcElementId {
  level: number
  index: number
}

export interface NcPropertyValue {
  id: NcElementId
  name: string
  typeName: string | null
  isReadOnly: boolean
  value: unknown
}

export interface NcObjectNode {
  classId: NcClassId
  oid: number
  role: string
  properties: NcPropertyValue[]
  /** Nur Bloecke: die Mitglieder in Baumform (2p2 `members` traegt die Deskriptoren). */
  members?: NcObjectNode[]
}

export interface Ms0502Export {
  equipmentId: string
  device: string
  root: NcObjectNode
  controlClasses: Json[]
  datatypes: Json[]
}

// ─── Klassen ────────────────────────────────────────────────────────────

export const NC_BLOCK: NcClassId = [1, 1]
export const NC_DEVICE_MANAGER: NcClassId = [1, 3, 1]
export const NC_CLASS_MANAGER: NcClassId = [1, 3, 2]

interface PropDef {
  name: string
  typeName: string
  isReadOnly?: boolean
  isNullable?: boolean
  isSequence?: boolean
  description: string
  constraints?: Json | null
}

interface ClassDef {
  classId: NcClassId
  name: string
  description: string
  props: PropDef[]
}

const num = (minimum: number, maximum: number, step: number | null = null) => ({
  maximum,
  minimum,
  step,
  defaultValue: null,
})

export const LZ_CLASSES: readonly ClassDef[] = [
  {
    classId: [1, 2, 0, 1],
    name: 'LzBus',
    description: 'Bus of a switcher: the source routed to this destination',
    props: [{ name: 'source', typeName: 'NcString', isNullable: true, description: 'Routed source (node id of the internal matrix)' }],
  },
  {
    classId: [1, 2, 0, 2],
    name: 'LzKeyer',
    description: 'Upstream or downstream keyer',
    props: [
      { name: 'keyType', typeName: 'LzKeyerType', isNullable: true, description: 'Key type' },
      { name: 'onAir', typeName: 'NcBoolean', description: 'Key is on air' },
      { name: 'fillSource', typeName: 'NcString', isNullable: true, description: 'Fill source' },
      { name: 'keySource', typeName: 'NcString', isNullable: true, description: 'Key (cut) source' },
    ],
  },
  {
    classId: [1, 2, 0, 3],
    name: 'LzTransition',
    description: 'Transition of a mix effect',
    props: [
      { name: 'style', typeName: 'LzTransitionStyle', isNullable: true, description: 'Transition style' },
      { name: 'rateMs', typeName: 'NcUint32', isNullable: true, description: 'Duration in milliseconds', constraints: num(0, 600000, 1) },
      { name: 'wipePattern', typeName: 'LzWipePattern', isNullable: true, description: 'Wipe pattern' },
      { name: 'dipSource', typeName: 'NcString', isNullable: true, description: 'Dip source' },
    ],
  },
  {
    classId: [1, 2, 0, 4],
    name: 'LzBox',
    description: 'SuperSource box (picture from x -16..16, y -9..9, size 1 fills it)',
    props: [
      { name: 'source', typeName: 'NcString', isNullable: true, description: 'Routed source' },
      { name: 'boxEnabled', typeName: 'NcBoolean', description: 'Box is shown' },
      { name: 'x', typeName: 'NcFloat32', isNullable: true, description: 'Centre x', constraints: num(-16, 16) },
      { name: 'y', typeName: 'NcFloat32', isNullable: true, description: 'Centre y', constraints: num(-9, 9) },
      { name: 'size', typeName: 'NcFloat32', isNullable: true, description: 'Size, 1 fills the picture', constraints: num(0, 1) },
      { name: 'cropped', typeName: 'NcBoolean', description: 'Crop is applied' },
    ],
  },
  {
    classId: [1, 2, 0, 5],
    name: 'LzCrosspoints',
    description: 'Crosspoints of a router on all levels',
    props: [
      { name: 'crosspoints', typeName: 'LzCrosspoint', isSequence: true, description: 'Planned crosspoints' },
      { name: 'locks', typeName: 'LzLock', isSequence: true, description: 'Locked or protected destinations' },
    ],
  },
]

const enumType = (name: string, description: string, items: readonly string[]): Json => ({
  description,
  name,
  type: 3,
  constraints: null,
  items: items.map((n, i) => ({ description: null, name: n, value: i })),
})

const structType = (name: string, description: string, fields: [string, string][]): Json => ({
  description,
  name,
  type: 2,
  constraints: null,
  parentType: null,
  fields: fields.map(([n, typeName]) => ({ description: null, name: n, typeName, isNullable: false, isSequence: false, constraints: null })),
})

export const KEYER_TYPES = ['luma', 'chroma', 'pattern', 'dve'] as const
export const LOCK_KINDS = ['lock', 'protect'] as const

export const LZ_DATATYPES: readonly Json[] = [
  enumType('LzKeyerType', 'Key type', KEYER_TYPES),
  enumType('LzTransitionStyle', 'Transition style', TRANSITION_STYLES),
  enumType('LzWipePattern', 'Wipe pattern', WIPE_PATTERNS),
  enumType('LzLockKind', 'Lock kind', LOCK_KINDS),
  structType('LzCrosspoint', 'One crosspoint on one level', [
    ['level', 'NcString'],
    ['destination', 'NcString'],
    ['source', 'NcString'],
  ]),
  structType('LzLock', 'Lock on a destination', [
    ['destination', 'NcString'],
    ['kind', 'LzLockKind'],
  ]),
]

/** Ebene einer Klasse: Laenge der Klassen-ID ohne Authority-Keys (<= 0). */
export const classLevel = (id: NcClassId): number => id.filter((x) => x > 0).length

export const classDescriptor = (c: ClassDef): Json => ({
  description: c.description,
  classId: c.classId,
  name: c.name,
  fixedRole: null,
  properties: c.props.map((p, i) => ({
    description: p.description,
    id: { level: classLevel(c.classId), index: i + 1 },
    name: p.name,
    typeName: p.typeName,
    isReadOnly: p.isReadOnly ?? false,
    isNullable: p.isNullable ?? false,
    isSequence: p.isSequence ?? false,
    isDeprecated: false,
    constraints: p.constraints ?? null,
  })),
  methods: [],
  events: [],
})

const lz = (name: string) => LZ_CLASSES.find((c) => c.name === name)!

// ─── Baum ───────────────────────────────────────────────────────────────

type Prop = [level: number, index: number, name: string, typeName: string | null, isReadOnly: boolean, value: unknown]

const P = (p: Prop): NcPropertyValue => ({
  id: { level: p[0], index: p[1] },
  name: p[2],
  typeName: p[3],
  isReadOnly: p[4],
  value: p[5],
})

class Tree {
  private next = 1
  oid() {
    return this.next++
  }
}

const objectProps = (classId: NcClassId, oid: number, owner: number | null, role: string, userLabel: string | null): NcPropertyValue[] =>
  [
    [1, 1, 'classId', 'NcClassId', true, classId],
    [1, 2, 'oid', 'NcOid', true, oid],
    [1, 3, 'constantOid', 'NcBoolean', true, true],
    [1, 4, 'owner', 'NcOid', true, owner],
    [1, 5, 'role', 'NcString', true, role],
    [1, 6, 'userLabel', 'NcString', false, userLabel],
    [1, 7, 'touchpoints', 'NcTouchpoint', true, null],
    [1, 8, 'runtimePropertyConstraints', 'NcPropertyConstraints', true, null],
  ].map((p) => P(p as Prop))

const worker = (
  t: Tree,
  owner: number,
  className: string,
  role: string,
  values: unknown[],
  userLabel: string | null = null,
): NcObjectNode => {
  const c = lz(className)
  const oid = t.oid()
  const lvl = classLevel(c.classId)
  return {
    classId: c.classId,
    oid,
    role,
    properties: [
      ...objectProps(c.classId, oid, owner, role, userLabel),
      P([2, 1, 'enabled', 'NcBoolean', false, true]),
      ...c.props.map((p, i) => P([lvl, i + 1, p.name, p.typeName, p.isReadOnly ?? false, values[i] ?? null])),
    ],
  }
}

const block = (t: Tree, owner: number | null, role: string, userLabel: string | null, build: (oid: number) => NcObjectNode[], oid = t.oid()): NcObjectNode => {
  const members = build(oid)
  return {
    classId: NC_BLOCK,
    oid,
    role,
    properties: [
      ...objectProps(NC_BLOCK, oid, owner, role, userLabel),
      P([2, 1, 'enabled', 'NcBoolean', true, true]),
      P([
        2,
        2,
        'members',
        'NcBlockMemberDescriptor',
        true,
        members.map((m) => ({
          description: null,
          role: m.role,
          oid: m.oid,
          constantOid: true,
          classId: m.classId,
          userLabel: (m.properties.find((p) => p.name === 'userLabel')?.value as string | null) ?? null,
          owner: oid,
        })),
      ]),
    ],
    members,
  }
}

const managers = (t: Tree, owner: number, d: EquipmentItem, profile: SwitchingProfile | null): NcObjectNode[] => {
  const dmOid = t.oid()
  const cmOid = t.oid()
  const dm: NcObjectNode = {
    classId: NC_DEVICE_MANAGER,
    oid: dmOid,
    role: 'DeviceManager',
    properties: [
      ...objectProps(NC_DEVICE_MANAGER, dmOid, owner, 'DeviceManager', null),
      ...([
        [3, 1, 'ncVersion', 'NcVersionCode', true, 'v1.0.0'],
        [3, 2, 'manufacturer', 'NcManufacturer', true, { name: 'Unknown', organizationId: null, website: profile?.manufacturerUrl ?? d.manufacturerUrl ?? null }],
        [3, 3, 'product', 'NcProduct', true, { name: d.name, key: d.deviceTypeId ?? d.id, revisionLevel: '', brandName: null, uuid: null, description: d.subtitle ?? null }],
        [3, 4, 'serialNumber', 'NcString', true, d.serialNumber ?? ''],
        [3, 5, 'userInventoryCode', 'NcString', false, d.assetTag ?? null],
        [3, 6, 'deviceName', 'NcString', false, d.name],
        [3, 7, 'deviceRole', 'NcString', false, d.subtitle ?? null],
        [3, 8, 'operationalState', 'NcDeviceOperationalState', true, { generic: 0, deviceSpecificDetails: 'Planned in LZ Cable Planner' }],
        [3, 9, 'resetCause', 'NcResetCause', true, 0],
        [3, 10, 'message', 'NcString', true, null],
      ] as Prop[]).map(P),
    ],
  }
  const cm: NcObjectNode = {
    classId: NC_CLASS_MANAGER,
    oid: cmOid,
    role: 'ClassManager',
    properties: [
      ...objectProps(NC_CLASS_MANAGER, cmOid, owner, 'ClassManager', null),
      P([3, 1, 'controlClasses', 'NcClassDescriptor', true, LZ_CLASSES.map(classDescriptor)]),
      P([3, 2, 'datatypes', 'NcDatatypeDescriptor', true, LZ_DATATYPES]),
    ],
  }
  return [dm, cm]
}

/** NcEnum-Wert: die Nummer des Eintrags, `null` wenn nicht gesetzt. */
const enumValue = (items: readonly string[], v: string | undefined): number | null => {
  const i = v === undefined ? -1 : items.indexOf(v)
  return i < 0 ? null : i
}

const mixerMembers = (t: Tree, rootOid: number, d: EquipmentItem, m: InnerMatrix): NcObjectNode[] => {
  const s = d.switching
  const route = (dest: string) => routeOf(d, m, s, dest) ?? null
  const keyer = (owner: number, b: InnerBlock, role: string) => {
    const k = s?.keyers?.[b.id]
    return worker(t, owner, 'LzKeyer', role, [enumValue(KEYER_TYPES, k?.type), k?.onAir ?? false, route(`${b.id}/fill`), route(`${b.id}/key`)])
  }
  const out: NcObjectNode[] = []
  for (const b of m.blocks) {
    if (b.kind === 'mixEffect') {
      out.push(
        block(t, rootOid, `ME${b.index}`, null, (oid) => {
          const tr = s?.transitions?.[b.id]
          return [
            worker(t, oid, 'LzBus', 'Program', [route(`${b.id}/pgm`)]),
            worker(t, oid, 'LzBus', 'Preview', [route(`${b.id}/pvw`)]),
            worker(t, oid, 'LzTransition', 'Transition', [enumValue(TRANSITION_STYLES, tr?.style), tr?.rateMs ?? null, enumValue(WIPE_PATTERNS, tr?.wipe), tr?.dipSource ?? null]),
            ...m.blocks.filter((k) => k.parent === b.id).map((k) => keyer(oid, k, `Key${k.index}`)),
          ]
        }),
      )
    } else if (b.kind === 'superSource') {
      out.push(
        block(t, rootOid, `SuperSource${b.index}`, null, (oid) => [
          ...b.dests
            .filter((x) => x.role === 'box')
            .map((x) => {
              const box = s?.boxes?.[x.id]
              return worker(t, oid, 'LzBox', `Box${x.index}`, [
                route(x.id),
                box?.enabled ?? false,
                box?.x ?? null,
                box?.y ?? null,
                box?.size ?? null,
                box?.cropped ?? false,
              ])
            }),
          worker(t, oid, 'LzBus', 'ArtFill', [route(`${b.id}/art-fill`)]),
          worker(t, oid, 'LzBus', 'ArtKey', [route(`${b.id}/art-key`)]),
        ]),
      )
    } else if (b.kind === 'mediaPlayer') out.push(worker(t, rootOid, 'LzBus', `MediaPlayer${b.index}`, [route(`${b.id}/still`)]))
    else if (b.kind === 'downstreamKeyer') out.push(keyer(rootOid, b, `DSK${b.index}`))
    else if (b.kind === 'aux') out.push(worker(t, rootOid, 'LzBus', `Aux${b.index}`, [route(b.id)], b.portName ?? null))
  }
  return out
}

const routerMembers = (t: Tree, rootOid: number, d: EquipmentItem): NcObjectNode[] => {
  const ms = routerMatrixOf(d)
  const name = (id: string) => [...d.inputs, ...d.outputs].find((p) => p.id === id)?.name ?? id
  const crosspoints = Object.entries(ms.levels).flatMap(([level, table]) =>
    Object.entries(table).map(([dest, src]) => ({ level, destination: name(dest), source: name(src) })),
  )
  const locks = Object.entries(ms.locks).map(([dest, kind]) => ({ destination: name(dest), kind: LOCK_KINDS.indexOf(kind) }))
  return [worker(t, rootOid, 'LzCrosspoints', 'Crosspoints', [crosspoints, locks])]
}

/** Blockbaum fuer einen Mischer oder eine Kreuzschiene; `null` fuer andere Geraete. */
export const buildMs0502 = (d: EquipmentItem): Ms0502Export | null => {
  const profile = switchingProfileFor(d)
  if (!profile && !d.switching) return null
  const t = new Tree()
  const rootOid = t.oid()
  const root = block(
    t,
    null,
    'root',
    d.name,
    (oid) => [
      ...managers(t, oid, d, profile),
      ...(profile?.role === 'router' ? routerMembers(t, oid, d) : mixerMembers(t, oid, d, buildInnerMatrix(d, profile, d.switching))),
    ],
    rootOid,
  )
  return {
    equipmentId: d.id,
    device: d.name,
    root,
    controlClasses: LZ_CLASSES.map(classDescriptor),
    datatypes: [...LZ_DATATYPES],
  }
}
