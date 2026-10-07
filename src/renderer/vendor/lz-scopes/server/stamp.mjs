// Latency stamp (#16): a machine-readable time code in the picture. A test source
// (scripts/latency-source.mjs) writes the wall-clock time and a frame counter as black and
// white blocks into the top rows; the app reads them back and compares with its own clock.
// Plain JS: shared by the Node script, the e2e tests and the browser (frame worker).
//
// Layout: 2 rows × 32 blocks at the top edge, row height = height/24, block width = width/32.
//   row 0: 8-bit sync 0xB4 | 16-bit counter | 8-bit check (XOR of the 6 payload bytes ^ 0x5A)
//   row 1: 32-bit time in ms (Date.now() mod 2^32)
// Bits MSB first, white = 1. Blocks are large enough to survive H.264 at 4:2:0 and
// scaling to 640 px width (20 px per block).

export const STAMP_BLOCKS = 32;
export const STAMP_SYNC = 0xb4;

/** 64 bits (as 0/1) for a time in ms and a frame counter. */
export function stampBits(ms, counter) {
  const t = Math.floor(ms) >>> 0, c = counter & 0xffff;
  const bytes = [(t >>> 24) & 255, (t >>> 16) & 255, (t >>> 8) & 255, t & 255, c >>> 8, c & 255];
  const check = bytes.reduce((a, b) => a ^ b, 0x5a);
  const words = [((STAMP_SYNC << 24) | (c << 8) | check) >>> 0, t];
  const bits = [];
  for (const w of words) for (let i = 31; i >= 0; i--) bits.push((w >>> i) & 1);
  return bits;
}

const geometry = (w, h) => ({ bw: w / STAMP_BLOCKS, bh: Math.max(2, Math.round(h / 24)) });

/** Draw the stamp into an RGBA8 buffer (width × height × 4). */
export function drawStamp(rgba, w, h, ms, counter) {
  const bits = stampBits(ms, counter), { bw, bh } = geometry(w, h);
  for (let row = 0; row < 2; row++) {
    for (let y = row * bh; y < (row + 1) * bh; y++) {
      for (let x = 0; x < w; x++) {
        const v = bits[row * STAMP_BLOCKS + Math.min(STAMP_BLOCKS - 1, Math.floor(x / bw))] ? 255 : 0;
        const i = (y * w + x) * 4;
        rgba[i] = rgba[i + 1] = rgba[i + 2] = v; rgba[i + 3] = 255;
      }
    }
  }
}

/**
 * Read the stamp from RGBA samples (Uint8 or Uint16, `max` = 255 or 65535). Samples the
 * centre of every block (3×3 mean of the green channel). Returns null without a valid stamp.
 */
export function readStamp(px, w, h, max = 255, offset = 0) {
  if (w < STAMP_BLOCKS * 4 || h < 48) return null;
  const { bw, bh } = geometry(w, h);
  const words = [0, 0];
  for (let row = 0; row < 2; row++) {
    let word = 0;
    for (let b = 0; b < STAMP_BLOCKS; b++) {
      const cx = Math.floor((b + 0.5) * bw), cy = Math.floor((row + 0.5) * bh);
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += px[offset + ((cy + dy) * w + cx + dx) * 4 + 1];
      word = (word << 1) | (s / 9 > max / 2 ? 1 : 0);
    }
    words[row] = word >>> 0;
  }
  const [w0, t] = words;
  if (w0 >>> 24 !== STAMP_SYNC) return null;
  const counter = (w0 >>> 8) & 0xffff;
  const bytes = [(t >>> 24) & 255, (t >>> 16) & 255, (t >>> 8) & 255, t & 255, counter >>> 8, counter & 255];
  if ((bytes.reduce((a, b) => a ^ b, 0x5a)) !== (w0 & 255)) return null;
  return { ms: t, counter };
}

/** Age of a stamp in ms against `now` (Date.now()), across the 2^32 wrap. */
export function stampAge(stampMs, now) {
  const d = ((Math.floor(now) >>> 0) - stampMs) >>> 0;
  return d > 0x7fffffff ? d - 0x100000000 : d;
}
