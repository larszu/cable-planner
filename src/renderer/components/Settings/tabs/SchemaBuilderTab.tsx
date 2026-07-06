import { useMemo, useState } from 'react'
import { Plus, Trash2, Lock } from 'lucide-react'
import { useSettingsStore } from '../../../store/settingsStore'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useTranslation } from '../../../lib/i18n'
import { SettingsCard } from '../SettingsCard'
import {
  builtInSchemaForCategory,
  canonicalCategoryKey,
  type CategoryFieldDef,
  type CategoryFieldType,
} from '../../../lib/categorySchemas'
import { DEFAULT_CATEGORIES } from '../../../store/libraryPersist'
import { categoryDisplay, type Lang } from '../../../lib/categoryTranslations'

// ─────────────────────────────────────────────────────────────────────────────
// #Feld-Builder — User-definierte Fachfelder je Kategorie (EAV-/Dynamic-Schema).
// Macht aus dem hartkodierten CATEGORY_SCHEMAS erweiterbare Daten: der User legt
// eigene Felder (z. B. „Pickup-Pattern") an, die generisch von der
// CategoryPropsSection gerendert werden. Built-in-Felder bleiben read-only.
// ─────────────────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded border border-cp-border bg-cp-surface-1 p-1.5 text-cp-sm'

const FIELD_TYPES: { value: CategoryFieldType; de: string; en: string }[] = [
  { value: 'text', de: 'Text', en: 'Text' },
  { value: 'number', de: 'Zahl', en: 'Number' },
  { value: 'select', de: 'Auswahl', en: 'Select' },
  { value: 'boolean', de: 'Ja/Nein', en: 'Yes/No' },
  { value: 'polar-pattern', de: 'Richtcharakteristik (Diagramm)', en: 'Polar pattern (diagram)' },
]

/** Label → stabiler camelCase-Key. */
const keyFromLabel = (label: string): string => {
  const cleaned = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  const parts = cleaned.split(' ').filter(Boolean)
  if (parts.length === 0) return ''
  return parts[0] + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('')
}

interface DraftOption {
  value: string
  de: string
  en: string
}

const emptyDraft = (): {
  labelDe: string
  labelEn: string
  key: string
  type: CategoryFieldType
  unit: string
  placeholder: string
  options: DraftOption[]
} => ({ labelDe: '', labelEn: '', key: '', type: 'text', unit: '', placeholder: '', options: [] })

export const SchemaBuilderTab = () => {
  const t = useTranslation()
  const lang: Lang = useUiStore((s) => s.language) === 'en' ? 'en' : 'de'
  const userSchema = useSettingsStore((s) => s.userSchema)
  const setUserSchema = useSettingsStore((s) => s.setUserSchema)
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const catTranslations = useProjectStore((s) => s.categoryTranslations)
  const addKnownCategories = useProjectStore((s) => s.addKnownCategories)
  const setCategoryTranslation = useProjectStore((s) => s.setCategoryTranslation)

  const allCategories = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const c of [...DEFAULT_CATEGORIES, ...knownCategories]) {
      if (c && !seen.has(c)) {
        seen.add(c)
        list.push(c)
      }
    }
    return list
  }, [knownCategories])
  const isBuiltInCat = (c: string) => (DEFAULT_CATEGORIES as readonly string[]).includes(c)

  const [category, setCategory] = useState<string>(allCategories[0] ?? 'Audio')
  const [draft, setDraft] = useState(emptyDraft())
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [newCatDe, setNewCatDe] = useState('')
  const [newCatEn, setNewCatEn] = useState('')

  const canonKey = canonicalCategoryKey(category)
  const builtIn = builtInSchemaForCategory(category)
  const userFields = userSchema[canonKey] ?? []

  const resetDraft = () => {
    setDraft(emptyDraft())
    setEditing(false)
    setError('')
  }

  const addField = () => {
    const key = draft.key || keyFromLabel(draft.labelDe)
    if (!key) {
      setError(t('schemaBuilder.err.key', 'Bitte einen Feld-Namen angeben.'))
      return
    }
    // Kollision mit Built-in-Key oder existierendem User-Feld verhindern.
    if (builtIn.some((f) => f.key === key) || userFields.some((f) => f.key === key)) {
      setError(t('schemaBuilder.err.dupe', 'Dieser Schlüssel existiert in der Kategorie bereits.'))
      return
    }
    if ((draft.type === 'select' || draft.type === 'polar-pattern') && draft.options.filter((o) => o.value.trim()).length === 0) {
      setError(t('schemaBuilder.err.opts', 'Auswahl-Felder brauchen mindestens eine Option.'))
      return
    }
    const field: CategoryFieldDef = {
      key,
      label: { de: draft.labelDe || key, en: draft.labelEn || draft.labelDe || key },
      type: draft.type,
      userDefined: true,
      ...(draft.unit.trim() ? { unit: draft.unit.trim() } : {}),
      ...(draft.placeholder.trim() ? { placeholder: draft.placeholder.trim() } : {}),
      ...(draft.type === 'select' || draft.type === 'polar-pattern'
        ? {
            options: draft.options
              .filter((o) => o.value.trim())
              .map((o) => ({ value: o.value.trim(), label: { de: o.de || o.value, en: o.en || o.de || o.value } })),
          }
        : {}),
    }
    setUserSchema({ ...userSchema, [canonKey]: [...userFields, field] })
    resetDraft()
  }

  const removeField = (key: string) => {
    const next = userFields.filter((f) => f.key !== key)
    const map = { ...userSchema }
    if (next.length) map[canonKey] = next
    else delete map[canonKey]
    setUserSchema(map)
  }

  const addCategory = () => {
    const de = newCatDe.trim()
    if (!de) return
    // Über das echte Kategorie-System anlegen (sofort auf Geräten wählbar).
    addKnownCategories([de])
    setCategoryTranslation(de, { de, en: newCatEn.trim() || de })
    setNewCatDe('')
    setNewCatEn('')
    setCategory(de)
  }

  const typeLabel = (ty: CategoryFieldType) => {
    const e = FIELD_TYPES.find((x) => x.value === ty)!
    return lang === 'en' ? e.en : e.de
  }

  return (
    <div className="space-y-3">
      <SettingsCard
        title={t('schemaBuilder.title', 'Kategorien & Felder')}
        description={t(
          'schemaBuilder.desc',
          'Lege eigene Fachfelder (z. B. Pickup-Pattern) und Kategorien an. Sie erscheinen automatisch in den Geräte-Eigenschaften und in BOM/Export. Built-in-Felder sind gesperrt.',
        )}
      >
        {/* Kategorie-Wahl + Neu-Anlage */}
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-secondary">
              {t('schemaBuilder.category', 'Kategorie')}
            </span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {categoryDisplay(c, lang, catTranslations)}
                  {isBuiltInCat(c) ? '' : ' *'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mb-3 flex flex-wrap items-end gap-2 rounded border border-cp-border-muted bg-cp-surface-2/40 p-2">
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-faint">
              {t('schemaBuilder.newCatDe', 'Neue Kategorie (DE)')}
            </span>
            <input value={newCatDe} onChange={(e) => setNewCatDe(e.target.value)} className={inputCls} placeholder="z. B. Funkstrecken-Zubehör" />
          </label>
          <label className="block">
            <span className="mb-1 block text-cp-xs text-cp-text-faint">{t('schemaBuilder.newCatEn', 'Name (EN)')}</span>
            <input value={newCatEn} onChange={(e) => setNewCatEn(e.target.value)} className={inputCls} placeholder="RF accessories" />
          </label>
          <button
            type="button"
            onClick={addCategory}
            disabled={!newCatDe.trim()}
            className="flex items-center gap-1 rounded bg-sky-700 px-2 py-1.5 text-cp-xs text-white hover:bg-sky-600 disabled:opacity-40"
          >
            <Plus size={13} /> {t('schemaBuilder.addCat', 'Kategorie anlegen')}
          </button>
        </div>

        {/* Feld-Liste */}
        <div className="space-y-1">
          {builtIn.map((f) => (
            <div key={f.key} className="flex items-center gap-2 rounded border border-cp-border-muted bg-cp-surface-3/30 px-2 py-1 text-cp-xs text-cp-text-muted">
              <Lock size={12} className="text-cp-text-faint" />
              <span className="flex-1">{f.label[lang] ?? f.label.de}</span>
              <span className="text-cp-text-faint">{typeLabel(f.type)}</span>
              {f.unit ? <span className="text-cp-text-faint">· {f.unit}</span> : null}
              <span className="rounded bg-cp-surface-2 px-1 text-[10px] text-cp-text-faint">built-in</span>
            </div>
          ))}
          {userFields.map((f) => (
            <div key={f.key} className="flex items-center gap-2 rounded border border-cp-accent/30 bg-cp-accent/5 px-2 py-1 text-cp-xs">
              <span className="flex-1 text-cp-text">{f.label[lang] ?? f.label.de}</span>
              <span className="text-cp-text-faint">{typeLabel(f.type)}</span>
              {f.unit ? <span className="text-cp-text-faint">· {f.unit}</span> : null}
              <span className="font-mono text-[10px] text-cp-text-faint">{f.key}</span>
              <button type="button" onClick={() => removeField(f.key)} className="text-cp-danger hover:text-cp-danger/80" title={t('common.delete', 'Löschen')}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {builtIn.length === 0 && userFields.length === 0 && (
            <p className="px-1 py-2 text-cp-xs text-cp-text-faint">
              {t('schemaBuilder.empty', 'Diese Kategorie hat noch keine Felder. Lege unten das erste an.')}
            </p>
          )}
        </div>
      </SettingsCard>

      {/* Feld-Editor */}
      <SettingsCard title={t('schemaBuilder.newField', 'Neues Feld')}>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded bg-cp-surface-2 px-2 py-1.5 text-cp-sm text-cp-text-secondary hover:bg-cp-surface-1"
          >
            <Plus size={14} /> {t('schemaBuilder.addField', 'Feld hinzufügen')}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('schemaBuilder.labelDe', 'Bezeichnung (DE)')}</span>
                <input
                  value={draft.labelDe}
                  onChange={(e) => setDraft({ ...draft, labelDe: e.target.value, key: draft.key || keyFromLabel(e.target.value) })}
                  className={inputCls}
                  placeholder="z. B. Pickup-Pattern"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('schemaBuilder.labelEn', 'Label (EN)')}</span>
                <input value={draft.labelEn} onChange={(e) => setDraft({ ...draft, labelEn: e.target.value })} className={inputCls} placeholder="Pickup pattern" />
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('schemaBuilder.key', 'Schlüssel')}</span>
                <input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value.replace(/[^a-zA-Z0-9]/g, '') })} className={`${inputCls} font-mono`} placeholder="pickupPattern" />
              </label>
              <label className="block">
                <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('schemaBuilder.type', 'Typ')}</span>
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as CategoryFieldType })} className={inputCls}>
                  {FIELD_TYPES.map((ty) => (
                    <option key={ty.value} value={ty.value}>
                      {lang === 'en' ? ty.en : ty.de}
                    </option>
                  ))}
                </select>
              </label>
              {draft.type !== 'boolean' && draft.type !== 'polar-pattern' && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('schemaBuilder.unit', 'Einheit (optional)')}</span>
                    <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className={inputCls} placeholder="dB, mm, Ω …" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-cp-xs text-cp-text-secondary">{t('schemaBuilder.placeholder', 'Platzhalter (optional)')}</span>
                    <input value={draft.placeholder} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })} className={inputCls} />
                  </label>
                </>
              )}
            </div>

            {(draft.type === 'select' || draft.type === 'polar-pattern') && (
              <div className="rounded border border-cp-border-muted bg-cp-surface-2/40 p-2">
                <div className="mb-1 flex items-center justify-between text-cp-xs text-cp-text-secondary">
                  <span>{t('schemaBuilder.options', 'Auswahl-Optionen')}</span>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, options: [...draft.options, { value: '', de: '', en: '' }] })}
                    className="flex items-center gap-1 text-cp-accent hover:underline"
                  >
                    <Plus size={12} /> {t('schemaBuilder.addOption', 'Option')}
                  </button>
                </div>
                {draft.options.map((o, i) => (
                  <div key={i} className="mb-1 grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
                    <input
                      value={o.value}
                      onChange={(e) => {
                        const opts = [...draft.options]
                        opts[i] = { ...o, value: e.target.value }
                        setDraft({ ...draft, options: opts })
                      }}
                      className={`${inputCls} font-mono`}
                      placeholder="wert"
                    />
                    <input
                      value={o.de}
                      onChange={(e) => {
                        const opts = [...draft.options]
                        opts[i] = { ...o, de: e.target.value }
                        setDraft({ ...draft, options: opts })
                      }}
                      className={inputCls}
                      placeholder="DE"
                    />
                    <input
                      value={o.en}
                      onChange={(e) => {
                        const opts = [...draft.options]
                        opts[i] = { ...o, en: e.target.value }
                        setDraft({ ...draft, options: opts })
                      }}
                      className={inputCls}
                      placeholder="EN"
                    />
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })}
                      className="text-cp-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="text-cp-xs text-cp-danger">{error}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={addField} className="rounded bg-sky-700 px-3 py-1.5 text-cp-sm text-white hover:bg-sky-600">
                {t('schemaBuilder.save', 'Feld anlegen')}
              </button>
              <button type="button" onClick={resetDraft} className="rounded bg-cp-surface-2 px-3 py-1.5 text-cp-sm text-cp-text-secondary hover:bg-cp-surface-1">
                {t('common.cancel', 'Abbrechen')}
              </button>
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  )
}
