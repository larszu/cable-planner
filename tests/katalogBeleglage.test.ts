// ───────────────────────────────────────────────────────────────────────────
// Sagt der Kopf einer Katalog-Datei die Wahrheit über ihre Beleglage?
//
// ─── DER BEFUND, GEMESSEN 2026-09-09 ───────────────────────────────────────
//
// Vier der sechs Kataloge ohne einen einzigen `manufacturerUrl` behaupten in
// ihrer Kopfzeile genau das Gegenteil:
//
//   blackmagicCatalog.ts  32 Einträge, 0 Belege — „port counts taken from the
//                         official datasheets"
//   cameraCatalog.ts      20 Einträge, 0 Belege — „sourced from official
//                         datasheets / manufacturer spec pages"
//   monitorCatalog.ts     36 Einträge, 0 Belege — „sourced from official
//                         datasheets"
//   ubiquitiCatalog.ts    40 Einträge, 0 Belege — „based on the official
//                         datasheets / ui.com spec pages"
//
// Das sind 128 Einträge, deren Kopf ein Datenblatt nennt, das niemand
// hinterlegt hat. Die beiden übrigen (`greengo`, `misc`) behaupten es nicht;
// `misc` nennt sogar eine andere, tatsächlich vorhandene Quelle („Verified
// against a professional rental-house Rentman inventory, April 2026").
//
// ─── WARUM DAS EINE PRÜFUNG WERT IST UND KEIN KOMMENTAR-GESCHMACK ──────────
//
// Der Nutzer hat es als Symptom gemeldet: „die presets an Geräten die es gibt
// stimmen häufig nicht ganz genau". Wer daraufhin eine Port-Zahl nachsehen
// will, liest den Kopf, findet „taken from the official datasheets" und hört
// auf zu suchen — obwohl im Eintrag darunter kein Link steht, mit dem er es
// nachprüfen könnte. Die Behauptung ist damit schlimmer als ein leeres Feld:
// sie behauptet Prüfbarkeit, die es nicht gibt. Dieselbe Defektform, gegen die
// `catalogueEvidence.ts` schon die ZAHLEN absichert — nur stand die Prosa
// darüber bisher außerhalb jeder Messung.
//
// ─── WAS DIESE DATEI PRÜFT ─────────────────────────────────────────────────
//
// Eine Regel, in BEIDE Richtungen scharf:
//
//   0 Belege  → der Kopf trägt die BELEGLAGE-Zeile und behauptet in seiner
//               Prosa kein Datenblatt.
//   ≥1 Beleg  → der Kopf trägt die BELEGLAGE-Zeile NICHT.
//
// Die zweite Hälfte ist die wichtigere: sie sorgt dafür, dass die Zeile
// wieder verschwindet, sobald jemand die Belege nachträgt. Eine Markierung,
// die nach der Reparatur stehen bleibt, ist beim nächsten Lesen wieder eine
// Lüge — nur in die andere Richtung.
//
// ─── WAS SIE AUSDRÜCKLICH NICHT PRÜFT ──────────────────────────────────────
//
// Nur den KOPF, also den ersten Kommentarblock. Weiter unten stehen
// Feld-Kommentare, die ebenfalls ein Datenblatt nennen (`blackmagicCatalog`:
// „Datenblatt-Fakt statt Port-Zähl-Schätzung"). Die bleiben stehen, und zwar
// bewusst: der Kopf sagt jetzt die Beleglage der ganzen Datei, und damit ist
// eine solche Zeile darunter eingeordnet statt freistehend. Wer sie einzeln
// prüfen will, braucht eine andere Prüfung als diese — diese sagt es hier,
// damit niemand sie für gründlicher hält, als sie ist.
//
// Und sie prüft NICHT, ob die Zahlen stimmen. Das kann von hier aus niemand:
// die Hersteller-Domänen laufen in den Egress-Filter (B-11, dreimal
// nachgemessen, zuletzt 2026-09-09). Diese Datei sorgt dafür, dass der
// Zustand dransteht — nicht dafür, dass er sich ändert.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { evidenceReport } from '../src/renderer/lib/catalogueEvidence'

const LIB = join(__dirname, '..', 'src', 'renderer', 'lib')

/**
 * Die Zeile, die „hier ist kein Beleg" sagt.
 *
 * Wörtlich und ohne Spielraum, damit sie greppbar bleibt und nicht in fünf
 * Umschreibungen zerfällt.
 */
const BELEGLAGE = '// BELEGLAGE: kein Datenblatt-Link je Eintrag (B-11).'

/** Was als Datenblatt-Behauptung gilt — deutsch wie englisch. */
const BEHAUPTUNG = /datasheet|datenblatt|spec page|spezifikationsseite/i

/**
 * Der Kopf einer Katalog-Datei: der erste zusammenhaengende Kommentarblock.
 *
 * NICHT einfach „die ersten Zeilen der Datei". `blackmagicCatalog.ts` stellt
 * seine `import`-Zeilen VOR den Kopf, und eine Prüfung, die schon dort
 * abbricht, liest einen leeren Kopf — und ist auf jeder Behauptung darin
 * grün. Genau so lief der erste Entwurf dieser Datei: Prüfung 2 war grün,
 * während im Kopf „taken from the official datasheets" stand. Deshalb
 * überspringt der Lauf `import`/`export … from`-Zeilen und Leerzeilen und
 * nimmt den ersten Kommentarblock, der danach kommt.
 */
const kopf = (datei: string): string => {
  const zeilen = readFileSync(join(LIB, datei), 'utf8').split('\n')
  const gesammelt: string[] = []
  for (const z of zeilen) {
    const t = z.trim()
    const istKommentar = t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')
    if (istKommentar) {
      gesammelt.push(t)
      continue
    }
    // Vor dem Kopf darf Leerraum und Import stehen; danach beendet die erste
    // Nicht-Kommentar-Zeile den Block.
    if (gesammelt.length > 0) break
    if (t === '' || /^(import|export)\b.*\bfrom\b/.test(t)) continue
    break
  }
  return gesammelt.join('\n')
}

/** `blackmagic` → `blackmagicCatalog.ts`. Gilt für alle 16 Namen. */
const dateiFuer = (name: string): string => `${name}Catalog.ts`

describe('B-11 — der Kopf einer Katalog-Datei sagt seine Beleglage', () => {
  const bericht = evidenceReport()

  it('1. ein Katalog ohne Beleg trägt die BELEGLAGE-Zeile', () => {
    const ohne = bericht.perCatalogue.filter((c) => c.entries > 0 && c.sourced === 0)
    // Gegenprobe zur Prüfung selbst: gäbe es keinen einzigen belegloosen
    // Katalog, liefe die Schleife leer und bewiese nichts. Heute sind es
    // keinem mehr (B-11 abgeschlossen: kein Katalog steht ganz ohne Beleg). Wird die Lücke geschlossen, fällt DIESE
    // Zeile zuerst — und dann gehört die ganze Datei weg, nicht die Zeile.
    expect(ohne.length, 'kein belegloser Katalog mehr — dann ist B-11 erledigt').toBe(0)

    for (const c of ohne) {
      const text = kopf(dateiFuer(c.name))
      expect(
        text.includes(BELEGLAGE),
        `${dateiFuer(c.name)}: ${c.entries} Einträge, 0 Belege — der Kopf sagt es nicht`,
      ).toBe(true)
    }
  })

  it('2. und behauptet OBERHALB davon kein Datenblatt', () => {
    // Der Schnitt liegt an der BELEGLAGE-Zeile, nicht an einzelnen Wörtern:
    // darüber steht, WAS die Datei enthält, darunter, WIE es belegt ist. Der
    // Absatz unter der Zeile darf das Wort „Datenblatt" also brauchen — er
    // erklärt ja gerade, dass keines hinterlegt ist. Ein Regex, der das Wort
    // überall verböte, würde die ehrliche Erklärung mit derselben Härte
    // treffen wie die Behauptung, gegen die sie geschrieben ist.
    for (const c of bericht.perCatalogue.filter((x) => x.entries > 0 && x.sourced === 0)) {
      const text = kopf(dateiFuer(c.name))
      const schnitt = text.indexOf(BELEGLAGE)
      const darueber = schnitt < 0 ? text : text.slice(0, schnitt)
      expect(
        BEHAUPTUNG.test(darueber),
        `${dateiFuer(c.name)}: der Kopf nennt ein Datenblatt, das kein Eintrag hinterlegt`,
      ).toBe(false)
    }
  })

  it('3. ein belegter Katalog trägt die Zeile NICHT', () => {
    const mit = bericht.perCatalogue.filter((c) => c.sourced > 0)
    expect(mit.length).toBeGreaterThan(5)
    for (const c of mit) {
      expect(
        kopf(dateiFuer(c.name)).includes(BELEGLAGE),
        `${dateiFuer(c.name)}: ${c.sourced} Belege, und trotzdem die BELEGLAGE-Zeile`,
      ).toBe(false)
    }
  })

  it('4. die Zählung stammt aus dem einen Bericht, nicht aus einer zweiten Rechnung', () => {
    // Ohne diese Zeile wäre nicht festgehalten, dass hier `evidenceReport()`
    // gelesen wird und nicht noch einmal per Regex gezählt. Zwei Rechnungen
    // über dieselben Kataloge laufen auseinander — der Kopf von
    // `catalogueEvidence.ts` nennt genau das als Grund für die Engstelle.
    expect(bericht.perCatalogue.map((c) => c.name)).toContain('blackmagic')
    expect(bericht.entries).toBe(bericht.sourced + bericht.unsourced)
    expect(bericht.unsourced).toBe(48)
  })
})
