import { useUiStore, type Language } from '../store/uiStore'

/**
 * Cable Planner i18n.
 *
 * SOURCE LANGUAGE: English (E-28, owner decision 2026-09-09). The English
 * text sits inline as the fallback in `t('key', 'English text')`; every other
 * language is a dictionary that overrides it. Missing keys show the English
 * source, so wrapping a string can never break the UI.
 *
 * Coverage status: COMPREHENSIVE (4576 keys with a German translation).
 *
 * The dictionaries cover all user-visible strings in the application:
 *
 *   ✓ Top-level chrome — App header, MenuBar (incl. shortcuts), StatusBar
 *   ✓ Settings — all 6 tabs (Project, Appearance, Editing, Integrations,
 *     Sync, Advanced + Configs sub-tab)
 *   ✓ Canvas — toolbar (Defaults menu, alignment, locks, plan-finalise,
 *     annotations, length legend, rail labels), CableContextMenu, CableEdge,
 *     LayerVisibilityChips, EquipmentNode tooltips,
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
 *   ✓ CableDialog
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
 * Strings without a translation fall through to the English source string,
 * so anything not yet covered remains readable rather than showing
 * missing-key tokens.
 */


import { type Dict } from './i18n/dict'
import { de } from './i18n/de'
import { einsetzen } from './platzhalter'

/**
 * Die Woerterbuecher — eine REGISTRY, keine Verzweigung.
 *
 * Englisch fehlt hier mit Absicht: es ist seit E-28 die QUELLSPRACHE und
 * steht als Fallback im JSX. Ein Eintrag dafuer waere eine zweite Kopie
 * derselben Texte, und zwei Kopien laufen auseinander.
 *
 * Eine weitere Sprache ist eine Datei neben `i18n/de.ts` und ein Eintrag
 * hier — keine Zeile Logik. Genau das war der Grund fuer diese Form: vorher
 * stand in `translate` ein fester Vergleich auf zwei Sprachen.
 */
const translations: Partial<Record<Language, Dict>> = {
  de,
}

/**
 * Look up a translation. Falls back to the ENGLISH source string (or the key
 * itself if no fallback is given) so partial coverage never breaks the UI.
 *
 * Until 2026-09-09 the fallback was German — E-28 turned the direction
 * around: English is the source language of every repository in the suite,
 * German is the first translation.
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

/**
 * Der Uebersetzer AUSSERHALB von React — eine Kopie, nicht vier.
 *
 * Module wie `drawingChecks`, `importGreengo` oder `intercomMatrixXlsx` laufen
 * ohne Komponente; dort gibt es keinen Hook. Bis 2026-09-10 half sich jedes
 * mit denselben zwei Zeilen selbst:
 *
 *     const tr = (key, fallback) =>
 *       translate(useUiStore.getState().language, key, fallback)
 *
 * Vier Kopien derselben Zeile sind fuer sich schon die Defektform
 * `zwei-rechnungen` im Kleinen. Teuer wurde es aber an einer anderen Stelle:
 * WER DIE SPRACHE INLINE HOLT, WIRD VOM SPRACH-WAECHTER NICHT GESEHEN.
 * `fallbackMuster` in `scripts/quellsprache.mjs` erkennt `translate(lang, k,
 * f)` nur, wenn das erste Argument ein BEZEICHNER ist; bei
 * `translate(useUiStore.getState().language, …)` greift es nicht. Gemessen:
 * `exportPdfVector.ts` trug so den deutschen Fallback „Canvas nicht gefunden"
 * durch die Sprachdrehung E-28, und `lang:check` meldete daneben 0 Verstoesse.
 *
 * Mit dieser Fassung steht an jeder Aufrufstelle `tr('key', 'English')` —
 * genau die Form, die der Waechter liest.
 */
export function tr(key: string, fallback: string): string {
  return translate(useUiStore.getState().language, key, fallback)
}

/** Convenience: inject runtime values into a translated string.
 *  e.g. format(t('foo', '{n} cables'), { n: 5 }) → '5 cables'.
 *
 *  Die Regel selbst steht in `lib/platzhalter.ts` — sie ist dieselbe fuer
 *  Desktop, Mobile-Ansicht, Viewer und die Urteils-Module unter `types/`, und
 *  seit 2026-09-10 steht sie deshalb nur noch einmal. */
export const format = einsetzen
