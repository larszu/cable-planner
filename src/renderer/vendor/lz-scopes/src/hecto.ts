// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Hectorscope (#178): the picture as a surface in space. x/z are the picture coordinates (the
// floor), the height is the value of the pixel – Y′, one channel or the saturation. Gradients,
// vignetting, unevenly lit backgrounds and banding show up as slopes, dents or steps.
// Idea from screenshots of Nobe OmniScope ("HectorScope", iPad); own implementation, no code or
// assets taken over. Rendered as a point grid in the scatter shader (renderer.ts, mode 13) with
// the rotation of the 3D colour volume (cube.ts cubeRotation); no extra GLSL loops, so the
// SwiftShader build in CI keeps its WebGL context (see fetchMeasured in renderer.ts).
//
// Measured quantities (same definitions as the flat scopes):
//   luma: Y′ = Kr·R′ + Kg·G′ + Kb·B′ of the source matrix (BT.709 / BT.2020 / BT.601, color.ts LUMA)
//   r/g/b: the signal channel R′, G′ or B′
//   sat:  |CbCr| / 0.5 – the radius of the vectorscope, as in the saturation-over-luma scope (satlum)
// The floor grid is point-sampled (one pixel per grid point, optionally the panel's 3×3/5×5
// low-pass before the measurement); with "Auflösung" 256 a UHD frame is read every 15th pixel.

import { cubeProject, cubeRotation, type CubeView } from './cube';
import { FONT, LABEL } from './graticule';
import type { Rect } from './renderer';
import { t } from './i18n';

export type SurfaceAxis = 'luma' | 'r' | 'g' | 'b' | 'sat';
export const SURFACE_AXIS_ID: Record<SurfaceAxis, number> = { luma: 0, r: 1, g: 2, b: 3, sat: 4 };
export type SurfaceColour = 'height' | 'source';
/** grid columns across the picture (rows follow the aspect ratio) */
export const SURFACE_RES = [64, 128, 256, 512] as const;

export interface SurfaceSettings {
  axis: SurfaceAxis; colour: SurfaceColour; res: number;
  yaw: number; pitch: number; zoom?: number; panX?: number; panY?: number;
}
export const DEFAULT_SURFACE: SurfaceSettings = { axis: 'luma', colour: 'height', res: 256, yaw: -20, pitch: 35, zoom: 1, panX: 0, panY: 0 };
/** Blick von oben: picture orientation, the colour ramp becomes a false-colour picture */
export const TOP_VIEW = { yaw: 0, pitch: 90 };

/** height of 0 … 100 % in volume units (floor is 2 wide) */
export const SURFACE_HEIGHT = 1;

/**
 * Volume coordinates of a picture point: u, v = 0…1 across / down the picture, value 0…1,
 * aspect = height / width of the picture. Top row at the back (−z), so the view from above
 * (pitch 90°) shows the picture the right way up. Mirrored in the shader (renderer.ts mode 13).
 */
export function surfaceQ(u: number, v: number, value: number, aspect: number): number[] {
  return [(u - 0.5) * 2, (value - 0.5) * SURFACE_HEIGHT, (v - 0.5) * 2 * aspect];
}

/** Value of one signal R′G′B′ on the chosen axis (CPU mirror of the shader). */
export function surfaceValue(axis: SurfaceAxis, rgb: number[], k: { kr: number; kb: number }): number {
  if (axis === 'r') return rgb[0];
  if (axis === 'g') return rgb[1];
  if (axis === 'b') return rgb[2];
  const y = k.kr * rgb[0] + (1 - k.kr - k.kb) * rgb[1] + k.kb * rgb[2];
  if (axis === 'luma') return y;
  const cb = (rgb[2] - y) / (2 * (1 - k.kb)), cr = (rgb[0] - y) / (2 * (1 - k.kr));
  return Math.hypot(cb, cr) / 0.5;
}

/**
 * Height colour ramp (blue → cyan → green → yellow → red over 0…100 %), the same function as
 * surfRamp in the shader. Values outside 0…100 % keep the end colours.
 */
export function surfaceRamp(v: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, v)), f = (o: number) => Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - o)));
  return [f(3), f(2), f(1)];
}

export const SURFACE_GLSL = `
uniform vec4 uSurf; // x: axis (hecto.ts SURFACE_AXIS_ID), y: picture height / width, z: 1 = picture colours
vec3 surfRamp(float v) {
  float c = clamp(v, 0.0, 1.0);
  return clamp(vec3(1.5 - abs(4.0 * c - 3.0), 1.5 - abs(4.0 * c - 2.0), 1.5 - abs(4.0 * c - 1.0)), 0.0, 1.0);
}`;

const view = (s: SurfaceSettings): CubeView => ({ zoom: s.zoom ?? 1, panX: s.panX ?? 0, panY: s.panY ?? 0 });

/** Floor frame, height axis with 0/25/50/75/100 %, colour legend and the navigation hint. */
export function drawSurfaceGraticule(ctx: CanvasRenderingContext2D, r: Rect, s: SurfaceSettings, aspect: number, probe: { u: number; v: number; value: number } | null) {
  const rot = cubeRotation(s.yaw, s.pitch), vw = view(s);
  const P = (q: number[]): [number, number] => { const [x, y] = cubeProject(rot, q, vw); return [r.x + (x * 0.5 + 0.5) * r.w, r.y + (0.5 - y * 0.5) * r.h]; };
  const line = (pts: number[][], style: string, width = 1, dash: number[] = []) => {
    ctx.strokeStyle = style; ctx.lineWidth = width; ctx.setLineDash(dash);
    ctx.beginPath(); pts.forEach((q, i) => { const [x, y] = P(q); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
  };
  const STRONG = 'rgba(235, 220, 170, 0.85)', SOFT = 'rgba(210, 190, 120, 0.3)';
  const Q = (u: number, v: number, val: number) => surfaceQ(u, v, val, aspect);
  ctx.save();
  ctx.font = FONT;
  // floor (0 %) with a quarter grid, the 100 % level as a dashed frame
  const frame = (val: number) => [Q(0, 0, val), Q(1, 0, val), Q(1, 1, val), Q(0, 1, val), Q(0, 0, val)];
  for (const f of [0.25, 0.5, 0.75]) { line([Q(f, 0, 0), Q(f, 1, 0)], SOFT, 1, [2, 3]); line([Q(0, f, 0), Q(1, f, 0)], SOFT, 1, [2, 3]); }
  line(frame(0), STRONG, 1.5);
  line(frame(1), SOFT, 1, [4, 3]);
  // height axis at the back left corner (top left of the picture)
  line([Q(0, 0, 0), Q(0, 0, 1)], STRONG, 1.5);
  ctx.setLineDash([]);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const [x, y] = P(Q(0, 0, v));
    ctx.fillStyle = STRONG; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    ctx.fillStyle = LABEL; ctx.fillText(`${v * 100}`, x - 5, y);
  }
  const [ax, ay] = P(Q(0, 0, 1.12));
  ctx.textAlign = 'center'; ctx.fillStyle = '#f0e6c8';
  ctx.fillText(`${t(`scope.surface.axis.${s.axis}`)} %`, ax, ay);
  // which edge of the picture is where
  const [tx, ty] = P(Q(0.5, -0.06, 0));
  ctx.fillStyle = LABEL; ctx.fillText(t('scope.surface.top'), tx, ty);
  if (probe) {
    const [x0, y0] = P(Q(probe.u, probe.v, 0)), [x1, y1] = P(Q(probe.u, probe.v, probe.value));
    ctx.strokeStyle = '#00dcff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.arc(x1, y1, 5, 0, Math.PI * 2); ctx.stroke();
  }
  if (s.colour === 'height') {
    // legend of the height colours, 0 % at the bottom
    const lw = 8, lh = Math.min(120, r.h * 0.4), lx = r.x + r.w - lw - 26, ly = r.y + 8;
    const g = ctx.createLinearGradient(0, ly + lh, 0, ly);
    for (let i = 0; i <= 8; i++) { const [cr, cg, cb] = surfaceRamp(i / 8); g.addColorStop(i / 8, `rgb(${Math.round(cr * 255)},${Math.round(cg * 255)},${Math.round(cb * 255)})`); }
    ctx.fillStyle = g; ctx.fillRect(lx, ly, lw, lh);
    ctx.fillStyle = LABEL; ctx.textAlign = 'left';
    for (const v of [0, 0.5, 1]) ctx.fillText(`${v * 100}`, lx + lw + 4, ly + lh - v * lh);
  }
  ctx.fillStyle = LABEL; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillText(t('scope.surface.hint'), r.x + 4, r.y + r.h - 4);
  ctx.restore();
}
