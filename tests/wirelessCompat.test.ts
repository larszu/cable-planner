import { describe, expect, it } from 'vitest'
import {
  isCapsuleCompatible,
  isBodypackMicCompatible,
  compatibleCapsules,
  compatibleBodypackMics,
} from '../src/renderer/lib/wirelessCompat'
import { WIRELESS_CATALOG, wirelessById } from '../src/renderer/lib/wirelessCatalog'
import type { WirelessDevice } from '../src/renderer/types/wireless'

const byName = (n: string): WirelessDevice => {
  const d = WIRELESS_CATALOG.find((x) => x.name === n)
  if (!d) throw new Error(`nicht gefunden: ${n}`)
  return d
}

describe('wirelessCatalog', () => {
  it('GUIDs sind eindeutig', () => {
    const ids = WIRELESS_CATALOG.map((d) => d.deviceTypeId)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('wirelessById findet Einträge', () => {
    const ulxd2 = byName('Shure ULXD2')
    expect(wirelessById(ulxd2.deviceTypeId)?.name).toBe('Shure ULXD2')
  })
})

describe('wirelessCompat — Handsender ⇄ Kapsel', () => {
  it('Shure-Kapsel passt auf jeden Shure-Body', () => {
    expect(isCapsuleCompatible(byName('Shure ULXD2'), byName('Shure Beta 58A (Kapsel)'))).toBe(true)
    expect(isCapsuleCompatible(byName('Shure AD2'), byName('Shure KSM9 (Kapsel)'))).toBe(true)
  })
  it('Marken-/System-fremde Kapsel passt NICHT (anderes Mount)', () => {
    expect(isCapsuleCompatible(byName('Shure ULXD2'), byName('Sennheiser MMD 945 (Kapsel)'))).toBe(false)
    expect(isCapsuleCompatible(byName('Sennheiser SKM 500 G4'), byName('Shure SM58 (Kapsel)'))).toBe(false)
  })
  it('Neumann KK passt auf Sennheiser 9000-Body', () => {
    expect(isCapsuleCompatible(byName('Sennheiser SKM 9000'), byName('Neumann KK 205 (Kapsel)'))).toBe(true)
    // aber nicht auf evolution
    expect(isCapsuleCompatible(byName('Sennheiser SKM 500 G4'), byName('Neumann KK 205 (Kapsel)'))).toBe(false)
  })
  it('compatibleCapsules liefert nur passende', () => {
    const caps = compatibleCapsules(byName('Shure ULXD2'), WIRELESS_CATALOG)
    expect(caps.length).toBeGreaterThanOrEqual(8)
    expect(caps.every((c) => c.capsuleMount === 'shure-thread' && c.role === 'capsule')).toBe(true)
  })
})

describe('wirelessCompat — Taschensender ⇄ Headset/Lavalier', () => {
  it('TA4F-Headset passt an Shure-TA4F-Taschensender', () => {
    expect(isBodypackMicCompatible(byName('Shure ULXD1'), byName('DPA 4066 · TA4F (Headset)'))).toBe(true)
  })
  it('Sennheiser-3,5-mm-Headset passt NICHT an Shure-TA4F', () => {
    expect(isBodypackMicCompatible(byName('Shure ULXD1'), byName('Sennheiser HSP 2 · 3,5 mm (Headset)'))).toBe(false)
  })
  it('LEMO-Body akzeptiert kein TA4F-Mic', () => {
    expect(isBodypackMicCompatible(byName('Shure AD1'), byName('Shure SM35 · TA4F (Headset)'))).toBe(false)
  })
  it('compatibleBodypackMics filtert nach Steckverbinder', () => {
    const mics = compatibleBodypackMics(byName('Sennheiser SK 500 G4'), WIRELESS_CATALOG)
    expect(mics.length).toBeGreaterThanOrEqual(3)
    expect(mics.every((m) => m.bodypackConnector === 'sennheiser-3.5-lock')).toBe(true)
  })
})
