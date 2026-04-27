import { useState, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { nextPlacementPosition } from '../../lib/library'

export const TemplateProperties = () => {
  const selectedTemplateName = useProjectStore((state) => state.selectedTemplateName)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const updateCustomTemplate = useProjectStore((state) => state.updateCustomTemplate)
  const removeCustomTemplate = useProjectStore((state) => state.removeCustomTemplate)
  const addEquipment = useProjectStore((state) => state.addEquipment)
  const equipmentCount = useProjectStore((state) => state.project.equipment.length)
  const equipmentItems = useProjectStore((state) => state.project.equipment)
  const setSelectedTemplateName = useProjectStore((state) => state.setSelectedTemplateName)
  const knownCategories = useProjectStore((state) => state.knownCategories)

  const template = customLibrary.find((t) => t.name === selectedTemplateName)

  const [name, setName] = useState(template?.name ?? '')
  const [category, setCategory] = useState(template?.category ?? '')

  // Sync local state when selected template changes
  useEffect(() => {
    setName(template?.name ?? '')
    setCategory(template?.category ?? '')
  }, [template?.name, template?.category])

  if (!template) {
    return <div className="text-xs text-slate-400">Keine Vorlage ausgewählt.</div>
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

  const handleDelete = () => {
    if (!confirm(`Vorlage "${template.name}" löschen?`)) return
    removeCustomTemplate(template.name)
    setSelectedTemplateName(undefined)
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-[10px] uppercase tracking-wide">Vorlage</span>
        {template.rentmanSource && (
          <span
            className="rounded bg-orange-700 px-1.5 py-0.5 text-[10px] font-bold text-white"
            title={`Importiert aus Rentman-Projekt ${template.rentmanSource}`}
          >
            R
          </span>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-slate-300">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-slate-300">Kategorie</span>
        <input
          list="template-properties-categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-900 p-2"
        />
        <datalist id="template-properties-categories">
          {knownCategories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="rounded bg-slate-900 p-2 space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-400">Eingänge</span>
          <span className="text-slate-200">{template.inputs.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Ausgänge</span>
          <span className="text-slate-200">{template.outputs.length}</span>
        </div>
        {template.rentmanId && (
          <div className="flex justify-between">
            <span className="text-slate-400">Rentman-ID</span>
            <span className="text-slate-400 truncate max-w-[120px]" title={template.rentmanId}>
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
        Speichern
      </button>

      <button
        type="button"
        onClick={handlePlace}
        className="w-full rounded bg-sky-700 px-2 py-1 text-white hover:bg-sky-600"
      >
        Als Gerät platzieren
      </button>

      <button
        type="button"
        onClick={handleDelete}
        className="w-full rounded bg-red-700 px-2 py-1 text-white hover:bg-red-600"
      >
        Vorlage löschen
      </button>
    </div>
  )
}
