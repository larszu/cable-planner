import { describe, expect, it } from 'vitest'
import { leseHausDatei, FACILITY_FORMAT, FACILITY_FORMAT_VERSION } from '../src/renderer/lib/hausDatei'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { HausAuskunft } from '../src/renderer/types/hausAuskunft'

// ───────────────────────────────────────────────────────────────────────────
// Der Weg vom Plan zur Klinke (larszu-facility-planner Issue #2).
//
// Bis 2026-09-10 las der Kabelplaner den Vertrag des Gebaeude-Werkzeugs GAR
// NICHT — weder `facility` noch `Steuerklinke` kamen im Quelltext vor. Der
// Vertrag war sechs Funktionen ueber einem Objekt, das nur im localStorage
// der anderen App lebte.
//
// Was hier geprueft wird, ist nicht „JSON kommt an", sondern die drei
// Zusagen, an denen im Aufbau etwas haengt:
//
//   1. Der Leser erfindet nichts. „Nicht angegeben" bleibt es.
//   2. Der Plan haelt einen VERWEIS, keine Abschrift — zeigt er ins Leere,
//      steht es im Plan-Check.
//   3. Wo das Haus schweigt, schweigt der Check. Eine erfundene Grenze liest
//      sich auf dem Blatt wie eine gemessene.
// ───────────────────────────────────────────────────────────────────────────

const datei = (gebaeude: unknown, version = FACILITY_FORMAT_VERSION) =>
  JSON.stringify({ format: FACILITY_FORMAT, version, gebaeude })

const HAUS = {
  id: 'haus-1',
  name: 'Stadthalle',
  raeume: [{ id: 'r1', name: 'Saal', hausbezeichner: 'EG.01' }],
  punkte: [
    {
      id: 'p1',
      bezeichnung: 'Bühne links',
      art: 'einspeisung',
      raumId: 'r1',
      anschlussart: 'cee32',
      netzform: 'TN-S',
      absicherungA: 32,
      charakteristik: 'C',
      rcdTyp: 'A',
      dauerleistungW: 3000,
    },
    {
      id: 'p2',
      bezeichnung: 'Wanddose Foyer',
      art: 'dose',
      raumId: 'r1',
      anschlussart: 'schuko',
      netzform: 'TN-S',
      absicherungA: 16,
      charakteristik: 'B',
      rcdTyp: 'A',
      geschaltet: true,
    },
    {
      id: 'p3',
      bezeichnung: 'Dimmerkreis Saal',
      art: 'dose',
      raumId: 'r1',
      anschlussart: 'schuko',
      netzform: 'TN-S',
      absicherungA: 16,
      charakteristik: 'B',
      rcdTyp: 'A',
      gedimmt: true,
    },
  ],
  klinken: [
    { id: 'k1', system: 'dali', adresse: '7', adressart: 'kurz', richtung: 'schalten', bedeutung: 'Saallicht Reihe 1' },
    { id: 'k2', system: 'knx', adresse: '1/2/3', richtung: 'lesen', bedeutung: 'Ist die Bühne freigegeben?' },
  ],
  strecken: [{ id: 's1', bezeichnung: 'Steigleitung EG-OG' }],
}

const auskunft = (): HausAuskunft =>
  leseHausDatei(datei(HAUS), { quelle: 'stadthalle.avfacility', gelesenAm: '2026-09-10T10:00:00.000Z' })!

const geraet = (teil: Partial<EquipmentItem> & { id: string }): EquipmentItem =>
  ({
    name: teil.id,
    category: 'Sonstiges',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 96,
    ...teil,
  }) as unknown as EquipmentItem

const checks = (equipment: EquipmentItem[], hausAuskunft?: HausAuskunft) =>
  runDrawingChecks({ equipment, cables: [], hausAuskunft })

describe('Die Gebäude-Auskunft kommt an', () => {
  it('1. Punkte, Klinken und Strecken werden gelesen — mit Adressart', () => {
    const a = auskunft()
    expect(a.name).toBe('Stadthalle')
    expect(a.punkte).toHaveLength(3)
    expect(a.klinken[0]!.adressart).toBe('kurz')
    expect(a.strecken[0]!.bezeichnung).toBe('Steigleitung EG-OG')
    // Die Abschrift trägt ihr Datum und ihre Herkunft — sonst sieht sie aus
    // wie der Zustand von heute.
    expect(a.gelesenAm).toBe('2026-09-10T10:00:00.000Z')
    expect(a.quelle).toBe('stadthalle.avfacility')
  })

  it('2. „nicht angegeben" wird NICHT zu „nein"', () => {
    const p1 = auskunft().punkte.find((p) => p.id === 'p1')!
    expect(p1.geschaltet, 'aus keiner Angabe darf kein „nicht geschaltet" werden').toBeUndefined()
    expect(p1.gedimmt).toBeUndefined()
  })

  it('3. keine Dauerleistung wird gerechnet, wo das Haus keine angibt', () => {
    // `absicherungA x 230` waere die naheliegende Ergänzung und die falsche:
    // der Nennstrom ist die Auslöseschwelle, nicht die Belastbarkeit.
    const p2 = auskunft().punkte.find((p) => p.id === 'p2')!
    expect(p2.dauerleistungW).toBeUndefined()
  })

  it('4. eine Klinke ohne Bedeutung fällt weg — eine Adresse ohne Sinn ist keine Klinke', () => {
    const a = leseHausDatei(
      datei({ ...HAUS, klinken: [{ id: 'kx', system: 'knx', adresse: '1/1/1', richtung: 'schalten' }] }),
      { quelle: 'x', gelesenAm: 't' },
    )
    expect(a?.klinken).toEqual([])
  })

  it('5. eine fremde oder neuere Datei wird abgewiesen, nicht halb gelesen', () => {
    expect(leseHausDatei('kein json', { quelle: 'x', gelesenAm: 't' })).toBeNull()
    expect(leseHausDatei(JSON.stringify({ format: 'anderes', version: 1 }), { quelle: 'x', gelesenAm: 't' })).toBeNull()
    expect(leseHausDatei(datei(HAUS, FACILITY_FORMAT_VERSION + 1), { quelle: 'x', gelesenAm: 't' })).toBeNull()
  })
})

describe('Der Plan-Check fragt die Auskunft', () => {
  it('1. ein Gerät an einer GESCHALTETEN Dose wird gewarnt', () => {
    const r = checks([geraet({ id: 'srv', name: 'Medienserver', hausPunktId: 'p2' })], auskunft())
    const f = r.findings.find((x) => x.id === 'haus-geschaltet:srv')
    expect(f?.severity).toBe('warning')
    expect(f?.message).toContain('Wanddose Foyer')
  })

  it('2. ein Gerät an einer GEDIMMTEN Dose ist ein Fehler', () => {
    const r = checks([geraet({ id: 'srv', name: 'Medienserver', hausPunktId: 'p3' })], auskunft())
    expect(r.findings.find((x) => x.id === 'haus-gedimmt:srv')?.severity).toBe('error')
  })

  it('3. ein Verweis ins Leere fällt auf', () => {
    // Der teure Fall: das Haus schickt eine neue Datei, und die Dose von
    // damals steht nicht mehr drin.
    const r = checks([geraet({ id: 'srv', hausPunktId: 'weg' })], auskunft())
    expect(r.findings.find((x) => x.id === 'haus-punkt-fehlt:srv')?.severity).toBe('error')
    const k = checks([geraet({ id: 'srv', hausKlinkeId: 'weg' })], auskunft())
    expect(k.findings.find((x) => x.id === 'haus-klinke-fehlt:srv')?.severity).toBe('error')
  })

  it('4. die Summe gegen die angegebene Dauerleistung', () => {
    const r = checks(
      [
        geraet({ id: 'a', hausPunktId: 'p1', powerConsumptionWatts: 2000 }),
        geraet({ id: 'b', hausPunktId: 'p1', powerConsumptionWatts: 1500 }),
      ],
      auskunft(),
    )
    const f = r.findings.find((x) => x.id === 'haus-last:p1')
    expect(f?.severity).toBe('error')
    expect(f?.message).toContain('3500')
  })

  it('5. wo das Haus KEINE Dauerleistung angibt, schweigt der Check', () => {
    // p2 hat nur eine Absicherung. Eine Grenze daraus zu rechnen waere eine
    // Vermutung, die auf dem Blatt wie eine Messung aussieht.
    const r = checks([geraet({ id: 'a', hausPunktId: 'p2', powerConsumptionWatts: 5000 })], auskunft())
    expect(r.findings.some((x) => x.id.startsWith('haus-last'))).toBe(false)
  })

  it('7. eine DALI-Adresse OHNE Art ist eine Warnung (facility #2)', () => {
    // Bei DALI heisst „3" je nach Art etwas anderes: ein Vorschaltgeraet,
    // dreissig Leuchten oder der ganze Bus samt Notlicht. Der Rechner dafuer
    // stand im Gebaeude-Werkzeug und meldete nur dem, der die Auskunft
    // pflegt — nicht dem, der die Adresse benutzt.
    const mitLuecke = leseHausDatei(
      datei({
        ...HAUS,
        klinken: [
          { id: 'k3', system: 'dali', adresse: '3', richtung: 'schalten', bedeutung: 'Saallicht' },
        ],
      }),
      { quelle: 'x.avfacility', gelesenAm: '2026-09-10T10:00:00.000Z' },
    )!
    const r = checks([geraet({ id: 'dim', name: 'Dimmer', hausKlinkeId: 'k3' })], mitLuecke)
    const f = r.findings.find((x) => x.id === 'haus-klinke-mehrdeutig:dim')
    expect(f?.severity).toBe('warning')
    expect(f?.message).toContain('3')
  })

  it('8. bei KNX fehlt nichts, wenn die Art leer bleibt', () => {
    // Eine KNX-Gruppenadresse ist aus sich heraus eindeutig. Dort zu warnen
    // hiesse, ein Feld zu verlangen, das nur eine moegliche Antwort hat.
    const r = checks([geraet({ id: 'frei', hausKlinkeId: 'k2' })], auskunft())
    expect(r.findings.some((x) => x.id.startsWith('haus-klinke-mehrdeutig'))).toBe(false)
  })

  it('9. eine DALI-Adresse MIT Art schweigt ebenfalls', () => {
    const r = checks([geraet({ id: 'ok', hausKlinkeId: 'k1' })], auskunft())
    expect(r.findings.some((x) => x.id.startsWith('haus-klinke-mehrdeutig'))).toBe(false)
  })

  it('6. ohne hinterlegte Auskunft schweigen ALLE Haus-Checks', () => {
    // Kein „nicht geprüft", kein Hinweis. Die meisten Pläne stehen in einer
    // Halle, über die niemand eine Datei hat — ein Befund, den man nicht
    // beheben kann, macht die Liste unlesbar.
    const r = checks([geraet({ id: 'srv', hausPunktId: 'p2', hausKlinkeId: 'weg' })])
    expect(r.findings.filter((x) => x.category.startsWith('House'))).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// #881, letztes Kriterium — die LED-Wand am Anschlusspunkt.
//
// Bis hierher standen die Waende in KEINER Stromrechnung: eine 60-Panel-Wand
// zog im Plan null Watt. Sie sind keine Geraete, und `effectiveWatts` sieht
// nur Geraete.
// ---------------------------------------------------------------------------
describe('Die LED-Wand haengt am Haus (#881)', () => {
  const panel = {
    id: 'pt1',
    name: 'P2.6 500x500',
    pixelPitchMm: 2.6,
    pixels: { x: 192, y: 192 },
    sizeMm: { w: 500, h: 500 },
    powerAvgW: 100,
    powerMaxW: 400,
  }
  const wand = (teil: Record<string, unknown> = {}) => ({
    id: 'w1',
    name: 'Bühnenwand',
    panelTypeId: 'pt1',
    columns: 4,
    rows: 2,
    ...teil,
  })
  const mitWand = (w: Record<string, unknown>, p = panel) =>
    runDrawingChecks({
      equipment: [],
      cables: [],
      hausAuskunft: auskunft(),
      ledPanelTypes: [p] as never,
      ledWalls: [w] as never,
    })

  it('zaehlt die DAUERleistung in die Last des Punkts', () => {
    // p1 ist mit 3000 W angegeben; acht Panels a 100 W sind 800 W — kein
    // Befund. Zwoelf Reihen waeren 4800 W und einer.
    expect(mitWand(wand({ hausPunktId: 'p1' })).findings.some((f) => f.id === 'haus-last:p1')).toBe(
      false,
    )
    const viel = mitWand(wand({ hausPunktId: 'p1', rows: 12 }))
    expect(viel.findings.find((f) => f.id === 'haus-last:p1')?.severity).toBe('error')
  })

  it('meldet die SPITZE getrennt — danach wird die Sicherung gewaehlt', () => {
    // Acht Panels: 800 W im Mittel, 3200 W im Weissbild. Der Punkt traegt
    // 3000 W Dauerleistung. Die Summe ist in Ordnung, die Spitze nicht.
    const r = mitWand(wand({ hausPunktId: 'p1' }))
    const f = r.findings.find((x) => x.id === 'haus-wand-spitze:w1')
    expect(f?.severity).toBe('warning')
    expect(f?.message).toContain('3200')
  })

  it('sagt es, wenn der Panel-Typ keine Leistung traegt — statt null zu zaehlen', () => {
    const ohne = { ...panel, powerAvgW: undefined, powerMaxW: undefined }
    const r = mitWand(wand({ hausPunktId: 'p1' }), ohne as never)
    expect(r.findings.find((x) => x.id === 'haus-wand-ohne-leistung:w1')?.severity).toBe('info')
    expect(r.findings.some((x) => x.id === 'haus-last:p1')).toBe(false)
  })

  it('meldet einen Punkt, den die Auskunft nicht mehr fuehrt', () => {
    const r = mitWand(wand({ hausPunktId: 'weg' }))
    expect(r.findings.find((x) => x.id === 'haus-wand-punkt-fehlt:w1')?.severity).toBe('error')
  })

  it('schweigt ueber eine Wand ohne Anschlusspunkt', () => {
    // „Nicht angegeben" ist keine Frage, die der Plan stellen muss: die
    // meisten Waende haengen an einem Verteiler, ueber den das Haus nichts
    // sagt.
    const r = mitWand(wand())
    expect(r.findings.some((x) => x.id.startsWith('haus-wand'))).toBe(false)
  })
})
