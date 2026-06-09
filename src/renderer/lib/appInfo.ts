/** Build-time app metadata. The constants are injected by Vite from
 *  `package.json` so the renderer can show them without an IPC round-
 *  trip. Falls back to safe defaults if the consts aren't defined (e.g.
 *  unit tests, story-book, or a stripped-down web build). */

const safe = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback

const tryGet = <T>(get: () => T, fallback: T): T => {
  try {
    return get()
  } catch {
    return fallback
  }
}

export const APP_VERSION = tryGet(() => safe(__APP_VERSION__, '0.0.0'), '0.0.0')
export const APP_DESCRIPTION = tryGet(
  () => safe(__APP_DESCRIPTION__, 'Cable Planner'),
  'Cable Planner',
)
export const APP_AUTHOR = tryGet(() => safe(__APP_AUTHOR__, ''), '')
export const APP_BUILD_DATE = tryGet(
  () => safe(__APP_BUILD_DATE__, new Date().toISOString()),
  new Date().toISOString(),
)

export const APP_REPO_URL = 'https://github.com/larszu/cable-planner'

/** Öffentliche Web-App (GitHub Pages) — Basis für teilbare Links wie den
 *  Live-Kollaborations-Einladungslink (#516). */
export const APP_WEB_URL = 'https://larszu.github.io/cable-planner/'
