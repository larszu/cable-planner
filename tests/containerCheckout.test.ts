import { describe, expect, it } from 'vitest'
import {
  buildCheckout,
  checkinDifference,
  checkoutRefusal,
  checkoutSheet,
  closeCheckout,
  containerContents,
  discrepancyTable,
  openCheckouts,
  openCheckoutsTable,
  overdueCheckouts,
  type InventorySnapshotIn,
} from '../src/renderer/lib/containerCheckout'
import type { CheckoutLine, CheckoutRecord } from '../src/renderer/types/checkout'
import type { InventoryItem, InventoryUnit, StorageNode } from '../src/renderer/types/inventory'
import quelle from '../src/renderer/lib/containerCheckout.ts?raw'
import dialogQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'
import storeQuelle from '../src/renderer/store/checkoutStore.ts?raw'
import inventoryStoreQuelle from '../src/renderer/store/inventoryStore.ts?raw'
import keysQuelle from '../src/renderer/lib/storageKeys.ts?raw'
import { stripComments } from './support/stripComments'

// ---------------------------------------------------------------------------
// Bedarf 15 -- den Container ein- und auschecken, nicht den Artikel.
//
// Der Befund kommt aus zwei offenen Snipe-IT-Ausgaben von AV-Leuten:
// „a good half hour of repetitive clicking" (snipe-it#9517), und der Ausweg
// dort ist ein erfundenes Eltern-Asset, das nur fuer sich selbst Auskunft
// gibt. Der zweite Satz ist der wichtigere: „Kits contain models, not the
// specific physical assets that are actually in the case."
//
// Geprueft wird deshalb vor allem, was NICHT passiert: keine Kit-Vorlage
// statt echtem Inhalt, keine zwei Vorgaenge ueber dasselbe Blech, keine
// stillschweigend geheilte Fehlmenge.
// ---------------------------------------------------------------------------

const zeit = '2026-09-06T10:00:00.000Z'

const node = (id: string, name: string, kind: StorageNode['kind'], parentId?: string): StorageNode => ({
  id, name, kind, parentId, createdAt: zeit, updatedAt: zeit,
})

const item = (id: string, model: string, quantity: number, locationId?: string): InventoryItem => ({
  id, model, quantity, locationId, createdAt: zeit, updatedAt: zeit,
})

const unit = (id: string, itemId: string, serial: string, locationId?: string): InventoryUnit => ({
  id, itemId, serial, locationId, condition: 'ok', history: [], createdAt: zeit, updatedAt: zeit,
})

/**
 * Ein Transport-Case mit einem Case darin -- die Verschachtelung, um die es
 * dem Bedarf geht.
 *
 *   Depot
 *     Regal A3
 *       Transport-Case 1        <- wird ausgegeben
 *         Case 2
 *           Objektiv 24-70 (Einheit S-1)
 *           Klettband x5
 *         Kamera (Einheit S-2)
 *     Regal B1
 *       Stativ x2               <- liegt NICHT im Case
 */
const lager = (): InventorySnapshotIn => ({
  nodes: [
    node('depot', 'Depot', 'depot'),
    node('a3', 'Regal A3', 'shelf', 'depot'),
    node('b1', 'Regal B1', 'shelf', 'depot'),
    node('tc1', 'Transport-Case 1', 'transportCase', 'a3'),
    node('c2', 'Case 2', 'case', 'tc1'),
  ],
  items: [
    item('klett', 'Klettband', 5, 'c2'),
    item('stativ', 'Stativ', 2, 'b1'),
  ],
  units: [
    unit('u1', 'obj', 'S-1', 'c2'),
    unit('u2', 'cam', 'S-2', 'tc1'),
  ],
})

const ausgabe = (over: Partial<CheckoutRecord['out']> = {}): CheckoutRecord['out'] => ({
  at: zeit, to: 'Truck 1', ...over,
})

describe('der Inhalt folgt mit -- ueber alle Ebenen', () => {
  it('nimmt das verschachtelte Case UND dessen Inhalt', () => {
    const lines = containerContents(lager(), 'tc1')
    expect(lines.map((l) => `${l.kind}:${l.label}`)).toEqual([
      'node:Case 2',
      'unit:S-1',
      'unit:S-2',
      'item:Klettband',
    ])
  })

  it('nimmt NICHTS mit, was ausserhalb liegt', () => {
    // Das Stativ liegt in Regal B1. Waere es dabei, ginge Material raus, das
    // niemand eingepackt hat -- und bei der Rueckgabe fehlte es „aus dem Case".
    const lines = containerContents(lager(), 'tc1')
    expect(lines.some((l) => l.label === 'Stativ')).toBe(false)
  })

  it('fuehrt den verschachtelten Container ALS ZEILE und seinen Inhalt einzeln', () => {
    // Beide Fragen werden gestellt: „ist Case 2 wieder da?" und „sind die
    // Objektive aus Case 2 wieder da?". Nur den Container zu fuehren waere das
    // erfundene Eltern-Asset aus snipe-it#9517.
    const lines = containerContents(lager(), 'tc1')
    expect(lines.filter((l) => l.kind === 'node')).toHaveLength(1)
    expect(lines.filter((l) => l.kind !== 'node').length).toBeGreaterThan(1)
  })

  it('gibt jede Einheit unter ihrer eigenen Kennung aus, nicht als Modell-Menge', () => {
    // „children keep their own ERP identities": kommt eine von drei
    // Funkstrecken nicht zurueck, muss auf dem Blatt stehen, WELCHE.
    const lines = containerContents(lager(), 'tc1')
    const einheiten = lines.filter((l) => l.kind === 'unit')
    expect(einheiten.map((l) => l.label)).toEqual(['S-1', 'S-2'])
    expect(einheiten.every((l) => l.quantity === 1)).toBe(true)
  })

  it('sortiert stabil', () => {
    const a = containerContents(lager(), 'tc1')
    const gedreht: InventorySnapshotIn = {
      ...lager(),
      items: [...lager().items].reverse(),
      units: [...lager().units].reverse(),
      nodes: [...lager().nodes].reverse(),
    }
    // Ohne feste Reihenfolge waere jede zweite Ausgabeliste eine andere Datei
    // -- und der Dokument-Stempel damit wertlos.
    expect(containerContents(gedreht, 'tc1')).toEqual(a)
  })
})

describe('nichts geht zweimal raus', () => {
  it('weist einen Nicht-Container ab', () => {
    expect(checkoutRefusal(lager(), [], 'a3')).toBe('not-a-container')
  })

  it('weist einen bereits ausgegebenen Container ab', () => {
    const erste = buildCheckout(lager(), [], 'tc1', ausgabe(), 'r1')
    expect('record' in erste).toBe(true)
    const offen = [(erste as { record: CheckoutRecord }).record]
    expect(checkoutRefusal(lager(), offen, 'tc1')).toBe('already-out')
  })

  it('weist ein Case IN einem ausgegebenen Transport-Case ab', () => {
    // Die Haelfte, die man vergisst. Zwei Vorgaenge ueber dasselbe Blech, und
    // die Rueckgabe des einen macht den anderen stillschweigend falsch.
    const erste = buildCheckout(lager(), [], 'tc1', ausgabe(), 'r1')
    const offen = [(erste as { record: CheckoutRecord }).record]
    expect(checkoutRefusal(lager(), offen, 'c2')).toBe('inside-checked-out')
  })

  it('laesst ein Case wieder raus, nachdem der Vorgang geschlossen ist', () => {
    const erste = buildCheckout(lager(), [], 'tc1', ausgabe(), 'r1')
    const rec = (erste as { record: CheckoutRecord }).record
    const zu = closeCheckout(rec, containerContents(lager(), 'tc1'), '2026-09-08T09:00:00.000Z')
    expect(checkoutRefusal(lager(), [zu], 'tc1')).toBeUndefined()
  })
})

describe('die Ausgabe friert den TATSAECHLICHEN Inhalt ein', () => {
  it('behaelt die Liste, wenn der Artikel danach umbenannt wird', () => {
    // Der Kern des Bedarfs: eine Liste aus der Kit-Vorlage beschriebe ein
    // gedachtes Case. Bei der Rueckgabe zaehlt, was drin WAR.
    const rec = (buildCheckout(lager(), [], 'tc1', ausgabe(), 'r1') as { record: CheckoutRecord }).record
    expect(rec.contents.find((l) => l.refId === 'klett')?.label).toBe('Klettband')

    const spaeter = lager()
    spaeter.items[0] = { ...spaeter.items[0], model: 'Klettband schwarz' }
    // Der Datensatz ist unberuehrt -- er schlaegt nichts nach.
    expect(rec.contents.find((l) => l.refId === 'klett')?.label).toBe('Klettband')
  })

  it('behaelt den Container-Namen der Ausgabe', () => {
    const rec = (buildCheckout(lager(), [], 'tc1', ausgabe(), 'r1') as { record: CheckoutRecord }).record
    expect(rec.nodeLabel).toBe('Transport-Case 1')
  })
})

describe('der Unterschied bei der Rueckgabe wird berichtet, nicht geheilt', () => {
  const rec = (): CheckoutRecord =>
    (buildCheckout(lager(), [], 'tc1', ausgabe(), 'r1') as { record: CheckoutRecord }).record

  it('meldet eine fehlende Einheit mit ihrer Kennung', () => {
    const zurueck = containerContents(lager(), 'tc1').filter((l) => l.refId !== 'u1')
    const { missing, extra } = checkinDifference(rec(), zurueck)
    expect(missing.map((l) => l.label)).toEqual(['S-1'])
    expect(extra).toEqual([])
  })

  it('meldet eine Teilmenge als Differenz, nicht als ganze Zeile', () => {
    // Von fuenf Kabeln kommen vier zurueck: es fehlt EINS, nicht „Klettband".
    const zurueck = containerContents(lager(), 'tc1').map((l): CheckoutLine =>
      l.refId === 'klett' ? { ...l, quantity: 4 } : l,
    )
    const { missing } = checkinDifference(rec(), zurueck)
    expect(missing).toEqual([{ kind: 'item', refId: 'klett', label: 'Klettband', quantity: 1 }])
  })

  it('meldet Zusaetzliches', () => {
    const zurueck: CheckoutLine[] = [
      ...containerContents(lager(), 'tc1'),
      { kind: 'item', refId: 'fremd', label: 'Fremdes Kabel', quantity: 1 },
    ]
    const { extra } = checkinDifference(rec(), zurueck)
    expect(extra.map((l) => l.label)).toEqual(['Fremdes Kabel'])
  })

  it('meldet bei glatter Rueckgabe nichts', () => {
    const { missing, extra } = checkinDifference(rec(), containerContents(lager(), 'tc1'))
    expect(missing).toEqual([])
    expect(extra).toEqual([])
  })

  it('laesst den Ausgabe-Datensatz unveraendert', () => {
    // Ein Beleg, der sich ruecklaufend korrigieren laesst, ist keiner mehr.
    const r = rec()
    const vorher = JSON.stringify(r)
    closeCheckout(r, [], '2026-09-08T09:00:00.000Z')
    expect(JSON.stringify(r)).toBe(vorher)
  })

  it('schreibt den Befund in den geschlossenen Vorgang', () => {
    const zu = closeCheckout(rec(), [], '2026-09-08T09:00:00.000Z', 'Kunde meldet Verlust')
    expect(zu.in?.missing).toHaveLength(4)
    expect(zu.in?.note).toBe('Kunde meldet Verlust')
    expect(openCheckouts([zu])).toEqual([])
  })
})

describe('Fristen', () => {
  const mit = (dueBack?: string): CheckoutRecord =>
    (buildCheckout(lager(), [], 'tc1', ausgabe({ dueBack }), 'r1') as { record: CheckoutRecord }).record

  it('ohne Rueckgabedatum ist nichts ueberfaellig', () => {
    // Ein fehlendes Datum ist keine Frist. Es als „sofort faellig" zu lesen
    // faerbte jede Ausgabe rot und macht die Liste unlesbar.
    expect(overdueCheckouts([mit(undefined)], '2030-01-01')).toEqual([])
  })

  it('ueberfaellig ist, was vor dem Stichtag zurueck sollte', () => {
    expect(overdueCheckouts([mit('2026-09-07')], '2026-09-09')).toHaveLength(1)
    expect(overdueCheckouts([mit('2026-09-10')], '2026-09-09')).toEqual([])
  })
})

describe('die Blaetter', () => {
  const rec = (): CheckoutRecord =>
    (buildCheckout(lager(), [], 'tc1', ausgabe({ projectName: 'Messe', dueBack: '2026-09-07' }), 'r1') as {
      record: CheckoutRecord
    }).record

  it('der Ausgabeschein zaehlt jede Position mit Kennung auf', () => {
    const t = checkoutSheet(rec())
    expect(t.headers).toEqual(['Art', 'Bezeichnung', 'Menge', 'Kennung'])
    expect(t.rows).toHaveLength(4)
    expect(t.rows.every((r) => String(r[3] ?? '').length > 0)).toBe(true)
  })

  it('die Uebersicht nennt den Lagerort als PFAD', () => {
    // „Case 2" gibt es dreimal, „Depot > Regal A3 > Transport-Case 1" einmal.
    const t = openCheckoutsTable([rec()], lager().nodes, '2026-09-09')
    expect(String(t.rows[0][1])).toContain('Depot')
    expect(String(t.rows[0][1])).toContain('Regal A3')
    expect(t.rows[0][7]).toBe('ueberfaellig')
  })

  it('der Rueckgabe-Befund bleibt LEER, wenn alles glatt zurueckkam', () => {
    // Die Regel, die hier bewacht wird: ein Blatt, auf dem auch die glatten
    // Rueckgaben stehen, wird nicht gelesen. Sie ist an der Zeilenstruktur
    // aufgehaengt -- eine Zeile je Abweichung, keine je Vorgang -- und genau
    // deshalb faellt hier um, wer eine „alles in Ordnung"-Zeile ergaenzt.
    const glatt = closeCheckout(rec(), containerContents(lager(), 'tc1'), '2026-09-08T09:00:00.000Z')
    expect(glatt.in?.missing).toEqual([])
    expect(discrepancyTable([glatt, { ...glatt, id: 'r3' }]).rows).toEqual([])
  })

  it('der Rueckgabe-Befund nennt die fehlende Position mit Kennung', () => {
    const glatt = closeCheckout(rec(), containerContents(lager(), 'tc1'), '2026-09-08T09:00:00.000Z')
    const schief = closeCheckout(
      { ...rec(), id: 'r2' },
      containerContents(lager(), 'tc1').filter((l) => l.refId !== 'u1'),
      '2026-09-08T09:00:00.000Z',
    )
    const t = discrepancyTable([glatt, schief])
    expect(t.rows).toHaveLength(1)
    expect(t.rows[0][3]).toBe('fehlt')
    expect(t.rows[0][5]).toBe('S-1')
  })
})

describe('was die Datei NICHT tut', () => {
  it('holt sich die Zeit nicht selbst', () => {
    // Ein Beleg, dessen Zeitstempel die Funktion selbst zieht, laesst sich
    // nicht zweimal gleich bauen -- und ein Test darauf pruefte nur die Uhr.
    expect(quelle).not.toMatch(/new Date\(\)|Date\.now\(\)/)
  })

  it('baut die Inhaltsliste NICHT aus den Kit-Vorlagen', () => {
    // Der ausdrueckliche Befund: „Kits contain models, not the specific
    // physical assets that are actually in the case."
    expect(quelle).not.toMatch(/InventorySet|availabilityOfSet|\bsets\b/)
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Ein Lager-Modul, das kein Reiter oeffnet, spart niemandem
// die halbe Stunde Klickerei.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Lager-Dialog', () => {
  it('hat einen eigenen Reiter mit der Zahl der offenen Vorgaenge', () => {
    expect(dialogQuelle).toContain("id: 'checkout' as Tab")
    expect(dialogQuelle).toContain('<CheckoutTab />')
    // Ein Reiter, der nicht sagt, dass drei Cases draussen sind, wird nicht
    // geoeffnet.
    expect(dialogQuelle).toMatch(/records\.filter\(\(r\) => !r\.in\)\.length/)
  })

  it('gibt aus und bucht zurueck ueber den Store', () => {
    expect(dialogQuelle).toContain("from '../../store/checkoutStore'")
    expect(dialogQuelle).toMatch(/checkOut\(snap, nodeId,/)
    expect(dialogQuelle).toMatch(/checkIn\(snap, r\.id\)/)
  })

  it('zeigt VOR dem Klick, was mitginge', () => {
    // Ein Knopf, der ungesehen vierzig Positionen ausbucht, wird beim ersten
    // Fehlgriff nicht mehr benutzt.
    expect(dialogQuelle).toMatch(/containerContents\(snap, nodeId\)/)
    expect(dialogQuelle).toContain("'inventory.checkout.preview'")
  })

  it('nennt die Absage auf dem Schirm, statt sie zu verschlucken', () => {
    for (const key of [
      'inventory.checkout.notContainer',
      'inventory.checkout.alreadyOut',
      'inventory.checkout.insideOut',
      'inventory.checkout.unknownNode',
    ]) {
      expect(dialogQuelle).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
    // Ausgeschriebener switch, kein `t(`inventory.checkout.${r}`)`: ein
    // dynamischer Schluessel ist fuer den Deckungs-Guard unsichtbar.
    expect(dialogQuelle).not.toMatch(/t\(`inventory\.checkout\./)
  })

  it('setzt KEINEN Dokument-Stempel auf die Lager-Blaetter', () => {
    // Der Stempel (ADR-004) bindet ein Blatt an einen PLAN-Stand. Ein
    // Ausgabeschein haengt am Lager und nicht am geoeffneten Projekt; ein
    // Plan-Fingerabdruck darauf waere eine Aussage ueber etwas anderes.
    const tabAb = dialogQuelle.indexOf('const CheckoutTab')
    const tabBis = dialogQuelle.indexOf('const ReportsTab')
    const tab = dialogQuelle.slice(tabAb, tabBis)
    expect(tabAb).toBeGreaterThan(-1)
    expect(tab).not.toMatch(/stampForRows|csvFromTable|planFingerprint/)
  })
})

describe('die Belege bleiben aus dem portablen Lager-Format heraus', () => {
  it('haengt nicht am Inventory-Store', () => {
    // `avplan-inventory` ist in allen drei Apps byte-identisch eingefroren
    // (`inventoryContract.test.ts`). Einen Ausgabe-Beleg dort einzuhaengen
    // hiesse, das Format in drei Repos zu brechen, damit multicam und light
    // ein Feld durchreichen, das sie nie fuellen.
    // Ohne `stripComments` traefe die Regex die Begruendung im Kopfkommentar
    // -- der Guard pruefte dann seine eigene Erklaerung statt des Codes.
    expect(stripComments(storeQuelle)).not.toMatch(/inventoryStore|serializeInventory|exportSnapshot/)
    expect(stripComments(inventoryStoreQuelle)).not.toMatch(/checkout|Checkout/i)
  })

  it('benutzt einen eigenen localStorage-Key aus der Registry', () => {
    expect(storeQuelle).toContain('STORAGE_KEYS.checkouts')
    expect(keysQuelle).toContain("checkouts: 'cable-planner:checkouts'")
  })
})
