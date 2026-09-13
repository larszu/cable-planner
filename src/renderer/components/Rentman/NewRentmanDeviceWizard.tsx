import { useEffect, useMemo, useState } from 'react'
import { Globe, Sparkles } from 'lucide-react'
import { Icon } from '../shared/Icon'
import type { ConnectorType, EquipmentTemplate } from '../../types/equipment'
import { buildTemplateFromHints, type PortGroupHint } from '../../lib/portSuggestions'
import { felderAusfuellen } from '../../lib/felderAusfuellen'
import { getGeminiApiKey, setGeminiApiKey } from '../../lib/aiSuggestions'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { format, useTranslation } from '../../lib/i18n'
import { CategorySelect } from '../shared/CategorySelect'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'

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
  // #858 — EIN Zustand statt zweier, und die Quelle aus den Einstellungen.
  const [ausfuellLaeuft, setAusfuellLaeuft] = useState(false)
  const [aiError, setAiError] = useState('')
  const [webInfo, setWebInfo] = useState<string>('')
  const ausfuellQuelle = useSettingsStore((s) => s.ausfuellQuelle)
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false)
  const [apiKeyDraft, setApiKeyDraft] = useState('')

  useEffect(() => {
    if (!current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Draft aus dem aktuellen Item seeden (keyed sync)
    setName(current.name)
    setCategory(current.category || 'Custom')
    // #858 — HIER LIEF DIE HEURISTIK OHNE KLICK. Jeder Schrittwechsel fuellte
    // die Port-Gruppen mit geratenen Werten, und weil `suggestPortGroups` nie
    // eine leere Liste lieferte, stand nach dem Wechsel IMMER etwas da —
    // meist „1 Custom In / 1 Custom Out", bei einem Namenstreffer die festen
    // Zahlen einer Regel. Wer das uebersah, speicherte eine Vorlage mit
    // erfundenen Anschluessen und ohne jeden Beleg.
    //
    // Jetzt beginnt jedes Geraet LEER. Wer raten lassen will, drueckt den
    // einen Ausfuellen-Knopf; dann steht auch dran, wer geraten hat.
    setGroups([])
  }, [current])

  const progress = useMemo(() => `${Math.min(index + 1, items.length)} / ${items.length}`, [index, items.length])

  // Phase 3 der UI-Pruefung. Vor dem bedingten Ausstieg, weil Haken nicht
  // bedingt laufen duerfen; `open` schaltet stattdessen ihre Wirkung.
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, onCancel)

  // B-44 — der Assistent haelt Eingaben ueber mehrere Seiten. Wer auf
  // Seite drei steht, verliert bei einem Fehlklick daneben alles davor.
  const backdrop = useBackdropClose(onCancel, {
    schutz: () => index > 0 || name.trim().length > 0 || groups.length > 0,
    frage: t('rentmanWizard.closeUnsaved', 'Cancel the wizard and discard your input?'),
  })

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

  /**
   * DER EINE Ausfuellen-Knopf (#858) — dieselbe Quelle wie im
   * Anlegen-Dialog, weil es dieselbe Frage ist.
   */
  const handleAusfuellen = async () => {
    setAiError('')
    setWebInfo('')
    if (ausfuellQuelle === 'ki' && !getGeminiApiKey()) {
      // Kein Schluessel — die Einstellungen aufklappen statt zu werfen.
      setApiKeyDraft('')
      setAiSettingsOpen(true)
      setAiError(
        t('rentman.wizard.noGeminiKey', 'No AI API key configured. Enter one, or switch the source to web search in the settings.'),
      )
      return
    }
    setAusfuellLaeuft(true)
    try {
      const ergebnis = await felderAusfuellen(ausfuellQuelle, name, category)
      if (ergebnis.hints.length === 0) {
        if (ergebnis.quelle === 'ki') {
          setAiError(t('rentman.wizard.aiNoPorts', 'The model returned no ports. Try refining the name.'))
        } else {
          setWebInfo(
            ergebnis.schnipsel
              ? format(t('rentman.wizard.webNoConnectors', 'No connectors detected in the {source} snippet. Add them manually or try a different name.'), { source: ergebnis.fundstelle ?? 'web' })
              : t('rentman.wizard.webNoHit', 'No web hit. Refine the device name (manufacturer + model).'),
          )
        }
        return
      }
      setGroups(hintsToDrafts(ergebnis.hints))
      setWebInfo(
        format(t('rentman.wizard.webHints', 'Adopted {count} port group(s) from {source}.'), {
          count: ergebnis.hints.length,
          source: ergebnis.fundstelle ?? t('rentman.wizard.sourceAi', 'the AI model'),
        }),
      )
    } catch (err) {
      setAiError(err instanceof Error ? err.message : t('rentman.wizard.fillFailed', 'Filling in failed.'))
    } finally {
      setAusfuellLaeuft(false)
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
    <div
      {...backdrop}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6"
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="max-h-[90vh] w-full max-w-3xl overflow-auto border border-cp-border bg-cp-surface-1 p-4 text-cp-text"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 id={titleId} className="text-cp-xl font-semibold">
              {format(t('rentman.wizard.title', 'New Rentman device ({progress})'), { progress })}
            </h3>
            <p className="mt-1 text-cp-xs text-cp-text-muted">
              {t('rentman.wizard.introPre', 'First time we see')}{' '}
              <span className="text-cp-text-bright">{current.name}</span>
              {t('rentman.wizard.introPost', '. Confirm inputs/outputs — they’ll be remembered in your custom library.')}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('rentman.wizard.cancelImport', 'Cancel import')}
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-cp-base">
          <label className="block">
            {t('rentman.wizard.name', 'Name')}
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full border border-cp-border bg-cp-surface-3 p-2"
            />
          </label>
          <label className="block">
            {t('rentman.wizard.category', 'Category')}
            <div className="mt-1 flex gap-1">
              <CategorySelect
                value={category}
                onChange={setCategory}
                className="w-full border border-cp-border bg-cp-surface-3 p-2"
              />
              <button
                type="button"
                onClick={() => {
                  const cat = category.trim()
                  if (cat) addKnownCategories([cat])
                }}
                title={t('rentman.wizard.saveAsCategoryTitle', 'Save as new category')}
                className="bg-cp-surface-4 px-2 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('rentman.wizard.addCategory', '+ Add')}
              </button>
            </div>
          </label>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="text-cp-base font-semibold">{t('rentman.wizard.suggestedPortGroups', 'Suggested port groups')}</div>
          <div className="flex flex-wrap gap-2 text-cp-xs">
            {/* EIN Knopf (#858). Hier standen zwei — „Websuche (frei)" und
                „KI (Gemini)" —, dazu lief die Heuristik bei jedem
                Schrittwechsel ungefragt. */}
            <button
              type="button"
              onClick={handleAusfuellen}
              disabled={ausfuellLaeuft}
              className="bg-emerald-700 px-2 py-1 hover:bg-emerald-600 disabled:opacity-50"
              title={t('rentman.wizard.fillTitle', 'Fill the port groups in from the source chosen in the settings')}
            >
              {ausfuellLaeuft ? (
                t('rentman.wizard.fillBusy', 'Filling in…')
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Icon icon={ausfuellQuelle === 'ki' ? Sparkles : Globe} size="xs" />{' '}
                  {t('rentman.wizard.fill', 'Fill in')}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenAiSettings}
              className="bg-cp-surface-4 px-2 py-1 hover:bg-cp-surface-5"
              title={t('rentman.wizard.aiSettingsTitle', 'Configure Gemini API key')}
            >
              {t('rentman.wizard.aiSettings', 'AI settings')}
            </button>
            <button
              type="button"
              onClick={() => addGroup('in')}
              className="bg-sky-700 px-2 py-1 hover:bg-sky-600"
            >
              {t('rentman.wizard.addInputGroup', '+ Input group')}
            </button>
            <button
              type="button"
              onClick={() => addGroup('out')}
              className="bg-green-700 px-2 py-1 hover:bg-green-600"
            >
              {t('rentman.wizard.addOutputGroup', '+ Output group')}
            </button>
          </div>
        </div>
        {aiError && (
          <div className="mb-2 bg-red-900/50 p-2 text-cp-xs text-red-100">{aiError}</div>
        )}
        {webInfo && !aiError && (
          <div className="mb-2 bg-emerald-900/30 p-2 text-cp-xs text-emerald-100">{webInfo}</div>
        )}

        {aiSettingsOpen && (
          <div className="mb-3 border border-purple-700 bg-purple-950/40 p-3">
            <div className="mb-2 text-cp-xs font-semibold text-purple-200">{t('rentman.wizard.geminiKeyHeading', 'Gemini API key')}</div>
            <p className="mb-2 text-cp-xs text-cp-text-secondary">
              {t('rentman.wizard.geminiKeyHintPre', 'Free at')}{' '}
              <span className="font-mono text-cp-text-bright">aistudio.google.com/apikey</span>{' '}
              {t('rentman.wizard.geminiKeyHintPost', '(15 requests/min). Stored locally in browser storage.')}
            </p>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(event) => setApiKeyDraft(event.target.value)}
              placeholder={t('rentman.wizard.aiKeyPlaceholder', 'AIzaSy...')}
              className="w-full border border-cp-border bg-cp-surface-3 p-2 text-cp-xs"
              autoFocus
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiSettingsOpen(false)}
                className="bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeminiApiKey('')
                  setApiKeyDraft('')
                  setAiSettingsOpen(false)
                }}
                className="bg-red-700 px-2 py-1 text-cp-xs hover:bg-red-600"
              >
                {t('common.delete', 'Delete')}
              </button>
              <button
                type="button"
                onClick={handleSaveAiSettings}
                className="bg-emerald-600 px-2 py-1 text-cp-xs hover:bg-emerald-500"
              >
                {t('common.save', 'Save')}
              </button>
            </div>
          </div>
        )}

        <div className="mb-3 space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="grid grid-cols-[80px_70px_1fr_1fr_40px] items-center gap-2 border border-cp-border bg-cp-surface-3 p-2 text-cp-xs"
            >
              <select
                aria-label={t('rentman.wizard.directionAria', 'Direction')}
                value={group.direction}
                onChange={(event) => updateGroup(group.id, { direction: event.target.value as 'in' | 'out' })}
                className="border border-cp-border bg-cp-surface-1 p-1"
              >
                <option value="in">{t('rentman.wizard.directionIn', 'Input')}</option>
                <option value="out">{t('rentman.wizard.directionOut', 'Output')}</option>
              </select>
              <input
                aria-label={t('rentman.wizard.countAria', 'Count')}
                type="number"
                min={1}
                value={group.count}
                onChange={(event) => updateGroup(group.id, { count: Number(event.target.value) })}
                className="border border-cp-border bg-cp-surface-1 p-1"
              />
              <select
                aria-label={t('rentman.wizard.connectorTypeAria', 'Connector type')}
                value={group.connectorType}
                onChange={(event) => updateGroup(group.id, { connectorType: event.target.value as ConnectorType })}
                className="border border-cp-border bg-cp-surface-1 p-1"
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
                placeholder={t('rentman.wizard.labelPrefixPlaceholder', 'Label prefix')}
                className="border border-cp-border bg-cp-surface-1 p-1"
              />
              <button
                type="button"
                onClick={() => removeGroup(group.id)}
                className="bg-red-700 px-2 py-1 hover:bg-red-600"
                title={t('rentman.wizard.removeGroupTitle', 'Remove group')}
              >
                ×
              </button>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="text-cp-xs text-cp-text-muted">{t('rentman.wizard.noGroups', 'No port groups. Add one above, or skip this device.')}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 text-cp-base">
          <button
            type="button"
            onClick={handleExclude}
            className="bg-red-700 px-3 py-1 hover:bg-red-600"
            title={t('rentman.wizard.excludeTitle', 'Skip this device and do NOT import')}
          >
            {t('rentman.wizard.exclude', 'Do not import')}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="bg-cp-surface-4 px-3 py-1 hover:bg-cp-surface-5"
            title={t('rentman.wizard.skipTitle', 'Import without creating a library entry (1 generic input + output)')}
          >
            {t('rentman.wizard.skip', 'Skip (generic)')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
          >
            {isLast ? t('rentman.wizard.saveFinish', 'Save & finish') : t('rentman.wizard.saveNext', 'Save & next')}
          </button>
        </div>
      </div>
    </div>
  )
}
