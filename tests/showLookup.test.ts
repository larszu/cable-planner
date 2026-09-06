import { describe, expect, it } from 'vitest'
import {
  answerSummary,
  lookupInPlan,
  matchNote,
  type LookupField,
} from '../src/renderer/lib/showLookup'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import sucheQuelle from '../src/renderer/components/Canvas/CanvasSearch.tsx?raw'

// ---------------------------------------------------------------------------
// Nachschlagen mitten in der Show (Bedarf 76, P2, „widespread / minutes").
//
//   > Mid-show the questions are always 'what's the IP of X, which switch
//   > port, which VLAN, is it flowing'. The answer is scrolling a spreadsheet
//   > on one laptop, or the engineer's memory.
//
//   > type a partial name or address, get device, IP, VLAN, switch, port,
//   > rack, and what depends on it.
//
// Der Bruch war nicht, dass es keine Suche gab — es gab eine. Sie traf nur
// fuenf Prosa-Felder, und die Adresse, nach der mitten in der Show gefragt
// wird, war in keinem davon.
// ---------------------------------------------------------------------------

const geraet = (over: Partial<EquipmentItem> & { id: string; name: string }): EquipmentItem =>
  ({
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    category: 'Kamera',
    inputs: [],
    outputs: [],
    ...over,
  }) as EquipmentItem

const kabel = (over: Partial<Cable> & { id: string }): Cable =>
  ({
    name: over.id,
    type: 'sdi',
    length: 10,
    color: '#fff',
    fromEquipmentId: '',
    fromPortId: '',
    toEquipmentId: '',
    toPortId: '',
    notes: '',
    ...over,
  }) as Cable

const plan = () => ({
  equipment: [
    geraet({
      id: 'cam1',
      name: 'Kamera 1',
      shortName: 'CAM1',
      ipAddress: '10.20.0.14',
      macAddress: 'AA:BB:CC:00:00:01',
      managementVlanId: 30,
      serialNumber: 'SN-4711',
      outputs: [{ id: 'cam1-sdi', name: 'SDI OUT' }],
    } as Partial<EquipmentItem> & { id: string; name: string }),
    geraet({
      id: 'cam2',
      name: 'Kamera 2',
      shortName: 'CAM2',
      // Die alte Adresse steht in der NOTIZ, nicht an der Schnittstelle.
      notes: 'war frueher 10.20.0.14, jetzt neu adressiert',
      ipAddress: '10.20.0.15',
      inputs: [],
      outputs: [{ id: 'cam2-sdi', name: 'SDI OUT' }],
    } as Partial<EquipmentItem> & { id: string; name: string }),
    geraet({
      id: 'mischer',
      name: 'Bildmischer',
      rackInstanceLabel: 'Rack 2',
      rackInstanceStartUnit: 12,
      inputs: [
        { id: 'in1', name: 'IN 1' },
        { id: 'in2', name: 'IN 2' },
      ],
      outputs: [],
    } as Partial<EquipmentItem> & { id: string; name: string }),
  ],
  cables: [
    kabel({
      id: 'k1',
      fromEquipmentId: 'cam1',
      fromPortId: 'cam1-sdi',
      toEquipmentId: 'mischer',
      toPortId: 'in1',
    }),
    kabel({
      id: 'k2',
      fromEquipmentId: 'cam2',
      fromPortId: 'cam2-sdi',
      toEquipmentId: 'mischer',
      toPortId: 'in2',
    }),
  ],
  locations: [{ id: 'l1', name: 'Bühne', x: -50, y: -50, width: 400, height: 400 } as never],
  checkedCables: { k1: true },
})

describe('Bedarf 76 — die Suche findet, wonach mitten in der Show gefragt wird', () => {
  it('findet ein Geraet ueber seine IP-Adresse', () => {
    const treffer = lookupInPlan(plan(), '10.20.0.14')
    expect(treffer.length).toBeGreaterThan(0)
    expect(treffer[0].id).toBe('cam1')
    expect(treffer[0].matched[0]).toMatchObject({ field: 'ip', value: '10.20.0.14', exact: true })
  })

  it('findet ueber MAC, VLAN und Seriennummer', () => {
    const p = plan()
    expect(lookupInPlan(p, 'AA:BB:CC:00:00:01')[0]?.id).toBe('cam1')
    expect(lookupInPlan(p, 'SN-4711')[0]?.id).toBe('cam1')
    const vlan = lookupInPlan(p, '30')
    expect(vlan.some((a) => a.id === 'cam1')).toBe(true)
  })

  it('findet weiter ueber den Namen — die alte Faehigkeit bleibt', () => {
    expect(lookupInPlan(plan(), 'kamera 1')[0]?.id).toBe('cam1')
    expect(lookupInPlan(plan(), 'cam2')[0]?.id).toBe('cam2')
  })
})

describe('Bedarf 76 — jeder Treffer sagt, worauf er traf', () => {
  // Entscheidung 1 im Kopf der Datei. Wer die Adresse eintippt, bekommt BEIDE
  // Geraete — das mit der Adresse und das, dessen Notiz sie nennt. Sie zu
  // vermischen ist der Fehler, der mitten in der Show teuer wird.
  it('trennt den Adress-Traeger von dem, der die Adresse nur erwaehnt', () => {
    const treffer = lookupInPlan(plan(), '10.20.0.14')
    const cam1 = treffer.find((a) => a.id === 'cam1')
    const cam2 = treffer.find((a) => a.id === 'cam2')
    expect(cam1?.matched[0].field).toBe('ip')
    expect(cam2).toBeDefined()
    expect(cam2?.matched[0].field).toBe('notes')
  })

  it('reiht den Adress-Traeger VOR den, der sie nur erwaehnt', () => {
    // Der Name des Erwaehners sortiert ABSICHTLICH vor dem des Traegers.
    // Eine erste Fassung dieses Tests nutzte „Kamera 2" und blieb gruen, auch
    // als die Rangfolge ausgehebelt war: die alphabetische Nachsortierung
    // ergab zufaellig dieselbe Reihenfolge. Ein Test, der aus dem falschen
    // Grund gruen ist, prueft nichts.
    const p = plan()
    p.equipment.push(
      geraet({
        id: 'anzeige',
        name: 'Anzeige',
        notes: 'Adresse 10.20.0.14 steht auf dem Zettel am Rack',
      } as Partial<EquipmentItem> & { id: string; name: string }),
    )
    const treffer = lookupInPlan(p, '10.20.0.14')
    const iTraeger = treffer.findIndex((a) => a.id === 'cam1')
    const iErwaehner = treffer.findIndex((a) => a.id === 'anzeige')
    expect(iTraeger).toBe(0)
    expect(iErwaehner).toBeGreaterThan(iTraeger)
  })

  it('unterscheidet die ganze Adresse von der enthaltenen', () => {
    // `10.20.0.1` steckt in `10.20.0.14`. Beides zu finden ist richtig; beides
    // gleich zu bewerten waere der Griff zum falschen Geraet.
    const treffer = lookupInPlan(plan(), '10.20.0.1')
    const cam1 = treffer.find((a) => a.id === 'cam1')
    expect(cam1?.matched[0]).toMatchObject({ field: 'ip', exact: false })
  })

  it('nennt den Grund NUR, wenn er nicht der Name ist', () => {
    const label = (f: LookupField) => f
    const treffer = lookupInPlan(plan(), '10.20.0.14')
    expect(matchNote(treffer.find((a) => a.id === 'cam2')!, label)).toContain('notes')
    expect(matchNote(lookupInPlan(plan(), 'Kamera 1')[0], label)).toBeUndefined()
  })
})

describe('Bedarf 76 — die Antwort traegt, was der Bedarf aufzaehlt', () => {
  it('nennt Adresse, VLAN, Ort und Rack', () => {
    const a = lookupInPlan(plan(), 'Kamera 1')[0]
    expect(a.interfaces[0].ipAddress).toBe('10.20.0.14')
    expect(a.interfaces[0].vlanId).toBe(30)
    expect(a.location).toBe('Bühne')

    const m = lookupInPlan(plan(), 'Bildmischer')[0]
    expect(m.rack).toEqual({ label: 'Rack 2', startUnit: 12 })
  })

  it('leitet ab, was dranhaengt — aus dem Kabelgraph, mit Port und Richtung', () => {
    const a = lookupInPlan(plan(), 'Kamera 1')[0]
    expect(a.dependents).toHaveLength(1)
    expect(a.dependents[0]).toMatchObject({
      id: 'mischer',
      name: 'Bildmischer',
      viaPort: 'SDI OUT',
      direction: 'downstream',
    })

    const m = lookupInPlan(plan(), 'Bildmischer')[0]
    expect(m.dependents.map((d) => d.id).sort()).toEqual(['cam1', 'cam2'])
    expect(m.dependents.every((d) => d.direction === 'upstream')).toBe(true)
  })

  it('gibt den Aufbau-Haken weiter, ohne ihn zu erfinden', () => {
    const m = lookupInPlan(plan(), 'Bildmischer')[0]
    const ueberCam1 = m.dependents.find((d) => d.id === 'cam1')
    const ueberCam2 = m.dependents.find((d) => d.id === 'cam2')
    expect(ueberCam1?.checked).toBe(true)
    // k2 steht in keinem checkState — das ist NICHT "nicht gesteckt", sondern
    // "nie beantwortet", und genau so muss es ankommen.
    expect(ueberCam2 && 'checked' in ueberCam2).toBe(false)
  })

  it('behauptet nirgends, dass etwas fliesst', () => {
    // Entscheidung 3: ein offline-Planer weiss das nicht. Eine geratene
    // Antwort darauf saehe wie eine Messung aus.
    const felder = Object.keys(lookupInPlan(plan(), 'Kamera 1')[0].dependents[0])
    expect(felder).not.toContain('flowing')
    expect(felder).not.toContain('online')
    expect(felder).not.toContain('live')
  })
})

describe('Bedarf 76 — der Switch-Port kommt aus der Port-Karte', () => {
  const mitSwitch = () => {
    const p = plan()
    p.equipment.push(
      geraet({
        id: 'sw1',
        name: 'Core-Switch',
        category: 'Netzwerk',
        deviceTypeId: 'switch',
        inputs: [
          { id: 'p1', name: '1/0/1' },
          { id: 'p2', name: '1/0/2' },
        ],
        outputs: [],
      } as Partial<EquipmentItem> & { id: string; name: string }),
    )
    const cam1 = p.equipment.find((e) => e.id === 'cam1')!
    cam1.networkInterfaces = [
      {
        id: 'cam1#nic1',
        role: 'media',
        ipAddress: '10.30.0.14',
        switchEquipmentId: 'sw1',
        switchPort: '1/0/1',
      },
    ]
    return p
  }

  it('nennt Switch und Port an der Schnittstelle', () => {
    const a = lookupInPlan(mitSwitch(), '10.30.0.14')[0]
    const nic = a.interfaces.find((i) => i.ipAddress === '10.30.0.14')
    expect(nic?.switchName).toBe('Core-Switch')
    expect(nic?.switchPort).toBe('1/0/1')
  })

  it('findet ein Geraet auch ueber die Port-Bezeichnung am Switch', () => {
    const treffer = lookupInPlan(mitSwitch(), '1/0/1')
    expect(treffer.some((a) => a.id === 'cam1')).toBe(true)
    expect(treffer.find((a) => a.id === 'cam1')?.matched[0].field).toBe('switchPort')
  })

  it('nennt den Port auch, wenn ihn nur das KABEL kennt', () => {
    // Der haeufigere Fall im Feld: gesteckt ist es, gepflegt ist es nicht.
    // Die Port-Karte kennt beide Quellen; wer nur das Schnittstellen-Feld
    // liest, findet mitten in der Show nichts.
    const p = mitSwitch()
    const cam2 = p.equipment.find((e) => e.id === 'cam2')!
    cam2.networkInterfaces = []
    p.cables.push(
      kabel({
        id: 'k-net',
        fromEquipmentId: 'cam2',
        fromPortId: 'cam2-sdi',
        toEquipmentId: 'sw1',
        toPortId: 'p2',
      }),
    )
    const a = lookupInPlan(p, 'Kamera 2')[0]
    const ueberKabel = a.interfaces.find((i) => i.switchPort === '1/0/2')
    expect(ueberKabel?.switchName).toBe('Core-Switch')
  })
})

describe('Bedarf 76 — Grenzen', () => {
  it('gibt bei leerer Anfrage NICHTS zurueck, nicht alles', () => {
    expect(lookupInPlan(plan(), '')).toEqual([])
    expect(lookupInPlan(plan(), '   ')).toEqual([])
  })

  it('haelt sich an das Limit', () => {
    expect(lookupInPlan(plan(), 'a', { limit: 1 })).toHaveLength(1)
    expect(lookupInPlan(plan(), 'kamera', { limit: 0 }).length).toBeGreaterThan(1)
  })

  it('kommt mit einem Kabel ins Leere zurecht', () => {
    const p = plan()
    p.cables.push(
      kabel({ id: 'k3', fromEquipmentId: 'cam1', fromPortId: 'cam1-sdi', toEquipmentId: 'weg', toPortId: 'x' }),
    )
    const a = lookupInPlan(p, 'Kamera 1')[0]
    expect(a.dependents.map((d) => d.id)).toEqual(['mischer'])
  })

  it('faellt auf die Port-Id zurueck, wenn der Port nicht mehr existiert', () => {
    const p = plan()
    p.cables[0] = kabel({
      id: 'k1',
      fromEquipmentId: 'cam1',
      fromPortId: 'geloescht',
      toEquipmentId: 'mischer',
      toPortId: 'in1',
    })
    expect(lookupInPlan(p, 'Kamera 1')[0].dependents[0].viaPort).toBe('geloescht')
  })
})

describe('Bedarf 76 — die Zusammenfassung nennt die drei gefragten Angaben', () => {
  it('setzt Adresse, VLAN und Rack in eine Zeile', () => {
    const z = answerSummary(lookupInPlan(plan(), 'Kamera 1')[0])
    expect(z).toContain('10.20.0.14')
    expect(z).toContain('VLAN 30')
    expect(z).toContain('Bühne')
  })

  it('laesst weg, was nicht da ist, statt Platzhalter zu setzen', () => {
    const z = answerSummary(lookupInPlan(plan(), 'Bildmischer')[0])
    expect(z).not.toContain('VLAN')
    expect(z).not.toContain('undefined')
    expect(z).toContain('Rack 2')
  })
})

describe('Bedarf 76 — die Suche auf der Canvas geht durch die Engstelle', () => {
  // Eine zweite Trefferliste neben `lookupInPlan` waere die zweite Wahrheit —
  // und genau so ist die alte Suche entstanden, die die Adressen nicht kannte.
  it('CanvasSearch ruft lookupInPlan auf', () => {
    // Auf den AUFRUF pruefen, nicht auf das Wort: eine erste Fassung suchte
    // nur `lookupInPlan` im Quelltext und blieb gruen, als der Aufruf durch
    // einen anderen ersetzt wurde — die Import-Zeile allein hat sie erfuellt.
    expect(sucheQuelle).toMatch(/lookupInPlan\(\s*\{\s*equipment/)
  })

  it('CanvasSearch filtert nicht mehr selbst ueber die Feldliste', () => {
    expect(sucheQuelle).not.toContain('e.shortName, e.category, e.subtitle, e.notes')
    expect(sucheQuelle).not.toMatch(/\[e\.name,\s*e\.shortName/)
  })
})
