// Hallenplan ↔ `venue-exchange` v1 (multicam-, light-planner).
//
// Der Austausch kennt nur EINEN Massstab je Achse (`widthMeters`/
// `heightMeters` ueber die Bildgroesse). Eine Vier-Punkt-Kalibrierung laesst
// sich darin nicht ausdruecken — sie wird nicht ausgegeben statt als
// Mittelwert, der auf einem schraegen Foto an jeder Stelle anders falsch
// waere.

import type { Grundriss } from '../../types/grundriss'
import { meterJePixel } from './massstab'
import { VENUE_EXCHANGE_KIND, VENUE_EXCHANGE_VERSION, type VenueExchange } from './venueExchange'

/**
 * Legt den Plan aus einer Austauschdatei mit seiner linken oberen Ecke auf
 * `ursprung`. Ein Bildpixel wird ein Canvas-Pixel breit; die Hoehe folgt dem
 * Massstab der Breite. MultiCam darf die Achsen verschieden skalieren, der
 * Canvas rechnet mit einem Massstab — also wird das Bild so gestreckt, dass
 * einer fuer beide gilt.
 */
export const grundrissAusVenue = (ex: VenueExchange, ursprung: { x: number; y: number }): Grundriss => {
  const fp = ex.venue.floorPlan
  if (!fp?.src) throw new Error('no-floor-plan')
  if (!(fp.naturalWidth > 0) || !(fp.widthMeters > 0) || !(fp.heightMeters > 0)) throw new Error('no-scale')
  const mJePx = fp.widthMeters / fp.naturalWidth
  const width = fp.naturalWidth
  const height = fp.heightMeters / mJePx
  const { floorPlan: _plan, ...fremd } = ex.venue
  void _plan
  return {
    src: fp.src,
    name: fp.name ?? ex.venue.name,
    naturalWidth: fp.naturalWidth,
    naturalHeight: fp.naturalHeight,
    x: ursprung.x,
    y: ursprung.y,
    width,
    height,
    deckkraft: fp.opacity > 0 ? fp.opacity : 0.6,
    gesperrt: fp.locked ?? true,
    kalibrierung: {
      art: 'zweiPunkt',
      a: { x: ursprung.x, y: ursprung.y },
      b: { x: ursprung.x + width, y: ursprung.y },
      meter: fp.widthMeters,
    },
    fremd,
    fremdVersatzM: { x: fp.offsetX ?? 0, y: fp.offsetY ?? 0 },
  }
}

/** `null`, wenn der Plan keinen einheitlichen Massstab hat. */
export const venueAusGrundriss = (
  g: Grundriss,
  app: string,
  appVersion: string,
  name: string,
  jetzt: Date,
): VenueExchange | null => {
  const mJePx = g.kalibrierung ? meterJePixel(g.kalibrierung) : null
  if (mJePx == null) return null
  const fremd = g.fremd ?? { name, persons: [], walls: [], stageObjects: [] }
  return {
    kind: VENUE_EXCHANGE_KIND,
    formatVersion: VENUE_EXCHANGE_VERSION,
    app,
    appVersion,
    exportedAt: jetzt.toISOString(),
    venue: {
      ...fremd,
      name: fremd.name || name,
      floorPlan: {
        src: g.src,
        name: g.name,
        naturalWidth: g.naturalWidth,
        naturalHeight: g.naturalHeight,
        widthMeters: g.width * mJePx,
        heightMeters: g.height * mJePx,
        offsetX: g.fremdVersatzM?.x ?? 0,
        offsetY: g.fremdVersatzM?.y ?? 0,
        opacity: g.deckkraft,
        locked: g.gesperrt,
        kind: 'image',
      },
    },
  }
}
