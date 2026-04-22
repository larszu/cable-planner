import { useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../../store/projectStore'
import type { ConnectorType, EquipmentTemplate, Port } from '../../types/equipment'
import { LibraryItem } from './LibraryItem'
import { CableLibraryPanel } from './CableLibraryPanel'

const connectorOptions: ConnectorType[] = [
  'XLR',
  'BNC',
  'HDMI',
  'SDI',
  'Ethernet/RJ45',
  'Fiber',
  'DIN',
  'DisplayPort',
  'USB',
  'IEC 230V',
  'PowerCON',
  'Schuko 230V',
  'Custom',
]

interface PortGroupDraft {
  id: string
  direction: 'in' | 'out'
  count: number
  connectorType: ConnectorType
  label: string
}

const defaultGroup = (direction: 'in' | 'out'): PortGroupDraft => ({
  id: uuidv4(),
  direction,
  count: 1,
  connectorType: 'Custom',
  label: direction === 'in' ? 'Input' : 'Output',
})

const buildPorts = (groups: PortGroupDraft[], direction: 'in' | 'out'): Port[] => {
  const filtered = groups.filter((group) => group.direction === direction)
  return filtered.flatMap((group) =>
    Array.from({ length: Math.max(0, group.count) }, (_item, index) => ({
      id: uuidv4(),
      name: `${group.label} ${index + 1}`,
      type: group.connectorType,
      connectorType: group.connectorType,
    })),
  )
}

export const LibraryPanel = () => {
  const addEquipment = useProjectStore((state) => state.addEquipment)
  const equipmentCount = useProjectStore((state) => state.project.equipment.length)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const addCustomTemplate = useProjectStore((state) => state.addCustomTemplate)
  const removeCustomTemplate = useProjectStore((state) => state.removeCustomTemplate)
  const setCustomTemplateCategory = useProjectStore((state) => state.setCustomTemplateCategory)
  const knownCategories = useProjectStore((state) => state.knownCategories)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [name, setName] = useState('Custom Device')
  const [category, setCategory] = useState('Kameras')
  const [groups, setGroups] = useState<PortGroupDraft[]>([
    defaultGroup('in'),
    defaultGroup('out'),
  ])
  const [tab, setTab] = useState<'equipment' | 'cables'>('equipment')
  // Category management state
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [showEmpty, setShowEmpty] = useState(false)
  const [movingItem, setMovingItem] = useState<string | null>(null)
  const newGroupInputRef = useRef<HTMLInputElement>(null)

  const nextPosition = useMemo(
    () => ({
      x: 80 + (equipmentCount % 6) * 220,
      y: 80 + Math.floor(equipmentCount / 6) * 180,
    }),
    [equipmentCount],
  )

  const updateGroup = (id: string, patch: Partial<PortGroupDraft>) => {
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, ...patch } : group)))
  }

  const addGroup = (direction: 'in' | 'out') => {
    setGroups((current) => [...current, defaultGroup(direction)])
  }

  const removeGroup = (id: string) => {
    setGroups((current) => current.filter((group) => group.id !== id))
  }

  const resetDialog = () => {
    setName('Custom Device')
    setCategory('Kameras')
    setGroups([defaultGroup('in'), defaultGroup('out')])
  }

  const buildTemplate = (): EquipmentTemplate => {
    const inputs = buildPorts(groups, 'in')
    const outputs = buildPorts(groups, 'out')
    const maxPorts = Math.max(inputs.length, outputs.length, 3)
    return {
      name: name.trim() || 'Custom Device',
      category: category.trim() || 'Sonstiges',
      inputs,
      outputs,
      width: 240,
      height: 80 + maxPorts * 22,
    }
  }

  const persistCategory = (template: EquipmentTemplate) => {
    const cat = template.category.trim()
    if (cat) addKnownCategories([cat])
  }

  const saveCustomToLibrary = () => {
    const template = buildTemplate()
    persistCategory(template)
    addCustomTemplate(template)
    setShowCreateDialog(false)
    resetDialog()
  }

  const saveCustomAndPlace = () => {
    const template = buildTemplate()
    persistCategory(template)
    addCustomTemplate(template)
    addEquipment({ ...template, ...nextPosition })
    setShowCreateDialog(false)
    resetDialog()
  }

  return (
    <aside className="flex h-full flex-col border-r border-slate-700 bg-slate-950 p-3 text-slate-100">
      <div className="mb-3 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setTab('equipment')}
          className={`rounded px-2 py-1 ${tab === 'equipment' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Equipment
        </button>
        <button
          type="button"
          onClick={() => setTab('cables')}
          className={`rounded px-2 py-1 ${tab === 'cables' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Cables
        </button>
      </div>

      {tab === 'equipment' && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Equipment Library</h2>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setShowNewGroup((v) => !v)
                  setTimeout(() => newGroupInputRef.current?.focus(), 50)
                }}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
                title="Add new category"
              >
                + Gruppe
              </button>
              <button
                type="button"
                onClick={() => setShowCreateDialog(true)}
                className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
              >
                + Gerät
              </button>
            </div>
          </div>

          {showNewGroup && (
            <form
              className="mb-2 flex gap-1"
              onSubmit={(e) => {
                e.preventDefault()
                const cat = newGroupName.trim()
                if (cat) {
                  addKnownCategories([cat])
                  setNewGroupName('')
                  setShowNewGroup(false)
                }
              }}
            >
              <input
                ref={newGroupInputRef}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Kategoriename…"
                className="flex-1 rounded border border-slate-600 bg-slate-900 p-1.5 text-xs"
              />
              <button
                type="submit"
                className="rounded bg-emerald-700 px-2 text-xs hover:bg-emerald-600"
              >
                OK
              </button>
              <button
                type="button"
                onClick={() => setShowNewGroup(false)}
                className="rounded bg-slate-700 px-2 text-xs hover:bg-slate-600"
              >
                ✕
              </button>
            </form>
          )}

          <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
            <span className="italic">Auf Canvas ziehen oder klicken zum Hinzufügen</span>
            <button
              type="button"
              onClick={() => setShowEmpty((v) => !v)}
              className="underline hover:text-slate-300"
            >
              {showEmpty ? 'Leere ausblenden' : 'Leere zeigen'}
            </button>
          </div>

          <div className="flex-1 space-y-1 overflow-auto">
            {(() => {
              const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
              const allCats = Array.from(new Set([...knownCategories, ...usedCats]))
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b))
              if (allCats.length === 0) allCats.push('Sonstiges')
              return allCats.map((cat) => {
                const items = customLibrary.filter(
                  (t) => (t.category || 'Sonstiges') === cat,
                )
                if (!showEmpty && items.length === 0) return null
                const collapsed = collapsedCats.has(cat)
                return (
                  <section
                    key={cat}
                    onDragOver={(event) => {
                      if (event.dataTransfer.types.includes('application/cable-planner-equipment')) {
                        event.preventDefault()
                        event.dataTransfer.dropEffect = 'move'
                      }
                    }}
                    onDrop={(event) => {
                      const raw = event.dataTransfer.getData('application/cable-planner-equipment')
                      if (!raw) return
                      try {
                        const tpl = JSON.parse(raw) as EquipmentTemplate
                        if (tpl.name) { event.preventDefault(); setCustomTemplateCategory(tpl.name, cat) }
                      } catch { /* ignore */ }
                    }}
                    className="rounded border border-slate-800"
                  >
                    {/* Category header */}
                    <div className="flex items-center justify-between px-2 py-1">
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedCats((prev) => {
                            const next = new Set(prev)
                            collapsed ? next.delete(cat) : next.add(cat)
                            return next
                          })
                        }
                        className="flex flex-1 items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                      >
                        <span>{collapsed ? '▶' : '▼'}</span>
                        <span>{cat}</span>
                        <span className="font-normal text-slate-600">({items.length})</span>
                      </button>
                    </div>

                    {/* Items */}
                    {!collapsed && (
                      <div className="space-y-1 px-1 pb-1">
                        {items.length === 0 ? (
                          <div className="px-1 py-1 text-[11px] italic text-slate-600">
                            Gerät hierher ziehen zum Verschieben
                          </div>
                        ) : (
                          items.map((item) => (
                            <div key={item.name} className="group/item relative">
                              <LibraryItem
                                item={item}
                                onAdd={() => addEquipment({ ...item, ...nextPosition })}
                                onRemove={() => removeCustomTemplate(item.name)}
                              />
                              {/* Move-to control — shown when this item is the "active" one */}
                              {movingItem === item.name ? (
                                <div className="mt-0.5 flex items-center gap-1">
                                  <select
                                    autoFocus
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        setCustomTemplateCategory(item.name, e.target.value)
                                      }
                                      setMovingItem(null)
                                    }}
                                    onBlur={() => setMovingItem(null)}
                                    className="flex-1 rounded border border-slate-600 bg-slate-900 p-1 text-[11px]"
                                  >
                                    <option value="" disabled>Verschieben nach…</option>
                                    {allCats.filter((c) => c !== cat).map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => setMovingItem(null)}
                                    className="text-slate-500 hover:text-slate-200 text-xs"
                                  >✕</button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setMovingItem(item.name)}
                                  className="absolute right-7 top-1 hidden rounded bg-slate-700 px-1 py-0.5 text-[10px] hover:bg-slate-600 group-hover/item:block"
                                  title="In andere Kategorie verschieben"
                                >
                                  ↗
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </section>
                )
              })
            })()}
          </div>
        </>
      )}

      {tab === 'cables' && <CableLibraryPanel />}

      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4">
            <h3 className="mb-3 text-base font-semibold">Create Custom Device</h3>
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
                    list="library-category-options"
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
                <datalist id="library-category-options">
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
              <div className="text-sm font-semibold">Port Groups</div>
              <div className="flex gap-2 text-xs">
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

            <div className="mb-3 space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="grid grid-cols-[80px_70px_1fr_1fr_40px] items-center gap-2 rounded border border-slate-700 bg-slate-950 p-2 text-xs"
                >
                  <select
                    value={group.direction}
                    onChange={(event) =>
                      updateGroup(group.id, { direction: event.target.value as 'in' | 'out' })
                    }
                    className="rounded border border-slate-700 bg-slate-900 p-1"
                  >
                    <option value="in">Input</option>
                    <option value="out">Output</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={group.count}
                    onChange={(event) =>
                      updateGroup(group.id, { count: Number(event.target.value) })
                    }
                    className="rounded border border-slate-700 bg-slate-900 p-1"
                  />
                  <select
                    value={group.connectorType}
                    onChange={(event) =>
                      updateGroup(group.id, {
                        connectorType: event.target.value as ConnectorType,
                      })
                    }
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
                <div className="text-xs text-slate-400">No port groups yet. Add one above.</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateDialog(false)
                  resetDialog()
                }}
                className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomToLibrary}
                className="rounded bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500"
                title="Save to custom library for re-use"
              >
                Save to Library
              </button>
              <button
                type="button"
                onClick={saveCustomAndPlace}
                className="rounded bg-emerald-600 px-3 py-1 text-sm hover:bg-emerald-500"
                title="Save and drop one on the canvas"
              >
                Save + Place
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
