// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// ACES 1.3 Reference Gamut Compression (RGC) as a preview in the picture panel (issue #8).
// Parameters and math from alwan (github.com/soufianekhiat/alwan @ 8fc3044, MIT, © 2025
// Soufiane KHIAT): src/alwan/api/alwan_aces_ff.c l. 426–434 (defaults) and 470–484 (per
// channel, achromatic = max(R, G, B)), src/alwan/core/alwan_aces_ff_core.inc l. 216–282
// (compress_dist, gamut_comp_channel, calc_gamut_comp_scale); there referenced to OCIO
// FixedFunctionOpCPU ACES_GamutComp13_Fwd. Ported to TypeScript/GLSL. The RGC works on
// ACEScg (AP1, linear); the picture shader converts source linear → AP1, compresses and
// converts back, so display, HDR→SDR preview and gamut warning all see the compressed values.

export const RGC = { limC: 1.147, limM: 1.264, limY: 1.312, thrC: 0.815, thrM: 0.803, thrY: 0.88, power: 1.2 };

/** Scale so that the compression curve passes through (lim, 1). */
export function rgcScale(lim: number, thr: number, p: number) {
  return (lim - thr) / Math.pow(Math.pow((1 - thr) / (lim - thr), -p) - 1, 1 / p);
}

export function rgcCompressDist(d: number, thr: number, scale: number, p: number) {
  if (d < thr) return d;
  const nd = (d - thr) / scale;
  return thr + (scale * nd) / Math.pow(1 + Math.pow(nd, p), 1 / p);
}

/** RGC of one AP1-linear pixel. */
export function rgc(rgb: number[]): number[] {
  const ach = Math.max(rgb[0], rgb[1], rgb[2]);
  if (ach === 0) return [0, 0, 0];
  const lims = [RGC.limC, RGC.limM, RGC.limY], thrs = [RGC.thrC, RGC.thrM, RGC.thrY];
  return rgb.map((v, i) => {
    const d = (ach - v) / Math.abs(ach);
    return ach - rgcCompressDist(d, thrs[i], rgcScale(lims[i], thrs[i], RGC.power), RGC.power) * Math.abs(ach);
  });
}

export const RGC_GLSL = `
uniform int uRgc; uniform mat3 uToAp1, uFromAp1; uniform vec3 uRgcThr, uRgcScale; uniform float uRgcPow;
float rgcDist(float d, float thr, float s) {
  if (d < thr) return d;
  float nd = (d - thr) / s;
  return thr + s * nd / pow(1.0 + pow(nd, uRgcPow), 1.0 / uRgcPow);
}
vec3 rgcAp1(vec3 c) {
  float ach = max(c.r, max(c.g, c.b));
  if (ach == 0.0) return vec3(0.0);
  vec3 d = (ach - c) / abs(ach);
  return ach - vec3(rgcDist(d.r, uRgcThr.r, uRgcScale.r), rgcDist(d.g, uRgcThr.g, uRgcScale.g), rgcDist(d.b, uRgcThr.b, uRgcScale.b)) * abs(ach);
}
/** Source linear → RGC in AP1 → source linear (identity when off). */
vec3 rgcLin(vec3 l) { return uRgc == 1 ? uFromAp1 * rgcAp1(uToAp1 * l) : l; }`;
