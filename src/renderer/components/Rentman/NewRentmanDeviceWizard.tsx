import { useEffect, useMemo, useState } from 'react'
import { Globe, Sparkles } from 'lucide-react'
import { Icon } from '../shared/Icon'
import type { ConnectorType, EquipmentTemplate } from '../../types/equipment'
import { buildTemplateFromHints, suggestPortGroups, type PortGroupHint } from '../../lib/portSuggestions'
import { getGeminiApiKey, setGeminiApiKey, suggestFromAI } from '../../lib/aiSuggestions'
import { suggestFromWeb } from '../../lib/webPortSuggestions'
import { useProjectStore } from '../../store/projectStore'
import { format, useTranslation } from '../../lib/i18n'
import { CategorySelect } from '../shared/CategorySelect'

const connectorOptions: ConnectorType[] = [
  'XLR',
  'BNC',
  'HDMI',
  'Ethernet/RJ45',
  'Fiber',
  'SFP',
  'SFP+',
  'DIN',
  'DisplayPort',
  'USB',
  'IEC 230V',
  'PowerCON',
  'Schuko 230V',
  'C7 Eurostecker',
  'Custom',
]

export interface UnknownCandidate {
  rentmanId: string
  name: string
  category: string
}

interface NewRentmanDeviceWizardProps {
  open: boolean
  items: UnknownCandidate[]
  onSkip: (candidate: UnknownCandidate) => void
  onExclude: (candidate: UnknownCandidate) => void
  onSave: (candidate: UnknownCandidate, template: EquipmentTemplate) => void
  onCancel: () => void
}

const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

type GroupDraft = PortGroupHint & { id: string }

const hintsToDrafts = (hints: PortGroupHint[]): GroupDraft[] =>
  hints.map((h) => ({ ...h, id: randomId() }))

export const NewRentmanDeviceWizard = ({
  open,
  items,
  onSkip,
  onExclude,
  onSave,
  onCancel,
}: NewRentmanDeviceWizardProps) => {
  const t = useTranslation()
  const [index, setIndex] = useState(0)
  const current = items[index]

  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [groups, setGroups] = useState<GroupDraft[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  const [webLoading, setWebLoading] = useState(false)
  const [webInfo, setWebInfo] = useState<string>('')
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')

  useEffect(() => {
    if (!current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Draft aus dem aktuellen Item seeden (keyed sync)
    setName(current.name)
    setCategory(current.category || 'Custom')
    setGroups(hintsToDrafts(suggestPortGroups(current.name, current.category)))
  }, [current])

  const progress = useMemo(() => `${Math.min(index + 1, items.length)} / ${items.length}`, [index, items.length])

  if (!open || !current) return null

  const updateGroup = (id: string, patch: Partial<GroupDraft>) => {
    setGroups((current_) => current_.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }
  const addGroup = (direction: 'in' | 'out') => {
    setGroups((current_) => [
      ...current_,
      { id: randomId(), direction, count: 1, connectorType: 'Custom', label: direction === 'in' ? 'Input' : 'Output' },
    ])
  }
  const removeGroup = (id: string) => setGroups((current_) => current_.filter((g) => g.id !== id))

  const advance = () => {
    if (index + 1 >= items.length) return
    setIndex(index + 1)
  }

  const handleAiSuggest = async () => {
    setAiError('')
    setWebInfo('')
    if (!getGeminiApiKey()) {
      // No key — open the settings panel inline instead of throwing.
      setApiKeyDraft('')
      setAiSettingsOpen(true)
      setAiError(t('rentman.wizard.noGeminiKey', 'Kein Gemini-API-Key hinterlegt. Trage einen ein oder nutze "Web-Suche (frei)".'))
      return
    }
    setAiLoading(true)
    try {
      const hints = await suggestFromAI(name, category)
      if (hints.length === 0) {
        setAiError(t('rentman.wizard.aiNoPorts', 'KI lieferte keine Ports. Namen präzisieren.'))
        return
      }
      setGroups(hintsToDrafts(hints))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('rentman.wizard.aiFailed', 'KI-Anfrage fehlgeschlagen'))
    } finally {
      setAiLoading(false)
    }
  }

  const handleWebSuggest = async () => {
    setAiError('')
    setWebInfo('')
    setWebLoading(true)
    try {
      const { hints, source, snippet } = await suggestFromWeb(name, category)
      if (hints.length === 0) {
        setWebInfo(
          snippet
            ? format(t('rentman.wizard.webNoConnectors', 'Keine Stecker im {source}-Snippet erkannt. Manuell ergänzen oder anderen Namen versuchen.'), { source })
            : t('rentman.wizard.webNoHit', 'Kein Treffer im Web. Geräte-Name präzisieren (Hersteller + Modell).'),
        )
        return
      }
      setGroups(hintsToDrafts(hints))
      setWebInfo(format(t('rentman.wizard.webHints', '{count} Port-Gruppe(n) aus {source} übernommen.'), { count: hints.length, source }))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('rentman.wizard.webFailed', 'Web-Suche fehlgeschlagen'))
    } finally {
      setWebLoading(false)
    }
  }

  const handleOpenAiSettings = () => {
    setApiKeyDraft(getGeminiApiKey())
    setAiSettingsOpen(true)
  }
  const handleSaveAiSettings = () => {
    setGeminiApiKey(apiKeyDraft.trim())
    setAiSettingsOpen(false)
    setAiError('')
  }

  const handleSave = () => {
    const template = buildTemplateFromHints(name, category, groups)
    const cat = template.category?.trim()
    if (cat) addKnownCategories([cat])
    onSave(current, template)
    advance()
  }

  const handleSkip = () => {
    onSkip(current)
    advance()
  }

  const handleExclude = () => {
    onExclude(current)
    advance()
  }

  const isLast = index + 1 >= items.length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded border border-cp-border bg-cp-surface-1 p-4 text-cp-text">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-cp-xl font-semibold">
              {format(t('rentman.wizard.title', 'Neues Rentman-Gerät ({progress})'), { progress })}
            </h3>
            <p className="mt-1 text-cp-xs text-cp-text-muted">
              {t('rentman.wizard.introPre', 'Zum ersten Mal gesehen:')}{' '}
              <span className="text-cp-text-bright">{current.name}</span>
              {t('rentman.wizard.introPost', ' — Ein-/Ausgänge bestätigen, sie werden in deiner Bibliothek gespeichert.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('rentman.wizard.cancelImport', 'Import abbrechen')}
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-cp-base">
          <label className="block">
            {t('rentman.wizard.name', 'Name')}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-2"
            />
          </label>
          <label className="block">
            {t('rentman.wizard.category', 'Kategorie')}
            <div className="mt-1 flex gap-1">
              <CategorySelect
                value={category}
                onChange={setCategory}
                className="w-full rounded border border-cp-border bg-cp-surface-3 p-2"
              />
              <button
                type="button"
                onClick={() => {
                  const cat = category.trim()
                  if (cat) addKnownCategories([cat])
                }}
                title={t('rentman.wizard.saveAsCategoryTitle', 'Als neue Kategorie speichern')}
                className="rounded bg-cp-surface-4 px-2 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('rentman.wizard.addCategory', '+ Neu')}
              </button>
            </div>
          </label>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="text-cp-base font-semibold">{t('rentman.wizard.suggestedPortGroups', 'Vorgeschlagene Port-Gruppen')}</div>
          <div className="flex flex-wrap gap-2 text-cp-xs">
            <button
              type="button"
              onClick={handleWebSuggest}
              disabled={webLoading}
              className="rounded bg-emerald-700 px-2 py-1 hover:bg-emerald-600 disabled:opacity-50"
              title={t('rentman.wizard.webSearchTitle', 'Wikipedia + DuckDuckGo durchsuchen (kein Key nötig)')}
            >
              {webLoading ? t('rentman.wizard.webBusy', 'Suche…') : <span className="inline-flex items-center gap-1"><Icon icon={Globe} size="xs" /> {t('rentman.wizard.webSearch', 'Web-Suche (frei)')}</span>}
            </button>
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={aiLoading}
              className="rounded bg-purple-700 px-2 py-1 hover:bg-purple-600 disabled:opacity-50"
              title={t('rentman.wizard.aiTitle', 'Gemini AI (benötigt API-Key)')}
            >
              {aiLoading ? t('rentman.wizard.aiBusy', 'KI wird gefragt…') : <span className="inline-flex items-center gap-1"><Icon icon={Sparkles} size="xs" /> {t('rentman.wizard.aiButton', 'AI (Gemini)')}</span>}
            </button>
            <button
              type="button"
              onClick={handleOpenAiSettings}
              className="rounded bg-cp-surface-4 px-2 py-1 hover:bg-cp-surface-5"
              title={t('rentman.wizard.aiSettingsTitle', 'Gemini API-Key konfigurieren')}
            >
              {t('rentman.wizard.aiSettings', 'KI-Einstellungen')}
            </button>
            <button
              type="button"
              onClick={() => addGroup('in')}
              className="rounded bg-sky-700 px-2 py-1 hover:bg-sky-600"
            >
              {t('rentman.wizard.addInputGroup', '+ Eingangs-Gruppe')}
            </button>
            <button
              type="button"
              onClick={() => addGroup('out')}
              className="rounded bg-green-700 px-2 py-1 hover:bg-green-600"
            >
              {t('rentman.wizard.addOutputGroup', '+ Ausgangs-Gruppe')}
            </button>
          </div>
        </div>
        {aiError && (
          <div className="mb-2 rounded bg-red-900/50 p-2 text-cp-xs text-red-100">{aiError}</div>
        )}
        {webInfo && !aiError && (
          <div className="mb-2 rounded bg-emerald-900/30 p-2 text-cp-xs text-emerald-100">{webInfo}</div>
        )}

        {aiSettingsOpen && (
          <div className="mb-3 rounded border border-purple-700 bg-purple-950/40 p-3">
            <div className="mb-2 text-cp-xs font-semibold text-purple-200">{t('rentman.wizard.geminiKeyHeading', 'Gemini API-Key')}</div>
            <p className="mb-2 text-[11px] text-cp-text-secondary">
              {t('rentman.wizard.geminiKeyHintPre', 'Kostenlos unter')}{' '}
              <span className="font-mono text-cp-text-bright">aistudio.google.com/apikey</span>{' '}
              {t('rentman.wizard.geminiKeyHintPost', '(15 Anfragen/Min). Wird lokal im Browser-Storage gespeichert.')}
            </p>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder={t('rentman.wizard.aiKeyPlaceholder', 'AIzaSy...')}
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-xs"
              autoFocus
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiSettingsOpen(false)}
                className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('common.cancel', 'Abbrechen')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeminiApiKey('')
                  setApiKeyDraft('')
                  setAiSettingsOpen(false)
                }}
                className="rounded bg-red-700 px-2 py-1 text-cp-xs hover:bg-red-600"
              >
                {t('common.delete', 'Löschen')}
              </button>
              <button
                type="button"
                onClick={handleSaveAiSettings}
                className="rounded bg-emerald-600 px-2 py-1 text-cp-xs hover:bg-emerald-500"
              >
                {t('common.save', 'Speichern')}
              </button>
            </div>
          </div>
        )}

        <div className="mb-3 space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="grid grid-cols-[80px_70px_1fr_1fr_40px] items-center gap-2 rounded border border-cp-border bg-cp-surface-3 p-2 text-cp-xs"
            >
              <select
                aria-label={t('rentman.wizard.directionAria', 'Richtung')}
                value={group.direction}
                onChange={(event) => updateGroup(group.id, { direction: event.target.value as 'in' | 'out' })}
                className="rounded border border-cp-border bg-cp-surface-1 p-1"
              >
                <option value="in">{t('rentman.wizard.directionIn', 'Eingang')}</option>
                <option value="out">{t('rentman.wizard.directionOut', 'Ausgang')}</option>
              </select>
              <input
                aria-label={t('rentman.wizard.countAria', 'Anzahl')}
                type="number"
                min={1}
                value={group.count}
                onChange={(event) => updateGroup(group.id, { count: Number(event.target.value) })}
                className="rounded border border-cp-border bg-cp-surface-1 p-1"
              />
              <select
                aria-label={t('rentman.wizard.connectorTypeAria', 'Steckertyp')}
                value={group.connectorType}
                onChange={(event) => updateGroup(group.id, { connectorType: event.target.value as ConnectorType })}
                className="rounded border border-cp-border bg-cp-surface-1 p-1"
              >
                {connectorOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input
                value={group.label}
                onChange={(event) => updateGroup(group.id, { label: event.target.value })}
                placeholder={t('rentman.wizard.labelPrefixPlaceholder', 'Label-Präfix')}
                className="rounded border border-cp-border bg-cp-surface-1 p-1"
              />
              <button
                type="button"
                onClick={() => removeGroup(group.id)}
                className="rounded bg-red-700 px-2 py-1 hover:bg-red-600"
                title={t('rentman.wizard.removeGroupTitle', 'Gruppe entfernen')}
              >
                ×
              </button>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="text-cp-xs text-cp-text-muted">{t('rentman.wizard.noGroups', 'Keine Port-Gruppen. Oben hinzufügen oder Gerät überspringen.')}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 text-cp-base">
          <button
            type="button"
            onClick={handleExclude}
            className="rounded bg-red-700 px-3 py-1 hover:bg-red-600"
            title={t('rentman.wizard.excludeTitle', 'Dieses Gerät überspringen und NICHT importieren')}
          >
            {t('rentman.wizard.exclude', 'Nicht importieren')}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5"
            title={t('rentman.wizard.skipTitle', 'Importieren ohne Bibliothekseintrag (1 generischer Ein-/Ausgang)')}
          >
            {t('rentman.wizard.skip', 'Überspringen (generisch)')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
          >
            {isLast ? t('rentman.wizard.saveFinish', 'Speichern & Fertig') : t('rentman.wizard.saveNext', 'Speichern & Weiter')}
          </button>
        </div>
      </div>
    </div>
  )
}
