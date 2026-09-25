import { DEFAULT_DEVICE_LIBRARY_URL } from './deviceLibraryClient'

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
