import { describe, expect, it } from 'vitest'
import {
  EINGEBAUTE_STECKER,
  konfektionsPreis,
  konfektionVorschlag,
  steckerById,
  steckerFuerTyp,
  steckerStueckliste,
  teileEinesSteckers,
} from '../src/renderer/lib/steckerKatalog'
import type { SteckerTyp } from '../src/renderer/types/stecker'

describe('#1181 Steckerkatalog', () => {
  it('jeder eingebaute Stecker traegt ein Datenblatt und eindeutige ID', () => {
    const ids = new Set<string>()
    for (const s of EINGEBAUTE_STECKER) {
      expect(s.datenblattUrl).toMatch(/^https:\/\//)
      expect(ids.has(s.id)).toBe(false)
      ids.add(s.id)
      expect(s.konfektionen.length).toBeGreaterThan(0)
      for (const k of s.konfektionen) for (const t of k.teile) {
        if (t.awg) expect(t.awg[0]).toBeLessThanOrEqual(t.awg[1])
      }
    }
  })

  it('schlaegt die Konfektion nach Aderquerschnitt vor', () => {
    const dt = steckerById('te-dt04-4p')!
    expect(konfektionVorschlag(dt, 14)?.id).toBe('awg14')
    expect(konfektionVorschlag(dt, 18)?.id).toBe('awg16-20')
    expect(konfektionVorschlag(dt)?.id).toBe('awg16-20')
    expect(konfektionVorschlag(dt, 26)?.id).toBe('awg16-20')
  })

  it('loest Kontakte je Pol auf', () => {
    const dt = steckerById('te-dt04-4p')!
    const teile = teileEinesSteckers(dt, dt.konfektionen[0])
    expect(teile.find((t) => t.teilenummer === '0460-202-16141')?.anzahl).toBe(4)
    expect(teile.find((t) => t.teilenummer === 'W4P')?.anzahl).toBe(1)
    expect(teile[0]).toMatchObject({ art: 'connector', teilenummer: 'DT04-4P', anzahl: 1 })
  })

  it('filtert nach Plan-Steckertyp, ohne Treffer der ganze Katalog', () => {
    expect(steckerFuerTyp('XLR').every((s) => s.connectorType === 'XLR')).toBe(true)
    expect(steckerFuerTyp('BNC')).toHaveLength(EINGEBAUTE_STECKER.length)
  })

  it('zaehlt die Stueckliste ueber alle Enden zusammen', () => {
    const zeilen = steckerStueckliste([
      { steckerVon: { steckerId: 'te-dt04-4p' }, steckerNach: { steckerId: 'te-dt06-4s' }, aderAwg: 18 },
      { steckerVon: { steckerId: 'te-dt04-4p', konfektionId: 'awg14' } },
      { steckerVon: { steckerId: 'gibt-es-nicht' } },
      {},
    ])
    const n = (tn: string) => zeilen.find((z) => z.teilenummer === tn)?.anzahl
    expect(n('DT04-4P')).toBe(2)
    expect(n('DT06-4S')).toBe(1)
    expect(n('W4P')).toBe(2)
    expect(n('0460-202-16141')).toBe(4)
    expect(n('0460-215-16141')).toBe(4)
    expect(n('0462-201-16141')).toBe(4)
    expect(zeilen[0].art).toBe('connector')
    expect(zeilen.every((z) => z.summe === undefined)).toBe(true)
  })

  it('rechnet Preise nur, wenn jedes Teil einen hat', () => {
    const s: SteckerTyp = {
      id: 'x', teilenummer: 'X', hersteller: 'H', beschreibung: '', datenblattUrl: 'https://x', polzahl: 2, geschlecht: 'male', preis: 1.5,
      konfektionen: [
        { id: 'a', name: 'a', teile: [{ art: 'contact', teilenummer: 'K', anzahl: 'perPole', preis: 0.25 }] },
        { id: 'b', name: 'b', teile: [{ art: 'seal', teilenummer: 'D', anzahl: 1 }] },
      ],
    }
    expect(konfektionsPreis(s, s.konfektionen[0])).toBe(2)
    expect(konfektionsPreis(s, s.konfektionen[1])).toBeUndefined()
    const zeilen = steckerStueckliste([{ steckerVon: { steckerId: 'x' } }, { steckerNach: { steckerId: 'x' } }], [s])
    expect(zeilen.find((z) => z.teilenummer === 'K')).toMatchObject({ anzahl: 4, summe: 1 })
  })
})
