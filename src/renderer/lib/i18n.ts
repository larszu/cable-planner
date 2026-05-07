import { useUiStore, type Language } from '../store/uiStore'

/**
 * Cable Planner i18n.
 *
 * Coverage today (intentional, incremental):
 *   ✓ Settings dialog (all 6 tabs)
 *   ✓ Top-level menu / chrome (App header, MenuBar)
 *   ✓ Common buttons (OK / Abbrechen / Speichern / Schließen / Löschen / …)
 *   ✓ promptDialog + confirmDialog default labels
 *   ✓ CategorySelect "+ Neue Kategorie…" entry
 *   ◯ Properties panels (Equipment / Cable / Location / Template) — DE only
 *   ◯ Library panel — DE only
 *   ◯ Rentman dialogs — DE only
 *   ◯ ATEM dialogs — DE only
 *   ◯ Rack builder — DE only
 *   ◯ Export dialogs — DE only
 *
 * Strings without a translation fall through to the German source string,
 * so a partially-translated UI stays readable rather than showing missing-
 * key tokens.
 */

type Dict = Record<string, string>

const en: Dict = {
  // Common buttons
  'common.ok': 'OK',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.reset': 'Reset',
  'common.apply': 'Apply',
  'common.choose': 'Choose…',
  'common.add': 'Add',
  'common.remove': 'Remove',
  'common.rename': 'Rename',
  'common.search': 'Search…',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.optional': 'optional',
  'common.loading': 'Loading…',

  // App / window chrome
  'app.title': 'Cable Planner',
  'app.menu.file': 'File',
  'app.menu.file.new': 'New project',
  'app.menu.file.open': 'Open…',
  'app.menu.file.save': 'Save',
  'app.menu.file.saveAs': 'Save as…',
  'app.menu.export': 'Export',
  'app.menu.export.pdf': 'Plan as PDF…',
  'app.menu.export.cableBom': 'Cable BOM…',
  'app.menu.export.attachRentman': 'Attach plan to Rentman…',
  'app.menu.export.attachRentmanDisabled':
    'Attach plan to Rentman (no project linked)',
  'app.menu.export.cablesRentman': 'Send cables to Rentman…',
  'app.menu.export.cablesRentmanDisabled':
    'Send cables to Rentman (no project linked)',
  'app.menu.help': 'Help',
  'app.menu.help.tour': 'Getting-started tour…',
  'app.editProjectMeta': 'Edit project metadata',
  'app.videoFormat': 'Format:',
  'app.videoFormatTitle': 'Default project video format (SDI)',

  // Settings dialog frame
  'settings.title': 'Settings',
  'settings.section': 'Settings',
  'settings.tab.project': 'Project',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.editing': 'Editing',
  'settings.tab.integrations': 'Integrations',
  'settings.tab.sync': 'Network sync',
  'settings.tab.advanced': 'Advanced',
  'settings.tabTitle.project': 'Project settings',
  'settings.tabTitle.appearance': 'Appearance',
  'settings.tabTitle.editing': 'Editing',
  'settings.tabTitle.integrations': 'Integrations',
  'settings.tabTitle.sync': 'Network sync',
  'settings.tabTitle.advanced': 'Advanced',

  // Settings → Project
  'settings.project.intro': 'Project metadata — saved with the Cable Planner file.',
  'settings.project.name': 'Project name',
  'settings.project.description': 'Description',
  'settings.project.descriptionPlaceholder': 'Optional project description',
  'settings.project.client': 'Client',
  'settings.project.clientPlaceholder': 'End customer',
  'settings.project.contractor': 'Contractor',
  'settings.project.contractorPlaceholder': 'Executing company',
  'settings.project.author': 'Author',
  'settings.project.authorPlaceholder': 'Your name',
  'settings.project.number': 'Project no.',
  'settings.project.numberPlaceholder': 'e.g. 2026-042',
  'settings.project.logos': 'Plan signature (logos)',
  'settings.project.logosHint':
    'Logos are stored as data URI in the project file (PDF export & canvas signature).',
  'settings.project.logo.contractor': 'Contractor',
  'settings.project.logo.client': 'Client',
  'settings.project.linkedRentman': 'Linked Rentman project',
  'settings.project.notLinked':
    'No Rentman project linked. Link via the “Integrations” tab.',

  // Settings → Appearance
  'settings.appearance.language': 'Language',
  'settings.appearance.languageDesc':
    'UI language. Switching is instant. Some deeply nested dialogs are still German-only — see the i18n coverage note.',
  'settings.appearance.coverage':
    'Currently translated: Settings, top-level chrome and common buttons. Properties panels, Library, Rentman, ATEM and export dialogs remain in German for now.',
  'settings.appearance.theme': 'Theme',
  'settings.appearance.themeDesc':
    'Canvas background colour. Optimised for dark; light is intended for PDF export or bright environments.',
  'settings.appearance.theme.dark': '🌙 Dark',
  'settings.appearance.theme.light': '☀ Light',
  'settings.appearance.ports': 'Port colours',
  'settings.appearance.portsDesc': 'Controls how port handles on equipment are coloured.',
  'settings.appearance.ports.byDirection': 'By direction (default)',
  'settings.appearance.ports.byDirectionTitle':
    'Cyan = input, green = output, purple = bidirectional',
  'settings.appearance.ports.byType': 'By connector type',
  'settings.appearance.ports.byTypeTitle':
    'SDI = amber, HDMI = violet, Ethernet = green, fibre = yellow…',
  'settings.appearance.cableColor': 'Cable colour',
  'settings.appearance.cableColorDesc':
    'Manual = per cable in the properties panel; by length = length-based colour coding.',
  'settings.appearance.cableColor.manual': 'Manual',
  'settings.appearance.cableColor.byLength': 'By length',
  'settings.appearance.arrows': 'Arrows on cables',
  'settings.appearance.arrowsDesc':
    'Default for newly drawn cables. Overridable per cable in the properties panel.',
  'settings.appearance.arrows.label': 'Show arrow at the target end (signal flow direction)',

  // Settings → Editing
  'settings.editing.routing': 'Default cable routing',
  'settings.editing.routingDesc':
    'Shape used for new cables on the canvas. Overridable per cable.',
  'settings.editing.routing.applyAll': 'Apply to all existing cables ({count})',
  'settings.editing.routing.applyAllConfirm':
    'Set routing of all {count} existing cables to "{routing}"?',
  'settings.editing.grid': 'Grid',
  'settings.editing.gridDesc': 'Snap-to-grid and grid size in pixels.',
  'settings.editing.snapLabel': 'Snap equipment to grid',
  'settings.editing.gridSize': 'Grid size (pixels)',

  // Settings → Integrations
  'settings.integrations.rentman': 'Rentman API',
  'settings.integrations.rentmanDesc':
    'Bearer token from your Rentman account. Encrypted via the OS keychain (never in the project file).',
  'settings.integrations.rentman.token': 'API token',
  'settings.integrations.rentman.tokenPlaceholder': 'Paste bearer token',
  'settings.integrations.rentman.status': 'Status:',
  'settings.integrations.rentman.tokenStored': 'Token stored:',
  'settings.integrations.rentman.statusLoaded': 'Token loaded from secure storage.',
  'settings.integrations.rentman.statusNone': 'No token configured',
  'settings.integrations.rentman.statusSaved': 'Token saved securely.',
  'settings.integrations.rentman.statusDeleted': 'Token deleted.',
  'settings.integrations.rentman.save': 'Save token',
  'settings.integrations.rentman.test': 'Test connection',
  'settings.integrations.rentman.delete': 'Delete token',
  'settings.integrations.rentman.endpoint': 'Endpoint:',
  'settings.integrations.linkedRentman': 'Linked Rentman project',
  'settings.integrations.linkedRentman.current': 'Currently linked to ',
  'settings.integrations.linkedRentman.choose': 'Choose another Rentman project…',
  'settings.integrations.linkedRentman.none':
    'No Rentman project linked to this Cable Planner project yet.',
  'settings.integrations.linkedRentman.link': 'Link to a Rentman project…',
  'settings.integrations.linkedRentman.titleNeedToken': 'Save token first',
  'settings.integrations.linkedRentman.titleSelect': 'Pick Rentman project',
  'settings.integrations.gemini': 'Gemini API (AI port suggestions)',
  'settings.integrations.geminiDesc':
    'API key from aistudio.google.com. Stored in the browser localStorage. Required for the “✨ Gemini” buttons in the device wizard and library.',
  'settings.integrations.gemini.save': 'Save key',
  'settings.integrations.gemini.saved': '✓ saved',
  'settings.integrations.gemini.delete': 'Delete',
  'settings.integrations.gemini.hint': 'Get a key at ',

  // Settings → Sync
  'settings.sync.desktopOnly': 'Network sync is only available in the desktop app.',
  'settings.sync.intro':
    'Shared directory (mapped FTP drive, network path or local folder) where project, library and presets are exchanged as JSON files.',
  'settings.sync.path': 'Sync directory',
  'settings.sync.user': 'User name (for lock display)',
  'settings.sync.userPlaceholder': 'e.g. Max Mustermann',
  'settings.sync.notes': 'Notes',
  'settings.sync.notes.push':
    'Push writes: cable-planner.project.json, .library.json, .presets.json',
  'settings.sync.notes.pull': 'Pull loads these files from the directory into the current state.',
  'settings.sync.notes.lock':
    'A lock file (.cable-planner-sync.lock) prevents simultaneous overwrites (2 h TTL).',

  // Settings → Advanced
  'settings.advanced.autosave': 'Autosave',
  'settings.advanced.autosaveDesc':
    'How often the current project is automatically saved to localStorage. Default: 400 ms.',
  'settings.advanced.autosaveInterval': 'Autosave interval (ms)',
  'settings.advanced.categories': 'Category management',
  'settings.advanced.categoriesDesc':
    'Rename library categories or add new ones. When renaming, all assigned templates move along.',
  'settings.advanced.categories.col.name': 'Category',
  'settings.advanced.categories.col.count': 'Templates',
  'settings.advanced.categories.empty': 'No categories yet.',
  'settings.advanced.categories.addPrompt': 'New category',
  'settings.advanced.categories.renamePrompt': 'Rename category',
  'settings.advanced.categories.addBtn': '+ New category',
  'settings.advanced.caches': 'Caches & local data',
  'settings.advanced.cachesDesc':
    'Cache contents are reloaded on demand. Your data is safe — only performance caches are cleared.',
  'settings.advanced.caches.rentman': 'Clear Rentman template cache',
  'settings.advanced.caches.netbox': 'Clear NetBox index cache',
  'settings.advanced.caches.web': 'Clear web search history',
  'settings.advanced.caches.welcome': 'Show welcome dialog on next start',
  'settings.advanced.caches.confirm': 'Clear {label}?',
  'settings.advanced.caches.cleared':
    '{label} cleared. Will be reloaded on next start.',
  'settings.advanced.caches.welcomeConfirm':
    'Show the welcome dialog on next start?',
  'settings.advanced.export': 'Data export',
  'settings.advanced.exportDesc':
    'Export Cable Planner data stored locally as JSON — e.g. to migrate to another machine.',
  'settings.advanced.exportBtn': 'Export all localStorage data',

  // Common project-tab metadata
  'settings.project.save': 'Save',
  'settings.project.reset': 'Reset',

  // CategorySelect
  'category.new': '+ New category…',
  'category.newPrompt': 'New category',
}

const translations: Record<Language, Dict> = {
  de: {
    // German is the source language; only entries that need a different
    // *display* text from the key go here. Most strings stay as their
    // original German source.
  },
  en,
}

/**
 * Look up a translation. Falls back to the German source string (or the
 * key itself if no fallback is provided) so partial coverage doesn't break
 * the UI.
 */
export function translate(lang: Language, key: string, fallback?: string): string {
  const dict = translations[lang]
  if (dict && key in dict) return dict[key]
  return fallback ?? key
}

/**
 * Hook returning a `t(key, fallback?)` helper bound to the current language.
 * The hook re-renders the calling component when the user changes language.
 */
export function useTranslation() {
  const lang = useUiStore((s) => s.language)
  return (key: string, fallback?: string) => translate(lang, key, fallback)
}

/** Convenience: inject runtime values into a translated string.
 *  e.g. format(t('foo', '{n} cables'), { n: 5 }) → '5 cables'. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in values ? String(values[k]) : `{${k}}`,
  )
}
