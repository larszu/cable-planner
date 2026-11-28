// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Teletext (ETSI EN 300 706 / ETS 300 706, "WST") rows as they arrive in SDI ancillary data:
// OP-47 subtitling data packets (RDD 8, DID 43h/SDID 02h) and ST 2031 txt_data_field() (EN 301 775).
// Decodes the packet address (Hamming 8/4), the page header (page number, control bits C4–C14,
// national option) and the 40 odd-parity characters of rows 1–24, and collects the rows of the
// page that is on air per magazine – for subtitles this is the page with the C6 "subtitle" bit.
//
// Sources (opened 24.11.2026):
//   - Hamming 8/4: EN 300 706 §8.2 – bits 1–8 = P1 D1 P2 D2 P3 D3 P4 D4, every test (A: P1 D1 D3 D4,
//     B: D1 P2 D2 D4, C: D1 D2 P3 D3, D: all eight bits) odd. Nibble 0 → 15h, which is also why the
//     OP-47 identifier is 51h 15h.
//   - Page header layout (bytes 2–9 after the address: units, tens, S1, S2+C4, S3, S4+C5+C6, C7–C10,
//     C11–C14) and the Latin G0 national option subsets (C12 C13 C14: 000 English, 001 German):
//     EN 300 706 §9.3.1 and Table 36.
//   - Bit order: teletext bytes go out LSB first. OP-47 keeps that order (ffmpeg
//     libavdevice/decklink_dec.cpp, teletext_data_unit_from_op47_vbi_packet: clock run-in 55h 55h,
//     framing code 27h, then the bytes are bit-reversed for DVB); DVB/ST 2031 carries every byte
//     bit-reversed (EN 300 472 §4.4, framing code E4h) – reverse() undoes that.
// The standards texts of RDD 8 and EN 300 706 were not at hand; layout taken from the
// implementations above and the ETSI tables as quoted there. NOT TESTED WITH A REAL SIGNAL (#116).

/** Reverse the bit order of a byte (DVB/ST 2031 ↔ transmission order). */
export const reverse = (b: number) => {
  let r = 0;
  for (let i = 0; i < 8; i++) r |= ((b >> i) & 1) << (7 - i);
  return r;
};

const bit = (v: number, i: number) => (v >> i) & 1;
/** Hamming 8/4 code word of a nibble (EN 300 706 §8.2). */
export function hamming84Encode(n: number): number {
  const d1 = bit(n, 0), d2 = bit(n, 1), d3 = bit(n, 2), d4 = bit(n, 3);
  const p1 = 1 ^ d1 ^ d3 ^ d4, p2 = 1 ^ d1 ^ d2 ^ d4, p3 = 1 ^ d1 ^ d2 ^ d3;
  const p4 = 1 ^ p1 ^ d1 ^ p2 ^ d2 ^ p3 ^ d3 ^ d4;
  return p1 | d1 << 1 | p2 << 2 | d2 << 3 | p3 << 4 | d3 << 5 | p4 << 6 | d4 << 7;
}
const CODE = Array.from({ length: 16 }, (_, n) => hamming84Encode(n));
const pop = (v: number) => { let c = 0; while (v) { c += v & 1; v >>= 1; } return c; };
/** Decoded nibble, or -1 for a double error. Single bit errors are corrected (distance 1). */
const HAMMING = Array.from({ length: 256 }, (_, b) => {
  for (let n = 0; n < 16; n++) if (pop(CODE[n] ^ b) <= 1) return n;
  return -1;
});
export const hamming84 = (b: number) => HAMMING[b & 0xff];

/** National option subsets of the Latin G0 set (EN 300 706 Table 36): the 13 replaced positions. */
const NATIONAL_POS = [0x23, 0x24, 0x40, 0x5b, 0x5c, 0x5d, 0x5e, 0x5f, 0x60, 0x7b, 0x7c, 0x7d, 0x7e];
const NATIONAL: Record<number, string> = {
  0: '£$@←½→↑#–¼‖¾÷', // English (C12 C13 C14 = 000)
  1: '#$§ÄÖÜ^_°äöüß', // German (001) – lang-ok: teletext character table, not UI text
};

/** One row (40 bytes, odd parity, 7 bit) as text; parity errors become '·' and are counted. */
export function decodeText(bytes: ArrayLike<number>, option = 0): { text: string; parityErrors: number } {
  let text = '', parityErrors = 0;
  const nat = NATIONAL[option] ?? NATIONAL[0];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] & 0xff;
    if (pop(b) % 2 === 0) { parityErrors++; text += '·'; continue; }
    const c = b & 0x7f;
    if (c < 0x20) { text += ' '; continue; } // spacing attributes (colour, boxing, …) show as a space
    const k = NATIONAL_POS.indexOf(c);
    text += k >= 0 ? nat[k] : c === 0x7f ? '■' : String.fromCharCode(c);
  }
  return { text, parityErrors };
}

export interface TeletextPacket {
  magazine: number; // 1–8
  row: number; // 0–31
  /** 40 data bytes after the two address bytes */
  data: number[];
  /** Hamming errors in the address (1 = corrected, 2 = not decodable) */
  hammingError: boolean;
}

/** 42 bytes (address + 40 data bytes) in transmission bit order. */
export function parsePacket(b: ArrayLike<number>): TeletextPacket | null {
  if (b.length < 42) return null;
  const a = hamming84(b[0]), r = hamming84(b[1]);
  if (a < 0 || r < 0) return null;
  const mag = a & 7;
  return { magazine: mag === 0 ? 8 : mag, row: (a >> 3) | (r << 1), data: Array.from({ length: 40 }, (_, i) => b[i + 2] & 0xff), hammingError: false };
}

export interface PageHeader {
  /** page number as on a remote, e.g. "888", or hex digits for non-decimal pages */
  page: string;
  erase: boolean; newsflash: boolean; subtitle: boolean; suppressHeader: boolean;
  /** national option C12 C13 C14 as a number 0–7 (0 English, 1 German) */
  option: number;
  /** header text (bytes 10–41) */
  text: string;
}

/** Page header (row 0) of a packet. */
export function parseHeader(p: TeletextPacket): PageHeader | null {
  if (p.row !== 0) return null;
  const n = p.data.slice(0, 8).map(hamming84);
  if (n.some((v) => v < 0)) return null;
  const units = n[0], tens = n[1];
  const c4 = bit(n[3], 3), c5 = bit(n[5], 2), c6 = bit(n[5], 3);
  const c7 = bit(n[6], 0);
  const c12 = bit(n[7], 1), c13 = bit(n[7], 2), c14 = bit(n[7], 3);
  const option = (c12 << 2) | (c13 << 1) | c14;
  const hex = (v: number) => v.toString(16).toUpperCase();
  return {
    page: `${p.magazine}${hex(tens)}${hex(units)}`,
    erase: !!c4, newsflash: !!c5, subtitle: !!c6, suppressHeader: !!c7, option,
    text: decodeText(p.data.slice(8), option).text,
  };
}

export interface SubtitlePage {
  page: string;
  /** non-empty rows, top to bottom */
  rows: { row: number; text: string }[];
  /** when the page header arrived (ms, caller's clock) */
  at: number;
}

/**
 * Collects rows per magazine: a header starts a page (erase bit = clear), rows 1–24 fill it.
 * `current()` returns the newest subtitle page (C6) or, without one, the newest page.
 */
export class TeletextDecoder {
  private pages = new Map<number, { header: PageHeader; rows: Map<number, string>; at: number }>();
  packets = 0;
  parityErrors = 0;
  hammingErrors = 0;
  /** page numbers seen, with their subtitle flag */
  readonly seen = new Map<string, boolean>();

  push(packet42: ArrayLike<number>, at: number) {
    const p = parsePacket(packet42);
    if (!p) { this.hammingErrors++; return; }
    this.packets++;
    if (p.row === 0) {
      const h = parseHeader(p);
      if (!h) { this.hammingErrors++; return; }
      this.seen.set(h.page, h.subtitle);
      const old = this.pages.get(p.magazine);
      const rows = h.erase || !old || old.header.page !== h.page ? new Map<number, string>() : old.rows;
      this.pages.set(p.magazine, { header: h, rows, at });
      return;
    }
    if (p.row > 24) return; // packets 25–31 carry no displayable text
    const pg = this.pages.get(p.magazine);
    if (!pg) return;
    const d = decodeText(p.data, pg.header.option);
    this.parityErrors += d.parityErrors;
    pg.rows.set(p.row, d.text);
  }

  current(): SubtitlePage | null {
    let best: { header: PageHeader; rows: Map<number, string>; at: number } | null = null;
    for (const pg of this.pages.values()) {
      const better = !best || (pg.header.subtitle && !best.header.subtitle) || (pg.header.subtitle === best.header.subtitle && pg.at > best.at);
      if (better) best = pg;
    }
    if (!best) return null;
    const rows = [...best.rows.entries()].sort((a, b) => a[0] - b[0]).map(([row, text]) => ({ row, text: text.trim() })).filter((r) => r.text);
    return { page: best.header.page, rows, at: best.at };
  }
}
