import { describe, expect, it } from 'vitest'
import { rackWireFindings } from '../src/renderer/lib/rackWireChecks'
import { satzText } from '../src/renderer/lib/satz'
import { translate } from '../src/renderer/lib/i18n'

// #1142 — die Saetze aus #1151 folgen auf dem Bildschirm dem Sprachschalter:
// der Befund traegt den Satz, die Anzeige loest ihn mit `t` auf. Der
// kanonische Text (Blatt, Stempel) bleibt deutsch.

const en = (key: string, fallback: string) => translate('en', key, fallback)
const de = (key: string, fallback: string) => translate('de', key, fallback)

describe('Anzeige-Saetze in der App-Sprache (#1142)', () => {
  const f = rackWireFindings(
    [
      { id: 'a', name: 'Kamera', inputs: [], outputs: [{ id: 'o1', name: 'SDI', direction: 'out', connectorType: 'BNC' }] },
      { id: 'b', name: 'Monitor', inputs: [], outputs: [{ id: 'o2', name: 'SDI', direction: 'out', connectorType: 'BNC' }] },
    ] as never,
    [{ name: 'K1', fromPlacementId: 'a', fromPortName: 'SDI', toPlacementId: 'b', toPortName: 'SDI' }] as never,
  ).find((x) => x.kind === 'direction-mismatch')

  it('zeigt den Befund auf Englisch', () => {
    expect(f?.satz).toBeTruthy()
    expect(satzText(f!.satz!, en)).toBe('K1: Kamera and Monitor are both outputs')
  })

  it('zeigt ihn auf Deutsch und laesst den kanonischen Text deutsch', () => {
    expect(satzText(f!.satz!, de)).toBe('K1: Kamera und Monitor sind beide Ausgänge')
    expect(f!.text).toBe('K1: Kamera und Monitor sind beide Ausgänge')
  })
})
