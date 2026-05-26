/**
 * Roadmap #76 follow-up — "Patchliste als eigene Ansicht".
 *
 * The Cable-BOM dialog already aggregates cables by (type, length). The
 * Patchliste differs: one row per physical cable showing the full
 * routing, sorted alphabetically by source device. Use case: hand the
 * field tech a printable list of every individual patch to make.
 */

import { useMemo, useState } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { portLabelPair } from '../../lib/portLabel'
import { ModalShell } from '../shared/ModalShell'

type SortKey = 'fromDevice' | 'toDevice' | 'type' | 'length' | 'color'

interface PatchRow {
  cableId: string
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
}

export const PatchListDialog = () => {
  const open = useUiStore((s) => s.patchList.open)
  const close = useUiStore((s) => s.closePatchList)
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const projectName = useProjectStore((s) => s.project.metadata.name)
  const [filter, setFilter] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('fromDevice')

  const rows = useMemo<PatchRow[]>(() => {
    if (!open) return []
    const eqById = new Map(equipment.map((e) => [e.id, e]))
    const list = cables.map<PatchRow>((c) => {
      const from = eqById.get(c.fromEquipmentId)
      const to = eqById.get(c.toEquipmentId)
      const fromPort =
        from?.outputs.find((p) => p.id === c.fromPortId) ??
        from?.inputs.find((p) => p.id === c.fromPortId)
      const toPort =
        to?.inputs.find((p) => p.id === c.toPortId) ??
        to?.outputs.find((p) => p.id === c.toPortId)
      // #286 — contentLabel/port.name kombinieren: wenn beide gesetzt und
      // unterschiedlich, dann main=contentLabel + sub=port.name.
      const fromPair = fromPort ? portLabelPair(fromPort) : { main: c.fromPortId }
      const toPair = toPort ? portLabelPair(toPort) : { main: c.toPortId }
      return {
        cableId: c.id,
        fromDevice: from?.name ?? '?',
        fromPort: fromPair.main,
        fromPortSub: fromPair.subline,
        toDevice: to?.name ?? '?',
        toPort: toPair.main,
        toPortSub: toPair.subline,
        type: c.type,
        length: c.length,
        color: c.color || '#64748b',
        cableName: c.name,
        notes: c.notes ?? '',
      }
    })
    const cmp = (a: PatchRow, b: PatchRow): number => {
      switch (sortKey) {
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

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [
        r.fromDevice,
        r.fromPort,
        r.fromPortSub ?? '',
        r.toDevice,
        r.toPort,
        r.toPortSub ?? '',
        r.type,
        r.cableName,
        r.notes,
      ].some((v) => v.toLowerCase().includes(q)),
    )
  }, [rows, filter])


  if (!open) return null

  const exportCsv = () => {
    // #286 — Wenn ein Port einen contentLabel hat, kombinieren wir in der
    // CSV beides als "PGM (1 SDI 3G PGM)". CSV ist eine einzelne Spalte,
    // deshalb zusammengefuegt; die UI hat dafuer eine zweite Zeile.
    const csvPort = (main: string, sub?: string) => (sub ? `${main} (${sub})` : main)
    const header = ['Von Gerät', 'Von Port', 'Nach Gerät', 'Nach Port', 'Typ', 'Länge (m)', 'Farbe', 'Kabelname', 'Notizen']
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
    const lines = [
      header.join(';'),
      ...filtered.map((r) =>
        [
          escape(r.fromDevice),
          escape(csvPort(r.fromPort, r.fromPortSub)),
          escape(r.toDevice),
          escape(csvPort(r.toPort, r.toPortSub)),
          escape(r.type),
          String(r.length),
          escape(r.color),
          escape(r.cableName),
          escape(r.notes),
        ].join(';'),
      ),
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
      title="Patchliste"
      titleIcon="🪢"
      maxWidth="5xl"
      draggableKey="cable-planner:modal-pos:patchlist"
      scrollBody={false}
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400">
            Jedes Kabel als eigene Zeile, sortiert für die Patch-Reihenfolge auf dem Set.
            CSV-Export für Excel/Druck enthält die aktuell gefilterten Zeilen.
          </p>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="rounded bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600 disabled:opacity-40"
          >
            ⬇ CSV exportieren
          </button>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-slate-800 py-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Suchen (Gerät, Port, Typ, Farbe, Notiz …)"
            className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
          />
          <span className="text-[11px] text-slate-400">
            {filtered.length} / {rows.length}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-950 text-slate-400">
              <tr>
                {[
                  { k: 'fromDevice' as const, label: 'Von Gerät' },
                  { k: 'fromDevice' as const, label: 'Port' },
                  { k: 'toDevice' as const, label: 'Nach Gerät' },
                  { k: 'toDevice' as const, label: 'Port' },
                  { k: 'type' as const, label: 'Typ' },
                  { k: 'length' as const, label: 'Länge (m)' },
                  { k: 'color' as const, label: 'Farbe' },
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
                    colSpan={7}
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
