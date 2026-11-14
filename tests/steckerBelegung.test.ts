import { describe, expect, it } from 'vitest'
import {
  STANDARD_BELEGUNGEN,
  belegungAusVorlage,
  konfektionsblattHtml,
  pinbild,
  vorlageById,
  vorlagenFuer,
  weichtAb,
} from '../src/renderer/lib/steckerBelegung'
import type { Cable } from '../src/renderer/types/cable'

const tr = (_k: string, f: string) => f
const kabel = (extra: Partial<Cable>): Cable => ({
  id: 'c', name: 'K1', type: 'XLR', color: '#fff', fromEquipmentId: 'a', fromPortId: 'p', toEquipmentId: 'b', toPortId: 'q', notes: '', ...extra,
})

describe('#1179 Standardbelegungen', () => {
  it('jede Vorlage hat Quelle, eindeutige Pins und passende Polzahl', () => {
    const ids = new Set<string>()
    for (const v of STANDARD_BELEGUNGEN) {
      expect(v.quelle.length).toBeGreaterThan(10)
      expect(ids.has(v.id)).toBe(false)
      ids.add(v.id)
      expect(v.zeilen).toHaveLength(v.polzahl)
      expect(new Set(v.zeilen.map((z) => z.pin)).size).toBe(v.polzahl)
    }
  })

  it('XLR3 nach AES14: Pin 2 heiss, Pin 3 kalt', () => {
    const v = vorlageById('xlr3-balanced')!
    expect(v.zeilen.find((z) => z.pin === '2')?.signal).toBe('Hot (+)')
    expect(v.zeilen.find((z) => z.pin === '3')?.signal).toBe('Cold (−)')
  })

  it('T568A und T568B tauschen die Paare orange und gruen', () => {
    const a = vorlageById('rj45-t568a')!.zeilen.map((z) => z.ader)
    const b = vorlageById('rj45-t568b')!.zeilen.map((z) => z.ader)
    const tausch = (s?: string) => s?.replace('orange', 'X').replace('green', 'orange').replace('X', 'green')
    expect(a).toEqual(b.map(tausch))
    expect(b[0]).toBe('white/orange')
  })

  it('filtert nach Steckertyp und Polzahl', () => {
    expect(vorlagenFuer('XLR').map((v) => v.id)).toEqual(['xlr3-balanced', 'dmx512-xlr5'])
    expect(vorlagenFuer('XLR', 5).map((v) => v.id)).toEqual(['dmx512-xlr5'])
    expect(vorlagenFuer('Ethernet/RJ45')).toHaveLength(2)
  })

  it('erkennt Abweichung von der Vorlage', () => {
    const v = vorlageById('xlr3-balanced')!
    const zeilen = belegungAusVorlage(v)
    expect(weichtAb(kabel({ belegung: { vorlageId: v.id, zeilen } }))).toBe(false)
    zeilen[1].pinB = '3'
    expect(weichtAb(kabel({ belegung: { vorlageId: v.id, zeilen } }))).toBe(true)
    // Kopie: die Vorlage selbst bleibt unberuehrt
    expect(v.zeilen[1].pinB).toBeUndefined()
  })

  it('Pinbild: Reihe von links nach rechts, Kreis im Feld', () => {
    const r = pinbild(['1', '2', '3'], 'reihe')
    expect(r[0].x).toBeLessThan(r[1].x)
    expect(r.every((p) => p.y === 0.5)).toBe(true)
    for (const p of pinbild(['1', '2', '3', '4', '5'])) {
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(1)
    }
    expect(pinbild([])).toEqual([])
  })
})

describe('#1179 Konfektionsblatt', () => {
  it('ein Blatt je Ende mit Stecker, Teilen und Belegung; Text maskiert', () => {
    const html = konfektionsblattHtml(
      {
        cable: kabel({
          name: 'Mic <1>',
          steckerVon: { steckerId: 'nc3fxx' },
          steckerNach: { steckerId: 'nc3mxx' },
          belegung: { vorlageId: 'xlr3-balanced', zeilen: belegungAusVorlage(vorlageById('xlr3-balanced')!) },
        }),
        von: 'Stagebox · 1',
        nach: 'Pult · 1',
      },
      tr,
    )
    expect(html.match(/<section/g)).toHaveLength(2)
    expect(html).toContain('NC3FXX')
    expect(html).toContain('NC3MXX')
    expect(html).toContain('Hot (+)')
    expect(html).toContain('AES14')
    expect(html).toContain('Mic &lt;1&gt;')
    expect(html).not.toContain('Mic <1>')
  })

  it('ohne Stecker und Belegung: kein Blatt, aber ein Hinweis', () => {
    const html = konfektionsblattHtml({ cable: kabel({}), von: '', nach: '' }, tr)
    expect(html).not.toContain('<section')
    expect(html).toContain('No connector and no pinout set.')
  })
})
