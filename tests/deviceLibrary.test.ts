// ───────────────────────────────────────────────────────────────────────────
// Geraetebibliothek (devices.zumpelars.de) — Abgleich, Cache, Einreichen.
//
// Der Client selbst ist im Bibliotheks-Repo gegen den echten Server getestet.
// Hier geht es um das, was dieser Planner daraus macht: welcher Server ohne
// Einstellung gilt, wie eine Sync-Antwort in den lokalen Stand kommt, dass
// `latestSeq` den Neustart ueberlebt, dass `removed` und ungueltige Eintraege
// wirklich verschwinden, und dass das Token nur an seinem Platz liegt.
// `fetch` ist gemockt.
// ───────────────────────────────────────────────────────────────────────────
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEFAULT_DEVICE_LIBRARY_URL, type SyncDevice, type SyncResponse } from '../src/renderer/lib/deviceLibraryClient'
import {
  effectiveServer,
  emptyCache,
  errorText,
  guessManufacturerModel,
  guidelinesUrl,
  loadCache,
  mergeSync,
  normalizeServerUrl,
  proposalFor,
  runSync,
  saveCache,
} from '../src/renderer/lib/deviceLibrary'
import { createWebDeviceLibraryApi } from '../src/renderer/lib/deviceLibraryWeb'
import { STORAGE_KEYS } from '../src/renderer/lib/storageKeys'
import type { EquipmentTemplate, Port } from '../src/renderer/types/equipment'
import type { DeviceLibraryApi } from '../src/renderer/types/deviceLibrary'

const SERVER = 'https://devices.example.org'

/** Map-Speicher statt `localStorage`: der globale ist je Node-Version mal da,
 *  mal nicht — die Logik soll nicht davon abhaengen. */
const speicher = () => {
  const m = new Map<string, string>()
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}

const port = (id: string, name: string): Port => ({ id, name, connectorType: 'BNC' }) as Port

const vorlage = (name: string, extra: Partial<EquipmentTemplate> = {}): EquipmentTemplate =>
  ({
    name,
    category: 'Converter',
    inputs: [port('i1', 'SDI In')],
    outputs: [port('o1', 'HDMI Out')],
    manufacturerUrl: 'https://example.com/datasheet',
    powerWatts: 5,
    ...extra,
  }) as EquipmentTemplate

const geraet = (slug: string, seq: number, facet: Record<string, unknown> | null, extra: Partial<SyncDevice> = {}): SyncDevice => ({
  slug,
  version: 1,
  seq,
  removed: false,
  status: 'confirmed',
  confirmations: 2,
  core: { manufacturer: 'Acme', model: slug, category: 'Converter' },
  facet,
  ...extra,
})

const antwort = (latestSeq: number, devices: SyncDevice[]): SyncResponse => ({
  format: 'avplan-device-sync',
  version: 1,
  planner: 'cable',
  latestSeq,
  devices,
})

describe('Standard-Server', () => {
  it('ist devices.zumpelars.de', () => {
    expect(DEFAULT_DEVICE_LIBRARY_URL).toBe('https://devices.zumpelars.de')
  })

  it('gilt ohne jede Einstellung', () => {
    expect(effectiveServer('')).toBe(DEFAULT_DEVICE_LIBRARY_URL)
    expect(effectiveServer('   ')).toBe(DEFAULT_DEVICE_LIBRARY_URL)
    expect(effectiveServer(undefined)).toBe(DEFAULT_DEVICE_LIBRARY_URL)
  })

  it('gilt auch, wenn die Einstellung keine http(s)-URL ist', () => {
    expect(effectiveServer('file:///etc/passwd')).toBe(DEFAULT_DEVICE_LIBRARY_URL)
    expect(effectiveServer('kein link')).toBe(DEFAULT_DEVICE_LIBRARY_URL)
  })

  it('nimmt eine eigene URL ohne abschliessenden Schraegstrich', () => {
    expect(effectiveServer('https://lib.firma.de/')).toBe('https://lib.firma.de')
    expect(normalizeServerUrl('http://10.0.0.5:8080/geraete/')).toBe('http://10.0.0.5:8080/geraete')
    expect(normalizeServerUrl('javascript:alert(1)')).toBeNull()
  })

  it('steht in den Einstellungen als leerer String, nicht als ausgeschriebene Vorgabe', () => {
    // Leer heisst „Werksserver" — auch dann noch, wenn dessen Adresse wechselt.
    const quelle = readFileSync('src/renderer/store/settingsStore.ts', 'utf8')
    expect(quelle).toMatch(/deviceLibraryUrl: '',/)
  })
})

describe('mergeSync', () => {
  it('legt neue Geraete an und traegt Status und Bestaetigungen mit', () => {
    const { cache, stats } = mergeSync(emptyCache(SERVER), antwort(3, [
      geraet('a', 1, vorlage('Acme A') as unknown as Record<string, unknown>, { status: 'verified', confirmations: 5 }),
      geraet('b', 3, vorlage('Acme B') as unknown as Record<string, unknown>),
    ]))
    expect(stats).toMatchObject({ added: 2, updated: 0, removed: 0, invalid: 0 })
    expect(cache.latestSeq).toBe(3)
    const a = cache.entries.find((e) => e.slug === 'a')!
    expect(a).toMatchObject({ status: 'verified', confirmations: 5, manufacturer: 'Acme', model: 'a' })
    expect(a.template.name).toBe('Acme A')
  })

  it('erfindet keine Namen in verifiedBy', () => {
    const { cache } = mergeSync(emptyCache(SERVER), antwort(1, [geraet('a', 1, vorlage('Acme A') as unknown as Record<string, unknown>)]))
    expect(cache.entries[0].template.verifiedBy).toBeUndefined()
  })

  it('ersetzt eine aeltere Fassung desselben Geraets', () => {
    const erst = mergeSync(emptyCache(SERVER), antwort(1, [geraet('a', 1, vorlage('Acme A') as unknown as Record<string, unknown>)])).cache
    const { cache, stats } = mergeSync(erst, antwort(4, [
      geraet('a', 4, vorlage('Acme A', { powerWatts: 9 }) as unknown as Record<string, unknown>, { version: 2 }),
    ]))
    expect(stats).toMatchObject({ added: 0, updated: 1 })
    expect(cache.entries).toHaveLength(1)
    expect(cache.entries[0]).toMatchObject({ version: 2, seq: 4 })
    expect(cache.entries[0].template.powerWatts).toBe(9)
  })

  it('entfernt lokal, was der Server als removed meldet', () => {
    const erst = mergeSync(emptyCache(SERVER), antwort(2, [
      geraet('a', 1, vorlage('Acme A') as unknown as Record<string, unknown>),
      geraet('b', 2, vorlage('Acme B') as unknown as Record<string, unknown>),
    ])).cache
    const { cache, stats } = mergeSync(erst, antwort(5, [geraet('a', 5, null, { removed: true })]))
    expect(stats.removed).toBe(1)
    expect(cache.entries.map((e) => e.slug)).toEqual(['b'])
  })

  it('zaehlt ein removed fuer ein unbekanntes Geraet nicht als entfernt', () => {
    const { stats } = mergeSync(emptyCache(SERVER), antwort(5, [geraet('x', 5, null, { removed: true })]))
    expect(stats.removed).toBe(0)
  })

  it('ueberspringt Eintraege, die die Vorlagenpruefung nicht bestehen, und zaehlt sie', () => {
    const { cache, stats } = mergeSync(emptyCache(SERVER), antwort(3, [
      geraet('ok', 1, vorlage('Acme OK') as unknown as Record<string, unknown>),
      geraet('ohne-quelle', 2, vorlage('Acme Q', { manufacturerUrl: undefined }) as unknown as Record<string, unknown>),
      geraet('ohne-ports', 3, vorlage('Acme P', { inputs: [], outputs: [] }) as unknown as Record<string, unknown>),
    ]))
    expect(stats.invalid).toBe(2)
    expect(stats.invalidNames).toEqual(['Acme Q', 'Acme P'])
    expect(cache.entries.map((e) => e.slug)).toEqual(['ok'])
    // Uebersprungen heisst trotzdem gesehen: der Abgleich fragt nicht ewig neu.
    expect(cache.latestSeq).toBe(3)
  })

  it('laesst keine veraltete Fassung stehen, wenn die neue ungueltig ist', () => {
    const erst = mergeSync(emptyCache(SERVER), antwort(1, [geraet('a', 1, vorlage('Acme A') as unknown as Record<string, unknown>)])).cache
    const { cache, stats } = mergeSync(erst, antwort(2, [
      geraet('a', 2, vorlage('Acme A', { inputs: [], outputs: [] }) as unknown as Record<string, unknown>),
    ]))
    expect(stats.invalid).toBe(1)
    expect(cache.entries).toHaveLength(0)
  })

  it('verarbeitet in Sequenz-Reihenfolge, nicht in Antwort-Reihenfolge', () => {
    const { cache } = mergeSync(emptyCache(SERVER), antwort(7, [
      geraet('a', 7, null, { removed: true }),
      geraet('a', 3, vorlage('Acme A') as unknown as Record<string, unknown>),
    ]))
    expect(cache.entries).toHaveLength(0)
  })
})

describe('Cache und latestSeq', () => {
  it('ueberleben den Neustart', () => {
    const s = speicher()
    const { cache } = mergeSync(emptyCache(SERVER), antwort(12, [geraet('a', 12, vorlage('Acme A') as unknown as Record<string, unknown>)]))
    expect(saveCache(cache, s)).toBe(true)
    const wieder = loadCache(SERVER, s)
    expect(wieder.latestSeq).toBe(12)
    expect(wieder.entries.map((e) => e.slug)).toEqual(['a'])
  })

  it('beginnt bei 0, wenn der gespeicherte Stand einem anderen Server gehoert', () => {
    const s = speicher()
    saveCache({ ...emptyCache('https://anderer.example'), latestSeq: 40 }, s)
    expect(loadCache(SERVER, s)).toEqual(emptyCache(SERVER))
  })

  it('nimmt einen kaputten Eintrag als keinen', () => {
    const s = speicher()
    s.setItem(STORAGE_KEYS.deviceLibraryCache, '{kaputt')
    expect(loadCache(SERVER, s)).toEqual(emptyCache(SERVER))
  })

  it('meldet einen vollen Speicher, statt still zu verlieren', () => {
    const voll = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError') }, removeItem: () => {} }
    expect(saveCache(emptyCache(SERVER), voll)).toBe(false)
  })
})

describe('runSync', () => {
  const api = (antworten: SyncResponse[]) => {
    const aufrufe: number[] = []
    const sync: DeviceLibraryApi['sync'] = async (_server, after) => {
      aufrufe.push(after)
      return { ok: true, value: antworten.shift()! }
    }
    return { sync, aufrufe }
  }

  it('fragt ab dem gemerkten latestSeq und merkt sich den neuen', async () => {
    const s = speicher()
    const a = api([
      antwort(5, [geraet('a', 5, vorlage('Acme A') as unknown as Record<string, unknown>)]),
      antwort(8, [geraet('b', 8, vorlage('Acme B') as unknown as Record<string, unknown>)]),
    ])
    const eins = await runSync(a, SERVER, s)
    const zwei = await runSync(a, SERVER, s)
    expect(a.aufrufe).toEqual([0, 5])
    expect(eins.ok && zwei.ok).toBe(true)
    expect(loadCache(SERVER, s).latestSeq).toBe(8)
    expect(loadCache(SERVER, s).entries.map((e) => e.slug)).toEqual(['a', 'b'])
  })

  it('holt alles neu, wenn der Server weniger kennt als wir', async () => {
    const s = speicher()
    saveCache({ ...emptyCache(SERVER), latestSeq: 50, entries: [] }, s)
    const a = api([antwort(3, []), antwort(3, [geraet('a', 3, vorlage('Acme A') as unknown as Record<string, unknown>)])])
    const r = await runSync(a, SERVER, s)
    expect(a.aufrufe).toEqual([50, 0])
    expect(r.ok && r.stats.reset).toBe(true)
    expect(loadCache(SERVER, s).latestSeq).toBe(3)
  })

  it('laesst den Stand bei einem Fehler unberuehrt', async () => {
    const s = speicher()
    saveCache({ ...emptyCache(SERVER), latestSeq: 9 }, s)
    const r = await runSync({ sync: async () => ({ ok: false, code: 'offline' }) }, SERVER, s)
    expect(r).toEqual({ ok: false, code: 'offline' })
    expect(loadCache(SERVER, s).latestSeq).toBe(9)
  })
})

describe('Web-Build: Token in localStorage, Abruf per fetch', () => {
  afterEach(() => vi.unstubAllGlobals())

  const json = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
    new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { 'content-type': 'application/json', ...init.headers } })

  it('legt das Token nur unter seinem eigenen Schluessel ab und schickt es als Bearer', async () => {
    const s = speicher()
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/auth/sign-in/username')) {
        return json({ user: { id: 'u1', email: 'a@b.de', username: 'lars', emailVerified: true } }, { headers: { 'set-auth-token': 'geheim' } })
      }
      return json(antwort(4, [geraet('a', 4, vorlage('Acme A') as unknown as Record<string, unknown>)]))
    })
    vi.stubGlobal('fetch', fetchMock)
    const web = createWebDeviceLibraryApi(() => s)

    const r = await web.signIn(SERVER, 'lars', 'pw')
    expect(r).toEqual({ kind: 'ok', user: { id: 'u1', email: 'a@b.de', username: 'lars', emailVerified: true } })
    expect(JSON.stringify(r)).not.toContain('geheim')
    expect([...s.m.keys()]).toEqual([STORAGE_KEYS.deviceLibraryWebToken])

    const sync = await runSync(web, SERVER, s)
    expect(sync.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(url).toBe(`${SERVER}/api/sync?planner=cable&after=0`)
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer geheim')
    // Der Cache traegt kein Token.
    expect(s.m.get(STORAGE_KEYS.deviceLibraryCache)).not.toContain('geheim')
  })

  it('vergisst ein abgelaufenes Token', async () => {
    const s = speicher()
    s.setItem(STORAGE_KEYS.deviceLibraryWebToken, 'alt')
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'not-signed-in' }, { status: 401 })))
    const r = await createWebDeviceLibraryApi(() => s).sync(SERVER, 0)
    expect(r).toMatchObject({ ok: false, code: 'not-signed-in' })
    expect(s.getItem(STORAGE_KEYS.deviceLibraryWebToken)).toBeNull()
  })

  it('meldet ohne Token not-signed-in, ohne den Server zu fragen', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const r = await createWebDeviceLibraryApi(() => speicher()).sync(SERVER, 0)
    expect(r).toMatchObject({ ok: false, code: 'not-signed-in' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reicht die Zwei-Faktor-Stufe durch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ twoFactorRedirect: true }, { headers: { 'x-auth-challenge': 'c1' } })))
    const r = await createWebDeviceLibraryApi(() => speicher()).signIn(SERVER, 'a@b.de', 'pw')
    expect(r).toEqual({ kind: 'second-factor', challenge: 'c1' })
  })

  it.each([
    [403, { error: 'email-not-verified' }, 'email-not-verified'],
    [403, { error: 'guidelines-outdated' }, 'guidelines-outdated'],
    [409, { error: 'exists', slug: 'acme-x1' }, 'exists'],
  ] as const)('meldet beim Einreichen HTTP %i als Code', async (status, body, code) => {
    const s = speicher()
    s.setItem(STORAGE_KEYS.deviceLibraryWebToken, 't')
    vi.stubGlobal('fetch', vi.fn(async () => json(body, { status })))
    const { core, facet } = proposalFor(vorlage('Acme X1'), { manufacturer: 'Acme', model: 'X1' })
    const r = await createWebDeviceLibraryApi(() => s).propose(SERVER, core, facet)
    expect(r).toMatchObject({ ok: false, code, status })
  })

  it('sendet einen Vorschlag mit dem Datenblattlink als sourceUrl', async () => {
    const s = speicher()
    s.setItem(STORAGE_KEYS.deviceLibraryWebToken, 't')
    const fetchMock = vi.fn(async () => json({ slug: 'acme-x1', state: 'pending' }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const v = vorlage('Acme X1', { rentmanSource: '77' })
    const { core, facet } = proposalFor(v, { manufacturer: 'Acme', model: 'X1' })
    const r = await createWebDeviceLibraryApi(() => s).propose(SERVER, core, facet)
    expect(r).toEqual({ ok: true, value: { slug: 'acme-x1', state: 'pending' } })
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.data).toMatchObject({ manufacturer: 'Acme', model: 'X1', category: 'Converter', sourceUrl: 'https://example.com/datasheet', powerWatts: 5 })
    expect(body.data.planners.cable.name).toBe('Acme X1')
    expect(body.data.planners.cable.rentmanSource).toBeUndefined()
  })
})

describe('Einreichen und Fehlertexte', () => {
  const t = (_k: string, f: string) => f

  it('verweist bei geaenderten Richtlinien auf die Richtlinien-Seite', () => {
    expect(guidelinesUrl('https://devices.zumpelars.de/')).toBe('https://devices.zumpelars.de/guidelines')
  })

  it('schlaegt Hersteller und Modell aus dem Namen vor', () => {
    expect(guessManufacturerModel('Blackmagic ATEM Mini Pro')).toEqual({ manufacturer: 'Blackmagic', model: 'ATEM Mini Pro' })
    expect(guessManufacturerModel('Einwort')).toEqual({ manufacturer: '', model: 'Einwort' })
  })

  it('nennt jeden Fehlercode als eigenen Satz', () => {
    expect(errorText({ code: 'email-not-verified' }, t)).toMatch(/confirmation email/)
    expect(errorText({ code: 'guidelines-outdated' }, t)).toMatch(/guidelines have changed/)
    expect(errorText({ code: 'exists' }, t)).toMatch(/already has a device/)
    // Die Nachricht des Servers entscheidet nichts mehr — nur der Code.
    expect(errorText({ code: 'wrong-credentials', status: 403, message: 'email-not-verified' }, t)).toMatch(/password is wrong/)
    expect(errorText({ code: 'offline' }, t)).toMatch(/cannot be reached/)
    expect(errorText({ code: 'rate-limited' }, t)).toMatch(/Too many attempts/)
  })
})

describe('Client-Kopie', () => {
  it('liegt in main und renderer byte-gleich', () => {
    // Die Quelle ist larszu/av-device-library `clients/deviceLibraryClient.ts`;
    // hier wird nur verhindert, dass die beiden Kopien IN diesem Repo auseinanderlaufen.
    expect(readFileSync('src/main/services/deviceLibraryClient.ts', 'utf8')).toBe(
      readFileSync('src/renderer/lib/deviceLibraryClient.ts', 'utf8'),
    )
  })
})
