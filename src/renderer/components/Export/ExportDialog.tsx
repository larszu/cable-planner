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
import { PacketSection } from './PacketSection'
import { useProjectStore } from '../../store/projectStore'
import { listDeviceTypes } from '../../lib/deviceTypeRegistry'
import { AlertTriangle, Check, Download, Lightbulb, Package as PackageIcon } from 'lucide-react'
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
import { exportDeviceConfig } from '../../lib/deviceConfigExport'
import { buildTallyMap, tallyMapCsv, toTallyPiDevices, vergleicheMitPi, type PiVergleich } from '../../lib/tallyMap'
import { cablePlannerApi } from '../../lib/bridge'
import { useSettingsStore } from '../../store/settingsStore'
import { TallyPreShowPanel } from '../Tally/TallyPreShowPanel'
import { toCsv } from '../../lib/csv'
import {
  mvFindings,
  mvSheetTable,
  multiViewersOf,
  sourceNamesFromTallyRows,
} from '../../lib/mvSheet'
import { zusatzBedarf } from '../../lib/planDemandExtras'
import { exportGroupAsPatchPdf, buildGroupPatchPdfBlob } from '../../lib/exportGroupPdf'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { LayerVisibilityChips } from '../Canvas/LayerVisibilityChips'
import type { Cable } from '../../types/cable'
import { PanelHint } from '../shared/PanelHint'
import {
  buildPlanBom,
  outcomeLabel,
  pickListCsv,
  planBomCsv,
  useAusgaben,
  useBestand,
  useEinheiten,
  useLagerorte,
  useTypBestaetigen,
} from '../../lager'

export type ExportFormat = 'pdf' | 'png' | 'jpeg' | 'svg' | 'dxf'
type Section = 'plan' | 'patch' | 'bom' | 'devicebom' | 'rack' | 'tally' | 'packet'

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
    monochrom?: boolean,
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
  devicebom: 'Geräte-Stückliste',
  rack: 'Racks & Gruppen',
  tally: 'Tally-Karte',
  packet: 'Unterlagen-Stapel',
}

const SECTION_ICON: Record<Section, LucideIcon> = {
  plan: FileText,
  patch: CableIcon,
  bom: Calculator,
  devicebom: PackageIcon,
  rack: Server,
  tally: Lightbulb,
  packet: Printer,
}

const SECTION_DESC: Record<Section, string> = {
  plan: 'Den Canvas-Plan als PDF herunterladen oder direkt drucken. PDF mit Titelblock — druckfertig. Auch PNG/JPEG für E-Mail/Slack.',
  patch: 'Pro Gerät eine Port-Belegungs-Liste — ideal zum Aufkleben am Gerät. Auswahl an Geräten, dann Einzel-PDF, Sammel-PDF oder direkt drucken. Papier-Format wird nach Klick abgefragt. Alternativ: kompakte Patchliste (eine Zeile pro Kabel, sortiert nach Quell-Gerät) für den Techniker im Feld.',
  bom: 'Stückliste aller Kabel im Projekt (Typ + Länge zusammengefasst). Editierbare Rentman-Planung daneben. Export als CSV oder PDF.',
  devicebom: 'Was der Plan an Geräten braucht, gezählt nach Modell und gegen das Lager gedeckt. Drei Zustände, die unterscheidbar bleiben: gedeckt (über die Katalog-Identität), VORSCHLAG (Namenstreffer, wartet auf Bestätigung) und nicht im Lager. Dazu die Kommissionier-Liste — nur sicher Gedecktes, nach Lagerort sortiert.',
  rack: 'Gespeicherte Racks und Gruppen einzeln als PDF exportieren oder drucken — eine Patch-Seite pro enthaltenem Gerät mit interner Verkabelung.',
  packet:
    'Mehrere Blätter als EIN druckbarer Stapel: eine Seite je Blatt, Spaltenkopf auf jeder Folgeseite wiederholt, Papierformat und Farbmodus wählbar. Für den Ordner, der mit auf die Show fährt. Jedes Blatt trägt seinen Stempel — ein Stapel aus gestempelten Blättern lässt sich morgen gegen den Plan halten.',
  tally: 'Die Kette Rolle → Gerät → Mischer-Eingang → UMD-Adresse, aus dem Plan abgeleitet und geprüft. Als CSV zum Gegenlesen, als JSON für die tally-pi-Konfiguration. Die Lampe selbst — welcher GPIO-Pin welcher Box — gehört der Hardware und steht bewusst nicht drin.',
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
            {t('export.title', 'Export & print')}
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
              {t('common.close', 'Close')}
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
              {section === 'devicebom' && <DeviceBomSection />}
              {section === 'rack' && <RackGroupSection onClose={onClose} />}
              {section === 'packet' && <PacketSection />}
              {section === 'tally' && <TallySection />}
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
    monochrom?: boolean,
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
  // Bedarf 128 — der Ausdruck fuer den Tisch. Eine Eigenschaft DIESER
  // Ausgabe, deshalb hier im Dialog und nicht in den Einstellungen.
  const [pdfMonochrom, setPdfMonochrom] = useState(false)
  // v7.9.103 — Plotter-Page-Size fuer den Vektor-Pfad. Default 'auto'
  // = A0-Cap fuer Viewer-Kompatibilitaet. 'original' = volle Groesse
  // fuer Plotter-Drucke.
  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSizeOpt>('auto')
  const [busy, setBusy] = useState(false)
  const projectName = useProjectStore((s) => s.project.metadata.name)

  const handleExport = async () => {
    setBusy(true)
    try {
      if (format === 'pdf') await onExportPdf(pdfTheme, pdfVector, pdfPageSize, pdfMonochrom)
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
    { value: 'pdf' as const, icon: FileText, label: 'PDF', hint: t('export.format.pdfHint', 'Vector with title block, printable') },
    { value: 'png' as const, icon: ImageIcon, label: 'PNG', hint: t('export.format.pngHint', 'Transparent possible, sharp') },
    { value: 'jpeg' as const, icon: ImageIcon, label: 'JPEG', hint: t('export.format.jpegHint', 'Smaller, good for email') },
    { value: 'svg' as const, icon: ImageIcon, label: 'SVG', hint: t('export.format.svgHint', 'Scalable, for web / further processing') },
    { value: 'dxf' as const, icon: FileText, label: 'DXF', hint: t('export.format.dxfHint', 'CAD/plotter — devices, cables & text on layers') },
  ]

  return (
    // v7.9.4 sagte: „Body als flex-col OHNE eigenes overflow-auto. Jede
    // Sektion macht ihr Scrolling intern." Diese hier tat es nicht — sie war
    // ein einfacher Block, und bei kleinem Fenster oder vielen Ebenen-Chips
    // rutschten „Drucken" und „Als PDF herunterladen" aus dem Dialog, ohne
    // dass irgendetwas gescrollt haette. Jetzt scrollt der Inhalt, die
    // Knopfleiste bleibt unten stehen.
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
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
            <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">{t('export.pdfTheme', 'PDF theme')}</legend>
            <label className="flex items-center gap-2 text-cp-xs">
              <input
                type="radio"
                name="pdf-theme"
                checked={pdfTheme === 'dark'}
                onChange={() => setPdfTheme('dark')}
              />
              <span className="inline-flex items-center gap-1"><Icon icon={Moon} size="xs" /> {t('export.theme.darkLabel', 'Dark theme (like canvas)')}</span>
            </label>
            <label className="flex items-center gap-2 text-cp-xs">
              <input
                type="radio"
                name="pdf-theme"
                checked={pdfTheme === 'light'}
                onChange={() => setPdfTheme('light')}
              />
              <span className="inline-flex items-center gap-1"><Icon icon={Sun} size="xs" /> {t('export.theme.lightLabel', 'Light theme (recommended for print)')}</span>
            </label>
          </fieldset>
          {/* Bedarf 128 — der Ausdruck fuer den Tisch. Nachgerechnet: die
              sechs Ebenenfarben liegen im Graustufen-Druck zwischen 114 und
              175, Audio und Video 2 von 255 auseinander. Auf einem
              Schwarzweiss-Drucker ist ein Videokabel dasselbe wie ein
              Audiokabel. Ein Strichmuster kam als zweiter Kanal nicht in
              Frage — das gehoert schon `cable.dashed` und dem Laengen-Modus;
              es dafuer zu nehmen hiesse, eine Angabe des Nutzers zu
              ueberschreiben. Deshalb Text: die Ebene steht im Klartext an
              jedem Kabel, und alle Striche bekommen dieselbe Tinte. */}
          <label className="flex items-center gap-2 text-cp-xs">
            <input
              type="checkbox"
              checked={pdfMonochrom}
              onChange={(e) => setPdfMonochrom(e.target.checked)}
            />
            <span>
              {t('export.monochrome', 'Monochrome-safe (layer spelled out, one line colour)')}
            </span>
          </label>
          {/* v7.9.97 — Render-Modus: Raster (klassisch) vs Vektor (Beta).
              Vektor-Pfad nutzt Chromium printToPDF → Text bleibt echter
              Text, scharf bei jedem Zoom, kleinere Dateigröße. Default
              ist Raster damit nichts am bestehenden Workflow bricht. */}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">{t('export.renderMode', 'Render mode')}</legend>
            <label className="flex cursor-pointer items-start gap-2 text-cp-xs">
              <input
                type="radio"
                name="pdf-render-mode"
                checked={!pdfVector}
                onChange={() => setPdfVector(false)}
                className="mt-0.5"
              />
              <span>
                <span className="flex items-center gap-1"><Icon icon={Camera} size="xs" /> {t('export.render.raster', 'Raster (classic)')}</span>
                <span className="block text-[10px] text-cp-text-muted">
                  {t(
                    'export.render.rasterHint',
                    'JPEG snapshot. Reliable, but text blurs at high zoom in the PDF.',
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
                <span className="flex items-center gap-1"><Icon icon={Sparkles} size="xs" /> {t('export.render.vector', 'Vector')}</span>
                <span className="block text-[10px] text-cp-text-muted">
                  {/* ADR-005, Regel 4 — hier standen nur die Vorteile. Der
                      Vektor-Pfad klont das Canvas-DOM und druckt es via
                      Chromium; einen Titelblock baut er nicht. Revision,
                      Stand-Fingerprint und QR, die der Raster-Pfad zeichnet,
                      fehlen im Vektor-PDF also. Wer zwischen zwei Wegen
                      waehlt, muss beide Seiten kennen. */}
                  {t(
                    'export.render.vectorHint',
                    'Chromium printToPDF. Text stays selectable & sharp at any zoom. Smaller file size. No title block — revision, state fingerprint and QR code are in the raster PDF only.',
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
                {t('export.pageSize', 'Page size')}
              </legend>
              <select
                value={pdfPageSize}
                onChange={(e) => setPdfPageSize(e.target.value as PdfPageSizeOpt)}
                className="w-full rounded border border-cp-border bg-cp-surface-1 px-2 py-1 text-cp-xs text-cp-text"
              >
                <option value="auto">{t('export.page.auto', 'Auto — A0 landscape (compatible with all viewers)')}</option>
                <option value="a4">A4 Landscape (297×210 mm)</option>
                <option value="a3">A3 Landscape (420×297 mm)</option>
                <option value="a2">A2 Landscape (594×420 mm)</option>
                <option value="a1">A1 Landscape (841×594 mm)</option>
                <option value="a0">A0 Landscape (1189×841 mm)</option>
                <option value="a0plus">A0+ Plotter (1682×1189 mm)</option>
                <option value="original">{t('export.page.original', 'Original — full canvas size for plotter')}</option>
              </select>
              <p className="text-[10px] text-cp-text-muted">
                {pdfPageSize === 'original'
                  ? t('export.page.originalHint', 'Heads-up: Edge / Preview sometimes display pages above A0 as white. Acrobat + plotter software print them anyway.')
                  : t('export.page.scaleHint', 'Canvas is scaled vectorially to the page size. Text stays sharp.')}
              </p>
            </fieldset>
          )}
          {/* Ebenen-Filter — uebernimmt die Chip-Komponente aus der
              Canvas-Toolbar. Same store, daher synchronisiert sich die
              Auswahl bidirektional. "Nur Video drucken" = alle anderen
              Chips ausschalten, exportieren, Chips wieder einschalten. */}
          <fieldset className="space-y-1">
            <legend className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">
              {t('export.layersInPdf', 'Layers (included in PDF)')}
            </legend>
            <div className="-mx-1 flex flex-wrap gap-1">
              <LayerVisibilityChips />
            </div>
            <p className="text-[10px] text-cp-text-muted">
              {t('export.layersHint', 'Click a chip to toggle that layer for canvas AND PDF.')}
            </p>
          </fieldset>
        </>
      )}

      <div className="rounded border border-cp-border-muted bg-cp-surface-3/40 p-2 text-[11px] text-cp-text-muted">
        {t('export.savedAs', 'Saved as')} <code className="rounded bg-cp-surface-2 px-1 py-0.5">{projectName || 'cable-planner'}</code>
      </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2">
        {/* v7.9.4 — Drucken-Button neben "Als PDF herunterladen"
            (User-Request). Nur sinnvoll für PDF; bei PNG/JPEG
            disabled mit Tooltip. */}
        <button
          type="button"
          onClick={handlePrint}
          disabled={busy || format !== 'pdf'}
          title={
            format === 'pdf'
              ? t('export.printPdfTitle', 'Open plan PDF in OS print dialog')
              : t(
                  'export.printOnlyPdf',
                  'Printing only works with the PDF format — for PNG/JPEG just download.',
                )
          }
          className="rounded bg-indigo-700 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
        >
          <span className="inline-flex items-center gap-1"><Icon icon={Printer} size="xs" /> {t('export.printBtn', 'Print')}</span>
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy && <Spinner size="xs" />}
          {busy
            ? t('export.processing', 'Processing…')
            : t('export.downloadAs', 'Download as {fmt}').replace('{fmt}', format.toUpperCase())}
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
    individual: t('export.patch.actionIndividual', 'Individual PDFs'),
    batch: t('export.patch.actionBatch', 'Batch PDF'),
    print: t('export.printBtn', 'Print'),
  }

  return (
    // Dieselbe Reparatur wie in `PlanSection`: der Inhalt scrollt, die
    // Aktionszeile bleibt unten. Vorher konnte die Geraeteliste die Knoepfe
    // aus dem Dialog schieben.
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
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
        title={t('export.patch.compactTitle', 'Compact patch list: all cables on one list, sorted by source device — to print for the on-site technician.')}
      >
        <span>
          <span className="inline-flex items-center gap-1 font-semibold"><Icon icon={CableIcon} size="xs" /> {t('export.patch.openPatchList', 'Open patch list…')}</span>
          <span className="ml-2 text-emerald-300/70">
            {t('export.patch.compactSub', 'One line per cable, sorted by source device')}
          </span>
        </span>
        <span className="text-emerald-300">→</span>
      </button>

      <div className="mb-1 text-[11px] text-cp-text-muted">
        {t('export.patch.perDeviceHint', '— or create one patch sheet per device:')}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-cp-xs font-semibold text-cp-text-secondary">
            {t('export.patch.devicesCount', 'Devices')} ({selectedIds.size} / {filtered.length})
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className="rounded bg-cp-surface-2 px-2 py-0.5 text-[10px] hover:bg-cp-surface-4"
          >
            {selectedIds.size === filtered.length
              ? t('export.patch.deselectAll', 'Deselect all')
              : t('export.patch.selectAll', 'Select all')}
          </button>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('export.patch.filterPlaceholder', 'Filter…')}
          aria-label={t('export.patch.filterPlaceholder', 'Filter…')}
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
              {t('export.patch.noDevices', 'No devices in the project.')}
            </div>
          )}
        </div>
      </div>

      </div>

      {/* v7.9.4 — Action-Zeile. Wenn keine pending action: 3 Buttons.
          Wenn pending action: A4/A3-Auswahl + Abbrechen. */}
      {pendingAction == null ? (
        <div className="flex shrink-0 justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingAction('individual')}
            disabled={busy || selectedIds.size === 0}
            className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
            title={t('export.patch.perDevice', 'One PDF per selected device')}
          >
            {t('export.patch.individualPdf', 'Individual PDF ({n})').replace('{n}', String(selectedIds.size))}
          </button>
          <button
            type="button"
            onClick={() => setPendingAction('batch')}
            disabled={busy || selectedIds.size === 0}
            className="rounded bg-cp-surface-4 px-3 py-1.5 text-cp-xs hover:bg-cp-surface-5 disabled:opacity-50"
            title={t('export.patch.batchPdf', 'Batch PDF — one device per page')}
          >
            {t('export.patch.combinedPdf', 'Combined PDF ({n})').replace('{n}', String(selectedIds.size))}
          </button>
          <button
            type="button"
            onClick={() => setPendingAction('print')}
            disabled={busy || selectedIds.size === 0}
            className="rounded bg-indigo-700 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
            title={t('export.patch.osPrint', 'Open patch sheet(s) in OS print dialog')}
          >
            <span className="inline-flex items-center gap-1"><Icon icon={Printer} size="xs" /> {t('export.printBtn', 'Print')}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded border border-sky-700/60 bg-sky-950/40 px-3 py-2">
          <span className="mr-auto text-cp-xs text-cp-text-secondary">
            <span className="font-semibold text-sky-200">{actionLabel[pendingAction]}</span>
            {' '}— {t('export.patch.pickPaper', 'Pick paper format:')}
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
            {t('export.patch.cancel', 'Cancel')}
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
          placeholder={t('export.rack.filterPlaceholder', 'Filter racks/groups…')}
          aria-label={t('export.rack.filterPlaceholder', 'Filter racks/groups…')}
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
          {t('export.rack.empty', 'No saved racks or groups yet. Select devices on the canvas and use "Save as rack" / "Save group".')}
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
                    ? t('export.rack.rackBadge', 'Rack · {n} U').replace('{n}', String(p.rack.totalUnits))
                    : t('export.rack.groupBadge', 'Group')}
                  {' · '}
                  {t('export.rack.itemCount', '{n} devices').replace('{n}', String(p.items.length))}
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
                {t('export.rack.print', 'Print')}
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
        t('export.bom.csv.type', 'Type'),
        t('export.bom.csv.rentmanName', 'Rentman name'),
        t('export.bom.csv.lengthM', 'Length (m)'),
        t('export.bom.csv.built', 'Installed'),
        t('export.bom.csv.totalM', 'Total (m)'),
        t('export.bom.csv.rentmanPlanned', 'Rentman planned'),
        t('export.bom.csv.diff', 'Difference'),
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
        t('bom.cable.total', 'Total'),
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
    pdf.text(sanitizeForPdf(t('export.bom.pdfHeading', 'Cable BOM')), margin, margin + 4)
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
      t('export.bom.csv.type', 'Type'),
      t('export.bom.csv.lengthM', 'Length (m)'),
      t('export.bom.csv.built', 'Installed'),
      t('export.bom.col.rentman', 'Rentman'),
      t('export.bom.csv.diff', 'Difference'),
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
    pdf.text(sanitizeForPdf(t('export.bom.pdfHeading', 'Cable BOM')), margin, margin + 4)
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
      t('export.bom.csv.type', 'Type'),
      t('export.bom.csv.lengthM', 'Length (m)'),
      t('export.bom.csv.built', 'Installed'),
      t('export.bom.col.rentman', 'Rentman'),
      t('export.bom.csv.diff', 'Difference'),
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
          {t('export.installedCables', 'Installed cables:')}{' '}
          <b className="text-cp-text-bright">{project.cables.length}</b>
        </span>
        {rows.some((r) => r.diff < 0) && (
          <span className="inline-flex items-center gap-1 rounded bg-red-900/50 px-2 py-0.5 font-semibold text-red-300">
            <Icon icon={AlertTriangle} size="sm" />
            {format(t('export.missingTypes', '{count} cable type(s) missing'), {
              count: rows.filter((r) => r.diff < 0).length,
            })}
          </span>
        )}
        {rows.length > 0 && rows.every((r) => r.diff >= 0) && rows.some((r) => r.planned > 0) && (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-900/50 px-2 py-0.5 font-semibold text-emerald-300">
            <Icon icon={Check} size="sm" />
            {t('export.allCovered', 'All planned quantities covered')}
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded border border-cp-border-muted bg-cp-surface-3/40">
        <table className="w-full text-cp-xs">
          <thead className="sticky top-0 bg-cp-surface-3 text-cp-text-secondary">
            <tr>
              <th className="px-3 py-2 text-left">{t('export.bom.col.type', 'Type')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.length', 'Length (m)')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.installed', 'Installed')}</th>
              <th className="px-3 py-2 text-right">{t('bom.cable.col.totalM', 'Total (m)')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.rentmanPlanned', 'Rentman planned')}</th>
              <th className="px-3 py-2 text-right">{t('export.bom.col.diff', 'Diff')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-center text-cp-text-faint" colSpan={6}>
                  {t('export.bom.noCables', 'No cables in the project.')}
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
                      ? t('export.bom.diffEqual', 'Installed = planned')
                      : r.diff > 0
                        ? t('export.bom.diffMore', 'More installed than planned')
                        : t('export.bom.diffLess', 'Less installed than planned')
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
                <td className="px-3 py-2 text-left" colSpan={2}>{t('bom.cable.total', 'Total')}</td>
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
            {t('export.bom.byLayer', 'By discipline')}:
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
            {t('export.bom.connectors', 'Connectors (ends)')}:
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
            ? t('export.bom.rentmanDirty', 'Unsaved changes to the Rentman plan.')
            : t('export.bom.rentmanClean', 'Rentman plan is saved with the project.')}
        </span>
        <div className="flex gap-2">
          {draftPlan && (
            <button
              type="button"
              onClick={discardPlan}
              className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('common.discard', 'Discard')}
            </button>
          )}
          <button
            type="button"
            onClick={savePlan}
            disabled={!draftPlan}
            className="rounded bg-emerald-700 px-3 py-1 text-cp-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('export.bom.savePlan', 'Save Rentman plan')}
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
          title={t('export.bom.csvTitle', 'Download table as CSV (UTF-8 with BOM for Excel)')}
        >
          {t('export.bom.csv', 'Download as CSV')}
        </button>
        <button
          type="button"
          onClick={exportPdf}
          className="rounded bg-emerald-600 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-emerald-500"
          title={t('export.bom.pdfTitle', 'Download table as PDF')}
        >
          {t('export.bom.pdf', 'Download as PDF')}
        </button>
        <button
          type="button"
          onClick={printPdf}
          className="rounded bg-indigo-700 px-3 py-1.5 text-cp-xs font-medium text-white hover:bg-indigo-600"
          title={t('export.bom.osPrint', 'Open cable BOM in OS print dialog')}
        >
          <span className="inline-flex items-center gap-1"><Icon icon={Printer} size="xs" /> {t('export.printBtn', 'Print')}</span>
        </button>
      </div>
    </div>
  )
}

// --------------------------------------------------------------------
// Tally section (Roadmap-Initiative 2)
//
// Der Markt plant Tally nicht, er faehrt es nur — die Adress-Zuordnung ist
// ueberall Handarbeit. Hier steht sie als abgeleitete, pruefbare Tabelle:
// Rolle → Geraet → Mischer-Eingang → UMD-Adresse. Drei der vier Glieder
// beantwortet der Plan; das vierte, die Lampe, gehoert der Hardware und wird
// ausdruecklich NICHT erfunden.

/**
 * BEDARF 125 — das Multiviewer-Bild als Blatt.
 *
 *   > MV window assignment is configured by hand per show; remote recall is
 *   > unreliable, so THE TRUSTED STORE IS THE SWITCHER'S OWN BINARY SAVE
 *   > FILE, WHICH NO OTHER DEPARTMENT CAN READ.
 *
 * Der Plan macht den Recall nicht zuverlaessiger — das ist Sache des
 * Mischers. Er liefert das Blatt, das heute fehlt: welche Rolle steht in
 * welchem Fenster, lesbar fuer Regie, Bildtechnik und Kameraleute, aus
 * derselben Aufloesung wie Tally und UMD.
 */
const MvSheetPanel = ({ map }: { map: ReturnType<typeof buildTallyMap> }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const projectName = useProjectStore((s) => s.project.metadata?.name)

  const namen = useMemo(() => sourceNamesFromTallyRows(map.rows), [map.rows])
  const geraete = useMemo(
    () => equipment.filter((e) => multiViewersOf(e).length > 0),
    [equipment],
  )
  const befunde = useMemo(
    () => geraete.flatMap((e) => mvFindings(multiViewersOf(e), namen)),
    [geraete, namen],
  )

  if (geraete.length === 0) return null

  const laden = (device: (typeof geraete)[number]) => {
    const table = mvSheetTable(device.name, multiViewersOf(device), namen)
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, `mv-${device.name}`, 'csv'),
      toCsv(table.headers, table.rows),
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div className="shrink-0 rounded border border-cp-border bg-cp-surface-2 p-2">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-cp-xs font-semibold text-cp-text-secondary">
          {t('mv.sheet.title', 'Multiviewer layout (who is in which window)')}
        </span>
        {geraete.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => laden(e)}
            className="inline-flex items-center gap-1 rounded border border-cp-border px-2 py-0.5 text-cp-xs hover:bg-cp-surface-3"
          >
            <Icon icon={Download} size="xs" />
            {e.name}
          </button>
        ))}
      </div>
      <PanelHint
        className="text-cp-xs text-cp-text-muted"
        text={t(
          'mv.sheet.hint',
          'The names come from the same roles as tally and UMD \u2014 not from a second, hand-kept list. The switcher stores its layout as a binary file; this sheet can be read by the camera crew too.',
        )}
      />
      {befunde.length > 0 && (
        <ul className="mt-1 flex max-h-32 flex-col gap-0.5 overflow-auto text-cp-xs">
          {befunde.map((b, idx) => (
            <li
              key={`${b.kind}:${b.mvIndex}:${idx}`}
              className={b.severity === 'error' ? 'text-cp-danger' : 'text-cp-warn'}
            >
              {b.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const TallySection = () => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const map = useMemo(
    () =>
      buildTallyMap({
        equipment: project.equipment,
        cables: project.cables,
        sourceIdentities: project.sourceIdentities,
      }),
    [project.equipment, project.cables, project.sourceIdentities],
  )

  const errors = map.issues.filter((i) => i.severity === 'error')
  const warnings = map.issues.filter((i) => i.severity === 'warning')

  const downloadCsv = () => {
    downloadBlob(
      buildExportFilenameWithSuffix(project.metadata?.name, 'tally', 'csv'),
      tallyMapCsv(map),
      'text/csv;charset=utf-8',
    )
  }
  // B-6 / E-7 — der Direktweg. Er ist AUSDRUECKLICH einzuschalten und braucht
  // eine Adresse; ohne beides steht dieser Block gar nicht da. Die Datei
  // daneben bleibt der Vorgabeweg und verschwindet nicht.
  const piUrl = useSettingsStore((st) => st.tallyPiUrl)
  const piDirekt = useSettingsStore((st) => st.tallyPiDirekt)
  const [piGelesen, setPiGelesen] = useState<{ adresse: string; vergleich: PiVergleich } | null>(null)
  const [piMeldung, setPiMeldung] = useState<{ ton: 'ok' | 'fehler'; text: string } | null>(null)
  const [piLaeuft, setPiLaeuft] = useState(false)

  const piLesen = async () => {
    setPiLaeuft(true)
    setPiMeldung(null)
    const antwort = await cablePlannerApi.tally.read(piUrl)
    setPiLaeuft(false)
    if (!antwort.ok) {
      setPiGelesen(null)
      setPiMeldung({ ton: 'fehler', text: antwort.error ?? 'Der Pi hat nicht geantwortet.' })
      return
    }
    setPiGelesen({ adresse: piUrl, vergleich: vergleicheMitPi(antwort.json, toTallyPiDevices(map)) })
  }

  const piSenden = async () => {
    setPiLaeuft(true)
    setPiMeldung(null)
    const antwort = await cablePlannerApi.tally.write(piUrl, toTallyPiDevices(map))
    setPiLaeuft(false)
    if (!antwort.ok) {
      setPiMeldung({ ton: 'fehler', text: antwort.error ?? 'Der Pi hat die Karte nicht angenommen.' })
      return
    }
    // Nach dem Schreiben ist der gelesene Stand veraltet. Ihn stehen zu
    // lassen hiesse, beim naechsten Klick eine Vorschau zu zeigen, die es so
    // nicht mehr gibt — und der zweite Sendeknopf waere ohne neuen Blick frei.
    setPiGelesen(null)
    setPiMeldung({
      ton: 'ok',
      text: t('export.tally.piSent', 'The tally map is on the Pi.'),
    })
  }

  const downloadTallyPi = () => {
    // BEDARF 43 — die Geraetedatei fuer den Pi geht mit Herkunfts-Blatt raus.
    exportDeviceConfig(
      'tally-pi',
      'Geräteliste für die Tally-Karte',
      buildExportFilenameWithSuffix(project.metadata?.name, 'tally-devices', 'json'),
      JSON.stringify({ devices: toTallyPiDevices(map) }, null, 2),
      'application/json',
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {map.rows.length === 0 ? (
        <p className="rounded border border-cp-border bg-cp-surface-2 p-3 text-cp-xs text-cp-text-secondary">
          {t(
            'export.tally.empty',
            'No signal-source roles in the plan yet. A role is assigned on the device under "Signal source (role)" in the properties — it carries name, number and UMD address, and outlives the device swap.',
          )}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded border border-cp-border">
          <table className="w-full border-collapse text-cp-xs">
            <thead className="sticky top-0 bg-cp-surface-3">
              <tr className="text-left text-cp-text-secondary">
                <th className="px-2 py-1.5">{t('export.tally.col.no', 'No.')}</th>
                <th className="px-2 py-1.5">{t('export.tally.col.role', 'Role')}</th>
                <th className="px-2 py-1.5">{t('export.tally.col.devices', 'Device(s)')}</th>
                <th className="px-2 py-1.5">{t('export.tally.col.switcher', 'Switcher')}</th>
                <th className="px-2 py-1.5">{t('export.tally.col.input', 'Input')}</th>
                <th className="px-2 py-1.5">{t('export.tally.col.umd', 'UMD')}</th>
              </tr>
            </thead>
            <tbody>
              {map.rows.map((row) => (
                <tr key={row.identityId} className="border-t border-cp-border-muted">
                  <td className="px-2 py-1 font-mono">{row.number ?? ''}</td>
                  <td className="px-2 py-1">{row.name}</td>
                  <td className="px-2 py-1 text-cp-text-secondary">
                    {row.devices.map((d) => d.name).join(' + ') || '—'}
                  </td>
                  <td className="px-2 py-1 text-cp-text-secondary">{row.switcher?.name ?? '—'}</td>
                  <td className="px-2 py-1 font-mono">{row.switcher?.input ?? '—'}</td>
                  <td
                    className={`px-2 py-1 font-mono ${
                      row.umdAddress === undefined ? 'text-cp-warn' : ''
                    }`}
                  >
                    {row.umdAddress ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* BEDARF 125 — das Multiviewer-Bild. Es steht HIER und nicht in einem
          eigenen Abschnitt, weil es an derselben Aufloesung haengt wie die
          Tally-Karte darueber: „labels come from the source records". Ein
          eigener Abschnitt verfuehrte dazu, die Namen ein zweites Mal
          aufzuloesen — genau die dritte handgefuehrte Kopie, die der Bedarf
          beklagt. */}
      <MvSheetPanel map={map} />

      {/* BEDARF 105 — die zweite Haelfte. Die Karte darueber sagt, was der Plan
          ABLEITET; hier steht, was niemand ableiten kann: der Weg zur Lampe
          und was jemand beim Hinsehen gesehen hat. */}
      <TallyPreShowPanel />

      {map.issues.length > 0 && (
        <div className="max-h-40 shrink-0 overflow-auto rounded border border-cp-border bg-cp-surface-2 p-2">
          <p className="mb-1 text-cp-xs font-semibold text-cp-text-secondary">
            {format(
              t('export.tally.issues', 'Validation: {errors} errors, {warnings} notes'),
              { errors: errors.length, warnings: warnings.length },
            )}
          </p>
          <ul className="flex flex-col gap-0.5 text-cp-xs">
            {[...errors, ...warnings].map((issue, idx) => (
              <li
                key={`${issue.kind}:${issue.subject}:${idx}`}
                className={issue.severity === 'error' ? 'text-cp-danger' : 'text-cp-warn'}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={downloadCsv}
          disabled={map.rows.length === 0}
          className="rounded bg-sky-700 px-3 py-1.5 text-cp-xs text-white hover:bg-sky-600 disabled:opacity-40"
        >
          {t('export.tally.csv', 'Tally map as CSV')}
        </button>
        <button
          type="button"
          onClick={downloadTallyPi}
          disabled={map.rows.length === 0}
          className="rounded border border-cp-border px-3 py-1.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-3 disabled:opacity-40"
          title={t(
            'export.tally.piTitle',
            'The part of tally.json the plan owns: id, name, input. ATEM IP and GPIO pins stay with the box.',
          )}
        >
          {t('export.tally.pi', 'tally-pi devices (JSON)')}
        </button>
      </div>

      {/* B-6 / E-7 — der Direktweg. Er steht NEBEN der Datei und nicht an
          ihrer Stelle: die Datei ist der Vorgabeweg und der einzige, der ohne
          Netz zum Pi funktioniert. Sichtbar wird er nur, wenn er in den
          Einstellungen eingeschaltet UND eine Adresse hinterlegt ist. */}
      {piDirekt && piUrl.trim() !== '' && map.rows.length > 0 && (
        <div className="rounded border border-cp-border bg-cp-surface-2 p-3">
          <div className="mb-2 flex items-center gap-2 text-cp-xs text-cp-text-secondary">
            <Icon icon={Lightbulb} size="sm" />
            {format(t('export.tally.piDirect', 'Straight to the Pi: {url}'), { url: piUrl })}
          </div>
          <PanelHint
            className="mb-2 text-cp-xs text-cp-text-muted"
            text={t(
              'export.tally.piDirect.hint',
              'The Pi keeps its wiring — the plan does not send the ATEM address or GPIO pins. Roles missing from the plan, however, disappear there along with their pin assignment. So read first, then send.',
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={piLesen}
              disabled={piLaeuft}
              className="rounded border border-cp-border px-3 py-1.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-3 disabled:opacity-40"
            >
              {t('export.tally.piRead', 'Read the Pi')}
            </button>
            <button
              type="button"
              onClick={piSenden}
              // ERST LESEN, DANN SENDEN — und zwar von DIESER Adresse. Wer
              // die Adresse nach dem Lesen aendert, hat den Stand eines
              // anderen Pi gesehen, und die Vorschau gilt nicht mehr.
              disabled={piLaeuft || piGelesen === null || piGelesen.adresse !== piUrl}
              className="rounded bg-cp-accent px-3 py-1.5 text-cp-xs text-white disabled:opacity-40"
            >
              {t('export.tally.piSend', 'Send to the Pi')}
            </button>
            {piLaeuft && <Spinner />}
          </div>
          {piGelesen && piGelesen.adresse === piUrl && (
            <ul className="mt-2 flex flex-col gap-1 text-cp-xs">
              <li className="text-cp-text-muted">
                {format(
                  t('export.tally.piDiff', '{bleiben} stay, {neu} are added'),
                  { bleiben: piGelesen.vergleich.bleiben, neu: piGelesen.vergleich.neu.length },
                )}
              </li>
              {piGelesen.vergleich.verschwinden.map((v) => (
                <li key={v.id} className={v.hatVerdrahtung ? 'text-cp-danger' : 'text-cp-warn'}>
                  {format(
                    v.hatVerdrahtung
                      ? t(
                          'export.tally.piGoneWired',
                          '{name} disappears from the Pi — along with its GPIO assignment',
                        )
                      : t('export.tally.piGone', '{name} disappears from the Pi'),
                    { name: v.name },
                  )}
                </li>
              ))}
            </ul>
          )}
          {piMeldung && (
            <p
              className={`mt-2 text-cp-xs ${piMeldung.ton === 'ok' ? 'text-cp-text-secondary' : 'text-cp-danger'}`}
            >
              {piMeldung.text}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------
// Device BOM section (ADR-002, Inkrement 4)
//
// Das groesste unbesetzte Feld der Feature-Matrix: der technische Plan
// erzeugt die kaufmaennische Stueckliste, statt dass sie abgetippt wird —
// und ihre andere Haelfte, die Kommissionier-Liste fuers Lager.
//
// Die Darstellung hat eine Pflicht: Ein VORSCHLAG muss als Vorschlag
// erkennbar bleiben. Eine Liste, die Vorschlag und Deckung gleich aussehen
// laesst, wird geglaubt statt gelesen, und der erste Irrtum kommt als
// fehlendes Geraet am Aufbautag heraus.

const OUTCOME_STYLE: Record<string, string> = {
  'matched-by-type': 'text-cp-text',
  'proposed-by-name': 'text-cp-warn font-semibold',
  unmatched: 'text-cp-danger',
}

const DeviceBomSection = () => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const projectName = useProjectStore((s) => s.project.metadata?.name)
  const items = useBestand()
  const nodes = useLagerorte()
  // Serialisierte Einheiten: ihr Zustand nimmt Stuecke aus dem nutzbaren
  // Bestand. Ohne sie meldete die Liste „gedeckt, Bestand 4", waehrend zwei
  // davon in der Werkstatt standen.
  const units = useEinheiten()
  const typBestaetigen = useTypBestaetigen()
  // ADR-002, die zweite Haelfte des Auswegs: Der Vorschlag laesst sich auf der
  // LAGER-Position bestaetigen (`typBestaetigen`) — aber eine Zeile ohne
  // Katalog-Typ im PLAN blieb ohne Handlung. Sie stand mit „(ohne Katalog-Typ)"
  // da, und wer das lesen konnte, musste das Geraet auf dem Canvas suchen und
  // im Eigenschaften-Panel einzeln zuweisen. Bei drei gleichen Kameras dreimal.
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const katalogTypen = useMemo(() => listDeviceTypes(), [])
  const typZuweisen = (ids: string[], deviceTypeId: string) => {
    // Alle Geraete der Zeile in einem Zug: Der Bedarf ist der Typ, gezaehlt.
    // Eine halb zugewiesene Zeile zerfiele beim naechsten Abgleich in eine
    // Tatsache und mehrere Vermutungen.
    for (const id of ids) updateEquipment(id, { deviceTypeId })
  }

  // `drumKit` und `wirelessRig` sind eigene Projektfelder und standen in
  // keiner Stueckliste. Beide tragen echte Katalog-GUIDs; das Zubehoer der
  // Drum-Mikrofonierung (Stative, Clamps, XLR) kommt ueber den Namen mit.
  const drumKit = useProjectStore((s) => s.project.drumKit)
  const wirelessRig = useProjectStore((s) => s.project.wirelessRig)
  // Bedarf 17 — die Kabel und die vom Plan verlangten Adapter gehoeren in
  // DIESELBE Liste. Das Lager kommissioniert aus einer, nicht aus dreien.
  const cables = useProjectStore((s) => s.project.cables)
  const zusatz = useMemo(
    () => zusatzBedarf({ drumKit, wirelessRig, cables, equipment }),
    [drumKit, wirelessRig, cables, equipment],
  )
  // Bedarf 80: die offenen Ausgaben gehoeren in die Rechnung. Ohne sie sagt
  // die Stueckliste „Bestand 5" fuer ein Case, das auf einer anderen Show
  // steht — „the PM promises gear they do not have".
  const checkoutRecords = useAusgaben()
  const bom = useMemo(
    () => buildPlanBom(equipment, items, nodes, units, zusatz, checkoutRecords),
    [equipment, items, nodes, units, zusatz, checkoutRecords],
  )

  const download = (suffix: string, content: string) =>
    downloadBlob(
      buildExportFilenameWithSuffix(projectName, suffix, 'csv'),
      content,
      'text/csv;charset=utf-8',
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {bom.rows.length === 0 ? (
        <p className="rounded border border-cp-border bg-cp-surface-2 p-3 text-cp-xs text-cp-text-secondary">
          {t('export.devicebom.empty', 'No devices in the plan yet.')}
        </p>
      ) : (
        <>
          <div className="flex shrink-0 flex-wrap gap-3 text-cp-xs">
            <span className="text-cp-text-secondary">
              {format(t('export.devicebom.matched', '{n} covered'), { n: bom.matched })}
            </span>
            <span className={bom.proposed > 0 ? 'text-cp-warn' : 'text-cp-text-muted'}>
              {format(t('export.devicebom.proposed', '{n} proposals'), { n: bom.proposed })}
            </span>
            <span className={bom.unmatched > 0 ? 'text-cp-danger' : 'text-cp-text-muted'}>
              {format(t('export.devicebom.unmatched', '{n} not in stock'), { n: bom.unmatched })}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded border border-cp-border">
            <table className="w-full border-collapse text-cp-xs">
              <thead className="sticky top-0 bg-cp-surface-3">
                <tr className="text-left text-cp-text-secondary">
                  <th className="px-2 py-1.5">{t('export.devicebom.col.qty', 'Qty')}</th>
                  <th className="px-2 py-1.5">{t('export.devicebom.col.model', 'Model')}</th>
                  <th className="px-2 py-1.5">{t('export.devicebom.col.state', 'Coverage')}</th>
                  <th className="px-2 py-1.5">{t('export.devicebom.col.stock', 'Stock')}</th>
                  <th className="px-2 py-1.5">{t('export.devicebom.col.location', 'Location')}</th>
                </tr>
              </thead>
              <tbody>
                {bom.rows.map((row, idx) => (
                  <tr key={`${row.model}:${idx}`} className="border-t border-cp-border-muted">
                    <td className="px-2 py-1 font-mono">{row.quantity}</td>
                    <td className="px-2 py-1">
                      {row.model}
                      {row.modelIsDeviceName && (
                        <span
                          className="ml-1 text-cp-text-muted"
                          title={t(
                            'export.devicebom.noTypeTitle',
                            'No catalogue type — the model name here is only the device name. Assigning a catalogue type turns the coverage into a fact.',
                          )}
                        >
                          {t('export.devicebom.noType', '(no catalogue type)')}
                        </span>
                      )}
                      {/* Der Ausweg aus „(ohne Katalog-Typ)": ein Griff, der
                          allen Geraeten dieser Zeile die Katalog-Identitaet
                          gibt. Ab dann deckt der Abgleich ueber die GUID —
                          eine Tatsache statt eines Namensvergleichs, und zwar
                          dauerhaft im Plan, nicht nur in dieser Ansicht.

                          NUR wo es ein Ziel gibt: Rack-Innenleben und
                          Zusatz-Bedarfe haben kein eigenes EquipmentItem
                          (`typeTargetIds` ist dort leer). Ein Auswahlfeld,
                          das dort ins Leere schriebe, waere schlimmer als
                          keines. */}
                      {row.modelIsDeviceName && row.typeTargetIds.length > 0 && (
                        <select
                          value=""
                          onChange={(event) => {
                            if (event.target.value) {
                              typZuweisen(row.typeTargetIds, event.target.value)
                            }
                          }}
                          className="ml-2 max-w-[14rem] rounded border border-cp-border bg-cp-surface-1 px-1 py-0.5 text-[10px] text-cp-text-secondary"
                          title={t(
                            'export.devicebom.assignTitle',
                            'Writes the catalogue type onto every device in this row. Stock coverage then matches on the catalogue identity instead of the name.',
                          )}
                        >
                          <option value="">
                            {t('export.devicebom.assign', 'Assign type…')}
                          </option>
                          {katalogTypen.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.category ? `${c.name} · ${c.category}` : c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className={`px-2 py-1 ${OUTCOME_STYLE[row.outcome] ?? ''}`} title={row.reason}>
                      {outcomeLabel(row.outcome)}
                      {row.short !== undefined && row.short > 0 && (
                        <span className="ml-1 text-cp-danger">
                          {format(t('export.devicebom.short', '— {n} missing'), { n: row.short })}
                        </span>
                      )}
                      {/* Der Ausweg aus dem Vorschlag: ein Klick schreibt die
                          Katalog-Identitaet auf die Lager-Position, und die
                          Zeile ist ab dann eine Tatsache — dauerhaft, nicht
                          nur in dieser Ansicht. */}
                      {row.outcome === 'proposed-by-name' && row.itemId && row.deviceTypeId && (
                        <button
                          type="button"
                          onClick={() =>
                            typBestaetigen(row.itemId!, row.deviceTypeId!)
                          }
                          className="ml-2 rounded border border-cp-border px-1.5 py-0.5 text-[10px] font-normal text-cp-text-secondary hover:bg-cp-surface-3"
                          title={t(
                            'export.devicebom.confirmTitle',
                            'Writes the catalogue identity permanently onto this inventory position. The coverage is then a fact and never has to be guessed from the name again.',
                          )}
                        >
                          {t('export.devicebom.confirm', 'Confirm')}
                        </button>
                      )}
                    </td>
                    {/* Bedarf 80: die Qualifizierung steht IN DEMSELBEN
                        Zug wie die Zahl („5 im Lager · 3 verfügbar"), nicht
                        in einer Fussnote und nicht in einem Tooltip. Und die
                        Bindung steht am Objekt, das sie hat — nicht als
                        ausgegrauter Knopf irgendwo anders. */}
                    <td className="px-2 py-1 font-mono">
                      {row.available ?? '—'}
                      {row.committed !== undefined && row.committed > 0 && (
                        <span className="ml-1 font-sans text-cp-warn" title={row.commitmentNote}>
                          {format(
                            t('export.devicebom.committed', '(of {stock} · {n} checked out)'),
                            { stock: row.stock ?? '?', n: row.committed },
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-cp-text-secondary">{row.location || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => download('geraete-bom', planBomCsv(bom))}
          disabled={bom.rows.length === 0}
          className="rounded bg-sky-700 px-3 py-1.5 text-cp-xs text-white hover:bg-sky-600 disabled:opacity-40"
        >
          {t('export.devicebom.csv', 'Device BOM as CSV')}
        </button>
        <button
          type="button"
          onClick={() => download('kommissionierliste', pickListCsv(bom))}
          disabled={bom.matched === 0}
          className="rounded border border-cp-border px-3 py-1.5 text-cp-xs text-cp-text-secondary hover:bg-cp-surface-3 disabled:opacity-40"
          title={t(
            'export.devicebom.pickTitle',
            'Only what is certainly covered, sorted by storage location. Proposals are deliberately left out — whoever picks should not have to decide on the way.',
          )}
        >
          {t('export.devicebom.pick', 'Pick list (CSV)')}
        </button>
      </div>
    </div>
  )
}
