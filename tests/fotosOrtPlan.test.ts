// ───────────────────────────────────────────────────────────────────────────
// #1187 — Fotos am Raum, Marke im Plan, Fotodokumentation.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { fotoAusMarkeId, fotoDatum, fotoMarkeId, fotosMitPunkt, fotosOhneZiel, fotosZu, heileFotoZiel } from '../src/renderer/lib/fotoMasse'
import { fotoBerichtHtml, fotoBerichtTable, fotoGruppen } from '../src/renderer/lib/fotoBericht'
import { currentStand, DOCUMENT_LABELS } from '../src/renderer/lib/documentRegistry'
import type { Foto } from '../src/renderer/types/foto'
import type { CablePlannerProject } from '../src/renderer/types/project'

const foto = (id: string, ueber: Partial<Foto> = {}): Foto => ({
  id,
  dataUri: 'data:image/jpeg;base64,AAAA',
  breite: 1600,
  hoehe: 1200,
  bytes: 4,
  quelle: 'planer',
  hinzugefuegtAm: '2026-10-02T10:00:00.000Z',
  ...ueber,
})

const projekt = (fotos: Foto[]): CablePlannerProject =>
  ({
    metadata: { name: 'Halle', description: '', createdAt: '', updatedAt: '' },
    equipment: [{ id: 'e1', name: 'Rack A', ports: [], x: 0, y: 0 }],
    cables: [],
    locations: [{ id: 'r1', name: '2.14', x: 0, y: 0, width: 100, height: 100, color: '#fff' }],
    canvasState: { x: 0, y: 0, zoom: 1 },
    fotos,
  }) as unknown as CablePlannerProject

describe('Ziel Raum und Marke im Plan', () => {
  it('ein Raumfoto gehoert dem Raum und nicht dem Projekt', () => {
    const fs = [foto('a', { zeigtAuf: { locationId: 'r1' } }), foto('b')]
    expect(fotosZu(fs, { locationId: 'r1' }).map((f) => f.id)).toEqual(['a'])
    expect(fotosOhneZiel(fs).map((f) => f.id)).toEqual(['b'])
  })

  it('eine Marke allein ist kein Ziel: das Foto bleibt Projektfoto', () => {
    const fs = [foto('a', { zeigtAuf: { punkt: { x: 1, y: 2 } } })]
    expect(fotosOhneZiel(fs)).toHaveLength(1)
    expect(fotosMitPunkt(fs)).toHaveLength(1)
  })

  it('heilt das Ziel: kaputte Marke und leere Ids fallen, der Rest bleibt', () => {
    expect(heileFotoZiel({ equipmentId: 'e1', punkt: { x: NaN, y: 0 } })).toEqual({ equipmentId: 'e1' })
    expect(heileFotoZiel({ cableId: '', punkt: { x: 3, y: 4 } })).toEqual({ punkt: { x: 3, y: 4 } })
    expect(heileFotoZiel({ locationId: '' })).toBeUndefined()
    expect(heileFotoZiel('Quatsch')).toBeUndefined()
  })

  it('das Datum ist die Aufnahme, sonst der Eingang', () => {
    expect(fotoDatum({ aufgenommenAm: '2026-09-01T08:00:00Z', hinzugefuegtAm: '2026-10-02T10:00:00Z' })).toBe('2026-09-01')
    expect(fotoDatum({ hinzugefuegtAm: '2026-10-02T10:00:00Z' })).toBe('2026-10-02')
  })

  it('Knoten-Id der Marke geht hin und zurueck', () => {
    expect(fotoAusMarkeId(fotoMarkeId('x1'))).toBe('x1')
    expect(fotoAusMarkeId('e1')).toBeUndefined()
  })
})

describe('Fotodokumentation', () => {
  const p = projekt([
    foto('p1', { notiz: 'Halle von vorn' }),
    foto('g1', { zeigtAuf: { equipmentId: 'e1', locationId: 'r1' }, notiz: 'Rueckseite' }),
    foto('r1f', { zeigtAuf: { locationId: 'r1', punkt: { x: 10, y: 20 } }, notiz: 'Deckendurchbruch' }),
  ])

  it('gruppiert nach Raum, Geraet, Projekt — jedes Foto genau einmal', () => {
    const g = fotoGruppen(p)
    expect(g.map((x) => [x.art, x.name, x.fotos.map((f) => f.id)])).toEqual([
      ['raum', '2.14', ['r1f']],
      ['geraet', 'Rack A', ['g1']],
      ['projekt', '', ['p1']],
    ])
  })

  it('druckt Bild, Bildunterschrift und Datum', () => {
    const html = fotoBerichtHtml(p, { titel: 'Fotos' })
    expect(html).toContain('Deckendurchbruch · 2026-10-02 · marked in the plan')
    expect(html).toContain('<img src="data:image/jpeg;base64,AAAA"')
  })

  it('steht im Dokument-Register, und eine neue Bildunterschrift aendert den Stand', () => {
    expect(DOCUMENT_LABELS.fotobericht).toBeTruthy()
    const vorher = currentStand('fotobericht', p)
    const nachher = currentStand('fotobericht', { ...p, fotos: p.fotos!.map((f) => ({ ...f, notiz: 'neu' })) })
    expect(vorher).toMatch(/^[0-9a-f]{8}$/)
    expect(nachher).not.toBe(vorher)
    expect(JSON.stringify(fotoBerichtTable(p))).not.toContain('base64')
  })
})
