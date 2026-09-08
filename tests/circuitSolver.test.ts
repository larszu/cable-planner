import { describe, expect, it } from 'vitest'
import { solveCircuit, type CircuitEdge, type CircuitNode } from '../src/renderer/lib/circuitSolver'

// ───────────────────────────────────────────────────────────────────────────
// Wer brennt, wenn Strom anliegt (Eigentümer-Wunsch 2026-09-08).
//
// DIE PRÜFUNG, an der sich die Bauform entscheidet, ist die WECHSELSCHALTUNG.
// Sie lässt sich nicht als Kette von An/Aus beschreiben: die Leuchte brennt,
// wenn beide Schalter auf DERSELBEN Seite stehen — bei „beide oben" ebenso
// wie bei „beide unten". Wer das als Kette baut, braucht einen Sonderfall,
// und der Kreuzschalter macht daraus drei.
//
// Deshalb ist die Wahrheitstabelle hier vollständig ausgeschrieben und nicht
// gerechnet: sie ist die Zusicherung, und eine Zusicherung, die sich derselben
// Formel bedient wie der Code, prüft nichts.
// ───────────────────────────────────────────────────────────────────────────

const k = (id: string, from: string, ft: number, to: string, tt: number): CircuitEdge => ({
  id,
  fromNode: from,
  fromTerminal: ft,
  toNode: to,
  toTerminal: tt,
})

describe('Der einfachste Fall', () => {
  const nodes = (an: boolean, schalter: number): CircuitNode[] => [
    { id: 'f', kind: 'feed', position: an ? 1 : 0 },
    { id: 's', kind: 'switch', position: schalter },
    { id: 'l', kind: 'lamp' },
  ]
  const edges = [k('e1', 'f', 0, 's', 1), k('e2', 's', 2, 'l', 0)]

  it('brennt bei Spannung und geschlossenem Schalter', () => {
    const r = solveCircuit(nodes(true, 1), edges)
    expect(r.lamps.get('l')).toEqual({ lit: true, levelPct: 100 })
    expect([...r.energisedEdges].sort()).toEqual(['e1', 'e2'])
  })

  it('brennt nicht bei offenem Schalter — und die Ader dahinter führt nichts', () => {
    const r = solveCircuit(nodes(true, 0), edges)
    expect(r.lamps.get('l')).toEqual({ lit: false, levelPct: 0 })
    expect([...r.energisedEdges]).toEqual(['e1'])
  })

  it('brennt nicht ohne Einspeisung', () => {
    const r = solveCircuit(nodes(false, 1), edges)
    expect(r.lamps.get('l')?.lit).toBe(false)
    expect([...r.energisedEdges]).toEqual([])
  })
})

describe('Wechselschaltung — die vollständige Wahrheitstabelle', () => {
  // Einspeisung → Wechselschalter A (Klemme 0), A/1 und A/2 als
  // Korrespondierende auf B/1 und B/2, B/0 → Leuchte.
  const bau = (a: number, b: number): CircuitNode[] => [
    { id: 'f', kind: 'feed', position: 1 },
    { id: 'a', kind: 'changeover', position: a },
    { id: 'b', kind: 'changeover', position: b },
    { id: 'l', kind: 'lamp' },
  ]
  const edges = [
    k('e0', 'f', 0, 'a', 0),
    k('k1', 'a', 1, 'b', 1),
    k('k2', 'a', 2, 'b', 2),
    k('e3', 'b', 0, 'l', 0),
  ]

  it.each([
    [1, 1, true],
    [1, 2, false],
    [2, 1, false],
    [2, 2, true],
  ])('A=%i, B=%i → brennt: %s', (a, b, erwartet) => {
    expect(solveCircuit(bau(a, b), edges).lamps.get('l')?.lit).toBe(erwartet)
  })

  it('jeder Schalter allein schaltet um', () => {
    // Das ist der ZWECK der Wechselschaltung, und er folgt aus der Tabelle:
    // ein Umlegen auf einer Seite dreht das Ergebnis immer um.
    for (const b of [1, 2]) {
      const mit1 = solveCircuit(bau(1, b), edges).lamps.get('l')!.lit
      const mit2 = solveCircuit(bau(2, b), edges).lamps.get('l')!.lit
      expect(mit1).not.toBe(mit2)
    }
  })
})

describe('Kreuzschaltung — drei Stellen, jede schaltet um', () => {
  // A (Wechsel) → Kreuzschalter X → B (Wechsel) → Leuchte.
  const bau = (a: number, x: number, b: number): CircuitNode[] => [
    { id: 'f', kind: 'feed', position: 1 },
    { id: 'a', kind: 'changeover', position: a },
    { id: 'x', kind: 'crossover', position: x },
    { id: 'b', kind: 'changeover', position: b },
    { id: 'l', kind: 'lamp' },
  ]
  const edges = [
    k('e0', 'f', 0, 'a', 0),
    k('k1', 'a', 1, 'x', 1),
    k('k2', 'a', 2, 'x', 2),
    k('k3', 'x', 3, 'b', 1),
    k('k4', 'x', 4, 'b', 2),
    k('e5', 'b', 0, 'l', 0),
  ]

  it('jede der drei Stellen dreht das Ergebnis um', () => {
    for (const a of [1, 2]) {
      for (const x of [1, 2]) {
        for (const b of [1, 2]) {
          const jetzt = solveCircuit(bau(a, x, b), edges).lamps.get('l')!.lit
          const andersA = solveCircuit(bau(a === 1 ? 2 : 1, x, b), edges).lamps.get('l')!.lit
          const andersX = solveCircuit(bau(a, x === 1 ? 2 : 1, b), edges).lamps.get('l')!.lit
          const andersB = solveCircuit(bau(a, x, b === 1 ? 2 : 1), edges).lamps.get('l')!.lit
          expect(andersA, `A bei ${a}${x}${b}`).not.toBe(jetzt)
          expect(andersX, `X bei ${a}${x}${b}`).not.toBe(jetzt)
          expect(andersB, `B bei ${a}${x}${b}`).not.toBe(jetzt)
        }
      }
    }
  })
})

describe('Dimmer', () => {
  const bau = (pegel: number | undefined): CircuitNode[] => [
    { id: 'f', kind: 'feed', position: 1 },
    { id: 'd', kind: 'dimmer', levelPct: pegel },
    { id: 'l', kind: 'lamp' },
  ]
  const edges = [k('e1', 'f', 0, 'd', 1), k('e2', 'd', 2, 'l', 0)]

  it('setzt die Helligkeit herab', () => {
    expect(solveCircuit(bau(40), edges).lamps.get('l')).toEqual({ lit: true, levelPct: 40 })
  })

  it('ohne Angabe dunkelt er nicht', () => {
    expect(solveCircuit(bau(undefined), edges).lamps.get('l')?.levelPct).toBe(100)
  })

  it('auf null ist NICHT dasselbe wie ein offener Schalter', () => {
    // Die Anzeige darf beides nicht verwechseln: bei „aus" liegt keine
    // Spannung an, bei „null" schon — nur eben keine Helligkeit.
    const r = solveCircuit(bau(0), edges)
    expect(r.lamps.get('l')).toEqual({ lit: true, levelPct: 0 })
    expect([...r.energisedEdges].sort()).toEqual(['e1', 'e2'])
  })

  it('rechnet zwei Dimmer hintereinander multiplikativ', () => {
    const nodes: CircuitNode[] = [
      { id: 'f', kind: 'feed', position: 1 },
      { id: 'd1', kind: 'dimmer', levelPct: 50 },
      { id: 'd2', kind: 'dimmer', levelPct: 50 },
      { id: 'l', kind: 'lamp' },
    ]
    const e = [k('a', 'f', 0, 'd1', 1), k('b', 'd1', 2, 'd2', 1), k('c', 'd2', 2, 'l', 0)]
    expect(solveCircuit(nodes, e).lamps.get('l')?.levelPct).toBe(25)
  })

  it('bei zwei Wegen gewinnt der hellere', () => {
    // Zwei parallele Dimmer auf einer Leuchte ergeben nicht das Minimum.
    const nodes: CircuitNode[] = [
      { id: 'f', kind: 'feed', position: 1 },
      { id: 'j', kind: 'junction' },
      { id: 'd1', kind: 'dimmer', levelPct: 20 },
      { id: 'd2', kind: 'dimmer', levelPct: 80 },
      { id: 'z', kind: 'junction' },
      { id: 'l', kind: 'lamp' },
    ]
    const e = [
      k('a', 'f', 0, 'j', 0),
      k('b', 'j', 1, 'd1', 1),
      k('c', 'j', 2, 'd2', 1),
      k('d', 'd1', 2, 'z', 1),
      k('e', 'd2', 2, 'z', 2),
      k('f2', 'z', 0, 'l', 0),
    ]
    expect(solveCircuit(nodes, e).lamps.get('l')?.levelPct).toBe(80)
  })
})

describe('Was der Rechner nicht tut', () => {
  it('läuft in einer Ringleitung nicht endlos', () => {
    // Eine Schleife im Hausnetz ist nichts Besonderes.
    const nodes: CircuitNode[] = [
      { id: 'f', kind: 'feed', position: 1 },
      { id: 'j1', kind: 'junction' },
      { id: 'j2', kind: 'junction' },
      { id: 'l', kind: 'lamp' },
    ]
    const e = [
      k('a', 'f', 0, 'j1', 0),
      k('b', 'j1', 1, 'j2', 1),
      k('c', 'j2', 2, 'j1', 2),
      k('d', 'j2', 0, 'l', 0),
    ]
    expect(solveCircuit(nodes, e).lamps.get('l')?.lit).toBe(true)
  })

  it('nennt eine Leuchte ohne jede Verbindung als aus, nicht als unbekannt', () => {
    // Hier ist „aus" die richtige Antwort und keine Behauptung: der PLAN sagt,
    // dass nichts hinführt. Anders als bei einer Live-Beobachtung fehlt hier
    // keine Messung, sondern eine Leitung.
    const r = solveCircuit([{ id: 'l', kind: 'lamp' }], [])
    expect(r.lamps.get('l')).toEqual({ lit: false, levelPct: 0 })
  })
})
