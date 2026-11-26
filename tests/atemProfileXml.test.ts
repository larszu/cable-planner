import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import { readAtemProfileXml, scanXml, writeAtemProfileXml } from '../src/renderer/lib/atemProfileXml'
import { buildInnerMatrix, normaliseSwitching, routePatch, setKeyer, switchingProfileFor } from '../src/renderer/lib/switching'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// #1240 Stufe 4 — ATEM-Setup-Datei: alles lesen, was das Modell kennt, und
// beim Schreiben nur das aendern, was im Plan geaendert wurde.

const XML = readFileSync(resolve(__dirname, 'fixtures/atem/setup-2me.xml'), 'utf8')

const device = (name = 'Blackmagic ATEM 2 M/E Constellation HD'): EquipmentItem => {
  const e = BLACKMAGIC_CATALOG.find((x) => x.template.name === name)
  if (!e) throw new Error(name)
  const t = e.template
  return {
    id: 'atem',
    name: t.name,
    category: t.category,
    x: 0,
    y: 0,
    deviceTypeId: e.deviceTypeId,
    inputs: (t.inputs ?? []).map((p, i) => ({ ...p, id: `atem-in-${i}` })),
    outputs: (t.outputs ?? []).map((p, i) => ({ ...p, id: `atem-out-${i}` })),
  } as unknown as EquipmentItem
}

const geladen = () => {
  const d = device()
  const r = readAtemProfileXml(d, XML, 'setup-2me.xml')
  return { d: { ...d, ...r.patch } as EquipmentItem, r }
}

/** Einzige Unterschiede zwischen zwei Texten, zeilenweise. */
const diff = (a: string, b: string) => {
  const x = a.split('\n')
  const y = b.split('\n')
  return y.map((l, i) => [x[i], l] as const).filter(([o, n]) => o !== n)
}

describe('ATEM-Setup-Datei lesen', () => {
  it('bringt alle Abschnitte ins Modell', () => {
    const { d, r } = geladen()
    const s = d.switching!
    expect(s.routes?.['me:1/pgm']).toBe('in:1')
    expect(s.routes?.['me:1/pvw']).toBe('in:2')
    expect(s.routes?.['me:2/pgm']).toBe('ss:1')
    expect(s.routes?.['me:1/key:1/fill']).toBe('mp:1')
    expect(s.routes?.['me:1/key:2/fill']).toBe('in:4')
    expect(s.keyers?.['me:1/key:1']).toEqual({ onAir: true, type: 'luma' })
    expect(s.keyers?.['me:1/key:2']?.type).toBe('dve')
    expect(s.keyers?.['dsk:2']?.onAir).toBe(true)
    expect(s.routes?.['dsk:1/fill']).toBe('mp:2')
    expect(s.routes?.['ss:1/box:1']).toBe('me:2')
    expect(s.routes?.['ss:1/box:2']).toBe('in:2')
    expect(s.routes?.['ss:1/art-fill']).toBe('color:1')
    expect(s.routes?.['mp:1/still']).toBe('still:3')
    expect(s.routes?.['mp:2/still']).toBeUndefined()
    const p = s.atemProfile!
    expect(p.product).toBe('ATEM 2 M/E Constellation HD')
    expect(p.inputs?.['1']).toEqual({ shortName: 'CAM1', longName: 'Kamera 1 & Ton' })
    expect(p.colors?.['2']).toEqual({ hue: 27.5, saturation: 100, luma: 50 })
    expect(p.stills?.['3']).toEqual({ name: 'Bauchbinde', path: 'ATEM Media Pool/Bauchbinde.png' })
    expect(p.boxes).toMatchObject({ 'ss:1/box:1': true, 'ss:1/box:3': false })
    expect(p.macros?.['2']).toEqual({ name: 'Abspann', description: 'Ende' })
    expect(p.mixMinus).toEqual({ '1': 'ProgramOut', '2': 'MixMinus' })
    expect(d.atemMvConfig?.multiViewers[0].layout).toBe(12)
    expect(d.atemAudioConfig?.matrix?.outputs).toHaveLength(2)
    expect(s.routes?.['aux:1']).toBe('me:1')
    // Clean Feed (7001), Vorschau-Ausgang (10011) und Key-Ausgang des Mediaplayers (3011) kennt das Modell nicht.
    expect(r.unmapped).toEqual(expect.arrayContaining([3011, 7001, 10011]))
  })

  it('Aux auf einen externen Eingang landet am Geraet, nicht doppelt', () => {
    const { d } = geladen()
    const matrix = buildInnerMatrix(d, switchingProfileFor(d), d.switching)
    const aux2 = matrix.byId.get('aux:2')
    if (aux2?.portId) {
      expect(d.plannedCrosspoints?.[aux2.portId]).toBe(matrix.byId.get('in:3')?.portId)
      expect(d.switching?.routes?.['aux:2']).toBeUndefined()
    } else {
      expect(d.switching?.routes?.['aux:2']).toBe('in:3')
    }
  })

  it('uebersteht die Heilung beim Laden', () => {
    const { d } = geladen()
    const healed = normaliseSwitching(d, JSON.parse(JSON.stringify(d.switching)))
    expect(healed?.atemProfile?.rawXml).toBe(XML)
    expect(healed?.routes?.['ss:1/box:1']).toBe('me:2')
  })

  it('lehnt eine Datei ohne Profil ab', () => {
    expect(() => readAtemProfileXml(device(), '<Foo/>')).toThrow()
    expect(() => scanXml('<Profile><A></Profile>')).toThrow()
  })
})

describe('ATEM-Setup-Datei schreiben', () => {
  it('Rundlauf ohne Aenderung ist byte-gleich', () => {
    const { d } = geladen()
    expect(writeAtemProfileXml(d)).toBe(XML)
  })

  it('gezielte Aenderungen landen an der richtigen Stelle', () => {
    const { d } = geladen()
    const matrix = buildInnerMatrix(d, switchingProfileFor(d), d.switching)
    let e: EquipmentItem = { ...d, ...routePatch(d, matrix, 'me:1/pgm', 'in:3') }
    e = { ...e, ...routePatch(e, matrix, 'ss:1/box:4', 'in:5') }
    e = { ...e, switching: setKeyer(e.switching, 'dsk:1', { onAir: true }) }
    e = {
      ...e,
      switching: {
        ...e.switching,
        atemProfile: {
          ...e.switching!.atemProfile!,
          inputs: { ...e.switching!.atemProfile!.inputs, '2': { shortName: 'C2', longName: 'Kran <links>' } },
          macros: { ...e.switching!.atemProfile!.macros, '1': { name: 'Start' } },
        },
      },
    }
    const mv = e.atemMvConfig!.multiViewers[0]
    e = {
      ...e,
      atemMvConfig: { multiViewers: [{ ...mv, windows: mv.windows.map((w) => (w.sourceId === 5 ? { ...w, sourceId: 6001 } : w)) }] },
      atemAudioConfig: {
        ...e.atemAudioConfig!,
        matrix: {
          ...e.atemAudioConfig!.matrix!,
          outputs: e.atemAudioConfig!.matrix!.outputs.map((o) => (o.id === 2 ? { ...o, sourceId: 1 } : o)),
        },
      },
    }
    const out = writeAtemProfileXml(e)
    const changed = diff(XML, out).map(([, n]) => n.trim())
    expect(changed).toEqual([
      '<Program input="3"/>',
      '<DownstreamKey index="0" fillSource="3020" keySource="3021" rate="25" onAir="True" tie="False"/>',
      '<Box index="3" enabled="False" inputSource="5" xPosition="8" yPosition="-4.5" size="0.5" cropped="False"/>',
      '<Input id="2" shortName="C2" longName="Kran &lt;links&gt;" externalPortType="SDI"/>',
      '<Window index="6" input="6001" vuMeterEnabled="False" safeAreaEnabled="False"/>',
      '<Output id="2" sourceId="1" name="MADI 2"/>',
      '<Macro index="0" name="Start" description="">',
    ])
    // und die Datei liest sich wieder
    const again = readAtemProfileXml(device(), out)
    expect(again.patch.switching.routes?.['me:1/pgm']).toBe('in:3')
  })

  it('ohne geladene Datei entsteht ein Geruest mit den bekannten Abschnitten', () => {
    const d = device()
    const matrix = buildInnerMatrix(d, switchingProfileFor(d), undefined)
    const e = { ...d, ...routePatch(d, matrix, 'me:1/pgm', 'in:2') }
    const out = writeAtemProfileXml(e)
    expect(out).toContain('<MixEffectBlock index="1">')
    expect(out).toContain('<Program input="2"/>')
    const back = readAtemProfileXml(device(), out)
    expect(back.patch.switching.routes?.['me:1/pgm']).toBe('in:2')
  })
})
