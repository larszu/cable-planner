// PNG / JPEG export of the canvas, parallel to exportPdf.ts.
//
// We deliberately reuse the geometry-computation logic from exportPdf
// (computeContentBox) rather than re-implementing it inline — the bbox
// math has subtle edge cases around edge-label translates and SVG
// getBBox() returning untransformed flow coordinates that we don't
// want to maintain in two places. The capture is done with html-to-image
// directly so the output skips jsPDF entirely.

import { toJpeg, toPng, toSvg } from 'html-to-image'
import { composeExportBackground, type ExportBgVariant } from './exportBackground'
import { buildExportFilename } from './exportFilename'
import type { ProjectMetadata } from '../types/project'

export type ImageExportFormat = 'png' | 'jpeg' | 'svg'

export interface ImageExportBackgroundOptions {
  /** Canvas grid variant. Defaults to 'dots'. */
  bgVariant?: ExportBgVariant
  gridSize?: number
  bgOpacity?: number
  customPalette?: { canvasBg: string; gridColor: string } | null
}

interface ContentBox {
  contentX: number
  contentY: number
  contentW: number
  contentH: number
}

/** Walks the React Flow viewport children to find the smallest rectangle
 *  that encloses every node, every edge path, and every edge label, then
 *  pads it so labels near the border aren't clipped. Mirrors the same
 *  math exportCanvasToPdf uses so PNG/JPEG/PDF outputs share the framing. */
const computeContentBox = (viewportEl: HTMLElement): ContentBox => {
  const nodeEls = Array.from(viewportEl.querySelectorAll<HTMLElement>('.react-flow__node'))
  const parseTranslate = (el: HTMLElement | SVGGraphicsElement): { x: number; y: number } => {
    const transform = el instanceof HTMLElement
      ? getComputedStyle(el).transform
      : el.getAttribute('transform') ?? ''
    if (transform && transform !== 'none') {
      const match = /matrix.*\((.+)\)/.exec(transform)
      if (match) {
        const parts = match[1].split(',').map((value) => parseFloat(value.trim()))
        if (parts.length === 6) return { x: parts[4], y: parts[5] }
        if (parts.length === 16) return { x: parts[12], y: parts[13] }
      }
      const translateMatch = /translate\(\s*([-\d.]+)(?:px)?\s*,\s*([-\d.]+)(?:px)?\s*\)/.exec(transform)
      if (translateMatch) {
        return { x: parseFloat(translateMatch[1]), y: parseFloat(translateMatch[2]) }
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
      if (bb.x < minX) minX = bb.x
      if (bb.y < minY) minY = bb.y
      if (bb.x + bb.width > maxX) maxX = bb.x + bb.width
      if (bb.y + bb.height > maxY) maxY = bb.y + bb.height
    } catch {
      // getBBox throws on detached or zero-size SVG elements — ignore.
    }
  }

  const edgeLabelEls = Array.from(
    viewportEl.querySelectorAll<HTMLElement>('.react-flow__edge-textwrapper, .react-flow__edge-label'),
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

  // v7.7.1 — generous padding so the exported image shows plenty of
  // background pattern around the content. Mirrors exportPdf.ts.
  const padding = 200
  return {
    contentX: minX - padding,
    contentY: minY - padding,
    contentW: Math.ceil(maxX - minX + padding * 2),
    contentH: Math.ceil(maxY - minY + padding * 2),
  }
}

/** Hoehe des Schriftfelds unterhalb des Plans (inkl. Abstand). */
const FOOTER_BAND = 190
const FOOTER_W = 320

const esc = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Schriftfeld unten rechts, dieselben Angaben wie der Titelblock des PDF.
 *  Leere Felder entfallen — ein Bild braucht keine Zeile voller Striche. */
const buildFooter = (
  meta: ProjectMetadata,
  theme: 'dark' | 'light',
  left: number,
  top: number,
): HTMLElement => {
  const fmt = (iso?: string) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }
  const rows: [string, string | undefined][] = [
    ['Projekt', meta.name],
    ['Projekt-Nr.', meta.projectNumber],
    ['Kunde', meta.client],
    ['Auftragnehmer', meta.contractor],
    ['Planer', meta.author],
    ['Erstellt', fmt(meta.createdAt)],
    ['Geändert', fmt(meta.updatedAt)],
    ['Revision', meta.revision],
  ]
  const fg = theme === 'light' ? '#0f172a' : '#e2e8f0'
  const muted = theme === 'light' ? '#64748b' : '#94a3b8'
  const line = theme === 'light' ? '#94a3b8' : '#475569'
  const el = document.createElement('div')
  el.setAttribute('data-export-footer', '1')
  el.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${FOOTER_W}px;` +
    `border:1px solid ${line};font:12px/1.5 system-ui,sans-serif;color:${fg};pointer-events:none;`
  el.innerHTML = rows
    .filter(([, v]) => !!v)
    .map(
      ([k, v]) =>
        `<div style="display:flex;gap:8px;padding:1px 8px;border-bottom:1px solid ${line}">` +
        `<span style="width:96px;flex:none;color:${muted}">${esc(k)}</span>` +
        `<span style="min-width:0;overflow-wrap:anywhere">${esc(v as string)}</span></div>`,
    )
    .join('')
  return el
}

const captureViewport = async (
  format: ImageExportFormat,
  backgroundTheme: 'dark' | 'light',
  pixelRatio: number,
  jpegQuality: number,
  bgOptions: ImageExportBackgroundOptions,
  metadata?: ProjectMetadata,
): Promise<string> => {
  const viewportEl =
    (document.querySelector('.react-flow__viewport') as HTMLElement | null) ?? null
  if (!viewportEl) throw new Error('React Flow viewport nicht gefunden')

  const box = computeContentBox(viewportEl)
  const { contentX, contentY, contentW } = box
  // Das Schriftfeld bekommt ein eigenes Band unter dem Plan, damit es nie
  // auf Geraeten oder Kabeln liegt.
  const contentH = box.contentH + (metadata ? FOOTER_BAND : 0)

  const composed = composeExportBackground({
    theme: backgroundTheme,
    variant: bgOptions.bgVariant ?? 'dots',
    gridSize: bgOptions.gridSize ?? 20,
    opacity: bgOptions.bgOpacity ?? 0.5,
    customPalette: bgOptions.customPalette ?? null,
  })

  // Ursache von #995: Hintergrund und Raster hingen am Stil des Viewport-
  // Elements selbst. Das ist ein Kasten ab Flow-Ursprung (0,0); er wird per
  // translate(-contentX, -contentY) verschoben und deckte darum nur einen Teil
  // des Bildes — oben/links blieb leer, unten und rechts brach das Raster ab.
  // Jetzt liegt eine eigene Hintergrundflaeche genau auf dem Bildausschnitt
  // (ein Kind des Viewports, wandert mit der Verschiebung mit); das Raster
  // reicht dadurch lueckenlos bis an alle vier Raender.
  const bgEl = document.createElement('div')
  bgEl.setAttribute('data-export-bg', '1')
  bgEl.style.cssText =
    `position:absolute;left:${contentX}px;top:${contentY}px;width:${contentW}px;height:${contentH}px;` +
    `z-index:-1;pointer-events:none;background:${composed.background};` +
    `background-size:${composed.backgroundSize};background-repeat:${composed.backgroundRepeat};` +
    `background-position:${-contentX}px ${-contentY}px, 0 0;background-color:${composed.bgFallback};`
  viewportEl.insertBefore(bgEl, viewportEl.firstChild)
  const extras: HTMLElement[] = [bgEl]
  if (metadata) {
    const footer = buildFooter(
      metadata,
      backgroundTheme,
      contentX + contentW - FOOTER_W - 24,
      contentY + contentH - FOOTER_BAND + 12,
    )
    viewportEl.appendChild(footer)
    extras.push(footer)
  }

  const captureOptions = {
    backgroundColor: composed.bgFallback,
    pixelRatio,
    cacheBust: true,
    width: contentW,
    height: contentH,
    style: {
      width: `${contentW}px`,
      height: `${contentH}px`,
      transform: `translate(${-contentX}px, ${-contentY}px)`,
      transformOrigin: '0 0',
    },
    filter: (node: HTMLElement | Element) => {
      if (!(node instanceof HTMLElement)) return true
      if (node.classList.contains('react-flow__minimap')) return false
      if (node.classList.contains('react-flow__controls')) return false
      return true
    },
  }

  // Kabelpfade sind offene Linien. html-to-image uebernimmt die berechnete
  // `fill:none` des React-Flow-Stylesheets nicht immer und fuellt sonst die
  // Flaeche zwischen Anfang und Ende schwarz.
  const edgePaths = Array.from(
    viewportEl.querySelectorAll<SVGPathElement>('.react-flow__edge path, .react-flow__connection-path'),
  )
  const oldFills = edgePaths.map((p) => p.style.fill)
  for (const p of edgePaths) p.style.fill = 'none'

  try {
    return format === 'svg'
      ? await toSvg(viewportEl, captureOptions)
      : format === 'png'
        ? await toPng(viewportEl, captureOptions)
        : await toJpeg(viewportEl, { ...captureOptions, quality: jpegQuality })
  } finally {
    for (const el of extras) el.remove()
    edgePaths.forEach((p, i) => {
      p.style.fill = oldFills[i]
    })
  }
}

const triggerDownload = (dataUrl: string, fileName: string) => {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

/** Public entry — capture the canvas and save it as PNG or JPEG. Matches
 *  the same framing the PDF export uses, but writes a single image with
 *  no header / metadata block. */
export const exportCanvasToImage = async (
  projectName: string,
  format: ImageExportFormat,
  options?: {
    backgroundTheme?: 'dark' | 'light'
    pixelRatio?: number
    jpegQuality?: number
    /** Projektdaten fuer das Schriftfeld unten rechts (wie im PDF). */
    metadata?: ProjectMetadata
  } & ImageExportBackgroundOptions,
): Promise<void> => {
  const dataUrl = await captureViewport(
    format,
    options?.backgroundTheme ?? 'dark',
    options?.pixelRatio ?? 2,
    options?.jpegQuality ?? 0.92,
    {
      bgVariant: options?.bgVariant,
      gridSize: options?.gridSize,
      bgOpacity: options?.bgOpacity,
      customPalette: options?.customPalette,
    },
    options?.metadata,
  )
  // v7.9.116 — Einheitlicher Stempel: YYYYMMDD_<name>_NNN.{png|jpg}
  triggerDownload(dataUrl, buildExportFilename(projectName, format === 'png' ? 'png' : format === 'svg' ? 'svg' : 'jpg'))
}
