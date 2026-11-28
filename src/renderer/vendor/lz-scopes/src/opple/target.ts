// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Light measurement as a source of numbers (#184): exposure value, distance of a reading to a
// target, and the target as a small JSON record that other tools read (light-planner for the
// fixtures, camera-bridge for the camera paint – the correcting itself happens there).
//
// EV from illuminance (incident light): EV = log2(E · S / C). ISO 2720:1974 recommends C = 240…400
// for a flat receptor (illuminance in lx), "a value of 250 is commonly used"; 320…540 for a
// hemispherical one (Minolta 320, Sekonic 340). Source: Wikipedia "Light meter", sections
// "Exposure meter calibration" and "Calibration constants" (opened 24.11.2026, cites ISO 2720).
// The Light Master's diffuser is flat, so C = 250 at S = ISO 100: EV 0 = 2.5 lx.

import type { Reading } from './photometry';
import { deltaUvPrime, xyToUvPrime } from './lightScience';
import { cctDuv } from '../calib/colorimetry';
import type { LightPoint } from './store';

/** incident-light calibration constant C (flat receptor, ISO 2720) */
export const EV_C = 250;

/** EV at ISO 100 from illuminance in lx; NaN for no light. */
export const evFromLux = (lux: number, iso = 100, c = EV_C) => (lux > 0 ? Math.log2((lux * iso) / c) : NaN);

export interface LightDelta {
  /** Δu′v′ (CIE 1976) between reading and target */
  duv: number;
  /** CCT of the reading minus CCT of the target, K (exact Planck search, lightScience.cctDuv) */
  dCct: number;
  /** Duv of the reading minus Duv of the target (> 0 = greener) */
  dDuv: number;
  /** brightness difference in EV (stops); NaN without light */
  dEv: number;
}

/** How far a reading is from the target. */
export function lightDelta(target: Reading, r: Reading): LightDelta {
  const a = cctDuv([target.x, target.y]), b = cctDuv([r.x, r.y]);
  return {
    duv: deltaUvPrime([target.x, target.y], [r.x, r.y]),
    dCct: b.cct - a.cct,
    dDuv: b.duv - a.duv,
    dEv: target.lux > 0 && r.lux > 0 ? Math.log2(r.lux / target.lux) : NaN,
  };
}

/** Schema id of the shared target record (control API state.light.target, clipboard, file). */
export const TARGET_SCHEMA = 'lz-scopes.light-target/1';

/** One reading as JSON-safe numbers (no NaN; rounded to what the meters resolve). */
export interface LightReadingRecord {
  /** ISO 8601 time of the measurement */
  time: string;
  device: string;
  /** illuminance lx (or luminance cd/m² when `quantity` says so) */
  lux: number; quantity: 'lx' | 'cd/m²';
  /** EV at ISO 100, C = 250 (ISO 2720, flat receptor); null for luminance */
  ev100: number | null;
  /** CIE 1931 xy and CIE 1976 u′v′ */
  x: number; y: number; u: number; v: number;
  /** CCT K and Duv (exact Planck search, CIE 1960 uv); null without light */
  cct: number | null; duv: number | null;
  /** measured spectrum (spectrometers only) */
  spectrum?: { start: number; end: number; values: number[]; unit: string };
}
export interface LightTargetRecord extends LightReadingRecord {
  schema: typeof TARGET_SCHEMA;
  label: string; place: string; note: string;
}

const r6 = (v: number) => (Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 + 0 : 0); // + 0: no -0 in JSON
const fin = (v: number, d: number) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d + 0 : null);

export function readingRecord(r: Reading, device = '', withSpectrum = true): LightReadingRecord {
  const [u, v] = xyToUvPrime(r.x, r.y), dark = !(r.lux > 0), c = dark ? null : cctDuv([r.x, r.y]);
  return {
    time: new Date(r.ts).toISOString(),
    device,
    lux: fin(r.lux, 3) ?? 0, quantity: r.quantity ?? 'lx',
    ev100: r.quantity === 'cd/m²' ? null : fin(evFromLux(r.lux), 2),
    x: r6(r.x), y: r6(r.y), u: r6(u), v: r6(v),
    cct: c ? fin(c.cct, 0) : null, duv: c ? fin(c.duv, 5) : null,
    ...(withSpectrum && r.spectrum ? { spectrum: { start: r.spectrum.start, end: r.spectrum.end, values: r.spectrum.values.map(r6), unit: r.spectrum.unit } } : {}),
  };
}

/** The target as the shared record. */
export function targetRecord(p: LightPoint, device = '', withSpectrum = true): LightTargetRecord {
  return { schema: TARGET_SCHEMA, label: p.label, place: p.place ?? '', note: p.note ?? '', ...readingRecord(p.reading, device, withSpectrum) };
}

/**
 * Light part of the control API state (GET /api/control → state.light): the target, the latest
 * reading of the active meter and its distance to the target. Spectra stay out of the state
 * (it is published four times a second); the copied/saved target carries them.
 */
export function lightControlState(s: { target: LightPoint | null; active: string; latest(key?: string): Reading | null; label(key: string): string; points: LightPoint[] }) {
  const tg = s.target, r = s.latest(s.active) ?? s.latest();
  const d = tg && r && r !== tg.reading ? lightDelta(tg.reading, r) : null;
  return {
    target: tg ? targetRecord(tg, s.label(tg.reading.device ?? ''), false) : null,
    latest: r ? readingRecord(r, s.label(r.device ?? ''), false) : null,
    delta: d ? { duv: fin(d.duv, 5), cct: fin(d.dCct, 0), duvDiff: fin(d.dDuv, 5), ev: fin(d.dEv, 2) } : null,
    points: s.points.length,
  };
}

/** Search in the measurement list: every word must appear in label, place, note, device or date. */
export function matchesSearch(p: LightPoint, query: string, device = ''): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const d = new Date(p.reading.ts);
  const hay = [p.label, p.place ?? '', p.note ?? '', device, d.toISOString().slice(0, 10), d.toLocaleDateString()].join(' ').toLowerCase();
  return words.every((w) => hay.includes(w));
}
