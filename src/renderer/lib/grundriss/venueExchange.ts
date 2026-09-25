// ───────────────────────────────────────────────────────────────────────────
// Venue-Austauschformat (`venue-exchange` v1)
//
// Domaenen-neutrales Format fuer den Raum/das Venue (Floor-Plan, Waende,
// Stage-Objekte, Personen, Venue-Masse) — der Teil, den MultiCam-, Light- und
// (perspektivisch) Cable-Planner gemeinsam haben. So kann man ein Venue in der
// einen App exportieren und in der anderen importieren, um z. B. im selben Raum
// Kameras UND Licht zu planen.
//
// Das Schema ist in jeder App identisch gehalten (Quelle: multicam-planner
// src/utils/venueExchange.ts, dort auch light-planner
// src/core/venueExchange.ts). Reine Daten, keine DOM-/Store-Abhaengigkeit →
// headless testbar.
// ───────────────────────────────────────────────────────────────────────────

export const VENUE_EXCHANGE_KIND = 'venue-exchange' as const
export const VENUE_EXCHANGE_VERSION = 1 as const

export interface VenueExchangePerson {
  id: string; x: number; y: number; height: number; label: string
  width?: number; objectType?: string; pose?: 'standing' | 'sitting'; facing?: number; color?: string
}
export interface VenueExchangeWall {
  id: string; x1: number; y1: number; x2: number; y2: number; height: number
  label?: string; cx?: number; cy?: number; reflectance?: number; color?: string
}
export interface VenueExchangeStageObject {
  id: string; x: number; y: number; width: number; height: number
  depth?: number; height2?: number; rotation?: number; points?: { x: number; y: number }[]; label?: string
}
export interface VenueExchangeFloorPlan {
  src: string; name?: string; naturalWidth: number; naturalHeight: number
  // Kanonisch: reale Masse (light-Form). MultiCams scaleX/scaleY werden hieraus abgeleitet.
  widthMeters: number; heightMeters: number
  offsetX: number; offsetY: number; opacity: number
  locked?: boolean; kind?: 'image' | 'pdf'; pageCount?: number; pageIndex?: number
}
export interface VenueExchange {
  kind: typeof VENUE_EXCHANGE_KIND
  formatVersion: typeof VENUE_EXCHANGE_VERSION
  app: string
  appVersion: string
  exportedAt: string
  venue: {
    name: string
    widthM?: number
    heightM?: number
    persons: VenueExchangePerson[]
    walls: VenueExchangeWall[]
    stageObjects: VenueExchangeStageObject[]
    floorPlan?: VenueExchangeFloorPlan
  }
}

export function parseVenueExchange(text: string): VenueExchange {
  const data = JSON.parse(text) as Partial<VenueExchange>
  if (!data || data.kind !== VENUE_EXCHANGE_KIND) {
    throw new Error('Keine gültige Venue-Austauschdatei (kind != venue-exchange).')
  }
  if (data.formatVersion !== VENUE_EXCHANGE_VERSION) {
    throw new Error(`Nicht unterstützte Venue-Austausch-Version: ${data.formatVersion}`)
  }
  if (!data.venue) throw new Error('Venue-Austauschdatei ohne venue-Block.')
  return data as VenueExchange
}
