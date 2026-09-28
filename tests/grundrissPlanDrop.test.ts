import { describe, expect, it } from 'vitest'
import { planAblage, PlanDateiFehler, type GeladenerPlan } from '../src/renderer/avplan/floorplan/planDatei'
import {
  ersetzenBrauchtBestaetigung,
  grundrissAusPlan,
  PLAN_ACCEPT,
  planFehlerCode,
  planFehlerText,
  ungeeignetCode,
  ursprungUm,
} from '../src/renderer/lib/grundriss/planUebernahme'
import type { Grundriss } from '../src/renderer/types/grundriss'
import panelQuelle from '../src/renderer/components/Grundriss/GrundrissPanel.tsx?raw'
import canvasQuelle from '../src/renderer/components/Canvas/CanvasArea.tsx?raw'

const plan: GeladenerPlan = { src: 'data:image/png;base64,x', name: 'halle.png', naturalWidth: 800, naturalHeight: 600, art: 'bild', seiten: 1, seite: 0 }
const t = (_k: string, f: string) => f

describe('Hallenplan per Drag & Drop', () => {
  it('legt den Plan mittig auf den Drop-Punkt, in Bildgroesse', () => {
    const g = grundrissAusPlan(plan, ursprungUm({ x: 1000, y: 500 }, plan))
    expect(g).toMatchObject({ x: 600, y: 200, width: 800, height: 600, naturalWidth: 800, deckkraft: 0.6, name: 'halle.png' })
    expect(g.kalibrierung).toBeUndefined()
  })

  it('fragt nur, wenn eine Kalibrierung verloren ginge', () => {
    const ohne = grundrissAusPlan(plan, { x: 0, y: 0 })
    const mit: Grundriss = { ...ohne, kalibrierung: { art: 'zweiPunkt', a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meter: 5 } }
    expect(ersetzenBrauchtBestaetigung(null)).toBe(false)
    expect(ersetzenBrauchtBestaetigung(ohne)).toBe(false)
    expect(ersetzenBrauchtBestaetigung(mit)).toBe(true)
  })

  it('PDF ohne pdf.js: eigene Meldung mit dem Ausweg PNG/JPG', () => {
    expect(PLAN_ACCEPT).toBe('image/*')
    expect(ungeeignetCode([{ name: 'plan.pdf', type: 'application/pdf' }])).toBe('pdf-nicht-verfuegbar')
    expect(planFehlerText(planFehlerCode(new PlanDateiFehler('pdf-nicht-verfuegbar')), t)).toMatch(/PNG or JPG/)
  })

  it('ungeeignete Datei (.docx): klare Meldung statt Stille', () => {
    const docx = { name: 'plan.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    expect(ungeeignetCode([docx])).toBe('typ')
    expect(planFehlerText('typ', t)).toMatch(/not a floor plan image/)
    expect(planFehlerCode(new Error('x'))).toBe('lesen')
  })

  it('planAblage laesst Drags ohne Dateien durch und meldet ungeeignete', () => {
    const ungeeignet: File[][] = []
    const genommen: File[] = []
    const h = planAblage({ onDatei: (f) => genommen.push(f), onUngeeignet: (d) => ungeeignet.push(d) })
    let verhindert = 0
    const intern = { preventDefault: () => verhindert++, dataTransfer: { types: ['application/x-cable-planner-equipment'], files: [] } as unknown as DataTransfer }
    h.onDrop(intern)
    expect(verhindert).toBe(0)
    const docx = { name: 'a.docx', type: 'application/msword' } as File
    const png = { name: 'a.png', type: 'image/png' } as File
    h.onDrop({ preventDefault: () => verhindert++, dataTransfer: { types: ['Files'], files: [docx] } as unknown as DataTransfer })
    h.onDrop({ preventDefault: () => verhindert++, dataTransfer: { types: ['Files'], files: [docx, png] } as unknown as DataTransfer })
    expect(ungeeignet).toEqual([[docx]])
    expect(genommen).toEqual([png])
  })

  it('Panel und Canvas laden ueber das Paket, nicht mit eigenem Lader', () => {
    expect(panelQuelle).not.toMatch(/bildLaden|new FileReader/)
    expect(panelQuelle).toMatch(/accept=\{PLAN_ACCEPT\}/)
    expect(panelQuelle).toMatch(/planAblage\(/)
    // Der Canvas nimmt Dateien nur an, wenn der Drag Dateien traegt — interne
    // Drags (Bibliothek, Presets, Annotationen) gehen unveraendert durch.
    expect(canvasQuelle).toMatch(/planDateiAnnehmen && ziehtDateien\(event\.dataTransfer\)/)
  })
})
