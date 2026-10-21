// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: chain.
import type { Messages } from '../types';

export default {
  'chain.stage.signal': 'Signal (before CST)',
  'chain.stage.cst': 'after CST',
  'chain.stage.lut': 'after LUT',
  'chain.tm.none': 'none (pass through linear)',
  'chain.tm.clip': 'Clip at the target peak',
  'chain.tm.bt2390': 'BT.2390 EETF (per channel, PQ)',
  'chain.tm.reinhard': 'Extended Reinhard (luminance)',
  'chain.tm.aces2': 'ACES 2.0 tonescale (luminance)',
  'chain.note.noCst': 'after CST – no CST active, shows the signal',
  'chain.stageShort.signal': 'Signal',
  'chain.note.lutMissing': 'after LUT – {luts} not loaded',
  'chain.note.noLutAfterCst': 'after LUT – no LUT set, shows after CST',
  'chain.note.noLutSignal': 'after LUT – no LUT set, shows the signal',
} as const satisfies Messages;
