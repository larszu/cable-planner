// Issue #74 follow-up: one consolidated "Drucken" dialog reachable from the
// topbar. Replaces the scattered "Plan als PNG…" / "Plan als JPEG…" menu
// items (those used to fire downloads directly with no chance to review).
// Single hub for:
//   - Plan-as-PDF (delegates to existing PdfExportDialog flow)
//   - Plan-as-PNG and Plan-as-JPEG (direct downloads)
//   - Per-device patch-sheet exports (issue #74), with a multi-select list
//     and a choice between one combined PDF or individual PDFs per device.

import { useMemo, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import {
  exportDevicePatchSheet,
  exportDevicesPatchSheetsBatch,
} from '../../lib/exportDevicePdf'
import type { EquipmentItem } from '../../types/equipment'

interface PrintDialogProps {
  open: boolean
  onClose: () => void
  /** Trigger the existing Plan-as-PDF dialog (theme picker etc.). */
  onPrintPlanPdf: () => void
  /** Direct download of the canvas as PNG. */
  onPrintPlanPng: () => void
  /** Direct download of the canvas as JPEG. */
  onPrintPlanJpeg: () => void
}

type DeviceMode = 'combined' | 'individual'
type PaperFormat = 'a4' | 'a3'

export const PrintDialog = ({
  open,
  onClose,
  onPrintPlanPdf,
  onPrintPlanPng,
  onPrintPlanJpeg,
}: PrintDialogProps) => {
  const equipment = useProjectStore((state) => state.project.equipment)
  const cables = useProjectStore((state) => state.project.cables)

  const sortedEquipment = useMemo(
    () => [...equipment].sort((a, b) => a.name.localeCompare(b.name)),
    [equipment],
  )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [format, setFormat] = useState<PaperFormat>('a4')
  const [mode, setMode] = useState<DeviceMode>('combined')
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const filteredEquipment = sortedEquipment.filter((eq) => {
    if (!filter.trim()) return true
    const q = filter.toLowerCase()
    return (
      eq.name.toLowerCase().includes(q) ||
      (eq.category ?? '').toLowerCase().includes(q) ||
      (eq.subtitle ?? '').toLowerCase().includes(q)
    )
  })

  const toggleDevice = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(filteredEquipment.map((e) => e.id)))
  const selectNone = () => setSelectedIds(new Set())

  const selectedDevices: EquipmentItem[] = sortedEquipment.filter((e) => selectedIds.has(e.id))
  const selectionCount = selectedDevices.length

  const handleExportDevices = async () => {
    if (selectionCount === 0) return
    setBusy(true)
    try {
      if (mode === 'combined' || selectedDevices.length === 1) {
        await exportDevicesPatchSheetsBatch(selectedDevices, equipment, cables, { format })
      } else {
        for (const device of selectedDevices) {
          await exportDevicePatchSheet(device, equipment, cables, { format })
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            <span className="mr-2">🖨</span>
            Drucken
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Schließen"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Plan section */}
          <fieldset className="mb-4 rounded border border-slate-700 p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
              Plan / Gesamtansicht
            </legend>
            <p className="mb-2 text-[11px] text-slate-400">
              Exportiert die komplette Canvas-Ansicht. Der PDF-Export öffnet einen separaten
              Dialog mit Hintergrund-Auswahl.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onPrintPlanPdf()
                }}
                className="rounded bg-sky-700 px-3 py-2 text-xs font-medium text-white hover:bg-sky-600"
              >
                📑 Plan als PDF…
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onPrintPlanPng()
                }}
                className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-600"
              >
                🖼 Plan als PNG
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onPrintPlanJpeg()
                }}
                className="rounded bg-slate-700 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-600"
              >
                🖼 Plan als JPEG
              </button>
            </div>
          </fieldset>

          {/* Per-device section */}
          <fieldset className="rounded border border-slate-700 p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
              Einzelgeräte (Patch-Sheet, Issue #74)
            </legend>
            <p className="mb-2 text-[11px] text-slate-400">
              Wählt einzelne Geräte aus und erzeugt eine A4/A3-Patch-Liste mit allen Ports +
              verbundenen Kabeln — zum Aufkleben am Gerät.
            </p>

            {/* Toolbar: search + select-all/none + counters */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Suchen (Name, Kategorie, Untertitel)…"
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={selectAll}
                disabled={filteredEquipment.length === 0}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Alle wählen{filter.trim() ? ' (gefiltert)' : ''}
              </button>
              <button
                type="button"
                onClick={selectNone}
                disabled={selectionCount === 0}
                className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Keines
              </button>
            </div>

            {/* Device checklist */}
            <div className="mb-3 max-h-[42vh] overflow-y-auto rounded border border-slate-800 bg-slate-950/40 p-1">
              {sortedEquipment.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-slate-500">
                  Keine Geräte im Projekt.
                </div>
              ) : filteredEquipment.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-slate-500">
                  Kein Gerät passt zum Suchbegriff „{filter}".
                </div>
              ) : (
                <ul className="space-y-0.5">
                  {filteredEquipment.map((eq) => {
                    const portCount = (eq.inputs?.length ?? 0) + (eq.outputs?.length ?? 0)
                    const cableCount = cables.filter(
                      (c) => c.fromEquipmentId === eq.id || c.toEquipmentId === eq.id,
                    ).length
                    return (
                      <li key={eq.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800/60">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(eq.id)}
                            onChange={() => toggleDevice(eq.id)}
                            className="h-3.5 w-3.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-slate-100">{eq.name}</div>
                            <div className="truncate text-[10px] text-slate-500">
                              {[eq.category, eq.subtitle].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] text-slate-500">
                            {portCount} Ports · {cableCount} Kabel
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Options: paper format + output mode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-slate-700 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
                  Format
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="radio"
                    name="print-format"
                    checked={format === 'a4'}
                    onChange={() => setFormat('a4')}
                  />
                  A4 (Standard)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="radio"
                    name="print-format"
                    checked={format === 'a3'}
                    onChange={() => setFormat('a3')}
                  />
                  A3 (mehr Ports / Seite)
                </label>
              </div>
              <div className="rounded border border-slate-700 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
                  Ausgabe
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="radio"
                    name="print-mode"
                    checked={mode === 'combined'}
                    onChange={() => setMode('combined')}
                  />
                  Eine Sammel-PDF
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="radio"
                    name="print-mode"
                    checked={mode === 'individual'}
                    onChange={() => setMode('individual')}
                  />
                  Einzelne PDFs pro Gerät
                </label>
              </div>
            </div>
          </fieldset>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-700 bg-slate-950/60 px-4 py-3">
          <div className="text-[11px] text-slate-400">
            {selectionCount === 0
              ? 'Kein Gerät ausgewählt'
              : `${selectionCount} Gerät${selectionCount === 1 ? '' : 'e'} ausgewählt`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 hover:bg-slate-700"
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={() => void handleExportDevices()}
              disabled={selectionCount === 0 || busy}
              className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? 'Erzeuge PDF…'
                : selectionCount > 1 && mode === 'individual'
                  ? `🖨 ${selectionCount} PDFs herunterladen`
                  : '🖨 Patch-Sheet PDF erzeugen'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
