import { describe, expect, it } from 'vitest'
import { computeRfConflicts } from '../src/renderer/lib/rfCoordination'
import { deriveRig, channelCompat } from '../src/renderer/lib/wirelessRig'
import { WIRELESS_CATALOG } from '../src/renderer/lib/wirelessCatalog'
import type { WirelessRigPlan } from '../src/renderer/types/wirelessRig'

const id = (name: string) => WIRELESS_CATALOG.find((d) => d.name === name)!.deviceTypeId

const f = (id: string, mhz: number) => ({ id, label: id, mhz })

describe('rfCoordination — Frequenz-Konflikte', () => {
  it('meldet zu geringen Trägerabstand', () => {
    const c = computeRfConflicts([f('a', 500.0), f('b', 500.2)], { minSpacingMhz: 0.4, imdGuardMhz: 0.3, check3Tx: false })
    expect(c.some((x) => x.kind === 'spacing')).toBe(true)
  })

  it('erkennt 3rd-order 2-Sender-Intermod (2·f1 − f2 trifft f3)', () => {
    // 2·500 − 502 = 498 → trifft Kanal bei 498
    const c = computeRfConflicts([f('a', 500), f('b', 502), f('c', 498)], { minSpacingMhz: 0.4, imdGuardMhz: 0.3, check3Tx: false })
    expect(c.some((x) => x.kind === 'imd3-2tx' && x.productMhz === 498)).toBe(true)
  })

  it('erkennt 3rd-order 3-Sender-Intermod (f1 + f2 − f3 trifft f4)', () => {
    // 500 + 510 − 505 = 505? nein. Nimm 500+520-510=510 → trifft 510 (aber 510 ist im Produkt).
    // 500 + 512 − 508 = 504 → trifft Kanal bei 504
    const c = computeRfConflicts([f('a', 500), f('b', 512), f('c', 508), f('d', 504)], { minSpacingMhz: 0.3, imdGuardMhz: 0.3, check3Tx: true })
    expect(c.some((x) => x.kind === 'imd3-3tx' && x.productMhz === 504)).toBe(true)
  })

  it('sauberer Plan → keine Konflikte', () => {
    const c = computeRfConflicts([f('a', 500), f('b', 506), f('c', 512)], { minSpacingMhz: 0.4, imdGuardMhz: 0.2, check3Tx: true })
    // 2·500-506=494, 2·506-500=512! trifft c → das IST ein Konflikt. Wähle bewusst konfliktfrei:
    const clean = computeRfConflicts([f('a', 500), f('b', 507), f('c', 515)], { minSpacingMhz: 0.4, imdGuardMhz: 0.2, check3Tx: true })
    expect(clean.length).toBe(0)
    expect(c.length).toBeGreaterThan(0)
  })
})

describe('wirelessRig — Ableitungen', () => {
  it('channelCompat erkennt passende und unpassende Zuordnung', () => {
    expect(channelCompat({ id: '1', label: 'x', bodyDeviceTypeId: id('Shure ULXD2'), micDeviceTypeId: id('Shure Beta 58A (Kapsel)') })).toBe('ok')
    expect(channelCompat({ id: '2', label: 'y', bodyDeviceTypeId: id('Shure ULXD2'), micDeviceTypeId: id('Sennheiser MMD 945 (Kapsel)') })).toBe('incompatible')
    expect(channelCompat({ id: '3', label: 'z', bodyDeviceTypeId: id('Shure SLXD1'), micDeviceTypeId: id('DPA 4066 · TA4F (Headset)') })).toBe('ok')
    expect(channelCompat({ id: '4', label: 'e' })).toBe('empty')
  })

  it('deriveRig zählt inkompatible/unbekannte + RF-Konflikte', () => {
    const plan: WirelessRigPlan = {
      channels: [
        { id: '1', label: 'Lead', bodyDeviceTypeId: id('Shure ULXD2'), micDeviceTypeId: id('Shure KSM9 (Kapsel)'), frequencyMhz: 500 },
        { id: '2', label: 'BGV', bodyDeviceTypeId: id('Shure ULXD2'), micDeviceTypeId: id('Sennheiser MME 865 (Kapsel)'), frequencyMhz: 502 },
        { id: '3', label: 'Pfarrer', bodyDeviceTypeId: id('Sennheiser SK 500 G4'), micDeviceTypeId: id('Sennheiser HSP 2 · 3,5 mm (Headset)'), frequencyMhz: 498 },
      ],
    }
    const d = deriveRig(plan)
    expect(d.channelCount).toBe(3)
    expect(d.incompatibleCount).toBe(1) // BGV: Sennheiser-Kapsel auf Shure-Body
    expect(d.frequencyCount).toBe(3)
    // 500/502/498 → 2·500−502=498 Intermod
    expect(d.rfConflicts.length).toBeGreaterThan(0)
  })
})
