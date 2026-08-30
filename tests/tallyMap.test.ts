import { describe, expect, it } from 'vitest'
import { buildTallyMap, tallyMapCsv, toTallyPiDevices } from '../src/renderer/lib/tallyMap'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

const port = (id: string, name: string, over: Partial<Port> = {}): Port => ({
  id,
  name,
  type: 'BNC',
  connectorType: 'BNC',
  ...over,
})

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Video',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const cable = (from: [string, string], to: [string, string]): Cable => ({
  id: `${from[1]}->${to[1]}`,
  name: `${from[1]}->${to[1]}`,
  type: 'BNC',
  length: 10,
  color: '#fff',
  fromEquipmentId: from[0],
  fromPortId: from[1],
  toEquipmentId: to[0],
  toPortId: to[1],
  notes: '',
})

const cam = (id: string, name: string, over: Partial<EquipmentItem> = {}) =>
  eq({ id, name, category: 'Kameras', outputs: [port(`${id}-out`, 'SDI Out')], ...over })

/** Zwei Kameras mit Rollen an einem ATEM. */
const scene = () => ({
  equipment: [
    eq({
      id: 'atem',
      name: 'ATEM Mini Extreme',
      inputs: [port('in1', 'In 1'), port('in2', 'In 2')],
    }),
    cam('cam1', 'URSA A', { sourceIdentityId: 'r1' }),
    cam('cam2', 'URSA B', { sourceIdentityId: 'r2' }),
  ],
  cables: [
    cable(['cam1', 'cam1-out'], ['atem', 'in1']),
    cable(['cam2', 'cam2-out'], ['atem', 'in2']),
  ],
  sourceIdentities: [
    { id: 'r1', name: 'Kamera 1', number: 1, umdAddress: 1 },
    { id: 'r2', name: 'Kamera 2', number: 2, umdAddress: 2 },
  ],
})

describe('buildTallyMap', () => {
  it('schliesst die Kette Rolle → Gerät → Eingang → Adresse', () => {
    const { rows, issues } = buildTallyMap(scene())
    expect(issues).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      identityId: 'r1',
      name: 'Kamera 1',
      number: 1,
      umdAddress: 1,
      switcher: { equipmentId: 'atem', name: 'ATEM Mini Extreme', input: 1 },
    })
    expect(rows[0].devices).toEqual([{ id: 'cam1', name: 'URSA A' }])
  })

  it('sortiert nach redaktioneller Nummer, nicht nach Anlege-Reihenfolge', () => {
    const s = scene()
    s.sourceIdentities = [
      { id: 'r2', name: 'Kamera 2', number: 2, umdAddress: 2 },
      { id: 'r1', name: 'Kamera 1', number: 1, umdAddress: 1 },
    ]
    expect(buildTallyMap(s).rows.map((r) => r.name)).toEqual(['Kamera 1', 'Kamera 2'])
  })

  it('führt ein Haupt-/Backup-Paar als EINE Zeile mit zwei Geräten', () => {
    const s = scene()
    s.equipment.push(cam('cam1b', 'URSA A (Havarie)', { sourceIdentityId: 'r1' }))
    const row = buildTallyMap(s).rows.find((r) => r.identityId === 'r1')
    expect(row?.devices.map((d) => d.name)).toEqual(['URSA A', 'URSA A (Havarie)'])
    // Das Tally folgt dem, was am Mischer ankommt — die Zeile bleibt eine.
    expect(row?.switcher?.input).toBe(1)
  })

  it('meldet eine Rolle ohne Gerät', () => {
    const s = scene()
    s.sourceIdentities.push({ id: 'r3', name: 'Kamera 3' })
    const kinds = buildTallyMap(s).issues.filter((i) => i.subject === 'r3').map((i) => i.kind)
    expect(kinds).toContain('no-device')
    expect(kinds).toContain('no-umd-address')
  })

  it('meldet eine Rolle, die keinen Mischer-Eingang erreicht', () => {
    const s = scene()
    s.cables = [s.cables[0]]
    const issue = buildTallyMap(s).issues.find((i) => i.kind === 'no-switcher-input')
    expect(issue?.subject).toBe('r2')
    expect(issue?.severity).toBe('warning')
  })

  it('meldet eine doppelte UMD-Adresse als Fehler', () => {
    const s = scene()
    s.sourceIdentities[1].umdAddress = 1
    const issue = buildTallyMap(s).issues.find((i) => i.kind === 'duplicate-address')
    expect(issue?.severity).toBe('error')
    expect(issue?.message).toContain('"Kamera 1"')
    expect(issue?.message).toContain('"Kamera 2"')
  })

  it('meldet eine Quelle am Mischer, die keine Rolle trägt', () => {
    const s = scene()
    s.equipment[2].sourceIdentityId = undefined
    s.sourceIdentities = [s.sourceIdentities[0]]
    const issue = buildTallyMap(s).issues.find((i) => i.kind === 'source-without-role')
    expect(issue?.subject).toBe('cam2')
    expect(issue?.message).toContain('Eingang 2')
  })

  it('meldet dieselbe rollenlose Quelle nur einmal, auch bei Doppelspeisung', () => {
    const s = scene()
    s.equipment[2].sourceIdentityId = undefined
    s.sourceIdentities = [s.sourceIdentities[0]]
    s.equipment[1].outputs.push(port('cam1-out2', 'SDI Out 2'))
    const found = buildTallyMap(s).issues.filter((i) => i.kind === 'source-without-role')
    expect(found).toHaveLength(1)
  })

  it('bleibt bei einem Plan ohne Rollen leer statt zu raten', () => {
    const map = buildTallyMap({ equipment: [], cables: [], sourceIdentities: [] })
    expect(map.rows).toEqual([])
    expect(map.issues).toEqual([])
  })
})

describe('toTallyPiDevices', () => {
  it('liefert genau die Felder, die der Plan besitzt', () => {
    const devices = toTallyPiDevices(buildTallyMap(scene()))
    expect(devices).toEqual([
      { id: 'r1', name: 'Kamera 1', input: 1 },
      { id: 'r2', name: 'Kamera 2', input: 2 },
    ])
  })

  it('erfindet weder GPIO-Pin noch ME — die gehören der Hardware', () => {
    const [first] = toTallyPiDevices(buildTallyMap(scene()))
    expect(Object.keys(first).sort()).toEqual(['id', 'input', 'name'])
  })

  it('lässt Zeilen ohne Eingang weg — die hätten nichts zu hören', () => {
    const s = scene()
    s.cables = []
    expect(toTallyPiDevices(buildTallyMap(s))).toEqual([])
  })

  it('nutzt die Rollen-Id, damit die Hardware-Verdrahtung Gerätetausch überlebt', () => {
    const s = scene()
    s.equipment[1] = cam('cam1-neu', 'URSA C', { sourceIdentityId: 'r1' })
    s.cables[0] = cable(['cam1-neu', 'cam1-neu-out'], ['atem', 'in1'])
    const devices = toTallyPiDevices(buildTallyMap(s))
    expect(devices.find((d) => d.id === 'r1')).toMatchObject({ name: 'Kamera 1', input: 1 })
  })
})

describe('tallyMapCsv', () => {
  it('schreibt eine Kopfzeile und eine Zeile je Rolle', () => {
    const csv = tallyMapCsv(buildTallyMap(scene()))
    const lines = csv.split('\r\n')
    expect(lines[0]).toContain('UMD-Adresse')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('Kamera 1')
    expect(lines[1]).toContain('ATEM Mini Extreme')
  })

  it('lässt fehlende Werte leer, statt sie zu erfinden', () => {
    const s = scene()
    s.sourceIdentities = [{ id: 'r1', name: 'Kamera 1' }]
    s.equipment[2].sourceIdentityId = undefined
    const cells = tallyMapCsv(buildTallyMap(s)).split('\r\n')[1].split(';')
    expect(cells[0]).toBe('') // keine Nummer
    expect(cells[5]).toBe('') // keine UMD-Adresse
    expect(cells[4]).toBe('1') // der Eingang steht sehr wohl da
  })
})
