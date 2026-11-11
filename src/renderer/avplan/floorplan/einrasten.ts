// @avplan/floorplan — KI-Ergebnisse auf die Zeichnung einrasten.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// WARUM. Ein Sprachmodell trifft eine Wand auf einem Planbild bestenfalls
// auf ein, zwei Prozent der Bildbreite — bei einem 60-m-Saal ein Meter.
// Die Linien selbst stehen aber im Plan. Also nimmt man die KI nur als
// Hinweis „hier ungefaehr ist eine Wand / eine Buehne" und legt das Ergebnis
// auf die naechste passende Linie: bei Vektorplaenen auf die erkannte
// Wandgeometrie, bei Scans auf die dunklen Pixel des Bildes.

import type { PlanPunkt } from './typen'

export interface Strecke {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface Einrastung<T> {
  ergebnis: T
  /** Hat eine Linie gepasst? Sonst ist `ergebnis` das KI-Original. */
  eingerastet: boolean
  /** Verschiebung in den Einheiten der Eingabe. */
  verschiebung: number
}

const laenge = (s: Strecke) => Math.hypot(s.x2 - s.x1, s.y2 - s.y1)

/**
 * KI-Wand auf eine Referenzwand (Mittellinie) legen: gleiche Richtung
 * (±12°), quer nicht weiter als `tol`, mindestens halb ueberlappend.
 * Liegen mehrere kollineare Stuecke darunter, gilt ihre Vereinigung.
 */
export function wandEinrasten<R extends Strecke>(ki: Strecke, ref: readonly R[], tol: number): Einrastung<Strecke> & { treffer: R[] } {
  const l = laenge(ki)
  if (l < 1e-9) return { ergebnis: ki, eingerastet: false, verschiebung: 0, treffer: [] }
  const dx = (ki.x2 - ki.x1) / l
  const dy = (ki.y2 - ki.y1) / l
  const mx = (ki.x1 + ki.x2) / 2
  const my = (ki.y1 + ki.y2) / 2
  type K = { r: R; quer: number; off: number; a: number; b: number }
  const kand: K[] = []
  for (const r of ref) {
    const rl = laenge(r)
    if (rl < 1e-9) continue
    const rx = (r.x2 - r.x1) / rl
    const ry = (r.y2 - r.y1) / rl
    if (Math.abs(rx * dx + ry * dy) < Math.cos((12 * Math.PI) / 180)) continue
    const quer = Math.abs((mx - r.x1) * ry - (my - r.y1) * rx)
    if (quer > tol) continue
    const a = (r.x1 - ki.x1) * dx + (r.y1 - ki.y1) * dy
    const b = (r.x2 - ki.x1) * dx + (r.y2 - ki.y1) * dy
    const ueber = Math.min(l, Math.max(a, b)) - Math.max(0, Math.min(a, b))
    if (ueber < Math.min(l, rl) * 0.5) continue
    kand.push({ r, quer, off: (r.x1 * ry - r.y1 * rx) * Math.sign(rx * dx + ry * dy), a: Math.min(a, b), b: Math.max(a, b) })
  }
  if (!kand.length) return { ergebnis: ki, eingerastet: false, verschiebung: 0, treffer: [] }
  kand.sort((p, q) => p.quer - q.quer)
  const best = kand[0]
  const gleich = kand.filter((k) => Math.abs(k.off - best.off) < Math.max(tol * 0.1, 0.02))
  // Enden: die KI-Enden gelten, ausser ein Referenzende liegt nah dabei —
  // eine lange Fassade soll nicht ueber den Teil hinauswachsen, den die KI meinte.
  const ua = Math.min(...gleich.map((k) => k.a))
  const ub = Math.max(...gleich.map((k) => k.b))
  let a = Math.abs(ua) <= tol ? ua : Math.max(ua, 0)
  let b = Math.abs(ub - l) <= tol ? ub : Math.min(ub, l)
  // Deckt das gefundene Wandstueck nur ein Stueckchen der KI-Wand, bleibt
  // deren Laenge stehen: sonst entstuende aus einer 5-m-Wand ein 8-cm-Rest,
  // weil zufaellig nur ihr Ende auf einem kurzen Wandstueck liegt.
  if (b - a < l * 0.5) {
    a = 0
    b = l
  }
  const r = best.r
  const rl = laenge(r)
  const rx = (r.x2 - r.x1) / rl
  const ry = (r.y2 - r.y1) / rl
  // Punkte auf der Referenzgeraden zu den Parametern a, b der KI-Richtung
  const proj = (t: number): PlanPunkt => {
    const px = ki.x1 + dx * t
    const py = ki.y1 + dy * t
    const s = (px - r.x1) * rx + (py - r.y1) * ry
    return { x: r.x1 + rx * s, y: r.y1 + ry * s }
  }
  const p = proj(a)
  const q = proj(b)
  return { ergebnis: { x1: p.x, y1: p.y, x2: q.x, y2: q.y }, eingerastet: true, verschiebung: best.quer, treffer: gleich.map((k) => k.r) }
}

export interface Rechteck {
  x: number
  y: number
  breite: number
  tiefe: number
}

/**
 * Achsparalleles Rechteck (Buehne) auf Kanten legen: jede Seite springt
 * auf die naechste parallele Kante innerhalb `tol`, die die Seite zu
 * mindestens 40 % begleitet.
 */
export function rechteckEinrasten(r: Rechteck, kanten: readonly Strecke[], tol: number): Einrastung<Rechteck> {
  let links = r.x
  let rechts = r.x + r.breite
  let oben = r.y
  let unten = r.y + r.tiefe
  let gerastet = 0
  let schub = 0
  const seite = (wert: number, senkrecht: boolean, von: number, bis: number): number => {
    let best = wert
    let bestD = tol
    for (const k of kanten) {
      const kx = Math.abs(k.x2 - k.x1)
      const ky = Math.abs(k.y2 - k.y1)
      const l = Math.hypot(kx, ky)
      if (l < 1e-9) continue
      if (senkrecht ? kx / l > 0.05 : ky / l > 0.05) continue
      const pos = senkrecht ? (k.x1 + k.x2) / 2 : (k.y1 + k.y2) / 2
      const d = Math.abs(pos - wert)
      if (d >= bestD) continue
      const a = senkrecht ? Math.min(k.y1, k.y2) : Math.min(k.x1, k.x2)
      const b = senkrecht ? Math.max(k.y1, k.y2) : Math.max(k.x1, k.x2)
      const ueber = Math.min(b, bis) - Math.max(a, von)
      if (ueber < (bis - von) * 0.4) continue
      best = pos
      bestD = d
    }
    if (best !== wert) {
      gerastet++
      schub = Math.max(schub, Math.abs(best - wert))
    }
    return best
  }
  links = seite(links, true, oben, unten)
  rechts = seite(rechts, true, oben, unten)
  oben = seite(oben, false, links, rechts)
  unten = seite(unten, false, links, rechts)
  if (rechts - links < r.breite * 0.5 || unten - oben < r.tiefe * 0.5) return { ergebnis: r, eingerastet: false, verschiebung: 0 }
  return { ergebnis: { x: links, y: oben, breite: rechts - links, tiefe: unten - oben }, eingerastet: gerastet >= 3, verschiebung: schub }
}

// ── Rasterbilder (Scans, Fotos) ─────────────────────────────────────────

/** Graustufenbild, 0 = schwarz. */
export interface GrauBild {
  breite: number
  hoehe: number
  grau: Uint8Array
}

/** RGBA (Canvas-ImageData) → Graustufen. */
export function grauAus(rgba: Uint8ClampedArray | Uint8Array, breite: number, hoehe: number): GrauBild {
  const grau = new Uint8Array(breite * hoehe)
  for (let i = 0; i < grau.length; i++) {
    const a = rgba[i * 4 + 3] / 255
    const v = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]
    grau[i] = Math.round(v * a + 255 * (1 - a))
  }
  return { breite, hoehe, grau }
}

const dunkel = (b: GrauBild, x: number, y: number) => {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= b.breite || yi >= b.hoehe) return 0
  return b.grau[yi * b.breite + xi] < 128 ? 1 : 0
}

/** Anteil dunkler Pixel entlang einer Strecke. */
function deckung(b: GrauBild, x1: number, y1: number, x2: number, y2: number): number {
  const l = Math.hypot(x2 - x1, y2 - y1)
  const n = Math.max(2, Math.ceil(l))
  let s = 0
  for (let i = 0; i <= n; i++) s += dunkel(b, x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n)
  return s / (n + 1)
}

/**
 * KI-Wand (Pixel) auf den dunklen Strich im Bild legen: quer verschieben
 * und leicht drehen, bis die Deckung am groessten ist; dann die Mitte des
 * dunklen Bands nehmen (Wandstaerke) und die Enden bis dahin ziehen, wo der
 * Strich aufhoert.
 */
export function wandAufRaster(ki: Strecke, b: GrauBild, tolPx: number): Einrastung<Strecke> & { dickePx: number } {
  const l = laenge(ki)
  if (l < 3) return { ergebnis: ki, eingerastet: false, verschiebung: 0, dickePx: 0 }
  const mx = (ki.x1 + ki.x2) / 2
  const my = (ki.y1 + ki.y2) / 2
  const w0 = Math.atan2(ki.y2 - ki.y1, ki.x2 - ki.x1)
  // 1) grob: Lage mit der hoechsten Deckung; bei Gleichstand die kleinste Drehung
  let best = { d: 0, off: 0, w: w0 }
  for (const dw of [0, -0.5, 0.5, -1, 1, -1.5, 1.5, -2, 2, -3, 3]) {
    const w = w0 + (dw * Math.PI) / 180
    const dx = Math.cos(w)
    const dy = Math.sin(w)
    for (let off = -tolPx; off <= tolPx; off += 0.5) {
      const cx = mx - dy * off
      const cy = my + dx * off
      const d = deckung(b, cx - (dx * l) / 2, cy - (dy * l) / 2, cx + (dx * l) / 2, cy + (dy * l) / 2)
      if (d > best.d + 1e-9) best = { d, off, w }
    }
  }
  if (best.d < 0.5) return { ergebnis: ki, eingerastet: false, verschiebung: 0, dickePx: 0 }
  let dx = Math.cos(best.w)
  let dy = Math.sin(best.w)
  const bx = mx - dy * best.off
  const by = my + dx * best.off
  // 2) fein: an drei Stellen quer messen, wo das dunkle Band liegt, und die
  //    Gerade durch die Bandmitten legen (Lage und Winkel exakt).
  const mitten: { u: number; v: number; breite: number }[] = []
  for (const u of [-0.35 * l, 0, 0.35 * l]) {
    const px = bx + dx * u
    const py = by + dy * u
    const hell = (v: number) => !dunkel(b, px - dy * v, py + dx * v)
    let start = 0
    if (hell(0)) {
      let gefunden = false
      for (let v = 0.5; v <= tolPx && !gefunden; v += 0.5) {
        if (!hell(v)) { start = v; gefunden = true }
        else if (!hell(-v)) { start = -v; gefunden = true }
      }
      if (!gefunden) continue
    }
    let lo = start
    let hi = start
    while (hi - lo < tolPx * 2 && !hell(lo - 0.5)) lo -= 0.5
    while (hi - lo < tolPx * 2 && !hell(hi + 0.5)) hi += 0.5
    mitten.push({ u, v: (lo + hi) / 2, breite: hi - lo + 1 })
  }
  let cx = bx
  let cy = by
  if (mitten.length >= 2) {
    const n = mitten.length
    const su = mitten.reduce((s, m) => s + m.u, 0) / n
    const sv = mitten.reduce((s, m) => s + m.v, 0) / n
    let num = 0
    let den = 0
    for (const m of mitten) {
      num += (m.u - su) * (m.v - sv)
      den += (m.u - su) ** 2
    }
    const steig = den ? num / den : 0
    // Punkt auf der neuen Geraden bei u = su, dann Richtung drehen
    cx = bx + dx * su - dy * sv
    cy = by + dy * su + dx * sv
    const w = best.w + Math.atan(steig)
    dx = Math.cos(w)
    dy = Math.sin(w)
  }
  const breiten = mitten.map((m) => m.breite).sort((p, q) => p - q)
  const dickePx = breiten.length ? breiten[Math.floor(breiten.length / 2)] : 0
  // 3) Enden: entlang der Achse laufen, bis 4 px am Stueck hell sind
  const ende = (richtung: 1 | -1) => {
    let t = (l / 2) * 0.5
    let hell = 0
    const grenze = l / 2 + tolPx * 2
    let letzt = t
    while (t < grenze) {
      if (dunkel(b, cx + dx * t * richtung, cy + dy * t * richtung)) {
        hell = 0
        letzt = t
      } else if (++hell > 4) break
      t += 1
    }
    return letzt
  }
  const t1 = ende(-1)
  const t2 = ende(1)
  return {
    ergebnis: { x1: cx - dx * t1, y1: cy - dy * t1, x2: cx + dx * t2, y2: cy + dy * t2 },
    eingerastet: true,
    verschiebung: Math.hypot(cx - mx, cy - my),
    dickePx,
  }
}

/** Kanten eines Rasterbilds nahe einem Rechteck: lange dunkle Laeufe in x und y. */
export function rasterKanten(b: GrauBild, bereich: Rechteck, minLaenge: number): Strecke[] {
  const out: Strecke[] = []
  const x0 = Math.max(0, Math.floor(bereich.x))
  const y0 = Math.max(0, Math.floor(bereich.y))
  const x1 = Math.min(b.breite - 1, Math.ceil(bereich.x + bereich.breite))
  const y1 = Math.min(b.hoehe - 1, Math.ceil(bereich.y + bereich.tiefe))
  for (let y = y0; y <= y1; y++) {
    let start = -1
    for (let x = x0; x <= x1 + 1; x++) {
      const d = x <= x1 && dunkel(b, x, y)
      if (d && start < 0) start = x
      if (!d && start >= 0) {
        if (x - start >= minLaenge) out.push({ x1: start, y1: y, x2: x - 1, y2: y })
        start = -1
      }
    }
  }
  for (let x = x0; x <= x1; x++) {
    let start = -1
    for (let y = y0; y <= y1 + 1; y++) {
      const d = y <= y1 && dunkel(b, x, y)
      if (d && start < 0) start = y
      if (!d && start >= 0) {
        if (y - start >= minLaenge) out.push({ x1: x, y1: start, x2: x, y2: y - 1 })
        start = -1
      }
    }
  }
  return out
}
