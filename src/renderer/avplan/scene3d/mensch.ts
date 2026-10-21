// Menschen ohne Modelldatei.
//
// Detail 'niedrig' (Publikum): ein Koerper aus Kapseln zwischen Gelenkpunkten, Rumpf und Kopf gedreht —
// je Pose eine Gelenktabelle. Jeder Eckpunkt traegt seinen Teil (Haut,
// Oberteil, Hose, Haar, Schuh, Unterarm), damit eine Geometrie fuer tausende
// Instanzen reicht und die Farben je Person im Shader entstehen.
//
// Warum gebaut statt geladen: ein Publikum aus Skelett-Modellen ist zu teuer
// (zehntausend Knochen-Saetze), und fuer frei verfuegbare, fotorealistische
// Personen-Scans fehlt eine klare Lizenz. Fuer einzelne Personen kann eine
// GLB-Datei dazukommen (`personModell.ts`).
//
// Detail 'hoch' (einzelne Personen) baut `menschKoerper.ts`: Lofts mit
// anatomischen Profilen, Kleidung, Haar, PBR-Material.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { istSitzend, skelett, type Pose } from './menschSkelett'
import { koerperGeometrie, TEIL_DETAIL, vollstaendig, type Gestalt } from './menschKoerper'
import { menschMaterial } from './menschMaterial'

export { POSEN, istSitzend, type Pose } from './menschSkelett'
export { koerperGeometrie, TEIL_DETAIL, GESTALT_STANDARD, type Gestalt, type Statur, type Oberteil, type Unterteil, type Schuhe } from './menschKoerper'
export { menschMaterial, type MenschMaterialOptionen } from './menschMaterial'

export type Detail = 'niedrig' | 'hoch'

/** Teile in der Reihenfolge des Shaders. */
export const TEIL = { haut: 0, oben: 1, unten: 2, haar: 3, schuh: 4, unterarm: 5 } as const

type V = [number, number, number]

interface Gelenke {
  huefte: V
  hals: V
  kopf: V
  hueftL: V; knieL: V; knoechelL: V; zehL: V
  schulterL: V; ellbogenL: V; handL: V
  /** Abweichungen der rechten Seite (in gespiegelten Koordinaten); sonst gespiegelt. */
  rechts?: Partial<Pick<Gelenke, 'hueftL' | 'schulterL' | 'ellbogenL' | 'handL' | 'knieL' | 'knoechelL' | 'zehL'>>
}

/** Normgroesse 1,75 m, Blick nach +z, Fuesse bzw. Sitzflaeche auf y = 0 / 0,45. */
const KAPSEL_POSEN: Partial<Record<Pose, Gelenke>> = {
  stehen: {
    huefte: [0, 0.88, 0], hals: [0, 1.47, -0.01], kopf: [0, 1.625, 0.01],
    hueftL: [0.095, 0.9, 0], knieL: [0.1, 0.5, 0.02], knoechelL: [0.1, 0.09, -0.01], zehL: [0.105, 0.035, 0.13],
    schulterL: [0.2, 1.41, -0.015], ellbogenL: [0.24, 1.13, -0.05], handL: [0.24, 0.88, 0.06],
    rechts: { ellbogenL: [0.235, 1.12, -0.03], handL: [0.21, 0.9, 0.1] },
  },
  sitzen: {
    huefte: [0, 0.49, -0.04], hals: [0, 1.07, 0.0], kopf: [0, 1.225, 0.03],
    hueftL: [0.1, 0.5, -0.02], knieL: [0.11, 0.52, 0.42], knoechelL: [0.115, 0.09, 0.46], zehL: [0.115, 0.035, 0.6],
    schulterL: [0.19, 1.01, -0.01], ellbogenL: [0.22, 0.74, 0.08], handL: [0.15, 0.58, 0.3],
  },
  jubeln: {
    huefte: [0, 0.88, 0], hals: [0, 1.47, 0.0], kopf: [0, 1.63, 0.02],
    hueftL: [0.095, 0.9, 0], knieL: [0.1, 0.5, 0.02], knoechelL: [0.1, 0.09, -0.01], zehL: [0.105, 0.035, 0.13],
    schulterL: [0.19, 1.41, -0.01], ellbogenL: [0.29, 1.66, 0.04], handL: [0.33, 1.93, 0.09],
    rechts: { ellbogenL: [0.3, 1.62, 0.06], handL: [0.31, 1.88, 0.12] },
  },
}

const spiegel = (v: V): V => [-v[0], v[1], v[2]]

/** Gelenktabelle fuer die Kapselfigur; neuere Posen kommen aus dem Skelett. */
function kapselGelenke(pose: Pose): Gelenke {
  const alt = KAPSEL_POSEN[pose]
  if (alt) return alt
  const sk = skelett(pose)
  const v = (p: THREE.Vector3, dy = 0): V => [p.x, p.y + dy, p.z]
  const [al, ar] = sk.arme
  const [bl, br] = sk.beine
  const zeh = (b: typeof bl): V => [b.knoechel.x + b.fuss.x * 0.14, 0.035, b.knoechel.z + b.fuss.z * 0.14]
  const hand = (a: typeof al) => v(a.handgelenk.clone().addScaledVector(a.finger, 0.04))
  return {
    huefte: v(sk.becken, -0.01), hals: v(sk.hals, -0.02), kopf: v(sk.kopf, 0.005),
    hueftL: v(bl.huefte, 0.01), knieL: v(bl.knie), knoechelL: v(bl.knoechel, 0.015), zehL: zeh(bl),
    schulterL: v(al.schulter, -0.01), ellbogenL: v(al.ellbogen), handL: hand(al),
    rechts: {
      hueftL: spiegel(v(br.huefte, 0.01)), knieL: spiegel(v(br.knie)), knoechelL: spiegel(v(br.knoechel, 0.015)), zehL: spiegel(zeh(br)),
      schulterL: spiegel(v(ar.schulter, -0.01)), ellbogenL: spiegel(v(ar.ellbogen)), handL: spiegel(hand(ar)),
    },
  }
}

interface Aufloesung {
  rund: number
  kappe: number
  rumpf: number
  kopfB: number
  kopfH: number
  rumpfProfil: [number, number][]
}

// Nur noch fuer die Kapselfigur; 'hoch' baut menschKoerper.ts.
const AUF: Aufloesung = {
  rund: 4, kappe: 1, rumpf: 6, kopfB: 7, kopfH: 5,
  rumpfProfil: [[0.001, 0], [0.155, 0.04], [0.14, 0.38], [0.172, 0.76], [0.12, 0.96], [0.03, 1]],
}

function mitTeil(g: THREE.BufferGeometry, teil: number | ((p: THREE.Vector3) => number)): THREE.BufferGeometry {
  g.deleteAttribute('uv')
  const pos = g.getAttribute('position')
  const werte = new Float32Array(pos.count)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    werte[i] = typeof teil === 'number' ? teil : teil(p)
  }
  g.setAttribute('teil', new THREE.BufferAttribute(werte, 1))
  return g
}

/** Kapsel von a nach b. `teilFn` bekommt den Punkt in Kapsel-Koordinaten (y von -l/2 bis l/2). */
function glied(a: V, b: V, r: number, auf: Aufloesung, teil: number | ((p: THREE.Vector3, l: number) => number)): THREE.BufferGeometry {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const richtung = vb.clone().sub(va)
  const l = Math.max(0.01, richtung.length())
  const g = new THREE.CapsuleGeometry(r, l, auf.kappe, auf.rund)
  mitTeil(g, typeof teil === 'number' ? teil : (p) => teil(p, l))
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung.normalize()))
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)
  return g
}

function rumpf(j: Gelenke, auf: Aufloesung): THREE.BufferGeometry {
  const unten = new THREE.Vector3(...j.huefte)
  const oben = new THREE.Vector3(...j.hals)
  const richtung = oben.clone().sub(unten)
  const l = richtung.length()
  const g = new THREE.LatheGeometry(auf.rumpfProfil.map(([r, t]) => new THREE.Vector2(r, t * l)), auf.rumpf)
  g.scale(1, 1, 0.64)
  mitTeil(g, (p) => (p.y < l * 0.3 ? TEIL.unten : TEIL.oben))
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung.normalize()))
  g.translate(unten.x, unten.y, unten.z)
  return g
}

function kopf(j: Gelenke, auf: Aufloesung): THREE.BufferGeometry[] {
  const g = new THREE.SphereGeometry(0.1, auf.kopfB, auf.kopfH)
  g.scale(0.84, 1.1, 1.0)
  // Haar: Kappe oben und hinten. Gesicht, Ohren und Nacken bleiben Haut.
  mitTeil(g, (p) => (p.y > 0.035 || (p.y > -0.06 && p.z < -0.035) ? TEIL.haar : TEIL.haut))
  g.translate(...j.kopf)
  return [g, glied(j.hals, [j.kopf[0], j.kopf[1] - 0.07, j.kopf[2] - 0.01], 0.048, auf, TEIL.haut)]
}

function seite(j: Gelenke, links: boolean): Pick<Gelenke, 'hueftL' | 'knieL' | 'knoechelL' | 'zehL' | 'schulterL' | 'ellbogenL' | 'handL'> {
  const r = links ? {} : (j.rechts ?? {})
  const s = (v: V) => (links ? v : spiegel(v))
  return {
    hueftL: s(r.hueftL ?? j.hueftL),
    knieL: s(r.knieL ?? j.knieL),
    knoechelL: s(r.knoechelL ?? j.knoechelL),
    zehL: s(r.zehL ?? j.zehL),
    schulterL: s(r.schulterL ?? j.schulterL),
    ellbogenL: s(r.ellbogenL ?? j.ellbogenL),
    handL: s(r.handL ?? j.handL),
  }
}

const CACHE = new Map<string, THREE.BufferGeometry>()

function kapselGeometrie(pose: Pose): THREE.BufferGeometry {
  const j = kapselGelenke(pose)
  const teile: THREE.BufferGeometry[] = [rumpf(j, AUF), ...kopf(j, AUF)]
  for (const links of [true, false]) {
    const s = seite(j, links)
    teile.push(glied(s.hueftL, s.knieL, 0.072, AUF, TEIL.unten))
    teile.push(glied(s.knieL, s.knoechelL, 0.055, AUF, TEIL.unten))
    teile.push(glied(s.knoechelL, s.zehL, 0.042, AUF, TEIL.schuh))
    teile.push(glied(s.schulterL, s.ellbogenL, 0.05, AUF, TEIL.oben))
    teile.push(glied(s.ellbogenL, s.handL, 0.04, AUF, TEIL.unterarm))
  }
  const g = mergeGeometries(teile, false)
  teile.forEach((t) => t.dispose())
  if (!g) throw new Error('Menschen-Geometrie liess sich nicht zusammenfuegen.')
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/**
 * Geometrie eines Menschen in Normgroesse (1,75 m) mit Attribut `teil`.
 * 'niedrig': Kapselfigur fuers Publikum (TEIL); 'hoch': detaillierter
 * Koerper in Standard-Gestalt (TEIL_DETAIL, dazu `atem` und `tangent`).
 * Gecacht je Pose und Detail — nicht veraendern, sondern skalieren.
 */
export function menschGeometrie(pose: Pose, detail: Detail = 'niedrig'): THREE.BufferGeometry {
  const schluessel = `${pose}|${detail}`
  const fertig = CACHE.get(schluessel)
  if (fertig) return fertig
  const g = detail === 'hoch' ? koerperGeometrie(pose) : kapselGeometrie(pose)
  CACHE.set(schluessel, g)
  return g
}

export interface MenschFarben {
  oben: THREE.ColorRepresentation
  unten: THREE.ColorRepresentation
  haut: THREE.ColorRepresentation
  haar: THREE.ColorRepresentation
  schuh?: THREE.ColorRepresentation
  /** Lange Aermel: ohne `gestalt.oberteil` wird daraus ein Hemd statt T-Shirt. */
  langarm?: boolean
  /** Sakko; ohne Angabe ein dunkles Grau. */
  jacke?: THREE.ColorRepresentation
  augen?: THREE.ColorRepresentation
}

export interface MenschGestalt extends Gestalt {
  /** Ruhebewegung (Atmen, Gewicht verlagern) aus der Szenenzeit; 0 = still. */
  ruhe?: number
  /** 0..1, damit nebeneinander Stehende nicht im Gleichtakt atmen. */
  phase?: number
}

const SOHLE: Record<string, string> = { sneaker: '#e9e7e2', halbschuh: '#17120e', stiefel: '#1b1714' }

/**
 * Einzelner Mensch (Buehne, Referenzperson) mit festen Farben, detailliert.
 * Ein Mesh mit einem Material; Geometrie gehoert dem Aufrufer.
 */
export function erzeugeMensch(pose: Pose, farben: MenschFarben, groesseM = 1.75, gestalt: MenschGestalt = {}): THREE.Mesh {
  const voll = vollstaendig({ oberteil: farben.langarm ? 'hemd' : 'tshirt', ...stripUndefined(gestalt) })
  const standard = Object.keys(stripUndefined(gestalt)).every((k) => k === 'ruhe' || k === 'phase') && voll.oberteil === 'tshirt'
  const g = standard ? menschGeometrie(pose, 'hoch').clone() : koerperGeometrie(pose, voll)
  const teil = g.getAttribute('teil')
  const haut = new THREE.Color(farben.haut)
  const tabelle: THREE.Color[] = []
  tabelle[TEIL_DETAIL.haut] = haut
  tabelle[TEIL_DETAIL.oben] = new THREE.Color(farben.oben)
  tabelle[TEIL_DETAIL.unten] = new THREE.Color(farben.unten)
  tabelle[TEIL_DETAIL.haar] = new THREE.Color(farben.haar)
  tabelle[TEIL_DETAIL.schuh] = new THREE.Color(farben.schuh ?? '#16171a')
  tabelle[TEIL_DETAIL.unterarm] = farben.langarm ? tabelle[TEIL_DETAIL.oben] : haut
  tabelle[TEIL_DETAIL.jacke] = new THREE.Color(farben.jacke ?? '#2b2d33')
  tabelle[TEIL_DETAIL.auge] = new THREE.Color('#bdb6ab')
  tabelle[TEIL_DETAIL.iris] = new THREE.Color(farben.augen ?? '#3b2a1e')
  tabelle[TEIL_DETAIL.lippe] = haut.clone().multiply(new THREE.Color(0.9, 0.7, 0.68))
  tabelle[TEIL_DETAIL.sohle] = new THREE.Color(SOHLE[voll.schuhe])
  tabelle[TEIL_DETAIL.requisit] = new THREE.Color('#1c1d20')
  const farbe = new Float32Array(teil.count * 3)
  for (let i = 0; i < teil.count; i++) {
    const f = tabelle[Math.round(teil.getX(i))] ?? haut
    farbe.set([f.r, f.g, f.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(farbe, 3))
  const s = groesseM / 1.75
  g.scale(s, s, s)
  const mat = menschMaterial({ ruhe: gestalt.ruhe ?? 0, phase: gestalt.phase ?? 0, basis: istSitzend(pose) ? 0.45 * s : 0 })
  const mesh = new THREE.Mesh(g, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>
}
