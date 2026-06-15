import { describe, expect, it } from 'vitest'
import { diffByName, joinSyncPath, unionByName } from '../src/renderer/lib/sharedLibraryMerge'

// #434 — Reine Merge-Logik der Workgroup-/Shared-Library (explizit ohne
// Browser-/Store-Abhängigkeiten gebaut, damit unit-testbar).

describe('joinSyncPath', () => {
  it('verbindet POSIX-Pfade mit /', () => {
    expect(joinSyncPath('/home/user/sync', 'lib.json')).toBe('/home/user/sync/lib.json')
    expect(joinSyncPath('/home/user/sync/', 'lib.json')).toBe('/home/user/sync/lib.json')
  })

  it('verbindet reine Windows-Pfade mit \\', () => {
    expect(joinSyncPath('C:\\Users\\x\\sync', 'lib.json')).toBe('C:\\Users\\x\\sync\\lib.json')
    expect(joinSyncPath('C:\\Users\\x\\sync\\', 'lib.json')).toBe('C:\\Users\\x\\sync\\lib.json')
  })
})

type Named = { name: string; v?: number }

describe('diffByName', () => {
  it('listet fehlende Items zum Hinzufügen', () => {
    const local: Named[] = [{ name: 'A' }]
    const shared: Named[] = [{ name: 'A' }, { name: 'B' }]
    const { add, conflicts } = diffByName(local, shared)
    expect(add.map((x) => x.name)).toEqual(['B'])
    expect(conflicts).toEqual([])
  })

  it('erkennt Namensgleiche mit abweichendem Inhalt als Konflikt', () => {
    const local: Named[] = [{ name: 'A', v: 1 }]
    const shared: Named[] = [{ name: 'A', v: 2 }]
    const { add, conflicts } = diffByName(local, shared)
    expect(add).toEqual([])
    expect(conflicts).toEqual(['A'])
  })

  it('ignoriert identische Items (kein add, kein Konflikt)', () => {
    const local: Named[] = [{ name: 'A', v: 1 }]
    const shared: Named[] = [{ name: 'A', v: 1 }]
    const { add, conflicts } = diffByName(local, shared)
    expect(add).toEqual([])
    expect(conflicts).toEqual([])
  })
})

describe('unionByName', () => {
  it('vereinigt nach Name; bei Gleichheit gewinnt local', () => {
    const local: Named[] = [{ name: 'A', v: 1 }]
    const shared: Named[] = [{ name: 'A', v: 99 }, { name: 'B', v: 2 }]
    const result = unionByName(local, shared)
    const byName = new Map(result.map((x) => [x.name, x.v]))
    expect(byName.get('A')).toBe(1) // local gewinnt
    expect(byName.get('B')).toBe(2) // shared-only übernommen
    expect(result).toHaveLength(2)
  })
})
