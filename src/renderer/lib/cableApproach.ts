/**
 * Die Anfahrt eines Kabels an das Geraet.
 *
 * ─── WAS GEMELDET WURDE (Nutzer, 2026-09-08) ──────────────────────────────
 *
 * „die kabel im canvas haben manchmal striche die hin und wieder zurueck
 * gehen und optisch wie ein strich der vom eigentlichen kabel ab geht
 * aussehen. das ist unpraktisch. […] zudem sind die pfeile manchmal schraeg.
 * die muessen immer gerade in die geraete gehen."
 *
 * ─── WAS GEMESSEN WURDE ───────────────────────────────────────────────────
 *
 * Nicht gezaehlt, wie viele Knicke ein Weg hat — gefragt, ob der gezeichnete
 * Streckenzug irgendwo eine KEHRTWENDE macht (zwei aufeinander folgende
 * Abschnitte auf derselben Achse in entgegengesetzter Richtung), und ob das
 * letzte Stueck ueberhaupt in die Richtung faehrt, in die der Anschluss zeigt.
 * Zwei getrennte Befunde, beide gross:
 *
 *  1. Der Zweig OHNE Stuetzpunkte (`buildPath`, alte Fassung) legte die
 *     Mittellinie stets auf die MITTE zwischen die beiden Stummel — ohne zu
 *     pruefen, ob diese Mitte ueberhaupt auf der Seite liegt, in die der
 *     Stummel zeigt. Zeigt sie es nicht, laeuft der Weg 18 px hinaus und
 *     sofort wieder darueber zurueck. Gemessen ueber 4x4 Anschlussseiten und
 *     25 Ziellagen: **312 von 400 Faellen mit Kehrtwende.** Genau das ist der
 *     „Strich, der vom eigentlichen Kabel abgeht": das Stueck Stummel, das
 *     hinter dem Pfeil stehen bleibt.
 *
 *  2. Der Zweig MIT Stuetzpunkten — und der laeuft in der Praxis fast immer,
 *     weil #206 die automatische Fuehrung nach dem ersten Rechnen in
 *     `cable.waypoints` speichert — setzte GAR KEINEN Stummel. Das letzte
 *     Stueck war das, was der Router zuletzt gelegt hatte. Gemessen ueber
 *     dieselbe Matrix: **192 von 256 Faellen fahren nicht in die Richtung, in
 *     die der Anschluss zeigt** — der Pfeil sticht von oben in eine Buchse,
 *     die nach links schaut. Das ist der „schraege Pfeil".
 *
 * ─── WAS DIESES MODUL ZUSICHERT ───────────────────────────────────────────
 *
 * `legeAnfahrt` liefert einen Streckenzug mit vier Eigenschaften:
 *
 *  A. Das erste Stueck faehrt gerade aus der Quelle heraus, in die Richtung,
 *     in die ihr Anschluss zeigt.
 *  B. Das letzte Stueck faehrt gerade in das Ziel hinein, entgegen der
 *     Richtung, in die dessen Anschluss zeigt. Der Pfeil sitzt auf diesem
 *     Stueck — damit steht er nie schraeg zum Geraet.
 *  C. Jeder Abschnitt ist waagerecht oder senkrecht.
 *  D. Ohne Stuetzpunkte: keine Kehrtwende. Die Form wird GEWAEHLT, nicht
 *     angenommen — aus einer geordneten Liste von Kandidaten wird der erste
 *     genommen, der C und D erfuellt. Die Reihenfolge behaelt das heutige
 *     Aussehen ueberall dort, wo es schon stimmt.
 *
 * Mit Stuetzpunkten gilt D NICHT, und das ist Absicht: wer einen Stuetzpunkt
 * von Hand hinter das Geraet zieht, will dort eine Schleife. A bis C gelten
 * auch dann — der Stummel wird vor den ersten und hinter den letzten
 * Stuetzpunkt gesetzt.
 *
 * REIN: keine Uhr, kein Store, kein IO, kein ReactFlow. Die Anschlussseite
 * kommt als eigenes Wort herein (`links`/`rechts`/`oben`/`unten`), damit das
 * Modul ohne Canvas pruefbar ist.
 */

import type { Point, Rect } from './cableRouting'

export type Anschlussseite = 'links' | 'rechts' | 'oben' | 'unten'

/** Wie weit der Weg gerade aus dem Anschluss heraussteht, bevor er abbiegt. */
export const ANFAHRT_STUMMEL = 18

/** Abstand, den eine Umfahrungs-Bahn zu allem haelt, was sie umfaehrt. */
const BAHN_ABSTAND = 24

/** Zwei Punkte gelten als derselbe, wenn sie naeher als das beieinander liegen. */
const TOLERANZ = 2

export const stummel = (punkt: Point, seite: Anschlussseite): Point => {
  switch (seite) {
    case 'links':
      return { x: punkt.x - ANFAHRT_STUMMEL, y: punkt.y }
    case 'rechts':
      return { x: punkt.x + ANFAHRT_STUMMEL, y: punkt.y }
    case 'oben':
      return { x: punkt.x, y: punkt.y - ANFAHRT_STUMMEL }
    case 'unten':
      return { x: punkt.x, y: punkt.y + ANFAHRT_STUMMEL }
  }
}

const waagerecht = (seite: Anschlussseite): boolean =>
  seite === 'links' || seite === 'rechts'

type Richtung = 'links' | 'rechts' | 'hoch' | 'runter'

const richtung = (a: Point, b: Point): Richtung | null => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null
  return Math.abs(dx) >= Math.abs(dy)
    ? dx > 0
      ? 'rechts'
      : 'links'
    : dy > 0
      ? 'runter'
      : 'hoch'
}

const GEGENTEIL: Record<Richtung, Richtung> = {
  links: 'rechts',
  rechts: 'links',
  hoch: 'runter',
  runter: 'hoch',
}

/**
 * Macht der Streckenzug irgendwo kehrt?
 *
 * Das ist die Frage hinter der Nutzer-Meldung, und deshalb steht sie hier als
 * eigene, exportierte Funktion: der Waechter prueft GENAU DAS, nicht die Zahl
 * der Knicke. Punkte, die auf demselben Fleck liegen, zaehlen nicht mit —
 * sonst waere jede eingesparte Ecke eine Kehrtwende.
 */
export const hatKehrtwende = (punkte: readonly Point[]): boolean => {
  const richtungen: Richtung[] = []
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const r = richtung(punkte[i], punkte[i + 1])
    if (r) richtungen.push(r)
  }
  for (let i = 0; i < richtungen.length - 1; i += 1) {
    if (richtungen[i + 1] === GEGENTEIL[richtungen[i]]) return true
  }
  return false
}

/** Liegt jeder Abschnitt auf einer Achse? */
export const istRechtwinklig = (punkte: readonly Point[]): boolean => {
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const dx = Math.abs(punkte[i + 1].x - punkte[i].x)
    const dy = Math.abs(punkte[i + 1].y - punkte[i].y)
    if (dx > TOLERANZ && dy > TOLERANZ) return false
  }
  return true
}

/** Punkte auf demselben Fleck zusammenfassen. */
const straffe = (punkte: Point[]): Point[] => {
  const raus: Point[] = []
  for (const p of punkte) {
    const letzter = raus[raus.length - 1]
    if (letzter && Math.abs(letzter.x - p.x) < 1 && Math.abs(letzter.y - p.y) < 1) continue
    raus.push(p)
  }
  return raus
}

interface Bahnen {
  links: number
  rechts: number
  oben: number
  unten: number
}

const bahnen = (punkte: Point[], meide: Rect[]): Bahnen => {
  const xs = punkte.map((p) => p.x)
  const ys = punkte.map((p) => p.y)
  for (const r of meide) {
    xs.push(r.x, r.x + r.width)
    ys.push(r.y, r.y + r.height)
  }
  return {
    links: Math.min(...xs) - BAHN_ABSTAND,
    rechts: Math.max(...xs) + BAHN_ABSTAND,
    oben: Math.min(...ys) - BAHN_ABSTAND,
    unten: Math.max(...ys) + BAHN_ABSTAND,
  }
}

/**
 * Die moeglichen Formen zwischen den beiden Stummeln.
 *
 * Alle sind rechtwinklig gebaut (jeder Nachbarpunkt teilt x oder y). Was sie
 * unterscheidet, ist die Kehrtwende — und die haengt an den Anschlussseiten,
 * nicht an der Form allein. Deshalb wird sie geprueft und nicht geraten.
 */
const formen = (
  sStummel: Point,
  tStummel: Point,
  b: Bahnen,
  jitter: number,
): Point[][] => {
  const mitteX = (sStummel.x + tStummel.x) / 2 + jitter
  const mitteY = (sStummel.y + tStummel.y) / 2 + jitter
  return [
    [],
    [{ x: tStummel.x, y: sStummel.y }],
    [{ x: sStummel.x, y: tStummel.y }],
    [
      { x: mitteX, y: sStummel.y },
      { x: mitteX, y: tStummel.y },
    ],
    [
      { x: sStummel.x, y: mitteY },
      { x: tStummel.x, y: mitteY },
    ],
    [
      { x: sStummel.x, y: b.oben },
      { x: tStummel.x, y: b.oben },
    ],
    [
      { x: sStummel.x, y: b.unten },
      { x: tStummel.x, y: b.unten },
    ],
    [
      { x: b.links, y: sStummel.y },
      { x: b.links, y: tStummel.y },
    ],
    [
      { x: b.rechts, y: sStummel.y },
      { x: b.rechts, y: tStummel.y },
    ],
  ]
}

/**
 * In welcher Reihenfolge die Formen probiert werden.
 *
 * Die Reihenfolge ist nicht Geschmack, sondern Bestandsschutz: sie beginnt
 * mit der Form, die die alte Fassung gezeichnet hat. Wo der alte Weg schon
 * stimmte, kommt derselbe wieder heraus; nur wo er kehrtmachte, wird
 * weitergesucht. Die vier Bahn-Formen stehen hinten und sind der Ausweg —
 * sie wechseln zwischen den Achsen und koennen deshalb keine Kehrtwende
 * enthalten.
 */
const reihenfolge = (sWaagerecht: boolean, tWaagerecht: boolean): number[] => {
  if (sWaagerecht && tWaagerecht) return [0, 3, 1, 2, 5, 6, 7, 8, 4]
  if (!sWaagerecht && !tWaagerecht) return [0, 4, 2, 1, 7, 8, 5, 6, 3]
  if (sWaagerecht) return [0, 1, 2, 3, 5, 6, 7, 8, 4]
  return [0, 2, 1, 4, 7, 8, 5, 6, 3]
}

/**
 * Eine Diagonale in eine Ecke aufloesen — und zwar so, dass die EINGEFUEGTE
 * Ecke keine Kehrtwende erzeugt.
 *
 * Die Unterscheidung ist der Kern: eine Kehrtwende zwischen zwei Punkten, die
 * der Nutzer selbst gesetzt hat, gehoert ihm — wer einen Stuetzpunkt hinter
 * das Geraet zieht, will die Schleife. Eine Kehrtwende zwischen einem seiner
 * Punkte und einer Ecke, die WIR dazwischengeschoben haben, gehoert uns.
 * Die alte Fassung (`normalizeOrthogonal` in `CableEdge.tsx`) nahm immer
 * zuerst die Waagerechte und erzeugte damit genau solche eigenen Kehrtwenden.
 *
 * Wo beide Ecken unauffaellig sind, bleibt es bei der Waagerechten zuerst —
 * das ist das gewohnte Bild, und es ohne Grund zu drehen hiesse, jedem
 * bestehenden Plan ein neues Aussehen zu geben.
 */
const eckeZwischen = (p: Point, q: Point, vorherige: Richtung | null): Point => {
  const waagerechtZuerst = { x: q.x, y: p.y }
  const senkrechtZuerst = { x: p.x, y: q.y }
  if (!vorherige) return waagerechtZuerst
  const machtKehrt = (ecke: Point): boolean => richtung(p, ecke) === GEGENTEIL[vorherige]
  if (machtKehrt(waagerechtZuerst) && !machtKehrt(senkrechtZuerst)) return senkrechtZuerst
  return waagerechtZuerst
}

const rechtwinkligMachen = (punkte: Point[]): Point[] => {
  if (punkte.length < 2) return punkte
  const raus: Point[] = [punkte[0]]
  let vorherige: Richtung | null = null
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const p = raus[raus.length - 1]
    const q = punkte[i + 1]
    const diagonal = Math.abs(q.x - p.x) > TOLERANZ && Math.abs(q.y - p.y) > TOLERANZ
    if (diagonal) {
      const ecke = eckeZwischen(p, q, vorherige)
      raus.push(ecke)
      vorherige = richtung(p, ecke) ?? vorherige
    }
    raus.push(q)
    vorherige = richtung(raus[raus.length - 2], q) ?? vorherige
  }
  return raus
}

export interface Anfahrt {
  quelle: Point
  quelleSeite: Anschlussseite
  ziel: Point
  zielSeite: Anschlussseite
  /** Stuetzpunkte zwischen den Geraeten — vom Router oder von Hand. */
  zwischen?: Point[]
  /** #53 — kleine Verschiebung der Mittellinie, damit zwei Kabel nicht deckungsgleich liegen. */
  jitter?: number
  /** Rechtecke, um die eine Bahn herumgelegt wird (die beiden beteiligten Geraete). */
  meide?: Rect[]
}

/**
 * Der vollstaendige Streckenzug, Quelle und Ziel eingeschlossen.
 *
 * Nie leer, nie kuerzer als zwei Punkte — eine Kante ohne Weg waere
 * unsichtbar, und eine unsichtbare Kante ist schlimmer als eine haessliche.
 */
export const legeAnfahrt = (a: Anfahrt): Point[] => {
  const sStummel = stummel(a.quelle, a.quelleSeite)
  const tStummel = stummel(a.ziel, a.zielSeite)
  const zwischen = a.zwischen ?? []

  if (zwischen.length > 0) {
    // Mit Stuetzpunkten: der Stummel kommt vor den ersten und hinter den
    // letzten. Die Kehrtwende wird hier NICHT verhindert — wer einen
    // Stuetzpunkt hinter das Geraet zieht, will die Schleife.
    return straffe(
      rechtwinkligMachen([a.quelle, sStummel, ...zwischen, tStummel, a.ziel]),
    )
  }

  const b = bahnen([a.quelle, a.ziel, sStummel, tStummel], a.meide ?? [])
  const kandidaten = formen(sStummel, tStummel, b, a.jitter ?? 0)
  const ordnung = reihenfolge(waagerecht(a.quelleSeite), waagerecht(a.zielSeite))

  let letzter: Point[] = []
  for (const i of ordnung) {
    const kette = straffe([a.quelle, sStummel, ...kandidaten[i], tStummel, a.ziel])
    letzter = kette
    if (istRechtwinklig(kette) && !hatKehrtwende(kette)) return kette
  }
  // Kommt hier nie an: die Bahn-Formen wechseln zwischen den Achsen. Der
  // Waechter `tests/kabelAnfahrt.test.ts` haelt das ueber die ganze Matrix
  // fest. Falls doch, wird gezeichnet statt geworfen — im Render ist eine
  // fehlende Kante der groessere Schaden.
  return letzter
}
