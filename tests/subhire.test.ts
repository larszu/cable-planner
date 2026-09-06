import { describe, expect, it } from 'vitest'
import {
  OWNERSHIP_LABEL,
  isForeign,
  ownershipNote,
  overdueSubhire,
  subhireStatus,
} from '../src/renderer/lib/ownership'
import { derivePackList, packListToText } from '../src/renderer/lib/packList'
import { checkoutSheet, containerContents } from '../src/renderer/lib/containerCheckout'
import { buildLabelSheetHtml, LABEL_SHEETS } from '../src/renderer/lib/labelSheets'
import type { InventoryItem, InventoryUnit, StorageNode } from '../src/renderer/types/inventory'
import inventarQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Fremdes Material traegt bis aufs Blatt (Bedarfe 67 und 82, beide P2).
//
// Bedarf 67 nennt die Aufgabe woertlich:
//
//   > packages/inventory-core ALREADY HAS ownership: owned/rented/subhire plus
//   > supplier — make sure it SURVIVES INTO every printed pack list, case
//   > label and check-in screen.
//
// Genau so war der Stand: `ownership` und `supplier` standen im Modell und im
// Lager-Dialog, und KEINS der drei genannten Blaetter trug sie. Die Packliste
// gruppierte sogar nach Modell allein — eigenes und fremdes Material
// desselben Typs fielen in dieselbe Zeile, die Herkunft war also nicht
// verloren, sondern strukturell nicht darstellbar.
//
// Bedarf 82 sagt, was das kostet: „the failure mode is not losing sub-hire
// gear, IT IS KEEPING IT THREE WEEKS TOO LONG."
// ---------------------------------------------------------------------------

const HEUTE = '2026-09-15'

const item = (over: Partial<InventoryItem>): InventoryItem => ({
  id: 'i1',
  model: 'Sony PMW-F55',
  quantity: 1,
  createdAt: 't',
  updatedAt: 't',
  ...over,
})

const node = (over: Partial<StorageNode>): StorageNode =>
  ({ id: 'n1', name: 'Knoten', kind: 'case', createdAt: 't', updatedAt: 't', ...over }) as StorageNode

const unit = (over: Partial<InventoryUnit>): InventoryUnit =>
  ({
    id: 'u1',
    itemId: 'i1',
    condition: 'ok',
    history: [],
    createdAt: 't',
    updatedAt: 't',
    ...over,
  }) as unknown as InventoryUnit

describe('der Zustand ist benannt, nicht geraten', () => {
  it('eigenes Material hat nichts zurueckzugeben', () => {
    expect(subhireStatus(item({ ownership: 'owned' }), HEUTE)).toBe('owned')
    expect(subhireStatus(item({}), HEUTE)).toBe('owned')
    expect(isForeign(item({}))).toBe(false)
  })

  it('fremd OHNE Datum ist ein eigener Zustand, kein „faellig"', () => {
    // Fremdes Material ohne Termin ist genau das Stueck, das drei Wochen zu
    // lange steht. Es wie terminiertes zu behandeln verschweigt das.
    expect(subhireStatus(item({ ownership: 'subhire' }), HEUTE)).toBe('no-date')
  })

  it('unterscheidet faellig von ueberfaellig', () => {
    expect(subhireStatus(item({ ownership: 'subhire', returnDue: '2026-09-20' }), HEUTE)).toBe('due')
    expect(subhireStatus(item({ ownership: 'subhire', returnDue: '2026-09-14' }), HEUTE)).toBe('overdue')
    // Der Stichtag selbst zaehlt als faellig: an dem Tag muss es raus.
    expect(subhireStatus(item({ ownership: 'subhire', returnDue: HEUTE }), HEUTE)).toBe('overdue')
  })

  it('behandelt „gemietet" wie „Sub-Hire" — beides muss zurueck', () => {
    expect(subhireStatus(item({ ownership: 'rented', returnDue: '2026-09-01' }), HEUTE)).toBe('overdue')
  })
})

describe('der Zusatz, der ueberall mitfaehrt', () => {
  it('ist LEER bei eigenem Material', () => {
    // Stuende in jeder Zeile „Eigen", ginge der Hinweis, auf den es ankommt,
    // darin unter.
    expect(ownershipNote(item({ ownership: 'owned' }), HEUTE)).toBe('')
  })

  it('nennt Art, Lieferant und Datum', () => {
    expect(
      ownershipNote(item({ ownership: 'subhire', supplier: 'Videohaus Meier', returnDue: '2026-09-20' }), HEUTE),
    ).toBe('Sub-Hire · Videohaus Meier · zurueck 2026-09-20')
  })

  it('sagt „zurueck seit", wenn es ueberfaellig ist', () => {
    expect(
      ownershipNote(item({ ownership: 'subhire', supplier: 'Meier', returnDue: '2026-09-10' }), HEUTE),
    ).toBe('Sub-Hire · Meier · zurueck seit 2026-09-10')
  })

  it('nennt den fehlenden Lieferanten, statt ihn wegzulassen', () => {
    // „Es geht zurueck, aber wir wissen nicht wohin" ist die Auskunft, die
    // jemand braucht.
    expect(ownershipNote(item({ ownership: 'subhire', returnDue: '2026-09-20' }), HEUTE)).toBe(
      'Sub-Hire · Lieferant unbekannt · zurueck 2026-09-20',
    )
  })

  it('nennt das fehlende Datum, statt es wegzulassen', () => {
    expect(ownershipNote(item({ ownership: 'rented', supplier: 'Meier' }), HEUTE)).toBe(
      'Gemietet · Meier · kein Rueckgabedatum',
    )
  })

  it('haelt die Etiketten kanonisch deutsch', () => {
    // Dieselbe Regel wie bei `deliveryIssueText`: der Text landet auf einem
    // Blatt, dessen Stand aus seinem Inhalt gerechnet wird.
    expect(OWNERSHIP_LABEL.subhire).toBe('Sub-Hire')
  })
})

describe('die Rueckgabe-Liste', () => {
  const bestand = [
    item({ id: 'a', model: 'A', ownership: 'subhire', supplier: 'Meier', returnDue: '2026-09-10' }),
    item({ id: 'b', model: 'B', ownership: 'subhire', supplier: 'Schmidt', returnDue: '2026-09-01' }),
    item({ id: 'c', model: 'C', ownership: 'rented', supplier: 'Meier' }),
    item({ id: 'd', model: 'D', ownership: 'subhire', returnDue: '2026-09-30' }),
    item({ id: 'e', model: 'E', ownership: 'owned' }),
  ]

  it('fuehrt Ueberfaelliges UND Undatiertes', () => {
    // Das Undatierte wegzulassen waere die bequemere Liste und die falsche.
    expect(overdueSubhire(bestand, HEUTE).map((r) => r.itemId)).toEqual(['b', 'a', 'c'])
  })

  it('setzt das aelteste Datum nach oben', () => {
    // Wer die Liste von oben abarbeitet, spart das meiste Geld.
    expect(overdueSubhire(bestand, HEUTE)[0].returnDue).toBe('2026-09-01')
  })

  it('laesst noch nicht faelliges und eigenes draussen', () => {
    const ids = overdueSubhire(bestand, HEUTE).map((r) => r.itemId)
    expect(ids).not.toContain('d')
    expect(ids).not.toContain('e')
  })

  it('gibt bei sauberem Bestand nichts zurueck', () => {
    expect(overdueSubhire([item({ ownership: 'owned' })], HEUTE)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// DIE DREI BLAETTER, die Bedarf 67 nennt.
// ---------------------------------------------------------------------------
describe('1. die Packliste', () => {
  const nodes = [node({ id: 'c1', name: 'Case 1' })]
  const items = [
    item({ id: 'eigen', quantity: 4, locationId: 'c1' }),
    item({ id: 'fremd', quantity: 2, locationId: 'c1', ownership: 'subhire', supplier: 'Meier', returnDue: '2026-09-20' }),
  ]

  it('trennt eigenes von fremdem Material desselben Modells', () => {
    // Der eigentliche Fehler: die Gruppierung lief ueber den Modellnamen
    // ALLEIN. Vier eigene und zwei sub-gemietete Kameras desselben Typs fielen
    // in EINE Zeile „6x Sony PMW-F55" — die Herkunft war nicht verloren,
    // sondern strukturell nicht darstellbar.
    const list = derivePackList('c1', { items, nodes, units: [] }, HEUTE)
    expect(list[0].items).toEqual([
      { model: 'Sony PMW-F55', qty: 4 },
      { model: 'Sony PMW-F55', qty: 2, ownership: 'Sub-Hire · Meier · zurueck 2026-09-20' },
    ])
  })

  it('summiert gleiche Herkunft weiterhin zusammen', () => {
    const zwei = [
      item({ id: 'f1', quantity: 2, locationId: 'c1', ownership: 'subhire', supplier: 'Meier', returnDue: '2026-09-20' }),
      item({ id: 'f2', quantity: 3, locationId: 'c1', ownership: 'subhire', supplier: 'Meier', returnDue: '2026-09-20' }),
    ]
    const list = derivePackList('c1', { items: zwei, nodes, units: [] }, HEUTE)
    expect(list[0].items).toEqual([
      { model: 'Sony PMW-F55', qty: 5, ownership: 'Sub-Hire · Meier · zurueck 2026-09-20' },
    ])
  })

  it('gibt der Einheit die Herkunft ihres Artikels', () => {
    const list = derivePackList(
      'c1',
      {
        items: [items[1]],
        nodes,
        units: [unit({ id: 'u1', itemId: 'fremd', serial: 'SN-9', locationId: 'c1' })],
      },
      HEUTE,
    )
    expect(list[0].units[0].ownership).toContain('Sub-Hire')
  })

  it('steht auch im kopierbaren Text', () => {
    // Der Text ist das, was jemand in WhatsApp einfuegt — dort darf die
    // Herkunft nicht wegfallen.
    const text = packListToText(derivePackList('c1', { items, nodes, units: [] }, HEUTE))
    expect(text).toContain('[Sub-Hire · Meier · zurueck 2026-09-20]')
  })
})

describe('2. das Etikett', () => {
  it('traegt die Herkunft auf dem Aufkleber', () => {
    // Das Etikett ist die einzige der drei Stellen, die AM OBJEKT klebt.
    const html = buildLabelSheetHtml(
      [{ qrDataUrl: '', code: 'INV-1', title: 'Sony PMW-F55', note: 'Sub-Hire · Meier · zurueck 2026-09-20' }],
      LABEL_SHEETS[0],
    )
    expect(html).toContain('Sub-Hire · Meier')
    expect(html).toContain('class="o"')
  })

  it('laesst eigenes Material ohne Zusatz', () => {
    const html = buildLabelSheetHtml([{ qrDataUrl: '', code: 'INV-1', title: 'Eigen' }], LABEL_SHEETS[0])
    expect(html).not.toContain('class="o"')
  })
})

describe('3. der Ausgabeschein', () => {
  const snap = {
    nodes: [node({ id: 'c1', name: 'Case 1' })],
    items: [
      item({ id: 'fremd', model: 'Funkstrecke', quantity: 2, locationId: 'c1', ownership: 'subhire', supplier: 'Meier', returnDue: '2026-09-20' }),
    ],
    units: [],
  }

  it('friert die Herkunft ein, statt sie beim Anzeigen nachzuschlagen', () => {
    // Aus demselben Grund wie `label`: das Blatt liegt drei Wochen im Truck.
    // Ein inzwischen zurueckgegebener Artikel saehe sonst aus wie eigener —
    // und genau bei der Rueckgabe braucht ihn jemand.
    const lines = containerContents(snap, 'c1', HEUTE)
    expect(lines[0].ownership).toBe('Sub-Hire · Meier · zurueck 2026-09-20')
  })

  it('steht als eigene Spalte auf dem Blatt', () => {
    const record = {
      id: 'r1',
      nodeId: 'c1',
      nodeLabel: 'Case 1',
      out: { at: '2026-09-15T08:00:00Z', to: 'Truck 2' },
      contents: containerContents(snap, 'c1', HEUTE),
    }
    const t = checkoutSheet(record)
    const spalte = t.headers.indexOf('Herkunft')
    expect(spalte).toBeGreaterThan(-1)
    expect(String(t.rows[0][spalte])).toContain('Sub-Hire')
  })

  it('laesst die Spalte bei eigenem Material leer', () => {
    const eigen = { ...snap, items: [item({ id: 'e', locationId: 'c1', ownership: 'owned' })] }
    const lines = containerContents(eigen, 'c1', HEUTE)
    expect(lines[0].ownership).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Ein Datum, das niemand eintragen kann, ist keins.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Lager-Dialog', () => {
  it('laesst das Rueckgabedatum eintragen — nur bei fremdem Material', () => {
    expect(inventarQuelle).toContain("returnDue: form.returnDue?.trim() || undefined")
    expect(inventarQuelle).toContain("form.ownership === 'rented' || form.ownership === 'subhire'")
    expect(inventarQuelle).toContain("t('inventory.returnDue', 'Rückgabe bis')")
  })

  it('zeigt die Rueckgabe-Liste', () => {
    expect(inventarQuelle).toContain('overdueSubhire(items, heuteIso)')
    expect(inventarQuelle).toContain('{rueckgaben.length > 0 && (')
  })

  it('markiert ueberfaellige Positionen in der Tabelle', () => {
    expect(inventarQuelle).toContain("subhireStatus(it, heuteIso) === 'overdue'")
    expect(inventarQuelle).toContain("subhireStatus(it, heuteIso) === 'no-date'")
  })

  it('gibt den Etiketten die Herkunft mit', () => {
    expect(inventarQuelle).toContain('ownershipNote(it, heuteIso)')
    expect(inventarQuelle).toContain('...(e.note ? { note: e.note } : {})')
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'inventory.returnDue',
      'inventory.overdueSince',
      'inventory.noReturnDate',
      'inventory.returnsTitle',
      'inventory.returnOverdue',
      'inventory.returnNoDate',
      'inventory.supplierUnknown',
    ]) {
      expect(inventarQuelle).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
