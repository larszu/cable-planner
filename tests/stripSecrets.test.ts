import { describe, expect, it } from 'vitest'
import { OPAQUE_KEYS, SECRET_KEYS, stripSecrets } from '../src/main/util/stripSecrets'
import greengoTypesSrc from '../src/renderer/types/greengo.ts?raw'
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

  // Zweiter Befund, dieselbe Regel, andere Sorte Feld. `SECRET_KEYS` streicht
  // nach Namen — bei einem eingelesenen Hersteller-Dokument kennen wir die
  // Namen nicht. `GreenGoConfig.basePreset` haelt die Anlagen-Konfiguration
  // unveraendert, samt `ConfigPassword`, `AdminPassword`, `TechPincode` und
  // `Security.Pincode`. Keiner dieser Namen steht in `SECRET_KEYS`: die
  // Geraete-Zugangsdaten wurden gestrichen, die der Intercom-Anlage gingen mit.
  describe('fremde Roh-Dokumente', () => {
    const mitPreset = () => ({
      metadata: { name: 'Anlage' },
      greengoConfig: {
        systemName: 'Produktion',
        users: [{ id: 1, name: 'Regie', groupIds: [1] }],
        basePreset: {
          System: {
            ConfigPassword: 'a1b2c3d4-e5f6-0000-1111-222233334444',
            AdminPassword: '9988-7766-5544-3322',
            TechPincode: '4711',
          },
          Security: { Pincode: '0815' },
        },
      },
    })

    it('das Roh-Dokument verlaesst den Rechner nicht', () => {
      const out = stripSecrets(mitPreset()) as Record<string, Record<string, unknown>>
      expect(out.greengoConfig.basePreset).toBeUndefined()
    })

    it('kein einziges der Anlagen-Geheimnisse steht noch im Ergebnis', () => {
      // Die Probe auf das Ganze statt auf das Feld: der serialisierte Ausgang
      // darf keinen der vier Werte mehr enthalten, egal an welcher Stelle.
      const json = JSON.stringify(stripSecrets(mitPreset()))
      for (const geheim of ['a1b2c3d4', '9988-7766', '4711', '0815']) {
        expect(json, `${geheim} steht noch im Ausgang`).not.toContain(geheim)
      }
    })

    it('der Plan-Teil der Intercom-Konfiguration bleibt', () => {
      // Gestrichen wird das fremde Dokument, nicht die Planung. Sonst waere
      // die Mobile-Ansicht um Information aermer, die kein Geheimnis ist.
      const out = stripSecrets(mitPreset()) as Record<string, Record<string, unknown>>
      expect(out.greengoConfig.systemName).toBe('Produktion')
      expect(out.greengoConfig.users).toEqual([{ id: 1, name: 'Regie', groupIds: [1] }])
    })

    it('der Typ sagt selbst, dass dort Passwoerter liegen', () => {
      // Der Grund steht nicht nur in diesem Test: `GreenGoConfig.basePreset`
      // kuendigt es im eigenen Kommentar an. Faellt der Hinweis weg, faellt
      // dieser Test — dann ist zu pruefen, ob das Feld noch opak sein muss.
      expect(greengoTypesSrc).toContain('basePreset')
      expect(greengoTypesSrc).toMatch(/PASSWOERTER|Passw/)
      expect(OPAQUE_KEYS.has('basePreset')).toBe(true)
    })
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
