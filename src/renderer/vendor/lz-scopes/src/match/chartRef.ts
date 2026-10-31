// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Reference values of the ColorChecker Classic (#200): what the chart should look like, not
// only what the camera next to it sees. With them a single camera can be measured against the
// standard instead of against a neighbour.
//
// Data: *BabelColor Average* – the average of 30 charts, measured by BabelColor and published as
// xyY under ICC D50 (colour-science, BSD-3-Clause, colour/characterisation/datasets/
// colour_checkers/chromaticity_coordinates.py, see THIRD_PARTY.md). Patch order row by row from
// the top left, like patchMedians().
//
// A real chart ages and varies from batch to batch: this is an average, not a measurement of the
// chart on the table. The panel says so – otherwise ΔE 2,5 gets read as a camera fault when the
// chart is simply faded.

import { GAMUTS, bradford, inv3, linearToSignal, mul3, rgbToXyzMatrix, signalToLinear } from '../color';
import type { Space } from '../deltae';
import type { CameraPatches } from './chart';
import type { Rgb } from './core';

/** White of the reference data: ICC D50 (x, y). */
export const REF_WHITE_XY: [number, number] = [0.3457, 0.3585];

/** 24 patches as x, y, Y (Y relative to a perfect diffuse white = 1). */
export const BABELCOLOR_AVERAGE: [number, number, number][] = [
  [0.4325, 0.3788, 0.1034], [0.4191, 0.3748, 0.3525], [0.2761, 0.3004, 0.1847], [0.3700, 0.4501, 0.1335],
  [0.3020, 0.2877, 0.2324], [0.2856, 0.3910, 0.4174], [0.5291, 0.4075, 0.3117], [0.2339, 0.2155, 0.1140],
  [0.5008, 0.3293, 0.1979], [0.3326, 0.2556, 0.0644], [0.3989, 0.4998, 0.4435], [0.4962, 0.4428, 0.4358],
  [0.2040, 0.1696, 0.0579], [0.3270, 0.5033, 0.2307], [0.5709, 0.3298, 0.1268], [0.4694, 0.4732, 0.6081],
  [0.4177, 0.2704, 0.2007], [0.2151, 0.3037, 0.1903], [0.3488, 0.3628, 0.9129], [0.3451, 0.3596, 0.5885],
  [0.3446, 0.3590, 0.3595], [0.3438, 0.3589, 0.1912], [0.3423, 0.3576, 0.0893], [0.3439, 0.3565, 0.0320],
];

/** Index of the white patch (bottom row, left) – the one an exposure is normalised to. */
export const WHITE_PATCH = 18;

/** xyY → XYZ; y = 0 would be a colour without luminance, which does not exist on a chart. */
export function xyYToXyz([x, y, Y]: [number, number, number]): number[] {
  if (y <= 0) return [0, 0, 0];
  return [(x * Y) / y, Y, ((1 - x - y) * Y) / y];
}

/** The reference in one encoding, plus which patches that gamut cannot hold. */
export interface ChartReference extends CameraPatches {
  /** true where the patch needs a negative channel in this gamut – the signal is clipped there */
  outside: boolean[];
}

/**
 * The reference patches as signal in `space`: XYZ of the data, Bradford-adapted from D50 to the
 * white of the target gamut, into its linear RGB and encoded with its curve.
 *
 * Six of the 24 patches do not fit into Rec.709 – their signal is clipped at 0, like in any
 * camera. `outside` marks them, so the panel can say that their ΔE is limited by the gamut and
 * not by the camera.
 */
export function chartReference(space: Space, id = 'chart-ref'): ChartReference {
  const g = GAMUTS[space.gamut];
  const toRgb = inv3(rgbToXyzMatrix(g));
  const adapt = bradford(REF_WHITE_XY, g.white);
  const outside: boolean[] = [];
  const patches = BABELCOLOR_AVERAGE.map((p) => {
    const lin = mul3(toRgb, mul3(adapt, xyYToXyz(p)));
    outside.push(lin.some((c) => c < -1e-6));
    return linearToSignal(lin, space.transfer, space.hlgLw) as Rgb;
  });
  return { id, space, patches, outside };
}

/**
 * Camera patches scaled so that their white patch sits on the reference white (in linear light).
 * Without it, ΔE against absolute values measures the exposure, not the colour: half a stop off
 * and every patch is wrong. The factor comes from the luminance of the white patch, so it
 * changes the level and not the colour.
 */
export function normaliseExposure(cam: CameraPatches, ref: CameraPatches): { cam: CameraPatches; factor: number } {
  const c = cam.patches[WHITE_PATCH], r = ref.patches[WHITE_PATCH];
  if (!c || !r) return { cam, factor: 1 };
  const lin = (p: Rgb, s: Space) => signalToLinear(p, s.transfer, s.hlgLw);
  const y = (v: number[]) => (v[0] + v[1] + v[2]) / 3;
  const cw = y(lin(c, cam.space)), rw = y(lin(r, ref.space));
  if (!(cw > 1e-6) || !(rw > 1e-6)) return { cam, factor: 1 };
  const factor = rw / cw;
  if (Math.abs(factor - 1) < 1e-6) return { cam, factor: 1 };
  return {
    factor,
    cam: {
      ...cam,
      patches: cam.patches.map((p) => (p ? linearToSignal(lin(p, cam.space).map((v) => v * factor), cam.space.transfer, cam.space.hlgLw) as Rgb : null)),
    },
  };
}
