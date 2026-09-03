// ───────────────────────────────────────────────────────────────────────────
// Drift-Guard fuer das Kamera-Listen-Format `camera-list` v1.
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
} from '../src/renderer/lib/multicamCameraImport'

// Eingefrorener Contract — MUSS in beiden Repos identisch sein.
const CONTRACT = {
  kind: 'camera-list',
  version: 1,
  envelopeKeys: ['app', 'appVersion', 'cameras', 'exportedAt', 'formatVersion', 'kind'],
  entryKeys: ['deviceTypeId', 'id', 'label', 'manufacturer', 'model', 'x', 'y'],
} as const

// Voll besetzter Muster-Eintrag (jedes Feld gesetzt). Er haelt die Laufzeit-
// Form fest — NICHT die Typ-Vollstaendigkeit: ein neues optionales Feld
// laesst ihn unveraendert. Dafuer ist der interfaceKeys-Test weiter unten da.
const entry: CameraListEntry = {
  id: 'vc1',
  label: 'Kamera 1',
  manufacturer: 'Blackmagic Design',
  model: 'URSA Broadcast G2',
  deviceTypeId: 'dt-cam-0001',
  x: 3.5,
  y: 7.25,
}
const exchange: CameraListExchange = {
  kind: CAMERA_LIST_KIND,
  formatVersion: CAMERA_LIST_VERSION,
  app: 'multicam-planner',
  appVersion: '1.2.3',
  exportedAt: '2026-01-01T00:00:00.000Z',
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
  })

  it('faengt auch ein neu hinzugefuegtes OPTIONALES Feld', () => {
    // Die Muster-Literale oben allein wuerden das nicht tun: ein optionales
    // Feld laesst sie unveraendert kompilieren. Deshalb hier gegen den
    // Interface-Rumpf im Quelltext — die einzige Pruefung, die unter
    // `npm test` tatsaechlich laeuft (tests/ liegt ausserhalb der tsconfigs).
    expect(interfaceKeys(importerSrc, 'CameraListEntry')).toEqual(CONTRACT.entryKeys)
    expect(interfaceKeys(importerSrc, 'CameraListExchange')).toEqual(CONTRACT.envelopeKeys)
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

  it('verbraucht JEDES Feld des Eintrags — kein Feld faellt still hinten runter', () => {
    // Der Gegenbeweis zur Frage „was liest der Importer nicht, obwohl es
    // geschrieben wird?". Alle sieben Felder muessen sich im Ergebnis
    // wiederfinden, sonst traegt das Format Daten, die nirgends ankommen.
    const [eq] = cameraListToEquipment(exchange)
    expect(eq.id).toBe(entry.id) // id
    expect(eq.name).toBe(entry.label) // label
    expect(eq.deviceTypeId).toBe(entry.deviceTypeId) // deviceTypeId
    expect(eq.x).toBe(Math.round(entry.x! * 120)) // x (Meter -> Pixel)
    expect(eq.y).toBe(Math.round(entry.y! * 120)) // y

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
