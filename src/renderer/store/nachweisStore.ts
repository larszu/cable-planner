import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { NACHWEIS_ART_LABEL, type Nachweis, type NachweisArt } from '../types/nachweis'

/**
 * Die Nachweise dieser Person (Bedarf 120).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WARUM EIN EIGENER STORE UND NICHT DAS PROJEKT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ein Nachweis gilt für den MENSCHEN, nicht für den Plan. Er überlebt jedes
 * Projekt, und er gehört in keine `.avplan`, die an einen Kunden geht — dort
 * hätte die Versicherungsnummer des Freiberuflers nichts zu suchen. Dieselbe
 * Trennung wie beim `inventoryStore`: projektübergreifend, eigener
 * Storage-Key, nicht im Projekt-Envelope.
 *
 * KEINE UNDO-HISTORIE. `projectHistory` lauscht auf den `projectStore`; hier
 * wäre sie auch falsch — einen Nachweis einzutragen ist kein Planungsschritt,
 * den man rückgängig macht.
 *
 * WAS HIER NICHT LIEGT: die Scans. Nur ihr Dateiname (siehe
 * `types/nachweis.ts`). Ein PDF in den localStorage zu legen wäre bei fünf
 * Megabyte Platz ohnehin die zweite Frage; die erste ist, dass niemand diesen
 * Speicher als Aktenschrank für Personenpapiere angelegt hat.
 */

const KEY = STORAGE_KEYS.nachweise

const istArt = (v: unknown): v is NachweisArt =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(NACHWEIS_ART_LABEL, v)

/**
 * Einen Eintrag aus dem Speicher heilen.
 *
 * `gueltigBis` wird NICHT ergänzt, wenn es fehlt. Ein Datum zu setzen, das
 * niemand angegeben hat, machte aus einer fehlenden Frist eine Zusage — genau
 * die Verwechslung, gegen die dieser Bedarf geschrieben ist.
 */
const heile = (roh: unknown): Nachweis | null => {
  if (!roh || typeof roh !== 'object') return null
  const r = roh as Partial<Nachweis>
  const bezeichnung = typeof r.bezeichnung === 'string' ? r.bezeichnung.trim() : ''
  if (!bezeichnung) return null
  const text = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim() ? v.trim() : undefined
  return {
    id: typeof r.id === 'string' && r.id ? r.id : uuidv4(),
    art: istArt(r.art) ? r.art : 'sonstiges',
    bezeichnung,
    aussteller: text(r.aussteller),
    nummer: text(r.nummer),
    ausgestelltAm: text(r.ausgestelltAm),
    gueltigBis: text(r.gueltigBis),
    dateiName: text(r.dateiName),
    notiz: text(r.notiz),
  }
}

interface Gespeichert {
  nachweise: Nachweis[]
  /**
   * Ab wieviel Tagen vor Fristende gewarnt wird — ODER NICHTS.
   *
   * Ohne Angabe wird NICHT gewarnt (siehe `laeuftBaldAb` in `lib/nachweisPack`).
   * Eine Vorgabe wie 30 wäre eine Meinung darüber, wie lange eine Verlängerung
   * dauert, und diese Anwendung hat dazu keine.
   */
  vorwarnTage?: number
}

const laden = (): Gespeichert => {
  try {
    const roh = localStorage.getItem(KEY)
    if (!roh) return { nachweise: [] }
    const geparst = JSON.parse(roh) as Partial<Gespeichert>
    const nachweise = Array.isArray(geparst.nachweise)
      ? geparst.nachweise.map(heile).filter((n): n is Nachweis => n !== null)
      : []
    const v = geparst.vorwarnTage
    return {
      nachweise,
      vorwarnTage: typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined,
    }
  } catch {
    return { nachweise: [] }
  }
}

/**
 * Schreibt und MELDET, ob es geklappt hat.
 *
 * Ein leeres `catch` wäre hier dieselbe Defektform wie im Lager (B-36,
 * `zustand-nach-fehler`): der Eintrag stünde in der Oberfläche und wäre beim
 * nächsten Start weg.
 */
const schreiben = (s: Gespeichert): boolean => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

export type NachweisEingabe = Omit<Nachweis, 'id'>

interface NachweisState extends Gespeichert {
  /** Der letzte Schreibvorgang ist gescheitert (voller Speicher). */
  speicherVoll: boolean
  addNachweis: (eingabe: NachweisEingabe) => string
  updateNachweis: (id: string, patch: Partial<NachweisEingabe>) => void
  removeNachweis: (id: string) => void
  setVorwarnTage: (tage: number | undefined) => void
}

const start = laden()

export const useNachweisStore = create<NachweisState>((set, get) => ({
  ...start,
  speicherVoll: false,

  addNachweis: (eingabe) => {
    const id = uuidv4()
    const nachweise = [...get().nachweise, { ...eingabe, id }]
    set({ nachweise, speicherVoll: !schreiben({ nachweise, vorwarnTage: get().vorwarnTage }) })
    return id
  },

  updateNachweis: (id, patch) => {
    const nachweise = get().nachweise.map((n) => (n.id === id ? { ...n, ...patch, id } : n))
    set({ nachweise, speicherVoll: !schreiben({ nachweise, vorwarnTage: get().vorwarnTage }) })
  },

  removeNachweis: (id) => {
    const nachweise = get().nachweise.filter((n) => n.id !== id)
    set({ nachweise, speicherVoll: !schreiben({ nachweise, vorwarnTage: get().vorwarnTage }) })
  },

  setVorwarnTage: (tage) => {
    const vorwarnTage =
      typeof tage === 'number' && Number.isFinite(tage) && tage >= 0 ? Math.round(tage) : undefined
    set({ vorwarnTage, speicherVoll: !schreiben({ nachweise: get().nachweise, vorwarnTage }) })
  },
}))
