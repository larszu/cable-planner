import keytar from 'keytar'
import {
  LibraryError,
  currentUser,
  propose,
  signIn,
  signOut,
  sync,
  verifySecondFactor,
  type LibraryErrorCode,
  type LibraryUser,
  type ProposalCore,
  type SyncResponse,
} from './deviceLibraryClient.js'

/**
 * Geraetebibliothek (devices.zumpelars.de) im Desktop-Build.
 *
 * WARUM DER ABRUF HIER LAEUFT UND NICHT IM RENDERER. Zwei Gruende, beide
 * aus der Architektur dieses Repos:
 *
 *  * Das Token verlaesst den Main-Prozess nicht — dieselbe Regel wie beim
 *    NetBox-Token. Der Renderer erfaehrt nur, OB jemand angemeldet ist und
 *    wer; ein Geheimnis, das nie im Renderer liegt, kann dort auch nicht in
 *    ein Log, eine Projektdatei oder den Mobile-Viewer geraten.
 *  * Die Server-URL ist aenderbar. Die CSP des Fensters (`connect-src`) wird
 *    beim Laden gesetzt und kennt nur feste Ursprunge; ein Renderer-`fetch`
 *    an einen selbst gehosteten Server scheiterte daran still. Der
 *    Main-Prozess unterliegt keiner CSP, jede http(s)-URL funktioniert.
 *
 * `deviceLibraryClient.ts` daneben ist eine unveraenderte Kopie der Quelle
 * in larszu/av-device-library (dieselbe Datei liegt in `src/renderer/lib/`
 * fuer den Web-Build; `tests/deviceLibraryClientKopie.test.ts` haelt beide
 * gleich).
 */

const SERVICE_NAME = 'cable-planner'
/** Eigener Account: das Abmelden hier nimmt Rentman/NetBox nicht mit. */
const ACCOUNT_NAME = 'device-library-token'

export type DeviceLibraryResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: LibraryErrorCode | 'invalid-url'; status?: number; message?: string }

export type DeviceLibrarySignIn =
  | { kind: 'ok'; user: LibraryUser }
  | { kind: 'second-factor'; challenge: string }
  | { kind: 'error'; code: LibraryErrorCode | 'invalid-url'; message?: string }

/** Nur http(s) — eine `file:`- oder `javascript:`-URL aus den Einstellungen
 *  hat in einem ausgehenden Abruf des Main-Prozesses nichts zu suchen. */
export const checkServerUrl = (server: unknown): string | null => {
  if (typeof server !== 'string') return null
  try {
    const u = new URL(server.trim())
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '')
  } catch {
    return null
  }
}

const tokenStore = {
  get: () => keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME),
  set: (token: string) => keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token),
  clear: () => keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME),
}

/** Fehler aus dem Client in eine Antwort, die IPC unbeschadet uebersteht —
 *  ein geworfener `LibraryError` kaeme im Renderer ohne `code` an. */
const alsFehler = (e: unknown): DeviceLibraryResult<never> =>
  e instanceof LibraryError
    ? { ok: false, code: e.code, status: e.status, message: e.message === e.code ? undefined : e.message }
    : { ok: false, code: 'server' }

const mitToken = async <T>(
  server: unknown,
  f: (server: string, token: string) => Promise<T>,
): Promise<DeviceLibraryResult<T>> => {
  const url = checkServerUrl(server)
  if (!url) return { ok: false, code: 'invalid-url' }
  const token = await tokenStore.get()
  if (!token) return { ok: false, code: 'not-signed-in' }
  try {
    return { ok: true, value: await f(url, token) }
  } catch (e) {
    // Ein abgelaufenes oder widerrufenes Token wird vergessen: sonst hielte
    // die Oberflaeche jemanden fuer angemeldet, dessen Sitzung es nicht mehr gibt.
    if (e instanceof LibraryError && e.code === 'not-signed-in') await tokenStore.clear()
    return alsFehler(e)
  }
}

const nachAnmeldung = async (
  r: Awaited<ReturnType<typeof signIn>>,
): Promise<DeviceLibrarySignIn> => {
  if (r.kind !== 'ok') return r
  await tokenStore.set(r.token)
  return { kind: 'ok', user: r.user }
}

export const deviceLibraryService = {
  async hasToken(): Promise<boolean> {
    return Boolean(await tokenStore.get())
  },

  async signIn(server: unknown, login: unknown, password: unknown): Promise<DeviceLibrarySignIn> {
    const url = checkServerUrl(server)
    if (!url) return { kind: 'error', code: 'invalid-url' }
    if (typeof login !== 'string' || typeof password !== 'string') return { kind: 'error', code: 'wrong-credentials' }
    return nachAnmeldung(await signIn(url, login, password))
  },

  async verifySecondFactor(server: unknown, challenge: unknown, code: unknown): Promise<DeviceLibrarySignIn> {
    const url = checkServerUrl(server)
    if (!url) return { kind: 'error', code: 'invalid-url' }
    if (typeof challenge !== 'string' || typeof code !== 'string') return { kind: 'error', code: 'wrong-code' }
    return nachAnmeldung(await verifySecondFactor(url, challenge, code))
  },

  async currentUser(server: unknown): Promise<DeviceLibraryResult<LibraryUser | null>> {
    const r = await mitToken(server, (url, token) => currentUser(url, token))
    if (r.ok && r.value === null) await tokenStore.clear()
    return r
  },

  async signOut(server: unknown): Promise<void> {
    const url = checkServerUrl(server)
    const token = await tokenStore.get()
    if (url && token) await signOut(url, token)
    await tokenStore.clear()
  },

  sync(server: unknown, after: unknown): Promise<DeviceLibraryResult<SyncResponse>> {
    const n = typeof after === 'number' && Number.isFinite(after) ? after : 0
    return mitToken(server, (url, token) => sync(url, token, 'cable', n))
  },

  propose(
    server: unknown,
    core: ProposalCore,
    facet: Record<string, unknown>,
  ): Promise<DeviceLibraryResult<{ slug: string; state: string; findings?: unknown[] }>> {
    if (!core || typeof core !== 'object' || !facet || typeof facet !== 'object') {
      return Promise.resolve({ ok: false, code: 'server', message: 'invalid-proposal' })
    }
    return mitToken(server, (url, token) => propose(url, token, 'cable', core, facet))
  },
}
