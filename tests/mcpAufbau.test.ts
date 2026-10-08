import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectStore } from '../src/renderer/store/projectStore'
import { beantworteWerkzeug } from '../src/renderer/lib/mcpWerkzeuge'
import { EINGEBAUTER_KATALOG } from '../src/renderer/lib/eingebauterKatalog'

// ---------------------------------------------------------------------------
// #1052 — die Regie aus dem Erklaervideo, allein ueber die MCP-Werkzeuge.
//
// Der Video-Lauf brauchte rund 15 Anlaeufe gegen die Oberflaeche. Hier steht
// derselbe Aufbau als Folge von Werkzeugaufrufen gegen den echten Store —
// derselbe Weg, den `App.tsx` fuer eine Frage aus dem MCP-Server nimmt.
// ---------------------------------------------------------------------------

// Die Uhr laeuft je Aufruf weiter: ein Agent ruft ueber HTTP, nicht in einer
// Schleife, und der Schutz gegen Render-Schleifen (80 Aenderungen in 250 ms)
// soll hier nicht anschlagen.
const schreibe = (werkzeug: string, args: Record<string, unknown>) => {
  const antwort = useProjectStore.getState().mcpSchreiben(werkzeug, args)
  vi.advanceTimersByTime(300)
  return antwort
}

const lies = (werkzeug: string, args: Record<string, unknown>) => {
  const s = useProjectStore.getState()
  return beantworteWerkzeug(s.project, werkzeug, args, s.customLibrary)
}

const MISCHER = 'ATEM 2 M/E Constellation HD'

const GERAETE: Array<[string, string]> = [
  ['Blackmagic Studio Camera 4K Pro G2', 'Kamera 1'],
  ['Blackmagic Studio Camera 4K Pro G2', 'Kamera 2'],
  ['Blackmagic Studio Camera 4K Pro G2', 'Kamera 3'],
  ['Blackmagic Smart Videohub 20x20', 'Kreuzschiene'],
  ['Blackmagic Hyperdeck Studio HD Plus', 'HyperDeck'],
  ['Blackmagic Micro Converter SDI to HDMI 3G', 'Wandler DSM'],
  ['Blackmagic Micro Converter SDI to HDMI 3G', 'Wandler OSM'],
  ['Blackmagic Micro Converter SDI to HDMI 3G', 'Wandler Multiview'],
  ['NEC MultiSync P402', 'DSM'],
  ['NEC MultiSync P402', 'OSM'],
  ['NEC MultiSync P461', 'Multiview-Monitor'],
  ['NETGEAR M4250-9G1F-PoE+ (GSM4210PD)', 'Netzwerk-Switch'],
]

const k = (from: string, fromPort: string, to: string, toPort: string) => ({ from, fromPort, to, toPort })

const SOLL = [
  ...[1, 2, 3].flatMap((n) => [
    k(`Kamera ${n}`, '12G-SDI Out', MISCHER, `SDI In ${n}`),
    k(MISCHER, `SDI Out ${n}`, `Kamera ${n}`, '12G-SDI In (Return)'),
  ]),
  k(MISCHER, 'SDI Out 4', 'Kreuzschiene', 'SDI In 1'),
  k(MISCHER, 'SDI Out 5', 'Kreuzschiene', 'SDI In 2'),
  k(MISCHER, 'SDI Out 7', 'Kreuzschiene', 'SDI In 4'),
  k(MISCHER, 'SDI Out 8', 'Kreuzschiene', 'SDI In 5'),
  k(MISCHER, 'SDI Out 9', 'Kreuzschiene', 'SDI In 6'),
  k('Kreuzschiene', 'SDI Out 1', 'HyperDeck', 'SDI In 1'),
  k('HyperDeck', 'SDI Out 1', MISCHER, 'SDI In 4'),
  k('Kreuzschiene', 'SDI Out 2', 'Wandler DSM', 'SDI In'),
  k('Wandler DSM', 'HDMI Out', 'DSM', 'HDMI In'),
  k('Kreuzschiene', 'SDI Out 3', 'Wandler OSM', 'SDI In'),
  k('Wandler OSM', 'HDMI Out', 'OSM', 'HDMI In'),
  k(MISCHER, 'Multiview Out 1', 'Wandler Multiview', 'SDI In'),
  k('Wandler Multiview', 'HDMI Out', 'Multiview-Monitor', 'HDMI In'),
  // Die Ports des eigenen Geraets heissen wie im Dialog: „<Praefix> <n>".
  k('Netzwerk-Switch', 'Port 1 (1G, PoE+)', MISCHER, 'Ethernet 1'),
  k('Netzwerk-Switch', 'Port 2 (1G, PoE+)', 'Kreuzschiene', 'Ethernet'),
]

const alsKabel = (s: ReturnType<typeof k>) => ({
  fromDeviceId: s.from,
  fromPortId: s.fromPort,
  toDeviceId: s.to,
  toPortId: s.toPort,
})

const baueRegie = () => {
  const mischer = schreibe('create_device', {
    name: MISCHER,
    category: 'Video Mixer',
    rackUnits: 1,
    portGroups: [
      { direction: 'in', count: 20, connector: 'BNC', labelPrefix: 'SDI In' },
      { direction: 'in', count: 1, connector: 'BNC', labelPrefix: 'Ref In' },
      { direction: 'in', count: 1, connector: 'Ethernet/RJ45', labelPrefix: 'Ethernet' },
      { direction: 'in', count: 2, connector: 'Jack 6.35 mm TRS', labelPrefix: 'Audio In' },
      { direction: 'out', count: 12, connector: 'BNC', labelPrefix: 'SDI Out' },
      { direction: 'out', count: 2, connector: 'BNC', labelPrefix: 'Multiview Out' },
    ],
  })
  expect(mischer.ok, mischer.text).toBe(true)
  for (const [template, name] of GERAETE) {
    const a = schreibe('add_device', { template, name })
    expect(a.ok, a.text).toBe(true)
  }
  return mischer
}

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(() => {
  vi.useFakeTimers()
  const s = useProjectStore.getState()
  useProjectStore.setState({
    project: { ...s.project, equipment: [], cables: [], mcpLog: [] },
    customLibrary: [...EINGEBAUTER_KATALOG],
    groupPresets: [],
  })
})

describe('#1052 — die Regie aus dem Erklaervideo', () => {
  it('entsteht allein ueber die Werkzeuge, und verify_cabling meldet 0 Abweichungen', () => {
    baueRegie()
    expect(useProjectStore.getState().project.equipment).toHaveLength(13)

    const r = schreibe('connect_many', { cables: SOLL.map(alsKabel) })
    expect(r.ok, JSON.stringify(r.daten.results)).toBe(true)
    expect(r.daten.created).toBe(21)
    expect(r.daten.refused).toBe(0)

    const pruefung = lies('verify_cabling', { expected: SOLL })
    expect(pruefung.daten.deviations, JSON.stringify(pruefung.daten)).toBe(0)
    expect(pruefung.daten.matched).toBe(21)

    // Ein Nachweis je Aufruf: 1 eigenes Geraet + 12 Bibliotheksgeraete + 1 Stapel.
    expect(useProjectStore.getState().project.mcpLog).toHaveLength(14)
  })

  it('der Kabeltyp kommt aus den Steckern, wie im Kabeldialog', () => {
    baueRegie()
    schreibe('connect_many', { cables: SOLL.map(alsKabel) })
    const kabel = useProjectStore.getState().project.cables
    const sdi = kabel.filter((c) => c.type === 'BNC')
    const hdmi = kabel.filter((c) => c.type === 'HDMI')
    const netz = kabel.filter((c) => c.type === 'Ethernet/RJ45')
    expect([sdi.length, hdmi.length, netz.length]).toEqual([16, 3, 2])
    expect(kabel.every((c) => c.cableSpecId)).toBe(true)
  })

  it('arrange_rack aus Mischer, Kreuzschiene und HyperDeck traegt die 7 internen Kabel', () => {
    baueRegie()
    schreibe('connect_many', { cables: SOLL.map(alsKabel) })
    const a = schreibe('arrange_rack', { deviceIds: [MISCHER, 'Kreuzschiene', 'HyperDeck'], name: 'Regie-Rack' })
    expect(a.ok, a.text).toBe(true)
    expect(a.daten.internalCables).toBe(7)
    expect(a.daten.usedUnits).toBe(3)
    const preset = useProjectStore.getState().groupPresets.find((p) => p.name === 'Regie-Rack')
    expect(preset?.cables).toHaveLength(7)
    expect(preset?.rack?.placements.map((p) => p.startUnit)).toEqual([1, 2, 3])
    // Der Plan selbst bleibt, wie er war.
    expect(useProjectStore.getState().project.cables).toHaveLength(21)
  })

  it('arrange_rack lehnt ein zu kleines Rack ab', () => {
    baueRegie()
    const a = schreibe('arrange_rack', { deviceIds: [MISCHER, 'Kreuzschiene', 'HyperDeck'], totalUnits: 2 })
    expect(a.ok).toBe(false)
    expect(a.text).toContain('need 3 RU')
  })
})

describe('#1052 — eigenes Geraet', () => {
  it('benennt die Ports wie der Dialog', () => {
    const a = baueRegie()
    expect(a.daten.rackUnits).toBe(1)
    const ports = a.daten.ports as Array<{ name: string; direction: string; connectorType: string }>
    const namen = (richtung: string) => ports.filter((p) => p.direction === richtung).map((p) => p.name)
    expect(namen('in')).toEqual([
      ...Array.from({ length: 20 }, (_, i) => `SDI In ${i + 1}`),
      'Ref In 1',
      'Ethernet 1',
      'Audio In 1',
      'Audio In 2',
    ])
    expect(namen('out')).toEqual([
      ...Array.from({ length: 12 }, (_, i) => `SDI Out ${i + 1}`),
      'Multiview Out 1',
      'Multiview Out 2',
    ])
    expect(ports.find((p) => p.name === 'Audio In 1')?.connectorType).toBe('Jack 6.35 mm TRS')
    const geraet = useProjectStore.getState().project.equipment.find((e) => e.name === MISCHER)
    expect(geraet?.isRackDevice).toBe(true)
  })

  it('lehnt einen unbekannten Steckertyp ab', () => {
    const a = schreibe('create_device', {
      name: 'X',
      portGroups: [{ direction: 'in', count: 1, connector: 'bnc-ish' }],
    })
    expect(a.ok).toBe(false)
    expect(a.text).toContain('not a connector type')
  })

  it('speichert auf Wunsch in die Bibliothek', () => {
    const vorher = useProjectStore.getState().customLibrary.length
    schreibe('create_device', { name: 'Testgeraet', saveToLibrary: true, portGroups: [{ direction: 'out', count: 2, connector: 'HDMI' }] })
    expect(useProjectStore.getState().customLibrary.length).toBe(vorher + 1)
  })
})

describe('#1052 — Kabelregeln', () => {
  beforeEach(() => {
    baueRegie()
    schreibe('connect_many', { cables: SOLL.map(alsKabel) })
  })

  it('Eingang→Eingang wird mit Klartext abgelehnt', () => {
    const a = schreibe('connect_ports', alsKabel(k('Kamera 1', 'Ref In', MISCHER, 'SDI In 5')))
    expect(a.ok).toBe(false)
    expect(a.text).toContain('Both ends are inputs')
  })

  it('die umgekehrte Richtung wird gedreht', () => {
    const a = schreibe('connect_ports', alsKabel(k('Kreuzschiene', 'SDI In 10', MISCHER, 'SDI Out 10')))
    expect(a.ok, a.text).toBe(true)
    expect(a.daten.flipped).toBe(true)
    const s = useProjectStore.getState().project
    const neu = s.cables.at(-1)!
    expect(s.equipment.find((e) => e.id === neu.fromEquipmentId)?.name).toBe(MISCHER)
    expect(s.equipment.find((e) => e.id === neu.toEquipmentId)?.name).toBe('Kreuzschiene')
  })

  it('ein belegter Eingang ist ein Fehler, ausser mit replace', () => {
    const a = schreibe('connect_ports', alsKabel(k(MISCHER, 'SDI Out 11', 'Kreuzschiene', 'SDI In 1')))
    expect(a.ok).toBe(false)
    expect(a.text).toContain('already connected')
    expect(useProjectStore.getState().project.cables).toHaveLength(21)

    const b = schreibe('connect_ports', { ...alsKabel(k(MISCHER, 'SDI Out 11', 'Kreuzschiene', 'SDI In 1')), replace: true })
    expect(b.ok, b.text).toBe(true)
    expect(useProjectStore.getState().project.cables).toHaveLength(21)
  })

  it('connect_many meldet je Kabel, und zwei Kabel auf denselben Eingang sind auch im Stapel ein Fehler', () => {
    const a = schreibe('connect_many', {
      cables: [
        alsKabel(k(MISCHER, 'SDI Out 10', 'Kreuzschiene', 'SDI In 10')),
        alsKabel(k(MISCHER, 'SDI Out 11', 'Kreuzschiene', 'SDI In 10')),
        alsKabel(k(MISCHER, 'SDI Out 99', 'Kreuzschiene', 'SDI In 11')),
      ],
    })
    expect(a.daten.created).toBe(1)
    const r = a.daten.results as Array<{ ok: boolean; error?: string }>
    expect(r.map((x) => x.ok)).toEqual([true, false, false])
    expect(r[1].error).toContain('already gets cable 1')
    expect(r[2].error).toContain('no port "SDI Out 99"')
  })

  it('verify_cabling findet ein fehlendes und ein falsch gestecktes Kabel', () => {
    const soll = SOLL.map((s) =>
      s.from === MISCHER && s.fromPort === 'SDI Out 9' ? { ...s, toPort: 'SDI In 7' } : s,
    )
    soll.push(k('Kreuzschiene', 'SDI Out 4', 'HyperDeck', 'HDMI In'))
    const p = lies('verify_cabling', { expected: soll })
    expect(p.daten.deviations).toBe(2)
    expect(p.daten.missing).toHaveLength(1)
    expect(p.daten.wrongPort).toHaveLength(1)
    expect(p.daten.matched).toBe(20)
  })

  it('verify_cabling meldet falsche Richtung und Ueberzaehliges', () => {
    const umgedreht = SOLL.map((s) => (s.fromPort === 'HDMI Out' && s.from === 'Wandler DSM' ? k('DSM', 'HDMI In', 'Wandler DSM', 'HDMI Out') : s))
    const ohne = umgedreht.filter((s) => s.to !== 'OSM')
    const p = lies('verify_cabling', { expected: ohne })
    expect(p.daten.wrongDirection).toHaveLength(1)
    // OSM steht nicht mehr in der Liste: sein Kabel zaehlt nicht als ueberzaehlig.
    expect(p.daten.extra).toHaveLength(0)
    const mitOsm = [...ohne, k('Netzwerk-Switch', 'Port 3 (1G, PoE+)', 'OSM', 'HDMI In')]
    const q = lies('verify_cabling', { expected: mitOsm })
    expect(q.daten.extra).toHaveLength(1)
  })
})

describe('#1052 — Namen werden exakt aufgeloest', () => {
  beforeEach(() => {
    baueRegie()
  })

  it('Gross/Klein nur, wenn es eindeutig ist', () => {
    const a = schreibe('connect_ports', alsKabel(k('kamera 1', '12g-sdi out', MISCHER, 'SDI In 1')))
    expect(a.ok, a.text).toBe(true)
  })

  it('zwei Geraete mit demselben Namen: Fehler mit Kandidaten', () => {
    schreibe('add_device', { template: 'NEC MultiSync P402', name: 'DSM' })
    const a = schreibe('connect_ports', alsKabel(k('Wandler DSM', 'HDMI Out', 'DSM', 'HDMI In')))
    expect(a.ok).toBe(false)
    expect(a.text).toContain('names 2 devices')
  })

  it('ein falscher Port nennt aehnliche', () => {
    const a = schreibe('connect_ports', alsKabel(k('Kamera 1', 'SDI Out', MISCHER, 'SDI In 1')))
    expect(a.ok).toBe(false)
    expect(a.text).toContain('Similar: "12G-SDI Out (out)"')
  })

  it('add_device lehnt einen unbekannten Vorlagennamen ab und nennt aehnliche', () => {
    const a = schreibe('add_device', { template: 'Studio Camera 4K Pro G2' })
    expect(a.ok).toBe(false)
    expect(a.text).toContain('"Blackmagic Studio Camera 4K Pro G2"')
  })
})

describe('#1052 — search_library und set_rack_units', () => {
  it('findet Vorlagen mit Ports, HE und Herstellerlink', () => {
    const a = lies('search_library', { query: 'studio camera g2' })
    const t = (a.daten.templates as Array<Record<string, unknown>>).find(
      (x) => x.template === 'Blackmagic Studio Camera 4K Pro G2',
    )
    expect(t).toBeDefined()
    expect((t!.ports as Array<{ name: string }>).map((p) => p.name)).toContain('12G-SDI Out')
    expect(t!.rackUnits).toBeNull()
    const hub = lies('search_library', { query: 'Smart Videohub 20x20' })
    expect((hub.daten.templates as Array<{ rackUnits: number }>)[0].rackUnits).toBe(1)
  })

  it('setzt die Rackhoehe und lehnt Unsinn ab', () => {
    baueRegie()
    expect(schreibe('set_rack_units', { deviceId: 'Netzwerk-Switch', rackUnits: 1 }).ok).toBe(true)
    const sw = useProjectStore.getState().project.equipment.find((e) => e.name === 'Netzwerk-Switch')
    expect([sw?.isRackDevice, sw?.rackUnits]).toEqual([true, 1])
    expect(schreibe('set_rack_units', { deviceId: 'Netzwerk-Switch', rackUnits: 0.5 }).ok).toBe(false)
  })
})
