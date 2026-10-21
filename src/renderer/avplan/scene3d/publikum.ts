// Publikum, Sitze und Tribuenenstufen als Instanzen: ein Draw-Call je Pose,
// egal ob dreissig oder dreissigtausend Menschen.
//
// Plan → Welt wie in allen Planern: Plan-x = Welt-x, Plan-y = Welt-z,
// Hoehe = Welt-y. Ein Plan-Winkel θ (0 = +x, im Uhrzeigersinn) wird zu
// rotation.y = −θ fuer ein Objekt, dessen Breite entlang lokal +x liegt,
// und zu π/2 − θ fuer einen Menschen, der nach lokal +z blickt.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { istSitzend, menschGeometrie, type Detail, type Pose } from './mensch'
import { SZENEN_ZEIT } from './dunst'
import { oberflaechenMaterial } from './oberflaechen'

export interface PublikumsPlatz {
  x: number
  y: number
  /** Standflaeche bzw. Stufenoberkante ueber dem Boden. */
  z: number
  blickDeg: number
  /** 0..1, deterministisch je Platz. */
  r: number
  pose: Pose
}

// Kleidung, wie sie in einer Halle sitzt: viel Schwarz, Navy, Grau, Denim,
// dazwischen wenige kraeftige Farben.
const OBEN = ['#121316', '#1b1d22', '#23262d', '#2c3340', '#1e2a44', '#3a3d44', '#5b5f66', '#8d9097', '#d8d6d0', '#efeeea', '#7a2630', '#33502f', '#a7782d', '#40597a', '#6b4a3a', '#4b3b5a']
const UNTEN = ['#1a2333', '#22304a', '#2e3d57', '#151619', '#23252a', '#4a4d52', '#6a6250', '#3b3127', '#2b3a52']
const HAUT = ['#f1d1b8', '#e6bc9c', '#d4a283', '#bf8a68', '#a06d4e', '#7d5136', '#5c3a26', '#efc8a8']
const HAAR = ['#0f0d0c', '#1f1813', '#3a2a1e', '#5a4130', '#8a6a48', '#b89b70', '#8f8a84', '#d0ccc4', '#2a1d16']

function wahl<T>(liste: T[], r: number): T {
  return liste[Math.min(liste.length - 1, Math.floor(r * liste.length))]
}

/** Weitere Zufallszahl aus derselben Platz-Zahl — Farbe, Groesse und Haltung sollen nicht gleichlaufen. */
function abgeleitet(r: number, k: number): number {
  const x = Math.sin((r + k * 0.618) * 12.9898 * (k + 1)) * 43758.5453
  return x - Math.floor(x)
}

export interface Variante {
  groesse: number
  breite: number
  /** Zusatzdrehung um die Hochachse in Grad. */
  drehungDeg: number
  /** Neigung nach vorn/hinten bzw. seitlich in Grad. */
  neigungDeg: number
  seitDeg: number
  oben: string
  unten: string
  haut: string
  haar: string
  langarm: boolean
}

export function publikumsVariante(r: number): Variante {
  return {
    groesse: 1.58 + abgeleitet(r, 1) * 0.36,
    breite: 0.9 + abgeleitet(r, 2) * 0.24,
    drehungDeg: (abgeleitet(r, 3) - 0.5) * 22,
    neigungDeg: (abgeleitet(r, 4) - 0.5) * 8,
    seitDeg: (abgeleitet(r, 5) - 0.5) * 6,
    oben: wahl(OBEN, abgeleitet(r, 6)),
    unten: wahl(UNTEN, abgeleitet(r, 7)),
    haut: wahl(HAUT, abgeleitet(r, 8)),
    haar: wahl(HAAR, abgeleitet(r, 9)),
    langarm: abgeleitet(r, 10) < 0.55,
  }
}

/**
 * Pose je Platz: sitzend bleibt sitzend; auf Stehflaechen hebt ein Teil die
 * Haende (`jubelAnteil`), wie es in einem Konzert oder Lobpreis aussieht.
 */
export function poseFuer(stehen: boolean, r: number, jubelAnteil = 0.15): Pose {
  if (!stehen) return 'sitzen'
  return abgeleitet(r, 11) < jubelAnteil ? 'jubeln' : 'stehen'
}

const PUBLIKUM_VERT_KOPF = /* glsl */ `
  attribute float teil;
  attribute vec3 aOben;
  attribute vec3 aUnten;
  attribute vec3 aHaut;
  attribute vec4 aHaar;
  attribute float aPhase;
  uniform float uZeit;
  uniform float uWiegen;
  varying vec3 vTeilFarbe;
`

// Lambert statt PBR: tausende kleine Figuren, deren Glanzlicht niemand sieht —
// das Physik-Modell kostete hier ein Drittel der Bildzeit.
function publikumMaterial(wiegen: number, detail: Detail): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial()
  if (detail === 'hoch') mat.defines = { MENSCH_DETAIL: '' }
  const uWiegen = { value: wiegen }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uZeit = SZENEN_ZEIT
    shader.uniforms.uWiegen = uWiegen
    shader.vertexShader = PUBLIKUM_VERT_KOPF + shader.vertexShader
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        float hoehe = max(0.0, position.y - 0.45);
        float arm = step(1.5, position.y) * step(0.18, abs(position.x));
        float w = uZeit * 1.15 + aPhase * 6.2832;
        transformed.x += uWiegen * (sin(w) * 0.022 * hoehe + sin(w * 1.7) * 0.07 * arm);
        transformed.z += uWiegen * cos(w * 0.8) * 0.012 * hoehe;`)
      .replace('#include <color_vertex>', /* glsl */ `#include <color_vertex>
        vTeilFarbe = teil < 0.5 ? aHaut : teil < 1.5 ? aOben : teil < 2.5 ? aUnten : teil < 3.5 ? aHaar.rgb : teil < 4.5 ? vec3(0.03) : mix(aHaut, aOben, aHaar.a);
        #ifdef MENSCH_DETAIL
          // TEIL_DETAIL: Sakko wie Oberteil, Augen/Requisit dunkel, Lippen aus der Haut.
          if (teil > 5.5) vTeilFarbe = teil < 6.5 ? aOben * 0.6 : teil < 8.5 ? vec3(0.05) : teil < 9.5 ? aHaut * vec3(0.86, 0.6, 0.6) : vec3(0.03);
        #endif`)
    shader.fragmentShader = 'varying vec3 vTeilFarbe;\n' + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= vTeilFarbe;')
  }
  mat.customProgramCacheKey = () => `avplan-publikum-${detail}`
  return mat
}

export interface PublikumOptionen {
  detail?: Detail
  /** Leichtes Wiegen der Stehenden (0 = still). */
  wiegen?: number
  /** Obergrenze; darueber wird gleichmaessig ausgeduennt. */
  max?: number
}

/**
 * Publikum als Gruppe aus bis zu drei InstancedMesh (eine je Pose).
 * Wirft keine Schatten — das waeren zehntausende Schattenkoerper.
 */
export function erzeugePublikum(plaetze: PublikumsPlatz[], o: PublikumOptionen = {}): THREE.Group {
  const gruppe = new THREE.Group()
  gruppe.name = 'publikum'
  const max = o.max ?? 40000
  const schritt = plaetze.length > max ? plaetze.length / max : 1
  const auswahl: PublikumsPlatz[] = []
  for (let i = 0; i < plaetze.length && auswahl.length < max; i += schritt) auswahl.push(plaetze[Math.floor(i)])
  const nachPose = new Map<Pose, PublikumsPlatz[]>()
  for (const p of auswahl) {
    const l = nachPose.get(p.pose) ?? []
    l.push(p)
    nachPose.set(p.pose, l)
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler(0, 0, 0, 'YXZ')
  const pos = new THREE.Vector3()
  const skala = new THREE.Vector3()
  const c = new THREE.Color()
  for (const [pose, liste] of nachPose) {
    const geo = menschGeometrie(pose, o.detail ?? 'niedrig').clone()
    const n = liste.length
    const aOben = new Float32Array(n * 3)
    const aUnten = new Float32Array(n * 3)
    const aHaut = new Float32Array(n * 3)
    const aHaar = new Float32Array(n * 4)
    const aPhase = new Float32Array(n)
    const mesh = new THREE.InstancedMesh(geo, publikumMaterial(istSitzend(pose) ? (o.wiegen ?? 1) * 0.25 : (o.wiegen ?? 1), o.detail ?? 'niedrig'), n)
    liste.forEach((p, i) => {
      const v = publikumsVariante(p.r)
      const s = v.groesse / 1.75
      e.set((v.neigungDeg * Math.PI) / 180, Math.PI / 2 - ((p.blickDeg + v.drehungDeg) * Math.PI) / 180, (v.seitDeg * Math.PI) / 180)
      q.setFromEuler(e)
      // Sitzende sitzen auf einem Sitz von 0,45 m; die Geometrie hat die
      // Sitzflaeche schon dort, also nicht mit der Groesse mitskalieren.
      pos.set(p.x, p.z + (istSitzend(pose) ? 0.45 * (1 - s) : 0), p.y)
      skala.set(s * v.breite, s, s * v.breite)
      m.compose(pos, q, skala)
      mesh.setMatrixAt(i, m)
      c.set(v.oben).toArray(aOben, i * 3)
      c.set(v.unten).toArray(aUnten, i * 3)
      c.set(v.haut).toArray(aHaut, i * 3)
      c.set(v.haar).toArray(aHaar, i * 4)
      aHaar[i * 4 + 3] = v.langarm ? 1 : 0
      aPhase[i] = abgeleitet(p.r, 12)
    })
    geo.setAttribute('aOben', new THREE.InstancedBufferAttribute(aOben, 3))
    geo.setAttribute('aUnten', new THREE.InstancedBufferAttribute(aUnten, 3))
    geo.setAttribute('aHaut', new THREE.InstancedBufferAttribute(aHaut, 3))
    geo.setAttribute('aHaar', new THREE.InstancedBufferAttribute(aHaar, 4))
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(aPhase, 1))
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.receiveShadow = true
    mesh.name = `publikum-${pose}`
    gruppe.add(mesh)
  }
  return gruppe
}

function sitzGeometrie(): THREE.BufferGeometry {
  const teile: THREE.BufferGeometry[] = []
  const box = (b: number, h: number, t: number, x: number, y: number, z: number, rx = 0) => {
    const g = new THREE.BoxGeometry(b, h, t)
    if (rx) g.rotateX(rx)
    g.translate(x, y, z)
    teile.push(g)
  }
  box(0.46, 0.05, 0.4, 0, 0.43, 0.03)
  box(0.46, 0.42, 0.04, 0, 0.66, -0.17, -0.18)
  box(0.06, 0.4, 0.3, 0, 0.21, -0.05)
  const g = mergeGeometries(teile, false)
  teile.forEach((t) => t.dispose())
  if (!g) throw new Error('Sitz-Geometrie liess sich nicht zusammenfuegen.')
  return g
}

/** Sitzschalen auf jedem Platz, auch den leeren. Blick nach `blickDeg`. */
export function erzeugeSitze(plaetze: Pick<PublikumsPlatz, 'x' | 'y' | 'z' | 'blickDeg'>[], farbe: THREE.ColorRepresentation = '#23262c'): THREE.InstancedMesh {
  const mat = oberflaechenMaterial('seat', { farbe })
  const mesh = new THREE.InstancedMesh(sitzGeometrie(), mat, Math.max(1, plaetze.length))
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const achse = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const eins = new THREE.Vector3(1, 1, 1)
  plaetze.forEach((p, i) => {
    q.setFromAxisAngle(achse, Math.PI / 2 - (p.blickDeg * Math.PI) / 180)
    m.compose(pos.set(p.x, p.z, p.y), q, eins)
    mesh.setMatrixAt(i, m)
  })
  mesh.count = plaetze.length
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  mesh.receiveShadow = true
  mesh.name = 'sitze'
  return mesh
}

export interface TribuenenForm {
  x: number
  y: number
  width: number
  rows: number
  rowSpacingM: number
  riseM: number
  baseHeightM: number
  rotationDeg: number
}

/**
 * Stufen einer Tribuene als ein Koerper: jede Reihe ein Block vom Boden bis
 * zu ihrer Oberkante, vorn eine Bruestung, wenn die erste Reihe erhoeht
 * liegt. `null` fuer ebene Bestuhlung — da gibt es nichts zu bauen.
 */
export function erzeugeTribuene(t: TribuenenForm): THREE.Mesh | null {
  if (t.riseM <= 0 && t.baseHeightM <= 0) return null
  const tiefe = t.rows * t.rowSpacingM
  const teile: THREE.BufferGeometry[] = []
  for (let j = 0; j < t.rows; j++) {
    const oben = t.baseHeightM + j * t.riseM
    if (oben <= 0.001) continue
    const g = new THREE.BoxGeometry(t.width, oben, t.rowSpacingM)
    g.translate(0, oben / 2, -tiefe / 2 + (j + 0.5) * t.rowSpacingM)
    teile.push(g)
  }
  if (t.baseHeightM > 0.3) {
    const g = new THREE.BoxGeometry(t.width, 1.05, 0.08)
    g.translate(0, t.baseHeightM + 0.52, -tiefe / 2 + 0.04)
    teile.push(g)
  }
  if (!teile.length) return null
  const g = mergeGeometries(teile, false)
  teile.forEach((x) => x.dispose())
  if (!g) return null
  const hoehe = t.baseHeightM + (t.rows - 1) * t.riseM
  const mesh = new THREE.Mesh(g, oberflaechenMaterial('riser', { breiteM: t.width, tiefeM: Math.max(tiefe, hoehe) }))
  mesh.position.set(t.x, 0, t.y)
  mesh.rotation.y = -(t.rotationDeg * Math.PI) / 180
  mesh.receiveShadow = true
  mesh.castShadow = true
  mesh.name = 'tribuene'
  return mesh
}
