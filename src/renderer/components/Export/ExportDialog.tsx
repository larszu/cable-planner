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
import {
  FileText, Cable as CableIcon, Calculator, Image as ImageIcon, Printer,
  Moon, Sun, Camera, Sparkles, Server, type LucideIcon,
} from 'lucide-react'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import jsPDF from 'jspdf'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { AlertTriangle, Check } from 'lucide-react'
import { useTranslation, format } from '../../lib/i18n'
import { detectLayerForConnector, type StandardLayer } from '../../lib/cableLayers'

const LAYER_LABEL_DE: Record<string, string> = {
  video: 'Video',
  audio: 'Audio',
  control: 'Steuerung',
  network: 'Netzwerk',
  power: 'Strom',
  other: 'Sonstiges',
}
import { Icon } from '../shared/Icon'
import { Spinner } from '../shared/Spinner'
import {
  buildDevicePatchSheetBlob,
  buildDevicesPatchSheetsBatchBlob,
  exportDevicePatchSheet,
  exportDevicesPatchSheetsBatch,
} from '../../lib/exportDevicePdf'
import { printPdfBlob } from '../../lib/printPdfBlob'
import { sanitizeForPdf } from '../../lib/sanitizeForPdf'
import { downloadBlob } from '../../lib/downloadBlob'
import { exportGroupAsPatchPdf, buildGroupPatchPdfBlob } from '../../lib/exportGroupPdf'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { LayerVisibilityChips } from '../Canvas/LayerVisibilityChips'
import type { Cable } from '../../types/cable'

export type ExportFormat = 'pdf' | 'png' | 'jpeg' | 'svg' | 'dxf'
type Section = 'plan' | 'patch' | 'bom' | 'rack'

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
  onExportImage: (format: 'png' | 'jpeg' | 'svg' | 'dxf') => Promise<void> | void
}

const SECTION_LABEL: Record<Section, string> = {
  plan: 'Plan',
  patch: 'Patch-Sheets',
  bom: 'Kabel-Stückliste',
  rack: 'Racks & Gruppen',
}

const SECTION_ICON: Record<Section, LucideIcon> = {
  plan: FileText,
  patch: CableIcon,
  bom: Calculator,
  rack: Server,
}

const SECTION_DESC: Record<Section, string> = {
  plan: 'Den Canvas-Plan als PDF herunterladen oder direkt drucken. PDF mit Titelblock — druckfertig. Auch PNG/JPEG für E-Mail/Slack.',
  patch: 'Pro Gerät eine Port-Belegungs-Liste — ideal zum Aufkleben am Gerät. Auswahl an Geräten, dann Einzel-PDF, Sammel-PDF oder direkt drucken. Papier-Format wird nach Klick abgefragt. Alternativ: kompakte Patchliste (eine Zeile pro Kabel, sortiert nach Quell-Gerät) für den Techniker im Feld.',
  bom: 'Stückliste aller Kabel im Projekt (Typ + Länge zusammengefasst). Editierbare Rentman-Planung daneben. Export als CSV oder PDF.',
  rack: 'Gespeicherte Racks und Gruppen einzeln als PDF exportieren oder drucken — eine Patch-Seite pro enthaltenem Gerät mit interner Verkabelung.',
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
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, onClose)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded border border-cp-border bg-cp-surface-1 text-cp-text shadow-2xl outline-none sm:flex-row"
      >
        <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-cp-border-muted bg-cp-surface-3/40 p-3 sm:w-52 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r">
          <h3 className="mb-2 hidden px-2 text-cp-xs font-semibold uppercase tracking-wider text-cp-text-faint sm:block">
            {t('export.title', 'Exportieren & Drucken')}
          </h3>
          {(Object.keys(SECTION_LABEL) as Section[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={`flex items-center gap-2 rounded px-3 py-2 text-left text-cp-base ${
                section === id
                  ? 'bg-sky-700 text-white'
                  : 'text-cp-text-secondary hover:bg-cp-surface-2'
              }`}
            >
              <Icon icon={SECTION_ICON[id]} size="sm" />
              <span>{t(`export.section.${id}`, SECTION_LABEL[id])}</span>
            </button>
          ))}
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-cp-border-muted px-4 py-2">
            <h2 id={titleId} className="flex items-center gap-2 text-cp-2xl font-semibold">
              <Icon icon={SECTION_ICON[section]} size="sm" />{' '}
              {t(`export.section.${section}`, SECTION_LABEL[section])}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
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
            <p className="mb-3 shrink-0 text-cp-xs text-cp-text-muted">{t(`export.desc.${section}`, SECTION_DESC[section])}</p>
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
              {section === 'rack' && <RackGroupSection onClose={onClose} />}
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
  onExportImage: (format: 'png' | 'jpeg' | 'svg' | 'dxf') => Promise<void> | void
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
    { value: 'pdf' as const, icon: FileText, label: 'PDF', hint: t('export.format.pdfHint', 'Vektor mit Titelblock, druckbar') },
    { value: 'png' as const, icon: ImageIcon, label: 'PNG', hint: t('export.format.pngHint', 'Transparent möglich, scharf') },
    { value: 'jpeg' as const, icon: ImageIcon, label: 'JPEG', hint: t('export.format.jpegHint', 'Kleiner, gut für E-Mail') },
    { value: 'svg' as const, icon: ImageIcon, label: 'SVG', hint: t('export.format.svgHint', 'Skalierbar, für Web/Weiterverarbeitung') },
    { value: 'dxf' as const, icon: FileText, label: 'DXF', hint: t('export.format.dxfHint', 'CAD/Plotter — Geräte, Kabel & Text auf Layern') },
  ]

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">{t('export.format', 'Format')}</legend>
        {FORMAT_OPTIONS.map((opt) => {
          const selected = format === opt.value
          return (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-cp-xs ${
                selected
                  ? 'border-sky-500 bg-sky-900/30'
                  : 'border-cp-border bg-cp-surface-3 hover:border-cp-surface-5'
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
              <Icon icon={opt.icon} size="sm" />
              <span className="flex-1">
                <span className="block font-semibold text-cp-text">{opt.label}</span>
                <span className="block text-[10px] text-cp-text-muted">{opt.hint}</span>
              </span>
            </label>
          )
        })}
      </fieldset>

      {format === 'pdf' && (
        <>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">{t('export.pdfTheme', 'PDF-Thema')}</legend>
            <label className="flex items-center gap-2 text-cp-xs">
              <input
                type="radio"
                name="pdf-theme"
                checked={pdfTheme === 'dark'}
                onChange={() => setPdfTheme('dark')}
              />
              <span className="inline-flex items-center gap-1"><Icon icon={Moon} size="xs" /> {t('export.theme.darkLabel', 'Dunkles Thema (wie Canvas)')}</span>
            </label>
            <label className="flex items-center gap-2 text-cp-xs">
              <input
                type="radio"
                name="pdf-theme"
                checked={pdfTheme === 'light'}
                onChange={() => setPdfTheme('light')}
              />
              <span className="inline-flex items-center gap-1"><Icon icon={Sun} size="xs" /> {t('export.theme.lightLabel', 'Helles Thema (für Ausdruck empfohlen)')}</span>
            </label>
          </fieldset>
          {/* v7.9.97 — Render-Modus: Raster (klassisch) vs Vektor (Beta).
              Vektor-Pfad nutzt Chromium printToPDF → Text bleibt echter
              Text, scharf bei jedem Zoom, kleinere Dateigröße. Default
              ist Raster damit nichts am bestehenden Workflow bricht. */}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">{t('export.renderMode', 'Render-Modus')}</legend>
            <label className="flex cursor-pointer items-start gap-2 text-cp-xs">
              <input
                type="radio"
                name="pdf-render-mode"
                checked={!pdfVector}
                onChange={() => setPdfVector(false)}
                className="mt-0.5"
              />
              <span>
                <span className="flex items-center gap-1"><Icon icon={Camera} size="xs" /> {t('export.render.raster', 'Raster (klassisch)')}</span>
                <span className="block text-[10px] text-cp-text-muted">
                  {t(
                    'export.render.rasterHint',
                    'JPEG-Snapshot. Zuverlässig, aber Text wird unscharf bei großem Zoom in der PDF.',
                  )}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-cp-xs">
              <input
                type="radio"
                name="pdf-render-mode"
                checked={pdfVector}
                onChange={() => setPdfVector(true)}
                className="mt-0.5"
              />
              <span>
                <span className="flex items-center gap-1"><Icon icon={Sparkles} size="xs" /> {t('export.render.vector', 'Vektor')}</span>
                <span className="block text-[10px] text-cp-text-muted">
                  {t(
                    'export.render.vectorHint',
                    'Chromium printToPDF. Text bleibt selektierbar & scharf bei jedem Zoom. Kleinere Dateigröße.',
                  )}
                </span>
              </span>
            </label>
          </fieldset>
          {/* v7.9.103 — Plotter-Page-Size nur bei Vektor relevant. Bei
              Raster ist das fix-bestimmt durch die natural Canvas-Groesse. */}
          {pdfVector && (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">
                {t('export.pageSize', 'Page-Size')}
              </legend>
              <select
                value={pdfPageSize}
                onChange={(e) => setPdfPageSize(e.target.value as PdfPageSizeOpt)}
                className="w-full rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs text-cp-text"
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
              <p className="text-[10px] text-cp-text-muted">
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
            <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">
              {t('export.layersInPdf', 'Ebenen (im PDF enthalten)')}
            </legend>
            <div className="-mx-1 flex flex-wrap gap-1">
              <LayerVisibilityChips />
            </div>
            <p className="text-[10px] text-cp-text-muted">
              {t('export.layersHint', 'Klick auf einen Chip schaltet die Ebene für Canvas UND PDF um.')}
            </p>
          </fieldset>
        </>
      )}

      <div className="rounded border border-cp-border-muted bg-cp-surface-3/40 p-2 text-[11px] text-cp-text-muted">
        {t('export.savedAs', 'Wird gespeichert als')} <code className="rounded bg-cp-surface-2 px-1 py-0.5">{projectName || 'cable-planner'}</code>
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
              ? t('export.printPdfTitle', 'Plan-PDF im OS-Druckdialog öffnen')
              : t(
                  'export.printOnlyPdf',
                  'Drucken funktioniert nur mit Format PDF — bei PNG/JPEG einfach herunterladen.',
                )
          }
          className="rounded bg-indigo-700 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1"><Icon icon={Printer} size="xs" /> {t('export.printBtn', 'Drucken')}</span>
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy && <Spinner size="xs" />}
          {busy
            ? t('export.processing', 'Verarbeite…')
            : t('export.downloadAs', 'Als {fmt} herunterladen').replace('{fmt}', format.toUpperCase())}
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
    individual: t('export.patch.actionIndividual', 'Einzel-PDFs'),
    batch: t('export.patch.actionBatch', 'Sammel-PDF'),
    print: t('export.printBtn', 'Drucken'),
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
        className="flex w-full items-center justify-between rounded border border-emerald-700/60 bg-emerald-950/30 px-3 py-2 text-left text-cp-xs text-emerald-100 hover:border-emerald-500 hover:bg-emerald-900/40"
        title={t('export.patch.compactTitle', 'Kompakte Patchliste: alle Kabel auf einer Liste, sortiert nach Quell-Gerät — zum Ausdrucken für den Techniker im Feld.')}
      >
        <span>
          <span className="inline-flex items-center gap-1 font-semibold"><Icon icon={CableIcon} size="xs" /> {t('export.patch.openPatchList', 'Patchliste öffnen…')}</span>
          <span className="ml-2 text-emerald-300/70">
            {t('export.patch.compactSub', 'Eine Zeile pro Kabel, sortiert nach Quell-Gerät')}
          </span>
        </span>
        <span className="text-emerald-300">→</span>
      </button>

      <div className="mb-1 text-[11px] text-cp-text-muted">
        {t('export.patch.perDeviceHint', '— oder pro-Gerät Patch-Sheet erzeugen:')}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-cp-xs font-semibold text-cp-text-secondary">
            {t('export.patch.devicesCount', 'Geräte')} ({selectedIds.size} / {filtered.length})
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded bg-cp-surface-2 px-2 py-0.5 text-[10px] hover:bg-cp-surface-4"
          >
            {selectedIds.size === filtered.length
              ? t('export.patch.deselectAll', 'Alle abwählen')
              : t('export.patch.selectAll', 'Alle wählen')}
          </button>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('export.patch.filterPlaceholder', 'Filtern…')}
          aria-label={t('export.patch.filterPlaceholder', 'Filtern…')}
          className="mb-2 w-full rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
        />
        <div className="max-h-64 space-y-0.5 overflow-y-auto rounded border border-cp-border-muted bg-cp-surface-3/50 p-1">
          {filtered.map((d) => {
            const on = selectedIds.has(d.id)
            return (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-cp-xs hover:bg-cp-surface-2"
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
                <span className="text-[10px] text-cp-text-muted">{d.category}</span>
              </label>
            )
          })}
          {filtered.length === 0 && (
            <div className="px-2 py-3 text-center text-[11px] text-cp-text-muted">
              {t('export.patch.noDevices', 'Keine Geräte im Projekt.')}
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
            className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
            title={t('export.patch.perDevice', 'Eine PDF pro selektiertem Gerät')}
          >
            {t('export.patch.individualPdf', 'Einzel-PDF ({n})').replace('{n}', String(selectedIds.size))}
          </button>
          <button
            type="button"
            onClick={() => setPendingAction('batch')}
            disabled={busy || selectedIds.size === 0}
            className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
            title={t('export.patch.batchPdf', 'Eine Sammel-PDF — ein Gerät pro Seite')}
          >
            {t('export.patch.combinedPdf', 'Sammel-PDF ({n})').replace('{n}', String(selectedIds.size))}
          </button>
          <button
            type="button"
            onClick={() => setPendingAction('print')}
            disabled={busy || selectedIds.size === 0}
            className="rounded bg-indigo-700 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
            title={t('export.patch.osPrint', 'Patch-Sheet(s) im OS-Druckdialog öffnen')}
          >
            <span className="inline-flex items-center gap-1"><Icon icon={Printer} size="xs" /> {t('export.printBtn', 'Drucken')}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded border border-sky-700/60 bg-sky-950/40 px-3 py-2">
          <span className="mr-auto text-cp-xs text-cp-text-secondary">
            <span className="font-semibold text-sky-200">{actionLabel[pendingAction]}</span>
            {' '}— {t('export.patch.pickPaper', 'Papier-Format wählen:')}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runAction(pendingAction, 'a4')}
            className="rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            A4
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runAction(pendingAction, 'a3')}
            className="rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            A3
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingAction(null)}
            className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs text-cp-text-bright hover:bg-cp-surface-5 disabled:opacity-50"
          >
            {t('export.patch.cancel', 'Abbrechen')}
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

/* ----------------------------------------------------------- Racks & Gruppen -- */
/* #151 — gespeicherte Racks/Gruppen (GroupPresets) einzeln exportieren. */
const RackGroupSection = ({ onClose }: { onClose: () => void }) => {
  const t = useTranslation()
  const groupPresets = useProjectStore((s) => s.groupPresets)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')
  const [paper, setPaper] = useState<PaperFormat>('a4')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return groupPresets.filter((p) => !q || p.name.toLowerCase().includes(q))
  }, [groupPresets, filter])

  const run = async (preset: (typeof groupPresets)[number], action: 'pdf' | 'print') => {
    setBusy(true)
    try {
      if (action === 'pdf') {
        await exportGroupAsPatchPdf(preset, { format: paper })
      } else {
        const blob = buildGroupPatchPdfBlob(preset, { format: paper })
        if (blob) void printPdfBlob(blob)
      }
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-3">
      <div className="flex shrink-0 items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('export.rack.filterPlaceholder', 'Racks/Gruppen filtern…')}
          aria-label={t('export.rack.filterPlaceholder', 'Racks/Gruppen filtern…')}
          className="flex-1 rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
        />
        <label className="flex items-center gap-1 text-cp-xs text-cp-text-secondary">
          {t('export.rack.paper', 'Format')}
          <select
            value={paper}
            onChange={(e) => setPaper(e.target.value as PaperFormat)}
            className="rounded border border-cp-border bg-cp-surface-3 px-1.5 py-1 text-cp-xs"
          >
            <option value="a4">A4</option>
            <option value="a3">A3</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded border border-dashed border-cp-border p-6 text-center text-cp-xs text-cp-text-muted">
          {t('export.rack.empty', 'Keine gespeicherten Racks oder Gruppen vorhanden. Wähle Geräte auf dem Canvas aus und nutze „Als Rack speichern" / „Gruppe speichern".')}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded border border-cp-border-muted bg-cp-surface-3/50 p-1">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-cp-xs hover:bg-cp-surface-2"
            >
              <Icon icon={Server} size="xs" className="text-cp-text-faint" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 text-cp-text-faint">
                  {p.rack
                    ? t('export.rack.rackBadge', 'Rack · {n} HE').replace('{n}', String(p.rack.totalUnits))
                    : t('export.rack.groupBadge', 'Gruppe')}
                  {' · '}
                  {t('export.rack.itemCount', '{n} Geräte').replace('{n}', String(p.items.length))}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(p, 'pdf')}
                className="rounded bg-sky-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {t('export.rack.pdf', 'PDF')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(p, 'print')}
                className="rounded bg-cp-surface-4 px-2 py-1 text-[11px] hover:bg-cp-surface-5 disabled:opacity-50"
              >
                <Icon icon={Printer} size="xs" className="mr-1 inline-block align-text-bottom" />
                {t('export.rack.print', 'Drucken')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const BomSection = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const updateMeta = useProjectStore((s) => s.updateProjectMetadata)
  const [draftPlan, setDraftPlan] = useState<Record<string, number> | null>(null)

  // Per-Gewerk-Zusammenfassung (Video/Audio/Control/Network/Power): Anzahl +
  // Gesamtlänge. Effektiver Layer = cable.layer, sonst aus dem Connector.
  // Plus Steckverbinder-Inventar über alle Kabel-Enden (für Loom/Adapter).
  const { layerSummary, connectorSummary } = useMemo(() => {
    const portById = new Map<string, { connectorType?: string }>()
    for (const e of project.equipment) for (const p of [...e.inputs, ...e.outputs]) portById.set(p.id, p)
    const m = new Map<string, { count: number; meters: number }>()
    const conn = new Map<string, number>()
    for (const c of project.cables) {
      const explicit = (c.layer ?? '').toLowerCase()
      const layer = ['video', 'audio', 'control', 'network', 'power'].includes(explicit)
        ? (explicit as StandardLayer)
        : detectLayerForConnector(portById.get(c.fromPortId)?.connectorType as never)
      const e = m.get(layer) ?? { count: 0, meters: 0 }
      e.count += 1
      e.meters += c.length ?? 0
      m.set(layer, e)
      for (const pid of [c.fromPortId, c.toPortId]) {
        const ct = portById.get(pid)?.connectorType
        if (ct) conn.set(ct, (conn.get(ct) ?? 0) + 1)
      }
    }
    return {
      layerSummary: [...m.entries()].map(([layer, v]) => ({ layer, ...v })).sort((a, b) => b.meters - a.meters),
      connectorSummary: [...conn.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    }
  }, [project.cables, project.equipment])

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
      [
        t('export.bom.csv.type', 'Typ'),
        t('export.bom.csv.rentmanName', 'Rentman-Name'),
        t('export.bom.csv.lengthM', 'Länge (m)'),
        t('export.bom.csv.built', 'Verbaut'),
        t('export.bom.csv.totalM', 'Gesamt (m)'),
        t('export.bom.csv.rentmanPlanned', 'Rentman geplant'),
        t('export.bom.csv.diff', 'Differenz'),
      ].join(';'),
    ]
    for (const r of rows) {
      lines.push(
        [
          r.type,
          r.rentmanName ?? '',
          String(r.length),
          String(r.built),
          String(Number((r.built * r.length).toFixed(1))),
          String(r.planned),
          fmtSignFixed(r.diff),
        ].join(';'),
      )
    }
    lines.push(
      [
        t('bom.cable.total', 'Gesamt'),
        '',
        '',
        String(rows.reduce((s, r) => s + r.built, 0)),
        String(Number(rows.reduce((s, r) => s + r.built * r.length, 0).toFixed(1))),
        '',
        '',
      ].join(';'),
    )
    downloadBlob(
      // v7.9.116 — Einheitlicher Stempel.
      buildExportFilenameWithSuffix(project.metadata.name || 'cable-planner', 'kabel-bom', 'csv'),
      '﻿' + lines.join('\r\n'),
      'text/csv;charset=utf-8',
    )
  }

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 32
    pdf.setFontSize(14)
    pdf.setTextColor(15)
    pdf.text(sanitizeForPdf(t('export.bom.pdfHeading', 'Kabel-Stückliste')), margin, margin + 4)
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
    ;[
      t('export.bom.csv.type', 'Typ'),
      t('export.bom.csv.lengthM', 'Länge (m)'),
      t('export.bom.csv.built', 'Verbaut'),
      t('export.bom.col.rentman', 'Rentman'),
      t('export.bom.csv.diff', 'Differenz'),
    ].forEach((h, i) => {
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
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 32
    pdf.setFontSize(14)
    pdf.text(sanitizeForPdf(t('export.bom.pdfHeading', 'Kabel-Stückliste')), margin, margin + 4)
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
    ;[
      t('export.bom.csv.type', 'Typ'),
      t('export.bom.csv.lengthM', 'Länge (m)'),
      t('export.bom.csv.built', 'Verbaut'),
      t('export.bom.col.rentman', 'Rentman'),
      t('export.bom.csv.diff', 'Differenz'),
    ].forEach((h, i) => {
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
      <div className="flex shrink-0 flex-wrap items-center gap-2 text-[11px] text-cp-text-muted">
        <span>
          {t('export.installedCables', 'Verbaute Kabel:')}{' '}
          <b className="text-cp-text-bright">{project.cables.length}</b>
        </span>
        {rows.some((r) => r.diff < 0) && (
          <span className="inline-flex items-center gap-1 rounded bg-red-900/50 px-2 py-0.5 font-semibold text-red-300">
            <Icon icon={AlertTriangle} size="sm" />
            {format(t('export.missingTypes', '{count} Kabeltype(n) fehlen'), {
              count: rows.filter((r) => r.diff < 0).length,
            })}
          </span>
        )}
        {rows.length > 0 && rows.every((r) => r.diff >= 0) && rows.some((r) => r.planned > 0) && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-900/50 px-2 py-0.5 font-semibold text-emerald-300">
            <Icon icon={Check} size="sm" />
            {t('export.allCovered', 'Alle geplanten Mengen abgedeckt')}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-cp-border-muted bg-cp-surface-3/40">
        <table className="w-full text-cp-xs">
          <thead className="sticky top-0 bg-cp-surface-3 text-cp-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">{t('export.bom.col.type', 'Typ')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.length', 'Länge (m)')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.installed', 'Verbaut')}</th>
              <th className="px-3 py-2 text-right">{t('bom.cable.col.totalM', 'Gesamt (m)')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.rentmanPlanned', 'Rentman geplant')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.diff', 'Differenz')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-cp-text-faint" colSpan={6}>
                  {t('export.bom.noCables', 'Keine Kabel im Projekt.')}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.key}
                className={`border-t border-cp-border-muted ${r.diff < 0 ? 'bg-red-950/30' : ''}`}
              >
                <td className="px-3 py-1">
                  <span className="font-medium text-cp-text">{r.type}</span>
                  {r.sample && (
                    <span className="ml-1 text-[10px] text-cp-text-muted">({r.sample.name})</span>
                  )}
                </td>
                <td className="px-3 py-1 text-right font-mono">{r.length}</td>
                <td className="px-3 py-1 text-right font-mono">{r.built}</td>
                <td className="px-3 py-1 text-right font-mono text-cp-text-secondary">
                  {Number((r.built * r.length).toFixed(1))}
                </td>
                <td className="px-3 py-1 text-right">
                  <input
                    type="number"
                    min={0}
                    value={r.planned}
                    onChange={(e) => setPlanned(r.key, Number(e.target.value))}
                    className="w-16 rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-right font-mono"
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
                      ? t('export.bom.diffEqual', 'Verbaut = geplant')
                      : r.diff > 0
                        ? t('export.bom.diffMore', 'Mehr verbaut als geplant')
                        : t('export.bom.diffLess', 'Weniger verbaut als geplant')
                  }
                >
                  {fmtSignFixed(r.diff)}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-cp-surface-3">
              <tr className="border-t-2 border-cp-border font-semibold text-cp-text-bright">
                <td className="px-3 py-2 text-left" colSpan={2}>{t('bom.cable.total', 'Gesamt')}</td>
                <td className="px-3 py-2 text-right font-mono">{rows.reduce((s, r) => s + r.built, 0)}</td>
                <td className="px-3 py-2 text-right font-mono text-emerald-300">
                  {Number(rows.reduce((s, r) => s + r.built * r.length, 0).toFixed(1))} m
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Per-Gewerk-Zusammenfassung (Anzahl + Meter je Layer). */}
      {layerSummary.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-cp-text-muted">
          <span className="font-semibold uppercase tracking-wide text-cp-text-faint">
            {t('export.bom.byLayer', 'Je Gewerk')}:
          </span>
          {layerSummary.map((l) => (
            <span key={l.layer}>
              {t(`layer.${l.layer}`, LAYER_LABEL_DE[l.layer] ?? l.layer)}:{' '}
              <b className="text-cp-text-bright">{l.count}×</b>{' '}
              <span className="font-mono">{Number(l.meters.toFixed(1))} m</span>
            </span>
          ))}
        </div>
      )}
      {connectorSummary.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-cp-text-muted">
          <span className="font-semibold uppercase tracking-wide text-cp-text-faint">
            {t('export.bom.connectors', 'Steckverbinder (Enden)')}:
          </span>
          {connectorSummary.map((c) => (
            <span key={c.type}>
              {c.type} <b className="text-cp-text-bright">×{c.count}</b>
            </span>
          ))}
        </div>
      )}

      {/* Rentman-Planung-Save (shrink-0, pinned). */}
      <div className="flex shrink-0 items-center justify-between text-[11px]">
        <span className="text-cp-text-muted">
          {draftPlan
            ? t('export.bom.rentmanDirty', 'Nicht gespeicherte Änderungen an der Rentman-Planung.')
            : t('export.bom.rentmanClean', 'Rentman-Planung wird im Projekt gespeichert.')}
        </span>
        <div className="flex gap-2">
          {draftPlan && (
            <button
              type="button"
              onClick={discardPlan}
              className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('common.discard', 'Verwerfen')}
            </button>
          )}
          <button
            type="button"
            onClick={savePlan}
            disabled={!draftPlan}
            className="rounded bg-emerald-700 px-3 py-1 text-cp-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('export.bom.savePlan', 'Rentman-Planung speichern')}
          </button>
        </div>
      </div>

      {/* Export-Action-Zeile UNTEN (shrink-0, pinned), analog zu Plan +
          Patch-Sheets. CSV / PDF / Drucken sind die Export-Outputs der
          Sektion. Tabelle nimmt flex-1, diese Zeile shrink-0 → immer
          sichtbar ohne scrollen. */}
      <div className="flex shrink-0 justify-end gap-2 border-t border-cp-border-muted pt-2">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5"
          title={t('export.bom.csvTitle', 'Tabelle als CSV (UTF-8 mit BOM für Excel) herunterladen')}
        >
          {t('export.bom.csv', 'Als CSV herunterladen')}
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className="rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-emerald-500"
          title={t('export.bom.pdfTitle', 'Tabelle als PDF herunterladen')}
        >
          {t('export.bom.pdf', 'Als PDF herunterladen')}
        </button>
        <button
          type="button"
          onClick={printPdf}
          className="rounded bg-indigo-700 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-indigo-600"
          title={t('export.bom.osPrint', 'Kabel-Stückliste im OS-Druckdialog öffnen')}
        >
          <span className="inline-flex items-center gap-1"><Icon icon={Printer} size="xs" /> {t('export.printBtn', 'Drucken')}</span>
        </button>
      </div>
    </div>
  )
}
