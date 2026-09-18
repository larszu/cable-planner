import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ausMm,
  mmPosition,
  normalisiereFrontplatte,
  plattenBefunde,
  streifenFelder,
} from '../src/renderer/types/frontplatte'
import type { Port } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// #879 — die Frontplatte.
//
// GEMESSEN, bevor gebaut wurde: `widthMm`/`heightMm` am Geraet (v7.9.80) und
// `panelPosX/Y` am Port (#170) gab es bereits, ebenso die gezeichneten
// Steckverbinder (#472). Neu ist die AUSSAGE, dass ein Geraet eine Platte
// ist — und die Pruefung darauf. Ein zweites Positionsfeld gibt es
// ausdruecklich nicht; sonst zeigte die Rack-Ansicht etwas anderes als der
// Platten-Editor.
// ---------------------------------------------------------------------------

const platte = { breiteMm: 200, hoeheMm: 50 }

const port = (id: string, teil: Partial<Port> = {}): Port => ({
  id,
  name: id,
  type: 'XLR',
  connectorType: 'XLR',
  ...teil,
})

describe('#879 — Lage in Millimetern', () => {
  it('rechnet die normierte Lage in Millimeter um', () => {
    expect(mmPosition(port('a', { panelPosX: 0.5, panelPosY: 0.5 }), platte)).toEqual({
      xMm: 100,
      yMm: 25,
    })
  })

  it('gibt fuer einen Stecker OHNE Lage nichts zurueck und nicht die Ecke', () => {
    // Eine Vorgabe-Ecke sieht auf der Zeichnung aus wie eine gesetzte Lage,
    // und jemand bohrt danach.
    expect(mmPosition(port('a'), platte)).toBeUndefined()
  })

  it('faengt beim Zurueckrechnen aufs Raster und bleibt auf der Platte', () => {
    expect(ausMm(103, 24, platte, 10)).toEqual({ panelPosX: 0.5, panelPosY: 0.4 })
    expect(ausMm(-40, 999, platte)).toEqual({ panelPosX: 0, panelPosY: 1 })
  })

  it('laesst ohne Raster die Lage in Ruhe', () => {
    expect(ausMm(103, 24, platte)).toEqual({ panelPosX: 0.515, panelPosY: 0.48 })
  })
})

describe('#879 — was an der Platte nicht stimmt', () => {
  it('meldet einen Stecker, dessen LOCH ueber den Rand geht', () => {
    // Die Mitte liegt auf der Platte, der Ausschnitt nicht. Ohne diese
    // Rechnung faellt es erst beim Bohren auf.
    const befunde = plattenBefunde(
      [port('a', { panelPosX: 0.99, panelPosY: 0.5, ausschnittMm: 24 })],
      platte,
    )
    expect(befunde.map((b) => b.art)).toContain('ausserhalb')
  })

  it('meldet zwei Loecher, die sich schneiden, mit dem Mass', () => {
    const befunde = plattenBefunde(
      [
        port('a', { panelPosX: 0.5, panelPosY: 0.5, ausschnittMm: 24 }),
        port('b', { panelPosX: 0.55, panelPosY: 0.5, ausschnittMm: 24 }),
      ],
      platte,
    )
    const treffer = befunde.find((b) => b.art === 'ueberschneidung')
    expect(treffer?.werte).toMatchObject({ mm: 14 })
  })

  it('prueft NICHT auf Ueberschneidung, wo kein Ausschnittmass steht — und sagt es', () => {
    // Die wichtigste Zusicherung dieser Datei: Schweigen saehe aus wie
    // „passt". Eine Platte ohne Masse ist ungeprueft, nicht kollisionsfrei.
    const befunde = plattenBefunde(
      [
        port('a', { panelPosX: 0.5, panelPosY: 0.5 }),
        port('b', { panelPosX: 0.5, panelPosY: 0.5 }),
      ],
      platte,
    )
    expect(befunde.map((b) => b.art)).not.toContain('ueberschneidung')
    expect(befunde.map((b) => b.art)).toContain('ausschnitt-offen')
  })

  it('zaehlt die Stecker ohne Lage', () => {
    const befunde = plattenBefunde([port('a'), port('b', { panelPosX: 0.1, panelPosY: 0.5 })], platte)
    const offen = befunde.find((b) => b.art === 'ohne-lage')
    expect(offen?.werte).toMatchObject({ n: 1 })
  })

  it('schweigt bei einer sauberen Platte mit Massen', () => {
    const befunde = plattenBefunde(
      [
        port('a', { panelPosX: 0.2, panelPosY: 0.5, ausschnittMm: 24 }),
        port('b', { panelPosX: 0.8, panelPosY: 0.5, ausschnittMm: 24 }),
      ],
      platte,
    )
    expect(befunde).toEqual([])
  })

  it('erfindet in der Quelldatei keine Ausschnitt-Tabelle', () => {
    // Die Gegenprobe zur Zusicherung darueber: eine optionale Angabe nuetzt
    // nichts, wenn daneben „XLR -> 24" steht.
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'types', 'frontplatte.ts'),
      'utf8',
    )
    const ohneKommentare = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(ohneKommentare).not.toMatch(/ausschnittMm\s*[:=]\s*\d/)
  })
})

describe('#879 — der Beschriftungsstreifen', () => {
  it('ordnet die Felder von links nach rechts', () => {
    const felder = streifenFelder(
      [
        port('rechts', { panelPosX: 0.9, panelPosY: 0.5 }),
        port('links', { panelPosX: 0.1, panelPosY: 0.5 }),
      ],
      platte,
      (p) => p.name,
    )
    expect(felder.map((f) => f.portId)).toEqual(['links', 'rechts'])
    expect(felder[0].xMm).toBe(20)
  })

  it('laesst Stecker ohne Lage weg', () => {
    // Ein Streifenfeld ohne Loch darueber verschiebt beim Kleben alles,
    // was danach kommt.
    expect(streifenFelder([port('ohne')], platte, (p) => p.name)).toEqual([])
  })
})

describe('#879 — die gespeicherte Platte', () => {
  it('verwirft eine ohne bekannte Art', () => {
    expect(normalisiereFrontplatte({ art: 'irgendwas' })).toBeUndefined()
    expect(normalisiereFrontplatte({})).toBeUndefined()
  })

  it('wirft unbrauchbare Masse weg, statt sie auf 0 zu setzen', () => {
    const f = normalisiereFrontplatte({ art: 'stagebox', rasterMm: -5, streifenHoeheMm: 12 })
    expect(f).toEqual({ art: 'stagebox', rasterMm: undefined, streifenHoeheMm: 12, notiz: undefined })
  })
})

// ---------------------------------------------------------------------------
// #879 — die Bohrliste geht durch denselben Editor wie jede andere Liste.
// ---------------------------------------------------------------------------
describe('#879 — die Frontplatten-Liste', () => {
  const projekt = (geraete: unknown[]) =>
    ({ equipment: geraete, cables: [], metadata: { name: 'P' } }) as never

  it('führt nur Geräte, die eine Platte SIND', async () => {
    const { frontplattenTable } = await import('../src/renderer/lib/frontplattenListe')
    const t = frontplattenTable(
      projekt([
        {
          id: 'e1',
          name: 'Bühne links',
          inputs: [port('XLR 1', { panelPosX: 0.25, panelPosY: 0.5, ausschnittMm: 24 })],
          outputs: [],
          frontplatte: { art: 'wandfeld' },
          widthMm: 200,
          heightMm: 50,
        },
        { id: 'e2', name: 'Kein Feld', inputs: [port('a')], outputs: [] },
      ]),
    )
    expect(t.rows).toHaveLength(1)
    expect(t.rows[0][0]).toBe('Bühne links')
    expect(t.rows[0][6]).toBe(50)
    expect(t.rows[0][8]).toBe(24)
  })

  it('lässt leer, was nicht angegeben ist — keine 0', () => {
    // Eine 0 auf einer Bohrliste ist die Zahl, nach der jemand bohrt.
    return import('../src/renderer/lib/frontplattenListe').then(({ frontplattenTable }) => {
      const t = frontplattenTable(
        projekt([
          {
            id: 'e1',
            name: 'Dose',
            inputs: [port('XLR 1')],
            outputs: [],
            frontplatte: { art: 'stagebox' },
            widthMm: 100,
            heightMm: 40,
          },
        ]),
      )
      expect(t.rows[0][6]).toBe('')
      expect(t.rows[0][8]).toBe('')
    })
  })
})
