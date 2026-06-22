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
  terminationListCsv,
  cableScheduleCsv,
  cableBomCsv,
} from '../../lib/installerLists'
import { assetRegisterCsv } from '../../lib/assetRegister'
import { buildHandoverManifest } from '../../lib/handoverPackage'
import { cableLabelId, equipmentAssetTag, qrPayload } from '../../lib/docIds'

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

  const baseName = project.metadata.name || 'anlage'

  const save = (content: string, suffix: string, ext: string, mime: string) => {
    downloadBlob(buildExportFilenameWithSuffix(baseName, suffix, ext), content, mime)
  }

  const exports: ExportRow[] = useMemo(
    () => [
      {
        key: 'pull',
        label: t('docs.pullList', 'Pull-/Verlege-Liste'),
        hint: t('docs.pullList.hint', 'Je Kabel: Von→Nach, Länge, Trasse, Status (CSV)'),
        build: () => ({ content: pullListCsv(project), suffix: 'pull-liste', ext: 'csv', mime: 'text/csv' }),
      },
      {
        key: 'term',
        label: t('docs.terminationList', 'Termination-Liste'),
        hint: t('docs.terminationList.hint', 'Je Kabelende: Gerät, Port, Steckverbinder (CSV)'),
        build: () => ({ content: terminationListCsv(project), suffix: 'termination-liste', ext: 'csv', mime: 'text/csv' }),
      },
      {
        key: 'sched',
        label: t('docs.cableSchedule', 'Kabel-Schedule (Register)'),
        hint: t('docs.cableSchedule.hint', 'Master-Register aller Kabel (CSV)'),
        build: () => ({ content: cableScheduleCsv(project), suffix: 'kabel-schedule', ext: 'csv', mime: 'text/csv' }),
      },
      {
        key: 'bom',
        label: t('docs.cableBom', 'Kabel-Stückliste + Reserve'),
        hint: t('docs.cableBom.hint', 'Aggregiert nach Typ/Länge inkl. Reserve-Aufschlag (CSV)'),
        build: () => ({ content: cableBomCsv(project, reserve), suffix: 'kabel-bom', ext: 'csv', mime: 'text/csv' }),
      },
      {
        key: 'asset',
        label: t('docs.assetRegister', 'Asset-Register'),
        hint: t('docs.assetRegister.hint', 'Geräte: Asset-Tag, Standort, Serie, Garantie, Service (CSV)'),
        build: () => ({ content: assetRegisterCsv(project), suffix: 'asset-register', ext: 'csv', mime: 'text/csv' }),
      },
      {
        key: 'handover',
        label: t('docs.handover', 'Übergabe-Dokument'),
        hint: t('docs.handover.hint', 'Betreiber-Übersicht: Umfang, Status, BOM, Assets (Markdown)'),
        build: () => ({ content: buildHandoverManifest(project), suffix: 'uebergabe', ext: 'md', mime: 'text/markdown' }),
      },
    ],
    [project, reserve, t],
  )

  const onAssignIds = () => {
    const res = assignDocIds()
    setInfo(
      res.cables + res.equipment === 0
        ? t('docs.ids.none', 'Alle Elemente haben bereits eine ID.')
        : t('export.docs.idsAssigned', '{cables} Kabel-IDs, {equipment} Geräte-IDs vergeben.')
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
        setInfo(t('docs.qr.empty', 'Keine Elemente vorhanden.'))
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
      setInfo(t('export.docs.labelsCreated', '{n} Etiketten erzeugt.').replace('{n}', String(items.length)))
    } catch (err) {
      setInfo(
        t('export.docs.error', 'Fehler: {msg}').replace(
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
      title={t('docs.title', 'Festinstallation — Doku & Übergabe')}
      titleIcon={<Icon icon={PackageCheck} size="md" />}
      maxWidth="3xl"
      draggableKey="cable-planner:modal-pos:install-docs"
    >
      <div className="space-y-4 text-cp-sm">
        {/* Bearbeiter-Identität */}
        <section className="rounded border border-cp-border bg-cp-surface-2/40 p-3">
          <label className="block">
            <span className="mb-1 block text-cp-text-secondary">
              {t('docs.editor', 'Bearbeiter (Autor für Änderungsprotokoll & Service)')}
            </span>
            <input
              value={editorName}
              onChange={(e) => setEditorName(e.target.value)}
              placeholder={t('docs.editor.placeholder', 'z. B. Lars Z. / Firma XY')}
              className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
            />
          </label>
        </section>

        {/* Listen / Exporte */}
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-semibold text-cp-text-bright">
            <Icon icon={ClipboardList} size="sm" />
            {t('docs.exports', 'Listen & Übergabe-Dokumente')}
          </h3>
          <label className="mb-2 flex items-center gap-2 text-cp-xs text-cp-text-secondary">
            {t('docs.reserve', 'Reserve-Aufschlag für Stückliste (%)')}
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
            {t('docs.qr', 'QR-/Asset-IDs & Etiketten')}
          </h3>
          <p className="mb-2 text-cp-xs text-cp-text-muted">
            {t(
              'docs.qr.hint',
              'Vergibt kurzen, stabilen IDs an Kabel/Geräte ohne ID und druckt QR-Etiketten, die das physische Label mit dem Datensatz verknüpfen.',
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAssignIds}
              className="inline-flex items-center gap-1.5 rounded bg-cp-surface-4 px-3 py-1.5 hover:bg-cp-surface-5"
            >
              <Icon icon={Tag} size="sm" /> {t('docs.qr.assign', 'QR-/Asset-IDs vergeben')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onQrLabelsPdf}
              className="inline-flex items-center gap-1.5 rounded bg-cp-surface-4 px-3 py-1.5 hover:bg-cp-surface-5 disabled:opacity-50"
            >
              <Icon icon={QrCode} size="sm" /> {t('docs.qr.pdf', 'QR-Etiketten (PDF)')}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-cp-border pt-2">
            <button
              type="button"
              onClick={() => {
                const n = applySourceDestLabels({ overwrite: overwriteLabels })
                setInfo(
                  n === 0
                    ? t('docs.label.none', 'Keine Labels geändert (alle benannt — ggf. „überschreiben" aktivieren).')
                    : t('export.docs.labelsFromSourceDest', '{n} Kabel-Labels aus Quelle→Ziel erzeugt.').replace('{n}', String(n)),
                )
              }}
              className="inline-flex items-center gap-1.5 rounded bg-cp-surface-4 px-3 py-1.5 hover:bg-cp-surface-5"
            >
              <Icon icon={Tag} size="sm" />{' '}
              {t('docs.label.sourceDest', 'Kabel-Labels „Quelle → Ziel" (AVIXA F501.01)')}
            </button>
            <label className="flex items-center gap-1.5 text-cp-xs text-cp-text-secondary">
              <input
                type="checkbox"
                checked={overwriteLabels}
                onChange={(e) => setOverwriteLabels(e.target.checked)}
              />
              {t('docs.label.overwrite', 'vorhandene Namen überschreiben')}
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
              {t('docs.pending', 'Feld-Rückmeldungen')}{' '}
              <span className={pending.length > 0 ? 'text-cp-accent' : 'text-cp-text-muted'}>
                ({pending.length})
              </span>
            </h3>
          </div>
          {pending.length === 0 ? (
            <p className="text-cp-xs text-cp-text-muted">
              {t(
                'docs.pending.empty',
                'Keine offenen Meldungen. Korrekturen/Probleme aus dem Mobile-Companion landen hier zum Übernehmen.',
              )}
            </p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto text-cp-xs">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-2 rounded border border-cp-border-muted bg-cp-surface-1 px-2 py-1.5"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-cp-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-cp-text-secondary">
                    {p.target?.type === 'cable'
                      ? t('docs.pending.cable', 'Kabel')
                      : p.target?.type === 'equipment'
                        ? t('docs.pending.equipment', 'Gerät')
                        : t('docs.pending.note', 'Notiz')}
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
                    title={t('docs.pending.apply', 'Übernehmen (mergt + protokolliert)')}
                    className="shrink-0 rounded p-1 text-cp-accent hover:bg-cp-surface-2"
                  >
                    <Icon icon={Check} size="xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectPendingChange(p.id)}
                    title={t('docs.pending.reject', 'Verwerfen')}
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
              {t('docs.changelog', 'Änderungsprotokoll')}{' '}
              <span className="text-cp-text-muted">({(project.changelog ?? []).length})</span>
            </h3>
            {(project.changelog ?? []).length > 0 && (
              <button
                type="button"
                onClick={() => clearChangelog()}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-cp-xs text-cp-danger hover:bg-cp-surface-2"
              >
                <Icon icon={Trash2} size="xs" /> {t('docs.changelog.clear', 'Leeren')}
              </button>
            )}
          </div>
          {changelog.length === 0 ? (
            <p className="text-cp-xs text-cp-text-muted">
              {t('docs.changelog.empty', 'Noch keine Einträge. Status-/Service-Änderungen werden hier protokolliert.')}
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
