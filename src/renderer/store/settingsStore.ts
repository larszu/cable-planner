import { create } from 'zustand'
import { STORAGE_KEYS } from '../lib/storageKeys'
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
}

const defaults: PersistedSettings = {
  autosaveIntervalMs: 400,
  sharedSyncPath: '',
  sharedSyncUser: '',
  editorName: '',
  enabledModules: { ...DEFAULT_ENABLED },
  onboardingDone: false,
  userSchema: {},
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
  userSchema: initial.userSchema,
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
}))

/** Hook für konditionales Rendern: ist dieses Modul aktiv? */
export const useModule = (id: ModuleId): boolean =>
  useSettingsStore((s) => s.enabledModules[id])
