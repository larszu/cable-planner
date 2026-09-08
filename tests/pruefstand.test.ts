import { describe, expect, it } from 'vitest'
import { controlActions, eintraegeFuerAction } from '../src/renderer/lib/controlActions'
import { hubSwitchZeilen } from '../src/renderer/types/hubSwitch'
import type { HubSwitch } from '../src/renderer/types/hubSwitch'
import { CONTROL_TARGETS, istControlTarget } from '../src/renderer/types/switcherControl'
import { INSTANCE_FIELDS } from '../src/renderer/lib/modelFields'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { HubKreuzpunkt } from '../src/renderer/lib/patternRouting'
import switcherControlSrc from '../src/renderer/types/switcherControl.ts?raw'
import controlActionsSrc from '../src/renderer/lib/controlActions.ts?raw'
import dialogSrc from '../src/renderer/components/Canvas/HubSwitchDialog.tsx?raw'

// ───────────────────────────────────────────────────────────────────────────
// S-5 — DER PRUEFSTAND, UND WARUM ER IM BELEG STEHEN MUSS.
//
// Der Nutzer will den Mischer umschalten, um die Ausgaenge zu pruefen — mit
// ATEM Software Control oder einem Emulator, der das Protokoll spricht. Genau
// dafuer ist die App gebaut: sie schickt Kreuzpunkte an eine IP, und ein
// Emulator hoert auf einer IP wie jedes andere Geraet.
//
// UND GENAU DAS IST DAS PROBLEM. Ohne weiteres Zutun sieht eine Probe am
// Emulator in `project.hubSwitches` aus wie ein Eingriff an der laufenden
// Anlage: gleiche Uhrzeit, gleicher Geraetename, gleiche Nummern, gleiches
// „angenommen". Der Datensatz beantwortet aber die Frage „wer hat den
// Ausgang umgeschaltet?" — gestellt nach einer Sendung, von jemandem, der
// nicht dabei war. Eine Probe, die dort als Eingriff steht, schickt ihn an
// eine Stelle, an der nie jemand war.
//
// Deshalb wird das Ziel ERKLAERT (nicht aus der Adresse geraten, ADR-002),
// an EINER Stelle angeheftet, faehrt in jeden Beleg und steht auf dem Blatt.
// ───────────────────────────────────────────────────────────────────────────

const port = (id: string): Port =>
  ({ id, name: id, type: 'video', connectorType: 'bnc' }) as unknown as Port

const eq = (id: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id,
    name: id,
    category: 'Video',
    x: 0,
    y: 0,
    inputs: [],
    outputs: [],
    ...over,
  }) as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
  }) as unknown as Cable

/** Ein Videohub, dessen Ziel der Aufrufer bestimmt. */
const anlage = (over: Partial<EquipmentItem> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    equipment: [
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('mon1', { name: 'Monitor', inputs: [port('m1in')] }),
      eq('hubA', {
        name: 'Smart Videohub 12x12',
        ipAddress: '10.0.0.5',
        controlProtocol: 'videohub',
        inputs: [port('a_in0')],
        outputs: [port('a_out0')],
        ...over,
      }),
    ],
    cables: [
      kabel('k1', ['cam1', 'c1out'], ['hubA', 'a_in0']),
      kabel('k2', ['hubA', 'a_out0'], ['mon1', 'm1in']),
    ],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

const kreuzpunkt: HubKreuzpunkt = {
  equipmentId: 'hubA',
  equipmentName: 'Smart Videohub 12x12',
  outputPortId: 'a_out0',
  outputName: 'Ausgang 1',
  inputPortId: 'a_in0',
  inputName: 'Kamera 1',
} as unknown as HubKreuzpunkt

describe('Das Ziel wird erklaert, nicht geraten', () => {
  it('ohne Erklaerung ist es die Anlage — die vorsichtigere Lesart', () => {
    // Vorsichtiger, weil die beiden Irrtuemer nicht gleich viel kosten: ein
    // Beleg, der faelschlich „Anlage" sagt, laesst jemanden nachsehen; einer,
    // der faelschlich „Pruefstand" sagt, laesst ihn es lassen.
    const plan = controlActions(anlage(), [kreuzpunkt])
    expect(plan.hindernisse).toEqual([])
    expect(plan.actions.map((a) => a.target)).toEqual(['device'])
  })

  it('erklaert steht es im Befehl', () => {
    const plan = controlActions(anlage({ controlTarget: 'simulator' }), [kreuzpunkt])
    expect(plan.actions.map((a) => a.target)).toEqual(['simulator'])
  })

  it('eine localhost-Adresse allein macht daraus KEINEN Pruefstand', () => {
    // Die Versuchung, es an der Adresse abzulesen, ist gross und falsch: ein
    // Pruefstand kann im selben Netz stehen, ein echter Mischer ueber einen
    // Tunnel auf localhost liegen. Dieselbe Richtung, die ADR-002 fuer den
    // Namensabgleich verbietet.
    const plan = controlActions(anlage({ ipAddress: '127.0.0.1' }), [kreuzpunkt])
    expect(plan.actions.map((a) => a.target)).toEqual(['device'])
  })

  it('die Adresse kommt in der Ziel-Entscheidung ueberhaupt nicht vor', () => {
    // Die negative Zusicherung zur Regel darueber — per Quelltext belegbar,
    // weil sie eine Abwesenheit ist. Taucht hier je `127.0.0.1`, `localhost`
    // oder ein Adress-Vergleich auf, wird geraten statt erklaert.
    for (const quelle of [switcherControlSrc, controlActionsSrc]) {
      const code = quelle
        .split('\n')
        .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
        .join('\n')
      expect(code).not.toMatch(/127\.0\.0\.1|localhost/)
    }
  })

  it('ein unbekannter Wert ist kein Ziel', () => {
    expect(istControlTarget('simulator')).toBe(true)
    expect(istControlTarget('device')).toBe(true)
    expect(istControlTarget('emulator')).toBe(false)
    expect(istControlTarget(undefined)).toBe(false)
    expect(CONTROL_TARGETS).toEqual(['device', 'simulator'])
  })
})

describe('Das Ziel faehrt bis in den Beleg', () => {
  const beleg = (target: 'device' | 'simulator') => {
    const plan = controlActions(
      anlage(target === 'simulator' ? { controlTarget: 'simulator' } : {}),
      [kreuzpunkt],
    )
    return eintraegeFuerAction(plan.actions[0], [kreuzpunkt], { ok: true }, {
      at: '2026-09-08T15:00:00.000Z',
    })
  }

  it('eine Probe am Pruefstand ist im Beleg als solche zu erkennen', () => {
    expect(beleg('simulator').map((e) => e.target)).toEqual(['simulator'])
  })

  it('ein Eingriff an der Anlage traegt KEIN Feld — das Fehlen ist die Auskunft', () => {
    // Ein Feld, das in jeder Zeile jeder Projektdatei „device" sagt, kostet
    // Platz und traegt nichts. Und es waere zugleich eine Behauptung ueber
    // alle Dateien, die vor diesem Feld entstanden sind.
    expect(beleg('device')[0]).not.toHaveProperty('target')
  })

  it('auf dem Blatt steht es in Worten — auch bei alten Eintraegen', () => {
    const alt: HubSwitch = {
      at: '2026-09-01T10:00:00.000Z',
      equipmentId: 'hubA',
      output: 0,
      input: 0,
      outputName: 'Ausgang 1',
      inputName: 'Kamera 1',
      ok: true,
    }
    const zeilen = hubSwitchZeilen([alt, { ...alt, target: 'simulator' }], () => 'Hub A')
    expect(zeilen.map((z) => z.ziel)).toEqual(['Anlage', 'Prüfstand'])
  })
})

describe('Die Stelle, an der es angeheftet wird, ist genau eine', () => {
  it('kein Bauer setzt `target` selbst', () => {
    // WARUM DAS ZAEHLT. Vier Protokolle mit je mehreren Rueckgabepunkten
    // ergeben rund fuenfzehn Bauplaetze. Setzte jeder sein Ziel selbst,
    // fiele ein vergessener still auf „Anlage" — und das ist genau die
    // Verwechslung, gegen die dieses Feld gebaut ist. Also gibt es EINEN
    // Ort, und der steht in `controlActions`.
    const code = controlActionsSrc
      .split('\n')
      .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
      .join('\n')
    // Gemessen wird der BEREICH der Bauer — von der ersten Bauer-Funktion bis
    // zur Grenze `controlActions`. Dahinter steht `target:` sehr wohl noch
    // einmal, in `eintraegeFuerAction`; das ist der Beleg und nicht der
    // Befehl, und es ist dort genauso die einzige Stelle.
    const anfang = code.indexOf('const videohubAction')
    const grenze = code.indexOf('export const controlActions')
    expect(anfang).toBeGreaterThan(0)
    expect(grenze).toBeGreaterThan(anfang)
    const bauer = code.slice(anfang, grenze)
    expect([...bauer.matchAll(/target:/g)]).toEqual([])
    expect(code).toMatch(/target: device\.controlTarget \?\? 'device'/)
    // Und im Beleg genau einmal.
    expect([...code.slice(grenze).matchAll(/target:/g)]).toHaveLength(2)
  })

  it('der Dialog rechnet das Ziel aus den AKTIONEN, nicht aus einem Geraet', () => {
    // Ein Weg kann ueber mehrere Geraete laufen. „Pruefstand", weil das
    // erste eines ist, waehrend das zweite die Anlage ist, waere die
    // gefaehrlichste Fassung dieser Anzeige.
    const dialog = dialogSrc
      .split('\n')
      .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
      .join('\n')
    expect(dialog).toMatch(/plan\.actions\.map\(\(a\) => a\.target\)/)
    expect(dialog).toMatch(/gemischtesZiel/)
    expect(dialog).toMatch(/warningSimulator/)
  })
})

describe('Das Ziel gehoert zum Exemplar, nicht zum Typ', () => {
  it('es wandert nicht in die Bibliothek', () => {
    // Sonst machte ein daraus angelegtes Geraet aus einer Anlage einen
    // Pruefstand — oder schlimmer, umgekehrt: aus einem Pruefstand eine
    // Anlage, und der naechste Befehl ginge ungewarnt an einen Mischer.
    expect(INSTANCE_FIELDS as readonly string[]).toContain('controlTarget')
  })
})
