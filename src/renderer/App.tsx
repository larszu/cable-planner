import { useEffect, useMemo, useState } from 'react'
import { CanvasArea } from './components/Canvas/CanvasArea'
import { LibraryPanel } from './components/Library/LibraryPanel'
import { MenuBar } from './components/Layout/MenuBar'
import { StatusBar } from './components/Layout/StatusBar'
import { PropertiesPanel } from './components/Properties/PropertiesPanel'
import { RentmanImportDialog } from './components/Rentman/RentmanImportDialog'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { useProject } from './hooks/useProject'
import { cablePlannerApi, hasDesktopBridge } from './lib/bridge'
import { exportCanvasToPdf } from './lib/exportPdf'
import { useProjectStore } from './store/projectStore'
import { useSettingsStore } from './store/settingsStore'
import { useUiStore } from './store/uiStore'
import type { Cable, CableType } from './types/cable'
import type { ConnectorType, Port } from './types/equipment'
import {
  cableCatalog,
  checkCableCompatibility,
  checkSdiStandardMismatch,
  type CableSpec,
  type SignalStandard,
} from './types/cableSpec'

export default function App() {
  const project = useProjectStore((state) => state.project)
  const showCableDialog = useProjectStore((state) => state.showCableDialog)
  const pendingConnection = useProjectStore((state) => state.pendingConnection)
  const createCableFromPending = useProjectStore((state) => state.createCableFromPending)
  const closeCableDialog = useProjectStore((state) => state.closeCableDialog)
  const hasToken = useSettingsStore((state) => state.hasToken)
  const setHasToken = useSettingsStore((state) => state.setHasToken)
  const propertiesCollapsed = useUiStore((state) => state.propertiesCollapsed)
  const { newProject, openProject, saveProject, saveProjectAs, refreshRecent } = useProject()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rentmanImportOpen, setRentmanImportOpen] = useState(false)

  useEffect(() => {
    void refreshRecent()
    cablePlannerApi.credentials.getToken().then((token) => {
      setHasToken(Boolean(token))
    })
  }, [refreshRecent, setHasToken])

  const handleExportPdf = async () => {
    try {
      await exportCanvasToPdf(project.metadata.name)
    } catch (error) {
      console.error('PDF export failed:', error)
      alert(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const { fromPort, toPort } = useMemo(() => {
    if (!pendingConnection) return { fromPort: undefined, toPort: undefined }
    const fromDev = project.equipment.find((e) => e.id === pendingConnection.source)
    const toDev = project.equipment.find((e) => e.id === pendingConnection.target)
    const fromPort = fromDev?.outputs.find((p) => p.id === pendingConnection.sourceHandle)
    const toPort = toDev?.inputs.find((p) => p.id === pendingConnection.targetHandle)
    return { fromPort, toPort }
  }, [pendingConnection, project.equipment])

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
      <MenuBar
        onNewProject={() => void newProject()}
        onOpenProject={() => void openProject()}
        onSaveProject={() => void saveProject()}
        onSaveProjectAs={() => void saveProjectAs()}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRentmanImport={() => setRentmanImportOpen(true)}
        onExportPdf={() => void handleExportPdf()}
        webMode={!hasDesktopBridge}
      />

      <main
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: `260px 1fr ${propertiesCollapsed ? '32px' : '280px'}`,
        }}
      >
        <LibraryPanel />
        <div className="min-h-0 h-full w-full overflow-hidden">
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
        <CableDialog
          fromPort={fromPort}
          toPort={toPort}
          onCancel={closeCableDialog}
          onCreate={createCableFromPending}
        />
      )}
    </div>
  )
}

interface CableDialogProps {
  fromPort?: Port
  toPort?: Port
  onCancel: () => void
  onCreate: (
    draft: Pick<Cable, 'name' | 'type' | 'length' | 'color' | 'notes'> &
      Partial<Pick<Cable, 'cableSpecId' | 'standard' | 'needsConverter'>>,
  ) => void
}

const cableTypeFromConnector = (c: ConnectorType | undefined): CableType => {
  if (!c) return 'Custom'
  if (c === 'DIN' || c === 'DisplayPort' || c === 'USB') return 'Custom'
  return c as CableType
}

const CableDialog = ({ fromPort, toPort, onCancel, onCreate }: CableDialogProps) => {
  // Build list of cables ranked by compatibility with the two ports.
  const ranked = useMemo(() => {
    if (!fromPort || !toPort) {
      return cableCatalog.map((cable) => ({ cable, level: 'ok' as const, message: '' }))
    }
    return cableCatalog
      .map((cable) => ({
        cable,
        ...checkCableCompatibility(fromPort.connectorType, toPort.connectorType, cable),
      }))
      .sort((a, b) => {
        const order = { ok: 0, warn: 1, error: 2 }
        return order[a.level] - order[b.level]
      })
  }, [fromPort, toPort])

  const firstUsable = ranked.find((item) => item.level !== 'error') ?? ranked[0]
  const [specId, setSpecId] = useState<string>(firstUsable?.cable.id ?? cableCatalog[0].id)
  const selectedEntry = ranked.find((item) => item.cable.id === specId) ?? ranked[0]
  const selected: CableSpec = selectedEntry.cable

  const sdiStandards: SignalStandard[] = ['SDI-SD', 'SDI-HD', 'SDI-3G', 'SDI-6G', 'SDI-12G']
  const defaultStandard = selected.standards.find((s) => sdiStandards.includes(s)) ?? selected.standards[0]
  const [standard, setStandard] = useState<SignalStandard | undefined>(defaultStandard)
  const [length, setLength] = useState(1)
  const [name, setName] = useState(selected.name)
  const [color, setColor] = useState(selected.color)
  const [notes, setNotes] = useState(selected.notes ?? '')

  // Keep derived fields aligned when the user changes the spec.
  const onSelectSpec = (id: string) => {
    setSpecId(id)
    const spec = cableCatalog.find((c) => c.id === id)
    if (!spec) return
    setName(spec.name)
    setColor(spec.color)
    setNotes(spec.notes ?? '')
    setStandard(spec.standards.find((s) => sdiStandards.includes(s)) ?? spec.standards[0])
  }

  const sdiMismatch = useMemo(() => {
    if (!fromPort || !toPort) return null
    if (!standard) return null
    // If user picked a specific SDI speed as the cable standard, check that both
    // ports' declared standards (if any) match or note a converter is needed.
    return checkSdiStandardMismatch(fromPort.standard ?? standard, toPort.standard ?? standard)
  }, [fromPort, toPort, standard])

  const connectorMismatch = selectedEntry.level
  const connectorMessage = selectedEntry.message

  const needsConverter =
    connectorMismatch === 'warn' || sdiMismatch?.level === 'warn' || connectorMismatch === 'error'

  const lengthWarning =
    selected.maxLengthMeters && length > selected.maxLengthMeters
      ? `Length exceeds recommended maximum of ${selected.maxLengthMeters} m for ${selected.name}.`
      : null

  const submit = () => {
    if (connectorMismatch === 'error') {
      if (
        !window.confirm(
          `${connectorMessage}\n\nAdd this connection anyway (marked as needing a converter)?`,
        )
      ) {
        return
      }
    }
    onCreate({
      name,
      type: cableTypeFromConnector(selected.connectorType),
      length,
      color,
      notes,
      cableSpecId: selected.id,
      standard,
      needsConverter: needsConverter || connectorMismatch === 'error',
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-full max-w-lg rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <h3 className="mb-2 text-lg font-semibold">Create Cable</h3>

        {fromPort && toPort && (
          <div className="mb-3 rounded bg-slate-950 p-2 text-xs">
            <div>
              From: <span className="font-medium">{fromPort.name}</span> ({fromPort.connectorType}
              {fromPort.standard ? `, ${fromPort.standard}` : ''})
            </div>
            <div>
              To: <span className="font-medium">{toPort.name}</span> ({toPort.connectorType}
              {toPort.standard ? `, ${toPort.standard}` : ''})
            </div>
          </div>
        )}

        <div className="space-y-2 text-sm">
          <label className="block">
            Cable
            <select
              value={specId}
              onChange={(e) => onSelectSpec(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              {ranked.map(({ cable, level }) => {
                const icon = level === 'ok' ? '✓' : level === 'warn' ? '⚠' : '✕'
                return (
                  <option key={cable.id} value={cable.id}>
                    {icon} {cable.name} ({cable.connectorType})
                  </option>
                )
              })}
            </select>
          </label>

          {selected.standards.length > 1 && (
            <label className="block">
              Signal Standard
              <select
                value={standard ?? ''}
                onChange={(e) => setStandard(e.target.value as SignalStandard)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              >
                {selected.standards.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              Length (m)
              <input
                type="number"
                min={0}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              />
            </label>
            <label className="block">
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-950 p-1"
              />
            </label>
          </div>

          <label className="block">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              rows={2}
            />
          </label>
        </div>

        {/* Status/warning area */}
        <div className="mt-3 space-y-1 text-xs">
          {connectorMismatch === 'error' && (
            <div className="rounded bg-red-900/50 p-2 text-red-100">✕ {connectorMessage}</div>
          )}
          {connectorMismatch === 'warn' && (
            <div className="rounded bg-amber-900/50 p-2 text-amber-100">⚠ {connectorMessage}</div>
          )}
          {connectorMismatch === 'ok' && connectorMessage && (
            <div className="rounded bg-emerald-900/40 p-2 text-emerald-100">✓ {connectorMessage}</div>
          )}
          {sdiMismatch?.level === 'warn' && (
            <div className="rounded bg-amber-900/50 p-2 text-amber-100">⚠ {sdiMismatch.message}</div>
          )}
          {lengthWarning && (
            <div className="rounded bg-amber-900/50 p-2 text-amber-100">⚠ {lengthWarning}</div>
          )}
        </div>

        <div className="mt-3 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
