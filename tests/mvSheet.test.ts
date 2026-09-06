import { describe, expect, it } from 'vitest'
import {
  MV_SHEET_HEADERS,
  NO_ROLE,
  NO_SOURCE,
  multiViewersOf,
  mvFindings,
  mvSheetTable,
  mvWindowCount,
  mvWindows,
  sourceNamesFromTallyRows,
} from '../src/renderer/lib/mvSheet'
import { MV_LAYOUT } from '../src/renderer/lib/atemMvLayout'
import { DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import type { AtemMvDefinition, EquipmentItem } from '../src/renderer/types/equipment'
import libQuelle from '../src/renderer/lib/mvSheet.ts?raw'
import dialogQuelle from '../src/renderer/components/Export/ExportDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Das Multiviewer-Bild als Blatt (Bedarf 125, P4).
//
//   > MV window assignment is configured by hand per show; remote recall is
//   > unreliable, so THE TRUSTED STORE IS THE SWITCHER'S OWN BINARY SAVE
//   > FILE, WHICH NO OTHER DEPARTMENT CAN READ.
//
// Belegt an `bitfocus/companion-module-bmd-atem#480` (2026, offen): dort rufen
// die MV-Fenster 2 und 3 dieselbe Quelle ab.
//
// Der Plan macht den Recall nicht zuverlaessiger — das ist Sache des Mischers.
// Er liefert das Blatt, das heute fehlt.
// ---------------------------------------------------------------------------

const mv = (over: Partial<AtemMvDefinition> = {}): AtemMvDefinition => ({
  index: 0,
  layout: MV_LAYOUT.Default,
  windows: [],
  ...over,
})

/** Ein Bild mit zwei grossen Fenstern oben und acht kleinen unten. */
const standard = (windows: AtemMvDefinition['windows']): AtemMvDefinition =>
  mv({ quadrants: ['big', 'big', 'small', 'small'], windows })

const namen = new Map([
  [1, 'Kamera 1'],
  [2, 'Kamera 2'],
  [3, 'Kamera 3'],
])

// ── 1. Die Fenster ─────────────────────────────────────────────────────────

describe('mvWindows', () => {
  it('nennt jede Position im Klartext', () => {
    // Auf dem Papier sucht niemand nach „windowIndex 32".
    const w = mvWindows(standard([]))
    expect(w[0].position).toBe('oben links')
    expect(w[1].position).toBe('oben rechts')
    expect(w[2].position).toBe('unten links, Zelle 1')
  })

  it('zaehlt die Zellen ab 1 und nicht ab 0', () => {
    const zellen = mvWindows(standard([])).filter((w) => !w.big)
    expect(zellen.map((w) => w.position)).toContain('unten rechts, Zelle 4')
    expect(zellen.some((w) => w.position.includes('Zelle 0'))).toBe(false)
  })

  it('unterscheidet gross und klein', () => {
    const w = mvWindows(standard([]))
    expect(w.filter((x) => x.big)).toHaveLength(2)
    expect(w.filter((x) => !x.big)).toHaveLength(8)
  })

  it('traegt die belegte Quelle und laesst die unbelegte WEG', () => {
    // `undefined` als Feld zu fuehren hiesse, dass ein JSON-Roundtrip aus
    // „nicht belegt" eine leere Zelle macht — und die liest sich wie eine
    // Antwort.
    const w = mvWindows(standard([{ windowIndex: 0, sourceId: 1 }]))
    expect(w[0].sourceId).toBe(1)
    expect('sourceId' in w[1]).toBe(false)
  })

  it('folgt den QUADRANTEN und nicht dem Layout-Feld', () => {
    // `getMvQuadrants` ist die vorhandene Engstelle; ein zweiter Weg von
    // `layout` zu den Fenstern liefe auseinander, sobald jemand einen
    // Quadranten umstellt.
    const alle_gross = mvWindows(mv({ quadrants: ['big', 'big', 'big', 'big'], windows: [] }))
    expect(alle_gross).toHaveLength(4)
    expect(alle_gross.every((w) => w.big)).toBe(true)
  })
})

describe('mvWindowCount', () => {
  it('rechnet aus derselben Gitter-Tabelle wie die Oberflaeche', () => {
    // Sonst behauptete das Blatt eine andere Fensterzahl, als der Bildschirm
    // zeigt.
    expect(mvWindowCount(MV_LAYOUT.Default)).toBe(10)
    expect(mvWindowCount(MV_LAYOUT.Grid16Small)).toBe(16)
    expect(mvWindowCount(MV_LAYOUT.Quad4Big)).toBe(4)
  })
})

// ── 2. Das Blatt ───────────────────────────────────────────────────────────

describe('mvSheetTable', () => {
  it('haelt den Spaltenkopf fest', () => {
    expect(mvSheetTable('ATEM', [], namen).headers).toEqual([...MV_SHEET_HEADERS])
  })

  it('nennt den Multiviewer ab 1, wie am Geraet', () => {
    const [zeile] = mvSheetTable('ATEM 1', [standard([{ windowIndex: 0, sourceId: 1 }])], namen).rows
    expect(zeile[0]).toBe('ATEM 1 · MV 1')
  })

  it('setzt die ROLLE ein, nicht die Quell-Nummer allein', () => {
    // „labels come from the source records" — das ist die Massnahme aus dem
    // Bedarf, woertlich.
    const [zeile] = mvSheetTable('ATEM', [standard([{ windowIndex: 0, sourceId: 2 }])], namen).rows
    expect(zeile[4]).toBe(2)
    expect(zeile[5]).toBe('Kamera 2')
  })

  it('sagt „keine Rolle im Plan" statt eine zu erfinden', () => {
    const [zeile] = mvSheetTable('ATEM', [standard([{ windowIndex: 0, sourceId: 99 }])], namen).rows
    expect(zeile[5]).toBe(NO_ROLE)
  })

  it('sagt „nicht belegt" in BEIDEN Spalten', () => {
    const [zeile] = mvSheetTable('ATEM', [standard([])], namen).rows
    expect(zeile[4]).toBe(NO_SOURCE)
    expect(zeile[5]).toBe(NO_SOURCE)
  })

  it('sortiert nach Multiviewer-Index', () => {
    const rows = mvSheetTable(
      'ATEM',
      [mv({ index: 1, quadrants: ['big', 'big', 'big', 'big'] }), mv({ index: 0, quadrants: ['big', 'big', 'big', 'big'] })],
      namen,
    ).rows
    expect(rows[0][0]).toBe('ATEM · MV 1')
    expect(rows[4][0]).toBe('ATEM · MV 2')
  })

  it('hat einen eintragbaren Stand', () => {
    expect(typeof DOCUMENT_STANDS['mv-bild']).toBe('function')
  })
})

// ── 3. Der belegte Fehler ──────────────────────────────────────────────────

describe('mvFindings', () => {
  it('meldet zwei Fenster mit derselben Quelle als FEHLER', () => {
    // DER Fall aus `#480`: „MV windows 2 and 3 recall the same source".
    // Fehler und nicht Warnung: zwei gleiche Bilder nebeneinander heissen,
    // dass eine Kamera auf dem Multiviewer gar nicht vorkommt.
    const f = mvFindings(
      [standard([
        { windowIndex: 30, sourceId: 1 },
        { windowIndex: 31, sourceId: 1 },
      ])],
      namen,
    )
    const doppelt = f.find((x) => x.kind === 'duplicate-source')
    expect(doppelt?.severity).toBe('error')
    expect(doppelt?.message).toContain('Kamera 1')
    expect(doppelt?.message).toContain('fehlt')
  })

  it('nennt in der Doppelbelegung BEIDE Positionen', () => {
    // „Zwei Fenster doppelt" schickt niemanden zum richtigen Fenster.
    const f = mvFindings(
      [standard([
        { windowIndex: 30, sourceId: 1 },
        { windowIndex: 31, sourceId: 1 },
      ])],
      namen,
    )
    const m = f.find((x) => x.kind === 'duplicate-source')?.message ?? ''
    expect(m).toContain('Zelle 1')
    expect(m).toContain('Zelle 2')
  })

  it('macht aus dem leeren Fenster nur einen HINWEIS', () => {
    // Ein Aufbau mit weniger Kameras als Fenstern ist der Normalfall.
    const f = mvFindings([standard([])], namen)
    expect(f.every((x) => x.kind === 'empty-window' && x.severity === 'warning')).toBe(true)
  })

  it('ignoriert eine Belegung, die im aktuellen Layout kein Fenster hat', () => {
    // `windowIndex 20` gehoert zum Quadranten oben rechts als KLEINE Zelle.
    // Steht der Quadrant auf „gross", gibt es diese Zelle nicht — und ein
    // Blatt, das sie trotzdem fuehrte, schickte jemanden vor einen Bildteil,
    // den er nicht findet. (Die Zellen-Nummern folgen `mvWindowIndex`:
    // Quadrant 0 -> 10-13, 1 -> 20-23, 2 -> 30-33, 3 -> 40-43.)
    const w = mvWindows(standard([{ windowIndex: 20, sourceId: 1 }]))
    expect(w.every((x) => x.sourceId === undefined)).toBe(true)
  })

  it('meldet die Quelle ohne Rolle', () => {
    const f = mvFindings([standard([{ windowIndex: 0, sourceId: 99 }])], namen)
    expect(f.find((x) => x.kind === 'unknown-source')?.message).toContain('99')
  })

  it('meldet nichts bei einem sauber belegten Bild', () => {
    const voll = mv({
      index: 0,
      quadrants: ['big', 'big', 'big', 'big'],
      windows: [
        { windowIndex: 0, sourceId: 1 },
        { windowIndex: 1, sourceId: 2 },
        { windowIndex: 2, sourceId: 3 },
        { windowIndex: 3, sourceId: 4 },
      ],
    })
    expect(mvFindings([voll], new Map([...namen, [4, 'Kamera 4']]))).toEqual([])
  })
})

// ── 4. Die Bruecke zu den Rollen ───────────────────────────────────────────

describe('sourceNamesFromTallyRows', () => {
  it('nimmt Eingangsnummer -> Rollenname aus der Tally-Karte', () => {
    const m = sourceNamesFromTallyRows([
      { name: 'Kamera 1', switcher: { input: 1 } },
      { name: 'Kamera 2', switcher: { input: 3 } },
    ])
    expect(m.get(1)).toBe('Kamera 1')
    expect(m.get(3)).toBe('Kamera 2')
  })

  it('ueberspringt Rollen ohne Mischer-Eingang', () => {
    // Eine Rolle, die nirgends am Mischer ankommt, hat keine Quell-Nummer —
    // sie zu raten hiesse, dem Blatt einen unpruefbaren Namen zu geben.
    const m = sourceNamesFromTallyRows([{ name: 'Kamera ohne Kabel' }])
    expect(m.size).toBe(0)
  })

  it('laesst bei zwei Rollen auf einem Eingang die erste stehen', () => {
    // Das ist ein Befund der TALLY-Karte und nicht dieses Blatts.
    const m = sourceNamesFromTallyRows([
      { name: 'Erste', switcher: { input: 1 } },
      { name: 'Zweite', switcher: { input: 1 } },
    ])
    expect(m.get(1)).toBe('Erste')
  })
})

describe('multiViewersOf', () => {
  it('liefert eine leere Liste, wo keine Konfiguration steht', () => {
    expect(multiViewersOf({ id: 'x', name: 'X' } as EquipmentItem)).toEqual([])
  })
})

// ── 5. Reinheit und Erreichbarkeit ─────────────────────────────────────────

describe('das Modul und die Oberflaeche', () => {
  it('nimmt keine Uhr, keinen Store und keinen Live-Zustand', () => {
    // Was der Mischer GERADE tut, ist eine Beobachtung. Sie hier einzumischen
    // erzeugte genau die zweite Wahrheit, die ADR-001 sonst verbietet.
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useProjectStore')
    expect(libQuelle).not.toContain('cablePlannerApi')
  })

  it('loest die Namen NICHT selbst auf', () => {
    // Drei handgefuehrte Kopien derselben Eingangs-Karte sind der Kern des
    // Bedarfs. Eine vierte hier waere dieselbe Krankheit.
    expect(libQuelle).not.toContain('roleLabelsByPort')
    expect(libQuelle).not.toContain('deriveLabels')
    expect(libQuelle).toContain('Kommt FERTIG herein')
  })

  it('geht ueber die vorhandene Quadranten-Engstelle', () => {
    expect(libQuelle).toContain('getMvQuadrants(mv)')
  })

  it('ist im Tally-Abschnitt erreichbar — an DERSELBEN Aufloesung', () => {
    expect(dialogQuelle).toMatch(/<MvSheetPanel map=\{map\} \/>/)
    expect(dialogQuelle).toContain('sourceNamesFromTallyRows(map.rows)')
  })
})
