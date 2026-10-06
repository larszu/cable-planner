import { describe, expect, it } from 'vitest'
import { nameAfterSaveAs, nameFromPath } from '../src/renderer/lib/projectName'

describe('Save as adopts the chosen title (#986)', () => {
  it('strips folder and project extension', () => {
    expect(nameFromPath('/a/b/Show 2.cableplan')).toBe('Show 2')
    expect(nameFromPath('C:\\x\\Show.JSON')).toBe('Show')
  })

  it('renames on every Save as, not only for an untitled project', () => {
    expect(nameAfterSaveAs('Untitled Project', '/p/Show.cableplan')).toBe('Show')
    expect(nameAfterSaveAs('Show', '/p/Show v2.cableplan')).toBe('Show v2')
  })

  it('does nothing when the name is unchanged', () => {
    expect(nameAfterSaveAs('Show', '/p/Show.cableplan')).toBeNull()
  })
})
