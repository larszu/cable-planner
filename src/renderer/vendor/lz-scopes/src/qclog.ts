// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// QC error log (issue #67; idea: Nobe OmniScope "Error Logger" – a time-stamped list of gamut
// violations, luminance limits, black frames, audio silence …, filterable and exportable). Own
// implementation: conditions are checked four times a second on every live source; an event opens
// when a condition starts and closes when it ends, with wall-clock time, the source's time code
// (if it has one) and the worst value.

import type { R103Result } from './ycbcr';
import type { Stats } from './sources';

export type QcType = 'r103' | 'r103total' | 'clip' | 'superwhite' | 'subblack' | 'black' | 'freeze' | 'silence';
export const QC_TYPES: QcType[] = ['r103', 'r103total', 'clip', 'superwhite', 'subblack', 'black', 'freeze', 'silence'];
export const QC_LABELS: Record<QcType, string> = {
  r103: 'R 103 außerhalb −5/105 % (> 1 % Fläche)', r103total: 'R 103 Gesamtbereich 4–1019 verletzt', clip: 'Weiß-Clipping',
  superwhite: 'Super-White > 100 %', subblack: 'Sub-Black < 0 %', black: 'Schwarzbild', freeze: 'Standbild (eingefroren)', silence: 'Ton-Stille',
};

export interface QcSettings {
  on: boolean;
  /** share of pixels at ≥ 100 % in any channel that counts as clipping */
  clip: number;
  /** Y′ max below this = black frame */
  black: number;
  /** all channels' true peak below this (dBFS) for `silenceMs` = silence */
  silenceDb: number; silenceMs: number;
  /** picture unchanged for this long = frozen */
  freezeMs: number;
}
export const DEFAULT_QC: QcSettings = { on: true, clip: 0.005, black: 0.02, silenceDb: -60, silenceMs: 2000, freezeMs: 2000 };

export interface QcInput {
  stats: Stats | null;
  r103: R103Result | null;
  /** highest true peak of all channels over `silenceMs` in dBFS; null = no sound */
  peakDb: number | null;
  /** how long the picture has been unchanged (ms) */
  unchangedMs: number;
  /** whether freezes count (live inputs; not test patterns or paused files) */
  freezeApplies: boolean;
}

export interface QcCondition { on: boolean; value: number; detail: string }

/** Which conditions hold right now. */
export function evaluate(i: QcInput, s: QcSettings): Record<QcType, QcCondition> {
  const st = i.stats, pct = (v: number) => `${(v * 100).toFixed(1)} %`;
  const clip = st ? Math.max(...st.clipHigh) : 0;
  const c = (on: boolean, value: number, detail: string): QcCondition => ({ on, value, detail });
  return {
    r103: c(!!i.r103?.alarm, i.r103?.pref ?? 0, i.r103 ? `${pct(i.r103.pref)} der Fläche` : ''),
    r103total: c((i.r103?.total ?? 0) > 0, i.r103?.total ?? 0, i.r103 ? `${pct(i.r103.total)} der Fläche` : ''),
    clip: c(clip > s.clip, clip, `${pct(clip)} der Pixel`),
    superwhite: c(!!st && st.yMax > 1.005, st?.yMax ?? 0, st ? `Y′ max ${pct(st.yMax)}` : ''),
    subblack: c(!!st && st.yMin < -0.005, st?.yMin ?? 0, st ? `Y′ min ${pct(st.yMin)}` : ''),
    black: c(!!st && st.samples > 0 && st.yMax < s.black, st?.yMax ?? 0, st ? `Y′ max ${pct(st.yMax)}` : ''),
    freeze: c(i.freezeApplies && i.unchangedMs >= s.freezeMs, i.unchangedMs, `${(i.unchangedMs / 1000).toFixed(1)} s unverändert`),
    silence: c(i.peakDb !== null && i.peakDb < s.silenceDb, i.peakDb ?? 0, i.peakDb !== null ? `Spitze ${Number.isFinite(i.peakDb) ? i.peakDb.toFixed(1) : '−∞'} dBFS` : ''),
  };
}

export interface QcEvent {
  id: number; type: QcType; source: string;
  /** Date.now() at start / end (null = still active) */
  start: number; end: number | null;
  /** source time code at start / end, if the source has one */
  tcStart: string | null; tcEnd: string | null;
  /** first detail text and the worst value seen */
  detail: string; worst: number;
}

/** Opens and closes events from the conditions of each check. */
export class QcLog {
  events: QcEvent[] = [];
  version = 0;
  private open = new Map<string, QcEvent>();
  private next = 1;
  constructor(readonly max = 5000) {}

  update(sourceId: string, sourceName: string, cond: Record<QcType, QcCondition>, tc: string | null, now = Date.now()) {
    for (const type of QC_TYPES) {
      const k = `${sourceId}:${type}`, c = cond[type], ev = this.open.get(k);
      if (c.on && !ev) {
        const e: QcEvent = { id: this.next++, type, source: sourceName, start: now, end: null, tcStart: tc, tcEnd: null, detail: c.detail, worst: c.value };
        this.events.push(e); this.open.set(k, e); this.version++;
        if (this.events.length > this.max) this.events.splice(0, this.events.length - this.max);
      } else if (c.on && ev) {
        const worse = type === 'subblack' || type === 'black' || type === 'silence' ? c.value < ev.worst : c.value > ev.worst;
        if (worse) { ev.worst = c.value; ev.detail = c.detail; this.version++; }
      } else if (!c.on && ev) {
        ev.end = now; ev.tcEnd = tc; this.open.delete(k); this.version++;
      }
    }
  }
  /** close everything of a source (stopped / removed) */
  closeSource(sourceId: string, now = Date.now()) {
    for (const [k, e] of this.open) if (k.startsWith(`${sourceId}:`)) { e.end = now; this.open.delete(k); this.version++; }
  }
  clear() { this.events = []; this.open.clear(); this.version++; }
}

/** The app's log (all sources). */
export const qcLog = new QcLog();

const iso = (t: number) => new Date(t).toISOString();

/** CSV (semicolon-separated, UTF-8) of the events of the chosen types. */
export function toCsv(events: QcEvent[], types: QcType[] = QC_TYPES): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = events.filter((e) => types.includes(e.type)).map((e) => [
    e.id, iso(e.start), e.end ? iso(e.end) : '', e.end ? ((e.end - e.start) / 1000).toFixed(2) : '', e.tcStart ?? '', e.tcEnd ?? '',
    q(e.source), e.type, q(QC_LABELS[e.type]), q(e.detail),
  ].join(';'));
  return ['nr;start;ende;dauer_s;tc_start;tc_ende;quelle;typ;ereignis;detail', ...rows].join('\n');
}

/** Cheap fingerprint of a frame for freeze detection: 256 decoded samples. */
export function frameFingerprint(px: ArrayLike<number>, w: number, h: number, decode: (px: ArrayLike<number>, i: number) => number[]): string {
  let s = '';
  for (let k = 0; k < 256; k++) {
    const x = Math.floor(((k % 16) + 0.5) / 16 * w), y = Math.floor((Math.floor(k / 16) + 0.5) / 16 * h);
    const c = decode(px, (y * w + x) * 4);
    s += `${Math.round(c[0] * 1000)},${Math.round(c[1] * 1000)},${Math.round(c[2] * 1000)};`;
  }
  return s;
}

const LABEL = 'rgba(230, 215, 170, 0.85)';

/** Error-log panel: newest first; active events red. */
export function drawQcLog(ctx: CanvasRenderingContext2D, w: number, h: number, log: QcLog, types: QcType[], now = Date.now()) {
  ctx.save();
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const list = log.events.filter((e) => types.includes(e.type));
  const active = list.filter((e) => e.end === null).length;
  ctx.fillStyle = LABEL;
  ctx.fillText(`QC-Protokoll · ${list.length} Ereignisse${active ? ` · ${active} aktiv` : ''}`, 8, 6);
  const cols = [8, 82, 180, 300, 520, 590];
  ctx.fillStyle = 'rgba(230,215,170,0.55)';
  ['Start', 'TC', 'Quelle', 'Ereignis', 'Dauer', 'Wert'].forEach((t, i) => ctx.fillText(t, cols[i], 24));
  const rows = Math.max(0, Math.floor((h - 42) / 15));
  list.slice(-rows).reverse().forEach((e, i) => {
    const y = 40 + i * 15, on = e.end === null;
    ctx.fillStyle = on ? '#ff6b6b' : '#d6d6d6';
    const d = ((e.end ?? now) - e.start) / 1000;
    const t = new Date(e.start).toLocaleTimeString('de-DE');
    [t, e.tcStart ?? '–', e.source.slice(0, 16), QC_LABELS[e.type].slice(0, 32), `${d.toFixed(1)} s${on ? ' …' : ''}`, e.detail].forEach((s, k) => ctx.fillText(s, cols[k], y));
  });
  if (!list.length) { ctx.fillStyle = '#6b7078'; ctx.fillText('Keine Ereignisse. Geprüft werden alle laufenden Quellen viermal pro Sekunde.', 8, 44); }
  ctx.restore();
}
