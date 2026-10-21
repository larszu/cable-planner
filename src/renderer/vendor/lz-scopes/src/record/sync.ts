// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Common time base of several sources (#140 steps 2 and 5): pure parts, tested in
// test/sync.test.ts.
//   - freeze all sources at the same moment of the scene: each source keeps its last frames with
//     their arrival time; a frame that arrived at wall time a with latency l shows the scene at
//     a − l. The common moment is the newest one every source has: now − the largest latency.
//   - playback of several recordings on one clock: position on the scene time line.

export interface Held<T> { at: number; frame: T }

/** Frame whose scene time (arrival − latency) is closest to `scene`; null for an empty list. */
export function pickFrame<T>(frames: readonly Held<T>[], scene: number, latencyMs: number): Held<T> | null {
  let best: Held<T> | null = null, d = Infinity;
  for (const f of frames) {
    const x = Math.abs(f.at - latencyMs - scene);
    if (x < d) { d = x; best = f; }
  }
  return best;
}

/**
 * Common scene moment for "freeze all": the newest moment that every source has already shown,
 * i.e. now − the largest latency (sources without a measured latency count as 0).
 */
export function freezeMoment(now: number, latencies: readonly (number | null)[]): number {
  return now - Math.max(0, ...latencies.map((l) => (l !== null && Number.isFinite(l) ? l : 0)));
}

/** Keeps the frames of the last `ms` (at most `max`), newest last. */
export class FrameHistory<T> {
  private list: Held<T>[] = [];
  constructor(private ms = 600, private max = 24) {}
  push(frame: T, at = Date.now()) {
    this.list.push({ at, frame });
    while (this.list.length > this.max || (this.list.length > 1 && at - this.list[0].at > this.ms)) this.list.shift();
  }
  get frames(): readonly Held<T>[] { return this.list; }
  clear() { this.list = []; }
}

/** Shared playback clock: scene time t0 at wall time at0, running at `rate` while playing. */
export class PlaybackClock {
  playing = false;
  t0 = 0; at0 = 0; rate = 1;
  /** Scene time now (wall ms of the recorded moment). */
  position(now = Date.now()) { return this.playing ? this.t0 + (now - this.at0) * this.rate : this.t0; }
  play(now = Date.now(), t = this.position(now)) { this.t0 = t; this.at0 = now; this.playing = true; }
  pause(now = Date.now()) { this.t0 = this.position(now); this.playing = false; }
  seek(t: number, now = Date.now()) { this.t0 = t; this.at0 = now; }
}

/** Time of day of a scene time (local, with milliseconds) for the transport display. */
export function clockText(ms: number) {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}
