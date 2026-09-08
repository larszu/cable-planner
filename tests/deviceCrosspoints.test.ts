import { describe, expect, it } from 'vitest'
import {
  deviceCrosspoints,
  hatKreuzpunkte,
  normalisePlannedCrosspoints,
  outputsFedBy,
} from '../src/renderer/lib/deviceCrosspoints'
import { signalChains, PASS_THROUGH_LABEL, type PassThroughKind } from '../src/renderer/lib/signalChain'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import projectStoreSrc from '../src/renderer/store/projectStore.ts?raw'
import sectionSrc from '../src/renderer/components/Properties/sections/SwitchingSection.tsx?raw'

// ───────────────────────────────────────────────────────────────────────────
// S-1 — der MISCHER leitet weiter (2026-09-08).
//
// Eigentuemer-Wunsch: „Man braucht ja auch keinen Eingang. Man kann ja
// Kameras und andere Geraete die ein Signal erstellen als Quelle benutzen.
// Aber die Videomischer-Schaltung und so muss trotzdem das Signal korrekt
// weiterleiten."
//
// Genau das konnte der Plan nicht. Weitergeleitet hat bis heute NUR ein
// Videohub, und zwar ueber `videohubRouting.planned` — eine Tabelle
// Ausgangs-INDEX auf Eingangs-INDEX. Ein Mischer schaltet dieselbe Sorte
// Kreuzpunkt, aber seine Nummern sind andere (beim ATEM ist der Programm-Bus
// kein Ausgangs-Index, sondern ein Mix-Effect). Der Weg
// „Kamera -> ATEM -> Aux -> Monitor" existierte im Plan deshalb gar nicht.
//
// Die Loesung ist eine zweite, HERSTELLERNEUTRALE Form — Anschluss-Id auf
// Anschluss-Id — und, wichtiger, EINE Auswertung beider Formen. Zwei Leser
// waeren die Defektform `zwei-rechnungen`.
// ───────────────────────────────────────────────────────────────────────────

const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const port = (id: string): Port =>
  ({ id, name: id, type: 'video', connectorType: 'bnc' }) as unknown as Port

const eq = (id: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name: id, category: 'Video', x: 0, y: 0, inputs: [], outputs: [], ...over }) as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
  }) as unknown as Cable

const mischer = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  eq('mix', {
    name: 'ATEM Mini Extreme',
    inputs: [port('m_in0'), port('m_in1')],
    outputs: [port('m_pgm'), port('m_aux1')],
    ...over,
  })

describe('Beide Formen, eine Antwort', () => {
  it('die herstellerneutrale Tabelle wird gelesen', () => {
    const d = mischer({ plannedCrosspoints: { m_aux1: 'm_in1' } })
    expect([...deviceCrosspoints(d)]).toEqual([['m_aux1', 'm_in1']])
  })

  it('die Index-Tabelle des Videohubs wird auf Anschluss-Ids uebersetzt', () => {
    const d = eq('hub', {
      inputs: [port('i0'), port('i1')],
      outputs: [port('o0'), port('o1')],
      videohubRouting: { planned: { 0: 1, 1: 0 }, salvos: [] },
    })
    expect([...deviceCrosspoints(d)].sort()).toEqual([
      ['o0', 'i1'],
      ['o1', 'i0'],
    ])
  })

  it('die ausdrueckliche Angabe gewinnt JE AUSGANG, nicht je Geraet', () => {
    // Der Kern der Zusammenfuehrung. Wer eine einzige Zeile in der neuen Form
    // eintraegt, loescht damit nicht die uebrigen elf der alten.
    const d = eq('hub', {
      inputs: [port('i0'), port('i1')],
      outputs: [port('o0'), port('o1')],
      videohubRouting: { planned: { 0: 0, 1: 0 }, salvos: [] },
      plannedCrosspoints: { o1: 'i1' },
    })
    const map = deviceCrosspoints(d)
    expect(map.get('o0')).toBe('i0') // aus der alten Tabelle, unberuehrt
    expect(map.get('o1')).toBe('i1') // die ausdrueckliche Angabe gewinnt
  })

  it('eine Zeile auf einen Anschluss, den es nicht gibt, faellt', () => {
    const d = mischer({ plannedCrosspoints: { m_aux1: 'gibt-es-nicht', weg: 'm_in0' } })
    expect(deviceCrosspoints(d).size).toBe(0)
  })

  it('ein Geraet ohne Ein- oder Ausgaenge schaltet nichts', () => {
    expect(hatKreuzpunkte(eq('x', { inputs: [port('a')] }))).toBe(false)
    expect(hatKreuzpunkte(eq('y', { outputs: [port('b')] }))).toBe(false)
  })

  it('eine Quelle darf auf mehreren Ausgaengen liegen', () => {
    const d = mischer({ plannedCrosspoints: { m_pgm: 'm_in0', m_aux1: 'm_in0' } })
    expect(outputsFedBy(d, 'm_in0').sort()).toEqual(['m_aux1', 'm_pgm'])
    expect(outputsFedBy(d, 'm_in1')).toEqual([])
  })
})

describe('Der Signalweg laeuft durch den Mischer', () => {
  const anlage = (over: Partial<EquipmentItem> = {}) => ({
    equipment: [
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('cam2', { name: 'Kamera 2', outputs: [port('c2out')] }),
      mischer(over),
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
    ],
    cables: [
      kabel('k1', ['cam1', 'c1out'], ['mix', 'm_in0']),
      kabel('k2', ['cam2', 'c2out'], ['mix', 'm_in1']),
      kabel('k3', ['mix', 'm_aux1'], ['mon1', 'm1in']),
    ],
  })

  it('ohne Eintrag endet der Weg am Mischer — und das bleibt so', () => {
    // Kein Raten. Eine kuerzere Antwort ist besser als eine falsche: der Plan
    // zeigte sonst einen vollstaendigen Weg zu einem Monitor, an dem in
    // Wahrheit etwas anderes steht.
    const { equipment, cables } = anlage()
    const ketten = signalChains(equipment, cables, { vonEquipmentId: 'cam1', auchDirekte: true })
    const ziel = ketten.find((k) => k.end === 'ziel')
    expect(ziel?.steps[ziel.steps.length - 1].toEquipmentId).toBe('mix')
  })

  it('mit Eintrag laeuft er bis zum Monitor', () => {
    const { equipment, cables } = anlage({ plannedCrosspoints: { m_aux1: 'm_in0' } })
    const ketten = signalChains(equipment, cables, { vonEquipmentId: 'cam1', auchDirekte: true })
    const ziel = ketten.find((k) => k.end === 'ziel')
    expect(ziel?.steps[ziel.steps.length - 1].toEquipmentId).toBe('mon1')
    expect(ziel?.steps[0].through).toBe('mixer')
  })

  it('die andere Kamera kommt dort NICHT an', () => {
    // Die eigentliche Zusicherung: der Weiterweg haengt an der Schaltung und
    // nicht daran, dass irgendein Kabel vom Mischer weggeht.
    const { equipment, cables } = anlage({ plannedCrosspoints: { m_aux1: 'm_in0' } })
    const ketten = signalChains(equipment, cables, { vonEquipmentId: 'cam2', auchDirekte: true })
    const orte = ketten.flatMap((k) => k.steps.map((s) => s.toEquipmentId))
    expect(orte).not.toContain('mon1')
  })

  it('am Mischer heisst die Durchleitung „Mischer" und nicht „Kreuzschiene"', () => {
    // Auf dem Blatt stuende sonst „Kreuzschiene" an einer Stelle, an der ein
    // Mischer sitzt, und wer den Weg abgeht, sucht ein Geraet, das dort nicht
    // steht.
    const { equipment, cables } = anlage({ plannedCrosspoints: { m_aux1: 'm_in0' } })
    const ketten = signalChains(equipment, cables, { vonEquipmentId: 'cam1', auchDirekte: true })
    const durch = ketten[0].steps[0].through as PassThroughKind
    expect(PASS_THROUGH_LABEL[durch]).toBe('Mischer')
  })

  it('ein Videohub bleibt „Kreuzschiene"', () => {
    const hub = eq('hub', {
      name: 'Smart Videohub 12x12',
      inputs: [port('i0')],
      outputs: [port('o0')],
      plannedCrosspoints: { o0: 'i0' },
    })
    const equipment = [
      eq('cam1', { outputs: [port('c1out')] }),
      hub,
      eq('mon1', { inputs: [port('m1in')] }),
    ]
    const cables = [
      kabel('k1', ['cam1', 'c1out'], ['hub', 'i0']),
      kabel('k2', ['hub', 'o0'], ['mon1', 'm1in']),
    ]
    const ketten = signalChains(equipment, cables, { vonEquipmentId: 'cam1', auchDirekte: true })
    expect(ketten[0].steps[0].through).toBe('router')
  })

  it('zwei Gruende, kein Kabel zu finden, bekommen zwei Saetze', () => {
    // „Am geschalteten Ausgang haengt kein Kabel" schickt jemanden auf die
    // Suche nach einem fehlenden Kabel. Liegt das Signal aber auf gar keinem
    // Ausgang, sucht er umsonst.
    const equipment = [
      eq('cam1', { outputs: [port('c1out')] }),
      eq('cam2', { outputs: [port('c2out')] }),
      mischer({ plannedCrosspoints: { m_pgm: 'm_in0' } }),
    ]
    const cables = [
      kabel('k1', ['cam1', 'c1out'], ['mix', 'm_in0']),
      kabel('k2', ['cam2', 'c2out'], ['mix', 'm_in1']),
    ]
    const vonCam1 = signalChains(equipment, cables, { vonEquipmentId: 'cam1', auchDirekte: true })
    expect(vonCam1[0].endNote).toMatch(/kein Kabel/)
    const vonCam2 = signalChains(equipment, cables, { vonEquipmentId: 'cam2', auchDirekte: true })
    expect(vonCam2[0].endNote).toMatch(/auf keinen Ausgang/)
  })

  it('ein Videohub ohne jeden Kreuzpunkt sagt weiterhin, dass nichts geplant ist', () => {
    const equipment = [
      eq('cam1', { outputs: [port('c1out')] }),
      eq('hub', {
        name: 'Smart Videohub 12x12',
        inputs: [port('i0')],
        outputs: [port('o0')],
      }),
    ]
    const cables = [kabel('k1', ['cam1', 'c1out'], ['hub', 'i0'])]
    const ketten = signalChains(equipment, cables, { vonEquipmentId: 'cam1', auchDirekte: true })
    expect(ketten[0].endNote).toMatch(/ohne gesetzten Kreuzpunkt/)
  })
})

describe('Beim Laden faellt, was ins Leere zeigt', () => {
  const outs = new Set(['o0', 'o1'])
  const ins = new Set(['i0', 'i1'])

  it('eine Zeile auf einen geloeschten Anschluss faellt, mit Grund', () => {
    const gruende: string[] = []
    const raus = normalisePlannedCrosspoints(
      { o0: 'i0', o1: 'weg', weg: 'i1' },
      outs,
      ins,
      (d) => gruende.push(d.reason),
    )
    expect(raus).toEqual({ o0: 'i0' })
    expect(gruende).toEqual(['dangling-ref', 'dangling-ref'])
  })

  it('bleibt nichts uebrig, ist das Feld weg statt leer', () => {
    // Eine leere Tabelle auf jedem Geraet waere Ballast in jedem Projektfile.
    expect(normalisePlannedCrosspoints({ o0: 'weg' }, outs, ins)).toBeUndefined()
    expect(normalisePlannedCrosspoints({}, outs, ins)).toBeUndefined()
  })

  it('was keine Tabelle ist, ergibt undefined statt eines Absturzes', () => {
    expect(normalisePlannedCrosspoints(undefined, outs, ins)).toBeUndefined()
    expect(normalisePlannedCrosspoints(['o0'], outs, ins)).toBeUndefined()
    expect(normalisePlannedCrosspoints({ o0: 7 }, outs, ins)).toBeUndefined()
  })

  it('die Heilung ist verdrahtet', () => {
    expect(ohneKommentare(projectStoreSrc)).toMatch(/normalisePlannedCrosspoints\(item\.plannedCrosspoints,/)
  })
})

describe('Die Sektion traegt ein, statt zu raten', () => {
  const src = ohneKommentare(sectionSrc)

  it('sie liest die Kreuzpunkte ueber die EINE Ableitung', () => {
    expect(src).toMatch(/deviceCrosspoints\(equipment\)/)
    // Nicht selbst noch einmal aus der Index-Tabelle rechnen.
    expect(src).not.toMatch(/videohubRouting/)
  })

  it('ein leerer Eintrag loescht die Zeile, statt eine leere zu schreiben', () => {
    expect(src).toMatch(/delete naechste\[outputPortId\]/)
  })

  it('sie raet keine Vorbelegung', () => {
    // Ein Namensabgleich fiele hier in die gefaehrliche Richtung: der Plan
    // zeigte einen vollstaendigen Weg zu einem Monitor, an dem etwas anderes
    // steht.
    expect(src).not.toMatch(/test\(|match\(|toLowerCase\(\)\.includes/)
  })
})
