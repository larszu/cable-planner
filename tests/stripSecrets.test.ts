import { describe, expect, it } from 'vitest'
import { SECRET_KEYS, stripSecrets } from '../src/main/util/stripSecrets'
import projectIpcSrc from '../src/main/ipc/projectIpc.ts?raw'
import mobileShareSrc from '../src/main/services/mobileShareServer.ts?raw'
import equipmentTypesSrc from '../src/renderer/types/equipment.ts?raw'

// Zugangsdaten von Geraeten stehen in der Projektdatei. Sie duerfen mit,
// solange die Datei beim Eigentuemer bleibt — und nicht, sobald sie an
// jemand anderen geht. Diese Datei haelt beide Haelften fest.
//
// Der Befund, aus dem sie entstanden ist: die Regel existierte, aber nur an
// EINEM der Ausgaenge. Der Viewer-Export schrieb `username`/`password` jedes
// Geraets in eine Datei, die ausdruecklich fuer externe Reviewer gedacht ist.

describe('stripSecrets', () => {
  it('entfernt Zugangsdaten rekursiv, auch in Listen', () => {
    const project = {
      metadata: { name: 'Halle' },
      equipment: [
        { id: 'A', name: 'Switch', ipAddress: '10.0.0.2', username: 'admin', password: 'geheim' },
        { id: 'B', name: 'Kamera' },
      ],
    }
    expect(stripSecrets(project)).toEqual({
      metadata: { name: 'Halle' },
      equipment: [
        { id: 'A', name: 'Switch', ipAddress: '10.0.0.2' },
        { id: 'B', name: 'Kamera' },
      ],
    })
  })

  it('laesst alles andere unangetastet, inklusive Datentypen', () => {
    const value = { n: 1, b: false, s: '', nil: null, list: [1, 2], nested: { deep: [{ x: 1 }] } }
    expect(stripSecrets(value)).toEqual(value)
  })

  it('deckt beide Felder ab, die EquipmentItem als Zugangsdaten fuehrt', () => {
    // Kommt ein drittes dazu, faellt zuerst der Klassifizierungs-Guard in
    // planDiff.test.ts — und wer es dort als `sensitive` einordnet, aber hier
    // vergisst, faellt an dieser Zeile.
    expect(SECRET_KEYS.has('username')).toBe(true)
    expect(SECRET_KEYS.has('password')).toBe(true)
    expect(equipmentTypesSrc).toContain('username?: string')
    expect(equipmentTypesSrc).toContain('password?: string')
  })
})

describe('die Ausgaenge, die das Haus verlassen', () => {
  it('streicht der Viewer-Export die Zugangsdaten', () => {
    // Quell-Zusicherung statt Verhaltenstest: der Handler haengt an
    // electron `dialog` und ist headless nicht aufrufbar. Geprueft wird
    // deshalb, dass der geschriebene Wert durch `stripSecrets` geht.
    const handler = projectIpcSrc.slice(
      projectIpcSrc.indexOf("ipcMain.handle('project:export-viewer'"),
    )
    const body = handler.slice(0, handler.indexOf('ipcMain.handle', 1))
    expect(body).toContain('stripSecrets(')
    expect(body).toContain('atomicWriteFile(target')
  })

  it('streicht die Mobile-Ansicht die Zugangsdaten', () => {
    expect(mobileShareSrc).toContain('stripSecrets(project)')
  })

  it('haelt die Regel an genau einer Stelle', () => {
    // Zwei Kopien waren der Grund, warum ein Ausgang sie hatte und der
    // andere nicht. Beide Dateien importieren sie jetzt, statt sie zu
    // definieren.
    for (const src of [projectIpcSrc, mobileShareSrc]) {
      expect(src).toContain("from '../util/stripSecrets.js'")
      expect(src).not.toContain('const stripSecrets =')
      expect(src).not.toContain('const SECRET_KEYS =')
    }
  })
})
