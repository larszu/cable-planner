import { describe, expect, it } from 'vitest'
import equipmentNodeSrc from '../src/renderer/components/Canvas/EquipmentNode.tsx?raw'
import cableEdgeSrc from '../src/renderer/components/Canvas/CableEdge.tsx?raw'
import toolbarSrc from '../src/renderer/components/Canvas/CanvasToolbar.tsx?raw'
import circuitStoreSrc from '../src/renderer/store/circuitStore.ts?raw'
import uiStoreSrc from '../src/renderer/store/uiStore.ts?raw'
import {
  LEERE_SIM,
  circuitFromProject,
  istStromKabel,
  type CircuitSim,
} from '../src/renderer/lib/circuitFromProject'
import { solveCircuit } from '../src/renderer/lib/circuitSolver'
import { useCircuitStore, STELLUNGEN } from '../src/renderer/store/circuitStore'
import { CIRCUIT_KIND_INFO } from '../src/renderer/types/circuit'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { CircuitKind } from '../src/renderer/lib/circuitSolver'

// ───────────────────────────────────────────────────────────────────────────
// Vom Plan zum Schaltbild — die Bruecke, an der ein richtiger Rechner
// trotzdem eine falsche Auskunft geben kann.
//
// Der Rechner selbst ist in `circuitSolver.test.ts` geprueft, samt der
// ausgeschriebenen Wahrheitstabelle der Wechselschaltung. Hier geht es um
// die andere Haelfte: WELCHE Knoten und Kanten bekommt er.
//
// Die gefaehrlichste Antwort ist dabei nicht „falsch", sondern „zu wenig":
// ein Geraet, das kein Knoten wird, ist fuer den Rechner nicht vorhanden,
// und seine Leuchte „brennt nicht". Das sieht aus wie eine Aussage ueber
// die Anlage und ist in Wahrheit eine ueber die fehlende Angabe.
// ───────────────────────────────────────────────────────────────────────────

const port = (id: string, terminal?: number): Port =>
  ({ id, name: id, type: 'power', connectorType: 'schuko', circuitTerminal: terminal }) as unknown as Port

const eq = (id: string, kind?: CircuitKind, ports: Port[] = []): EquipmentItem =>
  ({
    id,
    name: id,
    category: 'Strom',
    x: 0,
    y: 0,
    inputs: ports,
    outputs: [],
  }) as unknown as EquipmentItem & { circuitKind?: CircuitKind } as EquipmentItem

const geraet = (id: string, kind: CircuitKind | undefined, ports: Port[] = []): EquipmentItem => {
  const basis = eq(id, kind, ports) as EquipmentItem & { circuitKind?: CircuitKind }
  if (kind) basis.circuitKind = kind
  return basis
}

const kabel = (
  id: string,
  from: [string, string],
  to: [string, string],
  layer: string | undefined = 'power',
): Cable =>
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

/** Die klassische Wechselschaltung als Plan. */
const wechselschaltung = () =>
  projekt(
    [
      geraet('feed', 'feed', [port('f0', 0)]),
      geraet('s1', 'changeover', [port('a0', 0), port('a1', 1), port('a2', 2)]),
      geraet('s2', 'changeover', [port('b0', 0), port('b1', 1), port('b2', 2)]),
      geraet('lampe', 'lamp', [port('l0', 0)]),
    ],
    [
      kabel('k1', ['feed', 'f0'], ['s1', 'a0']),
      kabel('k2', ['s1', 'a1'], ['s2', 'b1']),
      kabel('k3', ['s1', 'a2'], ['s2', 'b2']),
      kabel('k4', ['s2', 'b0'], ['lampe', 'l0']),
    ],
  )

describe('Die Bauart wird angegeben, nie geraten', () => {
  it('ein Geraet ohne circuitKind wird kein Knoten', () => {
    const p = projekt([geraet('x', undefined)], [])
    expect(circuitFromProject(p).nodes).toEqual([])
  })

  it('aber es wird GENANNT, wenn es an einem Strom-Kabel haengt', () => {
    // Das ist der ganze Punkt. Ohne diese Liste faellt ein verkabeltes
    // Geraet stumm weg, und die Leuchte dahinter „brennt nicht" — was nach
    // einer Antwort aussieht und keine ist.
    const p = projekt(
      [geraet('feed', 'feed', [port('f0', 0)]), geraet('x', undefined, [port('x0', 0)])],
      [kabel('k', ['feed', 'f0'], ['x', 'x0'])],
    )
    expect(circuitFromProject(p).ohneBauart).toEqual(['x'])
  })

  it('ein Geraet ohne Strom-Kabel wird nicht genannt', () => {
    // „Ungenutzt" ist kein Befund. Genannt wird, wer verkabelt ist — dort
    // hat jemand etwas gemeint.
    const p = projekt(
      [geraet('kamera', undefined, [port('c0')]), geraet('feed', 'feed', [port('f0', 0)])],
      [kabel('k', ['feed', 'f0'], ['kamera', 'c0'], 'video')],
    )
    expect(circuitFromProject(p).ohneBauart).toEqual([])
  })

  it('eine Kante ins Nichts faellt weg statt den Rechner in die Irre zu fuehren', () => {
    const p = projekt(
      [geraet('feed', 'feed', [port('f0', 0)]), geraet('x', undefined, [port('x0', 0)])],
      [kabel('k', ['feed', 'f0'], ['x', 'x0'])],
    )
    expect(circuitFromProject(p).edges).toEqual([])
  })
})

describe('Nur Strom-Kabel', () => {
  it('erkennt den Layer und seine Unter-Layer', () => {
    expect(istStromKabel('power')).toBe(true)
    expect(istStromKabel('power.notlicht')).toBe(true)
    expect(istStromKabel('video')).toBe(false)
    expect(istStromKabel(undefined)).toBe(false)
    // „powerful" faengt zwar mit „power" an, ist aber kein Unter-Layer.
    expect(istStromKabel('powerful')).toBe(false)
  })

  it('ein Video-Kabel zwischen zwei Schaltbild-Knoten wird keine Kante', () => {
    const p = projekt(
      [geraet('feed', 'feed', [port('f0', 0)]), geraet('lampe', 'lamp', [port('l0', 0)])],
      [kabel('k', ['feed', 'f0'], ['lampe', 'l0'], 'video')],
    )
    expect(circuitFromProject(p).edges).toEqual([])
    expect(solveCircuit(circuitFromProject(p).nodes, circuitFromProject(p).edges).lamps.get('lampe'))
      .toEqual({ lit: false, levelPct: 0 })
  })
})

describe('Die Klemme haengt am Port', () => {
  it('ohne Angabe gilt Klemme 0', () => {
    const p = projekt(
      [geraet('feed', 'feed', [port('f0')]), geraet('lampe', 'lamp', [port('l0')])],
      [kabel('k', ['feed', 'f0'], ['lampe', 'l0'])],
    )
    const [e] = circuitFromProject(p).edges
    expect(e.fromTerminal).toBe(0)
    expect(e.toTerminal).toBe(0)
  })

  it('vertauschte Korrespondierende drehen das Ergebnis um', () => {
    // Genau deshalb steht die Klemme am Port und nicht in der
    // Port-Reihenfolge: wer 1 und 2 vertauscht, hat eine ANDERE Anlage.
    const p = wechselschaltung()
    const gedreht = wechselschaltung()
    const s2 = gedreht.equipment.find((e) => e.id === 's2')!
    s2.inputs[1].circuitTerminal = 2
    s2.inputs[2].circuitTerminal = 1

    const beide = (proj: CablePlannerProject, sim: CircuitSim) => {
      const c = circuitFromProject(proj, sim)
      return solveCircuit(c.nodes, c.edges).lamps.get('lampe')!.lit
    }
    const stellung = (a: number, b: number): CircuitSim => ({
      positions: { s1: a, s2: b },
      levels: {},
    })

    expect(beide(p, stellung(1, 1))).toBe(true)
    expect(beide(gedreht, stellung(1, 1))).toBe(false)
    expect(beide(p, stellung(1, 2))).toBe(false)
    expect(beide(gedreht, stellung(1, 2))).toBe(true)
  })
})

describe('Die Wechselschaltung, aus dem Plan gerechnet', () => {
  const lit = (a: number, b: number): boolean => {
    const c = circuitFromProject(wechselschaltung(), { positions: { s1: a, s2: b }, levels: {} })
    return solveCircuit(c.nodes, c.edges).lamps.get('lampe')!.lit
  }

  // Ausgeschrieben, nicht gerechnet — eine Zusicherung, die sich derselben
  // Formel bedient wie der Code, prueft nichts.
  it('beide oben: brennt', () => expect(lit(1, 1)).toBe(true))
  it('beide unten: brennt', () => expect(lit(2, 2)).toBe(true))
  it('einer oben, einer unten: aus', () => expect(lit(1, 2)).toBe(false))
  it('einer unten, einer oben: aus', () => expect(lit(2, 1)).toBe(false))
})

describe('Die Vorgaben', () => {
  it('die Einspeisung steht auf EIN, die Schalter auf AUS', () => {
    // Ein Schaltbild, das beim Oeffnen alles brennen laesst, zeigt nichts.
    const p = projekt(
      [
        geraet('feed', 'feed', [port('f0', 0)]),
        geraet('s', 'switch', [port('s1', 1), port('s2', 2)]),
        geraet('lampe', 'lamp', [port('l0', 0)]),
      ],
      [
        kabel('k1', ['feed', 'f0'], ['s', 's1']),
        kabel('k2', ['s', 's2'], ['lampe', 'l0']),
      ],
    )
    const c = circuitFromProject(p, LEERE_SIM)
    expect(c.nodes.find((n) => n.id === 'feed')!.position).toBe(1)
    expect(c.nodes.find((n) => n.id === 's')!.position).toBe(0)
    expect(solveCircuit(c.nodes, c.edges).lamps.get('lampe')).toEqual({ lit: false, levelPct: 0 })
  })

  it('ein Wechselschalter hat keine Aus-Stellung', () => {
    // 0 waere bei ihm keine Stellung, die es an einer Wand gibt — er leitet
    // immer, nur woandershin.
    const c = circuitFromProject(wechselschaltung(), LEERE_SIM)
    expect(c.nodes.find((n) => n.id === 's1')!.position).toBe(1)
    expect(STELLUNGEN.changeover).not.toContain(0)
  })
})

describe('Der Dimmer', () => {
  const p = projekt(
    [
      geraet('feed', 'feed', [port('f0', 0)]),
      geraet('d', 'dimmer', [port('d1', 1), port('d2', 2)]),
      geraet('lampe', 'lamp', [port('l0', 0)]),
    ],
    [kabel('k1', ['feed', 'f0'], ['d', 'd1']), kabel('k2', ['d', 'd2'], ['lampe', 'l0'])],
  )

  it('ohne Angabe dunkelt er nicht', () => {
    const c = circuitFromProject(p, LEERE_SIM)
    expect(solveCircuit(c.nodes, c.edges).lamps.get('lampe')).toEqual({ lit: true, levelPct: 100 })
  })

  it('auf null gefahren ist nicht dasselbe wie aus', () => {
    // `lit: true, levelPct: 0` ist ausdruecklich erlaubt — ein Dimmer auf
    // null ist etwas anderes als ein offener Schalter, und die Anzeige darf
    // beides nicht verwechseln.
    const c = circuitFromProject(p, { positions: {}, levels: { d: 0 } })
    expect(solveCircuit(c.nodes, c.edges).lamps.get('lampe')).toEqual({ lit: true, levelPct: 0 })
  })
})

describe('Die Schalterstellung liegt NICHT im Projekt', () => {
  it('circuitFromProject fasst das Projekt nicht an', () => {
    const p = wechselschaltung()
    const kopie = JSON.parse(JSON.stringify(p)) as CablePlannerProject
    circuitFromProject(p, { positions: { s1: 2 }, levels: {} })
    expect(p).toEqual(kopie)
  })

  it('der Store schaltet zyklisch durch die Stellungen der Bauart', () => {
    useCircuitStore.getState().zuruecksetzen()
    const s = () => useCircuitStore.getState().sim.positions.s1
    useCircuitStore.getState().schalte('s1', 'changeover')
    expect(s()).toBe(2)
    useCircuitStore.getState().schalte('s1', 'changeover')
    expect(s()).toBe(1)
    // Und nie auf 0 — den Zustand gibt es an diesem Schalter nicht.
    useCircuitStore.getState().schalte('s1', 'changeover')
    expect(s()).toBe(2)
  })

  it('eine Leuchte laesst sich nicht schalten', () => {
    useCircuitStore.getState().zuruecksetzen()
    useCircuitStore.getState().schalte('lampe', 'lamp')
    expect(useCircuitStore.getState().sim.positions).toEqual({})
  })

  it('der Dimmer wird auf 0..100 begrenzt', () => {
    useCircuitStore.getState().zuruecksetzen()
    useCircuitStore.getState().dimme('d', 250)
    expect(useCircuitStore.getState().sim.levels.d).toBe(100)
    useCircuitStore.getState().dimme('d', -7)
    expect(useCircuitStore.getState().sim.levels.d).toBe(0)
  })

  it('zuruecksetzen leert beide Haelften', () => {
    useCircuitStore.getState().dimme('d', 40)
    useCircuitStore.getState().schalte('s', 'switch')
    useCircuitStore.getState().zuruecksetzen()
    expect(useCircuitStore.getState().sim).toEqual(LEERE_SIM)
  })
})

describe('Die Tabellen sind vollstaendig', () => {
  it('jede Bauart des Rechners hat eine Beschriftung und Stellungen', () => {
    // Beide Tabellen sind `Record<CircuitKind, …>`; dieser Test haelt fest,
    // dass sie DIESELBEN Schluessel fuehren — sonst gaebe es eine Bauart,
    // die der Plan anbietet und der Schalter nicht bedient.
    expect(Object.keys(CIRCUIT_KIND_INFO).sort()).toEqual(Object.keys(STELLUNGEN).sort())
  })

  it('genau die schaltbaren Bauarten haben Stellungen', () => {
    for (const [kind, info] of Object.entries(CIRCUIT_KIND_INFO)) {
      expect(STELLUNGEN[kind as CircuitKind].length > 0).toBe(info.schaltbar)
    }
  })
})


/** Kommentarzeilen weg: ein Waechter, der Prosa liest, ist von einem Satz zu haben. */
const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

describe('Der Weg ist verdrahtet', () => {
  const node = ohneKommentare(equipmentNodeSrc)
  const edge = ohneKommentare(cableEdgeSrc)

  it('der Knoten liest die Helligkeit und faerbt sich danach', () => {
    expect(node).toMatch(/useLampLevel\(id\)/)
    expect(node).toMatch(/lampLevel !== null && lampLevel >= 0/)
  })

  it('die Kante zeigt Spannung', () => {
    expect(edge).toMatch(/useEdgeEnergised\(cable\?\.id\)/)
    expect(edge).toMatch(/\{unterSpannung && \(/)
  })

  it('der Streifen haengt in der Werkzeugleiste', () => {
    // Ohne ihn saehe eine gerechnete Leuchte aus wie eine gemessene —
    // dieselbe Auflage wie beim Signalfluss-Streifen.
    expect(ohneKommentare(toolbarSrc)).toMatch(/<CircuitChip \/>/)
  })

  it('UMLEGEN AENDERT DEN PLAN NICHT', () => {
    // Die Zusicherung, um die es geht. Der Knoten ruft `schalte` aus dem
    // `circuitStore` — nicht `updateEquipment`. Ginge es ueber den
    // `projectStore`, waere jedes Umlegen ein Undo-Schritt, ein
    // Autospeichern und eine Aenderung an der Projektdatei.
    expect(node).toMatch(/schalte\(id, data\.circuitKind\)/)
    const umschalter = node.slice(node.indexOf('circuitOverlay && data.circuitKind'))
    expect(umschalter).not.toMatch(/updateEquipment/)
  })

  it('der Schalt-Store wird nicht persistiert', () => {
    // Beim Neustart leer, und das ist die richtige Aussage: „wie die
    // Schalter beim letzten Ausprobieren standen" will niemand wiederhaben.
    const store = ohneKommentare(circuitStoreSrc)
    expect(store).not.toMatch(/localStorage/)
    expect(store).not.toMatch(/persist\(/)
  })

  it('die Anzeige ist als Vorgabe AUS', () => {
    // Ein leeres Schaltbild sieht aus wie „nichts brennt". Anschalten muss
    // jemand, der weiss, dass er Bauarten angegeben hat.
    expect(ohneKommentare(uiStoreSrc)).toMatch(/circuitOverlay: false,/)
  })
})
