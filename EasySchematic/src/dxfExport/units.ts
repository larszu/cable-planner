/** DXF unit and sanitization helpers. */

/** Pixels-per-inch used everywhere in the app (matches pdfExport DPI). */
export const DPI = 96;

/**
 * Ratio of cap-height to em-size for Inter (the canvas/PDF font). DXF TEXT
 * height is the cap height, while CSS `font-size` is the em-square — so a
 * canvas label rendered at 10px em should become a DXF text height of
 * ~7.3px (10 × 0.73) to match the visible letter size.
 */
export const CAP_HEIGHT_RATIO = 0.72;

/** Convert pixels to inches. */
export function pxToIn(px: number): number {
  return px / DPI;
}

/**
 * Convert a canvas CSS `font-size` (in pixels, em-square) to a DXF TEXT
 * entity height (in inches, cap height). Use this for every MTEXT / TEXT
 * `height:` field to get visual parity with the canvas and PDF.
 */
export function cssFontPxToDxfHeight(emPx: number): number {
  return pxToIn(emPx * CAP_HEIGHT_RATIO);
}

/**
 * Effective character-width / height ratio used for fit estimation.
 * Arial mixed-case averages ~0.55; we use 0.65 so truncation kicks in
 * before a label actually spills in TrueView. Device labels are
 * `font-semibold` on the canvas, which adds weight, and Arial in CAD
 * renderers typically measures slightly wider than the browser-rendered
 * Inter counterpart.
 */
const ARIAL_AVG_ASPECT = 0.65;

/**
 * Ellipsis glyph used when truncating. U+2026 (…) is one glyph with Arial,
 * but several CAD renderers (TrueView, Vectorworks) silently substitute
 * three literal periods, which is wider than the single glyph. Emitting
 * "..." explicitly gives us stable width accounting across renderers.
 */
const ELLIPSIS = "...";

/** Width of a period glyph as a fraction of text height. Arial: ~0.28. */
const PERIOD_WIDTH_RATIO = 0.28;

/** Global fudge factor — shave this off the available width before computing
 *  how many characters fit, so actual rendering never pushes past the box
 *  edge even when a specific string has more wide chars than average. */
const FIT_SAFETY_MARGIN = 0.92;

/**
 * Estimate the rendered width (in the same units as `height`) of a string
 * in the STYLE font. Conservative — assumes average-width letters.
 */
export function estimateTextWidth(text: string, height: number): number {
  return text.length * height * ARIAL_AVG_ASPECT;
}

/**
 * Truncate `text` so its estimated rendered width fits in `maxWidth` (same
 * units as `height`). Appends "..." when truncated.
 *
 * Matches the canvas behavior of `text-overflow: ellipsis` on CSS-clipped
 * device and port labels — without it DXF labels silently spill past the
 * device outline.
 */
export function truncateToWidth(text: string, maxWidth: number, height: number): string {
  if (!text) return text;
  const budget = maxWidth * FIT_SAFETY_MARGIN;
  const fullWidth = estimateTextWidth(text, height);
  if (fullWidth <= budget) return text;
  const charW = height * ARIAL_AVG_ASPECT;
  const ellipsisW = height * PERIOD_WIDTH_RATIO * ELLIPSIS.length;
  const roomForChars = Math.floor((budget - ellipsisW) / charW);
  if (roomForChars <= 0) return "";
  return text.slice(0, roomForChars).trimEnd() + ELLIPSIS;
}

/**
 * Convert screen coords (Y-down) to DXF coords (Y-up, inches).
 * All app geometry is in screen px; DXF wants Y-up inches.
 */
export function screenToDxf(x: number, y: number): { x: number; y: number } {
  return { x: x / DPI, y: -y / DPI };
}

/** Format a number cleanly for DXF (no scientific notation, trim trailing zeros). */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number(n.toFixed(6)).toString();
}

/**
 * Sanitize a string for use as a DXF layer/linetype/block name.
 * Allowed chars per DXF spec: letters, digits, `$`, `-`, `_`. Everything
 * else becomes `_`. Uppercased for CAD convention.
 */
export function sanitizeName(raw: string): string {
  const up = raw.toUpperCase();
  let out = "";
  for (const ch of up) {
    if (/[A-Z0-9$\-_]/.test(ch)) out += ch;
    else out += "_";
  }
  // Collapse runs of underscores, strip leading/trailing
  out = out.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return out || "UNNAMED";
}

/**
 * Escape a string for use as a DXF TEXT entity value (group code 1).
 * Non-ASCII characters are encoded as `\U+XXXX` which AutoCAD understands.
 * Backslashes are escaped too since `\` starts an escape sequence.
 */
export function escapeForText(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\") {
      out += "\\\\";
    } else if (code >= 0x20 && code < 0x7f) {
      out += ch;
    } else if (code < 0x10000) {
      out += "\\U+" + code.toString(16).toUpperCase().padStart(4, "0");
    } else {
      // Supplementary plane → surrogate pair
      const hi = 0xd800 + ((code - 0x10000) >> 10);
      const lo = 0xdc00 + ((code - 0x10000) & 0x3ff);
      out += "\\U+" + hi.toString(16).toUpperCase().padStart(4, "0");
      out += "\\U+" + lo.toString(16).toUpperCase().padStart(4, "0");
    }
  }
  return out;
}

/**
 * Escape a string for MTEXT (group code 1/3). Same as TEXT but also
 * escapes `{` and `}` which are MTEXT formatting delimiters.
 */
export function escapeForMText(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\") out += "\\\\";
    else if (ch === "{") out += "\\{";
    else if (ch === "}") out += "\\}";
    else if (code >= 0x20 && code < 0x7f) out += ch;
    else if (code < 0x10000) {
      out += "\\U+" + code.toString(16).toUpperCase().padStart(4, "0");
    } else {
      const hi = 0xd800 + ((code - 0x10000) >> 10);
      const lo = 0xdc00 + ((code - 0x10000) & 0x3ff);
      out += "\\U+" + hi.toString(16).toUpperCase().padStart(4, "0");
      out += "\\U+" + lo.toString(16).toUpperCase().padStart(4, "0");
    }
  }
  return out;
}

/** Parse a `#rrggbb` hex string to [r,g,b] ints (0..255). Returns [0,0,0] on failure. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Pack an RGB triple into a DXF true-color integer for group code 420. */
export function rgbToTrueColor(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

/** Mix `hex` toward white by `amount` (0..1). 0 = original, 1 = white. */
export function tintToWhite(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = Math.max(0, Math.min(1, amount));
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  const r2 = mix(r), g2 = mix(g), b2 = mix(b);
  return "#" + [r2, g2, b2].map((c) => c.toString(16).padStart(2, "0")).join("");
}
