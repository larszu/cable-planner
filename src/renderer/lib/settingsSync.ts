/**
 * #427 — Cross-Fenster-Sync der globalen Einstellungen (uiStore-Preferences +
 * settingsStore) über das native `storage`-Event.
 *
 * localStorage ist zwischen allen Fenstern derselben Origin geteilt; eine
 * Änderung in einem Fenster feuert in ALLEN anderen ein `storage`-Event (nie
 * im Auslöser selbst — daher kein Echo). So wirken Einstellungen aus einem
 * ausgelagerten Settings-Fenster sofort im Hauptfenster (Theme, Sprache,
 * Farben, Routing-Defaults …) und umgekehrt.
 *
 * Per-Fenster-Layout (Panel-Floating/-Breiten/-Collapse/-Positionen) wird
 * bewusst NICHT übernommen — sonst würde ein ausgelagertes Panel das Layout
 * des anderen Fensters erben und z. B. der Popout-Inhalt verschwinden.
 *
 * Wir wenden Remote-Werte per `setState` an (NICHT über die Store-Setter):
 * setState schreibt nicht zurück nach localStorage, also kein Ping-Pong.
 */
import { useUiStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { STORAGE_KEYS } from './storageKeys'

/** uiStore-Felder, die NUR pro Fenster gelten und nicht gesynct werden. */
const PER_WINDOW_UI_KEYS = new Set<string>([
  'propertiesCollapsed',
  'libraryCollapsed',
  'libraryWidth',
  'propertiesWidth',
  'libraryFloating',
  'libraryFloatingPos',
  'propertiesFloating',
  'propertiesFloatingPos',
  'annotationsPanelFloating',
  'annotationsPanelFloatingPos',
  'annotationsPanelOpen',
])

/** Aus settingsStore über localStorage synchronisierbare Felder. */
const SETTINGS_KEYS = ['autosaveIntervalMs', 'sharedSyncPath', 'sharedSyncUser'] as const

let started = false

export const initSettingsSync = (): void => {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('storage', (event) => {
    if (!event.newValue) return

    if (event.key === STORAGE_KEYS.ui) {
      try {
        const parsed = JSON.parse(event.newValue) as Record<string, unknown>
        const patch: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(parsed)) {
          if (!PER_WINDOW_UI_KEYS.has(k)) patch[k] = v
        }
        if (Object.keys(patch).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useUiStore.setState(patch as any)
        }
      } catch {
        /* defektes JSON ignorieren */
      }
      return
    }

    if (event.key === STORAGE_KEYS.settings) {
      try {
        const parsed = JSON.parse(event.newValue) as Record<string, unknown>
        const patch: Record<string, unknown> = {}
        for (const k of SETTINGS_KEYS) {
          if (k in parsed) patch[k] = parsed[k]
        }
        if (Object.keys(patch).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useSettingsStore.setState(patch as any)
        }
      } catch {
        /* defektes JSON ignorieren */
      }
    }
  })
}
