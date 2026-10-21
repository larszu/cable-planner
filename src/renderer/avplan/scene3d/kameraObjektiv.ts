// Objektive ohne Modelldatei: Drehkoerper aus einem Profil, dazu Zahnkraenze,
// Skalenringe, Servogriff bzw. Gehaeuse. Ursprung ist die Mitte des Bajonetts
// (Auflageflaeche), die Optik zeigt nach +x.
//
// Laenge und Durchmesser folgen grob der Brennweite. Die Faustformeln sind an
// gaengigen Baureihen abgelesen (Cine-Festbrennweiten mit 95-mm-Front,
// Cine-Zooms mit 114 mm, 2/3"-ENG-Zooms, 86-fach-Studio-Boxobjektive) — sie
// sollen im Bild stimmig wirken, nicht ein bestimmtes Modell nachbauen.
import * as THREE from 'three'
import type { Detail } from './mensch'
import { drehkoerperGeo, kastenGeo, knoten, teil, zahnringGeo, zylinderXGeo, type MaterialName } from './kameraBau'

export type ObjektivArt = 'cinePrime' | 'cineZoom' | 'foto' | 'eng' | 'box'

export interface ObjektivOptionen {
  art: ObjektivArt
  /** Brennweite, bei Zooms das lange Ende (mm). */
  brennweiteMm?: number
  /** Ueberschreibt die abgeleiteten Masse. */
  laengeM?: number
  durchmesserM?: number
  /** Gegenlichtblende (nur `foto`; Boxobjektive haben sie immer). */
  sonnenblende?: boolean
  detail?: Detail
}

export interface ObjektivMasse {
  /** Bajonett bis Vorderkante (bei Boxobjektiven inkl. Blende). */
  laengeM: number
  /** Groesster Aussendurchmesser bzw. Gehaeusebreite. */
  durchmesserM: number
  /** Unterkante relativ zur optischen Achse (negativ). */
  untenM: number
  obenM: number
  brennweiteMm: number
}

const STANDARD_BRENNWEITE: Record<ObjektivArt, number> = { cinePrime: 50, cineZoom: 70, foto: 35, eng: 140, box: 860 }

const klemme = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v))

export function objektivMasse(o: ObjektivOptionen): ObjektivMasse {
  const f = o.brennweiteMm && o.brennweiteMm > 0 ? o.brennweiteMm : STANDARD_BRENNWEITE[o.art]
  let l: number, dm: number, unten: number, oben: number
  switch (o.art) {
    case 'cinePrime':
      l = klemme(0.075 + 0.0009 * f, 0.085, 0.24)
      dm = f <= 18 ? 0.114 : 0.095
      break
    case 'cineZoom':
      l = klemme(0.14 + 0.0011 * f, 0.16, 0.45)
      dm = f > 150 ? 0.136 : 0.114
      break
    case 'foto':
      l = klemme(0.05 + 0.00055 * f, 0.055, 0.2)
      dm = klemme(0.064 + 0.0001 * f, 0.065, 0.095)
      if (o.sonnenblende !== false) l += 0.035 + dm * 0.15
      break
    case 'eng':
      l = klemme(0.17 + 0.0003 * f, 0.18, 0.28)
      dm = 0.1
      break
    case 'box':
      l = klemme(0.4 + 0.00022 * f, 0.42, 0.62) + 0.1
      dm = 0.24
      break
  }
  l = o.laengeM ?? l
  dm = o.durchmesserM ?? dm
  if (o.art === 'box') {
    unten = -0.115
    oben = 0.15
  } else {
    unten = -dm / 2
    oben = dm / 2
  }
  return { laengeM: l, durchmesserM: dm, untenM: unten, obenM: oben, brennweiteMm: f }
}

/** Gewoelbte Frontlinse als Kugelkappe; Scheitel bei x = 0. */
export function erzeugeFrontglas(r: number, d: Detail): THREE.Mesh {
  const wolbung = r * 0.22
  const n = d === 'hoch' ? 10 : 4
  const profil: Array<[number, number]> = []
  // Vom Rand zur Mitte: so zeigen die Lathe-Normalen nach vorn.
  for (let i = 0; i <= n; i++) {
    const t = ((i / n) * Math.PI) / 2
    profil.push([r * Math.cos(t), -wolbung * (1 - Math.sin(t))])
  }
  return teil(drehkoerperGeo('frontglas', profil, d), 'glas', 0, 0, 0, undefined, 'frontglas')
}

function ring(r: number, breite: number, x: number, mat: MaterialName, d: Detail): THREE.Mesh {
  return teil(zylinderXGeo(r, r, breite, d), mat, x)
}

function cineObjektiv(g: THREE.Group, m: ObjektivMasse, zoom: boolean, d: Detail): void {
  const l = m.laengeM
  const rf = m.durchmesserM / 2
  const rb = rf - (zoom ? 0.01 : 0.008)
  g.add(teil(drehkoerperGeo('pl', [[0.026, 0], [0.0315, 0], [0.0315, 0.011], [0.034, 0.011], [0.034, 0.015], [0.026, 0.015]], d), 'aluSilber'))
  g.add(teil(drehkoerperGeo('cine', [
    [0.026, 0.015], [0.036, 0.015], [rb - 0.004, 0.024], [rb, 0.03], [rb, l - 0.04], [rf - 0.002, l - 0.034],
    [rf, l - 0.03], [rf, l - 0.002], [rf - 0.002, l], [rf - 0.006, l], [rf - 0.007, l - 0.014], [rf - 0.012, l - 0.016],
  ], d), 'aluSchwarz'))
  const glas = erzeugeFrontglas(rf - 0.012, d)
  glas.position.x = l - 0.012
  g.add(glas)
  // Blende hinten, Fokus vorn, beim Zoom der Zoomring in der Mitte.
  const zr = rb + 0.003
  g.add(teil(zahnringGeo(zr, 0.012, d), 'aluSchwarz', 0.042))
  g.add(teil(zahnringGeo(zr, 0.02, d), 'aluSchwarz', l - (zoom ? 0.06 : 0.055)))
  if (zoom) g.add(teil(zahnringGeo(zr, 0.024, d), 'aluSchwarz', l * 0.5))
  if (d === 'hoch') {
    // Gravierte Skalen als helle Baender neben den Ringen.
    g.add(ring(rb + 0.0004, 0.004, 0.056, 'lack', d))
    g.add(ring(rb + 0.0004, 0.006, l - (zoom ? 0.078 : 0.072), 'lack', d))
    g.add(ring(rf + 0.0003, 0.0025, l - 0.012, 'aluSilber', d))
    if (zoom) {
      // Objektivstuetze auf den 15-mm-Stangen.
      g.add(teil(kastenGeo(0.03, rb - 0.03 + 0.04, 0.04, 0.004, d), 'aluSchwarz', l * 0.35, -rb - 0.005, 0))
    }
  }
}

function fotoObjektiv(g: THREE.Group, m: ObjektivMasse, blende: boolean, d: Detail): void {
  const rf = m.durchmesserM / 2
  const blendeL = blende ? 0.035 + m.durchmesserM * 0.15 : 0
  const l = m.laengeM - blendeL
  g.add(teil(drehkoerperGeo('e', [[0.022, 0], [0.0285, 0], [0.0285, 0.006], [0.03, 0.006]], d), 'aluSilber'))
  g.add(teil(drehkoerperGeo('fotokoerper', [
    [0.024, 0.006], [0.03, 0.006], [rf - 0.006, 0.014], [rf - 0.004, 0.02], [rf - 0.004, l - 0.01],
    [rf, l - 0.006], [rf, l], [rf - 0.004, l], [rf - 0.007, l - 0.006], [rf - 0.01, l - 0.007],
  ], d), 'kunststoff'))
  // Gummierter Zoom-/Fokusring: im hohen Detail geriffelt.
  const rr = rf - 0.002
  const ringB = Math.min(0.03, l * 0.35)
  if (d === 'hoch') {
    const rippen: Array<[number, number]> = [[rr - 0.003, 0]]
    const n = Math.round(ringB / 0.0024)
    for (let i = 0; i <= n; i++) rippen.push([i % 2 ? rr - 0.0008 : rr, (i / n) * ringB])
    rippen.push([rr - 0.003, ringB])
    const r1 = teil(drehkoerperGeo('rippen', rippen, d), 'gummi', l * 0.3)
    g.add(r1)
    g.add(ring(rr - 0.0006, 0.004, l * 0.3 - 0.006, 'aluSchwarz', d))
  } else {
    g.add(ring(rr, ringB, l * 0.3 + ringB / 2, 'gummi', d))
  }
  const glas = erzeugeFrontglas(rf - 0.01, d)
  glas.position.x = l - 0.007
  g.add(glas)
  if (blende) {
    const rb = rf + 0.003
    const rv = rf + 0.004 + blendeL * 0.12
    g.add(teil(drehkoerperGeo('fotoblende', [
      [rb - 0.002, l - 0.008], [rb, l - 0.008], [rv, l + blendeL - 0.002], [rv - 0.002, l + blendeL], [rv - 0.004, l + blendeL - 0.002], [rb - 0.003, l - 0.004],
    ], d), 'kunststoff'))
  }
}

function engObjektiv(g: THREE.Group, m: ObjektivMasse, d: Detail): void {
  const l = m.laengeM
  const rf = m.durchmesserM / 2
  g.add(teil(drehkoerperGeo('b4', [[0.024, 0], [0.031, 0], [0.031, 0.012], [0.034, 0.012], [0.034, 0.016], [0.026, 0.016]], d), 'aluSilber'))
  g.add(teil(drehkoerperGeo('eng', [
    [0.026, 0.016], [0.034, 0.016], [0.036, 0.03], [0.037, l * 0.55], [0.042, l * 0.68], [0.044, l - 0.05],
    [rf - 0.004, l - 0.042], [rf, l - 0.036], [rf, l], [rf - 0.003, l], [rf - 0.008, l - 0.03], [0.036, l - 0.032],
  ], d), 'kunststoff'))
  const glas = erzeugeFrontglas(0.036, d)
  glas.position.x = l - 0.031
  g.add(glas)
  g.add(ring(0.0405, 0.026, l * 0.62, 'gummi', d))
  g.add(ring(0.039, 0.02, 0.05, 'gummi', d))
  // Servogriff rechts, mit Zoomwippe und Riemen.
  const gx = l * 0.42
  g.add(teil(kastenGeo(0.13, 0.095, 0.05, 0.016, d), 'kunststoff', gx, -0.012, 0.062))
  g.add(teil(kastenGeo(0.11, 0.05, 0.012, 0.006, d), 'gummi', gx, -0.005, 0.092))
  if (d === 'hoch') {
    g.add(teil(kastenGeo(0.03, 0.012, 0.014, 0.005, d), 'kunststoffGrau', gx + 0.035, 0.04, 0.066))
    g.add(teil(zylinderXGeo(0.004, 0.004, 0.012, d, 10), 'akzent', gx - 0.03, 0.036, 0.07, [0, 0, Math.PI / 2]))
    // Zoomhebel am Zoomring.
    g.add(teil(zylinderXGeo(0.003, 0.003, 0.022, d, 8), 'stahl', l * 0.62, -0.05, 0, [0, 0, Math.PI / 2]))
  }
}

function boxObjektiv(g: THREE.Group, m: ObjektivMasse, d: Detail): void {
  const l = m.laengeM - 0.1
  const b = m.durchmesserM
  const h = m.obenM - m.untenM
  const ym = (m.obenM + m.untenM) / 2
  g.add(teil(zylinderXGeo(0.045, 0.045, 0.03, d), 'aluGrau', 0.015))
  g.add(teil(kastenGeo(l - 0.03, h, b, 0.03, d), 'kunststoffHell', 0.03 + (l - 0.03) / 2, ym, 0))
  // Vorderer Tubus und Gegenlichtblende.
  g.add(teil(zylinderXGeo(0.1, 0.1, 0.06, d), 'kunststoffHell', l + 0.02))
  g.add(teil(drehkoerperGeo('boxblende', [
    [0.095, l + 0.04], [0.104, l + 0.04], [0.113, l + 0.1], [0.108, l + 0.1], [0.094, l + 0.05], [0.088, l + 0.05],
  ], d), 'kunststoff'))
  const glas = erzeugeFrontglas(0.088, d)
  glas.position.x = l + 0.05
  g.add(glas)
  // Bedienfeld und Anzeige an der Bedienerseite (links, -z).
  g.add(teil(kastenGeo(0.12, 0.07, 0.006, 0.003, d), 'kunststoffGrau', 0.14, ym + 0.02, -b / 2 - 0.002))
  g.add(teil(kastenGeo(0.05, 0.025, 0.002, 0.001, d), 'display', 0.13, ym + 0.035, -b / 2 - 0.005))
  // Tragegriff oben.
  const gy = m.obenM + 0.035
  g.add(teil(kastenGeo(0.22, 0.016, 0.022, 0.007, d), 'kunststoff', l * 0.55, gy, 0))
  for (const x of [l * 0.55 - 0.1, l * 0.55 + 0.1]) g.add(teil(kastenGeo(0.022, 0.04, 0.022, 0.006, d), 'kunststoff', x, gy - 0.02, 0))
  if (d === 'hoch') {
    for (let i = 0; i < 3; i++) g.add(teil(zylinderXGeo(0.008, 0.008, 0.016, d, 12), 'aluSilber', 0.08 + i * 0.035, ym - 0.05, -b / 2 - 0.006, [0, Math.PI / 2, 0]))
    g.add(teil(kastenGeo(l - 0.12, 0.004, 0.004, 0.001, d), 'kunststoffGrau', 0.06 + (l - 0.12) / 2, m.obenM - 0.02, -b / 2 - 0.001))
    g.add(teil(kastenGeo(l - 0.12, 0.004, 0.004, 0.001, d), 'kunststoffGrau', 0.06 + (l - 0.12) / 2, m.obenM - 0.02, b / 2 + 0.001))
  }
}

/** Objektiv; Ursprung am Bajonett, Knoten `objektivFront` an der Vorderkante auf der Achse. */
export function erzeugeObjektiv(o: ObjektivOptionen): THREE.Group {
  const d = o.detail ?? 'hoch'
  const m = objektivMasse(o)
  const g = new THREE.Group()
  g.name = 'objektiv'
  switch (o.art) {
    case 'cinePrime': cineObjektiv(g, m, false, d); break
    case 'cineZoom': cineObjektiv(g, m, true, d); break
    case 'foto': fotoObjektiv(g, m, o.sonnenblende !== false, d); break
    case 'eng': engObjektiv(g, m, d); break
    case 'box': boxObjektiv(g, m, d); break
  }
  g.add(knoten('objektivFront', m.laengeM))
  g.userData.objektiv = m
  return g
}

/** Kompendium (Matte Box) mit Faltenbalg und Flags; Ursprung an der Objektivfront. */
export function erzeugeMatteBox(objektivDurchmesserM: number, detail: Detail = 'hoch'): THREE.Group {
  const d = detail
  const g = new THREE.Group()
  g.name = 'matteBox'
  const b = 0.2
  const h = 0.16
  const tiefe = 0.11
  // Rahmen vorn als vier Leisten, damit er offen bleibt.
  const s = 0.012
  g.add(teil(kastenGeo(tiefe, s, b, 0.003, d), 'aluSchwarz', tiefe / 2, h / 2 - s / 2, 0))
  g.add(teil(kastenGeo(tiefe, s, b, 0.003, d), 'aluSchwarz', tiefe / 2, -h / 2 + s / 2, 0))
  g.add(teil(kastenGeo(tiefe, h, s, 0.003, d), 'aluSchwarz', tiefe / 2, 0, b / 2 - s / 2))
  g.add(teil(kastenGeo(tiefe, h, s, 0.003, d), 'aluSchwarz', tiefe / 2, 0, -b / 2 + s / 2))
  // Balg zum Objektiv hin: verjuengter Vierkant.
  const balg = new THREE.CylinderGeometry(0.5, (objektivDurchmesserM / 2 + 0.008) / (b / 2) * 0.5, 1, 4, 1, true)
  balg.rotateY(Math.PI / 4)
  balg.rotateZ(-Math.PI / 2)
  const bm = teil(balg, 'balg', -0.005, 0, 0)
  bm.scale.set(0.05, h * 1.35, b * 1.35)
  g.add(bm)
  // Flags oben und seitlich.
  g.add(teil(kastenGeo(0.12, 0.003, b - 0.01, 0.001, d), 'kunststoff', tiefe + 0.06, h / 2 - 0.004, 0, [0, 0, 0.12]))
  if (d === 'hoch') {
    for (const z of [b / 2 + 0.002, -b / 2 - 0.002]) {
      g.add(teil(kastenGeo(0.1, h - 0.02, 0.003, 0.001, d), 'kunststoff', tiefe + 0.05, 0, z))
    }
    // Filterschubladen.
    for (let i = 0; i < 2; i++) g.add(teil(kastenGeo(0.008, h + 0.012, b + 0.012, 0.002, d), 'aluSchwarz', 0.025 + i * 0.016, 0.006, 0))
  }
  return g
}
