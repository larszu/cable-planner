import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { useProjectStore } from '../../store/projectStore'
import type { Cable } from '../../types/cable'

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
  const project = useProjectStore((s) => s.project)
  const updateMeta = useProjectStore((s) => s.updateProjectMetadata)
  const [draftPlan, setDraftPlan] = useState<Record<string, number> | null>(null)

  const rows: BomRow[] = useMemo(() => {
    if (!open) return []
    const built = new Map<string, { count: number; sample: Cable }>()
    for (const c of project.cables) {
      const k = keyOf(c)
      const entry = built.get(k)
      if (entry) entry.count += 1
      else built.set(k, { count: 1, sample: c })
    }
    const planned = draftPlan ?? project.metadata.rentmanCablePlan ?? {}
    const keys = new Set<string>([...built.keys(), ...Object.keys(planned)])
    const list: BomRow[] = []
    for (const k of keys) {
      const b = built.get(k)?.count ?? 0
      const p = planned[k] ?? 0
      const parsed = parseKey(k)
      list.push({
        key: k,
        type: parsed.type,
        length: parsed.length,
        built: b,
        planned: p,
        diff: b - p,
        sample: built.get(k)?.sample,
      })
    }
    list.sort((a, b) =>
      a.type === b.type ? a.length - b.length : a.type.localeCompare(b.type),
    )
    return list
  }, [open, project.cables, project.metadata.rentmanCablePlan, draftPlan])

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
    const lines = [['Typ', 'Länge (m)', 'Verbaut', 'Rentman geplant', 'Differenz'].join(';')]
    for (const r of rows) {
      lines.push([r.type, String(r.length), String(r.built), String(r.planned), fmtSignFixed(r.diff)].join(';'))
    }
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(project.metadata.name || 'cable-planner').replace(/[^a-z0-9\-_. ]/gi, '_')}-kabel-bom.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const margin = 32
    pdf.setFontSize(14)
    pdf.setTextColor(15)
    pdf.text('Kabel-Stückliste', margin, margin + 4)
    pdf.setFontSize(10)
    pdf.setTextColor(60)
    pdf.text(project.metadata.name || '—', margin, margin + 22)
    pdf.setFontSize(8)
    pdf.text(new Date().toLocaleString(), pageWidth - margin, margin + 4, { align: 'right' })

    const colX = [margin, margin + 160, margin + 260, margin + 340, margin + 440]
    const headerY = margin + 46
    pdf.setFillColor(230, 230, 230)
    pdf.rect(margin, headerY - 10, pageWidth - margin * 2, 14, 'F')
    pdf.setTextColor(15)
    pdf.setFontSize(9)
    ;['Typ', 'Länge (m)', 'Verbaut', 'Rentman', 'Differenz'].forEach((h, i) => {
      pdf.text(h, colX[i] + 2, headerY)
    })

    let y = headerY + 14
    pdf.setFontSize(9)
    for (const r of rows) {
      if (y > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.setTextColor(15)
      pdf.text(r.type, colX[0] + 2, y)
      pdf.text(String(r.length), colX[1] + 2, y)
      pdf.text(String(r.built), colX[2] + 2, y)
      pdf.text(String(r.planned), colX[3] + 2, y)
      if (r.diff === 0) pdf.setTextColor(20, 120, 20)
      else if (r.diff > 0) pdf.setTextColor(180, 80, 20)
      else pdf.setTextColor(180, 20, 20)
      pdf.text(fmtSignFixed(r.diff), colX[4] + 2, y)
      pdf.setDrawColor(220)
      pdf.line(margin, y + 4, pageWidth - margin, y + 4)
      y += 14
    }

    pdf.save(`${(project.metadata.name || 'cable-planner').replace(/[^a-z0-9\-_. ]/gi, '_')}-kabel-bom.pdf`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-[820px] max-w-[95vw] flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
          <h2 className="text-sm font-semibold">Kabel-Stückliste</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
          >
            Schließen
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2 text-[11px] text-slate-400">
          <span>Gruppiert nach Typ & Länge.</span>
          <span>
            Verbaute Kabel: <b className="text-slate-200">{project.cables.length}</b>
          </span>
          {rows.some((r) => r.diff < 0) && (
            <span className="ml-2 rounded bg-red-900/50 px-2 py-0.5 font-semibold text-red-300">
              ⚠ {rows.filter((r) => r.diff < 0).length} Kabeltype(n) fehlen
            </span>
          )}
          {rows.length > 0 && rows.every((r) => r.diff >= 0) && rows.some((r) => r.planned > 0) && (
            <span className="ml-2 rounded bg-emerald-900/50 px-2 py-0.5 font-semibold text-emerald-300">
              ✓ Alle geplanten Mengen abgedeckt
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="rounded bg-slate-700 px-2 py-1 text-xs hover:bg-slate-600"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={exportPdf}
              className="rounded bg-amber-700 px-2 py-1 text-xs hover:bg-amber-600"
            >
              PDF
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950 text-slate-300">
              <tr>
                <th className="px-3 py-2 text-left">Typ</th>
                <th className="px-3 py-2 text-right">Länge (m)</th>
                <th className="px-3 py-2 text-right">Verbaut</th>
                <th className="px-3 py-2 text-right">Rentman geplant</th>
                <th className="px-3 py-2 text-right">Differenz</th>
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
                <tr key={r.key} className={`border-t border-slate-800 ${r.diff < 0 ? 'bg-red-950/30' : ''}`}>
                  <td className="px-3 py-1">
                    <span className="font-medium text-slate-100">{r.type}</span>
                    {r.sample && (
                      <span className="ml-1 text-[10px] text-slate-500">
                        ({r.sample.name})
                      </span>
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

        <div className="flex items-center justify-between border-t border-slate-700 px-4 py-2 text-[11px]">
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
      </div>
    </div>
  )
}
