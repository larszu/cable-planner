// ───────────────────────────────────────────────────────────────────────────
// #1204 — „Wegpunkt hier hinzufuegen" auf gerader Strecke.
//
// Gespeichert sind die Stuetzpunkte (`cable.waypoints`), GEZEICHNET wird aber
// mehr: `legeAnfahrt` setzt Stummel an die Geraete und macht aus jedem
// Abschnitt zwischen zwei Stuetzpunkten einen rechtwinkligen Zug mit eigenen
// Ecken. Die alte Einfuegung suchte den naechsten Abschnitt nur ZWISCHEN den
// Stuetzpunkten — die gerade Strecke von der Buchse zum ersten und vom
// letzten zur Buchse kam darin nicht vor, und mit einem einzigen Stuetzpunkt
// gab es gar keinen Abschnitt. Der neue Punkt landete dann am Anfang der
// Liste, und der Weg lief zurueck (im Browser nachgestellt: Klick auf die
// gerade Strecke hinter dem Knick ergab einen Zug, der kehrtmacht).
//
// Jetzt zaehlt die Lage ENTLANG DES GEZEICHNETEN WEGS: der Klick und jeder
// Stuetzpunkt werden auf den Streckenzug projiziert, und der neue Punkt kommt
// vor den ersten Stuetzpunkt, der weiter hinten liegt. Er sitzt auf dem Strich
// (die Projektion), nicht ein Pixel daneben — sonst entstuende ein Mini-Knick.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

export interface Punkt {
  x: number
  y: number
}

/** Naechster Punkt auf dem Streckenzug und seine Bogenlaenge ab dem Anfang. */
export const aufWeg = (weg: readonly Punkt[], p: Punkt): { punkt: Punkt; s: number; abstand: number } => {
  let best = { punkt: weg[0], s: 0, abstand: Infinity }
  let laenge = 0
  for (let i = 0; i < weg.length - 1; i++) {
    const a = weg[i]
    const b = weg[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    const seg = Math.sqrt(lenSq)
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
    const punkt = { x: a.x + t * dx, y: a.y + t * dy }
    const abstand = Math.hypot(p.x - punkt.x, p.y - punkt.y)
    if (abstand < best.abstand) best = { punkt, s: laenge + t * seg, abstand }
    laenge += seg
  }
  return best
}

/** Alte Regel fuer den Fall ohne gezeichneten Weg (gerade/geschwungene
 *  Fuehrung): naechster Abschnitt zwischen den Stuetzpunkten. */
const zwischenStuetzpunkten = (wps: readonly Punkt[], p: Punkt): Punkt[] => {
  if (wps.length === 0) return [p]
  if (wps.length === 1) return [...wps, p]
  const { s } = aufWeg(wps, p)
  return einreihen(wps, wps, p, s)
}

const einreihen = (wps: readonly Punkt[], weg: readonly Punkt[], p: Punkt, s: number): Punkt[] => {
  let index = wps.findIndex((w) => aufWeg(weg, w).s > s)
  if (index < 0) index = wps.length
  const next = wps.slice()
  next.splice(index, 0, p)
  return next
}

/**
 * Die Stuetzpunkte mit dem neuen Punkt an der richtigen Stelle.
 *
 * `weg` ist der gezeichnete Streckenzug (Quelle … Ziel). Fehlt er, gilt die
 * Reihenfolge der Stuetzpunkte allein.
 */
export const wegpunktEinfuegen = (wps: readonly Punkt[], weg: readonly Punkt[] | undefined, klick: Punkt): Punkt[] => {
  if (!weg || weg.length < 2) return zwischenStuetzpunkten(wps, klick)
  const k = aufWeg(weg, klick)
  const punkt = { x: Math.round(k.punkt.x), y: Math.round(k.punkt.y) }
  return einreihen(wps, weg, punkt, k.s)
}

// Der gezeichnete Weg je Kabel. Kein Projektzustand — eine Ableitung, die
// `CableEdge` beim Zeichnen hinterlegt und das Kontextmenue beim Klick liest.
const gezeichnet = new Map<string, Punkt[]>()
export const hinterlegeWeg = (cableId: string, weg: Punkt[]): void => {
  if (weg.length >= 2) gezeichnet.set(cableId, weg)
  else gezeichnet.delete(cableId)
}
export const vergissWeg = (cableId: string): void => {
  gezeichnet.delete(cableId)
}
export const gezeichneterWegVon = (cableId: string): Punkt[] | undefined => gezeichnet.get(cableId)
