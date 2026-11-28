// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// ST 2110 network receive in the UI (#226, #227, #230, #232): the source dialog that builds an
// `st2110:` URL (SDP or by hand, server/sdp.mjs), the pcap controls on the source card and the
// lines of the Messwerte panel. Reception, decoding and the ST 2022-7 evaluation are in the
// bridge (server/st2110.mjs); every time there is a software receive time, not a NIC time stamp.

import type { Source } from './sources';
import type { BridgeUi } from './bridgeInputs';
import { t } from './i18n';
import { bridgeMessage, bridgeText } from './i18n/bridgeMessage';
import { button, field, h, hint, openModal, row, select } from './ui';

export interface DupStats {
  paths: { packets: number; only: number; duplicates: number; jitterMs: number; silentMs: number | null }[];
  both: number; lostBoth: number; late: number; tsMismatch: number;
  offsetMs: number | null; offsetMinMs: number | null; offsetMaxMs: number | null;
  offset10sMinMs: number | null; offset10sMaxMs: number | null;
  pdMaxMs: number | null; bufferMs: number | null; bufferPackets: number | null; class: string | null;
  mbit: number | null; hbr: boolean;
}
export interface FlowStats {
  essence: 'audio30' | 'audio31' | 'anc40' | 'fmx41'; encoding: string; clock: number; channels: number;
  paths: { dest: string; port: number; source: string; error?: string; errorCode?: string; errorParams?: Record<string, unknown> }[];
  packets: number; badRtp: number; ptMismatch: number; payloadErrors: number; ssrcChanges: number;
  lost: number; reordered: number; jitterMs: number; dup: DupStats | null;
  audio?: { frames: number; validity: number; blocks: number; parity: number; overlap: number; order: string[] };
  anc?: { frames: number; packets: number; checksum: number; parity: number; fieldErr: number; types: Record<string, number> };
  fmx?: { items: number; types: Record<string, number> };
}
export interface St2110Stats {
  flows: FlowStats[]; audioGaps: number; audioSent: number;
  capture: { snapshot: boolean; ring: { seconds: number; maxBytes: number; bytes: number; packets: number; spanS: number } | null };
}
export interface PcapState { state: 'capturing' | 'saved' | 'ring' | 'error'; file?: string; packets?: number; bytes?: number; message?: string; code?: string; params?: Record<string, unknown> }

export interface St2110Manual {
  kind: 'audio' | 'anc';
  /** dest:port[@source], second one = ST 2022-7 path */
  primary: string; secondary?: string;
  fmt?: 'L24' | 'L16' | 'AM824'; rate?: number; ch?: number; order?: string;
  iface?: string; iface2?: string;
}

/** st2110: URL from SDP text(s) (one SDP object per flow, ST 2110-10) or from manual values. */
export function st2110Url(o: { sdp?: string[]; manual?: St2110Manual }): string {
  const q = new URLSearchParams();
  for (const s of o.sdp ?? []) if (s.trim()) q.append('sdp', s.trim());
  const m = o.manual;
  if (m?.primary) {
    const paths = [m.primary, m.secondary].map((x) => x?.trim()).filter(Boolean).join(',');
    if (m.kind === 'audio') {
      q.set('audio', paths); q.set('fmt', m.fmt ?? 'L24'); q.set('rate', String(m.rate ?? 48000)); q.set('ch', String(m.ch ?? 2));
      if (m.order?.trim()) q.set('order', m.order.trim());
    } else q.set('anc', paths);
  }
  if (m?.iface) q.set('iface', m.iface);
  if (m?.iface2) q.set('iface2', m.iface2);
  return `st2110:?${q}`;
}

/** Name for the source card: SDP s= line, else the essence. */
export function st2110Name(url: string): string {
  const q = new URLSearchParams(url.slice('st2110:'.length).replace(/^\?/, ''));
  const s = /^s=(.+)$/m.exec(q.get('sdp') ?? '')?.[1]?.trim();
  if (s && s !== '-') return s.slice(0, 40);
  return q.get('anc') && !q.get('audio') ? 'ST 2110-40' : 'ST 2110-30';
}

const ms = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(d));
const ESSENCE: Record<FlowStats['essence'], string> = { audio30: '2110-30', audio31: '2110-31', anc40: '2110-40', fmx41: '2110-41' };

/** Lines for the Messwerte panel (sound-only source: this is what it has instead of picture values). */
export function st2110Lines(st: St2110Stats | null | undefined): string[] {
  if (!st) return [];
  const pad = '           ';
  const out = ['', `ST 2110    ${t('st2110.lines.flows', { n: st.flows.length })}${st.audioGaps ? ` · ${t('st2110.lines.gaps', { n: st.audioGaps })}` : ''}`];
  for (const f of st.flows) {
    const addr = f.paths.map((p) => `${p.dest}:${p.port}`).join(' + ');
    const fmt = f.essence.startsWith('audio') ? `${f.encoding} ${f.clock / 1000} kHz ${f.channels} ch` : f.encoding;
    out.push(`${ESSENCE[f.essence].padEnd(11)}${fmt}  ${addr}`);
    for (const p of f.paths) if (p.error) out.push(`${pad}${bridgeText(p, 'error')}`);
    out.push(`${pad}${t('st2110.lines.packets', { n: f.packets, lost: f.lost, re: f.reordered, jitter: ms(f.jitterMs) })}${f.badRtp || f.ptMismatch ? ` · ${t('st2110.lines.bad', { n: f.badRtp + f.ptMismatch })}` : ''}`);
    if (f.audio) out.push(`${pad}${t('st2110.lines.audio', { order: f.audio.order.join(' + ') || '–' })}${f.essence === 'audio31' ? ` · ${t('st2110.lines.aes3', { v: f.audio.validity, b: f.audio.blocks, p: f.audio.parity })}` : ''}`);
    if (f.anc) {
      const types = Object.entries(f.anc.types).map(([k, n]) => `${k} ×${n}`).join('  ');
      out.push(`${pad}${t('st2110.lines.anc', { n: f.anc.packets, cs: f.anc.checksum, par: f.anc.parity })}${types ? ` · ${types}` : ''}`);
    }
    if (f.fmx) out.push(`${pad}${t('st2110.lines.fmx', { n: f.fmx.items })} ${Object.keys(f.fmx.types).join(' ')}`);
    const d = f.dup;
    if (d) {
      out.push(`2022-7     ${t('st2110.lines.offset', { now: ms(d.offsetMs), min: ms(d.offsetMinMs), max: ms(d.offsetMaxMs) })}`);
      out.push(`${pad}${t('st2110.lines.buffer', { pd: ms(d.pdMaxMs), buf: ms(d.bufferMs), n: d.bufferPackets ?? '–', cls: d.class ?? '–' })}`);
      out.push(`${pad}${t('st2110.lines.paths', { a: d.paths[0]?.only ?? 0, b: d.paths[1]?.only ?? 0, both: d.lostBoth, ja: ms(d.paths[0]?.jitterMs), jb: ms(d.paths[1]?.jitterMs) })}`);
    }
  }
  out.push(`${pad}${t('st2110.lines.software')}`);
  return out;
}

/** Button "ST 2110…" next to NDI/folder: SDP pasted, or address and format by hand. */
export function openSt2110Dialog(ui: BridgeUi) {
  const sdp = h('textarea', { rows: 8, placeholder: 'v=0\no=- …\ns=…\nm=audio 5004 RTP/AVP 97\n…', 'data-st2110': 'sdp', spellcheck: false }) as HTMLTextAreaElement;
  const text = (attr: string, placeholder: string, title: string) => h('input', { type: 'text', placeholder, title, 'data-st2110': attr, spellcheck: false }) as HTMLInputElement;
  const primary = text('primary', '239.x.x.x:5004', t('st2110.primaryTitle'));
  const secondary = text('secondary', t('st2110.optional'), t('st2110.secondaryTitle'));
  const order = text('order', 'SMPTE2110.(ST)', t('st2110.orderTitle'));
  const iface = text('iface', t('st2110.optional'), t('st2110.ifaceTitle'));
  let kind: St2110Manual['kind'] = 'audio', fmt: NonNullable<St2110Manual['fmt']> = 'L24', rate = 48000, ch = 2;
  const chSel = select('2', [1, 2, 4, 8, 16, 32, 64].map((n) => [String(n), String(n)] as [string, string]), (v) => { ch = Number(v); }, t('st2110.chTitle'));
  const err = h('p', { class: 'hint', 'data-st2110': 'error' });
  const go = () => {
    const url = st2110Url({ sdp: sdp.value.trim() ? sdp.value.split(/\n(?=v=0)/) : [], manual: primary.value.trim() ? { kind, primary: primary.value, secondary: secondary.value, fmt, rate, ch, order: order.value, iface: iface.value.trim() } : undefined });
    if (url === 'st2110:?') { err.textContent = t('st2110.nothing'); return; }
    m.close();
    ui.connect(url, st2110Name(url));
  };
  const m = openModal({
    title: t('st2110.title'), size: 'md',
    body: [
      hint(t('st2110.intro')),
      field(t('st2110.sdp'), sdp),
      hint(t('st2110.or')),
      field(t('st2110.kind'), select('audio', [['audio', t('st2110.kindAudio')], ['anc', t('st2110.kindAnc')]], (v) => { kind = v as St2110Manual['kind']; })),
      field(t('st2110.primary'), primary),
      field(t('st2110.secondary'), secondary),
      field(t('st2110.format'),
        select('L24', [['L24', 'L24 (2110-30)'], ['L16', 'L16 (2110-30)'], ['AM824', 'AM824 (2110-31)']], (v) => { fmt = v as typeof fmt; }),
        select('48000', [['44100', '44,1 kHz'], ['48000', '48 kHz'], ['96000', '96 kHz']], (v) => { rate = Number(v); }),
        chSel),
      field(t('st2110.order'), order),
      field(t('st2110.iface'), iface),
      err,
    ],
    actions: [button(t('st2110.connect'), go, { variant: 'primary', attrs: { 'data-st2110': 'connect' } })],
  });
}

/** pcap snapshot / rolling capture on the card of an st2110: source (#232). */
export function st2110Row(s: Source, ui: BridgeUi): Node | null {
  if (!s.url.startsWith('st2110:')) return null;
  const ring = s.pcapRing;
  const p = s.pcap;
  const send = (m: object) => { if (!s.sendBridge({ type: 'pcap', ...m })) ui.hud(t('bridgeui.bridgeUnreachable')); };
  const fileLink = p?.state === 'saved' && p.file
    ? h('a', { href: `${ui.http()}/api/st2110/file?name=${encodeURIComponent(p.file)}`, download: p.file, 'data-st2110': 'file' }, t('st2110.download', { kb: Math.round((p.bytes ?? 0) / 1024) }))
    : null;
  const state = p?.state === 'capturing' ? t('st2110.capturing') : p?.state === 'error' ? bridgeMessage(p) : '';
  return h('div', {},
    row(
      button(t('st2110.snapshot'), () => send({ cmd: 'snapshot', seconds: 5 }), { small: true, disabled: p?.state === 'capturing', title: t('st2110.snapshotTitle'), attrs: { 'data-st2110': 'snapshot' } }),
      button(ring ? t('st2110.ringOff') : t('st2110.ringOn'), () => send({ cmd: 'ring', mode: ring ? 'off' : 'on', seconds: 60 }), { small: true, pressed: !!ring, title: t('st2110.ringTitle') }),
      ring ? button(t('st2110.ringSave'), () => send({ cmd: 'save' }), { small: true, title: t('st2110.ringSaveTitle') }) : '',
      state ? h('span', { class: 'hint' }, state) : '',
      fileLink ?? ''),
    hint(t('st2110.pcapNote')));
}
