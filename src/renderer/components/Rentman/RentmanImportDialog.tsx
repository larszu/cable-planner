import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useRentman } from '../../hooks/useRentman'
import { useProjectStore } from '../../store/projectStore'
import type { EquipmentItem, EquipmentTemplate, Port } from '../../types/equipment'
import { EquipmentChecklist } from './EquipmentChecklist'
import { NewRentmanDeviceWizard, type UnknownCandidate } from './NewRentmanDeviceWizard'
import { ProjectSelector } from './ProjectSelector'

interface RentmanProject {
  id: string
  name: string
  status?: string
  number?: string | number
  periodStart?: string
  periodEnd?: string
}

interface RentmanEquipment {
  id: string
  equipmentId: string
  name: string
  category: string
  checked: boolean
  qty: number
  isSetChild: boolean
  parentId: string | null
  raw: Record<string, unknown>
}

const mapProjects = (projects: unknown[]): RentmanProject[] =>
  projects.map((item) => {
    const record = item as Record<string, unknown>
    const periodStart =
      (record.usageperiod_start as string) ??
      (record.planperiod_start as string) ??
      (record.equipment_period_from as string) ??
      undefined
    const periodEnd =
      (record.usageperiod_end as string) ??
      (record.planperiod_end as string) ??
      (record.equipment_period_to as string) ??
      undefined
    return {
      id: String(record.id ?? record._id ?? ''),
      name: String(record.name ?? record.displayname ?? 'Unnamed project'),
      status: record.status ? String(record.status) : undefined,
      number: (record.number as string | number | undefined) ?? undefined,
      periodStart,
      periodEnd,
    }
  }).filter((project) => project.id)

const mapPort = (name: string, type: Port['connectorType'] = 'Custom'): Port => ({
  id: uuidv4(),
  name,
  type,
  connectorType: type,
})

const extractId = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  const raw = String(value).trim()
  if (!raw) return ''
  // Rentman sometimes returns relative URLs like "/projectequipment/1234" or "1234".
  const match = raw.match(/(\d+)(?:\/?$)/)
  return match ? match[1] : raw
}

const mapEquipment = (
  equipment: unknown[],
  foldersById: Record<string, string>,
  equipmentNamesById: Record<string, string>,
): RentmanEquipment[] => {
  // First pass: build all rows.
  const rows = equipment.map((item) => {
    const record = item as Record<string, unknown>
    const rowId = extractId(record.id ?? record._id) || uuidv4()
    const equipmentId = extractId(record.equipment) || rowId
    const folderKey = String(
      record.equipmentfolder ??
        record.folder ??
        record.category ??
        record.equipment_folder ??
        '',
    )
    const category = folderKey ? foldersById[folderKey] ?? folderKey : 'Uncategorized'
    const directName = String(record.name ?? record.displayname ?? '').trim()
    const parentRaw =
      record.parent ??
      record.parent_id ??
      record.parentId ??
      record.in_combination ??
      record.combination ??
      null
    const parentId = extractId(parentRaw)
    const hasParent = parentId !== '' && parentId !== rowId
    const qtyRaw = Number(record.quantity ?? record.qty ?? 1)
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.round(qtyRaw) : 1

    return {
      id: rowId,
      equipmentId,
      name: directName || equipmentNamesById[equipmentId] || 'Unnamed equipment',
      category,
      checked: !hasParent,
      qty,
      isSetChild: hasParent,
      parentId: hasParent ? parentId : null,
      raw: record,
    } satisfies RentmanEquipment
  })

  // Second pass: drop dangling parentIds (points to an id that doesn't exist in this list)
  // so those rows behave as top-level items instead of being hidden children.
  const knownIds = new Set(rows.map((r) => r.id))
  return rows.map((r) =>
    r.parentId && !knownIds.has(r.parentId)
      ? { ...r, parentId: null, isSetChild: false, checked: true }
      : r,
  )
}

interface RentmanImportDialogProps {
  open: boolean
  onClose: () => void
}

export const RentmanImportDialog = ({ open, onClose }: RentmanImportDialogProps) => {
  const { loadProjects, loadProjectEquipment, loadFolders, loadEquipment } = useRentman()
  const importEquipment = useProjectStore((state) => state.importEquipment)
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const addCustomTemplate = useProjectStore((state) => state.addCustomTemplate)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const [projects, setProjects] = useState<RentmanProject[]>([])
  const [projectSort, setProjectSort] = useState<'asc' | 'desc'>('asc')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [items, setItems] = useState<RentmanEquipment[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [loading, setLoading] = useState(false)
  const [wizardQueue, setWizardQueue] = useState<UnknownCandidate[] | null>(null)
  const [wizardTemplates, setWizardTemplates] = useState<Record<string, EquipmentTemplate>>({})
  const [wizardSkipped, setWizardSkipped] = useState<Set<string>>(new Set())

  const allCategories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((item) => set.add(item.category || 'Uncategorized'))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [items])

  const visibleItems = useMemo(() => {
    if (selectedCategories.size === 0) return items
    // Keep an item if its own category matches OR one of its ancestors' does.
    const byId = new Map(items.map((i) => [i.id, i]))
    const categoryFor = (item: RentmanEquipment): string => {
      let cur: RentmanEquipment | undefined = item
      const seen = new Set<string>()
      while (cur && !seen.has(cur.id)) {
        if (cur.category && selectedCategories.has(cur.category)) return cur.category
        seen.add(cur.id)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      return ''
    }
    return items.filter((item) => !!categoryFor(item))
  }, [items, selectedCategories])
  const sortedProjects = useMemo(() => {
    const numeric = (p: RentmanProject) => {
      const n = Number(p.number)
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY
    }
    const copy = [...projects]
    copy.sort((a, b) => {
      const diff = numeric(a) - numeric(b)
      if (diff !== 0) return projectSort === 'asc' ? diff : -diff
      return projectSort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    })
    return copy
  }, [projects, projectSort])
  const checkedCount = useMemo(
    () => visibleItems.filter((item) => item.checked).length,
    [visibleItems],
  )
  const setChildCount = useMemo(() => items.filter((item) => item.isSetChild).length, [items])

  if (!open) {
    return null
  }

  const fetchProjects = async () => {
    setError('')
    setWarning('')
    setLoading(true)
    try {
      const projectData = await loadProjects()
      if (!projectData.length) {
        setError('No projects found for this token/account.')
      }
      setProjects(mapProjects(projectData))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Rentman projects')
    } finally {
      setLoading(false)
    }
  }

  const fetchEquipment = async (projectId: string) => {
    setSelectedProjectId(projectId)
    setError('')
    setWarning('')
    setLoading(true)
    try {
      const [equipmentData, folderData, equipmentMasterData] = await Promise.all([
        loadProjectEquipment(projectId),
        loadFolders(),
        loadEquipment(),
      ])
      const folders = (folderData as Record<string, unknown>[]).reduce<Record<string, string>>((acc, folder) => {
        const key = String(folder.id ?? folder._id ?? '')
        if (!key) {
          return acc
        }
        acc[key] = String(folder.name ?? folder.displayname ?? folder.id)
        return acc
      }, {})

      const equipmentNamesById = (equipmentMasterData as Record<string, unknown>[]).reduce<Record<string, string>>(
        (acc, equipment) => {
          const key = String(equipment.id ?? equipment._id ?? '')
          if (!key) {
            return acc
          }
          acc[key] = String(equipment.name ?? equipment.displayname ?? key)
          return acc
        },
        {},
      )

      const mapped = mapEquipment(equipmentData, folders, equipmentNamesById)
      setItems(mapped)

      // Publish Rentman folder names as known categories for dropdowns everywhere.
      const folderNames = Object.values(folders).filter(Boolean)
      if (folderNames.length) addKnownCategories(folderNames)

      if (!folderData.length) {
        setWarning('No access to equipment folders. Categories use fallback values.')
      }
      if (!mapped.length) {
        setError('No equipment found in this project.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project equipment')
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)))
  }

  const setQty = (id: string, qty: number) => {
    const clean = Math.max(1, Math.min(999, Math.round(qty) || 1))
    setItems((current) => current.map((item) => (item.id === id ? { ...item, qty: clean } : item)))
  }

  const toggleCategory = (cat: string) => {
    setSelectedCategories((current) => {
      const next = new Set(current)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const setAllVisible = (checked: boolean) => {
    const visibleIds = new Set(visibleItems.map((i) => i.id))
    setItems((current) =>
      current.map((item) => (visibleIds.has(item.id) ? { ...item, checked } : item)),
    )
  }

  const placeItems = (selected: RentmanEquipment[], templatesByEquipmentId: Record<string, EquipmentTemplate>) => {
    // Expand each selected row by its quantity into individual nodes on canvas.
    const expanded: RentmanEquipment[] = []
    selected.forEach((item) => {
      const n = Math.max(1, item.qty || 1)
      for (let i = 0; i < n; i += 1) expanded.push(item)
    })
    const toImport: EquipmentItem[] = expanded.map((item, index) => {
      const template =
        templatesByEquipmentId[item.equipmentId] ||
        customLibrary.find((t) => t.name === item.name) || {
          name: item.name,
          category: item.category,
          inputs: [mapPort('Input 1')],
          outputs: [mapPort('Output 1')],
          width: 220,
          height: 140,
        }
      return {
        id: uuidv4(),
        name: template.name,
        category: template.category || item.category,
        rentmanId: item.equipmentId,
        inputs: template.inputs.map((p) => ({ ...p, id: uuidv4() })),
        outputs: template.outputs.map((p) => ({ ...p, id: uuidv4() })),
        x: 120 + (index % 5) * 260,
        y: 120 + Math.floor(index / 5) * 180,
        width: template.width ?? 220,
        height: template.height ?? 140,
      }
    })
    importEquipment(toImport)
  }

  const handleImport = () => {
    const selected = visibleItems.filter((item) => item.checked)
    if (selected.length === 0) return

    const knownNames = new Set(customLibrary.map((t) => t.name))
    const unknownMap = new Map<string, UnknownCandidate>()
    selected.forEach((item) => {
      if (knownNames.has(item.name)) return
      if (unknownMap.has(item.equipmentId)) return
      unknownMap.set(item.equipmentId, {
        rentmanId: item.equipmentId,
        name: item.name,
        category: item.category,
      })
    })

    if (unknownMap.size === 0) {
      placeItems(selected, {})
      onClose()
      return
    }

    setWizardQueue(Array.from(unknownMap.values()))
    setWizardTemplates({})
    setWizardSkipped(new Set())
  }

  const completeImportAfterWizard = (
    templates: Record<string, EquipmentTemplate>,
    skipped: Set<string>,
  ) => {
    const selected = visibleItems.filter((item) => item.checked)
    // Use saved templates by rentmanId. For skipped items or ones not in wizard,
    // the placeItems fallback already handles the name-match or generic case.
    void skipped
    placeItems(selected, templates)
    setWizardQueue(null)
    setWizardTemplates({})
    setWizardSkipped(new Set())
    onClose()
  }

  const handleWizardSave = (candidate: UnknownCandidate, template: EquipmentTemplate) => {
    addCustomTemplate(template)
    const nextTemplates = { ...wizardTemplates, [candidate.rentmanId]: template }
    setWizardTemplates(nextTemplates)
    if (wizardQueue && candidate === wizardQueue[wizardQueue.length - 1]) {
      completeImportAfterWizard(nextTemplates, wizardSkipped)
    }
  }

  const handleWizardSkip = (candidate: UnknownCandidate) => {
    const nextSkipped = new Set(wizardSkipped)
    nextSkipped.add(candidate.rentmanId)
    setWizardSkipped(nextSkipped)
    if (wizardQueue && candidate === wizardQueue[wizardQueue.length - 1]) {
      completeImportAfterWizard(wizardTemplates, nextSkipped)
    }
  }

  const handleWizardCancel = () => {
    setWizardQueue(null)
    setWizardTemplates({})
    setWizardSkipped(new Set())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div className="w-full max-w-3xl rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Import from Rentman</h3>
          <button type="button" onClick={onClose} className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600">
            Close
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button type="button" onClick={fetchProjects} className="rounded bg-sky-600 px-3 py-1 text-sm hover:bg-sky-500">
            Load Projects
          </button>
          <button
            type="button"
            onClick={() => setProjectSort((s) => (s === 'asc' ? 'desc' : 'asc'))}
            className="rounded bg-slate-700 px-3 py-1 text-sm hover:bg-slate-600"
            title="Toggle project number sort order"
          >
            Sort # {projectSort === 'asc' ? '↑' : '↓'}
          </button>
          <ProjectSelector projects={sortedProjects} selectedProjectId={selectedProjectId} onSelect={fetchEquipment} />
        </div>

        {loading && <div className="mb-2 text-sm text-slate-300">Loading…</div>}
        {error && <div className="mb-2 rounded bg-red-900/50 p-2 text-sm text-red-100">{error}</div>}
        {warning && <div className="mb-2 rounded bg-amber-900/40 p-2 text-sm text-amber-100">{warning}</div>}

        {items.length > 0 && (
          <>
            {allCategories.length > 1 && (
              <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
                <span className="mr-1 text-slate-400">Categories:</span>
                <button
                  type="button"
                  onClick={() => setSelectedCategories(new Set())}
                  className={`rounded px-2 py-0.5 ${
                    selectedCategories.size === 0
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  All
                </button>
                {allCategories.map((cat) => {
                  const active = selectedCategories.has(cat)
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`rounded px-2 py-0.5 ${
                        active ? 'bg-sky-600 text-white' : 'bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
              <span>
                {visibleItems.length} of {items.length} shown
                {setChildCount > 0 && ` · ${setChildCount} in sets (expand to view)`}
              </span>
              <span>{checkedCount} selected</span>
            </div>
            <EquipmentChecklist
              items={visibleItems}
              onToggle={toggleItem}
              onSetAll={setAllVisible}
              onQtyChange={setQty}
            />
            <div className="mt-3 flex items-center justify-end text-sm">
              <button
                type="button"
                onClick={handleImport}
                className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
              >
                Import Selected
              </button>
            </div>
          </>
        )}
      </div>
      <NewRentmanDeviceWizard
        open={wizardQueue !== null}
        items={wizardQueue ?? []}
        onSave={handleWizardSave}
        onSkip={handleWizardSkip}
        onCancel={handleWizardCancel}
      />
    </div>
  )
}
