// Qualitaetsstufen der Render-Pipeline. Ein Schalter fuer den Nutzer
// (Auto/Hoch/Niedrig), alles andere leitet sich ab.
//
// Auto beginnt hoch und senkt einmal, wenn die Bildrate dauerhaft faellt.
// Zurueck nach oben geht es nicht von selbst: die Bildrate ist auf die
// Bildwiederholrate gedeckelt, Reserve laesst sich darueber nicht messen,
// und ein Hin und Her zwischen den Stufen flackert sichtbar.

export type Qualitaet = 'auto' | 'high' | 'low'
export type Stufe = 'high' | 'low'

export interface StufenWerte {
  pixelRatio: number
  /** Multisampling des HDR-Ziels. */
  msaa: number
  ao: boolean
  /** Tiefenunschaerfe im Kamerablick erlaubt. */
  dof: boolean
  schatten: boolean
  /** Raymarch-Schritte je Dunst-Lichtkegel. */
  strahlSchritte: number
  /** Echte Scheinwerfer (SpotLight) — der Rest leuchtet nur als Kegel und Lichtfleck. */
  maxSpots: number
  maxSchatten: number
}

export function stufenWerte(stufe: Stufe, devicePixelRatio = 1): StufenWerte {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  if (stufe === 'high') {
    return { pixelRatio: Math.min(dpr, 1.25), msaa: 4, ao: true, dof: true, schatten: true, strahlSchritte: 20, maxSpots: 8, maxSchatten: 2 }
  }
  return { pixelRatio: 1, msaa: 2, ao: false, dof: false, schatten: false, strahlSchritte: 10, maxSpots: 4, maxSchatten: 0 }
}

export interface AutoStufeOptionen {
  /** Unter dieser mittleren Bildrate wird gesenkt. */
  grenzeFps?: number
  /** So viele Bilder nach dem Start oder einem Szenenwechsel zaehlen nicht (Shader-Kompilieren). */
  aufwaermen?: number
  /** Fenster der gleitenden Messung in Bildern. */
  fenster?: number
}

export class AutoStufe {
  private stufeJetzt: Stufe = 'high'
  private gezaehlt = 0
  private summe = 0
  private werte: number[] = []
  private readonly grenzeMs: number
  private readonly aufwaermen: number
  private readonly fenster: number

  constructor(o: AutoStufeOptionen = {}) {
    this.grenzeMs = 1000 / (o.grenzeFps ?? 48)
    this.aufwaermen = o.aufwaermen ?? 45
    this.fenster = o.fenster ?? 90
  }

  get stufe(): Stufe {
    return this.stufeJetzt
  }

  /** Nach einem grossen Szenenwechsel: neu einschwingen lassen, Stufe bleibt. */
  neuMessen(): void {
    this.gezaehlt = 0
    this.summe = 0
    this.werte = []
  }

  /** Ein Bild ist fertig; liefert die Stufe fuer das naechste. */
  bild(dtMs: number): Stufe {
    // Verdeckter Tab oder Fenster im Hintergrund: der Browser drosselt, das
    // ist keine Aussage ueber die GPU.
    if (!(dtMs > 0) || dtMs > 250) return this.stufeJetzt
    this.gezaehlt++
    if (this.gezaehlt <= this.aufwaermen || this.stufeJetzt === 'low') return this.stufeJetzt
    this.werte.push(dtMs)
    this.summe += dtMs
    if (this.werte.length > this.fenster) this.summe -= this.werte.shift() as number
    if (this.werte.length === this.fenster && this.summe / this.fenster > this.grenzeMs) {
      this.stufeJetzt = 'low'
    }
    return this.stufeJetzt
  }
}
