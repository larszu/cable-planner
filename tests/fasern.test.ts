import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EINGEBAUTE_POLARITAETSNORMEN,
  FASER_ROLLEN,
  breakoutBefunde,
  normalisiereFaser,
  normalisierePolaritaetsnorm,
  polaritaetsBefunde,
  type Faser,
  type Polaritaetsnorm,
} from '../src/renderer/types/fiber'

// ---------------------------------------------------------------------------
// #885 — eine Buchse, mehrere Fasern.
//
// GEMESSEN, bevor gebaut wurde (#882 → #885): `Port` war flach, `Cable`
// streng Punkt-zu-Punkt, `ConnectorType` kannte kein opticalCON, und
// „polarity" hatte im ganzen Repo null Treffer. Ein opticalCON QUAD liess
// sich nicht abbilden, ohne vier Kabel anzulegen — und dabei faellt die
// aeussere Buchse aus dem Plan, also genau die Angabe, an der haengt, ob das
// Kabel passt.
// ---------------------------------------------------------------------------

const faser = (position: number, rolle: Faser['rolle'] = 'unbestimmt'): Faser => ({
  id: `f${position}`,
  position,
  rolle,
})

const quad = { id: 'p1', name: 'BP · Fibre 1', fasern: [faser(1), faser(2), faser(3), faser(4)] }

describe('#885 — keine eingebaute Polaritaets-Methode', () => {
  it('die Liste ist leer, und das ist eine Entscheidung', () => {
    expect(
      EINGEBAUTE_POLARITAETSNORMEN,
      'TIA-568 kennt A, B und C, und sie unterscheiden sich darin, WO gekreuzt ' +
        'wird. Welche fuer eine Anlage gilt, steht in deren Unterlage und nicht ' +
        'im Programm. Eine eingebaute Vorgabe saehe aus wie eine geprueft Angabe ' +
        'und beurteilte danach jede Faser (#885).',
    ).toEqual([])
  })

  it('und keine Quelldatei traegt eine Methode als Vorgabe ein', () => {
    // Die Gegenprobe: eine leere Liste nuetzt nichts, wenn daneben eine
    // Tabelle „Methode B -> kreuzt" steht.
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'types', 'fiber.ts'),
      'utf8',
    )
    const ohneKommentare = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(ohneKommentare).not.toMatch(/kreuzt:\s*true/)
  })

  it('eine Methode ohne Herkunft wird verworfen', () => {
    expect(
      normalisierePolaritaetsnorm({ id: 'a', name: 'Methode B', kreuzt: true }),
    ).toBeUndefined()
    expect(
      normalisierePolaritaetsnorm({ id: 'a', name: 'Methode B', herkunft: ' ', kreuzt: true }),
    ).toBeUndefined()
    expect(
      normalisierePolaritaetsnorm({
        id: 'a',
        name: 'Methode B',
        herkunft: 'Hausunterlage, Seite 4',
        kreuzt: true,
      }),
    ).toEqual({ id: 'a', name: 'Methode B', herkunft: 'Hausunterlage, Seite 4', kreuzt: true })
  })
})

describe('#885 — die Rolle hat drei Werte', () => {
  it('und der dritte ist „nicht angegeben"', () => {
    expect(FASER_ROLLEN).toEqual(['tx', 'rx', 'unbestimmt'])
  })

  it('eine Faser ohne angegebene Rolle ist unbestimmt und nicht TX', () => {
    expect(normalisiereFaser({ id: 'x', position: 1 }, 0)?.rolle).toBe('unbestimmt')
  })

  it('eine Faser ohne brauchbare Lage faellt weg', () => {
    // Eine geratene Lage stuende danach im Plan wie eine Angabe des
    // Datenblatts — und jemand sucht am Breakout nach ihr.
    expect(normalisiereFaser({ id: 'x' }, 0)).toBeUndefined()
    expect(normalisiereFaser({ id: 'x', position: 0 }, 0)).toBeUndefined()
    expect(normalisiereFaser({ id: 'x', position: 2.5 }, 0)).toBeUndefined()
    expect(normalisiereFaser({ position: 3 }, 7)?.id).toBe('faser-7')
  })
})

describe('#885 — der Breakout', () => {
  it('schweigt, wo nichts aufgeteilt ist', () => {
    expect(breakoutBefunde({ id: 'p', name: 'LC 1' }, [])).toEqual([])
  })

  it('schweigt bei einer Buchse, an der gar nichts haengt', () => {
    // Frei ist kein Befund. Sonst meldete jeder unbenutzte QUAD-Port vier
    // fehlende Fasern, und die Liste waere nach dem ersten Patchfeld tot.
    expect(breakoutBefunde(quad, [])).toEqual([])
  })

  it('meldet drei von vier gepatcht', () => {
    const befunde = breakoutBefunde(quad, [
      { cableId: 'c1', bezeichnung: 'K1', position: 1 },
      { cableId: 'c2', bezeichnung: 'K2', position: 2 },
      { cableId: 'c3', bezeichnung: 'K3', position: 3 },
    ])
    expect(befunde.map((b) => b.art)).toEqual(['faser-unbelegt'])
    expect(befunde[0].werte).toMatchObject({ belegt: 3, total: 4, frei: '4' })
  })

  it('schweigt, wenn alle vier liegen', () => {
    const befunde = breakoutBefunde(
      quad,
      [1, 2, 3, 4].map((n) => ({ cableId: `c${n}`, bezeichnung: `K${n}`, position: n })),
    )
    expect(befunde).toEqual([])
  })

  it('meldet zwei Kabel auf derselben Faser', () => {
    const befunde = breakoutBefunde(quad, [
      { cableId: 'c1', bezeichnung: 'K1', position: 1 },
      { cableId: 'c2', bezeichnung: 'K2', position: 1 },
    ])
    expect(befunde.map((b) => b.art)).toContain('faser-doppelt')
  })

  it('meldet eine Faser, die es in dieser Buchse nicht gibt', () => {
    const duo = { id: 'p2', name: 'DUO', fasern: [faser(1), faser(2)] }
    const befunde = breakoutBefunde(duo, [{ cableId: 'c9', bezeichnung: 'K9', position: 3 }])
    expect(befunde.map((b) => b.art)).toContain('faser-unbekannt')
  })
})

describe('#885 — die Polaritaet', () => {
  const kreuzend: Polaritaetsnorm = {
    id: 'b',
    name: 'Methode B',
    herkunft: 'Hausunterlage, Seite 4',
    kreuzt: true,
  }
  const gerade: Polaritaetsnorm = { ...kreuzend, id: 'a', name: 'Methode A', kreuzt: false }
  const kabel = { id: 'c1', bezeichnung: 'K1' }

  it('urteilt ohne gewaehlte Methode NICHT, sagt aber, dass es ungeprueft ist', () => {
    const befunde = polaritaetsBefunde(kabel, { rolle: 'tx' }, { rolle: 'tx' }, undefined)
    expect(befunde.map((b) => b.art)).toEqual(['norm-offen'])
  })

  it('meldet TX gegen TX bei einer kreuzenden Methode', () => {
    const befunde = polaritaetsBefunde(kabel, { rolle: 'tx' }, { rolle: 'tx' }, kreuzend)
    expect(befunde.map((b) => b.art)).toEqual(['polaritaet-verdreht'])
  })

  it('schweigt bei TX gegen RX unter derselben Methode', () => {
    expect(polaritaetsBefunde(kabel, { rolle: 'tx' }, { rolle: 'rx' }, kreuzend)).toEqual([])
  })

  it('dreht das Urteil mit der Methode um', () => {
    // Bei einer GERADEN Methode kreuzt das Patchkabel — dort ist TX gegen TX
    // richtig und TX gegen RX der Fehler.
    expect(polaritaetsBefunde(kabel, { rolle: 'tx' }, { rolle: 'tx' }, gerade)).toEqual([])
    expect(
      polaritaetsBefunde(kabel, { rolle: 'tx' }, { rolle: 'rx' }, gerade).map((b) => b.art),
    ).toEqual(['polaritaet-verdreht'])
  })

  it('urteilt nicht, wenn eine Seite nichts sagt — und schweigt auch nicht', () => {
    const befunde = polaritaetsBefunde(kabel, { rolle: 'tx' }, { rolle: 'unbestimmt' }, kreuzend)
    expect(befunde.map((b) => b.art)).toEqual(['rolle-offen'])
  })
})

// ---------------------------------------------------------------------------
// #885, Nebenbefund — NetBox liefert den Breakout schon mit.
//
// Ein Rear-Port traegt dort `positions`: wieviele Front-Ports auf ihm liegen.
// Das ist die Faserzahl der Buchse, und der Import warf sie weg. Gemessen
// wird hier am ERGEBNIS des Imports und nicht am Quelltext — eine Zusage
// ueber Verhalten, keine Abschrift.
// ---------------------------------------------------------------------------
describe('#885 — der Breakout aus NetBox', () => {
  const laden = async (yaml: string) => {
    const { importNetBoxDeviceType } = await import('../src/renderer/lib/netboxImport')
    const echt = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(yaml, { status: 200 })) as unknown as typeof fetch
    try {
      return await importNetBoxDeviceType({
        branch: 'master',
        path: 'x.yaml',
        manufacturer: 'Neutrik',
        model: 'NO4FDW',
        slug: 'no4fdw',
      })
    } finally {
      globalThis.fetch = echt
    }
  }

  it('macht aus `positions: 4` vier Fasern — mit unbestimmter Rolle', () => {
    return laden(
      ['manufacturer: Neutrik', 'model: NO4FDW', 'rear_ports:', '  - name: QUAD 1', '    positions: 4'].join(
        '\n',
      ),
    ).then((vorlage) => {
      const port = [...vorlage.inputs, ...vorlage.outputs].find((p) => p.fasern)
      expect(port?.fasern).toHaveLength(4)
      // NICHT geraten: NetBox sagt, WIEVIELE Lagen es gibt, und nichts
      // darueber, welche sendet.
      expect(port?.fasern?.every((f) => f.rolle === 'unbestimmt')).toBe(true)
      expect(port?.fasern?.map((f) => f.position)).toEqual([1, 2, 3, 4])
    })
  })

  it('legt bei einer einzelnen Lage KEINEN Breakout an', () => {
    // `positions: 1` ist eine gewoehnliche Buchse. Eine Faser-Liste mit
    // einem Eintrag saehe im Plan aus wie eine Aufteilung und waere keine.
    return laden(
      ['manufacturer: Neutrik', 'model: NO2', 'rear_ports:', '  - name: DUO 1', '    positions: 1'].join(
        '\n',
      ),
    ).then((vorlage) => {
      expect([...vorlage.inputs, ...vorlage.outputs].some((p) => p.fasern)).toBe(false)
    })
  })
})
