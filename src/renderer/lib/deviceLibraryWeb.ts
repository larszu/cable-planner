import {
  LibraryError,
  currentUser,
  propose,
  signIn,
  signOut,
  sync,
  verifySecondFactor,
  type SignInResult,
} from './deviceLibraryClient'
import { normalizeServerUrl } from './deviceLibraryUrl'
import { STORAGE_KEYS } from './storageKeys'
import type { DeviceLibraryApi, DeviceLibraryResult, DeviceLibrarySignIn } from '../types/deviceLibrary'

/**
 * Geraetebibliothek im Browser-Build (`webFallbackApi`).
 *
 * Es gibt keinen Schluesselbund; das Token liegt unter einem EIGENEN
 * localStorage-Schluessel und nur dort — nie im Projekt, nie im Log. Der
 * Abruf laeuft direkt aus der Seite; der Server erlaubt CORS fuer alle
 * Ursprunge ohne Cookies. Das Gegenstueck im Desktop ist
 * `src/main/services/deviceLibraryService.ts`.
 */

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function createWebDeviceLibraryApi(storage: () => KeyValueStorage | null = () => globalThis.localStorage ?? null): DeviceLibraryApi {
  const key = STORAGE_KEYS.deviceLibraryWebToken
  const tokenStore = {
    get: () => {
      try {
        return storage()?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    set: (token: string) => {
      try {
        storage()?.setItem(key, token)
      } catch {
        // Speicher gesperrt: die Anmeldung gilt dann nur bis zum Neuladen.
      }
    },
    clear: () => {
      try {
        storage()?.removeItem(key)
      } catch {
        // nichts zu tun
      }
    },
  }

  const alsFehler = (e: unknown): DeviceLibraryResult<never> =>
    e instanceof LibraryError
      ? { ok: false, code: e.code, status: e.status, message: e.message === e.code ? undefined : e.message }
      : { ok: false, code: 'server' }

  const mitToken = async <T>(server: string, f: (url: string, token: string) => Promise<T>): Promise<DeviceLibraryResult<T>> => {
    const url = normalizeServerUrl(server)
    if (!url) return { ok: false, code: 'invalid-url' }
    const token = tokenStore.get()
    if (!token) return { ok: false, code: 'not-signed-in' }
    try {
      return { ok: true, value: await f(url, token) }
    } catch (e) {
      if (e instanceof LibraryError && e.code === 'not-signed-in') tokenStore.clear()
      return alsFehler(e)
    }
  }

  const nachAnmeldung = (r: SignInResult): DeviceLibrarySignIn => {
    if (r.kind !== 'ok') return r
    tokenStore.set(r.token)
    return { kind: 'ok', user: r.user }
  }

  return {
    hasToken: async () => Boolean(tokenStore.get()),
    signIn: async (server, login, password) => {
      const url = normalizeServerUrl(server)
      if (!url) return { kind: 'error', code: 'invalid-url' }
      return nachAnmeldung(await signIn(url, login, password))
    },
    verifySecondFactor: async (server, challenge, code) => {
      const url = normalizeServerUrl(server)
      if (!url) return { kind: 'error', code: 'invalid-url' }
      return nachAnmeldung(await verifySecondFactor(url, challenge, code))
    },
    currentUser: async (server) => {
      const r = await mitToken(server, (url, token) => currentUser(url, token))
      if (r.ok && r.value === null) tokenStore.clear()
      return r
    },
    signOut: async (server) => {
      const url = normalizeServerUrl(server)
      const token = tokenStore.get()
      if (url && token) await signOut(url, token)
      tokenStore.clear()
    },
    sync: (server, after) => mitToken(server, (url, token) => sync(url, token, 'cable', after)),
    propose: (server, core, facet) => mitToken(server, (url, token) => propose(url, token, 'cable', core, facet)),
  }
}
