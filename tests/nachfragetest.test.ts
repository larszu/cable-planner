// ───────────────────────────────────────────────────────────────────────────
// Der Nachfragetest Pro/Cloud (#866) — die Zusagen, die still verfallen
// wuerden.
//
// Drei Dinge werden hier gehalten:
//
//  1. DIE SCHWELLE STEHT VOR DEM TEST. Eine Schwelle, die man nach dem
//     Ergebnis festlegt, ist keine Schwelle, sondern eine Begruendung.
//  2. KEIN KAUFKNOPF OHNE KAUF. Solange keine Checkout-URL dasteht, zeigt
//     die Seite den Hinweis und nicht den Knopf — ein Knopf, der ins Leere
//     fuehrt, kostet genau das Vertrauen, das der Test messen soll.
//  3. DIE DESKTOP-APP BLEIBT VOLLSTAENDIG. Die Seite sagt es zu, und #868
//     nennt es die Grundregel: „Die Cloud ist Zusatz, nie Voraussetzung."
//     Wer das Versprechen von der Seite nimmt, faellt hier auf.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { zeilenAus, summe } from '../scripts/release-downloads.mjs'

const WURZEL = resolve(__dirname, '..')
const lies = (rel: string) => readFileSync(resolve(WURZEL, rel), 'utf8')

describe('Die Schwelle steht vor dem Test (#866)', () => {
  const zettel = lies('docs/cloud/nachfragetest.md')

  it('nennt eine Zahl und eine Frist', () => {
    expect(zettel).toMatch(/20 zahlende Vorbestellungen in 3 Monaten/)
  })

  it('sagt, was bei NICHT erreichter Schwelle passiert', () => {
    // Der teure Teil: was geschieht mit dem Geld derer, die vorbestellt
    // haben? Ohne diese Zeile ist die Schwelle eine Absichtserklaerung.
    expect(zettel).toMatch(/erstattet/)
    expect(zettel).toMatch(/Kein Backend/)
  })

  it('haelt den Zwischenbereich offen, statt ihn zu raten', () => {
    // 5 bis 19 ist kein automatisches Ja und kein automatisches Nein.
    expect(zettel).toMatch(/Dazwischen/)
  })

  it('nennt die zweite Kennzahl und dass sie NICHT entscheidet', () => {
    expect(zettel).toMatch(/Download-Zahlen/)
    expect(zettel).toMatch(/keine Hoffnung/)
  })
})

describe('Kein Kaufknopf ohne Kauf (#866)', () => {
  const seite = lies('docs/index.html')

  it('hat den Abschnitt und die Stelle fuer die Checkout-URL', () => {
    expect(seite).toContain('id="pro"')
    expect(seite).toMatch(/const VORBESTELLUNG_URL = /)
  })

  it('zeigt ohne URL den Hinweis statt eines Knopfs', () => {
    // Gemessen am Quelltext: der leere String fuehrt in den `else`-Zweig,
    // und der legt einen Absatz an, keinen Anker.
    const block = seite.slice(seite.indexOf('const VORBESTELLUNG_URL'))
    expect(block).toMatch(/VORBESTELLUNG_URL = ''/)
    expect(block).toMatch(/Pre-orders are not open yet/)
  })

  it('verlinkt die Entscheidungsregel oeffentlich', () => {
    // Wer vorbestellt, soll vorher lesen koennen, woran er gemessen wird.
    expect(seite).toContain('cloud/nachfragetest.md')
  })

  it('sagt auf der Seite zu, dass die Desktop-App frei bleibt', () => {
    const abschnitt = seite.slice(seite.indexOf('id="pro"'), seite.indexOf('<!-- ─── Footer'))
    expect(abschnitt).toMatch(/stays free/i)
    expect(abschnitt).toMatch(/never a requirement/i)
  })

  it('nennt im Pro-Abschnitt keinen Preis, solange nichts verkauft wird', () => {
    // Ein Preis ohne Kaufweg ist eine Zusage ohne Gegenstand. Der Preisanker
    // steht im Zettel, wo er der Rechnung dient, und nicht auf der Seite.
    const abschnitt = seite.slice(seite.indexOf('id="pro"'), seite.indexOf('<!-- ─── Footer'))
    expect(abschnitt).not.toMatch(/\d+\s*(€|EUR|\$|USD)/)
  })
})

describe('Die zweite Kennzahl wird mitgeschrieben (#866)', () => {
  const release = (tag: string, assets: { name: string; download_count: number }[], draft = false) =>
    ({ tag_name: tag, draft, assets })

  it('macht aus Releases eine Zeile je Asset', () => {
    const z = zeilenAus([release('v9.0.0', [{ name: 'a.exe', download_count: 5 }])], '2026-09-19')
    expect(z).toEqual([['2026-09-19', 'v9.0.0', 'a.exe', 5]])
  })

  it('zaehlt Entwuerfe nicht mit', () => {
    // Ein Draft ist nicht veroeffentlicht; seine Zahl waere eine aus dem
    // eigenen Haus.
    const z = zeilenAus([release('v9.9.9', [{ name: 'x', download_count: 99 }], true)], '2026-09-19')
    expect(z).toEqual([])
  })

  it('summiert ueber alle Assets', () => {
    const z = zeilenAus(
      [release('v1', [{ name: 'a', download_count: 3 }, { name: 'b', download_count: 4 }])],
      '2026-09-19',
    )
    expect(summe(z)).toBe(7)
  })

  it('kommt mit einem Release ohne Assets zurecht', () => {
    expect(zeilenAus([{ tag_name: 'v0', assets: [] }], '2026-09-19')).toEqual([])
    expect(zeilenAus([], '2026-09-19')).toEqual([])
  })
})
