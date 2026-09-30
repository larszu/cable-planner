// Library entry for hosts that embed LZ Scopes (lz-camera-bridge, cable-planner).
export { ScopeView, type ScopeViewOptions } from './embed';
export { Source, type SourceSettings, type StreamInfo } from './sources';
export { PATTERNS, RESOLUTIONS, patternById, renderPattern, type PatternDef } from './patterns';
export { SCOPE_LABELS, type ScopeType, type Unit } from './graticule';
export * as color from './color';
