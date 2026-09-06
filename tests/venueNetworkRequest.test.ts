import { describe, expect, it } from 'vitest'
import {
  buildVenueNetworkRequest,
  rackDoorSheetTable,
  venueRequestTable,
  vlanTable,
} from '../src/renderer/lib/venueNetworkRequest'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { SignalStandard } from '../src/renderer/types/cableSpec'

// ---------------------------------------------------------------------------
// Das Haus-IT-Anforderungsblatt (Bedarf 23) und die Netz-Dokumente (Bedarf 22).
//
//   > There is no agreed document for asking a venue's IT department for
//   > VLANs, address ranges, multicast, IGMP querier behaviour, DHCP scope,
//   > port count, PoE and bandwidth.
//
// Die Design-Literatur schreibt den INHALT vor und einen gemeinsamen
// Testtermin, aber kein Dokument; die Ersatzloesung der Branche ist ein
// monatliches Treffen zwischen AV und IT.
//
// Geprueft wird die eine Regel, an der das Blatt brauchbar oder schaedlich
// wird: JEDE ZEILE SAGT, OB SIE ABGELEITET IST ODER EINE FRAGE. Ein Blatt, das
// die DHCP-Reichweite des Hauses „ausfuellt", legt dem Administrator eine
// Behauptung ueber sein eigenes Netz vor — und daran scheitert das Gespraech,
// das es eroeffnen soll.
// ---------------------------------------------------------------------------

const port = (name: string, standard?: SignalStandard): Port =>
  ({ id: `${name}-id`, name, type: 'port', connectorType: 'Ethernet/RJ45', standard }) as Port

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

const kabel = (standard: SignalStandard): Cable =>
  ({
    id: `c-${standard}-${Math.random()}`,
    fromEquipmentId: 'a',
    fromPortId: 'p',
    toEquipmentId: 'b',
    toPortId: 'q',
    type: 'Cat6',
    standard,
  }) as unknown as Cable

const item = (req: ReturnType<typeof buildVenueNetworkRequest>, key: string) =>
  req.items.find((i) => i.key === key)

describe('was der Plan weiss, steht mit Zahl da', () => {
  it('leitet VLANs aus Schnittstellen und Management-VLAN ab', () => {
    const req = buildVenueNetworkRequest(
      [
        geraet('Switch', { managementVlanId: 99 }),
        geraet('Stagebox', {
          ipAddress: '10.0.0.5',
          networkInterfaces: [{ id: 'n2', role: 'media-primary', ipAddress: '10.1.0.5', vlanId: 20 }],
        }),
      ],
      [],
    )
    expect(req.vlans).toEqual([20, 99])
    expect(item(req, 'vlans')?.origin).toBe('derived')
  })

  it('leitet die Adressbereiche aus denselben Geraete-Datensaetzen ab', () => {
    // „generated from one model" — kein zweites Datenmodell fuer das Blatt.
    const req = buildVenueNetworkRequest(
      [
        geraet('A', { ipAddress: '10.0.0.5', subnetMask: '255.255.255.0' }),
        geraet('B', { ipAddress: '10.0.1.5', subnetMask: '255.255.255.0' }),
      ],
      [],
    )
    expect(req.subnets).toEqual(['10.0.0.0/24', '10.0.1.0/24'])
  })

  it('zaehlt die Schnittstellen und nicht die Geraete', () => {
    // Die Portzahl ist das, was das Haus stellen muss. Ein Geraet mit drei
    // Karten braucht drei Ports.
    const req = buildVenueNetworkRequest(
      [
        geraet('Stagebox', {
          ipAddress: '10.0.0.5',
          networkInterfaces: [
            { id: 'n2', role: 'media-secondary', ipAddress: '10.1.0.5' },
            { id: 'n3', role: 'control', ipAddress: '192.168.1.5' },
          ],
        }),
      ],
      [],
    )
    expect(req.interfaceCount).toBe(3)
  })

  it('summiert nur Medien-Bandbreite, nicht Link-Kapazitaet', () => {
    // Dieselbe Trennung, die der Netz-Budget-Rechner seit dem Befund von
    // 2026-09-04 einhaelt: ein gezeichnetes Cat6a-Kabel ist keine Last.
    const req = buildVenueNetworkRequest([], [kabel('Dante'), kabel('Eth-10G')])
    expect(req.mediaMbps).toBe(49)
  })
})

describe('was der Plan NICHT weiss, steht als Frage da', () => {
  it('fuellt die DHCP-Reichweite des Hauses nicht aus', () => {
    const req = buildVenueNetworkRequest([geraet('A', { ipAddress: '10.0.0.5' })], [])
    const dhcp = item(req, 'dhcp')
    expect(dhcp?.origin).toBe('question')
    expect(dhcp?.value).toBeUndefined()
    expect(dhcp?.why).toContain('feste')
  })

  it('behauptet nichts ueber den IGMP-Querier', () => {
    const req = buildVenueNetworkRequest([], [kabel('Dante')])
    expect(item(req, 'igmpQuerier')?.origin).toBe('question')
    expect(item(req, 'igmpQuerier')?.value).toBeUndefined()
  })

  it('nennt den gemeinsamen Testtermin, den die Literatur vorschreibt', () => {
    const req = buildVenueNetworkRequest([], [])
    expect(item(req, 'jointTest')?.origin).toBe('question')
  })

  it('schliesst aus der Portzahl NICHT auf PoE', () => {
    // Die meisten AV-Geraete haben ein Netzteil. Ein erfundenes PoE-Budget
    // liesse das Haus eine Einspeisung planen, die niemand braucht.
    const req = buildVenueNetworkRequest([geraet('Kamera', { ipAddress: '10.0.0.5' })], [])
    expect(item(req, 'poe')?.origin).toBe('question')
  })

  it('nimmt PoE aber mit, wo ein Geraet es fuehrt', () => {
    const req = buildVenueNetworkRequest(
      [geraet('Switch', { categoryProps: { poeBudgetW: 370, poeStandard: 'at' } })],
      [],
    )
    const poe = item(req, 'poe')
    expect(poe?.origin).toBe('derived')
    expect(poe?.value).toContain('370 W')
    expect(poe?.value).toContain('at')
  })

  it('haengt an jede Frage einen Grund', () => {
    // Eine Frage ohne Grund liest sich wie ein Formular; mit Grund wie ein
    // Argument. Genau das ist der Unterschied, an dem dieses Gespraech haengt.
    const req = buildVenueNetworkRequest([], [])
    for (const i of req.items.filter((x) => x.origin === 'question')) {
      expect(i.why, `ohne Grund: ${i.key}`).toBeTruthy()
      expect((i.why ?? '').length).toBeGreaterThan(40)
    }
  })
})

describe('der Widerspruch bleibt stehen', () => {
  it('meldet ihn, wenn der Plan Audio- UND 2110-Multicast traegt', () => {
    // „the audio vendor's field advice is turn multicast management off, and
    // the video/2110 side cannot work without it … those two pieces of advice
    // are mutually exclusive". Das Blatt loest das nicht auf — es legt es dem
    // Haus VOR dem Aufbau hin.
    const req = buildVenueNetworkRequest([], [kabel('Dante'), kabel('ST2110-20')])
    expect(req.igmpConflict?.audio).toEqual(['Dante'])
    expect(req.igmpConflict?.video).toEqual(['ST2110-20'])
  })

  it('meldet ihn NICHT bei nur einer Sorte', () => {
    // Sonst leuchtete er auf jedem reinen Audio- und jedem reinen Video-Plan,
    // und eine Warnung, die immer dasteht, wird nicht gelesen.
    expect(buildVenueNetworkRequest([], [kabel('Dante')]).igmpConflict).toBeUndefined()
    expect(buildVenueNetworkRequest([], [kabel('ST2110-20')]).igmpConflict).toBeUndefined()
  })

  it('findet die Standards auch an Ports ohne Kabel', () => {
    // Ein Plan kann ein Geraet fuehren, dessen Kabel noch fehlt — die
    // Multicast-Frage haengt am Geraet und nicht am Kabel.
    const req = buildVenueNetworkRequest(
      [geraet('Stagebox', { inputs: [port('NET', 'Dante')] }), geraet('Cam', { outputs: [port('SFP', 'ST2110-20')] })],
      [],
    )
    expect(req.igmpConflict).toBeDefined()
  })
})

describe('die Netz-Dokumente (Bedarf 22)', () => {
  it('das Rack-Tuer-Blatt zeigt, was IST — ohne Befunde', () => {
    // An der Rack-Tuer hilft keine Warnung, dort hilft eine Zahl. Der
    // Adressplan zeigt, was FEHLT; dieses Blatt zeigt, was da ist.
    const t = rackDoorSheetTable([
      geraet('Stagebox', {
        ipAddress: '10.0.0.5',
        subnetMask: '255.255.255.0',
        networkInterfaces: [{ id: 'n2', label: 'Dante Sec', role: 'media-secondary', ipAddress: '10.1.0.5', vlanId: 20 }],
      }),
      geraet('Ohne Adresse'),
    ])
    expect(t.rows).toHaveLength(2)
    expect(t.rows[0][2]).toBe('10.0.0.5')
    expect(t.rows[1][1]).toBe('Dante Sec')
    expect(t.rows[1][5]).toBe(20)
    expect(t.headers).not.toContain('Befund')
  })

  it('die VLAN-Tabelle zaehlt je VLAN', () => {
    const t = vlanTable([
      geraet('A', { ipAddress: '10.0.0.5', managementVlanId: 20 }),
      geraet('B', {
        networkInterfaces: [{ id: 'n2', role: 'control', ipAddress: '10.0.0.6', vlanId: 20 }],
      }),
    ])
    expect(t.rows).toHaveLength(1)
    expect(t.rows[0][0]).toBe(20)
    expect(t.rows[0][2]).toBe(2)
  })

  it('das Anforderungsblatt trennt abgeleitet und Frage in einer eigenen Spalte', () => {
    const t = venueRequestTable(buildVenueNetworkRequest([], []))
    expect(t.headers).toEqual(['Punkt', 'Art', 'Aus dem Plan', 'Frage an das Haus', 'Quelle'])
    const arten = new Set(t.rows.map((r) => r[1]))
    expect(arten).toEqual(new Set(['abgeleitet', 'Frage']))
  })
})
