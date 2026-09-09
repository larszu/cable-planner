// ───────────────────────────────────────────────────────────────────────────
// „Automatische Vorschläge machen etc" (#666, dritter Satz).
//
// #666 hat drei Sätze. Zwei sind gebaut: Schaltungen mit Prüfung
// (`circuitSolver`) und die Leuchte, die auf dem Plan bei richtiger Verkabelung
// angeht. Der dritte war offen — und er ist der heikelste, weil ein Vorschlag
// zur Verkabelung einer Leuchte wie eine Auskunft aussieht.
//
// ═══════════════════════════════════════════════════════════════════════════
// JEDER VORSCHLAG IST NACHGERECHNET, KEINER IST GERATEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Dieses Modul rät nicht, welche Klemme wohin gehört. Es SUCHT: es probiert
// fehlende Verbindungen durch, lässt `solveCircuit` über alle Schalterstellungen
// laufen und behält nur, was die Schaltung danach wirklich in Ordnung bringt.
// Ein Vorschlag, der die Prüfung nicht besteht, wird nicht ausgegeben — es gibt
// hier keinen Zweig, der eine Verkabelung „nach Erfahrung" empfiehlt.
//
// Und jeder Vorschlag bringt seinen Beleg mit: die Wahrheitstafel der Leuchte
// nach der Änderung, Stellung für Stellung. Wer den Vorschlag übernimmt, kann
// vorher nachsehen, statt zu vertrauen. Ohne die Tafel wäre das Ergebnis ein
// Ratschlag; mit ihr ist es ein Nachweis.
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS „IN ORDNUNG" HEISST — UND WARUM „SIE BRENNT" NICHT REICHT
// ═══════════════════════════════════════════════════════════════════════════
//
// Die naheliegende Prüfung wäre SCHALTBAR: einmal an, einmal aus. Sie ist zu
// schwach, und zwar an genau der Stelle, um die es in #666 geht. Eine
// Wechselschaltung, der die zweite Korrespondierende fehlt, ist schaltbar — sie
// brennt, wenn beide Schalter auf 1 stehen, und sonst nicht. Im Schaltbild
// sieht das richtig aus; im Flur tut der zweite Schalter nichts, sobald der
// erste unten steht.
//
// Geprüft wird deshalb die Eigenschaft, die eine Wechselschaltung ausmacht:
// **jeder Bedienschalter muss die Leuchte in JEDER Stellung der anderen
// umschalten.** Für einen einzelnen Aus-Schalter ist das dasselbe wie
// „schaltbar"; für Wechsel- und Kreuzschaltung ist es der Unterschied zwischen
// „geht" und „geht meistens".
//
// ═══════════════════════════════════════════════════════════════════════════
// WAS DAS MODUL NICHT TUT
// ═══════════════════════════════════════════════════════════════════════════
//
// Es ÜBERNIMMT NICHTS. Die Funktion ist rein und gibt Vorschläge zurück; das
// Eintragen ist ein Griff des Nutzers. Eine Automatik, die selbst verdrahtet,
// hätte genau die Eigenschaft, die dieser Plan nirgends haben soll: sie sähe
// hinterher aus wie eine Angabe des Planers.
//
// Es NIMMT AUCH NICHTS WEG. Die Suche legt nur Adern dazu. Es gibt deshalb
// Defekte, für die sie richtigerweise keinen Vorschlag hat — eine Leuchte, die
// in jeder Stellung brennt, wird von keiner zusätzlichen Ader dunkler. Dass es
// dafür keinen Vorschlag gibt, wird gesagt, statt als „nichts gefunden"
// auszugehen.
//
// Es rechnet WEITER KEINE Elektrotechnik. `circuitSolver` sagt in seiner
// eigenen Kopfzeile, dass er ein Schaltbild-Rechner ist und kein
// Sicherheitsnachweis; dieses Modul erbt das vollständig. Ein Vorschlag heisst
// „so brennt die Lampe bei der richtigen Stellung" und nicht „so darf gebaut
// werden".
//
// ═══════════════════════════════════════════════════════════════════════════
// KEINE STILLEN GRENZEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Die Suche ist begrenzt — sie muss es sein, sie probiert Kombinationen durch.
// Wo sie an eine Grenze stösst, sagt das Ergebnis es (`vollstaendig: false` mit
// Grund). Eine gekappte Suche, die wie eine erschöpfende aussieht, ist die
// schlechtere Hälfte von „keine Vorschläge gefunden": der Nutzer schliesst
// daraus, dass es keine Lösung gibt.
// ───────────────────────────────────────────────────────────────────────────
import {
  solveCircuit,
  type CircuitEdge,
  type CircuitKind,
  type CircuitNode,
} from './circuitSolver'
import { CIRCUIT_KIND_INFO } from '../types/circuit'

/**
 * Bauarten, die ein Mensch im Betrieb bedient — und deren Wirkung deshalb
 * geprüft wird.
 *
 * Die fünf anderen Kontakte aus B-52 Teil 2 (FI, LS, Not-Aus, Schütz, Relais)
 * stehen NICHT hier. Sie sind Betriebsmittel: dass die Leuchte nicht angeht,
 * wenn der LS ausgelöst hat, ist kein Verdrahtungsfehler. Sie werden für die
 * Prüfung LEITEND angenommen, und diese Annahme steht im Ergebnis, statt still
 * eingebaut zu sein — sonst meldete ein Kreis mit ausgelöstem FI jede
 * Verdrahtung als falsch.
 */
const BEDIENSCHALTER: ReadonlySet<CircuitKind> = new Set<CircuitKind>([
  'switch',
  'changeover',
  'crossover',
  'button',
])

/** Betriebsmittel: leitend angenommen, nicht durchgespielt. */
const BETRIEBSMITTEL: ReadonlySet<CircuitKind> = new Set<CircuitKind>([
  'contactor',
  'relay',
  'emergencyStop',
  'rcd',
  'mcb',
])

/** Die zwei Stellungen je Bedienschalter. */
const STELLUNGEN: Readonly<Record<string, readonly [number, number]>> = {
  switch: [1, 0],
  button: [1, 0],
  changeover: [1, 2],
  crossover: [1, 2],
}

/** Bauarten ohne feste Klemmenzahl — ihre Klemmen entstehen aus den Kanten. */
const KLEMMSTELLEN: ReadonlySet<CircuitKind> = new Set<CircuitKind>(['junction', 'distro'])

/**
 * Welche Klemmen eine Bauart hat.
 *
 * Gelesen aus `CIRCUIT_KIND_INFO` und NICHT hier ein zweites Mal
 * aufgeschrieben. Eine eigene Klemmen-Tabelle wäre die zweite Wahrheit, gegen
 * die ADR-001 geschrieben ist — und sie wäre besonders leise falsch: ein
 * Vorschlag auf eine Klemme, die es an dieser Bauart gar nicht gibt, sähe im
 * Ergebnis aus wie jeder andere.
 */
const klemmenVon = (kind: CircuitKind): readonly number[] => CIRCUIT_KIND_INFO[kind].klemmen

/** Grenzen der Suche. Werden sie überschritten, wird es GESAGT. */
export const GRENZEN = {
  /** Höchstzahl durchgespielter Stellungs-Kombinationen. */
  stellungen: 256,
  /** Höchstzahl freier Klemmen, aus denen Kandidaten gebildet werden. */
  klemmen: 40,
  /** Höchstzahl geprüfter Zwei-Adern-Kombinationen. */
  paare: 20_000,
} as const

export type BefundArt =
  | 'keine-einspeisung'
  | 'keine-spannung'
  | 'keine-leuchte'
  | 'mehrere-leuchten'
  | 'leuchte-ohne-anschluss'
  | 'ohne-schalter'
  | 'nie-an'
  | 'immer-an'
  | 'schalter-ohne-wirkung'

export interface Befund {
  art: BefundArt
  /** Betroffene Leuchte, wo der Befund eine betrifft. */
  lampeId?: string
  /** Betroffener Schalter, bei `schalter-ohne-wirkung`. */
  knotenId?: string
  text: string
}

/** Eine Ader, die der Vorschlag legen würde. */
export interface VorschlagsKante {
  fromNode: string
  fromTerminal: number
  toNode: string
  toTerminal: number
}

/** Eine Zeile der Wahrheitstafel: Stellungen → brennt die Leuchte? */
export interface TafelZeile {
  /** Knoten-Id → Stellung. */
  stellungen: Readonly<Record<string, number>>
  an: boolean
}

export interface Vorschlag {
  kanten: VorschlagsKante[]
  text: string
  /** Der Beleg. Ohne ihn wäre der Vorschlag ein Ratschlag. */
  wahrheitstafel: TafelZeile[]
}

export interface VorschlagsErgebnis {
  befunde: Befund[]
  vorschlaege: Vorschlag[]
  /** War die Suche erschöpfend? */
  vollstaendig: boolean
  /** Warum nicht, falls nicht. */
  grund?: string
  /** Annahmen, unter denen gerechnet wurde — immer sichtbar, nie stillschweigend. */
  annahmen: string[]
}

const schluessel = (node: string, terminal: number) => `${node}#${terminal}`

/** Alle belegten Klemmen aus den vorhandenen Kanten. */
const belegteKlemmen = (edges: readonly CircuitEdge[]): Set<string> => {
  const s = new Set<string>()
  for (const e of edges) {
    s.add(schluessel(e.fromNode, e.fromTerminal ?? 0))
    s.add(schluessel(e.toNode, e.toTerminal ?? 0))
  }
  return s
}

/** Die höchste an einem Knoten benutzte Klemmennummer, oder -1. */
const hoechsteKlemme = (edges: readonly CircuitEdge[], nodeId: string): number => {
  let max = -1
  for (const e of edges) {
    if (e.fromNode === nodeId) max = Math.max(max, e.fromTerminal ?? 0)
    if (e.toNode === nodeId) max = Math.max(max, e.toTerminal ?? 0)
  }
  return max
}

/**
 * Die Klemmen, an denen ein Vorschlag ansetzen darf.
 *
 * BELEGTE KLEMMEN BLEIBEN DRAUSSEN. Ein Vorschlag, der eine zweite Ader auf
 * eine schon belegte Schalterklemme legt, mag rechnerisch ein Ergebnis liefern
 * — auf der Klemme ist dafür kein Platz, und ein Vorschlag, den man nicht bauen
 * kann, ist schlimmer als keiner.
 *
 * Klemmstellen bekommen GENAU EINE frische Klemme.
 *
 * Zwei standen hier zwischendurch, mit der Begründung, an einer Dose dürften
 * zwei neue Adern zusammenkommen. Das stimmt — nur ändert es an dieser Suche
 * nichts, und die Gegenprobe hat es gezeigt: mit einer statt zwei Klemmen blieb
 * jeder Test grün. Der Grund ist die Suchtiefe. Wer zwei neue Adern an
 * DERSELBEN Dose braucht, verbindet damit zwei Klemmen, die sich genauso
 * direkt verbinden lassen — und dieser direkte Kandidat steht ohnehin in der
 * Liste. Nötig wäre die zweite Klemme erst bei drei Adern, und so tief sucht
 * hier nichts.
 *
 * Sie steht deshalb nicht mehr da. Eine Regel, die keine Gegenprobe rot
 * bekommt, ist keine Regel, sondern eine Vermutung mit Codegewicht.
 */
const freieKlemmen = (
  nodes: readonly CircuitNode[],
  edges: readonly CircuitEdge[],
): { nodeId: string; terminal: number }[] => {
  const belegt = belegteKlemmen(edges)
  const frei: { nodeId: string; terminal: number }[] = []
  for (const n of nodes) {
    if (KLEMMSTELLEN.has(n.kind)) {
      frei.push({ nodeId: n.id, terminal: hoechsteKlemme(edges, n.id) + 1 })
      continue
    }
    for (const t of klemmenVon(n.kind)) {
      if (!belegt.has(schluessel(n.id, t))) frei.push({ nodeId: n.id, terminal: t })
    }
  }
  return frei
}

/** Die Bedienschalter des Kreises, in Reihenfolge der Knotenliste. */
const bedienschalter = (nodes: readonly CircuitNode[]): CircuitNode[] =>
  nodes.filter((n) => BEDIENSCHALTER.has(n.kind))

/**
 * Alle Stellungs-Kombinationen der Bedienschalter.
 *
 * Gekappt bei `GRENZEN.stellungen`; der Aufrufer erfährt es über
 * `vollstaendig: false`, statt eine halbe Tafel für eine ganze zu halten.
 */
const stellungsKombinationen = (
  schalter: readonly CircuitNode[],
): { kombinationen: Record<string, number>[]; gekappt: boolean } => {
  let kombinationen: Record<string, number>[] = [{}]
  for (const s of schalter) {
    const moeglich = STELLUNGEN[s.kind]
    const naechste: Record<string, number>[] = []
    for (const bisher of kombinationen) {
      for (const p of moeglich) naechste.push({ ...bisher, [s.id]: p })
    }
    if (naechste.length > GRENZEN.stellungen) return { kombinationen, gekappt: true }
    kombinationen = naechste
  }
  return { kombinationen, gekappt: false }
}

/**
 * Die Knoten mit einer Stellungs-Kombination belegt: Einspeisungen an,
 * Betriebsmittel leitend, Bedienschalter wie in der Kombination.
 */
const mitStellungen = (
  nodes: readonly CircuitNode[],
  stellungen: Readonly<Record<string, number>>,
): CircuitNode[] =>
  nodes.map((n) => {
    if (n.kind === 'feed' || BETRIEBSMITTEL.has(n.kind)) return { ...n, position: 1 }
    const p = stellungen[n.id]
    return p === undefined ? n : { ...n, position: p }
  })

/** Die Wahrheitstafel einer Leuchte über alle Stellungen. */
const wahrheitstafel = (
  nodes: readonly CircuitNode[],
  edges: readonly CircuitEdge[],
  lampeId: string,
  kombinationen: readonly Record<string, number>[],
): TafelZeile[] =>
  kombinationen.map((stellungen) => ({
    stellungen,
    an: solveCircuit(mitStellungen(nodes, stellungen), edges).lamps.get(lampeId)?.lit === true,
  }))

/**
 * Welche Bedienschalter NICHT in jeder Stellung der anderen umschalten.
 *
 * Das ist die Eigenschaft, die eine Wechselschaltung ausmacht. Ein Schalter,
 * der nur in manchen Stellungen der anderen wirkt, ist der Fall, den ein Blick
 * aufs Schaltbild nicht findet und ein Griff im Flur sofort.
 */
const schalterOhneWirkung = (
  tafel: readonly TafelZeile[],
  schalterIds: readonly string[],
): string[] =>
  schalterIds.filter((id) =>
    tafel.some((zeile) => {
      const gegenstueck = tafel.find(
        (x) =>
          x.stellungen[id] !== zeile.stellungen[id] &&
          schalterIds.every((s) => s === id || x.stellungen[s] === zeile.stellungen[s]),
      )
      // Kein Gegenstueck heisst: dieser Schalter hat in der Tafel nur eine
      // Stellung. Das ist kein Befund, sondern eine Tafel ohne Aussage.
      return gegenstueck !== undefined && gegenstueck.an === zeile.an
    }),
  )

/**
 * Was „in Ordnung" heisst.
 *
 * MIT Bedienschalter: jeder von ihnen schaltet die Leuchte in jeder Stellung
 * der anderen um. OHNE: die Leuchte muss überhaupt brennen — „schaltbar" wäre
 * dann unerreichbar, und es als Ziel zu setzen hiesse, jede Suche mit „nichts
 * gefunden" enden zu lassen.
 */
const zielErfuellt = (tafel: readonly TafelZeile[], schalterIds: readonly string[]): boolean =>
  schalterIds.length === 0
    ? tafel.some((z) => z.an)
    : schalterOhneWirkung(tafel, schalterIds).length === 0

const kantenText = (kanten: readonly VorschlagsKante[]): string =>
  kanten
    .map((k) => `${k.fromNode} Klemme ${k.fromTerminal} → ${k.toNode} Klemme ${k.toTerminal}`)
    .join(' und ')

let laufendeNummer = 0
/** Kanten-Id fuer die Probe. Nur intern; der Vorschlag traegt keine. */
const probeKante = (k: VorschlagsKante): CircuitEdge => ({
  id: `probe-${(laufendeNummer += 1)}`,
  fromNode: k.fromNode,
  fromTerminal: k.fromTerminal,
  toNode: k.toNode,
  toTerminal: k.toTerminal,
})

/**
 * Warum tut diese Schaltung nicht, was sie soll — und welche Ader würde es
 * ändern?
 *
 * Gibt Befunde und nachgerechnete Vorschläge zurück. Ohne `lampeId` wird die
 * einzige Leuchte des Kreises genommen; gibt es mehrere, sagt ein Befund, dass
 * eine benannt werden muss. Sich eine auszusuchen wäre die Antwort auf eine
 * andere Frage als die gestellte.
 */
export const schaltungsVorschlaege = (
  nodes: readonly CircuitNode[],
  edges: readonly CircuitEdge[],
  lampeId?: string,
): VorschlagsErgebnis => {
  const befunde: Befund[] = []
  const annahmen: string[] = []
  const fertig = (vorschlaege: Vorschlag[], grund?: string): VorschlagsErgebnis => ({
    befunde,
    vorschlaege,
    vollstaendig: grund === undefined,
    ...(grund === undefined ? {} : { grund }),
    annahmen,
  })

  const leuchten = nodes.filter((n) => n.kind === 'lamp')
  if (leuchten.length === 0) {
    befunde.push({ art: 'keine-leuchte', text: 'Der Stromkreis enthält keine Leuchte.' })
    return fertig([])
  }
  const ziel = lampeId ?? (leuchten.length === 1 ? leuchten[0].id : undefined)
  if (ziel === undefined) {
    befunde.push({
      art: 'mehrere-leuchten',
      text: `Der Stromkreis hat ${leuchten.length} Leuchten — welche geprüft werden soll, muss benannt werden.`,
    })
    return fertig([])
  }
  if (!leuchten.some((l) => l.id === ziel)) {
    befunde.push({ art: 'keine-leuchte', text: `Es gibt keine Leuchte „${ziel}".` })
    return fertig([])
  }

  const einspeisungen = nodes.filter((n) => n.kind === 'feed')
  if (einspeisungen.length === 0) {
    befunde.push({
      art: 'keine-einspeisung',
      text: 'Der Stromkreis hat keine Einspeisung — ohne sie brennt keine Leuchte, gleich wie verdrahtet wird.',
    })
    return fertig([])
  }
  if (!einspeisungen.some((n) => n.position === 1)) {
    befunde.push({
      art: 'keine-spannung',
      text: 'Keine Einspeisung steht auf „an". Für die Prüfung wird angenommen, dass Spannung anliegt.',
    })
  }
  // Immer angenommen und immer genannt: die Verdrahtungsfrage ist von der Frage
  // „ist eingeschaltet" unabhaengig, und beide zu vermischen hiesse, einen
  // ausgeschalteten Kreis als Verdrahtungsfehler zu melden.
  annahmen.push('Alle Einspeisungen führen Spannung.')
  if (nodes.some((n) => BETRIEBSMITTEL.has(n.kind))) {
    annahmen.push('FI, LS, Not-Aus, Schütz und Relais sind leitend angenommen.')
  }

  if (!belegteKlemmen(edges).has(schluessel(ziel, 0))) {
    befunde.push({
      art: 'leuchte-ohne-anschluss',
      lampeId: ziel,
      text: 'An der Leuchte hängt keine Ader.',
    })
  }

  const schalter = bedienschalter(nodes)
  const schalterIds = schalter.map((s) => s.id)
  if (schalterIds.length === 0) {
    befunde.push({
      art: 'ohne-schalter',
      text:
        'Der Stromkreis hat keinen Bedienschalter — eine Leuchte darin ist immer an oder ' +
        'immer aus. Geprüft wird deshalb nur, ob sie überhaupt brennt.',
    })
  }

  const { kombinationen, gekappt } = stellungsKombinationen(schalter)
  if (gekappt) {
    return fertig(
      [],
      `Mehr als ${GRENZEN.stellungen} Stellungs-Kombinationen — die Tafel wäre nicht mehr durchzurechnen.`,
    )
  }

  const tafelJetzt = wahrheitstafel(nodes, edges, ziel, kombinationen)
  if (zielErfuellt(tafelJetzt, schalterIds)) return fertig([])

  if (tafelJetzt.every((z) => z.an)) {
    // DIE SUCHE WIRD HIER GAR NICHT ERST GESTARTET, und das ist der Punkt.
    // Sie legt nur Adern DAZU, und eine zusaetzliche Ader kann eine Leuchte
    // niemals dunkler machen — jeder zusaetzliche Weg ist ein weiterer Weg, auf
    // dem Spannung ankommt. Liesse man sie trotzdem laufen, endete sie mit
    // „keine Vorschlaege gefunden", und das liest sich als „es gibt keine
    // Loesung". Es gibt eine; sie besteht im Wegnehmen, und das schlaegt dieses
    // Modul nicht vor.
    befunde.push({
      art: 'immer-an',
      lampeId: ziel,
      text:
        'Die Leuchte brennt in jeder Stellung — der Schalter liegt nicht im Weg. Das lässt ' +
        'sich nur durch Umlegen oder Entfernen einer Ader beheben, nicht durch eine ' +
        'zusätzliche; deshalb steht hier kein Vorschlag.',
    })
    return fertig([])
  }

  if (tafelJetzt.every((z) => !z.an)) {
    befunde.push({
      art: 'nie-an',
      lampeId: ziel,
      text:
        schalterIds.length === 0
          ? 'Die Leuchte brennt nicht.'
          : 'Die Leuchte brennt in keiner Stellung.',
    })
  } else {
    for (const id of schalterOhneWirkung(tafelJetzt, schalterIds)) {
      befunde.push({
        art: 'schalter-ohne-wirkung',
        lampeId: ziel,
        knotenId: id,
        text: `„${id}" schaltet die Leuchte nicht in jeder Stellung der anderen Schalter — im Flur heisst das: er wirkt manchmal nicht.`,
      })
    }
  }

  const frei = freieKlemmen(nodes, edges)
  if (frei.length > GRENZEN.klemmen) {
    return fertig(
      [],
      `${frei.length} freie Klemmen — mehr als die ${GRENZEN.klemmen}, die durchprobiert werden.`,
    )
  }

  // Kandidaten: jede Verbindung zwischen zwei freien Klemmen VERSCHIEDENER
  // Knoten. Eine Bruecke innerhalb eines Knotens waere keine Verdrahtung,
  // sondern eine Behauptung ueber sein Inneres.
  const kandidaten: VorschlagsKante[] = []
  for (let i = 0; i < frei.length; i += 1) {
    for (let j = i + 1; j < frei.length; j += 1) {
      if (frei[i].nodeId === frei[j].nodeId) continue
      kandidaten.push({
        fromNode: frei[i].nodeId,
        fromTerminal: frei[i].terminal,
        toNode: frei[j].nodeId,
        toTerminal: frei[j].terminal,
      })
    }
  }

  const einzeln: Vorschlag[] = []
  for (const k of kandidaten) {
    const tafel = wahrheitstafel(nodes, [...edges, probeKante(k)], ziel, kombinationen)
    if (zielErfuellt(tafel, schalterIds)) {
      einzeln.push({
        kanten: [k],
        text: `Eine Ader legen: ${kantenText([k])}.`,
        wahrheitstafel: tafel,
      })
    }
  }
  if (einzeln.length > 0) return fertig(einzeln)

  // Keine einzelne Ader reicht. Zwei — aber nur, solange es zu zaehlen ist.
  const paare = (kandidaten.length * (kandidaten.length - 1)) / 2
  if (paare > GRENZEN.paare) {
    return fertig(
      [],
      `Keine einzelne Ader genügt, und ${paare} Zweier-Kombinationen sind mehr als die ${GRENZEN.paare}, die geprüft werden.`,
    )
  }
  const doppelt: Vorschlag[] = []
  for (let i = 0; i < kandidaten.length; i += 1) {
    for (let j = i + 1; j < kandidaten.length; j += 1) {
      const a = kandidaten[i]
      const b = kandidaten[j]
      // Zwei Kandidaten, die dieselbe freie Klemme belegen, gehen nicht
      // zusammen — auf der Klemme ist Platz fuer eine Ader.
      const klemmen = new Set([
        schluessel(a.fromNode, a.fromTerminal),
        schluessel(a.toNode, a.toTerminal),
        schluessel(b.fromNode, b.fromTerminal),
        schluessel(b.toNode, b.toTerminal),
      ])
      if (klemmen.size < 4) continue
      const tafel = wahrheitstafel(
        nodes,
        [...edges, probeKante(a), probeKante(b)],
        ziel,
        kombinationen,
      )
      if (zielErfuellt(tafel, schalterIds)) {
        doppelt.push({
          kanten: [a, b],
          text: `Zwei Adern legen: ${kantenText([a, b])}.`,
          wahrheitstafel: tafel,
        })
      }
    }
  }
  return fertig(doppelt)
}
