// Personen aus einer GLB-Datei (Mixamo-/RPM-Skelett), uebernommen aus
// light-planner (Scene3D loadPersonModel, applySitPose, posedMinWorldY).
// Die Datei bringt der Planer selbst mit — das Paket liefert keine, weil die
// Lizenz eines Modells am Modell haengt, nicht am Code.
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as klonSkelett } from 'three/examples/jsm/utils/SkeletonUtils.js'

export interface PersonModell {
  szene: THREE.Group
  hoehe: number
  minY: number
}

/**
 * Per XHR statt fetch: fetch kann keine file://-Adressen lesen, und die
 * verpackte Electron-App liefert die Oberflaeche von file:// aus. XHR kann
 * beides (Status 0 = ok).
 */
function ladeBytes(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'arraybuffer'
    xhr.onload = () => (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300) ? resolve(xhr.response as ArrayBuffer) : reject(new Error(`HTTP ${xhr.status} fuer ${url}`)))
    xhr.onerror = () => reject(new Error(`Netzwerkfehler fuer ${url}`))
    xhr.send()
  })
}

const geladen = new Map<string, Promise<PersonModell>>()

export function ladePersonModell(url: string, o: { entfernen?: RegExp; umgebung?: number } = {}): Promise<PersonModell> {
  const vorhanden = geladen.get(url)
  if (vorhanden) return vorhanden
  const lader = new GLTFLoader()
  // GLTFLoader dekodiert eingebettete Texturen per createImageBitmap. Unter
  // Electrons file://-Herkunft scheitert das an blob:-Adressen, und alle
  // Materialien bleiben weiss. Ein einfacher TextureLoader (img-Element)
  // geht in Browser und App.
  lader.register((parser) => {
    const tl = new THREE.TextureLoader(parser.options.manager)
    tl.setCrossOrigin(parser.options.crossOrigin)
    tl.setRequestHeader(parser.options.requestHeader)
    ;(parser as unknown as { textureLoader: THREE.TextureLoader }).textureLoader = tl
    return { name: 'avplan_texture_loader' }
  })
  const p = ladeBytes(url)
    .then((buf) => lader.parseAsync(buf, ''))
    .then((g) => {
      const szene = g.scene
      // Bindungspose ist eine T-Pose; ein Bild der Ruhe-Animation stellt die
      // Figur natuerlich hin.
      const ruhe = g.animations.find((a) => /idle|stand|rest/i.test(a.name)) ?? g.animations[0]
      if (ruhe) {
        const mixer = new THREE.AnimationMixer(szene)
        mixer.clipAction(ruhe).play()
        mixer.update(0.4)
      }
      const weg: THREE.Object3D[] = []
      szene.traverse((obj) => {
        if (o.entfernen?.test(obj.name)) weg.push(obj)
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.castShadow = true
        mesh.receiveShadow = true
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
        for (const mm of mats) {
          const m = mm as THREE.MeshStandardMaterial
          // Eingebackenes Leuchten macht das Gesicht im Bloom zur Maske.
          if (m.emissive) {
            m.emissive.setRGB(0, 0, 0)
            m.emissiveIntensity = 0
          }
          if (o.umgebung !== undefined && 'envMapIntensity' in m) m.envMapIntensity = o.umgebung
          m.needsUpdate = true
        }
      })
      weg.forEach((x) => x.parent?.remove(x))
      szene.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(szene)
      return { szene, hoehe: Math.max(0.1, box.max.y - box.min.y), minY: box.min.y }
    })
  geladen.set(url, p)
  p.catch(() => geladen.delete(url))
  return p
}

/** Sitzpose fuer das uebliche Mixamo-/RPM-Skelett (im light-planner nachgemessen). */
export function wendeSitzposeAn(wurzel: THREE.Object3D): void {
  const dreh = (name: string, x: number, y = 0, z = 0) => {
    const b = wurzel.getObjectByName(name)
    if (b) {
      b.rotation.x += x
      b.rotation.y += y
      b.rotation.z += z
    }
  }
  dreh('LeftUpLeg', -1.45, 0, 0.12)
  dreh('RightUpLeg', -1.45, 0, -0.12)
  dreh('LeftLeg', -1.55)
  dreh('RightLeg', -1.55)
  dreh('LeftFoot', 0.2)
  dreh('RightFoot', 0.2)
  dreh('Spine', 0.06)
  dreh('Spine1', 0.04)
  dreh('LeftArm', 0.45, 0, 0.1)
  dreh('RightArm', 0.45, 0, -0.1)
}

/** Tiefster gehaeuteter Punkt in Weltkoordinaten — die Box der Bindungspose stimmt nach dem Posieren nicht mehr. */
export function tiefsterPunkt(wurzel: THREE.Object3D): number {
  wurzel.updateMatrixWorld(true)
  let min = Infinity
  const v = new THREE.Vector3()
  wurzel.traverse((obj) => {
    const sm = obj as THREE.SkinnedMesh
    if (!(sm as unknown as THREE.Mesh).isMesh) return
    if (sm.isSkinnedMesh && sm.skeleton) sm.skeleton.update()
    const pos = sm.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      sm.getVertexPosition(i, v)
      v.applyMatrix4(sm.matrixWorld)
      if (v.y < min) min = v.y
    }
  })
  return min === Infinity ? 0 : min
}

/**
 * Eine Person aus dem Modell: auf `groesseM` skaliert, Fuesse bzw. Gesaess
 * auf `bodenY`, Blick in Plan-Richtung `blickDeg` (0 = +x).
 */
export function stellePerson(modell: PersonModell, o: { x: number; y: number; bodenY?: number; groesseM: number; blickDeg: number; sitzend?: boolean }): THREE.Object3D {
  const m = klonSkelett(modell.szene) as THREE.Group
  const s = o.groesseM / modell.hoehe
  m.scale.setScalar(s)
  m.rotation.y = ((90 - o.blickDeg) * Math.PI) / 180
  const boden = o.bodenY ?? 0
  m.position.set(o.x, boden - modell.minY * s, o.y)
  if (o.sitzend) {
    wendeSitzposeAn(m)
    m.position.y += boden - tiefsterPunkt(m)
  }
  return m
}
