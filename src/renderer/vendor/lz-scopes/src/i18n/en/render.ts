// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// English source texts: render.
import type { Messages } from '../types';

export default {
  'render.h264Format': 'H.264: picture format {fmt} not supported',
  'render.unknown': 'unknown',
  'render.h264NeedsWebCodecs': 'H.264 transport needs WebCodecs (Chrome, Edge, desktop app) – switch to “raw”',
  'render.noWebgl2': 'WebGL2 is not supported by this browser.',
  'render.noFloatTargets': 'EXT_color_buffer_float/EXT_color_buffer_half_float missing – the scopes need float render targets (RGBA16F).',
} as const satisfies Messages;
