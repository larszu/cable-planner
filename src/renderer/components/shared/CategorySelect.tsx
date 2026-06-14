import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useTranslation } from '../../lib/i18n'
import { bilingualCategoryDialog } from '../../lib/bilingualCategoryDialog'
import { buildCategoryOptions } from '../../lib/categoryTranslations'

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
 * #309 — Auto-bilingual: das "+ Neue Kategorie…"-Item öffnet jetzt
 * `bilingualCategoryDialog` statt eines einsprachigen Prompts. Die
 * canonical-Sprache (= UI-Sprache) wandert in `knownCategories[]`,
 * die andere Sprache wird in `categoryTranslations` gespeichert.
 * Anzeige im Dropdown erfolgt in der aktiven UI-Sprache.
 */
export const CategorySelect = ({
  value,
  onChange,
  extraOptions,
  className = 'w-full rounded border border-cp-border bg-cp-surface-1 p-2',
  noCreate = false,
  promptTitle,
}: CategorySelectProps) => {
  const knownCategories = useProjectStore((s) => s.knownCategories)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const addKnownCategories = useProjectStore((s) => s.addKnownCategories)
  const setCategoryTranslation = useProjectStore((s) => s.setCategoryTranslation)
  const categoryTranslations = useProjectStore((s) => s.categoryTranslations)
  const lang = useUiStore((s) => s.language)
  const t = useTranslation()
  const resolvedPromptTitle = promptTitle ?? t('category.newPrompt', 'Neue Kategorie')

  const canonicals = Array.from(
    new Set(
      [
        ...knownCategories,
        ...customLibrary.map((tpl) => tpl.category).filter(Boolean),
        ...(extraOptions ?? []),
        value,
      ].filter(Boolean),
    ),
  )
  const options = buildCategoryOptions(canonicals, lang, categoryTranslations)

  return (
    <select
      value={value}
      onChange={async (event) => {
        const next = event.target.value
        if (next === '__new__') {
          const result = await bilingualCategoryDialog(resolvedPromptTitle)
          if (result && result.canonical) {
            onChange(result.canonical)
            addKnownCategories([result.canonical])
            if (result.de || result.en) {
              setCategoryTranslation(result.canonical, { de: result.de, en: result.en })
            }
          }
          return
        }
        onChange(next)
      }}
      className={className}
    >
      {options.length === 0 && <option value="">—</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {!noCreate && <option value="__new__">{t('category.new', '+ Neue Kategorie…')}</option>}
    </select>
  )
}
