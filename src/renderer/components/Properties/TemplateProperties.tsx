import { useSyncedState } from '../../hooks/useSyncedState'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { nextPlacementPosition } from '../../lib/library'
import { CategorySelect } from '../shared/CategorySelect'
import { confirmDialog } from '../../lib/confirmDialog'
import { format, useTranslation } from '../../lib/i18n'
import type { Port } from '../../types/equipment'

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
  const [shortName, setShortName] = useSyncedState(template?.shortName ?? '')
  const [subtitle, setSubtitle] = useSyncedState(template?.subtitle ?? '')
  const [notes, setNotes] = useSyncedState(template?.notes ?? '')

  if (!template) {
    return (
      <div className="text-cp-xs text-cp-text-muted">
        {t('template.noneSelected', 'No template selected.')}
      </div>
    )
  }

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    updateCustomTemplate(template.name, {
      name: trimmedName,
      category: category.trim() || undefined,
      shortName,
      subtitle,
      notes,
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
        format(t('template.action.deleteConfirm', 'Delete template "{name}"?'), {
          name: template.name,
        }),
        {
          destructive: true,
          okLabel: t('confirm.delete', 'Delete'),
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
        <span className="text-cp-text-muted text-cp-xs">
          {t('template.title', 'Template')}
        </span>
        {template.rentmanSource && (
          <span
            className="bg-orange-700 px-1.5 py-0.5 text-cp-xs font-bold text-white"
            title={format(t('template.rentmanSourceTitle', 'Imported from Rentman project {source}'), { source: template.rentmanSource })}
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
          className="w-full border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">
          {t('template.field.category', 'Category')}
        </span>
        <CategorySelect value={category} onChange={setCategory} />
      </label>

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">{t('template.field.shortName', 'Short name')}</span>
        <input
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          className="w-full border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">{t('template.field.subtitle', 'Subtitle')}</span>
        <input
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          className="w-full border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">{t('template.field.notes', 'Notes')}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border border-cp-border bg-cp-surface-1 p-2"
        />
      </label>

      <div className="bg-cp-surface-1 p-2 space-y-1">
        {template.isRackDevice && (
          <div className="flex justify-between">
            <span className="text-cp-text-muted">{t('template.field.rackUnits', 'Rack units')}</span>
            <span className="text-cp-text-bright">{template.rackUnits ?? 1} HE</span>
          </div>
        )}
        {(template.modes?.length ?? 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-cp-text-muted">{t('template.field.modes', 'Modes')}</span>
            <span className="text-cp-text-bright">{template.modes?.length}</span>
          </div>
        )}
        {template.rentmanId && (
          <div className="flex justify-between">
            <span className="text-cp-text-muted">{t('template.rentmanIdLabel', 'Rentman ID')}</span>
            <span className="text-cp-text-muted truncate max-w-[120px]" title={template.rentmanId}>
              {template.rentmanId}
            </span>
          </div>
        )}
      </div>

      <TemplatePortList label={t('template.field.inputs', 'Inputs')} ports={template.inputs} />
      <TemplatePortList label={t('template.field.outputs', 'Outputs')} ports={template.outputs} />

      <button
        type="button"
        onClick={handleSave}
        className="w-full bg-cp-ok px-2 py-1 text-white hover:brightness-110"
      >
        {t('common.save', 'Save')}
      </button>

      <button
        type="button"
        onClick={handlePlace}
        className="w-full bg-cp-accent px-2 py-1 text-cp-accent-text hover:bg-cp-accent-hover"
      >
        {t('template.action.place', 'Place on canvas')}
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="w-full bg-red-700 px-2 py-1 text-white hover:bg-red-600"
      >
        {t('template.action.delete', 'Delete template')}
      </button>
    </div>
  )
}

/** #987 — Ports der Vorlage zum Nachschlagen; bearbeitet werden sie am
 *  platzierten Geraet. */
const TemplatePortList = ({ label, ports }: { label: string; ports: Port[] }) => (
  <details className="bg-cp-surface-1 p-2" open={ports.length <= 8}>
    <summary className="cursor-pointer text-cp-text-muted">
      {label} <span className="text-cp-text-bright">{ports.length}</span>
    </summary>
    <ul className="mt-1 space-y-0.5">
      {ports.map((port) => (
        <li key={port.id} className="flex justify-between gap-2">
          <span className="min-w-0 truncate text-cp-text-bright" title={port.name}>{port.name}</span>
          <span className="shrink-0 text-cp-text-muted">{port.connectorType}</span>
        </li>
      ))}
    </ul>
  </details>
)
