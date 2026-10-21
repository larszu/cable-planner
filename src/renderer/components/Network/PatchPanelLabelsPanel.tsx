// #999 — Patchfeld-Beschriftung in der Netzwerk-Analyse: Druckstreifen nach
// Vorlage, Label-Drucker-Datei im Format der Patchliste, und der Abgleich mit
// Rack-Bauer und Patchfeld-Bauer. Die Logik steht in `lib/patchPanelLabels.ts`.
import { useMemo, useState } from 'react'
import { Printer, Tag } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { Icon } from '../shared/Icon'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { useTranslation, format } from '../../lib/i18n'
import { printHtmlDocument } from '../../lib/printHtml'
import { buildLabelCsv, LABEL_CSV_FORMATS, type LabelCsvFormat } from '../../lib/labelPrinterCsv'
import {
  buildPanelLabelHtml,
  labelCrossCheck,
  panelLabelRows,
  panelLabelSheets,
  STRIP_TEMPLATES,
  type LabelIssue,
  type StripTemplateChoice,
} from '../../lib/patchPanelLabels'

const btn =
  'inline-flex items-center gap-1 rounded-cp-control border border-cp-border px-2 py-1 text-cp-xs font-medium text-cp-text hover:bg-cp-surface-2 disabled:opacity-40'
const sel = 'rounded-cp-control border border-cp-border bg-cp-surface-3 px-1 py-1 text-cp-xs'

export const PatchPanelLabelsPanel = ({ projectName }: { projectName: string }) => {
  const t = useTranslation()
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const [template, setTemplate] = useState<StripTemplateChoice>('auto')
  const [printer, setPrinter] = useState<LabelCsvFormat>('generic')

  const sheets = useMemo(() => panelLabelSheets(equipment, cables, template), [equipment, cables, template])
  const issues = useMemo(() => labelCrossCheck(equipment, cables), [equipment, cables])
  const rows = useMemo(() => panelLabelRows(sheets), [sheets])

  const issueText = (i: LabelIssue): string => {
    const v = { device: i.device, detail: i.detail ?? '' }
    switch (i.kind) {
      case 'panelNotInRack':
        return format(t('panelLabels.issue.notInRack', '{device}: patch panel is not placed in a rack.'), v)
      case 'panelWithoutLabels':
        return format(t('panelLabels.issue.noLabels', '{device}: no port is cabled, so the strip stays empty.'), v)
      case 'sidesMismatch':
        return format(
          t('panelLabels.issue.sides', '{device}: front and rear have different port counts ({detail}); labels cannot follow through.'),
          v,
        )
      case 'blankCabled':
        return format(t('panelLabels.issue.blank', '{device}: a cable ends on the blank {detail}.'), v)
      case 'portWithoutPanel':
        return format(
          t('panelLabels.issue.bypass', '{device}: port {detail} leaves the rack without going through its patch panel.'),
          v,
        )
    }
  }

  const print = () => printHtmlDocument(buildPanelLabelHtml(`${projectName} – ${t('panelLabels.title', 'Patch panel labels')}`, sheets))
  const exportPrinter = () => {
    const file = buildLabelCsv(rows, printer)
    downloadBlob(buildExportFilenameWithSuffix(projectName, `patchfeld-etiketten-${printer}`, file.ext), file.body, file.mime)
  }
  const templateLabel: Record<(typeof STRIP_TEMPLATES)[number]['id'], string> = {
    'rj45-24': t('panelLabels.template.rj45-24', 'RJ45, 24 ports (15.9 mm)'),
    'rj45-12': t('panelLabels.template.rj45-12', 'RJ45, blocks of 12 (15.9 mm)'),
    'd-16': t('panelLabels.template.d-16', 'D-series, 16 cutouts (24 mm)'),
  }
  const printerLabel: Record<LabelCsvFormat, string> = {
    generic: t('patchList.labelCsv.generic', 'Generic (CSV)'),
    brother: t('patchList.labelCsv.brother', 'Brother P-touch (TXT)'),
    dymo: t('patchList.labelCsv.dymo', 'Dymo (CSV)'),
  }

  return (
    <div className="space-y-2 rounded-cp-card border border-cp-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-cp-sm font-semibold text-cp-text">{t('panelLabels.title', 'Patch panel labels')}</h3>
        <span className="text-cp-xs text-cp-muted">
          {format(t('panelLabels.count', '{panels} panels · {labels} labelled ports'), {
            panels: sheets.length,
            labels: rows.length,
          })}
        </span>
      </div>
      {sheets.length === 0 ? (
        <p className="text-cp-xs text-cp-muted">
          {t('panelLabels.empty', 'No patch panels in this project. Create one in the rack builder.')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as StripTemplateChoice)}
            title={t('panelLabels.template', 'Strip template')}
            className={sel}
          >
            <option value="auto">{t('panelLabels.template.auto', 'Template: automatic')}</option>
            {STRIP_TEMPLATES.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {templateLabel[tp.id]}
              </option>
            ))}
          </select>
          <button type="button" onClick={print} className={btn}>
            <Icon icon={Printer} size="xs" /> {t('panelLabels.print', 'Print strips')}
          </button>
          <select
            value={printer}
            onChange={(e) => setPrinter(e.target.value as LabelCsvFormat)}
            title={t('patchList.labelCsvFormat', 'Label-printer format')}
            className={sel}
          >
            {LABEL_CSV_FORMATS.map((f) => (
              <option key={f} value={f}>
                {printerLabel[f]}
              </option>
            ))}
          </select>
          <button type="button" onClick={exportPrinter} disabled={rows.length === 0} className={btn}>
            <Icon icon={Tag} size="xs" /> {t('panelLabels.export', 'Label-printer file')}
          </button>
        </div>
      )}
      {issues.length === 0 ? (
        sheets.length > 0 && (
          <p className="text-cp-xs text-cp-ok">{t('panelLabels.ok', 'Panels, racks and labels match.')}</p>
        )
      ) : (
        <ul className="space-y-0.5 text-cp-xs text-cp-warn">
          {issues.map((i, n) => (
            <li key={n}>{issueText(i)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
