import { describe, expect, it } from 'vitest'
import {
  buildSwitchPortMaps,
  switchPortDescriptionBlock,
  switchPortTable,
} from '../src/renderer/lib/switchPortMap'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
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

// ---------------------------------------------------------------------------
// Festinstallation: zwischen Switch und Geraet liegen Blenden.
//
// Gefunden am Beispiel „3 PTZ Saal → Regie": Kamera → Wandfeld im Saal →
// Hausstrecke → Patchfeld in der Regie → Switch. Die Karte nannte das
// Patchfeld und meldete bei jeder Kamera „Kabel sagt: PP-R-01" — einen
// Widerspruch, den es nicht gab, und zwar an fast jedem Port einer
// fest installierten Anlage.
// ---------------------------------------------------------------------------
describe('durch Blenden', () => {
  const blende = (name: string, n: number, over: Partial<EquipmentItem> = {}) =>
    geraet(name, {
      category: 'Patch panels',
      inputs: Array.from({ length: n }, (_, i) => port(`${name}-v${i + 1}`, `${i + 1}`)),
      outputs: Array.from({ length: n }, (_, i) => port(`${name}-h${i + 1}`, `${i + 1} hinten`)),
      ...over,
    })

  const aufbau = (mitNic: boolean) => {
    const sw = switchMit([port('s1', '1'), port('s2', '2')])
    const kamera = geraet('PTZ 1', {
      inputs: [port('k-lan', 'LAN')],
      ipAddress: '10.20.30.11',
      ...(mitNic
        ? { networkInterfaces: [{ id: 'n', label: 'LAN', role: 'control', ipAddress: '10.20.30.11', switchEquipmentId: sw.id, switchPort: '1' }] }
        : {}),
    })
    const waf = blende('WAF-EG-01', 2, { category: 'Sonstiges', frontplatte: { art: 'wandfeld' } } as Partial<EquipmentItem>)
    const pp = blende('PP-R-01', 2)
    const cables = [
      kabel([kamera.id, 'k-lan'], [waf.id, 'WAF-EG-01-v1']),
      kabel([waf.id, 'WAF-EG-01-h1'], [pp.id, 'PP-R-01-h1']),
      kabel([pp.id, 'PP-R-01-v1'], [sw.id, 's1']),
    ]
    return { sw, kamera, waf, pp, cables }
  }

  it('nennt das Geraet hinter Patchfeld und Wandfeld, samt Weg', () => {
    const { sw, kamera, waf, pp, cables } = aufbau(false)
    const row = buildSwitchPortMaps([sw, kamera, waf, pp], cables)[0].rows[0]
    expect(row.device).toBe('PTZ 1')
    expect(row.nicLabel).toBe('LAN')
    expect(row.ipAddress).toBe('10.20.30.11')
    expect(row.via).toEqual(['PP-R-01', 'WAF-EG-01'])
  })

  it('meldet keinen Widerspruch, wenn Schnittstelle und Kabelweg dasselbe sagen', () => {
    const { sw, kamera, waf, pp, cables } = aufbau(true)
    const row = buildSwitchPortMaps([sw, kamera, waf, pp], cables)[0].rows[0]
    expect(row.conflict).toBeUndefined()
    expect(row.source).toBe('interface')
    expect(row.via).toEqual(['PP-R-01', 'WAF-EG-01'])
  })

  it('bleibt an der Blende stehen, wenn dahinter nichts gesteckt ist', () => {
    const { sw, kamera, waf, pp, cables } = aufbau(false)
    const row = buildSwitchPortMaps([sw, kamera, waf, pp], cables.slice(1))[0].rows[0]
    expect(row.device).toBe('WAF-EG-01')
    expect(row.via).toEqual(['PP-R-01'])
  })

  it('laeuft in einer Schleife nicht endlos', () => {
    const sw = switchMit([port('s1', '1')])
    const pp = blende('PP', 2)
    const cables = [
      kabel([pp.id, 'PP-v1'], [sw.id, 's1']),
      kabel([pp.id, 'PP-h1'], [pp.id, 'PP-v2']),
      kabel([pp.id, 'PP-h2'], [pp.id, 'PP-v1']),
    ]
    const row = buildSwitchPortMaps([sw, pp], cables)[0].rows[0]
    expect(row.device).toBe('PP')
  })

  it('zaehlt eine PoE-Kamera hinter Blenden ins Budget', () => {
    const { sw, kamera, waf, pp, cables } = aufbau(false)
    const budgetSwitch = { ...sw, categoryProps: { poeBudgetW: 10 } } as EquipmentItem
    const verbraucher = { ...kamera, powerConsumptionWatts: 25 } as EquipmentItem
    const befunde = runDrawingChecks({ equipment: [budgetSwitch, verbraucher, waf, pp], cables }).findings
    expect(befunde.some((f) => f.id === `poe-over:${sw.id}`)).toBe(true)
  })
})
