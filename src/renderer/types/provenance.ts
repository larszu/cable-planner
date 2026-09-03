// ---------------------------------------------------------------------------
// ADR-003 Inkrement 2 — Provenienz als Vokabular des Plan-Modells.
//
// WORUM ES GEHT. Der Marktbefund hinter ADR-003 ist, dass Werkzeuge in diesem
// Feld routinemaessig einen Wert anzeigen, den niemand bestaetigt hat, als
// waere er bestaetigt. Der Multiviewer, der ein falsches Label zeigt; das
// Tally, das dunkel bleibt, obwohl die Kamera auf Sendung ist. Der Schaden
// entsteht nicht daran, einen unbestaetigten Wert zu BENUTZEN — der ist
// vollkommen brauchbar —, sondern daran, ihn als bestaetigt AUSZUGEBEN.
//
// WARUM ERST JETZT, UND WARUM SO KLEIN. ADR-003 hat dieses Inkrement
// ausdruecklich zurueckgestellt: „Ein gemeinsames Provenienz-Badge zu bauen,
// bevor der zweite Anwendungsfall existiert, waere eine Abstraktion auf
// Verdacht." Vor dem Bau wurden deshalb die Stellen GEMESSEN, statt sie
// anzunehmen — und das Ergebnis hat den Zuschnitt geaendert.
//
// Es sind ZWEI Formen im Code, nicht eine:
//
//   1. Ein WERT MIT HERKUNFT — „diese Zahl wurde abgeschickt, nicht
//      bestaetigt". Belegt an: Rentman `lastSentQty`, `portsUnknown`, und im
//      Nachbar-Repo `BridgeTallyState` (sony-camera-bridge).
//   2. Eine LISTE DES NICHTBESTIMMBAREN — „das hier kam nicht durch". Belegt
//      an: `sourceMap.unresolved`, `changeImpact`s `unknown`-Verdikt,
//      `planDiff.unclassified`.
//
// Diese Datei ist ausdruecklich NUR fuer die erste Form. Die zweite ist
// bereits dreimal unabhaengig gebaut und funktioniert; sie hier
// mit hineinzuziehen waere genau die Abstraktion auf Verdacht, gegen die die
// Zurueckstellung geschrieben war. Wer sie eines Tages verallgemeinert, tut
// das in einem eigenen Schritt und mit derselben Messung vorweg.
// ---------------------------------------------------------------------------

/**
 * Woher ein angezeigter Wert kommt.
 *
 * Die Reihenfolge ist die der zunehmenden Sicherheit, und sie ist nicht
 * bloss Sortierung: `confirmed` darf nur stehen, wo ein Geraet oder ein
 * fremdes System den Wert zurueckgemeldet hat. Alles andere ist eine
 * Behauptung ueber die Welt, die man nicht geprueft hat.
 */
export type Provenance =
  /** Niemand hat etwas gesagt. Nicht „aus", nicht „null" — keine Aussage. */
  | 'unknown'
  /** Im Plan so vorgesehen. Der Normalfall fuer alles, was der Nutzer eintraegt. */
  | 'planned'
  /** Abgeschickt, aber nicht zurueckgemeldet. Brauchbar — nur eben nicht bestaetigt. */
  | 'commanded'
  /** Vom Geraet oder Fremdsystem zurueckgelesen. Die einzige echte Zusage. */
  | 'confirmed'

/** Reihenfolge fuer Sortierung und Vergleiche: unsicher zuerst. */
export const PROVENANCE_ORDER: Record<Provenance, number> = {
  unknown: 0,
  commanded: 1,
  planned: 2,
  confirmed: 3,
}

/**
 * Die Felder, deren Herkunft NICHT `planned` ist — als Daten, nicht als Prosa.
 *
 * Warum eine Liste und kein Feld je Datensatz: die drei Stellen tragen ihre
 * Herkunft heute schon, nur implizit. `lastSentQty` heisst so, weil es
 * abgeschickt wurde; `portsUnknown` IST die Unbekannt-Markierung. Ein
 * zusaetzliches Provenienz-Feld daneben waere ein zweiter Ort fuer dieselbe
 * Wahrheit — und zwei Orte laufen auseinander, wie der Zugangsdaten-Rundgang
 * gerade erst gezeigt hat.
 *
 * Diese Liste sagt deshalb nur, WAS die Oberflaeche kennzeichnen muss. Der
 * Guard in tests/provenance.test.ts prueft, dass jeder Eintrag ein Feld
 * benennt, das es wirklich gibt.
 */
export interface ProvenanceDeclaration {
  /** Wo der Wert lebt, als lesbarer Pfad. */
  field: string
  provenance: Provenance
  /** Warum — steht im Tooltip und muss den Nutzer ueberzeugen, nicht den Autor. */
  reason: string
}

export const DECLARED_PROVENANCE: ProvenanceDeclaration[] = [
  {
    field: 'metadata.rentmanCableMap.lastSentQty',
    provenance: 'commanded',
    reason:
      'Diese Menge wurde an Rentman geschickt. Rentman meldet nicht zurueck, ' +
      'ob sie dort angekommen ist — ein Ruecklesen kostete einen zweiten ' +
      'API-Aufruf je Position gegen ein Rate-Limit.',
  },
  {
    field: 'equipment.portsUnknown',
    provenance: 'unknown',
    reason:
      'Beim Import gab es keinen Datenblatt-Treffer. Die Ports sind leer, ' +
      'weil keine erfunden wurden — nicht, weil das Geraet keine haette.',
  },
]

/** Die Herkunft eines Feldes, oder `planned` als Normalfall. */
export const provenanceOf = (field: string): Provenance =>
  DECLARED_PROVENANCE.find((d) => d.field === field)?.provenance ?? 'planned'

/** Die Begruendung zu einem Feld, falls es eine gibt. */
export const provenanceReason = (field: string): string | undefined =>
  DECLARED_PROVENANCE.find((d) => d.field === field)?.reason
