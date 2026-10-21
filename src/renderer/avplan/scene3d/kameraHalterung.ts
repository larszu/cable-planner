// Halterungen fuer Kameras: Stativ, Pedestal, Kran, Slider, Dolly,
// Schulterrig, Wand- und Deckenhalter.
//
// Ursprung am Boden unter der Pan-Achse (wie die Parkposition im
// multicam-planner), +x = Blickrichtung bei Pan 0. Jede Halterung liefert die
// Knoten `panGelenk` (dreht um y), `tiltGelenk` (dreht um z) und `platte`
// (Oberkante der Kameraplatte, darauf sitzt die Kamera) sowie
// `montagepunkt` (wo die Halterung steht oder befestigt ist).
// `plattenHoeheM` ist die Hoehe der Plattenoberkante bei Tilt 0.
//
// Beim Deckenhalter ist `platte` um x gewendet: was darauf sitzt, haengt
// kopfueber.
import * as THREE from 'three'
import type { Detail } from './mensch'
import { kastenGeo, knoten, profilGeo, stab, teil, torusGeo, zahnringGeo, zylinderXGeo, type MaterialName } from './kameraBau'

export type HalterungArt = 'stativ' | 'pedestal' | 'kran' | 'slider' | 'dolly' | 'schulter' | 'wand' | 'decke' | 'keine'
export type Spinne = 'boden' | 'mittel' | 'keine'
export type KopfArt = 'fluid' | 'keiner'

export interface HalterungOptionen {
  art: HalterungArt
  plattenHoeheM: number
  /** Fluidkopf; `keiner` z. B. fuer PTZ (die schwenkt selbst). */
  kopf?: KopfArt
  detail?: Detail
  /** Stativ: Boden- oder Mittelspinne. */
  spinne?: Spinne
  /** Kran: Auslegerlaenge vom Drehpunkt bis zum Kopf (m). */
  armLaengeM?: number
  /** Kran: Neigung des Auslegers, positiv = Spitze hoch (Grad). */
  neigungDeg?: number
  /** Kran: Anzahl Gegengewichtsscheiben. */
  gegengewichtScheiben?: number
  /** Slider und Dolly: Schienenlaenge (m). */
  schienenLaengeM?: number
  /** Slider und Dolly: Lage des Wagens auf der Schiene, -1 … 1. */
  position?: number
  /** Slider und Dolly: Schiene laengs zur Blickrichtung oder quer dazu. */
  schienenRichtung?: 'laengs' | 'quer'
  /** Wandhalter: Abstand Wand – Pan-Achse (m). */
  wandAbstandM?: number
  /** Deckenhalter: Laenge der Abhaengung bis zur Decke (m). */
  abhaengungM?: number
  /** Schulterrig: Kamera hat selbst ein Schulterpolster (Camcorder). */
  eigeneSchulter?: boolean
}

export interface HalterungsKnoten {
  panGelenk: THREE.Object3D
  tiltGelenk: THREE.Object3D
  platte: THREE.Object3D
  montagepunkt: THREE.Object3D
}

const DEG = Math.PI / 180
const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z)
const klemme = (w: number, a: number, b: number): number => Math.min(b, Math.max(a, w))

/** Senkrechter Zylinder (Achse y), Mitte bei y. */
function saeule(r: number, hoehe: number, mat: MaterialName, x: number, y: number, z: number, d: Detail, rOben = r): THREE.Mesh {
  return teil(zylinderXGeo(rOben, r, hoehe, d), mat, x, y, z, [0, 0, Math.PI / 2])
}

type KopfGroesse = 'klein' | 'mittel' | 'gross'

interface Kopf {
  gruppe: THREE.Group
  hoehe: number
}

/** Fluidkopf; Ursprung Oberkante Halbschale. Haengt `panGelenk`, `tiltGelenk`, `platte` ein. */
function fluidKopf(groesse: KopfGroesse, panBuegel: number, d: Detail): Kopf {
  const s = groesse === 'gross' ? 1.35 : groesse === 'klein' ? 0.72 : 1
  const g = new THREE.Group()
  g.add(teil(zylinderXGeo(0.05 * s, 0.05 * s, 0.006, d), 'aluSchwarz', 0, 0.003, 0, [0, 0, Math.PI / 2]))
  g.add(saeule(0.055 * s, 0.035 * s, 'aluSchwarz', 0, 0.0175 * s + 0.006, 0, d))
  g.add(saeule(0.0565 * s, 0.008 * s, 'kunststoffGrau', 0, 0.03 * s, 0, d))
  if (d === 'hoch') {
    // Libelle hinten am Unterteil.
    g.add(teil(kastenGeo(0.022 * s, 0.01 * s, 0.022 * s, 0.004 * s, d), 'kunststoff', -0.058 * s, 0.03 * s, 0))
    g.add(teil(zylinderXGeo(0.007 * s, 0.007 * s, 0.003, d, 16), 'glasTief', -0.058 * s, 0.036 * s, 0, [0, 0, Math.PI / 2]))
  }
  const pan = knoten('panGelenk', 0, 0.041 * s, 0)
  g.add(pan)
  pan.add(teil(kastenGeo(0.11 * s, 0.085 * s, 0.13 * s, 0.022 * s, d), 'aluSchwarz', 0, 0.0425 * s, 0))
  // Daempfungs- und Gegengewichtsknoepfe links und rechts.
  for (const z of [-1, 1]) {
    pan.add(teil(zylinderXGeo(0.026 * s, 0.026 * s, 0.014 * s, d), 'kunststoffGrau', 0, 0.06 * s, z * 0.072 * s, [0, Math.PI / 2, 0]))
    if (d === 'hoch') pan.add(teil(zylinderXGeo(0.0262 * s, 0.0262 * s, 0.003, d), 'akzent', 0, 0.06 * s, z * 0.066 * s, [0, Math.PI / 2, 0]))
  }
  const tilt = knoten('tiltGelenk', 0, 0.06 * s, 0)
  pan.add(tilt)
  tilt.add(teil(kastenGeo(0.1 * s, 0.03 * s, 0.1 * s, 0.01 * s, d), 'aluSchwarz', 0, 0.02 * s, 0))
  tilt.add(teil(kastenGeo(0.17 * s, 0.018 * s, 0.085 * s, 0.004, d), 'aluSilber', 0, 0.044 * s, 0))
  tilt.add(knoten('platte', 0, 0.053 * s, 0))
  // Schwenkarme nach hinten, leicht nach unten und aussen.
  const seiten = panBuegel >= 2 ? [-1, 1] : [-1]
  for (const z of seiten) {
    const a = v(-0.05 * s, 0.01 * s, z * 0.055 * s)
    const b = v(-0.48, -0.13, z * (0.16 + 0.04 * s))
    tilt.add(stab(a, b, 0.011, 'aluSchwarz', d))
    const griff = a.clone().lerp(b, 0.75)
    tilt.add(stab(griff, b, 0.0155, 'gummi', d))
    if (d === 'hoch') tilt.add(teil(zahnringGeo(0.02, 0.012, d), 'aluSchwarz', a.x, a.y, a.z, [0, Math.PI / 2, 0]))
  }
  return { gruppe: g, hoehe: (0.041 + 0.06 + 0.053) * s }
}

/** Flache Adapterplatte statt Kopf; Gelenke bleiben fuer eine einheitliche Schnittstelle. */
function ohneKopf(d: Detail): Kopf {
  const g = new THREE.Group()
  g.add(saeule(0.06, 0.012, 'aluSchwarz', 0, 0.006, 0, d))
  const pan = knoten('panGelenk', 0, 0.012, 0)
  const tilt = knoten('tiltGelenk')
  g.add(pan)
  pan.add(tilt)
  tilt.add(knoten('platte'))
  return { gruppe: g, hoehe: 0.012 }
}

function kopf(o: HalterungOptionen, groesse: KopfGroesse, panBuegel: number, d: Detail): Kopf {
  return (o.kopf ?? 'fluid') === 'fluid' ? fluidKopf(groesse, panBuegel, d) : ohneKopf(d)
}

function stativ(g: THREE.Group, o: HalterungOptionen, d: Detail): void {
  const k = kopf(o, 'mittel', 1, d)
  const schale = Math.max(0.3, o.plattenHoeheM - k.hoehe)
  k.gruppe.position.y = schale
  g.add(k.gruppe)
  const spinne = o.spinne ?? 'boden'
  // Kopfteil mit 100-mm-Halbschale und Nivellierhebel.
  g.add(saeule(0.085, 0.05, 'aluSchwarz', 0, schale - 0.025, 0, d))
  g.add(teil(kastenGeo(0.03, 0.02, 0.03, 0.006, d), 'kunststoff', 0, schale - 0.06, 0))
  g.add(stab(v(0, schale - 0.06, 0), v(-0.02, schale - 0.24, 0.01), 0.008, 'stahl', d))
  g.add(teil(kastenGeo(0.03, 0.05, 0.03, 0.01, d), 'kunststoff', -0.02, schale - 0.25, 0.01))
  const radius = klemme(0.3 * schale + 0.15, 0.25, 0.75)
  const yFuss = spinne === 'boden' ? 0.035 : 0.02
  const mitte: THREE.Vector3[] = []
  for (const winkel of [0, 120, 240]) {
    const c = Math.cos(winkel * DEG)
    const sn = Math.sin(winkel * DEG)
    const oben = v(c * 0.075, schale - 0.035, sn * 0.075)
    const fuss = v(c * radius, yFuss, sn * radius)
    const quer = v(-sn, 0, c)
    const knick = oben.clone().lerp(fuss, 0.55)
    // Zwillingsrohre: oben Carbon dick, unten Alu duenner.
    for (const seite of d === 'hoch' ? [-1, 1] : [0]) {
      const ab = quer.clone().multiplyScalar(seite * 0.017)
      g.add(stab(oben.clone().add(ab), knick.clone().add(ab), d === 'hoch' ? 0.0105 : 0.017, 'aluSchwarz', d))
      const ab2 = quer.clone().multiplyScalar(seite * 0.013)
      g.add(stab(oben.clone().lerp(fuss, 0.5).add(ab2), fuss.clone().add(ab2), d === 'hoch' ? 0.0075 : 0.012, 'aluGrau', d))
    }
    // Klemmen an Knick und Fuss, Gelenk oben.
    g.add(stab(oben.clone().lerp(fuss, 0.52), oben.clone().lerp(fuss, 0.58), 0.024, 'kunststoff', d))
    g.add(stab(oben.clone().lerp(fuss, 0.0), oben.clone().lerp(fuss, 0.04), 0.024, 'aluSchwarz', d))
    if (d === 'hoch') g.add(stab(oben.clone().lerp(fuss, 0.9), oben.clone().lerp(fuss, 0.93), 0.018, 'kunststoff', d))
    g.add(teil(kastenGeo(0.05, 0.03, 0.05, 0.012, d), spinne === 'boden' ? 'kunststoff' : 'gummi', fuss.x, yFuss - 0.005, fuss.z))
    mitte.push(knick)
  }
  if (spinne === 'boden') {
    g.add(saeule(0.04, 0.03, 'kunststoff', 0, 0.02, 0, d))
    for (const winkel of [0, 120, 240]) {
      const c = Math.cos(winkel * DEG)
      const sn = Math.sin(winkel * DEG)
      g.add(stab(v(c * 0.03, 0.02, sn * 0.03), v(c * radius, 0.02, sn * radius), 0.009, 'aluGrau', d))
    }
  } else if (spinne === 'mittel') {
    const y = mitte[0].y
    g.add(saeule(0.035, 0.035, 'kunststoff', 0, y, 0, d))
    for (const p of mitte) g.add(stab(v(0, y, 0), p, 0.008, 'aluGrau', d))
  }
}

function pedestal(g: THREE.Group, o: HalterungOptionen, d: Detail): void {
  const k = kopf(o, 'gross', 2, d)
  const saeuleOben = Math.max(0.55, o.plattenHoeheM - k.hoehe)
  k.gruppe.position.y = saeuleOben
  g.add(k.gruppe)
  // Fahrgestell: drei Ausleger mit verkleideten Rollen (Kabelabweiser).
  g.add(saeule(0.17, 0.2, 'kunststoffGrau', 0, 0.2, 0, d, 0.15))
  for (const winkel of [60, 180, 300]) {
    const arm = teil(kastenGeo(0.42, 0.07, 0.11, 0.02, d), 'kunststoffGrau', 0, 0.13, 0)
    arm.rotation.y = -winkel * DEG
    arm.translateX(0.21)
    g.add(arm)
    const x = Math.cos(winkel * DEG) * 0.42
    const z = Math.sin(winkel * DEG) * 0.42
    g.add(saeule(0.085, 0.13, 'kunststoffGrau', x, 0.085, z, d, 0.075))
    g.add(saeule(0.088, 0.02, 'gummi', x, 0.012, z, d))
  }
  // Teleskopsaeule: festes Aussenrohr, ausgefahrene Innenrohre.
  const aussenOben = Math.min(saeuleOben - 0.05, 0.85)
  g.add(saeule(0.1, aussenOben - 0.3, 'kunststoffGrau', 0, (0.3 + aussenOben) / 2, 0, d))
  if (saeuleOben - aussenOben > 0.02) {
    g.add(saeule(0.085, saeuleOben - aussenOben + 0.04, 'aluSilber', 0, (aussenOben + saeuleOben) / 2, 0, d))
  }
  g.add(saeule(0.11, 0.03, 'aluSchwarz', 0, saeuleOben - 0.015, 0, d))
  // Lenkring.
  const ringY = saeuleOben - 0.075
  g.add(teil(torusGeo(0.24, 0.014, d), 'kunststoff', 0, ringY, 0))
  for (const winkel of [90, 210, 330]) {
    const c = Math.cos(winkel * DEG)
    const sn = Math.sin(winkel * DEG)
    g.add(stab(v(c * 0.09, ringY, sn * 0.09), v(c * 0.235, ringY, sn * 0.235), 0.009, 'aluSchwarz', d))
  }
}

/** Remote-Head in L-Form, unter der Auslegerspitze haengend; Ursprung an der Spitze. */
function remoteHead(d: Detail): { gruppe: THREE.Group; tiefe: number } {
  const g = new THREE.Group()
  g.add(saeule(0.07, 0.12, 'aluSchwarz', 0, -0.06, 0, d))
  if (d === 'hoch') g.add(saeule(0.072, 0.01, 'akzent', 0, -0.03, 0, d))
  const pan = knoten('panGelenk', 0, -0.12, 0)
  g.add(pan)
  pan.add(teil(kastenGeo(0.09, 0.04, 0.2, 0.012, d), 'aluSchwarz', 0, -0.02, -0.09))
  pan.add(teil(kastenGeo(0.09, 0.33, 0.045, 0.012, d), 'aluSchwarz', 0, -0.18, -0.18))
  pan.add(teil(zylinderXGeo(0.06, 0.06, 0.07, d), 'aluSchwarz', 0, -0.33, -0.155, [0, Math.PI / 2, 0]))
  const tilt = knoten('tiltGelenk', 0, -0.33, 0)
  pan.add(tilt)
  tilt.add(teil(kastenGeo(0.1, 0.09, 0.014, 0.005, d), 'aluSchwarz', 0, -0.03, -0.115))
  tilt.add(teil(kastenGeo(0.24, 0.016, 0.24, 0.005, d), 'aluSchwarz', 0, -0.07, -0.0))
  tilt.add(knoten('platte', 0, -0.062, 0))
  return { gruppe: g, tiefe: 0.12 + 0.33 + 0.062 }
}

/** Fachwerk-Ausleger zwischen a und b, dreieckiger Querschnitt, verjuengt. */
function fachwerk(g: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, hA: number, hB: number, d: Detail): void {
  const u = b.clone().sub(a).normalize()
  const n = v(-u.y, u.x, 0)
  if (n.y < 0) n.negate()
  const z = v(0, 0, 1)
  const punkt = (t: number, gurt: number): THREE.Vector3 => {
    const h = hA + (hB - hA) * t
    const p = a.clone().lerp(b, t)
    if (gurt === 0) return p.add(n.clone().multiplyScalar(h / 2))
    return p.add(n.clone().multiplyScalar(-h / 2)).add(z.clone().multiplyScalar((gurt === 1 ? 1 : -1) * h * 0.55))
  }
  for (const gurt of [0, 1, 2]) g.add(stab(punkt(0, gurt), punkt(1, gurt), 0.014, 'aluSchwarz', d))
  if (d !== 'hoch') return
  const felder = Math.max(3, Math.round(a.distanceTo(b) / 0.3))
  for (let i = 0; i < felder; i++) {
    const t0 = i / felder
    const t1 = (i + 1) / felder
    for (const [p, q] of [[0, 1], [1, 2], [2, 0]] as const) g.add(stab(punkt(t0, p), punkt(t1, q), 0.005, 'aluSchwarz', d))
  }
}

function kran(g: THREE.Group, o: HalterungOptionen, d: Detail, montage: THREE.Object3D): void {
  const kopfTeil = o.kopf === 'keiner' ? null : remoteHead(d)
  const spitzeY = o.plattenHoeheM + (kopfTeil ? kopfTeil.tiefe : -0.04)
  const arm = Math.max(1, o.armLaengeM ?? 3)
  let neigung = o.neigungDeg !== undefined ? o.neigungDeg * DEG : Math.asin(klemme((spitzeY - 1.4) / arm, -0.85, 0.85))
  let drehY = spitzeY - arm * Math.sin(neigung)
  // Drehpunkt bleibt in Reichweite des Unterbaus; die Neigung gibt nach, die Kopfhoehe nicht.
  if (drehY < 0.6) neigung = Math.asin(Math.min(0.95, (spitzeY - 0.6) / arm))
  else if (drehY > 2.4) neigung = Math.asin(Math.max(-0.95, (spitzeY - 2.4) / arm))
  drehY = spitzeY - arm * Math.sin(neigung)
  const reichweite = arm * Math.cos(neigung)
  const dreh = v(-reichweite, drehY, 0)
  const spitze = v(0, spitzeY, 0)
  const u = spitze.clone().sub(dreh).normalize()
  const heck = dreh.clone().sub(u.clone().multiplyScalar(arm * 0.35))
  fachwerk(g, dreh, spitze, 0.22, 0.1, d)
  fachwerk(g, dreh, heck, 0.22, 0.14, d)
  // Gegengewicht: Scheibenstapel am Heck.
  const scheiben = Math.max(2, o.gegengewichtScheiben ?? Math.round(3 + arm * 1.5))
  g.add(stab(heck, heck.clone().add(v(0, -0.08 - scheiben * 0.032, 0)), 0.012, 'stahl', d))
  for (let i = 0; i < scheiben; i++) g.add(saeule(0.13, 0.028, 'gusseisen', heck.x, heck.y - 0.09 - i * 0.032, 0, d))
  // Drehlager mit Gabel.
  g.add(teil(kastenGeo(0.18, 0.2, 0.3, 0.02, d), 'aluSchwarz', dreh.x, dreh.y - 0.02, 0))
  g.add(teil(zylinderXGeo(0.03, 0.03, 0.36, d), 'stahl', dreh.x, dreh.y, 0, [0, Math.PI / 2, 0]))
  if (d === 'hoch') {
    // Abspannung ueber einen Koenigspfosten.
    const pfosten = dreh.clone().add(v(0, 0.55, 0))
    g.add(stab(dreh, pfosten, 0.016, 'aluSchwarz', d))
    g.add(stab(pfosten, spitze.clone().add(u.clone().multiplyScalar(-0.05)).add(v(0, 0.05, 0)), 0.0025, 'stahl', d))
    g.add(stab(pfosten, heck.clone().add(v(0, 0.07, 0)), 0.0025, 'stahl', d))
  }
  // Unterbau: Saeule auf schwerem Dreibein mit Bodenspinne.
  const fussY = Math.min(drehY - 0.25, 0.9)
  g.add(saeule(0.06, drehY - 0.12 - fussY, 'aluSilber', dreh.x, (drehY - 0.12 + fussY) / 2, 0, d))
  g.add(saeule(0.09, 0.06, 'aluSchwarz', dreh.x, fussY, 0, d))
  const r = 0.7
  for (const winkel of [0, 120, 240]) {
    const c = Math.cos((winkel + 60) * DEG)
    const s = Math.sin((winkel + 60) * DEG)
    const fuss = v(dreh.x + c * r, 0.03, s * r)
    g.add(stab(v(dreh.x + c * 0.08, fussY, s * 0.08), fuss, 0.02, 'aluSchwarz', d))
    g.add(stab(v(dreh.x, 0.03, 0), fuss, 0.012, 'aluGrau', d))
    g.add(teil(kastenGeo(0.07, 0.03, 0.07, 0.012, d), 'gummi', fuss.x, 0.015, fuss.z))
  }
  montage.position.set(dreh.x, 0, 0)
  if (kopfTeil) {
    kopfTeil.gruppe.position.copy(spitze)
    g.add(kopfTeil.gruppe)
  } else {
    const k = ohneKopf(d)
    k.gruppe.position.set(0, o.plattenHoeheM - 0.012, 0)
    g.add(k.gruppe)
  }
  g.add(teil(kastenGeo(0.14, 0.028, 0.14, 0.01, d), 'aluSchwarz', 0, spitzeY + 0.014, 0))
}

/** Schiene entlang x in Halterungs-Lokalkoordinaten; quer wird die ganze Gruppe gedreht. */
function schienenGruppe(o: HalterungOptionen): { gruppe: THREE.Group; versatz: number; laenge: number } {
  const laenge = Math.max(0.3, o.schienenLaengeM ?? (o.art === 'dolly' ? 3.6 : 1))
  const gruppe = new THREE.Group()
  if ((o.schienenRichtung ?? (o.art === 'slider' ? 'quer' : 'laengs')) === 'quer') gruppe.rotation.y = -Math.PI / 2
  const rand = o.art === 'dolly' ? 0.6 : 0.1
  const versatz = -klemme(o.position ?? 0, -1, 1) * Math.max(0, laenge / 2 - rand)
  gruppe.position.set(0, 0, 0)
  return { gruppe, versatz, laenge }
}

function slider(g: THREE.Group, o: HalterungOptionen, d: Detail): void {
  const k = kopf(o, 'klein', 1, d)
  const schlittenOben = Math.max(0.12, o.plattenHoeheM - k.hoehe)
  k.gruppe.position.y = schlittenOben
  g.add(k.gruppe)
  const s = schienenGruppe(o)
  g.add(s.gruppe)
  const y = schlittenOben - 0.042
  const mitte = s.versatz
  for (const z of [-0.03, 0.03]) s.gruppe.add(teil(zylinderXGeo(0.011, 0.011, s.laenge, d), 'aluSilber', mitte, y, z))
  for (const x of [mitte - s.laenge / 2, mitte + s.laenge / 2]) {
    s.gruppe.add(teil(kastenGeo(0.04, 0.045, 0.1, 0.008, d), 'aluSchwarz', x, y, 0))
    if (y > 0.25) {
      // Leichtes Dreibein unter jedem Ende.
      for (const winkel of [0, 120, 240]) {
        const c = Math.cos(winkel * DEG)
        const sn = Math.sin(winkel * DEG)
        s.gruppe.add(stab(v(x, y - 0.03, 0), v(x + c * 0.3, 0.01, sn * 0.3), 0.009, 'aluSchwarz', d))
      }
      s.gruppe.add(saeule(0.015, 0.12, 'kunststoff', x, y - 0.08, 0, d))
    } else {
      for (const z of [-0.04, 0.04]) s.gruppe.add(teil(kastenGeo(0.03, y - 0.02, 0.012, 0.004, d), 'gummi', x, (y - 0.02) / 2, z))
    }
  }
  s.gruppe.add(teil(kastenGeo(0.12, 0.03, 0.1, 0.008, d), 'aluSchwarz', 0, y + 0.024, 0))
  if (d === 'hoch') s.gruppe.add(teil(zylinderXGeo(0.012, 0.012, 0.012, d), 'akzent', 0, y + 0.02, 0.056, [0, Math.PI / 2, 0]))
}

function dolly(g: THREE.Group, o: HalterungOptionen, d: Detail): void {
  const k = kopf(o, 'gross', 1, d)
  const saeuleOben = Math.max(0.45, o.plattenHoeheM - k.hoehe)
  k.gruppe.position.y = saeuleOben
  g.add(k.gruppe)
  const s = schienenGruppe(o)
  g.add(s.gruppe)
  const spur = 0.62
  const schieneY = 0.075
  for (const z of [-spur / 2, spur / 2]) {
    s.gruppe.add(teil(zylinderXGeo(0.024, 0.024, s.laenge, d), 'aluSilber', s.versatz, schieneY, z))
  }
  const schwellen = Math.max(2, Math.round(s.laenge / 0.6) + 1)
  for (let i = 0; i < schwellen; i++) {
    const x = s.versatz - s.laenge / 2 + 0.05 + (i * (s.laenge - 0.1)) / (schwellen - 1)
    s.gruppe.add(teil(kastenGeo(0.09, 0.04, spur + 0.16, 0.006, d), 'holz', x, 0.02, 0))
    for (const z of [-spur / 2, spur / 2]) s.gruppe.add(teil(kastenGeo(0.05, 0.03, 0.05, 0.006, d), 'aluSchwarz', x, 0.055, z))
  }
  // Wagen mit vier Drehgestellen auf den Schienen.
  s.gruppe.add(teil(kastenGeo(1.0, 0.05, 0.72, 0.012, d), 'aluSchwarz', 0, 0.21, 0))
  if (d === 'hoch') s.gruppe.add(teil(kastenGeo(0.96, 0.004, 0.68, 0.002, d), 'gummi', 0, 0.237, 0))
  for (const x of [-0.4, 0.4]) for (const z of [-spur / 2, spur / 2]) {
    s.gruppe.add(teil(kastenGeo(0.16, 0.08, 0.06, 0.01, d), 'aluSchwarz', x, 0.155, z))
    for (const dx of [-0.05, 0.05]) for (const dz of [-1, 1]) {
      s.gruppe.add(teil(zylinderXGeo(0.035, 0.035, 0.02, d), 'kunststoffGrau', x + dx, schieneY + 0.042, z + dz * 0.026, [0, Math.PI / 2, dz * 0.6]))
    }
  }
  // Schiebebuegel hinten.
  for (const z of [-0.28, 0.28]) s.gruppe.add(stab(v(-0.48, 0.235, z), v(-0.6, 1.0, z), 0.014, 'aluSchwarz', d))
  s.gruppe.add(stab(v(-0.6, 1.0, -0.3), v(-0.6, 1.0, 0.3), 0.016, 'gummi', d))
  // Saeule; das Fahrgestell steht unter dem Kopf, also bei x = 0 der Schienengruppe.
  g.add(saeule(0.07, saeuleOben - 0.235, 'aluSilber', 0, (0.235 + saeuleOben) / 2, 0, d))
  g.add(saeule(0.1, 0.04, 'aluSchwarz', 0, saeuleOben - 0.02, 0, d))
  g.add(saeule(0.12, 0.06, 'aluSchwarz', 0, 0.265, 0, d))
}

function schulter(g: THREE.Group, o: HalterungOptionen, d: Detail): void {
  const k = ohneKopf(d)
  k.gruppe.position.y = o.plattenHoeheM - 0.012
  g.add(k.gruppe)
  if (o.eigeneSchulter) return
  const y = o.plattenHoeheM - 0.03
  g.add(teil(kastenGeo(0.18, 0.018, 0.1, 0.005, d), 'aluSchwarz', -0.05, o.plattenHoeheM - 0.009 - 0.012, 0))
  for (const z of [-0.03, 0.03]) g.add(teil(zylinderXGeo(0.0075, 0.0075, 0.62, d, 16), 'aluSilber', -0.06, y - 0.012, z))
  g.add(teil(kastenGeo(0.17, 0.05, 0.11, 0.022, d), 'gummi', -0.14, y - 0.05, 0))
  g.add(teil(kastenGeo(0.08, 0.1, 0.12, 0.012, d), 'gusseisen', -0.35, y - 0.03, 0))
  // Handgriffe an Rosetten.
  for (const z of [-1, 1]) {
    const ro = v(0.2, y - 0.012, z * 0.05)
    const knie = v(0.22, y - 0.03, z * 0.17)
    const griff = v(0.24, y - 0.12, z * 0.2)
    g.add(teil(zahnringGeo(0.016, 0.012, d), 'aluSchwarz', ro.x, ro.y, ro.z, [0, Math.PI / 2, 0]))
    g.add(stab(ro, knie, 0.008, 'aluSchwarz', d))
    g.add(teil(zahnringGeo(0.016, 0.012, d), 'aluSchwarz', knie.x, knie.y, knie.z, [0, Math.PI / 2, 0]))
    g.add(stab(knie, griff, 0.017, 'gummi', d))
  }
}

function wand(g: THREE.Group, o: HalterungOptionen, d: Detail, montage: THREE.Object3D): void {
  const k = ohneKopf(d)
  const y = o.plattenHoeheM - 0.012
  k.gruppe.position.y = y
  g.add(k.gruppe)
  const a = Math.max(0.12, o.wandAbstandM ?? 0.3)
  g.add(teil(kastenGeo(0.012, 0.24, 0.15, 0.003, d), 'lack', -a + 0.006, y - 0.09, 0))
  g.add(teil(kastenGeo(a + 0.1, 0.012, 0.15, 0.003, d), 'lack', (-a + 0.1) / 2, y - 0.006, 0))
  const knotenblech = profilGeo('wandkonsole', [[0, 0], [0, -0.2], [a - 0.02, 0]], 0.01, 0.002, d)
  g.add(teil(knotenblech, 'lack', -a + 0.012, y - 0.012, 0))
  if (d === 'hoch') for (const dy of [-0.02, -0.17]) for (const z of [-0.05, 0.05]) {
    g.add(teil(zylinderXGeo(0.007, 0.007, 0.004, d, 12), 'stahl', -a + 0.014, y + dy, z))
  }
  montage.position.set(-a, y - 0.09, 0)
}

function decke(g: THREE.Group, o: HalterungOptionen, d: Detail, montage: THREE.Object3D): void {
  const abh = Math.max(0.05, o.abhaengungM ?? 0.3)
  const y = o.plattenHoeheM
  const deckeY = y + abh
  g.add(saeule(0.08, 0.012, 'lack', 0, deckeY - 0.006, 0, d))
  g.add(saeule(0.025, abh - 0.024, 'lack', 0, y + abh / 2, 0, d))
  g.add(saeule(0.1, 0.012, 'lack', 0, y + 0.006, 0, d))
  if (d === 'hoch') for (const w of [0, 90, 180, 270]) g.add(saeule(0.007, 0.004, 'stahl', Math.cos(w * DEG) * 0.06, deckeY - 0.013, Math.sin(w * DEG) * 0.06, d))
  const pan = knoten('panGelenk', 0, y, 0)
  pan.rotation.x = Math.PI
  const tilt = knoten('tiltGelenk')
  pan.add(tilt)
  tilt.add(knoten('platte'))
  g.add(pan)
  montage.position.set(0, deckeY, 0)
}

/** Halterung; Ursprung am Boden unter der Pan-Achse, Blick bei Pan 0 nach +x. */
export function erzeugeHalterung(o: HalterungOptionen): THREE.Group {
  const d = o.detail ?? 'hoch'
  const g = new THREE.Group()
  g.name = 'halterung'
  const montage = knoten('montagepunkt')
  g.add(montage)
  switch (o.art) {
    case 'stativ': stativ(g, o, d); break
    case 'pedestal': pedestal(g, o, d); break
    case 'kran': kran(g, o, d, montage); break
    case 'slider': slider(g, o, d); break
    case 'dolly': dolly(g, o, d); break
    case 'schulter': schulter(g, o, d); break
    case 'wand': wand(g, o, d, montage); break
    case 'decke': decke(g, o, d, montage); break
    case 'keine': {
      const pan = knoten('panGelenk', 0, o.plattenHoeheM, 0)
      const tilt = knoten('tiltGelenk')
      pan.add(tilt)
      tilt.add(knoten('platte'))
      g.add(pan)
      break
    }
  }
  return g
}

export function halterungsKnoten(h: THREE.Object3D): HalterungsKnoten {
  const hole = (n: string): THREE.Object3D => {
    const o = h.getObjectByName(n)
    if (!o) throw new Error(`Halterung ohne Knoten ${n}`)
    return o
  }
  return { panGelenk: hole('panGelenk'), tiltGelenk: hole('tiltGelenk'), platte: hole('platte'), montagepunkt: hole('montagepunkt') }
}
