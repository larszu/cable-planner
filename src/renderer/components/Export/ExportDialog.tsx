// v7.9.0 / Issue #110 — Unified Export Dialog
// v7.9.2 — Erweitert zu ECHTEM Hub. User-Issue:
//   "Es gibt Exportieren Button in top Toolbar, Kabel Stückliste
//   exportieren button in topbar, drucken button in top bar. in dem
//   drucken button gibt es auch nochmal eine exportieren funktion.
//   Und in einzelnen geräten gibt es auch nochmal druck funktionen.
//   Vereinheitliche zu einer Großen funktion die alles kann und
//   übersiichtlich UI gestaltet ist. Behale alle funktionen. mache
//   es non destruktiv. aber verbessere die UX deutlich!"
//
// Architektur:
//   - Eine zentrale Dialog-Komponente mit 4 Sektionen (Tabs):
//     1. Plan (Canvas → PDF/PNG/JPEG)
//     2. Patch-Sheets (pro Gerät, einzeln oder Batch, A4/A3)
//     3. Kabel-Stückliste (BOM als CSV oder PDF)
//     4. Drucken (OS-Druckdialog via PrintDialog)
//   - Jede Sektion enthält die WICHTIGSTEN Optionen direkt; für
//     Advanced-Fälle gibt es einen "Erweitert…"-Button der den
//     existierenden Detail-Dialog öffnet.
//   - Bestehende Standalone-Dialoge (CableBomDialog, PrintDialog,
//     LocationBomDialog) bleiben funktionsfähig und werden NICHT
//     dupliziert — dieser Hub ist die zentrale UI darüber.

import { useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { exportDevicePatchSheet, exportDevicesPatchSheetsBatch } from '../../lib/exportDevicePdf'

export type ExportFormat = 'pdf' | 'png' | 'jpeg'
type Section = 'plan' | 'patch' | 'bom' | 'print'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  /** Triggers the actual export pipelines App.tsx already owns. */
  onExportPdf: (theme: 'dark' | 'light') => Promise<void> | void
  onExportImage: (format: 'png' | 'jpeg') => Promise<void> | void
  /** Opens the standalone Kabel-Stückliste dialog for advanced options. */
  onOpenCableBom?: () => void
  /** Opens the standalone OS-Print dialog with device selection. */
  onOpenPrintDialog?: () => void
}

const SECTION_LABEL: Record<Section, string> = {
  plan: 'Plan',
  patch: 'Patch-Sheets',
  bom: 'Kabel-Stückliste',
  print: 'Drucken',
}

const SECTION_ICON: Record<Section, string> = {
  plan: '📑',
  patch: '🔌',
  bom: '🧮',
  print: '🖨',
}

const SECTION_DESC: Record<Section, string> = {
  plan: 'Den gesamten Canvas-Plan als PDF, PNG oder JPEG exportieren — Vektor-PDF mit Titelblock für Druck, PNG/JPEG für E-Mail.',
  patch: 'Pro Gerät eine Port-Belegungs-Liste — ideal zum Aufkleben am Gerät. Einzeln oder als Sammel-PDF (eine Seite pro Gerät).',
  bom: 'Stückliste aller Kabel im Projekt (Typ + Länge zusammengefasst). Als CSV für Excel oder als PDF mit Rentman-Abgleich.',
  print: 'OS-Druckdialog mit Vorschau und Geräte-Auswahl. Druckt Plan oder Patch-Sheets direkt aufs Papier.',
}

export const ExportDialog = ({
  open,
  onClose,
  onExportPdf,
  onExportImage,
  onOpenCableBom,
  onOpenPrintDialog,
}: ExportDialogProps) => {
  const [section, setSection] = useState<Section>('plan')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl sm:flex-row">
        <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/40 p-3 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r">
          <h3 className="mb-2 hidden px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:block">
            Exportieren
          </h3>
          {(Object.keys(SECTION_LABEL) as Section[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`flex items-center gap-2 rounded px-3 py-2 text-left text-sm ${
                section === id
                  ? 'bg-sky-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="text-base">{SECTION_ICON[id]}</span>
              <span>{SECTION_LABEL[id]}</span>
            </button>
          ))}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
            <h2 className="text-base font-semibold">
              {SECTION_ICON[section]} {SECTION_LABEL[section]} exportieren
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              Schließen
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <p className="mb-4 text-xs text-slate-400">{SECTION_DESC[section]}</p>
            {section === 'plan' && (
              <PlanSection
                onExportPdf={onExportPdf}
                onExportImage={onExportImage}
                onClose={onClose}
              />
            )}
            {section === 'patch' && <PatchSheetSection onClose={onClose} />}
            {section === 'bom' && (
              <BomSection onOpenCableBom={onOpenCableBom} onClose={onClose} />
            )}
            {section === 'print' && (
              <PrintSection onOpenPrintDialog={onOpenPrintDialog} onClose={onClose} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------
// Plan section
// --------------------------------------------------------------------
const PlanSection = ({
  onExportPdf,
  onExportImage,
  onClose,
}: {
  onExportPdf: (theme: 'dark' | 'light') => Promise<void> | void
  onExportImage: (format: 'png' | 'jpeg') => Promise<void> | void
  onClose: () => void
}) => {
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const [pdfTheme, setPdfTheme] = useState<'dark' | 'light'>(canvasTheme)
  const [busy, setBusy] = useState(false)
  const projectName = useProjectStore((s) => s.project.metadata.name)

  const handleExport = async () => {
    setBusy(true)
    try {
      if (format === 'pdf') await onExportPdf(pdfTheme)
      else await onExportImage(format)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const FORMAT_OPTIONS = [
    { value: 'pdf' as const, icon: '📑', label: 'PDF', hint: 'Vektor mit Titelblock, druckbar' },
    { value: 'png' as const, icon: '🖼', label: 'PNG', hint: 'Transparent möglich, scharf' },
    { value: 'jpeg' as const, icon: '🖼', label: 'JPEG', hint: 'Kleiner, gut für E-Mail' },
  ]

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-slate-300">Format</legend>
        {FORMAT_OPTIONS.map((opt) => {
          const selected = format === opt.value
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-xs ${
                selected
                  ? 'border-sky-500 bg-sky-900/30'
                  : 'border-slate-700 bg-slate-950 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value={opt.value}
                checked={selected}
                onChange={() => setFormat(opt.value)}
                className="mt-0.5"
              />
              <span className="text-base">{opt.icon}</span>
              <span className="flex-1">
                <span className="block font-semibold text-slate-100">{opt.label}</span>
                <span className="block text-[10px] text-slate-400">{opt.hint}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {format === 'pdf' && (
        <fieldset className="space-y-1">
          <legend className="mb-1 text-xs font-semibold text-slate-300">PDF-Thema</legend>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name="pdf-theme"
              checked={pdfTheme === 'dark'}
              onChange={() => setPdfTheme('dark')}
            />
            <span>🌙 Dunkles Thema (wie Canvas)</span>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="radio"
              name="pdf-theme"
              checked={pdfTheme === 'light'}
              onChange={() => setPdfTheme('light')}
            />
            <span>☀ Helles Thema (für Ausdruck empfohlen)</span>
          </label>
        </fieldset>
      )}

      <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-[11px] text-slate-400">
        Datei wird unter <code className="rounded bg-slate-800 px-1 py-0.5">{projectName || 'cable-planner'}</code> heruntergeladen.
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'Exportiere…' : `Als ${format.toUpperCase()} herunterladen`}
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------
// Patch sheet section
// --------------------------------------------------------------------
const PatchSheetSection = ({ onClose }: { onClose: () => void }) => {
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const [paper, setPaper] = useState<'a4' | 'a3'>('a4')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return equipment.filter((d) => !q || d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q))
  }, [equipment, filter])

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((d) => d.id)))
  }

  const handleExport = async (asBatch: boolean) => {
    if (selectedIds.size === 0) return
    setBusy(true)
    try {
      const devices = equipment.filter((d) => selectedIds.has(d.id))
      if (asBatch) {
        await exportDevicesPatchSheetsBatch(devices, equipment, cables, { format: paper })
      } else {
        for (const d of devices) {
          await exportDevicePatchSheet(d, equipment, cables, { format: paper })
        }
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <fieldset className="space-y-1">
        <legend className="text-xs font-semibold text-slate-300">Papier</legend>
        <div className="flex gap-2">
          {(['a4', 'a3'] as const).map((p) => (
            <label
              key={p}
              className={`flex cursor-pointer items-center gap-1 rounded border px-3 py-1 text-xs ${
                paper === p ? 'border-sky-500 bg-sky-900/30' : 'border-slate-700 bg-slate-950'
              }`}
            >
              <input type="radio" name="paper" checked={paper === p} onChange={() => setPaper(p)} />
              <span>{p.toUpperCase()}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">
            Geräte ({selectedIds.size} / {filtered.length})
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded bg-slate-800 px-2 py-0.5 text-[10px] hover:bg-slate-700"
          >
            {selectedIds.size === filtered.length ? 'Alle abwählen' : 'Alle wählen'}
          </button>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtern…"
          className="mb-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
        />
        <div className="max-h-64 space-y-0.5 overflow-y-auto rounded border border-slate-800 bg-slate-950/50 p-1">
          {filtered.map((d) => {
            const on = selectedIds.has(d.id)
            return (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-slate-800"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev)
                      if (on) next.delete(d.id)
                      else next.add(d.id)
                      return next
                    })
                  }}
                />
                <span className="flex-1 truncate">{d.name}</span>
                <span className="text-[10px] text-slate-500">{d.category}</span>
              </label>
            )
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-center text-[11px] text-slate-500">
              Keine Geräte im Projekt.
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => handleExport(false)}
          disabled={busy || selectedIds.size === 0}
          className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600 disabled:opacity-40"
          title="Eine PDF pro selektiertem Gerät"
        >
          Einzeln ({selectedIds.size} Datei{selectedIds.size === 1 ? '' : 'en'})
        </button>
        <button
          type="button"
          onClick={() => handleExport(true)}
          disabled={busy || selectedIds.size === 0}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          title="Eine Sammel-PDF — ein Gerät pro Seite"
        >
          Sammel-PDF ({selectedIds.size} Seite{selectedIds.size === 1 ? '' : 'n'})
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------
// BOM section — delegates to existing CableBomDialog for advanced options
// --------------------------------------------------------------------
const BomSection = ({
  onOpenCableBom,
  onClose,
}: {
  onOpenCableBom?: () => void
  onClose: () => void
}) => {
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
        <h4 className="mb-1 text-sm font-semibold">Kabel-Stückliste (BOM)</h4>
        <p className="mb-2 text-slate-400">
          Aggregiert alle Kabel im Projekt nach Typ + Länge. Kann zusätzlich
          gegen Rentman abgeglichen werden (Verbaut vs. Geplant vs. Differenz).
        </p>
        <ul className="ml-4 list-disc space-y-0.5 text-slate-400">
          <li>CSV — für Excel / Google Sheets</li>
          <li>PDF — gedrucktes Datenblatt mit Rentman-Differenzen</li>
        </ul>
        <button
          type="button"
          onClick={() => {
            onOpenCableBom?.()
            onClose()
          }}
          disabled={!onOpenCableBom}
          className="mt-3 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Kabel-Stückliste öffnen…
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------
// Print section — delegates to existing PrintDialog
// --------------------------------------------------------------------
const PrintSection = ({
  onOpenPrintDialog,
  onClose,
}: {
  onOpenPrintDialog?: () => void
  onClose: () => void
}) => {
  return (
    <div className="space-y-3 text-xs">
      <div className="rounded border border-slate-700 bg-slate-950/50 p-3">
        <h4 className="mb-1 text-sm font-semibold">OS-Druckdialog</h4>
        <p className="mb-2 text-slate-400">
          Öffnet den Druckdialog deines Betriebssystems mit Live-Vorschau.
          Drucker, Papierformat und Skalierung wählst du dort.
        </p>
        <ul className="ml-4 list-disc space-y-0.5 text-slate-400">
          <li>Gesamten Plan (Canvas) drucken</li>
          <li>Geräte-Patch-Sheets (1 Seite pro Gerät) drucken</li>
        </ul>
        <button
          type="button"
          onClick={() => {
            onOpenPrintDialog?.()
            onClose()
          }}
          disabled={!onOpenPrintDialog}
          className="mt-3 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
        >
          Druck-Dialog öffnen…
        </button>
      </div>
    </div>
  )
}
