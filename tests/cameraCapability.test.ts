import { describe, expect, it } from 'vitest'
import {
  CAMERA_CAPABILITIES,
  CAPABILITY_FINDING_LABEL,
  capabilityFindings,
  capabilityFor,
  controlRows,
  controlSupport,
  modelOf,
  normaliseModel,
} from '../src/renderer/lib/cameraCapability'
import {
  CAMERA_CONTROL_LABEL,
  CONTROL_SUPPORT_LABEL,
  type CameraControl,
} from '../src/renderer/types/cameraCapability'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Bedarf 103 — Fähigkeiten je MODELL, nicht je Hersteller.
//
//   > Within one vendor's own PTZ line, CONTROLS EXIST IN SOFTWARE AND DO
//   > NOTHING ON THE MODEL
//
// Der grösste Teil dieser Tests hält fest, was NICHT behauptet wird: aus einer
// fehlenden Datenblatt-Angabe darf weder ein „geht" noch ein „geht nicht"
// werden.
// ───────────────────────────────────────────────────────────────────────────

const kamera = (over: Partial<EquipmentItem> & { id: string; name: string }): EquipmentItem =>
  ({ category: 'Kameras', x: 0, y: 0, inputs: [], outputs: [], ...over }) as unknown as EquipmentItem

describe('unbekannt ist ein eigener Wert', () => {
  it('gibt für ein Modell ohne Fundstelle „nicht belegt" zurück', () => {
    expect(controlSupport('Irgendeine Kamera', 'colour-temperature')).toBe('unknown')
  })

  it('macht aus einer Lücke kein „nicht unterstützt"', () => {
    // Die tragende Zeile des Bedarfs. Wer aus einer fehlenden Angabe eine
    // Aussage macht, hat ihn umgedreht.
    expect(controlSupport('AW-UE150A', 'zoom')).toBe('unknown')
    expect(controlSupport('AW-UE150A', 'zoom')).not.toBe('unsupported')
  })

  it('macht aus einer Lücke auch kein „unterstützt"', () => {
    expect(controlSupport('AW-UE160', 'detail')).not.toBe('supported')
  })

  it('hat für alle drei Werte ein deutsches Wort', () => {
    expect(Object.keys(CONTROL_SUPPORT_LABEL).sort()).toEqual([
      'supported',
      'unknown',
      'unsupported',
    ])
  })
})

describe('die belegten Aussagen', () => {
  it('kennt die tote Farbtemperatur der AW-UE150A', () => {
    expect(controlSupport('AW-UE150A', 'colour-temperature')).toBe('unsupported')
  })

  it('kennt die toten Farbanteile der AW-UE160', () => {
    expect(controlSupport('AW-UE160', 'red-gain')).toBe('unsupported')
    expect(controlSupport('AW-UE160', 'blue-gain')).toBe('unsupported')
  })

  it('hält die beiden Modelle desselben Herstellers auseinander', () => {
    // Genau der Schaden aus dem Beleg: innerhalb EINER Produktlinie ist das
    // eine tot und das andere nicht.
    expect(controlSupport('AW-UE160', 'colour-temperature')).toBe('unknown')
    expect(controlSupport('AW-UE150A', 'red-gain')).toBe('unknown')
  })

  it('trägt zu jeder Zeile eine Fundstelle — sonst wäre sie eine Behauptung', () => {
    for (const c of CAMERA_CAPABILITIES) {
      expect(c.source.length).toBeGreaterThan(20)
      // Eine Fundstelle nennt, WO es steht.
      expect(c.source).toMatch(/#\d+|HELP\.md|companion-module/)
    }
  })

  it('hat keine Zeile ohne Aussage', () => {
    for (const c of CAMERA_CAPABILITIES) {
      expect(Object.keys(c.controls).length).toBeGreaterThan(0)
    }
  })
})

describe('die Schreibweise entscheidet nicht über die Warnung', () => {
  it('führt Bindestrich, Leerzeichen und Kleinschreibung zusammen', () => {
    expect(normaliseModel('AW-UE150A')).toBe(normaliseModel('aw ue150a'))
    expect(capabilityFor('awue150a')?.model).toBe('AW-UE150A')
    expect(capabilityFor('AW UE 150 A')?.model).toBe('AW-UE150A')
  })

  it('verwechselt zwei Modelle nicht', () => {
    expect(capabilityFor('AW-UE160')?.model).toBe('AW-UE160')
    expect(capabilityFor('AW-UE15')).toBeUndefined()
  })
})

describe('die Liste zeigt alle Funktionen, auch die unbelegten', () => {
  const zeilen = controlRows('AW-UE150A')

  it('lässt keine Funktion weg', () => {
    expect(zeilen).toHaveLength(Object.keys(CAMERA_CONTROL_LABEL).length)
  })

  it('setzt die Reihenfolge fest, nicht alphabetisch', () => {
    // Bewegung, dann Belichtung, dann Farbe, dann Presets — so, wie jemand an
    // einem Pult sucht.
    expect(zeilen[0].control).toBe('pan-tilt')
    expect(zeilen[zeilen.length - 1].control).toBe('preset-store')
  })

  it('nennt die Fundstelle nur an der Zeile, die aus ihr stammt', () => {
    const farbe = zeilen.find((z) => z.control === 'colour-temperature')
    const zoom = zeilen.find((z) => z.control === 'zoom')
    expect(farbe?.source).toBeDefined()
    expect(zoom?.source).toBeUndefined()
  })

  it('zeigt für ein unbekanntes Modell alle Zeilen als „nicht belegt"', () => {
    const unbekannt = controlRows('Sony PXW-FX9')
    expect(unbekannt.every((z) => z.support === 'unknown')).toBe(true)
    expect(unbekannt.length).toBeGreaterThan(0)
  })

  it('hat für jede Funktion ein deutsches Wort', () => {
    for (const z of zeilen) {
      expect(CAMERA_CONTROL_LABEL[z.control as CameraControl].length).toBeGreaterThan(3)
    }
  })
})

describe('was am Plan zu melden ist', () => {
  it('meldet die wirkungslose Funktion mit ihrer Fundstelle', () => {
    const f = capabilityFindings([kamera({ id: 'c1', name: 'AW-UE160' })])
    expect(f.map((x) => x.kind)).toEqual(['control-unsupported', 'control-unsupported'])
    expect(f[0].detail).toContain('companion-module')
  })

  it('meldet ein unbelegtes Modell als BEFUND, nicht als Warnung', () => {
    // Ohne diese Zeile sähe ein Plan voller unbelegter Kameras genauso aus wie
    // einer, dessen Modelle alle geprüft sind.
    const f = capabilityFindings([kamera({ id: 'c1', name: 'Irgendeine PTZ' })])
    expect(f.map((x) => x.kind)).toEqual(['model-unknown'])
  })

  it('lässt alles ohne Kamera-Kategorie in Ruhe', () => {
    const f = capabilityFindings([
      kamera({ id: 's1', name: 'ATEM 4 M/E', category: 'Video' }),
    ])
    expect(f).toEqual([])
  })

  it('nimmt den Modellnamen aus dem Datenblatt, wenn eines dranhängt', () => {
    // Dieselbe Reihenfolge wie in `deviceKind.ts`: Katalog schlägt Getipptes.
    const mitId = kamera({ id: 'c1', name: 'Kamera 1' })
    expect(modelOf(mitId)).toBe('Kamera 1')
  })

  it('hat für jeden Befund einen deutschen Satz', () => {
    for (const t of Object.values(CAPABILITY_FINDING_LABEL)) expect(t.length).toBeGreaterThan(10)
  })
})
