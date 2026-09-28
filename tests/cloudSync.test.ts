import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CloudCallError, cloudPayload, mergeProjects, pushToCloud, type CloudApi } from '../src/renderer/lib/cloud'
import type { CablePlannerProject } from '../src/renderer/types/project'

const eq = (id: string, name: string, extra: Record<string, unknown> = {}) =>
  ({ id, name, category: 'Video', inputs: [], outputs: [], x: 0, y: 0, ...extra }) as unknown as CablePlannerProject['equipment'][number]
const cab = (id: string, from: string, to: string) =>
  ({ id, fromEquipmentId: from, toEquipmentId: to, fromPortId: 'o', toPortId: 'i', type: 'SDI' }) as unknown as CablePlannerProject['cables'][number]
const plan = (equipment: CablePlannerProject['equipment'], cables: CablePlannerProject['cables'] = [], name = 'Halle') =>
  ({ metadata: { name, description: '', createdAt: '', updatedAt: '' }, equipment, cables, canvasState: { x: 0, y: 0, zoom: 1 } }) as unknown as CablePlannerProject

/** Der Server im Kleinen: Revisionen, baseRev-Pruefung, 409. */
const fakeServer = () => {
  const revs: Record<string, unknown>[] = []
  const api = {
    create: async (_s: string, name: string, input: { data: Record<string, unknown> }) => {
      revs.push(input.data)
      return { id: 'p1', name, planner: 'cable', headRev: 1, createdAt: '', updatedAt: '' }
    },
    save: async (_s: string, _id: string, baseRev: number, input: { data: Record<string, unknown> }) => {
      if (baseRev !== revs.length) throw new CloudCallError({ code: 'conflict', headRev: revs.length })
      revs.push(input.data)
      return { rev: revs.length, unchanged: false }
    },
    revision: async (_s: string, id: string, rev: number | 'head') => {
      const n = rev === 'head' ? revs.length : rev
      return { projectId: id, name: 'Halle', rev: n, headRev: revs.length, createdAt: '', data: revs[n - 1] }
    },
  } as unknown as CloudApi
  return { api, revs }
}

describe('Cloud-Sync (#871)', () => {
  it('schickt keine Zugangsdaten und nicht die Verbindung selbst', () => {
    const p = { ...plan([eq('A', 'Switch', { username: 'admin', password: 'geheim' })]), cloud: { server: 's', projectId: 'p', rev: 1, syncedAt: '' } }
    const out = JSON.stringify(cloudPayload(p))
    expect(out).not.toContain('geheim')
    expect(out).not.toContain('admin')
    expect(out).not.toContain('projectId')
  })

  it('fuehrt zwei Geraete zusammen, statt eines zu ueberschreiben', async () => {
    const { api, revs } = fakeServer()
    const start = plan([eq('A', 'Kamera'), eq('B', 'Mischer')])
    const first = await pushToCloud(api, 'https://x', start)
    expect(first.binding.rev).toBe(1)

    // Laptop und iPad arbeiten beide auf Revision 1.
    const laptop = { ...start, cloud: first.binding, equipment: [...start.equipment, eq('C', 'Monitor')] }
    const ipad = { ...start, cloud: first.binding, equipment: [eq('A', 'Kamera 1'), eq('B', 'Mischer')], cables: [cab('k1', 'A', 'B')] }
    expect((await pushToCloud(api, 'https://x', ipad)).binding.rev).toBe(2)

    const r = await pushToCloud(api, 'https://x', laptop)
    expect(r.merged).not.toBeNull()
    expect(r.binding.rev).toBe(3)
    const names = r.merged!.equipment.map((e) => e.name)
    expect(names).toEqual(['Kamera 1', 'Mischer', 'Monitor'])
    expect(r.merged!.cables.map((c) => c.id)).toEqual(['k1'])
    expect((revs[2] as { equipment: unknown[] }).equipment).toHaveLength(3)
  })

  it('eine Loeschung auf der einen Seite bleibt geloescht, eine Aenderung auf der anderen bleibt erhalten', () => {
    const base = plan([eq('A', 'Kamera'), eq('B', 'Mischer')], [cab('k1', 'A', 'B')])
    const local = plan([eq('A', 'Kamera'), eq('B', 'Mischer')], [])
    const remote = plan([eq('A', 'Kamera'), eq('B', 'ATEM')], [cab('k1', 'A', 'B')], 'Halle neu')
    const m = mergeProjects(base, local, remote)
    expect(m.cables).toEqual([])
    expect(m.equipment.find((e) => e.id === 'B')!.name).toBe('ATEM')
    expect(m.metadata.name).toBe('Halle neu')
  })

  it('gibt den lokalen Geraeten ihre Zugangsdaten zurueck', () => {
    const base = plan([eq('A', 'Switch')])
    const local = plan([eq('A', 'Switch', { username: 'admin', password: 'geheim' })])
    const remote = plan([eq('A', 'Core-Switch')])
    const m = mergeProjects(base, local, remote)
    expect(m.equipment[0]).toMatchObject({ name: 'Core-Switch', username: 'admin', password: 'geheim' })
  })

  it('jeder Ausgang der Cloud geht durch stripCredentials', () => {
    const src = readFileSync('src/renderer/lib/cloud.ts', 'utf8')
    expect(src).toMatch(/stripCredentials\(rest\)/)
    expect(readFileSync('src/main/services/cloudProjectsClient.ts', 'utf8')).toBe(
      readFileSync('src/renderer/lib/cloudProjectsClient.ts', 'utf8'),
    )
  })
})

describe('Cloud-Verbindung im Store (#871)', async () => {
  const { useProjectStore } = await import('../src/renderer/store/projectStore')
  const history = await import('../src/renderer/store/projectHistory')
  it('ueberlebt das Laden und ist kein Undo-Schritt', () => {
    const b = { server: 'https://x', projectId: 'p1', rev: 4, syncedAt: '2026-09-27T00:00:00Z' }
    useProjectStore.getState().applyCloudProject({ ...plan([eq('A', 'Kamera')]), cloud: b })
    expect(useProjectStore.getState().project.cloud).toEqual(b)
    const undoBefore = history.projectHistory.canUndo()
    useProjectStore.getState().setCloudBinding({ ...b, rev: 5 })
    expect(useProjectStore.getState().project.cloud?.rev).toBe(5)
    expect(history.projectHistory.canUndo()).toBe(undoBefore)
  })
})
