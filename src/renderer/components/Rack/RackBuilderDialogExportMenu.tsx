import { useState, type RefObject } from 'react'
import { Box, Camera, ChevronDown, Save } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { v4 as uuidv4 } from 'uuid'
import * as THREE from 'three'
import type { EquipmentTemplate, GroupPreset } from '../../types/equipment'
import { useTranslation } from '../../lib/i18n'
import {
  exportRack2DAsPng,
  exportRack3DAsPngs,
  exportRackAsStl,
  exportRackAsCpgroup,
} from '../../lib/exportRack'

/** v7.9.83 / #170 — Export-Menu: 2D-PNG, 3D-PNG (alle 4 Perspektiven),
 *  3D-STL, .cpgroup mit allen Assets.
 *
 *  Issue #310 — aus RackBuilderDialog ausgelagert. Die vier Buttons
 *  konsumieren je drei Schnittstellen:
 *    1. das aktuell sichtbare 2D-Rack-DOM-Element (rackCanvasRef)
 *    2. die 3D-Renderer-Refs (gl/scene/camera) sobald der 3D-Tab
 *       initialisiert wurde
 *    3. den aktuellen Draft + ggf. die editingId fuer den
 *       .cpgroup-Snapshot. Snapshot-Logik bleibt 1:1 wie vorher. */

export interface RackPlacementSnapshot {
  name: string
  category: string
  inputs: EquipmentTemplate['inputs']
  outputs: EquipmentTemplate['outputs']
  isRackDevice: boolean
  rackUnits: number
  startUnit: number
  frontPanelImageUrl?: string
  rearPanelImageUrl?: string
  frontPanelCrop?: EquipmentTemplate['frontPanelCrop']
  rearPanelCrop?: EquipmentTemplate['rearPanelCrop']
  depthMm?: number
  stlDataUri?: string
  isPatchPanel?: boolean
  isRackShelf?: boolean
  mountSide?: 'front' | 'rear' | 'full'
  shelfOffsetX?: number
  shelfOffsetZ?: number
}

export interface RackBuilderDialogExportMenuProps {
  rackName: string
  totalUnits: number
  depthMm?: number
  placements: RackPlacementSnapshot[]
  editingId?: string
  /** Ref auf das 2D-Rack-Canvas-DOM (fuer PNG-Export). Als Ref statt Wert
   *  uebergeben, damit der Parent .current nicht waehrend des Renders liest
   *  (react-hooks/refs). */
  rackCanvasRef: RefObject<HTMLDivElement | null>
  /** Ref auf die Three.js-Renderer-Refs (sobald 3D-Tab initialisiert wurde). */
  canvas3DRefs: RefObject<{
    gl: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
  } | null>
}

export const RackBuilderDialogExportMenu = ({
  rackName,
  totalUnits,
  depthMm,
  placements,
  editingId,
  rackCanvasRef,
  canvas3DRefs,
}: RackBuilderDialogExportMenuProps) => {
  const t = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('rack.exportTitle', 'Rack exportieren (PNG / STL / .cpgroup)')}
        className="flex h-8 items-center gap-1 rounded border border-cp-border bg-cp-surface-2 px-3 text-cp-xs text-cp-text-secondary hover:border-sky-500/50 hover:bg-sky-900/30 hover:text-sky-200"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1 L8 10 M4 7 L8 11 L12 7 M2 13 L14 13" />
        </svg>
        {t('rack.exportBtn', 'Exportieren')}<Icon icon={ChevronDown} size="xs" className="ml-1 inline-block align-text-bottom" />
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          className="absolute right-0 top-9 z-50 w-64 overflow-hidden rounded border border-cp-border bg-cp-surface-1 text-cp-xs shadow-2xl"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              const rackCanvasEl = rackCanvasRef.current
              if (!rackCanvasEl) return
              void exportRack2DAsPng(rackCanvasEl, rackName || 'rack')
            }}
            className="flex w-full flex-col items-start gap-0.5 border-b border-cp-border-muted px-3 py-2 text-left text-cp-text-bright hover:bg-cp-surface-2"
          >
            <span className="font-semibold"><Icon icon={Camera} size="xs" className="mr-1 inline-block align-text-bottom" />{t('rack.export.png2d', '2D als PNG')}</span>
            <span className="text-[10px] text-cp-text-muted">
              {t('rack.export.png2dDesc', 'Aktuelle Front/Rear/Both-Ansicht als Bild')}
            </span>
          </button>
          <button
            type="button"
            onClick={async () => {
              setOpen(false)
              const refs = canvas3DRefs.current
              if (!refs) {
                alert(t('rack.export.no3dInit', '3D-Tab muss zuerst geöffnet worden sein um die 3D-Szene zu initialisieren.'))
                return
              }
              await exportRack3DAsPngs(refs.gl, refs.scene, refs.camera, {
                rackName: rackName || 'rack',
                rackWidthMm: 482.6,
                rackHeightMm: totalUnits * 44.45,
                rackDepthMm: depthMm ?? 800,
              })
            }}
            className="flex w-full flex-col items-start gap-0.5 border-b border-cp-border-muted px-3 py-2 text-left text-cp-text-bright hover:bg-cp-surface-2"
          >
            <span className="font-semibold"><Icon icon={Camera} size="xs" className="mr-1 inline-block align-text-bottom" />{t('rack.export.png3d', '3D aus 4 Perspektiven')}</span>
            <span className="text-[10px] text-cp-text-muted">
              {t('rack.export.png3dDesc', 'PNG: Front · Rear · Iso · Top (1× pro Datei)')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              const refs = canvas3DRefs.current
              if (!refs) {
                alert(t('rack.export.no3dInit', '3D-Tab muss zuerst geöffnet worden sein um die 3D-Szene zu initialisieren.'))
                return
              }
              exportRackAsStl(refs.scene, rackName || 'rack')
            }}
            className="flex w-full flex-col items-start gap-0.5 border-b border-cp-border-muted px-3 py-2 text-left text-cp-text-bright hover:bg-cp-surface-2"
          >
            <span className="font-semibold"><Icon icon={Box} size="xs" className="mr-1 inline-block align-text-bottom" />{t('rack.export.stl', '3D als STL')}</span>
            <span className="text-[10px] text-cp-text-muted">
              {t('rack.export.stlDesc', 'Komplettes Rack als binäres STL (3D-Druck, CAD)')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              // Build the current preset snapshot ohne Save-Side-Effects.
              const sorted = placements.slice().sort((a, b) => a.startUnit - b.startUnit)
              const items: GroupPreset['items'] = sorted.map((p) => ({
                name: p.name,
                category: p.category,
                inputs: p.inputs,
                outputs: p.outputs,
                isRackDevice: p.isRackDevice,
                rackUnits: p.rackUnits,
                frontPanelImageUrl: p.frontPanelImageUrl,
                rearPanelImageUrl: p.rearPanelImageUrl,
                frontPanelCrop: p.frontPanelCrop,
                rearPanelCrop: p.rearPanelCrop,
                depthMm: p.depthMm,
                stlDataUri: p.stlDataUri,
                isPatchPanel: p.isPatchPanel,
                isRackShelf: p.isRackShelf,
                width: 240,
                height: 80 + Math.max(p.inputs.length, p.outputs.length, 3) * 22,
                offsetX: 0,
                offsetY: (p.startUnit - 1) * 44,
              }))
              const rackPlacements = sorted.map((p, i) => ({
                itemIndex: i,
                startUnit: p.startUnit,
                heightUnits: p.rackUnits,
                ...(p.mountSide ? { mountSide: p.mountSide } : {}),
                // #521 — auch 0 persistieren (linke Kante/Front); `!= null`
                // statt truthy, sonst geht Position 0 beim Export verloren.
                ...(p.shelfOffsetX != null ? { shelfOffsetX: p.shelfOffsetX } : {}),
                ...(p.shelfOffsetZ != null ? { shelfOffsetZ: p.shelfOffsetZ } : {}),
              }))
              const preset: GroupPreset = {
                id: editingId ?? uuidv4(),
                name: rackName.trim() || 'rack',
                rack: {
                  totalUnits,
                  ...(depthMm ? { depthMm } : {}),
                  placements: rackPlacements,
                },
                items,
                cables: [],
              }
              exportRackAsCpgroup(preset)
            }}
            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-cp-text-bright hover:bg-cp-surface-2"
          >
            <span className="font-semibold"><Icon icon={Save} size="xs" className="mr-1 inline-block align-text-bottom" />{t('rack.export.cpgroup', '.cpgroup herunterladen')}</span>
            <span className="text-[10px] text-cp-text-muted">
              {t('rack.export.cpgroupDesc', 'Komplettes Rack inkl. STL + Fotos zum Cross-PC-Transfer')}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
