// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Lens fingerprint (idea 9, docs/research/lens-fingerprint.md): white shading and centre colour of
// a lens at a zoom position, stored and compared after a lens change – the measured counterpart to
// the camera's lens file (Sony, The Basics of Camera Technology p. 34; V modulation per zoom
// position p. 45). Pure functions plus localStorage; grid and terms in src/lensShading.ts, fitted
// with the white-shading core src/surface.ts (shared with src/whiteShading.ts).

import { centreColour, type ChannelShading, type ShadingFit } from './lensShading';

export interface LensPrint {
  lens: string;
  /** zoom position as entered (focal length in mm or a position), extender noted in the name */
  zoom: number;
  date: string;
  linear: boolean;
  r: ChannelShading; g: ChannelShading; b: ChannelShading;
  /** centre colour R/G and B/G */
  rg: number; bg: number;
  /** luma map, % from the centre (nx × ny) */
  nx: number; ny: number; map: number[];
}

export const printOf = (lens: string, zoom: number, s: ShadingFit, linear: boolean, date = new Date().toISOString()): LensPrint => ({
  lens, zoom, date, linear, r: s.r, g: s.g, b: s.b, ...centreColour(s), nx: s.nx, ny: s.ny, map: Array.from(s.map, (v) => Math.round(v * 100) / 100),
});

export type Term = 'sawH' | 'sawV' | 'parH' | 'parV';
export const TERMS: Term[] = ['sawH', 'sawV', 'parH', 'parV'];
export type Ch = 'r' | 'g' | 'b';

export interface PrintDelta {
  /** live minus stored, percentage points per channel and term */
  terms: Record<Ch, Record<Term, number>>;
  /** centre colour change in % (R/G, B/G) */
  dRg: number; dBg: number;
  /** largest term difference and where */
  worst: { ch: Ch; term: Term; pp: number };
  /** distance for ranking: RMS of all term differences plus the colour change */
  distance: number;
}

export function comparePrints(live: Pick<LensPrint, Ch | 'rg' | 'bg'>, ref: Pick<LensPrint, Ch | 'rg' | 'bg'>): PrintDelta {
  const terms = {} as PrintDelta['terms'];
  let worst: PrintDelta['worst'] = { ch: 'g', term: 'sawH', pp: 0 }, ss = 0, n = 0;
  for (const ch of ['r', 'g', 'b'] as Ch[]) {
    terms[ch] = {} as Record<Term, number>;
    for (const tm of TERMS) {
      const d = live[ch][tm] - ref[ch][tm];
      terms[ch][tm] = d; ss += d * d; n++;
      if (Math.abs(d) > Math.abs(worst.pp)) worst = { ch, term: tm, pp: d };
    }
  }
  const dRg = (live.rg / ref.rg - 1) * 100, dBg = (live.bg / ref.bg - 1) * 100;
  return { terms, dRg, dBg, worst, distance: Math.sqrt(ss / n + dRg * dRg + dBg * dBg) };
}

/** Stored fingerprints ranked by distance to the live one (which lens/zoom is on the camera?). */
export function rankPrints(live: Pick<LensPrint, Ch | 'rg' | 'bg'>, prints: LensPrint[]) {
  return prints.map((p) => ({ p, d: comparePrints(live, p) })).sort((a, b) => a.d.distance - b.d.distance);
}

/** Fingerprint of a lens nearest in zoom (same lens name), for "after the lens change". */
export function nearestZoom(prints: LensPrint[], lens: string, zoom: number) {
  const same = prints.filter((p) => p.lens === lens);
  return same.length ? same.reduce((m, p) => (Math.abs(p.zoom - zoom) < Math.abs(m.zoom - zoom) ? p : m), same[0]) : null;
}

// ---------------------------------------------------------------- storage

const KEY = 'lz-scopes.lensprints';

export function loadPrints(): LensPrint[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v.filter((p) => p && typeof p.lens === 'string' && p.r && p.g && p.b) : []; } catch { return []; }
}
export function savePrints(list: LensPrint[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode */ }
}
/** Add or replace (same lens and zoom). */
export function storePrint(p: LensPrint) {
  const list = loadPrints().filter((x) => !(x.lens === p.lens && x.zoom === p.zoom));
  list.push(p);
  list.sort((a, b) => a.lens.localeCompare(b.lens) || a.zoom - b.zoom);
  savePrints(list);
  return list;
}
export const printId = (p: Pick<LensPrint, 'lens' | 'zoom'>) => `${p.lens}@${p.zoom}`;
