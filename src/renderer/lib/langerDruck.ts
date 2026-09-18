// ───────────────────────────────────────────────────────────────────────────
// LANGE BERUEHRUNG STATT RECHTSKLICK (#877)
//
// „Pinch-Zoom, Zwei-Finger-Pan, lange Beruehrung statt Rechtsklick."
//
// Die ersten beiden gibt es seit B-66 (die Kneif-Geste gehoert dem Plan, nicht
// dem Browser). Die dritte fehlte: das Kontextmenue haengt an
// `onNodeContextMenu`, und das liefert ReactFlow nur bei einem Rechtsklick.
// Ein iPad hat keine rechte Taste — „Position sperren" war dort schlicht
// nicht erreichbar.
//
// ─── WARUM EIN EIGENES MODUL UND NICHT DREI ZEILEN IN DER KOMPONENTE ──────
//
// Weil die Geste aus einer KETTE besteht und ihre Fehler genau dort sitzen,
// wo man beim Lesen nichts sieht: der Finger, der sich waehrend des Wartens
// zwei Pixel bewegt (das ist keine Bewegung, das ist eine Hand); der, der
// sich zwanzig bewegt (das ist ein Zug, und ein Kontextmenue mitten im Zug
// ist ein Abbruch); der zweite Finger, der dazukommt (dann kneift jemand,
// und das Menue waere im Weg); das `pointercancel`, das der Browser schickt,
// wenn er die Geste selbst uebernimmt.
//
// Diese Datei kennt kein DOM und kein React. Sie bekommt Ereignisse und sagt,
// ob eine lange Beruehrung zustande kam. `langerDruck.test.ts` fuehrt die
// Ketten durch.
//
// ─── DIE ZAHLEN, UND WOHER SIE KOMMEN ─────────────────────────────────────
//
// 500 ms und 10 px sind die Werte, die iOS und Android fuer ihr eigenes
// „touch and hold" benutzen. Sie hier anders zu waehlen hiesse, dass sich
// dieselbe Geste im Plan anders anfuehlt als ueberall sonst auf dem Geraet —
// und der Nutzer haelt nicht die App fuer eigen, sondern sich fuer ungeschickt.
// ───────────────────────────────────────────────────────────────────────────

/** Wie lange ein Finger liegen muss. */
export const DRUCK_MS = 500

/** Wie weit er sich dabei bewegen darf, in Pixeln. */
export const DRUCK_SCHLUPF_PX = 10

export interface DruckPunkt {
  zeigerId: number
  x: number
  y: number
  /** `mouse`, `pen`, `touch` — die Maus hat ihre rechte Taste und braucht das hier nicht. */
  art: string
}

export type DruckAntwort =
  | { art: 'warten' }
  | { art: 'abbrechen' }
  | { art: 'ausloesen'; x: number; y: number }

/**
 * Der Zustand einer laufenden Beruehrung.
 *
 * Eine Instanz je Flaeche. Die Uhr steckt NICHT darin: `pruefe(jetztMs)`
 * bekommt die Zeit von aussen, damit ein Test die Geste durchspielen kann,
 * ohne eine halbe Sekunde zu warten. Zeitabhaengige Tests sind der
 * zuverlaessigste Weg, eine CI unglaubwuerdig zu machen.
 */
export class LangerDruck {
  private start: (DruckPunkt & { beginnMs: number }) | null = null
  private finger = 0

  /** Liegt gerade eine Beruehrung, auf die gewartet wird? */
  get laeuft(): boolean {
    return this.start !== null
  }

  runter(p: DruckPunkt, jetztMs: number): DruckAntwort {
    this.finger += 1
    // Ein zweiter Finger heisst: hier wird gekniffen oder geschoben. Das
    // Menue waere dabei im Weg, und zwar genau an der Stelle, an der der
    // Nutzer gerade etwas anderes tut.
    if (this.finger > 1) {
      this.start = null
      return { art: 'abbrechen' }
    }
    // Die Maus bleibt aussen vor: sie hat ihre rechte Taste, und ein
    // Kontextmenue nach einer halben Sekunde Stillhalten waere am Schreibtisch
    // eine Ueberraschung und kein Griff.
    if (p.art === 'mouse') {
      this.start = null
      return { art: 'abbrechen' }
    }
    this.start = { ...p, beginnMs: jetztMs }
    return { art: 'warten' }
  }

  bewegt(p: DruckPunkt): DruckAntwort {
    if (!this.start || p.zeigerId !== this.start.zeigerId) return { art: 'warten' }
    const weit = Math.hypot(p.x - this.start.x, p.y - this.start.y)
    if (weit <= DRUCK_SCHLUPF_PX) return { art: 'warten' }
    // Weiter als der Schlupf: das ist ein Zug, kein Halten. Ein Kontextmenue
    // mitten im Zug ist ein Abbruch dessen, was der Nutzer wollte.
    this.start = null
    return { art: 'abbrechen' }
  }

  /** Der Finger geht hoch — oder der Browser bricht ab (`pointercancel`). */
  hoch(zeigerId?: number): DruckAntwort {
    this.finger = Math.max(0, this.finger - 1)
    if (this.start && (zeigerId === undefined || zeigerId === this.start.zeigerId)) {
      this.start = null
    }
    return { art: 'abbrechen' }
  }

  /**
   * Ist die Zeit um?
   *
   * Wird vom Zeitgeber der Komponente gerufen. Loest die Geste aus, wenn der
   * Finger lange genug lag — und raeumt sich dabei selbst ab, damit dieselbe
   * Beruehrung das Menue nicht zweimal oeffnet.
   */
  pruefe(jetztMs: number): DruckAntwort {
    if (!this.start) return { art: 'abbrechen' }
    if (jetztMs - this.start.beginnMs < DRUCK_MS) return { art: 'warten' }
    const { x, y } = this.start
    this.start = null
    return { art: 'ausloesen', x, y }
  }

  /** Alles vergessen — etwa beim Verlassen der Flaeche. */
  leeren(): void {
    this.start = null
    this.finger = 0
  }
}
