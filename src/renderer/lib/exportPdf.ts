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
  if (!viewportEl) {
    throw new Error('ReactFlow viewport not found')
  }

  // Compute the bounding box of ALL nodes in flow-coordinates (not the current
  // visible viewport). Each `.react-flow__node` is absolutely positioned via
  // `transform: translate(x, y)` relative to the viewport at scale 1; the
  // node's own `offsetWidth`/`offsetHeight` is unaffected by the viewport
  // zoom. We parse each node's translation directly so we don't depend on the
  // current zoom level.
  const nodeEls = Array.from(
    viewportEl.querySelectorAll<HTMLElement>('.react-flow__node'),
  )
  if (nodeEls.length === 0) {
    throw new Error('Keine Geräte zum Exportieren vorhanden')
  }

  const parseTranslate = (el: HTMLElement): { x: number; y: number } => {
    // Prefer the matrix from getComputedStyle so we cover translate / translate3d / matrix.
    const transform = getComputedStyle(el).transform
    if (transform && transform !== 'none') {
      const match = /matrix.*\((.+)\)/.exec(transform)
      if (match) {
        const parts = match[1].split(',').map((value) => parseFloat(value.trim()))
        if (parts.length === 6) return { x: parts[4], y: parts[5] }
        if (parts.length === 16) return { x: parts[12], y: parts[13] }
      }
    }
    return { x: 0, y: 0 }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodeEls) {
    const { x, y } = parseTranslate(node)
    const w = node.offsetWidth
    const h = node.offsetHeight
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x + w > maxX) maxX = x + w
    if (y + h > maxY) maxY = y + h
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    throw new Error('Konnte den Inhalt des Canvas nicht vermessen')
  }

  // Padding around the content (in flow pixels) so cable bends and labels
  // near the edge aren't clipped.
  const padding = 80
  const contentX = minX - padding
  const contentY = minY - padding
  const contentW = Math.ceil(maxX - minX + padding * 2)
  const contentH = Math.ceil(maxY - minY + padding * 2)

  // Capture the viewport at scale 1, translated so the content's top-left
  // sits at (0, 0). html-to-image's `width`/`height` clip the output to the
  // requested rectangle and `style` overrides the captured element's style
  // during capture (does not mutate the live DOM).
  const dataUrl = await toPng(viewportEl, {
    backgroundColor: '#0f172a',
    pixelRatio: 2,
    cacheBust: true,
    width: contentW,
    height: contentH,
    style: {
      width: `${contentW}px`,
      height: `${contentH}px`,
      transform: `translate(${-contentX}px, ${-contentY}px)`,
      transformOrigin: '0 0',
    },
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

  // Build a PDF page sized to the captured image. Content was captured at
  // pixelRatio=2 so the natural pixel dimensions are doubled; we want the PDF
  // page to match the logical (CSS-pixel) size of the canvas content. 1 CSS
  // pixel ≈ 0.75 pt at 96 DPI.
  const PX_TO_PT = 0.75
  const margin = 24
  const headerHeight = 28 // reserved for title + timestamp at the top
  const titleBlockHeight = metadata ? 160 : 0
  const titleBlockGap = metadata ? 12 : 0

  const drawingW = contentW * PX_TO_PT
  const drawingH = contentH * PX_TO_PT

  const pageWidth = drawingW + margin * 2
  const pageHeight = drawingH + margin * 2 + headerHeight + titleBlockHeight + titleBlockGap

  const orientation = pageWidth >= pageHeight ? 'landscape' : 'portrait'
  const pdf = new jsPDF({
    orientation,
    unit: 'pt',
    format: [pageWidth, pageHeight],
  })

  pdf.setFontSize(14)
  pdf.setTextColor(15)
  pdf.text(metadata?.name || 'Cable Planner Project', margin, margin + 4)
  pdf.setFontSize(9)
  pdf.setTextColor(80)
  pdf.text(new Date().toLocaleString(), pageWidth - margin, margin + 4, { align: 'right' })

  const offsetX = margin
  const offsetY = margin + headerHeight
  pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, drawingW, drawingH)

  if (metadata) {
    drawTitleBlock(pdf, metadata, pageWidth, pageHeight, margin)
  }

  return pdf
}
