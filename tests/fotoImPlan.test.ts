import { describe, expect, it } from 'vitest'
import { planFotoAmGeraet } from '../src/renderer/lib/fotoMasse'
import type { Foto } from '../src/renderer/types/foto'

// #1272 — Fotos am Geraet im Plan ein- und ausblenden.
const foto = (id: string, over: Partial<Foto> = {}): Foto => ({
  id, dataUri: `data:image/jpeg;base64,${id}`, breite: 10, hoehe: 10, bytes: 30,
  quelle: 'planer', hinzugefuegtAm: '2026-11-17T00:00:00Z', ...over,
})

describe('Foto im Plan (#1272)', () => {
  it('zeigt nur ein eingeschaltetes Foto des Geraets oder seines Typs', () => {
    const fotos = [
      foto('aus', { zeigtAuf: { equipmentId: 'e1' } }),
      foto('fremd', { zeigtAuf: { equipmentId: 'e2' }, imPlan: true }),
      foto('typ', { zeigtAuf: { deviceTypeId: 't1' }, imPlan: true }),
    ]
    expect(planFotoAmGeraet(fotos, 'e1', undefined)).toBeUndefined()
    expect(planFotoAmGeraet(fotos, 'e1', 't1')?.id).toBe('typ')
    expect(planFotoAmGeraet(fotos, 'e2', undefined)?.id).toBe('fremd')
  })

  it('uebergeht ein Foto ohne geladene Bilddaten', () => {
    const fotos = [foto('leer', { dataUri: '', zeigtAuf: { equipmentId: 'e1' }, imPlan: true })]
    expect(planFotoAmGeraet(fotos, 'e1', undefined)).toBeUndefined()
  })
})
