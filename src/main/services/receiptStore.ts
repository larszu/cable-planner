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
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteFile } from '../util/atomicWrite.js'
import { jpegTakenAt } from '../util/exifDate.js'

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

/** Alles, was Windows oder POSIX im Dateinamen verbieten, faellt heraus. */
const sicherName = (roh: string): string => {
  const sauber = path
    .basename(roh)
    .replace(/[^\p{L}\p{N}._+-]/gu, '_')
    .replace(/^[._]+/, '')
  return sauber.slice(-80) || 'beleg'
}

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
): { abs: string; rel: string } => {
  const dir = path.dirname(path.resolve(projectPath))
  const rel = path.posix.join(RECEIPT_DIR, `${sha256.slice(0, 12)}-${sicherName(fileName)}`)
  return { abs: path.resolve(dir, rel), rel }
}

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
  if (!projectPath) return { ok: false, reason: 'no-project-path' }
  const quelle = path.resolve(sourcePath)
  const endung = path.extname(quelle).toLowerCase()
  const mediaType = ERLAUBT[endung]
  if (!mediaType) return { ok: false, reason: 'unsupported-type' }
  let groesse: number
  try {
    const s = await stat(quelle)
    if (!s.isFile()) return { ok: false, reason: 'not-a-file' }
    groesse = s.size
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  if (groesse > MAX_BYTES) return { ok: false, reason: 'too-large' }
  let inhalt: Buffer
  try {
    inhalt = await readFile(quelle)
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  const sha256 = createHash('sha256').update(inhalt).digest('hex')
  const fileName = sicherName(path.basename(quelle))
  const { abs, rel } = receiptTargetPath(projectPath, sha256, fileName)
  const projektDir = path.dirname(path.resolve(projectPath))
  // Guertel und Hosentraeger: der Zielpfad wird aus einem bereinigten Namen
  // gebaut UND danach noch einmal dagegen geprueft, dass er im
  // Projektverzeichnis liegt. Wer die Bereinigung eines Tages lockert, faellt
  // hier auf und nicht erst beim Nutzer.
  if (!abs.startsWith(projektDir + path.sep)) return { ok: false, reason: 'outside-project' }
  try {
    await mkdir(path.dirname(abs), { recursive: true })
    // Liegt der Beleg schon da, liegt er unter seinem Inhalts-Hash — es sind
    // dieselben Bytes. Ihn noch einmal zu schreiben brauechte Zeit und legte
    // eine `.bak` an, die eine Kopie derselben Datei waere.
    const schonDa = await stat(abs).then(
      (s) => s.isFile() && s.size === groesse,
      () => false,
    )
    if (!schonDa) await atomicWriteFile(abs, inhalt, { backup: false })
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  const takenAt = mediaType === 'image/jpeg' ? jpegTakenAt(inhalt) : undefined
  return {
    ok: true,
    attachment: {
      sha256,
      fileName,
      storedAs: rel,
      mediaType,
      bytes: groesse,
      addedAt: now,
      ...(takenAt ? { takenAt } : {}),
    },
  }
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
  const projektDir = path.dirname(path.resolve(projectPath))
  const abs = path.resolve(projektDir, storedAs)
  if (!abs.startsWith(projektDir + path.sep)) return { ok: false, reason: 'outside-project' }
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
