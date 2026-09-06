// ───────────────────────────────────────────────────────────────────────────
// BEDARF 94 (P2) — der Dante-Patch als LESBARES, VERGLEICHBARES Dokument.
//
//   > Repetitive changes require opening many pages in Dante Controller;
//   > renaming machines or channels loses the existing patch; THE ONLY WAY TO
//   > MAKE A PATCH READABLE OFF THE NETWORK IS TO EXPORT XML AND CONVERT IT TO
//   > AN EXCEL MATRIX.
//
// Beleg: Mamat79/Dante-Config-Editor (README, 2026-08-24).
//
// ─── WAS HIER GEBAUT WIRD — UND WAS DER BEDARF WOERTLICH VERLANGT ──────────
//
// Die Bedarfs-Datenbank sagt: „Import a Dante Controller XML preset and render
// it as a documented, diffable patch inside the plan — DOCUMENTATION HALF
// ONLY, no network access."
//
// Gebaut wird die Dokumentations-Haelfte. NICHT gebaut wird der XML-Leser, und
// zwar aus einem Grund, der hier ausdruecklich stehen soll: das Schema des
// Dante-Preset-XML liegt in diesem Korpus NICHT vor. Es haengt an der
// Controller-Version, diese Anwendung hat nie eines gesehen, und ein Parser
// nach Vermutung haette genau die Eigenschaft, die in dieser Codebasis nirgends
// erlaubt ist: er saehe aus, als koennte er es. Bei einer halb gelesenen
// Subscription-Liste faellt das erst auf, wenn im Saal etwas fehlt.
//
// Gelesen wird stattdessen die MATRIX, die der Beleg selbst als heutigen Weg
// nennt — die Tabelle, in die das XML ohnehin konvertiert wird. Vier Spalten,
// selbsterklaerend, und jede Zeile eine Subscription. Wer eines Tages ein
// echtes Preset-XML in der Hand hat, setzt den Leser davor; alles dahinter —
// Vergleich, Befunde, Matrix — bleibt wie es ist.
//
// UND KEIN NETZ. Der Bedarf sagt „no network access", und die Anwendung ist
// offline-first: hier wird nichts abonniert, nichts umbenannt und nichts an
// ein Geraet geschickt.
// ───────────────────────────────────────────────────────────────────────────

/** Eine Subscription: welcher Empfangskanal hört auf welchen Sendekanal. */
export interface DanteSubscription {
  /** Geraet, das empfaengt. */
  rxDevice: string
  /** Empfangskanal an diesem Geraet. */
  rxChannel: string
  /**
   * Geraet, das sendet. Leer heisst: dieser Empfangskanal ist NICHT abonniert.
   *
   * Das ist ein gueltiger Zustand und keine Luecke — eine Matrix zeigt auch die
   * freien Eingaenge, und die Frage „welcher Kanal haengt an nichts" ist eine
   * der beiden, um die es hier geht.
   */
  txDevice?: string
  txChannel?: string
}

export interface DantePatch {
  subscriptions: DanteSubscription[]
  /**
   * Wie viele Zeilen wie eine Subscription aussahen, aber nicht lesbar waren.
   *
   * Eine Zahl und keine stille Null: eine Datei, aus der die Haelfte nicht
   * gelesen wurde, sieht sonst aus wie ein kleiner Patch.
   */
  unreadable: number
}
