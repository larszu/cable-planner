import { beforeEach, describe, expect, it } from 'vitest'
import { useInventoryStore } from '../src/renderer/lager/store/inventoryStore'
import { useStorageMoveStore } from '../src/renderer/lager/store/storageMoveStore'
import {
  NEVER_PLACED,
  UNKNOWN_PLACE,
  buildMove,
  lastKnownPlace,
  moveRefusal,
  moveTable,
  movesOf,
  unjournalledPlaces,
} from '../src/renderer/lager/lib/storageMoves'
import { MOVE_REFUSAL_LABEL, MOVE_SUBJECT_LABEL, type StorageMove } from '../src/renderer/lager/types/storageMove'
import type { InventoryItem, InventoryUnit, StorageNode } from '../src/renderer/lager/types/inventory'
import typenQuelle from '../src/renderer/lager/types/storageMove.ts?raw'
import libQuelle from '../src/renderer/lager/lib/storageMoves.ts?raw'
import storeQuelle from '../src/renderer/lager/store/inventoryStore.ts?raw'
import journalQuelle from '../src/renderer/lager/store/storageMoveStore.ts?raw'
import portableQuelle from '../src/renderer/lager/lib/inventoryPortable.ts?raw'
import dialogQuelle from '../src/renderer/lager/ui/InventoryDialog.tsx?raw'
import lexikonQuelle from '../src/renderer/lib/dataDictionary.ts?raw'

// ---------------------------------------------------------------------------
// Umraeumen ist ein Vorgang, keine Nebenwirkung (Bedarf 106, P3).
//
//   > Re-shelving after check-in or consolidating a bay requires a FAKE
//   > CHECK-OUT to an arbitrary user/location followed by a check-in. Filing a
//   > newly created asset into storage needs the same dance. So people skip it
//   > and THE RECORDED LOCATION GOES STALE.
//
// Belegt an `grokability/snipe-it#6743` — 2019 gemeldet, im Maerz 2026 noch
// kommentiert — und an `#12893` fuer denselben Fall beim Anlegen.
//
// Die Antwort der Bedarfs-Datenbank ist woertlich: „a 'move' verb, not a side
// effect. Stale location is what makes mid-show 'where is the second one?'
// unanswerable."
// ---------------------------------------------------------------------------

const zeit = '2026-09-06T10:00:00.000Z'
const node = (id: string, name: string, parentId?: string): StorageNode =>
  ({ id, name, kind: 'shelf', parentId, createdAt: zeit, updatedAt: zeit }) as StorageNode
const item = (id: string, locationId?: string): InventoryItem =>
  ({ id, model: `M-${id}`, quantity: 1, locationId, createdAt: zeit, updatedAt: zeit }) as InventoryItem
const unit = (id: string, locationId?: string): InventoryUnit =>
  ({ id, itemId: 'i1', locationId, condition: 'ok', history: [], createdAt: zeit, updatedAt: zeit }) as unknown as InventoryUnit

const baum = (): StorageNode[] => [
  node('a3', 'Regal A3'),
  node('c1', 'Case 1', 'a3'),
  node('c2', 'Case 2', 'c1'),
  node('b1', 'Regal B1'),
]

// ── 1. Die Absage hat einen Namen ──────────────────────────────────────────

describe('moveRefusal — warum es nicht geht, statt still nichts zu tun', () => {
  it('laesst den gewoehnlichen Umzug zu', () => {
    expect(moveRefusal(baum(), 'node', { id: 'c1', currentPlaceId: 'a3' }, 'b1')).toBeNull()
  })

  it('meldet den Zyklus, statt die Kiste stehen zu lassen', () => {
    // Bis hierher gab `moveNode` bei einem Zyklus `{}` zurueck: nichts
    // passierte, und niemand erfuhr, warum. Fuer den Bedienenden ist das von
    // einem kaputten Programm nicht zu unterscheiden.
    expect(moveRefusal(baum(), 'node', { id: 'c1', currentPlaceId: 'a3' }, 'c2')).toBe('cycle')
    expect(moveRefusal(baum(), 'node', { id: 'c1', currentPlaceId: 'a3' }, 'c1')).toBe('cycle')
  })

  it('meldet ein unbekanntes Objekt und ein unbekanntes Ziel getrennt', () => {
    expect(moveRefusal(baum(), 'node', undefined, 'b1')).toBe('unknown-subject')
    expect(moveRefusal(baum(), 'item', { id: 'i1' }, 'gibtsnicht')).toBe('unknown-target')
  })

  it('lehnt den Umzug an denselben Ort ab', () => {
    // Ein Journal-Eintrag „von Regal A nach Regal A" waere eine Bewegung, die
    // es nie gab — und wer das Journal spaeter liest, zaehlt sie mit.
    expect(moveRefusal(baum(), 'item', { id: 'i1', currentPlaceId: 'a3' }, 'a3')).toBe('same-place')
    expect(moveRefusal(baum(), 'item', { id: 'i1', currentPlaceId: undefined }, undefined)).toBe(
      'same-place',
    )
  })

  it('prueft den Zyklus NUR beim Container', () => {
    // Ein Artikel ist kein Container: er hat keine Nachfahren, und die
    // Zyklus-Frage stellt sich nicht. Sie trotzdem zu stellen hiesse, einen
    // gueltigen Umzug abzulehnen, weil eine id zufaellig gleich heisst.
    expect(moveRefusal(baum(), 'item', { id: 'c1', currentPlaceId: 'b1' }, 'c2')).toBeNull()
    expect(moveRefusal(baum(), 'unit', { id: 'c1', currentPlaceId: 'b1' }, 'c2')).toBeNull()
  })

  it('erlaubt das Herausnehmen aus dem Lager', () => {
    // `undefined` als Ziel ist „nicht mehr im Lager" und kein unbekannter Ort.
    expect(moveRefusal(baum(), 'unit', { id: 'u1', currentPlaceId: 'a3' }, undefined)).toBeNull()
  })

  it('haelt fuer jede Absage eine lesbare Ueberschrift bereit', () => {
    for (const k of ['unknown-subject', 'unknown-target', 'cycle', 'same-place'] as const) {
      expect(MOVE_REFUSAL_LABEL[k].length).toBeGreaterThan(10)
    }
  })
})

// ── 2. Der Eintrag ─────────────────────────────────────────────────────────

describe('der Journal-Eintrag', () => {
  it('haelt den Klartext-Pfad von DAMALS fest', () => {
    // Redundant zur id — und trotzdem noetig: ein Lagerort kann umbenannt
    // oder geloescht werden, und dann sagt die id nichts mehr.
    const m = buildMove(zeit, 'node', 'c1', 'a3', 'b1', 'Regal B1', 'konsolidiert')
    expect(m).toEqual({
      at: zeit,
      kind: 'node',
      subjectId: 'c1',
      fromId: 'a3',
      toId: 'b1',
      toLabel: 'Regal B1',
      note: 'konsolidiert',
    })
  })

  it('laesst leere Angaben weg statt sie als leeren String zu fuehren', () => {
    const m = buildMove(zeit, 'unit', 'u1', undefined, undefined, undefined)
    expect(m).toEqual({ at: zeit, kind: 'unit', subjectId: 'u1' })
    expect('fromId' in m).toBe(false)
    expect('toId' in m).toBe(false)
    // Auch das Label und die Notiz: `toEqual` sieht ein `undefined`-Feld nicht,
    // ein JSON-Roundtrip durch localStorage aber auch nicht — und dann steht
    // im Journal eine leere Zelle, wo „nicht mehr im Lager" stehen muesste.
    expect('toLabel' in m).toBe(false)
    expect('note' in m).toBe(false)
  })

  it('sortiert die Eintraege eines Objekts jueng-zuerst', () => {
    const moves: StorageMove[] = [
      buildMove('2026-01-01T00:00:00Z', 'item', 'i1', undefined, 'a3', 'Regal A3'),
      buildMove('2026-03-01T00:00:00Z', 'item', 'i1', 'a3', 'b1', 'Regal B1'),
      buildMove('2026-02-01T00:00:00Z', 'item', 'i2', undefined, 'a3', 'Regal A3'),
    ]
    expect(movesOf(moves, 'item', 'i1').map((m) => m.at)).toEqual([
      '2026-03-01T00:00:00Z',
      '2026-01-01T00:00:00Z',
    ])
  })
})

// ── 3. Wo etwas zuletzt hingebucht wurde ───────────────────────────────────

describe('lastKnownPlace', () => {
  const moves: StorageMove[] = [
    buildMove('2026-01-01T00:00:00Z', 'unit', 'u1', undefined, 'a3', 'Regal A3'),
    buildMove('2026-03-01T00:00:00Z', 'unit', 'u1', 'a3', 'b1', 'Regal B1'),
  ]

  it('nennt den Klartext des letzten Vorgangs', () => {
    expect(lastKnownPlace(moves, 'unit', 'u1')).toBe('Regal B1')
  })

  it('sagt „nie eingeraeumt" statt einer leeren Antwort', () => {
    expect(lastKnownPlace(moves, 'unit', 'u9')).toBe(NEVER_PLACED)
  })

  it('sagt „nicht mehr im Lager", wenn zuletzt herausgenommen wurde', () => {
    const raus = [...moves, buildMove('2026-04-01T00:00:00Z', 'unit', 'u1', 'b1', undefined, undefined)]
    expect(lastKnownPlace(raus, 'unit', 'u1')).toBe(UNKNOWN_PLACE)
  })
})

// ── 4. Das Blatt ───────────────────────────────────────────────────────────

describe('moveTable', () => {
  const nameOf = (_k: unknown, id: string) => `Objekt ${id}`

  it('nennt Art, Objekt, Herkunft und Ziel', () => {
    const t = moveTable(
      [buildMove(zeit, 'node', 'c1', 'a3', 'b1', 'Regal B1', 'konsolidiert')],
      baum(),
      nameOf as never,
    )
    expect(t.headers).toEqual(['Zeitpunkt', 'Art', 'Objekt', 'Von', 'Nach', 'Notiz'])
    expect(t.rows[0]).toEqual([
      zeit,
      MOVE_SUBJECT_LABEL.node,
      'Objekt c1',
      'Regal A3',
      'Regal B1',
      'konsolidiert',
    ])
  })

  it('nimmt den Ziel-Klartext aus dem EINTRAG, nicht aus dem heutigen Baum', () => {
    // Das Journal soll sagen, wo etwas damals hingebucht wurde — auch wenn
    // der Lagerort inzwischen anders heisst.
    const t = moveTable(
      [buildMove(zeit, 'item', 'i1', 'a3', 'b1', 'Regal B1 (alter Name)')],
      baum(),
      nameOf as never,
    )
    expect(t.rows[0][4]).toBe('Regal B1 (alter Name)')
  })

  it('sagt „nicht mehr im Lager" statt eine geloeschte id zu zeigen', () => {
    const t = moveTable([buildMove(zeit, 'item', 'i1', 'weg', undefined, undefined)], baum(), nameOf as never)
    expect(t.rows[0][3]).toBe(UNKNOWN_PLACE)
    expect(t.rows[0][4]).toBe(UNKNOWN_PLACE)
  })

  it('sortiert jueng-zuerst', () => {
    const t = moveTable(
      [
        buildMove('2026-01-01T00:00:00Z', 'item', 'i1', undefined, 'a3', 'Regal A3'),
        buildMove('2026-05-01T00:00:00Z', 'item', 'i2', undefined, 'b1', 'Regal B1'),
      ],
      baum(),
      nameOf as never,
    )
    expect(t.rows[0][0]).toBe('2026-05-01T00:00:00Z')
  })

  it('hat fuer jede Spalte einen Lexikon-Eintrag', () => {
    const t = moveTable([buildMove(zeit, 'item', 'i1', 'a3', 'b1', 'Regal B1')], baum(), nameOf as never)
    for (const h of t.headers) {
      expect(lexikonQuelle, `Lexikon-Eintrag fehlt: ${h}`).toContain(`${h}:`)
    }
  })
})

// ── 5. Der unbelegte Lagerort ──────────────────────────────────────────────

describe('unjournalledPlaces', () => {
  it('nennt Objekte, deren Ort kein Vorgang erklaert', () => {
    const moves = [buildMove(zeit, 'item', 'i1', undefined, 'a3', 'Regal A3')]
    const offen = unjournalledPlaces(moves, [item('i1', 'a3'), item('i2', 'b1')], [unit('u1', 'b1')])
    expect(offen).toEqual([
      { kind: 'item', id: 'i2', placeId: 'b1' },
      { kind: 'unit', id: 'u1', placeId: 'b1' },
    ])
  })

  it('meldet ein Objekt OHNE Lagerort nicht', () => {
    // Es gibt nichts zu belegen: es liegt nirgends.
    expect(unjournalledPlaces([], [item('i1', undefined)], [unit('u1', undefined)])).toEqual([])
  })
})

// ── 6. Der Store — Vorgang statt Nebenwirkung ──────────────────────────────

describe('der Bestands-Store bucht, statt Felder zu schreiben', () => {
  beforeEach(() => {
    localStorage.clear()
    useInventoryStore.setState({ items: [], nodes: [], sets: [], units: [] })
    useStorageMoveStore.setState({ moves: [] })
  })

  it('meldet den Zyklus, statt still nichts zu tun', () => {
    const st = useInventoryStore.getState()
    const a = st.addNode({ name: 'A', kind: 'case' })
    const b = st.addNode({ name: 'B', kind: 'case', parentId: a })
    // Bis hierher gab `moveNode` `{}` zurueck: die Kiste blieb stehen, und
    // niemand erfuhr, warum.
    expect(useInventoryStore.getState().moveNode(a, b)).toBe('cycle')
    expect(useInventoryStore.getState().nodes.find((n) => n.id === a)?.parentId).toBeUndefined()
    // Und ein abgelehnter Umzug steht NICHT im Journal.
    expect(useStorageMoveStore.getState().moves).toEqual([])
  })

  it('schreibt den Umzug eines Containers ins Journal', () => {
    const st = useInventoryStore.getState()
    const a = st.addNode({ name: 'Regal A3', kind: 'shelf' })
    const c = st.addNode({ name: 'Case 1', kind: 'case' })
    expect(useInventoryStore.getState().moveNode(c, a)).toBeUndefined()
    const [eintrag] = useStorageMoveStore.getState().moves
    expect(eintrag.kind).toBe('node')
    expect(eintrag.subjectId).toBe(c)
    expect(eintrag.toId).toBe(a)
    expect(eintrag.toLabel).toContain('Regal A3')
  })

  it('schreibt den Umzug eines Artikels ins Journal, mit Herkunft', () => {
    const st = useInventoryStore.getState()
    const a = st.addNode({ name: 'Regal A3', kind: 'shelf' })
    const b = st.addNode({ name: 'Regal B1', kind: 'shelf' })
    const i = st.addItem({ model: 'SM58', quantity: 4 })
    useInventoryStore.getState().moveItem(i, a)
    useInventoryStore.getState().moveItem(i, b)
    const eintraege = useStorageMoveStore.getState().moves.filter((m) => m.kind === 'item')
    expect(eintraege).toHaveLength(2)
    // Die Herkunft wird VOR dem Schreiben gelesen — sonst fuehrte das Journal
    // jede Bewegung als „von da nach da".
    expect(eintraege[1].fromId).toBe(a)
    expect(eintraege[1].toId).toBe(b)
  })

  it('schreibt auch den Umzug einer Einheit ins Journal', () => {
    const st = useInventoryStore.getState()
    const a = st.addNode({ name: 'Regal A3', kind: 'shelf' })
    const i = st.addItem({ model: 'SM58', quantity: 1 })
    const u = st.addUnit({ itemId: i, condition: 'ok' })
    useInventoryStore.getState().moveUnit(u, a, 'Regal A3')
    const eintrag = useStorageMoveStore.getState().moves.find((m) => m.kind === 'unit')
    expect(eintrag?.subjectId).toBe(u)
    expect(eintrag?.toId).toBe(a)
    // Ihre eigene Historie bleibt, wo sie ist: sie faehrt mit dem Objekt mit.
    const einheit = useInventoryStore.getState().units.find((x) => x.id === u)
    expect(einheit?.history.some((h) => h.kind === 'moved')).toBe(true)
  })

  it('lehnt den Umzug an denselben Ort ab, statt ihn zu buchen', () => {
    const st = useInventoryStore.getState()
    const a = st.addNode({ name: 'Regal A3', kind: 'shelf' })
    const i = st.addItem({ model: 'SM58', quantity: 1 })
    useInventoryStore.getState().moveItem(i, a)
    expect(useInventoryStore.getState().moveItem(i, a)).toBe('same-place')
    expect(useStorageMoveStore.getState().moves.filter((m) => m.kind === 'item')).toHaveLength(1)
  })

  it('meldet ein unbekanntes Ziel', () => {
    const st = useInventoryStore.getState()
    const i = st.addItem({ model: 'SM58', quantity: 1 })
    expect(useInventoryStore.getState().moveItem(i, 'gibtsnicht')).toBe('unknown-target')
  })

  it('laesst `updateItem` den Lagerort gar nicht mehr annehmen', () => {
    // Nicht nur „soll nicht" — kann nicht: der Typ schliesst das Feld aus.
    expect(storeQuelle).toContain("Partial<Omit<InventoryItemInput, 'locationId'>>")
    // Und die zweite Tuer daneben ist zu: `setItemLocation` schrieb den Ort
    // als stilles Feld und hinterliess nichts. Geprueft wird das an den
    // AKTIONEN des Stores und nicht am Quelltext — eine Zeichenketten-Suche
    // haette dieselbe Tuer unter jedem anderen Namen durchgelassen.
    const aktionen = Object.keys(useInventoryStore.getState())
    expect(aktionen.filter((k) => /location/i.test(k))).toEqual([])
    // Was es an Bewegungs-Verben gibt, heisst auch so.
    expect(aktionen.filter((k) => /^move/.test(k)).sort()).toEqual([
      'moveItem',
      'moveNode',
      'moveUnit',
    ])
  })
})

// ── 7. Das Journal bleibt aus dem Austauschformat draussen ─────────────────

describe('das Journal ist Betriebszustand, kein Katalog', () => {
  it('liegt in einem eigenen Store mit eigenem Key', () => {
    expect(journalQuelle).toContain('STORAGE_KEYS.storageMoves')
    // Kein Export-Weg: das Journal wird weder gebaut noch aufgerufen, wo der
    // Katalog gebaut wird. (Der Name kommt im Kopfkommentar vor — dort wird
    // die Entscheidung begruendet, und genau das soll er.)
    expect(journalQuelle).not.toContain('exportSnapshot:')
    expect(journalQuelle).not.toContain('exportSnapshot(')
  })

  it('faehrt NICHT im portablen Format mit', () => {
    // Ein Umraeum-Eintrag benennt Regale, die es in einer fremden
    // Installation nicht gibt: `fromId`/`toId` zeigten ins Leere, und ein
    // Journal, dessen Eintraege auf nichts zeigen, sieht aus wie eine
    // Auskunft. Dieselbe Entscheidung wie beim Ausgabe-Beleg (Bedarf 15).
    expect(portableQuelle).not.toContain('StorageMove')
    expect(portableQuelle).not.toContain('moves')
    expect(storeQuelle).not.toMatch(/exportSnapshot[\s\S]{0,400}moves/)
  })

  it('begruendet die Entscheidung dort, wo jemand sie umdrehen wuerde', () => {
    expect(typenQuelle).toContain('Formatversion')
    expect(typenQuelle).toContain('houseRef')
  })

  it('ist append-only', () => {
    expect(journalQuelle).toContain('...state.moves,')
    // Kein Bearbeiten einzelner Eintraege; `clear` ist der einzige Ausweg und
    // heisst so.
    expect(journalQuelle).not.toContain('updateMove')
    expect(journalQuelle).not.toContain('removeMove')
  })
})

// ── 8. Im Dialog ───────────────────────────────────────────────────────────

describe('der Lager-Dialog', () => {
  it('raeumt den Artikel ueber den Vorgang ein, auch beim ANLEGEN', () => {
    // Der Beleg nennt das Einraeumen eines neu angelegten Artikels
    // ausdruecklich als denselben Tanz.
    expect(dialogQuelle).toContain('const { locationId, ...ohneOrt } = payload')
    expect(dialogQuelle).toContain('moveArticle(form.id, locationId)')
    expect(dialogQuelle).toContain('const neueId = addItem(ohneOrt)')
    expect(dialogQuelle).toContain('moveArticle(neueId, locationId)')
  })
})

// ── 9. Rein ────────────────────────────────────────────────────────────────

describe('das Modul bleibt rein', () => {
  it('hat weder Uhr noch Store noch IO', () => {
    expect(libQuelle).not.toContain('Date.now')
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useInventoryStore')
    expect(libQuelle).not.toContain('localStorage')
  })
})
