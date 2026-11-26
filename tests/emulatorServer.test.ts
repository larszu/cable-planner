// @vitest-environment node
import net from 'node:net'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { Atem } from 'atem-connection'

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }))

import { AtemEmulator, tallyOf } from '../src/main/services/emulator/atemEmulator'
import { VideohubEmulator } from '../src/main/services/emulator/videohubEmulator'
import type { AtemEmuTopology, EmuValues } from '../src/main/services/emulator/emulatorTypes'
import { atemDriver } from '../src/main/services/switcherControl/atemDriver'
import { videohubDriver } from '../src/main/services/switcherControl/videohubDriver'
import { disconnectAtem } from '../src/main/services/atemSession'

// #1240 Stufe 5 — die Simulation als Geraet im Netz. Gegenstelle ist das
// offene `atem-connection` (dieselbe Bibliothek wie Companion) bzw. der
// vorhandene Treiber des Planners mit ControlTarget = simulator.

const until = async (f: () => boolean, ms = 4000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (f()) return true
    await new Promise((r) => setTimeout(r, 20))
  }
  return false
}

const TOPO: AtemEmuTopology = {
  productName: 'Emulator ATEM 2 M/E Constellation HD',
  mixEffects: 2,
  keyersPerMe: 2,
  downstreamKeyers: 2,
  aux: 2,
  mediaPlayers: 1,
  superSources: 1,
  superSourceBoxes: 4,
  stills: 20,
  macros: 0,
  sources: [
    { id: 0, longName: 'Black', shortName: 'BLK', internalPortType: 1 },
    ...[1, 2, 3, 4].map((i) => ({ id: i, longName: `Kamera ${i}`, shortName: `CAM${i}`, internalPortType: 0 })),
    { id: 3010, longName: 'Media Player 1', shortName: 'MP1', internalPortType: 4 },
    { id: 6000, longName: 'SuperSource', shortName: 'SSRC', internalPortType: 6 },
    { id: 10010, longName: 'ME 1 Program', shortName: 'M1PG', internalPortType: 128 },
    { id: 10020, longName: 'ME 2 Program', shortName: 'M2PG', internalPortType: 128 },
  ],
}
const START: EmuValues = {
  'me.0.pgm': 1,
  'me.0.pvw': 2,
  'me.1.pgm': 3,
  'me.1.pvw': 0,
  'ss.0.box.0.on': true,
  'ss.0.box.0.src': 10020,
  'aux.0': 4,
}

describe('Tally durch SuperSource und M/E', () => {
  it('M/E 2 in Box 1 auf PGM: auch die Quelle von M/E 2 ist auf Sendung', () => {
    const t = tallyOf(TOPO, { ...START, 'me.0.pgm': 6000 })
    expect(t.get(6000)).toBe(1)
    expect(t.get(10020)).toBe(1)
    expect(t.get(3)).toBe(1)
    expect(t.get(2)).toBe(2)
  })
})

describe('ATEM-Emulator gegen atem-connection', () => {
  const changes: EmuValues[] = []
  const emu = new AtemEmulator({ host: '127.0.0.1', port: 9910, topology: TOPO, values: START, onChange: (c) => changes.push(c) })
  const atem = new Atem({ disableMultithreaded: true })
  afterAll(async () => {
    await atem.disconnect().catch(() => undefined)
    await disconnectAtem()
    emu.stop()
  })

  it('verbindet sich und bekommt Topologie, Namen und Busse', async () => {
    await emu.start()
    const connected = new Promise<void>((r) => atem.once('connected', () => r()))
    await atem.connect('127.0.0.1')
    await connected
    const s = atem.state!
    expect(s.info.productIdentifier).toBe('Emulator ATEM 2 M/E Constellation HD')
    expect(s.info.capabilities?.mixEffects).toBe(2)
    expect(s.video.mixEffects[0]?.programInput).toBe(1)
    expect(s.video.mixEffects[0]?.previewInput).toBe(2)
    expect(s.inputs[1]?.longName).toBe('Kamera 1')
    expect(s.video.auxilliaries[0]).toBe(4)
    expect(s.video.superSources[0]?.boxes[0]?.source).toBe(10020)
  })

  it('Programm, Vorschau, Cut, Aux, Keyer, DSK, Box und Name kommen an und werden gemeldet', async () => {
    await atem.changeProgramInput(3, 0)
    await atem.changePreviewInput(4, 0)
    await atem.cut(0)
    expect(await until(() => atem.state?.video.mixEffects[0]?.programInput === 4)).toBe(true)
    expect(atem.state?.video.mixEffects[0]?.previewInput).toBe(3)
    await atem.setAuxSource(2, 1)
    await atem.setUpstreamKeyerOnAir(true, 0, 1)
    await atem.setDownstreamKeyOnAir(true, 1)
    await atem.setSuperSourceBoxSettings({ source: 3 }, 2)
    await atem.setInputSettings({ longName: 'Kran' }, 2)
    expect(
      await until(
        () =>
          atem.state?.video.auxilliaries[1] === 2 &&
          atem.state?.video.mixEffects[0]?.upstreamKeyers[1]?.onAir === true &&
          atem.state?.video.downstreamKeyers[1]?.onAir === true &&
          atem.state?.video.superSources[0]?.boxes[2]?.source === 3 &&
          atem.state?.inputs[2]?.longName === 'Kran',
      ),
    ).toBe(true)
    const all = Object.assign({}, ...changes)
    expect(all).toMatchObject({
      'me.0.pgm': 4,
      'me.0.pvw': 3,
      'aux.1': 2,
      'me.0.key.1.on': true,
      'dsk.1.on': true,
      'ss.0.box.2.src': 3,
      'in.2.long': 'Kran',
    })
  })

  it('Keyer-Quellen und Fade to Black kommen an und werden gemeldet', async () => {
    await atem.setUpstreamKeyerFillSource(3, 0, 0)
    await atem.setUpstreamKeyerCutSource(4, 0, 0)
    await atem.fadeToBlack(1)
    expect(
      await until(
        () =>
          atem.state?.video.mixEffects[0]?.upstreamKeyers[0]?.fillSource === 3 &&
          atem.state?.video.mixEffects[0]?.upstreamKeyers[0]?.cutSource === 4 &&
          atem.state?.video.mixEffects[1]?.fadeToBlack?.isFullyBlack === true,
      ),
    ).toBe(true)
    expect(Object.assign({}, ...changes)).toMatchObject({ 'me.0.key.0.fill': 3, 'me.0.key.0.key': 4, 'me.1.ftb': true })
    await atem.fadeToBlack(1)
    expect(await until(() => atem.state?.video.mixEffects[1]?.fadeToBlack?.isFullyBlack === false)).toBe(true)
  })

  it('eine Planaenderung erreicht das Pult, ohne als Pultaenderung zurueckzukommen', async () => {
    const before = changes.length
    emu.update({ 'me.1.pgm': 1 })
    expect(await until(() => atem.state?.video.mixEffects[1]?.programInput === 1)).toBe(true)
    expect(changes.length).toBe(before)
  })

  it('der Treiber des Planners schaltet mit ControlTarget = simulator', async () => {
    const r = await atemDriver.send({
      protocol: 'atem',
      target: 'simulator',
      equipmentId: 'atem',
      equipmentName: 'ATEM',
      host: '127.0.0.1',
      vorschau: '',
      art: 'aufruf',
      befehle: [
        { kind: 'program', me: 0, source: 2 },
        { kind: 'aux', bus: 0, source: 1 },
      ],
    })
    expect(r.ok).toBe(true)
    expect(await until(() => emu.snapshot()['me.0.pgm'] === 2 && emu.snapshot()['aux.0'] === 1)).toBe(true)
  }, 15000)
})

describe('Videohub-Emulator', () => {
  const changes: EmuValues[] = []
  const vh = new VideohubEmulator({
    host: '127.0.0.1',
    port: 0,
    topology: { friendlyName: 'Emulator Smart Videohub 12x12', inputs: 12, outputs: 12 },
    values: { 'route.0': 1, 'in.0': 'Kamera 1', 'lock.5': true },
    onChange: (c) => changes.push(c),
  })
  let port = 0
  afterAll(() => vh.stop())

  const talk = (send: string, waitFor: RegExp) =>
    new Promise<string>((resolve, reject) => {
      const s = net.connect(port, '127.0.0.1')
      let buf = ''
      const t = setTimeout(() => (s.destroy(), reject(new Error(buf))), 3000)
      s.on('data', (d) => {
        buf += d.toString()
        if (buf.includes('END PRELUDE:') && send) {
          s.write(send)
          send = ''
        }
        if (!send && waitFor.test(buf.split('END PRELUDE:')[1] ?? '')) {
          clearTimeout(t)
          s.destroy()
          resolve(buf)
        }
      })
    })

  it('schickt das Vorspiel mit Emulator-Namen, Beschriftung, Sperren und Routing', async () => {
    port = (await vh.start()).port
    const b = await talk('PING:\n\n', /ACK/)
    expect(b).toMatch(/^PROTOCOL PREAMBLE:\nVersion: 2\.8\n\n/)
    expect(b).toContain('Friendly name: Emulator Smart Videohub 12x12')
    expect(b).toContain('INPUT LABELS:\n0 Kamera 1\n')
    expect(b).toContain('VIDEO OUTPUT LOCKS:\n0 U\n')
    expect(b).toContain('5 L\n')
    expect(b).toContain('VIDEO OUTPUT ROUTING:\n0 1\n')
  })

  it('meldet und setzt den Take-Modus im CONFIGURATION-Block', async () => {
    const b = await talk('CONFIGURATION:\nTake Mode: true\n\n', /CONFIGURATION:\nTake Mode: true\n/)
    expect(b).toContain('CONFIGURATION:\nTake Mode: false\n\nEND PRELUDE:')
    expect(vh.snapshot().takeMode).toBe(true)
    const q = await talk('CONFIGURATION:\n\n', /ACK\n\nCONFIGURATION:\nTake Mode: true\n/)
    expect(q).toContain('ACK')
  })

  it('ein vom Plan gesperrter Ausgang wird nicht geschaltet', async () => {
    const b = await talk('VIDEO OUTPUT ROUTING:\n5 2\n\n', /NAK/)
    expect(b).toContain('NAK')
    expect(vh.snapshot()['route.5']).toBeUndefined()
  })

  it('der Treiber des Planners schaltet mit ControlTarget = simulator', async () => {
    const r = await videohubDriver.send({
      protocol: 'videohub',
      target: 'simulator',
      equipmentId: 'vh',
      equipmentName: 'Videohub',
      host: '127.0.0.1',
      port,
      vorschau: 'VIDEO OUTPUT ROUTING:\n3 7\n\n',
      art: 'text',
      punkte: [{ output: 3, input: 7 }],
    })
    expect(r.ok).toBe(true)
    expect(vh.snapshot()['route.3']).toBe(7)
    expect(changes).toContainEqual({ 'route.3': 7 })
  })
})
