// LUT files: parsers for .cube (1D/3D, Adobe and Resolve keywords), .3dl, .spi3d, .spi1d and
// .csp, CPU application (1D linear, 3D tetrahedral) and a small persistent library.
//
// The file structure follows djieff/prism src/prism/io/lut/loader.py (MIT, Copyright (c) 2026
// Jean-Francois Bouchard): .cube l. 352–421, .spi3d l. 433–480, .3dl l. 483–521, CSPLUTV100
// l. 524–624. Written anew in TypeScript; deviations: .3dl output scale from the bit depth
// instead of the file maximum, CSP pre-LUTs as "n / n inputs / n outputs" rows per channel.

type V3 = [number, number, number];

export interface Lut1D { size: number; data: Float32Array /* size×3, per channel */; min: V3; max: V3 }
export interface Lut3D { size: number; data: Float32Array /* size³×3, red fastest */; min: V3; max: V3 }
export interface Lut {
  name: string; format: string; title?: string;
  /** applied first: 1D LUT or shaper (CSP pre-LUT, Resolve cube shaper) */
  pre?: Lut1D;
  cube?: Lut3D;
}

export class LutError extends Error {}

const nums = (line: string) => line.trim().split(/\s+/).map(Number);
const lines = (text: string) => text.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);

function checkFinite(a: Float32Array, what: string) {
  for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) throw new LutError(`${what}: ungültiger Wert`);
}

/** .cube: Adobe (DOMAIN_MIN/MAX) and Resolve (LUT_1D/3D_INPUT_RANGE, 1D shaper before 3D). */
export function parseCube(text: string, name = 'lut.cube'): Lut {
  let s1 = 0, s3 = 0, title: string | undefined;
  let dMin: V3 = [0, 0, 0], dMax: V3 = [1, 1, 1];
  let r1: [number, number] | null = null, r3: [number, number] | null = null;
  const rows: number[][] = [];
  for (const l of lines(text)) {
    const [key, ...rest] = l.split(/\s+/);
    if (key === 'TITLE') title = l.slice(5).trim().replace(/^"|"$/g, '');
    else if (key === 'LUT_1D_SIZE') s1 = Number(rest[0]);
    else if (key === 'LUT_3D_SIZE') s3 = Number(rest[0]);
    else if (key === 'DOMAIN_MIN') dMin = rest.map(Number) as V3;
    else if (key === 'DOMAIN_MAX') dMax = rest.map(Number) as V3;
    else if (key === 'LUT_1D_INPUT_RANGE') r1 = [Number(rest[0]), Number(rest[1])];
    else if (key === 'LUT_3D_INPUT_RANGE') r3 = [Number(rest[0]), Number(rest[1])];
    else if (/^[-+.\d]/.test(key)) rows.push(nums(l));
  }
  if (!s1 && !s3) throw new LutError(`${name}: LUT_1D_SIZE oder LUT_3D_SIZE fehlt`);
  const need = s1 + s3 ** 3;
  if (rows.length !== need) throw new LutError(`${name}: ${rows.length} Zeilen statt ${need}`);
  const lut: Lut = { name, format: 'cube', title };
  const take = (from: number, n: number) => {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set(rows[from + i].slice(0, 3), i * 3);
    checkFinite(a, name);
    return a;
  };
  const both = s1 && s3;
  if (s1) {
    const min: V3 = r1 ? [r1[0], r1[0], r1[0]] : both ? [0, 0, 0] : dMin;
    const max: V3 = r1 ? [r1[1], r1[1], r1[1]] : both ? [1, 1, 1] : dMax;
    lut.pre = { size: s1, data: take(0, s1), min, max };
  }
  if (s3) {
    const min: V3 = r3 ? [r3[0], r3[0], r3[0]] : both ? [0, 0, 0] : dMin;
    const max: V3 = r3 ? [r3[1], r3[1], r3[1]] : both ? [1, 1, 1] : dMax;
    lut.cube = { size: s3, data: take(s1, s3 ** 3), min, max };
  }
  return lut;
}

/** .3dl (Autodesk/Lustre): first row = input mesh, then R G B integers, blue fastest. */
export function parse3dl(text: string, name = 'lut.3dl'): Lut {
  const ls = lines(text).filter((l) => !/^[A-Za-z]/.test(l)); // skip e.g. "3DMESH" / "Mesh 4 12"
  const mesh = nums(ls[0]);
  const n = mesh.length;
  if (n < 2) throw new LutError(`${name}: Mesh-Zeile fehlt`);
  const rows = ls.slice(1).map(nums).filter((r) => r.length >= 3);
  if (rows.length !== n ** 3) throw new LutError(`${name}: ${rows.length} Zeilen statt ${n ** 3}`);
  const maxOut = Math.max(...rows.map((r) => Math.max(r[0], r[1], r[2])));
  const bits = [10, 12, 14, 16].find((b) => maxOut <= 2 ** b - 1) ?? 16;
  const scale = 2 ** bits - 1, inMax = mesh[n - 1] || 1;
  const data = new Float32Array(n ** 3 * 3);
  // file order: r slowest, b fastest → store red fastest
  let k = 0;
  for (let r = 0; r < n; r++) for (let g = 0; g < n; g++) for (let b = 0; b < n; b++, k++) {
    const o = ((b * n + g) * n + r) * 3;
    data[o] = rows[k][0] / scale; data[o + 1] = rows[k][1] / scale; data[o + 2] = rows[k][2] / scale;
  }
  // non-uniform meshes are not supported: the mesh must be evenly spaced
  for (let i = 1; i < n; i++) if (Math.abs(mesh[i] - (inMax * i) / (n - 1)) > inMax / (n - 1) / 2) throw new LutError(`${name}: ungleichmäßiges Mesh`);
  return { name, format: '3dl', cube: { size: n, data, min: [0, 0, 0], max: [1, 1, 1] } };
}

/** .spi3d (Sony Imageworks): "SPILUT 1.0", "3 3", "N N N", then "r g b R G B" with indices. */
export function parseSpi3d(text: string, name = 'lut.spi3d'): Lut {
  const ls = lines(text);
  if (!ls[0]?.startsWith('SPILUT')) throw new LutError(`${name}: Kopf SPILUT fehlt`);
  const [nx, ny, nz] = nums(ls[2]);
  if (!(nx === ny && ny === nz && nx > 1)) throw new LutError(`${name}: nur würfelförmige spi3d werden unterstützt`);
  const n = nx, data = new Float32Array(n ** 3 * 3), seen = new Uint8Array(n ** 3);
  for (const l of ls.slice(3)) {
    const t = nums(l);
    if (t.length < 6) continue;
    const [r, g, b] = t;
    if (r < 0 || g < 0 || b < 0 || r >= n || g >= n || b >= n) throw new LutError(`${name}: Index außerhalb`);
    const i = (b * n + g) * n + r;
    data.set(t.slice(3, 6), i * 3); seen[i] = 1;
  }
  if (seen.some((v) => !v)) throw new LutError(`${name}: unvollständig`);
  return { name, format: 'spi3d', cube: { size: n, data, min: [0, 0, 0], max: [1, 1, 1] } };
}

/** .spi1d: "From a b", "Length N", "Components 1|3", then values inside { }. */
export function parseSpi1d(text: string, name = 'lut.spi1d'): Lut {
  let from: [number, number] = [0, 1], len = 0, comp = 1;
  const vals: number[][] = [];
  for (const l of lines(text)) {
    const [k, ...r] = l.split(/\s+/);
    if (k === 'From') from = [Number(r[0]), Number(r[1])];
    else if (k === 'Length') len = Number(r[0]);
    else if (k === 'Components') comp = Number(r[0]);
    else if (/^[-+.\d]/.test(k)) vals.push(nums(l));
  }
  if (!len || vals.length !== len) throw new LutError(`${name}: ${vals.length} Werte statt ${len}`);
  const data = new Float32Array(len * 3);
  vals.forEach((v, i) => data.set(comp === 1 ? [v[0], v[0], v[0]] : v.slice(0, 3), i * 3));
  return { name, format: 'spi1d', pre: { size: len, data, min: [from[0], from[0], from[0]], max: [from[1], from[1], from[1]] } };
}

/**
 * .csp (Rising Sun CSPLUTV100, 3D): optional metadata block, per channel a pre-LUT
 * (count, row of inputs, row of outputs), then "Nr Ng Nb" and the cube, red fastest.
 * The pre-LUTs are resampled into one 1D shaper (1024 steps) over each channel's input range.
 */
export function parseCsp(text: string, name = 'lut.csp'): Lut {
  const ls = lines(text);
  if (ls[0] !== 'CSPLUTV100') throw new LutError(`${name}: Kopf CSPLUTV100 fehlt`);
  if (ls[1] !== '3D') throw new LutError(`${name}: nur 3D-CSP wird unterstützt`);
  let i = 2;
  if (ls[i] === 'BEGIN METADATA') { while (i < ls.length && ls[i] !== 'END METADATA') i++; i++; }
  const pre: { inp: number[]; out: number[] }[] = [];
  for (let c = 0; c < 3; c++) {
    const n = Number(ls[i++]);
    const inp = nums(ls[i++]), out = nums(ls[i++]);
    if (!(n >= 2) || inp.length !== n || out.length !== n) throw new LutError(`${name}: Pre-LUT ${c + 1} ungültig`);
    pre.push({ inp, out });
  }
  const [nr, ng, nb] = nums(ls[i++]);
  if (!(nr === ng && ng === nb && nr > 1)) throw new LutError(`${name}: nur würfelförmige CSP werden unterstützt`);
  const rows = ls.slice(i).map(nums).filter((r) => r.length >= 3);
  if (rows.length !== nr ** 3) throw new LutError(`${name}: ${rows.length} Zeilen statt ${nr ** 3}`);
  const data = new Float32Array(nr ** 3 * 3);
  rows.forEach((r, k) => data.set(r.slice(0, 3), k * 3));
  const identity = pre.every((p) => p.inp.length === 2 && p.inp[0] === 0 && p.inp[1] === 1 && p.out[0] === 0 && p.out[1] === 1);
  const lut: Lut = { name, format: 'csp', cube: { size: nr, data, min: [0, 0, 0], max: [1, 1, 1] } };
  if (!identity) {
    const N = 1024, sd = new Float32Array(N * 3);
    const min = pre.map((p) => p.inp[0]) as V3, max = pre.map((p) => p.inp[p.inp.length - 1]) as V3;
    for (let c = 0; c < 3; c++) for (let k = 0; k < N; k++) sd[k * 3 + c] = piecewise(pre[c].inp, pre[c].out, min[c] + ((max[c] - min[c]) * k) / (N - 1));
    lut.pre = { size: N, data: sd, min, max };
  }
  return lut;
}

function piecewise(xs: number[], ys: number[], x: number) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1] || 1);
  return ys[ys.length - 1];
}

export const LUT_EXTENSIONS = ['.cube', '.3dl', '.spi3d', '.spi1d', '.csp'];

export function parseLut(text: string, name: string): Lut {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  if (ext === '.cube') return text.trimStart().startsWith('CSPLUTV100') ? { ...parseCsp(text, name), format: 'cube (CSP)' } : parseCube(text, name);
  if (ext === '.3dl') return parse3dl(text, name);
  if (ext === '.spi3d') return parseSpi3d(text, name);
  if (ext === '.spi1d') return parseSpi1d(text, name);
  if (ext === '.csp') return parseCsp(text, name);
  throw new LutError(`${name}: Format nicht unterstützt (${LUT_EXTENSIONS.join(', ')})`);
}

// ---------------------------------------------------------------- application (CPU mirror of the shader)

const norm = (v: number, min: number, max: number) => Math.min(1, Math.max(0, (v - min) / (max - min || 1)));

export function apply1D(l: Lut1D, rgb: number[]): number[] {
  return [0, 1, 2].map((c) => {
    const f = norm(rgb[c], l.min[c], l.max[c]) * (l.size - 1), i = Math.min(l.size - 2, Math.floor(f)), t = f - i;
    return l.data[i * 3 + c] * (1 - t) + l.data[(i + 1) * 3 + c] * t;
  });
}

/** Tetrahedral interpolation (the six tetrahedra of the unit cube along the grey diagonal). */
export function apply3D(l: Lut3D, rgb: number[]): number[] {
  const n = l.size;
  const f = [0, 1, 2].map((c) => norm(rgb[c], l.min[c], l.max[c]) * (n - 1));
  const i = f.map((v) => Math.min(n - 2, Math.floor(v)));
  const [fr, fg, fb] = f.map((v, c) => v - i[c]);
  const at = (dr: number, dg: number, db: number) => {
    const o = (((i[2] + db) * n + (i[1] + dg)) * n + (i[0] + dr)) * 3;
    return [l.data[o], l.data[o + 1], l.data[o + 2]];
  };
  const mix = (w: [number, number[]][]) => [0, 1, 2].map((c) => w.reduce((s, [k, v]) => s + k * v[c], 0));
  const c000 = at(0, 0, 0), c111 = at(1, 1, 1);
  if (fr > fg) {
    if (fg > fb) return mix([[1 - fr, c000], [fr - fg, at(1, 0, 0)], [fg - fb, at(1, 1, 0)], [fb, c111]]);
    if (fr > fb) return mix([[1 - fr, c000], [fr - fb, at(1, 0, 0)], [fb - fg, at(1, 0, 1)], [fg, c111]]);
    return mix([[1 - fb, c000], [fb - fr, at(0, 0, 1)], [fr - fg, at(1, 0, 1)], [fg, c111]]);
  }
  if (fb > fg) return mix([[1 - fb, c000], [fb - fg, at(0, 0, 1)], [fg - fr, at(0, 1, 1)], [fr, c111]]);
  if (fb > fr) return mix([[1 - fg, c000], [fg - fb, at(0, 1, 0)], [fb - fr, at(0, 1, 1)], [fr, c111]]);
  return mix([[1 - fg, c000], [fg - fr, at(0, 1, 0)], [fr - fb, at(1, 1, 0)], [fb, c111]]);
}

export function applyLut(l: Lut, rgb: number[]): number[] {
  let c = rgb;
  if (l.pre) c = apply1D(l.pre, c);
  if (l.cube) c = apply3D(l.cube, c);
  return c;
}

/** Identity 3D .cube text (for tests and as a template). */
export function identityCube(n: number) {
  const out = [`LUT_3D_SIZE ${n}`];
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) out.push([r, g, b].map((v) => (v / (n - 1)).toFixed(6)).join(' '));
  return out.join('\n');
}

// ---------------------------------------------------------------- library (in memory + IndexedDB)

/** Parsed LUTs by name. `version` changes whenever a LUT is (re)loaded, for texture caches. */
export const LUTS = new Map<string, Lut & { version: number }>();
let version = 0;
export const lutListeners = new Set<() => void>();

export function registerLut(lut: Lut) {
  LUTS.set(lut.name, { ...lut, version: ++version });
  lutListeners.forEach((f) => f());
}

const DB = 'lz-scopes', STORE = 'luts';
function db(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((ok) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'name' });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    } catch { ok(null); }
  });
}

export interface StoredLut { name: string; text: string; added: number }

/** Parse, register and remember a LUT file (text kept in IndexedDB for the next session). */
export async function addLutFile(file: File): Promise<Lut> {
  const text = await file.text();
  const lut = parseLut(text, file.name);
  registerLut(lut);
  const d = await db();
  if (d) await new Promise<void>((ok) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put({ name: file.name, text, added: Date.now() } satisfies StoredLut); tx.oncomplete = () => ok(); tx.onerror = () => ok(); });
  return lut;
}

/** Names of stored LUTs, newest first. */
export async function recentLuts(limit = 12): Promise<string[]> {
  const d = await db();
  if (!d) return [...LUTS.keys()];
  const all = await new Promise<StoredLut[]>((ok) => { const r = d.transaction(STORE).objectStore(STORE).getAll(); r.onsuccess = () => ok(r.result as StoredLut[]); r.onerror = () => ok([]); });
  const names = all.sort((a, b) => b.added - a.added).map((l) => l.name);
  for (const n of LUTS.keys()) if (!names.includes(n)) names.unshift(n);
  return names.slice(0, limit);
}

/** Load a stored LUT by name into LUTS (no-op if already there). */
export async function ensureLut(name: string): Promise<boolean> {
  if (LUTS.has(name)) return true;
  const d = await db();
  if (!d) return false;
  const s = await new Promise<StoredLut | undefined>((ok) => { const r = d.transaction(STORE).objectStore(STORE).get(name); r.onsuccess = () => ok(r.result as StoredLut | undefined); r.onerror = () => ok(undefined); });
  if (!s) return false;
  try { registerLut(parseLut(s.text, s.name)); return true; } catch { return false; }
}
