// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// SDI ancillary data (VANC) from the DeckLink helper (#160): parsers for SMPTE ST 352 payload ID,
// ST 2108-1 HDR/WCG metadata, ST 12-2 ancillary timecode, ST 2016-3 AFD, and presence checks for
// CEA-708 (ST 334-1) and ST 299 audio packets. Packets arrive as the helper reads them: DID, SDID,
// line, data stream and the user data words (lower 8 bits) as hex. Sources: docs/research/vanc.md.
// NOT TESTED WITH HARDWARE (#116) – the fixtures are built from the standards' bit tables.

import type { Transfer } from './color';

export interface VancPacket { did: number; sdid: number; line: number; stream?: number; data: string }

export const bytesOf = (hex: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i + 1 < hex.length; i += 2) { const v = parseInt(hex.slice(i, i + 2), 16); if (Number.isNaN(v)) break; out.push(v); }
  return out;
};
export const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

// ---------------------------------------------------------------- ST 352 payload identifier

/** Byte 1 (ST 352 register, as in ST 352:2013 §5 and the SMPTE RA list). */
const PAYLOAD: Record<number, string> = {
  0x81: '483/576-line 270 Mb/s (ST 259)', 0x82: '483/576-line 360 Mb/s / dual link', 0x83: '483/576-line 540 Mb/s',
  0x84: '720-line 1.5G (ST 292-1)', 0x85: '1080-line 1.5G (ST 292-1)', 0x86: '483/576-line on 1.5G',
  0x87: '1080-line dual link 1.5G (ST 372)', 0x88: '720-line 3G Level A (ST 425-1)', 0x89: '1080-line 3G Level A (ST 425-1)',
  0x8a: '1080-line dual link on 3G Level B (ST 425-1)', 0x8b: '720-line 3G Level B', 0x8c: '1080-line 3G Level B',
  0x94: '1080-line dual 3G Level A', 0x95: '1080-line dual 3G Level B', 0x96: '2160-line dual link', 0x97: '2160-line quad link 3G Level A (ST 425-5)',
  0x98: '2160-line quad link 3G Level B (ST 425-5)', 0xc0: '2160-line 6G (ST 2081-10)', 0xc1: '1080-line 6G (ST 2081-10)',
  0xc2: '1080-line 6G additional rates', 0xce: '2160-line 12G (ST 2082-10)', 0xcf: '1080-line 12G additional rates',
  0xd0: '4320-line dual link 12G (ST 2082-11)', 0xd1: '2160-line dual link 12G (ST 2082-11)', 0xd2: '4320-line quad link 12G (ST 2082-12)',
};
/** Table 2 of ST 352:2013 (0h = none, 1h/Ch–Fh reserved). */
const RATES: Record<number, string> = { 2: '23.98', 3: '24', 4: '47.95', 5: '25', 6: '29.97', 7: '30', 8: '48', 9: '50', 10: '59.94', 11: '60' };
/** Table 3 of ST 352:2013. */
const SAMPLING: Record<number, string> = {
  0: '4:2:2 Y′CbCr', 1: '4:4:4 Y′CbCr', 2: '4:4:4 G′B′R′', 3: '4:2:0', 4: '4:2:2:4 Y′CbCrA', 5: '4:4:4:4 Y′CbCrA', 6: '4:4:4:4 G′B′R′A',
  7: 'ST 2048-2 FS', 8: '4:2:2:4 Y′CbCrD', 9: '4:4:4:4 Y′CbCrD', 10: '4:4:4:4 G′B′R′D', 14: '4:4:4 X′Y′Z′',
};
/** 1.5G-based payloads keep the colorimetry in byte 3 b7 (high) + b4 (low) and the aspect in b5. */
const SPARSE_COLORIMETRY = new Set([0x85, 0x87, 0x8a, 0x96, 0x98]);

export type St352Transfer = 'sdr' | 'hlg' | 'pq' | 'unspecified';
export type St352Colorimetry = '709' | 'reserved' | '2020' | 'unknown';

export interface St352 {
  bytes: number[]; payload: number; standard: string | null;
  progressiveTransport: boolean; progressivePicture: boolean; rate: string | null;
  transfer: St352Transfer; colorimetry: St352Colorimetry; sampling: string | null;
  aspect16x9: boolean; h2048: boolean; ictcp: boolean; bitDepth: 8 | 10 | 12 | null; channel: number;
}

/** Decode the 4 user data words of an ST 352 packet (DID 41h, SDID 01h). */
export function parseSt352(b: number[]): St352 | null {
  if (b.length < 4 || !(b[0] & 0x80)) return null;
  const [p, b2, b3, b4] = b;
  const sparse = SPARSE_COLORIMETRY.has(p);
  const col = sparse ? ((b3 >> 7) & 1) << 1 | ((b3 >> 4) & 1) : (b3 >> 4) & 3;
  const depth = b4 & 3;
  return {
    bytes: b.slice(0, 4), payload: p, standard: PAYLOAD[p] ?? null,
    progressiveTransport: !!(b2 & 0x80), progressivePicture: !!(b2 & 0x40), rate: RATES[b2 & 0x0f] ?? null,
    // b5–b4 of byte 2: transfer characteristics (ST 425-1:2017, ST 2081-10, ST 2082-10)
    transfer: (['sdr', 'hlg', 'pq', 'unspecified'] as const)[(b2 >> 4) & 3],
    colorimetry: (['709', 'reserved', '2020', 'unknown'] as const)[col],
    sampling: SAMPLING[b3 & 0x0f] ?? null,
    aspect16x9: !!(b3 & (sparse ? 0x20 : 0x80)), h2048: !!(b3 & 0x40),
    ictcp: !!(b4 & 0x10),
    // 3 = 12 bit full range on 6G/12G, 10 bit full range on 1.5G
    bitDepth: depth === 1 ? 10 : depth === 2 ? 12 : depth === 3 ? (p >= 0xc0 ? 12 : 10) : p >= 0xc0 ? 10 : 8,
    channel: (b4 >> 6) & 3,
  };
}

// ---------------------------------------------------------------- ST 12-2 ancillary timecode

export interface Atc { tc: string; dropFrame: boolean; colourFrame: boolean; kind: 'ltc' | 'vitc1' | 'vitc2' | string; userBits: string }

/**
 * ST 12-2 ATC (DID 60h, SDID 60h): 16 UDW, b7–b4 carry one nibble of the 64 ST 12-1 time code bits
 * (UDW1 = bits 0–3 …), b3 carries the distributed binary bits (DBB1 in UDW1–8 = payload type).
 */
export function parseAtc(b: number[]): Atc | null {
  if (b.length < 16) return null;
  const n = (i: number) => (b[i] >> 4) & 0x0f;
  const fu = n(0), ft = n(2) & 3, df = !!(n(2) & 4), cf = !!(n(2) & 8);
  const su = n(4), st = n(6) & 7, mu = n(8), mt = n(10) & 7, hu = n(12), ht = n(14) & 3;
  if ([fu, su, mu, hu].some((d) => d > 9)) return null;
  let dbb1 = 0;
  for (let i = 0; i < 8; i++) dbb1 |= ((b[i] >> 3) & 1) << i;
  const kind = dbb1 === 0 ? 'ltc' : dbb1 === 1 ? 'vitc1' : dbb1 === 2 ? 'vitc2' : `0x${hex2(dbb1)}`;
  const d2 = (t: number, u: number) => `${t}${u}`;
  const ub = [1, 3, 5, 7, 9, 11, 13, 15].map((i) => n(i).toString(16).toUpperCase()).reverse().join('');
  return { tc: `${d2(ht, hu)}:${d2(mt, mu)}:${d2(st, su)}${df ? ';' : ':'}${d2(ft, fu)}`, dropFrame: df, colourFrame: cf, kind, userBits: ub };
}

// ---------------------------------------------------------------- ST 2108-1 HDR/WCG metadata

export interface Hdr2108 {
  frames: { type: number; length: number }[];
  /** Static type 1: mastering display colour volume (H.265 SEI 137) */
  mdcv?: { primaries: [number, number][]; white: [number, number]; maxNits: number; minNits: number };
  /** Static type 2: content light level (H.265 SEI 144) */
  cll?: { maxCll: number; maxFall: number };
  dynamic: number[];
}

/** ST 2108-1 (DID 41h, SDID 0Ch): frames of type, length, data. */
export function parse2108(b: number[]): Hdr2108 | null {
  const out: Hdr2108 = { frames: [], dynamic: [] };
  let i = 0;
  const u16 = (k: number) => (b[k] << 8) | b[k + 1];
  const u32 = (k: number) => ((b[k] << 24) >>> 0) + (b[k + 1] << 16) + (b[k + 2] << 8) + b[k + 3];
  while (i + 2 <= b.length) {
    const type = b[i], len = b[i + 1], d = i + 2;
    if (d + len > b.length) break;
    out.frames.push({ type, length: len });
    if (type === 0x00 && len >= 26 && b[d] === 137) {
      const m = d + 2; // after SEI payloadType and payloadSize
      // H.265 order G, B, R; 0.00002 units; luminance in 0.0001 cd/m²
      const pr = [0, 1, 2].map((k) => [u16(m + k * 4) * 0.00002, u16(m + k * 4 + 2) * 0.00002] as [number, number]);
      out.mdcv = { primaries: [pr[2], pr[0], pr[1]], white: [u16(m + 12) * 0.00002, u16(m + 14) * 0.00002], maxNits: u32(m + 16) / 10000, minNits: u32(m + 20) / 10000 };
    } else if (type === 0x01 && len >= 6 && b[d] === 144) {
      out.cll = { maxCll: u16(d + 2), maxFall: u16(d + 4) };
    } else if (type >= 0x02) out.dynamic.push(type - 1);
    i = d + len;
  }
  return out.frames.length ? out : null;
}

// ---------------------------------------------------------------- ST 2016-3 AFD

/** ST 2016-3 (DID 41h, SDID 05h): AFD code in UDW1 b6–b3, coded-frame aspect in b2. */
export function parseAfd(b: number[]): { afd: number; frame16x9: boolean } | null {
  if (!b.length) return null;
  return { afd: (b[0] >> 3) & 0x0f, frame16x9: !!(b[0] & 0x04) };
}

// ---------------------------------------------------------------- packet names, summary

/** ST 299-1 / ST 299-2 HD audio: data packets E7h–E4h (groups 1–4), A7h–A4h (5–8); control E3h–E0h, A3h–A0h. */
export function audioGroup(did: number): { group: number; control: boolean } | null {
  if (did >= 0xe0 && did <= 0xe7) return { group: 4 - (did & 3), control: did < 0xe4 };
  if (did >= 0xa0 && did <= 0xa7) return { group: 8 - (did & 3), control: did < 0xa4 };
  return null;
}

/** Name of a packet type (ST 291 register, the types this panel knows), null if unknown. */
export function packetName(did: number, sdid: number): string | null {
  if (did === 0x41 && sdid === 0x01) return 'ST 352 payload ID';
  if (did === 0x41 && sdid === 0x05) return 'ST 2016-3 AFD/bar data';
  if (did === 0x41 && sdid === 0x0c) return 'ST 2108-1 HDR/WCG';
  if (did === 0x60 && sdid === 0x60) return 'ST 12-2 ATC';
  if (did === 0x61 && sdid === 0x01) return 'CEA-708 (ST 334-1)';
  if (did === 0x61 && sdid === 0x02) return 'CEA-608 (ST 334-1)';
  const a = audioGroup(did);
  if (a) return `ST 299 audio ${a.control ? 'control' : 'data'} group ${a.group}`;
  return null;
}

export interface VancSummary {
  st352: St352 | null; atc: Atc[]; hdr: Hdr2108 | null; afd: { afd: number; frame16x9: boolean } | null;
  cea708: boolean; cea608: boolean; audioGroups: number[]; audioControl: number[];
  packets: (VancPacket & { name: string | null; count: number })[];
}

/** Decode everything the panel shows from one VANC record. */
export function summarise(packets: VancPacket[]): VancSummary {
  const s: VancSummary = { st352: null, atc: [], hdr: null, afd: null, cea708: false, cea608: false, audioGroups: [], audioControl: [], packets: [] };
  const seen = new Map<string, VancPacket & { name: string | null; count: number }>();
  for (const p of packets) {
    const b = bytesOf(p.data ?? '');
    const key = `${p.did}/${p.sdid}/${p.line}/${p.stream ?? 0}`;
    const known = seen.get(key);
    if (known) known.count++;
    else seen.set(key, { ...p, name: packetName(p.did, p.sdid), count: 1 });
    if (p.did === 0x41 && p.sdid === 0x01) s.st352 ??= parseSt352(b);
    else if (p.did === 0x41 && p.sdid === 0x0c) s.hdr ??= parse2108(b);
    else if (p.did === 0x41 && p.sdid === 0x05) s.afd ??= parseAfd(b);
    else if (p.did === 0x60 && p.sdid === 0x60) { const a = parseAtc(b); if (a && !s.atc.some((x) => x.kind === a.kind)) s.atc.push(a); }
    else if (p.did === 0x61 && p.sdid === 0x01) s.cea708 = true;
    else if (p.did === 0x61 && p.sdid === 0x02) s.cea608 = true;
    else {
      const a = audioGroup(p.did);
      if (a) { const l = a.control ? s.audioControl : s.audioGroups; if (!l.includes(a.group)) l.push(a.group); }
    }
  }
  s.audioGroups.sort(); s.audioControl.sort();
  s.packets = [...seen.values()].sort((a, b) => a.line - b.line || a.did - b.did || a.sdid - b.sdid);
  return s;
}

/**
 * Transfer the scopes should use for a signalled ST 352 transfer, or null when the two agree
 * (or the signal says nothing). SDR accepts every gamma/log reading – only PQ/HLG are checked.
 */
export function transferMismatch(signal: St352Transfer | undefined, scope: Transfer): 'pq' | 'hlg' | 'sdr' | null {
  if (signal === 'pq' && scope !== 'pq') return 'pq';
  if (signal === 'hlg' && scope !== 'hlg') return 'hlg';
  if (signal === 'sdr' && (scope === 'pq' || scope === 'hlg')) return 'sdr';
  return null;
}

/** Colorimetry mismatch: the signal flags Rec.2020 but the scopes decode Rec.709, or the reverse. */
export function colorimetryMismatch(signal: St352Colorimetry | undefined, scope: string): '2020' | '709' | null {
  if (signal === '2020' && scope !== '2020') return '2020';
  if (signal === '709' && scope === '2020') return '709';
  return null;
}
