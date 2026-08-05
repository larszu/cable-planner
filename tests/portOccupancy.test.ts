import { describe, expect, it } from 'vitest'
import {
  cableEndsAt,
  cableStartsAt,
  cableTouches,
  cablesEndingAt,
  connectionExists,
  sameConnection,
} from '../src/renderer/lib/portOccupancy'
import type { Cable } from '../src/renderer/types/cable'

// #595 — Zwei Geraete aus derselben Vorlage tragen dieselben Port-IDs, weil
// `sanitizePort` eine vorhandene ID beim Platzieren behaelt. Genau das war der
// gemeldete Fall: Amp -> Box A belegte scheinbar auch den Eingang von Box B.

const cable = (over: Partial<Cable> = {}): Cable => ({
  id: 'c1',
  name: '',
  type: 'XLR',
  length: 10,
  color: '#fff',
  fromEquipmentId: 'amp',
  fromPortId: 'xlr-out-a',
  toEquipmentId: 'box-a',
  toPortId: 'in-1-xlr',
  notes: '',
  ...over,
})

const AMP_OUT = { equipmentId: 'amp', portId: 'xlr-out-a' }
const BOX_A_IN = { equipmentId: 'box-a', portId: 'in-1-xlr' }
// Gleiche Port-ID wie Box A — beide stammen aus derselben Vorlage.
const BOX_B_IN = { equipmentId: 'box-b', portId: 'in-1-xlr' }

describe('cableStartsAt / cableEndsAt', () => {
  it('trifft nur bei passendem Geraet UND Port', () => {
    const c = cable()
    expect(cableStartsAt(c, AMP_OUT)).toBe(true)
    expect(cableEndsAt(c, BOX_A_IN)).toBe(true)
    expect(cableEndsAt(c, BOX_B_IN)).toBe(false)
    expect(cableStartsAt(c, BOX_A_IN)).toBe(false)
  });

  it('verwechselt gleiche Port-IDs an verschiedenen Geraeten nicht', () => {
    const c = cable()
    // Identische Port-ID, anderes Geraet
    expect(BOX_A_IN.portId).toBe(BOX_B_IN.portId)
    expect(cableEndsAt(c, BOX_B_IN)).toBe(false)
  })
})

describe('cableTouches', () => {
  it('erkennt beide Enden', () => {
    const c = cable()
    expect(cableTouches(c, AMP_OUT)).toBe(true)
    expect(cableTouches(c, BOX_A_IN)).toBe(true)
  })

  it('meldet einen fremden Port nicht als belegt', () => {
    expect(cableTouches(cable(), BOX_B_IN)).toBe(false)
    expect(cableTouches(cable(), { equipmentId: 'amp', portId: 'xlr-out-b' })).toBe(false)
  })
})

describe('cablesEndingAt', () => {
  it('meldet den Eingang des zweiten Geraets als frei (der gemeldete Fehler)', () => {
    const cables = [cable({ id: 'c1' })]
    expect(cablesEndingAt(cables, BOX_A_IN).map((c) => c.id)).toEqual(['c1'])
    expect(cablesEndingAt(cables, BOX_B_IN)).toEqual([])
  })

  it('zaehlt nur Ziel-Enden — ein Ausgang darf mehrere Kabel speisen', () => {
    const cables = [
      cable({ id: 'c1', toEquipmentId: 'box-a' }),
      cable({ id: 'c2', toEquipmentId: 'box-b' }),
    ]
    // Beide starten am selben Ausgang, das ist kein Konflikt.
    expect(cablesEndingAt(cables, AMP_OUT)).toEqual([])
    expect(cablesEndingAt(cables, BOX_A_IN).map((c) => c.id)).toEqual(['c1'])
    expect(cablesEndingAt(cables, BOX_B_IN).map((c) => c.id)).toEqual(['c2'])
  })

  it('laesst das eigene Kabel aus, wenn eine Id ausgenommen wird', () => {
    const cables = [cable({ id: 'c1' })]
    expect(cablesEndingAt(cables, BOX_A_IN, 'c1')).toEqual([])
  })

  it('gibt bei leerem Geraet oder Port nichts zurueck', () => {
    const cables = [cable()]
    expect(cablesEndingAt(cables, { equipmentId: '', portId: 'in-1-xlr' })).toEqual([])
    expect(cablesEndingAt(cables, { equipmentId: 'box-a', portId: '' })).toEqual([])
  })
})

describe('sameConnection / connectionExists', () => {
  it('erkennt dieselbe Verbindung in beiden Richtungen', () => {
    const c = cable()
    expect(sameConnection(c, AMP_OUT, BOX_A_IN)).toBe(true)
    expect(sameConnection(c, BOX_A_IN, AMP_OUT)).toBe(true)
  })

  it('haelt das Kabel zum zweiten Geraet nicht fuer eine Dublette', () => {
    const cables = [cable({ id: 'c1' })]
    expect(connectionExists(cables, AMP_OUT, BOX_A_IN)).toBe(true)
    expect(connectionExists(cables, AMP_OUT, BOX_B_IN)).toBe(false)
  })

  it('unterscheidet verschiedene Ausgaenge desselben Geraets', () => {
    const cables = [cable({ id: 'c1' })]
    expect(
      connectionExists(cables, { equipmentId: 'amp', portId: 'xlr-out-b' }, BOX_A_IN),
    ).toBe(false)
  })
})
