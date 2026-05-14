/// <reference types="vite/client" />

/** Build-time constants injected by `vite.config.ts` via `define`. They
 *  come from package.json so the renderer can show them in the About
 *  dialog and StatusBar without an IPC round-trip. */
declare const __APP_VERSION__: string
declare const __APP_DESCRIPTION__: string
declare const __APP_AUTHOR__: string
declare const __APP_BUILD_DATE__: string
