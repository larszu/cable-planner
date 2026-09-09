// ───────────────────────────────────────────────────────────────────────────
// Der Wächter zur Rückübersetzung: vom Vorschlag zum Kabel (#666).
//
// `circuitSuggest` ist in `circuitSuggest.test.ts` geprüft. Hier geht es um
// die Stelle, an der ein richtiger Vorschlag im Plan trotzdem nicht ankommt:
// die Zuordnung Klemme → Anschluss. Sie kann fehlen, und dann ist die einzige
// richtige Antwort, das zu SAGEN — ein verschluckter Vorschlag liest sich wie
// „alles in Ordnung".
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { planVorschlaege } from '../src/renderer/lib/circuitSuggestPlan'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { CircuitKind } from '../src/renderer/lib/circuitSolver'

const port = (id: string, terminal?: number): Port =>
  ({
    id,
    name: id,
    type: 'power',
    connectorType: 'schuko',
    ...(terminal === undefined ? {} : { circuitTerminal: terminal }),
  }) as unknown as Port

const geraet = (id: string, kind: CircuitKind, ports: Port[]): EquipmentItem =>
  ({
    id,
    name: id,
    category: 'Strom',
    x: 0,
    y: 0,
    inputs: ports,
    outputs: [],
    circuitKind: kind,
  }) as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string], layer = 'power'): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
    layer,
  }) as unknown as Cable

const projekt = (equipment: EquipmentItem[], cables: Cable[]): CablePlannerProject =>
  ({
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    equipment,
    cables,
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

/** Wechselschaltung, der die zweite Korrespondierende fehlt. */
const halbeWechselschaltung = (s2Klemmen: (number | undefined)[] = [0, 1, 2]) =>
  projekt(
    [
      geraet('feed', 'feed', [port('f0', 0)]),
      geraet('W1', 'changeover', [port('a0', 0), port('a1', 1), port('a2', 2)]),
      geraet('W2', 'changeover', [
        port('b0', s2Klemmen[0]),
        port('b1', s2Klemmen[1]),
        port('b2', s2Klemmen[2]),
      ]),
      geraet('L', 'lamp', [port('l0', 0)]),
    ],
    [
      kabel('k1', ['feed', 'f0'], ['W1', 'a0']),
      kabel('k2', ['W1', 'a1'], ['W2', 'b1']),
      kabel('k4', ['W2', 'b0'], ['L', 'l0']),
    ],
  )

describe('der anwendbare Vorschlag', () => {
  it('nennt Geräte und Anschlüsse, nicht Knoten und Klemmen', () => {
    const r = planVorschlaege(halbeWechselschaltung())
    const treffer = r.vorschlaege.find((v) =>
      v.kanten.some(
        (k) =>
          (k.fromPortId === 'a2' && k.toPortId === 'b2') ||
          (k.fromPortId === 'b2' && k.toPortId === 'a2'),
      ),
    )
    expect(treffer).toBeDefined()
    expect(treffer?.hindernis).toBeUndefined()
    expect(treffer?.kanten[0].fromEquipmentId === 'W1' || treffer?.kanten[0].fromEquipmentId === 'W2').toBe(
      true,
    )
  })

  // Diese Zusicherung ist heute NICHT gegenprobierbar, und das steht hier statt
  // es zu verschweigen: der Rechner bietet je Klemme genau einen Kandidaten und
  // schliesst zwei Adern auf dieselbe Klemme selbst aus. Die Buchfuehrung in
  // `planVorschlaege` bleibt trotzdem stehen — sie haelt eine Eigenschaft, die
  // aus einem ANDEREN Modul folgt, und die kann sich aendern. Der Test prueft
  // also die Ausgabe-Eigenschaft, nicht die Regel dahinter.
  it('vergibt innerhalb eines Vorschlags keinen Anschluss zweimal', () => {
    // Beide Korrespondierenden fehlen: der Vorschlag traegt zwei Adern.
    const p = projekt(
      [
        geraet('feed', 'feed', [port('f0', 0)]),
        geraet('W1', 'changeover', [port('a0', 0), port('a1', 1), port('a2', 2)]),
        geraet('W2', 'changeover', [port('b0', 0), port('b1', 1), port('b2', 2)]),
        geraet('L', 'lamp', [port('l0', 0)]),
      ],
      [kabel('k1', ['feed', 'f0'], ['W1', 'a0']), kabel('k4', ['W2', 'b0'], ['L', 'l0'])],
    )
    const r = planVorschlaege(p)
    const zwei = r.vorschlaege.filter((v) => v.kanten.length === 2)
    expect(zwei.length).toBeGreaterThan(0)
    for (const v of zwei) {
      const anschluesse = v.kanten.flatMap((k) => [k.fromPortId, k.toPortId])
      expect(new Set(anschluesse).size, v.text).toBe(anschluesse.length)
    }
  })

  it('nimmt keinen Anschluss, an dem schon ein Strom-Kabel hängt', () => {
    const r = planVorschlaege(halbeWechselschaltung())
    const belegt = new Set(['f0', 'a0', 'a1', 'b1', 'b0', 'l0'])
    for (const v of r.vorschlaege) {
      for (const k of v.kanten) {
        expect(belegt.has(k.fromPortId), v.text).toBe(false)
        expect(belegt.has(k.toPortId), v.text).toBe(false)
      }
    }
  })
})

describe('der Vorschlag, der sich nicht eintragen lässt', () => {
  it('verschwindet nicht, sondern nennt die fehlende Klemme', () => {
    // W2 hat keinen Anschluss mit Klemme 2 — niemand hat sie angegeben.
    const r = planVorschlaege(halbeWechselschaltung([0, 1, undefined]))
    expect(r.vorschlaege.length).toBeGreaterThan(0)
    const gehindert = r.vorschlaege.filter((v) => v.hindernis !== undefined)
    expect(gehindert.length).toBeGreaterThan(0)
    expect(gehindert.some((v) => v.hindernis?.includes('Klemme 2'))).toBe(true)
    expect(gehindert.some((v) => v.hindernis?.includes('W2'))).toBe(true)
    // Und er traegt dann auch keine halbe Kantenliste.
    for (const v of gehindert) expect(v.kanten).toEqual([])
  })

  it('trägt auch keine HALBE Kantenliste, wenn erst die zweite Ader scheitert', () => {
    // Beide Korrespondierenden fehlen — und W2 hat keinen Anschluss mit
    // Klemme 2. Die erste Ader liesse sich eintragen, die zweite nicht. Eine
    // halb eingetragene Wechselschaltung waere schlimmer als eine gar nicht
    // eingetragene: sie sieht danach aus wie fertig.
    const p = projekt(
      [
        geraet('feed', 'feed', [port('f0', 0)]),
        geraet('W1', 'changeover', [port('a0', 0), port('a1', 1), port('a2', 2)]),
        geraet('W2', 'changeover', [port('b0', 0), port('b1', 1), port('b2')]),
        geraet('L', 'lamp', [port('l0', 0)]),
      ],
      [kabel('k1', ['feed', 'f0'], ['W1', 'a0']), kabel('k4', ['W2', 'b0'], ['L', 'l0'])],
    )
    const r = planVorschlaege(p)
    const zweiAdrig = r.vorschlaege.filter((v) => v.text.startsWith('Zwei Adern'))
    expect(zweiAdrig.length).toBeGreaterThan(0)
    for (const v of zweiAdrig) {
      // Entweder ganz eintragbar oder gar nicht — nie zur Haelfte.
      expect(v.kanten.length === 2 || v.kanten.length === 0, v.text).toBe(true)
      if (v.kanten.length === 0) expect(v.hindernis, v.text).toBeDefined()
    }
    expect(zweiAdrig.some((v) => v.hindernis !== undefined)).toBe(true)
  })

  it('sagt in derselben Zeile, was zu tun ist', () => {
    const r = planVorschlaege(halbeWechselschaltung([0, 1, undefined]))
    const g = r.vorschlaege.find((v) => v.hindernis !== undefined)
    expect(g?.hindernis).toContain('Eigenschaften')
  })

  it('behält die Wahrheitstafel auch dann', () => {
    // Der Beleg gehoert zum Vorschlag und nicht zu seiner Anwendbarkeit: wer
    // die Klemme nachtraegt, will vorher sehen, was es bringt.
    const r = planVorschlaege(halbeWechselschaltung([0, 1, undefined]))
    const g = r.vorschlaege.find((v) => v.hindernis !== undefined)
    expect(g?.wahrheitstafel.length).toBeGreaterThan(0)
  })
})

describe('die Klemmstelle ist der Sonderfall', () => {
  it('nimmt dort den ersten freien Anschluss, ohne Klemmennummer', () => {
    const p = projekt(
      [
        geraet('feed', 'feed', [port('f0', 0)]),
        geraet('S', 'switch', [port('s1', 1), port('s2', 2)]),
        // Dose ohne jede Klemmenangabe — bei einer Klemmstelle ist das richtig.
        geraet('J', 'junction', [port('j1'), port('j2')]),
        geraet('L', 'lamp', [port('l0', 0)]),
      ],
      [kabel('k1', ['feed', 'f0'], ['S', 's1']), kabel('k2', ['S', 's2'], ['J', 'j1'])],
    )
    const r = planVorschlaege(p)
    const ueberDose = r.vorschlaege.find(
      (v) => v.hindernis === undefined && v.kanten.some((k) => k.fromEquipmentId === 'J' || k.toEquipmentId === 'J'),
    )
    expect(ueberDose).toBeDefined()
    // Der belegte Anschluss der Dose wird nicht noch einmal vergeben.
    for (const k of ueberDose!.kanten) {
      expect(k.fromPortId).not.toBe('j1')
      expect(k.toPortId).not.toBe('j1')
    }
  })

  it('bei jeder ANDEREN Bauart wird die Klemme verlangt, nicht der nächstbeste Anschluss', () => {
    // Der Wechselschalter haette einen freien Anschluss — aber ohne Klemme 2.
    // Ihn trotzdem zu nehmen waere die stille Umverdrahtung, gegen die
    // `circuitTerminal` eingefuehrt wurde.
    const r = planVorschlaege(halbeWechselschaltung([0, 1, undefined]))
    for (const v of r.vorschlaege) {
      for (const k of v.kanten) {
        expect(k.fromPortId).not.toBe('b2')
        expect(k.toPortId).not.toBe('b2')
      }
    }
  })
})

describe('Befunde und Annahmen gehen unverändert durch', () => {
  it('reicht Befunde, Annahmen und die Vollständigkeit weiter', () => {
    const r = planVorschlaege(halbeWechselschaltung())
    expect(r.befunde.map((b) => b.art)).toContain('schalter-ohne-wirkung')
    expect(r.annahmen).toContain('Alle Einspeisungen führen Spannung.')
    expect(r.vollstaendig).toBe(true)
  })

  it('ein Plan ohne Schaltbild-Geräte meldet das, statt zu schweigen', () => {
    const r = planVorschlaege(projekt([], []))
    expect(r.befunde.map((b) => b.art)).toEqual(['keine-leuchte'])
    expect(r.vorschlaege).toEqual([])
  })
})
