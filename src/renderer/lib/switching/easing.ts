// ───────────────────────────────────────────────────────────────────────────
// Easing fuer Uebergaenge und Box-Fahrten (#1240, Stufe 3).
//
// Unveraendert aus lz-switcher-motion (src/shared/easing.ts, eigener Code,
// oeffentlich). Die Kurven muessen dort und hier gleich bleiben;
// tests/switchingSimulation.test.ts prueft Stuetzwerte.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Easing curves for box and DVE moves.
 *
 * The switcher's own "run to" moves are linear. Here every move is driven
 * frame by frame from the computer, so any curve is possible. Each function
 * maps progress t in [0, 1] to eased progress; all start at 0 and end at 1.
 * Back and elastic overshoot in between on purpose.
 */

export type EaseFamily =
  | 'linear'
  | 'sine'
  | 'quad'
  | 'cubic'
  | 'quart'
  | 'quint'
  | 'expo'
  | 'circ'
  | 'back'
  | 'elastic'
  | 'bounce'

export type EaseDirection = 'in' | 'out' | 'inOut'

export interface Easing {
  family: EaseFamily
  direction: EaseDirection
}

export const EASE_FAMILIES: EaseFamily[] = [
  'linear',
  'sine',
  'quad',
  'cubic',
  'quart',
  'quint',
  'expo',
  'circ',
  'back',
  'elastic',
  'bounce',
]

export const EASE_DIRECTIONS: EaseDirection[] = ['in', 'out', 'inOut']

export const DEFAULT_EASING: Easing = { family: 'cubic', direction: 'inOut' }

const BACK = 1.70158

function bounceOut(t: number): number {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

/** The "in" form of each family; "out" and "inOut" are derived from it. */
const IN: Record<EaseFamily, (t: number) => number> = {
  linear: (t) => t,
  sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  quad: (t) => t * t,
  cubic: (t) => t ** 3,
  quart: (t) => t ** 4,
  quint: (t) => t ** 5,
  expo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  circ: (t) => 1 - Math.sqrt(1 - t * t),
  back: (t) => (BACK + 1) * t ** 3 - BACK * t * t,
  elastic: (t) =>
    t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)),
  bounce: (t) => 1 - bounceOut(1 - t),
}

export function ease(e: Easing, t: number): number {
  const x = Math.min(1, Math.max(0, t))
  const fIn = IN[e.family]
  switch (e.direction) {
    case 'in':
      return fIn(x)
    case 'out':
      return 1 - fIn(1 - x)
    case 'inOut':
      return x < 0.5 ? fIn(2 * x) / 2 : 1 - fIn(2 - 2 * x) / 2
  }
}
