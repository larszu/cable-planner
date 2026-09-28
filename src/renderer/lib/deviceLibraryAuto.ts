// ───────────────────────────────────────────────────────────────────────────
// Geraetebibliothek — automatisch hoch und runter.
//
// Beim Start und nach jeder Aenderung an der eigenen Bibliothek (entprellt):
// erst hochladen, was sich geaendert hat, dann abgleichen. Nur mit
// eingeschalteter Einstellung und nur angemeldet. Nur im Hauptfenster —
// ein ausgelagertes Panel teilt denselben Speicher und saehe dieselbe
// Aenderung, es wuerde doppelt senden.
// ───────────────────────────────────────────────────────────────────────────
import { effectiveServer } from './deviceLibraryUrl'
import { useSettingsStore } from '../store/settingsStore'
import { useProjectStore } from '../store/projectStore'
import { useDeviceLibraryStore } from '../store/deviceLibraryStore'

/** Lang genug, dass eine Reihe von Aenderungen (Ports anlegen, umbenennen)
 *  ein einziges Hochladen ergibt; der Server zaehlt Anfragen je Stunde. */
export const AUTO_SYNC_ENTPRELLUNG_MS = 5000

const angemeldet = () => {
  const s = useDeviceLibraryStore.getState().session
  return s === 'signed-in' || s === 'unverified'
}

/** Einmal hoch und runter, wenn eingeschaltet und angemeldet. */
export function autoSyncJetzt(): Promise<void> {
  const settings = useSettingsStore.getState()
  if (!settings.deviceLibraryAutoUpload || !angemeldet()) return Promise.resolve()
  const server = effectiveServer(settings.deviceLibraryUrl)
  return useDeviceLibraryStore.getState().syncNow(server, useProjectStore.getState().customLibrary)
}

let gestartet = false

export function startDeviceLibraryAutoSync(): () => void {
  if (gestartet) return () => {}
  gestartet = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const server = effectiveServer(useSettingsStore.getState().deviceLibraryUrl)
  void useDeviceLibraryStore
    .getState()
    .refreshSession(server)
    .then(autoSyncJetzt)
  const ab = useProjectStore.subscribe((s, prev) => {
    if (s.customLibrary === prev.customLibrary) return
    clearTimeout(timer)
    timer = setTimeout(() => void autoSyncJetzt(), AUTO_SYNC_ENTPRELLUNG_MS)
  })
  return () => {
    clearTimeout(timer)
    ab()
    gestartet = false
  }
}
