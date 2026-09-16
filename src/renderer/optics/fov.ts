import type { SensorSize, FovResult, DofResult } from './types';

const DEG = 180 / Math.PI;

// ───────────────────────────────────────────────────────────────────────────
// Die Zahlen, die in mehr als einer Formel vorkommen, stehen HIER.
//
// BEFUND (Defektformen-Sweep, Form `zwei-rechnungen`, gemessen 2026-09-07).
// `components/Sidebar/CalculationBreakdown.tsx` — die Tafel, die dem Nutzer
// den Rechenweg zeigt, damit er die Ausgabe nachpruefen kann — rechnete zwei
// Werte selbst nach:
//
//     const D = Math.sqrt(W * W + H * H);          // Sensordiagonale
//     const personPx = (personH / imgH) * 1080;    // „matches utils/fov.ts"
//
// Der Kommentar daneben sagte es offen: „(matches utils/fov.ts:
// personHeightInFrame)". Eine Uebereinstimmung, die jemand von Hand pflegen
// muss, ist keine. Und ausgerechnet an dieser Stelle ist sie am teuersten:
// wer den Rechenweg aufklappt, tut das, weil er der Zahl nicht traut. Eine
// Tafel, die eine ANDERE Zahl herleitet als der Rechner darueber, ist
// schlimmer als gar keine Tafel.
//
// Dieselben Zahlen standen ausserdem als nackte Literale im JSX (1.80, 1080,
// 1500) — der Rechenweg behauptete also eine Formel, die er nicht benutzte.
// ───────────────────────────────────────────────────────────────────────────

/** Koerperhoehe, mit der „wie gross steht die Person im Bild" gerechnet wird. */
export const PERSON_HEIGHT_M = 1.8;

/** Bildhoehe des Ausgabeformats in Pixeln (1080p als Bezug). */
export const OUTPUT_HEIGHT_PX = 1080;

/** Teiler der Zerstreuungskreis-Naeherung: Diagonale / 1500. */
export const COC_DIVISOR = 1500;

/** Sensordiagonale in mm — die eine Stelle, an der sie entsteht. */
export function sensorDiagonalMm(sensorWidthMm: number, sensorHeightMm: number): number {
  return Math.sqrt(sensorWidthMm ** 2 + sensorHeightMm ** 2);
}

/** Horizontal FOV in degrees */
export function horizontalFov(sensorWidthMm: number, focalLengthMm: number): number {
  return 2 * Math.atan(sensorWidthMm / (2 * focalLengthMm)) * DEG;
}

/** Vertical FOV in degrees */
export function verticalFov(sensorHeightMm: number, focalLengthMm: number): number {
  return 2 * Math.atan(sensorHeightMm / (2 * focalLengthMm)) * DEG;
}

/** Diagonal FOV */
export function diagonalFov(sensorWidthMm: number, sensorHeightMm: number, focalLengthMm: number): number {
  const diag = sensorDiagonalMm(sensorWidthMm, sensorHeightMm);
  return 2 * Math.atan(diag / (2 * focalLengthMm)) * DEG;
}

/** Image width at a given distance (metres) */
export function imageWidthAtDistance(sensorWidthMm: number, focalLengthMm: number, distanceM: number): number {
  const hFov = horizontalFov(sensorWidthMm, focalLengthMm);
  return 2 * distanceM * Math.tan((hFov / 2) / DEG);
}

/** Image height at a given distance (metres) */
export function imageHeightAtDistance(sensorHeightMm: number, focalLengthMm: number, distanceM: number): number {
  const vFov = verticalFov(sensorHeightMm, focalLengthMm);
  return 2 * distanceM * Math.tan((vFov / 2) / DEG);
}

/** 35mm equivalent focal length */
export function equivalentFocalLength(focalLengthMm: number, cropFactor: number): number {
  return focalLengthMm * cropFactor;
}

// ───────────────────────────────────────────────────────────────────────────
// ANAMORPHOTEN-MODUS (Squeeze).
//
// Ein anamorphotisches Objektiv staucht das Bild HORIZONTAL optisch um seinen
// Squeeze-Faktor S (2x, 1.8x, 1.5x, 1.33x) auf den Sensor und wird in der Post
// wieder entzerrt. Fuer das Sichtfeld heisst das:
//
//   • VERTIKAL bleibt es ein Objektiv der Brennweite F — die vertikale FOV
//     rechnet unveraendert mit `focalLengthMm`.
//   • HORIZONTAL faengt es ein um S BREITERES Feld ein: die horizontale
//     Brennweite ist effektiv F/S. Gleichwertig — und so hier gerechnet —
//     verhaelt sich die Sensorbreite fuer die Horizontale wie `widthMm * S`.
//
// Der entzerrte (desqueezed) Frame ist also S-mal breiter; Diagonale und
// `imageWidthAtDistance` folgen daraus. `squeeze = 1` ist der sphaerische
// Normalfall und ergibt Ziffer fuer Ziffer dieselben Zahlen wie zuvor — jede
// bestehende Aufrufstelle ohne Objektiv-Squeeze bleibt damit unveraendert.
//
// NICHT angefasst: die Schaerfentiefe (`computeDof`) rechnet weiter mit der
// physischen Brennweite F. Das ist die uebliche Naeherung — die Schaerfentiefe
// eines Anamorphoten richtet sich nach seiner tatsaechlichen (vertikalen)
// Brennweite, nicht nach der entzerrten Horizontalen.
// ───────────────────────────────────────────────────────────────────────────

/** Full FOV computation. `squeeze` > 1 schaltet den Anamorphoten-Modus (s. o.). */
export function computeFov(
  sensor: SensorSize,
  focalLengthMm: number,
  distanceM: number,
  extender: number = 1,
  squeeze: number = 1,
): FovResult {
  const effectiveFl = focalLengthMm * extender;
  // Horizontale Ausdehnung des entzerrten Frames: Sensorbreite × Squeeze.
  const desqueezedWidthMm = sensor.widthMm * squeeze;
  return {
    horizontalDeg: horizontalFov(desqueezedWidthMm, effectiveFl),
    verticalDeg: verticalFov(sensor.heightMm, effectiveFl),
    diagonalDeg: diagonalFov(desqueezedWidthMm, sensor.heightMm, effectiveFl),
    imageWidthAtDistance: imageWidthAtDistance(desqueezedWidthMm, effectiveFl, distanceM),
    imageHeightAtDistance: imageHeightAtDistance(sensor.heightMm, effectiveFl, distanceM),
    equivalentFocalLength: equivalentFocalLength(effectiveFl, sensor.cropFactor),
    squeeze,
  };
}

/** Circle of confusion for a sensor (diagonal-based, standard formula) */
export function circleOfConfusion(sensorWidthMm: number, sensorHeightMm: number): number {
  return sensorDiagonalMm(sensorWidthMm, sensorHeightMm) / COC_DIVISOR;
}

/** Hyperfocal distance in metres */
export function hyperfocalDistance(focalLengthMm: number, aperture: number, cocMm: number): number {
  return (focalLengthMm ** 2) / (aperture * cocMm) / 1000 + focalLengthMm / 1000;
}

/** Depth of field */
export function computeDof(
  sensor: SensorSize,
  focalLengthMm: number,
  aperture: number,
  focusDistanceM: number,
  extender: number = 1,
): DofResult {
  const effectiveFl = focalLengthMm * extender;
  const coc = circleOfConfusion(sensor.widthMm, sensor.heightMm);
  const H = hyperfocalDistance(effectiveFl, aperture, coc);
  const s = focusDistanceM;

  const nearLimit = (H * s) / (H + (s - effectiveFl / 1000));
  const farLimitRaw = (H * s) / (H - (s - effectiveFl / 1000));
  const farLimit = farLimitRaw < 0 ? Infinity : farLimitRaw;
  const totalDof = farLimit === Infinity ? Infinity : farLimit - nearLimit;

  return { nearLimit, farLimit, totalDof, hyperfocal: H, circleOfConfusion: coc };
}

/** Person height in pixels given sensor, focal length, distance, and output resolution */
export function personHeightInFrame(
  sensorHeightMm: number,
  focalLengthMm: number,
  distanceM: number,
  personHeightM: number = PERSON_HEIGHT_M,
  outputHeightPx: number = OUTPUT_HEIGHT_PX,
): number {
  const imgH = imageHeightAtDistance(sensorHeightMm, focalLengthMm, distanceM);
  return (personHeightM / imgH) * outputHeightPx;
}

/** FOV cone end-points for 2D drawing (returns two points from camera position) */
export function fovConePoints(
  x: number,
  y: number,
  rotationDeg: number,
  hFovDeg: number,
  range: number,
): { left: { x: number; y: number }; right: { x: number; y: number } } {
  const halfFov = (hFovDeg / 2) / DEG;
  const rot = rotationDeg / DEG;
  return {
    left: {
      x: x + range * Math.cos(rot - halfFov),
      y: y + range * Math.sin(rot - halfFov),
    },
    right: {
      x: x + range * Math.cos(rot + halfFov),
      y: y + range * Math.sin(rot + halfFov),
    },
  };
}
