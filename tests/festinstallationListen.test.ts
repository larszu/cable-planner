import { describe, expect, it, vi } from 'vitest'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'

// Die Patch-Sheets schreiben ueber `pdfText`; mitgeschrieben wird, was auf dem
// Blatt landet, ohne das komprimierte PDF zu entpacken.
const gedruckt: string[] = []
vi.mock('../src/renderer/lib/pdfHelpers', async (orig) => {
  const echt = await orig<typeof import('../src/renderer/lib/pdfHelpers')>()
  return {
    ...echt,
    pdfText: (...args: Parameters<typeof echt.pdfText>) => {
      gedruckt.push(String(args[1]))
      return echt.pdfText(...args)
    },
  }
})

const { signalwegeTable } = await import('../src/renderer/lib/signalwegListe')
const { hausStreckenTable } = await import('../src/renderer/lib/hausStrecken')
const { buildDevicePatchSheetBlob } = await import('../src/renderer/lib/exportDevicePdf')

// ---------------------------------------------------------------------------
// Festinstallation: die Blaetter, die am Beispiel „3 PTZ Saal → Regie"
// fehlten — alle Signalwege mit Etage und Raum, die Belegung der
// Hausstrecken Ader fuer Ader, und der Ort auf dem Patch-Sheet.
// ---------------------------------------------------------------------------

const port = (id: string, name: string, connectorType: Port['connectorType'] = 'BNC'): Port => ({
  id,
  name,
  type: connectorType,
  connectorType,
})

const geraet = (id: string, over: Partial<EquipmentItem>): EquipmentItem =>
  ({ id, name: id, category: 'Video', inputs: [], outputs: [], x: 0, y: 0, width: 100, height: 60, ...over }) as EquipmentItem

const kabel = (id: string, a: [string, string], b: [string, string], over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: id,
    cableNumber: id,
    type: 'BNC',
    length: 5,
    color: '#000',
    fromEquipmentId: a[0],
    fromPortId: a[1],
    toEquipmentId: b[0],
    toPortId: b[1],
    notes: '',
    ...over,
  }) as Cable

const projekt = (): CablePlannerProject => {
  const cam = geraet('PTZ 1', { outputs: [port('cam-out', 'SDI Out')], x: 20, y: 20 })
  const waf = geraet('WAF-EG-01', {
    category: 'Patch panels',
    inputs: [port('waf-v1', 'BNC 1'), port('waf-v2', 'BNC 2')],
    outputs: [port('waf-h1', 'BNC 1 hinten'), port('waf-h2', 'BNC 2 hinten')],
    x: 200,
    y: 20,
  })
  const pp = geraet('PP-R-01', {
    category: 'Patch panels',
    inputs: [port('pp-h1', 'BNC 1 hinten'), port('pp-h2', 'BNC 2 hinten')],
    outputs: [port('pp-v1', 'BNC 1'), port('pp-v2', 'BNC 2')],
    x: 1020,
    y: 20,
  })
  const atem = geraet('ATEM', { category: 'Video Mixer', inputs: [port('atem-1', 'SDI In 1')], x: 1200, y: 20 })
  return {
    metadata: { name: 'T', createdAt: '', updatedAt: '' },
    equipment: [cam, waf, pp, atem],
    cables: [
      kabel('V-101', ['PTZ 1', 'cam-out'], ['WAF-EG-01', 'waf-v1']),
      kabel('HS-V01', ['WAF-EG-01', 'waf-h1'], ['PP-R-01', 'pp-h1'], { isTieLine: true, hausStreckeId: 'hs1', hausAder: 'V1' }),
      kabel('V-201', ['PP-R-01', 'pp-v1'], ['ATEM', 'atem-1']),
    ],
    locations: [
      { id: 'saal', name: 'Saal', x: 0, y: 0, width: 400, height: 200, color: '#00f', floor: 'EG' },
      { id: 'regie', name: 'Regie', x: 1000, y: 0, width: 400, height: 200, color: '#f00', floor: '2. OG' },
    ],
    floors: [
      { name: 'EG', elevationM: 0 },
      { name: '2. OG', elevationM: 8 },
    ],
    hausAuskunft: {
      name: 'Haus',
      gelesenAm: '2026-09-01',
      quelle: 'test',
      raeume: [],
      punkte: [],
      klinken: [],
      strecken: [
        {
          id: 'hs1',
          bezeichnung: 'HS-01',
          vonBlende: 'WAF-EG-01',
          nachBlende: 'PP-R-01',
          adern: [
            { nr: 'V1', stecker: 'BNC', signal: 'SDI' },
            { nr: 'V2', stecker: 'BNC', signal: 'SDI' },
          ],
        },
      ],
    },
    canvasState: { x: 0, y: 0, zoom: 1 },
  } as CablePlannerProject
}

describe('Signalwege als Liste', () => {
  it('fuehrt die Kette mit Etage und Raum an jeder Station', () => {
    const t = signalwegeTable(projekt())
    expect(t.rows).toHaveLength(1)
    const [kette, quelle, von, ziel, nach, stationen, haus, ende, weg] = t.rows[0]
    expect(kette).toBe('K1')
    expect(quelle).toBe('PTZ 1 · SDI Out')
    expect(von).toBe('EG · Saal')
    expect(ziel).toBe('ATEM · SDI In 1')
    expect(nach).toBe('2. OG · Regie')
    expect(stationen).toBe('WAF-EG-01 (Patchfeld), PP-R-01 (Patchfeld)')
    expect(haus).toBe('HS-V01 (V1)')
    expect(ende).toBe('')
    expect(weg).toContain('—[HS-V01]→ 2. OG · Regie · PP-R-01 · BNC 1 hinten')
  })
})

describe('Hausstrecken-Belegung', () => {
  it('nennt je Ader das Kabel oder „frei"', () => {
    const t = hausStreckenTable(projekt())
    expect(t.rows.map((r) => [r[2], r[5], r[6]])).toEqual([
      ['V1', 'HS-V01', ''],
      ['V2', '', 'frei'],
    ])
  })

  it('meldet ein Kabel auf einer Strecke, die das Haus nicht mehr nennt', () => {
    const p = projekt()
    p.cables[1] = { ...p.cables[1], hausStreckeId: 'weg' }
    const t = hausStreckenTable(p)
    expect(t.rows.at(-1)?.[6]).toBe('Strecke nicht mehr in der Auskunft')
  })
})

describe('Patch-Sheet mit Ort', () => {
  it('nennt den Ort des Geraets und den des anderen Endes, wenn er ein anderer ist', () => {
    const p = projekt()
    gedruckt.length = 0
    buildDevicePatchSheetBlob(p.equipment[1], p.equipment, p.cables, { locations: p.locations, floors: p.floors })
    expect(gedruckt.some((z) => z.includes('Ort EG · Saal'))).toBe(true)
    expect(gedruckt.some((z) => z.includes('an PP-R-01') && z.includes('(2. OG · Regie)'))).toBe(true)
    expect(gedruckt.some((z) => z.includes('an PTZ 1') && z.includes('('))).toBe(false)
  })

  it('bleibt ohne Rahmen wie bisher', () => {
    const p = projekt()
    gedruckt.length = 0
    buildDevicePatchSheetBlob(p.equipment[1], p.equipment, p.cables)
    expect(gedruckt.some((z) => z.includes('Ort '))).toBe(false)
  })
})
