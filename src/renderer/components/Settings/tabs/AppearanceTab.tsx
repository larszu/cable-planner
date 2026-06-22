import { useMemo } from 'react'
import { X, Moon, Sun } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { useUiStore } from '../../../store/uiStore'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import { pickImageAsDataUri } from '../../../lib/readImageAsDataUri'
import { ALL_CONNECTOR_TYPES } from '../../../types/equipment'
import type { ConnectorType } from '../../../types/equipment'
import { DEFAULT_CONNECTOR_TYPE_COLORS } from '../../../lib/cableColors'
import type { Language } from '../../../store/uiStore'
import { SettingsCard } from '../SettingsCard'
import { EquipmentColorsSection } from '../EquipmentColorsSection'

/**
 * #307 — Appearance-Tab aus SettingsDialog ausgelagert. Sprache, Theme,
 * Equipment-Farben, Port-Label-Groesse, Cable-Color-Modus, Pfeile,
 * Connection-Warnings, Canvas-Hintergrund, Custom-Palette, Stecker-
 * und Kategorie-Farben.
 */

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
      <label className="mb-2 flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setPalette(e.target.checked ? current : null)}
        />
        {t('settings.customPalette.enable', 'Eigene Palette aktivieren')}
      </label>
      {enabled && (
        <div className="grid grid-cols-3 gap-3 text-cp-xs">
          {(
            [
              { key: 'canvasBg', label: t('settings.customPalette.bg', 'Hintergrund') },
              { key: 'gridColor', label: t('settings.customPalette.grid', 'Raster-Strich') },
              { key: 'accent', label: t('settings.customPalette.accent', 'Akzent') },
            ] as const
          ).map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1 block text-cp-text-muted">{field.label}</span>
              <input
                type="color"
                value={current[field.key]}
                onChange={(e) =>
                  setPalette({ ...current, [field.key]: e.target.value })
                }
                className="h-10 w-full cursor-pointer rounded border border-cp-border bg-cp-surface-1 p-1"
              />
              <code className="mt-1 block text-[10px] text-cp-text-muted">
                {current[field.key]}
              </code>
            </label>
          ))}
        </div>
      )}
    </SettingsCard>
  )
}

export const AppearanceTab = () => {
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
              className={`flex-1 rounded px-3 py-1 text-cp-xs ${
                language === opt.value
                  ? 'bg-sky-700 text-white'
                  : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
              }`}
            >
              {opt.flag} {opt.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-cp-text-muted">
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
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1 text-cp-xs ${
                canvasTheme === mode
                  ? 'bg-sky-700 text-white'
                  : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
              }`}
            >
              {mode === 'dark' ? (
                <>
                  <Icon icon={Moon} size="xs" /> {t('settings.appearance.theme.dark', 'Dunkel')}
                </>
              ) : (
                <>
                  <Icon icon={Sun} size="xs" /> {t('settings.appearance.theme.light', 'Hell')}
                </>
              )}
            </button>
          ))}
        </div>
      </SettingsCard>

      <EquipmentColorsSection />

      {/* #291 — Globaler Slider fuer Port-Label-Schriftgroessen. */}
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
          <span className="w-10 text-right font-mono text-cp-xs text-cp-text-secondary">
            {portLabelFontSize}px
          </span>
          <button
            type="button"
            onClick={() => setPortLabelFontSize(11)}
            disabled={portLabelFontSize === 11}
            className="rounded bg-cp-surface-2 px-2 py-0.5 text-[11px] text-cp-text-secondary hover:bg-cp-surface-4 disabled:opacity-50"
            title={t('settings.fontSize.reset', 'Auf Default 11 px zurücksetzen')}
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
            className={`flex-1 rounded px-3 py-1 text-cp-xs ${
              !colorPortsByType
                ? 'bg-sky-700 text-white'
                : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
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
            className={`flex-1 rounded px-3 py-1 text-cp-xs ${
              colorPortsByType
                ? 'bg-sky-700 text-white'
                : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
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
            className={`flex-1 rounded px-3 py-1 text-cp-xs ${
              cableColorMode === 'manual'
                ? 'bg-sky-700 text-white'
                : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
            }`}
          >
            {t('settings.appearance.cableColor.manual', 'Manuell')}
          </button>
          <button
            type="button"
            onClick={() => setCableColorMode('byLength')}
            className={`flex-1 rounded px-3 py-1 text-cp-xs ${
              cableColorMode === 'byLength'
                ? 'bg-sky-700 text-white'
                : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
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
        <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
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
        <label className="flex items-center gap-2 text-cp-base text-cp-text-bright">
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
        <div className="flex flex-wrap items-center gap-3 text-cp-base text-cp-text-bright">
          <label className="flex items-center gap-2">
            <span className="text-cp-xs text-cp-text-muted">{t('settings.canvasBg.variant', 'Muster')}</span>
            <select
              value={bgVariant}
              onChange={(e) => setBgVariant(e.target.value as 'dots' | 'lines' | 'cross' | 'none')}
              className="rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-xs"
            >
              <option value="dots">{t('settings.canvasBg.variant.dots', 'Punkte')}</option>
              <option value="lines">{t('settings.canvasBg.variant.lines', 'Linien')}</option>
              <option value="cross">{t('settings.canvasBg.variant.cross', 'Kreuze')}</option>
              <option value="none">{t('settings.canvasBg.variant.none', 'Kein Raster')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-cp-xs text-cp-text-muted">{t('settings.canvasBg.opacity', 'Deckkraft')}</span>
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
            <span className="w-10 text-right text-cp-xs text-cp-text-muted">
              {Math.round(bgOpacity * 100)}%
            </span>
          </label>
        </div>
        {/* v7.7.1 — Custom canvas background image upload (Issue #71). */}
        <div className="mt-4 border-t border-cp-border-muted pt-3">
          <div className="mb-2 text-cp-xs font-semibold uppercase tracking-wide text-cp-text-muted">
            {t('settings.canvasBg.imageTitle', 'Eigenes Hintergrundbild')}
          </div>
          <div className="mb-2 text-[11px] text-cp-text-muted">
            {t(
              'settings.canvasBg.imageDesc',
              'Lade ein eigenes Bild als Canvas-Hintergrund — getrennt für Dark- und Light-Mode. Das Rastermuster (Punkte/Linien/Kreuze) wird darüber gezeichnet.',
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {([
              ['dark', t('settings.canvasBg.darkImage', 'Dark-Mode-Bild'), canvasBgImageDark] as const,
              ['light', t('settings.canvasBg.lightImage', 'Light-Mode-Bild'), canvasBgImageLight] as const,
            ]).map(([theme, label, current]) => (
              <div key={theme} className="rounded border border-cp-border-muted bg-cp-surface-3/40 p-2">
                <div className="mb-1 text-[11px] font-semibold text-cp-text-secondary">{label}</div>
                {current ? (
                  <>
                    <img
                      src={current}
                      alt={`${theme} background`}
                      className="mb-2 h-20 w-full rounded border border-cp-border object-cover"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          const dataUri = await pickImageAsDataUri()
                          if (dataUri) setCanvasBgImage(theme, dataUri)
                        }}
                        className="flex-1 rounded bg-cp-surface-4 px-2 py-1 text-[11px] hover:bg-cp-surface-5"
                      >
                        {t('settings.canvasBg.replace', 'Ersetzen…')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCanvasBgImage(theme, null)}
                        className="rounded bg-red-900/60 px-2 py-1 text-[11px] text-red-200 hover:bg-red-800"
                        title={t('settings.canvasBg.remove', 'Bild entfernen')}
                        aria-label={t('settings.canvasBg.remove', 'Bild entfernen')}
                      >
                        <Icon icon={X} size="sm" />
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
                    className="w-full rounded border border-dashed border-cp-border bg-cp-surface-1 px-2 py-4 text-[11px] text-cp-text-muted hover:border-cp-surface-5 hover:text-cp-text-bright"
                  >
                    {t('settings.canvasBg.upload', '+ Bild hochladen…')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-cp-xs text-cp-text-secondary">
            <span className="text-cp-text-muted">{t('settings.canvasBg.fit', 'Skalierung')}</span>
            <select
              value={canvasBgImageFit}
              onChange={(e) => setCanvasBgImageFit(e.target.value as 'cover' | 'contain' | 'tile')}
              className="rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-xs"
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
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-cp-base md:grid-cols-3">
          {allConnectorTypeEntries.map(({ name, isCustom, defaultColor }) => {
            const override = connectorTypeColors[name] ?? ''
            const effective = override || defaultColor
            return (
              <label
                key={name}
                className="flex items-center gap-2 text-cp-text-bright"
                title={`Default: ${defaultColor}${isCustom ? ' (custom)' : ''}`}
              >
                <input
                  type="color"
                  value={effective}
                  onChange={(e) => setConnectorTypeColor(name, e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-cp-border bg-cp-surface-1 p-0.5"
                />
                <span className="flex-1 truncate text-cp-xs">
                  {name}
                  {isCustom && <span className="ml-1 text-[11px] text-cp-text-muted">(custom)</span>}
                </span>
                {override && (
                  <button
                    type="button"
                    onClick={() => setConnectorTypeColor(name, null)}
                    className="rounded bg-cp-surface-4 px-1 py-0.5 text-[10px] text-cp-text-secondary hover:bg-cp-surface-5"
                    title={t('settings.colors.resetDefault', 'Auf Default zurücksetzen')}
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
            className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-4"
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
          <div className="text-[11px] text-cp-text-muted">
            {t('settings.categoryColors.empty', 'Noch keine Kategorien bekannt. Wird gefuellt sobald Geraete im Plan oder in der Library Kategorien haben.')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-cp-base md:grid-cols-3">
            {allKnownCategories.map((cat) => {
              const override = categoryColors[cat] ?? ''
              const effective = override || '#94a3b8'
              return (
                <label key={cat} className="flex items-center gap-2 text-cp-text-bright">
                  <input
                    type="color"
                    value={effective}
                    onChange={(e) => setCategoryColor(cat, e.target.value)}
                    className="h-6 w-8 cursor-pointer rounded border border-cp-border bg-cp-surface-1 p-0.5"
                  />
                  <span className="flex-1 truncate text-cp-xs" title={cat}>{cat}</span>
                  {override && (
                    <button
                      type="button"
                      onClick={() => setCategoryColor(cat, null)}
                      className="rounded bg-cp-surface-4 px-1 py-0.5 text-[10px] text-cp-text-secondary hover:bg-cp-surface-5"
                      title={t('settings.colors.resetDefault', 'Auf Default zurücksetzen')}
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
              className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-4"
            >
              {t('settings.categoryColors.resetAll', 'Alle zuruecksetzen')}
            </button>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
