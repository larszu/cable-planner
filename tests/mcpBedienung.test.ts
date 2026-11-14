// #1183 — Bedienung ueber MCP (Stream Deck/Companion).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { UI_BEFEHLE, uiBefehl } from '../src/renderer/lib/mcpBedienung'

describe('ui_command', () => {
  it('status aendert nichts und liefert die Plan-Check-Zahlen', () => {
    const r = uiBefehl({ action: 'status' })
    expect(r.daten).toMatchObject({ ok: true, action: 'status', errors: 0, warnings: 0 })
  })

  it('unbekannte Befehle werden benannt abgelehnt', () => {
    expect(uiBefehl({ action: 'loeschen' }).daten).toMatchObject({ ok: false })
  })

  it('der Server bietet genau diese Befehle an, nur mit Schreib-Erlaubnis', () => {
    const src = readFileSync(resolve(__dirname, '..', 'src/main/mcp/mcpServer.ts'), 'utf8')
    const block = src.slice(src.indexOf('if (state.schreibenErlaubt)'))
    expect(block).toContain("'ui_command'")
    for (const b of UI_BEFEHLE) expect(block).toContain(`'${b}'`)
  })
})
