import { toJpeg, toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import type { ProjectMetadata } from '../types/project'
import { composeExportBackground, type ExportBgVariant } from './exportBackground'
import { pdfText } from './pdfHelpers'
import { hexToRgb, drawVectorBackground } from './pdfBackground'
import { buildExportFilename } from './exportFilename'
import { translate } from './i18n'
import { useUiStore } from '../store/uiStore'

// Helper: aus composed-Background-Optionen den Grid-Hex extrahieren.
// composeExportBackground hat keinen public `gridColor` Output (nur
// CSS-zusammengebaut), daher rekonstruieren wir hier den Wert via
// derselben Default-Logik wie in exportBackground.ts.
const extractGridColor = (
  _composed: unknown,
  options?: { backgroundTheme?: 'dark' | 'light'; customPalette?: { gridColor: string } | null },
): string => {
  if (options?.customPalette?.gridColor) return options.customPalette.gridColor
  return (options?.backgroundTheme ?? 'dark') === 'light' ? '#94a3b8' : '#64748b'
}
// hexToRgb only used by pdfBackground — import here to avoid bundling twice
void hexToRgb

export interface ExportPdfOptions {
  backgroundTheme?: 'dark' | 'light'
  /** v7.7.1 — Canvas grid variant from the UI store. Defaults to 'dots'. */
  bgVariant?: ExportBgVariant
  /** Grid step in CSS pixels (UI default = 10). */
  gridSize?: number
  /** Pattern opacity 0..1 (UI default = 0.5). */
  bgOpacity?: number
  /** Custom palette overrides from Settings → Canvas-Hintergrund. */
  customPalette?: { canvasBg: string; gridColor: string } | null
  /** v7.9.61 — Optional Progress-Callback. Wird mit ('start'|'capture'|
   *  'tile'|'render'|'done', detail?) gerufen damit das UI Fortschritts-
   *  Indikatoren zeigen kann. */
  onProgress?: (phase: string, detail?: string) => void
}

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
    // #412 — Revisions-Stempel (nur wenn eine Revision festgeschrieben ist).
    ...(meta.revision ? ([['Revision', meta.revision]] as [string, string][]) : []),
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
    pdfText(pdf, label, x + 4, rowY + 10)
    pdf.setTextColor(15)
    pdfText(pdf, value ?? '-', x + 85, rowY + 10, { maxWidth: boxW - 90 })
    pdf.line(x, rowY + rowH, x + boxW, rowY + rowH)
    rowY += rowH
  }

  return boxH
}

export const exportCanvasToPdf = async (
  projectName: string,
  metadata?: ProjectMetadata,
  quality = 0.85,
  options?: ExportPdfOptions,
) => {
  const pdf = await buildCanvasPdf(metadata, quality, options)
  // v7.9.116 — Einheitlicher Filename-Stempel: YYYYMMDD_<name>_NNN.pdf
  pdf.save(buildExportFilename(projectName, 'pdf'))
}

/**
 * Same as `exportCanvasToPdf` but returns the generated PDF as a `Uint8Array`
 * instead of triggering a download. Used to upload the PDF to external systems
 * (e.g. attach it to a Rentman project).
 */
export const exportCanvasToPdfBytes = async (
  metadata?: ProjectMetadata,
  quality = 0.85,
  options?: ExportPdfOptions,
): Promise<Uint8Array> => {
  const pdf = await buildCanvasPdf(metadata, quality, options)
  // jsPDF returns an ArrayBuffer when format is 'arraybuffer'.
  const buffer = pdf.output('arraybuffer') as ArrayBuffer
  return new Uint8Array(buffer)
}

const buildCanvasPdf = async (
  metadata?: ProjectMetadata,
  quality = 0.85,
  options?: ExportPdfOptions,
): Promise<jsPDF> => {
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
    throw new Error(
      translate(
        useUiStore.getState().language,
        'export.pdf.errNoDevices',
        'Keine Geräte zum Exportieren vorhanden',
      ),
    )
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

  // Also include every edge path (cables) and edge label so cables that
  // travel outside the node bounding box — e.g. with manually placed
  // waypoints or wireless edges that loop around — are guaranteed to fit
  // inside the exported page.
  //
  // Edge SVG paths use flow coordinates (the parent viewport transform sets
  // the on-screen scale, so `getBBox()` returns untransformed flow-space
  // values regardless of the user's current zoom).
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
      // getBBox throws on detached/zero-size elements — ignore.
    }
  }

  // Edge labels are absolutely positioned via translate() in flow-space.
  const edgeLabelEls = Array.from(
    viewportEl.querySelectorAll<HTMLElement>('.react-flow__edge-textwrapper, .react-flow__edge-label'),
  )
  for (const label of edgeLabelEls) {
    const { x, y } = parseTranslate(label)
    const w = label.offsetWidth
    const h = label.offsetHeight
    // Labels are typically centered on (x, y) — extend by half each direction.
    const lx = x - w / 2
    const ly = y - h / 2
    if (lx < minX) minX = lx
    if (ly < minY) minY = ly
    if (lx + w > maxX) maxX = lx + w
    if (ly + h > maxY) maxY = ly + h
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    throw new Error(
      translate(
        useUiStore.getState().language,
        'export.errMeasureCanvas',
        'Konnte den Inhalt des Canvas nicht vermessen',
      ),
    )
  }

  // v7.7.1 — padding bumped to 200 px so the exported file shows
  // generous margin AROUND the content, making the grid pattern look
  // like an extension of the live canvas instead of a tight crop.
  const padding = 200
  const contentX = minX - padding
  const contentY = minY - padding
  const contentW = Math.ceil(maxX - minX + padding * 2)
  const contentH = Math.ceil(maxY - minY + padding * 2)

  // Capture the viewport at scale 1, translated so the content's top-left
  // sits at (0, 0). html-to-image's `width`/`height` clip the output to the
  // requested rectangle and `style` overrides the captured element's style
  // during capture (does not mutate the live DOM).
  //
  // Background must match the live canvas — including the user's current
  // bgVariant / gridSize / opacity / palette settings. Compose via the
  // shared helper so PNG / JPEG / PDF all stay in sync.
  const composed = composeExportBackground({
    theme: options?.backgroundTheme ?? 'dark',
    variant: options?.bgVariant ?? 'dots',
    gridSize: options?.gridSize ?? 20,
    opacity: options?.bgOpacity ?? 0.5,
    customPalette: options?.customPalette ?? null,
  })

  // v7.9.62 — Drei orthogonale Hebel um die PDF schnell + scharf zu kriegen:
  //
  // 1. CAPTURE: Single-Shot bei dynamischem Ratio (Budget 25 MP). 91-MP-
  //    Plan → ratio ≈ 0.52 → 25 MP captured. v7.9.61 hatte 16 MP =
  //    verpixelt; v7.9.62-erstversuch hatte 50 MP = jsPDF hängte.
  //    25 MP ist der Süßpunkt: scharf genug, jsPDF überlebt's.
  //
  // 2. KOMPRESSION: JPEG @ 0.75 + jsPDF compress=true. Output bleibt
  //    klein (~5-10 MB für unseren Test-Plan) ohne sichtbaren Verlust.
  //
  // 3. YIELD: vor und nach jsPDF.addImage einen Microtask-Tick einlegen
  //    damit der Browser den Progress-Overlay updaten kann (UI wirkt
  //    nicht eingefroren). yieldToBrowser() unten.
  const onProgress = options?.onProgress ?? (() => {})
  const SINGLE_SHOT_BUDGET_MP = 25_000_000
  const naturalPixels = contentW * contentH
  const singleShotRatio = Math.min(
    1.5,
    Math.max(0.4, Math.sqrt(SINGLE_SHOT_BUDGET_MP / naturalPixels)),
  )
  // JPEG immer wenn capture > 4 MP — bei dem Datenvolumen wird jsPDF
  // sonst rasend langsam (PNG-embedding-Pfad). PNG nur für mini-Pläne.
  const useJpeg = naturalPixels * singleShotRatio * singleShotRatio > 4_000_000
  const capture = useJpeg ? toJpeg : toPng
  const jpegQuality = useJpeg ? Math.min(quality, 0.75) : quality
  // Microtask-yield damit der Browser zwischen den Heavy-Steps der UI
  // Zeit gibt das Progress-Overlay zu updaten. Ohne sieht der User
  // einen eingefrorenen Screen für 10+ Sekunden.
  const yieldToBrowser = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0))
  const baseFilter = (node: Node): boolean => {
    if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) return true
    const el = node as HTMLElement | SVGElement
    if (el.classList.contains('react-flow__minimap')) return false
    if (el.classList.contains('react-flow__controls')) return false
    // v7.9.24 — Background-Pattern wird separat via drawVectorBackground
    // im PDF gerendert, deshalb hier nicht mit erfassen.
    if (el.classList.contains('react-flow__background')) return false
    return true
  }

  // CapturedTile bleibt das Mehrfach-Bild-Format damit der Embed-Loop
  // unten unverändert bleibt — Single-Shot ist einfach ein 1-Element-Array.
  interface CapturedTile {
    dataUrl: string
    pxX: number
    pxY: number
    pxW: number
    pxH: number
  }
  const tiles: CapturedTile[] = []

  onProgress(
    'capture',
    `Canvas ${contentW}×${contentH}px bei ratio=${singleShotRatio.toFixed(2)} (${useJpeg ? 'JPEG' : 'PNG'})…`,
  )
  try {
    const singleShotOpts = {
      backgroundColor: useJpeg ? composed.bgFallback : undefined,
      pixelRatio: singleShotRatio,
      cacheBust: true,
      quality: useJpeg ? jpegQuality : undefined,
      width: contentW,
      height: contentH,
      style: {
        width: `${contentW}px`,
        height: `${contentH}px`,
        background: useJpeg ? composed.bgFallback : 'transparent',
        backgroundColor: useJpeg ? composed.bgFallback : 'transparent',
        transform: `translate(${-contentX}px, ${-contentY}px)`,
        transformOrigin: '0 0',
      },
      filter: baseFilter,
    }
    const dataUrl = await capture(viewportEl, singleShotOpts)
    tiles.push({ dataUrl, pxX: 0, pxY: 0, pxW: contentW, pxH: contentH })
    onProgress('captured', `Single-Shot fertig (${Math.round(dataUrl.length / 1024)} KB)`)
  } catch (singleShotErr) {
    // Single-Shot crashed → echtes Memory-/Canvas-Limit überschritten.
    // Jetzt erst tilen. Tile-Budget bewusst großzügig: 12 MP/Tile,
    // damit es wenige große Tiles statt vieler kleiner werden — jede
    // Tile-Kapture kostet eine volle DOM-Serialisierung.
    onProgress('tile-fallback', `Single-Shot fehlgeschlagen, fallback zu Tiling…`)
    const TILE_BUDGET_MP = 12_000_000
    const TILE_MAX_EDGE_PX = 4000
    const tileRatio = singleShotRatio
    const tileMaxCanvasPx = Math.sqrt(TILE_BUDGET_MP) / tileRatio
    const tileMaxLogicalEdge = Math.min(TILE_MAX_EDGE_PX / tileRatio, tileMaxCanvasPx)
    const tileCols = Math.max(1, Math.ceil(contentW / tileMaxLogicalEdge))
    const tileRows = Math.max(1, Math.ceil(contentH / tileMaxLogicalEdge))
    const tileW = Math.ceil(contentW / tileCols)
    const tileH = Math.ceil(contentH / tileRows)
    const captureFb = toJpeg // im Fallback IMMER JPEG für Speicher
    for (let r = 0; r < tileRows; r++) {
      for (let c = 0; c < tileCols; c++) {
        const idx = r * tileCols + c + 1
        onProgress('tile', `Kachel ${idx}/${tileCols * tileRows}`)
        const tileOriginX = contentX + c * tileW
        const tileOriginY = contentY + r * tileH
        const actualW = Math.min(tileW, contentW - c * tileW)
        const actualH = Math.min(tileH, contentH - r * tileH)
        const opts = {
          backgroundColor: composed.bgFallback,
          pixelRatio: tileRatio,
          cacheBust: true,
          quality: 0.8,
          width: actualW,
          height: actualH,
          style: {
            width: `${actualW}px`,
            height: `${actualH}px`,
            background: composed.bgFallback,
            backgroundColor: composed.bgFallback,
            transform: `translate(${-tileOriginX}px, ${-tileOriginY}px)`,
            transformOrigin: '0 0',
          },
          filter: baseFilter,
        }
        try {
          const dataUrl = await captureFb(viewportEl, opts)
          tiles.push({
            dataUrl,
            pxX: c * tileW,
            pxY: r * tileH,
            pxW: actualW,
            pxH: actualH,
          })
        } catch (tileErr) {
          throw new Error(
            `PDF-Export fehlgeschlagen. Single-Shot: ${
              singleShotErr instanceof Error ? singleShotErr.message : 'unbekannt'
            }. Tiling-Fallback Kachel ${idx}/${tileCols * tileRows}: ${
              tileErr instanceof Error ? tileErr.message : 'unbekannt'
            }`,
            { cause: tileErr },
          )
        }
      }
    }
  }
  // useJpeg gilt jetzt für den Einzel-Shot-Pfad. Im Tiling-Fallback ist
  // immer JPEG verwendet worden — wir checken über die DataURL-Header
  // ob es PNG oder JPEG ist (für addImage-Format-Argument).
  const detectFormat = (dataUrl: string): 'JPEG' | 'PNG' =>
    dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG'

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
    // v7.9.62 — Stream-Kompression einschalten. Für JPEG-Images bringt
    // das nur wenig (sind eh komprimiert), aber Vektor-Hintergrund +
    // Title-Block + Metadata shrinken sich messbar.
    compress: true,
  })

  pdf.setFontSize(14)
  pdf.setTextColor(15)
  pdfText(pdf, metadata?.name || 'Cable Planner Project', margin, margin + 4)
  pdf.setFontSize(9)
  pdf.setTextColor(80)
  pdfText(pdf, new Date().toLocaleString(), pageWidth - margin, margin + 4, { align: 'right' })

  const offsetX = margin
  const offsetY = margin + headerHeight
  // v7.9.24 — Vektor-Hintergrund VOR dem Content-Image rendern, damit
  // er als unterste Layer liegt. Pattern (Dots/Lines/Cross) skaliert
  // jetzt unendlich beim PDF-Zoom und deckt die volle Drawing-Fläche
  // ab — kein weißer Rand mehr, keine fehlenden Pattern-Bereiche.
  drawVectorBackground(pdf, {
    x: offsetX,
    y: offsetY,
    width: drawingW,
    height: drawingH,
    variant: options?.bgVariant ?? 'dots',
    bgFillHex: composed.bgFallback,
    patternHex: extractGridColor(composed, options),
    opacity: options?.bgOpacity ?? 0.5,
    gridSizePx: options?.gridSize ?? 20,
  })
  // v7.9.58 — Jede Kachel separat einbetten. Die Pixel-Koordinaten
  // werden ins PDF-pt-System umgerechnet, sodass die Kacheln nahtlos
  // an einander stoßen. Side-by-side im finalen PDF → optisch ein
  // zusammenhängendes Bild ohne sichtbare Grenzen.
  onProgress('render', `${tiles.length} Bild(er) in PDF einbetten…`)
  // Yield damit der Progress-Overlay das "render"-Phase-Label rendert
  // BEVOR jsPDF.addImage blockiert.
  await yieldToBrowser()
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]
    onProgress('render', `Bild ${i + 1}/${tiles.length} in PDF…`)
    await yieldToBrowser()
    const tileXpt = offsetX + tile.pxX * PX_TO_PT
    const tileYpt = offsetY + tile.pxY * PX_TO_PT
    const tileWpt = tile.pxW * PX_TO_PT
    const tileHpt = tile.pxH * PX_TO_PT
    const format = detectFormat(tile.dataUrl)
    pdf.addImage(
      tile.dataUrl,
      format,
      tileXpt,
      tileYpt,
      tileWpt,
      tileHpt,
      undefined,
      // FAST-compression bei JPEG (sonst blockt jsPDF in der Embed-Phase
      // bei großen Bildern). PNG bekommt MEDIUM für bessere File-Size.
      format === 'JPEG' ? 'FAST' : 'MEDIUM',
    )
  }
  onProgress('serialize', `PDF-Stream serialisieren…`)
  await yieldToBrowser()

  if (metadata) {
    drawTitleBlock(pdf, metadata, pageWidth, pageHeight, margin)
  }

  return pdf
}
