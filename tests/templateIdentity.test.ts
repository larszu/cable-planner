import { describe, expect, it, beforeEach } from 'vitest'
import {
  upsertCachedRentmanTemplateFromEquipment,
  getCachedRentmanTemplate,
} from '../src/renderer/lib/rentmanTemplateCache'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ADR-005, Inkrement 3 — zweiter von Hand nachgelesener Hinweis.
//
// `deviceTypeId` ist die stabile Katalog-Identitaet aus ADR-002. Der Kommentar
// in `healItem` sagt dazu: „die Typ-Identitaet muss die Heilung ueberleben;
// genau hier ginge sie sonst still verloren." Genau das passierte eine Datei
// weiter: der Rentman-Template-Cache und `saveEquipmentAsTemplate` bauen ihr
// Template aus einer festen Feldliste neu, und `deviceTypeId` stand auf keiner
// von beiden. Ein Geraet kam aus dem Cache ohne Katalog-Identitaet zurueck und
// der Import fiel auf die Namens-Heuristiken zurueck — aus einer
// Datenblatt-Tatsache wurde wieder ein Regex-Treffer.

const eq = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: 'e1',
    name: 'ATEM Mini Extreme',
    category: 'Videomischer',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rentmanId: 'rm-42',
    deviceTypeId: 'dt-0815',
    ...over,
  }) as unknown as EquipmentItem

describe('Rentman-Template-Cache — Katalog-Identitaet ueberlebt (ADR-005)', () => {
  beforeEach(() => localStorage.clear())

  it('traegt deviceTypeId in den Cache und wieder heraus', () => {
    upsertCachedRentmanTemplateFromEquipment(eq())
    expect(getCachedRentmanTemplate('rm-42')?.deviceTypeId).toBe('dt-0815')
  })

  it('erfindet keine Identitaet, wo das Geraet keine hat', () => {
    // Ein manuell angelegtes Geraet hat keine Katalog-Zeile. Es bekommt hier
    // auch keine — sonst waere die ID eine Behauptung statt einer Tatsache.
    upsertCachedRentmanTemplateFromEquipment(eq({ deviceTypeId: undefined }))
    expect(getCachedRentmanTemplate('rm-42')?.deviceTypeId).toBeUndefined()
  })

  it('schreibt nichts ohne rentmanId', () => {
    upsertCachedRentmanTemplateFromEquipment(eq({ rentmanId: undefined }))
    expect(getCachedRentmanTemplate('rm-42')).toBeUndefined()
  })
})
