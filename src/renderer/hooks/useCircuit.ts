import { useMemo } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../store/projectStoreContext'
import { useCircuitStore } from '../store/circuitStore'
import { useUiStore } from '../store/uiStore'
import { circuitFromProject, type CircuitSim } from '../lib/circuitFromProject'
import { solveCircuit } from '../lib/circuitSolver'
import type { CablePlannerProject } from '../types/project'

/**
 * Das Schaltbild-Ergebnis für den Canvas.
 *
 * WARUM EIN MODUL-CACHE UND KEIN CONTEXT. Jeder Knoten und jede Kante will
 * wissen, was für SIE herauskommt — bei dreihundert Geräten wären das
 * dreihundert Aufrufe von `solveCircuit` pro Zeichenlauf. Ein Context wäre
 * der saubere Weg, verlangt aber einen Provider um den ganzen Canvas herum;
 * der Cache hier tut dasselbe mit einer Zeile, weil `project` und `sim` aus
 * zustand kommen und zwischen zwei Änderungen REFERENZGLEICH bleiben. Ändert
 * sich eine der beiden, rechnet er einmal neu — für alle.
 *
 * Ein Eintrag reicht: es gibt genau einen Canvas und genau ein Projekt.
 */
interface CircuitErgebnis {
  /** Geräte-Id → Helligkeit 0..100. Fehlt der Eintrag, ist es keine Leuchte. */
  lampen: Map<string, number>
  /** Kabel-Ids, auf denen Spannung liegt. */
  unterSpannung: Set<string>
  /** Geräte an einem Strom-Kabel ohne angegebene Bauart. */
  ohneBauart: string[]
  /** Wie viele Knoten das Schaltbild überhaupt hat. */
  knoten: number
}

const LEER: CircuitErgebnis = {
  lampen: new Map(),
  unterSpannung: new Set(),
  ohneBauart: [],
  knoten: 0,
}

let cache: { project: CablePlannerProject; sim: CircuitSim; ergebnis: CircuitErgebnis } | null = null

const loese = (project: CablePlannerProject, sim: CircuitSim): CircuitErgebnis => {
  if (cache && cache.project === project && cache.sim === sim) return cache.ergebnis
  const plan = circuitFromProject(project, sim)
  const { lamps, energisedEdges } = solveCircuit(plan.nodes, plan.edges)
  const lampen = new Map<string, number>()
  for (const [id, state] of lamps) lampen.set(id, state.lit ? state.levelPct : -1)
  const ergebnis: CircuitErgebnis = {
    lampen,
    unterSpannung: energisedEdges,
    ohneBauart: plan.ohneBauart,
    knoten: plan.nodes.length,
  }
  cache = { project, sim, ergebnis }
  return ergebnis
}

/** Nur für Tests: den Cache leeren. */
export const cacheLeeren = (): void => {
  cache = null
}

const useErgebnis = (): CircuitErgebnis => {
  const an = useUiStore((s) => s.circuitOverlay)
  const project = useProjectStore((s) => s.project)
  const sim = useCircuitStore((s) => s.sim)
  // Ist die Anzeige aus, wird gar nicht gerechnet. Ein Schaltbild, das
  // niemand sieht, kostet sonst bei jedem Zeichenlauf einen Durchlauf durch
  // alle Strom-Kabel.
  return an ? loese(project, sim) : LEER
}

/**
 * Helligkeit dieser Leuchte, oder `null`.
 *
 * `null` heisst „keine Aussage" und nicht „aus": das Gerät ist keine Leuchte
 * oder trägt keine Bauart. `-1` heisst „brennt nicht". Der Unterschied ist
 * der ganze Punkt — ein dunkles Symbol an einem Gerät, über das niemand
 * etwas gesagt hat, wäre eine Behauptung.
 *
 * Rückgabe ist eine ZAHL und kein Objekt, damit React einen Knoten
 * überspringen kann, dessen Helligkeit sich nicht geändert hat (dieselbe
 * Überlegung wie bei `useTally`).
 */
export const useLampLevel = (equipmentId: string | undefined): number | null => {
  const { lampen } = useErgebnis()
  if (!equipmentId) return null
  return lampen.get(equipmentId) ?? null
}

/** Liegt auf diesem Kabel Spannung? */
export const useEdgeEnergised = (cableId: string | undefined): boolean => {
  const { unterSpannung } = useErgebnis()
  return cableId ? unterSpannung.has(cableId) : false
}

export interface CircuitOverview {
  /** Ist die Anzeige eingeschaltet? */
  an: boolean
  /** Wie viele Leuchten brennen, von wie vielen. */
  brennen: number
  leuchten: number
  /** Geräte an einem Strom-Kabel ohne angegebene Bauart. */
  ohneBauart: number
  /** Hat der Plan überhaupt ein Schaltbild? */
  knoten: number
}

/** Die Zahlen für den Streifen in der Werkzeugleiste. */
export const useCircuitOverview = (): CircuitOverview => {
  const an = useUiStore((s) => s.circuitOverlay)
  const { lampen, ohneBauart, knoten } = useErgebnis()
  return useMemo(() => {
    let brennen = 0
    for (const pegel of lampen.values()) if (pegel >= 0) brennen++
    return { an, brennen, leuchten: lampen.size, ohneBauart: ohneBauart.length, knoten }
  }, [an, lampen, ohneBauart, knoten])
}
