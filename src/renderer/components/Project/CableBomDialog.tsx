import { useMemo, useState } from 'react'
import { Package, AlertTriangle, Check } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { ModalShell } from '../shared/ModalShell'
import jsPDF from 'jspdf'
import { sanitizeForPdf } from '../../lib/sanitizeForPdf'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import type { Cable } from '../../types/cable'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import {
  formatDeviceAtLocation,
  locationNameForEquipment,
} from '../../lib/equipmentLocation'
import { format, useTranslation } from '../../lib/i18n'

export interface CableBomDialogProps {
  open: boolean
  onClose: () => void
}

interface BomRow {
  key: string
  type: string
  length: number
  built: number
  planned: number
  diff: number
  sample?: Cable
  /** v7.9.117 — Verknuepfter Rentman-Equipment-Name (falls verknuepft).
   *  Macht den Abgleich gegen Rentman sauber, weil Rentman Kabel oft
   *  unter ganz anderem Namen fuehrt als der Cable-Planner-Type. */
  rentmanName?: string
  rentmanId?: string
  /** #292 — Sample-Pfade dieses Buckets ("Cam1@Bühne → Mischer@FOH").
   *  Bis zu 3 sichtbar in der Spalte, der Rest als Tooltip. */
  paths: string[]
}

const keyOf = (c: Pick<Cable, 'type' | 'length'>): string => `${c.type}|${c.length}`

const parseKey = (key: string): { type: string; length: number } => {
  const [type, lenStr] = key.split('|')
  return { type, length: Number(lenStr) || 0 }
}

const fmtSignFixed = (n: number): string => (n > 0 ? `+${n}` : String(n))

/**
 * Dialog listing all built cables grouped by (type, length) alongside the
 * quantity planned in Rentman. The planned column is editable so users can
 * keep the list in sync manually even without a live Rentman link.
 */
export const CableBomDialog = ({ open, onClose }: CableBomDialogProps) => {
  const t = useTranslation()
  const project = useProjectStore((s) => s.project)
  const customLibrary = useProjectStore((s) => s.customLibrary)
  const updateMeta = useProjectStore((s) => s.updateProjectMetadata)
  // #252 — Rentman-Cable-Export aus dem BOM heraus oeffnen.
  const openRentmanCableExport = useUiStore((s) => s.openRentmanCableExport)
  const [draftPlan, setDraftPlan] = useState<Record<string, number> | null>(null)

  const rows: BomRow[] = useMemo(() => {
    if (!open) return []
    // #292 — Pro Bucket sammeln wir alle Kabel statt nur eines Samples
    // damit wir die Wege-Spalte ("Cam1@Bühne → Mischer@FOH") fuellen
    // koennen. Equipment + Location bleiben in Maps fuer O(1)-Lookups.
    const eqById = new Map(project.equipment.map((e) => [e.id, e]))
    const locations = project.locations ?? []
    const formatEndpoint = (eqId: string): string => {
      const eq = eqById.get(eqId)
      const locName = eq ? locationNameForEquipment(eq, locations) : undefined
      return formatDeviceAtLocation(eq?.name, locName)
    }
    const built = new Map<string, { count: number; sample: Cable; cables: Cable[] }>()
    // #363 — Multicore / Snake: alle Adern mit gleichem `multicoreName` sind
    // EIN physisches Kabel und zaehlen in der BOM als 1 (nicht als N Einzel-
    // kabel). Adern ohne multicoreName laufen unveraendert in die Typ|Laenge-
    // Gruppierung.
    const bundles = new Map<string, Cable[]>()
    for (const c of project.cables) {
      if (c.multicoreName) {
        const arr = bundles.get(c.multicoreName) ?? []
        arr.push(c)
        bundles.set(c.multicoreName, arr)
        continue
      }
      const k = c.isTieLine ? `${c.type} (Tie-Line)|${c.length}` : keyOf(c)
      const entry = built.get(k)
      if (entry) {
        entry.count += 1
        entry.cables.push(c)
      } else {
        built.set(k, { count: 1, sample: c, cables: [c] })
      }
    }
    for (const [name, strands] of bundles) {
      // Laenge = laengste Ader = physische Strecke des Strangs.
      const length = Math.max(0, ...strands.map((c) => c.length ?? 0))
      const safeName = name.replace(/\|/g, '/')
      const k = `Multicore: ${safeName} (${strands.length} Adern)|${length}`
      built.set(k, { count: 1, sample: strands[0], cables: strands })
    }
    const planned = draftPlan ?? project.metadata.rentmanCablePlan ?? {}
    const cableMap = project.metadata.rentmanCableMap ?? {}
    // v7.9.117 — Rentman-Equipment per ID nachschlagen via customLibrary.
    // Library haelt rentmanId + name pro Template, das ist die direkte
    // Quelle ohne weitere API-Anfrage.
    const rentmanNameById = new Map<string, string>()
    for (const tpl of customLibrary) {
      if (tpl.rentmanId) rentmanNameById.set(String(tpl.rentmanId), tpl.name)
    }
    const keys = new Set<string>([...built.keys(), ...Object.keys(planned)])
    const list: BomRow[] = []
    for (const k of keys) {
      const bucket = built.get(k)
      const b = bucket?.count ?? 0
      const p = planned[k] ?? 0
      const parsed = parseKey(k)
      const mapping = cableMap[k]
      const rentmanId = mapping?.rentmanEquipmentId
      // #292 — Stabile, deduplizierte Pfad-Liste fuer diesen Bucket.
      const paths: string[] = bucket
        ? Array.from(
            new Set(
              bucket.cables.map(
                (c) => `${formatEndpoint(c.fromEquipmentId)} → ${formatEndpoint(c.toEquipmentId)}`,
              ),
            ),
          )
        : []
      list.push({
        key: k,
        type: parsed.type,
        length: parsed.length,
        built: b,
        planned: p,
        diff: b - p,
        sample: bucket?.sample,
        rentmanId,
        rentmanName: rentmanId ? rentmanNameById.get(String(rentmanId)) : undefined,
        paths,
      })
    }
    list.sort((a, b) =>
      a.type === b.type ? a.length - b.length : a.type.localeCompare(b.type),
    )
    return list
  }, [
    open,
    project.cables,
    project.equipment,
    project.locations,
    project.metadata.rentmanCablePlan,
    project.metadata.rentmanCableMap,
    customLibrary,
    draftPlan,
  ])

  if (!open) return null

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
    // #292 — Wege als zusaetzliche Spalte. "|" als interner Separator,
    // damit das ";"-Feld-Trennzeichen nicht greift.
    const lines = [
      [
        t('export.bom.csv.type', 'Typ'),
        t('export.bom.csv.rentmanName', 'Rentman-Name'),
        t('export.bom.csv.lengthM', 'Länge (m)'),
        t('export.bom.csv.built', 'Verbaut'),
        t('export.bom.csv.totalM', 'Gesamt (m)'),
        t('export.bom.csv.rentmanPlanned', 'Rentman geplant'),
        t('export.bom.csv.diff', 'Differenz'),
        t('export.bom.csv.paths', 'Wege'),
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
          `"${r.paths.join(' | ').replace(/"/g, '""')}"`,
        ].join(';'),
      )
    }
    // Schlusszeile: Gesamtlänge über alle Typen (Bestellmenge).
    lines.push(
      [
        t('bom.cable.total', 'Gesamt'),
        '',
        '',
        String(rows.reduce((s, r) => s + r.built, 0)),
        String(Number(rows.reduce((s, r) => s + r.built * r.length, 0).toFixed(1))),
        '',
        '',
        '',
      ].join(';'),
    )
    downloadBlob(
      // v7.9.116 — Einheitlicher Stempel: YYYYMMDD_<name>_NNN_kabel-bom.csv
      buildExportFilenameWithSuffix(project.metadata.name || 'cable-planner', 'kabel-bom', 'csv'),
      '\ufeff' + lines.join('\r\n'),
      'text/csv;charset=utf-8',
    )
  }

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 32
    pdf.setFontSize(14)
    pdf.setTextColor(15)
    pdf.text(sanitizeForPdf(t('export.bom.pdfHeading', 'Kabel-Stückliste')), margin, margin + 4)
    pdf.setFontSize(10)
    pdf.setTextColor(60)
    pdf.text(sanitizeForPdf(project.metadata.name || '-'), margin, margin + 22)
    pdf.setFontSize(8)
    pdf.text(sanitizeForPdf(new Date().toLocaleString()), pageWidth - margin, margin + 4, { align: 'right' })

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
      // v7.9.117 — Rentman-Name unter dem Typ damit die PDF den
      // Abgleich erlaubt. Zwei-Zeilen-Eintraege brauchen mehr Y-Vorschub.
      let nextY = y + 14
      if (r.rentmanName) {
        pdf.setFontSize(7)
        pdf.setTextColor(180, 90, 20)
        pdf.text(
          sanitizeForPdf(`R: ${r.rentmanName}`),
          colX[0] + 8,
          y + 9,
        )
        pdf.setFontSize(9)
        nextY = y + 22
      }
      pdf.setDrawColor(220)
      pdf.line(margin, nextY - 6, pageWidth - margin, nextY - 6)
      y = nextY
    }

    // v7.9.116 — Einheitlicher Stempel: YYYYMMDD_<name>_NNN_kabel-bom.pdf
    pdf.save(buildExportFilenameWithSuffix(project.metadata.name || 'cable-planner', 'kabel-bom', 'pdf'))
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('bom.cable.title', 'Kabel-Stückliste')}
      maxWidth="4xl"
      draggableKey="cable-planner:modal-pos:cable-bom"
      scrollBody={false}
      footer={
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-cp-text-muted">
            {draftPlan
              ? t('bom.cable.draftPending', 'Nicht gespeicherte Änderungen an der Rentman-Planung.')
              : t('bom.cable.draftSaved', 'Rentman-Planung wird im Projekt gespeichert.')}
          </span>
          <div className="flex gap-2">
            {draftPlan && (
              <button
                type="button"
                onClick={discardPlan}
                className="rounded bg-cp-surface-4 px-3 py-1 text-cp-xs hover:bg-cp-surface-5"
              >
                {t('bom.cable.discard', 'Verwerfen')}
              </button>
            )}
            <button
              type="button"
              onClick={savePlan}
              disabled={!draftPlan}
              className="rounded bg-emerald-700 px-3 py-1 text-cp-xs enabled:hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('bom.cable.savePlan', 'Rentman-Planung speichern')}
            </button>
            <button
              type="button"
              onClick={() => {
                if (draftPlan) {
                  updateMeta({ rentmanCablePlan: draftPlan })
                  setDraftPlan(null)
                }
                onClose()
                openRentmanCableExport()
              }}
              title={t('bom.cable.syncRentmanTitle', 'Schliesst diesen Dialog und oeffnet den Rentman-Cable-Export mit den aktuellen Buckets vorbefuellt.')}
              className="inline-flex items-center gap-1.5 rounded bg-orange-700 px-3 py-1 text-cp-xs font-semibold hover:bg-orange-600"
            >
              <Icon icon={Package} size="xs" />
              {t('bom.cable.syncRentman', 'Mit Rentman synchronisieren →')}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col -mx-4 -my-3">
        <div className="flex items-center gap-2 border-b border-cp-border-muted px-4 py-2 text-[11px] text-cp-text-muted">
          <span>{t('bom.cable.groupedNote', 'Gruppiert nach Typ & Länge.')}</span>
          <span>
            {t('bom.cable.builtCables', 'Verbaute Kabel:')} <b className="text-cp-text-bright">{project.cables.length}</b>
          </span>
          {rows.some((r) => r.diff < 0) && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-900/50 px-2 py-0.5 font-semibold text-red-300">
              <Icon icon={AlertTriangle} size="xs" />
              {format(t('bom.cable.missingTypes', '{count} Kabeltype(n) fehlen'), { count: rows.filter((r) => r.diff < 0).length })}
            </span>
          )}
          {rows.length > 0 && rows.every((r) => r.diff >= 0) && rows.some((r) => r.planned > 0) && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-emerald-900/50 px-2 py-0.5 font-semibold text-emerald-300">
              <Icon icon={Check} size="xs" />
              {t('bom.cable.allCovered', 'Alle geplanten Mengen abgedeckt')}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="rounded bg-cp-surface-4 px-2 py-1 text-cp-xs hover:bg-cp-surface-5"
            >
              {t('bom.cable.csv', 'CSV')}
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="rounded bg-amber-700 px-2 py-1 text-cp-xs hover:bg-amber-600"
            >
              {t('bom.cable.pdf', 'PDF')}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4">
          <table className="w-full text-cp-xs">
            <thead className="sticky top-0 bg-cp-surface-3 text-cp-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left">{t('bom.cable.col.type', 'Typ')}</th>
                <th className="px-3 py-2 text-right">{t('bom.cable.col.length', 'Länge (m)')}</th>
                <th className="px-3 py-2 text-right">{t('bom.cable.col.built', 'Verbaut')}</th>
                <th className="px-3 py-2 text-right">{t('bom.cable.col.totalM', 'Gesamt (m)')}</th>
                <th className="px-3 py-2 text-right">{t('bom.cable.col.planned', 'Rentman geplant')}</th>
                <th className="px-3 py-2 text-right">{t('bom.cable.col.diff', 'Differenz')}</th>
                {/* #292 — Pfade dieses Buckets (Cam1@Bühne → Mischer@FOH). */}
                <th className="px-3 py-2 text-left">{t('bom.cable.col.paths', 'Wege')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-cp-text-faint" colSpan={7}>
                    {t('bom.cable.noCables', 'Keine Kabel im Projekt.')}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.key} className={`border-t border-cp-border-muted ${r.diff < 0 ? 'bg-red-950/30' : ''}`}>
                  <td className="px-3 py-1 align-top">
                    <div className="font-medium text-cp-text">
                      {r.type}
                      {r.sample && (
                        <span className="ml-1 text-[10px] text-cp-text-muted">
                          ({r.sample.name})
                        </span>
                      )}
                    </div>
                    {/* v7.9.117 — Rentman-Name unter dem Typ. Macht den
                        Abgleich klar wenn Rentman das gleiche Kabel
                        unter anderem Namen fuehrt. */}
                    {r.rentmanName && (
                      <div className="mt-0.5 text-[10px] text-orange-300/80">
                        <span
                          className="rounded bg-orange-700/30 px-1 py-0 font-mono text-[11px] text-orange-200"
                          title={t('bom.cable.rentmanLinkedTitle', 'Verknuepfter Rentman-Equipment-Name')}
                        >
                          R
                        </span>{' '}
                        {r.rentmanName}
                      </div>
                    )}
                    {!r.rentmanName && r.rentmanId && (
                      <div
                        className="mt-0.5 text-[10px] text-cp-text-muted"
                        title={t('bom.cable.rentmanMissingTitle', 'Verknuepft, aber Rentman-Template lokal nicht gefunden')}
                      >
                        R #{r.rentmanId}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1 text-right align-top font-mono">{r.length}</td>
                  <td className="px-3 py-1 text-right align-top font-mono">{r.built}</td>
                  {/* Gesamtlänge dieses Bucket = Stückzahl × Einzellänge — fürs
                      Bestellen nach Meter. */}
                  <td className="px-3 py-1 text-right align-top font-mono text-cp-text-secondary">
                    {Number((r.built * r.length).toFixed(1))}
                  </td>
                  <td className="px-3 py-1 text-right align-top">
                    <input
                      type="number"
                      min={0}
                      value={r.planned}
                      onChange={(e) => setPlanned(r.key, Number(e.target.value))}
                      className="w-16 rounded border border-cp-border bg-cp-surface-3 px-1 py-0.5 text-right font-mono"
                    />
                  </td>
                  <td
                    className={`px-3 py-1 text-right align-top font-mono ${
                      r.diff === 0
                        ? 'text-emerald-400'
                        : r.diff > 0
                          ? 'text-amber-400'
                          : 'text-red-400'
                    }`}
                    title={
                      r.diff === 0
                        ? t('bom.cable.diff.zeroTitle', 'Verbaut = geplant')
                        : r.diff > 0
                          ? t('bom.cable.diff.posTitle', 'Mehr verbaut als geplant')
                          : t('bom.cable.diff.negTitle', 'Weniger verbaut als geplant')
                    }
                  >
                    {fmtSignFixed(r.diff)}
                  </td>
                  {/* #292 — Wege-Spalte: max 3 Pfade sichtbar, alle weiteren
                      als Tooltip ("+N weitere"). */}
                  <td className="px-3 py-1 align-top text-[11px] text-cp-text-secondary">
                    {r.paths.length === 0 ? (
                      <span className="text-cp-text-dim">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {r.paths.slice(0, 3).map((p, i) => (
                          <div key={i} className="font-mono text-[10px]">
                            {p}
                          </div>
                        ))}
                        {r.paths.length > 3 && (
                          <div
                            className="cursor-help text-[10px] text-cp-text-muted"
                            title={r.paths.slice(3).join('\n')}
                          >
                            {format(t('bom.cable.morePaths', '+{count} weitere'), { count: r.paths.length - 3 })}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="sticky bottom-0 bg-cp-surface-3">
                <tr className="border-t-2 border-cp-border font-semibold text-cp-text-bright">
                  <td className="px-3 py-2 text-left" colSpan={2}>
                    {t('bom.cable.total', 'Gesamt')}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {rows.reduce((s, r) => s + r.built, 0)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-300">
                    {Number(rows.reduce((s, r) => s + r.built * r.length, 0).toFixed(1))} m
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

      </div>
    </ModalShell>
  )
}
