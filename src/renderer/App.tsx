import { useEffect, useState } from 'react'
import { CanvasArea } from './components/Canvas/CanvasArea'
import { LibraryPanel } from './components/Library/LibraryPanel'
import { MenuBar } from './components/Layout/MenuBar'
import { StatusBar } from './components/Layout/StatusBar'
import { PropertiesPanel } from './components/Properties/PropertiesPanel'
import { RentmanImportDialog } from './components/Rentman/RentmanImportDialog'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { useProject } from './hooks/useProject'
import { useProjectStore } from './store/projectStore'
import { useSettingsStore } from './store/settingsStore'
import type { CableType } from './types/cable'

const cableTypes: CableType[] = ['XLR', 'BNC', 'HDMI', 'SDI', 'Ethernet/RJ45', 'Fiber', 'Custom']

export default function App() {
  const project = useProjectStore((state) => state.project)
  const showCableDialog = useProjectStore((state) => state.showCableDialog)
  const createCableFromPending = useProjectStore((state) => state.createCableFromPending)
  const closeCableDialog = useProjectStore((state) => state.closeCableDialog)
  const hasToken = useSettingsStore((state) => state.hasToken)
  const setHasToken = useSettingsStore((state) => state.setHasToken)
  const { newProject, openProject, saveProject, saveProjectAs, refreshRecent } = useProject()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rentmanImportOpen, setRentmanImportOpen] = useState(false)

  useEffect(() => {
    void refreshRecent()
    window.cablePlanner.credentials.getToken().then((token) => {
      setHasToken(Boolean(token))
    })
  }, [refreshRecent, setHasToken])

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
      <MenuBar
        onNewProject={() => void newProject()}
        onOpenProject={() => void openProject()}
        onSaveProject={() => void saveProject()}
        onSaveProjectAs={() => void saveProjectAs()}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRentmanImport={() => setRentmanImportOpen(true)}
      />

      <main className="grid min-h-0 flex-1 grid-cols-[260px_1fr_280px]">
        <LibraryPanel />
        <div className="min-h-0">
          <CanvasArea />
        </div>
        <PropertiesPanel />
      </main>

      <StatusBar
        projectName={project.metadata.name}
        zoom={project.canvasState.zoom}
        hasToken={hasToken}
      />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RentmanImportDialog open={rentmanImportOpen} onClose={() => setRentmanImportOpen(false)} />

      {showCableDialog && (
        <CableDialog onCancel={closeCableDialog} onCreate={createCableFromPending} />
      )}
    </div>
  )
}

interface CableDialogProps {
  onCancel: () => void
  onCreate: (draft: {
    name: string
    type: CableType
    length: number
    color: string
    notes: string
  }) => void
}

const CableDialog = ({ onCancel, onCreate }: CableDialogProps) => {
  const [name, setName] = useState('Cable')
  const [type, setType] = useState<CableType>('XLR')
  const [length, setLength] = useState(1)
  const [color, setColor] = useState('#3b82f6')
  const [notes, setNotes] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-4">
        <h3 className="mb-3 text-lg font-semibold">Create Cable</h3>
        <div className="space-y-2 text-sm">
          <label className="block">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
          </label>
          <label className="block">
            Type
            <select value={type} onChange={(e) => setType(e.target.value as CableType)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2">
              {cableTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Length (m)
            <input type="number" min={0} value={length} onChange={(e) => setLength(Number(e.target.value))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
          </label>
          <label className="block">
            Color
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-950 p-1" />
          </label>
          <label className="block">
            Notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
          </label>
        </div>
        <div className="mt-3 flex justify-end gap-2 text-sm">
          <button type="button" onClick={onCancel} className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onCreate({ name, type, length, color, notes })}
            className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
