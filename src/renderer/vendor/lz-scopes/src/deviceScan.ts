// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Device discovery for the source list (#221, UX analysis 11/2026): the bridge is asked every few
// seconds which DeckLink, AJA and NDI® inputs, which capture devices (ffmpeg dshow /
// AVFoundation / V4L2, /api/devices) and which ST 2110 network inputs with an SDP it sees. They show as suggestions above the source list –
// nothing is added by itself, because every analysed input costs CPU and GPU.

export interface Found {
  url: string; name: string; kind: 'decklink' | 'aja' | 'ndi' | 'device' | 'st2110';
  /**
   * A Blackmagic card seen as a system camera (Windows "Blackmagic WDM Device", macOS
   * "UltraStudio …" camera) while the DeckLink helper finds nothing: no add button, a hint to the
   * DeckLink source instead – that camera path is 8 bit, without sound, and on Windows often black.
   */
  blackmagicCamera?: boolean;
}
interface DevList { available?: boolean; devices?: { index: number; name: string }[] }
interface NdiList { available?: boolean; sources?: { name: string }[] }
export interface CaptureList { name: string; url: string; kind?: string }
/** GET /api/st2110 (server/st2110/service.mjs): network inputs; connected ones have an SDP */
interface NetList { inputs?: { url: string; connected: boolean; summary?: { name?: string; format?: string } | null }[] }

/** NDI names are "MACHINE (Source)": the part in brackets, short. */
export const ndiName = (n: string) => n.replace(/^.*\((.*)\)$/, '$1').slice(0, 40);

/** The card's driver offers it as a camera (WDM/DirectShow, AVFoundation): the DeckLink path is meant. */
export const isBlackmagicCamera = (name: string) => /blackmagic|ultrastudio|decklink|intensity/i.test(name);

/** URL without its #audio=… part: one device, whichever sound goes with it. */
const base = (url: string) => url.replace(/#.*$/, '');

/** Suggestions from the bridge's answers, without inputs that already are sources. */
export function foundDevices(dl: DevList | null, aja: DevList | null, ndi: NdiList | null, existing: readonly string[], capture: readonly CaptureList[] | null = null, net: NetList | null = null): Found[] {
  const have = new Set(existing.map(base));
  const out: Found[] = [];
  const deckLinks = dl?.available ? dl.devices ?? [] : [];
  for (const d of deckLinks) out.push({ url: `decklink:${d.index}`, name: d.name, kind: 'decklink' });
  if (aja?.available) for (const d of aja.devices ?? []) out.push({ url: `aja:${d.index}`, name: d.name, kind: 'aja' });
  if (ndi?.available) for (const s of ndi.sources ?? []) out.push({ url: `ndi:${s.name}`, name: ndiName(s.name), kind: 'ndi' });
  const audio = (capture ?? []).filter((c) => c.kind === 'audio');
  let wdm = false;
  for (const c of capture ?? []) {
    if (c.kind === 'audio' || !c.url.startsWith('device:')) continue;
    if (isBlackmagicCamera(c.name)) {
      // the DeckLink suggestion above covers the card; else one hint, however many camera entries
      if (!deckLinks.length && !wdm) { wdm = true; out.push({ url: c.url, name: c.name, kind: 'device', blackmagicCamera: true }); }
      continue;
    }
    // sound only when the device offers it under its own name (Cam Link, many UVC sticks); otherwise
    // the source card's sound choice stays open – a guess would pick the wrong device
    const snd = audio.find((a) => a.name === c.name);
    out.push({ url: snd ? `${c.url}#audio=${snd.url.replace(/^audio:[a-z]+:/, '')}` : c.url, name: c.name.slice(0, 40), kind: 'device' });
  }
  for (const i of net?.inputs ?? []) if (i.connected) out.push({ url: i.url, name: (i.summary?.name || i.summary?.format || i.url).slice(0, 40), kind: 'st2110' });
  return out.filter((f) => f.blackmagicCamera || !have.has(base(f.url)));
}

const get = async <T>(url: string): Promise<T | null> => {
  try { const r = await fetch(url); return r.ok ? ((await r.json()) as T) : null; } catch { return null; }
};

/**
 * Polls the bridge; `onChange` gets the full list whenever it changed. NDI discovery and the ffmpeg
 * device list (starts an ffmpeg process on the bridge's machine) are asked less often.
 */
export function watchDevices(http: () => string, existing: () => readonly string[], onChange: (f: Found[]) => void, everyMs = 5000): () => void {
  let last = '', n = 0, ndi: NdiList | null = null, capture: CaptureList[] | null = null, stopped = false, timer: ReturnType<typeof setTimeout> | null = null;
  const tick = async () => {
    if (stopped) return;
    const b = http();
    const [dl, aja, net] = await Promise.all([get<DevList>(`${b}/api/decklink`), get<DevList>(`${b}/api/aja`), get<NetList>(`${b}/api/st2110`)]);
    if (n++ % 3 === 0) [ndi, capture] = await Promise.all([get<NdiList>(`${b}/api/ndi`), get<CaptureList[]>(`${b}/api/devices`)]);
    const list = foundDevices(dl, aja, ndi, existing(), Array.isArray(capture) ? capture : null, net);
    const sig = JSON.stringify(list);
    if (sig !== last) { last = sig; onChange(list); }
    if (!stopped) timer = setTimeout(tick, everyMs);
  };
  void tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
