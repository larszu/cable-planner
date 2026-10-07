// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// A/V offset from a flash (luma step in the picture) and a beep (1 kHz burst in the sound),
// both stamped with the presentation timestamps (PTS) of the same ffmpeg process
// (bridge protocol 2). Signal pair: test pattern “A/V-Sync” + generator “A/V-Sync-Piep”,
// or any clapper/flash-and-beep source.
//
// Sign convention and limits after ITU-R BT.1359-1 (1998, opened as PDF):
//   “a positive value indicates that sound is advanced with respect to vision” (Note 1),
//   detectability about +45 ms … −125 ms, acceptability about +90 ms … −185 ms
//   (considering g, Appendix 1 §3); overall chain tolerance +90/−185 ms (recommends 2);
//   image source → final programme selection +25/−100 ms (recommends 3); final selection
//   → transmitter input +22.5/−30 ms (recommends 4).
// offset = t(flash) − t(beep): the beep comes first → positive → sound advanced.
//
// Resolution: the flash is only seen at frame instants. The onset is interpolated
// linearly between the last dark and the first bright frame (a partly exposed frame lands
// in between), which is an estimate; the uncertainty stays about ±½ frame (20 ms at 25 fps).
// The beep onset is found to about 1 ms (band-pass 1 kHz, envelope in 1 ms blocks).

export interface AvPair { at: number; offsetMs: number }
export interface AvResult {
  pairs: AvPair[];
  /** median of the last pairs in ms (null without pairs) */
  medianMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  /** frame duration of the video in ms (resolution of the flash) */
  frameMs: number | null;
  flashes: number;
  beeps: number;
  /** why nothing can be measured (e.g. no timestamps) */
  problem: string;
}

export type AvRating = 'undetectable' | 'acceptable' | 'unacceptable';
export const BT1359 = {
  detect: [-125, 45] as const, accept: [-185, 90] as const,
  source: [-100, 25] as const, distribution: [-30, 22.5] as const,
};

/** Rating of an offset (ms, BT.1359 sign) against the thresholds of BT.1359-1. */
export function rateAv(ms: number): AvRating {
  if (ms >= BT1359.detect[0] && ms <= BT1359.detect[1]) return 'undetectable';
  if (ms >= BT1359.accept[0] && ms <= BT1359.accept[1]) return 'acceptable';
  return 'unacceptable';
}
export const AV_RATING_TEXT: Record<AvRating, string> = {
  undetectable: 'nicht wahrnehmbar (BT.1359: +45 … −125 ms)',
  acceptable: 'wahrnehmbar, noch akzeptabel (BT.1359: +90 … −185 ms)',
  unacceptable: 'nicht akzeptabel (außerhalb +90 … −185 ms, BT.1359)',
};

const HIST = 64;

export class AvSyncMeter {
  readonly fs: number;
  private flashes: number[] = [];
  private beeps: number[] = [];
  readonly pairs: AvPair[] = [];
  // video
  private lumas: { t: number; y: number }[] = [];
  private frameDt: number[] = [];
  // audio: band-pass state and 1 ms envelope
  private bp: { b0: number; b2: number; a1: number; a2: number; x1: number; x2: number; y1: number; y2: number };
  private blk = 0;
  private blkMax = 0;
  private blkT = 0;
  private env: { t: number; m: number }[] = [];
  private blockLen: number;
  private pending: { t: number; wait: number } | null = null;
  private quietSince = -Infinity;
  /** ring of the last band-passed magnitudes (≈85 ms at 48 kHz) with their times */
  private sv = new Float32Array(4096);
  private st = new Float64Array(4096);
  private sp = 0;
  private ref = { peak: 0, floor: 0, at: 0 };
  noPts = false;
  version = 0;

  constructor(fs: number) {
    this.fs = fs;
    // RBJ band-pass (constant 0 dB peak), 1 kHz, Q = 2
    const w = (2 * Math.PI * 1000) / fs, al = Math.sin(w) / (2 * 2), a0 = 1 + al;
    this.bp = { b0: al / a0, b2: -al / a0, a1: (-2 * Math.cos(w)) / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
    this.blockLen = Math.max(1, Math.round(fs / 1000));
  }

  reset() { this.flashes = []; this.beeps = []; this.pairs.length = 0; this.version++; }

  /** One picture: PTS in s and mean luma 0…1. */
  pushVideo(pts: number, luma: number) {
    if (!Number.isFinite(pts)) { this.noPts = true; return; }
    const L = this.lumas;
    const prev = L[L.length - 1];
    if (prev && pts <= prev.t) { if (pts < prev.t - 1) L.length = 0; else return; } // restart / duplicate
    if (prev) { this.frameDt.push(pts - prev.t); if (this.frameDt.length > 50) this.frameDt.shift(); }
    L.push({ t: pts, y: luma });
    while (L.length && pts - L[0].t > 2) L.shift();
    if (L.length < 3 || !prev) return;
    let lo = Infinity, hi = -Infinity;
    for (const f of L) { if (f.y < lo) lo = f.y; if (f.y > hi) hi = f.y; }
    if (hi - lo < 0.2) return; // no flash in the last 2 s
    const thr = (lo + hi) / 2;
    if (prev.y < thr && luma >= thr) {
      // exposure model: a frame integrates the light over its whole duration, PTS = start of
      // the exposure. A partly bright frame tells where in it the flash began.
      const dt = pts - prev.t, ep = (prev.y - lo) / (hi - lo), ec = Math.min(1, (luma - lo) / (hi - lo));
      const t = ep > 0.05 ? prev.t + (1 - ep) * dt : pts + (1 - ec) * dt;
      const last = this.flashes[this.flashes.length - 1];
      if (last === undefined || t - last > 0.3) { this.flashes.push(t); this.trim(this.flashes); this.pair(); }
    }
  }

  /** Planar audio, n frames; `pts0` = PTS of the first frame in s (NaN if unknown). */
  pushAudio(chs: ArrayLike<number>[], n: number, pts0: number) {
    if (!Number.isFinite(pts0)) { this.noPts = true; return; }
    const f = this.bp, k = chs.length, dt = 1 / this.fs;
    for (let i = 0; i < n; i++) {
      let x = 0;
      for (let c = 0; c < k; c++) x += chs[c][i];
      x /= k;
      const y = f.b0 * x + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2;
      f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y;
      const t = pts0 + i * dt;
      const a = Math.abs(y);
      this.sv[this.sp] = a; this.st[this.sp] = t; this.sp = (this.sp + 1) & 4095;
      if (this.blk === 0) this.blkT = t;
      if (a > this.blkMax) this.blkMax = a;
      if (++this.blk >= this.blockLen) this.block();
    }
  }

  private block() {
    const E = this.env;
    E.push({ t: this.blkT, m: this.blkMax });
    this.blk = 0; this.blkMax = 0;
    while (E.length > 2000) E.shift();
    if (E.length < 200) return;
    // reference levels over the last 2 s (updated every 50 ms): peak and a low percentile as the floor
    if (++this.ref.at >= 50) {
      this.ref.at = 0;
      let pk = 0;
      for (const e of E) if (e.m > pk) pk = e.m;
      const sorted = E.map((e) => e.m).sort((a, b) => a - b);
      this.ref.peak = pk; this.ref.floor = sorted[Math.floor(sorted.length * 0.2)];
    }
    const peak = Math.max(this.ref.peak, E[E.length - 1].m), floor = this.ref.floor;
    const hiThr = Math.max(peak * 0.25, floor * 6), loThr = Math.max(peak * 0.08, floor * 2);
    const cur = E[E.length - 1];
    if (peak < 1e-4 || peak < floor * 10) return; // no clear beep above the noise
    if (cur.m < loThr) { if (this.quietSince === -Infinity) this.quietSince = cur.t; }
    else if (cur.m >= hiThr && this.quietSince !== -Infinity && cur.t - this.quietSince > 0.2 && !this.pending) {
      this.pending = { t: cur.t, wait: 10 };
      this.quietSince = -Infinity;
      return;
    } else if (cur.m >= loThr) this.quietSince = -Infinity;
    // 10 ms after the onset block: refine to the first sample above 30 % of the burst amplitude
    if (this.pending && --this.pending.wait <= 0) {
      const t0 = this.pending.t;
      let amp = 0;
      for (let j = E.length - 1; j >= 0 && E[j].t >= t0; j--) amp = Math.max(amp, E[j].m);
      const from = t0 - 0.002;
      let t = t0;
      for (let j = 0; j < 4096; j++) {
        const q = (this.sp + j) & 4095;
        if (this.st[q] >= from && this.sv[q] >= amp * 0.3) { t = this.st[q]; break; }
      }
      this.pending = null;
      const last = this.beeps[this.beeps.length - 1];
      if (last === undefined || t - last > 0.3) { this.beeps.push(t); this.trim(this.beeps); this.pair(); }
    }
  }

  private trim(a: number[]) { if (a.length > HIST) a.splice(0, a.length - HIST); }

  /** Pair every new flash with the nearest beep within ±0.5 s. */
  private pair() {
    const done = new Set(this.pairs.map((p) => p.at));
    for (const v of this.flashes) {
      if (done.has(v)) continue;
      let best: number | null = null;
      for (const a of this.beeps) if (Math.abs(v - a) < 0.5 && (best === null || Math.abs(v - a) < Math.abs(v - best))) best = a;
      // wait for a beep that could still come after the flash
      if (best === null) continue;
      this.pairs.push({ at: v, offsetMs: (v - best) * 1000 });
      if (this.pairs.length > HIST) this.pairs.shift();
      this.version++;
    }
  }

  result(last = 10): AvResult {
    const p = this.pairs.slice(-last).map((x) => x.offsetMs).sort((a, b) => a - b);
    const dts = [...this.frameDt].sort((a, b) => a - b);
    return {
      pairs: this.pairs.slice(),
      medianMs: p.length ? p[p.length >> 1] : null,
      minMs: p.length ? p[0] : null,
      maxMs: p.length ? p[p.length - 1] : null,
      frameMs: dts.length ? dts[dts.length >> 1] * 1000 : null,
      flashes: this.flashes.length,
      beeps: this.beeps.length,
      problem: this.noPts ? 'Keine Zeitstempel (PTS) von der Quelle – A/V-Versatz nicht messbar' : '',
    };
  }
}
