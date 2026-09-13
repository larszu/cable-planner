import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeEquipmentLayout } from '../src/renderer/lib/equipmentLayout'
import {
  RASTER_DEFAULT,
  RASTER_MAX,
  RASTER_MIN,
  RASTER_MINDEST,
  rasterAus,
} from '../src/renderer/lib/raster'
import { EQUIPMENT_LAYOUT } from '../src/renderer/lib/layoutConstants'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// EINE ZAHL, AUS DER ALLES FOLGT
//
// NUTZER-MELDUNG 2026-09-12: „Stattdessen solltest du besser die
// Berechnungsgrundlage des A* von dem Raster abhaengig machen. Das Raster kann
// man doch auch im Menue veraendern. Da ist ein hart kodiertes 20-px-Zellen
// doch dumm. Ebenso das fest kodierte Raster der Geraete."
//
// Vorher gab es drei Zahlen fuer dieselbe Frage: die eingestellte
// Rastergroesse, die 11-Vielfachen im Geraete-Layout und die 20-px-Zelle des
// Wegfinders. Dieser Lauf haelt fest, dass es wieder eine ist.
//
// WAS ER NICHT KANN: er rechnet. Ob eine Karte bei 60 px Raster im Fenster
// noch gut aussieht, ist eine Geschmacksfrage und steht hier nicht.
// ───────────────────────────────────────────────────────────────────────────

const geraet = (id: string, x: number, y: number, ports: number): EquipmentItem =>
  ({
    id, name: `Device ${id}`, category: 'Other', x, y,
    inputs: Array.from({ length: ports }, (_, i) => ({
      id: `${id}-in${i}`, name: `In ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'in' as const,
    })),
    outputs: Array.from({ length: ports }, (_, i) => ({
      id: `${id}-out${i}`, name: `Out ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'out' as const,
    })),
  }) as EquipmentItem

const ALLE_RASTER = Array.from(
  { length: RASTER_MAX - RASTER_MIN + 1 },
  (_, i) => RASTER_MIN + i,
)

describe('Das Raster ist eine Zahl, und alles andere folgt ihr', () => {
  it('bei der Vorgabe stehen exakt die Zahlen von vorher', () => {
    // Der Beleg, dass diese Aenderung bei der Vorgabe nichts verschiebt:
    // 44 / 66 / 22 / 11 / 220 sind die Werte, die bis zum 2026-09-12 als
    // Konstanten in `layoutConstants.ts` standen.
    expect(EQUIPMENT_LAYOUT).toMatchObject({
      GRID_SIZE: 11,
      HEADER_HEIGHT: 44,
      HEADER_HEIGHT_WITH_IP: 66,
      PORT_ROW: 22,
      PADDING: 11,
      DEFAULT_WIDTH: 220,
      CELL_SIZE: 11,
    })
    expect(EQUIPMENT_LAYOUT).toEqual(rasterAus(RASTER_DEFAULT))
  })

  it('layoutConstants schreibt diese Zahlen nicht mehr hin', () => {
    // Sonst waere die Zeile darueber gruen, waehrend daneben weiter eine
    // zweite, feste Fassung derselben Masse laege.
    const quelle = readFileSync(
      resolve(__dirname, '..', 'src/renderer/lib/layoutConstants.ts'),
      'utf8',
    )
    const codeZeilen = quelle
      .split('\n')
      .filter((z) => !z.trimStart().startsWith('*') && !z.trimStart().startsWith('//'))
      .join('\n')
    for (const zahl of ['44', '66', '22', '220']) {
      expect(codeZeilen).not.toMatch(new RegExp(`(HEADER_HEIGHT|PORT_ROW|DEFAULT_WIDTH)[^\\n]*${zahl}`))
    }
  })

  it('das Zellmass des Wegfinders teilt die Rastergroesse', () => {
    // Die Eigenschaft, auf der die ganze Ausrichtung ruht: Buchsen-Koordinaten
    // sind Vielfache der Rastergroesse, also liegt eine Buchse genau dann auf
    // jedem Gitterpunkt, wenn das Zellmass die Rastergroesse TEILT. Ein
    // groesseres Mass — auch ein Vielfaches wie 2g — laesst jede zweite
    // Port-Reihe wieder dazwischenfallen.
    for (const g of ALLE_RASTER) {
      const r = rasterAus(g)
      expect(r.GRID_SIZE % r.CELL_SIZE).toBe(0)
    }
  })

  it('die Port-Reihe ist ein GERADES Vielfaches — ihre Mitte bleibt ein Rasterschritt', () => {
    for (const g of ALLE_RASTER) {
      const r = rasterAus(g)
      expect(r.PORT_ROW % (2 * r.GRID_SIZE)).toBe(0)
      expect((r.PORT_ROW / 2) % r.GRID_SIZE).toBe(0)
    }
  })

  it('kein Mass faellt unter seine Lesbarkeitsgrenze', () => {
    for (const g of ALLE_RASTER) {
      const r = rasterAus(g)
      expect(r.HEADER_HEIGHT).toBeGreaterThanOrEqual(RASTER_MINDEST.HEADER_HEIGHT)
      expect(r.HEADER_HEIGHT_WITH_IP).toBeGreaterThanOrEqual(RASTER_MINDEST.HEADER_HEIGHT_WITH_IP)
      expect(r.PORT_ROW).toBeGreaterThanOrEqual(RASTER_MINDEST.PORT_ROW)
      expect(r.PADDING).toBeGreaterThanOrEqual(RASTER_MINDEST.PADDING)
      expect(r.DEFAULT_WIDTH).toBeGreaterThanOrEqual(RASTER_MINDEST.DEFAULT_WIDTH)
    }
  })

  it('jede Buchse liegt bei JEDER Rastergroesse auf einem Gitterpunkt', () => {
    // Nicht aus der Formel abgelesen, sondern aus dem fertigen Layout: Header,
    // Untertitel-Zeile, IP-Zeile und Port-Reihe wirken hier zusammen, und
    // genau dieses Zusammenwirken war der Fehler.
    let geprueft = 0
    for (const g of ALLE_RASTER) {
      const r = rasterAus(g)
      const rasten = (n: number) => Math.round(n / r.GRID_SIZE) * r.GRID_SIZE
      for (const zusatz of [{}, { subtitle: 'Sub' }, { ipAddress: '10.0.0.1' },
                            { ipAddress: '10.0.0.1', subtitle: 'Sub' }]) {
        for (const ports of [1, 2, 5, 9]) {
          const eq = { ...geraet('x', rasten(137), rasten(291), ports), ...zusatz } as EquipmentItem
          const layout = computeEquipmentLayout(eq, undefined, r)
          expect(layout.width % r.GRID_SIZE).toBe(0)
          expect(layout.height % r.GRID_SIZE).toBe(0)
          for (let i = 0; i < ports; i += 1) {
            for (const [liste, art] of [[eq.inputs!, 'target'], [eq.outputs!, 'source']] as const) {
              const p = layout.portPos(liste[i].id, art)!
              expect(p.x % r.CELL_SIZE).toBe(0)
              expect(p.y % r.CELL_SIZE).toBe(0)
              geprueft += 1
            }
          }
        }
      }
    }
    // Ohne diese Zeile koennte die Schleife leer laufen und der Lauf waere
    // gruen, ohne eine einzige Buchse angesehen zu haben.
    expect(geprueft).toBeGreaterThan(3000)
  })

  it('die eingestellte Rastergroesse wird beim Laden geprueft, nicht verworfen', () => {
    // Bis 2026-09-12 stand im uiStore-Hydrate `merged.gridSize =
    // defaults.gridSize`. Die Einstellung unter Einstellungen > Bearbeiten
    // wirkte dadurch bis zum naechsten Start und war danach weg.
    const quelle = readFileSync(resolve(__dirname, '..', 'src/renderer/store/uiStore.ts'), 'utf8')
    const codeZeilen = quelle
      .split('\n')
      .filter((z) => !z.trimStart().startsWith('//') && !z.trimStart().startsWith('*'))
      .join('\n')
    expect(codeZeilen).not.toContain('merged.gridSize = defaults.gridSize')
    expect(codeZeilen).toContain('rasterGrenzen(merged.gridSize)')
  })
})
