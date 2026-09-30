// Capture tap: forwards every input sample to the main thread in blocks of 2048 frames
// (planar Float32Arrays, transferred). The DSP runs on the main thread on the same code
// path as bridge PCM, so all sources measure identically.

/// <reference path="./env.d.ts" />

const BLOCK = 2048;

class CaptureProcessor extends AudioWorkletProcessor {
  private buf: Float32Array[] = [];
  private fill = 0;
  private channels = 0;

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true; // not connected yet or silence without channels
    if (input.length !== this.channels) { this.flush(); this.channels = input.length; this.buf = input.map(() => new Float32Array(BLOCK)); this.fill = 0; }
    const n = input[0].length;
    let off = 0;
    while (off < n) {
      const take = Math.min(n - off, BLOCK - this.fill);
      for (let c = 0; c < this.channels; c++) this.buf[c].set(input[c].subarray(off, off + take), this.fill);
      this.fill += take; off += take;
      if (this.fill === BLOCK) this.flush();
    }
    return true;
  }

  private flush() {
    if (!this.fill || !this.channels) return;
    const chs = this.buf.map((b) => b.slice(0, this.fill));
    this.port.postMessage({ chs, n: this.fill, rate: sampleRate }, chs.map((c) => c.buffer));
    this.fill = 0;
  }
}

registerProcessor('lz-capture', CaptureProcessor);
