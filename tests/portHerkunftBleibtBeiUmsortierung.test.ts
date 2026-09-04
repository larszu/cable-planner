// ───────────────────────────────────────────────────────────────────────────
// Der Herkunfts-Beleg der Ports faellt nur JE SEITE und nur bei einer ECHTEN
// Aenderung.
//
// WAS SCHIEFLIEF (gemessen 2026-09-04, Gegenrunde zu Runde 10):
//
//   1. `applyPorts` loeschte bei JEDER Port-Aenderung `specSource.inputs` UND
//      `specSource.outputs`. Ein Zeichen im Namensfeld eines Inputs nahm damit
//      auch dem Output-Beleg seine Grundlage.
//   2. `PortList.handleDragEnd` ruft `onChange(arrayMove(ports, …))` — eine
//      Umsortierung, die keinen einzigen Wert aendert. Sie loeschte den Beleg
//      trotzdem, und danach schweigt Pruefung 18: der Nutzer hat weiter
//      geratene Ports im Plan und keine Warnung mehr.
//
// Der bestehende Guard konnte das nicht sehen: er prueft, dass die
// Zeichenketten `delete rest.inputs` / `delete rest.outputs` im Quelltext
// STEHEN. Sie standen da. WELCHE Aenderung loeschen darf, prueft ein
// Text-Guard nicht — dafuer muss jemand die Funktion fahren.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { portProvenanceUpdate, portsUnveraendert } from '../src/renderer/lib/portProvenance'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

const port = (id: string, name: string, over: Partial<Port> = {}): Port => ({
  id,
  name,
  type: 'BNC',
  connectorType: 'BNC',
  ...over,
})

const IN = [port('i1', 'IN 1'), port('i2', 'IN 2')]
const OUT = [port('o1', 'OUT 1'), port('o2', 'OUT 2')]

const geraet = (
  over: Partial<Pick<EquipmentItem, 'inputs' | 'outputs' | 'specSource'>> = {},
): Pick<EquipmentItem, 'inputs' | 'outputs' | 'specSource'> => ({
  inputs: IN,
  outputs: OUT,
  specSource: {
    inputs: { source: 'ai', value: 'Vorschlag' },
    outputs: { source: 'ai', value: 'Vorschlag' },
  },
  ...over,
} as Pick<EquipmentItem, 'inputs' | 'outputs' | 'specSource'>)

describe('eine Umsortierung ist keine Aenderung der Herkunft', () => {
  it('gedrehte Inputs lassen beide Belege stehen', () => {
    const u = portProvenanceUpdate(geraet(), { inputs: [IN[1], IN[0]] })
    expect(u).toEqual({ inputsWeg: false, outputsWeg: false })
  })

  it('portsUnveraendert sieht die Reihenfolge nicht', () => {
    expect(portsUnveraendert(IN, [IN[1], IN[0]])).toBe(true)
    expect(portsUnveraendert(IN, [IN[0]])).toBe(false)
    expect(portsUnveraendert(IN, [IN[0], port('i2', 'IN 2 neu')])).toBe(false)
  })
})

describe('der Beleg faellt nur auf der Seite, an der jemand war', () => {
  it('ein umbenannter Input laesst den Output-Beleg stehen', () => {
    const u = portProvenanceUpdate(geraet(), {
      inputs: [port('i1', 'SDI IN'), IN[1]],
    })
    expect(u.inputsWeg).toBe(true)
    expect(u.outputsWeg).toBe(false)
    expect(u.specSource).toEqual({ outputs: { source: 'ai', value: 'Vorschlag' } })
  })

  it('ein entfernter Output laesst den Input-Beleg stehen', () => {
    const u = portProvenanceUpdate(geraet(), { outputs: [OUT[0]] })
    expect(u.outputsWeg).toBe(true)
    expect(u.inputsWeg).toBe(false)
    expect(u.specSource).toEqual({ inputs: { source: 'ai', value: 'Vorschlag' } })
  })

  it('beide geaendert raeumt beide ab', () => {
    const u = portProvenanceUpdate(geraet(), {
      inputs: [IN[0]],
      outputs: [OUT[0]],
    })
    expect(u).toMatchObject({ inputsWeg: true, outputsWeg: true, specSource: undefined })
  })

  it('ein neuer Port zaehlt als Aenderung', () => {
    const u = portProvenanceUpdate(geraet(), { inputs: [...IN, port('i3', 'IN 3')] })
    expect(u.inputsWeg).toBe(true)
  })
})

describe('ohne Beleg gibt es nichts abzuraeumen', () => {
  it('ein Geraet ohne specSource bleibt unberuehrt', () => {
    const u = portProvenanceUpdate(geraet({ specSource: undefined }), { inputs: [IN[0]] })
    expect(u).toEqual({ inputsWeg: false, outputsWeg: false })
  })

  it('fremde specSource-Felder ueberleben', () => {
    const u = portProvenanceUpdate(
      geraet({
        specSource: {
          inputs: { source: 'ai', value: 'Vorschlag' },
          powerConsumptionWatts: { source: 'web', value: '450 W' },
        },
      } as Partial<Pick<EquipmentItem, 'specSource'>>),
      { inputs: [IN[0]] },
    )
    expect(u.specSource).toEqual({ powerConsumptionWatts: { source: 'web', value: '450 W' } })
  })
})
