// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Long-run A/V offset (#236): every flash/beep pair of dsp/avsync.ts lands here with its
// wall-clock time. Kept as one-minute buckets (min, max, mean, count) for up to 24 h, plus the
// raw pairs of the last 10 minutes. Drift = least-squares slope of the offset over time
// (ms per hour), from the raw pairs of the last hour – a steady slope points to two clocks
// that are not locked (audio and video from different references), a step to a re-lock.
// Tolerances: ITU-R BT.1359-1 (see dsp/avsync.ts); “outside” counts pairs beyond the
// detectability limits +45/−125 ms and the acceptability limits +90/−185 ms.

import { BT1359 } from './avsync';

export interface AvBucket { t: number; n: number; min: number; max: number; sum: number }
export interface AvHistoryStats {
  pairs: number;
  /** first and last pair (ms since epoch) */
  from: number | null; to: number | null;
  meanMs: number | null; minMs: number | null; maxMs: number | null;
  /** least-squares slope over the last hour, ms per hour; null below 10 pairs or 2 minutes */
  driftMsPerHour: number | null;
  /** pairs outside the detectability / acceptability range of BT.1359-1 */
  beyondDetect: number; beyondAccept: number;
}

const MIN = 60_000;
const KEEP_BUCKETS = 24 * 60;
const KEEP_RAW = 60 * MIN;

export class AvHistory {
  readonly buckets: AvBucket[] = [];
  /** raw pairs of the last hour: time (ms epoch) and offset (ms, BT.1359 sign) */
  readonly raw: { t: number; ms: number }[] = [];
  private total = 0;
  private beyondDetect = 0;
  private beyondAccept = 0;
  version = 0;

  add(t: number, ms: number) {
    const bt = Math.floor(t / MIN) * MIN;
    let b = this.buckets[this.buckets.length - 1];
    if (!b || b.t !== bt) { b = { t: bt, n: 0, min: Infinity, max: -Infinity, sum: 0 }; this.buckets.push(b); }
    b.n++; b.sum += ms; b.min = Math.min(b.min, ms); b.max = Math.max(b.max, ms);
    while (this.buckets.length > KEEP_BUCKETS) this.buckets.shift();
    this.raw.push({ t, ms });
    while (this.raw.length && t - this.raw[0].t > KEEP_RAW) this.raw.shift();
    this.total++;
    if (ms < BT1359.detect[0] || ms > BT1359.detect[1]) this.beyondDetect++;
    if (ms < BT1359.accept[0] || ms > BT1359.accept[1]) this.beyondAccept++;
    this.version++;
  }

  reset() { this.buckets.length = 0; this.raw.length = 0; this.total = 0; this.beyondDetect = 0; this.beyondAccept = 0; this.version++; }

  stats(): AvHistoryStats {
    const B = this.buckets;
    let n = 0, sum = 0, mn = Infinity, mx = -Infinity;
    for (const b of B) { n += b.n; sum += b.sum; mn = Math.min(mn, b.min); mx = Math.max(mx, b.max); }
    return {
      pairs: this.total, from: B[0]?.t ?? null, to: this.raw[this.raw.length - 1]?.t ?? null,
      meanMs: n ? sum / n : null, minMs: n ? mn : null, maxMs: n ? mx : null,
      driftMsPerHour: slope(this.raw), beyondDetect: this.beyondDetect, beyondAccept: this.beyondAccept,
    };
  }

  /** CSV: one line per minute (time, pairs, min, mean, max in ms). */
  toCsv(): string {
    const f = (v: number) => v.toFixed(1);
    return ['time;pairs;min_ms;mean_ms;max_ms', ...this.buckets.map((b) => `${new Date(b.t).toISOString()};${b.n};${f(b.min)};${f(b.sum / b.n)};${f(b.max)}`)].join('\n') + '\n';
  }
}

/** Least-squares slope in ms per hour; null for fewer than 10 points or less than 2 minutes. */
export function slope(pts: { t: number; ms: number }[]): number | null {
  if (pts.length < 10 || pts[pts.length - 1].t - pts[0].t < 2 * MIN) return null;
  const t0 = pts[0].t;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of pts) { const x = (p.t - t0) / 3_600_000; sx += x; sy += p.ms; sxx += x * x; sxy += x * p.ms; }
  const n = pts.length, d = n * sxx - sx * sx;
  return d > 0 ? (n * sxy - sx * sy) / d : null;
}
