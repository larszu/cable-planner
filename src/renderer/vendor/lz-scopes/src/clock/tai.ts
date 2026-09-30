// TAI − UTC and the SMPTE/PTP epoch.
//
// SMPTE ST 2059-1:2021 §6.1: "The SMPTE Epoch shall be 01 January 1970 00:00:00 TAI",
// identical to the PTP epoch of IEEE Std 1588-2008; Note 2: the SMPTE Epoch is
// 63072010 seconds before 1972-01-01T00:00:00Z (UTC).
//
// TAI − UTC: IERS table in server/leap.mjs (shared with the bridge).

import { LEAP_TABLE_EXPIRES_MS, taiMinusUtc } from '../../server/leap.mjs';
export { LEAP_SOURCE, LEAP_TABLE, LEAP_TABLE_EXPIRES_MS, MJD_UNIX, taiMinusUtc } from '../../server/leap.mjs';

/** Is the leap-second table still authoritative at this instant? */
export const leapTableValid = (utcMs: number) => utcMs < LEAP_TABLE_EXPIRES_MS;

/** PTP time (seconds since the SMPTE/PTP epoch, TAI) from a POSIX UTC instant in ms. */
export const utcToPtp = (utcMs: number) => utcMs / 1000 + taiMinusUtc(utcMs);

/** POSIX UTC ms from PTP time (inverse of utcToPtp outside a leap second). */
export function ptpToUtc(ptp: number): number {
  let ms = ptp * 1000;
  for (let i = 0; i < 2; i++) ms = (ptp - taiMinusUtc(ms)) * 1000;
  return ms;
}

/**
 * currentLocalOffset of the SMPTE profile (ST 2059-2 Table 2): Local Time − PTP time in s.
 * = zone offset (incl. daylight saving) − (TAI − UTC). ST 2059-2 footnote 4: EST (UTC−5),
 * 2014-01-01, TAI − UTC = 35 → −18035; EDT (UTC−4), 2014-07-01 → −14435.
 */
export const localOffset = (utcMs: number, zoneSeconds: number) => zoneSeconds - taiMinusUtc(utcMs);

/** Zone offset of the browser's time zone at an instant, in seconds east of UTC. */
export const browserZoneSeconds = (utcMs: number) => -new Date(utcMs).getTimezoneOffset() * 60;
