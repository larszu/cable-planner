// ───────────────────────────────────────────────────────────────────────────
// DAS AUSTAUSCHFORMAT `avplan-rack-belegung` — was der Plan in ein Rack
// gebaut hat, für das Lager.
//
// NUTZER, 2026-09-20: „Auch diese racks können ja racks in cases sein oder
// case Deckel haben. Dann sind es ja auch cases, wenn sie mobil sind."
//
// ─── WER WAS BESITZT ───────────────────────────────────────────────────────
//
// Das LEERE Rack gehört dem Lager: wie viele Höheneinheiten das Case hat, ist
// eine Eigenschaft des Gegenstands. Die BESTÜCKUNG gehört dem Signal-Plan
// (`cable-planner`, Rack-Builder): dort hängen Geräte, Ports und die interne
// Verkabelung daran. Das Lager darf kein Plan-Modell kennen (ADR-006), also
// reicht der Plan genau das herüber, was der Abgleich braucht — Höhe, Tiefe,
// und je Gerät Lage, Höhe und Name. Nicht mehr.
//
// Der Faden zwischen beiden Seiten ist `planRef`: die Kennung des Racks im
// Plan. Das Lager trägt sie am Case (`RackAusbau.planRef`) und sucht damit
// die Bestückung heraus.
//
// ─── HE WERDEN VON UNTEN GEZÄHLT ───────────────────────────────────────────
//
// Der Rack-Builder zählt `startUnit` von OBEN (HE 1 ist die oberste Zeile —
// so zeichnet er). Die Branche und das Lager zählen von UNTEN. Umgerechnet
// wird beim Schreiben, an genau einer Stelle, und im Format steht nur die
// untere Zählung. Eine Datei mit zwei möglichen Lesarten wäre eine Datei,
// in der jemand das Gerät an die falsche Stelle schraubt.
//
// ─── DIESE DATEI LIEGT ZEICHENGLEICH IN ZWEI REPOS ─────────────────────────
//
//   cable-planner      src/renderer/lib/rackBelegungFormat.ts   (schreibt)
//   inventory-planner  src/lib/rackBelegungFormat.ts            (liest)
//
// Keine Abhängigkeit, keine Uhr, kein Store. Eine Änderung hier ist eine
// Änderung in beiden — sonst schreibt die eine Seite, was die andere nicht
// liest. Der Vertragstest in beiden Repos friert Marker, Version und
// Feldnamen ein.
// ───────────────────────────────────────────────────────────────────────────

export const RACK_BELEGUNG_FORMAT = 'avplan-rack-belegung'
export const RACK_BELEGUNG_VERSION = 1

/** Ein Gerät im Rack. */
export interface RackBelegungsZeile {
  /** Unterste belegte HE, 1-basiert, von UNTEN gezählt. */
  startHE: number
  /** Belegte Höheneinheiten. */
  hoeheHE: number
  /** Was dort sitzt — der Gerätename im Plan. */
  label: string
  /** Nur Front-, nur Rückschiene oder beide. Fehlt: beide. */
  seite?: 'front' | 'rear' | 'full'
}

/** Ein Rack des Plans. */
export interface PlanRack {
  /** Die Kennung im Plan — der Faden zum Case im Lager. */
  planRef: string
  name: string
  /** Höheneinheiten, für die der Plan das Rack gebaut hat. */
  hoeheHE: number
  /** Tiefe, mit der der Plan rechnet, in mm — wenn er eine angibt. */
  tiefeMm?: number
  belegung: RackBelegungsZeile[]
}

export interface RackBelegungDatei {
  format: typeof RACK_BELEGUNG_FORMAT
  version: number
  app?: string
  exportedAt?: string
  racks: PlanRack[]
}

const ganz = (v: unknown, min: number): number | undefined =>
  typeof v === 'number' && Number.isInteger(v) && v >= min ? v : undefined

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined

const SEITEN = new Set(['front', 'rear', 'full'])

/**
 * Eine Zeile lesen. HALB ANGEGEBEN HEISST GAR NICHT: ein Gerät ohne Lage
 * oder ohne Höhe liesse sich nur geraten einzeichnen, und eine geratene
 * Lage sähe im Case aus wie eine geplante.
 */
function zeileLesen(raw: unknown): RackBelegungsZeile | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const startHE = ganz(r.startHE, 1)
  const hoeheHE = ganz(r.hoeheHE, 1)
  const label = text(r.label)
  if (startHE === undefined || hoeheHE === undefined || !label) return null
  const seite = typeof r.seite === 'string' && SEITEN.has(r.seite) ? (r.seite as RackBelegungsZeile['seite']) : undefined
  return { startHE, hoeheHE, label, ...(seite ? { seite } : {}) }
}

function rackLesen(raw: unknown): PlanRack | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const planRef = text(r.planRef)
  const name = text(r.name)
  const hoeheHE = ganz(r.hoeheHE, 1)
  if (!planRef || !name || hoeheHE === undefined) return null
  const tiefeMm = typeof r.tiefeMm === 'number' && Number.isFinite(r.tiefeMm) && r.tiefeMm > 0 ? r.tiefeMm : undefined
  const belegung = Array.isArray(r.belegung)
    ? r.belegung.map(zeileLesen).filter((z): z is RackBelegungsZeile => z !== null)
    : []
  return { planRef, name, hoeheHE, ...(tiefeMm ? { tiefeMm } : {}), belegung }
}

/** Die Datei schreiben. */
export function serializeRackBelegung(
  racks: readonly PlanRack[],
  opts: { app?: string; exportedAt?: string } = {},
): string {
  const datei: RackBelegungDatei = {
    format: RACK_BELEGUNG_FORMAT,
    version: RACK_BELEGUNG_VERSION,
    ...(opts.app ? { app: opts.app } : {}),
    ...(opts.exportedAt ? { exportedAt: opts.exportedAt } : {}),
    racks: [...racks],
  }
  return JSON.stringify(datei, null, 2)
}

/**
 * Die Datei lesen. `null` bei fremdem Format oder NEUERER Version: ein
 * älterer Stand liest nicht, was er nicht versteht, statt es halb zu lesen.
 */
export function parseRackBelegung(json: string): PlanRack[] | null {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const f = data as Partial<RackBelegungDatei>
  if (f.format !== RACK_BELEGUNG_FORMAT) return null
  if (typeof f.version !== 'number' || f.version > RACK_BELEGUNG_VERSION) return null
  if (!Array.isArray(f.racks)) return null
  return f.racks.map(rackLesen).filter((r): r is PlanRack => r !== null)
}
