import type { CablePlannerProject } from '../types/project'
import { useSettingsStore } from './settingsStore'
import { STORAGE_KEYS } from '../lib/storageKeys'

/**
 * #308 — Project-Autosave aus projectStore ausgelagert. Module-level
 * Timer-State sorgt fuer Debouncing ueber alle Slices hinweg — ein
 * single timer pro Tab. Auto-save delay liest live aus dem settingsStore.
 */

const PROJECT_AUTOSAVE_KEY = STORAGE_KEYS.projectAutosave

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

export const scheduleProjectAutosave = (project: CablePlannerProject) => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  const delay = useSettingsStore.getState().autosaveIntervalMs || 400
  autosaveTimer = setTimeout(() => {
    try {
      localStorage.setItem(PROJECT_AUTOSAVE_KEY, JSON.stringify(project))
    } catch {
      /* quota errors are non-fatal */
    }
  }, delay)
}
