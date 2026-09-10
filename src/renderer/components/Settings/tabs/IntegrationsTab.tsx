import { useEffect, useMemo, useState } from 'react'
import { X, Eye, EyeOff, Check} from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { PanelHint } from '../../shared/PanelHint'
import { cablePlannerApi } from '../../../lib/bridge'
import { useSettingsStore, useModule } from '../../../store/settingsStore'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useTranslation, format } from '../../../lib/i18n'
import { confirmDialog } from '../../../lib/confirmDialog'
import { promptDialog } from '../../../lib/promptDialog'
import {
  getApiKey,
  setApiKey,
  getSelectedAiProvider,
  setSelectedAiProvider,
  listAiProviders,
  type AiProvider,
} from '../../../lib/aiSuggestions'
import {
  deleteGreenGoPreset,
  loadGreenGoPresets,
  saveGreenGoPreset,
} from '../../../lib/greengoSync'
import { greengoFromPlan } from '../../../lib/intercomPlan'
import { SettingsCard } from '../SettingsCard'

/**
 * #307 — Integrations-Tab aus SettingsDialog ausgelagert. Rentman-API-
 * Token, verknuepftes Projekt, AI-Provider-Card und GreenGo-Presets-
 * Card.
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
      title={t('settings.integrations.ai', 'AI provider (AI port suggestions)')}
      description={t(
        'settings.integrations.aiDesc',
        'Active provider for the AI buttons in the device wizard and the Rentman library. Each provider has its own API key. All keys are stored only locally in the browser localStorage.',
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
                  : 'border-cp-border bg-cp-surface-3/40'
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
                  <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-cp-xs text-emerald-300">
                    <Icon icon={Check} size="xs" className="mr-1 inline" />
                    {t('settings.integrations.keyStored', 'Key')}
                  </span>
                )}
                {isSelected && (
                  <span className="ml-auto rounded bg-sky-900/40 px-1.5 py-0.5 text-cp-xs text-sky-300">
                    {t('settings.integrations.ai.active', 'Active')}
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
                  className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-1.5 font-mono text-cp-xs"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setRevealed((r) => ({ ...r, [id]: !r[id] }))}
                  className="rounded bg-cp-surface-2 px-2 py-1 text-cp-text-muted hover:bg-cp-surface-4"
                  title={revealed[id] ? t('common.hide', 'Hide') : t('common.show', 'Show')}
                  aria-label={revealed[id] ? t('common.hide', 'Hide') : t('common.show', 'Show')}
                >
                  <Icon icon={revealed[id] ? Eye : EyeOff} size="sm" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(id)}
                  className="rounded bg-sky-600 px-3 py-1 text-cp-xs hover:bg-sky-500"
                >
                  {t('common.save', 'Save')}
                </button>
                {hasKey && (
                  <button
                    type="button"
                    onClick={() => handleClear(id)}
                    className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-muted hover:bg-red-700 hover:text-white"
                    title={t('settings.integrations.gemini.deleteTitle', 'Delete key')}
                  >
                    <Icon icon={X} size="sm" />
                  </button>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between text-cp-xs text-cp-text-muted">
                <span>
                  Model: <span className="font-mono">{config.defaultModel}</span>
                </span>
                <a
                  href={config.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-cp-text-secondary"
                >
                  {t('settings.integrations.ai.createKey', 'Create key')} ↗
                </a>
              </div>
              {saved[id] && (
                <div className="mt-1 text-cp-xs text-emerald-300">
                  <Icon icon={Check} size="xs" className="mr-1 inline" />
                  {t('settings.integrations.ai.saved', 'saved')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </SettingsCard>
  )
}

/**
 * Global library of GreenGo Intercom presets. Stored in localStorage —
 * survives across projects, separate from the per-project intercom slot
 * (`project.intercom`, E-2). Lets the user keep a "house template" config and
 * apply it to new projects with one click (issue #56).
 *
 * Die Bibliothek fuehrt weiterhin `GreenGoConfig` und nicht den Slot: ein
 * Preset ist eine Green-GO-Vorlage, und ein schon gespeichertes darf durch den
 * Umbau nicht unlesbar werden. Beim Anwenden geht es ueber
 * `updateGreenGoConfig` und damit durch dieselbe Uebersetzung wie alles
 * andere.
 */
const GreenGoPresetsCard = () => {
  const t = useTranslation()
  // Wie im Export-Dialog: einmal je Slot-Aenderung projizieren, nicht je
  // Render (E-2).
  const slot = useProjectStore((s) => s.project.intercom)
  const greengoConfig = useMemo(() => (slot ? greengoFromPlan(slot) : undefined), [slot])
  const updateGreenGoConfig = useProjectStore((s) => s.updateGreenGoConfig)
  const [presets, setPresets] = useState(() => loadGreenGoPresets())
  const refreshPresets = () => setPresets(loadGreenGoPresets())
  const usableConfig = greengoConfig && greengoConfig.users.length > 0

  return (
    <SettingsCard
      title={t('settings.greengo.title', 'GreenGo intercom presets')}
      description={t(
        'settings.greengo.desc',
        'Global library of reusable intercom configurations. Save the current project configuration as a named preset and load it later into any new project — beltpack names, groups and routing included.',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!usableConfig}
          onClick={async () => {
            if (!greengoConfig) return
            const name = await promptDialog(
              t('settings.greengo.savePromptTitle', 'Preset name:'),
              greengoConfig.systemName || 'Intercom-Setup',
            )
            if (!name) return
            saveGreenGoPreset(name, greengoConfig)
            refreshPresets()
          }}
          className="rounded bg-emerald-700 px-3 py-1 text-cp-xs text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          title={
            usableConfig
              ? undefined
              : t('settings.greengo.saveDisabled', 'Current project has no GreenGo configuration yet')
          }
        >
          {t('settings.greengo.save', 'Save current configuration as preset')}
        </button>
      </div>
      {presets.length === 0 ? (
        <div className="mt-2 text-cp-xs text-cp-text-muted">
          {t('settings.greengo.empty', 'No presets saved yet.')}
        </div>
      ) : (
        <ul className="mt-3 space-y-1">
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-emerald-900/40 bg-emerald-950/30 px-2 py-1 text-cp-xs"
            >
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium text-emerald-100">{p.name}</span>
                <span className="ml-2 text-cp-xs text-emerald-400/60">
                  {p.config.users.length} {t('settings.greengo.usersWord', 'users')} · {p.config.groups.length} {t('settings.greengo.groupsWord', 'groups')} ·{' '}
                  {new Date(p.savedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirmDialog(
                      t('settings.greengo.applyTitle', 'Apply preset?'),
                      {
                        body: t(
                          'settings.greengo.applyBody',
                          'The current GreenGo configuration in the project will be replaced by the preset. Equipment assignments from the preset that do not exist in the current project are ignored.',
                        ),
                        okLabel: t('settings.greengo.applyConfirm', 'Apply'),
                      },
                    )
                    if (!ok) return
                    updateGreenGoConfig(p.config)
                  }}
                  className="rounded bg-emerald-700 px-2 py-0.5 text-cp-xs text-white hover:bg-emerald-600"
                >
                  {t('settings.greengo.apply', 'Load')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await confirmDialog(
                      t('settings.greengo.deleteTitle', 'Delete preset?'),
                      {
                        body: format(
                          t('settings.greengo.deleteBody', 'Really delete preset "{name}"?'),
                          { name: p.name },
                        ),
                        okLabel: t('settings.greengo.deleteConfirm', 'Delete'),
                        destructive: true,
                      },
                    )
                    if (!ok) return
                    deleteGreenGoPreset(p.id)
                    refreshPresets()
                  }}
                  className="rounded bg-cp-surface-2 px-2 py-0.5 text-cp-xs text-cp-text-secondary hover:bg-red-700 hover:text-white"
                >
                  {t('settings.greengo.delete', 'Delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}

/**
 * B-6 / E-7 — DAS ZIEL FUER DEN DIREKTWEG ZUM TALLY-PI.
 *
 * Die Entscheidung sagt beides, mit Rangfolge: „Die Datei bleibt der
 * Vorgabeweg; der Direktweg kommt als ausdrücklich einzuschaltendes Ziel
 * dazu." Deshalb steht der Schalter VOR der Adresse und ist aus, bis jemand
 * ihn umlegt — auch bei bestehenden Installationen, die schon eine Adresse
 * haetten.
 *
 * WARUM HIER KEIN TOKEN-FELD STEHT. `guide_server.py` prueft an seinen
 * Schreib-Endpunkten nichts — kein `Authorization`, kein eigener Kopf, und
 * seine eigene Bedienseite schreibt ueber dieselben offenen Wege. Ein Feld
 * „Token" behauptete einen Schutz, den es nicht gibt; wer es ausfuellte,
 * hielte den Weg fuer gesichert. Der Schutz des Pi ist ein eigener Punkt und
 * eine Entscheidung ueber seine ganze HTTP-Flaeche, nicht ueber diesen einen
 * Aufruf.
 *
 * Die Adresse gehoert der INSTALLATION, nicht dem Projekt: eine `.avplan`
 * wandert per Mail und geht in den Web-Viewer, und eine LAN-Adresse darin
 * waere die Anlagenkarte eines fremden Hauses in einer herumgereichten Datei.
 */
const TallyPiCard = () => {
  const t = useTranslation()
  const tallyPiUrl = useSettingsStore((s) => s.tallyPiUrl)
  const tallyPiDirekt = useSettingsStore((s) => s.tallyPiDirekt)
  const setTallyPiUrl = useSettingsStore((s) => s.setTallyPiUrl)
  const setTallyPiDirekt = useSettingsStore((s) => s.setTallyPiDirekt)
  const [adresse, setAdresse] = useState(tallyPiUrl)
  const [probe, setProbe] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const pruefen = async () => {
    setLaeuft(true)
    setProbe(null)
    // Geprueft wird durch LESEN, nicht durch Schreiben: ein „Verbindung
    // testen", das etwas hinterlaesst, ist kein Test.
    const antwort = await cablePlannerApi.tally.read(adresse.trim())
    setLaeuft(false)
    setProbe(
      antwort.ok
        ? t('settings.integrations.tallyPi.ok', 'The Pi answers.')
        : (antwort.error ?? t('settings.integrations.tallyPi.fail', 'No answer.')),
    )
  }

  return (
    <SettingsCard
      title={t('settings.integrations.tallyPi.title', 'Tally-Pi (direct path)')}
      description={t(
        'settings.integrations.tallyPi.desc',
        'Sends the tally map straight from the export dialog to the Pi instead of downloading a file for someone to copy by hand. The file stays alongside it — it is the way that works without a network path to the Pi. The Pi keeps its wiring; roles missing from the plan disappear there.',
      )}
    >
      <label className="flex items-center gap-2 text-cp-base">
        <input
          type="checkbox"
          checked={tallyPiDirekt}
          onChange={(e) => setTallyPiDirekt(e.target.checked)}
          className="h-4 w-4 accent-sky-500"
        />
        <span>
          {t('settings.integrations.tallyPi.enable', 'Allow the direct path to the tally-pi')}{' '}
          <span className="text-cp-xs text-cp-text-muted">
            ({tallyPiDirekt ? t('common.on', 'on') : t('common.off', 'off')})
          </span>
        </span>
      </label>

      {tallyPiDirekt && (
        <>
          <label className="mt-3 block text-cp-base">
            <span className="mb-1 block text-cp-text-secondary">
              {t('settings.integrations.tallyPi.url', 'Address of the Pi')}
            </span>
            <input
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              onBlur={() => setTallyPiUrl(adresse.trim())}
              placeholder="http://10.0.0.42:8080"
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
            />
          </label>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={pruefen}
              disabled={laeuft || adresse.trim() === ''}
              className="rounded border border-cp-border px-3 py-1.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-3 disabled:opacity-40"
            >
              {t('settings.integrations.tallyPi.test', 'Check the connection')}
            </button>
            {probe && <span className="text-cp-xs text-cp-text-muted">{probe}</span>}
          </div>
          <PanelHint
            className="mt-2 text-cp-xs text-cp-text-muted"
            text={t(
              'settings.integrations.tallyPi.noToken',
              'The Pi asks for no credential on this path — it checks nothing on its write endpoints. Whoever can reach it can write to it. That is a property of the Pi and not a setting here; use the direct path only on a network you trust that far.',
            )}
          />
        </>
      )}
    </SettingsCard>
  )
}

/**
 * #597 — NetBox-Instanz konfigurieren.
 *
 * Zwei Dinge gehören hierher: die Basis-URL der (selbst gehosteten)
 * Instanz — die lebt in den App-Settings, weil dieselbe Instanz alle
 * Projekte bedient — und das API-Token, das wie der Rentman-Token im
 * OS-Schlüsselbund landet. Anders als bei Rentman holt der Renderer das
 * Token nie zurück: er fragt nur, ob eines hinterlegt ist.
 */
const NetboxCard = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslation()
  const netboxEnabled = useModule('netbox')
  const setModuleEnabled = useSettingsStore((s) => s.setModuleEnabled)
  const netboxUrl = useSettingsStore((s) => s.netboxUrl)
  const setNetboxUrl = useSettingsStore((s) => s.setNetboxUrl)
  const openNetboxImport = useUiStore((s) => s.openNetboxImport)

  const [url, setUrl] = useState(netboxUrl)
  const [token, setToken] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!netboxEnabled) return
    void cablePlannerApi.netbox.hasToken().then(setHasToken)
  }, [netboxEnabled])

  const saveUrl = async () => {
    setBusy(true)
    try {
      // Normalisierung passiert im Main-Prozess (dort liegt die
      // Validierung) — ein getipptes "netbox.firma.de/api/" wird so
      // automatisch zur brauchbaren Basis-URL.
      const result = await cablePlannerApi.netbox.normalizeUrl(url)
      if (!result.ok) {
        setStatus(result.message)
        return
      }
      setUrl(result.url)
      setNetboxUrl(result.url)
      setStatus(t('settings.integrations.netbox.urlSaved', 'URL saved.'))
    } finally {
      setBusy(false)
    }
  }

  const saveToken = async () => {
    setBusy(true)
    try {
      const stored = await cablePlannerApi.netbox.saveToken(token)
      setHasToken(stored)
      setToken('')
      setStatus(
        stored
          ? t('settings.integrations.netbox.tokenSaved', 'Token stored securely in the keychain.')
          : t('settings.integrations.netbox.tokenCleared', 'Token deleted.'),
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const removeToken = async () => {
    setBusy(true)
    try {
      await cablePlannerApi.netbox.deleteToken()
      setHasToken(false)
      setToken('')
      setStatus(t('settings.integrations.netbox.tokenCleared', 'Token deleted.'))
    } finally {
      setBusy(false)
    }
  }

  const testConnection = async () => {
    setBusy(true)
    try {
      const result = await cablePlannerApi.netbox.testConnection(netboxUrl || url)
      setStatus(result.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SettingsCard
        title={t('settings.integrations.netboxToggle.title', 'NetBox integration')}
        description={t(
          'settings.integrations.netboxToggle.desc',
          'When enabled: menu entry and import dialog for your own NetBox instance appear. Sites and racks planned in NetBox can then be pulled in as a cable plan.',
        )}
      >
        <label className="flex items-center gap-2 text-cp-base">
          <input
            type="checkbox"
            checked={netboxEnabled}
            onChange={(e) => setModuleEnabled('netbox', e.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
          <span>
            {t('settings.integrations.netboxToggle.label', 'Enable NetBox integration')}{' '}
            <span className="text-cp-xs text-cp-text-muted">
              ({netboxEnabled ? t('common.on', 'on') : t('common.off', 'off')})
            </span>
          </span>
        </label>
      </SettingsCard>

      {netboxEnabled && (
        <SettingsCard
          title={t('settings.integrations.netbox', 'NetBox API')}
          description={t(
            'settings.integrations.netboxDesc',
            'Base URL of your NetBox instance plus an API token with read access. The token is stored encrypted in the OS keychain (never in the project file) and never leaves the main process.',
          )}
        >
          <label className="block text-cp-base">
            {t('settings.integrations.netbox.url', 'Instance URL')}
            <div className="mt-1 flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-cp-xs"
                placeholder="https://netbox.firma.de"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                disabled={busy || !url.trim()}
                onClick={() => void saveUrl()}
                className="rounded bg-sky-600 px-3 py-1 text-cp-base hover:bg-sky-500 disabled:opacity-50"
              >
                {t('common.save', 'Save')}
              </button>
            </div>
          </label>

          <label className="mt-2 block text-cp-base">
            {t('settings.integrations.netbox.token', 'API token')}
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-cp-xs"
              placeholder={
                hasToken
                  ? t('settings.integrations.netbox.tokenStoredPlaceholder', 'Token stored — paste a new one to replace it')
                  : t('settings.integrations.netbox.tokenPlaceholder', 'Paste API token')
              }
              autoComplete="off"
            />
          </label>

          <div
            className={`mt-2 rounded border p-2 text-cp-xs ${
              hasToken
                ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300'
                : 'border-cp-border bg-cp-surface-3/40 text-cp-text-muted'
            }`}
          >
            <div>
              <span className="font-semibold">
                {t('settings.integrations.netbox.status', 'Status:')}
              </span>{' '}
              {status || t('settings.integrations.netbox.statusIdle', 'Not tested yet.')}
            </div>
            <div className="text-cp-text-faint">
              {t('settings.integrations.netbox.tokenStored', 'Token stored:')}{' '}
              {hasToken ? t('common.yes', 'Yes') : t('common.no', 'No')}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !token}
              onClick={() => void saveToken()}
              className="rounded bg-sky-600 px-3 py-1 text-cp-base hover:bg-sky-500 disabled:opacity-50"
            >
              {t('settings.integrations.netbox.saveToken', 'Save token')}
            </button>
            <button
              type="button"
              disabled={busy || !hasToken || !(netboxUrl || url).trim()}
              onClick={() => void testConnection()}
              className="rounded bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500 disabled:opacity-50"
            >
              {t('settings.integrations.netbox.test', 'Test connection')}
            </button>
            <button
              type="button"
              disabled={busy || !hasToken}
              onClick={() => void removeToken()}
              className="rounded bg-red-600 px-3 py-1 text-cp-base hover:bg-red-500 disabled:opacity-50"
            >
              {t('settings.integrations.netbox.deleteToken', 'Delete token')}
            </button>
            <button
              type="button"
              disabled={!hasToken || !netboxUrl}
              onClick={() => {
                openNetboxImport()
                onClose()
              }}
              className="rounded bg-orange-700 px-3 py-1 text-cp-base font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {t('settings.integrations.netbox.import', 'Import site/rack…')}
            </button>
          </div>

          <div className="mt-2 text-cp-xs text-cp-text-muted">
            {t('settings.integrations.netbox.apiHint', 'API used:')}{' '}
            <code>/api/dcim/…</code>{' '}
            {t(
              'settings.integrations.netbox.apiHint2',
              '— read only. The endpoint reference for your instance lives at /api/schema/swagger-ui/.',
            )}
          </div>
        </SettingsCard>
      )}
    </>
  )
}

export const IntegrationsTab = ({ onClose }: { onClose: () => void }) => {
  const [token, setToken] = useState('')
  const hasToken = useSettingsStore((s) => s.hasToken)
  const tokenStatus = useSettingsStore((s) => s.tokenStatus)
  const setHasToken = useSettingsStore((s) => s.setHasToken)
  const setTokenStatus = useSettingsStore((s) => s.setTokenStatus)
  const metadata = useProjectStore((s) => s.project.metadata)
  const openRentmanImport = useUiStore((s) => s.openRentmanImport)
  // Modulares UI — Rentman ist jetzt ein Modul (settingsStore).
  const rentmanEnabled = useModule('rentman')
  const setModuleEnabled = useSettingsStore((s) => s.setModuleEnabled)
  const [busy, setBusy] = useState(false)
  const t = useTranslation()

  useEffect(() => {
    cablePlannerApi.credentials.getToken().then((stored) => {
      setHasToken(Boolean(stored))
      setToken(stored ?? '')
      setTokenStatus(
        stored
          ? t('settings.integrations.rentman.statusLoaded', 'Token loaded from secure storage.')
          : t('settings.integrations.rentman.statusNone', 'No token configured'),
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
        t('settings.integrations.rentman.statusSaved', 'Token saved securely.'),
      )
    } catch (error) {
      setTokenStatus(error instanceof Error ? error.message : t('settings.integrations.rentman.saveFailed', 'Could not save token'))
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
      setTokenStatus(t('settings.integrations.rentman.statusDeleted', 'Token deleted.'))
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
        title={t('settings.integrations.rentmanToggle.title', 'Rentman integration')}
        description={t(
          'settings.integrations.rentmanToggle.desc',
          'When active, the Library tab, menu entries and status badges for Rentman appear. When off, Cable Planner only shows local devices/cables — all Rentman features are hidden.',
        )}
      >
        <label className="flex items-center gap-2 text-cp-base">
          <input
            type="checkbox"
            checked={rentmanEnabled}
            onChange={(e) => setModuleEnabled('rentman', e.target.checked)}
            className="h-4 w-4 accent-sky-500"
          />
          <span>
            {t('settings.integrations.rentmanToggle.label', 'Enable Rentman integration')}{' '}
            <span className="text-cp-xs text-cp-text-muted">
              ({rentmanEnabled ? t('common.on', 'on') : t('common.off', 'off')})
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
          'Bearer token from your Rentman account. Encrypted via the OS keychain (never in the project file).',
        )}
      >
        <label className="block text-cp-base">
          {t('settings.integrations.rentman.token', 'API token')}
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2 font-mono text-cp-xs"
            placeholder={t(
              'settings.integrations.rentman.tokenPlaceholder',
              'Paste bearer token',
            )}
            autoComplete="off"
          />
        </label>
        <div
          className={`mt-2 rounded border p-2 text-cp-xs ${
            hasToken
              ? 'border-emerald-700/50 bg-emerald-900/20 text-emerald-300'
              : 'border-cp-border bg-cp-surface-3/40 text-cp-text-muted'
          }`}
        >
          <div>
            <span className="font-semibold">
              {t('settings.integrations.rentman.status', 'Status:')}
            </span>{' '}
            {tokenStatus}
          </div>
          <div className="text-cp-text-faint">
            {t('settings.integrations.rentman.tokenStored', 'Token stored:')}{' '}
            {hasToken ? t('common.yes', 'Yes') : t('common.no', 'No')}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !token}
            onClick={saveToken}
            className="rounded bg-sky-600 px-3 py-1 text-cp-base hover:bg-sky-500 disabled:opacity-50"
          >
            {t('settings.integrations.rentman.save', 'Save token')}
          </button>
          <button
            type="button"
            disabled={busy || !hasToken}
            onClick={testToken}
            className="rounded bg-emerald-600 px-3 py-1 text-cp-base hover:bg-emerald-500 disabled:opacity-50"
          >
            {t('settings.integrations.rentman.test', 'Test connection')}
          </button>
          <button
            type="button"
            disabled={busy || !hasToken}
            onClick={removeToken}
            className="rounded bg-red-600 px-3 py-1 text-cp-base hover:bg-red-500 disabled:opacity-50"
          >
            {t('settings.integrations.rentman.delete', 'Delete token')}
          </button>
        </div>
        <div className="mt-2 text-cp-xs text-cp-text-muted">
          {t('settings.integrations.rentman.endpoint', 'Endpoint:')}{' '}
          <code>https://api.rentman.net</code>
        </div>
      </SettingsCard>

      <SettingsCard
        title={t('settings.integrations.linkedRentman', 'Linked Rentman project')}
      >
        {metadata.rentmanProjectId ? (
          <div className="space-y-2">
            <div className="text-cp-xs text-cp-text-muted">
              {t('settings.integrations.linkedRentman.current', 'Currently linked to ')}
              <span className="text-orange-300">
                {metadata.rentmanProjectName ?? `Projekt #${metadata.rentmanProjectId}`}
              </span>
              <span className="ml-2 text-cp-text-faint">(ID {metadata.rentmanProjectId})</span>
            </div>
            <button
              type="button"
              disabled={!hasToken}
              onClick={() => {
                openRentmanImport()
                onClose()
              }}
              className="rounded bg-orange-700 px-3 py-1 text-cp-base font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {t(
                'settings.integrations.linkedRentman.choose',
                'Choose another Rentman project…',
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-cp-xs text-cp-text-faint">
              {t(
                'settings.integrations.linkedRentman.none',
                'No Rentman project linked to this Cable Planner project yet.',
              )}
            </div>
            <button
              type="button"
              disabled={!hasToken}
              onClick={() => {
                openRentmanImport()
                onClose()
              }}
              className="rounded bg-orange-700 px-3 py-1 text-cp-base font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              title={
                hasToken
                  ? t('settings.integrations.linkedRentman.titleSelect', 'Pick Rentman project')
                  : t('settings.integrations.linkedRentman.titleNeedToken', 'Save token first')
              }
            >
              {t(
                'settings.integrations.linkedRentman.link',
                'Link to a Rentman project…',
              )}
            </button>
          </div>
        )}
      </SettingsCard>
      </>
      )}

      {/* #597 — NetBox-Instanz (Toggle + URL + Token). */}
      <NetboxCard onClose={onClose} />

      {/* B-6 / E-7 — Ziel fuer den Direktweg zum Tally-Pi. */}
      <TallyPiCard />

      {/* v7.9.86 / #197 — Multi-AI-Provider Card (Gemini / Claude / OpenAI). */}
      <AiProvidersCard />

      <GreenGoPresetsCard />
    </div>
  )
}
