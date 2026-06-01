// #443 — Breakpoint-Strategie (JS-Seite).
//
// Die App war faktisch Desktop-only: 0 @media-Queries, nur vereinzelte
// Tailwind-Breakpoint-Utilities. Pixel-getriebene Layouts (z. B. das
// Haupt-Grid in App.tsx mit gespeicherten Panel-Breiten) lassen sich nicht
// rein per CSS umschalten — dafür braucht es einen reaktiven Viewport-Wert.
//
// KONVENTION — Breakpoints spiegeln Tailwinds Defaults, damit CSS- und
// JS-Seite dieselben Schwellen nutzen:
//   sm 640 · md 768 · lg 1024 · xl 1280 · 2xl 1536
//
// Verwendung:
//   const w = useViewportWidth()              // reaktive Breite in px
//   const narrow = useIsNarrow()              // < lg (1024) → kompakt-Layout
//   const belowMd = useBelowBreakpoint('md')  // < 768
import { useSyncExternalStore } from 'react'

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type BreakpointName = keyof typeof BREAKPOINTS

// useSyncExternalStore-Store: ein einziger resize-Listener, geteilt über
// alle Aufrufer. getSnapshot liefert die aktuelle Fensterbreite.
const subscribe = (onChange: () => void): (() => void) => {
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}
const getSnapshot = (): number => window.innerWidth
// SSR/Headless: Desktop-Breite annehmen, damit serverseitig nichts kollabiert.
const getServerSnapshot = (): number => 1280

/** Reaktive Viewport-Breite in px (rerendert bei resize). */
export const useViewportWidth = (): number =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

/** true, wenn die Viewport-Breite unter dem genannten Breakpoint liegt. */
export const useBelowBreakpoint = (bp: BreakpointName): boolean =>
  useViewportWidth() < BREAKPOINTS[bp]

/** Komfort-Flag: schmales Fenster (< lg / 1024px) → kompaktes Layout,
 *  Seiten-Panels einklappen, Dialoge stapeln. */
export const useIsNarrow = (): boolean => useBelowBreakpoint('lg')
