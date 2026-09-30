// TAI − UTC, shared by the bridge (server/ptp.mjs fallback) and the UI (src/clock/tai.ts).
//
// From the IERS table Leap_Second.dat (hpiers.obspm.fr/iers/bul/bulc/Leap_Second.dat,
// "Updated through IERS Bulletin 72 issued in July 2026", "File expires on 28 June 2027").
// IERS Bulletin C 72 (Paris, 06 July 2026): "NO leap second will be introduced at the end of
// December 2026 … from 2017 January 1, 0h UTC, until further notice : UTC-TAI = -37 s".

/** [MJD at 0h UTC from which the value applies, TAI − UTC in s] */
export const LEAP_TABLE = [
  [41317, 10], [41499, 11], [41683, 12], [42048, 13], [42413, 14], [42778, 15], [43144, 16], [43509, 17], [43874, 18],
  [44239, 19], [44786, 20], [45151, 21], [45516, 22], [46247, 23], [47161, 24], [47892, 25], [48257, 26], [48804, 27],
  [49169, 28], [49534, 29], [50083, 30], [50630, 31], [51179, 32], [53736, 33], [54832, 34], [56109, 35], [57204, 36],
  [57754, 37],
];
/** The table is authoritative up to this instant ("File expires on 28 June 2027"). */
export const LEAP_TABLE_EXPIRES_MS = Date.UTC(2027, 5, 28);
export const LEAP_SOURCE = 'IERS Bulletin C 72 (06.07.2026), Leap_Second.dat gültig bis 28.06.2027';
/** MJD 40587 = 1970-01-01 (SMPTE ST 2059-1 §9.3.4 step 3: MJD = D + 40587). */
export const MJD_UNIX = 40587;

/** TAI − UTC in s at a POSIX UTC instant in ms; 0 before 1972 (no integer offset defined). */
export function taiMinusUtc(utcMs) {
  const mjd = utcMs / 86400000 + MJD_UNIX;
  let v = 0;
  for (const [m, s] of LEAP_TABLE) if (mjd >= m) v = s; else break;
  return v;
}
