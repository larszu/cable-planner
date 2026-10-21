// LED-Wand: selbstleuchtend, mit sichtbarem Pixelraster aus der Naehe und
// ohne Moiré aus der Ferne. Der Inhalt ist entweder eine Textur (Titel,
// Kamerabild) oder ein ruhiger, gerechneter Verlauf — wie eine Grafik im
// Gottesdienst oder Konzert. Leuchtdichte ueber 1, damit der Bloom greift.
import * as THREE from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { KEIN_AO } from './pipeline'
import { SZENEN_ZEIT } from './dunst'

const LED_VERT = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`

const LED_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uInhalt;
  uniform float uMitInhalt;
  uniform vec2 uPixel;
  uniform float uHelligkeit;
  uniform float uZeit;
  uniform vec3 uFarbeA;
  uniform vec3 uFarbeB;
  #include <fog_pars_fragment>
  vec3 verlauf(vec2 uv) {
    float t = uZeit * 0.07;
    vec2 p = uv - 0.5;
    float wolke = 0.5 + 0.5 * sin(p.x * 3.1 + t * 2.0 + sin(p.y * 4.0 - t));
    float strahl = pow(max(0.0, 1.0 - abs(p.x + 0.15 * sin(t * 1.3)) * 2.2), 3.0) * smoothstep(-0.5, 0.5, p.y);
    vec3 c = mix(uFarbeA, uFarbeB, wolke);
    c += vec3(1.0, 0.9, 0.75) * strahl * 0.45;
    c *= 0.55 + 0.45 * smoothstep(-0.6, 0.4, p.y);
    return c;
  }
  void main() {
    vec3 c = uMitInhalt > 0.5 ? texture2D(uInhalt, vUv).rgb : verlauf(vUv);
    // Pixelraster: runde Leuchtpunkte. Wird ein Pixel kleiner als ein
    // Bildschirmpunkt, laeuft das Raster in seinen Mittelwert aus.
    vec2 zelle = vUv * uPixel;
    vec2 f = fract(zelle) - 0.5;
    float punkt = 1.0 - smoothstep(0.28, 0.48, length(f));
    vec2 breite = fwidth(zelle);
    float fern = smoothstep(0.35, 0.8, max(breite.x, breite.y));
    float raster = mix(0.25 + 0.95 * punkt, 0.68, fern);
    gl_FragColor = vec4(c * raster * uHelligkeit, 1.0);
    #include <fog_fragment>
  }`

export interface LedWandOptionen {
  breiteM: number
  hoeheM: number
  /** Pixelabstand in mm, Vorgabe 3,9 (uebliche Buehnen-LED). */
  pitchMm?: number
  /** Leuchtdichte als Vielfaches von Weiss; ueber 1 leuchtet sie im Bloom. */
  helligkeit?: number
  inhalt?: THREE.Texture | null
  farbeA?: THREE.ColorRepresentation
  farbeB?: THREE.ColorRepresentation
  /** Rahmen und Rueckseite zeichnen. */
  rahmen?: boolean
}

/**
 * LED-Wand mit Unterkante-Mitte im Ursprung, Bildflaeche nach +z.
 * Der Aufrufer setzt Position und Drehung der Gruppe.
 */
export function erzeugeLedWand(o: LedWandOptionen): THREE.Group {
  const gruppe = new THREE.Group()
  gruppe.name = 'ledwand'
  const pitch = Math.max(1, o.pitchMm ?? 3.9) / 1000
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uInhalt: { value: o.inhalt ?? null },
        uMitInhalt: { value: o.inhalt ? 1 : 0 },
        uPixel: { value: new THREE.Vector2(o.breiteM / pitch, o.hoeheM / pitch) },
        uHelligkeit: { value: o.helligkeit ?? 1.6 },
        uFarbeA: { value: new THREE.Color(o.farbeA ?? '#ff7a2e') },
        uFarbeB: { value: new THREE.Color(o.farbeB ?? '#3a2bd8') },
      },
    ]),
    vertexShader: LED_VERT,
    fragmentShader: LED_FRAG,
    fog: true,
  })
  mat.uniforms.uZeit = SZENEN_ZEIT
  const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(o.breiteM, o.hoeheM), mat)
  flaeche.position.set(0, o.hoeheM / 2, 0.04)
  flaeche.name = 'ledwand-flaeche'
  flaeche.userData[KEIN_AO] = true
  gruppe.add(flaeche)
  if (o.rahmen !== false) {
    const rahmen = new THREE.Mesh(
      // Rahmen hinter der Bildflaeche, nicht buendig: zwei Flaechen im
      // Zentimeterabstand flimmern auf 50 m im Tiefenpuffer gegeneinander.
      new THREE.BoxGeometry(o.breiteM + 0.12, o.hoeheM + 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.6, metalness: 0.4 }),
    )
    rahmen.position.set(0, o.hoeheM / 2, -0.1)
    rahmen.castShadow = true
    gruppe.add(rahmen)
  }
  return gruppe
}

export function setzeLedInhalt(wand: THREE.Object3D, inhalt: THREE.Texture | null): void {
  const f = wand.getObjectByName('ledwand-flaeche') as THREE.Mesh | undefined
  const m = f?.material as THREE.ShaderMaterial | undefined
  if (!m) return
  m.uniforms.uInhalt.value = inhalt
  m.uniforms.uMitInhalt.value = inhalt ? 1 : 0
}

let flaechenlichtBereit = false

/**
 * Flaechenlicht vor der Wand: eine LED-Wand beleuchtet Buehne und Publikum
 * davor. Ohne Schatten (RectAreaLight kann keine), dafuer billig.
 */
export function erzeugeLedLicht(o: { breiteM: number; hoeheM: number; farbe?: THREE.ColorRepresentation; staerke?: number }): THREE.RectAreaLight {
  if (!flaechenlichtBereit) {
    RectAreaLightUniformsLib.init()
    flaechenlichtBereit = true
  }
  const licht = new THREE.RectAreaLight(o.farbe ?? '#ffb08a', o.staerke ?? 3, o.breiteM, o.hoeheM)
  licht.position.set(0, o.hoeheM / 2, 0.1)
  // RectAreaLight strahlt nach −z; die Bildflaeche zeigt nach +z.
  licht.rotation.y = Math.PI
  return licht
}
