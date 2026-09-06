// ───────────────────────────────────────────────────────────────────────────
// Umräumen ist ein Vorgang, keine Nebenwirkung (Bedarf 106, P3).
//
//   > Re-shelving after check-in or consolidating a bay requires a FAKE
//   > CHECK-OUT to an arbitrary user/location followed by a check-in. Filing a
//   > newly created asset into storage needs the same dance. So people skip it
//   > and THE RECORDED LOCATION GOES STALE.
//
// Belegt an `grokability/snipe-it#6743` — 2019 gemeldet, im März 2026 noch
// kommentiert — und an `#12893` für denselben Fall beim Anlegen. Die Antwort
// der Bedarfs-Datenbank ist wörtlich: „Location/containment must be a
// directly editable relation with ITS OWN AUDIT ENTRY, independent of any
// checkout state — a 'move' verb, not a side effect. Stale location is what
// makes mid-show 'where is the second one?' unanswerable."
//
// ─── WAS IN DIESEM PLANER SCHON STIMMTE, UND WAS NICHT ─────────────────────
//
// Die EINHEIT hatte den Vorgang bereits: `moveUnit` schreibt einen
// „moved"-Eintrag in ihre Historie, ohne Umweg über eine Ausgabe. Zwei
// Nachbarn hatten ihn nicht:
//
//   * Der KNOTEN (ein Case in ein anderes Regal) wechselte seinen `parentId`
//     und hinterließ nichts. Wer nachsehen will, wo die Kiste gestern stand,
//     findet keinen Eintrag — und genau diese Frage ist die aus dem Beleg.
//   * Der ARTIKEL (Bulk-Ware) wechselte seinen Lagerort als eines von vielen
//     Feldern in `updateItem`. Das ist die Nebenwirkung, die der Bedarf
//     ausschließt: dieselbe Funktion, die eine Notiz ändert, verschiebt auch
//     Ware, und keine der beiden Änderungen ist von der anderen zu
//     unterscheiden.
//
// ─── WARUM DAS JOURNAL NICHT IM AUSTAUSCHFORMAT LIEGT ──────────────────────
//
// Die Historie der Einheit liegt im portablen Format (`avplan-inventory`),
// dieses Journal nicht — und das ist eine Entscheidung, keine Auslassung.
//
// Ein Umräum-Eintrag sagt „dieses Regal, dieser Rechner, dieser Betrieb". In
// eine fremde Installation importiert, benennt er Lagerorte, die es dort
// nicht gibt: `fromId` und `toId` zeigen ins Leere, und ein Journal, dessen
// Einträge auf nichts zeigen, ist schlimmer als keins — es sieht aus wie eine
// Auskunft. Die Einheit trägt ihre Historie mit, weil sie ein physisches
// Objekt IST und mitfährt; ein Regalplatz fährt nicht mit.
//
// Der Preis ist benannt: wer das Journal eines Tages doch mitschicken will,
// zahlt eine Formatversion dafür. Heute wäre das die zweite an einem Tag
// (Version 3 kam gerade für `houseRef`), und drei Planer würden einander
// wieder die Dateien verweigern — für ein Journal, das keiner von ihnen
// auflösen könnte.
// ───────────────────────────────────────────────────────────────────────────

/** Was verschoben wurde. */
export type MoveSubjectKind = 'node' | 'item' | 'unit'

export const MOVE_SUBJECT_LABEL: Readonly<Record<MoveSubjectKind, string>> = {
  node: 'Lagerort/Container',
  item: 'Artikel',
  unit: 'Einheit',
}

/**
 * Ein Umräum-Vorgang.
 *
 * Append-only wie die Historie der Einheit: ein Eintrag wird nicht bearbeitet
 * und nicht gelöscht. Ein überschriebener Umräum-Eintrag wäre genau das
 * Vergessen, gegen das dieser Bedarf geschrieben ist.
 */
export interface StorageMove {
  /** ISO-Zeitstempel. Kommt von aussen — dieses Modul hat keine Uhr. */
  at: string
  kind: MoveSubjectKind
  /** Die id des verschobenen Objekts. */
  subjectId: string
  /** Wo es vorher lag (Knoten-id). Fehlt = nirgends erfasst. */
  fromId?: string
  /** Wo es jetzt liegt (Knoten-id). Fehlt = aus dem Lager herausgenommen. */
  toId?: string
  /**
   * Klartext-Pfad des Ziels zum Zeitpunkt des Vorgangs.
   *
   * Redundant zu `toId` — und trotzdem nötig: ein Lagerort kann später
   * umbenannt oder gelöscht werden, und dann sagt die id nichts mehr. Der
   * Eintrag soll die Frage „wo stand die Kiste im März" auch dann noch
   * beantworten. Dieselbe Regel wie beim `moved`-Eintrag der Einheit.
   */
  toLabel?: string
  /** Freier Zusatz (etwa „Regal konsolidiert"). */
  note?: string
}

/** Was das Verschieben verhindert hat. `null` heisst: es ging. */
export type MoveRefusal = 'unknown-subject' | 'unknown-target' | 'cycle' | 'same-place'

export const MOVE_REFUSAL_LABEL: Readonly<Record<MoveRefusal, string>> = {
  'unknown-subject': 'Das Objekt gibt es nicht (mehr)',
  'unknown-target': 'Den Ziel-Lagerort gibt es nicht',
  cycle: 'Ein Container kann nicht in sich selbst',
  'same-place': 'Liegt schon dort',
}
