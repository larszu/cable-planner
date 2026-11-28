// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Inputs that live in the bridge, added from "+ Quelle" (#221): capture devices (device:…),
// NDI®, DeckLink and AJA; and their source-card controls: mode/pixel format, Blackmagic DeckLink and AJA cards through the native helpers, and the
// explicit decode matrix of the bridge's Y′CbCr → R′G′B′ step.

import type { Source, SourceSettings } from './sources';
import { t } from './i18n';
import { bridgeText } from './i18n/bridgeMessage';
import { button, h, hint, link, openModal, row, select } from './ui';
import { openDeckLinkSetup, type DeckLinkStatus } from './decklinkSetup';
import { ndiName } from './deviceScan';
import { ajaInputName, openAjaSetup, type AjaStatus } from './ajaSetup';

export interface BridgeUi {
  /** http(s) base of the bridge */
  http: () => string;
  /** set URL + name and connect */
  connect: (url: string, name?: string) => void;
  upd: (patch: Partial<SourceSettings>, reconnect?: boolean) => void;
  hud: (msg: string) => void;
}

interface DeviceFormats { modes: { width: number; height: number; fpsMin: number; fpsMax: number; pixfmt?: string }[]; pixfmts: string[]; preferred: string | null; defaultSize: string | null }

const formatCache = new Map<string, DeviceFormats | 'loading'>();


const DEEP = /(p10|p12|p16|p210|p216|y210|v210|48)/;

/** Mode and pixel format of a bridge capture device (lists come from ffmpeg on the bridge's machine). */
export function deviceRow(s: Source, ui: BridgeUi, rerender: () => void): Node | null {
  if (!s.url.startsWith('device:')) return null;
  const f = formatCache.get(s.url);
  if (!f) {
    formatCache.set(s.url, 'loading');
    fetch(`${ui.http()}/api/devices/formats?url=${encodeURIComponent(s.url)}`).then((r) => r.json())
      .then((j: DeviceFormats) => { formatCache.set(s.url, j); rerender(); })
      .catch(() => formatCache.delete(s.url));
  }
  if (!f || f === 'loading') return h('div', { class: 'row hint' }, t('bridgeui.readingFormats'));
  const d = s.settings.device ?? {};
  const sizes = [...new Set(f.modes.map((m) => `${m.width}x${m.height}`))];
  const rates = [...new Set(f.modes.filter((m) => !d.size || `${m.width}x${m.height}` === d.size).flatMap((m) => [m.fpsMax, m.fpsMin]).filter((r) => r > 0))].sort((a, b) => b - a);
  const set = (patch: Partial<NonNullable<SourceSettings['device']>>) => {
    const device = { ...d, ...patch };
    for (const k of Object.keys(device) as (keyof typeof device)[]) if (!device[k]) delete device[k];
    // deep pixel formats only pay off with 16-bit transport
    ui.upd({ device, ...(patch.pixfmt && DEEP.test(patch.pixfmt) ? { depth: 16 as const } : {}) }, true);
  };
  return row(
    sizes.length ? select(d.size ?? '', [['', `${t('bridgeui.modeAuto')}${f.defaultSize ? ` (${f.defaultSize})` : ''}`], ...sizes.map((x) => [x, x.replace('x', '×')] as [string, string])], (v) => set({ size: v, rate: '' }), t('bridgeui.resolutionTitle')) : '',
    rates.length ? select(d.rate ?? '', [['', 'fps auto'], ...rates.map((r) => [String(r), `${r} fps`] as [string, string])], (v) => set({ rate: v }), t('bridgeui.rateTitle')) : '',
    f.pixfmts.length ? select(d.pixfmt ?? '', [['', `Pixel auto${f.preferred ? ` (${f.preferred})` : ''}`], ...f.pixfmts.map((p) => [p, DEEP.test(p) ? `${p} · >8 bit` : p] as [string, string])], (v) => set({ pixfmt: v }),
      t('bridgeui.pixfmtTitle')) : h('span', { class: 'hint' }, t('bridgeui.noFormatList')));
}

/** Matrix and range the bridge uses for Y′CbCr → R′G′B′ (all bridge sources). */
export function decodeRow(s: Source, ui: BridgeUi): Node | null {
  if (s.kind !== 'stream' || s.url === 'resolve:' || s.url.startsWith('test:') || s.url.startsWith('st2110:')) return null;
  const set = s.settings;
  const auto = (s.info as { decodeMatrix?: string } | null)?.decodeMatrix;
  return row(
    select(set.decodeMatrix ?? 'auto', [['auto', `${t('bridgeui.convAuto')}${auto ? ` (${auto})` : ''}`], ['bt709', t('bridgeui.conv', { m: 'BT.709' })], ['bt601', t('bridgeui.conv', { m: 'BT.601' })], ['bt2020', t('bridgeui.conv', { m: 'BT.2020' })]],
      (v) => ui.upd({ decodeMatrix: v as SourceSettings['decodeMatrix'] }, true), t('bridgeui.matrixTitle')),
    select(set.decodeRange ?? 'auto', [['auto', t('bridgeui.rangeAuto')], ['tv', t('bridgeui.rangeTv')], ['pc', t('bridgeui.rangePc')]],
      (v) => ui.upd({ decodeRange: v as SourceSettings['decodeRange'] }, true), t('bridgeui.rangeTitle')));
}

/**
 * Field order and de-interlacing of an interlaced bridge source (#219, server/interlace.mjs).
 * The de-interlacing choice appears once the source is (or is set to be) interlaced.
 */
export function interlaceRow(s: Source, ui: BridgeUi): Node | null {
  if (s.kind !== 'stream' || s.url === 'resolve:' || s.url.startsWith('test:')) return null;
  const set = s.settings, info = s.info;
  const field = set.fieldOrder ?? 'auto';
  const reported = info?.sourceFields ? t(info.sourceFields === 'bff' ? 'bridgeui.fieldsBff' : 'bridgeui.fieldsTff') : info ? t('bridgeui.fieldsProgressive') : '';
  const interlaced = !!info?.interlaced || field === 'tff' || field === 'bff' || !!set.deinterlace;
  return row(
    select(field, [['auto', `${t('bridgeui.fieldsAuto')}${reported ? ` (${reported})` : ''}`], ['progressive', t('bridgeui.fieldsProgressive')], ['tff', t('bridgeui.fieldsTff')], ['bff', t('bridgeui.fieldsBff')]],
      (v) => ui.upd({ fieldOrder: v as SourceSettings['fieldOrder'] }, true), t('bridgeui.fieldsTitle')),
    interlaced ? select(set.deinterlace ? '1' : '0', [['0', t('bridgeui.deintOff')], ['1', t('bridgeui.deintOn')]],
      (v) => ui.upd({ deinterlace: v === '1' }, true), t('bridgeui.deintTitle')) : '');
}

/**
 * "+ Quelle → Capture-Gerät (Bridge)": capture devices of the bridge's machine (ffmpeg
 * dshow/AVFoundation/V4L2), one click per device, with the sound to go with it (#221).
 */
export async function addCaptureDevice(http: () => string, hud: (m: string) => void, add: (url: string, name: string) => void) {
  let list: { name: string; url: string; kind?: string }[] | null = null;
  try { list = await (await fetch(`${http()}/api/devices`)).json(); } catch { /* bridge missing */ }
  if (!list) { hud(t('bridgeui.bridgeUnreachable')); return; }
  const video = list.filter((d) => d.kind !== 'audio'), audio = list.filter((d) => d.kind === 'audio');
  if (!video.length) { hud(t('bridgeui.noCaptureDevices')); return; }
  // sound to the picture from the same ffmpeg process (#audio=…): A/V timestamps comparable (#24)
  const snd = select('', [['', t('bridgeui.noSound')], ...audio.map((d) => [d.url, t('bridgeui.soundOf', { name: d.name })] as [string, string])], () => {}, t('bridgeui.soundTitle'));
  const guess = audio.find((a) => video.some((v) => v.name === a.name)) ?? audio.find((a) => /capture|hdmi|usb3/i.test(a.name));
  if (guess) snd.value = guess.url;
  const m = openModal({ title: t('bridgeui.chooseDevice'), size: 'sm', body: [
    ...(audio.length ? [row(snd)] : []),
    ...video.map((d) => button(d.name, () => {
      m.close();
      // audio:<api>:<name> → #audio=<name> (ALSA: hw:…)
      const a = snd.value.replace(/^audio:[a-z]+:/, '');
      add(a ? `${d.url}#audio=${a}` : d.url, d.name);
    }, { attrs: { style: 'display:block;width:100%;margin-bottom:6px' } })),
  ] });
}

const deckLinkStatus = async (ui: BridgeUi): Promise<DeckLinkStatus | null> => {
  try { return await (await fetch(`${ui.http()}/api/decklink`)).json(); } catch { return null; /* bridge missing */ }
};
/** Last device list per bridge: the input connectors of a DeckLink source come from here. */
const deckLinkDevices = new Map<string, DeckLinkStatus['devices']>();

/**
 * "+ Quelle → Blackmagic DeckLink": straight to the device without the stream card. One device
 * connects at once, several get a short list; without a usable device the setup steps open.
 */
export async function addDeckLink(http: () => string, hud: (m: string) => void, add: (url: string, name: string) => void) {
  const ui = { http } as BridgeUi;
  const st = await deckLinkStatus(ui);
  if (!st) { hud(t('bridgeui.bridgeUnreachable')); return; }
  const pick = (s: DeckLinkStatus) => {
    deckLinkDevices.set(http(), s.devices);
    if (s.devices.length === 1) return add(`decklink:${s.devices[0].index}`, s.devices[0].name);
    const m = openModal({ title: t('bridgeui.chooseDecklink'), size: 'sm', body: s.devices.map((d) =>
      button(d.name, () => { m.close(); add(`decklink:${d.index}`, d.name); }, { attrs: { style: 'display:block;width:100%;margin-bottom:6px' } })) });
  };
  if (!st.available || !st.devices.length) { openDeckLinkSetup(st, () => deckLinkStatus(ui), pick); return; }
  pick(st);
}

/** 8/10 bit for DeckLink sources. */
export function deckLinkRow(s: Source, ui: BridgeUi): Node | null {
  if (!s.url.startsWith('decklink:')) return null;
  return row(
    // capture and transport together: 10 bit from the card needs the 16-bit transport, 8 bit is enough with 8
    select(String(s.settings.deckLinkBits ?? 10), [['10', t('bridgeui.decklink10')], ['8', t('bridgeui.decklink8')]], (v) => ui.upd({ deckLinkBits: Number(v) as 8 | 10, depth: v === '10' ? 16 : 8, yuv: false }, true), t('bridgeui.decklinkFormatTitle')),
    inputSelect(s, ui),
    button(t('bridgeui.decklinkSetup'), async () => { const st = await deckLinkStatus(ui); if (st) openDeckLinkSetup(st, () => deckLinkStatus(ui)); else ui.hud(t('bridgeui.bridgeUnreachable')); },
      { small: true, variant: 'ghost', title: t('bridgeui.decklinkSetupTitle') }));
}

const CONNECTOR_NAMES: Record<string, string> = { sdi: 'SDI', hdmi: 'HDMI', optical: 'Optical SDI', component: 'Component', composite: 'Composite', svideo: 'S-Video' };

/** SDI/HDMI … when the device has more than one input (list from adding the source, else fetched once). */
function inputSelect(s: Source, ui: BridgeUi): Node | '' {
  const index = Number(s.url.slice('decklink:'.length));
  const list = deckLinkDevices.get(ui.http());
  if (!list) {
    deckLinkDevices.set(ui.http(), []);
    void deckLinkStatus(ui).then((st) => { if (st?.devices.length) { deckLinkDevices.set(ui.http(), st.devices); ui.upd({}, false); } });
    return '';
  }
  const dev = list.find((d) => d.index === index);
  if (!dev?.inputs || dev.inputs.length < 2) return '';
  return select(s.settings.deckLinkInput ?? '', [['', `${t('bridgeui.decklinkInputAuto')}${dev.input ? ` (${CONNECTOR_NAMES[dev.input] ?? dev.input})` : ''}`], ...dev.inputs.map((i) => [i, CONNECTOR_NAMES[i] ?? i] as [string, string])],
    (v) => ui.upd({ deckLinkInput: v || undefined }, true), t('bridgeui.decklinkInputTitle'));
}

const ajaStatus = async (ui: Pick<BridgeUi, 'http'>): Promise<AjaStatus | null> => {
  try { return await (await fetch(`${ui.http()}/api/aja`)).json(); } catch { return null; /* bridge missing */ }
};
/** Last AJA device list per bridge: inputs and detected formats of an AJA source come from here. */
const ajaDevices = new Map<string, AjaStatus['devices']>();
const ajaLabel = (d: AjaStatus['devices'][number]) => `${d.name}${d.busy ? ` (${t('bridgeui.ajaBusy')})` : ''}`;

/**
 * "+ Quelle → AJA": straight to the card without the stream card. One card connects at once,
 * several get a short list; without a usable card the setup steps open.
 */
export async function addAja(http: () => string, hud: (m: string) => void, add: (url: string, name: string) => void) {
  const st = await ajaStatus({ http });
  if (!st) { hud(t('bridgeui.bridgeUnreachable')); return; }
  const pick = (s: AjaStatus) => {
    ajaDevices.set(http(), s.devices);
    if (s.devices.length === 1) return add(`aja:${s.devices[0].index}`, s.devices[0].name);
    const m = openModal({ title: t('bridgeui.chooseAja'), size: 'sm', body: s.devices.map((d) =>
      button(ajaLabel(d), () => { m.close(); add(`aja:${d.index}`, d.name); }, { attrs: { style: 'display:block;width:100%;margin-bottom:6px' } })) });
  };
  if (!st.available || !st.devices.length) { openAjaSetup(st, () => ajaStatus({ http }), pick); return; }
  pick(st);
}

/** 8/10 bit, input connector and setup for AJA sources. */
export function ajaRow(s: Source, ui: BridgeUi): Node | null {
  if (!s.url.startsWith('aja:')) return null;
  return row(
    select(String(s.settings.ajaBits ?? 10), [['10', t('bridgeui.aja10')], ['8', t('bridgeui.aja8')]], (v) => ui.upd({ ajaBits: Number(v) as 8 | 10, depth: v === '10' ? 16 : 8, yuv: false }, true), t('bridgeui.decklinkFormatTitle')),
    ajaInputSelect(s, ui),
    button(t('bridgeui.decklinkSetup'), async () => { const st = await ajaStatus(ui); if (st) openAjaSetup(st, () => ajaStatus(ui)); else ui.hud(t('bridgeui.bridgeUnreachable')); },
      { small: true, variant: 'ghost', title: t('bridgeui.ajaSetupTitle') }));
}

/** SDI 1 / SDI 2 / HDMI 1 … with the format detected on each (list from adding the source, else fetched once). */
function ajaInputSelect(s: Source, ui: BridgeUi): Node | '' {
  const index = Number(s.url.slice('aja:'.length));
  const list = ajaDevices.get(ui.http());
  if (!list) {
    ajaDevices.set(ui.http(), []);
    void ajaStatus(ui).then((st) => { if (st?.devices.length) { ajaDevices.set(ui.http(), st.devices); ui.upd({}, false); } });
    return '';
  }
  const dev = list.find((d) => d.index === index);
  if (!dev?.inputs || dev.inputs.length < 2) return '';
  const label = (i: string) => `${ajaInputName(i)}${dev.signals?.[i] ? ` · ${dev.signals[i]}` : ''}`;
  return select(s.settings.ajaInput ?? '', [['', `${t('bridgeui.ajaInputAuto')} (${label(dev.inputs[0])})`], ...dev.inputs.map((i) => [i, label(i)] as [string, string])],
    (v) => ui.upd({ ajaInput: v || undefined }, true), t('bridgeui.decklinkInputTitle'));
}

interface NdiStatus { available: boolean; helper: boolean; runtime: boolean; version?: string; sources: { name: string; url: string }[]; error?: string }

/** NDI SDK licence: link to ndi.video close to where NDI is selected, trademark notice. */
export const NDI_NOTICE = 'NDI® is a registered trademark of Vizrt NDI AB.';
const ndiLink = () => { const a = link('https://ndi.video/', 'ndi.video'); a.title = NDI_NOTICE; return a; };

/** "+ Quelle → NDI®": sources the helper on the bridge's machine finds; says plainly when the runtime is missing. */
export async function addNdi(http: () => string, hud: (m: string) => void, add: (url: string, name: string) => void) {
  let st: NdiStatus | null = null;
  try { st = await (await fetch(`${http()}/api/ndi`)).json(); } catch { /* bridge missing */ }
  if (!st) { hud(t('bridgeui.bridgeUnreachable')); return; }
  if (!st.available) { hud(t('bridgeui.ndiUnavailable', { why: bridgeText(st, 'error') || t('bridgeui.ndiNeeds') })); return; }
  if (!st.sources.length) { hud(t('bridgeui.noNdiSources')); return; }
  const m = openModal({ title: t('bridgeui.chooseNdi'), size: 'sm', body: [
    ...st.sources.map((x) => button(x.name, () => { m.close(); add(`ndi:${x.name}`, ndiName(x.name)); }, { attrs: { style: 'display:block;width:100%;margin-bottom:6px' } })),
    h('p', { class: 'hint' }, ndiLink(), ` · ${NDI_NOTICE}`),
  ] });
}

/** Link and trademark notice on NDI sources (NDI SDK licence). */
export function ndiRow(s: Source): Node | null {
  if (!s.url.startsWith('ndi:')) return null;
  return h('div', { class: 'row hint' }, `${t('bridgeui.ndiVia')} · `, ndiLink(), ` · ${NDI_NOTICE}`);
}

/** Watch folders of the bridge (released with --watch-dir, in the desktop app by dialog). */
export function folderButton(ui: BridgeUi, release?: () => Promise<{ name: string; url: string } | null>): HTMLElement {
  return button(t('bridgeui.folder'), async (e: Event) => {
    const btn = e.currentTarget as HTMLElement;
    let list: { name: string; url: string }[] = [];
    try { list = await (await fetch(`${ui.http()}/api/folders`)).json(); } catch { /* bridge missing */ }
    const add = async () => { const r = await release?.(); if (r) ui.connect(r.url, r.name); };
    if (!list.length && !release) { ui.hud(t('bridgeui.noFolders')); return; }
    if (!list.length) { await add(); return; }
    btn.replaceWith(select('', [['', t('bridgeui.chooseFolder')], ...list.map((f) => [f.url, f.name] as [string, string]), ...(release ? [['+', t('bridgeui.releaseFolder')] as [string, string]] : [])],
      (v) => { if (v === '+') add(); else if (v) ui.connect(v, list.find((f) => f.url === v)?.name); }));
  }, { small: true, title: t('bridgeui.folderTitle') });
}

/** How to get stills out of Lightroom, Capture One and Resolve into a watch folder. */
export function STILL_WORKFLOW(): HTMLElement {
  return h('div', {}, ([1, 2, 3, 4, 5] as const).map((n) => hint(t(`bridgeui.still.${n}`))));
}
