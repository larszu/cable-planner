import { describe, expect, it } from 'vitest'
import {
  CompanionFehler,
  LEERE_COMPANION_KONFIG,
  companionSchritte,
  companionVorschau,
  leseVerbindungen,
  pruefeCompanion,
  type CompanionConfig,
} from '../src/renderer/lib/companionControl'
import { controlActions } from '../src/renderer/lib/controlActions'
import { patternRouting } from '../src/renderer/lib/patternRouting'
import { PROTOCOL_INFO } from '../src/renderer/types/switcherControl'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import driverSrc from '../src/main/services/switcherControl/companionDriver.ts?raw'
import indexSrc from '../src/main/services/switcherControl/index.ts?raw'
import sectionSrc from '../src/renderer/components/Properties/sections/SwitchingSection.tsx?raw'
import projectStoreSrc from '../src/renderer/store/projectStore.ts?raw'

// ───────────────────────────────────────────────────────────────────────────
// S-4 — Bitfocus Companion spricht das Protokoll (2026-09-08).
//
// Eigentuemer-Frage: „Kannst du nicht bitfocus companion integrieren dafuer?
// Oder direkt die Hersteller Protokolle?"
//
// Companion ist die richtige Antwort auf beides. Es hat rund fuenfhundert
// Hersteller-Module, jedes von Leuten gepflegt, die das Geraet auf dem Tisch
// haben; es ist MIT-lizenziert und laeuft ueberall. Die Protokolle hier
// nachzubauen waere die Zusicherung aus dem Gedaechtnis, gegen die
// Invariante 18 geschrieben ist.
//
// DIE EINE ZUSICHERUNG, um die es geht, ist die REIHENFOLGE: erst die beiden
// Custom-Variablen, dann der Druck auf die Schaltflaeche, deren Route-Aktion
// sie liest. Schlaegt eine Variable fehl, darf der Druck NICHT passieren —
// sonst feuert die Schaltflaeche mit den Werten von vorhin und schaltet den
// VORIGEN Kreuzpunkt, auf einer laufenden Anlage, und es saehe aus wie ein
// gelungener Befehl.
//
// Belegt an `bitfocus/companion@main` (nachgesehen 2026-09-08):
// `companion/lib/Service/HttpApi.ts` mountet unter `/api` genau die Routen
// `location/:page/:row/:column/press` und `custom-variable/:name/value` —
// eine Route „fuehre Aktion X mit Argumenten aus" gibt es NICHT, und daher
// kommt der Umweg ueber Variablen. `shared-lib/lib/LaunchOptions.ts` setzt
// `adminPort` auf 8000.
// ───────────────────────────────────────────────────────────────────────────

const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const konfig = (over: Partial<CompanionConfig> = {}): CompanionConfig => ({
  ...LEERE_COMPANION_KONFIG,
  varOut: 'cp_out',
  varIn: 'cp_in',
  ...over,
})

describe('Die Reihenfolge ist die Zusicherung', () => {
  it('erst beide Variablen, dann der Druck', () => {
    const s = companionSchritte(konfig(), [{ outputIndex: 2, inputIndex: 0 }])
    expect(s).toHaveLength(3)
    expect(s[0].pfad).toContain('/api/custom-variable/cp_out/value')
    expect(s[1].pfad).toContain('/api/custom-variable/cp_in/value')
    expect(s[2].pfad).toContain('/api/location/1/0/0/press')
  })

  it('jeder Schritt sagt, dass beim Fehlschlag abgebrochen wird', () => {
    // Als Datenstruktur und nicht als Ablauf im Treiber: ein Ablauf laesst
    // sich umbauen, ohne dass jemand die Folge bedenkt.
    const s = companionSchritte(konfig(), [{ outputIndex: 0, inputIndex: 1 }])
    for (const schritt of s) expect(schritt.abbruchBeiFehler).toBe(true)
  })

  it('die Werte stehen in den Variablen, nicht im Druck-Pfad', () => {
    // Ein Pfad wie `/press?out=3` gaebe es in Companion nicht — und ihn zu
    // bauen hiesse, eine Route zu erfinden.
    const s = companionSchritte(konfig({ basis: 1 }), [{ outputIndex: 2, inputIndex: 0 }])
    expect(s[0].pfad).toContain('value=3')
    expect(s[1].pfad).toContain('value=1')
    expect(s[2].pfad).not.toMatch(/value=/)
  })

  it('zwei Kreuzpunkte ergeben zwei vollstaendige Folgen', () => {
    // Nicht „zwei Variablen und ein Druck": die Schaltflaeche fuehrt EINE
    // Route aus, und zwischen den beiden muessen die Werte neu gesetzt werden.
    const s = companionSchritte(konfig(), [
      { outputIndex: 0, inputIndex: 0 },
      { outputIndex: 5, inputIndex: 1 },
    ])
    expect(s).toHaveLength(6)
    expect(s.filter((x) => x.pfad.includes('/press'))).toHaveLength(2)
    expect(s[3].pfad).toContain('value=6')
  })

  it('die Nummern folgen Basis und Herkunft', () => {
    expect(companionSchritte(konfig({ basis: 0 }), [{ outputIndex: 2, inputIndex: 0 }])[0].pfad).toContain(
      'value=2',
    )
    const declared = companionSchritte(konfig({ nummern: 'declared' }), [
      { outputIndex: 0, inputIndex: 0, outputAddress: 17, inputAddress: 4 },
    ])
    expect(declared[0].pfad).toContain('value=17')
    expect(declared[1].pfad).toContain('value=4')
  })

  it('Werte und Namen werden URL-kodiert', () => {
    const s = companionSchritte(konfig({ varOut: 'a-b_c' }), [{ outputIndex: 0, inputIndex: 0 }])
    expect(s[0].pfad).toContain('/custom-variable/a-b_c/value')
  })
})

describe('Eine unbrauchbare Angabe faellt auf, bevor etwas rausgeht', () => {
  it('ein leerer Variablenname wirft', () => {
    // Sonst entstuende `/api/custom-variable//value`, das trifft keine Route,
    // und der Nutzer saehe einen Netzfehler statt der fehlenden Angabe.
    expect(() => pruefeCompanion(konfig({ varOut: '' }))).toThrow(CompanionFehler)
    expect(() => pruefeCompanion(konfig({ varIn: '  ' }))).toThrow(CompanionFehler)
  })

  it('beide Variablen gleich wirft', () => {
    // Der zweite Wert ueberschriebe den ersten — die Schaltflaeche bekaeme
    // zweimal denselben.
    expect(() => pruefeCompanion(konfig({ varOut: 'x', varIn: 'x' }))).toThrow(/dieselbe Variable/)
  })

  it('ein Variablenname mit Sonderzeichen wirft', () => {
    expect(() => pruefeCompanion(konfig({ varOut: 'cp out' }))).toThrow(/gültiger Variablenname/)
    expect(() => pruefeCompanion(konfig({ varIn: 'a&b' }))).toThrow(/gültiger Variablenname/)
  })

  it('Companion zaehlt Seiten ab 1', () => {
    expect(() => pruefeCompanion(konfig({ knopf: { page: 0, row: 0, column: 0 } }))).toThrow(
      /ab 1/,
    )
  })

  it('eine krumme Schaltflaechen-Angabe wirft', () => {
    expect(() => pruefeCompanion(konfig({ knopf: { page: 1, row: -1, column: 0 } }))).toThrow(
      CompanionFehler,
    )
    expect(() => pruefeCompanion(konfig({ knopf: { page: 1, row: 0, column: 1.5 } }))).toThrow(
      CompanionFehler,
    )
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
        ipAddress: '10.0.0.30',
        controlProtocol: 'companion',
        controlCompanion: konfig({ knopf: { page: 2, row: 1, column: 3 } }),
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

describe('Der Weg ueber Companion', () => {
  it('ergibt die drei Aufrufe mit Vorgabe-Port 8000', () => {
    const p = anlage()
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.hindernisse).toEqual([])
    const a = plan.actions[0]
    expect(a.protocol).toBe('companion')
    expect(a).toMatchObject({ art: 'companion', host: '10.0.0.30', port: 8000 })
    expect(a.protocol === 'companion' && a.schritte).toHaveLength(3)
    expect(a.vorschau).toContain('/api/location/2/1/3/press')
  })

  it('ein eingetragener Port gewinnt gegen die Vorgabe', () => {
    const p = anlage({ controlPort: 8010 })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions[0].protocol === 'companion' && plan.actions[0].port).toBe(8010)
  })

  it('ohne Companion-Konfiguration wird NICHT gesendet', () => {
    const p = anlage({ controlCompanion: undefined })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Companion-Schaltfläche/)
  })

  it('ohne Adresse ebenso, und der Satz nennt Companion', () => {
    // „Keine IP am Geraet" waere hier irrefuehrend: die Adresse ist die von
    // COMPANION, nicht die der Kreuzschiene.
    const p = anlage({ ipAddress: '' })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Companion-Adresse/)
  })

  it('eine kaputte Konfiguration wird zum benannten Hindernis', () => {
    const p = anlage({ controlCompanion: konfig({ varIn: '' }) })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Variable für den Eingang/)
  })

  it('mit „je Anschluss eingetragen" und fehlender Nummer wird NICHT gesendet', () => {
    const p = anlage({ controlCompanion: konfig({ nummern: 'declared' }) })
    const plan = controlActions(p, wegVon(p).kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Nummer am Gerät/)
  })

  it('das Protokoll steht in der Tabelle und hat einen Treiber', () => {
    expect(PROTOCOL_INFO.companion.defaultPort).toBe(8000)
    expect(ohneKommentare(indexSrc)).toMatch(/companion: companionDriver/)
  })
})

describe('Der Treiber bricht ab, statt mit alten Werten zu druecken', () => {
  const src = ohneKommentare(driverSrc)

  it('er verlaesst die Schleife beim ersten Fehlschlag', () => {
    // DER gefaehrliche Fehler dieses Treibers: wer nach einer gescheiterten
    // Variable trotzdem drueckt, schaltet den VORIGEN Kreuzpunkt — und es
    // sieht aus wie ein gelungener Befehl.
    expect(src).toMatch(/if \(!res\.ok\) \{[\s\S]{0,400}return \{/)
    expect(src).not.toMatch(/continue/)
  })

  it('die Meldung sagt, WOBEI abgebrochen wurde und ob schon etwas ging', () => {
    // „Companion hat abgelehnt" allein liesse offen, ob der Kreuzpunkt halb
    // gesetzt ist.
    expect(src).toMatch(/Abgebrochen bei/)
    expect(src).toMatch(/Es wurde nichts geschaltet/)
    expect(src).toMatch(/halb gesetzt/)
  })

  it('der Erfolg behauptet nicht, das GERAET habe geschaltet', () => {
    // Companion meldet an dieser Stelle nur, dass es die Aufrufe angenommen
    // hat. Was das Geraet daraufhin tut, steht dort nicht.
    expect(src).toMatch(/meldet Companion hier nicht zurück/)
  })

  it('er baut keinen Pfad selbst', () => {
    // Ein zweiter Bauer waere `zwei-rechnungen`, mit einer laufenden Anlage
    // als Schauplatz.
    expect(src).not.toMatch(/custom-variable\/\$\{|location\/\$\{/)
    expect(src).toMatch(/\$\{basis\}\$\{schritt\.pfad\}/)
  })

  it('er wartet nicht endlos', () => {
    expect(src).toMatch(/AbortController/)
    expect(src).toMatch(/ANTWORT_FRIST_MS/)
  })

  it('das Verbindungs-Abrufen ist ein LESEN und steht getrennt', () => {
    expect(src).toMatch(/companionConnections/)
    expect(src).toMatch(/'GET'/)
  })
})

describe('Die Verbindungsliste ist tolerant', () => {
  it('sie liest die Felder, die Companion meldet', () => {
    const raus = leseVerbindungen([
      { id: 'abc', label: 'Videohub Halle', moduleId: 'bmd-videohub', enabled: true, status: 'ok' },
    ])
    expect(raus).toEqual([
      { id: 'abc', label: 'Videohub Halle', moduleId: 'bmd-videohub', enabled: true, status: 'ok' },
    ])
  })

  it('ein Eintrag ohne Id faellt, der Rest bleibt', () => {
    const raus = leseVerbindungen([{ label: 'ohne Id' }, { id: 'x' }])
    expect(raus.map((v) => v.id)).toEqual(['x'])
    // Ohne Beschriftung steht die Id da — besser als eine leere Zeile.
    expect(raus[0].label).toBe('x')
  })

  it('ein Status als Objekt wird nicht zu „[object Object]"', () => {
    const raus = leseVerbindungen([{ id: 'x', status: { category: 'warning' } }])
    expect(raus[0].status).toBe('warning')
  })

  it('was kein Array ist, ergibt eine leere Liste statt eines Absturzes', () => {
    // Eine Bequemlichkeit beim Einrichten darf beim kleinsten
    // Formatunterschied nicht den ganzen Dialog kippen.
    expect(leseVerbindungen(undefined)).toEqual([])
    expect(leseVerbindungen({ connections: [] })).toEqual([])
    expect(leseVerbindungen(['nur ein String'])).toEqual([])
  })
})

describe('Die Sektion traegt ein und behauptet nichts', () => {
  const src = ohneKommentare(sectionSrc)

  it('die notierte Verbindung ist als NOTIZ beschriftet', () => {
    // Companion prueft nicht, ob die Schaltflaeche zu dieser Verbindung
    // gehoert. Wer sie dort umbaut, macht die Notiz falsch — und das muss
    // dastehen, sonst liest sie sich wie eine Zusicherung.
    expect(src).toMatch(/companionNoteWarn/)
  })

  it('das Abrufen der Verbindungen ist ein Lesen ohne Bestaetigung', () => {
    expect(src).toMatch(/companionConnections\(\{/)
  })

  it('die Heilung einer unbrauchbaren Konfiguration ist verdrahtet', () => {
    expect(ohneKommentare(projectStoreSrc)).toMatch(/pruefeCompanion\(item\.controlCompanion\)/)
  })

  it('die Vorschau nennt Zweck und Pfad je Schritt', () => {
    const text = companionVorschau(companionSchritte(konfig(), [{ outputIndex: 0, inputIndex: 1 }]))
    expect(text).toContain('POST /api/custom-variable/cp_out/value')
    expect(text).toMatch(/Variable „cp_out"/)
    expect(text).toMatch(/Schaltfläche 1\/0\/0 drücken/)
  })
})
