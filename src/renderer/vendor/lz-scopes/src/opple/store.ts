// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Light-meter state shared by the sidebar panel, the light scopes and the LED-wall dialog (#11):
// several Opple Light Masters at once, remembered devices with an alias, reading history,
// captured measuring points (grid / comparison).
//
// Devices never pair with the operating system: Web Bluetooth connects directly (GATT). The
// Electron app shows its own device list (electron/main.cjs collects what the scan finds and
// sends it here); Chrome shows its chooser. A remembered device reconnects via
// navigator.bluetooth.getDevices() (Chrome) or by asking Electron to pick its id when the
// scan sees it.

import { OppleMeter, permittedDevices, type BtDevice } from './meter';
import { ArgyllLightMeter, readingFromSpectrum, type LightDevice } from './drivers';
import { parseArgyllSp, parseSpectrumCsv, type SpectrumUnit } from './spectrum';
import type { Reading } from './photometry';
import { cellKey, type Gel, type GridCell } from './lightScience';

export interface KnownDevice {
  key: string;
  /** driver; unset = Opple (older entries) */
  driver?: 'opple' | 'argyll';
  /** ArgyllCMS instrument port (spotread -c) */
  port?: number;
  /** name the device advertises (LMaster_xxxx, LightMaster, SigMesh …) */
  name: string;
  alias: string;
  /** Electron: device id of the scan (stable per computer) */
  nativeId?: string;
  /** Web Bluetooth id (origin-scoped) */
  webId?: string;
  model?: 'lm3' | 'lm4';
  last?: number;
}
export interface LightPoint { id: string; label: string; reading: Reading; cell?: [number, number] }
interface BtBridge {
  onDevices(cb: (m: { devices: { id: string; name: string }[]; scanning: boolean; done?: boolean }) => void): () => void;
  select(id: string): Promise<boolean>;
  prefer(id: string | null): Promise<void>;
}
export const desktopBluetooth = (): BtBridge | null =>
  (typeof window !== 'undefined' ? (window as unknown as { lzsDesktop?: { bluetooth?: BtBridge } }).lzsDesktop?.bluetooth : null) ?? null;

const LS_DEVICES = 'lz-scopes.opple.devices', LS_POINTS = 'lz-scopes.opple.points', LS_OPTS = 'lz-scopes.opple.options';
const load = <T>(k: string, d: T): T => { try { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return v ?? d; } catch { return d; } };
const store = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } };

export interface LightOptions { cols: number; rows: number; cursor: [number, number]; ref: string | null; cmp: string | null; gelMaker: Gel['maker']; avg: number }

/** The first meter; the LED-wall dialog uses it. */
export const oppleMeter = new OppleMeter();

export class LightStore extends EventTarget {
  version = 0;
  known: KnownDevice[] = load<KnownDevice[]>(LS_DEVICES, []);
  /** connected or connecting meters by device key */
  meters = new Map<string, LightDevice>();
  /** bridge WebSocket base for ArgyllCMS (set by the app) */
  bridgeWs: () => string = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  history: Reading[] = [];
  points: LightPoint[] = load<LightPoint[]>(LS_POINTS, []);
  opts: LightOptions = { cols: 3, rows: 3, cursor: [0, 0], ref: null, cmp: null, gelMaker: 'Lee', avg: 3, ...load<Partial<LightOptions>>(LS_OPTS, {}) };
  /** device whose values the big read-out shows */
  active = '';
  /** Electron device list while a scan runs */
  picker: { devices: { id: string; name: string }[]; scanning: boolean } | null = null;
  message = '';
  private picked = '';

  constructor() {
    super();
    desktopBluetooth()?.onDevices((m) => {
      this.picker = m.done ? null : { devices: m.devices, scanning: m.scanning };
      this.changed();
    });
  }

  changed() { this.version++; this.dispatchEvent(new Event('change')); }
  private saveKnown() { store(LS_DEVICES, this.known); }
  savePoints() { store(LS_POINTS, this.points); }
  saveOpts() { store(LS_OPTS, this.opts); }

  label(key: string) { const k = this.known.find((d) => d.key === key); return k ? (k.alias || k.name) : key || 'Light Master'; }
  /** latest reading per connected device */
  latest(key?: string) {
    for (let i = this.history.length - 1; i >= 0; i--) if (!key || this.history[i].device === key) return this.history[i];
    return null;
  }

  private freeMeter() {
    if (oppleMeter.state === 'idle' || oppleMeter.state === 'error') { for (const [k, m] of this.meters) if (m === oppleMeter) this.meters.delete(k); return oppleMeter; }
    return new OppleMeter();
  }

  private attach(m: LightDevice, key: string) {
    if ((m as unknown as { __lzs?: boolean }).__lzs) return;
    (m as unknown as { __lzs?: boolean }).__lzs = true;
    m.addEventListener('reading', (e) => {
      const r = (e as CustomEvent).detail as Reading;
      const k = [...this.meters].find(([, x]) => x === m)?.[0] ?? key;
      r.device = k;
      this.history.push(r);
      if (this.history.length > 20000) this.history.splice(0, this.history.length - 20000);
      if (!this.active || !this.meters.has(this.active)) this.active = k;
      this.changed();
    });
    m.addEventListener('status', () => this.changed());
  }

  /**
   * Scan for a Light Master and connect it. Electron: the list in the sidebar (picker) chooses;
   * Chrome: its own chooser. Must run inside a click.
   */
  async connectNew() {
    this.message = ''; this.picked = '';
    const m = this.freeMeter();
    this.attach(m, '');
    const tmp = `neu-${Date.now()}`;
    this.meters.set(tmp, m); this.changed();
    try {
      await m.connect();
      this.register(tmp, m, this.picked);
    } catch (e) {
      this.meters.delete(tmp);
      this.message = m.message || (e as Error).message;
      this.picker = null; this.changed();
      throw e;
    }
  }

  /** Electron list: the user picked a device. */
  pick(id: string) { this.picked = id; this.picker = null; this.changed(); return desktopBluetooth()?.select(id); }
  cancelPick() { this.picker = null; this.changed(); return desktopBluetooth()?.select(''); }

  /** Spectrometer/colorimeter through ArgyllCMS spotread on the bridge (ungeprüft). */
  async connectArgyll(port?: number) {
    this.message = '';
    const existing = this.known.find((d) => d.driver === 'argyll' && (d.port ?? 0) === (port ?? 0));
    const k: KnownDevice = existing ?? { key: `ar-${Date.now().toString(36)}`, driver: 'argyll', port, name: `ArgyllCMS${port ? ` Port ${port}` : ''}`, alias: `Spektrometer${port ? ` ${port}` : ''}` };
    if (!existing) { this.known.push(k); this.saveKnown(); }
    const m = new ArgyllLightMeter(this.bridgeWs, port);
    this.attach(m, k.key);
    this.meters.set(k.key, m); this.changed();
    try {
      await m.connect();
      k.last = Date.now(); this.saveKnown();
      this.active = k.key; this.changed();
    } catch (e) {
      this.meters.delete(k.key);
      this.message = m.message || (e as Error).message;
      this.changed();
      throw e;
    }
  }

  /** Spectrum file (Argyll .sp or two-column CSV) → reading in the history and a point. */
  importSpectrum(text: string, name: string, csvUnit: SpectrumUnit = 'relativ') {
    const sp = /\.sp$/i.test(name) || /SPECTRAL_BANDS/.test(text) ? parseArgyllSp(text) : parseSpectrumCsv(text, csvUnit);
    if (!sp) throw new Error(`${name}: kein Spektrum erkannt (Argyll .sp oder zwei Spalten Wellenlänge, Wert mit gleichem Abstand)`);
    const r = readingFromSpectrum(sp, 'datei');
    r.device = `Datei ${name}`;
    this.history.push(r);
    const p: LightPoint = { id: `p${Date.now().toString(36)}`, label: name.replace(/\.[^.]+$/, ''), reading: r };
    this.points.push(p);
    if (!this.opts.ref) this.opts.ref = p.id; else this.opts.cmp = p.id;
    this.savePoints(); this.saveOpts(); this.changed();
    return r;
  }

  /** Reconnect a remembered device (Chrome: without chooser if permitted; Electron: auto-pick its id). */
  async reconnect(k: KnownDevice) {
    if (k.driver === 'argyll') return this.connectArgyll(k.port);
    this.message = '';
    const m = this.freeMeter();
    this.attach(m, k.key);
    this.meters.set(k.key, m); this.changed();
    try {
      const dev = k.webId ? (await permittedDevices()).find((d) => d.id === k.webId) : undefined;
      const bt = desktopBluetooth();
      if (!dev && bt && k.nativeId) { await bt.prefer(k.nativeId); this.picked = k.nativeId; }
      await m.connect(dev as BtDevice | undefined);
      this.register(k.key, m, this.picked || k.nativeId || '');
    } catch (e) {
      this.meters.delete(k.key);
      await desktopBluetooth()?.prefer(null);
      this.message = m.message || (e as Error).message;
      this.changed();
      throw e;
    }
  }

  private register(tmpKey: string, m: OppleMeter, nativeId: string) {
    const webId = m.deviceId, name = m.deviceName;
    let k = this.known.find((d) => (nativeId && d.nativeId === nativeId) || (webId && d.webId === webId));
    if (!k) {
      const n = this.known.filter((d) => d.name === name).length;
      k = { key: `lm-${Date.now().toString(36)}`, name, alias: n ? `${name} ${n + 1}` : name };
      this.known.push(k);
    }
    Object.assign(k, { name, webId: webId || k.webId, nativeId: nativeId || k.nativeId, model: m.model ?? k.model, last: Date.now() });
    this.saveKnown();
    this.meters.delete(tmpKey);
    this.meters.set(k.key, m);
    for (const r of this.history) if (r.device === tmpKey) r.device = k.key;
    this.active = k.key;
    this.changed();
    return k;
  }

  disconnect(key: string) { this.meters.get(key)?.disconnect(); this.meters.delete(key); if (this.active === key) this.active = [...this.meters.keys()][0] ?? ''; this.changed(); }
  forget(key: string) { this.disconnect(key); this.known = this.known.filter((d) => d.key !== key); this.saveKnown(); this.changed(); }
  rename(key: string, alias: string) { const k = this.known.find((d) => d.key === key); if (k) { k.alias = alias.trim() || k.name; this.saveKnown(); this.changed(); } }

  /** start/stop polling of all connected meters */
  setRunning(on: boolean) { for (const m of this.meters.values()) if (m.state === 'connected') { if (on) m.start(); else m.stop(); } this.changed(); }
  get running() { return [...this.meters.values()].some((m) => m.polling); }
  get connected() { return [...this.meters.entries()].filter(([, m]) => m.state === 'connected'); }

  /** Average `opts.avg` readings of the active meter and keep them as a point (next grid cell). */
  async capture(label: string, toGrid: boolean) {
    const m = this.meters.get(this.active) ?? this.connected[0]?.[1];
    if (!m || m.state !== 'connected') throw new Error('Erst einen Light Master verbinden.');
    const r = await m.measureAveraged(this.opts.avg);
    r.device = [...this.meters].find(([, x]) => x === m)?.[0];
    const cell: [number, number] | undefined = toGrid ? [...this.opts.cursor] as [number, number] : undefined;
    if (cell) this.points = this.points.filter((p) => !p.cell || cellKey(...p.cell) !== cellKey(...cell));
    const p: LightPoint = { id: `p${Date.now().toString(36)}`, label: label || (cell ? `${String.fromCharCode(65 + cell[1])}${cell[0] + 1}` : `Punkt ${this.points.length + 1}`), reading: r, cell };
    this.points.push(p);
    if (cell) this.advance();
    if (!this.opts.ref) this.opts.ref = p.id; else if (!cell) this.opts.cmp = p.id;
    this.savePoints(); this.saveOpts(); this.changed();
    return p;
  }
  advance() {
    const [c, r] = this.opts.cursor;
    this.opts.cursor = c + 1 < this.opts.cols ? [c + 1, r] : [0, (r + 1) % this.opts.rows];
    this.saveOpts(); this.changed();
  }
  removePoint(id: string) {
    this.points = this.points.filter((p) => p.id !== id);
    if (this.opts.ref === id) this.opts.ref = null;
    if (this.opts.cmp === id) this.opts.cmp = null;
    this.savePoints(); this.saveOpts(); this.changed();
  }
  clearPoints() { this.points = []; this.opts.ref = null; this.opts.cmp = null; this.opts.cursor = [0, 0]; this.savePoints(); this.saveOpts(); this.changed(); }
  gridCells(): GridCell[] {
    return this.points.filter((p) => p.cell && p.cell[0] < this.opts.cols && p.cell[1] < this.opts.rows).map((p) => ({ col: p.cell![0], row: p.cell![1], reading: p.reading }));
  }
  point(id: string | null) { return id ? this.points.find((p) => p.id === id) ?? null : null; }
}

let local: LightStore | null = null;
/**
 * The window's light store. Output windows (window.open from the main window) use the main
 * window's store, so light scopes also work full-screen on another display.
 */
export function lightStore(): LightStore {
  try {
    const o = (window.opener as { lzsLightStore?: LightStore } | null)?.lzsLightStore;
    if (o) return o;
  } catch { /* other origin */ }
  if (!local) {
    local = new LightStore();
    (window as unknown as { lzsLightStore?: LightStore }).lzsLightStore = local;
  }
  return local;
}
