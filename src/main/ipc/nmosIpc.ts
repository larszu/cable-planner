// IPC-Domaene `nmos:*` (#1240, Stufe 6): eine IS-04-Registry einlesen.
//
// Zwei Wege, beide nur im Desktop:
//   - `nmos:open-file`  Dateidialog, eine JSON-Datei (Endung .json, hoechstens
//                       MAX_BYTES). Gelesen wird nur der im Dialog gewaehlte Pfad.
//   - `nmos:fetch-registry`  die Query API einer Registry (`/nodes`, `/devices`,
//                       `/senders`, `/receivers`, `/flows`). Die Adresse prueft
//                       `normalizeQueryApiUrl`; weitere Seiten nur auf demselben
//                       Ursprung, Zeit- und Groessengrenze je Abruf.
// Beide geben Text bzw. die Rohantworten zurueck; Auslegung und Vorschau
// macht der Renderer (`lib/nmos/importIs04.ts`). In den Plan kommt erst etwas,
// wenn der Planer die Vorschau bestaetigt.

import { dialog, ipcMain } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { NMOS_QUERY_RESOURCES, nextPageUrl, normalizeQueryApiUrl } from '../util/nmosQueryUrl.js'

const MAX_BYTES = 20 * 1024 * 1024
const MAX_PAGES = 50
const TIMEOUT_MS = 10_000

type Result<T> = { ok: true; value: T } | { ok: false; message: string }

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

const fetchAll = async (base: string, resource: string): Promise<unknown[]> => {
  const out: unknown[] = []
  let url: string | null = `${base}/${resource}?paging.limit=1000`
  let total = 0
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res: Response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`${resource}: HTTP ${res.status}`)
    const text = await res.text()
    total += text.length
    if (total > MAX_BYTES) throw new Error(`${resource}: response too large`)
    const body = JSON.parse(text) as unknown
    if (!Array.isArray(body)) throw new Error(`${resource}: expected a list`)
    out.push(...body)
    url = body.length ? nextPageUrl(res.headers.get('link'), base) : null
  }
  return out
}

export const registerNmosIpc = () => {
  ipcMain.handle('nmos:open-file', async (): Promise<Result<{ fileName: string; text: string }> | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'NMOS IS-04',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (canceled || filePaths.length === 0) return null
    const filePath = path.resolve(filePaths[0])
    try {
      if (path.extname(filePath).toLowerCase() !== '.json') throw new Error('Only .json files.')
      const info = await stat(filePath)
      if (!info.isFile()) throw new Error('Not a file.')
      if (info.size > MAX_BYTES) throw new Error('File too large.')
      return { ok: true, value: { fileName: path.basename(filePath), text: await readFile(filePath, 'utf-8') } }
    } catch (e) {
      return { ok: false, message: message(e) }
    }
  })

  ipcMain.handle('nmos:fetch-registry', async (_event, rawUrl: unknown): Promise<Result<{ url: string; resources: Record<string, unknown[]> }>> => {
    try {
      const base = normalizeQueryApiUrl(typeof rawUrl === 'string' ? rawUrl : '')
      const resources: Record<string, unknown[]> = {}
      for (const r of NMOS_QUERY_RESOURCES) resources[r] = await fetchAll(base, r)
      return { ok: true, value: { url: base, resources } }
    } catch (e) {
      return { ok: false, message: message(e) }
    }
  })
}
