/**
 * Modulares UI — Registry der ein-/ausschaltbaren Funktionsmodule.
 *
 * Siehe `docs/modular-ui-concept.md`. Module steuern NUR die UI-Sichtbarkeit
 * (Menüeinträge, Panels, Dialoge) — niemals die Projektdaten. Der „Kern"
 * (Canvas, Geräte/Kabel, Properties, Export) ist immer an und kein Modul.
 *
 * Framework-frei und damit testbar; UI (Settings-Tab, Onboarding) liest hier.
 */

export type ModuleId = 'festinstallation' | 'mobile' | 'rentman' | 'rental' | 'netbox'

export interface ModuleMeta {
  id: ModuleId
  /** Deutsche Default-Bezeichnung (UI heilt EN via i18n). */
  label: string
  /** Ein-Satz-Beschreibung für den Settings-Tab. */
  description: string
}

/** Anzeige-Reihenfolge + Metadaten. */
export const MODULES: ModuleMeta[] = [
  {
    id: 'festinstallation',
    label: 'Fixed installation',
    description:
      'Lifecycle/service, asset register & QR labels, handover docs and field feedback.',
  },
  {
    id: 'mobile',
    label: 'Mobile-Companion',
    description: 'Phone patch list, plug check, QR scan lookup and field reports.',
  },
  {
    id: 'rentman',
    label: 'Rentman',
    description: 'Import/export link to Rentman (catalogue + cable quantities).',
  },
  {
    id: 'rental',
    label: 'Rental / Stock',
    description:
      'Stock, ownership & availability, rental pricing (in progress, phase 2+).',
  },
  {
    id: 'netbox',
    label: 'NetBox',
    description:
      'Import a site or rack from a NetBox instance as a cable plan and later add only new devices/connections.',
  },
]

export const MODULE_IDS: ModuleId[] = MODULES.map((m) => m.id)

/**
 * Default-Aktivierung. Bewusst so, dass bestehende Installationen nichts
 * verlieren: alles bisher Sichtbare bleibt an; `rental` startet aus (neu) und
 * `rentman` startet aus (war schon immer opt-in — der Alt-Wert wird beim Laden
 * aus dem uiStore migriert, siehe settingsStore).
 */
export const DEFAULT_ENABLED: Record<ModuleId, boolean> = {
  festinstallation: true,
  mobile: true,
  rentman: false,
  rental: false,
  // #597 — wie rentman opt-in: ohne eigene NetBox-Instanz ist das Modul
  // wertlos und würde nur Menüeinträge zustellen.
  netbox: false,
}

export type PresetId = 'show' | 'festinstallation' | 'rental'

export interface PresetMeta {
  id: PresetId
  label: string
  description: string
  /** Module, die dieses Preset zusätzlich zum Kern aktiviert. */
  modules: ModuleId[]
}

/** Use-Case-Presets fürs Erststart-Onboarding (Intent statt Feature-Liste). */
export const PRESETS: PresetMeta[] = [
  {
    id: 'show',
    label: 'Show / Event',
    description: 'Temporary productions — plan fast, check off on site.',
    modules: ['mobile', 'rentman'],
  },
  {
    id: 'festinstallation',
    label: 'Fixed installation',
    description: 'Permanent systems — living documentation, service, handover.',
    // NetBox ist die typische Dokumentationsquelle für Festinstallationen.
    modules: ['festinstallation', 'mobile', 'netbox'],
  },
  {
    id: 'rental',
    label: 'Rental',
    description: 'Stock & availability across projects.',
    modules: ['rental', 'rentman'],
  },
]

/**
 * Baut die `enabledModules`-Map aus einer Auswahl von Presets. Der Kern ist
 * immer an (kein Modul); ein Modul ist an, sobald MINDESTENS ein gewähltes
 * Preset es enthält. Nicht referenzierte Module bleiben aus.
 */
export const enabledFromPresets = (presetIds: PresetId[]): Record<ModuleId, boolean> => {
  const wanted = new Set<ModuleId>()
  for (const pid of presetIds) {
    const p = PRESETS.find((x) => x.id === pid)
    p?.modules.forEach((m) => wanted.add(m))
  }
  return MODULE_IDS.reduce(
    (acc, id) => {
      acc[id] = wanted.has(id)
      return acc
    },
    {} as Record<ModuleId, boolean>,
  )
}

/** Heilt eine (evtl. alte/teildefinierte) Map gegen die aktuelle Modul-Liste. */
export const healEnabledModules = (
  raw: Partial<Record<ModuleId, boolean>> | undefined,
): Record<ModuleId, boolean> =>
  MODULE_IDS.reduce(
    (acc, id) => {
      acc[id] = typeof raw?.[id] === 'boolean' ? (raw[id] as boolean) : DEFAULT_ENABLED[id]
      return acc
    },
    {} as Record<ModuleId, boolean>,
  )
