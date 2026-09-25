import { DEFAULT_DEVICE_LIBRARY_URL } from './deviceLibraryClient'

/** Die Richtlinien-Seite der Bibliothek. Der Client kennt keinen Helfer dafuer;
 *  der Pfad ist derselbe, auf den die Website selbst verlinkt. */
export const guidelinesUrl = (server: string): string => `${server.replace(/\/+$/, '')}/guidelines`

/** Leere Einstellung = Vorgabe-Server. So spricht jeder Build ohne jede
 *  Einstellung `DEFAULT_DEVICE_LIBRARY_URL` an. */
export const effectiveServer = (setting: string | undefined | null): string =>
  normalizeServerUrl(setting ?? '') ?? DEFAULT_DEVICE_LIBRARY_URL

/** Nur http(s); ohne abschliessenden Schraegstrich. `null` = unbrauchbar. */
export function normalizeServerUrl(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  try {
    const u = new URL(s)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return `${u.origin}${u.pathname}`.replace(/\/+$/, '')
  } catch {
    return null
  }
}
