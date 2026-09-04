import { describe, expect, it } from 'vitest'
import indexSrc from '../src/main/index.ts?raw'
import logIpcSrc from '../src/main/ipc/logIpc.ts?raw'
import printIpcSrc from '../src/main/ipc/printIpc.ts?raw'
import credIpcSrc from '../src/main/ipc/credentialsIpc.ts?raw'
import appSrc from '../src/renderer/App.tsx?raw'
import { stripComments } from './support/stripComments'

// Dreimal dasselbe Muster, dreimal derselbe Test: ein Schutz EXISTIERT, ist
// begruendet -- und ein Weg laesst ihn aus. Und zwar jedes Mal der Weg, fuer
// den der Schutz eigentlich gedacht war.
//
// Diese Datei haelt fest, dass die Wege jetzt vollstaendig sind.

const code = (s: string) => stripComments(s)

describe('Log-Kappung gilt fuer ALLE Schreiber derselben Datei', () => {
  it('logs:renderer-error schreibt gekappt', () => {
    const c = code(logIpcSrc)
    expect(c).toContain('appendLogCapped(')
    // Der Kanal, ueber den eine Absturzschleife meldet, darf nicht ungekappt
    // in dieselbe Datei schreiben, die index.ts gekappt fuellt.
    expect(c).not.toMatch(/appendFileSync\(/)
  })

  it('die Kappung liegt gemeinsam in util/, nicht lokal in index.ts', () => {
    const c = code(indexSrc)
    expect(c).toContain("from './util/appendLogCapped.js'")
    expect(c).not.toMatch(/const appendLogCapped\s*=/)
  })
})

describe('Der Druck-Zwischenspeicher wird aufgeraeumt', () => {
  it('print:pdf-bytes loescht seine Temp-Datei', () => {
    const c = code(printIpcSrc)
    const start = c.indexOf("ipcMain.handle('print:pdf-bytes'")
    expect(start).toBeGreaterThan(0)
    const body = c.slice(start)
    // Im einzigen Ausgang (settle) muss die Datei wieder verschwinden.
    expect(body).toMatch(/unlink\(tmpFile\)/)
  })
})

describe('Das Rentman-Token bleibt im Hauptprozess, wo es nicht gebraucht wird', () => {
  it('es gibt einen Ja/Nein-Kanal wie bei NetBox', () => {
    expect(code(credIpcSrc)).toContain("'credentials:has-token'")
  })

  it('der Start holt nur den Boolean, nicht den Klartext', () => {
    const c = code(appSrc)
    expect(c).toContain('credentials.hasToken()')
    expect(c).not.toContain('credentials.getToken()')
  })
})
