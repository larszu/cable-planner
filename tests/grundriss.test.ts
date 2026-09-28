import { describe, expect, it } from 'vitest'
import {
  abbilden,
  eckenGueltig,
  homographie,
  kalibrierungMitfuehren,
  meterAbbildung,
  meterJePixel,
  wegLaengeM,
} from '../src/renderer/lib/grundriss/massstab'
import { grundrissAusVenue, venueAusGrundriss } from '../src/renderer/lib/grundriss/venueAustausch'
import { parseVenueExchange, type VenueExchange } from '../src/renderer/lib/grundriss/venueExchange'
import { estimateCableLength, kabelWeg } from '../src/renderer/lib/cableLengthEstimate'
import { cableRunFindings } from '../src/renderer/lib/cableRunChecks'
import { estimateAllCableLengths } from '../src/renderer/lib/cableLengthEstimate'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Grundriss, PlanKalibrierung } from '../src/renderer/types/grundriss'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'

const eq = (id: string, x: number, y: number): EquipmentItem =>
  ({ id, name: id, x, y, width: 100, height: 40, ports: [] }) as unknown as EquipmentItem

const kabel = (p: Partial<Cable> = {}): Cable =>
  ({ id: 'k', name: 'K1', fromEquipmentId: 'a', fromPortId: 'o', toEquipmentId: 'b', toPortId: 'i', ...p }) as Cable

const scheme = { metersPer100px: 1, slackPercent: 0, roundUp: false }

describe('Massstab — zwei Punkte', () => {
  it('rechnet eine Strecke bekannter Laenge in Meter je Pixel um', () => {
    const k: PlanKalibrierung = { art: 'zweiPunkt', a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, meter: 10 }
    expect(meterJePixel(k)).toBeCloseTo(0.05)
    const m = meterAbbildung(k)!
    expect(wegLaengeM(m, [{ x: 0, y: 0 }, { x: 0, y: 400 }])).toBeCloseTo(20)
  })

  it('verweigert eine Strecke ohne Laenge', () => {
    expect(meterAbbildung({ art: 'zweiPunkt', a: { x: 5, y: 5 }, b: { x: 5, y: 5 }, meter: 10 })).toBeNull()
  })
})

describe('Massstab — vier Ecken (Perspektive)', () => {
  // Ein 20 × 10 m grosser Boden, schraeg fotografiert: die hintere Kante
  // (oben im Bild) ist kuerzer als die vordere.
  const ecken: [any, any, any, any] = [
    { x: 300, y: 100 },
    { x: 700, y: 100 },
    { x: 900, y: 500 },
    { x: 100, y: 500 },
  ]
  const k: PlanKalibrierung = { art: 'rechteck', ecken, breiteM: 20, tiefeM: 10 }

  it('bildet die Ecken auf die Masse der Flaeche ab', () => {
    const m = meterAbbildung(k)!
    expect(m(ecken[0])).toEqual({ x: expect.closeTo(0, 6), y: expect.closeTo(0, 6) })
    expect(m(ecken[2])).toEqual({ x: expect.closeTo(20, 6), y: expect.closeTo(10, 6) })
  })

  it('misst hinten und vorne dieselbe Breite, obwohl das Bild sie verschieden lang zeigt', () => {
    const m = meterAbbildung(k)!
    expect(wegLaengeM(m, [ecken[0], ecken[1]])).toBeCloseTo(20, 6)
    expect(wegLaengeM(m, [ecken[3], ecken[2]])).toBeCloseTo(20, 6)
    expect(Math.hypot(ecken[1].x - ecken[0].x, 0)).not.toBe(Math.hypot(ecken[2].x - ecken[3].x, 0))
  })

  it('misst die Diagonale nach Pythagoras', () => {
    const m = meterAbbildung(k)!
    expect(wegLaengeM(m, [ecken[0], ecken[2]])).toBeCloseTo(Math.hypot(20, 10), 6)
  })

  it('lehnt vertauschte Ecken ab (ein „Z" klappte den Plan um)', () => {
    expect(eckenGueltig([ecken[0], ecken[2], ecken[1], ecken[3]])).toBe(false)
    expect(meterAbbildung({ ...k, ecken: [ecken[0], ecken[2], ecken[1], ecken[3]] })).toBeNull()
  })

  it('liefert hinter dem Horizont keine Zahl', () => {
    const h = homographie(ecken, [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ])!
    // Die Seitenkanten laufen oben bei y = −100 zusammen: dort ist der Horizont.
    expect(abbilden(h, { x: 500, y: -300 })).toBeNull()
  })

  it('fuehrt die Kalibrierung mit, wenn der Plan verschoben und skaliert wird', () => {
    const alt = { x: 0, y: 0, width: 1000, height: 600 }
    const neu = { x: 50, y: 20, width: 2000, height: 1200 }
    const k2 = kalibrierungMitfuehren(k, alt, neu)
    const vorher = wegLaengeM(meterAbbildung(k)!, [ecken[0], ecken[2]])!
    const f = (p: { x: number; y: number }) => ({ x: 50 + p.x * 2, y: 20 + p.y * 2 })
    expect(wegLaengeM(meterAbbildung(k2)!, [f(ecken[0]), f(ecken[2])])).toBeCloseTo(vorher, 6)
  })
})

describe('Kabellaenge entlang des gezeichneten Wegs', () => {
  const geraete = new Map([
    ['a', eq('a', 0, 0)],
    ['b', eq('b', 400, 300)],
  ])
  const buchse = (e: EquipmentItem, _p: string, r: 'source' | 'target') =>
    r === 'source' ? { x: e.x + 100, y: e.y + 20 } : { x: e.x, y: e.y + 20 }

  it('laeuft von Buchse zu Buchse ueber die Knickpunkte', () => {
    const c = kabel({ waypoints: [{ x: 250, y: 20 }, { x: 250, y: 320 }] })
    expect(kabelWeg(c, geraete.get('a')!, geraete.get('b')!, { buchse })).toEqual([
      { x: 100, y: 20 },
      { x: 250, y: 20 },
      { x: 250, y: 320 },
      { x: 400, y: 320 },
    ])
    // 150 + 300 + 150 px = 6 m bei 1 m je 100 px
    expect(estimateCableLength(c, geraete, scheme, { buchse })).toBeCloseTo(6)
  })

  it('rechnet ohne Knickpunkte das rechtwinklige Z, nicht die Luftlinie', () => {
    const c = kabel()
    // |dx| 300 + |dy| 300 = 6 m; die Luftlinie waere 4,24 m
    expect(estimateCableLength(c, geraete, scheme, { buchse })).toBeCloseTo(6)
  })

  it('nimmt den Massstab des Hallenplans statt „Meter pro 100 px"', () => {
    const grundriss = {
      kalibrierung: { art: 'zweiPunkt', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meter: 2 },
    } as Grundriss
    expect(estimateCableLength(kabel(), geraete, scheme, { buchse, grundriss })).toBeCloseTo(12)
  })

  it('schlaegt Zuschlag auf und rundet auf', () => {
    expect(estimateCableLength(kabel(), geraete, { metersPer100px: 1, slackPercent: 10, roundUp: true }, { buchse })).toBe(7)
  })

  it('meldet eine abgeleitete Laenge als ueberholt, wenn der Weg neu geroutet wurde', () => {
    const c = kabel({ waypoints: [{ x: 250, y: 20 }, { x: 250, y: 320 }] })
    const eqs = [...geraete.values()]
    const { updates, origins } = estimateAllCableLengths([c], eqs, scheme, { buchse })
    const geschaetzt = { ...c, length: updates.get('k'), lengthDerivedFrom: origins.get('k') }
    expect(cableRunFindings([geschaetzt], eqs, { buchse })).toHaveLength(0)
    const umgeroutet = { ...geschaetzt, waypoints: [{ x: 300, y: 20 }, { x: 300, y: 320 }] }
    expect(cableRunFindings([umgeroutet], eqs, { buchse }).map((f) => f.kind)).toEqual(['derived-length-stale'])
  })

  it('meldet sie ebenso, wenn der Hallenplan neu kalibriert wurde', () => {
    const c = kabel()
    const eqs = [...geraete.values()]
    const g1 = { kalibrierung: { art: 'zweiPunkt', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meter: 2 } } as Grundriss
    const g2 = { kalibrierung: { art: 'zweiPunkt', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meter: 3 } } as Grundriss
    const { updates, origins } = estimateAllCableLengths([c], eqs, scheme, { buchse, grundriss: g1 })
    const geschaetzt = { ...c, length: updates.get('k'), lengthDerivedFrom: origins.get('k') }
    expect(cableRunFindings([geschaetzt], eqs, { buchse, grundriss: g1 })).toHaveLength(0)
    const [f] = cableRunFindings([geschaetzt], eqs, { buchse, grundriss: g2 })
    expect(f.kind).toBe('derived-length-stale')
    expect(f.values[1]).toBe('18')
  })
})

describe('Venue-Austausch mit MultiCam / Light Planner', () => {
  const venue: VenueExchange = {
    kind: 'venue-exchange',
    formatVersion: 1,
    app: 'multicam-planner',
    appVersion: '1.0.0',
    exportedAt: '2026-09-24T00:00:00.000Z',
    venue: {
      name: 'Halle 3',
      persons: [{ id: 'p1', x: 1, y: 2, height: 1.8, label: 'Moderation' }],
      walls: [{ id: 'w1', x1: 0, y1: 0, x2: 40, y2: 0, height: 6 }],
      stageObjects: [],
      floorPlan: {
        src: 'data:image/png;base64,AAAA',
        naturalWidth: 2000,
        naturalHeight: 1000,
        widthMeters: 40,
        heightMeters: 20,
        offsetX: 1,
        offsetY: 2,
        opacity: 0.5,
      },
    },
  }

  it('uebernimmt Bild und Massstab', () => {
    const g = grundrissAusVenue(venue, { x: 10, y: 20 })
    expect(g.width).toBe(2000)
    expect(g.height).toBeCloseTo(1000)
    expect(meterJePixel(g.kalibrierung!)).toBeCloseTo(0.02)
  })

  it('gibt beim Export zurueck, was es nicht modelliert (ADR-005)', () => {
    const g = grundrissAusVenue(venue, { x: 10, y: 20 })
    const ex = venueAusGrundriss(g, 'cable-planner', '9.0.3', 'Projekt', new Date('2026-09-24T12:00:00Z'))!
    expect(ex.venue.walls).toEqual(venue.venue.walls)
    expect(ex.venue.persons).toEqual(venue.venue.persons)
    expect(ex.venue.floorPlan).toMatchObject({ widthMeters: 40, heightMeters: 20, offsetX: 1, offsetY: 2 })
    expect(parseVenueExchange(JSON.stringify(ex)).venue.name).toBe('Halle 3')
  })

  it('exportiert eine Vier-Punkt-Kalibrierung nicht (das Format kennt nur einen Massstab)', () => {
    const g = {
      ...grundrissAusVenue(venue, { x: 0, y: 0 }),
      kalibrierung: {
        art: 'rechteck',
        ecken: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        breiteM: 1,
        tiefeM: 1,
      },
    } as Grundriss
    expect(venueAusGrundriss(g, 'cable-planner', '9.0.3', 'x', new Date())).toBeNull()
  })

  it('lehnt eine Datei ohne Plan ab', () => {
    const ohne = { ...venue, venue: { ...venue.venue, floorPlan: undefined } }
    expect(() => grundrissAusVenue(ohne, { x: 0, y: 0 })).toThrow('no-floor-plan')
  })
})


describe('Raster-Heilung beim Laden', () => {
  it('zieht den gespeicherten Weg mit den Knickpunkten des Kabels gleich', () => {
    // Sonst meldete ein nur GELADENES Projekt seine Schaetzungen als ueberholt.
    expect(storeQuelle).toMatch(/weg: o\.weg\.map\(\(w\) => \(\{ x: r\(w\.x\), y: r\(w\.y\) \}\)\)/)
    expect(storeQuelle).toMatch(/waypoints: c\.waypoints\.map\(\(w\) => \(\{ x: r\(w\.x\), y: r\(w\.y\) \}\)\)/)
  })
})
