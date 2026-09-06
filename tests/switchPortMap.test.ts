import { describe, expect, it } from 'vitest'
import {
  buildSwitchPortMaps,
  switchPortDescriptionBlock,
  switchPortTable,
} from '../src/renderer/lib/switchPortMap'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// Die Switch-Port-Karte (Bedarf 24, P1).
//
//   > Switch port descriptions are often the only documentation physically
//   > co-located with the hardware, and they go stale first; when they do,
//   > tracing a cable becomes a physical task.
//
// Die deutsche Praxis dazu ist eine Excel-Mappe mit einem Reiter je Switch,
// von Hand gepflegt -- also die zweite Wahrheit neben dem Plan, und die, die
// zuerst veraltet. Die Bedarfs-Datenbank verlangt deshalb, Switch, Port und
// das Kabel darin in DENSELBEN Graphen zu nehmen und die Karte zu erzeugen.
//
// Geprueft wird genau das Ausrechnen: dass beide Quellen (gepflegte
// Schnittstelle, verlegtes Kabel) gefunden werden, dass die Karte SAGT,
// welche es war, und dass ein Widerspruch zwischen ihnen stehenbleibt statt
// stillschweigend weggeraeumt zu werden.
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

/** Ein Geraet, das `detectNetworkDevice` als Switch erkennt — ueber den Namen,
 *  wie es die Heuristik dort tut. Kein eigener Erkenner im Test: sonst pruefte
 *  er eine Regel, die die Anwendung gar nicht benutzt. */
const switchMit = (ports: Port[]): EquipmentItem =>
  geraet('UniFi Switch', { inputs: ports })

const kabel = (from: [string, string], to: [string, string]): Cable =>
  ({
    id: `c-${from[1]}-${to[1]}`,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
    type: 'Cat6',
  }) as unknown as Cable

describe('welche Geraete ueberhaupt Switches sind', () => {
  it('nimmt die Erkennung der Anwendung, nicht eine eigene', () => {
    const sw = switchMit([port('p1', '1')])
    const kamera = geraet('Kamera 1', { ipAddress: '10.0.0.9' })
    const maps = buildSwitchPortMaps([sw, kamera], [])
    expect(maps.map((m) => m.switchName)).toEqual(['UniFi Switch'])
  })

  it('kann auf einen bestimmten Switch eingeschraenkt werden', () => {
    const a = switchMit([port('p1', '1')])
    const b = geraet('Netgear GS Switch', { inputs: [port('q1', '1')] })
    expect(buildSwitchPortMaps([a, b], [], b.id).map((m) => m.switchName)).toEqual(['Netgear GS Switch'])
  })
})

describe('woher eine Belegung kommt', () => {
  it('nimmt die gepflegte Schnittstelle und sagt es', () => {
    const sw = switchMit([port('p1', '1'), port('p2', '2')])
    const kamera = geraet('Kamera 1', {
      ipAddress: '10.0.0.9',
      networkInterfaces: [
        { id: 'n2', label: 'Control', role: 'control', ipAddress: '10.0.0.9', switchEquipmentId: sw.id, switchPort: '2', vlanId: 20 },
      ],
    })
    const map = buildSwitchPortMaps([sw, kamera], [])[0]
    const p2 = map.rows.find((r) => r.port === '2')
    expect(p2).toMatchObject({ device: 'Kamera 1', nicLabel: 'Control', vlanId: 20, source: 'interface' })
  })

  it('leitet sie sonst aus dem Kabel ab und sagt AUCH das', () => {
    // Der Plan weiss, was dort steckt, auch wenn niemand es in die Netz-Maske
    // getippt hat. Eine Belegung ohne Herkunft waere eine Behauptung.
    const sw = switchMit([port('p1', '1')])
    const kamera = geraet('Kamera 1', { outputs: [port('k1', 'NET')] })
    const map = buildSwitchPortMaps([sw, kamera], [kabel([kamera.id, 'k1'], [sw.id, 'p1'])])[0]
    expect(map.rows[0]).toMatchObject({ device: 'Kamera 1', nicLabel: 'NET', source: 'cable' })
  })

  it('findet das Kabel in beide Richtungen', () => {
    const sw = switchMit([port('p1', '1')])
    const kamera = geraet('Kamera 1', { outputs: [port('k1', 'NET')] })
    const map = buildSwitchPortMaps([sw, kamera], [kabel([sw.id, 'p1'], [kamera.id, 'k1'])])[0]
    expect(map.rows[0].device).toBe('Kamera 1')
  })

  it('laesst einen freien Port frei, statt etwas zu erfinden', () => {
    const map = buildSwitchPortMaps([switchMit([port('p1', '1'), port('p2', '2')])], [])[0]
    expect(map.rows.map((r) => r.device)).toEqual([undefined, undefined])
    expect(map.usedCount).toBe(0)
  })
})

describe('wenn beide Quellen etwas sagen', () => {
  it('nimmt die gepflegte Angabe und laesst den Widerspruch stehen', () => {
    // Weggeraeumt waere er unsichtbar -- und genau dieser Widerspruch ist der
    // Grund, warum die Excel-Mappe veraltet: jemand hat umgesteckt.
    const sw = switchMit([port('p1', '1')])
    const gepflegt = geraet('Pult', {
      networkInterfaces: [{ id: 'n2', role: 'control', ipAddress: '10.0.0.4', switchEquipmentId: sw.id, switchPort: '1' }],
    })
    const verkabelt = geraet('Kamera 1', { outputs: [port('k1', 'NET')] })
    const map = buildSwitchPortMaps(
      [sw, gepflegt, verkabelt],
      [kabel([verkabelt.id, 'k1'], [sw.id, 'p1'])],
    )[0]
    expect(map.rows[0].device).toBe('Pult')
    expect(map.rows[0].conflict).toBe('Kamera 1')
  })

  it('meldet KEINEN Widerspruch, wenn beide dasselbe Geraet nennen', () => {
    // Sonst leuchtete die Warnung auf jedem sauber gepflegten Aufbau.
    const sw = switchMit([port('p1', '1')])
    const kamera = geraet('Kamera 1', {
      outputs: [port('k1', 'NET')],
      networkInterfaces: [{ id: 'n2', role: 'control', ipAddress: '10.0.0.9', switchEquipmentId: sw.id, switchPort: '1' }],
    })
    const map = buildSwitchPortMaps([sw, kamera], [kabel([kamera.id, 'k1'], [sw.id, 'p1'])])[0]
    expect(map.rows[0].conflict).toBeUndefined()
  })

  it('behaelt eine Schnittstelle, die einen Port nennt, den es nicht gibt', () => {
    // Genau der Tippfehler, den die Karte finden soll. Wegwerfen hiesse, ihn
    // zu verstecken.
    const sw = switchMit([port('p1', '1')])
    const pult = geraet('Pult', {
      networkInterfaces: [{ id: 'n2', role: 'control', ipAddress: '10.0.0.4', switchEquipmentId: sw.id, switchPort: '48' }],
    })
    const map = buildSwitchPortMaps([sw, pult], [])[0]
    expect(map.rows.map((r) => r.port)).toEqual(['1', '48'])
  })
})

describe('der einfuegbare Beschreibungsblock', () => {
  const aufbau = () => {
    const sw = switchMit([port('p1', '1'), port('p2', '2')])
    const kamera = geraet('Kamera 1', {
      networkInterfaces: [{ id: 'n2', label: 'Control', role: 'control', ipAddress: '10.0.0.9', switchEquipmentId: sw.id, switchPort: '1' }],
    })
    return buildSwitchPortMaps([sw, kamera], [])[0]
  }

  it('schreibt je belegtem Port eine Beschreibung', () => {
    const block = switchPortDescriptionBlock(aufbau())
    expect(block).toContain('interface 1')
    expect(block).toContain('description Kamera 1 Control 10.0.0.9')
  })

  it('laesst freie Ports aus', () => {
    // Eine Beschreibung, die einen Port leert, den jemand ausserhalb dieses
    // Plans belegt hat, richtet Schaden an.
    expect(switchPortDescriptionBlock(aufbau())).not.toContain('interface 2')
  })

  it('schickt nichts an einen Switch — er erzeugt nur Text', () => {
    // Die Bedarfs-Datenbank sagt es ausdruecklich: „Do NOT push config to live
    // switches — generating a paste-able description block is the defensible"
    // Weg. Ein Quelltext-Test, weil die Zusage sonst nur im Kommentar staende.
    const src = new URL('../src/renderer/lib/switchPortMap.ts', import.meta.url)
    return import(`${src.pathname}?raw`).then((m) => {
      const quelle = m.default as string
      expect(quelle).not.toMatch(/fetch\(|ipcRenderer|\.invoke\(|axios/)
    })
  })
})

describe('CSV', () => {
  it('traegt Port, Geraet, Quelle und Widerspruch', () => {
    const sw = switchMit([port('p1', '1')])
    const kamera = geraet('Kamera 1', {
      networkInterfaces: [{ id: 'n2', label: 'Control', role: 'control', ipAddress: '10.0.0.9', switchEquipmentId: sw.id, switchPort: '1', vlanId: 20 }],
    })
    const table = switchPortTable(buildSwitchPortMaps([sw, kamera], [])[0])
    expect(table.headers[0]).toBe('Port')
    expect(table.rows[0]).toEqual(['1', 'Kamera 1', 'Control', '10.0.0.9', 20, 'Schnittstelle', ''])
  })
})
