import { describe, expect, it } from 'vitest'
import { specsAus, uploadItemAus, type Fachdaten } from '../src/renderer/lib/deviceLibraryItem'
import type { EquipmentTemplate } from '../src/renderer/types/equipment'

const vorlage = (t: Partial<EquipmentTemplate>): EquipmentTemplate =>
  ({ name: 'X Y', category: 'Video', width: 200, height: 120, inputs: [], outputs: [], ...t }) as EquipmentTemplate

describe('specsAus', () => {
  it('Objektiv aus dem Untertitel der Uebernahme: Zoom, Mount wird gebraucht', () => {
    expect(specsAus(vorlage({ category: 'Lenses', subtitle: '9-720 mm · B4' }))).toEqual({
      specs: { kind: 'lens', focalMinMm: 9, focalMaxMm: 720 },
      interfaces: [{ kind: 'lens-mount', standard: 'b4', role: 'requires' }],
    })
  })

  it('Festbrennweite (P+S Evolution 40 mm): min = max', () => {
    expect(specsAus(vorlage({ category: 'Lenses', subtitle: '40 mm · PL' }))).toEqual({
      specs: { kind: 'lens', focalMinMm: 40, focalMaxMm: 40 },
      interfaces: [{ kind: 'lens-mount', standard: 'pl', role: 'requires' }],
    })
  })

  it('Objektiv: Formularfelder gehen vor, „integrated" ist kein Mount', () => {
    expect(specsAus(vorlage({ category: 'Objektive', categoryProps: { focalLength: '17-120', mount: 'EF' } }))).toEqual({
      specs: { kind: 'lens', focalMinMm: 17, focalMaxMm: 120 },
      interfaces: [{ kind: 'lens-mount', standard: 'ef', role: 'requires' }],
    })
    expect(specsAus(vorlage({ category: 'Lenses', subtitle: '4.4-88 mm · integrated' }))).toEqual({
      specs: { kind: 'lens', focalMinMm: 4.4, focalMaxMm: 88 },
    })
  })

  it('Kamera bietet den nativen Mount aus der Notiz, nicht den per Adapter', () => {
    expect(
      specsAus(vorlage({ category: 'Cameras', notes: 'BMD 6K (23.1×12.99) · B4 mount · 6K/4K/HD · B4 native, EF/PL via adapter.' })),
    ).toEqual({ interfaces: [{ kind: 'lens-mount', standard: 'b4', role: 'provides' }] })
  })

  it('Stativ: Schale, Nutzlast, Hoehe aus den Formularfeldern', () => {
    expect(
      specsAus(vorlage({ category: 'Tripods', categoryProps: { headType: 'bowl100', payloadKg: 30, heightRange: '0.6-1.9' } })),
    ).toEqual({
      specs: { kind: 'tripod', heightMinM: 0.6, heightMaxM: 1.9, payloadMaxKg: 30 },
      interfaces: [{ kind: 'head-base', standard: 'bowl-100', role: 'provides' }],
    })
  })

  it('rät nichts: „fluid"/„flat" ohne Sockelnorm, keine Angaben → nichts', () => {
    expect(specsAus(vorlage({ category: 'Stative', categoryProps: { headType: 'flat' } }))).toEqual({})
    expect(specsAus(vorlage({ category: 'Tripods', notes: '0.6-1.9 m · payload 25 kg' }))).toEqual({})
    expect(specsAus(vorlage({ category: 'Cameras' }))).toEqual({})
    expect(specsAus(vorlage({ category: 'Video', subtitle: '9-720 mm · B4' }))).toEqual({})
  })

  it('landet im Kern des Upload-Eintrags', () => {
    const item = uploadItemAus(vorlage({ name: 'Fujinon UA80x9BESM', category: 'Lenses', subtitle: '9-720 mm · B4' }))
    expect((item.core as Fachdaten).specs).toEqual({ kind: 'lens', focalMinMm: 9, focalMaxMm: 720 })
    expect((item.core as Fachdaten).interfaces).toHaveLength(1)
  })
})
