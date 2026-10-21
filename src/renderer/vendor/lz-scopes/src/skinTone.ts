// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Skin tone across all cameras (scope-wuensche.md idea 2, kamera-abgleich.md step 3): the skin
// pixels of the faces in several sources (face.ts, or the measuring frame) as coloured point clouds
// in one vectorscope, with the centre of each cloud, its hue against the skin-tone line and its
// saturation – so the cameras can be matched on the same face colour although they see it from
// different angles. Pure functions, no DOM (test/skinTone.test.ts).
//
// Skin pixels use the qualifier of the skin waveform (renderer.ts isSkin): luma window lo…hi and
// hue within ±tol of the skin-tone line, chroma above 0.012. Hue is the vectorscope angle
// atan2(Cr, Cb) in degrees (the skin-tone line lies at 123°); saturation is |CbCr| / 0.5 (100 %
// = the radius of a 100 % primary's chroma scale).

import { SKIN_LINE_DEG } from './color';

export interface SkinQualifier { lo: number; hi: number; tol: number; hue?: number }
export interface SkinCloud { pts: [number, number][]; n: number; cb: number; cr: number; hue: number; sat: number; spread: number }

const angle = (cb: number, cr: number) => (Math.atan2(cr, cb) * 180) / Math.PI;
/** Signed difference a − b of two angles in degrees, −180 … 180. */
export const hueDelta = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

/**
 * Skin pixels of R′G′B′ samples as Cb/Cr points, and the statistics of the cloud
 * (mean Cb/Cr → hue and saturation, RMS distance from the centre = spread). Null below `minN` pixels.
 */
export function skinCloud(samples: ArrayLike<ArrayLike<number>>, kr: number, kb: number, q: SkinQualifier, maxPts = 3000, minN = 20): SkinCloud | null {
  const kg = 1 - kr - kb, line = q.hue ?? SKIN_LINE_DEG;
  const all: [number, number][] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i], Y = kr * s[0] + kg * s[1] + kb * s[2];
    if (Y < q.lo || Y > q.hi) continue;
    const cb = (s[2] - Y) / (2 * (1 - kb)), cr = (s[0] - Y) / (2 * (1 - kr));
    if (Math.hypot(cb, cr) <= 0.012 || Math.abs(hueDelta(angle(cb, cr), line)) > q.tol) continue;
    all.push([cb, cr]);
  }
  const n = all.length;
  if (n < minN) return null;
  let cb = 0, cr = 0;
  for (const [b, r] of all) { cb += b; cr += r; }
  cb /= n; cr /= n;
  let sp = 0;
  for (const [b, r] of all) sp += (b - cb) ** 2 + (r - cr) ** 2;
  const step = Math.max(1, Math.ceil(n / maxPts));
  return { pts: all.filter((_, i) => i % step === 0), n, cb, cr, hue: angle(cb, cr), sat: Math.hypot(cb, cr) / 0.5, spread: Math.sqrt(sp / n) / 0.5 };
}

/** Distinct colours for up to eight clouds (sRGB), readable on the dark vectorscope. */
export const CLOUD_COLOURS = ['#ffb840', '#4fd1ff', '#ff5cdc', '#7dff6b', '#ff6b6b', '#c9a0ff', '#ffffff', '#ffe066'];

/**
 * One legend row: label, hue H (and its offset from the skin-tone line), saturation S, and for
 * every cloud but the reference ΔH / ΔS against the reference cloud.
 */
export function cloudRow(label: string, c: SkinCloud, ref: SkinCloud | null, line = SKIN_LINE_DEG): string {
  const d = (v: number, digits: number) => `${v < -0.05 ? '−' : '+'}${Math.abs(v).toFixed(digits)}`;
  let row = `${label}  H ${c.hue.toFixed(1)}° (${d(hueDelta(c.hue, line), 1)})  S ${(c.sat * 100).toFixed(1)} %`;
  if (ref && ref !== c) row += `  ΔH ${d(hueDelta(c.hue, ref.hue), 1)}°  ΔS ${d((c.sat - ref.sat) * 100, 1)}`;
  return row;
}
