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
  const lengthLabel = cable.length ? `${cable.length} m` : ''
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

const drawColumn = (
  pdf: jsPDF,
  title: string,
  rows: Array<{ port: Port; cables: CableEndpointSummary[] }>,
  xStart: number,
  yStart: number,
  colWidth: number,
  pageBottom: number,
  margin: number,
) => {
  let x = xStart
  let y = yStart
  pdf.setFontSize(11)
  pdf.setTextColor(20)
  pdf.text(title, x, y)
  y += 14
  pdf.setFontSize(9)

  for (const row of rows) {
    // Page-break: if a port row wouldn't fit fully in the current page,
    // start a fresh page. The drawColumn caller resets x/y when it
    // detects we wrapped, but for the per-port renderer we play safe.
    if (y > pageBottom - 30) {
      pdf.addPage()
      y = margin + 4
    }
    pdf.setTextColor(15)
    pdf.setFont('helvetica', 'bold')
    // Helvetica (jsPDF's built-in font) only ships ISO-8859-1 glyphs.
    // The bullet ■ (U+25A0) and arrow → (U+2192) used to print as
    // "%" and "!'" respectively, and any non-Latin char downstream
    // got individually space-padded ("S D I I n 1") because jsPDF
    // can't lay out unmapped glyphs. Switch to ASCII-safe markers.
    const portLine = `> ${row.port.name || row.port.id}`
    const portType = row.port.connectorType ? `  [${row.port.connectorType}]` : ''
    pdf.text(`${portLine}${portType}`, x, y, { maxWidth: colWidth - 4 })
    pdf.setFont('helvetica', 'normal')
    y += 12

    if (row.cables.length === 0) {
      pdf.setTextColor(140)
      pdf.text('  -- frei --', x, y)
      y += 11
      pdf.setTextColor(15)
      continue
    }
    for (const c of row.cables) {
      pdf.setTextColor(15)
      pdf.text(`  -> ${c.cableLabel}`, x, y, { maxWidth: colWidth - 6 })
      y += 11
      pdf.setTextColor(80)
      // Mirror the mobile viewer's "Camera 1 · SDI Out 3 (BNC)"
      // line — device name + port name + connector type — so the
      // printed sheet and the phone match exactly.
      const otherSuffix = c.otherPortConnectorType ? ` [${c.otherPortConnectorType}]` : ''
      const tgt = c.otherPortName
        ? `       an ${c.otherDeviceName} - ${c.otherPortName}${otherSuffix}`
        : `       an ${c.otherDeviceName}`
      pdf.text(tgt, x, y, { maxWidth: colWidth - 6 })
      y += 11
    }
    y += 4 // small gap between port rows
  }
  return y
}

/**
 * Render a single device's patch sheet onto the CURRENT page of `pdf`.
 * Caller is responsible for creating the pdf, adding pages between
 * devices in batch mode, and saving the file. Factored out from
 * `exportDevicePatchSheet` so the new batch export can reuse it
 * without duplicating layout logic.
 */
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

  // Header — device name + meta line
  pdf.setFontSize(16)
  pdf.setTextColor(15)
  pdf.text(device.name || 'Gerät', margin, margin + 4)

  pdf.setFontSize(9)
  pdf.setTextColor(80)
  const metaParts: string[] = []
  if (device.category) metaParts.push(device.category)
  if (device.subtitle) metaParts.push(device.subtitle)
  if (device.ipAddress) metaParts.push(`IP ${device.ipAddress}`)
  pdf.text(metaParts.join('  -'), margin, margin + 20)
  pdf.text(new Date().toLocaleString(), pageWidth - margin, margin + 20, { align: 'right' })

  // Subtle horizontal rule below the header
  pdf.setDrawColor(180)
  pdf.line(margin, margin + 28, pageWidth - margin, margin + 28)

  // Two-column layout for inputs (left) and outputs (right)
  const gutter = 18
  const colWidth = (pageWidth - margin * 2 - gutter) / 2
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

  const colYStart = margin + 48
  drawColumn(
    pdf,
    `INPUTS (${inputRows.length})`,
    inputRows,
    margin,
    colYStart,
    colWidth,
    pageBottom,
    margin,
  )
  drawColumn(
    pdf,
    `OUTPUTS (${outputRows.length})`,
    outputRows,
    margin + colWidth + gutter,
    colYStart,
    colWidth,
    pageBottom,
    margin,
  )

  // Footer — note about cable colour key
  pdf.setFontSize(7)
  pdf.setTextColor(140)
  pdf.text(
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
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format })
  drawDevicePage(pdf, device, allEquipment, allCables)
  const safeName = (device.name || 'device').replace(/[/\\?%*:|"<>]/g, '-').trim() || 'device'
  pdf.save(`${safeName}-patch.pdf`)
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
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format })
  devices.forEach((device, idx) => {
    if (idx > 0) pdf.addPage()
    drawDevicePage(pdf, device, allEquipment, allCables)
  })
  const fileName = options?.fileName ?? 'cable-planner-patch-sammlung.pdf'
  pdf.save(fileName)
}
