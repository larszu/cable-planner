// ───────────────────────────────────────────────────────────────────────────
// Was Claude am Plan geaendert hat (#873).
//
// ─── WARUM EIN EIGENER NACHWEIS UND KEIN ETIKETT AM UNDO-SCHRITT ───────────
//
// #873 verlangt, dass jede Aenderung „im Verlauf als ‚Claude' erkennbar" ist.
// Der Verlauf dieses Programms ist ein Stapel von PLAN-ZUSTAENDEN
// (`projectHistory`: `past`/`future` halten ganze Projekte, kein Eintrag
// traegt einen Namen). Ein Etikett dort hiesse, den Undo-Mechanismus
// umzubauen — und der ist die Stelle, an der ein Fehler die Arbeit von
// Stunden kostet.
//
// Also steht der Nachweis DANEBEN: eine Zeile je Schreibvorgang, mit
// Zeitpunkt, Werkzeug und einem Satz. Sichtbar in Einstellungen -> MCP.
// Das beantwortet die Frage, die hinter dem Kriterium steht — „was hat das
// Ding an meinem Plan gemacht?" — und zwar auch dann noch, wenn der
// Undo-Stapel laengst ueberschrieben ist.
//
// ─── WARUM ER MITREIST UND WARUM ER GEDECKELT IST ──────────────────────────
//
// Er steht IM PROJEKT: wer die Datei weitergibt, gibt mit, was daran nicht
// von Hand entstanden ist. Und er endet bei fuenfzig Zeilen — ein Nachweis,
// der die Plandatei aufblaeht, wird beim naechsten Aufraeumen geloescht,
// und dann gibt es gar keinen.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

export interface McpEintrag {
  id: string
  /** Wann — ISO, vom Aufrufer gesetzt. */
  zeit: string
  /** Welches Werkzeug. */
  werkzeug: string
  /** Ein Satz: was passiert ist. */
  text: string
}

/** Mehr Zeilen traegt die Plandatei nicht; die aeltesten fallen. */
export const MCP_LOG_MAX = 50

export const mitEintrag = (
  bisher: readonly McpEintrag[] | undefined,
  eintrag: McpEintrag,
): McpEintrag[] => [...(bisher ?? []), eintrag].slice(-MCP_LOG_MAX)

export const normalisiereMcpEintrag = (roh: unknown): McpEintrag | undefined => {
  if (!roh || typeof roh !== 'object') return undefined
  const o = roh as Record<string, unknown>
  const id = typeof o.id === 'string' ? o.id : ''
  const zeit = typeof o.zeit === 'string' ? o.zeit : ''
  const werkzeug = typeof o.werkzeug === 'string' ? o.werkzeug : ''
  const text = typeof o.text === 'string' ? o.text : ''
  // Ohne Zeitpunkt ist es kein Nachweis, sondern eine Behauptung.
  if (!id || !zeit || !werkzeug) return undefined
  return { id, zeit, werkzeug, text }
}
