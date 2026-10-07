// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Colour difference at the probe point against a reference (issue #8): ΔE 2000 for SDR and
// scene-referred (log) signals, ΔE ITP (ITU-R BT.2124, ICtCp) for PQ and HLG. The formulas are
// in color.ts (deltaE2000 tested against Sharma/Wu/Dalal, deltaEITP/rgb2020ToIctcp after BT.2124).

import { BAR_COLORS, GAMUTS, bt709InverseOetf, deltaE2000, deltaEITP, gamutConvert, isLog, mul3, rgb2020ToIctcp, rgbToXyzMatrix, signalToLinear, xyzToLab, type GamutId, type Transfer } from './color';
import { logSceneToSignal } from './camera';

/** Reference colour as a signal R′G′B′ in the source's own encoding. */
export interface DeRef { name: string; rgb: [number, number, number] }

export interface Space { transfer: Transfer; gamut: GamutId; hlgLw: number }

const hdr = (t: Transfer) => t === 'pq' || t === 'hlg';

/** ΔE between two signal R′G′B′ values of the same source. */
export function deltaE(s: Space, a: number[], b: number[]): { value: number; metric: 'ΔE00' | 'ΔITP' } {
  const lin = (c: number[]) => signalToLinear(c, s.transfer, s.hlgLw);
  if (hdr(s.transfer)) {
    // 1.0 = reference white = 203 cd/m² (BT.2408), ICtCp from BT.2020 display light in cd/m²
    const m = gamutConvert(GAMUTS[s.gamut], GAMUTS['2020']);
    const ic = (c: number[]) => rgb2020ToIctcp(mul3(m, lin(c)).map((v) => Math.max(0, v) * 203));
    return { value: deltaEITP(ic(a), ic(b)), metric: 'ΔITP' };
  }
  const M = rgbToXyzMatrix(GAMUTS[s.gamut]), white = mul3(M, [1, 1, 1]);
  const lab = (c: number[]) => xyzToLab(mul3(M, lin(c)), white);
  return { value: deltaE2000(lab(a), lab(b)), metric: 'ΔE00' };
}

/**
 * Colour-bar references in the source's encoding: 75 % and 100 % bars (PQ: 58 %, the BT.2111
 * level of HDR reference white, and 100 %); for camera log the Rec.709 bars as scene light,
 * converted into the camera gamut (as the vectorscope targets, color.ts logBarTargets).
 */
export function barRefs(s: Space): DeRef[] {
  const out: DeRef[] = [];
  if (isLog(s.transfer)) {
    const m = gamutConvert(GAMUTS['709'], GAMUTS[s.gamut]);
    for (const level of [0.75, 1]) {
      const l = level >= 1 ? 1 : bt709InverseOetf(level);
      for (const { label, rgb } of BAR_COLORS) {
        out.push({ name: `${label} ${level * 100} %`, rgb: mul3(m, rgb.map((v) => v * l)).map((v) => logSceneToSignal(s.transfer as never, v)) as [number, number, number] });
      }
    }
    return out;
  }
  for (const level of [s.transfer === 'pq' ? 0.58 : 0.75, 1]) {
    for (const { label, rgb } of BAR_COLORS) out.push({ name: `${label} ${Math.round(level * 100)} %`, rgb: rgb.map((v) => v * level) as [number, number, number] });
  }
  return out;
}

/** The reference with the smallest ΔE to `rgb`. */
export function nearest(s: Space, rgb: number[], refs: DeRef[]) {
  let best: { ref: DeRef; value: number; metric: 'ΔE00' | 'ΔITP' } | null = null;
  for (const ref of refs) {
    const d = deltaE(s, rgb, ref.rgb);
    if (!best || d.value < best.value) best = { ref, ...d };
  }
  return best;
}
