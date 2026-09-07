// ───────────────────────────────────────────────────────────────────────────
// Welche Show hängt gerade an dieser Freigabe? (Bedarf 127, P4)
//
//   > One machine, one operator, one file; A HOUSE RUNNING ROUGHLY 65 EVENTS A
//   > YEAR cannot have team members working concurrently ON SEPARATE SHOWS,
//   > and there is no client-facing view.
//
// Belege: `cpvalente/ontime#1325` (2024 — rund 65 Veranstaltungen im Jahr,
// gewünscht sind Anmeldung, Zugriff je Veranstaltung und gleichzeitiges
// Bearbeiten; ohne Umsetzung geschlossen) und `bitfocus/companion#1738` (kein
// Abgleich zwischen den Rechnern zweier Operator).
//
// ─── DER DEFEKT, DEN DAS HIER ABSTELLT ─────────────────────────────────────
//
// Die LAN-Freigabe kannte bisher keine Show, sondern nur „das gerade geladene
// Projekt". `setMobileShareProject` tauschte es wortlos aus. Wer am Desktop
// eine andere Show öffnete, während unten in der Halle drei Handys am
// QR-Code hingen, hatte:
//
//  * dieselbe URL, dasselbe Token, eine ANDERE Show auf jedem Handy — ohne
//    ein Wort, mitten im Aufbau; und
//  * jeden Rückweg (`/checks`, `/cables`, `/pending-changes`) auf die NEUE
//    Show gebucht. Der Field-Tech hakt Ports der Show von gestern ab, und die
//    Häkchen landen in der von heute.
//
// Das Zweite ist das Schlimmere: das Erste sieht man, das Zweite nicht.
//
// ─── DIE ENTSCHEIDUNG LIEGT AN EINER STELLE ────────────────────────────────
//
// `showMismatch` ist die eine Prüfung, durch die alle drei Schreibwege gehen.
// Drei eigene Vergleiche in drei Handlern wären drei Gelegenheiten, einen zu
// vergessen — und vergessen würde man den, der am seltensten benutzt wird,
// also den, bei dem es am längsten niemandem auffällt.
//
// REIN: keine Datei, kein Netz, keine Uhr.
// ───────────────────────────────────────────────────────────────────────────

/** Warum ein Rückweg nicht angenommen wurde. */
export type ShowRejection =
  /** Der Schreibweg nennt eine andere Show als die, die gerade freigegeben ist. */
  | 'other-show'
  /** Der Schreibweg nennt gar keine Show. */
  | 'no-show-sent'
  /** Die freigegebene Show hat keine Kennung — dann ist nichts zu vergleichen. */
  | 'no-show-served'

export const SHOW_REJECTION_REASON: Readonly<Record<ShowRejection, string>> = {
  'other-show':
    'Diese Rückmeldung gehört zu einer anderen Show als der gerade freigegebenen. '
    + 'Sie wurde NICHT übernommen: am Desktop ist inzwischen ein anderes Projekt '
    + 'offen, und die Häkchen gehören zu dem, an dem der Kollege in der Halle steht.',
  'no-show-sent':
    'Diese Rückmeldung nennt keine Show. Sie wurde nicht übernommen — ohne Kennung '
    + 'lässt sich nicht sagen, in welches Projekt sie gehört, und geraten wird hier nicht.',
  'no-show-served':
    'Die freigegebene Show trägt keine Kennung. Solange das so ist, wird kein '
    + 'Rückweg angenommen: es gibt nichts, wogegen sich prüfen ließe.',
}

/**
 * Die Kennung einer Show, so wie sie im Projekt steht.
 *
 * `null` heisst „diese Show hat keine" — ein eigener Fall und NICHT der leere
 * String, der sich gegen einen anderen leeren String vergleichen liesse und
 * damit zwei kennungslose Shows fuer dieselbe hielte.
 */
export function showIdOf(project: unknown): string | null {
  if (!project || typeof project !== 'object') return null
  const meta = (project as { metadata?: unknown }).metadata
  if (!meta || typeof meta !== 'object') return null
  const id = (meta as { projectId?: unknown }).projectId
  return typeof id === 'string' && id.trim().length > 0 ? id : null
}

export interface ShowCheck {
  ok: boolean
  rejection: ShowRejection | null
  reason: string | null
  /** Die Show, die gerade freigegeben ist. */
  served: string | null
  /** Die Show, die der Rueckweg nennt. */
  sent: string | null
}

/**
 * Darf dieser Rueckweg auf die freigegebene Show gebucht werden?
 *
 * DIE ENGSTELLE. Alle drei Schreibwege fragen hier — und die Antwort ist nie
 * ein blosses Ja oder Nein, sondern traegt den Grund mit: eine abgewiesene
 * Rueckmeldung, die niemand erklaert, sieht am Handy aus wie ein Netzfehler,
 * und dann drueckt der Field-Tech noch dreimal.
 *
 * Ohne Kennung wird NICHT angenommen. Der Mobile-Client wird von genau diesem
 * Server ausgeliefert und schickt sie immer; wer sie weglaesst, ist entweder
 * ein von Hand gebauter Aufruf oder eine Seite, die seit dem Show-Wechsel
 * offen liegt. In beiden Faellen ist Zurueckweisen die richtige Antwort —
 * annehmen hiesse, im Zweifel in irgendein Projekt zu schreiben.
 */
export function showMismatch(served: string | null, sent: string | null): ShowCheck {
  const nein = (rejection: ShowRejection): ShowCheck => ({
    ok: false,
    rejection,
    reason: SHOW_REJECTION_REASON[rejection],
    served,
    sent,
  })
  if (served === null) return nein('no-show-served')
  if (sent === null) return nein('no-show-sent')
  if (served !== sent) return nein('other-show')
  return { ok: true, rejection: null, reason: null, served, sent }
}
