// @avplan/floorplan — Vektorpfade und Texte einer PDF-Seite lesen.
// Quelle aller Planer-Kopien (ADR-015). Nicht in der Kopie aendern.
//
// WARUM DIE OPERATORLISTE. Ein CAD-Export (ArchiCAD, Revit, AutoCAD) traegt
// jede Wand als gefuelltes Polygon und jede Masslinie als Strecke in
// Papier-Millimetern. Aus dem gerenderten Bild muesste man das zurueckraten;
// aus der Operatorliste liest man es exakt ab. pdf.js liefert die Liste
// ohnehin — es zeichnet sie sonst nur auf ein Canvas.
//
// pdf.js bleibt optional (wie beim Seiten-Renderer): der Planer reicht das
// geladene Modul herein. Hier steht nur der Teil der Schnittstelle, der
// gebraucht wird. Format der Pfade ab pdf.js 5: `constructPath` traegt
// [Zeichen-Op, [Float32Array mit DrawOPS + Koordinaten], minMax].

import type { PlanPunkt } from './typen'
import type { VektorPfad, VektorText, VektorZeichnung } from './vektor'

type Matrix = [number, number, number, number, number, number]

export interface PdfVektorSeite {
  view: number[]
  /** pdf.js: Abbildung PDF-Raum → Bild, mit /Rotate und Seitenrahmen.
   *  Dieselbe, mit der der Seiten-Renderer das Planbild zeichnet. */
  getViewport?(o: { scale: number }): { width: number; height: number; transform: number[] }
  getOperatorList(): Promise<{ fnArray: ArrayLike<number>; argsArray: unknown[] }>
  getTextContent(o?: { includeMarkedContent?: boolean }): Promise<{ items: unknown[] }>
}

export interface PdfVektorModul {
  OPS: Record<string, number>
  getDocument: (src: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number
      getPage: (n: number) => Promise<PdfVektorSeite>
      getOptionalContentConfig?: () => Promise<Iterable<[string, { name?: string | null }]>>
      destroy?: () => unknown
    }>
  }
}

const MM_JE_PT = 25.4 / 72
/** Punkte je Kurvenstueck. Ein Tuerschwenk mit 8 Stuecken weicht bei 1 m
 *  Radius um unter 2 mm vom Bogen ab. */
const KURVEN_SCHRITTE = 8

const mal = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

/** Die Zeichen-Ops, die eine Flaeche fuellen bzw. eine Linie ziehen. */
function zeichenArt(OPS: Record<string, number>) {
  const fuellt = new Set(['fill', 'eoFill', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'].map((n) => OPS[n]))
  const zieht = new Set(['stroke', 'closeStroke', 'fillStroke', 'eoFillStroke', 'closeFillStroke', 'closeEOFillStroke'].map((n) => OPS[n]))
  const schliesst = new Set(['closeStroke', 'closeFillStroke', 'closeEOFillStroke'].map((n) => OPS[n]))
  return { fuellt, zieht, schliesst }
}

const hex = (v: unknown): string | undefined => {
  if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
  return undefined
}

/**
 * Liest eine PDF-Seite als Vektorzeichnung in Papier-Millimetern, y nach
 * unten. `seite` beginnt bei 0. Ebenen (Optional Content) kommen als
 * `ebene` an den Pfad, wenn der Export sie traegt — ArchiCAD schreibt dort
 * seine Ebenen hinein („Wände neu", „Bemaßung").
 */
export interface PdfVektorOptionen {
  /**
   * Ebenen, deren Pfade nicht gebraucht werden (Einrichtung, Kuechentechnik,
   * Fremd-Importe). Texte und alles ohne Ebene bleiben. Spart auf einem
   * A0-Blatt die Mehrzahl der Pfade — dort liegen 600 000 Haarlinien in der
   * Kuecheneinrichtung und keine einzige Wand.
   */
  ebeneAuslassen?: (name: string) => boolean
}

export async function pdfVektorLesen(
  pdfjs: PdfVektorModul,
  daten: Uint8Array,
  seite = 0,
  o: PdfVektorOptionen = {},
): Promise<VektorZeichnung & { seiten: number }> {
  const doc = await pdfjs.getDocument({ data: daten }).promise
  try {
    const nr = Math.min(Math.max(0, seite), doc.numPages - 1) + 1
    const page = await doc.getPage(nr)
    const ebenenNamen = new Map<string, string>()
    try {
      const oc = await doc.getOptionalContentConfig?.()
      if (oc) for (const [id, g] of oc) if (g?.name) ebenenNamen.set(id, g.name)
    } catch {
      /* ohne Ebenen geht es auch */
    }
    const { basis, breite, hoehe } = seitenBasis(page)
    const ol = await page.getOperatorList()
    const pfade = operatorListeLesen(pdfjs.OPS, ol, basis, ebenenNamen, o.ebeneAuslassen)
    const texte = textInhaltLesen((await page.getTextContent()).items, basis)
    return {
      quelle: 'pdf',
      breite,
      hoehe,
      pfade,
      texte,
      seiten: doc.numPages,
    }
  } finally {
    doc.destroy?.()
  }
}

/**
 * PDF-Raum (y nach oben, pt) → Papier-mm, y nach unten — so, wie die Seite
 * gerendert wird. Ein CAD-Export legt ein Querformat-Blatt oft hochkant an
 * und dreht es mit /Rotate; ohne die Drehung laegen die erkannten Waende
 * quer zum Planbild.
 */
export function seitenBasis(page: PdfVektorSeite): { basis: Matrix; breite: number; hoehe: number } {
  const v = page.getViewport?.({ scale: MM_JE_PT })
  if (v && v.transform?.length === 6) {
    return { basis: v.transform as Matrix, breite: v.width, hoehe: v.height }
  }
  const [x0, y0, x1, y1] = page.view
  return {
    basis: [MM_JE_PT, 0, 0, -MM_JE_PT, -x0 * MM_JE_PT, y1 * MM_JE_PT],
    breite: (x1 - x0) * MM_JE_PT,
    hoehe: (y1 - y0) * MM_JE_PT,
  }
}

/** Kern ohne pdf.js-Dokument — testbar mit einer handgebauten Liste. */
export function operatorListeLesen(
  OPS: Record<string, number>,
  ol: { fnArray: ArrayLike<number>; argsArray: unknown[] },
  basis: Matrix,
  ebenenNamen: Map<string, string> = new Map(),
  ebeneAuslassen?: (name: string) => boolean,
): VektorPfad[] {
  const art = zeichenArt(OPS)
  type Zustand = { ctm: Matrix; breite: number; fuell?: string; strich?: string }
  let z: Zustand = { ctm: basis, breite: 0 }
  const stapel: Zustand[] = []
  const ebenen: (string | null)[] = []
  /** Tiefe der uebersprungenen Ebenen; > 0 heisst: Pfade hier nicht lesen. */
  let auslassen = 0
  const pfade: VektorPfad[] = []

  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i]
    const a = ol.argsArray[i] as unknown[]
    switch (fn) {
      case OPS.save:
        stapel.push({ ...z })
        break
      case OPS.restore:
        z = stapel.pop() ?? z
        break
      case OPS.transform:
        z.ctm = mal(z.ctm, a as Matrix)
        break
      case OPS.paintFormXObjectBegin: {
        stapel.push({ ...z })
        const m = a?.[0]
        if (Array.isArray(m) || ArrayBuffer.isView(m)) z.ctm = mal(z.ctm, Array.from(m as ArrayLike<number>) as Matrix)
        break
      }
      case OPS.paintFormXObjectEnd:
        z = stapel.pop() ?? z
        break
      case OPS.setLineWidth:
        z.breite = Number(a[0]) || 0
        break
      case OPS.setStrokeRGBColor:
        z.strich = hex(a[0])
        break
      case OPS.setFillRGBColor:
        z.fuell = hex(a[0])
        break
      case OPS.beginMarkedContentProps: {
        const p = a[1] as { type?: string; id?: string } | undefined
        const name = a[0] === 'OC' && p?.id ? (ebenenNamen.get(p.id) ?? p.id) : null
        ebenen.push(name)
        if (name && ebeneAuslassen?.(name)) auslassen++
        break
      }
      case OPS.beginMarkedContent:
        ebenen.push(null)
        break
      case OPS.endMarkedContent: {
        const weg = ebenen.pop()
        if (weg && ebeneAuslassen?.(weg)) auslassen--
        break
      }
      case OPS.constructPath: {
        if (auslassen > 0) break
        const op = a[0] as number
        const fuellt = art.fuellt.has(op)
        const zieht = art.zieht.has(op)
        if (!fuellt && !zieht) break // reiner Clip-Pfad
        const roh = (a[1] as unknown[])?.[0]
        if (!roh || !(ArrayBuffer.isView(roh) || Array.isArray(roh))) break
        const p = pfadAus(roh as ArrayLike<number>, z.ctm, art.schliesst.has(op))
        if (!p) break
        const skala = Math.sqrt(Math.abs(z.ctm[0] * z.ctm[3] - z.ctm[1] * z.ctm[2]))
        let ebene: string | undefined
        for (let k = ebenen.length - 1; k >= 0; k--) {
          if (ebenen[k]) {
            ebene = ebenen[k] as string
            break
          }
        }
        pfade.push({
          ...p,
          gefuellt: fuellt,
          gezogen: zieht,
          breite: z.breite * skala,
          fuellfarbe: fuellt ? z.fuell : undefined,
          strichfarbe: zieht ? z.strich : undefined,
          ebene,
        })
        break
      }
    }
  }
  return pfade
}

/** DrawOPS: 0 moveTo, 1 lineTo, 2 curveTo, 3 quadraticCurveTo, 4 closePath. */
function pfadAus(d: ArrayLike<number>, m: Matrix, schliessen: boolean): Pick<VektorPfad, 'teile' | 'zu' | 'kurve'> | null {
  const teile: PlanPunkt[][] = []
  const zu: boolean[] = []
  let kurve = false
  let akt: PlanPunkt[] | null = null
  let lx = 0
  let ly = 0
  const t = (x: number, y: number): PlanPunkt => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] })
  const neu = () => {
    akt = []
    teile.push(akt)
    zu.push(false)
  }
  for (let i = 0; i < d.length; ) {
    const op = d[i++]
    if (op === 0) {
      neu()
      lx = d[i++]
      ly = d[i++]
      akt!.push(t(lx, ly))
    } else if (op === 1) {
      if (!akt) neu()
      lx = d[i++]
      ly = d[i++]
      akt!.push(t(lx, ly))
    } else if (op === 2 || op === 3) {
      if (!akt) neu()
      kurve = true
      const n = op === 2 ? 6 : 4
      const c = Array.from({ length: n }, (_, k) => d[i + k])
      i += n
      for (let s = 1; s <= KURVEN_SCHRITTE; s++) {
        const u = s / KURVEN_SCHRITTE
        const v = 1 - u
        let x: number
        let y: number
        if (op === 2) {
          x = v * v * v * lx + 3 * v * v * u * c[0] + 3 * v * u * u * c[2] + u * u * u * c[4]
          y = v * v * v * ly + 3 * v * v * u * c[1] + 3 * v * u * u * c[3] + u * u * u * c[5]
        } else {
          x = v * v * lx + 2 * v * u * c[0] + u * u * c[2]
          y = v * v * ly + 2 * v * u * c[1] + u * u * c[3]
        }
        akt!.push(t(x, y))
      }
      lx = c[n - 2]
      ly = c[n - 1]
    } else if (op === 4) {
      if (akt) zu[zu.length - 1] = true
      akt = null
    } else {
      return null // unbekanntes Format: lieber nichts als Unsinn
    }
  }
  if (schliessen) zu.fill(true)
  for (let k = 0; k < teile.length; k++) {
    const r = teile[k]
    if (r.length > 2) {
      const a = r[0]
      const b = r[r.length - 1]
      if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) {
        r.pop()
        zu[k] = true
      }
    }
  }
  const gut = teile.map((r, k) => [r, zu[k]] as const).filter(([r]) => r.length >= 2)
  if (!gut.length) return null
  return { teile: gut.map(([r]) => r), zu: gut.map(([, z]) => z), kurve }
}

type TextItem = { str?: string; transform?: number[]; width?: number; height?: number }

/** Textinhalt (pdf.js) → Texte in Papier-mm. pdf.js gibt die Matrix im
 *  PDF-Raum der Seite; `basis` bringt sie in mm, y nach unten. */
export function textInhaltLesen(items: unknown[], basis: Matrix): VektorText[] {
  const out: VektorText[] = []
  for (const roh of items) {
    const it = roh as TextItem
    if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) continue
    const [a, b, c, d, e, f] = it.transform
    const x = basis[0] * e + basis[2] * f + basis[4]
    const y = basis[1] * e + basis[3] * f + basis[5]
    const hoehePt = Math.hypot(c, d) || Math.abs(it.height ?? 0)
    // Leserichtung durch die Basis: die spiegelt y und dreht mit /Rotate.
    const winkel = (Math.atan2(basis[1] * a + basis[3] * b, basis[0] * a + basis[2] * b) * 180) / Math.PI
    out.push({
      text: it.str,
      x,
      y,
      hoehe: hoehePt * MM_JE_PT,
      laenge: it.width ? it.width * MM_JE_PT : undefined,
      winkel,
    })
  }
  return out
}
