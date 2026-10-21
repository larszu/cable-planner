// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Shading assistant (#151): the pure part of the guided shading sequence (scope-wuensche.md wish 8),
// the black/flare assistant (idea 4) and the camera data line (wish 6). No DOM, no network
// (test/shadingGuide.test.ts); derivation and sources in docs/research/shading-ablauf.md.
//
// Levels are R′G′B′ in 0..1 (0 = black, 1 = 100 % white), as the decode of a frame delivers them.
// Tolerances are chosen, not taken from a standard – they are written down in the research note.

import type { PaintField } from './model';

export interface Means { r: number; g: number; b: number; y: number }
export interface FrameStats extends Means {
  /** highest channel value in the analysed area */
  max: number;
  /** share of samples with any channel at or above 100 % */
  clip: number;
  n: number;
}

export type Decode = (px: ArrayLike<number>, i: number) => [number, number, number] | number[];

/**
 * Means of R′, G′, B′, Y′ in `rect` and peak/clip share over the same area, every `stride`-th
 * pixel in both directions (the knee check needs the whole frame, not its centre).
 */
export function frameStats(px: ArrayLike<number>, w: number, decode: Decode, kr: number, kb: number, rect: [number, number, number, number], stride = 1): FrameStats | null {
  const [x0, y0, x1, y1] = rect, s = Math.max(1, Math.floor(stride)), kg = 1 - kr - kb;
  let r = 0, g = 0, b = 0, n = 0, max = -Infinity, clip = 0;
  for (let y = y0; y < y1; y += s) for (let x = x0; x < x1; x += s) {
    const v = decode(px, (y * w + x) * 4);
    r += v[0]; g += v[1]; b += v[2]; n++;
    const m = Math.max(v[0], v[1], v[2]);
    if (m > max) max = m;
    if (m >= 1) clip++;
  }
  if (!n) return null;
  r /= n; g /= n; b /= n;
  return { r, g, b, y: kr * r + kg * g + kb * b, max, clip: clip / n, n };
}

export const GUIDE_STEPS = ['black', 'blackBal', 'flare', 'grey', 'white', 'knee', 'matrix'] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];

/** Chosen tolerances (docs/research/shading-ablauf.md). */
export const GUIDE_TOL = {
  /** master black with the iris closed: Y′ between these (a little above 0 so noise is not cut off) */
  blackLo: 0.005, blackHi: 0.035,
  /** black balance: |R′−G′|, |B′−G′| with the iris closed */
  blackBal: 0.005,
  /** grey card and white card: |R′−G′|, |B′−G′| */
  neutral: 0.01,
  /** white card target level and window */
  white: 0.9, whiteWin: 0.03,
  /** knee: share of clipped samples and highest level allowed */
  clip: 0.002, peak: 1.05,
  /** flare: below this Y′ lift or chroma shift nothing is reported */
  flare: 0.003,
} as const;

export type StepState = 'ok' | 'adjust' | 'manual' | 'nodata';

/** One suggested move: a bus field of lz-camera-bridge and its direction. */
export interface Advice { field: PaintField | 'iris'; dir: 1 | -1 }

export interface StepResult {
  state: StepState;
  /** advice: which control to turn which way (empty when ok or not decidable) */
  advice: Advice[];
  /** the figures the step looks at, in 0..1 */
  values: Record<string, number>;
}

/** Flare vector: what opening the iris adds to black (open − closed), as Y′ and BT.709 Cb/Cr. */
export interface Flare { dy: number; dcb: number; dcr: number; chroma: number; angle: number; significant: boolean }

/** BT.709 colour difference (ITU-R BT.709-6 item 3.3) of a mean triple. */
export function cbcr(m: Means, kr = 0.2126, kb = 0.0722): [number, number] {
  return [(m.b - m.y) / (2 * (1 - kb)), (m.r - m.y) / (2 * (1 - kr))];
}

export function flareVector(closed: Means, open: Means, kr = 0.2126, kb = 0.0722): Flare {
  const [cb0, cr0] = cbcr(closed, kr, kb), [cb1, cr1] = cbcr(open, kr, kb);
  const dy = open.y - closed.y, dcb = cb1 - cb0, dcr = cr1 - cr0, chroma = Math.hypot(dcb, dcr);
  // angle as on a vectorscope: 0° = +Cb, counter-clockwise towards +Cr
  const angle = ((Math.atan2(dcr, dcb) * 180) / Math.PI + 360) % 360;
  return { dy, dcb, dcr, chroma, angle, significant: Math.abs(dy) > GUIDE_TOL.flare || chroma > GUIDE_TOL.flare };
}

/** Channel offsets against G′ and the advice that removes them (a higher channel is turned down). */
function balance(m: Means, tol: number, prefix: 'black' | 'white'): { ok: boolean; advice: Advice[]; dr: number; db: number } {
  const dr = m.r - m.g, db = m.b - m.g, advice: Advice[] = [];
  if (Math.abs(dr) > tol) advice.push({ field: `${prefix}R` as PaintField, dir: dr > 0 ? -1 : 1 });
  if (Math.abs(db) > tol) advice.push({ field: `${prefix}B` as PaintField, dir: db > 0 ? -1 : 1 });
  return { ok: !advice.length, advice, dr, db };
}

/**
 * Evaluate one step. `area` = measuring frame (centre third without one), `frame` = whole picture,
 * `closed` = black remembered with the iris closed (flare step).
 */
export function evaluateStep(step: GuideStep, area: FrameStats | null, frame: FrameStats | null, closed?: Means | null): StepResult {
  if (step === 'matrix') return { state: 'manual', advice: [], values: {} };
  if (step === 'knee') {
    if (!frame) return { state: 'nodata', advice: [], values: {} };
    const ok = frame.clip <= GUIDE_TOL.clip && frame.max <= GUIDE_TOL.peak;
    return { state: ok ? 'ok' : 'adjust', advice: [], values: { max: frame.max, clip: frame.clip } };
  }
  if (!area) return { state: 'nodata', advice: [], values: {} };
  const base = { y: area.y, dr: area.r - area.g, db: area.b - area.g };
  switch (step) {
    case 'black': {
      const advice: Advice[] = area.y < GUIDE_TOL.blackLo ? [{ field: 'masterBlack', dir: 1 }] : area.y > GUIDE_TOL.blackHi ? [{ field: 'masterBlack', dir: -1 }] : [];
      return { state: advice.length ? 'adjust' : 'ok', advice, values: base };
    }
    case 'blackBal': {
      const b = balance(area, GUIDE_TOL.blackBal, 'black');
      return { state: b.ok ? 'ok' : 'adjust', advice: b.advice, values: base };
    }
    case 'flare': {
      if (!closed) return { state: 'nodata', advice: [], values: base };
      const f = flareVector(closed, area);
      // a lift from flare is taken back with master black (as the flare control of a CCU does)
      const advice: Advice[] = f.dy > GUIDE_TOL.flare ? [{ field: 'masterBlack', dir: -1 }] : [];
      return { state: f.significant ? 'adjust' : 'ok', advice, values: { ...base, dy: f.dy, chroma: f.chroma, angle: f.angle } };
    }
    case 'grey': {
      // the bus has no gamma per channel: a cast in the mids only shows that black or white balance is off
      const ok = Math.abs(base.dr) <= GUIDE_TOL.neutral && Math.abs(base.db) <= GUIDE_TOL.neutral;
      return { state: ok ? 'ok' : 'adjust', advice: [], values: base };
    }
    case 'white': {
      const b = balance(area, GUIDE_TOL.neutral, 'white');
      const advice = [...b.advice];
      if (area.y < GUIDE_TOL.white - GUIDE_TOL.whiteWin) advice.unshift({ field: 'iris', dir: 1 });
      else if (area.y > GUIDE_TOL.white + GUIDE_TOL.whiteWin) advice.unshift({ field: 'iris', dir: -1 });
      return { state: advice.length ? 'adjust' : 'ok', advice, values: base };
    }
  }
}

/** Progress of the sequence: steps ticked off out of all. */
export function progress(done: readonly string[]): { done: number; total: number } {
  return { done: GUIDE_STEPS.filter((s) => done.includes(s)).length, total: GUIDE_STEPS.length };
}

// ------------------------------------------------------------------ camera data (wish 6)

export type Tally = 'program' | 'preview' | 'off';

/**
 * What lz-camera-bridge reports beside the paint values (CameraState in
 * packages/bridge/src/protocol/CcuClient.ts, `cameraTally` in BridgeServer.ts). Iris is the bus
 * value 0..255; gain, ND and shutter are the camera's own index – the bridge has no unit for them.
 */
export interface CameraData {
  iris?: number;
  masterGain?: number;
  ndFilter?: number;
  shutterSpeed?: number;
  /** Kelvin, only from cameras whose backend reports it (Sony MNC: colorTemperature) */
  colorTemp?: number;
  tally?: Tally;
}

export const CAMERA_DATA_FIELDS = ['iris', 'masterGain', 'ndFilter', 'shutterSpeed', 'colorTemp'] as const;

/** Read the camera data out of a `state` message; colour temperature under either name. */
export function cameraDataOf(st: Record<string, unknown>): Partial<CameraData> {
  const out: Partial<CameraData> = {};
  for (const f of ['iris', 'masterGain', 'ndFilter', 'shutterSpeed'] as const) if (typeof st[f] === 'number') out[f] = st[f] as number;
  const k = st.colorTemp ?? st.colorTemperature;
  if (typeof k === 'number' && k > 0) out.colorTemp = k;
  return out;
}

export function tallyOf(v: unknown): Tally | undefined {
  return v === 'program' || v === 'preview' || v === 'off' ? v : undefined;
}

/** Label/value pairs for display; unknown values as '–' (never invented). */
export function cameraDataRows(d: CameraData | undefined, L: { iris: string; gain: string; nd: string; shutter: string; temp: string; tally: string; tallyText: Record<Tally, string> }): [string, string][] {
  const v = (x: number | undefined, f: (n: number) => string) => (x === undefined ? '–' : f(x));
  return [
    [L.tally, d?.tally ? L.tallyText[d.tally] : '–'],
    [L.iris, v(d?.iris, (n) => `${Math.round(n)}/255`)],
    [L.gain, v(d?.masterGain, (n) => `#${Math.round(n)}`)],
    [L.nd, v(d?.ndFilter, (n) => `#${Math.round(n)}`)],
    [L.shutter, v(d?.shutterSpeed, (n) => `#${Math.round(n)}`)],
    [L.temp, v(d?.colorTemp, (n) => `${Math.round(n)} K`)],
  ];
}
