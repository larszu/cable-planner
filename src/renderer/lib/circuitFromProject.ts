/**
 * Vom Plan zum Schaltbild — die Brücke zwischen `projectStore` und
 * `circuitSolver` (Eigentümer-Wunsch vom 2026-09-08).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ZWEI QUELLEN, UND SIE GEHÖREN NICHT ZUSAMMEN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Die VERDRAHTUNG ist Plan: welches Gerät ist ein Wechselschalter, welche
 * Leitung geht von seiner Klemme 2 zur Klemme 2 des anderen. Sie gehört ins
 * Projekt, wird gespeichert, geht durch Undo/Redo und steht auf dem Blatt.
 *
 * Die SCHALTERSTELLUNG ist es nicht. Wer am Schaltbild einen Schalter
 * umlegt, fragt „was passiert dann" — er ändert nicht den Plan. Läge die
 * Stellung im `projectStore`, wäre jedes Umlegen ein Undo-Schritt, ein
 * Autospeichern und eine Änderung an der Projektdatei; zwei Minuten
 * Ausprobieren fräsen die Undo-Historie leer, und die Datei trüge
 * hinterher eine Schalterstellung, die niemand entschieden hat. Das ist
 * derselbe Fehler wie `cable#647` und dieselbe Trennung wie beim
 * `liveStore`: sie liegt in `circuitStore`, und der wird nicht persistiert.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS OHNE ANGABE PASSIERT — UND WARUM ES NICHT „AUS" HEISST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Ein Gerät ohne `circuitKind` ist kein Knoten. Es ist damit für den
 * Rechner nicht vorhanden, und die Anzeige zeichnet ihm nichts — kein
 * Leuchten, aber auch kein dunkles Symbol. „Aus" wäre eine Aussage über
 * die Anlage; hier fehlt aber keine Spannung, sondern eine Angabe.
 * `unbekannteGeraete` gibt genau diese Liste zurück, damit der Streifen im
 * Canvas sie nennen kann, statt sie verschwinden zu lassen.
 *
 * DIESELBE REGEL WIE BEIM SIGNALFLUSS (ADR-003, Invariante 14): ohne Beleg
 * keine Behauptung. Beim Signalfluss ist der Beleg eine frische Meldung,
 * hier ist er eine Angabe im Plan.
 */
import type { CablePlannerProject } from '../types/project'
import type { EquipmentItem } from '../types/equipment'
import type { CircuitEdge, CircuitNode } from './circuitSolver'
import { CIRCUIT_KIND_INFO } from '../types/circuit'

/** Die veränderliche Hälfte: Schalterstellungen und Dimmerwerte. */
export interface CircuitSim {
  /** Geräte-Id → Stellung. Fehlt sie, gilt die Vorgabe der Bauart. */
  positions: Record<string, number>
  /** Geräte-Id → 0..100. Fehlt er, dimmt der Dimmer nicht. */
  levels: Record<string, number>
}

export const LEERE_SIM: CircuitSim = { positions: {}, levels: {} }

/**
 * Die Vorgabe-Stellung steht in `CIRCUIT_KIND_INFO[kind].ruhe` — eine Zeile
 * je Bauart, gelesen vom Rechner (hier), vom `circuitStore` (wovon das
 * nächste Antippen ausgeht) und von der Marke am Canvas-Knoten (was der
 * Nutzer sieht). Warum die drei sie sich teilen müssen, steht dort:
 * bis B-52 Teil 2 hatte jeder seine eigene, und mit Not-Aus, FI und LS
 * liefen sie auseinander.
 */

export interface CircuitPlan {
  nodes: CircuitNode[]
  edges: CircuitEdge[]
  /**
   * Geräte, die an einem Strom-Kabel hängen, aber keine Bauart tragen.
   *
   * Nicht „ungenutzt": sie sind verkabelt, also hat jemand sie gemeint.
   * Ohne Bauart kann der Rechner nichts über sie sagen, und diese Liste ist
   * der Weg, das zu SAGEN statt sie stumm wegzulassen.
   */
  ohneBauart: string[]
}

/** Klemme eines Kabel-Endes. Ohne Angabe am Port gilt 0. */
const klemme = (eq: EquipmentItem | undefined, portId: string): number => {
  if (!eq) return 0
  const p = eq.inputs.find((x) => x.id === portId) ?? eq.outputs.find((x) => x.id === portId)
  const t = p?.circuitTerminal
  return typeof t === 'number' && Number.isFinite(t) ? t : 0
}

/**
 * Welche Kabel zum Schaltbild gehören.
 *
 * Der Layer entscheidet, und zwar der EXPLIZITE. `layer === 'power'` ist
 * eine Angabe des Planers; ihn aus dem Steckertyp zu erraten, wäre wieder
 * ein Namensabgleich — und ein falsch dazugerechnetes Kabel verbindet zwei
 * Stromkreise, die es nicht gibt. Sub-Layer zählen mit (`power.notlicht`),
 * weil sie derselbe Layer sind.
 */
export const istStromKabel = (layer: string | undefined): boolean =>
  layer === 'power' || (typeof layer === 'string' && layer.startsWith('power.'))

/**
 * Den Stromkreis aus dem Plan bauen.
 *
 * Reihenfolge mit Grund: erst die Knoten (nur Geräte MIT Bauart), dann die
 * Kanten — und eine Kante, deren Ende kein Knoten ist, fällt weg. Sie
 * stehenzulassen hiesse, dem Rechner eine Leitung ins Nichts zu geben, und
 * sein „brennt nicht" wäre dann keine Aussage über die Schaltung, sondern
 * über die fehlende Angabe.
 */
export const circuitFromProject = (
  project: CablePlannerProject,
  sim: CircuitSim = LEERE_SIM,
): CircuitPlan => {
  const nachId = new Map(project.equipment.map((e) => [e.id, e]))

  const nodes: CircuitNode[] = []
  for (const eq of project.equipment) {
    if (!eq.circuitKind) continue
    const stellung = sim.positions[eq.id]
    const pegel = sim.levels[eq.id]
    nodes.push({
      id: eq.id,
      kind: eq.circuitKind,
      position:
        typeof stellung === 'number' && Number.isFinite(stellung)
          ? stellung
          : CIRCUIT_KIND_INFO[eq.circuitKind].ruhe,
      ...(eq.circuitKind === 'dimmer' && typeof pegel === 'number' && Number.isFinite(pegel)
        ? { levelPct: pegel }
        : {}),
    })
  }
  const knotenIds = new Set(nodes.map((n) => n.id))

  const edges: CircuitEdge[] = []
  const ohneBauart = new Set<string>()
  for (const c of project.cables) {
    if (!istStromKabel(c.layer)) continue
    const a = nachId.get(c.fromEquipmentId)
    const b = nachId.get(c.toEquipmentId)
    for (const eq of [a, b]) {
      if (eq && !eq.circuitKind) ohneBauart.add(eq.id)
    }
    if (!knotenIds.has(c.fromEquipmentId) || !knotenIds.has(c.toEquipmentId)) continue
    edges.push({
      id: c.id,
      fromNode: c.fromEquipmentId,
      fromTerminal: klemme(a, c.fromPortId),
      toNode: c.toEquipmentId,
      toTerminal: klemme(b, c.toPortId),
    })
  }

  return { nodes, edges, ohneBauart: [...ohneBauart] }
}
