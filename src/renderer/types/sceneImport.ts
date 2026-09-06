// ───────────────────────────────────────────────────────────────────────────
// BEDARF 92 (P2) — die Kanalliste aus der Datei lesen, die das Pult ohnehin
// schreibt.
//
//   > The authoritative channel names live in the console show file; the
//   > paperwork is typed by hand from memory or from an older PDF. NOTHING
//   > FLOWS BACK FROM THE DESK after rehearsal changes.
//
// Der Beleg (computi71/bandregie#11) nennt das Format ausdruecklich: im
// X32/M32-Szenenformat stehen die Kanalnamen als
//
//   /ch/01/config "Kick" 1 RD 1
//
// und lassen sich „reliably" parsen; WING schreibt dieselben Zeilen. Genau
// deshalb ist dieser Bedarf baubar und die Nachbarn 93 und 94 nicht: hier
// liegt das Format im Korpus, dort nicht.
//
// ─── WAS DAS HIER IST UND WAS NICHT ────────────────────────────────────────
//
// Ein LESER, kein Schreiber. Diese Anwendung erzeugt keine Szenendatei und
// schickt nichts an ein Pult. Sie liest eine Datei, die jemand vom Pult
// exportiert hat, und macht daraus eine Liste — und beim zweiten Mal einen
// Vergleich mit dem ersten.
//
// Der Vergleich ist die eigentliche Auskunft. Der Bedarf sagt es so:
//
//   > offer a diff between uploads
//
// und die Bedarfs-Datenbank folgert: „The upload diff is the
// rehearsal-to-show change log that today exists only in someone's head."
//
// ─── WAS NICHT GERATEN WIRD ────────────────────────────────────────────────
//
// Die Zuordnung Pult-Kanal → Plan-Kanal. Ein Pult zaehlt seine Eingaenge, der
// Plan zaehlt seine Kabel, und beide beginnen bei 1 — daraus eine Gleichung zu
// machen waere die naheliegendste und teuerste Annahme dieser Datei. Zugeordnet
// wird ueber die Kanalnummer NUR, wenn der Nutzer es sagt; sonst ueber den
// Namen, und was sich nicht findet, bleibt ausdruecklich unzugeordnet.
// ───────────────────────────────────────────────────────────────────────────

/** Welche Sorte Datei gelesen wurde. */
export type SceneFormat =
  /** Behringer X32 / Midas M32 — `/ch/NN/config "Name" …`. */
  | 'x32'
  /** Behringer WING — dieselben Zeilen (laut Beleg). */
  | 'wing'
  /** Erkannt wurde nichts; die Datei wird nicht geraten. */
  | 'unknown'

export const SCENE_FORMAT_LABEL: Readonly<Record<SceneFormat, string>> = {
  x32: 'X32 / M32',
  wing: 'WING',
  unknown: 'nicht erkannt',
}

/** Ein Kanal, wie er in der Szenendatei steht. */
export interface SceneChannel {
  /** Kanalnummer am Pult, wie in der Zeile — 1-basiert. */
  ch: number
  /** Der Name, den jemand am Pult eingetippt hat. */
  name: string
  /**
   * Die Farbe, soweit die Zeile eine traegt (z. B. `RD`).
   *
   * Sie steht mit drin, weil sie am Pult die Gruppierung IST — Drums rot,
   * Vocals gelb. Auf dem Blatt ist das die einzige Information darueber, wie
   * der Kollege am Pult die Liste gedacht hat.
   */
  color?: string
  /** Ob der Kanal stummgeschaltet gespeichert wurde. */
  muted?: boolean
}

export interface SceneImport {
  format: SceneFormat
  channels: SceneChannel[]
  /**
   * Wie viele Zeilen wie ein Kanal aussahen, aber nicht lesbar waren.
   *
   * Eine Zahl und keine stille Null: eine Datei, aus der die Haelfte nicht
   * gelesen wurde, sieht sonst aus wie ein Pult mit wenigen Kanaelen.
   */
  unreadable: number
}
