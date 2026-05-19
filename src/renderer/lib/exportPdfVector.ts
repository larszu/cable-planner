/**
 * v7.9.99 — Vektor-PDF-Export, robuster zweiter Versuch.
 *
 * v7.9.97 hatte html-to-image.toSvg() benutzt und produzierte leere PDFs
 * bei größeren Canvases (vermutlich foreignObject-Serialisierung nested-
 * mit-ReactFlow-Edge-SVGs unzuverlässig).
 *
 * Neuer Ansatz:
 *  1. Canvas-Element via cloneNode(true) direkt klonen — keine
 *     SVG-Serialisierung, kein foreignObject
 *  2. Alle Stylesheets aus document.styleSheets serialisieren und ins
 *     Print-HTML einbetten (funktioniert in Dev und in Prod gleichwertig
 *     weil alles via CSSOM ausgelesen wird)
 *  3. Clone in ein selbst-enthaltenes HTML-Dokument legen mit
 *     @page-CSS für die Seitengröße
 *  4. HTML an Main schicken → printToPDF in Hidden-Window
 *  5. Chromium rendert die geklonte HTML-Struktur nativ → Text bleibt
 *     Text, ReactFlow-Edge-SVGs bleiben Vektor, kein Pixel-Matsch
 *
 * Die Raster-Pipeline bleibt unverändert als Default-Pfad.
 */
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

/** Sammelt ALLE CSS-Regeln aus document.styleSheets. Funktioniert in
 *  Dev (vite-injected styles als <style>-Tags) und in Prod (gebundelte
 *  CSS in <style>-Tags). Cross-Origin-Stylesheets werden uebersprungen
 *  mit Warnung — sollte fuer uns nicht relevant sein da alles
 *  same-origin via Electron/Vite kommt. */
const collectAllCss = (): string => {
  const parts: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const rules = sheet.cssRules
      if (!rules) continue
      const segments: string[] = []
      for (const rule of Array.from(rules)) {
        segments.push(rule.cssText)
      }
      if (segments.length > 0) parts.push(segments.join('\n'))
    } catch (err) {
      console.warn(
        '[pdf-vector] Stylesheet uebersprungen (CORS?):',
        sheet.href,
        err,
      )
    }
  }
  return parts.join('\n')
}

/** Klont nur das `.react-flow`-Element — also die ReactFlow-Renderflaeche
 *  ohne den umgebenden Toolbar/Banner-Chrome. Setzt anschliessend den
 *  Viewport-Transform so um, dass das natural-size Content-Rechteck bei
 *  (0,0) sitzt. So kann das Eltern-Wrapper-Element einfach
 *  width=contentW height=contentH bekommen — alles passt rein.
 *
 *  v7.9.101: Wir klonten frueher das ganze #cable-planner-canvas (Wrapper
 *  mit CanvasToolbar/Banner) — Toolbar landete dann oben im PDF. Jetzt
 *  greifen wir das innere .react-flow. */
const cloneCanvasForPrint = (
  canvasEl: HTMLElement,
  bbox: BoundingBox,
): HTMLElement => {
  const reactFlowEl = canvasEl.querySelector('.react-flow') as HTMLElement | null
  const source = reactFlowEl ?? canvasEl
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  // Inline-Style ueberschreibt allfaellige width/height-Constraints.
  clone.style.width = `${bbox.contentW}px`
  clone.style.height = `${bbox.contentH}px`
  clone.style.position = 'relative'
  clone.style.overflow = 'hidden'

  // ReactFlow's Viewport-Transform auf Identity + Natural-Translation.
  const viewport = clone.querySelector('.react-flow__viewport') as HTMLElement | null
  if (viewport) {
    viewport.style.transform = `translate(${-bbox.contentX}px, ${-bbox.contentY}px) scale(1)`
    viewport.style.transformOrigin = '0 0'
  }

  // Edge-Path-SVG-Container auch auf natural sizen falls es das gibt.
  const edgesSvg = clone.querySelector('.react-flow__edges') as SVGElement | null
  if (edgesSvg) {
    edgesSvg.style.width = `${bbox.contentW}px`
    edgesSvg.style.height = `${bbox.contentH}px`
    edgesSvg.style.overflow = 'visible'
  }

  // UI-Chrome im Clone entfernen falls vorhanden.
  for (const sel of [
    '.react-flow__minimap',
    '.react-flow__controls',
    '.react-flow__panel',
    '.react-flow__attribution',
  ]) {
    for (const el of Array.from(clone.querySelectorAll(sel))) {
      el.remove()
    }
  }

  return clone
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
    ? `<div class="pdf-tb-logos">
        ${meta.companyLogo ? `<img src="${escapeHtml(meta.companyLogo)}" alt="" />` : '<div></div>'}
        ${meta.clientLogo ? `<img src="${escapeHtml(meta.clientLogo)}" alt="" />` : '<div></div>'}
      </div>`
    : ''
  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<div class="pdf-tb-row"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span></div>`,
    )
    .join('')
  return `<div class="pdf-tb">${logos}${rowsHtml}</div>`
}

const buildPrintHtml = (params: {
  appCss: string
  canvasOuterHtml: string
  projectName: string
  pageWidthPx: number
  pageHeightPx: number
  canvasWidthPx: number
  canvasHeightPx: number
  /** Skalierungsfaktor für den Canvas-Clone (≤1). Wird auf einen
   *  inneren Wrapper als transform: scale(...) angewendet wenn der
   *  natural-Canvas grösser ist als die kappte Page. Bleibt Vektor. */
  canvasScale: number
  /** Natural-Size des Canvas (vor Skalierung) — der Clone braucht
   *  diese Dimensionen damit Layout funktioniert; transform: scale
   *  passt's dann visuell an. */
  canvasNaturalWidth: number
  canvasNaturalHeight: number
  headerHeight: number
  margin: number
  bgFallback: string
  textColor: string
  metadata?: ProjectMetadata
  themeDark: boolean
}): string => {
  const {
    appCss,
    canvasOuterHtml,
    projectName,
    pageWidthPx,
    pageHeightPx,
    canvasWidthPx,
    canvasHeightPx,
    canvasScale,
    canvasNaturalWidth,
    canvasNaturalHeight,
    headerHeight,
    margin,
    bgFallback,
    textColor,
    metadata,
    themeDark,
  } = params
  const pageWmm = (pageWidthPx * PX_TO_MM).toFixed(3)
  const pageHmm = (pageHeightPx * PX_TO_MM).toFixed(3)
  const timestamp = new Date().toLocaleString()
  const themeAttr = themeDark ? 'dark' : 'light'
  return `<!doctype html>
<html lang="de" data-theme="${themeAttr}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(projectName || 'Cable Planner')}</title>
<style>
${appCss}
</style>
<style>
  /* Print-Page-Setup */
  @page { size: ${pageWmm}mm ${pageHmm}mm; margin: 0; }
  html, body {
    margin: 0; padding: 0;
    width: ${pageWidthPx}px; height: ${pageHeightPx}px;
    background: ${bgFallback};
    color: ${textColor};
    overflow: hidden;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .pdf-page { position: relative; width: ${pageWidthPx}px; height: ${pageHeightPx}px; }
  .pdf-header {
    position: absolute; left: ${margin}px; top: ${margin}px;
    right: ${margin}px; height: ${headerHeight}px;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .pdf-header .title { font-size: 14px; font-weight: 600; }
  .pdf-header .stamp { font-size: 9px; opacity: 0.6; }
  .pdf-canvas-wrap {
    position: absolute;
    left: ${margin}px;
    top: ${margin + headerHeight}px;
    width: ${canvasWidthPx}px;
    height: ${canvasHeightPx}px;
    overflow: hidden;
    background: ${bgFallback};
  }
  /* v7.9.102 — Inner-Wrapper macht transform: scale auf den Canvas.
     Damit kann der natural-size Clone unscaled gelayoutet werden und
     wir skalieren das Ergebnis vektoriell runter auf die Page-Groesse. */
  .pdf-canvas-inner {
    width: ${canvasNaturalWidth}px;
    height: ${canvasNaturalHeight}px;
    transform: scale(${canvasScale});
    transform-origin: 0 0;
  }
  /* Kein scrollen / kein Userinteraktion-Layout-Anpassung im Print */
  .pdf-canvas-wrap * { animation: none !important; transition: none !important; }
  /* DIN-Title-Block unten rechts */
  .pdf-tb {
    position: absolute;
    right: ${margin}px; bottom: ${margin}px;
    width: 300px;
    border: 1px solid #444;
    font-size: 8px;
    background: ${bgFallback};
    color: ${textColor};
  }
  .pdf-tb-row {
    display: flex; border-bottom: 1px solid rgba(150,150,150,0.5);
    padding: 4px 6px; line-height: 1.3;
  }
  .pdf-tb-row:last-child { border-bottom: none; }
  .pdf-tb-row .k { width: 85px; opacity: 0.6; }
  .pdf-tb-row .v { flex: 1; }
  .pdf-tb-logos {
    display: flex; gap: 8px; padding: 4px;
    border-bottom: 1px solid rgba(150,150,150,0.5);
    align-items: center; justify-content: space-around;
    min-height: 36px;
  }
  .pdf-tb-logos img { max-height: 32px; max-width: 140px; object-fit: contain; }
</style>
</head>
<body>
<div class="pdf-page">
  <div class="pdf-header">
    <div class="title">${escapeHtml(projectName || 'Cable Planner Project')}</div>
    <div class="stamp">${escapeHtml(timestamp)}</div>
  </div>
  <div class="pdf-canvas-wrap">
    <div class="pdf-canvas-inner">
      ${canvasOuterHtml}
    </div>
  </div>
  ${metadata ? renderTitleBlock(metadata) : ''}
</div>
</body>
</html>`
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

  const canvasEl = document.getElementById('cable-planner-canvas') as HTMLElement | null
  if (!canvasEl) throw new Error('Canvas nicht gefunden')
  const viewportEl = canvasEl.querySelector('.react-flow__viewport') as HTMLElement | null
  if (!viewportEl) throw new Error('ReactFlow-Viewport nicht gefunden')

  onProgress('measure', 'Inhalt vermessen…')
  const bbox = computeNaturalBbox(viewportEl)

  const themeDark = options?.backgroundTheme !== 'light'
  const composed = composeExportBackground({
    theme: options?.backgroundTheme ?? 'dark',
    variant: options?.bgVariant ?? 'dots',
    gridSize: options?.gridSize ?? 20,
    opacity: options?.bgOpacity ?? 0.5,
    customPalette: options?.customPalette ?? null,
  })
  const bgFallback = composed.bgFallback
  const textColor = themeDark ? '#e2e8f0' : '#0f172a'

  onProgress('capture', 'Canvas-DOM klonen…')
  const canvasClone = cloneCanvasForPrint(canvasEl, bbox)
  const canvasOuterHtml = canvasClone.outerHTML
  if (canvasOuterHtml.length < 1000) {
    throw new Error(
      `Canvas-Clone ist verdaechtig klein (${canvasOuterHtml.length} bytes) — Export abgebrochen.`,
    )
  }

  onProgress('styles', 'Stylesheets sammeln…')
  const appCss = collectAllCss()
  if (appCss.length < 1000) {
    console.warn(
      `[pdf-vector] Wenig CSS gesammelt (${appCss.length} bytes) — moeglicherweise CORS-blockiert.`,
    )
  }

  const margin = 24
  const headerHeight = 28
  const titleBlockReserve = metadata ? 12 : 0

  // v7.9.102 — Page-Size auf A0-Landscape kappen (1189×841 mm). Viele
  // PDF-Viewer (Preview.app, Acrobat) weigern sich, Pages > A0 zu
  // rendern → zeigen weisse Flaeche. Wir scalen den Canvas-Clone
  // vektoriell runter (transform: scale) wenn er groesser ist. Bleibt
  // Vektor, Zoom in der PDF bleibt crisp. Standard-Workflow: Canvas
  // ist kleiner → scale=1 → keine Aenderung.
  const A0_LANDSCAPE_W_MM = 1189
  const A0_LANDSCAPE_H_MM = 841
  const MAX_CANVAS_W_PX = A0_LANDSCAPE_W_MM / PX_TO_MM - margin * 2
  const MAX_CANVAS_H_PX =
    A0_LANDSCAPE_H_MM / PX_TO_MM - margin * 2 - headerHeight - titleBlockReserve
  const canvasScale = Math.min(
    1,
    MAX_CANVAS_W_PX / bbox.contentW,
    MAX_CANVAS_H_PX / bbox.contentH,
  )
  const displayedCanvasWidth = Math.ceil(bbox.contentW * canvasScale)
  const displayedCanvasHeight = Math.ceil(bbox.contentH * canvasScale)
  const pageWidthPx = displayedCanvasWidth + margin * 2
  const pageHeightPx =
    displayedCanvasHeight + margin * 2 + headerHeight + titleBlockReserve

  onProgress(
    'compose',
    `Print-HTML bauen (${Math.round((appCss.length + canvasOuterHtml.length) / 1024)} KB, scale ${(canvasScale * 100).toFixed(0)}%)…`,
  )
  const html = buildPrintHtml({
    appCss,
    canvasOuterHtml,
    projectName,
    pageWidthPx,
    pageHeightPx,
    canvasWidthPx: displayedCanvasWidth,
    canvasHeightPx: displayedCanvasHeight,
    canvasScale,
    canvasNaturalWidth: bbox.contentW,
    canvasNaturalHeight: bbox.contentH,
    headerHeight,
    margin,
    bgFallback,
    textColor,
    metadata,
    themeDark,
  })

  onProgress('render', 'Chromium printToPDF…')
  const widthMicrons = Math.round(pageWidthPx * PX_TO_MICRONS)
  const heightMicrons = Math.round(pageHeightPx * PX_TO_MICRONS)
  const bytes = await handler({ html, widthMicrons, heightMicrons })

  onProgress('save', 'Datei speichern…')
  if (!bytes || bytes.byteLength < 1000) {
    throw new Error(
      `printToPDF lieferte verdaechtig wenig zurueck (${bytes?.byteLength ?? 0} bytes).`,
    )
  }
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
