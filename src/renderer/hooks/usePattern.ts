import { useMemo } from 'react'
import { useCanvasProjectStore as useProjectStore } from '../store/projectStoreContext'
import { usePatternStore } from '../store/patternStore'
import {
  LEERES_ROUTING,
  patternRouting,
  zielGeraete,
  type PatternRouting,
} from '../lib/patternRouting'
import {
  diagnoseSumme,
  patternDiagnose,
  type DiagnoseSumme,
  type PatternBefund,
} from '../lib/patternDiagnose'
import type { CablePlannerProject } from '../types/project'

/**
 * Die Prüfbild-Erwartung für den Canvas.
 *
 * Ein Modul-Cache wie bei `useCircuit`, aus demselben Grund: jeder Knoten
 * fragt „steht bei MIR etwas an", und `signalChains` über den ganzen Plan
 * einmal je Knoten wäre bei dreihundert Geräten dreihundert Traversierungen
 * pro Zeichenlauf. `project` und `quelleId` kommen aus zustand und bleiben
 * zwischen zwei Änderungen referenzgleich; ändert sich eine der beiden,
 * rechnet er einmal neu — für alle.
 */
interface PatternErgebnis {
  routing: PatternRouting
  ziele: Set<string>
  /** Der Name der Quelle, wie er auf dem Bild steht. */
  quellName: string
  quelleId: string | null
  /** Je Ankunftsort: was jemand gesehen hat und was das bedeutet. */
  befunde: Map<string, PatternBefund>
  alleBefunde: PatternBefund[]
}

const LEER: PatternErgebnis = {
  routing: LEERES_ROUTING,
  ziele: new Set(),
  quellName: '',
  quelleId: null,
  befunde: new Map(),
  alleBefunde: [],
}

let cache: {
  project: CablePlannerProject
  quelleId: string
  ergebnis: PatternErgebnis
} | null = null

const loese = (project: CablePlannerProject, quelleId: string): PatternErgebnis => {
  if (cache && cache.project === project && cache.quelleId === quelleId) return cache.ergebnis
  const routing = patternRouting(project, quelleId)
  const alleBefunde = patternDiagnose(project, quelleId)
  const ergebnis: PatternErgebnis = {
    routing,
    ziele: zielGeraete(routing),
    quellName: project.equipment.find((e) => e.id === quelleId)?.name ?? '',
    quelleId,
    befunde: new Map(alleBefunde.map((b) => [b.equipmentId, b])),
    alleBefunde,
  }
  cache = { project, quelleId, ergebnis }
  return ergebnis
}

/** Nur für Tests: den Cache leeren. */
export const cacheLeeren = (): void => {
  cache = null
}

const useErgebnis = (): PatternErgebnis => {
  const project = useProjectStore((s) => s.project)
  const quelleId = usePatternStore((s) => s.quelleId)
  return quelleId ? loese(project, quelleId) : LEER
}

/**
 * Der Name, den das Prüfbild an DIESEM Gerät tragen müsste — oder `null`.
 *
 * `null` heisst „hier ist nichts zu erwarten" und ist ausdrücklich KEINE
 * Aussage darüber, ob dort ein Bild ankommt. Die App hat keinen
 * Videoeingang; sie weiss nur, was der Plan vorsieht.
 *
 * Rückgabe ist eine Zeichenkette und kein Objekt, damit React einen Knoten
 * überspringen kann, an dem sich nichts geändert hat (dieselbe Überlegung
 * wie bei `useTally` und `useLampLevel`).
 */
export const useErwartetesBild = (equipmentId: string | undefined): string | null => {
  const { ziele, quellName, quelleId } = useErgebnis()
  if (!equipmentId || !quelleId) return null
  // Die Quelle selbst zeigt es auch — dort wird es schliesslich eingespeist,
  // und der Techniker will vor dem Rundgang sehen, dass er den richtigen
  // Namen erwischt hat.
  if (equipmentId === quelleId) return quellName
  return ziele.has(equipmentId) ? quellName : null
}

export interface PatternOverview {
  quelleId: string | null
  quellName: string
  /** Wie viele Orte der Plan als Ankunft vorsieht. */
  ziele: number
  /** Wie viele Wege der Plan nicht zu Ende kennt. */
  offen: number
}

/** Die Zahlen für den Streifen in der Werkzeugleiste. */
export const usePatternOverview = (): PatternOverview => {
  const { routing, quellName, quelleId } = useErgebnis()
  return useMemo(
    () => ({
      quelleId,
      quellName,
      ziele: routing.ziele.length,
      offen: routing.offen.length,
    }),
    [routing, quellName, quelleId],
  )
}

/** Das vollständige Routing — für den Prüfblatt-Export. */
export const usePatternRouting = (): PatternRouting => useErgebnis().routing


/**
 * Der Befund an DIESEM Ankunftsort — oder `null`.
 *
 * `null` heisst „hier ist nichts zu erwarten": entweder ist keine Quelle
 * gewaehlt, oder der Plan sieht hier keine Ankunft vor. Es heisst NICHT
 * „hier ist alles in Ordnung"; wo der Plan etwas vorsieht und niemand
 * hingesehen hat, kommt `ungeprueft` zurueck, und das ist eine Aussage.
 */
export const useBefund = (equipmentId: string | undefined): PatternBefund | null => {
  const { befunde } = useErgebnis()
  if (!equipmentId) return null
  return befunde.get(equipmentId) ?? null
}

/** Alle Befunde — fuer das Abnahme-Blatt. */
export const usePatternBefunde = (): PatternBefund[] => useErgebnis().alleBefunde

/** Die Zahlen der Abnahme fuer den Streifen. */
export const usePatternSumme = (): DiagnoseSumme => {
  const { alleBefunde } = useErgebnis()
  return useMemo(() => diagnoseSumme(alleBefunde), [alleBefunde])
}
