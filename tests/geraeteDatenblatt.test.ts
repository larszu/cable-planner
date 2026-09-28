import { describe, expect, it } from 'vitest'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { Foto } from '../src/renderer/types/foto'
import {
  datenblaetterHtml,
  datenblattFelder,
  datenblattFelderMehrere,
  datenblattHtml,
  geraeteFotos,
  vorauswahl,
  vorauswahlMehrere,
} from '../src/renderer/lib/geraeteDatenblatt'

// #919 — ein A4-Blatt je Gerät: vorausgewählt ist, was ausgefüllt ist; auf
// dem Blatt steht nur, was angekreuzt ist; das Foto kommt mit, wenn es auf
// das Gerät zeigt.

const port = (id: string, name: string): Port => ({ id, name, type: 'SDI', connectorType: 'BNC' }) as Port

const geraet = (id: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name: id, category: 'Kameras', inputs: [], outputs: [], x: 0, y: 0, width: 40, height: 40, ...over }) as unknown as EquipmentItem

const foto = (id: string, equipmentId: string | undefined, dataUri = 'data:image/jpeg;base64,AAAA'): Foto => ({
  id,
  dataUri,
  breite: 10,
  hoehe: 10,
  bytes: dataUri.length,
  ...(equipmentId ? { zeigtAuf: { equipmentId } } : {}),
  quelle: 'planer',
  hinzugefuegtAm: '2026-09-27',
  notiz: `Foto ${id}`,
})

const projekt = (): CablePlannerProject =>
  ({
    metadata: { name: 'Haus', createdAt: '', updatedAt: '' },
    equipment: [
      geraet('CAM 1', {
        serialNumber: 'SN-42',
        firmware: '1.2',
        weightKg: 2.5,
        password: 'geheim',
        username: 'admin',
        categoryProps: { sensor: 's35' },
        outputs: [port('o1', 'SDI Out')],
      }),
      geraet('ATEM', { inputs: [port('i1', 'In 1')] }),
    ],
    cables: [
      {
        id: 'k1',
        name: 'k1',
        cableNumber: 'V-001',
        type: 'BNC',
        length: 5,
        color: '#000',
        fromEquipmentId: 'CAM 1',
        fromPortId: 'o1',
        toEquipmentId: 'ATEM',
        toPortId: 'i1',
        notes: '',
      } as Cable,
    ],
    locations: [],
    fotos: [foto('f1', 'CAM 1'), foto('f2', 'ATEM'), foto('f3', undefined), foto('f4', 'CAM 1', '')],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

describe('Geräte-Datenblatt (#919)', () => {
  it('wählt genau die ausgefüllten Eigenschaften vor', () => {
    const felder = datenblattFelder(projekt(), 'CAM 1')!
    const vor = vorauswahl(felder)
    expect(vor.has('serial')).toBe(true)
    expect(vor.has('firmware')).toBe(true)
    expect(vor.has('weight')).toBe(true)
    expect(vor.has('cat.sensor')).toBe(true)
    expect(vor.has('ports')).toBe(true)
    expect(vor.has('connections')).toBe(true)
    expect(vor.has('warranty')).toBe(false)
    expect(vor.has('service')).toBe(false)
    expect(felder.find((f) => f.key === 'weight')?.wert).toBe('2.5 kg')
  })

  it('bietet Zugangsdaten gar nicht erst an', () => {
    const felder = datenblattFelder(projekt(), 'CAM 1')!
    const alles = JSON.stringify(felder)
    expect(alles).not.toContain('geheim')
    expect(alles).not.toContain('admin')
  })

  it('druckt nur Angekreuztes; ein angekreuztes leeres Feld steht als Strich', () => {
    const html = datenblattHtml(projekt(), 'CAM 1', { auswahl: new Set(['serial', 'warranty']) })
    expect(html).toContain('SN-42')
    expect(html).toContain('Warranty until</dt><dd>—')
    expect(html).not.toContain('Firmware')
    expect(html).not.toContain('V-001')
  })

  it('nimmt die Verbindungstabelle mit Gegenstelle', () => {
    const html = datenblattHtml(projekt(), 'CAM 1', { auswahl: new Set(['connections']) })
    expect(html).toContain('V-001')
    expect(html).toContain('ATEM · In 1')
  })

  it('zeigt nur Fotos des Geräts, und nur geladene, und nur gewählte', () => {
    const p = projekt()
    expect(geraeteFotos(p, 'CAM 1').map((f) => f.id)).toEqual(['f1', 'f4'])
    const mit = datenblattHtml(p, 'CAM 1', { auswahl: new Set(), fotoIds: ['f1', 'f2', 'f4'] })
    expect(mit.match(/<img /g)?.length).toBe(1)
    expect(mit).toContain('Foto f1')
    const ohne = datenblattHtml(p, 'CAM 1', { auswahl: new Set() })
    expect(ohne).not.toContain('<img ')
    expect(ohne).toContain('No property selected.')
  })

  it('ist eine A4-Seite und maskiert HTML', () => {
    const p = projekt()
    p.equipment[0].notes = '<script>x</script>'
    const html = datenblattHtml(p, 'CAM 1', { auswahl: new Set(['notes']) })
    expect(html).toContain('size: A4;')
    expect(html).not.toContain('<script>x')
  })

  it('ein unbekanntes Gerät hat keine Felder', () => {
    expect(datenblattFelder(projekt(), 'weg')).toBeUndefined()
  })
})

describe('Datenblätter für mehrere Geräte (#919)', () => {
  it('führt die Felder zusammen und zählt, bei wie vielen sie ausgefüllt sind', () => {
    const felder = datenblattFelderMehrere(projekt(), ['CAM 1', 'ATEM'])
    const sn = felder.find((f) => f.key.includes('serial'))
    expect(sn).toMatchObject({ gefuellt: 1, gesamt: 2 })
    expect(new Set(felder.map((f) => f.key)).size).toBe(felder.length)
    // Vorausgewählt ist, was bei mindestens einem Gerät ausgefüllt ist.
    expect(vorauswahlMehrere(felder).has(sn!.key)).toBe(true)
  })

  it('gibt eine Seite je Gerät in einem Dokument, Fotos je Gerät', () => {
    const p = projekt()
    const auswahl = vorauswahlMehrere(datenblattFelderMehrere(p, ['CAM 1', 'ATEM']))
    const html = datenblaetterHtml(p, ['CAM 1', 'ATEM'], { auswahl, fotoIdsJeGeraet: { 'CAM 1': ['f1'], ATEM: ['f2'] } })
    expect(html.match(/<section class="seite">/g)?.length).toBe(2)
    expect(html).toContain('<h1>CAM 1</h1>')
    expect(html).toContain('<h1>ATEM</h1>')
    expect(html.match(/<img /g)?.length).toBe(2)
    expect(html).toContain('break-after: page')
    expect(html).not.toContain('geheim')
  })

  it('ist bei einem Gerät dasselbe Blatt wie vorher', () => {
    const p = projekt()
    const auswahl = vorauswahl(datenblattFelder(p, 'CAM 1') ?? [])
    expect(datenblaetterHtml(p, ['CAM 1'], { auswahl, fotoIdsJeGeraet: { 'CAM 1': ['f1'] } })).toBe(
      datenblattHtml(p, 'CAM 1', { auswahl, fotoIds: ['f1'] }),
    )
  })
})
