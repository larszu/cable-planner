// ───────────────────────────────────────────────────────────────────────────
// Der Wächter zu den Schaltungs-Vorschlägen (#666, dritter Satz).
//
// Die Prüfsteine sind die drei Zusagen aus der Kopfzeile des Moduls:
//   1. Jeder Vorschlag ist NACHGERECHNET — die mitgelieferte Wahrheitstafel
//      stimmt mit dem überein, was `solveCircuit` nach der Änderung sagt.
//   2. „In Ordnung" heisst UNABHÄNGIG, nicht bloss schaltbar — die
//      Wechselschaltung mit einer fehlenden Korrespondierenden ist der Fall,
//      an dem sich das entscheidet.
//   3. Keine stillen Grenzen und keine stillen Annahmen.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { solveCircuit, type CircuitEdge, type CircuitNode } from '../src/renderer/lib/circuitSolver'
import { schaltungsVorschlaege, GRENZEN } from '../src/renderer/lib/circuitSuggest'

const kante = (
  id: string,
  fromNode: string,
  fromTerminal: number,
  toNode: string,
  toTerminal: number,
): CircuitEdge => ({ id, fromNode, fromTerminal, toNode, toTerminal })

/** Wechselschaltung, wie sie sein soll: zwei Korrespondierende. */
const wechselKnoten: CircuitNode[] = [
  { id: 'F', kind: 'feed', position: 1 },
  { id: 'W1', kind: 'changeover', position: 1 },
  { id: 'W2', kind: 'changeover', position: 1 },
  { id: 'L', kind: 'lamp' },
]
const wechselKanten: CircuitEdge[] = [
  kante('e1', 'F', 0, 'W1', 0),
  kante('e2', 'W1', 1, 'W2', 1),
  kante('e3', 'W1', 2, 'W2', 2),
  kante('e4', 'W2', 0, 'L', 0),
]

describe('richtige Wechselschaltung', () => {
  it('brennt bei gleicher Stellung und ist damit in Ordnung', () => {
    const r = schaltungsVorschlaege(wechselKnoten, wechselKanten)
    expect(r.befunde).toEqual([])
    expect(r.vorschlaege).toEqual([])
    expect(r.vollstaendig).toBe(true)
  })

  it('nennt die Annahme, unter der gerechnet wurde', () => {
    const r = schaltungsVorschlaege(wechselKnoten, wechselKanten)
    expect(r.annahmen).toContain('Alle Einspeisungen führen Spannung.')
  })
})

describe('Wechselschaltung mit fehlender Korrespondierender', () => {
  // Genau der Fall, den „schaltbar" durchgehen laesst: die Leuchte brennt bei
  // W1=1 und W2=1, also einmal an und einmal aus — und trotzdem tut W2 nichts,
  // sobald W1 auf 2 steht.
  const kanten = wechselKanten.filter((e) => e.id !== 'e3')

  it('ist schaltbar und trotzdem ein Befund', () => {
    const tafel = [1, 2].flatMap((p1) =>
      [1, 2].map((p2) =>
        solveCircuit(
          wechselKnoten.map((n) =>
            n.id === 'W1' ? { ...n, position: p1 } : n.id === 'W2' ? { ...n, position: p2 } : n,
          ),
          kanten,
        ).lamps.get('L')?.lit,
      ),
    )
    // einmal an, dreimal aus — „schaltbar" waere erfuellt.
    expect(tafel.filter(Boolean)).toHaveLength(1)

    const r = schaltungsVorschlaege(wechselKnoten, kanten)
    expect(r.befunde.map((b) => b.art)).toContain('schalter-ohne-wirkung')
    expect(r.befunde.filter((b) => b.art === 'schalter-ohne-wirkung').map((b) => b.knotenId).sort())
      .toEqual(['W1', 'W2'])
  })

  it('schlägt genau die fehlende Ader vor', () => {
    const r = schaltungsVorschlaege(wechselKnoten, kanten)
    expect(r.vorschlaege.length).toBeGreaterThan(0)
    const gefunden = r.vorschlaege.some((v) =>
      v.kanten.some(
        (k) =>
          (k.fromNode === 'W1' && k.fromTerminal === 2 && k.toNode === 'W2' && k.toTerminal === 2) ||
          (k.fromNode === 'W2' && k.fromTerminal === 2 && k.toNode === 'W1' && k.toTerminal === 2),
      ),
    )
    expect(gefunden).toBe(true)
  })

  it('jeder Vorschlag ist einer, der wirklich hilft — nachgerechnet', () => {
    const r = schaltungsVorschlaege(wechselKnoten, kanten)
    for (const v of r.vorschlaege) {
      const mitVorschlag = [
        ...kanten,
        ...v.kanten.map((k, i) => kante(`neu-${i}`, k.fromNode, k.fromTerminal, k.toNode, k.toTerminal)),
      ]
      const an = [1, 2].flatMap((p1) =>
        [1, 2].map((p2) =>
          solveCircuit(
            wechselKnoten.map((n) =>
              n.id === 'W1' ? { ...n, position: p1 } : n.id === 'W2' ? { ...n, position: p2 } : n,
            ),
            mitVorschlag,
          ).lamps.get('L')?.lit === true,
        ),
      )
      // Unabhaengig heisst hier: genau zwei der vier Stellungen brennen.
      expect(an.filter(Boolean), v.text).toHaveLength(2)
    }
  })

  it('die mitgelieferte Wahrheitstafel stimmt mit dem Rechner überein', () => {
    const r = schaltungsVorschlaege(wechselKnoten, kanten)
    const v = r.vorschlaege[0]
    expect(v.wahrheitstafel).toHaveLength(4)
    for (const zeile of v.wahrheitstafel) {
      const knoten = wechselKnoten.map((n) =>
        zeile.stellungen[n.id] === undefined ? n : { ...n, position: zeile.stellungen[n.id] },
      )
      const mitVorschlag = [
        ...kanten,
        ...v.kanten.map((k, i) => kante(`neu-${i}`, k.fromNode, k.fromTerminal, k.toNode, k.toTerminal)),
      ]
      expect(solveCircuit(knoten, mitVorschlag).lamps.get('L')?.lit === true).toBe(zeile.an)
    }
  })
})

describe('Leuchte ohne Ader', () => {
  const knoten: CircuitNode[] = [
    { id: 'F', kind: 'feed', position: 1 },
    { id: 'S', kind: 'switch', position: 1 },
    { id: 'L', kind: 'lamp' },
  ]
  const kanten = [kante('e1', 'F', 0, 'S', 1)]

  it('meldet den fehlenden Anschluss und schlägt ihn vor', () => {
    const r = schaltungsVorschlaege(knoten, kanten)
    expect(r.befunde.map((b) => b.art)).toContain('leuchte-ohne-anschluss')
    expect(r.befunde.map((b) => b.art)).toContain('nie-an')
    const trifft = r.vorschlaege.some((v) =>
      v.kanten.some(
        (k) =>
          (k.fromNode === 'S' && k.fromTerminal === 2 && k.toNode === 'L') ||
          (k.toNode === 'S' && k.toTerminal === 2 && k.fromNode === 'L'),
      ),
    )
    expect(trifft).toBe(true)
  })

  it('schlägt keine Ader auf eine schon belegte Klemme vor', () => {
    const r = schaltungsVorschlaege(knoten, kanten)
    for (const v of r.vorschlaege) {
      for (const k of v.kanten) {
        expect(`${k.fromNode}#${k.fromTerminal}`).not.toBe('F#0')
        expect(`${k.toNode}#${k.toTerminal}`).not.toBe('F#0')
        expect(`${k.fromNode}#${k.fromTerminal}`).not.toBe('S#1')
        expect(`${k.toNode}#${k.toTerminal}`).not.toBe('S#1')
      }
    }
  })

  it('legt keine zweite Ader auf eine schon belegte Klemme', () => {
    // Der Fall, an dem sich das entscheidet: `S#2` haengt bereits an einer Dose,
    // die ins Leere geht. Eine Ader von `S#2` zur Leuchte WUERDE die Schaltung
    // in Ordnung bringen — an der Klemme ist dafuer aber kein Platz. Der Weg
    // ueber die Dose leistet dasselbe und laesst sich bauen.
    const knoten: CircuitNode[] = [
      { id: 'F', kind: 'feed', position: 1 },
      { id: 'S', kind: 'switch', position: 1 },
      { id: 'J', kind: 'junction' },
      { id: 'L', kind: 'lamp' },
    ]
    const kanten = [kante('e1', 'F', 0, 'S', 1), kante('e2', 'S', 2, 'J', 0)]
    const r = schaltungsVorschlaege(knoten, kanten)
    expect(r.vorschlaege.length).toBeGreaterThan(0)
    const belegt = new Set(['F#0', 'S#1', 'S#2', 'J#0'])
    for (const v of r.vorschlaege) {
      for (const k of v.kanten) {
        expect(belegt.has(`${k.fromNode}#${k.fromTerminal}`), v.text).toBe(false)
        expect(belegt.has(`${k.toNode}#${k.toTerminal}`), v.text).toBe(false)
      }
    }
    // Und ueber die Dose wird die Leuchte trotzdem erreicht.
    expect(r.vorschlaege.some((v) => v.kanten.some((k) => k.fromNode === 'J' && k.toNode === 'L'))).toBe(true)
  })

  it('schlägt keine Ader von einem Knoten auf sich selbst vor', () => {
    const r = schaltungsVorschlaege(knoten, kanten)
    for (const v of r.vorschlaege) {
      for (const k of v.kanten) expect(k.fromNode).not.toBe(k.toNode)
    }
  })
})

describe('was sich nicht durch Hinzufügen beheben lässt', () => {
  it('immer an: Befund mit Grund, keine Vorschläge, aber vollständig', () => {
    // Der Schalter haengt parallel statt in Reihe: die Leuchte haengt direkt
    // an der Einspeisung.
    const knoten: CircuitNode[] = [
      { id: 'F', kind: 'feed', position: 1 },
      { id: 'S', kind: 'switch', position: 1 },
      { id: 'L', kind: 'lamp' },
    ]
    const kanten = [kante('e1', 'F', 0, 'L', 0), kante('e2', 'F', 0, 'S', 1)]
    const r = schaltungsVorschlaege(knoten, kanten)
    const immer = r.befunde.find((b) => b.art === 'immer-an')
    expect(immer).toBeDefined()
    expect(immer?.text).toContain('Entfernen')
    expect(r.vorschlaege).toEqual([])
    // Und ausdruecklich NICHT als gekappte Suche ausgewiesen.
    expect(r.vollstaendig).toBe(true)
    expect(r.grund).toBeUndefined()
  })
})

describe('Kreis ohne Bedienschalter', () => {
  const knoten: CircuitNode[] = [
    { id: 'F', kind: 'feed', position: 1 },
    { id: 'L', kind: 'lamp' },
  ]

  it('prüft dann nur, ob die Leuchte überhaupt brennt', () => {
    const r = schaltungsVorschlaege(knoten, [])
    expect(r.befunde.map((b) => b.art)).toContain('ohne-schalter')
    expect(r.vorschlaege).toHaveLength(1)
    expect(r.vorschlaege[0].kanten).toEqual([
      { fromNode: 'F', fromTerminal: 0, toNode: 'L', toTerminal: 0 },
    ])
  })

  it('brennt sie schon, gibt es nichts vorzuschlagen', () => {
    const r = schaltungsVorschlaege(knoten, [kante('e1', 'F', 0, 'L', 0)])
    expect(r.vorschlaege).toEqual([])
    expect(r.befunde.map((b) => b.art)).toEqual(['ohne-schalter'])
  })
})

describe('Betriebsmittel sind kein Verdrahtungsfehler', () => {
  it('ein ausgelöster LS macht die Schaltung nicht falsch', () => {
    const knoten: CircuitNode[] = [
      { id: 'F', kind: 'feed', position: 1 },
      // Ausgeloest: Stellung 0. Ohne die Annahme „leitend" waere die Leuchte
      // nie an und jede Verdrahtung ein Befund.
      { id: 'LS', kind: 'mcb', position: 0 },
      { id: 'S', kind: 'switch', position: 1 },
      { id: 'L', kind: 'lamp' },
    ]
    const kanten = [
      kante('e1', 'F', 0, 'LS', 1),
      kante('e2', 'LS', 2, 'S', 1),
      kante('e3', 'S', 2, 'L', 0),
    ]
    const r = schaltungsVorschlaege(knoten, kanten)
    expect(r.befunde).toEqual([])
    expect(r.vorschlaege).toEqual([])
    expect(r.annahmen).toContain('FI, LS, Not-Aus, Schütz und Relais sind leitend angenommen.')
  })

  it('ohne Betriebsmittel steht die Annahme auch nicht da', () => {
    const r = schaltungsVorschlaege(wechselKnoten, wechselKanten)
    expect(r.annahmen).toEqual(['Alle Einspeisungen führen Spannung.'])
  })
})

describe('ausgeschaltete Einspeisung', () => {
  it('ist ein eigener Befund und kein Verdrahtungsfehler', () => {
    const aus = wechselKnoten.map((n) => (n.kind === 'feed' ? { ...n, position: 0 } : n))
    const r = schaltungsVorschlaege(aus, wechselKanten)
    expect(r.befunde.map((b) => b.art)).toEqual(['keine-spannung'])
    expect(r.vorschlaege).toEqual([])
  })

  it('ohne Einspeisung wird gar nicht erst gesucht', () => {
    const ohne = wechselKnoten.filter((n) => n.kind !== 'feed')
    const r = schaltungsVorschlaege(ohne, wechselKanten)
    expect(r.befunde.map((b) => b.art)).toEqual(['keine-einspeisung'])
    expect(r.vorschlaege).toEqual([])
  })
})

describe('welche Leuchte', () => {
  const zwei: CircuitNode[] = [
    { id: 'F', kind: 'feed', position: 1 },
    { id: 'S', kind: 'switch', position: 1 },
    { id: 'L1', kind: 'lamp' },
    { id: 'L2', kind: 'lamp' },
  ]

  it('sucht sich bei mehreren keine aus', () => {
    const r = schaltungsVorschlaege(zwei, [kante('e1', 'F', 0, 'S', 1)])
    expect(r.befunde.map((b) => b.art)).toEqual(['mehrere-leuchten'])
    expect(r.vorschlaege).toEqual([])
  })

  it('nimmt die benannte', () => {
    const r = schaltungsVorschlaege(zwei, [kante('e1', 'F', 0, 'S', 1)], 'L2')
    expect(r.befunde.every((b) => b.lampeId === undefined || b.lampeId === 'L2')).toBe(true)
    expect(r.vorschlaege.length).toBeGreaterThan(0)
    for (const v of r.vorschlaege) {
      expect(v.kanten.some((k) => k.fromNode === 'L1' || k.toNode === 'L1')).toBe(false)
    }
  })

  it('eine benannte Leuchte, die es nicht gibt, ist ein Befund', () => {
    const r = schaltungsVorschlaege(zwei, [], 'L9')
    expect(r.befunde.map((b) => b.art)).toEqual(['keine-leuchte'])
  })
})

describe('keine stillen Grenzen', () => {
  it('zu viele Stellungen: gesagt, nicht halb gerechnet', () => {
    // Neun Aus-Schalter ergeben 512 Kombinationen — mehr als die 256, die
    // durchgerechnet werden.
    const knoten: CircuitNode[] = [
      { id: 'F', kind: 'feed', position: 1 },
      { id: 'L', kind: 'lamp' },
      ...Array.from({ length: 9 }, (_, i) => ({ id: `S${i}`, kind: 'switch' as const, position: 1 })),
    ]
    const r = schaltungsVorschlaege(knoten, [])
    expect(r.vollstaendig).toBe(false)
    expect(r.grund).toContain(String(GRENZEN.stellungen))
    expect(r.vorschlaege).toEqual([])
  })

  it('zu viele freie Klemmen: ebenfalls gesagt', () => {
    // Kein Bedienschalter, damit die Stellungs-Grenze nicht zuerst greift —
    // dafuer mehr als GRENZEN.klemmen freie Klemmen.
    const knoten: CircuitNode[] = [
      { id: 'F', kind: 'feed', position: 1 },
      { id: 'L', kind: 'lamp' },
      ...Array.from({ length: 25 }, (_, i) => ({ id: `D${i}`, kind: 'dimmer' as const })),
    ]
    const r = schaltungsVorschlaege(knoten, [])
    expect(r.vollstaendig).toBe(false)
    expect(r.grund).toContain(String(GRENZEN.klemmen))
  })
})

describe('Kreuzschaltung', () => {
  // Drei Stellen, eine Leuchte: W1 — K — W2.
  const knoten: CircuitNode[] = [
    { id: 'F', kind: 'feed', position: 1 },
    { id: 'W1', kind: 'changeover', position: 1 },
    { id: 'K', kind: 'crossover', position: 1 },
    { id: 'W2', kind: 'changeover', position: 1 },
    { id: 'L', kind: 'lamp' },
  ]
  const kanten = [
    kante('e1', 'F', 0, 'W1', 0),
    kante('e2', 'W1', 1, 'K', 1),
    kante('e3', 'W1', 2, 'K', 2),
    kante('e4', 'K', 3, 'W2', 1),
    kante('e5', 'K', 4, 'W2', 2),
    kante('e6', 'W2', 0, 'L', 0),
  ]

  it('ist in Ordnung, wenn alle drei Stellen wirken', () => {
    const r = schaltungsVorschlaege(knoten, kanten)
    expect(r.befunde).toEqual([])
    expect(r.vorschlaege).toEqual([])
  })

  it('fehlt eine Ader am Kreuzschalter, wird sie vorgeschlagen', () => {
    const r = schaltungsVorschlaege(
      knoten,
      kanten.filter((e) => e.id !== 'e5'),
    )
    expect(r.befunde.map((b) => b.art)).toContain('schalter-ohne-wirkung')
    const trifft = r.vorschlaege.some((v) =>
      v.kanten.some(
        (k) =>
          (k.fromNode === 'K' && k.fromTerminal === 4 && k.toNode === 'W2' && k.toTerminal === 2) ||
          (k.toNode === 'K' && k.toTerminal === 4 && k.fromNode === 'W2' && k.fromTerminal === 2),
      ),
    )
    expect(trifft).toBe(true)
  })
})
