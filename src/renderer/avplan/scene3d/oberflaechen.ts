// Prozedurale PBR-Oberflaechen: Boden, Waende, Buehne, Tribuene, Sitze.
//
// Gezeichnet statt geladen — keine Bilddateien im Paket, keine Lizenzfrage,
// offline. Jede Art liefert Farbe und Rauheit aus demselben Muster, damit
// Fugen und Abnutzung auch im Glanzlicht stimmen. Die Texturen werden je Art
// einmal erzeugt; die Wiederholung bekommt jede Flaeche als eigene Kopie.
import * as THREE from 'three'

export type OberflaechenArt = 'concrete' | 'wood' | 'carpet' | 'turf' | 'tiles' | 'stage' | 'seat' | 'riser' | 'plaster' | 'brick' | 'drape'

interface Muster {
  /** Kantenlaenge einer Kachel in Metern. */
  kachelM: number
  rauheit: number
  metall: number
  grund: string
  zeichnen: (c: CanvasRenderingContext2D, n: number, rau: CanvasRenderingContext2D) => void
}

function zufall(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Kachelbares Wertrauschen als Grauwert-Feld 0..1. */
function rauschFeld(n: number, zellen: number, seed: number): Float32Array {
  const r = zufall(seed)
  const gitter = new Float32Array(zellen * zellen).map(() => r())
  const out = new Float32Array(n * n)
  const glatt = (t: number) => t * t * (3 - 2 * t)
  for (let y = 0; y < n; y++) {
    const gy = (y / n) * zellen
    const y0 = Math.floor(gy) % zellen
    const y1 = (y0 + 1) % zellen
    const fy = glatt(gy - Math.floor(gy))
    for (let x = 0; x < n; x++) {
      const gx = (x / n) * zellen
      const x0 = Math.floor(gx) % zellen
      const x1 = (x0 + 1) % zellen
      const fx = glatt(gx - Math.floor(gx))
      const a = gitter[y0 * zellen + x0] + (gitter[y0 * zellen + x1] - gitter[y0 * zellen + x0]) * fx
      const b = gitter[y1 * zellen + x0] + (gitter[y1 * zellen + x1] - gitter[y1 * zellen + x0]) * fx
      out[y * n + x] = a + (b - a) * fy
    }
  }
  return out
}

function fbm(n: number, seed: number, oktaven: number[]): Float32Array {
  const out = new Float32Array(n * n)
  let summe = 0
  oktaven.forEach((zellen, i) => {
    const w = 1 / (i + 1)
    summe += w
    const f = rauschFeld(n, zellen, seed + i * 101)
    for (let k = 0; k < out.length; k++) out[k] += f[k] * w
  })
  for (let k = 0; k < out.length; k++) out[k] /= summe
  return out
}

/** Legt ein Rauschfeld als Helligkeitsmodulation ueber den Canvas. */
function moduliere(c: CanvasRenderingContext2D, n: number, feld: Float32Array, staerke: number): void {
  const bild = c.getImageData(0, 0, n, n)
  const d = bild.data
  for (let k = 0; k < feld.length; k++) {
    const m = 1 + (feld[k] - 0.5) * 2 * staerke
    d[k * 4] = Math.min(255, d[k * 4] * m)
    d[k * 4 + 1] = Math.min(255, d[k * 4 + 1] * m)
    d[k * 4 + 2] = Math.min(255, d[k * 4 + 2] * m)
  }
  c.putImageData(bild, 0, 0)
}

const MUSTER: Record<OberflaechenArt, Muster> = {
  concrete: {
    kachelM: 4, rauheit: 0.82, metall: 0, grund: '#6d6c69',
    zeichnen: (c, n, rau) => {
      moduliere(c, n, fbm(n, 11, [4, 9, 23, 64]), 0.22)
      moduliere(rau, n, fbm(n, 12, [6, 31]), 0.25)
      // Dehnfugen
      c.fillStyle = 'rgba(20,20,20,0.35)'
      c.fillRect(0, 0, n, 2)
      c.fillRect(0, 0, 2, n)
    },
  },
  wood: {
    kachelM: 2.4, rauheit: 0.55, metall: 0, grund: '#8a6242',
    zeichnen: (c, n, rau) => {
      const r = zufall(21)
      const dielen = 8
      const h = n / dielen
      for (let i = 0; i < dielen; i++) {
        const ton = 0.82 + r() * 0.3
        c.fillStyle = `rgba(${Math.round(138 * ton)},${Math.round(98 * ton)},${Math.round(66 * ton)},1)`
        c.fillRect(0, i * h, n, h)
        const versatz = r() * n
        c.fillStyle = 'rgba(25,15,8,0.6)'
        c.fillRect(versatz, i * h, 2, h)
        c.fillRect(0, i * h, n, 1.5)
      }
      // Maserung: langgezogenes Rauschen
      const feld = fbm(n, 22, [3, 7, 40])
      const bild = c.getImageData(0, 0, n, n)
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const k = y * n + x
          const streifen = Math.sin(y * 0.9 + feld[k] * 18) * 0.08
          const m = 1 + streifen + (feld[(y * n + ((x * 7) % n))] - 0.5) * 0.15
          bild.data[k * 4] *= m
          bild.data[k * 4 + 1] *= m
          bild.data[k * 4 + 2] *= m
        }
      }
      c.putImageData(bild, 0, 0)
      moduliere(rau, n, feld, 0.3)
    },
  },
  carpet: {
    kachelM: 1, rauheit: 0.95, metall: 0, grund: '#3a3f4a',
    zeichnen: (c, n, rau) => {
      moduliere(c, n, fbm(n, 31, [64, 128]), 0.18)
      moduliere(c, n, fbm(n, 32, [3, 6]), 0.08)
      moduliere(rau, n, fbm(n, 33, [128]), 0.05)
    },
  },
  turf: {
    // Zwei Maehstreifen je Kachel: bei 10 m sind die Streifen 5 m breit,
    // wie auf einem echten Platz.
    kachelM: 10, rauheit: 0.9, metall: 0, grund: '#2f5d2a',
    zeichnen: (c, n, rau) => {
      c.fillStyle = 'rgba(255,255,255,0.07)'
      c.fillRect(0, 0, n / 2, n)
      moduliere(c, n, fbm(n, 41, [16, 64, 160]), 0.2)
      moduliere(c, n, fbm(n, 42, [3, 5]), 0.1)
      moduliere(rau, n, fbm(n, 43, [90]), 0.08)
    },
  },
  tiles: {
    kachelM: 1.2, rauheit: 0.35, metall: 0, grund: '#9b968e',
    zeichnen: (c, n, rau) => {
      moduliere(c, n, fbm(n, 51, [8, 30]), 0.1)
      c.fillStyle = 'rgba(50,48,45,0.8)'
      for (let i = 0; i < 2; i++) {
        c.fillRect((i * n) / 2, 0, 3, n)
        c.fillRect(0, (i * n) / 2, n, 3)
      }
      rau.fillStyle = 'rgba(255,255,255,0.7)'
      for (let i = 0; i < 2; i++) {
        rau.fillRect((i * n) / 2, 0, 3, n)
        rau.fillRect(0, (i * n) / 2, n, 3)
      }
    },
  },
  stage: {
    // Schwarz gestrichene Buehnenplatten 2 × 1 m, matt mit Abrieb.
    kachelM: 4, rauheit: 0.62, metall: 0, grund: '#151515',
    zeichnen: (c, n, rau) => {
      moduliere(c, n, fbm(n, 61, [24, 90]), 0.18)
      c.fillStyle = 'rgba(0,0,0,0.9)'
      for (let i = 0; i < 4; i++) c.fillRect(0, (i * n) / 4, n, 2)
      for (let i = 0; i < 2; i++) c.fillRect((i * n) / 2 + (i % 2) * 0, 0, 2, n)
      moduliere(rau, n, fbm(n, 62, [5, 40]), 0.35)
    },
  },
  seat: {
    kachelM: 0.5, rauheit: 0.7, metall: 0, grund: '#2a2d33',
    zeichnen: (c, n, rau) => {
      moduliere(c, n, fbm(n, 71, [32, 96]), 0.12)
      moduliere(rau, n, fbm(n, 72, [64]), 0.1)
    },
  },
  plaster: {
    // Gestrichener Putz: hell, matt, nur leichte Rollspur.
    kachelM: 3, rauheit: 0.9, metall: 0, grund: '#d8d4cc',
    zeichnen: (c, n, rau) => {
      moduliere(c, n, fbm(n, 91, [6, 20, 80]), 0.05)
      moduliere(rau, n, fbm(n, 92, [40]), 0.06)
    },
  },
  brick: {
    // Normalformat 24 × 7,1 cm mit 1 cm Fuge, Laeuferverband.
    kachelM: 1.0, rauheit: 0.85, metall: 0, grund: '#8e4b36',
    zeichnen: (c, n, rau) => {
      const r = zufall(101)
      const reihen = 12
      const h = n / reihen
      const steine = 4
      const b = n / steine
      for (let i = 0; i < reihen; i++) {
        const versatz = i % 2 ? b / 2 : 0
        for (let j = -1; j < steine; j++) {
          const ton = 0.8 + r() * 0.35
          c.fillStyle = `rgb(${Math.round(142 * ton)},${Math.round(75 * ton)},${Math.round(54 * ton)})`
          c.fillRect(j * b + versatz, i * h, b, h)
        }
      }
      moduliere(c, n, fbm(n, 102, [16, 64]), 0.15)
      c.fillStyle = '#bdb6aa'
      rau.fillStyle = 'rgba(255,255,255,0.9)'
      for (let i = 0; i < reihen; i++) {
        c.fillRect(0, i * h, n, 3)
        rau.fillRect(0, i * h, n, 3)
        const versatz = i % 2 ? b / 2 : 0
        for (let j = 0; j <= steine; j++) {
          c.fillRect(j * b + versatz, i * h, 3, h)
          rau.fillRect(j * b + versatz, i * h, 3, h)
        }
      }
    },
  },
  drape: {
    // Schwarzer Molton in senkrechten Falten, schluckt Licht.
    kachelM: 2, rauheit: 1, metall: 0, grund: '#121212',
    zeichnen: (c, n) => {
      const bild = c.getImageData(0, 0, n, n)
      const falten = 8
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const m = 1 + Math.sin((x / n) * falten * Math.PI * 2) * 0.45
          const k = (y * n + x) * 4
          bild.data[k] *= m
          bild.data[k + 1] *= m
          bild.data[k + 2] *= m
        }
      }
      c.putImageData(bild, 0, 0)
      moduliere(c, n, fbm(n, 111, [64, 128]), 0.08)
    },
  },
  riser: {
    kachelM: 3, rauheit: 0.88, metall: 0, grund: '#4a4a4c',
    zeichnen: (c, n, rau) => {
      moduliere(c, n, fbm(n, 81, [5, 14, 50]), 0.25)
      moduliere(rau, n, fbm(n, 82, [10]), 0.2)
    },
  },
}

const CACHE = new Map<OberflaechenArt, { farbe: THREE.Texture; rauheit: THREE.Texture } | null>()

function texturen(art: OberflaechenArt): { farbe: THREE.Texture; rauheit: THREE.Texture } | null {
  if (CACHE.has(art)) return CACHE.get(art) ?? null
  if (typeof document === 'undefined') {
    CACHE.set(art, null)
    return null
  }
  const n = 512
  const m = MUSTER[art]
  const leinwand = document.createElement('canvas')
  leinwand.width = leinwand.height = n
  const c = leinwand.getContext('2d', { willReadFrequently: true })
  const rauLeinwand = document.createElement('canvas')
  rauLeinwand.width = rauLeinwand.height = n
  const rau = rauLeinwand.getContext('2d', { willReadFrequently: true })
  if (!c || !rau) {
    CACHE.set(art, null)
    return null
  }
  c.fillStyle = m.grund
  c.fillRect(0, 0, n, n)
  const g = Math.round(m.rauheit * 255)
  rau.fillStyle = `rgb(${g},${g},${g})`
  rau.fillRect(0, 0, n, n)
  m.zeichnen(c, n, rau)
  const farbe = new THREE.CanvasTexture(leinwand)
  farbe.colorSpace = THREE.SRGBColorSpace
  const rauheit = new THREE.CanvasTexture(rauLeinwand)
  for (const t of [farbe, rauheit]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
  }
  const paar = { farbe, rauheit }
  CACHE.set(art, paar)
  return paar
}

export interface OberflaechenOptionen {
  /** Flaeche in Metern, fuer die Wiederholung. Ohne Angabe eine Kachel. */
  breiteM?: number
  tiefeM?: number
  /** Einfaerben (multipliziert die Textur). */
  farbe?: THREE.ColorRepresentation
}

export function oberflaechenMaterial(art: OberflaechenArt, o: OberflaechenOptionen = {}): THREE.MeshStandardMaterial {
  const m = MUSTER[art]
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: m.metall })
  const t = texturen(art)
  if (!t) {
    mat.color.set(o.farbe ?? m.grund)
    mat.roughness = m.rauheit
    return mat
  }
  const wx = (o.breiteM ?? m.kachelM) / m.kachelM
  const wy = (o.tiefeM ?? m.kachelM) / m.kachelM
  const farbe = t.farbe.clone()
  const rauheit = t.rauheit.clone()
  farbe.repeat.set(wx, wy)
  rauheit.repeat.set(wx, wy)
  farbe.needsUpdate = rauheit.needsUpdate = true
  mat.map = farbe
  mat.roughnessMap = rauheit
  if (o.farbe !== undefined) mat.color.set(o.farbe)
  return mat
}

export function oberflaechenKachel(art: OberflaechenArt): number {
  return MUSTER[art].kachelM
}
