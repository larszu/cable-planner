// ───────────────────────────────────────────────────────────────────────────
// BEDARF 10 — der laufende Ablauf, live, an der Kameraposition.
//
// Woertlich aus der Bedarfs-Datenbank (P1, Kamera, weit verbreitet, Stunden
// je Show):
//
//   > The current rundown, live, at the camera — with changes VISIBLY MARKED.
//
// Der Beleg: Buendel gedruckter Ablaufplaene, bei jeder Aenderung neu gedruckt
// und neu gemailt; am Produktionstag wird der Ausdruck von Hand annotiert; alles
// Uebrige kommt per Zuruf ueber die Kommandoanlage. ITV Studios hat die Buendel
// gegen iPads an jeder Kamera getauscht, damit das, was in der Regie getippt
// wird, sofort am Platz steht.
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE GRENZE, DIE DER BEDARF SELBST ZIEHT
// ═══════════════════════════════════════════════════════════════════════════
//
//   > DO NOT BUILD A RUNDOWN EDITOR — link segment IDs to positions.
//
// Der Ablauf gehoert der Redaktion. Er entsteht in einem Regieplan, einer
// Tabellenkalkulation, einem Sendeablauf-System — und wer ihn hier ein zweites
// Mal fuehrt, hat zwei Ablaeufe, von denen der falsche der neuere ist.
//
// Deshalb sind die Abschnitte hier GELESEN: sie tragen ihre Herkunft, ihren
// Stand und den Zeitpunkt des Einlesens. Was der Cable-Planner selbst besitzt,
// ist die ZUORDNUNG — welche Kameraposition in welchem Abschnitt was macht.
// Das ist die Frage, die kein Ablauf-System beantwortet, weil es die Positionen
// nicht kennt.
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE POSITION IST EINE ROLLE, KEIN GERAET
// ═══════════════════════════════════════════════════════════════════════════
//
// `SegmentCoverage.sourceId` zeigt auf eine `SourceIdentity` — „Kamera 1" —
// und nicht auf ein `EquipmentItem`. Das ist dieselbe Entscheidung wie in
// ADR-001 und aus demselben Grund: springt die Havarie-Kamera ein, bleibt der
// Auftrag derselbe. Haenge die Zuordnung am Blech, waere sie nach dem Tausch
// verschwunden — und zwar still, mitten in der Show.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Ein Abschnitt des Ablaufs, so wie er gelesen wurde.
 *
 * Bewusst arm: Nummer, Titel, Notiz. Alles, was ein Ablauf-System sonst noch
 * fuehrt (Sprecher, Einspieler, Timing), gehoert dorthin und nicht hierher —
 * es hier zu spiegeln hiesse, es hier zu pflegen.
 */
export interface RundownSegment {
  id: string
  /**
   * Die Nummer, wie sie auf dem Regieplan steht — als Zeichenkette, weil
   * Produktionen „3", „3a" und „VT 3" gleichermassen schreiben. Eine Zahl
   * daraus zu machen hiesse, „3a" zu verlieren oder zu erfinden.
   */
  number?: string
  title: string
  note?: string
}

/**
 * Was EINE Position in EINEM Abschnitt macht.
 *
 * Das ist der Teil, den dieses Programm besitzt — und der einzige.
 */
export interface SegmentCoverage {
  segmentId: string
  /** Die Rolle aus `sourceIdentities`, nicht das Geraet. Siehe Kopf. */
  sourceId: string
  /** Der Auftrag in einem Satz: „Totale Buehne", „Nah Moderation". */
  shot: string
  note?: string
}

/**
 * Der gelesene Ablauf samt Zuordnung.
 *
 * `source` und `revision` sind keine Zierde: die Karte am Platz sagt damit,
 * WELCHEN Stand sie zeigt. Eine Karte ohne diese Angabe sieht immer aktuell
 * aus, auch wenn sie drei Fassungen alt ist — und genau das ist der Zustand,
 * den der Bedarf beschreibt.
 */
export interface RundownPlan {
  /** Woher der Ablauf kommt. „Von Hand eingetragen" ist auch eine Herkunft. */
  source: string
  /** Der Stand, den die Quelle beim Einlesen trug, wenn sie einen nennt. */
  revision?: string
  /** Wann eingelesen (ISO). Gesetzt vom Aufrufer, nie von einer Uhr im Modell. */
  importedAt?: string
  segments: RundownSegment[]
  coverage: SegmentCoverage[]
}
