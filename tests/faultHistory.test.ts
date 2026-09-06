import { describe, expect, it } from 'vitest'
import {
  affectedServices,
  faultTable,
  faultsOf,
  normaliseFaultEvent,
  openFaultsOf,
  suspectUnits,
} from '../src/renderer/lib/faultHistory'
import {
  FAULT_SERVICE_LABEL,
  type InventoryItem,
  type InventoryUnit,
  type UnitEvent,
} from '../src/renderer/types/inventory'
import typenQuelle from '../src/renderer/types/inventory.ts?raw'
import libQuelle from '../src/renderer/lib/faultHistory.ts?raw'
import storeQuelle from '../src/renderer/store/inventoryStore.ts?raw'
import dialogQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Verdaechtige Einheiten (Bedarf 52, P2).
//
//   > One SMPTE/fibre run carries video, return video, comms, tally, control
//   > and power, so a single fault presents as several departments' problems;
//   > which drum is suspect lives only in crew memory and THE SAME BAD DRUM
//   > SHIPS AGAIN NEXT MONTH.
//
// Der Beleg ist ZWEITER HAND (die Bedarfs-Datenbank sagt es selbst). Gebaut
// wird deshalb nur, was aus dem Mechanismus folgt — ein Strang traegt mehrere
// Dienste, also ist ein Fehler daran mehrdeutig — und nichts, was eine
// Statistik ueber Ausfallraten behaupten wuerde.
// ---------------------------------------------------------------------------

const ev = (over: Partial<UnitEvent> = {}): UnitEvent => ({
  at: over.at ?? '2026-09-01T10:00:00Z',
  kind: over.kind ?? 'fault',
  detail: over.detail ?? 'Bild weg',
  ...(over.services ? { services: over.services } : {}),
  ...(over.resolved !== undefined ? { resolved: over.resolved } : {}),
})

const unit = (id: string, history: UnitEvent[] = []): InventoryUnit =>
  ({
    id,
    itemId: 'm1',
    serial: `SN-${id}`,
    condition: 'ok',
    history,
    createdAt: '',
    updatedAt: '',
  }) as InventoryUnit

const item = (id = 'm1', model = 'SMPTE-Trommel 100 m'): InventoryItem =>
  ({ id, model, quantity: 1, createdAt: '', updatedAt: '' }) as InventoryUnit as never

// ── 1. Wo die Historie haengt ──────────────────────────────────────────────

describe('die Historie haengt am physischen Objekt, nicht am Plan', () => {
  it('ist ein Ereignis der Lager-Einheit', () => {
    // Ein Fehlerprotokoll am Plan-Kabel waere wertlos: das Projekt endet, die
    // Datei wird archiviert — und die Trommel geht naechsten Monat wieder raus.
    expect(typenQuelle).toMatch(/UnitEventKind = 'created' \| 'moved' \| 'condition' \| 'note' \| 'fault'/)
    expect(typenQuelle).toMatch(/WARUM DAS HIER STEHT UND NICHT AM KABEL IM PLAN/)
  })

  it('nennt die Herkunft der Fundstelle im Klartext', () => {
    // Der Beleg ist zweiter Hand, und das steht dort, wo jemand entscheidet,
    // was noch gebaut werden darf.
    expect(typenQuelle).toMatch(/ZWEITER HAND/)
  })

  it('rechnet keine Ausfallrate und keine Restlebensdauer', () => {
    // Dafuer braeuchte es Einsatzstunden je Einheit, die dieser Planer nicht
    // kennt. Eine Prozentzahl waere eine erfundene Messung.
    //
    // Geprueft wird der CODE, nicht die Prosa: erste Fassung suchte „rate" im
    // ganzen Modul und traf damit das Wort „Ausfallrate" in genau dem Satz,
    // der sagt, dass keine gerechnet wird.
    const ohneKommentare = libQuelle
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(ohneKommentare).not.toMatch(/rate|mtbf|probabilit|percent|\/\s*total\s*\*/i)
    // Und die Kennzahlen entstehen ohne Division: die Import-Pfade zaehlen
    // nicht mit, deshalb wird nur der Rumpf geprueft.
    const rumpf = ohneKommentare.slice(ohneKommentare.indexOf('export const faultsOf'))
    expect(rumpf).not.toMatch(/\)\s*\/\s*\w/)
  })
})

// ── 2. Offen gilt, bis jemand das Gegenteil sagt ───────────────────────────

describe('offen gilt, bis jemand das Gegenteil sagt', () => {
  it('zählt einen Eintrag ohne Angabe als OFFEN', () => {
    // Ein unbeantwortetes „ist das behoben?" als erledigt zu lesen ist genau
    // der Weg, auf dem dieselbe Trommel wieder rausgeht.
    expect(openFaultsOf(unit('a', [ev()]))).toHaveLength(1)
  })

  it('zählt nur ein ausdrückliches `true` als behoben', () => {
    expect(openFaultsOf(unit('a', [ev({ resolved: true })]))).toHaveLength(0)
    expect(openFaultsOf(unit('a', [ev({ resolved: false })]))).toHaveLength(1)
  })

  it('lässt andere Ereignisarten aus der Zählung heraus', () => {
    const u = unit('a', [ev({ kind: 'note', detail: 'sieht komisch aus' }), ev()])
    expect(faultsOf(u)).toHaveLength(1)
  })

  it('sortiert die Fehler jüngste zuerst', () => {
    const u = unit('a', [
      ev({ at: '2026-01-01T00:00:00Z', detail: 'alt' }),
      ev({ at: '2026-09-01T00:00:00Z', detail: 'neu' }),
    ])
    expect(faultsOf(u)[0].detail).toBe('neu')
  })
})

// ── 3. Die Mehrdeutigkeit des Strangs ──────────────────────────────────────

describe('ein Fehler am Strang ist mehrdeutig', () => {
  it('trägt die Dienste als Feld, nicht im Freitext', () => {
    // Ein Satz laesst sich nicht zaehlen, und „welche Trommel ist verdaechtig"
    // ist genau eine Zaehlfrage.
    expect(typenQuelle).toMatch(/services\?: FaultService\[\]/)
    expect(typenQuelle).toMatch(/resolved\?: boolean/)
    // Beides steht als FELD am Ereignis und nicht im `detail`-Text.
    expect(typenQuelle).toMatch(/ist genau eine Zaehlfrage/)
  })

  it('sammelt alle je betroffenen Dienste ohne Doppelte', () => {
    const u = unit('a', [
      ev({ services: ['video', 'comms'] }),
      ev({ at: '2026-09-02T10:00:00Z', services: ['comms', 'tally'] }),
    ])
    expect(affectedServices(u).sort()).toEqual(['comms', 'tally', 'video'])
  })

  it('deckt die sechs Dienste des Bedarfs ab', () => {
    expect(Object.keys(FAULT_SERVICE_LABEL).sort()).toEqual([
      'comms',
      'control',
      'power',
      'returnVideo',
      'tally',
      'video',
    ])
  })
})

// ── 4. Wer ist verdächtig ──────────────────────────────────────────────────

describe('suspectUnits', () => {
  it('lässt Einheiten ohne Fehler ganz weg', () => {
    // Eine Liste, in der alles steht, beantwortet die Frage des Bedarfs nicht
    // — sie stellt sie neu.
    expect(suspectUnits([unit('sauber'), unit('kaputt', [ev()])]).map((s) => s.unit.id)).toEqual([
      'kaputt',
    ])
  })

  it('stellt die meisten OFFENEN Fehler nach oben', () => {
    // Die Fixtur ist so gebaut, dass NUR die Zahl der offenen Fehler
    // entscheiden kann: gleicher Zeitpunkt, und alphabetisch stuende „a"
    // vorn. Erste Fassung liess dem juengeren Datum die Entscheidung — der
    // Test war gruen, auch als die Sortierung nach offenen Fehlern wegfiel.
    const a1 = unit('a-einer', [ev({ at: '2026-09-01T10:00:00Z' })])
    const b2 = unit('b-zweie', [
      ev({ at: '2026-09-01T10:00:00Z' }),
      ev({ at: '2026-09-01T10:00:00Z', detail: 'und nochmal' }),
    ])
    expect(suspectUnits([a1, b2])[0].unit.id).toBe('b-zweie')
  })

  it('behält eine Einheit in der Liste, deren Fehler alle behoben sind', () => {
    // Die Vorgeschichte ist die Auskunft: dieselbe Trommel war schon dreimal
    // auffaellig, auch wenn jedes Mal jemand etwas gemacht hat.
    const s = suspectUnits([unit('a', [ev({ resolved: true })])])
    expect(s).toHaveLength(1)
    expect(s[0].open).toBe(0)
    expect(s[0].total).toBe(1)
  })

  it('nennt den Zeitpunkt des jüngsten Fehlers', () => {
    const s = suspectUnits([
      unit('a', [ev({ at: '2026-01-01T00:00:00Z' }), ev({ at: '2026-09-01T00:00:00Z' })]),
    ])
    expect(s[0].lastAt).toBe('2026-09-01T00:00:00Z')
  })

  it('sortiert stabil, wenn die Zahlen gleich sind', () => {
    const a = unit('a', [ev()])
    const b = unit('b', [ev()])
    expect(suspectUnits([b, a]).map((s) => s.unit.id)).toEqual(['a', 'b'])
  })
})

// ── 5. Das Blatt ───────────────────────────────────────────────────────────

describe('faultTable', () => {
  it('nennt Modell, Seriennummer, Zahlen und Dienste', () => {
    const t = faultTable([unit('a', [ev({ services: ['video', 'comms'] })])], [item()])
    expect(t.rows[0][0]).toBe('SMPTE-Trommel 100 m')
    expect(t.rows[0][1]).toBe('SN-a')
    expect(t.rows[0][2]).toBe(1)
    expect(String(t.rows[0][4])).toContain('Video')
    expect(String(t.rows[0][4])).toContain('Comms')
  })

  it('gibt jeder leeren Zelle einen NAMEN', () => {
    const ohne = { ...unit('a', [ev()]), serial: undefined } as InventoryUnit
    const t = faultTable([ohne], [])
    const zeile = t.rows[0].map(String)
    expect(zeile).toContain('ohne Seriennummer')
    expect(zeile).toContain('Modell unbekannt')
    expect(zeile).toContain('keine Dienste genannt')
    expect(zeile.every((z) => z.trim() !== '')).toBe(true)
  })

  it('trägt kanonisches Deutsch', () => {
    expect(libQuelle).not.toContain("t('")
  })
})

// ── 6. Laden, Store und Oberfläche ─────────────────────────────────────────

describe('das Laden', () => {
  it('lässt ein Fehler-Ereignis NICHT auf `note` zurückfallen', () => {
    // Ohne diesen Zweig fiele jedes gespeicherte Fehler-Ereignis beim nächsten
    // Laden auf `note` zurück: der Text bliebe stehen, `services` und
    // `resolved` wären weg, und die Zählung ergäbe still null.
    expect(storeQuelle).toMatch(/ev\.kind === 'fault'\s*\n?\s*\? ev\.kind/)
    expect(storeQuelle).toMatch(/kind === 'fault' \? normaliseFaultEvent\(ev\) : \{\}/)
  })

  it('wirft einen unbekannten Dienstnamen weg', () => {
    expect(normaliseFaultEvent({ services: ['video', 'sternzeichen'] }).services).toEqual(['video'])
  })

  it('behält `resolved` nur als ausdrückliches `true`', () => {
    expect(normaliseFaultEvent({ resolved: true }).resolved).toBe(true)
    expect(normaliseFaultEvent({ resolved: 'ja' }).resolved).toBeUndefined()
    expect(normaliseFaultEvent({}).resolved).toBeUndefined()
  })
})

describe('der Store', () => {
  it('hängt den Fehler an, statt ihn zu ersetzen', () => {
    expect(storeQuelle).toMatch(/history: \[\s*\n?\s*\.\.\.u\.history,\s*\n?\s*\{\s*\n?\s*at: now,\s*\n?\s*kind: 'fault' as const,/)
  })

  it('setzt den Zustand der Einheit NICHT automatisch auf „defekt"', () => {
    // Ob ein Bild-Aussetzer die Trommel oder den Wandler betraf, weiss der
    // Planer nicht; eine automatisch gesperrte Trommel waere eine Behauptung.
    const block = storeQuelle.slice(
      storeQuelle.indexOf('reportUnitFault: (id, detail, services)'),
      storeQuelle.indexOf('resolveUnitFault: (id, at)'),
    )
    expect(block.length).toBeGreaterThan(100)
    expect(block).not.toMatch(/condition:/)
  })

  it('markiert „behoben" als Ergänzung, nicht als Löschen', () => {
    const block = storeQuelle.slice(storeQuelle.indexOf('resolveUnitFault: (id, at)'))
    expect(block).toMatch(/\{ \.\.\.e, resolved: true \}/)
    expect(block.slice(0, 800)).not.toMatch(/filter\(/)
  })
})

describe('die Oberfläche', () => {
  it('zeigt den Verdacht NEBEN dem Zustand, nicht darin', () => {
    // „defekt" ist eine Entscheidung, die jemand getroffen hat; „3 offene
    // Fehler" ist eine Zählung.
    expect(dialogQuelle).toMatch(/openFaultsOf\(u\)\.length > 0 && \(/)
    expect(dialogQuelle).toMatch(/inventory\.openFaults/)
  })

  it('hebt einen Fehler in der Historie von einer Notiz ab', () => {
    // Geprueft wird der Block, der die Marke setzt — nicht irgendein
    // `e.kind === 'fault'`. Erste Fassung traf die Dienste-Zeile weiter unten
    // und blieb gruen, als die Marke abgeschaltet wurde.
    expect(dialogQuelle).toMatch(
      /e\.kind === 'fault' && \(\s*\n\s*<span className=\{e\.resolved \? 'text-cp-text-faint' : 'text-amber-300\/90'\}>[\s\S]*?inventory\.faultResolved/,
    )
  })

  it('lässt die Dienste ankreuzen statt sie zu erraten', () => {
    expect(dialogQuelle).toMatch(/\(Object\.keys\(FAULT_SERVICE_LABEL\) as FaultService\[\]\)\.map/)
  })
})
