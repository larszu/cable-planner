import { useEffect, useMemo, useState } from 'react'
import { cablePlannerApi } from '../../lib/bridge'
import { useSettingsStore } from '../../store/settingsStore'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { RoutingToggle } from '../shared/RoutingToggle'
import { pickImageAsDataUri } from '../../lib/readImageAsDataUri'
import { confirmDialog } from '../../lib/confirmDialog'
import { SettingsCard } from './SettingsCard'
import { EquipmentColorsSection } from './EquipmentColorsSection'
import { HotkeysTab } from './tabs/HotkeysTab'
import { SyncTab } from './tabs/SyncTab'
import { AdvancedTab } from './tabs/AdvancedTab'
import { ProjectTab } from './tabs/ProjectTab'
import { ConfigsTab } from './tabs/ConfigsTab'
import { promptDialog } from '../../lib/promptDialog'
import {
  getApiKey,
  setApiKey,
  getSelectedAiProvider,
  setSelectedAiProvider,
  listAiProviders,
  type AiProvider,
} from '../../lib/aiSuggestions'
import { format, useTranslation } from '../../lib/i18n'
import type { Language } from '../../store/uiStore'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType } from '../../types/equipment'
import { DEFAULT_CONNECTOR_TYPE_COLORS } from '../../lib/cableColors'
import {
  deleteGreenGoPreset,
  loadGreenGoPresets,
  saveGreenGoPreset,
} from '../../lib/greengoSync'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

type SettingsSection =
  | 'project'
  | 'appearance'
  | 'editing'
  | 'hotkeys'
  | 'integrations'
  | 'configs'
  | 'sync'
  | 'advanced'

const TAB_ICONS: Record<SettingsSection, string> = {
  project: '📋',
  appearance: '🎨',
  editing: '✏️',
  hotkeys: '⌨',
  integrations: '🔌',
  configs: '🗄',
  sync: '🔄',
  advanced: '⚙',
}

const TAB_FALLBACK_LABEL: Record<SettingsSection, string> = {
  project: 'Projekt',
  appearance: 'Darstellung',
  editing: 'Bearbeiten',
  hotkeys: 'Hotkeys',
  integrations: 'Integrationen',
  configs: 'Konfigurationen',
  sync: 'Netzwerk-Sync',
  advanced: 'Erweitert',
}

const TAB_FALLBACK_TITLE: Record<SettingsSection, string> = {
  project: 'Projekt-Einstellungen',
  appearance: 'Darstellung',
  editing: 'Bearbeiten',
  hotkeys: 'Tastenkürzel',
  integrations: 'Integrationen',
  configs: 'Geräte-Konfigurationen',
  sync: 'Netzwerk-Sync',
  advanced: 'Erweitert',
}

export const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  const [section, setSection] = useState<SettingsSection>('project')
  const drag = useDraggablePosition('cable-planner:modal-pos:settings', open)
  const t = useTranslation()

  if (!open) return null

  const navItem = (id: SettingsSection) => (
    <button
      key={id}
      type="button"
      onClick={() => setSection(id)}
      className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm ${
        section === id
          ? 'bg-sky-700 text-white'
          : 'text-slate-300 hover:bg-slate-800'
      }`}
    >
      <span className="text-base">{TAB_ICONS[id]}</span>
      <span>{t(`settings.tab.${id}`, TAB_FALLBACK_LABEL[id])}</span>
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6">
      <div
        ref={drag.containerRef}
        style={drag.containerStyle}
        // v7.9.2 — Fix-große Höhe statt max-h, damit der Viewport nicht
        // pro Tab variabel groß ist. Inner-Scroll greift immer.
        className="flex h-[85vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl sm:flex-row"
      >
        <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/40 p-3 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r">
          <h3 className="mb-2 hidden px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:block">
            {t('settings.section', 'Einstellungen')}
          </h3>
          {(Object.keys(TAB_ICONS) as SettingsSection[]).map((id) => navItem(id))}
        </aside>

        <main className="flex min-w-0 min-h-0 flex-1 flex-col">
          <header
            {...drag.headerProps}
            className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2 select-none"
          >
            <h2 className="text-base font-semibold">
              {t(`settings.tabTitle.${section}`, TAB_FALLBACK_TITLE[section])}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              {t('common.close', 'Schließen')}
            </button>
          </header>

          {/* v7.9.2 — min-h-0 + flex-1 + overflow-y-auto sorgt für
              zuverlässiges Scrollen in JEDEM Tab (z.B. Datenexport
              im langen Erweitert-Tab). */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {section === 'project' && <ProjectTab onClose={onClose} />}
            {section === 'appearance' && <AppearanceTab />}
            {section === 'editing' && <EditingTab />}
            {section === 'hotkeys' && <HotkeysTab />}
            {section === 'integrations' && <IntegrationsTab onClose={onClose} />}
            {section === 'configs' && <ConfigsTab />}
            {section === 'sync' && <SyncTab />}
            {section === 'advanced' && <AdvancedTab />}
          </div>
        </main>
      </div>
    </div>
  )
}

// --- Reusable card ---------------------------------------------------------

// --- Tab: Project ----------------------------------------------------------


const AppearanceTab = () => {
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const setCanvasTheme = useUiStore((s) => s.setCanvasTheme)
  const colorPortsByType = useUiStore((s) => s.colorPortsByType)
  const setColorPortsByType = useUiStore((s) => s.setColorPortsByType)
  const cableColorMode = useUiStore((s) => s.cableColorMode)
  const setCableColorMode = useUiStore((s) => s.setCableColorMode)
  const defaultArrow = useUiStore((s) => s.defaultArrow)
  const overrideConnectionWarnings = useUiStore((s) => s.overrideConnectionWarnings)
  const setOverrideConnectionWarnings = useUiStore((s) => s.setOverrideConnectionWarnings)
  const connectorTypeColors = useUiStore((s) => s.connectorTypeColors)
  const setConnectorTypeColor = useUiStore((s) => s.setConnectorTypeColor)
  const resetConnectorTypeColors = useUiStore((s) => s.resetConnectorTypeColors)
  // Issue #274 — Kategorie-Farben. Sammelt alle Kategorien aus dem aktuellen
  // Projekt + Custom-Library + Rentman-Catalog damit der User fuer jede
  // existierende Kategorie eine Farbe vergeben kann (z.B. Monitore=blau).
  const categoryColors = useUiStore((s) => s.categoryColors)
  const setCategoryColor = useUiStore((s) => s.setCategoryColor)
  const resetCategoryColors = useUiStore((s) => s.resetCategoryColors)
  const projectEquipment = useProjectStore((s) => s.project.equipment)
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const allKnownCategories = useMemo(() => {
    const set = new Set<string>()
    knownCategories.forEach((c) => c && set.add(c))
    customLibrary.forEach((t) => t.category && set.add(t.category))
    projectEquipment.forEach((eq) => eq.category && set.add(eq.category))
    Object.keys(categoryColors).forEach((c) => c && set.add(c))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [knownCategories, customLibrary, projectEquipment, categoryColors])
  // User-defined connector types (from the cable-type editor) are merged
  // into the colour grid so a newly added type immediately gets its own
  // colour picker without a reload.
  const customConnectorTypes = useUiStore((s) => s.customConnectorTypes)
  const allConnectorTypeEntries = useMemo(() => {
    const builtIn = ALL_CONNECTOR_TYPES.map((ct) => ({
      name: ct as string,
      isCustom: false,
      defaultColor: DEFAULT_CONNECTOR_TYPE_COLORS[ct],
    }))
    const custom = customConnectorTypes
      .filter((c) => !ALL_CONNECTOR_TYPES.includes(c as ConnectorType))
      .map((c) => ({
        name: c,
        isCustom: true,
        defaultColor: DEFAULT_CONNECTOR_TYPE_COLORS.Custom,
      }))
    return [...builtIn, ...custom]
  }, [customConnectorTypes])
  const bgVariant = useUiStore((s) => s.bgVariant)
  const setBgVariant = useUiStore((s) => s.setBgVariant)
  const bgOpacity = useUiStore((s) => s.bgOpacity)
  const setBgOpacity = useUiStore((s) => s.setBgOpacity)
  // v7.7.1 — Custom canvas background image (Issue #71).
  const canvasBgImageDark = useUiStore((s) => s.canvasBgImageDark)
  const canvasBgImageLight = useUiStore((s) => s.canvasBgImageLight)
  const canvasBgImageFit = useUiStore((s) => s.canvasBgImageFit)
  const setCanvasBgImage = useUiStore((s) => s.setCanvasBgImage)
  const setCanvasBgImageFit = useUiStore((s) => s.setCanvasBgImageFit)
  // #291 — Port-Label-Schriftgroesse.
  const portLabelFontSize = useUiStore((s) => s.portLabelFontSize)
  const setPortLabelFontSize = useUiStore((s) => s.setPortLabelFontSize)
  const setDefaultArrow = useUiStore((s) => s.setDefaultArrow)
  const language = useUiStore((s) => s.language)
  const setLanguage = useUiStore((s) => s.setLanguage)
  const t = useTranslation()

  return (
    <div className="space-y-3">
      <SettingsCard
        title={t('settings.appearance.language', 'Sprache')}
        description={t(
          'settings.appearance.languageDesc',
          'UI-Sprache. Umstellen wirkt sofort. Tief verschachtelte Dialoge sind teilweise noch nur deutsch — siehe Hinweis unten.',
        )}
      >
        <div className="flex gap-1">
          {(
            [
              { value: 'de', flag: '🇩🇪', label: 'Deutsch' },
              { value: 'en', flag: '🇬🇧', label: 'English' },
            ] as { value: Language; flag: string; label: string }[]
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLanguage(opt.value)}
              className={`flex-1 rounded px-3 py-1 text-xs ${
                language === opt.value
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {opt.flag} {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          {t(
            'settings.appearance.coverage',
            'Aktuell übersetzt: Einstellungen, Top-Level-Menüs und gemeinsame Buttons. Properties-Panels, Bibliothek, Rentman, ATEM und Export-Dialoge bleiben einstweilen deutsch.',
          )}
        </p>
      </SettingsCard>

      <SettingsCard
        title={t('settings.appearance.theme', 'Theme')}
        description={t(
          'settings.appearance.themeDesc',
          'Hintergrundfarbe des Canvas. Auf Dunkel optimiert; hell ist für PDF-Export oder helles Umgebungslicht.',
        )}
      >
        <div className="flex gap-1">
          {(['dark', 'light'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setCanvasTheme(mode)}
              className={`flex-1 rounded px-3 py-1 text-xs ${
                canvasTheme === mode
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {mode === 'dark'
                ? t('settings.appearance.theme.dark', '🌙 Dunkel')
                : t('settings.appearance.theme.light', '☀ Hell')}
            </button>
          ))}
        </div>
      </SettingsCard>

      <EquipmentColorsSection />

      {/* #291 — Globaler Slider fuer Port-Label-Schriftgroessen. Skaliert
          die Input-/Output-Labels in den Geraete-Karten + die Collapsed-
          View. Header (Geraete-Name + Kategorie) bleibt fix damit das
          Auto-Layout (headerHeight) nicht recomputed werden muss. */}
      <SettingsCard
        title={t('settings.appearance.portLabelSize', 'Port-Label-Schriftgröße')}
        description={t(
          'settings.appearance.portLabelSizeDesc',
          'Schriftgröße der Input-/Output-Beschriftungen auf den Geräte-Karten. Default 11 px. Größer = besser lesbar beim Heraus-Zoomen, aber Geräte werden breiter.',
        )}
      >
        <label className="flex items-center gap-3">
          <input
            type="range"
            min={8}
            max={18}
            step={1}
            value={portLabelFontSize}
            onChange={(e) => setPortLabelFontSize(parseInt(e.target.value, 10))}
            className="flex-1"
          />
          <span className="w-10 text-right font-mono text-xs text-slate-300">
            {portLabelFontSize}px
          </span>
          <button
            type="button"
            onClick={() => setPortLabelFontSize(11)}
            disabled={portLabelFontSize === 11}
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
            title="Auf Default 11 px zuruecksetzen"
          >
            ↺
          </button>
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.appearance.ports', 'Port-Farben')}
        description={t(
          'settings.appearance.portsDesc',
          'Steuert, wie Anschluss-Punkte auf Geräten eingefärbt sind.',
        )}
      >
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setColorPortsByType(false)}
            className={`flex-1 rounded px-3 py-1 text-xs ${
              !colorPortsByType
                ? 'bg-sky-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={t(
              'settings.appearance.ports.byDirectionTitle',
              'Cyan = Eingang, Grün = Ausgang, Lila = bidirektional',
            )}
          >
            {t('settings.appearance.ports.byDirection', 'Nach Richtung (Standard)')}
          </button>
          <button
            type="button"
            onClick={() => setColorPortsByType(true)}
            className={`flex-1 rounded px-3 py-1 text-xs ${
              colorPortsByType
                ? 'bg-sky-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={t(
              'settings.appearance.ports.byTypeTitle',
              'SDI=amber, HDMI=violett, Ethernet=grün, Glasfaser=gelb …',
            )}
          >
            {t('settings.appearance.ports.byType', 'Nach Steckertyp')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.appearance.cableColor', 'Kabelfarbe')}
        description={t(
          'settings.appearance.cableColorDesc',
          'Manuell = pro Kabel im Properties-Panel; nach Länge = Längen-basierte Farbcodierung.',
        )}
      >
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCableColorMode('manual')}
            className={`flex-1 rounded px-3 py-1 text-xs ${
              cableColorMode === 'manual'
                ? 'bg-sky-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {t('settings.appearance.cableColor.manual', 'Manuell')}
          </button>
          <button
            type="button"
            onClick={() => setCableColorMode('byLength')}
            className={`flex-1 rounded px-3 py-1 text-xs ${
              cableColorMode === 'byLength'
                ? 'bg-sky-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {t('settings.appearance.cableColor.byLength', 'Nach Länge')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.appearance.arrows', 'Pfeile auf Kabeln')}
        description={t(
          'settings.appearance.arrowsDesc',
          'Standard für neu gezeichnete Kabel. Per Kabel im Properties-Panel überschreibbar.',
        )}
      >
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={defaultArrow}
            onChange={(e) => setDefaultArrow(e.target.checked)}
          />
          {t(
            'settings.appearance.arrows.label',
            'Pfeil am Ziel-Ende anzeigen (Signalflussrichtung)',
          )}
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.connections.title', 'Verbindungs-Warnungen')}
        description={t(
          'settings.connections.overrideDesc',
          'Steckertyp-Konflikt erzeugt normalerweise eine Bestätigungs-Abfrage. Mit Override wird die Verbindung trotzdem ohne Rückfrage angelegt (als Adapter/Konverter markiert).',
        )}
      >
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={overrideConnectionWarnings}
            onChange={(e) => setOverrideConnectionWarnings(e.target.checked)}
          />
          {t(
            'settings.connections.override.label',
            'Beliebige Inputs und Outputs ohne Warnung verbinden',
          )}
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.canvasBg.title', 'Canvas-Hintergrund')}
        description={t(
          'settings.canvasBg.desc',
          'Muster + Deckkraft des Canvas-Rasters. Bei großen Plänen reduziert eine niedrige Deckkraft die visuelle Unruhe. Rastergröße kommt aus dem Canvas-Toolbar oben.',
        )}
      >
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t('settings.canvasBg.variant', 'Muster')}</span>
            <select
              value={bgVariant}
              onChange={(e) => setBgVariant(e.target.value as 'dots' | 'lines' | 'cross' | 'none')}
              className="rounded border border-slate-700 bg-slate-900 p-1 text-xs"
            >
              <option value="dots">{t('settings.canvasBg.variant.dots', 'Punkte')}</option>
              <option value="lines">{t('settings.canvasBg.variant.lines', 'Linien')}</option>
              <option value="cross">{t('settings.canvasBg.variant.cross', 'Kreuze')}</option>
              <option value="none">{t('settings.canvasBg.variant.none', 'Kein Raster')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t('settings.canvasBg.opacity', 'Deckkraft')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={bgOpacity}
              onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
              className="w-32"
              disabled={bgVariant === 'none'}
            />
            <span className="w-10 text-right text-xs text-slate-400">
              {Math.round(bgOpacity * 100)}%
            </span>
          </label>
        </div>
        {/* v7.7.1 — Custom canvas background image upload (Issue #71). */}
        <div className="mt-4 border-t border-slate-800 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {t('settings.canvasBg.imageTitle', 'Eigenes Hintergrundbild')}
          </div>
          <div className="mb-2 text-[11px] text-slate-500">
            {t(
              'settings.canvasBg.imageDesc',
              'Lade ein eigenes Bild als Canvas-Hintergrund — getrennt für Dark- und Light-Mode. Das Rastermuster (Punkte/Linien/Kreuze) wird darüber gezeichnet.',
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {([
              ['dark', '🌙 Dark-Mode-Bild', canvasBgImageDark] as const,
              ['light', '☀ Light-Mode-Bild', canvasBgImageLight] as const,
            ]).map(([theme, label, current]) => (
              <div key={theme} className="rounded border border-slate-800 bg-slate-950/40 p-2">
                <div className="mb-1 text-[11px] font-semibold text-slate-300">{label}</div>
                {current ? (
                  <>
                    <img
                      src={current}
                      alt={`${theme} background`}
                      className="mb-2 h-20 w-full rounded border border-slate-700 object-cover"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          const dataUri = await pickImageAsDataUri()
                          if (dataUri) setCanvasBgImage(theme, dataUri)
                        }}
                        className="flex-1 rounded bg-slate-700 px-2 py-1 text-[11px] hover:bg-slate-600"
                      >
                        {t('settings.canvasBg.replace', 'Ersetzen…')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCanvasBgImage(theme, null)}
                        className="rounded bg-red-900/60 px-2 py-1 text-[11px] text-red-200 hover:bg-red-800"
                        title={t('settings.canvasBg.remove', 'Bild entfernen')}
                      >
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      const dataUri = await pickImageAsDataUri()
                      if (dataUri) setCanvasBgImage(theme, dataUri)
                    }}
                    className="w-full rounded border border-dashed border-slate-700 bg-slate-900 px-2 py-4 text-[11px] text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  >
                    {t('settings.canvasBg.upload', '+ Bild hochladen…')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
            <span className="text-slate-400">{t('settings.canvasBg.fit', 'Skalierung')}</span>
            <select
              value={canvasBgImageFit}
              onChange={(e) => setCanvasBgImageFit(e.target.value as 'cover' | 'contain' | 'tile')}
              className="rounded border border-slate-700 bg-slate-900 p-1 text-xs"
            >
              <option value="cover">{t('settings.canvasBg.fit.cover', 'Cover (füllt komplett, beschneidet)')}</option>
              <option value="contain">{t('settings.canvasBg.fit.contain', 'Contain (vollständig sichtbar, mit Rand)')}</option>
              <option value="tile">{t('settings.canvasBg.fit.tile', 'Kacheln (wiederholt)')}</option>
            </select>
          </label>
        </div>
      </SettingsCard>

      <CustomPaletteCard />

      <SettingsCard
        title={t('settings.connectorColors.title', 'Steckertyp-Farben')}
        description={t(
          'settings.connectorColors.desc',
          'Eigene Farbe pro Stecker-Typ — nur sichtbar wenn "Ports nach Typ" oben aktiv ist. Leeres Feld setzt zurück auf Standard.',
        )}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm md:grid-cols-3">
          {allConnectorTypeEntries.map(({ name, isCustom, defaultColor }) => {
            const override = connectorTypeColors[name] ?? ''
            const effective = override || defaultColor
            return (
              <label
                key={name}
                className="flex items-center gap-2 text-slate-200"
                title={`Default: ${defaultColor}${isCustom ? ' (custom)' : ''}`}
              >
                <input
                  type="color"
                  value={effective}
                  onChange={(e) => setConnectorTypeColor(name, e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-slate-900 p-0.5"
                />
                <span className="flex-1 truncate text-xs">
                  {name}
                  {isCustom && <span className="ml-1 text-[9px] text-slate-500">(custom)</span>}
                </span>
                {override && (
                  <button
                    type="button"
                    onClick={() => setConnectorTypeColor(name, null)}
                    className="rounded bg-slate-700 px-1 py-0.5 text-[10px] text-slate-300 hover:bg-slate-600"
                    title="Auf Default zurücksetzen"
                  >
                    ↺
                  </button>
                )}
              </label>
            )
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => resetConnectorTypeColors()}
            className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            {t('settings.connectorColors.resetAll', 'Alle zurücksetzen')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.categoryColors.title', 'Geräte-Farben pro Kategorie')}
        description={t(
          'settings.categoryColors.desc',
          'Default-Farbe je Kategorie (z.B. Monitore=blau). Gilt fuer alle Geraete dieser Kategorie ohne eigene Farbe. Eine pro Geraet gesetzte Farbe gewinnt weiterhin.',
        )}
      >
        {allKnownCategories.length === 0 ? (
          <div className="text-[11px] text-slate-500">
            Noch keine Kategorien bekannt. Wird gefuellt sobald Geraete im Plan oder in der Library Kategorien haben.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm md:grid-cols-3">
            {allKnownCategories.map((cat) => {
              const override = categoryColors[cat] ?? ''
              const effective = override || '#94a3b8'
              return (
                <label key={cat} className="flex items-center gap-2 text-slate-200">
                  <input
                    type="color"
                    value={effective}
                    onChange={(e) => setCategoryColor(cat, e.target.value)}
                    className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-slate-900 p-0.5"
                  />
                  <span className="flex-1 truncate text-xs" title={cat}>{cat}</span>
                  {override && (
                    <button
                      type="button"
                      onClick={() => setCategoryColor(cat, null)}
                      className="rounded bg-slate-700 px-1 py-0.5 text-[10px] text-slate-300 hover:bg-slate-600"
                      title="Auf Default zuruecksetzen"
                    >
                      ↺
                    </button>
                  )}
                </label>
              )
            })}
          </div>
        )}
        {allKnownCategories.length > 0 && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => resetCategoryColors()}
              className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              {t('settings.categoryColors.resetAll', 'Alle zuruecksetzen')}
            </button>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}

/** v7.3.0 — Custom palette override (canvas bg, grid color, accent).
 *  When unset, falls back to the dark/light defaults. The CanvasArea
 *  reads `customPalette` from uiStore and uses these in preference
 *  over the theme-derived values, so a user with very specific brand
 *  colors can pin them across dark/light theme toggles. */
const CustomPaletteCard = () => {
  const t = useTranslation()
  const palette = useUiStore((s) => s.customPalette)
  const setPalette = useUiStore((s) => s.setCustomPalette)
  const enabled = palette !== null
  const current = palette ?? {
    canvasBg: '#0f172a',
    gridColor: '#64748b',
    accent: '#38bdf8',
  }
  return (
    <SettingsCard
      title={t('settings.customPalette.title', 'Custom-Palette')}
      description={t(
        'settings.customPalette.desc',
        'Eigene Farben für Canvas-Hintergrund, Raster und Akzent — überschreibt die Theme-Defaults (dark/light). Wirkt nur auf den Canvas; Dialoge bleiben themed.',
      )}
    >
      <label className="mb-2 flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setPalette(e.target.checked ? current : null)}
        />
        Eigene Palette aktivieren
      </label>
      {enabled && (
        <div className="grid grid-cols-3 gap-3 text-xs">
          {(
            [
              { key: 'canvasBg', label: 'Hintergrund' },
              { key: 'gridColor', label: 'Raster-Strich' },
              { key: 'accent', label: 'Akzent' },
            ] as const
          ).map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-slate-400">{field.label}</span>
              <input
                type="color"
                value={current[field.key]}
                onChange={(e) =>
                  setPalette({ ...current, [field.key]: e.target.value })
                }
                className="h-10 w-full cursor-pointer rounded border border-slate-700 bg-slate-900 p-1"
              />
              <code className="mt-1 block text-[10px] text-slate-500">
                {current[field.key]}
              </code>
            </label>
          ))}
        </div>
      )}
    </SettingsCard>
  )
}

// --- Tab: Editing ----------------------------------------------------------

const EditingTab = () => {
  const snapToGrid = useUiStore((s) => s.snapToGrid)
  const setSnapToGrid = useUiStore((s) => s.setSnapToGrid)
  const gridSize = useUiStore((s) => s.gridSize)
  const setGridSize = useUiStore((s) => s.setGridSize)
  const defaultRouting = useUiStore((s) => s.defaultRouting)
  const setDefaultRouting = useUiStore((s) => s.setDefaultRouting)
  const cables = useProjectStore((s) => s.project.cables)
  const updateCable = useProjectStore((s) => s.updateCable)
  const t = useTranslation()

  return (
    <div className="space-y-3">
      <SettingsCard
        title={t('settings.editing.routing', 'Standard-Kabelführung')}
        description={t(
          'settings.editing.routingDesc',
          'Welche Form neue Kabel auf dem Canvas haben sollen. Per Kabel überschreibbar.',
        )}
      >
        <RoutingToggle value={defaultRouting} onChange={setDefaultRouting} />
        <button
          type="button"
          disabled={cables.length === 0}
          onClick={async () => {
            if (
              !(await confirmDialog(
                format(
                  t(
                    'settings.editing.routing.applyAllConfirm',
                    'Routing aller {count} bestehenden Kabel auf "{routing}" setzen?',
                  ),
                  { count: cables.length, routing: defaultRouting },
                ),
                { okLabel: t('common.apply', 'Anwenden') },
              ))
            )
              return
            cables.forEach((c) => {
              if (c.routing !== defaultRouting) updateCable(c.id, { routing: defaultRouting })
            })
          }}
          className="mt-2 w-full rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
        >
          {format(
            t('settings.editing.routing.applyAll', 'Auf alle bestehenden Kabel anwenden ({count})'),
            { count: cables.length },
          )}
        </button>
      </SettingsCard>

      <SettingsCard
        title={t('settings.editing.grid', 'Raster (Grid)')}
        description={t('settings.editing.gridDesc', 'Snap-to-Grid und Rastergröße in Pixeln.')}
      >
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
          />
          {t('settings.editing.snapLabel', 'Geräte am Raster einrasten')}
        </label>
        <label className="mt-2 block text-sm text-slate-300">
          {t('settings.editing.gridSize', 'Rastergröße (Pixel)')}
          <input
            type="number"
            min={2}
            max={100}
            value={gridSize}
            onChange={(e) => setGridSize(Number(e.target.value) || 10)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
      </SettingsCard>

      <CableReconnectOptionsCard />
      <CableInheritTypeCard />
      <CableEndpointLabelsCard />
      <CableVisualOptionsCard />
    </div>
  )
}

/** v7.9.127 — Endpoint-Labels: an jedem Kabelende ein kleines Label
 *  das zeigt, zu welchem Geraet/Port das ANDERE Ende des Kabels geht.
 *  Hilft beim Verfolgen von Kabeln in dichten Plaenen. */
const CableEndpointLabelsCard = () => {
  const t = useTranslation()
  const showCableEndpointLabels = useUiStore((s) => s.showCableEndpointLabels)
  const setShowCableEndpointLabels = useUiStore((s) => s.setShowCableEndpointLabels)
  return (
    <SettingsCard
      title={t('settings.editing.endpointLabels', 'Endpoint-Labels an Kabelenden')}
      description={t(
        'settings.editing.endpointLabelsDesc',
        'Zeigt an jedem Kabelende ein kleines Label das anzeigt, wohin das andere Ende geht — am Source-Ende "→ Ziel-Geraet · Ziel-Port", am Target-Ende "← Quell-Geraet · Quell-Port". Hilft beim Verfolgen von Kabeln ohne ihnen visuell folgen zu muessen.',
      )}
    >
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={showCableEndpointLabels}
          onChange={(e) => setShowCableEndpointLabels(e.target.checked)}
        />
        {t('settings.editing.endpointLabelsLabel', 'Endpoint-Labels einblenden')}
      </label>
      <p className="mt-2 text-[11px] text-slate-500">
        Default aus — gibt zusaetzlichen Visual-Noise. Wirkt
        zusammen mit dem globalen "Alle Labels ausblenden"-Toggle
        und respektiert per-Kabel labelPosition='none'.
      </p>
    </SettingsCard>
  )
}

/** v7.9.125 — Cable Connector Type Inheritance. Wenn aktiv (default),
 *  folgt Cable.type automatisch dem ConnectorType der angeschlossenen
 *  Ports: wechselt der User in den Eigenschaften eines Geraets den
 *  Connector eines Ports (BNC -> XLR), nehmen verbundene Kabel den
 *  neuen Typ an. Cables mit needsConverter bleiben unberuehrt. */
const CableInheritTypeCard = () => {
  const t = useTranslation()
  const inheritCableTypeFromPort = useUiStore((s) => s.inheritCableTypeFromPort)
  const setInheritCableTypeFromPort = useUiStore((s) => s.setInheritCableTypeFromPort)
  return (
    <SettingsCard
      title={t('settings.editing.cableInherit', 'Kabel-Typ folgt Port-Connector')}
      description={t(
        'settings.editing.cableInheritDesc',
        'Wenn ein Port-Connector geaendert wird (z.B. BNC -> XLR), uebernehmen verbundene Kabel automatisch den neuen Typ. Gilt auch beim Umstecken auf einen Port mit anderem Connector. Kabel mit Konverter-Hinweis (needsConverter) bleiben unberuehrt.',
      )}
    >
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={inheritCableTypeFromPort}
          onChange={(e) => setInheritCableTypeFromPort(e.target.checked)}
        />
        {t('settings.editing.cableInheritLabel', 'Kabel-Typ aus Port-Connector ableiten')}
      </label>
      <p className="mt-2 text-[11px] text-slate-500">
        Default an: meistens sollen Kabel den physischen Anschluss-Typ
        ihrer Ports widerspiegeln. Abschalten, wenn Kabel-Typen
        unabhaengig von Port-Typen verwaltet werden sollen.
      </p>
    </SettingsCard>
  )
}

/** v7.9.113 / Issue #232 — Label-Swap-Toggle. Wenn aktiv, wandert der
 *  vom User vergebene Port-Name beim Cable-Reconnect mit dem Kabel mit
 *  und der vorherige Port faellt auf seinen Template-Default-Namen
 *  zurueck. Spart Copy-Paste beim Umstecken. */
const CableReconnectOptionsCard = () => {
  const t = useTranslation()
  const swapLabelsOnReconnect = useUiStore((s) => s.swapLabelsOnReconnect)
  const setSwapLabelsOnReconnect = useUiStore((s) => s.setSwapLabelsOnReconnect)
  return (
    <SettingsCard
      title={t('settings.editing.labelSwap', 'Label mit Kabel mit-wandern')}
      description={t(
        'settings.editing.labelSwapDesc',
        'Beim Umstecken eines Kabels uebernimmt der neue Port den User-Namen vom alten Port. Der alte Port faellt auf seinen Template-default zurueck. Spart Copy-Paste vom Label.',
      )}
    >
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={swapLabelsOnReconnect}
          onChange={(e) => setSwapLabelsOnReconnect(e.target.checked)}
        />
        {t('settings.editing.labelSwapLabel', 'Beim Reconnect Port-Labels mit-tauschen')}
      </label>
      <p className="mt-2 text-[11px] text-slate-500">
        Aus Sicherheit per default aus — sonst wuerden Test-Umsteckungen
        ungewollt Labels umbenennen. Wirkt nur bei Ports, die einen
        vom User editierten Namen haben (sonst gibts nichts zu tauschen).
      </p>
    </SettingsCard>
  )
}

/** Issue #65 / #53: visual options for orthogonal cable routing.
 *  Cable bumps draw a small arc on crossings; collision-shift moves
 *  parallel midlines apart so cables don't overlay. Both are stored
 *  in uiStore so they persist across sessions. */
const CableVisualOptionsCard = () => {
  const t = useTranslation()
  const cableBumps = useUiStore((s) => s.cableBumps)
  const setCableBumps = useUiStore((s) => s.setCableBumps)
  const orthogonalCollisionShift = useUiStore((s) => s.orthogonalCollisionShift)
  const setOrthogonalCollisionShift = useUiStore((s) => s.setOrthogonalCollisionShift)
  return (
    <SettingsCard
      title={t('settings.editing.cableVisuals', 'Kabel-Darstellung')}
      description={t(
        'settings.editing.cableVisualsDesc',
        'Visuelle Hilfen für orthogonal verlegte Kabel (yEd-ähnliche Brücken bei Kreuzungen und automatische Versetzung sich überlagernder Mittellinien).',
      )}
    >
      <label className="mb-2 flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={cableBumps}
          onChange={(e) => setCableBumps(e.target.checked)}
        />
        {t(
          'settings.editing.cableBumps',
          'Kreuzungs-Brücken auf orthogonalen Kabeln',
        )}
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          checked={orthogonalCollisionShift}
          onChange={(e) => setOrthogonalCollisionShift(e.target.checked)}
        />
        {t(
          'settings.editing.collisionShift',
          'Mittellinien automatisch versetzen wenn Kabel sich überlagern',
        )}
      </label>
    </SettingsCard>
  )
}

// --- Tab: Hotkeys (Issue #69) ---------------------------------------------


// --- Tab: Integrations -----------------------------------------------------

const IntegrationsTab = ({ onClose }: { onClose: () => void }) => {
  const [token, setToken] = useState('')
  const hasToken = useSettingsStore((s) => s.hasToken)
  const tokenStatus = useSettingsStore((s) => s.tokenStatus)
  const setHasToken = useSettingsStore((s) => s.setHasToken)
  const setTokenStatus = useSettingsStore((s) => s.setTokenStatus)
  const metadata = useProjectStore((s) => s.project.metadata)
  const openRentmanImport = useUiStore((s) => s.openRentmanImport)
  // v7.9.4 — Rentman komplett ein-/ausschaltbar.
  const rentmanEnabled = useUiStore((s) => s.rentmanEnabled)
  const setRentmanEnabled = useUiStore((s) => s.setRentmanEnabled)
  const [busy, setBusy] = useState(false)
  const t = useTranslation()

  useEffect(() => {
    cablePlannerApi.credentials.getToken().then((stored) => {
      setHasToken(Boolean(stored))
      setToken(stored ?? '')
      setTokenStatus(
        stored
          ? t('settings.integrations.rentman.statusLoaded', 'Token aus sicherem Speicher geladen.')
          : t('settings.integrations.rentman.statusNone', 'Kein Token konfiguriert'),
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHasToken, setTokenStatus])

  const saveToken = async () => {
    setBusy(true)
    try {
      await cablePlannerApi.credentials.saveToken(token)
      setHasToken(true)
      setTokenStatus(
        t('settings.integrations.rentman.statusSaved', 'Token sicher gespeichert.'),
      )
    } catch (error) {
      setTokenStatus(error instanceof Error ? error.message : 'Konnte Token nicht speichern')
    } finally {
      setBusy(false)
    }
  }

  const testToken = async () => {
    setBusy(true)
    try {
      const result = await cablePlannerApi.credentials.testToken()
      setTokenStatus(result.message)
    } finally {
      setBusy(false)
    }
  }

  const removeToken = async () => {
    setBusy(true)
    try {
      await cablePlannerApi.credentials.deleteToken()
      setToken('')
      setHasToken(false)
      setTokenStatus(t('settings.integrations.rentman.statusDeleted', 'Token gelöscht.'))
    } finally {
      setBusy(false)
    }
  }


  return (
    <div className="space-y-3">
      {/* v7.9.4 — Rentman-Toggle als ERSTE Karte. User kann die ganze
          Integration mit einem Klick aus-/anschalten — dann verschwinden
          alle Rentman-Buttons, Tabs, Status-Badges und Library-Spalten. */}
      <SettingsCard
        title="Rentman-Integration"
        description="Wenn aktiv: Library-Tab, Menü-Einträge und Status-Anzeigen für Rentman erscheinen. Ausgeschaltet zeigt der Cable Planner nur lokale Geräte/Kabel — alle Rentman-Funktionen werden ausgeblendet."
      >
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rentmanEnabled}
            onChange={(e) => setRentmanEnabled(e.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
          <span>
            Rentman-Integration aktivieren{' '}
            <span className="text-[10px] text-slate-500">
              ({rentmanEnabled ? 'ein' : 'aus'})
            </span>
          </span>
        </label>
      </SettingsCard>

      {rentmanEnabled && (
      <>
      <SettingsCard
        title={t('settings.integrations.rentman', 'Rentman API')}
        description={t(
          'settings.integrations.rentmanDesc',
          'Bearer-Token aus deinem Rentman-Account. Wird mit dem Betriebssystem-Schlüsselbund verschlüsselt gespeichert (nie im Projektfile).',
        )}
      >
        <label className="block text-sm">
          {t('settings.integrations.rentman.token', 'API-Token')}
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
            placeholder={t(
              'settings.integrations.rentman.tokenPlaceholder',
              'Bearer-Token einfügen',
            )}
            autoComplete="off"
          />
        </label>
        <div
          className={`mt-2 rounded border p-2 text-xs ${
            hasToken
              ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300'
              : 'border-slate-700 bg-slate-950/40 text-slate-400'
          }`}
        >
          <div>
            <span className="font-semibold">
              {t('settings.integrations.rentman.status', 'Status:')}
            </span>{' '}
            {tokenStatus}
          </div>
          <div className="text-slate-500">
            {t('settings.integrations.rentman.tokenStored', 'Token gespeichert:')}{' '}
            {hasToken ? t('common.yes', 'Ja') : t('common.no', 'Nein')}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !token}
            onClick={saveToken}
            className="rounded bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500 disabled:opacity-50"
          >
            {t('settings.integrations.rentman.save', 'Token speichern')}
          </button>
          <button
            type="button"
            disabled={busy || !hasToken}
            onClick={testToken}
            className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            {t('settings.integrations.rentman.test', 'Verbindung testen')}
          </button>
          <button
            type="button"
            disabled={busy || !hasToken}
            onClick={removeToken}
            className="rounded bg-red-600 px-3 py-1 text-sm hover:bg-red-500 disabled:opacity-50"
          >
            {t('settings.integrations.rentman.delete', 'Token löschen')}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          {t('settings.integrations.rentman.endpoint', 'Endpunkt:')}{' '}
          <code>https://api.rentman.net</code>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.integrations.linkedRentman', 'Verknüpftes Rentman-Projekt')}
      >
        {metadata.rentmanProjectId ? (
          <div className="space-y-2">
            <div className="text-xs text-slate-400">
              {t('settings.integrations.linkedRentman.current', 'Aktuell verknüpft mit ')}
              <span className="text-orange-300">
                {metadata.rentmanProjectName ?? `Projekt #${metadata.rentmanProjectId}`}
              </span>
              <span className="ml-2 text-slate-500">(ID {metadata.rentmanProjectId})</span>
            </div>
            <button
              type="button"
              disabled={!hasToken}
              onClick={() => {
                openRentmanImport()
                onClose()
              }}
              className="rounded bg-orange-700 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {t(
                'settings.integrations.linkedRentman.choose',
                'Anderes Rentman-Projekt wählen…',
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-slate-500">
              {t(
                'settings.integrations.linkedRentman.none',
                'Noch kein Rentman-Projekt mit diesem Cable-Planner-Projekt verknüpft.',
              )}
            </div>
            <button
              type="button"
              disabled={!hasToken}
              onClick={() => {
                openRentmanImport()
                onClose()
              }}
              className="rounded bg-orange-700 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              title={
                hasToken
                  ? t('settings.integrations.linkedRentman.titleSelect', 'Rentman-Projekt auswählen')
                  : t('settings.integrations.linkedRentman.titleNeedToken', 'Erst Token speichern')
              }
            >
              {t(
                'settings.integrations.linkedRentman.link',
                'Mit Rentman-Projekt verknüpfen…',
              )}
            </button>
          </div>
        )}
      </SettingsCard>
      </>
      )}

      {/* v7.9.86 / #197 — Multi-AI-Provider Card (Gemini / Claude / OpenAI).
          Aktiver Provider auswählbar; jeder Provider hat eigenen API-Key-
          Slot. Legacy-Karte mit nur Gemini wurde durch diese Card ersetzt. */}
      <AiProvidersCard />

      <GreenGoPresetsCard />
    </div>
  )
}

/**
 * Global library of GreenGo Intercom presets. Stored in localStorage —
 * survives across projects, separate from the per-project
 * greengoConfig. Lets the user keep a "house template" config and
 * apply it to new projects with one click (issue #56).
 */
/**
 * v7.9.86 / #197 — AI-Provider-Multi-Card.
 *
 * Drei Provider (Gemini / Claude / OpenAI) in einer einzigen Karte
 * verwaltbar. Aktiver Provider per Radio-Button, jeder Provider hat
 * eigenen API-Key-Slot (revealable via Klick auf den Key).
 */
const AiProvidersCard = () => {
  const t = useTranslation()
  const [selected, setSelected] = useState<AiProvider>(() => getSelectedAiProvider())
  // Per-Provider State-Map (key + savedFlag). Initial aus localStorage.
  const [keys, setKeys] = useState<Record<AiProvider, string>>(() => ({
    gemini: getApiKey('gemini'),
    claude: getApiKey('claude'),
    openai: getApiKey('openai'),
  }))
  const [saved, setSaved] = useState<Partial<Record<AiProvider, boolean>>>({})
  const [revealed, setRevealed] = useState<Partial<Record<AiProvider, boolean>>>({})

  const handleSelect = (p: AiProvider) => {
    setSelected(p)
    setSelectedAiProvider(p)
  }
  const handleSave = (p: AiProvider) => {
    setApiKey(p, keys[p].trim())
    setSaved((s) => ({ ...s, [p]: true }))
    window.setTimeout(() => setSaved((s) => ({ ...s, [p]: false })), 2000)
  }
  const handleClear = (p: AiProvider) => {
    setApiKey(p, '')
    setKeys((k) => ({ ...k, [p]: '' }))
  }

  return (
    <SettingsCard
      title={t('settings.integrations.ai', 'AI-Provider (KI-Port-Vorschläge)')}
      description={t(
        'settings.integrations.aiDesc',
        'Aktiver Provider für die ✨-AI-Buttons im Geräte-Wizard und in der Rentman-Library. Jeder Provider hat seinen eigenen API-Key. Alle Keys werden nur lokal im Browser-localStorage gespeichert.',
      )}
    >
      <div className="space-y-3">
        {listAiProviders().map(({ id, config }) => {
          const isSelected = selected === id
          const hasKey = keys[id].length > 0
          return (
            <div
              key={id}
              className={`rounded border p-3 transition ${
                isSelected
                  ? 'border-sky-500 bg-sky-950/30'
                  : 'border-slate-700 bg-slate-950/40'
              }`}
            >
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="ai-provider"
                  checked={isSelected}
                  onChange={() => handleSelect(id)}
                  className="accent-sky-500"
                />
                <span className="font-semibold">{config.label}</span>
                {hasKey && (
                  <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-300">
                    ✓ Key
                  </span>
                )}
                {isSelected && (
                  <span className="ml-auto rounded bg-sky-900/40 px-1.5 py-0.5 text-[10px] text-sky-300">
                    AKTIV
                  </span>
                )}
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={revealed[id] ? 'text' : 'password'}
                  value={keys[id]}
                  onChange={(e) => setKeys((k) => ({ ...k, [id]: e.target.value }))}
                  placeholder={
                    id === 'gemini'
                      ? 'AIza…'
                      : id === 'claude'
                        ? 'sk-ant-…'
                        : 'sk-proj-…'
                  }
                  className="flex-1 rounded border border-slate-700 bg-slate-950 p-1.5 font-mono text-xs"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setRevealed((r) => ({ ...r, [id]: !r[id] }))}
                  className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-slate-700"
                  title={revealed[id] ? 'Verbergen' : 'Anzeigen'}
                >
                  {revealed[id] ? '👁' : '🔒'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(id)}
                  className="rounded bg-sky-600 px-3 py-1 text-xs hover:bg-sky-500"
                >
                  Speichern
                </button>
                {hasKey && (
                  <button
                    type="button"
                    onClick={() => handleClear(id)}
                    className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
                    title="Key löschen"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                <span>
                  Model: <span className="font-mono">{config.defaultModel}</span>
                </span>
                <a
                  href={config.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-slate-300"
                >
                  Key erstellen ↗
                </a>
              </div>
              {saved[id] && (
                <div className="mt-1 text-[10px] text-emerald-300">✓ gespeichert</div>
              )}
            </div>
          )
        })}
      </div>
    </SettingsCard>
  )
}

const GreenGoPresetsCard = () => {
  const t = useTranslation()
  const greengoConfig = useProjectStore((s) => s.project.greengoConfig)
  const updateGreenGoConfig = useProjectStore((s) => s.updateGreenGoConfig)
  const [presets, setPresets] = useState(() => loadGreenGoPresets())
  const refreshPresets = () => setPresets(loadGreenGoPresets())
  const usableConfig = greengoConfig && greengoConfig.users.length > 0

  return (
    <SettingsCard
      title={t('settings.greengo.title', 'GreenGo Intercom Presets')}
      description={t(
        'settings.greengo.desc',
        'Globale Bibliothek wiederverwendbarer Intercom-Konfigurationen. Speichere die aktuelle Projekt-Konfiguration als benannten Preset und lade ihn später in jedes neue Projekt — Beltpack-Namen, Gruppen und Routing inklusive.',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!usableConfig}
          onClick={async () => {
            if (!greengoConfig) return
            const name = await promptDialog(
              t('settings.greengo.savePromptTitle', 'Name des Presets:'),
              greengoConfig.systemName || 'Intercom-Setup',
            )
            if (!name) return
            saveGreenGoPreset(name, greengoConfig)
            refreshPresets()
          }}
          className="rounded bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            usableConfig
              ? undefined
              : t('settings.greengo.saveDisabled', 'Aktuelles Projekt hat noch keine GreenGo-Konfiguration')
          }
        >
          {t('settings.greengo.save', 'Aktuelle Konfiguration als Preset speichern')}
        </button>
      </div>
      {presets.length === 0 ? (
        <div className="mt-2 text-[11px] text-slate-500">
          {t('settings.greengo.empty', 'Noch keine Presets gespeichert.')}
        </div>
      ) : (
        <ul className="mt-3 space-y-1">
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-emerald-900/40 bg-emerald-950/30 px-2 py-1 text-xs"
            >
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium text-emerald-100">{p.name}</span>
                <span className="ml-2 text-[10px] text-emerald-400/60">
                  {p.config.users.length} User · {p.config.groups.length} Gruppen ·{' '}
                  {new Date(p.savedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirmDialog(
                      t('settings.greengo.applyTitle', 'Preset anwenden?'),
                      {
                        body: t(
                          'settings.greengo.applyBody',
                          'Die aktuelle GreenGo-Konfiguration im Projekt wird durch das Preset ersetzt. Equipment-Zuordnungen aus dem Preset, die im aktuellen Projekt nicht existieren, werden ignoriert.',
                        ),
                        okLabel: t('settings.greengo.applyConfirm', 'Übernehmen'),
                      },
                    )
                    if (!ok) return
                    updateGreenGoConfig(p.config)
                  }}
                  className="rounded bg-emerald-700 px-2 py-0.5 text-[11px] text-white hover:bg-emerald-600"
                >
                  {t('settings.greengo.apply', 'Laden')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirmDialog(
                      t('settings.greengo.deleteTitle', 'Preset löschen?'),
                      {
                        body: format(
                          t('settings.greengo.deleteBody', 'Preset "{name}" wirklich löschen?'),
                          { name: p.name },
                        ),
                        okLabel: t('settings.greengo.deleteConfirm', 'Löschen'),
                        destructive: true,
                      },
                    )
                    if (!ok) return
                    deleteGreenGoPreset(p.id)
                    refreshPresets()
                  }}
                  className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-red-700 hover:text-white"
                >
                  {t('settings.greengo.delete', 'Löschen')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}

