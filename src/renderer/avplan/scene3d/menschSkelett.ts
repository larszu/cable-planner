// Gelenkpunkte eines Menschen je Pose, ohne Knochen zur Laufzeit.
//
// Posen werden als Handziel und Ellbogenrichtung beschrieben, nicht als
// Winkel: "Hand vor den Mund, Ellbogen nach unten" laesst sich ablesen und
// pruefen, eine Kette aus Euler-Winkeln nicht. Arme und Beine loest eine
// Zwei-Glied-IK. Masse nach Koerperproportionen (Drillis/Contini) fuer 1,75 m;
// die Groesse kommt spaeter als gleichmaessige Skalierung dazu.
import * as THREE from 'three'

export type Pose =
  | 'stehen'
  | 'sitzen'
  | 'jubeln'
  | 'sprechen'
  | 'armeVerschraenkt'
  | 'haendeVorn'
  | 'handHuefte'
  | 'mikrofon'
  | 'tippen'
  | 'telefonieren'
  | 'gitarre'
  | 'kameraSchulter'
  | 'kameraStativ'

export const POSEN: readonly Pose[] = ['stehen', 'sitzen', 'jubeln', 'sprechen', 'armeVerschraenkt', 'haendeVorn', 'handHuefte', 'mikrofon', 'tippen', 'telefonieren', 'gitarre', 'kameraSchulter', 'kameraStativ']

/** Posen mit Gesaess auf einer Sitzflaeche von 0,45 m (Normgroesse). */
export function istSitzend(pose: Pose): boolean {
  return pose === 'sitzen' || pose === 'tippen'
}

type V = [number, number, number]

interface ArmZiel {
  /** Handgelenk. */
  hand: V
  /** Richtung, in die der Ellbogen zeigt. */
  ellbogen: V
  /** Fingerrichtung; ohne Angabe die Unterarm-Richtung. */
  finger?: V
  /** Normale der Handflaeche. */
  flaeche?: V
  /** 0 offen … 1 Faust. */
  greifen?: number
}

interface PosenSpez {
  becken: V
  /** Neigung vor (+), Drehung nach links (+), Kippen nach rechts (+) in rad. */
  beckenDreh?: V
  brust?: V
  kopf?: V
  links: ArmZiel
  rechts?: ArmZiel
  fussL: V
  fussR?: V
  requisit?: 'mikrofon' | 'telefon'
}

const spiegel = (v: V): V => [-v[0], v[1], v[2]]
const spiegelArm = (a: ArmZiel): ArmZiel => ({
  ...a,
  hand: spiegel(a.hand),
  ellbogen: spiegel(a.ellbogen),
  finger: a.finger && spiegel(a.finger),
  flaeche: a.flaeche && spiegel(a.flaeche),
})

const HAENGEND: ArmZiel = { hand: [0.215, 0.835, 0.03], ellbogen: [0.35, 0, -1], flaeche: [-1, 0, 0.15], greifen: 0.3 }

// Links = +x (Blick nach +z). Rechts ohne Angabe gespiegelt.
const SPEZ: Record<Pose, PosenSpez> = {
  stehen: {
    becken: [0, 0.89, 0], brust: [0.02, 0, 0],
    links: HAENGEND, rechts: { ...spiegelArm(HAENGEND), hand: [-0.205, 0.845, 0.06] },
    fussL: [0.1, 0, -0.01], fussR: [-0.11, 0, 0.01],
  },
  sitzen: {
    becken: [0, 0.535, -0.04], beckenDreh: [-0.12, 0, 0], brust: [0.16, 0, 0], kopf: [0.02, 0, 0],
    links: { hand: [0.15, 0.62, 0.24], ellbogen: [0.4, 0, -1], finger: [0, -0.35, 1], flaeche: [0, -1, 0], greifen: 0.35 },
    fussL: [0.12, 0, 0.44],
  },
  jubeln: {
    becken: [0, 0.89, 0], brust: [-0.06, 0, 0], kopf: [-0.18, 0, 0],
    links: { hand: [0.31, 1.86, 0.08], ellbogen: [1, 0, -0.2], finger: [0.15, 1, 0.05], flaeche: [0, 0, 1], greifen: 0.15 },
    rechts: { hand: [-0.3, 1.82, 0.12], ellbogen: [-1, 0, -0.2], finger: [-0.15, 1, 0.05], flaeche: [0, 0.1, 1], greifen: 0.6 },
    fussL: [0.11, 0, -0.01],
  },
  sprechen: {
    becken: [0.01, 0.89, 0], beckenDreh: [0, 0.05, 0.02], brust: [0.03, -0.05, -0.02], kopf: [0.02, 0.12, 0.04],
    links: { hand: [0.2, 1.04, 0.24], ellbogen: [0.4, -1, -0.5], finger: [0.25, 0.25, 1], flaeche: [-0.3, 1, 0.1], greifen: 0.2 },
    rechts: { hand: [-0.17, 1.15, 0.3], ellbogen: [-0.4, -1, -0.5], finger: [-0.4, 0.45, 1], flaeche: [0.35, 1, 0], greifen: 0.15 },
    fussL: [0.1, 0, 0.02], fussR: [-0.12, 0, -0.03],
  },
  armeVerschraenkt: {
    becken: [0, 0.89, 0], brust: [-0.02, 0, 0],
    links: { hand: [-0.13, 1.17, 0.16], ellbogen: [0.4, -1, 0.15], finger: [-1, 0.1, -0.4], flaeche: [0, 0.2, -1], greifen: 0.5 },
    rechts: { hand: [0.13, 1.2, 0.12], ellbogen: [-0.4, -1, 0.15], finger: [1, 0.1, -0.5], flaeche: [0, 0.2, -1], greifen: 0.5 },
    fussL: [0.12, 0, 0],
  },
  haendeVorn: {
    becken: [0, 0.89, 0], brust: [0.03, 0, 0],
    links: { hand: [0.06, 0.94, 0.15], ellbogen: [0.5, -1, -0.6], finger: [-0.7, -0.6, 0.2], flaeche: [0, 0, -1], greifen: 0.45 },
    rechts: { hand: [-0.05, 0.95, 0.17], ellbogen: [-0.5, -1, -0.6], finger: [0.7, -0.6, 0.2], flaeche: [-0.2, 0, -1], greifen: 0.45 },
    fussL: [0.1, 0, 0],
  },
  handHuefte: {
    becken: [-0.02, 0.89, 0], beckenDreh: [0, 0, -0.04], brust: [0, 0, 0.05], kopf: [0, 0.05, -0.03],
    links: { hand: [0.2, 1.0, 0.02], ellbogen: [1, -0.1, -0.35], finger: [-0.3, -0.7, 0.6], flaeche: [-1, 0, 0], greifen: 0.25 },
    rechts: { ...spiegelArm(HAENGEND), hand: [-0.235, 0.83, 0.03] },
    fussL: [0.14, 0, 0.04], fussR: [-0.09, 0, -0.01],
  },
  mikrofon: {
    becken: [0, 0.89, 0], brust: [0.04, 0, 0], kopf: [0.03, 0, 0],
    links: HAENGEND,
    rechts: { hand: [-0.035, 1.43, 0.19], ellbogen: [-0.6, -1, -0.2], finger: [1, 0.2, 0.3], flaeche: [0.1, 0.1, -1], greifen: 0.85 },
    fussL: [0.1, 0, 0.02], fussR: [-0.11, 0, -0.03],
    requisit: 'mikrofon',
  },
  tippen: {
    becken: [0, 0.535, -0.06], beckenDreh: [-0.05, 0, 0], brust: [0.22, 0, 0], kopf: [0.18, 0, 0],
    links: { hand: [0.17, 0.75, 0.37], ellbogen: [0.4, -1, -0.5], finger: [-0.1, -0.15, 1], flaeche: [0, -1, 0], greifen: 0.4 },
    fussL: [0.13, 0, 0.42],
  },
  telefonieren: {
    becken: [0.015, 0.89, 0], beckenDreh: [0, 0, 0.03], brust: [0, 0, -0.03], kopf: [0, 0.06, -0.12],
    links: { ...HAENGEND, hand: [0.225, 0.84, 0.02] },
    rechts: { hand: [-0.115, 1.5, 0.05], ellbogen: [-0.3, -1, 0.2], finger: [0.1, 1, 0.15], flaeche: [1, -0.1, 0], greifen: 0.55 },
    fussL: [0.11, 0, 0.01], fussR: [-0.1, 0, -0.02],
    requisit: 'telefon',
  },
  gitarre: {
    becken: [0, 0.89, 0], brust: [0.05, 0.08, 0], kopf: [0.25, 0.25, 0],
    links: { hand: [0.38, 1.13, 0.24], ellbogen: [0.2, -1, -0.4], finger: [-0.4, 0.4, 0.4], flaeche: [-0.3, 0.2, -1], greifen: 0.6 },
    rechts: { hand: [-0.03, 0.98, 0.25], ellbogen: [-0.5, 0.3, -1], finger: [0.3, -1, 0.1], flaeche: [0, 0, -1], greifen: 0.5 },
    fussL: [0.14, 0, 0.03], fussR: [-0.12, 0, -0.02],
  },
  kameraSchulter: {
    becken: [0, 0.89, 0], brust: [0.04, -0.06, 0], kopf: [0.08, -0.12, -0.1],
    links: { hand: [-0.06, 1.34, 0.45], ellbogen: [0.4, -1, 0.1], finger: [-0.6, 0.6, 0.4], flaeche: [-1, 0, 0], greifen: 0.7 },
    rechts: { hand: [-0.16, 1.41, 0.28], ellbogen: [-0.5, -1, -0.1], finger: [0.3, 0.3, 1], flaeche: [1, 0, 0], greifen: 0.85 },
    fussL: [0.12, 0, 0.12], fussR: [-0.13, 0, -0.1],
  },
  kameraStativ: {
    becken: [0, 0.885, -0.02], brust: [0.14, 0, 0], kopf: [0.05, 0, 0],
    links: { hand: [0.1, 1.3, 0.42], ellbogen: [0.5, -1, -0.2], finger: [-0.4, 0.3, 1], flaeche: [-1, 0, 0], greifen: 0.6 },
    rechts: { hand: [-0.33, 1.07, 0.24], ellbogen: [-0.5, -1, -0.5], finger: [-0.1, -0.2, 1], flaeche: [0, 1, 0], greifen: 0.8 },
    fussL: [0.13, 0, 0.06], fussR: [-0.14, 0, -0.08],
  },
}

export interface Arm {
  links: boolean
  schulter: THREE.Vector3
  ellbogen: THREE.Vector3
  handgelenk: THREE.Vector3
  /** Einheitsvektoren; Daumen = finger × flaeche (links negiert). */
  finger: THREE.Vector3
  flaeche: THREE.Vector3
  greifen: number
  oberarm: number
  unterarm: number
}

export interface Bein {
  huefte: THREE.Vector3
  knie: THREE.Vector3
  knoechel: THREE.Vector3
  /** Waagerechte Fussrichtung. */
  fuss: THREE.Vector3
  oberschenkel: number
}

export interface Skelett {
  pose: Pose
  sitzend: boolean
  becken: THREE.Vector3
  qBecken: THREE.Quaternion
  qBrust: THREE.Quaternion
  /** Halsansatz = oberes Ende des Rumpfs. */
  hals: THREE.Vector3
  qKopf: THREE.Quaternion
  /** Mitte des Schaedels. */
  kopf: THREE.Vector3
  arme: [Arm, Arm]
  beine: [Bein, Bein]
  requisit?: 'mikrofon' | 'telefon'
}

/** Masse, die das Geschlecht (0 maennlich … 1 weiblich) verschiebt. */
export interface Masse {
  schulter: number
  huefte: number
  oberarm: number
  unterarm: number
}

export function masse(geschlecht: number): Masse {
  const g = Math.min(1, Math.max(0, geschlecht))
  return { schulter: 0.183 - 0.02 * g, huefte: 0.088 + 0.012 * g, oberarm: 0.315 - 0.012 * g, unterarm: 0.258 - 0.016 * g }
}

const OBERSCHENKEL = 0.4
const UNTERSCHENKEL = 0.425
const KNOECHEL_Y = 0.075

const v3 = (v: V) => new THREE.Vector3(...v)
const euler = (v: V | undefined) => new THREE.Quaternion().setFromEuler(new THREE.Euler(v?.[0] ?? 0, v?.[1] ?? 0, v?.[2] ?? 0, 'YXZ'))

/** Mittelgelenk einer Zwei-Glied-Kette; das Ziel wird auf die Reichweite gekuerzt. */
export function zweiGlied(a: THREE.Vector3, ziel: THREE.Vector3, l1: number, l2: number, pol: THREE.Vector3): { mitte: THREE.Vector3; ende: THREE.Vector3 } {
  const d = ziel.clone().sub(a)
  const dist = THREE.MathUtils.clamp(d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-4)
  const dir = d.lengthSq() > 1e-12 ? d.normalize() : new THREE.Vector3(0, -1, 0)
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x))
  const p = pol.clone().sub(dir.clone().multiplyScalar(pol.dot(dir)))
  if (p.lengthSq() < 1e-8) p.set(0, 0, -1).sub(dir.clone().multiplyScalar(-dir.z))
  p.normalize()
  return { mitte: a.clone().addScaledVector(dir, x).addScaledVector(p, h), ende: a.clone().addScaledVector(dir, dist) }
}

function arm(links: boolean, schulter: THREE.Vector3, z: ArmZiel, m: Masse): Arm {
  const { mitte, ende } = zweiGlied(schulter, v3(z.hand), m.oberarm, m.unterarm, v3(z.ellbogen))
  const unterarm = ende.clone().sub(mitte).normalize()
  const finger = z.finger ? v3(z.finger).normalize() : unterarm.clone()
  const flaeche = z.flaeche ? v3(z.flaeche) : new THREE.Vector3(links ? -1 : 1, 0, 0)
  flaeche.addScaledVector(finger, -flaeche.dot(finger))
  if (flaeche.lengthSq() < 1e-6) flaeche.set(0, 0, -1).addScaledVector(finger, finger.z)
  flaeche.normalize()
  return { links, schulter, ellbogen: mitte, handgelenk: ende, finger, flaeche, greifen: z.greifen ?? 0.3, oberarm: m.oberarm, unterarm: m.unterarm }
}

function bein(huefte: THREE.Vector3, fuss: V, qBecken: THREE.Quaternion): Bein {
  const ziel = new THREE.Vector3(fuss[0], KNOECHEL_Y, fuss[2])
  // Knie zeigt nach vorn und ein wenig nach aussen.
  const pol = new THREE.Vector3(Math.sign(huefte.x) * 0.15, 0.25, 1).applyQuaternion(qBecken)
  const { mitte, ende } = zweiGlied(huefte, ziel, OBERSCHENKEL, UNTERSCHENKEL, pol)
  const vor = new THREE.Vector3(Math.sign(huefte.x) * 0.12, 0, 1).applyQuaternion(qBecken)
  vor.y = 0
  return { huefte, knie: mitte, knoechel: ende, fuss: vor.normalize(), oberschenkel: OBERSCHENKEL }
}

export function skelett(pose: Pose, geschlecht = 0): Skelett {
  const s = SPEZ[pose]
  const m = masse(geschlecht)
  const becken = v3(s.becken)
  const qBecken = euler(s.beckenDreh)
  const qBrust = qBecken.clone().multiply(euler(s.brust))
  const hals = becken.clone().add(new THREE.Vector3(0, 0.21, 0).applyQuaternion(qBecken)).add(new THREE.Vector3(0, 0.4, 0).applyQuaternion(qBrust))
  const qKopf = qBrust.clone().multiply(euler(s.kopf))
  const qHals = qBrust.clone().slerp(qKopf, 0.5)
  const kopf = hals.clone().add(new THREE.Vector3(0, 0.07, -0.005).applyQuaternion(qHals)).add(new THREE.Vector3(0, 0.055, 0.0).applyQuaternion(qKopf))
  const schulter = (seite: number) => hals.clone().add(new THREE.Vector3(seite * m.schulter, -0.085, -0.025).applyQuaternion(qBrust))
  const huefte = (seite: number) => becken.clone().add(new THREE.Vector3(seite * m.huefte, 0, 0).applyQuaternion(qBecken))
  return {
    pose,
    sitzend: istSitzend(pose),
    becken,
    qBecken,
    qBrust,
    hals,
    qKopf,
    kopf,
    arme: [arm(true, schulter(1), s.links, m), arm(false, schulter(-1), s.rechts ?? spiegelArm(s.links), m)],
    beine: [bein(huefte(1), s.fussL, qBecken), bein(huefte(-1), s.fussR ?? spiegel(s.fussL), qBecken)],
    requisit: s.requisit,
  }
}
