import { describe, expect, it } from 'vitest'
import { scanConnectors } from '../src/renderer/lib/webPortSuggestions'

describe('scanConnectors liest Datenblatt-Tabellen', () => {
  it('nimmt die Anzahl hinter dem Stecker, nicht die Versionsnummer', () => {
    const text = '12G-SDI INPUT 4 Standard Support for ST-2082. 12G-SDI OUTPUT 4 12G-SDI outputs. HDMI 2.0 Maximum resolution'
    const hints = scanConnectors(text)
    expect(hints.find((h) => h.connectorType === 'BNC' && h.direction === 'in')?.count).toBe(4)
    expect(hints.find((h) => h.connectorType === 'BNC' && h.direction === 'out')?.count).toBe(4)
    expect(hints.find((h) => h.connectorType === 'HDMI')?.count).toBe(1)
  })
})
