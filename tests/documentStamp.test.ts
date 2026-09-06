import { describe, expect, it } from 'vitest'
import {
  buildDocumentStamp,
  csvFromTable,
  csvStampRow,
  documentFingerprint,
  fingerprint,
  latestRevision,
  planFingerprint,
  stampForRows,
  stampLine,
} from '../src/renderer/lib/documentStamp'
import {
  cableBomCsv,
  cableScheduleCsv,
  pullListCsv,
  pullListTable,
  terminationListCsv,
} from '../src/renderer/lib/installerLists'
import { assetRegisterCsv } from '../src/renderer/lib/assetRegister'
import { parseDocQrPayload } from '../src/renderer/lib/qrPayload'
import { currentStand } from '../src/renderer/lib/documentRegistry'
import { buildHandoverManifest, handoverTable } from '../src/renderer/lib/handoverPackage'
import type { CablePlannerProject, ProjectRevision } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// Roadmap-Initiative 4 — ein Ausdruck soll sagen koennen, ob er noch der
// aktuelle Stand ist. Getestet wird genau das und nicht mehr: dass der
// Fingerabdruck auf Inhalt reagiert und nur auf Inhalt, und dass der Stempel
// keine Abweichung behauptet, fuer die es keinen Bezugspunkt gibt.

const eq = (id: string, name: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id,
    name,
    category: 'Sonstiges',
    inputs: [{ id: `${id}-in`, name: 'IN 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: `${id}-out`, name: 'OUT 1', type: 'port', connectorType: 'BNC' }],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...over,
  }) as unknown as EquipmentItem

const cable = (id: string, over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: `Kabel ${id}`,
    type: 'SDI',
    length: 10,
    color: '#fff',
    fromEquipmentId: 'A',
    fromPortId: 'A-out',
    toEquipmentId: 'B',
    toPortId: 'B-in',
    notes: '',
    ...over,
  }) as Cable

const project = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Testanlage', description: '', createdAt: '', updatedAt: '' },
    equipment: [eq('A', 'Kamera 1'), eq('B', 'Switcher')],
    cables: [cable('c1')],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

/** Eine festgeschriebene Revision aus einem Plan-Stand. */
const revision = (snapshotOf: CablePlannerProject, label = 'Rev 1'): ProjectRevision => {
  const { revisions: _ignored, ...snapshot } = snapshotOf
  void _ignored
  return {
    id: 'r1',
    label,
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    asBuilt: false,
    snapshot,
  }
}

const NOW = new Date('2026-09-01T12:34:00.000Z')

describe('fingerprint', () => {
  it('ist stabil und laengenfest', () => {
    expect(fingerprint('abc')).toBe(fingerprint('abc'))
    expect(fingerprint('abc')).toHaveLength(8)
    expect(fingerprint('')).toHaveLength(8)
  })

  it('unterscheidet Inhalte, die sich nur in der Feldgrenze unterscheiden', () => {
    // Der Grund fuer den Unit-Separator: mit ';' als Trenner waeren
    // ['a;b'] und ['a','b'] derselbe String — zwei verschiedene Dokumente
    // mit demselben Fingerabdruck.
    expect(documentFingerprint(['h'], [['a;b']])).not.toBe(
      documentFingerprint(['h', 'h2'], [['a', 'b']]),
    )
  })
})

describe('documentFingerprint', () => {
  it('aendert sich, wenn sich eine Zelle aendert', () => {
    const a = documentFingerprint(['x'], [['1'], ['2']])
    const b = documentFingerprint(['x'], [['1'], ['3']])
    expect(a).not.toBe(b)
  })

  it('aendert sich, wenn sich die Reihenfolge aendert', () => {
    // Auf einem Ausdruck ist die Reihenfolge sichtbar; ein Fingerabdruck, der
    // sie ignoriert, wuerde ein anders sortiertes Blatt als identisch ausgeben.
    expect(documentFingerprint(['x'], [['1'], ['2']])).not.toBe(
      documentFingerprint(['x'], [['2'], ['1']]),
    )
  })

  it('behandelt null/undefined wie eine leere Zelle', () => {
    expect(documentFingerprint(['x'], [[null]])).toBe(documentFingerprint(['x'], [['']]))
  })
})

/** Projekt mit Aufbaustand — Port-Schluessel sind `${geraet}|${port}`. */
const checked = (ports: Record<string, boolean>): CablePlannerProject =>
  project({ checkState: { ports, cables: {} } })

/**
 * Der Plan-Fingerabdruck des Test-Projekts OHNE Haken, so wie ihn die Fassung
 * vor dem Aufbaustand berechnet hat. Fest verdrahtet als Regressionsanker:
 * schlaegt er an, hat jemand die Blockbildung so geaendert, dass bestehende
 * Ausdrucke ihren Stand verlieren.
 */
const FINGERPRINT_OHNE_HAKEN = 'a712d27f'

describe('planFingerprint', () => {
  it('reagiert auf eine verschobene Position — die steht auf dem Blatt', () => {
    const before = planFingerprint(project())
    const after = planFingerprint(
      project({ equipment: [eq('A', 'Kamera 1', { x: 40 }), eq('B', 'Switcher')] }),
    )
    expect(before).not.toBe(after)
  })

  it('ignoriert Viewport und Zoom — die stehen nicht auf dem Blatt', () => {
    expect(planFingerprint(project())).toBe(
      planFingerprint(project({ canvasState: { x: 900, y: -400, zoom: 4 } })),
    )
  })

  it('ist unabhaengig von der Reihenfolge der Collections', () => {
    const a = project({ equipment: [eq('A', 'Kamera 1'), eq('B', 'Switcher')] })
    const b = project({ equipment: [eq('B', 'Switcher'), eq('A', 'Kamera 1')] })
    expect(planFingerprint(a)).toBe(planFingerprint(b))
  })

  // Der Aufbaustand steht auf dem Blatt: `EquipmentNode` zeichnet fuer jeden
  // gesteckt gemeldeten Port ein Haekchen, und beide PDF-Wege nehmen das DOM
  // mit. Bis hierher fehlte er im Fingerabdruck — ein Ausdruck von gestern
  // Abend meldete sich als aktueller Stand, obwohl seitdem zwoelf Ports
  // abgehakt wurden.
  it('reagiert auf einen gesetzten Port-Haken — der steht auf dem Blatt', () => {
    const before = planFingerprint(project())
    const after = planFingerprint(checked({ 'A|A-out': true }))
    expect(before).not.toBe(after)
  })

  it('unterscheidet, WELCHER Port abgehakt ist', () => {
    expect(planFingerprint(checked({ 'A|A-out': true }))).not.toBe(
      planFingerprint(checked({ 'B|B-in': true })),
    )
  })

  it('ist unabhaengig von der Reihenfolge, in der die Haken zusammenkommen', () => {
    // Zwei Quellen von Unordnung, und nur eine davon ist die gefaehrliche: die
    // Schluessel-Reihenfolge im Haken-Objekt spielt ohnehin keine Rolle, weil
    // ueber die Geraete gelaufen wird. Die Geraete-Reihenfolge dagegen schlaegt
    // durch — ohne Sortierung haetten dieselben Haken zwei Fingerabdruecke.
    const ports = { 'A|A-out': true, 'B|B-in': true }
    const a = project({ equipment: [eq('A', 'Kamera 1'), eq('B', 'Switcher')],
      checkState: { ports, cables: {} } })
    const b = project({ equipment: [eq('B', 'Switcher'), eq('A', 'Kamera 1')],
      checkState: { ports: { 'B|B-in': true, 'A|A-out': true }, cables: {} } })
    expect(planFingerprint(a)).toBe(planFingerprint(b))
  })

  it('zaehlt einen abgeraeumten Haken (false) nicht mit', () => {
    expect(planFingerprint(checked({ 'A|A-out': false }))).toBe(planFingerprint(project()))
  })

  // Die andere Richtung derselben Regel: keine Abweichung behaupten, die auf
  // dem Papier niemand sehen kann.
  it('ignoriert Kabel-Haken — die stehen nur im Kontextmenue', () => {
    const withCableCheck = project({ checkState: { ports: {}, cables: { c1: true } } })
    expect(planFingerprint(withCableCheck)).toBe(planFingerprint(project()))
  })

  it('ignoriert Haken auf Geraeten und Ports, die es nicht gibt', () => {
    // Beim Loeschen eines Geraets raeumt niemand `checkState` auf. Solche
    // Leichen zeichnen nichts und duerfen den Stand nicht bewegen.
    const leichen = checked({ 'geloescht|port-1': true, 'A|gibt-es-nicht': true })
    expect(planFingerprint(leichen)).toBe(planFingerprint(project()))
  })

  it('laesst den Fingerabdruck ohne Haken unveraendert — Ausdrucke bleiben gueltig', () => {
    // Der Haken-Block wird nur angehaengt, wenn es Haken gibt. Ohne diese
    // Bedingung haette die Aenderung jedes bereits gedruckte Blatt auf einen
    // Schlag als veraltet gemeldet. Der Wert ist hier fest verdrahtet, damit
    // genau das nicht unbemerkt passieren kann.
    expect(planFingerprint(project())).toBe(FINGERPRINT_OHNE_HAKEN)
    expect(planFingerprint(project({ checkState: { ports: {}, cables: {} } }))).toBe(
      FINGERPRINT_OHNE_HAKEN,
    )
  })
})

describe('buildDocumentStamp', () => {
  it('behauptet ohne Revision keine Abweichung', () => {
    const s = buildDocumentStamp(project(), 'aaaaaaaa', 'bbbbbbbb', NOW)
    expect(s.revision).toBeUndefined()
    expect(s.drifted).toBe(false)
  })

  it('nennt die Revision und meldet Gleichstand', () => {
    const base = project()
    const p = project({ revisions: [revision(base)] })
    const s = buildDocumentStamp(p, 'aaaaaaaa', 'aaaaaaaa', NOW)
    expect(s.revision).toBe('Rev 1')
    expect(s.drifted).toBe(false)
  })

  it('meldet Abweichung, wenn der Inhalt vom Revisions-Stand abweicht', () => {
    const p = project({ revisions: [revision(project())] })
    expect(buildDocumentStamp(p, 'aaaaaaaa', 'bbbbbbbb', NOW).drifted).toBe(true)
  })

  it('bevorzugt den Metadaten-Stempel vor dem rohen Label (As-Built-Zusatz)', () => {
    const base = project()
    const p = {
      ...base,
      revisions: [revision(base)],
      metadata: { ...base.metadata, revision: 'Rev 1 (As-Built)' },
    } as CablePlannerProject
    expect(buildDocumentStamp(p, 'a', 'a', NOW).revision).toBe('Rev 1 (As-Built)')
  })
})

describe('stampForRows — der eigentliche Zweck', () => {
  it('meldet keine Abweichung, solange sich das Dokument nicht geaendert hat', () => {
    const base = project()
    const p = { ...base, revisions: [revision(base)] } as CablePlannerProject
    expect(stampForRows(p, pullListTable, NOW).drifted).toBe(false)
  })

  it('meldet Abweichung, sobald sich eine Zeile des Dokuments geaendert hat', () => {
    const base = project()
    const changed = {
      ...base,
      cables: [cable('c1', { length: 25 })],
      revisions: [revision(base)],
    } as CablePlannerProject
    expect(stampForRows(changed, pullListTable, NOW).drifted).toBe(true)
  })

  it('meldet KEINE Abweichung, wenn sich nur etwas aenderte, das nicht im Dokument steht', () => {
    // Das ist die Regel, an der sich der Nutzen entscheidet. Eine verschobene
    // Position aendert keine Zeile der Pull-Liste. Wuerde sie den Ausdruck als
    // veraltet markieren, waere der Hinweis nach einer Woche Rauschen.
    const base = project()
    const moved = {
      ...base,
      equipment: [eq('A', 'Kamera 1', { x: 880, y: 640 }), eq('B', 'Switcher')],
      revisions: [revision(base)],
    } as CablePlannerProject
    expect(planFingerprint(moved)).not.toBe(planFingerprint(base))
    expect(stampForRows(moved, pullListTable, NOW).drifted).toBe(false)
  })
})

describe('stampLine', () => {
  it('sagt „+ Änderungen", statt die Revision alleine zu behaupten', () => {
    const base = project()
    const p = { ...base, revisions: [revision(base)] } as CablePlannerProject
    const drifted = buildDocumentStamp(p, 'aaaaaaaa', 'bbbbbbbb', NOW)
    expect(stampLine(drifted)).toContain('Rev 1 + Änderungen')
    const clean = buildDocumentStamp(p, 'aaaaaaaa', 'aaaaaaaa', NOW)
    expect(stampLine(clean)).toContain('Rev 1')
    expect(stampLine(clean)).not.toContain('Änderungen')
  })

  it('traegt Projekt, Zeitpunkt und Fingerabdruck', () => {
    const line = stampLine(buildDocumentStamp(project(), 'deadbeef', undefined, NOW))
    expect(line).toContain('Testanlage')
    expect(line).toContain('#deadbeef')
    expect(line).toMatch(/\d{2}\.\d{2}\.\d{4}/)
  })
})

describe('CSV-Fussnote', () => {
  it('haengt den Stempel als letzte Zeile an, nicht vor die Kopfzeile', () => {
    const p = project()
    const stamp = buildDocumentStamp(p, 'deadbeef', undefined, NOW)
    const csv = pullListCsv(p, stamp)
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    expect(lines[0]).toContain('Label-ID')
    expect(lines[lines.length - 1]).toContain('#deadbeef')
  })

  it('laesst das CSV ohne Stempel unveraendert', () => {
    const p = project()
    expect(pullListCsv(p)).toBe(csvFromTable(pullListTable(p)))
  })

  it('fuellt die Stempelzeile auf die Spaltenzahl auf', () => {
    const stamp = buildDocumentStamp(project(), 'deadbeef', undefined, NOW)
    expect(csvStampRow(stamp, 5)).toHaveLength(5)
    expect(csvStampRow(stamp, 0)).toHaveLength(1)
  })
})

describe('latestRevision', () => {
  it('nimmt die zuletzt festgeschriebene, nicht die erste', () => {
    const base = project()
    const p = project({ revisions: [revision(base, 'Rev 1'), revision(base, 'Rev 2')] })
    expect(latestRevision(p)?.label).toBe('Rev 2')
    expect(latestRevision(project())).toBeUndefined()
  })
})

describe('Übergabe-Dokument', () => {
  it('sagt „+ Änderungen", statt die Revision alleine zu behaupten', () => {
    const base = project()
    const p = {
      ...base,
      cables: [cable('c1', { length: 25 })],
      revisions: [revision(base)],
      metadata: { ...base.metadata, revision: 'Rev 1' },
    } as CablePlannerProject
    const md = buildHandoverManifest(p, stampForRows(p, handoverTable, NOW))
    expect(md).toContain('Aktuelle Revision:** Rev 1 + Änderungen')
  })

  it('laesst die Revision stehen, solange das Dokument unveraendert ist', () => {
    const base = project()
    const p = {
      ...base,
      revisions: [revision(base)],
      metadata: { ...base.metadata, revision: 'Rev 1' },
    } as CablePlannerProject
    const md = buildHandoverManifest(p, stampForRows(p, handoverTable, NOW))
    expect(md).toContain('Aktuelle Revision:** Rev 1')
    expect(md).not.toContain('Änderungen')
  })

  it('bleibt ohne Stempel wortgleich wie bisher', () => {
    // Der Stempel ist optional; ein Aufrufer, der keinen baut, bekommt exakt
    // das alte Dokument. Sonst waere das eine stille Formatänderung.
    const p = project()
    expect(buildHandoverManifest(p)).toBe(buildHandoverManifest(p, undefined))
    // Kein Stempel-Fussnoten-Block (die '#' der Markdown-Ueberschriften bleiben).
    expect(buildHandoverManifest(p)).not.toMatch(/_Testanlage {2}·/)
  })
})

describe('Dokument-Code auf dem Listen-Ausdruck (ADR-004 Inkrement 3)', () => {
  // Bis hierher trug nur das Plan-PDF einen Dokument-Code (als QR). Die Listen
  // trugen die acht Zeichen als Text -- und die sagen im Mobile-Viewer
  // entweder "aktueller Stand" oder "gehoert zu keinem aktuellen Blatt". Der
  // Code nennt zusaetzlich das DOKUMENT, und damit wird aus "unbekannt" die
  // brauchbare Antwort: "Pull-Liste: VERALTET, aktueller Stand #xyz".
  //
  // Als TEXT und nicht als QR, weil ein CSV kein Bild traegt und der Ausdruck
  // aus Excel entsteht: ein hier erzeugter QR ueberlebte den Weg nicht, der
  // Code ueberlebt ihn und ist abtippbar.
  const NOW2 = new Date('2026-09-06T08:00:00.000Z')

  it('haengt den Code an die Fussnote, wenn das Dokument einen hat', () => {
    const p = project()
    const csv = pullListCsv(p, buildDocumentStamp(p, 'deadbeef', undefined, NOW2))
    const letzte = csv.replace(/^﻿/, '').split('\r\n').at(-1) ?? ''
    expect(letzte).toContain('#deadbeef')
    expect(letzte).toContain('cableplanner://doc/pull-liste?s=deadbeef')
  })

  it('nennt die Revision im Code, wenn eine festgeschrieben ist', () => {
    // Der Viewer kann damit auch dann etwas sagen, wenn der Stand nicht mehr
    // passt: welche Revision das Blatt behauptet.
    const base = project()
    const p = {
      ...base,
      revisions: [revision(base)],
      metadata: { ...base.metadata, revision: 'Rev 1' },
    } as CablePlannerProject
    const csv = pullListCsv(p, stampForRows(p, pullListTable, NOW2))
    expect(csv).toContain('&r=Rev%201')
  })

  it('laesst die geteilte Stempelzeile unangetastet', () => {
    // `stampLine` ist das Format, das alle drei Planer teilen; `stamp:parity`
    // in der Suite haelt es Zeichen fuer Zeichen gegeneinander. Der Code haengt
    // HINTER der Zeile, er veraendert sie nicht.
    const p = project()
    const stamp = buildDocumentStamp(p, 'deadbeef', undefined, NOW2)
    const csv = pullListCsv(p, stamp)
    expect(csv).toContain(`# ${stampLine(stamp)}  ·  `)
  })

  it('bleibt ohne Dokument-Kennung bei der blossen Stempelzeile', () => {
    // Ein Aufrufer ohne Dokument-Begriff (eine beliebige Tabelle) bekommt
    // genau das alte Verhalten -- sonst waere das eine stille Formataenderung.
    const stamp = buildDocumentStamp(project(), 'deadbeef', undefined, NOW2)
    expect(String(csvStampRow(stamp, 3)[0])).toBe(`# ${stampLine(stamp)}`)
    expect(String(csvStampRow(stamp, 3)[0])).not.toContain('cableplanner://')
  })

  it('traegt ihn auf allen fuenf CSV-Listen und im Uebergabe-Dokument', () => {
    // Der Punkt der ganzen Uebung: nicht eine Liste, sondern jede. Eine
    // Ausnahme waere genau das Blatt, bei dem spaeter jemand raet.
    const p = project()
    const stamp = buildDocumentStamp(p, 'deadbeef', undefined, NOW2)
    expect(pullListCsv(p, stamp)).toContain('doc/pull-liste')
    expect(terminationListCsv(p, stamp)).toContain('doc/termination-liste')
    expect(cableScheduleCsv(p, stamp)).toContain('doc/kabel-schedule')
    expect(cableBomCsv(p, 10, stamp)).toContain('doc/kabel-bom')
    expect(assetRegisterCsv(p, stamp)).toContain('doc/asset-register')
    expect(buildHandoverManifest(p, stamp)).toContain('doc/uebergabe')
  })

  it('nutzt dieselben Kennungen, die das Dokument-Register fuehrt', () => {
    // Ein Code mit einer Kennung, die das Register nicht kennt, ist im Viewer
    // "Stand nicht pruefbar" -- also schlimmer als keiner, weil er Genauigkeit
    // vortaeuscht.
    const p = project()
    const stamp = buildDocumentStamp(p, 'deadbeef', undefined, NOW2)
    for (const [csv, id] of [
      [pullListCsv(p, stamp), 'pull-liste'],
      [terminationListCsv(p, stamp), 'termination-liste'],
      [cableScheduleCsv(p, stamp), 'kabel-schedule'],
      [cableBomCsv(p, 10, stamp), 'kabel-bom'],
      [assetRegisterCsv(p, stamp), 'asset-register'],
    ] as const) {
      const ref = parseDocQrPayload(csv.slice(csv.indexOf('cableplanner://')).split(/[\r\n";]/)[0])
      expect(ref?.docId).toBe(id)
      expect(currentStand(id, p)).not.toBeNull()
    }
  })
})
