import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  ausMm,
  mmPosition,
  normalisiereFrontplatte,
  plattenBefunde,
  streifenFelder,
  streifenReihen,
} from '../src/renderer/types/frontplatte'
import { plattenPorts, plattenSeite } from '../src/renderer/lib/patchPanel'
import { buildFrontplattenHtml } from '../src/renderer/lib/frontplattenBlatt'
import type { EquipmentItem } from '../src/renderer/types/equipment'
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

// Gefunden am Beispiel „3 PTZ Saal → Regie": ein Wandfeld mit BNC oben und
// RJ45 darunter druckte beide Namen an dieselbe Stelle des einen Streifens.
describe('Streifen je Steckerreihe', () => {
  const zweiReihen = [
    port('BNC 1', { panelPosX: 0.2, panelPosY: 0.3 }),
    port('BNC 2', { panelPosX: 0.6, panelPosY: 0.3 }),
    port('RJ45 1', { panelPosX: 0.2, panelPosY: 0.7 }),
    port('RJ45 2', { panelPosX: 0.6, panelPosY: 0.71 }),
  ]

  it('bildet eine Reihe je Hoehe, von oben nach unten, links nach rechts', () => {
    const reihen = streifenReihen(zweiReihen, platte, (p) => p.name)
    expect(reihen.map((r) => r.map((f) => f.portId))).toEqual([
      ['BNC 1', 'BNC 2'],
      ['RJ45 1', 'RJ45 2'],
    ])
  })

  it('druckt je Reihe einen eigenen Streifen', () => {
    const html = buildFrontplattenHtml({ titel: 'WAF', platte, ports: zweiReihen, streifenHoeheMm: 9 })
    expect(html.match(/class="streifen"/g)).toHaveLength(2)
    expect(html).toContain('Row 2 of 2')
  })

  it('bleibt bei einer Reihe bei einem Streifen ohne Reihen-Zeile', () => {
    const html = buildFrontplattenHtml({ titel: 'WAF', platte, ports: zweiReihen.slice(0, 2), streifenHoeheMm: 9 })
    expect(html.match(/class="streifen"/g)).toHaveLength(1)
    expect(html).not.toContain('Row 1')
  })
})

// Ein Wandfeld hat vorne Buchsen und hinten die Hausstrecke. Der Editor
// verlangte fuer beide Seiten eine Lage auf der Platte.
describe('Seite auf der Platte', () => {
  const wandfeld = (over: Partial<EquipmentItem> = {}): EquipmentItem =>
    ({
      id: 'waf',
      name: 'WAF-EG-01',
      category: 'Sonstiges',
      frontplatte: { art: 'wandfeld' },
      inputs: [port('v1', { panelPosX: 0.2, panelPosY: 0.5 }), port('v2', { panelPosX: 0.6, panelPosY: 0.5 })],
      outputs: [port('h1'), port('h2')],
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      ...over,
    }) as EquipmentItem

  it('nimmt die Seite, deren Stecker schon eine Lage haben', () => {
    expect(plattenPorts(wandfeld()).map((p) => p.id)).toEqual(['v1', 'v2'])
    const umgekehrt = wandfeld({ inputs: [port('h1'), port('h2')], outputs: [port('v1', { panelPosX: 0.2, panelPosY: 0.5 }), port('v2')] })
    expect(plattenSeite(umgekehrt)).toBe('outputs')
  })

  it('folgt der ausdruecklichen Angabe', () => {
    expect(plattenPorts(wandfeld({ frontplatte: { art: 'wandfeld', seite: 'outputs' } })).map((p) => p.id)).toEqual(['h1', 'h2'])
  })

  it('meldet die Rueckseite nicht als „ohne Lage"', () => {
    const befunde = plattenBefunde(plattenPorts(wandfeld()), platte)
    expect(befunde.some((b) => b.art === 'ohne-lage')).toBe(false)
  })

  it('zeigt bei einem Geraet, das nicht durchleitet, alle Ports', () => {
    const stagebox = wandfeld({ frontplatte: { art: 'sonstige' }, outputs: [port('x')] })
    expect(plattenPorts(stagebox)).toHaveLength(3)
  })

  it('merkt sich die Seite beim Laden und verwirft Unsinn', () => {
    expect(normalisiereFrontplatte({ art: 'wandfeld', seite: 'outputs' })?.seite).toBe('outputs')
    expect(normalisiereFrontplatte({ art: 'wandfeld', seite: 'links' })?.seite).toBeUndefined()
  })
})
