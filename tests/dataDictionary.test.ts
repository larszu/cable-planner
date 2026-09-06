import { describe, expect, it } from 'vitest'
import {
  COLUMN_GLOSSARY,
  DICTIONARY_MARKER,
  UNDESCRIBED,
  dictionaryBlock,
  dictionaryRows,
  undescribedColumns,
} from '../src/renderer/lib/dataDictionary'
import { csvFromTable } from '../src/renderer/lib/documentStamp'
import { pullListTable } from '../src/renderer/lib/installerLists'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import stampQuelle from '../src/renderer/lib/documentStamp.ts?raw'
import lexikonQuelle from '../src/renderer/lib/dataDictionary.ts?raw'

// ---------------------------------------------------------------------------
// Das Spaltenlexikon (Bedarf 81, erste Haelfte).
//
//   > PMs spend time explaining their own export columns to other people.
//
// Massnahme laut Bedarfs-Datenbank: „Ship a data dictionary alongside every
// export." Der Guard weiter unten macht aus „alongside EVERY export" eine
// Zusicherung statt eines Vorsatzes.
// ---------------------------------------------------------------------------

const eq = (id: string, name: string): EquipmentItem =>
  ({
    id,
    name,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    category: 'Video',
    inputs: [],
    outputs: [],
  }) as never

const cable = (id: string): Cable =>
  ({
    id,
    name: id,
    type: 'sdi',
    length: 10,
    fromDeviceId: 'A',
    toDeviceId: 'B',
    fromPortId: 'A-out',
    toPortId: 'B-in',
    notes: '',
  }) as never

const project = (): CablePlannerProject =>
  ({
    metadata: { name: 'Testanlage', description: '', createdAt: '', updatedAt: '' },
    equipment: [eq('A', 'Kamera 1'), eq('B', 'Switcher')],
    cables: [cable('c1')],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as CablePlannerProject

describe('COLUMN_GLOSSARY — ein Lexikon nach NAMEN, nicht nach Blatt', () => {
  it('erklaert jede Spalte in einem Satz', () => {
    for (const [spalte, text] of Object.entries(COLUMN_GLOSSARY)) {
      expect(text.length, `zu kurz: ${spalte}`).toBeGreaterThan(15)
      expect(text.trim(), `kein Satzende: ${spalte}`).toMatch(/[.!]$/)
    }
  })

  it('nennt bei mehrdeutigen Woertern BEIDE Lesarten', () => {
    // Ein Lexikon nach Namen erzwingt die Frage, ob ein Wort ueberall dasselbe
    // heisst. Wo es das nicht tut, ist die ehrliche Antwort „mal so, mal so"
    // — nicht eine ausgesuchte Lesart, die auf dem anderen Blatt falsch ist.
    for (const spalte of ['Ziel', 'Quelle', 'Art', 'Herkunft']) {
      expect(COLUMN_GLOSSARY[spalte], spalte).toMatch(/je nach|sonst|Auf anderen|Im /)
    }
    // `Vorher`/`Nachher`/`Ausgang` sind erst mit Bedarf 101 und 121
    // mehrdeutig geworden — und die Erklaerung blieb dabei stehen: sie
    // beschrieb weiter NUR den Import-Vergleich, waehrend die Spalte laengst
    // auch auf dem Umbenennungs-Blatt und dem Umbau-Zettel stand. Eine
    // Erklaerung, die etwas anderes beschreibt als die Spalte, ist schlimmer
    // als keine — sie wird geglaubt. Der Guard haelt jetzt fest, dass jede
    // dieser drei Spalten ALLE ihre Lesarten nennt.
    for (const [spalte, lesarten] of [
      ['Vorher', ['Import', 'Zielsystem', 'Ausgang']],
      ['Nachher', ['Import', 'Umbenennung', 'Ausgang']],
      ['Ausgang', ['Pult', 'Router']],
      // Bedarf 125: `Position` heisst auf drei Blaettern drei verschiedene
      // Dinge, und der Eintrag beschrieb lange nur das erste.
      ['Position', ['Listenzeile', 'Kamera-Position', 'Schirm']],
    ] as const) {
      for (const lesart of lesarten) {
        expect(COLUMN_GLOSSARY[spalte], `${spalte} nennt "${lesart}" nicht`).toContain(lesart)
      }
    }
  })

  it('verspricht bei „Stream-Key" ausdruecklich, dass kein Wert darin steht', () => {
    expect(COLUMN_GLOSSARY['Stream-Key']).toMatch(/VERWEIS|nie der Wert/)
    expect(COLUMN_GLOSSARY['Key hinterlegt']).toMatch(/nirgends in der Datei/)
  })

  it('traegt kanonisches Deutsch — sonst aenderte sich jede Datei mit der Sprache', () => {
    expect(lexikonQuelle).not.toContain("t('")
    expect(lexikonQuelle).not.toMatch(/from '\.\/i18n/)
  })
})

describe('dictionaryRows / dictionaryBlock', () => {
  it('gibt nur die Spalten des Blatts, nicht das ganze Lexikon', () => {
    const rows = dictionaryRows(['Kabel', 'Befund'])
    expect(rows).toHaveLength(2)
    expect(rows[0][0]).toBe('Kabel')
  })

  it('nennt eine unbeschriebene Spalte beim Namen statt sie leer zu lassen', () => {
    expect(dictionaryRows(['Voellig Neu'])[0][1]).toBe(UNDESCRIBED)
    expect(undescribedColumns(['Kabel', 'Voellig Neu'])).toEqual(['Voellig Neu'])
  })

  it('fuellt jede Zeile auf die Spaltenzahl auf', () => {
    for (const row of dictionaryBlock(['Kabel', 'Befund'], 5)) {
      expect(row).toHaveLength(5)
    }
  })

  it('faengt mit einer Leerzeile und der Marke an', () => {
    const block = dictionaryBlock(['Kabel'], 1)
    expect(String(block[0][0])).toBe('')
    expect(String(block[1][0])).toBe(DICTIONARY_MARKER)
  })
})

describe('csvFromTable — die Engstelle haengt es an, nicht der Aufrufer', () => {
  it('haengt das Lexikon an JEDEN Export', () => {
    // Waere es Sache des Aufrufers, fehlte es an genau dem Blatt, das der
    // Kunde bekommt.
    const csv = csvFromTable(pullListTable(project()))
    expect(csv).toContain(DICTIONARY_MARKER)
  })

  it('laesst den Stempel die LETZTE Zeile bleiben', () => {
    // Zusicherung seit ADR-004; der Anhang gehoert vor die Fussnote.
    expect(stampQuelle).toMatch(/const rows: CsvCell\[\]\[\] = \[\.\.\.table\.rows, \.\.\.lexikon\]/)
    expect(stampQuelle).toMatch(/if \(stamp\) rows\.push\(csvStampRow/)
  })

  it('laesst sich abschalten — aber nur ausdruecklich', () => {
    const csv = csvFromTable(pullListTable(project()), undefined, undefined, { dictionary: false })
    expect(csv).not.toContain(DICTIONARY_MARKER)
  })

  it('aendert den Dokument-Stand NICHT', async () => {
    // Der Fingerabdruck rechnet ueber `headers`/`rows`, nicht ueber die
    // exportierten Bytes. Ein Lexikon, das ihn veraenderte, meldete jedes
    // gedruckte Exemplar als veraltet.
    const { currentStand } = await import('../src/renderer/lib/documentRegistry')
    const p = project()
    expect(currentStand('pull-liste', p)).toMatch(/^[0-9a-f]{8}$/)
    expect(stampQuelle).toMatch(/documentFingerprint/)
  })
})

// ── Der Guard: keine Spalte ohne Erklaerung ────────────────────────────────

describe('der Guard: jede Spalte, die irgendwo exportiert wird, ist erklaert', () => {
  it('findet keine unbeschriebene Spalte in der ganzen Anwendung', () => {
    // Scannt jede `headers: [...]`-Literalliste im Renderer. Das ist die
    // Zusicherung hinter „alongside every export": wer eine Spalte anlegt,
    // erklaert sie — oder CI faellt. Ein Kommentar an dieser Stelle koennte
    // das nicht; er waere die Vorsatzerklaerung, die der Bedarf beklagt.
    const quellen = import.meta.glob('../src/renderer/**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>
    const gefunden = new Map<string, string>()
    for (const [pfad, src] of Object.entries(quellen)) {
      if (pfad.includes('/lib/dataDictionary.ts')) continue
      // Zwei Formen, und die zweite fehlte: `headers: [...]` direkt am Objekt
      // UND `const X_HEADERS = [...]`, das erst per Spread hineingeht. Die
      // zweite war fuer den Scan unsichtbar — der Spread traegt keine
      // String-Literale —, und damit war jedes Blatt unsichtbar, dessen
      // Spalten aus einer Konstanten kommen. Gefunden beim Anlegen von
      // `PRE_SHOW_HEADERS` (Bedarf 105).
      const listen = [
        ...src.matchAll(/headers:\s*\[([\s\S]*?)\]/g),
        ...src.matchAll(/_HEADERS(?::[^=]*)?\s*=\s*\[([\s\S]*?)\]/g),
      ]
      for (const m of listen) {
        for (const s of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
          const spalte = s[1].replace(/\\'/g, "'")
          if (!gefunden.has(spalte)) gefunden.set(spalte, pfad)
        }
      }
    }
    // Der Scan selbst muss etwas finden — sonst prueft dieser Test nichts und
    // sieht trotzdem gruen aus.
    expect(gefunden.size).toBeGreaterThan(100)
    const fehlend = [...gefunden]
      .filter(([spalte]) => !(spalte in COLUMN_GLOSSARY))
      .map(([spalte, pfad]) => `${spalte} (${pfad})`)
    expect(fehlend, `Spalten ohne Lexikon-Eintrag: ${fehlend.join(', ')}`).toEqual([])
  })
})
