// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// "Encoder confidence" panel (idea 8): the panel's source is the return (decoded stream), the
// programme is chosen in ⚙. Samples both while the panel is drawn (25 Hz tick), computes the
// figures of src/encoder.ts and shows them as a table with signs.

import { AV_RATING_TEXT } from './audio/dsp/avsync';
import { avShift, bandingIndex, blockiness, estimateDelay, to10bit, type Thumb } from './encoder';
import type { Source } from './sources';
import { num, t } from './i18n';
import { field, hint, select } from './ui';

export interface EncoderSettings {
  /** id of the programme source (what goes into the encoder) */
  prog?: string;
}

const KR = 0.2126, KB = 0.0722, KG = 1 - KR - KB;
const KEEP_MS = 10_000, EVAL_MS = 1000, HISTORY = 10;

interface Side { thumbs: Thumb[]; seq: number; block: number[]; band: number[]; scaled: boolean }
interface Tracker { prog: Side; ret: Side; lastEval: number; turn: 0 | 1; delay: ReturnType<typeof estimateDelay>; delayAt: number }

const trackers = new Map<string, Tracker>();
const side = (): Side => ({ thumbs: [], seq: -1, block: [], band: [], scaled: false });

/** Luma 0–1 of the CPU frame and a 16×9 thumbnail of means. */
function lumaOf(s: Source) {
  const f = s.cpuFrame();
  if (!f) return null;
  const Y = new Float32Array(f.w * f.h);
  for (let i = 0; i < Y.length; i++) { const c = f.decode(f.px, i * 4); Y[i] = KR * c[0] + KG * c[1] + KB * c[2]; }
  const th = new Float32Array(144), n = new Float32Array(144);
  for (let y = 0; y < f.h; y += 2) for (let x = 0; x < f.w; x += 2) {
    const k = Math.min(8, Math.floor((y * 9) / f.h)) * 16 + Math.min(15, Math.floor((x * 16) / f.w));
    th[k] += Y[y * f.w + x]; n[k]++;
  }
  for (let k = 0; k < 144; k++) th[k] /= n[k] || 1;
  const native = s.info?.sourceWidth || (s.element instanceof HTMLVideoElement ? s.element.videoWidth : s.width);
  return { Y, w: f.w, h: f.h, th, scaled: !!native && native !== f.w };
}

const median = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

function sample(tr: Tracker, prog: Source, ret: Source) {
  const now = performance.now();
  const evalNow = now - tr.lastEval >= EVAL_MS / 2;
  for (const [sd, src, which] of [[tr.prog, prog, 0], [tr.ret, ret, 1]] as const) {
    if (!src.ready || src.frameSeq === sd.seq) continue;
    sd.seq = src.frameSeq;
    const l = lumaOf(src);
    if (!l) continue;
    sd.thumbs.push({ t: now, f: l.th });
    while (sd.thumbs.length && now - sd.thumbs[0].t > KEEP_MS) sd.thumbs.shift();
    // block and banding figures: one side per half second, alternating (CPU budget)
    if (evalNow && tr.turn === which) {
      sd.scaled = l.scaled;
      sd.block.push(blockiness(l.Y.map((v) => v * 255), l.w, l.h).ratio);
      sd.band.push(bandingIndex(to10bit(l.Y, l.w, l.h), l.w, l.h));
      if (sd.block.length > HISTORY) sd.block.shift();
      if (sd.band.length > HISTORY) sd.band.shift();
      tr.turn = which ? 0 : 1; tr.lastEval = now;
    }
  }
  if (now - tr.delayAt > 1000) { tr.delay = estimateDelay(tr.prog.thumbs, tr.ret.thumbs, { maxMs: 8000, stepMs: 20 }); tr.delayAt = now; }
}

type Tone = 'ok' | 'warn' | 'bad' | '';
const TONE: Record<Tone, string> = { ok: '#6fd08c', warn: '#f0c24b', bad: '#ff6b5b', '': '#d6d6d6' };
/** Own thresholds (no standard): return above programme by more than warn / bad. */
const toneOf = (d: number, warn: number, bad: number): Tone => (!Number.isFinite(d) ? '' : d > bad ? 'bad' : d > warn ? 'warn' : 'ok');

export function drawEncoderPanel(ctx: CanvasRenderingContext2D, w: number, _h: number, settings: EncoderSettings | undefined, ret: Source | null, sourceById: (id: string) => Source | null, empty: string) {
  ctx.font = '12px system-ui'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  const prog = settings?.prog ? sourceById(settings.prog) : null;
  // the figures as text for screen readers and tests (the canvas itself is only pixels)
  const said: string[] = [];
  const line = (y: number, label: string, value: string, tone: Tone = '') => {
    said.push(`${label}: ${value}`);
    ctx.canvas.setAttribute('aria-label', said.join('; '));
    ctx.fillStyle = '#9aa0a8'; ctx.fillText(label, 12, y);
    // narrow panels (phones): the value below its label
    const narrow = w < 460;
    ctx.fillStyle = TONE[tone]; ctx.fillText(value, narrow ? 20 : 170, narrow ? y + 15 : y);
    return narrow ? 15 : 0;
  };
  if (!ret || !ret.ready) { ctx.fillStyle = '#6b7078'; ctx.fillText(ret ? (ret.message || t('panel.draw.noData')) : empty, 12, 12); return; }
  if (!prog || prog === ret) { ctx.fillStyle = '#6b7078'; ctx.fillText(t('enc.pickProg'), 12, 12); return; }
  const key = `${prog.id}|${ret.id}`;
  let tr = trackers.get(key);
  if (!tr) { tr = { prog: side(), ret: side(), lastEval: 0, turn: 0, delay: null, delayAt: 0 }; trackers.set(key, tr); }
  sample(tr, prog, ret);
  const bp = median(tr.prog.block), br = median(tr.ret.block), np = median(tr.prog.band), nr = median(tr.ret.band);
  const f2 = (v: number, d = 2) => (Number.isFinite(v) ? num(v, d) : '–');
  const d = tr.delay;
  const avP = prog.audio?.av.result().medianMs ?? null, avR = ret.audio?.av.result().medianMs ?? null, av = avShift(avP, avR);
  let y = 10;
  y += line(y, t('enc.prog'), prog.name) + 18;
  y += line(y, t('enc.ret'), ret.name) + 24;
  y += line(y, t('enc.delay'), d ? t('enc.delayValue', { s: num(d.ms / 1000, 2), conf: num(d.contrast * 100, 0) }) : t('enc.delayNone'), d ? (d.contrast > 0.3 ? 'ok' : 'warn') : '') + 18;
  y += line(y, t('enc.block'), `${f2(bp)} → ${f2(br)}${tr.ret.scaled ? ` · ${t('enc.scaled')}` : ''}`, tr.ret.scaled ? '' : toneOf(br - bp, 0.1, 0.3)) + 18;
  y += line(y, t('enc.band'), `${f2(np)} → ${f2(nr)}`, toneOf(nr - np, 1, 3)) + 18;
  y += line(y, t('enc.av'), av ? t('enc.avValue', { p: f2(avP!, 0), r: f2(avR!, 0), d: `${av.ms > 0 ? '+' : ''}${num(av.ms, 0)}`, rating: AV_RATING_TEXT[av.rating] }) : t('enc.avNone'),
    av ? (av.rating === 'undetectable' ? 'ok' : av.rating === 'acceptable' ? 'warn' : 'bad') : '') + 24;
  ctx.fillStyle = '#7d838c'; ctx.font = '11px system-ui';
  // word wrap to the panel width
  let cur = '';
  for (const word of t('enc.legend').replace(/\n/g, ' ').split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > w - 24) { ctx.fillText(cur, 12, y); y += 15; cur = word; } else cur = next;
  }
  if (cur) ctx.fillText(cur, 12, y);
}

/** ⚙ rows: the programme source. */
export function encoderPanelSettings(p: { encoder?: EncoderSettings; sourceId?: string }, save: () => void, sources: readonly Source[]): Node[] {
  const list: [string, string][] = [['', t('enc.progNone')], ...sources.map((s, i) => [s.id, `${i + 1} ${s.name}`] as [string, string])];
  return [
    field(t('enc.progPick'), select(p.encoder?.prog ?? '', list, (v) => { p.encoder = { ...p.encoder, prog: v || undefined }; save(); }, t('enc.progTitle'))),
    hint(t('enc.hint')),
  ];
}
