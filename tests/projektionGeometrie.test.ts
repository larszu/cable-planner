import { describe, expect, it } from 'vitest'
import { abstandFuerBlickwinkel, berechneProjektion, bildAusDiagonale, maxBreiteFuerTiefe, type ProjektionEingabe } from '../src/renderer/lib/projektionGeometrie'

const basis: ProjektionEingabe = {
  art: 'projektor',
  diagonaleZoll: 100,
  seiten: { a: 16, b: 9 },
  unterkanteM: 1,
  throwRatio: 1.5,
  shiftVProzent: 0,
  shiftHProzent: 0,
}

describe('projektionGeometrie (#997)', () => {
  it('100″ 16:9 ergibt 2,214 × 1,245 m', () => {
    const r = berechneProjektion(basis)
    expect(r.breite).toBeCloseTo(2.2138, 3)
    expect(r.hoehe).toBeCloseTo(1.2453, 3)
    expect(Math.hypot(r.breite, r.hoehe)).toBeCloseTo(2.54, 6)
  })

  it('3-4-5: 5 m Diagonale 4:3 → 4 × 3 m', () => {
    const b = bildAusDiagonale(5, { a: 4, b: 3 })
    expect(b.breite).toBeCloseTo(4, 9)
    expect(b.hoehe).toBeCloseTo(3, 9)
  })

  it('Abstand = Throw-Ratio × Bildbreite', () => {
    const r = berechneProjektion(basis)
    expect(r.abstand).toBeCloseTo(1.5 * r.breite, 9)
    expect(r.objektiv?.z).toBeCloseTo(r.abstand, 9)
    expect(maxBreiteFuerTiefe(6, 1.5)).toBeCloseTo(4, 9)
  })

  it('Lens-Shift: 0 % Bildmitte, +50 % Unterkante, −50 % Oberkante, horizontal in Bildbreite', () => {
    const r0 = berechneProjektion(basis)
    expect(r0.objektiv?.y).toBeCloseTo(r0.mitteY, 9)
    const rUnten = berechneProjektion({ ...basis, shiftVProzent: 50 })
    expect(rUnten.objektiv?.y).toBeCloseTo(basis.unterkanteM, 9)
    const rOben = berechneProjektion({ ...basis, shiftVProzent: -50 })
    expect(rOben.objektiv?.y).toBeCloseTo(rOben.oberkante, 9)
    const rH = berechneProjektion({ ...basis, shiftHProzent: 10 })
    expect(rH.objektiv?.x).toBeCloseTo(-0.1 * rH.breite, 9)
  })

  it('Sitzabstände: THX 36°, SMPTE 30°, letzte Reihe 6 × Höhe', () => {
    const r = berechneProjektion(basis)
    expect(abstandFuerBlickwinkel(2, 90)).toBeCloseTo(1, 9)
    expect(r.sitz.min).toBeCloseTo(r.breite / 2 / Math.tan((18 * Math.PI) / 180), 9)
    expect(r.sitz.optimal).toBeGreaterThan(r.sitz.min)
    expect(r.sitz.max).toBeCloseTo(6 * r.hoehe, 9)
  })

  it('Display hat keinen Projektionsweg', () => {
    const r = berechneProjektion({ ...basis, art: 'display' })
    expect(r.abstand).toBe(0)
    expect(r.objektiv).toBeUndefined()
  })
})
