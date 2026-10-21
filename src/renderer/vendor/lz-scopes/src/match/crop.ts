// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Crop comparison and butterfly split of the picture A/B (#140 step 3, #149): the measuring
// frame (or first face) of A and of B, each scaled into the panel – side by side, or as a
// butterfly where B is mirrored and both halves meet in the middle. Pure geometry
// (test/crop.test.ts); the drawing reuses Renderer.drawPicture with a picture rect and a clip.

export interface Box { x: number; y: number; w: number; h: number }
/** Region as fractions of the picture: x0, y0, x1, y1. */
export type Frac4 = [number, number, number, number];

/** Largest box of aspect `aspect` (w/h) centred in `b`. */
export function fitBox(b: Box, aspect: number): Box {
  const w = Math.min(b.w, b.h * aspect), h = w / aspect;
  return { x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
}

/**
 * Where the whole picture must lie so that region `r` fills `target` exactly; with `mirror`
 * the picture is drawn flipped left/right, so the region's mirrored position is used.
 */
export function regionRect(target: Box, r: Frac4, mirror = false): Box {
  const w = target.w / (r[2] - r[0]), h = target.h / (r[3] - r[1]);
  const x0 = mirror ? 1 - r[2] : r[0];
  return { x: target.x - x0 * w, y: target.y - r[1] * h, w, h };
}

/** Region of a source as fractions: the first active region (face or measuring frame), else the whole picture. */
export function regionOf(rois: readonly (readonly number[])[], width: number, height: number): Frac4 {
  const r = rois[0];
  if (!r || !width || !height || r[2] <= r[0] || r[3] <= r[1]) return [0, 0, 1, 1];
  return [r[0] / width, r[1] / height, r[2] / width, r[3] / height];
}

export interface CropPlan { a: { rect: Box; clip: Box; mirror: false }; b: { rect: Box; clip: Box; mirror: boolean }; divider: number }

/**
 * `crop`: A's region in the left half, B's region in the right half, each fitted to its aspect.
 * `butterfly`: one box with A's region aspect; left half A, right half B mirrored.
 */
export function cropPlan(mode: 'crop' | 'butterfly', box: Box, ra: Frac4, aPx: [number, number], rb: Frac4, bPx: [number, number]): CropPlan {
  const asp = (r: Frac4, px: [number, number]) => ((r[2] - r[0]) * px[0]) / ((r[3] - r[1]) * px[1]);
  if (mode === 'crop') {
    const half = box.w / 2;
    const ta = fitBox({ ...box, w: half }, asp(ra, aPx)), tb = fitBox({ ...box, x: box.x + half, w: half }, asp(rb, bPx));
    return { a: { rect: regionRect(ta, ra), clip: ta, mirror: false }, b: { rect: regionRect(tb, rb), clip: tb, mirror: false }, divider: box.x + half };
  }
  // B's region keeps its height and centre and takes A's aspect, so B is not stretched
  const t = fitBox(box, asp(ra, aPx)), mid = t.x + t.w / 2;
  const bw = ((rb[3] - rb[1]) * bPx[1] * asp(ra, aPx)) / bPx[0], bc = (rb[0] + rb[2]) / 2;
  const rb2: Frac4 = [bc - bw / 2, rb[1], bc + bw / 2, rb[3]];
  return {
    a: { rect: regionRect(t, ra), clip: { ...t, w: t.w / 2 }, mirror: false },
    b: { rect: regionRect(t, rb2, true), clip: { ...t, x: mid, w: t.w / 2 }, mirror: true },
    divider: mid,
  };
}
