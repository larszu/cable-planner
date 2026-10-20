import { describe, expect, it } from 'vitest'
import { equipmentLabelQr } from '../src/renderer/lib/equipmentLabelQr'
import { parseQrPayload } from '../src/renderer/lib/qrPayload'
import type { DeviceLibraryEntry } from '../src/renderer/types/deviceLibrary'

const entry = {
  slug: 'blackmagic-design-atem-mini-pro',
  manufacturer: 'Blackmagic Design',
  model: 'ATEM Mini Pro',
  template: { name: 'Blackmagic ATEM Mini Pro' },
} as unknown as DeviceLibraryEntry
const server = 'https://devices.zumpelars.de'

describe('equipmentLabelQr (#993)', () => {
  it('verlinkt bekannte Geraete auf die Bibliotheksseite und bleibt scanbar', () => {
    const q = equipmentLabelQr({ name: 'Blackmagic ATEM Mini Pro' }, 'A-0001', [entry], server)
    expect(q.target).toBe('library')
    expect(q.payload).toBe(`${server}/d/blackmagic-design-atem-mini-pro#equipment/A-0001`)
    expect(q.lines).toContain('Blackmagic Design ATEM Mini Pro')
    expect(parseQrPayload(q.payload)).toMatchObject({ kind: 'equipment', id: 'A-0001' })
  })

  it('nimmt sonst die Hersteller-URL', () => {
    const q = equipmentLabelQr({ name: 'Sony FX3', manufacturerUrl: 'https://sony.com/fx3' }, 'A-2', [entry], server)
    expect(q.target).toBe('manufacturer')
    expect(q.payload).toBe('https://sony.com/fx3#equipment/A-2')
    expect(q.lines).toContain('sony.com')
  })

  it('kodiert ohne Link Klartext mit Name, Hersteller und Tag', () => {
    const q = equipmentLabelQr({ name: 'Sony FX3', manufacturerUrl: 'javascript:x' }, 'A-3', [], server)
    expect(q.target).toBe('text')
    expect(q.payload).toContain('Sony FX3')
    expect(q.payload).toContain('A-3')
    expect(q.manufacturer).toBe('Sony')
    expect(parseQrPayload(q.payload)).toMatchObject({ kind: 'equipment', id: 'A-3' })
  })
})
