import { describe, expect, it } from 'vitest'
import {
  RACK_WIRE_FINDING_LABEL,
  RACK_WIRE_FINDING_SEVERITY,
  rackWireFindings,
  type WireCheckCable,
  type WireCheckPlacement,
} from '../src/renderer/lib/rackWireChecks'

// ───────────────────────────────────────────────────────────────────────────
// Issue #663 — „Es fehlt die Fehlermeldung, dass Kabeltypen nicht
// zusammenpassen."
//
// Der Signalplan meldet das seit langem; die Rack-INTERNE Verkabelung nicht.
// Dabei ist sie die, bei der man sich vertut: dort liegen BNC und XLR in
// derselben Höheneinheit nebeneinander.
// ───────────────────────────────────────────────────────────────────────────

const port = (name: string, connectorType: string) =>
  ({ id: `${name}-id`, name, type: 'video', connectorType }) as never

const geraet = (
  id: string,
  name: string,
  inputs: { name: string; connectorType: string }[] = [],
  outputs: { name: string; connectorType: string }[] = [],
): WireCheckPlacement => ({
  id,
  name,
  inputs: inputs.map((p) => port(p.name, p.connectorType)),
  outputs: outputs.map((p) => port(p.name, p.connectorType)),
})

const kabel = (over: Partial<WireCheckCable> = {}): WireCheckCable => ({
  fromPlacementId: 'a',
  fromPortName: 'SDI Out',
  toPlacementId: 'b',
  toPortName: 'SDI In',
  name: 'K1',
  type: 'SDI',
  ...over,
})

const rack: WireCheckPlacement[] = [
  geraet('a', 'Kamera-Interface', [], [{ name: 'SDI Out', connectorType: 'BNC' }]),
  geraet(
    'b',
    'Mischer',
    [
      { name: 'SDI In', connectorType: 'BNC' },
      { name: 'Mic In', connectorType: 'XLR' },
    ],
    [{ name: 'PGM Out', connectorType: 'BNC' }],
  ),
]

const arten = (f: ReturnType<typeof rackWireFindings>) => f.map((x) => x.kind)

describe('was zusammenpasst, wird nicht gemeldet', () => {
  it('schweigt bei BNC auf BNC', () => {
    expect(rackWireFindings(rack, [kabel()])).toEqual([])
  })

  it('schweigt bei einer leeren Verkabelung', () => {
    expect(rackWireFindings(rack, [])).toEqual([])
  })
})

describe('was nicht zusammenpasst, wird gemeldet', () => {
  it('meldet BNC auf XLR — der Fehler aus der Meldung', () => {
    const f = rackWireFindings(rack, [kabel({ toPortName: 'Mic In' })])
    expect(arten(f)).toContain('connector-mismatch')
    expect(f[0].text).toContain('BNC')
    expect(f[0].text).toContain('XLR')
  })

  it('nennt das Kabel beim Namen, damit man es findet', () => {
    const f = rackWireFindings(rack, [kabel({ toPortName: 'Mic In', name: 'K7' })])
    expect(f[0].text.startsWith('K7')).toBe(true)
    expect(f[0].index).toBe(0)
  })

  it('meldet zwei Ausgänge aneinander', () => {
    const f = rackWireFindings(rack, [
      kabel({ toPlacementId: 'b', toPortName: 'PGM Out' }),
    ])
    expect(arten(f)).toContain('direction-mismatch')
  })
})

describe('ein Port, den es nicht gibt, ist der teurere Fehler', () => {
  // Die Verbindung hängt am NAMEN. Wer den Port umbenennt, lässt das Kabel
  // auf nichts zeigen — im Rack ist trotzdem eine Linie gezeichnet.
  it('meldet ihn als Fehler, nicht als Warnung', () => {
    const f = rackWireFindings(rack, [kabel({ toPortName: 'Gibt es nicht' })])
    expect(arten(f)).toEqual(['port-unknown'])
    expect(f[0].severity).toBe('error')
  })

  it('meldet auch ein Gerät, das nicht mehr im Rack steht', () => {
    const f = rackWireFindings(rack, [kabel({ toPlacementId: 'weg' })])
    expect(arten(f)).toEqual(['placement-unknown'])
    expect(f[0].severity).toBe('error')
  })

  it('prüft die Stecker dann NICHT mehr — ohne Port gibt es keinen Stecker', () => {
    const f = rackWireFindings(rack, [kabel({ toPortName: 'Gibt es nicht' })])
    expect(arten(f)).not.toContain('connector-mismatch')
  })
})

describe('was bewusst nicht gemeldet wird', () => {
  it('lässt „Custom" in Ruhe — er sagt nichts darüber, worauf er passt', () => {
    const mitCustom = [
      geraet('a', 'A', [], [{ name: 'Out', connectorType: 'Custom' }]),
      geraet('b', 'B', [{ name: 'In', connectorType: 'XLR' }]),
    ]
    const f = rackWireFindings(mitCustom, [
      kabel({ fromPortName: 'Out', toPortName: 'In' }),
    ])
    expect(arten(f)).not.toContain('connector-mismatch')
  })

  it('stuft den Steckerunterschied als Warnung ein, nicht als Fehler', () => {
    // Ein Adapter im Kabel ist ein gültiger Aufbau. Gemeldet ja, verboten nein.
    expect(RACK_WIRE_FINDING_SEVERITY['connector-mismatch']).toBe('warning')
  })

  it('hat für jeden Befund einen deutschen Satz', () => {
    for (const t of Object.values(RACK_WIRE_FINDING_LABEL)) expect(t.length).toBeGreaterThan(10)
  })
})
