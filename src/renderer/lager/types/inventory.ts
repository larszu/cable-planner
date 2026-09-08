/**
 * Phase 2 — Zentraler Bestand (siehe docs/inventory-rental-readiness.md).
 *
 * Ein `InventoryItem` ist ein **Lager-Artikel** (ein Modell mit Menge N) —
 * bewusst getrennt vom `EquipmentItem` (Plan-Instanz auf dem Canvas). Der
 * Bestand lebt projektübergreifend im `inventoryStore` (localStorage),
 * unabhängig vom gerade geöffneten Plan.
 *
 * Lager-Modul (projektübergreifende Codes, Maße, Cases): Anders als die
 * projektgebundenen QR-Codes auf Kabeln/Geräten (siehe `qrPayload.ts`) trägt
 * ein Lager-Artikel einen **festen** Code (QR ODER Barcode), der über alle
 * Projekte hinweg denselben Artikel meint (touring-tauglich).
 */

/** Eigentumsverhältnis — gleiche Werte wie `EquipmentItem.ownership`. */
export type InventoryOwnership = 'owned' | 'rented' | 'subhire'

/** Etiketten-Codeart eines Lager-Artikels/Cases. */
export type InventoryCodeType = 'qr' | 'barcode'

/**
 * Material-Art (orthogonal zum Eigentum): Vermietmaterial wird verliehen und
 * kommt zurück; Verbrauchsmaterial (Gaffa, Batterien, Kabelbinder) wird
 * aufgebraucht. Ein Artikel darf beides sein (z. B. Verbrauchs- UND
 * Vermietware in Mischkalkulation), daher eine Menge statt Enum.
 */
export type InventoryMaterialKind = 'rental' | 'consumable'

/** Physische Maße in mm + Gewicht in kg. Alle Felder optional (nichts erfinden). */
export interface PhysicalDimensions {
  widthMm?: number
  heightMm?: number
  depthMm?: number
  weightKg?: number
}

/**
 * Ein Geldbetrag — Betrag UND Währung, immer zusammen (Bedarf 118).
 *
 * WARUM DIE WÄHRUNG AM BETRAG HÄNGT UND NICHT EINMAL AM BESTAND. Der
 * Kostenplan macht es umgekehrt (`types/costLines.ts`: „Das Waehrungskuerzel,
 * EINMAL am Projekt") und hat recht — für ein Projekt. Ein Bestand ist etwas
 * anderes: er wächst über Jahre, und die Kamera aus dem US-Kauf steht
 * neben dem hier gekauften Stativ. Eine Währung am Bestand zwänge dazu, den
 * einen Betrag umzurechnen — und ein Umrechnungskurs wäre ein Wert ohne
 * Fundstelle.
 *
 * Die Regel dahinter bleibt DIESELBE: zwei Währungen in EINER Summe sind eine
 * Zahl, die nichts bedeutet. Deshalb summiert `versicherungsListe` je Währung
 * getrennt und legt sie nie zusammen.
 *
 * GANZZAHLIG in der kleinsten Einheit. `0.1 + 0.2` ist in Fliesskomma nicht
 * `0.3`, und eine Versicherungssumme, die um Cent daneben liegt, ist eine
 * Zahl, der jemand widerspricht.
 */
export interface Geldbetrag {
  /** Betrag in der kleinsten Einheit der Währung (Cent, Penny, …). */
  cent: number
  /**
   * Währungskürzel nach ISO 4217 („EUR", „USD", „CHF").
   *
   * ANGEGEBEN, nie geraten — auch nicht „EUR", auch nicht aus dem Gebietsschema
   * des Rechners. Derselbe Befund wie `currency-unstated` im Kostenplan.
   */
  waehrung: string
}

/**
 * Was eine Einheit gekostet hat, und wann (Bedarf 118).
 *
 * Der Anschaffungspreis ist eine Tatsache mit Datum: er ändert sich nie.
 */
export interface Anschaffung {
  betrag: Geldbetrag
  /** Kaufdatum (ISO). */
  am?: string
}

/**
 * Wofür eine Einheit versichert ist, und mit welchem Stand (Bedarf 118).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * ZWEI ZAHLEN, WEIL ES ZWEI ZAHLEN SIND — UND KEINE DRITTE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Anschaffungspreis und Versicherungswert sind verschiedene Angaben und
 * werden NICHT auseinander gerechnet. Die naheliegende dritte Zahl wäre der
 * ZEITWERT — Anschaffung minus Abschreibung — und sie wird hier nicht
 * gebildet: nach welcher Regel abgeschrieben wird, entscheidet der
 * Versicherer, und diese Anwendung kennt seinen Vertrag nicht. Eine
 * gerechnete Zahl sähe aus wie eine Auskunft und wäre eine Vermutung, mit der
 * jemand in einen Schadensfall ginge.
 *
 * Deshalb der STAND: „so war er am 12.03.2026 gemeldet". Ohne ihn ist der
 * Wert einer ohne Zeitpunkt, und die Liste sagt das, statt ihn für aktuell zu
 * halten.
 */
export interface Versicherungswert {
  betrag: Geldbetrag
  /** Stand des Werts (ISO-Datum). */
  stand?: string
}

export interface InventoryItem {
  id: string
  /** Modell-/Artikelname (Pflicht, Anzeigename). */
  model: string
  /** Optionaler Hersteller. */
  manufacturer?: string
  /** Kategorie (gleiche Taxonomie wie `EquipmentItem.category`). */
  category?: string
  /**
   * ADR-002 — stabile Geraetetyp-Identitaet, dieselbe GUID wie
   * `EquipmentItem.deviceTypeId` (Katalog-Register). Ist sie gesetzt, ist die
   * Zuordnung Plan-Geraet -> Lager-Position eine Tatsache statt eines
   * Namensvergleichs.
   *
   * Optional, weil ein Lager mehr enthaelt als der Katalog kennt. Fehlt sie,
   * darf der Bedarfs-Resolver einen Vorschlag machen — aber nur als
   * Vorschlag, den ein Mensch bestaetigt; die Bestaetigung wird dann hier
   * festgeschrieben und muss nie wieder geraten werden.
   */
  deviceTypeId?: string
  /** Gesamtmenge im Bestand. */
  quantity: number
  /** Mietpreis pro Tag (Kalkulation, Phase 5). */
  rentPricePerDay?: number
  /** Lagerort (z. B. "Regal A3"). */
  stockLocation?: string
  /** Lieferant / Sub-Vermieter. */
  supplier?: string
  /** Eigentum (owned/rented/subhire). */
  ownership?: InventoryOwnership
  /**
   * Wann fremdes Material zurueckmuss (ISO-Datum, Bedarf 82).
   *
   * Der Bedarf sagt ausdruecklich, wo die Grenze liegt: „the achievable win is
   * a flag on the inventory unit, not a supplier portal. […] mark ownership
   * and return date inside the job and STOP THERE." Kein Bestellwesen, keine
   * Lieferanten-Anbindung — ein Datum.
   *
   * Und er sagt, warum es gebraucht wird: „the failure mode is not losing
   * sub-hire gear, IT IS KEEPING IT THREE WEEKS TOO LONG." Jeder Tag darueber
   * ist eine weitere Mietwoche.
   *
   * Ohne `ownership` ausser `owned` bedeutungslos — dann steht es fuer eigenes
   * Material, das nirgendwohin zurueckmuss, und `subhireStatus` sagt das.
   */
  returnDue?: string
  /** Fester Etiketten-Code (projektübergreifend). */
  code?: string
  /** Codeart des Etiketts (QR oder Barcode). */
  codeType?: InventoryCodeType
  /**
   * Aktueller Lagerort (Referenz auf `StorageNode.id`). Zeigt er auf einen
   * Container (case/transportCase), gilt der Artikel als DORT eingepackt —
   * „Case als Lagerort zuweisen" = einpacken. Kein separater Pack-Zustand:
   * die Zugehörigkeit ergibt sich allein aus dem Lager-Baum (LPN-Prinzip).
   */
  locationId?: string
  /** Physische Artikelmaße (für Case-Packing). */
  dimensions?: PhysicalDimensions
  /**
   * Ursprungsland nach ISO 3166-1 alpha-2 („DE", „JP", „US") — Bedarf 118.
   *
   * Steht am ARTIKEL und nicht an der Einheit: es ist eine Eigenschaft des
   * Modells, und zwei Einheiten desselben Modells aus verschiedenen
   * Fertigungen auseinanderzuhalten kann diese Anwendung nicht.
   *
   * Wofür: das Carnet-Datenblatt (`carnetDatenblatt`). Ein Carnet A.T.A.
   * verlangt Ursprungsland, Gewicht und Wert je Position. Ohne diese Angabe
   * steht dort „nicht angegeben" — und genau das ist der Zweck des Blattes:
   * zu zeigen, was noch fehlt, bevor jemand am Zoll steht.
   */
  ursprungsland?: string
  /** Material-Art(en): Vermiet- und/oder Verbrauchsmaterial. */
  materialKinds?: InventoryMaterialKind[]
  /** Freie Notiz. */
  notes?: string
  /** ISO-Zeitstempel. */
  createdAt: string
  updatedAt: string
}

/** Ein in einem Case verpackter Artikel + Stückzahl. */
export interface CasePackedItem {
  /** Referenz auf `InventoryItem.id`. */
  itemId: string
  /** Anzahl dieses Artikels im Case. */
  quantity: number
}

/**
 * Ein Case/Flightcase, das Artikel aufnimmt. Trägt eigene (Außen-)Maße +
 * optionalen festen Code. Die verpackten Artikel referenzieren `InventoryItem`
 * über die id — die Artikelmaße liegen am Artikel, nicht dupliziert im Case.
 */
export interface InventoryCase {
  id: string
  /** Anzeigename (z. B. "Case 1 — Funkstrecken"). */
  name: string
  /** Außenmaße + Leergewicht des Cases. */
  dimensions?: PhysicalDimensions
  /** Fester Etiketten-Code des Cases. */
  code?: string
  codeType?: InventoryCodeType
  /** Lagerort des Cases. */
  stockLocation?: string
  /** Verpackte Artikel. */
  contents: CasePackedItem[]
  /** Freie Notiz. */
  notes?: string
  createdAt: string
  updatedAt: string
}

// ── LPN-Modell (License Plate Number) ────────────────────────────────────────
// Warehouse-Best-Practice: JEDE scanbare Einheit — Lagerplatz (Depot/Raum/
// Regal/Fach) UND Container (Case/Transport-Case) — ist derselbe Knotentyp im
// selben Baum. So löst sich alles aus dem Baum ab: „Case in Case in
// Transport-Case", „Artikel in Case einpacken" (= locationId auf Case-Knoten)
// und „effektiver Lagerort" (oberster Vorfahr). Quelle: LPN/Nested-LPN (WMS).

/** Art eines Lager-Knotens. `case`/`transportCase` sind Container. */
export type StorageNodeKind = 'depot' | 'room' | 'shelf' | 'bin' | 'case' | 'transportCase'

/** Container-Arten (können bewegt werden + Inhalt tragen). */
export const CONTAINER_KINDS: readonly StorageNodeKind[] = ['case', 'transportCase']

/** Ein Knoten im Lager-Baum: Lagerplatz ODER Container. */
export interface StorageNode {
  id: string
  /** Anzeigename (z. B. "Regal A3", "Transport-Case 1"). */
  name: string
  kind: StorageNodeKind
  /**
   * Übergeordneter Knoten. Lagerplatz-Baum (Depot → Raum → Regal → Fach) und
   * Container-Verschachtelung (Case in Case in Transport-Case) nutzen dasselbe
   * Feld. Wurzelknoten haben keinen Parent.
   */
  parentId?: string
  /** Fester Etiketten-Code — Lagerplätze UND Cases sind scanbar. */
  code?: string
  codeType?: InventoryCodeType
  /** Außenmaße + Leergewicht (v. a. für Container). */
  dimensions?: PhysicalDimensions
  /** Freie Notiz. */
  notes?: string
  createdAt: string
  updatedAt: string
}

/** Eine Komponente eines logischen Sets (Artikel + Stückzahl). */
export interface SetComponent {
  itemId: string
  quantity: number
}

/**
 * Logisches Set/Kit (Vorlage) — „diese Artikel gehören zusammen". Anders als
 * ein Container (physische Kiste) ist ein Set eine Zusammenstellung; seine
 * Verfügbarkeit ergibt sich aus der knappsten Komponente (HireHop Virtual
 * Stock / Cheqroom Kits).
 */
export interface InventorySet {
  id: string
  name: string
  components: SetComponent[]
  notes?: string
  createdAt: string
  updatedAt: string
}

// ── Serialisierung (Einzel-Units mit Historie) ───────────────────────────────
// Rentmans meistgewünschter Fix: neben dem Bulk-Modell (Artikel mit Menge N)
// die EINZELNE physische Einheit — eigene Seriennr./Code, eigener Lagerort,
// eigener Zustand + Historie (wo war sie, wann repariert). Ein Unit gehört zu
// genau einem `InventoryItem` (Modell).

/** Zustand einer Einzel-Einheit. */
export type UnitCondition = 'ok' | 'defect' | 'inRepair' | 'retired'

/** Ereignis-Typ in der Unit-Historie. */
export type UnitEventKind = 'created' | 'moved' | 'condition' | 'note' | 'fault'

// ───────────────────────────────────────────────────────────────────────────
// BEDARF 52 (P2) — die Fehlerhistorie haengt am physischen Objekt.
//
//   > One SMPTE/fibre run carries video, return video, comms, tally, control
//   > and power, so a single fault presents as several departments' problems;
//   > which drum is suspect lives only in crew memory and THE SAME BAD DRUM
//   > SHIPS AGAIN NEXT MONTH.
//
// ─── WARUM DAS HIER STEHT UND NICHT AM KABEL IM PLAN ───────────────────────
//
// Weil ein Fehlerprotokoll am Plan-Kabel wertlos waere. Das Projekt endet, die
// Datei wird archiviert — und die Trommel geht naechsten Monat wieder raus.
// Der Bedarf nennt genau das als den Schaden. Die Historie gehoert deshalb an
// die EINHEIT im Lager, die projektuebergreifend denselben festen Code traegt.
//
// ─── DIE HERKUNFT DER FUNDSTELLE, IM KLARTEXT ──────────────────────────────
//
// Der Beleg ist ZWEITER HAND: die Bedarfs-Datenbank fuehrt ihn aus dem
// Schwester-Dossier (Church Production/Hitachi, Production Distro) und sagt
// ausdruecklich „second-hand, not re-fetched in this session; no
// shader-specific fault-log source could be reached". Gebaut wird deshalb nur,
// was aus dem MECHANISMUS folgt — ein Strang traegt mehrere Dienste, also ist
// ein Fehler daran mehrdeutig — und nichts, was eine Statistik ueber
// Ausfallraten behaupten wuerde.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Welche Dienste ein Fehler betraf.
 *
 * Die Vokabeln der Signal-Ebenen dieses Planers. Ein SMPTE-/Fiber-Strang
 * traegt sie gemeinsam, und genau deshalb ist die Angabe MEHRWERTIG: „das Bild
 * war weg und die Comms auch" ist eine andere Meldung als „nur das Bild".
 */
export type FaultService = 'video' | 'returnVideo' | 'comms' | 'tally' | 'control' | 'power'

export const FAULT_SERVICE_LABEL: Readonly<Record<FaultService, string>> = {
  video: 'Video',
  returnVideo: 'Rückvideo',
  comms: 'Comms',
  tally: 'Tally',
  control: 'Steuerung',
  power: 'Strom',
}

/**
 * Ein Eintrag in der Historie einer Einheit (append-only).
 *
 * `fault` traegt zusaetzlich die betroffenen Dienste und ob der Fehler erledigt
 * ist. Beides steht NICHT im `detail`-Text: ein Freitext laesst sich nicht
 * zaehlen, und „welche Trommel ist verdaechtig" ist genau eine Zaehlfrage.
 */
export interface UnitEvent {
  /** ISO-Zeitstempel. */
  at: string
  kind: UnitEventKind
  /** Menschlich lesbare Beschreibung (z. B. „nach Case 2", „defekt → Reparatur"). */
  detail: string
  /** Nur bei `kind === 'fault'`: welche Dienste ausgefallen sind. */
  services?: FaultService[]
  /**
   * Nur bei `kind === 'fault'`: ob der Fehler abgestellt ist.
   *
   * Fehlt die Angabe, gilt der Fehler als OFFEN. Das ist Absicht: ein
   * unbeantwortetes „ist das behoben?" als erledigt zu lesen ist genau der
   * Weg, auf dem dieselbe Trommel wieder rausgeht.
   */
  resolved?: boolean
}

/** Eine serialisierte Einzel-Einheit eines Artikel-Modells. */
export interface InventoryUnit {
  id: string
  /** Referenz auf das Artikel-Modell (`InventoryItem.id`). */
  itemId: string
  /**
   * Die HERSTELLER-Seriennummer.
   *
   * Bedarf 107 — bis hierher hiess das Feld „Hersteller ODER intern", und
   * genau das ist der Defekt: ein Feld fuer zwei Identitaeten zwingt das
   * Lager, sich fuer eine zu entscheiden, und die andere landet auf dem Case
   * mit Filzstift oder in einer Tabelle daneben. Gebraucht werden aber beide,
   * und zwar von verschiedenen Leuten: die Herstellernummer fuer Versicherung,
   * Sub-Vermietung an Dritte und Wartungshistorie, die Hausnummer fuer alles
   * Interne.
   *
   * Die Trennung passiert JETZT, weil sie jetzt nichts kostet: es gibt noch
   * keine Bestandsdaten zu migrieren. Die Bedarfs-Datenbank sagt genau das —
   * „Cheap today, expensive after the first real deployment."
   */
  serial?: string
  /**
   * Die HAUS-EIGENE Referenz — die Nummer, unter der dieses Haus die Einheit
   * fuehrt („AV-0421").
   *
   * Steht NEBEN `serial` und nicht statt ihr. Ein Altbestand, in dem die
   * Hausnummer im `serial`-Feld steht, wird NICHT automatisch umgeraeumt:
   * welche der beiden dort gemeint war, weiss der Planer nicht, und eine
   * geratene Umbuchung machte aus einer Herstellernummer eine Hausnummer, die
   * die Versicherung nicht kennt. Welche gemeint war, weiss nur der Mensch;
   * die App zeigt stattdessen beide Felder nebeneinander (`identityTable`),
   * damit die Verwechslung sichtbar wird statt weiterzuwandern.
   */
  houseRef?: string
  /** Fester Etiketten-Code der Einheit. */
  code?: string
  codeType?: InventoryCodeType
  /** Aktueller Lagerort (Referenz auf `StorageNode.id`) — wie beim Artikel. */
  locationId?: string
  /** Zustand (Wartung/Reparatur). */
  condition: UnitCondition
  /** Bedarf 118 — was sie gekostet hat. Siehe `Anschaffung`. */
  anschaffung?: Anschaffung
  /** Bedarf 118 — wofür sie versichert ist. Siehe `Versicherungswert`. */
  versicherungswert?: Versicherungswert
  /** Freie Notiz. */
  notes?: string
  /** Append-only Historie (Bewegungen, Zustandswechsel). */
  history: UnitEvent[]
  createdAt: string
  updatedAt: string
}
