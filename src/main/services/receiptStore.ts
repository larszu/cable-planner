/**
 * `receipt:*` — die Belegdatei zu einer Auslagenzeile.
 *
 * BEDARF 97, die Haelfte, die die Massnahme woertlich verlangt: „ATTACH THE
 * RECEIPT TO THE EXPENSE LINE, NOT THE PARENT". Der Beleg der Bedarfs-
 * Datenbank beschreibt genau den Gegenzustand: „Images attach to the parent
 * record, unlinked to the line" — ein Ordner voller Fotos am Vorgang, und
 * niemand weiss, welches Foto zu welcher Zahl gehoert. Genau dieser fehlende
 * Bezug ist der Grund, warum die Zahl im Streitfall nicht zu belegen ist.
 *
 * ─── WO DIE DATEI LIEGT, UND WARUM DORT ────────────────────────────────────
 *
 * Neben dem Projekt, in `Belege/`, NICHT im Projekt-File. Ein Foto von zwei
 * Megabyte in einer `.avplan` machte jede Speicherung, jede Synchronisation
 * und jeden Mailversand um dieses Foto langsamer — und die Datei traegt
 * ohnehin schon den ganzen Plan. Der Preis dieser Entscheidung steht in
 * `ReceiptAttachment.storedAs`: wer das Projekt ohne den Ordner weitergibt,
 * gibt die Belege nicht mit. Deshalb faellt eine fehlende Belegdatei auf
 * (`missing`) statt still zu verschwinden.
 *
 * ─── DER NAME IST DER INHALT ───────────────────────────────────────────────
 *
 * Gespeichert wird unter dem SHA-256 des Inhalts. Wer denselben Kassenzettel
 * zweimal anhaengt, hat eine Datei und nicht zwei — und zwei Zeilen, die
 * denselben Beleg nennen, sind dann sichtbar derselbe Beleg. Das ist zugleich
 * die Antwort auf den Doppel-Eintrag, den der Bedarf beschreibt („entered
 * three times").
 */
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { jpegTakenAt } from '../util/exifDate.js'
import { ablageZiel, dateiAblegen, imProjektordner, type AblageRegel } from '../util/projektAblage.js'

/** Der Ordner neben dem Projekt, in dem die Belege liegen. */
export const RECEIPT_DIR = 'Belege'

/** Womit dieser Speicher umgehen kann. Alles andere wird abgelehnt, nicht kopiert. */
const ERLAUBT: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
}

/**
 * 25 MB. Ein Handyfoto liegt bei zwei bis sechs; alles darueber ist kein
 * Kassenzettel mehr, und der Ordner neben dem Projekt ist kein Bildarchiv.
 */
export const MAX_BYTES = 25 * 1024 * 1024

export interface ReceiptAttachment {
  /** SHA-256 des Inhalts — die Identitaet des Belegs. */
  sha256: string
  /** Wie die Datei beim Nutzer hiess. Nur zur Anzeige. */
  fileName: string
  /** Pfad RELATIV zum Projektverzeichnis. Nie absolut: der gilt nur auf einem Rechner. */
  storedAs: string
  mediaType: string
  bytes: number
  /** Wann sie angehaengt wurde (ISO). */
  addedAt: string
  /** Aufnahmezeitpunkt aus den Bilddaten, falls die Datei einen trug. */
  takenAt?: string
}

export type AttachRefusal =
  | 'no-project-path'
  | 'not-a-file'
  | 'too-large'
  | 'unsupported-type'
  | 'unreadable'
  | 'outside-project'

export const ATTACH_REFUSAL_TEXT: Readonly<Record<AttachRefusal, string>> = {
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

const REGEL: AblageRegel = { ordner: RECEIPT_DIR, erlaubt: ERLAUBT, maxBytes: MAX_BYTES, ersatzName: 'beleg' }

/**
 * Den Zielpfad eines Belegs bilden — die EINZIGE Stelle, die das tut.
 *
 * Exportiert, weil `tests/receiptStore.test.ts` sie ohne Dateisystem prueft:
 * die Pfadbildung ist der sicherheitsrelevante Teil, und ein Test, der dafuer
 * erst Dateien anlegen muesste, wuerde seltener laufen.
 */
export const receiptTargetPath = (
  projectPath: string,
  sha256: string,
  fileName: string,
): { abs: string; rel: string } => ablageZiel(projectPath, RECEIPT_DIR, sha256, fileName, REGEL.ersatzName)

/**
 * Eine Datei als Beleg uebernehmen.
 *
 * Jede Pruefung passiert HIER, in main. Der Renderer schickt einen Pfad und
 * bekommt entweder einen Anhang oder eine benannte Ablehnung zurueck — er
 * entscheidet nichts ueber Pfade, Groessen oder Typen. Das ist die Repo-Regel
 * („Pfad-Validierung passiert immer in main") und hier besonders ernst: der
 * Quellpfad kommt aus einem Dateidialog, der Zielname aus dem Dateinamen des
 * Nutzers.
 */
export const attachReceipt = async (
  projectPath: string | undefined,
  sourcePath: string,
  now: string,
): Promise<AttachResult> => {
  // Pfadbildung, Grenze zum Projektordner und atomares Schreiben liegen in
  // `util/projektAblage.ts` — gemeinsam mit der Anhänge-Ablage, damit es die
  // sicherheitsrelevante Stelle nur einmal gibt.
  const r = await dateiAblegen(projectPath, sourcePath, now, REGEL)
  if (!r.ok) return r
  const { inhalt, ...datei } = r.datei
  const takenAt = datei.mediaType === 'image/jpeg' ? jpegTakenAt(inhalt) : undefined
  return { ok: true, attachment: { ...datei, ...(takenAt ? { takenAt } : {}) } }
}

export type ReceiptContent =
  | { ok: true; mediaType: string; base64: string; text?: string }
  | { ok: false; reason: 'no-project-path' | 'missing' | 'outside-project' | 'unreadable' }

/**
 * Einen Beleg zurueckholen — zur Anzeige und, bei Text, zum Einlesen.
 *
 * `missing` ist ein eigener Fall und keine Panne: es ist der erwartbare
 * Zustand, wenn ein Projekt ohne seinen `Belege/`-Ordner weitergereicht
 * wurde. Die Oberflaeche sagt dann „Belegdatei nicht gefunden" statt eines
 * leeren Rahmens, der wie ein Fehler in der App aussieht.
 */
export const readReceiptFile = async (
  projectPath: string | undefined,
  storedAs: string,
): Promise<ReceiptContent> => {
  if (!projectPath) return { ok: false, reason: 'no-project-path' }
  const abs = imProjektordner(projectPath, storedAs)
  if (!abs) return { ok: false, reason: 'outside-project' }
  try {
    const s = await stat(abs)
    if (!s.isFile()) return { ok: false, reason: 'missing' }
    if (s.size > MAX_BYTES) return { ok: false, reason: 'unreadable' }
  } catch {
    return { ok: false, reason: 'missing' }
  }
  try {
    const inhalt = await readFile(abs)
    const mediaType = ERLAUBT[path.extname(abs).toLowerCase()] ?? 'application/octet-stream'
    return {
      ok: true,
      mediaType,
      base64: inhalt.toString('base64'),
      ...(mediaType === 'text/plain' ? { text: inhalt.toString('utf-8') } : {}),
    }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}
