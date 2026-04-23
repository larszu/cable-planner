import { useEffect, useMemo, useState } from 'react'
import { CanvasArea } from './components/Canvas/CanvasArea'
import { LibraryPanel } from './components/Library/LibraryPanel'
import { MenuBar } from './components/Layout/MenuBar'
import { StatusBar } from './components/Layout/StatusBar'
import { PropertiesPanel } from './components/Properties/PropertiesPanel'
import { RentmanImportDialog } from './components/Rentman/RentmanImportDialog'
import { SettingsDialog } from './components/Settings/SettingsDialog'
import { VideohubExportDialog } from './components/Export/VideohubExportDialog'
import { GreenGoExportDialog } from './components/Export/GreenGoExportDialog'
import { AtemDialog } from './components/Atem/AtemDialog'
import { MultiviewerLayoutView } from './components/Atem/MultiviewerLayoutView'
import { AtemMvConfigDialog } from './components/Atem/AtemMvConfigDialog'
import { ProjectMetaDialog } from './components/Project/ProjectMetaDialog'
import { CableBomDialog } from './components/Project/CableBomDialog'
import { Splitter } from './components/Layout/Splitter'
import { useProject } from './hooks/useProject'
import { cablePlannerApi } from './lib/bridge'
import { exportCanvasToPdf } from './lib/exportPdf'
import { useProjectStore } from './store/projectStore'
import { useUndoRedoShortcuts } from './store/projectHistory'
import { useSettingsStore } from './store/settingsStore'
import { useUiStore } from './store/uiStore'
import type { Cable, CableType } from './types/cable'
import type { ConnectorType, EquipmentItem, Port } from './types/equipment'
import type { ProjectMetadata } from './types/project'
import {
  cableCatalog,
  checkCableCompatibility,
  checkSdiStandardMismatch,
  pickHighestSdiStandard,
  type CableSpec,
  type SignalStandard,
} from './types/cableSpec'
import {
  DEFAULT_VIDEO_FORMAT,
  pickCableStandardForFormat,
  videoFormatById,
  type VideoFormatId,
} from './types/videoFormat'

export default function App() {
  const project = useProjectStore((state) => state.project)
  const showCableDialog = useProjectStore((state) => state.showCableDialog)
  const pendingConnection = useProjectStore((state) => state.pendingConnection)
  const createCableFromPending = useProjectStore((state) => state.createCableFromPending)
  const closeCableDialog = useProjectStore((state) => state.closeCableDialog)
  const hasToken = useSettingsStore((state) => state.hasToken)
  const setHasToken = useSettingsStore((state) => state.setHasToken)
  const propertiesCollapsed = useUiStore((state) => state.propertiesCollapsed)
  const libraryCollapsed = useUiStore((state) => state.libraryCollapsed)
  const libraryWidth = useUiStore((state) => state.libraryWidth)
  const propertiesWidth = useUiStore((state) => state.propertiesWidth)
  const setLibraryWidth = useUiStore((state) => state.setLibraryWidth)
  const setPropertiesWidth = useUiStore((state) => state.setPropertiesWidth)
  const videohubExport = useUiStore((state) => state.videohubExport)
  const closeVideohubExport = useUiStore((state) => state.closeVideohubExport)
  const greengoExport = useUiStore((state) => state.greengoExport)
  const closeGreenGoExport = useUiStore((state) => state.closeGreenGoExport)
  const cableEdit = useUiStore((state) => state.cableEdit)
  const closeCableEdit = useUiStore((state) => state.closeCableEdit)
  const updateCable = useProjectStore((state) => state.updateCable)
  const atemDialog = useUiStore((state) => state.atemDialog)
  const closeAtemDialog = useUiStore((state) => state.closeAtemDialog)
  const atemMvLayout = useUiStore((state) => state.atemMvLayout)
  const closeAtemMvLayout = useUiStore((state) => state.closeAtemMvLayout)
  const { newProject, openProject, saveProject, saveProjectAs, refreshRecent } = useProject()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rentmanImportOpen, setRentmanImportOpen] = useState(false)
  const [metaDialog, setMetaDialog] = useState<{ mode: 'new' | 'edit' } | null>(null)
  const [cableBomOpen, setCableBomOpen] = useState(false)

  useEffect(() => {
    void refreshRecent()
    cablePlannerApi.credentials.getToken().then((token) => {
      setHasToken(Boolean(token))
    })
  }, [refreshRecent, setHasToken])

  useUndoRedoShortcuts()

  const handleNewProject = () => {
    // Soft-protect the current canvas: warn when there's actual content, then
    // prompt for the new project's metadata before clearing.
    const hasContent =
      project.equipment.length > 0 ||
      project.cables.length > 0 ||
      (project.locations?.length ?? 0) > 0
    if (hasContent) {
      const ok = confirm(
        'Aktuelles Projekt verwerfen und neues Projekt anlegen?\n\nUngespeicherte Änderungen gehen verloren.',
      )
      if (!ok) return
    }
    setMetaDialog({ mode: 'new' })
  }

  const handleMetaConfirm = async (patch: Partial<ProjectMetadata>) => {
    if (!metaDialog) return
    if (metaDialog.mode === 'new') {
      await newProject()
      useProjectStore.getState().updateProjectMetadata(patch)
    } else {
      useProjectStore.getState().updateProjectMetadata(patch)
    }
    setMetaDialog(null)
  }

  const handleExportPdf = async () => {
    try {
      await exportCanvasToPdf(project.metadata.name, project.metadata)
    } catch (error) {
      console.error('PDF export failed:', error)
      alert(`PDF export failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const editCable = useMemo(
    () => (cableEdit.cableId ? project.cables.find((c) => c.id === cableEdit.cableId) : undefined),
    [cableEdit.cableId, project.cables],
  )

  const { fromPort, toPort, fromDev, toDev } = useMemo(() => {
    if (!pendingConnection)
      return { fromPort: undefined, toPort: undefined, fromDev: undefined, toDev: undefined }
    const fromDev = project.equipment.find((e) => e.id === pendingConnection.source)
    const toDev = project.equipment.find((e) => e.id === pendingConnection.target)
    const fromPort = fromDev?.outputs.find((p) => p.id === pendingConnection.sourceHandle)
    const toPort = toDev?.inputs.find((p) => p.id === pendingConnection.targetHandle)
    return { fromPort, toPort, fromDev, toDev }
  }, [pendingConnection, project.equipment])

  return (
    <div className="flex h-screen flex-col bg-slate-900 text-slate-100">
      <MenuBar
        onNewProject={handleNewProject}
        onOpenProject={() => void openProject()}
        onSaveProject={() => void saveProject()}
        onSaveProjectAs={() => void saveProjectAs()}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenRentmanImport={() => setRentmanImportOpen(true)}
        onExportPdf={() => void handleExportPdf()}
        onEditProjectMeta={() => setMetaDialog({ mode: 'edit' })}
        onOpenCableBom={() => setCableBomOpen(true)}
        videoFormat={project.metadata.defaultVideoFormat ?? DEFAULT_VIDEO_FORMAT}
        onChangeVideoFormat={(id) => useProjectStore.getState().setDefaultVideoFormat(id)}
      />

      <main
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{
          gridTemplateColumns: `${libraryCollapsed ? '32px' : `${libraryWidth}px`} 4px 1fr 4px ${propertiesCollapsed ? '32px' : `${propertiesWidth}px`}`,
        }}
      >
        <LibraryPanel />
        <Splitter side="left" onResize={(delta) => setLibraryWidth(libraryWidth + delta)} />
        <div className="min-h-0 h-full w-full overflow-hidden">
          <CanvasArea />
        </div>
        <Splitter side="right" onResize={(delta) => setPropertiesWidth(propertiesWidth + delta)} />
        <PropertiesPanel />
      </main>

      <StatusBar
        projectName={project.metadata.name}
        zoom={project.canvasState.zoom}
        hasToken={hasToken}
      />

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RentmanImportDialog open={rentmanImportOpen} onClose={() => setRentmanImportOpen(false)} />
      {videohubExport.open && (
        <VideohubExportDialog
          onClose={closeVideohubExport}
          preselectedDeviceId={videohubExport.deviceId}
          initialShowMatrix={videohubExport.initialShowMatrix}
        />
      )}
      {greengoExport.open && (
        <GreenGoExportDialog onClose={closeGreenGoExport} />
      )}
      {atemDialog.open && (
        <AtemDialog onClose={closeAtemDialog} preselectedDeviceId={atemDialog.deviceId} />
      )}
      {atemMvLayout.open && <MultiviewerLayoutView onClose={closeAtemMvLayout} />}
      <AtemMvConfigDialog />

      <ProjectMetaDialog
        open={metaDialog !== null}
        mode={metaDialog?.mode ?? 'edit'}
        initial={project.metadata}
        onCancel={() => setMetaDialog(null)}
        onConfirm={(patch) => void handleMetaConfirm(patch)}
      />

      <CableBomDialog open={cableBomOpen} onClose={() => setCableBomOpen(false)} />

      {cableEdit.open && editCable && (
        <CableEditDialog
          cable={editCable}
          onSave={(patch) => updateCable(editCable.id, patch)}
          onClose={closeCableEdit}
        />
      )}

      {showCableDialog && (
        <CableDialog
          fromPort={fromPort}
          toPort={toPort}
          fromDev={fromDev}
          toDev={toDev}
          defaultVideoFormat={project.metadata.defaultVideoFormat}
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
  fromDev?: EquipmentItem
  toDev?: EquipmentItem
  defaultVideoFormat?: VideoFormatId
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

const CableDialog = ({ fromPort, toPort, fromDev, toDev, defaultVideoFormat, onCancel, onCreate }: CableDialogProps) => {
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

  // For SDI↔SDI connections, pick the cable that matches the project's default
  // video format (or 1080p50 fallback) and the two devices' SDI capabilities.
  const initialSpecId = useMemo(() => {
    const firstUsable = ranked.find((item) => item.level !== 'error') ?? ranked[0]
    if (!fromPort || !toPort) return firstUsable?.cable.id ?? cableCatalog[0].id
    const sdiConnectors = new Set<ConnectorType>(['BNC'])
    const bothSdi =
      sdiConnectors.has(fromPort.connectorType) && sdiConnectors.has(toPort.connectorType)
    if (!bothSdi) return firstUsable?.cable.id ?? cableCatalog[0].id
    const format = videoFormatById(defaultVideoFormat ?? DEFAULT_VIDEO_FORMAT)
    if (!format) return firstUsable?.cable.id ?? cableCatalog[0].id
    const target = pickCableStandardForFormat(format, fromDev?.sdiCaps, toDev?.sdiCaps)
    const match = ranked.find(
      (item) => item.level !== 'error' && item.cable.standards.includes(target),
    )
    return match?.cable.id ?? firstUsable?.cable.id ?? cableCatalog[0].id
  }, [ranked, fromPort, toPort, fromDev, toDev, defaultVideoFormat])

  const [specId, setSpecId] = useState<string>(initialSpecId)
  const selectedEntry = ranked.find((item) => item.cable.id === specId) ?? ranked[0]
  const selected: CableSpec = selectedEntry.cable

  const defaultStandard = pickHighestSdiStandard(selected.standards)
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
    setStandard(pickHighestSdiStandard(spec.standards))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
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

interface CableEditDialogProps {
  cable: Cable
  onSave: (patch: Partial<Cable>) => void
  onClose: () => void
}

const CableEditDialog = ({ cable, onClose, onSave }: CableEditDialogProps) => {
  const [specId, setSpecId] = useState<string>(cable.cableSpecId ?? cableCatalog[0].id)
  const selected: CableSpec = cableCatalog.find((c) => c.id === specId) ?? cableCatalog[0]
  const [standard, setStandard] = useState<SignalStandard | undefined>(
    cable.standard ?? pickHighestSdiStandard(selected.standards),
  )
  const [length, setLength] = useState(cable.length)
  const [name, setName] = useState(cable.name)
  const [color, setColor] = useState(cable.color)
  const [notes, setNotes] = useState(cable.notes ?? '')

  const onSelectSpec = (id: string) => {
    setSpecId(id)
    const spec = cableCatalog.find((c) => c.id === id)
    if (!spec) return
    setStandard(pickHighestSdiStandard(spec.standards))
  }

  const lengthWarning =
    selected.maxLengthMeters && length > selected.maxLengthMeters
      ? `Länge überschreitet empfohlenes Maximum von ${selected.maxLengthMeters} m für ${selected.name}.`
      : null

  const submit = () => {
    onSave({ name, length, color, notes, cableSpecId: selected.id, standard })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded border border-slate-700 bg-slate-900 p-4 text-slate-100">
        <h3 className="mb-2 text-lg font-semibold">Kabel bearbeiten</h3>

        <div className="space-y-2 text-sm">
          <label className="block">
            Kabeltyp
            <select
              value={specId}
              onChange={(e) => onSelectSpec(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
            >
              {cableCatalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.connectorType})
                </option>
              ))}
            </select>
          </label>

          {selected.standards.length > 1 && (
            <label className="block">
              Signalstandard
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
              Länge (m)
              <input
                type="number"
                min={0}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              />
            </label>
            <label className="block">
              Farbe
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 h-10 w-full rounded border border-slate-700 bg-slate-950 p-1"
              />
            </label>
          </div>

          <label className="block">
            Notizen
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2"
              rows={2}
            />
          </label>
        </div>

        {lengthWarning && (
          <div className="mt-3 rounded bg-amber-900/50 p-2 text-xs text-amber-100">⚠ {lengthWarning}</div>
        )}

        <div className="mt-3 flex justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded bg-emerald-600 px-3 py-1 hover:bg-emerald-500"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  )
}
