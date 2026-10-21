// Kamerakoerper ohne Modelldatei. Masse nach Datenblatt-Groessenordnung der
// jeweiligen Klasse (Cinema-Box ~ 185×125×140 mm, Studio-Kamera mit 9"-Sucher
// und Grossobjektiv-Adapter, Schulter-Camcorder, spiegellose Vollformat-
// Kamera ~ 130×78×85 mm, PTZ ~ 0,2 m Sockel), ohne ein Modell nachzubauen.
//
// Ursprung: Mitte des Bajonetts auf der optischen Achse, Optik nach +x,
// +z rechts aus Sicht des Kameramanns. Ausnahme PTZ: Ursprung Mitte
// Sockelunterseite, weil der Kopf selbst schwenkt und neigt.
import * as THREE from 'three'
import type { Detail } from './mensch'
import { kabelGeo, kastenGeo, knoten, kugelGeo, teil, zylinderXGeo, type MaterialName } from './kameraBau'
import { erzeugeFrontglas, type ObjektivArt } from './kameraObjektiv'

export type KoerperArt = 'cinema' | 'studio' | 'eng' | 'spiegellos' | 'ptz'
export type Tally = 'aus' | 'rot' | 'gruen'

export interface KoerperMasse {
  /** Bajonett bis Rueckseite. */
  laengeM: number
  breiteM: number
  hoeheM: number
  /** Optische Achse ueber der Auflageflaeche (Stativplatte). */
  achseUeberAuflageM: number
  /** x der Auflagemitte relativ zum Bajonett: dort sitzt die Kopfplatte. */
  auflageX: number
  standardObjektiv: ObjektivArt
}

export interface KoerperOptionen {
  art: Exclude<KoerperArt, 'ptz'>
  detail?: Detail
  tally?: Tally
  /** Nur `spiegellos`: Kaefig mit Tragegriff. */
  cage?: boolean
}

const MASSE: Record<KoerperArt, KoerperMasse> = {
  cinema: { laengeM: 0.2, breiteM: 0.125, hoeheM: 0.14, achseUeberAuflageM: 0.095, auflageX: -0.06, standardObjektiv: 'cinePrime' },
  // Auflage ist der Grossobjektiv-Adapter, der auch das Objektiv traegt.
  studio: { laengeM: 0.36, breiteM: 0.14, hoeheM: 0.25, achseUeberAuflageM: 0.15, auflageX: 0.08, standardObjektiv: 'box' },
  eng: { laengeM: 0.34, breiteM: 0.125, hoeheM: 0.2, achseUeberAuflageM: 0.095, auflageX: -0.13, standardObjektiv: 'eng' },
  spiegellos: { laengeM: 0.054, breiteM: 0.13, hoeheM: 0.078, achseUeberAuflageM: 0.036, auflageX: -0.025, standardObjektiv: 'foto' },
  ptz: { laengeM: 0.21, breiteM: 0.2, hoeheM: 0.235, achseUeberAuflageM: 0.175, auflageX: 0, standardObjektiv: 'foto' },
}

export function koerperMasse(art: KoerperArt, o: { cage?: boolean } = {}): KoerperMasse {
  const m = { ...MASSE[art] }
  if (art === 'spiegellos' && o.cage) m.achseUeberAuflageM += 0.008
  return m
}

const tallyMat = (t: Tally | undefined): MaterialName => (t === 'rot' ? 'tallyRot' : t === 'gruen' ? 'tallyGruen' : 'tallyAus')

/** V-Mount-Akku an der Rueckseite bei x. */
function akku(g: THREE.Group, x: number, y: number, d: Detail): void {
  g.add(teil(kastenGeo(0.012, 0.12, 0.085, 0.004, d), 'aluSchwarz', x - 0.006, y, 0))
  g.add(teil(kastenGeo(0.048, 0.14, 0.098, 0.012, d), 'kunststoff', x - 0.036, y, 0))
  if (d === 'hoch') g.add(teil(kastenGeo(0.002, 0.008, 0.03, 0.001, d), 'tallyGruen', x - 0.06, y + 0.05, 0))
}

function knoepfe(g: THREE.Group, x0: number, y0: number, z: number, n: number, d: Detail): void {
  if (d !== 'hoch') return
  for (let i = 0; i < n; i++) {
    g.add(teil(zylinderXGeo(0.0045, 0.0045, 0.004, d, 12), 'kunststoffGrau', x0 + (i % 3) * 0.014, y0 - Math.floor(i / 3) * 0.013, z, [0, Math.PI / 2, 0]))
  }
}

function cinema(g: THREE.Group, o: KoerperOptionen, d: Detail): void {
  const a = 0.065
  const h = 0.14
  const b = 0.125
  const l = 0.185
  const yMitte = -a + h / 2
  const oben = -a + h
  g.add(teil(zylinderXGeo(0.034, 0.034, 0.012, d), 'aluSilber', -0.006))
  g.add(teil(zylinderXGeo(0.039, 0.039, 0.004, d), 'aluSchwarz', -0.004))
  g.add(teil(kastenGeo(0.014, h, b, 0.006, d), 'aluSchwarz', -0.019, yMitte, 0))
  g.add(teil(kastenGeo(l - 0.026, h - 0.006, b - 0.006, 0.01, d), 'aluGrau', -0.026 - (l - 0.026) / 2, yMitte, 0))
  // Seitenteile als abgesetzte Flaechen.
  for (const z of [b / 2 - 0.001, -b / 2 + 0.001]) {
    g.add(teil(kastenGeo(l - 0.06, h - 0.04, 0.006, 0.002, d), 'aluSchwarz', -0.04 - (l - 0.06) / 2, yMitte, z))
  }
  // Bedienfeld links.
  g.add(teil(kastenGeo(0.07, 0.042, 0.003, 0.0015, d), 'display', -0.1, yMitte + 0.015, -b / 2 - 0.003))
  knoepfe(g, -0.15, yMitte + 0.03, -b / 2 - 0.004, 6, d)
  // Lueftungsschlitze rechts.
  if (d === 'hoch') for (let i = 0; i < 6; i++) g.add(teil(kastenGeo(0.07, 0.004, 0.003, 0.0015, d), 'kunststoff', -0.11, yMitte - 0.03 + i * 0.011, b / 2 + 0.003))
  // Tragegriff.
  for (const x of [-0.04, -0.16]) g.add(teil(kastenGeo(0.022, 0.034, 0.03, 0.006, d), 'aluSchwarz', x, oben + 0.017, 0))
  g.add(teil(kastenGeo(0.2, 0.022, 0.034, 0.01, d), 'aluSchwarz', -0.1, oben + 0.044, 0))
  g.add(teil(kastenGeo(0.12, 0.008, 0.036, 0.004, d), 'gummi', -0.1, oben + 0.056, 0))
  // Sucher vorn links, Okular nach hinten.
  g.add(teil(kastenGeo(0.03, 0.016, 0.06, 0.005, d), 'aluSchwarz', -0.06, oben + 0.008, -b / 2 - 0.02))
  g.add(teil(zylinderXGeo(0.024, 0.026, 0.11, d), 'kunststoff', -0.08, oben + 0.016, -b / 2 - 0.055))
  g.add(teil(zylinderXGeo(0.03, 0.025, 0.035, d), 'gummi', -0.152, oben + 0.016, -b / 2 - 0.055))
  // Tally vorn oben und hinten.
  const tm = tallyMat(o.tally)
  g.add(teil(kastenGeo(0.006, 0.01, 0.024, 0.002, d), tm, -0.012, oben - 0.012, b / 2 - 0.02))
  g.add(teil(kastenGeo(0.004, 0.01, 0.03, 0.002, d), tm, -l - 0.001, oben - 0.012, 0))
  akku(g, -l, yMitte, d)
  // Bruecke mit 15-mm-Stangen unter dem Objektiv.
  g.add(teil(kastenGeo(0.19, 0.03, 0.1, 0.006, d), 'aluSchwarz', -0.09, -a - 0.015, 0))
  for (const z of [-0.03, 0.03]) g.add(teil(zylinderXGeo(0.0075, 0.0075, 0.36, d, 16), 'aluSilber', 0.0, -a - 0.015, z))
  if (d === 'hoch') {
    // Schaerfezieheinrichtung am linken Stab, Handrad nach aussen.
    g.add(teil(kastenGeo(0.03, 0.05, 0.03, 0.005, d), 'aluSchwarz', 0.075, -a + 0.01, -0.05))
    g.add(teil(zylinderXGeo(0.026, 0.026, 0.01, d), 'aluSchwarz', 0.075, -a + 0.01, -0.075, [0, Math.PI / 2, 0]))
    g.add(teil(zylinderXGeo(0.0272, 0.0272, 0.004, d), 'lack', 0.075, -a + 0.01, -0.07, [0, Math.PI / 2, 0]))
  }
}

function studio(g: THREE.Group, o: KoerperOptionen, d: Detail): void {
  const a = 0.125
  const h = 0.25
  const b = 0.14
  const l = 0.36
  const yMitte = -a + h / 2
  const oben = -a + h
  g.add(teil(zylinderXGeo(0.05, 0.05, 0.016, d), 'aluSilber', -0.008))
  g.add(teil(kastenGeo(l - 0.016, h, b, 0.016, d), 'kunststoffGrau', -0.016 - (l - 0.016) / 2, yMitte, 0))
  for (const z of [b / 2, -b / 2]) g.add(teil(kastenGeo(l - 0.08, h - 0.06, 0.006, 0.003, d), 'aluGrau', -0.05 - (l - 0.08) / 2, yMitte, z))
  // Grossobjektiv-Adapter: traegt Kamera und Boxobjektiv gemeinsam.
  g.add(teil(kastenGeo(0.78, 0.025, 0.2, 0.006, d), 'aluGrau', 0.02, -a - 0.0125, 0))
  g.add(teil(kastenGeo(0.05, 0.04, 0.2, 0.006, d), 'aluSchwarz', -0.02, -a + 0.02, 0))
  // 9"-Studiosucher auf einer Saeule, Bildschirm zum Kameramann.
  const vfY = oben + 0.045 + 0.1
  const vfX = -0.2
  g.add(teil(kastenGeo(0.05, 0.05, 0.05, 0.008, d), 'aluSchwarz', vfX + 0.03, oben + 0.025, 0))
  g.add(teil(kastenGeo(0.16, 0.2, 0.27, 0.02, d), 'kunststoff', vfX, vfY, 0))
  g.add(teil(kastenGeo(0.003, 0.15, 0.22, 0.001, d), 'evf', vfX - 0.081, vfY, 0))
  for (const z of [0.135, -0.135]) g.add(teil(kastenGeo(0.07, 0.2, 0.006, 0.002, d), 'kunststoff', vfX - 0.115, vfY, z))
  g.add(teil(kastenGeo(0.07, 0.006, 0.27, 0.002, d), 'kunststoff', vfX - 0.115, vfY + 0.1, 0))
  // Tally und Kameranummer vorn am Sucher.
  const tm = tallyMat(o.tally)
  g.add(teil(kastenGeo(0.008, 0.03, 0.12, 0.004, d), tm, vfX + 0.082, vfY + 0.07, 0))
  g.add(teil(kastenGeo(0.004, 0.05, 0.06, 0.003, d), 'lack', vfX + 0.082, vfY + 0.01, 0))
  g.add(teil(kastenGeo(0.004, 0.012, 0.012, 0.002, d), tm, vfX - 0.082, vfY + 0.09, 0.12))
  // Griff, Rueckseite mit Glasfaser-Stecker und Kabel.
  g.add(teil(kastenGeo(0.18, 0.02, 0.03, 0.009, d), 'kunststoff', -0.12, oben + 0.01, -b / 2 + 0.02))
  g.add(teil(zylinderXGeo(0.018, 0.018, 0.04, d), 'aluSilber', -l - 0.02, -a + 0.05, 0.03))
  knoepfe(g, -0.3, yMitte + 0.05, -b / 2 - 0.004, 9, d)
  const kabel = kabelGeo([
    new THREE.Vector3(-l - 0.04, -a + 0.05, 0.03), new THREE.Vector3(-l - 0.1, -a - 0.0, 0.05),
    new THREE.Vector3(-l - 0.12, -a - 0.2, 0.09), new THREE.Vector3(-l - 0.08, -a - 0.42, 0.12),
  ], 0.008, d)
  g.add(teil(kabel, 'gummi'))
}

function eng(g: THREE.Group, o: KoerperOptionen, d: Detail): void {
  const a = 0.095
  const h = 0.2
  const b = 0.125
  const l = 0.29
  const unten = -a + 0.022
  const yMitte = unten + h / 2
  const oben = unten + h
  g.add(teil(zylinderXGeo(0.036, 0.036, 0.014, d), 'aluSilber', -0.007))
  g.add(teil(kastenGeo(l - 0.014, h, b, 0.018, d), 'kunststoff', -0.014 - (l - 0.014) / 2, yMitte, 0))
  g.add(teil(kastenGeo(0.1, h - 0.05, 0.006, 0.003, d), 'kunststoffGrau', -0.09, yMitte, -b / 2))
  g.add(teil(kastenGeo(0.05, 0.03, 0.003, 0.001, d), 'display', -0.2, yMitte + 0.04, -b / 2 - 0.003))
  knoepfe(g, -0.22, yMitte - 0.01, -b / 2 - 0.003, 9, d)
  // Schulterpolster.
  g.add(teil(kastenGeo(0.16, 0.022, 0.085, 0.01, d), 'gummi', -0.17, -a + 0.011, 0))
  // Tragegriff mit Tally vorn.
  for (const x of [-0.04, -0.25]) g.add(teil(kastenGeo(0.024, 0.05, 0.03, 0.008, d), 'kunststoff', x, oben + 0.025, 0))
  g.add(teil(kastenGeo(0.25, 0.024, 0.034, 0.011, d), 'kunststoff', -0.145, oben + 0.058, 0))
  g.add(teil(kastenGeo(0.008, 0.012, 0.02, 0.003, d), tallyMat(o.tally), -0.027, oben + 0.058, 0))
  // Sucher vorn links ueber dem Objektiv.
  g.add(teil(kastenGeo(0.05, 0.02, 0.07, 0.006, d), 'kunststoff', -0.03, oben + 0.01, -b / 2 - 0.02))
  g.add(teil(kastenGeo(0.07, 0.055, 0.05, 0.01, d), 'kunststoff', 0.02, oben + 0.03, -b / 2 - 0.05))
  g.add(teil(zylinderXGeo(0.022, 0.024, 0.11, d), 'kunststoff', -0.065, oben + 0.03, -b / 2 - 0.05))
  g.add(teil(zylinderXGeo(0.029, 0.024, 0.035, d), 'gummi', -0.135, oben + 0.03, -b / 2 - 0.05))
  // Mikrofon vorn rechts, Schaumstoff vorn heller.
  g.add(teil(zylinderXGeo(0.016, 0.016, 0.02, d), 'kunststoff', -0.03, oben + 0.07, b / 2 - 0.01))
  g.add(teil(zylinderXGeo(0.0105, 0.0105, 0.19, d), 'aluSchwarz', 0.04, oben + 0.07, b / 2 - 0.01))
  g.add(teil(zylinderXGeo(0.013, 0.013, 0.06, d), 'kunststoffGrau', 0.15, oben + 0.07, b / 2 - 0.01))
  akku(g, -l, yMitte, d)
}

function spiegellos(g: THREE.Group, o: KoerperOptionen, d: Detail): void {
  const a = 0.036
  const h = 0.078
  const b = 0.13
  const yMitte = -a + h / 2
  const oben = -a + h
  const hinten = -0.054
  g.add(teil(zylinderXGeo(0.03, 0.03, 0.006, d), 'aluSilber', -0.003))
  g.add(teil(kastenGeo(-hinten - 0.006, h, b, 0.008, d), 'aluSchwarz', (hinten - 0.006) / 2, yMitte, 0))
  // Handgriff rechts, gummiert.
  g.add(teil(kastenGeo(0.04, h - 0.004, 0.036, 0.014, d), 'gummi', 0.004, yMitte - 0.002, b / 2 - 0.02))
  // Klappdisplay hinten.
  g.add(teil(kastenGeo(0.008, 0.056, 0.084, 0.003, d), 'kunststoff', hinten - 0.004, yMitte, -0.01))
  g.add(teil(kastenGeo(0.002, 0.047, 0.074, 0.001, d), 'display', hinten - 0.009, yMitte, -0.01))
  // Tally vorn und oben.
  const tm = tallyMat(o.tally)
  g.add(teil(kastenGeo(0.003, 0.006, 0.006, 0.0015, d), tm, -0.006, oben - 0.012, -b / 2 + 0.015))
  g.add(teil(kastenGeo(0.006, 0.002, 0.006, 0.001, d), tm, -0.04, oben + 0.001, -b / 2 + 0.015))
  if (d === 'hoch') {
    g.add(teil(zylinderXGeo(0.0045, 0.0045, 0.004, d, 16), 'akzent', -0.015, oben + 0.002, b / 2 - 0.03, [0, 0, Math.PI / 2]))
    g.add(teil(zylinderXGeo(0.011, 0.011, 0.008, d, 24), 'aluSchwarz', -0.03, oben + 0.003, b / 2 - 0.022, [0, 0, Math.PI / 2]))
    for (let i = 0; i < 5; i++) g.add(teil(zylinderXGeo(0.003, 0.003, 0.002, d, 8), 'kunststoff', hinten / 2 + (i % 2) * 0.012, oben + 0.0005, -0.04 + i * 0.015, [0, 0, Math.PI / 2]))
  }
  if (o.cage) {
    const t = 0.008
    g.add(teil(kastenGeo(0.075, t, b + 0.02, 0.002, d), 'aluSchwarz', -0.025, -a - t / 2, 0))
    for (const z of [-(b / 2 + 0.006), b / 2 + 0.006]) g.add(teil(kastenGeo(0.04, h + 0.02, t, 0.003, d), 'aluSchwarz', -0.03, yMitte, z))
    g.add(teil(kastenGeo(0.075, t, b + 0.02, 0.002, d), 'aluSchwarz', -0.025, oben + 0.01, 0))
    // Tragegriff auf dem Kaefig.
    for (const x of [-0.06, 0.04]) g.add(teil(kastenGeo(0.016, 0.03, 0.02, 0.005, d), 'aluSchwarz', x, oben + 0.028, 0))
    g.add(teil(kastenGeo(0.13, 0.02, 0.026, 0.009, d), 'gummi', -0.01, oben + 0.052, 0))
  }
}

export function erzeugeKamerakoerper(o: KoerperOptionen): THREE.Group {
  const d = o.detail ?? 'hoch'
  const g = new THREE.Group()
  g.name = 'koerper'
  switch (o.art) {
    case 'cinema': cinema(g, o, d); break
    case 'studio': studio(g, o, d); break
    case 'eng': eng(g, o, d); break
    case 'spiegellos': spiegellos(g, o, d); break
  }
  g.userData.koerper = koerperMasse(o.art, o)
  return g
}

// ---------------------------------------------------------------------------
// PTZ
// ---------------------------------------------------------------------------

export type PtzForm = 'kopf' | 'kugel'

export interface PtzOptionen {
  form?: PtzForm
  hell?: boolean
  tally?: Tally
  pan?: number
  tilt?: number
  detail?: Detail
}

/** Hoehe der Neigeachse ueber der Sockelunterseite. */
export const PTZ_ACHSE_M = 0.175
const PTZ_PAN_Y = 0.055

/**
 * PTZ-Kamera; Ursprung Mitte Sockelunterseite. Knoten `ptzPan` (dreht um y),
 * `ptzTilt` (dreht um z, positiv = hoch) und `objektivFront`.
 * Winkel in Grad wie im multicam-planner: Pan dreht +x Richtung +z.
 */
export function erzeugePtzKamera(o: PtzOptionen = {}): THREE.Group {
  const d = o.detail ?? 'hoch'
  const form = o.form ?? 'kopf'
  const haut: MaterialName = o.hell ? 'lack' : 'kunststoff'
  const g = new THREE.Group()
  g.name = 'ptz'
  if (form === 'kopf') {
    g.add(teil(kastenGeo(0.19, PTZ_PAN_Y, 0.19, 0.02, d), haut, 0, PTZ_PAN_Y / 2, 0))
  } else {
    g.add(teil(zylinderXGeo(0.095, 0.1, PTZ_PAN_Y, d), haut, 0, PTZ_PAN_Y / 2, 0, [0, 0, Math.PI / 2]))
  }
  g.add(teil(kastenGeo(0.004, 0.006, 0.03, 0.002, d), tallyMat(o.tally), 0.096, PTZ_PAN_Y * 0.5, 0))
  const pan = knoten('ptzPan', 0, PTZ_PAN_Y, 0)
  g.add(pan)
  pan.add(teil(zylinderXGeo(0.075, 0.075, 0.012, d), 'kunststoffGrau', 0, 0.006, 0, [0, 0, Math.PI / 2]))
  pan.add(teil(kastenGeo(0.09, 0.02, 0.2, 0.008, d), haut, 0, 0.022, 0))
  const achse = PTZ_ACHSE_M - PTZ_PAN_Y
  for (const z of [-0.09, 0.09]) {
    pan.add(teil(kastenGeo(0.085, achse + 0.03, 0.02, 0.009, d), haut, 0, 0.012 + (achse + 0.03) / 2, z))
    pan.add(teil(zylinderXGeo(0.022, 0.022, 0.006, d), 'kunststoffGrau', 0, achse, z + Math.sign(z) * 0.011, [0, Math.PI / 2, 0]))
  }
  const tilt = knoten('ptzTilt', 0, achse, 0)
  pan.add(tilt)
  let front: number
  if (form === 'kopf') {
    tilt.add(teil(kastenGeo(0.21, 0.105, 0.155, 0.026, d), haut, 0.008, 0, 0))
    tilt.add(teil(zylinderXGeo(0.044, 0.046, 0.02, d), 'kunststoff', 0.118, 0, 0))
    tilt.add(teil(zylinderXGeo(0.036, 0.036, 0.004, d), 'kunststoffGrau', 0.127, 0, 0))
    front = 0.128
    tilt.add(teil(kastenGeo(0.006, 0.004, 0.02, 0.0015, d), tallyMat(o.tally), 0.08, 0.053, 0))
    if (d === 'hoch') for (let i = 0; i < 5; i++) tilt.add(teil(kastenGeo(0.06, 0.003, 0.002, 0.001, d), 'kunststoffGrau', -0.04, -0.02 + i * 0.01, 0.078))
  } else {
    tilt.add(teil(kugelGeo(0.078, d), haut))
    tilt.add(teil(zylinderXGeo(0.04, 0.045, 0.03, d), 'kunststoff', 0.065, 0, 0))
    front = 0.08
    tilt.add(teil(kastenGeo(0.004, 0.004, 0.02, 0.0015, d), tallyMat(o.tally), 0.03, 0.07, 0, [0, 0, -0.4]))
  }
  // Frontglas.
  const glas = erzeugeFrontglas(0.031, d)
  glas.position.x = front - 0.002
  tilt.add(glas)
  tilt.add(knoten('objektivFront', front))
  stellePtz(g, o.pan ?? 0, o.tilt ?? 0)
  g.userData.koerper = koerperMasse('ptz')
  return g
}

/** Stellt Pan/Tilt einer PTZ-Kamera (Grad). */
export function stellePtz(ptz: THREE.Object3D, pan: number, tilt: number): void {
  ptz.getObjectByName('ptzPan')?.rotation.set(0, THREE.MathUtils.degToRad(-pan), 0)
  ptz.getObjectByName('ptzTilt')?.rotation.set(0, 0, THREE.MathUtils.degToRad(tilt))
}
