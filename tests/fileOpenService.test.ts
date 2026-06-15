import { beforeEach, describe, expect, it } from 'vitest'
import {
  findProjectPathInArgv,
  isProjectFile,
  setPendingLaunchPath,
  takePendingLaunchPath,
} from '../src/main/services/fileOpenService'

// #pre-sale — OS-Dateiverknüpfung (PR #547). Reine argv-/Puffer-Helfer, die
// das Doppelklick-Öffnen tragen. Bewusst ohne Electron, daher headless testbar.

describe('isProjectFile', () => {
  it('akzeptiert die drei Projekt-Endungen, case-insensitiv', () => {
    expect(isProjectFile('/x/A.cableplan')).toBe(true)
    expect(isProjectFile('/x/A.CABLEPLAN')).toBe(true)
    expect(isProjectFile('/x/old.json')).toBe(true)
    expect(isProjectFile('/x/v.cpviewer')).toBe(true)
  })

  it('lehnt fremde Endungen ab', () => {
    expect(isProjectFile('/x/notes.txt')).toBe(false)
    expect(isProjectFile('/x/image.png')).toBe(false)
    expect(isProjectFile('/x/no-ext')).toBe(false)
  })
})

describe('findProjectPathInArgv', () => {
  it('findet die Projektdatei nach der Executable (Windows-Kaltstart-argv)', () => {
    expect(findProjectPathInArgv(['C:/app.exe', 'C:/Users/x/My Plan.cableplan'])).toBe(
      'C:/Users/x/My Plan.cableplan',
    )
    expect(findProjectPathInArgv(['/app', '/tmp/old.json'])).toBe('/tmp/old.json')
    expect(findProjectPathInArgv(['/app', '/tmp/v.cpviewer'])).toBe('/tmp/v.cpviewer')
  })

  it('überspringt argv[0] (Executable) und Flags', () => {
    expect(findProjectPathInArgv(['/x/app.cableplan'])).toBeNull() // nur Executable
    expect(findProjectPathInArgv(['/app', '--inspect', '--foo=bar.json'])).toBeNull()
  })

  it('liefert null wenn keine Projektdatei dabei ist', () => {
    expect(findProjectPathInArgv(['/app'])).toBeNull()
    expect(findProjectPathInArgv(['/app', '/tmp/notes.txt'])).toBeNull()
  })

  it('nimmt die erste passende Datei bei mehreren Argumenten', () => {
    expect(findProjectPathInArgv(['/app', '/tmp/a.cableplan', '/tmp/b.json'])).toBe('/tmp/a.cableplan')
  })
})

describe('pending launch path buffer', () => {
  beforeEach(() => {
    // Puffer leeren, da das Modul zwischen Tests im selben File geteilt wird.
    takePendingLaunchPath()
  })

  it('puffert einen gültigen Pfad und gibt ihn genau einmal heraus', () => {
    setPendingLaunchPath('/p/one.cableplan')
    expect(takePendingLaunchPath()).toBe('/p/one.cableplan')
    expect(takePendingLaunchPath()).toBeNull() // take leert den Puffer
  })

  it('überschreibt einen gepufferten Pfad NICHT mit null/leer (macOS open-file vs argv)', () => {
    setPendingLaunchPath('/p/one.cableplan')
    setPendingLaunchPath(null)
    expect(takePendingLaunchPath()).toBe('/p/one.cableplan')
  })

  it('ignoriert Nicht-Projekt-Pfade', () => {
    setPendingLaunchPath('/x/bad.txt')
    expect(takePendingLaunchPath()).toBeNull()
  })
})
