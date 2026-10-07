// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Channel layouts and the position-dependent loudness weights of ITU-R BS.1770-5.
//
// Weights: BS.1770-5 Annex 3, Table 4 (p23): elevation |φ| < 30° and 60° ≤ |θ| ≤ 120°
// → 1.41 (+1.5 dB), every other direction → 1.00; LFE channels are not measured.
// Table 5 (p24–25) applies this to the BS.2051 loudspeaker labels, e.g. M±110 and M±090
// = 1.41, M±135 and M±030 = 1.00, all U/T/B (elevated/bottom) = 1.00.
//
// Channel order and names are ffmpeg's (`ffmpeg -layouts`), which is how the bridge
// delivers PCM. The assignment of an ffmpeg channel name to a BS.2051 direction is our
// own (Einschätzung): FL/FR = M±030, FC = M+000, SL/SR = M±090, BL/BR = M±135 – except
// in layouts without side channels (5.1, quad, …), where the "back" pair is the
// surround pair of the 3/2 system at M±110 (BS.1770-5 Table 3: Ls/Rs = 1.41).

/** ffmpeg's standard layouts (`ffmpeg -layouts`, ffmpeg 9.0). */
export const FFMPEG_LAYOUTS: Record<string, string[]> = {
  mono: ['FC'], stereo: ['FL', 'FR'], '2.1': ['FL', 'FR', 'LFE'], '3.0': ['FL', 'FR', 'FC'], '3.0(back)': ['FL', 'FR', 'BC'],
  '4.0': ['FL', 'FR', 'FC', 'BC'], quad: ['FL', 'FR', 'BL', 'BR'], 'quad(side)': ['FL', 'FR', 'SL', 'SR'], '3.1': ['FL', 'FR', 'FC', 'LFE'],
  '5.0': ['FL', 'FR', 'FC', 'BL', 'BR'], '5.0(side)': ['FL', 'FR', 'FC', 'SL', 'SR'], '4.1': ['FL', 'FR', 'FC', 'LFE', 'BC'],
  '5.1': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR'], '5.1(side)': ['FL', 'FR', 'FC', 'LFE', 'SL', 'SR'],
  '6.0': ['FL', 'FR', 'FC', 'BC', 'SL', 'SR'], '6.0(front)': ['FL', 'FR', 'FLC', 'FRC', 'SL', 'SR'], '3.1.2': ['FL', 'FR', 'FC', 'LFE', 'TFL', 'TFR'],
  hexagonal: ['FL', 'FR', 'FC', 'BL', 'BR', 'BC'], '6.1': ['FL', 'FR', 'FC', 'LFE', 'BC', 'SL', 'SR'], '6.1(back)': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'BC'],
  '6.1(front)': ['FL', 'FR', 'LFE', 'FLC', 'FRC', 'SL', 'SR'], '7.0': ['FL', 'FR', 'FC', 'BL', 'BR', 'SL', 'SR'], '7.0(front)': ['FL', 'FR', 'FC', 'FLC', 'FRC', 'SL', 'SR'],
  '7.1': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'SL', 'SR'], '7.1(wide)': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'FLC', 'FRC'],
  '7.1(wide-side)': ['FL', 'FR', 'FC', 'LFE', 'FLC', 'FRC', 'SL', 'SR'], '5.1.2': ['FL', 'FR', 'FC', 'LFE', 'SL', 'SR', 'TFL', 'TFR'],
  '5.1.2(back)': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'TFL', 'TFR'], octagonal: ['FL', 'FR', 'FC', 'BL', 'BR', 'BC', 'SL', 'SR'],
  cube: ['FL', 'FR', 'BL', 'BR', 'TFL', 'TFR', 'TBL', 'TBR'], '5.1.4': ['FL', 'FR', 'FC', 'LFE', 'SL', 'SR', 'TFL', 'TFR', 'TBL', 'TBR'],
  '7.1.2': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'SL', 'SR', 'TFL', 'TFR'], '7.1.4': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'SL', 'SR', 'TFL', 'TFR', 'TBL', 'TBR'],
  '7.2.3': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'SL', 'SR', 'TFL', 'TFR', 'TBC', 'LFE2'],
  '9.1.4': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'FLC', 'FRC', 'SL', 'SR', 'TFL', 'TFR', 'TBL', 'TBR'],
  '9.1.6': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'FLC', 'FRC', 'SL', 'SR', 'TFL', 'TFR', 'TBL', 'TBR', 'TSL', 'TSR'],
  hexadecagonal: ['FL', 'FR', 'FC', 'BL', 'BR', 'BC', 'SL', 'SR', 'TFL', 'TFC', 'TFR', 'TBL', 'TBC', 'TBR', 'WL', 'WR'],
  '22.2': ['FL', 'FR', 'FC', 'LFE', 'BL', 'BR', 'FLC', 'FRC', 'BC', 'SL', 'SR', 'TC', 'TFL', 'TFC', 'TFR', 'TBL', 'TBC', 'TBR', 'LFE2', 'TSL', 'TSR', 'BFC', 'BFL', 'BFR'],
};

/**
 * Layout assumed for a channel count without a (matching) name. Only the unambiguous
 * broadcast cases; 3, 4, 7 and more than 8 channels stay discrete (weight 1.0 each),
 * because e.g. a 4-channel interface is rarely a quad loudspeaker set-up.
 */
const DEFAULT_FOR_COUNT: Record<number, string> = { 1: 'mono', 2: 'stereo', 5: '5.0', 6: '5.1', 8: '7.1' };

/** Display names (German convention of the meters). */
const SHORT: Record<string, string> = {
  FL: 'L', FR: 'R', FC: 'C', LFE: 'LFE', LFE2: 'LFE2', BL: 'Lb', BR: 'Rb', SL: 'Ls', SR: 'Rs', BC: 'Cb', FLC: 'Lc', FRC: 'Rc',
  WL: 'Lw', WR: 'Rw', TFL: 'Ltf', TFR: 'Rtf', TFC: 'Ctf', TBL: 'Ltb', TBR: 'Rtb', TBC: 'Ctb', TC: 'Top', TSL: 'Lts', TSR: 'Rts',
  BFC: 'Cbf', BFL: 'Lbf', BFR: 'Rbf',
};

export interface ChannelInfo {
  /** ffmpeg channel name, or the channel number if the layout is unknown */
  id: string;
  /** name shown at the meter */
  name: string;
  /** nominal azimuth θ (degrees, positive = left, BS.2051 convention) and elevation φ; null if unknown */
  az: number | null;
  el: number | null;
  lfe: boolean;
  /** BS.1770-5 weight G_i (0 for LFE) */
  weight: number;
}

/** Nominal direction of an ffmpeg channel name (Einschätzung, see header). */
function direction(id: string, hasSide: boolean): [number, number] | null {
  const mid: Record<string, number> = { FC: 0, FL: 30, FR: -30, FLC: 15, FRC: -15, WL: 60, WR: -60, SL: 90, SR: -90, BC: 180 };
  if (id in mid) return [mid[id], 0];
  if (id === 'BL' || id === 'BR') { const a = hasSide ? 135 : 110; return [id === 'BL' ? a : -a, 0]; }
  const top: Record<string, number> = { TFC: 0, TFL: 45, TFR: -45, TSL: 90, TSR: -90, TBL: 135, TBR: -135, TBC: 180 };
  if (id in top) return [top[id], 45];
  if (id === 'TC') return [0, 90];
  const bottom: Record<string, number> = { BFC: 0, BFL: 45, BFR: -45 };
  if (id in bottom) return [bottom[id], -30];
  return null;
}

/** BS.1770-5 Annex 3, Table 4 (p23). */
export function positionWeight(az: number, el: number): number {
  const a = Math.abs(((az + 540) % 360) - 180);
  return Math.abs(el) < 30 && a >= 60 && a <= 120 ? 1.41 : 1.0;
}

/** Channel names, directions and weights for a stream with `channels` channels and ffmpeg layout name `layout`. */
export function channelInfo(channels: number, layout = ''): ChannelInfo[] {
  const l = layout.toLowerCase().trim();
  let ids = FFMPEG_LAYOUTS[l];
  if (!ids || ids.length !== channels) ids = FFMPEG_LAYOUTS[DEFAULT_FOR_COUNT[channels] ?? ''];
  if (!ids || ids.length !== channels) {
    // unknown layout: numbered channels, weight 1.0 (no direction known)
    return Array.from({ length: channels }, (_, i) => ({ id: String(i + 1), name: i < 2 ? ['L', 'R'][i] : String(i + 1), az: null, el: null, lfe: false, weight: 1 }));
  }
  const hasSide = ids.includes('SL') || ids.includes('SR');
  return ids.map((id) => {
    const lfe = id.startsWith('LFE');
    const d = lfe ? null : direction(id, hasSide);
    return { id, name: channels === 1 ? 'M' : SHORT[id] ?? id, az: d?.[0] ?? null, el: d?.[1] ?? null, lfe, weight: lfe ? 0 : d ? positionWeight(d[0], d[1]) : 1 };
  });
}

/** True if the layout name is known (weights follow Table 4) rather than assumed from the channel count. */
export function layoutKnown(channels: number, layout = ''): boolean {
  const ids = FFMPEG_LAYOUTS[layout.toLowerCase().trim()];
  return !!ids && ids.length === channels;
}

/**
 * Indices of the main (non-LFE) channels in clockwise reproduction order starting at
 * front left – the order of the EBU multichannel ident (Tech 3304 §4.2, p8).
 */
export function clockwiseOrder(info: ChannelInfo[]): number[] {
  const main = info.map((c, i) => ({ c, i })).filter(({ c }) => !c.lfe);
  // clockwise seen from above = decreasing azimuth, starting at +30° (front left)
  const key = (az: number | null, i: number) => (az === null ? 1000 + i : (((30 - az) % 360) + 360) % 360);
  return main.sort((a, b) => key(a.c.az, a.i) - key(b.c.az, b.i)).map(({ i }) => i);
}
