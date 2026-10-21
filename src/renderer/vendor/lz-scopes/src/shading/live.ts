// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// The Touch Shading target as the shading assistant panel sees it (#151): camera number, label
// and the camera data lz-camera-bridge reports. Set by ShadingControl, read by panel.ts – a small
// seam so the panel does not import the bar.
import type { CameraData } from './guide';
import { t } from '../i18n';

export interface LiveCamera { n: number; label: string; connected: boolean; data: CameraData | undefined }

let provider: () => LiveCamera | null = () => null;
export function setLiveCamera(f: () => LiveCamera | null) { provider = f; }
export function liveCamera(): LiveCamera | null { return provider(); }

/** Labels of the camera data line, in the UI language. */
export function cameraDataLabels() {
  return {
    iris: t('shading.data.iris'), gain: t('shading.data.gain'), nd: t('shading.data.nd'), shutter: t('shading.data.shutter'), temp: t('shading.data.temp'), tally: t('shading.data.tally'),
    tallyText: { program: t('shading.data.program'), preview: t('shading.data.preview'), off: t('shading.data.off') },
  };
}

