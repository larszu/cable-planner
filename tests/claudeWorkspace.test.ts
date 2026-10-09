import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  completeWithAI,
  setApiKey,
  setClaudeWorkspaceId,
  setSelectedAiProvider,
} from '../src/renderer/lib/aiSuggestions'

/**
 * Claude-Schluessel ohne Workspace brauchen den Header anthropic-workspace-id.
 * Gemeldet 2026-10-09 als 400 „This API key is not scoped to a workspace".
 */
const antwort = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('Claude-Workspace-ID', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setClaudeWorkspaceId('')
    setApiKey('claude', '')
  })

  const fetchMit = (res: Response) => {
    const f = vi.fn(async () => res)
    vi.stubGlobal('fetch', f)
    return f
  }
  const header = (f: ReturnType<typeof vi.fn>) =>
    (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>

  it('schickt den Header, wenn eine ID eingetragen ist', async () => {
    setSelectedAiProvider('claude')
    setApiKey('claude', 'sk-ant-test')
    setClaudeWorkspaceId('wrkspc_123')
    const f = fetchMit(antwort(200, { content: [{ type: 'text', text: 'ok' }] }))
    expect(await completeWithAI('hi')).toBe('ok')
    expect(header(f)['anthropic-workspace-id']).toBe('wrkspc_123')
  })

  it('laesst ihn weg, wenn das Feld leer ist', async () => {
    setSelectedAiProvider('claude')
    setApiKey('claude', 'sk-ant-test')
    const f = fetchMit(antwort(200, { content: [{ type: 'text', text: 'ok' }] }))
    await completeWithAI('hi')
    expect(header(f)).not.toHaveProperty('anthropic-workspace-id')
  })

  it('sagt bei der 400 der API, wo die ID hingehoert', async () => {
    setSelectedAiProvider('claude')
    setApiKey('claude', 'sk-ant-test')
    fetchMit(
      antwort(400, {
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message:
            'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header',
        },
      }),
    )
    await expect(completeWithAI('hi')).rejects.toThrow(/wrkspc_/)
  })
})
