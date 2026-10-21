// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Simulcast deviation map (idea 7, docs/research/simulcast-map.md): ΔE ITP (ITU-R BT.2124) per
// picture area between two stages of a source's chain – typically the HDR signal and its SDR
// conversion (CST/LUT), the SDR placed back into the HDR container with SDR 100 % = HDR
// reference white 203 cd/m² (BT.2408, docs/research/lut-cst.md). Pure functions, no DOM.

import { GAMUTS, deltaEITP, gamutConvert, isLog, mul3, rgb2020ToIctcp, rgbToXyzMatrix, signalToLinear, type GamutId, type Transfer } from './color';
import type { Decode } from './ycbcr';

/** How a stage's signal is to be read: transfer, gamut, HLG display peak. */
export interface StageSpace { transfer: Transfer; gamut: GamutId; lw: number }

/** BT.2408 reference white in cd/m²: linear 1.0 of every stage (SDR 100 %, HDR 58 % PQ / 75 % HLG). */
export const REF_WHITE = 203;

/**
 * ICtCp (PQ, BT.2100 Table 7) of a signal R′G′B′ as display light in cd/m²: signal → linear
 * (1.0 = reference white) → BT.2020 → × 203 cd/m². Negative light is clamped (BT.2124 Annex 4 §3:
 * constrain to the BT.2100 colour volume).
 */
export function stageIctcp(rgb: ArrayLike<number>, s: StageSpace): [number, number, number] {
  const ys = rgbToXyzMatrix(GAMUTS[s.gamut]).slice(3, 6);
  const lin = signalToLinear([rgb[0], rgb[1], rgb[2]], s.transfer, s.lw, ys);
  const m = s.gamut === '2020' ? null : gamutConvert(GAMUTS[s.gamut], GAMUTS['2020']);
  const l2020 = m ? mul3(m, lin) : lin;
  return rgb2020ToIctcp(l2020.map((v) => Math.max(0, v) * REF_WHITE));
}

export interface SimulcastStats {
  /** mean, 95th percentile and maximum ΔE ITP, share of samples above 1 (just noticeable) and above `limit` */
  mean: number; p95: number; max: number; overJnd: number; overLimit: number; samples: number;
}

export interface SimulcastMap { w: number; h: number; d: Float32Array; stats: SimulcastStats; scene: boolean }

/** Percentile with linear interpolation between ranks (as in calib/colorimetry). */
function percentile(sorted: Float32Array, p: number) {
  if (!sorted.length) return NaN;
  const r = (p / 100) * (sorted.length - 1), lo = Math.floor(r), hi = Math.ceil(r);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (r - lo);
}

/**
 * ΔE ITP on a grid of about `cells` samples (aspect kept) of a frame: each sample is the mean of
 * its cell's centre pixel; `applyA/B` take the frame's R′G′B′ to the stage signal.
 */
export function simulcastMap(
  frame: { px: ArrayLike<number>; w: number; h: number; decode: Decode },
  a: { apply: (rgb: number[]) => number[]; space: StageSpace },
  b: { apply: (rgb: number[]) => number[]; space: StageSpace },
  o: { cells?: number; limit?: number } = {},
): SimulcastMap {
  const cells = o.cells ?? 160 * 90, limit = o.limit ?? 3;
  const gw = Math.max(1, Math.min(frame.w, Math.round(Math.sqrt((cells * frame.w) / frame.h))));
  const gh = Math.max(1, Math.min(frame.h, Math.round((gw * frame.h) / frame.w)));
  const d = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const x = Math.min(frame.w - 1, Math.floor(((i + 0.5) * frame.w) / gw)), y = Math.min(frame.h - 1, Math.floor(((j + 0.5) * frame.h) / gh));
    const rgb = frame.decode(frame.px, (y * frame.w + x) * 4);
    d[j * gw + i] = deltaEITP(stageIctcp(a.apply(rgb), a.space), stageIctcp(b.apply(rgb), b.space));
  }
  const s = Float32Array.from(d).sort();
  let sum = 0, j1 = 0, jl = 0;
  for (const v of d) { sum += v; if (v > 1) j1++; if (v > limit) jl++; }
  return {
    w: gw, h: gh, d, scene: isLog(a.space.transfer) || isLog(b.space.transfer),
    stats: { mean: sum / d.length, p95: percentile(s, 95), max: s[s.length - 1], overJnd: j1 / d.length, overLimit: jl / d.length, samples: d.length },
  };
}

/**
 * Colour of a ΔE ITP value for the map: below 1 (not noticeable) transparent-dark, then a ramp
 * blue → yellow → red up to `scale`, above white. Returns RGBA 0–255.
 */
export function deviationColour(v: number, scale: number): [number, number, number, number] {
  if (!Number.isFinite(v)) return [0, 0, 0, 0];
  if (v <= 1) return [0, 0, 0, 0];
  if (v >= scale) return [255, 255, 255, 230];
  const t = Math.log(v) / Math.log(scale); // 1 … scale → 0 … 1
  const stops: [number, number[]][] = [[0, [40, 90, 220]], [0.5, [240, 210, 40]], [1, [230, 50, 40]]];
  const k = t < 0.5 ? 0 : 1, f = (t - stops[k][0]) / (stops[k + 1][0] - stops[k][0]);
  const c = stops[k][1].map((x, i) => Math.round(x + (stops[k + 1][1][i] - x) * f));
  return [c[0], c[1], c[2], 200];
}
