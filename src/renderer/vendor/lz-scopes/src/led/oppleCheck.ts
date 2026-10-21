// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// LED wall check with a light meter (Opple Light Master, #10/#11): measurement plan per
// cabinet, relative evaluation against a reference cabinet, white-point correction.
// Background and limits: docs/research/led-wall-und-messgeraete.md, part C.
//
// The Light Master is an illuminance meter with colour filters: its values are relative
// (cabinet against cabinet at the same distance), never standard-conform absolute
// luminance, and for narrow-band LED primaries only an approximation.

import { D65, inv3, mul3, xyToUv, xyToXyz, type XY } from '../color';
import { cctDuv, planckUv } from '../calib/colorimetry';
import type { PatchFrame, RGB } from '../patchSequencer';
import { cabinets, pictureSize, type WallConfig } from './wall';
import { num, t } from '../i18n';

export type XYZ = [number, number, number];
export type ColourKey = 'W' | 'L' | 'R' | 'G' | 'B';
export const COLOUR_LABELS: Record<ColourKey, string> = { W: t('led.col.W'), L: t('led.col.L'), R: t('led.col.R'), G: t('led.col.G'), B: t('led.col.B') };
/** Point name of the single full-field measurement. */
export const FULL_POINT = t('led.chk.fullArea');

export interface PlanOptions {
  /** 'all' cabinets, a list of labels (C1-R1 …) or one full-field point */
  points: 'all' | 'full' | string[];
  white: number;
  /** extra grey level (0 = none), e.g. 0.5 */
  gray: number;
  primaries: boolean;
}

export interface PlanStep { point: string; colour: ColourKey; frame: PatchFrame }

/** Steps grouped by point (the sensor moves once per cabinet), colours W, L, R, G, B. */
export function buildPlan(wall: WallConfig, o: PlanOptions): PlanStep[] {
  const pic = pictureSize(wall);
  const colours: [ColourKey, RGB][] = [['W', [o.white, o.white, o.white]]];
  if (o.gray > 0) colours.push(['L', [o.gray, o.gray, o.gray]]);
  if (o.primaries) colours.push(['R', [o.white, 0, 0]], ['G', [0, o.white, 0]], ['B', [0, 0, o.white]]);
  const steps: PlanStep[] = [];
  if (o.points === 'full') {
    for (const [colour, rgb] of colours) steps.push({ point: FULL_POINT, colour, frame: { rgb, window: 1, label: `${FULL_POINT} ${COLOUR_LABELS[colour]}` } });
    return steps;
  }
  const want = o.points === 'all' ? null : new Set(o.points.map((s) => s.trim().toUpperCase()));
  for (const c of cabinets(wall)) {
    if (want && !want.has(c.label)) continue;
    const rect = { x: (wall.offX + c.x) / pic.w, y: (wall.offY + c.y) / pic.h, w: c.w / pic.w, h: c.h / pic.h };
    for (const [colour, rgb] of colours) steps.push({ point: c.label, colour, frame: { rgb, rect, background: 0 } });
  }
  return steps;
}

/** Readings per point and colour (absolute meter XYZ, Y in lx). */
export type MeterResults = Map<string, Partial<Record<ColourKey, XYZ>>>;

export const xyOf = ([X, Y, Z]: number[]): XY => { const s = X + Y + Z; return s > 0 ? [X / s, Y / s] : [0, 0]; };

export interface PointStat {
  point: string;
  Y: number;
  /** luminance relative to the reference, % (0 = equal) */
  dY: number;
  xy: XY; uv: XY;
  /** CIE 1976 u′v′ distance to the reference */
  duv: number;
  dx: number; dy: number;
  cct: number; duvPlanck: number;
}

/** Evaluate the white (or another colour) of every point against the reference point. */
export function evaluatePoints(res: MeterResults, ref: string, colour: ColourKey = 'W'): PointStat[] {
  const r = res.get(ref)?.[colour];
  if (!r) return [];
  const rxy = xyOf(r), ruv = xyToUv(rxy);
  const out: PointStat[] = [];
  for (const [point, m] of res) {
    const v = m[colour];
    if (!v || !(v[1] > 0)) continue;
    const xy = xyOf(v), uv = xyToUv(xy), cd = cctDuv(xy);
    out.push({
      point, Y: v[1], dY: (v[1] / r[1] - 1) * 100, xy, uv,
      duv: Math.hypot(uv[0] - ruv[0], uv[1] - ruv[1]), dx: xy[0] - rxy[0], dy: xy[1] - rxy[1],
      cct: cd.cct, duvPlanck: cd.duv,
    });
  }
  return out;
}

export interface PointSummary { n: number; maxDY: number; minDY: number; uniformity: number; maxDuv: number }
export function summarize(stats: PointStat[]): PointSummary {
  const Y = stats.map((s) => s.Y);
  return {
    n: stats.length, maxDY: Math.max(...stats.map((s) => s.dY)), minDY: Math.min(...stats.map((s) => s.dY)),
    uniformity: (Math.min(...Y) / Math.max(...Y)) * 100, maxDuv: Math.max(...stats.map((s) => s.duv)),
  };
}

// ---------------------------------------------------------------- white point

export interface WhiteTarget { id: string; name: string; xy: () => XY }
/** Chromaticity of a Planckian radiator at T (Krystek approximation in src/calib/colorimetry.ts). */
export function planckXy(T: number): XY {
  const [u, v] = planckUv(T), d = 2 * u - 8 * v + 4;
  return [(3 * u) / d, (2 * v) / d];
}
export const WHITE_TARGETS: WhiteTarget[] = [
  { id: 'd65', name: t('led.target.d65'), xy: () => D65 },
  { id: 'd50', name: t('led.target.d50'), xy: () => [0.3457, 0.3585] },
  { id: 'p6500', name: '6500 K Planck', xy: () => planckXy(6500) },
  { id: 'p5600', name: '5600 K Planck', xy: () => planckXy(5600) },
  { id: 'p3200', name: '3200 K Planck', xy: () => planckXy(3200) },
];

export interface WhiteCorrection {
  ist: { xy: XY; cct: number; duv: number; Y: number };
  soll: { xy: XY; cct: number; duv: number };
  /** CIE 1976 u′v′ distance actual → target */
  duv: number;
  /** relative gains R, G, B in % (the largest = 100) – the processor's per-channel gain/brightness */
  gains: [number, number, number] | null;
  /** white luminance after applying the gains, % of now */
  luminanceAfter: number | null;
  /** |R+G+B − W| / W_Y in %, only with measured primaries */
  additivity: number | null;
  primariesSource: 'measured' | 'entered' | null;
  warnings: string[];
}

/**
 * White point correction (derivation in docs/research/led-wall-und-messgeraete.md C.4): with
 * additive channels and linear processor gains, W = M·(1,1,1), M = [XYZ_R XYZ_G XYZ_B]; the
 * gains for a target chromaticity are g = M⁻¹·XYZ_t, scaled so the largest is 100 %.
 * M comes from measured primaries or from primary chromaticities xy plus the measured white
 * (M = P·diag(s), s = P⁻¹·W – the normalized-primary-matrix construction of src/color.ts).
 */
export function whiteCorrection(W: XYZ, target: XY, primaries: { measured?: [XYZ, XYZ, XYZ]; xy?: [XY, XY, XY] }): WhiteCorrection {
  const warnings: string[] = [];
  const ixy = xyOf(W), icd = cctDuv(ixy), tcd = cctDuv(target);
  const [iu, iv] = xyToUv(ixy), [tu, tv] = xyToUv(target);
  const base: WhiteCorrection = {
    ist: { xy: ixy, cct: icd.cct, duv: icd.duv, Y: W[1] }, soll: { xy: target, cct: tcd.cct, duv: tcd.duv },
    duv: Math.hypot(iu - tu, iv - tv), gains: null, luminanceAfter: null, additivity: null, primariesSource: null, warnings,
  };
  let M: number[] | null = null;
  if (primaries.measured) {
    const [R, G, B] = primaries.measured;
    M = [R[0], G[0], B[0], R[1], G[1], B[1], R[2], G[2], B[2]];
    base.primariesSource = 'measured';
    const sum = [0, 1, 2].map((i) => R[i] + G[i] + B[i]);
    base.additivity = (Math.hypot(sum[0] - W[0], sum[1] - W[1], sum[2] - W[2]) / W[1]) * 100;
    if (base.additivity > 5) warnings.push(t('led.chk.notAdditive', { v: num(base.additivity, 1) }));
    warnings.push(t('led.chk.oppleApprox'));
  } else if (primaries.xy) {
    const P = primaries.xy.map(xyToXyz);
    const Pm = [P[0][0], P[1][0], P[2][0], P[0][1], P[1][1], P[2][1], P[0][2], P[1][2], P[2][2]];
    const s = mul3(inv3(Pm), W);
    if (s.some((v) => !(v > 0))) warnings.push(t('led.chk.outsideTriangle'));
    M = Pm.map((v, i) => v * s[i % 3]);
    base.primariesSource = 'entered';
  }
  if (!M) return base;
  const Minv = inv3(M);
  if (Minv.some((v) => !Number.isFinite(v))) { warnings.push(t('led.chk.dependent')); return base; }
  const g = mul3(Minv, xyToXyz(target).map((v) => v * W[1]));
  const mx = Math.max(...g);
  if (!(mx > 0) || g.some((v) => v < 0)) { warnings.push(t('led.chk.outsideGamut')); return base; }
  const gains = g.map((v) => (v / mx) * 100) as [number, number, number];
  base.gains = gains;
  base.luminanceAfter = (1 / mx) * 100;
  return base;
}

// ---------------------------------------------------------------- report

const f = (v: number, d: number) => (Number.isFinite(v) ? v.toFixed(d) : '');

export function meterCsv(wall: WallConfig, res: MeterResults, ref: string, stats: PointStat[], corr: WhiteCorrection | null, flicker: string, distance: string) {
  const lines = [
    `# ${t('led.chk.csvHead')}`,
    `# ${t('led.csv.wall')},"${wall.name.replace(/"/g, '""')}",${t('led.chk.csvRef')},${ref},${t('led.chk.csvDistance')},"${distance.replace(/"/g, '""')}"`,
    ...(flicker ? [`# ${t('led.chk.csvFlicker')},"${flicker}"`] : []),
    'point,colour,X,Y_lx,Z,x,y',
    ...[...res].flatMap(([p, m]) => (Object.entries(m) as [ColourKey, XYZ][]).map(([c, v]) => { const xy = xyOf(v); return [p, c, f(v[0], 4), f(v[1], 4), f(v[2], 4), f(xy[0], 5), f(xy[1], 5)].join(','); })),
    '',
    'point,Y_lx,dY_percent,dx,dy,du_v_1976,cct_k,duv_planck',
    ...stats.map((s) => [s.point, f(s.Y, 3), f(s.dY, 2), f(s.dx, 5), f(s.dy, 5), f(s.duv, 5), f(s.cct, 0), f(s.duvPlanck, 5)].join(',')),
  ];
  if (corr) {
    lines.push('', 'white_point,x,y,cct_k,duv',
      ['measured', f(corr.ist.xy[0], 5), f(corr.ist.xy[1], 5), f(corr.ist.cct, 0), f(corr.ist.duv, 5)].join(','),
      ['target', f(corr.soll.xy[0], 5), f(corr.soll.xy[1], 5), f(corr.soll.cct, 0), f(corr.soll.duv, 5)].join(','),
      `delta_u_v_1976,${f(corr.duv, 5)}`);
    if (corr.gains) lines.push(`gains_percent_rgb,${corr.gains.map((g) => f(g, 1)).join(',')},primaries,${corr.primariesSource},luminance_after_percent,${f(corr.luminanceAfter ?? NaN, 1)}`);
    for (const w of corr.warnings) lines.push(`# ${t('led.chk.csvNote')},"${w.replace(/"/g, '""')}"`);
  }
  return lines.join('\n') + '\n';
}
