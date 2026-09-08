// ───────────────────────────────────────────────────────────────────────────
// Das Nachweis-Paket: ein Deckblatt für den neuen Kunden (Bedarf 120, P4).
//
// Der Freiberufler schickt heute pro Kunde und pro Verlängerung Scans aus
// einem Ordner. Was fehlt, ist nicht der Ordner — es ist das BLATT davor: was
// liegt bei, bis wann gilt es, und was fehlt noch.
//
// ═══════════════════════════════════════════════════════════════════════════
// DREI REGELN, UND ALLE DREI SIND DIESELBE
// ═══════════════════════════════════════════════════════════════════════════
//
// 1. EIN NACHWEIS OHNE FRIST IST NICHT GÜLTIG, sondern ohne Frist. Er steht
//    als solcher auf dem Blatt (`ohne-frist`) und wird nie zu „gültig".
// 2. EIN ABGELAUFENER NACHWEIS WIRD NICHT WEGGELASSEN. Ihn stillschweigend
//    aus dem Paket zu nehmen liesse den Kunden glauben, es gebe ihn nicht —
//    dabei gibt es ihn, nur abgelaufen. Er steht drauf, mit seiner Lage.
// 3. EINE DATEI, DIE NICHT BENANNT IST, LIEGT NICHT BEI. Das Blatt schreibt
//    „keine Datei benannt" statt einer leeren Zelle; eine leere Zelle liest
//    sich auf einem Ausdruck wie „nichts weiter zu sagen".
//
// Alle drei sagen dasselbe: das Blatt behauptet nie mehr, als angegeben ist.
// Ein Paket, das vollständiger aussieht als es ist, ist genau der Grund, aus
// dem der Kunde später anruft.
//
// ═══════════════════════════════════════════════════════════════════════════
// DIE VORWARNZEIT WIRD ANGEGEBEN, NICHT VORAUSGESETZT
// ═══════════════════════════════════════════════════════════════════════════
//
// „Läuft in 30 Tagen ab" wäre eine bequeme Vorgabe — und eine Meinung darüber,
// wie lange eine Verlängerung in diesem Geschäft dauert. Diese Anwendung hat
// dazu keine (dieselbe Haltung wie `CostPlan.tolerancePercent`: „Eine
// voreingestellte Toleranz wäre eine Meinung darüber, was in diesem Geschäft
// normal ist"). Ohne angegebene Vorwarnzeit meldet `laeuftBaldAb` NICHTS —
// und das ist ehrlicher als eine Warnung, die auf einer geratenen Zahl steht.
//
// REIN: keine Uhr, kein Store, kein IO. Der Stichtag kommt von aussen herein.
// ───────────────────────────────────────────────────────────────────────────

import type { Nachweis, NachweisLage } from '../types/nachweis'
import { NACHWEIS_ART_LABEL, NACHWEIS_LAGE_LABEL } from '../types/nachweis'
import type { CsvTable } from './csv'

/** Was in einer Zelle steht, wenn niemand etwas angegeben hat. */
export const OHNE_ANGABE = 'nicht angegeben'

/** Was dort steht, wo eine Datei stehen könnte und keine benannt ist. */
export const OHNE_DATEI = 'keine Datei benannt'

/**
 * Die Lage eines Nachweises am Stichtag.
 *
 * Der Stichtag kommt herein; dieses Modul hat keine Uhr. Ein unlesbares Datum
 * ergibt `ohne-frist` und nicht `abgelaufen`: aus „das kann ich nicht lesen"
 * ein „das ist vorbei" zu machen wäre eine Behauptung über fremde Angaben.
 */
export const nachweisLage = (n: Nachweis, stichtagIso: string): NachweisLage => {
  const roh = n.gueltigBis?.trim()
  if (!roh) return 'ohne-frist'
  const bis = Date.parse(roh)
  const stichtag = Date.parse(stichtagIso)
  if (Number.isNaN(bis) || Number.isNaN(stichtag)) return 'ohne-frist'
  // Der Tag, an dem die Frist endet, zählt noch als gültig — so steht es auf
  // jedem Papier („gültig bis").
  return bis >= stichtag ? 'in-frist' : 'abgelaufen'
}

/** Wieviele Tage bis zum Fristende. `undefined`, wenn es keine Frist gibt. */
export const tageBisFrist = (n: Nachweis, stichtagIso: string): number | undefined => {
  const roh = n.gueltigBis?.trim()
  if (!roh) return undefined
  const bis = Date.parse(roh)
  const stichtag = Date.parse(stichtagIso)
  if (Number.isNaN(bis) || Number.isNaN(stichtag)) return undefined
  return Math.floor((bis - stichtag) / 86_400_000)
}

/**
 * Welche Nachweise bald ablaufen.
 *
 * OHNE ANGEGEBENE VORWARNZEIT: KEINE. Nicht „alle innerhalb von 30 Tagen" —
 * siehe den Modulkopf. Der Aufrufer sagt, was für ihn „bald" heisst.
 */
export const laeuftBaldAb = (
  nachweise: readonly Nachweis[],
  stichtagIso: string,
  vorwarnTage: number | undefined,
): Nachweis[] => {
  if (typeof vorwarnTage !== 'number' || !Number.isFinite(vorwarnTage) || vorwarnTage < 0) return []
  return nachweise.filter((n) => {
    const tage = tageBisFrist(n, stichtagIso)
    return tage !== undefined && tage >= 0 && tage <= vorwarnTage
  })
}

/** Eine Zeile des Deckblatts. */
export interface PaketZeile {
  nachweisId: string
  art: string
  bezeichnung: string
  aussteller: string
  nummer: string
  gueltigBis: string
  lage: NachweisLage
  datei: string
}

export interface NachweisPaket {
  /** Alle ausgewählten Nachweise, in der Reihenfolge, in der sie hereinkamen. */
  zeilen: PaketZeile[]
  /**
   * Die abgelaufenen darunter, namentlich.
   *
   * Nicht als Ersatz für ihre Zeile, sondern zusätzlich: wer das Blatt
   * überfliegt, soll nicht erst jede Zeile lesen müssen, um zu sehen, dass
   * eines dabei ist.
   */
  abgelaufen: PaketZeile[]
  /** Die ohne angegebene Frist. Ebenfalls zusätzlich, aus demselben Grund. */
  ohneFrist: PaketZeile[]
  /** Die ohne benannte Datei — das Paket ist an dieser Stelle unvollständig. */
  ohneDatei: PaketZeile[]
}

const zeileVon = (n: Nachweis, stichtagIso: string): PaketZeile => ({
  nachweisId: n.id,
  art: NACHWEIS_ART_LABEL[n.art],
  bezeichnung: n.bezeichnung.trim() || OHNE_ANGABE,
  aussteller: n.aussteller?.trim() || OHNE_ANGABE,
  nummer: n.nummer?.trim() || OHNE_ANGABE,
  gueltigBis: n.gueltigBis?.trim() || OHNE_ANGABE,
  lage: nachweisLage(n, stichtagIso),
  datei: n.dateiName?.trim() || OHNE_DATEI,
})

/**
 * Das Paket zusammenstellen.
 *
 * NICHTS WIRD AUSSORTIERT. Was der Nutzer ausgewählt hat, steht drauf — auch
 * das Abgelaufene, auch das ohne Frist. Die drei Listen daneben sind
 * Hinweise, keine Filter.
 */
export const nachweisPaket = (
  auswahl: readonly Nachweis[],
  stichtagIso: string,
): NachweisPaket => {
  const zeilen = auswahl.map((n) => zeileVon(n, stichtagIso))
  return {
    zeilen,
    abgelaufen: zeilen.filter((z) => z.lage === 'abgelaufen'),
    ohneFrist: zeilen.filter((z) => z.lage === 'ohne-frist'),
    ohneDatei: zeilen.filter((z) => z.datei === OHNE_DATEI),
  }
}

/**
 * Das Deckblatt als Tabelle.
 *
 * Die Zusammenfassung steht MIT DRIN, als eigene Zeilen unter der Liste: das
 * Blatt geht an einen Kunden und wird dort allein gelesen. Auch die Nullfälle
 * stehen da — „0 abgelaufen" ist eine Aussage, ihr Fehlen wäre keine.
 */
export const nachweisDeckblatt = (paket: NachweisPaket): CsvTable => {
  const rows: CsvTable['rows'] = paket.zeilen.map((z) => [
    z.art,
    z.bezeichnung,
    z.aussteller,
    z.nummer,
    z.gueltigBis,
    NACHWEIS_LAGE_LABEL[z.lage],
    z.datei,
  ])
  rows.push([`${paket.abgelaufen.length} abgelaufen`, '', '', '', '', '', ''])
  rows.push([`${paket.ohneFrist.length} ohne angegebene Frist`, '', '', '', '', '', ''])
  rows.push([`${paket.ohneDatei.length} ohne benannte Datei`, '', '', '', '', '', ''])
  return {
    headers: [
      'Art',
      'Bezeichnung',
      'Aussteller',
      'Nummer',
      'Gültig bis',
      'Lage',
      'Datei',
    ],
    rows,
  }
}
