import { describe, expect, it } from 'vitest'
import {
  COMPANION_API,
  COMPANION_SCHNITTSTELLE_HINWEIS,
  companionAbfrage,
  companionAsBuilt,
  leseCompanionStand,
  leseCompanionZeile,
} from '../src/renderer/lib/companionVariablen'
import { asBuiltVerdict } from '../src/renderer/lib/asBuilt'

/**
 * Der Companion-Variablenstand als zweite Quelle (E-23).
 *
 * Die Gegenproben stehen bei ihrem jeweiligen Satz, nicht gesammelt am Ende —
 * wer eine Zusicherung ändert, soll die Probe daneben sehen und nicht suchen
 * müssen.
 */

const JETZT = '2026-09-09T14:22:07.000Z'

describe('companionAbfrage', () => {
  it('schreibt die Befehlszeile so, wie die Route sie deklariert — klein', () => {
    expect(companionAbfrage(['videohub_out'])).toEqual([
      'custom-variable videohub_out get-value',
    ])
  })

  it('wirft doppelte und leere Namen weg', () => {
    // Ein doppelter Name braechte zwei Antwortzeilen fuer einen Eintrag und
    // verschoebe damit die Zuordnung um eins — genau der Fehler, den
    // `leseCompanionStand` unten verweigert.
    expect(companionAbfrage(['a', ' a ', '', '  ', 'b'])).toEqual([
      'custom-variable a get-value',
      'custom-variable b get-value',
    ])
  })
})

describe('leseCompanionZeile', () => {
  it('packt den Wert aus, den Companion als JSON zurueckgibt', () => {
    expect(leseCompanionZeile('+OK "12"')).toEqual({ roh: '+OK "12"', wert: '12' })
    expect(leseCompanionZeile('+OK 7')).toEqual({ roh: '+OK 7', wert: '7' })
  })

  it('behaelt die Rohform, wenn die Antwort kein lesbares JSON ist', () => {
    // Raten wird nichts: eine unlesbare Antwort ist eine unlesbare Antwort.
    const a = leseCompanionZeile('+OK nicht{json')
    expect(a?.wert).toBe('nicht{json')
  })

  it('macht aus einem nackten +OK KEINEN leeren Wert', () => {
    // Companion haengt den Wert nur an, wenn der Handler einen zurueckgibt.
    // Ein `+OK` allein kommt von `press`/`style` — wer es als leeren
    // Variablenwert laese, machte aus einem Tastendruck eine Ablesung.
    const a = leseCompanionZeile('+OK')
    expect(a).toEqual({ roh: '+OK' })
    expect(a?.wert).toBeUndefined()
  })

  it('liest den Fehler als Fehler und nicht als Wert', () => {
    expect(leseCompanionZeile('-ERR Variable not found')).toEqual({
      roh: '-ERR Variable not found',
      fehler: 'Variable not found',
    })
  })

  it('ueberspringt, was keine Antwortzeile ist', () => {
    // Der getippte Befehl steht in einer kopierten Sitzung mit drin.
    expect(leseCompanionZeile('custom-variable a get-value')).toBeUndefined()
    expect(leseCompanionZeile('')).toBeUndefined()
  })
})

describe('leseCompanionStand — die Engstelle', () => {
  it('ordnet der Reihe nach zu, wenn die Anzahl stimmt', () => {
    const { ablesungen, problem } = leseCompanionStand(
      'custom-variable out get-value\n+OK "3"\ncustom-variable in get-value\n+OK "5"',
      ['out', 'in'],
      JETZT,
    )
    expect(problem).toBeUndefined()
    expect(ablesungen.map((a) => [a.variable, a.antwort.wert])).toEqual([
      ['out', '3'],
      ['in', '5'],
    ])
  })

  it('liefert NICHTS, wenn eine Antwortzeile fehlt', () => {
    // DIE Gegenprobe dieses Bausteins. Ohne sie stuende der Wert der einen
    // Variablen unter dem Namen der naechsten: vollstaendig aussehend,
    // plausibel und falsch — und er ginge als Ablesung in ein As-built-Blatt,
    // aus dem spaeter jemand einen Kreuzpunkt liest.
    const { ablesungen, problem } = leseCompanionStand('+OK "3"', ['out', 'in'], JETZT)
    expect(ablesungen).toEqual([])
    expect(problem).toMatch(/2 Variable\(n\) abgefragt, 1 Antwortzeile/)
  })

  it('liefert auch bei einer Antwortzeile ZU VIEL nichts', () => {
    const { ablesungen } = leseCompanionStand('+OK "3"\n+OK "5"\n+OK "9"', ['out', 'in'], JETZT)
    expect(ablesungen).toEqual([])
  })

  it('nennt den Grund, wenn gar keine Antwortzeile erkennbar ist', () => {
    const { problem } = leseCompanionStand('irgendein Text', ['out'], JETZT)
    expect(problem).toMatch(/Keine Antwortzeile erkannt/)
  })

  it('nennt den Grund, wenn der Plan keine Variablen kennt', () => {
    const { problem } = leseCompanionStand('+OK "3"', [], JETZT)
    expect(problem).toMatch(/Keine Variablennamen im Plan/)
  })
})

describe('companionAsBuilt', () => {
  const stand = (text: string, namen: string[]) =>
    leseCompanionStand(text, namen, JETZT).ablesungen

  it('vergleicht die Ablesung gegen den Plan', () => {
    const [zeile] = companionAsBuilt(stand('+OK "3"', ['out']), { out: '3' })
    expect(zeile.source).toBe('companion')
    expect(zeile.at).toBe(JETZT)
    expect(asBuiltVerdict(zeile)).toBe('match')
  })

  it('meldet eine Abweichung als Abweichung', () => {
    const [zeile] = companionAsBuilt(stand('+OK "9"', ['out']), { out: '3' })
    expect(asBuiltVerdict(zeile)).toBe('differs')
  })

  it('macht aus „Variable not found" KEINE Ablesung', () => {
    // „nicht gefunden" heisst nicht „der Wert ist leer", sondern „es wurde
    // nichts abgelesen". Das Urteil dafuer ist `missing` und nicht `differs`:
    // sonst stuende auf dem Blatt eine Abweichung, die niemand gemessen hat.
    const [zeile] = companionAsBuilt(stand('-ERR Variable not found', ['out']), { out: '3' })
    expect(zeile.actual).toBeUndefined()
    expect(zeile.subject).toContain('Variable not found')
    expect(asBuiltVerdict(zeile)).toBe('missing')
  })

  it('ohne Plan-Seite: vorgefunden, nicht im Plan', () => {
    const [zeile] = companionAsBuilt(stand('+OK "3"', ['out']))
    expect(asBuiltVerdict(zeile)).toBe('unexpected')
  })
})

describe('die nachgesehenen Angaben stehen im Hinweis', () => {
  it('nennt beide Ports und trennt Schalt- von Lese-Weg', () => {
    // Die Auflage aus E-23 lautete „deren Schnittstelle ist opt-in". Gemessen
    // gilt das fuer den LESE-Weg (TCP, ab Werk aus) und NICHT fuer den
    // SCHALT-Weg (HTTP, ab Werk an) — und eine hochgezogene Installation hat
    // TCP an, nur auf einem anderen Port. Wer den Satz auf „ist aus"
    // zurueckkuerzt, schickt jemanden an den falschen Schalter.
    expect(COMPANION_SCHNITTSTELLE_HINWEIS).toContain(String(COMPANION_API.tcpPortNeu))
    expect(COMPANION_SCHNITTSTELLE_HINWEIS).toContain(String(COMPANION_API.tcpPortAlt))
    expect(COMPANION_SCHNITTSTELLE_HINWEIS).toMatch(/HTTP-API \(ab Werk an\)/)
  })

  it('die beiden Ports sind verschieden', () => {
    expect(COMPANION_API.tcpPortNeu).not.toBe(COMPANION_API.tcpPortAlt)
  })
})
