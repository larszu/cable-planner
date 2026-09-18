// ───────────────────────────────────────────────────────────────────────────
// Der LED-Wand-Rechner (#881).
//
// DIE WICHTIGSTEN FÄLLE SIND DIE, IN DENEN NICHTS HERAUSKOMMT. Eine Wand aus
// Panels ohne Gewichtsangabe wiegt nicht 0 kg — sie wiegt unbekannt viel. Ein
// Gewicht, das aus geschätzten Panelgewichten entsteht, steht am Ende unter
// einer Traverse, an der Menschen vorbeigehen; eine so entstandene Stromlast
// steht auf einem Anschlussblatt.
//
// Die zweite Aussage: eine halbe Kachel ist keine Kachel. Das Raster rundet
// ab und weist den Rest aus, statt ihn verschwinden zu lassen.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { pixelMap, pixelMapSvg, portUrteil, rasterFuer, wandSumme } from '../src/renderer/lib/ledWall'
import type { LedPanelType, LedWall } from '../src/renderer/types/ledWall'

/** Ein Kachelmass, wie es die Branche fährt: 500 × 500 mm, 128 × 128 px. */
const panel = (over: Partial<LedPanelType> = {}): LedPanelType => ({
  id: 'p1',
  name: 'P3.9 500×500',
  pitchMm: 3.9,
  pixels: { x: 128, y: 128 },
  sizeMm: { w: 500, h: 500, d: 75 },
  weightKg: 7.5,
  powerAvgW: 60,
  powerMaxW: 180,
  ...over,
})

const wand = (over: Partial<LedWall> = {}): LedWall => ({
  id: 'w1',
  name: 'Bühnenwand',
  panelTypeId: 'p1',
  columns: 10,
  rows: 6,
  ...over,
})

describe('das Raster', () => {
  it('rundet ab — eine halbe Kachel ist keine', () => {
    const r = rasterFuer(panel(), 5200, 3100)
    expect(r.columns).toBe(10)
    expect(r.rows).toBe(6)
  })

  it('weist den Rest aus, statt ihn verschwinden zu lassen', () => {
    const r = rasterFuer(panel(), 5200, 3100)
    expect(r.restBreiteMm).toBe(200)
    expect(r.restHoeheMm).toBe(100)
  })

  it('gibt null Kacheln zurück, wenn nicht mal eine passt', () => {
    const r = rasterFuer(panel(), 400, 400)
    expect(r.columns).toBe(0)
    expect(r.rows).toBe(0)
    expect(r.restBreiteMm).toBe(400)
  })
})

describe('die Summe', () => {
  it('rechnet Auflösung, Mass und Kachelzahl', () => {
    const s = wandSumme(panel(), 10, 6)
    expect(s.panels).toBe(60)
    expect(s.pixels).toEqual({ x: 1280, y: 768 })
    expect(s.pixelGesamt).toBe(1280 * 768)
    expect(s.sizeMm).toEqual({ w: 5000, h: 3000 })
  })

  it('rechnet Gewicht und beide Leistungen', () => {
    const s = wandSumme(panel(), 10, 6)
    expect(s.weightKg).toBe(450)
    expect(s.powerAvgW).toBe(3600)
    expect(s.powerMaxW).toBe(10800)
  })

  it('macht aus einem fehlenden Gewicht KEINE Null', () => {
    const s = wandSumme(panel({ weightKg: undefined }), 10, 6)
    expect(s.weightKg).toBeUndefined()
    expect(s.panels).toBe(60)
  })

  it('macht aus einer fehlenden Leistung KEINE Null', () => {
    const s = wandSumme(panel({ powerAvgW: undefined, powerMaxW: undefined }), 10, 6)
    expect(s.powerAvgW).toBeUndefined()
    expect(s.powerMaxW).toBeUndefined()
  })

  it('gibt die Spitzenleistung auch dann, wenn die Dauerleistung fehlt', () => {
    // Wer nur eine der beiden Zahlen hat, bekommt auch nur eine — und
    // ausdrücklich nicht die andere geschätzt.
    const s = wandSumme(panel({ powerAvgW: undefined }), 10, 6)
    expect(s.powerAvgW).toBeUndefined()
    expect(s.powerMaxW).toBe(10800)
  })
})

describe('die Ausspielung', () => {
  it('sagt, wie viele Ports gebraucht werden', () => {
    // 983.040 Pixel bei 650.000 je Port: zwei Ports.
    const u = portUrteil(wandSumme(panel(), 10, 6), wand({ ausspielung: { ports: 4, pixelProPort: 650_000 } }))
    if (!u.bekannt) throw new Error('erwartet bekannt')
    expect(u.gebraucht).toBe(2)
    expect(u.reicht).toBe(true)
  })

  it('meldet, wenn die Karte nicht reicht', () => {
    const u = portUrteil(wandSumme(panel(), 20, 12), wand({ ausspielung: { ports: 2, pixelProPort: 650_000 } }))
    if (!u.bekannt) throw new Error('erwartet bekannt')
    expect(u.gebraucht).toBe(7)
    expect(u.reicht).toBe(false)
  })

  it('schweigt ohne Angabe — eine Karte trägt nicht unbegrenzt viel', () => {
    const u = portUrteil(wandSumme(panel(), 10, 6), wand())
    expect(u.bekannt).toBe(false)
  })

  it('schweigt auch bei einer Kapazität von 0', () => {
    const u = portUrteil(wandSumme(panel(), 10, 6), wand({ ausspielung: { ports: 4, pixelProPort: 0 } }))
    expect(u.bekannt).toBe(false)
  })
})

describe('die Pixelmap', () => {
  it('nummeriert zeilenweise von oben links — die Reihenfolge des Aufbaus', () => {
    const k = pixelMap(panel(), 3, 2)
    expect(k).toHaveLength(6)
    expect(k[0]).toMatchObject({ column: 1, row: 1, x: 0, y: 0, nummer: 1 })
    expect(k[2]).toMatchObject({ column: 3, row: 1, x: 256, y: 0, nummer: 3 })
    expect(k[3]).toMatchObject({ column: 1, row: 2, x: 0, y: 128, nummer: 4 })
  })

  it('ist so gross wie die Wand Pixel hat', () => {
    const svg = pixelMapSvg(panel(), 10, 6)
    expect(svg).toContain('width="1280"')
    expect(svg).toContain('height="768"')
    expect(svg).toContain('viewBox="0 0 1280 768"')
  })

  it('zeichnet eine Kachel je Panel', () => {
    const svg = pixelMapSvg(panel(), 3, 2)
    // Ein Hintergrund-Rechteck plus sechs Kacheln.
    expect(svg.split('<rect').length - 1).toBe(7)
  })
})
