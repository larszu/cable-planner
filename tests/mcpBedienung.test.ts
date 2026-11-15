// #1183 — Bedienung ueber MCP (Stream Deck/Companion).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { UI_BEFEHLE, uiBefehl } from '../src/renderer/lib/mcpBedienung'
import { useProjectStore } from '../src/renderer/store/projectStore'
import { useUiStore } from '../src/renderer/store/uiStore'

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

  it('#1195 cue_next/cue_prev gehen durch den Ablauf und zeigen dessen Wege', () => {
    useProjectStore.getState().setRundown({
      source: 'test',
      segments: [{ id: 's1', number: '1', title: 'Opener' }, { id: 's2', number: '2', title: 'Band' }],
      coverage: [],
      links: [{ segmentId: 's2', equipmentIds: ['e9'], cableIds: [] }],
    })
    expect(uiBefehl({ action: 'cue_next' }).daten).toMatchObject({ cue: '1 Opener', cueIndex: 1, cueCount: 2 })
    expect(uiBefehl({ action: 'cue_next' }).daten).toMatchObject({ cue: '2 Band', cueIndex: 2 })
    expect(useUiStore.getState().signalweg?.geraetIds).toEqual(['e9'])
    // am Ende bleibt der Zeiger stehen
    expect(uiBefehl({ action: 'cue_next' }).daten).toMatchObject({ cueIndex: 2 })
    expect(uiBefehl({ action: 'cue_prev' }).daten).toMatchObject({ cue: '1 Opener' })
  })
})
