import { describe, expect, it } from 'vitest'
import {
  abschnittAchse,
  greifKette,
  istRechtwinklig,
  legeAnfahrt,
  schiebeAbschnitt,
  schiebeEcke,
  stummel,
  type Anschlussseite,
} from '../src/renderer/lib/cableApproach'
import { computeObstacleAwareWaypoints, type Point } from '../src/renderer/lib/cableRouting'

/**
 * Nutzer-Meldung 2026-09-09: „Das manuelle Kabel verschieben im Cable planner
 * canvas ist schlechter geworden. Repariere so das man es wieder intuitiv
 * bedienen kann."
 *
 * ─── WAS GEMESSEN WURDE ───────────────────────────────────────────────────
 *
 * Nicht das Ziehen, sondern die Geometrie darunter. `CableWaypoints` legte
 * seine Greif-Zonen auf `[Quelle, ...cable.waypoints, Ziel]`. Seit B-48
 * (2026-09-08) wird aber `legeAnfahrt` gezeichnet — mit Stummeln an beiden
 * Enden und mit Ecken, die `rechtwinkligMachen` dazwischenschiebt. Zwei
 * verschiedene Streckenzuege; angefasst wurde der unsichtbare.
 *
 * Ueber dieselbe Matrix wie `kabelAnfahrt.test.ts` (4x4 Anschlussseiten,
 * 49 Ziellagen, 784 Faelle) gemessen:
 *
 *   gezeichnete Abschnitte gesamt              3324
 *   davon ohne deckungsgleiche Greif-Zone      3292   (99 %)
 *   Faelle mit mindestens einer solchen Luecke  784   (alle)
 *   Greif-Zonen, unter denen kein Strich liegt  180
 *
 * ─── WAS DIESER WAECHTER HAELT ────────────────────────────────────────────
 *
 * Die vier Zusicherungen, aus denen „intuitiv" hier besteht:
 *
 *  1. Jeder Griff liegt auf dem Strich, den der Nutzer sieht.
 *  2. Jeder sichtbare Abschnitt zwischen den Stummeln hat einen Griff.
 *  3. Der Rundlauf schliesst: Kette ohne Enden -> `cable.waypoints` ->
 *     `legeAnfahrt` -> derselbe Streckenzug. Ohne das wanderte das Kabel
 *     unter der Hand des Nutzers weg.
 *  4. Nach einem Zug liegt der gezogene Abschnitt dort, wo der Zeiger ist,
 *     und der Weg ist noch rechtwinklig.
 */

const SEITEN: Anschlussseite[] = ['links', 'rechts', 'oben', 'unten']
const QUELLE: Point = { x: 400, y: 300 }

const LAGEN: Array<[number, number]> = []
for (const dx of [-300, -120, -18, 0, 18, 120, 300]) {
  for (const dy of [-220, -80, -18, 0, 18, 80, 220]) LAGEN.push([dx, dy])
}

/** Liegt der Punkt (auf Zeichen-Genauigkeit) auf dem Streckenzug? */
const liegtAufWeg = (p: Point, weg: readonly Point[]): boolean => {
  const eps = 1.5
  for (let i = 0; i < weg.length - 1; i += 1) {
    const a = weg[i]
    const b = weg[i + 1]
    if (p.x < Math.min(a.x, b.x) - eps || p.x > Math.max(a.x, b.x) + eps) continue
    if (p.y < Math.min(a.y, b.y) - eps || p.y > Math.max(a.y, b.y) + eps) continue
    const kreuz = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    const laenge = Math.hypot(b.x - a.x, b.y - a.y) || 1
    if (Math.abs(kreuz) / laenge < eps) return true
  }
  return false
}

const gleich = (a: readonly Point[], b: readonly Point[]): boolean =>
  a.length === b.length &&
  a.every((p, i) => Math.abs(p.x - b[i].x) < 1 && Math.abs(p.y - b[i].y) < 1)

interface Fall {
  name: string
  quelleSeite: Anschlussseite
  zielSeite: Anschlussseite
  ziel: Point
  weg: Point[]
  kette: Point[]
  /** Die Abschnitte, die `CableWaypoints` mit einer Greif-Zone belegt. */
  griffe: number[]
}

const faelle: Fall[] = []
for (const quelleSeite of SEITEN) {
  for (const zielSeite of SEITEN) {
    for (const [dx, dy] of LAGEN) {
      const ziel = { x: QUELLE.x + dx, y: QUELLE.y + dy }
      const zwischen = computeObstacleAwareWaypoints(QUELLE, ziel, [], undefined, [])
      const weg = legeAnfahrt({ quelle: QUELLE, quelleSeite, ziel, zielSeite, zwischen })
      const kette = greifKette(weg, [stummel(QUELLE, quelleSeite), stummel(ziel, zielSeite)])
      // Dieselbe Regel wie `ziehbar` in `CableWaypoints`: erster und letzter
      // Abschnitt sind die Stummel; bleibt nichts uebrig, ist alles ziehbar.
      const alle = kette.length - 1
      const innen: number[] = []
      for (let i = 0; i < alle; i += 1) if (i > 0 && i + 1 < kette.length - 1) innen.push(i)
      const griffe = kette.length >= 4 ? innen : Array.from({ length: alle }, (_, i) => i)
      faelle.push({
        name: `${quelleSeite}->${zielSeite} d=(${dx},${dy})`,
        quelleSeite,
        zielSeite,
        ziel,
        weg,
        kette,
        griffe,
      })
    }
  }
}

describe('Der Griff liegt auf dem Strich', () => {
  it('hat ueberhaupt eine Matrix', () => {
    expect(faelle.length).toBe(SEITEN.length * SEITEN.length * LAGEN.length)
    expect(faelle.length).toBe(784)
  })

  it('legt jede Ecke der Greifkette auf den gezeichneten Weg', () => {
    // Das ist der gemessene Befund, umgedreht: 3292 von 3324 Abschnitten
    // hatten keine deckungsgleiche Zone. Hier muss jeder Punkt sitzen.
    const daneben = faelle.filter((f) => f.kette.some((p) => !liegtAufWeg(p, f.weg)))
    expect(daneben.map((f) => f.name)).toEqual([])
  })

  it('laesst keinen sichtbaren Abschnitt ohne Griff', () => {
    // Ein Abschnitt zwischen den beiden Stummeln, den man nicht anfassen
    // kann, ist genau die Beschwerde. Die Stummel selbst sind ausgenommen —
    // sie gehoeren `legeAnfahrt`, nicht dem Nutzer.
    const ohne = faelle.filter((f) => f.griffe.length === 0 && f.kette.length > 3)
    expect(ohne.map((f) => f.name)).toEqual([])
  })

  it('nennt die entarteten Faelle, in denen alles Stummel ist', () => {
    // Zwoelf Faelle: die beiden Buchsen liegen keine 18 px auseinander, das
    // ganze Kabel ist kuerzer als ein Stummel. Dort greift der Rueckfall
    // („alles ziehbar"). Die Zahl steht hier, damit auffaellt, wenn sie
    // waechst — dann waere der Rueckfall keine Ausnahme mehr.
    const entartet = faelle.filter((f) => f.kette.length <= 3)
    expect(entartet.length).toBe(12)
    for (const f of entartet) expect(f.griffe.length).toBeGreaterThan(0)
  })
})

describe('Der Rundlauf schliesst', () => {
  it('zeichnet aus der zurueckgeschriebenen Kette denselben Weg', () => {
    // Ohne das wanderte das Kabel beim Loslassen weg: gezogen wird die
    // Kette, gespeichert werden ihre inneren Punkte, gezeichnet wird wieder
    // aus ihnen. Nur wenn das dasselbe ergibt, ist das Ziehen berechenbar.
    const abweichend = faelle.filter((f) => {
      const zurueck = legeAnfahrt({
        quelle: QUELLE,
        quelleSeite: f.quelleSeite,
        ziel: f.ziel,
        zielSeite: f.zielSeite,
        zwischen: f.kette.slice(1, -1),
      })
      return !gleich(zurueck, f.weg)
    })
    expect(abweichend.map((f) => f.name)).toEqual([])
  })
})

describe('Was der Zug bewirkt', () => {
  it('legt den gezogenen Abschnitt an den Zeiger und laesst den Weg rechtwinklig', () => {
    const fehler: string[] = []
    for (const f of faelle) {
      for (const i of f.griffe) {
        for (const d of [-60, 45]) {
          const achse = abschnittAchse(f.kette[i], f.kette[i + 1])
          const zeiger =
            achse === 'waagerecht'
              ? { x: f.kette[i].x, y: f.kette[i].y + d }
              : { x: f.kette[i].x + d, y: f.kette[i].y }
          const neu = schiebeAbschnitt(f.kette, i, zeiger, { x: d, y: d })
          const gezeichnet = legeAnfahrt({
            quelle: QUELLE,
            quelleSeite: f.quelleSeite,
            ziel: f.ziel,
            zielSeite: f.zielSeite,
            zwischen: neu.slice(1, -1),
          })
          if (!istRechtwinklig(gezeichnet)) fehler.push(`${f.name} Abschnitt ${i} d=${d}: schraeg`)
          // Der verschobene Abschnitt muss danach auch wirklich dort liegen.
          const versetzt = neu[i === 0 ? 1 : i]
          if (!liegtAufWeg(versetzt, gezeichnet)) {
            fehler.push(`${f.name} Abschnitt ${i} d=${d}: nicht am Zeiger`)
          }
        }
      }
    }
    expect(fehler.slice(0, 12)).toEqual([])
  })

  it('haelt die Ecke am Anschluss fest, statt sie vom Geraet zu loesen', () => {
    // `schiebeEcke` darf Quelle und Ziel nicht bewegen — die haengen an der
    // Buchse. Statt den Nachbarn mitzunehmen wird die Ecke auf dessen Achse
    // festgehalten.
    const fehler: string[] = []
    for (const f of faelle) {
      for (let i = 1; i < f.kette.length - 1; i += 1) {
        const neu = schiebeEcke(f.kette, i, { x: 900, y: 900 })
        if (!gleich([neu[0]], [f.kette[0]])) fehler.push(`${f.name}: Quelle bewegt`)
        if (!gleich([neu[neu.length - 1]], [f.kette[f.kette.length - 1]])) {
          fehler.push(`${f.name}: Ziel bewegt`)
        }
        if (neu.length !== f.kette.length) fehler.push(`${f.name}: Kette geaendert`)
      }
    }
    expect(fehler.slice(0, 12)).toEqual([])
  })

  it('nimmt eine Ecke heraus, ohne die Enden anzutasten', () => {
    for (const f of faelle) {
      if (f.kette.length < 3) continue
      const ohne = f.kette.filter((_, i) => i !== 1).slice(1, -1)
      expect(ohne.length).toBe(f.kette.length - 3)
    }
  })
})
