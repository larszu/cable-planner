import { describe, expect, it } from 'vitest'
import { AUDIT_LABEL, auditRelocations, auditScan, auditTable } from '../src/renderer/lib/inventoryAudit'
import type { InventoryItem, InventoryUnit, StorageNode } from '../src/renderer/types/inventory'
import inventarQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Inventur mit „am falschen Ort" als eigenem Ergebnis (Bedarf 66, P2 — plus
// die Restreibung aus Bedarf 69).
//
//   > Bulk audit by scanning shows only green (in database) / red (not in
//   > database). No model, no location, no wrong-place flag — so the audit
//   > finds nothing actionable, and IN AN AV WAREHOUSE WRONG-PLACE IS THE
//   > NORMAL OUTCOME OF EVERY LOAD-OUT.
//
//   > the result row must carry expected-vs-actual location and RECORD THE
//   > ACTUAL ONE.
//
// Beleg: grokability/snipe-it#8095 (2020-05, offen, zuletzt 2025-06).
//
// Zwei Farben beantworten die Frage nicht, die im Lager gestellt wird: fast
// alles ist im Bestand. Die Frage ist, ob es DA ist.
// ---------------------------------------------------------------------------

const zeit = '2026-09-06T10:00:00.000Z'
const node = (id: string, name: string, parentId?: string, code?: string): StorageNode =>
  ({ id, name, kind: 'shelf', parentId, code, createdAt: zeit, updatedAt: zeit }) as StorageNode
const item = (id: string, model: string, locationId?: string, code?: string): InventoryItem =>
  ({ id, model, quantity: 1, locationId, code, createdAt: zeit, updatedAt: zeit }) as InventoryItem
const unit = (id: string, itemId: string, locationId?: string, code?: string): InventoryUnit =>
  ({ id, itemId, serial: `SN-${id}`, locationId, code, condition: 'ok', history: [], createdAt: zeit, updatedAt: zeit }) as unknown as InventoryUnit

const lager = () => ({
  nodes: [
    node('a3', 'Regal A3'),
    node('c1', 'Case 1', 'a3', 'CASE-1'),
    node('b1', 'Regal B1'),
  ],
  items: [
    item('hier', 'Klettband', 'a3', 'ITM-HIER'),
    item('imcase', 'Gaffa', 'c1', 'ITM-CASE'),
    item('woanders', 'Stativ', 'b1', 'ITM-WEG'),
    item('ohneort', 'Adapter', undefined, 'ITM-LOS'),
  ],
  units: [unit('u1', 'hier', 'b1', 'UNIT-1')],
})

describe('vier benannte Ergebnisse statt zwei Farben', () => {
  it('erkennt, was am erwarteten Ort liegt', () => {
    expect(auditScan('ITM-HIER', 'a3', lager()).outcome).toBe('expected-here')
  })

  it('zaehlt den Inhalt eines Behaelters am Ort MIT', () => {
    // Wer vor Regal A3 steht und etwas aus Case 1 in A3 scannt, hat es am
    // richtigen Ort. Eine Inventur ohne Teilbaum meldete jedes eingepackte
    // Objekt als verstellt — und waere damit nach dem ersten Case wertlos.
    expect(auditScan('ITM-CASE', 'a3', lager()).outcome).toBe('expected-here')
  })

  it('meldet den falschen Ort UND wo es erwartet wurde', () => {
    const h = auditScan('ITM-WEG', 'a3', lager())
    expect(h.outcome).toBe('wrong-place')
    expect(h.expected).toBe('Regal B1')
    // Der Beleg verlangt das Modell ausdruecklich in der Ergebniszeile.
    expect(h.model).toBe('Stativ')
  })

  it('unterscheidet „ohne Lagerort" von „falscher Ort"', () => {
    // Hier gibt es nichts zu widerlegen, nur etwas nachzutragen.
    const h = auditScan('ITM-LOS', 'a3', lager())
    expect(h.outcome).toBe('no-location')
    expect(h.expected).toBeUndefined()
  })

  it('meldet einen unbekannten Code als nicht im Bestand', () => {
    expect(auditScan('XXX', 'a3', lager()).outcome).toBe('not-in-inventory')
  })

  it('erkennt ein LAGERORT-Etikett als solches', () => {
    // Beim Inventieren ist das fast immer der Griff zum Case-Etikett. Es als
    // „nicht im Bestand" zu melden waere schlicht falsch.
    const h = auditScan('CASE-1', 'a3', lager())
    expect(h.outcome).toBe('is-a-location')
    expect(h.label).toBe('Case 1')
  })

  it('loest eine Einheit ueber ihren Artikel auf und nennt dessen Modell', () => {
    const h = auditScan('UNIT-1', 'a3', lager())
    expect(h.outcome).toBe('wrong-place')
    expect(h.model).toBe('Klettband')
    expect(h.unitId).toBe('u1')
  })
})

describe('das Blatt traegt Modell UND Ort', () => {
  it('nennt beides plus den gepruefen Ort', () => {
    const hits = [auditScan('ITM-WEG', 'a3', lager())]
    const t = auditTable(hits, lager().nodes, 'a3')
    expect(t.headers).toEqual(['Ergebnis', 'Code', 'Objekt', 'Modell', 'Erwartet in', 'Geprueft an'])
    expect(t.rows[0]).toEqual(['Am falschen Ort', 'ITM-WEG', 'Stativ', 'Stativ', 'Regal B1', 'Regal A3'])
  })

  it('haelt die Etiketten kanonisch deutsch', () => {
    expect(AUDIT_LABEL['wrong-place']).toBe('Am falschen Ort')
  })
})

describe('was eine Uebernahme aendern wuerde', () => {
  it('nennt nur das Verstellte und das Ortlose', () => {
    const hits = ['ITM-HIER', 'ITM-WEG', 'ITM-LOS', 'XXX'].map((c) => auditScan(c, 'a3', lager()))
    expect(auditRelocations(hits)).toEqual([{ itemId: 'woanders' }, { itemId: 'ohneort' }])
  })

  it('aendert selbst NICHTS', () => {
    // Schreiben gehoert dem Menschen. Diese Funktion sagt nur, was passieren
    // wuerde — sonst verschoebe ein Scan Bestand, bevor jemand hinsieht.
    const bestand = lager()
    const vorher = JSON.stringify(bestand)
    auditRelocations([auditScan('ITM-WEG', 'a3', bestand)])
    expect(JSON.stringify(bestand)).toBe(vorher)
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT — und die Restreibung aus Bedarf 69, die hier ihr Zuhause
// findet: der Ort steht fest, BEVOR der erste Artikel gescannt wird.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Lager-Dialog', () => {
  it('scannt gegen den gewaehlten Ort, nicht gegen einen Standard', () => {
    // „the scan resolves to the company default warehouse rather than where
    // the stock is" (Bedarf 69) — genau das verhindert der Pflicht-Ort.
    expect(inventarQuelle).toContain("auditScan(roh, auditNode, { items, nodes, units })")
    expect(inventarQuelle).toContain('if (!roh || !auditNode) return')
  })

  it('laesst ein Lagerort-Etikett den Ort WECHSELN', () => {
    // Wer das Case-Etikett scannt, meint „ich stehe jetzt hier".
    expect(inventarQuelle).toContain("if (hit.outcome === 'is-a-location')")
    expect(inventarQuelle).toContain('setAuditNode(ziel.id)')
  })

  it('haelt den Bildschirm waehrend der Inventur wach', () => {
    // Bedarf 69, die zweite Reibung — hier mit einem Panel, an dem sie haengen
    // kann.
    expect(inventarQuelle).toMatch(/if \(!auditNode\) return\n\s*const awake = keepScreenAwake\(\)/)
  })

  it('schickt Enter NICHT als Formular ab', () => {
    expect(inventarQuelle).toContain("if (e.key === 'Enter') auditScanNow()")
  })

  it('uebernimmt den Ort als VORGANG, nicht als stilles Feld', () => {
    // Ein Ortswechsel gehoert in die Historie der Einheit; sonst bleibt „wann
    // kam die hierher?" unbeantwortet.
    expect(inventarQuelle).toContain('moveUnit(r.unitId, auditNode, nodePathLabel(nodes, auditNode))')
    // BEDARF 106 — dasselbe fuer den Artikel. Bis hierher lief das ueber
    // `updateItem`, also ueber dieselbe Funktion, die eine Notiz aendert: die
    // Bewegung war von einer beliebigen Feldaenderung nicht zu unterscheiden
    // und hinterliess nichts.
    expect(inventarQuelle).toContain('moveItem(r.itemId, auditNode)')
    expect(inventarQuelle).not.toContain('updateItem(r.itemId')
  })

  it('zeigt das Ergebnis mit Modell und erwartetem Ort', () => {
    expect(inventarQuelle).toContain('AUDIT_LABEL[h.outcome]')
    expect(inventarQuelle).toContain("t('inventory.auditExpected'")
    expect(inventarQuelle).toContain('auditTable(auditHits, nodes, node.id)')
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'inventory.auditStart',
      'inventory.auditTitle',
      'inventory.auditPh',
      'inventory.auditEmpty',
      'inventory.auditExpected',
      'inventory.auditAdopt',
      'inventory.auditAdoptHint',
    ]) {
      expect(inventarQuelle).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
