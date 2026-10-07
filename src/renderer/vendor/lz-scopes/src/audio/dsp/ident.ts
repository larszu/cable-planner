// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Ident recognition: which line-up signal is running, and is the channel assignment right?
//
// Works on an envelope of 10 ms blocks per channel (power, zero crossings) plus the L·R
// products of channels 1/2, over the last 32 s. Recognised signals and their timing:
//   EBU stereo ident, EBU R 49-1999 Table 2 note 2 (p3): 1 kHz on both tracks, track 1
//     (left) interrupted for 0.25 s every 3 s; both tracks "coherent … and in phase" (note 3).
//   GLITS (secondary source, Wikipedia): 4 s cycle, L off 250 ms, then R off twice
//     250 ms, starting 500 ms and 1 s after the L gap (generator: signals.ts).
//   BLITS, EBU Tech 3304 §4.1 (p6–7): section 1 = one 600 ms burst per channel, 800 ms
//     apart, order L, R, C, LFE, Ls, Rs (Figure 2) at 880/880/1320/82.5/660/660 Hz;
//     section 2 = R 1 kHz for 5.1 s, L with four 300 ms breaks.
//   EBU multichannel ident, Tech 3304 §4.2 (p8): 3 s 1 kHz on all main channels, then
//     each main channel alone for 0.5 s, 1 s apart, clockwise from front left; LFE 80 Hz.
//   LZ Kanal-Ident L/R (own signal, signals.ts): L one 400 ms tone, R two, 3 s cycle.
// Findings: "L/R vertauscht", "Polarität invertiert" (L·R correlation < −0.9 while both
// carry the tone), "Kanal fehlt", wrong channel order, line-up level against −18 dBFS
// (EBU R 68). The tolerances (±40 ms on durations and spacings) are our own choice.

import type { ChannelInfo } from './layouts';
import { clockwiseOrder } from './layouts';
import { BLITS_FREQS } from './signals';

const BLOCKS = 3200; // 32 s of 10 ms blocks
const PRESENT = 1e-5; // −50 dBFS RMS: a channel below this carries no line-up tone
const TOL = 4; // blocks (±40 ms)

export type IdentKind = 'ebu' | 'glits' | 'blits' | 'ebu-multi' | 'lz-lr' | 'tone';
export interface Finding { level: 'ok' | 'warn' | 'bad' | 'info'; text: string }
export interface ChannelReport { name: string; present: boolean; levelDb: number | null; freq: number | null }
export interface IdentReport {
  kind: IdentKind | null;
  label: string;
  findings: Finding[];
  channels: ChannelReport[];
  /** L/R correlation while both carry the tone (null if not both on) */
  corr: number | null;
}

export const IDENT_LABELS: Record<IdentKind, string> = {
  ebu: 'EBU-Stereo-Ident (R 49)', glits: 'GLITS', blits: 'BLITS (Tech 3304)', 'ebu-multi': 'EBU-Mehrkanal-Ident (Tech 3304)',
  'lz-lr': 'LZ Kanal-Ident L/R', tone: 'Dauerton',
};

interface Run { on: boolean; start: number; len: number; complete: boolean }

const near = (v: number, target: number, tol = TOL) => Math.abs(v - target) <= tol;

export class IdentDetector {
  readonly fs: number;
  readonly info: ChannelInfo[];
  readonly channels: number;
  private pow: Float32Array[];
  private zc: Uint16Array[];
  private lr = new Float64Array(BLOCKS);
  private ll = new Float64Array(BLOCKS);
  private rr = new Float64Array(BLOCKS);
  private head = 0;
  private filled = 0;
  private acc: { e: number[]; z: number[]; sign: number[]; lr: number; ll: number; rr: number };
  private samples = 0;
  private edge: number;
  private block = 0;

  constructor(fs: number, info: ChannelInfo[]) {
    this.fs = fs; this.info = info; this.channels = info.length;
    this.pow = info.map(() => new Float32Array(BLOCKS));
    this.zc = info.map(() => new Uint16Array(BLOCKS));
    this.acc = this.blank();
    this.edge = Math.round(fs / 100);
  }

  private blank() {
    const z = () => Array(this.channels).fill(0);
    return { e: z(), z: z(), sign: this.acc?.sign ?? z(), lr: 0, ll: 0, rr: 0 };
  }

  reset() { this.filled = 0; this.head = 0; }

  push(chs: ArrayLike<number>[], n: number, offset = 0) {
    let off = offset;
    const end = offset + n;
    while (off < end) {
      const take = Math.min(end - off, this.edge - this.samples);
      const a = this.acc;
      for (let c = 0; c < this.channels; c++) {
        const x = chs[c];
        let e = 0, z = 0, s = a.sign[c];
        for (let i = off; i < off + take; i++) {
          const v = x[i];
          e += v * v;
          const sg = v > 0 ? 1 : v < 0 ? -1 : s;
          if (sg !== s && s !== 0) z++;
          s = sg;
        }
        a.e[c] += e; a.z[c] += z; a.sign[c] = s;
      }
      if (this.channels >= 2) {
        const L = chs[0], R = chs[1];
        for (let i = off; i < off + take; i++) { a.lr += L[i] * R[i]; a.ll += L[i] * L[i]; a.rr += R[i] * R[i]; }
      }
      this.samples += take; off += take;
      if (this.samples >= this.edge) this.commit();
    }
  }

  private commit() {
    const len = this.edge - Math.round((this.block * this.fs) / 100);
    const h = this.head, a = this.acc;
    for (let c = 0; c < this.channels; c++) { this.pow[c][h] = a.e[c] / Math.max(1, len); this.zc[c][h] = a.z[c]; }
    this.lr[h] = a.lr; this.ll[h] = a.ll; this.rr[h] = a.rr;
    this.head = (h + 1) % BLOCKS;
    this.filled = Math.min(BLOCKS, this.filled + 1);
    this.acc = this.blank();
    this.block++;
    this.edge = Math.round(((this.block + 1) * this.fs) / 100);
  }

  /** Last `n` blocks of a ring, oldest first. */
  private tail<T extends Float32Array | Uint16Array | Float64Array>(r: T, n: number): T {
    const out = new (r.constructor as new (n: number) => T)(n);
    for (let i = 0; i < n; i++) out[i] = r[(this.head - n + i + BLOCKS) % BLOCKS];
    return out;
  }

  analyse(): IdentReport {
    const n = this.filled;
    const pow = this.pow.map((r) => this.tail(r, n));
    const zc = this.zc.map((r) => this.tail(r, n));
    const present: boolean[] = [], on: Uint8Array[] = [];
    const channels: ChannelReport[] = pow.map((p, c) => {
      let max = 0;
      for (let i = 0; i < n; i++) if (p[i] > max) max = p[i];
      const thr = Math.max(max * 0.01, PRESENT * 0.01);
      const mask = new Uint8Array(n);
      const lv: number[] = [];
      let zsum = 0;
      for (let i = 0; i < n; i++) if (p[i] > thr && p[i] > PRESENT) { mask[i] = 1; lv.push(p[i]); }
      // frequency only from blocks inside a tone (edges of bursts miss crossings)
      let zn = 0;
      for (let i = 1; i + 1 < n; i++) if (mask[i - 1] && mask[i] && p[i + 1] > thr && p[i + 1] > PRESENT) { zsum += zc[c][i]; zn++; }
      on.push(mask);
      present.push(max > PRESENT);
      lv.sort((a, b) => a - b);
      // RMS → peak level of a sine (+3.01 dB); frequency from zero crossings
      const med = lv.length ? lv[lv.length >> 1] : 0;
      return {
        name: this.info[c].name, present: max > PRESENT,
        levelDb: med > 0 ? 10 * Math.log10(med) + 3.0103 : null,
        freq: zn ? zsum / (2 * zn * 0.01) : null,
      };
    });
    const report: IdentReport = { kind: null, label: '', findings: [], channels, corr: null };
    if (!present.some(Boolean)) return report;
    const runs = on.map((m) => runsOf(m));

    const multi = this.channels >= 5 ? this.multichannel(runs, on, present, zc) : null;
    if (multi) Object.assign(report, multi);
    else if (this.channels >= 2) Object.assign(report, stereo(runs, present));
    else report.kind = 'tone';
    report.label = report.kind ? IDENT_LABELS[report.kind] : '';

    // polarity / coherence of L and R while both carry the tone
    if (this.channels >= 2 && present[0] && present[1]) {
      const lr = this.tail(this.lr, n), ll = this.tail(this.ll, n), rr = this.tail(this.rr, n);
      let a = 0, b = 0, c = 0;
      for (let i = 0; i < n; i++) if (on[0][i] && on[1][i]) { a += lr[i]; b += ll[i]; c += rr[i]; }
      const d = Math.sqrt(b * c);
      if (d > 0) {
        const r = a / d;
        report.corr = r;
        const L = this.info[0].name, R = this.info[1].name;
        if (r < -0.9) report.findings.push({ level: 'bad', text: `Polarität invertiert: ${L} und ${R} gegenphasig (Korrelation ${fmt2(r)})` });
        else if (r > 0.9) report.findings.push({ level: 'ok', text: `${L}/${R} gleichphasig (Korrelation ${fmt2(r)})` });
        else report.findings.push({ level: 'warn', text: `${L}/${R} nicht kohärent (Korrelation ${fmt2(r)})` });
      }
    }
    // missing channels (main channels only; an LFE may legitimately be silent)
    if (present.some(Boolean)) {
      present.forEach((p, c) => {
        if (!p && !this.info[c].lfe) report.findings.push({ level: 'bad', text: `Kanal ${this.info[c].name} fehlt (kein Signal über −50 dBFS)` });
      });
    }
    // line-up level (EBU R 68: −18 dBFS); BLITS section 3 (−24 dBFS) and bursts pull the median only little
    if (report.kind && report.kind !== 'tone') {
      const lv = channels.filter((c, i) => c.present && !this.info[i].lfe && c.levelDb !== null).map((c) => c.levelDb!);
      if (lv.length) {
        const mean = lv.reduce((s, v) => s + v, 0) / lv.length;
        report.findings.push(Math.abs(mean + 18) <= 0.5
          ? { level: 'ok', text: `Pegel ${fmt1(mean)} dBFS (Ausrichtungspegel −18 dBFS, EBU R 68)` }
          : { level: 'warn', text: `Pegel ${fmt1(mean)} dBFS – Ausrichtungspegel ist −18 dBFS (EBU R 68)` });
      }
    }
    return report;
  }

  /** BLITS section 1 or the EBU multichannel sequence: order of the solo bursts. */
  private multichannel(runs: Run[][], on: Uint8Array[], present: boolean[], zc: Uint16Array[]): Partial<IdentReport> | null {
    const info = this.info;
    const lfe = info.map((c, i) => (c.lfe ? i : -1)).filter((i) => i >= 0);
    const solo = (exclude: number[]) => {
      const out: { ch: number; start: number; len: number }[] = [];
      runs.forEach((rs, ch) => {
        for (const r of rs) {
          if (!r.on || !r.complete) continue;
          let alone = 0;
          for (let i = r.start; i < r.start + r.len; i++) {
            let others = 0;
            for (let c = 0; c < on.length; c++) if (c !== ch && !exclude.includes(c) && on[c][i]) others++;
            if (!others) alone++;
          }
          if (alone >= r.len * 0.8) out.push({ ch, start: r.start, len: r.len });
        }
      });
      return out.sort((a, b) => a.start - b.start);
    };
    /** Longest regular burst sequence; a missing burst (silent channel) leaves a hole (−1). */
    const chain = (bursts: { ch: number; start: number; len: number }[], len: number, step: number, max: number) => {
      let best: number[] = [];
      for (let i = 0; i < bursts.length; i++) {
        if (!near(bursts[i].len, len)) continue;
        const seq = [bursts[i].ch];
        let last = bursts[i].start;
        for (let j = i + 1; j < bursts.length && seq.length < max; j++) {
          const d = bursts[j].start - last;
          if (!near(bursts[j].len, len)) continue;
          const k = Math.round(d / step);
          if (k >= 1 && k <= 2 && near(d, k * step)) {
            if (k === 2) seq.push(-1);
            if (seq.length < max) seq.push(bursts[j].ch);
            last = bursts[j].start;
          } else if (d > 2 * step + TOL) break;
        }
        if (seq.filter((c) => c >= 0).length > best.filter((c) => c >= 0).length) best = seq;
      }
      return best;
    };
    // BLITS section 1: 600 ms bursts every 800 ms (LFE bursts too)
    const soloAll = solo([]);
    const expectedBlits = blitsOrder(info);
    const burstFreq = (ch: number) => {
      const b = soloAll.find((x) => x.ch === ch && near(x.len, 60));
      if (!b) return null;
      let z = 0;
      for (let i = b.start; i < b.start + b.len; i++) z += zc[ch][i];
      return z / (2 * b.len * 0.01);
    };
    let blits = chain(soloAll, 60, 80, expectedBlits.length);
    // a chain cut by the window start: align it by the C burst (1320 Hz, slot 3) or the LFE burst (82.5 Hz, slot 4)
    for (const [slot, f0] of [[2, 1320], [3, 82.5]] as const) {
      const at = blits.findIndex((ch) => ch >= 0 && Math.abs((burstFreq(ch) ?? 0) - f0) < f0 * 0.08);
      if (at >= 0) { if (at < slot) blits = [...Array(slot - at).fill(-2), ...blits].slice(0, expectedBlits.length); break; }
    }
    if (blits.filter((c) => c >= 0).length >= 3) {
      const complete = blits.length >= expectedBlits.length - 1 && !blits.includes(-2);
      const findings = complete ? compareOrder(expectedBlits, blits, info, present)
        : [{ level: 'info' as const, text: `BLITS: Kennungsfolge noch unvollständig (${blits.filter((c) => c >= 0).length} von ${expectedBlits.length})` }];
      // tone frequency of each burst against Tech 3304 (L/R 880, C 1320, LFE 82.5, Ls/Rs 660 Hz)
      blits.forEach((ch, k) => {
        const want = BLITS_FREQS[k], f = ch >= 0 ? burstFreq(ch) : null;
        if (want === undefined || f === null) return;
        if (Math.abs(f - want) > Math.max(15, want * 0.08)) findings.push({ level: 'warn', text: `${info[ch].name}: ${Math.round(f)} Hz statt ${want} Hz (BLITS-Kennung ${k + 1})` });
      });
      return { kind: 'blits', findings };
    }
    // EBU multichannel: 3 s on all main channels, then 500 ms solo bursts every 1 s
    const expected = clockwiseOrder(info);
    const ebu = chain(solo(lfe), 50, 100, expected.length);
    if (ebu.filter((c) => c >= 0).length >= 3) {
      const findings = ebu.length >= expected.length - 1 ? compareOrder(expected, ebu, info, present)
        : [{ level: 'info' as const, text: `Kennungsfolge noch unvollständig (${ebu.length} von ${expected.length})` }];
      for (const l of lfe) {
        const f = this.channelFreq(l, on, zc);
        if (present[l] && f !== null && Math.abs(f - 80) > 10) findings.push({ level: 'warn', text: `${info[l].name}: ${Math.round(f)} Hz statt 80 Hz` });
        if (!present[l]) findings.push({ level: 'warn', text: `${info[l].name}: kein 80-Hz-Ton (Tech 3304 §4.2)` });
      }
      return { kind: 'ebu-multi', findings };
    }
    return null;
  }

  private channelFreq(c: number, on: Uint8Array[], zc: Uint16Array[]) {
    let z = 0, k = 0;
    for (let i = 0; i < on[c].length; i++) if (on[c][i]) { z += zc[c][i]; k++; }
    return k ? z / (2 * k * 0.01) : null;
  }
}

/** Runs of equal mask values; the first and the last run are cut by the window. */
export function runsOf(mask: Uint8Array): Run[] {
  const out: Run[] = [];
  let i = 0;
  while (i < mask.length) {
    let j = i;
    while (j < mask.length && mask[j] === mask[i]) j++;
    out.push({ on: mask[i] === 1, start: i, len: j - i, complete: i > 0 && j < mask.length });
    i = j;
  }
  return out;
}

/** Stereo idents on channels 1 and 2. */
function stereo(runs: Run[][], present: boolean[]): Partial<IdentReport> {
  const gaps = (c: number, len: number) => runs[c].filter((r) => !r.on && r.complete && near(r.len, len));
  const bursts = (c: number, len: number) => runs[c].filter((r) => r.on && r.complete && near(r.len, len));
  const offDuring = (c: number, a: number, b: number) => runs[c].some((r) => !r.on && r.start < b && r.start + r.len > a && r.len >= 5);
  const swapped = (left: number): Finding[] => left === 0
    ? [{ level: 'ok', text: 'L/R richtig zugeordnet' }]
    : [{ level: 'bad', text: 'L/R vertauscht – die Kennung des linken Kanals liegt rechts' }];
  if (!present[0] || !present[1]) {
    // one channel only: the pattern still tells which channel it belongs to
    const c = present[0] ? 0 : 1;
    if (gaps(c, 25).length >= 1 || gaps(c, 30).length >= 1) return { kind: 'tone', findings: [{ level: 'info', text: 'Kennung nur auf einem Kanal – Zuordnung nicht prüfbar' }] };
    return { kind: 'tone', findings: [] };
  }
  for (const x of [0, 1]) {
    const y = 1 - x;
    // GLITS: one 250 ms gap on x, 500 and 1000 ms later a 250 ms gap on y
    const gx = gaps(x, 25), gy = gaps(y, 25);
    if (gx.some((g) => gy.some((a) => near(a.start - g.start, 50)) && gy.some((b) => near(b.start - g.start, 100)))) {
      return { kind: 'glits', findings: swapped(x) };
    }
  }
  for (const x of [0, 1]) {
    const y = 1 - x;
    // EBU R 49: 250 ms gaps every 3 s on x, y continuous meanwhile
    const gx = gaps(x, 25);
    for (let i = 0; i + 1 < gx.length; i++) {
      if (near(gx[i + 1].start - gx[i].start, 300, 6) && !offDuring(y, gx[i].start - 20, gx[i + 1].start + gx[i + 1].len + 20)) return { kind: 'ebu', findings: swapped(x) };
    }
    // BLITS section 2: 300 ms gaps 600 ms apart on L, R continuous
    const bx = gaps(x, 30);
    for (let i = 0; i + 2 < bx.length; i++) {
      if (near(bx[i + 1].start - bx[i].start, 60) && near(bx[i + 2].start - bx[i + 1].start, 60) && !offDuring(y, bx[i].start, bx[i + 2].start + 30)) return { kind: 'blits', findings: swapped(x) };
    }
    // LZ Kanal-Ident: one 400 ms tone on L, two on R (1.0 s and 1.6 s after the L tone)
    const tx = bursts(x, 40), ty = bursts(y, 40);
    if (tx.some((t) => ty.some((a) => near(a.start - t.start, 100)) && ty.some((b) => near(b.start - t.start, 160)))) return { kind: 'lz-lr', findings: swapped(x) };
  }
  return { kind: 'tone', findings: [] };
}

/** BLITS order L, R, C, LFE, Ls, Rs mapped onto the channel indices of the layout. */
function blitsOrder(info: ChannelInfo[]): number[] {
  const find = (...ids: string[]) => info.findIndex((c) => ids.includes(c.id));
  const hasSide = info.some((c) => c.id === 'SL');
  const order = [find('FL'), find('FR'), find('FC'), find('LFE'), hasSide ? find('SL') : find('BL'), hasSide ? find('SR') : find('BR')];
  return order.every((i) => i >= 0) ? order : [0, 1, 2, 3, 4, 5].filter((i) => i < info.length);
}

/** Compare the found burst order with the expected one; names swaps and missing channels. */
export function compareOrder(expected: number[], found: number[], info: ChannelInfo[], present: boolean[]): Finding[] {
  const name = (i: number) => info[i]?.name ?? String(i + 1);
  const out: Finding[] = [];
  const done = new Set<number>();
  for (let k = 0; k < found.length && k < expected.length; k++) {
    const e = expected[k], f = found[k];
    if (e === f || done.has(k) || f === -2) continue;
    if (f < 0) { out.push({ level: 'bad', text: `Kennung von ${name(e)} fehlt (${name(e)} stumm oder nicht belegt)` }); continue; }
    const j = expected.indexOf(f);
    if (j >= 0 && found[j] === e) {
      done.add(j);
      const [a, b] = [e, f].sort((x, y) => x - y).map(name);
      out.push({ level: 'bad', text: a === 'L' && b === 'R' ? 'L/R vertauscht' : `${a} und ${b} vertauscht` });
    } else out.push({ level: 'bad', text: `Kennung von ${name(e)} kommt auf ${name(f)}` });
  }
  if (!out.length && found.length >= expected.length) out.push({ level: 'ok', text: `Kanalfolge richtig (${expected.map(name).join(', ')})` });
  return out;
}

const fmt1 = (v: number) => v.toFixed(1).replace('.', ',').replace('-', '−');
const fmt2 = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2).replace('.', ',').replace('-', '−');
