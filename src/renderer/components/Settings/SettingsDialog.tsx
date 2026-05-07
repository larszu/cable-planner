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

const TAB_TITLES: Record<SettingsSection, { label: string; icon: string; title: string }> = {
  project: { label: 'Projekt', icon: '📋', title: 'Projekt-Einstellungen' },
  appearance: { label: 'Darstellung', icon: '🎨', title: 'Darstellung' },
  editing: { label: 'Bearbeiten', icon: '✏️', title: 'Bearbeiten' },
  integrations: { label: 'Integrationen', icon: '🔌', title: 'Integrationen' },
  sync: { label: 'Netzwerk-Sync', icon: '🔄', title: 'Netzwerk-Sync' },
  advanced: { label: 'Erweitert', icon: '⚙', title: 'Erweitert' },
}

export const SettingsDialog = ({ open, onClose }: SettingsDialogProps) => {
  const [section, setSection] = useState<SettingsSection>('project')
  const drag = useDraggablePosition('cable-planner:modal-pos:settings', open)

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
      <span className="text-base">{TAB_TITLES[id].icon}</span>
      <span>{TAB_TITLES[id].label}</span>
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
            Einstellungen
          </h3>
          {(Object.keys(TAB_TITLES) as SettingsSection[]).map((id) => navItem(id))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header
            {...drag.headerProps}
            className="flex items-center justify-between border-b border-slate-800 px-4 py-2 select-none"
          >
            <h2 className="text-base font-semibold">{TAB_TITLES[section].title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              Schließen
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
        Projekt-Metadaten — werden mit der Cable-Planner-Datei gespeichert.
      </p>
      <label className="block text-sm">
        Projektname
        <input
          type="text"
          value={draftMeta.name}
          onChange={(e) => setDraftMeta({ ...draftMeta, name: e.target.value })}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          placeholder="Projektname"
        />
      </label>
      <label className="block text-sm">
        Beschreibung
        <textarea
          value={draftMeta.description ?? ''}
          onChange={(e) => setDraftMeta({ ...draftMeta, description: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          placeholder="Optionale Projektbeschreibung"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          Auftraggeber (Kunde)
          <input
            type="text"
            value={draftMeta.client ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, client: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder="Endkunde"
          />
        </label>
        <label className="block text-sm">
          Auftragnehmer
          <input
            type="text"
            value={draftMeta.contractor ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, contractor: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder="Ausführende Firma"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm">
          Autor
          <input
            type="text"
            value={draftMeta.author ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, author: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder="Dein Name"
          />
        </label>
        <label className="block text-sm">
          Projekt-Nr.
          <input
            type="text"
            value={draftMeta.projectNumber ?? ''}
            onChange={(e) => setDraftMeta({ ...draftMeta, projectNumber: e.target.value })}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            placeholder="z. B. 2026-042"
          />
        </label>
      </div>

      <SettingsCard
        title="Bauplan-Signatur (Logos)"
        description="Logos werden als Daten-URI in der Projektdatei gespeichert (PDF-Export & Canvas-Signatur)."
      >
        <div className="grid grid-cols-2 gap-3">
          {(['companyLogo', 'clientLogo'] as const).map((field) => {
            const label = field === 'companyLogo' ? 'Auftragnehmer' : 'Kunde'
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
                    Wählen…
                  </button>
                  {current && (
                    <button
                      type="button"
                      onClick={() => setDraftMeta((prev) => ({ ...prev, [field]: undefined }))}
                      title="Logo entfernen"
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

      <SettingsCard title="Verknüpftes Rentman-Projekt">
        {metadata.rentmanProjectId ? (
          <div className="text-xs text-slate-400">
            <span className="text-orange-300">
              {metadata.rentmanProjectName ?? `Projekt #${metadata.rentmanProjectId}`}
            </span>
            <span className="ml-2 text-slate-500">(ID: {metadata.rentmanProjectId})</span>
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            Kein Rentman-Projekt verknüpft. Verknüpfung im Tab „Integrationen“ herstellen.
          </div>
        )}
      </SettingsCard>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => setDraftMeta(metadata)}
          className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
        >
          Zurücksetzen
        </button>
        <button
          type="button"
          onClick={persistMeta}
          className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
        >
          Speichern
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
  const setDefaultArrow = useUiStore((s) => s.setDefaultArrow)

  return (
    <div className="space-y-3">
      <SettingsCard
        title="Theme"
        description="Hintergrundfarbe des Canvas. Auf Dunkel optimiert; hell ist für PDF-Export oder helles Umgebungslicht."
      >
        <div className="flex gap-1">
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCanvasTheme(t)}
              className={`flex-1 rounded px-3 py-1 text-xs ${
                canvasTheme === t
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t === 'dark' ? '🌙 Dunkel' : '☀ Hell'}
            </button>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Port-Farben"
        description="Steuert, wie Anschluss-Punkte auf Geräten eingefärbt sind."
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
            title="Cyan = Eingang, Grün = Ausgang, Lila = bidirektional"
          >
            Nach Richtung (Standard)
          </button>
          <button
            type="button"
            onClick={() => setColorPortsByType(true)}
            className={`flex-1 rounded px-3 py-1 text-xs ${
              colorPortsByType
                ? 'bg-sky-700 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title="SDI=amber, HDMI=violett, Ethernet=grün, Glasfaser=gelb …"
          >
            Nach Steckertyp
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Kabelfarbe"
        description="Manuell = pro Kabel im Properties-Panel; nach Länge = Längen-basierte Farbcodierung."
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
            Manuell
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
            Nach Länge
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Pfeile auf Kabeln"
        description="Standard für neu gezeichnete Kabel. Per Kabel im Properties-Panel überschreibbar."
      >
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={defaultArrow}
            onChange={(e) => setDefaultArrow(e.target.checked)}
          />
          Pfeil am Ziel-Ende anzeigen (Signalflussrichtung)
        </label>
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

  return (
    <div className="space-y-3">
      <SettingsCard
        title="Standard-Kabelführung"
        description="Welche Form neue Kabel auf dem Canvas haben sollen. Per Kabel überschreibbar."
      >
        <RoutingToggle value={defaultRouting} onChange={setDefaultRouting} />
        <button
          type="button"
          disabled={cables.length === 0}
          onClick={async () => {
            if (
              !(await confirmDialog(
                `Routing aller ${cables.length} bestehenden Kabel auf "${defaultRouting}" setzen?`,
                { okLabel: 'Anwenden' },
              ))
            )
              return
            cables.forEach((c) => {
              if (c.routing !== defaultRouting) updateCable(c.id, { routing: defaultRouting })
            })
          }}
          className="mt-2 w-full rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 disabled:opacity-40"
        >
          Auf alle bestehenden Kabel anwenden ({cables.length})
        </button>
      </SettingsCard>

      <SettingsCard title="Raster (Grid)" description="Snap-to-Grid und Rastergröße in Pixeln.">
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={snapToGrid}
            onChange={(e) => setSnapToGrid(e.target.checked)}
          />
          Geräte am Raster einrasten
        </label>
        <label className="mt-2 block text-sm text-slate-300">
          Rastergröße (Pixel)
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

  useEffect(() => {
    cablePlannerApi.credentials.getToken().then((stored) => {
      setHasToken(Boolean(stored))
      setToken(stored ?? '')
      setTokenStatus(stored ? 'Token aus sicherem Speicher geladen.' : 'Kein Token konfiguriert')
    })
  }, [setHasToken, setTokenStatus])

  const saveToken = async () => {
    setBusy(true)
    try {
      await cablePlannerApi.credentials.saveToken(token)
      setHasToken(true)
      setTokenStatus('Token sicher gespeichert.')
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
      setTokenStatus('Token gelöscht.')
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
        title="Rentman API"
        description="Bearer-Token aus deinem Rentman-Account. Wird mit dem Betriebssystem-Schlüsselbund verschlüsselt gespeichert (nie im Projektfile)."
      >
        <label className="block text-sm">
          API-Token
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
            placeholder="Bearer-Token einfügen"
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
            <span className="font-semibold">Status:</span> {tokenStatus}
          </div>
          <div className="text-slate-500">Token gespeichert: {hasToken ? 'Ja' : 'Nein'}</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !token}
            onClick={saveToken}
            className="rounded bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500 disabled:opacity-50"
          >
            Token speichern
          </button>
          <button
            type="button"
            disabled={busy || !hasToken}
            onClick={testToken}
            className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500 disabled:opacity-50"
          >
            Verbindung testen
          </button>
          <button
            type="button"
            disabled={busy || !hasToken}
            onClick={removeToken}
            className="rounded bg-red-600 px-3 py-1 text-sm hover:bg-red-500 disabled:opacity-50"
          >
            Token löschen
          </button>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Endpunkt: <code>https://api.rentman.net</code>
        </div>
      </SettingsCard>

      <SettingsCard title="Verknüpftes Rentman-Projekt">
        {metadata.rentmanProjectId ? (
          <div className="space-y-2">
            <div className="text-xs text-slate-400">
              Aktuell verknüpft mit{' '}
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
              Anderes Rentman-Projekt wählen…
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-slate-500">
              Noch kein Rentman-Projekt mit diesem Cable-Planner-Projekt verknüpft.
            </div>
            <button
              type="button"
              disabled={!hasToken}
              onClick={() => {
                openRentmanImport()
                onClose()
              }}
              className="rounded bg-orange-700 px-3 py-1 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              title={hasToken ? 'Rentman-Projekt auswählen' : 'Erst Token speichern'}
            >
              Mit Rentman-Projekt verknüpfen…
            </button>
          </div>
        )}
      </SettingsCard>

      <SettingsCard
        title="Gemini API (KI-Port-Vorschläge)"
        description="API-Key von aistudio.google.com. Wird im Browser-localStorage gespeichert. Nötig für die '✨ Gemini'-Buttons im Geräte-Wizard und in der Bibliothek."
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
            Key speichern
          </button>
          {geminiSaved && <span className="text-xs text-emerald-300">✓ gespeichert</span>}
          {geminiKey && (
            <button
              type="button"
              onClick={() => {
                setGeminiApiKey('')
                setGeminiKeyState('')
              }}
              className="ml-auto rounded bg-slate-800 px-3 py-1 text-xs text-slate-400 hover:bg-red-700 hover:text-white"
            >
              Löschen
            </button>
          )}
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          Key bei{' '}
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

  useEffect(() => {
    setDraftSyncPath(sharedSyncPath)
    setDraftSyncUser(sharedSyncUser)
  }, [sharedSyncPath, sharedSyncUser])

  return (
    <div className="space-y-3 text-sm">
      {!hasDesktopBridge && (
        <div className="rounded border border-amber-700/50 bg-amber-900/20 p-2 text-xs text-amber-300">
          Netzwerk-Sync ist nur in der Desktop-App verfügbar.
        </div>
      )}
      <p className="text-xs text-slate-400">
        Gemeinsames Verzeichnis (FTP-Laufwerk, Netzwerkpfad oder lokaler Ordner), in dem Projekt,
        Bibliothek und Presets als JSON-Dateien geteilt werden.
      </p>
      <label className="block text-sm text-slate-300">
        Sync-Verzeichnis
        <input
          type="text"
          value={draftSyncPath}
          onChange={(e) => setDraftSyncPath(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-xs"
          placeholder="Z:\Projekte\CablePlanner oder \\server\share\cable-planner"
        />
      </label>
      <label className="block text-sm text-slate-300">
        Benutzername (für Lock-Anzeige)
        <input
          type="text"
          value={draftSyncUser}
          onChange={(e) => setDraftSyncUser(e.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
          placeholder="z. B. Max Mustermann"
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
          Zurücksetzen
        </button>
        <button
          type="button"
          onClick={() => {
            setSyncPath(draftSyncPath)
            setSyncUser(draftSyncUser)
          }}
          className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
        >
          Speichern
        </button>
      </div>
      <SettingsCard title="Hinweise">
        <ul className="list-inside list-disc space-y-1 text-xs text-slate-400">
          <li>
            Push schreibt: <code>cable-planner.project.json</code>,{' '}
            <code>.library.json</code>, <code>.presets.json</code>
          </li>
          <li>Pull lädt diese Dateien aus dem Verzeichnis in den aktuellen Stand.</li>
          <li>
            Ein Lock-File (<code>.cable-planner-sync.lock</code>) verhindert gleichzeitiges
            Überschreiben (2 h TTL).
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

  const allCategories = useMemo(
    () =>
      Array.from(
        new Set([
          ...knownCategories,
          ...customLibrary.map((t) => t.category).filter(Boolean),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [knownCategories, customLibrary],
  )

  const usageCount = (cat: string) =>
    customLibrary.filter((t) => t.category === cat).length

  const handleRename = async (cat: string) => {
    const next = (await promptDialog('Kategorie umbenennen', cat))?.trim()
    if (!next || next === cat) return
    renameCustomCategory(cat, next)
  }

  const handleAdd = async () => {
    const next = (await promptDialog('Neue Kategorie'))?.trim()
    if (next) addKnownCategories([next])
  }

  const clearCache = async (key: string, label: string) => {
    if (!(await confirmDialog(`${label} leeren?`, { destructive: true, okLabel: 'Leeren' })))
      return
    try {
      localStorage.removeItem(key)
      window.alert(`${label} geleert. Beim nächsten Start wird neu geladen.`)
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
      !(await confirmDialog('Willkommens-Dialog beim nächsten Start wieder anzeigen?', {
        okLabel: 'Zurücksetzen',
      }))
    )
      return
    localStorage.removeItem('cable-planner:welcomed')
  }

  return (
    <div className="space-y-3">
      <SettingsCard
        title="Autosave"
        description="Wie oft das aktuelle Projekt automatisch in localStorage gespeichert wird. Standard: 400 ms."
      >
        <label className="block text-sm text-slate-300">
          Autosave-Intervall (ms)
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
        title="Kategorienverwaltung"
        description="Bibliothek-Kategorien umbenennen oder neue anlegen. Beim Umbenennen wandern alle zugeordneten Vorlagen mit."
      >
        <div className="max-h-56 overflow-auto rounded border border-slate-800 bg-slate-950/50">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">Kategorie</th>
                <th className="px-2 py-1 text-right">Vorlagen</th>
                <th className="px-2 py-1" />
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
                      Umbenennen
                    </button>
                  </td>
                </tr>
              ))}
              {allCategories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-2 py-3 text-center text-slate-500">
                    Noch keine Kategorien.
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
          + Neue Kategorie
        </button>
      </SettingsCard>

      <SettingsCard
        title="Caches & Lokale Daten"
        description="Cache-Inhalte werden bei Bedarf neu geladen. Daten gehen nicht verloren — nur die Performance-Caches."
      >
        <div className="grid grid-cols-1 gap-1">
          <button
            type="button"
            onClick={() =>
              clearCache('cable-planner:rentmanTemplateCache:v1', 'Rentman-Template-Cache')
            }
            className="rounded bg-slate-700 px-3 py-1 text-xs text-left hover:bg-slate-600"
          >
            Rentman-Template-Cache leeren
          </button>
          <button
            type="button"
            onClick={() => clearCache('cable-planner:netbox:index:v1', 'NetBox-Index-Cache')}
            className="rounded bg-slate-700 px-3 py-1 text-xs text-left hover:bg-slate-600"
          >
            NetBox-Index-Cache leeren
          </button>
          <button
            type="button"
            onClick={() => clearCache('cable-planner:web:recents', 'Web-Suchverlauf')}
            className="rounded bg-slate-700 px-3 py-1 text-xs text-left hover:bg-slate-600"
          >
            Web-Suchverlauf leeren
          </button>
          <button
            type="button"
            onClick={resetWelcome}
            className="rounded bg-slate-700 px-3 py-1 text-xs text-left hover:bg-slate-600"
          >
            Willkommens-Dialog beim nächsten Start zeigen
          </button>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Datenexport"
        description="Lokal gespeicherte Cable-Planner-Daten als JSON exportieren — z. B. zum Übertragen auf eine andere Maschine."
      >
        <button
          type="button"
          onClick={exportAllData}
          className="rounded bg-amber-700 px-3 py-1 text-xs hover:bg-amber-600"
        >
          Alle localStorage-Daten exportieren
        </button>
      </SettingsCard>
    </div>
  )
}
