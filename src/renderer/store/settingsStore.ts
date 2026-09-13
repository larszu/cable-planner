import { create } from 'zustand'
import { STORAGE_KEYS } from '../lib/storageKeys'
import { AUSFUELL_VORGABE, AUSFUELL_QUELLEN, type AusfuellQuelle } from '../lib/felderAusfuellen'
import { LIMITS } from '../lib/layoutConstants'
import {
  type ModuleId,
  DEFAULT_ENABLED,
  healEnabledModules,
  enabledFromPresets,
  type PresetId,
} from '../lib/modules'
import {
  setUserSchemaOverlay,
  type UserSchemaMap,
  type CategoryFieldDef,
} from '../lib/categorySchemas'

const SETTINGS_KEY = STORAGE_KEYS.settings

/** Defensive Validierung einer geladenen User-Schema-Map (localStorage ist
 *  unvertrauenswürdig). Wirft nie — filtert nur Unbrauchbares raus. */
const sanitizeUserSchema = (raw: unknown): UserSchemaMap => {
  const out: UserSchemaMap = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [cat, fields] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(fields)) continue
    const clean: CategoryFieldDef[] = []
    for (const f of fields) {
      const fd = f as Partial<CategoryFieldDef>
      if (typeof fd?.key !== 'string' || !fd.key) continue
      if (!fd.label || typeof fd.label !== 'object') continue
      if (!['text', 'number', 'select', 'boolean', 'polar-pattern'].includes(fd.type as string)) continue
      clean.push({
        key: fd.key,
        label: { de: String(fd.label.de ?? fd.key), en: String(fd.label.en ?? fd.label.de ?? fd.key) },
        type: fd.type as CategoryFieldDef['type'],
        unit: typeof fd.unit === 'string' ? fd.unit : undefined,
        placeholder: typeof fd.placeholder === 'string' ? fd.placeholder : undefined,
        options: Array.isArray(fd.options)
          ? fd.options
              .filter((o): o is { value: string; label: Record<string, string> } => !!o && typeof (o as { value?: unknown }).value === 'string')
              .map((o) => ({ value: o.value, label: { de: String(o.label?.de ?? o.value), en: String(o.label?.en ?? o.label?.de ?? o.value) } }))
          : undefined,
        userDefined: true,
      })
    }
    if (clean.length) out[cat] = clean
  }
  return out
}

/**
 * Einmalige Rentman-Migration: `rentmanEnabled` lebte früher im uiStore
 * (`cable-planner:ui`). Beim Übergang aufs Modul-System lesen wir den Alt-Wert
 * einmal aus, damit bestehende Nutzer ihre Rentman-Einstellung behalten.
 * Liefert null, wenn kein Alt-Wert existiert.
 */
const readLegacyRentmanEnabled = (): boolean | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ui)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { rentmanEnabled?: unknown }
    return typeof parsed.rentmanEnabled === 'boolean' ? parsed.rentmanEnabled : null
  } catch {
    return null
  }
}

/**
 * #858 — welche Quelle der EINE Ausfuellen-Knopf fragt.
 *
 * Die Liste und die Vorgabe stehen in `lib/felderAusfuellen.ts`, nicht hier:
 * dort liegt auch der Aufruf, und zwei Orte fuer dieselbe Aufzaehlung
 * driften. Der Store haelt nur den gewaehlten Wert.
 */
interface PersistedSettings {
  autosaveIntervalMs: number
  sharedSyncPath: string
  sharedSyncUser: string
  /** Festinstallation — Name des aktuellen Bearbeiters. Wird Änderungs-
   *  protokoll- und Service-Einträgen als Autor zugeordnet. App-weit
   *  (pro Maschine) persistiert, nicht pro Projekt. */
  editorName: string
  /** Modulares UI — welche Funktionsmodule sichtbar sind (pro Installation). */
  enabledModules: Record<ModuleId, boolean>
  /** Modulares UI — true, sobald der Erststart-Modul-Dialog beantwortet/
   *  übersprungen wurde (steuert, ob er nochmal erscheint). */
  onboardingDone: boolean
  /** Feld-Builder — user-definierte Fachfelder je Kategorie (kanonischer
   *  lowercase-Key). Overlay über die Built-in-`CATEGORY_SCHEMAS`. */
  userSchema: UserSchemaMap
  /** #597 — Basis-URL der NetBox-Instanz (z. B. https://netbox.firma.de).
   *  Pro Installation, nicht pro Projekt: dieselbe Instanz bedient alle
   *  Projekte. Das zugehörige Token liegt im OS-Schlüsselbund, niemals
   *  hier. Leerer String = NetBox nicht konfiguriert. */
  netboxUrl: string
  /**
   * Bewegte Darstellung im Canvas (Signalfluss auf den Kanten).
   *
   * Vorgabe AN, aber `prefers-reduced-motion` des Systems gewinnt darueber —
   * die Auswertung steht in `useReducedMotion`, nicht hier: diese Einstellung
   * sagt, was der Nutzer WILL, die Systemeinstellung, was er VERTRAEGT. Beides
   * in ein Feld zu ziehen hiesse, das eine mit dem anderen zu ueberschreiben.
   */
  canvasMotion: boolean
  /**
   * B-6 / E-7 — Adresse des Tally-Pi (z. B. http://10.0.0.42:8080).
   *
   * Pro INSTALLATION, nicht pro Projekt — und das ist keine Formsache: eine
   * `.avplan` wandert per Mail, liegt in Dropbox und geht in den Web-Viewer.
   * Eine LAN-Adresse darin waere die Anlagenkarte eines fremden Hauses in
   * einer Datei, die herumgereicht wird. Leerer String = kein Ziel.
   */
  tallyPiUrl: string
  /**
   * B-6 / E-7 — der Direktweg ist AUSDRUECKLICH EINZUSCHALTEN.
   *
   * Die Entscheidung sagt beides mit Rangfolge: „Die Datei bleibt der
   * Vorgabeweg; der Direktweg kommt als ausdrücklich einzuschaltendes Ziel
   * dazu." Deshalb `false` als Vorgabe. Ein Knopf, der ungefragt in ein Geraet
   * im Produktionsnetz schreibt, waere genau das Gegenteil dessen, was hier
   * entschieden wurde — und der Schreibvorgang loescht drueben Rollen.
   */
  tallyPiDirekt: boolean
  /**
   * #858 — die Quelle des Ausfuellen-Knopfs.
   *
   * Nutzer-Meldung: „Ebenso muss es nur einen mit ausfuellen Knopf geben den
   * man in den Einstellungen konfigurieren kann." Vorher standen drei
   * Knoepfe nebeneinander (Heuristik, Web, Gemini) — der Nutzer sollte
   * entscheiden, welche Quelle fuer sein Geraet die beste ist, bevor er
   * weiss, was sie liefert.
   *
   * Pro INSTALLATION und nicht pro Projekt: welche Quelle man fragt, haengt
   * daran, ob auf diesem Rechner ein API-Schluessel liegt und ob er ins
   * Internet darf — beides ist eine Eigenschaft der Maschine, nicht der
   * Show.
   */
  ausfuellQuelle: AusfuellQuelle
}

const defaults: PersistedSettings = {
  autosaveIntervalMs: 400,
  sharedSyncPath: '',
  sharedSyncUser: '',
  editorName: '',
  enabledModules: { ...DEFAULT_ENABLED },
  onboardingDone: false,
  userSchema: {},
  netboxUrl: '',
  canvasMotion: true,
  tallyPiUrl: '',
  tallyPiDirekt: false,
  ausfuellQuelle: AUSFUELL_VORGABE,
}

const load = (): PersistedSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      autosaveIntervalMs:
        typeof parsed.autosaveIntervalMs === 'number'
          ? Math.max(LIMITS.AUTOSAVE_INTERVAL.MIN_MS, Math.min(LIMITS.AUTOSAVE_INTERVAL.MAX_MS, Math.round(parsed.autosaveIntervalMs)))
          : defaults.autosaveIntervalMs,
      sharedSyncPath: typeof parsed.sharedSyncPath === 'string' ? parsed.sharedSyncPath : defaults.sharedSyncPath,
      sharedSyncUser: typeof parsed.sharedSyncUser === 'string' ? parsed.sharedSyncUser : defaults.sharedSyncUser,
      editorName: typeof parsed.editorName === 'string' ? parsed.editorName : defaults.editorName,
      enabledModules: (() => {
        const e = healEnabledModules(parsed.enabledModules)
        // Rentman noch nicht im Modul-System gespeichert → Alt-Wert übernehmen.
        if (parsed.enabledModules?.rentman === undefined) {
          const legacy = readLegacyRentmanEnabled()
          if (legacy !== null) e.rentman = legacy
        }
        return e
      })(),
      // Bestehende Installationen (Settings vorhanden, aber noch ohne dieses
      // Feld) gelten als „onboarded" → kein nachträglicher Dialog für sie.
      onboardingDone:
        typeof parsed.onboardingDone === 'boolean' ? parsed.onboardingDone : true,
      userSchema: sanitizeUserSchema(parsed.userSchema),
      netboxUrl: typeof parsed.netboxUrl === 'string' ? parsed.netboxUrl : defaults.netboxUrl,
      // Bestehende Installationen kennen das Feld nicht — sie bekommen die
      // Vorgabe AN. Das ist keine Aenderung ihrer Entscheidung, sondern die
      // erste: die Bewegung gab es vorher nicht.
      canvasMotion:
        typeof parsed.canvasMotion === 'boolean' ? parsed.canvasMotion : defaults.canvasMotion,
      tallyPiUrl: typeof parsed.tallyPiUrl === 'string' ? parsed.tallyPiUrl : defaults.tallyPiUrl,
      // Bestehende Installationen bekommen den Direktweg AUS — auch die, die
      // eine Adresse eingetragen haetten. Ein gespeichertes Feld, das beim
      // ersten Start nach dem Update auf AN steht, waere eine Entscheidung,
      // die niemand getroffen hat, mit Wirkung auf ein Geraet im Netz.
      tallyPiDirekt:
        typeof parsed.tallyPiDirekt === 'boolean' ? parsed.tallyPiDirekt : defaults.tallyPiDirekt,
      // #858 — gegen die LISTE geprueft und nicht nur gegen den Typ. Bis
      // 2026-09-13 gab es eine dritte Quelle („Heuristik"); wer sie gewaehlt
      // hatte, traegt sie noch im Speicher. Ein blosses `typeof === 'string'`
      // liesse den Wert stehen, und der Knopf fragte dann niemanden.
      ausfuellQuelle: AUSFUELL_QUELLEN.includes(parsed.ausfuellQuelle as AusfuellQuelle)
        ? (parsed.ausfuellQuelle as AusfuellQuelle)
        : defaults.ausfuellQuelle,
    }
  } catch {
    return defaults
  }
}

const persist = (state: PersistedSettings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

/** Pickt die persistierten Felder aus dem Store-State (gegen Persist-Drift,
 *  wenn neue Felder dazukommen). */
const snapshot = (s: PersistedSettings): PersistedSettings => ({
  autosaveIntervalMs: s.autosaveIntervalMs,
  sharedSyncPath: s.sharedSyncPath,
  sharedSyncUser: s.sharedSyncUser,
  editorName: s.editorName,
  enabledModules: s.enabledModules,
  onboardingDone: s.onboardingDone,
  userSchema: s.userSchema,
  netboxUrl: s.netboxUrl,
  canvasMotion: s.canvasMotion,
  tallyPiUrl: s.tallyPiUrl,
  tallyPiDirekt: s.tallyPiDirekt,
  ausfuellQuelle: s.ausfuellQuelle,
})

interface SettingsState {
  // NOTE: the actual token string is intentionally NOT stored here to avoid
  // leaking it into global React state. Use the IPC credentials API directly.
  tokenStatus: string
  hasToken: boolean
  autosaveIntervalMs: number
  sharedSyncPath: string
  sharedSyncUser: string
  editorName: string
  enabledModules: Record<ModuleId, boolean>
  onboardingDone: boolean
  userSchema: UserSchemaMap
  netboxUrl: string
  canvasMotion: boolean
  tallyPiUrl: string
  tallyPiDirekt: boolean
  ausfuellQuelle: AusfuellQuelle
  setHasToken: (value: boolean) => void
  setTokenStatus: (value: string) => void
  setAutosaveIntervalMs: (value: number) => void
  setSyncPath: (value: string) => void
  setSyncUser: (value: string) => void
  setEditorName: (value: string) => void
  /** Ein einzelnes Modul ein-/ausschalten. */
  setModuleEnabled: (id: ModuleId, value: boolean) => void
  /** Module aus einer Preset-Auswahl setzen (Erststart-Onboarding). */
  applyModulePreset: (presetIds: PresetId[]) => void
  /** Erststart-Modul-Dialog als erledigt markieren. */
  setOnboardingDone: (value: boolean) => void
  /** Feld-Builder — die komplette User-Schema-Map ersetzen. */
  setUserSchema: (map: UserSchemaMap) => void
  /** #597 — Basis-URL der NetBox-Instanz setzen (leer = nicht konfiguriert). */
  setNetboxUrl: (value: string) => void
  /** Bewegte Darstellung im Canvas ein-/ausschalten. */
  setCanvasMotion: (value: boolean) => void
  setTallyPiUrl: (value: string) => void
  setTallyPiDirekt: (value: boolean) => void
  setAusfuellQuelle: (value: AusfuellQuelle) => void
}

const initial = load()
// Overlay sofort aktivieren, damit schemaForCategory die User-Felder kennt,
// bevor die erste Property-Section rendert.
setUserSchemaOverlay(initial.userSchema)

export const useSettingsStore = create<SettingsState>((set) => ({
  tokenStatus: 'No token configured',
  hasToken: false,
  autosaveIntervalMs: initial.autosaveIntervalMs,
  sharedSyncPath: initial.sharedSyncPath,
  sharedSyncUser: initial.sharedSyncUser,
  editorName: initial.editorName,
  enabledModules: initial.enabledModules,
  onboardingDone: initial.onboardingDone,
  canvasMotion: initial.canvasMotion,
  ausfuellQuelle: initial.ausfuellQuelle,
  userSchema: initial.userSchema,
  netboxUrl: initial.netboxUrl,
  tallyPiUrl: initial.tallyPiUrl,
  tallyPiDirekt: initial.tallyPiDirekt,
  setHasToken: (value) => set({ hasToken: value }),
  setTokenStatus: (value) => set({ tokenStatus: value }),
  setAutosaveIntervalMs: (value) =>
    set((state) => {
      const next = Math.max(LIMITS.AUTOSAVE_INTERVAL.MIN_MS, Math.min(LIMITS.AUTOSAVE_INTERVAL.MAX_MS, Math.round(value || defaults.autosaveIntervalMs)))
      persist(snapshot({ ...state, autosaveIntervalMs: next }))
      return { autosaveIntervalMs: next }
    }),
  setSyncPath: (value) =>
    set((state) => {
      persist(snapshot({ ...state, sharedSyncPath: value }))
      return { sharedSyncPath: value }
    }),
  setSyncUser: (value) =>
    set((state) => {
      persist(snapshot({ ...state, sharedSyncUser: value }))
      return { sharedSyncUser: value }
    }),
  setEditorName: (value) =>
    set((state) => {
      persist(snapshot({ ...state, editorName: value }))
      return { editorName: value }
    }),
  setCanvasMotion: (value) =>
    set((state) => {
      persist(snapshot({ ...state, canvasMotion: value }))
      return { canvasMotion: value }
    }),
  setTallyPiUrl: (value) =>
    set((state) => {
      persist(snapshot({ ...state, tallyPiUrl: value }))
      return { tallyPiUrl: value }
    }),
  setTallyPiDirekt: (value) =>
    set((state) => {
      persist(snapshot({ ...state, tallyPiDirekt: value }))
      return { tallyPiDirekt: value }
    }),
  setAusfuellQuelle: (value) =>
    set((state) => {
      persist(snapshot({ ...state, ausfuellQuelle: value }))
      return { ausfuellQuelle: value }
    }),
  setModuleEnabled: (id, value) =>
    set((state) => {
      const enabledModules = { ...state.enabledModules, [id]: value }
      persist(snapshot({ ...state, enabledModules }))
      return { enabledModules }
    }),
  applyModulePreset: (presetIds) =>
    set((state) => {
      const enabledModules = enabledFromPresets(presetIds)
      persist(snapshot({ ...state, enabledModules }))
      return { enabledModules }
    }),
  setOnboardingDone: (value) =>
    set((state) => {
      persist(snapshot({ ...state, onboardingDone: value }))
      return { onboardingDone: value }
    }),
  setUserSchema: (map) =>
    set((state) => {
      const userSchema = sanitizeUserSchema(map)
      persist(snapshot({ ...state, userSchema }))
      setUserSchemaOverlay(userSchema) // Overlay live nachziehen.
      return { userSchema }
    }),
  setNetboxUrl: (value) =>
    set((state) => {
      const netboxUrl = value.trim()
      persist(snapshot({ ...state, netboxUrl }))
      return { netboxUrl }
    }),
}))

/** Hook für konditionales Rendern: ist dieses Modul aktiv? */
export const useModule = (id: ModuleId): boolean =>
  useSettingsStore((s) => s.enabledModules[id])
