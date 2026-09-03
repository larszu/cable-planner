import { describe, expect, it } from 'vitest'
import {
  CABLE_FIELD_CLASS,
  EQUIPMENT_FIELD_CLASS,
  ITEMISED_SECTIONS,
  planDiff,
  planDiffCsv,
  planDiffSummary,
  planDiffTable,
} from '../src/renderer/lib/planDiff'
import { planFingerprint } from '../src/renderer/lib/documentStamp'
import { topLevelKeys } from './support/topLevelKeys'
import cableTypesSrc from '../src/renderer/types/cable.ts?raw'
import equipmentTypesSrc from '../src/renderer/types/equipment.ts?raw'
import projectTypesSrc from '../src/renderer/types/project.ts?raw'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// Roadmap-Initiative 5, Inkrement 2 — zwei Plan-Staende gegeneinander.
//
// Die Tests unten teilen sich in zwei Sorten, und die zweite ist die
// wichtigere:
//
//   * Verhalten — was der Vergleich fuer eine bestimmte Aenderung sagt.
//   * VOLLSTAENDIGKEIT — dass kein Feld und kein Projekt-Bereich stillschweigend
//     durchfaellt. Das ist der eigentliche Gegenstand: ein Vergleich, der 138
//     von 146 Feldern ignoriert und dazu „keine Aenderung" sagt, ist gefaehrlich
//     und nicht bloss unvollstaendig. Die Guards lesen die Feldnamen zur
//     LAUFZEIT aus den Typ-Dateien, damit ein neues Feld den Test bricht,
//     statt still unklassifiziert zu bleiben.

const eq = (id: string, name: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id,
    name,
    category: 'Sonstiges',
    inputs: [{ id: `${id}-in`, name: 'IN 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: `${id}-out`, name: 'OUT 1', type: 'port', connectorType: 'BNC' }],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...over,
  }) as unknown as EquipmentItem

const cable = (id: string, over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: `Kabel ${id}`,
    type: 'SDI',
    length: 10,
    color: '#fff',
    fromEquipmentId: 'A',
    fromPortId: 'A-out',
    toEquipmentId: 'B',
    toPortId: 'B-in',
    notes: '',
    ...over,
  }) as Cable

const project = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Testanlage', description: '', createdAt: '', updatedAt: '' },
    equipment: [eq('A', 'Kamera 1'), eq('B', 'Switcher')],
    cables: [cable('c1')],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

const fieldOf = (diff: ReturnType<typeof planDiff>, id: string, field: string) =>
  diff.entities.find((e) => e.id === id)?.fields.find((f) => f.field === field)

describe('planDiff — Verhalten', () => {
  it('nennt keinen Unterschied, wenn beide Staende gleich sind', () => {
    const p = project()
    const diff = planDiff(p, p)
    expect(diff.entities).toEqual([])
    expect(diff.sections).toEqual([])
    expect(diff.unclassified).toEqual([])
    expect(planDiffSummary(diff)).toBe('kein Unterschied')
  })

  it('trennt inhaltliche von blossen Darstellungs-Aenderungen', () => {
    const before = project()
    const after = project({
      cables: [cable('c1', { length: 25, color: '#f00' })],
    })
    const diff = planDiff(before, after)
    expect(fieldOf(diff, 'c1', 'length')).toEqual({
      field: 'length',
      klass: 'substantive',
      before: '10',
      after: '25',
    })
    expect(fieldOf(diff, 'c1', 'color')?.klass).toBe('cosmetic')
    expect(diff.substantive).toBe(1)
    expect(diff.cosmetic).toBe(1)
    expect(planDiffSummary(diff)).toBe('1 inhaltlich, 1 nur Darstellung')
  })

  it('meldet die Aenderung eines Passworts, ohne einen der Werte zu zeigen', () => {
    // Der Grund, warum dieser Test existiert: `username`/`password` stehen im
    // Projekt-File. Ein Vergleich, der Werte druckt, haette sie auf das Blatt
    // geschrieben — und das Blatt liegt in einer Halle mit Fremdfirmen.
    const before = project({ equipment: [eq('A', 'Switch', { password: 'altes-geheimnis' })] })
    const after = project({ equipment: [eq('A', 'Switch', { password: 'neues-geheimnis' })] })
    const diff = planDiff(before, after)
    const change = fieldOf(diff, 'A', 'password')
    expect(change).toEqual({ field: 'password', klass: 'sensitive' })
    expect(JSON.stringify(diff)).not.toContain('geheimnis')
    // Sie zaehlt trotzdem als inhaltliche Aenderung — verschwiegen wird sie nicht.
    expect(diff.substantive).toBe(1)
  })

  it('zeigt bei Listen und Objekten nur die Form, nicht den Inhalt', () => {
    const before = project({ equipment: [eq('A', 'Kamera 1')] })
    const after = project({
      equipment: [
        eq('A', 'Kamera 1', {
          inputs: [
            { id: 'A-in', name: 'IN 1', type: 'port', connectorType: 'BNC' },
            { id: 'A-in2', name: 'IN 2', type: 'port', connectorType: 'BNC' },
          ],
        } as unknown as Partial<EquipmentItem>),
      ],
    })
    const diff = planDiff(before, after)
    expect(fieldOf(diff, 'A', 'inputs')).toEqual({
      field: 'inputs',
      klass: 'substantive',
      before: 'Liste (1)',
      after: 'Liste (2)',
    })
  })

  it('fuehrt Ab- und Zugang getrennt und gibt den Neuanlage-Hinweis als Hinweis', () => {
    // Gleicher Name, andere id: fast immer „geloescht und neu angelegt", aber
    // eben nicht immer. Der Vergleich fuehrt beide Eintraege und sagt daneben,
    // dass er es nicht unterscheiden kann.
    const before = project({ equipment: [eq('alt', 'Kamera 1')] })
    const after = project({ equipment: [eq('neu', 'Kamera 1')] })
    const diff = planDiff(before, after)
    expect(diff.entities.map((e) => [e.change, e.id])).toEqual([
      ['removed', 'alt'],
      ['added', 'neu'],
    ])
    expect(diff.recreationHints).toEqual(['Kamera 1'])
  })

  it('gibt keinen Hinweis, wenn Ab- und Zugang verschiedene Namen tragen', () => {
    const before = project({ equipment: [eq('alt', 'Kamera 1')] })
    const after = project({ equipment: [eq('neu', 'Kamera 2')] })
    expect(planDiff(before, after).recreationHints).toEqual([])
  })

  it('nennt nicht aufgeschluesselte Bereiche grob, statt sie zu verschweigen', () => {
    const before = project()
    const after = project({
      metadata: {
        name: 'Testanlage',
        description: '',
        createdAt: '',
        updatedAt: '2026-09-03T10:00:00Z',
        revision: 'B',
      },
      locations: [{ id: 'L1', name: 'Halle' }] as unknown as CablePlannerProject['locations'],
    })
    const diff = planDiff(before, after)
    expect(diff.sections).toEqual([
      { section: 'locations', detail: '0 -> 1 Eintraege' },
      { section: 'metadata', detail: 'revision, updatedAt' },
    ])
    // Der Metadaten-Bereich nennt die geaenderten Schluessel, damit
    // „nur der Speicher-Zeitstempel" von „die Revision wurde
    // festgeschrieben" unterscheidbar bleibt.
  })

  it('meldet ein unklassifiziertes Feld als Aenderung, aber ohne Werte', () => {
    // Der Fall, den der Guard weiter unten verhindern soll — hier wird
    // geprueft, dass er zur Laufzeit trotzdem sicher endet: sichtbar
    // (`substantive`), benannt (`unclassified`) und ohne Wert, weil niemand
    // weiss, ob in einem unbekannten Feld ein Geheimnis steht.
    const before = project({
      equipment: [eq('A', 'Kamera 1', { erfundenesFeld: 'alt' } as unknown as Partial<EquipmentItem>)],
    })
    const after = project({
      equipment: [eq('A', 'Kamera 1', { erfundenesFeld: 'neu' } as unknown as Partial<EquipmentItem>)],
    })
    const diff = planDiff(before, after)
    expect(diff.unclassified).toEqual(['erfundenesFeld'])
    expect(fieldOf(diff, 'A', 'erfundenesFeld')).toEqual({
      field: 'erfundenesFeld',
      klass: 'substantive',
    })
    expect(JSON.stringify(diff)).not.toContain('"alt"')
    expect(planDiffSummary(diff)).toContain('1 unklassifizierte Felder')
  })

  it('meldet keine Aenderung, wenn nur die Schluessel-Reihenfolge abweicht', () => {
    // Zwei Dateien, von verschiedenen Code-Pfaden geschrieben, koennen
    // dieselben Werte in anderer Reihenfolge serialisieren. Ein
    // JSON.stringify-Vergleich haette hier jede Zeile als geaendert gemeldet.
    const before = project({
      equipment: [eq('A', 'Kamera 1', { categoryProps: { a: '1', b: '2' } })],
    })
    const after = project({
      equipment: [eq('A', 'Kamera 1', { categoryProps: { b: '2', a: '1' } })],
    })
    expect(planDiff(before, after).entities).toEqual([])
  })

  it('behandelt ein fehlendes Feld und ein undefined-Feld als dieselbe Aussage', () => {
    // `undefined` heisst „keine Angabe" — genau das, was ein fehlender
    // Schluessel auch sagt. Das auseinanderzuhalten wuerde jede aeltere Datei
    // als geaendert ausweisen.
    const before = project({ equipment: [eq('A', 'Kamera 1')] })
    const after = project({
      equipment: [eq('A', 'Kamera 1', { shortName: undefined })],
    })
    expect(planDiff(before, after).entities).toEqual([])
  })
})

describe('planDiff — Vollstaendigkeit (die eigentliche Pruefung)', () => {
  it('klassifiziert jedes Feld von Cable, und keines zuviel', () => {
    const declared = Object.keys(CABLE_FIELD_CLASS).sort()
    expect(declared).toEqual(topLevelKeys(cableTypesSrc, 'Cable'))
  })

  it('klassifiziert jedes Feld von EquipmentItem, und keines zuviel', () => {
    const declared = Object.keys(EQUIPMENT_FIELD_CLASS).sort()
    expect(declared).toEqual(topLevelKeys(equipmentTypesSrc, 'EquipmentItem'))
  })

  it('behandelt jeden Projekt-Schluessel entweder aufgeschluesselt oder grob', () => {
    // Der Guard auf Projekt-Ebene. `sections` entsteht zur Laufzeit aus den
    // tatsaechlich vorhandenen Schluesseln, deshalb kann hier nichts
    // durchfallen — dieser Test haelt fest, dass das so BLEIBT, wenn jemand
    // spaeter auf eine feste Liste umstellt.
    const projectKeys = topLevelKeys(projectTypesSrc, 'CablePlannerProject')
    const itemised = [...ITEMISED_SECTIONS]
    for (const key of itemised) expect(projectKeys).toContain(key)

    // Jeder nicht aufgeschluesselte Schluessel muss sich als Bereich melden,
    // wenn er sich aendert. Gemessen statt behauptet: einmal je Schluessel.
    const rest = projectKeys.filter((k) => !itemised.includes(k as (typeof ITEMISED_SECTIONS)[number]))
    for (const key of rest) {
      const before = project()
      const after = project({ [key]: 'geaendert' } as unknown as Partial<CablePlannerProject>)
      const diff = planDiff(before, after)
      expect(
        diff.sections.map((s) => s.section),
        `Schluessel ${key} wurde verschwiegen`,
      ).toContain(key)
    }
    expect(rest.length).toBeGreaterThan(0)
  })

  it('kennt genau die fuenf Klassen, und jede wird auch benutzt', () => {
    // Eine Klasse, die niemand traegt, ist eine Behauptung ohne Deckung.
    const used = new Set([
      ...Object.values(CABLE_FIELD_CLASS),
      ...Object.values(EQUIPMENT_FIELD_CLASS),
    ])
    expect([...used].sort()).toEqual([
      'bookkeeping',
      'cosmetic',
      'identity',
      'sensitive',
      'substantive',
    ])
  })

  it('fuehrt genau die Felder als sensitive, die Zugangsdaten sind', () => {
    // Diese Liste hier festzunageln ist der Punkt: kommt ein drittes
    // Geheimnis-Feld ins Modell, faellt zuerst der Vollstaendigkeits-Guard
    // oben — und wer es dann falsch einordnet, faellt hier.
    const sensitive = Object.entries(EQUIPMENT_FIELD_CLASS)
      .filter(([, klass]) => klass === 'sensitive')
      .map(([field]) => field)
      .sort()
    expect(sensitive).toEqual(['password', 'username'])
    expect(Object.values(CABLE_FIELD_CLASS)).not.toContain('sensitive')
  })
})

describe('topLevelKeys — das Werkzeug der Guards', () => {
  it('liest auch Felder mit mehrzeiligem Objekt-Typ', () => {
    // Der gemessene Fehler des ersten Anlaufs: genau diese drei fehlten.
    const keys = topLevelKeys(equipmentTypesSrc, 'EquipmentItem')
    expect(keys).toContain('libraryRef')
    expect(keys).toContain('rackInternalSnapshot')
    expect(keys).toContain('atemMvCapabilitiesOverride')
  })

  it('faellt bei einem unbekannten Interface statt eine leere Menge zu liefern', () => {
    expect(() => topLevelKeys(cableTypesSrc, 'GibtEsNicht')).toThrow(/nicht im Quelltext/)
  })

  it('faellt bei extends statt es stillschweigend zu ignorieren', () => {
    const src = 'export interface A extends B { x: string }'
    expect(() => topLevelKeys(src, 'A')).toThrow(/extends/)
  })

  it('faellt bei doppelten Feldnamen statt sie zu vereinigen', () => {
    const src = 'export interface A {\n  x: string\n  x: number\n}'
    expect(() => topLevelKeys(src, 'A')).toThrow(/doppelte Felder/)
  })
})

describe('planDiffTable — der Vergleich auf Papier', () => {
  it('traegt BEIDE Plan-Staende, nicht einen Stempel', () => {
    // ADR-004 sagt: der Stand gehoert auf das Blatt. Ein Vergleich hat zwei
    // Staende, also stehen beide drauf — ein `DocumentStamp` koennte nur
    // einen davon nennen und waere damit die halbe Wahrheit.
    const before = project()
    const after = project({ cables: [cable('c1', { length: 25 })] })
    const table = planDiffTable(before, after)
    expect(table.rows[0]).toEqual(['Stand', 'vorher', planFingerprint(before), '', '', '', ''])
    expect(table.rows[1]).toEqual(['Stand', 'nachher', planFingerprint(after), '', '', '', ''])
  })

  it('schreibt kein Passwort auf das Blatt', () => {
    const before = project({ equipment: [eq('A', 'Switch', { password: 'altes-geheimnis' })] })
    const after = project({ equipment: [eq('A', 'Switch', { password: 'neues-geheimnis' })] })
    const csv = planDiffCsv(before, after)
    expect(csv).not.toContain('geheimnis')
    // Die Aenderung selbst steht sehr wohl drauf.
    expect(csv).toContain('password')
    expect(csv).toContain('Zugangsdaten')
  })

  it('nimmt auch die unangenehmen Listen mit auf das Blatt', () => {
    // Ein Blatt, das nur die schoenen Zeilen zeigt, ist der Fehler, gegen den
    // die ganze Ableitung geschrieben ist. Alle drei Warn-Sorten in einem
    // Fall: nicht aufgeschluesselter Bereich, Neuanlage-Hinweis,
    // unklassifiziertes Feld.
    // Der Neuanlage-Hinweis braucht ein Paar mit verschiedenen ids, das
    // unklassifizierte Feld dagegen ein Geraet, das in BEIDEN Staenden steht:
    // bei Ab- und Zugang werden gar keine Felder verglichen (und darum auch
    // keine Werte gezeigt).
    const before = project({
      equipment: [
        eq('A', 'Kamera 1', { erfundenesFeld: 'x' } as unknown as Partial<EquipmentItem>),
        eq('alt', 'Switcher'),
      ],
    })
    const after = project({
      equipment: [
        eq('A', 'Kamera 1', { erfundenesFeld: 'y' } as unknown as Partial<EquipmentItem>),
        eq('neu', 'Switcher'),
      ],
      locations: [{ id: 'L1', name: 'Halle' }] as unknown as CablePlannerProject['locations'],
    })
    const csv = planDiffCsv(before, after)
    expect(csv).toContain('nicht aufgeschluesselt')
    expect(csv).toContain('locations')
    expect(csv).toContain('gleicher Name in Ab- und Zugang')
    expect(csv).toContain('Feld ohne Klassifizierung')
    expect(csv).toContain('erfundenesFeld')
  })

  it('zeigt einen Ab- oder Zugang als eine Zeile ohne Feld-Spalten', () => {
    const before = project({ equipment: [eq('A', 'Kamera 1'), eq('B', 'Switcher')] })
    const after = project({ equipment: [eq('A', 'Kamera 1')] })
    const rows = planDiffTable(before, after).rows.filter((r) => r[0] === 'entfaellt')
    expect(rows).toEqual([['entfaellt', 'Geraet', 'Switcher', '', '', '', '']])
  })
})
