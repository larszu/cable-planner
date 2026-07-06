import { useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useUiStore } from '../../../store/uiStore'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { schemaForCategory, type CategoryFieldDef } from '../../../lib/categorySchemas'
import type { Lang } from '../../../lib/categoryTranslations'
import { PolarPatternDiagram } from '../../shared/PolarPatternDiagram'

const inputCls = 'w-full rounded border border-cp-border bg-cp-surface-1 p-2'

const Field = ({
  field,
  lang,
  value,
  onChange,
}: {
  field: CategoryFieldDef
  lang: Lang
  value: string | number | boolean | undefined
  onChange: (v: string | number | boolean | undefined) => void
}) => {
  const label = field.label[lang] ?? field.label.de

  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked ? true : undefined)}
        />
        <span className="text-cp-text-secondary">{label}</span>
      </label>
    )
  }

  const labelEl = (
    <span className="mb-1 block text-cp-text-secondary">
      {label}
      {field.unit ? <span className="text-cp-text-faint"> ({field.unit})</span> : null}
    </span>
  )

  if (field.type === 'select' || field.type === 'polar-pattern') {
    const selectEl = (
      <select
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={inputCls}
      >
        <option value="">—</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label[lang] ?? o.label.de}
          </option>
        ))}
      </select>
    )
    if (field.type === 'polar-pattern') {
      return (
        <label className="block">
          {labelEl}
          <div className="flex items-center gap-2">
            <div className="flex-1">{selectEl}</div>
            <PolarPatternDiagram
              pattern={typeof value === 'string' ? value : undefined}
              size={52}
              className="shrink-0 text-cp-accent"
            />
          </div>
        </label>
      )
    }
    return (
      <label className="block">
        {labelEl}
        {selectEl}
      </label>
    )
  }

  if (field.type === 'number') {
    return (
      <label className="block">
        {labelEl}
        <input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          placeholder={field.placeholder}
          className={inputCls}
        />
      </label>
    )
  }

  return (
    <label className="block">
      {labelEl}
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder={field.placeholder}
        className={inputCls}
      />
    </label>
  )
}

/**
 * #373 — Generische, kategorie-abhängige Fachdaten-Sektion. Liest das Schema
 * aus `lib/categorySchemas.ts` für `equipment.category` und schreibt die Werte
 * nach `equipment.categoryProps`. Rendert null, wenn die Kategorie kein Schema
 * hat (analog zu `DisplayPropertiesBlock`).
 */
export const CategoryPropsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const lang: Lang = useUiStore((s) => s.language) === 'en' ? 'en' : 'de'
  const updateEquipment = useProjectStore((s) => s.updateEquipment)

  const props = equipment.categoryProps ?? {}
  // Ein-/ausklappbar (wie SDI-Caps / Abmessungen). Default offen, wenn schon
  // Fachdaten gesetzt sind, sonst eingeklappt. <summary> statt Form-Control,
  // damit das Toggle auch im gesperrten (viewer/finalized) Fieldset geht.
  // WICHTIG: useState MUSS vor dem `return null` stehen (Rules of Hooks) —
  // sonst aendert sich die Hook-Anzahl wenn die Kategorie beim Geraetewechsel
  // von "kein Schema" zu "Schema" wechselt.
  const [open, setOpen] = useState(Object.keys(props).length > 0)

  const fields = schemaForCategory(equipment.category)
  if (fields.length === 0) return null

  const setProp = (key: string, value: string | number | boolean | undefined) => {
    const next: Record<string, string | number | boolean> = { ...props }
    if (value === undefined || value === '') delete next[key]
    else next[key] = value
    updateEquipment(equipment.id, {
      categoryProps: Object.keys(next).length ? next : undefined,
    })
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded border border-cp-border [&_summary]:cursor-pointer"
    >
      <summary className="flex items-center gap-1 px-2 py-1.5 text-[11px] uppercase tracking-wide text-cp-text-muted hover:text-cp-text-bright [&::-webkit-details-marker]:hidden">
        <span className="text-cp-text-faint">{open ? '▾' : '▸'}</span>
        <span className="flex-1">
          {t('catprops.title', 'Fachdaten')} — {equipment.category}
        </span>
      </summary>
      <div className="grid grid-cols-2 gap-2 px-2 pb-2">
        {fields.map((f) => (
          <Field key={f.key} field={f} lang={lang} value={props[f.key]} onChange={(v) => setProp(f.key, v)} />
        ))}
      </div>
    </details>
  )
}
