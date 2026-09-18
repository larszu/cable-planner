// ───────────────────────────────────────────────────────────────────────────
// Die LED-Wand (#881).
//
// ─── WAS EINE LED-WAND IM PLAN IST ─────────────────────────────────────────
//
// Ein Raster gleicher Kacheln, das drei Fragen beantworten muss, bevor
// jemand sie aufbaut: passt sie in die Öffnung, hängt sie am Träger, und
// reicht der Strom. Alles drei fällt aus den Kacheldaten heraus — es gibt
// dafür nichts zu raten.
//
// ─── UND WAS EIN PANEL-TYP IST ─────────────────────────────────────────────
//
// Ein Typ, kein Panel: „ROE CB5 MKII" ist der Typ, die 96 Stück im Fall sind
// die Panels. Der Typ trägt, was auf dem Datenblatt steht — Pixelabstand,
// Auflösung, Masse, Gewicht, Leistung — und die HERKUNFT dieser Zahlen.
//
// ─── DIE HAUSREGEL, UND WARUM SIE HIER TEUER IST ───────────────────────────
//
// Fehlt eine Angabe, fehlt sie. Gewicht und Leistung sind ausdrücklich
// optional, und eine Wand ohne Gewichtsangabe wiegt nicht 0 kg — sie wiegt
// unbekannt viel. Eine gerechnete Traglast aus geschätzten Panelgewichten
// steht am Ende unter einer Traverse, an der Menschen vorbeigehen.
// ───────────────────────────────────────────────────────────────────────────

/** Ein Panel-TYP aus der Bibliothek. */
export interface LedPanelType {
  id: string
  name: string
  /** Pixelabstand in mm — die Zahl, die „P3.9" im Namen meint. */
  pitchMm: number
  /** Auflösung EINES Panels in Pixeln. */
  pixels: { x: number; y: number }
  /** Kantenmasse eines Panels in mm. Tiefe zählt für den Aufbau, nicht fürs Bild. */
  sizeMm: { w: number; h: number; d?: number }
  /** Gewicht eines Panels in kg. Fehlt es, wiegt die Wand unbekannt viel. */
  weightKg?: number
  /** Dauerleistung in W je Panel — die Zahl fürs Rechnen. */
  powerAvgW?: number
  /** Spitzenleistung in W je Panel — die Zahl fürs Absichern (Weissbild). */
  powerMaxW?: number
  /**
   * Woher die Zahlen stammen: Link aufs Datenblatt.
   *
   * Dasselbe Feld wie an jedem Geräte-Katalogeintrag (`manufacturerUrl`),
   * und aus demselben Grund: eine Panelleistung ohne Beleg sieht auf einem
   * Stromlaufplan aus wie eine Messung.
   */
  manufacturerUrl?: string
}

/**
 * Eine geplante Wand: welcher Typ, wie viele Kacheln, und woran sie hängt.
 *
 * Die Wand trägt die ANZAHL und nicht die Masse: die Masse stehen am Typ, und
 * sie hier zu wiederholen wäre die zweite Wahrheit über dieselbe Kachel
 * (ADR-001).
 */
export interface LedWall {
  id: string
  name: string
  /** Verweis auf den Panel-Typ. */
  panelTypeId: string
  columns: number
  rows: number
  /**
   * Die Ausspielung: wie viele Ports die Sending Card hat und wie viele
   * Pixel einer davon trägt.
   *
   * Beides gehört zusammen und ist deshalb EIN Feld: ein Port ohne
   * Kapazitätsangabe trägt nicht „unbegrenzt", und eine Kapazität ohne
   * Portzahl sagt nichts über die Wand.
   */
  ausspielung?: { ports: number; pixelProPort: number }
  notes?: string
}
