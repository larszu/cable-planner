// ───────────────────────────────────────────────────────────────────────────
// Wo ist der Geraetekatalog duenn — und zwar DORT, wo die Zielkunden
// arbeiten? (#878, Akzeptanzkriterium 1)
//
// ─── WARUM DIESE DATEI UND NICHT EINFACH EINTRAEGE ─────────────────────────
//
// #878 nennt fuenf Bereiche, in denen Luecken zuerst zu schliessen sind:
// Kameras, Konverter, Netzwerk, LED-Prozessoren, Intercom. Dazu sagt dasselbe
// Issue zwei Dinge, die zusammen die Form dieser Datei bestimmen:
//
//   „Lieber Herstellerdatenblaetter als Quelle."
//   „Pruefung vor Aufnahme (Ports, Signaltypen, Leistungsaufnahme)"
//
// Ein Eintrag OHNE Datenblatt waere also kein halber Fortschritt, sondern ein
// Rueckschritt: `catalogueEvidence` zaehlt ihn als unbelegt, die Abdeckung
// sinkt, und die Portzahl im Plan saehe aus wie eine Auskunft des Herstellers.
// Genau deshalb steht hier die MESSUNG und nicht geratene Ware.
//
// ─── WAS DIE MESSUNG AM 2026-09-19 ERGAB ───────────────────────────────────
//
// Die Beobachtung aus #878 („knapp 1.000 Eintraege, davon ueber ein Drittel
// Mikrofone") stimmt der Groessenordnung nach und ist nachgerechnet falsch in
// der Zahl: es sind 467 Eintraege, davon 184 Mikrofone — also nicht knapp
// tausend, aber sehr wohl ueber ein Drittel. Die Schieflage ist echt.
//
// Und ein Bereich steht bei NULL: LED-Prozessoren (Novastar, Brompton,
// Megapixel) haben nicht wenige Eintraege, sondern gar keine Kategorie. Das
// ist der Unterschied zwischen „wenig gepflegt" und „kommt nicht vor" — und
// er faellt nur auf, wenn jemand gegen eine Soll-Liste zaehlt statt die
// vorhandenen Kataloge aufzuzaehlen.
//
// ─── DIE RATSCHE ───────────────────────────────────────────────────────────
//
// `tests/katalogLuecken.test.ts` haelt die heutigen Zahlen fest. Wer einen
// Bereich auffuellt, macht den Test rot und zieht die Zahl nach; wer Eintraege
// entfernt, ebenso. Ein Ziel, das niemand nachrechnet, ist ein Vorsatz.
//
// REIN: keine Datei, kein Netz, keine Uhr.
// ───────────────────────────────────────────────────────────────────────────
import { CATALOGUES, type EvidenceEntry } from './catalogueEvidence'

/** Ein Bereich aus #878, in dem Zielkunden arbeiten. */
export interface Zielbereich {
  /** Kennung, wie sie in Test und Bericht auftaucht. */
  id: string
  /**
   * Die Katalog-Kategorien, die auf diesen Bereich zaehlen.
   *
   * WOERTLICH und nicht per Teilzeichenkette: „Video" enthaelt „Video
   * Converter" nicht als Kategorie, sondern nur als Text. Ein `includes`
   * haette den Konverter-Bereich mit Mischern und Routern aufgefuellt und
   * die Luecke zugedeckt, die er messen soll.
   */
  kategorien: readonly string[]
}

/**
 * Die fuenf Bereiche, die #878 nennt — in der Reihenfolge des Issues.
 *
 * Es sind fuenf und nicht mehr: die Liste ist eine Abschrift des
 * Akzeptanzkriteriums, keine eigene Meinung darueber, was ein Katalog
 * enthalten sollte. Wer sie erweitert, erweitert das Issue.
 */
export const ZIELBEREICHE: readonly Zielbereich[] = [
  { id: 'kameras', kategorien: ['Cameras'] },
  { id: 'konverter', kategorien: ['Converter', 'Video Converter'] },
  { id: 'netzwerk', kategorien: ['Networking', 'IP/NDI'] },
  { id: 'led-prozessoren', kategorien: ['LED Processing'] },
  { id: 'intercom', kategorien: ['Intercom'] },
]

export interface Bereichsstand {
  id: string
  /** Eintraege in diesem Bereich. */
  eintraege: number
  /** Davon mit Datenblatt-Link. */
  belegt: number
  /**
   * Hersteller, die schon vorkommen — damit beim Auffuellen sichtbar ist,
   * ob ein Bereich breit oder nur bei einem Hersteller bestueckt ist.
   * Alphabetisch, damit derselbe Baum denselben Bericht ergibt.
   */
  kataloge: string[]
}

export interface LueckenBericht {
  proBereich: Bereichsstand[]
  /** Alle Eintraege ueber alle Kataloge — auch die ausserhalb der Bereiche. */
  eintraegeGesamt: number
  /** Eintraege, die auf einen der Zielbereiche entfallen. */
  eintraegeInBereichen: number
  /**
   * Die groesste Einzelkategorie und ihr Anteil (0..1) am Gesamtkatalog —
   * die Zahl hinter „ueber ein Drittel Mikrofone".
   */
  groessteKategorie: { kategorie: string; eintraege: number; anteil: number }
  /** Bereiche ganz ohne Eintrag. Kein „wenig", sondern „gar nicht". */
  leereBereiche: string[]
}

const anteil = (teil: number, ganz: number): number => (ganz === 0 ? 0 : teil / ganz)

const hatBeleg = (e: EvidenceEntry): boolean =>
  (e.template.manufacturerUrl ?? '').trim().length > 0

/**
 * Der Luecken-Bericht, gerechnet.
 *
 * Liest DIESELBE Katalog-Liste wie `evidenceReport` — nicht eine zweite
 * daneben. Zwei Listen ueber dieselben Kataloge koennten sich unterscheiden,
 * und dann stuende in der Luecken-Messung ein anderer Katalog als in der
 * Beleg-Messung.
 */
export function katalogLuecken(
  catalogues: ReadonlyArray<{ name: string; entries: readonly EvidenceEntry[] }> = CATALOGUES,
): LueckenBericht {
  const proBereich = ZIELBEREICHE.map(({ id, kategorien }) => {
    const treffer = catalogues.flatMap(({ name, entries }) =>
      entries.filter((e) => kategorien.includes(e.template.category)).map((e) => ({ name, e })),
    )
    return {
      id,
      eintraege: treffer.length,
      belegt: treffer.filter((t) => hatBeleg(t.e)).length,
      kataloge: [...new Set(treffer.map((t) => t.name))].sort(),
    }
  })

  const alle = catalogues.flatMap((k) => k.entries)
  const jeKategorie = new Map<string, number>()
  for (const e of alle) {
    jeKategorie.set(e.template.category, (jeKategorie.get(e.template.category) ?? 0) + 1)
  }
  // Bei Gleichstand entscheidet der Name, damit die Ausgabe eindeutig bleibt.
  const groesste = [...jeKategorie.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0] ?? ['', 0]

  return {
    proBereich,
    eintraegeGesamt: alle.length,
    eintraegeInBereichen: proBereich.reduce((s, b) => s + b.eintraege, 0),
    groessteKategorie: {
      kategorie: groesste[0],
      eintraege: groesste[1],
      anteil: anteil(groesste[1], alle.length),
    },
    leereBereiche: proBereich.filter((b) => b.eintraege === 0).map((b) => b.id),
  }
}
