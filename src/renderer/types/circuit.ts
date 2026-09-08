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
 * Die Bauarten, die im Eigenschaften-Panel zur Wahl stehen — eine Zeile je
 * Bauart, und alles über sie in dieser einen Zeile.
 *
 * `satisfies Record<CircuitKind, …>`: eine neue Bauart im Rechner ohne
 * Eintrag hier ist ein Typfehler — und keine Bauart, die man im Plan nicht
 * auswählen kann, obwohl der Rechner sie beherrscht.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WARUM DIE RUHESTELLUNG HIER STEHT UND NICHT AN DREI STELLEN (B-52 Teil 2)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Vor B-52 Teil 2 rechneten DREI Orte aus, welche Stellung gilt, solange
 * niemand eine gewählt hat: das frühere `VORGABE_STELLUNG` in
 * `circuitFromProject.ts`
 * (was der Rechner nimmt), `vorgabe()` im `circuitStore` (wovon das nächste
 * Antippen ausgeht) und die Marke am Canvas-Knoten (was der Nutzer SIEHT).
 * Sie stimmten überein, weil ausser der Einspeisung alles bei 0 anfing —
 * ein Zufall, der genau mit dieser Änderung endete: Not-Aus, FI und LS sind
 * im Ruhezustand GESCHLOSSEN. Der Rechner hätte die Leuchte brennen lassen
 * und die Marke am Knoten dazu keine Stellung gezeigt. Zwei Antworten auf
 * dieselbe Frage, und die eine steht neben der anderen auf dem Schirm.
 *
 * Deshalb: `ruhe` ist die eine Angabe, alle drei lesen sie hier.
 *
 * WAS `ruhe` NICHT IST: eine gerechnete Auslösung. Ein FI öffnet bei einem
 * Fehlerstrom, ein LS bei Überlast — beides sind Betriebszustände, die der
 * Plan nicht kennt (dieselbe Grenze wie beim Router-Kreuzpunkt, ADR-003).
 * Der Planer sagt, ob ausgelöst ist; gerechnet wird es nie.
 *
 * EINSPEISUNG UND SCHALTER STEHEN VERSCHIEDEN HERUM, und das mit Absicht:
 * Einspeisung EIN, Schalter AUS. Ein Schaltbild, das beim Öffnen alles
 * brennen lässt, zeigt nichts — der Nutzer will sehen, was seine Schalter
 * TUN, und fängt beim dunklen Bild an. `changeover` und `crossover` haben
 * keine Aus-Stellung; sie leiten in jeder Stellung, nur woandershin. Ihre
 * Ruhe ist deshalb 1 und nicht 0.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DIE MARKE IST ANGEGEBEN, NICHT AUS DEM NAMEN GESCHNITTEN
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Der Canvas-Knoten trug bis B-52 Teil 2 den ersten Buchstaben der
 * Beschriftung. Das ging so lange gut, wie keine zwei Bauarten mit
 * demselben Buchstaben anfingen — mit „Stromverteiler" und „Schütz" sowie
 * „Leuchte" und „Leitungsschutzschalter" ist damit Schluss: zwei
 * verschiedene Geräte trügen dieselbe Marke, und niemand sähe es dem
 * Knoten an. Die Marke wird deshalb ANGEGEBEN und ihre Eindeutigkeit
 * geprüft (`tests/schaltbildBauarten.test.ts`).
 *
 * Sie ist AUSDRÜCKLICH KEIN Betriebsmittelkennzeichen nach DIN EN 81346.
 * Die Norm vergibt Klassen-Buchstaben und unterscheidet innerhalb einer
 * Klasse per Zählnummer — „Q1", „Q2" —, sie gibt gerade keinen eindeutigen
 * Buchstaben je Gerätetyp her. Diese Marken hier als BMK auszugeben wäre
 * eine Aussage über eine Norm, die sie nicht trägt.
 */
export const CIRCUIT_KIND_INFO = {
  feed: { label: 'Einspeisung', marke: 'E', klemmen: [0], schaltbar: true, ruhe: 1 },
  switch: { label: 'Aus-Schalter', marke: 'S', klemmen: [1, 2], schaltbar: true, ruhe: 0 },
  changeover: { label: 'Wechselschalter', marke: 'W', klemmen: [0, 1, 2], schaltbar: true, ruhe: 1 },
  crossover: { label: 'Kreuzschalter', marke: 'K', klemmen: [1, 2, 3, 4], schaltbar: true, ruhe: 1 },
  dimmer: { label: 'Dimmer', marke: 'D', klemmen: [1, 2], schaltbar: false, ruhe: 0 },
  lamp: { label: 'Leuchte', marke: 'L', klemmen: [0], schaltbar: false, ruhe: 0 },
  junction: { label: 'Klemmstelle / Dose', marke: 'KL', klemmen: [], schaltbar: false, ruhe: 0 },
  // ─── B-52 Teil 2 ────────────────────────────────────────────────────────
  //
  // Der Stromverteiler ist eine KLEMMSTELLE mit abgesicherten Abgängen. Die
  // Absicherung sitzt am Anschluss (`Port.absicherungA`, Teil 1) und löst
  // nie aus — der Plan kennt die angeschlossenen Lasten nicht.
  distro: { label: 'Stromverteiler', marke: 'V', klemmen: [], schaltbar: false, ruhe: 0 },
  // Die sechs Kontakte tragen dieselben Klemmen wie der Aus-Schalter und
  // rechnen mit derselben Funktion (`INNERE_VERBINDUNG` in `circuitSolver`).
  // Eigene Bauarten sind sie für die BESCHRIFTUNG und für die RUHESTELLUNG —
  // „Aus-Schalter" auf einem Not-Aus wäre auf einem Blatt schlicht falsch,
  // und ein Not-Aus, der als offen gelesen wird, macht aus einer brennenden
  // Leuchte eine dunkle.
  //
  // Die SPULE eines Schützes (A1/A2) ist bewusst nicht abgebildet: sie wäre
  // ein zweiter Stromkreis, der den ersten schaltet, und der Rechner hätte
  // dann eine Rückkopplung zu lösen, die niemand angegeben hat. Wer ein
  // Schütz umlegt, sagt damit „es hat angezogen" — dasselbe Verhältnis wie
  // bei jedem anderen Kontakt hier.
  button: { label: 'Taster', marke: 'T', klemmen: [1, 2], schaltbar: true, ruhe: 0 },
  contactor: { label: 'Schütz', marke: 'SZ', klemmen: [1, 2], schaltbar: true, ruhe: 0 },
  relay: { label: 'Relais', marke: 'R', klemmen: [1, 2], schaltbar: true, ruhe: 0 },
  emergencyStop: { label: 'Not-Aus', marke: 'NA', klemmen: [1, 2], schaltbar: true, ruhe: 1 },
  rcd: { label: 'FI-Schutzschalter', marke: 'FI', klemmen: [1, 2], schaltbar: true, ruhe: 1 },
  mcb: { label: 'Leitungsschutzschalter', marke: 'LS', klemmen: [1, 2], schaltbar: true, ruhe: 1 },
} satisfies Record<
  CircuitKind,
  { label: string; marke: string; klemmen: number[]; schaltbar: boolean; ruhe: number }
>

/** Alle Bauarten in der Reihenfolge, in der das Panel sie anbietet. */
export const CIRCUIT_KINDS = Object.keys(CIRCUIT_KIND_INFO) as CircuitKind[]

export const istCircuitKind = (v: unknown): v is CircuitKind =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(CIRCUIT_KIND_INFO, v)
