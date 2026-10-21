// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
/** Picture panel: draggable A/B split line and overlay legend (pure geometry). */
export interface Box { x: number; y: number; w: number; h: number }

/** Split position 0…1; the former 'wipe' mode is the same split with a moved line. */
export function splitPos(ab: { mode: string; pos?: number }): number {
  return Math.max(0, Math.min(1, ab.pos ?? 0.5));
}

/** True when a pointer x (panel coordinates) grabs the split line. */
export function nearSplit(x: number, frame: Box, pos: number, tol = 8): boolean {
  return Math.abs(x - (frame.x + frame.w * pos)) <= tol;
}

/** Split position for a pointer x, clamped to the frame. */
export function splitAt(x: number, frame: Box): number {
  return frame.w > 0 ? Math.max(0, Math.min(1, (x - frame.x) / frame.w)) : 0.5;
}

/**
 * Legend box inside the frame. `pos` = top-left as a fraction of the free space
 * (0,0 = top-left, 1,1 = bottom-right); default bottom-left.
 */
export function legendBox(frame: Box, w: number, h: number, pos?: { x: number; y: number }): Box {
  const m = 4, fx = Math.max(0, frame.w - w - 2 * m), fy = Math.max(0, frame.h - h - 2 * m);
  const px = Math.max(0, Math.min(1, pos?.x ?? 0)), py = Math.max(0, Math.min(1, pos?.y ?? 1));
  return { x: frame.x + m + fx * px, y: frame.y + m + fy * py, w, h };
}

/** Inverse of legendBox: fractional position for a box whose top-left lands at (x, y). */
export function legendPosAt(frame: Box, w: number, h: number, x: number, y: number): { x: number; y: number } {
  const m = 4, fx = frame.w - w - 2 * m, fy = frame.h - h - 2 * m;
  const c = (v: number) => Math.max(0, Math.min(1, v));
  return { x: fx > 0 ? c((x - frame.x - m) / fx) : 0, y: fy > 0 ? c((y - frame.y - m) / fy) : 1 };
}

export const inBox = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
