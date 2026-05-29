/**
 * Roadmap #76 follow-up — "Patchliste als eigene Ansicht".
 *
 * The Cable-BOM dialog already aggregates cables by (type, length). The
 * Patchliste differs: one row per physical cable showing the full
 * routing, sorted alphabetically by source device. Use case: hand the
 * field tech a printable list of every individual patch to make.
 */

import { useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { sanitizeForPdf } from '../../lib/sanitizeForPdf'
import { portLabelPair } from '../../lib/portLabel'
import { ModalShell } from '../shared/ModalShell'
import { useTranslation } from '../../lib/i18n'
import type { Cable } from '../../types/cable'
import type { EquipmentItem, Port } from '../../types/equipment'

type SortKey = 'number' | 'fromDevice' | 'toDevice' | 'type' | 'length' | 'color'

interface PatchRow {
  cableId: string
  /** Auto-Kabelnummer (leer wenn keine vergeben). */
  cableNumber: string
  fromDevice: string
  fromPort: string
  /** #286 — Zweite Zeile unter dem Hauptport-Label. Gesetzt wenn ein
   *  contentLabel (z.B. "PGM") vom port.name (z.B. "1 SDI 3G PGM") ab-
   *  weicht, sodass beide Infos sichtbar bleiben. */
  fromPortSub?: string
  toDevice: string
  toPort: string
  toPortSub?: string
  type: string
  length: number
  color: string
  cableName: string
  notes: string
  layer: string
}

export const PatchListDialog = () => {
  const t = useTranslation()
  const open = useUiStore((s) => s.patchList.open)
  const close = useUiStore((s) => s.closePatchList)
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const projectName = useProjectStore((s) => s.project.metadata.name)
  const [filter, setFilter] = useState('')
  const [layerFilter, setLayerFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('fromDevice')

  const rows = useMemo<PatchRow[]>(() => {
    if (!open) return []
    const eqById = new Map(equipment.map((e) => [e.id, e]))
    // #285 — Output-Index: pro Quellgerät die abgehenden Kabel. Wird fuer
    // die Wandler-Verfolgung gebraucht ("einziges Folge-Kabel?").
    const cablesFromEq = new Map<string, Cable[]>()
    for (const c of cables) {
      const arr = cablesFromEq.get(c.fromEquipmentId) ?? []
      arr.push(c)
      cablesFromEq.set(c.fromEquipmentId, arr)
    }

    // #285 — Wandler-Verfolgung: wenn das Ziel-Gerät als Konverter
    // markiert ist UND genau ein Output-Kabel hat, folge dem rekursiv
    // bis ein nicht-Wandler-Gerät erreicht ist. Liefert das Endziel +
    // die Liste der Bridge-Gerätenamen ("via X → Y").
    const resolveThroughConverter = (
      startEqId: string,
      startPortId: string,
    ): {
      finalEq?: EquipmentItem
      finalPort?: Port
      bridgeNames: string[]
    } => {
      let currentEq = eqById.get(startEqId)
      let currentPortId = startPortId
      const bridges: string[] = []
      const visited = new Set<string>()
      // Maximal 10 Hops um pathologische Konfigurationen zu cappen.
      for (let depth = 0; depth < 10; depth++) {
        if (!currentEq || !currentEq.isConverter) break
        if (visited.has(currentEq.id)) break
        visited.add(currentEq.id)
        const outs = cablesFromEq.get(currentEq.id) ?? []
        if (outs.length !== 1) {
          // Mehrdeutig oder kein Folge-Kabel — keine Auto-Verfolgung,
          // Wandler wird selber als Ziel angezeigt.
          break
        }
        bridges.push(currentEq.name)
        const nextCable = outs[0]
        currentEq = eqById.get(nextCable.toEquipmentId)
        currentPortId = nextCable.toPortId
      }
      const finalPort = currentEq
        ? currentEq.inputs.find((p) => p.id === currentPortId) ??
          currentEq.outputs.find((p) => p.id === currentPortId)
        : undefined
      return { finalEq: currentEq, finalPort, bridgeNames: bridges }
    }

    // #285 — Output-Kabel die zu einer Wandler-Folge-Kette gehoeren in
    // der Patchliste skippen — sonst wuerde der gleiche End-Patch zweimal
    // erscheinen (einmal als Wandler-Eingang mit Pass-Through, einmal als
    // separates Output-Kabel des Wandlers).
    const consumedAsFollow = new Set<string>()
    for (const c of cables) {
      const target = eqById.get(c.toEquipmentId)
      if (!target?.isConverter) continue
      const outs = cablesFromEq.get(target.id) ?? []
      if (outs.length !== 1) continue
      let chain: Cable | undefined = outs[0]
      const visited = new Set<string>([target.id])
      while (chain) {
        consumedAsFollow.add(chain.id)
        const nextTarget = eqById.get(chain.toEquipmentId)
        if (!nextTarget?.isConverter || visited.has(nextTarget.id)) break
        const nextOuts = cablesFromEq.get(nextTarget.id) ?? []
        if (nextOuts.length !== 1) break
        visited.add(nextTarget.id)
        chain = nextOuts[0]
      }
    }

    const list = cables
      .filter((c) => !consumedAsFollow.has(c.id))
      .map<PatchRow>((c) => {
      const from = eqById.get(c.fromEquipmentId)
      const to = eqById.get(c.toEquipmentId)
      const fromPort =
        from?.outputs.find((p) => p.id === c.fromPortId) ??
        from?.inputs.find((p) => p.id === c.fromPortId)
      // #285 — Wenn Ziel ein Wandler ist, das End-Geraet verfolgen.
      let finalToEq: EquipmentItem | undefined = to
      let finalToPort: Port | undefined =
        to?.inputs.find((p) => p.id === c.toPortId) ??
        to?.outputs.find((p) => p.id === c.toPortId)
      let bridgeNames: string[] = []
      if (to?.isConverter) {
        const resolved = resolveThroughConverter(to.id, c.toPortId)
        // Nur uebernehmen wenn wir tatsaechlich an einem Nicht-Wandler-
        // Gerät angekommen sind (sonst hat resolveThroughConverter den
        // Wandler selber zurueckgegeben → kein Vorteil gegenueber default).
        if (
          resolved.finalEq &&
          resolved.finalEq.id !== to.id &&
          !resolved.finalEq.isConverter
        ) {
          finalToEq = resolved.finalEq
          finalToPort = resolved.finalPort
          bridgeNames = resolved.bridgeNames
        }
      }
      // #286 — contentLabel/port.name kombinieren: wenn beide gesetzt und
      // unterschiedlich, dann main=contentLabel + sub=port.name.
      const fromPair = fromPort ? portLabelPair(fromPort) : { main: c.fromPortId }
      const toPair = finalToPort ? portLabelPair(finalToPort) : { main: c.toPortId }
      const toDeviceLabel =
        bridgeNames.length > 0
          ? `${finalToEq?.name ?? '?'}  ⟵ via ${bridgeNames.join(' → ')}`
          : finalToEq?.name ?? '?'
      return {
        cableId: c.id,
        cableNumber: c.cableNumber ?? '',
        fromDevice: from?.name ?? '?',
        fromPort: fromPair.main,
        fromPortSub: fromPair.subline,
        toDevice: toDeviceLabel,
        toPort: toPair.main,
        toPortSub: toPair.subline,
        type: c.type,
        length: c.length,
        color: c.color || '#64748b',
        cableName: c.name,
        notes: c.notes ?? '',
        layer: c.layer ?? '',
      }
    })
    const cmp = (a: PatchRow, b: PatchRow): number => {
      switch (sortKey) {
        case 'number':
          return a.cableNumber.localeCompare(b.cableNumber, undefined, { numeric: true })
        case 'fromDevice':
          return a.fromDevice.localeCompare(b.fromDevice) || a.fromPort.localeCompare(b.fromPort)
        case 'toDevice':
          return a.toDevice.localeCompare(b.toDevice) || a.toPort.localeCompare(b.toPort)
        case 'type':
          return a.type.localeCompare(b.type) || a.length - b.length
        case 'length':
          return a.length - b.length
        case 'color':
          return a.color.localeCompare(b.color)
      }
    }
    return list.sort(cmp)
  }, [cables, equipment, open, sortKey])

  // #353 — vorhandene Cable-Layer (z.B. audio/video/network) für den Filter.
  const layers = useMemo(() => [...new Set(rows.map((r) => r.layer).filter(Boolean))].sort(), [rows])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return rows.filter((r) => {
      if (layerFilter && r.layer !== layerFilter) return false
      if (!q) return true
      return [
        r.fromDevice,
        r.fromPort,
        r.fromPortSub ?? '',
        r.toDevice,
        r.toPort,
        r.toPortSub ?? '',
        r.type,
        r.cableName,
        r.notes,
      ].some((v) => v.toLowerCase().includes(q))
    })
  }, [rows, filter, layerFilter])


  if (!open) return null

  const buildExportRows = () => {
    // #286 — Wenn ein Port einen contentLabel hat, kombinieren wir die
    // Anzeige als "PGM (1 SDI 3G PGM)" in der einzigen Spalte. Die Tabelle
    // hat dafuer eine zweite Zeile, der Export muss alles in einer Zelle
    // bundlen.
    const fmtPort = (main: string, sub?: string) => (sub ? `${main} (${sub})` : main)
    const header = [
      t('patchList.col.fromDevice', 'Von Gerät'),
      t('patchList.col.fromPort', 'Von Port'),
      t('patchList.col.toDevice', 'Nach Gerät'),
      t('patchList.col.toPort', 'Nach Port'),
      t('export.bom.csv.type', 'Typ'),
      t('export.bom.csv.lengthM', 'Länge (m)'),
      t('patchList.col.color', 'Farbe'),
      t('patchList.col.cableName', 'Kabelname'),
      t('patchList.col.notes', 'Notizen'),
    ]
    const data = filtered.map((r) => [
      r.fromDevice,
      fmtPort(r.fromPort, r.fromPortSub),
      r.toDevice,
      fmtPort(r.toPort, r.toPortSub),
      r.type,
      r.length,
      r.color,
      r.cableName,
      r.notes,
    ])
    return { header, data }
  }

  const exportXlsx = async () => {
    const { header, data } = buildExportRows()
    // Lazy-load XLSX — keep ~500 KB out of the main bundle.
    const XLSX = await import('xlsx-js-style')
    const sheet = XLSX.utils.aoa_to_sheet([header, ...data])
    // Bold header row.
    for (let c = 0; c < header.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c })
      const cell = sheet[addr]
      if (cell) cell.s = { font: { bold: true } }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'Patchliste')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    downloadBlob(
      buildExportFilenameWithSuffix(projectName || 'cable-planner', 'patchliste', 'xlsx'),
      buf,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  }

  // #349 — Kabel-Etiketten als druckbarer A4-Bogen (2 Spalten). Pro Kabel
  // zwei Labels (beide Enden), jeweils mit Ziel-/Quell-Richtung, Typ, Länge
  // und Farb-Swatch. Nutzt die aktuell gefilterten Zeilen.
  const exportLabels = () => {
    const hexToRgb = (hex: string): [number, number, number] => {
      const h = (hex || '#888888').replace('#', '')
      const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '8')
      return [parseInt(n.slice(0, 2), 16) || 136, parseInt(n.slice(2, 4), 16) || 136, parseInt(n.slice(4, 6), 16) || 136]
    }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = 210, pageH = 297, cols = 2, rowsPerPage = 9, mL = 8, mT = 10, gap = 3
    const lw = (pageW - 2 * mL - (cols - 1) * gap) / cols
    const lh = (pageH - 2 * mT - (rowsPerPage - 1) * gap) / rowsPerPage
    const labels = filtered.flatMap((r) => {
      const title = `${r.type}${r.cableName && r.cableName !== r.type ? ' · ' + r.cableName : ''}`
      const meta = r.length ? `${r.length} m` : ''
      return [
        { title, dest: `${r.fromDevice} · ${r.fromPort}  →  ${r.toDevice} · ${r.toPort}`, meta, color: r.color },
        { title, dest: `${r.toDevice} · ${r.toPort}  →  ${r.fromDevice} · ${r.fromPort}`, meta, color: r.color },
      ]
    })
    const perPage = cols * rowsPerPage
    labels.forEach((lbl, i) => {
      const idx = i % perPage
      if (i > 0 && idx === 0) doc.addPage()
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const x = mL + col * (lw + gap)
      const y = mT + row * (lh + gap)
      doc.setDrawColor(190)
      doc.roundedRect(x, y, lw, lh, 1.5, 1.5)
      const [cr, cg, cb] = hexToRgb(lbl.color)
      doc.setFillColor(cr, cg, cb)
      doc.rect(x + 1.5, y + 1.5, 3, lh - 3, 'F')
      doc.setTextColor(20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(sanitizeForPdf(lbl.title).slice(0, 42), x + 7, y + 7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(sanitizeForPdf(lbl.dest).slice(0, 64), x + 7, y + 14)
      doc.setTextColor(110)
      doc.setFontSize(7)
      doc.text(lbl.meta, x + 7, y + lh - 3)
    })
    downloadBlob(
      buildExportFilenameWithSuffix(projectName || 'cable-planner', 'etiketten', 'pdf'),
      doc.output('blob'),
      'application/pdf',
    )
  }

  const exportCsv = () => {
    const { header, data } = buildExportRows()
    const escape = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`
    const lines = [
      header.join(';'),
      ...data.map((row) => row.map(escape).join(';')),
    ]
    downloadBlob(
      // v7.9.116 — Einheitlicher Stempel.
      buildExportFilenameWithSuffix(projectName || 'cable-planner', 'patchliste', 'csv'),
      '﻿' + lines.join('\r\n'),
      'text/csv;charset=utf-8',
    )
  }

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('patchList.title', 'Patchliste')}
      titleIcon="🪢"
      maxWidth="5xl"
      draggableKey="cable-planner:modal-pos:patchlist"
      scrollBody={false}
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400">
            {t(
              'patchList.footerHint',
              'Jedes Kabel als eigene Zeile, sortiert für die Patch-Reihenfolge auf dem Set. CSV-Export für Excel/Druck enthält die aktuell gefilterten Zeilen.',
            )}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
              className="rounded bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600 disabled:opacity-40"
            >
              {t('patchList.exportCsv', '⬇ CSV exportieren')}
            </button>
            <button
              type="button"
              onClick={() => void exportXlsx()}
              disabled={filtered.length === 0}
              className="rounded bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600 disabled:opacity-40"
            >
              {t('patchList.exportXlsx', '⬇ XLSX exportieren')}
            </button>
            <button
              type="button"
              onClick={exportLabels}
              disabled={filtered.length === 0}
              className="rounded bg-sky-700 px-3 py-1 text-xs hover:bg-sky-600 disabled:opacity-40"
            >
              {t('patchList.exportLabels', '🏷 Etiketten (PDF)')}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-slate-800 py-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('patchList.searchPlaceholder', 'Suchen (Gerät, Port, Typ, Farbe, Notiz …)')}
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
          {layers.length > 0 && (
            <select
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value)}
              title={t('patchList.layerFilter', 'Nach Layer/Gewerk filtern')}
              className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            >
              <option value="">{t('patchList.allLayers', 'Alle Layer')}</option>
              {layers.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <span className="text-[11px] text-slate-400">
            {filtered.length} / {rows.length}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950 text-slate-400">
              <tr>
                {[
                  { k: 'number' as const, label: t('patchList.col.number', 'Nr.') },
                  { k: 'fromDevice' as const, label: t('patchList.col.fromDevice', 'Von Gerät') },
                  { k: 'fromDevice' as const, label: t('patchList.col.port', 'Port') },
                  { k: 'toDevice' as const, label: t('patchList.col.toDevice', 'Nach Gerät') },
                  { k: 'toDevice' as const, label: t('patchList.col.port', 'Port') },
                  { k: 'type' as const, label: t('export.bom.csv.type', 'Typ') },
                  { k: 'length' as const, label: t('export.bom.csv.lengthM', 'Länge (m)') },
                  { k: 'color' as const, label: t('patchList.col.color', 'Farbe') },
                ].map((col, i) => (
                  <th
                    key={`${col.k}-${i}`}
                    className="cursor-pointer px-2 py-1 text-left hover:text-slate-200"
                    onClick={() => setSortKey(col.k)}
                  >
                    {col.label}
                    {sortKey === col.k && <span className="ml-1 text-[9px]">▲</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.cableId} className="border-t border-slate-800 hover:bg-slate-900">
                  <td className="px-2 py-1 font-mono text-[11px] text-sky-300">{r.cableNumber}</td>
                  <td className="px-2 py-1 font-medium text-slate-100">{r.fromDevice}</td>
                  <td className="px-2 py-1 text-slate-300">
                    {r.fromPort}
                    {r.fromPortSub && (
                      <div className="text-[10px] text-slate-500">{r.fromPortSub}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 font-medium text-slate-100">{r.toDevice}</td>
                  <td className="px-2 py-1 text-slate-300">
                    {r.toPort}
                    {r.toPortSub && (
                      <div className="text-[10px] text-slate-500">{r.toPortSub}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-slate-300">{r.type}</td>
                  <td className="px-2 py-1 text-right text-slate-300">{r.length}</td>
                  <td className="px-2 py-1">
                    <span
                      className="inline-block h-3 w-8 rounded"
                      style={{ background: r.color }}
                      title={r.color}
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-2 py-6 text-center text-[11px] text-slate-500"
                  >
                    Keine Kabel passen zum Filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ModalShell>
  )
}
