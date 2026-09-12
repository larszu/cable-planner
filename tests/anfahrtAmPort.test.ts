import { describe, it, expect } from 'vitest'
import { computeEquipmentLayout } from '../src/renderer/lib/equipmentLayout'
import { routeCableWithAStar, CELL_SIZE } from '../src/renderer/lib/routeCableWithAStar'
import { legeAnfahrt, hatKehrtwende, type Anschlussseite } from '../src/renderer/lib/cableApproach'
import { pathIsBlocked } from '../src/renderer/lib/cableRouting'
import { EQUIPMENT_LAYOUT } from '../src/renderer/lib/layoutConstants'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// „UNTERHALB VOM ZIEL-PORT UND DANN WIEDER HOCH" — UND DIE HAKEN
//
// NUTZER-MELDUNG 2026-09-12: „Es gehen die Kabel manchmal noch etwas unterhalb
// von dem Ziel-Port und dann wieder hoch, dann erst in den Ziel-Port. Manchmal
// passieren auch Haken."
//
// ─── EIN BEFUND, ZWEI ERSCHEINUNGEN ───────────────────────────────────────
//
// A* rechnet auf einem Gitter aus 20-px-Zellen (`CELL_SIZE`). Die Buchsen
// sitzen auf dem 11-px-Raster des Geraets (`EQUIPMENT_LAYOUT.GRID_SIZE`,
// Port-Reihe 22 px). Die beiden Raster treffen sich nie: der Stuetzpunkt neben
// der Buchse liegt bis zu eine halbe Zelle daneben, und der gezeichnete Weg
// holt den Rest als kleine Stufe nach — unmittelbar vor der Buchse. Das ist
// die erste Erscheinung.
//
// Zeigt diese Stufe in die Gegenrichtung des naechsten Abschnitts, steht sie
// als Sporn aus der Linie heraus. Das ist die zweite — der „Haken":
//
//     …(380, 155) -> (380, 160) -> (380, 60)…
//                     ^^^^^^^^^^ 5 px hinunter und sofort wieder hinauf
//
// GEMESSEN vor der Korrektur, ueber 3300 Wege in 25 Raster-Szenen:
//   Stufe am Ziel      3300 von 3300      danach 0
//   Stufe an der Quelle 3300 von 3300     danach 0
//   Kehrtwende im gezeichneten Weg 1972 (59,8 %)   danach 0
//
// ─── WOGEGEN DIESER LAUF STEHT ────────────────────────────────────────────
//
// Dagegen, dass der letzte Stuetzpunkt vor der Buchse wieder auf das
// Wegfinder-Gitter zurueckfaellt. Er prueft den Weg, der WIRKLICH GEZEICHNET
// WIRD (`legeAnfahrt` samt Stummeln und eingeschobenen Ecken) — nicht das
// Ergebnis des Routers: die Stufe entsteht erst beim Zusammensetzen.
//
// WAS ER NICHT KANN: er rechnet. Ob der Strich im Fenster schoen liegt, misst
// er nicht.
// ───────────────────────────────────────────────────────────────────────────

const seite = (s: 'left' | 'right'): Anschlussseite => (s === 'left' ? 'links' : 'rechts')

const geraet = (id: string, x: number, y: number): EquipmentItem =>
  ({
    id, name: `Device ${id}`, category: 'Other', x, y,
    inputs: [0, 1, 2, 3].map((i) => ({
      id: `${id}-in${i}`, name: `In ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'in' as const,
    })),
    outputs: [0, 1, 2, 3].map((i) => ({
      id: `${id}-out${i}`, name: `Out ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'out' as const,
    })),
  }) as EquipmentItem

interface Lauf {
  wege: number
  stufeAmZiel: number
  stufeAnDerQuelle: number
  haken: number
  durchEinGeraet: number
  /** Buchsen, deren Achse NICHT auf dem Wegfinder-Gitter liegt. Ist die Zahl
   *  null, koennte die Stufe gar nicht entstehen und die drei Pruefungen
   *  darueber waeren still gruen. */
  buchsenNebenDemGitter: number
}

const messe = (): Lauf => {
  const lauf: Lauf = {
    wege: 0, stufeAmZiel: 0, stufeAnDerQuelle: 0, haken: 0, durchEinGeraet: 0, buchsenNebenDemGitter: 0,
  }
  for (const dx of [300, 420, 560]) {
    for (const dy of [200, 260, 340]) {
      const geraete: EquipmentItem[] = []
      for (let c = 0; c < 4; c += 1) {
        for (let r = 0; r < 3; r += 1) geraete.push(geraet(`d${c}-${r}`, 120 + c * dx, 100 + r * dy))
      }
      const layouts = new Map(geraete.map((g) => [g.id, computeEquipmentLayout(g)]))
      const hindernisse = geraete.map((g) => ({
        x: g.x, y: g.y, width: layouts.get(g.id)!.width, height: layouts.get(g.id)!.height, id: g.id,
      }))
      const rechtecke = hindernisse.map((h) => ({ x: h.x, y: h.y, width: h.width, height: h.height }))
      const ids = hindernisse.map((h) => h.id)

      for (const a of geraete) {
        for (const b of geraete) {
          if (a.id === b.id) continue
          // Zwei verschiedene Port-Reihen, damit die Rundung nicht immer
          // dieselbe ist: Reihe 0 und Reihe 1 liegen unterschiedlich zum Gitter.
          for (const [aus, ein] of [[0, 1], [2, 3]]) {
            const quelle = layouts.get(a.id)!.portPos(a.outputs![aus].id, 'source')!
            const ziel = layouts.get(b.id)!.portPos(b.inputs![ein].id, 'target')!
            for (const p of [quelle, ziel]) {
              if (Math.abs(p.y - Math.round(p.y / CELL_SIZE) * CELL_SIZE) > 0.5) lauf.buchsenNebenDemGitter += 1
            }
            const wp = routeCableWithAStar({
              source: { x: quelle.x, y: quelle.y },
              target: { x: ziel.x, y: ziel.y },
              sourceSide: quelle.side,
              targetSide: ziel.side,
              obstacles: hindernisse,
              sourceEquipmentId: a.id,
              targetEquipmentId: b.id,
            })
            if (!wp || wp.length === 0) continue
            lauf.wege += 1
            if (Math.abs(wp[wp.length - 1].y - ziel.y) > 0.5) lauf.stufeAmZiel += 1
            if (Math.abs(wp[0].y - quelle.y) > 0.5) lauf.stufeAnDerQuelle += 1
            const eigene = new Set([a.id, b.id])
            const gezeichnet = legeAnfahrt({
              quelle: { x: quelle.x, y: quelle.y },
              quelleSeite: seite(quelle.side),
              ziel: { x: ziel.x, y: ziel.y },
              zielSeite: seite(ziel.side),
              zwischen: wp,
              jitter: 0,
              meide: rechtecke.filter((_, i) => eigene.has(ids[i])),
            })
            if (hatKehrtwende(gezeichnet)) lauf.haken += 1
            if (pathIsBlocked(gezeichnet, rechtecke, eigene, ids)) lauf.durchEinGeraet += 1
          }
        }
      }
    }
  }
  return lauf
}

describe('Die Anfahrt endet auf der Achse der Buchse', () => {
  const lauf = messe()

  it('die Szene kann die Stufe ueberhaupt erzeugen', () => {
    // Der Wegfinder rastert auf CELL_SIZE, das Geraet auf GRID_SIZE. Solange
    // die beiden nicht aufgehen, liegen Buchsen zwangslaeufig neben dem
    // Gitter — und nur dann pruefen die drei Zeilen darunter etwas.
    expect(CELL_SIZE % EQUIPMENT_LAYOUT.GRID_SIZE).not.toBe(0)
    expect(lauf.buchsenNebenDemGitter).toBeGreaterThan(100)
    expect(lauf.wege).toBeGreaterThan(500)
  })

  it('kein Weg endet neben der Buchse und steigt erst davor ein', () => {
    expect(lauf.stufeAmZiel).toBe(0)
    expect(lauf.stufeAnDerQuelle).toBe(0)
  })

  it('kein gezeichneter Weg macht kehrt — keine Haken', () => {
    expect(lauf.haken).toBe(0)
  })

  it('und nichts davon laeuft durch ein unbeteiligtes Geraet', () => {
    expect(lauf.durchEinGeraet).toBe(0)
  })
})
