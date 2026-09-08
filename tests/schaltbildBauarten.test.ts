import { describe, expect, it } from 'vitest'
import { CIRCUIT_KIND_INFO, CIRCUIT_KINDS } from '../src/renderer/types/circuit'
import { STELLUNGEN } from '../src/renderer/store/circuitStore'
import { solveCircuit, type CircuitEdge, type CircuitNode } from '../src/renderer/lib/circuitSolver'
import { circuitFromProject } from '../src/renderer/lib/circuitFromProject'
import circuitFromProjectSrc from '../src/renderer/lib/circuitFromProject.ts?raw'
import circuitStoreSrc from '../src/renderer/store/circuitStore.ts?raw'
import equipmentNodeSrc from '../src/renderer/components/Canvas/EquipmentNode.tsx?raw'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

/**
 * B-52 Teil 2 — Verteiler, Schuetz, Relais, Taster, Not-Aus, FI und LS im
 * Schaltbild.
 *
 * DER BEFUND, der den Zuschnitt bestimmt hat: elektrisch sind die sechs
 * Kontakte DASSELBE wie ein Aus-Schalter. Sechs eigene Rechnungen waeren
 * sechs Orte, die beim ersten Sonderfall auseinanderlaufen. Was sie
 * unterscheidet, ist die RUHESTELLUNG — und ohne die laese ein Not-Aus ohne
 * gesetzte Stellung als „offen", der Plan zeichnete eine Leuchte als dunkel,
 * die brennt. Das ist eine Falschaussage, nicht das Fehlen einer Aussage.
 */

/** Einspeisung → Kontakt → Leuchte. Der kuerzeste Stromkreis, den es gibt. */
const kreis = (
  kind: CircuitNode['kind'],
  position: number | undefined,
): { nodes: CircuitNode[]; edges: CircuitEdge[] } => ({
  nodes: [
    { id: 'q', kind: 'feed', position: 1 },
    { id: 'k', kind, ...(position === undefined ? {} : { position }) },
    { id: 'l', kind: 'lamp' },
  ],
  edges: [
    { id: 'e1', fromNode: 'q', fromTerminal: 0, toNode: 'k', toTerminal: 1 },
    { id: 'e2', fromNode: 'k', fromTerminal: 2, toNode: 'l', toTerminal: 0 },
  ],
})

const brennt = (kind: CircuitNode['kind'], position?: number): boolean => {
  const { nodes, edges } = kreis(kind, position)
  return solveCircuit(nodes, edges).lamps.get('l')?.lit === true
}

/**
 * Derselbe Kreis, aber ueber den WEG, den die Anwendung nimmt: aus dem Plan
 * gebaut und OHNE gesetzte Stellung.
 *
 * Warum das eine eigene Bruecke braucht und nicht schon von `brennt` mit
 * abgedeckt ist: `brennt` setzt die Stellung selbst. Die Ruhestellung steht
 * aber in `CIRCUIT_KIND_INFO[kind].ruhe`, und die greift genau dann, wenn
 * NIEMAND etwas gesetzt hat — beim Oeffnen eines Plans also immer. Wer dort
 * `ruhe: 1` am Not-Aus auf 0 aendert, faellt bei `brennt` durch kein Netz;
 * hier schon.
 */
const brenntAusPlan = (kind: CircuitNode['kind']): boolean => {
  const stelle = (id: string, klemme: number): Port =>
    ({ id, name: id, type: 'power', connectorType: 'schuko', circuitTerminal: klemme }) as unknown as Port
  const geraet = (id: string, k: CircuitNode['kind'], ports: Port[]): EquipmentItem =>
    ({
      id,
      name: id,
      category: 'Strom',
      x: 0,
      y: 0,
      inputs: ports,
      outputs: [],
      circuitKind: k,
    }) as unknown as EquipmentItem
  const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
    ({
      id,
      fromEquipmentId: from[0],
      fromPortId: from[1],
      toEquipmentId: to[0],
      toPortId: to[1],
      layer: 'power',
    }) as unknown as Cable
  const project = {
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    equipment: [
      geraet('q', 'feed', [stelle('q0', 0)]),
      geraet('k', kind, [stelle('k1', 1), stelle('k2', 2)]),
      geraet('l', 'lamp', [stelle('l0', 0)]),
    ],
    cables: [kabel('e1', ['q', 'q0'], ['k', 'k1']), kabel('e2', ['k', 'k2'], ['l', 'l0'])],
    canvasState: { x: 0, y: 0, zoom: 1 },
  } as unknown as CablePlannerProject
  // Kein zweites Argument: genau der Fall „niemand hat etwas gesetzt".
  const { nodes, edges } = circuitFromProject(project)
  return solveCircuit(nodes, edges).lamps.get('l')?.lit === true
}

describe('Die Ruhestellung ist der ganze Unterschied', () => {
  it('laesst Taster, Schuetz und Relais im Ruhezustand offen', () => {
    for (const k of ['button', 'contactor', 'relay'] as const) {
      expect(brennt(k, 0)).toBe(false)
      expect(brennt(k, 1)).toBe(true)
      // Die Schaltreihenfolge beginnt bei der Ruhestellung.
      expect(STELLUNGEN[k][0]).toBe(0)
    }
  })

  it('laesst Not-Aus, FI und LS im Ruhezustand GESCHLOSSEN', () => {
    for (const k of ['emergencyStop', 'rcd', 'mcb'] as const) {
      // Der Fall, um den es geht: geschlossen, bis jemand ihn oeffnet.
      expect(brennt(k, 1)).toBe(true)
      expect(brennt(k, 0)).toBe(false)
      expect(STELLUNGEN[k][0]).toBe(1)
    }
  })

  it('gilt auch, wenn niemand eine Stellung gesetzt hat', () => {
    // DER Fall aus der Praxis: ein frisch geoeffneter Plan. Ein Not-Aus, der
    // hier als offen gelesen wuerde, macht aus einer brennenden Leuchte eine
    // dunkle — eine Falschaussage, kein fehlender Wert.
    for (const k of ['emergencyStop', 'rcd', 'mcb'] as const) {
      expect(brenntAusPlan(k)).toBe(true)
    }
    for (const k of ['button', 'contactor', 'relay', 'switch'] as const) {
      expect(brenntAusPlan(k)).toBe(false)
    }
  })

  it('haelt den Aus-Schalter unveraendert', () => {
    // Bestandsschutz: jeder bestehende Plan muss dasselbe zeigen wie vorher.
    expect(brennt('switch', 1)).toBe(true)
    expect(brennt('switch', 0)).toBe(false)
    expect(STELLUNGEN.switch).toEqual([0, 1])
  })
})

describe('Sechs Bauarten, eine Rechnung', () => {
  it('verhaelt sich jeder Kontakt genau wie der Aus-Schalter', () => {
    // Wenn hier je ein Unterschied auftaucht, ist eine zweite Rechnung
    // entstanden — die Defektform, gegen die der Zuschnitt gewaehlt wurde.
    for (const k of ['button', 'contactor', 'relay', 'emergencyStop', 'rcd', 'mcb'] as const) {
      for (const p of [0, 1, 2]) {
        expect(brennt(k, p)).toBe(brennt('switch', p))
      }
    }
  })
})

describe('Der Verteiler ist eine Klemmstelle', () => {
  it('gibt weiter, was ankommt — auf alle Abgaenge', () => {
    const nodes: CircuitNode[] = [
      { id: 'q', kind: 'feed', position: 1 },
      { id: 'v', kind: 'distro' },
      { id: 'l1', kind: 'lamp' },
      { id: 'l2', kind: 'lamp' },
    ]
    const edges: CircuitEdge[] = [
      { id: 'e1', fromNode: 'q', fromTerminal: 0, toNode: 'v', toTerminal: 0 },
      { id: 'e2', fromNode: 'v', fromTerminal: 1, toNode: 'l1', toTerminal: 0 },
      { id: 'e3', fromNode: 'v', fromTerminal: 2, toNode: 'l2', toTerminal: 0 },
    ]
    const { lamps } = solveCircuit(nodes, edges)
    expect(lamps.get('l1')?.lit).toBe(true)
    expect(lamps.get('l2')?.lit).toBe(true)
  })

  it('loest nicht aus — der Plan kennt die Lasten nicht', () => {
    // Eine berechnete Ausloesung waere eine plausible Zahl ohne Beleg.
    expect(CIRCUIT_KIND_INFO.distro.schaltbar).toBe(false)
  })
})

describe('Jede Bauart ist ueberall erklaert', () => {
  it('traegt jede Bauart eine Beschriftung', () => {
    // Die `Record<CircuitKind, …>`-Tabellen sind der Grund, warum eine
    // vergessene Bauart ein Typfehler ist und kein stiller Ausfall — aber ein
    // leerer String erfuellt den Typ auch, und auf dem Blatt stuende dann
    // nichts, wo eine Bauart stehen muesste.
    //
    // WAS HIER BEWUSST NICHT STEHT: „schaltbar genau dann, wenn es Stellungen
    // gibt". Diese Regel hat schon einen Ort
    // (`circuitFromProject.test.ts` > „genau die schaltbaren Bauarten haben
    // Stellungen"). Sie hier ein zweites Mal zu pruefen hiesse, sie an zwei
    // Stellen zu fuehren — und beim ersten Sonderfall widerspraechen sich die
    // beiden Waechter, statt gemeinsam rot zu werden.
    for (const k of CIRCUIT_KINDS) {
      expect(CIRCUIT_KIND_INFO[k].label.length).toBeGreaterThan(0)
    }
  })

  it('gibt den sechs Kontakten eigene Namen statt „Aus-Schalter"', () => {
    // Der einzige Grund, warum sie ueberhaupt eigene Bauarten sind.
    const namen = (['button', 'contactor', 'relay', 'emergencyStop', 'rcd', 'mcb'] as const).map(
      (k) => CIRCUIT_KIND_INFO[k].label,
    )
    expect(new Set(namen).size).toBe(namen.length)
    expect(namen).not.toContain(CIRCUIT_KIND_INFO.switch.label)
  })
})

describe('Die Ruhestellung wird an EINER Stelle entschieden', () => {
  // Der Befund, der diese Zusammenlegung ausgeloest hat (B-52 Teil 2): drei
  // Orte rechneten aus, welche Stellung ohne Zutun gilt — der Rechner, der
  // Store und die Marke am Knoten. Sie stimmten ueberein, weil ausser der
  // Einspeisung alles bei 0 anfing. Not-Aus, FI und LS beenden diesen Zufall.
  const leser = {
    'der Rechner': circuitFromProjectSrc,
    'der Store': circuitStoreSrc,
    'die Marke am Knoten': equipmentNodeSrc,
  }

  for (const [wer, src] of Object.entries(leser)) {
    it(`liest ${wer} die Ruhestellung aus der Bauart-Tabelle`, () => {
      expect(src).toMatch(/\.ruhe\b/)
      // Die alte Fassung stand dreimal als `kind === 'feed' ? 1` da. Wer sie
      // wieder einfuehrt, hat die zweite Rechnung wieder da — und zwar in
      // der Richtung, die sie beim letzten Mal falsch machte.
      expect(src).not.toMatch(/=== 'feed' \? 1/)
    })
  }

  it('faengt die Schaltreihenfolge bei der Ruhestellung an', () => {
    // Sonst schaltet das erste Antippen dorthin, wo das Geraet ohnehin schon
    // steht — sichtbar wuerde das erst beim zweiten Klick.
    for (const k of CIRCUIT_KINDS) {
      if (!CIRCUIT_KIND_INFO[k].schaltbar) continue
      expect(STELLUNGEN[k][0]).toBe(CIRCUIT_KIND_INFO[k].ruhe)
    }
  })
})

describe('Die Marke am Knoten ist angegeben, nicht geschnitten', () => {
  it('traegt jede Bauart eine eigene Marke', () => {
    // Aus dem Namen geschnitten kollidierten „Stromverteiler"/„Schuetz" und
    // „Leuchte"/„Leitungsschutzschalter" — zwei Geraete mit derselben Marke,
    // und dem Knoten sieht das niemand an.
    const marken = CIRCUIT_KINDS.map((k) => CIRCUIT_KIND_INFO[k].marke)
    expect(new Set(marken).size).toBe(marken.length)
    for (const m of marken) expect(m.length).toBeGreaterThan(0)
  })

  it('zeigt der Knoten die angegebene Marke statt des ersten Buchstabens', () => {
    expect(equipmentNodeSrc).toMatch(/\{info\.marke\}/)
    expect(equipmentNodeSrc).not.toMatch(/info\.label\.slice\(0, 1\)/)
  })

  it('haengt die Stellung nur an eine schaltbare Bauart', () => {
    // „L0" an einer Leuchte waere eine Angabe ueber etwas, das keine
    // Stellung hat — und der Verteiler bekaeme mit „V0" eine Bedienbarkeit
    // angedeutet, die er nicht hat.
    expect(equipmentNodeSrc).toMatch(/const gezeigt = schaltbar \? \(stellung \?\? info\.ruhe\) : undefined/)
  })
})
