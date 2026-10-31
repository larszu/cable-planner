// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
import { GAMUTS, LUMA, detectColorspace, detectTransfer, gamutConvert, isLog, pqDecode, rgbToXyzMatrix, signalToLinear, transferSignalled, type Colorspace, type GamutId, type Transfer } from './color';
import { gamutShare, type GamutShare } from './gamutShare';
import type { VancPacket } from './vanc';
import { LOG_CURVES } from './camera';
import type { ChainSettings, Compiled } from './chain';
import { patternById, renderPattern } from './patterns';
import { AudioAnalysis } from './audio/analysis';
import { AudioTap, StreamMonitor, generator, measurementConstraints } from './audio/io';
import { GRID_W, History, gridFromData, summarise } from './history';
import { lineExtremes, neutralCast, type LineExtremes, type NeutralCast } from './minmax';
import { r103Check, rgbDecoder, yuvDecoder, type Decode, type R103Result, type YuvCoding } from './ycbcr';
import { debugFlags, openFrameSocket, workerAvailable, type FrameSocket } from './frameLink';
import { GpuStats } from './gpuStats';
import { LatencyMeter, type RtpStats } from './latency';
import { effectiveWidth, mergeLowLatency, type LowLatencyConfig } from './lowLatency';
import { meanLuma } from './luma';
import { t } from './i18n';
import { bridgeMessage } from './i18n/bridgeMessage';
import { streamRoute } from './streamRoute';
import { FrameHistory, pickFrame } from './record/sync';

export { meanLuma };

export type SourceKind = 'stream' | 'webcam' | 'screen' | 'file' | 'pattern' | 'folder' | 'audio';

/**
 * Input of an audio-only source: an audio device in the browser (getUserMedia, at most
 * 2 channels in Chromium), a file, the generator loop-back, or an audio device read by the
 * bridge's ffmpeg (`bridge`: all channels of the device, e.g. Dante Virtual Soundcard).
 */
export interface AudioInput { mode: 'device' | 'file' | 'generator' | 'bridge'; deviceId: string; bridgeUrl?: string }

export interface AudioStreamInfo { sampleRate: number; channels: number; format: string; layout?: string; codec?: string }

export interface SourceSettings {
  transfer: 'auto' | Transfer;
  colorspace: 'auto' | Colorspace;
  /** Primaries of the linear light: 'auto' = native gamut of a log curve, else the colorspace's primaries. */
  gamut?: 'auto' | GamutId;
  /** Peak luminance of the assumed HLG display (BT.2100 system gamma, R 167 presets). */
  hlgLw?: number;
  /** processing chain: CST and LUTs (chain.ts) */
  chain?: ChainSettings;
  /** Analysis width in px for bridge streams (0 = native). */
  width: number;
  fps: number;
  depth: 8 | 16;
  /** bridge streams: unclipped 16-bit Y′CbCr instead of R′G′B′ (docs/frame-protocol.md, format "yuv") */
  yuv?: boolean;
  transport: 'tcp' | 'udp';
  /** bridge streams: request the sound as well (protocol 2) */
  audio?: boolean;
  /** QC metrics of the bridge (TOUT, VREP, broadcast range; #202) – costs CPU in the bridge */
  signalStats?: boolean;
  /** bridge capture devices (device:…): explicit mode and raw pixel format, e.g. 1920x1080 / 50 / yuv422p10le */
  device?: { size?: string; rate?: string; pixfmt?: string };
  /** bridge: Y′CbCr → R′G′B′ matrix and range of the ffmpeg conversion ('auto' = tags, else BT.709 above SD) */
  decodeMatrix?: 'auto' | 'bt709' | 'bt601' | 'bt2020';
  decodeRange?: 'auto' | 'tv' | 'pc';
  /** DeckLink helper: 10 bit (v210) or 8 bit (UYVY) capture */
  deckLinkBits?: 8 | 10;
  /** bridge streams: 'h264' = compressed 8-bit transport for remote bridges, decoded in the browser (#16) */
  codec?: 'raw' | 'h264';
  /** low-latency mode (docs/research/low-latency.md): undefined = follow the global switch */
  lowLatency?: boolean;
  /** this source's own low-latency settings; missing fields follow the global ones */
  ll?: Partial<LowLatencyConfig>;
  /** bridge: keep a ring buffer for "save the last … s" (src/record/record.ts) */
  ring?: boolean;
  /** file sources (#188): 'bridge' = ffmpeg decodes (up to 16 bit), 'video' = the browser's <video> (8 bit, with transport) */
  fileRoute?: 'bridge' | 'video';
}

export interface StreamInfo {
  /** bridge: own RTP reception in use, or why not (low-latency mode) */
  rtp?: { own: boolean; transport?: string; codec?: string; note?: string };
  width: number; height: number; sourceWidth: number; sourceHeight: number; depth: 8 | 16; fps: number;
  codec?: string; pixFmt?: string; decodeMatrix?: string; transfer?: string; primaries?: string; matrix?: string; range?: string;
  /** protocol 2 (audio=1): header on every binary message */
  proto?: number;
  audio?: AudioStreamInfo | null;
  /** 'yuv': samples are A, Y′, Cb, Cr (16 bit, left-justified codes, no range conversion) */
  format?: 'rgb' | 'yuv';
  /** format 'yuv': quantisation range and bit depth of the source codes */
  yuvRange?: 'limited' | 'full'; bits?: number;
  /** the source is interlaced: each frame carries both fields woven, scaled field by field */
  interlaced?: boolean;
  /** why the bridge sent something other than requested */
  note?: string;
  /** start time code of the container (ffprobe tag, e.g. MOV tmcd) and the stream's start time in s */
  timecode?: string; startTime?: number;
  /** "30000/1001" (ffprobe r_frame_rate) and the source frame rate before any fps limit */
  frameRate?: string; sourceFps?: number;
  /** 'h264' = compressed transport (8 bit, lossy), decoded by the browser */
  transport?: string;
}

/**
 * Latest time code message of the bridge (docs/frame-protocol.md): `tc` is the last time code
 * found in the frame side data (GOP / SEI) at `tcPts`, `pts` the newest decoded frame; Resolve
 * sends its timeline time code with `fps`/`df`.
 */
export interface SourceTc { tc: string | null; tcPts?: number | null; pts?: number | null; first?: number | null; kind: 'gop' | 's12m' | 'resolve' | null; fps?: number | null; df?: boolean; at: number }

export interface Stats {
  hist: Float32Array[]; // R, G, B, Y — 256 bins each
  yMin: number; yMax: number; yAvg: number;
  /** mean R'G'B' (signal) of the analysed area */
  rgbAvg: [number, number, number];
  clipLow: number[]; clipHigh: number[]; // fraction per R, G, B
  samples: number;
  /**
   * PQ only: content light level of this frame (HDR10 static metadata, definition as in alwan docs/api/hdr.md) – per pixel max(R, G, B)
   * in cd/m²; max = brightest pixel, avg = frame average (on the analysed samples).
   */
  cll?: { max: number; avg: number };
}

/** MaxCLL / MaxFALL (CTA-861.3) over the frames seen since the last reset. */
export interface LightLevel { maxCll: number; maxFall: number; frames: number }

/** Extra query parameters of the bridge for capture devices, DeckLink and the decode matrix. */
export function bridgeInputParams(url: string, set: SourceSettings): Record<string, string> {
  const q: Record<string, string> = {};
  if (url.startsWith('device:')) {
    if (set.device?.size) q.size = set.device.size;
    if (set.device?.rate) q.rate = set.device.rate;
    if (set.device?.pixfmt) q.pixfmt = set.device.pixfmt;
  }
  if (url.startsWith('decklink:') && set.deckLinkBits === 8) q.pixel = '8';
  if (set.decodeMatrix && set.decodeMatrix !== 'auto') q.matrix = set.decodeMatrix;
  if (set.decodeRange && set.decodeRange !== 'auto') q.range = set.decodeRange;
  return q;
}

/**
 * DaVinci Resolve source (#88): 'still' = exact still through the scripting API (paused),
 * 'window' = live capture of the Resolve viewer (playing), 'none' = playing without a live
 * picture (`why` says why).
 */
/**
 * Transport state of a clip the bridge decodes (#191, server/clip.mjs): `pos` is the playhead
 * at wall time `at`, so the page can run it on itself between two messages.
 */
/** One frame's QC metrics from ffmpeg signalstats (#202); shares 0…1, levels as 8-bit codes. */
export interface SignalStats {
  frame: number; at: number;
  yMin?: number; yLow?: number; yAvg?: number; yHigh?: number; yMax?: number;
  uAvg?: number; vAvg?: number; satAvg?: number; satMax?: number; hueMed?: number;
  /** temporal outliers, vertical line repetition, share outside the broadcast range */
  tout?: number; vrep?: number; brng?: number; yDif?: number;
}

export interface ClipState { state: 'playing' | 'paused'; pos: number; duration: number; fps: number; rate: number; loop: boolean; at: number }

export interface ResolveRoute { route: 'still' | 'window' | 'none'; why?: 'remote' | 'browser' | 'noWindow' | 'noViewer' | 'denied' | 'starting'; playing: boolean }

/** Element sources (camera, capture, files): CPU readbacks per second at most (cpuFrame; debug switch cpuFrameHz). */
export const CPU_FRAME_HZ = 15;
export const DEFAULT_SETTINGS: SourceSettings = { transfer: 'auto', colorspace: 'auto', gamut: 'auto', hlgLw: 1000, width: 960, fps: 0, depth: 8, transport: 'tcp', audio: true };

let nextId = 1;

export class Source {
  readonly id: string;
  name: string;
  kind: SourceKind;
  url = '';
  settings: SourceSettings;
  status: 'idle' | 'connecting' | 'live' | 'error' | 'ended' = 'idle';
  message = '';
  info: StreamInfo | null = null;
  /** time code of the source (bridge showinfo / Resolve), see src/clock/source.ts */
  tc: SourceTc | null = null;
  /** SDI ancillary packets of the newest VANC record (DeckLink helper, #160; src/vanc.ts) */
  vanc: { packets: VancPacket[]; at: number } | null = null;
  width = 0;
  height = 0;
  depth: 8 | 16 = 8;
  /** raw frames are 16-bit Y′CbCr (A, Y′, Cb, Cr) with this coding; null = R′G′B′ */
  yuv: YuvCoding | null = null;
  /** Latest raw frame (bridge streams). */
  data: Uint8Array | Uint16Array | null = null;
  /** Browser-decoded media (webcam, screen, files). */
  element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null = null;
  /** Test pattern state (kind 'pattern'). */
  pattern = { id: 'smpte75', width: 1920, height: 1080, label: '' };
  frameSeq = 0;
  fps = 0;
  /** frame rate the camera/capture track promises (getSettings), 0 = unknown */
  nominalFps = 0;
  dropped = 0;
  frozen = false;
  stats: Stats | null = null;
  statsVersion = 0;
  /** running MaxCLL / MaxFALL of PQ sources (whole frames only, reset on source/transfer change) */
  lightLevel: LightLevel = { maxCll: 0, maxFall: 0, frames: 0 };
  private lightKey = '';
  resetLightLevel() { this.lightLevel = { maxCll: 0, maxFall: 0, frames: 0 }; }
  /** Sound of this source (bridge PCM, video file, audio device, generator); null = none. */
  audio: AudioAnalysis | null = null;
  audioIn: AudioInput = { mode: 'device', deviceId: '' };
  /** audio file playing in an audio source (mode 'file') */
  audioEl: HTMLAudioElement | null = null;
  private audioTap: AudioTap | null = null;
  /** PTS of the bridge's sound: sample index → presentation time (protocol 2 `apts`) */
  private audioAnchor: { index: number; pts: number } | null = null;
  /** listening to bridge sound (drift-compensated, io.ts StreamMonitor) */
  monitor: StreamMonitor | null = null;
  monitorError = '';
  private lastFrame: { px: ArrayLike<number>; w: number; h: number; step: number; scale: number; roi: [number, number, number, number][] | null; decode: Decode } | null = null;
  private r103Cache = new Map<string, { key: string; at: number; res: R103Result }>();
  private cpuCache: { seq: string; at: number; f: { px: ArrayLike<number>; w: number; h: number; decode: Decode } | null } = { seq: '', at: -Infinity, f: null };
  private cpuCanvas: HTMLCanvasElement | null = null;
  /** counts real CPU frames (readbacks or new raw data); caches below key on it */
  private cpuSeq = 0;
  /**
   * The current frame on the CPU: raw data, or a readback of the element (at most 960 px wide).
   * The element readback waits for the GPU (drawImage + getImageData), which is expensive under
   * ANGLE/D3D11 (docs/research/windows-und-ndi.md); it runs at most CPU_FRAME_HZ times a second.
   */
  cpuFrame() {
    const size = `${this.width}x${this.height}`;
    const seq = `${this.frameSeq}:${size}`;
    if (this.cpuCache.seq === seq) return this.cpuCache.f;
    const element = !this.data && !!this.element && !!this.width;
    const hz = Number(debugFlags().cpuFrameHz) || CPU_FRAME_HZ;
    const now = performance.now();
    if (element && this.cpuCache.f && this.cpuCache.seq.endsWith(`:${size}`) && now - this.cpuCache.at < 1000 / hz) return this.cpuCache.f;
    let f: { px: ArrayLike<number>; w: number; h: number; decode: Decode } | null = null;
    if (this.data) f = { px: this.data, w: this.width, h: this.height, decode: this.decoder() };
    else if (element) {
      const w = Math.min(960, this.width), h = Math.max(1, Math.round((this.height * w) / this.width));
      this.cpuCanvas ??= document.createElement('canvas');
      const c = this.cpuCanvas; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      try { ctx.drawImage(this.element!, 0, 0, w, h); f = { px: ctx.getImageData(0, 0, w, h).data, w, h, decode: rgbDecoder(255) }; } catch { f = null; }
    }
    this.cpuSeq++;
    this.cpuCache = { seq, at: now, f };
    return f;
  }
  private extremes: { seq: string; v: LineExtremes | null } = { seq: '', v: null };
  /** Min/max Y′ per picture line (minmax.ts), once per frame. */
  lineExtremes(): LineExtremes | null {
    const f = this.cpuFrame();
    const seq = `${this.cpuSeq}:${this.colorspace}`;
    if (this.extremes.seq !== seq) this.extremes = { seq, v: f ? lineExtremes(f.px, f.w, f.h, f.decode, this.colorspace) : null };
    return this.extremes.v;
  }
  private gamutCache: { key: string; set: string; at: number; v: GamutShare | null } = { key: '', set: '', at: 0, v: null };
  /**
   * Share of the picture outside `target` (#181, src/gamutShare.ts), computed from the
   * statistics frame. Recomputed when that frame changes, at most five times a second: it is a
   * QC number, not a trace, and for browser-decoded sources the frame costs a read-back.
   */
  gamutOutside(target: GamutId): GamutShare | null {
    // what is counted (target, source gamut, curve) – a change here is answered at once
    const set = `${target}:${this.gamut}:${this.transfer}:${this.hlgLw}`;
    const key = `${this.cpuSeq}:${set}`;
    const now = performance.now();
    if (this.gamutCache.key === key) return this.gamutCache.v;
    // only a new picture: at most twice a second. It is a QC number, and on a busy machine the
    // main thread has better things to do than linearise the same frame again.
    if (this.gamutCache.set === set && now - this.gamutCache.at < 500) return this.gamutCache.v;
    const f = this.cpuFrame();
    const ys = rgbToXyzMatrix(GAMUTS[this.gamut]).slice(3, 6);
    const v = f ? gamutShare(f.px, f.w, f.h, f.decode, gamutConvert(GAMUTS[this.gamut], GAMUTS[target]), (rgb) => signalToLinear(rgb, this.transfer, this.hlgLw, ys)) : null;
    this.gamutCache = { key, set, at: now, v };
    return v;
  }
  /** The last share counted for `target` (by the CIE panel), without reading the frame. */
  gamutOutsideCached(target: GamutId): GamutShare | null {
    return this.gamutCache.set === `${target}:${this.gamut}:${this.transfer}:${this.hlgLw}` ? this.gamutCache.v : null;
  }
  private neutral: { key: string; v: NeutralCast | null } = { key: '', v: null };
  /** Mean cast of the near-neutral pixels (minmax.ts), once per frame and setting. */
  neutralCast(threshold: number, lo: number, hi: number): NeutralCast | null {
    const f = this.cpuFrame();
    const key = `${this.cpuSeq}:${this.colorspace}:${threshold}:${lo}:${hi}`;
    if (this.neutral.key !== key) {
      this.neutral = { key, v: f ? neutralCast(f.px, f.w, f.h, Math.max(1, Math.round(Math.sqrt((f.w * f.h) / 60000))), f.decode, this.colorspace, threshold, lo, hi) : null };
    }
    return this.neutral.v;
  }
  /** timeline panel (history.ts): ten samples per second while a timeline shows this source */
  readonly history = new History();
  private historyAt = 0;
  private historySeq = -1;
  /**
   * @param everyFrame one sample per new picture (e.g. video files) instead of ten per second
   * @param grid raster width (height = width · 9/16): 96 standard, finer for more exact means
   */
  sampleHistory(now = performance.now(), opts: { everyFrame?: boolean; grid?: number } = {}) {
    if (!this.ready) return;
    if (opts.everyFrame ? this.frameSeq === this.historySeq : now - this.historyAt < 100) return;
    this.historyAt = now; this.historySeq = this.frameSeq;
    const gw = opts.grid ?? GRID_W, gh = Math.max(1, Math.round((gw * 9) / 16));
    let pts: number[][];
    if (this.data) pts = gridFromData(this.data, this.width, this.height, this.decoder(), gw, gh);
    else {
      // reuse the throttled CPU frame: an own drawImage + getImageData would stall on the GPU again (#127)
      const f = this.cpuFrame();
      if (!f) return;
      pts = gridFromData(f.px, f.w, f.h, f.decode, gw, gh);
    }
    this.history.push(summarise(pts, this.colorspace, now));
  }

  /** Reads a pixel of the raw frame (`data`) as normalised R′G′B′: Y′CbCr decoded with the source matrix. */
  decoder(): Decode {
    if (!this.yuv) return rgbDecoder(this.depth === 16 ? 65535 : 255);
    const { kr, kb } = LUMA[this.colorspace];
    return yuvDecoder(kr, kb, this.yuv);
  }

  /**
   * EBU R 103 check of the last analysed frame (ycbcr.ts), optionally after the processing
   * chain. Computed on demand, at most every 250 ms per stage.
   */
  r103Stats(c?: Compiled): R103Result | null {
    const f = this.lastFrame ?? this.readbackFrame();
    if (!f) return null;
    const key = `${this.statsVersion}:${c?.sig ?? ''}:${this.colorspace}`, slot = c?.stage ?? 'signal';
    const hit = this.r103Cache.get(slot), now = performance.now();
    if (hit && (hit.key === key || now - hit.at < 250)) return hit.res;
    const { kr, kb } = LUMA[c ? c.view.colorspace : this.colorspace];
    const res = r103Check(f.px, f.w, f.h, f.decode, kr, kb, c?.apply, f.roi);
    this.r103Cache.set(slot, { key, at: now, res });
    return res;
  }
  private stageCache = new Map<string, { key: string; stats: Stats }>();

  /** Statistics of the last analysed frame after the processing chain (stage views, chain.ts). */
  stageStats(c: Compiled): Stats | null {
    const f = this.lastFrame ?? this.readbackFrame();
    if (!f) return this.stats;
    const key = `${this.statsVersion}:${c.sig}`;
    const hit = this.stageCache.get(c.stage);
    if (hit?.key === key) return hit.stats;
    const { kr, kb } = LUMA[c.view.colorspace];
    const stats = computeStats(f.px, f.w, f.h, f.step, f.scale, kr, kb, f.roi, c.apply, f.decode);
    this.stageCache.set(c.stage, { key, stats });
    return stats;
  }

  /**
   * Luma range of the skin-tone pixels inside the ROI (whole frame without ROI):
   * 5th and 95th percentile – used to set the skin target range from a face.
   */
  skinLumaRange(kr: number, kb: number, tolDeg: number): { lo: number; hi: number; n: number } | null {
    const f = this.lastFrame ?? this.readbackFrame();
    if (!f) return null;
    const kg = 1 - kr - kb;
    const sx = f.w / this.width, sy = f.h / this.height;
    const rects = this.activeRois().length ? this.activeRois().map((r) => [r[0] * sx, r[1] * sy, r[2] * sx, r[3] * sy]) : [[0, 0, f.w, f.h]];
    const ys: number[] = [];
    for (const [x0, y0, x1, y1] of rects) for (let y = Math.floor(y0); y < Math.min(f.h, y1); y += f.step) {
      for (let x = Math.floor(x0); x < Math.min(f.w, x1); x += f.step) {
        const i = (y * f.w + x) * 4;
        const [r, g, b] = f.decode(f.px, i);
        const Y = kr * r + kg * g + kb * b, cb = (b - Y) / (2 * (1 - kb)), cr = (r - Y) / (2 * (1 - kr));
        const ang = (Math.atan2(cr, cb) * 180) / Math.PI;
        if (Math.hypot(cb, cr) > 0.012 && Math.abs(ang - 123) <= tolDeg) ys.push(Y);
      }
    }
    if (ys.length < 20) return null;
    ys.sort((a, b) => a - b);
    return { lo: ys[Math.floor(ys.length * 0.05)], hi: ys[Math.floor(ys.length * 0.95)], n: ys.length };
  }
  /** Decoded R′G′B′ samples inside the ROI (whole frame without ROI), at most ~`max` (green qualifier, match/core.ts). */
  roiSamples(max = 40000): number[][] {
    const f = this.lastFrame ?? this.readbackFrame();
    if (!f) return [];
    const sx = f.w / this.width, sy = f.h / this.height;
    const rects = this.activeRois().length ? this.activeRois().map((r) => [r[0] * sx, r[1] * sy, r[2] * sx, r[3] * sy]) : [[0, 0, f.w, f.h]];
    const area = rects.reduce((a, [x0, y0, x1, y1]) => a + (x1 - x0) * (y1 - y0), 0);
    const step = Math.max(f.step, Math.ceil(Math.sqrt(area / max)));
    const out: number[][] = [];
    for (const [x0, y0, x1, y1] of rects) for (let y = Math.floor(y0); y < Math.min(f.h, y1); y += step) {
      for (let x = Math.floor(x0); x < Math.min(f.w, x1); x += step) out.push(f.decode(f.px, (y * f.w + x) * 4));
    }
    return out;
  }
  probe: { x: number; y: number } | null = null;
  /** Region of interest in source pixels [x0, y0, x1, y1). */
  roi: [number, number, number, number] | null = null;
  /**
   * Face tracking (src/face.ts): 'detect' shows all faces grey, the clicked ones
   * (faceSel, by id) are tracked; 'all' tracks every face.
   */
  faces: { id: number; box: [number, number, number, number] }[] = [];
  faceMode: 'off' | 'detect' | 'all' = 'off';
  faceSel = new Set<number>();
  get faceTrack() { return this.faceMode !== 'off'; }

  /** Regions of interest in effect: tracked faces, else the manual rectangle. */
  activeRois(): [number, number, number, number][] {
    if (this.faceMode === 'all') return this.faces.map((f) => f.box);
    if (this.faceMode === 'detect') return this.faces.filter((f) => this.faceSel.has(f.id)).map((f) => f.box);
    return this.roi ? [this.roi] : [];
  }
  /** Estimated frame duration of a video file (from presented frames). */
  frameDuration = 1 / 25;
  /** Transport of a clip through the bridge (#191, server/clip.mjs); null without one. */
  clip: ClipState | null = null;
  /** QC metrics of the bridge (#202, server/signalstats.mjs); null when they are not requested */
  signal: SignalStats | null = null;
  private probeCache = { key: '', rgb: null as [number, number, number] | null };
  onChange: () => void = () => {};

  private ws: FrameSocket | null = null;
  /** latency of stamped test pictures (#16) */
  readonly latency = new LatencyMeter();
  /** global low-latency switch (main.ts); a source's own setting overrides it */
  static globalLowLatency = false;
  /** global low-latency settings (Settings menu) */
  static globalLowLatencyConfig: Partial<LowLatencyConfig> = {};
  /** a bridge frame arrived (main.ts draws at once in low-latency mode) */
  static onArrive: ((s: Source) => void) | null = null;
  get lowLatency(): boolean { return this.settings.lowLatency ?? Source.globalLowLatency; }
  /** effective low-latency settings of this source */
  get llConfig(): LowLatencyConfig { return mergeLowLatency(Source.globalLowLatencyConfig, this.settings.ll); }
  /** own RTP reception: how the bridge received this stream (info message), null = ffmpeg's RTSP */
  get rtpInfo() { return this.info?.rtp ?? null; }
  /** own RTP reception counters from the bridge's stats (1 s) */
  rtpStats: RtpStats | null = null;
  /** frame phase against the ST 2059-1 grid, from the bridge stats of capture-helper sources (server/phase.mjs, #72) */
  phase: import('./genlock').PhaseReport | null = null;
  private patternTimer: ReturnType<typeof setInterval> | null = null;
  private media: MediaStream | null = null;
  private objectUrl: string | null = null;
  private frameTimes: number[] = [];
  private statsCanvas: HTMLCanvasElement | null = null;
  private statsSeq = '';

  constructor(kind: SourceKind, name?: string, settings?: Partial<SourceSettings>) {
    this.id = `s${nextId++}`;
    this.kind = kind;
    this.name = name ?? t(`source.kind.${kind}`);
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  get transfer(): Transfer {
    if (this.settings.transfer !== 'auto') return this.settings.transfer;
    if (this.kind === 'pattern') return patternById(this.pattern.id).transfer ?? 'sdr';
    return detectTransfer(this.info?.transfer);
  }
  /** Where the transfer comes from – shown next to "auto" so the UI never pretends to know. */
  get transferOrigin(): string {
    if (this.settings.transfer !== 'auto') return t('source.origin.manual');
    if (this.kind === 'pattern') return t('source.origin.pattern');
    if (!this.info) return t('source.origin.noMeta');
    return transferSignalled(this.info.transfer) ? t('source.origin.meta') : t('source.origin.notSignalled');
  }
  get colorspaceOrigin(): string {
    if (this.settings.colorspace !== 'auto') return t('source.origin.manual');
    if (!this.info) return this.kind === 'pattern' ? t('source.origin.pattern') : t('source.origin.noMetaHeight');
    const m = this.info.matrix, p = this.info.primaries;
    return (m && m !== 'unknown') || (p && p !== 'unknown') ? t('source.origin.meta') : t('source.origin.notSignalledHeight');
  }
  get colorspace(): Colorspace {
    if (this.settings.colorspace !== 'auto') return this.settings.colorspace;
    if (this.kind === 'pattern') { const c = patternById(this.pattern.id).colorspace; if (c) return c; }
    if (!this.info) return this.height > 576 || this.height === 0 ? '709' : this.height === 576 ? '601-625' : '601';
    return detectColorspace(this.info.decodeMatrix ?? this.info.matrix, this.info.primaries, this.info.sourceHeight);
  }
  get gamut(): GamutId {
    const g = this.settings.gamut ?? 'auto';
    if (g !== 'auto') return g;
    const t = this.transfer;
    return isLog(t) ? LOG_CURVES[t].gamut : this.colorspace;
  }
  get hlgLw(): number { return this.settings.hlgLw ?? 1000; }
  get ready() { return this.width > 0 && (this.data !== null || this.element !== null); }

  private set(status: Source['status'], message = '') {
    const moved = this.status !== status;
    this.status = status; this.message = message;
    // only a changed status rebuilds the card. The bridge reports dropped frames and bitrate with
    // every statistics message, and a card rebuilt once a second cannot be clicked on a busy
    // machine. The text itself is written in place by updateSourceText() (src/main.ts).
    if (moved) this.onChange();
  }

  private tick() {
    const now = performance.now();
    this.frameTimes.push(now);
    while (this.frameTimes.length && now - this.frameTimes[0] > 1000) this.frameTimes.shift();
    this.fps = this.frameTimes.length;
    if (!this.frozen) this.frameSeq++;
  }

  /** counts connect attempts, so a late answer of an earlier one is ignored */
  private connectSeq = 0;

  connectStream(url: string, bridge: string) {
    this.stop();
    this.url = url;
    this.set('connecting', t('source.status.connecting'));
    const seq = ++this.connectSeq;
    // a platform shell may receive this URL itself (iOS: RTSP direct, #90) – same frame protocol
    const direct = streamRoute.resolve(url, this.settings);
    if (direct) {
      this.rtpStats = null; this.phase = null;
      direct.then((ws) => { if (seq === this.connectSeq && this.status === 'connecting') this.connectFrames(ws, false); })
        .catch((e: Error) => { if (seq === this.connectSeq) this.set('error', e.message); });
      return;
    }
    const { fps, depth, transport } = this.settings;
    const ll = this.llConfig;
    const width = effectiveWidth(this.settings.width, this.lowLatency, ll.width);
    const q = new URLSearchParams({ url, width: String(width), fps: String(fps), depth: String(depth), transport });
    if (this.settings.audio !== false) q.set('audio', '1');
    for (const [k, v] of Object.entries(bridgeInputParams(url, this.settings))) q.set(k, v);
    // H.264 (#16) is 8 bit 4:2:0 and excludes the unclipped Y′CbCr path (#7)
    if (this.settings.codec === 'h264' && workerAvailable()) q.set('codec', 'h264');
    else if (this.settings.yuv) { q.set('format', 'yuv'); q.set('depth', '16'); }
    if (this.lowLatency && ll.ownRtp) q.set('rtp', 'own');
    // QC metrics from ffmpeg (#202): costs about 6 ms per 1080p frame in the bridge, so only on request
    if (this.settings.signalStats) q.set('signal', '1');
    this.rtpStats = null;
    this.phase = null;
    this.connectFrames(`${bridge}/stream?${q}`, false);
  }

  /**
   * Connect to any endpoint speaking the LZ Scopes frame protocol (docs/frame-protocol.md),
   * e.g. a host bridge that keeps the camera address to itself: `ws://host/scope/3`.
   */
  connectFrames(wsUrl: string, reset = true) {
    if (reset) { this.stop(); this.url = wsUrl; this.set('connecting', t('source.status.connecting')); }
    const ws = openFrameSocket(wsUrl);
    this.ws = ws;
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'info') {
          this.info = msg; this.width = msg.width; this.height = msg.height; this.depth = msg.depth;
          this.yuv = yuvOf(msg);
          // a file through the bridge brings its transport along (server/clip.mjs)
          this.clip = msg.clip ? { state: 'playing', pos: 0, duration: Number(msg.clip.duration) || 0, fps: Number(msg.clip.fps) || 25, rate: 1, loop: msg.clip.loop !== false, at: performance.now() } : null;
          if (this.clip) this.frameDuration = 1 / this.clip.fps;
          const a = msg.audio as AudioStreamInfo | null | undefined;
          this.monitor?.close(); this.monitor = null; this.audioAnchor = null;
          this.audio = a ? new AudioAnalysis(a.sampleRate, a.channels, a.layout) : null;
          if (this.audio && a) this.audio.label = `Bridge · ${a.codec ?? ''} ${a.sampleRate / 1000} kHz`.replace('  ', ' ');
          const pic = msg.width ? `${msg.sourceWidth}×${msg.sourceHeight} ${msg.codec ?? ''}`.trim() : t('source.status.soundOnly');
          this.set('live', a ? `${pic} · ${t('source.status.sound', { codec: a.codec ?? '', khz: a.sampleRate / 1000, ch: a.channels })}` : msg.proto === 2 ? `${pic} · ${t('source.status.noSound')}` : pic);
        } else if (msg.type === 'signal') {
          // QC metrics of the bridge (server/signalstats.mjs); `at` tells the QC check how old they are
          this.signal = { ...msg, at: performance.now() };
        } else if (msg.type === 'clip') {
          // playhead of the clip; between two messages the page runs it on itself (clipPosition)
          this.clip = { state: msg.state === 'paused' ? 'paused' : 'playing', pos: Number(msg.pos) || 0, duration: Number(msg.duration) || 0, fps: Number(msg.fps) || 25, rate: Number(msg.rate) || 1, loop: msg.loop !== false, at: performance.now() };
          this.frameDuration = 1 / this.clip.fps;
          // no onChange() here: the playhead arrives every second, and rebuilding the source list
          // that often tears the transport buttons out from under the pointer. updateTransport()
          // (src/main.ts) keeps slider, time code and the play button up to date on every frame.
        } else if (msg.type === 'tc') {
          this.tc = { ...msg, at: performance.now() };
        } else if (msg.type === 'vanc') {
          this.vanc = { packets: Array.isArray(msg.packets) ? msg.packets : [], at: performance.now() };
        } else if (msg.type === 'apts') {
          // PTS anchor of the sound: sample `index` has presentation time `pts` (s)
          this.audioAnchor = { index: msg.index, pts: msg.pts };
        } else if (msg.type === 'stats') {
          this.dropped = msg.dropped;
          this.latency.onBridgeStats(msg.stampAge);
          this.rtpStats = msg.rtp ?? null;
          this.phase = msg.phase ?? null;
          if (msg.rec) Source.onRecord?.(this, msg.rec);
          if (msg.ring) Source.onRecord?.(this, msg.ring);
          if (msg.message) this.set(this.status === 'live' ? 'live' : 'connecting', bridgeMessage(msg));
        } else if (msg.type === 'record' || msg.type === 'ring' || msg.type === 'playback') {
          // local recording in the bridge (server/recorder.mjs)
          Source.onRecord?.(this, msg);
        } else if (msg.type === 'resolve') {
          // DaVinci Resolve (#88): timeline playing / paused again (server/resolveWatch.mjs)
          Source.onResolve?.(this, msg);
        } else if (msg.type === 'error' || msg.type === 'end') {
          this.set(msg.type === 'end' ? 'ended' : 'error', bridgeMessage(msg));
        }
        return;
      }
      // an exact still again after a live capture (#88): back to the stream's own format
      if (this.liveShown) this.showLive(null);
      const buf = ev.data as ArrayBuffer;
      if (this.info?.proto === 2) {
        // 16-byte header: 'LZV1' | 'LZA1', uint32, float64 (docs/frame-protocol.md)
        const head = new DataView(buf, 0, 16);
        const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
        if (magic === 'LZA1') {
          // audio keeps running while frozen: loudness must not have gaps
          const n = head.getUint32(4, true), first = head.getFloat64(8, true);
          const an = this.audioAnchor;
          const pts0 = an && this.audio ? an.pts + (first - an.index) / this.audio.fs : NaN;
          if (this.audio) {
            const pcm = new Float32Array(buf, 16, n * this.audio.channels);
            this.audio.pushInterleaved(pcm, first, pts0);
            this.monitor?.push(pcm);
          }
          return;
        }
        if (magic !== 'LZV1') return;
        const pts = head.getFloat64(8, true);
        const px = this.depth === 16 ? new Uint16Array(buf, 16) : new Uint8Array(buf, 16);
        // A/V offset: mean luma of every frame (also while frozen), stamped with its PTS;
        // the frame worker measured them already, including frames it replaced
        if (this.audio && this.width) {
          if (ev.meta?.av) for (const [t, l] of ev.meta.av) this.audio.av.pushVideo(t, l);
          else this.audio.av.pushVideo(pts, meanLuma(px, this.width, this.height, this.depth === 16 ? 65535 : 255, !!this.yuv));
        }
        if (this.frozen) return;
        this.data = px;
        this.held.push(px);
        this.tick();
        this.latency.onFrame(ev.meta);
        Source.onArrive?.(this);
        return;
      }
      if (this.frozen) return;
      this.data = this.depth === 16 ? new Uint16Array(buf) : new Uint8Array(buf);
      this.held.push(this.data);
      this.tick();
      this.latency.onFrame(ev.meta);
      Source.onArrive?.(this);
    };
    ws.onerror = () => this.set('error', t('source.status.bridgeUnreachable'));
    ws.onclose = () => { if (this.ws === ws && this.status === 'live') this.set('ended', t('source.status.connectionEnded')); };
  }

  /** DaVinci Resolve (#88): how the picture gets here right now – set by src/resolvePlayback.ts. */
  resolveRoute: ResolveRoute | null = null;
  /** a 'resolve' message of the bridge arrived (main.ts → src/resolvePlayback.ts) */
  static onResolve: ((s: Source, msg: { state: 'playing' | 'paused'; played?: boolean; project?: string | null }) => void) | null = null;
  /** last raw frames with their arrival time, for "freeze all" with latency compensation (#140 step 2) */
  readonly held = new FrameHistory<Uint8Array | Uint16Array>();
  /**
   * Freeze on the held frame closest to scene moment `scene` (wall ms); this source shows the
   * scene `latencyMs` late. Element sources (camera, files in the page) freeze on their current picture.
   */
  freezeAt(scene: number, latencyMs: number) {
    const f = this.data ? pickFrame(this.held.frames, scene, latencyMs) : null;
    if (f && f.frame !== this.data && f.frame.length === this.data!.length) { this.data = f.frame; this.frameSeq++; }
    this.frozen = true;
  }
  /** a recording message of the bridge arrived (src/record/record.ts) */
  static onRecord: ((s: Source, msg: Record<string, unknown>) => void) | null = null;
  /** Send a text message on this source's bridge connection; false without one. */
  sendBridge(msg: object): boolean {
    if (!this.ws) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }
  /** Media stream for MediaRecorder: camera/screen, video file or the pattern canvas; null for bridge sources. */
  captureStream(fps = 25): MediaStream | null {
    if (this.media) return this.media;
    const el = (this.videoEl ?? this.element) as (HTMLMediaElement & { captureStream?: () => MediaStream }) | HTMLCanvasElement | null;
    if (el instanceof HTMLCanvasElement) {
      // canvas.captureStream() yields frames only when the canvas is painted on screen; ours is not in
      // the document. Chromium: feed it frame by frame (MediaStreamTrackGenerator), else captureStream.
      const Gen = (globalThis as unknown as { MediaStreamTrackGenerator?: new (o: { kind: string }) => MediaStreamTrack & { writable: WritableStream<VideoFrame> } }).MediaStreamTrackGenerator;
      if (!Gen || typeof VideoFrame === 'undefined') return el.captureStream(fps);
      const gen = new Gen({ kind: 'video' });
      const writer = gen.writable.getWriter();
      const t0 = performance.now();
      const timer = setInterval(() => {
        if (gen.readyState === 'ended') { clearInterval(timer); writer.close().catch(() => {}); return; }
        writer.write(new VideoFrame(el, { timestamp: Math.round((performance.now() - t0) * 1000) })).catch(() => {});
      }, 1000 / fps);
      return new MediaStream([gen]);
    }
    return el && 'captureStream' in el && typeof el.captureStream === 'function' ? el.captureStream() : null;
  }
  /** called by stop(), e.g. to end a live capture that belongs to this source */
  static onStop: ((s: Source) => void) | null = null;
  private liveShown = false;
  /**
   * Show a captured picture instead of the bridge frames (Resolve playback, #88); null goes
   * back to the frames – done by the next still as well.
   */
  showLive(el: HTMLCanvasElement | null) {
    if (el) {
      this.liveShown = true;
      this.data = null; this.element = el; this.width = el.width; this.height = el.height; this.depth = 8;
      this.tick();
      return;
    }
    if (!this.liveShown) return;
    this.liveShown = false;
    this.element = null;
    if (this.info) { this.width = this.info.width; this.height = this.info.height; this.depth = this.info.depth; }
  }
  get showingLive() { return this.liveShown; }

  /**
   * Feed frames without a WebSocket, e.g. from an Electron main process over a
   * MessagePort. `info` once (or on change), then one call per frame.
   */
  pushInfo(info: StreamInfo) {
    this.info = info; this.width = info.width; this.height = info.height; this.depth = info.depth;
    this.yuv = yuvOf(info);
    this.set('live', `${info.sourceWidth}×${info.sourceHeight} ${info.codec ?? ''}`.trim());
  }
  pushFrame(buffer: ArrayBuffer) {
    if (this.frozen || !this.info) return;
    this.data = this.depth === 16 ? new Uint16Array(buffer) : new Uint8Array(buffer);
    this.tick();
  }

  /** Crop of captured/video pictures in element pixels [x0, y0, x1, y1] – e.g. Resolve's viewer in a window capture. */
  crop: [number, number, number, number] | null = null;
  private cropCanvas: HTMLCanvasElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private folderTimer: ReturnType<typeof setInterval> | null = null;
  /** Camera / capture device in use (webcam kind). */
  deviceId = '';

  /** Copy the cropped region of the video into a canvas that acts as the element. */
  private applyCrop(v: HTMLVideoElement) {
    if (!this.crop) { this.element = v; this.width = v.videoWidth; this.height = v.videoHeight; return; }
    const [x0, y0, x1, y1] = this.crop, w = Math.max(2, x1 - x0), h = Math.max(2, y1 - y0);
    this.cropCanvas ??= document.createElement('canvas');
    const c = this.cropCanvas;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.getContext('2d')!.drawImage(v, x0, y0, w, h, 0, 0, w, h);
    this.element = c; this.width = w; this.height = h;
  }

  /** Set the crop from the current ROI (in the currently shown picture's pixels). */
  cropToRoi() {
    if (!this.roi) return false;
    const [ox, oy] = this.crop ?? [0, 0];
    const [x0, y0, x1, y1] = this.roi;
    this.crop = [ox + x0, oy + y0, ox + x1, oy + y1];
    this.roi = null;
    if (this.videoEl) this.applyCrop(this.videoEl);
    this.tick();
    return true;
  }
  clearCrop() { this.crop = null; if (this.videoEl) this.applyCrop(this.videoEl); this.tick(); }

  /**
   * Watch a folder (File System Access API): the newest image becomes the picture –
   * exports/stills from Resolve, Lightroom, Capture One.
   */
  async startFolder() {
    this.stop();
    const picker = (window as unknown as { showDirectoryPicker?: (o?: object) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
    if (!picker) { this.set('error', t('source.status.folderNeedsChrome')); return; }
    let dir: FileSystemDirectoryHandle;
    try { dir = await picker({ id: 'lz-scopes-watch', mode: 'read' }); } catch { this.set('idle'); return; }
    this.name = dir.name;
    let last = '';
    const poll = async () => {
      let newest: File | null = null;
      for await (const entry of (dir as unknown as { values(): AsyncIterable<FileSystemHandle> }).values()) {
        if (entry.kind !== 'file' || !/\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(entry.name)) continue;
        const f = await (entry as FileSystemFileHandle).getFile();
        if (!newest || f.lastModified > newest.lastModified) newest = f;
      }
      if (!newest) { this.set('live', t('source.status.folderEmpty', { dir: dir.name })); return; }
      const key = `${newest.name}:${newest.lastModified}:${newest.size}`;
      if (key === last) return;
      last = key;
      const img = new Image();
      const url = URL.createObjectURL(newest);
      img.src = url;
      try { await img.decode(); } catch { URL.revokeObjectURL(url); return; }
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = url;
      this.element = img; this.width = img.naturalWidth; this.height = img.naturalHeight; this.depth = 8;
      this.tick();
      this.set('live', `${dir.name}/${newest.name} · ${this.width}×${this.height}`);
    };
    await poll();
    this.folderTimer = setInterval(() => { poll().catch(() => {}); }, 1000);
  }

  async startCapture(kind: 'webcam' | 'screen', deviceId?: string, desktopId?: string) {
    this.stop();
    this.set('connecting', t('source.status.waitPermission'));
    try {
      this.media = kind === 'webcam'
        ? await navigator.mediaDevices.getUserMedia({ video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } }, audio: false })
        : desktopId
          // desktop app: a specific window/screen chosen in our own picker (Electron desktopCapturer id)
          ? await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: desktopId, maxWidth: 3840, maxHeight: 2160, maxFrameRate: 30 } } } as unknown as MediaStreamConstraints)
          : await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.srcObject = this.media;
      await v.play();
      this.attachVideo(v);
      const track = this.media.getVideoTracks()[0];
      this.deviceId = track.getSettings().deviceId ?? deviceId ?? '';
      this.nominalFps = Math.round(track.getSettings().frameRate ?? 0);
      track.addEventListener('ended', () => this.set('ended', t('source.status.captureEnded')));
      this.set('live', `${v.videoWidth}×${v.videoHeight} ${track.label}`);
    } catch (e) {
      this.set('error', (e as Error).message);
    }
  }

  async openFile(file: File) {
    this.stop();
    this.objectUrl = URL.createObjectURL(file);
    this.name = file.name;
    if (file.type.startsWith('image/')) {
      const img = new Image();
      img.src = this.objectUrl;
      await img.decode();
      this.element = img; this.width = img.naturalWidth; this.height = img.naturalHeight; this.depth = 8;
      this.tick();
      this.set('live', `${this.width}×${this.height} ${t('source.status.image')}`);
      return;
    }
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.src = this.objectUrl;
    try {
      await v.play();
      this.attachVideo(v);
      this.set('live', `${v.videoWidth}×${v.videoHeight} Video`);
      this.tapElement(v).catch(() => { /* no sound track or no AudioContext */ });
    } catch (e) {
      this.set('error', t('source.status.notPlayable', { msg: (e as Error).message }));
    }
  }

  /**
   * A file through the bridge (#188): ffmpeg decodes it, so ProRes, DNxHR, v210, 10-bit HEVC
   * and 16-bit stills arrive with their own depth – the `<video>` element of openFile() hands
   * out 8-bit R′G′B′ whatever went in. `url` is the `file:<name>` of a released file.
   */
  openBridgeFile(url: string, name: string, bridge: string) {
    this.name = name;
    this.settings.depth = 16;
    this.settings.yuv ??= true;
    this.connectStream(url, bridge);
  }

  /** Play a video from a URL (cached test videos, lzs-media://, #52); CORS keeps WebGL readable. */
  async openVideoUrl(url: string, name: string) {
    this.stop();
    this.name = name;
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous';
    v.muted = true; v.loop = true; v.playsInline = true; v.src = url;
    try {
      await v.play();
      this.attachVideo(v);
      this.set('live', `${v.videoWidth}×${v.videoHeight} Video`);
      this.tapElement(v).catch(() => { /* no sound track or no AudioContext */ });
    } catch (e) {
      this.set('error', t('source.status.notPlayable', { msg: (e as Error).message }));
    }
  }

  /** Generate a test pattern into a canvas; animated patterns redraw at 25 fps. */
  async startPattern() {
    this.stop();
    const { id, width, height, label } = this.pattern;
    const def = patternById(id);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const t0 = performance.now();
    try {
      await renderPattern(ctx, def, width, height, 0, label);
    } catch (e) {
      this.set('error', (e as Error).message);
      return;
    }
    this.element = canvas; this.width = width; this.height = height; this.depth = 8;
    if (def.frame16) {
      // exact codes for the scopes; the canvas stays as the 8-bit picture for other uses
      const f = def.frame16(width, height);
      this.data = f.data; this.depth = 16; this.yuv = f.coding;
    }
    this.tick();
    this.set('live', `${def.name} · ${width}×${height}${def.frame16 ? ' · 16 bit Y′CbCr' : ''}`);
    if (def.animated) {
      let busy = false;
      const timer = setInterval(async () => {
        if (busy || this.frozen || this.element !== canvas) return;
        busy = true;
        await renderPattern(ctx, def, width, height, (performance.now() - t0) / 1000, label);
        busy = false;
        this.tick();
      }, 40);
      this.patternTimer = timer;
    }
  }

  private attachVideo(v: HTMLVideoElement) {
    this.videoEl = v; this.depth = 8;
    this.applyCrop(v);
    const onFrame = () => {
      if (this.videoEl !== v) return;
      this.applyCrop(v);
      this.tick();
      if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(onFrameMeta);
      else setTimeout(onFrame, 1000 / 30);
    };
    let lastMedia = -1;
    const onFrameMeta = (_now: number, meta: VideoFrameCallbackMetadata) => {
      const d = meta.mediaTime - lastMedia;
      if (lastMedia >= 0 && d > 0.005 && d < 0.2 && !v.paused) this.frameDuration = this.frameDuration * 0.8 + d * 0.2;
      lastMedia = meta.mediaTime;
      onFrame();
    };
    // a paused seek (frame step, scrubbing) must refresh the scopes as well
    v.addEventListener('seeked', () => { if (this.videoEl === v) { this.applyCrop(v); this.tick(); this.onChange(); } });
    v.addEventListener('play', () => this.onChange());
    v.addEventListener('pause', () => this.onChange());
    onFrame();
  }

  /** Feed samples from a capture worklet or the generator loop-back. */
  private feed(chs: Float32Array[], n: number, rate: number, label: string) {
    if (!this.audio || this.audio.fs !== rate || this.audio.channels !== chs.length) {
      this.audio = new AudioAnalysis(rate, chs.length);
      this.audio.label = label;
    }
    this.audio.push(chs, n);
  }

  /** Sound of a video/audio element: routed into the analysis, audible only with monitoring. */
  private async tapElement(el: HTMLMediaElement) {
    this.audioTap?.close();
    const tap = await AudioTap.fromElement(el, (chs, n, rate) => this.feed(chs, n, rate, `${t('source.kind.file')} · ${rate / 1000} kHz`));
    this.audioTap = tap;
    el.addEventListener('play', () => tap.resume());
  }

  get monitoring() { return this.audioTap?.monitoring ?? !!this.monitor; }
  setMonitor(on: boolean) {
    if (this.audioTap) { this.audioTap.setMonitor(on); this.onChange(); return; }
    if (!on) { this.monitor?.close(); this.monitor = null; this.onChange(); return; }
    const a = this.audio;
    if (!a || this.monitor) return;
    StreamMonitor.create(a.fs, a.channels, monitorSink.id).then((m) => {
      if (this.audio !== a) { m.close(); return; }
      this.monitor = m; this.monitorError = m.error;
      m.setPair(monitorSink.pair);
      m.onStats = () => this.onChange();
      this.onChange();
    }).catch((e) => { this.monitorError = (e as Error).message; this.onChange(); });
  }
  /** Element/device sources monitor through their tap, bridge sources through a StreamMonitor. */
  get canMonitor() { return !!this.audioTap || (!!this.audio && this.kind === 'stream'); }

  /** Audio-only source: audio device, audio file, the generator loop-back or a bridge audio device. */
  async startAudio(file?: File, bridge?: string) {
    this.stop();
    const inp = this.audioIn;
    if (inp.mode === 'bridge') {
      if (!inp.bridgeUrl) { this.set('idle', t('source.status.chooseDevice')); return; }
      if (!bridge) { this.set('error', t('source.status.bridgeNotConnected')); return; }
      this.connectStream(inp.bridgeUrl, bridge);
      return;
    }
    try {
      if (inp.mode === 'generator') {
        generator.setLoopback((chs, n, rate) => this.feed(chs, n, rate, `Generator · ${rate / 1000} kHz`));
        this.generatorBound = true;
        this.set('live', generator.running ? t('source.status.generatorReturn') : t('source.status.generatorReturnStart'));
        return;
      }
      if (inp.mode === 'file') {
        if (!file) return;
        this.objectUrl = URL.createObjectURL(file);
        this.name = file.name;
        const el = new Audio(this.objectUrl);
        el.controls = true; el.loop = true;
        this.audioEl = el;
        await this.tapElement(el);
        await el.play();
        this.set('live', `${file.name}`);
        return;
      }
      this.set('connecting', t('source.status.waitPermission'));
      this.media = await navigator.mediaDevices.getUserMedia({ audio: measurementConstraints(inp.deviceId || undefined), video: false });
      const track = this.media.getAudioTracks()[0];
      const st = track.getSettings();
      const tap = await AudioTap.fromStream(this.media, (chs, n, rate) => this.feed(chs, n, rate, `${track.label} · ${rate / 1000} kHz`));
      this.audioTap = tap;
      track.addEventListener('ended', () => this.set('ended', t('source.status.deviceDisconnected')));
      const off = [st.echoCancellation, st.noiseSuppression, st.autoGainControl].some((x) => x === true) ? ` · ${t('source.status.browserAgc')}` : '';
      this.set('live', `${track.label || t('source.audioDevice')} · ${tap.ctx.sampleRate / 1000} kHz${st.channelCount ? ` · ${t('source.channels', { n: st.channelCount })}` : ''}${off}`);
    } catch (e) {
      this.set('error', (e as Error).message);
    }
  }
  private generatorBound = false;

  get video(): HTMLVideoElement | null {
    return this.videoEl;
  }

  stop() {
    this.connectSeq++;
    Source.onStop?.(this);
    this.liveShown = false; this.resolveRoute = null;
    if (this.folderTimer) { clearInterval(this.folderTimer); this.folderTimer = null; }
    if (this.reverseTimer) { clearInterval(this.reverseTimer); this.reverseTimer = null; }
    if (this.patternTimer) { clearInterval(this.patternTimer); this.patternTimer = null; }
    if (this.ws) { const ws = this.ws; this.ws = null; ws.onclose = null; ws.close(); }
    this.media?.getTracks().forEach((t) => t.stop());
    this.media = null;
    this.audioTap?.close(); this.audioTap = null;
    this.monitor?.close(); this.monitor = null; this.audioAnchor = null;
    if (this.audioEl) { this.audioEl.pause(); this.audioEl.removeAttribute('src'); this.audioEl = null; }
    if (this.generatorBound) { generator.setLoopback(null); this.generatorBound = false; }
    this.audio = null;
    if (this.videoEl) { this.videoEl.pause(); this.videoEl.srcObject = null; this.videoEl = null; }
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
    this.history.clear();
    this.held.clear();
    this.clip = null;
    this.signal = null;
    this.element = null; this.data = null; this.yuv = null; this.info = null; this.tc = null; this.vanc = null; this.width = 0; this.height = 0; this.stats = null;
    this.fps = 0; this.dropped = 0;
    if (this.status !== 'idle') this.set('idle');
  }

  // ---- transport (video files and clips through the bridge), Resolve-style
  get isVideoFile() { return this.kind === 'file' && this.video !== null; }
  /** Play, pause and step: a video file in the browser, or a clip the bridge decodes (#191). */
  get hasTransport() { return this.isVideoFile || this.clip !== null; }
  /** Length of the open clip (s), 0 when it is not known. */
  get duration() { return this.clip ? this.clip.duration : this.video?.duration || 0; }
  get playing() { return this.clip ? this.clip.state === 'playing' : !!this.video && !this.video.paused; }
  /** Playback rate; reverse runs through reverseSpeed, not through this one. */
  get rate() { return this.clip ? this.clip.rate : this.video?.playbackRate ?? 1; }
  /**
   * Playhead (s). The bridge reports it once a second and at every command, in between the page
   * runs it on itself – otherwise the time code would step only once a second.
   */
  position(now = performance.now()) {
    const c = this.clip;
    if (!c) return this.video?.currentTime ?? 0;
    const t = c.state === 'playing' ? c.pos + ((now - c.at) / 1000) * c.rate : c.pos;
    return Math.max(0, c.duration ? Math.min(c.duration, t) : t);
  }
  /** Transport command to the bridge; the playhead moves at once, the picture follows. */
  private clipCmd(op: string, extra: Record<string, unknown> = {}, local: Partial<ClipState> = {}) {
    const c = this.clip;
    if (!c) return;
    this.sendBridge({ type: 'clip', op, ...extra });
    this.clip = { ...c, ...local, at: performance.now() };
  }
  togglePlay() {
    if (this.clip) { if (this.playing || this.reverseTimer) this.shuttle(0); else this.shuttle(1); return; }
    const v = this.video;
    if (!v) return;
    if (v.paused && !this.reverseTimer) { v.playbackRate = 1; v.play(); } else this.shuttle(0);
  }
  pause() {
    if (this.clip) { this.shuttle(0); return; }
    this.video?.pause();
  }
  play() {
    if (this.clip) { this.clipCmd('play', { pos: this.position(), rate: 1 }, { state: 'playing', rate: 1, pos: this.position() }); return; }
    this.video?.play();
  }
  private reverseTimer: ReturnType<typeof setInterval> | null = null;
  /** Resolve J/K/L: dir 1 = forward (repeated: faster), -1 = reverse (repeated: faster), 0 = stop. */
  shuttle(dir: -1 | 0 | 1) {
    const reversing = this.reverseTimer !== null;
    if (this.reverseTimer) { clearInterval(this.reverseTimer); this.reverseTimer = null; }
    if (this.clip) {
      if (dir === 0) { this.reverseSpeed = 0; this.clipCmd('pause', { pos: this.position() }, { state: 'paused', pos: this.position() }); return; }
      if (dir === 1) {
        this.reverseSpeed = 0;
        const rate = this.playing && this.clip.rate >= 1 ? Math.min(8, this.clip.rate * 2) : 1;
        this.clipCmd('play', { pos: this.position(), rate }, { state: 'playing', rate, pos: this.position() });
        return;
      }
      // Reverse: ffmpeg decodes forwards only, so the page steps back itself. Each step is a new
      // decoder start – the pace is what the file allows, not a smooth ×1 (all-intra is quickest).
      this.reverseSpeed = reversing ? Math.min(8, this.reverseSpeed * 2) : 1;
      const back = () => {
        if (this.position() <= 0) { this.shuttle(0); return; }
        this.step(-this.reverseSpeed);
      };
      back();
      this.reverseTimer = setInterval(back, Math.max(100, this.frameDuration * 1000));
      return;
    }
    const v = this.video;
    if (!v) return;
    if (dir === 0) { v.pause(); v.playbackRate = 1; this.reverseSpeed = 0; return; }
    if (dir === 1) {
      this.reverseSpeed = 0;
      v.playbackRate = !v.paused && v.playbackRate >= 1 ? Math.min(8, v.playbackRate * 2) : 1;
      v.play();
      return;
    }
    v.pause(); v.playbackRate = 1;
    this.reverseSpeed = reversing ? Math.min(8, this.reverseSpeed * 2) : 1;
    const speed = this.reverseSpeed;
    this.reverseTimer = setInterval(() => {
      if (v.currentTime <= 0) { this.shuttle(0); return; }
      if (!v.seeking) this.seek(v.currentTime - this.frameDuration * speed);
    }, this.frameDuration * 1000);
  }
  reverseSpeed = 0;
  seek(t: number) {
    const to = Math.max(0, this.duration ? Math.min(this.duration, t) : t);
    if (this.clip) { this.clipCmd('seek', { pos: to }, { pos: to }); return; }
    const v = this.video;
    if (v) v.currentTime = to;
  }
  /** Step n frames (paused). Lands in the middle of the target frame to avoid rounding onto the neighbour. */
  step(n: number) {
    if (this.clip) {
      const f = this.frameDuration, pos = Math.max(0, (Math.floor(this.position() / f + 1e-6) + n + 0.5) * f);
      this.clipCmd('step', { frames: n }, { state: 'paused', pos: this.duration ? Math.min(this.duration, pos) : pos });
      return;
    }
    const v = this.video;
    if (!v) return;
    if (this.reverseTimer) this.shuttle(0);
    v.pause();
    const f = this.frameDuration, idx = Math.round(v.currentTime / f) + n;
    this.seek(idx * f + f / 2);
  }
  timecode(t = this.position()) {
    const fps = Math.max(1, Math.round(1 / this.frameDuration));
    const fr = Math.floor(t * fps + 1e-6), ff = fr % fps, s = Math.floor(fr / fps);
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}:${p2(ff)}`;
  }

  /** Read one pixel as normalised R'G'B' (cached per frame – DOM readback is slow). */
  readPixel(x: number, y: number): [number, number, number] | null {
    const key = `${this.frameSeq}:${Math.floor(x)}:${Math.floor(y)}`;
    if (this.probeCache.key === key) return this.probeCache.rgb;
    const rgb = this.readPixelNow(x, y);
    this.probeCache = { key, rgb };
    return rgb;
  }

  private readPixelNow(x: number, y: number): [number, number, number] | null {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    if (this.data) return this.decoder()(this.data, (y * this.width + x) * 4);
    if (this.element) {
      const c = this.scratch(1, 1);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(this.element, x, y, 1, 1, 0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0] / 255, d[1] / 255, d[2] / 255];
    }
    return null;
  }

  private scratch(w: number, h: number) {
    this.statsCanvas ??= document.createElement('canvas');
    if (this.statsCanvas.width !== w || this.statsCanvas.height !== h) { this.statsCanvas.width = w; this.statsCanvas.height = h; }
    return this.statsCanvas;
  }

  /** Where the last statistics came from and what they cost the main thread (ms, #16). */
  statsPerf: { path: 'cpu' | 'gpu'; ms: number } = { path: 'cpu', ms: 0 };
  private gpuStats: GpuStats | null | undefined;

  /**
   * Histogram and clipping statistics. Browser-decoded video (camera, capture, video
   * files) goes through the GPU (src/gpuStats.ts, full resolution, result one tick later);
   * bridge frames and still pictures on the CPU (subsampled, ~130 k samples).
   */
  updateStats(kr: number, kb: number) {
    const seqKey = `${this.frameSeq}:${this.activeRois().flat().join(',')}`;
    if (!this.ready) return;
    const t0 = performance.now();
    if (!this.data && this.videoEl && debugFlags().stats !== 'cpu') {
      if (this.gpuStats === undefined) this.gpuStats = GpuStats.create();
      const g = this.gpuStats;
      if (g) {
        const res = g.poll();
        if (res) { this.stats = res; this.lastFrame = null; this.statsVersion++; }
        let queued = true;
        if (!g.busy && this.statsSeq !== seqKey) {
          const rois = this.activeRois();
          queued = g.submit(this.element as TexImageSource, this.width, this.height, kr, kb, rois.length ? rois : null);
          if (queued) this.statsSeq = seqKey;
        }
        if (queued) {
          if (res || this.statsSeq === seqKey) this.statsPerf = { path: 'gpu', ms: performance.now() - t0 };
          return;
        }
      }
    }
    if (this.statsSeq === seqKey) return;
    this.statsSeq = seqKey;
    const f = this.readbackFrame();
    if (!f) return;
    const pq = this.transfer === 'pq';
    this.stats = computeStats(f.px, f.w, f.h, f.step, f.scale, kr, kb, f.roi, undefined, f.decode, pq ? pqDecode : undefined);
    const lk = `${this.id}:${this.transfer}:${this.url}`;
    if (lk !== this.lightKey) { this.lightKey = lk; this.resetLightLevel(); }
    if (pq && this.stats.cll && !f.roi) {
      const l = this.lightLevel;
      l.maxCll = Math.max(l.maxCll, this.stats.cll.max); l.maxFall = Math.max(l.maxFall, this.stats.cll.avg); l.frames++;
    }
    this.statsVersion++;
    this.statsPerf = { path: 'cpu', ms: performance.now() - t0 };
  }

  /** The current frame as CPU pixels (bridge data, or the shared cpuFrame() readback). */
  private readbackFrame() {
    if (!this.ready) return null;
    let px: Uint8Array | Uint8ClampedArray | Uint16Array, w: number, h: number, step: number, scale: number;
    if (this.data) {
      px = this.data; w = this.width; h = this.height; scale = this.depth === 16 ? 65535 : 255;
      step = Math.max(1, Math.round(Math.sqrt((w * h) / 130000)));
    } else {
      // shares the throttled cpuFrame() readback instead of a second GPU stall (#127)
      const f = this.cpuFrame();
      if (!f) return null;
      px = f.px as Uint8ClampedArray; w = f.w; h = f.h; scale = 255; step = Math.max(1, Math.round(w / 480));
    }
    // restrict to the region of interest, scaled to the analysed buffer
    const sx = w / this.width, sy = h / this.height;
    const rois = this.activeRois().map((r) => [Math.floor(r[0] * sx), Math.floor(r[1] * sy), Math.ceil(r[2] * sx), Math.ceil(r[3] * sy)] as [number, number, number, number]);
    const roi = rois.length ? rois : null;
    const decode = this.data ? this.decoder() : rgbDecoder(255);
    this.lastFrame = { px, w, h, step, scale, roi, decode };
    return this.lastFrame;
  }
}

/** @param light signal → cd/m² (PQ): adds the frame's content light level (Stats.cll) */
export function computeStats(px: ArrayLike<number>, w: number, h: number, step: number, scale: number, kr: number, kb: number, rois: [number, number, number, number] | [number, number, number, number][] | null = null, map?: (rgb: number[]) => number[], decode: Decode = rgbDecoder(scale), light?: (v: number) => number): Stats {
  // one rectangle or several (union); the bounding box limits the scan
  const list = !rois ? null : (typeof rois[0] === 'number' ? [rois as [number, number, number, number]] : rois as [number, number, number, number][]);
  const x0 = list ? Math.min(...list.map((r) => r[0])) : 0, y0 = list ? Math.min(...list.map((r) => r[1])) : 0;
  const x1 = list ? Math.max(...list.map((r) => r[2])) : w, y1 = list ? Math.max(...list.map((r) => r[3])) : h;
  const inside = (x: number, y: number) => !list || list.length === 1 || list.some((r) => x >= r[0] && y >= r[1] && x < r[2] && y < r[3]);
  const hist = [0, 1, 2, 3].map(() => new Float32Array(256));
  const kg = 1 - kr - kb;
  const lo = 0.5 / 255, hi = 254.5 / 255;
  const clipLow = [0, 0, 0], clipHigh = [0, 0, 0];
  let yMin = 1, yMax = 0, ySum = 0, n = 0, rS = 0, gS = 0, bS = 0, cllMax = 0, cllSum = 0;
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y += step) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x += step) {
      if (!inside(x, y)) continue;
      const i = (y * w + x) * 4;
      let [r, g, b] = decode(px, i);
      if (map) [r, g, b] = map([r, g, b]);
      const Y = kr * r + kg * g + kb * b;
      hist[0][Math.max(0, Math.min(255, (r * 255 + 0.5) | 0))]++;
      hist[1][Math.max(0, Math.min(255, (g * 255 + 0.5) | 0))]++;
      hist[2][Math.max(0, Math.min(255, (b * 255 + 0.5) | 0))]++;
      hist[3][Math.max(0, Math.min(255, (Y * 255 + 0.5) | 0))]++;
      if (r <= lo) clipLow[0]++; else if (r >= hi) clipHigh[0]++;
      if (g <= lo) clipLow[1]++; else if (g >= hi) clipHigh[1]++;
      if (b <= lo) clipLow[2]++; else if (b >= hi) clipHigh[2]++;
      if (Y < yMin) yMin = Y;
      if (Y > yMax) yMax = Y;
      ySum += Y; n++; rS += r; gS += g; bS += b;
      // signal clamped to 0…1: super-whites of unclipped Y′CbCr are not light above the PQ peak
      if (light) { const l = light(Math.min(1, Math.max(r, g, b, 0))); cllSum += l; if (l > cllMax) cllMax = l; }
    }
  }
  return {
    hist, yMin, yMax, yAvg: n ? ySum / n : 0, samples: n, rgbAvg: n ? [rS / n, gS / n, bS / n] : [0, 0, 0],
    clipLow: clipLow.map((c) => c / Math.max(1, n)), clipHigh: clipHigh.map((c) => c / Math.max(1, n)),
    ...(light ? { cll: { max: cllMax, avg: n ? cllSum / n : 0 } } : {}),
  };
}

/** Y′CbCr coding announced in a frame-protocol info message (format "yuv"). */
export function yuvOf(info: StreamInfo): YuvCoding | null {
  return info.format === 'yuv' ? { full: info.yuvRange === 'full', bits: info.bits ?? 10 } : null;
}

/** Output device and channel pair for listening to bridge sound (set from the UI). */
export const monitorSink = { id: '', pair: 0 };

