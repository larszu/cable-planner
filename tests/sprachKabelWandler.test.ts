import { describe, expect, it } from 'vitest'
import {
  brauchtWandler,
  findeVorlage,
  findeWandlerVorlage,
  fuehreSprachAuftraegeAus,
  versteheEnde,
  versteheSprache,
  type Schreiber,
} from '../src/renderer/lib/sprachKabel'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { ConnectorType, EquipmentTemplate } from '../src/renderer/types/equipment'

// #1056 Teil 2 — Wandler einfuegen und fehlende Geraete aus der Bibliothek.

const BNC = 'BNC' as ConnectorType
const HDMI = 'HDMI' as ConnectorType

const vorlage = (name: string, category: string, ins: string[], outs: string[]) =>
  ({
    name,
    category,
    inputs: ins.map((c, i) => ({ id: `i${i}`, name: `${c} In ${i + 1}`, connectorType: c, direction: 'in' })),
    outputs: outs.map((c, i) => ({ id: `o${i}`, name: `${c} Out ${i + 1}`, connectorType: c, direction: 'out' })),
  }) as unknown as EquipmentTemplate

const bib = [
  vorlage('Blackmagic Micro Converter SDI to HDMI', 'Converter', ['BNC'], ['HDMI']),
  vorlage('Blackmagic HyperDeck Studio', 'Recorder', ['BNC'], ['BNC']),
  vorlage('Panasonic Beamer PT-RZ120', 'Projector', ['HDMI'], []),
]

const plan = (): CablePlannerProject =>
  ({
    metadata: { name: 'Haus' },
    equipment: [
      {
        id: 'atem', name: 'ATEM Constellation 4K', category: 'Switcher', x: 50, y: 50, width: 100, height: 100,
        inputs: [{ id: 'ai1', name: 'SDI In 1', connectorType: 'BNC', direction: 'in' }],
        outputs: [{ id: 'ao1', name: 'SDI Out 1', connectorType: 'BNC', direction: 'out' }],
      },
      { id: 'cam2', name: 'Kamera 2', x: 50, y: 300, width: 100, height: 100, inputs: [], outputs: [{ id: 'c2o1', name: 'SDI Out', connectorType: 'BNC', direction: 'out' }] },
      { id: 'nec', name: 'NEC MultiSync P402', category: 'Monitor', x: 2050, y: 50, width: 100, height: 100, inputs: [{ id: 'nh1', name: 'HDMI In 1', connectorType: 'HDMI', direction: 'in' }], outputs: [] },
    ],
    cables: [],
    locations: [{ id: 'foyer', name: 'Foyer', x: 2000, y: 0, width: 1000, height: 1000, color: '#000' }],
  }) as unknown as CablePlannerProject

/** Ein Schreiber wie der Store: legt Geraete an, merkt sich die Aufrufe. */
const fakeStore = () => {
  const p = plan()
  const aufrufe: Array<[string, Record<string, unknown>]> = []
  let n = 0
  const schreiben: Schreiber = (w, a) => {
    aufrufe.push([w, a])
    if (w === 'add_device' || w === 'create_device') {
      const gruppen = a.portGroups as Array<{ connector: string }> | undefined
      const t = w === 'add_device' ? bib.find((x) => x.name === a.template)! : vorlage(String(a.name), 'Converter', [gruppen![0].connector], [gruppen![1].connector])
      const id = `neu${++n}`
      p.equipment.push({
        ...t, id, x: Number(a.x ?? 0), y: Number(a.y ?? 0),
        inputs: t.inputs.map((x) => ({ ...x, id: `${id}-${x.id}` })),
        outputs: t.outputs.map((x) => ({ ...x, id: `${id}-${x.id}` })),
      } as never)
      return { ok: true, text: 'added', daten: { deviceId: id } }
    }
    return { ok: true, text: 'connected', daten: {} }
  }
  return { p, aufrufe, schreiben }
}

describe('#1056 Teil 2 — Wandler', () => {
  it('SDI auf HDMI braucht einen Wandler, SDI auf SDI nicht', () => {
    expect(brauchtWandler(BNC, HDMI)).toBe(true)
    expect(brauchtWandler(BNC, BNC)).toBe(false)
  })

  it('findet die passende Katalogvorlage, aber keinen Rekorder', () => {
    expect(findeWandlerVorlage(bib, BNC, HDMI)?.name).toContain('Micro Converter')
    expect(findeWandlerVorlage(bib, BNC, BNC)).toBeNull()
  })

  it('ATEM → Wandler → NEC: Vorlage platziert, zwei Kabel in einem connect_many', () => {
    const s = fakeStore()
    const k = versteheSprache(s.p, 'SDI 1 vom ATEM in den NEC im Foyer').kabel[0]
    const r = fuehreSprachAuftraegeAus([{ von: k.von, nach: k.nach, wandler: true, ersetzen: false }], s.schreiben, () => s.p, bib)
    expect(r.ok).toBe(true)
    expect(s.aufrufe.map((a) => a[0])).toEqual(['add_device', 'connect_many'])
    expect(s.aufrufe[0][1].template).toBe('Blackmagic Micro Converter SDI to HDMI')
    expect(s.aufrufe[1][1].cables).toEqual([
      { fromDeviceId: 'atem', fromPortId: 'ao1', toDeviceId: 'neu1', toPortId: 'neu1-i0' },
      { fromDeviceId: 'neu1', fromPortId: 'neu1-o0', toDeviceId: 'nec', toPortId: 'nh1' },
    ])
  })

  it('ohne Katalogvorlage: generischer Wandler mit den beiden Steckern', () => {
    const s = fakeStore()
    const k = versteheSprache(s.p, 'SDI 1 vom ATEM in den NEC im Foyer').kabel[0]
    fuehreSprachAuftraegeAus([{ von: k.von, nach: k.nach, wandler: true, ersetzen: false }], s.schreiben, () => s.p, [])
    expect(s.aufrufe[0][0]).toBe('create_device')
    expect(s.aufrufe[0][1].portGroups).toEqual([
      { direction: 'in', count: 1, connector: 'BNC', labelPrefix: 'In' },
      { direction: 'out', count: 1, connector: 'HDMI', labelPrefix: 'Out' },
    ])
    expect((s.aufrufe[1][1].cables as unknown[]).length).toBe(2)
  })

  it('Wandler abgewaehlt: ein direktes Kabel', () => {
    const s = fakeStore()
    const k = versteheSprache(s.p, 'SDI 1 vom ATEM in den NEC im Foyer').kabel[0]
    fuehreSprachAuftraegeAus([{ von: k.von, nach: k.nach, wandler: false, ersetzen: false }], s.schreiben, () => s.p, bib)
    expect(s.aufrufe.map((a) => a[0])).toEqual(['connect_many'])
  })
})

describe('#1056 Teil 2 — Geraet aus der Bibliothek', () => {
  it('fehlendes Geraet → Bibliotheksvorlage, auch ueber die Gattung', () => {
    expect(findeVorlage(bib, versteheEnde('den Beamer', []))?.name).toBe('Panasonic Beamer PT-RZ120')
    expect(findeVorlage(bib, versteheEnde('the projector', []))?.name).toBe('Panasonic Beamer PT-RZ120')
    expect(findeVorlage(bib, versteheEnde('Toaster', []))).toBeUndefined()
  })

  it('platziert die Vorlage und verkabelt den gewaehlten Port', () => {
    const s = fakeStore()
    const k = versteheSprache(s.p, 'Kamera 2 auf den HyperDeck').kabel[0]
    expect(k.nach.kandidaten).toEqual([])
    const t = findeVorlage(bib, k.nach.wunsch)!
    const r = fuehreSprachAuftraegeAus([{ von: k.von, nach: { vorlage: t, wunsch: k.nach.wunsch }, wandler: false, ersetzen: false }], s.schreiben, () => s.p, bib)
    expect(r.ok).toBe(true)
    expect(s.aufrufe[0]).toEqual(['add_device', expect.objectContaining({ template: 'Blackmagic HyperDeck Studio' })])
    expect(s.aufrufe[1][1].cables).toEqual([{ fromDeviceId: 'cam2', fromPortId: 'c2o1', toDeviceId: 'neu1', toPortId: 'neu1-i0' }])
  })
})
