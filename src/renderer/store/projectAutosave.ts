import type { CablePlannerProject } from '../types/project'
import { useSettingsStore } from './settingsStore'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { hatBild, ohneBilddaten } from '../lib/fotoMasse'
import { raeumeBilder, sichereBilder } from './fotoSpeicher'

/**
 * #308 — Project-Autosave aus projectStore ausgelagert. Module-level
 * Timer-State sorgt fuer Debouncing ueber alle Slices hinweg — ein
 * single timer pro Tab. Auto-save delay liest live aus dem settingsStore.
 */

const PROJECT_AUTOSAVE_KEY = STORAGE_KEYS.projectAutosave

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Wann die Sicherungskopie zuletzt NICHT geschrieben werden konnte.
 *
 * ─── WARUM DAS SICHTBAR SEIN MUSS ──────────────────────────────────────────
 *
 * Hier stand `catch { /* quota errors are non-fatal *\/ }`, und das stimmte
 * für den Programmablauf: es stürzt nichts ab. Für den Menschen davor stimmte
 * es nicht. `localStorage` fasst je nach Browser 5–10 MB; ab dem ersten zu
 * grossen Speichern wird die Sicherungskopie stillschweigend nicht mehr
 * geschrieben. Wer weiterplant und dann den Rechner verliert, hat den Stand
 * von damals — und niemand hat ihm gesagt, ab wann.
 *
 * Das ist genau die teuerste Defektform dieses Repos: kein Fehler, nur eine
 * Anzeige, die weiter „gesichert" behauptet. Die Fussleiste liest diese
 * Marke und sagt es.
 *
 * Es ist ein Modul-Zustand und kein Store: der Autosave läuft aus jedem
 * Slice heraus, und ein Store, der beim Schreiben einen anderen Store
 * schreibt, ist eine Schleife, auf die niemand gefasst ist. Die Fussleiste
 * fragt ihn beim Rendern ab (sie rendert ohnehin bei jeder Projektänderung).
 */
let letzterFehlschlag: { zeit: number; bytes: number } | null = null

/** Was beim letzten Versuch schiefging — `null` heisst: es ging gut. */
export const autosaveFehlschlag = (): { zeit: number; bytes: number } | null => letzterFehlschlag

/**
 * Wie lange ein Schreiben auf eine Leerlaufphase warten darf. Danach wird
 * geschrieben, auch wenn der Rechner beschaeftigt ist — die Sicherung darf
 * sich verspaeten, aber nicht ausfallen.
 */
const IDLE_MAX_WAIT_MS = 2000

// Der zuletzt GESCHRIEBENE Stand und der, der noch aussteht.
let gesichert: CablePlannerProject | null = null
let ausstehend: CablePlannerProject | null = null
let idleHandle: { cancel: () => void } | null = null

/**
 * Hat sich etwas geaendert, das gesichert werden muss? Verglichen wird je
 * Feld per Referenz statt per `JSON.stringify` — die Slices ersetzen ein
 * Feld, das sie aendern, und lassen alle anderen stehen.
 *
 * `canvasState` (Ausschnitt und Zoom) zaehlt nicht: jeder Schwenk schrieb
 * sonst den ganzen Plan neu. Der Ausschnitt reist mit der naechsten echten
 * Aenderung mit; geht er verloren, oeffnet der Plan an anderer Stelle —
 * verloren ist dabei nichts. Auswahl und Hover liegen gar nicht im Projekt.
 */
export const projektGeaendert = (vorher: CablePlannerProject | null, jetzt: CablePlannerProject): boolean => {
  if (!vorher) return true
  if (vorher === jetzt) return false
  const schluessel = new Set([...Object.keys(vorher), ...Object.keys(jetzt)])
  for (const k of schluessel) {
    if (k === 'canvasState') continue
    if ((vorher as unknown as Record<string, unknown>)[k] !== (jetzt as unknown as Record<string, unknown>)[k]) return true
  }
  return false
}

const schreibe = (project: CablePlannerProject) => {
  // #884 — die FOTOS gehen in eine eigene Ablage, ihre Datensätze bleiben
  // in der Sicherungskopie. Die Rechnung dahinter steht in
  // `lib/fotoMasse.ts`: zehn heruntergerechnete Bilder füllen die fünf
  // Megabyte, die `localStorage` hergibt, und dann stirbt die Kopie —
  // seit 2026-09-18 wenigstens nicht mehr schweigend, aber sie stirbt.
  //
  // Was hier gespeichert wird, ist also der Plan MIT allen Foto-Einträgen
  // und OHNE deren Bilddaten; die Bilder liegen in IndexedDB, dessen Platz
  // nach Festplatte bemessen ist.
  const fotos = project.fotos ?? []
  const schlank =
    fotos.length > 0 ? { ...project, fotos: ohneBilddaten(fotos) } : project
  const roh = JSON.stringify(schlank)
  try {
    localStorage.setItem(PROJECT_AUTOSAVE_KEY, roh)
    letzterFehlschlag = null
    gesichert = project
  } catch {
    // Die Grösse wird MITGEMELDET: „zu gross" ohne Zahl lässt jemanden
    // raten, ob ein Logo zu viel war oder der halbe Plan. `gesichert`
    // bleibt stehen — der naechste Versuch schreibt dann wieder.
    letzterFehlschlag = { zeit: Date.now(), bytes: roh.length }
  }

  // Die Bilder daneben — und was kein Datensatz mehr nennt, fliegt raus.
  // Beides misslingt still: die Ablage ist eine Bequemlichkeit, der Plan
  // ist auch ohne sie unversehrt (siehe `store/fotoSpeicher.ts`).
  if (fotos.length > 0) {
    const bilder = new Map<string, string>()
    for (const f of fotos) if (hatBild(f)) bilder.set(f.id, f.dataUri)
    void sichereBilder(bilder)
  }
  void raeumeBilder(new Set(fotos.map((f) => f.id)))
}

/** Schreibt einen ausstehenden Stand SOFORT (Fenster geht zu/wird verborgen). */
export const flushProjectAutosave = () => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  idleHandle?.cancel()
  idleHandle = null
  const p = ausstehend
  ausstehend = null
  if (p) schreibe(p)
}

const imLeerlauf = (arbeit: () => void): { cancel: () => void } => {
  const w = globalThis as typeof globalThis & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  if (typeof w.requestIdleCallback === 'function' && typeof w.cancelIdleCallback === 'function') {
    const id = w.requestIdleCallback(arbeit, { timeout: IDLE_MAX_WAIT_MS })
    return { cancel: () => w.cancelIdleCallback!(id) }
  }
  const id = setTimeout(arbeit, 0)
  return { cancel: () => clearTimeout(id) }
}

let flushAngemeldet = false
const meldeFlushAn = () => {
  if (flushAngemeldet || typeof window === 'undefined') return
  flushAngemeldet = true
  window.addEventListener('beforeunload', flushProjectAutosave)
  window.addEventListener('pagehide', flushProjectAutosave)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushProjectAutosave()
  })
}

export const scheduleProjectAutosave = (project: CablePlannerProject) => {
  if (!projektGeaendert(ausstehend ?? gesichert, project)) {
    // Nur der Ausschnitt hat sich bewegt. Steht ohnehin ein Schreiben an,
    // nimmt es den neuen Ausschnitt mit.
    if (ausstehend) ausstehend = project
    return
  }
  meldeFlushAn()
  ausstehend = project
  if (autosaveTimer) clearTimeout(autosaveTimer)
  idleHandle?.cancel()
  idleHandle = null
  const delay = useSettingsStore.getState().autosaveIntervalMs || 400
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    idleHandle = imLeerlauf(() => {
      idleHandle = null
      const p = ausstehend
      ausstehend = null
      if (p) schreibe(p)
    })
  }, delay)
}

/** Used by clear() — verhindert dass beim naechsten Tab-Open das
 *  alte Projekt wieder auftaucht obwohl der User "Neu" geklickt hat. */
export const clearProjectAutosave = () => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  idleHandle?.cancel()
  idleHandle = null
  ausstehend = null
  gesichert = null
  try {
    localStorage.removeItem(PROJECT_AUTOSAVE_KEY)
  } catch {
    /* ignore */
  }
}
