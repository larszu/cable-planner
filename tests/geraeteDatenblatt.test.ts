import { describe, expect, it } from 'vitest'
import {
  BILD_FOTOS,
  BILD_REFERENZ,
  auswahlZeilen,
  datenblattBilder,
  datenblattEigenschaften,
  gewaehlt,
  gewaehlteBilder,
  vorauswahl,
} from '../src/renderer/lib/geraeteDatenblatt'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Foto } from '../src/renderer/types/foto'

// #919 — Geräte-Datenblatt: „Vorausgewählt sollen es alle ausgefüllten
// Eigenschaften sein." Diese Tests halten fest, was „ausgefüllt" heisst,
// dass leere Felder gar nicht erst zur Wahl stehen und dass das Passwort nie
// auf Papier kommt.

const geraet = (patch: Partial<EquipmentItem> = {}): EquipmentItem => ({
  id: 'eq1',
  name: 'Kamera 1',
  category: 'Kameras',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  ...patch,
})

const foto = (patch: Partial<Foto> = {}): Foto => ({
  id: 'f1',
  dataUri: 'data:image/jpeg;base64,AAAA',
  breite: 10,
  hoehe: 10,
  bytes: 30,
  quelle: 'planer',
  hinzugefuegtAm: '2026-09-28T10:00:00Z',
  zeigtAuf: { equipmentId: 'eq1' },
  ...patch,
})

const keys = (e: EquipmentItem) => datenblattEigenschaften(e).map((p) => p.key)

describe('datenblattEigenschaften', () => {
  it('führt nur ausgefüllte Felder — leere, Leerzeichen und NaN fallen weg', () => {
    const e = geraet({ serialNumber: 'SN-42', firmware: '   ', ipAddress: '', weightKg: Number.NaN })
    const k = keys(e)
    expect(k).toContain('serialNumber')
    expect(k).toContain('category')
    expect(k).not.toContain('firmware')
    expect(k).not.toContain('ipAddress')
    expect(k).not.toContain('weightKg')
  })

  it('nimmt die Zahl 0 als ausgefüllt', () => {
    expect(keys(geraet({ dmxUniverse: 0, managementVlanId: 0 }))).toContain('managementVlanId')
  })

  it('druckt das Passwort nie — auch nicht als abwählbare Option', () => {
    const liste = datenblattEigenschaften(geraet({ username: 'admin', password: 'geheim' }))
    expect(liste.map((p) => p.key)).toContain('username')
    expect(liste.some((p) => p.wert.includes('geheim'))).toBe(false)
    expect(liste.map((p) => p.key)).not.toContain('password')
  })

  it('schreibt Einheiten und fasst die Ports zusammen', () => {
    const e = geraet({
      powerConsumptionWatts: 45,
      widthMm: 482,
      inputs: [{ id: 'i1' } as EquipmentItem['inputs'][number]],
      outputs: [
        { id: 'o1' } as EquipmentItem['outputs'][number],
        { id: 'o2' } as EquipmentItem['outputs'][number],
      ],
    })
    const wert = (k: string) => datenblattEigenschaften(e).find((p) => p.key === k)?.wert
    expect(wert('powerConsumptionWatts')).toBe('45 W')
    expect(wert('widthMm')).toBe('482 mm')
    expect(wert('ports')).toBe('1 in / 2 out')
  })

  it('löst Kategorie-Fachfelder mit Label, Option und Einheit auf — je Feld eine Zeile', () => {
    const e = geraet({ category: 'Objektive', categoryProps: { focalLength: '17-120', mount: 'PL', minFocus: '' } })
    const de = datenblattEigenschaften(e, { lang: 'de' })
    expect(de.find((p) => p.key === 'cat:focalLength')).toMatchObject({ label: 'Brennweite', wert: '17-120 mm' })
    expect(de.find((p) => p.key === 'cat:mount')).toMatchObject({ gruppe: 'category', wert: 'PL' })
    expect(de.some((p) => p.key === 'cat:minFocus')).toBe(false)
  })

  it('nimmt den Übersetzer von aussen', () => {
    const t = (key: string, fb: string) => (key === 'steckbrief.serial' ? 'Serien-Nr.' : fb)
    const p = datenblattEigenschaften(geraet({ serialNumber: 'X' }), { t }).find((x) => x.key === 'serialNumber')
    expect(p?.label).toBe('Serien-Nr.')
  })

  it('nennt den Standort, wenn das Gerät in einem Rahmen liegt', () => {
    const locations = [{ id: 'l1', name: 'Regie', x: -10, y: -10, width: 500, height: 500 }] as never
    const p = datenblattEigenschaften(geraet(), { locations }).find((x) => x.key === 'location')
    expect(p?.wert).toBe('Regie')
  })
})

describe('Vorauswahl und Auswahl', () => {
  it('wählt alles vor, was ausgefüllt ist', () => {
    const liste = datenblattEigenschaften(geraet({ serialNumber: 'A', notes: 'Lüfter laut' }))
    expect([...vorauswahl(liste)].sort()).toEqual(liste.map((p) => p.key).sort())
  })

  it('filtert auf die Auswahl und behält die Reihenfolge', () => {
    const liste = datenblattEigenschaften(geraet({ serialNumber: 'A', notes: 'N', ipAddress: '10.0.0.1' }))
    const out = gewaehlt(liste, new Set(['notes', 'serialNumber']))
    expect(out.map((p) => p.key)).toEqual(['serialNumber', 'notes'])
  })

  it('vereinigt mehrere Geräte zu einer Checkliste mit Zählung, ohne Einzelwert', () => {
    const a = datenblattEigenschaften(geraet({ id: 'a', serialNumber: '1', notes: 'x' }))
    const b = datenblattEigenschaften(geraet({ id: 'b', serialNumber: '2', ipAddress: '10.0.0.2' }))
    const z = auswahlZeilen([a, b])
    const serial = z.find((x) => x.key === 'serialNumber')
    expect(serial).toMatchObject({ anzahl: 2, wert: '' })
    expect(z.find((x) => x.key === 'ipAddress')?.anzahl).toBe(1)
    // Gruppen-Reihenfolge: Identität vor Netz vor Notizen.
    const idx = (k: string) => z.findIndex((x) => x.key === k)
    expect(idx('serialNumber')).toBeLessThan(idx('ipAddress'))
    expect(idx('ipAddress')).toBeLessThan(idx('notes'))
  })

  it('zeigt bei einem Gerät den Wert in der Checkliste', () => {
    const z = auswahlZeilen([datenblattEigenschaften(geraet({ serialNumber: 'SN-7' }))])
    expect(z.find((x) => x.key === 'serialNumber')?.wert).toBe('SN-7')
  })
})

describe('datenblattBilder', () => {
  it('nimmt nur geladene Fotos, die auf das Gerät zeigen', () => {
    const fotos = [
      foto({ id: 'a', notiz: 'Rückseite' }),
      foto({ id: 'b', dataUri: '' }),
      foto({ id: 'c', zeigtAuf: { equipmentId: 'anderes' } }),
      foto({ id: 'd', zeigtAuf: undefined }),
    ]
    const b = datenblattBilder(geraet(), fotos)
    expect(b.fotos).toEqual([{ dataUri: 'data:image/jpeg;base64,AAAA', unterschrift: 'Rückseite' }])
    expect(b.referenz).toBeUndefined()
  })

  it('führt das Referenzbild nur als Data-URI und gibt Bilder nach Auswahl heraus', () => {
    const b = datenblattBilder(geraet({ imageUrl: 'data:image/png;base64,BBBB' }), [foto()])
    expect(b.referenz?.dataUri).toBe('data:image/png;base64,BBBB')
    expect(gewaehlteBilder(b, new Set([BILD_FOTOS, BILD_REFERENZ]))).toHaveLength(2)
    expect(gewaehlteBilder(b, new Set([BILD_REFERENZ]))).toHaveLength(1)
    expect(gewaehlteBilder(b, new Set())).toHaveLength(0)
    expect(datenblattBilder(geraet({ imageUrl: 'https://example.com/x.png' }), []).referenz).toBeUndefined()
  })
})

describe('buildDeviceDatasheetsBlob', () => {
  it('baut eine PDF, eine Seite je Gerät, auch mit einem unlesbaren Bild', async () => {
    const { buildDeviceDatasheetsBlob } = await import('../src/renderer/lib/exportDevicePdf')
    const a = geraet({ id: 'a', serialNumber: '1' })
    const b = geraet({ id: 'b', name: 'Kamera 2' })
    const blob = buildDeviceDatasheetsBlob([
      {
        device: a,
        eigenschaften: datenblattEigenschaften(a),
        bilder: [{ dataUri: 'data:image/jpeg;base64,AAAA', unterschrift: 'x' }],
      },
      { device: b, eigenschaften: [], bilder: [] },
    ])
    expect(blob).not.toBeNull()
    const text = await blob!.text()
    expect(text.startsWith('%PDF')).toBe(true)
    expect(text).toMatch(/\/Count 2\b/)
    expect(buildDeviceDatasheetsBlob([])).toBeNull()
  })
})
