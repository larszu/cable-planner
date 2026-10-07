// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Playback of a foreign-clock stream (bridge PCM) through a drift-compensated ring buffer
// (dsp/driftbuffer.ts). Generic: any producer that posts sample blocks can use it.
// Messages in:  {init: {channels, targetMs}} · {pcm: Float32Array (interleaved), channels} ·
//               {planar: Float32Array[], n} · {map: number[] | null} · {reset: true}
// Messages out: {stats: DriftStats} about twice a second.

/// <reference path="./env.d.ts" />

import { DriftBuffer } from '../dsp/driftbuffer';

class PlaybackProcessor extends AudioWorkletProcessor {
  private buf: DriftBuffer | null = null;
  private frames = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data as { init?: { channels: number; targetMs?: number }; pcm?: Float32Array; channels?: number; planar?: Float32Array[]; n?: number; map?: number[] | null; reset?: boolean };
      if (m.init) this.buf = new DriftBuffer(m.init.channels, sampleRate, m.init.targetMs ?? 120);
      if (!this.buf) return;
      if (m.pcm) this.buf.pushInterleaved(m.pcm, m.channels ?? this.buf.channels);
      if (m.planar) this.buf.push(m.planar, m.n ?? m.planar[0]?.length ?? 0);
      if (m.map !== undefined) this.buf.map = m.map;
      if (m.reset) this.buf = new DriftBuffer(this.buf.channels, sampleRate);
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const n = out[0].length;
    if (!this.buf) { for (const o of out) o.fill(0); return true; }
    this.buf.pull(out, n);
    this.frames += n;
    if (this.frames >= sampleRate / 2) { this.frames = 0; this.port.postMessage({ stats: this.buf.stats() }); }
    return true;
  }
}

registerProcessor('lz-playback', PlaybackProcessor);
