// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Cabinet map drawing shared by the camera check and the light-meter check (#10/#11).

import { cabinets, type WallConfig } from './wall';

/** Diverging colour for a deviation: blue (lower) – grey – red (higher); `range` = full scale. */
export function heatColor(v: number, range: number, oneSided = false) {
  if (!Number.isFinite(v)) return '#333';
  const t = Math.max(-1, Math.min(1, v / range)), a = Math.abs(t);
  const base = [60, 62, 66], hot = oneSided ? [230, 170, 40] : t > 0 ? [230, 70, 50] : [60, 120, 235];
  return `rgb(${base.map((b, i) => Math.round(b + (hot[i] - b) * a)).join(',')})`;
}

/**
 * Wall as a grid of cabinets coloured by `values` (label → number); cabinets without a value
 * stay dark grey. `text` formats the value shown in the cell.
 */
export function drawCabinetMap(cv: HTMLCanvasElement, wall: WallConfig, values: Map<string, number>, range: number, caption: string, text: (v: number) => string, opts: { oneSided?: boolean; mark?: string } = {}) {
  const ctx = cv.getContext('2d')!;
  const W = cv.width, sc = W / (wall.cols * wall.cabW), Ht = Math.round(wall.rows * wall.cabH * sc);
  cv.height = Ht + 28;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, cv.height);
  const cw = wall.cabW * sc, ch = wall.cabH * sc;
  for (const c of cabinets(wall)) {
    const v = values.get(c.label);
    ctx.fillStyle = v === undefined ? '#1a1c1f' : heatColor(v, range, opts.oneSided); ctx.fillRect(c.c * cw, c.r * ch, cw, ch);
    ctx.strokeStyle = c.label === opts.mark ? '#fff' : '#000'; ctx.lineWidth = c.label === opts.mark ? 3 : 1;
    ctx.strokeRect(c.c * cw + 1.5, c.r * ch + 1.5, cw - 3, ch - 3);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = Math.max(8, Math.min(ch / 4.5, cw / 5.5));
    if (v !== undefined) { ctx.fillStyle = '#fff'; ctx.font = `600 ${fs}px system-ui`; ctx.fillText(text(v), c.c * cw + cw / 2, c.r * ch + ch / 2 + fs * 0.45); }
    ctx.font = `${fs * 0.7}px system-ui`; ctx.fillStyle = '#ddd'; ctx.fillText(`${c.label} #${c.id}`, c.c * cw + cw / 2, c.r * ch + ch / 2 - fs * 0.6);
  }
  ctx.fillStyle = '#aaa'; ctx.font = '12px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(caption, 6, Ht + 14);
}

/** Stack canvases vertically into one PNG blob. */
export function stackCanvases(list: HTMLCanvasElement[]): Promise<Blob | null> {
  const w = Math.max(...list.map((c) => c.width)), h = list.reduce((a, c) => a + c.height + 8, 0);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  let y = 0;
  for (const c of list) { ctx.drawImage(c, 0, y); y += c.height + 8; }
  return new Promise((ok) => out.toBlob(ok, 'image/png'));
}
