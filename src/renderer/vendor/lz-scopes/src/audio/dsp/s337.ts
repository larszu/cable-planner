// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Non-PCM data in PCM channel pairs (#234): SMPTE ST 337 burst detection with the data type of
// ST 338, and the bit stream information of AC-3 / E-AC-3 frames carried that way.
//
// ST 337 (sources: SMPTE ST 337:2015 as summarised in ffmpeg libavformat/s337m.c and the
// Dolby "Guide to Dolby E metadata" / SMPTE 337M notes; the standards texts were not at hand):
//   a burst starts with the preambles Pa in subframe 1 (first channel of the pair) and Pb in
//   subframe 2, then Pc and Pd in the next sample frame.
//   16-bit mode: Pa F872h, Pb 4E1Fh · 20-bit: 6F872h, 54E1Fh · 24-bit: 96F872h, A54E1Fh,
//   left-justified in the 24-bit sample word.
//   Pc: b4–b0 data_type, b6–b5 data_mode (0 = 16, 1 = 20, 2 = 24 bit), b7 error flag,
//   b12–b8 data-type dependent, b15–b13 data_stream_number – in 20/24-bit mode in the upper 16
//   bits of the word; Pd: burst payload length in bits.
// Data types (ST 338): 0 null, 1 AC-3, 3 pause, 4 MPEG-1 layer 1, 5 MPEG-1 layer 2/3 or MPEG-2
//   without extension, 6 MPEG-2 with extension, 7 MPEG-2 AAC, 8/9 MPEG-2 low sampling rate,
//   16 E-AC-3, 26 utility data, 27 KLV (ST 336), 28 Dolby E, 29 captioning data, 30 user defined.
//   ffmpeg's s337m demuxer handles 28 (Dolby E) only; 1 and 16 are the IEC 61937 values, which
//   ST 338 shares.
//
// Exactness: the bridge sends float32. ffmpeg's s16/s24-in-s32 → float conversion is exact
// (24-bit mantissa), so the bit patterns survive; any gain, resampling or dither on the way
// destroys them – a burst that is not found can also mean a processed pair.
//
// AC-3 bit stream information: ATSC A/52:2018 §5.3 (syncinfo: syncword 0B77h, crc1,
// fscod(2), frmsizecod(6); bsi: bsid(5), bsmod(3), acmod(3), cmixlev(2) if 3 front channels,
// surmixlev(2) if surround, dsurmod(2) if 2/0, lfeon(1), dialnorm(5)) and Table 5.18 (bit rates).
// E-AC-3: A/52:2018 Annex E §E.2.2 (syncword, strmtyp(2), substreamid(3), frmsiz(11), fscod(2),
// fscod2 or numblkscod(2), acmod(3), lfeon(1), bsid(5) = 16, dialnorm(5)). bsid sits at bit 40
// in both, which tells them apart (≤ 8 AC-3, 11–16 E-AC-3).
// Dolby Atmos in E-AC-3 (JOC) is signalled in EMDF payloads after the audio blocks; not parsed
// here – it is reported as E-AC-3. Dolby E: only type, stream and burst period; its metadata
// (program configuration, frame rate) is scrambled and not parsed – ffmpeg's dolby_e decoder
// would be the way (docs/research/ton-sendeniveau.md).

export const S337_TYPES: Record<number, string> = {
  0: 'null', 1: 'AC-3', 3: 'pause', 4: 'MPEG-1 layer 1', 5: 'MPEG-1 layer 2/3', 6: 'MPEG-2 extension', 7: 'MPEG-2 AAC',
  8: 'MPEG-2 layer 1 LSF', 9: 'MPEG-2 layer 2/3 LSF', 16: 'E-AC-3', 26: 'utility data', 27: 'KLV (ST 336)', 28: 'Dolby E',
  29: 'captioning data', 30: 'user defined',
};

const PRE: { bits: 16 | 20 | 24; pa: number; pb: number; shift: number }[] = [
  { bits: 16, pa: 0xf872, pb: 0x4e1f, shift: 8 },
  { bits: 20, pa: 0x6f872, pb: 0x54e1f, shift: 4 },
  { bits: 24, pa: 0x96f872, pb: 0xa54e1f, shift: 0 },
];

export interface DolbyBsi {
  codec: 'AC-3' | 'E-AC-3'; bsid: number; sampleRate: number | null;
  /** AC-3: kbit/s from frmsizecod; E-AC-3: from frmsiz and the block count */
  kbps: number | null;
  acmod: number; mode: string; lfe: boolean; channels: number;
  /** dialogue normalisation in dB (−1 … −31; 0 → −31 per A/52) */
  dialnorm: number;
  /** AC-3 only: bit stream mode (0 complete main … 7 karaoke/voice-over) */
  bsmod: number | null;
  /** E-AC-3 only: stream type 0 independent, 1 dependent, 2 AC-3 converted; substream id */
  strmtyp: number | null; substream: number | null;
}

const ACMOD = ['1+1', '1/0', '2/0', '3/0', '2/1', '3/1', '2/2', '3/2'];
const ACMOD_CH = [2, 1, 2, 3, 3, 4, 4, 5];
const AC3_KBPS = [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384, 448, 512, 576, 640];
const FS = [48000, 44100, 32000];

class Bits {
  private p = 0;
  constructor(private b: ArrayLike<number>) {}
  read(n: number) {
    let v = 0;
    for (let i = 0; i < n; i++, this.p++) v = (v << 1) | (((this.b[this.p >> 3] ?? 0) >> (7 - (this.p & 7))) & 1);
    return v;
  }
}

/** AC-3 or E-AC-3 syncframe header (bytes from the syncword on), null if it is neither. */
export function parseDolbyBsi(bytes: ArrayLike<number>): DolbyBsi | null {
  if (bytes.length < 8 || bytes[0] !== 0x0b || bytes[1] !== 0x77) return null;
  const bsid = (bytes[5] >> 3) & 31;
  const r = new Bits(bytes);
  r.read(16);
  if (bsid <= 8) {
    r.read(16);
    const fscod = r.read(2), frmsizecod = r.read(6);
    r.read(5);
    const bsmod = r.read(3), acmod = r.read(3);
    if ((acmod & 1) && acmod !== 1) r.read(2);
    if (acmod & 4) r.read(2);
    if (acmod === 2) r.read(2);
    const lfe = !!r.read(1), dn = r.read(5);
    return {
      codec: 'AC-3', bsid, sampleRate: FS[fscod] ?? null, kbps: AC3_KBPS[frmsizecod >> 1] ?? null,
      acmod, mode: ACMOD[acmod] + (lfe ? '.1' : ''), lfe, channels: ACMOD_CH[acmod] + (lfe ? 1 : 0),
      dialnorm: -(dn || 31), bsmod, strmtyp: null, substream: null,
    };
  }
  if (bsid < 11 || bsid > 16) return null;
  const strmtyp = r.read(2), substream = r.read(3), frmsiz = r.read(11), fscod = r.read(2);
  let fs: number | null, blocks: number;
  if (fscod === 3) { const f2 = r.read(2); fs = [24000, 22050, 16000][f2] ?? null; blocks = 6; }
  else { fs = FS[fscod]; blocks = [1, 2, 3, 6][r.read(2)]; }
  const acmod = r.read(3), lfe = !!r.read(1);
  r.read(5);
  const dn = r.read(5);
  const bytesPerFrame = (frmsiz + 1) * 2;
  return {
    codec: 'E-AC-3', bsid, sampleRate: fs, kbps: fs ? Math.round((bytesPerFrame * 8 * fs) / (blocks * 256) / 1000) : null,
    acmod, mode: ACMOD[acmod] + (lfe ? '.1' : ''), lfe, channels: ACMOD_CH[acmod] + (lfe ? 1 : 0),
    dialnorm: -(dn || 31), bsmod: null, strmtyp, substream,
  };
}

export interface S337Burst {
  /** pair index: 0 = channels 1/2 */
  pair: number;
  bits: 16 | 20 | 24;
  dataType: number; name: string; stream: number; error: boolean;
  lengthBits: number;
  /** sample frames between the last two bursts (null after the first) */
  period: number | null;
  /** frame index (stream samples) of the last burst */
  at: number;
  bsi: DolbyBsi | null;
}

/** Payload words to collect after Pd for the BSI (16-bit mode: 2 bytes per word). */
const PAYLOAD_WORDS = 12;

/** Finds ST 337 bursts in every channel pair of a planar stream. */
export class S337Detector {
  private frame = 0;
  private bursts = new Map<number, S337Burst>();
  /** per pair: frames after Pa still to read (Pc/Pd, payload) */
  private pend = new Map<number, { at: number; pre: (typeof PRE)[number]; words: number[] }>();

  /** 24-bit two's complement word of a float sample (exact for s16/s24 sources). */
  static word(x: number) { return Math.round(x * 8388608) & 0xffffff; }

  push(chs: ArrayLike<number>[], n: number) {
    const pairs = chs.length >> 1;
    for (let p = 0; p < pairs; p++) {
      const A = chs[p * 2], B = chs[p * 2 + 1];
      for (let i = 0; i < n; i++) {
        const a = S337Detector.word(A[i]), b = S337Detector.word(B[i]);
        const pd = this.pend.get(p);
        if (pd) {
          pd.words.push(a >> pd.pre.shift, b >> pd.pre.shift);
          if (pd.words.length >= 2 + PAYLOAD_WORDS) { this.finish(p, pd); this.pend.delete(p); }
          continue;
        }
        if (!a) continue;
        for (const pre of PRE) {
          if ((a >> pre.shift) === pre.pa && (b >> pre.shift) === pre.pb && (pre.shift === 0 || !(a & ((1 << pre.shift) - 1)))) {
            this.pend.set(p, { at: this.frame + i, pre, words: [] });
            break;
          }
        }
      }
    }
    this.frame += n;
  }

  private finish(p: number, pd: { at: number; pre: (typeof PRE)[number]; words: number[] }) {
    // Pc is left-justified (16 bit + extension bits below), Pd right-justified (ffmpeg libavformat/s337m.c)
    const pc = pd.words[0] >> (pd.pre.bits - 16), len = pd.words[1];
    const dataType = pc & 31, old = this.bursts.get(p);
    let bsi: DolbyBsi | null = null;
    if ((dataType === 1 || dataType === 16) && pd.pre.bits === 16) {
      const bytes = pd.words.slice(2).flatMap((w) => [(w >> 8) & 255, w & 255]);
      bsi = parseDolbyBsi(bytes);
    }
    this.bursts.set(p, {
      pair: p, bits: pd.pre.bits, dataType, name: S337_TYPES[dataType] ?? `type ${dataType}`, stream: (pc >> 13) & 7, error: !!(pc & 0x80),
      lengthBits: len, period: old ? pd.at - old.at : null, at: pd.at, bsi: bsi ?? (old?.dataType === dataType ? old.bsi : null),
    });
  }

  /** Bursts seen within the last `maxAge` sample frames (default 1 s at 48 kHz). */
  result(maxAge = 48000): S337Burst[] {
    return [...this.bursts.values()].filter((b) => this.frame - b.at <= maxAge).sort((a, b) => a.pair - b.pair);
  }
}
