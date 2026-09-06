import { describe, expect, it } from 'vitest'
import { damageEntries, damageTable, damageTally } from '../src/renderer/lib/damageRegister'
import { closeCheckout } from '../src/renderer/lib/containerCheckout'
import type { CheckoutLine, CheckoutRecord } from '../src/renderer/types/checkout'
import inventarQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'
import storeQuelle from '../src/renderer/store/checkoutStore.ts?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Schaden mit Zuordnung (Bedarf 68, P2).
//
//   > Damage evidence is photos in a WhatsApp thread plus a paper condition
//   > form […] an undocumented load-out becomes an UNCHARGED, UNATTRIBUTABLE
//   > loss.
//
//   > Damage capture belongs on the device already in their hand AT CHECK-IN,
//   > and the valuable field is THE ATTRIBUTION (job, person, time,
//   > container), not the photo. Feeds the invoice-or-absorb decision
//   > directly.
//
// Beleg: grokability/snipe-it#13153 — ein Reparatur-Datensatz soll festhalten,
// WEM das Geraet zugeordnet war und WO es stand, „to see whether particular
// people/locations tend to break devices more often".
// ---------------------------------------------------------------------------

const line = (label: string, over: Partial<CheckoutLine> = {}): CheckoutLine => ({
  kind: 'item',
  refId: `id-${label}`,
  label,
  quantity: 1,
  ...over,
})

const record = (over: Partial<CheckoutRecord> = {}): CheckoutRecord => ({
  id: 'r1',
  nodeId: 'c1',
  nodeLabel: 'Case 1',
  out: { at: '2026-09-01T08:00:00Z', to: 'Jan', projectName: 'Show B' },
  contents: [line('Objektiv'), line('Stativ')],
  ...over,
})

describe('der Schaden landet im Beleg, nicht in den Fehlmengen', () => {
  it('schreibt den aufgenommenen Schaden in die Rueckgabe', () => {
    const r = closeCheckout(record(), record().contents, '2026-09-10T17:00:00Z', undefined, [
      { line: line('Objektiv'), note: 'Frontlinse zerkratzt' },
    ])
    expect(r.in?.damaged).toHaveLength(1)
    expect(r.in?.damaged?.[0].note).toBe('Frontlinse zerkratzt')
  })

  it('zaehlt ein beschaedigtes Objekt NICHT als fehlend', () => {
    // Es unter die Fehlmengen zu schreiben waere zweimal falsch: die Rueckgabe
    // saehe unvollstaendig aus, und der Schaden waere als Verlust verbucht.
    const r = closeCheckout(record(), record().contents, '2026-09-10T17:00:00Z', undefined, [
      { line: line('Objektiv'), note: 'kaputt' },
    ])
    expect(r.in?.missing).toEqual([])
  })

  it('verwirft einen Eintrag ohne Text', () => {
    // „beschaedigt" ohne Angabe hilft weder der Werkstatt noch der Rechnung,
    // und eine leere Zeile im Beleg sieht aus wie eine Aussage.
    const r = closeCheckout(record(), record().contents, '2026-09-10T17:00:00Z', undefined, [
      { line: line('Objektiv'), note: '   ' },
    ])
    expect(r.in?.damaged).toBeUndefined()
  })

  it('trimmt den Text, statt ihn roh zu speichern', () => {
    const r = closeCheckout(record(), record().contents, '2026-09-10T17:00:00Z', undefined, [
      { line: line('Objektiv'), note: '  Bajonett locker  ' },
    ])
    expect(r.in?.damaged?.[0].note).toBe('Bajonett locker')
  })

  it('ohne Schaeden bleibt das Feld ganz weg', () => {
    const r = closeCheckout(record(), record().contents, '2026-09-10T17:00:00Z')
    expect(r.in?.damaged).toBeUndefined()
  })
})

describe('die Zuordnung wird abgeleitet, nicht gespeichert', () => {
  const geschlossen = (over: Partial<CheckoutRecord> = {}): CheckoutRecord =>
    closeCheckout(record(over), record(over).contents, '2026-09-10T17:00:00Z', undefined, [
      { line: line('Objektiv'), note: 'Frontlinse zerkratzt' },
    ])

  it('nennt Show, Person, Container und Zeit', () => {
    // Genau die vier Felder, die der Bedarf „the valuable field" nennt — und
    // kein einziges davon ist gespeichert.
    const e = damageEntries([geschlossen()])[0]
    expect(e).toMatchObject({
      label: 'Objektiv',
      job: 'Show B',
      person: 'Jan',
      container: 'Case 1',
      at: '2026-09-10T17:00:00Z',
    })
  })

  it('folgt einer Korrektur am Vorgang, statt sie zu ueberleben', () => {
    // Der Punkt der Ableitung: vier gespeicherte Felder waeren ab der ersten
    // Korrektur falsch.
    const e = damageEntries([geschlossen({ nodeLabel: 'Case 7', out: { at: 't', to: 'Mira', projectName: 'Show C' } })])[0]
    expect(e.person).toBe('Mira')
    expect(e.job).toBe('Show C')
    expect(e.container).toBe('Case 7')
  })

  it('nennt JEDE fehlende Angabe, statt sie leer zu lassen', () => {
    // „Wir wissen nicht, auf welcher Show" ist die Auskunft, die den naechsten
    // Vorgang besser macht; eine leere Zelle ist keine. Das gilt fuer BEIDE
    // Freitext-Felder -- die erste Fassung dieser Pruefung sah nur die Show,
    // und eine Gegenprobe, die den Rueckfall bei der Person entfernte, blieb
    // gruen.
    const ohneShow = damageEntries([geschlossen({ out: { at: 't', to: 'Jan' } })])[0]
    expect(ohneShow.job).toBe('nicht benannt')
    const ohnePerson = damageEntries([geschlossen({ out: { at: 't', to: '  ', projectName: 'S' } })])[0]
    expect(ohnePerson.person).toBe('nicht benannt')
  })

  it('ignoriert offene Vorgaenge — dort gibt es noch keine Rueckgabe', () => {
    // Strukturell garantiert: ein offener Vorgang hat kein `in`, und die
    // Schaeden haengen daran. Diese Zeile haelt die FORM fest, damit ein
    // zweiter Speicherort dafuer auffaellt statt sich einzuschleichen.
    expect(damageEntries([record()])).toEqual([])
    expect(record().in).toBeUndefined()
  })

  it('setzt die juengste Rueckgabe nach oben', () => {
    const alt = closeCheckout(record({ id: 'alt' }), record().contents, '2026-09-01T10:00:00Z', undefined, [
      { line: line('Stativ'), note: 'Bein verbogen' },
    ])
    const neu = closeCheckout(record({ id: 'neu' }), record().contents, '2026-09-12T10:00:00Z', undefined, [
      { line: line('Objektiv'), note: 'zerkratzt' },
    ])
    expect(damageEntries([alt, neu]).map((e) => e.recordId)).toEqual(['neu', 'alt'])
  })
})

describe('die Haeufung zaehlt und urteilt nicht', () => {
  const mit = (id: string, to: string, note: string) =>
    closeCheckout(record({ id, out: { at: 't', to, projectName: 'S' } }), record().contents, `2026-09-1${id}T10:00:00Z`, undefined, [
      { line: line('Objektiv'), note },
    ])

  it('sortiert nach Anzahl, die groesste zuerst', () => {
    const r = [mit('1', 'Jan', 'a'), mit('2', 'Jan', 'b'), mit('3', 'Mira', 'c')]
    expect(damageTally(r, 'person')).toEqual([
      { key: 'Jan', count: 2 },
      { key: 'Mira', count: 1 },
    ])
  })

  it('kann auch nach Container und Show zaehlen', () => {
    const r = [mit('1', 'Jan', 'a')]
    expect(damageTally(r, 'container')[0].key).toBe('Case 1')
    expect(damageTally(r, 'job')[0].key).toBe('S')
  })

  it('gibt ohne Vorfaelle eine LEERE Liste, keine Null-Zeile', () => {
    // Der Aufrufer zeigt dann nichts, statt „0 Schaeden" zu melden.
    expect(damageTally([record()], 'person')).toEqual([])
  })
})

describe('das Blatt fuer „berechnen oder tragen"', () => {
  it('traegt alle vier Zuordnungs-Spalten', () => {
    const r = closeCheckout(record(), record().contents, '2026-09-10T17:00:00Z', undefined, [
      { line: line('Objektiv', { code: 'INV-7' }), note: 'zerkratzt' },
    ])
    const t = damageTable([r])
    expect(t.headers).toEqual([
      'Zurueck am',
      'Objekt',
      'Etiketten-Code',
      'Schaden',
      'Show',
      'Ausgegeben an',
      'Container',
    ])
    expect(t.rows[0]).toEqual([
      '2026-09-10',
      'Objektiv',
      'INV-7',
      'zerkratzt',
      'Show B',
      'Jan',
      'Case 1',
    ])
  })

  it('sagt „kein Etikett", statt die interne Id zu drucken', () => {
    // Dieselbe Regel wie beim Ausgabeschein (Bedarf 16): eine unscannbare
    // Zeichenkette in einer Spalte namens „Etiketten-Code" sieht benutzbar aus.
    const r = closeCheckout(record(), record().contents, '2026-09-10T17:00:00Z', undefined, [
      { line: line('Objektiv'), note: 'x' },
    ])
    expect(damageTable([r]).rows[0][2]).toBe('kein Etikett')
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Eine Aufnahme, die es nur in der Bibliothek gibt, nimmt
// nichts auf.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit im Lager-Dialog', () => {
  it('nimmt den Schaden VOR dem Zurueckbuchen auf', () => {
    // Danach ist der Beleg zu, und ein Beleg darf nicht nachtraeglich anders
    // lauten.
    expect(inventarQuelle).toContain('checkIn(snap, r.id, undefined, damageOf(r))')
    expect(inventarQuelle).toContain("t('inventory.checkout.damagePh'")
  })

  it('reicht die Schaeden durch den Store bis in den Beleg', () => {
    expect(storeQuelle).toContain('damaged?: CheckoutDamage[]')
    // Nicht per Regex ueber die Argumentliste: der Aufruf enthaelt ein
    // verschachteltes `containerContents(...)`, und `[^)]*` bricht an dessen
    // Klammer ab. Die letzten drei Argumente reichen als Zusicherung.
    expect(storeQuelle).toContain('at, note, damaged)')
  })

  it('leert den Entwurf nach dem Zurueckbuchen', () => {
    // Ein stehengebliebener Text landete beim naechsten Vorgang im falschen
    // Beleg.
    expect(inventarQuelle).toContain('setDamageDraft((d) => ({ ...d, [r.id]: {} }))')
  })

  it('zeigt die Schaeden mit ihrer Zuordnung und die Haeufung', () => {
    expect(inventarQuelle).toContain('damageEntries(records)')
    expect(inventarQuelle).toContain("damageTally(records, 'person')")
    expect(inventarQuelle).toContain('{schaeden.length > 0 && (')
    expect(inventarQuelle).toContain('damageTable(records)')
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'inventory.checkout.damageBtn',
      'inventory.checkout.damageTitle',
      'inventory.checkout.damagePh',
      'inventory.checkout.damageTitleList',
      'inventory.checkout.damageLine',
      'inventory.checkout.damageTally',
    ]) {
      expect(inventarQuelle).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
