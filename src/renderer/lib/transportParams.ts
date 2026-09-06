// ───────────────────────────────────────────────────────────────────────────
// Transport-Rechner fuer die Ausspielung (Bedarf 34, P1).
//
// Der Bedarf ist woertlich: „A transport parameter calculator that shows its
// formula and source (SRT latency from measured RTT, bandwidth overhead,
// bitrate-vs-uplink headroom)". Und der Grund, warum er P1 ist, steht daneben:
//
//   > The numbers are re-derived per venue, per link, per show from
//   > documentation that disagrees with itself, and are never written down
//   > where the next engineer can find them.
//
// DIE QUELLEN WIDERSPRECHEN SICH — UND DAS IST DAS ERGEBNIS, NICHT EIN
// PROBLEM DER DARSTELLUNG. Fuer die SRT-Latenz nennt die eine Quelle das
// Drei- bis Vierfache der gemessenen Rundlaufzeit, die andere einen festen
// Wert zwischen 1.500 und 2.500 ms; bei kurzen Strecken liegen die beiden
// weit auseinander (bei 20 ms RTT: 60-80 ms gegen 1.500 ms — Faktor 20).
// Ein Rechner, der sich fuer eine der beiden entscheidet, verschweigt die
// Uneinigkeit und behauptet eine Gewissheit, die es nicht gibt. Dieser hier
// gibt BEIDE Lesarten zurueck, jede mit Formel und Fundstelle, und benennt
// die Abweichung, sobald sie gross ist.
//
// Die Bedarfs-Datenbank formuliert dieselbe Regel als Bauanweisung: „always
// display the formula and its citation next to the number, because an
// unattributed value would be worse than none."
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

/** Ein gerechneter Wert mitsamt seiner Herleitung. */
export interface DerivedValue {
  /** Der Wert selbst, in der Einheit, die `unit` nennt. */
  value: number
  unit: 'ms' | 'kbps' | 'Mbps' | '%'
  /** Die Rechnung im Klartext, mit eingesetzten Zahlen. */
  formula: string
  /** Die Fundstelle. Ohne sie gibt es den Wert nicht. */
  source: string
}

export interface SrtLatencyAdvice {
  /** Lesart A: Vielfaches der gemessenen Rundlaufzeit. */
  fromRtt?: DerivedValue
  /** Lesart B: fester Bereich aus der Praxis-Literatur. */
  fixed: { low: DerivedValue; high: DerivedValue }
  /**
   * Steht nur da, wenn die beiden Lesarten wirklich weit auseinanderliegen —
   * sonst waere es eine Warnung, die immer leuchtet und deshalb nichts sagt.
   */
  disagreement?: string
}

/** Ab welchem Verhaeltnis die beiden Lesarten als uneinig gelten. Faktor 3
 *  ist die Schwelle, ab der die Wahl der Quelle die Latenz-Groessenordnung
 *  bestimmt und nicht mehr nur den Feinabgleich. */
const DISAGREEMENT_RATIO = 3

const RTT_SOURCE = 'vajracast.com/srt-latency-tuning/ (3-4x RTT)'
const FIXED_SOURCE =
  'Praxis-Leitfaeden, fester Wert 1.500-2.500 ms; siehe medium.com/innovation-labs-blog/examining-srt-streaming-over-4g-networks-925e71c45cdf'

/**
 * SRT-Latenz-Empfehlung. `measuredRttMs` ist optional, weil sie oft nicht
 * gemessen ist — dann bleibt nur die feste Lesart, und das steht dann auch so
 * da, statt eine RTT zu erfinden.
 */
export function srtLatencyAdvice(measuredRttMs?: number): SrtLatencyAdvice {
  const fixed = {
    low: {
      value: 1500,
      unit: 'ms' as const,
      formula: 'fester Praxiswert, untere Grenze',
      source: FIXED_SOURCE,
    },
    high: {
      value: 2500,
      unit: 'ms' as const,
      formula: 'fester Praxiswert, obere Grenze',
      source: FIXED_SOURCE,
    },
  }

  if (measuredRttMs === undefined || !Number.isFinite(measuredRttMs) || measuredRttMs <= 0) {
    return { fixed }
  }

  // Die obere Kante der genannten Spanne (4x) — wer puffert, puffert nach
  // oben; die untere Kante steht in der Formel daneben.
  const fromRtt: DerivedValue = {
    value: Math.round(measuredRttMs * 4),
    unit: 'ms',
    formula: `4 x ${measuredRttMs} ms RTT (Spanne 3-4x: ${Math.round(measuredRttMs * 3)}-${Math.round(measuredRttMs * 4)} ms)`,
    source: RTT_SOURCE,
  }

  const advice: SrtLatencyAdvice = { fromRtt, fixed }
  if (fixed.low.value / fromRtt.value >= DISAGREEMENT_RATIO) {
    advice.disagreement =
      `Die beiden belegten Lesarten liegen bei ${measuredRttMs} ms RTT um Faktor ` +
      `${Math.round((fixed.low.value / fromRtt.value) * 10) / 10} auseinander ` +
      `(${fromRtt.value} ms gegen ${fixed.low.value} ms). Auf kurzen Strecken widersprechen ` +
      `sich die Quellen; die Entscheidung gehoert dem Menschen, nicht diesem Rechner.`
  }
  return advice
}

/**
 * Die 40-%-Kopfraum-Regel.
 *
 * > German guidance uses a headroom rule instead: reserve at least 40% of
 * > available bandwidth for overhead, so a 10 Mbit line should carry no more
 * > than 6 Mbit of encoding.
 *
 * Quelle: contentflow.live/wie-muss-ich-meinen-encoder-richtig-einstellen/
 */
export const HEADROOM_FRACTION = 0.4

export interface UplinkBudget {
  /** Was auf die Leitung darf, in kbit/s. */
  usable: DerivedValue
  /** Summe der geplanten Ausspielungen, in kbit/s (Video + Audio). */
  plannedKbps: number
  /** Passt es? */
  fits: boolean
  /** Wie viel darueber, in kbit/s. 0, wenn es passt. */
  overKbps: number
}

/**
 * Uplink-Budget: was auf die Leitung darf und was der Plan draufpackt.
 *
 * `plannedKbps` kommt von aussen, weil die Frage, WELCHE Ziele gleichzeitig
 * senden, eine Plan-Frage ist und keine Rechen-Frage: ein Backup-Weg, der nur
 * im Havariefall laeuft, zaehlt anders als ein Simulcast auf zwei Plattformen.
 */
export function uplinkBudget(uplinkMbps: number, plannedKbps: number): UplinkBudget {
  const uplinkKbps = uplinkMbps * 1000
  const usableKbps = Math.round(uplinkKbps * (1 - HEADROOM_FRACTION))
  const over = Math.max(0, plannedKbps - usableKbps)
  return {
    usable: {
      value: usableKbps,
      unit: 'kbps',
      formula: `${uplinkMbps} Mbit/s - ${HEADROOM_FRACTION * 100} % Kopfraum = ${usableKbps} kbit/s`,
      source: 'contentflow.live/wie-muss-ich-meinen-encoder-richtig-einstellen/',
    },
    plannedKbps,
    fits: over === 0,
    overKbps: over,
  }
}

/**
 * Braucht dieser SRT-Modus eine Portfreigabe im Haus-Netz?
 *
 * Das ist die Frage, mit der die Haus-IT angesprochen wird (Bedarf 25: „a
 * standard house-IT / venue-IT request artefact"), und sie hat eine
 * eindeutige, belegte Antwort — anders als die Latenz.
 */
export function needsPortForward(mode: 'caller' | 'listener' | 'rendezvous'): boolean {
  return mode === 'listener'
}

/** Video + Audio eines Ziels, in kbit/s. Eine Zeile, aber an drei Stellen
 *  gebraucht — und dreimal getippt heisst zweimal falsch. */
export const totalKbps = (videoKbps: number, audioKbps: number): number => videoKbps + audioKbps
