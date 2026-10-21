// Tageszeit und Himmel: three-`Sky`, Sonne, Himmelslicht, Mond und Sterne
// aus einem Aufruf mit Datum, Ort, Nordrichtung und Wetter.
//
// Einheiten: Lichtstaerken sind Beleuchtungsstaerken in Lux geteilt durch
// `luxProEinheit` (Vorgabe 1 = physikalisch; three rechnet DirectionalLight
// und HemisphereLight seit r155 so). Damit Planer mit Tonemapping hell und
// dunkel stimmig bekommen, liefert jeder Aufruf EV100 und eine dazu passende
// `toneMappingExposure`. Unter EV 12 regelt sie nur zu drei Vierteln nach
// wie ein Auge — sonst saehe Mondlicht aus wie Mittag.
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { KEIN_AO } from './pipeline'
import { himmelsRichtung, mondstand, sonnenstand, tagesphase, type HimmelsStand, type Mondstand, type Tagesphase } from './sonne'

export interface Wetter {
  /** Sky-Shader: Truebung, Rayleigh- und Mie-Streuung. */
  turbidity: number
  rayleigh: number
  mieCoefficient: number
  mieDirectionalG: number
  /** Wolkenbedeckung und -dichte, 0..1. */
  wolken: number
  wolkenDichte: number
  /** Anteile an direkter Sonne und Himmelslicht gegenueber klarem Himmel. */
  direkt: number
  diffus: number
  /** Schattenweichheit (shadow.radius; wirkt mit PCF- und VSM-Schatten). */
  schattenRadius: number
  /** Nebeldichte je Meter fuer eine Szene um 40 m. */
  nebelDichte: number
}

export type WetterArt = 'klar' | 'leicht-bewoelkt' | 'bedeckt' | 'dunst'

export const WETTER: Record<WetterArt, Wetter> = {
  klar: { turbidity: 2, rayleigh: 1, mieCoefficient: 0.005, mieDirectionalG: 0.8, wolken: 0, wolkenDichte: 0, direkt: 1, diffus: 1, schattenRadius: 1, nebelDichte: 0.0003 },
  'leicht-bewoelkt': { turbidity: 4, rayleigh: 1.2, mieCoefficient: 0.008, mieDirectionalG: 0.8, wolken: 0.35, wolkenDichte: 0.55, direkt: 0.85, diffus: 1.25, schattenRadius: 2, nebelDichte: 0.0006 },
  // Bedeckt: kaum Direktlicht, das Himmelslicht traegt (~15–25 klx mittags).
  bedeckt: { turbidity: 10, rayleigh: 0.5, mieCoefficient: 0.02, mieDirectionalG: 0.6, wolken: 0.95, wolkenDichte: 0.95, direkt: 0.05, diffus: 1.1, schattenRadius: 8, nebelDichte: 0.0015 },
  dunst: { turbidity: 15, rayleigh: 3, mieCoefficient: 0.03, mieDirectionalG: 0.9, wolken: 0.1, wolkenDichte: 0.3, direkt: 0.45, diffus: 1.6, schattenRadius: 3, nebelDichte: 0.006 },
}

/** ~2000 K am Horizont bis ~5800 K hoch am Himmel; monoton steigend. */
export function farbtemperaturK(sonnenElevationDeg: number): number {
  const e = Math.max(-2, sonnenElevationDeg)
  return 2000 + 3800 * (1 - Math.exp(-(e + 2) / 14))
}

/** Planck-Naeherung (Tanner Helland), Ergebnis linear, hellster Kanal = 1. */
export function kelvinZuFarbe(kelvin: number, ziel = new THREE.Color()): THREE.Color {
  const t = Math.min(40000, Math.max(1000, kelvin)) / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const k = (v: number) => Math.min(255, Math.max(0, v)) / 255
  ziel.setRGB(k(r), k(g), k(b), THREE.SRGBColorSpace)
  const m = Math.max(ziel.r, ziel.g, ziel.b)
  return m > 0 ? ziel.multiplyScalar(1 / m) : ziel
}

// Luftmasse nach Kasten-Young; am Horizont ~38.
const luftmasse = (e: number) => 1 / (Math.sin(Math.max(0, e) / (180 / Math.PI)) + 0.50572 * Math.pow(Math.max(0, e) + 6.07995, -1.6364))
const glatt = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Direkte Normal-Beleuchtungsstaerke klarer Sonne in Lux (~100 klx bei hoher Sonne). */
export function sonneDirektLux(elevationDeg: number): number {
  return 128000 * Math.exp(-0.21 * luftmasse(elevationDeg)) * glatt(-0.8, 1, elevationDeg)
}

/** Horizontales Himmelslicht in Lux; laeuft in der Daemmerung logarithmisch aus. */
export function himmelDiffusLux(elevationDeg: number): number {
  if (elevationDeg >= 0) return 400 + 17600 * Math.sqrt(Math.sin(elevationDeg / (180 / Math.PI)))
  return 400 * Math.pow(10, elevationDeg * 0.38)
}

/** EV100 aus horizontaler Beleuchtungsstaerke (Lichtmesser-Konstante 250). */
export function ev100AusLux(lux: number): number {
  return Math.log2(Math.max(1e-4, lux) * 100 / 250)
}

/** toneMappingExposure fuer EV100, mit Augen-Anpassung unterhalb EV 12. */
export function belichtungAusEv(ev100: number, luxProEinheit = 1): number {
  const angepasst = ev100 >= 12 ? ev100 : 12 + (ev100 - 12) * 0.75
  return luxProEinheit / (1.2 * Math.pow(2, angepasst))
}

export interface HimmelEingabe {
  datum: Date
  lat: number
  lon: number
  nordDeg?: number
  wetter?: WetterArt | Wetter
  /** Tatsaechlich gesetzte toneMappingExposure, falls nicht die empfohlene. */
  belichtung?: number
  /** Sekunden fuer ziehende Wolken. */
  zeitS?: number
}

export interface HimmelZustand {
  sonne: HimmelsStand
  mond: Mondstand
  phase: Tagesphase
  farbtemperaturK: number
  /** Direkte Normal-Beleuchtungsstaerke inkl. Wetter. */
  direktLux: number
  diffusLux: number
  mondLux: number
  /** Auf dem Boden unter freiem Himmel. */
  horizontalLux: number
  ev100: number
  belichtung: number
  nebelFarbe: THREE.Color
  nebelDichte: number
}

export interface HimmelOptionen {
  luxProEinheit?: number
  /** Kantenlaenge der Himmelsbox; muss innerhalb von camera.far liegen. */
  himmelGroesse?: number
  sterne?: number
  schattenAufloesung?: number
  szenenGroesseM?: number
}

const STERNEN_SAAT = 0x5eed
// Rueckstrahlung eines mittleren Bodens (Albedo ~0,25, leicht warm).
const BODEN = new THREE.Color(0.3, 0.26, 0.22)

/**
 * Pro Bild oder bei Aenderung `aktualisiere()` aufrufen; `gruppe` in die
 * Szene haengen. Der Himmel ersetzt `erzeugeKuppel` — nicht beides.
 */
export class Himmel {
  readonly gruppe = new THREE.Group()
  readonly himmel = new Sky()
  readonly sonne = new THREE.DirectionalLight(0xffffff, 0)
  readonly mond = new THREE.DirectionalLight(0xffffff, 0)
  readonly himmelslicht = new THREE.HemisphereLight(0xffffff, 0x4a4238, 0)
  readonly sterne: THREE.Points
  readonly mondScheibe: THREE.Mesh
  private readonly luxProEinheit: number
  private readonly groesse: number
  private szenenGroesse = 40
  private readonly mitte = new THREE.Vector3()
  private mitUmgebung = false
  private pmrem: THREE.PMREMGenerator | null = null
  private umgebungsZiel: THREE.WebGLRenderTarget | null = null

  constructor(o: HimmelOptionen = {}) {
    this.luxProEinheit = o.luxProEinheit ?? 1
    this.groesse = o.himmelGroesse ?? 4500
    this.gruppe.name = 'Himmel'

    const m = this.himmel.material as THREE.ShaderMaterial
    // Sky liefert eigene Einheiten; ohne Faktor stimmte er nur bei
    // Belichtung 0,5. `uHelligkeit` bindet ihn an die Lux-Skala.
    const ausgabe = 'gl_FragColor = vec4( texColor, 1.0 );'
    if (!m.fragmentShader.includes(ausgabe)) throw new Error('Sky.js: Ausgabezeile nicht gefunden — Shader hat sich geaendert')
    m.fragmentShader = m.fragmentShader.replace(ausgabe, 'gl_FragColor = vec4( texColor * uHelligkeit, 1.0 );').replace('void main()', 'uniform float uHelligkeit;\nvoid main()')
    m.uniforms.uHelligkeit = { value: 1 }
    this.himmel.scale.setScalar(this.groesse)
    this.himmel.renderOrder = -2
    this.himmel.frustumCulled = false
    this.himmel.userData = { noPick: true, [KEIN_AO]: true }

    this.sonne.name = 'Sonne'
    this.sonne.castShadow = true
    this.sonne.shadow.mapSize.setScalar(o.schattenAufloesung ?? 2048)
    this.sonne.shadow.bias = -0.0004
    this.sonne.shadow.normalBias = 0.02
    this.mond.name = 'Mond'
    this.himmelslicht.name = 'Himmelslicht'

    this.sterne = erzeugeSterne(o.sterne ?? 1500, this.groesse * 0.4)
    const r = this.groesse * 0.4
    // Doppelte Winkelgroesse (~1°), sonst ist der Mond im Planer ein Pixel.
    this.mondScheibe = new THREE.Mesh(
      new THREE.SphereGeometry(r * Math.tan(0.0091), 16, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false }),
    )
    this.mondScheibe.renderOrder = -1
    this.mondScheibe.userData = { noPick: true, [KEIN_AO]: true }

    this.gruppe.add(this.himmel, this.sterne, this.mondScheibe, this.sonne, this.sonne.target, this.mond, this.mond.target, this.himmelslicht)
    this.passeSchattenAn(o.szenenGroesseM ?? 40)
  }

  /** Schattenkamera auf die Szene zuschneiden: `groesseM` = Diagonale. */
  passeSchattenAn(groesseM: number, mitte?: THREE.Vector3): void {
    this.szenenGroesse = Math.max(1, groesseM)
    if (mitte) this.mitte.copy(mitte)
    const h = this.szenenGroesse * 0.55
    const k = this.sonne.shadow.camera
    k.left = -h
    k.right = h
    k.top = h
    k.bottom = -h
    k.near = 0.5
    k.far = this.szenenGroesse * 3
    k.updateProjectionMatrix()
    this.sonne.target.position.copy(this.mitte)
    this.mond.target.position.copy(this.mitte)
  }

  aktualisiere(e: HimmelEingabe): HimmelZustand {
    const w = typeof e.wetter === 'object' ? e.wetter : WETTER[e.wetter ?? 'klar']
    const nord = e.nordDeg ?? 0
    const sonne = sonnenstand(e.datum, e.lat, e.lon, nord)
    const mond = mondstand(e.datum, e.lat, e.lon, nord)
    const s = this.luxProEinheit

    const kelvin = farbtemperaturK(sonne.elevationDeg)
    const direktLux = sonneDirektLux(sonne.elevationDeg) * w.direkt
    const diffusLux = himmelDiffusLux(sonne.elevationDeg) * w.diffus
    const mondLux = 0.25 * mond.beleuchtet * glatt(-0.8, 15, mond.elevationDeg) * (1 - 0.8 * w.wolken)
    const sinS = Math.max(0, sonne.richtung.y)
    const direktHorizontal = direktLux * sinS
    // Sternenlicht als Boden, damit EV in der Neumondnacht endlich bleibt.
    const horizontalLux = direktHorizontal + diffusLux + mondLux * Math.max(0, mond.richtung.y) + 0.002
    const ev100 = ev100AusLux(horizontalLux)
    const empfohlen = belichtungAusEv(ev100, s)
    const belichtung = e.belichtung ?? empfohlen
    const vollAngepasst = s / (1.2 * Math.pow(2, ev100))

    const abstand = this.szenenGroesse * 1.5
    this.sonne.position.copy(sonne.richtung).multiplyScalar(abstand).add(this.mitte)
    kelvinZuFarbe(kelvin, this.sonne.color)
    this.sonne.intensity = direktLux / s
    this.sonne.visible = this.sonne.intensity > 0
    this.sonne.shadow.radius = w.schattenRadius
    this.sonne.shadow.intensity = direktHorizontal / Math.max(1e-6, direktHorizontal + diffusLux)

    this.mond.position.copy(mond.richtung).multiplyScalar(abstand).add(this.mitte)
    kelvinZuFarbe(7500, this.mond.color)
    this.mond.intensity = mond.richtung.y > 0 ? mondLux / s : 0
    this.mond.visible = this.mond.intensity > 0

    const himmelsK = THREE.MathUtils.lerp(sonne.elevationDeg > 0 ? 10000 : 14000, 6500, w.wolken)
    kelvinZuFarbe(himmelsK, this.himmelslicht.color)
    this.himmelslicht.groundColor.copy(this.himmelslicht.color).multiply(BODEN)
    this.himmelslicht.intensity = this.mitUmgebung ? 0 : diffusLux / s

    const u = (this.himmel.material as THREE.ShaderMaterial).uniforms
    u.sunPosition.value.copy(sonne.richtung)
    u.turbidity.value = w.turbidity
    u.rayleigh.value = w.rayleigh
    u.mieCoefficient.value = w.mieCoefficient
    u.mieDirectionalG.value = w.mieDirectionalG
    u.cloudCoverage.value = w.wolken
    u.cloudDensity.value = w.wolkenDichte
    u.showSunDisc.value = sonne.elevationDeg > -1 && w.wolken < 0.9 ? 1 : 0
    u.time.value = e.zeitS ?? 0
    u.uHelligkeit.value = 0.35 / vollAngepasst

    // Sterne und Mond sind Anzeige, kein Licht: Helligkeit gegen die
    // tatsaechliche Belichtung, damit sie nachts sichtbar bleiben.
    const nacht = glatt(-4, -12, sonne.elevationDeg) * (1 - w.wolken)
    const sm = this.sterne.material as THREE.PointsMaterial
    sm.opacity = nacht
    sm.color.setScalar(0.9 / belichtung)
    this.sterne.visible = nacht > 0.01
    this.sterne.quaternion.copy(sternenLage(e.datum, e.lat, e.lon, nord))
    this.mondScheibe.position.copy(mond.richtung).multiplyScalar(this.groesse * 0.4)
    ;(this.mondScheibe.material as THREE.MeshBasicMaterial).color.setScalar((0.15 + 0.85 * mond.beleuchtet) * (0.3 + 0.7 * glatt(0, -8, sonne.elevationDeg)) / belichtung)
    this.mondScheibe.visible = mond.elevationDeg > -1 && w.wolken < 0.9

    // Horizontleuchtdichte grob als Anteil der Beleuchtungsstaerke; Nebel
    // mischt vor dem Tonemapping, muss also in derselben Skala liegen.
    const horizont = kelvinZuFarbe(himmelsK).lerp(kelvinZuFarbe(kelvin), glatt(20, 0, sonne.elevationDeg) * 0.6)
    const nebelFarbe = horizont.multiplyScalar((horizontalLux * 0.3) / (Math.PI * s))
    const nebelDichte = w.nebelDichte * Math.min(1, 40 / this.szenenGroesse)

    return { sonne, mond, phase: tagesphase(sonne.elevationDeg), farbtemperaturK: kelvin, direktLux, diffusLux, mondLux, horizontalLux, ev100, belichtung: empfohlen, nebelFarbe, nebelDichte }
  }

  /** Nebel setzen; `scene.background` bleibt leer, der Himmel ist Geometrie. */
  wendeNebelAn(scene: THREE.Scene, z: HimmelZustand): void {
    scene.background = null
    if (z.nebelDichte <= 0) {
      scene.fog = null
      return
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(z.nebelFarbe)
      scene.fog.density = z.nebelDichte
    } else {
      // Konstruktor nimmt nur Hex (0..1); die Farbe liegt in Lux-Skala darueber.
      const f = new THREE.FogExp2(0, z.nebelDichte)
      f.color.copy(z.nebelFarbe)
      scene.fog = f
    }
  }

  /**
   * Umgebungslicht aus dem Himmel vorfiltern (PMREM) — nur bei Aenderung,
   * nicht pro Bild. Danach traegt die Umgebung das Himmelslicht und die
   * Hemisphaere schweigt, sonst zaehlte es doppelt.
   */
  umgebungAusHimmel(renderer: THREE.WebGLRenderer): THREE.Texture {
    this.pmrem ??= new THREE.PMREMGenerator(renderer)
    const eltern = this.himmel.parent
    const szene = new THREE.Scene()
    szene.add(this.himmel)
    this.umgebungsZiel?.dispose()
    this.umgebungsZiel = this.pmrem.fromScene(szene, 0, 0.1, this.groesse)
    eltern?.add(this.himmel)
    this.mitUmgebung = true
    this.himmelslicht.intensity = 0
    return this.umgebungsZiel.texture
  }

  dispose(): void {
    this.gruppe.removeFromParent()
    this.himmel.geometry.dispose()
    ;(this.himmel.material as THREE.Material).dispose()
    this.sterne.geometry.dispose()
    ;(this.sterne.material as THREE.Material).dispose()
    this.mondScheibe.geometry.dispose()
    ;(this.mondScheibe.material as THREE.Material).dispose()
    this.sonne.dispose()
    this.mond.dispose()
    this.himmelslicht.dispose()
    this.umgebungsZiel?.dispose()
    this.pmrem?.dispose()
    this.umgebungsZiel = null
    this.pmrem = null
  }
}

function erzeugeSterne(anzahl: number, radius: number): THREE.Points {
  let saat = STERNEN_SAAT
  const zufall = () => ((saat = (saat * 1664525 + 1013904223) >>> 0) / 4294967296)
  const pos = new Float32Array(anzahl * 3)
  const farbe = new Float32Array(anzahl * 3)
  const c = new THREE.Color()
  for (let i = 0; i < anzahl; i++) {
    const z = zufall() * 2 - 1
    const a = zufall() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    pos.set([r * Math.cos(a) * radius, z * radius, r * Math.sin(a) * radius], i * 3)
    // Wenige helle, viele schwache; leicht farbig nach Spektralklasse.
    const hell = Math.pow(zufall(), 3) * 0.85 + 0.15
    kelvinZuFarbe(3500 + zufall() * 8000, c).multiplyScalar(hell)
    farbe.set([c.r, c.g, c.b], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(farbe, 3))
  const p = new THREE.Points(
    g,
    new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }),
  )
  p.renderOrder = -1
  p.frustumCulled = false
  p.userData = { noPick: true, [KEIN_AO]: true }
  return p
}

// Sternenfeld: lokale +y-Achse auf den Himmelspol (Norden, Hoehe = Breite),
// gedreht um die Ortssternzeit.
function sternenLage(datum: Date, lat: number, lon: number, nordDeg: number): THREE.Quaternion {
  const tage = datum.getTime() / 86400000 + 2440587.5 - 2451545
  const sternzeit = (((280.46061837 + 360.98564736629 * tage + lon) % 360) + 360) % 360
  const pol = himmelsRichtung(0, lat, nordDeg)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pol)
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (-sternzeit * Math.PI) / 180))
}
