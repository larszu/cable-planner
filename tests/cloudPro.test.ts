import { afterEach, describe, expect, it, vi } from 'vitest'

// Pro-Paket „Cloud“ (av-device-library): ohne Pro antworten Speichern,
// Lese-Link und TURN mit 402 `pro-required`.
const bruecke = { call: vi.fn() }
vi.mock('../src/renderer/lib/bridge', () => ({ cablePlannerApi: { cloud: bruecke } }))

const { CloudError, createShareLink, turnCredentials } = await import('../src/renderer/lib/cloudProjectsClient')
const { turnFromAccount } = await import('../src/renderer/lib/cloud')
const { proOrderUrl } = await import('../src/renderer/lib/deviceLibraryUrl')

const pro402 = { error: 'pro-required', message: 'Pro', orderUrl: 'https://devices.zumpelars.de/pro' }

describe('Pro nötig (402)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('der Client meldet 402 als eigenen Fall pro-required', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(pro402), { status: 402 })))
    const e = await createShareLink('https://devices.zumpelars.de', 'tok', 'p1').catch((x: unknown) => x)
    expect(e).toBeInstanceOf(CloudError)
    expect((e as InstanceType<typeof CloudError>).code).toBe('pro-required')
    expect((e as InstanceType<typeof CloudError>).status).toBe(402)
    await expect(turnCredentials('https://devices.zumpelars.de', 'tok')).rejects.toMatchObject({ code: 'pro-required' })
  })

  it('Collab faellt ohne Pro still auf die Reserve zurueck: keine TURN-Eintraege, kein Fehler', async () => {
    bruecke.call.mockResolvedValueOnce({ ok: false, code: 'pro-required', status: 402 })
    await expect(turnFromAccount('https://devices.zumpelars.de')).resolves.toEqual([])
  })

  it('verlinkt die Bestellseite des eingestellten Servers', () => {
    expect(proOrderUrl('https://devices.zumpelars.de/')).toBe('https://devices.zumpelars.de/pro')
  })
})
