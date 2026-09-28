import { describe, expect, it } from 'vitest'
import { heVonUnten, planRackAusPreset } from '../src/renderer/lib/rackBelegung'
import {
  parseRackBelegung,
  RACK_BELEGUNG_FORMAT,
  RACK_BELEGUNG_VERSION,
  serializeRackBelegung,
} from '../src/renderer/lib/rackBelegungFormat'
import type { GroupPreset } from '../src/renderer/types/equipment'

// Das Austauschformat liegt zeichengleich im inventory-planner
// (src/lib/rackBelegungFormat.ts). Dieser Vertrag steht dort genauso.
const CONTRACT = {
  format: 'avplan-rack-belegung',
  version: 1,
  envelopeKeys: ['app', 'exportedAt', 'format', 'racks', 'version'],
  rackKeys: ['belegung', 'hoeheHE', 'name', 'planRef', 'tiefeMm'],
  zeileKeys: ['hoeheHE', 'label', 'seite', 'startHE'],
} as const

const preset = (placements: NonNullable<GroupPreset['rack']>['placements'], totalUnits = 12): GroupPreset =>
  ({
    id: 'rack-1',
    name: 'Funk-Rack',
    rack: { totalUnits, depthMm: 450, placements },
    items: [{ name: 'ULXD4Q' }, { name: 'Patch 1 HE' }, { name: 'Netzteil' }],
    cables: [],
  }) as unknown as GroupPreset

describe('Rack-Builder -> Lager', () => {
  it('rechnet von der oberen auf die untere Zählung um', () => {
    // Oberste Zeile eines 12-HE-Racks ist von unten HE 12.
    expect(heVonUnten(12, 1, 1)).toBe(12)
    expect(heVonUnten(12, 12, 1)).toBe(1)
    // 2 HE ab Zeile 3 von oben belegen die Zeilen 3 und 4, von unten 9 und 10.
    expect(heVonUnten(12, 3, 2)).toBe(9)
  })

  it('trägt Kennung, Höhe, Tiefe und je Gerät Lage und Namen', () => {
    const r = planRackAusPreset(
      preset([
        { itemIndex: 0, startUnit: 1, heightUnits: 1 },
        { itemIndex: 1, startUnit: 2, heightUnits: 1, mountSide: 'front' },
        { itemIndex: 2, startUnit: 11, heightUnits: 2 },
      ]),
    )!
    expect(r.verworfen).toBe(0)
    expect(r.rack).toEqual({
      planRef: 'rack-1',
      name: 'Funk-Rack',
      hoeheHE: 12,
      tiefeMm: 450,
      belegung: [
        { startHE: 1, hoeheHE: 2, label: 'Netzteil' },
        { startHE: 11, hoeheHE: 1, label: 'Patch 1 HE', seite: 'front' },
        { startHE: 12, hoeheHE: 1, label: 'ULXD4Q' },
      ],
    })
  })

  it('verschiebt kein Gerät, das aus dem Rack ragt, sondern lässt es weg und zählt es', () => {
    const r = planRackAusPreset(preset([{ itemIndex: 0, startUnit: 12, heightUnits: 2 }]))!
    expect(r.rack.belegung).toEqual([])
    expect(r.verworfen).toBe(1)
  })

  it('eine Gruppe ohne Rack ist kein Rack', () => {
    expect(planRackAusPreset({ ...preset([]), rack: undefined })).toBeNull()
  })
})

describe('avplan-rack-belegung Vertrag', () => {
  const rack = planRackAusPreset(preset([{ itemIndex: 1, startUnit: 2, heightUnits: 1, mountSide: 'rear' }]))!.rack

  it('Marker, Version und Feldnamen sind eingefroren', () => {
    expect(RACK_BELEGUNG_FORMAT).toBe(CONTRACT.format)
    expect(RACK_BELEGUNG_VERSION).toBe(CONTRACT.version)
    const datei = JSON.parse(serializeRackBelegung([rack], { app: 'cable-planner', exportedAt: 't' }))
    expect(Object.keys(datei).sort()).toEqual(CONTRACT.envelopeKeys)
    expect(Object.keys(datei.racks[0]).sort()).toEqual(CONTRACT.rackKeys)
    expect(Object.keys(datei.racks[0].belegung[0]).sort()).toEqual(CONTRACT.zeileKeys)
  })

  it('Round-Trip ist verlustfrei', () => {
    expect(parseRackBelegung(serializeRackBelegung([rack]))).toEqual([rack])
  })

  it('lehnt fremdes Format und neuere Version ab', () => {
    expect(parseRackBelegung(JSON.stringify({ format: 'x', version: 1, racks: [] }))).toBeNull()
    expect(parseRackBelegung(JSON.stringify({ format: CONTRACT.format, version: 2, racks: [] }))).toBeNull()
    expect(parseRackBelegung('kein json')).toBeNull()
  })

  it('verwirft eine halb angegebene Zeile, statt sie zu raten', () => {
    const r = parseRackBelegung(
      JSON.stringify({
        format: CONTRACT.format,
        version: 1,
        racks: [{ planRef: 'a', name: 'A', hoeheHE: 4, belegung: [{ startHE: 1, label: 'x' }, { startHE: 2, hoeheHE: 1, label: 'y' }] }],
      }),
    )!
    expect(r[0].belegung).toEqual([{ startHE: 2, hoeheHE: 1, label: 'y' }])
  })
})
