/**
 * Modulares UI — Registry der ein-/ausschaltbaren Funktionsmodule.
 *
 * Siehe `docs/modular-ui-concept.md`. Module steuern NUR die UI-Sichtbarkeit
 * (Menüeinträge, Panels, Dialoge) — niemals die Projektdaten. Der „Kern"
 * (Canvas, Geräte/Kabel, Properties, Export) ist immer an und kein Modul.
 *
 * Framework-frei und damit testbar; UI (Settings-Tab, Onboarding) liest hier.
 */

export type ModuleId = 'festinstallation' | 'mobile' | 'rentman' | 'rental'

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
    label: 'Festinstallation',
    description:
      'Lebenszyklus/Service, Asset-Register & QR-Etiketten, Übergabe-Doku und Feld-Rückkanal.',
  },
  {
    id: 'mobile',
    label: 'Mobile-Companion',
    description: 'Handy-Patchliste, Steck-Check, QR-Scan-Lookup und Feld-Meldungen.',
  },
  {
    id: 'rentman',
    label: 'Rentman',
    description: 'Import/Export-Kopplung zu Rentman (Katalog + Kabelmengen).',
  },
  {
    id: 'rental',
    label: 'Rental / Lager',
    description:
      'Lagerbestand, Eigentum & Verfügbarkeit, Mietkalkulation (im Aufbau, Phase 2+).',
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
    description: 'Temporäre Produktionen — schnell planen, vor Ort abhaken.',
    modules: ['mobile', 'rentman'],
  },
  {
    id: 'festinstallation',
    label: 'Festinstallation',
    description: 'Dauerhafte Anlagen — mitwachsende Doku, Service, Übergabe.',
    modules: ['festinstallation', 'mobile'],
  },
  {
    id: 'rental',
    label: 'Vermietung / Rental',
    description: 'Lagerbestand & Verfügbarkeit über Projekte hinweg.',
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
