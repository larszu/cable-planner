// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: simulcast deviation panel (src/simulcastPanel.ts).
import type { Messages } from '../types';

export default {
  'sim.noChain': 'Compares two stages of the source: switch on a CST or LUT (sidebar → CST / LUT) and pick two different stages in ⚙.',
  'sim.stats': 'ΔE ITP mean {mean} · 95 % {p95} · max {max}',
  'sim.share': '{jnd} % above 1 (just noticeable) · {over} % above {limit}',
  'sim.scene': 'Log stage as scene light (1.0 → 203 cd/m²): ordinal only',
  'sim.a': 'Reference',
  'sim.aTitle': 'The real picture, e.g. the HDR signal before the CST',
  'sim.b': 'Compared with',
  'sim.bTitle': 'The converted picture, e.g. after the CST/LUT to SDR',
  'sim.scale': 'Colour scale up to',
  'sim.limit': 'Count above',
  'sim.limitTitle': 'Share of the picture above this ΔE ITP (BT.2124 Annex 4 calls < 3 acceptable for a reference display)',
  'sim.hint': 'ΔE ITP after ITU-R BT.2124 on display light; SDR placed back into the HDR container with 100 % = 203 cd/m² (BT.2408). 1 = just noticeable under the most critical adaptation, so it may over-predict. Grey = below 1.',
} as const satisfies Messages;
