import { Check, Folder, Rows3, ArrowDownToLine, ArrowUpToLine, X} from 'lucide-react'
import { useTranslation, format } from '../../lib/i18n'
import { Icon } from '../shared/Icon'
import { confirmDialog } from '../../lib/confirmDialog'
import { pickImageAsDataUri } from '../../lib/readImageAsDataUri'
import { ModalShell } from '../shared/ModalShell'
import { CategorySelect } from '../shared/CategorySelect'
import { StlPreview } from './StlPreview'
import { RACK_MOUNT_WIDTH_MM, type RackPlacementDraft } from './rackBuilderTypes'
import type { EquipmentTemplate } from '../../types/equipment'

/**
 * #310 — RackPlacementProperties aus RackBuilderDialog ausgelagert.
 * Das ist der grosse Eigenschaften-Modal der erscheint wenn der User
 * im RackBuilder ein platziertes Geraet anklickt: Name, Kategorie,
 * HE-Position, Mount-Side, STL-Upload, Shelf-Offsets, Port-Side-
 * Toggles, Panel-Bilder.
 *
 * Reine Praesentations-Komponente — kein eigener State. Alle
 * Mutationen gehen ueber onUpdate / onRemove /
 * onOpenCrop / onAddCustomTemplate Callbacks zurueck zum Parent.
 */
export interface RackPlacementPropertiesProps {
  open: boolean
  selectedPlacement: RackPlacementDraft
  totalUnits: number
  rackDepthMm: number | undefined
  templates: EquipmentTemplate[]
  categoryOptions: string[]
  onClose: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<RackPlacementDraft>) => void
  onPickPanelImage: (placementId: string, side: 'front' | 'rear', src: string) => void
  onSyncStlToTemplate: (templateName: string, stlDataUri: string | undefined) => void
}

export const RackPlacementProperties = ({
  open,
  selectedPlacement,
  totalUnits,
  rackDepthMm,
  templates,
  categoryOptions,
  onClose,
  onRemove,
  onUpdate,
  onPickPanelImage,
  onSyncStlToTemplate,
}: RackPlacementPropertiesProps) => {
  const t = useTranslation()
  const heightInvalid =
    selectedPlacement.rackUnits + selectedPlacement.startUnit - 1 > totalUnits
  const startMax = Math.max(1, totalUnits - selectedPlacement.rackUnits + 1)
  const heRange =
    selectedPlacement.rackUnits > 1
      ? `HE${selectedPlacement.startUnit}–${selectedPlacement.startUnit + selectedPlacement.rackUnits - 1}`
      : `HE${selectedPlacement.startUnit}`

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={format(t('rack.props.title', 'Properties · {name}'), { name: selectedPlacement.name })}
      titleIcon={
        <span className="rounded bg-amber-900/60 px-1.5 py-0.5 text-cp-xs font-semibold text-amber-200">
          {heRange}
        </span>
      }
      maxWidth="lg"
      zIndex={70}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onRemove(selectedPlacement.id)
              onClose()
            }}
            className="rounded bg-red-900/60 px-3 py-1 text-cp-xs hover:bg-red-800"
          >
            {t('rack.props.removeFromRack', 'Remove from rack')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      }
    >
      <div className="space-y-2 text-cp-xs">
        <label className="block">
          {t('rack.props.name', 'Name')}
          <input
            value={selectedPlacement.name}
            onChange={(event) => onUpdate(selectedPlacement.id, { name: event.target.value })}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
        <label className="block">
          {t('rack.props.category', 'Category')}
          <CategorySelect
            value={selectedPlacement.category}
            onChange={(category) => onUpdate(selectedPlacement.id, { category })}
            extraOptions={[...categoryOptions, selectedPlacement.category]}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
        <label className="flex items-center gap-2 opacity-60" title={t('rack.readonlyInBuilder', 'Read-only in the builder — was set on add.')}>
          <input type="checkbox" checked={selectedPlacement.isRackDevice} disabled readOnly />
          <span>{t('rack.isRackInBuilder', 'Is a rack device (fixed in the builder)')}</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            {t('rack.props.heightHe', 'Height (RU)')}
            <input
              type="number"
              min={1}
              max={totalUnits}
              value={selectedPlacement.rackUnits}
              aria-invalid={heightInvalid}
              onChange={(event) => {
                const raw = Math.max(1, Number(event.target.value) || 1)
                const clamped = Math.min(
                  raw,
                  totalUnits - selectedPlacement.startUnit + 1,
                )
                onUpdate(selectedPlacement.id, { rackUnits: clamped })
              }}
              className={`mt-1 w-full rounded border bg-cp-surface-3 p-1.5 ${
                heightInvalid ? 'border-red-600 ring-1 ring-red-600/40' : 'border-cp-border'
              }`}
            />
            {heightInvalid && (
              <span className="mt-0.5 block text-cp-xs text-red-400">
                {format(
                  t(
                    'rack.props.heightOverflow',
                    'Height + start RU exceeds rack ({total} RU).',
                  ),
                  { total: totalUnits },
                )}
              </span>
            )}
          </label>
          <label className="block">
            {t('rack.props.startHe', 'Start RU')}
            <input
              type="number"
              min={1}
              max={startMax}
              value={selectedPlacement.startUnit}
              aria-invalid={heightInvalid}
              onChange={(event) => {
                const raw = Math.max(1, Number(event.target.value) || 1)
                const clamped = Math.min(raw, startMax)
                onUpdate(selectedPlacement.id, { startUnit: clamped })
              }}
              className={`mt-1 w-full rounded border bg-cp-surface-3 p-1.5 ${
                heightInvalid ? 'border-red-600 ring-1 ring-red-600/40' : 'border-cp-border'
              }`}
            />
            <span className="mt-0.5 block text-cp-xs text-cp-text-muted">
              {format(
                t('rack.props.maxHint', 'max {max} (height {he} RU)'),
                { max: startMax, he: selectedPlacement.rackUnits },
              )}
            </span>
          </label>
        </div>
        {/* v7.9.73 / #170 — 3D-Felder: Tiefe + Mount-Side + STL. */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            {t('rack.props.depthMm', 'Depth (mm)')}
            <input
              type="number"
              min={20}
              max={1500}
              step={10}
              value={selectedPlacement.depthMm ?? ''}
              placeholder="400"
              onChange={(event) => {
                const v = event.target.value
                onUpdate(selectedPlacement.id, {
                  depthMm: v === '' ? undefined : Math.max(20, Math.min(1500, Number(v))),
                })
              }}
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              title={t('rack.deviceDepthTitle', 'Device depth in mm. Empty = 400 mm default. Visualised by the 3D tab.')}
            />
          </label>
          <label className="block">
            {t('rack.mountLabel', 'Mount')}
            <select
              value={selectedPlacement.mountSide ?? 'full'}
              onChange={(event) =>
                onUpdate(selectedPlacement.id, {
                  mountSide: event.target.value as 'front' | 'rear' | 'full',
                })
              }
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              title={t('rack.mountTitle', 'full = full rack depth. front = front only. rear = rear only (e.g. blank panel).')}
            >
              <option value="full">{t('rack.mount.full', 'Full-depth')}</option>
              <option value="front">{t('props.rack.frontOnly', 'Front only')}</option>
              <option value="rear">{t('props.rack.rearOnly', 'Rear only')}</option>
            </select>
          </label>
        </div>
        {/* STL-Upload für 3D-Modell. */}
        <div className="block">
          <div className="mb-1 text-cp-xs text-cp-text-secondary">{t('rack.stl.header', '3D model (STL, optional)')}</div>
          <div className="mt-1 flex items-center gap-2">
            <label
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-cp-surface-5 bg-sky-700 px-3 py-1 text-cp-xs font-semibold text-white hover:bg-sky-600"
              title={t('rack.stlUploadTitle', 'Upload STL file (.stl, max 5 MB) for this device')}
            >
              <Icon icon={Folder} size="xs" />
              <span>{selectedPlacement.stlDataUri
                ? t('rack.stl.replace', 'Replace STL…')
                : t('rack.stl.pick', 'Pick STL…')}</span>
              <input
                type="file"
                accept=".stl,application/octet-stream"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  if (file.size > 5 * 1024 * 1024) {
                    await confirmDialog(t('rack.stl.tooBigTitle', 'File too large'), {
                      body: t('rack.stl.tooBigBody', 'STL files larger than 5 MB are rejected, otherwise project save explodes.'),
                      okLabel: 'OK',
                    })
                    event.target.value = ''
                    return
                  }
                  const buf = await file.arrayBuffer()
                  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
                  const dataUri = `data:application/octet-stream;base64,${b64}`
                  onUpdate(selectedPlacement.id, { stlDataUri: dataUri })
                  const tpl = templates.find((tt) => tt.name === selectedPlacement.templateName)
                  if (tpl) onSyncStlToTemplate(selectedPlacement.templateName, dataUri)
                  event.target.value = ''
                }}
                className="hidden"
              />
            </label>
            {selectedPlacement.stlDataUri && (
              <button
                type="button"
                onClick={() => {
                  onUpdate(selectedPlacement.id, { stlDataUri: undefined })
                  const tpl = templates.find((tt) => tt.name === selectedPlacement.templateName)
                  if (tpl && tpl.stlDataUri) onSyncStlToTemplate(selectedPlacement.templateName, undefined)
                }}
                className="rounded border border-cp-surface-5 bg-cp-surface-4 px-2 py-1 text-cp-xs text-cp-text-bright hover:bg-cp-surface-5"
                title={t('rack.stlRemoveTitle', 'Remove STL — device renders as a box again')}
              >
                <Icon icon={X} size="xs" className="mr-1 inline" />
                {t('common.remove', 'Remove')}
              </button>
            )}
          </div>
          {selectedPlacement.stlDataUri && (
            <div className="mt-2">
              <StlPreview stlDataUri={selectedPlacement.stlDataUri} size={120} />
            </div>
          )}
          <span className="mt-1 flex items-start gap-1 text-cp-xs text-cp-text-muted">
            {selectedPlacement.stlDataUri ? (
              <>
                <Icon icon={Check} size="xs" className="mt-0.5 shrink-0" />
                {t('rack.stl.loaded', 'STL loaded — rendered in the 3D tab and saved permanently with the device (library + project).')}
              </>
            ) : (
              t('rack.stl.noStl', 'Without STL the device is rendered as a box with front/rear photo.')
            )}
          </span>
        </div>
        {(() => {
          const tpl = templates.find((tt) => tt.name === selectedPlacement.templateName)
          const rackDepthRender = rackDepthMm ?? 800
          const devDepth = tpl?.depthMm ?? selectedPlacement.depthMm ?? 400
          const maxZ = Math.max(0, rackDepthRender - devDepth)
          // #521(c2) — Tiefen-(Z-)Position für ALLE Rack-Geräte editierbar.
          // Klassische Geräte (ohne Shelf-Maße) bekamen vorher 'return null' →
          // keine Z-Editierung, Gerät klebte an Front/Rückwand. Jetzt eigenes
          // Tiefen-Feld; Shelf-Devices behalten ihr X+Z-Panel unverändert.
          if (!(tpl?.widthMm && tpl?.heightMm)) {
            return (
              <details className="rounded border border-cp-border-muted bg-cp-surface-1/40 p-2" open>
                <summary className="cursor-pointer text-cp-xs font-semibold text-cp-text-secondary">{t('rack.depthPos.title', 'Depth position (Z)')}</summary>
                <label className="mt-2 block text-cp-xs">
                  <span className="mb-0.5 block text-cp-text-muted">{t('rack.depthPos.depthFromFront', 'Depth (mm from front)')}</span>
                  <input
                    type="number"
                    min={0}
                    max={maxZ}
                    step={10}
                    value={Math.round(selectedPlacement.shelfOffsetZ ?? 0)}
                    onChange={(e) =>
                      onUpdate(selectedPlacement.id, {
                        shelfOffsetZ: Math.max(0, Math.min(maxZ, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1"
                  />
                  <span className="text-cp-xs text-cp-text-muted">{format(t('rack.depthPos.maxFront', 'max {max} mm · 0 = front'), { max: Math.round(maxZ) })}</span>
                </label>
              </details>
            )
          }
          const maxX = Math.max(0, RACK_MOUNT_WIDTH_MM - tpl.widthMm)
          return (
            <details className="rounded border border-emerald-800 bg-emerald-900/20 p-2" open>
              <summary className="cursor-pointer text-cp-xs font-semibold text-emerald-200">
                <Icon icon={Rows3} size="xs" className="mr-1 inline" />
                {t('rack.shelfPos.title', 'Shelf position')}
                <span className="ml-1 text-emerald-400">
                  ({tpl.widthMm}×{tpl.heightMm}×{tpl.depthMm ?? 400} mm)
                </span>
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-cp-xs">
                  <span className="mb-0.5 block text-emerald-300/80">{t('rack.shelfPos.horizontal', 'Horizontal (mm from left rail)')}</span>
                  <input
                    type="number"
                    min={0}
                    max={maxX}
                    step={5}
                    value={Math.round(selectedPlacement.shelfOffsetX ?? 0)}
                    onChange={(e) =>
                      onUpdate(selectedPlacement.id, {
                        shelfOffsetX: Math.max(0, Math.min(maxX, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1"
                  />
                  <span className="text-cp-xs text-cp-text-muted">{format(t('rack.shelfPos.maxMm', 'max {max} mm'), { max: Math.round(maxX) })}</span>
                </label>
                <label className="block text-cp-xs">
                  <span className="mb-0.5 block text-emerald-300/80">{t('rack.depthPos.depthFromFront', 'Depth (mm from front)')}</span>
                  <input
                    type="number"
                    min={0}
                    max={maxZ}
                    step={10}
                    value={Math.round(selectedPlacement.shelfOffsetZ ?? 0)}
                    onChange={(e) =>
                      onUpdate(selectedPlacement.id, {
                        shelfOffsetZ: Math.max(0, Math.min(maxZ, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1"
                  />
                  <span className="text-cp-xs text-cp-text-muted">{format(t('rack.shelfPos.maxMm', 'max {max} mm'), { max: Math.round(maxZ) })}</span>
                </label>
              </div>
              <div className="mt-1 text-cp-xs text-cp-text-muted">
                {t('rack.shelfPos.tip', 'Tip: In the 2D tab you can also drag the device horizontally with the mouse. Depth position is only editable here or in the 3D tab.')}
              </div>
            </details>
          )
        })()}
        <details className="rounded border border-cp-border-muted bg-cp-surface-1/40 p-2" open>
          <summary className="cursor-pointer text-cp-xs font-semibold text-cp-text-secondary">
            {t('rack.portSideSection.title', 'Port side (front/rear)')}
            <span className="ml-1 text-cp-text-faint">
              {format(t('rack.portSideSection.counts', '({inputs} inputs / {outputs} outputs)'), { inputs: selectedPlacement.inputs.length, outputs: selectedPlacement.outputs.length })}
            </span>
          </summary>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1 text-cp-xs">
            <button
              type="button"
              onClick={() =>
                onUpdate(selectedPlacement.id, {
                  inputs: selectedPlacement.inputs.map((p) => ({ ...p, rackSide: 'rear' as const })),
                  outputs: selectedPlacement.outputs.map((p) => ({ ...p, rackSide: 'rear' as const })),
                })
              }
              className="rounded bg-purple-900/40 px-2 py-1 text-purple-200 hover:bg-purple-900/60"
              title={t('rack.portsAllRear', 'All ports to the rear (default for classic server gear)')}
            >
              <Icon icon={ArrowDownToLine} size="xs" className="mr-1 inline" />
              {t('rack.portsAllRearBtn', 'all to rear')}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdate(selectedPlacement.id, {
                  inputs: selectedPlacement.inputs.map((p) => ({
                    ...p,
                    rackSide: (p.rackSide ?? 'rear') === 'front' ? ('rear' as const) : ('front' as const),
                  })),
                  outputs: selectedPlacement.outputs.map((p) => ({
                    ...p,
                    rackSide: (p.rackSide ?? 'rear') === 'front' ? ('rear' as const) : ('front' as const),
                  })),
                })
              }
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-text hover:bg-cp-surface-5"
              title={t('rack.portsSwap', 'Front ports become rear ports and vice versa')}
            >
              ↔ {t('rack.portsSwapBtn', 'mirror')}
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdate(selectedPlacement.id, {
                  inputs: selectedPlacement.inputs.map((p) => ({ ...p, rackSide: 'front' as const })),
                  outputs: selectedPlacement.outputs.map((p) => ({ ...p, rackSide: 'front' as const })),
                })
              }
              className="rounded bg-green-900/40 px-2 py-1 text-green-200 hover:bg-green-900/60"
              title={t('rack.portsAllFront', 'All ports to the front (e.g. front-panel devices)')}
            >
              <Icon icon={ArrowUpToLine} size="xs" className="mr-1 inline" />
              {t('rack.portsAllFrontBtn', 'all to front')}
            </button>
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto rounded border border-cp-border-muted">
            {[
              ...selectedPlacement.inputs.map((p) => ({ port: p, dir: 'in' as const })),
              ...selectedPlacement.outputs.map((p) => ({ port: p, dir: 'out' as const })),
            ].map(({ port, dir }) => {
              const side: 'front' | 'rear' = port.rackSide ?? 'rear'
              return (
                <div
                  key={port.id}
                  className="flex items-center justify-between gap-2 border-t border-cp-border-muted/60 px-2 py-0.5 text-cp-xs first:border-t-0"
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className={`shrink-0 rounded px-1 text-cp-xs font-bold uppercase ${
                        dir === 'in' ? 'bg-cyan-900/60 text-cyan-200' : 'bg-emerald-900/60 text-emerald-200'
                      }`}
                      title={dir === 'in' ? t('rack.portDir.input', 'Input (signal in)') : t('rack.portDir.output', 'Output (signal out)')}
                    >
                      {dir}
                    </span>
                    {/* #472 — Patchblende/Ports auch im Rack umbenennbar. */}
                    <input
                      value={port.name}
                      onChange={(e) => {
                        const name = e.target.value
                        const key = dir === 'in' ? 'inputs' : 'outputs'
                        onUpdate(selectedPlacement.id, {
                          [key]: selectedPlacement[key].map((p) =>
                            p.id === port.id ? { ...p, name } : p,
                          ),
                        })
                      }}
                      title={t('rack.portRename', 'Edit port name')}
                      className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-cp-text-secondary hover:border-cp-border focus:border-sky-600 focus:bg-cp-surface-3 focus:outline-none"
                    />
                    <span className="shrink-0 text-cp-text-faint">· {port.connectorType}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newSide: 'front' | 'rear' = side === 'front' ? 'rear' : 'front'
                      if (dir === 'in') {
                        onUpdate(selectedPlacement.id, {
                          inputs: selectedPlacement.inputs.map((p) =>
                            p.id === port.id ? { ...p, rackSide: newSide } : p,
                          ),
                        })
                      } else {
                        onUpdate(selectedPlacement.id, {
                          outputs: selectedPlacement.outputs.map((p) =>
                            p.id === port.id ? { ...p, rackSide: newSide } : p,
                          ),
                        })
                      }
                    }}
                    className={`shrink-0 rounded border px-1.5 py-0.5 font-semibold transition ${
                      side === 'front'
                        ? 'border-green-700 bg-green-900/40 text-green-200 hover:bg-green-900/60'
                        : 'border-purple-700 bg-purple-900/40 text-purple-200 hover:bg-purple-900/60'
                    }`}
                    title={format(
                      t('rack.portSide.toggleTitle', 'Toggle port side (currently: {side})'),
                      { side: side === 'front' ? t('rack.portSide.front', 'front') : t('rack.portSide.rear', 'rear') },
                    )}
                  >
                    <Icon
                      icon={side === 'front' ? ArrowUpToLine : ArrowDownToLine}
                      size="xs"
                      className="mr-1 inline"
                    />
                    {side === 'front'
                      ? t('rack.portSide.front', 'front')
                      : t('rack.portSide.rear', 'rear')}
                  </button>
                </div>
              )
            })}
          </div>
        </details>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-cp-xs font-semibold text-cp-text-muted">{t('rack.panelImages.header', 'Panel images (import + crop)')}</div>
            {(selectedPlacement.frontPanelImageUrl || selectedPlacement.rearPanelImageUrl) && (
              <button
                type="button"
                onClick={() =>
                  onUpdate(selectedPlacement.id, {
                    frontPanelImageUrl: selectedPlacement.rearPanelImageUrl,
                    rearPanelImageUrl: selectedPlacement.frontPanelImageUrl,
                    frontPanelCrop: selectedPlacement.rearPanelCrop,
                    rearPanelCrop: selectedPlacement.frontPanelCrop,
                  })
                }
                className="rounded bg-cp-surface-4 px-2 py-0.5 text-cp-xs text-cp-text-bright hover:bg-cp-surface-5"
                title={t('rack.swapPhotos', 'Swap front and rear photo (if the mapping is wrong)')}
              >
                ↔ {t('rack.swapPhotosBtn', 'Swap front/rear')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['front', 'rear'] as const).map((side) => {
              const urlKey = side === 'front' ? 'frontPanelImageUrl' : 'rearPanelImageUrl'
              const currentUrl = selectedPlacement[urlKey]
              const label = side === 'front' ? t('rack.panelImages.front', 'Front') : t('rack.panelImages.rear', 'Rear')
              const btnColor = side === 'front' ? 'bg-sky-700 hover:bg-sky-600' : 'bg-purple-700 hover:bg-purple-600'
              return (
                <div key={side} className="space-y-1">
                  <button
                    type="button"
                    className={`w-full rounded ${btnColor} px-2 py-1 text-cp-xs`}
                    onClick={async () => {
                      const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                      if (dataUri) onPickPanelImage(selectedPlacement.id, side, dataUri)
                    }}
                  >
                    {currentUrl
                      ? format(t('rack.panelImages.replace', 'Replace {side}…'), { side: label })
                      : format(t('rack.panelImages.import', 'Import {side}…'), { side: label })}
                  </button>
                  {currentUrl && (
                    <div className="flex items-center gap-1">
                      <img src={currentUrl} alt={`${side} panel`} className="h-7 flex-1 rounded border border-cp-border object-contain" />
                      <button
                        type="button"
                        onClick={() => onUpdate(selectedPlacement.id, { [urlKey]: undefined, [side === 'front' ? 'frontPanelCrop' : 'rearPanelCrop']: undefined })}
                        className="rounded px-1.5 py-0.5 text-cp-xs text-red-400 hover:bg-red-900/40 hover:text-red-300"
                        title={t('rack.removeImage', 'Remove image')}
                      >
                        <Icon icon={X} size="xs" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </ModalShell>
  )
}
