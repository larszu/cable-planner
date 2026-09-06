import { describe, expect, it } from 'vitest'
import {
  AUDIT_VIA_LABEL,
  NOT_FOUND,
  NO_CODE,
  auditPick,
  auditScan,
  auditTable,
  expectedAt,
  missingAt,
  type AuditCandidate,
} from '../src/renderer/lib/inventoryAudit'
import type { InventoryItem, InventoryUnit, StorageNode } from '../src/renderer/types/inventory'
import inventarQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'
import mobileQuelle from '../src/mobile/MobileApp.tsx?raw'
import auditQuelle from '../src/renderer/lib/inventoryAudit.ts?raw'

// ---------------------------------------------------------------------------
// Scannen ist der schnelle Weg, nie der einzige (Bedarf 150, P4).
//
//   > A model-based reservation 'can only be turned into a concrete asset by
//   > scanning. There is no way to fulfil one by SELECTING AN ASSET FROM A
//   > LIST', and since model requests must all be fulfilled before checkout,
//   > a coordinator without a working scanner is BLOCKED OUTRIGHT.
//
// Beleg: `Shelf-nu/shelf.nu#2831` (2026-08-10). Der Melder haelt fest, dass
// jeder andere Weg im selben Programm eine Auswahl-Liste anbietet — nur
// dieser eine nicht.
//
// WAS HIER SCHON GING UND WARUM ES NICHT REICHTE. Die Inventur nahm getippte
// Codes an. Das rettet den leeren Akku; es rettet NICHT das abgerissene
// Etikett und nicht das Case, das schon auf dem Lkw steht. Wer den Code nicht
// lesen kann, kann ihn auch nicht tippen.
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
  units: [unit('u1', 'hier', 'a3', 'UNIT-1')],
})

const finde = (liste: AuditCandidate[], label: string): AuditCandidate => {
  const c = liste.find((x) => x.label === label)
  if (!c) throw new Error(`"${label}" steht nicht in der Liste: ${liste.map((x) => x.label).join(', ')}`)
  return c
}

describe('die Liste dessen, was hier liegen soll', () => {
  it('nennt Einheiten UND Artikel, samt Inhalt der Behaelter darin', () => {
    const liste = expectedAt('a3', lager())
    const labels = liste.map((c) => c.label).sort()
    // Klettband (direkt in A3), Gaffa (in Case 1 in A3), die Einheit in A3.
    // Stativ liegt in B1 und Adapter nirgends — beide gehoeren nicht hierher.
    expect(labels).toContain('Klettband')
    expect(labels).toContain('Gaffa')
    expect(labels).not.toContain('Stativ')
    expect(labels).not.toContain('Adapter')
  })

  it('sagt bei jedem Eintrag, wo genau er erwartet wird', () => {
    // Ohne diese Angabe stuende „Gaffa" in der Liste von Regal A3, und
    // niemand wuesste, dass es in Case 1 liegen soll.
    expect(finde(expectedAt('a3', lager()), 'Gaffa').expected).toBe('Regal A3 › Case 1')
  })

  it('liefert dieselbe Reihenfolge, egal wie der Bestand sortiert ist', () => {
    // Nicht „zweimal derselbe Aufruf" — das waere auch ohne Sortierung wahr,
    // weil eine Schleife ihre Eingabe in Reihenfolge abarbeitet. Geprueft
    // wird die Unabhaengigkeit von der EINFUEGEREIHENFOLGE im Bestand: sonst
    // saehe die Abhak-Liste nach jedem Import anders aus, und wer sie zweimal
    // durchgeht, findet die Zeile nicht wieder, an der er war.
    const vorwaerts = lager()
    const rueckwaerts = lager()
    rueckwaerts.items.reverse()
    rueckwaerts.units.reverse()
    const a = expectedAt('a3', vorwaerts).map((c) => c.key)
    const b = expectedAt('a3', rueckwaerts).map((c) => c.key)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(1)
  })
})

describe('abhaken statt scannen — der Weg ohne Code', () => {
  it('verbucht einen Eintrag ohne jeden Code', () => {
    const hit = auditPick(finde(expectedAt('a3', lager()), 'Klettband'), 'a3', lager())
    expect(hit.outcome).toBe('expected-here')
    expect(hit.code).toBe('')
    expect(hit.itemId).toBe('hier')
  })

  it('geht durch DIESELBE Einordnung wie ein Scan', () => {
    // Der Kern: zwei Wege, eine Regel. Ein nachgebauter zweiter Vergleich
    // driftet still, und dann faellt derselbe Karton am Scanner als „am
    // falschen Ort" und in der Liste als „am erwarteten Ort" auf.
    const gescannt = auditScan('ITM-CASE', 'a3', lager())
    const gehakt = auditPick(finde(expectedAt('a3', lager()), 'Gaffa'), 'a3', lager())
    expect(gehakt.outcome).toBe(gescannt.outcome)
    expect(gehakt.expected).toBe(gescannt.expected)
    expect(gehakt.itemId).toBe(gescannt.itemId)
  })

  it('haelt gescannt und abgehakt auseinander', () => {
    // Wer scannt, hat das Etikett AM OBJEKT gelesen; wer abhakt, hat eine
    // Zeile angeklickt. Beides ist zulaessig, beides ist nicht dasselbe.
    expect(auditScan('ITM-HIER', 'a3', lager()).via).toBe('scan')
    // BEIDE Zweige: der Artikel-Weg und der Einheiten-Weg. Ein Test, der nur
    // einen davon anfasst, laesst den anderen still auf 'scan' stehen.
    expect(auditPick(finde(expectedAt('a3', lager()), 'Klettband'), 'a3', lager()).via).toBe('pick')
    const einheit = expectedAt('a3', lager()).find((c) => c.unitId)
    expect(einheit, 'die Fixture-Einheit fehlt in der Liste').toBeTruthy()
    expect(auditPick(einheit!, 'a3', lager()).via).toBe('pick')
    expect(auditPick(einheit!, 'a3', lager()).unitId).toBe('u1')
    expect(AUDIT_VIA_LABEL.scan).toBe('gescannt')
    expect(AUDIT_VIA_LABEL.pick).toBe('aus der Liste')
  })

  it('erfindet kein Objekt, wenn der Eintrag im Bestand fehlt', () => {
    const erfunden: AuditCandidate = { key: 'i:gibtsnicht', label: 'Phantom', expected: 'Regal A3', itemId: 'gibtsnicht' }
    expect(auditPick(erfunden, 'a3', lager()).outcome).toBe('not-in-inventory')
  })

  it('meldet auch beim Abhaken den falschen Ort', () => {
    // Wer vor A3 steht und einen Eintrag aus der B1-Liste abhakt, hat ihn am
    // falschen Ort gefunden — der Weg ohne Code darf da nicht milder sein.
    const ausB1 = finde(expectedAt('b1', lager()), 'Stativ')
    const hit = auditPick(ausB1, 'a3', lager())
    expect(hit.outcome).toBe('wrong-place')
    expect(hit.expected).toBe('Regal B1')
  })
})

describe('was fehlt, ist das eigentliche Ergebnis', () => {
  it('nennt, was hier erwartet und nicht erfasst wurde', () => {
    const offen = missingAt('a3', lager(), [auditScan('ITM-HIER', 'a3', lager())])
    expect(offen.map((c) => c.label)).toContain('Gaffa')
    expect(offen.map((c) => c.label)).not.toContain('Klettband')
  })

  it('zaehlt einen abgehakten Eintrag genauso als erfasst wie einen gescannten', () => {
    const gehakt = auditPick(finde(expectedAt('a3', lager()), 'Gaffa'), 'a3', lager())
    expect(missingAt('a3', lager(), [gehakt]).map((c) => c.label)).not.toContain('Gaffa')
  })

  it('laesst ein anderswo erwartetes Objekt nicht als hier fehlend erscheinen', () => {
    expect(missingAt('a3', lager(), []).map((c) => c.label)).not.toContain('Stativ')
  })

  it('haelt ein Objekt am falschen Ort NICHT fuer hier gefunden', () => {
    // Ein in A3 gescanntes Stativ ist nicht das, was A3 vermisst — es fehlt
    // weiterhin in B1. Wuerde `missingAt` jeden Treffer abziehen, meldete es
    // eine Luecke als geschlossen, die es nicht ist.
    const hit = auditScan('ITM-WEG', 'a3', lager())
    expect(hit.outcome).toBe('wrong-place')
    expect(missingAt('b1', lager(), [hit]).map((c) => c.label)).toContain('Stativ')
  })
})

describe('das Blatt', () => {
  it('traegt die Herkunft jeder Zeile', () => {
    const hits = [
      auditScan('ITM-HIER', 'a3', lager()),
      auditPick(finde(expectedAt('a3', lager()), 'Gaffa'), 'a3', lager()),
    ]
    const t = auditTable(hits, lager().nodes, 'a3')
    expect(t.headers[1]).toBe('Wie erfasst')
    expect(t.rows[0][1]).toBe('gescannt')
    expect(t.rows[1][1]).toBe('aus der Liste')
    // Und die Code-Spalte bleibt nicht leer: eine leere Zelle liest sich, als
    // sei der Code vergessen worden.
    expect(t.rows[1][2]).toBe(NO_CODE)
  })

  it('fuehrt das Nicht-Gefundene mit auf', () => {
    const hits = [auditScan('ITM-HIER', 'a3', lager())]
    const t = auditTable(hits, lager().nodes, 'a3', missingAt('a3', lager(), hits))
    const fehlend = t.rows.filter((r) => r[0] === NOT_FOUND)
    expect(fehlend.length).toBeGreaterThan(0)
    expect(fehlend.map((r) => r[3])).toContain('Gaffa')
    // Weder gescannt noch abgehakt — und das steht auch so da.
    expect(fehlend[0][1]).toBe('—')
  })

  it('behauptet ohne Erwartungsliste nicht, dass nichts fehlt', () => {
    // Der Aufrufer, der die Liste nicht mitgibt, bekommt keine Fehlt-Zeile —
    // aber auch kein „vollstaendig". Das Blatt sagt dann schlicht nichts
    // darueber, und das ist der ehrliche Zustand.
    const t = auditTable([auditScan('ITM-HIER', 'a3', lager())], lager().nodes, 'a3')
    expect(t.rows.some((r) => r[0] === NOT_FOUND)).toBe(false)
  })
})

describe('kein Weg im Programm haengt allein am Code', () => {
  it('die Inventur bietet die Liste zum Abhaken an', () => {
    expect(inventarQuelle).toMatch(/expectedAt\(/)
    // Und der Haken verbucht wirklich etwas: ein `auditPickNow`, das nur
    // dasteht, ist eine Taste ohne Wirkung.
    const handler = inventarQuelle.slice(
      inventarQuelle.indexOf('const auditPickNow ='),
      inventarQuelle.indexOf('/** Den TATSAECHLICHEN Ort uebernehmen'),
    )
    expect(handler).toMatch(/auditPick\(c, auditNode/)
    expect(handler).toMatch(/setAuditHits\(/)
    // Und die Liste steht wirklich im Panel, nicht nur im Zustand.
    expect(inventarQuelle).toMatch(/auditErwartet\.map\(/)
    // Die Herkunft steht an der Trefferzeile: gescannt oder abgehakt ist
    // nicht dasselbe, und wer die Liste liest, muss es sehen.
    expect(inventarQuelle).toMatch(/h\.via === 'pick'/)
  })

  it('das Inventur-Blatt geht mit den Fehlt-Zeilen heraus', () => {
    expect(inventarQuelle).toMatch(/auditTable\(auditHits, nodes, node\.id, auditFehlt\)/)
  })

  it('die Code-Suche im Lager nimmt getippte Codes, nicht nur die Kamera', () => {
    // Die Kamera-Taste haengt an `cameraSupported`; das Textfeld darf das
    // NICHT tun, sonst gibt es auf einem Rechner ohne Kamera keinen Weg.
    const block = inventarQuelle.slice(
      inventarQuelle.indexOf("placeholder={t('inventory.scanPh'"),
      inventarQuelle.indexOf('cameraSupported && ('),
    )
    expect(block).not.toMatch(/cameraSupported/)
    expect(inventarQuelle).toMatch(/onClick=\{\(\) => handleScan\(\)\}/)
  })

  it('die Handy-Ansicht haelt ihre Texteingabe unabhaengig von der Kamera', () => {
    // Im Studio-LAN laeuft die Ansicht typisch ueber http://; dort gibt es
    // gar keinen Kamera-Scan. Ein Weg, der nur mit Kamera funktioniert,
    // waere dort kein Weg.
    expect(mobileQuelle).toMatch(/autoFocus=\{!canScan\}/)
    expect(mobileQuelle).toMatch(/canScan \? \(/)
  })

  it('die Einordnung steht genau einmal', () => {
    // Zwei Wege in die Inventur, eine Regel. Waeren es zwei Regeln, waere
    // das Ergebnis vom Weg abhaengig — und niemand saehe es.
    expect(auditQuelle.match(/function einordnen\(/g)?.length).toBe(1)
    // Und `auditScan` ordnet nicht selbst ein: im eigenen Rumpf steht kein
    // Vergleich gegen den Teilbaum mehr. Eine Pruefung ueber die ganze Datei
    // saehe die Treffer in `einordnen` und ginge durch.
    const rumpf = auditQuelle.slice(
      auditQuelle.indexOf('export function auditScan('),
      auditQuelle.indexOf('function einordnen('),
    )
    expect(rumpf).not.toMatch(/hier\.has\(/)
    expect(rumpf).not.toMatch(/'expected-here'/)
  })
})
