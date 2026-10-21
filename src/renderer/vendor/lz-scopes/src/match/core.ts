// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Colour targets and source ↔ target comparison (issue #55). Pure functions, no DOM.
//
// CI colours are given as sRGB code values (hex, RGB 8/10 bit). Rec.709 and sRGB share
// primaries and D65 white; they differ in the transfer curve (IEC 61966-2-1 piecewise vs.
// BT.1886 γ 2.4). Two interpretations (docs/research/farbziele.md):
//  - 'video': the code value is the video signal (graphics/broadcast practice: #RRGGBB/255 =
//    R′G′B′ 0…100 %, i.e. 0 → 16, 255 → 235 in legal range). Display light via BT.1886.
//  - 'srgb': the colour is the light an sRGB display shows (sRGB EOTF); the video signal is
//    then the BT.1886 inverse of that light (shadows differ, mid-tones a few %).
// Every comparison happens in the measured source's own encoding.

import {
  BAR_COLORS, GAMUTS, bt709InverseOetf, bt709Oetf, gammaEotf, gammaInverse, gamutConvert, isLog, linearToSignal, mul3, rgbToXyzMatrix,
  signalToLinear, xyzToLab, ycbcr, type Colorspace, type DisplaySpace,
} from '../color';
import { deltaE, type Space } from '../deltae';
import { num, t, type Key } from '../i18n';

export type Interp = 'video' | 'srgb';
export type Rgb = [number, number, number];

/** Input formats of a CI colour. */
export type InputFormat = 'hex' | 'rgb8' | 'rgb10' | 'legal8' | 'legal10';
export const INPUT_FORMATS: [InputFormat, string][] = [
  ['hex', t('match.input.hex')], ['rgb8', t('match.input.rgb8')], ['rgb10', t('match.input.rgb10')],
  ['legal8', t('match.input.legal8')], ['legal10', t('match.input.legal10')],
];

/**
 * Parses a colour in the given format into normalised code values 0…1 (0 = black, 1 = white).
 * Legal-range input (BT.709/BT.2100 narrow: D = 219·E′·2^(n−8) + 16·2^(n−8)) is mapped to the
 * same 0…1 scale. Returns null for anything that does not parse or lies outside the code range.
 */
export function parseColor(text: string, fmt: InputFormat): Rgb | null {
  const t = text.trim();
  if (fmt === 'hex') {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(t);
    if (!m) return null;
    const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
    return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) as Rgb;
  }
  const n = t.replace(/^[a-z]*\(|\)$/gi, '').split(/[\s,;/]+/).filter(Boolean).map(Number);
  if (n.length !== 3 || n.some((v) => !Number.isFinite(v))) return null;
  const [lo, hi, max] = fmt === 'rgb8' ? [0, 255, 255] : fmt === 'rgb10' ? [0, 1023, 1023] : fmt === 'legal8' ? [16, 235, 255] : [64, 940, 1023];
  if (n.some((v) => v < 0 || v > max)) return null;
  return n.map((v) => (v - lo) / (hi - lo)) as Rgb;
}

/** Code values of a normalised level: full range 0…2^n−1 or legal 16–235 / 64–940 (BT.2100 Tab. 9). */
export function codes(v: number[], bits: 8 | 10, legal: boolean): number[] {
  const s = 2 ** (bits - 8);
  return v.map((x) => Math.round(legal ? (219 * x + 16) * s : (2 ** bits - 1) * x));
}

export const toHex = (v: number[]) => '#' + v.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const outside = (v: number[], eps = 0.5 / 255) => v.some((x) => x < -eps || x > 1 + eps);

/**
 * Light of a CI code value relative to white (1.0), Rec.709/sRGB primaries. For camera log
 * targets the 'video' value is read as a Rec.709 camera signal (BT.709 inverse OETF → scene
 * light), like the vectorscope bar targets of log sources (color.ts logBarTargets).
 */
function ciLight(v: number[], interp: Interp, log: boolean): number[] {
  if (interp === 'srgb') return v.map((x) => gammaEotf('srgb', x));
  return log ? v.map((x) => Math.sign(x) * bt709InverseOetf(Math.abs(x))) : v.map((x) => gammaEotf('sdr', x));
}
function ciCode(l: number[], interp: Interp, log: boolean): number[] {
  if (interp === 'srgb') return l.map((x) => gammaInverse('srgb', x));
  return log ? l.map((x) => Math.sign(x) * bt709Oetf(Math.abs(x))) : l.map((x) => gammaInverse('sdr', x));
}

/** CI colour (normalised code values) → signal R′G′B′ in the encoding of a source. */
export function ciToSignal(v: number[], interp: Interp, s: Space): Rgb {
  const lin = mul3(gamutConvert(GAMUTS['709'], GAMUTS[s.gamut]), ciLight(v, interp, isLog(s.transfer)));
  return linearToSignal(lin, s.transfer, s.hlgLw) as Rgb;
}

/** Signal of a source → CI code values (0…1, may lie outside when the colour is outside sRGB). */
export function signalToCi(rgb: number[], interp: Interp, s: Space): { v: Rgb; outside: boolean } {
  const lin = mul3(gamutConvert(GAMUTS[s.gamut], GAMUTS['709']), signalToLinear(rgb, s.transfer, s.hlgLw));
  const v = ciCode(lin, interp, isLog(s.transfer)) as Rgb;
  return { v, outside: outside(v) };
}

/** Signal of one encoding → signal of another (via linear light; log ↔ display only approximate). */
export function convertSignal(rgb: number[], from: Space, to: Space): Rgb {
  if (from.transfer === to.transfer && from.gamut === to.gamut && from.hlgLw === to.hlgLw) return [rgb[0], rgb[1], rgb[2]];
  const lin = mul3(gamutConvert(GAMUTS[from.gamut], GAMUTS[to.gamut]), signalToLinear(rgb, from.transfer, from.hlgLw));
  return linearToSignal(lin, to.transfer, to.hlgLw) as Rgb;
}

/** A colour target: measured signal (with the encoding it came from) or a CI definition. */
export interface ColorTarget {
  name: string;
  /** signal R′G′B′; for CI targets the Rec.709-SDR signal (kept for older configurations) */
  rgb: Rgb;
  /** list, e.g. the customer's CI ('' = no list) */
  group?: string;
  /** CI definition: normalised code values and how to read them */
  ci?: { v: Rgb; interp: Interp };
  /** encoding of `rgb` when measured from a source (missing = same encoding as the measured source) */
  space?: Space;
}

/** Target as a signal in the encoding of the source it is compared with. */
export function targetSignal(t: ColorTarget, s: Space): Rgb {
  if (t.ci) return ciToSignal(t.ci.v, t.ci.interp, s);
  if (t.space) return convertSignal(t.rgb, t.space, s);
  return t.rgb;
}

/** Hue angle (° counter-clockwise from +Cb, as on the vectorscope), saturation (|CbCr|/0.5) and luma. */
export function hueSatLuma(rgb: number[], cs: Colorspace) {
  const { y, cb, cr } = ycbcr(rgb[0], rgb[1], rgb[2], cs);
  return { y, deg: ((Math.atan2(cr, cb) * 180) / Math.PI + 360) % 360, sat: Math.hypot(cb, cr) / 0.5 };
}
/** Signed shortest angle from a to b in degrees (−180…180]. */
export const angleDiff = (a: number, b: number) => { const d = (((b - a) % 360) + 540) % 360 - 180; return d === -180 ? 180 : d; };

const BAR_NAMES: Record<string, Key> = { R: 'match.bar.R', Mg: 'match.bar.Mg', B: 'match.bar.B', Cy: 'match.bar.Cy', G: 'match.bar.G', Yl: 'match.bar.Yl' };
/** Vectorscope angles of the 75 % bars in a colour space. */
export function barAngles(cs: Colorspace) {
  return BAR_COLORS.map(({ label, rgb }) => ({ name: t(BAR_NAMES[label]), deg: hueSatLuma(rgb.map((v) => v * 0.75), cs).deg }));
}
/** Name of the bar colour nearest to a hue angle. */
export function hueName(deg: number, cs: Colorspace) {
  return barAngles(cs).reduce((a, b) => (Math.abs(angleDiff(deg, b.deg)) < Math.abs(angleDiff(deg, a.deg)) ? b : a)).name;
}
/** Bar colour reached first when turning from `from` by `delta` degrees (direction word). */
export function towards(from: number, delta: number, cs: Colorspace) {
  const ahead = barAngles(cs).map((b) => ({ ...b, d: ((Math.sign(delta) * angleDiff(from, b.deg)) + 360) % 360 })).filter((b) => b.d > 0.5);
  return ahead.sort((a, b) => a.d - b.d)[0]?.name ?? '';
}

/** CIELAB L*, C*ab, h_ab of a signal (relative to the reference white of the encoding). */
export function labOf(rgb: number[], s: Space) {
  const M = rgbToXyzMatrix(GAMUTS[s.gamut]), white = mul3(M, [1, 1, 1]);
  const [L, a, b] = xyzToLab(mul3(M, signalToLinear(rgb, s.transfer, s.hlgLw)), white);
  return { L, a, b, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/**
 * Traffic light of a colour difference. ΔE formulas are designed so that 1.0 ≈ a just
 * noticeable difference; 3 is the DisplayCAL "recommended" maximum for single patches
 * (docs/research/colour-repos.md). ΔITP has no researched limit: same steps, marked as such.
 */
export function deVerdict(value: number, tol = 3): { level: 0 | 1 | 2; text: string } {
  if (value <= 1) return { level: 0, text: t('match.verdict.0') };
  if (value <= tol) return { level: 1, text: t('match.verdict.1') };
  return { level: 2, text: t('match.verdict.2') };
}

export interface Comparison {
  de: { value: number; metric: 'ΔE00' | 'ΔITP' };
  /** CIELAB differences target − source (CIEDE2000 definition of ΔH: 2√(C1C2)·sin(Δh/2)) */
  dL: number; dC: number; dH: number; dh: number;
  src: { y: number; deg: number; sat: number; lab: ReturnType<typeof labOf> };
  ref: { y: number; deg: number; sat: number; lab: ReturnType<typeof labOf> };
  /** corrections that move the source onto the target (vectorscope terms of the source) */
  hueDeg: number; satPct: number; lumaPct: number; lumaPts: number;
}

/** Source and target, both as signal in the source's encoding `s` and colour space `cs`. */
export function compare(src: number[], ref: number[], s: Space, cs: Colorspace): Comparison {
  const a = hueSatLuma(src, cs), b = hueSatLuma(ref, cs);
  const la = labOf(src, s), lb = labOf(ref, s);
  const dh = angleDiff(la.h, lb.h);
  return {
    de: deltaE(s, src, ref),
    dL: lb.L - la.L, dC: lb.C - la.C, dh, dH: 2 * Math.sqrt(la.C * lb.C) * Math.sin((dh * Math.PI) / 360),
    src: { ...a, lab: la }, ref: { ...b, lab: lb },
    hueDeg: a.sat < 0.01 || b.sat < 0.01 ? 0 : angleDiff(a.deg, b.deg),
    satPct: a.sat > 1e-4 ? (b.sat / a.sat - 1) * 100 : 0,
    lumaPct: a.y > 1e-4 ? (b.y / a.y - 1) * 100 : 0,
    lumaPts: (b.y - a.y) * 100,
  };
}

const sg = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${num(Math.abs(v), d)}`;

/** Correction in words and values. Below the noise limits a quantity is reported as fitting. */
export function correctionText(c: Comparison, cs: Colorspace): string[] {
  const out: string[] = [];
  // neutral reference (grey card, white): there is no hue to turn to, only a cast to remove
  const neutral = c.ref.sat < 0.02;
  if (neutral) out.push(c.src.sat < 0.01 ? t('match.fix.bothNeutral') : t('match.fix.castRemove', { pct: num(c.src.sat * 100, 1), hue: hueName(c.src.deg, cs) }));
  else if (Math.abs(c.hueDeg) < 0.5) out.push(t('match.fix.hueOk'));
  else out.push(t(c.hueDeg > 0 ? 'match.fix.hueCcw' : 'match.fix.hueCw', { deg: sg(c.hueDeg), hue: towards(c.src.deg, c.hueDeg, cs) }));
  if (!neutral) out.push(Math.abs(c.satPct) < 1 ? t('match.fix.satOk') : t(c.satPct > 0 ? 'match.fix.satMore' : 'match.fix.satLess', { pct: sg(c.satPct) }));
  out.push(Math.abs(c.lumaPts) < 0.5 ? t('match.fix.lumaOk') : t('match.fix.luma', { pct: sg(c.lumaPct), from: num(c.src.y * 100, 1), to: num(c.ref.y * 100, 1) }));
  return out;
}

/**
 * The same correction in camera and grading terms. Sony HDC: MULTI MATRIX = 16-axis colour
 * corrector for one selected hue (hue and saturation), USER MATRIX = classic linear matrix
 * (HDC-25 Technical Information p18). Neutral references: white balance (R/B gain).
 */
export function cameraText(c: Comparison, src: number[], ref: number[], s: Space, cs: Colorspace): string[] {
  const out: string[] = [];
  if (c.ref.sat < 0.02) {
    const ls = signalToLinear(src, s.transfer, s.hlgLw), lr = signalToLinear(ref, s.transfer, s.hlgLw);
    const k = (lr[1] || 1e-6) / (ls[1] || 1e-6); // keep green, match R and B to it
    const gain = (i: number) => (ls[i] > 1e-5 ? ((lr[i] / ls[i]) / k - 1) * 100 : 0);
    out.push(t('match.cam.wb', { r: sg(gain(0)), b: sg(gain(2)) }));
  } else {
    const axis = hueName(c.src.deg, cs);
    out.push(t('match.cam.matrix', { axis, deg: sg(c.hueDeg), sat: sg(c.satPct) }));
    out.push(t('match.cam.resolve', { deg: sg(c.hueDeg), sat: num(1 + c.satPct / 100, 2) }));
  }
  if (Math.abs(c.lumaPts) >= 0.5) out.push(t('match.cam.luma', { pct: sg(c.lumaPct) }));
  return out;
}

/** Mean of several measurements and their spread (ΔE of each against the mean). */
export function aggregate(samples: number[][], s: Space) {
  if (!samples.length) return null;
  const mean = [0, 1, 2].map((i) => samples.reduce((a, v) => a + v[i], 0) / samples.length) as Rgb;
  const des = samples.map((v) => deltaE(s, v, mean).value);
  return { mean, n: samples.length, max: Math.max(...des), avg: des.reduce((a, b) => a + b, 0) / des.length };
}

/**
 * CSS colour of a signal for a swatch on the given display: signal → light (1.0 = white;
 * HDR/log are clipped at reference white) → display primaries → display curve. Returns the
 * CSS string and whether the colour had to be clipped.
 */
export function swatchCss(rgb: number[], s: Space, display: DisplaySpace): { css: string; clipped: boolean } {
  if (display === 'raw') return { css: `color(srgb ${rgb.map((v) => Math.min(1, Math.max(0, v)).toFixed(4)).join(' ')})`, clipped: outside(rgb) };
  const to = display === 'p3' ? GAMUTS.p3 : GAMUTS['709'];
  const lin = mul3(gamutConvert(GAMUTS[s.gamut], to), signalToLinear(rgb, s.transfer, s.hlgLw));
  const clipped = lin.some((v) => v < -1e-3 || v > 1.001);
  const enc = lin.map((v) => (display === 'rec709' ? gammaInverse('sdr', Math.min(1, Math.max(0, v))) : gammaInverse('srgb', Math.min(1, Math.max(0, v)))));
  return { css: `color(${display === 'p3' ? 'display-p3' : 'srgb'} ${enc.map((v) => v.toFixed(4)).join(' ')})`, clipped };
}

/** Read-out of a signal as Hex/RGB (CI view, video interpretation) plus 10-bit legal codes. */
export function hexLine(rgb: number[], s: Space): string {
  const sdr709 = s.transfer === 'sdr' && s.gamut === '709';
  const { v, outside: out } = sdr709 ? { v: rgb as Rgb, outside: outside(rgb) } : signalToCi(rgb, 'video', s);
  return `${toHex(v)}  RGB ${codes(v.map((x) => Math.min(1, Math.max(0, x))), 8, false).join(',')}${sdr709 ? '' : ` ${t('match.as709')}`}${out ? ` ${t('match.outside')}` : ''}`;
}

// ---------------------------------------------------------------- hue qualifiers (skin, green)

/** Luma window and hue wedge of a qualifier; `hue` in ° on the vectorscope (default skin line 123°). */
export interface HueRange { lo: number; hi: number; tol: number; hue?: number }

/**
 * Grass/foliage qualifier. Hue centre between the ColorChecker patches "Foliage" (sRGB 87/108/67,
 * 205.5° in Rec.709) and "Yellow green" (157/188/64, 189.5°) ± 20°; luma window from BT.2408-8
 * Tab. 2 (grass: HLG 40–55 %, PQ 40–45 %; SDR has no reference value).
 */
export const GREEN_DEFAULT: Required<HueRange> = { lo: 0.4, hi: 0.55, tol: 20, hue: 198 };
export const GREEN_PRESETS: { id: string; label: string; lo: number; hi: number }[] = [
  { id: 'hlg', label: 'BT.2408 HLG 40–55 %', lo: 0.4, hi: 0.55 },
  { id: 'pq', label: 'BT.2408 PQ 40–45 %', lo: 0.4, hi: 0.45 },
];

/** Is a Cb/Cr inside the hue wedge (same test as the shader, renderer.ts isHue)? */
export function inWedge(cb: number, cr: number, hue: number, tol: number) {
  return Math.hypot(cb, cr) > 0.012 && Math.abs(angleDiff(hue, (Math.atan2(cr, cb) * 180) / Math.PI)) <= tol;
}

/** Circular mean hue of the saturated samples (|CbCr|/0.5 > 5 %), null when there are too few. */
export function meanHue(samples: number[][], cs: Colorspace): number | null {
  let x = 0, y = 0, n = 0;
  for (const p of samples) {
    const h = hueSatLuma(p, cs);
    if (h.sat < 0.05) continue;
    x += Math.cos((h.deg * Math.PI) / 180) * h.sat; y += Math.sin((h.deg * Math.PI) / 180) * h.sat; n++;
  }
  return n < 20 ? null : ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** 5th–95th percentile luma of the samples inside the hue wedge (null: fewer than 20). */
export function wedgeLumaRange(samples: number[][], cs: Colorspace, hue: number, tol: number) {
  const ys: number[] = [];
  for (const p of samples) {
    const { y, cb, cr } = ycbcr(p[0], p[1], p[2], cs);
    if (inWedge(cb, cr, hue, tol)) ys.push(y);
  }
  if (ys.length < 20) return null;
  ys.sort((a, b) => a - b);
  return { lo: ys[Math.floor(ys.length * 0.05)], hi: ys[Math.floor(ys.length * 0.95)], n: ys.length };
}
