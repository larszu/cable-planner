import { describe, expect, it } from 'vitest'
import {
  SPECTRUM_SOURCE_LABEL,
  buildSpectrumPlan,
  collectTransmitters,
  conflictParticipants,
  parseFreqMhz,
  spectrumTable,
} from '../src/renderer/lib/spectrumPlan'
import { deriveRig } from '../src/renderer/lib/wirelessRig'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import type { CablePlannerProject } from '../src/renderer/types/project'
import analyseQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import rigDialogQuelle from '../src/renderer/components/Wireless/WirelessRigDialog.tsx?raw'

// ---------------------------------------------------------------------------
// EIN Spektrum-Plan (Bedarf 95, P2).
//
//   > The right boundary is ONE WIRELESS PLAN, not separate RF and comms
//   > features — they share spectrum, antennas and the person wearing them.
//
// DER BEFUND IM EIGENEN HAUS, gemessen 2026-09-06: der cable-planner rechnete
// Intermodulation ZWEIMAL und beide Male auf der halben Menge. `deriveRig`
// sah nur die Rig-Kanaele, der RF-Reiter nur die drahtlosen Kabel — und der
// Reiter rechnete die IM3-Schleife von Hand nach, mit einer eigenen
// Konstante. Eine Mikrofonstrecke und ein Kameralink auf benachbarten
// Frequenzen begegneten sich in keiner der beiden.
//
// Intermodulation auf der halben Senderliste ist schlimmer als gar keine:
// keine Rechnung sagt nichts, eine halbe sagt „frei".
// ---------------------------------------------------------------------------

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as unknown as CablePlannerProject

const geraet = (id: string, name: string) =>
  ({ id, name, x: 0, y: 0, width: 10, height: 10, category: 'Kamera', inputs: [], outputs: [] }) as never

const funk = (id: string, name: string, from: string, to: string, frequency?: string) =>
  ({
    id,
    name,
    type: 'sdi',
    length: 0,
    color: '#fff',
    fromEquipmentId: from,
    fromPortId: 'a',
    toEquipmentId: to,
    toPortId: 'b',
    notes: '',
    wireless: true,
    ...(frequency ? { frequency } : {}),
  }) as never

describe('Bedarf 95 — die Frequenz-Zerlegung ist erreichbar', () => {
  it('liest MHz, GHz, kHz und die nackte Zahl', () => {
    expect(parseFreqMhz('606.4 MHz')).toBe(606.4)
    expect(parseFreqMhz('5.8 GHz')).toBe(5800)
    expect(parseFreqMhz('600000 kHz')).toBe(600)
    // Ohne Einheit gilt MHz: so schreiben es Funk-Datenblaetter, und eine
    // nackte 614 ist in diesem Feld nie 614 Hz.
    expect(parseFreqMhz('614')).toBe(614)
    expect(parseFreqMhz('  614  ')).toBe(614)
  })

  it('gibt null statt einer geratenen Zahl', () => {
    expect(parseFreqMhz(undefined)).toBeNull()
    expect(parseFreqMhz('')).toBeNull()
    expect(parseFreqMhz('Band G')).toBeNull()
  })
})

describe('Bedarf 95 — alles, was funkt, in EINER Liste', () => {
  const gemischt = () =>
    projekt({
      equipment: [geraet('cam', 'Kamera 2'), geraet('rx', 'Empfaenger')],
      cables: [funk('l1', 'Kamera 2 Rueckweg', 'cam', 'rx', '606.5 MHz')],
      wirelessRig: { channels: [{ id: 'c1', label: 'Lead Vox', frequencyMhz: 606.4 }] },
    } as never)

  it('sammelt Rig-Kanaele UND Funkstrecken', () => {
    const { entries } = collectTransmitters(gemischt())
    expect(entries.map((e) => e.source)).toEqual(['rig', 'link'])
    expect(entries.map((e) => e.mhz)).toEqual([606.4, 606.5])
  })

  it('findet den Konflikt, den vorher KEINE der beiden Rechnungen sah', () => {
    // 606,400 gegen 606,500 — 0,1 MHz Abstand. Der Rig sah den Link nicht,
    // der Link-Reiter sah den Rig nicht.
    const plan = buildSpectrumPlan(gemischt())
    expect(plan.conflicts.length).toBeGreaterThan(0)
    const beteiligte = conflictParticipants(plan, plan.conflicts[0]).map((e) => e.source).sort()
    expect(beteiligte).toEqual(['link', 'rig'])
  })

  it('nennt bei jedem Beteiligten die Herkunft', () => {
    const plan = buildSpectrumPlan(gemischt())
    const wer = conflictParticipants(plan, plan.conflicts[0])
    expect(wer.map((e) => e.label).sort()).toEqual(['Kamera 2 Rueckweg', 'Lead Vox'])
  })

  it('nennt bei der Funkstrecke die beiden Enden als Traeger', () => {
    const { entries } = collectTransmitters(gemischt())
    expect(entries.find((e) => e.source === 'link')?.carrier).toBe('Kamera 2 → Empfaenger')
  })

  it('wiederholt beim Rig-Kanal die Rolle NICHT — der Name ist sie schon', () => {
    const { entries } = collectTransmitters(gemischt())
    expect(entries.find((e) => e.source === 'rig')?.carrier).toBeUndefined()
  })
})

describe('Bedarf 95 — wer traegt Beltpack 7', () => {
  it('nennt den Intercom-Teilnehmer statt der Geraetenamen', () => {
    // Der Bedarf verlangt es woertlich („who carries beltpack 7"), und der
    // Plan weiss es: der Teilnehmer haengt ueber `equipmentId` am Geraet.
    const p = projekt({
      equipment: [geraet('bp7', 'Beltpack 7'), geraet('base', 'Basis')],
      cables: [funk('l1', 'Comms 7', 'bp7', 'base', '470 MHz')],
      greengoConfig: {
        systemName: 'S',
        multicastAddress: '239.1.160.1',
        sampleRate: 48000,
        groups: [],
        users: [{ id: 7, name: 'Followspot 1', groupIds: [], equipmentId: 'bp7' }],
      },
    } as never)
    expect(collectTransmitters(p).entries[0].carrier).toBe('Followspot 1')
  })

  it('nennt BEIDE, wenn zwei Teilnehmer an einem Geraet haengen', () => {
    const p = projekt({
      equipment: [geraet('bp', 'Beltpack'), geraet('base', 'Basis')],
      cables: [funk('l1', 'Comms', 'bp', 'base', '470 MHz')],
      greengoConfig: {
        systemName: 'S',
        multicastAddress: '239.1.160.1',
        sampleRate: 48000,
        groups: [],
        users: [
          { id: 1, name: 'Schicht A', groupIds: [], equipmentId: 'bp' },
          { id: 2, name: 'Schicht B', groupIds: [], equipmentId: 'bp' },
        ],
      },
    } as never)
    expect(collectTransmitters(p).entries[0].carrier).toBe('Schicht A, Schicht B')
  })

  it('faellt auf die Geraetenamen zurueck, wenn niemand zugeordnet ist', () => {
    const p = projekt({
      equipment: [geraet('a', 'A'), geraet('b', 'B')],
      cables: [funk('l1', 'Strecke', 'a', 'b', '470 MHz')],
    })
    expect(collectTransmitters(p).entries[0].carrier).toBe('A → B')
  })
})

describe('Bedarf 95 — wer keine Frequenz hat, steht daneben statt zu fehlen', () => {
  it('zaehlt drahtlose Strecken ohne Frequenz', () => {
    const p = projekt({
      equipment: [geraet('a', 'A'), geraet('b', 'B')],
      cables: [funk('l1', 'Ohne Frequenz', 'a', 'b')],
    })
    const plan = buildSpectrumPlan(p)
    expect(plan.entries).toHaveLength(0)
    expect(plan.withoutFrequency).toEqual(['Ohne Frequenz'])
  })

  it('zaehlt Rig-Kanaele ohne Frequenz', () => {
    const p = projekt({ wirelessRig: { channels: [{ id: 'c1', label: 'Backup' }] } } as never)
    expect(buildSpectrumPlan(p).withoutFrequency).toEqual(['Backup'])
  })

  it('ein Kabel ohne `wireless` und ohne Frequenz zaehlt gar nicht mit', () => {
    const p = projekt({
      equipment: [geraet('a', 'A'), geraet('b', 'B')],
      cables: [
        {
          id: 'k1',
          name: 'SDI',
          type: 'sdi',
          length: 5,
          color: '#fff',
          fromEquipmentId: 'a',
          fromPortId: 'x',
          toEquipmentId: 'b',
          toPortId: 'y',
          notes: '',
        } as never,
      ],
    })
    const plan = buildSpectrumPlan(p)
    expect(plan.entries).toHaveLength(0)
    expect(plan.withoutFrequency).toHaveLength(0)
  })
})

describe('Bedarf 95 — die Rig-Ansicht sieht die fremden Sender', () => {
  it('meldet einen Konflikt gegen einen Sender ausserhalb des Rigs', () => {
    const rig = { channels: [{ id: 'c1', label: 'Lead Vox', frequencyMhz: 606.4 }] }
    const ohne = deriveRig(rig as never)
    const mit = deriveRig(rig as never, undefined, [
      { id: 'link:l1', label: 'Kamera 2 Rueckweg', mhz: 606.5 },
    ])
    expect(ohne.rfConflicts).toHaveLength(0)
    expect(mit.rfConflicts.length).toBeGreaterThan(0)
  })

  it('bleibt ohne Kontext beim alten Verhalten', () => {
    const rig = {
      channels: [
        { id: 'c1', label: 'A', frequencyMhz: 606.4 },
        { id: 'c2', label: 'B', frequencyMhz: 606.45 },
      ],
    }
    expect(deriveRig(rig as never).rfConflicts.length).toBeGreaterThan(0)
  })
})

describe('Bedarf 95 — das Blatt und das Register', () => {
  it('sortiert nach Frequenz und nennt die Herkunft', () => {
    const p = projekt({
      equipment: [geraet('a', 'A'), geraet('b', 'B')],
      cables: [funk('l1', 'Link', 'a', 'b', '500 MHz')],
      wirelessRig: { channels: [{ id: 'c1', label: 'Vox', frequencyMhz: 400 }] },
    } as never)
    const tab = spectrumTable(buildSpectrumPlan(p))
    expect(tab.headers).toEqual(['Frequenz (MHz)', 'Was', 'Herkunft', 'Wer / wo'])
    expect(tab.rows.map((r) => r[0])).toEqual([400, 500])
    expect(tab.rows[0][2]).toBe(SPECTRUM_SOURCE_LABEL.rig)
    expect(tab.rows[1][2]).toBe(SPECTRUM_SOURCE_LABEL.link)
  })

  it('steht im Register mit Stand und Beschriftung', () => {
    expect(typeof DOCUMENT_STANDS['spektrum-plan']).toBe('function')
    expect(DOCUMENT_LABELS['spektrum-plan']).toBe('Spektrum-Plan')
  })

  it('setzt keinen Platzhalter, wo kein Traeger steht', () => {
    const p = projekt({ wirelessRig: { channels: [{ id: 'c1', label: 'Vox', frequencyMhz: 400 }] } } as never)
    expect(spectrumTable(buildSpectrumPlan(p)).rows[0][3]).toBe('')
  })
})

describe('Bedarf 95 — verdrahtet', () => {
  it('der RF-Reiter rechnet nicht mehr selbst', () => {
    // Die Schleife im Komponenten-Rumpf ist der ganze Befund. Sie prueft
    // deshalb auf ihre Form, nicht auf ein Wort.
    expect(analyseQuelle).toMatch(/buildSpectrumPlan\(project\)/)
    expect(analyseQuelle).not.toMatch(/2 \* freqs\[i\]\.mhz - freqs\[j\]\.mhz/)
  })

  it('der Frei-Frequenz-Vorschlag kennt ALLE Sender', () => {
    // Ein Vorschlag, der die Rig-Kanaele nicht kennt, schlaegt eine besetzte
    // Frequenz vor.
    expect(analyseQuelle).toContain('spectrum.entries.map((e) => e.mhz)')
  })

  it('der Umfang der Rechnung steht ueber ihrem Ergebnis', () => {
    // Auf den ganzen Schluessel pruefen, nicht auf sein Praefix: eine
    // Gegenprobe benannte ihn in `analysis.rf.scopeX` um und blieb gruen,
    // weil `toContain` den Teilstring fand. Ein umbenannter Schluessel faellt
    // in der Oberflaeche auf den deutschen Rueckfall zurueck und ist
    // englisch dann weg -- genau die Sorte Fehler, die niemand sieht.
    expect(analyseQuelle).toMatch(/t\('analysis\.rf\.scope',/)
    expect(analyseQuelle).toContain('spectrum.withoutFrequency')
  })

  it('die Rig-Ansicht reicht die fremden Sender herein', () => {
    expect(rigDialogQuelle).toMatch(/deriveRig\(plan, undefined, fremde\)/)
    // Nur die FREMDEN: die eigenen bringt `deriveRig` selbst mit, und sie
    // doppelt einzuspeisen erzeugte Konflikte mit sich selbst.
    expect(rigDialogQuelle).toContain("e.source !== 'rig'")
  })
})
