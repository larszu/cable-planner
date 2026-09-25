import { describe, expect, it } from 'vitest'
import {
  buildPortTrace,
  portTraceTable,
  traceOneLine,
} from '../src/renderer/lib/portTrace'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// Die Anschlussliste (Nutzer-Frage 2026-09-23).
//
//   > welches geraet auf welchem kabel an welchem patchfeld und welchem port
//   > vom patchfeld auf welchen port von welchem switch gesteckt ist
//
// Drei Dinge werden hier geprueft, und jedes davon ist ein Fehler, den der
// Plan vorher hatte:
//
//   (a) Der Weg laeuft UNGERICHTET. Die Switch-Port-Karte sah nur das direkte
//       Gegenueber, `signalChain` nur die Richtung `fromPort` -> `toPort`. Ein
//       Netzkabel, das jemand im Plan vom Switch zur Kamera gezogen hat, ist
//       dasselbe Kabel -- die Liste muss es von beiden Seiten finden.
//   (b) Das Patchfeld steht MIT BEIDEN Portnummern in der Zeile. Ohne die
//       zweite ist die Zeile vor dem Rack wertlos.
//   (c) Wo die Hand-Angabe und der gelaufene Weg sich widersprechen, bleibt
//       der Widerspruch stehen.
// ---------------------------------------------------------------------------

const port = (id: string, name: string): Port =>
  ({ id, name, type: 'port', connectorType: 'Ethernet/RJ45' }) as Port

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

/** Ein Switch ueber die Erkennung der Anwendung (Name), kein eigener Erkenner
 *  im Test -- sonst pruefte er eine Regel, die die Anwendung nicht benutzt. */
const switchMit = (ports: Port[], name = 'UniFi Switch'): EquipmentItem =>
  geraet(name, { inputs: ports })

const kabel = (
  id: string,
  from: [string, string],
  to: [string, string],
  over: Partial<Cable> = {},
): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
    type: 'Cat6',
    ...over,
  }) as unknown as Cable

/** Kamera -> Patchfeld (hinten 1 / vorn 1) -> Switch Port 12. */
const aufbau = (opts: { rueckwaerts?: boolean } = {}) => {
  const kamera = geraet('Kamera 1', {
    outputs: [port('kam-net', 'NET')],
    ipAddress: '10.0.0.9',
    subnetMask: '255.255.255.0',
    gateway: '10.0.0.1',
    macAddress: 'AA:BB:CC:00:00:09',
    managementVlanId: 30,
  })
  const blende = geraet('Patchfeld Regie', {
    isPatchPanel: true,
    inputs: [port('pp-r1', 'R1'), port('pp-r2', 'R2')],
    outputs: [port('pp-f1', 'F1'), port('pp-f2', 'F2')],
  })
  const sw = switchMit([port('sw-11', '11'), port('sw-12', '12')])

  const c1 = kabel('c1', [kamera.id, 'kam-net'], [blende.id, 'pp-r1'], { cableNumber: 'K-001' })
  // (a) Das zweite Kabel bewusst VOM SWITCH aus gezogen, wenn verlangt.
  const c2 = opts.rueckwaerts
    ? kabel('c2', [sw.id, 'sw-12'], [blende.id, 'pp-f1'], { cableNumber: 'K-002' })
    : kabel('c2', [blende.id, 'pp-f1'], [sw.id, 'sw-12'], { cableNumber: 'K-002' })

  return { kamera, blende, sw, cables: [c1, c2] }
}

describe('der Weg vom Geraet bis in den Switch-Port', () => {
  it('nennt Kabel, Patchfeld mit beiden Ports und den Switch-Port', () => {
    const { kamera, blende, sw, cables } = aufbau()
    const rows = buildPortTrace([kamera, blende, sw], cables)
    expect(rows).toHaveLength(1)
    const r = rows[0]
    expect(r.deviceName).toBe('Kamera 1')
    expect(r.devicePort).toBe('NET')
    expect(r.firstCableLabel).toBe('K-001')
    expect(r.stages).toHaveLength(1)
    expect(r.stages[0].deviceName).toBe('Patchfeld Regie')
    expect(r.stages[0].kind).toBe('patch-panel')
    expect(r.stages[0].inPort).toBe('R1')
    expect(r.stages[0].outPort).toBe('F1')
    expect(r.lastCableLabel).toBe('K-002')
    expect(r.switchName).toBe('UniFi Switch')
    expect(r.switchPort).toBe('12')
    expect(r.end).toBe('switch')
    expect(r.source).toBe('kabel')
  })

  it('findet denselben Weg, wenn das Kabel im Plan vom Switch aus gezogen wurde', () => {
    const { kamera, blende, sw, cables } = aufbau({ rueckwaerts: true })
    const rows = buildPortTrace([kamera, blende, sw], cables)
    expect(rows).toHaveLength(1)
    expect(rows[0].switchPort).toBe('12')
    expect(rows[0].stages[0].outPort).toBe('F1')
  })

  it('haengt die Netz-Angaben der Schnittstelle an die Zeile', () => {
    const { kamera, blende, sw, cables } = aufbau()
    const r = buildPortTrace([kamera, blende, sw], cables)[0]
    expect(r.ipAddress).toBe('10.0.0.9')
    expect(r.cidr).toBe('10.0.0.0/24')
    expect(r.gateway).toBe('10.0.0.1')
    expect(r.macAddress).toBe('AA:BB:CC:00:00:09')
    expect(r.vlanId).toBe(30)
  })

  it('nimmt den Segmentnamen zur VLAN-Id, wenn eines gepflegt ist', () => {
    const { kamera, blende, sw, cables } = aufbau()
    const r = buildPortTrace([kamera, blende, sw], cables, [
      { vlanId: 30, name: 'Steuerung', purpose: 'control' },
    ])[0]
    expect(r.segmentName).toBe('Steuerung')
  })

  it('schreibt den ganzen Weg in eine Zeile', () => {
    const { kamera, blende, sw, cables } = aufbau()
    const r = buildPortTrace([kamera, blende, sw], cables)[0]
    expect(traceOneLine(r)).toBe(
      'Kamera 1 · NET —[K-001]→ Patchfeld Regie R1/F1 —[K-002]→ UniFi Switch · 12',
    )
  })
})

describe('zwei Quellen fuer denselben Switch-Port', () => {
  it('sagt „beide", wenn Hand-Angabe und Kabelweg uebereinstimmen', () => {
    const { kamera, blende, sw, cables } = aufbau()
    kamera.networkInterfaces = [
      {
        id: 'nic-1',
        role: 'media-primary',
        label: 'NET',
        ipAddress: '10.0.0.9',
        portId: 'kam-net',
        switchEquipmentId: sw.id,
        switchPort: '12',
      },
    ]
    // Schnittstelle 0 aus den Alt-Feldern fiele sonst daneben und teilte die
    // Zuordnung; hier zaehlt allein die gepflegte Karte.
    kamera.ipAddress = undefined
    kamera.subnetMask = undefined
    kamera.gateway = undefined
    kamera.macAddress = undefined
    kamera.managementVlanId = undefined
    const rows = buildPortTrace([kamera, blende, sw], cables)
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('beide')
    expect(rows[0].conflict).toBeUndefined()
  })

  it('laesst den Widerspruch stehen, statt ihn wegzuraeumen', () => {
    const { kamera, blende, sw, cables } = aufbau()
    kamera.networkInterfaces = [
      {
        id: 'nic-1',
        role: 'media-primary',
        label: 'NET',
        ipAddress: '10.0.0.9',
        portId: 'kam-net',
        switchEquipmentId: sw.id,
        switchPort: '11',
      },
    ]
    kamera.ipAddress = undefined
    kamera.subnetMask = undefined
    kamera.gateway = undefined
    kamera.macAddress = undefined
    kamera.managementVlanId = undefined
    const r = buildPortTrace([kamera, blende, sw], cables)[0]
    // Der gelaufene Weg gewinnt in der Anzeige -- er folgt aus den Kabeln.
    expect(r.switchPort).toBe('12')
    expect(r.conflict).toContain('11')
  })
})

describe('wo die Verfolgung aufhoert, sagt sie warum', () => {
  it('meldet ein ungleich bestuecktes Patchfeld, statt zu raten', () => {
    const kamera = geraet('Kamera 1', {
      outputs: [port('kam-net', 'NET')],
      ipAddress: '10.0.0.9',
    })
    const blende = geraet('Blende schief', {
      isPatchPanel: true,
      inputs: [port('pp-r1', 'R1'), port('pp-r2', 'R2')],
      outputs: [port('pp-f1', 'F1')],
    })
    const r = buildPortTrace(
      [kamera, blende],
      [kabel('c1', [kamera.id, 'kam-net'], [blende.id, 'pp-r1'])],
    )[0]
    expect(r.end).toBe('mehrdeutig')
    expect(r.switchPort).toBeUndefined()
    expect(r.endNote).toContain('ungleich bestückt')
  })

  it('meldet eine Schnittstelle ganz ohne Kabel als offenen Punkt', () => {
    const kamera = geraet('Kamera 1', { ipAddress: '10.0.0.9' })
    const r = buildPortTrace([kamera], [])[0]
    expect(r.end).toBe('ohne-kabel')
    expect(r.ipAddress).toBe('10.0.0.9')
  })

  it('nennt das Geraet, an dem ein Weg statt am Switch endet', () => {
    const kamera = geraet('Kamera 1', { outputs: [port('kam-net', 'NET')], ipAddress: '10.0.0.9' })
    const monitor = geraet('Monitor Regie', { inputs: [port('mon-1', 'IN')] })
    const r = buildPortTrace(
      [kamera, monitor],
      [kabel('c1', [kamera.id, 'kam-net'], [monitor.id, 'mon-1'])],
    )[0]
    expect(r.end).toBe('anderes-gerät')
    expect(r.endNote).toContain('Monitor Regie')
  })

  it('laeuft durch einen Medienwandler mit genau einem weiteren Kabel', () => {
    const kamera = geraet('Kamera 1', { outputs: [port('kam-net', 'NET')], ipAddress: '10.0.0.9' })
    const wandler = geraet('Medienwandler', {
      isConverter: true,
      inputs: [port('mc-in', 'RJ45')],
      outputs: [port('mc-out', 'LC')],
    })
    const sw = switchMit([port('sw-1', '1')])
    const r = buildPortTrace(
      [kamera, wandler, sw],
      [
        kabel('c1', [kamera.id, 'kam-net'], [wandler.id, 'mc-in']),
        kabel('c2', [wandler.id, 'mc-out'], [sw.id, 'sw-1']),
      ],
    )[0]
    expect(r.stages.map((s) => s.kind)).toEqual(['converter'])
    expect(r.switchPort).toBe('1')
  })
})

describe('die Tabelle', () => {
  it('traegt Patchfeld und beide Ports als eigene Spalten', () => {
    const { kamera, blende, sw, cables } = aufbau()
    const tabelle = portTraceTable(buildPortTrace([kamera, blende, sw], cables))
    const i = (kopf: string) => tabelle.headers.indexOf(kopf)
    expect(i('Patchfeld')).toBeGreaterThanOrEqual(0)
    const zeile = tabelle.rows[0]
    expect(zeile[i('Patchfeld')]).toBe('Patchfeld Regie')
    expect(zeile[i('Port hinten')]).toBe('R1')
    expect(zeile[i('Port vorn')]).toBe('F1')
    expect(zeile[i('Switch')]).toBe('UniFi Switch')
    expect(zeile[i('Switch-Port')]).toBe('12')
    expect(zeile[i('IP')]).toBe('10.0.0.9')
    expect(zeile[i('Stationen')]).toBe(1)
  })
})
