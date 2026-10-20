import { describe, expect, it } from 'vitest'
import { CONTROL_CATALOG } from '../src/renderer/lib/steuerprotokolle'
import { EINGEBAUTER_KATALOG } from '../src/renderer/lib/eingebauterKatalog'

// #1063 — every control value needs a manufacturer source, every entry must
// hit a real catalogue device, and every serial interface documents its
// network-bridge setup (or names what the manufacturer leaves open).
describe('steuerprotokolle', () => {
  it('each entry resolves to a built-in device of the same name', () => {
    for (const e of CONTROL_CATALOG) {
      const t = EINGEBAUTER_KATALOG.find((x) => x.deviceTypeId === e.deviceTypeId)
      expect(t?.name, e.name).toBe(e.name)
      expect(t?.controlInterfaces).toEqual(e.interfaces)
      expect(t?.manufacturerUrl, e.name).toMatch(/^https:\/\//)
    }
  })

  it('each interface cites a manufacturer document', () => {
    for (const e of CONTROL_CATALOG)
      for (const i of e.interfaces) expect(i.source, `${e.name} ${i.protocol}`).toMatch(/^https:\/\//)
  })

  it('serial interfaces document the bridge setup', () => {
    for (const e of CONTROL_CATALOG)
      for (const i of e.interfaces.filter((x) => x.transport === 'serial')) {
        expect(i.serial?.standard).toBeTruthy()
        expect(i.connector).toBeTruthy()
        const b = i.bridge
        expect(b, e.name).toBeDefined()
        expect(b!.tcpMode && b!.port).toBeTruthy()
        const open = b!.unverified ?? []
        expect(Boolean(i.serial?.baud?.length) || open.includes('baud rate'), `${e.name} baud`).toBe(true)
        expect(Boolean(i.serial?.pinout) || open.includes('RJ-45 pinout'), `${e.name} pinout`).toBe(true)
        expect(Boolean(b!.packetization) || open.includes('packet framing'), `${e.name} framing`).toBe(true)
      }
  })
})
