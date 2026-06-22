// Per-device "patch sheet" PDF (issue #74).
//
// One A4 portrait page per device, intended to be printed and stuck on
// the physical hardware so the operator on-site sees exactly which
// cable goes into which port without consulting the full plan PDF.
//
// Layout:
//   ┌─────────────────────────────────────────────────────────┐
//   │  Device name                                Date stamp │
//   │  Category · IP                                          │
//   ├─────────────────────────┬───────────────────────────────┤
//   │  INPUTS                 │  OUTPUTS                      │
//   │  · Port name [type]     │  · Port name [type]           │
//   │    → cable name (m)     │    → cable name (m)           │
//   │      from other device  │      to other device          │
//   │  …                      │  …                            │
//   └─────────────────────────┴───────────────────────────────┘
//
// Cables that have a stable graphmlId / serial number / name show that
// info first so technicians can match the printed sheet to the labels
// they put on the physical cables.

import jsPDF from 'jspdf'
import type { Cable } from '../types/cable'
import type { EquipmentItem, Port } from '../types/equipment'
import { pdfText } from './pdfHelpers'
import { sanitizeForPdf } from './sanitizeForPdf'
import { buildExportFilename, buildExportFilenameWithSuffix } from './exportFilename'
import { portLabelPair } from './portLabel'

interface CableEndpointSummary {
  /** Human-readable label for the cable (name OR fallback to type+length). */
  cableLabel: string
  /** Name of the device on the other side of this cable. */
  otherDeviceName: string
  /** Name of the port on the other side, if known. */
  otherPortName: string | null
  /** Connector type of the port on the other side (e.g. "BNC"), if known.
   *  Mirrors what the mobile viewer prints next to each port so the
   *  patch sheet and the phone screen match. */
  otherPortConnectorType: string | null
  cable: Cable
}

const summarizeEndpoint = (
  cable: Cable,
  myEquipmentId: string,
  allEquipment: EquipmentItem[],
): CableEndpointSummary => {
  const isFromMe = cable.fromEquipmentId === myEquipmentId
  const otherId = isFromMe ? cable.toEquipmentId : cable.fromEquipmentId
  const otherPortId = isFromMe ? cable.toPortId : cable.fromPortId
  const other = allEquipment.find((e) => e.id === otherId)
  const otherPort: Port | undefined = other
    ? [...(other.inputs ?? []), ...(other.outputs ?? [])].find((p) => p.id === otherPortId)
    : undefined
  // v7.9.68 / #182 — Wireless-Kabel haben statt einer "Länge" eine
  // "Max. Reichweite" (m). Wenn wireless aktiv ist und maxRange gepflegt
  // wurde, das stattdessen anzeigen.
  const lengthLabel = cable.wireless
    ? cable.maxRange
      ? `<=${cable.maxRange} m`
      : ''
    : cable.length
      ? `${cable.length} m`
      : ''
  const typeLabel = cable.type ? String(cable.type) : ''
  // ASCII separator — the middle-dot · (U+00B7) IS in latin-1 so it
  // works, but for visual consistency with the rest of the PDF (now
  // pure ASCII for safety) we use a plain dash.
  const baseLabel = [typeLabel, lengthLabel].filter(Boolean).join(' - ') || 'Kabel'
  const cableLabel = cable.name?.trim() ? `${cable.name.trim()}  (${baseLabel})` : baseLabel
  return {
    cableLabel,
    otherDeviceName: other?.name ?? 'unbekannt',
    otherPortName: otherPort?.name ?? null,
    otherPortConnectorType: otherPort?.connectorType ? String(otherPort.connectorType) : null,
    cable,
  }
}

/** Group a device's ports + the cables incident on each port. Ports
 *  with no cable still appear (the printed sheet doubles as a checklist
 *  during build-up). */
const collectPortRows = (
  device: EquipmentItem,
  ports: Port[],
  myEquipmentId: string,
  allCables: Cable[],
  allEquipment: EquipmentItem[],
): Array<{ port: Port; cables: CableEndpointSummary[] }> => {
  void device
  return ports.map((port) => {
    const cables = allCables
      .filter((c) =>
        (c.fromEquipmentId === myEquipmentId && c.fromPortId === port.id) ||
        (c.toEquipmentId === myEquipmentId && c.toPortId === port.id),
      )
      .map((c) => summarizeEndpoint(c, myEquipmentId, allEquipment))
    return { port, cables }
  })
}


/**
 * Render a single device's patch sheet onto the CURRENT page of `pdf`.
 * Caller is responsible for creating the pdf, adding pages between
 * devices in batch mode, and saving the file. Factored out from
 * `exportDevicePatchSheet` so the new batch export can reuse it
 * without duplicating layout logic.
 */
/** v7.9.0 / Issue #109 — Draws the page header (device name + meta +
 *  current date/time + horizontal rule). Called once on the first
 *  page AND repeated on every subsequent page so users can identify
 *  the printed sheet without flipping back to page 1. */
const drawPageHeader = (pdf: jsPDF, device: EquipmentItem): number => {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 32
  pdf.setFontSize(16)
  pdf.setTextColor(15)
  pdf.setFont('helvetica', 'bold')
  pdfText(pdf, device.name || 'Gerät', margin, margin + 4)

  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(80)
  const metaParts: string[] = []
  if (device.category) metaParts.push(device.category)
  if (device.subtitle) metaParts.push(device.subtitle)
  if (device.ipAddress) metaParts.push(`IP ${device.ipAddress}`)
  pdfText(pdf, metaParts.join('  -'), margin, margin + 20)
  pdfText(pdf, new Date().toLocaleString(), pageWidth - margin, margin + 20, { align: 'right' })

  // Hersteller-/Datenblatt-Link als klickbare Zeile. Das manufacturerUrl-
  // Feld existierte schon (Properties), tauchte aber in keinem Report auf.
  let dividerY = margin + 28
  if (device.manufacturerUrl) {
    const url = device.manufacturerUrl
    const safe = sanitizeForPdf(url)
    const shown = safe.length > 88 ? safe.slice(0, 87) + '...' : safe
    pdf.setFontSize(8)
    pdf.setTextColor(40, 90, 180)
    pdf.textWithLink(`Datenblatt: ${shown}`, margin, margin + 27, { url })
    dividerY = margin + 34
  }
  pdf.setDrawColor(180)
  pdf.line(margin, dividerY, pageWidth - margin, dividerY)
  // Return the y-position where content can start.
  return dividerY + 20
}

/** v7.9.0 / Issue #109 — Draws ONE port row in BOTH columns so they
 *  stay vertically aligned. Returns the y-position AFTER this row.
 *  When a row would overflow the page, the caller is responsible for
 *  starting a new page first; this helper just paints. */
const drawPortRowPair = (
  pdf: jsPDF,
  leftRow: { port: Port; cables: CableEndpointSummary[] } | null,
  rightRow: { port: Port; cables: CableEndpointSummary[] } | null,
  y: number,
  leftX: number,
  rightX: number,
  colWidth: number,
): number => {
  // Determine how tall this row will be on each side, then advance by
  // the MAX so both sides stay aligned no matter how many cables each
  // port has.
  const sideRowHeight = (row: { port: Port; cables: CableEndpointSummary[] } | null): number => {
    if (!row) return 0
    let h = 12 // port-name line
    if (row.cables.length === 0) {
      h += 11
    } else {
      h += row.cables.length * 22 // cable label + target line
    }
    return h + 4 // small gap below the row
  }
  const rowHeight = Math.max(sideRowHeight(leftRow), sideRowHeight(rightRow))

  // v7.9.2 — splitTextToSize liefert die tatsächliche Zeilenanzahl
  // zurück; dadurch advancen wir y korrekt auch wenn ein Cable-Label
  // oder die "an Device…"-Zeile umgebrochen wurde. Vorher gab es
  // Text-Overlap weil immer nur 11px advance't wurde (User-Issue:
  // "exportierte pdfs überlagern sich auch der text").
  const drawSide = (
    row: { port: Port; cables: CableEndpointSummary[] } | null,
    x: number,
  ) => {
    if (!row) return 0
    let cy = y
    pdf.setTextColor(15)
    pdf.setFont('helvetica', 'bold')
    // #286 — contentLabel als Haupt-Label, port.name als Subline.
    const pair = portLabelPair(row.port)
    const portLine = `> ${pair.main || row.port.id}`
    const portType = row.port.connectorType ? `  [${row.port.connectorType}]` : ''
    const subSuffix = pair.subline ? `  (${pair.subline})` : ''
    const portLines = pdfText(pdf, `${portLine}${portType}${subSuffix}`, x, cy, { maxWidth: colWidth - 4 })
    pdf.setFont('helvetica', 'normal')
    cy += 12 * portLines

    if (row.cables.length === 0) {
      pdf.setTextColor(140)
      pdfText(pdf, '  -- frei --', x, cy)
      return cy + 11 - y
    }
    for (const c of row.cables) {
      pdf.setTextColor(15)
      const labelLines = pdfText(pdf, `  -> ${c.cableLabel}`, x, cy, { maxWidth: colWidth - 6 })
      cy += 11 * labelLines
      pdf.setTextColor(80)
      const otherSuffix = c.otherPortConnectorType ? ` [${c.otherPortConnectorType}]` : ''
      const tgt = c.otherPortName
        ? `       an ${c.otherDeviceName} - ${c.otherPortName}${otherSuffix}`
        : `       an ${c.otherDeviceName}`
      const tgtLines = pdfText(pdf, tgt, x, cy, { maxWidth: colWidth - 6 })
      cy += 11 * tgtLines
    }
    return cy - y
  }

  const leftHeight = drawSide(leftRow, leftX)
  const rightHeight = drawSide(rightRow, rightX)
  return y + Math.max(rowHeight, leftHeight, rightHeight)
}

const drawDevicePage = (
  pdf: jsPDF,
  device: EquipmentItem,
  allEquipment: EquipmentItem[],
  allCables: Cable[],
): void => {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 32
  const pageBottom = pageHeight - margin

  // Header on page 1
  let y = drawPageHeader(pdf, device)

  // Two-column layout for inputs (left) and outputs (right)
  const gutter = 18
  const colWidth = (pageWidth - margin * 2 - gutter) / 2
  const leftX = margin
  const rightX = margin + colWidth + gutter
  const inputRows = collectPortRows(
    device,
    device.inputs ?? [],
    device.id,
    allCables,
    allEquipment,
  )
  const outputRows = collectPortRows(
    device,
    device.outputs ?? [],
    device.id,
    allCables,
    allEquipment,
  )

  // Column titles
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(20)
  pdfText(pdf, `INPUTS (${inputRows.length})`, leftX, y)
  pdfText(pdf, `OUTPUTS (${outputRows.length})`, rightX, y)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  y += 14

  // Walk both columns in lock-step so inputs and outputs always start
  // at the SAME y on every page (Issue #109).
  const rowCount = Math.max(inputRows.length, outputRows.length)
  for (let i = 0; i < rowCount; i++) {
    const leftRow = inputRows[i] ?? null
    const rightRow = outputRows[i] ?? null

    // Estimate row height to decide page break.
    const estHeight = Math.max(
      leftRow ? 12 + (leftRow.cables.length === 0 ? 11 : leftRow.cables.length * 22) + 4 : 0,
      rightRow ? 12 + (rightRow.cables.length === 0 ? 11 : rightRow.cables.length * 22) + 4 : 0,
    )

    if (y + estHeight > pageBottom) {
      pdf.addPage()
      // Repeat header on every new page (Issue #109)
      y = drawPageHeader(pdf, device)
      // Repeat column titles too so the user knows what's left/right
      pdf.setFontSize(11)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(20)
      pdfText(pdf, `INPUTS (${inputRows.length}) - Forts.`, leftX, y)
      pdfText(pdf, `OUTPUTS (${outputRows.length}) - Forts.`, rightX, y)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      y += 14
    }

    y = drawPortRowPair(pdf, leftRow, rightRow, y, leftX, rightX, colWidth)
  }

  // Footer — note about cable colour key
  pdf.setFontSize(7)
  pdf.setTextColor(140)
  pdfText(
    pdf,
    `Cable Planner - ${device.name} - ${inputRows.length} In / ${outputRows.length} Out - automatisch erzeugte Patch-Liste`,
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' },
  )
}

export const exportDevicePatchSheet = async (
  device: EquipmentItem,
  allEquipment: EquipmentItem[],
  allCables: Cable[],
  options?: { format?: 'a4' | 'a3' },
): Promise<void> => {
  const format = options?.format ?? 'a4'
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format, compress: true })
  drawDevicePage(pdf, device, allEquipment, allCables)
  // v7.9.116 — Einheitlicher Stempel: YYYYMMDD_<device>_NNN_patch.pdf
  pdf.save(buildExportFilenameWithSuffix(device.name || 'device', 'patch', 'pdf'))
}

/** Same as `exportDevicePatchSheet` but returns the PDF as a Blob
 *  instead of triggering a download — the caller can pipe it into
 *  the OS print dialog (via a hidden iframe + window.print()). */
export const buildDevicePatchSheetBlob = (
  device: EquipmentItem,
  allEquipment: EquipmentItem[],
  allCables: Cable[],
  options?: { format?: 'a4' | 'a3' },
): Blob => {
  const format = options?.format ?? 'a4'
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format, compress: true })
  drawDevicePage(pdf, device, allEquipment, allCables)
  return pdf.output('blob')
}

/**
 * Combined patch-sheet PDF — one device per page in a single file.
 * Used by the new "Drucken" dialog when the user picks several devices
 * and wants a single PDF (instead of one download per device).
 */
export const exportDevicesPatchSheetsBatch = async (
  devices: EquipmentItem[],
  allEquipment: EquipmentItem[],
  allCables: Cable[],
  options?: { format?: 'a4' | 'a3'; fileName?: string },
): Promise<void> => {
  if (devices.length === 0) return
  const format = options?.format ?? 'a4'
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format, compress: true })
  devices.forEach((device, idx) => {
    if (idx > 0) pdf.addPage()
    drawDevicePage(pdf, device, allEquipment, allCables)
  })
  // v7.9.116 — Wenn ein fileName explizit uebergeben wurde (z.B. weil
  // der Caller einen sehr spezifischen Namen will), benutzen wir den;
  // sonst Stempel mit 'patch-sammlung' suffix.
  const fileName =
    options?.fileName ?? buildExportFilename('cable-planner-patch-sammlung', 'pdf')
  pdf.save(fileName)
}

/** Blob variant of the batch export for the Drucken-Dialog (#print
 *  via OS dialog instead of file download). */
export const buildDevicesPatchSheetsBatchBlob = (
  devices: EquipmentItem[],
  allEquipment: EquipmentItem[],
  allCables: Cable[],
  options?: { format?: 'a4' | 'a3' },
): Blob | null => {
  if (devices.length === 0) return null
  const format = options?.format ?? 'a4'
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format, compress: true })
  devices.forEach((device, idx) => {
    if (idx > 0) pdf.addPage()
    drawDevicePage(pdf, device, allEquipment, allCables)
  })
  return pdf.output('blob')
}
