import { useTranslation, format } from '../../lib/i18n'
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
      title={format(t('rack.props.title', 'Eigenschaften · {name}'), { name: selectedPlacement.name })}
      titleIcon={
        <span className="rounded bg-amber-900/60 px-1.5 py-0.5 text-[11px] font-semibold text-amber-200">
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
            {t('rack.props.removeFromRack', 'Aus Rack entfernen')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
          >
            {t('common.close', 'Schließen')}
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
          {t('rack.props.category', 'Kategorie')}
          <CategorySelect
            value={selectedPlacement.category}
            onChange={(category) => onUpdate(selectedPlacement.id, { category })}
            extraOptions={[...categoryOptions, selectedPlacement.category]}
            className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
          />
        </label>
        <label className="flex items-center gap-2 opacity-60" title={t('rack.readonlyInBuilder', 'Im Builder schreibgeschützt — wurde beim Hinzufügen gesetzt.')}>
          <input type="checkbox" checked={selectedPlacement.isRackDevice} disabled readOnly />
          <span>{t('rack.isRackInBuilder', 'Ist Rack-Gerät (im Builder fix)')}</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            {t('rack.props.heightHe', 'Höhe (HE)')}
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
              <span className="mt-0.5 block text-[10px] text-red-400">
                {format(
                  t(
                    'rack.props.heightOverflow',
                    'Höhe + Start-HE überschreitet Rack ({total} HE).',
                  ),
                  { total: totalUnits },
                )}
              </span>
            )}
          </label>
          <label className="block">
            {t('rack.props.startHe', 'Start-HE')}
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
            <span className="mt-0.5 block text-[10px] text-cp-text-muted">
              {format(
                t('rack.props.maxHint', 'max {max} (Höhe {he} HE)'),
                { max: startMax, he: selectedPlacement.rackUnits },
              )}
            </span>
          </label>
        </div>
        {/* v7.9.73 / #170 — 3D-Felder: Tiefe + Mount-Side + STL. */}
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            {t('rack.props.depthMm', 'Tiefe (mm)')}
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
              title={t('rack.deviceDepthTitle', 'Geräte-Tiefe in mm. Leer = 400 mm Standard. Wird vom 3D-Tab visualisiert.')}
            />
          </label>
          <label className="block">
            {t('rack.mountLabel', 'Montage')}
            <select
              value={selectedPlacement.mountSide ?? 'full'}
              onChange={(event) =>
                onUpdate(selectedPlacement.id, {
                  mountSide: event.target.value as 'front' | 'rear' | 'full',
                })
              }
              className="mt-1 w-full rounded border border-cp-border bg-cp-surface-3 p-1.5"
              title={t('rack.mountTitle', 'full = volle Rack-Tiefe. front = nur vorne. rear = nur hinten (z.B. Patchblende).')}
            >
              <option value="full">{t('rack.mount.full', 'Full-Depth')}</option>
              <option value="front">{t('props.rack.frontOnly', 'Nur vorne')}</option>
              <option value="rear">{t('props.rack.rearOnly', 'Nur hinten')}</option>
            </select>
          </label>
        </div>
        {/* STL-Upload für 3D-Modell. */}
        <div className="block">
          <div className="mb-1 text-cp-xs text-cp-text-secondary">{t('rack.stl.header', '3D-Modell (STL, optional)')}</div>
          <div className="mt-1 flex items-center gap-2">
            <label
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-cp-surface-5 bg-sky-700 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-600"
              title={t('rack.stlUploadTitle', 'STL-Datei (.stl, max 5 MB) zum Gerät hochladen')}
            >
              <span>📁</span>
              <span>{selectedPlacement.stlDataUri
                ? t('rack.stl.replace', 'STL ersetzen…')
                : t('rack.stl.pick', 'STL auswählen…')}</span>
              <input
                type="file"
                accept=".stl,application/octet-stream"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  if (file.size > 5 * 1024 * 1024) {
                    await confirmDialog(t('rack.stl.tooBigTitle', 'Datei zu groß'), {
                      body: t('rack.stl.tooBigBody', 'STL-Dateien über 5 MB werden nicht angenommen, sonst explodiert der Projekt-Save.'),
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
                className="rounded border border-cp-surface-5 bg-cp-surface-4 px-2 py-1 text-[11px] text-cp-text-bright hover:bg-cp-surface-5"
                title={t('rack.stlRemoveTitle', 'STL entfernen — Gerät wird wieder als Box gerendert')}
              >
                ✕ {t('common.remove', 'Entfernen')}
              </button>
            )}
          </div>
          {selectedPlacement.stlDataUri && (
            <div className="mt-2">
              <StlPreview stlDataUri={selectedPlacement.stlDataUri} size={120} />
            </div>
          )}
          <span className="mt-1 block text-[10px] text-cp-text-muted">
            {selectedPlacement.stlDataUri
              ? t('rack.stl.loaded', '✓ STL geladen — wird im 3D-Tab gerendert und permanent am Gerät gespeichert (Library + Projekt).')
              : t('rack.stl.noStl', 'Ohne STL wird das Gerät als Box mit Front-/Rear-Foto dargestellt.')}
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
                <summary className="cursor-pointer text-[11px] font-semibold text-cp-text-secondary">{t('rack.depthPos.title', 'Tiefen-Position (Z)')}</summary>
                <label className="mt-2 block text-[10px]">
                  <span className="mb-0.5 block text-cp-text-muted">{t('rack.depthPos.depthFromFront', 'Tiefe (mm von vorne)')}</span>
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
                  <span className="text-[11px] text-cp-text-muted">{format(t('rack.depthPos.maxFront', 'max {max} mm · 0 = Front'), { max: Math.round(maxZ) })}</span>
                </label>
              </details>
            )
          }
          const maxX = Math.max(0, RACK_MOUNT_WIDTH_MM - tpl.widthMm)
          return (
            <details className="rounded border border-emerald-800 bg-emerald-900/20 p-2" open>
              <summary className="cursor-pointer text-[11px] font-semibold text-emerald-200">
                🪑 {t('rack.shelfPos.title', 'Shelf-Position')}
                <span className="ml-1 text-emerald-400">
                  ({tpl.widthMm}×{tpl.heightMm}×{tpl.depthMm ?? 400} mm)
                </span>
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-[10px]">
                  <span className="mb-0.5 block text-emerald-300/80">{t('rack.shelfPos.horizontal', 'Horizontal (mm vom linken Rail)')}</span>
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
                  <span className="text-[11px] text-cp-text-muted">{format(t('rack.shelfPos.maxMm', 'max {max} mm'), { max: Math.round(maxX) })}</span>
                </label>
                <label className="block text-[10px]">
                  <span className="mb-0.5 block text-emerald-300/80">{t('rack.depthPos.depthFromFront', 'Tiefe (mm von vorne)')}</span>
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
                  <span className="text-[11px] text-cp-text-muted">{format(t('rack.shelfPos.maxMm', 'max {max} mm'), { max: Math.round(maxZ) })}</span>
                </label>
              </div>
              <div className="mt-1 text-[10px] text-cp-text-muted">
                {t('rack.shelfPos.tip', 'Tipp: Im 2D-Tab kannst du das Gerät auch horizontal per Maus verschieben. Tiefen-Position nur hier oder im 3D-Tab editierbar.')}
              </div>
            </details>
          )
        })()}
        <details className="rounded border border-cp-border-muted bg-cp-surface-1/40 p-2" open>
          <summary className="cursor-pointer text-[11px] font-semibold text-cp-text-secondary">
            {t('rack.portSideSection.title', 'Port-Seite (Front/Rear)')}
            <span className="ml-1 text-cp-text-faint">
              {format(t('rack.portSideSection.counts', '({inputs} Inputs / {outputs} Outputs)'), { inputs: selectedPlacement.inputs.length, outputs: selectedPlacement.outputs.length })}
            </span>
          </summary>
          <div className="mt-2 grid grid-cols-3 gap-1 text-[10px]">
            <button
              type="button"
              onClick={() =>
                onUpdate(selectedPlacement.id, {
                  inputs: selectedPlacement.inputs.map((p) => ({ ...p, rackSide: 'rear' as const })),
                  outputs: selectedPlacement.outputs.map((p) => ({ ...p, rackSide: 'rear' as const })),
                })
              }
              className="rounded bg-purple-900/40 px-2 py-1 text-purple-200 hover:bg-purple-900/60"
              title={t('rack.portsAllRear', 'Alle Ports nach hinten (Default für klassische Server-Geräte)')}
            >
              ⏬ {t('rack.portsAllRearBtn', 'alle nach hinten')}
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
              title={t('rack.portsSwap', 'Front-Ports werden zu Rear-Ports und umgekehrt')}
            >
              ↔ {t('rack.portsSwapBtn', 'spiegeln')}
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
              title={t('rack.portsAllFront', 'Alle Ports nach vorne (z.B. Frontpanel-Geräte)')}
            >
              ⏫ {t('rack.portsAllFrontBtn', 'alle nach vorne')}
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
                  className="flex items-center justify-between gap-2 border-t border-cp-border-muted/60 px-2 py-0.5 text-[10px] first:border-t-0"
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className={`shrink-0 rounded px-1 text-[8px] font-bold uppercase ${
                        dir === 'in' ? 'bg-cyan-900/60 text-cyan-200' : 'bg-emerald-900/60 text-emerald-200'
                      }`}
                      title={dir === 'in' ? t('rack.portDir.input', 'Input (Signal-Eingang)') : t('rack.portDir.output', 'Output (Signal-Ausgang)')}
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
                      title={t('rack.portRename', 'Port-Name bearbeiten')}
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
                      t('rack.portSide.toggleTitle', 'Port-Seite umschalten (aktuell: {side})'),
                      { side: side === 'front' ? t('rack.portSide.front', 'vorne') : t('rack.portSide.rear', 'hinten') },
                    )}
                  >
                    {side === 'front'
                      ? '⏫ ' + t('rack.portSide.front', 'vorne')
                      : '⏬ ' + t('rack.portSide.rear', 'hinten')}
                  </button>
                </div>
              )
            })}
          </div>
        </details>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-cp-text-muted">{t('rack.panelImages.header', 'Panel-Bilder (Import + Zuschneiden)')}</div>
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
                className="rounded bg-cp-surface-4 px-2 py-0.5 text-[10px] text-cp-text-bright hover:bg-cp-surface-5"
                title={t('rack.swapPhotos', 'Front- und Rear-Foto vertauschen (falls die Zuordnung falsch ist)')}
              >
                ↔ {t('rack.swapPhotosBtn', 'Front/Rear tauschen')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['front', 'rear'] as const).map((side) => {
              const urlKey = side === 'front' ? 'frontPanelImageUrl' : 'rearPanelImageUrl'
              const currentUrl = selectedPlacement[urlKey]
              const label = side === 'front' ? t('rack.panelImages.front', 'Vorne') : t('rack.panelImages.rear', 'Hinten')
              const btnColor = side === 'front' ? 'bg-sky-700 hover:bg-sky-600' : 'bg-purple-700 hover:bg-purple-600'
              return (
                <div key={side} className="space-y-1">
                  <button
                    type="button"
                    className={`w-full rounded ${btnColor} px-2 py-1 text-[11px]`}
                    onClick={async () => {
                      const dataUri = await pickImageAsDataUri('image/png,image/jpeg,image/webp')
                      if (dataUri) onPickPanelImage(selectedPlacement.id, side, dataUri)
                    }}
                  >
                    {currentUrl
                      ? format(t('rack.panelImages.replace', '{side} ersetzen…'), { side: label })
                      : format(t('rack.panelImages.import', '{side} importieren…'), { side: label })}
                  </button>
                  {currentUrl && (
                    <div className="flex items-center gap-1">
                      <img src={currentUrl} alt={`${side} panel`} className="h-7 flex-1 rounded border border-cp-border object-contain" />
                      <button
                        type="button"
                        onClick={() => onUpdate(selectedPlacement.id, { [urlKey]: undefined, [side === 'front' ? 'frontPanelCrop' : 'rearPanelCrop']: undefined })}
                        className="rounded px-1.5 py-0.5 text-[10px] text-red-400 hover:bg-red-900/40 hover:text-red-300"
                        title={t('rack.removeImage', 'Bild entfernen')}
                      >
                        ✕
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
