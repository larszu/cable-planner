// @avplan/floorplan — Massstab aus Masstexten und Bemassungsketten.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// WARUM NICHT NUR „1:200" LESEN. Der Schriftfeld-Massstab stimmt fuer das
// Papier, aber nicht immer fuer die Datei: ein auf A3 verkleinert
// gedrucktes A1-Blatt sagt weiter „1:100". Die Bemassungsketten dagegen
// tragen die echten Masse. Jede Kette ist eine Stimme: Masszahl in Metern
// geteilt durch die gezeichnete Laenge. Der Massstab mit den meisten
// Stimmen gilt; der Schriftfeld-Text gibt nur Rueckenwind. Dieselben
// Ketten messen hinterher, wie genau die erkannte Geometrie liegt.

import { StreckenIndex, lot } from './streckenIndex'
import type { VektorText, VektorZeichnung } from './vektor'

/** Uebliche Massstaebe in Bauplaenen. */
export const MASSSTAEBE = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000, 1250, 2000, 2500, 5000]

export interface Masskette {
  /** Masszahl in Metern. */
  wertM: number
  text: string
  /** Gezeichnete Laenge in Zeichnungseinheiten. */
  laenge: number
  /** Enden der gemessenen Strecke in Zeichnungseinheiten. */
  a: { x: number; y: number }
  b: { x: number; y: number }
}

export interface PlanMassstab {
  /** Meter je Zeichnungseinheit. */
  meterJeEinheit: number
  /** 1:N, wenn die Zeichnung auf Papier liegt (PDF). */
  massstab?: number
  quelle: 'dimensions' | 'text' | 'dxf' | 'assumed'
  /** Schriftfeld-Angabe, falls gefunden. */
  textMassstab?: number
  /** Ketten, die zum Massstab passen / alle gelesenen. */
  passend: number
  gelesen: number
  /** Abweichung der passenden Ketten in Metern. */
  fehlerMedianM?: number
  fehler95M?: number
  ketten: Masskette[]
}

/**
 * Masszahl lesen: „3,60" (m), „24" (cm), „1,01" (m), „2,135" (m). Mit
 * Vorzeichen sind es Hoehenkoten, keine Masse — die zaehlen nicht.
 */
export function masszahl(text: string): number[] {
  const s = text.trim().replace(/\s+/g, '')
  if (/^\d{1,3},\d{2,3}$/.test(s)) return [Number(s.replace(',', '.'))]
  if (/^\d{1,3}\.\d{2}$/.test(s)) return [Number(s)]
  if (/^\d{1,3}$/.test(s)) {
    const n = Number(s)
    return n > 0 ? [n / 100] : []
  }
  // Millimeter (DXF/Werkplan): „3600"
  if (/^\d{4,5}$/.test(s)) return [Number(s) / 1000]
  return []
}

/** „M 1:200", „Grundriss 1:100", „1 : 50". */
export function textMassstaebe(texte: readonly VektorText[]): number[] {
  const out: number[] = []
  for (const t of texte) {
    for (const m of t.text.matchAll(/(?:^|[^\d.,])1\s*:\s*(\d{1,4})(?![\d.,])/g)) {
      const n = Number(m[1])
      if (MASSSTAEBE.includes(n)) out.push(n)
    }
  }
  return out
}

/** Mitte und Richtung eines Texts. */
function textAchse(t: VektorText) {
  const w = (t.winkel * Math.PI) / 180
  const ux = Math.cos(w)
  const uy = Math.sin(w)
  // „oben" des Texts im y-nach-unten-System
  const nx = uy
  const ny = -ux
  const laenge = t.laenge ?? t.hoehe * 0.6 * t.text.length
  return {
    cx: t.x + ux * (laenge / 2) + nx * (t.hoehe / 2),
    cy: t.y + uy * (laenge / 2) + ny * (t.hoehe / 2),
    ux,
    uy,
    nx,
    ny,
    laenge,
  }
}

/**
 * Zu einem Masstext die bemasste Strecke finden: die parallele Linie direkt
 * unter dem Text, und auf ihr die naechsten Marken links und rechts der
 * Textmitte (Masshilfslinien, Schraegstriche, Kettenenden).
 */
export function masskette(t: VektorText, idx: StreckenIndex): Omit<Masskette, 'wertM' | 'text'> | null {
  const ax = textAchse(t)
  const h = t.hoehe
  const such = Math.max(ax.laenge, h) * 1.5 + h * 3
  const kand = idx.imRahmen(ax.cx - such, ax.cy - such, ax.cx + such, ax.cy + such)
  const k = idx.k
  // 1) Masslinie: parallel, unter dem Text (Abstand 0..1,8 h), Mitte innen.
  let best = -1
  let bestD = Infinity
  for (const s of kand) {
    const x1 = k[s * 4], y1 = k[s * 4 + 1], x2 = k[s * 4 + 2], y2 = k[s * 4 + 3]
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (len < ax.laenge * 0.5) continue
    const dx = (x2 - x1) / len
    const dy = (y2 - y1) / len
    if (Math.abs(dx * ax.uy - dy * ax.ux) > 0.02) continue
    // Abstand in Richtung „unten" des Texts
    const d = (ax.cx - x1) * ax.nx + (ax.cy - y1) * ax.ny
    if (d < h * 0.3 || d > h * 1.8) continue
    const t0 = (ax.cx - x1) * dx + (ax.cy - y1) * dy
    if (t0 < h * 0.2 || t0 > len - h * 0.2) continue
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  if (best < 0) return null
  const lx1 = k[best * 4], ly1 = k[best * 4 + 1], lx2 = k[best * 4 + 2], ly2 = k[best * 4 + 3]
  const llen = Math.hypot(lx2 - lx1, ly2 - ly1)
  const dx = (lx2 - lx1) / llen
  const dy = (ly2 - ly1) / llen
  const tc = (ax.cx - lx1) * dx + (ax.cy - ly1) * dy
  // 2) Marken auf der Masslinie sammeln (Parameter entlang der Linie).
  const marken: number[] = [0, llen]
  const tol = h * 0.35
  const nah = idx.imRahmen(Math.min(lx1, lx2) - tol, Math.min(ly1, ly2) - tol, Math.max(lx1, lx2) + tol, Math.max(ly1, ly2) + tol)
  for (const s of nah) {
    if (s === best) continue
    const x1 = k[s * 4], y1 = k[s * 4 + 1], x2 = k[s * 4 + 2], y2 = k[s * 4 + 3]
    const len = Math.hypot(x2 - x1, y2 - y1)
    if (len < 1e-9) continue
    const ex = (x2 - x1) / len
    const ey = (y2 - y1) / len
    const kreuz = ex * dy - ey * dx
    if (Math.abs(kreuz) < 0.05) {
      // kollinear: Kette aus Einzelstuecken — deren Enden sind Marken
      const d1 = Math.abs((x1 - lx1) * dy - (y1 - ly1) * dx)
      if (d1 > tol * 0.3) continue
      marken.push((x1 - lx1) * dx + (y1 - ly1) * dy, (x2 - lx1) * dx + (y2 - ly1) * dy)
      continue
    }
    // Schnitt der Geraden mit der Masslinie
    const u = ((x1 - lx1) * ey - (y1 - ly1) * ex) / (dx * ey - dy * ex)
    const p = lot(lx1 + dx * u, ly1 + dy * u, x1, y1, x2, y2)
    if (p.d > tol) continue
    if (u < -tol || u > llen + tol) continue
    marken.push(u)
  }
  let links = -Infinity
  let rechts = Infinity
  for (const m of marken) {
    if (m < tc - 1e-9 && m > links) links = m
    if (m > tc + 1e-9 && m < rechts) rechts = m
  }
  if (!Number.isFinite(links) || !Number.isFinite(rechts)) return null
  return {
    laenge: rechts - links,
    a: { x: lx1 + dx * links, y: ly1 + dy * links },
    b: { x: lx1 + dx * rechts, y: ly1 + dy * rechts },
  }
}

const median = (v: number[]) => {
  if (!v.length) return undefined
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}
const quantil = (v: number[], q: number) => {
  if (!v.length) return undefined
  const s = [...v].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}

/** Toleranz einer Stimme: 1,5 % plus ein halber Zentimeter (Rundung). */
const passt = (wert: number, gemessenM: number) => Math.abs(gemessenM - wert) <= 0.015 * wert + 0.006

/**
 * Massstab einer Vektorzeichnung bestimmen. `index` darf von aussen kommen
 * (die Wanderkennung braucht denselben).
 */
export function massstabErkennen(z: VektorZeichnung, index?: StreckenIndex): PlanMassstab {
  const idx = index ?? new StreckenIndex(z.pfade, (p) => p.gezogen, Math.max(z.breite, z.hoehe) / 1500, z.breite)
  const textM = textMassstaebe(z.texte)
  const textHaeufig = textM.length ? Number(Object.entries(textM.reduce<Record<number, number>>((h, n) => ((h[n] = (h[n] ?? 0) + 1), h), {})).sort((a, b) => b[1] - a[1])[0][0]) : undefined

  const roh: { werte: number[]; text: string; k: Omit<Masskette, 'wertM' | 'text'> }[] = []
  for (const t of z.texte) {
    const werte = masszahl(t.text)
    if (!werte.length) continue
    const k = masskette(t, idx)
    if (k && k.laenge > 0) roh.push({ werte, text: t.text, k })
  }

  // DXF ohne $INSUNITS: die uebliche Einheit raten und von den Masszahlen bestaetigen lassen.
  const dxfOhneEinheit = z.quelle === 'dxf' && !z.meterJeEinheit
  const dxfVorgabe = Math.max(z.breite, z.hoehe) > 2000 ? 0.001 : 1
  const kandidaten: { mje: number; massstab?: number }[] = z.meterJeEinheit
    ? [{ mje: z.meterJeEinheit }]
    : dxfOhneEinheit
      ? [dxfVorgabe, 0.001, 0.01, 1, 0.0254, 0.3048].map((mje) => ({ mje }))
      : MASSSTAEBE.map((n) => ({ mje: n / 1000, massstab: n }))
  let bester = kandidaten[0]
  let besteStimmen = -1
  for (const kd of kandidaten) {
    let stimmen = 0
    for (const r of roh) if (r.werte.some((w) => passt(w, r.k.laenge * kd.mje))) stimmen++
    if (kd.massstab && kd.massstab === textHaeufig) stimmen += 0.5
    if (stimmen > besteStimmen) {
      besteStimmen = stimmen
      bester = kd
    }
  }
  const ketten: Masskette[] = []
  const fehler: number[] = []
  for (const r of roh) {
    const gem = r.k.laenge * bester.mje
    const w = r.werte.find((v) => passt(v, gem))
    if (w === undefined) continue
    ketten.push({ ...r.k, wertM: w, text: r.text })
    fehler.push(Math.abs(gem - w))
  }
  const passend = ketten.length
  let quelle: PlanMassstab['quelle'] = z.quelle === 'dxf' ? 'dxf' : 'dimensions'
  let mje = bester.mje
  let massstab = bester.massstab
  if (dxfOhneEinheit && passend < 3) {
    mje = dxfVorgabe
    quelle = 'assumed'
  } else if (!z.meterJeEinheit && passend < 3 && !(passend > 0 && (!textHaeufig || textHaeufig === bester.massstab))) {
    // Wenige Ketten, die dem Schriftfeld widersprechen, oder gar keine:
    // dann gilt das Schriftfeld, sonst die uebliche Annahme 1:100.
    if (textHaeufig) {
      quelle = 'text'
      mje = textHaeufig / 1000
      massstab = textHaeufig
    } else {
      quelle = 'assumed'
      mje = 0.1
      massstab = 100
    }
  }
  return {
    meterJeEinheit: mje,
    massstab,
    quelle,
    textMassstab: textHaeufig,
    passend,
    gelesen: roh.length,
    fehlerMedianM: median(fehler),
    fehler95M: quantil(fehler, 0.95),
    ketten,
  }
}
