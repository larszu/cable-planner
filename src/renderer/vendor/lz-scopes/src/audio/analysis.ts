// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Audio analysis of one source: loudness (M/S/I/LRA/Max), level meters (peak, true peak,
// correlation), a ring of the latest samples for spectrum and goniometer, and the M/S
// history at 10 Hz. Fed from the capture worklet, the generator loop-back or the bridge
// (proto 2). No DOM – the panels only read from here.

import { LoudnessMeter } from './dsp/loudness';
import { LevelMeter } from './dsp/meters';
import { LtcReader } from './dsp/ltc';
import { channelInfo, layoutKnown, type ChannelInfo } from './dsp/layouts';
import { IdentDetector, type IdentReport } from './dsp/ident';
import { AvSyncMeter } from './dsp/avsync';
import { toDb } from './dsp/truepeak';

const RING = 32768;
const HISTORY = 36000; // 1 h at 10 Hz
/** True-peak marks in the history: steps above the R 128 limit of −1 dBTP */
export const TP_MARK = -1;

export class AudioAnalysis {
  readonly fs: number;
  readonly channels: number;
  readonly layout: string;
  readonly loud: LoudnessMeter;
  readonly level: LevelMeter;
  readonly names: string[];
  readonly info: ChannelInfo[];
  /** channel layout taken from the stream (else assumed from the channel count) */
  readonly layoutKnown: boolean;
  readonly ident: IdentDetector;
  /** A/V offset (bridge streams with PTS); fed by the source */
  readonly av: AvSyncMeter;
  /** latest samples per channel; `frames` counts everything ever pushed */
  private ring: Float32Array[];
  frames = 0;
  /** M and S at 10 Hz */
  readonly histM = new Float32Array(HISTORY);
  readonly histS = new Float32Array(HISTORY);
  /** highest true peak of all channels in each 100 ms step (dBTP) and the wall-clock time of the step */
  readonly histTP = new Float32Array(HISTORY);
  readonly histTime = new Float64Array(HISTORY);
  histLen = 0;
  histHead = 0;
  /** gaps in the sample index of bridge packets since the last reset */
  gaps = 0;
  private expect = -1;
  version = 0;
  lastPush = 0;
  /** where the numbers come from, e.g. "Bridge · aac 48 kHz" */
  label = '';
  /** LTC reader on one channel (clock panel, src/clock); null = off */
  ltc: LtcReader | null = null;
  ltcChannel = 0;
  /** performance.now() when the reader had consumed `ltc.position` samples */
  ltcAt = 0;

  constructor(fs: number, channels: number, layout = '') {
    this.fs = fs; this.channels = Math.max(1, channels); this.layout = layout;
    this.loud = new LoudnessMeter(fs, this.channels, layout);
    this.level = new LevelMeter(fs, this.channels);
    this.ring = Array.from({ length: this.channels }, () => new Float32Array(RING));
    this.info = channelInfo(this.channels, layout);
    this.layoutKnown = layoutKnown(this.channels, layout) || this.channels <= 2;
    this.names = this.info.map((c) => c.name);
    this.ident = new IdentDetector(fs, this.info);
    this.av = new AvSyncMeter(fs);
    this.loud.onStep = (m, s) => {
      this.histM[this.histHead] = m; this.histS[this.histHead] = s;
      let tp = 0;
      for (let c = 0; c < this.channels; c++) tp = Math.max(tp, this.level.truePeakOver(c, 100));
      this.histTP[this.histHead] = toDb(tp);
      this.histTime[this.histHead] = Date.now();
      this.histHead = (this.histHead + 1) % HISTORY;
      this.histLen = Math.min(HISTORY, this.histLen + 1);
    };
  }

  /** Planar samples (one array per channel, n frames). */
  push(chs: Float32Array[], n: number) {
    if (n <= 0) return;
    const planar = chs.length >= this.channels ? chs : [...chs, ...Array.from({ length: this.channels - chs.length }, () => new Float32Array(n))];
    this.level.process(planar, n);
    this.loud.process(planar, n);
    this.ident.push(planar, n);
    for (let c = 0; c < this.channels; c++) {
      const r = this.ring[c], x = planar[c];
      const pos = this.frames % RING;
      if (n >= RING) { r.set(x.subarray(n - RING)); continue; }
      const first = Math.min(n, RING - pos);
      r.set(x.subarray(0, first), pos);
      if (first < n) r.set(x.subarray(first, n), 0);
    }
    this.frames += n;
    this.version++;
    this.lastPush = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.ltc) { this.ltc.process(planar[Math.min(this.ltcChannel, this.channels - 1)], n); this.ltcAt = this.lastPush; }
  }

  /** Read LTC from channel ch (−1 = off). */
  setLtc(ch: number) {
    if (ch < 0) { this.ltc = null; return; }
    if (!this.ltc || ch !== this.ltcChannel) this.ltc = new LtcReader(this.fs);
    this.ltcChannel = ch;
  }

  /**
   * Interleaved f32 (bridge). `first` = index of the first frame since stream start,
   * `pts0` = its presentation timestamp in s (NaN if the bridge sends none).
   */
  pushInterleaved(data: Float32Array, first = -1, pts0 = NaN) {
    const ch = this.channels, n = Math.floor(data.length / ch);
    if (first >= 0) {
      if (this.expect >= 0 && first !== this.expect) this.gaps++;
      this.expect = first + n;
    }
    const chs = Array.from({ length: ch }, () => new Float32Array(n));
    for (let i = 0, j = 0; i < n; i++) for (let c = 0; c < ch; c++) chs[c][i] = data[j++];
    this.push(chs, n);
    if (Number.isFinite(pts0)) this.av.pushAudio(chs, n, pts0);
  }

  private identCache: { at: number; r: IdentReport } | null = null;
  /** Ident recognition, recomputed at most twice a second. */
  identReport(): IdentReport {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!this.identCache || now - this.identCache.at > 500) this.identCache = { at: now, r: this.ident.analyse() };
    return this.identCache.r;
  }

  /** PSR = true peak of the last 3 s minus short-term loudness (dB); null without signal. */
  get psr(): number | null {
    let tp = 0;
    for (let c = 0; c < this.channels; c++) tp = Math.max(tp, this.level.truePeakOver(c, 3000));
    const s = this.loud.shortTerm;
    return tp > 0 && Number.isFinite(s) ? toDb(tp) - s : null;
  }

  /** Index range of the history (oldest first) as [ring index, …]. */
  private histIndex(points: number) {
    const n = Math.min(points, this.histLen);
    return Array.from({ length: n }, (_, i) => (this.histHead - n + i + HISTORY) % HISTORY);
  }

  /** True-peak overs in the last `points` steps: position (0 = oldest shown) and dBTP. */
  tpMarks(points: number, limit = TP_MARK): { i: number; db: number; time: number }[] {
    const idx = this.histIndex(points), off = points - idx.length, out: { i: number; db: number; time: number }[] = [];
    idx.forEach((j, k) => { if (this.histTP[j] > limit) out.push({ i: off + k, db: this.histTP[j], time: this.histTime[j] }); });
    return out;
  }

  /** Protocol as CSV: header with the summary, then M, S, true peak every 100 ms. */
  toCsv(): string {
    const L = this.loud, f = (v: number | null) => (v === null || !Number.isFinite(v) ? '' : v.toFixed(1));
    const maxTP = toDb(Math.max(...this.level.maxTP));
    const lines = [
      '# LZ Scopes – Lautheitsprotokoll (ITU-R BS.1770-5, EBU Tech 3341/3342)',
      `# Quelle;${this.label.replace(/;/g, ',')}`,
      `# Abtastrate;${this.fs};Kanaele;${this.channels};Layout;${this.layout || (this.layoutKnown ? 'Standard' : 'unbekannt')}`,
      `# Integrated LUFS;${f(L.integrated)};LRA LU;${f(L.lra)};Max M LUFS;${f(L.maxM)};Max S LUFS;${f(L.maxS)};Max TP dBTP;${f(maxTP)};PLR dB;${f(Number.isFinite(L.integrated) ? maxTP - L.integrated : null)}`,
      `# Messdauer s;${L.measuredSeconds.toFixed(1)};Luecken;${this.gaps};Clip-Samples;${this.level.clips.reduce((s, c) => s + c, 0)}`,
      'Zeit (ISO 8601);M LUFS;S LUFS;True Peak dBTP;TP > -1 dBTP',
    ];
    for (const j of this.histIndex(HISTORY)) {
      lines.push(`${new Date(this.histTime[j]).toISOString()};${f(this.histM[j])};${f(this.histS[j])};${f(this.histTP[j])};${this.histTP[j] > TP_MARK ? 'x' : ''}`);
    }
    return lines.join('\n') + '\n';
  }

  /** Copy of the last n samples of channel c (n ≤ 32768). */
  latest(c: number, n: number): Float32Array {
    n = Math.min(n, RING);
    const out = new Float32Array(n), r = this.ring[Math.min(c, this.channels - 1)];
    const end = this.frames % RING;
    const start = (end - n + RING) % RING;
    if (start + n <= RING) out.set(r.subarray(start, start + n));
    else { out.set(r.subarray(start)); out.set(r.subarray(0, n - (RING - start)), RING - start); }
    return out;
  }

  /** History values of the last `points` steps (oldest first). */
  history(which: 'm' | 's', points: number): Float32Array {
    const src = which === 'm' ? this.histM : this.histS, n = Math.min(points, this.histLen);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = src[(this.histHead - n + i + HISTORY) % HISTORY];
    return out;
  }

  /** Reset I, LRA, Max M/S, Max peak/TP, clip and gap counters together. */
  reset() {
    this.loud.reset(); this.level.reset(); this.gaps = 0; this.histLen = 0; this.version++;
  }
  get paused() { return this.loud.paused; }
  set paused(v: boolean) { this.loud.paused = v; this.version++; }
  /** Silent for more than a second (source stopped, stream stalled). */
  get stale() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.lastPush > 1000; }
}
