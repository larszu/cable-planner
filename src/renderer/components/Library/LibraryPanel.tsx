import { useMemo, useRef, useState, type ReactNode } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { useRentman } from '../../hooks/useRentman'
import { ALL_CONNECTOR_TYPES } from '../../types/equipment'
import type { ConnectorType, EquipmentTemplate, Port } from '../../types/equipment'
import { nextPlacementPosition } from '../../lib/library'
import {
  clearNetBoxIndexCache,
  importNetBoxDeviceType,
  searchNetBoxDeviceTypes,
  type NetBoxDeviceTypeSearchResult,
} from '../../lib/netboxImport'
import { RackBuilderDialog } from '../Rack/RackBuilderDialog'
import { TemplateMergeDialog } from './TemplateMergeDialog'
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
  const openRentmanImport = useUiStore((state) => state.openRentmanImport)
  const toggleTemplateHidden = useProjectStore((state) => state.toggleTemplateHidden)
  const setCustomTemplateCategory = useProjectStore((state) => state.setCustomTemplateCategory)
  const updateCustomTemplate = useProjectStore((state) => state.updateCustomTemplate)
  const setSelectedTemplateName = useProjectStore((state) => state.setSelectedTemplateName)
  const knownCategories = useProjectStore((state) => state.knownCategories)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const groupPresets = useProjectStore((state) => state.groupPresets)
  const addGroupPreset = useProjectStore((state) => state.addGroupPreset)
  const deleteGroupPreset = useProjectStore((state) => state.deleteGroupPreset)
  const placeGroupPreset = useProjectStore((state) => state.placeGroupPreset)
  const canvasState = useProjectStore((state) => state.project.canvasState)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showNetBoxDialog, setShowNetBoxDialog] = useState(false)
  const [showRackBuilderDialog, setShowRackBuilderDialog] = useState(false)
  const [name, setName] = useState('Custom Device')
  const [category, setCategory] = useState('Kameras')
  const [isRackDeviceDraft, setIsRackDeviceDraft] = useState(false)
  const [rackUnitsDraft, setRackUnitsDraft] = useState<number | ''>('')
  const [groups, setGroups] = useState<PortGroupDraft[]>([
    defaultGroup('in'),
    defaultGroup('out'),
  ])
  const [tab, setTab] = useState<'equipment' | 'cables' | 'groups' | 'racks'>('equipment')
  // Equipment sub-section: separates local templates from Rentman-imported ones
  // inside one shared tab, so the user always lives in "Equipment" and just
  // toggles the source.
  const [equipmentSection, setEquipmentSection] = useState<'local' | 'rentman'>('rentman')
  const [rentmanView, setRentmanView] = useState<'imported' | 'catalog' | 'sync'>('imported')
  // Category management state
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [collapsedRentmanProjects, setCollapsedRentmanProjects] = useState<Set<string>>(new Set())
  const [collapsedRentmanCats, setCollapsedRentmanCats] = useState<Set<string>>(new Set())
  const [showEmpty, setShowEmpty] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const newGroupInputRef = useRef<HTMLInputElement>(null)

  // Currently linked Rentman project (from project metadata).
  const linkedRentmanProjectId = useProjectStore(
    (state) => state.project.metadata.rentmanProjectId,
  )
  const linkedRentmanProjectName = useProjectStore(
    (state) => state.project.metadata.rentmanProjectName,
  )

  // Rentman master catalog: every device available in the user's Rentman
  // account (not just the ones already in the active project). Loaded on
  // demand so we don't blow the API budget on every panel render.
  const { loadEquipment: loadRentmanEquipment, loadFolders: loadRentmanFolders, addProjectEquipment } = useRentman()
  const [rentmanCatalog, setRentmanCatalog] = useState<
    { id: string; name: string; category: string; folderId: string | null }[]
  >([])
  const [rentmanFolderTree, setRentmanFolderTree] = useState<
    Record<string, { id: string; name: string; parentId: string | null }>
  >({})
  const [collapsedCatalogFolders, setCollapsedCatalogFolders] = useState<Set<string>>(new Set())
  const [rentmanCatalogError, setRentmanCatalogError] = useState<string | null>(null)
  const [rentmanCatalogLoading, setRentmanCatalogLoading] = useState(false)
  const [rentmanCatalogLoaded, setRentmanCatalogLoaded] = useState(false)
  const [rentmanCatalogQuery, setRentmanCatalogQuery] = useState('')
  const [rentmanCatalogCollapsed, setRentmanCatalogCollapsed] = useState(true)
  const [rentmanCatalogAddBusy, setRentmanCatalogAddBusy] = useState<string | null>(null)
  const [netBoxQuery, setNetBoxQuery] = useState('')
  const [netBoxResults, setNetBoxResults] = useState<NetBoxDeviceTypeSearchResult[]>([])
  const [netBoxBusy, setNetBoxBusy] = useState(false)
  const [netBoxError, setNetBoxError] = useState<string | null>(null)
  const [netBoxImportBusy, setNetBoxImportBusy] = useState<string | null>(null)
  const [netBoxCategoryByPath, setNetBoxCategoryByPath] = useState<Record<string, string>>({})
  const [netBoxConflict, setNetBoxConflict] = useState<
    { existing: EquipmentTemplate; incoming: EquipmentTemplate } | null
  >(null)
  const [netBoxMergePair, setNetBoxMergePair] = useState<
    { existing: EquipmentTemplate; incoming: EquipmentTemplate } | null
  >(null)

  const existingCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...knownCategories,
          ...customLibrary.map((template) => template.category).filter(Boolean),
        ]),
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [knownCategories, customLibrary],
  )

  const fetchRentmanCatalog = async () => {
    setRentmanCatalogLoading(true)
    setRentmanCatalogError(null)
    try {
      const [equipmentData, folderData] = await Promise.all([
        loadRentmanEquipment(),
        loadRentmanFolders(),
      ])
      const folderRecords = folderData as Record<string, unknown>[]
      const folderTree: Record<string, { id: string; name: string; parentId: string | null }> = {}
      const folders = folderRecords.reduce<Record<string, string>>((acc, folder) => {
        const key = String(folder.id ?? folder._id ?? '')
        if (!key) return acc
        const name = String(folder.name ?? folder.displayname ?? key)
        acc[key] = name
        const rawParent = (folder.parent ?? folder.equipmentfolder ?? folder.parent_id ?? null) as unknown
        let parentId: string | null = null
        if (rawParent !== null && rawParent !== undefined && rawParent !== '') {
          const s = String(rawParent)
          const match = s.match(/(\d+)\s*$/)
          parentId = match ? match[1] : null
        }
        folderTree[key] = { id: key, name, parentId }
        return acc
      }, {})
      setRentmanFolderTree(folderTree)
      const mapped = (equipmentData as Record<string, unknown>[])
        .map((rec) => {
          const id = String(rec.id ?? rec._id ?? '')
          if (!id) return null
          const name = String(rec.name ?? rec.displayname ?? `Equipment ${id}`)
          const rawFolder = (rec.equipmentfolder ?? rec.folder ?? rec.category ?? '') as unknown
          let folderId: string | null = null
          if (rawFolder !== null && rawFolder !== undefined && rawFolder !== '') {
            const s = String(rawFolder)
            const match = s.match(/(\d+)\s*$/)
            folderId = match ? match[1] : s || null
          }
          const category = folderId && folders[folderId] ? folders[folderId] : 'Uncategorized'
          return { id, name, category, folderId }
        })
        .filter((row): row is { id: string; name: string; category: string; folderId: string | null } => row !== null)
      mapped.sort((a, b) => a.name.localeCompare(b.name))
      setRentmanCatalog(mapped)
      setRentmanCatalogLoaded(true)
    } catch (err) {
      setRentmanCatalogError(err instanceof Error ? err.message : 'Laden fehlgeschlagen')
    } finally {
      setRentmanCatalogLoading(false)
    }
  }

  const handleAddCatalogItemToProject = async (item: {
    id: string
    name: string
    category: string
  }) => {
    if (!linkedRentmanProjectId) return
    const projectName = linkedRentmanProjectName ?? 'aktivem Rentman-Projekt'
    if (
      !window.confirm(
        `Gerät "${item.name}" wirklich dem ${projectName} in Rentman hinzufügen?\n\nDas ändert dein Rentman-Projekt und ist nicht automatisch reversibel.`,
      )
    ) {
      return
    }
    setRentmanCatalogAddBusy(item.id)
    try {
      await addProjectEquipment(linkedRentmanProjectId, item.id, 1)
      window.alert(`"${item.name}" wurde zu Rentman-Projekt hinzugefügt.`)
    } catch (err) {
      window.alert(
        `Fehler beim Hinzufügen zu Rentman:\n\n${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setRentmanCatalogAddBusy(null)
    }
  }

  const nextPosition = useMemo(
    () => nextPlacementPosition(equipmentCount, equipmentItems),
    [equipmentCount, equipmentItems],
  )

  const rackBuilderTemplates = useMemo<EquipmentTemplate[]>(() => {
    const byName = new Map<string, EquipmentTemplate>()
    for (const template of customLibrary) {
      byName.set(template.name, template)
    }
    // Include current canvas devices as ad-hoc templates so enabling
    // "Ist ein 19\" Rack-Gerat" in properties makes them immediately
    // available in the rack builder without a separate library save step.
    for (const item of equipmentItems) {
      if (!item.isRackDevice && !item.rackUnits) continue
      const { id, x, y, ...template } = item
      void id
      void x
      void y
      byName.set(template.name, template)
    }
    return Array.from(byName.values())
  }, [customLibrary, equipmentItems])

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
    setIsRackDeviceDraft(false)
    setRackUnitsDraft('')
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
      isRackDevice: isRackDeviceDraft,
      rackUnits: isRackDeviceDraft ? (rackUnitsDraft === '' ? 1 : rackUnitsDraft) : undefined,
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

  const handleSearchNetBox = async () => {
    setNetBoxBusy(true)
    setNetBoxError(null)
    try {
      const results = await searchNetBoxDeviceTypes(netBoxQuery)
      setNetBoxResults(results)
      setNetBoxCategoryByPath((current) => {
        const next = { ...current }
        for (const item of results) {
          if (!next[item.path]) next[item.path] = ''
        }
        return next
      })
    } catch (error) {
      setNetBoxError(error instanceof Error ? error.message : String(error))
    } finally {
      setNetBoxBusy(false)
    }
  }

  const handleImportNetBox = async (item: NetBoxDeviceTypeSearchResult) => {
    const selectedCategory = (netBoxCategoryByPath[item.path] ?? '').trim()
    if (!selectedCategory) {
      setNetBoxError('Bitte eine bestehende Kategorie fur diesen Import auswahlen.')
      return
    }
    setNetBoxImportBusy(item.path)
    setNetBoxError(null)
    try {
      const template = { ...(await importNetBoxDeviceType(item)), category: selectedCategory }
      const existing = customLibrary.find((entry) => entry.name === template.name)
      if (existing) {
        setNetBoxConflict({ existing, incoming: template })
        return
      }
      persistCategory(template)
      addCustomTemplate(template)
      setNetBoxResults((current) => current.filter((entry) => entry.path !== item.path))
      window.alert(`✓ ${template.name} aus NetBox importiert.`)
    } catch (error) {
      setNetBoxError(error instanceof Error ? error.message : String(error))
    } finally {
      setNetBoxImportBusy(null)
    }
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
          {customLibrary.filter((t) => t.rentmanSource).length > 0 && (
            <span
              className="ml-1 rounded-full bg-orange-700 px-1 text-[10px]"
              title={`${customLibrary.filter((t) => t.rentmanSource).length} Geräte aus Rentman importiert`}
            >
              {customLibrary.filter((t) => t.rentmanSource).length}R
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
        <button
          type="button"
          onClick={() => setTab('racks')}
          className={`rounded px-2 py-1 ${tab === 'racks' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          title="2D Rack Builder und gespeicherte Rack-Layouts"
        >
          Racks
          {groupPresets.filter((preset) => !!preset.rack).length > 0 && (
            <span className="ml-1 rounded-full bg-sky-900 px-1 text-[10px]">{groupPresets.filter((preset) => !!preset.rack).length}</span>
          )}
        </button>
      </div>

      {tab === 'equipment' && (
        <>
          {/* Sub-section toggle: Lokal vs. Rentman, both inside the Equipment tab */}
          <div className="mb-2 flex gap-1 rounded bg-slate-950/40 p-1">
            <button
              type="button"
              onClick={() => setEquipmentSection('local')}
              className={`flex-1 rounded px-2 py-1 text-xs ${
                equipmentSection === 'local'
                  ? 'bg-sky-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Eigene und importierte Vorlagen, lokal in dieser Installation"
            >
              <span className="mr-1 rounded bg-sky-900/80 px-1 text-[9px] font-bold text-sky-100">L</span>
              Lokal
              <span className="ml-1 text-[10px] text-slate-400">
                ({customLibrary.filter((t) => !t.rentmanSource).length})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setEquipmentSection('rentman')}
              className={`flex-1 rounded px-2 py-1 text-xs ${
                equipmentSection === 'rentman'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Aus Rentman importierte Geräte und Account-Katalog"
            >
              <span className="mr-1 rounded bg-orange-900/80 px-1 text-[9px] font-bold text-orange-100">R</span>
              Rentman
              <span className="ml-1 text-[10px] text-slate-400">
                ({customLibrary.filter((t) => t.rentmanSource).length})
              </span>
            </button>
          </div>
        </>
      )}
      {tab === 'equipment' && equipmentSection === 'local' && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-sm font-semibold">Lokale Library</h2>
              <span
                className="rounded bg-sky-800/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-100"
                title="Eigene und importierte Vorlagen, die in dieser Cable-Planner-Installation gespeichert sind"
              >
                Lokal
              </span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setShowNetBoxDialog(true)}
                className="rounded bg-cyan-700 px-2 py-1 text-xs hover:bg-cyan-600"
                title="Geräte aus der NetBox device-type-library importieren"
              >
                + NetBox
              </button>
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
            <div className="flex flex-wrap gap-2">
              {(() => {
                const usedCats = new Set(customLibrary.map((t) => t.category || 'Sonstiges'))
                const allCats = Array.from(new Set([...knownCategories, ...usedCats])).filter(Boolean)
                const allCollapsed = allCats.length > 0 && allCats.every((cat) => collapsedCats.has(cat))
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (allCollapsed) setCollapsedCats(new Set())
                      else setCollapsedCats(new Set(allCats))
                    }}
                    className="underline hover:text-slate-300"
                    title={allCollapsed ? 'Alle Kategorien ausklappen' : 'Alle Kategorien einklappen'}
                  >
                    {allCollapsed ? 'Alle ausklappen' : 'Alle einklappen'}
                  </button>
                )
              })()}
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

      {tab === 'equipment' && equipmentSection === 'rentman' && (() => {
        const rentmanItems = customLibrary.filter((template) => template.rentmanSource)
        const projectMap = new Map<
          string,
          { id: string; name: string; items: typeof rentmanItems }
        >()
        for (const template of rentmanItems) {
          const id = template.rentmanSource ?? '__unknown__'
          const name = template.rentmanProjectName ?? `Projekt #${id}`
          if (!projectMap.has(id)) projectMap.set(id, { id, name, items: [] })
          projectMap.get(id)!.items.push(template)
        }
        if (linkedRentmanProjectId && !projectMap.has(linkedRentmanProjectId)) {
          projectMap.set(linkedRentmanProjectId, {
            id: linkedRentmanProjectId,
            name: linkedRentmanProjectName ?? `Projekt #${linkedRentmanProjectId}`,
            items: [],
          })
        }
        const projectGroups = Array.from(projectMap.values()).sort((a, b) => {
          if (a.id === linkedRentmanProjectId) return -1
          if (b.id === linkedRentmanProjectId) return 1
          return a.name.localeCompare(b.name)
        })
        const untracked = equipmentItems.filter((equipment) => !equipment.rentmanId)
        const removed = equipmentItems.filter((equipment) => equipment.rentmanRemoved)
        const linkedImportedCount = linkedRentmanProjectId
          ? projectGroups.find((group) => group.id === linkedRentmanProjectId)?.items.length ?? 0
          : 0

        const toggleProject = (id: string) =>
          setCollapsedRentmanProjects((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        const toggleRentmanCat = (key: string) =>
          setCollapsedRentmanCats((prev) => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
          })

        return (
          <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-auto">
            {linkedRentmanProjectId ? (
              <div className="rounded border border-orange-600/60 bg-orange-900/20 p-2">
                <div className="text-[10px] uppercase tracking-wider text-orange-300/80">
                  Aktuell verknüpftes Rentman-Projekt
                </div>
                <div className="mt-0.5 truncate text-sm font-semibold text-orange-200">
                  {linkedRentmanProjectName ?? `Projekt #${linkedRentmanProjectId}`}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-orange-100/80">
                  <span className="rounded bg-orange-950/50 px-1.5 py-0.5">{linkedImportedCount} importiert</span>
                  <span className="rounded bg-orange-950/50 px-1.5 py-0.5">{untracked.length} ohne Rentman-ID</span>
                  {removed.length > 0 && (
                    <span className="rounded bg-red-950/50 px-1.5 py-0.5 text-red-200">{removed.length} entfernt</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded border border-slate-700 bg-slate-900/50 p-2 text-xs text-slate-400">
                <div className="mb-2">Kein Rentman-Projekt verknüpft.</div>
                <button
                  type="button"
                  onClick={openRentmanImport}
                  className="w-full rounded bg-orange-700 px-2 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                  title="Rentman-Projekt auswählen und mit dieser Plan-Datei verknüpfen"
                >
                  Rentman-Projekt verknüpfen…
                </button>
              </div>
            )}

            <div className="grid grid-cols-3 rounded border border-slate-800 bg-slate-900 p-0.5 text-[11px]">
              {([
                ['imported', 'Importiert'],
                ['catalog', 'Katalog'],
                ['sync', 'Abgleich'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRentmanView(id)}
                  className={`rounded px-2 py-1 font-medium ${
                    rentmanView === id
                      ? 'bg-orange-700 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {rentmanView === 'imported' && (
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
                  <h2 className="text-sm font-semibold">Importierte Rentman-Geräte</h2>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    {(() => {
                      const projectIds = new Set(projectGroups.map((group) => group.id))
                      const categoryKeys = new Set<string>()
                      for (const group of projectGroups) {
                        const categories = new Set(group.items.map((template) => template.category || 'Sonstiges'))
                        for (const category of categories) categoryKeys.add(`${group.id}::${category}`)
                      }
                      const allCollapsed =
                        Array.from(projectIds).every((id) => collapsedRentmanProjects.has(id)) &&
                        Array.from(categoryKeys).every((key) => collapsedRentmanCats.has(key))
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (allCollapsed) {
                              setCollapsedRentmanProjects(new Set())
                              setCollapsedRentmanCats(new Set())
                            } else {
                              setCollapsedRentmanProjects(projectIds)
                              setCollapsedRentmanCats(categoryKeys)
                            }
                          }}
                          className="underline hover:text-slate-300"
                        >
                          {allCollapsed ? 'Alle ausklappen' : 'Alle einklappen'}
                        </button>
                      )
                    })()}
                    <span>{rentmanItems.length} Geräte</span>
                  </div>
                </div>
                {projectGroups.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 p-3 text-center text-xs text-slate-500">
                    <span className="text-2xl">📦</span>
                    <span>Noch keine Rentman-Geräte importiert.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectGroups.map((group) => {
                      const isLinked = group.id === linkedRentmanProjectId
                      const projectCollapsed = collapsedRentmanProjects.has(group.id)
                      const categories = Array.from(
                        new Set(group.items.map((template) => template.category || 'Sonstiges')),
                      ).sort()
                      return (
                        <section
                          key={group.id}
                          className={`rounded border ${
                            isLinked
                              ? 'border-orange-600/60 bg-orange-900/10'
                              : 'border-slate-700 bg-slate-900/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleProject(group.id)}
                            className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left ${
                              isLinked
                                ? 'text-orange-200 hover:bg-orange-900/20'
                                : 'text-slate-300 hover:bg-slate-800/40'
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="text-xs">{projectCollapsed ? '▶' : '▼'}</span>
                              {isLinked && (
                                <span className="rounded bg-orange-700 px-1 text-[9px] font-bold text-white">AKTIV</span>
                              )}
                              <span className="truncate text-xs font-semibold">{group.name}</span>
                            </span>
                            <span className="text-[10px] text-slate-500">{group.items.length} Geräte</span>
                          </button>
                          {!projectCollapsed && (
                            <div className="space-y-1 border-t border-slate-800 px-1 py-1">
                              {categories.length === 0 ? (
                                <div className="px-2 py-1 text-[11px] italic text-slate-500">Keine Geräte importiert.</div>
                              ) : (
                                categories.map((category) => {
                                  const categoryKey = `${group.id}::${category}`
                                  const categoryCollapsed = collapsedRentmanCats.has(categoryKey)
                                  const categoryItems = group.items.filter((template) => (template.category || 'Sonstiges') === category)
                                  return (
                                    <div key={categoryKey} className="rounded border border-slate-800/80">
                                      <button
                                        type="button"
                                        onClick={() => toggleRentmanCat(categoryKey)}
                                        className="flex w-full items-center justify-between gap-1 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 hover:text-slate-200"
                                      >
                                        <span className="flex items-center gap-1">
                                          <span>{categoryCollapsed ? '▶' : '▼'}</span>
                                          <span>{category}</span>
                                        </span>
                                        <span className="font-normal text-slate-600">({categoryItems.length})</span>
                                      </button>
                                      {!categoryCollapsed && (
                                        <div className="space-y-1 px-1 pb-1">
                                          {categoryItems
                                            .slice()
                                            .sort((a, b) => a.name.localeCompare(b.name))
                                            .map((item) => (
                                              <LibraryItem
                                                key={item.name}
                                                item={item}
                                                onAdd={() => {
                                                  addEquipment({
                                                    ...item,
                                                    ...nextPlacementPosition(equipmentCount, equipmentItems),
                                                  })
                                                }}
                                              />
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              )}
                            </div>
                          )}
                        </section>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {rentmanView === 'catalog' && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setRentmanCatalogCollapsed((value) => !value)}
                    className="flex flex-1 items-center gap-1 text-left text-sm font-semibold text-slate-200 hover:text-white"
                    title="Alle in deinem Rentman-Account angelegten Equipments (Account-Katalog), gegliedert nach der Rentman-Ordnerstruktur"
                  >
                    <span className="text-xs">{rentmanCatalogCollapsed ? '▶' : '▼'}</span>
                    <span>Alle Rentman-Equipments (Account-Katalog)</span>
                    {rentmanCatalogLoaded && (
                      <span className="ml-1 rounded-full bg-slate-800 px-1.5 text-[10px] text-slate-400">{rentmanCatalog.length}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={fetchRentmanCatalog}
                    disabled={rentmanCatalogLoading}
                    className="rounded bg-orange-700 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {rentmanCatalogLoading ? '…' : rentmanCatalogLoaded ? 'Aktualisieren' : 'Katalog laden'}
                  </button>
                </div>

                {!rentmanCatalogCollapsed && (
                  <>
                    {rentmanCatalogError && (
                      <div className="mb-2 rounded border border-red-700/60 bg-red-900/30 px-2 py-1 text-[11px] text-red-200">{rentmanCatalogError}</div>
                    )}
                    {!rentmanCatalogLoaded && !rentmanCatalogLoading && !rentmanCatalogError && (
                      <div className="rounded border border-slate-700/60 bg-slate-900/40 p-2 text-center text-[11px] text-slate-500">
                        Noch nicht geladen. Klick „Katalog laden", um den gesamten Rentman-Katalog deines Accounts anzuzeigen.
                      </div>
                    )}
                    {rentmanCatalogLoaded && (
                      <>
                        <input
                          type="text"
                          value={rentmanCatalogQuery}
                          onChange={(event) => setRentmanCatalogQuery(event.target.value)}
                          placeholder="Suchen…"
                          className="mb-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
                        />
                        {(() => {
                          const importedIds = new Set(
                            customLibrary.filter((template) => !!template.rentmanId).map((template) => String(template.rentmanId)),
                          )
                          const query = rentmanCatalogQuery.trim().toLowerCase()
                          const filtered = rentmanCatalog
                            .filter((item) => !importedIds.has(item.id))
                            .filter((item) =>
                              !query
                                ? true
                                : item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query),
                            )
                          if (filtered.length === 0) {
                            return (
                              <div className="rounded border border-emerald-700/40 bg-emerald-900/10 p-2 text-center text-[11px] text-emerald-300">
                                ✓ Alle verfügbaren Rentman-Geräte sind bereits importiert.
                              </div>
                            )
                          }

                          const renderItem = (item: { id: string; name: string; category: string }) => {
                            const busy = rentmanCatalogAddBusy === item.id
                            return (
                              <div key={item.id} className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/40 px-2 py-1.5 text-xs">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate font-medium text-slate-200">{item.name}</div>
                                  <div className="truncate text-[10px] text-slate-500">Rentman-ID {item.id}</div>
                                </div>
                                {linkedRentmanProjectId && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddCatalogItemToProject(item)}
                                    disabled={busy}
                                    className="rounded bg-orange-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                                  >
                                    {busy ? '…' : '+ Projekt'}
                                  </button>
                                )}
                              </div>
                            )
                          }

                          // While searching, show a flat result list (no tree noise).
                          if (query) {
                            return <div className="space-y-1">{filtered.map(renderItem)}</div>
                          }

                          // Build folder tree from the loaded folder records.
                          const folders = rentmanFolderTree
                          const folderIds = Object.keys(folders)
                          const childMap = new Map<string | null, string[]>()
                          for (const fid of folderIds) {
                            const parentId = folders[fid].parentId
                            const parentKey = parentId && folders[parentId] ? parentId : null
                            const list = childMap.get(parentKey) ?? []
                            list.push(fid)
                            childMap.set(parentKey, list)
                          }
                          for (const list of childMap.values()) {
                            list.sort((a, b) => folders[a].name.localeCompare(folders[b].name))
                          }

                          // Group catalog items by their folderId.
                          const itemsByFolder = new Map<string | null, typeof filtered>()
                          for (const item of filtered) {
                            const key = item.folderId && folders[item.folderId] ? item.folderId : null
                            const list = itemsByFolder.get(key) ?? []
                            list.push(item)
                            itemsByFolder.set(key, list)
                          }

                          // Count items recursively (folder + all descendants).
                          const countCache = new Map<string, number>()
                          const countItems = (folderId: string): number => {
                            const cached = countCache.get(folderId)
                            if (cached !== undefined) return cached
                            let total = itemsByFolder.get(folderId)?.length ?? 0
                            for (const child of childMap.get(folderId) ?? []) total += countItems(child)
                            countCache.set(folderId, total)
                            return total
                          }

                          const toggleFolder = (id: string) =>
                            setCollapsedCatalogFolders((prev) => {
                              const next = new Set(prev)
                              if (next.has(id)) next.delete(id)
                              else next.add(id)
                              return next
                            })

                          const renderFolder = (folderId: string, depth: number): ReactNode => {
                            const folder = folders[folderId]
                            const collapsed = collapsedCatalogFolders.has(folderId)
                            const total = countItems(folderId)
                            if (total === 0) return null
                            const folderItems = (itemsByFolder.get(folderId) ?? [])
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                            const childIds = childMap.get(folderId) ?? []
                            return (
                              <div key={folderId} className="rounded border border-slate-800/80">
                                <button
                                  type="button"
                                  onClick={() => toggleFolder(folderId)}
                                  className="flex w-full items-center justify-between gap-1 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-300 hover:text-slate-100"
                                  style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
                                >
                                  <span className="flex items-center gap-1">
                                    <span>{collapsed ? '▶' : '▼'}</span>
                                    <span>📁</span>
                                    <span>{folder.name}</span>
                                  </span>
                                  <span className="font-normal text-slate-500">({total})</span>
                                </button>
                                {!collapsed && (
                                  <div className="space-y-1 px-1 pb-1">
                                    {folderItems.length > 0 && (
                                      <div className="space-y-1" style={{ paddingLeft: `${(depth + 1) * 0.75}rem` }}>
                                        {folderItems.map(renderItem)}
                                      </div>
                                    )}
                                    {childIds.map((child) => renderFolder(child, depth + 1))}
                                  </div>
                                )}
                              </div>
                            )
                          }

                          const rootFolderIds = childMap.get(null) ?? []
                          const orphans = (itemsByFolder.get(null) ?? [])
                            .slice()
                            .sort((a, b) => a.name.localeCompare(b.name))

                          return (
                            <div className="space-y-2">
                              {rootFolderIds.map((id) => renderFolder(id, 0))}
                              {orphans.length > 0 && (
                                <div className="rounded border border-slate-800/80">
                                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                    Ohne Ordner <span className="font-normal text-slate-600">({orphans.length})</span>
                                  </div>
                                  <div className="space-y-1 px-2 pb-1">{orphans.map(renderItem)}</div>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {rentmanView === 'sync' && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-amber-300">Abgleich Canvas ↔ Rentman</h2>
                  <span className="text-[10px] text-slate-500">{untracked.length} nicht erfasst</span>
                </div>
                {removed.length > 0 && (
                  <div className="mb-2 space-y-1">
                    <div className="mb-1 text-[10px] text-red-400">Nicht mehr in Rentman vorhanden:</div>
                    {removed.map((equipment) => (
                      <div key={equipment.id} className="flex items-center justify-between rounded border border-red-700/50 bg-red-900/20 px-2 py-1 text-xs">
                        <div>
                          <span className="font-medium text-slate-100">{equipment.name}</span>
                          <span className="ml-1 text-[10px] text-slate-500">{equipment.category}</span>
                        </div>
                        <span className="text-[10px] text-red-400">entfernt</span>
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
                    {untracked.map((equipment) => (
                      <div key={equipment.id} className="flex items-center justify-between rounded border border-amber-700/30 bg-amber-900/10 px-2 py-1 text-xs">
                        <div>
                          <span className="font-medium text-slate-100">{equipment.name}</span>
                          <span className="ml-1 text-[10px] text-slate-500">{equipment.category}</span>
                        </div>
                        <span className="text-[10px] text-amber-500">kein Rentman-ID</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
                const totalRackUnits = preset.items.reduce((sum, item) => sum + (item.rackUnits ?? 0), 0)
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
                          {totalRackUnits > 0 ? ` · ${totalRackUnits} HE` : ''}
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

      {tab === 'racks' && (
        <div className="flex flex-1 min-h-0 flex-col">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">2D Rack Builder</h2>
              <div className="text-[10px] text-slate-500">Rack-Slots in HE, als platzierbare Gruppe gespeichert</div>
            </div>
            <button
              type="button"
              onClick={() => setShowRackBuilderDialog(true)}
              className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
            >
              + Neues Rack
            </button>
          </div>

          {groupPresets.filter((preset) => !!preset.rack).length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-xs text-slate-500 text-center p-4">
              <span className="text-2xl">▥</span>
              <span>Noch kein Rack-Layout gespeichert.</span>
            </div>
          ) : (
            <div className="flex-1 min-h-0 space-y-2 overflow-auto">
              {groupPresets
                .filter((preset) => !!preset.rack)
                .map((preset) => {
                  const zoom = canvasState.zoom || 1
                  const cx = (-canvasState.x + 400) / zoom
                  const cy = (-canvasState.y + 250) / zoom
                  const totalUnits = preset.rack?.totalUnits ?? preset.items.reduce((sum, item) => sum + (item.rackUnits ?? 1), 0)
                  return (
                    <div
                      key={preset.id}
                      className="rounded border border-slate-700 bg-slate-900 p-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="font-medium text-slate-100">{preset.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {preset.items.length} Geräte · {totalUnits} HE · {preset.cables.length} Kabel
                          </div>
                          <div className="text-[10px] text-slate-600 mt-0.5 truncate max-w-[180px]">
                            {preset.items.map((i) => i.name).join(', ')}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => placeGroupPreset(preset.id, cx, cy)}
                            className="rounded bg-emerald-700 px-2 py-1 text-[11px] hover:bg-emerald-600"
                          >
                            Platzieren
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Rack \"${preset.name}\" löschen?`)) {
                                deleteGroupPreset(preset.id)
                              }
                            }}
                            className="rounded bg-red-900/60 px-2 py-1 text-[11px] hover:bg-red-800"
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

      {showNetBoxDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">NetBox Import</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Importiert Geräte aus der NetBox device-type-library in die lokale Library. Nicht-destruktiv: bestehende Geräte auf dem Canvas bleiben unverändert.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNetBoxDialog(false)}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                Schließen
              </button>
            </div>

            <div className="mb-3 flex gap-2">
              <input
                value={netBoxQuery}
                onChange={(event) => setNetBoxQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleSearchNetBox()
                  }
                }}
                placeholder="z.B. blackmagic atem, cisco catalyst, yamaha ql5"
                className="flex-1 rounded border border-slate-700 bg-slate-950 p-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleSearchNetBox()}
                disabled={netBoxBusy || netBoxQuery.trim().length < 2}
                className="rounded bg-cyan-700 px-3 py-2 text-sm font-semibold hover:bg-cyan-600 disabled:opacity-50"
              >
                {netBoxBusy ? 'Suche…' : 'Suchen'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearNetBoxIndexCache()
                  setNetBoxResults([])
                }}
                className="rounded bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600"
                title="GitHub-Index neu laden"
              >
                Cache leeren
              </button>
            </div>

            {netBoxError && (
              <div className="mb-3 rounded border border-red-700/60 bg-red-900/30 px-3 py-2 text-xs text-red-100">
                {netBoxError}
              </div>
            )}

            <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">
              Treffer {netBoxResults.length > 0 ? `(${netBoxResults.length})` : ''}
            </div>
            <div className="space-y-2">
              {netBoxResults.length === 0 ? (
                <div className="rounded border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-400">
                  Hersteller + Modell suchen. Beispiel: „blackmagic atem", „yamaha ql5", „cisco catalyst 9300".
                </div>
              ) : (
                netBoxResults.map((item) => {
                  const busy = netBoxImportBusy === item.path
                  return (
                    <div
                      key={item.path}
                      className="flex items-center justify-between gap-3 rounded border border-slate-700 bg-slate-950/50 p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-100">
                          {item.manufacturer} {item.model}
                        </div>
                        <div className="truncate text-[11px] text-slate-500">{item.path}</div>
                        <div className="mt-2 flex max-w-[340px] items-center gap-2">
                          <span className="text-[11px] text-slate-400">Kategorie:</span>
                          <select
                            value={netBoxCategoryByPath[item.path] ?? ''}
                            onChange={(event) =>
                              setNetBoxCategoryByPath((current) => ({
                                ...current,
                                [item.path]: event.target.value,
                              }))
                            }
                            className="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                          >
                            <option value="">Bitte auswahlen...</option>
                            {existingCategoryOptions.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleImportNetBox(item)}
                        disabled={busy || !(netBoxCategoryByPath[item.path] ?? '').trim()}
                        className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {busy ? 'Import…' : 'Importieren'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded border border-slate-700 bg-slate-900 p-4">
            <h3 className="mb-3 text-base font-semibold">Create Custom Device</h3>
            <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
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
                <select
                  value={category}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === '__new__') {
                      const entered = window.prompt('Neue Kategorie')?.trim()
                      if (entered) {
                        setCategory(entered)
                        addKnownCategories([entered])
                      }
                      return
                    }
                    setCategory(value)
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
                >
                  {Array.from(
                    new Set([
                      ...knownCategories,
                      ...customLibrary.map((t) => t.category).filter(Boolean),
                      category,
                    ].filter(Boolean)),
                  )
                    .sort((a, b) => a.localeCompare(b))
                    .map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  <option value="__new__">+ Neue Kategorie…</option>
                </select>
              </label>
              <label className="block">
                19" Rack-Gerät
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={isRackDeviceDraft}
                    onChange={(event) => setIsRackDeviceDraft(event.target.checked)}
                  />
                  <span>Ist Rack-Gerät</span>
                </label>
                {isRackDeviceDraft && (
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={rackUnitsDraft}
                    onChange={(event) => setRackUnitsDraft(event.target.value ? Number(event.target.value) : '')}
                    placeholder="HE"
                    className="mt-2 w-full rounded border border-slate-700 bg-slate-950 p-2"
                  />
                )}
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

      <RackBuilderDialog
        open={showRackBuilderDialog}
        templates={rackBuilderTemplates}
        onClose={() => setShowRackBuilderDialog(false)}
        onSave={(preset) => {
          addGroupPreset(preset)
          setShowRackBuilderDialog(false)
          setTab('racks')
        }}
      />

      {netBoxConflict && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-xl rounded border border-amber-600 bg-slate-900 p-4 text-slate-100">
            <h3 className="mb-2 text-base font-semibold text-amber-300">Gerat existiert bereits</h3>
            <p className="mb-3 text-sm text-slate-300">
              {netBoxConflict.incoming.name} ist bereits in der lokalen Library. Wahlen, wie importiert werden soll.
            </p>
            <div className="mb-3 rounded border border-slate-700 bg-slate-950/40 p-2 text-xs text-slate-400">
              Lokal: {netBoxConflict.existing.inputs.length} In / {netBoxConflict.existing.outputs.length} Out
              <br />
              NetBox: {netBoxConflict.incoming.inputs.length} In / {netBoxConflict.incoming.outputs.length} Out
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNetBoxConflict(null)}
                className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  setNetBoxConflict(null)
                  window.alert('Lokale Version bleibt unverandert.')
                }}
                className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
              >
                Lokal behalten
              </button>
              <button
                type="button"
                onClick={() => {
                  addCustomTemplate(netBoxConflict.incoming)
                  setNetBoxConflict(null)
                  window.alert('NetBox-Version wurde ubernommen.')
                }}
                className="rounded bg-amber-700 px-3 py-1 text-sm hover:bg-amber-600"
              >
                Uberschreiben
              </button>
              <button
                type="button"
                onClick={() => {
                  setNetBoxMergePair(netBoxConflict)
                  setNetBoxConflict(null)
                }}
                className="rounded bg-emerald-700 px-3 py-1 text-sm hover:bg-emerald-600"
              >
                Merge Ports
              </button>
            </div>
          </div>
        </div>
      )}

      <TemplateMergeDialog
        open={!!netBoxMergePair}
        localTemplate={netBoxMergePair?.existing ?? null}
        incomingTemplate={netBoxMergePair?.incoming ?? null}
        incomingLabel="NetBox"
        categoryOptions={existingCategoryOptions}
        initialCategory={netBoxMergePair?.incoming.category}
        onCancel={() => setNetBoxMergePair(null)}
        onConfirm={(merged) => {
          addCustomTemplate(merged)
          setNetBoxMergePair(null)
          window.alert('Merge gespeichert.')
        }}
      />
      </>
      )}
    </aside>
  )
}
