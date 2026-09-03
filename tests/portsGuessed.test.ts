import { describe, expect, it } from 'vitest'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import aiButtonSrc from '../src/renderer/components/Properties/sections/PortAiSuggestButton.tsx?raw'
import portsSectionSrc from '../src/renderer/components/Properties/sections/PortsSection.tsx?raw'

// ---------------------------------------------------------------------------
// Initiative 10 im cable-planner — die Stelle, die ich beim ersten Durchgang
// uebersehen habe.
//
// DER BEFUND. `#647` und `#648` haben die drei Stellen geheilt, an denen ein
// GERAETE-BEFUND still zur Absicht wurde. Beim Neu-Ableiten fiel auf, dass es
// eine vierte Sorte gibt, nach der niemand gesucht hatte: eine Angabe, die
// weder abgelesen noch geplant, sondern GERATEN ist.
//
// `PortAiSuggestButton` laesst ein Modell aus dem GERAETENAMEN Ports ableiten
// und schrieb sie ununterscheidbar neben von Hand eingetragene. Das ist genau
// das, was `portsUnknown` verhindern soll — dessen Begruendung in
// `DECLARED_PROVENANCE` lautet woertlich: „Die Ports sind leer, weil keine
// erfunden wurden — nicht, weil das Geraet keine haette."
//
// DER SCHADEN IST KONKRET UND WAR STILL. Pruefung 18 warnt, solange ein
// Geraet ohne Datenblatt-Treffer keine Ports hat. Ihre Bedingung ist
// `portsUnknown && inputs.length === 0 && outputs.length === 0`. Ein Klick auf
// den AI-Vorschlag fuellte Ports ein — und brachte damit die Pruefung zum
// Schweigen, die einen Menschen zu belegten Daten zwingen soll. Ports tragen
// die ganze Verkabelung: ein erfundener Port ist ein Kabel, das es nicht gibt.
// ---------------------------------------------------------------------------

const geraet = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'e1',
    name: 'Irgendein Mischer',
    category: 'Video',
    x: 0,
    y: 0,
    inputs: [],
    outputs: [],
    ...over,
  }) as EquipmentItem

const port = (id: string) => ({ id, name: id, type: 'BNC', connectorType: 'BNC' })

const befunde = (items: EquipmentItem[]): string[] =>
  runDrawingChecks({ equipment: items, cables: [] } as never).findings.map((f) => f.id)

describe('Pruefung 18 verstummt nicht mehr durch eine Vermutung', () => {
  it('warnt weiter, solange ein Geraet ohne Datenblatt keine Ports hat', () => {
    expect(befunde([geraet({ portsUnknown: true })])).toContain('ports-unknown:e1')
  })

  it('warnt ANDERS, wenn die Ports aus dem AI-Vorschlag stammen', () => {
    // Der eigentliche Fehler: vorher war dieser Fall komplett still.
    const ids = befunde([
      geraet({
        inputs: [port('i1')],
        outputs: [port('o1')],
        specSource: {
          inputs: { value: '1 In / 1 Out', source: 'AI-Vorschlag aus dem Gerätenamen' },
          outputs: { value: '1 In / 1 Out', source: 'AI-Vorschlag aus dem Gerätenamen' },
        },
      }),
    ])
    expect(ids).toContain('ports-guessed:e1')
  })

  it('schweigt bei Ports, die niemand geraten hat', () => {
    // Sonst waere die Warnung Laerm und wuerde ignoriert — dann haette sie
    // niemandem geholfen.
    const ids = befunde([geraet({ inputs: [port('i1')], outputs: [port('o1')] })])
    expect(ids).not.toContain('ports-guessed:e1')
    expect(ids).not.toContain('ports-unknown:e1')
  })

  it('meldet ein Geraet nicht zweimal', () => {
    // `portsUnknown` UND geraten: die beiden Faelle schliessen einander aus,
    // sonst stuenden zwei Warnungen zur selben Sache in der Liste.
    const ids = befunde([
      geraet({
        portsUnknown: true,
        inputs: [port('i1')],
        specSource: { inputs: { value: '1 In / 0 Out', source: 'AI-Vorschlag' } },
      }),
    ])
    // Nur die beiden Herkunfts-Befunde vergleichen: `open-ports` ist eine
    // andere und voellig richtige Pruefung (ein Port ohne Kabel) und gehoert
    // nicht in diese Gegenueberstellung.
    expect(ids.filter((i) => i.startsWith('ports-'))).toEqual(['ports-guessed:e1'])
  })
})

describe('die zweite Stelle: der ganze generierte Plan', () => {
  it('markiert auch die Ports generierter Geraete', async () => {
    // `#650` hat den Einzelfall geheilt (ein Klick, ein Geraet). Die
    // Plangenerierung fuegt einen GANZEN Plan ein — Geraete, deren Ports und
    // die Kabel dazwischen. Ohne dieselbe Kennzeichnung waere Pruefung 18
    // dort fuer alle Geraete auf einmal still.
    const src = (await import('../src/renderer/lib/planGeneration.ts?raw')).default
    expect(src).toContain('AI_PLAN_SOURCE')
    expect(src).toContain('specSource:')
    // Und die Warnung greift dann wirklich.
    const ids = befunde([
      geraet({
        inputs: [port('i1')],
        specSource: { inputs: { value: '1 In', source: 'AI-Plangenerierung aus einer Beschreibung' } },
      }),
    ])
    expect(ids).toContain('ports-guessed:e1')
  })

  it('haelt die offene Frage fest, statt sie stillschweigend zu beantworten', async () => {
    // Ob ein vom Modell ERFUNDENES KABEL eine Kennzeichnung tragen soll — und
    // ob eine Markierung dafuer ueberhaupt reicht — ist nicht entschieden.
    // `Cable` hat kein `specSource`. Dieser Test haelt fest, dass das
    // absichtlich so ist und nicht vergessen wurde.
    const src = (await import('../src/renderer/lib/planGeneration.ts?raw')).default
    expect(src).toContain('Nur die GERAETE tragen die Kennzeichnung')
    const cableTypes = (await import('../src/renderer/types/cable.ts?raw')).default
    expect(cableTypes).not.toContain('specSource')
  })
})

describe('die beiden Haelften am Quelltext', () => {
  it('der AI-Knopf haelt fest, dass er geraten hat', () => {
    expect(aiButtonSrc).toContain('specSource:')
    expect(aiButtonSrc).toContain("'props.aiPorts.source'")
  })

  it('eine menschliche Aenderung raeumt den ueberholten Beleg ab', () => {
    // Ohne diese Haelfte truege ein Geraet die Warnung „Ports geraten" auch
    // dann noch, wenn jemand die Ports laengst geprueft und korrigiert hat —
    // und der Beleg behauptete einen Wert, den er nicht mehr stuetzt.
    expect(portsSectionSrc).toContain('delete rest.inputs')
    expect(portsSectionSrc).toContain('delete rest.outputs')
  })
})
