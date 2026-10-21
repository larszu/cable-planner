// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Test pattern generator. Every pattern draws into a 2D canvas in full-range R'G'B'
// (0 = 0 %, 255 = 100 %). Ramps and zone plates are written pixel by pixel so the
// browser cannot dither them. Values below 0 % (PLUGE sub-black) cannot exist in
// full-range RGB and are clipped to 0.

import { bt709Oetf, hlgFromNits, pqEncode, type Colorspace } from './color';
import { LED_PATTERNS } from './led/patterns';
import { avCalibration } from './audio/avcal';
import { CodeRaster, NOTE_16, PATTERNS_16, PLUGE_16, drawRaster, plugeBoxes, plugeRaster, toFrame16, type Frame16 } from './patterns16';
import { smpteLzRaster } from './egg';
import { ramp10Labels, ramp10Raster } from './deep';
import { lang, t, type Key } from './i18n';

export interface PatternDef {
  id: string;
  name: string;
  /** group label shown in the pattern menus (language-dependent) */
  group: string;
  /** stable group key for comparisons; labels change with the UI language */
  groupId?: string;
  animated?: boolean;
  /** Suggested transfer for the scopes (HDR patterns). */
  transfer?: 'pq' | 'hlg';
  /** Image-based pattern (bundled or user file). */
  src?: string;
  draw?: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
  /** exact 16-bit Y′CbCr frame for the scopes (patterns16.ts); the canvas stays 8 bit */
  frame16?: (w: number, h: number) => Frame16;
  /** Y′CbCr matrix of the pattern (default: by picture height) */
  colorspace?: Colorspace;
  /** shown with the pattern, e.g. what the 8-bit output window cannot carry */
  note?: string;
  /** exact 10-bit R′G′B′ codes: the output window draws these on its float16 canvas (src/deep.ts) */
  raster?: (w: number, h: number) => CodeRaster;
  /** code range of `raster` (false: narrow, 64 = 0 %) */
  rasterFull?: boolean;
  /** captions drawn over the raster in the output window [x, y, text] */
  labels?: (w: number, h: number) => [number, number, string][];
}

type RGB = [number, number, number];
const lv = (p: number) => Math.round(Math.max(0, Math.min(1, p)) * 255);
const gray = (p: number): RGB => [lv(p), lv(p), lv(p)];
const css = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;
/** Signal level of a 10-bit narrow-range code (64 = 0 %, 940 = 100 %). */
export const code10 = (c: number) => (c - 64) / 876;

function fill(ctx: CanvasRenderingContext2D, c: RGB, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = css(c);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(x + w) - Math.round(x), Math.round(y + h) - Math.round(y));
}

let scratch: HTMLCanvasElement | null = null;
/** putImageData ignores clip paths; go through a scratch canvas so clipping applies (values stay exact). */
function blit(ctx: CanvasRenderingContext2D, img: ImageData, x: number, y: number) {
  scratch ??= document.createElement('canvas');
  scratch.width = img.width; scratch.height = img.height;
  scratch.getContext('2d')!.putImageData(img, 0, 0);
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(scratch, x, y);
  ctx.imageSmoothingEnabled = smooth;
}

/** Per-pixel fill (no dithering, exact code values). */
function pixels(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => RGB) {
  x0 = Math.round(x0); y0 = Math.round(y0); w = Math.round(w); h = Math.round(h);
  if (w <= 0 || h <= 0) return;
  const img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y), i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  blit(ctx, img, x0, y0);
}

/** Horizontal ramp that only depends on x: one row computed, then copied. */
function hramp(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, fn: (f: number) => RGB) {
  x0 = Math.round(x0); y0 = Math.round(y0); w = Math.round(w); h = Math.round(h);
  if (w <= 0 || h <= 0) return;
  const img = ctx.createImageData(w, h), d = img.data;
  for (let x = 0; x < w; x++) {
    const [r, g, b] = fn(w === 1 ? 0 : x / (w - 1));
    d[x * 4] = r; d[x * 4 + 1] = g; d[x * 4 + 2] = b; d[x * 4 + 3] = 255;
  }
  for (let y = 1; y < h; y++) d.copyWithin(y * w * 4, 0, w * 4);
  blit(ctx, img, x0, y0);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center') {
  ctx.font = `600 ${Math.round(size)}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

function hsv(h: number, s = 1, v = 1): RGB {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [lv(r), lv(g), lv(b)];
}

const BARS = (a: number): RGB[] => [
  [a, a, a], [a, a, 0], [0, a, a], [0, a, 0], [a, 0, a], [a, 0, 0], [0, 0, a],
].map((c) => c.map(lv) as RGB);

function smpteBars(ctx: CanvasRenderingContext2D, w: number, h: number, amp: number) {
  const top = BARS(amp), bw = w / 7;
  top.forEach((c, i) => fill(ctx, c, i * bw, 0, bw, h * 0.67));
  const mid: RGB[] = [top[6], [0, 0, 0], top[4], [0, 0, 0], top[2], [0, 0, 0], top[0]];
  mid.forEach((c, i) => fill(ctx, c, i * bw, h * 0.67, bw, h * 0.08));
  const y = h * 0.75, bh = h * 0.25, qw = (bw * 5) / 4;
  // -I, 100 % white, +Q, black (commonly used full-range RGB approximations)
  fill(ctx, [0, 33, 76], 0, y, qw, bh);
  fill(ctx, [255, 255, 255], qw, y, qw, bh);
  fill(ctx, [50, 0, 106], qw * 2, y, qw, bh);
  fill(ctx, [0, 0, 0], qw * 3, y, qw, bh);
  // PLUGE as in the BT.2111-3 bars (Tab. 2, p9–10): −2 %, 0 %, +2 %, 0 %, +4 %, 0 % =
  // 10-bit codes 48, 64, 80, 64, 99, 64. −2 % cannot exist in full-range RGB and lands on 0.
  const pw = bw / 3;
  [48, 64, 80, 64, 99, 64].forEach((c, i) => fill(ctx, gray(code10(c)), bw * 5 + i * pw, y, pw, bh));
}

/**
 * PLUGE after ITU-R BT.814-4 Annex 2 (Fig. 2, Tab. 2–5, p5–7), positions scaled from the
 * HDTV sample/line numbers (inclusive; progressive lines 42–1121 → rows 0–1079).
 * Left: 10-line stripes slightly lighter (upper half) and slightly darker (lower half) than black,
 * centre: Higher-level box, right: broad lighter (top) and darker (bottom) boxes.
 * SDR: Higher level 940 (100 %), HDR: 399 (38.2 %, same for PQ and HLG); lighter 80, darker 48.
 */
export function plugeBT814(ctx: CanvasRenderingContext2D, w: number, h: number, higher: number) {
  fill(ctx, gray(0), 0, 0, w, h);
  for (const [x, y, bw, bh, c] of plugeBoxes(w, h, higher)) fill(ctx, gray(code10(c)), x, y, bw, bh);
}

function arrows(ctx: CanvasRenderingContext2D, w: number, h: number, color = '#000') {
  const s = Math.min(w, h) * 0.035;
  ctx.fillStyle = color;
  const tri = (pts: number[]) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.lineTo(pts[4], pts[5]); ctx.closePath(); ctx.fill(); };
  for (const fx of [0.173, 0.827]) {
    const x = w * fx;
    tri([x - s / 2, s, x + s / 2, s, x, 0]);
    tri([x - s / 2, h - s, x + s / 2, h - s, x, h]);
  }
  for (const fy of [0.28, 0.72]) {
    const y = h * fy;
    tri([s, y - s / 2, s, y + s / 2, 0, y]);
    tri([w - s, y - s / 2, w - s, y + s / 2, w, y]);
  }
}

/** Sinusoidal circular zone plate reaching Nyquist at the frame corner. */
function zonePlate(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2, cy = h / 2, rmax2 = cx * cx + cy * cy;
  const k = Math.PI / Math.sqrt(rmax2); // d(phase)/dr = k·r = π at the corner → 0.5 cycles/px
  pixels(ctx, 0, 0, w, h, (x, y) => {
    const dx = x - cx, dy = y - cy;
    return gray(0.5 + 0.5 * Math.cos((k * (dx * dx + dy * dy)) / 2 - t * 4));
  });
}

// X-Rite ColorChecker Classic, widely published sRGB approximations
const MACBETH: RGB[] = [
  [115, 82, 68], [194, 150, 130], [98, 122, 157], [87, 108, 67], [133, 128, 177], [103, 189, 170],
  [214, 126, 44], [80, 91, 166], [193, 90, 99], [94, 60, 108], [157, 188, 64], [224, 163, 46],
  [56, 61, 150], [70, 148, 73], [175, 54, 60], [231, 199, 31], [187, 86, 149], [8, 133, 161],
  [243, 243, 242], [200, 200, 200], [160, 160, 160], [122, 122, 121], [85, 85, 85], [52, 52, 52],
];

/** Uploaded logo for the logo patterns (#52, src/userPatterns.ts); null = none. */
export const userLogo: { image: HTMLImageElement | null; name: string } = { image: null, name: '' };

/** Draw the logo fitted into a box (aspect kept), centred. */
function drawLogo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, Math.round(x + (w - dw) / 2), Math.round(y + (h - dh) / 2), Math.round(dw), Math.round(dh));
}

/** Logo alone: centred on black, inside the EBU R 95 graphics safe area (90 %), at most half the height. */
export function logoCard(ctx: CanvasRenderingContext2D, w: number, h: number, bg: RGB = [0, 0, 0]) {
  fill(ctx, bg, 0, 0, w, h);
  const img = userLogo.image;
  if (!img) { text(ctx, t('pattern.noLogo'), w / 2, h / 2, h * 0.04, '#888'); return; }
  drawLogo(ctx, img, w * 0.25, h * 0.25, w * 0.5, h * 0.5);
}

export function testCardLogo(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  testCard(ctx, w, h, t, userLogo.image);
}

function testCard(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, logo: HTMLImageElement | null = null) {
  fill(ctx, gray(0.35), 0, 0, w, h);
  const cell = h / 14;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, Math.round(h / 540));
  ctx.beginPath();
  for (let x = w / 2 % cell; x <= w; x += cell) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
  for (let y = h / 2 % cell; y <= h; y += cell) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
  ctx.stroke();
  const cx = w / 2, cy = h / 2, R = h * 0.44;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  fill(ctx, [0, 0, 0], 0, 0, w, h);
  // bars
  const bw = (R * 2) / 8, bx = cx - R;
  [...BARS(0.75), [0, 0, 0] as RGB].forEach((c, i) => fill(ctx, c, bx + i * bw, cy - R, bw, R * 0.55));
  // grey steps
  for (let i = 0; i < 6; i++) fill(ctx, gray(i / 5), bx + (i * R * 2) / 6, cy - R * 0.45, (R * 2) / 6, R * 0.3);
  // frequency gratings
  const fy = cy - R * 0.15, fh = R * 0.3, gw = (R * 2) / 5;
  [2, 3, 4, 6, 8].forEach((period, i) => pixels(ctx, bx + i * gw, fy, gw, fh, (x) => gray(Math.floor(x / (period / 2)) % 2)));
  // hue ramp and grey ramp
  hramp(ctx, bx, cy + R * 0.15, R * 2, R * 0.2, (f) => hsv(f));
  hramp(ctx, bx, cy + R * 0.35, R * 2, R * 0.2, (f) => gray(f));
  fill(ctx, [0, 0, 0], bx, cy + R * 0.55, R * 2, R * 0.45);
  ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, h / 360);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - R * 0.08, cy); ctx.lineTo(cx + R * 0.08, cy); ctx.moveTo(cx, cy - R * 0.08); ctx.lineTo(cx, cy + R * 0.08); ctx.stroke();
  void t;
  if (logo) {
    // logo in the black lower segment, the clock moves below it (smaller)
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    drawLogo(ctx, logo, cx - R * 0.6, cy + R * 0.58, R * 1.2, R * 0.2);
    ctx.restore();
    text(ctx, new Date().toLocaleTimeString(lang() === 'de' ? 'de-DE' : 'en-GB'), cx, cy + R * 0.88, R * 0.1, '#fff');
  } else text(ctx, new Date().toLocaleTimeString(lang() === 'de' ? 'de-DE' : 'en-GB'), cx, cy + R * 0.72, R * 0.16, '#fff');
  arrows(ctx, w, h, '#fff');
}

/**
 * Safe areas after EBU R 95 v1.1 (Note 5 p4, Fig. 4 p8): action safe 3.5 %, graphics safe 5 %
 * of width and height (1080p: 67/38 px and 96/54 px), plus the 4:3 caption-safe lines at
 * 16.25 % from each side (1080p: 312 px, 1296 px wide) within the graphics-safe height.
 * R 95 has no full-height 4:3 frame.
 */
export function safeAreaRects(w: number, h: number) {
  const inset = (fx: number, fy: number) => { const x = Math.round(w * fx), y = Math.round(h * fy); return { x, y, w: w - 2 * x, h: h - 2 * y }; };
  return { action: inset(0.035, 0.035), graphics: inset(0.05, 0.05), caption: Math.round(w * 0.1625) };
}

function safeAreas(c: CanvasRenderingContext2D, w: number, h: number) {
  fill(c, gray(0.2), 0, 0, w, h);
  const lw = Math.max(1, Math.round(h / 540)), { action, graphics, caption } = safeAreaRects(w, h);
  const frame = (r: { x: number; y: number; w: number; h: number }, color: string, label: string) => {
    c.strokeStyle = color; c.lineWidth = lw;
    c.strokeRect(r.x + lw / 2, r.y + lw / 2, r.w - lw, r.h - lw);
    if (label) text(c, label, w / 2, r.y + h * 0.025, h * 0.022, color);
  };
  frame({ x: 0, y: 0, w, h }, '#fff', '');
  frame(action, '#ffd400', t('pattern.safe.action', { w: action.w, h: action.h }));
  frame(graphics, '#00dcff', `Graphics safe 5 % (${graphics.w}×${graphics.h})`);
  c.strokeStyle = '#ff4d4d'; c.lineWidth = lw; c.setLineDash([8, 6]);
  c.beginPath();
  for (const x of [caption, w - caption]) { c.moveTo(x + 0.5, graphics.y); c.lineTo(x + 0.5, graphics.y + graphics.h); }
  c.stroke(); c.setLineDash([]);
  text(c, `4:3 Caption safe (${w - 2 * caption} px)`, w / 2, h / 2 + h * 0.08, h * 0.025, '#ff4d4d');
  c.fillStyle = '#fff'; c.fillRect(Math.floor(w / 2) - h * 0.02, Math.floor(h / 2), h * 0.04, 1); c.fillRect(Math.floor(w / 2), Math.floor(h / 2) - h * 0.02, 1, h * 0.04);
}

/** Flash length; the generator's A/V-sync beep has the same length (src/audio/dsp/signals.ts). */
export const AV_FLASH_MS = 80;

/**
 * A/V sync: white flash for 80 ms at every whole second of the shared clock
 * (performance.timeOrigin + performance.now(), equal in all windows of this browser);
 * the tone generator's “A/V-Sync-Piep” beeps at the same instants. In between a marker
 * runs along a scale of ±500 ms so a delay can be read off a recording.
 */
function avSync(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // calibrated lead of the picture (src/audio/avcal.ts; 0 = uncalibrated)
  const now = performance.timeOrigin + performance.now() + avCalibration().videoLeadMs;
  const ph = now % 1000;
  if (ph < AV_FLASH_MS) { fill(ctx, gray(1), 0, 0, w, h); return; }
  fill(ctx, gray(0), 0, 0, w, h);
  const y = h * 0.62, x0 = w * 0.1, x1 = w * 0.9;
  ctx.fillStyle = css(gray(0.5));
  for (let i = -10; i <= 10; i++) {
    const x = x0 + ((i + 10) / 20) * (x1 - x0), big = i % 5 === 0;
    ctx.fillRect(Math.round(x) - 1, Math.round(y - (big ? h * 0.05 : h * 0.025)), 2, Math.round(big ? h * 0.1 : h * 0.05));
  }
  text(ctx, '−500 ms', x0, y + h * 0.09, h * 0.03, css(gray(0.6)));
  text(ctx, t('pattern.av.flash'), (x0 + x1) / 2, y + h * 0.09, h * 0.03, css(gray(0.6)));
  text(ctx, '+500 ms', x1, y + h * 0.09, h * 0.03, css(gray(0.6)));
  // marker: position relative to the nearest flash
  const rel = ph > 500 ? ph - 1000 : ph;
  const mx = x0 + ((rel + 500) / 1000) * (x1 - x0);
  ctx.fillStyle = css(gray(1));
  ctx.fillRect(Math.round(mx) - 3, Math.round(y - h * 0.08), 6, Math.round(h * 0.16));
  text(ctx, t('pattern.av.title'), w / 2, h * 0.22, h * 0.09);
  text(ctx, t('pattern.av.hint'), w / 2, h * 0.34, h * 0.03, css(gray(0.75)));
  const cal = avCalibration();
  text(ctx, cal.note ? t('pattern.av.lead', { ms: Math.round(cal.videoLeadMs), note: cal.note }) : t('pattern.av.uncalibrated'), w / 2, h * 0.4, h * 0.022, css(gray(0.55)));
}

export const PATTERNS: PatternDef[] = [
  // Vollfelder
  { id: 'red', name: t('pattern.red'), group: t('pattern.group.full'), draw: (c, w, h) => fill(c, [255, 0, 0], 0, 0, w, h) },
  { id: 'green', name: t('pattern.green'), group: t('pattern.group.full'), draw: (c, w, h) => fill(c, [0, 255, 0], 0, 0, w, h) },
  { id: 'blue', name: t('pattern.blue'), group: t('pattern.group.full'), draw: (c, w, h) => fill(c, [0, 0, 255], 0, 0, w, h) },
  { id: 'white', name: t('pattern.white100'), group: t('pattern.group.full'), draw: (c, w, h) => fill(c, gray(1), 0, 0, w, h) },
  { id: 'gray50', name: t('pattern.grey50'), group: t('pattern.group.full'), draw: (c, w, h) => fill(c, gray(0.5), 0, 0, w, h) },
  // 18 % reflectance through the BT.709 OETF = 40.9 % (BT.709-6 p5; 46 % would be the sRGB curve)
  { id: 'gray18', name: t('pattern.grey18'), group: t('pattern.group.full'), draw: (c, w, h) => fill(c, gray(bt709Oetf(0.18)), 0, 0, w, h) },
  { id: 'black', name: t('pattern.black'), group: t('pattern.group.full'), draw: (c, w, h) => fill(c, gray(0), 0, 0, w, h) },

  // Grau
  { id: 'ramp', name: t('pattern.ramp'), group: t('pattern.group.grey'), draw: (c, w, h) => hramp(c, 0, 0, w, h, gray) },
  {
    id: 'rgbramp', name: t('pattern.rgbramp'), group: t('pattern.group.grey'),
    draw: (c, w, h) => (['w', 'r', 'g', 'b'] as const).forEach((k, i) =>
      hramp(c, 0, (i * h) / 4, w, h / 4, (f) => (k === 'w' ? gray(f) : k === 'r' ? [lv(f), 0, 0] : k === 'g' ? [0, lv(f), 0] : [0, 0, lv(f)]))),
  },
  { id: 'steps11', name: t('pattern.steps11'), group: t('pattern.group.grey'), draw: (c, w, h) => { for (let i = 0; i < 11; i++) fill(c, gray(i / 10), (i * w) / 11, 0, w / 11, h); } },
  {
    id: 'te165', name: t('pattern.te165'), group: t('pattern.group.grey'),
    draw: (c, w, h) => {
      fill(c, [118, 118, 118], 0, 0, w, h);
      const x0 = w * 0.0825, sw = (w * 0.835) / 11;
      for (let i = 0; i < 11; i++) {
        fill(c, gray(i / 10), x0 + i * sw, h * 0.153, sw, h * 0.27);
        fill(c, gray(1 - i / 10), x0 + i * sw, h * 0.577, sw, h * 0.27);
      }
      fill(c, gray(0), w * 0.359, h * 0.453, w * 0.087, h * 0.093);
      fill(c, gray(1), w * 0.446, h * 0.453, w * 0.108, h * 0.093);
      fill(c, gray(0), w * 0.554, h * 0.453, w * 0.087, h * 0.093);
      c.strokeStyle = '#000'; c.lineWidth = Math.max(1, h / 540); c.strokeRect(1, 1, w - 2, h - 2);
      arrows(c, w, h);
    },
  },
  {
    id: 'sweep', name: t('pattern.sweep'), group: t('pattern.group.grey'), animated: true,
    draw: (c, w, h, t) => hramp(c, 0, 0, w, h, (f) => gray((f + t * 0.1) % 1)),
  },
  { id: 'pluge', name: 'PLUGE BT.814-4 (SDR)', group: t('pattern.group.grey'), draw: (c, w, h) => plugeBT814(c, w, h, 940) },

  // Geometrie
  {
    id: 'checker', name: t('pattern.checker'), group: t('pattern.group.geometry'),
    draw: (c, w, h) => { const s = h / 9; for (let y = 0; y * s < h; y++) for (let x = 0; x * s < w; x++) fill(c, gray((x + y) % 2), x * s, y * s, s, s); },
  },
  {
    id: 'convergence', name: t('pattern.convergence'), group: t('pattern.group.geometry'),
    draw: (c, w, h) => {
      fill(c, gray(0), 0, 0, w, h);
      const n = 16, sx = w / n, sy = h / 9;
      c.fillStyle = '#fff';
      for (let i = 0; i <= n; i++) c.fillRect(Math.min(w - 1, Math.round(i * sx)), 0, 1, h);
      for (let j = 0; j <= 9; j++) c.fillRect(0, Math.min(h - 1, Math.round(j * sy)), w, 1);
      for (let i = 0; i < n; i++) for (let j = 0; j < 9; j++) c.fillRect(Math.round((i + 0.5) * sx), Math.round((j + 0.5) * sy), 1, 1);
    },
  },
  {
    id: 'crosshair', name: t('pattern.crosshair'), group: t('pattern.group.geometry'),
    draw: (c, w, h) => {
      fill(c, gray(0), 0, 0, w, h);
      c.fillStyle = '#fff';
      c.fillRect(Math.floor(w / 2), 0, 1, h); c.fillRect(0, Math.floor(h / 2), w, 1);
      c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, w - 1, h - 1);
      c.beginPath(); c.arc(w / 2, h / 2, h * 0.1, 0, Math.PI * 2); c.stroke();
    },
  },
  {
    id: 'circles', name: t('pattern.circles'), group: t('pattern.group.geometry'),
    draw: (c, w, h) => {
      fill(c, gray(0), 0, 0, w, h);
      const s = h / 8;
      c.strokeStyle = '#888'; c.lineWidth = 1; c.beginPath();
      for (let x = (w / 2) % s; x < w; x += s) { c.moveTo(Math.round(x) + 0.5, 0); c.lineTo(Math.round(x) + 0.5, h); }
      for (let y = (h / 2) % s; y < h; y += s) { c.moveTo(0, Math.round(y) + 0.5); c.lineTo(w, Math.round(y) + 0.5); }
      c.stroke();
      c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, h / 540);
      c.beginPath(); c.arc(w / 2, h / 2, h / 2 - 2, 0, Math.PI * 2); c.stroke();
      for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { c.beginPath(); c.arc(fx * w + (fx ? -1 : 1) * h / 8, fy * h + (fy ? -1 : 1) * h / 8, h / 8 - 2, 0, Math.PI * 2); c.stroke(); }
    },
  },
  { id: 'zoneplate', name: t('pattern.zoneplate'), group: t('pattern.group.geometry'), draw: (c, w, h) => zonePlate(c, w, h, 0) },
  { id: 'zoneplate-anim', name: t('pattern.zoneplateAnim'), group: t('pattern.group.geometry'), animated: true, draw: zonePlate },
  { id: 'safe', name: t('pattern.safe'), group: t('pattern.group.geometry'), draw: safeAreas },

  // Farbe
  { id: 'smpte75', name: t('pattern.smpte75'), group: t('pattern.group.colour'), draw: (c, w, h) => smpteBars(c, w, h, 0.75) },
  { id: 'smpte100', name: t('pattern.smpte100'), group: t('pattern.group.colour'), draw: (c, w, h) => smpteBars(c, w, h, 1) },
  {
    id: 'ebu75', name: t('pattern.ebu75'), group: t('pattern.group.colour'),
    draw: (c, w, h) => [gray(1), ...BARS(0.75).slice(1), [0, 0, 0] as RGB].forEach((col, i) => fill(c, col, (i * w) / 8, 0, w / 8, h)),
  },
  {
    id: 'ebu100', name: t('pattern.ebu100'), group: t('pattern.group.colour'),
    draw: (c, w, h) => [...BARS(1), [0, 0, 0] as RGB].forEach((col, i) => fill(c, col, (i * w) / 8, 0, w / 8, h)),
  },
  {
    id: 'gradbars', name: t('pattern.gradbars'), group: t('pattern.group.colour'),
    draw: (c, w, h) => {
      const cols: RGB[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0], [1, 1, 1]].map((v) => v as RGB);
      cols.forEach((col, i) => hramp(c, 0, (i * h) / 7, w, h / 7, (f) => col.map((v) => lv(v * f)) as RGB));
    },
  },
  { id: 'hue', name: t('pattern.hue'), group: t('pattern.group.colour'), draw: (c, w, h) => hramp(c, 0, 0, w, h, (f) => hsv(f)) },
  {
    id: 'macbeth', name: t('pattern.macbeth'), group: t('pattern.group.colour'),
    draw: (c, w, h) => {
      fill(c, gray(0.1), 0, 0, w, h);
      const pw = w / 6.6, ph = h / 4.4, g = pw * 0.1;
      MACBETH.forEach((col, i) => fill(c, col, g + (i % 6) * (pw + g * 0.6) + pw * 0.05, g + Math.floor(i / 6) * (ph + g * 0.4), pw, ph));
    },
  },

  // Animiert
  { id: 'cycle', name: t('pattern.cycle'), group: t('pattern.group.animated'), animated: true, draw: (c, w, h, t) => fill(c, hsv(t * 0.1), 0, 0, w, h) },
  { id: 'cyclegrad', name: t('pattern.cyclegrad'), group: t('pattern.group.animated'), animated: true, draw: (c, w, h, t) => hramp(c, 0, 0, w, h, (f) => hsv(f + t * 0.1)) },
  {
    id: 'tribar', name: t('pattern.tribar'), group: t('pattern.group.animated'), animated: true,
    draw: (c, w, h, t) => [0, 1, 2].forEach((i) => fill(c, hsv(t * 0.1 + i / 3), (i * w) / 3, 0, w / 3, h)),
  },
  {
    id: 'diagonal', name: t('pattern.diagonal'), group: t('pattern.group.animated'), animated: true,
    draw: (c, w, h, t) => { const p = h / 8, o = (t * p) % (2 * p); pixels(c, 0, 0, w, h, (x, y) => gray(Math.floor((x + y + o) / p) % 2)); },
  },
  {
    id: 'rainbow', name: t('pattern.rainbow'), group: t('pattern.group.animated'), animated: true,
    draw: (c, w, h, t) => pixels(c, 0, 0, w, h, (x, y) => hsv((x + y) / (w + h) * 2 - t * 0.2)),
  },
  {
    id: 'chromacrawl', name: t('pattern.chromacrawl'), group: t('pattern.group.animated'), animated: true,
    draw: (c, w, h, t) => { const ph = Math.floor(t * 25) % 2; pixels(c, 0, 0, w, h, (x, y) => ((x + y + ph) % 2 ? [255, 0, 255] : [0, 255, 0])); },
  },

  // Testbild
  { id: 'testcard', name: t('pattern.testcard'), group: t('pattern.group.testcard'), animated: true, draw: testCard },
  { id: 'avsync', name: t('pattern.avsync'), group: t('pattern.group.testcard'), animated: true, draw: avSync },

  // HDR
  {
    id: 'pq-steps', name: t('pattern.pqSteps'), group: 'HDR', transfer: 'pq',
    draw: (c, w, h) => {
      const nits = [0, 0.1, 1, 10, 50, 100, 203, 400, 1000, 2000, 4000, 10000];
      nits.forEach((n, i) => {
        const x = (i * w) / nits.length, bw = w / nits.length;
        fill(c, gray(pqEncode(n)), x, 0, bw, h * 0.85);
        text(c, n >= 1000 ? `${n / 1000}k` : String(n), x + bw / 2, h * 0.92, h * 0.035, '#bbb');
      });
    },
  },
  {
    id: 'hlg-steps', name: t('pattern.hlgSteps'), group: 'HDR', transfer: 'hlg',
    draw: (c, w, h) => {
      const nits = [0, 1, 10, 50, 100, 203, 400, 600, 1000];
      nits.forEach((n, i) => {
        const x = (i * w) / nits.length, bw = w / nits.length;
        fill(c, gray(hlgFromNits(n)), x, 0, bw, h * 0.85);
        text(c, String(n), x + bw / 2, h * 0.92, h * 0.035, '#bbb');
      });
    },
  },
  // BT.814-4 Tab. 3 (p6): Higher level 399 = 38.2 %, identical for PQ and HLG
  { id: 'pluge-hlg', name: 'PLUGE BT.814-4 HDR (HLG)', group: 'HDR', transfer: 'hlg', draw: (c, w, h) => plugeBT814(c, w, h, 399) },
  { id: 'pluge-pq', name: 'PLUGE BT.814-4 HDR (PQ)', group: 'HDR', transfer: 'pq', draw: (c, w, h) => plugeBT814(c, w, h, 399) },
  // BT.2408-8 Tab. 1 (p9): 18 % grey card at 38 % for HLG and PQ
  { id: 'gray18-hlg', name: t('pattern.grey18Hlg'), group: 'HDR', transfer: 'hlg', draw: (c, w, h) => fill(c, gray(0.38), 0, 0, w, h) },
  { id: 'gray18-pq', name: t('pattern.grey18Pq'), group: 'HDR', transfer: 'pq', draw: (c, w, h) => fill(c, gray(0.38), 0, 0, w, h) },
  {
    id: 'pq-ramp', name: t('pattern.pqRamp'), group: 'HDR', transfer: 'pq',
    draw: (c, w, h) => {
      hramp(c, 0, 0, w, h * 0.7, gray);
      fill(c, gray(pqEncode(203)), 0, h * 0.7, w, h * 0.3);
      text(c, t('pattern.pqRampLabel'), w / 2, h * 0.85, h * 0.04, '#222');
    },
  },
];

// LED wall patterns (#10), drawn from the wall settings in src/led/wall.ts
PATTERNS.push(...LED_PATTERNS);

// LZ display test set (Lars Zumpe Medienproduktion, bundled 1920×1080)
// [number, file slug]; the slug is part of the bundled file name, the caption comes from pattern.lz.<n>
const LZ = [
  ['01', 'schwarzwert-pluge'], ['02', 'weissclipping'], ['03', 'gamma'], ['04', 'ansi-kontrast'], ['05', 'ausleuchtung'],
  ['06', 'schwarzbild'], ['07', 'geometrie'], ['08', 'overscan'], ['09', 'schaerfe-1zu1'], ['10', 'konvergenz'],
  ['11', 'farbbalken'], ['12', 'verlaeufe'], ['13', 'messfelder'], ['14', 'text-schaerfung'], ['15', 'vollfeld-weiss'],
  ['16', 'vollfeld-grau50'], ['17', 'vollfeld-grau25'], ['18', 'vollfeld-rot'], ['19', 'vollfeld-gruen'], ['20', 'vollfeld-blau'],  // lang-ok: file slugs of the bundled images
] as const;
for (const [n, slug] of LZ) {
  PATTERNS.push({ id: `lz-${n}`, name: `${n} ${t(`pattern.lz.${n}` as Key)}`, group: t('pattern.group.lz'), groupId: 'lz', src: `patterns/lz-display/lz_${n}_${slug}_1920x1080.png` });
}

// start pattern: SMPTE 75 % with the hidden signature in the waveform (egg.ts), right after the original
PATTERNS.splice(PATTERNS.findIndex((p) => p.id === 'smpte75') + 1, 0, {
  id: 'smpte75-lz', name: t('pattern.smpte75lz'), group: t('pattern.group.colour'),
  note: t('pattern.smpte75lzNote'),
  draw: (c, w, h) => drawRaster(c, smpteLzRaster(w, h), false), frame16: (w, h) => toFrame16(smpteLzRaster(w, h), false, h > 576 ? '709' : '601'),
});

// 16-bit patterns (issue #7): BT.2111-3 HDR bars, and exact frames for the BT.814 PLUGE
for (const p of PATTERNS_16) {
  PATTERNS.push({
    id: p.id, name: p.name, group: 'HDR', transfer: p.transfer, colorspace: p.colorspace, note: NOTE_16,
    draw: (c, w, h) => drawRaster(c, p.raster(w, h), p.full), frame16: (w, h) => toFrame16(p.raster(w, h), p.full, p.colorspace),
    raster: p.raster, rasterFull: p.full,
  });
}
for (const p of PATTERNS) {
  const q = PLUGE_16[p.id];
  if (q) {
    Object.assign(p, {
      colorspace: q.colorspace, note: NOTE_16, frame16: (w: number, h: number) => toFrame16(plugeRaster(w, h, q.higher), false, q.colorspace),
      raster: (w: number, h: number) => plugeRaster(w, h, q.higher), rasterFull: false,
    });
  }
}
// 10-bit banding test for the output window (src/deep.ts)
PATTERNS.push({
  id: 'ramp10', name: t('pattern.ramp10'), group: '10 bit', colorspace: '709',
  note: t('pattern.ramp10Note'),
  draw: (c, w, h) => drawRaster(c, ramp10Raster(w, h), true), frame16: (w, h) => toFrame16(ramp10Raster(w, h), true, '709'),
  raster: ramp10Raster, rasterFull: true, labels: ramp10Labels,
});

export const RESOLUTIONS: [number, number][] = [[1280, 720], [1920, 1080], [2560, 1440], [3840, 2160], [1920, 1200], [1024, 768]];

export function patternById(id: string) {
  return PATTERNS.find((p) => p.id === id) ?? PATTERNS.find((p) => p.id === 'smpte75')!;
}


const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string) {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((ok, fail) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => fail(new Error(t('pattern.err.imageLoad', { src }))); img.src = src; });
    imageCache.set(src, p);
  }
  return p;
}

/** Render a pattern at w×h. Image patterns are fitted (1:1 when sizes match). */
export async function renderPattern(ctx: CanvasRenderingContext2D, def: PatternDef, w: number, h: number, t: number, label = '') {
  ctx.imageSmoothingEnabled = true;
  if (def.src) {
    const img = await loadImage(def.src);
    fill(ctx, [0, 0, 0], 0, 0, w, h);
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.imageSmoothingEnabled = s !== 1;
    ctx.drawImage(img, Math.round((w - dw) / 2), Math.round((h - dh) / 2), Math.round(dw), Math.round(dh));
  } else {
    def.draw?.(ctx, w, h, t);
  }
  if (label) drawLabel(ctx, w, h, label);
}

/** Label / identifier bar at the bottom of a pattern. */
export function drawLabel(ctx: CanvasRenderingContext2D, w: number, h: number, label: string) {
  const size = h * 0.045;
  ctx.font = `600 ${Math.round(size)}px system-ui, sans-serif`;
  const tw = ctx.measureText(label).width + size;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect((w - tw) / 2, h * 0.88 - size * 0.8, tw, size * 1.6);
  text(ctx, label, w / 2, h * 0.88, size, '#fff');
}

/** Small captions (left-aligned) over a pattern, e.g. the bands of the 10-bit ramp. */
export function drawCaptions(ctx: CanvasRenderingContext2D, h: number, items: [number, number, string][]) {
  const size = h * 0.018;
  for (const [x, y, s] of items) {
    ctx.font = `600 ${Math.round(size)}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - size * 0.3, y - size * 0.75, ctx.measureText(s).width + size * 0.6, size * 1.5);
    text(ctx, s, x, y, size, '#fff', 'left');
  }
}
