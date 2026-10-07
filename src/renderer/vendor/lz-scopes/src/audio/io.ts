// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Browser audio I/O: capture taps (audio device, media element) and the tone generator.
// Both run AudioWorklets; the samples go to an AudioAnalysis on the main thread.

import captureUrl from './worklet/capture.worklet.ts?worker&url';
import generatorUrl from './worklet/generator.worklet.ts?worker&url';
import playbackUrl from './worklet/playback.worklet.ts?worker&url';
import { DEFAULT_GEN, type GenConfig } from './dsp/signals';
import type { DriftStats } from './dsp/driftbuffer';

type SinkCtx = AudioContext & { setSinkId?: (id: string) => Promise<void> };

type OnData = (chs: Float32Array[], n: number, rate: number) => void;

/** Measurement constraints: no echo cancellation, noise suppression or AGC (audio.md e.2). */
export function measurementConstraints(deviceId?: string): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    channelCount: { ideal: 2 },
  };
}

export async function listDevices(kind: 'audioinput' | 'audiooutput') {
  try { return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === kind); } catch { return []; }
}

/** AudioContext + capture worklet on a source node. */
export class AudioTap {
  readonly ctx: AudioContext;
  private node: AudioWorkletNode | null = null;
  private src: AudioNode | null = null;
  private monitorGain: GainNode;
  private sink: GainNode;
  constructor(sampleRate?: number) {
    this.ctx = new AudioContext(sampleRate ? { sampleRate, latencyHint: 'interactive' } : { latencyHint: 'interactive' });
    this.monitorGain = this.ctx.createGain(); this.monitorGain.gain.value = 0; this.monitorGain.connect(this.ctx.destination);
    // The worklet needs a path to the destination to be pulled; the path is silent.
    this.sink = this.ctx.createGain(); this.sink.gain.value = 0; this.sink.connect(this.ctx.destination);
  }

  static async fromStream(stream: MediaStream, onData: OnData) {
    const rate = stream.getAudioTracks()[0]?.getSettings().sampleRate;
    const tap = new AudioTap(rate || undefined);
    await tap.attach(tap.ctx.createMediaStreamSource(stream), onData);
    return tap;
  }

  /** The element is re-routed into the graph; it is audible only with `monitor`. */
  static async fromElement(el: HTMLMediaElement, onData: OnData) {
    const tap = new AudioTap();
    el.muted = false;
    await tap.attach(tap.ctx.createMediaElementSource(el), onData);
    return tap;
  }

  private async attach(src: AudioNode, onData: OnData) {
    await this.ctx.audioWorklet.addModule(captureUrl);
    const node = new AudioWorkletNode(this.ctx, 'lz-capture', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      channelCountMode: 'max', channelInterpretation: 'discrete',
    });
    node.port.onmessage = (e) => onData(e.data.chs, e.data.n, e.data.rate);
    src.connect(node); node.connect(this.sink);
    src.connect(this.monitorGain);
    this.src = src; this.node = node;
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  get monitoring() { return this.monitorGain.gain.value > 0; }
  setMonitor(on: boolean) { this.monitorGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.01); }
  resume() { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); }

  close() {
    this.node?.port.close();
    this.src?.disconnect(); this.node?.disconnect();
    this.ctx.close().catch(() => {});
  }
}

/** Tone generator on its own AudioContext, output device selectable (setSinkId). */
export class GeneratorEngine {
  ctx: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  cfg: GenConfig = structuredClone(DEFAULT_GEN);
  sinkId = '';
  /** receives exactly what is played (for the “Generator” audio source) */
  loopback: OnData | null = null;
  private avTimer = 0;
  onState: () => void = () => {};
  error = '';

  get running() { return !!this.ctx && this.cfg.running; }
  get sampleRate() { return this.ctx?.sampleRate ?? 0; }
  get latencyMs() { return this.ctx ? Math.round(((this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0)) * 1000) : 0; }
  /** Latency values the browser reports (Web Audio API 1.1), in ms; null before start. */
  get latency() {
    const c = this.ctx;
    return c ? { base: (c.baseLatency || 0) * 1000, output: (c.outputLatency || 0) * 1000, maxChannels: c.destination.maxChannelCount } : null;
  }
  /** channels of the running node */
  private nodeChannels = 0;

  private async ensure() {
    const want = Math.max(1, this.cfg.channels ?? 2);
    if (this.ctx && this.nodeChannels === want) return;
    if (this.ctx && this.node) { this.node.disconnect(); this.node.port.close(); this.node = null; }
    const ctx = this.ctx ?? new AudioContext({ latencyHint: 'interactive' });
    if (!this.ctx) await ctx.audioWorklet.addModule(generatorUrl);
    this.ctx = ctx;
    const max = ctx.destination.maxChannelCount;
    if (want > max) throw new Error(`Ausgang meldet nur ${max} Kanäle (destination.maxChannelCount) – ${want} Kanäle nicht möglich`);
    ctx.destination.channelCount = want;
    ctx.destination.channelCountMode = 'explicit';
    ctx.destination.channelInterpretation = 'discrete';
    const node = new AudioWorkletNode(ctx, 'lz-generator', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [want], processorOptions: { channels: want } });
    node.channelInterpretation = 'discrete';
    node.connect(ctx.destination);
    node.port.onmessage = (e) => this.loopback?.(e.data.chs, e.data.n, e.data.rate);
    this.node = node; this.nodeChannels = want;
    if (this.sinkId) await this.setSink(this.sinkId);
    node.port.postMessage({ loopback: !!this.loopback });
  }

  async update(cfg: Partial<GenConfig>) {
    Object.assign(this.cfg, cfg);
    if (this.cfg.running) {
      try { await this.ensure(); } catch (e) { this.error = (e as Error).message; this.cfg.running = false; this.onState(); return; }
      await this.ctx!.resume();
      this.error = '';
    }
    this.node?.port.postMessage({ cfg: this.cfg });
    this.syncAv();
    this.onState();
  }

  start() { return this.update({ running: true }); }
  stop() { return this.update({ running: false }); }

  setLoopback(fn: OnData | null) {
    this.loopback = fn;
    this.node?.port.postMessage({ loopback: !!fn });
  }

  async setSink(id: string) {
    this.sinkId = id;
    const ctx = this.ctx as SinkCtx | null;
    if (!ctx) return;
    if (!ctx.setSinkId) { this.error = 'Ausgabegerät wählen kann dieser Browser nicht (AudioContext.setSinkId)'; this.onState(); return; }
    try { await ctx.setSinkId(id); this.error = ''; } catch (e) { this.error = (e as Error).message; }
    this.onState();
  }

  /**
   * A/V sync: the beep must leave the output at every whole second of the shared clock
   * (performance.timeOrigin + performance.now(), the same in every window), where the
   * test pattern “A/V-Sync” flashes. getOutputTimestamp maps context time to that clock
   * including the output latency; re-synced every second against drift.
   */
  private syncAv() {
    clearInterval(this.avTimer);
    if (!this.ctx || this.cfg.signal !== 'avsync' || !this.cfg.running) return;
    const tick = () => {
      const ctx = this.ctx, node = this.node;
      if (!ctx || !node) return;
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime === undefined || ts.performanceTime === undefined || !ts.performanceTime) return;
      // the beep stays on the whole second; the calibration (avcal.ts) shifts only the picture
      const epochNow = performance.timeOrigin + ts.performanceTime;
      const next = Math.ceil(epochNow / 1000) * 1000;
      const ctxAt = ts.contextTime + (next - epochNow) / 1000;
      node.port.postMessage({ av: { frame0: Math.round(ctxAt * ctx.sampleRate), period: ctx.sampleRate } });
    };
    tick();
    this.avTimer = window.setInterval(tick, 1000);
  }
}

export const generator = new GeneratorEngine();

/**
 * Listening to a stream with its own clock (bridge PCM): AudioContext at the stream's
 * rate, drift-compensated ring buffer in an AudioWorklet (dsp/driftbuffer.ts), output
 * device via setSinkId. Only for monitoring – the measurement uses the raw samples.
 */
export class StreamMonitor {
  readonly ctx: AudioContext;
  private node: AudioWorkletNode | null = null;
  private gain: GainNode;
  readonly channels: number;
  stats: DriftStats | null = null;
  error = '';
  pair = 0;
  onStats: () => void = () => {};

  private constructor(fs: number, channels: number) {
    this.channels = channels;
    // the stream's own rate; the browser converts to the device rate if they differ
    this.ctx = new AudioContext({ sampleRate: fs, latencyHint: 'playback' });
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
  }

  static async create(fs: number, channels: number, sinkId = '') {
    const m = new StreamMonitor(fs, channels);
    await m.ctx.audioWorklet.addModule(playbackUrl);
    const node = new AudioWorkletNode(m.ctx, 'lz-playback', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
    node.port.onmessage = (e) => { if (e.data.stats) { m.stats = e.data.stats; m.onStats(); } };
    node.port.postMessage({ init: { channels, targetMs: 120 } });
    node.connect(m.gain);
    m.node = node;
    if (sinkId) await m.setSink(sinkId);
    if (m.ctx.state !== 'running') await m.ctx.resume().catch(() => {});
    return m;
  }

  /** Interleaved f32 as it comes from the bridge (copied, the caller keeps its buffer). */
  push(interleaved: Float32Array) {
    const copy = interleaved.slice();
    this.node?.port.postMessage({ pcm: copy, channels: this.channels }, [copy.buffer]);
  }

  /** Which channel pair to listen to (0 = channels 1/2, 1 = 3/4, …). Mono sources go to both sides. */
  setPair(pair: number) {
    this.pair = pair;
    const a = Math.min(this.channels - 1, pair * 2), b = Math.min(this.channels - 1, pair * 2 + 1);
    this.node?.port.postMessage({ map: [a, b] });
  }

  async setSink(id: string) {
    const ctx = this.ctx as SinkCtx;
    if (!ctx.setSinkId) { this.error = 'Ausgabegerät wählen kann dieser Browser nicht (AudioContext.setSinkId)'; return; }
    try { await ctx.setSinkId(id); this.error = ''; } catch (e) { this.error = (e as Error).message; }
  }

  get latencyMs() { return Math.round(((this.ctx.baseLatency || 0) + (this.ctx.outputLatency || 0)) * 1000); }

  close() {
    this.node?.port.close(); this.node?.disconnect();
    this.ctx.close().catch(() => {});
  }
}
