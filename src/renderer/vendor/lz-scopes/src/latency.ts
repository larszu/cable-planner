// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Latency measurement (#16) with stamped test pictures (server/stamp.mjs,
// scripts/latency-source.mjs): source clock → bridge → app arrival → drawn.
// All differences use wall clocks: valid when source, bridge and app share one clock
// (same computer) or are NTP-synchronised; otherwise only the bridge → app part without
// the source is meaningful, and even that only on one computer.
//
// Stages (low-latency mode): every hand-over is time-stamped so the Messwerte panel and
// the e2e measurement can show where the time goes:
//   stamp ─ toBridge ─▶ out of ffmpeg ─ bridgeToApp ─▶ worker ─ handoff ─▶ main thread
//         ─ wait ─▶ draw start ─ draw ─▶ draw submitted (= total)
// "Submitted" means the WebGL work and the panel copies were issued; the browser's
// compositor and the monitor come after that and are not measured here.

import { stampAge } from '../server/stamp.mjs';
import type { FrameMeta } from './frameLink';

export interface LatencySummary {
  /** stamp → draw submitted (or → next animation frame without draw hook), ms */
  total: Stat;
  /** stamp → frame left ffmpeg in the bridge (H.264: per frame; raw: bridge's own reading, 1-s stats) */
  toBridge: Stat | null;
  /** bridge → arrived in the worker (incl. H.264 decode) */
  bridgeToApp: Stat | null;
  decode: Stat | null;
  /** worker → main thread */
  handoff: Stat | null;
  /** main thread got the frame → its panels start drawing */
  wait: Stat | null;
  /** drawing the panels of this source */
  draw: Stat | null;
  frames: number;
}
export interface Stat { mean: number; min: number; max: number }

const WINDOW_MS = 2000;

export function stat(v: number[]): Stat | null {
  if (!v.length) return null;
  let s = 0, lo = Infinity, hi = -Infinity;
  for (const x of v) { s += x; lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return { mean: s / v.length, min: lo, max: hi };
}

type Row = { t: number; total: number; toBridge: number; bridgeToApp: number; decode: number; handoff: number; wait: number; draw: number };
type Col = Exclude<keyof Row, 't'>;

export class LatencyMeter {
  /**
   * true once the render loop reports its draws (main.ts calls drawn()); otherwise a
   * frame counts as drawn at the next animation frame, as before.
   */
  static drawHook = false;
  private rows: Row[] = [];
  /** last frame's stamp (a frame counted once even if drawn twice) */
  private lastStamp: number | null = null;
  private pending: { stamp: number; meta: FrameMeta; main: number } | null = null;
  /** the bridge's own stamp reading on the raw path (stats message, 1 s) */
  private bridgeAge: { at: number; s: Stat } | null = null;

  /** A frame arrived on the main thread; it is closed when its panels are drawn. */
  onFrame(meta: FrameMeta | undefined, now = Date.now()) {
    if (!meta || meta.stamp === null || meta.stamp === this.lastStamp) return;
    this.lastStamp = meta.stamp;
    this.pending = { stamp: meta.stamp, meta, main: now };
    if (LatencyMeter.drawHook) return;
    const done = () => { const t = Date.now(); this.drawn(t, t); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(done); else done();
  }

  /** true while a stamped frame waits to be drawn */
  get waiting() { return this.pending !== null; }

  /** The panels showing this source were drawn from `start` to `end` (Date.now()). */
  drawn(start: number, end = start) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    const { meta } = p;
    const bridgeOk = Number.isFinite(meta.bridge);
    this.rows.push({
      t: end,
      total: stampAge(p.stamp, end),
      toBridge: bridgeOk ? stampAge(p.stamp, meta.bridge) : NaN,
      bridgeToApp: bridgeOk ? meta.arrive - meta.bridge : NaN,
      decode: meta.decodeMs ?? NaN,
      handoff: p.main - meta.arrive,
      wait: LatencyMeter.drawHook ? start - p.main : NaN,
      draw: LatencyMeter.drawHook ? end - start : NaN,
    });
    while (this.rows.length && end - this.rows[0].t > WINDOW_MS) this.rows.shift();
  }

  /** Bridge's stats message: stamp → out of ffmpeg on the raw path. */
  onBridgeStats(s: Stat | null | undefined, now = Date.now()) {
    if (s && Number.isFinite(s.mean)) this.bridgeAge = { at: now, s };
  }

  /** Mean/min/max of the last 2 s, null without stamped frames. */
  summary(now = Date.now()): LatencySummary | null {
    const r = this.rows.filter((x) => now - x.t <= WINDOW_MS);
    if (!r.length) return null;
    const col = (k: Col) => stat(r.map((x) => x[k]).filter(Number.isFinite));
    const bridge = this.bridgeAge && now - this.bridgeAge.at <= WINDOW_MS ? this.bridgeAge.s : null;
    return {
      total: col('total')!, toBridge: col('toBridge') ?? bridge, bridgeToApp: col('bridgeToApp'), decode: col('decode'),
      handoff: col('handoff'), wait: col('wait'), draw: col('draw'), frames: r.length,
    };
  }
}

/** Lines for the Messwerte panel. `low` = the source runs in low-latency mode. */
export function latencyLines(s: LatencySummary | null, low = false): string[] {
  if (!s) return low ? ['', 'Latenz     Low Latency an · keine gestempelten Testbilder, nicht gemessen'] : [];
  const f = (x: Stat | null) => (x ? `${Math.round(x.mean)} ms (${Math.round(x.min)}–${Math.round(x.max)})` : '–');
  const lines = ['', `Latenz     ${low ? 'Low Latency · ' : ''}Stempel → gezeichnet ${f(s.total)}`];
  if (s.toBridge) lines.push(`           Quelle → Bridge ${f(s.toBridge)}${s.bridgeToApp ? ` · Bridge → App ${f(s.bridgeToApp)}` : ''}`);
  if (s.decode) lines.push(`           davon H.264-Dekodierung ${f(s.decode)}`);
  if (s.wait && s.draw) lines.push(`           Worker → Hauptthread ${f(s.handoff)} · Warten ${f(s.wait)} · Zeichnen ${f(s.draw)}`);
  lines.push('           (gleiche Uhr vorausgesetzt; ohne Compositor und Monitor)');
  return lines;
}

/** Counters of the bridge's own RTP reception (server/rtsp.mjs report()). */
export interface RtpStats {
  transport: string; packets: number; lost: number; reordered: number; late?: number;
  accessUnits: number; droppedUnits: number; udpBuffer?: number; switched?: string | null;
}

/** Lines for the Messwerte panel about the bridge's own RTP reception (low-latency mode). */
export function rtpLines(
  info: { own: boolean; transport?: string; codec?: string; note?: string } | null | undefined,
  st: RtpStats | null | undefined,
): string[] {
  if (!info) return [];
  if (!info.own) return [`Empfang    ${info.note ?? 'ffmpeg-RTSP'}`];
  const codec = info.codec === 'hevc' ? 'HEVC' : 'H.264';
  const transport = (st?.transport ?? info.transport ?? 'tcp').toUpperCase();
  const lines = [`Empfang    RTP eigen · ${codec} · ${transport}${st?.udpBuffer ? ` · Puffer ${(st.udpBuffer / 1048576).toFixed(1)} MB` : ''}`];
  if (st?.switched) lines.push(`           ${st.switched}`);
  if (st) {
    const total = st.packets + st.lost;
    const pct = total ? (100 * st.lost) / total : 0;
    lines.push(`           ${st.packets} Pakete · ${st.lost} verloren (${pct.toFixed(pct < 1 ? 2 : 1)} %) · ${st.reordered} umsortiert · ${st.late ?? 0} zu spät`);
    lines.push(`           ${st.accessUnits} Bilder · ${st.droppedUnits} verworfen (Lücke, dann bis zum nächsten Keyframe)`);
  }
  return lines;
}
