import { describe, expect, it } from 'vitest'
import { belegtDurch, istVollstaendig, teileSatz, versteheSprache, zerlegeSaetze } from '../src/renderer/lib/sprachKabel'
import type { CablePlannerProject } from '../src/renderer/types/project'

// #1056 — Spracheingabe. Gemessen wird, welche Geraete und Ports aus einem
// Satz werden; angelegt wird ueber connect_many (dort getestet).

const ports = (pre: string, n: number, connectorType: string, direction: 'in' | 'out') =>
  Array.from({ length: n }, (_, i) => ({ id: `${pre}${i + 1}`, name: `${pre.includes('hdmi') ? 'HDMI' : 'SDI'} ${direction === 'in' ? 'In' : 'Out'} ${i + 1}`, connectorType, direction }))

const plan = (): CablePlannerProject =>
  ({
    metadata: { name: 'Haus' },
    equipment: [
      { id: 'atem', name: 'ATEM Constellation 4K', category: 'Switcher', x: 50, y: 50, width: 100, height: 100, inputs: ports('ai', 4, 'BNC', 'in'), outputs: ports('ao', 4, 'BNC', 'out') },
      { id: 'cam1', name: 'Kamera 1', category: 'Camera', x: 50, y: 300, width: 100, height: 100, inputs: [], outputs: ports('c1o', 1, 'BNC', 'out') },
      { id: 'cam2', name: 'Kamera 2', category: 'Camera', x: 200, y: 300, width: 100, height: 100, inputs: [], outputs: ports('c2o', 1, 'BNC', 'out') },
      { id: 'nec', name: 'NEC MultiSync P402', category: 'Monitor', x: 2050, y: 50, width: 100, height: 100, inputs: [{ id: 'nh1', name: 'HDMI In 1', connectorType: 'HDMI', direction: 'in' }, { id: 'ndp', name: 'DisplayPort In', connectorType: 'DisplayPort', direction: 'in' }], outputs: [] },
      { id: 'mon1', name: 'Monitor Wand', category: 'Monitor', x: 2250, y: 50, width: 100, height: 100, inputs: ports('m1i', 1, 'BNC', 'in'), outputs: [] },
      { id: 'mon2', name: 'Monitor Theke', category: 'Monitor', x: 2250, y: 250, width: 100, height: 100, inputs: ports('m2i', 1, 'BNC', 'in'), outputs: [] },
      { id: 'mon3', name: 'Monitor Regie', category: 'Monitor', x: 250, y: 50, width: 100, height: 100, inputs: ports('m3i', 1, 'BNC', 'in'), outputs: [] },
    ],
    cables: [{ id: 'k1', fromEquipmentId: 'cam1', fromPortId: 'c1o1', toEquipmentId: 'atem', toPortId: 'ai1' }],
    locations: [
      { id: 'regie', name: 'Regie', x: 0, y: 0, width: 1000, height: 1000, color: '#000' },
      { id: 'foyer', name: 'Foyer', x: 2000, y: 0, width: 1000, height: 1000, color: '#000' },
    ],
  }) as unknown as CablePlannerProject

const eins = (text: string) => {
  const r = versteheSprache(plan(), text)
  expect(r.kabel).toHaveLength(1)
  return r.kabel[0]
}

describe('#1056 — Satz zerlegen', () => {
  it.each([
    ['SDI 1 vom ATEM in den NEC im Foyer', 'sdi 1 vom atem', 'den nec im foyer'],
    ['Kamera 2 auf den Mischer, Eingang 2', 'kamera 2', 'den mischer eingang 2'],
    ['from the ATEM SDI 1 to the NEC in the foyer', 'the atem sdi 1', 'the nec in the foyer'],
    ['Verbinde Kamera 2 mit dem ATEM', 'kamera 2', 'dem atem'],
    ['connect camera 2 to switcher input 3', 'camera 2', 'switcher input 3'],
    ['Kamera 1 -> Monitor Regie', 'kamera 1', 'monitor regie'],
    ['Kamera 1 → Monitor Regie', 'kamera 1', 'monitor regie'],
    ['Kamera 2 nach Monitor Regie', 'kamera 2', 'monitor regie'],
  ])('%s', (satz, von, nach) => {
    expect(teileSatz(satz)).toEqual({ von, nach })
  })

  it('ohne Ziel: null', () => {
    expect(teileSatz('ATEM')).toBeNull()
  })

  it('mehrere Saetze', () => {
    expect(zerlegeSaetze('Kamera 1 auf ATEM 1. Kamera 2 auf ATEM 2; Kamera 1 in Monitor Regie und dann ATEM in den NEC')).toHaveLength(4)
    expect(zerlegeSaetze('camera 1 to atem then camera 2 to atem')).toHaveLength(2)
  })
})

describe('#1056 — Geraete und Ports', () => {
  it('Beispielsatz aus dem Issue: ATEM SDI Out 1 → NEC (Foyer), Stecker fehlt', () => {
    const k = eins('SDI 1 vom ATEM in den NEC im Foyer')
    expect(k.von.geraetId).toBe('atem')
    expect(k.von.portId).toBe('ao1')
    expect(k.nach.geraetId).toBe('nec')
    expect(k.nach.signalFehlt).toBe(false)
    expect(k.nach.portId).toBe('nh1')
    expect(istVollstaendig(k)).toBe(true)
  })

  it('Langform aus dem Issue mit Unschaerfe „Foxer" und „irgendein NEC"', () => {
    const k = eins('SDI 1 von ATEM soll in Monitor, der an der Wand hängt, im Foxer. Irgendein NEC.')
    expect(k.von.portId).toBe('ao1')
    expect(k.nach.wunsch.raum?.id).toBe('foyer')
    // Der Nachsatz „Irgendein NEC." entscheidet zwischen den Monitoren im Foyer
    expect(k.nach.geraetId).toBe('nec')
    expect(k.nach.portId).toBe('nh1')
  })

  it('Kamera 2 auf den Mischer, Eingang 2', () => {
    const k = eins('Kamera 2 auf den Mischer, Eingang 2')
    expect(k.von.geraetId).toBe('cam2')
    expect(k.von.portId).toBe('c2o1')
    expect(k.nach.geraetId).toBe('atem')
    expect(k.nach.portId).toBe('ai2')
  })

  it.each([
    ['Kamera zwei auf den Mischer Eingang drei', 'cam2', 'ai3'],
    ['camera 2 to the switcher input 4', 'cam2', 'ai4'],
    ['Cam 2 in ATEM SDI 3', 'cam2', 'ai3'],
    ['Kamera2 auf Atem Eingang 2', 'cam2', 'ai2'],
    ['von Kamera 2 nach ATEM', 'cam2', 'ai2'],
    ['connect Kamera 2 with the ATEM Constellation', 'cam2', 'ai2'],
    ['Kammera 2 auf Mischer Eingang 4', 'cam2', 'ai4'],
  ])('%s', (satz, von, nachPort) => {
    const k = eins(satz)
    expect(k.von.geraetId).toBe(von)
    expect(k.nach.geraetId).toBe('atem')
    expect(k.nach.portId).toBe(nachPort)
  })

  it('ohne Nummer: erster freier Eingang (Eingang 1 ist belegt)', () => {
    const k = eins('Kamera 2 auf den ATEM')
    expect(k.nach.portId).toBe('ai2')
  })

  it('Ausgang mit Nummer', () => {
    const k = eins('ATEM Ausgang 3 in Monitor Regie')
    expect(k.von.portId).toBe('ao3')
    expect(k.nach.geraetId).toBe('mon3')
  })

  it('englisch: from switcher output 2 to the monitor in the control room fails room, picks by name', () => {
    const k = eins('from switcher output 2 to Monitor Regie')
    expect(k.von.portId).toBe('ao2')
    expect(k.nach.geraetId).toBe('mon3')
  })

  it('Mehrdeutig: „Monitor im Foyer" bei zwei Monitoren → Kandidaten, kein Raten', () => {
    const k = eins('ATEM SDI 2 auf Monitor im Foyer')
    expect(k.nach.geraetId).toBeUndefined()
    expect(k.nach.kandidaten.map((e) => e.id).sort()).toEqual(['mon1', 'mon2', 'nec'].filter((id) => k.nach.kandidaten.some((e) => e.id === id)).sort())
    expect(k.nach.kandidaten.length).toBeGreaterThan(1)
    expect(istVollstaendig(k)).toBe(false)
  })

  it('Raum schraenkt ein: „Monitor in der Regie" ist eindeutig', () => {
    const k = eins('ATEM SDI 2 auf den Monitor in der Regie')
    expect(k.nach.geraetId).toBe('mon3')
  })

  it('Belegter Eingang wird gemeldet statt ersetzt', () => {
    const p = plan()
    const k = versteheSprache(p, 'Kamera 2 auf ATEM Eingang 1').kabel[0]
    expect(k.nach.portId).toBe('ai1')
    expect(belegtDurch(p, k)?.id).toBe('k1')
  })

  it('Nummer, die es nicht gibt: kein Port statt eines falschen', () => {
    const k = eins('Kamera 2 auf ATEM Eingang 9')
    expect(k.nach.portId).toBeUndefined()
  })

  it('unbekanntes Geraet: keine Kandidaten', () => {
    const k = eins('Kamera 2 auf den Beamer')
    expect(k.nach.kandidaten).toEqual([])
  })

  it('unverstandener Satz wird gesammelt', () => {
    const r = versteheSprache(plan(), 'Hallo')
    expect(r.kabel).toEqual([])
    expect(r.unverstanden).toEqual(['Hallo'])
  })

  it('mehrere Kabel in einem Diktat', () => {
    const r = versteheSprache(plan(), 'Kamera 2 auf ATEM Eingang 2. ATEM SDI 1 in Monitor Regie')
    expect(r.kabel.map((k) => [k.von.portId, k.nach.portId])).toEqual([
      ['c2o1', 'ai2'],
      ['ao1', 'm3i1'],
    ])
  })
})
