import type { GroupPreset } from '../../types/equipment'
import { useTranslation } from '../../lib/i18n'
import { RackInternalCanvas } from './RackInternalCanvas'
import type { InternalCableDraft, RackPlacementDraft } from './rackBuilderTypes'
import { PanelHint } from '../shared/PanelHint'
import { rackWireFindings } from '../../lib/rackWireChecks'

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
}: RackInternalWireOverlayProps) => {
  const t = useTranslation()
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-2 sm:p-6">
      <div className="flex h-[92vh] w-[min(1500px,calc(100vw-1rem))] flex-col rounded border border-cp-border bg-cp-surface-1 p-3 text-cp-text shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-cp-xl font-semibold">{t('rack.wire.title', 'Rack-Verkabelung')}: {rackName || t('rack.unnamed', '(unbenannt)')}</h3>
            <PanelHint
              className="mt-1 text-cp-xs text-cp-text-muted"
              text={t(
                'rack.wire.intro',
                'Ziehe Linien Output → Input. Rechtsklick auf Kabel = Menü, Doppelklick = Eigenschaften, Entf = Löschen. Verwendet jetzt die echte Canvas-Komponente — Toolbar, Routing, Waypoints, A*-Routing alles wie im Hauptcanvas.',
              )}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-emerald-700 px-3 py-1.5 text-cp-xs hover:bg-emerald-600"
          >
            {t('common.done', 'Fertig')}
          </button>
        </div>
        {befunde.length > 0 && (
          <ul className="mb-2 max-h-28 shrink-0 space-y-0.5 overflow-y-auto rounded border border-cp-border-muted bg-cp-surface-3/40 p-1.5 text-cp-xs">
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
        <div className="min-h-0 flex-1 overflow-hidden rounded border border-cp-border">
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
          />
        </div>
      </div>
    </div>
  )
}
