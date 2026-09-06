// ───────────────────────────────────────────────────────────────────────────
// BEDARF 72 (P2) — der Multicast-Adressplan fuer ST 2110.
//
//   > Every essence (2110-20/-30/-40) is its own multicast group, doubled for
//   > 2022-7. A mid-size truck is several hundred rows allocated by hand in
//   > Excel. Two invisible rules get violated: (address, UDP port) must be
//   > unique per sender, and 32 L3 multicast addresses alias onto one L2 MAC,
//   > so a naive scheme collides.
//
// Belege: Arista, „M&E Multicast Addressing" (L3/L2-Alias, 2^5-Kollaps);
// Dataton WATCHOUT, ST-2110-Netzwerkeinrichtung (Adresse+Port eindeutig).
//
// ─── WAS HIER GESPEICHERT WIRD, UND WARUM NICHT MEHR ───────────────────────
//
// Der FLUSS wird abgeleitet: welcher Sender welche Essenz ausgibt, steht im
// Kabelgraph, und ein zweites Feld dafuer waere ab dem ersten umgesteckten
// Kabel falsch (dieselbe Begruendung wie bei `familiesByDevice`, Bedarf 73).
//
// Die ADRESSE dagegen muss stehen bleiben. Sie ist verteilt worden: sie steht
// im Sender, im Empfaenger, im Switch-Filter und auf dem Blatt, das jemand
// ausgedruckt mit ins Rack genommen hat. Eine Adresse, die sich beim naechsten
// Oeffnen des Plans neu berechnet, ist schlimmer als keine — sie sieht aus wie
// die alte und ist es nicht. Deshalb: Fluesse abgeleitet, Vergaben gespeichert.
//
// ─── DER SCHLUESSEL IST DER SENDE-PORT, NICHT DAS KABEL ────────────────────
//
// Eine Multicast-Gruppe gehoert dem SENDER. Fuenf Empfaenger derselben Kamera
// abonnieren eine Gruppe, nicht fuenf. Genau das ist der Punkt, an dem eine
// Excel-Tabelle mit einer Zeile je Kabel auseinanderfaellt. Der Schluessel ist
// deshalb `<equipmentId>:<portId>` — er ueberlebt jedes Umstecken auf der
// Empfaengerseite und jedes hinzugekommene Ziel.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Das Bein eines 2022-7-Paars.
 *
 * `a` ist das Primaernetz (rot), `b` das Sekundaernetz (blau). Ein Fluss ohne
 * zweite Medien-Schnittstelle am Sender hat nur `a` — und dass er nur eines
 * hat, steht damit IM PLAN und nicht in der Erinnerung.
 */
export type MulticastLeg = 'a' | 'b'

export const MULTICAST_LEGS: ReadonlyArray<MulticastLeg> = ['a', 'b']

export const MULTICAST_LEG_LABEL: Readonly<Record<MulticastLeg, string>> = {
  a: 'A (primär)',
  b: 'B (sekundär)',
}

/** Eine vergebene Gruppe: ein Bein eines Flusses. */
export interface MulticastAssignment {
  /** `<equipmentId>:<portId>` — siehe Kopf. */
  flowKey: string
  leg: MulticastLeg
  /** Gruppen-Adresse, punktiert („239.100.0.12"). */
  address: string
  /** Ziel-UDP-Port. */
  port: number
}

/**
 * Der Rahmen, in dem vergeben wird.
 *
 * Optional am Projekt: ohne erklaerten Pool vergibt niemand etwas, und ein
 * still gesetzter Vorgabe-Pool waere eine Behauptung ueber ein Netz, das
 * diese Anwendung nie gesehen hat. Der Plan zeigt dann die Fluss-Tabelle und
 * sagt, dass kein Pool erklaert ist — ein benanntes Ergebnis statt einer
 * leeren Liste.
 */
export interface MulticastConfig {
  /** CIDR, z. B. „239.100.0.0/16". */
  pool: string
  /** UDP-Port, den jede Vergabe traegt. */
  basePort: number
  assignments: MulticastAssignment[]
}
