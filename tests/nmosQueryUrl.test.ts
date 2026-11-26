import { describe, expect, it } from 'vitest'
import { nextPageUrl, normalizeQueryApiUrl } from '../src/main/util/nmosQueryUrl'

// #1240 Stufe 6 — die Adresspruefung fuer `nmos:fetch-registry` liegt in main.
describe('normalizeQueryApiUrl', () => {
  it('macht aus Server oder API-Adresse die API-Basis', () => {
    expect(normalizeQueryApiUrl('http://registry:8235')).toBe('http://registry:8235/x-nmos/query/v1.3')
    expect(normalizeQueryApiUrl(' https://r.example/x-nmos/query/v1.2/ ')).toBe('https://r.example/x-nmos/query/v1.2')
    expect(normalizeQueryApiUrl('http://10.0.0.5/nmos')).toBe('http://10.0.0.5/nmos/x-nmos/query/v1.3')
  })

  it('lehnt alles andere ab', () => {
    for (const bad of ['', 'registry:8235', 'file:///etc/passwd', 'ftp://r/x', 'http://u:p@r/', 'http://r/?a=1', 'http://r/#x', 'http://r/x-nmos/query/v2.0', 'http://r/x-nmos/registration/v1.3'])
      expect(() => normalizeQueryApiUrl(bad), bad).toThrow()
  })
})

describe('nextPageUrl', () => {
  const base = 'http://r:8235/x-nmos/query/v1.3'
  it('folgt rel="next" nur auf demselben Ursprung', () => {
    expect(nextPageUrl('<http://r:8235/x-nmos/query/v1.3/nodes?paging.since=1>; rel="next", <x>; rel="prev"', base)).toBe(
      'http://r:8235/x-nmos/query/v1.3/nodes?paging.since=1',
    )
    expect(nextPageUrl('<http://evil/x>; rel="next"', base)).toBeNull()
    expect(nextPageUrl(null, base)).toBeNull()
  })
})
