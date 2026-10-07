// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// More than 8 bit in the output windows (issue: 10-bit-Ausgabefenster, docs/research/10bit-ausgabe.md).
//
// Pipeline: 2D canvas with colorType 'float16' (WHATWG HTML, CanvasColorType) for the pattern
// window, WebGL2 drawing buffer RGBA16F (drawingBufferStorage, WebGL 1.0 spec §5.14) for the
// scope windows. Both keep every 10-bit code distinct: float16 has an 11-bit significand, so
// code/1023 is exact to better than ½ code over 0…1 (test/deep.test.ts checks all 1024 codes).
// What the operating system, the GPU and the cable make of it cannot be seen from here: the
// window says so instead of guessing.
//
// 10-bit stream: exact yuv422p10le frames (planar, little-endian) to the bridge, which encodes
// them with ffmpeg (server/out10.mjs).

import type { Colorspace } from './color';
import { LUMA } from './color';
import { CodeRaster, level10 } from './patterns16';

/** How 10-bit codes become canvas values: levels (0 % → 0, 100 % → 1) or codes 1:1 (code/1023). */
export type LevelMode = 'full' | 'code';

/** Canvas value (0…1, float) of a 10-bit R′G′B′ code of a raster in narrow or full range. */
export function codeToValue(code: number, rasterFull: boolean, mode: LevelMode): number {
  if (mode === 'code') return (rasterFull ? code : Math.max(0, Math.min(1023, code))) / 1023;
  return Math.max(0, Math.min(1, level10(code, rasterFull)));
}

/** A value drawn in full range (0 = 0 %, 1 = 100 %) as narrow-range code 1:1 (64…940 of 1023). */
export const fullToCodeValue = (v: number) => (64 + v * 876) / 1023;

/** What an 8-bit path makes of a 10-bit full-range code: 8-bit value, back on the 10-bit scale. */
export const via8bit = (code: number) => Math.round((Math.round((code * 255) / 1023) * 1023) / 255);

type F16Ctor = new (n: number) => { [i: number]: number; length: number; buffer: ArrayBufferLike };
const F16 = (globalThis as unknown as { Float16Array?: F16Ctor }).Float16Array;

/** Float16 rounding of a number (round to nearest even, as a Float16Array stores it). */
export function f16(v: number): number {
  if (!F16) throw new Error('Float16Array fehlt');
  const a = new F16(1); a[0] = v; return a[0];
}

// ---------------------------------------------------------------- pattern: 10-bit ramp

/**
 * Banding test, full-range codes 0…1023, grey. Four bands:
 *  1. whole ramp 0…1023 over the width;
 *  2. codes 384…639 stretched (4 × finer than 8 bit) – upper half 10 bit, lower half the same
 *     codes through an 8-bit path (via8bit);
 *  3. codes 0…127 stretched (dark end, where banding shows first) – same split;
 *  4. 16 patches 504…519, one code apart – upper half 10 bit, lower half 8 bit (groups of 4).
 * If upper and lower halves look the same, the chain to the eye carries only 8 bit.
 */
export function ramp10Raster(w: number, h: number): CodeRaster {
  const r = new CodeRaster(w, h, 0);
  const band = (i: number) => [Math.round((i * h) / 4), Math.round(((i + 1) * h) / 4)];
  const g = (v: number): [number, number, number] => [v, v, v];
  const [a0, a1] = band(0);
  for (let x = 0; x < w; x++) r.fill(x, a0, x + 1, a1, g(Math.min(1023, Math.floor((x * 1024) / w))));
  const zoom = (bi: number, lo: number, n: number) => {
    const [y0, y1] = band(bi), ym = Math.round((y0 + y1) / 2);
    for (let x = 0; x < w; x++) {
      const c = lo + Math.min(n - 1, Math.floor((x * n) / w));
      r.fill(x, y0, x + 1, ym, g(c)); r.fill(x, ym, x + 1, y1, g(via8bit(c)));
    }
  };
  zoom(1, 384, 256);
  zoom(2, 0, 128);
  const [d0, d1] = band(3), dm = Math.round((d0 + d1) / 2);
  for (let i = 0; i < 16; i++) {
    const x0 = Math.round((i * w) / 16), x1 = Math.round(((i + 1) * w) / 16), c = 504 + i;
    r.fill(x0, d0, x1, dm, g(c)); r.fill(x0, dm, x1, d1, g(via8bit(c)));
  }
  return r;
}

/** Captions of the ramp (drawn over the pattern in the output window, not in the scope frame). */
export function ramp10Labels(w: number, h: number): [number, number, string][] {
  const y = (i: number, f: number) => ((i + f) * h) / 4;
  return [
    [w * 0.01, y(0, 0.12), '0 … 1023 (10 bit)'],
    [w * 0.01, y(1, 0.12), '384 … 639 · 10 bit'], [w * 0.01, y(1, 0.62), '384 … 639 · über 8 bit'],
    [w * 0.01, y(2, 0.12), '0 … 127 · 10 bit'], [w * 0.01, y(2, 0.62), '0 … 127 · über 8 bit'],
    [w * 0.01, y(3, 0.12), '504 … 519 je 1 Code · 10 bit'], [w * 0.01, y(3, 0.62), 'dieselben Codes über 8 bit'],
  ];
}

// ---------------------------------------------------------------- canvas capabilities

export interface DeepCanvas {
  ctx: CanvasRenderingContext2D;
  /** 'float16' only if the context reports it (getContextAttributes) and float16 ImageData works. */
  colorType: 'float16' | 'unorm8';
}

/** 2D context, float16 where the browser offers it. */
export function deepContext(canvas: HTMLCanvasElement): DeepCanvas {
  try {
    const ctx = canvas.getContext('2d', { colorType: 'float16' } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | null;
    const attrs = ctx?.getContextAttributes() as (CanvasRenderingContext2DSettings & { colorType?: string }) | undefined;
    if (ctx && attrs?.colorType === 'float16' && F16) {
      new ImageData(new F16(4) as unknown as ImageDataArray, 1, 1, { pixelFormat: 'rgba-float16' } as ImageDataSettings);
      return { ctx, colorType: 'float16' };
    }
    if (ctx) return { ctx, colorType: 'unorm8' };
  } catch { /* fall through */ }
  return { ctx: canvas.getContext('2d')!, colorType: 'unorm8' };
}

const f16Settings = { pixelFormat: 'rgba-float16' } as ImageDataSettings;

/** Code raster into the canvas: float16 values (exact codes) or 8 bit (rounded). */
export function putRaster(dc: DeepCanvas, r: CodeRaster, rasterFull: boolean, mode: LevelMode) {
  const lut = new Float32Array(1024);
  for (let v = 0; v < 1024; v++) lut[v] = codeToValue(v, rasterFull, mode);
  const n = r.w * r.h;
  if (dc.colorType === 'float16' && F16) {
    const d = new F16(n * 4);
    for (let k = 0; k < n; k++) { d[k * 4] = lut[r.c[k * 3]]; d[k * 4 + 1] = lut[r.c[k * 3 + 1]]; d[k * 4 + 2] = lut[r.c[k * 3 + 2]]; d[k * 4 + 3] = 1; }
    dc.ctx.putImageData(new ImageData(d as unknown as ImageDataArray, r.w, r.h, f16Settings), 0, 0);
    return;
  }
  const img = dc.ctx.createImageData(r.w, r.h), d = img.data;
  for (let k = 0; k < n; k++) {
    d[k * 4] = Math.round(lut[r.c[k * 3]] * 255); d[k * 4 + 1] = Math.round(lut[r.c[k * 3 + 1]] * 255);
    d[k * 4 + 2] = Math.round(lut[r.c[k * 3 + 2]] * 255); d[k * 4 + 3] = 255;
  }
  dc.ctx.putImageData(img, 0, 0);
}

/** Canvas pixels as floats 0…1 (R, G, B, A per pixel). */
export function readPixels(dc: DeepCanvas, w: number, h: number): ArrayLike<number> {
  if (dc.colorType === 'float16') return dc.ctx.getImageData(0, 0, w, h, f16Settings).data as unknown as ArrayLike<number>;
  const d = dc.ctx.getImageData(0, 0, w, h).data, out = new Float32Array(d.length);
  for (let i = 0; i < d.length; i++) out[i] = d[i] / 255;
  return out;
}

/** Remap the drawn canvas from levels to codes 1:1 (fullToCodeValue on every pixel). */
export function remapToCodes(dc: DeepCanvas, w: number, h: number) {
  if (dc.colorType === 'float16' && F16) {
    const img = dc.ctx.getImageData(0, 0, w, h, f16Settings), d = img.data as unknown as { [i: number]: number; length: number };
    for (let i = 0; i < d.length; i++) if ((i & 3) !== 3) d[i] = fullToCodeValue(d[i]);
    dc.ctx.putImageData(img, 0, 0);
    return;
  }
  const img = dc.ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i++) if ((i & 3) !== 3) d[i] = Math.round(fullToCodeValue(d[i] / 255) * 255);
  dc.ctx.putImageData(img, 0, 0);
}

/** WebGL2 drawing buffer RGBA16F; returns the format that is really in use. */
export function glDeepBuffer(gl: WebGL2RenderingContext, w: number, h: number): 'RGBA16F' | 'RGBA8' {
  const g = gl as WebGL2RenderingContext & { drawingBufferStorage?: (f: number, w: number, h: number) => void; drawingBufferFormat?: number };
  if (typeof g.drawingBufferStorage !== 'function') return 'RGBA8';
  try {
    while (gl.getError() !== gl.NO_ERROR) { /* drain */ }
    g.drawingBufferStorage(gl.RGBA16F, w, h);
    if (gl.getError() !== gl.NO_ERROR) return 'RGBA8';
  } catch { return 'RGBA8'; }
  return g.drawingBufferFormat === gl.RGBA16F ? 'RGBA16F' : 'RGBA8';
}

/** What the browser says about the screen – a hint, no proof of what reaches the panel. */
export function screenHint(): string {
  const depth = typeof screen !== 'undefined' ? screen.colorDepth : 0;
  const hdr = typeof matchMedia === 'function' && matchMedia('(dynamic-range: high)').matches;
  return `Browser meldet ${depth} bit${depth >= 30 ? ` (${depth / 3} je Kanal)` : ''}${hdr ? ', HDR-fähig' : ''}`;
}

/** HUD line: what the pipeline delivers and what is not known. */
export function pipelineText(kind: string, mode?: LevelMode): string {
  const lvl = mode === 'code' ? ' · Codes 1:1 (Monitor auf Limited/Video-Range)' : mode === 'full' ? ' · Pegel Full (0–100 %)' : '';
  return `Pipeline: ${kind}${lvl} · ${screenHint()} · Monitor-Bittiefe unbekannt`;
}

// ---------------------------------------------------------------- 10-bit Y′CbCr frames for the bridge

export type Transfer10 = 'sdr' | 'pq' | 'hlg';
export interface Frame10Meta { w: number; h: number; full: boolean; colorspace: Colorspace; transfer: Transfer10 }

/** Header size of a 10-bit output frame (server/out10.mjs parses it). */
export const OUT10_HEADER = 12;

/**
 * 'LZ10', u16 width, u16 height (LE), u8 flags (bit 0: full range), u8 matrix (0: BT.709,
 * 1: BT.2020 NCL), u8 transfer (0 SDR, 1 PQ, 2 HLG), u8 reserved; then yuv422p10le planar
 * (Y′ w·h, Cb w/2·h, Cr w/2·h, uint16 LE, values 0…1023).
 */
export function frame10Buffer(m: Frame10Meta): { buf: ArrayBuffer; y: Uint16Array; cb: Uint16Array; cr: Uint16Array } {
  if (m.w % 2) throw new Error('Breite muss gerade sein (4:2:2)');
  const n = m.w * m.h, buf = new ArrayBuffer(OUT10_HEADER + n * 4), dv = new DataView(buf);
  [0x4c, 0x5a, 0x31, 0x30].forEach((b, i) => dv.setUint8(i, b));
  dv.setUint16(4, m.w, true); dv.setUint16(6, m.h, true);
  dv.setUint8(8, m.full ? 1 : 0); dv.setUint8(9, m.colorspace === '2020' ? 1 : 0);
  dv.setUint8(10, m.transfer === 'pq' ? 1 : m.transfer === 'hlg' ? 2 : 0);
  return {
    buf,
    y: new Uint16Array(buf, OUT10_HEADER, n),
    cb: new Uint16Array(buf, OUT10_HEADER + n * 2, n / 2),
    cr: new Uint16Array(buf, OUT10_HEADER + n * 3, n / 2),
  };
}

/**
 * Normalised R′G′B′ → 10-bit Y′, Cb, Cr, ITU-R BT.2100-3 Tab. 9 (p11) with n = 10:
 * narrow D = Round[(219·E′ + 16)·4], chroma Round[(224·E′ + 128)·4];
 * full D = Round[1023·E′], chroma Round[1023·E′ + 512]. Limited to 0…1023.
 */
export function yuv10(r: number, g: number, b: number, kr: number, kb: number, full: boolean): [number, number, number] {
  const y = kr * r + (1 - kr - kb) * g + kb * b;
  const cb = (b - y) / (2 * (1 - kb)), cr = (r - y) / (2 * (1 - kr));
  const q = (v: number) => Math.max(0, Math.min(1023, Math.round(v)));
  return full ? [q(1023 * y), q(1023 * cb + 512), q(1023 * cr + 512)] : [q((219 * y + 16) * 4), q((224 * cb + 128) * 4), q((224 * cr + 128) * 4)];
}

const matrixOf = (cs: Colorspace) => LUMA[cs];

/**
 * Code raster → exact 10-bit Y′CbCr (yuv10).
 * 4:2:2: chroma of an even/odd pixel pair averaged, rounded half up. In the BT.2111 bars all
 * edges sit on even columns (2K), so every chroma code there is exact too.
 */
export function rasterToFrame10(r: CodeRaster, full: boolean, colorspace: Colorspace, transfer: Transfer10) {
  const { kr, kb } = matrixOf(colorspace);
  const f = frame10Buffer({ w: r.w, h: r.h, full, colorspace, transfer });
  const cache = new Map<number, [number, number, number]>();
  const yuv = (k: number) => {
    const a = r.c[k * 3], b = r.c[k * 3 + 1], c = r.c[k * 3 + 2], key = (a * 1024 + b) * 1024 + c;
    let v = cache.get(key);
    if (!v) { v = yuv10(level10(a, full), level10(b, full), level10(c, full), kr, kb, full); cache.set(key, v); }
    return v;
  };
  fillFrame(f, r.w, r.h, yuv);
  return f.buf;
}

/**
 * Canvas pixels (floats, full range 0…1 R′G′B′) → 10-bit narrow Y′CbCr, as a monitor fed
 * over SDI/HDMI in video range expects it. Values outside 0…1 stay unclipped (within codes 0…1023).
 */
export function pixelsToFrame10(px: ArrayLike<number>, w: number, h: number, colorspace: Colorspace, transfer: Transfer10) {
  const { kr, kb } = matrixOf(colorspace);
  const f = frame10Buffer({ w, h, full: false, colorspace, transfer });
  fillFrame(f, w, h, (k) => yuv10(px[k * 4], px[k * 4 + 1], px[k * 4 + 2], kr, kb, false));
  return f.buf;
}

function fillFrame(f: ReturnType<typeof frame10Buffer>, w: number, h: number, yuv: (k: number) => [number, number, number]) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += 2) {
      const k = y * w + x, a = yuv(k), b = yuv(k + 1);
      f.y[k] = a[0]; f.y[k + 1] = b[0];
      const c = k >> 1;
      f.cb[c] = (a[1] + b[1] + 1) >> 1; f.cr[c] = (a[2] + b[2] + 1) >> 1;
    }
  }
}

// ---------------------------------------------------------------- 10-bit stream to the bridge

/** Codecs of the 10-bit stream (server/out10.mjs has the ffmpeg side). */
export const CODECS10 = ['hevc10', 'hevc422', 'v210', 'prores'] as const;
export type Codec10 = (typeof CODECS10)[number];
export const isCodec10 = (s: string | null): s is Codec10 => !!s && (CODECS10 as readonly string[]).includes(s);

/**
 * Sends 10-bit frames to the bridge (`/out?depth=10`), which pushes them with ffmpeg.
 * `frame()` returns a frame10 buffer or null (unchanged: the bridge repeats the last one).
 * Returns stop().
 */
export function startStream10(bridge: string, name: string, target: string, codec: Codec10, fps: number,
  frame: () => ArrayBuffer | null, status: (m: string) => void) {
  const q = new URLSearchParams({ name, fps: String(fps), depth: '10', codec, target });
  const ws = new WebSocket(`${bridge}/out?${q}`);
  let stopped = false;
  ws.onmessage = (e) => { try { const m = JSON.parse(e.data); status(m.message ?? m.type); } catch { /* ignore */ } };
  ws.onclose = () => { if (!stopped) status('beendet'); };
  ws.onerror = () => status('Bridge nicht erreichbar');
  const timer = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) { if (ws.readyState > 1) clearInterval(timer); return; }
    if (ws.bufferedAmount > 64_000_000) return;
    const f = frame();
    if (f) ws.send(f);
  }, 1000 / fps);
  return () => { stopped = true; clearInterval(timer); ws.close(); };
}
