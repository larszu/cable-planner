/**
 * `attachment:*` — Anhänge neben dem Projekt: Messprotokolle,
 * Herstellerunterlagen, Konfigurations-Sicherungen.
 *
 * Ein Plan, der eine Messung als „bestanden" führt, ohne dass das Protokoll
 * dazu auffindbar ist, belegt nichts; und die Herstellerunterlage, die der
 * Betreiber in fünf Jahren sucht, liegt dann auf dem Laptop des Errichters.
 * Die Dateien kommen deshalb in `Anhaenge/` neben das Projekt, und das
 * Projekt führt, welche Datei wozu gehört — dieselbe Form wie die Belege
 * (`receiptStore.ts`), über dieselbe Ablage (`util/projektAblage.ts`).
 *
 * ─── WAS ANDERS IST ALS BEI DEN BELEGEN ────────────────────────────────────
 *
 * Jede Endung wird angenommen. Ein Messgerät schreibt sein eigenes Format,
 * eine Konfigurations-Sicherung ist, was das Gerät eben ausgibt — eine Liste
 * erlaubter Endungen wäre hier die Liste der Formate, die wir heute kennen,
 * und lehnte morgen die Sicherung eines Geräts ab, das wir nicht kennen.
 *
 * Das ist vertretbar, weil die Datei NIE geöffnet wird: es gibt kein
 * `attachment:read` und kein `openPath`, nur `reveal` — den Dateimanager an
 * der Stelle. Ein fremder Inhalt wird so nicht ausgeführt, auch wenn jemand
 * eine ausführbare Datei als „Konfiguration" anhängt.
 *
 * 100 MB: ein Handbuch mit Bildern oder ein Messprotokoll-Export über ein
 * ganzes Gebäude liegt darunter, ein Firmware-Abbild nicht immer — das
 * gehört dann auch nicht in den Projektordner.
 */
import { stat } from 'node:fs/promises'
import { dateiAblegen, imProjektordner, type AblageAblehnung, type AblageRegel } from '../util/projektAblage.js'

export const ATTACHMENT_DIR = 'Anhaenge'

export const ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024

const BEKANNT: Readonly<Record<string, string>> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
}

const REGEL: AblageRegel = {
  ordner: ATTACHMENT_DIR,
  erlaubt: 'jede',
  bekannt: BEKANNT,
  maxBytes: ATTACHMENT_MAX_BYTES,
  ersatzName: 'anhang',
}

/** Die Datei eines Anhangs, wie sie ins Projekt geht. Abschrift in `src/renderer/types/anhang.ts`. */
export interface AttachmentFile {
  sha256: string
  fileName: string
  storedAs: string
  mediaType: string
  bytes: number
  addedAt: string
}

export type AttachmentResult = { ok: true; file: AttachmentFile } | { ok: false; reason: AblageAblehnung }

export const attachFile = async (
  projectPath: string | undefined,
  sourcePath: string,
  now: string,
): Promise<AttachmentResult> => {
  const r = await dateiAblegen(projectPath, sourcePath, now, REGEL)
  if (!r.ok) return r
  const { inhalt: _inhalt, ...file } = r.datei
  return { ok: true, file }
}

/**
 * Welche der gespeicherten Dateien heute da sind.
 *
 * Der Normalfall für „nicht da" ist ein Projekt, das ohne seinen Ordner
 * weitergegeben wurde. Die Oberfläche sagt das an der Zeile, statt einen
 * Anhang zu führen, hinter dem nichts liegt. Ein Pfad ausserhalb des
 * Projektordners gilt als nicht da — er wird nicht einmal angesehen.
 */
export const attachmentsPresent = async (
  projectPath: string | undefined,
  storedAs: readonly string[],
): Promise<Record<string, boolean>> => {
  const out: Record<string, boolean> = {}
  for (const rel of storedAs) {
    const abs = projectPath ? imProjektordner(projectPath, rel) : null
    out[rel] = abs ? await stat(abs).then((s) => s.isFile(), () => false) : false
  }
  return out
}
