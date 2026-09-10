import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

// ---------------------------------------------------------------------------
// Der Barcode-Decoder liest wirklich — und er liest OHNE Netz.
//
// ─── DER BEFUND ────────────────────────────────────────────────────────────
//
// `lib/barcodeScanner.ts` hing bis 2026-09-10 allein an `BarcodeDetector`.
// Chromium implementiert die API nur auf Android, macOS und ChromeOS; unter
// Windows und Linux gibt es sie nicht. Gemessen im echten Fenster dieses
// Repos (Electron, Chrome/148, Linux):
//
//     { BarcodeDetector: false, getUserMedia: true }
//
// Die Kamera war da, der Decoder nicht. Die Oberflaeche meldete das ehrlich
// und schaltete auf Handeingabe zurueck — auf der haeufigsten Plattform also
// 200 Etiketten abtippen.
//
// ─── WAS DIESER TEST PRUEFT, UND WAS DER ANDERE PRUEFT ─────────────────────
//
// Hier: dass der WASM-Decoder aus einem Bild wirklich den richtigen Text
// holt. Ein Rundlauf mit einem SELBST erzeugten Code — nicht mit dem
// Writer aus demselben Paket, dessen Dokumentation „subject to change a lot"
// sagt, und nicht mit einer abgelegten PNG-Datei, der man beim Lesen nicht
// ansieht, was drinsteht. Code 39 ist einfach genug, um ihn hier
// hinzuschreiben: neun Elemente je Zeichen, drei davon breit.
//
// Ein Test, der nur `typeof readBarcodes === 'function'` prueft, waere gruen,
// wenn die WASM-Datei fehlt.
// ---------------------------------------------------------------------------

/**
 * Code 39, ein Zeichen = 9 Elemente (Strich/Luecke im Wechsel), 3 davon breit.
 * Hier schon als Bitfolge ausgeschrieben: 1 = schwarzes Modul, 0 = weisses.
 * Nur die Zeichen, die die Probe unten braucht — eine vollstaendige Tabelle
 * waere Zierrat.
 */
const CODE39: Record<string, string> = {
  '*': '100101101101',
  '0': '101001101101',
  '2': '101100101011',
  '4': '101001101011',
  'A': '110101001011',
  'B': '101101001011',
  'C': '110110100101',
  '-': '100101011011',
}

const MODUL_BREITE = 3
const HOEHE = 60
/** Ruhezone. Ohne sie findet kein Leser der Welt den Anfang. */
const RAND = 30

/** Ein Code-39-Bild als `ImageData`-Form (Node kennt die Klasse nicht). */
const alsBild = (text: string) => {
  const bits = ['*', ...text, '*'].map((c) => CODE39[c]).join('0')
  const breite = RAND * 2 + bits.length * MODUL_BREITE
  const data = new Uint8ClampedArray(breite * HOEHE * 4).fill(255)
  for (let x = 0; x < bits.length; x += 1) {
    if (bits[x] !== '1') continue
    for (let dx = 0; dx < MODUL_BREITE; dx += 1) {
      const px = RAND + x * MODUL_BREITE + dx
      for (let y = 0; y < HOEHE; y += 1) {
        const i = (y * breite + px) * 4
        data[i] = 0
        data[i + 1] = 0
        data[i + 2] = 0
      }
    }
  }
  return { data, width: breite, height: HOEHE, colorSpace: 'srgb' as const }
}

/**
 * Die Paket-Wurzel aus einem aufgeloesten Einstiegspunkt.
 *
 * `resolve('zxing-wasm/package.json')` waere der direkte Weg und geht nicht:
 * das Paket zaehlt in `exports` auf, was es herausgibt, und die
 * `package.json` steht nicht darin. Aufgeloest wird deshalb der Einstieg, den
 * der Test ohnehin importiert; von dort geht es aufwaerts bis zum Ordner mit
 * dem Paketnamen.
 */
const paketWurzel = (einstieg: string): string => {
  let dir = dirname(createRequire(import.meta.url).resolve(einstieg))
  const name = einstieg.split('/')[0]
  while (basename(dir) !== name) {
    const oben = dirname(dir)
    if (oben === dir) throw new Error(`Paketwurzel von ${einstieg} nicht gefunden`)
    dir = oben
  }
  return dir
}

/**
 * Der Pfad zur WASM-Datei wird AUFGELOEST und nicht zusammengesetzt.
 *
 * `join(process.cwd(), 'node_modules', …)` stimmt genau dann, wenn das Paket
 * neben dem Arbeitsverzeichnis liegt. In einem npm-Workspace liegt es das
 * nicht: dort wird nach oben gehoben, und der Test suchte eine Datei, die es
 * an dieser Stelle nie gab — mit einer Fehlermeldung ueber einen fehlenden
 * Pfad statt ueber einen fehlenden Decoder.
 *
 * Genau so ist es beim Vendorieren in `av-planner-suite` passiert. `resolve`
 * beantwortet die Frage, die hier wirklich gestellt ist — „wo liegt das
 * Paket, das ich gerade importiere" —, und beantwortet sie in beiden Layouts.
 */
const WASM = join(
  paketWurzel('zxing-wasm/reader'),
  'dist',
  'reader',
  'zxing_reader.wasm',
)

describe('Der WASM-Decoder', () => {
  it('liest einen Code 39 aus einem Bild', async () => {
    // Die WASM-Datei kommt aus dem Paket, nicht aus dem Netz — genauso wie
    // im Browser, wo `barcodeScanner.ts` sie ueber einen `?url`-Import aus
    // dem Bundle holt. Ein Test, der sie herunterlaedt, bewiese das Gegenteil
    // von dem, was hier zugesichert wird.
    const wasmBinary = readFileSync(WASM)
    prepareZXingModule({ overrides: { wasmBinary: wasmBinary.buffer as ArrayBuffer } })

    const probe = 'CAB-0042'
    const treffer = await readBarcodes(alsBild(probe) as never, {
      formats: ['Code39'],
      tryHarder: true,
    })
    expect(treffer.map((t) => t.text)).toEqual([probe])
    expect(treffer[0].format).toBe('Code39')
  }, 30_000)

  it('meldet nichts, wo nichts ist', async () => {
    // GEGENPROBE. Ohne sie waere der Test auch dann gruen, wenn der Decoder
    // auf jedes Bild denselben Wert zurueckgaebe — und genau das ist die Art
    // Fehler, die man einem Scanner erst im Lager ansieht.
    const leer = {
      data: new Uint8ClampedArray(200 * 60 * 4).fill(255),
      width: 200,
      height: 60,
      colorSpace: 'srgb' as const,
    }
    const treffer = await readBarcodes(leer as never, { formats: ['Code39'] })
    expect(treffer).toEqual([])
  }, 30_000)
})

describe('Die Verdrahtung im Renderer', () => {
  const quelle = readFileSync(
    join(process.cwd(), 'src', 'renderer', 'lib', 'barcodeScanner.ts'),
    'utf8',
  )

  it('laedt die WASM-Datei aus dem Bundle, nicht aus dem Netz', () => {
    // `zxing-wasm` sucht seine `.wasm` sonst neben dem eigenen Skript — in
    // einem Vite-Bundle also unter `/assets/zxing_reader.wasm`, wo sie nicht
    // liegt. Der `?url`-Import legt sie mit ins Bundle; `locateFile` zeigt
    // darauf. Die App ist offline-first: ein Decoder, der beim ersten Scan
    // ins Netz greift, ist im Hallen-WLAN genau dann kaputt, wenn er
    // gebraucht wird.
    expect(quelle).toContain("from 'zxing-wasm/reader/zxing_reader.wasm?url'")
    expect(quelle).toContain('locateFile: () => wasmUrl')
  })

  it('laedt den Decoder erst beim Scannen nach', () => {
    // 1,09 MB WASM im Haupt-Chunk waeren fuer jeden da, der nie scannt.
    // Ein STATISCHER Import von `zxing-wasm/reader` waere genau das —
    // gesucht wird deshalb der dynamische.
    expect(quelle).toContain("await import('zxing-wasm/reader')")
    expect(quelle).not.toMatch(/^import .*from 'zxing-wasm\/reader'$/m)
  })

  it('nimmt den nativen Weg, wo es ihn gibt', () => {
    // Die Reihenfolge ist kein Zufall: `BarcodeDetector` kostet keinen
    // Download und keine WASM-Instanz. Faellt diese Zeile weg, laedt auch ein
    // Telefon, das die API mitbringt, das Modul nach.
    expect(quelle).toContain('const decoder: Decoder = nativ ?? (await wasmDecoder())')
  })

  it('haengt die Verfuegbarkeit nur noch an der Kamera', () => {
    // Vorher stand in `isBarcodeScannerSupported` zusaetzlich
    // `'BarcodeDetector' in window` — und das machte die Antwort auf Windows
    // und Linux zu einem Nein, obwohl die Kamera bereitstand.
    const zeile = /export const isBarcodeScannerSupported[\s\S]*?\n\n/.exec(quelle)?.[0] ?? ''
    expect(zeile).toContain('getUserMedia')
    expect(zeile).not.toContain('BarcodeDetector')
  })
})

describe('Die CSP laesst WebAssembly zu — und sonst nichts dazu', () => {
  const main = readFileSync(join(process.cwd(), 'src', 'main', 'index.ts'), 'utf8')

  it('erlaubt `wasm-unsafe-eval`', () => {
    // OHNE DIESE ANGABE IST DER DECODER TOT, und zwar erst beim Scan.
    // Gemessen im gepackten Fenster am 2026-09-10:
    //
    //   WebAssembly.instantiateStreaming(): Compiling or instantiating
    //   WebAssembly module violates the following Content Security policy
    //   directive because 'unsafe-eval' is not an allowed source of script
    //   in the following Content Security Policy directive: "script-src 'self'"
    //
    // Die WASM-Datei laedt unter `file://` anstandslos (gemessen: 200,
    // 1 093 289 B) — sie laesst sich nur nicht uebersetzen. Ein Fehler, der
    // die ganze Pruefkette durchlaeuft und jemandem im Lager vor die Fuesse
    // faellt, nicht hier.
    expect(main).toContain("\"script-src 'self' 'wasm-unsafe-eval'; \"")
  })

  it('erlaubt NICHT `unsafe-eval` oder `unsafe-inline` im Skript-Teil', () => {
    // Die beiden sind nicht dasselbe: `wasm-unsafe-eval` erlaubt genau das
    // Uebersetzen von WebAssembly und weiterhin kein `eval()` und keinen
    // `new Function()` fuer JavaScript. Wer beim naechsten WASM-Problem zum
    // breiteren Schalter greift, hebt den Schutz fuer den ganzen Renderer
    // auf — deshalb steht das hier als eigene Zeile und nicht als Kommentar.
    const skriptTeil = /"script-src[^"]*"/.exec(main)?.[0] ?? ''
    expect(skriptTeil).not.toContain("'unsafe-eval'")
    expect(skriptTeil).not.toContain("'unsafe-inline'")
  })
})
