/**
 * Bedarf 15 (P1) — den Container ein- und auschecken, nicht den Artikel.
 *
 * Der Befund steht in zwei offenen Snipe-IT-Ausgaben, beide von AV-Leuten:
 *
 *   > cameras + lenses + audio + cards that "travel together at all times" —
 *   > "a good half hour of repetitive clicking"     (snipe-it#9517, 2021-04-30,
 *                                                    2025-08 immer noch offen)
 *
 * Der dortige Ausweg ist ein erfundenes „Eltern-Asset", auf das alles gebucht
 * wird -- und das dann als Einziges benachrichtigt. Der zweite Satz des
 * Befundes ist der wichtigere:
 *
 *   > Kits contain models, not the specific physical assets that are actually
 *   > in the case.
 *
 * DARAUS FOLGT DIE ENTSCHEIDENDE REGEL DIESER DATEI: eine Ausgabe haelt fest,
 * WAS TATSAECHLICH DRIN WAR, nicht was die Kit-Vorlage sagt. Eine Liste aus
 * der Vorlage waere zum Zeitpunkt der Rueckgabe wertlos: sie beschriebe ein
 * gedachtes Case, und die Frage bei der Rueckgabe lautet „fehlt etwas?".
 *
 * KEIN ZWEITER ZUSTAND AM KNOTEN. Der Lager-Baum (LPN, `storageTree.ts`) sagt
 * bereits, was in einem Container liegt -- verschachtelt ueber beliebig viele
 * Ebenen. „Der Inhalt folgt mit" ist deshalb keine Funktion, die etwas
 * mitbewegt, sondern eine Eigenschaft des Baums: wer den Container ausgibt,
 * gibt seinen Teilbaum aus, ohne dass ein einziges Kind angefasst wird. Genau
 * das ist der Unterschied zum halbstuendigen Klicken.
 *
 * EINE SERIALISIERTE EINHEIT GEHT UNTER IHRER EIGENEN IDENTITAET RAUS, nicht
 * als „1 x Modell". Das ist die Halbierung, die der Bedarf ausdruecklich
 * nennt („children keep their own ERP identities"): kommt eine von drei
 * Funkstrecken nicht zurueck, muss auf dem Blatt stehen, WELCHE.
 */

/** Was in einer Ausgabe steht: ein Mengen-Artikel, eine Einheit oder ein
 *  verschachtelter Container. Drei Arten, weil sie drei verschiedene
 *  Identitaeten haben -- nicht als Geschmacksfrage. */
export type CheckoutLineKind = 'item' | 'unit' | 'node'

/**
 * Eine Zeile der eingefrorenen Inhaltsliste.
 *
 * `label` wird MITGESCHRIEBEN und nicht beim Anzeigen nachgeschlagen. Ein
 * Artikel, der waehrend der Ausgabe umbenannt oder geloescht wird, macht die
 * Rueckgabe-Liste sonst unlesbar -- und genau dann braucht sie jemand.
 */
export interface CheckoutLine {
  kind: CheckoutLineKind
  /** `InventoryItem.id`, `InventoryUnit.id` oder `StorageNode.id`. */
  refId: string
  /** Name zum Zeitpunkt der Ausgabe. */
  label: string
  /** Stueckzahl. Bei `unit` und `node` immer 1 -- sie sind einzeln. */
  quantity: number
  /**
   * Bedarf 16 -- der ETIKETTEN-CODE, so wie er auf dem Objekt klebt.
   *
   * Der Befund verlangt „the printed artefact scannable back in": das
   * Abhaken auf Papier soll die EINGABE fuer den digitalen Datensatz werden
   * statt eines zweiten, widerspruechlichen. Dafuer muss auf dem Blatt die
   * Kennung stehen, die der Scanner am Objekt findet.
   *
   * Der erste Wurf dieses Blatts druckte `refId` -- die interne UUID. Sie
   * sieht auf Papier aus wie eine Kennung und ist keine: sie klebt auf
   * keinem Case, und kein Scanner findet sie. Ein Blatt, das eine
   * unscannbare Zeichenkette in die Spalte „Kennung" setzt, ist schlimmer
   * als eines ohne Spalte -- es sieht benutzbar aus.
   *
   * Undefined = das Objekt traegt kein Etikett. Das wird auf dem Blatt
   * BENANNT, nicht durch die UUID ersetzt.
   */
  code?: string
  /**
   * Fremdes Material, im Klartext (Bedarfe 67 und 82) — „Sub-Hire · Videohaus
   * Meier · zurueck 2026-09-12". Leer/fehlend bei eigenem.
   *
   * MITGESCHRIEBEN, aus demselben Grund wie `label`: der Ausgabeschein wird
   * gedruckt und liegt drei Wochen im Truck. Wuerde die Herkunft beim Anzeigen
   * nachgeschlagen, saehe ein inzwischen zurueckgegebener Sub-Hire-Artikel auf
   * dem alten Blatt aus wie eigener — und genau bei der Rueckgabe braucht ihn
   * jemand.
   *
   * Bedarf 67 nennt den Check-in-Bildschirm ausdruecklich als eine der drei
   * Stellen, an denen die Herkunft ankommen muss.
   */
  ownership?: string
}

/** Der Vorgang der Ausgabe. */
export interface CheckoutOut {
  /** ISO-Zeitstempel. */
  at: string
  /** An wen -- Person, Truck, Kunde. Freitext, weil ein Lager sie alle kennt. */
  to: string
  /** Fuer welche Show, wenn bekannt. */
  projectName?: string
  /** Erwartete Rueckgabe (ISO-Datum). */
  dueBack?: string
  note?: string
}

/** Der Vorgang der Rueckgabe, mit dem Unterschied zur Ausgabe. */
export interface CheckoutIn {
  at: string
  /** Was auf der Ausgabeliste stand und bei der Rueckgabe nicht da war. */
  missing: CheckoutLine[]
  /** Was zurueckkam, ohne auf der Ausgabeliste zu stehen. */
  extra: CheckoutLine[]
  note?: string
}

/**
 * Ein Ausgabe-Vorgang. Append-only: `in` wird einmal gesetzt und nie wieder
 * geaendert. Ein Vorgang, der sich ruecklaufend korrigieren laesst, ist kein
 * Beleg mehr -- und ein Beleg ist genau das, was hier gebraucht wird, wenn
 * drei Wochen spaeter jemand fragt, wo das Objektiv geblieben ist.
 */
export interface CheckoutRecord {
  id: string
  /** Der ausgegebene Container (`StorageNode.id`). */
  nodeId: string
  /** Sein Name zum Zeitpunkt der Ausgabe -- aus demselben Grund wie `label`. */
  nodeLabel: string
  out: CheckoutOut
  /** Was tatsaechlich drin war, eingefroren. */
  contents: CheckoutLine[]
  /** Fehlt, solange der Vorgang offen ist. */
  in?: CheckoutIn
}
