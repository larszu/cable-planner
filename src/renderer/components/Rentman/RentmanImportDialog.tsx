import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useRentman } from '../../hooks/useRentman'
import { useProjectStore } from '../../store/projectStore'
import { matchBlackmagicTemplate } from '../../lib/blackmagicCatalog'
import { matchUbiquitiTemplate } from '../../lib/ubiquitiCatalog'
import { matchMonitorTemplate } from '../../lib/monitorCatalog'
import { matchCameraTemplate } from '../../lib/cameraCatalog'
import { matchMiscTemplate } from '../../lib/miscCatalog'
import { matchGreenGoTemplate } from '../../lib/greengoCatalog'
import type { EquipmentTemplate, Port } from '../../types/equipment'
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
      checked: false,
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
      ? { ...r, parentId: null, isSetChild: false }
      : r,
  )
}

interface RentmanImportDialogProps {
  open: boolean
  onClose: () => void
}

export const RentmanImportDialog = ({ open, onClose }: RentmanImportDialogProps) => {
  const { loadProjects, loadProjectEquipment, loadFolders, loadEquipment } = useRentman()
  const customLibrary = useProjectStore((state) => state.customLibrary)
  const projectEquipment = useProjectStore((state) => state.project.equipment)
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const addCustomTemplate = useProjectStore((state) => state.addCustomTemplate)
  const addKnownCategories = useProjectStore((state) => state.addKnownCategories)
  const updateProjectMetadata = useProjectStore((state) => state.updateProjectMetadata)
  const linkedProjectId = useProjectStore((state) => state.project.metadata.rentmanProjectId)
  const linkedProjectName = useProjectStore((state) => state.project.metadata.rentmanProjectName)
  const [projects, setProjects] = useState<RentmanProject[]>([])
  const [projectSort, setProjectSort] = useState<'number-asc' | 'number-desc' | 'date-asc' | 'date-desc'>('number-desc')
  const [projectQuery, setProjectQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [items, setItems] = useState<RentmanEquipment[]>([])
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [loading, setLoading] = useState(false)
  const [wizardQueue, setWizardQueue] = useState<UnknownCandidate[] | null>(null)
  const [wizardTemplates, setWizardTemplates] = useState<Record<string, EquipmentTemplate>>({})
  const [wizardSkipped, setWizardSkipped] = useState<Set<string>>(new Set())
  const [importResult, setImportResult] = useState<number | null>(null)
  const [pendingProjectSwitch, setPendingProjectSwitch] = useState<{ id: string; name: string } | null>(null)

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
    const dateValue = (p: RentmanProject): number => {
      const iso = p.periodStart ?? p.periodEnd
      if (!iso) return Number.NEGATIVE_INFINITY
      const t = new Date(iso).getTime()
      return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY
    }
    const q = projectQuery.trim().toLowerCase()
    const filtered = q
      ? projects.filter((p) => {
          if (p.name.toLowerCase().includes(q)) return true
          if (p.number !== undefined && String(p.number).toLowerCase().includes(q)) return true
          if (p.status && p.status.toLowerCase().includes(q)) return true
          return false
        })
      : projects
    const copy = [...filtered]
    copy.sort((a, b) => {
      switch (projectSort) {
        case 'number-asc':
          return numeric(a) - numeric(b) || a.name.localeCompare(b.name)
        case 'number-desc':
          return numeric(b) - numeric(a) || a.name.localeCompare(b.name)
        case 'date-asc':
          return dateValue(a) - dateValue(b) || a.name.localeCompare(b.name)
        case 'date-desc':
          return dateValue(b) - dateValue(a) || a.name.localeCompare(b.name)
      }
    })
    return copy
  }, [projects, projectSort, projectQuery])
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

  const fetchEquipment = async (projectId: string, projectName?: string) => {
    // If a different Rentman project is already linked and there are rentman items on canvas,
    // ask for confirmation before switching.
    const hasLinkedItems = projectEquipment.some((e) => e.rentmanId)
    if (
      linkedProjectId &&
      linkedProjectId !== projectId &&
      hasLinkedItems &&
      !pendingProjectSwitch
    ) {
      const name = projectName ?? projects.find((p) => p.id === projectId)?.name ?? projectId
      setPendingProjectSwitch({ id: projectId, name })
      return
    }
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

      // Compare against canvas equipment: flag items no longer in the project.
      const fetchedEquipmentIds = new Set(mapped.map((i) => i.equipmentId).filter(Boolean))
      for (const item of projectEquipment) {
        if (!item.rentmanId) continue
        const stillPresent = fetchedEquipmentIds.has(item.rentmanId)
        updateEquipment(item.id, { rentmanRemoved: !stillPresent })
      }

      // Publish Rentman folder names as known categories for dropdowns everywhere.
      const folderNames = Object.values(folders).filter(Boolean)
      if (folderNames.length) addKnownCategories(folderNames)

      // Some Rentman API keys lack permission to read /equipmentfolders.
      // That's fine — mapEquipment falls back to names embedded in the
      // equipment records, so the import still works. We just log it to
      // avoid confusing the user with a scary "No access" warning while
      // everything actually loaded successfully.
      if (!folderData.length) {
        console.info(
          '[rentman] /equipmentfolders returned no data (token lacks permission or no folders); using fallback category names.',
        )
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

  const saveToLibrary = (
    selected: RentmanEquipment[],
    templatesByEquipmentId: Record<string, EquipmentTemplate>,
  ): number => {
    // One library template per unique device name — quantity is irrelevant for the template.
    const seen = new Set<string>()
    let addedCount = 0
    selected.forEach((item) => {
      if (seen.has(item.name)) return
      seen.add(item.name)
      const base =
        templatesByEquipmentId[item.equipmentId] ||
        customLibrary.find((t) => t.name === item.name) ||
        matchBlackmagicTemplate(item.name) ||
        matchUbiquitiTemplate(item.name) ||
        matchMonitorTemplate(item.name) ||
        matchCameraTemplate(item.name) ||
        matchMiscTemplate(item.name) ||
        matchGreenGoTemplate(item.name) || {
          name: item.name,
          category: item.category,
          inputs: [mapPort('Input 1')],
          outputs: [mapPort('Output 1')],
          width: 220,
          height: 140,
        }
      addCustomTemplate({
        ...base,
        name: base.name || item.name,
        category: base.category || item.category,
        rentmanId: item.equipmentId,
        rentmanSource: selectedProjectId,
      })
      addedCount++
    })
    // Link this Rentman project to the cable planner project.
    const linkedProject = projects.find((p) => p.id === selectedProjectId)
    updateProjectMetadata({
      rentmanProjectId: selectedProjectId,
      rentmanProjectName: linkedProject?.name,
    })
    return addedCount
  }

  const handleImport = () => {
    const selected = visibleItems.filter((item) => item.checked)
    if (selected.length === 0) return

    const knownNames = new Set(customLibrary.map((t) => t.name))
    const unknownMap = new Map<string, UnknownCandidate>()
    selected.forEach((item) => {
      if (knownNames.has(item.name)) return
      if (matchBlackmagicTemplate(item.name)) return
      if (matchUbiquitiTemplate(item.name)) return
      if (matchMonitorTemplate(item.name)) return
      if (matchCameraTemplate(item.name)) return
      if (matchMiscTemplate(item.name)) return
      if (matchGreenGoTemplate(item.name)) return
      if (unknownMap.has(item.equipmentId)) return
      unknownMap.set(item.equipmentId, {
        rentmanId: item.equipmentId,
        name: item.name,
        category: item.category,
      })
    })

    if (unknownMap.size === 0) {
      const count = saveToLibrary(selected, {})
      setImportResult(count)
      setTimeout(() => { setImportResult(null); onClose() }, 2000)
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
    void skipped
    const count = saveToLibrary(selected, templates)
    setWizardQueue(null)
    setWizardTemplates({})
    setWizardSkipped(new Set())
    setImportResult(count)
    setTimeout(() => { setImportResult(null); onClose() }, 2000)
  }

  const handleWizardSave = (candidate: UnknownCandidate, template: EquipmentTemplate) => {
    const withSource: EquipmentTemplate = { ...template, rentmanSource: selectedProjectId }
    addCustomTemplate(withSource)
    const nextTemplates = { ...wizardTemplates, [candidate.rentmanId]: withSource }
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
      {/* ── Confirmation: switch linked Rentman project ── */}
      {pendingProjectSwitch && (
        <div className="w-full max-w-md rounded border border-amber-600 bg-slate-900 p-5 text-slate-100 shadow-xl">
          <h3 className="mb-2 text-base font-semibold text-amber-400">Rentman-Projekt wechseln?</h3>
          <p className="mb-1 text-sm text-slate-300">
            Dieses Projekt ist bereits mit dem Rentman-Projekt
            {linkedProjectName ? (
              <> <span className="font-medium text-white">„{linkedProjectName}"</span></>
            ) : (
              <> <span className="font-mono text-xs text-slate-400">{linkedProjectId}</span></>
            )} verknüpft.
          </p>
          <p className="mb-4 text-sm text-slate-300">
            Soll stattdessen <span className="font-medium text-white">„{pendingProjectSwitch.name}"</span> geladen werden?
            Bereits importierte Geräte auf der Canvas behalten ihre Verknüpfung.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingProjectSwitch(null)}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm hover:bg-slate-600"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => {
                const { id, name } = pendingProjectSwitch
                setPendingProjectSwitch(null)
                void fetchEquipment(id, name)
              }}
              className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium hover:bg-amber-500"
            >
              Ja, Projekt wechseln
            </button>
          </div>
        </div>
      )}

      {!pendingProjectSwitch && (
        <>
      <div className="w-full max-w-3xl rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Import from Rentman</h3>
          <button type="button" onClick={onClose} className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600">
            Close
          </button>
        </div>

        <div className="mb-3 space-y-2 rounded border border-slate-800 bg-slate-950/40 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchProjects}
              className="rounded bg-sky-600 px-3 py-1 text-sm font-medium hover:bg-sky-500"
            >
              Projekte laden
            </button>
            <span className="text-xs text-slate-500">
              {projects.length > 0
                ? `${sortedProjects.length} / ${projects.length} Projekte`
                : 'Noch keine Projekte geladen'}
            </span>
            <div className="ml-auto flex items-center gap-1 text-xs">
              <span className="text-slate-400">Sortierung:</span>
              {(
                [
                  ['number-desc', '# ↓'],
                  ['number-asc', '# ↑'],
                  ['date-desc', 'Datum ↓'],
                  ['date-asc', 'Datum ↑'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProjectSort(value)}
                  className={`rounded px-2 py-0.5 ${
                    projectSort === value
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={projectQuery}
              onChange={(e) => setProjectQuery(e.target.value)}
              placeholder="Suche nach Name, Nummer oder Status…"
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            />
            {projectQuery && (
              <button
                type="button"
                onClick={() => setProjectQuery('')}
                className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
              >
                Leeren
              </button>
            )}
          </div>
          <ProjectSelector
            projects={sortedProjects}
            selectedProjectId={selectedProjectId}
            onSelect={fetchEquipment}
          />
          {items.length > 0 && selectedProjectId && (
            <button
              type="button"
              onClick={() => void fetchEquipment(selectedProjectId)}
              disabled={loading}
              className="mt-1 w-full rounded bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600 disabled:opacity-50"
            >
              {loading ? 'Lädt…' : '↻ Neu laden & Abgleichen'}
            </button>
          )}
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
              items={visibleItems.map((item) => {
                const match =
                  customLibrary.find((t) => t.name === item.name) ||
                  matchBlackmagicTemplate(item.name) ||
                  matchUbiquitiTemplate(item.name) ||
                  matchMonitorTemplate(item.name) ||
                  matchCameraTemplate(item.name) ||
                  matchMiscTemplate(item.name) ||
                  matchGreenGoTemplate(item.name)
                return match
                  ? { ...item, templateMatch: match.name }
                  : item
              })}
              onToggle={toggleItem}
              onSetAll={setAllVisible}
              onQtyChange={setQty}
            />
            <div className="mt-3 flex items-center justify-between text-sm">
              {importResult !== null ? (
                <span className="font-semibold text-emerald-400">
                  ✓ {importResult} {importResult === 1 ? 'Gerät' : 'Geräte'} zur Library hinzugefügt
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  Geräte werden zur Equipment Library hinzugefügt, nicht direkt auf die Canvas platziert.
                </span>
              )}
              <button
                type="button"
                onClick={handleImport}
                disabled={importResult !== null}
                className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Zur Library hinzufügen
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
        </>
      )}
    </div>
  )
}
