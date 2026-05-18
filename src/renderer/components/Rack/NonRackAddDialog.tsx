/**
 * v7.9.80 / #170 — Add-Dialog für Non-Rack-Geräte.
 *
 * Vor 7.9.80 fragte addTemplate() nur "Wieviele HE?" was für Shelf-
 * Geräte (Mac mini, Encoder-Box, Splitter…) Unsinn ist — die haben
 * keine sinnvolle HE-Höhe, sondern echte physikalische Maße W×H×D
 * in mm. Dieser Dialog gibt dem User zwei Pfade:
 *
 *  • "Als 19""-Gerät" → wie bisher, HE-Eingabe
 *  • "Auf Shelf"     → W/H/D in mm + optional Persist aufs Template
 *
 * Im Shelf-Pfad: HE wird auf 1 gesetzt (Geräte sitzen oben in einer
 * HE-Reihe auf einem Shelf), und widthMm/heightMm/depthMm wandern aufs
 * Template → bleiben mit dem Gerät verbunden und werden vom 3D-Renderer
 * (Phase B+1) als kleinere Box innerhalb der HE gerendert.
 */
import { useState } from 'react'
import type { EquipmentTemplate } from '../../types/equipment'

interface Props {
  open: boolean
  templateName: string
  initialDimensions?: { widthMm?: number; heightMm?: number; depthMm?: number }
  onCancel: () => void
  /** Returns { rackUnits, mountSide?, dimensions? } and whether to persist back to template. */
  onConfirm: (result: {
    mode: 'rack' | 'shelf'
    rackUnits: number
    widthMm?: number
    heightMm?: number
    depthMm?: number
    persistToTemplate: boolean
  }) => void
}

const DEFAULT_SHELF_DEVICE = { widthMm: 200, heightMm: 50, depthMm: 200 }

export const NonRackAddDialog = ({
  open,
  templateName,
  initialDimensions,
  onCancel,
  onConfirm,
}: Props) => {
  const [mode, setMode] = useState<'rack' | 'shelf'>('rack')
  const [rackUnits, setRackUnits] = useState(1)
  const [widthMm, setWidthMm] = useState(initialDimensions?.widthMm ?? DEFAULT_SHELF_DEVICE.widthMm)
  const [heightMm, setHeightMm] = useState(initialDimensions?.heightMm ?? DEFAULT_SHELF_DEVICE.heightMm)
  const [depthMm, setDepthMm] = useState(initialDimensions?.depthMm ?? DEFAULT_SHELF_DEVICE.depthMm)
  const [persistFlag, setPersistFlag] = useState(true)

  if (!open) return null

  const submit = () => {
    if (mode === 'rack') {
      onConfirm({
        mode: 'rack',
        rackUnits: Math.max(1, Math.min(20, Math.round(rackUnits) || 1)),
        persistToTemplate: persistFlag,
      })
    } else {
      onConfirm({
        mode: 'shelf',
        rackUnits: 1,
        widthMm: Math.max(20, Math.min(450, widthMm)),
        heightMm: Math.max(10, Math.min(400, heightMm)),
        depthMm: Math.max(20, Math.min(1500, depthMm)),
        persistToTemplate: persistFlag,
      })
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[480px] max-w-[95vw] rounded-lg border border-slate-700 bg-slate-900 p-4 text-sm text-slate-100 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            "{templateName}" hinzufügen
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
        <div className="mb-3 text-[11px] text-slate-400">
          Das Gerät ist nicht als 19″-Rack-Gerät markiert. Wähle wie es im Rack
          platziert werden soll:
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('rack')}
            className={`rounded border p-3 text-left transition ${
              mode === 'rack'
                ? 'border-sky-500 bg-sky-900/40 text-sky-100'
                : 'border-slate-700 bg-slate-950/50 text-slate-400 hover:bg-slate-900'
            }`}
          >
            <div className="font-semibold">📏 Als 19″-Gerät</div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              Belegt N HE auf den Rack-Schienen
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('shelf')}
            className={`rounded border p-3 text-left transition ${
              mode === 'shelf'
                ? 'border-emerald-500 bg-emerald-900/40 text-emerald-100'
                : 'border-slate-700 bg-slate-950/50 text-slate-400 hover:bg-slate-900'
            }`}
          >
            <div className="font-semibold">🪑 Auf Shelf</div>
            <div className="mt-0.5 text-[10px] text-slate-500">
              Eigene Maße in mm, sitzt auf einem Rack-Shelf
            </div>
          </button>
        </div>

        {mode === 'rack' && (
          <div className="mb-3 space-y-2">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">HE-Höhe</span>
              <input
                type="number"
                min={1}
                max={20}
                value={rackUnits}
                onChange={(e) => setRackUnits(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                autoFocus
              />
            </label>
          </div>
        )}

        {mode === 'shelf' && (
          <div className="mb-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Breite (mm)</span>
                <input
                  type="number"
                  min={20}
                  max={450}
                  step={5}
                  value={widthMm}
                  onChange={(e) => setWidthMm(Number(e.target.value) || 0)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Höhe (mm)</span>
                <input
                  type="number"
                  min={10}
                  max={400}
                  step={5}
                  value={heightMm}
                  onChange={(e) => setHeightMm(Number(e.target.value) || 0)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-slate-400">Tiefe (mm)</span>
                <input
                  type="number"
                  min={20}
                  max={1500}
                  step={5}
                  value={depthMm}
                  onChange={(e) => setDepthMm(Number(e.target.value) || 0)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5"
                />
              </label>
            </div>
            <div className="rounded border border-slate-800 bg-slate-950/50 p-2 text-[10px] text-slate-400">
              Lege das Gerät auf ein vorhandenes Rack-Shelf, indem du es auf
              derselben Start-HE einfügst. Maße werden im 3D-Tab als reale
              Boxen-Größe visualisiert.
            </div>
          </div>
        )}

        <label className="mb-3 flex items-start gap-2 rounded border border-slate-800 bg-slate-950/40 p-2 text-[11px]">
          <input
            type="checkbox"
            checked={persistFlag}
            onChange={(e) => setPersistFlag(e.target.checked)}
            className="mt-0.5 accent-sky-500"
          />
          <span className="flex-1">
            <span className="font-medium text-slate-200">Maße permanent ans Template speichern</span>
            <span className="ml-1 text-slate-500">
              (beim nächsten Hinzufügen wird nicht mehr gefragt)
            </span>
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-600"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  )
}

/** Helper signature for the parent's stamper that injects template-level
 *  dimensions (W/H/D) when the user opts in. Used by RackBuilderDialog
 *  to persist the chosen dims back to the library template. */
export type NonRackPersistFn = (template: EquipmentTemplate, patch: {
  isRackDevice?: boolean
  rackUnits?: number
  widthMm?: number
  heightMm?: number
  depthMm?: number
}) => void
