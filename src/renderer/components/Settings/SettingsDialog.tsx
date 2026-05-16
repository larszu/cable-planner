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
import {
  deleteGreenGoPreset,
  loadGreenGoPresets,
  saveGreenGoPreset,
} from '../../lib/greengoSync'
import type { DeviceConfigEntry, DeviceConfigKind } from '../../store/uiStore'
import { HOTKEY_ACTION_LABEL, comboFromEvent } from '../../lib/hotkeys'
import { downloadBlob } from '../../lib/downloadBlob'
import { pickTextFile } from '../../lib/pickFile'

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

// v7.9.0 / Issue #122 — Library Export/Import. Erstes Stück eines
// zentralen Library-Speichers: bisher leben customLibrary +
// groupPresets in localStorage (pro Electron-Installation). Mit dem
// Export kann der User die ganze Library als JSON-Datei speichern
// (Dropbox-sync, Team-Backup, …) und auf einer anderen Installation
// importieren. Eine echte Datei-pro-Gerät + Versions-Tracking
// kommt in einer späteren Phase (#122 ist als Roadmap-Issue
// offen markiert).
interface LibraryExportFile {
  type: 'cable-planner-library'
  version: 1
  exportedAt: string
  customLibrary: import('../../types/equipment').EquipmentTemplate[]
  groupPresets: import('../../types/equipment').GroupPreset[]
  knownCategories: string[]
}

const LibraryExportSection = () => {
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const groupPresets = useProjectStore((s) => s.groupPresets)
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const addCustomTemplates = useProjectStore((s) => s.addCustomTemplates)
  const setGroupPresets = useProjectStore((s) => s.setGroupPresets)
  const addKnownCategories = useProjectStore((s) => s.addKnownCategories)
  const [importBusy, setImportBusy] = useState(false)

  const handleExport = () => {
    const payload: LibraryExportFile = {
      type: 'cable-planner-library',
      version: 1,
      exportedAt: new Date().toISOString(),
      customLibrary,
      groupPresets,
      knownCategories,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const ts = new Date().toISOString().slice(0, 10)
    a.download = `cable-planner-library-${ts}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // allow re-import of the same file
    setImportBusy(true)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as LibraryExportFile
      if (data?.type !== 'cable-planner-library') {
        window.alert('Diese Datei ist keine cable-planner-Library (falscher type).')
        return
      }
      // Merge-by-name: addCustomTemplates only adds entries whose name
      // doesn't exist yet. Damit überschreibt der Import nie eigene
      // Edits am gleichen Template.
      if (Array.isArray(data.customLibrary)) {
        addCustomTemplates(data.customLibrary)
      }
      if (Array.isArray(data.knownCategories)) {
        addKnownCategories(data.knownCategories)
      }
      // Group-Presets dürfen ebenfalls nur ergänzt werden, nicht
      // ersetzt — wir kombinieren.
      if (Array.isArray(data.groupPresets)) {
        const byId = new Map(groupPresets.map((p) => [p.id, p]))
        for (const p of data.groupPresets) {
          if (!byId.has(p.id)) byId.set(p.id, p)
        }
        setGroupPresets(Array.from(byId.values()))
      }
      window.alert(
        `Library importiert: ${data.customLibrary?.length ?? 0} Geräte-Templates, ${
          data.groupPresets?.length ?? 0
        } Gruppen-Presets (nur neue Einträge — vorhandene wurden NICHT überschrieben).`,
      )
    } catch (err) {
      window.alert(
        `Import fehlgeschlagen:\n\n${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setImportBusy(false)
    }
  }

  return (
    <SettingsCard
      title="Library Export / Import (#122)"
      description="Sichere deine eigenen Geräte-Templates, Gruppen und Rack-Presets als JSON-Datei. Beim Import werden bestehende Einträge mit gleichem Namen NICHT überschrieben (merge-by-name)."
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
        <button
          type="button"
          onClick={handleExport}
          className="rounded bg-emerald-700 px-3 py-1.5 hover:bg-emerald-600"
          title={`${customLibrary.length} Geräte + ${groupPresets.length} Gruppen exportieren`}
        >
          ⬇ Library exportieren ({customLibrary.length} Geräte, {groupPresets.length} Gruppen)
        </button>
        <label className="rounded bg-sky-700 px-3 py-1.5 cursor-pointer hover:bg-sky-600">
          {importBusy ? 'Importiere…' : '⬆ Library importieren…'}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImport}
            disabled={importBusy}
          />
        </label>
      </div>
    </SettingsCard>
  )
}

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

      <LibraryExportSection />

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

      <CableVisualOptionsCard />

      <CustomCableTypesCard />
    </div>
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
          'Kreuzungs-Brücken auf orthogonalen Kabeln (#65, experimentell — globale Berechnung in v0.11)',
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
          'Mittellinien automatisch versetzen wenn Kabel sich überlagern (#53, experimentell)',
        )}
      </label>
    </SettingsCard>
  )
}

/**
 * Manage the library of user-defined cable specs (issue #64). Built-in
 * specs from `cableCatalog` are read-only and not shown here; only the
 * user's own entries appear with rename / colour / delete controls.
 *
 * Adding a new spec is normally done inline from the Cable dialog via
 * "Als Kabel-Typ speichern" — this card is the corresponding management
 * surface for cleanup and tweaks. Avoids duplicating the full editor.
 */
const CustomCableTypesCard = () => {
  const t = useTranslation()
  const specs = useUiStore((s) => s.customCableSpecs)
  const updateSpec = useUiStore((s) => s.updateCustomCableSpec)
  const removeSpec = useUiStore((s) => s.removeCustomCableSpec)
  return (
    <SettingsCard
      title={t('settings.customCables.title', 'Eigene Kabel-Typen')}
      description={t(
        'settings.customCables.desc',
        'Vom User angelegte Kabel-Typen. Anlegen geht im Kabel-Dialog über "Als Kabel-Typ speichern" wenn "Custom Cable" gewählt ist.',
      )}
    >
      {specs.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          {t('settings.customCables.empty', 'Noch keine eigenen Kabel-Typen gespeichert.')}
        </p>
      ) : (
        <ul className="space-y-1">
          {specs.map((spec) => (
            <li
              key={spec.id}
              className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs"
            >
              <input
                type="color"
                value={spec.color}
                onChange={(e) => updateSpec(spec.id, { color: e.target.value })}
                className="h-6 w-7 cursor-pointer rounded border border-slate-700 bg-slate-900 p-0.5"
                aria-label="Kabel-Farbe"
              />
              <input
                type="text"
                value={spec.name}
                onChange={(e) => updateSpec(spec.id, { name: e.target.value })}
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-slate-100"
              />
              <span className="text-[10px] text-slate-500">
                {spec.connectorType}
                {spec.maxLengthMeters ? ` · max ${spec.maxLengthMeters} m` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `Kabel-Typ "${spec.name}" wirklich löschen? Bereits damit verlegte Kabel auf dem Canvas bleiben unverändert, lassen sich aber nicht mehr neu auf diesen Typ setzen.`,
                    )
                  ) {
                    removeSpec(spec.id)
                  }
                }}
                className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-red-700 hover:text-white"
              >
                {t('common.delete', 'Löschen')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}

// --- Tab: Hotkeys (Issue #69) ---------------------------------------------

const HotkeyRow = ({
  action,
  combo,
  onChange,
}: {
  action: string
  combo: string
  onChange: (combo: string) => void
}) => {
  const [capturing, setCapturing] = useState(false)
  const label = HOTKEY_ACTION_LABEL[action] ?? action
  return (
    <li className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs">
      <span className="flex-1 truncate text-slate-200">{label}</span>
      <button
        type="button"
        onClick={() => setCapturing(true)}
        onBlur={() => setCapturing(false)}
        onKeyDown={(e) => {
          if (!capturing) return
          e.preventDefault()
          const next = comboFromEvent(e)
          if (next) {
            onChange(next)
            setCapturing(false)
          }
        }}
        className={`min-w-[120px] rounded border px-2 py-1 text-center font-mono text-[11px] ${
          capturing
            ? 'border-sky-500 bg-sky-950/60 text-sky-200'
            : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
        }`}
        title={capturing ? 'Taste oder Tasten-Kombination drücken…' : 'Klicken und Taste(n) drücken'}
      >
        {capturing ? 'Taste drücken…' : combo || '—'}
      </button>
      <button
        type="button"
        onClick={() => onChange('')}
        className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-red-700 hover:text-white"
        title="Hotkey leeren"
      >
        ✕
      </button>
    </li>
  )
}

const HotkeysTab = () => {
  const t = useTranslation()
  const hotkeys = useUiStore((s) => s.hotkeys)
  const setHotkey = useUiStore((s) => s.setHotkey)
  const resetHotkeys = useUiStore((s) => s.resetHotkeys)
  const actions = Object.keys(HOTKEY_ACTION_LABEL)
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        {t(
          'settings.hotkeys.intro',
          'Tastenkürzel können hier frei belegt werden. Klicke auf eine Combo-Zelle und drücke die gewünschten Tasten — Ctrl/Shift/Alt + Buchstabe oder Funktionstaste.',
        )}
      </p>
      <SettingsCard
        title={t('settings.hotkeys.title', 'Aktive Tastenkürzel')}
        description={t(
          'settings.hotkeys.desc',
          'Format: Ctrl+Shift+S. Leere Felder deaktivieren den Hotkey. Doppel-Belegungen sind erlaubt — der zuerst gefundene Hotkey gewinnt.',
        )}
      >
        <ul className="space-y-1">
          {actions.map((action) => (
            <HotkeyRow
              key={action}
              action={action}
              combo={hotkeys[action] ?? ''}
              onChange={(combo) => setHotkey(action, combo)}
            />
          ))}
        </ul>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={resetHotkeys}
            className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-300 hover:bg-slate-700"
          >
            {t('settings.hotkeys.reset', 'Auf Standard zurücksetzen')}
          </button>
        </div>
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
  // v7.9.4 — Rentman komplett ein-/ausschaltbar.
  const rentmanEnabled = useUiStore((s) => s.rentmanEnabled)
  const setRentmanEnabled = useUiStore((s) => s.setRentmanEnabled)
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

// --- Tab: Configs (Issue #80) ---------------------------------------------

const CONFIG_KIND_LABEL: Record<DeviceConfigKind, string> = {
  'atem-mv': 'ATEM Multiviewer Layout',
  'atem-audio': 'ATEM Audio-Routing',
  'videohub-labels': 'Videohub Labels',
  'videohub-routing': 'Videohub Routing',
  greengo: 'GreenGo Intercom (.gg5)',
  other: 'Sonstige',
}

const CONFIG_KIND_ICON: Record<DeviceConfigKind, string> = {
  'atem-mv': '🟦',
  'atem-audio': '🟪',
  'videohub-labels': '🟣',
  'videohub-routing': '🟣',
  greengo: '🟢',
  other: '📄',
}

const guessKindFromFileName = (fileName: string): DeviceConfigKind => {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.gg5')) return 'greengo'
  if (lower.includes('multiview') || lower.includes('mvw') || lower.includes('mv-layout'))
    return 'atem-mv'
  if (lower.includes('audio') || lower.includes('fairlight')) return 'atem-audio'
  if (lower.includes('label')) return 'videohub-labels'
  if (lower.includes('routing') || lower.includes('matrix')) return 'videohub-routing'
  if (lower.endsWith('.xml') && lower.includes('atem')) return 'atem-mv'
  return 'other'
}

const downloadConfig = (entry: DeviceConfigEntry) => {
  downloadBlob(entry.fileName || `${entry.name}.txt`, entry.content, entry.mimeType)
}

const CONFIG_PICKER_ACCEPT =
  '.xml,.json,.gg5,.txt,.csv,application/xml,application/json,text/plain'

const ConfigsTab = () => {
  const t = useTranslation()
  const library = useUiStore((s) => s.deviceConfigLibrary)
  const addDeviceConfig = useUiStore((s) => s.addDeviceConfig)
  const updateDeviceConfig = useUiStore((s) => s.updateDeviceConfig)
  const removeDeviceConfig = useUiStore((s) => s.removeDeviceConfig)
  const replaceDeviceConfigLibrary = useUiStore((s) => s.replaceDeviceConfigLibrary)
  const equipment = useProjectStore((s) => s.project.equipment)
  const [filter, setFilter] = useState<DeviceConfigKind | 'all'>('all')

  const grouped = useMemo(() => {
    const filtered = filter === 'all' ? library : library.filter((e) => e.kind === filter)
    const byKind = new Map<DeviceConfigKind, DeviceConfigEntry[]>()
    for (const entry of filtered) {
      const list = byKind.get(entry.kind) ?? []
      list.push(entry)
      byKind.set(entry.kind, list)
    }
    return byKind
  }, [library, filter])

  const handleUpload = async () => {
    const file = await pickTextFile(CONFIG_PICKER_ACCEPT)
    if (!file) return
    const kind = guessKindFromFileName(file.name)
    addDeviceConfig({
      kind,
      name: file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      mimeType: file.mimeType,
      content: file.content,
    })
  }

  const handleExportBundle = () => {
    downloadBlob(
      `cable-planner-konfigurationen-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 1, library }, null, 2),
      'application/json',
    )
  }

  const handleImportBundle = async () => {
    const file = await pickTextFile(CONFIG_PICKER_ACCEPT)
    if (!file) return
    try {
      const parsed = JSON.parse(file.content) as { version?: number; library?: DeviceConfigEntry[] }
      if (!parsed.library || !Array.isArray(parsed.library)) {
        window.alert('Datei enthält kein gültiges Konfigurations-Bundle.')
        return
      }
      const replace = window.confirm(
        `${parsed.library.length} Konfigurationen aus der Datei laden?\n\nOK = bestehende Bibliothek ersetzen\nAbbrechen = neue Konfigurationen anhängen`,
      )
      if (replace) {
        replaceDeviceConfigLibrary(parsed.library)
      } else {
        // Append, but assign fresh ids so we never collide with existing ones.
        for (const entry of parsed.library) {
          const { id: _drop, savedAt: _drop2, ...rest } = entry
          void _drop
          void _drop2
          addDeviceConfig(rest)
        }
      }
    } catch (err) {
      window.alert(`Fehler beim Import: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        {t(
          'settings.configs.intro',
          'Globale Bibliothek von Geräte-Konfigurationen (ATEM, Videohub, GreenGo). Lade Dateien hier hoch, lade sie als Datei wieder herunter, oder weise einer canvas-Gerät die passende Config zu (im Properties-Panel des Geräts).',
        )}
      </p>

      <SettingsCard
        title={t('settings.configs.upload.title', 'Neue Konfiguration hochladen')}
        description={t(
          'settings.configs.upload.desc',
          'XML / JSON / TXT / .gg5 — der Typ wird aus dem Dateinamen geraten und kann unten geändert werden.',
        )}
      >
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleUpload()}
            className="rounded bg-sky-700 px-3 py-1 text-xs text-white hover:bg-sky-600"
          >
            📤 Datei wählen…
          </button>
          <button
            type="button"
            onClick={handleExportBundle}
            disabled={library.length === 0}
            className="rounded bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            💾 Bibliothek als JSON exportieren
          </button>
          <button
            type="button"
            onClick={() => void handleImportBundle()}
            className="rounded bg-amber-700 px-3 py-1 text-xs text-white hover:bg-amber-600"
          >
            ⤵ JSON-Bibliothek importieren…
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.configs.library.title', 'Konfigurations-Bibliothek')}
        description={
          library.length === 0
            ? t(
                'settings.configs.library.empty',
                'Noch keine Konfigurationen hochgeladen.',
              )
            : `${library.length} Einträge`
        }
      >
        <div className="mb-2 flex flex-wrap gap-1">
          {(['all', 'atem-mv', 'atem-audio', 'videohub-labels', 'videohub-routing', 'greengo', 'other'] as const).map(
            (k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded px-2 py-0.5 text-[11px] ${
                  filter === k
                    ? 'bg-sky-700 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {k === 'all'
                  ? `Alle (${library.length})`
                  : `${CONFIG_KIND_ICON[k]} ${CONFIG_KIND_LABEL[k]} (${
                      library.filter((e) => e.kind === k).length
                    })`}
              </button>
            ),
          )}
        </div>

        {library.length === 0 ? (
          <div className="rounded border border-dashed border-slate-700 p-4 text-center text-[11px] text-slate-500">
            Lade die erste Konfigurationsdatei hoch — sie wird hier gelistet und kann anschließend
            einem Gerät auf dem Canvas zugeordnet werden.
          </div>
        ) : grouped.size === 0 ? (
          <div className="rounded border border-dashed border-slate-700 p-4 text-center text-[11px] text-slate-500">
            Kein Eintrag passt zum gewählten Filter.
          </div>
        ) : (
          <ul className="space-y-2">
            {Array.from(grouped.entries()).map(([kind, entries]) => (
              <li key={kind}>
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                  {CONFIG_KIND_ICON[kind]} {CONFIG_KIND_LABEL[kind]}
                </div>
                <ul className="space-y-1">
                  {entries.map((entry) => {
                    const linked = entry.equipmentId
                      ? equipment.find((eq) => eq.id === entry.equipmentId)
                      : undefined
                    return (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs"
                      >
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => updateDeviceConfig(entry.id, { name: e.target.value })}
                          className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-slate-100"
                        />
                        <select
                          value={entry.kind}
                          onChange={(e) =>
                            updateDeviceConfig(entry.id, {
                              kind: e.target.value as DeviceConfigKind,
                            })
                          }
                          className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-200"
                        >
                          {(Object.keys(CONFIG_KIND_LABEL) as DeviceConfigKind[]).map((k) => (
                            <option key={k} value={k}>
                              {CONFIG_KIND_LABEL[k]}
                            </option>
                          ))}
                        </select>
                        <select
                          value={entry.equipmentId ?? ''}
                          onChange={(e) =>
                            updateDeviceConfig(entry.id, {
                              equipmentId: e.target.value || undefined,
                            })
                          }
                          className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-200"
                          title="Gerät auf dem Canvas, dem diese Konfiguration zugeordnet ist"
                        >
                          <option value="">(unzugeordnet)</option>
                          {equipment.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name}
                            </option>
                          ))}
                        </select>
                        <span
                          className="hidden text-[10px] text-slate-500 sm:inline"
                          title={`Originaldatei: ${entry.fileName}\nHochgeladen: ${new Date(
                            entry.savedAt,
                          ).toLocaleString()}\n${entry.content.length.toLocaleString()} Zeichen`}
                        >
                          {entry.fileName}{linked ? ' · ✓' : ''}
                        </span>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => downloadConfig(entry)}
                            className="rounded bg-slate-700 px-2 py-0.5 text-[11px] text-slate-100 hover:bg-slate-600"
                            title="Originaldatei herunterladen"
                          >
                            ⬇
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Konfiguration "${entry.name}" löschen? Die Datei selbst auf der Festplatte bleibt unverändert.`,
                                )
                              ) {
                                removeDeviceConfig(entry.id)
                              }
                            }}
                            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-red-700 hover:text-white"
                            title="Aus Bibliothek entfernen"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
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
    downloadBlob(
      `cable-planner-localStorage-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(dump, null, 2),
      'application/json',
    )
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
          {/* v7.6.0 — NetBox import removed; cache entry will not be populated. */}
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
