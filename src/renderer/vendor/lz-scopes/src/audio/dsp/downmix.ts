// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Listening to multichannel sound in the browser (#234): a channel pair, one channel solo, or a
// stereo downmix – as a 2 × n matrix for the playback ring buffer (dsp/driftbuffer.ts).
//
// Lo/Ro: ITU-R BS.775-3 (08/2012) Table 2, 3/2 → 2/0: L0 = L + 0.7071·C + 0.7071·Ls,
//   R0 = R + 0.7071·C + 0.7071·Rs; the LFE channel is not part of the downmix (§ "Down-mixing",
//   the LFE is optional for reproduction).
// Lt/Rt: ATSC A/52:2018 §7.8.2: Lt = L + 0.7071·C − 0.7071·(Ls + Rs),
//   Rt = R + 0.7071·C + 0.7071·(Ls + Rs) (matrix surround, compatible with Pro Logic decoding).
// Channels beyond 5.1 (back pair of 7.1, wide, heights, 22.2 bottom) fold into the nearest of
// L, R, C, Ls, Rs with 0.7071 – an own choice (Einschätzung): BS.775 only covers 3/2, and
// BS.2127 (ADM renderer) is not a downmix for a headphone check. No normalisation: a loud 5.1
// can clip the downmix, like on a real downmix monitor; the meters measure the raw channels.

import type { ChannelInfo } from './layouts';

const K = Math.SQRT1_2;

export type ListenSel = { kind: 'pair'; pair: number } | { kind: 'solo'; ch: number } | { kind: 'loro' } | { kind: 'ltrt' };

/** Which bus of 3/2 a channel belongs to (by ffmpeg name, then by direction). */
export function bus(c: ChannelInfo): 'L' | 'R' | 'C' | 'Ls' | 'Rs' | 'LFE' | null {
  if (c.lfe) return 'LFE';
  switch (c.id) {
    case 'FL': return 'L';
    case 'FR': return 'R';
    case 'FC': return 'C';
    case 'SL': case 'BL': return 'Ls';
    case 'SR': case 'BR': return 'Rs';
    default:
  }
  if (c.az === null) return null;
  const a = ((c.az + 540) % 360) - 180; // −180 … 180, positive = left
  if (Math.abs(a) <= 10) return 'C';
  if (Math.abs(a) >= 170) return null; // centre back: both surrounds, handled below
  if (Math.abs(a) < 75) return a > 0 ? 'L' : 'R';
  return a > 0 ? 'Ls' : 'Rs';
}

/** 2 × n matrix (left, right) for the selection. */
export function listenMatrix(info: ChannelInfo[], sel: ListenSel): number[][] {
  const n = info.length, L = new Array<number>(n).fill(0), R = new Array<number>(n).fill(0);
  if (sel.kind === 'pair') {
    const a = Math.min(n - 1, sel.pair * 2), b = Math.min(n - 1, sel.pair * 2 + 1);
    L[a] = 1; R[b] = 1;
    return [L, R];
  }
  if (sel.kind === 'solo') {
    const c = Math.max(0, Math.min(n - 1, sel.ch));
    L[c] = 1; R[c] = 1;
    return [L, R];
  }
  if (n === 1) { L[0] = 1; R[0] = 1; return [L, R]; }
  info.forEach((c, i) => {
    // the original 3/2 channels with their BS.775 / A/52 gain, the rest folded in at −3 dB extra
    const native = ['FL', 'FR', 'FC', 'SL', 'SR', 'BL', 'BR'].includes(c.id);
    const extra = native ? 1 : K;
    const b = bus(c);
    const surround = (s: number) => {
      if (sel.kind === 'loro') { if (s > 0) L[i] += K * extra; else R[i] += K * extra; }
      else { L[i] -= K * extra; R[i] += K * extra; } // Lt/Rt: Ls and Rs both into the mono surround
    };
    if (b === 'L') L[i] += extra;
    else if (b === 'R') R[i] += extra;
    else if (b === 'C') { L[i] += K * extra; R[i] += K * extra; }
    else if (b === 'Ls') surround(1);
    else if (b === 'Rs') surround(-1);
    else if (b === null && c.az !== null) { // centre back: half into each surround
      if (sel.kind === 'loro') { L[i] += K * K; R[i] += K * K; } else { L[i] -= K; R[i] += K; }
    }
  });
  // a stream without known directions (numbered channels): 1/2 as L/R, no downmix possible
  if (info.every((c) => c.az === null && !c.lfe)) { L.fill(0); R.fill(0); L[0] = 1; R[Math.min(1, n - 1)] = 1; }
  return [L, R];
}

/** Selection as stored in the monitor settings: "p0" pair, "s3" solo channel 4, "loro", "ltrt". */
export function parseListen(v: string): ListenSel {
  if (v === 'loro' || v === 'ltrt') return { kind: v };
  const m = /^([ps])(\d+)$/.exec(v);
  if (m) return m[1] === 'p' ? { kind: 'pair', pair: Number(m[2]) } : { kind: 'solo', ch: Number(m[2]) };
  return { kind: 'pair', pair: 0 };
}

export const listenFor = (info: ChannelInfo[], v: string) => listenMatrix(info, parseListen(v));

/** Whether Lo/Ro and Lt/Rt make sense: more than two channels with known directions. */
export const canDownmix = (info: ChannelInfo[]) => info.length > 2 && info.some((c) => c.id === 'FC' || c.id === 'SL' || c.id === 'BL');
