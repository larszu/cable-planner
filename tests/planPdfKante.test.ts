import { describe, expect, it } from 'vitest'
import { ladePlanDatei, PLAN_PDF_MAX_KANTE } from '../src/renderer/avplan/floorplan/planDatei'

// #1206 — ein PDF-Hallenplan wurde mit 2000 px gerastert und war beim
// Heranzoomen unscharf. Die PDF-Kante haengt nicht mehr an der Bild-Kante.
describe('PDF-Plan wird fein genug gerastert (#1206)', () => {
  it('rendert PDFs mit der PDF-Kante, nicht mit der Bild-Kante', async () => {
    let kante = 0
    const datei = new File([new Uint8Array([37, 80, 68, 70])], 'halle.pdf', { type: 'application/pdf' })
    await ladePlanDatei(datei, {
      maxKante: 3000,
      pdf: async (_d, _s, k) => {
        kante = k
        return { dataUrl: 'data:image/png;base64,', breite: k, hoehe: k, seiten: 1 }
      },
    })
    expect(kante).toBe(PLAN_PDF_MAX_KANTE)
    expect(PLAN_PDF_MAX_KANTE).toBeGreaterThanOrEqual(6000)
  })
})
