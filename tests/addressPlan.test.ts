import { describe, expect, it } from 'vitest'
import { buildAddressPlan, addressPlanTable } from '../src/renderer/lib/addressPlan'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { SignalStandard } from '../src/renderer/types/cableSpec'

// ---------------------------------------------------------------------------
// Roadmap-Initiative 8 — der aus den Geraete-Datensaetzen ABGELEITETE
// Adressplan.
//
// Die Netz-Ansicht der Analyse zeigt, was ausgefuellt ist: ihre Zeilenauswahl
// ist `e.ipAddress || e.managementVlanId != null || e.vlans?.length`. Sie kann
// per Konstruktion nicht zeigen, was FEHLT — und das ist die Frage, mit der
// jemand den Netzplan aufmacht.
//
// Geprueft wird deshalb genau das: dass ein netzfaehiges Geraet ohne Adresse
// auftaucht, dass die Netzfaehigkeit aus dem GERAET abgeleitet wird und nicht
// aus seinem Namen, dass der Beleg dafuer mitgeht — und dass kein Befund
// gemeldet wird, der bloss eine Vermutung waere.
// ---------------------------------------------------------------------------

const port = (name: string, over: Partial<Port> = {}): Port =>
  ({
    id: `${name}-id`,
    name,
    type: 'port',
    connectorType: 'BNC',
    ...over,
  }) as Port

const geraet = (name: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id: `id-${name}`,
    name,
    category: 'Sonstiges',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...over,
  }) as unknown as EquipmentItem

const netzPort = (standard: SignalStandard) =>
  port('NET 1', { connectorType: 'RJ45', standard })

describe('wer eine Adresse braucht', () => {
  it('leitet die Netzfaehigkeit aus einem IP-Standard am Port ab', () => {
    const plan = buildAddressPlan([geraet('Stagebox', { inputs: [netzPort('Dante')] })])
    expect(plan.rows[0].networked).toBe(true)
    expect(plan.missing.map((r) => r.name)).toEqual(['Stagebox'])
  })

  it('erkennt einen IP-Standard auch an einem Nicht-RJ45-Anschluss', () => {
    // Die Gegenprobe hat gezeigt, dass die Test-Vorrichtung diese Zeile nicht
    // erreichte: `netzPort` setzt RJ45 UND einen Standard, also fing der
    // Anschluss-Fallback den Fall ab. Dante ueber Glas und ST 2110 ueber SFP
    // sind aber der Normalfall im groesseren Aufbau -- und dort ist die
    // Bauform gerade KEIN RJ45.
    const plan = buildAddressPlan([
      geraet('Fiber-Stagebox', {
        inputs: [port('SFP 1', { connectorType: 'Fiber', standard: 'ST2110-30' })],
      }),
    ])
    expect(plan.rows[0].networked).toBe(true)
    expect(plan.rows[0].evidence).toBe('SFP 1 (ST2110-30)')
  })

  it('nimmt auch den blossen RJ45-Anschluss, ohne erklaerten Standard', () => {
    // Nicht jedes Katalog-Geraet traegt einen Standard am Port. Die Bauform
    // allein sagt trotzdem: hier geht ein Netzwerkkabel hinein.
    const plan = buildAddressPlan([geraet('Switch', { outputs: [port('1', { connectorType: 'RJ45' })] })])
    expect(plan.rows[0].networked).toBe(true)
  })

  it('laesst ein Geraet ohne Netz-Port in Ruhe', () => {
    // Der wichtigste negative Fall. Eine Kamera mit zwei BNC-Ausgaengen
    // braucht keine IP, und eine Liste, die sie einfordert, ist nach dem
    // dritten Projekt Rauschen.
    const plan = buildAddressPlan([geraet('Kamera 1', { outputs: [port('SDI OUT', { standard: 'SDI-12G' })] })])
    expect(plan.rows[0].networked).toBe(false)
    expect(plan.missing).toEqual([])
    expect(plan.networkedCount).toBe(0)
  })

  it('zaehlt ein Geraet mit gesetzter Adresse mit, auch ohne Netz-Port', () => {
    // Sonst fiele ein von Hand gepflegtes Geraet aus der Doppel-IP-Pruefung
    // heraus -- ausgerechnet der Befund mit den handfestesten Folgen.
    const plan = buildAddressPlan([geraet('Altgeraet', { ipAddress: '10.0.0.5' })])
    expect(plan.rows[0].networked).toBe(true)
  })

  it('nennt den Port, der die Forderung ausgeloest hat', () => {
    // Eine Forderung ohne nachvollziehbaren Grund wird weggeklickt.
    const plan = buildAddressPlan([geraet('Stagebox', { inputs: [netzPort('AES67')] })])
    expect(plan.rows[0].evidence).toBe('NET 1 (AES67)')
    const ohneStandard = buildAddressPlan([
      geraet('Switch', { outputs: [port('Uplink', { connectorType: 'RJ45' })] }),
    ])
    expect(ohneStandard.rows[0].evidence).toBe('Uplink (RJ45)')
  })
})

describe('die fuenf Befunde sind nachrechenbar', () => {
  it('meldet dieselbe Adresse an zwei Geraeten -- und nennt das andere', () => {
    const plan = buildAddressPlan([
      geraet('Switch A', { ipAddress: '10.0.0.5', subnetMask: '255.255.255.0' }),
      geraet('Switch B', { ipAddress: '10.0.0.5', subnetMask: '255.255.255.0' }),
    ])
    const a = plan.rows[0].issues.find((i) => i.kind === 'duplicate-address')
    expect(a?.others).toEqual(['Switch B'])
    expect(plan.rows[1].issues.find((i) => i.kind === 'duplicate-address')?.others).toEqual(['Switch A'])
  })

  it('meldet die fehlende Maske, statt sie still auf /24 zu setzen', () => {
    // Die Netz-Uebersicht nimmt heute /24 an und markiert das nur dort.
    // Angenommen ist nicht gewusst.
    const plan = buildAddressPlan([geraet('Switch', { ipAddress: '10.0.0.5' })])
    expect(plan.rows[0].issues.map((i) => i.kind)).toContain('missing-mask')
    expect(plan.rows[0].cidr).toBeUndefined()
  })

  it('meldet ein Gateway ausserhalb des eigenen Subnetzes', () => {
    const plan = buildAddressPlan([
      geraet('Switch', { ipAddress: '10.0.0.5', subnetMask: '255.255.255.0', gateway: '10.0.1.1' }),
    ])
    expect(plan.rows[0].issues.map((i) => i.kind)).toContain('gateway-outside-subnet')
  })

  it('laesst ein Gateway IM Subnetz in Ruhe', () => {
    const plan = buildAddressPlan([
      geraet('Switch', { ipAddress: '10.0.0.5', subnetMask: '255.255.255.0', gateway: '10.0.0.1' }),
    ])
    expect(plan.rows[0].issues).toEqual([])
  })

  it('meldet Netz- und Broadcast-Adresse als Geraete-Adresse', () => {
    const netz = buildAddressPlan([geraet('X', { ipAddress: '10.0.0.0', subnetMask: '255.255.255.0' })])
    const bc = buildAddressPlan([geraet('Y', { ipAddress: '10.0.0.255', subnetMask: '255.255.255.0' })])
    expect(netz.rows[0].issues.map((i) => i.kind)).toContain('network-or-broadcast-address')
    expect(bc.rows[0].issues.map((i) => i.kind)).toContain('network-or-broadcast-address')
  })

  it('meldet sie NICHT auf /31 und /32', () => {
    // RFC 3021: auf einer Punkt-zu-Punkt-Strecke ist jede der beiden
    // Adressen benutzbar. Ein Fehlalarm auf einer voellig korrekten
    // Konfiguration kostet mehr, als der Befund dort einbraechte.
    const p31 = buildAddressPlan([geraet('P2P', { ipAddress: '10.0.0.0', subnetMask: '255.255.255.254' })])
    const p32 = buildAddressPlan([geraet('Loopback', { ipAddress: '10.0.0.7', subnetMask: '255.255.255.255' })])
    expect(p31.rows[0].issues).toEqual([])
    expect(p32.rows[0].issues).toEqual([])
  })

  it('behauptet nichts ueber einsame Subnetze oder ungewoehnliche Bereiche', () => {
    // Das waeren Vermutungen. Eine Warnung, die falsch anschlaegt, wird nach
    // dem zweiten Mal ignoriert -- dann auch die richtigen daneben.
    const plan = buildAddressPlan([
      geraet('Einzeln', { ipAddress: '192.168.177.42', subnetMask: '255.255.255.0', gateway: '192.168.177.1' }),
    ])
    expect(plan.rows[0].issues).toEqual([])
    expect(plan.withIssues).toEqual([])
  })
})

describe('der Plan vergibt keine Adressen', () => {
  it('schlaegt fuer ein Geraet ohne Adresse keine vor', () => {
    // Woher Subnetze kommen -- abgeleitet oder aus einem projektweiten Pool --
    // ist die offene Eigentuemer-Frage E-5. Ein Werkzeug, das waehrenddessen
    // selbst welche vergibt, entscheidet sie stillschweigend.
    const plan = buildAddressPlan([
      geraet('Switch A', { ipAddress: '10.0.0.5', subnetMask: '255.255.255.0' }),
      geraet('Stagebox', { inputs: [netzPort('Dante')] }),
    ])
    const stagebox = plan.rows[1]
    expect(stagebox.ip).toBeUndefined()
    expect(stagebox.cidr).toBeUndefined()
    expect(JSON.stringify(plan)).not.toContain('10.0.0.6')
  })
})

describe('CSV', () => {
  it('nimmt nur netzfaehige Geraete auf und traegt Beleg und Befunde', () => {
    const plan = buildAddressPlan([
      geraet('Kamera 1', { outputs: [port('SDI', { standard: 'SDI-12G' })] }),
      geraet('Stagebox', { inputs: [netzPort('Dante')] }),
    ])
    const rows = addressPlanTable(plan, (i) => i.kind, ['Gerät', 'IP', 'Maske', 'Gateway', 'Subnetz', 'Beleg', 'Befund'])
    expect(rows).toHaveLength(2) // Kopfzeile + Stagebox
    expect(rows[1][0]).toBe('Stagebox')
    expect(rows[1][5]).toBe('NET 1 (Dante)')
    expect(rows[1][6]).toBe('missing-address')
  })
})
