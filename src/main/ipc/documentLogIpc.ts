/**
 * `documentLog:*` — das Register der ausgegebenen Dokumente.
 *
 * Eigene Domaene nach der Repo-Konvention (ein Channel = eine Domaene). Der
 * Renderer haelt das Register nicht selbst: es ueberdauert die Sitzung und
 * gehoert damit auf die Platte, und Datei-I/O laeuft in dieser App immer
 * ueber main.
 */
import { ipcMain } from 'electron'
import {
  appendDocumentLog,
  clearDocumentLog,
  readDocumentLog,
  type DocumentLogEntry,
} from '../services/documentLog.js'

/** Was der Renderer schicken darf — nur diese Felder, nur als Strings. */
const sanitize = (raw: unknown): DocumentLogEntry | null => {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() !== '' ? v : undefined
  const docId = str(e.docId)
  const stand = str(e.stand)
  const emittedAt = str(e.emittedAt)
  if (!docId || !stand || !emittedAt) return null
  return {
    docId,
    label: str(e.label) ?? docId,
    stand,
    emittedAt,
    project: str(e.project) ?? '',
    ...(str(e.projectPath) ? { projectPath: str(e.projectPath) } : {}),
  }
}

export const registerDocumentLogIpc = () => {
  ipcMain.handle('documentLog:read', () => readDocumentLog())

  ipcMain.handle('documentLog:append', async (_event, entry: unknown) => {
    const clean = sanitize(entry)
    // Ein unbrauchbarer Eintrag wird NICHT halb geschrieben. Ein Register mit
    // Luecken-Eintraegen waere schlimmer als eins ohne den Eintrag: es sieht
    // vollstaendig aus.
    if (!clean) return readDocumentLog()
    return appendDocumentLog(clean)
  })

  ipcMain.handle('documentLog:clear', () => clearDocumentLog())
}
