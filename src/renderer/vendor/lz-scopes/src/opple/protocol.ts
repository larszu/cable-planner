// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Opple Light Master 3 / 4 – BLE framing and payload parsing (#11).
//
// Ported to TypeScript from natmart-in/sunday-light-meter `src/protocol.js` @ eb50efc
// (MIT, Copyright (c) 2026 Sunday Light, licenses/sunday-light-meter-LICENSE.txt). That
// project names its protocol sources: OlliV/open-light-master (LM3), gabrielebaudo/
// opple-bridge (LM4 layouts), Geomaniac15/tag-tester. Changed: types, Uint8Array
// buffer in the assembler, measurement returns null for an unknown length.
//
// Nordic UART service; commands are written to the notify characteristic …0003 (the meter
// accepts that, and it is what every working implementation does).

export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

export const OPCODE = {
  REQ_MEAS: 0x0a00, RES_MEAS: 0x0a01,
  /** per-unit sensor calibration kSensor */
  REQ_CAL: 0x0a04, RES_CAL: 0x0a05,
  /** flicker waveform (not used here) */
  REQ_FREQ: 0x0a0a, RES_FREQ: 0x0a0b,
} as const;

const FRAG_SINGLE = 0x00, FRAG_FIRST = 0x80, FRAG_MIDDLE = 0xa0, FRAG_LAST = 0xc0, FRAG_MASK = 0xe0;
export const HEADER_LEN = 11;

/** Inner message: 11-byte header [00 13 00 00 seq 00 len 00 00 opHi opLo] + body. */
export function buildCommand(opcode: number, seq: number, body = new Uint8Array(0)) {
  const out = new Uint8Array(HEADER_LEN + body.length);
  out.set([0x00, 0x13, 0x00, 0x00, seq & 0xff, 0x00, body.length & 0xff, 0x00, 0x00, (opcode >> 8) & 0xff, opcode & 0xff]);
  out.set(body, HEADER_LEN);
  return out;
}

/** Split into BLE write fragments: the first carries 17 bytes (after type + total length), the rest 19. */
export function encapsulate(data: Uint8Array): Uint8Array[] {
  const n = data.length < 17 ? 1 : Math.ceil((data.length - 17) / 19) + 1;
  const frames: Uint8Array[] = [];
  for (let c = 0; c < n; c++) {
    let head: number[], body: Uint8Array;
    if (c === 0) {
      const total = data.length + n + 2;
      head = [n > 1 ? FRAG_FIRST : FRAG_SINGLE, (total >> 8) & 0xff, total & 0xff];
      body = n > 1 ? data.subarray(0, 17) : data;
    } else if (c !== n - 1) {
      head = [FRAG_MIDDLE | c];
      body = data.subarray(17 + 19 * (c - 1), 17 + 19 * c);
    } else {
      head = [FRAG_LAST | c];
      body = data.subarray(17 + 19 * (c - 1));
    }
    const f = new Uint8Array(head.length + body.length);
    f.set(head); f.set(body, head.length);
    frames.push(f);
  }
  return frames;
}

/** Reassembles notification fragments; feed() returns a complete inner message or null. */
export class MessageAssembler {
  private buf: number[] | null = null;
  reset() { this.buf = null; }
  feed(frame: Uint8Array | null | undefined): Uint8Array | null {
    if (!frame?.length) return null;
    const type = frame[0] & FRAG_MASK;
    if (type === FRAG_SINGLE) { this.buf = null; return frame.slice(3); }
    if (type === FRAG_FIRST) { this.buf = Array.from(frame.subarray(3)); return null; }
    if (type === FRAG_MIDDLE) { this.buf?.push(...frame.subarray(1)); return null; }
    if (type === FRAG_LAST) {
      if (!this.buf) return null;
      this.buf.push(...frame.subarray(1));
      const msg = Uint8Array.from(this.buf);
      this.buf = null;
      return msg;
    }
    return null;
  }
}

export const opcodeOf = (msg: Uint8Array | null) => (!msg || msg.length < HEADER_LEN ? 0 : (msg[9] << 8) | msg[10]);

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];

export type Model = 'lm3' | 'lm4';
export interface Measurement { model: Model; raw: number[]; batteryRaw: number; temperature: number | null }
export interface Calibration { model: Model; kSensor: number[] }

/**
 * RES_MEAS payload, model from its length:
 *   LM3: [skip][6 × u16 BE: 450/500/550/570/600/650 nm][battery mV u16][temperature u8]
 *   LM4: [skip][9 × u16 BE: AS7341 F1…F8 + clear][temperature ×10 u16][battery raw u16]
 */
export function parseMeasurement(msg: Uint8Array | null): Measurement | null {
  if (!msg || msg.length < HEADER_LEN + 16) return null;
  const p = msg.subarray(HEADER_LEN);
  if (p.length >= 23) {
    const raw = Array.from({ length: 9 }, (_, i) => u16be(p, 1 + 2 * i));
    const t10 = u16be(p, 19);
    return { model: 'lm4', raw, batteryRaw: u16be(p, 21), temperature: t10 > 0 && t10 < 1200 ? t10 / 10 : null };
  }
  return { model: 'lm3', raw: Array.from({ length: 6 }, (_, i) => u16be(p, 1 + 2 * i)), batteryRaw: u16be(p, 13), temperature: p[15] };
}

/** RES_CAL payload: float32 little-endian from payload[1], 7 (LM3) or 9 (LM4) factors. */
export function parseCalibration(msg: Uint8Array | null): Calibration | null {
  if (!msg || msg.length < HEADER_LEN + 29) return null;
  const p = msg.subarray(HEADER_LEN);
  const count = p.length >= 37 ? 9 : 7;
  const view = new DataView(p.buffer, p.byteOffset, p.byteLength);
  const kSensor = Array.from({ length: count }, (_, i) => { const v = view.getFloat32(1 + 4 * i, true); return Number.isFinite(v) ? v : 1; });
  return { model: count === 9 ? 'lm4' : 'lm3', kSensor };
}

// ---------------------------------------------------------------- flicker (LM4)
//
// Layout and constants from gabrielebaudo/opple-bridge @ 5bba264 `opple_bridge/ble/parser.py`
// and `science/flicker.py` (MIT, Copyright (c) 2026 Gabriele Baudo, licenses/opple-bridge-
// LICENSE.txt; there transcribed from the decompiled OPPLE Smart app). Ported to TypeScript.
// Request body [0, period hi, period lo]; the answer is 4 messages (opcode 0x0A0B), payload
// [?, page 0…3, data_type, 22 bytes meta, packed 12-bit samples: 6 bytes → 4 samples];
// pages 0–2 carry 260 samples, page 3 carries 244 (1024 in total). Only the LM4 is known.

export const FLICKER_SAMPLES = 1024;
/** Sampling modes: period byte → time factor; fs = 1024² / factor (≈ 40.3 kHz, 7.0 kHz, 85.4 kHz). */
export const FLICKER_PERIODS = { 25: 26.0, 146: 150.0, 11: 12.285 } as const;
export type FlickerPeriod = keyof typeof FLICKER_PERIODS;
export const flickerSampleRate = (p: FlickerPeriod) => (FLICKER_SAMPLES * FLICKER_SAMPLES) / FLICKER_PERIODS[p];
export const flickerRequestBody = (p: FlickerPeriod) => Uint8Array.from([0, (p >> 8) & 0xff, p & 0xff]);

const WAVE_OFFSET = 25, FULL_GROUPS = 65, LAST_GROUPS = 61, LAST_PAGE = 3;

export interface FlickerChunk { page: number; dataType: number; samples: number[] }

export function parseFlickerChunk(msg: Uint8Array | null): FlickerChunk | null {
  if (!msg || msg.length < HEADER_LEN + WAVE_OFFSET) return null;
  const p = msg.subarray(HEADER_LEN), page = p[1], dataType = p[2];
  if (page > LAST_PAGE) return null;
  const groups = page === LAST_PAGE ? LAST_GROUPS : FULL_GROUPS, w = p.subarray(WAVE_OFFSET);
  if (w.length < groups * 6) return null;
  const samples: number[] = [];
  for (let i = 0; i < groups; i++) {
    const o = 6 * i, a = (w[o] << 8) | w[o + 1], b = (w[o + 2] << 8) | w[o + 3], c = (w[o + 4] << 8) | w[o + 5];
    samples.push(a >> 4, ((a & 0x0f) << 8) | (b >> 8), ((b & 0xff) << 4) | (c >> 12), c & 0xfff);
  }
  return { page, dataType, samples };
}

/** Pack samples into a chunk message (inverse of parseFlickerChunk; for tests and simulation). */
export function buildFlickerChunk(page: number, dataType: number, samples: number[], seq = 1) {
  const groups = page === LAST_PAGE ? LAST_GROUPS : FULL_GROUPS, body = new Uint8Array(WAVE_OFFSET + groups * 6);
  body[1] = page; body[2] = dataType;
  for (let i = 0; i < groups; i++) {
    const [s0, s1, s2, s3] = [0, 1, 2, 3].map((k) => (samples[i * 4 + k] ?? 0) & 0xfff);
    const a = (s0 << 4) | (s1 >> 8), b = ((s1 & 0xff) << 8) | (s2 >> 4), c = ((s2 & 0x0f) << 12) | s3, o = WAVE_OFFSET + 6 * i;
    body.set([a >> 8, a & 0xff, b >> 8, b & 0xff, c >> 8, c & 0xff], o);
  }
  const out = new Uint8Array(HEADER_LEN + body.length);
  out.set([0x00, 0x13, 0x00, 0x00, seq & 0xff, 0x00, body.length & 0xff, 0x00, 0x00, 0x0a, 0x0b]);
  out.set(body, HEADER_LEN);
  return out;
}

/** Collects the 4 pages into one 1024-sample waveform. */
export class FlickerAssembler {
  private buf = new Array<number>(FLICKER_SAMPLES).fill(0);
  private pages = new Set<number>();
  dataType = 2;
  feed(c: FlickerChunk): number[] | null {
    const start = c.page * FULL_GROUPS * 4;
    c.samples.forEach((s, i) => { if (start + i < FLICKER_SAMPLES) this.buf[start + i] = s; });
    this.pages.add(c.page); this.dataType = c.dataType;
    return this.pages.size === LAST_PAGE + 1 ? this.buf.slice() : null;
  }
}

/** ADC baseline per data_type (opple-bridge `science/flicker.py` `_DC_OFFSETS`). */
const DC_OFFSETS: Record<number, number> = { 0: 29.7412109375, 1: 15.8720703125 };
const DC_DEFAULT = 13.8447265625;

export interface FlickerResult {
  /** ENERGY STAR MoM (draft) Eq. 1: (max − min)/(max + min) · 100 % */
  percent: number;
  /** ENERGY STAR MoM (draft) Eq. 2: Σ max(Φi − Φ̄, 0) / Σ Φi */
  index: number;
  /** strongest spectral line without DC, Hz */
  frequency: number;
  sampleRate: number; period: FlickerPeriod; mean: number;
}

/**
 * Flicker figures of a waveform. The baseline is subtracted first (negative → 0, as opple-bridge);
 * percent flicker and flicker index after ENERGY STAR Method of Measurement for Light Source
 * Flicker (draft), section 8; frequency = DFT peak bin · fs / N (no window, as opple-bridge).
 * The meter samples far below the 5 MSa/s that method asks for: guide values only.
 */
export function flickerMetrics(wave: number[], dataType: number, period: FlickerPeriod): FlickerResult {
  const dc = DC_OFFSETS[dataType] ?? DC_DEFAULT;
  const s = wave.map((v) => (v > dc ? v - dc : 0)), n = s.length, fs = flickerSampleRate(period);
  const sum = s.reduce((a, b) => a + b, 0), mean = sum / n;
  const max = Math.max(...s), min = Math.min(...s);
  const percent = max + min > 0 ? ((max - min) / (max + min)) * 100 : 0;
  const index = sum > 0 ? s.reduce((a, v) => a + Math.max(0, v - mean), 0) / sum : 0;
  let best = 1, bestMag = -1;
  for (let k = 1; k < n / 2; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) { const a = (-2 * Math.PI * k * t) / n; re += s[t] * Math.cos(a); im += s[t] * Math.sin(a); }
    const m = re * re + im * im;
    if (m > bestMag) { bestMag = m; best = k; }
  }
  return { percent, index, frequency: (best * fs) / n, sampleRate: fs, period, mean };
}
