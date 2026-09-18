import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// #872 — die Zusagen des lokalen MCP-Servers, gegen den Code gehalten.
//
// Dieselbe Bauform wie `mobileShareWriteBack.test.ts`, und aus demselben
// Grund (ADR-005, Regel 4): eine Zusage muss pruefbar sein. Der Nutzer liest
// „laeuft nur auf 127.0.0.1, liest nur" genau dann, wenn er entscheidet, ob
// er den Schalter umlegt — die falsche Zusage waere die falsche Grundlage
// fuer eine Sicherheits-Entscheidung.
// ---------------------------------------------------------------------------

const lies = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')
const SERVER = lies('src/main/mcp/mcpServer.ts')
const IPC = lies('src/main/ipc/mcpIpc.ts')
const TAB = lies('src/renderer/components/Settings/tabs/McpTab.tsx')

const ohneKommentare = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('#872 — der Server bindet an das Loopback und nirgends sonst', () => {
  const code = ohneKommentare(SERVER)

  it('hoert auf 127.0.0.1', () => {
    expect(code).toContain("server.listen(0, '127.0.0.1'")
  })

  it('und NICHT auf 0.0.0.0 oder einer LAN-Adresse', () => {
    // Der Unterschied ist, ob die Halle mitlesen kann.
    expect(code).not.toContain('0.0.0.0')
  })

  it('schuetzt gegen DNS-Rebinding', () => {
    expect(code).toContain('enableDnsRebindingProtection: true')
    expect(code).toContain('allowedHosts')
  })
})

describe('#872 — ohne Paarungs-Token keine Auskunft', () => {
  const code = ohneKommentare(SERVER)

  it('prueft das Token als ERSTES im Handler', () => {
    // Vor allem anderen: eine Antwort, die ohne Token schon verraet, welche
    // Werkzeuge es gibt, ist selbst eine Auskunft.
    const handler = code.slice(code.indexOf('createServer((req, res)'))
    const gate = handler.indexOf('if (!authed(req)) return unauthorized(res)')
    const transport = handler.indexOf('new StreamableHTTPServerTransport')
    expect(gate).toBeGreaterThan(-1)
    expect(transport).toBeGreaterThan(gate)
  })

  it('das Token liegt im Schluesselbund und nicht in den Einstellungen', () => {
    expect(code).toContain('mcpTokenService')
    expect(ohneKommentare(lies('src/main/services/credentialsService.ts'))).toContain(
      "keytar.setPassword(SERVICE_NAME, MCP_ACCOUNT_NAME",
    )
  })

  it('und es steht NICHT im Status', () => {
    // Der Status wird alle paar Sekunden abgefragt und landet in jedem
    // Zustand, der ihn anfasst.
    const status = code.slice(code.indexOf('export const getMcpStatus'))
    expect(status.slice(0, 400)).not.toContain('token')
  })
})

describe('#872 — er liest keine Dateien, er fragt den Plan', () => {
  it('der Server kennt weder `fs` noch `.cableplan`', () => {
    // Die Architektur-Vorgabe aus #872: eine Datei auf der Platte ist der
    // Stand des letzten Speicherns, der Bildschirm der Stand von jetzt.
    const code = ohneKommentare(SERVER)
    expect(code).not.toMatch(/node:fs|readFile|cableplan/)
  })

  it('die Frage geht per IPC in den Renderer', () => {
    expect(ohneKommentare(IPC)).toContain("webContents.send('mcp:frage'")
    expect(ohneKommentare(IPC)).toContain("ipcMain.on('mcp:antwort'")
  })

  it('und laeuft in eine Frist statt ewig zu warten', () => {
    const code = ohneKommentare(IPC)
    expect(code).toContain('ANTWORT_FRIST_MS')
    expect(code).toContain('did not answer in time')
  })
})

describe('#872 — aus als Vorgabe', () => {
  it('der Server startet nicht von selbst', () => {
    // `registerMcpIpc` haengt nur die Handler ein. Wer `startMcpServer`
    // dort aufriefe, machte aus einer Entscheidung eine Voreinstellung.
    const index = ohneKommentare(lies('src/main/index.ts'))
    expect(index).toContain('registerMcpIpc()')
    expect(index).not.toContain('startMcpServer(')
    expect(ohneKommentare(lies('src/main/ipc/mcpIpc.ts'))).not.toMatch(
      /^\s*void startMcpServer\(\)/m,
    )
  })

  it('die Einstellungen sagen, dass nur gelesen wird', () => {
    expect(TAB).toContain('mcp.hint')
    expect(TAB).toContain('It only READS')
  })
})

// ---------------------------------------------------------------------------
// #873 Stufe 2 — der zweite Schalter.
// ---------------------------------------------------------------------------
describe('#873 — Schreiben ist eine EIGENE Entscheidung', () => {
  const code = ohneKommentare(SERVER)

  it('der Server beginnt ohne Schreib-Erlaubnis', () => {
    expect(code).toContain('schreibenErlaubt: false,')
  })

  it('die schreibenden Werkzeuge existieren nur, wenn sie erlaubt sind', () => {
    // Ein Werkzeug, das immer „nicht erlaubt" antwortet, ist dieselbe Sorte
    // Luege wie ein Knopf, der jedes Mal 403 bekommt (ADR-005).
    const block = code.slice(code.indexOf('if (state.schreibenErlaubt)'))
    for (const w of ['connect_ports', 'disconnect_cable', 'set_cable', 'rename_device']) {
      expect(block).toContain(`'${w}'`)
    }
  })

  it('das Entfernen traegt `destructiveHint`', () => {
    const block = code.slice(code.indexOf("'disconnect_cable'"))
    expect(block.slice(0, 500)).toContain('destructiveHint: true')
  })

  it('kein Schaltbefehl steht im Werkzeugsatz', () => {
    expect(code).not.toMatch(/videohub|atem|crosspoint/i)
  })
})

describe('#873 — ein Aufruf, ein Undo-Schritt', () => {
  const slice = ohneKommentare(
    readFileSync(resolve(__dirname, '..', 'src/renderer/store/slices/mcpSlice.ts'), 'utf8'),
  )
  const app = ohneKommentare(readFileSync(resolve(__dirname, '..', 'src/renderer/App.tsx'), 'utf8'))

  it('klammert die Aenderung UND die Nachweiszeile', () => {
    // Ohne die Klammer waeren es zwei Eintraege, und das erste Strg-Z naehme
    // nur den Nachweis zurueck. Die Klammer steht beim AUFRUFER — ein Slice,
    // der `projectHistory` importiert, schliesst einen Ring ueber den Store.
    // Die AUFRUFSTELLE, nicht die Import-Zeile: gemessen wird ab der Stelle,
    // an der die Liste der Schreibwerkzeuge BENUTZT wird.
    const stelle = app.slice(app.indexOf('MCP_SCHREIBWERKZEUGE as readonly string[]'))
    expect(stelle.slice(0, 600)).toContain('projectHistory.transact(')
    expect(slice).toContain('mitEintrag(')
    expect(slice).not.toContain("from '../projectHistory'")
  })

  it('haengt nicht an der 200-ms-Koaleszenz', () => {
    // Eine Uhr ist keine Zusage.
    expect(slice).not.toMatch(/setTimeout|Date\.now\(\) -/)
  })

  it('laesst einen gesperrten Plan gesperrt', () => {
    expect(slice).toContain('isProjectLocked(')
  })
})
