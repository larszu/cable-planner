// Generator: runs ToneGenerator (dsp/signals.ts) sample-accurately in the audio thread.
// Messages in: {cfg}, {av: {frame0, period}}, {loopback: bool}. Messages out (loop-back):
// {chs, n} blocks of 2048 frames of exactly what goes to the output.

/// <reference path="./env.d.ts" />

import { ToneGenerator, type GenConfig } from '../dsp/signals';

const BLOCK = 2048;

class GeneratorProcessor extends AudioWorkletProcessor {
  private gen = new ToneGenerator(sampleRate, 2);
  private loopback = false;
  private buf = [new Float32Array(BLOCK), new Float32Array(BLOCK)];
  private fill = 0;

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent) => {
      const m = e.data as { cfg?: GenConfig; av?: { frame0: number; period: number }; loopback?: boolean };
      if (m.cfg) this.gen.set(m.cfg);
      if (m.av) { this.gen.avFrame0 = m.av.frame0; this.gen.avPeriod = m.av.period; }
      if (m.loopback !== undefined) { this.loopback = m.loopback; this.fill = 0; }
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const n = out[0].length;
    const L = out[0], R = out[1] ?? new Float32Array(n);
    this.gen.render([L, R], n, currentFrame);
    if (this.loopback) {
      let off = 0;
      while (off < n) {
        const take = Math.min(n - off, BLOCK - this.fill);
        this.buf[0].set(L.subarray(off, off + take), this.fill);
        this.buf[1].set(R.subarray(off, off + take), this.fill);
        this.fill += take; off += take;
        if (this.fill === BLOCK) {
          const chs = this.buf.map((b) => b.slice());
          this.port.postMessage({ chs, n: BLOCK, rate: sampleRate }, chs.map((c) => c.buffer));
          this.fill = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('lz-generator', GeneratorProcessor);
