// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Reference / genlock panel (#72): house reference (black burst or tri-level sync) at the
// reference input of a Blackmagic DeckLink card, plus the frame phase of the captured signal
// against the SMPTE ST 2059-1 frame grid (system clock or PTP) and the card's timecode.
//
// Data: bridge /api/decklink/reference (helper `lz-decklink --reference`, DeckLink SDK status
// and configuration IDs) and the `phase` field of the bridge stats (server/phase.mjs).
// The DeckLink SDK reports lock, detected format and the configured genlock offset – it does
// not measure the timing between input and reference, so the panel shows no such value.
// NOT TESTED WITH HARDWARE (no DeckLink card with reference input was available).

import type { Source } from './sources';
import { lang, tIn, type Key as I18nKey } from './i18n';
import { bridgeText } from './i18n/bridgeMessage';
// controls without the shared stylesheet: output windows draw this panel too
import { h } from './ui/dom';
import { field, hint, select } from './ui/controls';

export interface RefMode { name: string; width: number; height: number; fpsNum: number; fpsDen: number; field: 'progressive' | 'interlaced' | 'psf' }
export interface RefStatus {
  ok: boolean; helper?: boolean; error?: string; index?: number; name?: string;
  hasReference?: boolean; fullFrameOffset?: boolean; referenceLocked?: boolean | null; referenceMode?: RefMode | null; referencePsF?: boolean | null;
  inputLocked?: boolean | null; inputMode?: RefMode | null; timingOffsetPixels?: number; outputReference?: { locked: boolean; notSupported: boolean };
}
export interface PhaseReport { periodMs: number; meanMs: number; sdMs: number; driftPpm: number | null; driftSePpm?: number | null; jumps?: number; n: number; spanS: number; ref: 'system' | 'ptp' }
export interface GenlockOptions { device: number }

// Texts: src/i18n/{en,de}/genlock.ts (keys genlock.*); `lang` picks a language explicitly.
type GenlockKey = 'bridgeDown' | 'title' | 'untested' | 'noHelper' | 'noRefInput' | 'locked' | 'notLocked' | 'unknown' | 'reference' | 'format' | 'formatUnknown' | 'bb' | 'tls' | 'derived' | 'offset' | 'px' | 'range511' | 'rangeFull' | 'input' | 'noPhaseApi' | 'phaseTitle' | 'phaseSystem' | 'phasePtp' | 'phaseNone' | 'mean' | 'sd' | 'drift' | 'jumps' | 'driftWait' | 'phaseNote' | 'tc' | 'tcNote' | 'device';
export const tr = (k: GenlockKey, l: 'de' | 'en' = lang()) => tIn(l, `genlock.${k}` as I18nKey);

/**
 * Black burst or tri-level from the detected reference format: black burst is the SD
 * (NTSC/PAL) reference, tri-level sync the HD one (Tektronix app note 20W-29582-0; Leader
 * LV5600W spec: "Tri-level sync or NTSC/PAL black burst signal").
 */
export function referenceKind(m: RefMode | null | undefined): 'bb' | 'tls' | null {
  if (!m || !m.height) return null;
  return m.height <= 576 ? 'bb' : 'tls';
}

export const modeText = (m: RefMode | null | undefined) => {
  if (!m) return '';
  const fps = m.fpsNum / m.fpsDen;
  const rate = Math.abs(fps - Math.round(fps)) < 1e-6 ? String(Math.round(fps)) : fps.toFixed(2);
  return `${m.name} · ${m.width}×${m.height} · ${rate} fps ${m.field === 'interlaced' ? 'i' : m.field === 'psf' ? 'PsF' : 'p'}`;
};

/** Text lines of the panel (pure, tested). */
export function genlockLines(st: RefStatus | null, phase: PhaseReport | null, tc: string | null, l: 'de' | 'en' = lang()) {
  const t = (k: GenlockKey) => tr(k, l);
  const ref: { label: string; value: string; tone: 'good' | 'bad' | 'warn' | 'dim' | 'fg' }[] = [];
  if (!st) ref.push({ label: t('reference'), value: '…', tone: 'dim' });
  else if (!st.ok) ref.push({ label: t('noHelper'), value: bridgeText(st, 'error'), tone: 'warn' });
  else {
    ref.push({ label: t('device'), value: `${st.index ?? 0} · ${st.name ?? ''}`, tone: 'fg' });
    if (!st.hasReference) ref.push({ label: t('reference'), value: t('noRefInput'), tone: 'warn' });
    else {
      const locked = st.referenceLocked ?? st.outputReference?.locked ?? null;
      ref.push({ label: t('reference'), value: locked == null ? t('unknown') : locked ? `● ${t('locked')}` : `○ ${t('notLocked')}`, tone: locked ? 'good' : locked === false ? 'bad' : 'dim' });
      const kind = referenceKind(st.referenceMode);
      ref.push({ label: t('format'), value: st.referenceMode ? `${modeText(st.referenceMode)}${st.referencePsF ? ' (PsF)' : ''} · ${t(kind === 'bb' ? 'bb' : 'tls')} (${t('derived')})` : t('formatUnknown'), tone: st.referenceMode ? 'fg' : 'dim' });
      if (st.timingOffsetPixels != null) ref.push({ label: t('offset'), value: `${st.timingOffsetPixels > 0 ? '+' : ''}${st.timingOffsetPixels} ${t('px')} (${t(st.fullFrameOffset ? 'rangeFull' : 'range511')})`, tone: 'fg' });
    }
    if (st.inputLocked != null || st.inputMode) ref.push({ label: t('input'), value: `${st.inputLocked ? `● ${t('locked')}` : `○ ${t('notLocked')}`}${st.inputMode ? ` · ${modeText(st.inputMode)}` : ''}`, tone: st.inputLocked ? 'good' : 'warn' });
    ref.push({ label: '', value: t('noPhaseApi'), tone: 'dim' });
  }
  const ph = phase ? {
    ref: t(phase.ref === 'ptp' ? 'phasePtp' : 'phaseSystem'),
    mean: `${t('mean')} ${phase.meanMs.toFixed(3)} ms / ${phase.periodMs.toFixed(3)} ms`,
    sd: `${t('sd')} ${phase.sdMs.toFixed(3)} ms`,
    drift: phase.driftPpm == null ? t('driftWait') : `${t('drift')} ${phase.driftPpm >= 0 ? '+' : ''}${phase.driftPpm.toFixed(1)}${phase.driftSePpm != null ? ` ± ${phase.driftSePpm.toFixed(1)}` : ''} ppm${phase.jumps ? ` · ${phase.jumps} ${t('jumps')}` : ''}`,
  } : null;
  return { ref, phase: ph, tc: tc ? `${t('tc')} ${tc}` : null };
}

// ---------------------------------------------------------------- polling

let bridgeUrl: () => string = () => '';
export function setGenlockBridge(fn: () => string) { bridgeUrl = fn; }
const cache = new Map<number, { st: RefStatus | null; at: number; busy: boolean }>();
/** Latest status of device `index`; starts a poll at most every second while panels draw. */
export function referenceStatus(index: number): RefStatus | null {
  const c = cache.get(index) ?? { st: null, at: 0, busy: false };
  cache.set(index, c);
  if (!c.busy && Date.now() - c.at > 1000) {
    c.busy = true;
    fetch(`${bridgeUrl().replace(/^ws/, 'http')}/api/decklink/reference?index=${index}`).then((r) => r.json())
      .then((st: RefStatus) => { c.st = st; })
      .catch(() => { c.st = { ok: false, error: tr('bridgeDown') }; })
      .finally(() => { c.at = Date.now(); c.busy = false; });
  }
  return c.st;
}

// ---------------------------------------------------------------- drawing

const C = { fg: '#e6e6e6', dim: '#8a9099', good: '#7ddc8a', warn: '#ffb840', bad: '#ff6b6b', accent: '#00dcff', track: 'rgba(255,255,255,0.12)' };
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export function drawGenlockPanel(ctx: CanvasRenderingContext2D, o: Partial<GenlockOptions> | undefined, src: Source | null, w: number, h: number) {
  const ui = lang();
  const st = referenceStatus(o?.device ?? 0);
  const live = src && (src.url.startsWith('decklink:') || src.url.startsWith('ndi:')) && src.status === 'live';
  const phase = live ? src.phase : null;
  const tc = live ? (src as unknown as { tc?: { tc?: string } | null }).tc?.tc ?? null : null;
  const L = genlockLines(st, phase, tc, ui);
  const pad = 12, size = Math.max(11, Math.min(14, w / 42));
  let y = pad;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const put = (s: string, x: number, color = C.fg, weight = '') => {
    ctx.font = `${weight} ${size}px ${MONO}`; ctx.fillStyle = color;
    let t = s;
    while (t.length > 4 && ctx.measureText(t).width > w - x - pad) t = `${t.slice(0, -2)}…`;
    ctx.fillText(t, x, y);
  };
  const nl = (k = 1.45) => { y += size * k; };
  put(tr('title', ui), pad, C.dim); nl();
  put(tr('untested', ui), pad, C.warn); nl(1.8);
  ctx.font = `${size}px ${MONO}`;
  const labelW = Math.min(w * 0.45, Math.max(0, ...L.ref.map((r) => (r.label ? ctx.measureText(r.label).width : 0))) + size);
  for (const r of L.ref) {
    if (y > h - size) return;
    if (r.label) { put(r.label, pad, C.dim); put(r.value, pad + labelW, C[r.tone]); } else put(r.value, pad, C[r.tone]);
    nl();
  }
  nl(0.8);
  if (y > h - size * 3) return;
  put(`${tr('phaseTitle', ui)}${L.phase ? ` · ${L.phase.ref}` : ''}`, pad, C.dim); nl();
  if (!L.phase || !phase) { put(tr('phaseNone', ui), pad, C.dim); nl(); }
  else {
    put(`${L.phase.mean}   ${L.phase.sd}`, pad, C.fg); nl();
    put(L.phase.drift, pad, phase.jumps ? C.warn : C.fg); nl(1.6);
    // one frame period as a bar: mean position and ±1 σ
    const bx = pad, bw = w - 2 * pad, bh = Math.max(8, size * 0.8);
    ctx.fillStyle = C.track; ctx.fillRect(bx, y, bw, bh);
    const fx = (ms: number) => bx + (((ms % phase.periodMs) + phase.periodMs) % phase.periodMs) / phase.periodMs * bw;
    const s = Math.min(phase.sdMs, phase.periodMs / 2) / phase.periodMs * bw;
    ctx.fillStyle = 'rgba(0,220,255,0.35)'; ctx.fillRect(Math.max(bx, fx(phase.meanMs) - s), y, Math.min(2 * s, bw), bh);
    ctx.fillStyle = C.accent; ctx.fillRect(fx(phase.meanMs) - 1, y - 3, 3, bh + 6);
    y += bh + size * 0.8;
    put(tr('phaseNote', ui), pad, C.dim); nl();
  }
  if (L.tc && y < h - size * 2) { nl(0.5); put(L.tc, pad, C.fg); nl(); put(tr('tcNote', ui), pad, C.dim); }
}

/** ⚙ settings of the panel: which DeckLink device. */
export function genlockPanelSettings(p: { genlock?: Partial<GenlockOptions> }, save: () => void): Node[] {
  const ui = lang();
  const cur = p.genlock?.device ?? 0;
  const sel = select(String(cur), [], (v) => { p.genlock = { ...p.genlock, device: Number(v) }; save(); });
  const fill = (devs: { index: number; name: string }[]) =>
    sel.replaceChildren(...(devs.length ? devs : [{ index: cur, name: `#${cur}` }]).map((d) => h('option', { value: d.index, selected: d.index === cur }, `${d.index} · ${d.name}`)));
  fill([]);
  fetch(`${bridgeUrl().replace(/^ws/, 'http')}/api/decklink`).then((r) => r.json()).then((j: { devices?: { index: number; name: string }[] }) => fill(j.devices ?? [])).catch(() => {});
  return [field(tr('device', ui), sel), hint(tr('untested', ui))];
}
