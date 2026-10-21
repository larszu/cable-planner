// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Reference camera and ghost trace (#140 step 1, docs/research/kamera-abgleich.md): one source is
// the reference; scopes can show its trace in a second colour over the live trace, and the panel
// reports how far the live source sits from the reference in black, median and highlight level.
//
// The levels are robust order statistics of the decoded R′G′B′ samples and their Y′, per channel:
//   black     = mean of the darkest `frac` of the samples (default 1 %) – the "black centroid"
//   median    = 50 % quantile
//   highlight = mean of the brightest `frac` of the samples
// Means of the outer percent instead of min/max so that single noisy or dead pixels do not move
// them. Pure functions without DOM (test/ghost.test.ts).

export const GHOST_CHANNELS = ['Y', 'R', 'G', 'B'] as const;
export type GhostChannel = (typeof GHOST_CHANNELS)[number];
export interface ChannelLevels { black: number; median: number; peak: number }
export type TraceLevels = Record<GhostChannel, ChannelLevels> & { n: number };
export type LevelDeltas = Record<GhostChannel, ChannelLevels>;

/** Colour of the reference trace (sRGB 0…1): magenta, apart from every mono tint and channel colour. */
export const GHOST_TINT: [number, number, number] = [1, 0.36, 0.86];
export const GHOST_CSS = 'rgba(255, 92, 220, 0.9)';

/** How the reference is held: following the live source or frozen at one moment. */
export type RefMode = 'live' | 'frozen';
export interface RefSettings { sourceId: string; mode: RefMode; /** trace strength 0.05…1 */ opacity: number }
export const DEFAULT_REF: RefSettings = { sourceId: '', mode: 'live', opacity: 0.6 };

function levels(v: Float64Array, frac: number): ChannelLevels {
  v.sort();
  const n = v.length, k = Math.max(1, Math.round(n * frac));
  let lo = 0, hi = 0;
  for (let i = 0; i < k; i++) { lo += v[i]; hi += v[n - 1 - i]; }
  const median = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  return { black: lo / k, median, peak: hi / k };
}

/**
 * Black / median / highlight per Y′, R′, G′, B′ of R′G′B′ samples (0…1, unclipped values allowed).
 * @param kr luma coefficients of the source matrix
 * @param frac share of the darkest/brightest samples averaged for black and highlight
 */
export function traceLevels(samples: ArrayLike<ArrayLike<number>>, kr: number, kb: number, frac = 0.01): TraceLevels | null {
  const n = samples.length;
  if (n < 4) return null;
  const ch = [0, 1, 2, 3].map(() => new Float64Array(n));
  const kg = 1 - kr - kb;
  for (let i = 0; i < n; i++) {
    const s = samples[i], r = s[0], g = s[1], b = s[2];
    ch[0][i] = kr * r + kg * g + kb * b; ch[1][i] = r; ch[2][i] = g; ch[3][i] = b;
  }
  return { Y: levels(ch[0], frac), R: levels(ch[1], frac), G: levels(ch[2], frac), B: levels(ch[3], frac), n };
}

/** Live minus reference, per channel and level (positive = live sits higher). */
export function levelDeltas(cur: TraceLevels, ref: TraceLevels): LevelDeltas {
  const d = (a: ChannelLevels, b: ChannelLevels): ChannelLevels => ({ black: a.black - b.black, median: a.median - b.median, peak: a.peak - b.peak });
  return { Y: d(cur.Y, ref.Y), R: d(cur.R, ref.R), G: d(cur.G, ref.G), B: d(cur.B, ref.B) };
}

/** Which channels a scope's Δ box lists: luma waveforms only Y′, everything else all four. */
export function ghostChannels(scope: string): readonly GhostChannel[] {
  return scope === 'wf-luma' || scope === 'wf-color' ? ['Y'] : GHOST_CHANNELS;
}

/** Signed percentage points with one decimal, "+0.0" for exact zero. */
export const signedPct = (v: number) => `${v < -0.0005 ? '−' : '+'}${Math.abs(v * 100).toFixed(1)}`;

/** Rows of the Δ box: header plus one row per channel (labels are passed in, already translated). */
export function deltaRows(d: LevelDeltas, chans: readonly GhostChannel[], head: { black: string; median: string; peak: string }): string[] {
  const w = 7;
  const rows = [`Δ    ${head.black.padStart(w)} ${head.median.padStart(w)} ${head.peak.padStart(w)}`];
  for (const c of chans) {
    const l = d[c];
    rows.push(`${(c === 'Y' ? 'Y′' : `${c}′`).padEnd(4)} ${signedPct(l.black).padStart(w)} ${signedPct(l.median).padStart(w)} ${signedPct(l.peak).padStart(w)}`);
  }
  return rows;
}

/** Scopes that can show the reference trace. */
export const GHOST_SCOPES = ['wf-luma', 'wf-color', 'wf-rgb', 'parade', 'yrgb', 'vector', 'diamond', 'hist'] as const;
export const hasGhost = (scope: string) => (GHOST_SCOPES as readonly string[]).includes(scope);

/** Clamp stored settings (layout import, old saves). */
export function sanitizeRef(r: Partial<RefSettings> | undefined): RefSettings {
  const o = Number(r?.opacity);
  return {
    sourceId: typeof r?.sourceId === 'string' ? r.sourceId : '',
    mode: r?.mode === 'frozen' ? 'frozen' : 'live',
    opacity: Number.isFinite(o) ? Math.min(1, Math.max(0.05, o)) : DEFAULT_REF.opacity,
  };
}

/** 256-bin histograms R′, G′, B′, Y′ of R′G′B′ samples (same binning as sources.ts computeStats). */
export function histOf(samples: ArrayLike<ArrayLike<number>>, kr: number, kb: number): Float32Array[] {
  const hist = [0, 1, 2, 3].map(() => new Float32Array(256));
  const kg = 1 - kr - kb, bin = (v: number) => Math.max(0, Math.min(255, (v * 255 + 0.5) | 0));
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    hist[0][bin(s[0])]++; hist[1][bin(s[1])]++; hist[2][bin(s[2])]++;
    hist[3][bin(kr * s[0] + kg * s[1] + kb * s[2])]++;
  }
  return hist;
}
