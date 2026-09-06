import { describe, expect, it } from 'vitest'
import {
  HOUSE_REF_NOTE,
  IDENTITY_FINDING_LABEL,
  NO_IDENTITY,
  SERIAL_NOTE,
  identityFindings,
  identityTable,
  unitLabel,
} from '../src/renderer/lib/unitIdentity'
import type { InventoryItem, InventoryUnit } from '../src/renderer/types/inventory'
import { derivePackList } from '../src/renderer/lib/packList'
import { auditScan } from '../src/renderer/lib/inventoryAudit'
import { resolveInventoryCode } from '../src/renderer/lib/inventoryScan'
import typenQuelle from '../src/renderer/types/inventory.ts?raw'
import libQuelle from '../src/renderer/lib/unitIdentity.ts?raw'
import storeQuelle from '../src/renderer/store/inventoryStore.ts?raw'
import packQuelle from '../src/renderer/lib/packList.ts?raw'
import auditQuelle from '../src/renderer/lib/inventoryAudit.ts?raw'
import dialogQuelle from '../src/renderer/components/Inventory/InventoryDialog.tsx?raw'
import netzQuelle from '../src/renderer/components/Properties/sections/NetworkAccessSection.tsx?raw'
import lexikonQuelle from '../src/renderer/lib/dataDictionary.ts?raw'

// ---------------------------------------------------------------------------
// Zwei Identitaeten je Einheit (Bedarf 107, P3).
//
//   > Systems with a single code field force the warehouse to choose which
//   > identity to store; the other one is then needed for insurance, sub-hire
//   > to third parties and maintenance history, and gets kept in a spreadsheet
//   > or ON THE CASE WITH A MARKER.
//
// Der Beleg ist zweiter Hand (Rentman trennt „Internal Reference" von
// „Manufacturer Serial Number", und die Bedarfs-Datenbank zieht daraus den
// Zeitpunkt: „Cheap today, expensive after the first real deployment.").
// Gebaut wird deshalb genau das, was aus dem Mechanismus folgt — zwei Felder,
// eine Regel wer welches liest — und nichts, was eine Herkunft raten wuerde.
// ---------------------------------------------------------------------------

const unit = (over: Partial<InventoryUnit> = {}): InventoryUnit =>
  ({
    id: over.id ?? 'u1',
    itemId: over.itemId ?? 'm1',
    condition: over.condition ?? 'ok',
    history: [],
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as InventoryUnit

const item = (id = 'm1', model = 'Sony PXW-Z750'): InventoryItem =>
  ({ id, model, quantity: 1, createdAt: '', updatedAt: '' }) as unknown as InventoryItem

// ── 1. Zwei Felder, nicht eines ────────────────────────────────────────────

describe('das Lager muss sich nicht fuer eine Identitaet entscheiden', () => {
  it('traegt Herstellernummer und Hausreferenz nebeneinander', () => {
    const u = unit({ serial: 'S0134-77', houseRef: 'AV-0421' })
    expect(u.serial).toBe('S0134-77')
    expect(u.houseRef).toBe('AV-0421')
  })

  it('nennt `serial` im Typ ausdruecklich die HERSTELLER-Nummer', () => {
    // Das Feld hiess „Hersteller ODER intern" — genau die Formulierung, die
    // das Lager zur Wahl zwang. Wer sie zurueckschreibt, hebt den Bedarf auf.
    const start = typenQuelle.indexOf('Bedarf 107')
    expect(start).toBeGreaterThan(0)
    const block = typenQuelle.slice(start, typenQuelle.indexOf('code?: string', start))
    expect(block).toContain('serial?: string')
    expect(block).toContain('houseRef?: string')
    expect(typenQuelle).not.toContain('Seriennummer (Hersteller oder intern)')
  })

  it('laesst die Hausreferenz durch die Bearbeitung durch', () => {
    // `updateUnit` ist der einzige Weg, Stammfelder einer bestehenden Einheit
    // zu aendern. Fehlt `houseRef` in seiner Signatur, laesst sich das Feld
    // zwar anlegen, aber nie korrigieren.
    expect(storeQuelle).toMatch(/updateUnit:[^\n]*'serial' \| 'houseRef'/)
  })
})

// ── 2. Die Heilung raet nicht ──────────────────────────────────────────────

describe('ein Altbestand wird nicht umgebucht', () => {
  it('heilt `houseRef` als eigenes Feld', () => {
    expect(storeQuelle).toContain(
      "houseRef: typeof r.houseRef === 'string' && r.houseRef.trim() ? r.houseRef.trim() : undefined",
    )
  })

  it('leitet die Hausreferenz NIE aus der Seriennummer ab', () => {
    // Der teuerste denkbare Fehler dieses Bedarfs: eine Migration, die
    // `serial` nach `houseRef` kopiert. Aus einer Herstellernummer wuerde
    // eine Hausnummer, die die Versicherung nicht kennt — und niemand saehe
    // es, weil beide Felder danach gefuellt sind.
    const start = storeQuelle.indexOf('const healUnit')
    expect(start).toBeGreaterThan(0)
    const heilung = storeQuelle.slice(start, storeQuelle.indexOf('const load', start))
    expect(heilung).toContain('houseRef')
    expect(heilung).not.toMatch(/houseRef[^\n]*r\.serial/)
    expect(heilung).not.toMatch(/serial[^\n]*\?\?[^\n]*r\.houseRef/)
  })
})

// ── 3. Wer liest, entscheidet ──────────────────────────────────────────────

describe('unitLabel — wer liest, entscheidet was vorne steht', () => {
  const beide = unit({ serial: 'S0134-77', houseRef: 'AV-0421', code: 'QR-9' })

  it('zeigt dem Haus die Hausreferenz', () => {
    expect(unitLabel(beide, 'house')).toBe('AV-0421')
  })

  it('zeigt der Versicherung die Herstellernummer', () => {
    expect(unitLabel(beide, 'external')).toBe('S0134-77')
  })

  it('benennt die Ersatz-Nummer, statt sie als die andere auszugeben', () => {
    // „AV-0421" allein auf einem Versicherungsblatt ist eine Verwechslung,
    // „AV-0421 (Hausreferenz)" eine Auskunft.
    const nurHaus = unit({ houseRef: 'AV-0421' })
    expect(unitLabel(nurHaus, 'external')).toBe(`AV-0421 (${HOUSE_REF_NOTE})`)
    const nurSerie = unit({ serial: 'S0134-77' })
    expect(unitLabel(nurSerie, 'house')).toBe(`S0134-77 (${SERIAL_NOTE})`)
  })

  it('nimmt den Etiketten-Code erst an dritter Stelle', () => {
    // Der Code ist eine Scan-Kennung, keine Identitaet: nach einer
    // Ausmusterung kann derselbe Aufkleber an einer anderen Kiste haengen.
    expect(unitLabel(unit({ code: 'QR-9' }), 'house')).toBe('QR-9')
    expect(unitLabel(unit({ code: 'QR-9' }), 'external')).toBe('QR-9')
    expect(unitLabel(unit({ houseRef: 'AV-0421', code: 'QR-9' }), 'house')).toBe('AV-0421')
  })

  it('sagt „ohne Nummer" statt eine id-Haelfte zu zeigen', () => {
    // Vorher stand hier `u.id.slice(0, 6)` — ein uuid-Fragment, das aussieht
    // wie eine Nummer und keine ist. Ein benanntes Ergebnis ist ehrlicher.
    const nackt = unit({ id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
    expect(unitLabel(nackt, 'house')).toBe(NO_IDENTITY)
    expect(unitLabel(nackt, 'external')).toBe(NO_IDENTITY)
    expect(unitLabel(nackt, 'house')).not.toContain('f47ac1')
  })

  it('behandelt reine Leerzeichen wie ein leeres Feld', () => {
    expect(unitLabel(unit({ houseRef: '   ', serial: 'S1' }), 'house')).toBe(
      `S1 (${SERIAL_NOTE})`,
    )
    expect(unitLabel(unit({ houseRef: ' AV-1 ' }), 'house')).toBe('AV-1')
  })
})

// ── 4. Die Engstelle ───────────────────────────────────────────────────────

describe('die Regel steht an genau einer Stelle', () => {
  it('hat kein Modul mehr eine eigene Kopie der Reihenfolge', () => {
    // Die Zeile `u.serial || u.code || u.id.slice(0, 6)` stand an vier
    // Stellen. Vier Kopien einer Regel, die sich mit zwei Identitaeten
    // aendern MUSS — beim Aendern haette man eine uebersehen.
    for (const quelle of [packQuelle, auditQuelle, dialogQuelle, netzQuelle]) {
      expect(quelle).not.toMatch(/id\.slice\(0, ?6\)/)
      expect(quelle).toContain("unitLabel(")
    }
  })

  it('liest die Packliste als HAUS-Blatt', () => {
    const u = unit({ id: 'u1', serial: 'S0134-77', houseRef: 'AV-0421', locationId: 'n1' })
    const zeilen = derivePackList(
      'n1',
      { items: [item()], nodes: [{ id: 'n1', kind: 'case', name: 'Case 1' } as never], units: [u] },
      '2026-09-06',
    )
    const flach = JSON.stringify(zeilen)
    expect(flach).toContain('AV-0421')
    expect(flach).not.toContain('S0134-77')
  })

  it('findet eine Einheit auch ueber die abgetippte Hausreferenz', () => {
    // Die Hausreferenz ist die wahrscheinlichste Eingabe von allen: sie klebt
    // auf dem Case, und sie wird abgetippt, wenn der Aufkleber unlesbar ist.
    // Ein Identitaets-Feld, das die Suche nicht kennt, ist fuer den Lageristen
    // nicht vorhanden.
    const u = unit({ id: 'u1', serial: 'S0134-77', houseRef: 'AV-0421' })
    const treffer = resolveInventoryCode('av-0421', { items: [item()], nodes: [], units: [u] })
    expect(treffer).toEqual({ kind: 'unit', unit: u })
    expect(resolveInventoryCode('S0134-77', { items: [item()], nodes: [], units: [u] })).toEqual({
      kind: 'unit',
      unit: u,
    })
  })

  it('liest die Inventur als HAUS-Blatt', () => {
    const u = unit({ id: 'u1', serial: 'S0134-77', houseRef: 'AV-0421', code: 'QR-9' })
    const treffer = auditScan('QR-9', 'n1', { items: [item()], nodes: [], units: [u], sets: [] })
    expect(treffer.label).toBe('AV-0421')
  })
})

// ── 5. Was an den Nummern nicht stimmt ─────────────────────────────────────

describe('identityFindings', () => {
  it('meldet zwei Einheiten mit derselben Herstellernummer', () => {
    const f = identityFindings([
      unit({ id: 'a', serial: 'S0134-77' }),
      unit({ id: 'b', serial: 'S0134-77' }),
      unit({ id: 'c', serial: 'S0134-78' }),
    ])
    const dopp = f.filter((x) => x.kind === 'serial-duplicate')
    expect(dopp).toHaveLength(1)
    expect(dopp[0].unitIds).toEqual(['a', 'b'])
    expect(dopp[0].text).toContain('Inventur')
  })

  it('zaehlt „av-0421" und „AV0421" als dieselbe Nummer', () => {
    // Zweimal getippt, einmal mit Bindestrich: derselbe Aufkleber. Wer hier
    // buchstabengenau vergleicht, meldet den haeufigsten Fall nicht.
    const f = identityFindings([
      unit({ id: 'a', houseRef: 'av-0421' }),
      unit({ id: 'b', houseRef: 'AV0421' }),
    ])
    expect(f.map((x) => x.kind)).toEqual(['houseref-duplicate'])
    expect(f[0].unitIds).toEqual(['a', 'b'])
  })

  it('trennt die beiden Doppelungen', () => {
    // Dieselbe Zeichenfolge einmal als Herstellernummer, einmal als
    // Hausreferenz ist KEINE Doppelung: die beiden leben in verschiedenen
    // Namensräumen.
    const f = identityFindings([
      unit({ id: 'a', serial: 'X-1' }),
      unit({ id: 'b', houseRef: 'X-1' }),
    ])
    expect(f).toEqual([])
  })

  it('schweigt bei leeren Feldern statt sie als Doppelung zu zaehlen', () => {
    const f = identityFindings([
      unit({ id: 'a', serial: '', houseRef: '  ', code: 'QR-1' }),
      unit({ id: 'b', serial: undefined, houseRef: undefined, code: 'QR-2' }),
    ])
    expect(f).toEqual([])
  })

  it('meldet Einheiten ganz ohne Nummer gesammelt', () => {
    const f = identityFindings([
      unit({ id: 'a' }),
      unit({ id: 'b' }),
      unit({ id: 'c', code: 'QR-1' }),
    ])
    const ohne = f.filter((x) => x.kind === 'no-identity')
    expect(ohne).toHaveLength(1)
    expect(ohne[0].unitIds).toEqual(['a', 'b'])
    expect(ohne[0].text).toContain(NO_IDENTITY)
  })

  it('haelt fuer jede Befundart eine lesbare Ueberschrift bereit', () => {
    for (const kind of ['serial-duplicate', 'houseref-duplicate', 'no-identity'] as const) {
      expect(IDENTITY_FINDING_LABEL[kind].length).toBeGreaterThan(10)
    }
  })
})

// ── 6. Das Blatt mit beiden Nummern ────────────────────────────────────────

describe('identityTable', () => {
  it('stellt beide Identitaeten nebeneinander', () => {
    const t = identityTable([unit({ serial: 'S0134-77', houseRef: 'AV-0421', code: 'QR-9' })], () =>
      'Sony PXW-Z750',
    )
    expect(t.headers).toEqual(['Modell', 'Herstellernummer', 'Hausreferenz', 'Etiketten-Code'])
    expect(t.rows[0]).toEqual(['Sony PXW-Z750', 'S0134-77', 'AV-0421', 'QR-9'])
  })

  it('schreibt „ohne Nummer" statt einer leeren Zelle', () => {
    const t = identityTable([unit({ serial: 'S1' })], () => 'Modell')
    expect(t.rows[0]).toEqual(['Modell', 'S1', NO_IDENTITY, NO_IDENTITY])
  })

  it('hat fuer jede Spalte einen Lexikon-Eintrag', () => {
    // Ein Blatt, das die Versicherung liest, braucht die Erklaerung, WELCHE
    // der beiden Nummern in welcher Spalte steht — sonst hat die Trennung
    // auf dem Papier wieder nur eine Bedeutung.
    for (const spalte of ['Herstellernummer', 'Hausreferenz']) {
      expect(lexikonQuelle).toContain(`${spalte}:`)
    }
  })
})

// ── 7. Beides ist im Dialog erreichbar ─────────────────────────────────────

describe('der Bestandsdialog', () => {
  const marker = dialogQuelle.indexOf('BEDARF 107 — zwei Identitäten')
  const formular = dialogQuelle.slice(marker, dialogQuelle.indexOf("t('inventory.code'", marker))

  it('hat ein eigenes Eingabefeld fuer die Hausreferenz', () => {
    expect(marker).toBeGreaterThan(0)
    expect(formular.length).toBeGreaterThan(200)
    expect(formular).toContain("t('inventory.houseRef'")
    expect(formular).toContain('form.houseRef')
    expect(formular).toContain('houseRef: e.target.value')
  })

  it('speichert die Hausreferenz beim Anlegen UND beim Bearbeiten', () => {
    expect(dialogQuelle).toContain("houseRef: form.houseRef?.trim() || undefined")
    expect(dialogQuelle).toMatch(/updateUnit\(form\.id, \{[^}]*houseRef: payload\.houseRef/)
  })

  it('zeigt beide Nummern in der Liste, unterscheidbar', () => {
    expect(dialogQuelle).toContain('{u.serial && <span')
    expect(dialogQuelle).toContain('{u.houseRef && <span')
    expect(dialogQuelle).toContain('#{u.houseRef}')
  })

  it('stellt die Befunde ueber die Liste', () => {
    const befundBlock = dialogQuelle.indexOf('identitaetsBefunde.length > 0')
    const liste = dialogQuelle.indexOf('units.length === 0')
    expect(befundBlock).toBeGreaterThan(0)
    expect(befundBlock).toBeLessThan(liste)
  })
})

// ── 8. Rein ────────────────────────────────────────────────────────────────

describe('das Modul bleibt rein', () => {
  it('hat weder Uhr noch Store noch IO', () => {
    expect(libQuelle).not.toContain('Date.now')
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useInventoryStore')
    expect(libQuelle).not.toContain('window.')
  })
})
