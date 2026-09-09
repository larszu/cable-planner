// ───────────────────────────────────────────────────────────────────────────
// BEDARF 11 — „was hat sich seit DEINEM Ausdruck geaendert?"
//
// Woertlich aus der Bedarfs-Datenbank (P1, Kamera, weit verbreitet,
// Stunden je Show):
//
//   > Version control and a visible change log ACROSS DEPARTMENTS, not Excel
//   > copies. […] different people end up on different versions; changes also
//   > travel by WhatsApp and email.
//
// und die Einschaetzung, die den Zuschnitt vorgibt:
//
//   > surface a PER-ROLE 'what changed since your last printout/view' diff.
//
// WAS SCHON DA WAR UND WAS FEHLTE. Das Register (`documentLog`) weiss, WELCHE
// Blaetter ausgegeben wurden und mit welchem Stand; `reviewLog` rechnet
// dagegen, welche davon ueberholt sind. Zwei Dinge fehlten fuer den Bedarf:
//
//   1. WER das Blatt bekommen hat. Ohne diese Angabe ist „welche Blaetter
//      sind hin" eine Liste ueber alle — und der Bedarf ist gerade, dass die
//      Abteilungen auseinanderlaufen. Deshalb traegt der Register-Eintrag
//      jetzt einen `recipient`.
//   2. WAS sich geaendert hat. Das Register haelt vom damaligen Plan nur den
//      Fingerabdruck fest, nicht den Plan. Acht Hex-Zeichen sagen „anders",
//      nie „was".
//
// UND GENAU DA IST DIE GRENZE, DIE DIESES MODUL NICHT UEBERSCHREITET. Es gibt
// einen Vergleich NUR, wenn der damalige Plan-Stand noch existiert — als
// festgeschriebene Revision (#412), deren Schnappschuss fuer dasselbe Dokument
// denselben Stand ergibt. Dann ist der Vergleich echt: er laeuft gegen die
// Fassung, die das Blatt gedruckt hat.
//
// Gibt es keine solche Revision, steht hier KEIN Vergleich und ein Satz, der
// sagt warum. Die naheliegende Abkuerzung — „nimm die Revision, die zeitlich
// am naechsten liegt" — waere die gefaehrliche: sie liefert eine Liste von
// Aenderungen, die plausibel aussieht und gegen die falsche Fassung gerechnet
// ist. Ein Blatt, dem man einen falschen Vergleich beilegt, ist schlechter
// dran als eines, bei dem „ueberholt, Vergleich nicht moeglich" steht
// (ADR-005, und dieselbe Regel wie `unknown` in `changeImpact`).
//
// ZUGEORDNET WIRD UEBER DEN STAND, NICHT UEBER DIE ZEIT. Der Stand ist aus
// dem Schnappschuss GERECHNET (`currentStand`) und nicht gespeichert — eine
// Revision, die zufaellig kurz vor dem Ausdruck angelegt wurde, aber anderen
// Inhalt hat, faellt damit durch.
//
// KEINE ZWEITE RECHNUNG. Der Status je Blatt kommt aus `reviewLog`, der
// Vergleich aus `planDiff`, der Stand aus `documentRegistry`. Dieses Modul
// gruppiert und ordnet zu; es beurteilt nichts ein zweites Mal.
// ───────────────────────────────────────────────────────────────────────────

import type { CablePlannerProject, ProjectRevision } from '../types/project'
import { currentStand } from './documentRegistry'
import { reviewLog, type ReviewedEntry } from './documentLog'
import type { DocumentLogFile } from './bridge'
import { planDiff, type PlanDiff } from './planDiff'

/**
 * Der Empfaenger, unter dem ein Eintrag ohne Angabe gefuehrt wird.
 *
 * Er wird NICHT unter einen der genannten Empfaenger gemischt und auch nicht
 * weggelassen: ein Blatt, von dem niemand weiss, wer es hat, ist die
 * gefaehrlichste Zeile der Liste — nicht die unwichtigste.
 */
export const OHNE_EMPFAENGER = ''

/** Warum es zu einem ueberholten Blatt keinen Vergleich gibt. */
export type OhneVergleich =
  /** Der Stand des Blattes ist in keiner festgeschriebenen Revision zu finden. */
  | 'keine-passende-revision'
  /** Der Stand des Dokuments ist gar nicht reproduzierbar (z. B. Kabel-BOM). */
  | 'stand-nicht-reproduzierbar'

export interface BlattStand {
  entry: ReviewedEntry
  /** Die Revision, deren Schnappschuss denselben Stand fuer dieses Dokument ergibt. */
  revisionId?: string
  revisionLabel?: string
  /**
   * Was sich seit diesem Blatt geaendert hat. Nur gesetzt, wenn das Blatt
   * ueberholt IST und die Fassung von damals noch existiert.
   */
  diff?: PlanDiff
  /** Nur gesetzt, wenn es keinen Vergleich gibt und das Blatt ueberholt ist. */
  ohneVergleich?: OhneVergleich
}

export interface EmpfaengerStand {
  recipient: string
  /** Alle Blaetter dieses Empfaengers, juengste zuerst (wie `reviewLog`). */
  blaetter: BlattStand[]
  superseded: number
  unknown: number
  /** Wie viele der ueberholten Blaetter einen echten Vergleich haben. */
  mitVergleich: number
}

/**
 * Ein Register-Eintrag mit Empfaenger.
 *
 * `recipient` ist bewusst FREITEXT und keine Rollen-Aufzaehlung: der Bedarf
 * nennt „Abteilungen", und welche es gibt, weiss dieses Programm nicht. Eine
 * feste Liste haette die Haelfte der Faelle in „Sonstige" gedraengt, und
 * damit waere die Trennung wieder weg, um die es geht.
 */

const revisionStand = (
  revision: ProjectRevision,
  docId: string,
): string | undefined =>
  // Der Schnappschuss traegt keine `revisions`; `currentStand` liest sie auch
  // nicht. Der Stand wird GERECHNET, nicht aus der Revision gelesen — dort
  // steht er gar nicht, und ein gespeicherter waere ab der ersten Aenderung
  // am Schnappschuss falsch.
  currentStand(docId, revision.snapshot as CablePlannerProject)

/**
 * Die Revision finden, aus der dieses Blatt gedruckt wurde.
 *
 * Gesucht wird ueber den STAND des Dokuments, nicht ueber die Zeit (siehe
 * Kopf). Passt mehr als eine, gewinnt die juengste: derselbe Stand heisst
 * derselbe Inhalt, und dann ist die Wahl fuer den Vergleich gleichgueltig —
 * fuer die Beschriftung aber nicht, und dort ist die juengste die, die der
 * Nutzer im Kopf hat.
 */
export const revisionFuerBlatt = (
  entry: ReviewedEntry,
  revisions: readonly ProjectRevision[],
): ProjectRevision | undefined => {
  const passend = revisions.filter((r) => revisionStand(r, entry.docId) === entry.stand)
  if (passend.length === 0) return undefined
  return passend.reduce((a, b) => (a.createdAt >= b.createdAt ? a : b))
}

/**
 * Das Register nach Empfaengern aufteilen und je Blatt sagen, was sich seit
 * ihm geaendert hat.
 *
 * Reine Funktion ueber gegebene Staende — keine Uhr, kein Datei-IO, kein
 * Store. Die Reihenfolge der Blaetter ist die von `reviewLog` (juengste
 * zuerst) und wird hier nicht umsortiert; die Empfaenger stehen alphabetisch,
 * mit den nicht genannten am Ende.
 */
export const empfaengerStaende = (
  log: DocumentLogFile,
  project: CablePlannerProject,
  projectPath?: string,
): EmpfaengerStand[] => {
  const revisions = project.revisions ?? []
  const nach = new Map<string, BlattStand[]>()

  for (const entry of reviewLog(log, project, projectPath)) {
    const blatt: BlattStand = { entry }

    if (entry.status === 'superseded') {
      const revision = revisionFuerBlatt(entry, revisions)
      if (revision) {
        blatt.revisionId = revision.id
        blatt.revisionLabel = revision.label
        blatt.diff = planDiff(revision.snapshot as CablePlannerProject, project)
      } else {
        blatt.ohneVergleich = 'keine-passende-revision'
      }
    } else if (entry.status === 'unknown') {
      // Kein Vergleich, und zwar aus einem anderen Grund als oben: der Stand
      // dieses Dokuments ist ueberhaupt nicht reproduzierbar. Die beiden
      // Gruende zusammenzuwerfen hiesse dem Nutzer sagen, er koenne die Lage
      // durch Festschreiben einer Revision heilen — hier kann er das nicht.
      blatt.ohneVergleich = 'stand-nicht-reproduzierbar'
    }

    const schluessel = entry.recipient?.trim() || OHNE_EMPFAENGER
    const liste = nach.get(schluessel)
    if (liste) liste.push(blatt)
    else nach.set(schluessel, [blatt])
  }

  return [...nach.entries()]
    .map(([recipient, blaetter]) => ({
      recipient,
      blaetter,
      superseded: blaetter.filter((b) => b.entry.status === 'superseded').length,
      unknown: blaetter.filter((b) => b.entry.status === 'unknown').length,
      mitVergleich: blaetter.filter((b) => b.diff !== undefined).length,
    }))
    .sort((a, b) => {
      // Die nicht genannten stehen am Ende — sichtbar, aber nicht vorn: sie
      // sind kein Empfaenger, sondern eine Luecke im Protokoll.
      if (a.recipient === OHNE_EMPFAENGER) return 1
      if (b.recipient === OHNE_EMPFAENGER) return -1
      return a.recipient.localeCompare(b.recipient)
    })
}
