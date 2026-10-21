// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Closed loop over lz-camera-bridge and drift guard (#140 step 4, #150). Pure functions, no DOM
// (test/loop.test.ts).
//
// Loop: the levels of the camera's picture (ghost.ts traceLevels: black centroid, median,
// highlight per R′G′B′) against the reference camera give a signal error per paint value –
// black R/G/B from the black centroids, white R/G/B from the highlights, master gamma from the
// Y′ median. One step turns each error into bus units through the slope of the Touch Shading
// model (shading/model.ts, scaled by the measured slope of the camera family), damped, at most
// LIMITS.step per value – the same rails as a gesture. Measure again, repeat until every error
// is inside the tolerance. The model slope is only an estimate for a real camera; the loop
// converges as long as its sign is right, because every step is measured again.
//
// Drift guard: black floor (Y′ black centroid) and neutral balance (R′−G′, B′−G′ of the median)
// per camera against the group mean; a camera that moves away from the others is flagged.

import type { TraceLevels } from '../ghost';
import { FIELDS, LIMITS, clampValue, slope, slopeScale, type Channel, type Paint, type PaintField } from '../shading/model';

export interface LoopError { field: PaintField; channel: Channel | 'y'; level: number; error: number }

/** Signal error (reference − camera) per paint value the loop moves. */
export function loopErrors(cam: TraceLevels, ref: TraceLevels, o: { gamma?: boolean } = {}): LoopError[] {
  const out: LoopError[] = [];
  for (const c of ['r', 'g', 'b'] as Channel[]) {
    const k = c.toUpperCase() as 'R' | 'G' | 'B';
    out.push({ field: `black${k}` as PaintField, channel: c, level: cam[k].black, error: ref[k].black - cam[k].black });
    out.push({ field: `white${k}` as PaintField, channel: c, level: cam[k].peak, error: ref[k].peak - cam[k].peak });
  }
  if (o.gamma) out.push({ field: 'masterGamma', channel: 'g', level: cam.Y.median, error: ref.Y.median - cam.Y.median });
  return out;
}

export const LOOP_DEFAULTS = { tol: 0.005, deadband: 0.002, damping: 0.7, maxSteps: 25 } as const;

/** Largest |error| of a set (0 when empty). */
export const worstError = (e: LoopError[]) => e.reduce((m, x) => Math.max(m, Math.abs(x.error)), 0);
export const converged = (e: LoopError[], tol: number = LOOP_DEFAULTS.tol) => worstError(e) <= tol;

/**
 * Next paint values for one loop step. `start` is the paint at the start of the session (the
 * span rail); fields the camera does not report are left out. Returns only changed values.
 */
export function loopStep(errors: LoopError[], cur: Paint, start: Paint, mode = '', o: { damping?: number; deadband?: number } = {}): Paint {
  const damping = o.damping ?? LOOP_DEFAULTS.damping, dead = o.deadband ?? LOOP_DEFAULTS.deadband;
  const next: Paint = {};
  for (const e of errors) {
    const v = cur[e.field];
    if (v === undefined || Math.abs(e.error) <= dead) continue;
    // the channel's own curve; for master gamma the green curve stands for all three
    const ch: Channel = e.channel === 'y' ? 'g' : e.channel;
    const k = slope(e.field, ch, Math.min(0.98, Math.max(0.02, e.level)), cur) * slopeScale(mode, e.field);
    if (!Number.isFinite(k) || Math.abs(k) < 1e-6) continue;
    let d = Math.round((damping * e.error) / k);
    if (d === 0) d = Math.sign(e.error / k);
    d = Math.max(-LIMITS.step, Math.min(LIMITS.step, d));
    const n = clampValue(e.field, start[e.field] ?? v, v + d);
    if (n !== v && n >= FIELDS[e.field].min && n <= FIELDS[e.field].max) next[e.field] = n;
  }
  return next;
}

// ------------------------------------------------------------------ drift guard

export interface DriftInput { id: string; levels: TraceLevels }
export interface DriftRow { id: string; black: number; dBlack: number; rg: number; bg: number; dRg: number; dBg: number; alarm: boolean }
export const DRIFT_DEFAULTS = { black: 0.01, neutral: 0.01 } as const;

/** Each camera against the mean of all cameras (signal units; 0.01 = 1 %). */
export function driftRows(cams: DriftInput[], tol: { black?: number; neutral?: number } = {}): DriftRow[] {
  if (!cams.length) return [];
  const tb = tol.black ?? DRIFT_DEFAULTS.black, tn = tol.neutral ?? DRIFT_DEFAULTS.neutral;
  const v = cams.map(({ id, levels: l }) => ({ id, black: l.Y.black, rg: l.R.median - l.G.median, bg: l.B.median - l.G.median }));
  const mean = (f: (x: (typeof v)[number]) => number) => v.reduce((s, x) => s + f(x), 0) / v.length;
  const mb = mean((x) => x.black), mrg = mean((x) => x.rg), mbg = mean((x) => x.bg);
  return v.map((x) => {
    const dBlack = x.black - mb, dRg = x.rg - mrg, dBg = x.bg - mbg;
    return { ...x, dBlack, dRg, dBg, alarm: cams.length > 1 && (Math.abs(dBlack) > tb || Math.abs(dRg) > tn || Math.abs(dBg) > tn) };
  });
}
