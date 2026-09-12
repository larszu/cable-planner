import { describe, it, expect } from 'vitest'
import { computeEquipmentLayout } from '../src/renderer/lib/equipmentLayout'
import { routeCableWithAStar } from '../src/renderer/lib/routeCableWithAStar'
import { legeAnfahrt, hatKehrtwende, type Anschlussseite } from '../src/renderer/lib/cableApproach'
import { pathIsBlocked } from '../src/renderer/lib/cableRouting'
import { RASTER_DEFAULT, RASTER_MAX, RASTER_MIN, rasterAus } from '../src/renderer/lib/raster'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// „UNTERHALB VOM ZIEL-PORT UND DANN WIEDER HOCH" — UND DIE HAKEN
//
// NUTZER-MELDUNG 2026-09-12: „Es gehen die Kabel manchmal noch etwas unterhalb
// von dem Ziel-Port und dann wieder hoch, dann erst in den Ziel-Port. Manchmal
// passieren auch Haken."
//
// ─── WAS DIE URSACHE WAR ──────────────────────────────────────────────────
//
// Zwei Raster. A* rechnete auf festen 20-px-Zellen, die Buchsen sassen auf dem
// 11-px-Raster des Geraets. Der Stuetzpunkt neben einer Buchse lag deshalb bis
// zu eine halbe Zelle daneben, und der gezeichnete Weg holte den Rest als
// Stufe unmittelbar vor der Buchse nach. Zeigte die Stufe gegen den naechsten
// Abschnitt, stand sie als Sporn heraus — der „Haken":
//
//     …(380, 155) -> (380, 160) -> (380, 60)…
//                     ^^^^^^^^^^ 5 px hinunter und sofort wieder hinauf
//
// GEMESSEN vor der Korrektur, ueber 3300 Wege in 25 Raster-Szenen:
//   Stufe am Ziel 3300 von 3300, Stufe an der Quelle 3300 von 3300,
//   Kehrtwende im gezeichneten Weg 1972 (59,8 %).
//
// ─── WAS DIESER LAUF SEIT DEM 2026-09-12 PRUEFT ───────────────────────────
//
// Die erste Fassung dieses Waechters verlangte als Vorbedingung, dass die
// beiden Raster NICHT aufgehen (`CELL_SIZE % GRID_SIZE !== 0`) und dass ueber
// 100 Buchsen neben dem Gitter liegen — sonst haette er nichts gemessen. Genau
// diese Vorbedingung ist jetzt falsch, und zwar weil der Defekt behoben ist:
// es gibt nur noch EIN Raster (`lib/raster.ts`), eine Zelle des Wegfinders ist
// ein Rasterschritt, und damit liegt JEDE Buchse auf einem Gitterpunkt.
//
// Der Waechter behauptet deshalb ab hier etwas anderes — nicht weniger:
//
//   1. Die Zusage selbst: bei JEDER zulaessigen Rastergroesse liegt keine
//      einzige Buchse neben dem Gitter. Das ist die Aussage, die die Stufe
//      unmoeglich macht.
//   2. Die Gegenprobe im selben Lauf: auf dem ALTEN festen 20-px-Gitter laegen
//      dieselben Buchsen hundertfach daneben. Ohne diese Zeile waere Punkt 1
//      eine Behauptung ueber eine Szene, die die Frage gar nicht stellt.
//   3. Der gezeichnete Weg (`legeAnfahrt` samt Stummeln und eingeschobenen
//      Ecken, nicht die rohen Wegpunkte) traegt keine Stufe, keinen Haken und
//      laeuft durch kein unbeteiligtes Geraet.
//
// WAS ER NICHT KANN: er rechnet. Ob der Strich im Fenster schoen liegt, misst
// er nicht. Und er prueft die Rastergroessen unten, nicht jede dazwischen.
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
  /** Buchsen, deren Achse NICHT auf dem Gitter des Wegfinders liegt. Muss 0
   *  sein — das ist die Zusage. */
  buchsenNebenDemGitter: number
  /** Dieselben Buchsen, gemessen gegen das ALTE feste 20-px-Gitter. Muss gross
   *  sein, sonst stellt die Szene die Frage nicht und die Null darueber
   *  belegt nichts. */
  buchsenNebenDemAltenGitter: number
}

/** Das feste Zellmass, mit dem der Wegfinder bis zum 2026-09-12 rechnete. Nur
 *  fuer die Gegenprobe — im Quelltext gibt es diese Zahl nicht mehr. */
const ALTES_ZELLMASS = 20

const messe = (rasterPx: number): Lauf => {
  const raster = rasterAus(rasterPx)
  const rasten = (n: number) => Math.round(n / raster.GRID_SIZE) * raster.GRID_SIZE
  const lauf: Lauf = {
    wege: 0, stufeAmZiel: 0, stufeAnDerQuelle: 0, haken: 0, durchEinGeraet: 0,
    buchsenNebenDemGitter: 0, buchsenNebenDemAltenGitter: 0,
  }
  // ─── DIE SZENE WAECHST MIT DEM RASTER ─────────────────────────────────
  //
  // Die Abstaende standen hier als feste Pixelzahlen (300/420/560 mal
  // 200/260/340). Das ging, solange die Geraete immer gleich gross waren.
  // Seit ihre Hoehe der Rastergroesse folgt, ist ein Geraet bei 60 px Raster
  // 600 px hoch — bei 200 px Zeilenabstand stapeln sich die Karten dann
  // ineinander, und der Waechter meldet nicht den Router, sondern seine
  // eigene unmoegliche Szene (gemessen: 12 Stufen, 12 Haken, alle aus
  // ueberlappenden Geraeten).
  //
  // Die Abstaende sind deshalb Vielfache der GEMESSENEN Geraetegroesse.
  const probe = computeEquipmentLayout(geraet('probe', 0, 0), undefined, raster)
  for (const spaltenLuecke of [0.4, 0.9, 1.6]) {
    for (const zeilenLuecke of [0.4, 0.8, 1.4]) {
      const dx = rasten(probe.width * (1 + spaltenLuecke))
      const dy = rasten(probe.height * (1 + zeilenLuecke))
      const geraete: EquipmentItem[] = []
      for (let c = 0; c < 4; c += 1) {
        for (let r = 0; r < 3; r += 1)
          geraete.push(geraet(`d${c}-${r}`, rasten(120) + c * dx, rasten(100) + r * dy))
      }
      const layouts = new Map(geraete.map((g) => [g.id, computeEquipmentLayout(g, undefined, raster)]))
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
              const z = raster.CELL_SIZE
              if (Math.abs(p.y - Math.round(p.y / z) * z) > 0.001) lauf.buchsenNebenDemGitter += 1
              if (Math.abs(p.y - Math.round(p.y / ALTES_ZELLMASS) * ALTES_ZELLMASS) > 0.001)
                lauf.buchsenNebenDemAltenGitter += 1
            }
            const wp = routeCableWithAStar({
              source: { x: quelle.x, y: quelle.y },
              target: { x: ziel.x, y: ziel.y },
              sourceSide: quelle.side,
              targetSide: ziel.side,
              obstacles: hindernisse,
              sourceEquipmentId: a.id,
              targetEquipmentId: b.id,
              rasterPx: raster.GRID_SIZE,
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

// Die Vorgabe, die beiden Raender des Erlaubten und ein krummer Wert
// dazwischen. Mehr waere Rechenzeit ohne neue Aussage: die Regel in
// `raster.ts` kennt keine Sonderfaelle zwischen diesen Punkten.
const RASTER_PROBEN = [RASTER_MIN, 13, RASTER_DEFAULT, RASTER_MAX]

describe.each(RASTER_PROBEN)('Die Anfahrt endet auf der Achse der Buchse (Raster %i px)', (rasterPx) => {
  const lauf = messe(rasterPx)

  it('die Szene stellt die Frage ueberhaupt', () => {
    expect(lauf.wege).toBeGreaterThan(500)
    if (rasterAus(rasterPx).GRID_SIZE % ALTES_ZELLMASS === 0) {
      // Ein Raster, das ein Vielfaches der alten festen 20 px ist, waere auch
      // mit dem alten Gitter aufgegangen. Hier gibt es nichts gegenzuproben —
      // und das steht hier, damit niemand die fehlende Gegenprobe fuer ein
      // Versehen haelt.
      expect(lauf.buchsenNebenDemAltenGitter).toBe(0)
      return
    }
    // Sonst: auf dem alten festen 20-px-Gitter laegen diese Buchsen
    // hundertfach daneben. Ohne diese Zeile waere die Null darunter eine
    // Aussage ueber eine Szene, in der gar nichts schiefgehen koennte.
    expect(lauf.buchsenNebenDemAltenGitter).toBeGreaterThan(100)
  })

  it('keine Buchse liegt neben dem Gitter des Wegfinders', () => {
    // Die Zusage: ein Raster, und die Buchsen sind Gitterpunkte. Wer das
    // Zellmass wieder von der Rastergroesse loest, faellt hier zuerst.
    expect(lauf.buchsenNebenDemGitter).toBe(0)
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
