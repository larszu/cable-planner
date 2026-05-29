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

const captureViewport = async (
  format: ImageExportFormat,
  backgroundTheme: 'dark' | 'light',
  pixelRatio: number,
  jpegQuality: number,
  bgOptions: ImageExportBackgroundOptions,
): Promise<string> => {
  const viewportEl =
    (document.querySelector('.react-flow__viewport') as HTMLElement | null) ?? null
  if (!viewportEl) throw new Error('React Flow viewport nicht gefunden')

  const { contentX, contentY, contentW, contentH } = computeContentBox(viewportEl)

  const composed = composeExportBackground({
    theme: backgroundTheme,
    variant: bgOptions.bgVariant ?? 'dots',
    gridSize: bgOptions.gridSize ?? 20,
    opacity: bgOptions.bgOpacity ?? 0.5,
    customPalette: bgOptions.customPalette ?? null,
  })

  const captureOptions = {
    backgroundColor: composed.bgFallback,
    pixelRatio,
    cacheBust: true,
    width: contentW,
    height: contentH,
    style: {
      width: `${contentW}px`,
      height: `${contentH}px`,
      background: composed.background,
      backgroundSize: composed.backgroundSize,
      backgroundRepeat: composed.backgroundRepeat,
      backgroundColor: composed.bgFallback,
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

  return format === 'svg'
    ? toSvg(viewportEl, captureOptions)
    : format === 'png'
      ? toPng(viewportEl, captureOptions)
      : toJpeg(viewportEl, { ...captureOptions, quality: jpegQuality })
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
  )
  // v7.9.116 — Einheitlicher Stempel: YYYYMMDD_<name>_NNN.{png|jpg}
  triggerDownload(dataUrl, buildExportFilename(projectName, format === 'png' ? 'png' : format === 'svg' ? 'svg' : 'jpg'))
}
