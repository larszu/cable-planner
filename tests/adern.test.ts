import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EINGEBAUTE_FARBNORMEN,
  LEITER_ROLLEN,
  LEITER_ROLLE_LABEL,
  aderKurz,
  anschlussBefunde,
  farbeDerAder,
  normalisiereAder,
  normalisiereAdern,
  normalisiereAnschluss,
  normalisiereFarbnorm,
  type Ader,
  type Anschluss,
  type AnschlussLeitung,
  type Farbnorm,
} from '../src/renderer/types/conductor'

// ---------------------------------------------------------------------------
// B-45 — die Einzelader.
//
// Wunsch des Eigentuemers, 2026-09-08: „Powerlock Kabel zieht man einzeln.
// Die muessen auch die Adern Farben bekommen."
//
// GEMESSEN, bevor gebaut wurde: `powerPhase` (L1/L2/L3) stand am GERAET,
// `types/powerStandard.ts` und die Powerlock-/CEE-/Socapex-Steckertypen gab
// es — aber im ganzen Renderer kein Feld, das sagt, welchen Leiter eine
// LEITUNG fuehrt. Ein Kabel war eine Verbindung, und fuenf Powerlock-
// Leitungen waren entweder ein Kabel (falsch) oder fuenf unabhaengige
// (auch falsch, weil dann niemand merkt, dass die vierte fehlt).
// ---------------------------------------------------------------------------

const norm: Farbnorm = {
  id: 'n1',
  name: 'Hausstandard',
  herkunft: 'Vom Eigentümer festgelegt, 2026-09-08',
  farben: { L1: 'braun', L2: 'schwarz', L3: 'grau', N: 'blau', PE: 'grün-gelb' },
}

const ader = (rolle: Ader['rolle'], rest: Partial<Ader> = {}): Ader => ({
  id: `a-${rolle}${rest.farbe ?? ''}`,
  rolle,
  ...rest,
})

const leitung = (name: string, adern: Ader[]): AnschlussLeitung => ({
  cableId: `c-${name}`,
  bezeichnung: name,
  adern,
})

const anschluss: Anschluss = {
  id: 'b1',
  name: '400 A Bühne links',
  soll: ['L1', 'L2', 'L3', 'N', 'PE'],
  farbnormId: 'n1',
}

const alleFuenf = (): AnschlussLeitung[] =>
  (['L1', 'L2', 'L3', 'N', 'PE'] as const).map((r) => leitung(r, [ader(r)]))

describe('Es ist KEINE Farbnorm eingebaut, und das ist die Entscheidung', () => {
  it('die Liste der eingebauten Normen ist leer', () => {
    // Die deutsche Neuinstallation, die aeltere Farbgebung und die
    // nordamerikanische Zuordnung sind drei verschiedene Saetze. Welcher fuer
    // eine Anlage gilt, steht nicht im Programm.
    //
    // Eine geratene Vorgabe waere hier schlimmer als keine: sie saehe aus wie
    // eine gepruefte Angabe, sie faerbte jede Ader, und die Pruefung
    // bestaetigte sie anschliessend gegen sich selbst — an einer Stelle, an
    // der jemand mit Strom arbeitet.
    expect(
      EINGEBAUTE_FARBNORMEN,
      'Wer hier eine Norm eintraegt, traegt die Behauptung ein, sie gelte — ' +
        'fuer jede Anlage, in der dieses Programm laeuft. Das ist eine ' +
        'Eigentuemer-Entscheidung und keine Vorgabe (B-45).',
    ).toEqual([])
  })

  it('und keine Quelldatei setzt eine Farbe je Leiter als Vorgabe', () => {
    // Die Gegenprobe zur Zusicherung darueber: eine leere Liste nuetzt
    // nichts, wenn irgendwo daneben eine Tabelle „L1 -> braun" steht.
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'types', 'conductor.ts'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(src).not.toMatch(/L1:\s*['"][a-zäöü-]+['"]/i)
    expect(src).not.toMatch(/PE:\s*['"][a-zäöü-]+['"]/i)
  })

  it('eine Norm ohne Herkunft wird verworfen, nicht mit leerem Feld behalten', () => {
    // Sonst stuende in der Auswahl eine Norm, deren Urheber niemand
    // nachlesen kann — und sie faerbte trotzdem jede Ader.
    expect(normalisiereFarbnorm({ id: 'x', name: 'Irgendwas', farben: {} })).toBeUndefined()
    expect(
      normalisiereFarbnorm({ id: 'x', name: 'Irgendwas', herkunft: '   ', farben: {} }),
    ).toBeUndefined()
    expect(normalisiereFarbnorm(norm)?.herkunft).toBe(norm.herkunft)
  })
})

describe('Der Fehler, den ein Plan finden MUSS', () => {
  it('vier gezogene Leitungen bei fünf geplanten', () => {
    const vier = alleFuenf().filter((l) => l.bezeichnung !== 'N')
    const befunde = anschlussBefunde(anschluss, vier, norm)
    const fehlt = befunde.filter((b) => b.art === 'ader-fehlt')
    expect(fehlt).toHaveLength(1)
    expect(fehlt[0].text).toContain('N')
  })

  it('fünf von fünf: kein Fehl-Befund', () => {
    const befunde = anschlussBefunde(anschluss, alleFuenf(), norm)
    expect(befunde.filter((b) => b.art === 'ader-fehlt')).toEqual([])
  })

  it('derselbe Leiter zweimal ist ebenfalls ein Befund', () => {
    // „Welche Leitung gilt?" ist auf einer Baustelle keine rhetorische Frage.
    const doppelt = [...alleFuenf(), leitung('L1-zweite', [ader('L1')])]
    const befunde = anschlussBefunde(anschluss, doppelt, norm)
    expect(befunde.some((b) => b.art === 'ader-doppelt')).toBe(true)
  })

  it('aber `frei` darf mehrfach vorkommen', () => {
    // `frei` ist ausdruecklich kein Leiter mit genau einer Stelle.
    const mitFrei = [
      ...alleFuenf(),
      leitung('Steuer-1', [ader('frei', { bezeichnung: 'Steuerader 1' })]),
      leitung('Steuer-2', [ader('frei', { bezeichnung: 'Steuerader 2' })]),
    ]
    expect(anschlussBefunde(anschluss, mitFrei, norm).some((b) => b.art === 'ader-doppelt')).toBe(
      false,
    )
  })

  it('eine Leitung im Anschluss ohne Ader-Angabe fällt auf', () => {
    const mitStummer = [...alleFuenf(), leitung('unbeschriftet', [])]
    const befunde = anschlussBefunde(anschluss, mitStummer, norm)
    const stumm = befunde.filter((b) => b.art === 'leitung-stumm')
    expect(stumm).toHaveLength(1)
    expect(stumm[0].cableId).toBe('c-unbeschriftet')
  })
})

describe('Die Farbe wird gegen die gewählte Norm geprüft — und nur gegen sie', () => {
  it('eine widersprechende Farbe ohne Grund ist ein Befund', () => {
    const falsch = alleFuenf().map((l) =>
      l.bezeichnung === 'N' ? leitung('N', [ader('N', { farbe: 'braun' })]) : l,
    )
    const befunde = anschlussBefunde(anschluss, falsch, norm)
    const widerspruch = befunde.filter((b) => b.art === 'farbe-widerspricht')
    expect(widerspruch).toHaveLength(1)
    expect(widerspruch[0].text).toContain('blau')
  })

  it('mit erklärtem Grund ist sie ein Sonderfall und kein Befund', () => {
    const mitGrund = alleFuenf().map((l) =>
      l.bezeichnung === 'N'
        ? leitung('N', [ader('N', { farbe: 'braun', abweichungsgrund: 'Bestandskabel, 1998' })])
        : l,
    )
    expect(
      anschlussBefunde(anschluss, mitGrund, norm).some((b) => b.art === 'farbe-widerspricht'),
    ).toBe(false)
  })

  it('ohne gewählte Norm wird nicht geprüft — aber auch nicht geschwiegen', () => {
    // Schweigen saehe auf dem Blatt aus wie „geprueft und in Ordnung".
    const ohne = anschlussBefunde({ ...anschluss, farbnormId: undefined }, alleFuenf(), undefined)
    expect(ohne.some((b) => b.art === 'norm-offen')).toBe(true)
    expect(ohne.some((b) => b.art === 'farbe-widerspricht')).toBe(false)
  })

  it('die Farbe einer Ader kommt aus der Norm, wenn keine gesetzt ist', () => {
    expect(farbeDerAder(ader('L1'), norm)).toBe('braun')
    expect(farbeDerAder(ader('L1', { farbe: 'rot' }), norm)).toBe('rot')
    expect(farbeDerAder(ader('L1'), undefined)).toBeUndefined()
  })

  it('und die Kurzform für Ziehliste und Etikett zeigt sie', () => {
    expect(aderKurz(ader('L1'), norm)).toBe('L1 (braun)')
    expect(aderKurz(ader('L1'), undefined)).toBe('L1')
    expect(aderKurz(ader('frei', { bezeichnung: 'Steuer' }), norm)).toBe('Steuer')
  })
})

describe('Jede Rolle ist benannt, und ein halber Datensatz wird nicht durchgelassen', () => {
  it('jede Leiter-Rolle hat eine Beschriftung', () => {
    for (const r of LEITER_ROLLEN) expect(LEITER_ROLLE_LABEL[r]).toBeTruthy()
  })

  it('eine Ader ohne gültige Rolle fällt weg', () => {
    // Eine Zeile ohne Leiter ist auf einer Ziehliste schlimmer als keine.
    expect(normalisiereAder({ id: 'x' }, 0)).toBeUndefined()
    expect(normalisiereAder({ id: 'x', rolle: 'L9' }, 0)).toBeUndefined()
    expect(normalisiereAder({ rolle: 'L1' }, 3)?.id).toBe('ader-3')
  })

  it('eine leere Ader-Liste wird zu undefined und nicht zu []', () => {
    expect(normalisiereAdern([])).toBeUndefined()
    expect(normalisiereAdern([{ rolle: 'quatsch' }])).toBeUndefined()
    expect(normalisiereAdern([{ id: 'a', rolle: 'PE' }])).toHaveLength(1)
  })

  it('ein Anschluss mit Zeiger auf eine gelöschte Norm verliert den Zeiger', () => {
    // Er saehe in der Anzeige aus wie eine gewaehlte Norm und faerbte nichts.
    const geheilt = normalisiereAnschluss(
      { id: 'b', name: 'X', soll: ['L1'], farbnormId: 'weg' },
      new Set(['n1']),
    )
    expect(geheilt?.farbnormId).toBeUndefined()
    expect(geheilt?.soll).toEqual(['L1'])
  })

  it('und unbekannte Soll-Rollen werden nicht übernommen', () => {
    const geheilt = normalisiereAnschluss(
      { id: 'b', name: 'X', soll: ['L1', 'L9', 42] },
      new Set(),
    )
    expect(geheilt?.soll).toEqual(['L1'])
  })
})

describe('Das Bündel ist nicht der Multicore-Name', () => {
  it('und der Code sagt, warum', () => {
    // Beide gruppieren Kabel, aber sie beantworten verschiedene Fragen:
    // `multicoreName` sagt „zaehle sie als ein Stueck", der Anschluss sagt
    // „er muss diese Leiter haben". Nur das Zweite kann eine fehlende
    // Leitung finden. Ohne diese Begruendung im Code legt der Naechste die
    // beiden zusammen — und verliert dabei die Soll-Angabe.
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'components', 'Power', 'AdernDialog.tsx'),
      'utf8',
    )
    expect(src).toContain('multicoreName')
    expect(src).toMatch(/EINEM Mantel/)
  })

  it('sie sind getrennte Felder am Kabel', () => {
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'types', 'cable.ts'),
      'utf8',
    )
    expect(src).toMatch(/multicoreName\?:/)
    expect(src).toMatch(/anschlussId\?:/)
  })
})
