// Time-of-day time code and frame phase after SMPTE ST 2059-1:2021 (pub.smpte.org, free).
//
// - §6.2 Alignment: Alignment Times are n × AlignmentPeriod from the SMPTE Epoch;
//   NextAlignmentTime = (floor(t / AlignmentPeriod) + 1) × AlignmentPeriod. For video the
//   period is 1/R (§7.4), for the LTC codeword 1/Ff (§9.2), BitNumber = floor(t × 80 × Ff) % 80.
// - §9.3.2 Time Address from PTP time via the previous Daily Jam (steps 1–5) and
//   §9.3.3 frames-since-midnight arithmetic: 9.3.3.2 (24/25/30 NDF), 9.3.3.3 (24/1.001 and
//   30/1.001 NDF, counted with the nominal rate), 9.3.3.4 (30/1.001 DF: 1798 × MM +
//   2 × floor(MM/10) + 107892 × HH).
// - ST 2059-2:2021 Annex A: timeOfNextJam from a user jam time on the Local Time scale.
//
// Not in ST 2059-1: rates above 30 Hz. ST 2059-1 only defines LTC codeword rates up to 30 Hz;
// for 50/60 Hz this module counts frames 0…49/59 and, for 60/1.001 DF, drops 4 frame numbers
// per minute except every tenth minute. That is the common display convention (the ST 12-1
// frame-pair scheme is not freely available) and is labelled as such in the UI.
// Colour frame identification (colorFrameIdentificationMode) is not implemented (always 0).

export interface Rate { id: string; label: string; num: number; den: number; nominal: number; dfAllowed: boolean }

export const RATES: Rate[] = [
  { id: '23.98', label: '23,98 (24/1,001)', num: 24000, den: 1001, nominal: 24, dfAllowed: false },
  { id: '24', label: '24', num: 24, den: 1, nominal: 24, dfAllowed: false },
  { id: '25', label: '25', num: 25, den: 1, nominal: 25, dfAllowed: false },
  { id: '29.97', label: '29,97 (30/1,001)', num: 30000, den: 1001, nominal: 30, dfAllowed: true },
  { id: '30', label: '30', num: 30, den: 1, nominal: 30, dfAllowed: false },
  { id: '50', label: '50', num: 50, den: 1, nominal: 50, dfAllowed: false },
  { id: '59.94', label: '59,94 (60/1,001)', num: 60000, den: 1001, nominal: 60, dfAllowed: true },
  { id: '60', label: '60', num: 60, den: 1, nominal: 60, dfAllowed: false },
];
export const rateById = (id: string) => RATES.find((r) => r.id === id) ?? RATES[2];
/** Closest rate for a measured/declared fps (e.g. 29.97 from ffprobe). */
export function rateForFps(fps: number): Rate {
  let best = RATES[2], err = Infinity;
  for (const r of RATES) { const e = Math.abs(r.num / r.den - fps); if (e < err) { err = e; best = r; } }
  return best;
}
/** Beyond ST 2059-1 (> 30 Hz): see the header. */
export const beyondSt2059 = (r: Rate) => r.nominal > 30;

export interface TimeAddress { hh: number; mm: number; ss: number; ff: number; df: boolean }

const dropPerMinute = (r: Rate, df: boolean) => (df && r.dfAllowed ? r.nominal / 15 : 0); // 2 at 30, 4 at 60

/** Frames per 24 h of the time-address count (DF 30: 24 × 107892 = 2 589 408). */
export function framesPerDay(r: Rate, df: boolean) {
  const d = dropPerMinute(r, df);
  return 24 * (r.nominal * 3600 - d * 54);
}

/** Time Address → frames since midnight (ST 2059-1 §9.3.3.2–9.3.3.4 step 1). */
export function toFrames(t: TimeAddress, r: Rate): number {
  const d = dropPerMinute(r, t.df);
  const minutes = 60 * t.hh + t.mm;
  return t.ff + r.nominal * (t.ss + 60 * minutes) - d * (minutes - Math.floor(minutes / 10));
}

/** Frames since midnight → Time Address, wrapping at 24 h (ST 2059-1 §9.3.3 step 3). */
export function fromFrames(frames: number, r: Rate, df: boolean): TimeAddress {
  const d = dropPerMinute(r, df), n = r.nominal;
  const day = framesPerDay(r, df);
  let f = ((Math.floor(frames) % day) + day) % day;
  if (!d) {
    const hh = Math.floor(f / (n * 3600)); f -= hh * n * 3600;
    const mm = Math.floor(f / (n * 60)); f -= mm * n * 60;
    const ss = Math.floor(f / n);
    return { hh, mm, ss, ff: f - ss * n, df: false };
  }
  // 9.3.3.4 with 1800 = 60·n, 18000 = 600·n, 1798 = 60·n − d, 107892 = 3600·n − 54·d
  const perHour = n * 3600 - 54 * d, perMin = 60 * n - d;
  const hh = Math.floor(f / perHour);
  const r0 = f - perHour * hh;
  const mm = Math.floor((r0 + d * Math.floor(r0 / (60 * n)) - d * Math.floor(r0 / (600 * n))) / (60 * n));
  const rest = r0 - perMin * mm - d * Math.floor(mm / 10);
  const ss = Math.floor(rest / n);
  return { hh, mm, ss, ff: rest - n * ss, df: true };
}

const p2 = (v: number) => String(v).padStart(2, '0');
export const formatTc = (t: TimeAddress) => `${p2(t.hh)}:${p2(t.mm)}:${p2(t.ss)}${t.df ? ';' : ':'}${p2(t.ff)}`;

/** "10:00:00:00", "01:00:00;00" (DF), also "."/"," as last separator. */
export function parseTc(s: string): TimeAddress | null {
  const m = /^\s*(\d{1,2}):(\d{2}):(\d{2})([:;.,])(\d{2,3})\s*$/.exec(s ?? '');
  if (!m) return null;
  return { hh: +m[1], mm: +m[2], ss: +m[3], ff: +m[5], df: m[4] === ';' || m[4] === ',' };
}

/** Is this a legal address at the rate (DF skips frames 0…d−1 at minutes not divisible by 10)? */
export function validTc(t: TimeAddress, r: Rate) {
  const d = dropPerMinute(r, t.df);
  if (t.hh > 23 || t.mm > 59 || t.ss > 59 || t.ff >= r.nominal) return false;
  return !(d && t.ss === 0 && t.mm % 10 !== 0 && t.ff < d);
}

// ---- alignment (ST 2059-1 §6.2, Annex A)

/** Frame (alignment period) containing PTP time t: index since the epoch, phase 0…1, next alignment time. */
export function framePhase(t: number, r: Rate) {
  const n = Math.floor((t * r.num) / r.den);
  const start = (n * r.den) / r.num;
  const period = r.den / r.num;
  return { n, phase: (t - start) / period, next: ((n + 1) * r.den) / r.num, period };
}

/** ST 2059-1 §6.2: NextAlignmentTime = (floor(t / AlignmentPeriod) + 1) × AlignmentPeriod. */
export const nextAlignmentTime = (t: number, periodNum: number, periodDen: number) =>
  ((Math.floor((t * periodDen) / periodNum) + 1) * periodNum) / periodDen;

/** ST 2059-1 §9.2: bit of the 80-bit LTC codeword at PTP time t (Ff ≤ 30). */
export const ltcBitNumber = (t: number, r: Rate) => Math.floor((t * 80 * r.num) / r.den) % 80;

// ---- time address from PTP time (ST 2059-1 §9.3.2)

/** The SM TLV members used for the time address (ST 2059-2 Table 2). */
export interface JamParams {
  /** Local Time − PTP time in s */
  currentLocalOffset: number;
  /** PTP seconds of the previous Daily Jam (0 = none: counts from the epoch, fine for integer rates) */
  timeOfPreviousJam: number;
  previousJamLocalOffset: number;
  /** PTP seconds of the next Daily Jam, 0 = none */
  timeOfNextJam: number;
}

/**
 * Time address of codeword n (counted from zero at the SMPTE Epoch), steps 1 and 5.
 * Codeword rate Ff = r.num / r.den; frames above 30 Hz see the header.
 */
export function timeAddressOfCodeword(n: number, r: Rate, df: boolean, jam: JamParams): TimeAddress {
  const dfUsed = df && r.dfAllowed;
  // Step 1.2: n_pdjam = ceiling(t_pdjamPTP × Ff)
  const npdjam = Math.ceil((jam.timeOfPreviousJam * r.num) / r.den);
  // 1.3: exact jam time on the PTP scale; 1.4: on the Local Time scale
  let tLocal = (npdjam * r.den) / r.num + jam.previousJamLocalOffset;
  if (tLocal < 0) tLocal += 24 * 60 * 60;
  // 1.5: HH, MM of the jam, SS = FF = 0
  const hh = Math.floor(tLocal / 3600) % 24, mm = Math.floor(tLocal / 60) % 60;
  const base = toFrames({ hh, mm, ss: 0, ff: 0, df: dfUsed }, r);
  // Step 5: f_e = n − n_pdjam, added to the jam address
  return fromFrames(base + (n - npdjam), r, dfUsed);
}

/** Step 2: codeword number of the first codeword at or after t = ceiling(t × Ff). */
export const nextCodeword = (t: number, r: Rate) => Math.ceil((t * r.num) / r.den);
/** The codeword (frame) in progress at t = floor(t × Ff) – what a clock shows "now". */
export const currentCodeword = (t: number, r: Rate) => Math.floor((t * r.num) / r.den);

/** Time address in progress at PTP time t. */
export const timeAddressAt = (t: number, r: Rate, df: boolean, jam: JamParams) => timeAddressOfCodeword(currentCodeword(t, r), r, df, jam);

/**
 * ST 2059-2 Annex A: next Daily Jam on the PTP scale for a jam at HH:MM Local Time
 * (should be a multiple of 10 minutes).
 */
export function timeOfNextJam(t: number, currentLocalOffset: number, jamHH: number, jamMM: number) {
  const tmLocal = Math.floor((t + currentLocalOffset) / 86400) * 86400;
  let next = tmLocal + jamHH * 3600 + jamMM * 60 - currentLocalOffset;
  if (t >= next) next += 86400;
  return next;
}

/**
 * Jam parameters as a local generator would set them (ST 2059-2 §6.13.3 "If Daily Jam is in
 * use"): next jam per Annex A, previous = one day earlier, with the Local Time offset that was
 * valid then (`offsetAt` gives currentLocalOffset for a PTP time, e.g. from the browser zone).
 */
export function emulatedJam(t: number, offsetAt: (ptp: number) => number, jamHH: number, jamMM: number): JamParams {
  const clo = offsetAt(t);
  const next = timeOfNextJam(t, clo, jamHH, jamMM);
  const prev = next - 86400;
  return { currentLocalOffset: clo, timeOfNextJam: next, timeOfPreviousJam: prev, previousJamLocalOffset: offsetAt(prev) };
}

/** Signed difference a − b in frames, wrapped into ±½ day (both addresses at the same rate). */
export function tcDiff(a: TimeAddress, b: TimeAddress, r: Rate): number {
  const day = framesPerDay(r, a.df);
  let d = toFrames(a, r) - toFrames({ ...b, df: a.df }, r);
  d = ((d % day) + day) % day;
  return d > day / 2 ? d - day : d;
}
