// LED wall test patterns (#10), after docs/research/led-wall-und-messgeraete.md A.5.
// They draw the wall from the LED settings (src/led/wall.ts) at its offset into a picture
// of any size – normally the wall resolution. Canvas output is 8-bit full-range RGB:
// the low-level patterns can only show code values 0–255 (the #7 limit).

import type { PatternDef } from '../patterns';
import { cabinets, ledSettings, patchIndex, wallSize, type RGB01 } from './wall';

type Ctx = CanvasRenderingContext2D;
type RGB = [number, number, number];
const code = (p: number) => Math.round(Math.min(1, Math.max(0, p)) * 255);
const css = ([r, g, b]: RGB) => `rgb(${r},${g},${b})`;

function rect(ctx: Ctx, c: RGB | string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = typeof c === 'string' ? c : css(c);
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(x + w) - Math.round(x), Math.round(y + h) - Math.round(y));
}

function label(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') {
  ctx.font = `600 ${Math.max(6, Math.round(size))}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/** Exact per-pixel fill (no anti-aliasing, no dithering). */
function pixels(ctx: Ctx, x0: number, y0: number, w: number, h: number, fn: (x: number, y: number) => RGB | null) {
  x0 = Math.round(x0); y0 = Math.round(y0); w = Math.round(w); h = Math.round(h);
  if (w <= 0 || h <= 0) return;
  const img = ctx.getImageData(x0, y0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y);
    if (!c) continue;
    const i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, x0, y0);
}

/** Wall rectangle in the picture, clipped to it. */
function wallRect(w: number, h: number) {
  const s = ledSettings(), ws = wallSize(s.wall);
  return { s, x: s.wall.offX, y: s.wall.offY, w: Math.min(ws.w, w - s.wall.offX), h: Math.min(ws.h, h - s.wall.offY) };
}

/** Cabinet grid with IDs: checkerboard 20 %/30 %, 1-px frame per cabinet, ID, red top-left mark. */
function cabinetGrid(ctx: Ctx, W: number, H: number, modules: boolean) {
  const { s, x: ox, y: oy } = wallRect(W, H), wall = s.wall;
  rect(ctx, [0, 0, 0], 0, 0, W, H);
  for (const cab of cabinets(wall)) {
    const x = ox + cab.x, y = oy + cab.y;
    rect(ctx, (cab.c + cab.r) % 2 ? [code(0.3), code(0.3), code(0.3)] : [code(0.2), code(0.2), code(0.2)], x, y, cab.w, cab.h);
    if (modules && wall.modW > 0 && wall.modH > 0) {
      // module borders dashed, 1 px, 60 % grey
      ctx.fillStyle = css([code(0.6), code(0.6), code(0.6)]);
      const dash = Math.max(2, Math.round(Math.min(wall.modW, wall.modH) / 12));
      for (let mx = wall.modW; mx < cab.w; mx += wall.modW) for (let yy = 0; yy < cab.h; yy += dash * 2) ctx.fillRect(x + mx, y + yy, 1, Math.min(dash, cab.h - yy));
      for (let my = wall.modH; my < cab.h; my += wall.modH) for (let xx = 0; xx < cab.w; xx += dash * 2) ctx.fillRect(x + xx, y + my, Math.min(dash, cab.w - xx), 1);
    }
    // 1-px white frame on the cabinet's own edge pixels: a seam shows two lines
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, cab.w, 1); ctx.fillRect(x, y + cab.h - 1, cab.w, 1);
    ctx.fillRect(x, y, 1, cab.h); ctx.fillRect(x + cab.w - 1, y, 1, cab.h);
    // orientation: red triangle in the top-left corner
    const m = Math.max(4, Math.round(Math.min(cab.w, cab.h) * 0.12));
    ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 1 + m, y + 1); ctx.lineTo(x + 1, y + 1 + m); ctx.closePath(); ctx.fill();
    const th = cab.h * 0.3;
    label(ctx, cab.label, x + cab.w / 2, y + cab.h / 2 - th * 0.35, Math.min(th * 0.62, cab.w / 5), '#fff');
    label(ctx, `#${cab.id}`, x + cab.w / 2, y + cab.h / 2 + th * 0.45, Math.min(th * 0.42, cab.w / 6), '#ddd');
  }
}

/** Pixel mapping: 1-px grid every n px, diagonal over the wall, R/G/B/W corner pixels per cabinet. */
function pixelMap(ctx: Ctx, W: number, H: number) {
  const { s, x: ox, y: oy, w: ww, h: wh } = wallRect(W, H), n = s.gridStep;
  rect(ctx, [0, 0, 0], 0, 0, W, H);
  const cabs = cabinets(s.wall);
  pixels(ctx, ox, oy, ww, wh, (x, y) => {
    // diagonal from the top-left to the bottom-right wall corner: offsets between cabinets show as steps
    if (Math.round((y * (ww - 1)) / Math.max(1, wh - 1)) === x) return [255, 255, 255];
    if (x % n === 0 || y % n === 0) return [code(0.5), code(0.5), code(0.5)];
    return null;
  });
  const img = ctx.getImageData(ox, oy, ww, wh), d = img.data;
  const put = (x: number, y: number, c: RGB) => { if (x < 0 || y < 0 || x >= ww || y >= wh) return; const i = (y * ww + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
  for (const c of cabs) {
    put(c.x, c.y, [255, 0, 0]); put(c.x + c.w - 1, c.y, [0, 255, 0]);
    put(c.x, c.y + c.h - 1, [0, 0, 255]); put(c.x + c.w - 1, c.y + c.h - 1, [255, 255, 255]);
  }
  ctx.putImageData(img, ox, oy);
}

/** Frames drawn so far (the scroll moves exactly 1 px per drawn frame, like Brompton's scroll patterns). */
let frameNo = 0;

function scroll(ctx: Ctx, W: number, H: number) {
  const { s, x: ox, y: oy, w: ww, h: wh } = wallRect(W, H), f = frameNo++;
  rect(ctx, [0, 0, 0], 0, 0, W, H);
  ctx.fillStyle = '#fff';
  if (s.scroll === 'h') {
    ctx.fillRect(ox + (f % ww), oy, 1, wh);
    label(ctx, 'LZ SCOPES · 1 px / Frame', ox + ww - (f % (ww * 2)) + ww * 0.25, oy + wh * 0.5, Math.min(wh * 0.12, 120), '#fff', 'left');
  } else {
    ctx.fillRect(ox, oy + (f % wh), ww, 1);
    label(ctx, 'LZ SCOPES · 1 px / Frame', ox + ww / 2, oy + wh - (f % (wh * 2)) + wh * 0.25, Math.min(ww * 0.05, 120), '#fff');
  }
}

/** Flat field at a free level on the chosen channels. */
function flat(ctx: Ctx, W: number, H: number) {
  const s = ledSettings(), v = code(s.level / 100);
  rect(ctx, [s.channels[0] ? v : 0, s.channels[1] ? v : 0, s.channels[2] ? v : 0], 0, 0, W, H);
}

/** Low-level steps: code values 0…lowMax as equal columns, labelled with code and %. */
function lowGray(ctx: Ctx, W: number, H: number) {
  const { s, x: ox, y: oy, w: ww, h: wh } = wallRect(W, H), n = s.lowMax + 1;
  rect(ctx, [0, 0, 0], 0, 0, W, H);
  for (let i = 0; i < n; i++) {
    rect(ctx, [i, i, i], ox + (i * ww) / n, oy, ww / n, wh * 0.88);
    label(ctx, String(i), ox + ((i + 0.5) * ww) / n, oy + wh * 0.92, Math.min(wh * 0.035, (ww / n) * 0.45), '#888');
  }
  label(ctx, `Codewerte 0–${s.lowMax} (8 bit, ${((s.lowMax / 255) * 100).toFixed(1).replace('.', ',')} %)`, ox + ww / 2, oy + wh * 0.97, Math.min(wh * 0.025, 28), '#666');
}

/** Low-level ramps: codes 0…lowMax stretched over the full width, rows W, R, G, B. */
function lowRamp(ctx: Ctx, W: number, H: number) {
  const { s, x: ox, y: oy, w: ww, h: wh } = wallRect(W, H), n = s.lowMax + 1;
  rect(ctx, [0, 0, 0], 0, 0, W, H);
  const rows: ((v: number) => RGB)[] = [(v) => [v, v, v], (v) => [v, 0, 0], (v) => [0, v, 0], (v) => [0, 0, v]];
  rows.forEach((fn, k) => pixels(ctx, ox, oy + (k * wh) / 4, ww, wh / 4, (x) => fn(Math.min(s.lowMax, Math.floor((x * n) / ww)))));
}

/** Shutter/genlock: black/white per frame, big frame counter, fast bars moving 8 px per frame. */
function shutter(ctx: Ctx, W: number, H: number, t: number) {
  const { x: ox, y: oy, w: ww, h: wh } = wallRect(W, H), f = frameNo++;
  rect(ctx, [0, 0, 0], 0, 0, W, H);
  // top strip: white on even, black on odd frames
  rect(ctx, f % 2 ? [0, 0, 0] : [255, 255, 255], ox, oy, ww, wh * 0.12);
  label(ctx, String(f).padStart(6, '0'), ox + ww / 2, oy + wh * 0.36, Math.min(wh * 0.28, ww * 0.16), '#fff');
  label(ctx, `t = ${t.toFixed(3).replace('.', ',')} s`, ox + ww / 2, oy + wh * 0.55, Math.min(wh * 0.06, 60), '#aaa');
  // vertical bars moving right, horizontal bars moving down (8 px per frame)
  const bw = Math.max(4, Math.round(ww / 32)), step = 8;
  for (let x = ((f * step) % (bw * 4)) - bw * 4; x < ww; x += bw * 4) {
    const x0 = Math.max(0, x), x1 = Math.min(ww, x + bw);
    if (x1 > x0) rect(ctx, [255, 255, 255], ox + x0, oy + wh * 0.65, x1 - x0, wh * 0.15);
  }
  const bh = Math.max(4, Math.round(wh / 40)), band = wh * 0.18;
  for (let y = (f * step) % (bh * 4) - bh * 4; y < band; y += bh * 4) {
    const y0 = Math.max(0, y), y1 = Math.min(band, y + bh);
    if (y1 > y0) rect(ctx, [255, 255, 255], ox, oy + wh * 0.82 + y0, ww, y1 - y0);
  }
}

/** Moiré: line pairs 1–4 px vertical, horizontal and diagonal, concentric circles on the right. */
function moire(ctx: Ctx, W: number, H: number) {
  const { x: ox, y: oy, w: ww, h: wh } = wallRect(W, H);
  rect(ctx, [0, 0, 0], 0, 0, W, H);
  const gw = ww * 0.66, cw = gw / 4, rh = wh / 3;
  [1, 2, 3, 4].forEach((p, i) => {
    const x0 = ox + i * cw;
    pixels(ctx, x0, oy, cw, rh, (x) => (Math.floor(x / p) % 2 ? [0, 0, 0] : [255, 255, 255]));
    pixels(ctx, x0, oy + rh, cw, rh, (_x, y) => (Math.floor(y / p) % 2 ? [0, 0, 0] : [255, 255, 255]));
    pixels(ctx, x0, oy + 2 * rh, cw, rh, (x, y) => (Math.floor((x + y) / p) % 2 ? [0, 0, 0] : [255, 255, 255]));
    label(ctx, `${p} px`, x0 + cw / 2, oy + rh * 0.08, Math.min(rh * 0.08, 32), '#f00');
  });
  const cx = gw + (ww - gw) / 2, cy = wh / 2, R = Math.min(ww - gw, wh) / 2;
  pixels(ctx, ox + gw, oy, ww - gw, wh, (x, y) => {
    const r = Math.hypot(x + gw - cx, y - cy);
    return r > R ? null : Math.floor(r / 2) % 2 ? [0, 0, 0] : [255, 255, 255];
  });
}

/** Centred patch covering `window` % of the picture area, surround level, sequencer. */
function patch(ctx: Ctx, W: number, H: number, t: number) {
  const s = ledSettings(), p = s.patch, i = patchIndex(p, t), c: RGB01 = p.list[i] ?? [1, 1, 1];
  const sur = code(p.surround / 100);
  rect(ctx, [sur, sur, sur], 0, 0, W, H);
  const k = Math.sqrt(p.window / 100), pw = W * k, ph = H * k;
  rect(ctx, c.map(code) as RGB, (W - pw) / 2, (H - ph) / 2, pw, ph);
  if (p.label) {
    const txt = `${i + 1}/${p.list.length}  ${c.map((v) => code(v)).join(' ')}`;
    label(ctx, txt, W * 0.01, H * 0.97, Math.min(H * 0.025, 24), sur > 128 ? '#000' : '#888', 'left');
  }
}

export const LED_GROUP = 'LED-Wand';

export const LED_PATTERNS: PatternDef[] = [
  { id: 'led-cabinet-grid', name: 'Cabinet-Raster mit ID', group: LED_GROUP, draw: (c, w, h) => cabinetGrid(c, w, h, false) },
  { id: 'led-module-grid', name: 'Cabinet- und Modulraster', group: LED_GROUP, draw: (c, w, h) => cabinetGrid(c, w, h, true) },
  { id: 'led-pixelmap', name: 'Pixel-Mapping (Gitter, Diagonale, Eckpixel)', group: LED_GROUP, draw: pixelMap },
  { id: 'led-scroll', name: 'Scroll 1 px/Frame', group: LED_GROUP, animated: true, draw: scroll },
  { id: 'led-flat', name: 'Vollfeld freier Pegel', group: LED_GROUP, draw: flat },
  { id: 'led-lowgray', name: 'Graustufen fein (Low-Level)', group: LED_GROUP, draw: lowGray },
  { id: 'led-lowramp', name: 'Rampen fein W R G B (Low-Level)', group: LED_GROUP, draw: lowRamp },
  { id: 'led-shutter', name: 'Shutter/Genlock (Frame-Zähler)', group: LED_GROUP, animated: true, draw: shutter },
  { id: 'led-moire', name: 'Moiré (Linienpaare, Kreise)', group: LED_GROUP, draw: moire },
  { id: 'led-patch', name: 'Messfeld / Patch-Sequenzer', group: LED_GROUP, animated: true, draw: patch },
];
