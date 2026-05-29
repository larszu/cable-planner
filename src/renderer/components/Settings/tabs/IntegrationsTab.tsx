import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Icon } from '../../shared/Icon'
import { cablePlannerApi } from '../../../lib/bridge'
import { useSettingsStore } from '../../../store/settingsStore'
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
                    title={t('settings.integrations.gemini.deleteTitle', 'Key löschen')}
                  >
                    <Icon icon={X} size="sm" />
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

export const IntegrationsTab = ({ onClose }: { onClose: () => void }) => {
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
        title={t('settings.integrations.rentmanToggle.title', 'Rentman-Integration')}
        description={t(
          'settings.integrations.rentmanToggle.desc',
          'Wenn aktiv: Library-Tab, Menü-Einträge und Status-Anzeigen für Rentman erscheinen. Ausgeschaltet zeigt der Cable Planner nur lokale Geräte/Kabel — alle Rentman-Funktionen werden ausgeblendet.',
        )}
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

      {/* v7.9.86 / #197 — Multi-AI-Provider Card (Gemini / Claude / OpenAI). */}
      <AiProvidersCard />

      <GreenGoPresetsCard />
    </div>
  )
}
