import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MCP_SCHREIBWERKZEUGE,
  MCP_ZERSTOEREND,
  fuehreSchreibwerkzeugAus,
  type Aktionen,
} from '../src/renderer/lib/mcpSchreiben'
import { mitEintrag, MCP_LOG_MAX, normalisiereMcpEintrag } from '../src/renderer/types/mcpLog'
import type { CablePlannerProject } from '../src/renderer/types/project'

// ---------------------------------------------------------------------------
// #873 Stufe 2 — was der Assistent AENDERN darf.
//
// Die Zusicherungen hier sind nicht „tut es das Richtige", sondern „tut es
// nichts anderes": die Aktionen werden hereingereicht, also laesst sich
// messen, WELCHE aufgerufen wird und mit welchen Werten. Ein Modul, das sich
// den Store selbst holt, koennte man das nicht fragen.
// ---------------------------------------------------------------------------

const plan = (): CablePlannerProject =>
  ({
    metadata: { name: 'Show' },
    equipment: [
      {
        id: 'cam',
        name: 'Kamera 1',
        inputs: [],
        outputs: [{ id: 'cam-out', name: 'SDI Out', type: 'BNC', connectorType: 'BNC' }],
      },
      {
        id: 'mon',
        name: 'Monitor',
        inputs: [{ id: 'mon-in', name: 'HDMI In', type: 'HDMI', connectorType: 'HDMI' }],
        outputs: [],
      },
      {
        id: 'mix',
        name: 'Mischer',
        inputs: [{ id: 'mix-in', name: 'In 1', type: 'BNC', connectorType: 'BNC' }],
        outputs: [],
      },
    ],
    cables: [
      {
        id: 'c1',
        cableNumber: 'K001',
        name: 'Kamera → Mischer',
        type: 'BNC',
        fromEquipmentId: 'cam',
        fromPortId: 'cam-out',
        toEquipmentId: 'mix',
        toPortId: 'mix-in',
      },
    ],
  }) as unknown as CablePlannerProject

const aktionen = (
  bulk: { created: number; skipped: number; skippedReasons: string[] } = {
    created: 1,
    skipped: 0,
    skippedReasons: [],
  },
) => {
  const spy = {
    addCablesBulk: vi.fn(() => bulk),
    deleteCable: vi.fn(),
    updateCable: vi.fn(),
    updateEquipment: vi.fn(),
  }
  return spy as unknown as Aktionen & typeof spy
}

describe('#873 — der Umfang', () => {
  it('kennt genau vier schreibende Werkzeuge', () => {
    expect([...MCP_SCHREIBWERKZEUGE]).toEqual([
      'connect_ports',
      'disconnect_cable',
      'set_cable',
      'rename_device',
    ])
  })

  it('nur das Entfernen ist zerstoerend', () => {
    expect([...MCP_ZERSTOEREND]).toEqual(['disconnect_cable'])
  })

  it('bietet KEIN Schalten an — kein Videohub, kein ATEM', () => {
    // #873 sagt den Grund: „ein Modell, das waehrend der Sendung Routing
    // schaltet, ist ein Risiko ohne Gegenwert."
    const src = readFileSync(
      resolve(__dirname, '..', 'src', 'renderer', 'lib', 'mcpSchreiben.ts'),
      'utf8',
    )
    const ohneKommentare = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(ohneKommentare).not.toMatch(/videohub|atem|crosspoint|route\(/i)
  })

  it('kann kein Geraet loeschen', () => {
    const a = aktionen()
    const antwort = fuehreSchreibwerkzeugAus(plan(), a, 'delete_device', { deviceId: 'cam' })
    expect(antwort.ok).toBe(false)
    expect(a.deleteCable).not.toHaveBeenCalled()
  })
})

describe('#873 — verbinden', () => {
  it('legt das Kabel ueber die Store-Aktion an', () => {
    const a = aktionen()
    const antwort = fuehreSchreibwerkzeugAus(plan(), a, 'connect_ports', {
      fromDeviceId: 'Kamera 1',
      fromPortId: 'SDI Out',
      toDeviceId: 'Mischer',
      toPortId: 'In 1',
      length: 12,
    })
    expect(antwort.ok).toBe(true)
    expect(a.addCablesBulk).toHaveBeenCalledTimes(1)
    const entwurf = a.addCablesBulk.mock.calls[0][0][0]
    expect(entwurf).toMatchObject({
      fromEquipmentId: 'cam',
      fromPortId: 'cam-out',
      toEquipmentId: 'mix',
      toPortId: 'mix-in',
      length: 12,
    })
  })

  it('sagt es, wenn keine Laenge genannt wurde — die 0 ist keine Messung', () => {
    const antwort = fuehreSchreibwerkzeugAus(plan(), aktionen(), 'connect_ports', {
      fromDeviceId: 'cam',
      fromPortId: 'cam-out',
      toDeviceId: 'mix',
      toPortId: 'mix-in',
    })
    expect(antwort.daten.lengthStated).toBe(false)
    expect(antwort.text).toContain('gap, not a measurement')
  })

  it('sagt bei unpassenden Enden, was stattdessen ginge', () => {
    // Das Kriterium aus #873. Eine Ablehnung ohne Ausweg schickt das Modell
    // in eine Schleife — es versucht dasselbe noch einmal.
    const a = aktionen({ created: 0, skipped: 1, skippedReasons: ['Ziel-Port belegt.'] })
    const antwort = fuehreSchreibwerkzeugAus(plan(), a, 'connect_ports', {
      fromDeviceId: 'cam',
      fromPortId: 'cam-out',
      toDeviceId: 'mon',
      toPortId: 'mon-in',
    })
    expect(antwort.ok).toBe(false)
    expect(antwort.text).toContain('Ziel-Port belegt.')
    expect(antwort.text.toLowerCase()).toMatch(/converter|cable fits/)
  })

  it('lehnt einen Port ab, den es nicht gibt — ohne die Aktion zu rufen', () => {
    const a = aktionen()
    const antwort = fuehreSchreibwerkzeugAus(plan(), a, 'connect_ports', {
      fromDeviceId: 'cam',
      fromPortId: 'gibt-es-nicht',
      toDeviceId: 'mix',
      toPortId: 'mix-in',
    })
    expect(antwort.ok).toBe(false)
    expect(a.addCablesBulk).not.toHaveBeenCalled()
  })
})

describe('#873 — trennen, aendern, umbenennen', () => {
  it('findet das Kabel ueber Id, Nummer ODER Name', () => {
    for (const id of ['c1', 'K001', 'Kamera → Mischer']) {
      const a = aktionen()
      expect(fuehreSchreibwerkzeugAus(plan(), a, 'disconnect_cable', { cableId: id }).ok).toBe(true)
      expect(a.deleteCable).toHaveBeenCalledWith('c1')
    }
  })

  it('setzt nur die genannten Felder', () => {
    const a = aktionen()
    fuehreSchreibwerkzeugAus(plan(), a, 'set_cable', { cableId: 'K001', length: 7.5 })
    expect(a.updateCable).toHaveBeenCalledWith('c1', { length: 7.5 })
  })

  it('meldet einen Aufruf, der nichts aendert, als Fehlschlag', () => {
    // Stiller Erfolg waere schlimmer: das Modell haette „erledigt" gemeldet.
    const a = aktionen()
    const antwort = fuehreSchreibwerkzeugAus(plan(), a, 'set_cable', { cableId: 'K001' })
    expect(antwort.ok).toBe(false)
    expect(a.updateCable).not.toHaveBeenCalled()
  })

  it('laesst kein Geraet ohne Namen zurueck', () => {
    const a = aktionen()
    const antwort = fuehreSchreibwerkzeugAus(plan(), a, 'rename_device', {
      deviceId: 'cam',
      name: '   ',
    })
    expect(antwort.ok).toBe(false)
    expect(a.updateEquipment).not.toHaveBeenCalled()
  })

  it('benennt um', () => {
    const a = aktionen()
    fuehreSchreibwerkzeugAus(plan(), a, 'rename_device', { deviceId: 'Kamera 1', name: 'Kamera L' })
    expect(a.updateEquipment).toHaveBeenCalledWith('cam', { name: 'Kamera L' })
  })
})

describe('#873 — der Nachweis', () => {
  it('haelt die letzten Zeilen und wirft die aeltesten', () => {
    let log = [] as ReturnType<typeof mitEintrag>
    for (let i = 0; i < MCP_LOG_MAX + 5; i += 1) {
      log = mitEintrag(log, { id: `e${i}`, zeit: '2026-09-18T19:00:00.000Z', werkzeug: 'x', text: `${i}` })
    }
    expect(log).toHaveLength(MCP_LOG_MAX)
    expect(log[log.length - 1].text).toBe(String(MCP_LOG_MAX + 4))
  })

  it('verwirft eine Zeile ohne Zeitpunkt', () => {
    // Ohne ihn ist es kein Nachweis, sondern eine Behauptung.
    expect(normalisiereMcpEintrag({ id: 'a', werkzeug: 'set_cable' })).toBeUndefined()
    expect(
      normalisiereMcpEintrag({ id: 'a', zeit: '2026-09-18T19:00:00.000Z', werkzeug: 'set_cable' }),
    ).toBeTruthy()
  })
})
