import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isWakeLockSupported, keepScreenAwake } from '../src/renderer/lib/wakeLock'
import scannerQuelle from '../src/renderer/lib/barcodeScanner.ts?raw'
import mobileQuelle from '../src/mobile/MobileApp.tsx?raw'

// ---------------------------------------------------------------------------
// Der Bildschirm bleibt an, solange gescannt wird (Bedarf 69, P2).
//
//   > Scanner input submits the whole form instead of tabbing to the next
//   > field; THE PHONE LOCKS MID-SCAN and has to be double-tapped; […]
//   > If the suite ever exposes a scan surface: location-context-first,
//   > continuous scan without form submission, WAKE-LOCK WHILE SCANNING, and
//   > idempotent quantity handling. Cheap to get right, very visible when
//   > wrong.
//
// Beleg fuer diesen Punkt: inventree/inventree-app#492 (2024-05).
//
// Der Teil, den man vergisst, ist nicht das Anfordern, sondern das ERNEUTE
// Anfordern: die API gibt die Sperre beim Wechsel in den Hintergrund von
// selbst frei und holt sie NICHT zurueck. Genau darauf zielt der groesste
// Teil dieser Datei.
// ---------------------------------------------------------------------------

interface FakeSentinel {
  released: boolean
  release: () => Promise<void>
}

const anfragen: FakeSentinel[] = []
let ablehnen = false

const fakeWakeLock = {
  request: vi.fn(async (typ: string) => {
    expect(typ).toBe('screen')
    if (ablehnen) throw new Error('policy')
    const s: FakeSentinel = {
      released: false,
      release: async () => {
        s.released = true
      },
    }
    anfragen.push(s)
    return s
  }),
}

const setzeSichtbarkeit = (v: 'visible' | 'hidden'): void => {
  Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  anfragen.length = 0
  ablehnen = false
  fakeWakeLock.request.mockClear()
  Object.defineProperty(navigator, 'wakeLock', { value: fakeWakeLock, configurable: true })
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'wakeLock')
})

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('die Sperre wird gehalten und wieder freigegeben', () => {
  it('fordert sie beim Start an', async () => {
    const h = keepScreenAwake()
    await flush()
    expect(fakeWakeLock.request).toHaveBeenCalledTimes(1)
    h.release()
  })

  it('gibt sie beim Freigeben zurueck', async () => {
    const h = keepScreenAwake()
    await flush()
    h.release()
    await flush()
    expect(anfragen[0].released).toBe(true)
  })

  it('vertraegt doppeltes Freigeben', async () => {
    const h = keepScreenAwake()
    await flush()
    h.release()
    h.release()
    expect(anfragen).toHaveLength(1)
  })
})

describe('der Teil, den man vergisst', () => {
  it('fordert sie NEU an, wenn die Seite zurueckkommt', async () => {
    // Die API gibt die Sperre im Hintergrund von selbst frei und holt sie
    // nicht zurueck. Ohne diesen Horcher waere die Sperre nach dem ersten
    // App-Wechsel weg -- lautlos, ohne Fehler, und das Telefon geht wieder
    // mitten im Scan zu.
    const h = keepScreenAwake()
    await flush()
    expect(fakeWakeLock.request).toHaveBeenCalledTimes(1)

    setzeSichtbarkeit('hidden')
    await flush()
    setzeSichtbarkeit('visible')
    await flush()

    expect(fakeWakeLock.request).toHaveBeenCalledTimes(2)
    h.release()
  })

  it('fordert NICHT neu an, nachdem freigegeben wurde', async () => {
    // Sonst haelt ein geschlossenes Overlay den Bildschirm weiter wach, und
    // zwar fuer immer.
    const h = keepScreenAwake()
    await flush()
    h.release()
    setzeSichtbarkeit('hidden')
    setzeSichtbarkeit('visible')
    await flush()
    expect(fakeWakeLock.request).toHaveBeenCalledTimes(1)
  })

  it('meldet sich beim Freigeben vom Horcher ab', async () => {
    const ab = vi.spyOn(document, 'removeEventListener')
    const h = keepScreenAwake()
    await flush()
    h.release()
    expect(ab).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
    ab.mockRestore()
  })
})

describe('ehrlich degradierend', () => {
  it('ohne API passiert nichts und es wirft nichts', async () => {
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'wakeLock')
    expect(isWakeLockSupported()).toBe(false)
    const h = keepScreenAwake()
    await flush()
    expect(() => h.release()).not.toThrow()
  })

  it('eine Ablehnung des Browsers erzeugt KEINE unbehandelte Ablehnung', async () => {
    // Akku niedrig, Richtlinie -- der Scan laeuft weiter, der Bildschirm eben
    // nicht. `anfordern` wird mit `void` gerufen; wuerde die Ablehnung
    // durchgelassen, waere sie eine unbehandelte Promise-Ablehnung mitten im
    // Scan. Ein blosses `expect(release).not.toThrow()` sieht das NICHT --
    // die erste Fassung dieser Pruefung blieb deshalb gruen, als die
    // Gegenprobe ein `throw` in den catch-Block setzte.
    const unhandled: unknown[] = []
    const horcher = (e: unknown) => unhandled.push(e)
    process.on('unhandledRejection', horcher)
    ablehnen = true
    const h = keepScreenAwake()
    await flush()
    await flush()
    process.off('unhandledRejection', horcher)
    expect(unhandled).toEqual([])
    expect(() => h.release()).not.toThrow()
  })

  it('gibt eine Sperre frei, die WAEHREND des Freigebens ankommt', async () => {
    // Das Wettrennen: `release()` laeuft, waehrend die Anfrage noch offen ist.
    // Die Pruefung vor dem `await` faengt das nicht -- danach haelt niemand
    // mehr die eben erhaltene Sperre, und der Bildschirm bleibt fuer den Rest
    // der Sitzung an, ohne dass irgendwo etwas darauf zeigt.
    const h = keepScreenAwake()
    h.release() // noch bevor die Anfrage zurueck ist
    await flush()
    await flush()
    expect(anfragen[0]?.released).toBe(true)
  })

  it('gibt IMMER ein Handle zurueck, auch ohne API', () => {
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'wakeLock')
    // Ein `null` zwaenge jede Aufrufstelle zu einer Fallunterscheidung, und
    // die wird irgendwo vergessen.
    expect(typeof keepScreenAwake().release).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Beide Scan-Flaechen muessen sie halten -- die auf dem
// Telefon ist die, die im Lager wirklich benutzt wird.
// ---------------------------------------------------------------------------
describe('beide Scan-Flaechen halten sie', () => {
  it('der Kamera-Scanner haengt sie an den Scan, nicht an einen Knopf', () => {
    expect(scannerQuelle).toContain("from './wakeLock'")
    expect(scannerQuelle).toContain('const awake = keepScreenAwake()')
    // Sie endet mit der Kamera -- also kann sie nicht stehenbleiben.
    expect(scannerQuelle).toContain('awake.release()')
  })

  it('das Telefon-Overlay haelt sie, auch wenn die Kamera gesperrt ist', () => {
    // Wer im unsicheren LAN-Kontext den Code abtippt, hat dasselbe Problem.
    expect(mobileQuelle).toContain("from '../renderer/lib/wakeLock'")
    expect(mobileQuelle).toMatch(/const awake = keepScreenAwake\(\)\n\s*return \(\) => awake\.release\(\)/)
  })

  it('die Code-Eingabe schickt KEIN Formular ab', () => {
    // Die erste der sechs Reibungen (snipe-it#17057): ein Hardware-Scanner
    // schickt ein Enter, und ein Formular darunter macht daraus ein Absenden.
    // Hier ruft Enter `submitText()` -- es gibt gar kein Formular.
    expect(mobileQuelle).toContain("if (e.key === 'Enter') submitText()")
    expect(mobileQuelle).not.toMatch(/<form[\s>]/)
  })
})
