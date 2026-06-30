// ───────────────────────────────────────────────────────────────────────────
// .avplan — gemeinsames, VERLUSTFREIES Gesamtprojektformat fuer alle drei Apps
//
// Schema-identisch zu light-planner src/core/avplan.ts und multicam-planner
// src/utils/avplan.ts. Der Cable-Planner bearbeitet den "cabling"-Slot nativ
// und reicht den geteilten Raum (`venue`) plus "cameras"/"lighting" 1:1 durch —
// hier zusaetzlich im eigenen Projektfile aufbewahrt (CablePlannerProject.
// avForeign), damit auch ueber das native .cp-Speichern nichts verloren geht.
// ───────────────────────────────────────────────────────────────────────────

export const AVPLAN_KIND = 'avplan' as const
export const AVPLAN_VERSION = 1 as const

/** Geteilter Raum — gleiche Form wie das venue-exchange `.venue` der anderen Apps. */
export interface AvVenue {
  name: string
  widthM?: number
  heightM?: number
  persons: unknown[]
  walls: unknown[]
  stageObjects: unknown[]
  floorPlan?: unknown
}

export interface AvPlan {
  kind: typeof AVPLAN_KIND
  formatVersion: typeof AVPLAN_VERSION
  app: string
  appVersion: string
  exportedAt: string
  venue: AvVenue
  domains: {
    cameras?: unknown
    lighting?: unknown
    cabling?: unknown
  }
}

export function makeAvPlan(args: {
  app: string
  appVersion: string
  exportedAt: string
  venue: AvVenue
  domains: AvPlan['domains']
}): AvPlan {
  return {
    kind: AVPLAN_KIND,
    formatVersion: AVPLAN_VERSION,
    app: args.app,
    appVersion: args.appVersion,
    exportedAt: args.exportedAt,
    venue: args.venue,
    domains: { ...args.domains },
  }
}

export function parseAvPlan(text: string): AvPlan {
  const data = JSON.parse(text) as Partial<AvPlan>
  if (!data || data.kind !== AVPLAN_KIND) {
    throw new Error('Keine gueltige .avplan-Datei (kind != avplan).')
  }
  if (data.formatVersion !== AVPLAN_VERSION) {
    throw new Error(`Nicht unterstuetzte .avplan-Version: ${data.formatVersion}`)
  }
  if (!data.venue || !data.domains) throw new Error('.avplan ohne venue/domains.')
  return data as AvPlan
}

const EMPTY_VENUE: AvVenue = { name: 'Venue', persons: [], walls: [], stageObjects: [] }

/** Baut eine .avplan aus dem aktuellen Cable-Projekt. Der cabling-Slot ist das
 *  Projekt ohne sein avForeign-Feld (das wandert auf die Top-Ebene zurueck),
 *  geteilter Raum + Kamera-/Licht-Domaenen kommen aus dem bewahrten avForeign. */
export function cableToAvPlan(
  project: { avForeign?: { venue?: unknown; cameras?: unknown; lighting?: unknown } },
  meta: { appVersion: string; exportedAt: string },
): AvPlan {
  const { avForeign, ...cabling } = project
  return makeAvPlan({
    app: 'cable-planner',
    appVersion: meta.appVersion,
    exportedAt: meta.exportedAt,
    venue: (avForeign?.venue as AvVenue | undefined) ?? EMPTY_VENUE,
    domains: { cabling, cameras: avForeign?.cameras, lighting: avForeign?.lighting },
  })
}
