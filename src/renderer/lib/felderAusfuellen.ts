// ───────────────────────────────────────────────────────────────────────────
// Felder ausfuellen — EIN Weg, eine Quelle, eine Einstellung (#858).
//
// DER BEFUND, DER DIESE DATEI NOETIG MACHT. Nutzer-Meldung: „heuristik
// funktioniert nicht, kann also weg. Ebenso muss es nur einen mit ausfuellen
// Knopf geben den man in den Einstellungen konfigurieren kann."
//
// Gezaehlt vor dieser Aenderung: SECHS Knoepfe auf drei Flaechen, die
// dasselbe tun — Felder eines Geraets mit geratenen Ports fuellen.
//
//   Anlegen-Dialog (`LibraryPanel`)          „Heuristik" · „Web" · „Gemini"
//   Rentman-Assistent (`NewRentmanDevice…`)  „Websuche" · „KI (Gemini)"
//                                            + ein STILLER Heuristik-Lauf
//                                            beim Schrittwechsel
//   Eigenschaften (`PortAiSuggestButton`)    „Ports vorschlagen" (nur KI)
//
// Drei Knoepfe nebeneinander sind keine Auswahl, sondern eine Pruefung: der
// Nutzer soll entscheiden, welche der drei Quellen fuer SEIN Geraet die
// beste ist, bevor er weiss, was sie liefern. Das ist die Frage der
// Anwendung an sich selbst, nicht die des Nutzers. Sie wird jetzt EINMAL in
// den Einstellungen beantwortet, und der Knopf heisst „Ausfuellen".
//
// WARUM DIE HEURISTIK GANZ WEG IST, und nicht nur aus der Leiste.
//
// `suggestPortGroups` war eine Liste aus zehn regulaeren Ausdruecken mit
// festen Port-Zahlen dahinter. Zwei Dinge daran waren nicht reparierbar:
//
//   1. Die Zahlen gehoeren keinem Geraet. Die Regel `\b(switcher|atem|…)\b`
//      liefert JEDEM Treffer „8 SDI In, 2 Program, 1 Multiview". Ein ATEM
//      Mini hat vier HDMI-Eingaenge und keinen einzigen SDI-Eingang. Die
//      Regel traf ihn und log.
//   2. Sie sagte nie „weiss ich nicht". Ohne Treffer lieferte sie
//      `1 Custom In / 1 Custom Out` — eine Angabe, die wie eine Messung
//      aussieht und keine ist. Der Zweig, der „kein Treffer" melden sollte
//      (`library.suggest.heuristic.noMatch`), war deshalb toter Code: die
//      Funktion gab nie eine leere Liste zurueck.
//
// Die beiden uebrigen Quellen raten auch — aber sie sagen, WORAUS: die
// Websuche bringt ihre Fundstelle und den Schnipsel mit, in dem die Stecker
// gezaehlt wurden, das Modell nennt sich als Urheber. Beides landet als
// `specSource` an der Vorlage und ist damit nachpruefbar. Die Heuristik
// hatte nichts dergleichen; ihr Beleg lautete „Heuristik aus Name und
// Kategorie", was nur eine hoefliche Form von „geraten" ist.
//
// WAS DIESE DATEI NICHT TUT. Sie uebersetzt nicht. Sie liefert die Rohdaten
// und wer sie geliefert hat; der Satz, der daraus im Fenster steht, entsteht
// in der Ansicht — dort, wo `t()` ausgeschrieben steht und der
// Sprach-Waechter ihn findet.
// ───────────────────────────────────────────────────────────────────────────
import { suggestFromAI } from './aiSuggestions'
import { suggestFromWeb } from './webPortSuggestions'
import type { PortGroupHint } from './portSuggestions'

/**
 * Die Quellen, die es noch gibt.
 *
 * Kein `'heuristik'` mehr, und auch kein `'keine'`: ein Knopf, der nichts
 * tut, waere schlimmer als kein Knopf. Wer nicht raten lassen will, drueckt
 * ihn nicht.
 */
export type AusfuellQuelle = 'web' | 'ki'

export const AUSFUELL_QUELLEN: AusfuellQuelle[] = ['web', 'ki']

/**
 * Die Vorgabe ist die Websuche und nicht die KI.
 *
 * Nicht, weil sie besser raet — sondern weil sie ohne Schluessel laeuft und
 * ihre Fundstelle mitbringt. Die KI-Vorgabe haette bei jedem neuen Nutzer
 * denselben ersten Klick: eine Fehlermeldung „kein API-Key".
 */
export const AUSFUELL_VORGABE: AusfuellQuelle = 'web'

export interface AusfuellErgebnis {
  hints: PortGroupHint[]
  /** Welche Quelle geantwortet hat — die Ansicht baut daraus den Beleg. */
  quelle: AusfuellQuelle
  /** Die Fundstelle der Websuche (Wikipedia, DuckDuckGo). Bei der KI leer. */
  fundstelle?: string
  /** Der Textausschnitt, in dem gezaehlt wurde. Bei der KI leer. */
  schnipsel?: string
}

/**
 * Ein Aufruf, eine Quelle, ein Ergebnis.
 *
 * Der `switch` ist die einzige Stelle im Programm, an der entschieden wird,
 * WEN man fragt. Vorher stand diese Entscheidung dreimal im Markup — je
 * einmal pro Knopf — und einmal unsichtbar im Rentman-Assistenten, der die
 * Heuristik ohne Klick laufen liess.
 */
export const felderAusfuellen = async (
  quelle: AusfuellQuelle,
  geraetename: string,
  kategorie: string,
): Promise<AusfuellErgebnis> => {
  if (quelle === 'ki') {
    const hints = await suggestFromAI(geraetename, kategorie)
    return { hints, quelle: 'ki' }
  }
  const { hints, source, snippet } = await suggestFromWeb(geraetename, kategorie)
  return { hints, quelle: 'web', fundstelle: source, schnipsel: snippet }
}
