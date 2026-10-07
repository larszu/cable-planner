// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// "SMPTE 75 % (LZ)": the start pattern with a hidden signature. The picture looks like the
// SMPTE 75 % bars + PLUGE, but in the black field of the bottom row (between the +Q field and
// the PLUGE) the pixel levels lie between 0.8 % and 3.8 % so that the waveform – which plots
// level over picture column – draws "Lars Zumpe / Medien- / produktion" in three lines. On a monitor these
// levels are practically black (BT.1886: 3.9 % → 0.04 % of peak luminance); in the waveform the
// text is best read with the black magnifier (⚙ Lupe → Schwarz).
//
// Bars, PLUGE and the other fields keep their levels; as a 16-bit frame (patterns16.ts) the
// 75 % bars are exact (10-bit 721) and the PLUGE uses the BT.2111-3 codes 48/64/80/64/99/64.
// The bitmap font is our own 5×7 drawing.

import { CodeRaster } from './patterns16';

/** 5×7 glyphs, rows top to bottom, '#' = on. Only the letters of the signature. */
const FONT: Record<string, string[]> = {
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#...#', '#...#'],
  p: ['.....', '.....', '####.', '#...#', '####.', '#....', '#....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  d: ['....#', '....#', '.##.#', '#..##', '#...#', '#...#', '.####'],
  i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  n: ['.....', '.....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  '-': ['.....', '.....', '.....', '####.', '.....', '.....', '.....'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

export const EGG_LINES = ['Lars Zumpe', 'Medien-', 'produktion'];
/**
 * 10-bit narrow codes of the glyph rows (top row first), one code (0.11 %) per row, three codes
 * between the lines: 97…91 (3.0–3.8 %), 87…81, 77…71 (0.8–1.5 %). All below the +4 % PLUGE step.
 */
export const EGG_LEVELS = [[97, 96, 95, 94, 93, 92, 91], [87, 86, 85, 84, 83, 82, 81], [77, 76, 75, 74, 73, 72, 71]];

/** Active glyph columns of a text line: for each column (5 px glyph + 1 px gap) the set rows. */
function columns(text: string, width: number): number[][] {
  const cols: number[][] = [];
  for (const ch of text) {
    const g = FONT[ch] ?? FONT[' '];
    for (let x = 0; x < 5; x++) cols.push(g.map((row, y) => (row[x] === '#' ? y : -1)).filter((y) => y >= 0));
    cols.push([]);
  }
  // centre in `width` glyph columns
  const pad = Math.max(0, Math.floor((width - cols.length) / 2));
  return [...Array.from({ length: pad }, () => []), ...cols];
}

/**
 * Levels (10-bit codes) that should appear in each column of a region `w` px wide: both text
 * lines, line 1 above line 2. Columns without ink are black (64).
 */
export function eggColumnLevels(w: number): number[][] {
  const width = Math.max(...EGG_LINES.map((l) => l.length)) * 6;
  const lines = EGG_LINES.map((l) => columns(l, width));
  return Array.from({ length: w }, (_, x) => {
    const gc = Math.floor((x / w) * width);
    return lines.flatMap((cols, li) => (cols[gc] ?? []).map((row) => EGG_LEVELS[li][row]));
  });
}

const lv8 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
const code = (v8: number) => Math.round(64 + (876 * v8) / 255);

/**
 * SMPTE 75 % bars + PLUGE with the same geometry as patterns.ts smpteBars, as a code raster,
 * plus the signature in the black field (x from 5/4·3/7 to 5/7 of the width, bottom quarter).
 */
export function smpteLzRaster(w: number, h: number): CodeRaster {
  const r = new CodeRaster(w, h, 64);
  const bw = w / 7, a = 721, k = 64;
  const top: [number, number, number][] = [[a, a, a], [a, a, k], [k, a, a], [k, a, k], [a, k, a], [a, k, k], [k, k, a]];
  top.forEach((c, i) => r.fill(i * bw, 0, (i + 1) * bw, h * 0.67, c));
  const mid = [top[6], [k, k, k], top[4], [k, k, k], top[2], [k, k, k], top[0]] as [number, number, number][];
  mid.forEach((c, i) => r.fill(i * bw, h * 0.67, (i + 1) * bw, h * 0.75, c));
  const y = h * 0.75, qw = (bw * 5) / 4;
  // −I, 100 % white, +Q: the same 8-bit full-range values as smpteBars
  r.fill(0, y, qw, h, [0, 33, 76].map(code) as [number, number, number]);
  r.fill(qw, y, qw * 2, h, [940, 940, 940]);
  r.fill(qw * 2, y, qw * 3, h, [50, 0, 106].map(code) as [number, number, number]);
  // PLUGE as in smpteBars (BT.2111-3 Tab. 2): −2 %, 0 %, +2 %, 0 %, +4 %, 0 %
  const pw = bw / 3;
  [48, 64, 80, 64, 99, 64].forEach((c, i) => r.fill(bw * 5 + i * pw, y, bw * 5 + (i + 1) * pw, h, [c, c, c]));
  // signature in the black field between +Q and PLUGE
  const x0 = Math.round(qw * 3), x1 = Math.round(bw * 5), y0 = Math.round(y);
  const levels = eggColumnLevels(x1 - x0);
  for (let x = x0; x < x1; x++) {
    const l = levels[x - x0];
    if (!l.length) continue;
    for (let yy = y0; yy < h; yy++) { const c = l[(yy - y0) % l.length]; r.fill(x, yy, x + 1, yy + 1, [c, c, c]); }
  }
  return r;
}

/** 8-bit check used by the tests: the canvas version keeps the signature below 4 % too. */
export const eggMax8 = () => lv8((97 - 64) / 876);
