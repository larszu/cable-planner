import {
  CloudConflict,
  CloudError,
  cloudUsage,
  createCloudProject,
  createShareLink,
  deleteCloudProject,
  getCloudRevision,
  listCloudProjects,
  listCloudRevisions,
  listShareLinks,
  renameCloudProject,
  restoreCloudRevision,
  revokeShareLink,
  saveCloudRevision,
  turnCredentials,
} from './cloudProjectsClient'
import { normalizeServerUrl } from './deviceLibraryUrl'
import { STORAGE_KEYS } from './storageKeys'

/** Antwort ueber die Bruecke; Fehler als Code, weil IPC Ausnahmen entkernt. */
export type CloudCallResult =
  | { ok: true; value: unknown }
  | { ok: false; code: string; status?: number; headRev?: number }

export interface CloudBridge {
  call: (server: string, op: string, args: unknown[]) => Promise<CloudCallResult>
}

type Op = (server: string, token: string, ...args: never[]) => Promise<unknown>

/** Muss dieselbe Liste sein wie in `src/main/services/cloudService.ts`. */
export const CLOUD_OPS: Record<string, Op> = {
  usage: cloudUsage,
  list: listCloudProjects,
  create: createCloudProject as Op,
  save: saveCloudRevision as Op,
  revisions: listCloudRevisions as Op,
  revision: getCloudRevision as Op,
  restore: restoreCloudRevision as Op,
  rename: renameCloudProject as Op,
  remove: deleteCloudProject as Op,
  links: listShareLinks as Op,
  createLink: createShareLink as Op,
  revokeLink: revokeShareLink as Op,
  turn: turnCredentials,
}

/**
 * Cloud-Projekte im Browser-Build: dasselbe Token wie die Geraetebibliothek
 * (`deviceLibraryWeb`), unter demselben localStorage-Schluessel. Gegenstueck
 * im Desktop: `src/main/services/cloudService.ts`.
 */
export function createWebCloudApi(storage: () => Pick<Storage, 'getItem' | 'removeItem'> | null = () => globalThis.localStorage ?? null): CloudBridge {
  const key = STORAGE_KEYS.deviceLibraryWebToken
  return {
    async call(server, op, args) {
      const url = normalizeServerUrl(server)
      if (!url) return { ok: false, code: 'invalid-url' }
      if (!Object.hasOwn(CLOUD_OPS, op)) return { ok: false, code: 'invalid-call' }
      let token: string | null
      try {
        token = storage()?.getItem(key) ?? null
      } catch {
        token = null
      }
      if (!token) return { ok: false, code: 'not-signed-in' }
      try {
        return { ok: true, value: await CLOUD_OPS[op](url, token, ...(args as never[])) }
      } catch (e) {
        if (e instanceof CloudConflict) return { ok: false, code: 'conflict', headRev: e.headRev }
        if (e instanceof CloudError) {
          if (e.code === 'not-signed-in') {
            try {
              storage()?.removeItem(key)
            } catch {
              // nichts zu tun
            }
          }
          return { ok: false, code: e.code, status: e.status }
        }
        return { ok: false, code: 'server' }
      }
    },
  }
}
