import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// ───────────────────────────────────────────────────────────────────────────
// SCANNEN IST DER SCHNELLE WEG, NIE DER EINZIGE (Bedarf 150)
//
// Der Bedarf ist als Entwurfs-Zwang formuliert und nicht als Funktion:
// „Design constraint for any scan feature in the suite's mobile view:
// scanning is the fast path, never the only path. Otherwise the truck leaves
// with the system permanently disagreeing with reality."
//
// Der Beleg dahinter (shelf.nu#2831): eine Reservierung liess sich dort NUR
// per Scan in ein konkretes Gerät verwandeln — kein Weg, eines aus einer
// Liste zu wählen. Wer ohne funktionierenden Scanner dasteht, ist damit
// blockiert. Die Ausfallarten sind die des Ladetags: leerer Akku, kein Netz
// im Keller, das Etikett klebt in einer Kiste, die schon auf dem Truck steht.
//
// NACHGEMESSEN 2026-09-09: der Zwang ist eingehalten. Diese Datei hält fest,
// WARUM er es bleibt — nicht mit einem Blick auf die Oberfläche, sondern an
// der Stelle, an der er brechen würde: sobald ein Arbeitsweg die Kamera
// BRAUCHT statt sie anzubieten.
// ───────────────────────────────────────────────────────────────────────────

const WURZEL = join(__dirname, '..')
const lies = (p: string) => readFileSync(join(WURZEL, p), 'utf8')

/** Alle .ts/.tsx unter einem Verzeichnis, rekursiv. */
const dateienUnter = (rel: string): string[] => {
  const out: string[] = []
  const gehe = (p: string) => {
    for (const name of readdirSync(join(WURZEL, p))) {
      const kind = `${p}/${name}`
      if (statSync(join(WURZEL, kind)).isDirectory()) gehe(kind)
      else if (/\.tsx?$/.test(name)) out.push(kind)
    }
  }
  gehe(rel)
  return out
}

/**
 * Die Region hinter `{<bedingung> && ` bzw. `{<bedingung> ? ` — bis die
 * geschweifte Klammer wieder zugeht.
 *
 * Damit lässt sich fragen, was INNERHALB einer Kamera-Bedingung steht, statt
 * Zeilennummern zu vergleichen. Zeilennummern wären genau der Fehler, den
 * diese Datei sonst begeht: sie messen die Stelle im Quelltext und nicht die
 * Regel.
 */
const regionHinter = (src: string, anker: string): string => {
  const start = src.indexOf(anker)
  if (start < 0) return ''
  let tiefe = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') tiefe++
    else if (src[i] === '}') {
      tiefe--
      if (tiefe === 0) return src.slice(start, i + 1)
    }
  }
  return src.slice(start)
}

describe('die Kamera ist ein Angebot, keine Voraussetzung', () => {
  it('startet nur das Overlay selbst die Kamera', () => {
    // `startCameraScan` ist der einzige Weg zur Kamera. Würde ihn ein
    // Arbeitsweg direkt aufrufen, hinge dieser Weg an der Kamera — und genau
    // das ist der Defekt aus shelf.nu#2831.
    const rufer = dateienUnter('src')
      .filter((f) => !f.endsWith('lib/barcodeScanner.ts'))
      .filter((f) => /\bstartCameraScan\b/.test(lies(f)))
    expect(rufer).toEqual(['src/renderer/lager/ui/ScannerModal.tsx'])
  })

  it('kennt kein Lager-Modul ausserhalb der Oberflaeche den Scanner', () => {
    // Rechnen, Speichern und Typen des Lagers duerfen von der Kamera nichts
    // wissen. Sobald eine Berechnung sie importiert, ist der Scan keine
    // Eingabeart mehr, sondern eine Bedingung.
    const treffer = ['src/renderer/lager/lib', 'src/renderer/lager/store', 'src/renderer/lager/types']
      .flatMap((d) => dateienUnter(d))
      .filter((f) => /barcodeScanner/.test(lies(f)))
    expect(treffer).toEqual([])
  })
})

describe('die Handeingabe haengt an keiner Kamera-Bedingung', () => {
  it('im Lager-Dialog', () => {
    // Das Eingabefeld traegt den Platzhalter `inventory.scanPh`. Stuende es
    // innerhalb von `{cameraSupported && …}`, verschwaende es genau dort, wo
    // es gebraucht wird: auf dem Rechner ohne Kamera.
    const src = lies('src/renderer/lager/ui/InventoryDialog.tsx')
    expect(src).toContain('inventory.scanPh')
    expect(regionHinter(src, '{cameraSupported && ')).not.toContain('inventory.scanPh')
  })

  it('in der Mobile-Ansicht', () => {
    // Dort steht die Kamera in einem `canScan ? … : …`. Das Eingabefeld muss
    // DANEBEN stehen und nicht im Ja-Zweig — sonst ist der Hinweis „füge den
    // Code unten ein" eine Anleitung zu einem Feld, das es nicht gibt.
    const src = lies('src/mobile/MobileApp.tsx')
    expect(src).toContain('placeholder="z.B. C-0001, A-0007 oder cableplanner://…"')
    expect(regionHinter(src, '{canScan ? ')).not.toContain('placeholder="z.B. C-0001')
  })

  it('haelt sich das Scan-Overlay nicht ohne Kamera heraus', () => {
    // Ein `if (!canScan) return null` waere derselbe Defekt in seiner
    // kuerzesten Form: kein Overlay, kein Feld, kein Weg.
    //
    // GEPRUEFT WIRD `return null`, NICHT JEDES `return`. Die erste Fassung
    // dieses Waechters verbot beides und wurde an einer RICHTIGEN Stelle rot:
    // im Effekt, der die Kamera startet, steht `if (!canScan) return` — und
    // dort gehoert es hin, es ueberspringt das Starten und nicht das
    // Zeichnen. Ein Waechter, der an einer richtigen Aenderung rot wird, wird
    // geaendert statt gelesen.
    const src = lies('src/mobile/MobileApp.tsx')
    expect(src).not.toMatch(/if\s*\(\s*!canScan\s*\)\s*return\s+null/)
    expect(lies('src/renderer/lager/ui/ScannerModal.tsx')).not.toMatch(
      /if\s*\(\s*!isBarcodeScannerSupported\(\)\s*\)\s*return\s+null/,
    )
  })

  it('nennt der Fehlerfall die Handeingabe', () => {
    // Wenn die Kamera nicht darf oder nicht kann, muss dort stehen, was
    // stattdessen geht — eine Fehlermeldung ohne Ausweg schickt den Nutzer
    // zurueck an den Anfang.
    expect(lies('src/renderer/lager/ui/ScannerModal.tsx')).toContain('Use manual entry')
    expect(lies('src/mobile/MobileApp.tsx')).toContain('füge den Code unten ein')
  })
})
