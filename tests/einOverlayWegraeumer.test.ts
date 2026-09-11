import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ───────────────────────────────────────────────────────────────────────────
// Es gibt EINEN Wegraeumer fuer die Erststart-Overlays, nicht fuenf.
//
// GEMESSEN am 2026-09-11: dieselbe Schleife — Backdrop zaehlen, Knopf nach
// Beschriftung suchen, Escape, warten — stand in SECHS Laeufen
// abgeschrieben: `ui-smoke.mjs`, `ui-labels.mjs`, `ui-overflow.mjs`,
// `ui-targets.mjs`, `screenshots.mjs` und `drag-test.mjs`. Die meisten
// trugen den Kommentar „dieselbe Schleife wie in ui-smoke.mjs, und aus
// demselben Grund" — und waren es trotzdem nicht: `screenshots.mjs` hatte
// eine kuerzere Abweisungs-Liste, `drag-test.mjs` gar keine Schleife.
// Sechs Abschriften, mindestens drei verschiedene Regeln.
//
// Aufgefallen ist es, weil eine Aenderung am Plan (cable#852) zwei
// schwebenden Leisten je einen Schliessen-Knopf gab. Der Lauf, der zuerst
// darueber stolperte, wurde repariert; die fuenf anderen Abschriften trugen
// den Fehler weiter und waeren ihn erst in CI losgeworden, einer nach dem
// anderen.
//
// ─── WOGEGEN DIESER LAUF STEHT ────────────────────────────────────────────
//
// Gegen die sechste Abschrift. `zwei-rechnungen` faellt nicht auf, wenn sie
// entsteht — sie faellt auf, wenn jemand eine der Rechnungen aendert, und das
// ist Monate spaeter. Ein Lauf, der die Abschrift beim Anlegen meldet, ist
// der einzige Zeitpunkt, zu dem sie billig ist.
//
// ─── WAS ER NICHT KANN ────────────────────────────────────────────────────
//
// Er erkennt die Abschrift an ihrer VOKABEL („End tour", „Decide later" …),
// nicht an ihrer Bedeutung. Wer dieselbe Schleife mit anderen Woertern
// nachbaut — oder das Overlay ueber einen Klassennamen statt eine
// Beschriftung wegklickt —, kommt durch.
//
// Die groebere Erkennung („nennt `.cp-modal-backdrop` UND sucht einen
// Knopf") stand hier zuerst und war FALSCH: sie meldete `ui-overflow.mjs`,
// das an einer ganz anderen Stelle legitim fragt, ob gerade ein Overlay
// steht, und daneben den Knopf fuers Beispielprojekt sucht. Ein Waechter,
// der Richtiges anschwaerzt, wird beim naechsten Mal angepasst statt
// gelesen.
// ───────────────────────────────────────────────────────────────────────────

const SCRIPTS = resolve(__dirname, '..', 'scripts')
const BIBLIOTHEK = 'lib/erststartOverlay.mjs'

/** Alle .mjs unter scripts/, eine Ebene tief inklusive lib/. */
const laeufe = (): string[] => {
  const raus: string[] = []
  for (const e of readdirSync(SCRIPTS, { withFileTypes: true })) {
    if (e.isFile() && e.name.endsWith('.mjs')) raus.push(e.name)
    else if (e.isDirectory()) {
      for (const f of readdirSync(join(SCRIPTS, e.name))) {
        if (f.endsWith('.mjs')) raus.push(`${e.name}/${f}`)
      }
    }
  }
  return raus.sort()
}

const lies = (rel: string): string => readFileSync(join(SCRIPTS, rel), 'utf8')

describe('der Wegraeumer steht an einer Stelle', () => {
  it('die Bibliothek ist da und exportiert die Funktion', () => {
    // Sonst pruefen die Zusicherungen unten gegen eine Datei, die es nicht
    // gibt, und der Lauf waere aus dem falschen Grund gruen.
    const lib = lies(BIBLIOTHEK)
    expect(lib).toContain('export const erststartOverlayWeg')
    expect(lib).toContain('export const ABWEISUNGEN')
  })

  it('kein zweiter Lauf sucht sich seinen Abweisen-Knopf selbst', () => {
    // Die Signatur der Abschrift ist NICHT „nennt `.cp-modal-backdrop`" —
    // das tun Laeufe auch aus gutem Grund (`ui-overflow` fragt an einer
    // Stelle, ob gerade ein Overlay steht, bevor es misst). Und auch nicht
    // „sucht einen Knopf" — das tun sie alle, um das Beispielprojekt zu
    // laden.
    //
    // Die Signatur ist die ABWEISUNGS-VOKABEL: ein Lauf, der selbst nach
    // „End tour" oder „Decide later" sucht, hat sich einen eigenen
    // Wegraeumer gebaut. Diese Woerter kommen sonst nirgends vor.
    const vokabel = /End tour|Tour beenden|Überspringen|Decide later|Später/
    const abschriften = laeufe().filter((rel) => rel !== BIBLIOTHEK && vokabel.test(lies(rel)))
    expect(
      abschriften,
      `diese Laeufe raeumen wieder selbst auf statt ${BIBLIOTHEK} zu rufen`,
    ).toEqual([])
  })

  it('die Laeufe, die Overlays wegraeumen, rufen die Bibliothek', () => {
    // Die Gegenrichtung: nicht nur „keiner macht es selbst", sondern auch
    // „die fuenf tun es weiterhin". Ohne das waere der Lauf oben auch dann
    // gruen, wenn jemand das Wegraeumen ersatzlos streicht — und dann misst
    // der betroffene Guard ueber einem Overlay, also nichts.
    const erwartet = [
      'drag-test.mjs',
      'screenshots.mjs',
      'ui-labels.mjs',
      'ui-overflow.mjs',
      'ui-smoke.mjs',
      'ui-targets.mjs',
    ]
    for (const rel of erwartet) {
      // Nur der Name, nicht `(win` — `drag-test.mjs` misst gegen den Browser
      // und nennt sein Fenster `page`. Die Bibliothek kommt mit beidem
      // zurecht; sie benutzt nur `evaluate`/`locator`/`keyboard`.
      expect(lies(rel), `${rel} raeumt keine Overlays mehr weg`).toContain('erststartOverlayWeg(')
    }
  })

  it('die Regel selbst ist die geprüfte Fassung', () => {
    // Die drei Eigenschaften, die den Fehler von cable#852 ausmachten: im
    // Overlay suchen, nach z-index waehlen, genug Runden fuer drei Overlays.
    const lib = lies(BIBLIOTHEK)
    expect(lib).toContain("locator('.cp-modal-backdrop')")
    expect(lib).toContain('zIndex')
    const runden = lib.match(/runden\s*=\s*(\d+)/)
    expect(runden, 'keine Rundenzahl gefunden').not.toBeNull()
    expect(Number(runden![1])).toBeGreaterThanOrEqual(8)
  })

  it('sie scheitert laut, statt still weiterzulaufen', () => {
    // Ohne das folgt beim Aufrufer ein 30-Sekunden-Timeout am ersten
    // Menue-Klick, und der sagt nichts ueber die Ursache. `lautScheitern:
    // false` bleibt die AUSNAHME, die der Aufrufer ausdruecklich waehlt —
    // nicht die Vorgabe.
    const lib = lies(BIBLIOTHEK)
    expect(lib).toContain('Erststart-Overlay liess sich nicht schliessen')
    expect(lib).toMatch(/lautScheitern\s*=\s*true/)
  })
})
