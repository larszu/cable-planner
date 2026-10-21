// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: shared UI layer (src/ui/) and the responsive shell.
import type { Messages } from '../types';

export default {
  'ui.scheme': 'Appearance',
  'ui.scheme.dark': 'Dark',
  'ui.scheme.light': 'Light',
  'ui.scheme.system': 'Like the system',
  'ui.scheme.title': 'Light or dark interface; the scopes themselves always stay dark',
  'ui.scheme.hint': 'Dark is the default for colour-critical work: a bright interface next to the picture changes how you see it. The skin Original only exists in dark.',
  'ui.more': 'More',
  'ui.moreTitle': 'Layout presets and scale',
  'ui.layouts': 'Layout',
  'ui.scale': 'Scale',
  'ui.closeSidebar': 'Close the sources',
  'ui.scope': 'Measuring tool',
  'ui.panels': 'Panels',
} as const satisfies Messages;
