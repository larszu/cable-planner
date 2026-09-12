import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeEquipmentLayout } from '../src/renderer/lib/equipmentLayout'
import { routeCableWithAStar, versuchMitAbstand } from '../src/renderer/lib/routeCableWithAStar'
import { pathIsBlocked } from '../src/renderer/lib/cableRouting'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// „DAS AUTOMATISCH ROUTEN HAT EINE SEHR UMSTAENDLICHE ROUTE GENOMMEN"
//
// NUTZER-MELDUNG 2026-09-12: „Zudem hat das automatisch Routen eine sehr
// umstaendliche und zu lange Route genommen. Es haette nach rechts, dann nach
// oben und dann wieder nach rechts gehen muessen, ist aber nach links, dann
// nach oben, dann nach rechts durch ein Geraet durch und dann nach oben und
// dann nach rechts gegangen."
//
// ─── ZWEI BEFUNDE, UND SIE HAENGEN ZUSAMMEN ───────────────────────────────
//
// 1. A* GAB ZU SCHNELL AUF. Der Abstand von zwei Gitterzellen (40 px) um jedes
//    Geraet war eine BEDINGUNG. Ueber 1188 Kabel-Paare in neun Raster-Szenen
//    fand A* in 342 Faellen (28,8 %) keinen Weg — und alle 342 waren gerettet,
//    sobald der Abstand eine Zelle betrug.
//
// 2. UND WENN A* AUFGIBT, RECHNET EIN ZWEITER ROUTER. `routeAround`
//    (`lib/cableRouting.ts`) kennt vier einfache Formen und je vier Umwege um
//    EIN Rechteck und liefert ausdruecklich auch den kuerzesten NICHT-freien
//    Weg, wenn keiner frei ist. Der laeuft dann durch ein Geraet.
//
// Der zweite Router lief nicht nur im Notfall: bis 2026-09-12 kam JEDER
// automatische Weg von ihm, weil `CableEdge` sein Ergebnis nach dem ersten
// Rechnen in `cable.waypoints` schrieb (#206). A* lief nur auf Befehl.
// Zwei Rechnungen fuer dieselbe Frage — die Defektform `zwei-rechnungen`.
//
// ─── WOGEGEN DIESER LAUF STEHT ────────────────────────────────────────────
//
// Gegen beides: dass die Leiter wieder zur festen Bedingung wird, und dass der
// automatische Weg wieder aus dem schwaecheren Router kommt.
//
// WAS ER NICHT KANN: er rechnet. Ob der Strich im Fenster schoen liegt, misst
// er nicht — dafuer gibt es `scripts/greifzonen-check.mjs` (fuer den Griff)
// und das Auge.
// ───────────────────────────────────────────────────────────────────────────

const geraet = (id: string, name: string, x: number, y: number): EquipmentItem =>
  ({
    id,
    name,
    category: 'Other',
    x,
    y,
    inputs: [0, 1, 2, 3].map((i) => ({
      id: `${id}-in${i}`, name: `In ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'in' as const,
    })),
    outputs: [0, 1, 2, 3].map((i) => ({
      id: `${id}-out${i}`, name: `Out ${i + 1}`, type: 'BNC', connectorType: 'BNC', direction: 'out' as const,
    })),
  }) as EquipmentItem

/** Dieselben neun Raster-Szenen, an denen die Zahlen oben gemessen sind. */
const szenen = () => {
  const alle: EquipmentItem[][] = []
  for (const spaltenAbstand of [300, 420, 560]) {
    for (const zeilenAbstand of [200, 260, 340]) {
      const geraete: EquipmentItem[] = []
      for (let c = 0; c < 4; c += 1) {
        for (let r = 0; r < 3; r += 1) {
          geraete.push(
            geraet(`d${c}${r}`, `Device ${c}${r}`, 100 + c * spaltenAbstand, 100 + r * zeilenAbstand),
          )
        }
      }
      alle.push(geraete)
    }
  }
  return alle
}

interface Lauf {
  paare: number
  /** Kein Weg — mit der Leiter. */
  ohneWeg: number
  /** Kein Weg — mit dem Wunsch-Abstand als BEDINGUNG, also so, wie es bis
   *  2026-09-12 war. Die Zahl ist der ganze Grund fuer die Leiter. */
  ohneWegBeiFestemAbstand: number
  durchEinGeraet: number
}

const messe = (): Lauf => {
  const lauf: Lauf = { paare: 0, ohneWeg: 0, ohneWegBeiFestemAbstand: 0, durchEinGeraet: 0 }
  for (const geraete of szenen()) {
    const layouts = new Map(geraete.map((g) => [g.id, computeEquipmentLayout(g)]))
    const hindernisse = geraete.map((g) => ({
      x: g.x, y: g.y, width: layouts.get(g.id)!.width, height: layouts.get(g.id)!.height, id: g.id,
    }))
    const ids = hindernisse.map((h) => h.id)
    const rechtecke = hindernisse.map((h) => ({ x: h.x, y: h.y, width: h.width, height: h.height }))
    for (const a of geraete) {
      for (const b of geraete) {
        if (a.id === b.id) continue
        const quelle = layouts.get(a.id)!.portPos(a.outputs![0].id, 'source')!
        const ziel = layouts.get(b.id)!.portPos(b.inputs![0].id, 'target')!
        lauf.paare += 1
        const auftrag = {
          source: { x: quelle.x, y: quelle.y },
          target: { x: ziel.x, y: ziel.y },
          sourceSide: quelle.side,
          targetSide: ziel.side,
          obstacles: hindernisse,
          sourceEquipmentId: a.id,
          targetEquipmentId: b.id,
        }
        // Die alte Fassung: der Wunsch-Abstand als Bedingung, eine Sprosse.
        if (!versuchMitAbstand(auftrag, 2)) lauf.ohneWegBeiFestemAbstand += 1
        const weg = routeCableWithAStar(auftrag)
        if (!weg) {
          lauf.ohneWeg += 1
          continue
        }
        const voll = [{ x: quelle.x, y: quelle.y }, ...weg, { x: ziel.x, y: ziel.y }]
        const eigene = new Set([a.id, b.id])
        if (pathIsBlocked(voll, rechtecke, eigene, ids)) lauf.durchEinGeraet += 1
      }
    }
  }
  return lauf
}

describe('Automatisches Routen: eine Rechnung, und sie gibt nicht zu frueh auf', () => {
  const lauf = messe()

  it('findet fuer JEDES Kabel-Paar einen Weg', () => {
    // Vor der Leiter: 342 von 1188 ohne Weg. Wer die Leiter herausnimmt,
    // faellt hier zuerst — und nicht erst beim Nutzer.
    expect(lauf.paare).toBeGreaterThan(1000)
    expect(lauf.ohneWeg).toBe(0)
  })

  it('legt keinen Weg durch ein unbeteiligtes Geraet', () => {
    expect(lauf.durchEinGeraet).toBe(0)
  })

  it('und die Szene braucht die Leiter wirklich', () => {
    // Ohne diese Pruefung waeren die beiden darueber still gruen, sobald
    // jemand die Szene weiter stellt: dann findet auch eine einzige Sprosse
    // ueberall einen Weg, und „0 ohne Weg" belegt nichts mehr.
    //
    // Gemessen: 342 von 1188 Paaren finden mit dem Wunsch-Abstand als
    // Bedingung KEINEN Weg. Mit der Leiter sind es null.
    expect(lauf.ohneWegBeiFestemAbstand).toBeGreaterThan(300)
  })
})

describe('Der automatische Weg kommt vom A*-Router, nicht vom Notfall-Router', () => {
  const lies = (p: string): string => readFileSync(resolve(__dirname, '..', p), 'utf8')
  const kante = lies('src/renderer/components/Canvas/CableEdge.tsx')

  it('CableEdge persistiert das Ergebnis von routeCableWithAStar', () => {
    const start = kante.indexOf('persistTriedRef.current = true')
    expect(start).toBeGreaterThan(0)
    const bereich = kante.slice(start, start + 1200)
    expect(bereich).toContain('routeCableWithAStar({')
    // Und das Ergebnis geht auch wirklich ins Kabel — nicht nur berechnet
    // und weggeworfen.
    expect(bereich).toMatch(/updateCable\(cable\.id, \{ waypoints: \w+ \?\? orthogonalWaypoints \}\)/)
  })

  it('routeAround bleibt der Ausweg und nicht der Normalfall', () => {
    // `computeObstacleAwareWaypoints` darf weiter vorkommen — als Weg fuer
    // das eine Bild vor dem Persist und als letzter Ausweg. Was NICHT mehr
    // vorkommen darf, ist ein Persist, der nur ihn kennt.
    const start = kante.indexOf('persistTriedRef.current = true')
    const bereich = kante.slice(start, start + 1200)
    expect(bereich).not.toMatch(/updateCable\(cable\.id, \{ waypoints: orthogonalWaypoints \}\)/)
  })
})

describe('Griff-Zonen gehoeren dem ausgewaehlten Kabel', () => {
  const lies = (p: string): string => readFileSync(resolve(__dirname, '..', p), 'utf8')
  const griff = lies('src/renderer/components/Canvas/CableWaypoints.tsx')

  it('die Abschnitts-Zonen werden nur bei `selected` gerendert', () => {
    // Gemessen vor der Korrektur (`scripts/greifzonen-check.mjs`): an 30 von
    // 312 Stellen auf der eigenen Linie eines Kabels lag der Griff eines
    // fremden obenauf; gezogen an Kabel 3, bewegt hat sich Kabel 7.
    expect(griff).toContain('{selected && points.slice(0, -1).map(')
    // Gegenprobe-sicher: es darf keine UNgegattete zweite Fassung geben.
    const ungegattet = griff.match(/(?<!selected && )points\.slice\(0, -1\)\.map\(/g)
    expect(ungegattet).toBeNull()
  })

  it('traegt die Marke, an der der Browser-Waechter sie erkennt', () => {
    expect(griff).toContain('cp-kabelgriff')
    expect(griff).toContain('data-kabel-id={cable.id}')
  })

  it('zieht nicht mehr am nicht ausgewaehlten Kabel', () => {
    expect(griff).not.toContain('if (!selected) setSelection(')
  })
})
