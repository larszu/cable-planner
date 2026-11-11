// ───────────────────────────────────────────────────────────────────────────
// Geraetebibliothek — automatisch runter, und nur mit Zustimmung hoch.
//
// ZWEI RICHTUNGEN, ZWEI REGELN. Sie werden gern verwechselt, haben aber
// nichts miteinander zu tun:
//
//  * HERUNTER (Gemeinschaftsgeraete holen) laeuft von selbst, sobald jemand
//    angemeldet ist: beim Start und danach in grossem Abstand. Dabei kommen
//    fremde Daten herein, es gehen keine hinaus — eine Zustimmung waere
//    sinnlos, und ohne regelmaessiges Holen waere die Bibliothek ein
//    Einmal-Import, der langsam veraltet.
//  * HOCH (eigene Vorlagen) nur mit ausdruecklicher, versionierter
//    Zustimmung (`deviceLibraryConsent.ts`) UND eingeschalteter Einstellung.
//    Vorher war das Hochladen an, sobald jemand angemeldet war; gefragt
//    wurde nie.
//
// Nur im Hauptfenster — ein ausgelagertes Panel teilt denselben Speicher und
// saehe dieselbe Aenderung, es wuerde doppelt senden.
// ───────────────────────────────────────────────────────────────────────────
import { effectiveServer } from './deviceLibraryUrl'
import { consentCurrent } from './deviceLibraryConsent'
import { useSettingsStore } from '../store/settingsStore'
import { useProjectStore } from '../store/projectStore'
import { useDeviceLibraryStore } from '../store/deviceLibraryStore'

/** Lang genug, dass eine Reihe von Aenderungen (Ports anlegen, umbenennen)
 *  ein einziges Hochladen ergibt; der Server zaehlt Anfragen je Stunde. */
export const AUTO_SYNC_ENTPRELLUNG_MS = 5000

/**
 * Abstand der selbsttaetigen Aktualisierung.
 *
 * Sechs Stunden, nicht sechs Minuten: die Bibliothek ist ein Katalog von
 * Geraetetypen und kein Live-Datenstrom. Ein Abgleich holt ueber `after=<seq>`
 * ohnehin nur die Aenderungen, aber jeder Lauf ist eine Anfrage an einen
 * Server mit 0,5 Kernen, und der zaehlt sie. Wer nicht warten will, hat den
 * Knopf „Aktualisieren" daneben.
 */
export const AUTO_SYNC_ABSTAND_MS = 6 * 60 * 60 * 1000

const angemeldet = () => {
  const s = useDeviceLibraryStore.getState().session
  return s === 'signed-in' || s === 'unverified'
}

/** Darf diese Installation eigene Vorlagen hochladen? */
export function darfHochladen(): boolean {
  const s = useSettingsStore.getState()
  return s.deviceLibraryAutoUpload && consentCurrent(s.deviceLibraryUploadConsent)
}

/**
 * Einmal abgleichen, wenn angemeldet: mit Zustimmung hoch und runter, sonst
 * nur runter. Ohne Anmeldung gar nicht — der gespeicherte Stand bleibt.
 */
export function autoSyncJetzt(): Promise<void> {
  if (!angemeldet()) return Promise.resolve()
  const store = useDeviceLibraryStore.getState()
  const server = effectiveServer(useSettingsStore.getState().deviceLibraryUrl)
  if (!darfHochladen()) return store.sync(server)
  return store.syncNow(server, useProjectStore.getState().customLibrary)
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

  // Eine Aenderung an der eigenen Bibliothek loest einen Lauf aus — aber nur,
  // wenn ueberhaupt hochgeladen werden darf. Ohne Zustimmung waere es ein
  // Abgleich ohne Anlass: geaendert hat sich hier etwas, nicht dort.
  const ab = useProjectStore.subscribe((s, prev) => {
    if (s.customLibrary === prev.customLibrary) return
    if (!darfHochladen()) return
    clearTimeout(timer)
    timer = setTimeout(() => void autoSyncJetzt(), AUTO_SYNC_ENTPRELLUNG_MS)
  })

  // Die Gemeinschaftsgeraete bleiben aktuell, ohne dass jemand drueckt.
  const takt = setInterval(() => void autoSyncJetzt(), AUTO_SYNC_ABSTAND_MS)

  // Nach dem Aufwachen oder einem Tagwechsel im Hintergrund steht der Takt
  // oft schief; wer das Fenster wieder nach vorn holt, soll den aktuellen
  // Stand sehen und nicht den von gestern.
  const beiSichtbar = () => {
    if (document.visibilityState === 'visible' && faellig()) void autoSyncJetzt()
  }
  document.addEventListener('visibilitychange', beiSichtbar)

  return () => {
    clearTimeout(timer)
    clearInterval(takt)
    document.removeEventListener('visibilitychange', beiSichtbar)
    ab()
    gestartet = false
  }
}

/** Liegt der letzte erfolgreiche Abgleich laenger zurueck als der Abstand? */
export function faellig(jetzt: number = Date.now()): boolean {
  const am = useDeviceLibraryStore.getState().cache.syncedAt
  if (!am) return true
  const t = Date.parse(am)
  return !Number.isFinite(t) || jetzt - t >= AUTO_SYNC_ABSTAND_MS
}
