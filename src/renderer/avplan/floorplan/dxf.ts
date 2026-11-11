// @avplan/floorplan — DXF (ASCII) als Vektorzeichnung lesen.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// WARUM DXF UND NICHT DWG. DWG ist ein geschlossenes Binaerformat. Die
// freie Bibliothek dafuer (LibreDWG) steht unter GPL-3.0 — in diese
// proprietaeren Planer darf sie nicht hinein. DXF schreibt jedes CAD-Programm
// (AutoCAD, BricsCAD, ArchiCAD, Revit, Vectorworks, der kostenlose ODA File
// Converter), und es ist Text: hier genuegt ein kleiner Leser.
//
// Gelesen wird, was ein Grundriss braucht: LINE, LWPOLYLINE, POLYLINE,
// ARC, CIRCLE, SOLID, HATCH (Rand), TEXT, MTEXT, INSERT (Bloecke, auch
// verschachtelt) und DIMENSION (ueber ihren Anzeigeblock — so kommen
// Masslinien und Masszahlen wie gezeichnet an). Layer werden zur `ebene`.

import type { PlanPunkt } from './typen'
import type { VektorPfad, VektorText, VektorZeichnung } from './vektor'

type Paar = [number, string]
type Matrix = [number, number, number, number, number, number]

/** $INSUNITS → Meter je Einheit. 0 = ohne Einheit (wird aus Massen erraten). */
const EINHEITEN: Record<number, number> = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1, 14: 0.1 }

interface Entitaet {
  typ: string
  p: Paar[]
}

const BOGEN_SCHRITT = Math.PI / 16

function paareLesen(text: string): Paar[] {
  const z = text.split(/\r?\n/)
  const out: Paar[] = []
  for (let i = 0; i + 1 < z.length; i += 2) {
    const c = Number(z[i].trim())
    if (!Number.isFinite(c)) {
      i -= 1 // aus dem Takt: eine Zeile weiter versuchen
      continue
    }
    out.push([c, z[i + 1]])
  }
  return out
}

const zahl = (e: Entitaet, code: number, vorgabe = 0): number => {
  const p = e.p.find((q) => q[0] === code)
  const n = p ? Number(p[1]) : NaN
  return Number.isFinite(n) ? n : vorgabe
}
const wort = (e: Entitaet, code: number): string | undefined => e.p.find((q) => q[0] === code)?.[1].trim()

/** Entitaeten zwischen Start und Ende in Gruppen zerlegen. */
function entitaeten(paare: Paar[], von: number, bis: number): Entitaet[] {
  const out: Entitaet[] = []
  let akt: Entitaet | null = null
  for (let i = von; i < bis; i++) {
    const [c, v] = paare[i]
    if (c === 0) {
      akt = { typ: v.trim(), p: [] }
      out.push(akt)
    } else if (akt) akt.p.push([c, v])
  }
  return out
}

const mal = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]
const an = (m: Matrix, x: number, y: number): PlanPunkt => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] })

/** Bogen um (cx,cy) von a0 bis a1 (Grad, gegen den Uhrzeigersinn). */
function bogen(cx: number, cy: number, r: number, a0: number, a1: number): { x: number; y: number }[] {
  const s = (a0 * Math.PI) / 180
  let e = (a1 * Math.PI) / 180
  while (e <= s) e += Math.PI * 2
  const n = Math.max(2, Math.ceil((e - s) / BOGEN_SCHRITT))
  const out = []
  for (let i = 0; i <= n; i++) {
    const w = s + ((e - s) * i) / n
    out.push({ x: cx + r * Math.cos(w), y: cy + r * Math.sin(w) })
  }
  return out
}

/** Bulge (Polylinien-Bogen) zwischen zwei Punkten in Zwischenpunkte zerlegen. */
function bulgePunkte(a: { x: number; y: number }, b: { x: number; y: number }, bulge: number): { x: number; y: number }[] {
  if (!bulge) return []
  const w = 4 * Math.atan(bulge)
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  const r = d / (2 * Math.sin(w / 2))
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const h = r * Math.cos(w / 2)
  const nx = -(b.y - a.y) / d
  const ny = (b.x - a.x) / d
  const cx = mx + nx * h
  const cy = my + ny * h
  const a0 = Math.atan2(a.y - cy, a.x - cx)
  const n = Math.max(2, Math.ceil(Math.abs(w) / BOGEN_SCHRITT))
  const out = []
  for (let i = 1; i < n; i++) {
    const t = a0 + (w * i) / n
    out.push({ x: cx + Math.abs(r) * Math.cos(t), y: cy + Math.abs(r) * Math.sin(t) })
  }
  return out
}

/** ACI 7 (schwarz/weiss) und Grautoene gelten als Poché, Farben nicht. */
function fuellFarbe(aci: number, ebene: string): string {
  if (/wand|wände|wall|mauer|stütz|column|beton/i.test(ebene)) return '#000000'
  if (aci === 0 || aci === 256 || aci === 7 || aci === 8 || (aci >= 250 && aci <= 255)) return '#000000'
  return '#b4c6dc'
}

export class DxfFehler extends Error {}

export function dxfLesen(text: string): VektorZeichnung {
  const paare = paareLesen(text)
  if (!paare.some(([c, v]) => c === 0 && v.trim() === 'SECTION')) throw new DxfFehler('Keine DXF-Datei (ASCII) — binaere DXF und DWG werden nicht gelesen.')
  // Abschnitte finden
  const abschnitte = new Map<string, [number, number]>()
  for (let i = 0; i < paare.length; i++) {
    if (paare[i][0] === 0 && paare[i][1].trim() === 'SECTION' && paare[i + 1]?.[0] === 2) {
      const name = paare[i + 1][1].trim()
      let j = i + 2
      while (j < paare.length && !(paare[j][0] === 0 && paare[j][1].trim() === 'ENDSEC')) j++
      abschnitte.set(name, [i + 2, j])
      i = j
    }
  }
  // Einheit
  let meterJeEinheit: number | undefined
  const kopf = abschnitte.get('HEADER')
  if (kopf) {
    for (let i = kopf[0]; i < kopf[1]; i++) {
      if (paare[i][0] === 9 && paare[i][1].trim() === '$INSUNITS') {
        meterJeEinheit = EINHEITEN[Number(paare[i + 1]?.[1])]
      }
    }
  }
  // Bloecke
  const bloecke = new Map<string, Entitaet[]>()
  const bl = abschnitte.get('BLOCKS')
  if (bl) {
    const alle = entitaeten(paare, bl[0], bl[1])
    let name: string | null = null
    let liste: Entitaet[] = []
    for (const e of alle) {
      if (e.typ === 'BLOCK') {
        name = wort(e, 2) ?? null
        liste = []
      } else if (e.typ === 'ENDBLK') {
        if (name) bloecke.set(name, liste)
        name = null
      } else if (name) liste.push(e)
    }
  }
  const ent = abschnitte.get('ENTITIES')
  const haupt = ent ? entitaeten(paare, ent[0], ent[1]) : []

  const pfade: VektorPfad[] = []
  const texte: VektorText[] = []
  // DXF: y nach oben. Spiegeln, damit die Zeichnung wie im Plan liegt.
  const basis: Matrix = [1, 0, 0, -1, 0, 0]

  const linie = (pts: PlanPunkt[], zu: boolean, ebene: string, kurve = false, gefuellt = false, farbe?: string) => {
    if (pts.length < 2) return
    pfade.push({ teile: [pts], zu: [zu], kurve, gefuellt, gezogen: !gefuellt, breite: 0, ebene, fuellfarbe: gefuellt ? farbe : undefined, strichfarbe: gefuellt ? undefined : '#000000' })
  }

  const zeichne = (liste: Entitaet[], m: Matrix, tiefe: number, erbEbene?: string) => {
    if (tiefe > 8) return
    for (let k = 0; k < liste.length; k++) {
      const e = liste[k]
      const ebeneRoh = wort(e, 8) ?? '0'
      const ebene = ebeneRoh === '0' && erbEbene ? erbEbene : ebeneRoh
      switch (e.typ) {
        case 'LINE':
          linie([an(m, zahl(e, 10), zahl(e, 20)), an(m, zahl(e, 11), zahl(e, 21))], false, ebene)
          break
        case 'LWPOLYLINE': {
          const roh: { x: number; y: number; b: number }[] = []
          for (const [c, v] of e.p) {
            if (c === 10) roh.push({ x: Number(v), y: 0, b: 0 })
            else if (c === 20 && roh.length) roh[roh.length - 1].y = Number(v)
            else if (c === 42 && roh.length) roh[roh.length - 1].b = Number(v)
          }
          const zu = (zahl(e, 70) & 1) === 1
          const pts: { x: number; y: number }[] = []
          let kurve = false
          roh.forEach((p, i) => {
            pts.push(p)
            const n = roh[i + 1] ?? (zu ? roh[0] : undefined)
            if (n && p.b) {
              kurve = true
              pts.push(...bulgePunkte(p, n, p.b))
            }
          })
          linie(pts.map((p) => an(m, p.x, p.y)), zu, ebene, kurve)
          break
        }
        case 'POLYLINE': {
          const zu = (zahl(e, 70) & 1) === 1
          const pts: { x: number; y: number }[] = []
          let kurve = false
          let j = k + 1
          const vert: { x: number; y: number; b: number }[] = []
          for (; j < liste.length && liste[j].typ === 'VERTEX'; j++) vert.push({ x: zahl(liste[j], 10), y: zahl(liste[j], 20), b: zahl(liste[j], 42) })
          if (liste[j]?.typ === 'SEQEND') k = j
          else k = j - 1
          vert.forEach((p, i) => {
            pts.push(p)
            const n = vert[i + 1] ?? (zu ? vert[0] : undefined)
            if (n && p.b) {
              kurve = true
              pts.push(...bulgePunkte(p, n, p.b))
            }
          })
          linie(pts.map((p) => an(m, p.x, p.y)), zu, ebene, kurve)
          break
        }
        case 'ARC':
          linie(bogen(zahl(e, 10), zahl(e, 20), zahl(e, 40), zahl(e, 50), zahl(e, 51)).map((p) => an(m, p.x, p.y)), false, ebene, true)
          break
        case 'CIRCLE': {
          const pts = bogen(zahl(e, 10), zahl(e, 20), zahl(e, 40), 0, 360)
          pts.pop()
          linie(pts.map((p) => an(m, p.x, p.y)), true, ebene, true)
          break
        }
        case 'SOLID': {
          const ecken = [[10, 20], [11, 21], [13, 23], [12, 22]].map(([a, b]) => an(m, zahl(e, a), zahl(e, b)))
          linie(ecken, true, ebene, false, true, fuellFarbe(zahl(e, 62, 256), ebene))
          break
        }
        case 'HATCH': {
          const voll = zahl(e, 70) === 1
          const ringe = hatchRaender(e).map((r) => r.map((p) => an(m, p.x, p.y)))
          if (!ringe.length) break
          pfade.push({
            teile: ringe,
            zu: ringe.map(() => true),
            kurve: false,
            gefuellt: true,
            gezogen: false,
            breite: 0,
            ebene,
            fuellfarbe: voll ? fuellFarbe(zahl(e, 62, 256), ebene) : undefined,
          })
          break
        }
        case 'TEXT':
        case 'MTEXT': {
          let s = e.p.filter(([c]) => c === 3).map(([, v]) => v).join('') + (wort(e, 1) ?? '')
          if (e.typ === 'MTEXT') s = mtextBereinigen(s)
          if (!s.trim()) break
          const p = an(m, zahl(e, 10), zahl(e, 20))
          let w = zahl(e, 50)
          if (e.typ === 'MTEXT' && e.p.some(([c]) => c === 11)) w = (Math.atan2(zahl(e, 21), zahl(e, 11)) * 180) / Math.PI
          const sk = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]))
          const h = zahl(e, 40, 1) * sk
          // Winkel im gespiegelten System: gegen den Uhrzeigersinn → mit
          const wm = (Math.atan2(m[1] * Math.cos((w * Math.PI) / 180) + m[3] * Math.sin((w * Math.PI) / 180), m[0] * Math.cos((w * Math.PI) / 180) + m[2] * Math.sin((w * Math.PI) / 180)) * 180) / Math.PI
          // MTEXT haengt am oberen Rand (Anhang 1–3); auf die Grundlinie schieben.
          const anhang = e.typ === 'MTEXT' ? zahl(e, 71, 1) : 0
          const unten = anhang >= 1 && anhang <= 3 ? h : anhang >= 4 && anhang <= 6 ? h / 2 : 0
          const ux = Math.cos((wm * Math.PI) / 180)
          const uy = Math.sin((wm * Math.PI) / 180)
          const laenge = s.length * h * 0.6
          const zent = e.typ === 'MTEXT' ? (anhang % 3 === 2 ? laenge / 2 : anhang % 3 === 0 && anhang ? laenge : 0) : zahl(e, 72) === 1 || zahl(e, 72) === 4 ? laenge / 2 : zahl(e, 72) === 2 ? laenge : 0
          texte.push({ text: s, x: p.x - ux * zent - uy * unten, y: p.y - uy * zent + ux * unten, hoehe: h, laenge, winkel: wm })
          break
        }
        case 'INSERT':
        case 'DIMENSION': {
          const name = wort(e, 2)
          const b = name ? bloecke.get(name) : undefined
          if (!b) break
          if (e.typ === 'DIMENSION') {
            zeichne(b, m, tiefe + 1, ebene)
            break
          }
          const w = (zahl(e, 50) * Math.PI) / 180
          const sx = zahl(e, 41, 1)
          const sy = zahl(e, 42, 1)
          const t: Matrix = [Math.cos(w) * sx, Math.sin(w) * sx, -Math.sin(w) * sy, Math.cos(w) * sy, zahl(e, 10), zahl(e, 20)]
          zeichne(b, mal(m, t), tiefe + 1, ebene)
          break
        }
      }
    }
  }
  zeichne(haupt, basis, 0)

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const nimm = (p: PlanPunkt) => {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  for (const p of pfade) for (const t of p.teile) for (const q of t) nimm(q)
  if (!Number.isFinite(minX)) throw new DxfFehler('Die DXF-Datei enthaelt keine lesbare Geometrie.')
  return { quelle: 'dxf', breite: maxX - minX, hoehe: maxY - minY, minX, minY, pfade, texte, meterJeEinheit }
}

/** Formatcodes aus MTEXT entfernen: \P, {\fArial|b0;…}, \H2.5x; … */
export function mtextBereinigen(s: string): string {
  return s
    .replace(/\\P/g, ' ')
    .replace(/\\[ACcFfHhQqTtWw][^;\\{}]*;/g, '')
    .replace(/\\S([^;]*);/g, (_, x: string) => x.replace(/[#^]/g, '/'))
    .replace(/\\[LlOoKk]/g, '')
    .replace(/[{}]/g, '')
    .replace(/%%[cC]/g, 'Ø')
    .replace(/%%[dD]/g, '°')
    .replace(/%%[pP]/g, '±')
    .trim()
}

/** Raender einer HATCH als Ringe (Polylinien- und Kantenform). */
function hatchRaender(e: Entitaet): { x: number; y: number }[][] {
  const p = e.p
  const out: { x: number; y: number }[][] = []
  let i = p.findIndex(([c]) => c === 91)
  if (i < 0) return out
  const anzahl = Number(p[i][1])
  i++
  for (let r = 0; r < anzahl && i < p.length; r++) {
    while (i < p.length && p[i][0] !== 92) i++
    if (i >= p.length) break
    const flags = Number(p[i][1])
    i++
    const ring: { x: number; y: number }[] = []
    if (flags & 2) {
      // Polylinie: 72 bulge?, 73 zu, 93 Anzahl, dann 10/20(/42)
      let bulge = false
      let n = 0
      while (i < p.length && p[i][0] !== 10) {
        if (p[i][0] === 72) bulge = p[i][1].trim() !== '0'
        if (p[i][0] === 93) n = Number(p[i][1])
        i++
      }
      const roh: { x: number; y: number; b: number }[] = []
      for (let v = 0; v < n && i < p.length; v++) {
        const x = Number(p[i++][1])
        const y = Number(p[i++][1])
        let b = 0
        if (bulge && p[i]?.[0] === 42) b = Number(p[i++][1])
        roh.push({ x, y, b })
      }
      roh.forEach((q, k) => {
        ring.push(q)
        const nx = roh[(k + 1) % roh.length]
        if (q.b) ring.push(...bulgePunkte(q, nx, q.b))
      })
    } else {
      // Kanten: 93 Anzahl, je 72 Typ
      while (i < p.length && p[i][0] !== 93) i++
      const n = Number(p[i++]?.[1] ?? 0)
      for (let k = 0; k < n && i < p.length; k++) {
        while (i < p.length && p[i][0] !== 72) i++
        const typ = Number(p[i++]?.[1])
        const werte = new Map<number, number>()
        while (i < p.length && ![72, 92, 97, 75].includes(p[i][0])) {
          werte.set(p[i][0], Number(p[i][1]))
          i++
          if (typ === 1 && werte.has(21)) break
          if (typ === 2 && werte.has(73)) break
          if (typ === 3 && werte.has(73)) break
        }
        if (typ === 1) ring.push({ x: werte.get(10) ?? 0, y: werte.get(20) ?? 0 }, { x: werte.get(11) ?? 0, y: werte.get(21) ?? 0 })
        else if (typ === 2) {
          const ccw = (werte.get(73) ?? 1) !== 0
          const a0 = werte.get(50) ?? 0
          const a1 = werte.get(51) ?? 360
          const cy = werte.get(20) ?? 0
          const pts = bogen(werte.get(10) ?? 0, cy, werte.get(40) ?? 0, a0, a1)
          // im Uhrzeigersinn: Winkel sind gespiegelt angegeben
          ring.push(...(ccw ? pts : pts.map((q) => ({ x: q.x, y: 2 * cy - q.y }))))
        }
      }
    }
    // doppelte Folgepunkte entfernen
    const sauber = ring.filter((q, k) => k === 0 || Math.hypot(q.x - ring[k - 1].x, q.y - ring[k - 1].y) > 1e-9)
    if (sauber.length >= 3) out.push(sauber)
    // Quellobjekt-Verweise ueberspringen
    while (i < p.length && p[i][0] === 97) {
      const n = Number(p[i][1])
      i += 1 + n
    }
  }
  return out
}
