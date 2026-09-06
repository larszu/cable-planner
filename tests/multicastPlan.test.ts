import { describe, expect, it } from 'vitest'
import {
  MULTICAST_ESSENCE,
  MULTICAST_FINDING_LABEL,
  aliasKey,
  allocateMulticast,
  assessMulticast,
  buildMulticastPlan,
  collectFlows,
  intToIp,
  ipToInt,
  isMulticastAddress,
  multicastMac,
  multicastTable,
  normaliseMulticastConfig,
  parsePool,
  reservedReason,
} from '../src/renderer/lib/multicastPlan'
import {
  AUDIO_MULTICAST,
  LIGHTING_MULTICAST,
  VIDEO_MULTICAST,
} from '../src/renderer/lib/venueNetworkRequest'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { MulticastAssignment, MulticastConfig } from '../src/renderer/types/multicast'
import analyseQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import registerQuelle from '../src/renderer/lib/documentRegistry.ts?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'
import metaQuelle from '../src/renderer/store/slices/metaSlice.ts?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Der Multicast-Adressplan (Bedarf 72, P2).
//
//   > Every essence (2110-20/-30/-40) is its own multicast group, doubled for
//   > 2022-7. … Two invisible rules get violated: (address, UDP port) must be
//   > unique per sender, and 32 L3 multicast addresses alias onto one L2 MAC,
//   > so a naive scheme collides.
//
// Belege: Arista „M&E Multicast Addressing" (2^5-Kollaps); Dataton WATCHOUT
// (Adresse und Port zusammen eindeutig).
// ---------------------------------------------------------------------------

const geraet = (id: string, name: string, extra: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id,
    name,
    type: 'camera',
    x: 0,
    y: 0,
    inputs: [],
    outputs: [],
    ...extra,
  }) as unknown as EquipmentItem

const kabel = (id: string, from: string, fromPort: string, to: string, std?: string): Cable =>
  ({
    id,
    fromEquipmentId: from,
    fromPortId: fromPort,
    toEquipmentId: to,
    toPortId: `${to}-in`,
    ...(std ? { standard: std } : {}),
  }) as unknown as Cable

const nic = (id: string, role: string) => ({ id, role }) as never

/** Kamera mit rot/blau, Kamera ohne, ein Switch als Empfaenger. */
const aufbau = () => {
  const cam = geraet('cam1', 'Kamera 1', {
    outputs: [{ id: 'p1', name: '2110 OUT', type: 'video', connectorType: 'RJ45' }],
    networkInterfaces: [nic('cam1#nic1', 'media-primary'), nic('cam1#nic2', 'media-secondary')],
  } as never)
  const mic = geraet('sb1', 'Stagebox 1', {
    outputs: [{ id: 'p1', name: 'Dante OUT', type: 'audio', connectorType: 'RJ45' }],
  } as never)
  const rec = geraet('rec', 'Recorder')
  const mv = geraet('mv', 'Multiviewer')
  return {
    equipment: [cam, mic, rec, mv],
    cables: [
      kabel('c1', 'cam1', 'p1', 'rec', 'ST2110-20'),
      kabel('c2', 'cam1', 'p1', 'mv', 'ST2110-20'),
      kabel('c3', 'sb1', 'p1', 'rec', 'Dante'),
    ],
  }
}

// ---------------------------------------------------------------------------
describe('die Adress-Arithmetik, auf der beide Regeln stehen', () => {
  it('rechnet punktiert und ganzzahlig ineinander', () => {
    expect(ipToInt('239.100.0.1')).toBe(0xef640001)
    expect(intToIp(0xef640001)).toBe('239.100.0.1')
    expect(ipToInt('239.100.0')).toBeNull()
    expect(ipToInt('239.100.0.256')).toBeNull()
    expect(ipToInt('a.b.c.d')).toBeNull()
  })

  it('kennt die Grenzen von 224.0.0.0/4', () => {
    expect(isMulticastAddress('224.0.0.0')).toBe(true)
    expect(isMulticastAddress('239.255.255.255')).toBe(true)
    expect(isMulticastAddress('223.255.255.255')).toBe(false)
    expect(isMulticastAddress('240.0.0.0')).toBe(false)
  })

  it('bildet auf 01:00:5e plus die UNTEREN 23 BIT ab', () => {
    expect(multicastMac('239.100.0.1')).toBe('01:00:5e:64:00:01')
    // Das oberste Bit des zweiten Oktetts faellt weg — genau das ist der
    // Kollaps. 228 = 100 + 128.
    expect(multicastMac('239.228.0.1')).toBe('01:00:5e:64:00:01')
  })

  it('LEGT DAS NAIVE SCHEMA AUS DEM BELEG OFFEN', () => {
    // „239.<dienst>.<x>.<y>" mit dem Dienst im zweiten Oktett: Video auf
    // 239.1.*, Audio auf 239.129.* — Paar fuer Paar dieselbe MAC.
    expect(aliasKey('239.1.1.1')).toBe(aliasKey('239.129.1.1'))
    expect(multicastMac('239.1.1.1')).toBe(multicastMac('239.129.1.1'))
    // Und quer ueber das erste Oktett, weil dessen unteres Halbbyte auch faellt.
    expect(aliasKey('239.1.1.1')).toBe(aliasKey('224.1.1.1'))
    // Zwei Adressen im selben /16 kollidieren dagegen NIE.
    expect(aliasKey('239.100.0.1')).not.toBe(aliasKey('239.100.0.2'))
  })

  it('nennt fuer jeden gesperrten Bereich den Grund', () => {
    expect(reservedReason('224.0.0.5')).toContain('224.0.0.0/24')
    expect(reservedReason('224.0.1.129')).toContain('PTP')
    expect(reservedReason('232.0.0.9')).toContain('Source-Specific')
    expect(reservedReason('239.255.255.250')).toContain('SSDP')
    expect(reservedReason('239.100.0.1')).toBeNull()
  })

  it('parst den Pool und richtet ihn auf seine eigene Groesse aus', () => {
    expect(parsePool('239.100.0.0/16')).toEqual({ base: 0xef640000, count: 65536, prefix: 16 })
    // „239.100.0.5/16" meint dasselbe Netz wie „239.100.0.0/16" — sonst
    // laege der Pool woanders als der Leser denkt.
    expect(parsePool('239.100.0.5/16')?.base).toBe(0xef640000)
    // Ausserhalb von 224.0.0.0/4 ist kein Multicast-Pool.
    expect(parsePool('10.0.0.0/8')).toBeNull()
    expect(parsePool('239.100.0.0')).toBeNull()
    expect(parsePool('239.100.0.0/33')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('die Fluesse kommen aus dem gezeichneten Signalfluss', () => {
  it('macht aus DREI Kabeln an einem Sende-Port EINE Gruppe', () => {
    // Das ist der Punkt, an dem eine Excel-Tabelle mit einer Zeile je Kabel
    // auseinanderfaellt: fuenf Empfaenger abonnieren eine Gruppe, nicht fuenf.
    const a = aufbau()
    const flows = collectFlows(a.equipment, a.cables)
    expect(flows).toHaveLength(2)
    const cam = flows.find((f) => f.equipmentId === 'cam1')!
    expect(cam.receivers).toEqual(['Multiviewer', 'Recorder'])
  })

  it('trennt die Essenzen, und ANC ist eine eigene', () => {
    // Der Bedarf sagt es woertlich: „every essence (2110-20/-30/-40) is its
    // own multicast group". -40 als Anhaengsel des Videos zu fuehren waere
    // eine Gruppe zu wenig.
    const cam = geraet('cam1', 'Kamera 1', {
      outputs: [
        { id: 'v', name: 'VID', type: 'video', connectorType: 'RJ45' },
        { id: 'a', name: 'ANC', type: 'data', connectorType: 'RJ45' },
      ],
    } as never)
    const flows = collectFlows(
      [cam, geraet('rec', 'Recorder')],
      [kabel('c1', 'cam1', 'v', 'rec', 'ST2110-20'), kabel('c2', 'cam1', 'a', 'rec', 'ST2110-40')],
    )
    expect(flows.map((f) => f.essence).sort()).toEqual(['anc', 'video'])
  })

  it('leitet das zweite Bein aus den MEDIEN-Schnittstellen des Senders ab', () => {
    const a = aufbau()
    const flows = collectFlows(a.equipment, a.cables)
    expect(flows.find((f) => f.equipmentId === 'cam1')!.legs).toEqual(['a', 'b'])
    // Die Stagebox hat kein Sekundaernetz — sie bekommt EIN Bein, und dass es
    // eines ist, steht damit im Plan statt in der Erinnerung.
    expect(flows.find((f) => f.equipmentId === 'sb1')!.legs).toEqual(['a'])
  })

  it('nimmt den Standard vom Port, wenn das Kabel keinen traegt', () => {
    // Der Normalfall im Bestand.
    const cam = geraet('cam1', 'Kamera 1', {
      outputs: [{ id: 'p1', name: 'OUT', type: 'video', connectorType: 'RJ45', standard: 'ST2110-20' }],
    } as never)
    const flows = collectFlows([cam, geraet('rec', 'R')], [kabel('c1', 'cam1', 'p1', 'rec')])
    expect(flows).toHaveLength(1)
    expect(flows[0].standard).toBe('ST2110-20')
  })

  it('laesst Unicast-Standards draussen', () => {
    const flows = collectFlows(
      [
        geraet('cam1', 'K', {
          outputs: [{ id: 'p1', name: 'SDI', type: 'video', connectorType: 'BNC' }],
        } as never),
        geraet('rec', 'R'),
      ],
      [kabel('c1', 'cam1', 'p1', 'rec', 'SDI-12G')],
    )
    expect(flows).toEqual([])
  })

  it('haelt jeden Multicast-Standard aus `venueNetworkRequest` in der Essenz-Karte', () => {
    // Ohne diesen Guard fiele ein spaeter hinzugefuegter Standard still aus
    // dem Adressplan heraus — und der Plan meldete eine vollstaendige Vergabe
    // fuer eine Gruppe, die er nie gesehen hat.
    for (const std of [...AUDIO_MULTICAST, ...VIDEO_MULTICAST, ...LIGHTING_MULTICAST]) {
      expect(MULTICAST_ESSENCE[std], `${std} fehlt in MULTICAST_ESSENCE`).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------------------
const flowsOf = () => collectFlows(aufbau().equipment, aufbau().cables)
const zu = (label: string) => flowsOf().find((f) => f.label.startsWith(label))!.key

describe('die Befunde — beide unsichtbaren Regeln, benannt', () => {
  const pool = parsePool('239.100.0.0/16')

  it('meldet Adresse UND Port doppelt (WATCHOUT-Regel)', () => {
    const flows = flowsOf()
    const a: MulticastAssignment[] = [
      { flowKey: zu('Kamera 1'), leg: 'a', address: '239.100.0.1', port: 20000 },
      { flowKey: zu('Stagebox 1'), leg: 'a', address: '239.100.0.1', port: 20000 },
    ]
    const { findings } = assessMulticast(flows, a, pool)
    const f = findings.find((x) => x.kind === 'pair-collision')!
    expect(f).toBeDefined()
    expect(f.text).toContain('239.100.0.1:20000')
    expect(f.flowKeys).toHaveLength(2)
  })

  it('sagt NICHTS, wenn nur der Port geteilt wird', () => {
    // Ein fester UDP-Port ueber alle Gruppen ist gaengige Praxis; die Regel
    // verlangt das PAAR eindeutig, nicht den Port.
    const flows = flowsOf()
    const a: MulticastAssignment[] = [
      { flowKey: zu('Kamera 1'), leg: 'a', address: '239.100.0.1', port: 20000 },
      { flowKey: zu('Stagebox 1'), leg: 'a', address: '239.100.0.2', port: 20000 },
    ]
    expect(assessMulticast(flows, a, pool).findings).toEqual([])
  })

  it('MELDET DEN L2-ALIAS mit beiden Adressen und der geteilten MAC', () => {
    // Der Befund muss beide Adressen und die MAC nennen. Sonst liest er sich
    // wie ein Fehlalarm: „das sind doch verschiedene Adressen".
    const flows = flowsOf()
    const a: MulticastAssignment[] = [
      { flowKey: zu('Kamera 1'), leg: 'a', address: '239.1.0.1', port: 20000 },
      { flowKey: zu('Stagebox 1'), leg: 'a', address: '239.129.0.1', port: 20000 },
    ]
    const f = assessMulticast(flows, a, pool).findings.find((x) => x.kind === 'mac-alias')!
    expect(f).toBeDefined()
    expect(f.text).toContain('239.1.0.1')
    expect(f.text).toContain('239.129.0.1')
    expect(f.text).toContain('01:00:5e:01:00:01')
  })

  it('nennt beim Alias die FOLGE und behauptet keinen Ausfall', () => {
    // Ob es weh tut, haengt an Karte und Switch. Der Befund sagt, was es
    // kostet — nicht, dass es ausfaellt (dieselbe Haltung wie bei „is it
    // flowing", Bedarf 76).
    const flows = flowsOf()
    const f = assessMulticast(
      flows,
      [
        { flowKey: zu('Kamera 1'), leg: 'a', address: '239.1.0.1', port: 20000 },
        { flowKey: zu('Stagebox 1'), leg: 'a', address: '239.129.0.1', port: 20000 },
      ],
      pool,
    ).findings.find((x) => x.kind === 'mac-alias')!
    expect(f.text).toMatch(/L2/)
    expect(f.text).toMatch(/Last/)
    expect(f.text).not.toMatch(/fällt aus|Ausfall/)
  })

  it('meldet zwei Beine auf einer Gruppe als Redundanz, die keine ist', () => {
    const flows = flowsOf()
    const key = zu('Kamera 1')
    const f = assessMulticast(
      flows,
      [
        { flowKey: key, leg: 'a', address: '239.100.0.1', port: 20000 },
        { flowKey: key, leg: 'b', address: '239.100.0.1', port: 20000 },
      ],
      pool,
    ).findings.find((x) => x.kind === 'leg-shared')!
    expect(f).toBeDefined()
    expect(f.flowKeys).toEqual([key])
  })

  it('meldet zwei Beine auf VERSCHIEDENEN Gruppen NICHT', () => {
    const flows = flowsOf()
    const key = zu('Kamera 1')
    const findings = assessMulticast(
      flows,
      [
        { flowKey: key, leg: 'a', address: '239.100.0.1', port: 20000 },
        { flowKey: key, leg: 'b', address: '239.101.0.1', port: 20000 },
      ],
      pool,
    ).findings
    expect(findings.filter((f) => f.kind === 'leg-shared')).toEqual([])
  })

  it('meldet gesperrte Bereiche und Nicht-Multicast getrennt begruendet', () => {
    const flows = flowsOf()
    const findings = assessMulticast(
      flows,
      [
        { flowKey: zu('Kamera 1'), leg: 'a', address: '224.0.1.129', port: 20000 },
        { flowKey: zu('Stagebox 1'), leg: 'a', address: '10.0.0.1', port: 20000 },
      ],
      pool,
    ).findings.filter((f) => f.kind === 'reserved-range')
    expect(findings).toHaveLength(2)
    expect(findings.some((f) => f.text.includes('PTP'))).toBe(true)
    expect(findings.some((f) => f.text.includes('224.0.0.0/4'))).toBe(true)
  })

  it('meldet eine Vergabe ausserhalb des Pools — nur, wenn einer erklaert ist', () => {
    const flows = flowsOf()
    const a: MulticastAssignment[] = [
      { flowKey: zu('Kamera 1'), leg: 'a', address: '239.200.0.1', port: 20000 },
    ]
    expect(assessMulticast(flows, a, pool).findings.some((f) => f.kind === 'outside-pool')).toBe(true)
    // Ohne Pool gibt es kein „ausserhalb".
    expect(assessMulticast(flows, a, null).findings.some((f) => f.kind === 'outside-pool')).toBe(false)
  })

  it('haelt „noch nicht vergeben" AUS den Befunden heraus', () => {
    // Ein Plan, in dem nie vergeben wurde, haette sonst je Fluss eine Warnung
    // und begruebe die echten darunter — dieselbe Entscheidung wie bei
    // `withoutDomain` im Zeit-Plan (Bedarf 73).
    const flows = flowsOf()
    const r = assessMulticast(flows, [], pool)
    expect(r.findings).toEqual([])
    // Drei Beine: Kamera a+b, Stagebox a.
    expect(r.open).toHaveLength(3)
    expect(r.open.map((o) => o.leg).sort()).toEqual(['a', 'a', 'b'])
  })

  it('meldet Vergaben zu verschwundenen Fluessen als `stale`, nicht als Befund', () => {
    const flows = flowsOf()
    const r = assessMulticast(
      flows,
      [{ flowKey: 'weg:weg', leg: 'a', address: '239.100.0.9', port: 20000 }],
      pool,
    )
    expect(r.stale).toHaveLength(1)
    expect(r.findings).toEqual([])
  })

  it('haelt die Etiketten kanonisch deutsch', () => {
    expect(MULTICAST_FINDING_LABEL['mac-alias']).toBe('Zwei Gruppen auf einer L2-Adresse')
  })
})

// ---------------------------------------------------------------------------
describe('die Vergabe vergibt NACH und bewegt nichts', () => {
  const cfg = (over: Partial<MulticastConfig> = {}): MulticastConfig => ({
    pool: '239.100.0.0/16',
    basePort: 20000,
    assignments: [],
    ...over,
  })

  it('vergibt jedes offene Bein genau einmal', () => {
    const flows = flowsOf()
    const r = allocateMulticast(flows, cfg())
    expect(r.issued).toHaveLength(3)
    expect(new Set(r.issued.map((a) => a.address)).size).toBe(3)
    expect(r.exhausted).toEqual([])
    expect(r.issued.every((a) => a.port === 20000)).toBe(true)
  })

  it('LAESST EINE BESTEHENDE ADRESSE STEHEN — auch eine unpassende', () => {
    // Eine verteilte Adresse umzunummerieren waere der stille Verlust, den
    // Bedarf 96 verbietet (Cryde/musicall#798). Sie steht im Sender, im
    // Empfaenger, im Switch-Filter und auf einem ausgedruckten Blatt.
    const flows = flowsOf()
    const alt: MulticastAssignment = {
      flowKey: zu('Kamera 1'),
      leg: 'a',
      address: '239.200.7.7',
      port: 20000,
    }
    const r = allocateMulticast(flows, cfg({ assignments: [alt] }))
    expect(r.assignments).toContainEqual(alt)
    expect(r.issued.map((a) => a.address)).not.toContain('239.200.7.7')
    expect(r.issued).toHaveLength(2)
  })

  it('WEICHT EINEM L2-ALIAS AUS, den eine bestehende Vergabe aufspannt', () => {
    // Der ganze Sinn der Uebung. Die Bestandsadresse liegt ausserhalb des
    // Pools; die neue Vergabe darf trotzdem nicht auf ihre MAC fallen.
    const flows = flowsOf()
    const alt: MulticastAssignment = {
      flowKey: zu('Kamera 1'),
      leg: 'a',
      address: '239.228.0.0',
      port: 20000,
    }
    const r = allocateMulticast(flows, cfg({ assignments: [alt] }))
    // 239.100.0.0 traegt dieselbe MAC wie 239.228.0.0 und muss uebersprungen
    // worden sein.
    expect(r.issued.map((a) => a.address)).not.toContain('239.100.0.0')
    for (const a of r.issued) expect(aliasKey(a.address)).not.toBe(aliasKey('239.228.0.0'))
  })

  it('ueberspringt gesperrte Bereiche', () => {
    const flows = flowsOf()
    // Ein Pool, der auf dem Local Network Control Block beginnt.
    const r = allocateMulticast(flows, cfg({ pool: '224.0.0.0/16' }))
    expect(r.issued).toHaveLength(3)
    for (const a of r.issued) expect(reservedReason(a.address)).toBeNull()
  })

  it('BENENNT einen erschoepften Pool, statt still weniger zu vergeben', () => {
    const flows = flowsOf()
    // /30 = vier Adressen, davon liegen alle vier in 224.0.0.0/24 und sind
    // gesperrt: es bleibt nichts uebrig.
    const r = allocateMulticast(flows, cfg({ pool: '224.0.0.0/30' }))
    expect(r.issued).toEqual([])
    expect(r.exhausted).toHaveLength(3)
    expect(r.exhausted[0]).toHaveProperty('label')
  })

  it('vergibt ohne brauchbaren Pool GAR NICHTS und meldet alles als offen', () => {
    const flows = flowsOf()
    const r = allocateMulticast(flows, cfg({ pool: 'Unsinn' }))
    expect(r.issued).toEqual([])
    expect(r.exhausted).toHaveLength(3)
  })

  it('ist idempotent: ein zweiter Lauf vergibt nichts mehr', () => {
    const flows = flowsOf()
    const erst = allocateMulticast(flows, cfg())
    const zweit = allocateMulticast(flows, cfg({ assignments: erst.assignments }))
    expect(zweit.issued).toEqual([])
    expect(zweit.assignments).toEqual(erst.assignments)
  })

  it('BEHAELT eine verwaiste Vergabe, statt sie beim Vergeben mitzuloeschen', () => {
    // Sonst waere sie weg, sobald jemand versehentlich ein Kabel loescht und
    // neu vergibt.
    const flows = flowsOf()
    const verwaist: MulticastAssignment = {
      flowKey: 'weg:weg',
      leg: 'a',
      address: '239.100.9.9',
      port: 20000,
    }
    const r = allocateMulticast(flows, cfg({ assignments: [verwaist] }))
    expect(r.assignments).toContainEqual(verwaist)
  })
})

// ---------------------------------------------------------------------------
describe('das Blatt macht die unsichtbare Regel sichtbar', () => {
  it('traegt eine MAC-Spalte, und sie ist gefuellt', () => {
    const a = aufbau()
    const flows = collectFlows(a.equipment, a.cables)
    const res = allocateMulticast(flows, {
      pool: '239.100.0.0/16',
      basePort: 20000,
      assignments: [],
    })
    const plan = buildMulticastPlan({
      ...a,
      multicast: { pool: '239.100.0.0/16', basePort: 20000, assignments: res.assignments },
    })
    const t = multicastTable(plan)
    expect(t.headers).toEqual([
      'Fluss',
      'Essenz',
      'Standard',
      'Bein',
      'Gruppe',
      'UDP-Port',
      'L2-MAC',
      'Empfänger',
    ])
    expect(t.rows).toHaveLength(3)
    const mac = t.headers.indexOf('L2-MAC')
    expect(t.rows.every((r) => String(r[mac]).startsWith('01:00:5e:'))).toBe(true)
  })

  it('schreibt „offen" statt einer leeren Zelle', () => {
    // Eine leere Zelle liest sich wie „gibt es nicht"; offen ist ein Zustand.
    const a = aufbau()
    const t = multicastTable(buildMulticastPlan(a))
    expect(t.rows.some((r) => r[4] === 'offen')).toBe(true)
  })

  it('fuehrt die Empfaenger in EINER Zeile, weil es EINE Gruppe ist', () => {
    const a = aufbau()
    const t = multicastTable(buildMulticastPlan(a))
    const cam = t.rows.find((r) => String(r[0]).startsWith('Kamera 1'))!
    expect(cam[7]).toBe('Multiviewer, Recorder')
  })
})

// ---------------------------------------------------------------------------
describe('der Lade-Pfad wirft nur weg, was unlesbar ist', () => {
  it('behaelt eine lesbare, aber falsche Adresse', () => {
    // Sie hier wegzuwerfen hiesse, den Fehler zu verstecken statt ihn zu
    // zeigen — es gibt Befunde dafuer.
    const cfg = normaliseMulticastConfig({
      pool: '239.100.0.0/16',
      basePort: 20000,
      assignments: [{ flowKey: 'a:b', leg: 'a', address: '10.0.0.1', port: 20000 }],
    })
    expect(cfg?.assignments).toHaveLength(1)
  })

  it('verwirft und MELDET, was keine Adresse oder kein Bein hat', () => {
    const drops: { reason: string; label: string }[] = []
    const cfg = normaliseMulticastConfig(
      {
        pool: '239.100.0.0/16',
        basePort: 20000,
        assignments: [
          { flowKey: 'a:b', leg: 'a', address: '239.100.0.1', port: 20000 },
          { flowKey: 'a:b', leg: 'z', address: '239.100.0.2', port: 20000 },
          { flowKey: '', leg: 'a', address: '239.100.0.3', port: 20000 },
          { flowKey: 'c:d', leg: 'a', address: 'Unsinn', port: 20000 },
        ],
      },
      (d) => drops.push(d),
    )
    expect(cfg?.assignments).toHaveLength(1)
    expect(drops).toHaveLength(3)
    expect(drops.every((d) => d.reason === 'missing-required')).toBe(true)
  })

  it('meldet ein doppeltes Bein als `duplicate-id`', () => {
    const drops: { reason: string }[] = []
    const cfg = normaliseMulticastConfig(
      {
        pool: '239.100.0.0/16',
        basePort: 20000,
        assignments: [
          { flowKey: 'a:b', leg: 'a', address: '239.100.0.1', port: 20000 },
          { flowKey: 'a:b', leg: 'a', address: '239.100.0.2', port: 20000 },
        ],
      },
      (d) => drops.push(d),
    )
    expect(cfg?.assignments).toHaveLength(1)
    expect(cfg?.assignments[0].address).toBe('239.100.0.1')
    expect(drops[0].reason).toBe('duplicate-id')
  })

  it('heilt ein Objekt ohne Pool und ohne Vergabe zu `undefined`', () => {
    // Sonst traegt jedes Projektfile, das den Dialog einmal geoeffnet hat,
    // einen leeren Block.
    expect(normaliseMulticastConfig({ pool: '  ', basePort: 20000, assignments: [] })).toBeUndefined()
    expect(normaliseMulticastConfig(undefined)).toBeUndefined()
    expect(normaliseMulticastConfig('nein')).toBeUndefined()
  })

  it('faellt bei unsinnigem Port auf 20000 zurueck, statt ihn zu uebernehmen', () => {
    const cfg = normaliseMulticastConfig({
      pool: '239.100.0.0/16',
      basePort: 999999,
      assignments: [{ flowKey: 'a:b', leg: 'a', address: '239.100.0.1' }],
    })
    expect(cfg?.basePort).toBe(20000)
    expect(cfg?.assignments[0].port).toBe(20000)
  })

  it('haengt in `healProjectPositions`, nicht nur im Modul', () => {
    // Sonst laeuft die Normalisierung nie: der Lade-Pfad ist die einzige
    // Stelle, an der eine fremde Datei ankommt.
    expect(storeQuelle).toContain('normaliseMulticastConfig(project.multicast')
    expect(storeQuelle).toMatch(/kind: 'multicast-assignment', reason: d\.reason, label: d\.label/)
    expect(storeQuelle).toMatch(/^\s*multicast,$/m)
  })
})

// ---------------------------------------------------------------------------
describe('der Plan als Ganzes', () => {
  it('nennt einen unbrauchbaren Pool im Klartext, statt ihn zu schlucken', () => {
    const plan = buildMulticastPlan({
      ...aufbau(),
      multicast: { pool: '10.0.0.0/8', basePort: 20000, assignments: [] },
    })
    expect(plan.pool).toBeNull()
    expect(plan.poolError).toContain('10.0.0.0/8')
  })

  it('unterscheidet „kein Pool" von „kaputter Pool"', () => {
    const plan = buildMulticastPlan(aufbau())
    expect(plan.pool).toBeNull()
    expect(plan.poolError).toBeNull()
  })

  it('meldet einen reinen SDI-Aufbau als „braucht kein Multicast"', () => {
    const plan = buildMulticastPlan({ equipment: [], cables: [] })
    expect(plan.needsMulticast).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('Erreichbarkeit', () => {
  it('steht im Netzwerk-Reiter der Analyse', () => {
    expect(analyseQuelle).toContain('buildMulticastPlan(projekt)')
    expect(analyseQuelle).toContain('{multicast.needsMulticast && (')
  })

  it('vergibt ueber `allocateMulticast` und schreibt die GANZE Liste zurueck', () => {
    // Ein Einzel-Setter verfuehrte zur Schleife — und jede Zwischenstufe waere
    // ein Zustand, in dem die Alias-Pruefung die eigenen frisch vergebenen
    // Adressen noch nicht kennt.
    expect(analyseQuelle).toContain('const res = allocateMulticast(multicast.flows, cfg)')
    expect(analyseQuelle).toContain('setMulticastConfig({ ...cfg, assignments: res.assignments })')
  })

  it('zeigt die MAC neben der Adresse, nicht nur im CSV', () => {
    expect(analyseQuelle).toMatch(/\{a \? \(multicastMac\(a\.address\) \?\? ''\) : ''\}/)
  })

  it('bietet das Entfernen verwaister Vergaben als EIGENE Handlung an', () => {
    expect(analyseQuelle).toContain('onClick={verwaisteEntfernen}')
    expect(analyseQuelle).toMatch(/cfg\.assignments\.filter\(\(a\) => !weg\.has\(`\$\{a\.flowKey\}\|\$\{a\.leg\}`\)\)/)
  })

  it('setzt den Store ueber einen Setter, der das ganze Objekt nimmt', () => {
    // Der GANZE Rumpf am Stueck, nicht drei einzelne `toContain`. Ein
    // `toContain('scheduleProjectAutosave(updated)')` traf jeden anderen
    // Setter in derselben Datei mit — das Autosave konnte aus DIESEM
    // verschwinden, ohne dass irgendetwas rot wurde. Genau das hat die
    // Gegenprobe gezeigt.
    expect(metaQuelle).toMatch(
      /setMulticastConfig: \(config\) =>\n\s*set\(\(state\) => \{\n\s*const updated = \{ \.\.\.state\.project, multicast: config \}\n\s*scheduleProjectAutosave\(updated\)\n\s*return \{ project: updated \}\n\s*\}\),/,
    )
  })

  it('ist ein Dokument mit Stand', () => {
    expect(registerQuelle).toContain("'multicast-plan': ofTable(multicastTableForProject)")
    expect(registerQuelle).toContain("'multicast-plan': 'Multicast-Adressplan'")
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'analysis.mc.title',
      'analysis.mc.intro',
      'analysis.mc.pool',
      'analysis.mc.port',
      'analysis.mc.allocate',
      'analysis.mc.noPool',
      'analysis.mc.open',
      'analysis.mc.stale',
      'analysis.mc.dropStale',
      'analysis.mc.export',
      'app.loadReport.multicastAssignment',
    ]) {
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
