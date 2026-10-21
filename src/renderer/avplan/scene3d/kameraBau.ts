// Gemeinsames Werkzeug fuer die Kameratechnik: Materialien, geteilte
// Geometrien, Bauteil-Helfer.
//
// Achsen in allen Kamera-Bauteilen (wie das Rig-Koordinatensystem im
// multicam-planner, `rigGeometry.ts`): +x = Blickrichtung der Optik,
// +y = oben, +z = rechts aus Sicht des Kameramanns. Masse in Metern.
//
// Materialien und feste Geometrien liegen in einem Modul-Cache und werden von
// allen Rigs geteilt; `entsorge` (scheinwerfer.ts) darf sie deshalb nicht
// sehen — Rigs raeumen ueber `entsorgeKameraTeil` auf, den Cache leert
// `entsorgeKameraCache`.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Detail } from './mensch'

const GETEILT = 'avplanGeteilt'

const geometrien = new Map<string, THREE.BufferGeometry>()
const materialien = new Map<string, THREE.Material>()

function geteilt<T extends THREE.BufferGeometry>(schluessel: string, bau: () => T): T {
  let g = geometrien.get(schluessel)
  if (!g) {
    g = bau()
    g.userData[GETEILT] = true
    geometrien.set(schluessel, g)
  }
  return g as T
}

/** Millimeter-Schluessel: verhindert, dass Rundungsrauschen den Cache aufblaeht. */
const mm = (...w: number[]): string => w.map((v) => Math.round(v * 1000)).join('x')

export const segmente = (d: Detail, hoch: number, niedrig: number): number => (d === 'hoch' ? hoch : niedrig)

// ---------------------------------------------------------------------------
// Materialien
// ---------------------------------------------------------------------------

export type MaterialName =
  | 'aluSchwarz' | 'aluSilber' | 'aluGrau' | 'stahl' | 'kunststoff' | 'kunststoffGrau' | 'kunststoffHell'
  | 'gummi' | 'glas' | 'glasTief' | 'display' | 'evf' | 'tallyAus' | 'tallyRot' | 'tallyGruen'
  | 'lack' | 'gusseisen' | 'holz' | 'akzent' | 'balg'

function baueMaterial(n: MaterialName): THREE.Material {
  const std = (color: string, metalness: number, roughness: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra })
  switch (n) {
    // Schwarz eloxiert: metallisch, aber stumpfer Glanz.
    case 'aluSchwarz': return std('#26272b', 0.55, 0.46)
    case 'aluSilber': return std('#c3c6cb', 1, 0.27)
    case 'aluGrau': return std('#55585e', 0.6, 0.42)
    case 'stahl': return std('#8d9096', 1, 0.33)
    case 'kunststoff': return std('#1a1b1d', 0, 0.62)
    case 'kunststoffGrau': return std('#3b3e44', 0, 0.55)
    // Gebrochenes Weiss grosser Broadcast-Objektive.
    case 'kunststoffHell': return std('#d8d5cc', 0, 0.48)
    case 'gummi': return std('#0f0f10', 0, 0.9)
    case 'balg': return std('#141415', 0, 0.85, { side: THREE.DoubleSide })
    case 'lack': return std('#cfcfcb', 0, 0.45)
    case 'gusseisen': return std('#303236', 0.55, 0.55)
    case 'holz': return std('#6b5137', 0, 0.8)
    case 'akzent': return std('#b0313a', 0.1, 0.45)
    // Vorderlinse: fast schwarz, klar lackiert; der Interferenz-Anteil gibt
    // den gruen-violetten Vergütungsreflex, ohne teure Transmission.
    case 'glas': return new THREE.MeshPhysicalMaterial({
      color: '#05070a', metalness: 0, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02,
      iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [220, 480], envMapIntensity: 1.2,
    })
    case 'glasTief': return std('#0b1119', 0.4, 0.12)
    case 'display': return std('#050607', 0.1, 0.18, { emissive: '#27466b', emissiveIntensity: 0.55 })
    case 'evf': return std('#040405', 0.1, 0.25, { emissive: '#3a3f46', emissiveIntensity: 0.25 })
    case 'tallyAus': return std('#3a0d0c', 0, 0.3)
    // Ueber 1 leuchtet es in den Bloom der Pipeline.
    case 'tallyRot': return std('#ff2a1e', 0, 0.3, { emissive: '#ff1a10', emissiveIntensity: 4 })
    case 'tallyGruen': return std('#1eff4a', 0, 0.3, { emissive: '#10ff3a', emissiveIntensity: 3 })
  }
}

export function kameraMaterial(n: MaterialName): THREE.Material {
  let m = materialien.get(n)
  if (!m) {
    m = baueMaterial(n)
    m.userData[GETEILT] = true
    materialien.set(n, m)
  }
  return m
}

// ---------------------------------------------------------------------------
// Geometrien
// ---------------------------------------------------------------------------

/** Abgerundeter Kasten; Masse x (Laenge) × y (Hoehe) × z (Breite). */
export function kastenGeo(lx: number, hy: number, bz: number, radius: number, d: Detail): THREE.BufferGeometry {
  const r = Math.min(radius, lx / 2 - 1e-4, hy / 2 - 1e-4, bz / 2 - 1e-4)
  const s = segmente(d, 3, 1)
  return geteilt(`kasten:${mm(lx, hy, bz, r)}:${s}`, () => new RoundedBoxGeometry(lx, hy, bz, s, Math.max(r, 1e-4)))
}

/** Zylinder entlang +x, Mitte im Ursprung. */
export function zylinderXGeo(rVorn: number, rHinten: number, laenge: number, d: Detail, seg?: number): THREE.BufferGeometry {
  const n = seg ?? segmente(d, 40, 14)
  return geteilt(`zylX:${mm(rVorn, rHinten, laenge)}:${n}`, () => {
    const g = new THREE.CylinderGeometry(rVorn, rHinten, laenge, n)
    g.rotateZ(-Math.PI / 2)
    return g
  })
}

/** Einheitszylinder entlang +y (0..1); fuer Stangen per Skalierung gestreckt. */
function stabGeo(r: number, d: Detail): THREE.BufferGeometry {
  const n = segmente(d, 20, 8)
  return geteilt(`stab:${mm(r)}:${n}`, () => {
    const g = new THREE.CylinderGeometry(r, r, 1, n)
    g.translate(0, 0.5, 0)
    return g
  })
}

export function kugelGeo(r: number, d: Detail): THREE.BufferGeometry {
  const n = segmente(d, 32, 12)
  return geteilt(`kugel:${mm(r)}:${n}`, () => new THREE.SphereGeometry(r, n, Math.round(n * 0.6)))
}

export function torusGeo(r: number, rohr: number, d: Detail): THREE.BufferGeometry {
  const n = segmente(d, 48, 16)
  return geteilt(`torus:${mm(r, rohr)}:${n}`, () => {
    const g = new THREE.TorusGeometry(r, rohr, segmente(d, 12, 6), n)
    g.rotateX(Math.PI / 2)
    return g
  })
}

/**
 * Drehkoerper um die x-Achse aus [radius, x]-Punkten (von hinten nach vorn).
 * Lathe dreht um y; danach wird y auf +x gelegt.
 */
export function drehkoerperGeo(schluessel: string, profil: Array<[number, number]>, d: Detail): THREE.BufferGeometry {
  const n = segmente(d, 48, 16)
  return geteilt(`dreh:${schluessel}:${profil.map((p) => mm(p[0], p[1])).join(',')}:${n}`, () => {
    const g = new THREE.LatheGeometry(profil.map(([r, x]) => new THREE.Vector2(Math.max(r, 0), x)), n)
    g.rotateZ(-Math.PI / 2)
    return g
  })
}

/** Zahnkranz (Follow-Focus-Ring) entlang +x, Mitte im Ursprung. */
export function zahnringGeo(rAussen: number, breite: number, d: Detail): THREE.BufferGeometry {
  if (d === 'niedrig') return zylinderXGeo(rAussen, rAussen, breite, d)
  // Modul 0,8 wie an Cine-Objektiven; Zahnhoehe ~1,6 mm.
  const zaehne = Math.max(24, Math.round((2 * Math.PI * rAussen) / 0.0025))
  return geteilt(`zahn:${mm(rAussen, breite)}:${zaehne}`, () => {
    const form = new THREE.Shape()
    const rIn = rAussen - 0.0016
    const schritte = zaehne * 4
    for (let i = 0; i <= schritte; i++) {
      const a = (i / schritte) * Math.PI * 2
      const r = i % 4 < 2 ? rAussen : rIn
      if (i === 0) form.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else form.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    const g = new THREE.ExtrudeGeometry(form, { depth: breite, bevelEnabled: false, curveSegments: 1 })
    g.translate(0, 0, -breite / 2)
    g.rotateY(Math.PI / 2)
    return g
  })
}

/** Prisma aus einer 2D-Kontur in der x/y-Ebene, um `dicke` in z mittig extrudiert. */
export function profilGeo(schluessel: string, punkte: Array<[number, number]>, dicke: number, fase: number, d: Detail): THREE.BufferGeometry {
  return geteilt(`profil:${schluessel}:${mm(dicke, fase)}:${d}`, () => {
    const form = new THREE.Shape(punkte.map(([x, y]) => new THREE.Vector2(x, y)))
    const f = d === 'hoch' ? fase : 0
    const g = new THREE.ExtrudeGeometry(form, {
      depth: Math.max(dicke - 2 * f, 1e-4), bevelEnabled: f > 0, bevelThickness: f, bevelSize: f, bevelSegments: 2, curveSegments: 6,
    })
    g.translate(0, 0, -dicke / 2 + f)
    return g
  })
}

/** Kabel als Rohr entlang einer Kurve; eigene Geometrie je Aufruf. */
export function kabelGeo(punkte: THREE.Vector3[], r: number, d: Detail): THREE.BufferGeometry {
  const kurve = new THREE.CatmullRomCurve3(punkte)
  return new THREE.TubeGeometry(kurve, segmente(d, 48, 12), r, segmente(d, 8, 5), false)
}

// ---------------------------------------------------------------------------
// Bauteile
// ---------------------------------------------------------------------------

export function teil(
  geo: THREE.BufferGeometry, mat: MaterialName, x = 0, y = 0, z = 0,
  dreh?: [number, number, number], name?: string,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, kameraMaterial(mat))
  m.position.set(x, y, z)
  if (dreh) m.rotation.set(dreh[0], dreh[1], dreh[2])
  m.castShadow = mat !== 'glas' && mat !== 'display' && mat !== 'evf'
  m.receiveShadow = true
  if (name) m.name = name
  return m
}

/** Stange von a nach b (z. B. Stativbein, Ausleger). */
export function stab(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: MaterialName, d: Detail): THREE.Mesh {
  const richtung = b.clone().sub(a)
  const laenge = richtung.length()
  const m = teil(stabGeo(r, d), mat)
  m.position.copy(a)
  if (laenge > 1e-6) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), richtung.divideScalar(laenge))
  m.scale.set(1, Math.max(laenge, 1e-4), 1)
  return m
}

export function knoten(name: string, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group()
  g.name = name
  g.position.set(x, y, z)
  return g
}

/** Gibt nur die nicht geteilten Geometrien eines Teilbaums frei. */
export function entsorgeKameraTeil(wurzel: THREE.Object3D): void {
  wurzel.traverse((o) => {
    const g = (o as THREE.Mesh).geometry
    if (g && !g.userData[GETEILT]) g.dispose()
  })
  wurzel.removeFromParent()
}

/** Leert den Cache aller Kamera-Bauteile (z. B. beim Schliessen der 3D-Ansicht). */
export function entsorgeKameraCache(): void {
  for (const g of geometrien.values()) g.dispose()
  for (const m of materialien.values()) m.dispose()
  geometrien.clear()
  materialien.clear()
}

/** Groesse des Caches; fuer Tests und Diagnose. */
export function kameraCacheGroesse(): { geometrien: number; materialien: number } {
  return { geometrien: geometrien.size, materialien: materialien.size }
}
