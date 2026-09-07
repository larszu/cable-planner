import { describe, expect, it } from 'vitest'
import { committedByItem, commitmentNote } from '../src/renderer/lager/lib/inventoryCommitment'
import { resolveCoverage } from '../src/renderer/lager/lib/inventoryCoverage'
import { buildPlanBom, pickListCsv, planBomCsv } from '../src/renderer/lager/lib/planBom'
import type { CheckoutRecord } from '../src/renderer/lager/types/checkout'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { InventoryItem, InventoryUnit, StorageNode } from '../src/renderer/lager/types/inventory'
import exportQuelle from '../src/renderer/components/Export/ExportDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// „Bestand" ist nicht „verfuegbar" (Bedarf 80, P2).
//
//   > A number meaning 'stock' is read as a number meaning 'available'. […]
//   > THE PM PROMISES GEAR THEY DO NOT HAVE.
//
// Belegt mit sechs unabhaengigen Fehlern von vier Meldern ueber fuenfzehn
// Monate. Die Entwurfsregel dazu, woertlich: „every quantity carries its
// availability qualifier in the same glyph run […] and conflicts are labelled
// ON THE OBJECT THAT HAS THEM, never announced as a disabled button."
//
// Seit `cable#707` weiss diese Anwendung, welcher Container gerade draussen
// ist und was drin war. `resolveCoverage` wusste davon nichts: sein
// `available` war der Lagerbestand und zaehlte Technik mit, die physisch auf
// einer anderen Show stand.
// ---------------------------------------------------------------------------

const TYP = 'eb02ca7e-856c-40ab-9a73-d1e98110f003'
const MODELL = 'Sony PMW-F55'

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Kameras',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: 'i1',
  model: MODELL,
  quantity: 1,
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

const unit = (id: string, itemId: string) =>
  ({ id, itemId, condition: 'ok', history: [], createdAt: 't', updatedAt: 't' }) as unknown as InventoryUnit

const NODES: StorageNode[] = [
  { id: 'depot', name: 'Depot', kind: 'depot', createdAt: 't', updatedAt: 't' } as StorageNode,
  { id: 'c1', name: 'Case 1', kind: 'case', parentId: 'depot', createdAt: 't', updatedAt: 't' } as StorageNode,
]

const plan = (n: number) => Array.from({ length: n }, (_, i) => eq({ id: `e${i}`, deviceTypeId: TYP }))
const lager = (n: number) => [item({ id: 'i1', quantity: n, deviceTypeId: TYP, locationId: 'c1' })]

const ausgabe = (over: Partial<CheckoutRecord> = {}): CheckoutRecord => ({
  id: 'r1',
  nodeId: 'c1',
  nodeLabel: 'Case 1',
  out: { at: '2026-09-01T08:00:00Z', to: 'Truck 2', projectName: 'Show B' },
  contents: [{ kind: 'item', refId: 'i1', label: MODELL, quantity: 2 }],
  ...over,
})

describe('was draussen ist, zaehlt nicht zum Verfuegbaren', () => {
  it('fuenf im Lager, zwei auf einer offenen Ausgabe: drei verfuegbar', () => {
    const res = resolveCoverage(plan(5), lager(5), [], [], [ausgabe()])
    expect(res.lines[0]).toMatchObject({ stock: 5, committed: 2, available: 3 })
  })

  it('die Fehlmenge zaehlt gegen das VERFUEGBARE, nicht gegen den Bestand', () => {
    // Genau der Satz aus dem Befund: sonst meldet die Liste „gedeckt" fuer
    // Technik, die auf einer anderen Show steht.
    const res = resolveCoverage(plan(5), lager(5), [], [], [ausgabe()])
    expect(res.lines[0].short).toBe(2)
  })

  it('ein zurueckgebuchter Vorgang bindet nichts mehr', () => {
    const zurueck = ausgabe({ in: { at: '2026-09-02T08:00:00Z', missing: [], extra: [] } })
    const res = resolveCoverage(plan(5), lager(5), [], [], [zurueck])
    expect(res.lines[0]).toMatchObject({ stock: 5, available: 5 })
    expect(res.lines[0].committed).toBeUndefined()
  })

  it('ohne Ausgabe-Register bleibt alles wie vorher', () => {
    // Der ehrliche Rueckfall fuer Aufrufer ohne Register (Mobile, Viewer).
    const res = resolveCoverage(plan(5), lager(5))
    expect(res.lines[0]).toMatchObject({ stock: 5, available: 5 })
  })
})

describe('die drei Fallstricke des Zaehlens', () => {
  it('zaehlt den Inhalt eines verschachtelten Cases NICHT doppelt', () => {
    // Eine Ausgabe fuehrt das Case im Case als eigene Zeile UND seinen Inhalt
    // einzeln (Bedarf 15). Wer die `node`-Zeile mitzaehlt, zaehlt zweimal.
    const m = committedByItem([
      ausgabe({
        contents: [
          { kind: 'node', refId: 'c2', label: 'Case 2', quantity: 1 },
          { kind: 'item', refId: 'i1', label: MODELL, quantity: 2 },
        ],
      }),
    ])
    expect(m.get('i1')?.quantity).toBe(2)
    expect(m.get('c2')).toBeUndefined()
  })

  it('loest eine ausgegebene EINHEIT auf ihren Artikel auf', () => {
    // Die Zeile traegt die Id der Einheit, nicht die des Artikels — das ist
    // Absicht („children keep their own ERP identities"). Ohne die Aufloesung
    // mindert eine ausgegebene Funkstrecke den Bestand ihres Modells nicht.
    const m = committedByItem(
      [ausgabe({ contents: [{ kind: 'unit', refId: 'u1', label: 'SN-1', quantity: 1 }] })],
      [unit('u1', 'i1')],
    )
    expect(m.get('i1')?.quantity).toBe(1)
  })

  it('geht nicht unter null, wenn mehr draussen ist als im Bestand', () => {
    // Widerspruechlicher Datenstand (jemand hat den Artikel nach der Ausgabe
    // reduziert). „Nichts verfuegbar" ist die richtige Antwort.
    const res = resolveCoverage(plan(1), lager(1), [], [], [
      ausgabe({ contents: [{ kind: 'item', refId: 'i1', label: MODELL, quantity: 9 }] }),
    ])
    expect(res.lines[0].available).toBe(0)
    expect(res.lines[0].committed).toBe(1)
  })
})

describe('der Konflikt steht am Objekt, das ihn hat', () => {
  it('nennt Menge und Ziel, nicht nur eine Zahl', () => {
    // „never announced as a disabled button": erst der Vorgang sagt, WOHIN —
    // und nur damit kann jemand entscheiden, ob er zurueckholt oder umplant.
    const res = resolveCoverage(plan(5), lager(5), [], [], [ausgabe()])
    expect(res.lines[0].commitmentNote).toBe('2 auf offener Ausgabe (2× Show B)')
  })

  it('faellt auf den Container zurueck, wenn keine Show benannt ist', () => {
    const ohneShow = ausgabe({ out: { at: 't', to: 'Truck 2' } })
    expect(commitmentNote(committedByItem([ohneShow]).get('i1'))).toBe(
      '2 auf offener Ausgabe (2× Case 1)',
    )
  })

  it('fasst mehrere Vorgaenge zusammen, ohne einen zu verschweigen', () => {
    const m = committedByItem([
      ausgabe(),
      ausgabe({ id: 'r2', out: { at: 't', to: 'Truck 3', projectName: 'Show C' } }),
    ])
    expect(m.get('i1')?.quantity).toBe(4)
    expect(commitmentNote(m.get('i1'))).toBe('4 auf offener Ausgabe (2× Show B, 2× Show C)')
  })

  it('ohne Bindung gibt es keinen Text', () => {
    expect(commitmentNote(undefined)).toBe('')
  })
})

describe('das Blatt zeigt beide Zahlen', () => {
  it('die CSV hat Bestand UND Verfügbar nebeneinander', () => {
    // Eine einzige Spalte „Bestand" liest jeder als „so viel kann ich
    // einplanen" — daran haengt der ganze Befund.
    const bom = buildPlanBom(plan(5), lager(5), NODES, [], [], [ausgabe()])
    const zeilen = planBomCsv(bom).split('\r\n')
    expect(zeilen[0]).toContain('Bestand;Verfügbar;Auf offener Ausgabe')
    expect(zeilen[1]).toContain('5;3;2 auf offener Ausgabe')
  })

  it('die Kommissionier-Liste nennt ihre vierte Spalte nach dem, was drin steht', () => {
    // Sie hiess „Bestand" und trug `available` — also die Zahl, aus der
    // offene Ausgaben und unbrauchbare Einheiten schon herausgerechnet sind.
    // Genau die Verwechslung, gegen die Bedarf 80 in der Stueckliste die
    // zweite Spalte eingezogen hat: wer „Bestand 3" liest, plant mit 3,
    // obwohl zwei davon auf einem Truck stehen. Aufgefallen ist es erst, als
    // der Lexikon-Guard auch die positionell an `toCsv` uebergebenen Spalten
    // gesehen hat.
    const bom = buildPlanBom(plan(5), lager(5), NODES, [], [], [ausgabe()])
    const zeilen = pickListCsv(bom).split('\r\n')
    const spalten = zeilen[0].replace(/^\ufeff/, '').split(';')
    expect(spalten[3]).toBe('Verfügbar')
    // Lager 5, davon 2 auf offener Ausgabe: die Zeile nennt 3, nicht 5.
    const ortszeile = zeilen.slice(1).find((z) => z.startsWith('Depot'))
    expect(ortszeile?.split(';')[3]).toBe('3')
  })

  it('die Zeile gilt als fehlend, obwohl der Bestand reicht', () => {
    const bom = buildPlanBom(plan(5), lager(5), NODES, [], [], [ausgabe()])
    expect(bom.missing).toHaveLength(1)
  })

  it('die Kommissionier-Liste nennt den GRUND der Fehlmenge (Bedarf 64)', () => {
    // „which job holds it": ohne diesen Hinweis sucht der Kommissionierer das
    // fehlende Stueck im Regal, obwohl es auf einem Truck steht. Seit
    // Bedarf 80 weiss die Zeile es -- sie hat es nur nicht gesagt.
    const bom = buildPlanBom(plan(5), lager(5), NODES, [], [], [ausgabe()])
    const zeilen = pickListCsv(bom).split('\r\n')
    expect(zeilen[0]).toContain('Fehlmenge;Grund')
    const fehl = zeilen.find((z) => z.startsWith(';0;'))
    expect(fehl).toContain('2 auf offener Ausgabe (2× Show B)')
  })

  it('laesst die Spalte leer, wenn nichts gebunden ist', () => {
    // Ein Grund, der immer dasteht, ist keiner.
    const bom = buildPlanBom(plan(9), lager(5), NODES)
    const fehl = pickListCsv(bom).split('\r\n').find((z) => z.startsWith(';0;'))
    expect(fehl?.endsWith(';')).toBe(true)
  })

  it('setzt den Grund NUR auf die Fehlmengen-Zeile', () => {
    // Auf einer Entnahme-Zeile waere er falsch: was dort steht, ist DA. Die
    // erste Fassung dieser Pruefung sah nur den Fall ohne Bindung -- eine
    // Gegenprobe, die den Grund auf jede Zeile schrieb, blieb gruen.
    const bom = buildPlanBom(plan(5), lager(5), NODES, [], [], [ausgabe()])
    const zeilen = pickListCsv(bom).split('\r\n').slice(1).filter(Boolean)
    const entnahme = zeilen.filter((z) => !z.startsWith(';0;'))
    expect(entnahme.length).toBeGreaterThan(0)
    for (const z of entnahme) expect(z.endsWith(';')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Eine ehrliche Zahl, die kein Fenster zeigt, ist keine.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Export-Dialog', () => {
  it('reicht die offenen Ausgaben in die Rechnung durch', () => {
    // Der Weg fuehrt seit ADR-006 durch den Lager-Vertrag; die Ausgaben
    // kommen weiterhin aus dem Lager und nicht aus dem Projektfile.
    expect(exportQuelle).toContain("from '../../lager'")
    expect(exportQuelle).toContain('const checkoutRecords = useAusgaben()')
    expect(exportQuelle).toContain('buildPlanBom(equipment, items, nodes, units, zusatz, checkoutRecords)')
    // Ohne die Abhaengigkeit rechnet das Memo nach einer Ausgabe nicht neu.
    expect(exportQuelle).toContain('[equipment, items, nodes, units, zusatz, checkoutRecords]')
  })

  it('zeigt die Qualifizierung NEBEN der Zahl', () => {
    // „in the same glyph run", nicht in einer Fussnote und nicht nur im
    // Tooltip: der Tooltip traegt zusaetzlich die Vorgaenge.
    expect(exportQuelle).toContain("t('export.devicebom.committed'")
    expect(exportQuelle).toContain('title={row.commitmentNote}')
    expect(dictsQuelle).toContain("'export.devicebom.committed'")
  })
})
