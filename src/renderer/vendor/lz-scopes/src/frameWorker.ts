// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
/// <reference lib="webworker" />
// Frame reception off the main thread (#16): the WebSocket of a bridge stream lives here.
// Video frames are handed over latest-first – while the main thread still works on the
// previous one, a newer frame replaces the waiting one instead of queueing up. Sound
// packets always pass. H.264 access units (LZHK/LZHD) are decoded with WebCodecs and
// converted to R′G′B′ with the bridge's matrix (src/yuv.ts), so the main thread sees the
// same LZV1 frames as with raw transport. Latency stamps (server/stamp.mjs) are read here,
// and with sound the mean luma of every frame for the A/V offset (#24), so replaced frames
// still count there.

import { readStamp } from '../server/stamp.mjs';
import { meanLuma } from './luma';
import { yuv420ToRgba } from './yuv';

export interface FrameMeta {
  /** Date.now() when the frame arrived here (raw) or left the decoder (H.264) */
  arrive: number;
  /** bridge wall clock when the frame left ffmpeg (LZHK/LZHD header value, H.264 only), NaN = unknown */
  bridge: number;
  /** time stamp read from the picture (server/stamp.mjs), Date.now() mod 2^32 at the source */
  stamp: number | null;
  /** H.264 decode time in ms */
  decodeMs?: number;
  /** frames replaced in this worker because the main thread was busy (running total) */
  replaced: number;
  /** [PTS s, mean luma] of every raw frame since the last handover, this one included (only with sound, A/V offset #24) */
  av?: [number, number][];
}

type In = { type: 'open'; url: string } | { type: 'ack' } | { type: 'close' };
export type Out =
  | { type: 'text'; data: string }
  | { type: 'bin'; data: ArrayBuffer; meta?: FrameMeta }
  | { type: 'error' } | { type: 'close' };

const post = (m: Out, transfer: Transferable[] = []) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m, transfer);

let ws: WebSocket | null = null;
let info: { width: number; height: number; depth: number; proto?: number; decodeMatrix?: string; range?: string; transport?: string; format?: string; audio?: unknown } | null = null;
let waiting: { data: ArrayBuffer; meta: FrameMeta } | null = null;
let inflight = false, replaced = 0;
/** A/V samples not yet handed over (kept across replaced frames) */
let av: [number, number][] = [];

function flush() {
  if (inflight || !waiting) return;
  const w = waiting;
  waiting = null; inflight = true;
  if (av.length) { w.meta.av = av; av = []; }
  post({ type: 'bin', data: w.data, meta: w.meta }, [w.data]);
}
function queue(data: ArrayBuffer, meta: Omit<FrameMeta, 'replaced'>) {
  if (waiting) replaced++;
  waiting = { data, meta: { ...meta, replaced } };
  flush();
}

// ---- H.264
let decoder: VideoDecoder | null = null, codec = '', needKey = true;
const timing = new Map<number, { bridge: number; t0: number }>();

function setupDecoder() {
  decoder?.close();
  decoder = new VideoDecoder({
    output: (frame) => { try { onDecoded(frame); } finally { frame.close(); } },
    error: (e) => { post({ type: 'text', data: JSON.stringify({ type: 'stats', message: `H.264-Dekoder: ${e.message}` }) }); needKey = true; decoder = null; },
  });
  decoder.configure({ codec, optimizeForLatency: true });
  needKey = true;
}

async function onDecodedAsync(frame: VideoFrame, t: { bridge: number; t0: number } | undefined) {
  const w = frame.codedWidth, h = frame.codedHeight, vw = info?.width || frame.displayWidth, vh = info?.height || frame.displayHeight;
  const fmt = frame.format;
  if (fmt !== 'I420' && fmt !== 'NV12') {
    post({ type: 'text', data: JSON.stringify({ type: 'stats', message: `H.264: Bildformat ${fmt ?? 'unbekannt'} nicht unterstützt` }) });
    return;
  }
  const buf = new Uint8Array(frame.allocationSize());
  const layout = await frame.copyTo(buf);
  const y = buf.subarray(layout[0].offset), u = buf.subarray(layout[1].offset), v = fmt === 'I420' ? buf.subarray(layout[2].offset) : new Uint8Array(0);
  const rgba = yuv420ToRgba({ y, u, v, strideY: layout[0].stride, strideU: layout[1].stride, strideV: fmt === 'I420' ? layout[2].stride : 0, nv12: fmt === 'NV12' },
    Math.min(w, vw), Math.min(h, vh), info?.decodeMatrix ?? 'bt709', info?.range === 'pc', 16);
  // LZV1 header like the raw transport, so src/sources.ts needs no second path
  const dv = new DataView(rgba.buffer);
  [76, 90, 86, 49].forEach((c, i) => dv.setUint8(i, c));
  dv.setUint32(4, 0, true); dv.setFloat64(8, NaN, true); // no PTS on the H.264 path
  const now = Date.now();
  const stamp = readStamp(rgba.subarray(16), Math.min(w, vw), Math.min(h, vh), 255);
  queue(rgba.buffer as ArrayBuffer, { arrive: now, bridge: t?.bridge ?? NaN, stamp: stamp?.ms ?? null, decodeMs: t ? performance.now() - t.t0 : undefined });
}
function onDecoded(frame: VideoFrame) {
  const t = timing.get(frame.timestamp);
  timing.delete(frame.timestamp);
  // copyTo is async: hold a clone until the copy is done
  const c = frame.clone();
  onDecodedAsync(c, t).catch(() => {}).finally(() => c.close());
}

function decode(buf: ArrayBuffer, key: boolean, n: number, bridge: number) {
  if (!codec || typeof VideoDecoder === 'undefined') return;
  if (!decoder || decoder.state === 'closed') setupDecoder();
  if (needKey && !key) return;
  needKey = false;
  const ts = n * 1000; // µs, only used to pair output with its timing
  timing.set(ts, { bridge, t0: performance.now() });
  if (timing.size > 64) timing.delete(timing.keys().next().value!);
  decoder!.decode(new EncodedVideoChunk({ type: key ? 'key' : 'delta', timestamp: ts, data: new Uint8Array(buf, 16) }));
}

// ---- socket
function open(url: string) {
  ws?.close();
  const s = new WebSocket(url);
  s.binaryType = 'arraybuffer';
  ws = s;
  s.onmessage = (ev) => {
    if (typeof ev.data === 'string') {
      const m = JSON.parse(ev.data);
      if (m.type === 'info') {
        info = m;
        if (m.transport === 'h264' && typeof VideoDecoder === 'undefined') {
          post({ type: 'text', data: JSON.stringify({ type: 'error', message: 'H.264-Übertragung braucht WebCodecs (Chrome, Edge, Desktop-App) – auf „roh“ umstellen' }) });
          return;
        }
      } else if (m.type === 'video') {
        codec = m.codec; setupDecoder();
        return;
      }
      post({ type: 'text', data: ev.data });
      return;
    }
    const buf = ev.data as ArrayBuffer, now = Date.now();
    if (info?.proto === 2) {
      const head = new DataView(buf, 0, 16);
      const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
      if (magic === 'LZA1') { post({ type: 'bin', data: buf }, [buf]); return; }
      const n = head.getUint32(4, true), hv = head.getFloat64(8, true); // H.264: bridge clock (ms), LZV1: PTS (s)
      if (magic === 'LZHK' || magic === 'LZHD') { decode(buf, magic === 'LZHK', n, hv); return; }
      if (magic !== 'LZV1' || !info) return;
      const max = info.depth === 16 ? 65535 : 255;
      const px = info.depth === 16 ? new Uint16Array(buf, 16) : new Uint8Array(buf, 16);
      const st = readStamp(px, info.width, info.height, max);
      // LZV1 header value = PTS in s (#24), not a bridge clock
      if (info.audio && info.width) { av.push([hv, meanLuma(px, info.width, info.height, max, info.format === 'yuv')]); if (av.length > 250) av.shift(); }
      queue(buf, { arrive: now, bridge: NaN, stamp: st?.ms ?? null });
      return;
    }
    if (!info) return;
    const px = info.depth === 16 ? new Uint16Array(buf) : new Uint8Array(buf);
    const st = readStamp(px, info.width, info.height, info.depth === 16 ? 65535 : 255);
    queue(buf, { arrive: now, bridge: NaN, stamp: st?.ms ?? null });
  };
  s.onerror = () => post({ type: 'error' });
  s.onclose = () => { if (ws === s) post({ type: 'close' }); };
}

self.onmessage = (e: MessageEvent<In>) => {
  const m = e.data;
  if (m.type === 'open') open(m.url);
  else if (m.type === 'ack') { inflight = false; flush(); }
  else if (m.type === 'close') { const s = ws; ws = null; s?.close(); decoder?.close(); decoder = null; self.close(); }
};
