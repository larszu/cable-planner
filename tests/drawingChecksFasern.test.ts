import { describe, expect, it } from 'vitest'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { Polaritaetsnorm } from '../src/renderer/types/fiber'

// ---------------------------------------------------------------------------
// #885 — der Breakout und die Polaritaet im Plan-Check.
//
// Zwei Zusicherungen tragen diese Datei, und die zweite ist die wichtigere:
//
//   1. „drei von vier Fasern gepatcht" faellt auf (der strukturelle Nachbar
//      von Pruefung 16b, Dual-Link).
//   2. Pruefung 17b meldet einen BREAKOUT nicht mehr als Steckertyp-Fehler.
//      Sie haette LC gegen opticalCON als Mismatch gemeldet — also jeden
//      Breakout im Plan rot gefaerbt, und zwar genau dort, wo er richtig ist.
// ---------------------------------------------------------------------------

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e',
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

const faser = (position: number, rolle: 'tx' | 'rx' | 'unbestimmt' = 'unbestimmt') => ({
  id: `f${position}`,
  position,
  rolle,
})

const kabel = (over: Partial<Cable>): Cable => ({
  id: 'c',
  fromEquipmentId: 'a',
  fromPortId: 'a-out',
  toEquipmentId: 'b',
  toPortId: 'b-in',
  type: 'Fiber',
  ...over,
})

/** Eine QUAD-Buchse links, eine QUAD-Buchse rechts. */
const strecke = (fasernLinks = [1, 2, 3, 4], fasernRechts = [1, 2, 3, 4]) => [
  eq({
    id: 'a',
    name: 'Bühne',
    outputs: [
      {
        id: 'a-out',
        name: 'QUAD 1',
        type: 'Neutrik opticalCON QUAD',
        connectorType: 'Neutrik opticalCON QUAD',
        fasern: fasernLinks.map((n) => faser(n)),
      },
    ],
  }),
  eq({
    id: 'b',
    name: 'Regie',
    inputs: [
      {
        id: 'b-in',
        name: 'QUAD 1',
        type: 'Neutrik opticalCON QUAD',
        connectorType: 'Neutrik opticalCON QUAD',
        fasern: fasernRechts.map((n) => faser(n)),
      },
    ],
  }),
]

const kategorien = (f: { category: string }[]) => f.map((x) => x.category)

describe('#885 — Breakout im Plan-Check (16c)', () => {
  it('meldet drei von vier gepatcht', () => {
    const { findings } = runDrawingChecks({
      equipment: strecke(),
      cables: [1, 2, 3].map((n) =>
        kabel({ id: `c${n}`, name: `K${n}`, faserVon: n, faserNach: n }),
      ),
    })
    const breakout = findings.filter((f) => f.category === 'Fibre breakout')
    expect(breakout.length).toBeGreaterThan(0)
    expect(breakout.every((f) => f.severity === 'warning')).toBe(true)
  })

  it('schweigt, wenn alle vier liegen', () => {
    const { findings } = runDrawingChecks({
      equipment: strecke(),
      cables: [1, 2, 3, 4].map((n) =>
        kabel({ id: `c${n}`, name: `K${n}`, faserVon: n, faserNach: n }),
      ),
    })
    expect(kategorien(findings)).not.toContain('Fibre breakout')
  })

  it('meldet zwei Kabel auf derselben Faser als FEHLER', () => {
    const { findings } = runDrawingChecks({
      equipment: strecke(),
      cables: [
        kabel({ id: 'c1', name: 'K1', faserVon: 1, faserNach: 1 }),
        kabel({ id: 'c2', name: 'K2', faserVon: 1, faserNach: 2 }),
      ],
    })
    const doppelt = findings.filter((f) => f.id.includes('faser-doppelt'))
    expect(doppelt).toHaveLength(1)
    expect(doppelt[0].severity).toBe('error')
  })
})

describe('#885 — die Polaritaet im Plan-Check (17c)', () => {
  const norm: Polaritaetsnorm = {
    id: 'b',
    name: 'Methode B',
    herkunft: 'Hausunterlage, Seite 4',
    kreuzt: true,
  }
  const gekreuzt = () => {
    const [a, b] = strecke()
    a.outputs[0].fasern = [faser(1, 'tx'), faser(2, 'rx')]
    b.inputs[0].fasern = [faser(1, 'tx'), faser(2, 'rx')]
    return [a, b]
  }

  it('sagt EINMAL je Plan, dass ohne gewaehlte Methode nichts geprueft ist', () => {
    // Einmal und nicht je Kabel: sonst erschlaegt die Auskunft die Liste,
    // und die echten Befunde gehen darin unter.
    const { findings } = runDrawingChecks({
      equipment: gekreuzt(),
      cables: [1, 2].map((n) => kabel({ id: `c${n}`, name: `K${n}`, faserVon: n, faserNach: n })),
    })
    const offen = findings.filter((f) => f.id === 'fibre-polarity:no-method')
    expect(offen).toHaveLength(1)
    expect(offen[0].severity).toBe('info')
  })

  it('meldet TX auf TX als Fehler, sobald eine Methode gilt', () => {
    const { findings } = runDrawingChecks({
      equipment: gekreuzt(),
      cables: [kabel({ id: 'c1', name: 'K1', faserVon: 1, faserNach: 1 })],
      polaritaetsnormen: [norm],
      polaritaetsnormId: 'b',
    })
    const verdreht = findings.filter((f) => f.id.includes('polaritaet-verdreht'))
    expect(verdreht).toHaveLength(1)
    expect(verdreht[0].severity).toBe('error')
  })

  it('schweigt bei TX auf RX unter derselben Methode', () => {
    const { findings } = runDrawingChecks({
      equipment: gekreuzt(),
      cables: [kabel({ id: 'c1', name: 'K1', faserVon: 1, faserNach: 2 })],
      polaritaetsnormen: [norm],
      polaritaetsnormId: 'b',
    })
    expect(findings.filter((f) => f.category === 'Fibre polarity')).toHaveLength(0)
  })
})

describe('#885 — Pruefung 17b haelt einen Breakout nicht mehr fuer einen Fehler', () => {
  const breakoutStrecke = (mitFasern: boolean) => [
    eq({
      id: 'a',
      name: 'Bühne',
      outputs: [
        {
          id: 'a-out',
          name: 'QUAD 1',
          type: 'Fiber',
          connectorType: 'Fiber',
          fiberConnector: 'opticalCON',
          ...(mitFasern ? { fasern: [faser(1), faser(2), faser(3), faser(4)] } : {}),
        },
      ],
    }),
    eq({
      id: 'b',
      name: 'Regie',
      inputs: [
        {
          id: 'b-in',
          name: 'LC 1',
          type: 'Fiber',
          connectorType: 'Fiber',
          fiberConnector: 'LC',
        },
      ],
    }),
  ]

  it('meldet LC gegen opticalCON weiterhin, wo KEIN Breakout eingetragen ist', () => {
    // Die Gegenprobe: ohne Faser-Liste ist es weiterhin das, was 17b immer
    // war — zwei verschiedene Stecker an einem Link.
    const { findings } = runDrawingChecks({
      equipment: breakoutStrecke(false),
      cables: [kabel({ id: 'c1', name: 'K1' })],
    })
    expect(kategorien(findings)).toContain('Fibre connector')
  })

  it('schweigt, sobald eine Seite die Buchse in Fasern aufteilt', () => {
    const { findings } = runDrawingChecks({
      equipment: breakoutStrecke(true),
      cables: [kabel({ id: 'c1', name: 'K1' })],
    })
    expect(kategorien(findings)).not.toContain('Fibre connector')
  })
})
