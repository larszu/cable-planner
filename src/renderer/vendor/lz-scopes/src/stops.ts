// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Stop scale for waveforms (scope-wuensche.md wish 3): signal levels as exposure stops relative
// to the 18 % grey card, for every transfer curve – the camera log curves, HLG, PQ and the SDR
// gammas. A +1 stop is twice the light of the grey card (Telestream PRISM "STOP": a normalised
// "linear to light" logarithmic scale, so cameras with different gammas can be compared).
//
// Linear light and grey level per curve (docs/research/scope-wuensche.md, wish 3):
//   log curves  scene-linear from the manufacturer curve, grey = 0.18
//   HLG         scene light E = inverse OETF (BT.2100), grey = the BT.2408 grey card at 38 %
//   PQ          display light in cd/m² (ST 2084), grey = 26 cd/m² (BT.2408 grey card, 38 % PQ)
//   SDR BT.1886 scene light through the BT.709 OETF inverse (camera exposure), grey = 0.18 (≈ 40.9 %)
//   γ 2.2/2.6/2.8, sRGB, linear  display light of the curve, grey = 0.18
// Pure functions, no DOM (test/stops.test.ts).

import {
  bt709InverseOetf, bt709Oetf, gammaEotf, gammaInverse, hlgInverseOetf, hlgOetf, isGamma, isLog, pqDecode, pqEncode, sceneToSignal, signalToScene, type Transfer,
} from './color';

/** Signal → linear light of the curve (any scale; stops only use ratios). */
export function linearOf(v: number, tr: Transfer): number {
  if (isLog(tr)) return signalToScene(v, tr);
  if (tr === 'hlg') return hlgInverseOetf(Math.max(0, v));
  if (tr === 'pq') return pqDecode(Math.max(0, v));
  if (tr === 'sdr') return bt709InverseOetf(Math.max(0, v));
  if (isGamma(tr)) return gammaEotf(tr, Math.max(0, v));
  return v;
}
/** Linear light → signal (inverse of linearOf). */
export function signalOf(l: number, tr: Transfer): number {
  if (isLog(tr)) return sceneToSignal(l, tr);
  if (tr === 'hlg') return hlgOetf(l);
  if (tr === 'pq') return pqEncode(l);
  if (tr === 'sdr') return bt709Oetf(l);
  if (isGamma(tr)) return gammaInverse(tr, l);
  return l;
}

/** Signal level of the grey card (stop 0) for a curve. */
export function greySignal(tr: Transfer): number {
  if (tr === 'hlg' || tr === 'pq') return 0.38;
  return signalOf(0.18, tr);
}

/** Exposure in stops relative to the grey card; −Infinity at or below black. */
export function stopsOf(v: number, tr: Transfer): number {
  const l = linearOf(v, tr), g = linearOf(greySignal(tr), tr);
  return l > 0 && g > 0 ? Math.log2(l / g) : -Infinity;
}
/** Signal level of `stops` above (below) the grey card. */
export function signalAtStop(stops: number, tr: Transfer): number {
  return signalOf(linearOf(greySignal(tr), tr) * 2 ** stops, tr);
}

/**
 * Graticule ticks for a waveform level range: every stop (every third of a stop when zoomed in),
 * labelled at whole stops ("+2", "0", "−3"), grey card and the half-way stops major.
 */
export function stopTicks(tr: Transfer, range: readonly [number, number]): { level: number; label: string; major: boolean }[] {
  const [lo, hi] = range;
  const fine = hi - lo < 0.5;
  const out: { level: number; label: string; major: boolean }[] = [];
  for (let k = -16 * 3; k <= 16 * 3; k += fine ? 1 : 3) {
    const s = k / 3, level = signalAtStop(s, tr);
    if (!Number.isFinite(level) || level < lo - 1e-9 || level > hi + 1e-9 || level <= 0) continue;
    const whole = k % 3 === 0;
    out.push({ level, label: whole ? stopLabel(s) : '', major: s === 0 });
  }
  return out;
}

/** "+1", "0", "−2", "+0.7" (one decimal off whole stops). */
export function stopLabel(s: number): string {
  if (!Number.isFinite(s)) return '−∞';
  const r = Math.abs(s - Math.round(s)) < 0.05 ? String(Math.abs(Math.round(s))) : Math.abs(s).toFixed(1);
  return s > 0.05 ? `+${r}` : s < -0.05 ? `−${r}` : '0';
}
