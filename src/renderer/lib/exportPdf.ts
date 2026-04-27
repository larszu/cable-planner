import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import type { ProjectMetadata } from '../types/project'

const fmtDate = (iso?: string): string => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/**
 * Draw a DIN-like plan title block in the bottom-right corner. Returns the
 * total height used by the block so we can keep the drawing above it.
 */
const drawTitleBlock = (
  pdf: jsPDF,
  meta: ProjectMetadata,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): number => {
  const boxW = 300
  const rowH = 14
  const rows: [string, string | undefined][] = [
    ['Projekt', meta.name || '—'],
    ['Projekt-Nr.', meta.projectNumber],
    ['Kunde', meta.client],
    ['Auftragnehmer', meta.contractor],
    ['Planer', meta.author],
    ['Erstellt', fmtDate(meta.createdAt)],
    ['Geändert', fmtDate(meta.updatedAt)],
  ]
  const visibleRows = rows.filter(([, v]) => !!v || true) // keep all rows, show "—" when missing
  const logoH = 36
  const hasLogos = !!(meta.companyLogo || meta.clientLogo)
  const boxH = visibleRows.length * rowH + 8 + (hasLogos ? logoH + 6 : 0)
  const x = pageWidth - margin - boxW
  const y = pageHeight - margin - boxH

  pdf.setDrawColor(40)
  pdf.setLineWidth(0.6)
  pdf.rect(x, y, boxW, boxH)

  // Logos row at the top of the box.
  let rowY = y + 4
  if (hasLogos) {
    const halfW = boxW / 2 - 4
    try {
      if (meta.companyLogo) {
        pdf.addImage(meta.companyLogo, 'PNG', x + 4, rowY, halfW, logoH, undefined, 'FAST')
      }
    } catch {
      // ignore logo decode errors
    }
    try {
      if (meta.clientLogo) {
        pdf.addImage(
          meta.clientLogo,
          'PNG',
          x + halfW + 8,
          rowY,
          halfW,
          logoH,
          undefined,
          'FAST',
        )
      }
    } catch {
      // ignore
    }
    // horizontal separator under logos
    pdf.line(x, rowY + logoH + 2, x + boxW, rowY + logoH + 2)
    rowY += logoH + 6
  }

  pdf.setFontSize(8)
  for (const [label, value] of visibleRows) {
    pdf.setTextColor(100)
    pdf.text(label, x + 4, rowY + 10)
    pdf.setTextColor(15)
    pdf.text(value ?? '—', x + 85, rowY + 10, {
      maxWidth: boxW - 90,
    })
    pdf.line(x, rowY + rowH, x + boxW, rowY + rowH)
    rowY += rowH
  }

  return boxH
}

export const exportCanvasToPdf = async (
  projectName: string,
  metadata?: ProjectMetadata,
) => {
  const pdf = await buildCanvasPdf(metadata)
  pdf.save(`${(projectName || 'cable-planner').replace(/[^a-z0-9\-_. ]/gi, '_')}.pdf`)
}

/**
 * Same as `exportCanvasToPdf` but returns the generated PDF as a `Uint8Array`
 * instead of triggering a download. Used to upload the PDF to external systems
 * (e.g. attach it to a Rentman project).
 */
export const exportCanvasToPdfBytes = async (
  metadata?: ProjectMetadata,
): Promise<Uint8Array> => {
  const pdf = await buildCanvasPdf(metadata)
  // jsPDF returns an ArrayBuffer when format is 'arraybuffer'.
  const buffer = pdf.output('arraybuffer') as ArrayBuffer
  return new Uint8Array(buffer)
}

const buildCanvasPdf = async (metadata?: ProjectMetadata): Promise<jsPDF> => {
  const canvasEl = document.getElementById('cable-planner-canvas')
  if (!canvasEl) {
    throw new Error('Canvas not found')
  }

  const viewportEl = canvasEl.querySelector('.react-flow__viewport') as HTMLElement | null
  const target = viewportEl ?? canvasEl

  const dataUrl = await toPng(target, {
    backgroundColor: '#0f172a',
    pixelRatio: 2,
    cacheBust: true,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true
      if (node.classList.contains('react-flow__minimap')) return false
      if (node.classList.contains('react-flow__controls')) return false
      return true
    },
  })

  const img = new Image()
  img.src = dataUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not load captured image'))
  })

  const orientation = img.width >= img.height ? 'landscape' : 'portrait'
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  const margin = 24
  const titleBlockHeight = metadata ? 160 : 0

  const availW = pageWidth - margin * 2
  const availH = pageHeight - margin * 2 - 24 - titleBlockHeight
  const scale = Math.min(availW / img.width, availH / img.height)
  const renderW = img.width * scale
  const renderH = img.height * scale
  const offsetX = (pageWidth - renderW) / 2
  const offsetY = margin + 24

  pdf.setFontSize(14)
  pdf.setTextColor(15)
  pdf.text(metadata?.name || 'Cable Planner Project', margin, margin + 4)
  pdf.setFontSize(9)
  pdf.setTextColor(80)
  pdf.text(new Date().toLocaleString(), pageWidth - margin, margin + 4, { align: 'right' })

  pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, renderW, renderH)

  if (metadata) {
    drawTitleBlock(pdf, metadata, pageWidth, pageHeight, margin)
  }

  return pdf
}
