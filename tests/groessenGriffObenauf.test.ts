import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * #1226 — An kleinen Geraeten liess sich der Groessen-Griff nicht greifen:
 * er stand im DOM vor den Port-Reihen und ohne z-index, die letzte Port-Zeile
 * lag darueber (Klick waehlte den Port oder verschob die Kachel). Im Browser
 * nachgestellt (Kachel 132x66, sizeScale 0.6): vorher traf
 * `elementFromPoint` die Port-Zeile, danach den Griff.
 *
 * Die Schichtung ist CSS und laesst sich ohne Browser nicht messen; dieser
 * Test haelt die zwei Angaben fest, an denen sie haengt.
 */
const quelle = readFileSync(join(__dirname, '../src/renderer/components/Canvas/GeraeteGroessenGriff.tsx'), 'utf8')

describe('#1226 — Groessen-Griff liegt obenauf', () => {
  it('hat einen z-index ueber den Port-Reihen', () => {
    expect(quelle).toMatch(/zIndex:\s*\d+/)
  })
  it('sitzt halb ausserhalb der Ecke, weg von der Buchsen-Mitte', () => {
    expect(quelle).toMatch(/right:\s*-FLAECHE \/ 2/)
    expect(quelle).toMatch(/bottom:\s*-FLAECHE \/ 2/)
  })
})
