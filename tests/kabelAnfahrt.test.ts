import { describe, expect, it } from 'vitest'
import {
  ANFAHRT_STUMMEL,
  hatKehrtwende,
  istRechtwinklig,
  legeAnfahrt,
  stummel,
  type Anschlussseite,
} from '../src/renderer/lib/cableApproach'
import {
  computeObstacleAwareWaypoints,
  pathIsBlocked,
  type Point,
} from '../src/renderer/lib/cableRouting'

/**
 * Nutzer-Meldung 2026-09-08: Kabel mit Strichen, „die hin und wieder zurueck
 * gehen", und Pfeile, die schraeg statt gerade in das Geraet fahren.
 *
 * Der Waechter prueft die beiden Fragen, die dahinter stehen — nicht die Zahl
 * der Knicke, nicht die Laenge des Weges:
 *
 *  1. Macht der gezeichnete Streckenzug kehrt?
 *  2. Faehrt das letzte Stueck in die Richtung, in die der Anschluss zeigt?
 *
 * Beides ueber die ganze Matrix aus Anschlussseiten und Ziellagen, weil genau
 * dort gemessen wurde: 312 von 400 Faellen mit Kehrtwende, 192 von 256 mit
 * falscher Einfahrt.
 */

const SEITEN: Anschlussseite[] = ['links', 'rechts', 'oben', 'unten']

/** In welche Richtung faehrt ein Weg, der gerade in diesen Anschluss geht? */
const EINFAHRT: Record<Anschlussseite, Point> = {
  links: { x: 1, y: 0 },
  rechts: { x: -1, y: 0 },
  oben: { x: 0, y: 1 },
  unten: { x: 0, y: -1 },
}
/** In welche Richtung faehrt ein Weg, der gerade aus diesem Anschluss kommt? */
const AUSFAHRT: Record<Anschlussseite, Point> = {
  links: { x: -1, y: 0 },
  rechts: { x: 1, y: 0 },
  oben: { x: 0, y: -1 },
  unten: { x: 0, y: 1 },
}

const einheit = (a: Point, b: Point): Point => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx), y: 0 }
  return { x: 0, y: Math.sign(dy) }
}

const lagen: Array<[number, number]> = []
for (const dx of [-300, -120, -18, 0, 18, 120, 300]) {
  for (const dy of [-220, -80, -18, 0, 18, 80, 220]) lagen.push([dx, dy])
}

const quelle: Point = { x: 400, y: 300 }

describe('Anfahrt ohne Stuetzpunkte', () => {
  it('macht in keiner Lage kehrt und faehrt immer gerade in das Geraet', () => {
    const kehrt: string[] = []
    const schraeg: string[] = []
    const schief: string[] = []
    for (const quelleSeite of SEITEN) {
      for (const zielSeite of SEITEN) {
        for (const [dx, dy] of lagen) {
          // Beide Enden auf demselben Fleck UND dieselbe Anschlussseite: da
          // gibt es keinen Weg ohne Kehrtwende, denn hinaus und hinein zeigen
          // in dieselbe Richtung. Der Fall steht unten in einem eigenen Test
          // — uebergangen, aber nicht verschwiegen.
          if (dx === 0 && dy === 0 && quelleSeite === zielSeite) continue
          const ziel = { x: quelle.x + dx, y: quelle.y + dy }
          const weg = legeAnfahrt({ quelle, quelleSeite, ziel, zielSeite })
          const fall = `${quelleSeite}->${zielSeite} ${dx}/${dy}`
          if (hatKehrtwende(weg)) kehrt.push(fall)
          if (!istRechtwinklig(weg)) schief.push(fall)
          const rein = einheit(weg[weg.length - 2], weg[weg.length - 1])
          const raus = einheit(weg[0], weg[1])
          if (rein.x !== EINFAHRT[zielSeite].x || rein.y !== EINFAHRT[zielSeite].y) {
            schraeg.push(`${fall} rein`)
          }
          if (raus.x !== AUSFAHRT[quelleSeite].x || raus.y !== AUSFAHRT[quelleSeite].y) {
            schraeg.push(`${fall} raus`)
          }
        }
      }
    }
    expect(kehrt).toEqual([])
    expect(schraeg).toEqual([])
    expect(schief).toEqual([])
  })

  it('setzt das erste und letzte Stueck genau auf den Stummel', () => {
    const weg = legeAnfahrt({
      quelle,
      quelleSeite: 'rechts',
      ziel: { x: 140, y: 100 },
      zielSeite: 'links',
    })
    expect(weg[0]).toEqual(quelle)
    expect(weg[1]).toEqual(stummel(quelle, 'rechts'))
    expect(weg[weg.length - 2]).toEqual(stummel({ x: 140, y: 100 }, 'links'))
    expect(weg[weg.length - 1]).toEqual({ x: 140, y: 100 })
    expect(ANFAHRT_STUMMEL).toBeGreaterThan(0)
  })

  it('nennt den einen Fall, der nicht zu loesen ist', () => {
    // Zwei Enden auf demselben Pixel, beide Anschluesse nach rechts: hinaus
    // und hinein zeigen dann in dieselbe Richtung, eine Kehrtwende ist
    // unvermeidlich. Auf dem Canvas kommt das nicht vor (zwei Geraete, zwei
    // Orte) — aber es hier stillschweigend zu ueberspringen hiesse, den
    // Waechter fuer einen echten Fall blind zu machen, falls die Formen
    // spaeter umgebaut werden. Deshalb steht der Fall mit seinem Ergebnis da.
    const weg = legeAnfahrt({
      quelle,
      quelleSeite: 'rechts',
      ziel: quelle,
      zielSeite: 'rechts',
    })
    expect(istRechtwinklig(weg)).toBe(true)
    expect(hatKehrtwende(weg)).toBe(true)
  })

  it('legt die Bahn um die beteiligten Geraete herum, nicht hindurch', () => {
    // Rueckwaerts-Kabel: das Ziel liegt links, sein Anschluss schaut nach
    // links. Der Weg muss aussen herum — die Bahn darf nicht auf der Hoehe
    // der beiden Buchsen liegen, sonst laeuft sie durch die Geraete.
    // Die Buchsen sitzen auf den Geraeteraendern: die Quelle rechts an ihrem
    // Geraet (x = 280 + 120), das Ziel links an seinem (x = 140).
    const ziel = { x: 140, y: 300 }
    // Die Kaesten sind 120 hoch — deutlich mehr als der Bahn-Abstand. Waeren
    // sie flach, laege die Bahn auch ohne Kenntnis der Kaesten zufaellig
    // richtig, und der Test bewiese nichts.
    const meide = [
      { x: 280, y: 240, width: 120, height: 120 },
      { x: 140, y: 240, width: 120, height: 120 },
    ]
    const weg = legeAnfahrt({
      quelle,
      quelleSeite: 'rechts',
      ziel,
      zielSeite: 'links',
      meide,
    })
    expect(hatKehrtwende(weg)).toBe(false)
    // Gefragt ist, ob die LINIE durch einen Kasten laeuft — nicht, ob ein
    // Punkt darin liegt. Die Bahn-Punkte sitzen auf den Stummel-Spalten und
    // damit ohnehin neben den Kaesten; die Waagerechte dazwischen ist die,
    // die hindurchlaufen kann. `pathIsBlocked` stellt genau diese Frage und
    // laesst ein sauberes Tangieren der Kante durchgehen.
    expect(pathIsBlocked(weg, meide)).toBe(false)
  })
})

describe('Anfahrt mit Stuetzpunkten', () => {
  it('haengt den Stummel an beide Enden, auch wenn der Router quer ankommt', () => {
    const gemeldet: string[] = []
    for (const quelleSeite of SEITEN) {
      for (const zielSeite of SEITEN) {
        for (const [dx, dy] of lagen) {
          if (dx === 0 && dy === 0) continue
          const ziel = { x: quelle.x + dx, y: quelle.y + dy }
          const stoerer = [
            {
              x: (quelle.x + ziel.x) / 2 - 40,
              y: (quelle.y + ziel.y) / 2 - 30,
              width: 80,
              height: 60,
            },
          ]
          const zwischen = computeObstacleAwareWaypoints(quelle, ziel, stoerer, new Set(), [
            'stoerer',
          ])
          if (zwischen.length === 0) continue
          const weg = legeAnfahrt({ quelle, quelleSeite, ziel, zielSeite, zwischen })
          const fall = `${quelleSeite}->${zielSeite} ${dx}/${dy}`
          if (!istRechtwinklig(weg)) gemeldet.push(`${fall} schief`)
          const rein = einheit(weg[weg.length - 2], weg[weg.length - 1])
          const raus = einheit(weg[0], weg[1])
          if (rein.x !== EINFAHRT[zielSeite].x || rein.y !== EINFAHRT[zielSeite].y) {
            gemeldet.push(`${fall} rein`)
          }
          if (raus.x !== AUSFAHRT[quelleSeite].x || raus.y !== AUSFAHRT[quelleSeite].y) {
            gemeldet.push(`${fall} raus`)
          }
        }
      }
    }
    expect(gemeldet).toEqual([])
  })

  it('schiebt keine Ecke ein, die den Strich zuruecklaufen laesst', () => {
    // Der Anschluss zeigt nach links, der erste Stuetzpunkt liegt rechts
    // oberhalb. Wer die Diagonale stur waagerecht zuerst aufloest, laesst den
    // Strich sofort wieder nach rechts laufen — das ist der Strich, der
    // „hin und wieder zurueck geht". Keiner der Punkte des Nutzers macht hier
    // kehrt; die Kehrtwende waere allein unsere eingefuegte Ecke.
    const weg = legeAnfahrt({
      quelle,
      quelleSeite: 'links',
      ziel: { x: 560, y: 200 },
      zielSeite: 'links',
      zwischen: [{ x: 500, y: 200 }],
    })
    expect(istRechtwinklig(weg)).toBe(true)
    expect(hatKehrtwende(weg)).toBe(false)
  })

  it('laesst eine von Hand gezogene Schleife stehen', () => {
    // Ein Stuetzpunkt HINTER der Quelle ist eine Kehrtwende — und die ist
    // gewollt. Der Waechter haelt fest, dass sie nicht wegoptimiert wird:
    // sonst spraenge ein von Hand gezogener Punkt beim naechsten Render weg.
    const weg = legeAnfahrt({
      quelle,
      quelleSeite: 'rechts',
      ziel: { x: 700, y: 300 },
      zielSeite: 'links',
      zwischen: [{ x: 500, y: 120 }, { x: 300, y: 120 }],
    })
    expect(weg).toContainEqual({ x: 500, y: 120 })
    expect(weg).toContainEqual({ x: 300, y: 120 })
    expect(istRechtwinklig(weg)).toBe(true)
  })
})
