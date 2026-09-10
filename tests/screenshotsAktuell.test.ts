import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Die README-Bilder altern nicht unbemerkt.
//
// ─── WARUM ES DIESEN TEST GIBT, UND WARUM ER ERST HEUTE ENTSTEHT ───────────
//
// Der Kopf von `scripts/screenshots.mjs` sagte seit seiner ersten Fassung:
//
//   > `tests/screenshotsAktuell.test.ts` vergleicht diesen Stempel mit
//   > `package.json` — damit faellt das naechste Altern auf, statt unsichtbar
//   > zu bleiben.
//
// DIESE DATEI GAB ES NICHT. Nachgesehen am 2026-09-10: kein Test unter
// `tests/` las `aufnahme.json`, das Skript war die einzige Stelle, die den
// Namen ueberhaupt nannte. Ein Kommentar, der einen Waechter behauptet, ist
// schlimmer als keiner — er beantwortet die Frage „ist das abgesichert?" mit
// Ja, und niemand sieht nach.
//
// Der Befund, gegen den er steht, ist gemessen: die eingecheckten Aufnahmen
// stammten aus v8.1.0-101, die App stand bei v9.0.1. Dazwischen lagen die
// Sprachdrehung (E-28) und der Icon-Durchgang — auf `properties.png` stand
// eine deutsche Oberflaeche mit Knoepfen, die es nicht mehr gibt.
//
// ─── WARUM NUR MAJOR.MINOR UND NICHT DIE PATCH-STELLE ──────────────────────
//
// Weil ein Test, der bei jedem Patch-Release rot wird, nach dem dritten Mal
// abgeschaltet oder mit einer Ausnahme belegt wird. Eine Patch-Version aendert
// selten die Oberflaeche; eine Minor- oder Major-Version tut es regelmaessig.
// Das ist entscheidbar und ohne Ermessen.
// ---------------------------------------------------------------------------

const WURZEL = process.cwd()
const ORDNER = join(WURZEL, 'docs', 'screenshots')

interface Aufnahme {
  version: string
  dateien: string[]
  hinweis: string
}

const aufnahme = (): Aufnahme =>
  JSON.parse(readFileSync(join(ORDNER, 'aufnahme.json'), 'utf8')) as Aufnahme

const appVersion = (): string =>
  (JSON.parse(readFileSync(join(WURZEL, 'package.json'), 'utf8')) as { version: string }).version

const majorMinor = (v: string) => v.split('.').slice(0, 2).join('.')

/**
 * Bilder im Ordner, die NICHT aus `docs:shots` stammen.
 *
 * Sie sind von Hand geliefert und altern genau deshalb schneller — der Test
 * nennt sie, statt sie stillschweigend zu uebergehen. Wer eines davon
 * automatisierbar macht, streicht es hier und traegt den Schritt im Skript
 * nach.
 */
const VON_HAND = ['atem-multiview.png']

describe('Die README-Bilder sind gegen die aktuelle Version aufgenommen', () => {
  it('der Stempel nennt dieselbe Minor-Version wie package.json', () => {
    expect(
      majorMinor(aufnahme().version),
      'Die Bilder stammen aus einer aelteren Minor-Version. Ein Titelbild ist ' +
        'die erste Auskunft ueber das Produkt, und eine veraltete ist eine ' +
        'falsche. Neu aufnehmen: `npm run build && xvfb-run -a npm run docs:shots`.',
    ).toBe(majorMinor(appVersion()))
  })

  it('jede gestempelte Datei liegt auch wirklich da', () => {
    const fehlend = aufnahme().dateien.filter((d) => !existsSync(join(ORDNER, d)))
    expect(
      fehlend,
      'Der Stempel nennt eine Datei, die es nicht gibt — das README verweist ' +
        'dann auf ein Bild, das niemand sieht.',
    ).toEqual([])
  })

  it('kein Bild im Ordner ist unbekannter Herkunft', () => {
    // Die Gegenrichtung: eine Datei, die weder aus dem Lauf stammt noch als
    // handgeliefert benannt ist, altert unbemerkt — genau der Zustand, aus dem
    // dieser Test entstanden ist.
    const gestempelt = new Set([...aufnahme().dateien, ...VON_HAND])
    const fremd = readdirSync(ORDNER).filter((d) => /\.(png|gif)$/i.test(d) && !gestempelt.has(d))
    expect(
      fremd,
      'Ein Bild im Ordner stammt weder aus `docs:shots` noch steht es in ' +
        'VON_HAND. Entweder einen Aufnahme-Schritt ins Skript legen oder es ' +
        'dort mit Grund eintragen.',
    ).toEqual([])
  })

  it('das Beispiel-Rack ist im Bildersatz — der Weg in die 3D-Ansicht', () => {
    // `rack-3d.png` war zweimal blockiert (kein Rack im Beispiel, und
    // `--disable-gpu` im Aufnahme-Lauf). Faellt einer der beiden zurueck,
    // ueberspringt das Skript den Schritt still und der Stempel verliert die
    // Datei — hier faellt das auf.
    expect(aufnahme().dateien).toContain('rack-3d.png')
  })

  it('der Aufnahme-Lauf schaltet WebGL nicht ab', () => {
    // Gemessen: mit `--disable-gpu` gibt `canvas.getContext('webgl')` `null`
    // zurueck, das Canvas bleibt auf 300x150 und die 3D-Flaeche ist schwarz.
    // Der Schalter waere ein stiller Rueckfall — das Bild entstuende weiter,
    // nur leer.
    const skript = readFileSync(join(WURZEL, 'scripts', 'screenshots.mjs'), 'utf8')
    expect(skript).not.toMatch(/'--disable-gpu'/)
    expect(skript).toMatch(/--use-gl=swiftshader/)
  })
})
