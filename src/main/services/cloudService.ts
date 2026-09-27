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
} from './cloudProjectsClient.js'
import { checkServerUrl, tokenStore } from './deviceLibraryService.js'

/**
 * Cloud-Projekte (#871) und Lese-Links (#870) im Desktop-Build.
 *
 * Laeuft im Main-Prozess aus denselben zwei Gruenden wie
 * `deviceLibraryService`: das Token verlaesst den Main-Prozess nicht, und die
 * Server-URL ist aenderbar (CSP des Fensters). Konto und Token SIND die der
 * Geraetebibliothek — wer dort angemeldet ist, ist es hier auch.
 *
 * Ein Kanal `cloud:call` mit fester Liste statt zwoelf Kanaelen: jede
 * Operation ist ein duenner Durchreicher auf `cloudProjectsClient.ts`, und die
 * Liste unten ist die einzige Stelle, die entscheidet, was der Renderer darf.
 */

export type CloudCallResult =
  | { ok: true; value: unknown }
  | { ok: false; code: string; status?: number; headRev?: number }

type Op = (server: string, token: string, ...args: never[]) => Promise<unknown>

const OPS: Record<string, Op> = {
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

export const cloudService = {
  async call(server: unknown, op: unknown, args: unknown): Promise<CloudCallResult> {
    const url = checkServerUrl(server)
    if (!url) return { ok: false, code: 'invalid-url' }
    if (typeof op !== 'string' || !Object.hasOwn(OPS, op) || !Array.isArray(args)) return { ok: false, code: 'invalid-call' }
    const token = await tokenStore.get()
    if (!token) return { ok: false, code: 'not-signed-in' }
    try {
      return { ok: true, value: await OPS[op](url, token, ...(args as never[])) }
    } catch (e) {
      // Ein Konflikt ist kein Fehler, sondern die Aufforderung zusammenzufuehren.
      if (e instanceof CloudConflict) return { ok: false, code: 'conflict', headRev: e.headRev }
      if (e instanceof CloudError) {
        if (e.code === 'not-signed-in') await tokenStore.clear()
        return { ok: false, code: e.code, status: e.status }
      }
      return { ok: false, code: 'server' }
    }
  },
}
