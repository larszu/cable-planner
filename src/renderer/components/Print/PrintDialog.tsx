// Issue #74 follow-up: one consolidated "Drucken" dialog reachable from the
// topbar. Replaces the scattered "Plan als PNG…" / "Plan als JPEG…" menu
// items (those used to fire downloads directly with no chance to review).
// Single hub for:
//   - Plan-as-PDF (delegates to existing PdfExportDialog flow)
//   - Plan-as-PNG and Plan-as-JPEG (direct downloads)
//   - Per-device patch-sheet exports (issue #74), with a multi-select list
//     and a choice between one combined PDF or individual PDFs per device.

import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useTranslation, format as formatStr } from '../../lib/i18n'
import {
  buildDevicePatchSheetBlob,
  buildDevicesPatchSheetsBatchBlob,
  exportDevicePatchSheet,
  exportDevicesPatchSheetsBatch,
} from '../../lib/exportDevicePdf'
import { printPdfBlob } from '../../lib/printPdfBlob'
import type { EquipmentItem } from '../../types/equipment'

interface PrintDialogProps {
  open: boolean
  onClose: () => void
}

type DeviceMode = 'combined' | 'individual'
type PaperFormat = 'a4' | 'a3'

export const PrintDialog = ({ open, onClose }: PrintDialogProps) => {
  const t = useTranslation()
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
          void printPdfBlob(blob)
        } else if (mode === 'individual') {
          // Individual prints: each device PDF in its own print job.
          for (const device of selectedDevices) {
            const each = buildDevicePatchSheetBlob(device, equipment, cables, { format })
            void printPdfBlob(each)
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
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('print.title', 'Drucken')}
      titleIcon={<Icon icon={Printer} size="sm" />}
      maxWidth="2xl"
      draggableKey="cable-planner:modal-pos:print"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-cp-text-muted">
            {selectionCount === 0
              ? t('print.noneSelected', 'Kein Gerät ausgewählt')
              : formatStr(t('print.selectionCount', '{count} Geräte ausgewählt'), { count: selectionCount })}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-cp-border bg-cp-surface-2 px-3 py-1.5 text-cp-xs text-cp-text hover:bg-cp-surface-4"
            >
              {t('common.close', 'Schließen')}
            </button>
            <button
              type="button"
              onClick={() => void handleExportDevices()}
              disabled={selectionCount === 0 || busy}
              className="rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy
                ? t('print.busy', 'Erzeuge PDF…')
                : action === 'print'
                  ? selectionCount > 1 && mode === 'individual'
                    ? formatStr(t('print.startJobs', '{count} Druckjobs starten'), { count: selectionCount })
                    : t('print.openDialog', 'Drucker-Dialog öffnen')
                  : selectionCount > 1 && mode === 'individual'
                    ? formatStr(t('print.downloadMany', '{count} PDFs herunterladen'), { count: selectionCount })
                    : t('print.downloadOne', 'Patch-Sheet PDF herunterladen')}
            </button>
          </div>
        </div>
      }
    >
          {/* v7.6.0 — Plan-Export is in Datei → Export now. The
              Drucken-Dialog is dedicated to ACTUAL printing through the
              OS print dialog (real printer list, real paper size /
              copies / orientation pickers). Each "Drucken"-Button
              below generates the PDF in memory and pushes it into a
              hidden iframe whose `contentWindow.print()` opens the
              native dialog — matches what you'd get from any browser. */}
          <fieldset className="mb-4 rounded border border-cp-border p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-cp-text-muted">
              {t('print.osHint.title', 'Drucker-Hinweis')}
            </legend>
            <p className="text-[11px] text-cp-text-muted">
              {t(
                'print.osHint.body',
                'Beim Drucken öffnet sich der Drucker-Dialog deines Betriebssystems — dort kannst du Drucker, Papierformat (A4 / A3 / Letter), Ausrichtung und Kopienzahl einstellen.',
              )}{' '}
              {t('print.osHint.exports', 'Plan-Exporte als PDF / PNG / JPEG findest du jetzt unter')}{' '}
              <strong>{t('print.osHint.exportsPath', 'Datei → Plan exportieren')}</strong>.
            </p>
          </fieldset>

          {/* Per-device section */}
          <fieldset className="rounded border border-cp-border p-3">
            <legend className="px-1 text-[11px] uppercase tracking-wide text-cp-text-muted">
              {t('print.devices.title', 'Einzelgeräte (Patch-Sheet)')}
            </legend>
            <p className="mb-2 text-[11px] text-cp-text-muted">
              {t(
                'print.devices.body',
                'Wählt einzelne Geräte aus und erzeugt eine A4/A3-Patch-Liste mit allen Ports + verbundenen Kabeln — zum Aufkleben am Gerät.',
              )}
            </p>

            {/* Toolbar: search + single-button select-all toggle + counters */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('print.devices.searchPlaceholder', 'Suchen (Name, Kategorie, Untertitel)…')}
                aria-label={t('print.devices.searchPlaceholder', 'Suchen (Name, Kategorie, Untertitel)…')}
                className="flex-1 rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs text-cp-text placeholder:text-cp-text-faint"
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
                    className="rounded border border-cp-border bg-cp-surface-2 px-2 py-1 text-[11px] text-cp-text-bright hover:bg-cp-surface-4 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {allChecked
                      ? t('print.devices.deselectAll', 'Alle abwählen')
                      : `${t('print.devices.selectAll', 'Alle wählen')}${filter.trim() ? ' ' + t('print.devices.filtered', '(gefiltert)') : ''}`}
                  </button>
                )
              })()}
            </div>

            {/* Device checklist */}
            <div className="mb-3 max-h-[42vh] overflow-y-auto rounded border border-cp-border-muted bg-cp-surface-3/40 p-1">
              {sortedEquipment.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-cp-text-muted">
                  {t('print.devices.noneInProject', 'Keine Geräte im Projekt.')}
                </div>
              ) : filteredEquipment.length === 0 ? (
                <div className="px-3 py-6 text-center text-[11px] text-cp-text-muted">
                  {formatStr(t('print.devices.noMatch', 'Kein Gerät passt zum Suchbegriff „{q}".'), { q: filter })}
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
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-cp-xs text-cp-text-bright hover:bg-cp-surface-2/60">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(eq.id)}
                            onChange={() => toggleDevice(eq.id)}
                            className="h-3.5 w-3.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-cp-text">{eq.name}</div>
                            <div className="truncate text-[10px] text-cp-text-muted">
                              {[eq.category, eq.subtitle].filter(Boolean).join(' · ') || '—'}
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] text-cp-text-muted">
                            {formatStr(t('print.devices.portCableCount', '{ports} Ports · {cables} Kabel'), { ports: portCount, cables: cableCount })}
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
              <div className="rounded border border-cp-border p-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-cp-text-muted">
                  {t('print.action.label', 'Aktion')}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-cp-xs text-cp-text-bright">
                  <input
                    type="radio"
                    name="print-action"
                    checked={action === 'print'}
                    onChange={() => setAction('print')}
                  />
                  <Icon icon={Printer} size="xs" className="mr-1 inline-block align-text-bottom" />
                  {t('print.action.print', 'Auf Drucker drucken (Systemdialog)')}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-cp-xs text-cp-text-bright">
                  <input
                    type="radio"
                    name="print-action"
                    checked={action === 'download'}
                    onChange={() => setAction('download')}
                  />
                  {t('print.action.download', 'Als PDF herunterladen')}
                </label>
              </div>
              <div className="rounded border border-cp-border p-2 text-[10px] text-cp-text-muted">
                <div className="mb-1 uppercase tracking-wide text-cp-text-muted">
                  {t('print.dialogHint.tag', 'Hinweis')}
                </div>
                {t(
                  'print.dialogHint.body',
                  'Im Drucker-Dialog wählst du Drucker, Papierformat + Anzahl der Kopien. Bei „Einzelne PDFs" werden mehrere Druckjobs ausgelöst (einer pro Gerät).',
                )}
              </div>
            </div>

            {/* Options: paper format + output mode */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded border border-cp-border p-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-cp-text-muted">
                  {t('print.format.label', 'Format')}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-cp-xs text-cp-text-bright">
                  <input
                    type="radio"
                    name="print-format"
                    checked={format === 'a4'}
                    onChange={() => setFormat('a4')}
                  />
                  {t('print.format.a4', 'A4 (Standard)')}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-cp-xs text-cp-text-bright">
                  <input
                    type="radio"
                    name="print-format"
                    checked={format === 'a3'}
                    onChange={() => setFormat('a3')}
                  />
                  {t('print.format.a3', 'A3 (mehr Ports / Seite)')}
                </label>
              </div>
              <div className="rounded border border-cp-border p-2">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-cp-text-muted">
                  {t('print.output.label', 'Ausgabe')}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-cp-xs text-cp-text-bright">
                  <input
                    type="radio"
                    name="print-mode"
                    checked={mode === 'combined'}
                    onChange={() => setMode('combined')}
                  />
                  {t('print.output.combined', 'Eine Sammel-PDF')}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-cp-xs text-cp-text-bright">
                  <input
                    type="radio"
                    name="print-mode"
                    checked={mode === 'individual'}
                    onChange={() => setMode('individual')}
                  />
                  {t('print.output.individual', 'Einzelne PDFs pro Gerät')}
                </label>
              </div>
            </div>
          </fieldset>

    </ModalShell>
  )
}
