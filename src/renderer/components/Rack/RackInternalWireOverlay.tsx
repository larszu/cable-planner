import type { EquipmentItem, GroupPreset } from '../../types/equipment'
import { useTranslation } from '../../lib/i18n'
import { RackInternalCanvas } from './RackInternalCanvas'
import type { InternalCableDraft, RackPlacementDraft } from './rackBuilderTypes'
import { PanelHint } from '../shared/PanelHint'
import { rackWireFindings } from '../../lib/rackWireChecks'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useBackdropClose } from '../../hooks/useBackdropClose'

/** v7.8.5+ — Wire-Dialog-Overlay fuer die Rack-interne Verkabelung.
 *
 *  Issue #310 — aus RackBuilderDialog ausgelagert. Bietet einen
 *  Fullscreen-Modal mit der RackInternalCanvas-Komponente und
 *  uebernimmt das Mapping zwischen draft.internalCables (per-id)
 *  und GroupPreset.cables (per-index) in beide Richtungen. */

export interface RackInternalWireOverlayProps {
  open: boolean
  rackName: string
  placements: RackPlacementDraft[]
  internalCables: InternalCableDraft[]
  onClose: () => void
  onCablesChanged: (cables: InternalCableDraft[]) => void
  onPlacementRenamed: (placementId: string, newName: string) => void
  onPlacementMoved: (placementId: string, x: number, y: number) => void
  /** #833 — Port-Aenderungen aus dieser Sicht zurueck in den Builder-Draft. */
  onPlacementPortsChanged: (
    placementId: string,
    ports: { inputs: EquipmentItem['inputs']; outputs: EquipmentItem['outputs'] },
  ) => void
}

export const RackInternalWireOverlay = ({
  open,
  rackName,
  placements,
  internalCables,
  onClose,
  onCablesChanged,
  onPlacementRenamed,
  onPlacementMoved,
  onPlacementPortsChanged,
}: RackInternalWireOverlayProps) => {
  const t = useTranslation()
  // Phase 3 der UI-Pruefung: Escape, Fokus-Falle und Fokus-Rueckgabe aus dem
  // Haken. Vor dem bedingten Ausstieg, weil Haken nicht bedingt laufen.
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, onClose)

  // B-44 — der Hintergrund schliesst, aus derselben Quelle wie ueberall.
  const backdrop = useBackdropClose(onClose)

  if (!open) return null

  // ISSUE #663 — „Es fehlt die Fehlermeldung, dass Kabeltypen nicht
  // zusammenpassen." Der Signalplan meldet das seit langem; hier fehlte es.
  // Gerechnet wird in `lib/rackWireChecks.ts`, nicht in dieser Datei: die
  // Regel gehoert in eine pruefbare Funktion und nicht in eine Ansicht.
  const befunde = rackWireFindings(placements, internalCables)

  // draft.internalCables (per-id) → GroupPreset.cables (per-index)
  const initialCables: GroupPreset['cables'] = (() => {
    const result: GroupPreset['cables'] = []
    for (const c of internalCables) {
      const fromIdx = placements.findIndex((p) => p.id === c.fromPlacementId)
      const toIdx = placements.findIndex((p) => p.id === c.toPlacementId)
      if (fromIdx < 0 || toIdx < 0) continue
      const entry: GroupPreset['cables'][number] = {
        fromItemIndex: fromIdx,
        fromPortName: c.fromPortName,
        toItemIndex: toIdx,
        toPortName: c.toPortName,
        name: c.name,
        type: c.type,
        length: c.length,
      }
      if (c.color != null) entry.color = c.color
      if (c.standard != null) entry.standard = c.standard
      // v7.9.115 / Issue #223 — Waypoints durchreichen.
      if (c.waypoints && c.waypoints.length > 0) {
        entry.waypoints = c.waypoints.map((wp) => ({ x: wp.x, y: wp.y }))
      }
      result.push(entry)
    }
    return result
  })()

  return (
    <div
      {...backdrop}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-2 sm:p-6"
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex h-[92vh] w-[min(1500px,calc(100vw-1rem))] flex-col border border-cp-border bg-cp-surface-1 p-3 text-cp-text"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 id={titleId} className="text-cp-xl font-semibold">{t('rack.wire.title', 'Rack cabling')}: {rackName || t('rack.unnamed', '(unnamed)')}</h3>
            <PanelHint
              className="mt-1 text-cp-xs text-cp-text-muted"
              text={t(
                'rack.wire.intro',
                'Drag lines output → input. Right-click cable = menu, double-click = properties, Del = delete. Now uses the real canvas component — toolbar, routing, waypoints, A* routing all like in the main canvas.',
              )}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-emerald-700 px-3 py-1.5 text-cp-xs hover:bg-emerald-600"
          >
            {t('common.done', 'Done')}
          </button>
        </div>
        {befunde.length > 0 && (
          <ul className="mb-2 max-h-28 shrink-0 space-y-0.5 overflow-y-auto border border-cp-border-muted bg-cp-surface-3/40 p-1.5 text-cp-xs">
            {befunde.map((f, i) => (
              <li
                key={`${f.kind}-${f.index}-${i}`}
                className={f.severity === 'error' ? 'text-cp-danger' : 'text-cp-warn'}
              >
                {f.text}
              </li>
            ))}
          </ul>
        )}
        <div className="min-h-0 flex-1 overflow-hidden border border-cp-border">
          <RackInternalCanvas
            rackName={rackName}
            placements={placements.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              startUnit: p.startUnit,
              rackUnits: p.rackUnits,
              inputs: p.inputs,
              outputs: p.outputs,
              isRackDevice: p.isRackDevice,
              canvasX: p.canvasX,
              canvasY: p.canvasY,
            }))}
            initialCables={initialCables}
            onCablesChanged={(cables) => {
              // GroupPreset.cables (per-index) → draft.internalCables (per-id)
              const next: InternalCableDraft[] = []
              for (const c of cables) {
                const fromId = placements[c.fromItemIndex]?.id
                const toId = placements[c.toItemIndex]?.id
                if (!fromId || !toId) continue
                const entry: InternalCableDraft = {
                  fromPlacementId: fromId,
                  fromPortName: c.fromPortName,
                  toPlacementId: toId,
                  toPortName: c.toPortName,
                  name: c.name,
                  type: c.type,
                  length: c.length,
                }
                if (c.color != null) entry.color = c.color
                if (c.standard != null) entry.standard = c.standard
                // v7.9.115 / Issue #223 — Waypoints durchreichen.
                if (c.waypoints && c.waypoints.length > 0) {
                  entry.waypoints = c.waypoints.map((wp) => ({ x: wp.x, y: wp.y }))
                }
                next.push(entry)
              }
              onCablesChanged(next)
            }}
            onPlacementRenamed={onPlacementRenamed}
            onPlacementMoved={onPlacementMoved}
            onPlacementPortsChanged={onPlacementPortsChanged}
          />
        </div>
      </div>
    </div>
  )
}
