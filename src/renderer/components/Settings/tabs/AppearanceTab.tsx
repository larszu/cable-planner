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
import { PanelHint } from '../../shared/PanelHint'

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
      title={t('settings.customPalette.title', 'Custom palette')}
      description={t(
        'settings.customPalette.desc',
        'Custom colors for canvas background and grid — overrides the theme defaults (dark/light). Affects only the canvas; dialogs stay themed.',
      )}
    >
      <label className="mb-2 flex items-center gap-2 text-cp-base text-cp-text-bright">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setPalette(e.target.checked ? current : null)}
        />
        {t('settings.customPalette.enable', 'Enable custom palette')}
      </label>
      {enabled && (
        <div className="grid grid-cols-3 gap-3 text-cp-xs">
          {(
            [
              { key: 'canvasBg', label: t('settings.customPalette.bg', 'Background') },
              { key: 'gridColor', label: t('settings.customPalette.grid', 'Grid stroke') },
              // `accent` stand hier als dritter Regler -- und wurde von NICHTS
              // gelesen. Jeder Konsument der Palette tippt genau zwei Felder
              // (`{ canvasBg, gridColor }`): CanvasArea, exportBackground,
              // exportImage, exportPdf, exportPdfVector. Der Wert wurde
              // gespeichert, beim Laden validiert und nach einem Neustart im
              // Picker wieder angezeigt -- folgenlos.
              //
              // Er wird nicht durch eine erfundene Bedeutung ersetzt: welches
              // Element auf dem Canvas ein "Akzent" waere, steht nirgends, und
              // es zu bestimmen wuerde das Aussehen jedes bestehenden Plans
              // aendern. Das Feld bleibt im Store, damit gespeicherte Staende
              // weiter durch die Validierung in `uiStore.ts:477-483` kommen.
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
              <code className="mt-1 block text-cp-xs text-cp-text-muted">
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
        title={t('settings.appearance.language', 'Language')}
        description={t(
          'settings.appearance.languageDesc',
          'UI language. Switching is instant. Some deeply nested dialogs are still German-only — see the i18n coverage note.',
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
        <PanelHint
          className="mt-2 text-cp-xs text-cp-text-muted"
          text={t(
            'settings.appearance.coverage',
            'Translation coverage: comprehensive (1650+ keys). All menus, toolbars, properties panels (incl. PortList, all 17 sub-sections), library, all dialogs (Cable, ATEM ×3, Videohub, GreenGo, Rentman ×5, Rack builder + sub-dialogs, Print, Export, Mobile share, GraphML import, Onboarding tour, About) and shared widgets are language-aware. Strings not yet translated fall through to the German source.',
          )}
        />
      </SettingsCard>

      <SettingsCard
        title={t('settings.appearance.theme', 'Theme')}
        description={t(
          'settings.appearance.themeDesc',
          'Canvas background colour. Optimised for dark; light is intended for PDF export or bright environments.',
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
                  <Icon icon={Moon} size="xs" /> {t('settings.appearance.theme.dark', 'Dark')}
                </>
              ) : (
                <>
                  <Icon icon={Sun} size="xs" /> {t('settings.appearance.theme.light', 'Light')}
                </>
              )}
            </button>
          ))}
        </div>
      </SettingsCard>

      <EquipmentColorsSection />

      {/* #291 — Globaler Slider fuer Port-Label-Schriftgroessen. */}
      <SettingsCard
        title={t('settings.appearance.portLabelSize', 'Port label font size')}
        description={t(
          'settings.appearance.portLabelSizeDesc',
          'Font size of the input/output labels on the device cards. Default 11 px. Larger = easier to read when zoomed out, but devices get wider.',
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
            className="rounded bg-cp-surface-2 px-2 py-0.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-4 disabled:opacity-50"
            title={t('settings.fontSize.reset', 'Reset to default 11 px')}
          >
            ↺
          </button>
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.appearance.ports', 'Port colours')}
        description={t(
          'settings.appearance.portsDesc',
          'Controls how port handles on equipment are coloured.',
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
              'Cyan = input, green = output, purple = bidirectional',
            )}
          >
            {t('settings.appearance.ports.byDirection', 'By direction (default)')}
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
              'SDI = amber, HDMI = violet, Ethernet = green, fibre = yellow…',
            )}
          >
            {t('settings.appearance.ports.byType', 'By connector type')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.appearance.cableColor', 'Cable colour')}
        description={t(
          'settings.appearance.cableColorDesc',
          'Manual = per cable in the properties panel; by length = length-based colour coding; by discipline = the layer legend (video/audio/control/network/power). The colour stored on the cable is kept in every mode.',
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
            {t('settings.appearance.cableColor.manual', 'Manual')}
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
            {t('settings.appearance.cableColor.byLength', 'By length')}
          </button>
          {/* Die Layer-Farben gab es bis 2026-09-08 nur an den Legenden-Chips:
              der Plan versprach eine Codierung, die er nicht einlöste. Als
              eigener Modus und nicht als Vorgabe — wer Kabel von Hand
              eingefärbt hat, soll sie nicht beim nächsten Start anders sehen. */}
          <button
            type="button"
            onClick={() => setCableColorMode('byLayer')}
            className={`flex-1 rounded px-3 py-1 text-cp-xs ${
              cableColorMode === 'byLayer'
                ? 'bg-sky-700 text-white'
                : 'bg-cp-surface-2 text-cp-text-secondary hover:bg-cp-surface-4'
            }`}
          >
            {t('settings.appearance.cableColor.byLayer', 'By discipline')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.appearance.arrows', 'Arrows on cables')}
        description={t(
          'settings.appearance.arrowsDesc',
          'Default for newly drawn cables. Overridable per cable in the properties panel.',
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
            'Show arrow at the target end (signal flow direction)',
          )}
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.connections.title', 'Connection warnings')}
        description={t(
          'settings.connections.overrideDesc',
          'A connector-type conflict normally triggers a confirmation prompt. With override the connection is created anyway without asking (marked as adapter/converter).',
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
            'Connect any inputs and outputs without warning',
          )}
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.canvasBg.title', 'Canvas background')}
        description={t(
          'settings.canvasBg.desc',
          'Pattern + opacity of the canvas grid. For large plans a low opacity reduces visual clutter. Grid size comes from the canvas toolbar at the top.',
        )}
      >
        <div className="flex flex-wrap items-center gap-3 text-cp-base text-cp-text-bright">
          <label className="flex items-center gap-2">
            <span className="text-cp-xs text-cp-text-muted">{t('settings.canvasBg.variant', 'Pattern')}</span>
            <select
              value={bgVariant}
              onChange={(e) => setBgVariant(e.target.value as 'dots' | 'lines' | 'cross' | 'none')}
              className="rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-xs"
            >
              <option value="dots">{t('settings.canvasBg.variant.dots', 'Dots')}</option>
              <option value="lines">{t('settings.canvasBg.variant.lines', 'Lines')}</option>
              <option value="cross">{t('settings.canvasBg.variant.cross', 'Crosses')}</option>
              <option value="none">{t('settings.canvasBg.variant.none', 'No grid')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-cp-xs text-cp-text-muted">{t('settings.canvasBg.opacity', 'Opacity')}</span>
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
            {t('settings.canvasBg.imageTitle', 'Custom background image')}
          </div>
          <div className="mb-2 text-cp-xs text-cp-text-muted">
            {t(
              'settings.canvasBg.imageDesc',
              'Load your own image as the canvas background — separately for dark and light mode. The grid pattern (dots/lines/crosses) is drawn on top.',
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {([
              ['dark', t('settings.canvasBg.darkImage', 'Dark-mode image'), canvasBgImageDark] as const,
              ['light', t('settings.canvasBg.lightImage', 'Light-mode image'), canvasBgImageLight] as const,
            ]).map(([theme, label, current]) => (
              <div key={theme} className="rounded border border-cp-border-muted bg-cp-surface-3/40 p-2">
                <div className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">{label}</div>
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
                        className="flex-1 rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
                      >
                        {t('settings.canvasBg.replace', 'Replace…')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCanvasBgImage(theme, null)}
                        className="rounded bg-red-900/60 px-2 py-1 text-cp-xs text-red-200 hover:bg-red-800"
                        title={t('settings.canvasBg.remove', 'Remove image')}
                        aria-label={t('settings.canvasBg.remove', 'Remove image')}
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
                    className="w-full rounded border border-dashed border-cp-border bg-cp-surface-1 px-2 py-4 text-cp-xs text-cp-text-muted hover:border-cp-surface-5 hover:text-cp-text-bright"
                  >
                    {t('settings.canvasBg.upload', '+ Upload image…')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-cp-xs text-cp-text-secondary">
            <span className="text-cp-text-muted">{t('settings.canvasBg.fit', 'Scaling')}</span>
            <select
              value={canvasBgImageFit}
              onChange={(e) => setCanvasBgImageFit(e.target.value as 'cover' | 'contain' | 'tile')}
              className="rounded border border-cp-border bg-cp-surface-1 p-1 text-cp-xs"
            >
              <option value="cover">{t('settings.canvasBg.fit.cover', 'Cover (fills completely, crops)')}</option>
              <option value="contain">{t('settings.canvasBg.fit.contain', 'Contain (fully visible, with margin)')}</option>
              <option value="tile">{t('settings.canvasBg.fit.tile', 'Tile (repeated)')}</option>
            </select>
          </label>
        </div>
      </SettingsCard>

      <CustomPaletteCard />

      <SettingsCard
        title={t('settings.connectorColors.title', 'Connector-type colors')}
        description={t(
          'settings.connectorColors.desc',
          'Custom color per connector type — only visible when "Ports by type" is active above. An empty field resets to default.',
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
                  {isCustom && <span className="ml-1 text-cp-xs text-cp-text-muted">(custom)</span>}
                </span>
                {override && (
                  <button
                    type="button"
                    onClick={() => setConnectorTypeColor(name, null)}
                    className="rounded bg-cp-surface-4 px-1 py-0.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-5"
                    title={t('settings.colors.resetDefault', 'Reset to default')}
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
            {t('settings.connectorColors.resetAll', 'Reset all')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.categoryColors.title', 'Device colors per category')}
        description={t(
          'settings.categoryColors.desc',
          'Default color per category (e.g. monitors=blue). Applies to all devices of that category without their own color. A color set per device still wins.',
        )}
      >
        {allKnownCategories.length === 0 ? (
          <div className="text-cp-xs text-cp-text-muted">
            {t('settings.categoryColors.empty', 'No categories known yet. Populated as soon as devices in the plan or library have categories.')}
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
                      className="rounded bg-cp-surface-4 px-1 py-0.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-5"
                      title={t('settings.colors.resetDefault', 'Reset to default')}
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
              {t('settings.categoryColors.resetAll', 'Reset all')}
            </button>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
