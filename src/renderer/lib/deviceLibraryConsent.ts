// ───────────────────────────────────────────────────────────────────────────
// ZUSTIMMUNG ZUM HOCHLADEN (Geraetebibliothek)
//
// WARUM ES DAS GIBT. Das automatische Hochladen war an, sobald jemand
// angemeldet war — ohne dass er je gefragt wurde, ob seine eigenen Vorlagen
// an einen fremden Server gehen duerfen. Fuer den Betreiber des Servers ist
// das richtig („alle Daten sollen in der Bibliothek sein"), fuer den Nutzer
// einer Installation ist es eine Datenweitergabe hinter seinem Ruecken:
// Vorlagen tragen Geraetenamen, Anschlussbeschriftungen und Datenblattlinks,
// und wer in einem Haus plant, hat darin die Benennungen dieses Hauses.
//
// Jetzt gilt: HERUNTERLADEN immer (das sind fremde Daten, die hereinkommen),
// HOCHLADEN nur nach einer ausdruecklichen Zustimmung. Die Zustimmung ist
// versioniert — aendert sich, WAS hochgeht, wird neu gefragt, statt eine
// alte Entscheidung auf einen neuen Umfang anzuwenden.
//
// WAS DER DIALOG SAGEN MUSS, steht hier und nicht in der Oberflaeche: der
// Text IST die Zustimmung, und wenn er in einer Komponente liegt, aendert
// ihn irgendwann jemand, ohne die Version zu erhoehen.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Erhoehen, sobald sich der UMFANG des Hochladens aendert — ein neues Feld in
 * der Facette, ein zweiter Empfaenger, ein anderer Vorgabe-Server. Nicht fuer
 * eine Rechtschreibkorrektur im Text.
 */
export const UPLOAD_CONSENT_VERSION = '2026-11-11'

export interface UploadConsent {
  /** Die Fassung, der zugestimmt wurde. */
  version: string
  /** Wann (ISO). Steht im Dialog, damit die Entscheidung nachvollziehbar ist. */
  at: string
}

/** Gilt die Zustimmung fuer den heutigen Umfang? */
export const consentCurrent = (c: UploadConsent | null): boolean => !!c && c.version === UPLOAD_CONSENT_VERSION

/**
 * Was hochgeht, Punkt fuer Punkt — und was nicht. Die Liste ist der Inhalt
 * des Dialogs; `deviceLibraryItem.ts` (`coreAus`/`facetAus`) und der Server
 * (`sanitizeDeviceData`) muessen dazu passen.
 */
export const CONSENT_SENDS: { key: string; en: string }[] = [
  { key: 'deviceLibrary.consent.sends.identity', en: 'Manufacturer, model, category and description of the template' },
  { key: 'deviceLibrary.consent.sends.ports', en: 'Its ports: label, signal type, connector, direction, gender, function, number, group' },
  { key: 'deviceLibrary.consent.sends.specs', en: 'Power draw, rack units, weight and the datasheet link' },
  { key: 'deviceLibrary.consent.sends.account', en: 'Your user name on the library, next to every entry and every change' },
]

export const CONSENT_KEEPS: { key: string; en: string }[] = [
  { key: 'deviceLibrary.consent.keeps.plans', en: 'No plans, no projects, no cabling — a template is a device type, not your installation' },
  { key: 'deviceLibrary.consent.keeps.secrets', en: 'No passwords, no IP addresses, no stream keys: the server strips them before storing' },
  { key: 'deviceLibrary.consent.keeps.inventory', en: 'No Rentman or NetBox ids, no serial numbers, no inventory of your house' },
  { key: 'deviceLibrary.consent.keeps.rentman', en: 'Nothing that came from Rentman: those templates belong to your rental stock, not to the public library' },
]
