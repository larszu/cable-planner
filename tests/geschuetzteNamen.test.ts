import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

// ───────────────────────────────────────────────────────────────────────────
// KEIN FREMDER FIRMEN- ODER SENDERNAME ALS BEISPIEL.
//
// Der Platzhalter des Projektnamens lautete „z.B. ProSieben Studio Umbau".
// Das ist ein geschuetzter Name, und er stand in einer Eingabemaske, die
// jeder Nutzer beim Anlegen eines Projekts sieht — also an der sichtbarsten
// Stelle der ganzen Anwendung. Entfernt am 2026-09-07 auf Ansage des
// Eigentuemers.
//
// ─── WAS DIESE PRUEFUNG MEINT UND WAS NICHT ────────────────────────────────
//
// Verboten sind SENDER- und MEDIENHAUS-Namen als Beispiel, Platzhalter oder
// Demo-Inhalt. NICHT verboten sind Hersteller- und Produktnamen (Sony,
// Blackmagic, Panasonic, Shure): die stehen in den Geraete-Katalogen, weil
// die Anwendung genau diese Geraete plant — ein Katalog ohne Modellnamen
// waere kein Katalog. Der Unterschied ist die Funktion: ein Produktname
// BENENNT ein Geraet, ein Sendername BEHAUPTET eine Geschaeftsbeziehung.
//
// Wer die Liste erweitert, schreibt ein Muster mit Wortgrenzen hinein.
// Verglichen wird auf kleingeschriebenem Text mit zusammengezogenen
// Leerzeichen, damit „Pro Sieben" und „prosieben" beide auffallen.
// ───────────────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, '..')
const WURZELN = ['src', 'docs', 'scripts']

/**
 * Sender und Medienhaeuser, die in keinem Beispiel auftauchen duerfen.
 *
 * ALS WORTGRENZE GEPRUEFT und nicht als Teilzeichenkette. Die erste Fassung
 * suchte blank nach „rtl" und „ntv" und meldete 121 Treffer — in
 * `partial`, `controller`, `inventory`, `eventName`. Ein Guard, der bei
 * jedem Lauf rot ist, wird abgeschaltet und schuetzt danach gar nichts.
 *
 * `rtl` steht deshalb NICHT auf der Liste: `dir="rtl"` ist die
 * Schreibrichtung und ein legitimes technisches Wort. Ein Name, der sich von
 * einem Fachbegriff nicht unterscheiden laesst, gehoert nicht in eine
 * automatische Pruefung — er gehoert in die Durchsicht durch einen Menschen.
 */
const GESCHUETZT: readonly RegExp[] = [
  /\bpro\s?sieben\b/i,
  /\bprosieben\b/i,
  /\bsat\.?1\b/i,
  /\bkabel\s?eins\b/i,
  /\bzdf\b/i,
  /\bard\b/i,
  /\bard-?mediathek\b/i,
  /\bservus\s?tv\b/i,
  /\bwelt\s?tv\b/i,
  /\bn-?tv\b/i,
  /\bsky\s?deutschland\b/i,
]

const DATEIEN = ['.ts', '.tsx', '.md', '.html', '.mjs', '.json']

const sammle = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const voll = join(dir, name)
    if (statSync(voll).isDirectory()) sammle(voll, out)
    else if (DATEIEN.some((e) => name.endsWith(e))) out.push(voll)
  }
  return out
}

describe('kein geschützter Sendername im Code oder in der Doku', () => {
  const dateien = WURZELN.flatMap((w) => {
    try {
      return sammle(join(ROOT, w))
    } catch {
      return []
    }
  })

  it('durchsucht überhaupt etwas', () => {
    // Ohne diese Zeile wäre der Test grün, wenn die Pfade eines Tages nicht
    // mehr stimmen — und das wäre die schlechteste Sorte grün.
    expect(dateien.length).toBeGreaterThan(200)
  })

  it('findet keinen', () => {
    const treffer: string[] = []
    for (const datei of dateien) {
      // Diese Datei selbst führt die Liste — sie ist die Ausnahme.
      if (datei.endsWith('geschuetzteNamen.test.ts')) continue
      const inhalt = readFileSync(datei, 'utf8').toLowerCase().replace(/\s+/g, ' ')
      for (const muster of GESCHUETZT) {
        const m = muster.exec(inhalt)
        if (m) treffer.push(`${relative(ROOT, datei)}: „${m[0]}"`)
      }
    }
    expect(treffer, `Geschützte Namen: ${treffer.join(' | ')}`).toEqual([])
  })
})
