import { describe, expect, it } from 'vitest'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { LocationFrame } from '../src/renderer/types/location'
import {
  durchgaenge,
  durchgaengeTable,
  trassenplanHtml,
  trassenplanStandTable,
} from '../src/renderer/lib/trassenplan'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'

// ---------------------------------------------------------------------------
// Trassenplan und Durchgänge: welche Kabel welche Raumgrenze, welchen
// Schachtzugang und welche Geschossdecke passieren. Gerechnet aus demselben
// Modell wie die 3D-Ansicht — und nur so weit, wie der Plan es weiss.
// ---------------------------------------------------------------------------

const geraet = (id: string, x: number, y: number): EquipmentItem =>
  ({ id, name: id, category: 'Video', inputs: [], outputs: [], x, y, width: 40, height: 40 }) as EquipmentItem

const kabel = (id: string, von: string, nach: string, over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: id,
    cableNumber: id,
    type: 'BNC',
    length: 5,
    color: '#000',
    fromEquipmentId: von,
    fromPortId: 'a',
    toEquipmentId: nach,
    toPortId: 'b',
    notes: '',
    ...over,
  }) as Cable

const rahmen = (id: string, x: number, floor: string | undefined, over: Partial<LocationFrame> = {}): LocationFrame =>
  ({ id, name: id, x, y: 0, width: 300, height: 200, color: '#00f', ...(floor ? { floor } : {}), ...over }) as LocationFrame

const haus = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Haus', createdAt: '', updatedAt: '' },
    equipment: [
      geraet('PTZ 1', 20, 20),
      geraet('PTZ 2', 80, 20),
      geraet('WAF', 200, 20),
      geraet('Rack', 420, 20),
      geraet('ATEM', 1020, 20),
      geraet('Irgendwo', 3000, 3000),
    ],
    cables: [
      kabel('V-101', 'PTZ 1', 'WAF'),
      // Saal → Technik (gleiche Etage): eine Raumgrenze.
      kabel('N-101', 'PTZ 2', 'Rack', { jacketRating: 'LSZH', pathway: 'KT-EG-1' }),
      // Saal (EG) → Regie (2. OG) über den Schacht.
      kabel('HS-V01', 'WAF', 'ATEM', { jacketRating: 'B2ca', pathway: 'Schacht S1' }),
      kabel('HS-V02', 'WAF', 'ATEM'),
      // Ein Ende ausserhalb jedes Raums.
      kabel('X-1', 'Irgendwo', 'ATEM'),
    ],
    locations: [
      rahmen('Saal', 0, 'EG'),
      rahmen('Technik', 400, 'EG'),
      rahmen('Regie', 1000, '2. OG'),
      rahmen('S1', 700, 'EG', { width: 60, height: 60, steigschacht: true }),
    ],
    floors: [
      { name: 'EG', elevationM: 0 },
      { name: '1. OG' },
      { name: '2. OG', elevationM: 8 },
    ],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

describe('durchgaenge', () => {
  it('nennt die Raumgrenze auf derselben Etage', () => {
    const { durchgaenge: liste } = durchgaenge(haus())
    const grenze = liste.find((d) => d.art === 'raumgrenze')!
    expect(grenze.ort).toBe('Saal | Technik')
    expect(grenze.etage).toBe('EG')
    expect(grenze.kabelIds).toEqual(['N-101'])
  })

  it('fuehrt einen Etagenwechsel durch Schachtzugang, jede Geschossdecke und wieder hinaus', () => {
    const { durchgaenge: liste } = durchgaenge(haus())
    const orte = liste.filter((d) => d.kabelIds.includes('HS-V01')).map((d) => `${d.art}: ${d.ort}`)
    expect(orte).toEqual([
      'schachtzugang: Regie ↔ S1',
      'schachtzugang: Saal ↔ S1',
      // Die Etage ohne Hoehe liegt dazwischen — sie wird durchquert, nicht
      // uebersprungen.
      'geschossdecke: S1: EG / 1. OG',
      'geschossdecke: S1: 1. OG / 2. OG',
    ])
  })

  it('bündelt die Kabel je Übergang, statt jedes einzeln zu zählen', () => {
    const { durchgaenge: liste } = durchgaenge(haus())
    const decke = liste.find((d) => d.ort === 'S1: EG / 1. OG')!
    expect(decke.kabelIds).toEqual(['HS-V01', 'HS-V02'])
  })

  it('zaehlt ein Kabel mit einem Ende ausserhalb jedes Raums, statt es zu erfinden', () => {
    expect(durchgaenge(haus()).ohneRaum).toBe(1)
  })

  it('sagt ohne Schacht, dass der Weg nicht bekannt ist', () => {
    const p = haus()
    p.locations = p.locations!.filter((l) => !l.steigschacht)
    const { durchgaenge: liste } = durchgaenge(p)
    const offen = liste.find((d) => d.art === 'ohne-weg')!
    expect(offen.ort).toBe('Regie → Saal')
    expect(offen.grund).toBe('schacht')
    expect(liste.some((d) => d.art === 'geschossdecke')).toBe(false)
  })

  it('ohne Etagenliste ist jeder Wechsel eine Raumgrenze', () => {
    const p = haus({ floors: [] })
    p.locations = p.locations!.map((l) => ({ ...l, floor: undefined }))
    const arten = new Set(durchgaenge(p).durchgaenge.map((d) => d.art))
    expect([...arten]).toEqual(['raumgrenze'])
  })
})

describe('durchgaengeTable', () => {
  it('zaehlt Mäntel je Klasse und nennt die fehlenden im Befund', () => {
    const t = durchgaengeTable(haus())
    expect(t.headers).toEqual(['Durchgang', 'Art', 'Etage', 'Kabel', 'Anzahl', 'Mantel/Brandklasse', 'Trasse/Pfad', 'Befund'])
    const decke = t.rows.find((r) => r[0] === 'S1: EG / 1. OG')!
    expect(decke[1]).toBe('Geschossdecke im Schacht')
    expect(decke[3]).toBe('HS-V01, HS-V02')
    expect(decke[4]).toBe(2)
    expect(decke[5]).toBe('B2ca ×1, ohne Angabe ×1')
    expect(decke[6]).toBe('Schacht S1')
    expect(decke[7]).toBe('Mantel/Brandklasse fehlt bei 1 Kabel')
    const grenze = t.rows.find((r) => r[0] === 'Saal | Technik')!
    expect(grenze[7]).toBe('')
  })

  it('haengt nicht an der Reihenfolge der Kabel im Projekt', () => {
    const a = haus()
    const b = haus({ cables: [...haus().cables].reverse() })
    expect(durchgaengeTable(b)).toEqual(durchgaengeTable(a))
  })
})

describe('Trassenplan-Blatt', () => {
  it('zeichnet je Etage ein Blatt und hängt die Durchgangsliste an', () => {
    const html = trassenplanHtml(haus(), { titel: 'Haus — Trassenplan', stempel: 'Haus · #abc' })
    expect(html).toContain('<h2>EG</h2>')
    expect(html).toContain('<h2>1. OG</h2>')
    expect(html).toContain('<h2>2. OG</h2>')
    // Die Linien: Saal–Technik, Saal–Schacht, Regie–Schacht.
    expect((html.match(/<line /g) ?? []).length).toBe(3)
    expect(html).toContain('Floor slab in riser')
    expect(html).toContain('Haus · #abc')
    expect(html).toContain('1 cables have an end outside every room')
  })

  it('geht durch den Übersetzer', () => {
    const html = trassenplanHtml(haus(), {
      titel: 'T',
      t: (key, fallback) => (key === 'trassenplan.kind.slab' ? 'Geschossdecke im Schacht' : fallback),
    })
    expect(html).toContain('Geschossdecke im Schacht')
    expect(html).not.toContain('Floor slab in riser')
  })

  it('nennt einen fehlenden Schacht auf dem Blatt', () => {
    const p = haus()
    p.locations = p.locations!.filter((l) => !l.steigschacht)
    expect(trassenplanHtml(p, { titel: 'T' })).toContain('No frame is marked as riser')
  })

  it('maskiert Namen', () => {
    const p = haus()
    p.locations = p.locations!.map((l) => (l.id === 'Saal' ? { ...l, name: '<Saal & Co>' } : l))
    const html = trassenplanHtml(p, { titel: 'T' })
    expect(html).toContain('&lt;Saal &amp; Co&gt;')
    expect(html).not.toContain('<Saal & Co>')
  })
})

describe('Stand im Dokument-Register', () => {
  it('fuehrt beide Blätter mit Namen', () => {
    expect(DOCUMENT_LABELS.durchgaenge).toBe('Durchgänge (Brandschutz)')
    expect(DOCUMENT_LABELS.trassenplan).toBe('Trassenplan')
    expect(DOCUMENT_STANDS.durchgaenge(haus())).toMatch(/^[0-9a-f]{8}$/)
  })

  it('ein verschobener Raum veraltet das Blatt, nicht aber die Liste', () => {
    const a = haus()
    const b = haus()
    b.locations = b.locations!.map((l) => (l.id === 'Technik' ? { ...l, height: l.height + 100 } : l))
    expect(DOCUMENT_STANDS.durchgaenge(b)).toBe(DOCUMENT_STANDS.durchgaenge(a))
    expect(DOCUMENT_STANDS.trassenplan(b)).not.toBe(DOCUMENT_STANDS.trassenplan(a))
    expect(trassenplanStandTable(a).headers).toEqual(durchgaengeTable(a).headers)
  })
})
