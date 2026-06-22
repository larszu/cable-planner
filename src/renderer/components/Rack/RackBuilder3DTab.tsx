import type * as THREE from 'three'
import type { EquipmentTemplate } from '../../types/equipment'
import { useTranslation } from '../../lib/i18n'
import { Rack3DView } from './Rack3DView'
import type { InternalCableDraft, RackPlacementDraft } from './rackBuilderTypes'

/** v7.9.73 / #170 — 3D-Tab: nur lesende Orbit-Ansicht.
 *  Bearbeitung geht weiter im 2D-Tab.
 *  v7.9.75 / #170 — View-Mode-Filter über den Placements:
 *  'all' / 'free' / 'released' ausgewertet anhand draft.internalCables.
 *
 *  Issue #310 — aus RackBuilderDialog ausgelagert. Bekommt den Slice
 *  des Drafts den die 3D-Ansicht braucht + 6 Callbacks (Selektion,
 *  Canvas-Refs, Shelf-Drag, Port-Drag, Template-Drop, Render-Mode). */

export type Rack3DRenderMode = 'all' | 'free' | 'released'

export interface RackBuilder3DTabProps {
  totalUnits: number
  rackDepthMm?: number
  placements: RackPlacementDraft[]
  internalCables: InternalCableDraft[]
  templates: EquipmentTemplate[]
  selectedPlacementId: string | null
  renderMode: Rack3DRenderMode
  /** #472 — Steckverbinder-Symbole als Panel-Textur zeigen. */
  showSymbols?: boolean
  onSelectPlacement: (id: string | null) => void
  onSetRenderMode: (mode: Rack3DRenderMode) => void
  onCanvasRefsReady: (refs: {
    gl: THREE.WebGLRenderer
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
  }) => void
  onShelfDeviceMoved: (placementId: string, offset: { x: number; z: number }) => void
  onPortMoved: (
    placementId: string,
    portId: string,
    side: 'front' | 'rear',
    pos: { x: number; y: number },
  ) => void
  onTemplateDropped: (template: EquipmentTemplate, mount: 'front' | 'rear' | 'full') => void
}

export const RackBuilder3DTab = ({
  totalUnits,
  rackDepthMm,
  placements,
  internalCables,
  templates,
  selectedPlacementId,
  renderMode,
  showSymbols,
  onSelectPlacement,
  onSetRenderMode,
  onCanvasRefsReady,
  onShelfDeviceMoved,
  onPortMoved,
  onTemplateDropped,
}: RackBuilder3DTabProps) => {
  const t = useTranslation()

  return (
    <>
      <div className="mb-2 flex items-center gap-1 text-[10px]">
        <span className="text-cp-text-faint">{t('rack.view.label', 'Ansicht:')}</span>
        {(['all', 'free', 'released'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSetRenderMode(m)}
            className={`rounded px-2 py-0.5 ${
              renderMode === m
                ? 'bg-purple-700 text-white'
                : 'bg-cp-surface-2 text-cp-text-muted hover:bg-cp-surface-4'
            }`}
            title={
              m === 'all'
                ? t('rack.view.allTitle', 'Alle Geräte + freie Ports + Patchblenden')
                : m === 'free'
                  ? t('rack.view.freeTitle', 'Nur Geräte mit freien Ports + Patchblenden')
                  : t('rack.view.releasedTitle', 'Nur freigegebene: Patchblenden + extern verkabelbare Geräte')
            }
          >
            {m === 'all'
              ? t('rack.view.all', 'Alle')
              : m === 'free'
                ? t('rack.view.free', 'Freie Ports')
                : t('rack.view.released', 'Released')}
          </button>
        ))}
      </div>
      {placements.length > 0 ? (
        <div
          style={{ height: 'min(75vh, 800px)' }}
          className="rounded border border-cp-border-muted bg-cp-surface-3"
          // v7.9.76 / #170 — Drag&Drop von Library-Cards auf die 3D-Canvas.
          // Da Raycast hier overkill wäre, nutzen wir smart-Placement:
          // Drop fügt das Gerät in den nächsten freien HE-Block ein.
          // Mount-Side wird aus dem Drop-X-Verhältnis abgeleitet: linkes
          // Drittel = front, rechtes Drittel = rear, Mitte = full.
          // Pragmatisch und intuitiv für 3D-Drops, wo präzise HE-Auswahl
          // schwierig ist.
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes(
              'application/x-cable-planner-rack-template',
            )) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(event) => {
            const raw = event.dataTransfer.getData(
              'application/x-cable-planner-rack-template',
            )
            if (!raw) return
            event.preventDefault()
            try {
              const parsed = JSON.parse(raw) as { name: string }
              const template = templates.find((tp) => tp.name === parsed.name)
              if (!template) return
              // Drop-X-Verhältnis: linkes Drittel = front, rechtes Drittel
              // = rear, Mitte = full.
              const host = event.currentTarget.getBoundingClientRect()
              const fracX = (event.clientX - host.left) / host.width
              const mount: 'front' | 'rear' | 'full' =
                fracX < 0.33 ? 'front' : fracX > 0.66 ? 'rear' : 'full'
              onTemplateDropped(template, mount)
            } catch {
              /* ignore */
            }
          }}
        >
          <Rack3DView
            totalUnits={totalUnits}
            rackDepthMm={rackDepthMm}
            showSymbols={showSymbols}
            placements={(() => {
              // Berechne pro Placement wie viele Ports schon intern verkabelt
              // sind. Patchblenden sind immer sichtbar (sie ZEIGEN die freien
              // Ports).
              const usedPortsByPlacement = new Map<string, Set<string>>()
              for (const c of internalCables) {
                if (!usedPortsByPlacement.has(c.fromPlacementId)) {
                  usedPortsByPlacement.set(c.fromPlacementId, new Set())
                }
                if (!usedPortsByPlacement.has(c.toPlacementId)) {
                  usedPortsByPlacement.set(c.toPlacementId, new Set())
                }
                usedPortsByPlacement.get(c.fromPlacementId)!.add(c.fromPortName)
                usedPortsByPlacement.get(c.toPlacementId)!.add(c.toPortName)
              }
              return placements
                .filter((p) => {
                  if (renderMode === 'all') return true
                  if (p.isPatchPanel || p.isRackShelf) return true
                  const usedSet = usedPortsByPlacement.get(p.id) ?? new Set()
                  const totalPorts = (p.inputs?.length ?? 0) + (p.outputs?.length ?? 0)
                  const hasFreePort = usedSet.size < totalPorts
                  if (renderMode === 'free') return hasFreePort
                  return hasFreePort
                })
                .map((p) => {
                  // v7.9.80 / #170 — Shelf-Device-Maße aus dem Template ziehen
                  // (sind im Builder nicht im RackPlacementDraft, sondern auf
                  // dem Library-Template gespeichert).
                  const tpl = templates.find((tp) => tp.name === p.templateName)
                  return {
                    id: p.id,
                    name: p.name,
                    startUnit: p.startUnit,
                    rackUnits: p.rackUnits,
                    depthMm: p.depthMm ?? tpl?.depthMm,
                    widthMm: tpl?.widthMm,
                    heightMm: tpl?.heightMm,
                    mountSide: p.mountSide,
                    stlDataUri: p.stlDataUri,
                    frontPanelImageUrl: p.frontPanelImageUrl,
                    rearPanelImageUrl: p.rearPanelImageUrl,
                    portCount: (p.inputs?.length ?? 0) + (p.outputs?.length ?? 0),
                    isPatchPanel: p.isPatchPanel,
                    isRackShelf: p.isRackShelf,
                    shelfOffsetX: p.shelfOffsetX,
                    shelfOffsetZ: p.shelfOffsetZ,
                    // v7.9.81 / #170 — Port-Side aus port.rackSide (Default
                    // 'rear' wenn nicht gesetzt). Inputs UND Outputs werden
                    // in einen Topf geworfen und nach rackSide aufgesplittet.
                    // Patchblenden sind die Ausnahme: dort wandert input →
                    // front, output → rear (klassisches Crossfield-Layout).
                    frontPorts: [...(p.inputs ?? []), ...(p.outputs ?? [])]
                      .filter((port) => {
                        if (p.isPatchPanel) {
                          // Patchblende: inputs = front, outputs = rear
                          return (p.inputs ?? []).some((i) => i.id === port.id)
                        }
                        return (port.rackSide ?? 'rear') === 'front'
                      })
                      .map((port) => ({
                        id: port.id,
                        name: port.name,
                        connectorType: port.connectorType,
                        panelPosX: port.panelPosX,
                        panelPosY: port.panelPosY,
                      })),
                    rearPorts: [...(p.inputs ?? []), ...(p.outputs ?? [])]
                      .filter((port) => {
                        if (p.isPatchPanel) {
                          return (p.outputs ?? []).some((o) => o.id === port.id)
                        }
                        return (port.rackSide ?? 'rear') === 'rear'
                      })
                      .map((port) => ({
                        id: port.id,
                        name: port.name,
                        connectorType: port.connectorType,
                        panelPosX: port.panelPosX,
                        panelPosY: port.panelPosY,
                      })),
                  }
                })
            })()}
            selectedPlacementId={selectedPlacementId}
            onSelectPlacement={(id) => onSelectPlacement(id)}
            // v7.9.83 / #170 — Canvas-Refs für den Export
            // (PNG aus N Perspektiven, STL).
            onCanvasRefsReady={onCanvasRefsReady}
            // v7.9.82 / #170 — Shelf-Device-Drag im 3D-Tab persistieren.
            onShelfDeviceMoved={onShelfDeviceMoved}
            // v7.9.77 / #170 — Port-Dot-Drag persistieren: setzt panelPosX/Y
            // am Port (in inputs ODER outputs je nach side) im Draft.
            onPortMoved={onPortMoved}
            // v7.9.78 / #170 — Internal cables: portName aus dem Cable-Eintrag
            // → portId-Lookup + side-Ableitung (im input → Front, im output →
            // Rear).
            internalCables={internalCables
              .map((c) => {
                const fromP = placements.find((x) => x.id === c.fromPlacementId)
                const toP = placements.find((x) => x.id === c.toPlacementId)
                if (!fromP || !toP) return null
                const fromInput = fromP.inputs.find((p) => p.name === c.fromPortName)
                const fromOutput = fromP.outputs.find((p) => p.name === c.fromPortName)
                const toInput = toP.inputs.find((p) => p.name === c.toPortName)
                const toOutput = toP.outputs.find((p) => p.name === c.toPortName)
                const fromPort = fromInput ?? fromOutput
                const toPort = toInput ?? toOutput
                if (!fromPort || !toPort) return null
                return {
                  fromPlacementId: c.fromPlacementId,
                  fromPortId: fromPort.id,
                  fromSide: (fromInput ? 'front' : 'rear') as 'front' | 'rear',
                  toPlacementId: c.toPlacementId,
                  toPortId: toPort.id,
                  toSide: (toInput ? 'front' : 'rear') as 'front' | 'rear',
                  color: c.color,
                }
              })
              .filter((c): c is NonNullable<typeof c> => c !== null)}
          />
        </div>
      ) : (
        <div className="rounded border border-dashed border-cp-border bg-cp-surface-3/40 p-8 text-center text-cp-xs text-cp-text-faint">
          {t('rack.view.empty', 'Erst Geräte ins Rack legen, dann erscheint die 3D-Ansicht.')}
        </div>
      )}
    </>
  )
}
