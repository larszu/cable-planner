/**
 * v7.9.97 — Vektor-PDF-Export (Beta).
 *
 * Alternative zur klassischen Raster-Pipeline in exportPdf.ts. Statt
 * das Canvas zu rastern → JPEG → jsPDF.addImage, serialisieren wir es
 * via html-to-image.toSvg() als SVG mit foreignObject und lassen
 * Electrons webContents.printToPDF() das PDF erzeugen.
 *
 * Vorteile:
 *  - Text bleibt echter Text im PDF (selektier-/suchbar)
 *  - SVG-Pfade bleiben Vektor (ReactFlow-Edges sind eh SVG)
 *  - Beim Zoom kein Pixel-Matsch
 *  - Datei-Größe typisch 1-3 MB statt 5-10 MB (kein JPEG-Embedding)
 *
 * Nachteile / Caveats:
 *  - Nur in Electron-Builds verfügbar (braucht main-process printToPDF)
 *  - foreignObject mit komplexem CSS kann theoretisch andere Resultate
 *    geben — Chromium rendert sie aber gleich wie im Live-Canvas
 *  - Erstaufruf ist langsamer (~1-2 s Hidden-Window-Boot)
 *
 * Die Raster-Pipeline bleibt unverändert als Fallback bestehen.
 */
import { toSvg } from 'html-to-image'
import type { ProjectMetadata } from '../types/project'
import { composeExportBackground, type ExportBgVariant } from './exportBackground'

export interface ExportPdfVectorOptions {
  backgroundTheme?: 'dark' | 'light'
  bgVariant?: ExportBgVariant
  gridSize?: number
  bgOpacity?: number
  customPalette?: { canvasBg: string; gridColor: string } | null
  onProgress?: (phase: string, detail?: string) => void
}

interface CablePlannerPrintApi {
  canvasPdfVector?: (params: {
    html: string
    widthMicrons: number
    heightMicrons: number
  }) => Promise<Uint8Array>
}

interface CablePlannerWindow {
  cablePlanner?: { print?: CablePlannerPrintApi }
}

// 96 DPI: 1 CSS-px = 1/96 inch = 25400/96 = 264.5833 microns
const PX_TO_MICRONS = 25400 / 96
// 1 CSS-px ≈ 0.264583 mm
const PX_TO_MM = 25.4 / 96

const fmtDate = (iso?: string): string => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

interface BoundingBox {
  contentX: number
  contentY: number
  contentW: number
  contentH: number
}

/** Misst die Bounding-Box aller Nodes + Edges + Edge-Labels im
 *  ReactFlow-Viewport. Selbe Logik wie in exportPdf.ts — duplikat ist
 *  bewusst, damit der Vektor-Pfad isoliert testbar bleibt und ein
 *  Refactor am Raster-Pfad nicht versehentlich diesen hier bricht. */
const computeNaturalBbox = (viewportEl: HTMLElement): BoundingBox => {
  const nodeEls = Array.from(
    viewportEl.querySelectorAll<HTMLElement>('.react-flow__node'),
  )
  if (nodeEls.length === 0) {
    throw new Error('Keine Geräte zum Exportieren vorhanden')
  }
  const parseTranslate = (el: HTMLElement): { x: number; y: number } => {
    const transform = getComputedStyle(el).transform
    if (transform && transform !== 'none') {
      const match = /matrix.*\((.+)\)/.exec(transform)
      if (match) {
        const parts = match[1].split(',').map((v) => parseFloat(v.trim()))
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
  const edgePathEls = viewportEl.querySelectorAll<SVGGraphicsElement>(
    '.react-flow__edge .react-flow__edge-path, .react-flow__edge path',
  )
  for (const path of edgePathEls) {
    try {
      const bb = path.getBBox()
      if (bb.width === 0 && bb.height === 0) continue
      if (bb.x < minX) minX = bb.x
      if (bb.y < minY) minY = bb.y
      if (bb.x + bb.width > maxX) maxX = bb.x + bb.width
      if (bb.y + bb.height > maxY) maxY = bb.y + bb.height
    } catch {
      // ignore zero-size paths
    }
  }
  const edgeLabelEls = Array.from(
    viewportEl.querySelectorAll<HTMLElement>(
      '.react-flow__edge-textwrapper, .react-flow__edge-label',
    ),
  )
  for (const label of edgeLabelEls) {
    const { x, y } = parseTranslate(label)
    const w = label.offsetWidth
    const h = label.offsetHeight
    const lx = x - w / 2
    const ly = y - h / 2
    if (lx < minX) minX = lx
    if (ly < minY) minY = ly
    if (lx + w > maxX) maxX = lx + w
    if (ly + h > maxY) maxY = ly + h
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    throw new Error('Konnte den Inhalt des Canvas nicht vermessen')
  }
  const padding = 200
  return {
    contentX: minX - padding,
    contentY: minY - padding,
    contentW: Math.ceil(maxX - minX + padding * 2),
    contentH: Math.ceil(maxY - minY + padding * 2),
  }
}

/** Decode a `data:image/svg+xml;...` URL back to its raw SVG markup. */
const decodeSvgDataUrl = (dataUrl: string): string => {
  const idx = dataUrl.indexOf(',')
  if (idx < 0) throw new Error('Ungültige SVG-Data-URL')
  const head = dataUrl.slice(0, idx)
  const body = dataUrl.slice(idx + 1)
  if (head.includes(';base64')) {
    return atob(body)
  }
  // URL-encoded (html-to-image's default for toSvg)
  return decodeURIComponent(body)
}

/** Filter for html-to-image: skip overlay/UI-only elements that
 *  shouldn't be in the export. */
const baseFilter = (node: Node): boolean => {
  if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) return true
  const el = node as HTMLElement | SVGElement
  if (el.classList.contains('react-flow__minimap')) return false
  if (el.classList.contains('react-flow__controls')) return false
  if (el.classList.contains('react-flow__background')) return false
  return true
}

const renderTitleBlock = (meta: ProjectMetadata): string => {
  const rows: [string, string][] = [
    ['Projekt', meta.name || '—'],
    ['Projekt-Nr.', meta.projectNumber || '—'],
    ['Kunde', meta.client || '—'],
    ['Auftragnehmer', meta.contractor || '—'],
    ['Planer', meta.author || '—'],
    ['Erstellt', fmtDate(meta.createdAt)],
    ['Geändert', fmtDate(meta.updatedAt)],
  ]
  const hasLogos = !!(meta.companyLogo || meta.clientLogo)
  const logos = hasLogos
    ? `<div class="title-block-logos">
        ${meta.companyLogo ? `<img src="${escapeHtml(meta.companyLogo)}" alt="" />` : '<div></div>'}
        ${meta.clientLogo ? `<img src="${escapeHtml(meta.clientLogo)}" alt="" />` : '<div></div>'}
      </div>`
    : ''
  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<div class="title-block-row"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span></div>`,
    )
    .join('')
  return `<div class="title-block">${logos}${rowsHtml}</div>`
}

const buildPrintHtml = (params: {
  svg: string
  projectName: string
  pageWidthPx: number
  pageHeightPx: number
  canvasWidthPx: number
  canvasHeightPx: number
  headerHeight: number
  margin: number
  bgFallback: string
  textColor: string
  metadata?: ProjectMetadata
}): string => {
  const {
    svg,
    projectName,
    pageWidthPx,
    pageHeightPx,
    canvasWidthPx,
    canvasHeightPx,
    headerHeight,
    margin,
    bgFallback,
    textColor,
    metadata,
  } = params
  const pageWmm = (pageWidthPx * PX_TO_MM).toFixed(3)
  const pageHmm = (pageHeightPx * PX_TO_MM).toFixed(3)
  const timestamp = new Date().toLocaleString()
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<style>
  @page { size: ${pageWmm}mm ${pageHmm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${pageWidthPx}px;
    height: ${pageHeightPx}px;
    background: ${bgFallback};
    color: ${textColor};
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    position: relative;
    width: ${pageWidthPx}px;
    height: ${pageHeightPx}px;
    box-sizing: border-box;
    padding: ${margin}px;
  }
  .header { display: flex; justify-content: space-between; align-items: baseline; }
  .header .title { font-size: 14px; font-weight: 600; }
  .header .stamp { font-size: 9px; color: ${textColor === '#000' ? '#555' : '#94a3b8'}; }
  .canvas-wrap {
    position: absolute;
    left: ${margin}px;
    top: ${margin + headerHeight}px;
    width: ${canvasWidthPx}px;
    height: ${canvasHeightPx}px;
    overflow: hidden;
  }
  .canvas-wrap > svg { width: 100%; height: 100%; display: block; }
  .title-block {
    position: absolute;
    right: ${margin}px;
    bottom: ${margin}px;
    width: 300px;
    border: 1px solid #444;
    font-size: 8px;
    background: ${bgFallback};
  }
  .title-block-row {
    display: flex;
    border-bottom: 1px solid #aaa;
    padding: 4px 6px;
    line-height: 1.3;
  }
  .title-block-row:last-child { border-bottom: none; }
  .title-block-row .k { width: 85px; color: ${textColor === '#000' ? '#555' : '#64748b'}; }
  .title-block-row .v { flex: 1; }
  .title-block-logos {
    display: flex;
    gap: 8px;
    padding: 4px;
    border-bottom: 1px solid #aaa;
    align-items: center;
    justify-content: space-around;
    min-height: 36px;
  }
  .title-block-logos img {
    max-height: 32px;
    max-width: 140px;
    object-fit: contain;
  }
</style>
</head><body>
<div class="page">
  <div class="header">
    <div class="title">${escapeHtml(projectName || 'Cable Planner Project')}</div>
    <div class="stamp">${escapeHtml(timestamp)}</div>
  </div>
  <div class="canvas-wrap">${svg}</div>
  ${metadata ? renderTitleBlock(metadata) : ''}
</div>
</body></html>`
}

export const exportCanvasToPdfVector = async (
  projectName: string,
  metadata?: ProjectMetadata,
  options?: ExportPdfVectorOptions,
): Promise<void> => {
  const w = window as unknown as CablePlannerWindow
  const handler = w.cablePlanner?.print?.canvasPdfVector
  if (!handler) {
    throw new Error(
      'Vektor-PDF braucht den Electron-Hauptprozess. In Browser-/Mobile-Build nicht verfügbar.',
    )
  }
  const onProgress = options?.onProgress ?? (() => {})

  const canvasEl = document.getElementById('cable-planner-canvas')
  if (!canvasEl) throw new Error('Canvas nicht gefunden')
  const viewportEl = canvasEl.querySelector('.react-flow__viewport') as HTMLElement | null
  if (!viewportEl) throw new Error('ReactFlow-Viewport nicht gefunden')

  onProgress('measure', 'Inhalt vermessen…')
  const bbox = computeNaturalBbox(viewportEl)
  const { contentX, contentY, contentW, contentH } = bbox

  const composed = composeExportBackground({
    theme: options?.backgroundTheme ?? 'dark',
    variant: options?.bgVariant ?? 'dots',
    gridSize: options?.gridSize ?? 20,
    opacity: options?.bgOpacity ?? 0.5,
    customPalette: options?.customPalette ?? null,
  })
  const bgFallback = composed.bgFallback
  const textColor = options?.backgroundTheme === 'light' ? '#000' : '#fff'

  onProgress('capture', `Canvas ${contentW}×${contentH}px als SVG serialisieren…`)
  // toSvg liefert eine data:image/svg+xml;... URL. Wir dekodieren sie und
  // betten das rohe SVG ins Print-HTML ein.
  const svgDataUrl = await toSvg(viewportEl, {
    width: contentW,
    height: contentH,
    cacheBust: true,
    backgroundColor: bgFallback,
    style: {
      width: `${contentW}px`,
      height: `${contentH}px`,
      background: bgFallback,
      backgroundColor: bgFallback,
      transform: `translate(${-contentX}px, ${-contentY}px)`,
      transformOrigin: '0 0',
    },
    filter: baseFilter,
  })
  const svg = decodeSvgDataUrl(svgDataUrl)

  // Page-Layout: identisch zum Raster-Pfad, damit Header/Title-Block
  // stehen wo Nutzer es gewohnt sind.
  const margin = 24
  const headerHeight = 28
  const titleBlockReserve = metadata ? 12 : 0
  const pageWidthPx = contentW + margin * 2
  const pageHeightPx = contentH + margin * 2 + headerHeight + titleBlockReserve

  const html = buildPrintHtml({
    svg,
    projectName,
    pageWidthPx,
    pageHeightPx,
    canvasWidthPx: contentW,
    canvasHeightPx: contentH,
    headerHeight,
    margin,
    bgFallback,
    textColor,
    metadata,
  })

  onProgress('render', 'Chromium printToPDF…')
  const widthMicrons = Math.round(pageWidthPx * PX_TO_MICRONS)
  const heightMicrons = Math.round(pageHeightPx * PX_TO_MICRONS)
  const bytes = await handler({ html, widthMicrons, heightMicrons })

  onProgress('save', 'Datei speichern…')
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(projectName || 'cable-planner').replace(/[^a-z0-9\-_. ]/gi, '_')}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  onProgress('done', 'Fertig.')
}
