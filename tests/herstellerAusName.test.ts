// ───────────────────────────────────────────────────────────────────────────
// Hersteller und Modell aus dem Vorlagennamen — zweiwortige Namen.
//
// Die Geraetebibliothek erkennt dasselbe Geraet an Hersteller + Modell. Eine
// falsche Trennung legt dort ein ZWEITES Geraet an, statt die Ansicht an das
// vorhandene zu haengen. Genau das ist passiert: der Rueckfall „alles vor dem
// ersten Leerzeichen" machte aus „Grass Valley LDX 100" den Hersteller
// „Grass" — waehrend der multicam-Planner dieselbe Kamera unter „Grass
// Valley" einreicht.
//
// Gemessen am 11.11.2026 gegen den multicam-Katalog: 11 Kameras von Grass
// Valley, 8 von Z CAM, 8 von OM System, 3 Objektive von SLR Magic und eine
// Kamera von Phase One.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { herstellerAusName } from '../src/renderer/lib/herstellerAusName'
import { EINGEBAUTER_KATALOG } from '../src/renderer/lib/eingebauterKatalog'

describe('zweiwortige Hersteller', () => {
  it('zerfallen nicht am ersten Leerzeichen', () => {
    expect(herstellerAusName('Grass Valley LDX 100')).toEqual({ manufacturer: 'Grass Valley', model: 'LDX 100' })
    expect(herstellerAusName('Z CAM E2')).toEqual({ manufacturer: 'Z CAM', model: 'E2' })
    expect(herstellerAusName('OM System OM-1 Mark II')).toEqual({ manufacturer: 'OM System', model: 'OM-1 Mark II' })
    expect(herstellerAusName('Phase One XT / IQ4')).toEqual({ manufacturer: 'Phase One', model: 'XT / IQ4' })
    expect(herstellerAusName('SLR Magic Anamorphot-CINE 35mm T2.4 1.33x').manufacturer).toBe('SLR Magic')
    expect(herstellerAusName('Clay Paky Mythos 2')).toEqual({ manufacturer: 'Clay Paky', model: 'Mythos 2' })
  })

  it('fuehrt Marke und Firma auf die Marke zusammen', () => {
    // Auf den Geraeten steht AVer; die Bibliothek fuehrt sie so.
    expect(herstellerAusName('AVerMedia PW515')).toEqual({ manufacturer: 'AVer', model: 'PW515' })
    expect(herstellerAusName('AVer TR313')).toEqual({ manufacturer: 'AVer', model: 'TR313' })
  })

  it('haelt getrennt, was getrennt gehoert', () => {
    // Chauvet fuehrt zwei Linien; ein blosses „Chauvet" waere keine davon.
    expect(herstellerAusName('Chauvet Professional Rogue R2 Wash').manufacturer).toBe('Chauvet Professional')
    expect(herstellerAusName('Chauvet DJ SlimPAR 56').manufacturer).toBe('Chauvet DJ')
  })

  it('laesst einwortige Hersteller in Ruhe', () => {
    expect(herstellerAusName('Sony PXW-FX9')).toEqual({ manufacturer: 'Sony', model: 'PXW-FX9' })
    expect(herstellerAusName('Blackmagic ATEM Mini Pro')).toEqual({ manufacturer: 'Blackmagic Design', model: 'ATEM Mini Pro' })
  })

  it('erfindet keinen Hersteller aus einer Bauform', () => {
    expect(herstellerAusName('Patch panel 24x BNC').manufacturer).toBe('')
    expect(herstellerAusName('Power strip 8-way').manufacturer).toBe('')
    expect(herstellerAusName('Distro CEE32').manufacturer).toBe('')
  })

  it('laesst im ganzen Katalog kein Ein- oder Zwei-Zeichen-Fragment als Hersteller zurueck', () => {
    // DER WAECHTER, und warum er bei zwei Zeichen aufhoert: ein kurzer
    // Hersteller ist entweder eine echte Marke oder ein abgeschnittenes
    // Wort, und ab drei Zeichen ueberwiegen die echten deutlich — JVC, NEC,
    // AJA, ETC, ADJ, GLP, SGM und gut hundert weitere. Eine Schwelle von
    // vier Zeichen meldete 132 richtige Namen und waere damit nur Laerm.
    // Bei zwei Zeichen gibt es im ganzen Katalog keinen echten Fall; dort
    // ist jeder Treffer ein Fehler („Z" statt Z CAM, „OM" statt OM System).
    //
    // Was diese Schwelle NICHT faengt, faengt niemand automatisch: „P+S"
    // statt P+S Technik und „J.L." statt J.L. Fisher sind drei und vier
    // Zeichen lang. Beide hat der naechtliche Geraetepruefer gemeldet, und
    // sie stehen jetzt als Regel in `herstellerAusName.ts`. Wer so etwas
    // findet, traegt es dort ein.
    const kurz = new Set<string>()
    for (const t of EINGEBAUTER_KATALOG) {
      const h = herstellerAusName(t.name).manufacturer
      if (h && h.length <= 2) kurz.add(`${h} ← ${t.name}`)
    }
    expect([...kurz]).toEqual([])
  })

  it('kennt die beiden gemeldeten mehrteiligen Namen', () => {
    expect(herstellerAusName('P+S Technik Evolution 2x 40mm T2.4')).toEqual({
      manufacturer: 'P+S Technik', model: 'Evolution 2x 40mm T2.4',
    })
    expect(herstellerAusName('J.L. Fisher Fisher Model 10').manufacturer).toBe('J.L. Fisher')
  })
})
