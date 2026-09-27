/**
 * Dateien NEBEN dem Projekt ablegen — die eine Stelle, die das tut.
 *
 * Zwei Ablagen nutzen sie: `Belege/` für Auslagen (`receiptStore.ts`,
 * Bedarf 97) und `Anhaenge/` für Messprotokolle, Herstellerunterlagen und
 * Konfigurations-Sicherungen (`attachmentStore.ts`). Bis 2026-09-27 gab es
 * nur die erste, und die Pfadbildung stand in ihr. Eine zweite Ablage mit
 * eigener Kopie davon wäre genau die Stelle, an der eine Lockerung in der
 * einen Fassung nachgezogen wird und in der anderen nicht — und diese Stelle
 * entscheidet, ob ein Dateiname aus der Hand des Nutzers den Projektordner
 * verlassen kann.
 *
 * Was hier gilt, gilt für beide:
 *
 *   - Der Name ist der Inhalt: gespeichert wird unter dem SHA-256-Präfix plus
 *     bereinigtem Dateinamen. Dieselben Bytes zweimal angehängt ergeben eine
 *     Datei.
 *   - Der Zielpfad wird aus einem bereinigten Namen gebaut UND danach noch
 *     einmal dagegen geprüft, dass er im Projektverzeichnis liegt.
 *   - Relativ gespeichert, nie absolut: ein absoluter Pfad gilt nur auf einem
 *     Rechner.
 *   - Geschrieben wird atomar, und eine schon vorhandene Datei gleicher Größe
 *     unter demselben Hash wird nicht noch einmal geschrieben.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { atomicWriteFile } from './atomicWrite.js'

export type AblageAblehnung =
  | 'no-project-path'
  | 'not-a-file'
  | 'too-large'
  | 'unsupported-type'
  | 'unreadable'
  | 'outside-project'

export interface AblageRegel {
  /** Der Ordner neben dem Projekt. ASCII — ein Umlaut kommt zwischen macOS und Linux verschieden normalisiert an. */
  ordner: string
  /**
   * Endung → Medientyp. `jede` nimmt jede Endung an und nennt unbekannte
   * `application/octet-stream` — nur für Ablagen, deren Dateien nie
   * geöffnet, sondern höchstens im Dateimanager gezeigt werden.
   */
  erlaubt: Readonly<Record<string, string>> | 'jede'
  maxBytes: number
  /** Name, wenn vom bereinigten Dateinamen nichts übrig bleibt. */
  ersatzName: string
  /** Bekannte Medientypen, wenn `erlaubt` = `jede`. */
  bekannt?: Readonly<Record<string, string>>
}

export interface AbgelegteDatei {
  sha256: string
  fileName: string
  storedAs: string
  mediaType: string
  bytes: number
  addedAt: string
  /** Der Inhalt — für Auswertungen, die main daran noch macht. Geht nicht an den Renderer. */
  inhalt: Buffer
}

/** Alles, was Windows oder POSIX im Dateinamen verbieten, fällt heraus. */
export const sichererName = (roh: string, ersatz: string): string => {
  const sauber = path
    .basename(roh)
    .replace(/[^\p{L}\p{N}._+-]/gu, '_')
    .replace(/^[._]+/, '')
  return sauber.slice(-80) || ersatz
}

export const ablageZiel = (
  projectPath: string,
  ordner: string,
  sha256: string,
  fileName: string,
  ersatz: string,
): { abs: string; rel: string } => {
  const dir = path.dirname(path.resolve(projectPath))
  const rel = path.posix.join(ordner, `${sha256.slice(0, 12)}-${sichererName(fileName, ersatz)}`)
  return { abs: path.resolve(dir, rel), rel }
}

/** Der absolute Pfad zu `rel`, wenn er im Projektverzeichnis liegt — sonst `null`. */
export const imProjektordner = (projectPath: string, rel: string): string | null => {
  const projektDir = path.dirname(path.resolve(projectPath))
  const abs = path.resolve(projektDir, rel)
  return abs.startsWith(projektDir + path.sep) ? abs : null
}

export const medientyp = (regel: AblageRegel, datei: string): string | undefined => {
  const endung = path.extname(datei).toLowerCase()
  if (regel.erlaubt === 'jede') return regel.bekannt?.[endung] ?? 'application/octet-stream'
  return regel.erlaubt[endung]
}

export const dateiAblegen = async (
  projectPath: string | undefined,
  sourcePath: string,
  now: string,
  regel: AblageRegel,
): Promise<{ ok: true; datei: AbgelegteDatei } | { ok: false; reason: AblageAblehnung }> => {
  if (!projectPath) return { ok: false, reason: 'no-project-path' }
  const quelle = path.resolve(sourcePath)
  const mediaType = medientyp(regel, quelle)
  if (!mediaType) return { ok: false, reason: 'unsupported-type' }
  let groesse: number
  try {
    const s = await stat(quelle)
    if (!s.isFile()) return { ok: false, reason: 'not-a-file' }
    groesse = s.size
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  if (groesse > regel.maxBytes) return { ok: false, reason: 'too-large' }
  let inhalt: Buffer
  try {
    inhalt = await readFile(quelle)
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  const sha256 = createHash('sha256').update(inhalt).digest('hex')
  const fileName = sichererName(path.basename(quelle), regel.ersatzName)
  const { abs, rel } = ablageZiel(projectPath, regel.ordner, sha256, fileName, regel.ersatzName)
  if (imProjektordner(projectPath, rel) !== abs) return { ok: false, reason: 'outside-project' }
  try {
    await mkdir(path.dirname(abs), { recursive: true })
    const schonDa = await stat(abs).then(
      (s) => s.isFile() && s.size === groesse,
      () => false,
    )
    if (!schonDa) await atomicWriteFile(abs, inhalt, { backup: false })
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
  return {
    ok: true,
    datei: { sha256, fileName, storedAs: rel, mediaType, bytes: groesse, addedAt: now, inhalt },
  }
}
