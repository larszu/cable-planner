// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Generator: runs ToneGenerator (dsp/signals.ts) sample-accurately in the audio thread.
// processorOptions: {channels} (2, 6 or 8). Messages in: {cfg}, {av: {frame0, period}},
// {loopback: bool}. Messages out (loop-back): {chs, n} blocks of 2048 frames of exactly
// what goes to the output.

/// <reference path="./env.d.ts" />

import { ToneGenerator, type GenConfig } from '../dsp/signals';

const BLOCK = 2048;

class GeneratorProcessor extends AudioWorkletProcessor {
  private gen: ToneGenerator;
  private loopback = false;
  private buf: Float32Array[];
  private fill = 0;

  constructor(options?: unknown) {
    super();
    const channels = Math.max(1, Math.min(32, Number((options as { processorOptions?: { channels?: number } } | undefined)?.processorOptions?.channels) || 2));
    this.gen = new ToneGenerator(sampleRate, channels);
    this.buf = Array.from({ length: channels }, () => new Float32Array(BLOCK));
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data as { cfg?: GenConfig; av?: { frame0: number; period: number }; loopback?: boolean };
      if (m.cfg) this.gen.set(m.cfg);
      if (m.av) { this.gen.avFrame0 = m.av.frame0; this.gen.avPeriod = m.av.period; }
      if (m.loopback !== undefined) { this.loopback = m.loopback; this.fill = 0; }
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const n = out[0].length, ch = this.gen.channels;
    const chs = Array.from({ length: ch }, (_, c) => out[c] ?? new Float32Array(n));
    this.gen.render(chs, n, currentFrame);
    if (this.loopback) {
      let off = 0;
      while (off < n) {
        const take = Math.min(n - off, BLOCK - this.fill);
        for (let c = 0; c < ch; c++) this.buf[c].set(chs[c].subarray(off, off + take), this.fill);
        this.fill += take; off += take;
        if (this.fill === BLOCK) {
          const copy = this.buf.map((b) => b.slice());
          this.port.postMessage({ chs: copy, n: BLOCK, rate: sampleRate }, copy.map((c) => c.buffer));
          this.fill = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('lz-generator', GeneratorProcessor);
