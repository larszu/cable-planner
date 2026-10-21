// @ts-nocheck -- vendort aus larszu/lz-scopes, dort geprueft (scripts/lz-scopes-vendor.mjs)
// Explicit hooks for stream sources that platform shells change (src/native/ios.ts), in the
// style of src/bridgeField.ts:
// - route:     where a stream URL is received. null = through the bridge (default). The iOS app
//              receives rtsp:// itself (#90) and answers with the URL of its loopback frame
//              server, which speaks the same frame protocol (docs/frame-protocol.md).
// - normalise: typed stream URL → stored URL (iOS: credentials go to the Keychain, the stored
//              URL keeps none).
// - adder:     main.ts binds "add a stream source" so a shell can open sources itself.

import type { SourceSettings } from './sources';

export type StreamRoute = (url: string, settings: SourceSettings) => Promise<string> | null;

let route: StreamRoute | null = null;
let normaliser: (url: string) => string = (u) => u;
let adder: ((url: string, name?: string) => void) | null = null;

export const streamRoute = {
  set: (r: StreamRoute | null) => { route = r; },
  /** ws URL promise when the shell receives this URL itself, else null */
  resolve: (url: string, settings: SourceSettings) => route?.(url, settings) ?? null,
  setNormaliser: (f: (url: string) => string) => { normaliser = f; },
  normalise: (url: string) => normaliser(url),
  bindAdder: (f: (url: string, name?: string) => void) => { adder = f; },
  add: (url: string, name?: string) => adder?.(url, name),
};
