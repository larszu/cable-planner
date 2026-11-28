// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Further SDI ancillary packets (#235), next to the ones in src/vanc.ts: SCTE 104 (ST 2010),
// CEA-708 caption distribution packet (CDP, ST 334-2), OP-47 subtitling data packet (RDD 8),
// ST 2031 DVB VBI data, EDH (RP 165). Input: the user data words (lower 8 bits) as the DeckLink
// helper delivers them. Sources per parser below and in docs/research/vanc.md.
// NOT TESTED WITH A REAL SIGNAL (#116) – fixtures are built from the layouts cited.

import { parsePacket, reverse, type TeletextPacket } from './teletext';

// ---------------------------------------------------------------- SCTE 104 (DID 41h, SDID 07h)
//
// ST 2010 wraps one SCTE 104 message per packet behind a payload descriptor byte
// (b4–b3 version, b2 continued_pkt, b1 following_pkt, b0 duplicate_msg; 08h = version 1,
// complete). Message layouts after ANSI/SCTE 104 §7–§9 as implemented in libklvanc
// (src/core-packet-scte_104.c, github.com/stoth68000/libklvanc, read 25.11.2026):
//   single_operation_message: opID(2) messageSize(2) result(2) result_extension(2)
//     protocol_version(1) AS_index(1) message_number(1) DPI_PID_index(2) data…
//   multiple_operation_message: reserved FFFFh(2) messageSize(2) protocol_version(1) AS_index(1)
//     message_number(1) DPI_PID_index(2) SCTE35_protocol_version(1) timestamp() num_ops(1)
//     { opID(2) data_length(2) data } × num_ops
//   timestamp(): time_type(1), then 0: –, 1: UTC s(4) µs(2), 2: VITC h m s f, 3: GPI number, edge
//   splice_request_data (0101h): splice_insert_type(1) splice_event_id(4) unique_program_id(2)
//     pre_roll_time(2, ms) break_duration(2, 1/10 s) avail_num(1) avails_expected(1) auto_return(1)
//   time_signal_request_data (0104h): pre_roll_time(2)
//   insert_segmentation_descriptor_request_data (010Bh): event_id(4) cancel(1) duration(2, s)
//     upid_type(1) upid_length(1) upid type_id(1) segment_num(1) segments_expected(1) …

const OP_NAMES: Record<number, string> = {
  0x0100: 'inject_section_data', 0x0101: 'splice_request', 0x0102: 'splice_null', 0x0104: 'time_signal',
  0x0108: 'insert_descriptor', 0x0109: 'insert_DTMF_descriptor', 0x010a: 'insert_avail_descriptor',
  0x010b: 'insert_segmentation_descriptor', 0x010c: 'proprietary_command', 0x010f: 'insert_tier', 0x0110: 'insert_time_descriptor',
};
/** SCTE 104 Table 8-6 splice_insert_type. */
const SPLICE_TYPES: Record<number, string> = { 1: 'start normal', 2: 'start immediate', 3: 'end normal', 4: 'end immediate', 5: 'cancel' };

export interface Scte104Op {
  opId: number; name: string;
  splice?: { type: number; typeName: string; eventId: number; programId: number; preRollMs: number; breakTenths: number; autoReturn: boolean };
  preRollMs?: number;
  segmentation?: { eventId: number; cancel: boolean; durationS: number; typeId: number; segmentNum: number; segmentsExpected: number };
}
export interface Scte104 {
  descriptor: number; continued: boolean; following: boolean; duplicate: boolean;
  multiple: boolean; messageNumber: number; asIndex: number;
  timestamp: string | null;
  ops: Scte104Op[];
  /** the message is longer than the packet (continued in the next one) or cut short */
  truncated: boolean;
}

const u16 = (b: number[], i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32 = (b: number[], i: number) => (((b[i] ?? 0) << 24) >>> 0) + ((b[i + 1] ?? 0) << 16) + ((b[i + 2] ?? 0) << 8) + (b[i + 3] ?? 0);
const pad2 = (n: number) => String(n).padStart(2, '0');

function scteOp(opId: number, d: number[]): Scte104Op {
  const op: Scte104Op = { opId, name: OP_NAMES[opId] ?? (opId >= 0xc000 ? 'user defined' : `0x${opId.toString(16).padStart(4, '0')}`) };
  if (opId === 0x0101 && d.length >= 14) {
    op.splice = { type: d[0], typeName: SPLICE_TYPES[d[0]] ?? `type ${d[0]}`, eventId: u32(d, 1), programId: u16(d, 5), preRollMs: u16(d, 7), breakTenths: u16(d, 9), autoReturn: !!d[13] };
  } else if (opId === 0x0104 && d.length >= 2) op.preRollMs = u16(d, 0);
  else if (opId === 0x010b && d.length >= 9) {
    const ul = d[8], k = 9 + ul;
    op.segmentation = { eventId: u32(d, 0), cancel: !!d[4], durationS: u16(d, 5), typeId: d[k] ?? 0, segmentNum: d[k + 1] ?? 0, segmentsExpected: d[k + 2] ?? 0 };
  }
  return op;
}

/** One ST 2010 packet (UDW incl. the payload descriptor byte). */
export function parseScte104(b: number[]): Scte104 | null {
  if (b.length < 3) return null;
  const pd = b[0], m = b.slice(1);
  const out: Scte104 = {
    descriptor: pd, continued: !!(pd & 4), following: !!(pd & 2), duplicate: !!(pd & 1),
    multiple: u16(m, 0) === 0xffff, messageNumber: 0, asIndex: 0, timestamp: null, ops: [], truncated: false,
  };
  if (out.continued) { out.truncated = true; return out; } // a continuation carries no header
  if (!out.multiple) {
    if (m.length < 13) { out.truncated = true; return out; }
    out.asIndex = m[9]; out.messageNumber = m[10];
    const size = u16(m, 2);
    out.truncated = size > m.length;
    out.ops.push(scteOp(u16(m, 0), m.slice(13, size)));
    return out;
  }
  if (m.length < 11) { out.truncated = true; return out; }
  out.asIndex = m[5]; out.messageNumber = m[6];
  out.truncated = u16(m, 2) > m.length;
  let p = 10;
  const tt = m[p++];
  if (tt === 1) { out.timestamp = `UTC ${u32(m, p)}.${String(u16(m, p + 4)).padStart(6, '0')} s`; p += 6; }
  else if (tt === 2) { out.timestamp = `VITC ${pad2(m[p])}:${pad2(m[p + 1])}:${pad2(m[p + 2])}:${pad2(m[p + 3])}`; p += 4; }
  else if (tt === 3) { out.timestamp = `GPI ${m[p]} ${m[p + 1] ? 'rising' : 'falling'}`; p += 2; }
  const n = m[p++] ?? 0;
  for (let i = 0; i < n; i++) {
    if (p + 4 > m.length) { out.truncated = true; break; }
    const id = u16(m, p), len = u16(m, p + 2);
    if (p + 4 + len > m.length) { out.truncated = true; break; }
    out.ops.push(scteOp(id, m.slice(p + 4, p + 4 + len)));
    p += 4 + len;
  }
  return out;
}

// ---------------------------------------------------------------- CEA-708 CDP (DID 61h, SDID 01h)
//
// CTA-708 §11.2 caption distribution packet as parsed by libklvanc (src/core-packet-eia_708b.c):
// cdp_identifier 9669h, cdp_length, frame_rate(4)+reserved(4), flags (time_code, ccdata,
// svcinfo, svc_info_start/change/complete, caption_service_active), sequence counter(2), then
// sections 71h time code, 72h cc_data (marker(3) cc_count(5), cc_count × {marker(5) valid(1)
// type(2) data1 data2}), 73h service info, 74h footer (sequence counter, checksum).
// cc_type: 0 = 608 field 1, 1 = 608 field 2, 2 = DTVCC data, 3 = DTVCC start.

/** CTA-708 Table 3 cdp_frame_rate. */
const CDP_RATES: Record<number, string> = { 1: '23.976', 2: '24', 3: '25', 4: '29.97', 5: '30', 6: '50', 7: '59.94', 8: '60' };

export interface Cdp {
  identifierOk: boolean; length: number; rate: string | null;
  timecode: string | null; ccdata: boolean; serviceActive: boolean; sequence: number;
  /** valid triplets per cc_type */
  field1: [number, number][]; field2: [number, number][]; dtvcc: number;
  ccCount: number; checksumOk: boolean | null;
}

export function parseCdp(b: number[]): Cdp | null {
  if (b.length < 7) return null;
  const flags = b[4];
  const out: Cdp = {
    identifierOk: u16(b, 0) === 0x9669, length: b[2], rate: CDP_RATES[b[3] >> 4] ?? null,
    timecode: null, ccdata: !!(flags & 0x40), serviceActive: !!(flags & 0x02), sequence: u16(b, 5),
    field1: [], field2: [], dtvcc: 0, ccCount: 0, checksumOk: null,
  };
  let p = 7;
  if (b[p] === 0x71 && p + 5 <= b.length) {
    const h = ((b[p + 1] >> 4) & 3) * 10 + (b[p + 1] & 15), mi = ((b[p + 2] >> 4) & 7) * 10 + (b[p + 2] & 15);
    const s = ((b[p + 3] >> 4) & 7) * 10 + (b[p + 3] & 15), f = ((b[p + 4] >> 4) & 3) * 10 + (b[p + 4] & 15);
    out.timecode = `${pad2(h)}:${pad2(mi)}:${pad2(s)}${b[p + 4] & 0x80 ? ';' : ':'}${pad2(f)}`;
    p += 5;
  }
  if (b[p] === 0x72 && p + 2 <= b.length) {
    const n = b[p + 1] & 0x1f;
    out.ccCount = n;
    p += 2;
    for (let i = 0; i < n && p + 3 <= b.length; i++, p += 3) {
      const valid = !!(b[p] & 4), type = b[p] & 3;
      if (!valid) continue;
      if (type === 0) out.field1.push([b[p + 1], b[p + 2]]);
      else if (type === 1) out.field2.push([b[p + 1], b[p + 2]]);
      else out.dtvcc++;
    }
  }
  // checksum: all bytes of the packet sum to 0 modulo 256 (CTA-708 §11.2.6)
  if (out.length && out.length <= b.length) {
    let sum = 0;
    for (let i = 0; i < out.length; i++) sum += b[i];
    out.checksumOk = (sum & 0xff) === 0;
  }
  return out;
}

/**
 * Hints that the 608 fields are swapped: CEA-608 §8.x miscellaneous control codes use the first
 * byte 14h/1Ch (CC1/CC2) in field 1 and 15h/1Dh (CC3/CC4) in field 2. Control codes of the
 * other field's channels point to swapped fields (or a wrongly flagged cc_type).
 * Returns the number of such codes in field 1 and field 2 data. Bytes carry odd parity (b7).
 */
export function fieldSwapHints(field1: [number, number][], field2: [number, number][]): { inField1: number; inField2: number } {
  const ctl = (pairs: [number, number][], firsts: number[]) =>
    pairs.filter(([a, b]) => firsts.includes(a & 0x7f) && (b & 0x7f) >= 0x20 && (b & 0x7f) <= 0x2f).length;
  return { inField1: ctl(field1, [0x15, 0x1d]), inField2: ctl(field2, [0x14, 0x1c]) };
}

// ---------------------------------------------------------------- OP-47 SDP (DID 43h, SDID 02h)
//
// Free TV Australia OP-47 / SMPTE RDD 8 subtitling distribution packet as in libklvanc
// (src/core-packet-sdp.c) and ffmpeg (libavdevice/decklink_dec.cpp): identifier 51h 15h,
// length, format code (02h = WST teletext), 5 structure descriptors (b7 field, b4–b0 line,
// 00h = unused), then 45 bytes per used descriptor (clock run-in 55h 55h, framing code 27h,
// 42 teletext bytes in transmission order), footer 74h, sequence counter(2), checksum
// (all bytes sum to 0 modulo 256).

export interface Op47 {
  identifierOk: boolean; format: number; sequence: number; checksumOk: boolean;
  lines: { line: number; field: 1 | 2; packet: TeletextPacket | null; raw: number[]; runInOk: boolean }[];
}

export function parseOp47(b: number[]): Op47 | null {
  if (b.length < 9) return null;
  const length = Math.min(b[2], b.length);
  const out: Op47 = { identifierOk: b[0] === 0x51 && b[1] === 0x15, format: b[3], sequence: 0, checksumOk: false, lines: [] };
  let p = 9;
  for (let i = 0; i < 5; i++) {
    const d = b[4 + i];
    if (!d) continue;
    if (p + 45 > b.length) break;
    const blk = b.slice(p, p + 45), raw = blk.slice(3);
    out.lines.push({ line: d & 0x1f, field: d & 0x80 ? 1 : 2, packet: parsePacket(raw), raw, runInOk: blk[0] === 0x55 && blk[1] === 0x55 && blk[2] === 0x27 });
    p += 45;
  }
  if (b[p] === 0x74) out.sequence = u16(b, p + 1);
  let sum = 0;
  for (let i = 0; i < length; i++) sum += b[i];
  out.checksumOk = length > 0 && (sum & 0xff) === 0;
  return out;
}

// ---------------------------------------------------------------- ST 2031 (DID 41h, SDID 08h)
//
// SMPTE ST 2031:2015 §5–6 (drastic.tv copy): UDW = data_identifier, data_unit_id,
// data_unit_length, data_field() of EN 301 775 / SCTE 127, one data_field per packet.
// data_unit_id (Table 2): 02h teletext, 03h teletext subtitles, C0h inverted teletext, C3h VPS,
// C4h WSS, C5h CEA-608, D0h/D1h AMOL, D5h NABTS, D6h TVG2X, D7h copy protection, D9h VITC.
// txt_data_field (EN 300 472 §4.4): reserved(2) field_parity(1) line_offset(5),
// framing_code E4h, then 42 bytes – every byte bit-reversed against transmission order.

const DATA_UNITS: Record<number, string> = {
  0x02: 'EBU teletext', 0x03: 'EBU teletext subtitles', 0xc0: 'inverted teletext', 0xc3: 'VPS', 0xc4: 'WSS', 0xc5: 'CEA-608',
  0xd0: 'AMOL48', 0xd1: 'AMOL96', 0xd5: 'NABTS', 0xd6: 'TVG2X', 0xd7: 'copy protection', 0xd9: 'VITC',
};

export interface St2031 {
  dataIdentifier: number; unitId: number; unitName: string; length: number;
  /** field 1/2 and line offset of the data_field */
  field: 1 | 2; lineOffset: number;
  teletext: TeletextPacket | null; raw42: number[] | null;
}

export function parseSt2031(b: number[]): St2031 | null {
  if (b.length < 4) return null;
  const id = b[1], df = b.slice(3, 3 + b[2]);
  const out: St2031 = {
    dataIdentifier: b[0], unitId: id, unitName: DATA_UNITS[id] ?? `0x${id.toString(16).padStart(2, '0')}`, length: b[2],
    field: df[0] & 0x20 ? 1 : 2, lineOffset: (df[0] ?? 0) & 0x1f, teletext: null, raw42: null,
  };
  if ((id === 0x02 || id === 0x03 || id === 0xc0) && df.length >= 44 && df[1] === 0xe4) {
    const raw = df.slice(2, 44).map(reverse);
    out.raw42 = raw;
    out.teletext = parsePacket(raw);
  }
  return out;
}

// ---------------------------------------------------------------- EDH (DID F4h, SD only)
//
// SMPTE RP 165 error detection and handling packet, 16 UDW: 1–3 active picture CRC, 4–6 full
// field CRC (6 bits each in b7–b2, word 3/6 b5–b2 = C15–C12, b7 = valid), 7 ancillary flags,
// 8 full field flags, 9 active picture flags (b2 EDH, b3 EDA, b4 IDH, b5 IDA, b6 UES),
// 10–16 reserved. Layout from secondary sources (Tektronix/AJA documentation), the RP text
// was not at hand. The CRCs themselves cannot be checked here – that needs the picture samples.

export interface EdhFlags { edh: boolean; eda: boolean; idh: boolean; ida: boolean; ues: boolean }
export interface Edh { apCrc: number; apValid: boolean; ffCrc: number; ffValid: boolean; anc: EdhFlags; ff: EdhFlags; ap: EdhFlags }

const edhFlags = (w: number): EdhFlags => ({ edh: !!(w & 4), eda: !!(w & 8), idh: !!(w & 16), ida: !!(w & 32), ues: !!(w & 64) });
const crc = (b: number[], i: number) => ((b[i] >> 2) & 63) | (((b[i + 1] >> 2) & 63) << 6) | (((b[i + 2] >> 2) & 15) << 12);

export function parseEdh(b: number[]): Edh | null {
  if (b.length < 9) return null;
  return { apCrc: crc(b, 0), apValid: !!(b[2] & 0x80), ffCrc: crc(b, 3), ffValid: !!(b[5] & 0x80), anc: edhFlags(b[6]), ff: edhFlags(b[7]), ap: edhFlags(b[8]) };
}

/** Any error flag set in an EDH packet (EDH/EDA = detected here/upstream, IDH/IDA = internal, UES = unknown). */
export const edhErrors = (e: Edh) => [e.anc, e.ff, e.ap].some((f) => f.edh || f.eda || f.idh || f.ida || f.ues);
