// Detaillierter Mensch fuer einzelne Personen (Moderator, Band, Kamera).
//
// Ein Koerper aus Querschnitten: Rumpf, Arme, Beine, Haende und Finger sind
// Lofts entlang der Gelenkkette mit anatomischen Profilen (Deltamuskel,
// Bizeps, Wade, Handgelenk), der Kopf eine verformte Kugel mit Kinn, Nase,
// Augenhoehlen und Lippen. Kleidung ist dieselbe Oberflaeche mit Zugabe und
// eigenem Teil; Rock, Kleid und Sakko bekommen eine eigene Huelle, Haar auch.
// Keine Modell- oder Scandatei: Lizenzen von MetaHuman & Co. erlauben die
// Weitergabe nicht, und ein Skelett je Person waere fuer den Planer zu teuer.
import * as THREE from 'three'
import { skelett, type Arm, type Bein, type Pose, type Skelett } from './menschSkelett'

/** Teile wie `TEIL`, ergaenzt um die nur im Detail vorkommenden. */
export const TEIL_DETAIL = { haut: 0, oben: 1, unten: 2, haar: 3, schuh: 4, unterarm: 5, jacke: 6, auge: 7, iris: 8, lippe: 9, sohle: 10, requisit: 11 } as const
const T = TEIL_DETAIL

export type Statur = 'schlank' | 'mittel' | 'kraeftig'
export type Oberteil = 'tshirt' | 'hemd' | 'sakko' | 'kleid'
export type Unterteil = 'hose' | 'rock'
export type Schuhe = 'sneaker' | 'halbschuh' | 'stiefel'

export interface Gestalt {
  /** 0 maennlich … 1 weiblich, stufenlos. */
  geschlecht?: number
  statur?: Statur
  /** Haarlaenge unterhalb des Haaransatzes in m; 0 = Glatze, 0,04 kurz, 0,3 schulterlang. */
  haarLaenge?: number
  oberteil?: Oberteil
  /** Bei `kleid` ohne Wirkung. */
  unterteil?: Unterteil
  schuhe?: Schuhe
  /** Mikrofon bzw. Telefon in der Hand, wo die Pose eines vorsieht. */
  requisit?: boolean
}

export type VolleGestalt = Required<Gestalt>

export const GESTALT_STANDARD: VolleGestalt = { geschlecht: 0, statur: 'mittel', haarLaenge: 0.05, oberteil: 'tshirt', unterteil: 'hose', schuhe: 'halbschuh', requisit: true }

const UMFANG: Record<Statur, number> = { schlank: 0.9, mittel: 1, kraeftig: 1.13 }

// ── Netz ────────────────────────────────────────────────────────────────

interface Punkt {
  p: THREE.Vector3
  teil: number
  atem?: number
}

class Netz {
  pos: number[] = []
  teil: number[] = []
  atem: number[] = []
  idx: number[] = []

  punkt(q: Punkt): number {
    this.pos.push(q.p.x, q.p.y, q.p.z)
    this.teil.push(q.teil)
    this.atem.push(q.atem ?? 0)
    return this.teil.length - 1
  }

  /**
   * Ringe gleicher Punktzahl zu einer geschlossenen Roehre. Ringe laufen in
   * Achsrichtung T, Punkte gegen den Uhrzeigersinn um T (N → B, B = T × N);
   * so zeigen die Normalen nach aussen. `kappen` schliesst die Enden.
   */
  roehre(ringe: Punkt[][], kappen: boolean | 'ende' = true, innen = false): void {
    const n = ringe[0].length
    const ids = ringe.map((r) => r.map((q) => this.punkt(q)))
    const tri = (a: number, b: number, c: number) => (innen ? this.idx.push(a, c, b) : this.idx.push(a, b, c))
    for (let i = 0; i + 1 < ids.length; i++) {
      for (let j = 0; j < n; j++) {
        const j1 = (j + 1) % n
        tri(ids[i][j], ids[i][j1], ids[i + 1][j])
        tri(ids[i][j1], ids[i + 1][j1], ids[i + 1][j])
      }
    }
    if (!kappen) return
    const mitte = (r: Punkt[]): Punkt => {
      const c = new THREE.Vector3()
      r.forEach((q) => c.add(q.p))
      return { p: c.divideScalar(r.length), teil: r[0].teil, atem: r[0].atem }
    }
    const a = kappen === true ? this.punkt(mitte(ringe[0])) : -1
    const e = this.punkt(mitte(ringe[ringe.length - 1]))
    const erst = ids[0]
    const letzt = ids[ids.length - 1]
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n
      if (a >= 0) tri(a, erst[j1], erst[j])
      tri(e, letzt[j], letzt[j1])
    }
  }

  geometrie(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('teil', new THREE.Float32BufferAttribute(this.teil, 1))
    g.setAttribute('atem', new THREE.Float32BufferAttribute(this.atem, 1))
    g.setIndex(this.idx)
    g.computeVertexNormals()
    tangenten(g)
    return g
  }
}

/**
 * Tangente quer zur Hochachse. Am Haar ist das die Richtung quer zur
 * Straehne — dort streckt die Anisotropie das Glanzlicht zum Ring.
 */
function tangenten(g: THREE.BufferGeometry): void {
  const n = g.getAttribute('normal')
  const t = new Float32Array(n.count * 4)
  const nv = new THREE.Vector3()
  const tv = new THREE.Vector3()
  const oben = new THREE.Vector3(0, 1, 0)
  const seite = new THREE.Vector3(1, 0, 0)
  for (let i = 0; i < n.count; i++) {
    nv.fromBufferAttribute(n, i)
    tv.crossVectors(oben, nv)
    if (tv.lengthSq() < 0.01) tv.crossVectors(seite, nv)
    tv.normalize()
    t.set([tv.x, tv.y, tv.z, 1], i * 4)
  }
  g.setAttribute('tangent', new THREE.BufferAttribute(t, 4))
}

// ── Hilfen ──────────────────────────────────────────────────────────────

const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s))
const glatt = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
/** Superellipse: e = 2 Ellipse, groesser = kantiger. */
const se = (c: number, e: number) => Math.sign(c) * Math.pow(Math.abs(c), 2 / e)

type Tabelle = number[][]

/**
 * Kubische Interpolation einer Tabelle [x, w1, w2, …]. Kein smoothstep
 * zwischen den Stuetzstellen: dessen Steigung 0 an jeder Stelle zeichnet
 * waagerechte Rillen in die Schattierung. An Extremstellen flach, damit
 * nichts ueberschwingt.
 */
function tafel(t: Tabelle, x: number): number[] {
  if (x <= t[0][0]) return t[0].slice(1)
  const last = t.length - 1
  if (x >= t[last][0]) return t[last].slice(1)
  let i = 0
  while (t[i + 1][0] < x) i++
  const a = t[i]
  const b = t[i + 1]
  const h = b[0] - a[0]
  const k = (x - a[0]) / h
  const steig = (j: number, c: number): number => {
    const l = t[Math.max(0, j - 1)]
    const r = t[Math.min(last, j + 1)]
    const links = j > 0 ? (t[j][c] - l[c]) / (t[j][0] - l[0]) : 0
    const rechts = j < last ? (r[c] - t[j][c]) / (r[0] - t[j][0]) : 0
    if (j > 0 && j < last && links * rechts <= 0) return 0
    return (r[c] - l[c]) / (r[0] - l[0])
  }
  const k2 = k * k
  const k3 = k2 * k
  return a.slice(1).map((ya, j) => {
    const c = j + 1
    return (2 * k3 - 3 * k2 + 1) * ya + (k3 - 2 * k2 + k) * h * steig(i, c) + (-2 * k3 + 3 * k2) * b[c] + (k3 - k2) * h * steig(i + 1, c)
  })
}

/** Stuetzstellen von a bis b, plus Paare dicht an Grenzen fuer scharfe Saeume. */
function stellen(a: number, b: number, schritt: number, grenzen: number[] = []): number[] {
  const s: number[] = []
  const n = Math.max(2, Math.ceil((b - a) / schritt))
  for (let i = 0; i <= n; i++) s.push(a + ((b - a) * i) / n)
  for (const g of grenzen) if (g > a && g < b) s.push(g - 0.0015, g + 0.0015)
  return s.sort((x, y) => x - y).filter((x, i, l) => i === 0 || x - l[i - 1] > 0.0004)
}

// ── Loft entlang einer Gelenkkette ─────────────────────────────────────

interface Bahn {
  p: THREE.Vector3[]
  t: THREE.Vector3[]
  n: THREE.Vector3[]
  l: number[]
}

/** Polylinie mit gerundeten Ecken und paralleltransportiertem Rahmen. */
function bahn(punkte: THREE.Vector3[], hinweis: THREE.Vector3, rund: number): Bahn {
  const p: THREE.Vector3[] = [punkte[0].clone()]
  for (let i = 1; i < punkte.length - 1; i++) {
    const a = punkte[i - 1]
    const m = punkte[i]
    const b = punkte[i + 1]
    const r = Math.min(rund, a.distanceTo(m) * 0.45, m.distanceTo(b) * 0.45)
    const p0 = m.clone().sub(a).normalize().multiplyScalar(-r).add(m)
    const p2 = b.clone().sub(m).normalize().multiplyScalar(r).add(m)
    for (let k = 0; k <= 6; k++) {
      const t = k / 6
      p.push(p0.clone().multiplyScalar((1 - t) ** 2).addScaledVector(m, 2 * t * (1 - t)).addScaledVector(p2, t * t))
    }
  }
  p.push(punkte[punkte.length - 1].clone())
  const t = p.map((_, i) => p[Math.min(p.length - 1, i + 1)].clone().sub(p[Math.max(0, i - 1)]).normalize())
  const n: THREE.Vector3[] = []
  const n0 = hinweis.clone().addScaledVector(t[0], -hinweis.dot(t[0]))
  if (n0.lengthSq() < 1e-6) n0.set(0, 0, 1).addScaledVector(t[0], -t[0].z)
  n.push(n0.normalize())
  const q = new THREE.Quaternion()
  for (let i = 1; i < p.length; i++) {
    q.setFromUnitVectors(t[i - 1], t[i])
    const ni = n[i - 1].clone().applyQuaternion(q)
    n.push(ni.addScaledVector(t[i], -ni.dot(t[i])).normalize())
  }
  const l = [0]
  for (let i = 1; i < p.length; i++) l.push(l[i - 1] + p[i].distanceTo(p[i - 1]))
  return { p, t, n, l }
}

function aufBahn(b: Bahn, s: number): { c: THREE.Vector3; t: THREE.Vector3; n: THREE.Vector3 } {
  const last = b.p.length - 1
  if (s <= 0) return { c: b.p[0].clone().addScaledVector(b.t[0], s), t: b.t[0].clone(), n: b.n[0].clone() }
  if (s >= b.l[last]) return { c: b.p[last].clone().addScaledVector(b.t[last], s - b.l[last]), t: b.t[last].clone(), n: b.n[last].clone() }
  let i = 0
  while (b.l[i + 1] < s) i++
  const k = (s - b.l[i]) / Math.max(1e-9, b.l[i + 1] - b.l[i])
  const t = b.t[i].clone().lerp(b.t[i + 1], k).normalize()
  const n = b.n[i].clone().lerp(b.n[i + 1], k)
  return { c: b.p[i].clone().lerp(b.p[i + 1], k), t, n: n.addScaledVector(t, -n.dot(t)).normalize() }
}

interface Ring {
  s: number
  rn: number
  rb: number
  teil: number | ((cn: number, cb: number) => number)
  /** Versatz der Ringmitte entlang N. */
  hoch?: number
  e?: number
  atem?: number
}

interface LoftOpt {
  /** Ab hier dreht sich N zur Richtung `endN` (Unterarm-Drehung zur Hand). */
  endN?: THREE.Vector3
  endAb?: number
  endBis?: number
  n?: number
  kappen?: boolean
  innen?: boolean
}

function ringPunkte(c: THREE.Vector3, t: THREE.Vector3, nRich: THREE.Vector3, r: Ring, n: number, versatz = 0): Punkt[] {
  const b = t.clone().cross(nRich)
  const mitte = c.clone().addScaledVector(nRich, r.hoch ?? 0)
  const e = r.e ?? 2
  const out: Punkt[] = []
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2
    const cn = Math.cos(a)
    const cb = Math.sin(a)
    const p = mitte.clone().addScaledVector(nRich, (r.rn + versatz) * se(cn, e)).addScaledVector(b, (r.rb + versatz) * se(cb, e))
    out.push({ p, teil: typeof r.teil === 'number' ? r.teil : r.teil(cn, cb), atem: r.atem })
  }
  return out
}

function loft(netz: Netz, b: Bahn, ringe: Ring[], o: LoftOpt = {}): void {
  const n = o.n ?? 16
  const reihen = ringe.map((r) => {
    const f = aufBahn(b, r.s)
    let nr = f.n
    if (o.endN && o.endAb !== undefined && o.endBis !== undefined) {
      const k = glatt(o.endAb, o.endBis, r.s)
      const ziel = o.endN.clone().addScaledVector(f.t, -o.endN.dot(f.t))
      if (ziel.lengthSq() > 1e-6) {
        // Kuerzeste Drehung nehmen: N und -N beschreiben dieselbe Ellipse.
        if (ziel.dot(nr) < 0) ziel.negate()
        nr = nr.clone().lerp(ziel.normalize(), k).normalize()
      }
    }
    return ringPunkte(f.c, f.t, nr, r, n)
  })
  netz.roehre(reihen, o.kappen ?? true, o.innen)
}

// ── Rumpf ──────────────────────────────────────────────────────────────

// u = 0 Schritt … 1 Halsansatz; Spalten: halbe Breite, Tiefe vorn, Tiefe hinten.
const RUMPF_M: Tabelle = [
  [0, 0.05, 0.04, 0.05], [0.05, 0.1, 0.075, 0.098], [0.14, 0.172, 0.1, 0.122], [0.25, 0.165, 0.1, 0.105], [0.36, 0.15, 0.105, 0.092],
  [0.5, 0.155, 0.112, 0.095], [0.62, 0.162, 0.118, 0.1], [0.72, 0.17, 0.112, 0.103], [0.82, 0.18, 0.098, 0.1], [0.885, 0.185, 0.082, 0.088],
  [0.93, 0.172, 0.07, 0.08], [0.965, 0.118, 0.06, 0.066], [1, 0.062, 0.058, 0.058],
]
const RUMPF_W: Tabelle = [
  [0, 0.055, 0.04, 0.055], [0.05, 0.11, 0.078, 0.105], [0.14, 0.186, 0.098, 0.13], [0.25, 0.17, 0.094, 0.104], [0.36, 0.128, 0.092, 0.084],
  [0.5, 0.134, 0.098, 0.087], [0.62, 0.142, 0.1, 0.092], [0.72, 0.148, 0.098, 0.094], [0.82, 0.157, 0.088, 0.09], [0.885, 0.165, 0.074, 0.082],
  [0.93, 0.155, 0.064, 0.074], [0.965, 0.108, 0.056, 0.062], [1, 0.055, 0.052, 0.052],
]

class Rumpf {
  private bez: THREE.Vector3[]
  private qa: THREE.Quaternion
  private qb: THREE.Quaternion
  private proben: { c: THREE.Vector3; u: number }[] = []
  readonly laenge: number
  private sk: Skelett
  private g: VolleGestalt

  // Keine Parameter-Properties: die Planer bauen mit erasableSyntaxOnly.
  constructor(sk: Skelett, g: VolleGestalt) {
    this.sk = sk
    this.g = g
    const unten = new THREE.Vector3(0, -0.09, 0).applyQuaternion(sk.qBecken).add(sk.becken)
    const knick = new THREE.Vector3(0, 0.22, 0).applyQuaternion(sk.qBecken).add(sk.becken)
    this.bez = [unten, knick, sk.hals.clone()]
    this.qa = sk.qBecken
    this.qb = sk.qBrust
    const roh: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) roh.push(this.bezier(i / 64))
    const l = [0]
    for (let i = 1; i < roh.length; i++) l.push(l[i - 1] + roh[i].distanceTo(roh[i - 1]))
    this.laenge = l[l.length - 1]
    this.proben = roh.map((c, i) => ({ c, u: l[i] / this.laenge }))
  }

  private bezier(t: number): THREE.Vector3 {
    const [a, b, c] = this.bez
    return a.clone().multiplyScalar((1 - t) ** 2).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(c, t * t)
  }

  /** Mitte und Achsen (X links, Z vorn, T aufwaerts) bei u; ausserhalb [0, 1] geradeaus verlaengert. */
  rahmen(u: number): { c: THREE.Vector3; x: THREE.Vector3; z: THREE.Vector3; t: THREE.Vector3 } {
    const uk = THREE.MathUtils.clamp(u, 0, 1)
    let i = 0
    while (i < this.proben.length - 2 && this.proben[i + 1].u < uk) i++
    const a = this.proben[i]
    const b = this.proben[i + 1]
    const k = (uk - a.u) / Math.max(1e-9, b.u - a.u)
    const t = b.c.clone().sub(a.c).normalize()
    const c = a.c.clone().lerp(b.c, k).addScaledVector(t, (u - uk) * this.laenge)
    const q = this.qa.clone().slerp(this.qb, glatt(0.2, 0.75, uk))
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
    z.addScaledVector(t, -z.dot(t)).normalize()
    return { c, x: t.clone().cross(z), z, t }
  }

  /** Halbe Breite, Tiefe vorn, Tiefe hinten. */
  masse(u: number): [number, number, number] {
    const g = this.g.geschlecht
    const m = tafel(RUMPF_M, u)
    const w = tafel(RUMPF_W, u)
    const k = UMFANG[this.g.statur]
    const bauch = this.g.statur === 'kraeftig' ? 0.03 * gauss(u - 0.42, 0.14) : 0
    return [(m[0] + (w[0] - m[0]) * g) * (0.5 + 0.5 * k), (m[1] + (w[1] - m[1]) * g) * k + bauch, (m[2] + (w[2] - m[2]) * g) * k]
  }

  /** Punkt im Rumpfquerschnitt bei u und Winkelanteilen (cn vorn, cb links). */
  lokal(u: number, cn: number, cb: number, zugabe = 0): { x: number; z: number } {
    const [w, f, b] = this.masse(u)
    const e = 2 + 0.45 * glatt(0.05, 0.2, u) * (1 - glatt(0.88, 0.97, u))
    let x = w * se(cb, e)
    let z = (cn >= 0 ? f : b) * se(cn, e)
    const g = this.g.geschlecht
    const ax = Math.abs(x)
    if (cn > 0) {
      const brust = (0.012 + 0.042 * g) * gauss(ax - 0.085 * (w / 0.16), 0.055) * gauss(u - (0.66 - 0.04 * g), 0.07)
      z += brust * Math.pow(cn, 0.6)
    } else {
      const gesaess = (0.012 + 0.012 * g) * gauss(ax - 0.07, 0.06) * gauss(u - 0.13, 0.07)
      const blatt = 0.006 * gauss(ax - 0.09, 0.04) * gauss(u - 0.8, 0.06)
      const rinne = 0.006 * gauss(x, 0.02) * glatt(0.25, 0.4, u) * (1 - glatt(0.82, 0.92, u))
      z -= (gesaess + blatt - rinne) * Math.pow(-cn, 0.6)
    }
    if (zugabe) {
      const l = Math.hypot(x, z) || 1
      x += (x / l) * zugabe
      z += (z / l) * zugabe
    }
    return { x, z }
  }

  punkt(u: number, cn: number, cb: number, zugabe = 0): THREE.Vector3 {
    const r = this.rahmen(u)
    const q = this.lokal(u, cn, cb, zugabe)
    return r.c.addScaledVector(r.x, q.x).addScaledVector(r.z, q.z)
  }

  /** Schiebt einen Punkt aus dem Rumpf (plus Abstand) heraus — fuer Haar und Rock. */
  heraus(p: THREE.Vector3, abstand: number): THREE.Vector3 {
    const u = this.naechstesU(p)
    if (u <= 0.02 || u >= 0.98) return p
    const r = this.rahmen(u)
    const v = p.clone().sub(r.c)
    const x = v.dot(r.x)
    const z = v.dot(r.z)
    const [w, f, b] = this.masse(u)
    const tiefe = (z >= 0 ? f : b) + abstand
    const k = Math.hypot(x / (w + abstand), z / tiefe)
    if (k >= 1 || k < 1e-6) return p
    return p.clone().addScaledVector(r.x, x / k - x).addScaledVector(r.z, z / k - z)
  }

  /** Wie `heraus`, aber entlang einer waagerechten Richtung statt radial. */
  entlang(p: THREE.Vector3, richtung: THREE.Vector3, abstand: number): THREE.Vector3 {
    const u = this.naechstesU(p)
    if (u <= 0.02 || u >= 0.98) return p
    const r = this.rahmen(u)
    const v = p.clone().sub(r.c)
    const dx = richtung.dot(r.x)
    const dz = richtung.dot(r.z)
    const l = Math.hypot(dx, dz) || 1
    const [w, f, b] = this.masse(u)
    const d = dz >= 0 ? f : b
    const grenze = 1 / Math.hypot(dx / l / (w + abstand), dz / l / (d + abstand))
    const s = (v.dot(r.x) * dx + v.dot(r.z) * dz) / l
    if (s >= grenze) return p
    const quer = r.x.clone().multiplyScalar(dx / l).add(r.z.clone().multiplyScalar(dz / l))
    return p.clone().addScaledVector(quer, grenze - s)
  }

  private naechstesU(p: THREE.Vector3): number {
    let best = 0
    let d = Infinity
    this.proben.forEach((q, i) => {
      const di = q.c.distanceToSquared(p)
      if (di < d) {
        d = di
        best = i
      }
    })
    return this.proben[best].u
  }

  get skelett(): Skelett {
    return this.sk
  }
}

interface Kleid {
  /** Bund: darunter Hose/Rock. */
  bund: number
  /** Saum des Oberteils, wenn es ueber dem Bund haengt. */
  saum: number
}

function kleidung(g: VolleGestalt): Kleid {
  const tshirt = g.oberteil === 'tshirt'
  return { bund: 0.33, saum: tshirt ? 0.27 : 0.33 }
}

/**
 * Winkel eines Rings mit Ausschnitt vorn (halber Winkel `av`): die Kante
 * liegt genau auf einer doppelten Punktspalte, so bleibt sie scharf statt
 * treppig. Liefert je Punkt Winkel und ob er im Ausschnitt liegt.
 */
function ausschnittRing(n: number, av: number): { a: number; innen: boolean }[] {
  // Gleiche Punktzahl und -lage in jedem Ring, auch ohne Ausschnitt —
  // sonst verdrehen sich die Dreiecke zwischen den Ringen.
  const m = 6
  const A = Math.max(av, 0.02)
  const innen = av > 1e-3
  const out: { a: number; innen: boolean }[] = []
  for (let j = 0; j < m; j++) {
    const a = -A + (2 * A * j) / (m - 1)
    out.push({ a, innen: innen && Math.abs(a) <= av + 1e-9 })
  }
  const rest = n - m
  for (let j = 0; j < rest; j++) out.push({ a: A + ((2 * Math.PI - 2 * A) * j) / (rest - 1), innen: false })
  return out
}

/** Halbe Breite des Ausschnitts bei u als Ringwinkel. */
function ausschnittWinkel(g: VolleGestalt, u: number, w: number): number {
  let halb = 0
  if (g.oberteil === 'kleid') halb = 0.085 * Math.sqrt(Math.max(0, 1 - ((1 - u) / 0.14) ** 2))
  return Math.asin(Math.min(1, halb / w))
}

function rumpfTeil(g: VolleGestalt, k: Kleid, u: number): number {
  if (g.oberteil === 'kleid') return T.oben
  if (u < k.saum) return T.unten
  if (g.oberteil !== 'tshirt' && g.unterteil === 'hose' && u < k.bund + 0.035) return T.schuh
  return T.oben
}

function rumpfGeometrie(netz: Netz, r: Rumpf, g: VolleGestalt, k: Kleid): void {
  const n = 48
  const us = stellen(0, 1, 0.02, [k.saum, k.bund + 0.035])
  const ringe = us.map((u) => {
    const [w] = r.masse(u)
    const ring: Punkt[] = []
    const atem = gauss(u - 0.66, 0.14)
    for (const { a, innen } of ausschnittRing(n, ausschnittWinkel(g, u, w))) {
      const cn = Math.cos(a)
      const cb = Math.sin(a)
      const teil = innen ? T.haut : rumpfTeil(g, k, u)
      const zugabe = teil === T.haut ? 0 : teil === T.schuh ? 0.009 : teil === T.unten ? 0.006 : u < 0.36 ? 0.012 : 0.006
      ring.push({ p: r.punkt(u, cn, cb, zugabe), teil, atem })
    }
    return ring
  })
  netz.roehre(ringe)
}

// ── Gliedmassen ────────────────────────────────────────────────────────

// Abstand von der Schulter; Spalten: Radius quer zur Handflaeche, entlang.
function armProfil(a: Arm): Tabelle {
  const l1 = a.oberarm
  const l = a.oberarm + a.unterarm
  return [
    [-0.07, 0.02, 0.02], [-0.055, 0.036, 0.036], [-0.025, 0.04, 0.042], [0.02, 0.046, 0.048], [0.08, 0.047, 0.047], [0.14, 0.046, 0.045],
    [0.2, 0.043, 0.042], [l1 - 0.05, 0.039, 0.039], [l1, 0.036, 0.037], [l1 + 0.05, 0.04, 0.041], [l1 + 0.1, 0.035, 0.039], [l1 + 0.17, 0.026, 0.033],
    [l, 0.019, 0.027], [l + 0.012, 0.012, 0.018], [l + 0.018, 0.004, 0.006],
  ]
}

function armGeometrie(netz: Netz, a: Arm, g: VolleGestalt): void {
  const k = UMFANG[g.statur] * (1 - 0.1 * g.geschlecht)
  const start = a.schulter.clone().add(new THREE.Vector3(a.links ? -0.05 : 0.05, -0.005, 0))
  const b = bahn([start, a.schulter, a.ellbogen, a.handgelenk], a.flaeche, 0.05)
  const s0 = start.distanceTo(a.schulter)
  const l = a.oberarm + a.unterarm
  const aermel = g.oberteil === 'tshirt' || g.oberteil === 'kleid' ? 0.15 : l - 0.012
  const manschette = g.oberteil === 'sakko' ? l - 0.03 : l + 1
  const tab = armProfil(a)
  const ringe = stellen(-0.045, l + 0.018, 0.016, [aermel, manschette]).map((s): Ring => {
    const [rn, rb] = tafel(tab, s)
    let teil: number = T.haut
    let zugabe = 0
    if (s < aermel) {
      teil = g.oberteil === 'sakko' && s < manschette ? T.jacke : T.oben
      zugabe = g.oberteil === 'sakko' ? 0.014 : g.oberteil === 'hemd' ? 0.008 : 0.004 + 0.008 * glatt(0.02, aermel, s)
    }
    return { s: s + s0, rn: rn * k + zugabe, rb: rb * k + zugabe, teil }
  })
  loft(netz, b, ringe, { n: 20, endN: a.flaeche, endAb: s0 + a.oberarm - 0.02, endBis: s0 + l })
}

function beinGeometrie(netz: Netz, bn: Bein, g: VolleGestalt, unterL: number): void {
  const k = UMFANG[g.statur]
  const gs = g.geschlecht
  const start = bn.huefte.clone().add(new THREE.Vector3(-Math.sign(bn.huefte.x) * 0.03, 0.1, 0))
  const b = bahn([start, bn.huefte, bn.knie, bn.knoechel], new THREE.Vector3(0, 0, 1), 0.06)
  const s0 = start.distanceTo(bn.huefte)
  const l1 = bn.oberschenkel
  const l = l1 + unterL
  const tab: Tabelle = [
    [-0.1, 0.03, 0.03], [-0.085, 0.07, 0.07], [-0.05, 0.094, 0.088 + 0.008 * gs], [0, 0.097, 0.092 + 0.01 * gs], [0.08, 0.086, 0.085 + 0.006 * gs],
    [0.18, 0.07, 0.072], [0.3, 0.058, 0.06], [l1 - 0.04, 0.052, 0.053], [l1, 0.05, 0.051], [l1 + 0.06, 0.052, 0.05], [l1 + 0.13, 0.057, 0.05],
    [l1 + 0.22, 0.047, 0.043], [l1 + 0.33, 0.034, 0.031], [l, 0.03, 0.029], [l + 0.015, 0.02, 0.02], [l + 0.025, 0.006, 0.006],
  ]
  const hose = g.oberteil !== 'kleid' && g.unterteil === 'hose'
  const schaft = g.schuhe === 'stiefel' ? l - 0.2 : l + 1
  const ringe = stellen(-0.1, l + 0.025, 0.02, [schaft]).map((s): Ring => {
    const [rn, rb] = tafel(tab, s)
    const wade = -0.008 * gauss(s - (l1 + 0.12), 0.08)
    let teil: number = T.haut
    let zugabe = 0
    if (s >= schaft) {
      teil = T.schuh
      zugabe = hose ? 0.004 : 0.007
    } else if (hose) {
      teil = T.unten
      zugabe = 0.008 + 0.012 * glatt(l1 - 0.1, l1 + 0.15, s)
    }
    // Hosenbein faellt gerade: die Wade zeichnet sich nicht ab.
    return { s: s + s0, rn: rn * k + zugabe - (hose ? wade : 0), rb: rb * k + zugabe, teil, hoch: wade }
  })
  loft(netz, b, ringe, { n: 22 })
}

function schuhGeometrie(netz: Netz, bn: Bein, g: VolleGestalt): void {
  const boden = new THREE.Vector3(bn.knoechel.x, 0, bn.knoechel.z)
  const ferse = boden.clone().addScaledVector(bn.fuss, -0.06)
  const spitze = boden.clone().addScaledVector(bn.fuss, 0.205)
  const b = bahn([ferse, spitze], new THREE.Vector3(0, 1, 0), 0)
  const k = 1 - 0.08 * g.geschlecht
  const sneaker = g.schuhe === 'sneaker'
  const tab: Tabelle = [
    [-0.008, 0.02, 0.022], [0, 0.034, 0.03], [0.03, 0.045, 0.036], [0.07, 0.056, 0.04], [0.11, 0.044, 0.045], [0.15, 0.032, 0.048],
    [0.2, 0.025, 0.044], [0.24, 0.019, 0.034], [0.262, 0.01, 0.018], [0.268, 0.003, 0.005],
  ]
  const ringe = stellen(-0.008, 0.268, 0.012).map((s): Ring => {
    const [rn, rb] = tafel(tab, s)
    const h = rn * (sneaker ? 1.08 : 1)
    return { s, rn: h, rb: rb * k * (sneaker ? 1.06 : 1), hoch: h, e: 2.8, teil: (cn) => (cn < -0.5 ? T.sohle : T.schuh) }
  })
  loft(netz, b, ringe, { n: 18 })
}

// ── Hand ───────────────────────────────────────────────────────────────

const FINGER = [
  // quer (Richtung Daumen), vor, Radius, Glieder, Spreizung
  { q: 0.026, v: 0, r: 0.0095, l: [0.045, 0.026, 0.02], s: 0.08 },
  { q: 0.008, v: 0.006, r: 0.0098, l: [0.05, 0.03, 0.021], s: 0 },
  { q: -0.011, v: 0, r: 0.009, l: [0.046, 0.028, 0.02], s: -0.06 },
  { q: -0.029, v: -0.012, r: 0.0078, l: [0.036, 0.02, 0.018], s: -0.14 },
]

function fingerLoft(netz: Netz, punkte: THREE.Vector3[], r: number, hinweis: THREE.Vector3): void {
  const b = bahn(punkte, hinweis, 0.006)
  const l = b.l[b.l.length - 1]
  const ringe = stellen(-0.004, l + r * 0.9, 0.007).map((s): Ring => {
    const ende = s > l ? Math.sqrt(Math.max(0.02, 1 - ((s - l) / (r * 0.9)) ** 2)) : 1
    const rr = r * (1 - 0.22 * (s / l)) * ende
    return { s, rn: rr * 0.86, rb: rr, teil: T.haut }
  })
  loft(netz, b, ringe, { n: 8 })
}

function handGeometrie(netz: Netz, a: Arm, g: VolleGestalt): void {
  const k = 1 - 0.09 * g.geschlecht
  const F = a.finger
  const N = a.flaeche
  const daumen = F.clone().cross(N).multiplyScalar(a.links ? -1 : 1).normalize()
  const w = a.handgelenk
  const anf = w.clone().addScaledVector(F, -0.02)
  const b = bahn([anf, w.clone().addScaledVector(F, 0.1 * k)], N, 0)
  const tab: Tabelle = [[0, 0.018, 0.026], [0.02, 0.02, 0.031], [0.045, 0.018, 0.04], [0.075, 0.016, 0.043], [0.1, 0.014, 0.041], [0.112, 0.009, 0.03], [0.118, 0.002, 0.01]]
  const ringe = stellen(0, 0.118 * k, 0.012).map((s): Ring => {
    const [rn, rb] = tafel(tab, s / k)
    // Handflaeche ist zum Daumen hin dicker (Daumenballen).
    return { s, rn: rn * k, rb: rb * k, teil: T.haut, hoch: -0.002 }
  })
  loft(netz, b, ringe, { n: 14 })
  const rest = 0.15
  FINGER.forEach((f, i) => {
    const krumm = rest + a.greifen * (1 + i * 0.08)
    const quer = daumen.clone().multiplyScalar(Math.sin(f.s * (1 - a.greifen)))
    const dir0 = F.clone().multiplyScalar(Math.cos(f.s * (1 - a.greifen))).add(quer).normalize()
    const basis = w.clone().addScaledVector(F, (0.093 + f.v) * k).addScaledVector(daumen, f.q * k).addScaledVector(N, -0.002)
    const punkte = [basis.clone().addScaledVector(dir0, -0.012), basis]
    let winkel = 0
    let p = basis
    f.l.forEach((len, j) => {
      winkel += krumm * [1.0, 1.35, 0.9][j]
      const d = dir0.clone().multiplyScalar(Math.cos(winkel)).addScaledVector(N, Math.sin(winkel))
      p = p.clone().addScaledVector(d, len * k)
      punkte.push(p)
    })
    fingerLoft(netz, punkte, f.r * k, N)
  })
  // Daumen: aus dem Ballen schraeg nach vorn, beim Greifen zur Handflaeche.
  const tb = w.clone().addScaledVector(F, 0.025 * k).addScaledVector(daumen, 0.024 * k).addScaledVector(N, 0.008)
  const d0 = F.clone().multiplyScalar(0.72).addScaledVector(daumen, 0.55).addScaledVector(N, 0.35).normalize()
  const zur = daumen.clone().multiplyScalar(-0.6).addScaledVector(N, 0.8).normalize()
  const punkte = [tb.clone().addScaledVector(d0, -0.01), tb]
  let p = tb
  let d = d0
  ;[0.042, 0.032, 0.027].forEach((len, j) => {
    d = d.clone().lerp(zur, a.greifen * [0.25, 0.4, 0.35][j] + 0.05).normalize()
    p = p.clone().addScaledVector(d, len * k)
    punkte.push(p)
  })
  fingerLoft(netz, punkte, 0.0105 * k, N)
}

// ── Kopf, Hals, Haar ───────────────────────────────────────────────────

// Kopf als Stapel waagerechter Schnitte wie der Rumpf, damit das Profil
// stimmt: senkrechte Stirn, Kieferwinkel, Kinn, der Hals setzt hinten an.
// Eine verformte Kugel gibt im Profil immer einen Keil.
// y (Kinn −0,112 … Scheitel 0,112); halbe Breite, Tiefe vorn, Tiefe hinten
// (negativ: Hinterkante liegt vor der Mitte — Unterseite des Kiefers).
const KOPF: Tabelle = [
  [-0.112, 0.012, 0.05, -0.045], [-0.104, 0.03, 0.064, -0.03], [-0.09, 0.046, 0.072, -0.008], [-0.075, 0.058, 0.078, 0.02],
  [-0.06, 0.062, 0.082, 0.055], [-0.045, 0.066, 0.084, 0.076], [-0.025, 0.071, 0.086, 0.09], [0, 0.074, 0.087, 0.097],
  [0.03, 0.075, 0.087, 0.1], [0.055, 0.072, 0.08, 0.097], [0.08, 0.063, 0.062, 0.084], [0.1, 0.044, 0.038, 0.058],
  [0.109, 0.024, 0.018, 0.032], [0.112, 0.004, 0.003, 0.005],
]
const KOPF_UNTEN = -0.112
const KOPF_OBEN = 0.112

function kopfSchnitt(y: number, g: VolleGestalt): [number, number, number] {
  const [w, f, b] = tafel(KOPF, y)
  const s = 1 - 0.035 * g.geschlecht
  // Weiblich: schmalerer Unterkiefer.
  const kiefer = 1 - 0.1 * g.geschlecht * glatt(-0.02, -0.09, y)
  return [w * s * kiefer, f * s, b * s]
}

/** Kopfoberflaeche ohne Gesicht (fuer das Haar). */
function kopfFlaeche(y: number, cn: number, cb: number, g: VolleGestalt): THREE.Vector3 {
  const [w, f, b] = kopfSchnitt(y, g)
  const e = 2.3
  return new THREE.Vector3(w * se(cb, e), y, (cn >= 0 ? f : b) * se(cn, e))
}

/** Kopfoberflaeche mit Gesicht in Kopfkoordinaten (y hoch, z Gesicht). */
function kopfPunkt(y: number, cn: number, cb: number, g: VolleGestalt): THREE.Vector3 {
  const p = kopfFlaeche(y, cn, cb, g)
  if (cn > 0.3) {
    const x = p.x
    const ax = Math.abs(x)
    let z = p.z
    z -= 0.011 * gauss(ax - 0.032, 0.015) * gauss(y - 0.012, 0.011)
    z += 0.005 * gauss(ax - 0.03, 0.022) * gauss(y - 0.035, 0.009)
    const nase = 0.024 * glatt(0.035, -0.022, y) * (1 - glatt(-0.026, -0.038, y))
    z += nase * gauss(x, 0.0065 + 0.005 * glatt(0.02, -0.03, y))
    z += 0.006 * gauss(x, 0.017) * gauss(y + 0.032, 0.006)
    z += 0.005 * gauss(ax - 0.048, 0.016) * gauss(y + 0.01, 0.018)
    z += 0.0035 * gauss(x, 0.02) * gauss(y + 0.05, 0.0055)
    z += 0.0035 * gauss(x, 0.018) * gauss(y + 0.064, 0.0055)
    z -= 0.003 * gauss(x, 0.03) * gauss(y + 0.074, 0.006)
    z += (0.009 - 0.003 * g.geschlecht) * gauss(x, 0.022) * gauss(y + 0.094, 0.014)
    p.z += (z - p.z) * glatt(0.3, 0.6, cn)
  }
  return p
}

/** Vorderste Gesichtsflaeche bei (x, y), fuer den Sitz der Augen. */
function gesichtZ(x: number, y: number, g: VolleGestalt): number {
  let best = 0
  for (let a = -1.2; a <= 1.2; a += 0.002) {
    const p = kopfPunkt(y, Math.cos(a), Math.sin(a), g)
    if (Math.abs(p.x - x) < 0.0008) best = Math.max(best, p.z)
  }
  return best
}

/** Augenbraue: Bogen ueber der Augenhoehle. */
function braue(p: THREE.Vector3): boolean {
  const ax = Math.abs(p.x)
  if (p.z < 0.05 || ax < 0.011 || ax > 0.05) return false
  const mitte = 0.03 + 0.006 * Math.sin(((ax - 0.011) / 0.039) * Math.PI) - 0.003 * ((ax - 0.011) / 0.039)
  return Math.abs(p.y - mitte) < 0.0038 * (1 - 0.4 * ((ax - 0.011) / 0.039))
}

/** Winkelverteilung dichter vorn (Gesicht) bzw. in der Gesichtszone. */
const verdichten = (u: number, c: number) => u - (c / (2 * Math.PI)) * Math.sin(2 * Math.PI * u)

function kopfGeometrie(netz: Netz, sk: Skelett, g: VolleGestalt): void {
  const welt = (p: THREE.Vector3) => p.applyQuaternion(sk.qKopf).add(sk.kopf)
  const n = 56
  const ringe: Punkt[][] = []
  for (const y of stellen(KOPF_UNTEN + 0.001, KOPF_OBEN - 0.001, 0.0048)) {
    const ring: Punkt[] = []
    for (let j = 0; j < n; j++) {
      const a = verdichten(j / n, 0.55) * Math.PI * 2
      const p = kopfPunkt(y, Math.cos(a), Math.sin(a), g)
      const lippe = p.z > 0.05 && (p.x / 0.023) ** 2 + ((p.y + 0.057) / 0.012) ** 2 < 1
      ring.push({ p: welt(p), teil: lippe ? T.lippe : braue(p) ? T.haar : T.haut })
    }
    ringe.push(ring)
  }
  netz.roehre(ringe)
  const breite = kopfSchnitt(-0.005, g)[0]
  // Ohren: flache Ellipsoide, leicht nach hinten gekippt.
  for (const s of [-1, 1]) {
    const ohr = new THREE.SphereGeometry(1, 12, 10)
    ohr.scale(0.009, 0.029, 0.018)
    ohr.rotateX(-0.15)
    ohr.rotateY(s * 0.35)
    ohr.translate(s * (breite - 0.003), -0.008, -0.012)
    uebernehmen(netz, ohr, T.haut, (p) => welt(p))
  }
  // Augen: Augapfel plus Iris, in die Augenhoehle gesetzt.
  for (const s of [-1, 1]) {
    const mitte = new THREE.Vector3(s * 0.031, 0.012, gesichtZ(s * 0.031, 0.012, g) + 0.005)
    const apfel = new THREE.SphereGeometry(0.0118, 12, 10)
    apfel.translate(mitte.x, mitte.y, mitte.z - 0.0118)
    uebernehmen(netz, apfel, T.auge, (p) => welt(p))
    // Oberlid: Hautkappe ueber dem oberen Drittel, nimmt den starren Blick.
    const lid = new THREE.SphereGeometry(0.0128, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.36)
    lid.rotateX(0.5)
    lid.translate(mitte.x, mitte.y, mitte.z - 0.0118)
    uebernehmen(netz, lid, T.haut, (p) => welt(p))
    const iris = new THREE.SphereGeometry(0.0072, 10, 8)
    iris.scale(1, 1, 0.55)
    iris.translate(mitte.x, mitte.y, mitte.z - 0.0118 + 0.0094)
    uebernehmen(netz, iris, T.iris, (p) => welt(p))
  }
}

function uebernehmen(netz: Netz, geo: THREE.BufferGeometry, teil: number, f: (p: THREE.Vector3) => THREE.Vector3): void {
  const pos = geo.getAttribute('position')
  const basis = netz.teil.length
  for (let i = 0; i < pos.count; i++) netz.punkt({ p: f(new THREE.Vector3().fromBufferAttribute(pos, i)), teil })
  const idx = geo.getIndex()
  if (idx) for (let i = 0; i < idx.count; i++) netz.idx.push(basis + idx.getX(i))
  geo.dispose()
}

function halsGeometrie(netz: Netz, sk: Skelett, g: VolleGestalt): void {
  const qHals = sk.qBrust.clone().slerp(sk.qKopf, 0.5)
  const auf = new THREE.Vector3(0, 1, 0).applyQuaternion(qHals)
  const unten = sk.hals.clone().addScaledVector(auf, -0.05)
  const oben = new THREE.Vector3(0, -0.055, -0.02).applyQuaternion(sk.qKopf).add(sk.kopf)
  const vor = new THREE.Vector3(0, 0, 1).applyQuaternion(qHals)
  const b = bahn([unten, oben], vor, 0)
  const l = unten.distanceTo(oben)
  const k = (1 - 0.13 * g.geschlecht) * (0.6 + 0.4 * UMFANG[g.statur])
  const ringe = stellen(-0.01, l + 0.01, 0.015).map((s): Ring => ({ s, rn: 0.053 * k, rb: 0.06 * k, teil: T.haut, hoch: -0.004 }))
  loft(netz, b, ringe, { n: 18 })
  if (g.oberteil === 'hemd' || g.oberteil === 'sakko') {
    // Kragen: offener Ring, vorn ein Spalt.
    const kr = stellen(0.03, 0.068, 0.01).map((s): Ring => ({ s, rn: 0.05 * k + 0.007, rb: 0.056 * k + 0.007, teil: T.oben, hoch: -0.004 }))
    loft(netz, b, kr, { n: 18, kappen: false })
  }
}

/** Haaransatz als Polarwinkel je Azimut (0 = Stirn). */
function ansatz(phi: number, lang: number): number {
  const grad = 86 - 38 * Math.cos(phi) + 2 * Math.cos(2 * phi)
  const seite = glatt(0.55, 0.1, Math.cos(phi))
  return ((grad + 22 * lang * seite) * Math.PI) / 180
}

function haarGeometrie(netz: Netz, sk: Skelett, g: VolleGestalt, rumpf: Rumpf): void {
  const laenge = Math.max(0, g.haarLaenge)
  if (laenge < 0.005) return
  const lang = glatt(0.1, 0.25, laenge)
  const volumen = 0.007 + Math.min(0.011, laenge * 0.15)
  const n = 48
  const zeilen = 22 + Math.round(lang * 14)
  const welt = (p: THREE.Vector3) => p.applyQuaternion(sk.qKopf).add(sk.kopf)
  const ab = new THREE.Vector3(0, -1, 0)
  const aussen: Punkt[][] = []
  const innen: Punkt[][] = []
  for (let i = zeilen; i >= 1; i--) {
    const ring: Punkt[] = []
    const ringI: Punkt[] = []
    for (let j = 0; j < n; j++) {
      const phi = verdichten(j / n, 0.3) * Math.PI * 2
      const thMax = ansatz(phi, lang)
      const haengen = lang * laenge * glatt(0.45, 0.12, Math.cos(phi))
      // Straehnenweg: Scheitel → Ansatz ueber die Kopfhaut, dann frei haengend.
      const kopfWeg = thMax * 0.1
      const gesamt = kopfWeg + haengen
      const d = (i / zeilen) * gesamt
      const th = d <= kopfWeg ? (d / kopfWeg) * thMax : thMax
      // Am Ansatz laeuft das Haar flach aus, sonst wirkt es wie eine Kappe.
      const rand = haengen > 0.01 ? 1 : 0.15 + 0.85 * glatt(thMax, thMax - 0.3, th)
      const dicke = (volumen * (0.55 + 0.45 * Math.cos(Math.min(th, Math.PI / 2))) + 0.002) * rand
      const richt = new THREE.Vector3(Math.sin(th) * Math.sin(phi), Math.cos(th), Math.sin(th) * Math.cos(phi))
      const basis = kopfFlaeche(KOPF_OBEN * richt.y, Math.cos(phi), Math.sin(phi), g)
      const normale = basis.clone().setY(basis.y * 0.8 - 0.01).normalize()
      let p = welt(basis.clone().addScaledVector(normale, dicke))
      let pi = welt(basis.clone().addScaledVector(normale, 0.0015))
      if (d > kopfWeg) {
        const frei = d - kopfWeg
        // Jede Straehne faellt in ihrer eigenen Richtung (Azimut) ueber
        // Schulter oder Ruecken; radial aus der Rumpfmitte geschoben,
        // landeten seitliche Straehnen als Latz vor der Brust.
        const raus = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).applyQuaternion(sk.qKopf)
        raus.y = 0
        raus.normalize()
        const weg = (q: THREE.Vector3, dk: number) =>
          rumpf.entlang(q.clone().addScaledVector(ab, frei).addScaledVector(raus, Math.min(frei, 0.05) * 0.35 + dk), raus, 0.012 + dk)
        p = weg(p, 0.004)
        pi = weg(pi, 0)
      }
      ring.push({ p, teil: T.haar })
      ringI.push({ p: pi, teil: T.haar })
    }
    aussen.push(ring)
    innen.push(ringI)
  }
  netz.roehre(aussen, 'ende')
  // Lange Haare sieht man auch von innen (Vorhang hinter dem Hals).
  if (lang > 0) netz.roehre(innen, false, true)
}

// ── Huellen: Rock/Kleid, Sakko ─────────────────────────────────────────

// Rock und Sakko sind einseitig: eine Innenseite laege fast deckungsgleich
// und gaebe im Schattenpass (Rueckseiten) Streifen-Akne auf der Aussenseite.
// Hineinsehen kann man nur von unten.

/** Abstand zu einem Oberschenkel-Kegel; schiebt p heraus. */
function ausSchenkel(p: THREE.Vector3, bn: Bein, r0: number, r1: number): THREE.Vector3 {
  const ab = bn.knie.clone().sub(bn.huefte)
  const l2 = ab.lengthSq()
  const t = THREE.MathUtils.clamp(p.clone().sub(bn.huefte).dot(ab) / l2, 0, 1)
  const fuss = bn.huefte.clone().addScaledVector(ab, t)
  const r = r0 + (r1 - r0) * t
  const v = p.clone().sub(fuss)
  const d = v.length()
  if (d >= r || d < 1e-6) return p
  return fuss.addScaledVector(v, r / d)
}

function rockGeometrie(netz: Netz, r: Rumpf, g: VolleGestalt, k: Kleid): void {
  const sk = r.skelett
  const kleid = g.oberteil === 'kleid'
  const teil = kleid ? T.oben : T.unten
  const [bl, br] = sk.beine
  // Saum knapp ueber dem Knie, als Ring um beide Beine.
  const anteil = kleid ? 0.88 : 0.8
  const saumL = bl.huefte.clone().lerp(bl.knie, anteil)
  const saumR = br.huefte.clone().lerp(br.knie, anteil)
  const mitte = saumL.clone().add(saumR).multiplyScalar(0.5)
  const quer = new THREE.Vector3(1, 0, 0).applyQuaternion(sk.qBecken)
  const lauf = bl.knie.clone().sub(bl.huefte).add(br.knie.clone().sub(br.huefte)).normalize()
  const vorn = lauf.clone().cross(quer).normalize()
  const halbQuer = Math.abs(saumL.clone().sub(saumR).dot(quer)) / 2 + 0.085
  const halbVorn = 0.1
  const um = UMFANG[g.statur]
  const n = 40
  const zeilen = 14
  const ringe: Punkt[][] = []
  for (let i = 0; i <= zeilen; i++) {
    const t = i / zeilen
    const ring: Punkt[] = []
    for (let j = 0; j < n; j++) {
      const a = (j / n) * Math.PI * 2
      const cn = Math.cos(a)
      const cb = Math.sin(a)
      const oben = r.punkt(k.bund, cn, cb, 0.01)
      const unten = mitte.clone().addScaledVector(quer, (halbQuer * um + 0.02) * cb).addScaledVector(vorn, (halbVorn * um + 0.02) * cn)
      let p = unten.clone().lerp(oben, Math.pow(1 - t, 1.6))
      for (const bn of sk.beine) p = ausSchenkel(p, bn, 0.12 * um, 0.085 * um)
      p = r.heraus(p, 0.012)
      ring.push({ p, teil })
    }
    ringe.push(ring)
  }
  netz.roehre(ringe, false, true)
}

function sakkoGeometrie(netz: Netz, r: Rumpf, um: number): void {
  const sk = r.skelett
  const n = 56
  const us = stellen(-0.06, 0.965, 0.018)
  const ringe = us.map((u) => {
    const ring: Punkt[] = []
    const breite = u < 0.14 ? r.masse(0.14)[0] : r.masse(u)[0]
    // Revers: V-Ausschnitt vorn, darin sieht man das Hemd.
    const av = Math.asin(Math.min(1, (0.075 * glatt(0.56, 0.95, u)) / breite))
    for (const { a, innen } of ausschnittRing(n, av)) {
      const cn = Math.cos(a)
      const cb = Math.sin(a)
      let p = u < 0.14 ? (() => {
        const f = r.rahmen(u)
        const q = r.lokal(0.14, cn, cb, 0.022)
        return f.c.addScaledVector(f.x, q.x).addScaledVector(f.z, q.z)
      })() : r.punkt(u, cn, cb, 0.016)
      for (const bn of sk.beine) p = ausSchenkel(p, bn, 0.13 * um, 0.095 * um)
      ring.push({ p, teil: innen ? T.oben : T.jacke, atem: gauss(u - 0.66, 0.14) })
    }
    return ring
  })
  netz.roehre(ringe, false)
}

// ── Requisiten ─────────────────────────────────────────────────────────

function requisitGeometrie(netz: Netz, sk: Skelett): void {
  const hand = sk.arme[1]
  const mittelHand = hand.handgelenk.clone().addScaledVector(hand.finger, 0.06)
  if (sk.requisit === 'mikrofon') {
    const griff = mittelHand.clone().addScaledVector(hand.flaeche, 0.028)
    const mund = new THREE.Vector3(0, -0.058, 0.1).applyQuaternion(sk.qKopf).add(sk.kopf)
    const achse = mund.clone().sub(griff).normalize()
    const a = griff.clone().addScaledVector(achse, -0.09)
    const e = mund.clone().addScaledVector(achse, -0.045)
    const b = bahn([a, e], hand.finger, 0)
    const l = a.distanceTo(e)
    const ringe = stellen(0, l, 0.012).map((s): Ring => ({ s, rn: 0.014 + 0.007 * (s / l), rb: 0.014 + 0.007 * (s / l), teil: T.requisit }))
    loft(netz, b, ringe, { n: 12 })
    const korb = new THREE.SphereGeometry(0.027, 14, 10)
    uebernehmen(netz, korb, T.requisit, (p) => p.add(e).addScaledVector(achse, 0.018))
  } else if (sk.requisit === 'telefon') {
    const mitte = mittelHand.clone().addScaledVector(hand.flaeche, 0.014)
    const a = mitte.clone().addScaledVector(hand.finger, -0.07)
    const b = bahn([a, mitte.clone().addScaledVector(hand.finger, 0.075)], hand.flaeche, 0)
    const ringe = stellen(0, 0.145, 0.02).map((s): Ring => ({ s, rn: 0.0045, rb: 0.035, e: 6, teil: T.requisit }))
    loft(netz, b, ringe, { n: 16 })
  }
}

// ── Zusammenbau ────────────────────────────────────────────────────────

export function vollstaendig(g: Gestalt = {}): VolleGestalt {
  return { ...GESTALT_STANDARD, ...Object.fromEntries(Object.entries(g).filter(([, v]) => v !== undefined)) } as VolleGestalt
}

/**
 * Detaillierte Geometrie (Normgroesse 1,75 m, Blick +z) mit Attributen
 * `teil` (TEIL_DETAIL), `atem` (0..1, Brustkorb) und `tangent`.
 */
export function koerperGeometrie(pose: Pose, gestalt: Gestalt = {}): THREE.BufferGeometry {
  const g = vollstaendig(gestalt)
  const sk = skelett(pose, g.geschlecht)
  const netz = new Netz()
  const rumpf = new Rumpf(sk, g)
  const k = kleidung(g)
  rumpfGeometrie(netz, rumpf, g, k)
  halsGeometrie(netz, sk, g)
  kopfGeometrie(netz, sk, g)
  haarGeometrie(netz, sk, g, rumpf)
  for (const a of sk.arme) {
    armGeometrie(netz, a, g)
    handGeometrie(netz, a, g)
  }
  for (const b of sk.beine) {
    beinGeometrie(netz, b, g, b.knoechel.distanceTo(b.knie))
    schuhGeometrie(netz, b, g)
  }
  if (g.oberteil === 'kleid' || g.unterteil === 'rock') rockGeometrie(netz, rumpf, g, k)
  if (g.oberteil === 'sakko') sakkoGeometrie(netz, rumpf, UMFANG[g.statur])
  if (g.requisit && sk.requisit) requisitGeometrie(netz, sk)
  const geo = netz.geometrie()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}
