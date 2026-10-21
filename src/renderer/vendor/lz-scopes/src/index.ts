// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Library entry for hosts that embed LZ Scopes (lz-camera-bridge, cable-planner).
export { ScopeView, setScopesLang, type ScopeViewOptions } from './embed';
export type { Lang } from './i18n';
export { Source, type SourceSettings, type StreamInfo } from './sources';
export { PATTERNS, RESOLUTIONS, patternById, renderPattern, type PatternDef } from './patterns';
export { SCOPE_LABELS, type ScopeType, type Unit } from './graticule';
export * as color from './color';
