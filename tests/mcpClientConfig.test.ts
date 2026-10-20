import { describe, expect, it } from 'vitest'
import { claudeMcpAddBefehl, mcpCurlBeispiel, mcpJsonKonfig } from '../src/renderer/lib/mcpClientConfig'
import { MCP_STANDARD_PORT, normalisiereMcpEinstellungen } from '../src/main/mcp/mcpEinstellungenForm'

const URL = 'http://127.0.0.1:4187/mcp'

describe('MCP client config (#1068)', () => {
  it('builds the claude mcp add command', () => {
    expect(claudeMcpAddBefehl(URL, 'abc')).toBe(
      'claude mcp add --transport http cable-planner http://127.0.0.1:4187/mcp --header "Authorization: Bearer abc"',
    )
  })
  it('builds a JSON block with url and bearer header', () => {
    const j = JSON.parse(mcpJsonKonfig(URL, 'abc'))
    expect(j.mcpServers['cable-planner']).toEqual({
      type: 'http',
      url: URL,
      headers: { Authorization: 'Bearer abc' },
    })
  })
  it('builds a curl tools/list call', () => {
    const c = mcpCurlBeispiel(URL, 'abc')
    expect(c).toContain('Bearer abc')
    expect(c).toContain('text/event-stream')
    expect(c).toContain('tools/list')
  })
})

describe('MCP settings (#1068)', () => {
  it('defaults to off, read-only, fixed port', () => {
    expect(normalisiereMcpEinstellungen(null)).toEqual({
      an: false,
      schreibenErlaubt: false,
      port: MCP_STANDARD_PORT,
    })
  })
  it('keeps valid values and rejects bad ones', () => {
    expect(normalisiereMcpEinstellungen({ an: true, schreibenErlaubt: true, port: 5000 })).toEqual({
      an: true,
      schreibenErlaubt: true,
      port: 5000,
    })
    expect(normalisiereMcpEinstellungen({ port: 80 }).port).toBe(MCP_STANDARD_PORT)
    expect(normalisiereMcpEinstellungen({ port: '5000', an: 'yes' })).toEqual({
      an: false,
      schreibenErlaubt: false,
      port: MCP_STANDARD_PORT,
    })
  })
})
