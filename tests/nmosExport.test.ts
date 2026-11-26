import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import Ajv from 'ajv-draft-04'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import {
  buildNmosExport,
  equipmentFromPreview,
  parseRegistry,
  previewRegistry,
  RegistryFormatError,
} from '../src/renderer/lib/nmos'
import { taiVersion } from '../src/renderer/lib/nmos/ids'
import { classLevel, LZ_CLASSES, LZ_DATATYPES, type NcObjectNode } from '../src/renderer/lib/nmos/ms0502'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { CablePlannerProject } from '../src/renderer/types/project'

// ───────────────────────────────────────────────────────────────────────────
// #1240 Stufe 6 — NMOS-Ausgabe gegen die OFFIZIELLEN AMWA-Schemas.
// Die Schemas liegen unveraendert in tests/fixtures/amwa (Apache-2.0, siehe
// README dort). Selbstgeschriebene Schemas gelten hier nicht als Beleg.
// ───────────────────────────────────────────────────────────────────────────

const FIX = join(__dirname, 'fixtures', 'amwa')

const ajvFor = (dir: string) => {
  const ajv = new Ajv({ allErrors: true, strict: false })
  addFormats(ajv)
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    ajv.addSchema(JSON.parse(readFileSync(join(dir, f), 'utf8')), f)
  }
  return (schema: string, data: unknown) => {
    const ok = ajv.validate(schema, data)
    if (!ok) throw new Error(`${schema}: ${ajv.errorsText(ajv.errors, { separator: '\n' })}`)
  }
}

const is04 = ajvFor(join(FIX, 'is-04-v1.3.3', 'schemas'))
const is05 = ajvFor(join(FIX, 'is-05-v1.2.0', 'schemas'))
const is08 = ajvFor(join(FIX, 'is-08-v1.0.1', 'schemas'))

const port = (id: string, name: string, extra: Partial<Port> = {}): Port =>
  ({ id, name, type: 'SFP', connectorType: 'SFP', ...extra }) as Port

const dev = (id: string, name: string, inputs: Port[], outputs: Port[], extra: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name, category: 'Other', x: 0, y: 0, width: 260, height: 200, inputs, outputs, ...extra }) as EquipmentItem

const cable = (id: string, from: [string, string], to: [string, string], standard?: Cable['standard']): Cable =>
  ({
    id,
    name: id,
    type: 'fiber',
    color: '#000',
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
    notes: '',
    ...(standard ? { standard } : {}),
  }) as Cable

const catalog = (match: (e: (typeof BLACKMAGIC_CATALOG)[number]) => boolean, id: string): EquipmentItem => {
  const e = BLACKMAGIC_CATALOG.find(match)
  if (!e) throw new Error('catalog entry missing')
  const t = e.template
  return {
    id,
    name: t.name,
    category: t.category,
    x: 0,
    y: 0,
    width: 260,
    height: 200,
    deviceTypeId: e.deviceTypeId,
    inputs: (t.inputs ?? []).map((p, i) => ({ ...p, id: `${id}-in-${i}` })),
    outputs: (t.outputs ?? []).map((p, i) => ({ ...p, id: `${id}-out-${i}` })),
  } as unknown as EquipmentItem
}

const V = 'ST2110-20' as const
const A = 'ST2110-30' as const

const project = (): CablePlannerProject => {
  const cam = dev('cam', 'Camera 1', [], [port('cam-v', 'Video', { standard: V }), port('cam-a', 'Audio', { standard: A }), port('cam-anc', 'ANC', { standard: 'ST2110-40' })], {
    ipAddress: '10.0.0.11',
    macAddress: '00:11:22:33:44:55',
  })
  const cam2 = dev('cam2', 'Camera 2', [], [port('cam2-v', 'Video', { standard: 'ST2110-22' })])
  const router = dev(
    'rt',
    'IP router',
    [port('rt-i1', 'IN 1', { standard: V }), port('rt-i2', 'IN 2', { standard: V })],
    [port('rt-o1', 'OUT 1', { standard: V }), port('rt-o2', 'OUT 2', { standard: V })],
    {
      plannedCrosspoints: { 'rt-o1': 'rt-i1' },
      switching: {
        levels: { a1: { 'rt-o1': 'rt-i2' } },
        salvos: [{ id: 's1', name: 'Wide', crosspoints: { video: { 'rt-o1': 'rt-i2', 'rt-o2': 'rt-i1' } } }],
      },
    },
  )
  const mon = dev('mon', 'Monitor', [port('mon-v', 'IP IN', { standard: V })], [])
  const mon2 = dev('mon2', 'Monitor 2', [port('mon2-v', 'IP IN', { standard: V })], [])
  const desk = dev('desk', 'Audio desk', [port('desk-a', 'AES67 IN', { standard: A })], [])
  const atem = catalog((e) => e.switchingProfile?.role === 'mixer' && /2 M\/E Constellation 4K/.test(e.template.name), 'atem')
  atem.switching = {
    routes: { 'me:1/pgm': 'in:1', 'me:1/pvw': 'in:2', 'aux:1': 'me:1' },
    keyers: { 'me:1/key:1': { type: 'luma', onAir: true }, 'dsk:1': { onAir: false } },
    transitions: { 'me:1': { style: 'wipe', rateMs: 1000, wipe: 'circle' } },
    boxes: { 'ss:1/box:1': { enabled: true, x: -8, y: 4.5, size: 0.5 } },
  }
  atem.atemAudioConfig = {
    matrix: {
      sources: [
        { id: 1301, name: 'Mic 1' },
        { id: 1302, name: 'Mic 2' },
      ],
      outputs: [
        { id: 1, sourceId: 1302, name: 'Aux Audio 1' },
        { id: 2, sourceId: 0, name: 'Aux Audio 2' },
      ],
    },
  }
  const hub = catalog((e) => e.switchingProfile?.role === 'router', 'hub')
  return {
    metadata: { projectId: 'p-1', name: 'Truck', description: '', createdAt: '', updatedAt: '', defaultVideoFormat: '1080i50' },
    equipment: [cam, cam2, router, mon, mon2, desk, atem, hub],
    cables: [
      cable('c1', ['cam', 'cam-v'], ['rt', 'rt-i1']),
      cable('c2', ['cam2', 'cam2-v'], ['rt', 'rt-i2']),
      cable('c3', ['rt', 'rt-o1'], ['mon', 'mon-v']),
      cable('c4', ['rt', 'rt-o2'], ['mon2', 'mon2-v']),
      cable('c5', ['cam', 'cam-a'], ['desk', 'desk-a']),
    ],
    multicast: { pool: '239.10.0.0/16', basePort: 5004, assignments: [{ flowKey: 'cam:cam-v', leg: 'a', address: '239.10.0.1', port: 5004 }] },
  } as unknown as CablePlannerProject
}

const AT = new Date('2026-11-26T12:00:00.250Z')

describe('IS-04 aus dem Plan', () => {
  const out = buildNmosExport(project(), AT)

  it('jede Ressource besteht das offizielle Schema ihrer Art', () => {
    is04('nodes.json', out.is04.nodes)
    is04('devices.json', out.is04.devices)
    is04('sources.json', out.is04.sources)
    is04('flows.json', out.is04.flows)
    is04('senders.json', out.is04.senders)
    is04('receivers.json', out.is04.receivers)
    for (const n of out.is04.nodes) is04('node.json', n)
    for (const f of out.is04.flows) {
      const mt = String(f.media_type)
      is04(mt === 'video/raw' ? 'flow_video_raw.json' : mt.startsWith('video/smpte291') ? 'flow_sdianc_data.json' : mt.startsWith('video') ? 'flow_video_coded.json' : mt === 'audio/L24' ? 'flow_audio_raw.json' : 'flow_audio_coded.json', f)
    }
    for (const r of out.is04.receivers) {
      const fmt = String(r.format)
      is04(fmt.endsWith('video') ? 'receiver_video.json' : fmt.endsWith('audio') ? 'receiver_audio.json' : 'receiver_data.json', r)
    }
  })

  it('die Schemas greifen wirklich (Gegenprobe)', () => {
    const { flow_id: _f, ...ohneFlow } = out.is04.senders[0]
    expect(() => is04('sender.json', ohneFlow)).toThrow(/flow_id/)
    expect(() => is04('sender.json', { ...out.is04.senders[0], id: 'kein-uuid' })).toThrow()
    expect(() => is05('bulk-receiver-post-schema.json', [{ id: out.is04.receivers[0].id, params: { activation: { mode: 'jetzt' } } }])).toThrow()
  })

  it('Kreuzschiene und Mischer ohne 2110 sind kein NMOS-Geraet; jeder 2110-Anschluss ist Sender bzw. Receiver', () => {
    expect(out.is04.devices.map((d) => d.label).sort()).toEqual(['Audio desk', 'Camera 1', 'Camera 2', 'Monitor', 'Monitor 2'])
    expect(out.is04.senders).toHaveLength(4)
    expect(out.is04.receivers).toHaveLength(3)
    const raw = out.is04.flows.find((f) => f.media_type === 'video/raw')!
    expect(raw).toMatchObject({ frame_width: 1920, frame_height: 1080, interlace_mode: 'interlaced_tff', grain_rate: { numerator: 25, denominator: 1 } })
    const node = out.is04.nodes.find((n) => n.label === 'Camera 1')!
    expect(node.interfaces).toEqual([{ name: 'eth0', chassis_id: '00-11-22-33-44-55', port_id: '00-11-22-33-44-55' }])
    expect(node.href).toBe('http://10.0.0.11/')
  })

  it('UUIDs sind stabil; nur die TAI-Version folgt der Uhr', () => {
    const later = buildNmosExport(project(), new Date('2027-01-01T00:00:00Z'))
    expect(later.is04.senders.map((s) => s.id)).toEqual(out.is04.senders.map((s) => s.id))
    expect(later.is04.senders[0].version).not.toBe(out.is04.senders[0].version)
    expect(taiVersion(AT)).toBe(`${Math.floor(AT.getTime() / 1000) + 37}:250000000`)
    const other = buildNmosExport({ ...project(), metadata: { ...project().metadata, projectId: 'p-2' } }, AT)
    expect(other.is04.senders[0].id).not.toBe(out.is04.senders[0].id)
  })
})

describe('IS-05 Soll-Verbindungen und Salvos', () => {
  const p = project()
  const out = buildNmosExport(p, AT)
  const idOf = (list: Record<string, unknown>[], label: string, device: string) => {
    const devId = out.is04.devices.find((d) => d.label === device)!.id
    return list.find((x) => x.label === label && x.device_id === devId)!.id
  }

  it('besteht bulk-receiver-post-schema', () => {
    is05('bulk-receiver-post-schema.json', out.is05.bulkReceivers)
    for (const s of out.is05.salvos) is05('bulk-receiver-post-schema.json', s.bulkReceivers)
  })

  it('folgt dem Kreuzpunkt der Kreuzschiene und meldet den offenen Ausgang', () => {
    const monRx = idOf(out.is04.receivers, 'IP IN', 'Monitor')
    const entry = out.is05.bulkReceivers.find((b) => b.id === monRx)!
    expect(entry.params).toEqual({
      sender_id: idOf(out.is04.senders, 'Video', 'Camera 1'),
      master_enable: true,
      activation: { mode: 'activate_immediate' },
      transport_params: [{ multicast_ip: '239.10.0.1', destination_port: 5004, interface_ip: 'auto', rtp_enabled: true }],
    })
    const deskRx = idOf(out.is04.receivers, 'AES67 IN', 'Audio desk')
    expect(out.is05.bulkReceivers.find((b) => b.id === deskRx)?.params).toMatchObject({ sender_id: idOf(out.is04.senders, 'Audio', 'Camera 1') })
    expect(out.is05.open.map((o) => [o.label, o.reason])).toEqual([['Monitor 2 · IP IN', 'no-crosspoint']])
  })

  it('ein Salvo wird ein Bulk-Paket mit allen Receivern hinter seinen Ausgaengen', () => {
    expect(out.is05.salvos).toHaveLength(1)
    const s = out.is05.salvos[0]
    expect(s).toMatchObject({ name: 'Wide', device: 'IP router' })
    const bySender = Object.fromEntries(s.bulkReceivers.map((b) => [b.id, (b.params as { sender_id: string }).sender_id]))
    expect(bySender[idOf(out.is04.receivers, 'IP IN', 'Monitor') as string]).toBe(idOf(out.is04.senders, 'Video', 'Camera 2'))
    expect(bySender[idOf(out.is04.receivers, 'IP IN', 'Monitor 2') as string]).toBe(idOf(out.is04.senders, 'Video', 'Camera 1'))
  })
})

describe('IS-08 Kanalzuordnung', () => {
  const out = buildNmosExport(project(), AT)

  it('ATEM-Audio-Matrix und Audio-Ebene der Kreuzschiene bestehen io- und activations-Schema', () => {
    expect(out.is08.map((d) => `${d.device}:${d.kind}`).sort()).toEqual(['Blackmagic ATEM 2 M/E Constellation 4K:atem-audio', 'IP router:router-levels'])
    for (const d of out.is08) {
      is08('io-response-schema.json', d.io)
      is08('map-activations-post-request-schema.json', d.activation)
      // Das offizielle Schema schreibt die Eigenschaft als „action:“ — der Inhalt wird hier eigens geprueft.
      is08('map-entries-schema.json', d.activation.action)
    }
  })

  it('bildet Belegung, Breakaway und „nicht belegt“ ab', () => {
    const atem = out.is08.find((d) => d.kind === 'atem-audio')!
    expect(atem.activation.action).toEqual({
      'out-1': { '0': { input: 'src-1302', channel_index: 0 } },
      'out-2': { '0': { input: null, channel_index: null } },
    })
    const rt = out.is08.find((d) => d.kind === 'router-levels')!
    expect((rt.activation.action as Record<string, unknown>)['out-1']).toEqual({ '0': { input: 'in-2', channel_index: 0 } })
  })
})

// ─── MS-05-02 gegen die offiziellen Modelle ─────────────────────────────

const MODELS = join(FIX, 'ms-05-02-v1.0.0', 'models')
type Desc = { classId: number[]; name: string; properties: { id: { level: number; index: number }; name: string; typeName: string; isNullable: boolean; isSequence: boolean }[] }
const std: Desc[] = readdirSync(join(MODELS, 'classes')).map((f) => JSON.parse(readFileSync(join(MODELS, 'classes', f), 'utf8')))
const datatypes = new Map<string, { type: number; fields?: { name: string }[]; items?: { value: number }[] }>(
  readdirSync(join(MODELS, 'datatypes')).map((f) => {
    const d = JSON.parse(readFileSync(join(MODELS, 'datatypes', f), 'utf8'))
    return [d.name, d]
  }),
)
const fieldsOf = (name: string): string[] => {
  const d = datatypes.get(name) as { fields?: { name: string }[]; parentType?: string | null } | undefined
  if (!d) return []
  return [...(d.parentType ? fieldsOf(d.parentType) : []), ...(d.fields ?? []).map((f) => f.name)]
}
const PRIMITIVE: Record<string, (v: unknown) => boolean> = {
  NcBoolean: (v) => typeof v === 'boolean',
  NcString: (v) => typeof v === 'string',
  NcUint32: (v) => Number.isInteger(v) && (v as number) >= 0,
  NcFloat32: (v) => typeof v === 'number',
}

describe('MS-05-02-Blockbaum', () => {
  const out = buildNmosExport(project(), AT)
  const custom = out.ms0502[0].controlClasses as unknown as Desc[]
  const all = [...std, ...custom]
  const byKey = new Map(all.map((c) => [c.classId.join('.'), c]))
  const lineage = (id: number[]): Desc[] => {
    const res: Desc[] = []
    for (let n = 1; n <= id.length; n++) {
      const c = byKey.get(id.slice(0, n).join('.'))
      if (c) res.push(c)
    }
    return res
  }
  const lzTypes = new Map(LZ_DATATYPES.map((d) => [String(d.name), d]))

  it('eigene Klassen: Authority-Key 0, Ebene ohne Key gezaehlt, Felder wie NcClassDescriptor/NcPropertyDescriptor', () => {
    const classFields = fieldsOf('NcClassDescriptor').sort()
    const propFields = fieldsOf('NcPropertyDescriptor').sort()
    for (const c of out.ms0502[0].controlClasses) {
      expect(Object.keys(c).sort()).toEqual(classFields)
      const id = c.classId as number[]
      expect(id.slice(0, 3)).toEqual([1, 2, 0])
      expect(byKey.has('1.2')).toBe(true)
      for (const p of c.properties as Record<string, unknown>[]) {
        expect(Object.keys(p).sort()).toEqual(propFields)
        expect((p.id as { level: number }).level).toBe(classLevel(id))
      }
    }
    for (const d of LZ_DATATYPES) {
      const kind = d.type === 3 ? 'NcDatatypeDescriptorEnum' : 'NcDatatypeDescriptorStruct'
      expect(Object.keys(d).sort()).toEqual(fieldsOf(kind).sort())
    }
    expect(LZ_CLASSES.every((c) => c.classId[2] === 0)).toBe(true)
  })

  it('jedes Objekt traegt genau die Eigenschaften seiner Klassenlinie, mit passendem Typ', () => {
    const memberFields = fieldsOf('NcBlockMemberDescriptor').sort()
    let oids = new Set<number>()
    const check = (o: NcObjectNode) => {
      expect(oids.has(o.oid)).toBe(false)
      oids.add(o.oid)
      const expected = lineage(o.classId).flatMap((c) => c.properties)
      expect(o.properties.map((p) => `${p.id.level}p${p.id.index}:${p.name}:${p.typeName}`)).toEqual(
        expected.map((p) => `${p.id.level}p${p.id.index}:${p.name}:${p.typeName}`),
      )
      for (const [i, p] of o.properties.entries()) {
        const d = expected[i]
        if (p.value === null) {
          if (!d.isNullable) throw new Error(`${o.role}.${p.name} darf nicht null sein`)
          continue
        }
        if (d.isSequence) {
          expect(Array.isArray(p.value)).toBe(true)
          continue
        }
        const prim = PRIMITIVE[d.typeName]
        if (prim) expect(prim(p.value), `${o.role}.${p.name}`).toBe(true)
        const enumDef = lzTypes.get(d.typeName) ?? datatypes.get(d.typeName)
        if (enumDef && enumDef.type === 3) expect((enumDef.items as { value: number }[]).map((x) => x.value)).toContain(p.value)
        if (enumDef && enumDef.type === 2 && datatypes.has(d.typeName)) expect(Object.keys(p.value as object).sort()).toEqual(fieldsOf(d.typeName).sort())
      }
      if (o.members) {
        const members = o.properties.find((p) => p.name === 'members')!.value as Record<string, unknown>[]
        expect(members.map((m) => m.oid)).toEqual(o.members.map((m) => m.oid))
        for (const m of members) expect(Object.keys(m).sort()).toEqual(memberFields)
        expect(new Set(o.members.map((m) => m.role)).size).toBe(o.members.length)
        o.members.forEach(check)
      }
    }
    for (const tree of out.ms0502) {
      oids = new Set<number>()
      const roles = tree.root.members!.map((m) => m.role)
      expect(roles.slice(0, 2)).toEqual(['DeviceManager', 'ClassManager'])
      check(tree.root)
    }
  })

  it('Mischer zeigt M/E, Keyer, Uebergang und Box mit den geplanten Werten; Kreuzschiene die Kreuzpunkte', () => {
    const atem = out.ms0502.find((t) => t.equipmentId === 'atem')!
    const me1 = atem.root.members!.find((m) => m.role === 'ME1')!
    const val = (o: NcObjectNode, name: string) => o.properties.find((p) => p.name === name)?.value
    expect(val(me1.members!.find((m) => m.role === 'Program')!, 'source')).toBe('in:1')
    expect(val(me1.members!.find((m) => m.role === 'Key1')!, 'onAir')).toBe(true)
    expect(val(me1.members!.find((m) => m.role === 'Transition')!, 'rateMs')).toBe(1000)
    expect(me1.members!.filter((m) => m.role.startsWith('Key'))).toHaveLength(4)
    const ss = atem.root.members!.find((m) => m.role === 'SuperSource1')!
    expect(val(ss.members!.find((m) => m.role === 'Box1')!, 'x')).toBe(-8)
    expect(out.ms0502.find((t) => t.equipmentId === 'hub')!.root.members!.map((m) => m.role)).toEqual(['DeviceManager', 'ClassManager', 'Crosspoints'])
  })
})

describe('IS-04 einlesen', () => {
  const out = buildNmosExport(project(), AT)

  it('liest den eigenen Export, eine Query-Antwort und eine gemischte Liste', () => {
    const fromBundle = parseRegistry(out)
    expect(fromBundle.devices).toHaveLength(5)
    const mixed = parseRegistry([...out.is04.devices, ...out.is04.senders, ...out.is04.receivers, ...out.is04.flows, ...out.is04.nodes])
    expect(mixed).toEqual({ ...fromBundle })
    expect(() => parseRegistry({ nodes: [] })).toThrow(RegistryFormatError)
    expect(() => parseRegistry('x')).toThrow(RegistryFormatError)
  })

  it('Vorschau: Geraete mit Sendern und Empfaengern, Standard aus dem Medientyp, Vorhandenes erkannt', () => {
    const reg = parseRegistry(out.is04)
    const camId = String(out.is04.devices.find((d) => d.label === 'Camera 1')!.id)
    const pre = previewRegistry(reg, [{ nmosId: camId }])
    const cam = pre.devices.find((d) => d.nmosId === camId)!
    expect(cam).toMatchObject({ existing: true, ipAddress: '10.0.0.11' })
    expect(cam.senders.map((s) => s.standard)).toEqual(['ST2110-20', 'ST2110-30', 'ST2110-40'])
    const mon = pre.devices.find((d) => d.name === 'Monitor')!
    expect(mon.receivers).toEqual([expect.objectContaining({ label: 'IP IN', standard: 'ST2110-20' })])

    let n = 0
    const items = equipmentFromPreview(pre, new Set(pre.devices.map((d) => d.nmosId)), { x: 0, y: 0 }, () => `id-${++n}`)
    expect(items.map((e) => e.name).sort()).toEqual(['Audio desk', 'Camera 2', 'Monitor', 'Monitor 2'])
    expect(items.every((e) => e.importSource === 'nmos' && e.nmosId)).toBe(true)
    const cam2 = items.find((e) => e.name === 'Camera 2')!
    expect(cam2.outputs).toEqual([expect.objectContaining({ name: 'Video', standard: 'ST2110-22', direction: 'out' })])
  })
})
