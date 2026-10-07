// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Histogram and clip statistics on the GPU (#16), for pictures the browser decodes itself
// (camera, screen/window capture, video files). The CPU path has to draw such a <video>
// into a canvas and read it back with getImageData, which stalls until the GPU has
// finished and copies the pixels to the CPU. Here the frame goes GPU → GPU into a texture;
// one point per sample is scattered into a 256 × 3 float target with additive blending:
//   row 0: histograms R, G, B, Y′ (one channel per instance, bin = round(v·255))
//   row 1: 64 cells of running sums (R′, G′, B′, count) – spread to keep float32 sums small
//   row 2: cell 0 with MAX blending of (Y′, 1 − Y′) → max and min Y′
// The 12 KB result is read back asynchronously (pixel pack buffer + fence) and arrives with
// the next statistics tick (100 ms later), so the main thread never waits for the GPU.
// Same definitions as computeStats (src/sources.ts): clip low = bin 0 (v < 0.5/255),
// clip high = bin 255 (v ≥ 254.5/255). Bridge frames (already in CPU memory) stay on the CPU.

import type { Stats } from './sources';

const VS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform ivec2 uSize;
uniform int uStep, uMode, uNRoi;
uniform vec3 uK;
uniform vec4 uRoi[8];
out vec4 vVal;
void main() {
  gl_PointSize = 1.0;
  int cols = (uSize.x + uStep - 1) / uStep;
  int id = gl_VertexID;
  int x = (id % cols) * uStep, y = (id / cols) * uStep;
  bool inside = uNRoi == 0;
  for (int i = 0; i < 8; i++) {
    if (i >= uNRoi) break;
    vec4 r = uRoi[i];
    if (float(x) >= r.x && float(y) >= r.y && float(x) < r.z && float(y) < r.w) inside = true;
  }
  if (!inside || x >= uSize.x || y >= uSize.y) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); vVal = vec4(0.0); return; }
  vec3 c = texelFetch(uTex, ivec2(x, y), 0).rgb;
  float Y = dot(c, uK);
  float row, cell;
  if (uMode == 0) {
    int ch = gl_InstanceID;
    float v = ch == 0 ? c.r : ch == 1 ? c.g : ch == 2 ? c.b : Y;
    cell = clamp(floor(v * 255.0 + 0.5), 0.0, 255.0); row = 0.0;
    vVal = vec4(ch == 0 ? 1.0 : 0.0, ch == 1 ? 1.0 : 0.0, ch == 2 ? 1.0 : 0.0, ch == 3 ? 1.0 : 0.0);
  } else if (uMode == 1) {
    cell = float(id % 64); row = 1.0; vVal = vec4(c, 1.0);
  } else {
    cell = 0.0; row = 2.0; vVal = vec4(Y, 1.0 - Y, 0.0, 0.0);
  }
  gl_Position = vec4((cell + 0.5) / 256.0 * 2.0 - 1.0, (row + 0.5) / 3.0 * 2.0 - 1.0, 0.0, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec4 vVal;
out vec4 o;
void main() { o = vVal; }`;

export class GpuStats {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private tex: WebGLTexture;
  private fbo: WebGLFramebuffer;
  private pbo: WebGLBuffer;
  private fence: WebGLSync | null = null;
  private job: { n: number; kr: number; kb: number } | null = null;
  private u = new Map<string, WebGLUniformLocation | null>();

  /** null when WebGL2 or float render targets with blending are missing. */
  static create(): GpuStats | null {
    try {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
      const gl = c.getContext('webgl2', { antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false }) as WebGL2RenderingContext | null;
      if (!gl || !gl.getExtension('EXT_color_buffer_float') || !gl.getExtension('EXT_float_blend')) return null;
      return new GpuStats(gl);
    } catch { return null; }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    this.prog = p;
    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const target = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, 256, 3);
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('float target');
    this.pbo = gl.createBuffer()!;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, 256 * 3 * 4 * 4, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
  }

  private loc(name: string) {
    if (!this.u.has(name)) this.u.set(name, this.gl.getUniformLocation(this.prog, name));
    return this.u.get(name)!;
  }

  /** A job is still on the GPU. */
  get busy() { return this.job !== null; }

  /**
   * Queue statistics of `el` (w × h pixels). `rois` in element pixels, at most 8 (else
   * false: use the CPU). `maxSamples` limits the points (sub-sampling step).
   */
  submit(el: TexImageSource, w: number, h: number, kr: number, kb: number, rois: [number, number, number, number][] | null, maxSamples = 2_000_000): boolean {
    if (this.job || (rois && rois.length > 8)) return false;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
    const step = Math.max(1, Math.ceil(Math.sqrt((w * h) / maxSamples)));
    const cols = Math.ceil(w / step), rows = Math.ceil(h / step), n = cols * rows;
    gl.useProgram(this.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, 256, 3);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1i(this.loc('uTex'), 0);
    gl.uniform2i(this.loc('uSize'), w, h);
    gl.uniform1i(this.loc('uStep'), step);
    gl.uniform3f(this.loc('uK'), kr, 1 - kr - kb, kb);
    const r = rois ?? [];
    gl.uniform1i(this.loc('uNRoi'), r.length);
    if (r.length) gl.uniform4fv(this.loc('uRoi[0]'), r.flat());
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.blendEquation(gl.FUNC_ADD);
    gl.uniform1i(this.loc('uMode'), 0); gl.drawArraysInstanced(gl.POINTS, 0, n, 4);
    gl.uniform1i(this.loc('uMode'), 1); gl.drawArrays(gl.POINTS, 0, n);
    gl.blendEquation(gl.MAX);
    gl.uniform1i(this.loc('uMode'), 2); gl.drawArrays(gl.POINTS, 0, n);
    gl.disable(gl.BLEND);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.readPixels(0, 0, 256, 3, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    this.job = { n, kr, kb };
    return true;
  }

  /** The finished result, or null while the GPU is still working (never blocks). */
  poll(): Stats | null {
    const gl = this.gl;
    if (!this.job || !this.fence) return null;
    const s = gl.clientWaitSync(this.fence, 0, 0);
    if (s !== gl.ALREADY_SIGNALED && s !== gl.CONDITION_SATISFIED) return null;
    gl.deleteSync(this.fence); this.fence = null;
    const px = new Float32Array(256 * 3 * 4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, px);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    const { kr, kb } = this.job;
    this.job = null;
    return statsFromReduction(px, kr, kb);
  }
}

/** Stats from the 256 × 3 RGBA float reduction (layout above). Exported for tests. */
export function statsFromReduction(px: Float32Array, kr: number, kb: number): Stats {
  const hist = [0, 1, 2, 3].map((c) => { const h = new Float32Array(256); for (let b = 0; b < 256; b++) h[b] = px[b * 4 + c]; return h; });
  let r = 0, g = 0, b = 0, n = 0;
  for (let cell = 0; cell < 64; cell++) { const i = (256 + cell) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n += px[i + 3]; }
  const kg = 1 - kr - kb;
  const rgbAvg: [number, number, number] = n ? [r / n, g / n, b / n] : [0, 0, 0];
  const mm = 512 * 4;
  const N = Math.max(1, n);
  return {
    hist, samples: Math.round(n), rgbAvg,
    yAvg: n ? kr * rgbAvg[0] + kg * rgbAvg[1] + kb * rgbAvg[2] : 0,
    yMax: n ? px[mm] : 0, yMin: n ? 1 - px[mm + 1] : 1,
    clipLow: [0, 1, 2].map((c) => hist[c][0] / N), clipHigh: [0, 1, 2].map((c) => hist[c][255] / N),
  };
}
