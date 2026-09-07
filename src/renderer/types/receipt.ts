// ───────────────────────────────────────────────────────────────────────────
// BEDARF 97 — der Beleg, wie ihn die Oberflaeche sieht.
//
// Die Datei selbst liegt neben dem Projekt und wird von
// `src/main/services/receiptStore.ts` geschrieben; hier steht nur, was im
// Projekt-File davon uebrig bleibt: Hash, Name, relativer Pfad, Groesse,
// Zeitpunkte. KEINE BILDDATEN. Ein eingebettetes Foto machte jede
// Speicherung, jede Synchronisation und jeden Mailversand um dieses Foto
// teurer, und das Projekt traegt ohnehin schon den ganzen Plan.
//
// DIESE FELDER SIND EINE ABSCHRIFT von `ReceiptAttachment` in main. Main und
// Renderer teilen in dieser App keine Typen (main kennt `src/renderer/` nicht),
// deshalb steht die Form zweimal da — und deshalb prueft
// `tests/receiptStore.test.ts`, dass die beiden Fassungen dieselben Felder
// haben. Wer drueben eins ergaenzt und hier nicht, faellt dort auf.
// ───────────────────────────────────────────────────────────────────────────

/** Eine Belegdatei, die an einer Auslagenzeile haengt. */
export interface ReceiptAttachment {
  /** SHA-256 des Inhalts — die Identitaet des Belegs. */
  sha256: string
  /** Wie die Datei beim Nutzer hiess. Nur zur Anzeige. */
  fileName: string
  /** Pfad relativ zum Projektverzeichnis. Nie absolut. */
  storedAs: string
  mediaType: string
  bytes: number
  /** Wann sie angehaengt wurde (ISO). */
  addedAt: string
  /** Aufnahmezeitpunkt aus den Bilddaten, falls die Datei einen trug. */
  takenAt?: string
}

/** Warum eine Datei nicht als Beleg angenommen wurde. */
export type AttachRefusal =
  | 'no-project-path'
  | 'not-a-file'
  | 'too-large'
  | 'unsupported-type'
  | 'unreadable'
  | 'outside-project'

export const ATTACH_REFUSAL_LABEL: Readonly<Record<AttachRefusal, string>> = {
  'no-project-path': 'Das Projekt ist noch nicht gespeichert — es gibt keinen Ort für den Beleg.',
  'not-a-file': 'Das ist keine Datei.',
  'too-large': 'Die Datei ist größer als 25 MB.',
  'unsupported-type': 'Dieser Dateityp wird nicht als Beleg angenommen.',
  unreadable: 'Die Datei konnte nicht gelesen werden.',
  'outside-project': 'Der Zielort liegt nicht im Projektverzeichnis.',
}

export type AttachResult =
  | { ok: true; attachment: ReceiptAttachment }
  | { ok: false; reason: AttachRefusal }

export type ReceiptContent =
  | { ok: true; mediaType: string; base64: string; text?: string }
  | { ok: false; reason: 'no-project-path' | 'missing' | 'outside-project' | 'unreadable' }

export const RECEIPT_CONTENT_REFUSAL_LABEL: Readonly<
  Record<Exclude<ReceiptContent, { ok: true }>['reason'], string>
> = {
  'no-project-path': 'Das Projekt ist noch nicht gespeichert.',
  missing: 'Belegdatei nicht gefunden — der Ordner „Belege" fehlt neben dem Projekt.',
  'outside-project': 'Der Beleg liegt nicht im Projektverzeichnis.',
  unreadable: 'Die Belegdatei konnte nicht gelesen werden.',
}
