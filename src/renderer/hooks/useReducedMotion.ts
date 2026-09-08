import { useSyncExternalStore } from 'react'

/**
 * Respektiert `prefers-reduced-motion` des Betriebssystems.
 *
 * WARUM ALS EIGENER HOOK und nicht als Feld in den Einstellungen: das sind
 * zwei verschiedene Aussagen. Die Einstellung sagt, was der Nutzer WILL; die
 * Systemeinstellung, was er VERTRAEGT. Sie in ein Feld zu ziehen hiesse, das
 * eine mit dem anderen zu ueberschreiben — und zwar in der falschen
 * Richtung, denn wer Bewegung im System abgestellt hat, hat das aus einem
 * Grund getan, den diese App nicht kennt.
 *
 * Deshalb gilt: Bewegung nur, wenn BEIDES zustimmt (`useCanvasMotion`).
 *
 * WARUM `useSyncExternalStore` UND NICHT `useState` + `useEffect`. Die
 * Media-Query IST ein externer Speicher; sie im Effekt in einen State zu
 * spiegeln heisst, beim ersten Bild noch den falschen Wert zu zeigen und
 * dann synchron nachzuziehen — genau das, was `react-hooks` als kaskadierendes
 * Rendern meldet. Hier liest der erste Render bereits den richtigen Wert.
 */
const abonniere = (an: () => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  // `addEventListener` gibt es auf `MediaQueryList` erst ab Safari 14; der
  // Fallback kostet drei Zeilen und erspart eine tote Einstellung.
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', an)
    return () => mq.removeEventListener('change', an)
  }
  mq.addListener(an)
  return () => mq.removeListener(an)
}

/**
 * Ohne `matchMedia` (Test-Umgebung, sehr alte Runtime) gilt „keine
 * Einschraenkung" — die Systemeinstellung ist dann nicht ermittelbar, und die
 * Vorgabe des Nutzers zu unterschlagen waere die schlechtere Annahme.
 */
const lies = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const useReducedMotion = (): boolean => useSyncExternalStore(abonniere, lies, () => false)
