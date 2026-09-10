import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Der QR-Decoder der Mobile-Ansicht liegt HINTER einer Lazy-Grenze.
//
// ─── WARUM DAS EINE EIGENE ZUSICHERUNG BRAUCHT (#821) ──────────────────────
//
// Weil der Unterschied zwischen „laedt nach" und „liegt im Chunk" im Quelltext
// ein einziges Zeichen ist — `await import(…)` gegen `import … from …` — und
// weil man ihn der laufenden Seite nicht ansieht. Er faellt erst im
// Hallen-WLAN auf, auf einem Telefon, das die Seite nicht aufbekommt.
//
// Gemessen am 2026-09-10, nach dem Einbau:
//
//     mobile-*.js            75,2 kB   (gzip  21,0 kB)
//     zxing_reader.wasm    1093,3 kB   (gzip 463,8 kB)
//
// Das WASM ist das 15-fache der Seite. Es kommt erst, wenn jemand das
// Scan-Overlay OEFFNET — eine bewusste Handlung, kein Seitenaufbau. Wer die
// Mobile-Ansicht nur liest, zieht es nie.
//
// Dieselbe Lehre wie bei der Three.js-Grenze (`threeBundleGrenze.test.ts`):
// was den Chunk klein haelt, ist die Lazy-Grenze und nicht der Import-Ort.
// ---------------------------------------------------------------------------

const lies = (...teile: string[]): string =>
  readFileSync(join(process.cwd(), ...teile), 'utf8')

describe('Die Mobile-Ansicht laedt den Decoder nach', () => {
  const decoder = lies('src', 'mobile', 'qrDecoder.ts')
  const app = lies('src', 'mobile', 'MobileApp.tsx')

  it('holt zxing dynamisch, nicht statisch', () => {
    expect(decoder).toContain("await import('zxing-wasm/reader')")
    // Ein statischer Import zoege das Paket in den Mobile-Chunk. Der
    // `?url`-Import der WASM-Datei ist KEIN solcher: er liefert nur eine
    // Adresse und laedt nichts.
    expect(decoder).not.toMatch(/^import .*from 'zxing-wasm\/reader'$/m)
  })

  it('nimmt den nativen Weg zuerst', () => {
    // `BarcodeDetector` kostet keinen Download und keine WASM-Instanz, und
    // die Geraete, die sie mitbringen (Android), sind genau die, auf denen
    // diese Ansicht am haeufigsten laeuft. Faellt diese Reihenfolge weg,
    // laedt auch ein Telefon mit nativer API die 1,09 MB.
    expect(decoder).toContain('if (nativ) return { decode: nativ, nativ: true }')
  })

  it('haengt die Verfuegbarkeit nicht mehr an BarcodeDetector', () => {
    // DER EIGENTLICHE DEFEKT. Vorher stand die native API als Bedingung in
    // `cameraScanSupported`, und das machte die Antwort auf jedem iPhone und
    // in jedem Desktop-Browser im LAN zu einem Nein — bei vorhandener Kamera.
    const zeile = /export const cameraScanSupported[\s\S]*?\n\n/.exec(decoder)?.[0] ?? ''
    expect(zeile).toContain('getUserMedia')
    expect(zeile).not.toContain('BarcodeDetector')
    // Der sichere Kontext BLEIBT: `mobileShare` liefert ueber `http://` aus,
    // und dort sperrt der Browser die Kamera selbst. Ohne diese Bedingung
    // boete die Seite einen Knopf an, der zuverlaessig in einen Fehler laeuft.
    expect(zeile).toContain('isSecureContext')
  })

  it('laedt erst beim Oeffnen des Overlays, nicht beim Seitenaufbau', () => {
    // Die Grenze liegt im Effekt des Overlays und nicht im Modulkopf. Stuende
    // `ladeDecoder()` auf Modulebene, waere die Lazy-Grenze wirkungslos.
    expect(app).toContain('const { decode, nativ } = await ladeDecoder()')
    expect(app).not.toMatch(/^const .*= await ladeDecoder\(\)/m)
  })

  it('nimmt fuer den WASM-Weg einen Takt statt jedes Bild', () => {
    // Eine WASM-Dekodierung je Bildwiederholung laestet ein Telefon aus und
    // leert genau den Akku, der im Aufbau reichen muss.
    expect(app).toContain('if (nativ) raf = requestAnimationFrame')
    expect(app).toContain('timer = window.setTimeout(() => void tick(), WASM_TAKT_MS)')
  })
})
