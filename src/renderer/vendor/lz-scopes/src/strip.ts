// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Picture history ("Bildhistorie", #196): several stills of the source side by side, each one
// step (default 1 s) older than its right neighbour, and below them the waveform over the same
// time – the sound's sample peaks (audio/dsp/envelope.ts) or, without sound, Y′ min–max of the
// picture (history.ts). Modelled on the video/audio input page of the Blackmagic Web Presenter
// (thumbnails −6 … 0 s above an audio waveform); used to check whether a short fault (a frozen
// frame, a flash, a dropout in the sound) really happened and when.
//
// The stills are the signal as it arrives (R′G′B′ code values, no display transform, no LUT), so
// a log or HLG picture looks flat here as it does on an uncorrected monitor.

import type { Decode } from './ycbcr';
import type { History } from './history';
import type { Envelope } from './audio/dsp/envelope';
import { t } from './i18n';

/** width of a stored still in pixels (height from the picture's aspect) */
export const STILL_W = 160;
/**
 * Stills are taken ten per step, at most ten a second: each tile is then at most 5 % of a step
 * off its nominal age (50 ms at 1 s), and the ring holds at most count × 10 + 10 stills
 * (≈ 60 KB each at 16:9) however long the step is.
 */
export const stillEveryMs = (step: number) => Math.max(100, (step * 1000) / 10);
export const STRIP_COUNTS = [3, 4, 5, 6, 8, 10] as const;
export const STRIP_STEPS = [0.5, 1, 2, 5] as const;

export interface StripSettings {
  /** number of stills */
  count?: number;
  /** distance between two stills in s */
  step?: number;
  /** waveform below the stills: sound if the source has some (auto), sound, picture luma, none */
  wave?: 'auto' | 'audio' | 'luma' | 'off';
  /** sound: first two channels or all (up to 8) */
  channels?: 'stereo' | 'all';
}
export const STRIP_DEFAULT: Required<StripSettings> = { count: 6, step: 1, wave: 'auto', channels: 'stereo' };
export const stripOpts = (s?: StripSettings): Required<StripSettings> => {
  const o = { ...STRIP_DEFAULT, ...s };
  return { ...o, count: Math.max(2, Math.min(12, Math.round(o.count))), step: Math.max(0.1, Math.min(5, o.step)) };
};

export interface Still { t: number; w: number; h: number; px: Uint8ClampedArray }

/**
 * Small RGBA still of a raw frame: each output pixel is the mean of 2 × 2 points of its cell
 * (a cheap box filter against aliasing on fine detail), values clipped to 0 … 1.
 */
export function stillFrom(px: ArrayLike<number>, w: number, h: number, decode: Decode, tw = STILL_W): Omit<Still, 't'> {
  tw = Math.max(1, Math.min(tw, w));
  const th = Math.max(1, Math.round((h * tw) / w));
  const out = new Uint8ClampedArray(tw * th * 4);
  const q = (v: number) => Math.max(0, Math.min(1, v)) * 255;
  for (let y = 0; y < th; y++) {
    const y0 = Math.min(h - 1, Math.floor(((y + 0.25) / th) * h)), y1 = Math.min(h - 1, Math.floor(((y + 0.75) / th) * h));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.min(w - 1, Math.floor(((x + 0.25) / tw) * w)), x1 = Math.min(w - 1, Math.floor(((x + 0.75) / tw) * w));
      const a = decode(px, (y0 * w + x0) * 4), b = decode(px, (y0 * w + x1) * 4), c = decode(px, (y1 * w + x0) * 4), d = decode(px, (y1 * w + x1) * 4);
      const o = (y * tw + x) * 4;
      out[o] = q((a[0] + b[0] + c[0] + d[0]) / 4);
      out[o + 1] = q((a[1] + b[1] + c[1] + d[1]) / 4);
      out[o + 2] = q((a[2] + b[2] + c[2] + d[2]) / 4);
      out[o + 3] = 255;
    }
  }
  return { w: tw, h: th, px: out };
}

/** Stills of the last `keep` ms, oldest first. */
export class StillRing {
  stills: Still[] = [];
  version = 0;
  push(s: Still, keepMs: number) {
    this.stills.push(s);
    const from = s.t - keepMs;
    let k = 0;
    while (k < this.stills.length - 1 && this.stills[k].t < from) k++;
    if (k) this.stills.splice(0, k);
    this.version++;
  }
  /** The still nearest to time `at`, if one lies within `tol` ms. */
  near(at: number, tol: number): Still | null {
    let best: Still | null = null, d = Infinity;
    for (const s of this.stills) { const e = Math.abs(s.t - at); if (e < d) { d = e; best = s; } }
    return best && d <= tol ? best : null;
  }
  clear() { this.stills = []; this.version++; }
}

/** Nominal ages of the tiles in s, left (oldest) to right (now). */
export const tileAges = (count: number, step: number) => Array.from({ length: count }, (_, i) => (count - 1 - i) * step);

/** Label of an age: "0" for now, else "−2 s" / "−0.5 s". */
export const ageLabel = (age: number) => (age === 0 ? '0' : `−${Number(age.toFixed(1))} s`);

// ---------------------------------------------------------------- drawing

const LABEL = 'rgba(230, 215, 170, 0.85)', GRID = 'rgba(210, 190, 120, 0.25)', DIM = 'rgba(210, 190, 120, 0.12)';
const WAVE = 'rgba(140, 255, 160, 0.75)', CLIP = 'rgba(255, 92, 92, 1)';
/** steps whose peak reaches this are drawn red: |sample| ≥ 0.999 ≈ −0.01 dBFS (digital full scale) */
export const CLIP_LEVEL = 0.999;

const stillCanvas = new WeakMap<Still, HTMLCanvasElement>();
function canvasOf(s: Still): HTMLCanvasElement {
  let c = stillCanvas.get(s);
  if (c) return c;
  c = document.createElement('canvas'); c.width = s.w; c.height = s.h;
  c.getContext('2d')!.putImageData(new ImageData(s.px as Uint8ClampedArray<ArrayBuffer>, s.w, s.h), 0, 0);
  stillCanvas.set(s, c);
  return c;
}

export interface StripInput {
  stills: StillRing;
  aspect: number;
  history: History;
  env: Envelope | null;
  names: string[];
  now: number;
}

/** The whole panel in `r` (CSS px). */
export function drawStrip(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, inp: StripInput, s?: StripSettings) {
  const o = stripOpts(s), ages = tileAges(o.count, o.step), span = o.count * o.step;
  const wave = o.wave === 'auto' ? (inp.env ? 'audio' : 'luma') : o.wave;
  const left = r.x + 4, w = r.w - 8, gap = 4;
  ctx.save();
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
  // --- stills: as wide as the panel allows, but at most 55 % of the height when a waveform follows
  const maxH = (wave === 'off' ? r.h - 16 : r.h * 0.55) - 14;
  let tw = (w - gap * (o.count - 1)) / o.count, th = tw / inp.aspect;
  if (th > maxH) { th = Math.max(8, maxH); tw = th * inp.aspect; }
  const rowW = tw * o.count + gap * (o.count - 1), x0 = left + (w - rowW) / 2, y0 = r.y;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ages.forEach((age, i) => {
    const x = x0 + i * (tw + gap), st = inp.stills.near(inp.now - age * 1000, stillEveryMs(o.step) * 0.75);
    if (st) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(canvasOf(st), x, y0, tw, th);
    } else {
      ctx.fillStyle = 'rgba(8,9,11,0.7)'; ctx.fillRect(x, y0, tw, th);
      ctx.fillStyle = '#6b7078'; ctx.fillText('–', x + tw / 2, y0 + th / 2 - 5);
    }
    ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y0 + 0.5, tw - 1, th - 1);
    ctx.fillStyle = LABEL; ctx.fillText(age === 0 ? t('tools.hist.now') : ageLabel(age), x + tw / 2, y0 + th + 2);
  });
  if (wave === 'off') { ctx.restore(); return; }
  // --- waveform over the last count × step seconds (right edge = now); marks at the stills' times
  const wy = y0 + th + 18, wh = r.y + r.h - wy - 14, wx = x0, ww = rowW;
  if (wh < 16) { ctx.restore(); return; }
  const xOf = (tm: number) => wx + ww - ((inp.now - tm) / (span * 1000)) * ww;
  const from = inp.now - span * 1000;
  ctx.strokeStyle = GRID; ctx.strokeRect(wx + 0.5, wy + 0.5, ww - 1, wh - 1);
  if (wave === 'audio') {
    const env = inp.env;
    if (!env) {
      ctx.fillStyle = '#6b7078'; ctx.textBaseline = 'middle'; ctx.fillText(t('panel.strip.noSound'), wx + ww / 2, wy + wh / 2);
    } else {
      const n = o.channels === 'all' ? Math.min(8, env.channels) : Math.min(2, env.channels);
      const idx = env.since(from), lh = wh / n;
      const pxStep = Math.max(1, ww / (span * 1000 / 10));
      for (let c = 0; c < n; c++) {
        const ly = wy + c * lh, mid = ly + lh / 2, amp = lh / 2 - 2;
        ctx.strokeStyle = DIM; ctx.beginPath();
        for (const v of [-0.5, 0, 0.5]) { ctx.moveTo(wx, mid - v * amp); ctx.lineTo(wx + ww, mid - v * amp); }
        ctx.stroke();
        // one column per screen pixel: min/max of all steps falling into it
        let col = -1, lo = Infinity, hi = -Infinity;
        const flush = () => {
          if (col < 0 || hi < lo) return;
          ctx.fillStyle = Math.max(-lo, hi) >= CLIP_LEVEL ? CLIP : WAVE;
          const a = mid - Math.min(1, hi) * amp, b = mid - Math.max(-1, lo) * amp;
          ctx.fillRect(col, a, pxStep, Math.max(1, b - a));
        };
        for (const j of idx) {
          const x = Math.floor(xOf(env.time[j]));
          if (x !== col) { flush(); col = x; lo = Infinity; hi = -Infinity; }
          lo = Math.min(lo, env.min[c][j]); hi = Math.max(hi, env.max[c][j]);
        }
        flush();
        ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        if (lh >= 14) ctx.fillText(inp.names[c] ?? String(c + 1), wx + 3, ly + 2);
        if (c) { ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(wx, ly + 0.5); ctx.lineTo(wx + ww, ly + 0.5); ctx.stroke(); }
      }
    }
  } else {
    const vis = inp.history.samples.filter((h) => h.t >= from);
    const ly = (v: number) => wy + wh - 1 - (Math.max(-0.07, Math.min(1.1, v)) + 0.07) / 1.17 * (wh - 2);
    ctx.strokeStyle = DIM; ctx.beginPath(); for (const v of [0, 0.5, 1]) { ctx.moveTo(wx, ly(v)); ctx.lineTo(wx + ww, ly(v)); } ctx.stroke();
    ctx.fillStyle = 'rgba(140, 255, 160, 0.22)';
    vis.forEach((h, i) => {
      const x = xOf(h.t), nx = i + 1 < vis.length ? xOf(vis[i + 1].t) : x + 1;
      ctx.fillRect(x, ly(h.yMax), Math.max(1, nx - x) + 0.5, Math.max(1, ly(h.yMin) - ly(h.yMax)));
    });
    ctx.strokeStyle = 'rgba(140,255,160,1)'; ctx.lineWidth = 1.5; ctx.beginPath();
    vis.forEach((h, i) => { const x = xOf(h.t), y = ly(h.yAvg); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('Luma Y′', wx + 3, wy + 2);
  }
  // marks where the stills were taken, and the seconds axis
  ctx.strokeStyle = 'rgba(230, 215, 170, 0.5)'; ctx.setLineDash([2, 3]); ctx.beginPath();
  for (const age of ages) { const x = Math.round(xOf(inp.now - age * 1000)) - 0.5; ctx.moveTo(x, wy); ctx.lineTo(x, wy + wh); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = LABEL; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const tick = span <= 12 ? 1 : span <= 30 ? 5 : 10;
  for (let sec = 0; sec <= span + 1e-6; sec += tick) {
    const x = wx + ww - (sec / span) * ww;
    ctx.fillText(sec ? `−${Number(sec.toFixed(1))}` : '0 s', Math.max(wx + 6, Math.min(wx + ww - 10, x)), wy + wh + 2);
  }
  ctx.restore();
}
