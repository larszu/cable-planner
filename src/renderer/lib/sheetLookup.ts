// ───────────────────────────────────────────────────────────────────────────
// Bedarf 27 — der Rueckweg vom Papier. „Gilt dieses Blatt noch?"
//
// DER BEFUND ist keine Klage ueber Papier, sondern ueber die Einbahnstrasse:
//
//   > Pick lists, call sheets, running orders, load-out lists and damage
//   > forms stay paper because paper needs no battery, works in a basement
//   > and can be signed. But NOTHING CROSSES BACK: changes are made in pen on
//   > the printed plan and the plan never learns.
//
// Und die Frist steht daneben: „Must complete in under ten seconds or it will
// not be used in the last two hours before doors."
//
// ─── WAS SCHON DA WAR UND NIEMAND ERREICHEN KONNTE ─────────────────────────
//
// ADR-004 hat den Stempel auf jedes Blatt gesetzt — Dokument-Bezeichner,
// Stand, Datum — und `documentRegistry` kann den Stand von heute ausrechnen.
// `docStandStatus` und `findByStand` sind gebaut, getestet und BEANTWORTEN
// GENAU DIESE FRAGE. Nur rief sie nichts auf: kein Knopf, kein Feld, kein
// Dialog. Gemessen 2026-09-06 — die einzige Fundstelle ausserhalb ihrer
// eigenen Dateien war ein KOMMENTAR in `changeImpact.ts`.
//
// Diese Datei ist die Engstelle, durch die der Rueckweg geht: EINE Funktion,
// die alles annimmt, was von einem Blatt kommen kann.
//
// ─── DREI EINGABEN, EIN ERGEBNIS ───────────────────────────────────────────
//
// Vom Blatt kommt je nach Weg etwas anderes zurueck, und alle drei Formen
// muessen gehen — sonst scheitert der Rueckweg an der Eingabe statt an der
// Sache:
//
//   1. der ganze Code   `cableplanner://doc/pull-liste?s=1a2b3c4d`
//   2. nur der Stand    `#1a2b3c4d`  (das, was auf dem CSV-Fuss steht)
//   3. abgetippt        `1a2b3c4d`   (mit Leerzeichen, in Grossbuchstaben)
//
// Der ganze Code ist die beste Eingabe: er nennt das Dokument SELBST. Der
// blosse Stand muss geraten werden — `findByStand` haelt ihn gegen alle
// bekannten Dokumente — und findet nichts, wenn das Blatt inzwischen ueberholt
// ist. Genau dieser Fall ist der wichtigste, und er wird deshalb BENANNT:
// „Stand gehoert zu keinem Dokument von jetzt" heisst fast immer „das Blatt
// ist alt", und die Auskunft ist brauchbar, auch wenn sie nicht sagt, welches.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { CablePlannerProject } from '../types/project'
import { DOCUMENT_LABELS, UNJUDGEABLE_DOCUMENTS, currentStand, findByStand } from './documentRegistry'
import { docStandStatus, parseDocQrPayload, type DocStandStatus } from './qrPayload'

export type SheetLookupKind =
  /** Der Code nennt das Dokument, und der Stand liess sich vergleichen. */
  | 'identified'
  /** Nur ein Stand, und er passt zu einem Dokument von jetzt. */
  | 'matched-by-stand'
  /** Ein gueltiger Stand, der zu keinem aktuellen Dokument passt. */
  | 'stale-or-foreign'
  /** Weder Code noch acht Hex-Zeichen. */
  | 'unreadable'

export interface SheetLookup {
  kind: SheetLookupKind
  /** Dokument-Bezeichner, wo er bekannt ist. */
  docId?: string
  /** Lesbarer Name dazu. */
  label?: string
  /** Der Stand vom Blatt, normalisiert (klein, ohne `#`). */
  stand?: string
  /** Urteil ueber den Stand — nur wo ein Dokument benannt ist. */
  status?: DocStandStatus
  /** Warum ein Dokument nicht beurteilbar ist. Aus dem Register, nicht neu
   *  formuliert: zwei Formulierungen derselben Regel laufen auseinander. */
  reason?: string
  /** Revisions-Label vom Blatt, wo der Code eines trug. */
  revision?: string
}

/** Acht Hex-Zeichen, wie sie unter jedem Blatt stehen. Leerzeichen und
 *  Grossbuchstaben kommen vom Abtippen und sind kein Fehler. */
const STAND = /^[0-9a-f]{8}$/

const normStand = (raw: string): string => raw.trim().replace(/^#/, '').replace(/\s+/g, '').toLowerCase()

/**
 * Was ein Blatt sagt — aus allem, was von ihm zurueckkommen kann.
 *
 * Liefert IMMER ein Ergebnis. `unreadable` ist eines davon: „das ist kein
 * Dokument-Code" ist eine Auskunft und kein Fehlerfall, und wer sie als
 * Ausnahme wirft, zwingt jeden Aufrufer zu einem try/catch fuer den
 * Normalfall des Vertippens.
 */
export const lookUpSheet = (raw: string, project: CablePlannerProject): SheetLookup => {
  const text = (raw ?? '').trim()
  if (!text) return { kind: 'unreadable' }

  // (1) Der ganze Code. Er nennt das Dokument selbst — die beste Eingabe.
  const ref = parseDocQrPayload(text)
  if (ref) {
    const stand = normStand(ref.stand)
    const heute = currentStand(ref.docId, project)
    return {
      kind: 'identified',
      docId: ref.docId,
      label: DOCUMENT_LABELS[ref.docId] ?? ref.docId,
      stand,
      status: docStandStatus({ ...ref, stand }, heute),
      ...(UNJUDGEABLE_DOCUMENTS[ref.docId] ? { reason: UNJUDGEABLE_DOCUMENTS[ref.docId] } : {}),
      ...(ref.revision ? { revision: ref.revision } : {}),
    }
  }

  // (2)/(3) Nur ein Stand — abgetippt oder aus dem CSV-Fuss.
  const stand = normStand(text)
  if (!STAND.test(stand)) return { kind: 'unreadable' }

  const treffer = findByStand(stand, project)
  if (treffer) {
    // Er passt zu einem Dokument von JETZT, also ist das Blatt aktuell. Ein
    // `status` waere hier eine zweite Rechnung ueber dieselbe Tatsache.
    return {
      kind: 'matched-by-stand',
      docId: treffer.docId,
      label: treffer.label,
      stand,
      status: 'current',
    }
  }

  // Der wichtigste Fall, und der Grund, warum er einen eigenen Namen hat:
  // „passt zu keinem Dokument von jetzt" heisst fast immer „das Blatt ist
  // alt". Ein `null` an dieser Stelle waere dieselbe Tatsache, aber
  // unbenannt — und der Aufrufer machte daraus „nicht gefunden", was nach
  // einem Tippfehler klingt statt nach einem ueberholten Ausdruck.
  return { kind: 'stale-or-foreign', stand }
}
