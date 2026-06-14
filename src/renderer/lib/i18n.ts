import { useUiStore, type Language } from '../store/uiStore'

/**
 * Cable Planner i18n.
 *
 * Coverage status: COMPREHENSIVE (~2050+ keys).
 *
 * The English dictionary contains all user-visible strings in the application:
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


import { type Dict, en, de } from './i18n/dicts'

const translations: Record<Language, Dict> = {
  de,
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
