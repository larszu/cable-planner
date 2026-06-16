import { describe, expect, it, beforeEach } from 'vitest'
import { toCsv } from '../src/renderer/lib/csv'
import { cableLabelId, equipmentAssetTag, makeDocId } from '../src/renderer/lib/docIds'
import {
  buildPullListRows,
  buildTerminationRows,
  buildCableBomRows,
} from '../src/renderer/lib/installerLists'
import { buildAssetRows } from '../src/renderer/lib/assetRegister'
import { buildHandoverManifest } from '../src/renderer/lib/handoverPackage'
import { sourceDestLabel } from '../src/renderer/lib/cableLabel'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// Festinstallation — reine Logik der mitwachsenden Doku + Installateur-Listen.

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
    name: `Cable ${id}`,
    type: 'BNC',
    length: 5,
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

describe('toCsv', () => {
  it('quotet Felder mit Delimiter/Quote/Newline und setzt ein BOM', () => {
    const csv = toCsv(['a', 'b'], [['x;y', 'he"llo'], ['plain', 'li\nne']])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('"x;y"')
    expect(csv).toContain('"he""llo"')
    expect(csv).toContain('"li\nne"')
    // CRLF-Zeilenenden
    expect(csv).toContain('\r\n')
  })
})

describe('docIds', () => {
  it('makeDocId pollt null', () => {
    expect(makeDocId('C', 7)).toBe('C-0007')
    expect(makeDocId('A', 123, 2)).toBe('A-123')
  })
  it('cableLabelId folgt cableNumber → qrId → UUID-Kurzform', () => {
    expect(cableLabelId(cable('x', { cableNumber: 'V-001' }))).toBe('V-001')
    expect(cableLabelId(cable('x', { qrId: 'C-0009' }))).toBe('C-0009')
    expect(cableLabelId(cable('abcd1234efgh'))).toBe('C-abcd1234')
  })
  it('equipmentAssetTag folgt assetTag → qrId → UUID-Kurzform', () => {
    expect(equipmentAssetTag(eq('zz', 'X', { assetTag: 'INV-1' }))).toBe('INV-1')
    expect(equipmentAssetTag(eq('abcdef0012', 'X'))).toBe('A-abcdef00')
  })
})

describe('buildPullListRows', () => {
  it('löst Geräte-/Port-Namen auf und reicht Festinstall-Felder durch', () => {
    const p = project({
      cables: [
        cable('c1', {
          pathway: 'Trasse-3',
          jacketRating: 'CMP',
          installStatus: 'installed',
        }),
      ],
    })
    const rows = buildPullListRows(p)
    expect(rows).toHaveLength(1)
    expect(rows[0].fromDevice).toBe('Kamera 1')
    expect(rows[0].fromPort).toBe('OUT 1')
    expect(rows[0].toDevice).toBe('Switcher')
    expect(rows[0].toPort).toBe('IN 1')
    expect(rows[0].pathway).toBe('Trasse-3')
    expect(rows[0].jacket).toBe('CMP')
    expect(rows[0].status).toBe('Installiert')
  })
})

describe('buildTerminationRows', () => {
  it('liefert zwei Zeilen (A/B) je Kabel mit Connector + Terminierung', () => {
    const rows = buildTerminationRows(
      project({ cables: [cable('c1', { terminationFrom: 'T568B', terminationTo: 'LC' })] }),
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].end).toBe('A')
    expect(rows[0].connector).toBe('BNC')
    expect(rows[0].termination).toBe('T568B')
    expect(rows[1].end).toBe('B')
    expect(rows[1].termination).toBe('LC')
  })
})

describe('buildCableBomRows', () => {
  it('aggregiert nach Typ/Länge und schlägt Reserve auf (aufgerundet)', () => {
    const p = project({
      cables: [cable('1'), cable('2'), cable('3'), cable('4'), cable('5')],
    })
    const rows = buildCableBomRows(p, 10)
    expect(rows).toHaveLength(1)
    expect(rows[0].qty).toBe(5)
    // 5 * 1.1 = 5.5 → ceil 6
    expect(rows[0].qtyWithReserve).toBe(6)
    expect(rows[0].totalLengthM).toBe(25)
  })

  it('zählt Multicore-Bündel nur einmal und überspringt Wireless', () => {
    const p = project({
      cables: [
        cable('1', { multicoreName: 'Snake-1' }),
        cable('2', { multicoreName: 'Snake-1' }),
        cable('3', { wireless: true }),
      ],
    })
    const rows = buildCableBomRows(p, 0)
    const total = rows.reduce((s, r) => s + r.qty, 0)
    expect(total).toBe(1)
  })

  it('weist Tie-Lines separat aus', () => {
    const p = project({
      cables: [cable('1'), cable('2', { isTieLine: true })],
    })
    const rows = buildCableBomRows(p, 0)
    expect(rows).toHaveLength(2)
    expect(rows.some((r) => r.tieLine)).toBe(true)
  })
})

describe('buildAssetRows', () => {
  it('mappt Status-Label, Serie und Service-Anzahl', () => {
    const p = project({
      equipment: [
        eq('A', 'Kamera 1', {
          serialNumber: 'SN-42',
          installStatus: 'operational',
          serviceHistory: [
            { id: 's1', date: '2026-01-01', author: 'x', kind: 'inspection', summary: 'ok' },
          ],
        }),
      ],
    })
    const rows = buildAssetRows(p)
    expect(rows[0].serial).toBe('SN-42')
    expect(rows[0].status).toBe('In Betrieb')
    expect(rows[0].serviceCount).toBe(1)
  })

  it('mappt die Lager-Felder (Eigentum/Lagerort/Lieferant/Anschaffung)', () => {
    const p = project({
      equipment: [
        eq('A', 'Kamera 1', {
          ownership: 'rented',
          stockLocation: 'Lager A · Regal 3.2',
          supplier: 'Rentcorp',
          purchaseDate: '2025-11-02',
        }),
      ],
    })
    const r = buildAssetRows(p)[0]
    expect(r.ownership).toBe('Angemietet')
    expect(r.stockLocation).toBe('Lager A · Regal 3.2')
    expect(r.supplier).toBe('Rentcorp')
    expect(r.purchaseDate).toBe('2025-11-02')
  })
})

describe('sourceDestLabel (F501.01)', () => {
  it('baut „Quelle Port → Ziel Port" aus den Endpunkten', () => {
    const p = project()
    const eqById = new Map(p.equipment.map((e) => [e.id, e]))
    const label = sourceDestLabel(p.cables[0], eqById)
    expect(label).toContain('OUT 1')
    expect(label).toContain('IN 1')
    expect(label).toContain('→')
  })
  it('respektiert einen eigenen Separator', () => {
    const p = project()
    const eqById = new Map(p.equipment.map((e) => [e.id, e]))
    expect(sourceDestLabel(p.cables[0], eqById, { separator: 'to' })).toContain(' to ')
  })
})

describe('buildHandoverManifest', () => {
  it('enthält die Pflicht-Abschnitte des Übergabe-Dokuments', () => {
    const md = buildHandoverManifest(project())
    expect(md).toContain('# Übergabe-Dokumentation')
    expect(md).toContain('Commissioning')
    expect(md).toContain('Kabel-Stückliste')
    expect(md).toContain('Asset-Register')
    expect(md).toContain('Testanlage')
  })
})

// Store-Slice (importiert transitiv den Zustand-Store; verifiziert unter
// happy-dom, dass die Setter Status/Service/Changelog korrekt mutieren).
describe('lifecycleSlice (store)', () => {
  beforeEach(async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.getState().loadProject(project())
  })

  it('setzt Kabel-Status und protokolliert die Änderung mit Autor', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    const { useSettingsStore } = await import('../src/renderer/store/settingsStore')
    useSettingsStore.getState().setEditorName('Tester')
    const cableId = useProjectStore.getState().project.cables[0].id
    useProjectStore.getState().setCableInstallStatus(cableId, 'tested')
    const st = useProjectStore.getState().project
    expect(st.cables[0].installStatus).toBe('tested')
    const log = st.changelog ?? []
    expect(log.length).toBeGreaterThan(0)
    const last = log[log.length - 1]
    expect(last.kind).toBe('status')
    expect(last.author).toBe('Tester')
  })

  it('vergibt eindeutige QR-/Asset-IDs nur dort wo keine existiert', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    const res = useProjectStore.getState().assignDocIds()
    expect(res.cables).toBe(1)
    expect(res.equipment).toBe(2)
    const st = useProjectStore.getState().project
    const ids = [
      ...st.cables.map((c) => c.qrId),
      ...st.equipment.map((e) => e.qrId),
    ]
    expect(ids.every(Boolean)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    // Idempotent: zweiter Lauf vergibt nichts mehr.
    const again = useProjectStore.getState().assignDocIds()
    expect(again.cables + again.equipment).toBe(0)
  })

  it('erzeugt Quelle→Ziel-Labels (nur leere Namen ohne overwrite)', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    const cid = useProjectStore.getState().project.cables[0].id
    // Leerer Name → Default-Lauf füllt ihn.
    useProjectStore.getState().updateCable(cid, { name: '' })
    expect(useProjectStore.getState().applySourceDestLabels()).toBe(1)
    expect(useProjectStore.getState().project.cables[0].name).toContain('→')
    // Identischer Lauf ist idempotent (Label unverändert).
    expect(useProjectStore.getState().applySourceDestLabels({ overwrite: true })).toBe(0)
    // Eigener Name bleibt ohne overwrite stehen, mit overwrite wird er ersetzt.
    useProjectStore.getState().updateCable(cid, { name: 'Mein Kabel' })
    expect(useProjectStore.getState().applySourceDestLabels()).toBe(0)
    expect(useProjectStore.getState().applySourceDestLabels({ overwrite: true })).toBe(1)
    expect(useProjectStore.getState().project.cables[0].name).toContain('→')
  })

  it('fügt Service-Records hinzu und entfernt sie wieder', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    const eqId = useProjectStore.getState().project.equipment[0].id
    useProjectStore.getState().addServiceRecord(eqId, {
      date: new Date().toISOString(),
      author: 'Tester',
      kind: 'repair',
      summary: 'Lüfter getauscht',
    })
    let item = useProjectStore.getState().project.equipment.find((e) => e.id === eqId)!
    expect(item.serviceHistory).toHaveLength(1)
    const recId = item.serviceHistory![0].id
    useProjectStore.getState().removeServiceRecord(eqId, recId)
    item = useProjectStore.getState().project.equipment.find((e) => e.id === eqId)!
    expect(item.serviceHistory).toHaveLength(0)
  })

  it('Feld-Rückkanal: pending change übernehmen mergt Patch + protokolliert', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    const cid = useProjectStore.getState().project.cables[0].id
    const logBefore = useProjectStore.getState().project.changelog?.length ?? 0
    useProjectStore.getState().addPendingChange({
      author: 'Field-Tech',
      source: 'mobile',
      kind: 'cable-edit',
      target: { type: 'cable', id: cid, name: 'Cable c1' },
      summary: 'Länge korrigiert auf 7 m',
      patch: { length: 7, evilField: 'nope' },
    })
    expect(useProjectStore.getState().project.pendingChanges).toHaveLength(1)
    const pcId = useProjectStore.getState().project.pendingChanges![0].id

    expect(useProjectStore.getState().applyPendingChange(pcId)).toBe(true)
    const st = useProjectStore.getState().project
    // Patch angewandt (whitelisted), Müll-Feld ignoriert.
    const c = st.cables.find((x) => x.id === cid)!
    expect(c.length).toBe(7)
    expect((c as unknown as Record<string, unknown>).evilField).toBeUndefined()
    // Queue geleert + Änderungsprotokoll-Eintrag geschrieben.
    expect(st.pendingChanges).toHaveLength(0)
    expect((st.changelog?.length ?? 0)).toBe(logBefore + 1)
  })

  it('Feld-Rückkanal: pending change verwerfen entfernt + protokolliert', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    useProjectStore.getState().addPendingChange({
      source: 'mobile',
      kind: 'issue',
      target: { type: 'equipment', id: 'A' },
      summary: 'Gerät defekt?',
    })
    const pcId = useProjectStore
      .getState()
      .project.pendingChanges!.find((p) => p.summary === 'Gerät defekt?')!.id
    const logBefore = useProjectStore.getState().project.changelog?.length ?? 0
    useProjectStore.getState().rejectPendingChange(pcId)
    const st = useProjectStore.getState().project
    expect(st.pendingChanges!.some((p) => p.id === pcId)).toBe(false)
    expect((st.changelog?.length ?? 0)).toBe(logBefore + 1)
  })
})
