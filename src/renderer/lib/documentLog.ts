// ---------------------------------------------------------------------------
// Register der ausgegebenen Dokumente — die Renderer-Seite.
//
// Roadmap-Initiative 5, letztes Stueck. `changeImpact` konnte bisher nur zwei
// *gegebene* Plan-Staende vergleichen; die eigentlich gewuenschte Frage —
// „welches der Blaetter, die ich ausgeteilt habe, ist jetzt hin?" — brauchte
// ein Gedaechtnis dafuer, dass ein Dokument je ausgegeben wurde. Das gab es
// nicht: `documentStamp` baut den Stempel beim Export, und die App vergisst
// den Vorgang.
//
// Diese Datei haelt die beiden Haelften zusammen: das Aufzeichnen bei der
// Ausgabe, und das Zurueckrechnen — welcher Eintrag gilt noch.
// ---------------------------------------------------------------------------

import type { CablePlannerProject } from '../types/project'
import { cablePlannerApi } from './bridge'
import type { DocumentLogFile, DocumentLogRecord } from './bridge'
import { DOCUMENT_LABELS, currentStand } from './documentRegistry'

export type { DocumentLogFile, DocumentLogRecord }

/**
 * Einen Ausgabe-Vorgang aufzeichnen.
 *
 * `docId` ist der Bezeichner aus `documentRegistry` — derselbe, der im
 * Dateinamen als Suffix steht. Schlaegt das Schreiben fehl, wird das NICHT
 * dem Nutzer als Fehler praesentiert: er wollte ein Dokument, und das hat er
 * bekommen. Aber es wird auch nicht so getan, als sei aufgezeichnet worden —
 * der Eintrag fehlt dann schlicht, und die Ansicht sagt nur, was sie weiss.
 */
export const recordEmission = async (
  project: CablePlannerProject,
  docId: string,
  projectPath?: string,
): Promise<void> => {
  // Der Stand, der auf DIESEM Blatt steht. Fuer `kabel-bom` gibt es keinen,
  // weil sein Inhalt am Reserve-Aufschlag haengt — `currentStand` liefert
  // dafuer `undefined`, und daraus wird hier kein erfundener Wert.
  const stand = currentStand(docId, project)
  if (!stand) {
    // Ein Eintrag ohne Stand koennte spaeter nie beantworten, ob er noch
    // gilt. Ihn trotzdem zu schreiben hiesse, ein „weiss nicht" als
    // Protokoll-Zeile auszugeben, die wie eine Aussage aussieht.
    return
  }
  try {
    await cablePlannerApi.documentLog.append({
      docId,
      label: DOCUMENT_LABELS[docId] ?? docId,
      stand,
      emittedAt: new Date().toISOString(),
      project: project.metadata?.name ?? '',
      ...(projectPath ? { projectPath } : {}),
    })
  } catch {
    /* Das Register ist Beiwerk zur Ausgabe, nicht ihre Bedingung. */
  }
}

/** Gilt dieser Eintrag noch — und wenn nicht, ist das ueberhaupt entscheidbar? */
export type EntryStatus = 'current' | 'superseded' | 'unknown'

export interface ReviewedEntry extends DocumentLogRecord {
  status: EntryStatus
  /** Der Stand, den dasselbe Dokument heute haette. Fehlt bei `unknown`. */
  standNow?: string
}

/**
 * Das Register gegen den offenen Plan halten.
 *
 * Das ist die Vorwaerts-Frage, die Initiative 5 gestellt hat, endlich mit
 * beiden Haelften: das Register weiss, WAS ausgegeben wurde, und
 * `documentRegistry` rechnet aus, welchen Stand dasselbe Dokument HEUTE
 * haette.
 *
 * `unknown` ist ein eigenes Ergebnis und kein Freibrief — dieselbe Regel wie
 * in `changeImpact`. Ein Dokument, dessen Stand nicht reproduzierbar ist
 * (`kabel-bom`), oder ein Eintrag aus einem anderen Projekt kann nicht
 * beurteilt werden, und das steht dann auch so da.
 */
export const reviewLog = (
  log: DocumentLogFile,
  project: CablePlannerProject,
  projectPath?: string,
): ReviewedEntry[] => {
  const name = project.metadata?.name ?? ''
  return log.entries
    .filter((e) =>
      // Zum offenen Projekt gehoert, was denselben Pfad hat — und wenn keiner
      // bekannt ist, ersatzweise denselben Namen. Der Name allein ist eine
      // schwaechere Zuordnung; deshalb gewinnt der Pfad, wo es einen gibt.
      projectPath && e.projectPath ? e.projectPath === projectPath : e.project === name,
    )
    .map((e) => {
      const standNow = currentStand(e.docId, project)
      if (!standNow) return { ...e, status: 'unknown' as const }
      return {
        ...e,
        status: standNow === e.stand ? ('current' as const) : ('superseded' as const),
        standNow,
      }
    })
    .sort((a, b) => b.emittedAt.localeCompare(a.emittedAt))
}

/** Kurzfassung fuer die Menue-Zeile. Der Aufrufer uebersetzt. */
export const reviewSummary = (entries: ReviewedEntry[]): string => {
  const stale = entries.filter((e) => e.status === 'superseded').length
  const unknown = entries.filter((e) => e.status === 'unknown').length
  const parts: string[] = []
  if (stale > 0) parts.push(`${stale} überholt`)
  if (unknown > 0) parts.push(`${unknown} nicht beurteilbar`)
  if (parts.length === 0) return entries.length === 0 ? 'nichts ausgegeben' : 'alle aktuell'
  return parts.join(', ')
}
