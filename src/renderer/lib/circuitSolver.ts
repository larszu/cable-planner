/**
 * Wer brennt, wenn Strom anliegt — Schaltbilder für Licht-Stromkreise
 * (Eigentümer-Wunsch vom 2026-09-08: „auch für Strom, Schaltungen darstellen
 * wo brennt eine Lampe wenn Strom anliegt, auch Wechselschaltungen und
 * Dimmer").
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAS DAS IST — UND VOR ALLEM, WAS ES NICHT IST
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Es ist ein SCHALTBILD-RECHNER: er sagt, welche Leuchte bei welcher
 * Schalterstellung brennt. Das ist genau die Frage, die ein Wechsel- oder
 * Kreuzschaltungs-Plan beantworten soll, und sie lässt sich exakt beantworten.
 *
 * Es ist **keine** elektrotechnische Berechnung und **kein** Sicherheitsnachweis.
 * Diese Datei rechnet keine Ströme, keine Leitungsquerschnitte, keine
 * Selektivität und keine Fehlerschleifenimpedanz. Wer sie dafür hält, hält
 * ein Übersichtsbild für eine Prüfung.
 *
 * DER RÜCKLEITER FEHLT ABSICHTLICH. Ein Schaltbild einer Wechselschaltung
 * zeigt den geschalteten Außenleiter; N und PE laufen daneben und werden nicht
 * geschaltet. Sie hier mitzuführen brächte kein anderes Ergebnis und verlangte
 * vom Nutzer, jede Leuchte doppelt zu verdrahten, bevor das Bild etwas zeigt.
 * Das ist eine VEREINFACHUNG mit Grund, keine Lücke — und sie steht hier,
 * damit sie beim nächsten Durchgang nicht als Fehler „behoben" wird.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM KLEMMEN UND NICHT „SCHALTER AN/AUS"
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Eine Wechselschaltung lässt sich nicht als Kette von An/Aus beschreiben:
 * zwei Schalter, und die Leuchte brennt, wenn beide auf DERSELBEN Seite
 * stehen — bei „Schalter A an, Schalter B an" ebenso wie bei „beide aus".
 * Wer sie als Kette baut, muss den Sonderfall von Hand einbauen, und der
 * Kreuzschalter in der Mitte macht daraus drei Sonderfälle.
 *
 * Deshalb bekommt jeder Knoten KLEMMEN, und seine Stellung sagt, welche
 * Klemmen innen miteinander verbunden sind. Der Strom sucht sich seinen Weg;
 * Wechsel- und Kreuzschaltung fallen dabei heraus, statt aufgezählt zu werden.
 * Eine vierte Schaltungsart braucht dann eine Zeile in `INNERE_VERBINDUNG`
 * und keinen neuen Zweig.
 */

/** Was ein Knoten im Stromkreis ist. */
export type CircuitKind =
  /** Einspeisung. Führt Spannung, wenn `on`. */
  | 'feed'
  /** Gewöhnlicher Aus-Schalter: Klemme 1 ↔ 2, wenn Stellung 1. */
  | 'switch'
  /** Wechselschalter: Klemme 0 (kommend) ↔ 1 oder 2, je nach Stellung. */
  | 'changeover'
  /** Kreuzschalter: tauscht die beiden durchlaufenden Adern in Stellung 2. */
  | 'crossover'
  /** Dimmer: leitet immer, und bestimmt die Helligkeit dahinter. */
  | 'dimmer'
  /** Leuchte. Brennt, wenn Spannung an Klemme 0 ankommt. */
  | 'lamp'
  /** Klemmstelle/Dose: alles, was hier ankommt, geht überall weiter. */
  | 'junction'

export interface CircuitNode {
  id: string
  kind: CircuitKind
  /**
   * Schalterstellung. `switch`: 1 = ein, sonst aus. `changeover`: 1 oder 2
   * (welche Korrespondierende). `crossover`: 1 = gerade, 2 = gekreuzt.
   * Bei `feed`: 1 = Spannung liegt an.
   */
  position?: number
  /** Nur `dimmer`: 0..100. Fehlt er, gilt 100 — ein Dimmer ohne Angabe dunkelt nicht. */
  levelPct?: number
}

export interface CircuitEdge {
  id: string
  fromNode: string
  /** Klemme am Quellknoten. Vorgabe 0. */
  fromTerminal?: number
  toNode: string
  toTerminal?: number
}

/**
 * Welche Klemmen ein Knoten in seiner Stellung innen verbindet.
 *
 * Als TABELLE mit `satisfies Record<CircuitKind, …>`: eine neue Bauart ohne
 * Eintrag ist ein Typfehler und keine still nicht leitende Stelle. Genau das
 * wäre der unangenehmste Fehler hier — eine Leuchte, die nicht brennt, sieht
 * aus wie eine richtige Antwort.
 *
 * Jeder Eintrag gibt Klemmen-PAARE zurück. `junction` ist der Sonderfall
 * „alles mit allem" und wird beim Auflösen gesondert behandelt, weil seine
 * Klemmenzahl erst aus den Kanten folgt.
 */
const INNERE_VERBINDUNG = {
  feed: () => [] as [number, number][],
  switch: (n: CircuitNode) => (n.position === 1 ? ([[1, 2]] as [number, number][]) : []),
  changeover: (n: CircuitNode) =>
    n.position === 2 ? ([[0, 2]] as [number, number][]) : ([[0, 1]] as [number, number][]),
  crossover: (n: CircuitNode) =>
    n.position === 2
      ? ([
          [1, 4],
          [2, 3],
        ] as [number, number][])
      : ([
          [1, 3],
          [2, 4],
        ] as [number, number][]),
  dimmer: () => [[1, 2]] as [number, number][],
  lamp: () => [] as [number, number][],
  junction: () => [] as [number, number][],
} satisfies Record<CircuitKind, (n: CircuitNode) => [number, number][]>

/** Helligkeit hinter einem Dimmer. Ohne Angabe volle Helligkeit. */
const dimmerPegel = (n: CircuitNode): number => {
  const roh = n.levelPct
  if (typeof roh !== 'number' || !Number.isFinite(roh)) return 100
  return Math.max(0, Math.min(100, roh))
}

export interface LampState {
  /** Kommt Spannung an? */
  lit: boolean
  /**
   * Helligkeit 0..100. Ohne Dimmer 100.
   *
   * Erreichen MEHRERE Wege die Leuchte, gilt der HELLSTE. Zwei parallele
   * Dimmer auf einer Leuchte ergeben nicht das Minimum, sondern das, was der
   * stärkere durchlässt — und `lit: true, levelPct: 0` ist ausdrücklich
   * erlaubt: ein auf null gefahrener Dimmer ist etwas anderes als ein
   * offener Schalter, und die Anzeige darf beides nicht verwechseln.
   */
  levelPct: number
}

export interface CircuitResult {
  lamps: Map<string, LampState>
  /** Kanten, auf denen Spannung liegt — für die Einfärbung im Canvas. */
  energisedEdges: Set<string>
}

const schluessel = (node: string, terminal: number) => `${node}#${terminal}`

/**
 * Den Stromkreis auflösen: wer brennt, und worüber.
 *
 * Ausbreitung von jeder eingeschalteten Einspeisung aus über Kanten und die
 * inneren Verbindungen der Knoten. Der Pegel wandert mit; ein Dimmer setzt
 * ihn herab, alles andere reicht ihn durch.
 *
 * Ein Knoten wird erneut besucht, wenn ihn ein HELLERER Pegel erreicht —
 * sonst gewänne bei zwei Wegen der zufällig zuerst gelaufene. Weil der Pegel
 * dabei nur steigen kann und nach oben begrenzt ist, endet das auch in einem
 * Netz mit Schleifen; eine Ringleitung ist im Hausnetz nichts Besonderes.
 */
export const solveCircuit = (
  nodes: readonly CircuitNode[],
  edges: readonly CircuitEdge[],
): CircuitResult => {
  const nachId = new Map(nodes.map((n) => [n.id, n]))
  /** Klemme → Kanten, die dort hängen. */
  const anKlemme = new Map<string, { edge: CircuitEdge; gegen: string; gegenNode: string }[]>()
  const haenge = (k: string, wert: { edge: CircuitEdge; gegen: string; gegenNode: string }) => {
    const liste = anKlemme.get(k)
    if (liste) liste.push(wert)
    else anKlemme.set(k, [wert])
  }
  for (const e of edges) {
    const a = schluessel(e.fromNode, e.fromTerminal ?? 0)
    const b = schluessel(e.toNode, e.toTerminal ?? 0)
    haenge(a, { edge: e, gegen: b, gegenNode: e.toNode })
    haenge(b, { edge: e, gegen: a, gegenNode: e.fromNode })
  }

  /** Klemmen eines Knotens, die in Kanten vorkommen — für `junction`. */
  const klemmenVon = new Map<string, Set<number>>()
  for (const e of edges) {
    const rein = (id: string, t: number) => {
      const s = klemmenVon.get(id)
      if (s) s.add(t)
      else klemmenVon.set(id, new Set([t]))
    }
    rein(e.fromNode, e.fromTerminal ?? 0)
    rein(e.toNode, e.toTerminal ?? 0)
  }

  const bester = new Map<string, number>()
  const energisedEdges = new Set<string>()
  const warteschlange: { klemme: string; pegel: number }[] = []

  const anbieten = (klemme: string, pegel: number) => {
    const bisher = bester.get(klemme)
    if (bisher !== undefined && bisher >= pegel) return
    bester.set(klemme, pegel)
    warteschlange.push({ klemme, pegel })
  }

  for (const n of nodes) {
    if (n.kind !== 'feed') continue
    if (n.position !== 1) continue
    // Die Einspeisung fuehrt Spannung an ihrer Klemme 0.
    anbieten(schluessel(n.id, 0), 100)
  }

  while (warteschlange.length) {
    const { klemme, pegel } = warteschlange.shift()!
    if ((bester.get(klemme) ?? -1) > pegel) continue

    // 1. Ueber die Kanten weiter.
    for (const { edge, gegen } of anKlemme.get(klemme) ?? []) {
      energisedEdges.add(edge.id)
      anbieten(gegen, pegel)
    }

    // 2. Durch den Knoten hindurch, gemaess seiner Stellung.
    const [nodeId, terminalRoh] = klemme.split('#')
    const terminal = Number(terminalRoh)
    const node = nachId.get(nodeId)
    if (!node) continue

    if (node.kind === 'junction') {
      for (const t of klemmenVon.get(nodeId) ?? []) {
        if (t !== terminal) anbieten(schluessel(nodeId, t), pegel)
      }
      continue
    }

    const durch = node.kind === 'dimmer' ? Math.round((pegel * dimmerPegel(node)) / 100) : pegel
    for (const [a, b] of INNERE_VERBINDUNG[node.kind](node)) {
      if (a === terminal) anbieten(schluessel(nodeId, b), durch)
      else if (b === terminal) anbieten(schluessel(nodeId, a), durch)
    }
  }

  const lamps = new Map<string, LampState>()
  for (const n of nodes) {
    if (n.kind !== 'lamp') continue
    const pegel = bester.get(schluessel(n.id, 0))
    lamps.set(n.id, pegel === undefined ? { lit: false, levelPct: 0 } : { lit: true, levelPct: pegel })
  }
  return { lamps, energisedEdges }
}
