// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
export const STAMP_BLOCKS: number;
export const STAMP_SYNC: number;
export function stampBits(ms: number, counter: number): number[];
export function drawStamp(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, ms: number, counter: number): void;
export function readStamp(px: ArrayLike<number>, w: number, h: number, max?: number, offset?: number): { ms: number; counter: number } | null;
export function stampAge(stampMs: number, now: number): number;
