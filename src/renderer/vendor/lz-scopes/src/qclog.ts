// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// QC error log (issue #67; idea: Nobe OmniScope "Error Logger" – a time-stamped list of gamut
// violations, luminance limits, black frames, audio silence …, filterable and exportable). Own
// implementation: conditions are checked four times a second on every live source; an event opens
// when a condition starts and closes when it ends, with wall-clock time, the source's time code
// (if it has one) and the worst value.

import type { R103Result } from './ycbcr';
import type { Stats } from './sources';
import { lang, t } from './i18n';

export type QcType = 'r103' | 'r103total' | 'clip' | 'superwhite' | 'subblack' | 'black' | 'freeze' | 'silence' | 'tout' | 'vrep' | 'brng';
export const QC_TYPES: QcType[] = ['r103', 'r103total', 'clip', 'superwhite', 'subblack', 'black', 'freeze', 'silence', 'tout', 'vrep', 'brng'];
export const QC_LABELS: Record<QcType, string> = {
  r103: t('tools.qc.r103'), r103total: t('tools.qc.r103total'), clip: t('tools.qc.clip'),
  superwhite: t('tools.qc.superwhite'), subblack: t('tools.qc.subblack'), black: t('tools.qc.black'), freeze: t('tools.qc.freeze'), silence: t('tools.qc.silence'),
  tout: t('tools.qc.tout'), vrep: t('tools.qc.vrep'), brng: t('tools.qc.brng'),
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
  /** ffmpeg signalstats (#202): share of pixels that are temporal outliers / repeated lines / outside 16–235 */
  tout: number; vrep: number; brng: number;
}
export const DEFAULT_QC: QcSettings = { on: true, clip: 0.005, black: 0.02, silenceDb: -60, silenceMs: 2000, freezeMs: 2000, tout: 0.0005, vrep: 0.01, brng: 0.02 };

export interface QcInput {
  stats: Stats | null;
  /** QC metrics of the bridge (#202); null when the source does not deliver them */
  signal: { tout?: number; vrep?: number; brng?: number } | null;
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
    r103: c(!!i.r103?.alarm, i.r103?.pref ?? 0, i.r103 ? t('tools.qc.ofArea', { v: pct(i.r103.pref) }) : ''),
    r103total: c((i.r103?.total ?? 0) > 0, i.r103?.total ?? 0, i.r103 ? t('tools.qc.ofArea', { v: pct(i.r103.total) }) : ''),
    clip: c(clip > s.clip, clip, t('tools.qc.ofPixels', { v: pct(clip) })),
    superwhite: c(!!st && st.yMax > 1.005, st?.yMax ?? 0, st ? `Y′ max ${pct(st.yMax)}` : ''),
    subblack: c(!!st && st.yMin < -0.005, st?.yMin ?? 0, st ? `Y′ min ${pct(st.yMin)}` : ''),
    black: c(!!st && st.samples > 0 && st.yMax < s.black, st?.yMax ?? 0, st ? `Y′ max ${pct(st.yMax)}` : ''),
    freeze: c(i.freezeApplies && i.unchangedMs >= s.freezeMs, i.unchangedMs, t('tools.qc.unchanged', { s: (i.unchangedMs / 1000).toFixed(1) })),
    silence: c(i.peakDb !== null && i.peakDb < s.silenceDb, i.peakDb ?? 0, i.peakDb !== null ? t('tools.qc.peak', { db: Number.isFinite(i.peakDb) ? i.peakDb.toFixed(1) : '−∞' }) : ''),
    // from the bridge (#202); without the metrics the conditions simply do not hold
    tout: c((i.signal?.tout ?? 0) > s.tout, i.signal?.tout ?? 0, i.signal?.tout !== undefined ? t('tools.qc.ofPixels', { v: pct(i.signal.tout) }) : ''),
    vrep: c((i.signal?.vrep ?? 0) > s.vrep, i.signal?.vrep ?? 0, i.signal?.vrep !== undefined ? t('tools.qc.ofLines', { v: pct(i.signal.vrep) }) : ''),
    brng: c((i.signal?.brng ?? 0) > s.brng, i.signal?.brng ?? 0, i.signal?.brng !== undefined ? t('tools.qc.ofPixels', { v: pct(i.signal.brng) }) : ''),
  };
}

export interface QcEvent {
  id: number; type: QcType; source: string;
  /** id of the source, for the panel alarm frames (#182); the name is what a reader sees */
  sourceId: string;
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
        const e: QcEvent = { id: this.next++, type, source: sourceName, sourceId, start: now, end: null, tcStart: tc, tcEnd: null, detail: c.detail, worst: c.value };
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

  /**
   * State of a source for a panel's alarm frame (#182): 'alarm' while one of `types` holds,
   * 'hold' for `holdMs` after the last one ended – a flash that is over before anyone looks up
   * must still be visible – and 'ok' otherwise.
   */
  alarm(sourceId: string, types: readonly QcType[], holdMs: number, now = Date.now()): AlarmState {
    let state: AlarmState = 'ok';
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (e.sourceId !== sourceId || !types.includes(e.type)) continue;
      if (e.end === null) return 'alarm';
      if (now - e.end <= holdMs) state = 'hold';
      // the list is in starting order: older events can only be further in the past
      else if (state === 'hold') break;
    }
    return state;
  }
}

/** Panel alarm frame (#182). */
export type AlarmState = 'ok' | 'hold' | 'alarm';

/** Settings of a panel's alarm frame. */
export interface AlarmSettings { on: boolean; types?: QcType[]; hold?: number; width?: number; green?: boolean }
export const DEFAULT_ALARM = { hold: 5000, width: 4 };

/** Colour of the frame, or '' when nothing is to be drawn. */
export function alarmColor(state: AlarmState, a: AlarmSettings): string {
  if (!a.on) return '';
  if (state === 'alarm') return '#ff3b30';
  if (state === 'hold') return '#ffb300';
  return a.green === false ? '' : '#1f9d55';
}

/** The app's log (all sources). */
export const qcLog = new QcLog();

const iso = (ms: number) => new Date(ms).toISOString();

/** CSV (semicolon-separated, UTF-8) of the events of the chosen types. */
export function toCsv(events: QcEvent[], types: QcType[] = QC_TYPES): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = events.filter((e) => types.includes(e.type)).map((e) => [
    e.id, iso(e.start), e.end ? iso(e.end) : '', e.end ? ((e.end - e.start) / 1000).toFixed(2) : '', e.tcStart ?? '', e.tcEnd ?? '',
    q(e.source), e.type, q(QC_LABELS[e.type]), q(e.detail),
  ].join(';'));
  return [t('tools.qc.csvHeader'), ...rows].join('\n');
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
  ctx.fillText(t('tools.qc.title', { n: list.length }) + (active ? t('tools.qc.active', { n: active }) : ''), 8, 6);
  const cols = [8, 82, 180, 300, 520, 590];
  ctx.fillStyle = 'rgba(230,215,170,0.55)';
  ['Start', 'TC', t('tools.qc.colSource'), t('tools.qc.colEvent'), t('tools.qc.colDuration'), t('tools.qc.colValue')].forEach((head, i) => ctx.fillText(head, cols[i], 24));
  const rows = Math.max(0, Math.floor((h - 42) / 15));
  list.slice(-rows).reverse().forEach((e, i) => {
    const y = 40 + i * 15, on = e.end === null;
    ctx.fillStyle = on ? '#ff6b6b' : '#d6d6d6';
    const d = ((e.end ?? now) - e.start) / 1000;
    const time = new Date(e.start).toLocaleTimeString(lang() === 'de' ? 'de-DE' : 'en-GB');
    [time, e.tcStart ?? '–', e.source.slice(0, 16), QC_LABELS[e.type].slice(0, 32), `${d.toFixed(1)} s${on ? ' …' : ''}`, e.detail].forEach((s, k) => ctx.fillText(s, cols[k], y));
  });
  if (!list.length) { ctx.fillStyle = '#6b7078'; ctx.fillText(t('tools.qc.empty'), 8, 44); }
  ctx.restore();
}
