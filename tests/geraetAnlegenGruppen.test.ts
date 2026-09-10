import { describe, expect, it } from 'vitest'
import {
  buildPorts,
  defaultGroup,
  richtungWechseln,
  vorgabeBeschriftung,
  type PortGroupDraft,
} from '../src/renderer/components/Library/libraryPanelHelpers'

// ---------------------------------------------------------------------------
// #832 — „Und die Input Output Auswahl spinnt manchmal." (Meldung des
// Eigentümers, 2026-09-10)
//
// GEMESSEN im Anlege-Dialog. Zwei Stellen, an denen die Eingabe sich
// eigenmächtig verhielt:
//
//   1. Die ANZAHL. `Number('')` ist `0`. Wer die 1 löschte, um eine 12 zu
//      tippen, sah nach dem ersten Tastendruck eine `0` — die Zahl kam aus
//      dem Feld zurück, das er gerade geleert hatte. Danach stand `012` da.
//
//   2. Die RICHTUNG. Eine neue Gruppe hiess `Input`. Wer sie auf „Output"
//      umstellte, bekam Ausgänge namens `Input 1`, `Input 2` — die Richtung
//      wechselte, die Beschriftung nicht.
// ---------------------------------------------------------------------------

const gruppe = (teil: Partial<PortGroupDraft> = {}): PortGroupDraft => ({
  ...defaultGroup('in'),
  ...teil,
})

describe('Die Anzahl darf leer sein, ohne 0 zu werden', () => {
  it('eine leere Anzahl erzeugt keine Ports', () => {
    expect(buildPorts([gruppe({ count: '' })], 'in')).toEqual([])
  })

  it('und ist NICHT dasselbe wie 0 im Feld', () => {
    // Der Kern. Beide erzeugen keine Ports — aber `''` ist der Zustand
    // „gerade geleert" und `0` eine getippte Zahl. Sie gleichzusetzen war der
    // Fehler: die 0 sprang ins Feld zurück.
    expect(gruppe({ count: '' }).count).not.toBe(0)
  })

  it('baut sonst genau so viele Ports wie angegeben', () => {
    const ports = buildPorts([gruppe({ count: 3, label: 'Aux' })], 'in')
    expect(ports.map((p) => p.name)).toEqual(['Aux 1', 'Aux 2', 'Aux 3'])
  })

  it('nimmt nur die Gruppen der gefragten Richtung', () => {
    const g = [gruppe({ count: 2 }), gruppe({ direction: 'out', count: 1, label: 'Output' })]
    expect(buildPorts(g, 'in')).toHaveLength(2)
    expect(buildPorts(g, 'out')).toHaveLength(1)
  })
})

describe('Die Beschriftung folgt der Richtung — solange sie die Vorgabe ist', () => {
  it('aus `Input` wird `Output`', () => {
    const g = gruppe()
    expect(g.label).toBe('Input')
    expect(richtungWechseln(g, 'out')).toEqual({ direction: 'out', label: 'Output' })
  })

  it('und zurück', () => {
    const g = gruppe({ direction: 'out', label: 'Output' })
    expect(richtungWechseln(g, 'in')).toEqual({ direction: 'in', label: 'Input' })
  })

  it('lässt eine SELBST vergebene Beschriftung stehen', () => {
    // DIE GEGENPROBE. Wer seine Gruppe „Aux" genannt hat, will sie nach dem
    // Richtungswechsel nicht „Output" heissen sehen — dieselbe Regel wie bei
    // `renameIfDefault` in der Eigenschaften-Leiste (#175).
    const g = gruppe({ label: 'Aux' })
    expect(richtungWechseln(g, 'out')).toEqual({ direction: 'out' })
  })

  it('erkennt die Vorgabe auch mit Leerzeichen drumherum', () => {
    expect(richtungWechseln(gruppe({ label: '  Input  ' }), 'out')).toEqual({
      direction: 'out',
      label: 'Output',
    })
  })

  it('die Vorgabe steht an EINER Stelle', () => {
    // Sonst gäbe es sie zweimal: einmal in `defaultGroup`, einmal im
    // Vergleich — und der Vergleich schlüge fehl, sobald jemand die eine
    // ändert.
    expect(defaultGroup('in').label).toBe(vorgabeBeschriftung('in'))
    expect(defaultGroup('out').label).toBe(vorgabeBeschriftung('out'))
  })
})
