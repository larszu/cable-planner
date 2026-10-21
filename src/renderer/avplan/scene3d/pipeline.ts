// Render-Pipeline: HDR-Ziel → Umgebungsverdeckung (GTAO) → Tiefenunschaerfe
// → Bloom → Tonemapping. Haengt an keinem Framework; wer rendert (eigene
// Schleife, react-three-fiber useFrame), ruft `render()`.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { AutoStufe, stufenWerte, type Qualitaet, type Stufe, type StufenWerte } from './qualitaet'

export type Tonemapping = 'agx' | 'aces' | 'neutral'

const TONEMAPPING: Record<Tonemapping, THREE.ToneMapping> = {
  agx: THREE.AgXToneMapping,
  aces: THREE.ACESFilmicToneMapping,
  neutral: THREE.NeutralToneMapping,
}

/** Objekte, die nicht in die Verdeckung gehoeren: Lichtkegel, Glanzpunkte, Beschriftung. */
export const KEIN_AO = 'avplanKeinAO'

/**
 * GTAO zeichnet die Szene ein zweites Mal mit Normalen-Material. Ein
 * Dunstkegel oder eine Beschriftung waere darin eine feste Wand und wuerfe
 * einen dunklen Hof auf alles dahinter. Ausgeblendet wird alles Durchsichtige
 * und alles, was `userData[KEIN_AO]` traegt.
 */
class SzenenAO extends GTAOPass {
  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean,
  ): void {
    const versteckt: THREE.Object3D[] = []
    this.scene.traverse((o) => {
      if (!o.visible) return
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      const durchsichtig = Array.isArray(m) ? m.some((x) => x.transparent) : !!m?.transparent
      if (o.userData[KEIN_AO] || ((o as THREE.Mesh).isMesh && durchsichtig)) {
        o.visible = false
        versteckt.push(o)
      }
    })
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive)
    for (const o of versteckt) o.visible = true
  }

  // Halbe Aufloesung: AO ist weich, die volle kostet das Vierfache.
  override setSize(width: number, height: number): void {
    super.setSize(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)))
  }
}

export interface Tiefenschaerfe {
  /** Schaerfeabstand in Metern. */
  fokusM: number
  /** Blendenzahl, z. B. 2.8. */
  blende: number
  brennweiteMm: number
  /** Sensorbreite in mm (des genutzten Ausschnitts). */
  sensorBreiteMm: number
}

/**
 * Staerke der Unschaerfe fuer den Bokeh-Shader. Er rechnet den Zerstreuungs-
 * kreis linear im Abstand zur Schaerfeebene; die Physik waechst mit
 * (D−S)/D. Angeglichen wird bei D = 2S, dem Bereich, in dem man Unschaerfe
 * im Bild beurteilt. Ergebnis in Bildbreiten je Meter.
 */
export function bokehStaerke(t: Tiefenschaerfe): number {
  const f = Math.max(1, t.brennweiteMm) / 1000
  const s = Math.max(f * 1.5, t.fokusM)
  const n = Math.max(0.7, t.blende)
  const sensor = Math.max(1, t.sensorBreiteMm) / 1000
  return (f * f) / (2 * n * s * (s - f) * sensor)
}

export interface PipelineOptionen {
  qualitaet?: Qualitaet
  tonemapping?: Tonemapping
  belichtung?: number
  bloom?: { staerke?: number; radius?: number; schwelle?: number }
  /** Wird gerufen, wenn sich die wirksame Stufe aendert (Auto senkt). */
  stufeGeaendert?: (stufe: Stufe, werte: StufenWerte) => void
}

export class SzenenPipeline {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  camera: THREE.Camera
  private composer: EffectComposer
  private ziel: THREE.WebGLRenderTarget
  private renderPass: RenderPass
  private ao: SzenenAO
  private bokeh: BokehPass
  private bloom: UnrealBloomPass
  private qualitaet: Qualitaet
  private auto = new AutoStufe()
  private stufeJetzt: Stufe
  private dof: Tiefenschaerfe | null = null
  private breite = 1
  private hoehe = 1
  private readonly stufeGeaendert?: PipelineOptionen['stufeGeaendert']

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, o: PipelineOptionen = {}) {
    this.renderer = renderer
    this.scene = scene
    this.camera = camera
    this.qualitaet = o.qualitaet ?? 'auto'
    this.stufeJetzt = this.qualitaet === 'low' ? 'low' : 'high'
    this.stufeGeaendert = o.stufeGeaendert
    const groesse = renderer.getSize(new THREE.Vector2())
    this.breite = Math.max(1, groesse.x)
    this.hoehe = Math.max(1, groesse.y)
    const w = this.werte

    renderer.toneMapping = TONEMAPPING[o.tonemapping ?? 'agx']
    renderer.toneMappingExposure = o.belichtung ?? 1
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.ziel = new THREE.WebGLRenderTarget(this.breite, this.hoehe, { type: THREE.HalfFloatType, samples: w.msaa })
    this.composer = new EffectComposer(renderer, this.ziel)
    this.renderPass = new RenderPass(scene, camera)
    this.composer.addPass(this.renderPass)

    const persp = camera as THREE.PerspectiveCamera
    this.ao = new SzenenAO(scene, persp, this.breite, this.hoehe)
    this.ao.blendIntensity = 0.85
    this.ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1, samples: 12 })
    this.composer.addPass(this.ao)

    this.bokeh = new BokehPass(scene, persp, { focus: 10, aperture: 0, maxblur: 0.008 })
    this.composer.addPass(this.bokeh)

    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.breite, this.hoehe), o.bloom?.staerke ?? 0.55, o.bloom?.radius ?? 0.55, o.bloom?.schwelle ?? 1.1)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
    this.stufeAnwenden()
  }

  get stufe(): Stufe {
    return this.stufeJetzt
  }

  get werte(): StufenWerte {
    return stufenWerte(this.stufeJetzt, typeof window === 'undefined' ? 1 : window.devicePixelRatio)
  }

  setQualitaet(q: Qualitaet): void {
    if (q === this.qualitaet) return
    this.qualitaet = q
    this.auto = new AutoStufe()
    this.stufeSetzen(q === 'low' ? 'low' : 'high')
  }

  setKamera(camera: THREE.Camera): void {
    this.camera = camera
    this.renderPass.camera = camera
    this.ao.camera = camera as THREE.PerspectiveCamera
    this.bokeh.camera = camera
  }

  setBelichtung(wert: number): void {
    this.renderer.toneMappingExposure = wert
  }

  setTonemapping(art: Tonemapping): void {
    this.renderer.toneMapping = TONEMAPPING[art]
  }

  setBloom(staerke: number, schwelle?: number): void {
    this.bloom.strength = staerke
    if (schwelle !== undefined) this.bloom.threshold = schwelle
  }

  /** `null` schaltet die Tiefenunschaerfe ab. Wirkt nur auf der hohen Stufe. */
  setTiefenschaerfe(t: Tiefenschaerfe | null): void {
    this.dof = t
    this.bokehAnwenden()
  }

  /** Nach einem grossen Umbau der Szene (Vorlage geladen): Bildrate neu einschwingen. */
  neuMessen(): void {
    this.auto.neuMessen()
  }

  setGroesse(breite: number, hoehe: number): void {
    this.breite = Math.max(1, breite)
    this.hoehe = Math.max(1, hoehe)
    this.composer.setSize(this.breite, this.hoehe)
  }

  render(dtSek: number): void {
    if (this.qualitaet === 'auto') {
      const neu = this.auto.bild(dtSek * 1000)
      if (neu !== this.stufeJetzt) this.stufeSetzen(neu)
    }
    this.composer.render(dtSek)
  }

  dispose(): void {
    this.composer.dispose()
    this.ziel.dispose()
    this.ao.dispose()
    this.bokeh.dispose()
    this.bloom.dispose()
  }

  private stufeSetzen(s: Stufe): void {
    if (s === this.stufeJetzt) return
    this.stufeJetzt = s
    this.stufeAnwenden()
    this.stufeGeaendert?.(s, this.werte)
  }

  private stufeAnwenden(): void {
    const w = this.werte
    this.composer.setPixelRatio(w.pixelRatio)
    this.composer.setSize(this.breite, this.hoehe)
    this.ziel.samples = w.msaa
    this.composer.renderTarget1.samples = w.msaa
    this.composer.renderTarget2.samples = w.msaa
    this.ao.enabled = w.ao
    this.renderer.shadowMap.enabled = w.schatten
    this.renderer.shadowMap.needsUpdate = true
    this.bokehAnwenden()
  }

  private bokehAnwenden(): void {
    const an = !!this.dof && this.werte.dof
    this.bokeh.enabled = an
    if (!an || !this.dof) return
    const u = this.bokeh.uniforms as Record<string, THREE.IUniform>
    u.focus.value = this.dof.fokusM
    u.aperture.value = bokehStaerke(this.dof)
  }
}
