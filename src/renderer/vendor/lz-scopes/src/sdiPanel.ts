// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// "SDI signal info" panel (#160): decoded VANC of a DeckLink input (src/vanc.ts) – ST 352 payload ID,
// HDR metadata, ancillary timecode, captions/audio/AFD presence, raw packet list with hex. Warns when
// the ST 352 transfer or colorimetry disagrees with what the scopes read and offers the switch in ⚙.
// NOT TESTED WITH HARDWARE (#116).

import type { Source, SourceSettings } from './sources';
import { num, t } from './i18n';
import { transferLabel } from './color';
import { button, hint, row } from './ui';
import { colorimetryMismatch, hex2, summarise, transferMismatch, type VancSummary } from './vanc';

/** VANC older than this counts as gone (the helper sends at least 4/s while packets change, else on every change). */
const STALE_MS = 3000;

const cache = new WeakMap<object, VancSummary>();
/** Decoded VANC of a source, null without a fresh record. */
export function vancOf(src: Source | null): VancSummary | null {
  const v = src?.vanc;
  if (!v || performance.now() - v.at > STALE_MS) return null;
  let s = cache.get(v);
  if (!s) { s = summarise(v.packets); cache.set(v, s); }
  return s;
}

const TRANSFER_NAME = { sdr: 'SDR', hlg: 'HLG', pq: 'PQ', unspecified: '?' } as const;
const yesNo = (b: boolean) => (b ? t('sdi.yes') : t('sdi.no'));

/** Text rows of the panel (also the canvas aria-label); kind sets the colour. */
export function sdiRows(s: VancSummary, src: Source): { text: string; kind?: 'head' | 'warn' | 'ok' | 'dim' }[] {
  const out: { text: string; kind?: 'head' | 'warn' | 'ok' | 'dim' }[] = [];
  const p = s.st352;
  if (p) {
    const tm = transferMismatch(p.transfer, src.transfer), cm = colorimetryMismatch(p.colorimetry, src.colorspace);
    if (tm) out.push({ text: t('sdi.warnTransfer', { sig: TRANSFER_NAME[tm], scope: transferLabel(src.transfer) }), kind: 'warn' });
    if (cm) out.push({ text: t('sdi.warnColorimetry', { sig: cm === '2020' ? 'Rec.2020' : 'Rec.709', scope: src.colorspace }), kind: 'warn' });
    out.push({ text: `ST 352  ${p.bytes.map(hex2).join(' ')}`, kind: 'head' });
    out.push({ text: p.standard ?? t('sdi.unknownPayload', { code: hex2(p.payload) }) });
    out.push({ text: t('sdi.format', { rate: p.rate ?? '?', scan: p.progressivePicture ? (p.progressiveTransport ? 'p' : 'PsF') : 'i', sampling: p.sampling ?? '?', bits: p.bitDepth ?? '?' }) });
    out.push({ text: t('sdi.colour', { transfer: TRANSFER_NAME[p.transfer], colorimetry: { '709': 'Rec.709', '2020': 'Rec.2020', reserved: '?', unknown: '?' }[p.colorimetry], aspect: p.aspect16x9 ? '16:9' : '4:3' }) + (p.ictcp ? ' · ICtCp' : '') });
  } else out.push({ text: t('sdi.no352'), kind: 'dim' });
  if (s.hdr) {
    out.push({ text: 'ST 2108-1', kind: 'head' });
    if (s.hdr.mdcv) out.push({ text: t('sdi.mdcv', { max: num(s.hdr.mdcv.maxNits, 0), min: num(s.hdr.mdcv.minNits, 4), rx: num(s.hdr.mdcv.primaries[0][0], 3), gy: num(s.hdr.mdcv.primaries[1][1], 3) }) });
    if (s.hdr.cll) out.push({ text: t('sdi.cll', { cll: s.hdr.cll.maxCll, fall: s.hdr.cll.maxFall }) });
    if (s.hdr.dynamic.length) out.push({ text: t('sdi.dynamic', { types: s.hdr.dynamic.join(', ') }) });
  }
  for (const a of s.atc) out.push({ text: `ST 12-2 ${a.kind.toUpperCase()}  ${a.tc}  UB ${a.userBits}` });
  if (s.afd) out.push({ text: t('sdi.afd', { code: s.afd.afd.toString(2).padStart(4, '0'), frame: s.afd.frame16x9 ? '16:9' : '4:3' }) });
  out.push({ text: t('sdi.presence', { c708: yesNo(s.cea708), c608: yesNo(s.cea608), audio: s.audioGroups.length ? s.audioGroups.join(', ') : '–', ctrl: s.audioControl.length ? s.audioControl.join(', ') : '–' }) });
  out.push({ text: t('sdi.packets', { n: s.packets.length }), kind: 'head' });
  for (const k of s.packets) {
    const data = k.data.length > 48 ? `${k.data.slice(0, 48)}…` : k.data;
    out.push({ text: `L${k.line} ${hex2(k.did)}/${hex2(k.sdid)} ×${k.count} ${k.name ?? ''}  ${data.toUpperCase()}`, kind: 'dim' });
  }
  return out;
}

const COLOURS = { head: '#9aa0a8', warn: '#f0c24b', ok: '#6fd08c', dim: '#8d939b' } as const;

export function drawSdiPanel(ctx: CanvasRenderingContext2D, w: number, h: number, src: Source | null, empty: string) {
  const msg = (text: string) => { ctx.fillStyle = '#6b7078'; ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2); ctx.canvas.setAttribute('aria-label', text); };
  if (!src) { msg(empty); return; }
  const s = vancOf(src);
  if (!s) { msg(src.url.startsWith('decklink:') ? t('sdi.waiting') : t('sdi.noVanc')); return; }
  const rows = sdiRows(s, src);
  ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  let y = 8;
  for (const r of rows) {
    if (y > h - 14) break;
    ctx.fillStyle = r.kind ? COLOURS[r.kind] : '#d6d6d6';
    ctx.fillText(r.text, 8, y, w - 16);
    y += r.kind === 'head' ? 17 : 15;
  }
  ctx.canvas.setAttribute('aria-label', rows.map((r) => r.text).join('; '));
}

/** ⚙ rows: switch the source's transfer/matrix to what ST 352 signals. */
export function sdiPanelSettings(src: Source | null, apply: (patch: Partial<SourceSettings>) => void): Node[] {
  const s = vancOf(src), p = s?.st352;
  if (!src || !p) return [hint(t('sdi.hint'))];
  const tm = transferMismatch(p.transfer, src.transfer), cm = colorimetryMismatch(p.colorimetry, src.colorspace);
  return [
    ...(tm || cm ? [row(button(t('sdi.follow'), () => apply({ ...(tm ? { transfer: tm } : {}), ...(cm ? { colorspace: cm } : {}) }), { variant: 'primary', title: t('sdi.followTitle') }))] : [hint(t('sdi.agree'))]),
    hint(t('sdi.hint')),
  ];
}
