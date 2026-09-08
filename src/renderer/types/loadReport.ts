/**
 * Was beim Laden eines Projekts nicht übernommen werden konnte.
 *
 * ADR-005, Regel 3: „Wer nicht bewahren kann, sagt es an der Stelle, an der es
 * passiert." Auf dem Lade-Pfad war das bisher **strukturell unmöglich**:
 * `healProjectPositions` ist eine reine Funktion ohne Weg zur Oberfläche, also
 * verschwand alles, was sie verwarf, definitionsgemäß still.
 *
 * Konkret aufgefallen an den Signalquellen-Rollen aus ADR-001: eine Rolle ohne
 * Namen oder mit doppelter Id wurde wortlos entfernt, und `clearDanglingIdentity`
 * strich anschließend die Verweise der Geräte darauf. Eine Kamera verlor damit
 * ihre TSL-Adresse, ohne dass irgendwo etwas stand.
 *
 * Der Grund ist als **Code** hinterlegt, nicht als Satz: der Store soll keine
 * Sprache kennen, die Oberfläche übersetzt ihn.
 */

/** Warum ein Datensatz beim Laden nicht übernommen wurde. */
export type LoadDropReason =
  /** Pflichtfeld fehlte (z. B. eine Rolle ohne Namen). */
  | 'missing-required'
  /** Eine Id kam mehrfach vor; der erste Datensatz hat gewonnen. */
  | 'duplicate-id'
  /**
   * Der Datensatz zeigte auf etwas, das es nicht (mehr) gibt — und ohne dieses
   * Ziel ist er nicht bloss unvollständig, sondern irreführend.
   *
   * Eigener Grund und nicht `missing-required`, weil die beiden verschiedene
   * Auskünfte sind: „Pflichtfeld fehlt" schickt jemanden in seine Datei, um
   * einen Namen nachzutragen; „Verweis zeigt ins Leere" sagt ihm, dass das
   * Ziel gelöscht wurde und der Datensatz mit ihm. Wer das Erste liest und das
   * Zweite braucht, sucht am falschen Ende.
   *
   * NICHT für jeden Fehlzeiger: Wo ein Datensatz ohne sein Ziel noch etwas
   * aussagt, bleibt er stehen und bekommt einen Befund (`override-orphan`,
   * `anchor-orphan`, `rate-missing`). Dieser Grund gilt nur, wo das Verwerfen
   * selbst die richtige Entscheidung ist.
   */
  | 'dangling-ref'
  /**
   * Das Feld trug einen Wert, den dieser Stand nicht kennt — kein fehlender
   * Verweis, sondern eine unbekannte Vokabel.
   *
   * Eigener Grund, weil die Auskunft eine andere ist: `dangling-ref` schickt
   * jemanden zu einem gelöschten Ziel, `invalid-value` zu einer Datei, die
   * aus einer anderen (neueren oder fremden) Fassung stammt. Wer das Erste
   * liest und das Zweite braucht, sucht ein Ziel, das es nie gab.
   */
  | 'invalid-value'

/** Woher der verworfene Datensatz kam. */
export type LoadDropKind =
  | 'source-identity'
  /**
   * Schaltbild (Strom) — eine `circuitKind`-Angabe, die dieser Stand nicht
   * kennt. Verworfen wird nur DIESES FELD, nicht das Gerät.
   *
   * Warum überhaupt gemeldet: ohne Bauart ist das Gerät für den
   * Schaltbild-Rechner nicht vorhanden, und die Leuchte dahinter „brennt
   * nicht". Das sieht aus wie eine Aussage über die Anlage. Wer die Datei in
   * einer neueren Fassung angelegt hat, soll erfahren, dass hier eine Angabe
   * verlorengegangen ist — statt sich zu wundern, warum sein Schaltbild
   * dunkel bleibt.
   */
  | 'equipment-circuit'
  /** Initiative 9 — ein Ausspielziel, das die Normalisierung nicht bestanden
   *  hat. Dieselbe Regel wie bei der Rolle: ein Ziel, das still verschwindet,
   *  nimmt die Ingest-URL und den Verweis auf seinen Stream-Key mit, und der
   *  faellt erst am Showtag auf. */
  | 'delivery-destination'
  /** Bedarf 85 — eine Antwort der Haus-IT, die keine ist: ohne Punkt, auf den
   *  sie sich bezieht, oder mit einem Ausgang, den es nicht gibt. Sie still zu
   *  verwerfen waere hier besonders teuer: eine fehlende Zeile im Blatt sieht
   *  aus wie „nie gefragt", und dann fragt jemand ein zweites Mal — oder gar
   *  nicht mehr, weil er die Genehmigung von letztem Jahr im Kopf hat. */
  | 'venue-answer'
  /** Bedarf 72 — eine Multicast-Vergabe, die keine Adresse traegt oder deren
   *  Bein/Fluss unlesbar ist. Sie still zu behalten waere hier schlimmer als
   *  bei jeder anderen Sorte: die Vergabe steht im Blatt, das jemand mit ins
   *  Rack nimmt, und eine unlesbare Zeile fiele erst dort auf. */
  | 'multicast-assignment'
  /** Bedarf 89 — eine Ausweich-Regel ohne Ziel. Sie schuetzt nichts, und sie
   *  stehenzulassen waere schlimmer als sie zu verwerfen: im Blatt saehe sie
   *  aus wie ein Sicherheitsnetz. */
  | 'fallback-rule'
  /** Bedarf 88 — eine Abweichung der Veranstaltungsangaben ohne Ziel-Id. Sie
   *  kann nichts ueberschreiben, und sie still zu behalten hiesse, dass ein
   *  abweichender Titel im Projektfile liegt, den kein Blatt je zeigt. Eine
   *  Abweichung auf ein GELOESCHTES Ziel wird dagegen NICHT verworfen — dafuer
   *  gibt es den Befund `override-orphan`. */
  | 'metadata-override'
  /** Bedarf 87 — ein Eintrag im Sendebericht ohne Zeitpunkt oder ohne Art.
   *  In einem Bericht ueber einen VERLAUF ist eine Zeile ohne Zeitpunkt keine
   *  Zeile. Ein Eintrag auf ein GELOESCHTES Ziel wird dagegen nicht verworfen
   *  — dafuer gibt es den Befund `event-orphan`, und ein spurlos
   *  verschwundener Eintrag ueber einen Abriss waere die teuerste Luecke, die
   *  dieser Bericht haben kann. */
  | 'transmission-event'
  /** Bedarf 79 — eine Kostenposition ohne Id oder ohne Bezeichnung. In einem
   *  Vergleich ist eine namenlose Zeile keine Zeile. Eine Position mit einem
   *  ANKER INS LEERE wird dagegen nicht verworfen — dafuer gibt es den Befund
   *  `anchor-orphan`, und sie still auf „ohne Bezug" zu setzen hiesse, eine
   *  gebuchte Position in eine Fahrtkostenzeile zu verwandeln. */
  | 'cost-line'
  /** Bedarfe 40/41/83 — ein Datensatz der Crew-Seite, dem ein Pflichtfeld
   *  fehlt: eine Schicht ohne Person, Datum oder Zeiten, ein Satz ohne
   *  Stundenbetrag, eine Auslage ohne Betrag, eine Zusage ohne Absender.
   *  Eine Schicht, deren SATZ geloescht wurde, wird dagegen NICHT verworfen —
   *  dafuer gibt es den Befund `rate-missing`, und eine spurlos entfernte
   *  Schicht ist eine geleistete Stunde, die niemand mehr abrechnet. */
  | 'crew-entry'
  /** Bedarf 105 — das Tally je Position. Ein Datensatz ohne Rolle oder mit
   *  doppelter Rolle wird verworfen, und ebenso einer, dessen Rolle es nicht
   *  mehr gibt. Er traegt die BEOBACHTUNGEN vor Ort: jemand stand an der
   *  Kamera und hat gesehen, dass die Lampe rot wird. Still verschwinden zu
   *  lassen, was jemand nachgesehen hat, ist die teuerste Sorte Verlust — das
   *  Vor-Show-Blatt zeigt die Position danach als „nie geprueft", und dann
   *  laeuft jemand ein zweites Mal denselben Weg. Oder eben nicht, weil er
   *  sich erinnert, dort schon gewesen zu sein. */
  | 'tally-position'
  /** Bedarf 20 — ein Adressbereich, dessen CIDR keiner ist, oder der keine Id
   *  traegt. Ein Bereich ist der Vorrat, aus dem jede Geraete-Adresse kommt;
   *  faellt er beim Laden still weg, vergibt der naechste Adresslauf aus einem
   *  Plan, in dem dieses Netz nie stand — und der Widerspruch faellt erst auf,
   *  wenn zwei Geraete im Rack dieselbe Adresse tragen. */
  | 'address-range'

export interface LoadDrop {
  kind: LoadDropKind
  reason: LoadDropReason
  /**
   * Bester menschenlesbarer Griff auf den verworfenen Datensatz, damit jemand
   * ihn in seiner Datei wiederfindet. Leer, wenn die Datei keinen hergab —
   * dann sagt der Bericht wenigstens, dass es ihn gab.
   */
  label: string
}

export interface LoadReport {
  drops: LoadDrop[]
}

/** Ein Bericht ohne Inhalt ist kein Bericht — dann gibt es nichts zu melden. */
export const hasDrops = (report: LoadReport | null | undefined): boolean =>
  !!report && report.drops.length > 0
