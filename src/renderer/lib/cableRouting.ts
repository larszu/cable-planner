/**
 * Orthogonale Kabelführung um Geräte herum.
 *
 * Gegeben sind die beiden Endpunkte eines Kabels (bereits am Geräterand) und
 * die Rechtecke der Geräte; zurück kommen Zwischenpunkte, die einen
 * rechtwinkligen Weg ergeben, der durch KEIN Gerät läuft.
 *
 * ─── WAS AN DER ALTEN FASSUNG NICHT STIMMTE (2026-09-07) ───────────────────
 *
 * Nutzer-Meldung: „manche Basisfunktionen wie das Kabel automatisch Routen
 * funktionieren nicht sauber." Nachgesehen, drei Befunde, und der dritte ist
 * der eigentliche:
 *
 *  1. Der Umweg wurde um GENAU EIN Hindernis gerechnet — um das erste, das
 *     der HVH-Weg schnitt. Standen zwei Geräte hintereinander, führte der
 *     Umweg um das erste geradewegs ins zweite.
 *  2. Gesucht wurde das störende Gerät am HVH-Weg (`variants[2]`), obwohl
 *     bevorzugt der L-Weg (`variants[0]`) gezeichnet wird. Das störende
 *     Gerät konnte also ein anderes sein als das, an dem der gezeichnete Weg
 *     scheiterte.
 *  3. Und wenn gar nichts frei war, gab die Funktion „den kürzesten Umweg
 *     zurück, auch wenn er noch etwas streift" — WORTLOS. Das Ergebnis sah
 *     aus wie eine gelungene Führung, und das Kabel lief durch ein Gerät.
 *
 * Der dritte ist der teure: eine Funktion ohne Sprache für „ich konnte das
 * nicht" muss lügen. `routeAround` gibt deshalb `{ waypoints, clear }` zurück
 * — der Weg wird weiter geliefert (eine Kante ohne Weg wäre unsichtbar), aber
 * er ist als nicht frei GEKENNZEICHNET, und die Oberfläche kann es zeigen.
 *
 * REIN: keine Uhr, kein Store, kein IO.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** Abstand, den ein Umweg zum Gerät hält. */
const PADDING = 12

const inflate = (r: Rect, pad: number): Rect => ({
  x: r.x - pad,
  y: r.y - pad,
  width: r.width + pad * 2,
  height: r.height + pad * 2,
})

/**
 * Schneidet der (waagerechte oder senkrechte) Abschnitt das Rechteck?
 *
 * STRIKT: eine Linie, die genau auf der Kante entlangläuft, schneidet nicht.
 * Sonst wäre jeder Weg, der ein Gerät sauber tangiert, blockiert — und der
 * Umweg um ein Gerät läuft naturgemäß an dessen Kante entlang.
 */
const segmentIntersectsRect = (a: Point, b: Point, r: Rect): boolean => {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  return maxX > r.x && minX < r.x + r.width && maxY > r.y && minY < r.y + r.height
}

const pathClearsAll = (points: Point[], obstacles: Rect[]): boolean => {
  for (let i = 0; i < points.length - 1; i += 1) {
    for (const rect of obstacles) {
      if (segmentIntersectsRect(points[i], points[i + 1], rect)) return false
    }
  }
  return true
}

/**
 * Die vier einfachen Wege von A nach B.
 *
 * Die Reihenfolge ist Absicht: der L-Weg mit einem Knick steht vorn, weil er
 * beim Ziehen eines Geräts an beiden Enden haften bleibt. Die zweiknickigen
 * Wege springen bei jeder Pixelbewegung, und das war als „Flackern" sichtbar.
 */
const orthogonalVariants = (source: Point, target: Point): Point[][] => {
  const midX = (source.x + target.x) / 2
  const midY = (source.y + target.y) / 2
  return [
    [source, { x: target.x, y: source.y }, target],
    [source, { x: source.x, y: target.y }, target],
    [source, { x: midX, y: source.y }, { x: midX, y: target.y }, target],
    [source, { x: source.x, y: midY }, { x: target.x, y: midY }, target],
  ]
}

/** Die vier Umwege um EIN Rechteck: oben herum, unten herum, links, rechts. */
const detourAround = (source: Point, target: Point, rect: Rect): Point[][] => {
  const r = inflate(rect, PADDING)
  const oben = r.y
  const unten = r.y + r.height
  const links = r.x
  const rechts = r.x + r.width
  return [
    [source, { x: source.x, y: oben }, { x: target.x, y: oben }, target],
    [source, { x: source.x, y: unten }, { x: target.x, y: unten }, target],
    [source, { x: links, y: source.y }, { x: links, y: target.y }, target],
    [source, { x: rechts, y: source.y }, { x: rechts, y: target.y }, target],
  ]
}

const pathLength = (points: Point[]): number => {
  let total = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y)
  }
  return total
}

export interface RouteResult {
  /** Die Zwischenpunkte, ohne Anfang und Ende. */
  waypoints: Point[]
  /**
   * Läuft der Weg wirklich an allem vorbei?
   *
   * `false` heisst: es wurde keiner gefunden, der frei ist — geliefert wird
   * der kürzeste. Die Oberfläche soll das zeigen, statt eine Führung zu
   * behaupten, die durch ein Gerät läuft.
   */
  clear: boolean
}

const relevant = (
  obstacles: Rect[],
  ignoreIds?: Set<string>,
  obstacleIds?: string[],
): Rect[] =>
  obstacles.filter((_, i) => {
    const id = obstacleIds?.[i]
    if (!id) return true
    return !ignoreIds?.has(id)
  })

/**
 * Einen Weg von `source` nach `target` legen, der die Hindernisse meidet.
 *
 * ALLE Kandidaten werden gegen ALLE Hindernisse geprüft — die einfachen Wege
 * zuerst, dann die Umwege um jedes einzelne Hindernis, zuletzt der Umweg um
 * das umschliessende Rechteck aller Hindernisse. Der letzte ist der, der den
 * Fall „zwei Geräte hintereinander" löst: um beide herum statt zwischen sie
 * hinein.
 */
export const routeAround = (
  source: Point,
  target: Point,
  obstacles: Rect[],
  ignoreIds?: Set<string>,
  obstacleIds?: string[],
): RouteResult => {
  const hindernisse = relevant(obstacles, ignoreIds, obstacleIds)
  if (hindernisse.length === 0) return { waypoints: [], clear: true }

  const einfach = orthogonalVariants(source, target)
  const direkt = einfach.find((v) => pathClearsAll(v, hindernisse))
  if (direkt) return { waypoints: direkt.slice(1, -1), clear: true }

  // Umwege um JEDES Hindernis — und jeder Kandidat wird gegen ALLE Hindernisse
  // geprueft. Das ist der Unterschied zur alten Fassung: sie suchte ein
  // einziges stoerendes Geraet und fuhr um dieses herum, ohne den Umweg noch
  // einmal gegen die uebrigen zu halten. Standen zwei hintereinander, lief
  // der Umweg um das erste ins zweite.
  //
  // Ein zusaetzlicher Umweg um das umschliessende Rechteck ALLER Hindernisse
  // stand hier kurz und ist wieder heraus: keine Gegenprobe konnte ihn rot
  // faerben. Die Umwege um das oberste und unterste Hindernis fuehren
  // ohnehin an der ganzen Gruppe vorbei, und Code, den kein Test von seinem
  // Fehlen unterscheiden kann, ist nicht belegt.
  const kandidaten = hindernisse.flatMap((r) => detourAround(source, target, r))

  const freier = kandidaten.find((v) => pathClearsAll(v, hindernisse))
  if (freier) return { waypoints: freier.slice(1, -1), clear: true }

  // Nichts frei. Der kürzeste Kandidat wird geliefert — und als nicht frei
  // gekennzeichnet. Wortlos das Gleiche zu tun war der eigentliche Defekt.
  const alleWege = [...einfach, ...kandidaten].sort((a, b) => pathLength(a) - pathLength(b))
  return { waypoints: alleWege[0].slice(1, -1), clear: false }
}

/**
 * Laeuft der GEZEICHNETE Weg durch ein Geraet?
 *
 * `routeAround` beantwortet das fuer den Weg, den es selbst gerade gelegt hat
 * — und genau diese Antwort geht verloren, sobald der Weg einmal in
 * `cable.waypoints` gespeichert ist (#206 persistiert die automatische
 * Fuehrung nach dem ersten Rechnen). Ab da rechnet niemand mehr nach, und
 * eine Fuehrung, die durch ein Geraet laeuft, sieht aus wie eine gelungene.
 *
 * Diese Funktion prueft deshalb den Weg, der WIRKLICH GEZEICHNET WIRD, egal
 * woher seine Punkte stammen. Das deckt den zweiten Fall gleich mit ab: ein
 * von Hand gezogener Stuetzpunkt mitten durch ein Geraet ist derselbe Fehler
 * und war bisher ebenso stumm.
 */
export const pathIsBlocked = (
  points: readonly Point[],
  obstacles: Rect[],
  ignoreIds?: Set<string>,
  obstacleIds?: string[],
): boolean => !pathClearsAll([...points], relevant(obstacles, ignoreIds, obstacleIds))

/**
 * Nur die Zwischenpunkte — die Form, die der Canvas seit jeher aufruft.
 *
 * Bleibt bestehen, damit `CableEdge` nicht umgebaut werden muss; wer wissen
 * will, ob der Weg frei ist, ruft `routeAround`.
 */
export const computeObstacleAwareWaypoints = (
  source: Point,
  target: Point,
  obstacles: Rect[],
  ignoreIds?: Set<string>,
  obstacleIds?: string[],
): Point[] => routeAround(source, target, obstacles, ignoreIds, obstacleIds).waypoints
