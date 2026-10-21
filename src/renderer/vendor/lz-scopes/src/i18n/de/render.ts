// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Deutsche Übersetzung zu en/render.ts.
import type en from '../en/render';
import type { Translation } from '../types';

export default {
  'render.h264Format': 'H.264: Bildformat {fmt} nicht unterstützt',
  'render.unknown': 'unbekannt',
  'render.h264NeedsWebCodecs': 'H.264-Übertragung braucht WebCodecs (Chrome, Edge, Desktop-App) – auf „roh“ umstellen',
  'render.noWebgl2': 'WebGL2 wird von diesem Browser nicht unterstützt.',
  'render.noFloatTargets': 'EXT_color_buffer_float/EXT_color_buffer_half_float fehlt – Scopes brauchen Float-Rendertargets (RGBA16F).',
} satisfies Translation<typeof en>;
