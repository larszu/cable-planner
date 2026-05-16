// v7.7.1 — Shared canvas-background composer used by PDF and image
// exports. Mirrors the live canvas styling (gradient + ReactFlow
// `<Background>` pattern) so the exported file matches what the user
// sees — including their chosen variant (dots / lines / cross / none),
// grid size, opacity and custom palette overrides.
//
// Before this file existed both exporters duplicated a hardcoded
// dot-pattern CSS that ignored every UI setting, so any tweak in
// Settings → Canvas-Hintergrund had no effect on PDF / PNG / JPEG
// output. That's also why the user reported "always dotted regardless
// of what I change in the settings".

export type ExportBgVariant = 'dots' | 'lines' | 'cross' | 'none'

export interface ExportBackgroundOptions {
  theme: 'dark' | 'light'
  variant: ExportBgVariant
  /** Grid step in CSS pixels (matches the live ReactFlow gap). */
  gridSize: number
  /** Opacity of the pattern layer (0..1). */
  opacity: number
  /** Optional custom canvas color overrides. */
  customPalette?: { canvasBg: string; gridColor: string } | null
}

export interface ComposedBackground {
  /** Use as the captured element's `backgroundColor` (solid fallback for
   *  capture libs that can't rasterise gradients). */
  bgFallback: string
  /** CSS to apply as the `style.background` shorthand. Includes both
   *  the pattern layer (if any) and the underlying gradient. */
  background: string
  /** Companion `background-size` for the composed background. */
  backgroundSize: string
  /** Companion `background-repeat`. */
  backgroundRepeat: string
}

/** Build the composed background style. Layering order (top to bottom):
 *  1. Pattern (dots / lines / cross) — only if variant !== 'none'
 *  2. Theme-appropriate radial gradient
 *
 *  The pattern is drawn at `gridSize` intervals and tiles infinitely
 *  via `background-repeat: repeat`, so the exported file shows the
 *  grid extending across the entire content area regardless of how
 *  much padding the caller adds. */
export const composeExportBackground = (
  opts: ExportBackgroundOptions,
): ComposedBackground => {
  const { theme, variant, gridSize, opacity, customPalette } = opts
  const bgFallback =
    customPalette?.canvasBg ?? (theme === 'light' ? '#e8edf4' : '#0f172a')
  const bgGradient = customPalette?.canvasBg
    ? customPalette.canvasBg
    : theme === 'light'
      ? 'radial-gradient(circle at 30% 20%, #eef2f7 0%, #e8edf4 50%, #dde4ee 100%)'
      : 'radial-gradient(circle at 20% 10%, #1e293b 0%, #0f172a 45%, #020617 100%)'
  const themeGridColor = theme === 'light' ? '#94a3b8' : '#64748b'
  const gridColor = customPalette?.gridColor ?? themeGridColor
  // Encode opacity into the grid color so the CSS pattern fades
  // independently of the gradient (using the `style.opacity` field
  // would fade the gradient too, which the user didn't ask for).
  const rgbaGrid = withOpacity(gridColor, Math.max(0, Math.min(1, opacity)))

  // v7.9.4 — Variant-Patterns als SVG-Data-URL statt CSS-Gradient.
  // CSS radial-gradient() für Dots-Pattern wurde von html-to-image's
  // foreignObject-Capture nicht zuverlässig gerendert: im Export
  // tauchten Punkte nur in einem kleineren Mittelrechteck auf, nicht
  // über die gesamte Capture-Fläche (User-Bug "canvas punkte sind in
  // export nicht über gesamte fläche"). SVG-data-URLs werden vom
  // SVG-Renderer in foreignObject nativ unterstützt und tilen
  // korrekt — die Punkte erscheinen jetzt über die volle Padding-
  // Zone hinweg.
  const svgDataUrl = (innerSvg: string): string => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${gridSize}' height='${gridSize}'>${innerSvg}</svg>`
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
  }

  const { pattern, patternSize } = (() => {
    switch (variant) {
      case 'dots': {
        const c = gridSize / 2
        return {
          pattern: svgDataUrl(
            `<circle cx='${c}' cy='${c}' r='1.5' fill='${rgbaGrid}' />`,
          ),
          patternSize: `${gridSize}px ${gridSize}px`,
        }
      }
      case 'lines':
        return {
          pattern: svgDataUrl(
            `<path d='M0 0H${gridSize}M0 0V${gridSize}' stroke='${rgbaGrid}' stroke-width='1' fill='none' />`,
          ),
          patternSize: `${gridSize}px ${gridSize}px`,
        }
      case 'cross': {
        // Kleines Plus-Kreuz an jedem Gitter-Punkt — gleicher Stil wie
        // ReactFlow's eingebauter "cross"-Variant.
        const c = gridSize / 2
        const arm = 3
        return {
          pattern: svgDataUrl(
            `<path d='M${c - arm} ${c}H${c + arm}M${c} ${c - arm}V${c + arm}' stroke='${rgbaGrid}' stroke-width='1' fill='none' />`,
          ),
          patternSize: `${gridSize}px ${gridSize}px`,
        }
      }
      case 'none':
      default:
        return { pattern: '', patternSize: '' }
    }
  })()

  if (!pattern) {
    return {
      bgFallback,
      background: bgGradient,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
    }
  }
  return {
    bgFallback,
    background: `${pattern}, ${bgGradient}`,
    backgroundSize: `${patternSize}, 100% 100%`,
    backgroundRepeat: 'repeat, no-repeat',
  }
}

/** Convert a hex / named color to rgba() with the given opacity. Falls
 *  back to opacity-via-color-mix style alpha so any input flavour
 *  works. */
const withOpacity = (color: string, alpha: number): string => {
  // Already an rgba() / hsla() — patch the alpha in place.
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(color)
  if (rgba) {
    const parts = rgba[1].split(',').map((p) => p.trim())
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`
  }
  // Hex (#rgb / #rrggbb / #rrggbbaa) — split into channels.
  const hex = /^#([0-9a-f]{3,8})$/i.exec(color)
  if (hex) {
    const h = hex[1]
    const expand = (s: string) => (s.length === 1 ? s + s : s)
    if (h.length === 3 || h.length === 4) {
      const r = parseInt(expand(h[0]), 16)
      const g = parseInt(expand(h[1]), 16)
      const b = parseInt(expand(h[2]), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    if (h.length === 6 || h.length === 8) {
      const r = parseInt(h.slice(0, 2), 16)
      const g = parseInt(h.slice(2, 4), 16)
      const b = parseInt(h.slice(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
  }
  // Last resort — return the original with a wrapping color-mix; not
  // every renderer supports it but at least the call doesn't drop the
  // alpha entirely.
  return `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`
}
