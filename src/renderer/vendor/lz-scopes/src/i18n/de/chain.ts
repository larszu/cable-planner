// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/chain.ts.
import type en from '../en/chain';
import type { Translation } from '../types';

export default {
  'chain.stage.signal': 'Signal (vor CST)',
  'chain.stage.cst': 'nach CST',
  'chain.stage.lut': 'nach LUT',
  'chain.tm.none': 'keins (linear durchreichen)',
  'chain.tm.clip': 'Clip an der Zielspitze',
  'chain.tm.bt2390': 'BT.2390-EETF (je Kanal, PQ)',
  'chain.tm.reinhard': 'Reinhard erweitert (Luminanz)',
  'chain.tm.aces2': 'ACES-2.0-Tonescale (Luminanz)',
  'chain.note.noCst': 'nach CST – keine CST aktiv, zeigt das Signal',
  'chain.stageShort.signal': 'Signal',
  'chain.note.lutMissing': 'nach LUT – {luts} nicht geladen',
  'chain.note.noLutAfterCst': 'nach LUT – keine LUT gesetzt, zeigt nach CST',
  'chain.note.noLutSignal': 'nach LUT – keine LUT gesetzt, zeigt das Signal',
} satisfies Translation<typeof en>;
