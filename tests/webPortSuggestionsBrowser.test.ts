import { afterEach, describe, expect, it, vi } from 'vitest'
import { suggestFromWeb } from '../src/renderer/lib/webPortSuggestions'

// #1070: ohne Desktop-Bruecke darf die Websuche nicht an CORS scheitern,
// sondern meldet sich als eingeschraenkt; DuckDuckGo wird gar nicht gefragt.
describe('suggestFromWeb im Browser', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('fragt DuckDuckGo nicht und meldet eingeschraenkt', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)
    const r = await suggestFromWeb('Blackmagic ATEM Mini', 'Switcher')
    expect(r).toMatchObject({ hints: [], limited: true })
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('duckduckgo'))).toBe(false)
  })
})
