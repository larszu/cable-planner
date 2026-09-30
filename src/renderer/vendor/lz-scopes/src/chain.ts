// Per-source processing chain: input (transfer/gamut of the source, incl. camera log) → CST
// (target gamut + transfer, tone mapping, Bradford) → LUT 1 → LUT 2. Each panel measures at
// one stage: the raw signal, after the CST or after the LUTs. The GPU runs the same chain in
// the shaders (CHAIN_GLSL); the CPU mirror (`apply`) serves probe values and statistics.

import {
  GAMMA_EXP, GAMUTS, bt2390Eetf, gamutConvert, hlgGamma, hlgRefWhite, isLog, linearToSignal, pqDecode, pqEncode, rgbToXyzMatrix,
  signalToLinear, transferLabel, type Colorspace, type GamutId, type Transfer,
} from './color';
import { LOG_CURVES, NO_LOG, logEncodeGlsl, logGlsl, logSignalToScene, logUniforms, type LogCurve } from './camera';
import { LUTS, applyLut, type Lut } from './lut';
import type { Source, Stats } from './sources';

export type Stage = 'signal' | 'cst' | 'lut';
export const STAGES: Stage[] = ['signal', 'cst', 'lut'];
export const STAGE_LABELS: Record<Stage, string> = { signal: 'Signal (vor CST)', cst: 'nach CST', lut: 'nach LUT' };
export type ToneMap = 'none' | 'clip' | 'bt2390' | 'reinhard' | 'aces2';
export const TONEMAP_LABELS: Record<ToneMap, string> = {
  none: 'keins (linear durchreichen)', clip: 'Clip an der Zielspitze', bt2390: 'BT.2390-EETF (je Kanal, PQ)',
  reinhard: 'Reinhard erweitert (Luminanz)', aces2: 'ACES-2.0-Tonescale (Luminanz)',
};

/**
 * ACES 2.0 tonescale constants and forward curve from aces-core lib/Lib.Academy.Tonescale.ctl
 * l. 30–96 (Apache 2.0, Copyright Contributors to the ACES Project). Changed: ported to
 * TypeScript/GLSL and applied to luminance with the RGB ratios kept – a simplification, not the
 * full ACES 2.0 output transform (no JMh chroma compression, no gamut compression).
 * @param n peak luminance of the display in cd/m²
 */
export function acesParams(n: number) {
  const nr = 100, g = 1.15, c = 0.18, cd = 10.013, wg = 0.14, t1 = 0.04, rMin = 128, rMax = 896;
  const rHit = rMin + (rMax - rMin) * (Math.log(n / nr) / Math.log(10000 / 100));
  const m0 = n / nr, m1 = 0.5 * (m0 + Math.sqrt(m0 * (m0 + 4 * t1)));
  const wi = Math.log(n / 100) / Math.log(2), ct = (cd / nr) * (1 + wi * wg);
  const gip = 0.5 * (ct + Math.sqrt(ct * (ct + 4 * t1)));
  const u = Math.pow(gip / (m1 / Math.pow((rHit / m1) / (rHit / m1 + 1), g)), 1 / g);
  const gipp2 = -(m1 * u) / (u - 1);
  const w2 = c / gipp2, s2 = w2 * m1, u2 = Math.pow((rHit / m1) / (rHit / m1 + w2), g), m2 = m1 / u2;
  return { m2, s2, g, t1, nr, n, rHit };
}
/** ACES 2.0 forward tonescale: scene-linear (0.18 grey) → cd/m², reaching the peak at r_hit; limited to the peak (display clamp). */
export function acesTonescale(x: number, p: ReturnType<typeof acesParams>) {
  const f = p.m2 * Math.pow(Math.max(0, x) / (x + p.s2), p.g);
  return Math.min(p.n, Math.max(0, (f * f) / (f + p.t1)) * p.nr);
}

/** Reinhard et al. 2002, extended operator: L·(1 + L/W²)/(1 + L), W = white point. */
export const reinhard = (l: number, w: number) => (l * (1 + l / (w * w))) / (1 + l);

export interface CstSettings {
  on: boolean; gamut: GamutId; transfer: Transfer;
  /** peak of an HLG target display (system gamma) */
  lw?: number;
  tonemap?: ToneMap;
  /** tone-mapping peaks in cd/m²; 0/undefined = automatic */
  srcPeak?: number; tgtPeak?: number;
}
export interface ChainSettings {
  cst?: CstSettings;
  lut1?: string; lut2?: string;
  /** what the LUTs output; unset = same as their input */
  lutOut?: { transfer?: Transfer; gamut?: GamutId; lw?: number };
}

export const DEFAULT_CST: CstSettings = { on: false, gamut: '709', transfer: 'sdr', lw: 1000, tonemap: 'bt2390' };

interface Space { transfer: Transfer; gamut: GamutId; lw: number }

export interface Compiled {
  stage: Stage;
  input: Space;
  cstOn: boolean; cstOut: Space;
  /** row-major source linear → target linear (Bradford if the whites differ) */
  M: number[];
  tm: ToneMap; srcPQ: number; tgtPQ: number;
  /** ACES tonescale parameters for the target peak and the factor cd/m² → linear output */
  aces: ReturnType<typeof acesParams>; acesK: number;
  luts: (Lut & { version: number })[];
  /** transfer/gamut the scopes see at this stage */
  view: Space & { colorspace: Colorspace };
  apply: (rgb: number[]) => number[];
  sig: string;
}

const ysRow = (g: GamutId) => rgbToXyzMatrix(GAMUTS[g]).slice(3, 6);
const mul3 = (m: number[], v: number[]) => [0, 1, 2].map((r) => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);

/** Y'CbCr matrix that belongs to a gamut after a CST. */
export const colorspaceFor = (g: GamutId, fallback: Colorspace): Colorspace =>
  g === '2020' || g === '601' || g === '601-625' || g === '709' ? g : fallback;

/** Automatic tone-mapping peaks (cd/m²): where the source ends, where the target ends. */
export function autoPeaks(input: Space, out: Space) {
  const src = input.transfer === 'pq' ? 1000 : input.transfer === 'hlg' ? input.lw
    : isLog(input.transfer) ? 203 * logSignalToScene(input.transfer, 1) : 203;
  const tgt = out.transfer === 'pq' ? 1000 : out.transfer === 'hlg' ? out.lw : 203;
  return { src, tgt };
}

export function compileChain(src: Source, stage: Stage): Compiled {
  const ch: ChainSettings = src.settings.chain ?? {};
  const input: Space = { transfer: src.transfer, gamut: src.gamut, lw: src.hlgLw };
  const cst = ch.cst;
  const cstOn = !!cst?.on;
  const cstOut: Space = cstOn ? { transfer: cst!.transfer, gamut: cst!.gamut, lw: cst!.lw ?? 1000 } : input;
  const M = cstOn ? gamutConvert(GAMUTS[input.gamut], GAMUTS[cstOut.gamut]) : [1, 0, 0, 0, 1, 0, 0, 0, 1];
  // log targets stay scene-linear: no tone mapping
  const tm: ToneMap = cstOn && !isLog(cstOut.transfer) ? cst!.tonemap ?? 'bt2390' : 'none';
  const peaks = autoPeaks(input, cstOut);
  const srcPQ = pqEncode(cst?.srcPeak || peaks.src), tgtPQ = pqEncode(cst?.tgtPeak || peaks.tgt);
  const luts = stage === 'lut' ? [ch.lut1, ch.lut2].map((n) => (n ? LUTS.get(n) : undefined)).filter((l): l is Lut & { version: number } => !!l) : [];
  const afterLut: Space = luts.length && ch.lutOut
    ? { transfer: ch.lutOut.transfer ?? cstOut.transfer, gamut: ch.lutOut.gamut ?? cstOut.gamut, lw: ch.lutOut.lw ?? cstOut.lw } : cstOut;
  const sp = stage === 'signal' ? input : stage === 'cst' ? cstOut : afterLut;
  const view = { ...sp, colorspace: sp.gamut === input.gamut ? src.colorspace : colorspaceFor(sp.gamut, src.colorspace) };
  const inYs = ysRow(input.gamut), outYs = ysRow(cstOut.gamut);
  // ACES: SDR targets have their white at the 100 cd/m² peak, HDR targets at 203 cd/m²
  const hdrOut = cstOut.transfer === 'pq' || cstOut.transfer === 'hlg';
  const aces = acesParams(hdrOut ? pqDecode(tgtPQ) : 100), acesK = 1 / (hdrOut ? 203 : 100);
  const P = pqDecode(tgtPQ) / 203, W = pqDecode(srcPQ) / 203 / P;
  const toneRgb = (l: number[]): number[] => {
    if (tm === 'clip') return l.map((v) => Math.min(v, P));
    if (tm === 'bt2390') return l.map((v) => Math.sign(v) * pqDecode(bt2390Eetf(pqEncode(Math.abs(v) * 203), srcPQ, tgtPQ)) / 203);
    if (tm !== 'reinhard' && tm !== 'aces2') return l;
    const y = l[0] * outYs[0] + l[1] * outYs[1] + l[2] * outYs[2];
    if (y <= 0) return l;
    const yo = tm === 'reinhard' ? reinhard(y / P, W) * P : acesTonescale(y, aces) * acesK;
    return l.map((v) => (v * yo) / y);
  };
  const doCst = stage !== 'signal' && cstOn;
  const apply = (rgb: number[]) => {
    let c = rgb;
    if (doCst) c = linearToSignal(toneRgb(mul3(M, signalToLinear(c, input.transfer, input.lw, inYs))), cstOut.transfer, cstOut.lw, outYs);
    for (const l of luts) c = applyLut(l, c);
    return c;
  };
  const sig = [stage, input.transfer, input.gamut, input.lw, doCst ? JSON.stringify(cst) : '-', luts.map((l) => `${l.name}#${l.version}`).join('+'), JSON.stringify(ch.lutOut ?? null)].join('|');
  return { stage, input, cstOn: doCst, cstOut, M, tm, srcPQ, tgtPQ, aces, acesK, luts, view, apply, sig };
}

/**
 * Camera presets: log curve and native gamut of the camera (src/camera.ts) → CST target.
 * Applying one sets the source's transfer to the curve, its gamut to auto, and the CST.
 */
export interface CameraPreset { id: string; name: string; curve: LogCurve }
export const CAMERA_PRESETS: CameraPreset[] = (Object.keys(LOG_CURVES) as LogCurve[]).map((c) => ({
  id: c, curve: c, name: `${LOG_CURVES[c].name} / ${GAMUTS[LOG_CURVES[c].gamut].name}`,
}));
export const CST_TARGETS: { id: string; name: string; gamut: GamutId; transfer: Transfer; tonemap: ToneMap }[] = [
  { id: '709', name: 'Rec.709 / BT.1886', gamut: '709', transfer: 'sdr', tonemap: 'aces2' },
  { id: '2020pq', name: 'Rec.2020 PQ (1000 cd/m²)', gamut: '2020', transfer: 'pq', tonemap: 'aces2' },
  { id: '2020hlg', name: 'Rec.2020 HLG (1000 cd/m²)', gamut: '2020', transfer: 'hlg', tonemap: 'aces2' },
];

/** Does this source have anything to switch between? */
export const hasChain = (src: Source) => !!(src.settings.chain?.cst?.on || src.settings.chain?.lut1 || src.settings.chain?.lut2);

/** Short description for panel headers, e.g. "nach LUT · Rec.709 SDR". */
export function stageBadge(c: Compiled) {
  return `${STAGE_LABELS[c.stage].replace(' (vor CST)', '')} · ${GAMUTS[c.view.gamut].name} ${transferLabel(c.view.transfer)}`;
}

/** A Source seen at a stage of its chain: same frames, other transfer/gamut, processed values. */
export interface StageView extends Source { chain: Compiled; base: Source }

export function stageView(src: Source, stage: Stage): Source {
  if (stage === 'signal' || !hasChain(src)) return src;
  const c = compileChain(src, stage);
  const v = Object.create(src) as StageView;
  Object.defineProperties(v, {
    chain: { value: c },
    base: { value: src },
    transfer: { get: () => c.view.transfer },
    gamut: { get: () => c.view.gamut },
    hlgLw: { get: () => c.view.lw },
    colorspace: { get: () => c.view.colorspace },
    readPixel: { value: (x: number, y: number) => { const p = src.readPixel(x, y); return p ? (c.apply(p) as [number, number, number]) : null; } },
    stats: { get: (): Stats | null => src.stageStats(c) },
  });
  return v;
}
/**
 * What a panel at this stage really shows, stated honestly: '' for the plain signal, otherwise
 * e.g. "nach CST · Rec.709 SDR" or a note that the stage has nothing to apply.
 */
export function stageNote(src: Source | null, stage: Stage): { text: string; warn: boolean } {
  if (!src || stage === 'signal') return { text: '', warn: false };
  const ch = src.settings.chain ?? {};
  const missing = [ch.lut1, ch.lut2].filter((n): n is string => !!n && !LUTS.has(n));
  if (stage === 'cst' && !ch.cst?.on) return { text: 'nach CST – keine CST aktiv, zeigt das Signal', warn: true };
  if (stage === 'lut') {
    if (missing.length) return { text: `nach LUT – ${missing.join(', ')} nicht geladen`, warn: true };
    if (!ch.lut1 && !ch.lut2) return { text: `nach LUT – keine LUT gesetzt, zeigt ${ch.cst?.on ? 'nach CST' : 'das Signal'}`, warn: true };
  }
  return { text: stageBadge(compileChain(src, stage)), warn: false };
}

export const chainOf = (src: Source): Compiled | null => (src as Partial<StageView>).chain ?? null;
export const baseOf = (src: Source): Source => (src as Partial<StageView>).base ?? src;

// ---------------------------------------------------------------- GLSL

/**
 * Signal → linear light (1.0 = reference white) with uniforms suffixed `sfx`:
 * SDR BT.1886 γ 2.4, PQ cd/m²/203, HLG OOTF on luminance, log scene-linear.
 */
export const linearGlsl = (sfx = '') => `
uniform int uTransfer${sfx}; uniform float uHlgK${sfx}, uHlgGamma${sfx}, uGamma${sfx}; uniform vec3 uYs${sfx};
${logGlsl(sfx)}
float pqLin${sfx}(float v) {
  float p = pow(max(v, 0.0), 1.0 / 78.84375);
  return 10000.0 / 203.0 * pow(max(p - 0.8359375, 0.0) / (18.8515625 - 18.6875 * p), 1.0 / 0.1593017578125);
}
float hlgInv${sfx}(float v) {
  v = max(v, 0.0);
  return v <= 0.5 ? v * v / 3.0 : (exp((v - 0.55991073) / 0.17883277) + 0.28466892) / 12.0;
}
vec3 toLinear${sfx}(vec3 rgb) {
  if (uTransfer${sfx} == 1) return vec3(pqLin${sfx}(rgb.r), pqLin${sfx}(rgb.g), pqLin${sfx}(rgb.b));
  if (uTransfer${sfx} == 2) {
    vec3 e = vec3(hlgInv${sfx}(rgb.r), hlgInv${sfx}(rgb.g), hlgInv${sfx}(rgb.b));
    float ys = dot(e, uYs${sfx});
    return ys > 0.0 ? e * uHlgK${sfx} * pow(ys, uHlgGamma${sfx} - 1.0) : vec3(0.0);
  }
  if (uTransfer${sfx} == 3) return vec3(logDecode${sfx}(rgb.r), logDecode${sfx}(rgb.g), logDecode${sfx}(rgb.b));
  if (uTransfer${sfx} == 4) { vec3 a = abs(rgb); return sign(rgb) * mix(pow((a + 0.055) / 1.055, vec3(2.4)), a / 12.92, vec3(lessThanEqual(a, vec3(0.04045)))); }
  if (uTransfer${sfx} == 5) return rgb;
  return pow(max(rgb, 0.0), vec3(uGamma${sfx}));
}`;

const lutGlsl = (k: number) => `
uniform highp sampler3D uL3_${k}; uniform highp sampler2D uL1_${k};
uniform int uL1On_${k}, uL3On_${k}, uL1N_${k}, uL3N_${k};
uniform vec3 uL1Min_${k}, uL1Max_${k}, uL3Min_${k}, uL3Max_${k};
vec3 lut${k}(vec3 c) {
  if (uL1On_${k} == 1) {
    vec3 f = clamp((c - uL1Min_${k}) / (uL1Max_${k} - uL1Min_${k}), 0.0, 1.0) * float(uL1N_${k} - 1);
    ivec3 i = min(ivec3(floor(f)), ivec3(uL1N_${k} - 2)); vec3 t = f - vec3(i);
    c = vec3(mix(texelFetch(uL1_${k}, ivec2(i.r, 0), 0).r, texelFetch(uL1_${k}, ivec2(i.r + 1, 0), 0).r, t.r),
             mix(texelFetch(uL1_${k}, ivec2(i.g, 0), 0).g, texelFetch(uL1_${k}, ivec2(i.g + 1, 0), 0).g, t.g),
             mix(texelFetch(uL1_${k}, ivec2(i.b, 0), 0).b, texelFetch(uL1_${k}, ivec2(i.b + 1, 0), 0).b, t.b));
  }
  if (uL3On_${k} == 1) {
    vec3 f = clamp((c - uL3Min_${k}) / (uL3Max_${k} - uL3Min_${k}), 0.0, 1.0) * float(uL3N_${k} - 1);
    ivec3 i = min(ivec3(floor(f)), ivec3(uL3N_${k} - 2)); vec3 t = f - vec3(i);
    vec3 c000 = texelFetch(uL3_${k}, i, 0).rgb, c111 = texelFetch(uL3_${k}, i + ivec3(1), 0).rgb;
    // tetrahedral interpolation (same six cases as apply3D in lut.ts)
    if (t.r > t.g) {
      if (t.g > t.b) c = (1.0 - t.r) * c000 + (t.r - t.g) * texelFetch(uL3_${k}, i + ivec3(1, 0, 0), 0).rgb + (t.g - t.b) * texelFetch(uL3_${k}, i + ivec3(1, 1, 0), 0).rgb + t.b * c111;
      else if (t.r > t.b) c = (1.0 - t.r) * c000 + (t.r - t.b) * texelFetch(uL3_${k}, i + ivec3(1, 0, 0), 0).rgb + (t.b - t.g) * texelFetch(uL3_${k}, i + ivec3(1, 0, 1), 0).rgb + t.g * c111;
      else c = (1.0 - t.b) * c000 + (t.b - t.r) * texelFetch(uL3_${k}, i + ivec3(0, 0, 1), 0).rgb + (t.r - t.g) * texelFetch(uL3_${k}, i + ivec3(1, 0, 1), 0).rgb + t.g * c111;
    } else {
      if (t.b > t.g) c = (1.0 - t.b) * c000 + (t.b - t.g) * texelFetch(uL3_${k}, i + ivec3(0, 0, 1), 0).rgb + (t.g - t.r) * texelFetch(uL3_${k}, i + ivec3(0, 1, 1), 0).rgb + t.r * c111;
      else if (t.b > t.r) c = (1.0 - t.g) * c000 + (t.g - t.b) * texelFetch(uL3_${k}, i + ivec3(0, 1, 0), 0).rgb + (t.b - t.r) * texelFetch(uL3_${k}, i + ivec3(0, 1, 1), 0).rgb + t.r * c111;
      else c = (1.0 - t.g) * c000 + (t.g - t.r) * texelFetch(uL3_${k}, i + ivec3(0, 1, 0), 0).rgb + (t.r - t.b) * texelFetch(uL3_${k}, i + ivec3(1, 1, 0), 0).rgb + t.b * c111;
    }
  }
  return c;
}`;

/**
 * Chain stage for the shaders. Expects `fetchRaw(ivec2)`; defines `fetchRGB(ivec2)`.
 * uCstOn: CST active; uLuts: number of LUT slots to apply (0–2).
 */
export const CHAIN_GLSL = `
${linearGlsl('In')}
${logGlsl('Out')}
${logEncodeGlsl('Out')}
uniform int uCstOn, uLuts, uOutTransfer, uTm;
uniform mat3 uCstM;
uniform float uOutHlgK, uOutHlgGamma, uOutGamma, uSrcPQ, uTgtPQ;
uniform vec3 uOutYs;
float pqEnc(float nits) {
  float p = pow(max(nits, 0.0) / 10000.0, 0.1593017578125);
  return pow((0.8359375 + 18.8515625 * p) / (1.0 + 18.6875 * p), 78.84375);
}
float pqNits(float v) {
  float p = pow(max(v, 0.0), 1.0 / 78.84375);
  return 10000.0 * pow(max(p - 0.8359375, 0.0) / (18.8515625 - 18.6875 * p), 1.0 / 0.1593017578125);
}
float hlgOetfG(float e) { e = max(e, 0.0); return e <= 1.0 / 12.0 ? sqrt(3.0 * e) : 0.17883277 * log(12.0 * e - 0.28466892) + 0.55991073; }
// BT.2390 EETF in the PQ domain (color.ts bt2390Eetf, from alwan alwan_hdr_core.inc l. 235–265, MIT)
float eetf(float e) {
  float range = max(uSrcPQ, 1e-10);
  float en = clamp(e / range, 0.0, 1.0), maxLum = min(1.0, uTgtPQ / range);
  float ks = clamp(1.5 * maxLum - 0.5, 0.0, 1.0);
  if (en <= ks) return en * range;
  float t = min(1.0, (en - ks) / (1.0 - ks + 1e-10)), t2 = t * t, t3 = t2 * t;
  return ((2.0 * t3 - 3.0 * t2 + 1.0) * ks + (t3 - 2.0 * t2 + t) * (1.0 - ks) + (-2.0 * t3 + 3.0 * t2) * maxLum) * range;
}
uniform vec4 uAces; uniform float uAcesK, uAcesN; uniform vec3 uTmYs;
float eetfLin(float l) { return sign(l) * pqNits(eetf(pqEnc(abs(l) * 203.0))) / 203.0; }
vec3 toneMap(vec3 l) {
  float P = pqNits(uTgtPQ) / 203.0;
  if (uTm == 1) return min(l, vec3(P));
  if (uTm == 2) return vec3(eetfLin(l.r), eetfLin(l.g), eetfLin(l.b));
  if (uTm < 3) return l;
  float y = dot(l, uTmYs);
  if (y <= 0.0) return l;
  float yo;
  if (uTm == 3) { float W = pqNits(uSrcPQ) / 203.0 / P, x = y / P; yo = x * (1.0 + x / (W * W)) / (1.0 + x) * P; }
  else { float f = uAces.x * pow(max(0.0, y) / (y + uAces.y), uAces.z); yo = min(uAcesN, max(0.0, f * f / (f + uAces.w)) * 100.0) * uAcesK; }
  return l * (yo / y);
}
vec3 encodeOut(vec3 l) {
  if (uOutTransfer == 1) return vec3(pqEnc(l.r * 203.0), pqEnc(l.g * 203.0), pqEnc(l.b * 203.0));
  if (uOutTransfer == 2) {
    vec3 f = max(l, 0.0) / uOutHlgK;       // display light / Lw
    float yd = dot(f, uOutYs);
    if (yd <= 0.0) return vec3(0.0);
    float k = pow(pow(yd, 1.0 / uOutHlgGamma), uOutHlgGamma - 1.0);
    return vec3(hlgOetfG(f.r / k), hlgOetfG(f.g / k), hlgOetfG(f.b / k));
  }
  if (uOutTransfer == 3) return vec3(logEncodeOut(l.r), logEncodeOut(l.g), logEncodeOut(l.b));
  if (uOutTransfer == 4) { vec3 a = abs(l); return sign(l) * mix(1.055 * pow(a, vec3(1.0 / 2.4)) - 0.055, 12.92 * a, vec3(lessThanEqual(a, vec3(0.0031308)))); }
  if (uOutTransfer == 5) return l;
  return pow(max(l, 0.0), vec3(1.0 / uOutGamma));
}
${lutGlsl(1)}
${lutGlsl(2)}
vec3 fetchRGB(ivec2 p) {
  vec3 c = fetchRaw(p);
  if (uCstOn == 1) {
    vec3 l = uCstM * toLinearIn(c);
    c = encodeOut(toneMap(l));
  }
  if (uLuts >= 1) c = lut1(c);
  if (uLuts >= 2) c = lut2(c);
  return c;
}`;

const transferId = (t: Transfer) => (t === 'pq' ? 1 : t === 'hlg' ? 2 : isLog(t) ? 3 : t === 'srgb' ? 4 : t === 'linear' ? 5 : 0);

type U = (name: string) => WebGLUniformLocation | null;

/** Uniforms of linearGlsl(sfx) for a transfer/gamut/Lw. */
export function setLinearUniforms(gl: WebGL2RenderingContext, u: U, sfx: string, s: Space) {
  gl.uniform1i(u(`uTransfer${sfx}`), transferId(s.transfer));
  gl.uniform1f(u(`uHlgK${sfx}`), s.lw / hlgRefWhite(s.lw));
  gl.uniform1f(u(`uHlgGamma${sfx}`), hlgGamma(s.lw));
  gl.uniform1f(u(`uGamma${sfx}`), GAMMA_EXP[s.transfer] ?? 2.4);
  const ys = ysRow(s.gamut);
  gl.uniform3f(u(`uYs${sfx}`), ys[0], ys[1], ys[2]);
  const lu = isLog(s.transfer) ? logUniforms(s.transfer) : NO_LOG;
  gl.uniform1i(u(`uLogKind${sfx}`), lu.kind);
  gl.uniform4fv(u(`uLogA${sfx}`), lu.a);
  gl.uniform4fv(u(`uLogB${sfx}`), lu.b);
  return lu;
}

export interface LutTex { t3?: WebGLTexture; t1?: WebGLTexture }

/** Uniforms of CHAIN_GLSL. Texture units: 1/2 = 3D LUTs, 3/4 = 1D LUTs. */
export function setChainUniforms(gl: WebGL2RenderingContext, u: U, c: Compiled | null, tex: (l: Lut & { version: number }) => LutTex) {
  gl.uniform1i(u('uCstOn'), c?.cstOn ? 1 : 0);
  gl.uniform1i(u('uLuts'), c ? c.luts.length : 0);
  [1, 2].forEach((k) => {
    gl.uniform1i(u(`uL3_${k}`), k); gl.uniform1i(u(`uL1_${k}`), k + 2);
    const l = c?.luts[k - 1];
    gl.uniform1i(u(`uL1On_${k}`), l?.pre ? 1 : 0);
    gl.uniform1i(u(`uL3On_${k}`), l?.cube ? 1 : 0);
    if (!l) return;
    const t = tex(l);
    if (l.pre && t.t1) {
      gl.activeTexture(gl.TEXTURE0 + k + 2); gl.bindTexture(gl.TEXTURE_2D, t.t1);
      gl.uniform1i(u(`uL1N_${k}`), l.pre.size); gl.uniform3fv(u(`uL1Min_${k}`), l.pre.min); gl.uniform3fv(u(`uL1Max_${k}`), l.pre.max);
    }
    if (l.cube && t.t3) {
      gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_3D, t.t3);
      gl.uniform1i(u(`uL3N_${k}`), l.cube.size); gl.uniform3fv(u(`uL3Min_${k}`), l.cube.min); gl.uniform3fv(u(`uL3Max_${k}`), l.cube.max);
    }
  });
  gl.activeTexture(gl.TEXTURE0);
  if (!c?.cstOn) return;
  setLinearUniforms(gl, u, 'In', c.input);
  const m = c.M;
  gl.uniformMatrix3fv(u('uCstM'), false, [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]);
  gl.uniform1i(u('uTm'), { none: 0, clip: 1, bt2390: 2, reinhard: 3, aces2: 4 }[c.tm]);
  gl.uniform4f(u('uAces'), c.aces.m2, c.aces.s2, c.aces.g, c.aces.t1);
  gl.uniform1f(u('uAcesK'), c.acesK);
  gl.uniform1f(u('uAcesN'), c.aces.n);
  const ty = ysRow(c.cstOut.gamut);
  gl.uniform3f(u('uTmYs'), ty[0], ty[1], ty[2]);
  gl.uniform1f(u('uSrcPQ'), c.srcPQ); gl.uniform1f(u('uTgtPQ'), c.tgtPQ);
  const o = c.cstOut;
  gl.uniform1i(u('uOutTransfer'), transferId(o.transfer));
  gl.uniform1f(u('uOutHlgK'), o.lw / hlgRefWhite(o.lw));
  gl.uniform1f(u('uOutHlgGamma'), hlgGamma(o.lw));
  gl.uniform1f(u('uOutGamma'), GAMMA_EXP[o.transfer] ?? 2.4);
  const ys = ysRow(o.gamut);
  gl.uniform3f(u('uOutYs'), ys[0], ys[1], ys[2]);
  const lu = isLog(o.transfer) ? logUniforms(o.transfer) : NO_LOG;
  gl.uniform1i(u('uLogKindOut'), lu.kind);
  gl.uniform4fv(u('uLogAOut'), lu.a); gl.uniform4fv(u('uLogBOut'), lu.b); gl.uniform2fv(u('uLogEOut'), lu.e);
}
