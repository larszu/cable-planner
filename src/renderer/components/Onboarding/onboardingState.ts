import { STORAGE_KEYS } from '../../lib/storageKeys'

const TOUR_STORAGE_KEY = STORAGE_KEYS.tourSeenV1

/**
 * Persistence helpers for the onboarding tour. A `localStorage` flag is
 * written once the user finishes (or dismisses) the tour; `hasSeenTour`
 * gates the automatic first-launch opening.
 */
export const hasSeenTour = (): boolean => {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

export const markTourSeen = (): void => {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, '1')
  } catch {
    /* storage unavailable — skip */
  }
}
