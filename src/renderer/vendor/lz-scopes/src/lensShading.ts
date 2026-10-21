// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// White shading of a flat white field for the lens fingerprint; the least-squares fit is the
// shared white-shading core (surface.ts, as in whiteShading.ts) (idea 9, docs/research/lens-fingerprint.md).
// Pure functions, no DOM:
//   shadingGrid   cell means of R, G, B over the picture (or a region)
//   shadingFit    per channel, relative to the centre: saw H/V (linear) and parabola H/V
//                 (quadratic) after the camera controls named by Tektronix 25W-27159 and Sony
//                 "The Basics of Camera Technology" p. 10 (parabolic correction of lens fall-off)
//   centreColour  colour of the field centre as R/G and B/G (lens colour, white balance)
// Values are linear light when `linear` is passed (inverse BT.709 OETF), else code values.

import { bt709InverseOetf } from './color';
import { fitSurface, norm } from './surface';

export interface ShadingGrid { nx: number; ny: number; /** nx·ny·3 means, row-major, R G B */ rgb: Float32Array }

export interface GridFrame { px: ArrayLike<number>; w: number; h: number; decode: (px: ArrayLike<number>, i: number) => [number, number, number] }

/** Cell means of R, G, B on an nx × ny grid inside [x0, y0, x1, y1] (fractions of the picture). */
export function shadingGrid(f: GridFrame, nx = 16, ny = 9, region: [number, number, number, number] = [0, 0, 1, 1], linear = false): ShadingGrid {
  const rgb = new Float32Array(nx * ny * 3), n = new Float32Array(nx * ny);
  const X0 = Math.floor(region[0] * f.w), X1 = Math.ceil(region[2] * f.w), Y0 = Math.floor(region[1] * f.h), Y1 = Math.ceil(region[3] * f.h);
  const step = Math.max(1, Math.floor(Math.sqrt(((X1 - X0) * (Y1 - Y0)) / (nx * ny * 64))));
  for (let y = Y0; y < Y1; y += step) for (let x = X0; x < X1; x += step) {
    const cx = Math.min(nx - 1, Math.floor(((x - X0) * nx) / (X1 - X0))), cy = Math.min(ny - 1, Math.floor(((y - Y0) * ny) / (Y1 - Y0)));
    const c = f.decode(f.px, (y * f.w + x) * 4), k = cy * nx + cx;
    for (let i = 0; i < 3; i++) rgb[k * 3 + i] += linear ? bt709InverseOetf(c[i]) : c[i];
    n[k]++;
  }
  for (let k = 0; k < nx * ny; k++) for (let i = 0; i < 3; i++) rgb[k * 3 + i] /= n[k] || 1;
  return { nx, ny, rgb };
}

export interface ChannelShading {
  /** level at the centre (fit), and in % of it: saw = change from the centre to the right/bottom edge (linear term), par = edges against the centre (quadratic term, + = edges brighter) */
  centre: number; sawH: number; sawV: number; parH: number; parV: number;
  /** RMS of what the four terms leave, % of the centre */
  rest: number;
}
export interface ShadingFit { r: ChannelShading; g: ChannelShading; b: ChannelShading; /** luma deviation from the centre per cell, % */ map: Float32Array; nx: number; ny: number }

/**
 * Fit of one channel with the shared white-shading core (surface.ts, also behind whiteShading.ts):
 * v = c0 + c1·x + c2·y + c3·x² + c4·y² + c5·x·y over the cell centres, x and y from −1 (left/top)
 * to +1. Reported relative to the centre level c0; c5 (diagonal) counts into the rest.
 */
function fitChannel(g: ShadingGrid, ch: number): ChannelShading {
  const v = new Float32Array(g.nx * g.ny);
  for (let k = 0; k < v.length; k++) v[k] = g.rgb[k * 3 + ch];
  const s = fitSurface(v, g.nx, g.ny) ?? [0, 0, 0, 0, 0, 0];
  const a = s[0], pct = (x: number) => (a > 1e-9 ? (x / a) * 100 : NaN);
  let ss = 0;
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
    const x = norm(i, g.nx), y = norm(j, g.ny), m = s[0] + s[1] * x + s[2] * y + s[3] * x * x + s[4] * y * y;
    ss += (v[j * g.nx + i] - m) ** 2;
  }
  return { centre: a, sawH: pct(s[1]), sawV: pct(s[2]), parH: pct(s[3]), parV: pct(s[4]), rest: pct(Math.sqrt(ss / v.length)) };
}

export function shadingFit(g: ShadingGrid): ShadingFit {
  const r = fitChannel(g, 0), gg = fitChannel(g, 1), b = fitChannel(g, 2);
  const yc = 0.2126 * r.centre + 0.7152 * gg.centre + 0.0722 * b.centre;
  const map = new Float32Array(g.nx * g.ny);
  for (let k = 0; k < map.length; k++) {
    const y = 0.2126 * g.rgb[k * 3] + 0.7152 * g.rgb[k * 3 + 1] + 0.0722 * g.rgb[k * 3 + 2];
    map[k] = yc > 1e-9 ? (y / yc - 1) * 100 : NaN;
  }
  return { r, g: gg, b, map, nx: g.nx, ny: g.ny };
}

/** Colour of the field centre: R/G and B/G of the fitted centre levels. */
export const centreColour = (s: ShadingFit) => ({ rg: s.r.centre / s.g.centre, bg: s.b.centre / s.g.centre });

/** Synthetic white field (tests): per channel gain·(1 + saw·x + par·x² …) on a w × h RGBA 8-bit frame. */
export function syntheticField(w: number, h: number, ch: { gain: number; sawH?: number; sawV?: number; parH?: number; parV?: number }[]): GridFrame {
  const px = new Float32Array(w * h * 4);
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const x = (2 * (xx + 0.5)) / w - 1, y = (2 * (yy + 0.5)) / h - 1;
    for (let c = 0; c < 3; c++) {
      const k = ch[c];
      px[(yy * w + xx) * 4 + c] = k.gain * (1 + (k.sawH ?? 0) * x + (k.sawV ?? 0) * y + (k.parH ?? 0) * x * x + (k.parV ?? 0) * y * y);
    }
  }
  return { px, w, h, decode: (p, i) => [p[i], p[i + 1], p[i + 2]] };
}
