/**
 * Festinstallation — Doku-/Übergabe-Dialog.
 *
 * Ein Ort für alle Lebenszyklus-Deliverables einer Festinstallation:
 *  - Installateur-Listen (Pull-/Termination-/Schedule-/BOM-CSV)
 *  - Betreiber-Asset-Register (CSV)
 *  - QR-/Asset-IDs vergeben + QR-Etiketten-PDF
 *  - Übergabe-Paket (Markdown-Manifest)
 *  - Änderungsprotokoll (wer/was/wann) ansehen/leeren
 *  - Bearbeiter-Identität setzen (Autor der Protokoll-/Service-Einträge)
 */
import { useMemo, useState } from 'react'
import { recordEmission } from '../../lib/documentLog'
import jsPDF from 'jspdf'
import QRCode from 'qrcode'
import {
  Download,
  ClipboardList,
  QrCode,
  PackageCheck,
  History,
  Trash2,
  Tag,
  Inbox,
  Check,
  X,
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { useSettingsStore } from '../../store/settingsStore'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import {
  pullListCsv,
  pullListTable,
  terminationListCsv,
  terminationListTable,
  cableScheduleCsv,
  cableScheduleTable,
  cableBomCsv,
  cableBomTable,
} from '../../lib/installerLists'
import { assetRegisterCsv, assetRegisterTable } from '../../lib/assetRegister'
import { stampForRows } from '../../lib/documentStamp'
import { buildHandoverManifest, handoverTable } from '../../lib/handoverPackage'
import {
  JOB_BASIS_LABEL,
  JOB_FINDING_LABEL,
  assessJobHandover,
} from '../../lib/jobHandover'
import { cableLabelId, equipmentAssetTag, qrPayload } from '../../lib/docIds'
import { PanelHint } from '../shared/PanelHint'

type ExportRow = {
  key: string
  label: string
  hint: string
  build: () => { content: string; suffix: string; ext: string; mime: string }
}

export const InstallationDocsDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.installDocs.open)
  const close = useUiStore((s) => s.closeInstallDocs)
  const project = useProjectStore((s) => s.project)
  const filePath = useProjectStore((s) => s.filePath)
  const assignDocIds = useProjectStore((s) => s.assignDocIds)
  const applySourceDestLabels = useProjectStore((s) => s.applySourceDestLabels)
  const clearChangelog = useProjectStore((s) => s.clearChangelog)
  const applyPendingChange = useProjectStore((s) => s.applyPendingChange)
  const rejectPendingChange = useProjectStore((s) => s.rejectPendingChange)
  const editorName = useSettingsStore((s) => s.editorName)
  const setEditorName = useSettingsStore((s) => s.setEditorName)

  const [reserve, setReserve] = useState(10)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')
  const [overwriteLabels, setOverwriteLabels] = useState(false)
  /**
   * BEDARF 11 — an wen dieses Blatt geht.
   *
   * Freitext und nicht Pflicht: der Bedarf spricht von Abteilungen, und
   * welche es gibt, weiss dieses Programm nicht. Wer nichts eintraegt, gibt
   * trotzdem aus — der Eintrag steht dann im Register unter „nicht genannt",
   * sichtbar und nicht verschwiegen.
   */
  const [recipient, setRecipient] = useState('')

  // BEDARF 84 — woraus naechstes Jahr geplant wuerde. Steht GANZ OBEN in
  // diesem Dialog: hier wird die Uebergabe gebaut, und wer sie baut, muss
  // wissen, ob sie den Bauzustand oder das Angebot traegt.
  const job = useMemo(() => assessJobHandover(project), [project])

  const baseName = project.metadata.name || 'anlage'

  /**
   * Roadmap-Initiative 5 — hier wird ausgegeben, also hier wird protokolliert.
   *
   * Bewusst an DIESER Stelle und nicht in den sechs `build()`-Funktionen: sie
   * ist die einzige Engstelle, durch die alle sechs gehen. Ein Protokoll, das
   * an sechs Stellen geschrieben wird, hat spaetestens beim siebten Dokument
   * eine Luecke — und eine Luecke in einem Register sieht aus wie „nicht
   * ausgegeben".
   *
   * `suffix` IST der Dokument-Bezeichner: `documentRegistry` haelt in seinem
   * Docstring fest, dass der Schluessel derselbe ist, der im Dateinamen
   * steht. Der Guard in tests/documentLog.test.ts prueft das nach.
   */
  const save = (content: string, suffix: string, ext: string, mime: string) => {
    downloadBlob(buildExportFilenameWithSuffix(baseName, suffix, ext), content, mime)
    void recordEmission(project, suffix, filePath, recipient)
  }

  const exports: ExportRow[] = useMemo(
    () => [
      {
        key: 'pull',
        label: t('docs.pullList', 'Pull/run list'),
        hint: t('docs.pullList.hint', 'Per cable: from→to, length, pathway, status (CSV)'),
        build: () => ({
          content: pullListCsv(project, stampForRows(project, pullListTable, new Date())),
          suffix: 'pull-liste',
          ext: 'csv',
          mime: 'text/csv',
        }),
      },
      {
        key: 'term',
        label: t('docs.terminationList', 'Termination list'),
        hint: t('docs.terminationList.hint', 'Per cable end: device, port, connector (CSV)'),
        build: () => ({
          content: terminationListCsv(
            project,
            stampForRows(project, terminationListTable, new Date()),
          ),
          suffix: 'termination-liste',
          ext: 'csv',
          mime: 'text/csv',
        }),
      },
      {
        key: 'sched',
        label: t('docs.cableSchedule', 'Cable schedule (register)'),
        hint: t('docs.cableSchedule.hint', 'Master register of all cables (CSV)'),
        build: () => ({
          content: cableScheduleCsv(
            project,
            stampForRows(project, cableScheduleTable, new Date()),
          ),
          suffix: 'kabel-schedule',
          ext: 'csv',
          mime: 'text/csv',
        }),
      },
      {
        key: 'bom',
        label: t('docs.cableBom', 'Cable BOM + reserve'),
        hint: t('docs.cableBom.hint', 'Aggregated by type/length incl. reserve markup (CSV)'),
        build: () => ({
          content: cableBomCsv(
            project,
            reserve,
            stampForRows(project, (src) => cableBomTable(src, reserve), new Date()),
          ),
          suffix: 'kabel-bom',
          ext: 'csv',
          mime: 'text/csv',
        }),
      },
      {
        key: 'asset',
        label: t('docs.assetRegister', 'Asset register'),
        hint: t('docs.assetRegister.hint', 'Devices: asset tag, location, serial, warranty, service (CSV)'),
        build: () => ({
          content: assetRegisterCsv(
            project,
            stampForRows(project, assetRegisterTable, new Date()),
          ),
          suffix: 'asset-register',
          ext: 'csv',
          mime: 'text/csv',
        }),
      },
      {
        key: 'handover',
        label: t('docs.handover', 'Handover document'),
        hint: t('docs.handover.hint', 'Operator overview: scope, status, BOM, assets (Markdown)'),
        build: () => ({
          content: buildHandoverManifest(
            project,
            stampForRows(project, handoverTable, new Date()),
          ),
          suffix: 'uebergabe',
          ext: 'md',
          mime: 'text/markdown',
        }),
      },
    ],
    [project, reserve, t],
  )

  const onAssignIds = () => {
    const res = assignDocIds()
    setInfo(
      res.cables + res.equipment === 0
        ? t('docs.ids.none', 'All elements already have an ID.')
        : t('export.docs.idsAssigned', 'Assigned {cables} cable IDs, {equipment} device IDs.')
            .replace('{cables}', String(res.cables))
            .replace('{equipment}', String(res.equipment)),
    )
  }

  const onQrLabelsPdf = async () => {
    setBusy(true)
    setInfo('')
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = 210
      const pageH = 297
      const margin = 12
      const cellW = 63
      const cellH = 30
      const cols = 3
      const gapX = (pageW - 2 * margin - cols * cellW) / (cols - 1)
      let x = margin
      let y = margin
      const items: { id: string; label: string; sub: string; kind: 'cable' | 'equipment' }[] = []
      for (const c of project.cables) {
        const id = c.qrId || cableLabelId(c)
        items.push({ id, label: id, sub: c.name || c.type, kind: 'cable' })
      }
      for (const e of project.equipment) {
        const id = e.qrId || equipmentAssetTag(e)
        items.push({ id, label: id, sub: e.name, kind: 'equipment' })
      }
      if (items.length === 0) {
        setInfo(t('docs.qr.empty', 'No elements present.'))
        setBusy(false)
        return
      }
      let col = 0
      for (const it of items) {
        const dataUrl = await QRCode.toDataURL(qrPayload(it.kind, it.id, it.label), {
          margin: 0,
          width: 256,
        })
        doc.addImage(dataUrl, 'PNG', x, y, cellH - 8, cellH - 8)
        doc.setFontSize(9)
        doc.text(it.label, x + cellH - 4, y + 6)
        doc.setFontSize(7)
        doc.text(doc.splitTextToSize(it.sub, cellW - cellH).slice(0, 3), x + cellH - 4, y + 11)
        col += 1
        if (col >= cols) {
          col = 0
          x = margin
          y += cellH
          if (y + cellH > pageH - margin) {
            doc.addPage()
            y = margin
          }
        } else {
          x += cellW + gapX
        }
      }
      // jsPDF liefert einen binären Blob — direkt herunterladen (kein .text()).
      const blob = doc.output('blob')
      downloadBlob(
        buildExportFilenameWithSuffix(baseName, 'qr-etiketten', 'pdf'),
        blob,
        'application/pdf',
      )
      setInfo(t('export.docs.labelsCreated', 'Created {n} labels.').replace('{n}', String(items.length)))
    } catch (err) {
      setInfo(
        t('export.docs.error', 'Error: {msg}').replace(
          '{msg}',
          err instanceof Error ? err.message : String(err),
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  const changelog = useMemo(
    () => [...(project.changelog ?? [])].reverse().slice(0, 30),
    [project.changelog],
  )
  const pending = useMemo(
    () => [...(project.pendingChanges ?? [])].reverse(),
    [project.pendingChanges],
  )

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('docs.title', 'Fixed install — docs & handover')}
      titleIcon={<Icon icon={PackageCheck} size="md" />}
      maxWidth="3xl"
      draggableKey="cable-planner:modal-pos:install-docs"
    >
      <div className="space-y-4 text-cp-sm">
        {/* BEDARF 84 — die Grundlage. „Next year the same event is re-planned
            from the QUOTE, not from what was actually built." Der Zustand
            steht vor allem anderen, weil er über den Wert des ganzen Pakets
            entscheidet. */}
        <section
          className={`rounded border p-3 ${
            job.basis === 'as-built'
              ? 'border-cp-border bg-cp-surface-2/40'
              : 'border-amber-500/40 bg-amber-500/5'
          }`}
        >
          <div className="mb-1 flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-cp-text">
              {t('docs.job.title', 'Basis of this handover')}
            </span>
            <span
              className={
                job.basis === 'as-built' ? 'text-cp-text-secondary' : 'text-amber-300/90'
              }
            >
              {JOB_BASIS_LABEL[job.basis]}
              {job.asBuilt ? ` — ${job.asBuilt.label}` : ''}
            </span>
          </div>
          <PanelHint
            className="text-cp-xs text-cp-text-muted"
            text={t(
              'docs.job.intro',
              'Next year the same event will be planned from this file. If it carries the plan from before load-in, every on-site change gets rediscovered.',
            )}
          />
          {job.findings.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {job.findings.map((f) => (
                <li key={f.kind} className="text-cp-xs text-amber-300/90">
                  <strong>{JOB_FINDING_LABEL[f.kind]}</strong> — {f.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Bearbeiter-Identität */}
        <section className="rounded border border-cp-border bg-cp-surface-2/40 p-3">
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('docs.editor', 'Editor (author for changelog & service)')}
            </span>
            <input
              value={editorName}
              onChange={(e) => setEditorName(e.target.value)}
              placeholder={t('docs.editor.placeholder', 'e.g. Lars Z. / Company XY')}
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
            />
          </label>
        </section>

        {/* Listen / Exporte */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-cp-text-bright">
            <Icon icon={ClipboardList} size="sm" />
            {t('docs.exports', 'Lists & handover documents')}
          </h3>
          {/* BEDARF 11 — an wen. Steht bei den Ausgaben und nicht bei der
              Bearbeiter-Identitaet: das ist eine andere Frage. „Bearbeiter"
              sagt, wer den Plan gemacht hat; „Empfaenger" sagt, wer das Blatt
              in die Hand bekommt — und nur die zweite beantwortet spaeter
              „was hat sich seit DEINEM Ausdruck geaendert". */}
          <label className="mb-2 block text-cp-xs text-cp-text-secondary">
            <span className="mb-1 block">
              {t('docs.recipient', 'Recipient of this sheet (department or person)')}
            </span>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={t('docs.recipient.placeholder', 'e.g. Camera, Audio, Stage - leaving it empty is fine')}
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
            />
          </label>
          <label className="mb-2 flex items-center gap-2 text-cp-xs text-cp-text-secondary">
            {t('docs.reserve', 'Reserve markup for BOM (%)')}
            <input
              type="number"
              min={0}
              max={100}
              value={reserve}
              onChange={(e) => setReserve(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
              className="w-16 rounded border border-cp-border bg-cp-surface-1 p-1 text-right"
            />
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {exports.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => {
                  const r = row.build()
                  save(r.content, r.suffix, r.ext, r.mime)
                }}
                className="flex items-start gap-2 rounded border border-cp-border bg-cp-surface-1 p-2 text-left hover:bg-cp-surface-2"
              >
                <Icon icon={Download} size="sm" className="mt-0.5 shrink-0 text-cp-accent" />
                <span className="min-w-0">
                  <span className="block font-medium text-cp-text-bright">{row.label}</span>
                  <span className="block text-cp-xs text-cp-text-muted">{row.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* QR / Etiketten */}
        <section className="rounded border border-cp-border bg-cp-surface-2/40 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-cp-text-bright">
            <Icon icon={QrCode} size="sm" />
            {t('docs.qr', 'QR/asset IDs & labels')}
          </h3>
          <p className="mb-2 text-cp-xs text-cp-text-muted">
            {t(
              'docs.qr.hint',
              'Assigns short, stable IDs to cables/devices without one and prints QR labels linking the physical label to the record.',
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAssignIds}
              className="inline-flex items-center gap-1.5 rounded bg-cp-surface-4 px-3 py-1.5 hover:bg-cp-surface-5"
            >
              <Icon icon={Tag} size="sm" /> {t('docs.qr.assign', 'Assign QR/asset IDs')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onQrLabelsPdf}
              className="inline-flex items-center gap-1.5 rounded bg-cp-surface-4 px-3 py-1.5 hover:bg-cp-surface-5 disabled:opacity-50"
            >
              <Icon icon={QrCode} size="sm" /> {t('docs.qr.pdf', 'QR labels (PDF)')}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-cp-border pt-2">
            <button
              type="button"
              onClick={() => {
                const n = applySourceDestLabels({ overwrite: overwriteLabels })
                setInfo(
                  n === 0
                    ? t('docs.label.none', 'No labels changed (all named — enable "overwrite" if needed).')
                    : t('export.docs.labelsFromSourceDest', 'Created {n} cable labels from source→destination.').replace('{n}', String(n)),
                )
              }}
              className="inline-flex items-center gap-1.5 rounded bg-cp-surface-4 px-3 py-1.5 hover:bg-cp-surface-5"
            >
              <Icon icon={Tag} size="sm" />{' '}
              {t('docs.label.sourceDest', 'Cable labels "source → destination" (AVIXA F501.01)')}
            </button>
            <label className="flex items-center gap-1.5 text-cp-xs text-cp-text-secondary">
              <input
                type="checkbox"
                checked={overwriteLabels}
                onChange={(e) => setOverwriteLabels(e.target.checked)}
              />
              {t('docs.label.overwrite', 'overwrite existing names')}
            </label>
          </div>
        </section>

        {info && (
          <p className="rounded bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text-secondary">{info}</p>
        )}

        {/* Feld-Rückkanal — vom Mobile-Companion gemeldete, noch offene Änderungen */}
        <section className="rounded border border-cp-border bg-cp-surface-2/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-cp-text-bright">
              <Icon icon={Inbox} size="sm" />
              {t('docs.pending', 'Field feedback')}{' '}
              <span className={pending.length > 0 ? 'text-cp-accent' : 'text-cp-text-muted'}>
                ({pending.length})
              </span>
            </h3>
          </div>
          {pending.length === 0 ? (
            <p className="text-cp-xs text-cp-text-muted">
              {t(
                'docs.pending.empty',
                'No open reports. Corrections/issues from the mobile companion arrive here to apply.',
              )}
            </p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto text-cp-xs">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-2 rounded border border-cp-border-muted bg-cp-surface-1 px-2 py-1.5"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-cp-surface-3 px-1.5 py-0.5 text-cp-xs uppercase text-cp-text-secondary">
                    {p.target?.type === 'cable'
                      ? t('docs.pending.cable', 'Cable')
                      : p.target?.type === 'equipment'
                        ? t('docs.pending.equipment', 'Device')
                        : t('docs.pending.note', 'Note')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-cp-text">{p.summary}</span>
                    <span className="text-cp-text-faint">
                      {p.target?.name ? `${p.target.name} · ` : ''}
                      {p.author} ·{' '}
                      {new Date(p.ts).toLocaleString('de-DE', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => applyPendingChange(p.id)}
                    title={t('docs.pending.apply', 'Apply (merges + logs)')}
                    className="shrink-0 rounded p-1 text-cp-accent hover:bg-cp-surface-2"
                  >
                    <Icon icon={Check} size="xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectPendingChange(p.id)}
                    title={t('docs.pending.reject', 'Discard')}
                    className="shrink-0 rounded p-1 text-cp-danger hover:bg-cp-surface-2"
                  >
                    <Icon icon={X} size="xs" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Änderungsprotokoll */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 font-semibold text-cp-text-bright">
              <Icon icon={History} size="sm" />
              {t('docs.changelog', 'Changelog')}{' '}
              <span className="text-cp-text-muted">({(project.changelog ?? []).length})</span>
            </h3>
            {(project.changelog ?? []).length > 0 && (
              <button
                type="button"
                onClick={() => clearChangelog()}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-cp-xs text-cp-danger hover:bg-cp-surface-2"
              >
                <Icon icon={Trash2} size="xs" /> {t('docs.changelog.clear', 'Clear')}
              </button>
            )}
          </div>
          {changelog.length === 0 ? (
            <p className="text-cp-xs text-cp-text-muted">
              {t('docs.changelog.empty', 'No entries yet. Status/service changes are logged here.')}
            </p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-cp-xs">
              {changelog.map((e) => (
                <li key={e.id} className="flex gap-2 rounded bg-cp-surface-1 px-2 py-1">
                  <span className="shrink-0 font-mono text-cp-text-faint">
                    {new Date(e.ts).toLocaleString('de-DE', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  <span className="min-w-0 flex-1">{e.summary}</span>
                  <span className="shrink-0 text-cp-text-muted">{e.author}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ModalShell>
  )
}
