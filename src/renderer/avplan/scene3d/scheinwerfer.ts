// Showlicht-Bausteine: Traverse und Scheinwerfer mit Kegel, Glanzpunkt,
// Lichtfleck und optional echtem SpotLight. Welche Lampen ein echtes Licht
// (und Schatten) bekommen, entscheidet der Aufrufer nach `StufenWerte`.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { erzeugeDunstStrahl, erzeugeLichtfleck, erzeugeLinsenGlanz } from './dunst'

/** Dreipunkt-Traverse (30 cm) zwischen zwei Punkten, als ein Koerper. */
export function erzeugeTraverse(von: THREE.Vector3, nach: THREE.Vector3, kante = 0.3): THREE.Mesh {
  const richtung = nach.clone().sub(von)
  const l = richtung.length()
  const teile: THREE.BufferGeometry[] = []
  const r = 0.024
  const h = (kante * Math.sqrt(3)) / 2
  const ecken: [number, number][] = [[-kante / 2, -h / 3], [kante / 2, -h / 3], [0, (2 * h) / 3]]
  for (const [x, y] of ecken) {
    const g = new THREE.CylinderGeometry(r, r, l, 6, 1)
    g.rotateZ(Math.PI / 2)
    g.translate(0, y, x)
    teile.push(g)
  }
  const felder = Math.max(1, Math.round(l / kante))
  for (let i = 0; i < felder; i++) {
    const x0 = -l / 2 + (i * l) / felder
    const x1 = x0 + l / felder
    for (let k = 0; k < 3; k++) {
      const a = ecken[k]
      const b = ecken[(k + 1) % 3]
      const p0 = new THREE.Vector3(x0, a[1], a[0])
      const p1 = new THREE.Vector3(x1, b[1], b[0])
      const d = p1.clone().sub(p0)
      const g = new THREE.CylinderGeometry(r * 0.55, r * 0.55, d.length(), 4, 1)
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))
      g.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2)
      teile.push(g)
    }
  }
  const g = mergeGeometries(teile, false)
  teile.forEach((t) => t.dispose())
  const mesh = new THREE.Mesh(g ?? new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.35, metalness: 0.85 }))
  mesh.position.copy(von).add(nach).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), richtung.normalize())
  mesh.castShadow = true
  mesh.name = 'traverse'
  return mesh
}

export interface ScheinwerferOptionen {
  von: THREE.Vector3
  /** Zielpunkt auf einer Flaeche; dort endet der Kegel. */
  nach: THREE.Vector3
  farbe: THREE.ColorRepresentation
  feldwinkelDeg: number
  /** 0..1 Dunst im Raum. */
  dunst: number
  intensitaet?: number
  strahlSchritte?: number
  /** Echtes SpotLight (beleuchtet Flaechen, Menschen). */
  licht?: boolean
  schatten?: boolean
  /** Leuchtstaerke des SpotLight in Candela-aehnlichen Einheiten. */
  lichtStaerke?: number
  /** Ohne echtes Licht: Lichtfleck am Ziel, wenn das Ziel eine waagerechte Flaeche ist. */
  fleck?: boolean
}

function kopf(): THREE.Group {
  const g = new THREE.Group()
  const metall = new THREE.MeshStandardMaterial({ color: '#16171a', roughness: 0.5, metalness: 0.5 })
  const buegel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.2), metall)
  buegel.position.y = 0.17
  g.add(buegel)
  const koerper = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.32, 14), metall)
  g.add(koerper)
  g.traverse((o) => { o.castShadow = true })
  return g
}

/**
 * Scheinwerfer als Gruppe in Weltkoordinaten. Der Kopf zeigt zum Ziel, die
 * Linse leuchtet (Bloom), der Kegel steht im Dunst.
 */
export function erzeugeScheinwerfer(o: ScheinwerferOptionen): THREE.Group {
  const gruppe = new THREE.Group()
  gruppe.name = 'scheinwerfer'
  const achse = o.nach.clone().sub(o.von).normalize()
  const intensitaet = o.intensitaet ?? 1
  const k = kopf()
  k.position.copy(o.von)
  k.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), achse)
  gruppe.add(k)
  const glanz = erzeugeLinsenGlanz(0.5, o.farbe, 3 * intensitaet)
  glanz.position.copy(o.von).addScaledVector(achse, 0.18)
  gruppe.add(glanz)
  if (o.dunst > 0.001) {
    gruppe.add(erzeugeDunstStrahl({ von: o.von.clone().addScaledVector(achse, 0.17), nach: o.nach, feldwinkelDeg: o.feldwinkelDeg, farbe: o.farbe, dunst: o.dunst, intensitaet, schritte: o.strahlSchritte }))
  }
  const weite = o.von.distanceTo(o.nach)
  const halb = (o.feldwinkelDeg / 2) * (Math.PI / 180)
  if (o.licht) {
    const spot = new THREE.SpotLight(o.farbe, (o.lichtStaerke ?? 60) * intensitaet * weite * weite * 0.04)
    spot.position.copy(o.von)
    spot.target.position.copy(o.nach)
    spot.angle = Math.min(Math.PI / 2.2, halb * 1.15)
    spot.penumbra = 0.8
    spot.decay = 2
    spot.distance = 0
    if (o.schatten) {
      spot.castShadow = true
      spot.shadow.mapSize.set(1024, 1024)
      spot.shadow.bias = -0.0004
      spot.shadow.normalBias = 0.02
      spot.shadow.camera.near = 0.5
      spot.shadow.camera.far = weite * 1.6
    }
    gruppe.add(spot, spot.target)
  } else if (o.fleck !== false && Math.abs(achse.y) > 0.35) {
    const radius = Math.tan(halb) * weite * 1.1
    gruppe.add(erzeugeLichtfleck(o.nach, radius, o.farbe, 0.6 * intensitaet * Math.min(1, 14 / weite)))
  }
  return gruppe
}

/** Gibt Geometrien, Materialien und Texturen eines Teilbaums frei. */
export function entsorge(wurzel: THREE.Object3D): void {
  wurzel.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.geometry) mesh.geometry.dispose()
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []
    for (const m of mats) {
      for (const wert of Object.values(m)) if (wert instanceof THREE.Texture) wert.dispose()
      m.dispose()
    }
    if ((o as THREE.Light).isLight) (o as THREE.Light).dispose()
  })
}
