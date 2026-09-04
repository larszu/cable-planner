import { describe, expect, it } from 'vitest'
import {
  SOURCE_MAP_KIND,
  SOURCE_MAP_VERSION,
  buildSourceMap,
  mergeSourceMap,
  parseSourceMap,
} from '../src/renderer/lib/sourceMap'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

const port = (id: string, name: string, over: Partial<Port> = {}): Port => ({
  id,
  name,
  type: 'BNC',
  connectorType: 'BNC',
  ...over,
})

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Video',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const cable = (from: [string, string], to: [string, string]): Cable => ({
  id: `${from[1]}->${to[1]}`,
  name: `${from[1]}->${to[1]}`,
  type: 'BNC',
  length: 10,
  color: '#fff',
  fromEquipmentId: from[0],
  fromPortId: from[1],
  toEquipmentId: to[0],
  toPortId: to[1],
  notes: '',
})

const META = { appVersion: '1.2.3', exportedAt: '2026-01-01T00:00:00.000Z' }

const scene = () => ({
  equipment: [
    eq({
      id: 'atem',
      name: 'ATEM Mini Extreme',
      inputs: [port('in1', 'In 1', { contentLabel: 'Kamera 1' })],
    }),
    eq({
      id: 'cam1',
      name: 'Blackmagic URSA',
      category: 'Kameras',
      outputs: [port('cam1-out', 'SDI Out')],
      sourceIdentityId: 'r1',
    }),
  ],
  cables: [cable(['cam1', 'cam1-out'], ['atem', 'in1'])],
  sourceIdentities: [{ id: 'r1', name: 'Kamera 1', number: 1, umdAddress: 3 }],
})

describe('buildSourceMap', () => {
  it('schreibt die Rolle mit Anker, Bindung und Eingangsnummer', () => {
    const { map } = buildSourceMap(scene(), META)
    expect(map).toMatchObject({ kind: SOURCE_MAP_KIND, formatVersion: SOURCE_MAP_VERSION })
    expect(map.sources).toHaveLength(1)
    expect(map.sources[0]).toMatchObject({
      id: 'r1',
      name: 'Kamera 1',
      number: 1,
      umdAddress: 3,
    })
    expect(map.sources[0].bindings[0]).toMatchObject({
      equipmentId: 'cam1',
      equipmentName: 'Blackmagic URSA',
      sinkEquipmentId: 'atem',
      input: 1,
      hops: 0,
    })
  })

  it('markiert jeden Wert als geplant — der Planer misst nicht', () => {
    const { map } = buildSourceMap(scene(), META)
    expect(map.sources[0].provenance).toEqual({
      name: 'planned',
      number: 'planned',
      umdAddress: 'planned',
    })
  })

  it('schreibt die Labels so, wie das Zielsystem sie wirklich zeigt', () => {
    const { map } = buildSourceMap(scene(), META)
    // ATEM-Kurzname ist 4 Byte: aus "Kamera 1" wird "KAME".
    expect(map.sources[0].labels['atem-input-short']).toBe('KAME')
    expect(map.sources[0].labels['atem-input-long']).toBe('Kamera 1')
    expect(map.sources[0].labels['tsl-umd-v31']).toBe('Kamera 1')
  })

  it('nennt, was der Plan nicht beantwortet, statt es wegzulassen', () => {
    const s = scene()
    s.equipment[1].sourceIdentityId = undefined
    s.sourceIdentities = []
    const { map } = buildSourceMap(s, META)
    expect(map.sources).toEqual([])
    expect(map.unresolved).toHaveLength(1)
    expect(map.unresolved[0]).toMatchObject({ field: 'umd-address', equipmentId: 'cam1' })
  })

  it('liefert eine leere Rollenliste, wenn es keine Rollen gibt', () => {
    // Das ist die richtige Antwort, kein Fehler: das Format transportiert
    // Identität, und ohne Rolle gibt es keine.
    const { map } = buildSourceMap({ equipment: [], cables: [], sourceIdentities: [] }, META)
    expect(map.sources).toEqual([])
    expect(map.unresolved).toEqual([])
  })

  it('kommt mit einer Rolle ohne verkabeltes Gerät klar', () => {
    const { map } = buildSourceMap(
      { equipment: [], cables: [], sourceIdentities: [{ id: 'r1', name: 'Kamera 1' }] },
      META,
    )
    expect(map.sources[0].bindings).toEqual([])
    expect(map.sources[0].provenance).toEqual({ name: 'planned' })
  })
})

describe('parseSourceMap', () => {
  it('liest, was buildSourceMap geschrieben hat', () => {
    const { map } = buildSourceMap(scene(), META)
    const back = parseSourceMap(JSON.stringify(map))
    expect(back.sources[0]).toMatchObject({ id: 'r1', name: 'Kamera 1', umdAddress: 3 })
  })

  it('weist an, was gar keine Karte ist', () => {
    expect(() => parseSourceMap('{"kind":"avplan"}')).toThrow(/av-source-map/)
    expect(() => parseSourceMap('nope')).toThrow()
  })

  it('weist eine neuere Formatversion ab, statt sie halb zu lesen', () => {
    const text = JSON.stringify({ kind: SOURCE_MAP_KIND, formatVersion: 99, sources: [] })
    expect(() => parseSourceMap(text)).toThrow(/neuer als unterstuetzt/)
  })

  it('hebt unbekannte Felder nach extra, statt sie zu verlieren', () => {
    const text = JSON.stringify({
      kind: SOURCE_MAP_KIND,
      formatVersion: 1,
      zukunft: { irgendwas: true },
      sources: [{ id: 'r1', name: 'Kamera 1', isoPrefix: 'CAM1_' }],
    })
    const map = parseSourceMap(text)
    expect(map.extra).toEqual({ zukunft: { irgendwas: true } })
    expect(map.sources[0].extra).toEqual({ isoPrefix: 'CAM1_' })
  })

  it('überspringt einen namenlosen Eintrag, statt den ganzen Import zu kippen', () => {
    const text = JSON.stringify({
      kind: SOURCE_MAP_KIND,
      formatVersion: 1,
      sources: [{ id: 'r1' }, { id: 'r2', name: 'Kamera 2' }],
    })
    expect(parseSourceMap(text).sources.map((s) => s.id)).toEqual(['r2'])
  })
})

describe('mergeSourceMap', () => {
  const mapWith = (entry: Record<string, unknown>) =>
    parseSourceMap(
      JSON.stringify({ kind: SOURCE_MAP_KIND, formatVersion: 1, sources: [entry] }),
    )

  it('legt eine unbekannte Rolle an', () => {
    const out = mergeSourceMap([], mapWith({ id: 'r1', name: 'Kamera 1', umdAddress: 3 }))
    expect(out.added).toEqual(['Kamera 1'])
    expect(out.identities).toEqual([{ id: 'r1', name: 'Kamera 1', umdAddress: 3 }])
  })

  it('füllt eine Lücke, überschreibt aber nichts', () => {
    const out = mergeSourceMap(
      [{ id: 'r1', name: 'Kamera 1' }],
      mapWith({ id: 'r1', name: 'Kamera 1', umdAddress: 3 }),
    )
    expect(out.filled).toEqual(['Kamera 1 · umdAddress'])
    expect(out.identities[0].umdAddress).toBe(3)
    expect(out.conflicts).toEqual([])
  })

  it('meldet einen abweichenden Wert als Konflikt, statt ihn zu übernehmen', () => {
    // Ein Import, der stillschweigend die Tally-Adresse ändert, ist im
    // Betrieb nicht zurückzuverfolgen.
    const out = mergeSourceMap(
      [{ id: 'r1', name: 'Kamera 1', umdAddress: 3 }],
      mapWith({ id: 'r1', name: 'Kamera 1', umdAddress: 7 }),
    )
    expect(out.identities[0].umdAddress).toBe(3)
    expect(out.conflicts).toEqual([
      { name: 'Kamera 1', field: 'umdAddress', mine: '3', theirs: '7' },
    ])
  })

  it('übernimmt keine Adresse, die das Protokoll nicht kennt', () => {
    const out = mergeSourceMap([], mapWith({ id: 'r1', name: 'Kamera 1', umdAddress: 999 }))
    expect(out.identities[0].umdAddress).toBeUndefined()
    expect(out.rejected[0]).toMatchObject({ name: 'Kamera 1', field: 'umdAddress', value: '999' })
  })

  it('nennt Felder beim Namen, für die es hier keinen Platz gibt', () => {
    const out = mergeSourceMap([], mapWith({ id: 'r1', name: 'Kamera 1', isoPrefix: 'CAM1_' }))
    expect(out.unrepresented).toEqual(['Kamera 1.isoPrefix'])
  })

  it('lässt die vorhandene Liste unangetastet', () => {
    const existing = [{ id: 'r1', name: 'Kamera 1' }]
    mergeSourceMap(existing, mapWith({ id: 'r1', name: 'Kamera 1', umdAddress: 3 }))
    expect(existing[0].umdAddress).toBeUndefined()
  })
})

describe('Rundreise', () => {
  it('überlebt build → parse → merge ohne Verlust', () => {
    const s = scene()
    const { map } = buildSourceMap(s, META)
    const back = parseSourceMap(JSON.stringify(map))
    const merged = mergeSourceMap([], back)
    expect(merged.identities).toEqual(s.sourceIdentities)
    expect(merged.conflicts).toEqual([])
    expect(merged.rejected).toEqual([])
    expect(merged.unrepresented).toEqual([])
  })
})

describe('mergeSourceMap — Provenienz, die der Plan nicht halten kann (ADR-005)', () => {
  // Die Blindstelle des extra-Fachs: `provenance` ist ein BEKANNTER Schluessel,
  // also hebt collectExtra ihn nicht auf — und `SourceIdentity` hat kein Feld
  // dafuer (bewusst minimal, ADR-001). Ein von einer Runtime als `confirmed`
  // gemeldeter Wert kommt deshalb als `planned` wieder heraus. Bis der Plan
  // Provenienz halten kann, muss der Import es wenigstens sagen.
  const mapWith = (provenance: Record<string, string>) =>
    ({
      kind: 'av-source-map',
      formatVersion: 1,
      app: 'tally-pi',
      appVersion: '1.0.0',
      exportedAt: 't',
      sources: [
        {
          id: 's1',
          name: 'Kamera 1',
          umdAddress: 4,
          provenance,
          bindings: [],
          labels: {},
        },
      ],
      unresolved: [],
    }) as never

  it('meldet einen bestaetigten Wert als nicht darstellbar', () => {
    const r = mergeSourceMap([], mapWith({ name: 'planned', umdAddress: 'confirmed' }))
    expect(r.unrepresented).toContain('Kamera 1.provenance.umdAddress (confirmed)')
  })

  it('meldet auch `commanded` — alles ausser planned ist Wissen, das verloren geht', () => {
    const r = mergeSourceMap([], mapWith({ umdAddress: 'commanded' }))
    expect(r.unrepresented).toContain('Kamera 1.provenance.umdAddress (commanded)')
  })

  it('meldet `planned` NICHT — das ist genau das, was der Plan ohnehin ausdrueckt', () => {
    const r = mergeSourceMap([], mapWith({ name: 'planned', umdAddress: 'planned' }))
    expect(r.unrepresented.filter((u) => u.includes('provenance'))).toEqual([])
  })

  it('uebernimmt den Wert trotzdem — Melden heisst nicht Verweigern', () => {
    // ADR-005 unterscheidet: bewahren, verweigern, melden. Hier ist melden
    // richtig — eine Adresse abzulehnen, nur weil ihre Herkunft nicht mitkann,
    // waere eigener Schaden.
    const r = mergeSourceMap([], mapWith({ umdAddress: 'confirmed' }))
    expect(r.identities[0].umdAddress).toBe(4)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// ADR-005, Inkrement 4 — eine Rolle mit zwei Geraeten.
//
// `labels` steht EINMAL je Rolle, wird aber in der Schleife ueber die Geraete
// beschrieben. Bei Haupt- und Backup-Kamera auf zwei ATEM-Eingaengen ueberlebt
// nur das zuletzt gelesene Geraet — und welches das ist, entscheidet die
// Reihenfolge in `project.equipment`.
//
// Der Typ verspricht „was das jeweilige Zielsystem nach seinem Zeichenbudget
// wirklich zeigt". Es zeigt zwei verschiedene Beschriftungen; in der Datei
// steht eine, ohne Hinweis darauf, welche.
//
// Die Datei RICHTIG zu machen hiesse, `labels` in die `bindings` zu ziehen —
// das aendert das Draht-Format und ist deshalb nicht Sache dieses Fixes. Was
// hier geht und Regel 3 verlangt: es sagen.
describe('buildSourceMap — Rolle mit mehreren Geraeten', () => {
  const zweiGeraete = () => ({
    equipment: [
      eq({
        id: 'atem',
        name: 'ATEM Mini Extreme',
        inputs: [
          port('in1', 'In 1', { contentLabel: 'Kamera 1 Haupt' }),
          port('in2', 'In 2', { contentLabel: 'Kamera 1 Backup' }),
        ],
      }),
      eq({
        id: 'cam-haupt',
        name: 'URSA Haupt',
        category: 'Kameras',
        outputs: [port('haupt-out', 'SDI Out')],
        sourceIdentityId: 'r1',
      }),
      eq({
        id: 'cam-backup',
        name: 'URSA Backup',
        category: 'Kameras',
        outputs: [port('backup-out', 'SDI Out')],
        sourceIdentityId: 'r1',
      }),
    ],
    cables: [
      cable(['cam-haupt', 'haupt-out'], ['atem', 'in1']),
      cable(['cam-backup', 'backup-out'], ['atem', 'in2']),
    ],
    sourceIdentities: [{ id: 'r1', name: 'Kamera 1', number: 1, umdAddress: 3 }],
  })

  it('meldet die Rolle, statt still eine der beiden Beschriftungen zu behaupten', () => {
    const { ambiguousLabels } = buildSourceMap(zweiGeraete(), META)
    expect(ambiguousLabels).toEqual([
      { name: 'Kamera 1', devices: ['URSA Haupt', 'URSA Backup'] },
    ])
  })

  it('schreibt trotzdem beide Bindungen — die Datei verliert die Geraete nicht', () => {
    // Wichtig fuer die Einordnung: NUR `labels` ist flach. `bindings` traegt
    // beide Geraete samt Eingang. Deshalb waere die Datei auch reparabel,
    // ohne etwas dazuzuerfinden.
    const { map } = buildSourceMap(zweiGeraete(), META)
    expect(map.sources[0].bindings.map((b) => b.equipmentId)).toEqual([
      'cam-haupt',
      'cam-backup',
    ])
    expect(map.sources[0].bindings.map((b) => b.input)).toEqual([1, 2])
  })

  it('haelt fest, WAS verloren geht: nur eine Beschriftung steht in der Datei', () => {
    // Dieser Test beschreibt den heutigen, falschen Zustand — bewusst. Wer
    // `labels` in die `bindings` zieht, bringt ihn zu Fall und muss ihn
    // anfassen, statt die Aenderung unbemerkt vorbeizuschieben.
    //
    // GENAU DAS IST PASSIERT (B-28, 2026-09-04). Seit die gebundene Rolle
    // gegen den Portnamen gewinnt, tragen BEIDE Eingaenge "Kamera 1" statt
    // "Kamera 1 Haupt" / "Kamera 1 Backup". Der Verlust, den dieser Test
    // festhaelt, ist derselbe geblieben — flach ist flach —, aber seine
    // Gestalt hat gewechselt: vorher ueberschrieb die zweite Beschriftung
    // die erste und man sah, WELCHE gewonnen hat; jetzt sind sie gleich.
    //
    // Das ist die richtige Richtung und nicht bloss eine andere: eine Rolle
    // heisst in jedem Zielsystem gleich, auch wenn die Havarie-Kamera
    // einspringt — dafuer gibt es sie. Die Zuordnung, welches GERAET an
    // welchem Eingang haengt, geht dabei nicht verloren, sie steht in
    // `bindings` (Test darueber). Und `ambiguousLabels` meldet den Fall
    // weiterhin, statt ihn stillschweigend hinzunehmen.
    const { map } = buildSourceMap(zweiGeraete(), META)
    const labels = map.sources[0].labels
    expect(labels['atem-input-long']).toBe('Kamera 1')
    expect(Object.keys(labels).filter((k) => k.startsWith('atem-input'))).toHaveLength(2)
  })

  it('meldet nichts, wenn die Rolle nur ein Geraet hat', () => {
    expect(buildSourceMap(scene(), META).ambiguousLabels).toEqual([])
  })
})
