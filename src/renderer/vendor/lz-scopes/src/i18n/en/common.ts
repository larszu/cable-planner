// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: shared words and the language setting. Keys are `area.name`.
import type { Messages } from '../types';

export default {
  'common.close': 'Close',
  'common.closeEsc': 'Close (Esc)',
  'common.settings': 'Settings',
  'common.off': 'off',
  'common.on': 'on',

  'lang.label': 'Language',
  'lang.auto': 'Automatic ({lang})',
  'lang.title': 'Language of the user interface',
  'lang.hint': 'Automatic follows the system language; anything other than German shows English. Switching reloads the window: sources and layout are kept, a running camera or screen capture has to be started again.',
} as const satisfies Messages;
