// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Touch Shading (#54): the pure part – which camera value a gesture on a scope selects, how far
// it moves, and the picture model of the simulator. No DOM, no network.
//
// Vocabulary: the paint values and commands of lz-camera-bridge (packages/bridge/src/protocol/
// paintNudge.ts, CcuClient.ts CameraState, BridgeServer.ts). One scale per value, 0..255 with
// the centre 128 for the bipolar ones – the same "bus" the web RCP, Companion and the nudge
// resolver use. LZ Scopes does not invent a second one. The only addition is `hue`, which the
// bus does not carry: it exists in the simulator and is refused for real cameras (see
// docs/research/touch-shading.md).

/** Paint values a gesture can move (field names of the bridge's CameraState). */
export type PaintField =
  | 'blackR' | 'blackG' | 'blackB' | 'masterBlack' | 'masterGamma'
  | 'whiteR' | 'whiteG' | 'whiteB' | 'saturation' | 'hue';

export type Paint = Partial<Record<PaintField, number>>;

export interface FieldDef { label: string; min: number; max: number; centre: number; unit: string }

/** Ranges: bus 0..255 (paintNudge.ts PAINT_PARAMETERS, CcuClient analog values); hue only simulated, in degrees. */
export const FIELDS: Record<PaintField, FieldDef> = {
  blackR: { label: 'Black R', min: 0, max: 255, centre: 128, unit: '' },
  blackG: { label: 'Black G', min: 0, max: 255, centre: 128, unit: '' },
  blackB: { label: 'Black B', min: 0, max: 255, centre: 128, unit: '' },
  masterBlack: { label: 'Master Black', min: 0, max: 255, centre: 128, unit: '' },
  masterGamma: { label: 'Master Gamma', min: 0, max: 255, centre: 128, unit: '' },
  whiteR: { label: 'White R', min: 0, max: 255, centre: 128, unit: '' },
  whiteG: { label: 'White G', min: 0, max: 255, centre: 128, unit: '' },
  whiteB: { label: 'White B', min: 0, max: 255, centre: 128, unit: '' },
  saturation: { label: 'Saturation', min: 0, max: 255, centre: 128, unit: '' },
  hue: { label: 'Hue', min: -180, max: 180, centre: 0, unit: '°' },
};

export const NEUTRAL_PAINT: Required<Paint> = {
  blackR: 128, blackG: 128, blackB: 128, masterBlack: 128, masterGamma: 128,
  whiteR: 128, whiteG: 128, whiteB: 128, saturation: 128, hue: 0,
};

/**
 * Safety rails: at most `step` bus units per pointer event, at most `span` away from the value
 * the session started with. A wild swipe can therefore never throw a camera across its range.
 */
export const LIMITS = { step: 4, span: 48, hueStep: 3, hueSpan: 45 } as const;

export type Channel = 'r' | 'g' | 'b';
export type Zone = 'black' | 'gamma' | 'white';

/**
 * Zone of a signal level. The borders are the shadows/mids/highlights ranges the neutral overlay
 * already uses (panel.ts NEUTRAL_RANGES: 0.3 / 0.7).
 */
export function zoneOf(level: number): Zone {
  return level < 0.3 ? 'black' : level > 0.7 ? 'white' : 'gamma';
}

export type GestureTarget =
  | { kind: 'fields'; fields: PaintField[]; zone: Zone; channel: Channel | 'y'; level: number }
  | { kind: 'refused'; reason: string };

/**
 * Which value a drag on a waveform selects.
 * - Parade (channel r/g/b): shadows → Black R/G/B, highlights → White R/G/B. The bus has no gamma
 *   per channel (paintNudge.ts: only masterGamma), so the mid zone is split at 0.5 between the two
 *   – what an RCP offers per channel is black and white balance.
 * - Luma waveform (channel y): shadows → Master Black, mids → Master Gamma, highlights → White
 *   R, G and B together (the bus has no master white gain other than the dB index).
 */
export function waveTarget(channel: Channel | 'y', level: number): GestureTarget {
  const zone = zoneOf(level);
  if (channel === 'y') {
    if (zone === 'black') return { kind: 'fields', fields: ['masterBlack'], zone, channel, level };
    if (zone === 'gamma') return { kind: 'fields', fields: ['masterGamma'], zone, channel, level };
    return { kind: 'fields', fields: ['whiteR', 'whiteG', 'whiteB'], zone, channel, level };
  }
  const up = channel.toUpperCase() as 'R' | 'G' | 'B';
  const black = level < 0.5;
  return { kind: 'fields', fields: [`${black ? 'black' : 'white'}${up}` as PaintField], zone: black ? 'black' : 'white', channel, level };
}

// ------------------------------------------------------------------ picture model (simulator)

/**
 * Model scales of the simulator, chosen, not measured: a full bus swing (±128) moves lift by
 * ±0.2, gain by ±50 % and the gamma exponent by a factor of 2. Real cameras scale differently and
 * are not modelled here – that is why the scopes show the measured trace, not a prediction.
 */
export const SIM = { lift: 0.2, gain: 0.5, gamma: 1 } as const;

const bip = (v: number | undefined) => ((v ?? 128) - 128) / 128;

export interface ChannelPaint { lift: number; gain: number; exp: number }

export function channelPaint(p: Paint, c: Channel): ChannelPaint {
  const up = c.toUpperCase();
  const lift = SIM.lift * (bip(p[`black${up}` as PaintField]) + bip(p.masterBlack));
  const gain = 1 + SIM.gain * bip(p[`white${up}` as PaintField]);
  const exp = Math.pow(2, -SIM.gamma * bip(p.masterGamma));
  return { lift, gain, exp };
}

/** One channel: gain pivots at black, lift at white (as in the lift/gamma/gain of colour correctors), then gamma. */
export function applyChannel(v: number, cp: ChannelPaint): number {
  const x = cp.gain * v + cp.lift * (1 - v);
  return x <= 0 ? x : Math.pow(x, cp.exp);
}

/** BT.709 luma weights (ITU-R BT.709-6, item 3.2). */
const KR = 0.2126, KB = 0.0722, KG = 1 - KR - KB;

/** Full paint on one R′G′B′ triple (0..1): per-channel lift/gain/gamma, then hue rotation and saturation on Cb/Cr. */
export function applyPaint(rgb: [number, number, number], p: Paint): [number, number, number] {
  let r = applyChannel(rgb[0], channelPaint(p, 'r'));
  let g = applyChannel(rgb[1], channelPaint(p, 'g'));
  let b = applyChannel(rgb[2], channelPaint(p, 'b'));
  const sat = (p.saturation ?? 128) / 128, hue = ((p.hue ?? 0) * Math.PI) / 180;
  if (sat !== 1 || hue !== 0) {
    const y = KR * r + KG * g + KB * b;
    const cb = (b - y) / (2 * (1 - KB)), cr = (r - y) / (2 * (1 - KR));
    const c = Math.cos(hue) * sat, s = Math.sin(hue) * sat;
    const cb2 = cb * c - cr * s, cr2 = cb * s + cr * c;
    r = y + 2 * (1 - KR) * cr2;
    b = y + 2 * (1 - KB) * cb2;
    g = (y - KR * r - KB * b) / KG;
  }
  return [r, g, b];
}

/** Paint an 8-bit RGBA frame (full-range codes) into `out`. */
export function paintFrame(src: Uint8Array | Uint8ClampedArray, out: Uint8Array, p: Paint) {
  // per-channel tone curves as 256-entry tables, the colour part per pixel only when needed
  const lut = (['r', 'g', 'b'] as Channel[]).map((c) => {
    const cp = channelPaint(p, c), t = new Float32Array(256);
    for (let i = 0; i < 256; i++) t[i] = applyChannel(i / 255, cp);
    return t;
  });
  const sat = (p.saturation ?? 128) / 128, hue = ((p.hue ?? 0) * Math.PI) / 180;
  const colour = sat !== 1 || hue !== 0;
  const c = Math.cos(hue) * sat, s = Math.sin(hue) * sat;
  const q = (v: number) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));
  for (let i = 0; i < src.length; i += 4) {
    let r = lut[0][src[i]], g = lut[1][src[i + 1]], b = lut[2][src[i + 2]];
    if (colour) {
      const y = KR * r + KG * g + KB * b;
      const cb = (b - y) / (2 * (1 - KB)), cr = (r - y) / (2 * (1 - KR));
      const cb2 = cb * c - cr * s, cr2 = cb * s + cr * c;
      r = y + 2 * (1 - KR) * cr2; b = y + 2 * (1 - KB) * cb2; g = (y - KR * r - KB * b) / KG;
    }
    out[i] = q(r); out[i + 1] = q(g); out[i + 2] = q(b); out[i + 3] = 255;
  }
}

// ------------------------------------------------------------------ gesture → value

/**
 * Signal change per bus unit of `field` at `level` (grey input), from the model. Used to turn a
 * drag of the trace into a value change: the trace should follow the finger.
 */
export function slope(field: PaintField, ch: Channel, level: number, p: Paint): number {
  // invert the tone curve at the current paint: which input lies under the touched output level
  const inv = invertChannel(level, channelPaint(p, ch));
  const at = (q: Paint) => applyChannel(inv, channelPaint(q, ch));
  const v = p[field] ?? FIELDS[field].centre;
  return at({ ...p, [field]: v + 1 }) - at(p);
}

/** Input level that the channel curve maps to `out` (bisection, monotonic curves). */
export function invertChannel(out: number, cp: ChannelPaint): number {
  let lo = -0.5, hi = 1.5;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (applyChannel(m, cp) < out) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

/**
 * Bus change for a vertical drag of `dLevel` (signal units) on a trace at `level`. Clamped to the
 * per-event step; at least ±1 when the pointer moved far enough for one unit, so slow drags work.
 */
export function busDeltaFor(field: PaintField, ch: Channel, level: number, dLevel: number, p: Paint): number {
  const k = slope(field, ch, level, p);
  if (!Number.isFinite(k) || Math.abs(k) < 1e-5) return 0;
  const raw = dLevel / k;
  const lim = field === 'hue' ? LIMITS.hueStep : LIMITS.step;
  return Math.max(-lim, Math.min(lim, Math.trunc(raw)));
}

/** New value: within the field's range and within `span` of the session's start value. */
export function clampValue(field: PaintField, start: number, next: number): number {
  const f = FIELDS[field], span = field === 'hue' ? LIMITS.hueSpan : LIMITS.span;
  return Math.max(f.min, Math.max(start - span, Math.min(f.max, Math.min(start + span, Math.round(next)))));
}

/**
 * Vectorscope gesture: pointer positions relative to the scope centre (any unit, y up).
 * Turning around the centre → hue in degrees (counter-clockwise positive, the direction of
 * increasing hue angle on the vectorscope); distance ratio → saturation factor.
 */
export function vectorGesture(from: [number, number], to: [number, number]) {
  const a0 = Math.atan2(from[1], from[0]), a1 = Math.atan2(to[1], to[0]);
  let d = ((a1 - a0) * 180) / Math.PI;
  if (d > 180) d -= 360; if (d < -180) d += 360;
  const r0 = Math.hypot(...from), r1 = Math.hypot(...to);
  return { dHue: d, satFactor: r0 > 1e-6 ? r1 / r0 : 1 };
}

/**
 * Which gesture on the vectorscope: mostly around the centre = hue, mostly along the radius =
 * saturation. Decided once per gesture after a few pixels, so a turn does not also scale.
 */
export function vectorMode(from: [number, number], to: [number, number]): 'hue' | 'saturation' | null {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  if (Math.hypot(dx, dy) < 6) return null;
  const r = Math.hypot(...from) || 1;
  const radial = Math.abs((dx * from[0] + dy * from[1]) / r);
  const tangential = Math.abs((dy * from[0] - dx * from[1]) / r);
  return tangential > radial ? 'hue' : 'saturation';
}

// ------------------------------------------------------------------ bus commands

export interface BusCommand { cmd: string; params: Record<string, number> }

/**
 * Commands of lz-camera-bridge for a set of changed fields (BridgeServer.ts message `command`):
 * black/white balance travel as RGB triples (CcuClient.setBlackBalance/setWhiteBalance), so a
 * change of one axis sends the other two with their current values – which therefore must be
 * known. Returns an error for anything the bus does not carry.
 */
/** `error`: 'black' / 'white' = triple not fully known, 'hue' = not on the bus. */
export function busCommands(changed: PaintField[], cur: Paint, mode = ''): { commands: BusCommand[]; error?: 'black' | 'white' | 'hue' } {
  const out: BusCommand[] = [];
  const set = new Set(changed);
  const triple = (k: 'black' | 'white', cmd: string) => {
    if (![...set].some((f) => f.startsWith(k))) return null;
    // axes the camera does not have (Sony: no G gain) are not sent – and need not be known
    const axes = (['R', 'G', 'B'] as const).filter((a) => !MISSING_AXES[mode]?.includes(`${k}${a}` as PaintField));
    const params: Record<string, number> = {};
    for (const a of axes) {
      const v = cur[`${k}${a}` as PaintField];
      if (v === undefined) return k;
      params[a.toLowerCase()] = v;
    }
    out.push({ cmd, params });
    return null;
  };
  const e1 = triple('black', 'setBlackBalance');
  const e2 = triple('white', 'setWhiteBalance');
  if (e1 || e2) return { commands: [], error: (e1 ?? e2)! };
  if (set.has('masterBlack')) out.push({ cmd: 'setMasterBlack', params: { value: cur.masterBlack! } });
  if (set.has('masterGamma')) out.push({ cmd: 'setMasterGamma', params: { value: cur.masterGamma! } });
  if (set.has('saturation')) out.push({ cmd: 'setSaturation', params: { value: cur.saturation! } });
  if (set.has('hue')) return { commands: [], error: 'hue' };
  return { commands: out };
}

/** Bridge capability flag (web-rcp/src/types.ts CameraCapabilities) that a field needs. */
export const FIELD_CAP: Record<PaintField, string | null> = {
  blackR: 'blackBalance', blackG: 'blackBalance', blackB: 'blackBalance',
  whiteR: 'whiteBalance', whiteG: 'whiteBalance', whiteB: 'whiteBalance',
  masterBlack: 'masterBlack', masterGamma: 'masterGamma', saturation: 'saturation', hue: null,
};

/**
 * Paint capabilities per bridge connection mode – the paint subset of
 * lz-camera-bridge packages/web-rcp/src/capabilities.ts MODE_CAPS (state of main, 06.10.2026).
 * Only these five flags are needed here; when the bridge gains a command, its table changes first.
 */
export const BRIDGE_PAINT_CAPS: Record<string, string[]> = {
  demo: ['masterBlack', 'blackBalance', 'whiteBalance', 'masterGamma', 'saturation'],
  tcp: ['masterBlack', 'blackBalance', 'whiteBalance', 'masterGamma', 'saturation'],
  serial: ['masterBlack', 'blackBalance', 'whiteBalance', 'masterGamma', 'saturation'],
  'lumix-http': ['masterBlack', 'whiteBalance', 'saturation'],
  blackmagic: ['masterBlack', 'blackBalance', 'whiteBalance', 'masterGamma', 'saturation'],
  // HTTP-CGI with the Sony family (capabilitiesForMode(mode, family), lz-camera-bridge #77):
  // manual white balance over imaging.cgi, R and B gain only – measured on an SRG-A40.
  'http-cgi:sony': ['whiteBalance'],
};

/**
 * How much steeper a real camera reacts than the simulator model, per field (factor on `slope`).
 * Sony SRG-A40 over imaging.cgi, measured 07.10.2026 on the RTSP picture (mean of the frame):
 * CrGain +30 → R′ 0.52 → 0.90, CbGain +30 → B′ 0.51 → 0.75. Per unit and relative to the level
 * that is 0.024 (R) and 0.016 (B) against 0.0039 in the model: factors 6.2 and 4.0. Rough – a
 * mean over a real scene with clipping – but it keeps the trace near the finger instead of 5×
 * past it.
 */
export const MEASURED_SLOPE: Record<string, Partial<Record<PaintField, number>>> = {
  'http-cgi:sony': { whiteR: 6.2, whiteB: 4.0 },
};
export const slopeScale = (mode: string, field: PaintField) => MEASURED_SLOPE[mode]?.[field] ?? 1;

/** Axes a mode does not have although its balance flag is set. */
export const MISSING_AXES: Record<string, PaintField[]> = {
  'http-cgi:sony': ['whiteG'],
};

/** Key into the tables above: the bridge mode, plus the firmware family where it matters. */
export const capsKey = (mode: string, family?: string) => (mode === 'http-cgi' && family ? `${mode}:${family}` : mode);

/** Can this field be sent to a camera in this bridge mode? Simulator: everything. */
export function fieldAvailable(field: PaintField, mode: string | 'sim'): boolean {
  if (mode === 'sim') return true;
  const cap = FIELD_CAP[field];
  return !!cap && (BRIDGE_PAINT_CAPS[mode] ?? []).includes(cap) && !MISSING_AXES[mode]?.includes(field);
}

/** Value and its distance to `ref` (the session's starting value; default the centre of the scale). */
export function formatValue(field: PaintField, v: number | undefined, ref?: number): string {
  if (v === undefined) return '–';
  const f = FIELDS[field];
  const d = v - (ref ?? f.centre);
  return `${Math.round(v)}${f.unit} (${d >= 0 ? '+' : ''}${Math.round(d)})`;
}
