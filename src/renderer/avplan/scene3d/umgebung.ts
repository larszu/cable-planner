// Umgebungslicht und Hintergrund.
//
// Das Umgebungslicht kommt aus RoomEnvironment, vorgefiltert per PMREM —
// gerechnet, nicht geladen: kein HDR-Bild, kein CDN, laeuft offline und in
// Electron unter file://. Es gibt jeder PBR-Flaeche eine weiche Grundform,
// damit Menschen ausserhalb der Kegel nicht zu schwarzen Scherenschnitten
// werden. In der dunklen Halle bleibt es schwach; die Scheinwerfer tragen.
//
// Der Hintergrund ist eine Kuppel mit Verlauf, die der Kamera folgt, und
// Nebel in der Horizontfarbe — der Boden laeuft darin aus statt an einer
// Kante zu enden.
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { KEIN_AO } from './pipeline'

export function erzeugeUmgebungslicht(renderer: THREE.WebGLRenderer): { textur: THREE.Texture; dispose: () => void } {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const raum = new RoomEnvironment()
  const ziel = pmrem.fromScene(raum, 0.04)
  raum.dispose()
  pmrem.dispose()
  return { textur: ziel.texture, dispose: () => ziel.dispose() }
}

export interface Hintergrund {
  oben: string
  horizont: string
  unten: string
  /** Exponentieller Nebel: Farbe und Dichte je Meter. */
  nebel: string
  nebelDichte: number
  /** Staerke des Umgebungslichts (scene.environmentIntensity). */
  umgebung: number
}

export type HintergrundArt = 'arena' | 'halle' | 'nacht' | 'tag' | 'planung'

export const HINTERGRUENDE: Record<HintergrundArt, Hintergrund> = {
  // Dunkle Halle mit Dunst: fast schwarz, der Dunst eine Spur heller als die
  // Wand, damit Licht darin steht.
  arena: { oben: '#020307', horizont: '#070a12', unten: '#020306', nebel: '#0a0e18', nebelDichte: 0.012, umgebung: 0.06 },
  halle: { oben: '#0b0e14', horizont: '#141821', unten: '#08090c', nebel: '#151a24', nebelDichte: 0.008, umgebung: 0.22 },
  nacht: { oben: '#01030a', horizont: '#0d1424', unten: '#030409', nebel: '#0c1220', nebelDichte: 0.004, umgebung: 0.08 },
  tag: { oben: '#5d86bd', horizont: '#c9d6e6', unten: '#6b6f73', nebel: '#c9d6e6', nebelDichte: 0.002, umgebung: 0.9 },
  planung: { oben: '#1a2740', horizont: '#24324d', unten: '#132040', nebel: '#24324d', nebelDichte: 0.0, umgebung: 0.75 },
}

const KUPPEL_VERT = /* glsl */ `
  varying vec3 vRichtung;
  void main() {
    vRichtung = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

const KUPPEL_FRAG = /* glsl */ `
  varying vec3 vRichtung;
  uniform vec3 uOben; uniform vec3 uHorizont; uniform vec3 uUnten;
  void main() {
    float h = vRichtung.y;
    vec3 c = h > 0.0
      ? mix(uHorizont, uOben, pow(smoothstep(0.0, 0.85, h), 0.7))
      : mix(uHorizont, uUnten, smoothstep(0.0, 0.25, -h));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

/** Kuppel um die Kamera. Jedes Bild `position.copy(camera.position)` setzen. */
export function erzeugeKuppel(radius = 900): THREE.Mesh {
  const kuppel = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { uOben: { value: new THREE.Color() }, uHorizont: { value: new THREE.Color() }, uUnten: { value: new THREE.Color() } },
      vertexShader: KUPPEL_VERT,
      fragmentShader: KUPPEL_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  )
  kuppel.renderOrder = -1
  kuppel.frustumCulled = false
  kuppel.userData = { noPick: true, [KEIN_AO]: true }
  return kuppel
}

/**
 * `groesseM` ist die Diagonale des Raums: die Dichte gilt fuer eine Halle um
 * 40 m und wird darueber duenner — sonst verschwaenden die Tribuenen eines
 * Stadions im Nebel.
 */
export function wendeHintergrundAn(scene: THREE.Scene, kuppel: THREE.Mesh | null, h: Hintergrund, groesseM = 40): void {
  if (kuppel) {
    const u = (kuppel.material as THREE.ShaderMaterial).uniforms
    u.uOben.value.set(h.oben)
    u.uHorizont.value.set(h.horizont)
    u.uUnten.value.set(h.unten)
  }
  scene.background = new THREE.Color(h.horizont)
  scene.fog = h.nebelDichte > 0 ? new THREE.FogExp2(h.nebel, h.nebelDichte * Math.min(1, 40 / Math.max(1, groesseM))) : null
  scene.environmentIntensity = h.umgebung
}
