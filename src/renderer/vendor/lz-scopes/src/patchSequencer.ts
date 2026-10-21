// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Measurement patch output and sequencer, shared by display calibration (#9) and the LED-wall
// tools. The main window sends patch frames over a BroadcastChannel; every pattern output
// window (?out=…) of the same origin draws them instead of its test pattern.
//
//   sendPatch({ rgb: [1, 1, 1], window: 0.1, background: 0.22 })   show a patch
//   sendPatch(null)                                                  back to the test pattern
//   new PatchSequencer(frames, measure, opts).run()                 step through a list
//
// Values are full-range signal levels 0…1 of the 8-bit canvas (0 = code 0, 1 = code 255).
// Timing and the APL/full-field ideas follow DisplayCAL's defaults (docs/research/
// display-kalibrierung.md); the code is our own.

export type RGB = [number, number, number];

export interface PatchFrame {
  rgb: RGB;
  /** Patch area as a fraction of the output (1 = full field). Ignored when `rect` is set. Default 0.1. */
  window?: number;
  /** Explicit patch rectangle in fractions of the output (uniformity cells, LED cabinets). */
  rect?: { x: number; y: number; w: number; h: number };
  /** Constant surround level (grey 0…1 or RGB) against ABL; default black. */
  background?: number | RGB;
  /** Small caption in the lower left corner; not drawn for `rect` patches (it would sit in a cell). */
  label?: string;
}

export const PATCH_CHANNEL = 'lzs-patch';

let channel: BroadcastChannel | null = null;
const chan = () => (channel ??= typeof BroadcastChannel === 'function' ? new BroadcastChannel(PATCH_CHANNEL) : null);

/** Show a patch in every open pattern output window, or `null` to return to the test pattern. */
export function sendPatch(frame: PatchFrame | null) {
  chan()?.postMessage({ type: 'patch', frame });
}

/** Output side: called for every frame sent (null = patch mode off). Returns an unsubscribe function. */
export function listenPatches(cb: (f: PatchFrame | null) => void): () => void {
  if (typeof BroadcastChannel !== 'function') return () => {};
  const c = new BroadcastChannel(PATCH_CHANNEL);
  c.onmessage = (e) => { if (e.data?.type === 'patch') cb(e.data.frame ?? null); };
  return () => c.close();
}

/** 8-bit code of a level (what the canvas actually shows). */
export const code8 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
/** Level after 8-bit quantisation – targets are computed from this, not from the requested value. */
export const quantize = (rgb: RGB): RGB => rgb.map((v) => code8(v) / 255) as RGB;

/** Pixel rectangle of a patch: centred, same aspect as the output, area = window fraction. */
export function patchRect(w: number, h: number, f: PatchFrame) {
  if (f.rect) {
    const x = Math.round(f.rect.x * w), y = Math.round(f.rect.y * h);
    return { x, y, w: Math.round((f.rect.x + f.rect.w) * w) - x, h: Math.round((f.rect.y + f.rect.h) * h) - y };
  }
  const s = Math.sqrt(Math.max(0, Math.min(1, f.window ?? 0.1)));
  const pw = Math.round(w * s), ph = Math.round(h * s);
  return { x: Math.round((w - pw) / 2), y: Math.round((h - ph) / 2), w: pw, h: ph };
}

const css = (rgb: RGB) => `rgb(${rgb.map(code8).join(',')})`;

export function drawPatch(ctx: CanvasRenderingContext2D, w: number, h: number, f: PatchFrame) {
  const bg = f.background ?? 0;
  ctx.fillStyle = css(typeof bg === 'number' ? [bg, bg, bg] : bg);
  ctx.fillRect(0, 0, w, h);
  const r = patchRect(w, h, f);
  ctx.fillStyle = css(f.rgb);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (f.label && !f.rect) {
    ctx.font = `${Math.max(12, Math.round(h / 60))}px system-ui`;
    ctx.fillStyle = '#777';
    ctx.textBaseline = 'bottom';
    ctx.fillText(f.label, Math.round(h / 80), h - Math.round(h / 80));
  }
}

export interface SequencerOptions {
  /** Wait after switching before measuring (display response + settle), ms. DisplayCAL minimum 20 ms. */
  settleMs?: number;
  /** Full-field insertion against ABL/drift: every `everyS` seconds show `level` full field for `durationS`. */
  insertion?: { everyS: number; durationS: number; level: number } | null;
}

export interface SequencerStep<T> { index: number; frame: PatchFrame; result: T }

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((ok, fail) => {
  const t = setTimeout(ok, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); fail(new DOMException('aborted', 'AbortError')); }, { once: true });
});

/**
 * Steps through patch frames: show, wait, measure, next. `measure` returns the reading (from a
 * meter or typed in by the user) or null to skip the field. `show` is replaceable for tests.
 */
export class PatchSequencer<T> {
  private abort = new AbortController();
  private lastInsert = 0;
  constructor(
    readonly frames: PatchFrame[],
    private measure: (frame: PatchFrame, index: number, signal: AbortSignal) => Promise<T | null>,
    private opts: SequencerOptions = {},
    private show: (f: PatchFrame | null) => void = sendPatch,
    private now: () => number = () => performance.now(),
    private wait: (ms: number, signal?: AbortSignal) => Promise<void> = sleep,
  ) {}

  stop() { this.abort.abort(); }
  get stopped() { return this.abort.signal.aborted; }

  async run(onStep?: (s: SequencerStep<T | null>) => void, start = 0): Promise<(T | null)[]> {
    const out: (T | null)[] = [];
    const sig = this.abort.signal;
    this.lastInsert = this.now();
    try {
      for (let i = start; i < this.frames.length; i++) {
        if (sig.aborted) break;
        const ins = this.opts.insertion;
        if (ins && ins.everyS > 0 && this.now() - this.lastInsert >= ins.everyS * 1000) {
          this.show({ rgb: [ins.level, ins.level, ins.level], window: 1 });
          await this.wait(ins.durationS * 1000, sig);
          this.lastInsert = this.now();
        }
        const f = this.frames[i];
        this.show(f);
        await this.wait(Math.max(20, this.opts.settleMs ?? 500), sig);
        const r = await this.measure(f, i, sig);
        out[i] = r;
        onStep?.({ index: i, frame: f, result: r });
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') throw e;
    } finally {
      this.show(null);
    }
    return out;
  }
}
