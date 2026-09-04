import type { CablePlannerProject } from '../types/project'

/**
 * Plausibilitaet statt Vertrauen: eine fremde Datei ist erst mal nur JSON.
 *
 * WARUM DAS AN DER TUER STEHEN MUSS. `healProjectPositions` — die
 * Schema-Migrationsschicht, durch die jedes geladene Projekt laeuft — greift
 * ungeschuetzt auf `project.equipment` und `project.cables` zu. Eine Datei, die
 * gueltiges JSON ist, aber kein Projekt (die falsche Datei erwischt, der Export
 * eines anderen Programms, ein von Hand zusammengebautes Fragment), laesst den
 * Renderer mit `TypeError: Cannot read properties of undefined` in die
 * ErrorBoundary laufen.
 *
 * Der Autosave-Pfad kennt genau diesen Fall und prueft ihn seit laengerem —
 * `loadAutosavedProject` in `projectStore.ts` sagt im eigenen Kommentar, dass
 * ein kaputter Stand "den Renderer downstream mit `cannot read .map of
 * undefined` crasht". Die Datei-Tuer hatte dieselbe Pruefung nicht. Eine von
 * zwei Tueren verriegelt zu haben ist kein Schutz.
 *
 * WARUM ABLEHNEN UND NICHT REPARIEREN. Naheliegend waere, fehlende Listen mit
 * `[]` aufzufuellen. Das waere die schlechtere Antwort: der Nutzer saehe einen
 * leeren Plan unter dem Namen seiner Datei und muesste glauben, seine Arbeit
 * sei weg. Eine Ablehnung mit Begruendung ist unangenehm, eine stille "Reparatur"
 * zu einem leeren Projekt ist ein erfundener Zustand.
 *
 * Die Bedingung ist bewusst schwach: `equipment` und `cables` als Listen,
 * `metadata` als Objekt. Sie soll den Fehlgriff abfangen, nicht das Schema
 * validieren — dafuer ist `healProjectPositions` da, und die darf ein altes
 * Projekt nie wegen eines fehlenden Feldes ablehnen.
 */
export const looksLikeProject = (data: unknown): data is CablePlannerProject => {
  if (typeof data !== 'object' || data === null) return false
  const p = data as Record<string, unknown>
  return Array.isArray(p.equipment) && Array.isArray(p.cables) && typeof p.metadata === 'object'
}
