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

export interface InventoryItem {
  id: string
  /** Modell-/Artikelname (Pflicht, Anzeigename). */
  model: string
  /** Optionaler Hersteller. */
  manufacturer?: string
  /** Kategorie (gleiche Taxonomie wie `EquipmentItem.category`). */
  category?: string
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
  /** Fester Etiketten-Code (projektübergreifend). */
  code?: string
  /** Codeart des Etiketts (QR oder Barcode). */
  codeType?: InventoryCodeType
  /** Physische Artikelmaße (für Case-Packing). */
  dimensions?: PhysicalDimensions
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
