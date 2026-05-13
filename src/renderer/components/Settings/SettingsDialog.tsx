import { useEffect, useMemo, useState } from 'react'
import { cablePlannerApi, hasDesktopBridge } from '../../lib/bridge'
import { useSettingsStore } from '../../store/settingsStore'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { RoutingToggle } from '../shared/RoutingToggle'
import { pickImageAsDataUri } from '../../lib/readImageAsDataUri'
import { confirmDialog } from '../../lib/confirmDialog'
import { promptDialog } from '../../lib/promptDialog'
import { getGeminiApiKey, setGeminiApiKey } from '../../lib/aiSuggestions'
import { format, useTranslation } from '../../lib/i18n'
import type { Language } from '../../store/uiStore'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import { DEFAULT_CONNECTOR_TYPE_COLORS } from '../../lib/cableColors'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

type SettingsSection =
  | 'project'
  | 'appearance'
  | 'editing'
  | 'integrations'
  | 'sync'
  | 'advanced'

const TAB_ICONS: Record<SettingsSection, string> = {
  project: '📋',
  appearance: '🎨',
  editing: '✏️',
  integrations: '🔌',
  sync: '🔄',
  advanced: '⚙',
}

const TAB_FALLBACK_LABEL: Record<SettingsSection, string> = {
  project: 'Projekt',
  appearance: 'Darstellung',
  editing: 'Bearbeiten',
  integrations: 'Integrationen',
  sync: 'Netzwerk-Sync',
  advanced: 'Erweitert',
}

const TAB_FALLBACK_TITLE: Record<SettingsSection, string> = {
  project: 'Projekt-Einstellungen',
  appearance: 'Darstellung',
  editing: 'Bearbeiten',
  integrations: 'Integrationen',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        ref={drag.containerRef}
        style={drag.containerStyle}
        className="flex w-full max-w-4xl overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        <aside className="flex w-52 shrink-0 flex-col gap-1 border-r border-slate-800 bg-slate-950/40 p-3">
          <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('settings.section', 'Einstellungen')}
          </h3>
          {(Object.keys(TAB_ICONS) as SettingsSection[]).map((id) => navItem(id))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header
            {...drag.headerProps}
            className="flex items-center justify-between border-b border-slate-800 px-4 py-2 select-none"
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

          <div className="flex-1 overflow-auto p-4">
            {section === 'project' && <ProjectTab onClose={onClose} />}
            {section === 'appearance' && <AppearanceTab />}
            {section === 'editing' && <EditingTab />}
            {section === 'integrations' && <IntegrationsTab onClose={onClose} />}
            {section === 'sync' && <SyncTab />}
            {section === 'advanced' && <AdvancedTab />}
          </div>
        </main>
      </div>
    </div>
  )
}

// --- Reusable card ---------------------------------------------------------

const SettingsCard = ({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) => (
  <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
    <div className="mb-2 text-xs font-semibold text-slate-300">{title}</div>
    {description && <p className="mb-2 text-[11px] text-slate-500">{description}</p>}
    {children}
  </div>
)

// --- Tab: Project ----------------------------------------------------------

const ProjectTab = ({ onClose: _onClose }: { onClose: () => void }) => {
  const metadata = useProjectStore((s) => s.project.metadata)
  const updateProjectMetadata = useProjectStore((s) => s.updateProjectMetadata)
  const [draftMeta, setDraftMeta] = useState(metadata)
  const t = useTranslation()
  useEffect(() => setDraftMeta(metadata), [metadata])

  const persistMeta = () =>
    updateProjectMetadata({
      name: draftMeta.name,
      description: draftMeta.description,
      author: draftMeta.author,
      client: draftMeta.client,
      contractor: draftMeta.contractor,
      projectNumber: draftMeta.projectNumber,
      companyLogo: draftMeta.companyLogo,
      clientLogo: draftMeta.clientLogo,
    })

  const pickLogo = async (which: 'companyLogo' | 'clientLogo') => {
    const dataUri = await pickImageAsDataUri()
    if (dataUri) setDraftMeta((prev) => ({ ...prev, [which]: dataUri }))
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        {t(
          'settings.project.intro',
          'Projekt-Metadaten — werden mit der Cable-Planner-Datei gespeichert.',
        )}
      </p>
      <label className="block text-sm">
        {t('settings.project.name', 'Projektname')}
        <input
          type="text"
          value={draftMeta.name}
          onChange={(e) => setDraftMeta({ ...draftMeta, name: e.target.value })}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          placeholder={t('settings.project.name', 'Projektname')}
        />
      </label>
      <label className="block text-sm">
        {t('settings.project.description', 'Beschreibung')}
        <textarea
          value={draftMeta.description ?? ''}
          onChange={(e) => setDraftMeta({ ...draftMeta, description: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          placeholder={t(
            'settings.project.descriptionPlaceholder',
            'Optionale Projektbeschreibung',
          )}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          {t('settings.project.client', 'Auftraggeber (Kunde)')}
          <input
            type="text"
            value={draftMeta.client ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, client: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder={t('settings.project.clientPlaceholder', 'Endkunde')}
          />
        </label>
        <label className="block text-sm">
          {t('settings.project.contractor', 'Auftragnehmer')}
          <input
            type="text"
            value={draftMeta.contractor ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, contractor: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder={t('settings.project.contractorPlaceholder', 'Ausführende Firma')}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          {t('settings.project.author', 'Autor')}
          <input
            type="text"
            value={draftMeta.author ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, author: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder={t('settings.project.authorPlaceholder', 'Dein Name')}
          />
        </label>
        <label className="block text-sm">
          {t('settings.project.number', 'Projekt-Nr.')}
          <input
            type="text"
            value={draftMeta.projectNumber ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, projectNumber: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder={t('settings.project.numberPlaceholder', 'z. B. 2026-042')}
          />
        </label>
      </div>

      <SettingsCard
        title={t('settings.project.logos', 'Bauplan-Signatur (Logos)')}
        description={t(
          'settings.project.logosHint',
          'Logos werden als Daten-URI in der Projektdatei gespeichert (PDF-Export & Canvas-Signatur).',
        )}
      >
        <div className="grid grid-cols-2 gap-3">
          {(['companyLogo', 'clientLogo'] as const).map((field) => {
            const label =
              field === 'companyLogo'
                ? t('settings.project.logo.contractor', 'Auftragnehmer')
                : t('settings.project.logo.client', 'Kunde')
            const current = draftMeta[field]
            return (
              <div key={field} className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded border border-slate-700 bg-white/5">
                  {current ? (
                    <img src={current} alt={label} className="max-h-16 max-w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-slate-500">{label}</span>
                  )}
                </div>
                <div className="flex w-full gap-1">
                  <button
                    type="button"
                    onClick={() => pickLogo(field)}
                    className="flex-1 rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                  >
                    {t('common.choose', 'Wählen…')}
                  </button>
                  {current && (
                    <button
                      type="button"
                      onClick={() => setDraftMeta((prev) => ({ ...prev, [field]: undefined }))}
                      title={t('common.remove', 'Entfernen')}
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SettingsCard>

      <SettingsCard title={t('settings.project.linkedRentman', 'Verknüpftes Rentman-Projekt')}>
        {metadata.rentmanProjectId ? (
          <div className="text-xs text-slate-400">
            <span className="text-orange-300">
              {metadata.rentmanProjectName ?? `Projekt #${metadata.rentmanProjectId}`}
            </span>
            <span className="ml-2 text-slate-500">(ID: {metadata.rentmanProjectId})</span>
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            {t(
              'settings.project.notLinked',
              'Kein Rentman-Projekt verknüpft. Verknüpfung im Tab „Integrationen“ herstellen.',
            )}
          </div>
        )}
      </SettingsCard>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => setDraftMeta(metadata)}
          className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
        >
          {t('common.reset', 'Zurücksetzen')}
        </button>
        <button
          type="button"
          onClick={persistMeta}
          className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
        >
          {t('common.save', 'Speichern')}
        </button>
      </div>
    </div>
  )
}

// --- Tab: Appearance -------------------------------------------------------

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
        title={t('settings.connectorColors.title', 'Steckertyp-Farben')}
        description={t(
          'settings.connectorColors.desc',
          'Eigene Farbe pro Stecker-Typ — nur sichtbar wenn "Ports nach Typ" oben aktiv ist. Leeres Feld setzt zurück auf Standard.',
        )}
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm md:grid-cols-3">
          {ALL_CONNECTOR_TYPES.map((ct) => {
            const override = connectorTypeColors[ct] ?? ''
            const effective = override || DEFAULT_CONNECTOR_TYPE_COLORS[ct]
            return (
              <label key={ct} className="flex items-center gap-2 text-slate-200" title={`Default: ${DEFAULT_CONNECTOR_TYPE_COLORS[ct]}`}>
                <input
                  type="color"
                  value={effective}
                  onChange={(e) => setConnectorTypeColor(ct, e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-slate-900 p-0.5"
                />
                <span className="flex-1 truncate text-xs">{ct}</span>
                {override && (
                  <button
                    type="button"
                    onClick={() => setConnectorTypeColor(ct, null)}
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
    </div>
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
    </div>
  )
}

// --- Tab: Integrations -----------------------------------------------------

const IntegrationsTab = ({ onClose }: { onClose: () => void }) => {
  const [token, setToken] = useState('')
  const hasToken = useSettingsStore((s) => s.hasToken)
  const tokenStatus = useSettingsStore((s) => s.tokenStatus)
  const setHasToken = useSettingsStore((s) => s.setHasToken)
  const setTokenStatus = useSettingsStore((s) => s.setTokenStatus)
  const metadata = useProjectStore((s) => s.project.metadata)
  const openRentmanImport = useUiStore((s) => s.openRentmanImport)
  const [busy, setBusy] = useState(false)
  const [geminiKey, setGeminiKeyState] = useState(getGeminiApiKey())
  const [geminiSaved, setGeminiSaved] = useState(false)
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

  const saveGemini = () => {
    setGeminiApiKey(geminiKey.trim())
    setGeminiSaved(true)
    window.setTimeout(() => setGeminiSaved(false), 2000)
  }

  return (
    <div className="space-y-3">
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

      <SettingsCard
        title={t('settings.integrations.gemini', 'Gemini API (KI-Port-Vorschläge)')}
        description={t(
          'settings.integrations.geminiDesc',
          "API-Key von aistudio.google.com. Wird im Browser-localStorage gespeichert. Nötig für die '✨ Gemini'-Buttons im Geräte-Wizard und in der Bibliothek.",
        )}
      >
        <input
          type="password"
          value={geminiKey}
          onChange={(e) => setGeminiKeyState(e.target.value)}
          placeholder="AIza…"
          className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
          autoComplete="off"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={saveGemini}
            className="rounded bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500"
          >
            {t('settings.integrations.gemini.save', 'Key speichern')}
          </button>
          {geminiSaved && (
            <span className="text-xs text-emerald-300">
              {t('settings.integrations.gemini.saved', '✓ gespeichert')}
            </span>
          )}
          {geminiKey && (
            <button
              type="button"
              onClick={() => {
                setGeminiApiKey('')
                setGeminiKeyState('')
              }}
              className="ml-auto rounded bg-slate-800 px-3 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
            >
              {t('settings.integrations.gemini.delete', 'Löschen')}
            </button>
          )}
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          {t('settings.integrations.gemini.hint', 'Key bei ')}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            aistudio.google.com
          </a>{' '}
          erstellen.
        </div>
      </SettingsCard>
    </div>
  )
}

// --- Tab: Sync -------------------------------------------------------------

const SyncTab = () => {
  const sharedSyncPath = useSettingsStore((s) => s.sharedSyncPath)
  const sharedSyncUser = useSettingsStore((s) => s.sharedSyncUser)
  const setSyncPath = useSettingsStore((s) => s.setSyncPath)
  const setSyncUser = useSettingsStore((s) => s.setSyncUser)
  const [draftSyncPath, setDraftSyncPath] = useState(sharedSyncPath)
  const [draftSyncUser, setDraftSyncUser] = useState(sharedSyncUser)
  const t = useTranslation()

  useEffect(() => {
    setDraftSyncPath(sharedSyncPath)
    setDraftSyncUser(sharedSyncUser)
  }, [sharedSyncPath, sharedSyncUser])

  return (
    <div className="space-y-3 text-sm">
      {!hasDesktopBridge && (
        <div className="rounded border border-amber-700/50 bg-amber-900/20 p-2 text-xs text-amber-300">
          {t(
            'settings.sync.desktopOnly',
            'Netzwerk-Sync ist nur in der Desktop-App verfügbar.',
          )}
        </div>
      )}
      <p className="text-xs text-slate-400">
        {t(
          'settings.sync.intro',
          'Gemeinsames Verzeichnis (FTP-Laufwerk, Netzwerkpfad oder lokaler Ordner), in dem Projekt, Bibliothek und Presets als JSON-Dateien geteilt werden.',
        )}
      </p>
      <label className="block text-sm text-slate-300">
        {t('settings.sync.path', 'Sync-Verzeichnis')}
        <input
          type="text"
          value={draftSyncPath}
          onChange={(e) => setDraftSyncPath(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
          placeholder="Z:\Projekte\CablePlanner oder \\server\share\cable-planner"
        />
      </label>
      <label className="block text-sm text-slate-300">
        {t('settings.sync.user', 'Benutzername (für Lock-Anzeige)')}
        <input
          type="text"
          value={draftSyncUser}
          onChange={(e) => setDraftSyncUser(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          placeholder={t('settings.sync.userPlaceholder', 'z. B. Max Mustermann')}
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setDraftSyncPath(sharedSyncPath)
            setDraftSyncUser(sharedSyncUser)
          }}
          className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
        >
          {t('common.reset', 'Zurücksetzen')}
        </button>
        <button
          type="button"
          onClick={() => {
            setSyncPath(draftSyncPath)
            setSyncUser(draftSyncUser)
          }}
          className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
        >
          {t('common.save', 'Speichern')}
        </button>
      </div>
      <SettingsCard title={t('settings.sync.notes', 'Hinweise')}>
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
          <li>
            {t(
              'settings.sync.notes.push',
              'Push schreibt: cable-planner.project.json, .library.json, .presets.json',
            )}
          </li>
          <li>
            {t(
              'settings.sync.notes.pull',
              'Pull lädt diese Dateien aus dem Verzeichnis in den aktuellen Stand.',
            )}
          </li>
          <li>
            {t(
              'settings.sync.notes.lock',
              'Ein Lock-File (.cable-planner-sync.lock) verhindert gleichzeitiges Überschreiben (2 h TTL).',
            )}
          </li>
        </ul>
      </SettingsCard>
    </div>
  )
}

// --- Tab: Advanced ---------------------------------------------------------

const AdvancedTab = () => {
  const autosaveIntervalMs = useSettingsStore((s) => s.autosaveIntervalMs)
  const setAutosaveIntervalMs = useSettingsStore((s) => s.setAutosaveIntervalMs)
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const renameCustomCategory = useProjectStore((s) => s.renameCustomCategory)
  const addKnownCategories = useProjectStore((s) => s.addKnownCategories)
  const t = useTranslation()

  const allCategories = useMemo(
    () =>
      Array.from(
        new Set([
          ...knownCategories,
          ...customLibrary.map((tpl) => tpl.category).filter(Boolean),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [knownCategories, customLibrary],
  )

  const usageCount = (cat: string) =>
    customLibrary.filter((tpl) => tpl.category === cat).length

  const handleRename = async (cat: string) => {
    const next = (
      await promptDialog(t('settings.advanced.categories.renamePrompt', 'Kategorie umbenennen'), cat)
    )?.trim()
    if (!next || next === cat) return
    renameCustomCategory(cat, next)
  }

  const handleAdd = async () => {
    const next = (
      await promptDialog(t('settings.advanced.categories.addPrompt', 'Neue Kategorie'))
    )?.trim()
    if (next) addKnownCategories([next])
  }

  const clearCache = async (key: string, label: string) => {
    if (
      !(await confirmDialog(
        format(t('settings.advanced.caches.confirm', '{label} leeren?'), { label }),
        { destructive: true, okLabel: t('settings.advanced.caches.confirmBtn', 'Leeren') },
      ))
    )
      return
    try {
      localStorage.removeItem(key)
      window.alert(
        format(
          t(
            'settings.advanced.caches.cleared',
            '{label} geleert. Beim nächsten Start wird neu geladen.',
          ),
          { label },
        ),
      )
    } catch {
      /* ignore */
    }
  }

  const exportAllData = () => {
    const dump: Record<string, string | null> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('cable-planner:')) dump[k] = localStorage.getItem(k)
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `cable-planner-localStorage-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const resetWelcome = async () => {
    if (
      !(await confirmDialog(
        t(
          'settings.advanced.caches.welcomeConfirm',
          'Willkommens-Dialog beim nächsten Start wieder anzeigen?',
        ),
        { okLabel: t('common.reset', 'Zurücksetzen') },
      ))
    )
      return
    localStorage.removeItem('cable-planner:welcomed')
  }

  return (
    <div className="space-y-3">
      <SettingsCard
        title={t('settings.advanced.autosave', 'Autosave')}
        description={t(
          'settings.advanced.autosaveDesc',
          'Wie oft das aktuelle Projekt automatisch in localStorage gespeichert wird. Standard: 400 ms.',
        )}
      >
        <label className="block text-sm text-slate-300">
          {t('settings.advanced.autosaveInterval', 'Autosave-Intervall (ms)')}
          <input
            type="number"
            min={100}
            max={30000}
            step={100}
            value={autosaveIntervalMs}
            onChange={(e) => setAutosaveIntervalMs(Number(e.target.value) || 400)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
          />
        </label>
      </SettingsCard>

      <SettingsCard
        title={t('settings.advanced.categories', 'Kategorienverwaltung')}
        description={t(
          'settings.advanced.categoriesDesc',
          'Bibliothek-Kategorien umbenennen oder neue anlegen. Beim Umbenennen wandern alle zugeordneten Vorlagen mit.',
        )}
      >
        <div className="max-h-56 overflow-auto rounded border border-slate-800 bg-slate-950/50">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">
                  {t('settings.advanced.categories.col.name', 'Kategorie')}
                </th>
                <th className="px-2 py-1 text-right">
                  {t('settings.advanced.categories.col.count', 'Vorlagen')}
                </th>
                <th className="px-2 py-1" aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {allCategories.map((cat) => (
                <tr key={cat} className="border-t border-slate-800">
                  <td className="px-2 py-1 text-slate-100">{cat}</td>
                  <td className="px-2 py-1 text-right text-slate-400">{usageCount(cat)}</td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRename(cat)}
                      className="rounded bg-slate-700 px-2 py-0.5 text-[10px] hover:bg-slate-600"
                    >
                      {t('common.rename', 'Umbenennen')}
                    </button>
                  </td>
                </tr>
              ))}
              {allCategories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-3 text-center text-slate-500">
                    {t('settings.advanced.categories.empty', 'Noch keine Kategorien.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="mt-2 rounded bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600"
        >
          {t('settings.advanced.categories.addBtn', '+ Neue Kategorie')}
        </button>
      </SettingsCard>

      <SettingsCard
        title={t('settings.advanced.caches', 'Caches & Lokale Daten')}
        description={t(
          'settings.advanced.cachesDesc',
          'Cache-Inhalte werden bei Bedarf neu geladen. Daten gehen nicht verloren — nur die Performance-Caches.',
        )}
      >
        <div className="grid grid-cols-1 gap-1">
          <button
            type="button"
            onClick={() =>
              clearCache('cable-planner:rentmanTemplateCache:v1', 'Rentman-Template-Cache')
            }
            className="rounded bg-slate-700 px-3 py-1 text-xs text-left hover:bg-slate-600"
          >
            {t('settings.advanced.caches.rentman', 'Rentman-Template-Cache leeren')}
          </button>
          <button
            type="button"
            onClick={() => clearCache('cable-planner:netbox:index:v1', 'NetBox-Index-Cache')}
            className="rounded bg-slate-700 px-3 py-1 text-xs text-left hover:bg-slate-600"
          >
            {t('settings.advanced.caches.netbox', 'NetBox-Index-Cache leeren')}
          </button>
          <button
            type="button"
            onClick={() => clearCache('cable-planner:web:recents', 'Web-Suchverlauf')}
            className="rounded bg-slate-700 px-3 py-1 text-xs text-left hover:bg-slate-600"
          >
            {t('settings.advanced.caches.web', 'Web-Suchverlauf leeren')}
          </button>
          <button
            type="button"
            onClick={resetWelcome}
            className="rounded bg-slate-700 px-3 py-1 text-xs text-left hover:bg-slate-600"
          >
            {t('settings.advanced.caches.welcome', 'Willkommens-Dialog beim nächsten Start zeigen')}
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.advanced.export', 'Datenexport')}
        description={t(
          'settings.advanced.exportDesc',
          'Lokal gespeicherte Cable-Planner-Daten als JSON exportieren — z. B. zum Übertragen auf eine andere Maschine.',
        )}
      >
        <button
          type="button"
          onClick={exportAllData}
          className="rounded bg-amber-700 px-3 py-1 text-xs hover:bg-amber-600"
        >
          {t('settings.advanced.exportBtn', 'Alle localStorage-Daten exportieren')}
        </button>
      </SettingsCard>
    </div>
  )
}
