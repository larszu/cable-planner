// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Light-meter drivers behind one interface (#11). The Opple Light Master is one driver
// (meter.ts); the others:
// - ArgyllCMS spotread in ambient/spectral mode through the bridge (server/meter.mjs): i1Pro 1–3,
//   ColorMunki, JETI specbos/spectraval, i1Display (ambient, no spectrum) … whatever the installed
//   ArgyllCMS supports (argyllcms.com/doc/instruments.html). CRI, TLCI and TM-30 are computed by
//   ArgyllCMS itself and only shown here. UNTESTED: no ArgyllCMS and no such instrument here.
// - Spectrum files (Argyll .sp, two-column CSV) from any spectrometer's export.
// Research and the devices that cannot be connected: docs/research/opple-light-master.md.

import type { MeterState } from './meter';
import { cctMcCamy, duvFromUv, xyToUv, xyzToXy, type Reading } from './photometry';
import { spectrumToXyz, type Spectrum } from './spectrum';
import { bridgeMessage } from '../i18n/bridgeMessage';
import { t } from '../i18n';

export type DriverId = 'opple' | 'argyll' | 'datei'; // lang-ok: persisted driver id
export const DRIVER_LABELS: Record<DriverId, string> = {
  opple: 'Opple Light Master (Bluetooth)', argyll: t('opple.drv.argyll'), datei: t('opple.ui.fromFile'),
};

/** What the sidebar, the scopes and the LED-wall dialog need from a meter. */
export interface LightDevice extends EventTarget {
  readonly driver: DriverId;
  state: MeterState;
  message: string;
  deviceName: string;
  model: string | null;
  frames: string[];
  readonly polling: boolean;
  start(ms?: number): void;
  stop(): void;
  measureAveraged(n?: number): Promise<Reading>;
  disconnect(): void;
}

export type LightExtras = Pick<Reading, 'spectrum' | 'cri' | 'tlci' | 'tm30' | 'quantity'>;
const extrasOf = (r: Reading): LightExtras => ({ spectrum: r.spectrum, cri: r.cri, tlci: r.tlci, tm30: r.tm30, quantity: r.quantity });

/** Reading from absolute XYZ (lx or cd/m² in Y) with the same CCT/Duv formulas as the Opple path. */
export function readingFromXyz(xyz: number[], model: string, extras: LightExtras = {}, ts = Date.now()): Reading {
  const [X, Y, Z] = xyz;
  const [x, y] = xyzToXy(X, Y, Z);
  const [u, v] = x || y ? xyToUv(x, y) : [0, 0];
  const dark = !(Y > 0);
  return {
    model: model as Reading['model'], lux: Y, X, Y, Z, x, y, u, v,
    cct: dark ? NaN : cctMcCamy(x, y), duv: dark ? NaN : duvFromUv(u, v), mode: null,
    bands: [], wavelengths: [], raw: [], calibrated: true, battery: null, temperature: null, ts, ...extras,
  };
}

/** Reading of an imported spectrum. */
export function readingFromSpectrum(sp: Spectrum, name: string, ts = Date.now()): Reading {
  const r = readingFromXyz(spectrumToXyz(sp), name, { spectrum: sp, quantity: sp.unit === 'mW/(m²·sr·nm)' ? 'cd/m²' : 'lx' }, ts);
  // relative spectra give only the chromaticity, no illuminance
  if (sp.unit === 'relativ') r.lux = NaN;
  return r;
}

// ---------------------------------------------------------------- ArgyllCMS

interface LightEvent { type: 'light'; xyz: number[]; lux?: number; cct?: number; duv?: number; spectrum?: { start: number; end: number; values: number[] }; cri?: LightExtras['cri']; tlci?: LightExtras['tlci']; tm30?: LightExtras['tm30'] }

/**
 * spotread as a light meter: `-a -s` (ambient + spectrum). One reading per key press; spectral
 * instruments take a second or more. UNTESTED with a real instrument.
 */
export class ArgyllLightMeter extends EventTarget implements LightDevice {
  readonly driver = 'argyll' as const;
  state: MeterState = 'idle';
  message = '';
  deviceName = 'ArgyllCMS';
  model: string | null = 'argyll';
  frames: string[] = [];
  private ws: WebSocket | null = null;
  private pending: { ok: (r: Reading) => void; fail: (e: Error) => void } | null = null;
  private loop = false;
  private ambient = true;

  constructor(private wsBase: () => string, private port?: number) { super(); }

  get polling() { return this.loop; }
  private status(state: MeterState, message: string) {
    this.state = state; this.message = message;
    this.dispatchEvent(new CustomEvent('status', { detail: { state, message } }));
  }

  connect(): Promise<void> {
    this.status('connecting', t('opple.drv.starting'));
    return new Promise((ok, fail) => {
      let ws: WebSocket;
      try { ws = new WebSocket(`${this.wsBase()}/meter`); } catch (e) { this.status('error', (e as Error).message); fail(e); return; }
      this.ws = ws;
      let settled = false;
      ws.onopen = () => ws.send(JSON.stringify({ cmd: 'open', ambient: true, ...(this.port ? { port: this.port } : {}) }));
      ws.onerror = () => { this.status('error', t('opple.ui.noBridge')); if (!settled) { settled = true; fail(new Error(this.message)); } };
      ws.onclose = () => { this.loop = false; this.reject(new Error(t('calib.meter.closed'))); if (this.state !== 'error') this.status('idle', t('opple.m.disconnected')); };
      ws.onmessage = (e) => {
        const m = JSON.parse(String(e.data));
        if (m.type === 'log') { for (const l of String(m.text).split(/\r?\n/)) if (l.trim()) this.frames.push(l); if (this.frames.length > 300) this.frames.splice(0, this.frames.length - 300); if (/Ambient/.test(m.text)) this.ambient = true; }
        else if (m.type === 'status') this.status(this.state === 'connected' ? 'connected' : 'calibrating', bridgeMessage(m));
        else if (m.type === 'ready') { if (!settled) { settled = true; this.status('connected', t('opple.drv.ready')); ok(); } }
        else if (m.type === 'light') this.onLight(m as LightEvent);
        else if (m.type === 'error') { const text = bridgeMessage(m); this.status('error', text); this.reject(new Error(text)); if (!settled) { settled = true; fail(new Error(text)); } }
        else if (m.type === 'closed') { this.status('error', t('calib.meter.endedCode', { code: m.code ?? '?' })); if (!settled) { settled = true; fail(new Error(this.message)); } }
      };
    });
  }

  private onLight(m: LightEvent) {
    const extras: LightExtras = {
      ...(m.spectrum ? { spectrum: { ...m.spectrum, unit: m.lux !== undefined ? 'mW/(m²·nm)' : 'mW/(m²·sr·nm)' } as Spectrum } : {}),
      ...(m.cri ? { cri: m.cri } : {}), ...(m.tlci ? { tlci: m.tlci } : {}), ...(m.tm30 ? { tm30: m.tm30 } : {}),
      // without an "Ambient = … Lux" line the instrument measured emissively (no ambient mode)
      quantity: m.lux !== undefined ? 'lx' : 'cd/m²',
    };
    this.ambient = m.lux !== undefined;
    const r = readingFromXyz(m.xyz, 'argyll', extras);
    const p = this.pending; this.pending = null;
    p?.ok(r);
    this.dispatchEvent(new CustomEvent('reading', { detail: r }));
  }

  private reject(e: Error) { const p = this.pending; this.pending = null; p?.fail(e); }

  measure(timeout = 60000): Promise<Reading> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error(t('opple.ui.notConnected')));
    if (this.pending) return Promise.reject(new Error(t('opple.drv.busy')));
    return new Promise((ok, fail) => {
      const timer = window.setTimeout(() => this.reject(new Error(t('opple.drv.noReading'))), timeout);
      this.pending = { ok: (r) => { clearTimeout(timer); ok(r); }, fail: (e) => { clearTimeout(timer); fail(e); } };
      this.ws!.send(JSON.stringify({ cmd: 'read' }));
    });
  }
  /** Keys spotread documents (e.g. 'k' calibrate). */
  key(k: string) { this.ws?.send(JSON.stringify({ cmd: 'key', key: k })); }

  start() {
    if (this.loop) return;
    this.loop = true;
    const run = async () => {
      while (this.loop && this.state === 'connected') { try { await this.measure(); } catch { await new Promise((r) => setTimeout(r, 1000)); } }
      this.loop = false;
    };
    run();
  }
  stop() { this.loop = false; }

  async measureAveraged(n = 1): Promise<Reading> {
    const was = this.loop; this.stop();
    while (this.pending) await new Promise((r) => setTimeout(r, 100));
    try {
      const list: Reading[] = [];
      for (let i = 0; i < n; i++) list.push(await this.measure());
      if (list.length === 1) return list[0];
      const avg = (k: 'X' | 'Y' | 'Z') => list.reduce((a, r) => a + r[k], 0) / list.length;
      return readingFromXyz([avg('X'), avg('Y'), avg('Z')], 'argyll', { ...extrasOf(list[list.length - 1]), quantity: this.ambient ? 'lx' : 'cd/m²' });
    } finally { if (was) this.start(); }
  }

  disconnect() {
    this.stop();
    try { this.ws?.send(JSON.stringify({ cmd: 'close' })); } catch { /* closed */ }
    this.ws?.close(); this.ws = null;
    this.status('idle', t('opple.m.disconnected'));
  }
}
