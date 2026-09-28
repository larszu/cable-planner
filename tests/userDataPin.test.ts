import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setPath = vi.fn()
const electron = { app: { isPackaged: true, setPath, getPath: (n: string) => `/appdata-for-${n}` } }
vi.mock('electron', () => ({ default: electron, ...electron }))

describe('userData bleibt nach der Umbenennung im alten Ordner', () => {
  beforeEach(() => {
    setPath.mockClear()
    vi.resetModules()
  })

  it('nagelt die gepackte App auf den Ordner des alten productName', async () => {
    electron.app.isPackaged = true
    await import('../src/main/userDataPin')
    expect(setPath).toHaveBeenCalledWith('userData', path.join('/appdata-for-appData', 'Cable Planner'))
  })

  it('laesst den Dev-Lauf beim npm-Namen', async () => {
    electron.app.isPackaged = false
    await import('../src/main/userDataPin')
    expect(setPath).not.toHaveBeenCalled()
  })

  it('ist der erste Import des Main-Prozesses', () => {
    const src = readFileSync(path.join(__dirname, '../src/main/index.ts'), 'utf8')
    expect(src.split('\n').find((l) => l.startsWith('import '))).toBe("import './userDataPin.js'")
  })
})
