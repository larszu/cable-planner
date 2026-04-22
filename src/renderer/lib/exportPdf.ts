import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'

export const exportCanvasToPdf = async (projectName: string) => {
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
      if (!(node instanceof HTMLElement)) {
        return true
      }
      if (node.classList.contains('react-flow__minimap')) {
        return false
      }
      if (node.classList.contains('react-flow__controls')) {
        return false
      }
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
  const availW = pageWidth - margin * 2
  const availH = pageHeight - margin * 2 - 24
  const scale = Math.min(availW / img.width, availH / img.height)
  const renderW = img.width * scale
  const renderH = img.height * scale
  const offsetX = (pageWidth - renderW) / 2
  const offsetY = margin + 24

  pdf.setFontSize(14)
  pdf.text(projectName || 'Cable Planner Project', margin, margin + 4)
  pdf.setFontSize(9)
  pdf.text(new Date().toLocaleString(), pageWidth - margin, margin + 4, { align: 'right' })

  pdf.addImage(dataUrl, 'PNG', offsetX, offsetY, renderW, renderH)
  pdf.save(`${(projectName || 'cable-planner').replace(/[^a-z0-9\-_. ]/gi, '_')}.pdf`)
}
