// ───────────────────────────────────────────────────────────────────────────
// Geraetebibliothek — eigene Vorlagen hochladen, Katalog veroeffentlichen.
//
// Die Aussagen, die hier haengen:
//  * Hoch geht nur EIGENES: unveraenderte Katalog-Vorlagen und Rentman-
//    Importe nicht; Favorit/Versteckt zaehlen nicht als Aenderung.
//  * Unveraendert seit dem letzten Hochladen heisst: keine Anfrage.
//  * Der Zustand je Vorlage ueberlebt den Neustart; nach einem Fehler wird
//    erneut gesendet, nach „blockiert" erst, wenn sich etwas aendert.
//  * Hersteller/Modell werden nicht erfunden, wo keiner zu erkennen ist.
// `fetch` bzw. die Bruecke sind gemockt.
// ───────────────────────────────────────────────────────────────────────────
import { afterEach, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import type { UploadItem, UploadResult } from '../src/renderer/lib/deviceLibraryClient'
import { herstellerAusName } from '../src/renderer/lib/herstellerAusName'
import { fingerabdruck, stabilesJson, uploadItemAus } from '../src/renderer/lib/deviceLibraryItem'
import {
  eigeneVorlagen,
  leererUploadStand,
  loadUploadStand,
  planeUpload,
  runUpload,
  saveUploadStand,
  uebernehmeErgebnisse,
  wartetAufModeration,
} from '../src/renderer/lib/deviceLibraryUpload'
import { EINGEBAUTER_KATALOG } from '../src/renderer/lib/eingebauterKatalog'
import { createWebDeviceLibraryApi } from '../src/renderer/lib/deviceLibraryWeb'
import { STORAGE_KEYS } from '../src/renderer/lib/storageKeys'
import type { EquipmentTemplate, Port } from '../src/renderer/types/equipment'
import type { DeviceLibraryApi } from '../src/renderer/types/deviceLibrary'

const SERVER = 'https://devices.example.org'

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
    ...extra,
  }) as EquipmentTemplate

const bruecke = (antwort: (items: UploadItem[]) => UploadResult[]) => {
  const aufrufe: UploadItem[][] = []
  const upload: DeviceLibraryApi['upload'] = async (_server, items) => {
    aufrufe.push(items)
    return { ok: true, value: antwort(items) }
  }
  return { upload, aufrufe }
}
const alle = (state: UploadResult['state']) => (items: UploadItem[]) =>
  items.map((i) => ({ localId: i.localId, state, slug: i.localId.toLowerCase().replace(/\W+/g, '-') }))

describe('Hersteller und Modell aus dem Namen', () => {
  it('kennt mehrteilige und umgeschriebene Hersteller', () => {
    expect(herstellerAusName('Blackmagic ATEM Mini Pro')).toEqual({ manufacturer: 'Blackmagic Design', model: 'ATEM Mini Pro' })
    expect(herstellerAusName('Allen & Heath SQ-5')).toEqual({ manufacturer: 'Allen & Heath', model: 'SQ-5' })
    expect(herstellerAusName('Ross Video Graphite')).toEqual({ manufacturer: 'Ross Video', model: 'Graphite' })
    expect(herstellerAusName('GreenGo MCXD')).toEqual({ manufacturer: 'Green-GO', model: 'MCXD' })
  })

  it('laesst bei UniFi den Produktnamen im Modell', () => {
    expect(herstellerAusName('UniFi Switch 24 (USW-24)')).toEqual({ manufacturer: 'Ubiquiti', model: 'UniFi Switch 24 (USW-24)' })
  })

  it('erfindet keinen Hersteller fuer passive Bauformen', () => {
    expect(herstellerAusName('Patch panel 24x BNC').manufacturer).toBe('')
    expect(herstellerAusName('Power strip 6-way').manufacturer).toBe('')
  })

  it('fuehrt den Eigenbau unter der Firma', () => {
    expect(herstellerAusName('LZ Media Station')).toEqual({ manufacturer: 'Lars Zumpe Medienproduktion', model: 'LZ Media Station' })
  })

  it('verwechselt keinen Praefix mit dem Wortanfang', () => {
    expect(herstellerAusName('Powerful Box X').manufacturer).toBe('Powerful')
  })
})

describe('Fingerabdruck', () => {
  it('haengt nicht an der Reihenfolge der Schluessel', () => {
    expect(stabilesJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(stabilesJson({ a: [2, { c: 4, d: 3 }], b: 1 }))
    expect(fingerabdruck({ b: 1, a: 2 })).toBe(fingerabdruck({ a: 2, b: 1 }))
    expect(fingerabdruck({ a: 1 })).not.toBe(fingerabdruck({ a: 2 }))
  })
})

describe('eigeneVorlagen', () => {
  const katalog = [vorlage('Acme Katalog')]

  it('laesst unveraenderte Katalog-Vorlagen und Rentman-Importe weg', () => {
    const eigene = eigeneVorlagen([vorlage('Acme Katalog'), vorlage('Acme Eigen'), vorlage('Acme Miete', { rentmanSource: '7' })], katalog)
    expect(eigene.map((v) => v.name)).toEqual(['Acme Eigen'])
  })

  it('zaehlt Favorit und Versteckt nicht als Aenderung', () => {
    const t = { ...vorlage('Acme Katalog'), favorite: true, hidden: true } as EquipmentTemplate
    expect(eigeneVorlagen([t], katalog)).toEqual([])
  })

  it('nimmt eine geaenderte Katalog-Vorlage als eigene', () => {
    expect(eigeneVorlagen([vorlage('Acme Katalog', { powerWatts: 12 })], katalog)).toHaveLength(1)
  })

  it('erkennt den eingebauten Katalog als nicht eigen', () => {
    expect(eigeneVorlagen(EINGEBAUTER_KATALOG)).toEqual([])
  })
})

describe('planeUpload / uebernehmeErgebnisse', () => {
  const ohnePruefung = () => [] as string[]

  it('schickt nichts, was seit dem letzten Hochladen gleich geblieben ist', () => {
    const v = vorlage('Acme X1')
    const stand = leererUploadStand(SERVER)
    const plan = planeUpload([v], stand, ohnePruefung)
    expect(plan.items).toHaveLength(1)
    const nach = uebernehmeErgebnisse(stand, [v], plan, [{ localId: 'Acme X1', state: 'in-sync', moderation: 'approved', slug: 'acme-x1' }])
    expect(planeUpload([v], nach, ohnePruefung).items).toHaveLength(0)
    expect(planeUpload([{ ...v, powerWatts: 3 }], nach, ohnePruefung).items).toHaveLength(1)
  })

  it('sendet nach einem Fehler erneut, nach „blockiert" erst bei einer Aenderung', () => {
    const a = vorlage('Acme A')
    const b = vorlage('Acme B')
    const stand = leererUploadStand(SERVER)
    const plan = planeUpload([a, b], stand, ohnePruefung)
    const nach = uebernehmeErgebnisse(stand, [a, b], plan, [
      { localId: 'Acme A', state: 'error', error: 'pending-by-other' },
      { localId: 'Acme B', state: 'blocked', findings: [{ kind: 'no-source', blocking: true }] },
    ])
    expect(nach.eintraege['Acme A']).toMatchObject({ zustand: 'error', fehler: 'pending-by-other' })
    expect(nach.eintraege['Acme A'].hash).toBeUndefined()
    expect(nach.eintraege['Acme B']).toMatchObject({ zustand: 'blocked', befunde: ['no-source'] })
    expect(planeUpload([a, b], nach, ohnePruefung).items.map((i) => i.localId)).toEqual(['Acme A'])
  })

  it('sendet lokal Blockiertes nicht und nennt den Grund', () => {
    const stand = leererUploadStand(SERVER)
    const plan = planeUpload([vorlage('Patch panel 12x BNC'), vorlage('Acme Kaputt')], stand, (t) =>
      t.name === 'Acme Kaputt' ? ['No ports'] : [],
    )
    expect(plan.items).toEqual([])
    expect(plan.lokalBlockiert.get('Patch panel 12x BNC')).toEqual(['manufacturer-missing'])
    expect(plan.lokalBlockiert.get('Acme Kaputt')).toEqual(['No ports'])
  })

  it('nimmt die vom Nutzer festgelegte Trennung', () => {
    const stand = { ...leererUploadStand(SERVER), namen: { 'Patch panel 12x BNC': { manufacturer: 'Neutrik', model: 'NBB-12' } } }
    const plan = planeUpload([vorlage('Patch panel 12x BNC')], stand, ohnePruefung)
    expect(plan.items[0].core).toMatchObject({ manufacturer: 'Neutrik', model: 'NBB-12', sourceUrl: 'https://example.com/datasheet' })
  })

  it('vergisst Eintraege zu Vorlagen, die es nicht mehr gibt', () => {
    const stand = { ...leererUploadStand(SERVER), eintraege: { Weg: { zustand: 'in-sync' as const, am: '' } }, namen: { Weg: { manufacturer: 'a', model: 'b' } } }
    const nach = uebernehmeErgebnisse(stand, [], planeUpload([], stand, ohnePruefung), [])
    expect(nach.eintraege).toEqual({})
    expect(nach.namen).toEqual({})
  })
})

describe('runUpload', () => {
  it('ueberlebt den Neustart und fragt ohne Aenderung gar nicht', async () => {
    const s = speicher()
    const bibliothek = [vorlage('Acme X1'), ...EINGEBAUTER_KATALOG]
    const b = bruecke(alle('created'))
    const eins = await runUpload(b, SERVER, bibliothek, s)
    expect(eins.ok && eins.bilanz).toMatchObject({ gesendet: 1, wartet: 1 })
    expect(b.aufrufe).toHaveLength(1)
    expect(b.aufrufe[0].map((i) => i.localId)).toEqual(['Acme X1'])
    expect(loadUploadStand(SERVER, s).eintraege['Acme X1']).toMatchObject({ zustand: 'created', slug: 'acme-x1' })

    // Zweiter Lauf: die Vorlage wartet noch auf Moderation und geht deshalb
    // mit (sonst erfuehre die App nie von der Freigabe) — sonst nichts.
    const zwei = await runUpload(b, SERVER, bibliothek, s)
    expect(zwei.ok && zwei.bilanz.gesendet).toBe(1)
    expect(b.aufrufe).toHaveLength(2)
    const drei = await runUpload(bruecke(alle('approved')), SERVER, bibliothek, s)
    expect(drei.ok && drei.bilanz.gesendet).toBe(1)
    const b4 = bruecke(alle('in-sync'))
    const vier = await runUpload(b4, SERVER, bibliothek, s)
    expect(vier.ok && vier.bilanz.gesendet).toBe(0)
    expect(b4.aufrufe).toHaveLength(0)
  })

  it('laesst den Stand bei einem Fehler der Anfrage unberuehrt', async () => {
    const s = speicher()
    saveUploadStand({ ...leererUploadStand(SERVER), namen: { 'Acme X1': { manufacturer: 'Acme', model: 'X1' } } }, s)
    const r = await runUpload({ upload: async () => ({ ok: false, code: 'rate-limited', status: 429 }) }, SERVER, [vorlage('Acme X1')], s)
    expect(r).toMatchObject({ ok: false, code: 'rate-limited' })
    expect(loadUploadStand(SERVER, s).eintraege).toEqual({})
    expect(loadUploadStand(SERVER, s).namen['Acme X1']).toEqual({ manufacturer: 'Acme', model: 'X1' })
  })

  it('schickt Wartendes erneut mit und stellt es auf live, sobald freigegeben', async () => {
    const s = speicher()
    const bibliothek = [vorlage('Acme X1'), vorlage('Acme Y2')]
    await runUpload(
      bruecke((items) => items.map((i) => ({ localId: i.localId, state: i.localId === 'Acme X1' ? 'created' : 'approved', moderation: i.localId === 'Acme X1' ? 'pending' : 'approved' }))),
      SERVER, bibliothek, s,
    )
    expect(wartetAufModeration(loadUploadStand(SERVER, s).eintraege['Acme X1'])).toBe(true)

    // Unveraendert, aber noch wartend: geht mit. Das freigegebene nicht.
    const b = bruecke((items) => items.map((i) => ({ localId: i.localId, state: 'in-sync', moderation: 'approved' })))
    const r = await runUpload(b, SERVER, bibliothek, s)
    expect(b.aufrufe[0].map((i) => i.localId)).toEqual(['Acme X1'])
    expect(r.ok && r.bilanz).toMatchObject({ gesendet: 1, live: 1, wartet: 0 })
    expect(loadUploadStand(SERVER, s).eintraege['Acme X1']).toMatchObject({ zustand: 'in-sync', moderation: 'approved' })

    // Danach ist nichts mehr offen: keine Anfrage.
    const c = bruecke(alle('in-sync'))
    await runUpload(c, SERVER, bibliothek, s)
    expect(c.aufrufe).toHaveLength(0)
  })

  it('schliesst den Moderationsstand bei einem Server ohne das Feld aus dem Zustand', async () => {
    const s = speicher()
    await runUpload(bruecke(alle('created')), SERVER, [vorlage('Acme X1')], s)
    expect(loadUploadStand(SERVER, s).eintraege['Acme X1'].moderation).toBe('pending')
  })

  it('beginnt fuer einen anderen Server von vorn', async () => {
    const s = speicher()
    await runUpload(bruecke(alle('approved')), SERVER, [vorlage('Acme X1')], s)
    expect(loadUploadStand('https://anderer.example', s).eintraege).toEqual({})
  })
})

describe('Web-Build: upload ueber fetch', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('schickt planner=cable mit Bearer-Token und teilt in Stapel zu 100', async () => {
    const s = speicher()
    s.setItem(STORAGE_KEYS.deviceLibraryWebToken, 'geheim')
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { planner: string; items: UploadItem[] }
      return new Response(JSON.stringify({ planner: body.planner, results: body.items.map((i) => ({ localId: i.localId, state: 'in-sync' })) }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const items = Array.from({ length: 150 }, (_, i) => uploadItemAus(vorlage(`Acme N${i}`)))
    const r = await createWebDeviceLibraryApi(() => s).upload(SERVER, items)
    expect(r.ok && r.value).toHaveLength(150)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${SERVER}/api/upload`)
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer geheim')
    expect(JSON.parse(init.body as string).planner).toBe('cable')
  })
})

describe('library:publish', () => {
  it('bildet den ganzen Katalog ab, ohne zu raten', () => {
    const items = EINGEBAUTER_KATALOG.map((t) => uploadItemAus(t))
    for (const i of items) {
      expect(i.localId).toBeTruthy()
      expect(i.facet).not.toHaveProperty('favorite')
    }
    // Die grosse Mehrheit hat Hersteller und Datenblatt; der Rest wird genannt.
    const hochladbar = items.filter((i) => i.core.manufacturer && /^https?:\/\//.test(i.core.sourceUrl))
    expect(hochladbar.length).toBeGreaterThan(EINGEBAUTER_KATALOG.length * 0.8)
  })

  it('sendet ohne Schluessel nichts, sagt es und endet gruen', () => {
    const env = { ...process.env, DEVICE_LIBRARY_KEY: '', GITHUB_STEP_SUMMARY: '' }
    const aus = execFileSync(process.execPath, ['scripts/library-publish.mjs'], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    expect(aus).toMatch(/DEVICE_LIBRARY_KEY ist nicht gesetzt/)
    expect(aus).toMatch(/Ohne Datenblattlink/)
  })
})
