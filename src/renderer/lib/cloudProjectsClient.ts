// ───────────────────────────────────────────────────────────────────────────
// Cloud projects and share links — client (cable-planner #871, #870)
//
// Quelle: larszu/av-device-library, `clients/cloudProjectsClient.ts`. Liegt
// neben `deviceLibraryClient.ts` (gleiches Konto, gleiches Token) und wird
// wie dieser unveraendert in die Planner kopiert.
//
// Rein: nur `fetch`, keine Speicherung, keine Imports — die Datei laeuft
// unveraendert im Electron-Main (ESM, `.js`-Endungen) und im Renderer.
// ───────────────────────────────────────────────────────────────────────────

export type CloudPlanner = 'cable' | 'light' | 'multicam' | 'inventory' | 'intercom'

export type CloudErrorCode =
  | 'not-signed-in'
  | 'offline'
  | 'rate-limited'
  /** Plan groesser als der Server je Revision annimmt. */
  | 'project-too-large'
  /** Speicher des Kontos voll. */
  | 'quota-exceeded'
  | 'not-found'
  | 'server'

export class CloudError extends Error {
  code: CloudErrorCode
  status: number
  constructor(code: CloudErrorCode, status = 0) {
    super(code)
    this.code = code
    this.status = status
  }
}

export interface CloudProject {
  id: string
  planner: CloudPlanner
  name: string
  headRev: number
  createdAt: string
  updatedAt: string
}

export interface CloudRevision {
  rev: number
  createdAt: string
  device: string
  note: string
  size: number
  sha256: string
}

export interface CloudUsage {
  usedBytes: number
  quotaBytes: number
  maxProjectBytes: number
  keepRevisions: number
}

export interface ShareLink {
  id: string
  url: string
  /** null = zeigt immer die neueste Revision. */
  rev: number | null
  createdAt: string
  expiresAt: string | null
  lastOpenedAt: string | null
  opens: number
}

/** Antwort von `/api/public/share/<token>` — das liest der Web-Viewer. */
export interface SharedPlan {
  format: 'avplan-share'
  version: 1
  planner: CloudPlanner
  name: string
  rev: number
  savedAt: string
  data: Record<string, unknown>
}

/** Jemand hat zwischendurch gespeichert: erst zusammenfuehren, dann mit `headRev` erneut. */
export class CloudConflict extends Error {
  headRev: number
  constructor(headRev: number) {
    super('conflict')
    this.headRev = headRev
  }
}

type Methode = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function rufe<T>(server: string, token: string, methode: Methode, pfad: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${server.replace(/\/+$/, '')}/api${pfad}`, {
      method: methode,
      credentials: 'omit',
      headers: {
        authorization: `Bearer ${token}`,
        ...(methode !== 'GET' ? { 'x-requested-with': 'device-library' } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new CloudError('offline')
  }
  let json: Record<string, unknown> | null
  try {
    json = (await res.json()) as Record<string, unknown>
  } catch {
    json = null
  }
  if (res.ok) return json as T
  const code = String(json?.error ?? '')
  if (res.status === 409 && code === 'conflict') throw new CloudConflict(Number(json?.headRev))
  const known: CloudErrorCode[] = ['project-too-large', 'quota-exceeded', 'not-found']
  const c: CloudErrorCode = res.status === 401 ? 'not-signed-in'
    : res.status === 429 ? 'rate-limited'
      : (known as string[]).includes(code) ? (code as CloudErrorCode) : 'server'
  throw new CloudError(c, res.status)
}

export const cloudUsage = (server: string, token: string) => rufe<CloudUsage>(server, token, 'GET', '/cloud/usage')

export const listCloudProjects = (server: string, token: string) => rufe<CloudProject[]>(server, token, 'GET', '/cloud/projects')

export interface SaveInput {
  data: Record<string, unknown>
  /** Vom Planner vorberechnete Antworten seiner Lese-Werkzeuge (Remote-MCP). */
  digest?: Record<string, unknown>
  /** Welches Geraet gespeichert hat — steht in der Revisionsliste. */
  device?: string
  note?: string
}

export const createCloudProject = (server: string, token: string, planner: CloudPlanner, name: string, input: SaveInput) =>
  rufe<CloudProject>(server, token, 'POST', '/cloud/projects', { planner, name, ...input })

/** Wirft `CloudConflict`, wenn `baseRev` nicht mehr die neueste Revision ist. */
export const saveCloudRevision = (server: string, token: string, id: string, baseRev: number, input: SaveInput) =>
  rufe<{ rev: number; unchanged: boolean }>(server, token, 'POST', `/cloud/projects/${id}/revisions`, { baseRev, ...input })

export const listCloudRevisions = (server: string, token: string, id: string) =>
  rufe<CloudRevision[]>(server, token, 'GET', `/cloud/projects/${id}/revisions`)

export const getCloudRevision = (server: string, token: string, id: string, rev: number | 'head') =>
  rufe<{ projectId: string; name: string; rev: number; headRev: number; createdAt: string; sha256: string; data: Record<string, unknown> }>(
    server, token, 'GET', `/cloud/projects/${id}/revisions/${rev}`)

/** Stellt `rev` als neue Revision wieder her; die Geschichte bleibt. */
export const restoreCloudRevision = (server: string, token: string, id: string, rev: number, baseRev: number) =>
  rufe<{ rev: number }>(server, token, 'POST', `/cloud/projects/${id}/restore`, { rev, baseRev })

export const renameCloudProject = (server: string, token: string, id: string, name: string) =>
  rufe<CloudProject>(server, token, 'PATCH', `/cloud/projects/${id}`, { name })

/** Endgueltig: alle Revisionen und Links. */
export const deleteCloudProject = (server: string, token: string, id: string) =>
  rufe<{ ok: true }>(server, token, 'DELETE', `/cloud/projects/${id}`)

export const listShareLinks = (server: string, token: string, id: string) =>
  rufe<ShareLink[]>(server, token, 'GET', `/cloud/projects/${id}/links`)

export const createShareLink = (server: string, token: string, id: string, opts: { rev?: number | null; expiresInDays?: number | null } = {}) =>
  rufe<ShareLink>(server, token, 'POST', `/cloud/projects/${id}/links`, opts)

export const revokeShareLink = (server: string, token: string, linkId: string) =>
  rufe<{ ok: true }>(server, token, 'DELETE', `/cloud/links/${linkId}`)

/** Kurzlebige TURN-Zugangsdaten fuer die Live-Zusammenarbeit (#869); 404 = kein TURN. */
export interface TurnCredentials {
  ttl: number
  iceServers: { urls: string[]; username?: string; credential?: string }[]
}

export const turnCredentials = (server: string, token: string) => rufe<TurnCredentials>(server, token, 'GET', '/turn-credentials')
