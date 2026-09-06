import type { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { scheduleProjectAutosave } from '../projectAutosave'
import type { ProjectState } from '../projectStore'
import {
  DEFAULT_ENCODING,
  platformByKey,
  type DeliveryDestination,
} from '../../types/delivery'

/**
 * Initiative 9 — die Ausspielziele.
 *
 * ZWEI DINGE MACHT DIESER SLICE ANDERS ALS DIE ANDEREN, beide aus dem
 * Datenschutz-Teil des Objekts:
 *
 * 1. **Loeschen raeumt den Schluesselbund mit.** Ein Ziel zu entfernen und den
 *    Stream-Key liegen zu lassen hiesse, dass der Key des Kunden nach dem
 *    Projekt weiterlebt — an einer Stelle, an der ihn niemand mehr sucht.
 *    Der Store kann kein IPC; er ruft deshalb einen Ruecksteller auf, den die
 *    Oberflaeche setzt (`setStreamKeyDropper`). Ist keiner gesetzt (Test,
 *    Browser), wird nichts geloescht und auch nichts behauptet.
 * 2. **Backup-Zeiger sterben mit ihrem Ziel.** Wie bei den Rollen: ein
 *    Fehlzeiger sieht aus wie ein vorhandener Ausweichweg.
 */
export type DeliverySlice = Pick<
  ProjectState,
  'addDeliveryDestination' | 'updateDeliveryDestination' | 'removeDeliveryDestination'
>

/**
 * Wer den Stream-Key eines geloeschten Ziels aus dem Schluesselbund nimmt.
 *
 * Ein Modul-Zustand und kein Store-Feld: er gehoert der Laufzeit, nicht dem
 * Projekt, und im Projekt gespeichert waere er ein Funktionszeiger in einer
 * JSON-Datei.
 */
let dropStreamKey: ((destinationId: string) => void) | null = null

export const setStreamKeyDropper = (fn: ((destinationId: string) => void) | null): void => {
  dropStreamKey = fn
}

export const createDeliverySlice: StateCreator<ProjectState, [], [], DeliverySlice> = (set) => ({
  addDeliveryDestination: (dest) => {
    const name = dest.name?.trim()
    if (!name) return undefined
    const id = dest.id?.trim() || uuidv4()
    const platform = dest.platform ?? 'custom'
    const preset = platformByKey(platform)
    let created = false
    set((state) => {
      const existing = state.project.deliveryDestinations ?? []
      if (existing.some((d) => d.id === id)) {
        created = true
        return {}
      }
      const next: DeliveryDestination = {
        ...dest,
        id,
        name,
        platform,
        transport: dest.transport ?? preset?.transport ?? 'RTMP',
        // Die Ingest-URL der Plattform als Vorgabe — aber nur, wenn die
        // Plattform eine feste hat. Eine erfundene URL waere schlimmer als
        // ein leeres Feld: sie sieht aus wie eine Zusage.
        ...(dest.ingestUrl ?? preset?.ingestUrl ? { ingestUrl: dest.ingestUrl ?? preset?.ingestUrl } : {}),
        encoding: dest.encoding ?? { ...DEFAULT_ENCODING },
        hasStreamKey: false,
      }
      const updated = { ...state.project, deliveryDestinations: [...existing, next] }
      scheduleProjectAutosave(updated)
      created = true
      return { project: updated }
    })
    return created ? id : undefined
  },

  updateDeliveryDestination: (id, patch) =>
    set((state) => {
      const existing = state.project.deliveryDestinations ?? []
      if (!existing.some((d) => d.id === id)) return {}
      const next = existing.map((d) => {
        if (d.id !== id) return d
        const merged: DeliveryDestination = { ...d, ...patch, id: d.id }
        if (typeof merged.name === 'string' && merged.name.trim() === '') merged.name = d.name
        // Ein Ziel kann nicht sein eigenes Backup sein.
        if (merged.backupOfId === d.id) merged.backupOfId = undefined
        return merged
      })
      const updated = { ...state.project, deliveryDestinations: next }
      scheduleProjectAutosave(updated)
      return { project: updated }
    }),

  removeDeliveryDestination: (id) =>
    set((state) => {
      const existing = state.project.deliveryDestinations ?? []
      if (!existing.some((d) => d.id === id)) return {}
      const updated = {
        ...state.project,
        deliveryDestinations: existing
          .filter((d) => d.id !== id)
          .map((d) => (d.backupOfId === id ? { ...d, backupOfId: undefined } : d)),
      }
      scheduleProjectAutosave(updated)
      // Nach dem Zustandswechsel, damit ein werfender Ruecksteller den
      // Loeschvorgang nicht zurueckdreht: das Ziel ist weg, der Key soll es
      // auch sein, und ein fehlgeschlagenes Aufraeumen ist kein Grund, das
      // Ziel wieder auferstehen zu lassen.
      try {
        dropStreamKey?.(id)
      } catch {
        /* Der Schluesselbund kann fehlen (Browser, Linux ohne libsecret). */
      }
      return { project: updated }
    }),
})
