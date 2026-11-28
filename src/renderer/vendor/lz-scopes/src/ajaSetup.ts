// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Setup dialog for AJA Video Systems cards (KONA, Io, U-TAP …): the steps from "nothing installed"
// to "device found", ticked off from what the bridge reports (GET /api/aja). Same dialog as for
// DeckLink (src/decklinkSetup.ts). NOT CHECKED WITH HARDWARE: no AJA card was available.

import { t } from './i18n';
import { link } from './ui';
import { openSetupDialog, type Step } from './decklinkSetup';

export interface AjaDevice {
  index: number;
  name: string;
  serial?: string;
  capture?: boolean;
  ready?: boolean;
  /** another application holds the card (AJA ControlRoom, Premiere …) */
  busy?: boolean;
  anc?: boolean;
  audioChannels?: number;
  /** sdi1 …, hdmi1 …, quad1 / quad1sq (3G cards with 4K: quad link over SDI 1–4) */
  inputs?: string[];
  /** detected format per input with a signal, e.g. {sdi1: "1080i50"} */
  signals?: Record<string, string>;
}
export interface AjaStatus {
  available: boolean;
  helper: boolean;
  platform?: string;
  sdk?: string;
  devices: AjaDevice[];
  error?: string;
  code?: string;
}

export const AJA_SOFTWARE_URL = 'https://www.aja.com/support';
export const AJA_LINUX_DRIVER_URL = 'https://github.com/aja-video/libajantv2';

/** Steps for the bridge's platform with their done flags (pure, tested). */
export function ajaSteps(st: AjaStatus): Step[] {
  const linux = st.platform === 'linux', win = st.platform === 'win32';
  const found = st.devices.length > 0;
  const free = found && st.devices.some((d) => !d.busy && d.ready !== false);
  return [
    { done: st.helper, title: t('ajasetup.helper'), body: () => [t('ajasetup.helperBody')] },
    {
      done: found, title: t(linux ? 'ajasetup.installLinux' : 'ajasetup.install'),
      body: () => linux ? [t('ajasetup.installLinuxBody'), ' ', link(AJA_LINUX_DRIVER_URL, 'github.com/aja-video/libajantv2')]
        : [t(win ? 'ajasetup.installWinBody' : 'ajasetup.installMacBody'), ' ', link(AJA_SOFTWARE_URL, 'aja.com/support')],
    },
    { done: free, title: t('ajasetup.free'), body: () => [t('ajasetup.freeBody')] },
  ];
}

/** Opens the AJA setup dialog. */
export function openAjaSetup(st: AjaStatus, check: () => Promise<AjaStatus | null>, onReady?: (st: AjaStatus) => void) {
  return openSetupDialog({ title: t('ajasetup.title'), intro: t('ajasetup.intro'), steps: ajaSteps }, st, check, onReady);
}

/** "SDI 1", "HDMI 2", "SDI 1–4 · Quad 2SI" … for a connector id of the helper. */
export function ajaInputName(id: string): string {
  if (id === 'quad1') return 'SDI 1–4 · Quad 2SI';
  if (id === 'quad1sq') return 'SDI 1–4 · Quad Square Division';
  const m = /^(sdi|hdmi)(\d+)$/.exec(id);
  return m ? `${m[1].toUpperCase()} ${m[2]}` : id;
}
