// facility#15 — avplan-facility v2 im Kabelplaner: Etagen, Hausstrecken mit
// Raeumen, Endblenden und Adern; das Kabel erklaert Strecke und Ader.
import { describe, expect, it } from 'vitest'
import { leseHausDatei, FACILITY_FORMAT } from '../src/renderer/lib/hausDatei'
import { streckenBelegung, streckenWeg } from '../src/renderer/lib/hausStrecken'
import { etagenAusHaus } from '../src/renderer/lib/etagen'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { Cable } from '../src/renderer/types/cable'

const v2 = {
  format: FACILITY_FORMAT,
  version: 2,
  gebaeude: {
    id: 'messe',
    name: 'Messe Halle 3',
    etagen: [
      { id: 'eg', name: 'EG', hoeheM: 0 },
      { id: 'og3', name: '3.OG', hoeheM: 12 },
    ],
    raeume: [
      { id: 'halle', name: 'Halle 3', hausbezeichner: 'H3', etageId: 'eg' },
      { id: 'regie', name: 'Regie', hausbezeichner: 'R301', etageId: 'og3' },
      { id: 'lager', name: 'Lager', hausbezeichner: 'L1', etageId: 'weg' },
    ],
    punkte: [],
    klinken: [],
    strecken: [
      {
        id: 's1',
        bezeichnung: 'Steigleitung Video',
        vonRaumId: 'halle',
        nachRaumId: 'regie',
        vonBlende: 'B2',
        nachBlende: 'W-12',
        adern: [
          { nr: '1', stecker: 'BNC', signal: '12G-SDI' },
          { nr: '2', stecker: 'BNC', signal: '12G-SDI' },
          { nr: '' },
        ],
      },
    ],
  },
}
const lies = (o: unknown) => leseHausDatei(JSON.stringify(o), { quelle: 'messe.avfacility', gelesenAm: '2026-09-24T10:00:00Z' })!

const kabel = (id: string, over: Partial<Cable>): Cable =>
  ({ id, name: id, type: 'SDI', length: 80, color: '#fff', notes: '', fromEquipmentId: 'a', fromPortId: 'a1', toEquipmentId: 'b', toPortId: 'b1', ...over }) as Cable

describe('avplan-facility v2 lesen', () => {
  it('liest Etagen, loest die Etage des Raums auf und raet sie nicht', () => {
    const a = lies(v2)
    expect(a.etagen).toEqual([{ id: 'eg', name: 'EG', hoeheM: 0 }, { id: 'og3', name: '3.OG', hoeheM: 12 }])
    expect(a.raeume.find((r) => r.id === 'regie')?.etage).toBe('3.OG')
    // etageId ins Leere: keine Etage, kein Raten.
    expect(a.raeume.find((r) => r.id === 'lager')?.etage).toBeUndefined()
  })

  it('liest Strecken mit Raeumen, Blenden und Adern — leere Adern fallen', () => {
    const [s] = lies(v2).strecken
    expect(s).toMatchObject({ vonRaumId: 'halle', nachRaumId: 'regie', vonBlende: 'B2', nachBlende: 'W-12' })
    expect(s.adern).toEqual([
      { nr: '1', stecker: 'BNC', signal: '12G-SDI' },
      { nr: '2', stecker: 'BNC', signal: '12G-SDI' },
    ])
    expect(streckenWeg(lies(v2), s)).toBe('EG · Halle 3 (B2) → 3.OG · Regie (W-12)')
  })

  it('v1 bleibt lesbar, der Freitext wird zur Etage des Raums', () => {
    const v1 = { ...v2, version: 1, gebaeude: { ...v2.gebaeude, etagen: undefined, raeume: [{ id: 'r', name: 'Saal', hausbezeichner: 'S', etage: '1.OG' }] } }
    const a = lies(v1)
    expect(a.etagen).toBeUndefined()
    expect(a.raeume[0].etage).toBe('1.OG')
  })

  it('eine Fassung ueber 2 wird abgewiesen', () => {
    expect(leseHausDatei(JSON.stringify({ ...v2, version: 3 }), { quelle: 'x', gelesenAm: 't' })).toBeNull()
  })
})

describe('Kabel auf Hausstrecke und Ader', () => {
  const a = lies(v2)
  it('Belegung je Ader, ganze Strecke und unbekannte Ader getrennt', () => {
    const b = streckenBelegung(a, [
      kabel('k1', { hausStreckeId: 's1', hausAder: '1' }),
      kabel('k2', { hausStreckeId: 's1' }),
      kabel('k3', { hausStreckeId: 's1', hausAder: '9' }),
      kabel('k4', {}),
    ], 's1')!
    expect(b.adern.map((x) => [x.ader.nr, x.kabel])).toEqual([['1', ['k1']], ['2', []]])
    expect(b.ohneAder).toEqual(['k2'])
    expect(b.unbekannteAder).toEqual([{ kabelId: 'k3', ader: '9' }])
  })

  it('Plan-Check: Strecke weg, Ader unbekannt, Ader doppelt', () => {
    const { findings } = runDrawingChecks({
      equipment: [],
      cables: [
        kabel('k1', { hausStreckeId: 's1', hausAder: '1' }),
        kabel('k2', { hausStreckeId: 's1', hausAder: '1' }),
        kabel('k3', { hausStreckeId: 's1', hausAder: '9' }),
        kabel('k4', { hausStreckeId: 'abgerissen' }),
      ],
      hausAuskunft: a,
    })
    const ids = findings.map((f) => f.id)
    expect(ids).toContain('haus-strecke-fehlt:k4')
    expect(ids).toContain('haus-ader-unbekannt:k3')
    expect(ids).toContain('haus-ader-doppelt:s1:1')
  })
})

describe('etagenAusHaus', () => {
  it('ergaenzt fehlende Etagen und Hoehen, ueberschreibt keine gesetzte Hoehe', () => {
    expect(
      etagenAusHaus([{ name: 'eg', elevationM: 0.5 }, { name: 'UG' }], [
        { name: 'EG', hoeheM: 0 },
        { name: 'UG', hoeheM: -4 },
        { name: '3.OG', hoeheM: 12 },
      ]),
    ).toEqual([{ name: 'eg', elevationM: 0.5 }, { name: 'UG', elevationM: -4 }, { name: '3.OG', elevationM: 12 }])
  })
})
