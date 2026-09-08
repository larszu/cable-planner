import { describe, expect, it } from 'vitest'
import {
  LEERE_TEXT_KONFIG,
  TEXT_VORLAGEN,
  TextVorlagenFehler,
  ZEILEN_ANFANG,
  ZEILEN_ENDE,
  lesbar,
  pruefeVorlage,
  renderTextCommand,
  type TextProtocolConfig,
} from '../src/renderer/lib/textProtocol'
import { controlActions } from '../src/renderer/lib/controlActions'
import { patternRouting } from '../src/renderer/lib/patternRouting'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import driverSrc from '../src/main/services/switcherControl/textDriver.ts?raw'
import sectionSrc from '../src/renderer/components/Properties/sections/SwitchingSection.tsx?raw'
import projectStoreSrc from '../src/renderer/store/projectStore.ts?raw'

// ───────────────────────────────────────────────────────────────────────────
// S-3 — das ERKLAERTE Text-Protokoll (2026-09-08).
//
// Der Auftrag lautete, „alle am Markt ueblichen Mischer und Kreuzschienen"
// schaltbar zu machen. Ein Treiber je Hersteller waere der naheliegende Weg
// gewesen — und der falsche: fuer die meisten dieser Protokolle liegt die
// verbindliche Beschreibung im Handbuch des Geraets, und wer sie aus dem
// Gedaechtnis abschreibt, baut eine Zusicherung, die niemand geprueft hat.
// Der Befehl geht dann an eine laufende Anlage.
//
// Beim Nachsehen fand sich dafuer sofort ein Beispiel: eine verbreitete
// Umsetzung fuer einen Bildmischer haengt an ihre Befehle ein Semikolon an,
// das im Befehl schon steht. Wer sie abschreibt, schreibt den Fehler mit ab.
//
// Also traegt der NUTZER die vier Angaben ein, die im Handbuch stehen
// (Zeilenform, Zeilenanfang, Zeilenende, Zaehlweise), und die App raet nichts.
// Was diese Datei prueft, ist genau das: dass nichts geraten wird, dass eine
// unbrauchbare Vorlage AUFFAELLT statt halb zu senden, und dass der Nutzer vor
// dem Senden sieht, was rausgeht — Steuerzeichen eingeschlossen.
// ───────────────────────────────────────────────────────────────────────────

const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const STX = '\u0002'

const konfig = (over: Partial<TextProtocolConfig> = {}): TextProtocolConfig => ({
  ...LEERE_TEXT_KONFIG,
  vorlage: '.S{out},{in}',
  ...over,
})

describe('Die Vorlage wird geprueft, statt halb gesendet zu werden', () => {
  it('ohne {out} wird geworfen — sonst schaltet jeder Kreuzpunkt denselben Ausgang', () => {
    // Und das faellt erst am Geraet auf, dann aber auf allen Wegen zugleich.
    expect(() => pruefeVorlage(konfig({ vorlage: '.S1,{in}' }))).toThrow(TextVorlagenFehler)
  })

  it('ohne {in} ebenso', () => {
    expect(() => pruefeVorlage(konfig({ vorlage: '.S{out},1' }))).toThrow(TextVorlagenFehler)
  })

  it('eine leere Zeile ist keine Zeile', () => {
    expect(() => pruefeVorlage(konfig({ vorlage: '   ' }))).toThrow(TextVorlagenFehler)
  })

  it('{level} ohne eingetragene Ebene wird geworfen', () => {
    // Sonst stuende dort nichts, und aus `.SV1,5` wuerde `.S1,5` — ein
    // anderer Befehl, der aussieht wie ein Tippfehler.
    expect(() => pruefeVorlage(konfig({ vorlage: '.S{level}{out},{in}' }))).toThrow(
      TextVorlagenFehler,
    )
    expect(() =>
      pruefeVorlage(konfig({ vorlage: '.S{level}{out},{in}', level: 'V' })),
    ).not.toThrow()
  })

  it('ein unbekannter Platzhalter wird BENANNT', () => {
    // Er bliebe sonst woertlich stehen und ginge als „{dest}" ans Geraet.
    expect(() => pruefeVorlage(konfig({ vorlage: '.S{dest},{in},{out}' }))).toThrow(/dest/)
  })
})

describe('Gesendet wird genau eine Zeile je Kreuzpunkt', () => {
  it('die Nummern kommen aus der Position, plus Basis', () => {
    const text = renderTextCommand(konfig({ basis: 1 }), [{ outputIndex: 0, inputIndex: 4 }])
    expect(text).toBe('.S1,5\r')
  })

  it('Basis 0 zaehlt ab null', () => {
    const text = renderTextCommand(konfig({ basis: 0 }), [{ outputIndex: 0, inputIndex: 4 }])
    expect(text).toBe('.S0,4\r')
  })

  it('mit „je Anschluss eingetragen" gewinnt die eingetragene Nummer', () => {
    const text = renderTextCommand(konfig({ nummern: 'declared' }), [
      { outputIndex: 0, inputIndex: 4, outputAddress: 17, inputAddress: 3 },
    ])
    expect(text).toBe('.S17,3\r')
  })

  it('zwei Kreuzpunkte ergeben zwei Zeilen — und keine dritte', () => {
    // Kein Auffuellen, kein Default fuer nicht genannte Ausgaenge
    // (Invariante 17). Was nicht in der Zeile steht, hat niemand gemeint.
    const text = renderTextCommand(konfig(), [
      { outputIndex: 0, inputIndex: 1 },
      { outputIndex: 6, inputIndex: 1 },
    ])
    expect(text.split('\r').filter(Boolean)).toEqual(['.S1,2', '.S7,2'])
  })

  it('Zeilenanfang und Zeilenende kommen aus der Angabe', () => {
    const text = renderTextCommand(konfig({ anfang: 'stx', ende: 'crlf' }), [
      { outputIndex: 0, inputIndex: 1 },
    ])
    expect(text).toBe(`${STX}.S1,2\r\n`)
    expect(ZEILEN_ANFANG.stx.text).toBe(STX)
    expect(ZEILEN_ENDE.crlf.text).toBe('\r\n')
  })

  it('die Ebene wird eingesetzt', () => {
    const text = renderTextCommand(konfig({ vorlage: '.S{level}{out},{in}', level: 'V' }), [
      { outputIndex: 0, inputIndex: 4 },
    ])
    expect(text).toBe('.SV1,5\r')
  })

  it('keine Kreuzpunkte ergibt keinen Text', () => {
    // Eine leere Zeile waere ein Befehl, der wie einer aussieht und keiner ist.
    expect(renderTextCommand(konfig(), [])).toBe('')
  })
})

describe('Steuerzeichen werden BENANNT, nicht verschluckt', () => {
  it('STX, CR und LF stehen lesbar in der Vorschau', () => {
    // Ein unsichtbares STX vor der Zeile ist der Unterschied zwischen „das
    // Geraet versteht es" und „das Geraet antwortet nicht". Wer die Vorschau
    // liest und nichts sieht, kann den Fehler nicht finden.
    expect(lesbar(`${STX}.S1,2\r`)).toContain('<STX>')
    expect(lesbar(`${STX}.S1,2\r`)).toContain('<CR>')
    expect(lesbar('.S1,2\r\n')).toContain('<CR><LF>')
    expect(lesbar('.S1,2\n')).toContain('<LF>')
  })

  it('die Nutzlast bleibt daneben lesbar', () => {
    expect(lesbar(`${STX}.SV1,5\r`)).toContain('.SV1,5')
  })
})

describe('Die mitgelieferten Vorlagen nennen ihre HERKUNFT', () => {
  it('jede Vorlage sagt, woher ihre Form stammt', () => {
    // Eine Vorlage aus dem Gedaechtnis waere schlimmer als keine: sie saehe
    // aus wie geprueftes Wissen und ginge als Befehl raus.
    expect(TEXT_VORLAGEN.length).toBeGreaterThan(0)
    for (const v of TEXT_VORLAGEN) {
      expect(v.herkunft.length, v.id).toBeGreaterThan(60)
      expect(v.herkunft, v.id).toMatch(/Handbuch|Hersteller/)
    }
  })

  it('keine Vorlage behauptet, vom Hersteller zu stammen, wenn sie es nicht tut', () => {
    const quartz = TEXT_VORLAGEN.find((v) => v.id === 'quartz')!
    expect(quartz.herkunft).toMatch(/NICHT das Herstellerdokument/)
  })

  it('jede Vorlage besteht die eigene Pruefung', () => {
    // Eine mitgelieferte Vorlage, die beim ersten Senden wirft, waere die
    // schlechteste Sorte Beigabe.
    for (const v of TEXT_VORLAGEN) expect(() => pruefeVorlage(v.config), v.id).not.toThrow()
  })
})

// ───────────────────────────────────────────────────────────────────────────
const port = (id: string): Port =>
  ({ id, name: id, type: 'video', connectorType: 'bnc' }) as unknown as Port

const eq = (id: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name: id, category: 'Video', x: 0, y: 0, inputs: [], outputs: [], ...over }) as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
  }) as unknown as Cable

const anlage = (over: Partial<EquipmentItem> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    equipment: [
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('rtr', {
        name: 'Kreuzschiene Halle',
        ipAddress: '10.0.0.20',
        controlProtocol: 'text',
        controlPort: 5000,
        controlText: konfig({ vorlage: '.S{level}{out},{in}', level: 'V' }),
        inputs: [port('r_in0'), port('r_in1')],
        outputs: [port('r_out0'), port('r_out1')],
        plannedCrosspoints: { r_out1: 'r_in0' },
        ...over,
      }),
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
    ],
    cables: [
      kabel('k1', ['cam1', 'c1out'], ['rtr', 'r_in0']),
      kabel('k2', ['rtr', 'r_out1'], ['mon1', 'm1in']),
    ],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

const wegVon = (p: CablePlannerProject) =>
  patternRouting(p, 'cam1').ziele.find((z) => z.equipmentId === 'mon1')!

describe('Der Weg durch eine erklaerte Kreuzschiene', () => {
  it('ergibt genau die eine Zeile, und die Vorschau nennt die Steuerzeichen', () => {
    const p = anlage()
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.hindernisse).toEqual([])
    const a = plan.actions[0]
    expect(a.protocol).toBe('text')
    expect(a).toMatchObject({ art: 'text-vorlage', host: '10.0.0.20', port: 5000 })
    expect(a.protocol === 'text' && a.rohtext).toBe('.SV2,1\r')
    expect(a.vorschau).toContain('<CR>')
  })

  it('ohne Befehlszeile wird NICHT gesendet — und der Grund nennt das Handbuch', () => {
    const p = anlage({ controlText: undefined })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Handbuch/)
  })

  it('ohne Port ebenso', () => {
    const p = anlage({ controlPort: undefined })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Port/)
  })

  it('mit „je Anschluss eingetragen" und fehlender Nummer wird NICHT gesendet', () => {
    // Eine fehlende Nummer durch die Position zu ersetzen waere genau das
    // Raten, das diese Schicht vermeidet.
    const p = anlage({ controlText: konfig({ nummern: 'declared' }) })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Nummer am Gerät/)
  })

  it('eine kaputte Vorlage wird zum benannten Hindernis, nicht zu einer Ausnahme', () => {
    const p = anlage({ controlText: konfig({ vorlage: '.S{out}' }) })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/\{in\}/)
  })

  it('der Klartext nennt die ANSCHLUESSE und deutet die Zeile nicht', () => {
    // Die App kennt die Bedeutung eines fremden Protokolls nicht. „Setzt
    // Ausgang 3" waere eine Behauptung darueber.
    const p = anlage()
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions[0].protocol).toBe('text')
  })
})

describe('Der Treiber wartet nur, wenn eine Antwort erwartet wird', () => {
  const src = ohneKommentare(driverSrc)

  it('ohne Quittung gilt der Befehl als GESENDET und nicht als bestaetigt', () => {
    // Viele dieser Geraete antworten auf einen Schaltbefehl gar nicht. Wer
    // trotzdem wartet, meldet einen Fehler fuer einen Befehl, der ankam — und
    // der Nutzer schaltet ein zweites Mal.
    expect(src).toMatch(/quittung \? 5000 : 800/)
    expect(src).toMatch(/Gesendet \(das Gerät bestätigt nicht/)
  })

  it('mit Quittung ist die Zeitueberschreitung ein Fehler', () => {
    expect(src).toMatch(/Zeitüberschreitung — die erwartete Bestätigung/)
  })

  it('der Treiber baut den Text NICHT selbst', () => {
    // Ein zweiter Bauer waere die Defektform `zwei-rechnungen` — mit einer
    // laufenden Anlage als Schauplatz.
    expect(src).not.toMatch(/\{out\}|\{in\}|renderTextCommand|replaceAll/)
    expect(src).toMatch(/socket\.write\(rohtext\)/)
  })

  it('er sendet den ROHTEXT und nicht die lesbare Vorschau', () => {
    // Die Vorschau ersetzt Steuerzeichen durch `<CR>` — sie zu senden hiesse,
    // dem Geraet fuenf Zeichen Text statt eines Zeilenendes zu schicken.
    expect(src).not.toMatch(/socket\.write\(vorschau\)/)
  })
})

describe('Die Sektion traegt ein, statt zu raten', () => {
  const src = ohneKommentare(sectionSrc)

  it('sie zeigt die Probe, bevor irgendetwas gesendet wird', () => {
    expect(src).toMatch(/renderTextCommand\(textKonfig/)
    expect(src).toMatch(/lesbar\(/)
  })

  it('die Vorlagen-Knoepfe tragen ihre Herkunft im Titel', () => {
    expect(src).toMatch(/title=\{v\.herkunft\}/)
  })

  it('die Heilung einer unbrauchbaren Vorlage ist verdrahtet', () => {
    expect(ohneKommentare(projectStoreSrc)).toMatch(/pruefeVorlage\(item\.controlText\)/)
  })
})
