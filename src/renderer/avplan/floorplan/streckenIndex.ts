// @avplan/floorplan — Strecken einer Zeichnung mit Rasterindex.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// Ein Architektenplan im Format A0 traegt leicht eine Million Strecken. Die
// Suche „welche Strecken liegen in der Naehe dieses Masstexts" muss deshalb
// ueber ein Raster laufen, nicht ueber alle Strecken.

import type { VektorPfad } from './vektor'

export class StreckenIndex {
  /** x1, y1, x2, y2 je Strecke. */
  readonly k: Float64Array
  /** Index des Pfads, aus dem die Strecke stammt. */
  readonly pfad: Int32Array
  readonly n: number
  private readonly zelle: number
  private readonly raster = new Map<number, number[]>()
  private readonly spalten: number

  constructor(pfade: readonly VektorPfad[], filter: (p: VektorPfad) => boolean, zelle: number, breite: number) {
    let n = 0
    const nutzen: number[] = []
    pfade.forEach((p, i) => {
      if (!filter(p)) return
      nutzen.push(i)
      for (let t = 0; t < p.teile.length; t++) n += p.teile[t].length - 1 + (p.zu[t] && p.teile[t].length > 2 ? 1 : 0)
    })
    this.k = new Float64Array(n * 4)
    this.pfad = new Int32Array(n)
    this.zelle = zelle
    this.spalten = Math.max(1, Math.ceil(breite / zelle) + 2)
    let s = 0
    const add = (ax: number, ay: number, bx: number, by: number, pi: number) => {
      if (ax === bx && ay === by) return
      this.k[s * 4] = ax
      this.k[s * 4 + 1] = ay
      this.k[s * 4 + 2] = bx
      this.k[s * 4 + 3] = by
      this.pfad[s] = pi
      this.eintragen(s)
      s++
    }
    for (const pi of nutzen) {
      const p = pfade[pi]
      p.teile.forEach((r, t) => {
        for (let q = 1; q < r.length; q++) add(r[q - 1].x, r[q - 1].y, r[q].x, r[q].y, pi)
        if (p.zu[t] && r.length > 2) add(r[r.length - 1].x, r[r.length - 1].y, r[0].x, r[0].y, pi)
      })
    }
    this.n = s
  }

  private schluessel(cx: number, cy: number) {
    return (cy + 1) * this.spalten + (cx + 1)
  }

  private eintragen(s: number) {
    const z = this.zelle
    const x1 = this.k[s * 4]
    const y1 = this.k[s * 4 + 1]
    const x2 = this.k[s * 4 + 2]
    const y2 = this.k[s * 4 + 3]
    const len = Math.hypot(x2 - x1, y2 - y1)
    const schritte = Math.max(1, Math.ceil(len / (z * 0.5)))
    let letzte = -1
    for (let i = 0; i <= schritte; i++) {
      const u = i / schritte
      const key = this.schluessel(Math.floor((x1 + (x2 - x1) * u) / z), Math.floor((y1 + (y2 - y1) * u) / z))
      if (key === letzte) continue
      letzte = key
      let l = this.raster.get(key)
      if (!l) this.raster.set(key, (l = []))
      if (l[l.length - 1] !== s) l.push(s)
    }
  }

  /** Strecken, deren Rasterzellen den Rahmen beruehren (ohne Dubletten). */
  imRahmen(minX: number, minY: number, maxX: number, maxY: number): number[] {
    const z = this.zelle
    const out: number[] = []
    const gesehen = new Set<number>()
    for (let cy = Math.floor(minY / z); cy <= Math.floor(maxY / z); cy++) {
      for (let cx = Math.floor(minX / z); cx <= Math.floor(maxX / z); cx++) {
        const l = this.raster.get(this.schluessel(cx, cy))
        if (!l) continue
        for (const s of l) {
          if (gesehen.has(s)) continue
          gesehen.add(s)
          out.push(s)
        }
      }
    }
    return out
  }
}

/** Abstand Punkt–Strecke und Parameter des Lotfusspunkts (0..1). */
export function lot(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy || 1e-12
  const t = ((px - ax) * dx + (py - ay) * dy) / l2
  const tc = Math.max(0, Math.min(1, t))
  return { d: Math.hypot(px - (ax + dx * tc), py - (ay + dy * tc)), t }
}
