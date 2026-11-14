// #1182 — der Ablauf am Kabelplan: Verknuepfung, Pruefung, Regie-Blatt.
import { describe, expect, it } from 'vitest'
import { ablaufPruefung, ablaufWarnungen, regieBlattForProject } from '../src/renderer/lib/ablaufPruefung'
import { regieBlattHtml } from '../src/renderer/lib/ablaufRegie'
import { normaliseRundown } from '../src/renderer/lib/rundownCard'
import { currentStand, DOCUMENT_LABELS } from '../src/renderer/lib/documentRegistry'
import type { RundownPlan } from '../src/renderer/types/rundown'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { CheckFinding } from '../src/renderer/types/checkFinding'

const eq = (id: string, name: string) => ({ id, name, inputs: [], outputs: [], x: 0, y: 0, width: 100, height: 60 }) as unknown as EquipmentItem
const kabel = (id: string, von: string, nach: string) =>
  ({ id, name: id, fromEquipmentId: von, fromPortId: 'o', toEquipmentId: nach, toPortId: 'i' }) as unknown as Cable

const plan: RundownPlan = {
  source: 'ablauf.xlsx',
  segments: [
    { id: '18:40', number: '18:40', title: 'Band 2', note: 'Kamera 3 auf Kran' },
    { id: '19:00', number: '19:00', title: 'Pause' },
    { id: '19:10', number: '19:10', title: 'Rede' },
  ],
  coverage: [],
  links: [
    { segmentId: '18:40', equipmentIds: ['cam3', 'atem'], cableIds: ['k1'] },
    { segmentId: '19:10', equipmentIds: ['weg'], cableIds: ['k2', 'k9'] },
  ],
}
const equipment = [eq('cam3', 'Kamera 3'), eq('atem', 'ATEM')]
const cables = [kabel('k1', 'cam3', 'atem'), kabel('k2', 'cam3', 'gone')]

describe('Ablauf-Pruefung', () => {
  it('prueft nur verknuepfte Abschnitte und nennt, was fehlt', () => {
    const p = ablaufPruefung({ rundown: plan, equipment, cables, befunde: [] })
    expect(p[0].ok).toBe(true)
    expect(p[0].geraete).toEqual(['Kamera 3', 'ATEM'])
    expect(p[1].ok).toBeUndefined()
    expect(p[2].befunde.map((b) => b.art)).toEqual(['geraet-fehlt', 'weg-ohne-ende', 'weg-fehlt'])
    expect(ablaufWarnungen(p)).toBe(3)
  })

  it('uebernimmt Fehler und Warnungen des Plan-Checks an verknuepften Elementen, keine Infos', () => {
    const befunde: CheckFinding[] = [
      { id: 'a', severity: 'warning', category: 'x', message: 'Format passt nicht', cableId: 'k1' },
      { id: 'b', severity: 'info', category: 'x', message: 'nur Hinweis', equipmentId: 'cam3' },
      { id: 'c', severity: 'error', category: 'x', message: 'anderswo', equipmentId: 'fremd' },
    ]
    const p = ablaufPruefung({ rundown: plan, equipment, cables, befunde })
    expect(p[0].befunde).toEqual([{ art: 'check', id: 'a', text: 'Format passt nicht', cableId: 'k1' }])
  })

  it('Verknuepfungen ins Leere fallen beim Laden, gueltige bleiben', () => {
    const r = normaliseRundown({ ...plan, links: [...plan.links!, { segmentId: 'gibt-es-nicht', equipmentIds: ['x'], cableIds: [] }, { segmentId: '19:00', equipmentIds: [], cableIds: [] }] })
    expect(r?.links?.map((l) => l.segmentId)).toEqual(['18:40', '19:10'])
  })

  it('Regie-Blatt: Spalten fuer Geraete und Wege, im Register mit Stand', () => {
    const projekt = { rundown: plan, equipment, cables, metadata: { name: 'Show' } } as never
    const t = regieBlattForProject(projekt)
    expect(t.rows[0].slice(0, 5)).toEqual(['18:40', 'Band 2', 'Kamera 3 auf Kran', 'Kamera 3, ATEM', 'k1'])
    expect(regieBlattHtml(projekt, { titel: 'Regie' })).toContain('Band 2 — Kamera 3 auf Kran')
    expect(DOCUMENT_LABELS.regieblatt).toBeTruthy()
    expect(currentStand('regieblatt', projekt)).toMatch(/^[0-9a-f]{8}$/)
  })
})
