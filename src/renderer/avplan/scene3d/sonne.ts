// Sonnen- und Mondstand aus Datum, Uhrzeit und Ort (suncalc).
//
// Richtung in Szenen-Konvention wie in allen Planern und in light-planners
// sun.ts: Plan-x = Welt-x, Plan-y = Welt-z, Hoehe = Welt-y; Plan-oben (−y,
// also Welt −z) ist Norden, solange `nordDeg` 0 ist. `nordDeg` sagt, wohin
// Norden im Grundriss zeigt, im Uhrzeigersinn von Plan-oben: 90 = Norden
// rechts (+x). Damit passt derselbe Projektwert in light-planner und hier.
//
// `datum` ist ein echter Zeitpunkt (Date, intern UTC) — die Zeitzone legt der
// Aufrufer fest, nicht eine Schaetzung aus der Laenge.
import * as THREE from 'three'
import SunCalc from 'suncalc'

const GRAD = 180 / Math.PI

export interface Ort {
  name: string
  lat: number
  lon: number
}

export type OrtArt = 'berlin' | 'hamburg' | 'muenchen' | 'koeln' | 'frankfurt' | 'leipzig' | 'stuttgart' | 'dresden'

export const ORTE: Record<OrtArt, Ort> = {
  berlin: { name: 'Berlin', lat: 52.52, lon: 13.405 },
  hamburg: { name: 'Hamburg', lat: 53.551, lon: 9.994 },
  muenchen: { name: 'München', lat: 48.137, lon: 11.575 },
  koeln: { name: 'Köln', lat: 50.938, lon: 6.96 },
  frankfurt: { name: 'Frankfurt am Main', lat: 50.11, lon: 8.682 },
  leipzig: { name: 'Leipzig', lat: 51.34, lon: 12.375 },
  stuttgart: { name: 'Stuttgart', lat: 48.776, lon: 9.183 },
  dresden: { name: 'Dresden', lat: 51.05, lon: 13.738 },
}

export interface HimmelsStand {
  /** Kompass: 0 = Nord, 90 = Ost, im Uhrzeigersinn. */
  azimutDeg: number
  /** Ueber dem Horizont positiv. */
  elevationDeg: number
  /** Einheitsvektor vom Boden zum Gestirn, Szenen-Konvention. */
  richtung: THREE.Vector3
}

export interface Mondstand extends HimmelsStand {
  /** 0 = Neumond, 0,25 = erstes Viertel, 0,5 = Vollmond, 0,75 = letztes Viertel. */
  phase: number
  /** Beleuchteter Anteil der Scheibe, 0..1. */
  beleuchtet: number
}

export function himmelsRichtung(azimutDeg: number, elevationDeg: number, nordDeg = 0, ziel = new THREE.Vector3()): THREE.Vector3 {
  const b = (nordDeg + azimutDeg) / GRAD
  const e = elevationDeg / GRAD
  return ziel.set(Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e))
}

// suncalc zaehlt den Azimut von Sueden nach Westen.
const kompass = (azimutSuedRad: number) => (((azimutSuedRad * GRAD + 180) % 360) + 360) % 360

export function sonnenstand(datum: Date, lat: number, lon: number, nordDeg = 0): HimmelsStand {
  const p = SunCalc.getPosition(datum, lat, lon)
  const azimutDeg = kompass(p.azimuth)
  const elevationDeg = p.altitude * GRAD
  return { azimutDeg, elevationDeg, richtung: himmelsRichtung(azimutDeg, elevationDeg, nordDeg) }
}

export function mondstand(datum: Date, lat: number, lon: number, nordDeg = 0): Mondstand {
  const p = SunCalc.getMoonPosition(datum, lat, lon)
  const l = SunCalc.getMoonIllumination(datum)
  const azimutDeg = kompass(p.azimuth)
  const elevationDeg = p.altitude * GRAD
  return {
    azimutDeg,
    elevationDeg,
    richtung: himmelsRichtung(azimutDeg, elevationDeg, nordDeg),
    phase: l.phase,
    beleuchtet: l.fraction,
  }
}

export type Tagesphase = 'tag' | 'goldene-stunde' | 'blaue-stunde' | 'daemmerung' | 'nacht'

/** Goldene Stunde −4° bis 6°, blaue Stunde −8° bis −4°, Daemmerung bis −18°. */
export function tagesphase(sonnenElevationDeg: number): Tagesphase {
  if (sonnenElevationDeg >= 6) return 'tag'
  if (sonnenElevationDeg >= -4) return 'goldene-stunde'
  if (sonnenElevationDeg >= -8) return 'blaue-stunde'
  if (sonnenElevationDeg >= -18) return 'daemmerung'
  return 'nacht'
}

export type Zeitraum = [beginn: Date, ende: Date] | null

export interface Sonnenzeiten {
  aufgang: Date | null
  untergang: Date | null
  mittag: Date
  goldeneStunde: { morgens: Zeitraum; abends: Zeitraum }
  blaueStunde: { morgens: Zeitraum; abends: Zeitraum }
  /** Polartag bzw. Polarnacht: kein Auf- und Untergang. */
  immerOben: boolean
  immerUnten: boolean
}

// suncalc fuehrt zusaetzliche Hoehen nur ueber eine globale Liste; einmal
// eintragen, sonst waechst sie bei jedem Import (HMR) weiter.
const ZUSATZ = '__avplanSonnenzeiten'
const sc = SunCalc as unknown as Record<string, unknown>
if (!sc[ZUSATZ]) {
  SunCalc.addTime(-4, 'avplanGold4Morgen', 'avplanGold4Abend')
  SunCalc.addTime(-8, 'avplanBlau8Morgen', 'avplanBlau8Abend')
  sc[ZUSATZ] = true
}

const gueltig = (d: Date | undefined): Date | null => (d && !Number.isNaN(d.getTime()) ? d : null)
const raum = (a: Date | undefined, b: Date | undefined): Zeitraum => {
  const x = gueltig(a)
  const y = gueltig(b)
  return x && y ? [x, y] : null
}

export function sonnenzeiten(datum: Date, lat: number, lon: number): Sonnenzeiten {
  const t = SunCalc.getTimes(datum, lat, lon) as unknown as Record<string, Date>
  const aufgang = gueltig(t.sunrise)
  const untergang = gueltig(t.sunset)
  const mittagsHoehe = sonnenstand(t.solarNoon, lat, lon).elevationDeg
  return {
    aufgang,
    untergang,
    mittag: t.solarNoon,
    goldeneStunde: { morgens: raum(t.avplanGold4Morgen, t.goldenHourEnd), abends: raum(t.goldenHour, t.avplanGold4Abend) },
    blaueStunde: { morgens: raum(t.avplanBlau8Morgen, t.avplanGold4Morgen), abends: raum(t.avplanGold4Abend, t.avplanBlau8Abend) },
    immerOben: !aufgang && !untergang && mittagsHoehe > 0,
    immerUnten: !aufgang && !untergang && mittagsHoehe <= 0,
  }
}
