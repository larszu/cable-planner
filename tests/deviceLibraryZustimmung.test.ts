// ───────────────────────────────────────────────────────────────────────────
// Nichts geht hinaus, ohne dass jemand zugestimmt hat.
//
// Das automatische Hochladen war an, sobald jemand angemeldet war — gefragt
// wurde nie. Dieser Test ist die Zusicherung dagegen, und zwar an der
// Engstelle: `syncNow` im Store ist der einzige Weg, auf dem eigene Vorlagen
// den Rechner verlassen. Er prueft nicht die Oberflaeche (ein Dialog laesst
// sich umbauen), sondern dass ohne gueltige Zustimmung KEIN Upload-Aufruf
// stattfindet — und dass das Herunterladen davon unberuehrt bleibt.
// ───────────────────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_KEEPS,
  CONSENT_SENDS,
  UPLOAD_CONSENT_VERSION,
  consentCurrent,
} from '../src/renderer/lib/deviceLibraryConsent'
import { loadCache, mergeSync, emptyCache } from '../src/renderer/lib/deviceLibrary'
import { STORAGE_KEYS } from '../src/renderer/lib/storageKeys'
import type { SyncResponse } from '../src/renderer/lib/deviceLibraryClient'
import type { Port } from '../src/renderer/types/equipment'

/** Eine Facette, die die App-eigene Vorlagenpruefung besteht — sonst wirft
 *  `mergeSync` den Eintrag heraus, und der Test prueft nichts. */
const facette = (name: string) => ({
  name,
  category: 'Converter',
  inputs: [{ id: 'i1', name: 'SDI In', connectorType: 'BNC' } as Port],
  outputs: [{ id: 'o1', name: 'HDMI Out', connectorType: 'HDMI' } as Port],
  manufacturerUrl: 'https://example.com/datasheet',
  powerWatts: 5,
})

describe('Zustimmung zum Hochladen', () => {
  it('gilt nur fuer die Fassung, der zugestimmt wurde', () => {
    expect(consentCurrent(null)).toBe(false)
    expect(consentCurrent({ version: UPLOAD_CONSENT_VERSION, at: '2026-11-11T00:00:00.000Z' })).toBe(true)
    // Aendert sich der Umfang, zaehlt die alte Entscheidung nicht weiter.
    expect(consentCurrent({ version: '2020-01-01', at: '2026-11-11T00:00:00.000Z' })).toBe(false)
  })

  it('nennt im Dialog, was hinausgeht und was hierbleibt', () => {
    // Der Text IST die Zustimmung. Eine leere Liste waere eine Zustimmung
    // zu nichts Bestimmtem — und genau das soll es nicht sein.
    expect(CONSENT_SENDS.length).toBeGreaterThanOrEqual(3)
    expect(CONSENT_KEEPS.length).toBeGreaterThanOrEqual(3)
    for (const z of [...CONSENT_SENDS, ...CONSENT_KEEPS]) {
      expect(z.key.startsWith('deviceLibrary.consent.')).toBe(true)
      expect(z.en.length).toBeGreaterThan(20)
    }
  })

  it('hat eine Fassung, die wie ein Datum aussieht', () => {
    // Eine Zahl, die jemand hochzaehlt, sagt nicht, wann sie galt.
    expect(UPLOAD_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ── Der Riegel im Store ───────────────────────────────────────────────────
//
// Mit echtem Store, aber gemockter Bruecke: so steht hier die Frage, die
// zaehlt — wurde `upload` aufgerufen? —, und nicht die Frage, ob eine
// Komponente den richtigen Knopf anzeigt.

const bruecke = {
  hasToken: vi.fn(async () => true),
  signIn: vi.fn(),
  verifySecondFactor: vi.fn(),
  currentUser: vi.fn(),
  signOut: vi.fn(),
  sync: vi.fn(async () => ({
    ok: true as const,
    value: { reset: false, response: { format: 'avplan-device-sync', version: 1, planner: 'cable', latestSeq: 0, devices: [] } as SyncResponse },
  })),
  propose: vi.fn(),
  upload: vi.fn(async () => ({ ok: true as const, value: [] })),
  confirm: vi.fn(),
  unconfirm: vi.fn(),
  dispute: vi.fn(),
}

vi.mock('../src/renderer/lib/bridge', () => ({
  cablePlannerApi: { deviceLibrary: bruecke },
  hasDesktopBridge: true,
}))

describe('syncNow', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { useSettingsStore } = await import('../src/renderer/store/settingsStore')
    useSettingsStore.setState({ deviceLibraryAutoUpload: true, deviceLibraryUploadConsent: null })
  })

  it('laedt ohne Zustimmung NICHTS hoch — holt aber weiter herunter', async () => {
    const { useDeviceLibraryStore } = await import('../src/renderer/store/deviceLibraryStore')
    await useDeviceLibraryStore.getState().syncNow('https://devices.example.org', [])
    expect(bruecke.upload).not.toHaveBeenCalled()
    expect(bruecke.sync).toHaveBeenCalled()
    expect(useDeviceLibraryStore.getState().uploadError?.code).toBe('consent-missing')
  })

  it('laedt mit Zustimmung hoch', async () => {
    const { useSettingsStore } = await import('../src/renderer/store/settingsStore')
    const { useDeviceLibraryStore } = await import('../src/renderer/store/deviceLibraryStore')
    useSettingsStore.setState({
      deviceLibraryUploadConsent: { version: UPLOAD_CONSENT_VERSION, at: new Date().toISOString() },
    })
    await useDeviceLibraryStore.getState().syncNow('https://devices.example.org', [])
    expect(useDeviceLibraryStore.getState().uploadError).toBeNull()
    expect(bruecke.sync).toHaveBeenCalled()
  })
})

// ── Die Versions-Id ───────────────────────────────────────────────────────
//
// Bestaetigen und Beanstanden gehen an eine VERSION. Kommt die Id nicht
// durch, waere der Knopf da und die Anfrage ins Leere gerichtet.

const speicher = () => {
  const m = new Map<string, string>()
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

describe('versionId', () => {
  it('kommt aus dem Abgleich in den Stand', () => {
    const { cache } = mergeSync(emptyCache('https://devices.example.org'), {
      latestSeq: 7,
      devices: [
        {
          slug: 'acme-x', version: 3, versionId: 4711, seq: 7, removed: false, status: 'verified', confirmations: 4,
          core: { manufacturer: 'Acme', model: 'X', category: 'Converter' },
          facet: facette('Acme X'),
        },
      ],
    })
    expect(cache.entries[0]).toMatchObject({ slug: 'acme-x', version: 3, versionId: 4711 })
  })

  it('wird 0, wenn ein Server sie nicht liefert', () => {
    const { cache } = mergeSync(emptyCache('https://devices.example.org'), {
      latestSeq: 1,
      // Ein Server vor 11/2026 kennt das Feld nicht.
      devices: [
        {
          slug: 'acme-y', version: 1, seq: 1, removed: false, status: 'unconfirmed', confirmations: 0,
          core: { manufacturer: 'Acme', model: 'Y', category: 'Converter' },
          facet: facette('Acme Y'),
        } as unknown as Parameters<typeof mergeSync>[1]['devices'][number],
      ],
    })
    expect(cache.entries[0].versionId).toBe(0)
  })

  it('wird 0 bei einem Stand, der vor der Einfuehrung gespeichert wurde', () => {
    const s = speicher()
    // Genau so lag ein Stand vor 11/2026 im Speicher: ohne `versionId`.
    s.setItem(
      STORAGE_KEYS.deviceLibraryCache,
      JSON.stringify({
        format: 'cable-planner-device-library-caches',
        version: 1,
        byServer: {
          'https://devices.example.org': {
            format: 'cable-planner-device-library-cache', version: 1, server: 'https://devices.example.org', latestSeq: 9,
            entries: [{ slug: 'alt', version: 2, seq: 9, status: 'confirmed', confirmations: 1, manufacturer: 'Acme', model: 'Alt', template: { name: 'Alt', category: 'Converter' } }],
          },
        },
      }),
    )
    expect(loadCache('https://devices.example.org', s).entries[0].versionId).toBe(0)
  })
})
