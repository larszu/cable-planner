// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Fixed-delay playout for bridge frames (#244): instead of "newest picture as soon as it is here"
// (shortest delay, but it varies with every hiccup on the way) every picture is shown a fixed time
// after its capture. Capture time = the stream's PTS; the PTS→wall-clock offset is the smallest
// one seen in the last seconds (the least delayed picture), so the buffer absorbs everything
// slower than that. Pictures that arrive later than their slot are shown at once (and counted).

export interface DelayItem<T> { due: number; item: T }

export class DelayBuffer<T> {
  private q: DelayItem<T>[] = [];
  private offsets: { at: number; off: number }[] = [];
  /** pictures that came later than their slot */
  late = 0;
  /** pictures dropped because a newer one was due at the same time or the queue overflowed */
  dropped = 0;
  constructor(public delayMs: number, private windowMs = 4000, private maxQueue = 64) {}

  /** A picture with its PTS (s) arrived at `now` (ms). False = no usable PTS (caller shows it at once). */
  push(item: T, pts: number, now: number): boolean {
    if (!Number.isFinite(pts)) return false;
    const off = now - pts * 1000;
    this.offsets.push({ at: now, off });
    while (this.offsets.length && now - this.offsets[0].at > this.windowMs) this.offsets.shift();
    // a jump in the PTS (new stream, loop, seek): forget the old base
    const base = this.base();
    if (Math.abs(off - base) > 5000) { this.offsets = [{ at: now, off }]; this.q = []; }
    const due = pts * 1000 + this.base() + this.delayMs;
    if (due < now) this.late++;
    this.q.push({ due, item });
    this.q.sort((a, b) => a.due - b.due);
    while (this.q.length > this.maxQueue) { this.q.shift(); this.dropped++; }
    return true;
  }
  private base() { let m = Infinity; for (const o of this.offsets) if (o.off < m) m = o.off; return m; }

  /** The newest picture whose time has come (older due ones are skipped), or null. */
  take(now: number): T | null {
    let out: DelayItem<T> | null = null;
    while (this.q.length && this.q[0].due <= now) { if (out) this.dropped++; out = this.q.shift()!; }
    return out ? out.item : null;
  }
  /** ms until the next picture is due (Infinity = empty). */
  next(now: number) { return this.q.length ? Math.max(0, this.q[0].due - now) : Infinity; }
  get size() { return this.q.length; }
  clear() { this.q = []; this.offsets = []; }
}
