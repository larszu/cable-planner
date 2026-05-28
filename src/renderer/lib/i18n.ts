import { useUiStore, type Language } from '../store/uiStore'

/**
 * Cable Planner i18n.
 *
 * Coverage status: COMPREHENSIVE.
 *
 * The English dictionary contains 1650+ keys covering essentially every
 * user-visible string in the application:
 *
 *   ✓ Top-level chrome — App header, MenuBar (incl. shortcuts), StatusBar
 *   ✓ Settings — all 6 tabs (Project, Appearance, Editing, Integrations,
 *     Sync, Advanced + Configs sub-tab)
 *   ✓ Canvas — toolbar (Defaults menu, alignment, locks, plan-finalise,
 *     annotations, length legend, rail labels), CableContextMenu, CableEdge,
 *     LayerVisibilityChips, TitleBlock, EquipmentNode tooltips,
 *     AnnotationCanvasOverlay
 *   ✓ Properties panel — chrome + Equipment / Cable / Location / Template
 *     panels + all 17 sub-sections (Identity, NetworkAccess, NetworkConfig,
 *     PowerConsumption, Dimensions/Block, Display, Modes, Ports, Print,
 *     LibrarySave, DeviceKindCards, RackSection, OptionalFields,
 *     DisplayFlags, RentmanSyncBadge, PortAiSuggestButton,
 *     GreenGoBeltpackSection, DeviceConfigsBlock)
 *   ✓ PortList (full row editor incl. SFP details, ATEM source IDs,
 *     content labels, aria-labels)
 *   ✓ DeviceModePicker + ModeEditorDialog (multi-mode devices, #113)
 *   ✓ Library panel (chrome, tabs, Rentman/NetBox sections, create dialog,
 *     CableLibraryPanel + Editor)
 *   ✓ Layout chrome (FloatingPanelShell, Splitter, ModalShell)
 *   ✓ Shared widgets (ColorField, RoutingToggle, CategorySelect)
 *   ✓ CableDialog, PrintDialog
 *   ✓ AboutDialog, AnnotationsPanel, PatchListDialog, CalculatorsDialog,
 *     OnboardingTour (all 7 steps), WelcomeDialog, ProjectMetaDialog
 *   ✓ Export dialogs — ExportDialog (Plan / Patch-Sheets / BOM bodies),
 *     VideohubExportDialog, GreenGoExportDialog, GraphmlImportDialog,
 *     LocationBomDialog, CableBomDialog, MobileShareDialog
 *   ✓ Rentman — RentmanImportDialog (chrome + body), NewRentmanDeviceWizard,
 *     RentmanCableExportDialog, ProjectSelector, EquipmentChecklist
 *   ✓ ATEM — AtemDialog, AtemMvConfigDialog, AtemAudioRouterDialog
 *   ✓ Rack — RackBuilderDialog (chrome + body), PatchPanelCreateDialog,
 *     RackShelfCreateDialog, NonRackAddDialog, RackImageCropDialog,
 *     RackAddSplitButton, RackLivePreview
 *   ✓ Promptdialog / confirmDialog / infoDialog default labels
 *
 * Strings without a translation fall through to the German source string,
 * so anything not yet covered remains readable rather than showing
 * missing-key tokens.
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
    'Translation coverage: comprehensive (1650+ keys). All menus, toolbars, properties panels (incl. PortList, all 17 sub-sections), library, all dialogs (Cable, ATEM ×3, Videohub, GreenGo, Rentman ×5, Rack builder + sub-dialogs, Print, Export, Mobile share, GraphML import, Onboarding tour, About) and shared widgets are language-aware. Strings not yet translated fall through to the German source.',
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

  // Library panel
  'library.title': 'Library',
  'library.show': 'Show library',
  'library.hide': 'Hide library',
  'library.tab.groupsTitle':
    'Saved device groups (multiple devices + cables as a template)',
  'library.section.localTitle':
    'Custom and imported templates, local to this installation',
  'library.section.rentmanTitle': 'Rentman-imported devices and account catalog',
  'library.newCategoryPlaceholder': 'Category name…',
  'library.renameCategory': 'Rename category',
  'library.rentmanSearchPlaceholder': 'Search Rentman devices…',
  'library.tab.equipment': 'Equipment',
  'library.tab.cables': 'Cables',
  'library.tab.groups': 'Groups',
  'library.tab.racks': 'Racks',
  'library.section.local': 'Local',
  'library.section.rentman': 'Rentman',
  'library.add.netbox': '+ NetBox',
  'library.add.netboxTitle':
    'Import devices from the NetBox device-type-library',
  'library.add.category': '+ Category',
  'library.add.categoryTitle': 'Create new equipment category',
  'library.add.device': '+ Device',
  'library.search.placeholder': 'Search… (Ctrl+F)',
  'library.search.clear': 'Clear search',
  'library.collapseAll': 'Collapse all',
  'library.expandAll': 'Expand all',
  'library.dragHint': 'Drag onto canvas or click to add',
  'library.empty.search': 'No matches for "{query}"',
  'library.empty.dragHere': 'Drag a device here to move it',
  'library.template.editTitle': 'Edit template (name, category)',
  'library.create.title': 'Create your own device',
  'library.create.name': 'Name',
  'library.create.category': 'Category',
  'library.create.suggest': 'Auto-suggest from device name',
  'library.create.suggest.heuristic': '📐 Heuristic',
  'library.create.suggest.heuristicTitle':
    'Built-in heuristic patterns (camera, ATEM, converter…)',
  'library.create.suggest.web': '🌐 Web',
  'library.create.suggest.webBusy': 'Searching…',
  'library.create.suggest.webTitle':
    'Wikipedia + DuckDuckGo snippet (no API key required)',
  'library.create.suggest.gemini': '✨ Gemini',
  'library.create.suggest.geminiBusy': 'Asking…',
  'library.create.suggest.geminiTitle': 'Gemini AI — needs an API key',
  'library.create.aiSettings': '⚙ AI settings',
  'library.create.aiKey.title': 'Gemini API key',
  'library.create.aiKey.placeholder': 'AIza…',
  'library.create.aiKey.save': 'Save',
  'library.create.aiKey.cancel': 'Cancel',
  'library.create.portGroups': 'Port groups',
  'library.create.addInputGroup': '+ Input group',
  'library.create.addOutputGroup': '+ Output group',
  'library.create.noGroups': 'No port groups yet. Add one above.',
  'library.create.cancel': 'Cancel',
  'library.create.save': 'Save to library',
  'library.create.savePlace': 'Save + place',
  'library.create.savePlaceTitle': 'Save and drop one on the canvas',
  'library.create.saveTitle': 'Save to custom library for re-use',
  'library.create.is19Inch': '19" rack device',
  'library.create.height': 'HE',

  // Equipment properties
  'eq.section.identity': 'Identity',
  'eq.section.appearance': 'Appearance',
  'eq.section.network': 'Network',
  'eq.section.ports': 'Ports',
  'eq.section.atem': 'ATEM',
  'eq.section.rack': 'Rack',
  'eq.section.library': 'Library',
  'eq.field.name': 'Name',
  'eq.field.subtitle': 'Subtitle',
  'eq.field.subtitleHint': 'optional, e.g. "PGM monitor"',
  'eq.field.subtitlePlaceholder': 'Subtitle…',
  'eq.field.category': 'Category',
  'eq.field.color': 'Device colour',
  'eq.field.colorReset': 'Reset colour',
  'eq.field.colorTitle': 'Device node colour',
  'eq.field.colorResetBtn': '✕ reset',
  'eq.field.icon': 'Icon',
  'eq.field.iconHint': 'glyph or emoji, max 2 chars — empty = automatic',
  'eq.field.iconAuto': 'auto',
  'eq.field.iconAutoTitle': 'Reset to automatic',
  'eq.field.compact': 'Compact display',
  'eq.field.compactHint': 'icon + name only, ports as dots',
  'eq.field.serial': 'Serial number',
  'eq.field.serialPlaceholder': 'S/N',
  'eq.field.ip': 'IP address',
  'eq.field.subnet': 'Subnet mask',
  'eq.field.subnetPlaceholder': '255.255.255.0 or /24',
  'eq.field.username': 'Username',
  'eq.field.password': 'Password',
  'eq.field.passwordShow': 'Show password',
  'eq.field.passwordHide': 'Hide password',
  'eq.field.mac': 'MAC address',
  'eq.field.firmware': 'Firmware',
  'eq.field.mgmtUrl': 'Management URL',
  'eq.field.notes': 'Notes',
  'eq.field.manufacturerUrl': 'Manufacturer link',
  'eq.field.manufacturerUrlHint': 'optional, for datasheet access',
  'eq.field.manufacturerUrlOpen': 'Open ↗',
  'eq.field.refImage': 'Reference image',
  'eq.field.refImageHint': 'e.g. port layout',
  'eq.field.refImageNone': 'No image',
  'eq.field.refImageReplace': 'Replace…',
  'eq.field.refImageRemove': 'Remove',

  // Cable properties
  'cable.title': 'Cable',
  'cable.field.name': 'Name',
  'cable.field.namePlaceholder': 'Cable name',
  'cable.field.length': 'Length (m)',
  'cable.field.color': 'Colour',
  'cable.field.routing': 'Routing',
  'cable.field.dashed': 'Dashed',
  'cable.field.arrowStart': 'Arrow ◄',
  'cable.field.arrowEnd': 'Arrow ►',
  'cable.field.connection': 'Connection',
  'cable.field.fromDevice': 'From device',
  'cable.field.fromPort': 'Port',
  'cable.field.toDevice': 'To device',
  'cable.field.toPort': 'Port',
  'cable.action.delete': 'Delete cable',
  'cable.action.openEdit': 'Open editor…',
  'cable.warn.fromBusy': '⚠ Source port already in use by "{name}".',
  'cable.warn.toBusy': '⚠ Target port already in use by "{name}".',
  'cable.warn.connectorMismatch':
    '⚠ Connector types differ: {from} ↔ {to}',
  'cable.warn.converterSuggest': 'Matching converters from your library:',
  'cable.warn.converterNone':
    'No matching converter in the library. Add one via "+ Device" or Rentman import.',
  'cable.click.placeholder': 'Click a cable to see properties.',

  // Location properties
  'location.title': 'Location',
  'location.field.name': 'Name',
  'location.field.width': 'Width',
  'location.field.height': 'Height',
  'location.field.floor': 'Floor',
  'location.field.floorPlaceholder': 'e.g. ground floor, 1st',
  'location.field.color': 'Colour',
  'location.field.notes': 'Notes',
  'location.action.bom': '📋 Export BOM',
  'location.action.bomTitle':
    'List of devices and cables in the frame — exportable as PDF',
  'location.action.deleteFrame': 'Delete frame only',
  'location.action.deleteFrameTitle':
    'Removes only the frame — devices inside stay on the canvas.',
  'location.action.deleteAll': 'Delete frame + contents',
  'location.confirm.deleteFrame': 'Delete frame "{name}"?',
  'location.confirm.deleteFrameBody': 'Devices inside stay on the canvas.',
  'location.confirm.deleteAll': 'Delete frame "{name}" AND its contents?',
  'location.confirm.deleteAllBody':
    'All devices in the frame and their cables are deleted as well.',
  'location.tip':
    'Tip: the frame moves independently by default. Enable "Take devices along" to move all contained devices with the frame.',

  // Template properties
  'template.title': 'Template',
  'template.field.name': 'Name',
  'template.field.category': 'Category',
  'template.action.place': 'Place on canvas',
  'template.action.delete': 'Delete template',
  'template.action.deleteConfirm': 'Delete template "{name}"?',
  'template.field.inputs': 'Inputs',
  'template.field.outputs': 'Outputs',

  // Rentman import dialog
  'rentman.import.title': 'Import from Rentman',
  'rentman.import.close': 'Close',
  'rentman.import.cancel': 'Cancel import',
  'rentman.import.loading': 'Loading…',
  'rentman.import.noToken':
    'No Rentman API token configured. Open Settings → Integrations → Rentman API.',
  'rentman.import.selectProject': 'Select a Rentman project',
  'rentman.import.shown': '{visible} of {total} shown',
  'rentman.import.selected': '{count} selected',
  'rentman.import.inSets': '· {count} in sets (expand to view)',
  'rentman.import.linkable': '🔗 Link…',
  'rentman.import.linkableTitle': 'Link to existing local device',
  'rentman.import.unlinked':
    'Save token first to be able to fetch projects.',

  // ATEM audio router dialog
  'atem.audio.title': 'ATEM audio configuration',
  'atem.audio.empty.title': 'ATEM audio configuration',
  'atem.audio.empty.body':
    'Load an ATEM Profile XML (e.g. exported from ATEM Software Control).',
  'atem.audio.empty.matrix':
    'Fairlight-capable models (Constellation / 4 M/E) open with the crosspoint matrix.',
  'atem.audio.empty.classic':
    'Production Studio / Television Studio open with the classic channel strip (Off/On/AFV + gain).',
  'atem.audio.empty.both': 'Devices with both sections get both tabs.',
  'atem.audio.action.loadXml': '📂 Load XML',
  'atem.audio.action.loadXmlTitle':
    'Load ATEM Profile XML — the audio section(s) will be imported into the editor',
  'atem.audio.action.saveXml': '💾 Save XML',
  'atem.audio.action.saveXmlTitle':
    'Download patched Profile XML (all non-audio sections stay unchanged)',
  'atem.audio.action.clearAll': 'Reset all routings',
  'atem.audio.action.clearAllConfirm': 'Reset all routings to "No Audio"?',
  'atem.audio.action.clearAllOk': 'Reset',
  'atem.audio.action.saveProject': 'Save in project',
  'atem.audio.action.saveProjectTitle':
    'Persist routing in the project (survives reload).',
  'atem.audio.action.cancel': 'Cancel',
  'atem.audio.tab.matrix': '🎚 Routing matrix',
  'atem.audio.tab.classic': '🎛 Classic mixer',
  'atem.audio.matrix.tooLarge':
    '{count} visible crosspoints is too many for smooth display. Please narrow down via the filters above (target: under 12,000 cells).',
  'atem.audio.matrix.filterSources': 'Filter sources…',
  'atem.audio.matrix.filterOutputs': 'Filter outputs…',
  'atem.audio.matrix.visible': '{sources} × {outputs} visible',
  'atem.audio.classic.empty':
    'No {tab} in the loaded profile. Switch tab or load a profile that has this section.',
  'atem.audio.summary':
    'Matrix: {sources} sources × {outputs} outputs · {routed} active routings',
  'atem.audio.summaryClassic':
    'Classic mixer: {count} inputs · {live} active (On / AFV)',
  'atem.audio.footer':
    'Non-destructive: only audio attributes are changed; every other profile section is preserved.',

  // ConfirmDialog labels
  'confirm.delete': 'Delete',
  'confirm.discard': 'Discard',
  'confirm.applyAll': 'Apply',

  // Canvas toolbar
  'toolbar.dragHandle': 'Move toolbar',
  'toolbar.groupName.placeholder': 'Group name…',
  'toolbar.groupName.save': 'Save group',
  'toolbar.groupName.cancel': 'Cancel',
  'toolbar.defaults.button': 'Defaults',
  'toolbar.defaults.title': 'Default behaviour for new cables + appearance',
  'toolbar.defaults.modified': 'At least one default has been changed',
  'toolbar.defaults.routing': 'Cable routing',
  'toolbar.defaults.routing.ortho': 'Ortho',
  'toolbar.defaults.routing.straight': 'Direct',
  'toolbar.defaults.routing.curved': 'Curved',
  'toolbar.defaults.cableColor': 'Cable colour',
  'toolbar.defaults.cableColor.byType': 'By type',
  'toolbar.defaults.cableColor.byLength': 'By length',
  'toolbar.defaults.cableColor.legend': 'Show length-colour legend',
  'toolbar.defaults.misc': 'Other',
  'toolbar.defaults.arrowEnd': 'Arrow at cable end',
  'toolbar.defaults.arrowEndHint': 'Newly drawn cables get an arrow',
  'toolbar.defaults.bumps': 'Cable bumps at crossings',
  'toolbar.defaults.bumpsHint': 'Global default — overridable per cable via right-click',
  'toolbar.defaults.hideLabels': 'Hide all cable labels',
  'toolbar.defaults.hideLabelsHint':
    'Global toggle. Per-cable label position is preserved — re-enable to bring labels back.',
  'toolbar.defaults.shortLabel': 'Cable labels: short form',
  'toolbar.defaults.shortLabelHint':
    'Strip the format suffix (e.g. "(1080p50/60)") from the display label. Full name stays in the cable properties.',
  'toolbar.defaults.portsByType': 'Colour ports by connector type',
  'toolbar.defaults.portsByTypeHint':
    'SDI = amber, HDMI = violet, Ethernet = green, …',
  'toolbar.location.add': 'Add new location frame',
  'toolbar.location.addAround': 'Frame around the {count} selected devices',
  'toolbar.location.defaultName': 'New location',
  'toolbar.group.save': 'Save {count} selected devices as a group',
  'toolbar.group.defaultName': 'Group {time}',
  'toolbar.rack.arrange': 'Arrange the {count} selected devices in the 2D rack builder',
  'toolbar.rack.edit': 'Edit this rack in the 2D rack builder',
  'toolbar.align.left': 'Left align',
  'toolbar.align.leftViewport': 'Align to left viewport edge',
  'toolbar.align.centerH': 'Centre horizontally',
  'toolbar.align.centerHViewport': 'Centre horizontally in viewport',
  'toolbar.align.right': 'Right align',
  'toolbar.align.rightViewport': 'Align to right viewport edge',
  'toolbar.align.top': 'Top align',
  'toolbar.align.topViewport': 'Align to top viewport edge',
  'toolbar.align.centerV': 'Centre vertically',
  'toolbar.align.centerVViewport': 'Centre vertically in viewport',
  'toolbar.align.bottom': 'Bottom align',
  'toolbar.align.bottomViewport': 'Align to bottom viewport edge',
  'toolbar.align.distH': 'Distribute horizontally',
  'toolbar.align.distV': 'Distribute vertically',
  'toolbar.lock.frames.locked': 'Unlock frames',
  'toolbar.lock.frames.unlocked': 'Lock frames (no frame moves)',
  'toolbar.lock.equipment.locked': 'Unlock devices',
  'toolbar.lock.equipment.unlocked': 'Lock devices (no device moves)',
  'toolbar.lock.cables.locked': 'Unlock cables',
  'toolbar.lock.cables.unlocked': 'Lock cables (no waypoint editing)',
  'toolbar.planLock.viewer': 'Viewer file — read-only',
  'toolbar.planLock.finalized': 'Plan is finalised (click: re-enable editing)',
  'toolbar.planLock.editing': 'Mark plan as finalised',
  'toolbar.planLock.label.viewer': 'Viewer',
  'toolbar.planLock.label.finalized': 'Finalised',
  'toolbar.planLock.label.editing': 'Finalise',
  'toolbar.planLock.finalize.title': 'Finalise plan?',
  'toolbar.planLock.finalize.body':
    'The canvas will be locked — no moving, new connections or deletions. You can re-enable editing any time.',
  'toolbar.planLock.finalize.ok': 'Finalise',
  'toolbar.planLock.unlock.title': 'Re-enable plan editing?',
  'toolbar.planLock.unlock.body': 'Devices, cables and layout can then be changed again.',
  'toolbar.planLock.unlock.ok': 'Re-enable',
  'toolbar.annotations.hide': 'Hide annotation badges on canvas (data stays)',
  'toolbar.annotations.show': 'Show annotation badges on canvas',
  'toolbar.annotations.openViewer': 'Annotations — leave reviewer notes',
  'toolbar.annotations.open': 'Show / manage annotations',
  'toolbar.annotations.label': 'Annotations',
  'toolbar.lengthLegend.title': 'Length colours',
  'toolbar.lengthLegend.close': 'Close',

  // Status bar (bottom of canvas)
  'status.zoom': 'Zoom',
  'status.zoomReset': 'Reset to 100 %',
  'status.zoomFit': 'Fit content to viewport',
  'status.equipment': '{count} devices',
  'status.cables': '{count} cables',
  'status.locations': '{count} locations',
  'status.coordinate': 'Cursor',
  'status.savedAt': 'Saved {time}',
  'status.unsaved': 'Unsaved changes',
  'status.autosaved': 'Auto-saved',

  // Properties panel placeholder
  'props.empty': 'Click an item on the canvas to see its properties.',
  'props.tab.equipment': 'Equipment',
  'props.tab.cable': 'Cable',
  'props.tab.location': 'Location',
  'props.tab.template': 'Template',

  // PortList
  'ports.title.inputs': 'Inputs',
  'ports.title.outputs': 'Outputs',
  'ports.add': '+ Port',
  'ports.add.title': 'Add a new port',
  'ports.empty': 'No {kind} yet. Use "+ Port" to add one.',
  'ports.col.name': 'Name',
  'ports.col.type': 'Connector type',
  'ports.col.standard': 'Standard',
  'ports.col.notes': 'Notes',
  'ports.col.delete': 'Delete port',
  'ports.namePlaceholder': 'Port name',
  'ports.deleteConfirm': 'Delete port "{name}"?',
  'ports.deleteConfirmBody':
    'Cables attached to this port get detached automatically. The port itself disappears from the device.',
  'ports.dragHandle': 'Reorder port',
  'ports.bulkAdd': 'Bulk add…',
  'ports.bulkAdd.title': 'Add multiple ports at once',
  'ports.bulkAdd.prompt': 'Names (one per line)',
  'ports.contentLabel': 'Content',
  'ports.contentLabelHint': 'Optional label like "PGM", "PVW", "Cam1"',
  'ports.contentLabelPlaceholder':
    'Content / function (e.g. PGM, PVW, MV1, Cam1) — optional',
  'ports.contentLabelTitle':
    "What goes through this port? Separates 'content' (PGM/PVW) from the hardware standard (SDI 3G/12G).",
  'ports.directionTitle': 'Direction — bidirectional is useful for network/RJ45 ports.',
  'ports.sideTitle': 'Port side on the device: auto uses input/output + global mirroring',
  'ports.atemSourceIdPlaceholder': 'e.g. 8001 for AUX 1',
  'ports.atemSourceIdTitle':
    'Source ID addressed in the MV-Config dialog. AUX = 8001+, PGM = 10010, PVW = 10011, ME 2 PGM = 10020 …. Leave empty on inputs for idx+1 default.',
  'ports.sfp.typePlaceholder': 'Form factor (SFP+)',
  'ports.sfp.typeTitle': 'SFP form factor: SFP, SFP+, SFP28, QSFP+',
  'ports.sfp.standardPlaceholder': 'Standard (10G-LR)',
  'ports.sfp.standardTitle': 'Transceiver standard: 1G-SX, 1G-LX, 10G-SR, 10G-LR, 25G-SR …',
  'ports.sfp.wavelengthPlaceholder': 'Wavelength nm (1310)',
  'ports.sfp.wavelengthTitle': 'Wavelength in nm: 850, 1310, 1550',
  'ports.sfp.vendorPlaceholder': 'Vendor (Cisco)',
  'ports.sfp.vendorTitle': 'Module vendor: Cisco, Aruba, Ubiquiti, FS.com …',
  'ports.quadAuto': 'Auto-assign free BNC ports to this set',

  // Cable / CableDialog
  'cable.dialog.title': 'New cable',
  'cable.dialog.from': 'From:',
  'cable.dialog.to': 'To:',
  'cable.dialog.cancel': 'Cancel',
  'cable.dialog.create': 'Create',
  'cable.dialog.connectionPreview': 'Connection:',
  'cable.dialog.typeLabel': 'Cable type',
  'cable.dialog.lengthLabel': 'Length (m)',
  'cable.dialog.lengthPlaceholder': '0',
  'cable.dialog.nameLabel': 'Cable name',
  'cable.dialog.namePlaceholder': 'Auto-generated if empty',
  'cable.dialog.colorLabel': 'Colour',
  'cable.dialog.notesLabel': 'Notes',
  'cable.dialog.notesPlaceholder': 'Optional notes',
  'cable.dialog.specLabel': 'Cable spec',
  'cable.dialog.specCustom': 'Custom',
  'cable.dialog.needsConverter': 'Needs converter',
  'cable.dialog.standardLabel': 'Standard',

  // Export dialogs
  'export.dialog.title': 'Export plan',
  'export.dialog.cancel': 'Cancel',
  'export.dialog.run': 'Export',
  'export.dialog.format': 'Format',
  'export.dialog.options': 'Options',
  'export.dialog.outputPath': 'Output path',
  'export.dialog.choose': 'Choose…',

  // BOM
  'bom.dialog.title': 'Cable BOM',
  'bom.dialog.close': 'Close',
  'bom.dialog.byType': 'By type',
  'bom.dialog.byLength': 'By length',
  'bom.dialog.exportPdf': 'Export as PDF…',
  'bom.dialog.exportCsv': 'Export as CSV…',
  'bom.dialog.exportXlsx': 'Export as Excel…',
  'bom.dialog.totalLength': 'Total length',
  'bom.dialog.totalCount': 'Total cables',

  // Mobile share
  'mobile.dialog.title': 'Share with mobile',
  'mobile.dialog.close': 'Close',
  'mobile.dialog.qrTitle': 'Scan to open on phone',
  'mobile.dialog.linkTitle': 'Link',
  'mobile.dialog.copyLink': 'Copy link',
  'mobile.dialog.copied': 'Copied ✓',
  'mobile.dialog.intro':
    'A read-only mobile view of the plan. The phone can check off ports/cables; checks sync back to the canvas.',

  // GraphML import
  'graphml.dialog.title': 'Import GraphML / yEd',
  'graphml.dialog.cancel': 'Cancel',
  'graphml.dialog.confirm': 'Import',
  'graphml.dialog.replace': 'Replace existing GraphML import',
  'graphml.dialog.append': 'Append (keep existing devices)',
  'graphml.dialog.unresolved': '{count} edges could not be resolved and will be dropped.',

  // Status bar (right side of canvas footer)
  'statusbar.equipment': '{count} devices',
  'statusbar.cables': '{count} cables',
  'statusbar.locations': '{count} frames',
  'statusbar.packed': '✓ {packed}/{total} packed',
  'statusbar.packedTitle': 'Devices marked as "packed" in their properties',
  'statusbar.complexity.title':
    'Complexity: heuristic from (devices + cables) count. Helps gauge readability + performance.',
  'statusbar.complexity.xl': 'XL',
  'statusbar.complexity.large': 'Large',
  'statusbar.complexity.medium': 'Medium',
  'statusbar.complexity.small': 'Small',
  'statusbar.complexity.new': 'New',
  'statusbar.rentman.label': 'Rentman:',
  'statusbar.rentman.tokenReady': 'Token ready',
  'statusbar.rentman.standalone': 'Standalone',
  'statusbar.zoom': 'Zoom:',
  'statusbar.aboutTitle': 'About Cable Planner',

  // Properties panel chrome
  'inspector.title': 'Inspector',
  'inspector.subtitle': 'Properties',
  'inspector.title.equipment': 'Device: {name}',
  'inspector.title.cable': 'Cable: {name}',
  'inspector.title.location': 'Frame: {name}',
  'inspector.title.template': 'Template: {name}',
  'inspector.collapse.show': 'Show properties',
  'inspector.collapse.hide': 'Hide properties',
  'inspector.float.title': 'Undock properties (free-floating)',
  'inspector.float.aria': 'Undock properties',
  'inspector.nothingSelected': 'Nothing selected',
  'inspector.nothingSelectedBody':
    'Pick a device, cable, frame or library template.',
  'inspector.hints.title': 'Quick orientation',
  'inspector.hints.placeFromLibrary': 'Drop devices from the library on the canvas.',
  'inspector.hints.connectPorts': 'Connect ports to create cables.',
  'inspector.hints.saveGroup': 'Select multiple devices and save them as a group from the canvas.',
  'inspector.hints.rentmanLocation': 'Rentman actions live in the Equipment tab under Rentman.',

  // Cable properties (placeholders + titles still missing)
  'cable.field.maxReach': 'Max. reach (m)',
  'cable.field.maxReachPlaceholder': 'e.g. 100',
  'cable.field.layer': 'Layer',
  'cable.field.layerTitle': 'Works with the layer filter in the toolbar (layer chips)',
  'cable.field.strokeWidth': 'Stroke width ({width}px)',
  'cable.field.labelPosition': 'Label position',
  'cable.field.labelSlider': 'Slider:',
  'cable.field.labelSliderTitle': 'Fine-tune label along the cable (0 = start, 1 = end)',
  'cable.field.labelSliderReset': 'Reset slider — preset becomes active again',
  'cable.field.endpointLabels': 'Endpoint labels (→ pointing to the other end)',
  'cable.field.bidirectional': 'Bidirectional cable',
  'cable.field.bidirectionalTitle':
    'Bidirectional cable (e.g. USB, Ethernet, fibre) — arrows on both sides',
  'cable.field.wireless': 'Wireless connection (no cable)',
  'cable.field.frequencyLabel': 'Frequency (e.g. 5.8 GHz)',
  'cable.field.frequencyPlaceholder': 'e.g. 5.8 GHz, 600 MHz',
  'cable.field.channelLabel': 'Channel',
  'cable.field.channelPlaceholder': 'e.g. 36, 6, 149',
  'cable.field.notes': 'Notes',
  'cable.edit.typeStandard': 'Edit cable type / standard',
  'cable.fromDeviceShort': 'From device',
  'cable.toDeviceShort': 'To device',
  'cable.portShort': 'Port',

  // Location properties (extra fields)
  'location.field.notesPlaceholder': 'Notes about this frame',
  'location.field.takeContents': 'Take devices along',
  'location.field.takeContentsHint':
    'When the frame moves, devices inside follow. Without this, the frame moves independently.',

  // FloatingPanelShell
  'panel.dock': 'Dock',
  'panel.dockTitle': 'Dock (back to side column)',
  'splitter.resize': 'Resize column',

  // Routing toggle (shared across toolbar, properties, settings)
  'routing.orthogonal.label': 'Ortho',
  'routing.orthogonal.hint': 'Right-angled routing (draw.io default)',
  'routing.straight.label': 'Straight',
  'routing.straight.hint': 'Straight line',
  'routing.curved.label': 'Curved',
  'routing.curved.hint': 'Bézier curve',

  // ColorField (shared color picker)
  'colorField.resetTitle': 'Reset colour',
  'colorField.resetBtn': '✕ Reset',

  // PrintDialog
  'print.title': 'Print',
  'print.noneSelected': 'No device selected',
  'print.selectionCount': '{count} device(s) selected',
  'print.busy': 'Generating PDF…',
  'print.startJobs': '🖨 Start {count} print jobs',
  'print.openDialog': '🖨 Open printer dialog',
  'print.downloadMany': '⬇ Download {count} PDFs',
  'print.downloadOne': '⬇ Download patch-sheet PDF',
  'print.osHint.title': 'OS printer hint',
  'print.osHint.body':
    "When printing, your operating system's print dialog opens — there you can pick the printer, paper size (A4 / A3 / Letter), orientation and copy count.",
  'print.osHint.exports': 'Plan exports as PDF / PNG / JPEG are now under',
  'print.osHint.exportsPath': 'File → Export plan',
  'print.devices.title': 'Per device (patch sheet)',
  'print.devices.body':
    'Select individual devices and generate an A4/A3 patch list with all ports + connected cables — to stick on the device.',
  'print.devices.searchPlaceholder': 'Search (name, category, subtitle)…',

  // Device mode picker (multi-mode devices, e.g. ATEM, Pixelhue, Tessera)
  'modes.intro':
    "Switches the device's port layout. Cables on ports that don't exist in the new mode stay in the project but need to be re-plugged.",
  'modes.emptyState':
    'No modes defined yet. Edit ports above, then save the current layout via "+ from current layout".',
  'modes.newPrompt':
    'Name of the new mode (e.g. "12G Single-Link" / "HDMI Output Mode"):',
  'modes.newDefaultName': 'Mode {n}',
  'modes.renamePrompt': 'Mode name:',
  'modes.descPrompt': 'Short description (e.g. "1x 12G IN, 4x HDMI OUT"):',
  'modes.deleteConfirm': 'Delete mode "{name}"?',
  'modes.deleteConfirmBody': 'The corresponding ports stay on the device.',
  'modes.captureConfirm': 'Save current port layout as definition for "{name}"?',
  'modes.active': 'Active',
  'modes.activate': 'Activate',
  'modes.editor': 'Editor',
  'modes.editorTitle': 'Open mode in editor (name, description, ports in one place)',
  'modes.name': 'Name',
  'modes.renameTitle': 'Rename mode',
  'modes.desc': 'Description',
  'modes.descTitle': 'Edit description',
  'modes.capture': 'Capture ports',
  'modes.captureTitle': 'Adopt current port layout into this mode',
  'modes.deleteTitle': 'Delete mode',
  'modes.newEditor': '+ New mode (editor)',
  'modes.newEditorTitle':
    'Opens an editor where name, description and ports of the new mode can be configured (Issue #113).',
  'modes.quickSave': '+ Save from current layout',
  'modes.quickSaveTitle':
    "Saves the device's current port layout as a new mode (quick-save).",

  // ModeEditorDialog
  'modeEditor.titleEdit': 'Edit mode',
  'modeEditor.titleNew': 'New operating mode',
  'modeEditor.createBtn': 'Create mode',
  'modeEditor.namePlaceholder': 'e.g. "12G Single-Link", "4K mode", "Workshop layout"',
  'modeEditor.nameConflict': 'A mode with this name already exists.',
  'modeEditor.descLabel': 'Description (optional)',
  'modeEditor.descPlaceholder': 'e.g. limits outputs to 2 in 4K mode (lower resource use)',
  'modeEditor.portCount': '{count} port(s) in this mode',
  'modeEditor.seedTitle': "Adopt the device's CURRENT port layout as a starting point.",
  'modeEditor.seedBtn': '⬇ Adopt current device layout',
  'modeEditor.emptySide': 'No {kind} in this mode.',
  'modeEditor.removePort': 'Remove port',
  'common.name': 'Name',
  'common.hide': 'Hide',

  // Rack builder dialog
  'rack.badge.edit': 'Editing',
  'rack.badge.new': 'New',
  'rack.unsavedTitle': 'Unsaved changes',
  'rack.unsavedLabel': 'Unsaved',
  'rack.subtitle':
    '2D rack builder · Add devices from the library, drag for U position, internal cabling',
  'rack.closeShortcut': 'close',
  'rack.exportTitle': 'Export rack (PNG / STL / .cpgroup)',
  'rack.exportBtn': 'Export',
  'rack.closeTitle': 'Close (Esc)',
  'rack.field.name': 'Rack name',
  'rack.field.namePlaceholder': 'e.g. "Power rack A" or "Main video rack"',
  'rack.field.height': 'Height',
  'rack.field.depth': 'Depth',
  'rack.zoom': 'Zoom',
  'rack.zoomOut': 'Zoom out',
  'rack.zoomSliderTitle': 'Scales U height. Auto-fit fits the rack into the visible area.',
  'rack.zoomIn': 'Zoom in',
  'rack.zoomFitTitle': 'Back to 100 % (auto-fit)',
  'rack.zoomFit': 'Fit',
  'rack.saveBlocked': 'Saving blocked:',
  'rack.conflicts': 'Conflicts ({count})',
  'rack.layout': 'Rack layout',
  'rack.tab2dTitle': '2D editor: front / rear as panel views',
  'rack.tab3dTitle':
    '3D visualisation with front/rear depth and rotation. Read-only — editing happens in the 2D tab.',
  'rack.patchPanelTitle': 'Create new patch panel: height, port count, connector type',
  'rack.patchPanelBtn': '+ Patch panel',
  'rack.shelfTitle': 'Create rack shelf for non-19" gear',
  'rack.shelfBtn': '+ Rack shelf',
  'rack.searchDevicesPlaceholder': 'Search device…',
  'rack.showNonRackTitle':
    'When active, templates that are not marked as 19" rack devices are also shown. Adding one will ask for the U height.',
  'rack.showNonRack': 'Include non-rack devices',
  'rack.noMatchesPre': 'No matches for',
  'rack.noRackDevices': 'No rack devices available.',
  'rack.activatePrompt': 'enable?',
  'rack.saveEditTitle': 'Save changes to the rack',
  'rack.saveNewTitle': 'Save rack as a new library group',
  'rack.saveNewBtn': 'Save rack',

  // NetworkConfig (switch / router config in equipment properties)
  'net.routerConfig': 'Router config',
  'net.switchConfig': 'Switch config',
  'net.mgmtVlan': 'Management VLAN',
  'net.gateway': 'Gateway',
  'net.firmware': 'Firmware',
  'net.mgmtUrl': 'Management URL',
  'net.noVlans': 'No VLANs defined.',
  'net.vlans': 'VLANs',
  'net.addVlan': '+ VLAN',
  'net.vlanNamePlaceholder': 'Name (e.g. Production)',
  'net.vlanNotePlaceholder': 'Note',
  'net.portToVlan': 'Port → VLAN',
  'net.col.port': 'Port',
  'net.col.untagged': 'Untagged',
  'net.col.tagged': 'Tagged',

  // Videohub export dialog
  'videohub.formatTitle':
    'Determines only the format of the preview / file output below. The direct TCP push (Labels/Routing buttons) is independent.',
  'videohub.optFullRouting': 'Full routing dump (Protocol 2.5)',
  'videohub.optLabelsOnly': 'Labels only (Input, n, name)',
  'videohub.matrixView': 'Crosspoint matrix',
  'videohub.listView': 'List view with dropdown per output',
  'videohub.suggestTitle':
    'Suggests a routing based on the cables on the canvas. Best-match by device-name similarity; falls back to diagonal. Editable in the matrix.',
  'videohub.resetDiag': 'Reset diagonal routing (output N → input N)',
  'videohub.saveSalvo': 'Save current routing as named snapshot',
  'videohub.deleteSalvo': 'Delete salvo',
  'videohub.recentConns': 'Recent connections',
  'videohub.mdnsTitle': 'Discover Videohubs on the local network via mDNS/Bonjour (3 s scan).',
  'videohub.loadStatus':
    'Pull current hub state: labels + routing + locks. Routing flows into the matrix, labels appear in columns/rows.',
  'videohub.sendLabelsTitle':
    'Send INPUT LABELS + OUTPUT LABELS only. Routing on the hub stays untouched.',
  'videohub.sendRoutingTitle': 'Send VIDEO OUTPUT ROUTING only. Labels on the hub unchanged.',
  'videohub.sendBothTitle': 'Labels + routing in ONE push (three blocks back-to-back).',
  'videohub.hubStatus': 'Hub status:',
  'videohub.preview': 'Preview',

  // CableLibraryPanel
  'cableLib.title': 'Cable library',
  'cableLib.namePlaceholder': 'e.g. CAT6a patch 5 m',
  'cableLib.connectorType': 'Connector type',
  'cableLib.newConnectorTypePrompt': 'New connector type (e.g. "Speakon NL4"):',
  'cableLib.addConnectorTitle': 'Add new connector type',
  'cableLib.color': 'Cable colour',
  'cableLib.compatibleWith': 'Also compatible with (optional)',
  'cableLib.signalStandards': 'Signal standards',
  'cableLib.newSignalStandardPrompt': 'New signal standard (e.g. "Dante Primary"):',
  'cableLib.addSignalStandardTitle': 'Add new signal standard',
  'cableLib.maxLength': 'Max. length (m) — optional',
  'cableLib.note': 'Note (optional)',
  'cableLib.notePlaceholder': 'e.g. indoor only, shielded, …',
  'cableLib.newSpecTitle': 'Create new cable type (custom library preset)',
  'cableLib.customBadge': 'Custom cable type (created locally)',
  'cableLib.overrideBadge': 'Built-in spec with local override (reset via edit dialog)',
  'cableLib.removeOverride': 'Remove override (reset to default)',
  'cableLib.deleteSpec': 'Delete cable type',
  'cableLib.groupReorder': 'Move group',
  'cableLib.groupReorderTitle': 'Drag & drop to reorder',

  // ATEM dialogs
  'atem.dialog.title': 'ATEM live integration',
  'atem.dialog.discoverTitle': 'Discover ATEM switchers on the local network via mDNS (Bonjour)',
  'atem.dialog.mvLive': 'Show multiviewer layout live',
  'atem.mv.idPlaceholder': 'ID',
  'atem.mv.maxWindows': 'Max windows:',
  'atem.mv.removeOverride': 'Remove override — back to auto-detection',
  'atem.mv.addMv': 'Add multiviewer',
  'atem.mv.removeMv': 'Remove last multiviewer',
  'atem.mv.layoutLabel': 'Layout',
  'atem.mv.savePng': 'Save current MV layout as PNG',
  'atem.audio.classicReadOnly':
    'The loaded XML also contains a classic AudioMixer section. It is round-tripped on save but is not editable here.',
  'atem.audio.freshMatrix': 'Fresh crosspoint matrix with the ATEM default inputs + 8 output busses.',
  'atem.audio.resetAllConfirm': 'Reset all routings to "No Audio"?',
  'atem.audio.filterSourcesPlaceholder': 'Filter sources…',
  'atem.audio.filterSourcesTitle': 'Substring filter for audio sources (rows)',
  'atem.audio.filterSourcesAria': 'Filter sources',
  'atem.audio.filterOutputsPlaceholder': 'Filter outputs…',
  'atem.audio.filterOutputsTitle': 'Substring filter for audio outputs (columns)',
  'atem.audio.filterOutputsAria': 'Filter outputs',
  'atem.audio.sourcesCheckTitle':
    'Check sources individually (e.g. MADI, Mic, Tape …)',
  'atem.audio.outputsCheckTitle':
    'Check outputs individually (e.g. skip Out 5/6, 7/8)',
  'atem.audio.sourcesLabel': 'Sources',
  'atem.audio.outputsLabel': 'Outputs',

  // ExportDialog (sections list, BOM table)
  'export.title': 'Export & print',
  'export.format': 'Format',
  'export.renderMode': 'Render mode',
  'export.section.plan': 'Plan',
  'export.section.patch': 'Patch sheets',
  'export.section.bom': 'Cable BOM',
  'export.patch.compactTitle':
    'Compact patch list: all cables on one list, sorted by source device — to print for the on-site technician.',
  'export.patch.perDevice': 'One PDF per selected device',
  'export.patch.batchPdf': 'Batch PDF — one device per page',
  'export.patch.osPrint': 'Open patch sheet(s) in OS print dialog',
  'export.bom.col.type': 'Type',
  'export.bom.col.length': 'Length (m)',
  'export.bom.col.installed': 'Installed',
  'export.bom.col.rentmanPlanned': 'Rentman planned',
  'export.bom.col.diff': 'Diff',
  'export.bom.csvTitle': 'Download table as CSV (UTF-8 with BOM for Excel)',
  'export.bom.pdfTitle': 'Download table as PDF',
  'export.bom.osPrint': 'Open cable BOM in OS print dialog',

  // GreenGo export dialog
  'greengo.title': 'GreenGo Intercom planning',
  'greengo.tab.matrix': 'Overview',
  'greengo.tab.users': 'Stations',
  'greengo.tab.groups': 'Groups',
  'greengo.tab.system': 'System',
  'greengo.matrix.emptyBoth':
    'No stations or groups yet — switch to the "Stations" and "Groups" tabs.',
  'greengo.matrix.emptyUsers': 'No stations yet — switch to the "Stations" tab.',
  'greengo.matrix.emptyGroups': 'No groups yet — switch to the "Groups" tab.',
  'greengo.col.station': 'Station',
  'greengo.col.type': 'Type',
  'greengo.col.deviceCanvas': 'Device (canvas)',
  'greengo.option.unassigned': '— unassigned —',
  'greengo.noIntercomCanvas': 'no intercom on canvas',
  'greengo.toggle.removeTitle': 'Remove {user} from "{group}"',
  'greengo.toggle.addTitle': 'Add {user} to "{group}"',
  'greengo.members': 'Members',
  'greengo.unassigned': 'unassigned',
  'greengo.devicesOnCanvas': 'GreenGo devices on the canvas',
  'greengo.addStation': '+ Station',
  'greengo.addStationLong': '+ Add station',
  'greengo.addGroup': '+ Group',
  'greengo.users.intro':
    'Up to {max} stations. Assign groups via clicks in the "Overview" tab.',
  'greengo.users.empty': 'No stations yet. Click "+ Station" to begin.',
  'greengo.users.namePlaceholder': 'Station name (e.g. control room)',
  'greengo.users.assignTitle': 'Assign device on the canvas',
  'greengo.users.deviceShort': '— Device —',
  'greengo.groups.intro': 'Up to {max} talk groups.',
  'greengo.groups.empty': 'No groups yet. Click "+ Group" to create a talk group.',
  'greengo.groups.namePlaceholder': 'Group name (e.g. CAM)',
  'greengo.system.systemName': 'System name',
  'greengo.system.systemNamePlaceholder': 'Production',
  'greengo.system.description': 'Description',
  'greengo.system.descriptionPlaceholder': 'optional',
  'greengo.system.multicast': 'Multicast address',
  'greengo.system.multicastHint':
    'Default: 239.1.160.1 — must be unique on the network.',
  'greengo.system.sampleRate': 'Sample rate',
  'greengo.system.sampleRate32': '32000 Hz (GreenGo default)',
  'greengo.system.sampleRate48': '48000 Hz',
  'greengo.footer.stations': 'stations',
  'greengo.footer.groups': 'groups',
  'greengo.footer.devicesOnCanvas': 'devices on canvas',
  'greengo.import.gg5Title':
    'Import .gg5 file and link to canvas devices',
  'greengo.import.gg5': '⬆ Import .gg5',
  'greengo.import.xlsxTitle':
    'Upload intercom-matrix Excel — users + groups will be merged into the GreenGo configuration.',
  'greengo.import.xlsx': '📊 Import Excel matrix',
  'greengo.export.xlsxTitle':
    'Download current GreenGo configuration as an intercom-matrix Excel (for print / hand-off).',
  'greengo.export.xlsx': '📊 Export Excel matrix',
  'greengo.saveProject': 'Save in project',
  'greengo.export.gg5': '⬇ Export as .gg5',
  'greengo.importOverlay.title': 'Import .gg5 — link devices',
  'greengo.importOverlay.system': 'System:',
  'greengo.importOverlay.importedGroups': 'Imported groups',
  'greengo.importOverlay.linkStations': 'Link stations → canvas devices',
  'greengo.importOverlay.linkHint':
    'Pick the matching canvas device for each imported station. Auto-detected matches are pre-filled.',
  'greengo.importOverlay.col.nameFromGg5': 'Name (from .gg5)',
  'greengo.importOverlay.col.groups': 'Groups',
  'greengo.importOverlay.col.deviceCanvas': 'Device on canvas',
  'greengo.importOverlay.noGroups': 'none',
  'greengo.importOverlay.dontLink': '— do not link —',
  'greengo.importOverlay.noIntercomCanvas': 'No intercom on canvas',
  'greengo.importOverlay.linkedCount': '{linked} of {total} stations linked',
  'greengo.importOverlay.cancel': 'Cancel',
  'greengo.importOverlay.apply': 'Apply →',

  // GraphML import dialog
  'graphml.dialog.heading': 'Import yEd / GraphML',
  'graphml.dialog.closeAria': 'Close',
  'graphml.dialog.importerTitle': 'yEd / GraphML importer',
  'graphml.dialog.empty.intro1': 'Pick a',
  'graphml.dialog.empty.intro2':
    'file. Cable Planner auto-detects devices, ports and cables — you get a preview where you can include or exclude individual entries before committing to the project.',
  'graphml.dialog.pickFile': 'Pick file…',
  'graphml.dialog.parsing': 'Parser running (~ 250 ms per MB)…',
  'graphml.dialog.importFailed': 'Import failed',
  'graphml.dialog.pickOther': 'Pick another file',
  'graphml.dialog.file': 'File',
  'graphml.dialog.nodes': 'nodes',
  'graphml.dialog.edges': 'edges',
  'graphml.dialog.otherFile': '↻ Another file',
  'graphml.dialog.devices': 'Devices',
  'graphml.dialog.cables': 'Cables',
  'graphml.dialog.skipped': 'Skipped',
  'graphml.dialog.edgesNoTarget': 'Edges without target',
  'graphml.dialog.parserWarnings': 'Parser warnings',
  'graphml.dialog.target': 'Target:',
  'graphml.dialog.canvas': '🗺 Canvas',
  'graphml.dialog.canvasTitle': 'Place devices directly on the canvas (incl. cables).',
  'graphml.dialog.library': '📚 Library',
  'graphml.dialog.libraryTitle':
    'Only adopt as reusable device templates into the library (no cables, no canvas placement).',
  'graphml.dialog.mode': 'Mode:',
  'graphml.dialog.appendProject': 'Append to project',
  'graphml.dialog.replaceImport': 'Replace GraphML import',
  'graphml.dialog.replaceTitle':
    'Replaces only GraphML-imported devices; manually added ones stay untouched.',
  'graphml.dialog.filterPlaceholder': 'Filter: name / IP / category / cable type',
  'graphml.dialog.libraryHint':
    '📚 Library mode: devices are saved as reusable templates into the local library. Cables are not adopted (templates carry no cabling).',
  'graphml.dialog.tab.preview': 'yEd preview',
  'graphml.dialog.tab.devices': 'Devices',
  'graphml.dialog.tab.cables': 'Cables',
  'graphml.dialog.tab.skipped': 'Skipped',
  'graphml.dialog.col.name': 'Name',
  'graphml.dialog.col.category': 'Category',
  'graphml.dialog.col.ip': 'IP',
  'graphml.dialog.col.inOut': 'In/Out',
  'graphml.dialog.col.status': 'Status',
  'graphml.dialog.col.source': 'Source',
  'graphml.dialog.col.target': 'Target',
  'graphml.dialog.col.type': 'Type',
  'graphml.dialog.col.standard': 'Standard',
  'graphml.dialog.col.length': 'Length',
  'graphml.dialog.nodesSkipped': 'Nodes skipped',
  'graphml.dialog.moreEllipsis': '… ({count} more)',
  'graphml.dialog.unresolvedEdges': 'Edges with unresolved ports',
  'graphml.dialog.deviceSingular': 'device',
  'graphml.dialog.devicePlural': 'devices',
  'graphml.dialog.cableSingular': 'cable',
  'graphml.dialog.cablePlural': 'cables',
  'graphml.dialog.toLibrary': 'into library',
  'graphml.dialog.toCanvas': 'onto canvas',

  // Location BOM dialog
  'locbom.title': 'Bill of materials',
  'locbom.close': 'Close',
  'locbom.devices': 'Devices',
  'locbom.internalCables': 'Internal cables',
  'locbom.externalConnections': 'External connections',
  'locbom.groupTitle':
    'Groups identical cables (same type + length) on one row with a quantity — default for the parts list.',
  'locbom.groupCables': 'Group cables',
  'locbom.includePlanTitle':
    'Prepends a JPEG plan snippet of the location before the device list — recipients get the parts list and the plan in one document.',
  'locbom.includePlan': 'Embed plan',
  'locbom.rendering': 'Rendering…',
  'locbom.exportPdf': 'Export PDF',
  'locbom.section.devices': 'Devices',
  'locbom.section.internalCables': 'Internal cables',
  'locbom.section.externalConnections': 'External connections',
  'locbom.col.name': 'Name',
  'locbom.col.category': 'Category',
  'locbom.col.sn': 'S/N',
  'locbom.col.ip': 'IP',
  'locbom.col.qty': 'Qty',
  'locbom.col.type': 'Type',
  'locbom.col.lengthM': 'Length (m)',
  'locbom.noInternalCables': 'No internal cables.',
  'locbom.examples': 'Examples:',

  // Mobile share dialog
  'mobile.dialog.heading': 'Mobile access',
  'mobile.dialog.desktopOnly1':
    'This feature requires the desktop app (Electron). In the web browser the mobile viewer is reachable as static HTML in',
  'mobile.dialog.desktopOnly2': '.',
  'mobile.dialog.description':
    'Starts a small web server on the local network. Scan the QR code with the phone → the mobile viewer opens in the browser and loads the current project. The server stops automatically when the app closes or via the Stop button.',
  'mobile.dialog.qrAlt': 'QR code',
  'mobile.dialog.activeUrl': 'Active URL',
  'mobile.dialog.copyToClipboard': 'Copy to clipboard',
  'mobile.dialog.altUrls': 'Alternative LAN addresses (in case one is unreachable)',
  'mobile.dialog.portLabel': 'Port',
  'mobile.dialog.projectSynced': 'Project synced',
  'mobile.dialog.noProject': 'No project loaded',
  'mobile.dialog.stop': 'Stop',
  'mobile.dialog.stopped':
    'Server is stopped. Click below to start the LAN server.',
  'mobile.dialog.starting': 'Starting…',
  'mobile.dialog.startServer': 'Start LAN server',
  'mobile.dialog.securityHeading': 'Security notes',
  'mobile.dialog.security.readOnly': 'Read-only: the phone can only read, not write.',
  'mobile.dialog.security.bind':
    'The server binds to the local network (0.0.0.0). If it is unclear who is on the network, prefer stopping it.',
  'mobile.dialog.security.autostop':
    'When the desktop app closes the server stops automatically.',

  // AboutDialog
  'about.title': 'About Cable Planner',
  'about.version': 'Version',
  'about.build': 'Build',
  'about.author': 'Author',
  'about.repository': 'Repository',
  'about.platform': 'Platform',
  'about.issueHint': 'Please report issues + feature requests directly on GitHub.',

  // AnnotationsPanel
  'annotations.reviewer': 'Reviewer: {name}',
  'annotations.dragTitle':
    'Drag to place this annotation on the canvas or attach it to a device',
  'annotations.clickToEdit': 'Click to edit',
  'annotations.delete': 'Delete annotation',

  // PatchListDialog
  'patchList.title': 'Patch list',
  'patchList.searchPlaceholder': 'Search (device, port, type, colour, note …)',

  // CalculatorsDialog
  'calc.title': 'Tools / calculators',

  // OnboardingTour
  'onboarding.header': 'Getting-started tour · step {step} / {total}',
  'onboarding.end': 'End tour',
  'onboarding.back': 'Back',
  'onboarding.next': 'Next',
  'onboarding.start': "Let's go",
  'onboarding.tip': 'Tip:',
  'onboarding.steps.welcome.title': 'Welcome to Cable Planner',
  'onboarding.steps.welcome.body':
    'A short tour shows where the main features live. You can re-open it any time from the Help menu in the top right.',
  'onboarding.steps.file.title': 'File menu (top left)',
  'onboarding.steps.file.body':
    'Use "File" to create projects, open saved files and persist changes. Project metadata is editable from "Project properties" there.',
  'onboarding.steps.export.title': 'Export menu',
  'onboarding.steps.export.body':
    'The "Export" menu hosts PDF plan export, the cable BOM and two Rentman actions: attach PDF to Rentman and send cables to Rentman.',
  'onboarding.steps.export.hint':
    'The Rentman entries are only active if a Rentman project is linked.',
  'onboarding.steps.settings.title': 'Settings → Rentman',
  'onboarding.steps.settings.body':
    'Save the token, test the connection and link/switch Rentman projects from the "Rentman API" tab in Settings.',
  'onboarding.steps.library.title': 'Library on the left',
  'onboarding.steps.library.body':
    'The left column holds equipment, cable library and groups. In the Equipment tab you can switch between local and Rentman-imported devices.',
  'onboarding.steps.properties.title': 'Properties on the right',
  'onboarding.steps.properties.body':
    'Selecting an item on the canvas opens its details and editing tools on the right.',
  'onboarding.steps.cablePlan.title': 'Cable plan & warnings',
  'onboarding.steps.cablePlan.body':
    'If you import cable quantities from Rentman, Cable Planner warns when you wire more cables than available. "Send cables to Rentman" syncs back the assembled totals.',

  // PowerConsumptionSection
  'power.title': 'Power consumption',
  'power.voltage': 'Voltage (V)',
  'power.voltagePlaceholder': 'e.g. 230',
  'power.current': 'Current (A)',
  'power.currentPlaceholder': 'e.g. 1.5',
  'power.watts': 'Power (W)',
  'power.wattsComputed': 'Computed from V × A',
  'power.auto': 'auto',
  'power.wattsTitle':
    'Datasheet value. V × A is suggested; can be overridden here.',
  'power.formulaHint':
    'When voltage and current are set, power is computed automatically (P = U × I). Tools → power consumption sums the power field across all devices.',

  // Rentman — NewRentmanDeviceWizard
  'rentman.wizard.title': 'New Rentman device ({progress})',
  'rentman.wizard.introPre': 'First time we see',
  'rentman.wizard.introPost':
    '. Confirm inputs/outputs — they’ll be remembered in your custom library.',
  'rentman.wizard.cancelImport': 'Cancel import',
  'rentman.wizard.name': 'Name',
  'rentman.wizard.category': 'Category',
  'rentman.wizard.saveAsCategoryTitle': 'Save as new category',
  'rentman.wizard.addCategory': '+ Add',
  'rentman.wizard.suggestedPortGroups': 'Suggested port groups',
  'rentman.wizard.webSearch': '🌐 Web search (free)',
  'rentman.wizard.webBusy': 'Searching…',
  'rentman.wizard.webSearchTitle': 'Search Wikipedia + DuckDuckGo (no key required)',
  'rentman.wizard.aiButton': '✨ AI (Gemini)',
  'rentman.wizard.aiBusy': 'Asking AI…',
  'rentman.wizard.aiTitle': 'Gemini AI (requires API key)',
  'rentman.wizard.aiSettings': 'AI settings',
  'rentman.wizard.aiSettingsTitle': 'Configure Gemini API key',
  'rentman.wizard.addInputGroup': '+ Input group',
  'rentman.wizard.addOutputGroup': '+ Output group',
  'rentman.wizard.noGeminiKey':
    'No Gemini API key configured. Enter one or use the free web search.',
  'rentman.wizard.aiNoPorts': 'AI returned no ports. Try refining the name.',
  'rentman.wizard.aiFailed': 'AI request failed',
  'rentman.wizard.webNoConnectors':
    'No connectors detected in the {source} snippet. Add them manually or try a different name.',
  'rentman.wizard.webNoHit':
    'No web hit. Refine the device name (manufacturer + model).',
  'rentman.wizard.webHints': 'Adopted {count} port group(s) from {source}.',
  'rentman.wizard.webFailed': 'Web search failed',
  'rentman.wizard.geminiKeyHeading': 'Gemini API key',
  'rentman.wizard.geminiKeyHintPre': 'Free at',
  'rentman.wizard.geminiKeyHintPost':
    '(15 requests/min). Stored locally in browser storage.',
  'rentman.wizard.directionAria': 'Direction',
  'rentman.wizard.directionIn': 'Input',
  'rentman.wizard.directionOut': 'Output',
  'rentman.wizard.countAria': 'Count',
  'rentman.wizard.connectorTypeAria': 'Connector type',
  'rentman.wizard.labelPrefixPlaceholder': 'Label prefix',
  'rentman.wizard.removeGroupTitle': 'Remove group',
  'rentman.wizard.noGroups': 'No port groups. Add one above, or skip this device.',
  'rentman.wizard.excludeTitle': 'Skip this device and do NOT import',
  'rentman.wizard.exclude': 'Do not import',
  'rentman.wizard.skipTitle':
    'Import without creating a library entry (1 generic input + output)',
  'rentman.wizard.skip': 'Skip (generic)',
  'rentman.wizard.saveFinish': 'Save & finish',
  'rentman.wizard.saveNext': 'Save & next',

  // Rentman — ProjectSelector
  'rentman.projectSelector.aria': 'Rentman project',
  'rentman.projectSelector.placeholder': 'Select project',

  // Rentman — EquipmentChecklist
  'rentman.checklist.qtyAria': 'Quantity',
  'rentman.checklist.qtyTitle': 'How many to add',
  'rentman.checklist.qtyInProject': 'Quantity in the Rentman project',
  'rentman.checklist.selectAll': 'Select all',
  'rentman.checklist.deselectAll': 'Deselect all',
  'rentman.checklist.expandAll': 'Expand all sets',
  'rentman.checklist.collapseAll': 'Collapse all sets',
  'rentman.checklist.setExpand': 'Expand set',
  'rentman.checklist.setCollapse': 'Collapse set',
  'rentman.checklist.badge.linkedTitle':
    'Already linked in the local library via Rentman ID to "{name}". Re-import only refreshes metadata (category, project link) — the local port configuration is preserved.',
  'rentman.checklist.badge.linked': '✓ Already linked: {name}',
  'rentman.checklist.badge.nameOnlyTitle':
    'Local template "{name}" has the same name but no Rentman ID. On import a conflict dialog appears — default is to keep the local version (with ports) and only attach the Rentman ID.',
  'rentman.checklist.badge.nameOnly': '⚡ Local exists: {name} — conflict dialog',
  'rentman.checklist.badge.catalogTitle':
    'Match from built-in catalog ("{name}"). Will be adopted as a template automatically on import.',
  'rentman.checklist.badge.catalog': '⊕ Catalog: {name}',
  'rentman.checklist.badge.fallbackTitle': 'Auto-filled with template "{name}"',
  'rentman.checklist.linkedTitle':
    'Linked to a local device — will not be created as a duplicate on import',
  'rentman.checklist.linkSelectTitle': 'Link to an existing local device',
  'rentman.checklist.linkPlaceholder': '🔗 Link…',
  'rentman.checklist.selectChildren': 'Select all children',
  'rentman.checklist.deselectChildren': 'Deselect all children',
  'rentman.checklist.childrenAllOff': '☐ all',
  'rentman.checklist.childrenAllOn': '☑ all',

  // Rentman — RentmanImportDialog body
  'rentman.import.busyTitle': 'Import operations still running',
  'rentman.import.busyBody': 'Please wait for them to finish.',
  'rentman.import.noCategories':
    'No categories available. Please create local categories first.',
  'rentman.import.switch.title': 'Switch Rentman project?',
  'rentman.import.switch.alreadyLinkedPre':
    'This project is already linked to the Rentman project',
  'rentman.import.switch.alreadyLinkedPost': 'linked.',
  'rentman.import.switch.askLoadInsteadPre': 'Load',
  'rentman.import.switch.askLoadInsteadPost':
    'instead? Already imported devices on the canvas keep their link.',
  'rentman.import.switch.confirm': 'Yes, switch project',
  'rentman.import.conflict.titleOne': 'Device already in local library',
  'rentman.import.conflict.titleMany':
    '{count} devices already in local library',
  'rentman.import.conflict.intro':
    'The following devices picked from Rentman already exist in your local library. By default the local definition is kept — so your own port configurations are not lost. You can decide per device:',
  'rentman.import.col.device': 'Device',
  'rentman.import.col.action': 'Action',
  'rentman.import.col.rentman': 'Rentman',
  'rentman.import.col.targetCategory': 'Target category',
  'rentman.import.action.keep': 'Keep local version (recommended)',
  'rentman.import.action.link': 'Link to another local device',
  'rentman.import.action.overwrite': 'Overwrite with Rentman version',
  'rentman.import.action.merge': 'Merge ports',
  'rentman.import.action.skip': 'Skip (do not import)',
  'rentman.import.link.placeholder': '-- Pick device --',
  'rentman.import.setAll': 'Set all:',
  'rentman.import.bulk.keep': 'Keep local',
  'rentman.import.bulk.overwrite': 'Take Rentman',
  'rentman.import.bulk.skip': 'Skip',
  'rentman.import.next': 'Next',
  'rentman.import.catMap.title': 'Category mapping before import',
  'rentman.import.catMap.intro':
    'Every import must be mapped to an existing category.',
  'rentman.import.catMap.pickPlaceholder': 'Please select…',
  'rentman.import.catMap.missingTitle': 'Category missing',
  'rentman.import.catMap.missingBody':
    'Please pick an existing category for every device.',
  'rentman.import.loadProjects': 'Load projects',
  'rentman.import.refresh': '↺ Refresh Rentman',
  'rentman.import.refreshTitle': 'Reload quantities and devices for "{name}"',
  'rentman.import.projectsCount': '{visible} / {total} projects',
  'rentman.import.noneLoaded': 'No projects loaded yet',
  'rentman.import.sort': 'Sort:',
  'rentman.import.sortDateDesc': 'Date ↓',
  'rentman.import.sortDateAsc': 'Date ↑',
  'rentman.import.searchPlaceholder': 'Search by name, number or status…',
  'rentman.import.clearSearch': 'Clear',
  'rentman.import.loadingShort': 'Loading…',
  'rentman.import.reloadSync': '↻ Reload & sync',
  'rentman.import.categories': 'Categories:',
  'rentman.import.categoriesAll': 'All',
  'rentman.import.status.linkedTitle':
    'Items with identical Rentman equipment ID in the local library — silent re-import, ports + custom data are preserved.',
  'rentman.import.status.linked': '✓ {count} already linked',
  'rentman.import.status.conflictsTitle':
    'Items with the same name as a local template but without a Rentman ID. On import a conflict dialog appears per item (default: keep local version + attach Rentman ID).',
  'rentman.import.status.conflicts':
    '⚡ {count} conflict dialog (same name, not linked)',
  'rentman.import.status.freshTitle':
    'Items without a match in the local library — imported fresh as templates.',
  'rentman.import.status.fresh': '+ {count} new',
  'rentman.import.cablePlan.heading': 'Adopt cable quantities from Rentman',
  'rentman.import.cablePlan.selectAll': 'Select all',
  'rentman.import.cablePlan.deselectAll': 'Deselect all',
  'rentman.import.cablePlan.entryCount': '{count} entries',
  'rentman.import.cablePlan.detected': '{count} cable type(s) detected',
  'rentman.import.cablePlan.apply': 'Adopt cable quantities',
  'rentman.import.cablePlan.pickAtLeastOne':
    'Please pick at least one cable type.',
  'rentman.import.cablePlan.planSaved':
    '✓ {count} cable type(s) adopted as plan.',
  'rentman.import.resultOne': '✓ {count} device added to the library',
  'rentman.import.resultMany': '✓ {count} devices added to the library',
  'rentman.import.resultHint':
    'Devices are added to the equipment library, not placed directly on the canvas.',
  'rentman.import.addToLibrary': 'Add to library',

  // Rentman — RentmanCableExportDialog
  'rentman.cableExport.title': 'Send cables to Rentman',
  'rentman.cableExport.target': 'Target: {name}',
  'rentman.cableExport.noLink': 'No Rentman project linked.',
  'rentman.cableExport.catalogError': 'Could not load the Rentman catalog',
  'rentman.cableExport.sending': 'Sending to Rentman…',
  'rentman.cableExport.unknownError': 'Unknown error',
  'rentman.cableExport.errorFormat': 'Error: {msg}',
  'rentman.cableExport.groupCreated': ' (group created)',
  'rentman.cableExport.groupRestricted': ' (no group — plan restriction)',
  'rentman.cableExport.sentSuccess': '✓ {count} sent to Rentman{note}.',
  'rentman.cableExport.cablesBuilt': 'cables built',
  'rentman.cableExport.alreadySent': 'already sent',
  'rentman.cableExport.ready': 'ready',
  'rentman.cableExport.withoutMapping': '{count} without mapping',
  'rentman.cableExport.nothingToSend':
    'Nothing to send — all deltas zero or unmapped.',
  'rentman.cableExport.sendNCablesTitle': 'Send {count} cables to Rentman',
  'rentman.cableExport.sendingShort': 'Sending…',
  'rentman.cableExport.sendAll': 'Send all (+{count})',
  'rentman.cableExport.loading': 'Loading…',
  'rentman.cableExport.refreshCatalog': 'Refresh catalog',
  'rentman.cableExport.loadCatalog': 'Load Rentman catalog',
  'rentman.cableExport.col.typeLength': 'Type / length',
  'rentman.cableExport.col.built': 'Built',
  'rentman.cableExport.col.planned': 'Planned',
  'rentman.cableExport.col.synced': 'Already sent',
  'rentman.cableExport.col.mapping': 'Rentman mapping',
  'rentman.cableExport.col.action': 'Action',
  'rentman.cableExport.noCables': 'No cables in the project.',
  'rentman.cableExport.deltaPositiveTitle':
    'This many cables will be additionally sent to Rentman.',
  'rentman.cableExport.deltaNegativeTitle':
    'Fewer cables built than last sent — correct manually in Rentman.',
  'rentman.cableExport.deltaZeroTitle': 'Built = already sent to Rentman.',
  'rentman.cableExport.rentmanId': 'Rentman ID {id}',
  'rentman.cableExport.removeMapping': 'Remove mapping',
  'rentman.cableExport.pickEquipment': 'Pick Rentman equipment…',
  'rentman.cableExport.searchPlaceholder': 'Search…',
  'rentman.cableExport.loadCatalogFirst': 'Please load the catalog first.',
  'rentman.cableExport.mapFirst': 'Please map Rentman equipment first.',
  'rentman.cableExport.nothingShort': 'Nothing to send.',
  'rentman.cableExport.sendNCables': 'Send {count} to Rentman.',
  'rentman.cableExport.send': 'Send',

  // Rack — PatchPanelCreateDialog
  'rack.patchPanel.title': 'Create patch panel',
  'rack.patchPanel.tab.basics': 'Basics',
  'rack.patchPanel.tab.perPort': 'Per-port detail ({count})',
  'rack.patchPanel.name': 'Name',
  'rack.patchPanel.heightUnits': 'Height (U)',
  'rack.patchPanel.mount': 'Mount',
  'rack.patchPanel.mountTitle':
    'Patch panels are often rear-mounted behind front devices.',
  'rack.patchPanel.mount.full': 'Full-depth (front)',
  'rack.patchPanel.mount.front': 'Front only',
  'rack.patchPanel.mount.rear': 'Rear only',
  'rack.patchPanel.portCount': 'Port count',
  'rack.patchPanel.adapter': 'Adapter patch panel',
  'rack.patchPanel.adapterHint':
    '(front ≠ rear connector, with internal adapter cable)',
  'rack.patchPanel.frontConnector': 'Front connector',
  'rack.patchPanel.rearConnector': 'Rear connector',
  'rack.patchPanel.bothConnector': 'Connector type (both sides)',
  'rack.patchPanel.appliesToAllPorts':
    'Applies to all {count} ports. Adjust individually in the "Per-port detail" tab.',
  'rack.patchPanel.adapterCouplingNote':
    'Each front port couples internally via an adapter cable to the matching rear port.',
  'rack.patchPanel.perPortNote':
    'Per port label and connector type are overridable. Leave empty for default.',
  'rack.patchPanel.perPortAdapterNote':
    'In adapter mode the front and rear connectors are chosen independently.',
  'rack.patchPanel.col.label': 'Label',
  'rack.patchPanel.col.front': 'Front',
  'rack.patchPanel.col.rear': 'Rear',
  'rack.patchPanel.create': 'Create patch panel',

  // Rack — RackShelfCreateDialog
  'rack.shelf.title': 'Create rack shelf',
  'rack.shelf.name': 'Name',
  'rack.shelf.heightUnits': 'Height (U)',
  'rack.shelf.depth': 'Depth (mm)',
  'rack.shelf.tip':
    'Tip: place the shelf at the desired U slot, then put non-19" items at the same starting U — they appear visually on the shelf.',
  'rack.shelf.create': 'Create shelf',

  // Rack — NonRackAddDialog
  'rack.nonRack.title': 'Add "{name}"',
  'rack.nonRack.intro':
    'The device is not marked as a 19″ rack device. Pick how it should be placed in the rack:',
  'rack.nonRack.option.rack': '📏 As 19″ device',
  'rack.nonRack.option.rackHint': 'Occupies N U on the rack rails',
  'rack.nonRack.option.shelf': '🪑 On a shelf',
  'rack.nonRack.option.shelfHint': 'Custom dimensions in mm, sits on a rack shelf',
  'rack.nonRack.rackUnits': 'U height',
  'rack.nonRack.widthMm': 'Width (mm)',
  'rack.nonRack.heightMm': 'Height (mm)',
  'rack.nonRack.depthMm': 'Depth (mm)',
  'rack.nonRack.widthPreset.third': '1/3 rack-mount width ≈ 150 mm',
  'rack.nonRack.widthPreset.half': '1/2 rack-mount width ≈ 225 mm',
  'rack.nonRack.widthPreset.twoThirds': '2/3 rack-mount width ≈ 300 mm',
  'rack.nonRack.shelfTip':
    'Place the device on an existing rack shelf by adding it at the same starting U. Dimensions are visualized in the 3D tab as real box size.',
  'rack.nonRack.persist': 'Save dimensions to template permanently',
  'rack.nonRack.persistHint': '(next time the dialog will not ask again)',
  'rack.nonRack.add': 'Add',

  // Project — CableBomDialog
  'bom.cable.title': 'Cable bill of materials',
  'bom.cable.groupedNote': 'Grouped by type & length.',
  'bom.cable.builtCables': 'Built cables:',
  'bom.cable.missingTypes': '⚠ {count} cable type(s) missing',
  'bom.cable.allCovered': '✓ All planned quantities covered',
  'bom.cable.csv': 'CSV',
  'bom.cable.pdf': 'PDF',
  'bom.cable.col.type': 'Type',
  'bom.cable.col.length': 'Length (m)',
  'bom.cable.col.built': 'Built',
  'bom.cable.col.planned': 'Rentman planned',
  'bom.cable.col.diff': 'Difference',
  'bom.cable.col.paths': 'Paths',
  'bom.cable.noCables': 'No cables in the project.',
  'bom.cable.rentmanLinkedTitle': 'Linked Rentman equipment name',
  'bom.cable.rentmanMissingTitle':
    'Linked, but Rentman template not found locally',
  'bom.cable.diff.zeroTitle': 'Built = planned',
  'bom.cable.diff.posTitle': 'More built than planned',
  'bom.cable.diff.negTitle': 'Fewer built than planned',
  'bom.cable.morePaths': '+{count} more',
  'bom.cable.draftPending': 'Unsaved changes to the Rentman plan.',
  'bom.cable.draftSaved': 'Rentman plan is saved in the project.',
  'bom.cable.discard': 'Discard',
  'bom.cable.savePlan': 'Save Rentman plan',
  'bom.cable.syncRentman': '📦 Sync with Rentman →',
  'bom.cable.syncRentmanTitle':
    'Closes this dialog and opens the Rentman cable export prefilled with the current buckets.',

  // DimensionsSection
  'dims.title': 'Dimensions',
  'dims.width': 'Width (mm)',
  'dims.widthPlaceholder': 'e.g. 482',
  'dims.height': 'Height (mm)',
  'dims.heightPlaceholder': 'e.g. 44',
  'dims.depth': 'Depth (mm)',
  'dims.depthPlaceholder': 'e.g. 400',
  'dims.hint':
    'Physical outer dimensions. 19" rack device: 1 U = 44.45 mm, standard width 482 mm, typical depth 400-600 mm. Used by the 3D rack renderer + logistics tools.',

  // DimensionsBlock (legacy fieldset variant)
  'dimsBlock.title': 'Dimensions (mm)',
  'dimsBlock.height': 'Height',
  'dimsBlock.width': 'Width',
  'dimsBlock.depth': 'Depth',
  'dimsBlock.rackHint':
    'Rack device · {he} U. If height is empty, {mm} mm is assumed as physical height (1 U ≈ 44.45 mm).',

  // DisplayPropertiesBlock
  'display.title': 'Display',
  'display.resolution': 'Resolution',
  'display.diagonal': 'Diagonal (inches)',

  // PortsSection
  'portsSection.title': 'Inputs & outputs',
  'portsSection.in': 'In',
  'portsSection.out': 'Out',

  // PrintSection
  'printSection.title': 'Print / documentation',
  'printSection.subtitle': 'Patch sheet A4/A3',
  'printSection.a4Title':
    'Generates a single-page A4 patch list with all ports + connected cables — to stick on the device.',
  'printSection.a4Btn': '🖨 Print patch sheet (A4 PDF)',
  'printSection.a3Title': 'A3 variant for devices with many ports.',
  'printSection.a3Btn': '🖨 Print patch sheet (A3 PDF)',

  // LibrarySaveSection
  'libSave.title': 'Library',
  'libSave.subtitle': 'save as template',
  'libSave.overwriteConfirm': 'Overwrite "{name}"?',
  'libSave.overwriteBody':
    "Already exists in the library. Overwrite with the current device's settings?",
  'libSave.overwriteOk': 'Overwrite',
  'libSave.saveConfirm': 'Save "{name}"?',
  'libSave.saveBody': 'Save as a new default template in the library.',
  'libSave.btnTitle':
    'Saves the current device (ports, network, SDI caps, MV config …) as a library template.',
  'libSave.btnOverwrite': 'Overwrite default template ↺',
  'libSave.btnSave': 'Save as new default template ✚',
  'libSave.newPrompt': 'Save as a new device in the library.\nName:',
  'libSave.exists': '"{name}" already exists',
  'libSave.existsBody': 'Please choose a different name or overwrite the existing template.',
  'libSave.newBtnTitle':
    'Creates a new template under a different name — the existing one stays unchanged.',
  'libSave.newBtn': 'Save as new device in library ✚',

  // ExportDialog additional
  'export.patch.filterPlaceholder': 'Filter…',

  // Library — Groups tab
  'library.tabs.groups.title': 'Device groups',
  'library.tabs.groups.subtitle': 'Multiple devices + cables as a template',
  'library.tabs.groups.empty': 'No groups saved yet.',
  'library.tabs.groups.hint1': 'Select ≥ 2 devices on the canvas and click',
  'library.tabs.groups.hintBtn': 'As group',
  'library.tabs.groups.hint2': 'in the canvas toolbar.',
  'library.tabs.groups.clickTitle':
    'Click = place on canvas · Drag&Drop = place at drop position',
  'library.tabs.groups.counts': '{items} devices · {cables} cables',
  'library.tabs.groups.rackUnits': ' · {n} RU',
  'library.tabs.groups.exportTitle': 'Export as file (copy to Downloads folder)',
  'library.tabs.groups.exportAria': 'Export',
  'library.tabs.groups.confirmDelete': 'Delete group "{name}"?',
  'library.tabs.groups.deleteTitle': 'Remove group from library',

  // Library — Racks tab
  'library.tabs.racks.title': '2D Rack Builder',
  'library.tabs.racks.subtitle': 'Rack slots in RU, saved as a placeable group',
  'library.tabs.racks.new': '+ New rack',
  'library.tabs.racks.empty': 'No rack layout saved yet.',
  'library.tabs.racks.clickTitle':
    'Click = place as black box on canvas · Drag&Drop = place at drop position',
  'library.tabs.racks.counts': '{items} devices · {units} RU · {cables} cables',
  'library.tabs.racks.editTitle': 'Edit in the 2D rack builder',
  'library.tabs.racks.editAria': 'Edit',
  'library.tabs.racks.exportTitle': 'Export as file (copy to Downloads folder)',
  'library.tabs.racks.exportAria': 'Export',
  'library.tabs.racks.confirmDelete': 'Delete rack "{name}"?',
  'library.tabs.racks.deleteTitle': 'Remove rack from library',

  // PortList additional
  'ports.none': 'None',
  'ports.duplicateNumbers':
    'Duplicate port numbers: {nums} — ambiguous for labels / patch list.',
  'ports.remove': 'Remove port',
  'ports.direction.auto': 'Direction (auto)',
  'ports.direction.in': 'Input only',
  'ports.direction.out': 'Output only',
  'ports.direction.bi': 'Bidirectional (e.g. network)',
  'ports.side.auto': 'Side (auto)',
  'ports.side.left': 'Left',
  'ports.side.right': 'Right',
  'ports.sdi.maxSingleLink': 'Max single-link',
  'ports.sdi.quadSet': 'Quad-link set:',

  // Shortcut keys (Strg/Ctrl + …)
  'shortcut.ctrlN': 'Ctrl+N',
  'shortcut.ctrlO': 'Ctrl+O',
  'shortcut.ctrlS': 'Ctrl+S',
  'shortcut.ctrlShiftS': 'Ctrl+Shift+S',

  // CableProperties additional
  'cable.optgroup.custom': 'Custom',
  'cable.aria.fromDevice': 'Source device',
  'cable.aria.fromPort': 'Source port',
  'cable.aria.toDevice': 'Target device',
  'cable.aria.toPort': 'Target port',

  // Section labels (NetworkAccess, Flags, Optional)
  'netAccess.title': 'Network & access',
  'netAccess.subtitle': 'IP · S/N · login',
  'netAccess.notesPlaceholder': 'Web UI URL, firmware version, wiring notes, …',
  'flags.title': 'Display & flags',
  'flags.subtitle': 'compact · colour · mirror ports · packed',
  'flags.colorTitle': 'Device node colour',
  'flags.packedTitle':
    'Marks the device as packed. Shown as ✓ on the canvas and as a column in the device BOM.',
  'flags.converterTitle':
    'Converter marker: the patch list skips this device and shows the next real target directly. Useful for SDI-HDMI converters, format converters, embedders/de-embedders.',
  'opt.title': 'Optional fields',
  'opt.subtitle': 'Manufacturer link, reference image, icon',
  'opt.iconAutoTitle': 'Reset to automatic',

  // Library — TemplateMergeDialog
  'templateMerge.title': 'Merge devices',
  'templateMerge.needCategoryTitle': 'Choose category',
  'templateMerge.needCategoryBody': 'Please select a target category.',
  'templateMerge.needPortTitle': 'Choose port',
  'templateMerge.needPortBody': 'Please select at least one port.',
  'templateMerge.save': 'Save merge',
  'templateMerge.intro': 'Pick which inputs/outputs to take from Local and {label}.',
  'templateMerge.targetCategory': 'Target category',
  'templateMerge.pleaseSelect': 'Please select…',
  'templateMerge.selectedPorts': 'Selected ports',
  'templateMerge.preview': 'Preview',
  'templateMerge.previewCounts': '{in} In / {out} Out',
  'templateMerge.local': 'Local',
  'templateMerge.inputs': 'Inputs',
  'templateMerge.outputs': 'Outputs',

  // Library — LibraryItem
  'library.item.titleActiveRentman':
    'From active Rentman project{suffix} — click or drag & drop onto canvas',
  'library.item.titleOtherRentman':
    'From Rentman project{suffix} — click or drag & drop onto canvas',
  'library.item.titleLocal': 'Local device — click or drag & drop onto canvas',
  'library.item.badgeActiveRentman': 'From active Rentman project{suffix}',
  'library.item.badgeOtherRentman': 'From Rentman project{suffix}',
  'library.item.badgeLocal': 'Local device (not from Rentman)',
  'library.item.unfavorite': 'Remove favorite',
  'library.item.favorite': 'Mark as favorite',
  'library.item.show': 'Show again',
  'library.item.hide': 'Hide',
  'library.item.exportTitle': 'Export as file (copy to Downloads folder)',
  'library.item.exportAria': 'Export',
  'library.item.linkNamed': 'Link with local device "{name}" (take over ports)',
  'library.item.linkSameName': 'Link with same-named local device (take over ports)',
  'library.item.linkAria': 'Link',
  'library.item.removeTitle': 'Remove from library',

  // Library — LibrarySortables
  'library.sortables.categoryAria': 'Move category',
  'library.sortables.dragTitle': 'Move via drag & drop',
  'library.sortables.moveAria': 'Move',

  // Library — LibraryMenus
  'library.menus.plusTitle': 'Create new device or category',
  'library.menus.newDevice': 'New device…',
  'library.menus.newCategory': 'New category…',
  'library.menus.importFile': 'Import file…',
  'library.menus.importFileTitle': 'Import .cpdevice or .cpgroup file',
  'library.menus.openFolder': 'Open library folder…',
  'library.menus.openFolderTitle': 'Open library folder in file manager',
  'library.menus.filterTitle': 'Filter and view options',
  'library.menus.expandAll': 'Expand all categories',
  'library.menus.collapseAll': 'Collapse all categories',
  'library.menus.sorting': 'Sorting',
  'library.menus.sortManual': 'Manual (drag & drop)',
  'library.menus.sortAsc': 'Alphabetical A → Z',
  'library.menus.sortDesc': 'Alphabetical Z → A',
  'library.menus.showHidden': 'Show hidden',
  'library.menus.showEmpty': 'Show empty categories',

  // Project — ProjectMetaDialog
  'project.meta.titleNew': 'New project',
  'project.meta.titleEdit': 'Edit project metadata',
  'project.meta.create': 'Create project',
  'project.meta.name': 'Project name',
  'project.meta.namePh': 'e.g. ProSieben Studio refit',
  'project.meta.contractor': 'Contractor (company)',
  'project.meta.contractorPh': 'Your Company Ltd',
  'project.meta.client': 'Client',
  'project.meta.clientPh': 'End customer',
  'project.meta.author': 'Planner / author',
  'project.meta.authorPh': 'First name Last name',
  'project.meta.projectNumber': 'Project / job no.',
  'project.meta.projectNumberPh': 'e.g. 2026-042',
  'project.meta.description': 'Description',
  'project.meta.companyLogo': 'Company logo',
  'project.meta.clientLogo': 'Client logo',
  'project.meta.removeLogo': 'Remove',
  'project.meta.chooseLogo': 'Choose logo…',
  'project.meta.footnote':
    'These fields appear in the plan footer when exporting to PDF. Every save updates the "last modified" date automatically.',

  // Project — WelcomeDialog
  'project.welcome.title': 'Welcome to Cable Planner',
  'project.welcome.later': 'Decide later',
  'project.welcome.laterTitle': 'Continue without choosing — remember to save manually.',
  'project.welcome.intro':
    'Create a new project or open an existing one so your work is saved reliably.',
  'project.welcome.newTitle': 'New project',
  'project.welcome.newSubtitle': 'Start with project name, client and planner.',
  'project.welcome.openTitle': 'Open project…',
  'project.welcome.openSubtitle1': 'Load an existing',
  'project.welcome.openSubtitle2': ' file.',
  'project.welcome.recents': 'Recently used',
  'project.welcome.recentsHint':
    'Click "Open project…" and choose one of the files in the file picker.',

  // Properties — GreenGo beltpack section
  'props.greengo.noConfig':
    'No GreenGo configuration in the project. Open the Intercom planner or load a preset to define beltpacks.',
  'props.greengo.beltpack': 'Beltpack',
  'props.greengo.groupsTitle': 'Groups: {names}',
  'props.greengo.groupCountOne': '{n} group',
  'props.greengo.groupCountMany': '{n} groups',
  'props.greengo.name': 'Name',
  'props.greengo.assignFirst': 'Assign first ↓',
  'props.greengo.nameTitle':
    'Changes are written immediately to the intercom plan and .gg5 export',
  'props.greengo.userSlot': 'Assigned user slot',
  'props.greengo.noSlot': '(no slot assigned)',
  'props.greengo.assignedOther': ' (assigned to another device)',
  'props.greengo.groupChipTitle': 'Groups are edited in the intercom planner',

  // Properties — Rack section
  'props.rack.title': 'Rack / 19" settings',
  'props.rack.units': '{n} RU',
  'props.rack.inactive': 'inactive',
  'props.rack.isRack': 'Is a 19" rack device',
  'props.rack.disabledHint':
    'Rack fields only appear when the device is marked as a 19" rack device.',
  'props.rack.height': 'Height (RU)',
  'props.rack.view': 'View',
  'props.rack.frontOnly': 'Front only',
  'props.rack.rearOnly': 'Rear only',
  'props.rack.frontRear': 'Front + rear',
  'props.rack.importFront': 'Import front graphic + crop',
  'props.rack.importRear': 'Import rear graphic + crop',
  'props.rack.swap': '↔ Swap front/rear photo',
  'props.rack.swapTitle': 'Swap front and rear photos (including crop metadata)',
  'props.rack.netboxSource': 'Source: NetBox device-type-library · {path}',

  // Properties — DeviceKindCards
  'props.deviceKind.greengo': 'GreenGo Intercom detected',
  'props.deviceKind.greengoExport': 'Intercom planning / export .gg5 →',
  'props.deviceKind.videohub': 'Blackmagic Videohub detected',
  'props.deviceKind.videohubConfigure': '🎚 Configure Videohub · Labels + Routing →',
  'props.deviceKind.atem': 'Blackmagic ATEM detected',
  'props.deviceKind.atemConnect': 'Connect ATEM / push setup →',
  'props.deviceKind.atemConnectTitle': 'Connects via UDP to the ATEM and transfers input names.',
  'props.deviceKind.atemMv': 'Configure multiviewer layout →',
  'props.deviceKind.atemMvTitle':
    'Configure multiviewer layout offline. Pushed on next connect.',
  'props.deviceKind.atemAudio': 'Configure audio router →',
  'props.deviceKind.atemAudioTitle':
    'Plan ATEM audio router offline (matrix routing or classic mixer).',
  'props.deviceKind.multiviewer': 'Multiviewer detected',
  'props.deviceKind.mvExport': 'Multiviewer layout export (v0.4.0)',
  'props.deviceKind.mvExportTitle': 'Multiviewer layout export coming in v0.4.0',

  // Properties — RentmanSyncBadge
  'props.rentmanBadge.removed': 'No longer present in Rentman!',
  'props.rentmanBadge.id': 'Rentman ID: {id}',
  'props.rentmanBadge.notTracked': 'Not tracked in Rentman plan',

  // Properties — PortAiSuggestButton
  'props.aiPorts.noSuggestion': 'AI could not suggest any ports. Try a more specific device name.',
  'props.aiPorts.requestFailed': 'AI request failed',
  'props.aiPorts.label': '✨ AI port suggestion',
  'props.aiPorts.btnTitle':
    'Asks the provider selected in Settings → AI what "{name}" typically has for ports',
  'props.aiPorts.asking': 'Asking AI…',
  'props.aiPorts.suggest': 'Suggest ports',
  'props.aiPorts.summary': '{groups} group(s) / {ports} ports suggested:',
  'props.aiPorts.input': 'Input',
  'props.aiPorts.output': 'Output',
  'props.aiPorts.confirmReplace':
    'Replace existing {in} In / {out} Out with the AI suggestion?',
  'props.aiPorts.replaceTitle': 'Removes current ports and applies the AI suggestion',
  'props.aiPorts.replace': 'Replace',
  'props.aiPorts.appendTitle': 'Appends the AI suggestion to the existing ports',
  'props.aiPorts.append': 'Append',
  'props.aiPorts.adopt': 'Adopt',
  'props.aiPorts.discard': 'Discard',

  // Properties — ModesSection
  'props.modes.title': 'Operating modes',
  'props.modes.empty': 'none — create below',
  'props.modes.defined': '{n} defined',

  // Properties — DeviceConfigsBlock
  'props.deviceConfigs.title': 'Configurations',
  'props.deviceConfigs.none': 'No configuration assigned.',
  'props.deviceConfigs.unassign': 'Detach',
  'props.deviceConfigs.unassignTitle': 'Detach assignment (file remains in library)',
  'props.deviceConfigs.assignExisting': '+ Assign existing configuration…',
  'props.deviceConfigs.hint': 'Upload new configurations in Settings → Configurations.',

  // Properties — SortableSection
  'props.section.dragTitle': 'Drag section to change order',
  'props.section.dragAria': 'Move section',

  // Settings — EquipmentColorsSection
  'settings.eqColors.title': 'Device card colors',
  'settings.eqColors.description':
    'Background/text/border for equipment nodes — adjustable per theme. Defaults are chosen so the cards stand out from the canvas background. Individual devices can have their own color in Properties.',
  'settings.eqColors.themeLight': '☀ Light',
  'settings.eqColors.themeDark': '🌙 Dark',
  'settings.eqColors.reset': '↺ Reset',
  'settings.eqColors.resetTitle': 'Reset to default',
  'settings.eqColors.body': 'Card body',
  'settings.eqColors.bodyHint': 'Background of the device card',
  'settings.eqColors.header': 'Header strip',
  'settings.eqColors.headerHint': 'Top strip with name + IP',
  'settings.eqColors.border': 'Border',
  'settings.eqColors.borderHint': '1px border around the card',
  'settings.eqColors.text': 'Main text',
  'settings.eqColors.textHint': 'Device name + port labels',
  'settings.eqColors.subtext': 'Secondary text',
  'settings.eqColors.subtextHint': 'Category, IP, connector types',
  'settings.eqColors.note':
    'Note: Devices with their own color (Properties → device color) still override the body value individually.',
  'settings.eqColors.defaultDeviceColor': 'Default device color',
  'settings.eqColors.defaultDeviceColorHint':
    'Newly added devices start with this color (Properties → device color can change it individually). Empty: uses the theme body color.',
  'settings.eqColors.resetX': '✕ Reset',

  // Canvas — TitleBlock
  'canvas.titleBlock.unnamed': 'Untitled project',
  'canvas.titleBlock.projectNo': 'Project no.',
  'canvas.titleBlock.client': 'Client',
  'canvas.titleBlock.contractor': 'Contractor',
  'canvas.titleBlock.planner': 'Planner',
  'canvas.titleBlock.created': 'Created',
  'canvas.titleBlock.modified': 'Modified',
  'canvas.titleBlock.showTitle': 'Show plan signature',
  'canvas.titleBlock.signatureBtn': 'Signature',
  'canvas.titleBlock.collapseTitle': 'Collapse signature',
  'canvas.titleBlock.noLogo': 'no logo',

  // Canvas — LayerVisibilityChips
  'canvas.layerChips.layerStripTitle':
    'Layer visibility (only cables are filtered, devices stay)',
  'canvas.layerChips.layers': 'Layers',
  'canvas.layerChips.chipTitle': '{label} — {count} cables · {state}',
  'canvas.layerChips.visibleHide': 'visible (click to hide)',
  'canvas.layerChips.hiddenShow': 'hidden (click to show)',
  'canvas.layerChips.customLayerPrompt': 'Create custom layer (e.g. "intercom", "lighting")',
  'canvas.layerChips.removeCustom': 'Remove custom layer "{layer}"?',
  'canvas.layerChips.customTitle': '{layer} (custom) — right-click to remove',
  'canvas.layerChips.menuTitle': 'Layer management (create custom / reset all)',
  'canvas.layerChips.addCustom': 'Create custom layer…',
  'canvas.layerChips.resetAll': 'Show all layers again',

  // Canvas — CableContextMenu
  'canvas.cableMenu.renameTitle': 'Cable label',
  'canvas.cableMenu.confirmDelete': 'Delete cable "{name}"?',
  'canvas.cableMenu.headerLabel': 'Cable:',
  'canvas.cableMenu.rename': 'Change label…',
  'canvas.cableMenu.acceptMobile': 'Accept into plan (mobile suggestion)',
  'canvas.cableMenu.removeMobileCheck': 'Remove mobile check',
  'canvas.cableMenu.addWaypoint': 'Add waypoint here',
  'canvas.cableMenu.removeNearestWaypoint': 'Remove nearest waypoint',
  'canvas.cableMenu.clearWaypoints': 'Clear all waypoints ({n})',
  'canvas.cableMenu.reroute': 'Auto-reroute',
  'canvas.cableMenu.routing': 'Routing:',
  'canvas.cableMenu.routingOrth': 'Orthogonal',
  'canvas.cableMenu.routingStraight': 'Direct',
  'canvas.cableMenu.routingCurved': 'Curved',
  'canvas.cableMenu.bumps': 'Cable jumps for this cable',
  'canvas.cableMenu.global': 'global',
  'canvas.cableMenu.removeOverride': 'Remove override (follow global)',
  'canvas.cableMenu.arrowEnd': 'Arrow at end',
  'canvas.cableMenu.arrowStart': 'Arrow at start',
  'canvas.cableMenu.bidi': 'Bidirectional',
  'canvas.cableMenu.show': 'show',
  'canvas.cableMenu.hide': 'hide',
  'canvas.cableMenu.on': 'turn on',
  'canvas.cableMenu.off': 'turn off',
  'canvas.cableMenu.delete': 'Delete cable',

  // Canvas — CableEdge
  'canvas.cableEdge.deleteTitle': 'Delete cable',

  // Canvas — CanvasArea
  'canvas.area.newDevicePromptTitle': 'New device',
  'canvas.area.newDevicePromptDefault': 'New device',
  'canvas.area.viewerMode': 'Viewer mode — plan is read-only. Changes are not possible.',
  'canvas.area.finalizedMode': 'Plan is finalized — changes are locked.',
  'canvas.area.releaseConfirm': 'Re-open the plan for editing?',
  'canvas.area.releaseBody': 'Devices, cables and layout can then be changed again.',
  'canvas.area.release': 'Release',
  'canvas.area.releaseBtn': 'Release for editing',
  'canvas.area.renameLocation': 'Rename location:',
  'canvas.area.lockPosition': 'Lock position',
  'canvas.area.unlockPosition': 'Unlock position',

  // Atem — MultiviewerLayoutView
  'atem.mvLayout.title': 'Multiviewer layout (live)',
  'atem.mvLayout.refresh': '↻ Refresh',
  'atem.mvLayout.close': '✕ Close',
  'atem.mvLayout.notConnected':
    'Not connected to an ATEM. Connect in the ATEM dialog first, then open this view.',
  'atem.mvLayout.noMv': 'The connected ATEM reports no multiviewers.',
  'atem.mvLayout.legend': 'Legend',
  'atem.mvLayout.camera': 'Camera',
  'atem.mvLayout.gfx': 'GFX',
  'atem.mvLayout.support': 'Support',
  'atem.mvLayout.aux': 'AUX',
  'atem.mvLayout.pgmPrv': 'PGM/PRV',

  // Rack — RackImageCropDialog
  'rackCrop.titleFront': 'Crop front graphic ({units} RU)',
  'rackCrop.titleRear': 'Crop rear graphic ({units} RU)',
  'rackCrop.hint':
    'Mouse wheel zooms · Drag corners & edges to resize · Shift = keep aspect · Arrow keys nudge · R = reset',
  'rackCrop.close': 'Close',
  'rackCrop.zoom': 'Zoom',
  'rackCrop.lockAspect': 'Lock aspect',
  'rackCrop.presets': 'Crop presets',
  'rackCrop.reset': '⟲ Reset',
  'rackCrop.presetTitle': 'Template {n} RU aspect',
  'rackCrop.manualValues': 'Manual values (0–1)',
  'rackCrop.width': 'Width',
  'rackCrop.height': 'Height',
  'rackCrop.targetAspect': 'Target aspect:',
  'rackCrop.currentAspect': 'Current crop aspect:',
  'rackCrop.liveHe': 'Live RU:',
  'rackCrop.confirm': 'Apply crop',

  // Rack — RackLivePreview
  'rackPreview.cableTooltip': 'Internal: {from}:{fromPort} ↔ {to}:{toPort}',
  'rackPreview.empty': 'No devices in rack — preview appears once the first device is assigned.',
  'rackPreview.headerLabel': 'Black box on canvas',
  'rackPreview.counts': '{devices} devices · {cables} internal cables',

  // Import — GraphmlViewer
  'graphmlViewer.zoomIn': 'Zoom in',
  'graphmlViewer.zoomOut': 'Zoom out',
  'graphmlViewer.reset': 'Reset',
  'graphmlViewer.statusBar': 'Mouse wheel zooms · Drag pans · {nodes} nodes · {edges} edges',

  // Sync — SharedSyncPanel
  'sync.pushTitle': 'Push to: {path}',
  'sync.pullTitle': 'Pull from: {path}',
  'sync.push': 'Push',
  'sync.pull': 'Pull',

  // Settings — ConfigsTab additional
  'settings.configs.invalidBundleTitle': 'Invalid configuration bundle',
  'settings.configs.invalidBundleBody':
    'The file does not contain a cable-planner configuration bundle.',
  'settings.configs.loadCount': 'Load {n} configurations',
  'settings.configs.replaceOrAppend':
    '"Replace" = existing library is overwritten.\n"Append" = new configurations are added, existing ones kept.',
  'settings.configs.replace': 'Replace',
  'settings.configs.append': 'Append',
  'settings.configs.importErrorTitle': 'Import error',
  'settings.configs.pickFile': '📤 Choose file…',
  'settings.configs.exportBundle': '💾 Export library as JSON',
  'settings.configs.importBundle': '⤵ Import JSON library…',
  'settings.configs.entriesCount': '{n} entries',
  'settings.configs.filterAll': 'All ({n})',
  'settings.configs.emptyHint':
    'Upload your first configuration file — it will be listed here and can then be assigned to a device on the canvas.',
  'settings.configs.noFilterMatch': 'No entry matches the selected filter.',
  'settings.configs.assignTitle': 'Device on the canvas this configuration is assigned to',
  'settings.configs.unassigned': '(unassigned)',
  'settings.configs.fileMeta':
    'Original file: {fileName}\nUploaded: {savedAt}\n{chars} characters',
  'settings.configs.downloadTitle': 'Download original file',
  'settings.configs.confirmDelete': 'Delete configuration "{name}"?',
  'settings.configs.deleteHint': 'The file on disk is not modified.',
  'settings.configs.removeTitle': 'Remove from library',

  // RackBuilderDialog body
  'rack.depthTitle':
    'Rack depth in mm. Default: 800 mm. Common values: 350/450/600/800/1000/1200.',
  'rack.notRackTitle':
    'Not marked as 19" rack device — height will be asked on add.',
  'rack.tipPrefix': 'Tip:',
  'rack.tipBody': 'enable when the desired device is missing.',
  'rack.frontRail': 'Front rail',
  'rack.rearRail': 'Rear rail',
  'rack.readonlyInBuilder': 'Read-only in the builder — was set on add.',
  'rack.deviceDepthTitle':
    'Device depth in mm. Empty = 400 mm default. Visualised by the 3D tab.',
  'rack.stlUploadTitle': 'Upload STL file (.stl, max 5 MB) for this device',
  'rack.stlRemoveTitle': 'Remove STL — device renders as a box again',
  'rack.portsAllRear': 'All ports to the rear (default for classic server gear)',
  'rack.portsSwap': 'Front ports become rear ports and vice versa',
  'rack.portsAllFront': 'All ports to the front (e.g. front-panel devices)',
  'rack.swapPhotos': 'Swap front and rear photo (if the mapping is wrong)',
  'rack.removeImage': 'Remove image',
  'rack.internalCablingTitle': 'Internal cabling in the rack',
  'rack.openInternalCanvas':
    'Wire the rack devices internally — full canvas view',

  // CalculatorsDialog
  'calc.resolution': 'Resolution',
  'calc.sampling': 'Sampling / depth',
  'calc.dataRate': 'Data rate',
  'calc.connectionType': 'Connection type',
  'calc.safetyReserve': 'Safety margin (%)',
  'calc.devicesCounted': 'Devices counted',
  'calc.totalUsage': 'Total usage',
  'calc.current1phase': 'Current (single-phase)',
  'calc.current3phase': 'Symmetric (3-phase)',
  'calc.col.device': 'Device',
  'calc.col.phase': 'Phase',

  // RackAddSplitButton
  'rackAdd.primaryLabel': '+ To rack',
  'rackAdd.fullDepthTitle': 'Add device full-depth (front + rear) to the rack',
  'rackAdd.mountOptionsTitle': 'Mount options (front / rear)',
  'rackAdd.frontOnly': 'Front only',
  'rackAdd.frontMount': 'Front-mount',
  'rackAdd.fullDepth': 'Full-depth',
  'rackAdd.fullDepthSub': 'front + rear (default)',
  'rackAdd.rearOnly': 'Rear only',
  'rackAdd.rearMount': 'Rear-mount (e.g. patch panel)',

  // AtemDialog table columns
  'atem.col.type': 'Type',
  'atem.col.live': 'Live (long / short)',
  'atem.col.newLong': 'New long (max 20)',
  'atem.col.newShort': 'New short (4)',
  'atem.eventLog': 'Event log',

  // EquipmentNode (canvas device tile)
  'eqNode.rentmanRemoved': 'No longer in Rentman!',
  'eqNode.noRentman': 'No Rentman entry',
  'eqNode.packed': 'Packed — ready to ship',
  'eqNode.mobileChecked':
    'Checked on site (mobile viewer) — click removes the check',

  // Library rentman add to project (info dialogs)
  'library.rentman.groupCreated': '(new "CablePlanner" group created)',
  'library.rentman.groupReused': '(added to existing "CablePlanner" group)',
  'library.rentman.noGroups':
    '(no group — your Rentman plan disallows API groups)',
  'library.rentman.addedTitle': '"{name}" added',
  'library.rentman.addedBody': 'Added to Rentman project "{project}"{note}.',
  'library.rentman.addError': 'Error adding to Rentman',

  // Library create dialog (HE-Picker + group label)
  'library.create.hePlaceholder': 'U',
  'library.create.groupLabelPrefix': 'Label prefix',
  'library.create.removeGroup': 'Remove group',

  // RackImageCropDialog
  'rackCrop.scrollHint': 'Scroll wheel or + / - do the same',
  'rackCrop.resetTitle': 'Reset crop and zoom (R)',

  // PortList aria-labels
  'ports.aria.connector': 'Connector type',
  'ports.aria.signal': 'Signal standard',
  'ports.aria.contentLabel': 'Content / function',
  'ports.aria.direction': 'Port direction',
  'ports.aria.side': 'Port side',

  // LibraryPanel rentman section + netbox + create
  'library.rentman.noProjectLinked': 'No Rentman project linked.',
  'library.rentman.imported': 'Imported Rentman devices',
  'library.rentman.noneImported': 'No Rentman devices imported yet.',
  'library.rentman.noMatches': 'No matches for "{query}".',
  'library.rentman.noneInCategory': 'No devices imported.',
  'library.rentman.accountAll': 'All Rentman equipment (account catalog)',
  'library.rentman.idLine': 'Rentman ID {id}',
  'library.rentman.reconcile': 'Reconcile canvas ↔ Rentman',
  'library.rentman.removed': 'No longer in Rentman:',
  'library.netbox.title': 'NetBox import',
  'library.netbox.categoryLabel': 'Category:',
  'library.netbox.pickCategory': 'Please pick…',
  'library.create.isRack': 'Is a rack device',
  'library.create.aiKey.label': 'Gemini API key',

  // CustomPaletteCard (Settings → Appearance)
  'settings.customPalette.enable': 'Enable custom palette',
  'settings.customPalette.bg': 'Background',
  'settings.customPalette.grid': 'Grid stroke',
  'settings.customPalette.accent': 'Accent',
  'settings.canvasBg.darkImage': '🌙 Dark-mode image',
  'settings.canvasBg.lightImage': '☀ Light-mode image',

  // Settings → Integrations (Rentman toggle card)
  'settings.integrations.rentmanToggle.title': 'Rentman integration',
  'settings.integrations.rentmanToggle.desc':
    'When active, the Library tab, menu entries and status badges for Rentman appear. When off, Cable Planner only shows local devices/cables — all Rentman features are hidden.',

  // Inspector lock banners + empty state
  'inspector.selectEquipment': 'Select an equipment node.',
  'inspector.viewerLocked': 'Viewer mode — fields cannot be edited.',
  'inspector.finalizedLocked':
    'Plan finalised — fields locked. Click "Re-enable editing" in the canvas banner.',

  // Template properties additional
  'template.rentmanIdLabel': 'Rentman ID',
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
