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
import QRCode from 'qrcode'
import { useUiStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import { downloadBlob } from '../../lib/downloadBlob'
import { buildExportFilenameWithSuffix } from '../../lib/exportFilename'
import { sanitizeForPdf } from '../../lib/sanitizeForPdf'
import { portLabelPair, genderSymbol } from '../../lib/portLabel'
import { Cable as CableIcon, Tag, Download } from 'lucide-react'
import { ModalShell } from '../shared/ModalShell'
import { Icon } from '../shared/Icon'
import { useTranslation } from '../../lib/i18n'
import type { Cable } from '../../types/cable'
import type { EquipmentItem, Port } from '../../types/equipment'

type SortKey = 'number' | 'fromDevice' | 'toDevice' | 'type' | 'length' | 'color'
/** #349 — Spalten-/Trenner-Profil fuer gaengige Etiketten-Drucker-Software. */
type LabelCsvFormat = 'generic' | 'brother' | 'dymo'

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
  /** #410 — Steckverbinder-Geschlecht je Ende ('♂'/'♀'/''). */
  fromGender: string
  toGender: string
  type: string
  length: number
  color: string
  cableName: string
  notes: string
  layer: string
  /** #363 — Multicore-/Snake-Bündel-Name (leer = Einzelkabel). */
  multicore: string
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
  // #349 — Ziel-Format fuer den Label-Drucker-CSV-Export.
  const [labelCsvFormat, setLabelCsvFormat] = useState<LabelCsvFormat>('generic')

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
        fromGender: genderSymbol(fromPort?.gender),
        toGender: genderSymbol(finalToPort?.gender),
        type: c.type,
        length: c.length,
        color: c.color || '#64748b',
        cableName: c.name,
        notes: c.notes ?? '',
        layer: c.layer ?? '',
        multicore: c.multicoreName ?? '',
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
    // #410 — Geschlecht ans Port-Label haengen wenn gesetzt: "1 (PGM) ♂".
    const fmtPort = (main: string, sub?: string, gender?: string) => {
      const base = sub ? `${main} (${sub})` : main
      return gender ? `${base} ${gender}` : base
    }
    const header = [
      t('patchList.col.number', 'Nr.'),
      t('patchList.col.fromDevice', 'Von Gerät'),
      t('patchList.col.fromPort', 'Von Port'),
      t('patchList.col.toDevice', 'Nach Gerät'),
      t('patchList.col.toPort', 'Nach Port'),
      t('export.bom.csv.type', 'Typ'),
      t('export.bom.csv.lengthM', 'Länge (m)'),
      t('patchList.col.layer', 'Layer'),
      t('patchList.col.multicore', 'Multicore'),
      t('patchList.col.color', 'Farbe'),
      t('patchList.col.cableName', 'Kabelname'),
      t('patchList.col.notes', 'Notizen'),
    ]
    const data = filtered.map((r) => [
      r.cableNumber,
      r.fromDevice,
      fmtPort(r.fromPort, r.fromPortSub, r.fromGender),
      r.toDevice,
      fmtPort(r.toPort, r.toPortSub, r.toGender),
      r.type,
      r.length,
      r.layer,
      r.multicore,
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
    XLSX.utils.book_append_sheet(wb, sheet, t('patchList.sheetName', 'Patchliste'))
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
  const exportLabels = async () => {
    const hexToRgb = (hex: string): [number, number, number] => {
      const h = (hex || '#888888').replace('#', '')
      const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '8')
      return [parseInt(n.slice(0, 2), 16) || 136, parseInt(n.slice(2, 4), 16) || 136, parseInt(n.slice(4, 6), 16) || 136]
    }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = 210, pageH = 297, cols = 2, rowsPerPage = 9, mL = 8, mT = 10, gap = 3
    const lw = (pageW - 2 * mL - (cols - 1) * gap) / cols
    const lh = (pageH - 2 * mT - (rowsPerPage - 1) * gap) / rowsPerPage
    // Pro Kabel zwei Etiketten (beide Enden) plus ein QR-Code, der die
    // Kabel-Identitaet (Nummer/Name) + Strecke kodiert — ein Scan vor Ort
    // identifiziert das Kabel eindeutig. Beide Enden teilen denselben QR.
    const labels = filtered.flatMap((r) => {
      const numPrefix = r.cableNumber ? `${r.cableNumber} · ` : ''
      const title = `${numPrefix}${r.type}${r.cableName && r.cableName !== r.type ? ' · ' + r.cableName : ''}`
      const meta = r.length ? `${r.length} m` : ''
      const qrText = `${r.cableNumber || r.cableName || r.type} | ${r.fromDevice} ${r.fromPort} > ${r.toDevice} ${r.toPort}`
      return [
        { title, dest: `${r.fromDevice} · ${r.fromPort}  →  ${r.toDevice} · ${r.toPort}`, meta, color: r.color, qrText },
        { title, dest: `${r.toDevice} · ${r.toPort}  →  ${r.fromDevice} · ${r.fromPort}`, meta, color: r.color, qrText },
      ]
    })
    // QR-Data-URLs vorab erzeugen (toDataURL ist async). Fehlerhafte QR
    // werden uebersprungen — der Export bricht nie deshalb ab.
    const qrCache = new Map<string, string>()
    await Promise.all(
      [...new Set(labels.map((l) => l.qrText))].map(async (text) => {
        try {
          qrCache.set(text, await QRCode.toDataURL(text, { margin: 0, width: 128 }))
        } catch {
          // ohne QR zeichnen
        }
      }),
    )
    const qrSize = Math.min(lh - 6, 16)
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
      const qr = qrCache.get(lbl.qrText)
      if (qr) doc.addImage(qr, 'PNG', x + lw - qrSize - 2.5, y + (lh - qrSize) / 2, qrSize, qrSize)
      doc.setTextColor(20)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(sanitizeForPdf(lbl.title).slice(0, qr ? 34 : 42), x + 7, y + 7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(sanitizeForPdf(lbl.dest).slice(0, qr ? 48 : 64), x + 7, y + 14)
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

  // #349 — Label-Drucker-CSV: serieller Import in Brother P-touch Editor,
  // Dymo Connect/Stamps oder generische Etiketten-Software. Pro Kabel ZWEI
  // Zeilen (beide Enden), damit jedes Kabelende ein eigenes Etikett bekommt.
  // ASCII-sicher via sanitizeForPdf, weil viele Drucker-Tools UTF-8 nur
  // halbherzig importieren. Trenner/Spalten je Ziel-Format.
  const exportLabelCsv = (format: LabelCsvFormat) => {
    const ascii = (v: unknown) => sanitizeForPdf(String(v ?? ''))
    // Brother P-touch Editor erwartet historisch TAB-getrennt; Dymo + der
    // generische Fall nutzen Komma. Excel-Kompat ist hier zweitrangig — die
    // Datei geht in die Drucker-Software, nicht in Excel.
    const sep = format === 'brother' ? '\t' : ','
    const escape = (v: unknown) => {
      const s = ascii(v)
      // Bei Komma-Trennung quoten wenn noetig; TAB-Felder nie quoten.
      if (sep === '\t') return s.replace(/\t/g, ' ')
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    // Ein "Etikett" = ein Kabelende. label1 = grosse Zeile (Nummer/Typ),
    // label2 = Strecke aus Sicht dieses Endes, meta = Laenge.
    type LabelRow = { label1: string; label2: string; meta: string; color: string }
    // #410 — Geschlecht ASCII-tauglich (♂/♀ wuerde sanitizeForPdf strippen).
    const g = (sym: string) => (sym === '♂' ? ' (M)' : sym === '♀' ? ' (F)' : '')
    const labelRows: LabelRow[] = filtered.flatMap((r) => {
      const num = r.cableNumber || r.cableName || r.type
      const meta = r.length ? `${r.length} m` : ''
      const fromEnd = `${r.fromDevice} ${r.fromPort}${g(r.fromGender)}`
      const toEnd = `${r.toDevice} ${r.toPort}${g(r.toGender)}`
      return [
        { label1: num, label2: `${fromEnd} -> ${toEnd}`, meta, color: r.color },
        { label1: num, label2: `${toEnd} -> ${fromEnd}`, meta, color: r.color },
      ]
    })
    const header = ['Label1', 'Label2', 'Length', 'Color']
    const lines = [
      header.join(sep),
      ...labelRows.map((l) => [l.label1, l.label2, l.meta, l.color].map(escape).join(sep)),
    ]
    // Brother bekommt eine .txt (TAB), sonst .csv. Komma-Variante mit BOM.
    const ext = format === 'brother' ? 'txt' : 'csv'
    const body = sep === ',' ? '﻿' + lines.join('\r\n') : lines.join('\r\n')
    downloadBlob(
      buildExportFilenameWithSuffix(projectName || 'cable-planner', `etiketten-${format}`, ext),
      body,
      ext === 'txt' ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8',
    )
  }

  // #353 — Audio-Eingangsliste: die Audio-Layer-Kabel als nummerierte
  // Kanal-Liste (Ch · Quelle · Port · Stecker · nach Gerät · Länge). Der
  // klassische FOH-Deliverable; baut auf den vorhandenen Patch-Rows auf.
  const exportInputList = () => {
    const audioRows = filtered.filter((r) => r.layer === 'audio')
    const escape = (v: unknown) => {
      const s = sanitizeForPdf(String(v ?? ''))
      return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = [
      t('inputList.col.ch', 'Ch'),
      t('inputList.col.source', 'Quelle'),
      t('inputList.col.port', 'Port'),
      t('inputList.col.connector', 'Stecker'),
      t('inputList.col.toDevice', 'nach Gerät'),
      t('export.bom.csv.lengthM', 'Länge (m)'),
    ]
    const lines = [
      header.join(';'),
      ...audioRows.map((r, i) =>
        [String(i + 1), r.fromDevice, r.fromPort, r.type, r.toDevice, r.length || ''].map(escape).join(';'),
      ),
    ]
    downloadBlob(
      buildExportFilenameWithSuffix(projectName || 'cable-planner', 'eingangsliste', 'csv'),
      '﻿' + lines.join('\r\n'),
      'text/csv;charset=utf-8',
    )
  }

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={t('patchList.title', 'Patchliste')}
      titleIcon={<Icon icon={CableIcon} size="sm" />}
      maxWidth="5xl"
      draggableKey="cable-planner:modal-pos:patchlist"
      scrollBody={false}
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-cp-text-muted">
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
              className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1 text-cp-xs hover:bg-emerald-600 disabled:opacity-50"
            >
              <Icon icon={Download} size="xs" />
              {t('patchList.exportCsv', 'CSV exportieren')}
            </button>
            <button
              type="button"
              onClick={() => void exportXlsx()}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded bg-emerald-700 px-3 py-1 text-cp-xs hover:bg-emerald-600 disabled:opacity-50"
            >
              <Icon icon={Download} size="xs" />
              {t('patchList.exportXlsx', 'XLSX exportieren')}
            </button>
            <button
              type="button"
              onClick={() => void exportLabels()}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 rounded bg-sky-700 px-3 py-1 text-cp-xs hover:bg-sky-600 disabled:opacity-50"
            >
              <Icon icon={Tag} size="xs" />
              {t('patchList.exportLabels', 'Etiketten + QR (PDF)')}
            </button>
            {/* #349 — Label-Drucker-CSV: Format waehlen, dann exportieren. */}
            <select
              value={labelCsvFormat}
              onChange={(e) => setLabelCsvFormat(e.target.value as LabelCsvFormat)}
              title={t('patchList.labelCsvFormat', 'Etiketten-Drucker-Format')}
              className="rounded border border-cp-border bg-cp-surface-3 px-1 py-1 text-cp-xs"
            >
              <option value="generic">{t('patchList.labelCsv.generic', 'Generisch (CSV)')}</option>
              <option value="brother">{t('patchList.labelCsv.brother', 'Brother P-touch (TXT)')}</option>
              <option value="dymo">{t('patchList.labelCsv.dymo', 'Dymo (CSV)')}</option>
            </select>
            <button
              type="button"
              onClick={() => exportLabelCsv(labelCsvFormat)}
              disabled={filtered.length === 0}
              className="rounded bg-sky-700 px-3 py-1 text-cp-xs hover:bg-sky-600 disabled:opacity-50"
            >
              {t('patchList.exportLabelCsv', '🏷 Etiketten-CSV')}
            </button>
            {/* #353 — Audio-Eingangsliste (nur sichtbar wenn Audio-Kabel da). */}
            {filtered.some((r) => r.layer === 'audio') && (
              <button
                type="button"
                onClick={exportInputList}
                className="rounded bg-purple-700 px-3 py-1 text-cp-xs hover:bg-purple-600"
              >
                {t('patchList.exportInputList', '🎚 Eingangsliste')}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-cp-border-muted py-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('patchList.searchPlaceholder', 'Suchen (Gerät, Port, Typ, Farbe, Notiz …)')}
            aria-label={t('patchList.searchPlaceholder', 'Suchen (Gerät, Port, Typ, Farbe, Notiz …)')}
            className="flex-1 rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
          />
          {layers.length > 0 && (
            <select
              value={layerFilter}
              onChange={(e) => setLayerFilter(e.target.value)}
              title={t('patchList.layerFilter', 'Nach Layer/Gewerk filtern')}
              className="rounded border border-cp-border bg-cp-surface-3 px-2 py-1 text-cp-xs"
            >
              <option value="">{t('patchList.allLayers', 'Alle Layer')}</option>
              {layers.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <span className="text-[11px] text-cp-text-muted">
            {filtered.length} / {rows.length}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-cp-xs">
            <thead className="sticky top-0 bg-cp-surface-3 text-cp-text-muted">
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
                    className="cursor-pointer px-2 py-1 text-left hover:text-cp-text-bright"
                    onClick={() => setSortKey(col.k)}
                  >
                    {col.label}
                    {sortKey === col.k && <span className="ml-1 text-[11px]">▲</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.cableId} className="border-t border-cp-border-muted hover:bg-cp-surface-1">
                  <td className="px-2 py-1 font-mono text-[11px] text-sky-300">{r.cableNumber}</td>
                  <td className="px-2 py-1 font-medium text-cp-text">{r.fromDevice}</td>
                  <td className="px-2 py-1 text-cp-text-secondary">
                    {r.fromPort}
                    {r.fromPortSub && (
                      <div className="text-[10px] text-cp-text-muted">{r.fromPortSub}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 font-medium text-cp-text">{r.toDevice}</td>
                  <td className="px-2 py-1 text-cp-text-secondary">
                    {r.toPort}
                    {r.toPortSub && (
                      <div className="text-[10px] text-cp-text-muted">{r.toPortSub}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-cp-text-secondary">{r.type}</td>
                  <td className="px-2 py-1 text-right text-cp-text-secondary">{r.length}</td>
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
                    className="px-2 py-8 text-center text-cp-xs text-[var(--cp-text-faint)]"
                  >
                    {rows.length === 0
                      ? t(
                          'patchList.empty.noCables',
                          'Dieses Projekt hat noch keine Kabel. Verbinde Geräte auf dem Canvas, um eine Patchliste zu erzeugen.',
                        )
                      : t('patchList.empty.noMatch', 'Keine Kabel passen zum Filter.')}
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
