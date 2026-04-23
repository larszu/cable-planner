import { useEffect, useMemo, useState } from 'react'
import type { ConnectorType, EquipmentTemplate } from '../../types/equipment'
import { buildTemplateFromHints, suggestPortGroups, type PortGroupHint } from '../../lib/portSuggestions'
import { getGeminiApiKey, setGeminiApiKey, suggestFromAI } from '../../lib/aiSuggestions'
import { useProjectStore } from '../../store/projectStore'

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
  onSave,
  onCancel,
}: NewRentmanDeviceWizardProps) => {
  const [index, setIndex] = useState(0)
  const current = items[index]

  const knownCategories = useProjectStore((state) => state.knownCategories)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [groups, setGroups] = useState<GroupDraft[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    if (!current) return
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
    setAiLoading(true)
    try {
      const hints = await suggestFromAI(name, category)
      if (hints.length === 0) {
        setAiError('AI returned no ports. Try refining the name.')
        return
      }
      setGroups(hintsToDrafts(hints))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI request failed')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSetApiKey = () => {
    const current_ = getGeminiApiKey()
    const next = window.prompt(
      'Enter Gemini API key (leave empty to clear). Get one at https://aistudio.google.com/apikey',
      current_,
    )
    if (next === null) return
    setGeminiApiKey(next.trim())
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

  const isLast = index + 1 >= items.length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">New Rentman Device ({progress})</h3>
            <p className="mt-1 text-xs text-slate-400">
              First time we see <span className="text-slate-200">{current.name}</span>. Confirm inputs/outputs — they&rsquo;ll be
              remembered in your custom library.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
          >
            Cancel import
          </button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <label className="block">
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>
          <label className="block">
            Category
            <div className="mt-1 flex gap-1">
              <input
                list="wizard-category-options"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-2"
              />
              <button
                type="button"
                onClick={() => {
                  const cat = category.trim()
                  if (cat) addKnownCategories([cat])
                }}
                title="Save as new category"
                className="rounded bg-slate-700 px-2 text-xs hover:bg-slate-600"
              >
                + Add
              </button>
            </div>
            <datalist id="wizard-category-options">
              {Array.from(
                new Set([
                  ...knownCategories,
                  ...customLibrary.map((t) => t.category).filter(Boolean),
                ]),
              )
                .sort((a, b) => a.localeCompare(b))
                .map((cat) => (
                  <option key={cat} value={cat} />
                ))}
            </datalist>
          </label>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Suggested Port Groups</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={aiLoading}
              className="rounded bg-purple-700 px-2 py-1 hover:bg-purple-600 disabled:opacity-50"
              title="Use Gemini AI to suggest ports based on datasheets"
            >
              {aiLoading ? 'Asking AI…' : '✨ Suggest from AI'}
            </button>
            <button
              type="button"
              onClick={handleSetApiKey}
              className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
              title="Configure Gemini API key"
            >
              AI settings
            </button>
            <button
              type="button"
              onClick={() => addGroup('in')}
              className="rounded bg-sky-700 px-2 py-1 hover:bg-sky-600"
            >
              + Input Group
            </button>
            <button
              type="button"
              onClick={() => addGroup('out')}
              className="rounded bg-green-700 px-2 py-1 hover:bg-green-600"
            >
              + Output Group
            </button>
          </div>
        </div>
        {aiError && (
          <div className="mb-2 rounded bg-red-900/50 p-2 text-xs text-red-100">{aiError}</div>
        )}

        <div className="mb-3 space-y-2">
          {groups.map((group) => (
            <div
              key={group.id}
              className="grid grid-cols-[80px_70px_1fr_1fr_40px] items-center gap-2 rounded border border-slate-700 bg-slate-950 p-2 text-xs"
            >
              <select
                aria-label="Direction"
                value={group.direction}
                onChange={(event) => updateGroup(group.id, { direction: event.target.value as 'in' | 'out' })}
                className="rounded border border-slate-700 bg-slate-900 p-1"
              >
                <option value="in">Input</option>
                <option value="out">Output</option>
              </select>
              <input
                aria-label="Count"
                type="number"
                min={1}
                value={group.count}
                onChange={(event) => updateGroup(group.id, { count: Number(event.target.value) })}
                className="rounded border border-slate-700 bg-slate-900 p-1"
              />
              <select
                aria-label="Connector type"
                value={group.connectorType}
                onChange={(event) => updateGroup(group.id, { connectorType: event.target.value as ConnectorType })}
                className="rounded border border-slate-700 bg-slate-900 p-1"
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
                placeholder="Label prefix"
                className="rounded border border-slate-700 bg-slate-900 p-1"
              />
              <button
                type="button"
                onClick={() => removeGroup(group.id)}
                className="rounded bg-red-700 px-2 py-1 hover:bg-red-600"
                title="Remove group"
              >
                ×
              </button>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="text-xs text-slate-400">No port groups. Add one above, or skip this device.</div>
          )}
        </div>

        <div className="flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
            title="Import without creating a library entry (1 generic input + output)"
          >
            Skip (generic)
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
          >
            {isLast ? 'Save & Finish' : 'Save & Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
