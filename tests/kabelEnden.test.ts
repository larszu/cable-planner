import { describe, expect, it } from 'vitest'
import { bomSchluessel, bomTyp, kabelEnden } from '../src/renderer/lib/kabelEnden'
import { buildCableBomRows, cableBomTable } from '../src/renderer/lib/installerLists'
import type { Cable } from '../src/renderer/types/cable'
import type { CablePlannerProject } from '../src/renderer/types/project'

// #1222 — Kabel mit verschiedenen Steckern je Ende.
const kabel = (id: string, over: Partial<Cable> = {}): Cable => ({
  id, name: id, type: 'Ethernet/RJ45', length: 5, color: '#fff',
  fromEquipmentId: 'a', fromPortId: 'p', toEquipmentId: 'b', toPortId: 'q', notes: '', ...over,
})

describe('#1222 — Stecker je Kabelende', () => {
  it('ohne Eintrag bleibt der alte Schluessel (Rentman-Planmengen gelten weiter)', () => {
    expect(kabelEnden(kabel('k'))).toBeUndefined()
    expect(bomSchluessel(kabel('k'))).toBe('Ethernet/RJ45|5')
  })

  it('RJ45 <-> M8 und LC <-> SC stehen im Typ', () => {
    expect(bomTyp(kabel('k', { terminationFrom: 'RJ45', terminationTo: 'M8' }))).toBe('Ethernet/RJ45 (RJ45 ↔ M8)')
    expect(bomTyp(kabel('k', { type: 'Fiber', terminationFrom: 'LC', terminationTo: 'SC' }))).toBe('Fiber (LC ↔ SC)')
  })

  it('ein leeres Ende traegt den Kabeltyp, ein | im Freitext bricht den Schluessel nicht', () => {
    expect(kabelEnden(kabel('k', { terminationTo: 'M8' }))).toBe('Ethernet/RJ45 ↔ M8')
    expect(bomSchluessel(kabel('k', { terminationFrom: 'A|B' })).split('|')).toHaveLength(2)
  })

  it('die Stueckliste fuehrt gemischte Kabel als eigene Zeile', () => {
    const project = {
      cables: [kabel('1'), kabel('2'), kabel('3', { terminationFrom: 'RJ45', terminationTo: 'M8' })],
      equipment: [],
    } as unknown as CablePlannerProject
    const rows = buildCableBomRows(project, 0)
    expect(rows.map((r) => [r.ends ?? '', r.qty])).toEqual([['', 2], ['RJ45 ↔ M8', 1]])
    expect(cableBomTable(project, 0).rows.map((r) => r[0])).toEqual(['Ethernet/RJ45', 'Ethernet/RJ45 (RJ45 ↔ M8)'])
  })
})
