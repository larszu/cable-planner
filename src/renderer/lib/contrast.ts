/**
 * #451 — Lesbarer Vordergrund auf farbigem Hintergrund.
 *
 * Badges/Chips setzen ihren Hintergrund oft als Inline-Hex (Status-Farbe,
 * Gewerk-Farbe …). Eine fest verdrahtete dunkle Textfarbe (`#0f172a`) ist
 * auf gesättigten Tönen (Amber/Emerald) lesbar, kippt aber auf mittleren
 * Grautönen (z. B. slate-500 `#64748b`) unter die WCAG-Schwelle — und im
 * Light-Mode bleibt die Inline-BG-Farbe unverändert, also hilft das
 * Theme-Remapping hier nicht.
 *
 * `readableTextColor` wählt anhand der relativen Luminanz des Hintergrunds
 * automatisch helles oder dunkles Text-Token. Damit sind Inline-Badges in
 * Dark- *und* Light-Mode lesbar, ohne pro Fall zu raten.
 */

/** Dunkles Text-Token (slate-950) für helle Hintergründe. */
export const TEXT_ON_LIGHT = '#0f172a'
/** Helles Text-Token (slate-50) für dunkle/gesättigte Hintergründe. */
export const TEXT_ON_DARK = '#f8fafc'

const channelLuminance = (c: number): number => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** Relative Luminanz (WCAG) eines #rrggbb- oder #rgb-Strings, 0..1. */
export const relativeLuminance = (hex: string): number => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h
  if (full.length < 6) return 0
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

/**
 * Liefert das besser lesbare Text-Token (#0f172a oder #f8fafc) für einen
 * gegebenen Hintergrund-Hex. Schwelle 0.4 → mittlere Grautöne bekommen
 * hellen Text (statt dunklem, der dort durchfällt).
 */
export const readableTextColor = (bgHex: string): string =>
  relativeLuminance(bgHex) > 0.4 ? TEXT_ON_LIGHT : TEXT_ON_DARK
