// ───────────────────────────────────────────────────────────────────────────
// Versicherungsliste und Carnet-Datenblatt aus dem Bestand (Bedarf 118, P4).
//
//   > A personal kit register with serials, purchase price and insurance value
//   > that doubles as a delivery note … Insurance schedule, carnet list and
//   > dry-hire delivery note are all re-derived from it by hand.
//
// ─── ZWEI DER DREI ARTEFAKTE GAB ES SCHON ──────────────────────────────────
//
// Der LIEFERSCHEIN ist gebaut: ein `CheckoutRecord` ist ein Container mit
// eingefrorenem Inhalt, `checkoutSheet` macht das Blatt daraus und
// `handoverSignatureTable` die Quittung für beide Beine (Bedarfe 15, 16, 136).
// Ihn hier ein zweites Mal zu erzeugen wäre `zwei-rechnungen` mit einem Beleg,
// und die beiden Fassungen wichen beim ersten Sonderfall voneinander ab.
//
// Was fehlte, ist die WERT-Hälfte. Der Bestand kannte Seriennummern
// (`serial`), Hausnummern (`houseRef`) und Zustände — aber keinen Preis und
// keinen Versicherungswert. Die stehen jetzt an der Einheit
// (`InventoryUnit.anschaffung`, `.versicherungswert`), und dieses Modul macht
// die zwei Blätter daraus, die der Freiberufler sonst von Hand abtippt.
//
// ─── DIE GEFÄHRLICHE ZAHL IST DIE SUMME ────────────────────────────────────
//
// Eine Versicherungssumme über einen Bestand, in dem die Hälfte der Einheiten
// keinen Wert trägt, ist die Zahl, mit der jemand unterversichert in einen
// Schadensfall geht — und sie sieht aus wie eine Auskunft. Deshalb:
//
//   * Die Summe kommt NIE allein. `VersicherungsListe.ohneWert` führt die
//     Einheiten ohne angegebenen Wert namentlich, und die CSV-Tabelle trägt
//     sie als eigene Zeilen mit, weil ein Blatt beim Versicherer allein
//     gelesen wird und dort niemand die Anwendung daneben stehen hat.
//   * Summiert wird JE WÄHRUNG. Zwei Währungen in einer Summe sind eine Zahl,
//     die nichts bedeutet (dieselbe Regel wie im Kostenplan) — und ein
//     Umrechnungskurs wäre ein Wert ohne Fundstelle.
//   * Es gibt KEINEN Zeitwert. Nach welcher Regel abgeschrieben wird,
//     entscheidet der Versicherer; die Anwendung kennt seinen Vertrag nicht.
//
// ─── DAS CARNET WIRD NICHT GEBAUT, SONDERN BELIEFERT ───────────────────────
//
// Ein Carnet A.T.A. ist ein Zolldokument mit vorgeschriebener Form, ausgestellt
// von der Handelskammer. Etwas zu drucken, das danach aussieht, wäre eine
// Zusage über amtliche Gültigkeit, die diese Anwendung nicht halten kann.
// `carnetDatenblatt` liefert die SPALTEN, die eine Carnet-Position braucht —
// Anzahl, Beschreibung, Marke/Nummer, Gewicht, Wert, Ursprungsland —, damit
// der Mensch sie in sein Formular überträgt. Dieselbe Haltung wie bei den
// Sicherheits-Papieren (Bedarf 131): das Datenblatt liefern, das Dokument
// nicht besitzen.
//
// REIN: keine Uhr, kein Store, kein IO. Der Stand kommt von aussen herein.
// ───────────────────────────────────────────────────────────────────────────

import type { Geldbetrag, InventoryItem, InventoryUnit } from '../types/inventory'
import type { CsvTable } from '../../lib/csv'

/** Was in einer Zelle steht, wenn niemand etwas angegeben hat. */
export const NICHT_ANGEGEBEN = 'nicht angegeben'

/**
 * Eine Zeile der Versicherungsliste.
 *
 * `wert` fehlt, wenn keiner angegeben ist — und wird NICHT durch die
 * Anschaffung ersetzt. Die beiden sind verschiedene Angaben; die eine für die
 * andere einzusetzen wäre ein geratener Versicherungswert, und geraten wird
 * hier nichts.
 */
export interface VersicherungsZeile {
  unitId: string
  modell: string
  serial?: string
  houseRef?: string
  wert?: Geldbetrag
  /** Stand des Werts (ISO-Datum), wenn angegeben. */
  stand?: string
}

/** Eine Summe — je Währung eine. */
export interface WaehrungsSumme {
  waehrung: string
  cent: number
  /** Wieviele Einheiten in diese Summe eingegangen sind. */
  einheiten: number
}

export interface VersicherungsListe {
  zeilen: VersicherungsZeile[]
  /**
   * Summen je Währung, alphabetisch. NIE zusammengelegt.
   *
   * Leer, wenn keine einzige Einheit einen Wert trägt — und dann ist die
   * ehrliche Anzeige „keine Werte angegeben" und nicht „0".
   */
  summen: WaehrungsSumme[]
  /**
   * Die Einheiten OHNE angegebenen Versicherungswert, namentlich.
   *
   * Nicht bloss eine Zahl: wer die Liste vervollständigen will, braucht zu
   * wissen WELCHE fehlen. Und wer die Summe liest, muss sehen, worüber sie
   * nichts sagt.
   */
  ohneWert: VersicherungsZeile[]
}

const geldZahl = (b: Geldbetrag): string => (b.cent / 100).toFixed(2)

/** `1234.50 EUR` — Betrag und Währung, nie getrennt. */
export const geldText = (b: Geldbetrag): string => `${geldZahl(b)} ${b.waehrung}`

const zeileVon = (u: InventoryUnit, modell: string): VersicherungsZeile => ({
  unitId: u.id,
  modell,
  serial: u.serial?.trim() || undefined,
  houseRef: u.houseRef?.trim() || undefined,
  wert: u.versicherungswert?.betrag,
  stand: u.versicherungswert?.stand,
})

/**
 * Ein Betrag zählt nur, wenn er wirklich einer ist.
 *
 * Eine Währung als Leerstring hiesse „irgendeine", und dann läge ein Betrag
 * ohne Währung in einer Summe. Ein `cent`, das keine endliche Zahl ist,
 * machte die ganze Summe zu `NaN` — und `NaN` sieht auf einem Blatt aus wie
 * ein Fehler der Anwendung, nicht wie eine fehlende Angabe.
 */
const istBetrag = (b: Geldbetrag | undefined): b is Geldbetrag =>
  !!b && Number.isFinite(b.cent) && typeof b.waehrung === 'string' && b.waehrung.trim() !== ''

/**
 * Aus zwei Eingabefeldern ein Geldbetrag — oder keiner.
 *
 * DIE EINE STELLE, an der aus Getipptem Geld wird. Sie steht hier und nicht im
 * Dialog, damit die Regel prüfbar ist und es nicht zwei Fassungen davon gibt
 * (Anschaffung und Versicherungswert benutzen dieselbe).
 *
 * OHNE WÄHRUNG KEIN BETRAG. Ein getippter Betrag ohne Währungskürzel ergibt
 * `undefined` und nicht etwa „EUR": eine Zahl ohne Währung ist in einer
 * Versicherungssumme nichts wert, und sie stillschweigend zu einer Währung zu
 * erklären wäre eine Annahme über den Vertrag eines anderen.
 *
 * Das Komma ist erlaubt — hier wird deutsch getippt. Gerechnet wird in Cent,
 * ganzzahlig gerundet.
 */
export const geldAusEingabe = (betrag: string, waehrung: string): Geldbetrag | undefined => {
  const w = waehrung.trim().toUpperCase()
  const roh = betrag.trim().replace(',', '.')
  if (w === '' || roh === '') return undefined
  const zahl = Number(roh)
  if (!Number.isFinite(zahl) || zahl < 0) return undefined
  return { cent: Math.round(zahl * 100), waehrung: w }
}

/** Ein Betrag zurück ins Eingabefeld — „1234.50". */
export const eingabeAusGeld = (b: Geldbetrag | undefined): string =>
  b && Number.isFinite(b.cent) ? geldZahl(b) : ''

/**
 * Die Versicherungsliste bauen.
 *
 * `modellVon` löst den Artikelnamen auf — dieselbe Form wie `identityTable`
 * in `unitIdentity.ts`, damit es keine zweite Auflösung Einheit -> Modell
 * gibt.
 */
export const versicherungsListe = (
  units: readonly InventoryUnit[],
  modellVon: (unit: InventoryUnit) => string,
): VersicherungsListe => {
  const zeilen = units.map((u) => zeileVon(u, modellVon(u)))
  const nachWaehrung = new Map<string, WaehrungsSumme>()
  const ohneWert: VersicherungsZeile[] = []

  for (const z of zeilen) {
    if (!istBetrag(z.wert)) {
      ohneWert.push(z)
      continue
    }
    const w = z.wert.waehrung.trim()
    const bisher = nachWaehrung.get(w) ?? { waehrung: w, cent: 0, einheiten: 0 }
    bisher.cent += Math.round(z.wert.cent)
    bisher.einheiten += 1
    nachWaehrung.set(w, bisher)
  }

  return {
    zeilen,
    summen: [...nachWaehrung.values()].sort((a, b) => a.waehrung.localeCompare(b.waehrung)),
    ohneWert,
  }
}

/**
 * Die Versicherungsliste als CSV-Tabelle.
 *
 * Die Summen und die Einheiten ohne Wert stehen MIT DRIN, als eigene Zeilen
 * unter der Liste. Ein Blatt, das beim Versicherer landet, wird allein
 * gelesen — eine Summe, deren Lücken nur in der Anwendung stehen, ist dort
 * eine Zahl ohne Vorbehalt.
 */
export const versicherungsTabelle = (liste: VersicherungsListe): CsvTable => {
  const rows: CsvTable['rows'] = liste.zeilen.map((z) => [
    z.modell,
    z.serial ?? NICHT_ANGEGEBEN,
    z.houseRef ?? NICHT_ANGEGEBEN,
    istBetrag(z.wert) ? geldZahl(z.wert) : NICHT_ANGEGEBEN,
    istBetrag(z.wert) ? z.wert.waehrung : '',
    z.stand ?? NICHT_ANGEGEBEN,
  ])

  for (const s of liste.summen) {
    rows.push([`Summe (${s.einheiten} Einheiten)`, '', '', geldZahl(s), s.waehrung, ''])
  }
  // Die Zeile, die den Vorbehalt trägt. Sie steht auch dann da, wenn nichts
  // fehlt — „0 Einheiten ohne angegebenen Wert" ist eine Aussage, ihr Fehlen
  // wäre keine.
  rows.push([
    `${liste.ohneWert.length} Einheiten ohne angegebenen Versicherungswert`,
    '',
    '',
    '',
    '',
    '',
  ])
  for (const z of liste.ohneWert) {
    rows.push([z.modell, z.serial ?? NICHT_ANGEGEBEN, z.houseRef ?? NICHT_ANGEGEBEN, NICHT_ANGEGEBEN, '', ''])
  }

  return {
    headers: ['Modell', 'Herstellernummer', 'Hausreferenz', 'Versicherungswert', 'Währung', 'Stand'],
    rows,
  }
}

/**
 * Das Carnet-Datenblatt.
 *
 * KEIN Carnet — die Spalten, die eine Carnet-Position braucht, damit der
 * Mensch sie in sein Formular überträgt. Was nicht angegeben ist, steht als
 * `nicht angegeben` da und nicht als leere Zelle: eine leere Zelle sieht auf
 * einem Ausdruck aus wie „nichts zu melden".
 *
 * Der Wert ist hier der ANSCHAFFUNGSPREIS und nicht der Versicherungswert.
 * Ein Carnet nennt den Warenwert; welcher von beiden der Zoll sehen will,
 * entscheidet nicht diese Anwendung — deshalb steht die Spalte so
 * beschriftet, wie sie gefüllt ist, statt neutral „Wert" zu heissen.
 */
export const carnetDatenblatt = (
  units: readonly InventoryUnit[],
  artikelVon: (unit: InventoryUnit) => InventoryItem | undefined,
): CsvTable => ({
  headers: [
    'Beschreibung',
    'Herstellernummer',
    'Gewicht (kg)',
    'Anschaffungspreis',
    'Währung',
    'Ursprungsland',
  ],
  rows: units.map((u) => {
    const artikel = artikelVon(u)
    const gewicht = artikel?.dimensions?.weightKg
    const kauf = u.anschaffung?.betrag
    const name = [artikel?.manufacturer, artikel?.model].filter(Boolean).join(' ').trim()
    return [
      name || NICHT_ANGEGEBEN,
      u.serial?.trim() || NICHT_ANGEGEBEN,
      typeof gewicht === 'number' && Number.isFinite(gewicht) ? gewicht : NICHT_ANGEGEBEN,
      istBetrag(kauf) ? geldZahl(kauf) : NICHT_ANGEGEBEN,
      istBetrag(kauf) ? kauf.waehrung : '',
      artikel?.ursprungsland?.trim() || NICHT_ANGEGEBEN,
    ]
  }),
})
