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

export const scheduleProjectAutosave = (project: CablePlannerProject) => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  const delay = useSettingsStore.getState().autosaveIntervalMs || 400
  autosaveTimer = setTimeout(() => {
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
    } catch {
      // Die Grösse wird MITGEMELDET: „zu gross" ohne Zahl lässt jemanden
      // raten, ob ein Logo zu viel war oder der halbe Plan.
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
  }, delay)
}

/** Used by clear() — verhindert dass beim naechsten Tab-Open das
 *  alte Projekt wieder auftaucht obwohl der User "Neu" geklickt hat. */
export const clearProjectAutosave = () => {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  try {
    localStorage.removeItem(PROJECT_AUTOSAVE_KEY)
  } catch {
    /* ignore */
  }
}
