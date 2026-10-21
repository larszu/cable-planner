// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/common.ts.
import type en from '../en/common';
import type { Translation } from '../types';

export default {
  'common.close': 'Schließen',
  'common.closeEsc': 'Schließen (Esc)',
  'common.settings': 'Einstellungen',
  'common.off': 'aus',
  'common.on': 'an',

  'lang.label': 'Sprache',
  'lang.auto': 'Automatisch ({lang})',
  'lang.title': 'Sprache der Bedienoberfläche',
  'lang.hint': 'Automatisch folgt der Systemsprache; alles außer Deutsch zeigt Englisch. Beim Umschalten lädt das Fenster neu: Quellen und Layout bleiben, eine laufende Kamera- oder Bildschirmaufnahme muss man neu starten.',
} satisfies Translation<typeof en>;
