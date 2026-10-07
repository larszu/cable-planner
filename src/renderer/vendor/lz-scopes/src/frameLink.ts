// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Main-thread side of the frame worker (src/frameWorker.ts): looks like the small part of
// WebSocket that Source.connectFrames uses. Falls back to a plain WebSocket where workers
// are missing or switched off (localStorage 'lz-scopes.debug' = {"worker":false}, used to
// measure the difference).

import { readStamp } from '../server/stamp.mjs';
import type { FrameMeta, Out } from './frameWorker';

export type { FrameMeta };

export interface FrameSocket {
  onmessage: ((ev: { data: string | ArrayBuffer; meta?: FrameMeta }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  close(): void;
  /** true = reception and H.264 decoding run in the worker */
  readonly worker: boolean;
}

export function debugFlags(): { worker?: boolean; stats?: 'cpu' | 'gpu'; drawOnArrive?: boolean } {
  try { return JSON.parse(localStorage.getItem('lz-scopes.debug') ?? '{}') ?? {}; } catch { return {}; }
}

/** Can frames (and H.264) be received in a worker here? */
export const workerAvailable = () => typeof Worker !== 'undefined' && debugFlags().worker !== false;

export function openFrameSocket(url: string): FrameSocket {
  if (!workerAvailable()) return plainSocket(url);
  let w: Worker;
  try { w = new Worker(new URL('./frameWorker.ts', import.meta.url), { type: 'module' }); } catch { return plainSocket(url); }
  const sock: FrameSocket = {
    onmessage: null, onerror: null, onclose: null, worker: true,
    close: () => { w.postMessage({ type: 'close' }); setTimeout(() => w.terminate(), 1000); },
  };
  w.onmessage = (e: MessageEvent<Out>) => {
    const m = e.data;
    if (m.type === 'text') sock.onmessage?.({ data: m.data });
    else if (m.type === 'bin') {
      sock.onmessage?.({ data: m.data, meta: m.meta });
      // video frames are handed over one at a time: ask for the next once this one is taken
      if (m.meta) w.postMessage({ type: 'ack' });
    } else if (m.type === 'error') sock.onerror?.();
    else if (m.type === 'close') sock.onclose?.();
  };
  w.onerror = () => sock.onerror?.();
  w.postMessage({ type: 'open', url });
  return sock;
}

/** Without worker: same meta, measured on the main thread (raw transport only). */
function plainSocket(url: string): FrameSocket {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  const sock: FrameSocket = { onmessage: null, onerror: null, onclose: null, worker: false, close: () => ws.close() };
  let info: { width: number; height: number; depth: number; proto?: number } | null = null;
  ws.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      try { const m = JSON.parse(ev.data); if (m.type === 'info') info = m; } catch { /* passed on as is */ }
      sock.onmessage?.({ data: ev.data });
      return;
    }
    const buf = ev.data as ArrayBuffer, arrive = Date.now();
    let meta: FrameMeta | undefined, off = 0;
    if (info?.proto === 2) {
      // LZV1 carries the PTS in its header (#24), no bridge clock: no latency split here
      const dv = new DataView(buf, 0, 16);
      off = dv.getUint8(3) === 49 && dv.getUint8(2) === 86 ? 16 : -1; // not LZV1
    }
    if (info && off >= 0) {
      const px = info.depth === 16 ? new Uint16Array(buf, off) : new Uint8Array(buf, off);
      meta = { arrive, bridge: NaN, stamp: readStamp(px, info.width, info.height, info.depth === 16 ? 65535 : 255)?.ms ?? null, replaced: 0 };
    }
    sock.onmessage?.({ data: buf, meta });
  };
  ws.onerror = () => sock.onerror?.();
  ws.onclose = () => sock.onclose?.();
  return sock;
}
