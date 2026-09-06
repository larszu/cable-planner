import { describe, expect, it } from 'vitest'
import {
  HEADROOM_FRACTION,
  needsPortForward,
  srtLatencyAdvice,
  uplinkBudget,
} from '../src/renderer/lib/transportParams'

// ---------------------------------------------------------------------------
// Der Transport-Rechner (Bedarf 34, P1).
//
// Der Bedarf verlangt ausdruecklich Formel UND Fundstelle neben jeder Zahl,
// weil „an unattributed value would be worse than none". Und er nennt den
// Grund, warum das hier nicht Zierrat ist: die Quellen widersprechen sich.
// Fuer die SRT-Latenz nennt die eine das Drei- bis Vierfache der gemessenen
// Rundlaufzeit, die andere feste 1.500-2.500 ms. Auf kurzen Strecken liegen
// die beiden um Groessenordnungen auseinander.
//
// Geprueft wird deshalb nicht nur die Arithmetik, sondern die Ehrlichkeit:
// dass beide Lesarten zurueckkommen, dass jede ihre Quelle traegt, und dass
// der Widerspruch benannt wird, wo er wirklich einer ist -- und nur dort.
// ---------------------------------------------------------------------------

describe('SRT-Latenz', () => {
  it('gibt ohne gemessene RTT nur die feste Lesart, statt eine RTT zu erfinden', () => {
    const a = srtLatencyAdvice()
    expect(a.fromRtt).toBeUndefined()
    expect(a.fixed.low.value).toBe(1500)
    expect(a.fixed.high.value).toBe(2500)
  })

  it('rechnet aus gemessener RTT das Vierfache und nennt die Spanne', () => {
    const a = srtLatencyAdvice(40)
    expect(a.fromRtt?.value).toBe(160)
    expect(a.fromRtt?.formula).toContain('120-160 ms')
  })

  it('haengt an jede Zahl eine Fundstelle', () => {
    const a = srtLatencyAdvice(40)
    for (const v of [a.fromRtt!, a.fixed.low, a.fixed.high]) {
      expect(v.source.length).toBeGreaterThan(10)
      expect(v.formula.length).toBeGreaterThan(0)
    }
  })

  it('benennt den Widerspruch auf einer kurzen Strecke', () => {
    // 20 ms RTT: 80 ms gegen 1.500 ms. Wer sich hier still fuer eine Quelle
    // entscheidet, behauptet eine Gewissheit, die es nicht gibt.
    const a = srtLatencyAdvice(20)
    expect(a.disagreement).toBeDefined()
    expect(a.disagreement).toContain('80')
    expect(a.disagreement).toContain('1500')
  })

  it('schweigt, wo die Lesarten beieinander liegen', () => {
    // 400 ms RTT (Satellit/Mobilfunk): 1.600 ms gegen 1.500 ms -- dieselbe
    // Groessenordnung. Eine Warnung, die immer leuchtet, sagt nichts.
    expect(srtLatencyAdvice(400).disagreement).toBeUndefined()
  })

  it('nimmt Unsinn als „nicht gemessen", statt damit zu rechnen', () => {
    for (const rtt of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(srtLatencyAdvice(rtt).fromRtt, `RTT ${rtt}`).toBeUndefined()
    }
  })
})

describe('Uplink-Kopfraum', () => {
  it('rechnet das Beispiel der Quelle nach: 10 Mbit/s traegt 6 Mbit/s', () => {
    // „a 10 Mbit line should carry no more than 6 Mbit of encoding"
    // (contentflow.live). Wenn diese Zeile faellt, ist die Regel falsch
    // umgesetzt -- egal was die Prozentzahl sagt.
    expect(uplinkBudget(10, 0).usable.value).toBe(6000)
    expect(HEADROOM_FRACTION).toBe(0.4)
  })

  it('meldet, wenn der Plan drueberliegt, und um wie viel', () => {
    const b = uplinkBudget(10, 8000)
    expect(b.fits).toBe(false)
    expect(b.overKbps).toBe(2000)
  })

  it('meldet nichts, wenn es passt', () => {
    const b = uplinkBudget(10, 6000)
    expect(b.fits).toBe(true)
    expect(b.overKbps).toBe(0)
  })

  it('traegt die Rechnung im Klartext mit', () => {
    expect(uplinkBudget(10, 0).usable.formula).toBe('10 Mbit/s - 40 % Kopfraum = 6000 kbit/s')
  })
})

describe('Portfreigabe', () => {
  it('nur der Listener braucht eine', () => {
    // Firewall-Entscheidung, keine Video-Entscheidung.
    expect(needsPortForward('listener')).toBe(true)
    expect(needsPortForward('caller')).toBe(false)
    expect(needsPortForward('rendezvous')).toBe(false)
  })
})
