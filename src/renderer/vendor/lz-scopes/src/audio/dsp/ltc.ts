// Linear Time Code (LTC) reader and writer, own implementation (no libltc).
//
// Code word after EBU Tech 3097-E (3rd ed. 1982, Part A, tech.ebu.ch, free), which matches
// SMPTE ST 12-1 for these points:
// - §2.1 bi-phase mark: a transition at the beginning of every clock period; a "one" has a
//   second transition in the middle of the period, a "zero" has none.
// - §2.2 80 bits per picture; §3.3 bit assignment: 0–3 picture units, 8–9 picture tens,
//   16–19 / 24–26 seconds, 32–35 / 40–42 minutes, 48–51 / 56–57 hours, binary groups at
//   4–7, 12–15, 20–23, 28–31, 36–39, 44–47, 52–55, 60–63, synchronising word 64–79 =
//   0 0 1×12 0 1 (read backwards it is 1 0 1×12 0 0 → direction).
// - §4.5 phase-correction bit 59 at 25 fps: every word contains an even number of zeros.
// SMPTE (30/24 fps) differences, from the Wikipedia article "Linear timecode" (citing
// ITU-R BR.780-2): bit 10 = drop-frame flag, bit 11 = colour frame flag, the polarity
// correction bit is bit 27 at rates other than 25 fps.
//
// The reader measures the intervals between zero crossings (DC-blocked, with hysteresis),
// tracks the bit period adaptively and classifies long (= "0") and short-short (= "1").

export interface LtcFrame {
  hh: number; mm: number; ss: number; ff: number;
  df: boolean; colorFrame: boolean;
  /** 8 binary groups (user bits), group 1 first */
  userBits: number[];
  /** read backwards (tape/timeline running in reverse) */
  reverse: boolean;
  /** sample index (fractional, since the reader started) of the start of bit 0 – the ST 12 timing reference */
  start: number;
  /** estimated code words per second from the measured bit period */
  fps: number;
}

const SYNC_FWD = [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1];
const SYNC_REV = [...SYNC_FWD].reverse();

function bcd(bits: number[], at: number, n: number) {
  let v = 0;
  for (let i = 0; i < n; i++) v |= bits[at + i] << i;
  return v;
}

/** Decode the 64 data bits (bit 0 first). Returns null for impossible BCD values. */
export function decodeLtcWord(bits: number[]): Omit<LtcFrame, 'reverse' | 'start' | 'fps'> | null {
  const fu = bcd(bits, 0, 4), ft = bcd(bits, 8, 2), su = bcd(bits, 16, 4), st = bcd(bits, 24, 3);
  const mu = bcd(bits, 32, 4), mt = bcd(bits, 40, 3), hu = bcd(bits, 48, 4), ht = bcd(bits, 56, 2);
  if (fu > 9 || su > 9 || mu > 9 || hu > 9 || st > 5 || mt > 5) return null;
  const hh = ht * 10 + hu, mm = mt * 10 + mu, ss = st * 10 + su, ff = ft * 10 + fu;
  if (hh > 23 || ff > 59) return null;
  const userBits = [4, 12, 20, 28, 36, 44, 52, 60].map((b) => bcd(bits, b, 4));
  return { hh, mm, ss, ff, df: bits[10] === 1, colorFrame: bits[11] === 1, userBits };
}

/** 80 bits of a code word (bit 0 first). `nominal` selects the polarity-correction bit (59 at 25, else 27). */
export function encodeLtcWord(t: { hh: number; mm: number; ss: number; ff: number; df?: boolean; userBits?: number[] }, nominal: number): number[] {
  const bits = new Array<number>(80).fill(0);
  const put = (at: number, n: number, v: number) => { for (let i = 0; i < n; i++) bits[at + i] = (v >> i) & 1; };
  put(0, 4, t.ff % 10); put(8, 2, Math.floor(t.ff / 10));
  put(16, 4, t.ss % 10); put(24, 3, Math.floor(t.ss / 10));
  put(32, 4, t.mm % 10); put(40, 3, Math.floor(t.mm / 10));
  put(48, 4, t.hh % 10); put(56, 2, Math.floor(t.hh / 10));
  if (t.df) bits[10] = 1;
  (t.userBits ?? []).forEach((g, i) => put([4, 12, 20, 28, 36, 44, 52, 60][i], 4, g));
  SYNC_FWD.forEach((b, i) => (bits[64 + i] = b));
  const parity = nominal === 25 ? 59 : 27;
  bits[parity] = 0;
  const zeros = bits.filter((b) => b === 0).length;
  if (zeros % 2) bits[parity] = 1; // even number of zeros in the whole word (EBU Tech 3097 §4.5)
  return bits;
}

/**
 * Bi-phase mark signal for consecutive code words. `words` are 80-bit arrays; the level starts
 * low and toggles at every cell start and in the middle of every "1" cell.
 */
export function biphaseMark(words: number[][], samplesPerBit: number, amplitude = 0.5, startLevel = -1): Float32Array {
  const bits = words.flat();
  const out = new Float32Array(Math.ceil(bits.length * samplesPerBit));
  let level = startLevel;
  for (let i = 0; i < bits.length; i++) {
    const a = i * samplesPerBit, mid = a + samplesPerBit / 2, b = a + samplesPerBit;
    level = -level; // transition at the start of every cell
    for (let s = Math.ceil(a); s < Math.min(out.length, Math.ceil(b)); s++) out[s] = (bits[i] && s >= mid ? -level : level) * amplitude;
    if (bits[i]) level = -level; // second transition in the middle of a "1"
  }
  return out;
}

export class LtcReader {
  readonly fs: number;
  /** last decoded frames (newest last), at most 8 */
  frames: LtcFrame[] = [];
  /** decoded words since start, and words rejected (bad BCD) */
  count = 0; errors = 0;
  private dc = 0;
  private dcA: number;
  private state = 0; // current logic level (−1/+1), 0 = unknown
  private pos = 0; // samples processed
  private prevX = 0;
  private lastEdge = -1; // fractional sample index of the last transition
  private period = 0; // bit period in samples (adaptive)
  private boot: number[] = [];
  private halfPending = false;
  private halfStart = 0;
  private bits: number[] = [];
  private starts: number[] = [];
  private peak = 0;

  constructor(fs: number) {
    this.fs = fs;
    this.dcA = Math.exp(-2 * Math.PI * 5 / fs); // DC blocker ~5 Hz
  }

  /** The most recent frame, if it is younger than `maxAgeSamples`. */
  latest(maxAgeSamples = this.fs / 5): LtcFrame | null {
    const f = this.frames[this.frames.length - 1];
    return f && this.pos - f.start < maxAgeSamples + this.fs / 10 ? f : null;
  }
  /** samples consumed so far */
  get position() { return this.pos; }

  process(x: Float32Array, n = x.length) {
    for (let i = 0; i < n; i++) {
      const v0 = x[i];
      this.dc = this.dcA * this.dc + (1 - this.dcA) * v0;
      const v = v0 - this.dc;
      const a = Math.abs(v);
      this.peak = Math.max(a, this.peak * 0.9995);
      const th = Math.max(0.002, this.peak * 0.25);
      let next = this.state;
      if (v > th) next = 1; else if (v < -th) next = -1;
      if (next !== this.state && this.state !== 0) {
        // interpolate the zero crossing between the previous and this sample
        const p = this.prevX, frac = p !== v ? Math.min(1, Math.max(0, p / (p - v))) : 0.5;
        this.edge(this.pos + i - 1 + frac);
      }
      if (next !== 0) this.state = next;
      this.prevX = v;
    }
    this.pos += n;
  }

  private edge(t: number) {
    if (this.lastEdge < 0) { this.lastEdge = t; return; }
    const d = t - this.lastEdge;
    const prevEdge = this.lastEdge;
    this.lastEdge = t;
    // bit period for 24–30 fps at fs: fs / (80 × fps); accept 20–35 fps (shuttle excluded)
    const minP = this.fs / (80 * 36), maxP = this.fs / (80 * 18);
    if (!this.period) {
      this.boot.push(d);
      if (this.boot.length >= 64) {
        const longs = this.boot.filter((v) => v <= maxP * 1.1).sort((p, q) => p - q);
        const p = longs[Math.floor(longs.length * 0.9)] ?? 0;
        this.boot = [];
        if (p >= minP * 0.9 && p <= maxP * 1.1) this.period = p;
      }
      return;
    }
    const P = this.period;
    if (d > P * 1.6 || d < P * 0.3) { this.resync(); return; }
    if (d > P * 0.75) {
      // long: a "0" (a pending half means we lost the pairing)
      if (this.halfPending) { this.halfPending = false; this.bits = []; this.starts = []; }
      this.period = 0.95 * P + 0.05 * d;
      this.push(0, prevEdge);
    } else if (this.halfPending) {
      this.halfPending = false;
      this.period = 0.95 * P + 0.05 * (t - this.halfStart);
      this.push(1, this.halfStart);
    } else {
      this.halfPending = true;
      this.halfStart = prevEdge;
    }
  }

  private resync() { this.period = 0; this.boot = []; this.halfPending = false; this.bits = []; this.starts = []; }

  private push(bit: number, at: number) {
    this.bits.push(bit); this.starts.push(at);
    if (this.bits.length > 160) { this.bits.splice(0, this.bits.length - 80); this.starts.splice(0, this.starts.length - 80); }
    const L = this.bits.length;
    if (L < 80) return;
    const tail = this.bits.slice(L - 16);
    const fwd = tail.every((b, i) => b === SYNC_FWD[i]);
    // reverse: the sync word arrives first, reversed, and the data follows → check the head
    const head = this.bits.slice(L - 80, L - 64);
    const rev = !fwd && head.every((b, i) => b === SYNC_REV[i]);
    if (!fwd && !rev) return;
    const word = this.bits.slice(L - 80);
    // forward: bits 0…63 then the sync word; reverse: sync word (reversed) then bits 63…0
    const d = decodeLtcWord(fwd ? word : word.slice(16).reverse());
    const start = fwd ? this.starts[L - 80] : this.starts[L - 1];
    this.bits = []; this.starts = [];
    if (!d) { this.errors++; return; }
    this.count++;
    this.frames.push({ ...d, reverse: rev, start, fps: this.fs / (80 * this.period) });
    if (this.frames.length > 8) this.frames.shift();
  }
}
