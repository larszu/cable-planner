import { describe, expect, it } from 'vitest'
import syncSrc from '../src/main/ipc/syncIpc.ts?raw'
import projectSrc from '../src/main/ipc/projectIpc.ts?raw'
import librarySrc from '../src/main/ipc/libraryIpc.ts?raw'
import panelSrc from '../src/renderer/components/Sync/SharedSyncPanel.tsx?raw'
import { stripComments } from './support/stripComments'

// CLAUDE.md, nicht verhandelbar: "Schreibvorgaenge fuer Userdaten IMMER atomic
// via src/main/util/atomicWrite.ts. Niemals direkt fs.writeFile."
//
// `sync:write-file` hat sich daran nicht gehalten -- und ausgerechnet dieser
// Weg schreibt das GANZE Projekt auf ein NETZLAUFWERK, also dorthin, wo ein
// abgebrochener Schreibvorgang am wahrscheinlichsten ist. `project:save` und
// `library:write` hatten den Schutz seit jeher; syncIpc importierte
// `atomicWrite` nicht einmal.
//
// Nicht mitgezaehlt wird bewusst app-lokaler Zustand (Fenster-Geometrie,
// Zuletzt-geoeffnet): beide Leser sind vollstaendig defensiv und fallen auf
// Defaults zurueck, ein zerrissener Schreibvorgang heilt sich dort selbst.

const code = (src: string) => stripComments(src)

describe('Atomic-Write-Invariante auf den Userdaten-Pfaden', () => {
  it('sync:write-file schreibt atomar', () => {
    const c = code(syncSrc)
    expect(c).toContain('atomicWriteFile(safe')
  })

  it('kein blankes writeFile mehr im sync-Schreibpfad', () => {
    // Der Handler-Rumpf von `sync:write-file`, isoliert betrachtet.
    const c = code(syncSrc)
    const start = c.indexOf("ipcMain.handle('sync:write-file'")
    expect(start).toBeGreaterThan(0)
    const body = c.slice(start, c.indexOf('ipcMain.handle', start + 1))
    expect(body).not.toMatch(/\bawait writeFile\(/)
  })

  it('die drei Userdaten-Schreibwege benutzen denselben Helfer', () => {
    // Faellt einer davon zurueck auf blankes writeFile, faellt dieser Test --
    // und nennt den Weg, der aus der Reihe getanzt ist.
    for (const [name, src] of [
      ['syncIpc', syncSrc],
      ['projectIpc', projectSrc],
      ['libraryIpc', librarySrc],
    ] as const) {
      expect(code(src), `${name} importiert atomicWrite nicht`).toContain('atomicWrite')
    }
  })

  it('der Sync-Panel schickt wirklich das ganze Projekt (sonst waere die Regel egal)', () => {
    // Belegt, warum dieser Pfad unter die Invariante faellt. Aendert sich das,
    // gehoert die Einordnung oben neu geprueft -- nicht dieser Test gestrichen.
    expect(code(panelSrc)).toMatch(/sync\.writeFile\([\s\S]{0,120}JSON\.stringify\(project/)
  })
})
