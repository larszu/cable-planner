import { useState, type RefObject } from 'react'
import { Box, Camera, ChevronDown, Save } from 'lucide-react'
import { Icon } from '../shared/Icon'
import * as THREE from 'three'
import type { GroupPreset } from '../../types/equipment'
import { useTranslation } from '../../lib/i18n'
import { infoDialog } from '../../lib/infoDialog'
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
 *    3. den Preset-Erbauer des Dialogs (buildPreset) fuer den
 *       .cpgroup-Export.
 *
 *  ADR-005 — bis Inkrement 4 stand hier eine eigene Snapshot-Logik
 *  („bleibt 1:1 wie vorher"), die neben dem Speichern-Pfad herlief und
 *  dabei die interne Verkabelung, die Canvas-Positionen und die
 *  Rentman-Ids verlor. Sie ist weg; beide Wege bauen jetzt gleich. */

export interface RackBuilderDialogExportMenuProps {
  rackName: string
  totalUnits: number
  depthMm?: number
  /**
   * Baut den aktuellen Draft in ein `GroupPreset` — DIESELBE Funktion, die
   * der Speichern-Pfad benutzt (lib/rackPreset.ts). Als Callback statt als
   * Rohdaten, damit hier keine zweite Aufzaehlung entstehen kann: die letzte
   * hat die interne Verkabelung des Racks verschluckt.
   */
  buildPreset: () => GroupPreset
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
  buildPreset,
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
                await infoDialog(t('rack.export.no3dInit', '3D-Tab muss zuerst geöffnet worden sein um die 3D-Szene zu initialisieren.'), { tone: 'warning' })
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
                // Dieser Handler ist nicht async (der PNG-Export daneben schon).
                void infoDialog(t('rack.export.no3dInit', '3D-Tab muss zuerst geöffnet worden sein um die 3D-Szene zu initialisieren.'), { tone: 'warning' })
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
              // ADR-005 — Hier stand eine ZWEITE Aufzaehlung derselben
              // Umwandlung, die neben dem Speichern-Pfad hergelaufen ist:
              // sie schrieb `cables: []` (die komplette interne Verkabelung
              // fiel weg, obwohl der Menuepunkt „Komplettes Rack" verspricht),
              // keine internalCanvasPositions und seit #335 auch die
              // rentmanIds nicht mehr. Jetzt derselbe Erbauer wie beim
              // Speichern — es gibt nur noch eine Aufzaehlung.
              const preset = buildPreset()
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
