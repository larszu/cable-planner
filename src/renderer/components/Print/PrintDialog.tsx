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
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import {
  buildDevicePatchSheetBlob,
  buildDevicesPatchSheetsBatchBlob,
  exportDevicePatchSheet,
  exportDevicesPatchSheetsBatch,
} from '../../lib/exportDevicePdf'
import type { EquipmentItem } from '../../types/equipment'

interface PrintDialogProps {
  open: boolean
  onClose: () => void
}

type DeviceMode = 'combined' | 'individual'
type PaperFormat = 'a4' | 'a3'

/** v7.6.0 — open a freshly built PDF blob in a hidden iframe and
 *  trigger the browser/Electron print dialog. This is the closest
 *  we get to real native printing without bundling a platform-
 *  specific print driver: the OS dialog appears with the real
 *  printer list, paper sizes, copies + orientation. The user
 *  selects, hits print, the OS handles the rest. */
const printPdfBlob = (pdfBlob: Blob) => {
  const url = URL.createObjectURL(pdfBlob)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      /* fall back to download below */
    }
    // Revoke after a delay so the print job isn't cut off mid-stream.
    window.setTimeout(() => {
      document.body.removeChild(iframe)
      URL.revokeObjectURL(url)
    }, 60_000)
  }
}

export const PrintDialog = ({ open, onClose }: PrintDialogProps) => {
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
  const [action, setAction] = useState<'print' | 'download'>('print')
  const [busy, setBusy] = useState(false)
  const drag = useDraggablePosition('cable-planner:modal-pos:print', open)

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
      if (action === 'print') {
        // Combined PDF → OS print dialog (single job).
        const blob =
          mode === 'combined' || selectedDevices.length === 1
            ? buildDevicesPatchSheetsBatchBlob(selectedDevices, equipment, cables, { format })
            : null
        if (blob) {
          printPdfBlob(blob)
        } else if (mode === 'individual') {
          // Individual prints: each device PDF in its own print job.
          for (const device of selectedDevices) {
            const each = buildDevicePatchSheetBlob(device, equipment, cables, { format })
            printPdfBlob(each)
          }
        }
      } else {
        if (mode === 'combined' || selectedDevices.length === 1) {
          await exportDevicesPatchSheetsBatch(selectedDevices, equipment, cables, { format })
        } else {
          for (const device of selectedDevices) {
            await exportDevicePatchSheet(device, equipment, cables, { format })
          }
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
      <div
        ref={drag.containerRef}
        style={drag.containerStyle}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
      >
        <header
          {...drag.headerProps}
          className="flex items-center justify-between border-b border-slate-700 px-4 py-3 select-none"
        >
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
          {/* v7.6.0 — Plan-Export is in Datei → Export now. The
              Drucken-Dialog is dedicated to ACTUAL printing through the
              OS print dialog (real printer list, real paper size /
              copies / orientation pickers). Each "Drucken"-Button
              below generates the PDF in memory and pushes it into a
              hidden iframe whose `contentWindow.print()` opens the
              native dialog — matches what you'd get from any browser. */}
          <fieldset className="mb-4 rounded border border-slate-700 p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
              Drucker-Hinweis
            </legend>
            <p className="text-[11px] text-slate-400">
              Beim Drucken öffnet sich der Drucker-Dialog deines Betriebssystems — dort
              kannst du Drucker, Papierformat (A4 / A3 / Letter), Ausrichtung und
              Kopienzahl einstellen.
              Plan-Exporte als PDF / PNG / JPEG findest du jetzt unter{' '}
              <strong>Datei → Plan exportieren</strong>.
            </p>
          </fieldset>

          {/* Per-device section */}
          <fieldset className="rounded border border-slate-700 p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
              Einzelgeräte (Patch-Sheet)
            </legend>
            <p className="mb-2 text-[11px] text-slate-400">
              Wählt einzelne Geräte aus und erzeugt eine A4/A3-Patch-Liste mit allen Ports +
              verbundenen Kabeln — zum Aufkleben am Gerät.
            </p>

            {/* Toolbar: search + single-button select-all toggle + counters */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Suchen (Name, Kategorie, Untertitel)…"
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500"
              />
              {(() => {
                // v7.6.0 — one toggle button instead of two competing buttons.
                // Reads the current selection vs the visible list to decide
                // whether the next click should select-all or clear.
                const allChecked =
                  filteredEquipment.length > 0 &&
                  filteredEquipment.every((eq) => selectedIds.has(eq.id))
                return (
                  <button
                    type="button"
                    onClick={() => (allChecked ? selectNone() : selectAll())}
                    disabled={filteredEquipment.length === 0}
                    className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {allChecked
                      ? '☐ Alle abwählen'
                      : `☑ Alle wählen${filter.trim() ? ' (gefiltert)' : ''}`}
                  </button>
                )
              })()}
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

            {/* Action toggle — print via OS dialog vs. download a PDF */}
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded border border-slate-700 p-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
                  Aktion
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="radio"
                    name="print-action"
                    checked={action === 'print'}
                    onChange={() => setAction('print')}
                  />
                  🖨 Auf Drucker drucken (Systemdialog)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="radio"
                    name="print-action"
                    checked={action === 'download'}
                    onChange={() => setAction('download')}
                  />
                  ⬇ Als PDF herunterladen
                </label>
              </div>
              <div className="rounded border border-slate-700 p-2 text-[10px] text-slate-400">
                <div className="mb-1 uppercase tracking-wide text-slate-400">
                  Hinweis
                </div>
                Im Drucker-Dialog wählst du Drucker, Papierformat + Anzahl der Kopien.
                Bei „Einzelne PDFs" werden mehrere Druckjobs ausgelöst (einer pro Gerät).
              </div>
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
                : action === 'print'
                  ? selectionCount > 1 && mode === 'individual'
                    ? `🖨 ${selectionCount} Druckjobs starten`
                    : '🖨 Drucker-Dialog öffnen'
                  : selectionCount > 1 && mode === 'individual'
                    ? `⬇ ${selectionCount} PDFs herunterladen`
                    : '⬇ Patch-Sheet PDF herunterladen'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
