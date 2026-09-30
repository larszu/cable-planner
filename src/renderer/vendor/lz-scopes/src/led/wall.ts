// LED wall model (#10): wall and cabinet geometry, cabinet numbering, and the pattern
// settings shared between the main window and the pattern output window (same origin,
// so both read them from localStorage).
//
// LZ Scopes does not calibrate a wall: the correction coefficients are written by the
// LED processor (Brompton Tessera, NovaStar NovaLCT/NovaCLB, Colorlight). This module
// only describes the wall so test patterns and the camera check can use its grid.
// See docs/research/led-wall-und-messgeraete.md, A.1 and A.4.

export type CabinetOrder = 'rows' | 'cols' | 'snake';

export interface WallConfig {
  name: string;
  /** cabinet size in wall pixels (free, e.g. 176×176, 192×192, 256×256) */
  cabW: number; cabH: number;
  cols: number; rows: number;
  /** module size inside a cabinet in pixels; 0 = no module grid */
  modW: number; modH: number;
  /** position of the wall's top-left pixel in the output picture */
  offX: number; offY: number;
  /** numbering: row by row, column by column, or snake (every other row reversed) */
  order: CabinetOrder;
  /** number of the first cabinet */
  start: number;
}

export type RGB01 = [number, number, number];

export interface LedSettings {
  wall: WallConfig;
  /** free level of the flat field in % (0–100, fractions allowed) */
  level: number;
  /** channels of the flat field */
  channels: [boolean, boolean, boolean];
  /** 1-px grid spacing of the pixel-mapping pattern */
  gridStep: number;
  /** highest code value of the low-level steps and ramps */
  lowMax: number;
  /** moving direction of the scroll pattern */
  scroll: 'h' | 'v';
  patch: {
    /** patch area in % of the picture (1, 4, 10, 25, 100) */
    window: number;
    /** surround level in % */
    surround: number;
    list: RGB01[];
    index: number;
    auto: boolean;
    /** seconds per patch in auto mode */
    seconds: number;
    label: boolean;
  };
}

export const DEFAULT_WALL: WallConfig = { name: 'Wand 1', cabW: 192, cabH: 192, cols: 10, rows: 5, modW: 0, modH: 0, offX: 0, offY: 0, order: 'rows', start: 1 };

export const DEFAULT_SETTINGS: LedSettings = {
  wall: DEFAULT_WALL, level: 50, channels: [true, true, true], gridStep: 16, lowMax: 20, scroll: 'h',
  patch: { window: 10, surround: 0, list: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]], index: 0, auto: false, seconds: 3, label: false },
};

/** Size of the wall in pixels (without the offset). */
export const wallSize = (w: WallConfig) => ({ w: w.cabW * w.cols, h: w.cabH * w.rows });

/** Size of the picture the wall needs: offset plus wall. */
export const pictureSize = (w: WallConfig) => ({ w: w.offX + w.cabW * w.cols, h: w.offY + w.cabH * w.rows });

/** Running number of the cabinet in column `c`, row `r` (both from 0). */
export function cabinetNumber(w: WallConfig, c: number, r: number) {
  if (w.order === 'cols') return w.start + c * w.rows + r;
  if (w.order === 'snake') return w.start + r * w.cols + (r % 2 ? w.cols - 1 - c : c);
  return w.start + r * w.cols + c;
}

/** Label of a cabinet: column-row from 1 (as on the wall plan) plus the running number. */
export const cabinetLabel = (_w: WallConfig, c: number, r: number) => `C${c + 1}-R${r + 1}`;

export interface Cabinet { c: number; r: number; id: number; label: string; x: number; y: number; w: number; h: number }

/** All cabinets with their rectangle in wall pixels (offset not included). */
export function cabinets(w: WallConfig): Cabinet[] {
  const out: Cabinet[] = [];
  for (let r = 0; r < w.rows; r++) for (let c = 0; c < w.cols; c++) {
    out.push({ c, r, id: cabinetNumber(w, c, r), label: cabinetLabel(w, c, r), x: c * w.cabW, y: r * w.cabH, w: w.cabW, h: w.cabH });
  }
  return out;
}

const int = (v: unknown, min: number, max: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

/** Clamp a (possibly stored or typed) wall to sane numbers; pictures stay ≤ 16384 px. */
export function sanitizeWall(v: Partial<WallConfig> | null | undefined): WallConfig {
  const d = DEFAULT_WALL, x = v ?? {};
  const cabW = int(x.cabW, 8, 4096, d.cabW), cabH = int(x.cabH, 8, 4096, d.cabH);
  const wall: WallConfig = {
    name: String(x.name ?? d.name).slice(0, 60) || d.name,
    cabW, cabH,
    cols: int(x.cols, 1, Math.floor(16384 / cabW), d.cols), rows: int(x.rows, 1, Math.floor(16384 / cabH), d.rows),
    modW: int(x.modW, 0, cabW, 0), modH: int(x.modH, 0, cabH, 0),
    offX: int(x.offX, 0, 8192, 0), offY: int(x.offY, 0, 8192, 0),
    order: x.order === 'cols' || x.order === 'snake' ? x.order : 'rows',
    start: int(x.start, 0, 99999, 1),
  };
  wall.offX = Math.min(wall.offX, 16384 - wall.cabW * wall.cols);
  wall.offY = Math.min(wall.offY, 16384 - wall.cabH * wall.rows);
  return wall;
}

const clamp01 = (v: unknown) => Math.min(1, Math.max(0, Number(v) || 0));

export function sanitizeSettings(v: Partial<LedSettings> | null | undefined): LedSettings {
  const d = DEFAULT_SETTINGS, x = v ?? {}, p = (x.patch ?? {}) as Partial<LedSettings['patch']>;
  const list = Array.isArray(p.list) ? p.list.filter((c) => Array.isArray(c) && c.length === 3).map((c) => c.map(clamp01) as RGB01).slice(0, 1000) : d.patch.list;
  const ch = Array.isArray(x.channels) && x.channels.length === 3 ? x.channels.map(Boolean) as [boolean, boolean, boolean] : d.channels;
  return {
    wall: sanitizeWall(x.wall),
    level: Math.min(100, Math.max(0, Number(x.level ?? d.level) || 0)),
    channels: ch,
    gridStep: int(x.gridStep, 2, 1024, d.gridStep),
    lowMax: int(x.lowMax, 1, 255, d.lowMax),
    scroll: x.scroll === 'v' ? 'v' : 'h',
    patch: {
      window: Math.min(100, Math.max(0.1, Number(p.window ?? d.patch.window) || d.patch.window)),
      surround: Math.min(100, Math.max(0, Number(p.surround ?? 0) || 0)),
      list: list.length ? list : d.patch.list,
      index: int(p.index, 0, 999, 0),
      auto: !!p.auto,
      seconds: Math.min(600, Math.max(0.2, Number(p.seconds ?? d.patch.seconds) || d.patch.seconds)),
      label: !!p.label,
    },
  };
}

// ---------------------------------------------------------------- persistence

const SETTINGS_KEY = 'lz-scopes.led';
const WALLS_KEY = 'lz-scopes.led-walls';
let cache: LedSettings | null = null;

if (typeof window !== 'undefined') {
  // the other window changed the settings: next pattern draw reads them again
  window.addEventListener('storage', (e) => { if (e.key === SETTINGS_KEY) cache = null; });
}

export function ledSettings(): LedSettings {
  if (cache) return cache;
  let stored: Partial<LedSettings> | null = null;
  try { stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'); } catch { /* storage unavailable */ }
  cache = sanitizeSettings(stored);
  return cache;
}

export function setLedSettings(patch: Partial<LedSettings>) {
  cache = sanitizeSettings({ ...ledSettings(), ...patch });
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  return cache;
}

/** Saved walls (one per venue or set). */
export function savedWalls(): WallConfig[] {
  try {
    const v = JSON.parse(localStorage.getItem(WALLS_KEY) ?? '[]');
    return Array.isArray(v) ? v.map(sanitizeWall) : [];
  } catch { return []; }
}

export function saveWall(w: WallConfig) {
  const list = savedWalls().filter((x) => x.name !== w.name);
  list.push(sanitizeWall(w));
  try { localStorage.setItem(WALLS_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function deleteWall(name: string) {
  try { localStorage.setItem(WALLS_KEY, JSON.stringify(savedWalls().filter((x) => x.name !== name))); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- patch lists

/**
 * Patch sets for the sequencer. "Unreal" follows Epic's camera colour calibration for
 * ICVFX (UE 5.7 docs): R, G, B, W as the minimum set, a 5×5×5 grid in 0.25 steps to verify.
 */
export const PATCH_PRESETS: { id: string; name: string; list: () => RGB01[] }[] = [
  { id: 'rgbw', name: 'R, G, B, W (Unreal-Mindestsatz)', list: () => [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]] },
  {
    id: 'grid5', name: '5×5×5-Gitter in 0,25 (Unreal-Prüfsatz, 125 Felder)',
    list: () => { const o: RGB01[] = []; for (let r = 0; r < 5; r++) for (let g = 0; g < 5; g++) for (let b = 0; b < 5; b++) o.push([r / 4, g / 4, b / 4]); return o; },
  },
  { id: 'gray10', name: 'Graustufen 0–100 % in 10 %', list: () => Array.from({ length: 11 }, (_, i) => [i / 10, i / 10, i / 10] as RGB01) },
  { id: 'gray-low', name: 'Graustufen 0–10 % in 1 %', list: () => Array.from({ length: 11 }, (_, i) => [i / 100, i / 100, i / 100] as RGB01) },
];

/** Parse a patch list: one colour per line, "r g b" or "r,g,b" in 0–1, 0–100 % (with %) or 0–255. */
export function parsePatchList(text: string): RGB01[] {
  const out: RGB01[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.replace(/#.*/, '').trim();
    if (!t) continue;
    const pct = t.includes('%');
    const n = t.replace(/%/g, '').split(/[\s,;]+/).filter(Boolean).map(Number);
    if (n.length !== 3 || n.some((v) => !Number.isFinite(v))) continue;
    const scale = pct ? 100 : n.some((v) => v > 1) ? 255 : 1;
    out.push(n.map((v) => Math.min(1, Math.max(0, v / scale))) as RGB01);
  }
  return out;
}

/** Index of the patch shown at time t (s) – manual index, or stepping every `seconds`. */
export function patchIndex(p: LedSettings['patch'], t: number) {
  const n = Math.max(1, p.list.length);
  return p.auto ? Math.floor(t / p.seconds) % n : Math.min(p.index, n - 1);
}
