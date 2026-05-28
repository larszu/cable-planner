// v7.9.0 / Issue #110 — Unified Export Dialog (Hub).
// v7.9.4 — User-Iteration: jede Sektion enthält jetzt direkt die volle
//          Funktionalität (kein Delegate an Standalone-Dialoge mehr):
//   - Plan: "Als PDF herunterladen" UND "Drucken"
//   - Patch-Sheets: "Einzel PDF", "Sammel PDF", "Drucken" — A4/A3-
//     Auswahl erscheint NACH dem Klick
//   - Kabel-Stückliste: voller Inhalt direkt eingebettet (keine
//     "Öffnen…"-Schaltfläche mehr)
//   - Print-Tab entfernt — Drucken passiert jetzt pro Sektion

import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from '../../lib/i18n'
import {
  buildDevicePatchSheetBlob,
  buildDevicesPatchSheetsBatchBlob,
  exportDevicePatchSheet,
  exportDevicesPatchSheetsBatch,
} from '../../lib/exportDevicePdf'
import { printPdfBlob } from '../../lib/printPdfBlob'
import { sanitizeForPdf } from '../../lib/sanitizeForPdf'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { LayerVisibilityChips } from '../Canvas/LayerVisibilityChips'
import type { Cable } from '../../types/cable'

export type ExportFormat = 'pdf' | 'png' | 'jpeg'
type Section = 'plan' | 'patch' | 'bom'

/** v7.9.103 — Page-Size-Optionen fuer den Vektor-PDF-Pfad. */
export type PdfPageSizeOpt =
  | 'auto'
  | 'original'
  | 'a4'
  | 'a3'
  | 'a2'
  | 'a1'
  | 'a0'
  | 'a0plus'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  /** Triggert PDF-Download des Plans. v7.9.97: optional `vector`-Flag
   *  schaltet auf den Chromium-printToPDF-Pfad (Beta).
   *  v7.9.103: optional `pageSize` waehlt das Plotter-Format. */
  onExportPdf: (
    theme: 'dark' | 'light',
    vector?: boolean,
    pageSize?: PdfPageSizeOpt,
  ) => Promise<void> | void
  /** Triggert OS-Druckdialog mit dem Plan-PDF. */
  onPrintPdf: (theme: 'dark' | 'light') => Promise<void> | void
  /** Triggert PNG/JPEG-Download des Plans. */
  onExportImage: (format: 'png' | 'jpeg') => Promise<void> | void
}

const SECTION_LABEL: Record<Section, string> = {
  plan: 'Plan',
  patch: 'Patch-Sheets',
  bom: 'Kabel-Stückliste',
}

const SECTION_ICON: Record<Section, string> = {
  plan: '📑',
  patch: '🔌',
  bom: '🧮',
}

const SECTION_DESC: Record<Section, string> = {
  plan: 'Den Canvas-Plan als PDF herunterladen oder direkt drucken. PDF mit Titelblock — druckfertig. Auch PNG/JPEG für E-Mail/Slack.',
  patch: 'Pro Gerät eine Port-Belegungs-Liste — ideal zum Aufkleben am Gerät. Auswahl an Geräten, dann Einzel-PDF, Sammel-PDF oder direkt drucken. Papier-Format wird nach Klick abgefragt. Alternativ: kompakte Patchliste (eine Zeile pro Kabel, sortiert nach Quell-Gerät) für den Techniker im Feld.',
  bom: 'Stückliste aller Kabel im Projekt (Typ + Länge zusammengefasst). Editierbare Rentman-Planung daneben. Export als CSV oder PDF.',
}

export const ExportDialog = ({
  open,
  onClose,
  onExportPdf,
  onPrintPdf,
  onExportImage,
}: ExportDialogProps) => {
  const t = useTranslation()
  const [section, setSection] = useState<Section>('plan')

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl sm:flex-row">
        <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/40 p-3 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r">
          <h3 className="mb-2 hidden px-2 text-xs font-semibold uppercase tracking-wider text-slate-500 sm:block">
            {t('export.title', 'Exportieren & Drucken')}
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
              <span>{t(`export.section.${id}`, SECTION_LABEL[id])}</span>
            </button>
          ))}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
            <h2 className="text-base font-semibold">
              {SECTION_ICON[section]} {t(`export.section.${section}`, SECTION_LABEL[section])}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              {t('common.close', 'Schließen')}
            </button>
          </header>
          {/* v7.9.4 — Body als flex-col OHNE eigenes overflow-auto.
              Jede Sektion macht ihr Scrolling intern (innere Tabelle
              bzw. Device-Liste scrollt, Action-Buttons + Footer
              bleiben pinned unten sichtbar). User-Bug:
              "Standard-Viewport von Kabel-Stückliste ist so groß
              dass man scrollen muss um Drucken-Button zu sehen". */}
          <div className="flex min-h-0 flex-1 flex-col p-4">
            <p className="mb-3 shrink-0 text-xs text-slate-400">{SECTION_DESC[section]}</p>
            <div className="flex min-h-0 flex-1 flex-col">
              {section === 'plan' && (
                <PlanSection
                  onExportPdf={onExportPdf}
                  onPrintPdf={onPrintPdf}
                  onExportImage={onExportImage}
                  onClose={onClose}
                />
              )}
              {section === 'patch' && <PatchSheetSection onClose={onClose} />}
              {section === 'bom' && <BomSection />}
            </div>
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
  onPrintPdf,
  onExportImage,
  onClose,
}: {
  onExportPdf: (
    theme: 'dark' | 'light',
    vector?: boolean,
    pageSize?: PdfPageSizeOpt,
  ) => Promise<void> | void
  onPrintPdf: (theme: 'dark' | 'light') => Promise<void> | void
  onExportImage: (format: 'png' | 'jpeg') => Promise<void> | void
  onClose: () => void
}) => {
  const t = useTranslation()
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const canvasTheme = useUiStore((s) => s.canvasTheme)
  const [pdfTheme, setPdfTheme] = useState<'dark' | 'light'>(canvasTheme)
  // v7.9.97 — Beta-Toggle: Vektor-PDF via Chromium printToPDF.
  // Default off, damit der Raster-Pfad unveraendert bleibt.
  const [pdfVector, setPdfVector] = useState(false)
  // v7.9.103 — Plotter-Page-Size fuer den Vektor-Pfad. Default 'auto'
  // = A0-Cap fuer Viewer-Kompatibilitaet. 'original' = volle Groesse
  // fuer Plotter-Drucke.
  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSizeOpt>('auto')
  const [busy, setBusy] = useState(false)
  const projectName = useProjectStore((s) => s.project.metadata.name)

  const handleExport = async () => {
    setBusy(true)
    try {
      if (format === 'pdf') await onExportPdf(pdfTheme, pdfVector, pdfPageSize)
      else await onExportImage(format)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const handlePrint = async () => {
    setBusy(true)
    try {
      // Nur PDF ist sinnvoll druckbar — der OS-Druckdialog erwartet
      // ein PDF im iframe. PNG/JPEG würde direkt das Bild öffnen,
      // ungünstig formatiert für Print.
      await onPrintPdf(pdfTheme)
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
        <legend className="mb-1 text-xs font-semibold text-slate-300">{t('export.format', 'Format')}</legend>
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
        <>
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
          {/* v7.9.97 — Render-Modus: Raster (klassisch) vs Vektor (Beta).
              Vektor-Pfad nutzt Chromium printToPDF → Text bleibt echter
              Text, scharf bei jedem Zoom, kleinere Dateigröße. Default
              ist Raster damit nichts am bestehenden Workflow bricht. */}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs font-semibold text-slate-300">{t('export.renderMode', 'Render-Modus')}</legend>
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="radio"
                name="pdf-render-mode"
                checked={!pdfVector}
                onChange={() => setPdfVector(false)}
                className="mt-0.5"
              />
              <span>
                <span className="block">📷 Raster (klassisch)</span>
                <span className="block text-[10px] text-slate-400">
                  JPEG-Snapshot. Zuverlässig, aber Text wird unscharf bei großem
                  Zoom in der PDF.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="radio"
                name="pdf-render-mode"
                checked={pdfVector}
                onChange={() => setPdfVector(true)}
                className="mt-0.5"
              />
              <span>
                <span className="block">✨ Vektor</span>
                <span className="block text-[10px] text-slate-400">
                  Chromium printToPDF. Text bleibt selektierbar &amp; scharf bei
                  jedem Zoom. Kleinere Dateigröße.
                </span>
              </span>
            </label>
          </fieldset>
          {/* v7.9.103 — Plotter-Page-Size nur bei Vektor relevant. Bei
              Raster ist das fix-bestimmt durch die natural Canvas-Groesse. */}
          {pdfVector && (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-xs font-semibold text-slate-300">
                {t('export.pageSize', 'Page-Size')}
              </legend>
              <select
                value={pdfPageSize}
                onChange={(e) => setPdfPageSize(e.target.value as PdfPageSizeOpt)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              >
                <option value="auto">{t('export.page.auto', 'Auto — A0 Landscape (kompatibel mit allen Viewern)')}</option>
                <option value="a4">A4 Landscape (297×210 mm)</option>
                <option value="a3">A3 Landscape (420×297 mm)</option>
                <option value="a2">A2 Landscape (594×420 mm)</option>
                <option value="a1">A1 Landscape (841×594 mm)</option>
                <option value="a0">A0 Landscape (1189×841 mm)</option>
                <option value="a0plus">A0+ Plotter (1682×1189 mm)</option>
                <option value="original">{t('export.page.original', 'Original — volle Canvas-Groesse fuer Plotter')}</option>
              </select>
              <p className="text-[10px] text-slate-500">
                {pdfPageSize === 'original'
                  ? t('export.page.originalHint', 'Achtung: Edge / Preview zeigen Pages über A0 manchmal weiss an. Acrobat + Plotter-Software drucken trotzdem.')
                  : t('export.page.scaleHint', 'Canvas wird vektoriell auf die Page-Groesse skaliert. Text bleibt scharf.')}
              </p>
            </fieldset>
          )}
          {/* Ebenen-Filter — uebernimmt die Chip-Komponente aus der
              Canvas-Toolbar. Same store, daher synchronisiert sich die
              Auswahl bidirektional. "Nur Video drucken" = alle anderen
              Chips ausschalten, exportieren, Chips wieder einschalten. */}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-xs font-semibold text-slate-300">
              Ebenen (im PDF enthalten)
            </legend>
            <div className="-mx-1 flex flex-wrap gap-1">
              <LayerVisibilityChips />
            </div>
            <p className="text-[10px] text-slate-500">
              Klick auf einen Chip schaltet die Ebene fuer Canvas UND PDF um.
            </p>
          </fieldset>
        </>
      )}

      <div className="rounded border border-slate-800 bg-slate-950/40 p-2 text-[11px] text-slate-400">
        Datei wird unter <code className="rounded bg-slate-800 px-1 py-0.5">{projectName || 'cable-planner'}</code> heruntergeladen.
      </div>

      <div className="flex justify-end gap-2">
        {/* v7.9.4 — Drucken-Button neben "Als PDF herunterladen"
            (User-Request). Nur sinnvoll für PDF; bei PNG/JPEG
            disabled mit Tooltip. */}
        <button
          type="button"
          onClick={handlePrint}
          disabled={busy || format !== 'pdf'}
          title={
            format === 'pdf'
              ? 'Plan-PDF im OS-Druckdialog öffnen'
              : 'Drucken funktioniert nur mit Format PDF — bei PNG/JPEG einfach herunterladen.'
          }
          className="rounded bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40"
        >
          🖨 Drucken
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? 'Verarbeite…' : `Als ${format.toUpperCase()} herunterladen`}
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------
// Patch sheet section
// --------------------------------------------------------------------
type PatchAction = 'individual' | 'batch' | 'print'
type PaperFormat = 'a4' | 'a3'

const PatchSheetSection = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const openPatchList = useUiStore((s) => s.openPatchList)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')
  // v7.9.4 — "Pending" Action nachdem der User auf Einzel/Sammel/Drucken
  // geklickt hat. Solange das gesetzt ist, zeigen wir die A4/A3-
  // Auswahl statt der drei Buttons. Nach Auswahl wird der Job
  // ausgeführt und pendingAction wieder geleert.
  const [pendingAction, setPendingAction] = useState<PatchAction | null>(null)

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return equipment.filter(
      (d) => !q || d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q),
    )
  }, [equipment, filter])

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((d) => d.id)))
  }

  const runAction = async (action: PatchAction, paper: PaperFormat) => {
    if (selectedIds.size === 0) return
    setBusy(true)
    try {
      const devices = equipment.filter((d) => selectedIds.has(d.id))
      if (action === 'batch') {
        await exportDevicesPatchSheetsBatch(devices, equipment, cables, { format: paper })
      } else if (action === 'individual') {
        for (const d of devices) {
          await exportDevicePatchSheet(d, equipment, cables, { format: paper })
        }
      } else if (action === 'print') {
        // Combined PDF in einen Print-Job; mehrere Devices → eine PDF
        // mit einer Seite pro Gerät, damit der User EINEN Druckdialog
        // bekommt statt N.
        const blob =
          devices.length === 1
            ? buildDevicePatchSheetBlob(devices[0], equipment, cables, { format: paper })
            : buildDevicesPatchSheetsBatchBlob(devices, equipment, cables, { format: paper })
        if (blob) void printPdfBlob(blob)
      }
      onClose()
    } finally {
      setBusy(false)
      setPendingAction(null)
    }
  }

  const actionLabel: Record<PatchAction, string> = {
    individual: 'Einzel-PDFs',
    batch: 'Sammel-PDF',
    print: 'Drucken',
  }

  return (
    <div className="space-y-3">
      {/* v7.9.126 — Kompakt-Patchliste (eine Zeile pro Kabel, sortiert nach
          Quell-Gerät) ist hier zusaetzlich erreichbar. War vorher unter
          Werkzeuge → Patchliste; ist jetzt hier weil sie eine Export-/
          Druck-Funktion ist. */}
      <button
        type="button"
        onClick={() => {
          openPatchList()
          onClose()
        }}
        className="flex w-full items-center justify-between rounded border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-left text-xs text-emerald-100 hover:border-emerald-500 hover:bg-emerald-900/40"
        title={t('export.patch.compactTitle', 'Kompakte Patchliste: alle Kabel auf einer Liste, sortiert nach Quell-Gerät — zum Ausdrucken für den Techniker im Feld.')}
      >
        <span>
          <span className="font-semibold">🪢 Patchliste öffnen…</span>
          <span className="ml-2 text-emerald-300/70">
            Eine Zeile pro Kabel, sortiert nach Quell-Gerät
          </span>
        </span>
        <span className="text-emerald-300">→</span>
      </button>

      <div className="mb-1 text-[11px] text-slate-500">
        — oder pro-Gerät Patch-Sheet erzeugen:
      </div>

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
          placeholder={t('export.patch.filterPlaceholder', 'Filtern…')}
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

      {/* v7.9.4 — Action-Zeile. Wenn keine pending action: 3 Buttons.
          Wenn pending action: A4/A3-Auswahl + Abbrechen. */}
      {pendingAction == null ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingAction('individual')}
            disabled={busy || selectedIds.size === 0}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600 disabled:opacity-40"
            title={t('export.patch.perDevice', 'Eine PDF pro selektiertem Gerät')}
          >
            Einzel PDF ({selectedIds.size} Datei{selectedIds.size === 1 ? '' : 'en'})
          </button>
          <button
            type="button"
            onClick={() => setPendingAction('batch')}
            disabled={busy || selectedIds.size === 0}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600 disabled:opacity-40"
            title={t('export.patch.batchPdf', 'Eine Sammel-PDF — ein Gerät pro Seite')}
          >
            Sammel-PDF ({selectedIds.size} Seite{selectedIds.size === 1 ? '' : 'n'})
          </button>
          <button
            type="button"
            onClick={() => setPendingAction('print')}
            disabled={busy || selectedIds.size === 0}
            className="rounded bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-40"
            title={t('export.patch.osPrint', 'Patch-Sheet(s) im OS-Druckdialog öffnen')}
          >
            🖨 Drucken
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded border border-sky-700/60 bg-sky-950/40 px-3 py-2">
          <span className="mr-auto text-xs text-slate-300">
            <span className="font-semibold text-sky-200">{actionLabel[pendingAction]}</span>
            {' '}— Papier-Format wählen:
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runAction(pendingAction, 'a4')}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            A4
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runAction(pendingAction, 'a3')}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            A3
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingAction(null)}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-600 disabled:opacity-40"
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------
// BOM section — Kabel-Stückliste DIREKT eingebettet
// User-Request: "Kabel Stückliste öffnen Button ist ein Schritt zu
// viel. Im Exportieren-Dialog kann direkt Kabel-Stückliste Fenster
// eingebunden sein."
// --------------------------------------------------------------------
interface BomRow {
  key: string
  type: string
  length: number
  built: number
  planned: number
  diff: number
  sample?: Cable
  /** v7.9.117 — Verknuepfter Rentman-Equipment-Name (siehe CableBomDialog). */
  rentmanName?: string
  rentmanId?: string
}

const bomKeyOf = (c: Pick<Cable, 'type' | 'length'>): string => `${c.type}|${c.length}`
const parseBomKey = (key: string): { type: string; length: number } => {
  const [type, lenStr] = key.split('|')
  return { type, length: Number(lenStr) || 0 }
}
const fmtSignFixed = (n: number): string => (n > 0 ? `+${n}` : String(n))

const BomSection = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const updateMeta = useProjectStore((s) => s.updateProjectMetadata)
  const [draftPlan, setDraftPlan] = useState<Record<string, number> | null>(null)

  const rows: BomRow[] = useMemo(() => {
    const built = new Map<string, { count: number; sample: Cable }>()
    for (const c of project.cables) {
      const k = bomKeyOf(c)
      const entry = built.get(k)
      if (entry) entry.count += 1
      else built.set(k, { count: 1, sample: c })
    }
    const planned = draftPlan ?? project.metadata.rentmanCablePlan ?? {}
    const cableMap = project.metadata.rentmanCableMap ?? {}
    // v7.9.117 — Rentman-Name-Lookup via customLibrary, gleicher Pattern
    // wie im CableBomDialog.
    const rentmanNameById = new Map<string, string>()
    for (const tpl of customLibrary) {
      if (tpl.rentmanId) rentmanNameById.set(String(tpl.rentmanId), tpl.name)
    }
    const keys = new Set<string>([...built.keys(), ...Object.keys(planned)])
    const list: BomRow[] = []
    for (const k of keys) {
      const b = built.get(k)?.count ?? 0
      const p = planned[k] ?? 0
      const parsed = parseBomKey(k)
      const mapping = cableMap[k]
      const rentmanId = mapping?.rentmanEquipmentId
      list.push({
        key: k,
        type: parsed.type,
        length: parsed.length,
        built: b,
        planned: p,
        diff: b - p,
        sample: built.get(k)?.sample,
        rentmanId,
        rentmanName: rentmanId ? rentmanNameById.get(String(rentmanId)) : undefined,
      })
    }
    list.sort((a, b) =>
      a.type === b.type ? a.length - b.length : a.type.localeCompare(b.type),
    )
    return list
  }, [
    project.cables,
    project.metadata.rentmanCablePlan,
    project.metadata.rentmanCableMap,
    customLibrary,
    draftPlan,
  ])

  const currentPlan = draftPlan ?? project.metadata.rentmanCablePlan ?? {}
  const setPlanned = (key: string, value: number) => {
    const next = { ...currentPlan, [key]: Math.max(0, value) }
    if (value <= 0) delete next[key]
    setDraftPlan(next)
  }
  const savePlan = () => {
    if (draftPlan) {
      updateMeta({ rentmanCablePlan: draftPlan })
      setDraftPlan(null)
    }
  }
  const discardPlan = () => setDraftPlan(null)

  const exportCsv = () => {
    // v7.9.117 — Rentman-Name als eigene Spalte fuer den Abgleich.
    const lines = [
      ['Typ', 'Rentman-Name', 'Länge (m)', 'Verbaut', 'Rentman geplant', 'Differenz'].join(';'),
    ]
    for (const r of rows) {
      lines.push(
        [
          r.type,
          r.rentmanName ?? '',
          String(r.length),
          String(r.built),
          String(r.planned),
          fmtSignFixed(r.diff),
        ].join(';'),
      )
    }
    downloadBlob(
      // v7.9.116 — Einheitlicher Stempel.
      buildExportFilenameWithSuffix(project.metadata.name || 'cable-planner', 'kabel-bom', 'csv'),
      '﻿' + lines.join('\r\n'),
      'text/csv;charset=utf-8',
    )
  }

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 32
    pdf.setFontSize(14)
    pdf.setTextColor(15)
    pdf.text(sanitizeForPdf('Kabel-Stückliste'), margin, margin + 4)
    pdf.setFontSize(10)
    pdf.setTextColor(60)
    pdf.text(sanitizeForPdf(project.metadata.name || '-'), margin, margin + 22)
    pdf.setFontSize(8)
    pdf.text(sanitizeForPdf(new Date().toLocaleString()), pageWidth - margin, margin + 4, {
      align: 'right',
    })
    const colX = [margin, margin + 160, margin + 260, margin + 340, margin + 440]
    const headerY = margin + 46
    pdf.setFillColor(230, 230, 230)
    pdf.rect(margin, headerY - 10, pageWidth - margin * 2, 14, 'F')
    pdf.setTextColor(15)
    pdf.setFontSize(9)
    ;['Typ', 'Länge (m)', 'Verbaut', 'Rentman', 'Differenz'].forEach((h, i) => {
      pdf.text(sanitizeForPdf(h), colX[i] + 2, headerY)
    })
    let y = headerY + 14
    pdf.setFontSize(9)
    for (const r of rows) {
      if (y > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.setTextColor(15)
      pdf.text(sanitizeForPdf(r.type), colX[0] + 2, y)
      pdf.text(sanitizeForPdf(String(r.length)), colX[1] + 2, y)
      pdf.text(sanitizeForPdf(String(r.built)), colX[2] + 2, y)
      pdf.text(sanitizeForPdf(String(r.planned)), colX[3] + 2, y)
      if (r.diff === 0) pdf.setTextColor(20, 120, 20)
      else if (r.diff > 0) pdf.setTextColor(180, 80, 20)
      else pdf.setTextColor(180, 20, 20)
      pdf.text(sanitizeForPdf(fmtSignFixed(r.diff)), colX[4] + 2, y)
      // v7.9.117 — Rentman-Name unter dem Typ (zweite Zeile pro Eintrag
      // wenn Verknuepfung existiert).
      let nextY = y + 14
      if (r.rentmanName) {
        pdf.setFontSize(7)
        pdf.setTextColor(180, 90, 20)
        pdf.text(sanitizeForPdf(`R: ${r.rentmanName}`), colX[0] + 8, y + 9)
        pdf.setFontSize(9)
        nextY = y + 22
      }
      pdf.setDrawColor(220)
      pdf.line(margin, nextY - 6, pageWidth - margin, nextY - 6)
      y = nextY
    }
    // v7.9.116 — Einheitlicher Stempel.
    pdf.save(buildExportFilenameWithSuffix(project.metadata.name || 'cable-planner', 'kabel-bom', 'pdf'))
  }

  const printPdf = () => {
    // Gleiches Layout wie exportPdf, aber als Blob in den OS-Druckdialog.
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 32
    pdf.setFontSize(14)
    pdf.text(sanitizeForPdf('Kabel-Stückliste'), margin, margin + 4)
    pdf.setFontSize(10)
    pdf.setTextColor(60)
    pdf.text(sanitizeForPdf(project.metadata.name || '-'), margin, margin + 22)
    pdf.setFontSize(8)
    pdf.text(sanitizeForPdf(new Date().toLocaleString()), pageWidth - margin, margin + 4, {
      align: 'right',
    })
    const colX = [margin, margin + 160, margin + 260, margin + 340, margin + 440]
    const headerY = margin + 46
    pdf.setFillColor(230, 230, 230)
    pdf.rect(margin, headerY - 10, pageWidth - margin * 2, 14, 'F')
    pdf.setTextColor(15)
    pdf.setFontSize(9)
    ;['Typ', 'Länge (m)', 'Verbaut', 'Rentman', 'Differenz'].forEach((h, i) => {
      pdf.text(sanitizeForPdf(h), colX[i] + 2, headerY)
    })
    let y = headerY + 14
    pdf.setFontSize(9)
    for (const r of rows) {
      if (y > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.setTextColor(15)
      pdf.text(sanitizeForPdf(r.type), colX[0] + 2, y)
      pdf.text(sanitizeForPdf(String(r.length)), colX[1] + 2, y)
      pdf.text(sanitizeForPdf(String(r.built)), colX[2] + 2, y)
      pdf.text(sanitizeForPdf(String(r.planned)), colX[3] + 2, y)
      if (r.diff === 0) pdf.setTextColor(20, 120, 20)
      else if (r.diff > 0) pdf.setTextColor(180, 80, 20)
      else pdf.setTextColor(180, 20, 20)
      pdf.text(sanitizeForPdf(fmtSignFixed(r.diff)), colX[4] + 2, y)
      // v7.9.117 — Rentman-Name unter dem Typ (zweite Zeile pro Eintrag
      // wenn Verknuepfung existiert).
      let nextY = y + 14
      if (r.rentmanName) {
        pdf.setFontSize(7)
        pdf.setTextColor(180, 90, 20)
        pdf.text(sanitizeForPdf(`R: ${r.rentmanName}`), colX[0] + 8, y + 9)
        pdf.setFontSize(9)
        nextY = y + 22
      }
      pdf.setDrawColor(220)
      pdf.line(margin, nextY - 6, pageWidth - margin, nextY - 6)
      y = nextY
    }
    const blob = pdf.output('blob') as Blob
    void printPdfBlob(blob)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* v7.9.4 — Status-Zeile oben (shrink-0), Tabelle nimmt flex-1 mit
          eigenem overflow-auto, Footer + Action-Buttons sind shrink-0
          → bleiben IMMER sichtbar, egal wie groß der Dialog ist. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <span>
          Verbaute Kabel: <b className="text-slate-200">{project.cables.length}</b>
        </span>
        {rows.some((r) => r.diff < 0) && (
          <span className="rounded bg-red-900/50 px-2 py-0.5 font-semibold text-red-300">
            ⚠ {rows.filter((r) => r.diff < 0).length} Kabeltype(n) fehlen
          </span>
        )}
        {rows.length > 0 && rows.every((r) => r.diff >= 0) && rows.some((r) => r.planned > 0) && (
          <span className="rounded bg-emerald-900/50 px-2 py-0.5 font-semibold text-emerald-300">
            ✓ Alle geplanten Mengen abgedeckt
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-slate-800 bg-slate-950/40">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-950 text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">{t('export.bom.col.type', 'Typ')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.length', 'Länge (m)')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.installed', 'Verbaut')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.rentmanPlanned', 'Rentman geplant')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.diff', 'Differenz')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-slate-500" colSpan={5}>
                  Keine Kabel im Projekt.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.key}
                className={`border-t border-slate-800 ${r.diff < 0 ? 'bg-red-950/30' : ''}`}
              >
                <td className="px-3 py-1">
                  <span className="font-medium text-slate-100">{r.type}</span>
                  {r.sample && (
                    <span className="ml-1 text-[10px] text-slate-500">({r.sample.name})</span>
                  )}
                </td>
                <td className="px-3 py-1 text-right font-mono">{r.length}</td>
                <td className="px-3 py-1 text-right font-mono">{r.built}</td>
                <td className="px-3 py-1 text-right">
                  <input
                    type="number"
                    min={0}
                    value={r.planned}
                    onChange={(e) => setPlanned(r.key, Number(e.target.value))}
                    className="w-16 rounded border border-slate-700 bg-slate-950 px-1 py-0.5 text-right font-mono"
                  />
                </td>
                <td
                  className={`px-3 py-1 text-right font-mono ${
                    r.diff === 0
                      ? 'text-emerald-400'
                      : r.diff > 0
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                  title={
                    r.diff === 0
                      ? 'Verbaut = geplant'
                      : r.diff > 0
                        ? 'Mehr verbaut als geplant'
                        : 'Weniger verbaut als geplant'
                  }
                >
                  {fmtSignFixed(r.diff)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rentman-Planung-Save (shrink-0, pinned). */}
      <div className="flex shrink-0 items-center justify-between text-[11px]">
        <span className="text-slate-400">
          {draftPlan
            ? 'Nicht gespeicherte Änderungen an der Rentman-Planung.'
            : 'Rentman-Planung wird im Projekt gespeichert.'}
        </span>
        <div className="flex gap-2">
          {draftPlan && (
            <button
              type="button"
              onClick={discardPlan}
              className="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
            >
              Verwerfen
            </button>
          )}
          <button
            type="button"
            onClick={savePlan}
            disabled={!draftPlan}
            className="rounded bg-emerald-700 px-3 py-1 text-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Rentman-Planung speichern
          </button>
        </div>
      </div>

      {/* Export-Action-Zeile UNTEN (shrink-0, pinned), analog zu Plan +
          Patch-Sheets. CSV / PDF / Drucken sind die Export-Outputs der
          Sektion. Tabelle nimmt flex-1, diese Zeile shrink-0 → immer
          sichtbar ohne scrollen. */}
      <div className="flex shrink-0 justify-end gap-2 border-t border-slate-800 pt-2">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded bg-slate-700 px-3 py-1.5 text-xs hover:bg-slate-600"
          title={t('export.bom.csvTitle', 'Tabelle als CSV (UTF-8 mit BOM für Excel) herunterladen')}
        >
          Als CSV herunterladen
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          title={t('export.bom.pdfTitle', 'Tabelle als PDF herunterladen')}
        >
          Als PDF herunterladen
        </button>
        <button
          type="button"
          onClick={printPdf}
          className="rounded bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
          title={t('export.bom.osPrint', 'Kabel-Stückliste im OS-Druckdialog öffnen')}
        >
          🖨 Drucken
        </button>
      </div>
    </div>
  )
}
