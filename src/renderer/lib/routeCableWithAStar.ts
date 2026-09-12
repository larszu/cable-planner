/**
 * Adapter that turns my Cable + Equipment world into pathfinding input
 * and returns waypoints in flow-pixel coordinates that the existing
 * CableEdge can render.
 *
 * The adapter does NOT mutate the store. It is a pure function that
 * returns waypoints; the caller decides whether to write them back to
 * the cable.
 *
 * v7.9.32 — Obstacles werden inflated bevor sie an den Pathfinder gehen.
 * v7.9.37 — Source/Target werden jetzt AUCH als Obstacles mit Padding
 * in den Pathfinder gegeben. Vorher waren beide komplett ausgeschlossen,
 * was A* erlaubt hat den Pfad durch den Source/Target hindurch zu
 * optimieren (kürzer = mehr Cells, weniger Turns). Mit Padding + Korridor:
 *  - Source-Device + 40 px Padding sind hart blockiert
 *  - Korridor vom Handle nach außen (durch das eigene Padding) ist
 *    force-unblocked, damit der Pfad raus kommt
 *  - Stub-Endpunkt liegt jenseits des Paddings, damit A* dort frei
 *    weiterplanen kann
 *  - Pfad kann nie zurück durch den eigenen Body (auch nicht aus dem
 *    Padding)
 */

import {
  CELL_SIZE,
  computeEdgePath,
  type Rect,
} from './pathfinding'

export type HandleSide = 'left' | 'right' | 'top' | 'bottom'

/** Pixel-coordinate equipment rectangle used by the canvas obstacle
 *  builder. Kept as the public input shape so call-sites stay readable. */
export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
  id?: string
}

export interface RouteCableArgs {
  /** Flow-pixel position of the source handle. */
  source: { x: number; y: number }
  target: { x: number; y: number }
  sourceSide: HandleSide
  targetSide: HandleSide
  /** All equipment rectangles (in flow coordinates). Source/Target
   *  müssen in dieser Liste vorhanden sein UND ihre id muss source-/
   *  targetEquipmentId entsprechen, damit der Adapter sie als
   *  "Korridor erforderlich" markiert. */
  obstacles: PixelRect[]
  sourceEquipmentId: string
  targetEquipmentId: string
  /** v7.9.118 — Padding in Grid-Zellen um jedes Hindernis. Default 2
   *  (= 40 px) — angenehmer Abstand im Haupt-Canvas. In dichten Racks
   *  (mode='rack'), wo Geraete vertikal direkt aufeinander gestapelt
   *  sind, sperrt das den Korridor zwischen zwei benachbarten Geraeten
   *  komplett → A* loopt um das ganze Rack. Caller darf den Wert
   *  reduzieren (z.B. 0) um dichte Routen zuzulassen. */
  obstaclePadCells?: number
}

/** v7.9.32 — Sichtbare Lücke um jedes Hindernis. 2 Grid-Cells = 40 px. */
const OBSTACLE_PAD_CELLS = 2

// ReactFlow side → outward direction in pixel space (dx, dy).
const handleOutwardDelta = (side: HandleSide): { dx: number; dy: number } => {
  switch (side) {
    case 'right':  return { dx: 1, dy: 0 }
    case 'bottom': return { dx: 0, dy: 1 }
    case 'left':   return { dx: -1, dy: 0 }
    case 'top':    return { dx: 0, dy: -1 }
  }
}

const inflate = (r: PixelRect, pad: number): Rect => ({
  left: r.x - pad,
  top: r.y - pad,
  right: r.x + r.width + pad,
  bottom: r.y + r.height + pad,
  nodeId: r.id,
})

/** Compute force-open cells: ein Korridor vom Handle, einen Cell tief
 *  ins Source-Device hinein (damit der gerenderte erste Segment am
 *  Handle anschließt) PLUS OBSTACLE_PAD_CELLS Cells nach außen durch
 *  das eigene Padding. Ohne den Korridor wäre der Stub-Endpunkt in der
 *  Padding-Zone des Source-Devices selbst gefangen. */
const handleCorridor = (
  handlePx: { x: number; y: number },
  side: HandleSide,
  outwardCells: number,
): { gx: number; gy: number }[] => {
  const { dx, dy } = handleOutwardDelta(side)
  const baseGx = Math.round(handlePx.x / CELL_SIZE)
  const baseGy = Math.round(handlePx.y / CELL_SIZE)
  const cells: { gx: number; gy: number }[] = []
  for (let i = 0; i <= outwardCells; i++) {
    cells.push({ gx: baseGx + dx * i, gy: baseGy + dy * i })
  }
  return cells
}

/**
 * Ein Versuch mit EINER festen Abstands-Breite.
 *
 * Getrennt von `routeCableWithAStar`, weil der Abstand seit 2026-09-12 keine
 * Vorgabe mehr ist, sondern ein Wunsch: scheitert er, wird er kleiner
 * gemacht statt aufzugeben. Die Begruendung steht unten an der Leiter.
 *
 * EXPORTIERT, obwohl die Anwendung ihn nicht aufruft: sonst koennte kein
 * Waechter die Leiter belegen. `routeCableWithAStar` gibt seit der Leiter
 * immer einen Weg zurueck, wo frueher `null` stand — die Verbesserung ist von
 * aussen nur zu sehen, wenn man daneben halten kann, was EINE Sprosse allein
 * geschafft haette. `tests/autoRouteEinRouter.test.ts` tut genau das.
 */
export const versuchMitAbstand = (
  args: RouteCableArgs,
  padCells: number,
): { x: number; y: number }[] | null => {
  // v7.9.37 — ALLE Devices kommen mit Padding als Hard-Obstacles rein,
  // inklusive Source und Target. Damit kann A* den Pfad nicht mehr durch
  // den eigenen Source/Target-Body optimieren.
  const padPx = padCells * CELL_SIZE
  const obstacles: Rect[] = args.obstacles.map((r) => inflate(r, padPx))

  // Stub-Distanz: muss past dem eigenen Padding liegen, sonst sitzt
  // der A*-Startpunkt im blockierten Padding-Bereich fest.
  // Mind. 1 damit der Handle nicht unmittelbar im Padding-Bereich endet.
  const stubCells = Math.max(1, padCells + 1)

  // Korridor force-open: vom Handle nach außen durch das eigene Padding,
  // damit der gerenderte erste Segment (Handle → erstes Waypoint = Stub)
  // einen freien Weg hat und A* den Stub erreichen kann.
  const extraForceOpen = [
    ...handleCorridor(args.source, args.sourceSide, stubCells),
    ...handleCorridor(args.target, args.targetSide, stubCells),
  ]

  // Bei Top/Bottom-Handles weiß der Pathfinder nicht von "vertical stub" —
  // er kennt nur horizontale Stubs (links/rechts). Wir wählen die Stub-
  // Richtung anhand der relativen Source/Target-Position so dass der
  // Stub in Richtung Ziel zeigt, was meistens visuell sinnvoll ist.
  const sourceExitsRight =
    args.sourceSide === 'right'
      ? true
      : args.sourceSide === 'left'
        ? false
        : args.source.x <= args.target.x
  const targetEntersLeft =
    args.targetSide === 'left'
      ? true
      : args.targetSide === 'right'
        ? false
        : args.source.x <= args.target.x

  const arriveDir = handleArriveDir(args.targetSide)
  const freeEndDir = args.targetSide === 'top' || args.targetSide === 'bottom'
  const excludeEndDir = freeEndDir ? ((arriveDir + 2) % 4) : undefined

  // v7.9.65 / #188 — Verbiete dem A*-Solver direkt vom Stub-Cell aus
  // wieder ZURÜCK in Richtung Source zu laufen. Ohne diese Sperre konnte
  // der Pfad direkt am Stub wieder nach links umkehren (visuell: das
  // Kabel "knickt" gleich am Ausgang zurück). Mit excludeStartDir = 180°-
  // Gegenrichtung der Outward-Richtung muss der erste Move geradeaus
  // oder seitlich gehen.
  const outwardDirFor = (side: HandleSide): 0 | 1 | 2 | 3 => {
    switch (side) {
      case 'right':  return 0
      case 'bottom': return 1
      case 'left':   return 2
      case 'top':    return 3
    }
  }
  const excludeStartDir = (outwardDirFor(args.sourceSide) + 2) % 4

  const result = computeEdgePath({
    sourceX: args.source.x,
    sourceY: args.source.y,
    targetX: args.target.x,
    targetY: args.target.y,
    obstacles,
    sourceExitsRight,
    targetEntersLeft,
    freeEndDir,
    excludeEndDir,
    excludeStartDir,
    stubCells,
    extraForceOpen,
  })
  if (!result) return null

  // ─── DIE ACHSE DER BUCHSE GEWINNT ──────────────────────────────────────
  //
  // NUTZER-MELDUNG 2026-09-12: „Es gehen die Kabel manchmal noch etwas
  // unterhalb von dem Ziel-Port und dann wieder hoch, dann erst in den
  // Ziel-Port. Manchmal passieren auch Haken."
  //
  // BEIDES IST DERSELBE BEFUND. A* rechnet auf einem Gitter aus 20-px-Zellen
  // (`CELL_SIZE`); die Buchsen sitzen auf dem 11-px-Raster des Geraets
  // (`EQUIPMENT_LAYOUT.GRID_SIZE`, Port-Reihe 22 px). Die beiden Raster
  // treffen sich nie. Der Stuetzpunkt neben der Buchse liegt deshalb bis zu
  // eine halbe Zelle daneben, und der gezeichnete Weg muss den Rest als
  // kleine Stufe nachholen — unmittelbar vor der Buchse.
  //
  // Zeigt die Stufe in die Gegenrichtung des naechsten Abschnitts, wird aus
  // ihr ein Sporn, der aus der Linie heraussteht: der „Haken". Beispiel aus
  // der Messung, Quelle (340, 155) nach rechts:
  //
  //     …(380, 155) -> (380, 160) -> (380, 60)…
  //                     ^^^^^^^^^^ 5 px hinunter und sofort wieder hinauf
  //
  // GEMESSEN ueber 3300 Wege in 25 Raster-Szenen: die Stufe hatten 3300 von
  // 3300 an BEIDEN Enden (hier immer 3 px, weil alle Ziele dieselbe
  // Port-Reihe trafen), und 1972 Wege (59,8 %) trugen dadurch eine
  // Kehrtwende im gezeichneten Streckenzug.
  //
  // WAS HIER PASSIERT: der Stuetzpunkt NEBEN der Buchse bekommt deren Achse.
  // Nur dieser eine, und nur wenn der Abstand die Gitter-Rundung selbst ist
  // (weniger als eine halbe Zelle) — eine echte senkrechte Anfahrt bleibt
  // unberuehrt. Der Weg wird dadurch nicht laenger; die Stufe wandert vom
  // letzten Zentimeter vor der Buchse auf die Ecke davor, wo sie ohnehin
  // hingehoert.
  //
  // Nicht behoben ist damit die URSACHE — zwei Raster, die nicht aufeinander
  // passen. Das Gitter des Wegfinders auf 11 px zu stellen waere die andere
  // Antwort; sie kostet die dreifache Zellenzahl je Suche und ist nicht
  // gemessen.
  const aufAchse = (
    p: { x: number; y: number },
    buchse: { x: number; y: number },
    seite: HandleSide,
  ): { x: number; y: number } => {
    const waagerecht = seite === 'left' || seite === 'right'
    const abweichung = waagerecht ? Math.abs(p.y - buchse.y) : Math.abs(p.x - buchse.x)
    if (abweichung >= CELL_SIZE / 2) return p
    return waagerecht ? { x: p.x, y: buchse.y } : { x: buchse.x, y: p.y }
  }

  const inner = result.waypoints.slice(1, -1)
  if (inner.length > 0) {
    inner[0] = aufAchse(inner[0], args.source, args.sourceSide)
    inner[inner.length - 1] = aufAchse(inner[inner.length - 1], args.target, args.targetSide)
  }

  const out: { x: number; y: number }[] = []
  for (const p of inner) {
    const last = out[out.length - 1]
    if (!last || Math.abs(last.x - p.x) > 1 || Math.abs(last.y - p.y) > 1) out.push(p)
  }
  return out
}

/**
 * Der Weg um die Geraete herum — mit dem groesstmoeglichen Abstand, den es
 * hergibt.
 *
 * ─── WAS GEMELDET WURDE (Nutzer, 2026-09-12) ──────────────────────────────
 *
 * „Das automatisch Routen hat eine sehr umstaendliche und zu lange Route
 * genommen. Es haette nach rechts, dann nach oben und dann wieder nach rechts
 * gehen muessen, ist aber nach links, dann nach oben, dann nach rechts durch
 * ein Geraet durch […] gegangen."
 *
 * ─── WAS GEMESSEN WURDE ───────────────────────────────────────────────────
 *
 * Ueber 1188 Kabel-Paare in neun Raster-Szenen (drei Spalten- mal drei
 * Zeilen-Abstaende, je zwoelf Geraete mit vier Ein- und vier Ausgaengen):
 *
 *   kein Weg gefunden, Abstand 2 Zellen (40 px)     342 von 1188   (28,8 %)
 *   davon gerettet, sobald der Abstand 1 Zelle ist  342 von 342    (100 %)
 *   Wege, die danach durch ein Geraet laufen        0
 *
 * Und der Abstand kostet auch dort, wo er nicht scheitert: in der Wand-Szene
 * war derselbe Weg mit zwei Zellen Abstand Faktor 1,97 lang, mit einer 1,15.
 *
 * ─── WARUM DAS SCHLIMMER IST ALS EIN UMWEG ────────────────────────────────
 *
 * `null` heisst fuer den Aufrufer nicht „kein Weg" — es heisst „nimm den
 * anderen Router". `useCanvasCableRouter` setzt die Stuetzpunkte dann auf
 * `undefined`, und gezeichnet wird, was `routeAround` (`lib/cableRouting.ts`)
 * findet: vier einfache Formen und je vier Umwege um EIN Rechteck. Der gibt
 * ausdruecklich auch den kuerzesten NICHT-freien Weg zurueck, wenn keiner
 * frei ist — der laeuft dann durch ein Geraet. Genau das hat der Nutzer
 * gesehen, und zwar ohne dass irgendwo etwas gescheitert waere.
 *
 * ─── WAS SICH AENDERT ─────────────────────────────────────────────────────
 *
 * Der Abstand ist ein WUNSCH, keine Bedingung. Findet A* mit zwei Zellen
 * keinen Weg, wird der Wunsch kleiner: 2 -> 1 -> 0. Erst wenn auch ein Weg
 * direkt an der Geraetekante scheitert, gibt es wirklich keinen, und dann
 * darf der Aufrufer zurueckfallen.
 *
 * Ein enger Weg ist haesslicher als ein weiter. Ein Weg durch ein Geraet ist
 * falsch. Die Leiter tauscht das Erste gegen das Zweite und nicht umgekehrt.
 */
export const routeCableWithAStar = (
  args: RouteCableArgs,
): { x: number; y: number }[] | null => {
  // v7.9.118 — Padding-Zellen ueberschreibbar fuer Rack-Mode (default 2).
  // Der Wert ist ab hier die OBERSTE Sprosse der Leiter, nicht mehr die
  // einzige: der Rack-Mode faengt bei 0 an und hat damit genau eine.
  const wunsch =
    typeof args.obstaclePadCells === 'number' && args.obstaclePadCells >= 0
      ? Math.floor(args.obstaclePadCells)
      : OBSTACLE_PAD_CELLS

  for (let padCells = wunsch; padCells >= 0; padCells -= 1) {
    const weg = versuchMitAbstand(args, padCells)
    if (weg) return weg
  }
  return null
}

const handleArriveDir = (side: HandleSide): 0 | 1 | 2 | 3 => {
  // Direction the path arrives at the goal cell, in pathfinding's enum
  // (0=E, 1=S, 2=W, 3=N). Path travels INTO the device, so it's the
  // opposite of the handle's outward direction.
  switch (side) {
    case 'right':  return 2 // arrives going west
    case 'bottom': return 3 // arrives going north
    case 'left':   return 0 // arrives going east
    case 'top':    return 1 // arrives going south
  }
}

// Re-exported for callers that previously imported these from cableAStar.
export { CELL_SIZE }
