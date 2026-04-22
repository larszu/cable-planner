import { useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useRentman } from '../../hooks/useRentman'
import { useProjectStore } from '../../store/projectStore'
import type { EquipmentItem, Port } from '../../types/equipment'
import { EquipmentChecklist } from './EquipmentChecklist'
import { ProjectSelector } from './ProjectSelector'

interface RentmanProject {
  id: string
  name: string
  status?: string
}

interface RentmanEquipment {
  id: string
  name: string
  category: string
  checked: boolean
  raw: Record<string, unknown>
}

const mapProjects = (projects: unknown[]): RentmanProject[] =>
  projects.map((item) => {
    const record = item as Record<string, unknown>
    return {
      id: String(record.id ?? record._id ?? ''),
      name: String(record.name ?? record.displayname ?? 'Unnamed project'),
      status: record.status ? String(record.status) : undefined,
    }
  })

const mapPort = (name: string, type: Port['connectorType'] = 'Custom'): Port => ({
  id: uuidv4(),
  name,
  type,
  connectorType: type,
})

const mapEquipment = (
  equipment: unknown[],
  foldersById: Record<string, string>,
): RentmanEquipment[] =>
  equipment.map((item) => {
    const record = item as Record<string, unknown>
    const folder =
      String(record.equipmentfolder ?? record.folder ?? record.category ?? '') || 'Uncategorized'

    return {
      id: String(record.equipment ?? record.id ?? record._id ?? uuidv4()),
      name: String(record.name ?? record.displayname ?? 'Unnamed equipment'),
      category: foldersById[folder] ?? folder,
      checked: true,
      raw: record,
    }
  })

interface RentmanImportDialogProps {
  open: boolean
  onClose: () => void
}

export const RentmanImportDialog = ({ open, onClose }: RentmanImportDialogProps) => {
  const { loadProjects, loadProjectEquipment, loadFolders } = useRentman()
  const importEquipment = useProjectStore((state) => state.importEquipment)
  const [projects, setProjects] = useState<RentmanProject[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [items, setItems] = useState<RentmanEquipment[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const checkedCount = useMemo(() => items.filter((item) => item.checked).length, [items])

  if (!open) {
    return null
  }

  const fetchProjects = async () => {
    setError('')
    setLoading(true)
    try {
      const projectData = await loadProjects()
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
    setLoading(true)
    try {
      const [equipmentData, folderData] = await Promise.all([loadProjectEquipment(projectId), loadFolders()])
      const folders = (folderData as Record<string, unknown>[]).reduce<Record<string, string>>((acc, folder) => {
        acc[String(folder.id)] = String(folder.name ?? folder.displayname ?? folder.id)
        return acc
      }, {})
      setItems(mapEquipment(equipmentData, folders))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project equipment')
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (id: string) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)))
  }

  const handleImport = () => {
    const toImport: EquipmentItem[] = items
      .filter((item) => item.checked)
      .map((item, index) => ({
        id: uuidv4(),
        name: item.name,
        category: item.category,
        rentmanId: item.id,
        inputs: [mapPort('Input 1')],
        outputs: [mapPort('Output 1')],
        x: 120 + (index % 5) * 260,
        y: 120 + Math.floor(index / 5) * 180,
        width: 220,
        height: 140,
      }))

    importEquipment(toImport)
    onClose()
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
          <ProjectSelector projects={projects} selectedProjectId={selectedProjectId} onSelect={fetchEquipment} />
        </div>

        {loading && <div className="mb-2 text-sm text-slate-300">Loading…</div>}
        {error && <div className="mb-2 rounded bg-red-900/50 p-2 text-sm text-red-100">{error}</div>}

        {items.length > 0 && (
          <>
            <EquipmentChecklist items={items} onToggle={toggleItem} />
            <div className="mt-3 flex items-center justify-between text-sm">
              <span>{checkedCount} item(s) selected</span>
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
    </div>
  )
}
