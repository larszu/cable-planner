// Licht im Dunst.
//
// Ein Lichtkegel im Dunst ist Licht, das am Volumen des Strahls streut: das
// Auge integriert einen hellen Kern mit weichen Raendern. Gezeichnet wird die
// Rueckwand des Huellkegels; der Sehstrahl wird von dort zur Kamera hin
// abgetastet und integriert das Gauss-Profil des Strahls (10 % am
// Feldwinkel), die 1/d²-Abnahme, Henyey-Greenstein-Vorwaertsstreuung und
// Beer-Lambert-Daempfung. Uebernommen aus light-planner (Scene3D BEAM_FRAG)
// und erweitert um ungleichmaessigen, langsam ziehenden Dunst (Rauschen im
// Volumen) — gleichmaessiger Dunst sieht aus wie ein Plastikkegel.
import * as THREE from 'three'
import { KEIN_AO } from './pipeline'

/** Gemeinsame Zeit aller Dunst- und LED-Materialien; der Aufrufer zaehlt hoch. */
export const SZENEN_ZEIT: THREE.IUniform<number> = { value: 0 }

const STRAHL_VERT = /* glsl */ `
  varying vec3 vWelt;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWelt = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

const STRAHL_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vWelt;
  uniform vec3 uSpitze;
  uniform vec3 uAchse;
  uniform float uLaenge;
  uniform float uSigma;
  uniform vec3 uFarbe;
  uniform float uDunst;
  uniform float uIntensitaet;
  uniform float uHG;
  uniform float uDaempfung;
  uniform float uZeit;
  uniform float uWirbel;
  uniform float uCosHuelle;
  uniform float uEndeWeich;
  // Hash ohne sin (Hoskins): auf GPUs mit schwacher Transzendenten-Einheit
  // ein Vielfaches schneller, und es laeuft je Schritt achtmal.
  float hash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float rauschen(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y);
    float b = mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y);
    return mix(a, b, f.z);
  }
  // Eintritt des Sehstrahls in den Huellkegel (Mantel oder Deckel), damit
  // alle Schritte im Kegel liegen statt auf der ganzen Laenge verteilt.
  float eintritt(vec3 ro, vec3 rd, float fern) {
    vec3 co = ro - uSpitze;
    float cos2 = uCosHuelle * uCosHuelle;
    float dv = dot(rd, uAchse);
    float cv = dot(co, uAchse);
    if (cv > 0.0 && cv < uLaenge && cv * cv > cos2 * dot(co, co)) return 0.0;
    float a = dv * dv - cos2;
    float b = 2.0 * (dv * cv - cos2 * dot(rd, co));
    float c = cv * cv - cos2 * dot(co, co);
    float t = fern;
    float disk = b * b - 4.0 * a * c;
    if (abs(a) > 1e-6 && disk >= 0.0) {
      float w = sqrt(disk);
      for (int i = 0; i < 2; i++) {
        float ti = (-b + (i == 0 ? -w : w)) / (2.0 * a);
        float ax = cv + ti * dv;
        if (ti > 0.0 && ax >= 0.0 && ax <= uLaenge) t = min(t, ti);
      }
    }
    if (abs(dv) > 1e-6) {
      float td = (uLaenge - cv) / dv;
      vec3 q = co + rd * td;
      float ax = dot(q, uAchse);
      if (td > 0.0 && dot(q, q) - ax * ax <= uLaenge * uLaenge * (1.0 - cos2) / cos2) t = min(t, td);
    }
    return clamp(t, 0.0, fern);
  }
  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWelt - ro);
    float fern = length(vWelt - ro);
    float nah = eintritt(ro, rd, fern);
    float schritt = max(1e-3, (fern - nah) / float(SCHRITTE));
    // Interleaved Gradient Noise: gleichmaessiger als ein Hash, kein Korn.
    float zitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * schritt;
    float k = uHG, kk = uHG * uHG;
    float sigT = uDaempfung * uDunst;
    vec3 drift = vec3(0.12, 0.05, -0.08) * uZeit;
    float summe = 0.0;
    for (int i = 0; i < SCHRITTE; i++) {
      float s = fern - zitter - float(i) * schritt;
      if (s <= nah) break;
      vec3 P = ro + rd * s;
      vec3 zuP = P - uSpitze;
      float axial = dot(zuP, uAchse);
      if (axial < 0.0 || axial > uLaenge) continue;
      float d2 = dot(zuP, zuP);
      float d = sqrt(d2);
      float radial = sqrt(max(0.0, d2 - axial * axial));
      float theta = atan(radial / max(axial, 1e-3));
      float profil = exp(-(theta * theta) / (2.0 * uSigma * uSigma));
      float E = profil / max(d2, 0.09);
      float cosA = dot(zuP / d, -rd);
      float phase = (1.0 - kk) / pow(max(1e-4, 1.0 + kk - 2.0 * k * cosA), 1.5);
      float trans = exp(-sigT * (d + s));
      float spitze = smoothstep(0.0, 0.05 * uLaenge, axial);
      float ende = 1.0 - uEndeWeich * smoothstep(0.82 * uLaenge, uLaenge, axial);
      float dichte = 1.0 - uWirbel + uWirbel * 1.6 * rauschen(P * 0.7 + drift);
      summe += E * phase * trans * spitze * ende * dichte;
    }
    float tau = summe * schritt * uDunst * uIntensitaet * 32.0;
    float a = 1.0 - exp(-tau);
    // NaN aus einer entarteten Kegelgleichung waere im Bloom ein schwarzer Fleck.
    if (!(a >= 0.002)) discard;
    // Dichte Kerne duerfen ueber Weiss gehen und im Bloom gluehen.
    // Additiv mit SrcAlpha: die Farbe NICHT noch einmal mit a multiplizieren,
    // sonst zaehlt die Deckkraft doppelt und duenner Dunst verschwindet.
    gl_FragColor = vec4(uFarbe * (1.0 + 1.5 * smoothstep(0.5, 3.0, tau)), a);
  }`

export interface StrahlOptionen {
  /** Lampe (Welt). */
  von: THREE.Vector3
  /** Zielpunkt (Welt); der Kegel endet dort. */
  nach: THREE.Vector3
  /** Feldwinkel (10 %-Isophote) in Grad. */
  feldwinkelDeg: number
  farbe: THREE.ColorRepresentation
  /** 0..1, Dunst im Raum. */
  dunst: number
  /** 0..1, Dimmer. */
  intensitaet?: number
  schritte?: number
  /**
   * Feste Dichte statt der aus dem Feldwinkel abgeleiteten (`strahlGewinn`) —
   * fuer Planer, die die Lichtstaerke selbst photometrisch rechnen.
   */
  lichtstaerke?: number
  /** Kegel vor dem Ziel weich auslaufen lassen; aus, wenn er auf einer Flaeche endet. Vorgabe an. */
  endeWeich?: boolean
  /** Henyey-Greenstein-Asymmetrie (Vorwaertsstreuung), Vorgabe 0,55. */
  vorwaerts?: number
}

/** Lichtstaerke relativ zu einem 20°-Scheinwerfer gleicher Leistung. */
export function strahlGewinn(feldwinkelDeg: number): number {
  const w = Math.max(1, feldwinkelDeg)
  return Math.min(30, Math.max(0.35, (20 / w) ** 2 * 0.6))
}

/**
 * Raymarching-Kegel. Additiv, schreibt keine Tiefe, wirft keine Verdeckung.
 * `uFarbe` darf ueber 1 gehen — dann bluehen die hellsten Kerne im Bloom.
 */
export function erzeugeDunstStrahl(o: StrahlOptionen): THREE.Mesh {
  const achse = o.nach.clone().sub(o.von)
  const laenge = Math.max(0.2, achse.length())
  achse.normalize()
  const halb = (Math.max(1, o.feldwinkelDeg) / 2) * (Math.PI / 180)
  const huelle = Math.min(Math.PI / 2.1, halb * 1.45)
  const geo = new THREE.ConeGeometry(Math.tan(huelle) * laenge, laenge, 40, 1, false)
  geo.translate(0, -laenge / 2, 0)
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSpitze: { value: o.von.clone() },
      uAchse: { value: achse.clone() },
      uLaenge: { value: laenge },
      uSigma: { value: halb / Math.sqrt(2 * Math.LN10) },
      uFarbe: { value: new THREE.Color(o.farbe) },
      uDunst: { value: o.dunst },
      // Gleicher Lichtstrom auf engerem Raumwinkel: ein 4°-Beam hat ein
      // Vielfaches der Lichtstaerke eines 30°-Wash.
      uIntensitaet: { value: o.lichtstaerke ?? Math.max(0.05, o.intensitaet ?? 1) * strahlGewinn(o.feldwinkelDeg) },
      uHG: { value: o.vorwaerts ?? 0.55 },
      uEndeWeich: { value: o.endeWeich === false ? 0 : 1 },
      uDaempfung: { value: 0.03 },
      uZeit: SZENEN_ZEIT,
      uWirbel: { value: 0.45 },
      uCosHuelle: { value: Math.cos(huelle) },
    },
    defines: { SCHRITTE: Math.max(4, Math.round(o.schritte ?? 24)) },
    vertexShader: STRAHL_VERT,
    fragmentShader: STRAHL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    fog: false,
  })
  const kegel = new THREE.Mesh(geo, mat)
  kegel.position.copy(o.von)
  kegel.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), achse)
  kegel.userData = { noPick: true, [KEIN_AO]: true }
  kegel.raycast = () => {}
  kegel.renderOrder = 2
  return kegel
}

export function setzeDunst(wurzel: THREE.Object3D, dunst: number): void {
  wurzel.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined
    if (m?.uniforms?.uDunst) m.uniforms.uDunst.value = dunst
  })
}

const FLECK_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uFarbe;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float a = exp(-r * r * 4.6) * (1.0 - smoothstep(0.85, 1.0, r));
    gl_FragColor = vec4(uFarbe, a);
  }`

/**
 * Lichtfleck auf einer waagerechten Flaeche — fuer Scheinwerfer, die kein
 * echtes SpotLight bekommen (die Zahl der echten ist begrenzt). Additiv,
 * flach aufgelegt.
 */
export function erzeugeLichtfleck(mitte: THREE.Vector3, radius: number, farbe: THREE.ColorRepresentation, staerke: number): THREE.Mesh {
  const c = new THREE.Color(farbe).multiplyScalar(staerke)
  const fleck = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.ShaderMaterial({
      uniforms: { uFarbe: { value: c } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FLECK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      fog: false,
    }),
  )
  fleck.rotation.x = -Math.PI / 2
  fleck.position.copy(mitte).add(new THREE.Vector3(0, 0.012, 0))
  fleck.userData = { noPick: true, [KEIN_AO]: true }
  fleck.raycast = () => {}
  return fleck
}

const GLANZ_FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uFarbe;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float kern = exp(-r * r * 60.0);
    float hof = exp(-r * r * 7.0) * 0.18;
    float a = clamp(kern + hof, 0.0, 1.0) * (1.0 - smoothstep(0.9, 1.0, r));
    gl_FragColor = vec4(uFarbe * (kern * 6.0 + hof), a);
  }`

/** Glanzpunkt einer Linse, immer zur Kamera gedreht; hell genug fuer Bloom. */
export function erzeugeLinsenGlanz(groesse: number, farbe: THREE.ColorRepresentation, staerke = 1): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uFarbe: { value: new THREE.Color(farbe).multiplyScalar(staerke) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec2 skala = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
        mv.xy += position.xy * skala;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: GLANZ_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  })
  const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
  s.scale.setScalar(groesse)
  s.raycast = () => {}
  s.userData = { noPick: true, [KEIN_AO]: true }
  s.renderOrder = 3
  return s
}
