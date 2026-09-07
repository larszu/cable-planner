import { describe, expect, it } from 'vitest'
import {
  computeObstacleAwareWaypoints,
  routeAround,
  type Rect,
} from '../src/renderer/lib/cableRouting'

// ───────────────────────────────────────────────────────────────────────────
// Nutzer-Meldung 2026-09-07: „manche Basisfunktionen wie das Kabel
// automatisch Routen funktionieren nicht sauber."
//
// Diese Tests halten fest, was ein automatisch gelegtes Kabel niemals tun
// darf: durch ein Geraet laufen, ohne dass es jemand erfaehrt. Der alte Code
// hatte dafuer keine Sprache — er gab am Ende „den kuerzesten Umweg zurueck,
// auch wenn er noch etwas streift", und das Ergebnis sah aus wie eine
// gelungene Fuehrung.
// ───────────────────────────────────────────────────────────────────────────

const rect = (x: number, y: number, width = 100, height = 60): Rect => ({ x, y, width, height })

/** Laeuft der ganze Weg an allen Hindernissen vorbei? */
const frei = (punkte: { x: number; y: number }[], hindernisse: Rect[]): boolean => {
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const a = punkte[i]
    const b = punkte[i + 1]
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    for (const r of hindernisse) {
      const trifft =
        maxX > r.x && minX < r.x + r.width && maxY > r.y && minY < r.y + r.height
      if (trifft) return false
    }
  }
  return true
}

/** Ist jeder Abschnitt waagerecht oder senkrecht? */
const orthogonal = (punkte: { x: number; y: number }[]): boolean => {
  for (let i = 0; i < punkte.length - 1; i += 1) {
    const a = punkte[i]
    const b = punkte[i + 1]
    if (a.x !== b.x && a.y !== b.y) return false
  }
  return true
}

describe('ohne Hindernis bleibt der Weg gerade', () => {
  it('gibt keine Zwischenpunkte zurück', () => {
    const r = routeAround({ x: 0, y: 0 }, { x: 300, y: 0 }, [])
    expect(r.waypoints).toEqual([])
    expect(r.clear).toBe(true)
  })

  it('sagt auch dann, dass der Weg frei ist', () => {
    const r = routeAround({ x: 0, y: 0 }, { x: 300, y: 200 }, [rect(600, 600)])
    expect(r.clear).toBe(true)
  })
})

describe('ein Hindernis wird umfahren', () => {
  const hindernis = [rect(120, -30)]
  const r = routeAround({ x: 0, y: 0 }, { x: 320, y: 0 }, hindernis)

  it('meldet den Weg als frei', () => {
    expect(r.clear).toBe(true)
  })

  it('läuft tatsächlich an ihm vorbei', () => {
    expect(frei([{ x: 0, y: 0 }, ...r.waypoints, { x: 320, y: 0 }], hindernis)).toBe(true)
  })

  it('bleibt orthogonal', () => {
    expect(orthogonal([{ x: 0, y: 0 }, ...r.waypoints, { x: 320, y: 0 }])).toBe(true)
  })
})

describe('zwei Hindernisse — der Fall, an dem die alte Fassung scheiterte', () => {
  // Zwei Geräte hintereinander auf der Sichtlinie. Ein Umweg um das erste
  // führte geradewegs ins zweite, und zurück kam trotzdem ein Weg.
  const hindernisse = [rect(120, -30), rect(120, 40)]
  const von = { x: 0, y: 0 }
  const nach = { x: 320, y: 0 }
  const r = routeAround(von, nach, hindernisse)

  it('läuft an BEIDEN vorbei, wenn es einen Weg gibt', () => {
    expect(r.clear).toBe(true)
    expect(frei([von, ...r.waypoints, nach], hindernisse)).toBe(true)
  })

  it('bleibt orthogonal', () => {
    expect(orthogonal([von, ...r.waypoints, nach])).toBe(true)
  })
})

describe('wenn kein Weg frei ist, wird das GESAGT', () => {
  // Das Ziel steht eingemauert — vier Geräte rundherum, wie in einem dicht
  // gepackten Rack-Bereich. Jeder Weg dorthin muss durch eine der Wände. Der
  // alte Code gab trotzdem wortlos einen Weg zurück.
  const eingemauert = [
    rect(440, -200, 20, 400),
    rect(540, -200, 20, 400),
    rect(440, -220, 120, 20),
    rect(440, 200, 120, 20),
  ]
  const von = { x: 0, y: 0 }
  const nach = { x: 500, y: 0 }
  const r = routeAround(von, nach, eingemauert)

  it('meldet `clear: false`, statt einen Weg durch das Gerät zu behaupten', () => {
    expect(r.clear).toBe(false)
  })

  it('gibt trotzdem einen benutzbaren Weg zurück — die Kante muss gezeichnet werden', () => {
    // Ein Kabel ohne Weg wäre unsichtbar. Der kürzeste Weg wird geliefert und
    // ist als nicht frei GEKENNZEICHNET; die Oberfläche entscheidet, wie sie
    // das zeigt.
    expect(orthogonal([von, ...r.waypoints, nach])).toBe(true)
  })
})

describe('die alte Schnittstelle bleibt', () => {
  it('liefert weiter nur die Zwischenpunkte', () => {
    const hindernis = [rect(120, -30)]
    expect(computeObstacleAwareWaypoints({ x: 0, y: 0 }, { x: 320, y: 0 }, hindernis)).toEqual(
      routeAround({ x: 0, y: 0 }, { x: 320, y: 0 }, hindernis).waypoints,
    )
  })

  it('lässt eigene Geräte über ihre Id aus der Prüfung heraus', () => {
    // Quelle und Ziel liegen auf ihrem eigenen Rechteck — ohne diese Ausnahme
    // wäre jedes Kabel von Anfang an blockiert.
    const eigen = [rect(-10, -10, 40, 40)]
    const r = computeObstacleAwareWaypoints(
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      eigen,
      new Set(['a']),
      ['a'],
    )
    expect(r).toEqual([])
  })
})
