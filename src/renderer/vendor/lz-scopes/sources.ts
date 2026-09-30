import { LUMA, detectColorspace, detectTransfer, isLog, transferSignalled, type Colorspace, type GamutId, type Transfer } from './color';
import { LOG_CURVES } from './camera';
import type { ChainSettings, Compiled } from './chain';
import { patternById, renderPattern } from './patterns';
import { AudioAnalysis } from './audio/analysis';
import { AudioTap, generator, measurementConstraints } from './audio/io';

export type SourceKind = 'stream' | 'webcam' | 'screen' | 'file' | 'pattern' | 'folder' | 'audio';

/** Input of an audio-only source. */
export interface AudioInput { mode: 'device' | 'file' | 'generator'; deviceId: string }

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
  transport: 'tcp' | 'udp';
  /** bridge streams: request the sound as well (protocol 2) */
  audio?: boolean;
}

export interface StreamInfo {
  width: number; height: number; sourceWidth: number; sourceHeight: number; depth: 8 | 16; fps: number;
  codec?: string; pixFmt?: string; decodeMatrix?: string; transfer?: string; primaries?: string; matrix?: string; range?: string;
  /** protocol 2 (audio=1): header on every binary message */
  proto?: number;
  audio?: AudioStreamInfo | null;
}

export interface Stats {
  hist: Float32Array[]; // R, G, B, Y — 256 bins each
  yMin: number; yMax: number; yAvg: number;
  /** mean R'G'B' (signal) of the analysed area */
  rgbAvg: [number, number, number];
  clipLow: number[]; clipHigh: number[]; // fraction per R, G, B
  samples: number;
}

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
  width = 0;
  height = 0;
  depth: 8 | 16 = 8;
  /** Latest raw frame (bridge streams). */
  data: Uint8Array | Uint16Array | null = null;
  /** Browser-decoded media (webcam, screen, files). */
  element: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null = null;
  /** Test pattern state (kind 'pattern'). */
  pattern = { id: 'smpte75', width: 1920, height: 1080, label: '' };
  frameSeq = 0;
  fps = 0;
  dropped = 0;
  frozen = false;
  stats: Stats | null = null;
  statsVersion = 0;
  /** Sound of this source (bridge PCM, video file, audio device, generator); null = none. */
  audio: AudioAnalysis | null = null;
  audioIn: AudioInput = { mode: 'device', deviceId: '' };
  /** audio file playing in an audio source (mode 'file') */
  audioEl: HTMLAudioElement | null = null;
  private audioTap: AudioTap | null = null;
  private lastFrame: { px: ArrayLike<number>; w: number; h: number; step: number; scale: number; roi: [number, number, number, number][] | null } | null = null;
  private stageCache = new Map<string, { key: string; stats: Stats }>();

  /** Statistics of the last analysed frame after the processing chain (stage views, chain.ts). */
  stageStats(c: Compiled): Stats | null {
    const f = this.lastFrame;
    if (!f) return this.stats;
    const key = `${this.statsVersion}:${c.sig}`;
    const hit = this.stageCache.get(c.stage);
    if (hit?.key === key) return hit.stats;
    const { kr, kb } = LUMA[c.view.colorspace];
    const stats = computeStats(f.px, f.w, f.h, f.step, f.scale, kr, kb, f.roi, c.apply);
    this.stageCache.set(c.stage, { key, stats });
    return stats;
  }

  /**
   * Luma range of the skin-tone pixels inside the ROI (whole frame without ROI):
   * 5th and 95th percentile – used to set the skin target range from a face.
   */
  skinLumaRange(kr: number, kb: number, tolDeg: number): { lo: number; hi: number; n: number } | null {
    const f = this.lastFrame;
    if (!f) return null;
    const kg = 1 - kr - kb;
    const sx = f.w / this.width, sy = f.h / this.height;
    const rects = this.activeRois().length ? this.activeRois().map((r) => [r[0] * sx, r[1] * sy, r[2] * sx, r[3] * sy]) : [[0, 0, f.w, f.h]];
    const ys: number[] = [];
    for (const [x0, y0, x1, y1] of rects) for (let y = Math.floor(y0); y < Math.min(f.h, y1); y += f.step) {
      for (let x = Math.floor(x0); x < Math.min(f.w, x1); x += f.step) {
        const i = (y * f.w + x) * 4;
        const r = f.px[i] / f.scale, g = f.px[i + 1] / f.scale, b = f.px[i + 2] / f.scale;
        const Y = kr * r + kg * g + kb * b, cb = (b - Y) / (2 * (1 - kb)), cr = (r - Y) / (2 * (1 - kr));
        const ang = (Math.atan2(cr, cb) * 180) / Math.PI;
        if (Math.hypot(cb, cr) > 0.012 && Math.abs(ang - 123) <= tolDeg) ys.push(Y);
      }
    }
    if (ys.length < 20) return null;
    ys.sort((a, b) => a - b);
    return { lo: ys[Math.floor(ys.length * 0.05)], hi: ys[Math.floor(ys.length * 0.95)], n: ys.length };
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
  private probeCache = { key: '', rgb: null as [number, number, number] | null };
  onChange: () => void = () => {};

  private ws: WebSocket | null = null;
  private patternTimer: ReturnType<typeof setInterval> | null = null;
  private media: MediaStream | null = null;
  private objectUrl: string | null = null;
  private frameTimes: number[] = [];
  private statsCanvas: HTMLCanvasElement | null = null;
  private statsSeq = '';

  constructor(kind: SourceKind, name?: string, settings?: Partial<SourceSettings>) {
    this.id = `s${nextId++}`;
    this.kind = kind;
    this.name = name ?? { stream: 'Stream', webcam: 'Kamera', screen: 'Bildschirm/Fenster', file: 'Datei', pattern: 'Testbild', folder: 'Ordner', audio: 'Audio' }[kind];
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
  }

  get transfer(): Transfer {
    if (this.settings.transfer !== 'auto') return this.settings.transfer;
    if (this.kind === 'pattern') return patternById(this.pattern.id).transfer ?? 'sdr';
    return detectTransfer(this.info?.transfer);
  }
  /** Where the transfer comes from – shown next to "auto" so the UI never pretends to know. */
  get transferOrigin(): string {
    if (this.settings.transfer !== 'auto') return 'manuell';
    if (this.kind === 'pattern') return 'Testbild';
    if (!this.info) return 'keine Metadaten, Annahme';
    return transferSignalled(this.info.transfer) ? 'Metadaten' : 'nicht signalisiert, Annahme';
  }
  get colorspaceOrigin(): string {
    if (this.settings.colorspace !== 'auto') return 'manuell';
    if (!this.info) return this.kind === 'pattern' ? 'Testbild' : 'keine Metadaten, Annahme nach Bildhöhe';
    const m = this.info.matrix, p = this.info.primaries;
    return (m && m !== 'unknown') || (p && p !== 'unknown') ? 'Metadaten' : 'nicht signalisiert, Annahme nach Bildhöhe';
  }
  get colorspace(): Colorspace {
    if (this.settings.colorspace !== 'auto') return this.settings.colorspace;
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
    this.status = status; this.message = message; this.onChange();
  }

  private tick() {
    const now = performance.now();
    this.frameTimes.push(now);
    while (this.frameTimes.length && now - this.frameTimes[0] > 1000) this.frameTimes.shift();
    this.fps = this.frameTimes.length;
    if (!this.frozen) this.frameSeq++;
  }

  connectStream(url: string, bridge: string) {
    this.stop();
    this.url = url;
    this.set('connecting', 'Verbinde …');
    const { width, fps, depth, transport } = this.settings;
    const q = new URLSearchParams({ url, width: String(width), fps: String(fps), depth: String(depth), transport });
    if (this.settings.audio !== false) q.set('audio', '1');
    this.connectFrames(`${bridge}/stream?${q}`, false);
  }

  /**
   * Connect to any endpoint speaking the LZ Scopes frame protocol (docs/frame-protocol.md),
   * e.g. a host bridge that keeps the camera address to itself: `ws://host/scope/3`.
   */
  connectFrames(wsUrl: string, reset = true) {
    if (reset) { this.stop(); this.url = wsUrl; this.set('connecting', 'Verbinde …'); }
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'info') {
          this.info = msg; this.width = msg.width; this.height = msg.height; this.depth = msg.depth;
          const a = msg.audio as AudioStreamInfo | null | undefined;
          this.audio = a ? new AudioAnalysis(a.sampleRate, a.channels, a.layout) : null;
          if (this.audio && a) this.audio.label = `Bridge · ${a.codec ?? ''} ${a.sampleRate / 1000} kHz`.replace('  ', ' ');
          const pic = msg.width ? `${msg.sourceWidth}×${msg.sourceHeight} ${msg.codec ?? ''}`.trim() : 'nur Ton';
          this.set('live', a ? `${pic} · Ton ${a.codec ?? ''} ${a.sampleRate / 1000} kHz ${a.channels} Kan.` : msg.proto === 2 ? `${pic} · kein Ton` : pic);
        } else if (msg.type === 'stats') {
          this.dropped = msg.dropped;
          if (msg.message) this.set(this.status === 'live' ? 'live' : 'connecting', msg.message);
        } else if (msg.type === 'error' || msg.type === 'end') {
          this.set(msg.type === 'end' ? 'ended' : 'error', msg.message);
        }
        return;
      }
      const buf = ev.data as ArrayBuffer;
      if (this.info?.proto === 2) {
        // 16-byte header: 'LZV1' | 'LZA1', uint32, float64 (docs/frame-protocol.md)
        const head = new DataView(buf, 0, 16);
        const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
        if (magic === 'LZA1') {
          // audio keeps running while frozen: loudness must not have gaps
          const n = head.getUint32(4, true), first = head.getFloat64(8, true);
          if (this.audio) this.audio.pushInterleaved(new Float32Array(buf, 16, n * this.audio.channels), first);
          return;
        }
        if (this.frozen || magic !== 'LZV1') return;
        this.data = this.depth === 16 ? new Uint16Array(buf, 16) : new Uint8Array(buf, 16);
        this.tick();
        return;
      }
      if (this.frozen) return;
      this.data = this.depth === 16 ? new Uint16Array(buf) : new Uint8Array(buf);
      this.tick();
    };
    ws.onerror = () => this.set('error', 'Bridge nicht erreichbar – läuft `npm run dev` bzw. `npm start`?');
    ws.onclose = () => { if (this.ws === ws && this.status === 'live') this.set('ended', 'Verbindung beendet'); };
  }

  /**
   * Feed frames without a WebSocket, e.g. from an Electron main process over a
   * MessagePort. `info` once (or on change), then one call per frame.
   */
  pushInfo(info: StreamInfo) {
    this.info = info; this.width = info.width; this.height = info.height; this.depth = info.depth;
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
    if (!picker) { this.set('error', 'Ordner-Überwachung braucht Chrome, Edge oder die Desktop-App'); return; }
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
      if (!newest) { this.set('live', `${dir.name}: noch kein Bild (JPG/PNG/WebP/AVIF)`); return; }
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
    this.set('connecting', 'Warte auf Freigabe …');
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
      track.addEventListener('ended', () => this.set('ended', 'Aufnahme beendet'));
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
      this.set('live', `${this.width}×${this.height} Bild`);
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
      this.set('error', `Nicht abspielbar: ${(e as Error).message}`);
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
    this.tick();
    this.set('live', `${def.name} · ${width}×${height}`);
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
    const tap = await AudioTap.fromElement(el, (chs, n, rate) => this.feed(chs, n, rate, `Datei · ${rate / 1000} kHz`));
    this.audioTap = tap;
    el.addEventListener('play', () => tap.resume());
  }

  get monitoring() { return this.audioTap?.monitoring ?? false; }
  setMonitor(on: boolean) { this.audioTap?.setMonitor(on); this.onChange(); }
  get canMonitor() { return !!this.audioTap; }

  /** Audio-only source: audio device, audio file or the generator loop-back. */
  async startAudio(file?: File) {
    this.stop();
    const inp = this.audioIn;
    try {
      if (inp.mode === 'generator') {
        generator.setLoopback((chs, n, rate) => this.feed(chs, n, rate, `Generator · ${rate / 1000} kHz`));
        this.generatorBound = true;
        this.set('live', generator.running ? 'Generator (Rückweg)' : 'Generator (Rückweg) – Generator starten');
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
      this.set('connecting', 'Warte auf Freigabe …');
      this.media = await navigator.mediaDevices.getUserMedia({ audio: measurementConstraints(inp.deviceId || undefined), video: false });
      const track = this.media.getAudioTracks()[0];
      const st = track.getSettings();
      const tap = await AudioTap.fromStream(this.media, (chs, n, rate) => this.feed(chs, n, rate, `${track.label} · ${rate / 1000} kHz`));
      this.audioTap = tap;
      track.addEventListener('ended', () => this.set('ended', 'Gerät getrennt'));
      const off = [st.echoCancellation, st.noiseSuppression, st.autoGainControl].some((x) => x === true) ? ' · Achtung: Browser-Regelung aktiv' : '';
      this.set('live', `${track.label || 'Audiogerät'} · ${tap.ctx.sampleRate / 1000} kHz${st.channelCount ? ` · ${st.channelCount} Kan.` : ''}${off}`);
    } catch (e) {
      this.set('error', (e as Error).message);
    }
  }
  private generatorBound = false;

  get video(): HTMLVideoElement | null {
    return this.videoEl;
  }

  stop() {
    if (this.folderTimer) { clearInterval(this.folderTimer); this.folderTimer = null; }
    if (this.reverseTimer) { clearInterval(this.reverseTimer); this.reverseTimer = null; }
    if (this.patternTimer) { clearInterval(this.patternTimer); this.patternTimer = null; }
    if (this.ws) { const ws = this.ws; this.ws = null; ws.onclose = null; ws.close(); }
    this.media?.getTracks().forEach((t) => t.stop());
    this.media = null;
    this.audioTap?.close(); this.audioTap = null;
    if (this.audioEl) { this.audioEl.pause(); this.audioEl.removeAttribute('src'); this.audioEl = null; }
    if (this.generatorBound) { generator.setLoopback(null); this.generatorBound = false; }
    this.audio = null;
    if (this.videoEl) { this.videoEl.pause(); this.videoEl.srcObject = null; this.videoEl = null; }
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
    this.element = null; this.data = null; this.info = null; this.width = 0; this.height = 0; this.stats = null;
    this.fps = 0; this.dropped = 0;
    if (this.status !== 'idle') this.set('idle');
  }

  // ---- transport (video files), Resolve-style
  get isVideoFile() { return this.kind === 'file' && this.video !== null; }
  togglePlay() { const v = this.video; if (!v) return; if (v.paused && !this.reverseTimer) { v.playbackRate = 1; v.play(); } else this.shuttle(0); }
  pause() { this.video?.pause(); }
  play() { this.video?.play(); }
  private reverseTimer: ReturnType<typeof setInterval> | null = null;
  /** Resolve J/K/L: dir 1 = forward (repeated: faster), -1 = reverse (repeated: faster), 0 = stop. */
  shuttle(dir: -1 | 0 | 1) {
    const v = this.video;
    if (!v) return;
    const reversing = this.reverseTimer !== null;
    if (this.reverseTimer) { clearInterval(this.reverseTimer); this.reverseTimer = null; }
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
  seek(t: number) { const v = this.video; if (v) v.currentTime = Math.max(0, Math.min(v.duration || 0, t)); }
  /** Step n frames (paused). Lands in the middle of the target frame to avoid rounding onto the neighbour. */
  step(n: number) {
    const v = this.video;
    if (!v) return;
    if (this.reverseTimer) this.shuttle(0);
    v.pause();
    const f = this.frameDuration, idx = Math.round(v.currentTime / f) + n;
    this.seek(idx * f + f / 2);
  }
  timecode(t = this.video?.currentTime ?? 0) {
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
    if (this.data) {
      const i = (y * this.width + x) * 4, s = this.depth === 16 ? 65535 : 255;
      return [this.data[i] / s, this.data[i + 1] / s, this.data[i + 2] / s];
    }
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

  /** Histogram and clipping statistics on a subsampled frame (CPU, ~130 k samples). */
  updateStats(kr: number, kb: number) {
    const seqKey = `${this.frameSeq}:${this.activeRois().flat().join(',')}`;
    if (!this.ready || this.statsSeq === seqKey) return;
    this.statsSeq = seqKey;
    let px: Uint8Array | Uint8ClampedArray | Uint16Array, w: number, h: number, step: number, scale: number;
    if (this.data) {
      px = this.data; w = this.width; h = this.height; scale = this.depth === 16 ? 65535 : 255;
      step = Math.max(1, Math.round(Math.sqrt((w * h) / 130000)));
    } else {
      w = Math.min(480, this.width); h = Math.max(1, Math.round((this.height * w) / this.width));
      const c = this.scratch(w, h), ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(this.element!, 0, 0, w, h);
      px = ctx.getImageData(0, 0, w, h).data; scale = 255; step = 1;
    }
    // restrict to the region of interest, scaled to the analysed buffer
    const sx = w / this.width, sy = h / this.height;
    const rois = this.activeRois().map((r) => [Math.floor(r[0] * sx), Math.floor(r[1] * sy), Math.ceil(r[2] * sx), Math.ceil(r[3] * sy)] as [number, number, number, number]);
    const roi = rois.length ? rois : null;
    this.lastFrame = { px, w, h, step, scale, roi };
    this.stats = computeStats(px, w, h, step, scale, kr, kb, roi);
    this.statsVersion++;
  }
}

export function computeStats(px: ArrayLike<number>, w: number, h: number, step: number, scale: number, kr: number, kb: number, rois: [number, number, number, number] | [number, number, number, number][] | null = null, map?: (rgb: number[]) => number[]): Stats {
  // one rectangle or several (union); the bounding box limits the scan
  const list = !rois ? null : (typeof rois[0] === 'number' ? [rois as [number, number, number, number]] : rois as [number, number, number, number][]);
  const x0 = list ? Math.min(...list.map((r) => r[0])) : 0, y0 = list ? Math.min(...list.map((r) => r[1])) : 0;
  const x1 = list ? Math.max(...list.map((r) => r[2])) : w, y1 = list ? Math.max(...list.map((r) => r[3])) : h;
  const inside = (x: number, y: number) => !list || list.length === 1 || list.some((r) => x >= r[0] && y >= r[1] && x < r[2] && y < r[3]);
  const hist = [0, 1, 2, 3].map(() => new Float32Array(256));
  const kg = 1 - kr - kb;
  const lo = 0.5 / 255, hi = 254.5 / 255;
  const clipLow = [0, 0, 0], clipHigh = [0, 0, 0];
  let yMin = 1, yMax = 0, ySum = 0, n = 0, rS = 0, gS = 0, bS = 0;
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y += step) {
    for (let x = Math.max(0, x0); x < Math.min(w, x1); x += step) {
      if (!inside(x, y)) continue;
      const i = (y * w + x) * 4;
      let r = px[i] / scale, g = px[i + 1] / scale, b = px[i + 2] / scale;
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
    }
  }
  return {
    hist, yMin, yMax, yAvg: n ? ySum / n : 0, samples: n, rgbAvg: n ? [rS / n, gS / n, bS / n] : [0, 0, 0],
    clipLow: clipLow.map((c) => c / Math.max(1, n)), clipHigh: clipHigh.map((c) => c / Math.max(1, n)),
  };
}
