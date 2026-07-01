// ───────────────────────────────────────────────────────────────────────────
// Read-only Ansicht der fremden .avplan-Domaenen im Cable-Planner.
//
// Cables Canvas ist ein Signalfluss-Graph (nicht metrisch), daher werden die
// verlustfrei mitgefuehrten Domaenen (geteilter Raum + Kamera- + Licht-Planung)
// als kompakte read-only Uebersicht gezeigt — man kann alles EINSEHEN, ohne es
// hier zu bearbeiten. Die Domaenen sind `unknown` → alles defensiv, wirft nie.
// ───────────────────────────────────────────────────────────────────────────

export interface ForeignSummary {
  venueName?: string
  counts: { walls: number; persons: number; stage: number }
  cameras: { id: string; label: string }[]
  fixtures: { id: string; name?: string; purpose?: string; dimming?: number; colorTemp?: number }[]
}

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export type AvForeign = { venue?: unknown; cameras?: unknown; lighting?: unknown } | undefined

export function hasForeign(avForeign: AvForeign): boolean {
  if (!avForeign) return false
  const camCount = arr((avForeign.cameras as { cameras?: unknown } | undefined)?.cameras).length
  const fxCount = arr((avForeign.lighting as { fixtures?: unknown } | undefined)?.fixtures).length
  return camCount > 0 || fxCount > 0 || !!avForeign.venue
}

export function summarizeForeign(avForeign: AvForeign): ForeignSummary {
  const venue = avForeign?.venue as
    | { name?: unknown; walls?: unknown; persons?: unknown; stageObjects?: unknown }
    | undefined
  const cameras = arr((avForeign?.cameras as { cameras?: unknown } | undefined)?.cameras)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({ id: String(c.id ?? ''), label: str(c.label) ?? 'Kamera' }))
  const fixtures = arr((avForeign?.lighting as { fixtures?: unknown } | undefined)?.fixtures)
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({
      id: String(f.id ?? ''),
      name: str((f.fixture as { name?: unknown } | undefined)?.name),
      purpose: str(f.purpose),
      dimming: num(f.dimming),
      colorTemp: num(f.currentColorTemp),
    }))
  return {
    venueName: str(venue?.name),
    counts: {
      walls: arr(venue?.walls).length,
      persons: arr(venue?.persons).length,
      stage: arr(venue?.stageObjects).length,
    },
    cameras,
    fixtures,
  }
}
