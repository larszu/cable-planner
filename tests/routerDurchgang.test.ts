// ───────────────────────────────────────────────────────────────────────────
// Die Kette Kamera -> Videohub -> ATEM.
//
// Das ist die Standard-Broadcast-Kette und der Fall, den ADR-001 ausdruecklich
// zum Blocker erklaert hat. Bis 2026-09-04 war er von KEINEM Test gedeckt:
// `tests/labelDerivation.test.ts` fuehrt den Videohub nur als eigenstaendige
// Senke, nie in einer Kette, und `tests/tallyMap.test.ts` kannte gar keinen.
// Gemessen hat die Karte dabei die ROUTER-Eingangsnummer exportiert
// (`{"id":"r1","name":"Kamera 1","input":7}` statt Eingang 1 am ATEM), ohne
// einen Befund zu erzeugen.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { buildTallyMap, toTallyPiDevices } from '../src/renderer/lib/tallyMap'
import { buildSourceMap } from '../src/renderer/lib/sourceMap'
import { deriveLabels } from '../src/renderer/lib/labelDerivation'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port, VideohubCrosspoints } from '../src/renderer/types/equipment'

const port = (id: string, name: string): Port => ({
  id,
  name,
  type: 'BNC',
  connectorType: 'BNC',
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

/**
 * Kamera -> Videohub In 7; Videohub Out 3 -> ATEM In 1.
 *
 * `planned` ist `routing[outputIndex] = inputIndex`, beide 0-basiert: Out 3
 * ist Index 2, In 7 ist Index 6.
 */
const kette = (opt: {
  kreuzpunkt?: VideohubCrosspoints
  reihenfolge?: 'vh-zuerst' | 'atem-zuerst'
} = {}) => {
  const cam = eq({
    id: 'cam1',
    name: 'URSA A',
    category: 'Kameras',
    outputs: [port('cam1-out', 'SDI Out')],
    sourceIdentityId: 'r1',
  })
  const vh = eq({
    id: 'vh',
    name: 'Smart Videohub 20x20',
    inputs: Array.from({ length: 8 }, (_, i) => port(`vh-in${i + 1}`, `In ${i + 1}`)),
    outputs: Array.from({ length: 8 }, (_, i) => port(`vh-out${i + 1}`, `Out ${i + 1}`)),
    ...(opt.kreuzpunkt ? { videohubRouting: { planned: opt.kreuzpunkt, salvos: [] } } : {}),
  })
  const atem = eq({
    id: 'atem',
    name: 'ATEM Mini Extreme',
    inputs: Array.from({ length: 4 }, (_, i) => port(`atem-in${i + 1}`, `In ${i + 1}`)),
  })
  return {
    equipment: opt.reihenfolge === 'atem-zuerst' ? [cam, atem, vh] : [cam, vh, atem],
    cables: [
      cable(['cam1', 'cam1-out'], ['vh', 'vh-in7']),
      cable(['vh', 'vh-out3'], ['atem', 'atem-in1']),
    ],
    sourceIdentities: [{ id: 'r1', name: 'Kamera 1', number: 1, umdAddress: 1 }],
  }
}

describe('Kreuzpunkt gesetzt: die Kette loest bis zum Mischer auf', () => {
  const plan = kette({ kreuzpunkt: { 2: 6 } })

  it('die Tally-Karte nennt den ATEM, nicht den Router', () => {
    const map = buildTallyMap(plan)
    expect(map.rows[0]?.switcher).toEqual({
      equipmentId: 'atem',
      name: 'ATEM Mini Extreme',
      input: 1,
    })
  })

  it('die tally.json traegt die ATEM-Nummer', () => {
    expect(toTallyPiDevices(buildTallyMap(plan))).toEqual([
      { id: 'r1', name: 'Kamera 1', input: 1 },
    ])
  })

  it('die .avsourcemap traegt dieselbe Nummer und denselben Sink', () => {
    const { map, unresolvedRouters } = buildSourceMap(plan, {
      appVersion: '0.0.0-test',
      exportedAt: '2026-09-04T00:00:00.000Z',
    })
    expect(map.sources[0].bindings[0]).toMatchObject({
      sinkEquipmentId: 'atem',
      sinkName: 'ATEM Mini Extreme',
      input: 1,
    })
    expect(unresolvedRouters).toEqual([])
  })

  it('der UMD-Kandidat haengt an der Kamera, nicht am Router', () => {
    const { candidates } = deriveLabels(plan)
    const umd = candidates.filter((c) => c.targetId === 'tsl-umd-v31')
    expect(umd).toHaveLength(1)
    expect(umd[0]).toMatchObject({ equipmentId: 'cam1', raw: 'Kamera 1' })
  })

  it('kein Befund — die Karte ist vollstaendig', () => {
    expect(buildTallyMap(plan).issues).toEqual([])
  })
})

describe('Kreuzpunkt fehlt: keine Zahl, sondern ein Befund', () => {
  const plan = kette()

  it('es wird KEINE Eingangsnummer erfunden', () => {
    const map = buildTallyMap(plan)
    expect(map.rows[0]?.switcher).toBeUndefined()
    expect(toTallyPiDevices(map)).toEqual([])
  })

  it('der Befund nennt Router, Eingang und den naechsten Schritt', () => {
    const issue = buildTallyMap(plan).issues.find((i) => i.kind === 'router-not-resolved')
    expect(issue).toBeDefined()
    expect(issue?.message).toContain('Smart Videohub 20x20')
    expect(issue?.message).toContain('Eingang 7')
    expect(issue?.message).toContain('Kreuzpunkt')
  })

  it('er fordert NICHT dazu auf, dem Router eine Rolle zu geben', () => {
    // Der einzige Befund lautete frueher: "Smart Videohub 20x20 speist ATEM
    // Mini Extreme auf Eingang 1, traegt aber keine Rolle". Das fuehrt vom
    // Fehler weg.
    const issues = buildTallyMap(plan).issues
    expect(issues.filter((i) => i.kind === 'source-without-role')).toEqual([])
  })

  it('die .avsourcemap traegt keine Zahl und sagt warum', () => {
    const { map, unresolvedRouters } = buildSourceMap(plan, {
      appVersion: '0.0.0-test',
      exportedAt: '2026-09-04T00:00:00.000Z',
    })
    expect(map.sources[0].bindings[0].input).toBeUndefined()
    expect(unresolvedRouters).toEqual([
      { name: 'Kamera 1', router: 'Smart Videohub 20x20', input: 7 },
    ])
  })
})

describe('das Ergebnis haengt am Plan, nicht an der Array-Reihenfolge', () => {
  // Gemessen: derselbe Plan mit umsortiertem `equipment` lieferte einmal
  // Eingang 7 und einmal Eingang 3, beide ohne Befund. Eine exportierte Datei
  // darf keine Funktion des Bearbeitungsverlaufs sein.
  for (const kreuzpunkt of [undefined, { 2: 6 }]) {
    const wie = kreuzpunkt ? 'mit Kreuzpunkt' : 'ohne Kreuzpunkt'
    it(`${wie}: beide Reihenfolgen liefern dasselbe`, () => {
      const a = buildTallyMap(kette({ kreuzpunkt, reihenfolge: 'vh-zuerst' }))
      const b = buildTallyMap(kette({ kreuzpunkt, reihenfolge: 'atem-zuerst' }))
      expect(a.rows[0]?.switcher).toEqual(b.rows[0]?.switcher)
      expect(toTallyPiDevices(a)).toEqual(toTallyPiDevices(b))
      expect(a.issues.map((i) => i.kind).sort()).toEqual(b.issues.map((i) => i.kind).sort())
    })
  }

  it('zwei Mischer-Eingaenge derselben Rolle: der kleinere gewinnt, stabil', () => {
    // Haupt-/Backup-Weg derselben Kamera auf zwei ATEM-Eingaenge.
    const bau = (umgedreht: boolean) => {
      const cam = eq({
        id: 'cam1',
        name: 'URSA A',
        category: 'Kameras',
        outputs: [port('cam1-a', 'SDI A'), port('cam1-b', 'SDI B')],
        sourceIdentityId: 'r1',
      })
      const atem = eq({
        id: 'atem',
        name: 'ATEM Mini Extreme',
        inputs: umgedreht
          ? [port('atem-in3', 'In 3'), port('atem-in1', 'In 1')]
          : [port('atem-in1', 'In 1'), port('atem-in3', 'In 3')],
      })
      return {
        equipment: [cam, atem],
        cables: [
          cable(['cam1', 'cam1-a'], ['atem', 'atem-in1']),
          cable(['cam1', 'cam1-b'], ['atem', 'atem-in3']),
        ],
        sourceIdentities: [{ id: 'r1', name: 'Kamera 1', number: 1, umdAddress: 1 }],
      }
    }
    expect(buildTallyMap(bau(false)).rows[0]?.switcher?.input).toBe(1)
    expect(buildTallyMap(bau(true)).rows[0]?.switcher?.input).toBe(1)
  })
})
