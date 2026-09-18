// ───────────────────────────────────────────────────────────────────────────
// Der LED-Wand-Rechner (#881).
//
// ─── WAS ER RECHNET UND WAS NICHT ──────────────────────────────────────────
//
// Er rechnet, was aus dem Raster folgt: Kachelzahl, Gesamtauflösung,
// Gesamtmass, Gewicht, Leistung, und ob die Ports der Sending Card die
// Pixelzahl tragen. Er entscheidet NICHT, wie die Wand verkabelt wird —
// welche Kachel an welchem Port hängt, ist eine Frage der Reihenfolge am
// Aufbau und nicht der Arithmetik.
//
// ─── DIE ZAHL, DIE NIE HERAUSKOMMT ─────────────────────────────────────────
//
// Eine Wand aus Panels ohne Gewichtsangabe wiegt nicht 0 kg — sie wiegt
// unbekannt viel. Gewicht und Leistung sind deshalb `number | undefined`,
// und `undefined` wird nirgends zu 0 gemacht. Eine gerechnete Traglast aus
// geschätzten Panelgewichten steht am Ende unter einer Traverse, an der
// Menschen vorbeigehen; eine gerechnete Stromlast steht auf einem
// Anschlussblatt.
//
// ─── UND WARUM DIE SPITZENLEISTUNG EIGEN STEHT ─────────────────────────────
//
// Die Dauerleistung ist die Zahl fürs Rechnen, die Spitzenleistung die fürs
// Absichern: eine LED-Wand zieht im Weissbild ein Vielfaches ihres Mittels,
// und eine Sicherung, die nach dem Mittel gewählt ist, fällt beim ersten
// Weissblitz. Wer nur eine der beiden hat, bekommt auch nur eine.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { LedPanelType, LedWall } from '../types/ledWall'

/** Wie viele Kacheln in eine Öffnung passen — und was übrig bleibt. */
export interface Raster {
  columns: number
  rows: number
  /** Was in der Breite nicht mehr aufgeht, in mm. */
  restBreiteMm: number
  /** Was in der Höhe nicht mehr aufgeht, in mm. */
  restHoeheMm: number
}

/**
 * Das Raster für eine gewünschte Wandfläche.
 *
 * ABGERUNDET und nicht gerundet: eine Kachel, die zur Hälfte in der Öffnung
 * steht, steht nicht in der Öffnung. Der Rest wird ausgewiesen, statt
 * stillschweigend zu verschwinden — er ist die Zahl, an der jemand
 * entscheidet, ob er die Wand mittig hängt oder die Öffnung ändert.
 */
export function rasterFuer(panel: LedPanelType, breiteMm: number, hoeheMm: number): Raster {
  const spalten = panel.sizeMm.w > 0 ? Math.floor(breiteMm / panel.sizeMm.w) : 0
  const reihen = panel.sizeMm.h > 0 ? Math.floor(hoeheMm / panel.sizeMm.h) : 0
  return {
    columns: Math.max(0, spalten),
    rows: Math.max(0, reihen),
    restBreiteMm: Math.max(0, breiteMm - Math.max(0, spalten) * panel.sizeMm.w),
    restHoeheMm: Math.max(0, hoeheMm - Math.max(0, reihen) * panel.sizeMm.h),
  }
}

/** Was eine aufgebaute Wand ist. */
export interface WandSumme {
  panels: number
  /** Gesamtauflösung in Pixeln. */
  pixels: { x: number; y: number }
  /** Gesamtzahl der Pixel — die Zahl, gegen die die Ports geprüft werden. */
  pixelGesamt: number
  /** Aussenmass in mm. */
  sizeMm: { w: number; h: number }
  /** Gesamtgewicht in kg. `undefined` heisst: der Typ trägt kein Gewicht. */
  weightKg?: number
  /** Dauerleistung in W. `undefined` heisst: der Typ trägt keine Leistung. */
  powerAvgW?: number
  /** Spitzenleistung in W — die Zahl fürs Absichern. */
  powerMaxW?: number
}

/** Die Summe einer Wand aus Typ und Raster. */
export function wandSumme(panel: LedPanelType, columns: number, rows: number): WandSumme {
  const spalten = Math.max(0, Math.floor(columns))
  const reihen = Math.max(0, Math.floor(rows))
  const panels = spalten * reihen
  const pixels = { x: spalten * panel.pixels.x, y: reihen * panel.pixels.y }
  return {
    panels,
    pixels,
    pixelGesamt: pixels.x * pixels.y,
    sizeMm: { w: spalten * panel.sizeMm.w, h: reihen * panel.sizeMm.h },
    // Multiplizieren, aber nie ersetzen: ohne Angabe am Typ bleibt die Summe
    // ohne Angabe. `(panel.weightKg ?? 0) * panels` wäre eine Zahl, die nach
    // einer Wiegung aussieht.
    weightKg: panel.weightKg === undefined ? undefined : +(panel.weightKg * panels).toFixed(2),
    powerAvgW: panel.powerAvgW === undefined ? undefined : Math.round(panel.powerAvgW * panels),
    powerMaxW: panel.powerMaxW === undefined ? undefined : Math.round(panel.powerMaxW * panels),
  }
}

/** Trägt die Ausspielung die Wand? */
export type PortUrteil =
  | { bekannt: false; grund: 'keine-angabe' }
  | {
      bekannt: true
      /** Wie viele Ports rechnerisch gebraucht werden. */
      gebraucht: number
      /** Wie viele da sind. */
      vorhanden: number
      reicht: boolean
      /** Wie viele Pixel bei gleichmässiger Aufteilung auf einen Port fallen. */
      pixelProPort: number
    }

/**
 * Reicht die Sending Card?
 *
 * Gerechnet wird die ZAHL der Ports, nicht ihre Belegung: welche Kachel an
 * welchem Port hängt, entscheidet der Aufbau. Was hier herauskommt, ist die
 * Frage davor — „reicht die Karte überhaupt".
 *
 * Ohne Angabe am Plan kommt `keine-angabe` und keine Entwarnung: eine Karte,
 * über die niemand etwas gesagt hat, trägt nicht unbegrenzt viel.
 */
export function portUrteil(summe: WandSumme, wand: LedWall): PortUrteil {
  const a = wand.ausspielung
  if (!a || !(a.ports > 0) || !(a.pixelProPort > 0)) return { bekannt: false, grund: 'keine-angabe' }
  const gebraucht = Math.ceil(summe.pixelGesamt / a.pixelProPort)
  return {
    bekannt: true,
    gebraucht,
    vorhanden: a.ports,
    reicht: gebraucht <= a.ports,
    pixelProPort: gebraucht > 0 ? Math.ceil(summe.pixelGesamt / Math.min(gebraucht, a.ports)) : 0,
  }
}

/** Eine Kachel in der Pixelmap. */
export interface MapKachel {
  column: number
  row: number
  /** Ursprung in Pixeln, oben links. */
  x: number
  y: number
  w: number
  h: number
  /** Laufende Nummer, zeilenweise ab oben links — wie man aufbaut. */
  nummer: number
}

/**
 * Die Pixelmap als Geometrie.
 *
 * IN PIXELN UND NICHT IN MILLIMETERN: das Bild, das am Medienserver
 * eingespielt wird, ist so gross wie die Wand Pixel hat — ein Bild in
 * Millimetern müsste jemand skalieren, und beim Skalieren einer Pixelmap
 * verschieben sich die Kanten, auf die es ankommt.
 *
 * Die Nummerierung läuft zeilenweise von oben links: das ist die Reihenfolge,
 * in der eine Wand aufgebaut wird, und damit die, in der jemand die Kacheln
 * auf dem Ausdruck sucht.
 */
export function pixelMap(panel: LedPanelType, columns: number, rows: number): MapKachel[] {
  const kacheln: MapKachel[] = []
  let nummer = 1
  for (let r = 0; r < Math.max(0, Math.floor(rows)); r += 1) {
    for (let c = 0; c < Math.max(0, Math.floor(columns)); c += 1) {
      kacheln.push({
        column: c + 1,
        row: r + 1,
        x: c * panel.pixels.x,
        y: r * panel.pixels.y,
        w: panel.pixels.x,
        h: panel.pixels.y,
        nummer,
      })
      nummer += 1
    }
  }
  return kacheln
}

/**
 * Die Pixelmap als SVG — dieselbe Geometrie, gezeichnet.
 *
 * SVG und nicht PNG, weil die Umrechnung ins Rasterbild dort passiert, wo es
 * einen Browser gibt (`<canvas>` in der Ansicht). Eine reine Funktion, die
 * ein PNG erzeugt, bräuchte eine Zeichenfläche — und damit die Umgebung, die
 * dieses Modul ausdrücklich nicht hat.
 */
export function pixelMapSvg(panel: LedPanelType, columns: number, rows: number): string {
  const summe = wandSumme(panel, columns, rows)
  const kacheln = pixelMap(panel, columns, rows)
  const grad = Math.max(8, Math.round(Math.min(panel.pixels.x, panel.pixels.y) * 0.25))
  const rahmen = kacheln
    .map(
      (k) =>
        `<rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" fill="none" stroke="#8C9CB3" stroke-width="1"/>` +
        `<text x="${k.x + k.w / 2}" y="${k.y + k.h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${grad}" fill="#8C9CB3">${k.nummer}</text>`,
    )
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${summe.pixels.x}" height="${summe.pixels.y}" ` +
    `viewBox="0 0 ${summe.pixels.x} ${summe.pixels.y}">` +
    `<rect width="${summe.pixels.x}" height="${summe.pixels.y}" fill="#132040"/>${rahmen}</svg>`
  )
}
