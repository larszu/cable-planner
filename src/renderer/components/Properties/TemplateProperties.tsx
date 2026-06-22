import { useSyncedState } from '../../hooks/useSyncedState'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { nextPlacementPosition } from '../../lib/library'
import { CategorySelect } from '../shared/CategorySelect'
import { confirmDialog } from '../../lib/confirmDialog'
import { format, useTranslation } from '../../lib/i18n'

export const TemplateProperties = () => {
  const t = useTranslation()
  const selectedTemplateName = useProjectStore((state) => state.selectedTemplateName)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const updateCustomTemplate = useProjectStore((state) => state.updateCustomTemplate)
  const removeCustomTemplate = useProjectStore((state) => state.removeCustomTemplate)
  const addEquipment = useProjectStore((state) => state.addEquipment)
  const equipmentCount = useProjectStore((state) => state.project.equipment.length)
  const equipmentItems = useProjectStore((state) => state.project.equipment)
  const setSelectedTemplateName = useProjectStore((state) => state.setSelectedTemplateName)

  const template = customLibrary.find((tpl) => tpl.name === selectedTemplateName)

  const [name, setName] = useSyncedState(template?.name ?? '')
  const [category, setCategory] = useSyncedState(template?.category ?? '')

  if (!template) {
    return (
      <div className="text-cp-xs text-cp-text-muted">
        {t('template.noneSelected', 'Keine Vorlage ausgewählt.')}
      </div>
    )
  }

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    updateCustomTemplate(template.name, {
      name: trimmedName,
      category: category.trim() || undefined,
    })
    // If name changed, update selection to follow the new name
    if (trimmedName !== template.name) {
      setSelectedTemplateName(trimmedName)
    }
  }

  const handlePlace = () => {
    const pos = nextPlacementPosition(equipmentCount, equipmentItems)
    addEquipment({ ...template, ...pos })
  }

  const handleDelete = async () => {
    if (
      !(await confirmDialog(
        format(t('template.action.deleteConfirm', 'Vorlage "{name}" löschen?'), {
          name: template.name,
        }),
        {
          destructive: true,
          okLabel: t('confirm.delete', 'Löschen'),
        },
      ))
    )
      return
    removeCustomTemplate(template.name)
    setSelectedTemplateName(undefined)
  }

  return (
    <div className="space-y-3 text-cp-xs">
      <div className="flex items-center justify-between">
        <span className="text-cp-text-muted text-[10px] uppercase tracking-wide">
          {t('template.title', 'Vorlage')}
        </span>
        {template.rentmanSource && (
          <span
            className="rounded bg-orange-700 px-1.5 py-0.5 text-[10px] font-bold text-white"
            title={format(t('template.rentmanSourceTitle', 'Importiert aus Rentman-Projekt {source}'), { source: template.rentmanSource })}
          >
            R
          </span>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">{t('template.field.name', 'Name')}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">
          {t('template.field.category', 'Kategorie')}
        </span>
        <CategorySelect value={category} onChange={setCategory} />
      </label>

      <div className="rounded bg-cp-surface-1 p-2 space-y-1">
        <div className="flex justify-between">
          <span className="text-cp-text-muted">{t('template.field.inputs', 'Eingänge')}</span>
          <span className="text-cp-text-bright">{template.inputs.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-cp-text-muted">{t('template.field.outputs', 'Ausgänge')}</span>
          <span className="text-cp-text-bright">{template.outputs.length}</span>
        </div>
        {template.rentmanId && (
          <div className="flex justify-between">
            <span className="text-cp-text-muted">{t('template.rentmanIdLabel', 'Rentman-ID')}</span>
            <span className="text-cp-text-muted truncate max-w-[120px]" title={template.rentmanId}>
              {template.rentmanId}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="w-full rounded bg-emerald-700 px-2 py-1 text-white hover:bg-emerald-600"
      >
        {t('common.save', 'Speichern')}
      </button>

      <button
        type="button"
        onClick={handlePlace}
        className="w-full rounded bg-sky-700 px-2 py-1 text-white hover:bg-sky-600"
      >
        {t('template.action.place', 'Als Gerät platzieren')}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="w-full rounded bg-red-700 px-2 py-1 text-white hover:bg-red-600"
      >
        {t('template.action.delete', 'Vorlage löschen')}
      </button>
    </div>
  )
}
