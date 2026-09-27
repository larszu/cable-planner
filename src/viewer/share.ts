// #870 — Lese-Link: `viewer.html#share=<API-URL>`.
//
// Das Token steht im Fragment und geht deshalb nie an den Host dieser Seite
// (GitHub Pages); nur der Server, der den Link ausgestellt hat, sieht es.
// Angenommen wird nur https — ausser auf dem eigenen Rechner zum Entwickeln —,
// damit ein praeparierter Link den Plan nicht ueber Klartext-HTTP laedt.

export interface SharedPlan {
  format: 'avplan-share'
  version: 1
  name: string
  rev: number
  savedAt: string
  data: unknown
}

export const shareUrlFromHash = (hash: string): URL | null => {
  const raw = new URLSearchParams(hash.replace(/^#/, '')).get('share')
  if (!raw) return null
  try {
    const u = new URL(raw)
    const local = u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
    return u.protocol === 'https:' || local ? u : null
  } catch {
    return null
  }
}

export const isSharedPlan = (v: unknown): v is SharedPlan => {
  const s = v as Partial<SharedPlan> | null
  const d = s?.data as { equipment?: unknown; cables?: unknown } | undefined
  return s?.format === 'avplan-share' && Array.isArray(d?.equipment) && Array.isArray(d?.cables)
}

/** SQLite liefert `YYYY-MM-DD HH:MM:SS` in UTC ohne Zone. */
export const savedDate = (s: string): Date => new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`)
