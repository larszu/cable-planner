import { useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType, EquipmentTemplate, Port } from '../../types/equipment'
import { nextPlacementPosition } from '../../lib/library'
import { LibraryItem } from './LibraryItem'
import { CableLibraryPanel } from './CableLibraryPanel'

const connectorOptions = ALL_CONNECTOR_TYPES

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
  const equipmentItems = useProjectStore((state) => state.project.equipment)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const addCustomTemplate = useProjectStore((state) => state.addCustomTemplate)
  const removeCustomTemplate = useProjectStore((state) => state.removeCustomTemplate)
  const toggleTemplateFavorite = useProjectStore((state) => state.toggleTemplateFavorite)
  const collapsed = useUiStore((state) => state.libraryCollapsed)
  const toggleCollapsed = useUiStore((state) => state.toggleLibraryCollapsed)
  const toggleTemplateHidden = useProjectStore((state) => state.toggleTemplateHidden)
  const setCustomTemplateCategory = useProjectStore((state) => state.setCustomTemplateCategory)
  const updateCustomTemplate = useProjectStore((state) => state.updateCustomTemplate)
  const setSelectedTemplateName = useProjectStore((state) => state.setSelectedTemplateName)
  const knownCategories = useProjectStore((state) => state.knownCategories)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const groupPresets = useProjectStore((state) => state.groupPresets)
  const deleteGroupPreset = useProjectStore((state) => state.deleteGroupPreset)
  const placeGroupPreset = useProjectStore((state) => state.placeGroupPreset)
  const canvasState = useProjectStore((state) => state.project.canvasState)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [name, setName] = useState('Custom Device')
  const [category, setCategory] = useState('Kameras')
  const [groups, setGroups] = useState<PortGroupDraft[]>([
    defaultGroup('in'),
    defaultGroup('out'),
  ])
  const [tab, setTab] = useState<'equipment' | 'rentman' | 'cables' | 'groups'>('equipment')
  // Category management state
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [showEmpty, setShowEmpty] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const newGroupInputRef = useRef<HTMLInputElement>(null)

  const nextPosition = useMemo(
    () => nextPlacementPosition(equipmentCount),
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
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-700 bg-slate-950 p-3 text-slate-100">
      {/* ---- collapsed state ---- */}
      {collapsed ? (
        <>
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Library aufklappen"
            className="rounded px-1 py-2 text-slate-300 hover:bg-slate-800"
          >
            ►
          </button>
          <div
            className="mt-4 text-[10px] uppercase tracking-wider text-slate-500"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Library
          </div>
        </>
      ) : (
        <>
      <div className="mb-3 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={toggleCollapsed}
          title="Library einklappen"
          className="rounded px-1 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          ◄
        </button>
        <button
          type="button"
          onClick={() => setTab('equipment')}
          className={`rounded px-2 py-1 ${tab === 'equipment' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Equipment
        </button>
        <button
          type="button"
          onClick={() => setTab('rentman')}
          className={`rounded px-2 py-1 ${tab === 'rentman' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          title="Nur aus Rentman importierte Geräte"
        >
          Rentman
          {customLibrary.filter((t) => t.rentmanSource).length > 0 && (
            <span className="ml-1 rounded-full bg-orange-800 px-1 text-[10px]">
              {customLibrary.filter((t) => t.rentmanSource).length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('cables')}
          className={`rounded px-2 py-1 ${tab === 'cables' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          Cables
        </button>
        <button
          type="button"
          onClick={() => setTab('groups')}
          className={`rounded px-2 py-1 ${tab === 'groups' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          title="Gespeicherte Gerätegruppen (mehrere Geräte + Kabel als Vorlage)"
        >
          Gruppen
          {groupPresets.length > 0 && (
            <span className="ml-1 rounded-full bg-sky-900 px-1 text-[10px]">{groupPresets.length}</span>
          )}
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className="underline hover:text-slate-300"
                title="Ausgeblendete Geräte ein-/ausblenden"
              >
                {showHidden
                  ? `Ausgeblendete verbergen (${customLibrary.filter((t) => t.hidden).length})`
                  : `Ausgeblendete zeigen (${customLibrary.filter((t) => t.hidden).length})`}
              </button>
              <button
                type="button"
                onClick={() => setShowEmpty((v) => !v)}
                className="underline hover:text-slate-300"
              >
                {showEmpty ? 'Leere ausblenden' : 'Leere zeigen'}
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 space-y-1 overflow-auto">
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
                const visibleItems = items.filter((t) => showHidden || !t.hidden)
                if (!showEmpty && visibleItems.length === 0) return null
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
                          items
                            .filter((item) => showHidden || !item.hidden)
                            .slice()
                            .sort((a, b) => {
                              const af = a.favorite ? 0 : 1
                              const bf = b.favorite ? 0 : 1
                              if (af !== bf) return af - bf
                              return a.name.localeCompare(b.name)
                            })
                            .map((item) => (
                            <div key={item.name} className="group/item relative">
                              <LibraryItem
                                item={item}
                                onAdd={() => addEquipment({ ...item, ...nextPosition })}
                                onRemove={() => removeCustomTemplate(item.name)}
                                onToggleFavorite={() => toggleTemplateFavorite(item.name)}
                                onToggleHidden={() => toggleTemplateHidden(item.name)}
                              />
                              {/* Edit button — appears on hover */}
                              <button
                                type="button"
                                onClick={() => setSelectedTemplateName(item.name)}
                                className="absolute right-7 top-1 hidden rounded bg-slate-600 px-1 py-0.5 text-[10px] hover:bg-slate-500 group-hover/item:block"
                                title="Vorlage bearbeiten (Name, Kategorie)"
                              >
                                ✎
                              </button>
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

      {tab === 'rentman' && (() => {
        const rentmanItems = customLibrary.filter((t) => t.rentmanSource)
        const rentmanCategories = Array.from(new Set(rentmanItems.map((t) => t.category || 'Uncategorized'))).sort()
        // Abgleich: canvas items without rentmanId
        const untracked = equipmentItems.filter((e) => !e.rentmanId)
        const removed = equipmentItems.filter((e) => e.rentmanRemoved)
        return (
          <div className="flex flex-1 min-h-0 flex-col gap-4 overflow-auto">
            {/* Library section */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Rentman Geräte (Library)</h2>
                <span className="text-[10px] text-slate-500">{rentmanItems.length} importiert</span>
              </div>
              {rentmanItems.length === 0 ? (
                <div className="flex flex-col items-center gap-2 p-3 text-center text-xs text-slate-500">
                  <span className="text-2xl">📦</span>
                  <span>Noch keine Rentman-Geräte importiert.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {rentmanCategories.map((cat) => {
                    const catItems = rentmanItems.filter((t) => (t.category || 'Uncategorized') === cat)
                    return (
                      <section key={cat}>
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-orange-400">{cat}</div>
                        <div className="space-y-1">
                          {catItems.map((item) => (
                            <LibraryItem
                              key={item.name}
                              item={item}
                              onAdd={() => {
                                addEquipment({ ...item, ...nextPlacementPosition(equipmentCount) })
                              }}
                            />
                          ))}
                        </div>
                      </section>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Abgleich section */}
            <div className="border-t border-slate-700 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-amber-300">⚖ Abgleich Canvas ↔ Rentman</h2>
                <span className="text-[10px] text-slate-500">{untracked.length} nicht erfasst</span>
              </div>
              {removed.length > 0 && (
                <div className="mb-2 space-y-1">
                  <div className="mb-1 text-[10px] text-red-400">
                    Nicht mehr in Rentman vorhanden:
                  </div>
                  {removed.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs"
                    >
                      <div>
                        <span className="font-medium text-slate-100">{e.name}</span>
                        <span className="ml-1 text-[10px] text-slate-500">{e.category}</span>
                      </div>
                      <span className="text-[10px] text-red-400">⚠ entfernt</span>
                    </div>
                  ))}
                </div>
              )}
              {untracked.length === 0 ? (
                <div className="rounded border border-emerald-700/40 bg-emerald-900/10 p-2 text-center text-xs text-emerald-400">
                  ✓ Alle Canvas-Geräte haben eine Rentman-ID.
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="mb-1 text-[10px] text-slate-400">
                    Folgende Geräte auf dem Canvas sind nicht im Rentman-Plan:
                  </div>
                  {untracked.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded border border-amber-700/30 bg-amber-900/10 px-2 py-1 text-xs"
                    >
                      <div>
                        <span className="font-medium text-slate-100">{e.name}</span>
                        <span className="ml-1 text-[10px] text-slate-500">{e.category}</span>
                      </div>
                      <span className="text-[10px] text-amber-500">⚠ kein Rentman-ID</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {tab === 'groups' && (
        <div className="flex flex-1 min-h-0 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Gerätegruppen</h2>
            <span className="text-[10px] text-slate-500">Mehrere Geräte + Kabel als Vorlage</span>
          </div>
          {groupPresets.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 text-center p-4">
              <span className="text-2xl">⧉</span>
              <span>Noch keine Gruppen gespeichert.</span>
              <span>Wähle auf dem Canvas ≥ 2 Geräte aus und klicke <b>Als Gruppe</b> in der Canvas-Toolbar.</span>
            </div>
          ) : (
            <div className="flex-1 min-h-0 space-y-2 overflow-auto">
              {groupPresets.map((preset) => {
                const zoom = canvasState.zoom || 1
                const cx = (-canvasState.x + 400) / zoom
                const cy = (-canvasState.y + 250) / zoom
                return (
                  <div
                    key={preset.id}
                    className="rounded border border-slate-700 bg-slate-900 p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div className="font-medium text-slate-100">{preset.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {preset.items.length} Geräte · {preset.cables.length} Kabel
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5 truncate max-w-[160px]">
                          {preset.items.map((i) => i.name).join(', ')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => placeGroupPreset(preset.id, cx, cy)}
                          className="rounded bg-emerald-700 px-2 py-1 text-[11px] hover:bg-emerald-600"
                          title="Gruppe auf Canvas platzieren"
                        >
                          Platzieren
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Gruppe "${preset.name}" löschen?`)) {
                              deleteGroupPreset(preset.id)
                            }
                          }}
                          className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
                          title="Gruppe löschen"
                        >
                          Löschen
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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
      </>
      )}
    </aside>
  )
}
