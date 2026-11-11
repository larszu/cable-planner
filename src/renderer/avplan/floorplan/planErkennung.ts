// @avplan/floorplan — Waende, Oeffnungen, Stuetzen, Treppen, Raeume und
// Buehnen aus einer Vektorzeichnung, ohne KI.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// WARUM GEOMETRIE ZUERST. Im CAD-Plan steht alles schon exakt: eine Wand
// ist ein schwarz gefuelltes Polygon (Poché), ihre Staerke der Abstand der
// beiden Laengskanten, eine Tuer die Luecke zwischen zwei Wandstuecken mit
// einem Schwenkbogen daneben, ein Raum der Stempel „Gruppenraum 9 /
// F: 32,55 m²". Eine KI, die das aus einem Bild schaetzt, liegt Zentimeter
// bis Meter daneben (so geschehen: Waende im Zwischenraum, Buehne verrutscht).
// Die KI bleibt fuer Scans und fuer die Frage, was etwas ist.
//
// Ergebnis in Metern, Ursprung = linke obere Ecke der Zeichnung, y nach
// unten — dieselbe Lage wie das gerenderte Planbild.

import { massstabErkennen, type PlanMassstab } from './bemassung'
import { StreckenIndex, lot } from './streckenIndex'
import type { PlanPunkt } from './typen'
import { imRing, rahmenVon, ringFlaeche, type Rahmen, type VektorPfad, type VektorText, type VektorZeichnung } from './vektor'

export interface ErkannteWand {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
  dickeM: number
  /**
   * Lichte Hoehe aus dem Raumstempel (RH/LH), wenn der Plan sie nennt.
   * Ohne Angabe gilt die Standard-Wandhoehe des Projekts — eine erfundene
   * Hoehe hier wuerde sie stumm ueberstimmen.
   */
  hoeheM?: number
  /** `flaeche`: aus gefuelltem Wandpolygon; `linien`: aus Linienpaar. */
  quelle: 'fill' | 'lines'
  ebene?: string
}

export type OeffnungsArt = 'door' | 'window' | 'opening'

export interface ErkannteOeffnung {
  id: string
  art: OeffnungsArt
  /** Mitte der Oeffnung. */
  x: number
  y: number
  breiteM: number
  /** Richtung der Wand (Grad, Uhrzeigersinn). */
  winkel: number
  /** Wandstaerke an der Oeffnung. */
  dickeM: number
  /** Die beiden Wandstuecke (oder Stuetzen `s…`) links und rechts. */
  zwischen: [string, string]
  /** Fuellstueck ueber der Luecke, das die Oeffnung traegt (Tuer, Fenster). */
  wandId?: string
  /** Unterkante (Bruestung) und Oberkante (Sturz) ueber dem Boden. */
  unterkanteM?: number
  oberkanteM?: number
}

export interface ErkannteStuetze {
  x: number
  y: number
  breiteM: number
  tiefeM: number
  winkel: number
  rund: boolean
}

export interface ErkannteTreppe {
  ecken: PlanPunkt[]
  stufen: number
  auftrittM: number
}

export interface ErkannterRaum {
  nummer?: string
  name?: string
  /** Flaeche laut Stempel. */
  flaecheM2?: number
  /** Lichte Raumhoehe laut Stempel (RH/LH). */
  hoeheM?: number
  /** Lage des Stempels. */
  x: number
  y: number
  /** Umriss, wenn er sich schliessen liess. */
  umriss?: PlanPunkt[]
  umrissFlaecheM2?: number
  /** Woher der Umriss kommt. */
  umrissQuelle?: 'fill' | 'walls'
}

export interface ErkannteBuehne {
  label: string
  /** Achsparalleler Rahmen (fuer Planer ohne Drehung). */
  x: number
  y: number
  breiteM: number
  tiefeM: number
  umriss: PlanPunkt[]
  /** Masse aus dem Text („2,30x8,60m"), falls genannt. */
  textMasse?: [number, number]
  sicher: boolean
}

export interface ErkannterPlan {
  massstab: PlanMassstab
  /** Groesse der Zeichnung in Metern. */
  breiteM: number
  tiefeM: number
  waende: ErkannteWand[]
  oeffnungen: ErkannteOeffnung[]
  stuetzen: ErkannteStuetze[]
  treppen: ErkannteTreppe[]
  raeume: ErkannterRaum[]
  buehnen: ErkannteBuehne[]
  /**
   * Gegenprobe zum Massstab: erkannte Raumflaeche gegen die Flaeche im
   * Raumstempel. Ein Median nahe 1 heisst, dass der Massstab stimmt — und
   * zwar unabhaengig von den Bemassungsketten, aus denen er kam. Liegt er
   * bei 4 oder 0,25, ist der Massstab um den Faktor 2 daneben.
   */
  raumProbe?: { anzahl: number; verhaeltnisMedian: number }
  /** Rahmen um alle Waende. */
  gebaeude?: Rahmen
  /** Wie die Waende gefunden wurden. */
  hinweise: string[]
}

export interface PlanErkennungOptionen {
  /** Wandhoehe, wo kein Stempel eine Raumhoehe nennt — nur fuer Sturz und
   *  Bruestung der Oeffnungen; an die Waende selbst kommt sie nicht. */
  wandHoeheM?: number
  /** Massstab vorgeben statt erkennen (Meter je Zeichnungseinheit). */
  meterJeEinheit?: number
  /** Nur Ergebnisse in diesem Rahmen (Meter). */
  bereich?: Rahmen
  /** Bruestungshoehe, wenn der Plan keine nennt (BRH). */
  bruestungM?: number
}

/** Ebenen, auf denen keine Wand liegt (DE/EN, ArchiCAD/Revit/AutoCAD). */
/**
 * Ebenen, auf denen sicher keine Wand liegt und deren Pfade deshalb gar
 * nicht erst gelesen werden muessen. Enger gefasst als `KEINE_WAND_EBENE`:
 * was hier steht, faellt vor dem Lesen weg, also nur das Unstrittige.
 */
export const EBENE_OHNE_BAUTEIL = /einricht|möb|mob|kueche|küche|sanit|import|bestuhlung|außenanl|aussenanl/i

const KEINE_WAND_EBENE = /einricht|möb|mob|sanit|bema|dimen|text|beschrift|achs|axis|grid|außenanl|aussenanl|^dach|vordach|import|furn|anno|räume|raeume|room|area|treppe|stair|höhenkot|hoehenkot|schnitt|section|symbol|rahmen|frame|plankopf|title|logo|kueche|küche|lighting|elektr/i
const WAND_EBENE = /wand|wände|waende|wall|mauer|fassade|fassad|stütz|stuetz|column|tragwerk|struct|beton|mauerwerk|a-wall|s-col/i

const luminanz = (hex?: string) => {
  if (!hex) return undefined
  const n = parseInt(hex.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}

const deg = (r: number) => (r * 180) / Math.PI

export function planErkennen(z: VektorZeichnung, o: PlanErkennungOptionen = {}): ErkannterPlan {
  const hinweise: string[] = []
  const zelle = Math.max(z.breite, z.hoehe) / 1500
  const idx = new StreckenIndex(z.pfade, (p) => p.gezogen, zelle, z.breite)
  const massstab = o.meterJeEinheit
    ? { ...massstabErkennen(z, idx), meterJeEinheit: o.meterJeEinheit, quelle: 'assumed' as const }
    : massstabErkennen(z, idx)
  const m = massstab.meterJeEinheit
  const ox = z.minX ?? 0
  const oy = z.minY ?? 0
  const inM = (p: PlanPunkt): PlanPunkt => ({ x: (p.x - ox) * m, y: (p.y - oy) * m })
  const hoehe = o.wandHoeheM ?? 3

  // ── Wandpolygone waehlen ─────────────────────────────────────────────
  const ebenenMitWand = new Set(z.pfade.filter((p) => p.ebene && WAND_EBENE.test(p.ebene)).map((p) => p.ebene))
  const istWandFlaeche = (p: VektorPfad) => {
    if (!p.gefuellt) return false
    if (p.ebene && KEINE_WAND_EBENE.test(p.ebene) && !WAND_EBENE.test(p.ebene)) return false
    const l = luminanz(p.fuellfarbe)
    if (l === undefined) return !!p.ebene && WAND_EBENE.test(p.ebene)
    return l < 0.45
  }
  const polygone: { ringe: PlanPunkt[][]; ebene?: string; kurve: boolean }[] = []
  for (const p of z.pfade) {
    if (!istWandFlaeche(p)) continue
    const ringe = p.teile.filter((r) => r.length >= 3).map((r) => r.map(inM))
    if (ringe.length) polygone.push({ ringe, ebene: p.ebene, kurve: p.kurve })
  }

  const roh: (Omit<ErkannteWand, 'id' | 'hoeheM'>)[] = []
  const stuetzen: ErkannteStuetze[] = []
  for (const poly of polygone) {
    const st = alsStuetze(poly.ringe, poly.kurve)
    if (st) {
      stuetzen.push(st)
      continue
    }
    for (const w of kantenPaare(poly.ringe)) roh.push({ ...w, quelle: 'fill', ebene: poly.ebene })
  }
  const flaechenWaende = zusammenfassen(roh)
  hinweise.push(`walls-from-fills:${flaechenWaende.length}`)
  // Linienpaare: Leichtbau- und Glaswaende ohne Poché. Nur auf Wand-Ebenen,
  // oder wenn die Zeichnung gar keine gefuellten Waende hat (DXF).
  let linienWaende: RohWand[] = []
  if (ebenenMitWand.size || !flaechenWaende.length) {
    linienWaende = zusammenfassen(linienPaare(z, inM, ebenenMitWand)).filter((w) => !abgedeckt(w, flaechenWaende))
    hinweise.push(`walls-from-lines:${linienWaende.length}`)
  }
  let waende: ErkannteWand[] = [...flaechenWaende, ...linienWaende].map((w, i) => ({ ...w, id: `w${i + 1}` }))
  const brh = bruestungAusText(z.texte)
  const vorgaben: OeffnungsVorgaben = {
    bruestungM: brh ?? o.bruestungM ?? 0.9,
    fensterOberkanteM: 2.3,
    tuerHoeheM: 2.1,
    wandHoeheM: hoehe,
  }
  const { oeffnungen, fuell, entfernt } = oeffnungenFinden(waende, stuetzen, z, inM, vorgaben)
  waende = waende.filter((w) => !entfernt.has(w.id))
  verbinden(waende)
  waende = waende.filter((w) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) >= 0.05).concat(fuell)

  const treppen = treppenFinden(z, inM)
  const raeume = raeumeFinden(z, inM, m, waende, oeffnungen, stuetzen)
  wandHoehenAusRaeumen(waende, raeume)
  const buehnen = buehnenFinden(z, inM, m, raeume)

  const imBereich = (x: number, y: number) =>
    !o.bereich || (x >= o.bereich.minX && x <= o.bereich.maxX && y >= o.bereich.minY && y <= o.bereich.maxY)
  const wandIn = waende.filter((w) => imBereich((w.x1 + w.x2) / 2, (w.y1 + w.y2) / 2))
  const ids = new Set(wandIn.map((w) => w.id))
  const pkte = wandIn.flatMap((w) => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }])
  return {
    massstab,
    breiteM: z.breite * m,
    tiefeM: z.hoehe * m,
    waende: wandIn,
    oeffnungen: oeffnungen.filter((q) => (q.wandId ? ids.has(q.wandId) : imBereich(q.x, q.y))),
    stuetzen: stuetzen.filter((s) => imBereich(s.x, s.y)),
    treppen: treppen.filter((t) => imBereich(t.ecken[0].x, t.ecken[0].y)),
    raeume: raeume.filter((r) => imBereich(r.x, r.y)),
    buehnen: buehnen.filter((b) => imBereich(b.x + b.breiteM / 2, b.y + b.tiefeM / 2)),
    raumProbe: raumProbe(raeume),
    gebaeude: pkte.length ? rahmenVon(pkte) : undefined,
    hinweise,
  }
}

/** Median von erkannter zu gestempelter Raumflaeche. */
function raumProbe(raeume: readonly ErkannterRaum[]): ErkannterPlan['raumProbe'] {
  const v = raeume
    .filter((r) => r.flaecheM2 && r.umrissFlaecheM2)
    .map((r) => r.umrissFlaecheM2! / r.flaecheM2!)
    .sort((a, b) => a - b)
  if (v.length < 3) return undefined
  return { anzahl: v.length, verhaeltnisMedian: v[Math.floor(v.length / 2)] }
}

// ── Stuetzen ────────────────────────────────────────────────────────────

/** Kleines, gedrungenes Vollpolygon = Stuetze. */
function alsStuetze(ringe: PlanPunkt[][], kurve: boolean): ErkannteStuetze | null {
  if (ringe.length !== 1) return null
  const r = ringe[0]
  const a = Math.abs(ringFlaeche(r))
  // Hauptachse aus der laengsten Kante
  let best = 0
  let w = 0
  for (let i = 0; i < r.length; i++) {
    const p = r[i]
    const q = r[(i + 1) % r.length]
    const l = Math.hypot(q.x - p.x, q.y - p.y)
    if (l > best) {
      best = l
      w = Math.atan2(q.y - p.y, q.x - p.x)
    }
  }
  const c = Math.cos(w)
  const s = Math.sin(w)
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
  for (const p of r) {
    const u = p.x * c + p.y * s
    const v = -p.x * s + p.y * c
    u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v)
  }
  const bu = u1 - u0
  const bv = v1 - v0
  const gross = Math.max(bu, bv)
  const klein = Math.min(bu, bv)
  if (gross > 0.9 || klein < 0.12 || gross / klein > 1.8) return null
  if (a < 0.6 * bu * bv) return null
  const um = (u0 + u1) / 2
  const vm = (v0 + v1) / 2
  return { x: um * c - vm * s, y: um * s + vm * c, breiteM: bu, tiefeM: bv, winkel: deg(w), rund: kurve }
}

// ── Kantenpaare eines Wandpolygons ──────────────────────────────────────

const MIN_DICKE = 0.04
const MAX_DICKE = 1.0

function kantenPaare(ringe: PlanPunkt[][]): Omit<ErkannteWand, 'id' | 'hoeheM' | 'quelle'>[] {
  type Kante = { ax: number; ay: number; dx: number; dy: number; len: number; belegt: [number, number][] }
  const kanten: Kante[] = []
  for (const r of ringe) {
    for (let i = 0; i < r.length; i++) {
      const p = r[i]
      const q = r[(i + 1) % r.length]
      const len = Math.hypot(q.x - p.x, q.y - p.y)
      if (len < 0.03) continue
      kanten.push({ ax: p.x, ay: p.y, dx: (q.x - p.x) / len, dy: (q.y - p.y) / len, len, belegt: [] })
    }
  }
  type Paar = { i: number; j: number; d: number; s0: number; s1: number }
  const paare: Paar[] = []
  for (let i = 0; i < kanten.length; i++) {
    const a = kanten[i]
    for (let j = i + 1; j < kanten.length; j++) {
      const b = kanten[j]
      const dot = a.dx * b.dx + a.dy * b.dy
      if (dot > -0.9995 && dot < 0.9995) continue
      // Lotabstand der Mitte von b zur Geraden a
      const mx = b.ax + (b.dx * b.len) / 2
      const my = b.ay + (b.dy * b.len) / 2
      const d = Math.abs((mx - a.ax) * a.dy - (my - a.ay) * a.dx)
      if (d < MIN_DICKE || d > MAX_DICKE) continue
      // Projektion von b auf a
      const t1 = (b.ax - a.ax) * a.dx + (b.ay - a.ay) * a.dy
      const t2 = t1 + (b.dx * a.dx + b.dy * a.dy) * b.len
      const s0 = Math.max(0, Math.min(t1, t2))
      const s1 = Math.min(a.len, Math.max(t1, t2))
      if (s1 - s0 < Math.min(0.05, d * 0.5)) continue
      // Zwischen den Kanten muss Wand sein (Mitte im Polygon).
      const sm = (s0 + s1) / 2
      const px = a.ax + a.dx * sm
      const py = a.ay + a.dy * sm
      const seite = (mx - a.ax) * a.dy - (my - a.ay) * a.dx > 0 ? 1 : -1
      const qx = px + a.dy * seite * (d / 2)
      const qy = py - a.dx * seite * (d / 2)
      if (!imRingen({ x: qx, y: qy }, ringe)) continue
      paare.push({ i, j, d, s0, s1 })
    }
  }
  paare.sort((p, q) => p.d - q.d)
  const out: Omit<ErkannteWand, 'id' | 'hoeheM' | 'quelle'>[] = []
  for (const p of paare) {
    const a = kanten[p.i]
    const b = kanten[p.j]
    // Abschnitt auf a, der noch frei ist
    const frei = freiAbschnitt(a.belegt, p.s0, p.s1)
    if (!frei) continue
    const [f0, f1] = frei
    // derselbe Abschnitt auf b
    const tb0 = (a.ax + a.dx * f0 - b.ax) * b.dx + (a.ay + a.dy * f0 - b.ay) * b.dy
    const tb1 = (a.ax + a.dx * f1 - b.ax) * b.dx + (a.ay + a.dy * f1 - b.ay) * b.dy
    const fb = freiAbschnitt(b.belegt, Math.min(tb0, tb1), Math.max(tb0, tb1))
    if (!fb || fb[1] - fb[0] < (f1 - f0) * 0.5) continue
    a.belegt.push([f0, f1])
    b.belegt.push(fb)
    const seite = (b.ax - a.ax) * a.dy - (b.ay - a.ay) * a.dx > 0 ? 1 : -1
    const nx = a.dy * seite * (p.d / 2)
    const ny = -a.dx * seite * (p.d / 2)
    out.push({
      x1: a.ax + a.dx * f0 + nx,
      y1: a.ay + a.dy * f0 + ny,
      x2: a.ax + a.dx * f1 + nx,
      y2: a.ay + a.dy * f1 + ny,
      dickeM: p.d,
    })
  }
  return out
}

function imRingen(p: PlanPunkt, ringe: PlanPunkt[][]) {
  let n = 0
  for (const r of ringe) if (imRing(p, r)) n++
  return n % 2 === 1
}

/** Groesster freier Teil von [s0,s1], wenn mehr als die Haelfte frei ist. */
function freiAbschnitt(belegt: [number, number][], s0: number, s1: number): [number, number] | null {
  let teile: [number, number][] = [[s0, s1]]
  for (const [b0, b1] of belegt) {
    const neu: [number, number][] = []
    for (const [t0, t1] of teile) {
      if (b1 <= t0 + 1e-6 || b0 >= t1 - 1e-6) neu.push([t0, t1])
      else {
        if (b0 > t0) neu.push([t0, b0])
        if (b1 < t1) neu.push([b1, t1])
      }
    }
    teile = neu
  }
  teile.sort((a, b) => b[1] - b[0] - (a[1] - a[0]))
  const g = teile[0]
  if (!g || g[1] - g[0] < Math.max(0.03, (s1 - s0) * 0.3)) return null
  return g
}

// ── Linienpaare (Zeichnungen ohne Poché) ────────────────────────────────

function linienPaare(z: VektorZeichnung, inM: (p: PlanPunkt) => PlanPunkt, ebenenMitWand: Set<string | undefined>): Omit<ErkannteWand, 'id' | 'hoeheM'>[] {
  type L = { ax: number; ay: number; dx: number; dy: number; len: number; ebene?: string }
  const linien: L[] = []
  for (const p of z.pfade) {
    if (!p.gezogen) continue
    if (ebenenMitWand.size ? !ebenenMitWand.has(p.ebene) : p.ebene && KEINE_WAND_EBENE.test(p.ebene)) continue
    if (p.ebene && /öffnung|oeffnung|opening|glas|glass/i.test(p.ebene)) continue
    for (let t = 0; t < p.teile.length; t++) {
      const r = p.teile[t].map(inM)
      const n = r.length + (p.zu[t] && r.length > 2 ? 1 : 0)
      for (let i = 1; i < n; i++) {
        const a = r[i - 1]
        const b = r[i % r.length]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len < 0.3) continue
        linien.push({ ax: a.x, ay: a.y, dx: (b.x - a.x) / len, dy: (b.y - a.y) / len, len, ebene: p.ebene })
      }
    }
  }
  // nach Richtung sortieren, damit nur Nachbarn verglichen werden
  const winkelVon = (l: L) => ((Math.atan2(l.dy, l.dx) + Math.PI) % Math.PI)
  const sortiert = linien.map((l) => ({ l, w: winkelVon(l) })).sort((a, b) => a.w - b.w)
  const out: Omit<ErkannteWand, 'id' | 'hoeheM'>[] = []
  const benutzt = new Set<L>()
  for (let i = 0; i < sortiert.length; i++) {
    const a = sortiert[i].l
    if (benutzt.has(a)) continue
    let best: { b: L; d: number; s0: number; s1: number } | null = null
    for (let j = i + 1; j < sortiert.length && sortiert[j].w - sortiert[i].w < 0.01; j++) {
      const b = sortiert[j].l
      if (benutzt.has(b)) continue
      const mx = b.ax + (b.dx * b.len) / 2
      const my = b.ay + (b.dy * b.len) / 2
      const d = Math.abs((mx - a.ax) * a.dy - (my - a.ay) * a.dx)
      if (d < 0.05 || d > 0.6) continue
      const t1 = (b.ax - a.ax) * a.dx + (b.ay - a.ay) * a.dy
      const t2 = t1 + (b.dx * a.dx + b.dy * a.dy) * b.len
      const s0 = Math.max(0, Math.min(t1, t2))
      const s1 = Math.min(a.len, Math.max(t1, t2))
      if (s1 - s0 < 0.3 || s1 - s0 < 0.5 * Math.min(a.len, b.len)) continue
      if (!best || d < best.d) best = { b, d, s0, s1 }
    }
    if (!best) continue
    benutzt.add(a)
    benutzt.add(best.b)
    const seite = (best.b.ax - a.ax) * a.dy - (best.b.ay - a.ay) * a.dx > 0 ? 1 : -1
    const nx = a.dy * seite * (best.d / 2)
    const ny = -a.dx * seite * (best.d / 2)
    out.push({
      x1: a.ax + a.dx * best.s0 + nx,
      y1: a.ay + a.dy * best.s0 + ny,
      x2: a.ax + a.dx * best.s1 + nx,
      y2: a.ay + a.dy * best.s1 + ny,
      dickeM: best.d,
      quelle: 'lines',
      ebene: a.ebene,
    })
  }
  return out
}

// ── Zusammenfassen, Oeffnungen, Verbinden ──────────────────────────────

type RohWand = Omit<ErkannteWand, 'id' | 'hoeheM'>

/** Liegt eine Linienwand in einer Flaechenwand (deren Umrisslinien)? */
function abgedeckt(w: RohWand, flaechen: RohWand[]): boolean {
  let treffer = 0
  for (const u of [0.15, 0.5, 0.85]) {
    const px = w.x1 + (w.x2 - w.x1) * u
    const py = w.y1 + (w.y2 - w.y1) * u
    for (const f of flaechen) {
      if (Math.abs(px - (f.x1 + f.x2) / 2) > Math.abs(f.x2 - f.x1) / 2 + f.dickeM + 0.05) continue
      if (Math.abs(py - (f.y1 + f.y2) / 2) > Math.abs(f.y2 - f.y1) / 2 + f.dickeM + 0.05) continue
      if (lot(px, py, f.x1, f.y1, f.x2, f.y2).d <= f.dickeM / 2 + 0.03) {
        treffer++
        break
      }
    }
  }
  return treffer >= 2
}

/** „BRH ca 0,73m", „BRH = 0,90": haeufigste Bruestungshoehe des Plans. */
export function bruestungAusText(texte: readonly VektorText[]): number | undefined {
  const werte = texte
    .map((t) => /\bBRH\s*(?:ca\.?)?\s*[:=]?\s*(\d[.,]\d{1,3})/i.exec(t.text))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => Number(m[1].replace(',', '.')))
    .filter((v) => v >= 0.2 && v <= 1.6)
  if (!werte.length) return undefined
  werte.sort((a, b) => a - b)
  return werte[Math.floor(werte.length / 2)]
}

/** Kollineare Stuecke gleicher Staerke, die sich beruehren, zu einer Wand. */
function zusammenfassen(roh: RohWand[]): RohWand[] {
  const gruppen = new Map<string, { w: RohWand; dx: number; dy: number; off: number; t0: number; t1: number }[]>()
  for (const w of roh) {
    let dx = w.x2 - w.x1
    let dy = w.y2 - w.y1
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    dx /= len
    dy /= len
    if (dx < -1e-9 || (Math.abs(dx) < 1e-9 && dy < 0)) {
      dx = -dx
      dy = -dy
    }
    const off = w.x1 * dy - w.y1 * dx
    const t1 = w.x1 * dx + w.y1 * dy
    const t2 = w.x2 * dx + w.y2 * dy
    const key = `${Math.round(deg(Math.atan2(dy, dx)) * 4)}`
    const l = gruppen.get(key) ?? []
    l.push({ w, dx, dy, off, t0: Math.min(t1, t2), t1: Math.max(t1, t2) })
    gruppen.set(key, l)
  }
  const out: RohWand[] = []
  for (const l of gruppen.values()) {
    l.sort((a, b) => a.off - b.off || a.t0 - b.t0)
    const fertig = new Array(l.length).fill(false)
    for (let i = 0; i < l.length; i++) {
      if (fertig[i]) continue
      const a = l[i]
      let t0 = a.t0
      let t1 = a.t1
      let dicke = a.w.dickeM * (a.t1 - a.t0)
      let gewicht = a.t1 - a.t0
      fertig[i] = true
      let weiter = true
      while (weiter) {
        weiter = false
        for (let j = i + 1; j < l.length; j++) {
          if (fertig[j]) continue
          const b = l[j]
          if (b.off - a.off > 0.02) break
          if (Math.abs(b.w.dickeM - a.w.dickeM) > 0.02) continue
          if (b.t0 > t1 + 0.03 || b.t1 < t0 - 0.03) continue
          t0 = Math.min(t0, b.t0)
          t1 = Math.max(t1, b.t1)
          dicke += b.w.dickeM * (b.t1 - b.t0)
          gewicht += b.t1 - b.t0
          fertig[j] = true
          weiter = true
        }
      }
      const { dx, dy, off } = a
      // Punkt auf der Geraden: off = x*dy - y*dx  →  p0 = off * (dy, -dx)
      const px = off * dy
      const py = -off * dx
      out.push({
        x1: px + dx * t0,
        y1: py + dy * t0,
        x2: px + dx * t1,
        y2: py + dy * t1,
        dickeM: dicke / gewicht,
        quelle: a.w.quelle,
        ebene: a.w.ebene,
      })
    }
  }
  return out
}

export interface OeffnungsVorgaben {
  /** Bruestungshoehe der Fenster. */
  bruestungM: number
  /** Sturzhoehe der Fenster. */
  fensterOberkanteM: number
  /** Lichte Hoehe der Tueren. */
  tuerHoeheM: number
  wandHoeheM: number
}

type Stueck = { id: string; dicke: number; dx: number; dy: number; off: number; t0: number; t1: number; stuetze: boolean; wand?: ErkannteWand }

function stueckAus(id: string, x1: number, y1: number, x2: number, y2: number, dicke: number, stuetze: boolean, wand?: ErkannteWand): Stueck | null {
  let dx = x2 - x1
  let dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 0.05) return null
  dx /= len
  dy /= len
  if (dx < -1e-9 || (Math.abs(dx) < 1e-9 && dy < 0)) {
    dx = -dx
    dy = -dy
  }
  const a = x1 * dx + y1 * dy
  const b = x2 * dx + y2 * dy
  return { id, dicke, dx, dy, off: x1 * dy - y1 * dx, t0: Math.min(a, b), t1: Math.max(a, b), stuetze, wand }
}

/**
 * Luecken zwischen kollinearen Wandstuecken (und Stuetzen einer Fassade)
 * sind Oeffnungen. Ein Bogen daneben macht sie zur Tuer, parallele Linien
 * in der Luecke (Rahmen, Glas) zum Fenster. Tueren und Fenster bekommen ein
 * Fuellstueck: eine Wand ueber die Luecke, deren Oeffnung die 3D-Ansicht
 * ausspart — so stehen Sturz und Bruestung, wo sie hingehoeren.
 */
function oeffnungenFinden(
  waende: ErkannteWand[],
  stuetzen: ErkannteStuetze[],
  z: VektorZeichnung,
  inM: (p: PlanPunkt) => PlanPunkt,
  v: OeffnungsVorgaben,
): { oeffnungen: ErkannteOeffnung[]; fuell: ErkannteWand[]; entfernt: Set<string> } {
  const stuecke: Stueck[] = []
  for (const w of waende) {
    const s = stueckAus(w.id, w.x1, w.y1, w.x2, w.y2, w.dickeM, false, w)
    if (s) stuecke.push(s)
  }
  stuetzen.forEach((s, i) => {
    const w = (s.winkel * Math.PI) / 180
    for (const [l, q, ww] of [[s.breiteM, s.tiefeM, w], [s.tiefeM, s.breiteM, w + Math.PI / 2]] as const) {
      const hx = (Math.cos(ww) * l) / 2
      const hy = (Math.sin(ww) * l) / 2
      const st = stueckAus(`s${i + 1}`, s.x - hx, s.y - hy, s.x + hx, s.y + hy, q, true)
      if (st) stuecke.push(st)
    }
  })
  const gruppen = new Map<number, Stueck[]>()
  for (const s of stuecke) {
    const k = Math.round(deg(Math.atan2(s.dy, s.dx)) * 2)
    for (const kk of [k - 1, k, k + 1]) {
      const l = gruppen.get(kk) ?? []
      if (kk === k) l.push(s)
      gruppen.set(kk, l)
    }
  }
  // Wandraster fuer „kreuzt etwas die Luecke?"
  const Z = 2
  const wRaster = new Map<string, ErkannteWand[]>()
  for (const w of waende) {
    const r = rahmenVon([{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }])
    for (let gx = Math.floor(r.minX / Z); gx <= Math.floor(r.maxX / Z); gx++)
      for (let gy = Math.floor(r.minY / Z); gy <= Math.floor(r.maxY / Z); gy++) {
        const k = `${gx},${gy}`
        const l = wRaster.get(k) ?? []
        l.push(w)
        wRaster.set(k, l)
      }
  }
  // Boegen (Tuerschwenks) und Linien fuer die Einordnung, in Metern
  const boegen: Rahmen[] = []
  const linien: [PlanPunkt, PlanPunkt][] = []
  for (const p of z.pfade) {
    if (!p.gezogen) continue
    if (p.ebene && /bema|dimen|achs|axis|grid|text|beschrift|möb|einricht|sanit|import/i.test(p.ebene)) continue
    if (p.kurve) {
      const r = rahmenVon(p.teile.flat().map(inM))
      const g = Math.max(r.maxX - r.minX, r.maxY - r.minY)
      if (g >= 0.4 && g <= 2.5) boegen.push(r)
      continue
    }
    for (const t of p.teile) {
      for (let i = 1; i < t.length; i++) {
        const a = inM(t[i - 1])
        const b = inM(t[i])
        const l = Math.hypot(b.x - a.x, b.y - a.y)
        if (l >= 0.2 && l <= 6) linien.push([a, b])
      }
    }
  }
  const LZ = 2
  const lRaster = new Map<string, number[]>()
  linien.forEach(([a, b], i) => {
    const k = `${Math.floor((a.x + b.x) / 2 / LZ)},${Math.floor((a.y + b.y) / 2 / LZ)}`
    const l = lRaster.get(k) ?? []
    l.push(i)
    lRaster.set(k, l)
  })

  const oeffnungen: ErkannteOeffnung[] = []
  const fuell: ErkannteWand[] = []
  const entfernt = new Set<string>()
  const vergeben = new Set<string>()
  let n = 0
  for (const [k, l] of gruppen) {
    for (const a of l) {
      if (Math.round(deg(Math.atan2(a.dy, a.dx)) * 2) !== k) continue
      // naechstes Stueck auf derselben Linie (rechts davon)
      let best: Stueck | null = null
      const imSpalt: Stueck[] = []
      for (const b of l) {
        if (b === a || b.id === a.id) continue
        if (Math.abs(b.off - a.off) > 0.04) continue
        const luecke = b.t0 - a.t1
        if (luecke < -0.01 || luecke > 4.5) continue
        const passt = Math.abs(b.dicke - a.dicke) <= (a.stuetze || b.stuetze ? 0.2 : 0.03)
        if (!passt) {
          // duenne Glasebene in der Luecke: Hinweis auf ein Fenster
          if (!b.stuetze && b.dicke < Math.min(a.dicke, 0.12) && b.t0 > a.t1 - 0.02) imSpalt.push(b)
          continue
        }
        if (!best || b.t0 < best.t0) best = b
      }
      if (!best) continue
      const breite = best.t0 - a.t1
      if (breite < 0.45) continue
      const schluessel = `${a.id}|${best.id}`
      if (vergeben.has(schluessel)) continue
      vergeben.add(schluessel)
      const glas = imSpalt.filter((g) => g.t0 >= a.t1 - 0.02 && g.t1 <= best!.t0 + 0.02)
      const tm = (a.t1 + best.t0) / 2
      const px = a.off * a.dy + a.dx * tm
      const py = -a.off * a.dx + a.dy * tm
      const dicke = a.stuetze ? best.dicke : best.stuetze ? a.dicke : (a.dicke + best.dicke) / 2
      // Kreuzt eine andere Wand die Luecke, ist es keine Oeffnung, sondern ein Stoss.
      const sx = a.off * a.dy + a.dx * (a.t1 + 0.05)
      const sy = -a.off * a.dx + a.dy * (a.t1 + 0.05)
      const ex = a.off * a.dy + a.dx * (best.t0 - 0.05)
      const ey = -a.off * a.dx + a.dy * (best.t0 - 0.05)
      let kreuzt = false
      const gesehen = new Set<ErkannteWand>()
      for (let gx = Math.floor(Math.min(sx, ex) / Z); gx <= Math.floor(Math.max(sx, ex) / Z) && !kreuzt; gx++)
        for (let gy = Math.floor(Math.min(sy, ey) / Z); gy <= Math.floor(Math.max(sy, ey) / Z) && !kreuzt; gy++)
          for (const w of wRaster.get(`${gx},${gy}`) ?? []) {
            if (gesehen.has(w) || w.id === a.id || w.id === best.id) continue
            gesehen.add(w)
            if (glas.some((g) => g.id === w.id)) continue
            if (schneiden(sx, sy, ex, ey, w.x1, w.y1, w.x2, w.y2)) {
              kreuzt = true
              break
            }
          }
      if (kreuzt) continue
      const tuer = !a.stuetze && !best.stuetze && boegen.some((r) => {
        const g = Math.max(r.maxX - r.minX, r.maxY - r.minY)
        if (g < breite * 0.35 || g > breite * 1.15) return false
        const nah = Math.max(r.minX - px, px - r.maxX, r.minY - py, py - r.maxY, 0)
        return nah <= breite * 0.6
      })
      let art: OeffnungsArt = tuer ? 'door' : 'opening'
      if (!tuer) {
        let parallel = glas.length * 2
        const kx = Math.floor(px / LZ)
        const ky = Math.floor(py / LZ)
        for (let gx = kx - 2; gx <= kx + 2 && parallel < 2; gx++)
          for (let gy = ky - 2; gy <= ky + 2 && parallel < 2; gy++)
            for (const i of lRaster.get(`${gx},${gy}`) ?? []) {
              const [p, q] = linien[i]
              const ld = Math.hypot(q.x - p.x, q.y - p.y)
              if (Math.abs(((q.x - p.x) / ld) * a.dy - ((q.y - p.y) / ld) * a.dx) > 0.02) continue
              const mx = (p.x + q.x) / 2
              const my = (p.y + q.y) / 2
              const quer = Math.abs(mx * a.dy - my * a.dx - a.off)
              const laengs = mx * a.dx + my * a.dy
              if (quer <= dicke / 2 + 0.05 && laengs > a.t1 - 0.05 && laengs < best.t0 + 0.05 && ld > breite * 0.5) parallel++
            }
        if (parallel >= 2) art = 'window'
      }
      // Zwischen Stuetzen zaehlt nur ein Fenster: freie Felder einer Halle sind keine Wand.
      if ((a.stuetze || best.stuetze) && art !== 'window') continue
      for (const g of glas) entfernt.add(g.id)
      const o: ErkannteOeffnung = {
        id: `o${++n}`,
        art,
        x: px,
        y: py,
        breiteM: breite,
        winkel: deg(Math.atan2(a.dy, a.dx)),
        dickeM: dicke,
        zwischen: [a.id, best.id],
      }
      if (art !== 'opening') {
        const fid = `f${n}`
        const hx = (a.dx * breite) / 2
        const hy = (a.dy * breite) / 2
        fuell.push({
          id: fid,
          x1: px - hx,
          y1: py - hy,
          x2: px + hx,
          y2: py + hy,
          dickeM: dicke,
          quelle: a.wand?.quelle ?? best.wand?.quelle ?? 'fill',
        })
        o.wandId = fid
        o.unterkanteM = art === 'door' ? 0 : Math.min(v.bruestungM, v.wandHoeheM - 0.3)
        o.oberkanteM = Math.min(art === 'door' ? v.tuerHoeheM : v.fensterOberkanteM, v.wandHoeheM)
      }
      oeffnungen.push(o)
    }
  }
  return { oeffnungen, fuell, entfernt }
}

function schneiden(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const k = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx)
  if (Math.abs(k) < 1e-12) return false
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / k
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / k
  return t > 0 && t < 1 && u > -0.02 && u < 1.02
}

/**
 * Wandenden an Ecken und T-Stoessen bis zur Mittellinie der anderen Wand
 * verlaengern. Aus den Kantenpaaren endet eine Wand an der Flucht der
 * anderen — in 3D bliebe dort ein Spalt von halber Wandstaerke.
 */
function verbinden(waende: ErkannteWand[]) {
  const Z = 3
  const raster = new Map<string, number[]>()
  waende.forEach((w, i) => {
    const r = rahmenVon([{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }])
    for (let gx = Math.floor((r.minX - 1) / Z); gx <= Math.floor((r.maxX + 1) / Z); gx++) {
      for (let gy = Math.floor((r.minY - 1) / Z); gy <= Math.floor((r.maxY + 1) / Z); gy++) {
        const k = `${gx},${gy}`
        const l = raster.get(k) ?? []
        l.push(i)
        raster.set(k, l)
      }
    }
  })
  const neu = waende.map((w) => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }))
  waende.forEach((w, i) => {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
    if (len < 1e-6) return
    const dx = (w.x2 - w.x1) / len
    const dy = (w.y2 - w.y1) / len
    for (const ende of [0, 1] as const) {
      const ex = ende ? w.x2 : w.x1
      const ey = ende ? w.y2 : w.y1
      const sx = ende ? dx : -dx // nach aussen
      const sy = ende ? dy : -dy
      let bestT = Infinity
      const kand = new Set<number>()
      for (let gx = Math.floor(ex / Z) - 1; gx <= Math.floor(ex / Z) + 1; gx++)
        for (let gy = Math.floor(ey / Z) - 1; gy <= Math.floor(ey / Z) + 1; gy++) for (const j of raster.get(`${gx},${gy}`) ?? []) kand.add(j)
      for (const j of kand) {
        if (j === i) continue
        const o = waende[j]
        const ol = Math.hypot(o.x2 - o.x1, o.y2 - o.y1)
        if (ol < 1e-6) continue
        const odx = (o.x2 - o.x1) / ol
        const ody = (o.y2 - o.y1) / ol
        const kreuz = sx * ody - sy * odx
        if (Math.abs(kreuz) < 0.2) continue // parallel: kein Stoss
        // Schnitt Strahl (ex,ey)+t*(sx,sy) mit Gerade o
        const t = ((o.x1 - ex) * ody - (o.y1 - ey) * odx) / kreuz
        const grenze = Math.max(w.dickeM, o.dickeM) * 0.75 + 0.03
        if (t < -grenze || t > grenze) continue
        // Schnittpunkt muss auf (oder knapp an) der anderen Wand liegen
        const u = ((ex + sx * t - o.x1) * odx + (ey + sy * t - o.y1) * ody)
        if (u < -w.dickeM / 2 - 0.03 || u > ol + w.dickeM / 2 + 0.03) continue
        if (Math.abs(t) < Math.abs(bestT)) bestT = t
      }
      if (Number.isFinite(bestT) && bestT > 0) {
        if (ende) {
          neu[i].x2 = ex + sx * bestT
          neu[i].y2 = ey + sy * bestT
        } else {
          neu[i].x1 = ex + sx * bestT
          neu[i].y1 = ey + sy * bestT
        }
      }
    }
  })
  waende.forEach((w, i) => Object.assign(w, neu[i]))
}

// ── Treppen ─────────────────────────────────────────────────────────────

/** Mindestens fuenf gleich lange, gleich weit gestaffelte Parallelen. */
function treppenFinden(z: VektorZeichnung, inM: (p: PlanPunkt) => PlanPunkt): ErkannteTreppe[] {
  type S = { mx: number; my: number; dx: number; dy: number; len: number }
  const gruppen = new Map<string, S[]>()
  for (const p of z.pfade) {
    if (!p.gezogen || p.kurve) continue
    if (p.ebene && /bema|dimen|achs|axis|grid|schraff|hatch|text/i.test(p.ebene)) continue
    for (const t of p.teile) {
      for (let i = 1; i < t.length; i++) {
        const a = inM(t[i - 1])
        const b = inM(t[i])
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len < 0.8 || len > 4) continue
        let dx = (b.x - a.x) / len
        let dy = (b.y - a.y) / len
        if (dx < -1e-9 || (Math.abs(dx) < 1e-9 && dy < 0)) {
          dx = -dx
          dy = -dy
        }
        const key = `${Math.round(deg(Math.atan2(dy, dx)))}|${Math.round(len / 0.05)}`
        const l = gruppen.get(key) ?? []
        l.push({ mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dx, dy, len })
        gruppen.set(key, l)
      }
    }
  }
  const out: ErkannteTreppe[] = []
  for (const l of gruppen.values()) {
    if (l.length < 5) continue
    const { dx, dy } = l[0]
    // nach Abstand quer zur Linie sortieren, Laengslage muss passen
    const s = l.map((q) => ({ q, quer: q.mx * dy - q.my * dx, laengs: q.mx * dx + q.my * dy })).sort((a, b) => a.quer - b.quer)
    let lauf: typeof s = []
    const abschliessen = () => {
      if (lauf.length >= 5) {
        const auftritt = (lauf[lauf.length - 1].quer - lauf[0].quer) / (lauf.length - 1)
        const h = lauf[0].q.len / 2
        const ecke = (quer: number, laengs: number) => ({ x: laengs * dx + quer * dy, y: laengs * dy - quer * dx })
        const lm = lauf.reduce((a, b) => a + b.laengs, 0) / lauf.length
        out.push({
          ecken: [ecke(lauf[0].quer, lm - h), ecke(lauf[0].quer, lm + h), ecke(lauf[lauf.length - 1].quer, lm + h), ecke(lauf[lauf.length - 1].quer, lm - h)],
          stufen: lauf.length + 1,
          auftrittM: auftritt,
        })
      }
      lauf = []
    }
    for (const e of s) {
      if (!lauf.length) {
        lauf.push(e)
        continue
      }
      const letzte = lauf[lauf.length - 1]
      const abst = e.quer - letzte.quer
      const soll = lauf.length >= 2 ? (letzte.quer - lauf[0].quer) / (lauf.length - 1) : abst
      if (abst < 0.005) continue // Doppellinie
      if (abst >= 0.2 && abst <= 0.4 && Math.abs(abst - soll) < 0.03 && Math.abs(e.laengs - letzte.laengs) < 0.1) lauf.push(e)
      else {
        abschliessen()
        lauf.push(e)
      }
    }
    abschliessen()
  }
  return out
}

// ── Raeume ──────────────────────────────────────────────────────────────

/** Raumstempel lesen: Flaeche „F: 32,55 m²", „NRF 12,3", „32,55 m²". */
export function stempelFlaeche(t: string): number | undefined {
  const m = /(?:^|\b)(?:F|NRF|NGF|NUF|A|Fläche|Flaeche)?\s*[:=]?\s*(\d{1,5}(?:[.,]\d{1,2})?)\s*m(?:²|2)?\s*$/i.exec(t.trim())
  if (!m) return undefined
  if (!/m/.test(t) || /^U\s*:/i.test(t.trim())) return undefined
  return Number(m[1].replace(',', '.'))
}

/** Lichte Hoehe: „RH 3,00", „LH: 2,75 m", „lichte Höhe 3,20". */
export function stempelHoehe(t: string): number | undefined {
  const m = /\b(?:RH|LH|lichte\s*H(?:ö|oe)he|lRH|H)\s*[:=]?\s*(\d{1,2}[.,]\d{1,3})\s*m?\b/i.exec(t)
  return m ? Number(m[1].replace(',', '.')) : undefined
}

const RAUM_ZELLE = 0.05

function raeumeFinden(
  z: VektorZeichnung,
  inM: (p: PlanPunkt) => PlanPunkt,
  m: number,
  waende: ErkannteWand[],
  oeffnungen: ErkannteOeffnung[],
  stuetzen: ErkannteStuetze[],
): ErkannterRaum[] {
  const texte = z.texte.map((t) => ({ t, p: inM({ x: t.x, y: t.y }), h: t.hoehe * m }))
  const raeume: ErkannterRaum[] = []
  for (const f of texte) {
    const flaeche = stempelFlaeche(f.t.text)
    if (flaeche === undefined || flaeche < 0.5) continue
    // Zeilen darueber: Name, darueber Nummer (links buendig, enger Abstand)
    const darueber = texte
      .filter((o) => o !== f && Math.abs(o.p.x - f.p.x) < f.h * 1.5 && f.p.y - o.p.y > f.h * 0.5 && f.p.y - o.p.y < f.h * 4.5)
      .sort((a, b) => b.p.y - a.p.y)
    const darunter = texte.filter((o) => o !== f && Math.abs(o.p.x - f.p.x) < f.h * 1.5 && o.p.y - f.p.y > f.h * 0.5 && o.p.y - f.p.y < f.h * 3.5)
    let name: string | undefined
    let nummer: string | undefined
    for (const o of darueber) {
      const s = o.t.text.trim()
      if (!nummer && /^\d+([.,]\d+)+[a-z]?$/i.test(s)) nummer = s
      else if (!name && !stempelFlaeche(s) && /[a-zäöüß]{2}/i.test(s)) name = s
    }
    let hoeheM: number | undefined
    for (const o of [...darueber, ...darunter]) hoeheM ??= stempelHoehe(o.t.text)
    raeume.push({ nummer, name, flaecheM2: flaeche, hoeheM, x: f.p.x, y: f.p.y - f.h })
  }
  // Doppelte Stempel (gleiche Stelle) nur einmal
  const eindeutig = raeume.filter((r, i) => raeume.findIndex((q) => Math.hypot(q.x - r.x, q.y - r.y) < 0.3) === i)

  // a) farbig gefuellte Raumflaeche (Flaechenplaene) um den Stempel
  const flaechen = z.pfade
    .filter((p) => p.gefuellt && p.teile.length >= 1)
    .filter((p) => {
      const l = luminanz(p.fuellfarbe)
      return l !== undefined && l > 0.45 && l < 0.995
    })
    .map((p) => ({ ring: p.teile[0].map(inM) }))
    .filter((f) => f.ring.length >= 3)
    .map((f) => ({ ...f, a: Math.abs(ringFlaeche(f.ring)), r: rahmenVon(f.ring) }))
  // b) sonst: Waende rastern und vom Stempel aus fluten
  const raster = waendeRastern(waende, oeffnungen, stuetzen)
  for (const r of eindeutig) {
    const soll = r.flaecheM2 ?? 0
    const kand = flaechen
      .filter((f) => r.x >= f.r.minX && r.x <= f.r.maxX && r.y >= f.r.minY && r.y <= f.r.maxY && imRing(r, f.ring))
      .filter((f) => !soll || Math.abs(f.a - soll) <= soll * 0.25 + 0.5)
      .sort((a, b) => Math.abs(a.a - soll) - Math.abs(b.a - soll))
    if (kand[0]) {
      r.umriss = kand[0].ring
      r.umrissFlaecheM2 = kand[0].a
      r.umrissQuelle = 'fill'
      continue
    }
    if (!raster) continue
    const g = fluten(raster, r.x, r.y, soll)
    if (g) {
      r.umriss = g.umriss
      r.umrissFlaecheM2 = g.flaeche
      r.umrissQuelle = 'walls'
    }
  }
  return eindeutig
}

interface WandRaster {
  b: number
  h: number
  x0: number
  y0: number
  zellen: Uint8Array
}

function waendeRastern(waende: ErkannteWand[], oeffnungen: ErkannteOeffnung[], stuetzen: ErkannteStuetze[]): WandRaster | null {
  if (!waende.length) return null
  const r = rahmenVon(waende.flatMap((w) => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]))
  const x0 = r.minX - 1
  const y0 = r.minY - 1
  const b = Math.ceil((r.maxX - r.minX + 2) / RAUM_ZELLE)
  const h = Math.ceil((r.maxY - r.minY + 2) / RAUM_ZELLE)
  if (b * h > 40_000_000) return null
  const zellen = new Uint8Array(b * h)
  const strich = (x1: number, y1: number, x2: number, y2: number, dicke: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1)
    const schritte = Math.max(1, Math.ceil(len / (RAUM_ZELLE * 0.5)))
    const halb = Math.max(dicke / 2, RAUM_ZELLE * 0.75)
    const nx = len ? -(y2 - y1) / len : 0
    const ny = len ? (x2 - x1) / len : 0
    const quer = Math.max(1, Math.ceil((2 * halb) / (RAUM_ZELLE * 0.5)))
    for (let i = 0; i <= schritte; i++) {
      const u = i / schritte
      const cx = x1 + (x2 - x1) * u
      const cy = y1 + (y2 - y1) * u
      for (let k = 0; k <= quer; k++) {
        const v = -halb + (2 * halb * k) / quer
        const gx = Math.floor((cx + nx * v - x0) / RAUM_ZELLE)
        const gy = Math.floor((cy + ny * v - y0) / RAUM_ZELLE)
        if (gx >= 0 && gy >= 0 && gx < b && gy < h) zellen[gy * b + gx] = 1
      }
    }
  }
  for (const w of waende) strich(w.x1, w.y1, w.x2, w.y2, w.dickeM)
  // Oeffnungen schliessen, sonst laeuft die Flut durch die Tuer
  for (const o of oeffnungen) {
    const w = (o.winkel * Math.PI) / 180
    const hx = (Math.cos(w) * o.breiteM) / 2
    const hy = (Math.sin(w) * o.breiteM) / 2
    strich(o.x - hx, o.y - hy, o.x + hx, o.y + hy, Math.min(o.dickeM, 0.1))
  }
  for (const s of stuetzen) strich(s.x - 0.01, s.y, s.x + 0.01, s.y, Math.max(s.breiteM, s.tiefeM))
  return { b, h, x0, y0, zellen }
}

/** Flutfuellung ab dem Stempel; zu gross (offener Raum) → null. */
function fluten(r: WandRaster, x: number, y: number, sollM2: number): { umriss: PlanPunkt[]; flaeche: number } | null {
  const gx = Math.floor((x - r.x0) / RAUM_ZELLE)
  const gy = Math.floor((y - r.y0) / RAUM_ZELLE)
  if (gx < 0 || gy < 0 || gx >= r.b || gy >= r.h) return null
  let start = gy * r.b + gx
  if (r.zellen[start]) {
    // Stempel steht auf einer Linie: Nachbarn versuchen
    const alt = [start + 2, start - 2, start + 2 * r.b, start - 2 * r.b].find((i) => i >= 0 && i < r.zellen.length && !r.zellen[i])
    if (alt === undefined) return null
    start = alt
  }
  const grenze = Math.max(4 * sollM2, 400) / (RAUM_ZELLE * RAUM_ZELLE)
  const besucht = new Uint8Array(r.zellen.length)
  const stapel = [start]
  besucht[start] = 1
  const liste: number[] = []
  while (stapel.length) {
    const i = stapel.pop()!
    liste.push(i)
    if (liste.length > grenze) return null
    const cx = i % r.b
    const cy = (i - cx) / r.b
    if (cx === 0 || cy === 0 || cx === r.b - 1 || cy === r.h - 1) return null
    for (const n of [i - 1, i + 1, i - r.b, i + r.b]) {
      if (!besucht[n] && !r.zellen[n]) {
        besucht[n] = 1
        stapel.push(n)
      }
    }
  }
  const umriss = randZiehen(besucht, r)
  const z2 = RAUM_ZELLE * RAUM_ZELLE
  // Die Flut endet eine halbe Zelle vor der Wandflucht: Umfang * Zelle/2 dazu.
  let umfang = 0
  for (let i = 0; i < umriss.length; i++) {
    const a = umriss[i]
    const b = umriss[(i + 1) % umriss.length]
    umfang += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return { umriss, flaeche: liste.length * z2 + (umfang * RAUM_ZELLE) / 2 }
}

/** Aussenkontur einer Zellmenge (Kanten zwischen innen und aussen), vereinfacht. */
function randZiehen(innen: Uint8Array, r: WandRaster): PlanPunkt[] {
  // gerichtete Randkanten sammeln, Innen liegt links
  const naechste = new Map<number, number>()
  const B = r.b + 1
  const pk = (x: number, y: number) => y * B + x
  for (let i = 0; i < innen.length; i++) {
    if (!innen[i]) continue
    const x = i % r.b
    const y = (i - x) / r.b
    if (!innen[i - r.b]) naechste.set(pk(x + 1, y), pk(x, y))
    if (!innen[i + r.b]) naechste.set(pk(x, y + 1), pk(x + 1, y + 1))
    if (!innen[i - 1]) naechste.set(pk(x, y), pk(x, y + 1))
    if (!innen[i + 1]) naechste.set(pk(x + 1, y + 1), pk(x + 1, y))
  }
  // laengsten Ring nehmen (Aussenkontur)
  let bester: number[] = []
  const gesehen = new Set<number>()
  for (const s of naechste.keys()) {
    if (gesehen.has(s)) continue
    const ring: number[] = []
    let p = s
    while (!gesehen.has(p)) {
      gesehen.add(p)
      ring.push(p)
      const n = naechste.get(p)
      if (n === undefined) break
      p = n
    }
    if (ring.length > bester.length) bester = ring
  }
  const punkte = bester.map((k) => ({ x: r.x0 + (k % B) * RAUM_ZELLE, y: r.y0 + Math.floor(k / B) * RAUM_ZELLE }))
  return vereinfachen(punkte, RAUM_ZELLE * 1.2)
}

/** Douglas-Peucker fuer geschlossene Ringe. */
export function vereinfachen(ring: PlanPunkt[], tol: number): PlanPunkt[] {
  if (ring.length < 4) return ring
  const dp = (pts: PlanPunkt[]): PlanPunkt[] => {
    if (pts.length < 3) return pts
    const a = pts[0]
    const b = pts[pts.length - 1]
    let maxD = -1
    let idx = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = lot(pts[i].x, pts[i].y, a.x, a.y, b.x, b.y).d
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD <= tol) return [a, b]
    const l = dp(pts.slice(0, idx + 1))
    return [...l.slice(0, -1), ...dp(pts.slice(idx))]
  }
  // am entferntesten Punktpaar teilen
  let far = 0
  for (let i = 1; i < ring.length; i++) if (Math.hypot(ring[i].x - ring[0].x, ring[i].y - ring[0].y) > Math.hypot(ring[far].x - ring[0].x, ring[far].y - ring[0].y)) far = i
  const h1 = dp(ring.slice(0, far + 1))
  const h2 = dp([...ring.slice(far), ring[0]])
  return [...h1.slice(0, -1), ...h2.slice(0, -1)]
}

/** Waende, die an einen Raum mit Hoehenangabe grenzen, bekommen dessen Hoehe. */
function wandHoehenAusRaeumen(waende: ErkannteWand[], raeume: ErkannterRaum[]) {
  const mitHoehe = raeume.filter((r) => r.hoeheM && r.umriss)
  if (!mitHoehe.length) return
  for (const w of waende) {
    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1)
    if (!len) continue
    const nx = -(w.y2 - w.y1) / len
    const ny = (w.x2 - w.x1) / len
    const mx = (w.x1 + w.x2) / 2
    const my = (w.y1 + w.y2) / 2
    let h = 0
    for (const s of [1, -1]) {
      const p = { x: mx + nx * s * (w.dickeM / 2 + 0.15), y: my + ny * s * (w.dickeM / 2 + 0.15) }
      for (const r of mitHoehe) if (imRing(p, r.umriss!)) h = Math.max(h, r.hoeheM!)
    }
    if (h) w.hoeheM = h
  }
}

// ── Buehnen ─────────────────────────────────────────────────────────────

const BUEHNEN_WORT = /bühne|buehne|podium|podest|stage|tribüne|tribuene|empore|riser|catwalk/i

function buehnenFinden(z: VektorZeichnung, inM: (p: PlanPunkt) => PlanPunkt, m: number, raeume: ErkannterRaum[]): ErkannteBuehne[] {
  const out: ErkannteBuehne[] = []
  const ringe = z.pfade
    .flatMap((p) => p.teile.filter((r, i) => p.zu[i] && r.length >= 4).map((r) => r.map(inM)))
    .map((r) => ({ r, a: Math.abs(ringFlaeche(r)), box: rahmenVon(r) }))
    .filter((x) => x.a >= 1.5 && x.a <= 2000)
  for (const t of z.texte) {
    if (!BUEHNEN_WORT.test(t.text)) continue
    const p = inM({ x: t.x, y: t.y })
    const h = t.hoehe * m
    const mitte = { x: p.x + ((t.laenge ?? t.text.length * t.hoehe * 0.5) * m) / 4, y: p.y - h / 2 }
    const masse = /(\d{1,2}[.,]\d{1,2})\s*[x×]\s*(\d{1,2}[.,]\d{1,2})/.exec(t.text)
    const textMasse = masse ? ([Number(masse[1].replace(',', '.')), Number(masse[2].replace(',', '.'))] as [number, number]) : undefined
    const raum = raeume.find((r) => r.umriss && imRing(mitte, r.umriss))
    const grenze = raum?.umrissFlaecheM2 ? raum.umrissFlaecheM2 * 0.8 : 2000
    let kand = ringe.filter((x) => x.a < grenze && mitte.x >= x.box.minX && mitte.x <= x.box.maxX && mitte.y >= x.box.minY && mitte.y <= x.box.maxY && imRing(mitte, x.r))
    if (textMasse) {
      // Die Beschriftung steht oft neben dem Podest: im Umkreis nach einem
      // Umriss mit genau diesen Seitenlaengen suchen.
      const [s1, s2] = textMasse
      const seitenPassen = (x: (typeof ringe)[number]) => {
        const b = x.box.maxX - x.box.minX
        const t = x.box.maxY - x.box.minY
        const ok = (u: number, w: number) => Math.abs(u - w) <= w * 0.06 + 0.05
        return (ok(b, s1) && ok(t, s2)) || (ok(b, s2) && ok(t, s1))
      }
      const abstand = (x: (typeof ringe)[number]) => Math.hypot((x.box.minX + x.box.maxX) / 2 - mitte.x, (x.box.minY + x.box.maxY) / 2 - mitte.y)
      const nahe = ringe.filter((x) => seitenPassen(x) && abstand(x) < Math.max(s1, s2) * 1.5 + 3).sort((a, b) => abstand(a) - abstand(b))
      if (nahe.length) kand = [nahe[0]]
      else {
        const r = rechteckAusLinien(z, inM, mitte, s1, s2)
        kand = r ? [{ r, a: s1 * s2, box: rahmenVon(r) }] : kand.filter((x) => Math.abs(x.a - s1 * s2) <= s1 * s2 * 0.2)
      }
    }
    kand.sort((a, b) => a.a - b.a)
    const k = kand[0]
    if (k) {
      out.push({
        label: t.text.trim(),
        x: k.box.minX,
        y: k.box.minY,
        breiteM: k.box.maxX - k.box.minX,
        tiefeM: k.box.maxY - k.box.minY,
        umriss: k.r,
        textMasse,
        sicher: !!textMasse || k.a < 400,
      })
    } else if (textMasse) {
      const [b, tf] = textMasse
      const umriss = [
        { x: mitte.x - b / 2, y: mitte.y - tf / 2 },
        { x: mitte.x + b / 2, y: mitte.y - tf / 2 },
        { x: mitte.x + b / 2, y: mitte.y + tf / 2 },
        { x: mitte.x - b / 2, y: mitte.y + tf / 2 },
      ]
      out.push({ label: t.text.trim(), x: mitte.x - b / 2, y: mitte.y - tf / 2, breiteM: b, tiefeM: tf, umriss, textMasse, sicher: false })
    }
  }
  return out
}

/**
 * Rechteck bekannter Seitenlaengen aus Einzelstrecken: zwei parallele
 * Linien der einen Laenge im Abstand der anderen, deckungsgleich. So
 * zeichnet ArchiCAD ein Podest, das kein geschlossener Pfad ist.
 */
function rechteckAusLinien(z: VektorZeichnung, inM: (p: PlanPunkt) => PlanPunkt, mitte: PlanPunkt, s1: number, s2: number): PlanPunkt[] | null {
  const radius = Math.max(s1, s2) * 1.5 + 3
  type L = { a: PlanPunkt; b: PlanPunkt; len: number }
  const ls: L[] = []
  for (const p of z.pfade) {
    if (!p.gezogen || p.kurve) continue
    for (const t of p.teile) {
      for (let i = 1; i < t.length; i++) {
        const a = inM(t[i - 1])
        const b = inM(t[i])
        if (Math.hypot((a.x + b.x) / 2 - mitte.x, (a.y + b.y) / 2 - mitte.y) > radius) continue
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (Math.abs(len - s1) <= s1 * 0.06 + 0.05 || Math.abs(len - s2) <= s2 * 0.06 + 0.05) ls.push({ a, b, len })
      }
    }
  }
  let best: { r: PlanPunkt[]; d: number } | null = null
  for (let i = 0; i < ls.length; i++) {
    for (let j = i + 1; j < ls.length; j++) {
      const p = ls[i]
      const q = ls[j]
      if (Math.abs(p.len - q.len) > 0.05) continue
      const lang = Math.abs(p.len - s1) < Math.abs(p.len - s2) ? s1 : s2
      const quer = lang === s1 ? s2 : s1
      const dx = (p.b.x - p.a.x) / p.len
      const dy = (p.b.y - p.a.y) / p.len
      const qdx = (q.b.x - q.a.x) / q.len
      const qdy = (q.b.y - q.a.y) / q.len
      if (Math.abs(dx * qdy - dy * qdx) > 0.01) continue
      const d = Math.abs((q.a.x - p.a.x) * dy - (q.a.y - p.a.y) * dx)
      if (Math.abs(d - quer) > quer * 0.06 + 0.05) continue
      const t1 = (q.a.x - p.a.x) * dx + (q.a.y - p.a.y) * dy
      const t2 = (q.b.x - p.a.x) * dx + (q.b.y - p.a.y) * dy
      if (Math.abs(Math.min(t1, t2)) > 0.1 || Math.abs(Math.max(t1, t2) - p.len) > 0.1) continue
      const sx = (q.a.x - p.a.x) - dx * t1
      const sy = (q.a.y - p.a.y) - dy * t1
      const r = [p.a, p.b, { x: p.b.x + sx, y: p.b.y + sy }, { x: p.a.x + sx, y: p.a.y + sy }]
      const c = { x: (p.a.x + p.b.x) / 2 + sx / 2, y: (p.a.y + p.b.y) / 2 + sy / 2 }
      // Seitenfehler zaehlt vor Naehe: Doppellinien (Kante + Belag) liegen beide nah.
      const dist = Math.abs(p.len - lang) + Math.abs(d - quer) + Math.hypot(c.x - mitte.x, c.y - mitte.y) * 0.005
      if (!best || dist < best.d) best = { r, d: dist }
    }
  }
  return best?.r ?? null
}

/** Texte einer Zeichnung, die eine KI als Hinweis bekommen kann (Stempel, Buehnen). */
export function hinweisTexte(z: VektorZeichnung, m: number): { text: string; x: number; y: number }[] {
  return z.texte
    .filter((t: VektorText) => /[a-zäöüß]{3}/i.test(t.text))
    .map((t) => ({ text: t.text.trim(), x: (t.x - (z.minX ?? 0)) * m, y: (t.y - (z.minY ?? 0)) * m }))
}
