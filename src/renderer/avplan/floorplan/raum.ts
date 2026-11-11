// @avplan/floorplan — Raum ueber den Grundriss hinaus: Deckenhoehe,
// Boden, Waende, Tribuenen- und Sitzbloecke, Videowaende. Quelle aller
// Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// Plan-Koordinaten wie ueberall: x nach rechts, y nach unten (Tiefe), Meter.
// Drehung in Grad im Uhrzeigersinn des Plans. Bei 0° blickt ein Sitzblock
// nach -y (zur Planoberkante, wo die Buehne meist steht) und eine Videowand
// zeigt ihre Bildflaeche nach +y.
//
// Alle Felder ausser Lage und Groesse sind optional: ein Planer, der sie
// nicht kennt, verliert nichts, und ein alter Stand bleibt gueltig.

export type RaumBoden = 'concrete' | 'wood' | 'carpet' | 'turf' | 'tiles' | 'stage'

export const RAUM_BOEDEN: readonly RaumBoden[] = ['concrete', 'wood', 'carpet', 'turf', 'tiles', 'stage']

/** Oberflaeche der Waende. `drape` ist schwarzer Buehnenmolton, wie er in
 *  Hallen vor die eigentliche Wand gehaengt wird. */
export type RaumWand = 'plaster' | 'concrete' | 'brick' | 'wood' | 'drape'

export const RAUM_WAENDE: readonly RaumWand[] = ['plaster', 'concrete', 'brick', 'wood', 'drape']

export interface VenueSeatingBlock {
  id: string
  label?: string
  /** Mitte der Grundflaeche. */
  x: number
  y: number
  /** Breite entlang der Reihen. */
  width: number
  rows: number
  /** Abstand Reihe zu Reihe, Vorgabe 0,9 m. */
  rowSpacingM?: number
  /** Platzbreite, Vorgabe 0,55 m. */
  seatWidthM?: number
  /** Steigung je Reihe, 0 = ebene Bestuhlung. */
  riseM?: number
  /** Hoehe der ersten Reihe ueber dem Boden (Oberrang). */
  baseHeightM?: number
  rotationDeg?: number
  /** Belegung 0..1, Vorgabe 0,85. */
  occupancy?: number
  /** Stehplaetze statt Sitzen (Innenraum beim Konzert). */
  standing?: boolean
}

export interface VenueVideoWall {
  id: string
  label?: string
  /** Mitte der Unterkante. */
  x: number
  y: number
  widthM: number
  heightM: number
  /** Unterkante ueber dem Boden. */
  bottomM?: number
  rotationDeg?: number
}

export interface RaumErweiterung {
  ceilingHeightM?: number
  floorMaterial?: RaumBoden
  wallMaterial?: RaumWand
  seatingBlocks?: VenueSeatingBlock[]
  videoWalls?: VenueVideoWall[]
}

export const SITZ_VORGABEN = {
  rowSpacingM: 0.9,
  seatWidthM: 0.55,
  riseM: 0,
  baseHeightM: 0,
  rotationDeg: 0,
  occupancy: 0.85,
} as const

const zahl = (v: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback
  return Math.min(max, Math.max(min, n))
}

const winkel = (v: unknown): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0
  return ((n % 360) + 360) % 360
}

/** Sitzblock mit allen Vorgaben und in sinnvollen Grenzen. */
export function sitzblockNormal(b: VenueSeatingBlock): Required<Omit<VenueSeatingBlock, 'label'>> & { label: string } {
  return {
    id: b.id,
    label: b.label ?? '',
    x: zahl(b.x, 0, -1e4, 1e4),
    y: zahl(b.y, 0, -1e4, 1e4),
    width: zahl(b.width, 10, 0.5, 2000),
    rows: Math.round(zahl(b.rows, 10, 1, 200)),
    rowSpacingM: zahl(b.rowSpacingM, SITZ_VORGABEN.rowSpacingM, 0.4, 3),
    seatWidthM: zahl(b.seatWidthM, SITZ_VORGABEN.seatWidthM, 0.35, 2),
    riseM: zahl(b.riseM, SITZ_VORGABEN.riseM, 0, 1.5),
    baseHeightM: zahl(b.baseHeightM, SITZ_VORGABEN.baseHeightM, 0, 80),
    rotationDeg: winkel(b.rotationDeg),
    occupancy: zahl(b.occupancy, SITZ_VORGABEN.occupancy, 0, 1),
    standing: !!b.standing,
  }
}

export function videowandNormal(w: VenueVideoWall): Required<Omit<VenueVideoWall, 'label'>> & { label: string } {
  return {
    id: w.id,
    label: w.label ?? '',
    x: zahl(w.x, 0, -1e4, 1e4),
    y: zahl(w.y, 0, -1e4, 1e4),
    widthM: zahl(w.widthM, 6, 0.2, 400),
    heightM: zahl(w.heightM, 3.375, 0.2, 200),
    bottomM: zahl(w.bottomM, 1, 0, 200),
    rotationDeg: winkel(w.rotationDeg),
  }
}

/** Tiefe der Grundflaeche: Reihen mal Reihenabstand. */
export function sitzblockTiefe(b: VenueSeatingBlock): number {
  const n = sitzblockNormal(b)
  return n.rows * n.rowSpacingM
}

/** Plaetze, wenn jeder belegt waere. */
export function sitzblockPlaetze(b: VenueSeatingBlock): number {
  const n = sitzblockNormal(b)
  return n.rows * Math.max(1, Math.floor(n.width / n.seatWidthM))
}

/** Lokale Koordinaten (u entlang der Reihe, v nach hinten) → Plan. */
export function sitzblockPunkt(b: VenueSeatingBlock, u: number, v: number): { x: number; y: number } {
  const n = sitzblockNormal(b)
  const r = (n.rotationDeg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: n.x + u * c - v * s, y: n.y + u * s + v * c }
}

/** Ecken der Grundflaeche im Uhrzeigersinn ab vorn links. */
export function sitzblockEcken(b: VenueSeatingBlock): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const n = sitzblockNormal(b)
  const hw = n.width / 2
  const hd = sitzblockTiefe(b) / 2
  return [sitzblockPunkt(b, -hw, -hd), sitzblockPunkt(b, hw, -hd), sitzblockPunkt(b, hw, hd), sitzblockPunkt(b, -hw, hd)]
}

export interface Platz {
  x: number
  y: number
  /** Sitzhoehe (Oberkante der Stufe) ueber dem Boden. */
  z: number
  /** Blickrichtung in Grad im Plan, 0 = +x. */
  blickDeg: number
  reihe: number
  /** Deterministisch 0..1 je Platz — fuer Farbe, Groesse, Haltung. */
  r: number
  belegt: boolean
}

const GANG_ALLE = 14
const GANG_BREITE = 1.1

function zufall(i: number, j: number, k: number): number {
  let h = (i * 374761393 + j * 668265263 + k * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function idZahl(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Plaetze eines Sitzblocks, Reihe fuer Reihe, mit einem Gang alle vierzehn
 * Plaetze. Bei Stehplaetzen kein Raster, sondern lockere Streuung in
 * derselben Dichte — ein Innenraum steht nicht in Reihen.
 */
export function sitzblockPlaetzeListe(b: VenueSeatingBlock): Platz[] {
  const n = sitzblockNormal(b)
  const seed = idZahl(n.id)
  const out: Platz[] = []
  const blickDeg = n.rotationDeg - 90
  const hw = n.width / 2
  if (n.standing) {
    const tiefe = n.rows * n.rowSpacingM
    const anzahl = Math.round((n.width * tiefe) / (n.seatWidthM * n.rowSpacingM))
    for (let i = 0; i < anzahl; i++) {
      const u = (zufall(i, seed, 1) - 0.5) * n.width
      const v = (zufall(i, seed, 2) - 0.5) * tiefe
      const p = sitzblockPunkt(n, u, v)
      const r = zufall(i, seed, 3)
      out.push({ x: p.x, y: p.y, z: n.baseHeightM, blickDeg: blickDeg + (zufall(i, seed, 4) - 0.5) * 50, reihe: Math.floor((v + tiefe / 2) / n.rowSpacingM), r, belegt: zufall(i, seed, 5) < n.occupancy })
    }
    return out
  }
  const proReihe = Math.max(1, Math.floor(n.width / n.seatWidthM))
  const gaenge = proReihe > GANG_ALLE ? Math.floor((proReihe - 1) / GANG_ALLE) : 0
  const sitze = Math.max(1, Math.floor((n.width - gaenge * GANG_BREITE) / n.seatWidthM))
  const tiefe = n.rows * n.rowSpacingM
  for (let j = 0; j < n.rows; j++) {
    const v = -tiefe / 2 + (j + 0.55) * n.rowSpacingM
    const z = n.baseHeightM + j * n.riseM
    for (let i = 0; i < sitze; i++) {
      const gang = gaenge > 0 ? Math.floor(i / GANG_ALLE) : 0
      const u = -hw + (i + 0.5) * n.seatWidthM + gang * GANG_BREITE
      if (u > hw) break
      const p = sitzblockPunkt(n, u, v)
      const r = zufall(i, j, seed)
      out.push({ x: p.x, y: p.y, z, blickDeg, reihe: j, r, belegt: zufall(j, i, seed ^ 0x9e37) < n.occupancy })
    }
  }
  return out
}

/** Endpunkte der Unterkante einer Videowand im Plan. */
export function videowandEnden(w: VenueVideoWall): [{ x: number; y: number }, { x: number; y: number }] {
  const n = videowandNormal(w)
  const r = (n.rotationDeg * Math.PI) / 180
  const dx = (Math.cos(r) * n.widthM) / 2
  const dy = (Math.sin(r) * n.widthM) / 2
  return [{ x: n.x - dx, y: n.y - dy }, { x: n.x + dx, y: n.y + dy }]
}

/** Liest die Raum-Felder aus unbekannter Quelle; Unbrauchbares faellt weg. */
export function raumAus(roh: unknown): RaumErweiterung {
  if (!roh || typeof roh !== 'object') return {}
  const r = roh as Record<string, unknown>
  const out: RaumErweiterung = {}
  if (typeof r.ceilingHeightM === 'number' && Number.isFinite(r.ceilingHeightM) && r.ceilingHeightM > 0) out.ceilingHeightM = r.ceilingHeightM
  if (typeof r.floorMaterial === 'string' && (RAUM_BOEDEN as readonly string[]).includes(r.floorMaterial)) out.floorMaterial = r.floorMaterial as RaumBoden
  if (typeof r.wallMaterial === 'string' && (RAUM_WAENDE as readonly string[]).includes(r.wallMaterial)) out.wallMaterial = r.wallMaterial as RaumWand
  const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object'
  if (Array.isArray(r.seatingBlocks)) {
    out.seatingBlocks = r.seatingBlocks
      .filter(istObjekt)
      .filter((b) => typeof b.id === 'string' && typeof b.x === 'number' && typeof b.y === 'number')
      .map((b) => ({ ...(b as unknown as VenueSeatingBlock) }))
  }
  if (Array.isArray(r.videoWalls)) {
    out.videoWalls = r.videoWalls
      .filter(istObjekt)
      .filter((w) => typeof w.id === 'string' && typeof w.x === 'number' && typeof w.y === 'number')
      .map((w) => ({ ...(w as unknown as VenueVideoWall) }))
  }
  return out
}
