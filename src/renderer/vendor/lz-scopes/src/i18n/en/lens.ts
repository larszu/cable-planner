// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: lens fingerprint panel (src/lensPanel.ts).
import type { Messages } from '../types';

export default {
  'lens.mapCaption': 'Brightness against the centre, ±10 %',
  'lens.sawH': 'Saw H',
  'lens.sawV': 'Saw V',
  'lens.parH': 'Par H',
  'lens.parV': 'Par V',
  'lens.rest': 'Rest',
  'lens.centre': 'Centre R/G {rg} · B/G {bg}',
  'lens.ref.chosen': 'Compared with {lens} @ {zoom} ({date})',
  'lens.ref.zoom': 'Compared with {lens} @ {zoom}, nearest stored zoom ({date})',
  'lens.ref.similar': 'Most similar stored: {lens} @ {zoom} ({date})',
  'lens.dCentre': 'Δ centre R/G {rg} % · B/G {bg} %',
  'lens.worst': 'Largest difference: {ch} {term} {pp} pp',
  'lens.noRef': 'No fingerprint stored yet – ⚙ → lens, zoom, “Store fingerprint”.',
  'lens.lens': 'Lens',
  'lens.lensPh': 'e.g. Fujinon XA20 (with extender: ×2)',
  'lens.zoom': 'Zoom',
  'lens.zoomTitle': 'Zoom position, e.g. the focal length in mm',
  'lens.signal': 'Signal',
  'lens.linear': 'linearise (inverse BT.709)',
  'lens.linearTitle': 'On: the camera’s gamma is on, values are taken back to light. Off: code values, as with knee and gamma switched off for shading (Tektronix).',
  'lens.store': 'Store fingerprint',
  'lens.storeTitle': 'Stores the live shading under lens and zoom (replaces the same lens and zoom)',
  'lens.compare': 'Compare with',
  'lens.auto': 'automatic (same lens, nearest zoom; else the most similar)',
  'lens.delete': 'Delete',
  'lens.export': 'Export JSON',
  'lens.import': 'Import JSON',
  'lens.hint': 'Flat white field, evenly lit, filling the frame or inside the measuring frame; gain 0 dB. Saw = linear change to the right/bottom edge, parabola = edges against the centre, in % of the centre, per channel. Tested with synthetic fields only.',
} as const satisfies Messages;
