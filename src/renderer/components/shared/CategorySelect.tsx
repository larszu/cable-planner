import { useProjectStore } from '../../store/projectStore'
import { promptDialog } from '../../lib/promptDialog'
import { useTranslation } from '../../lib/i18n'

interface CategorySelectProps {
  value: string
  onChange: (value: string) => void
  /**
   * Extra categories to merge into the option list. Defaults derive from
   * knownCategories ∪ customLibrary[].category, but callers occasionally
   * want to surface in-flight rack-builder categories or the current
   * equipment's category in case it isn't in the library yet.
   */
  extraOptions?: string[]
  className?: string
  /** When true, omit the "+ Neue Kategorie…" entry. */
  noCreate?: boolean
  /**
   * Override the prompt title when the user picks "+ Neue Kategorie…".
   * Default "Neue Kategorie".
   */
  promptTitle?: string
}

/**
 * Single source of truth for the "category dropdown with + Neue Kategorie…"
 * pattern. Replaces 5 hand-rolled copies in EquipmentProperties,
 * TemplateProperties, RackBuilderDialog, NewRentmanDeviceWizard and
 * LibraryPanel — each had its own option-list assembly, sentinel-value
 * onChange handler, prompt-call and addKnownCategories side-effect.
 *
 * Uses the project store directly so callers don't need to wire up the
 * known-categories list and addKnownCategories action themselves.
 */
export const CategorySelect = ({
  value,
  onChange,
  extraOptions,
  className = 'w-full rounded border border-slate-700 bg-slate-900 p-2',
  noCreate = false,
  promptTitle,
}: CategorySelectProps) => {
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const addKnownCategories = useProjectStore((s) => s.addKnownCategories)
  const t = useTranslation()
  const resolvedPromptTitle = promptTitle ?? t('category.newPrompt', 'Neue Kategorie')

  const options = Array.from(
    new Set(
      [
        ...knownCategories,
        ...customLibrary.map((t) => t.category).filter(Boolean),
        ...(extraOptions ?? []),
        value,
      ].filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b))

  return (
    <select
      value={value}
      onChange={async (event) => {
        const next = event.target.value
        if (next === '__new__') {
          const entered = (await promptDialog(resolvedPromptTitle))?.trim()
          if (entered) {
            onChange(entered)
            addKnownCategories([entered])
          }
          return
        }
        onChange(next)
      }}
      className={className}
    >
      {options.length === 0 && <option value="">—</option>}
      {options.map((cat) => (
        <option key={cat} value={cat}>
          {cat}
        </option>
      ))}
      {!noCreate && <option value="__new__">{t('category.new', '+ Neue Kategorie…')}</option>}
    </select>
  )
}
