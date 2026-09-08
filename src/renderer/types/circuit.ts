/**
 * Der Stromkreis als PLAN-Angabe (Eigentümer-Wunsch vom 2026-09-08:
 * „auch für Strom, Schaltungen darstellen wo brennt eine Lampe wenn Strom
 * anliegt, auch Wechselschaltungen und Dimmer").
 *
 * `lib/circuitSolver.ts` rechnet, wer brennt. Diese Datei sagt, WOHER er
 * seine Knoten und Kanten bekommt — und das ist die Entscheidung, an der
 * ein Schaltbild-Rechner nützlich oder gefährlich wird.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE BAUART WIRD ANGEGEBEN, NIE GERATEN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Es wäre naheliegend, die Bauart aus der Kategorie zu lesen: „Leuchte" →
 * `lamp`, „Wechselschalter" → `changeover`. Genau das ist der Namensabgleich,
 * gegen den ADR-001 und ADR-002 in diesem Repo stehen — und hier wäre er
 * schlimmer als anderswo. Ein Gerät, dessen Kategorie „Wandleuchte",
 * „Luminaire" oder „Strahler" heisst, fiele durch; es bekäme dann KEINEN
 * Knoten, und der Rechner sagte „brennt nicht". Eine Leuchte, die nicht
 * brennt, sieht aus wie eine Antwort. Sie ist hier aber die Auskunft
 * „niemand hat gesagt, was das für ein Gerät ist".
 *
 * Deshalb: `circuitKind` ist ein eigenes, optionales Feld am Gerät. Ohne
 * Angabe ist ein Gerät für das Schaltbild NICHT VORHANDEN — es taucht weder
 * als Leuchte noch als Klemmstelle auf, und die Anzeige sagt das (siehe
 * `circuitFromProject.ts`), statt es als „aus" zu zeichnen.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE KLEMME HÄNGT AM PORT, NICHT AN SEINER POSITION
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Eine Wechselschaltung unterscheidet Klemme 1 von Klemme 2 — vertauscht
 * man sie, brennt die Leuchte bei genau den umgekehrten Schalterstellungen.
 * Die Klemmennummer aus der REIHENFOLGE der Ports abzuleiten wäre deshalb
 * eine stille Umverdrahtung bei jedem Umsortieren; `B-33` hält denselben
 * Befund für die Port-Nummerierung fest. `circuitTerminal` steht am Port
 * selbst und übersteht das Umsortieren.
 */
import type { CircuitKind } from '../lib/circuitSolver'

export type { CircuitKind }

/**
 * Die Bauarten, die im Eigenschaften-Panel zur Wahl stehen, mit deutscher
 * Beschriftung und der Zahl der Klemmen, die sie braucht.
 *
 * `satisfies Record<CircuitKind, …>`: eine neue Bauart im Rechner ohne
 * Eintrag hier ist ein Typfehler — und keine Bauart, die man im Plan nicht
 * auswählen kann, obwohl der Rechner sie beherrscht.
 */
export const CIRCUIT_KIND_INFO = {
  feed: { label: 'Einspeisung', klemmen: [0], schaltbar: true },
  switch: { label: 'Aus-Schalter', klemmen: [1, 2], schaltbar: true },
  changeover: { label: 'Wechselschalter', klemmen: [0, 1, 2], schaltbar: true },
  crossover: { label: 'Kreuzschalter', klemmen: [1, 2, 3, 4], schaltbar: true },
  dimmer: { label: 'Dimmer', klemmen: [1, 2], schaltbar: false },
  lamp: { label: 'Leuchte', klemmen: [0], schaltbar: false },
  junction: { label: 'Klemmstelle / Dose', klemmen: [], schaltbar: false },
} satisfies Record<CircuitKind, { label: string; klemmen: number[]; schaltbar: boolean }>

/** Alle Bauarten in der Reihenfolge, in der das Panel sie anbietet. */
export const CIRCUIT_KINDS = Object.keys(CIRCUIT_KIND_INFO) as CircuitKind[]

export const istCircuitKind = (v: unknown): v is CircuitKind =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CIRCUIT_KIND_INFO, v)
