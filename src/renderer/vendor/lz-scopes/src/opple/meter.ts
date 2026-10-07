// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Web Bluetooth session with an Opple Light Master 3 or 4 (#11).
//
// Flow after natmart-in/sunday-light-meter `src/meter.js` @ eb50efc (MIT, see
// licenses/sunday-light-meter-LICENSE.txt): request device by name, GATT connect,
// Nordic UART service, notifications on …0003, commands written to …0003 (or …0002),
// read the unit calibration (0x0A04), then poll measurements (0x0A00). Written anew and
// reduced (no auto-reconnect, no advertisement watch).
//
// Checked with a real Light Master 3 (30.09.2026, test/oppleLm3Live.test.ts). LM4 and flicker are
// tested only with recorded/synthetic frames. Several meters: one OppleMeter per device
// (src/opple/store.ts).

import {
  FlickerAssembler, MessageAssembler, NUS_RX, NUS_SERVICE, NUS_TX, OPCODE, buildCommand, encapsulate, flickerMetrics, flickerRequestBody, opcodeOf,
  parseCalibration, parseFlickerChunk, parseMeasurement, type Calibration, type FlickerPeriod, type FlickerResult, type Model,
} from './protocol';
import { processMeasurement, type Reading } from './photometry';

// Minimal Web Bluetooth types (not in TypeScript's DOM lib).
interface BtCharacteristic extends EventTarget {
  properties: { write: boolean; writeWithoutResponse: boolean; notify: boolean };
  value: DataView | null;
  startNotifications(): Promise<BtCharacteristic>;
  writeValueWithoutResponse?(v: BufferSource): Promise<void>;
  writeValueWithResponse?(v: BufferSource): Promise<void>;
  writeValue(v: BufferSource): Promise<void>;
}
interface BtService { getCharacteristic(uuid: string): Promise<BtCharacteristic> }
interface BtServer { connected: boolean; getPrimaryService(uuid: string): Promise<BtService>; disconnect(): void }
export interface BtDevice extends EventTarget { id: string; name?: string; gatt?: { connected: boolean; connect(): Promise<BtServer>; disconnect(): void } }
interface Bluetooth { requestDevice(o: unknown): Promise<BtDevice>; getDevices?(): Promise<BtDevice[]> }
const bluetooth = () => (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;

/** Advertised names: LM4 = "SigMesh", LM3 = "LightMaster" (sunday-light-meter README / meter.js). */
export const REQUEST_OPTIONS = {
  filters: ['SigMesh', 'LightMaster', 'Light Master', 'LMaster', 'LM3', 'LM4'].map((namePrefix) => ({ namePrefix })),
  optionalServices: [NUS_SERVICE],
};

export function bluetoothSupport(): { ok: boolean; reason: string } {
  if (typeof navigator === 'undefined' || !bluetooth()) return { ok: false, reason: 'Dieser Browser hat kein Web Bluetooth (Chrome/Edge oder die Desktop-App nehmen; Safari und Firefox können es nicht).' };
  if (typeof window !== 'undefined' && window.isSecureContext === false) return { ok: false, reason: 'Web Bluetooth braucht https oder localhost.' };
  return { ok: true, reason: '' };
}

/**
 * Devices this origin may use without a chooser (Chrome with the permissions backend). Electron and
 * browsers without getDevices() return [] – there the app remembers devices itself (store.ts).
 */
export async function permittedDevices(): Promise<BtDevice[]> {
  try { return (await bluetooth()?.getDevices?.()) ?? []; } catch { return []; }
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');
const TIMEOUT = 3000;

export type MeterState = 'idle' | 'requesting' | 'connecting' | 'calibrating' | 'connected' | 'error';

export class OppleMeter extends EventTarget {
  readonly driver = 'opple' as const;
  state: MeterState = 'idle';
  message = '';
  model: Model | null = null;
  deviceName = '';
  calibration: Calibration | null = null;
  /** last BLE frames (hex, both directions) for protocol checks */
  frames: string[] = [];
  private device: BtDevice | null = null;
  private server: BtServer | null = null;
  private tx: BtCharacteristic | null = null;
  private write: BtCharacteristic | null = null;
  private asm = new MessageAssembler();
  private seq = 0;
  private pending: { opcode: number; resolve: (m: Uint8Array) => void; reject: (e: Error) => void; timer: number } | null = null;
  private poll = 0;
  private busy = false;
  private misses = 0;

  private status(state: MeterState, message: string) {
    this.state = state; this.message = message;
    this.dispatchEvent(new CustomEvent('status', { detail: { state, message } }));
  }
  private log(dir: '>' | '<', b: Uint8Array) {
    this.frames.push(`${new Date().toISOString().slice(11, 23)} ${dir} ${hex(b)}`);
    if (this.frames.length > 300) this.frames.splice(0, this.frames.length - 300);
  }

  /** Web Bluetooth id of the connected device (origin-scoped, not the radio address). */
  get deviceId() { return this.device?.id ?? ''; }

  /** Must run inside a user gesture (button click) unless a permitted `device` is passed. */
  async connect(device?: BtDevice) {
    const sup = bluetoothSupport();
    if (!sup.ok) { this.status('error', sup.reason); throw new Error(sup.reason); }
    this.status('requesting', device ? `Verbinde mit ${device.name ?? 'Light Master'} …` : 'Light Master in der Liste wählen …');
    try {
      this.device = device ?? await bluetooth()!.requestDevice(REQUEST_OPTIONS);
      this.deviceName = this.device.name ?? 'Light Master';
      this.device.addEventListener('gattserverdisconnected', this.onGone);
      this.status('connecting', `Verbinde mit ${this.deviceName} …`);
      const server = await withTimeout(this.device.gatt!.connect(), 15000, 'Verbindung');
      this.server = server;
      const svc = await withTimeout(server.getPrimaryService(NUS_SERVICE), 15000, 'Dienstsuche');
      const tx = await svc.getCharacteristic(NUS_TX);
      let rx: BtCharacteristic | null = null;
      try { rx = await svc.getCharacteristic(NUS_RX); } catch { rx = null; }
      this.tx = tx;
      this.write = tx.properties.write || tx.properties.writeWithoutResponse ? tx : rx;
      if (!this.write) throw new Error('Keine beschreibbare Characteristic am Gerät');
      tx.addEventListener('characteristicvaluechanged', this.onNotify);
      await withTimeout(tx.startNotifications(), 15000, 'Benachrichtigungen');
      this.status('calibrating', 'Lese Sensor-Kalibrierung …');
      this.calibration = null;
      for (let i = 0; i < 2 && !this.calibration; i++) {
        try { this.calibration = parseCalibration(await this.command(OPCODE.REQ_CAL, OPCODE.RES_CAL)); } catch { /* retry */ }
      }
      const first = await this.measure(4000);
      this.model = first.model as Model;
      this.status('connected', `${this.model === 'lm4' ? 'Light Master 4' : 'Light Master 3'} verbunden${this.calibration ? '' : ' (ohne Kalibrierfaktoren – Werte ungenauer)'}`);
      this.emit(first);
    } catch (e) {
      // Chromium cancels the chooser at once when the window is not focused; Electron's handler
      // takes the first Light Master found within 20 s.
      const msg = (e as Error).name === 'NotFoundError' ? 'Kein Light Master gefunden: Gerät einschalten, in die Nähe legen und mit dem Fenster im Vordergrund erneut verbinden. (In den Bluetooth-Einstellungen des Systems erscheint es nicht – das ist normal.)' : (e as Error).message;
      this.cleanup();
      this.status('error', msg);
      throw e;
    }
  }

  /** Poll every `ms` (LM4 drops an idle link after about 46 s, so keep polling). */
  start(ms = 900) {
    this.stop();
    this.poll = window.setInterval(async () => {
      if (this.busy || this.state !== 'connected') return;
      this.busy = true;
      try { this.emit(await this.measure()); this.misses = 0; }
      catch (e) { if (++this.misses >= 3) { this.status('error', `Gerät antwortet nicht: ${(e as Error).message}`); this.stop(); } }
      this.busy = false;
    }, ms);
  }
  stop() { clearInterval(this.poll); this.poll = 0; }
  get polling() { return this.poll !== 0; }

  async measure(timeout = TIMEOUT): Promise<Reading> {
    const m = parseMeasurement(await this.command(OPCODE.REQ_MEAS, OPCODE.RES_MEAS, timeout));
    if (!m) throw new Error('Messantwort nicht lesbar');
    return processMeasurement(m, this.calibration);
  }

  private flickerSink: ((m: Uint8Array) => void) | null = null;

  /** One flicker capture (LM4 only): 4 answer messages → 1024 samples → metrics. */
  private async flickerOnce(period: FlickerPeriod): Promise<FlickerResult> {
    if (!this.server?.connected || !this.write) throw new Error('nicht verbunden');
    const asm = new FlickerAssembler();
    const done = new Promise<number[]>((ok, fail) => {
      const t = window.setTimeout(() => { this.flickerSink = null; fail(new Error('Flicker: keine vollständige Antwort')); }, 10000);
      this.flickerSink = (m) => { const c = parseFlickerChunk(m); const w = c ? asm.feed(c) : null; if (w) { clearTimeout(t); this.flickerSink = null; ok(w); } };
    });
    this.seq = (this.seq + 1) & 0xff;
    await this.writeFrames(encapsulate(buildCommand(OPCODE.REQ_FREQ, this.seq, flickerRequestBody(period))));
    return flickerMetrics(await done, asm.dataType, period);
  }

  /**
   * Flicker measurement with the capture cascade of opple-bridge (`request_flicker`): period 25
   * (≈ 40 kHz); above 2 kHz refine with 146 and try 11 (≈ 85 kHz), which wins above 15 kHz.
   * UNTESTED WITH A DEVICE; the LM3 flicker format is not known.
   */
  async flicker(): Promise<FlickerResult> {
    if (this.model !== 'lm4') throw new Error('Flicker-Messung ist nur für den Light Master 4 dokumentiert');
    const wasPolling = this.polling;
    this.stop();
    while (this.busy) await new Promise((r) => setTimeout(r, 50));
    this.busy = true;
    try {
      const r25 = await this.flickerOnce(25);
      if (r25.frequency <= 2000) return r25;
      const r146 = await this.flickerOnce(146).catch(() => null);
      if (!r146) return r25;
      const r11 = await this.flickerOnce(11).catch(() => null);
      return r11 && r11.frequency > 15000 ? r11 : r146;
    } finally {
      this.busy = false;
      if (wasPolling) this.start();
    }
  }

  /** Several readings averaged (polling paused meanwhile). */
  async measureAveraged(n = 3): Promise<Reading> {
    const wasPolling = this.polling;
    this.stop();
    while (this.busy) await new Promise((r) => setTimeout(r, 50));
    this.busy = true;
    try {
      const list: Reading[] = [];
      for (let i = 0; i < n; i++) list.push(await this.measure());
      const avg = (k: 'X' | 'Y' | 'Z') => list.reduce((a, r) => a + r[k], 0) / list.length;
      const last = list[list.length - 1];
      const r = { ...last, X: avg('X'), Y: avg('Y'), Z: avg('Z') };
      this.emit(r);
      return r;
    } finally {
      this.busy = false;
      if (wasPolling) this.start();
    }
  }

  disconnect() {
    this.stop();
    try { this.device?.gatt?.disconnect(); } catch { /* ignore */ }
    this.cleanup();
    this.status('idle', 'getrennt');
  }

  private emit(r: Reading) { this.dispatchEvent(new CustomEvent('reading', { detail: r })); }

  private cleanup() {
    this.stop();
    this.tx?.removeEventListener('characteristicvaluechanged', this.onNotify);
    this.device?.removeEventListener('gattserverdisconnected', this.onGone);
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('getrennt')); this.pending = null; }
    this.server = null; this.tx = null; this.write = null; this.asm.reset();
  }

  private onGone = () => { this.cleanup(); this.status('error', 'Verbindung verloren (Gerät aus, außer Reichweite oder von der Opple-App belegt)'); };

  private onNotify = (e: Event) => {
    const dv = (e.target as BtCharacteristic).value;
    if (!dv) return;
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    this.log('<', bytes);
    const msg = this.asm.feed(bytes);
    if (msg && opcodeOf(msg) === OPCODE.RES_FREQ) { this.flickerSink?.(msg); return; }
    if (!msg || !this.pending || opcodeOf(msg) !== this.pending.opcode) return;
    const p = this.pending;
    this.pending = null; clearTimeout(p.timer); p.resolve(msg);
  };

  private async writeFrames(frames: Uint8Array[]) {
    for (const f of frames) {
      this.log('>', f);
      const c = this.write!;
      const buf = f.slice().buffer as ArrayBuffer;
      if (c.properties.writeWithoutResponse && c.writeValueWithoutResponse) await c.writeValueWithoutResponse(buf);
      else if (c.writeValueWithResponse) await c.writeValueWithResponse(buf);
      else await c.writeValue(buf);
    }
  }

  private command(opcode: number, response: number, timeout = TIMEOUT): Promise<Uint8Array> {
    if (!this.server?.connected || !this.write) return Promise.reject(new Error('nicht verbunden'));
    if (this.pending) return Promise.reject(new Error('Befehl läuft noch'));
    this.seq = (this.seq + 1) & 0xff;
    const frames = encapsulate(buildCommand(opcode, this.seq));
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => { this.pending = null; reject(new Error('keine Antwort (Gerät wach?)')); }, timeout);
      this.pending = { opcode: response, resolve, reject, timer };
      this.writeFrames(frames).catch((err) => { clearTimeout(timer); this.pending = null; reject(err); });
    });
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  let t = 0;
  return Promise.race([p, new Promise<never>((_, rej) => { t = window.setTimeout(() => rej(new Error(`${what}: Zeitüberschreitung nach ${ms / 1000} s`)), ms); })]).finally(() => clearTimeout(t));
}
