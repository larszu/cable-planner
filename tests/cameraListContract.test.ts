// ───────────────────────────────────────────────────────────────────────────
// Drift-Guard fuer das Kamera-Listen-Format `camera-list` v3 (liest v1 und v2 weiter).
//
// Das Format ist in ZWEI Apps dupliziert: multicam-planner schreibt
// (src/utils/cameraExport.ts), cable-planner liest (src/renderer/lib/
// multicamCameraImport.ts). Beide Modulkoepfe behaupten einander:
// „Schema-identisch zum Cable-Planner" bzw. „Gegenstueck: multicam-planner".
//
// Diese Behauptung stand bis ADR-005 Inkrement 4 unter KEINEM Test. Beide
// Seiten testeten nur sich selbst gegen selbstgeschriebene Fixtures — eine
// Aenderung auf einer Seite waere auf beiden Seiten gruen durchgelaufen.
// Die Schemata waren dabei tatsaechlich identisch; es hielt sie nur nichts.
//
// Gleiches Muster wie tests/inventoryContract.test.ts: der eingefrorene
// CONTRACT unten steht WORTGLEICH in multicam-planner
// src/__tests__/cameraListContract.test.ts. Aendert jemand das Schema in
// EINEM Repo, schlaegt dessen Guard fehl. Kein Test in einem Repo kann den
// Code des anderen ausfuehren — aber Auseinanderlaufen wird laut, statt still.
//
// !!! Wenn dieser Contract bewusst geaendert wird:
//   1. CAMERA_LIST_VERSION erhoehen (Abwaertskompatibilitaet beachten),
//   2. die identische Aenderung im multicam-planner nachziehen,
//   3. die eingefrorenen Key-Listen in BEIDEN Guards anpassen.
// ───────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { interfaceKeys } from './support/interfaceKeys'
import importerSrc from '../src/renderer/lib/multicamCameraImport.ts?raw'
import {
  CAMERA_LIST_KIND,
  CAMERA_LIST_VERSION,
  parseCameraList,
  cameraListToEquipment,
  type CameraListEntry,
  type CameraListExchange,
  type CameraListLens,
  type CameraListPreset,
} from '../src/renderer/lib/multicamCameraImport'

// Eingefrorener Contract — MUSS in beiden Repos identisch sein.
const CONTRACT = {
  kind: 'camera-list',
  version: 3,
  envelopeKeys: ['app', 'appVersion', 'cameras', 'exportedAt', 'formatVersion', 'kind', 'projectId'],
  entryKeys: ['deviceTypeId', 'extender', 'focalMm', 'id', 'label', 'lens', 'manufacturer', 'model', 'mount', 'pan', 'presets', 'tilt', 'x', 'y', 'z'],
  lensKeys: ['focalMaxMm', 'focalMinMm', 'manufacturer', 'model', 'mount'],
  presetKeys: ['focalMm', 'focusM', 'name', 'number', 'pan', 'savedAt', 'segment', 'tilt'],
} as const

// Voll besetzter Muster-Eintrag (jedes Feld gesetzt).
const lens: CameraListLens = {
  manufacturer: 'Fujinon',
  model: 'UA24x7.8',
  focalMinMm: 7.8,
  focalMaxMm: 187,
  mount: 'B4',
}
const preset: CameraListPreset = {
  number: 3,
  name: 'Pult',
  segment: 'Begrüßung',
  pan: 12.5,
  tilt: -4,
  focalMm: 85,
  focusM: 9.2,
  savedAt: '2026-09-06T10:00:00.000Z',
}
const entry: CameraListEntry = {
  id: 'vc1',
  label: 'Kamera 1',
  manufacturer: 'Blackmagic Design',
  model: 'URSA Broadcast G2',
  deviceTypeId: 'dt-cam-0001',
  x: 3.5,
  y: 7.25,
  z: 1.6,
  mount: 'B4',
  focalMm: 50,
  extender: 2,
  lens,
  pan: 180,
  tilt: -3,
  presets: [preset],
}
const exchange: CameraListExchange = {
  kind: CAMERA_LIST_KIND,
  formatVersion: CAMERA_LIST_VERSION,
  app: 'multicam-planner',
  appVersion: '1.2.3',
  exportedAt: '2026-01-01T00:00:00.000Z',
  projectId: 'mc-projekt-1',
  cameras: [entry],
}

const sortedKeys = (o: object) => Object.keys(o).sort()

describe('camera-list Wire-Contract (Drift-Guard)', () => {
  it('Format-Marker + Version sind eingefroren', () => {
    expect(CAMERA_LIST_KIND).toBe(CONTRACT.kind)
    expect(CAMERA_LIST_VERSION).toBe(CONTRACT.version)
  })

  it('Envelope-Shape ist eingefroren', () => {
    expect(sortedKeys(exchange)).toEqual(CONTRACT.envelopeKeys)
  })

  it('Feld-Namen des Kamera-Eintrags sind eingefroren', () => {
    expect(sortedKeys(entry)).toEqual(CONTRACT.entryKeys)
    expect(sortedKeys(lens)).toEqual(CONTRACT.lensKeys)
    expect(sortedKeys(preset)).toEqual(CONTRACT.presetKeys)
  })

  it('faengt auch ein neu hinzugefuegtes OPTIONALES Feld', () => {
    // Die Muster-Literale oben allein wuerden das nicht tun: ein optionales
    // Feld laesst sie unveraendert kompilieren. Deshalb hier gegen den
    // Interface-Rumpf im Quelltext — die einzige Pruefung, die unter
    // `npm test` tatsaechlich laeuft (tests/ liegt ausserhalb der tsconfigs).
    expect(interfaceKeys(importerSrc, 'CameraListEntry')).toEqual(CONTRACT.entryKeys)
    expect(interfaceKeys(importerSrc, 'CameraListExchange')).toEqual(CONTRACT.envelopeKeys)
    expect(interfaceKeys(importerSrc, 'CameraListLens')).toEqual(CONTRACT.lensKeys)
    expect(interfaceKeys(importerSrc, 'CameraListPreset')).toEqual(CONTRACT.presetKeys)
  })

  it('parse akzeptiert den eingefrorenen Envelope', () => {
    const back = parseCameraList(JSON.stringify(exchange))
    expect(back).toEqual(exchange)
  })

  it('parse lehnt fremdes Format und fremde Version ab', () => {
    expect(() => parseCameraList(JSON.stringify({ ...exchange, kind: 'something-else' }))).toThrow()
    expect(() =>
      parseCameraList(JSON.stringify({ ...exchange, formatVersion: CONTRACT.version + 1 })),
    ).toThrow()
    expect(() => parseCameraList(JSON.stringify({ ...exchange, cameras: undefined }))).toThrow()
    expect(() => parseCameraList('not json')).toThrow()
  })

  it('liest v1 weiter — eine alte Datei bleibt lesbar', () => {
    const v1 = {
      kind: 'camera-list',
      formatVersion: 1,
      app: 'multicam-planner',
      appVersion: '1.0.0',
      exportedAt: '2026-01-01T00:00:00.000Z',
      cameras: [{ id: 'a', label: 'CAM A', x: 1, y: 2 }],
    }
    expect(parseCameraList(JSON.stringify(v1)).cameras).toHaveLength(1)
  })

  it('prueft die Bedeutung der Felder, nicht nur ihre Namen', () => {
    const mit = (e: Record<string, unknown>) => JSON.stringify({ ...exchange, cameras: [{ ...entry, ...e }] })
    expect(() => parseCameraList(mit({ id: '' }))).toThrow()
    expect(() => parseCameraList(mit({ x: 'links' }))).toThrow()
    expect(() => parseCameraList(mit({ focalMm: 0 }))).toThrow()
    expect(() => parseCameraList(mit({ extender: -2 }))).toThrow()
    expect(() => parseCameraList(mit({ lens: 'Fujinon' }))).toThrow()
    expect(() => parseCameraList(mit({ lens: { ...lens, focalMaxMm: 'lang' } }))).toThrow()
    expect(() =>
      parseCameraList(JSON.stringify({ ...exchange, cameras: [entry, { ...entry, label: 'Doppelt' }] })),
    ).toThrow()
    // v3 — ein Preset ist nachstellbar oder die Datei laedt nicht.
    const mitPreset = (p: Record<string, unknown>) => mit({ presets: [{ ...preset, ...p }] })
    expect(() => parseCameraList(mitPreset({ number: -1 }))).toThrow(/number/)
    expect(() => parseCameraList(mitPreset({ number: 2.5 }))).toThrow(/number/)
    expect(() => parseCameraList(mitPreset({ focalMm: 0 }))).toThrow(/focalMm/)
    expect(() => parseCameraList(mitPreset({ focusM: -1 }))).toThrow(/focusM/)
    for (const feld of ['pan', 'tilt', 'focalMm', 'focusM', 'savedAt']) {
      expect(() => parseCameraList(mitPreset({ [feld]: undefined })), feld).toThrow(new RegExp(feld))
    }
    expect(() => parseCameraList(mit({ presets: { 3: preset } }))).toThrow(/presets/)
    expect(() => parseCameraList(mit({ pan: 'links' }))).toThrow(/pan/)
  })

  it('liest v2 weiter — ohne Ausrichtung und ohne Presets', () => {
    const { pan: _p, tilt: _t, presets: _ps, ...v2Eintrag } = entry
    const back = parseCameraList(JSON.stringify({ ...exchange, formatVersion: 2, cameras: [v2Eintrag] }))
    expect(back.formatVersion).toBe(2)
    expect(cameraListToEquipment(back)[0].kameraPresets).toBeUndefined()
  })

  it('verbraucht JEDES Feld des Eintrags — kein Feld faellt still hinten runter', () => {
    // Der Gegenbeweis zur Frage „was liest der Importer nicht, obwohl es
    // geschrieben wird?". Jedes Feld muss sich im Ergebnis wiederfinden,
    // sonst traegt das Format Daten, die nirgends ankommen.
    const [eq] = cameraListToEquipment(exchange)
    expect(eq.multicamId).toBe(entry.id) // id
    expect(eq.multicamProjectId).toBe(exchange.projectId) // projectId
    expect(eq.name).toBe(entry.label) // label
    expect(eq.deviceTypeId).toBe(entry.deviceTypeId) // deviceTypeId
    expect(eq.x).toBe(Math.round(entry.x! * 120)) // x (Meter -> Pixel)
    expect(eq.y).toBe(Math.round(entry.y! * 120)) // y
    expect(eq.optik).toEqual({
      objektivHersteller: lens.manufacturer,
      objektivModell: lens.model,
      brennweiteMinMm: lens.focalMinMm,
      brennweiteMaxMm: lens.focalMaxMm,
      objektivMount: lens.mount,
      kameraMount: entry.mount,
      brennweiteMm: entry.focalMm,
      extender: entry.extender,
      hoeheM: entry.z,
      panGrad: entry.pan,
      neigungGrad: entry.tilt,
    })
    expect(eq.kameraPresets).toEqual([
      {
        nummer: preset.number,
        name: preset.name,
        segment: preset.segment,
        panGrad: preset.pan,
        neigungGrad: preset.tilt,
        brennweiteMm: preset.focalMm,
        fokusM: preset.focusM,
        gespeichertAm: preset.savedAt,
      },
    ])

    // manufacturer + model gehen in den Datenblatt-Match ein: ein Eintrag,
    // dessen Name auf kein Katalog-Geraet passt, bleibt ohne Ports stehen —
    // waeren die Felder ungenutzt, saehe das Ergebnis identisch aus.
    const unknown = cameraListToEquipment({
      ...exchange,
      cameras: [{ id: 'x', label: 'X', manufacturer: 'Nicht', model: 'Existent' }],
    })[0]
    expect(unknown.portsUnknown).toBe(true)
    expect(unknown.outputs).toEqual([])
  })
})
