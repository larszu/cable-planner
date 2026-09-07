// ───────────────────────────────────────────────────────────────────────────
// BEDARF 42 — aus „ja, macht das, stellt es uns in Rechnung" wird ein Beleg.
//
// Woertlich aus der Bedarfs-Datenbank:
//
//   > Approvals — including approval to work overtime, which becomes the
//   > disputed invoice line — arrive in a chat thread with no memory and no
//   > queryable record.
//
// Und, ebenso woertlich, die Massnahme mit ihrer Grenze:
//
//   > Do not attempt interception — build the paste-and-attribute capture.
//
// KEINE ANBINDUNG AN EINEN MESSENGER. Kein Bot, kein Konto, keine
// Telefonnummer. Der Weg ist: markieren, kopieren, einfuegen. Der Korpus
// begruendet das auch: „no tool will win the channel and the achievable goal
// is capture of the outcome."
//
// ─── WAS DIESE DATEI TUT, UND WO SIE AUFHOERT ──────────────────────────────
//
// Sie zerlegt eingefuegten Chat-Text in einzelne Nachrichten mit Zeitpunkt und
// Absender, SOWEIT das im Text steht. Sie erfindet nichts. Findet sich kein
// Zeitstempel, hat die entstehende Zusage keinen `givenAt` — und das Blatt
// sagt „Zeitpunkt nicht angegeben" statt eines Datums, das niemand geschrieben
// hat. Genau an dieser Zeile haengt im Streitfall das Geld.
//
// ─── ZWEI SCHREIBWEISEN, EINE ENTSCHEIDUNG ─────────────────────────────────
//
// WhatsApp exportiert das Datum in der Locale des Geraets: `09.09.26` mit
// Punkten (deutsch, Tag zuerst) oder `9/9/26` mit Schraegstrichen (englisch,
// Monat zuerst). Beide sehen am 9. September gleich aus und am 3. Februar
// nicht. Die Regel hier: PUNKTE heissen Tag-zuerst, SCHRAEGSTRICHE heissen
// Monat-zuerst — ausser die erste Zahl ist groesser als zwoelf, dann kann sie
// nur der Tag sein. Das ist die Konvention der Exporte und keine Vermutung
// ueber den Nutzer; wo sie nicht traegt (3.2. gegen 2.3. aus einem
// US-Geraet), bleibt der Zeitpunkt lieber falsch-ableitbar als still
// erfunden — deshalb steht die erkannte Form im Ergebnis mit dabei.
// ───────────────────────────────────────────────────────────────────────────

/** Wie das Datum im eingefuegten Text geschrieben war. */
export type DateStyle = 'day-first' | 'month-first' | 'none'

export interface ParsedMessage {
  /** ISO-Zeitpunkt, wenn im Text einer stand. */
  givenAt?: string
  /** Absender, wenn im Text einer stand. */
  by?: string
  /** Der Wortlaut ohne Kopfzeile. */
  text: string
  style: DateStyle
}

const zweistelligesJahr = (j: number): number => (j < 100 ? 2000 + j : j)

/**
 * Datum und Uhrzeit zu ISO zusammensetzen.
 *
 * OHNE ZEITZONE, mit Absicht: der Export traegt keine, und eine anzunehmen
 * („der Rechner steht schon richtig") verschoebe den Zeitpunkt um bis zu
 * einen halben Tag. Der Wert ist eine lokale Zeitangabe, so wie sie im Chat
 * stand, und wird auch so angezeigt.
 */
const zuIso = (
  tag: number,
  monat: number,
  jahr: number,
  stunde: number,
  minute: number,
  sekunde: number,
): string | undefined => {
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31 || stunde > 23 || minute > 59) return undefined
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${p(zweistelligesJahr(jahr), 4)}-${p(monat)}-${p(tag)}T${p(stunde)}:${p(minute)}:${p(sekunde)}`
}

/**
 * Eine Kopfzeile erkennen.
 *
 * Drei Formen, alle aus echten WhatsApp-Exporten:
 *   [09.09.26, 20:14:03] Max Mustermann: Text      (iOS, deutsch)
 *   09.09.26, 20:14 - Max Mustermann: Text          (Android)
 *   [9/9/26, 8:14:03 PM] Max Mustermann: Text       (iOS, englisch)
 */
const KOPF =
  /^\s*\[?(\d{1,2})([./])(\d{1,2})\2(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?\]?\s*(?:-\s*)?([^:]{1,60}):\s?([\s\S]*)$/

const zerlegeKopf = (zeile: string): ParsedMessage | undefined => {
  const m = KOPF.exec(zeile)
  if (!m) return undefined
  const [, aStr, trenner, bStr, jStr, hStr, minStr, secStr, ampm, absender, rest] = m
  const a = Number(aStr)
  const b = Number(bStr)
  // Punkte: Tag zuerst. Schraegstriche: Monat zuerst — ausser die erste Zahl
  // kann kein Monat sein.
  const tagZuerst = trenner === '.' || a > 12
  const tag = tagZuerst ? a : b
  const monat = tagZuerst ? b : a
  let stunde = Number(hStr)
  if (ampm) {
    const pm = ampm.toLowerCase() === 'pm'
    if (stunde === 12) stunde = pm ? 12 : 0
    else if (pm) stunde += 12
  }
  const iso = zuIso(tag, monat, Number(jStr), stunde, Number(minStr), Number(secStr ?? '0'))
  if (!iso) return undefined
  return {
    givenAt: iso,
    by: absender.trim(),
    text: rest.trim(),
    style: tagZuerst ? 'day-first' : 'month-first',
  }
}

/**
 * Eingefuegten Text in Nachrichten zerlegen.
 *
 * Zeilen ohne eigene Kopfzeile gehoeren zur vorhergehenden Nachricht — im
 * Export bricht ein langer Satz genauso um wie im Chat. Findet sich gar keine
 * Kopfzeile, entsteht GENAU EINE Nachricht mit dem ganzen Text, ohne
 * Zeitpunkt und ohne Absender. Das ist kein Fehlschlag, sondern der haeufige
 * Fall „jemand hat den Satz von Hand abgetippt".
 */
export const parsePastedApproval = (eingefuegt: string): ParsedMessage[] => {
  const zeilen = eingefuegt.split(/\r?\n/)
  const out: ParsedMessage[] = []
  for (const zeile of zeilen) {
    const kopf = zerlegeKopf(zeile)
    if (kopf) {
      out.push(kopf)
      continue
    }
    if (out.length > 0) {
      const letzte = out[out.length - 1]
      letzte.text = letzte.text ? `${letzte.text}\n${zeile}` : zeile
      continue
    }
    if (zeile.trim()) out.push({ text: zeile, style: 'none' })
    else if (out.length === 0) continue
  }
  if (out.length === 0) return []
  // Fortsetzungszeilen koennen hinten Leerzeilen angehaengt haben.
  return out.map((m) => ({ ...m, text: m.text.replace(/\s+$/, '') })).filter((m) => m.text || m.by)
}

/**
 * Woerter, an denen eine Zusage erkennbar ist — als VORSCHLAG, nicht als
 * Urteil.
 *
 * Der Nutzer waehlt die Nachricht aus; diese Liste sortiert die Kandidaten
 * nur vor. Sie darf nie allein entscheiden: „nein, das machen wir nicht"
 * enthaelt kein Zusagewort, aber „ich glaube nicht, dass wir das freigeben"
 * enthaelt „freigeb". Ein Programm, das daraus eine Zusage macht, erfindet
 * einen Beleg.
 */
export const APPROVAL_HINTS: readonly string[] = [
  'ja',
  'okay',
  'ok',
  'passt',
  'freigabe',
  'freigegeben',
  'freigeben',
  'genehmigt',
  'in ordnung',
  'macht das',
  'geht klar',
  'einverstanden',
  'go',
  'approved',
  'yes',
  'confirmed',
]

/** Traegt die Nachricht ein Wort, das nach Zusage klingt? */
export const looksLikeApproval = (text: string): boolean => {
  const klein = ` ${text.toLowerCase()} `
  return APPROVAL_HINTS.some((w) => klein.includes(` ${w} `) || klein.includes(` ${w},`))
}

/**
 * Die Nachricht, die am ehesten die Zusage ist.
 *
 * Genommen wird die LETZTE mit einem Zusagewort — in einem Thread steht die
 * Entscheidung am Ende, nicht am Anfang. Gibt es keine, kommt die letzte
 * Nachricht ueberhaupt zurueck, und der Nutzer korrigiert. `undefined` nur
 * bei leerem Text.
 */
export const bestApprovalCandidate = (nachrichten: readonly ParsedMessage[]): ParsedMessage | undefined => {
  if (nachrichten.length === 0) return undefined
  for (let i = nachrichten.length - 1; i >= 0; i -= 1) {
    if (looksLikeApproval(nachrichten[i].text)) return nachrichten[i]
  }
  return nachrichten[nachrichten.length - 1]
}
