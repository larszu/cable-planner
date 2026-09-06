import { describe, expect, it } from 'vitest'
import {
  normaliseMac,
  parseArpTable,
  parseScanCsv,
  reconcileNetwork,
  reconcileTable,
  stripDanteCollisionSuffix,
  type NetworkScan,
} from '../src/renderer/lib/networkReconcile'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// Plan gegen Vorgefundenes (Bedarf 21, P1).
//
// Die Bedarfs-Datenbank nennt ihn „the highest-value item in the dossier and
// nothing in the AV planning market does it", und beschreibt die Arbeit:
//
//   > what came off the truck, under which names, with which addresses, versus
//   > what the plan says. Kit returns from the previous job with the previous
//   > job's names -- Dante silently auto-renames collisions to 'Fred(2)'.
//
// Geprueft wird deshalb genau das, woran der Abgleich schaedlich statt
// nuetzlich wuerde: eine geratene Zuordnung (die erklaert ein fehlendes Geraet
// fuer anwesend), und eine Dante-Umbenennung, die als fehlend PLUS unerwartet
// erscheint -- zwei Befunde fuer einen Vorgang, beide irrefuehrend.
// ---------------------------------------------------------------------------

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

const scan = (entries: NetworkScan['entries']): NetworkScan => ({
  takenAt: '2026-09-06T08:00:00.000Z',
  source: 'arp.txt',
  entries,
})

describe('ARP-/Neighbour-Tabelle lesen', () => {
  it('liest die Ausgabe von `arp -a`', () => {
    const e = parseArpTable('stagebox.local (10.0.0.5) at aa:bb:cc:dd:ee:ff [ether] on eth0')
    expect(e).toEqual([{ name: 'stagebox.local', ipAddress: '10.0.0.5', macAddress: 'aa:bb:cc:dd:ee:ff' }])
  })

  it('liest die Ausgabe von `ip neigh`', () => {
    const e = parseArpTable('10.0.0.5 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE')
    expect(e).toEqual([{ ipAddress: '10.0.0.5', macAddress: 'aa:bb:cc:dd:ee:ff' }])
  })

  it('bastelt aus einem unaufgeloesten Namen keinen', () => {
    // `arp -a` schreibt `?`, wenn der Name nicht aufloest. Daraus einen zu
    // machen hiesse, dem Bericht einen Namen zu erfinden.
    const e = parseArpTable('? (10.0.0.9) at 11:22:33:44:55:66 [ether] on eth0')
    expect(e[0].name).toBeUndefined()
    expect(e[0].ipAddress).toBe('10.0.0.9')
  })

  it('liest die Windows-Form von `arp -a`, samt Bindestrich-MAC', () => {
    // Der Fall, den die erste Fassung halb gelesen haette: Adresse ja, MAC
    // nein -- und ausgerechnet die MAC ist die Messung, auf die der Abgleich
    // zuerst zugreift.
    const e = parseArpTable(
      'Interface: 10.0.0.1 --- 0x2\n  Internet Address      Physical Address      Type\n  10.0.0.5              aa-bb-cc-dd-ee-ff     dynamic',
    )
    expect(e).toEqual([{ ipAddress: '10.0.0.5', macAddress: 'aa-bb-cc-dd-ee-ff' }])
  })

  it('liest Ciscos Vierergruppen-MAC', () => {
    const e = parseArpTable('10.0.0.5 dev eth0 lladdr aabb.ccdd.eeff REACHABLE')
    expect(e[0].macAddress).toBe('aabb.ccdd.eeff')
  })

  it('macht aus Kopf- und Leerzeilen keine Geraete', () => {
    expect(parseArpTable('Interface: 10.0.0.1 --- 0x2\n\n  Internet Address   Physical Address   Type')).toEqual([])
  })
})

describe('CSV lesen', () => {
  it('ordnet Spalten ueber die Kopfzeile zu, deutsch wie englisch', () => {
    const e = parseScanCsv('Name;IP-Adresse;MAC\nStagebox;10.0.0.5;aa:bb:cc:dd:ee:ff')
    expect(e).toEqual([{ name: 'Stagebox', ipAddress: '10.0.0.5', macAddress: 'aa:bb:cc:dd:ee:ff' }])
  })

  it('nimmt eine Zeile ohne jeden Griff nicht auf', () => {
    expect(parseScanCsv('Name;IP\n;')).toEqual([])
  })

  it('kommt mit einem Trennzeichen im Feld zurecht', () => {
    // Der Grund, warum der Parser hochgezogen wurde statt neu geschrieben:
    // ein zweiter haette hier anders geantwortet als der erste.
    const e = parseScanCsv('Name,IP\n"Stagebox, Halle A",10.0.0.5')
    expect(e[0].name).toBe('Stagebox, Halle A')
  })
})

describe('MAC und Dante-Namen normalisieren', () => {
  it('vergleicht MACs unabhaengig von der Schreibweise', () => {
    // Drei Schreibweisen desselben Geraets: Doppelpunkt, Bindestrich, Cisco.
    const formen = ['aa:bb:cc:dd:ee:ff', 'AA-BB-CC-DD-EE-FF', 'aabb.ccdd.eeff']
    expect(new Set(formen.map(normaliseMac)).size).toBe(1)
  })

  it('erkennt die Dante-Kollisionsform', () => {
    expect(stripDanteCollisionSuffix('Stagebox (2)')).toBe('Stagebox')
    expect(stripDanteCollisionSuffix('Stagebox(2)')).toBe('Stagebox')
  })

  it('laesst eine echte Nummer im Namen in Ruhe', () => {
    // „Stagebox 2" ist ein Name, keine Umbenennung. Ihn zu kuerzen wuerde zwei
    // verschiedene Geraete zu einem machen.
    expect(stripDanteCollisionSuffix('Stagebox 2')).toBe('Stagebox 2')
    expect(stripDanteCollisionSuffix('Cam (Backup)')).toBe('Cam (Backup)')
  })
})

describe('der Abgleich', () => {
  const plan = () => [
    geraet('Stagebox', { ipAddress: '10.0.0.5', macAddress: 'aa:bb:cc:dd:ee:ff' }),
    geraet('Pult', { ipAddress: '10.0.0.6', macAddress: '11:22:33:44:55:66' }),
  ]

  it('ordnet ueber die MAC zu, auch wenn der Name anders ist', () => {
    // Die MAC ist eine Messung; das Geraet traegt sie, egal wie es heisst.
    const r = reconcileNetwork(plan(), scan([{ name: 'FOH-Box', macAddress: 'AA-BB-CC-DD-EE-FF', ipAddress: '10.0.0.5' }]))
    const row = r.rows.find((x) => x.planned === 'Stagebox')
    expect(row?.matchedBy).toBe('mac')
    expect(row?.verdict).toBe('name-mismatch')
  })

  it('meldet eine abweichende Adresse als solche', () => {
    const r = reconcileNetwork(plan(), scan([{ name: 'Stagebox', macAddress: 'aa:bb:cc:dd:ee:ff', ipAddress: '10.0.9.9' }]))
    expect(r.rows[0].verdict).toBe('address-mismatch')
    expect(r.rows[0].plannedIp).toBe('10.0.0.5')
    expect(r.rows[0].foundIp).toBe('10.0.9.9')
  })

  it('erkennt die Dante-Umbenennung als EINEN Vorgang', () => {
    // Ohne diese Regel steht in der Liste ein fehlendes „Stagebox" und ein
    // unerwartetes „Stagebox (2)" -- zwei Befunde fuer einen Vorgang, und
    // beide fuehren in die Irre.
    const r = reconcileNetwork(plan(), scan([{ name: 'Stagebox (2)', ipAddress: '10.0.0.5' }]))
    const row = r.rows.find((x) => x.planned === 'Stagebox')
    expect(row?.verdict).toBe('renamed')
    expect(r.counts.unexpected).toBe(0)
  })

  it('meldet ein Geraet, das der Plan nicht kennt', () => {
    const r = reconcileNetwork(plan(), scan([{ name: 'Fremd', ipAddress: '10.0.0.99', macAddress: '99:99:99:99:99:99' }]))
    expect(r.rows.find((x) => x.found === 'Fremd')?.verdict).toBe('unexpected')
  })

  it('meldet ein Geraet, das der Plan kennt und die Abtastung nicht fand', () => {
    const r = reconcileNetwork(plan(), scan([{ name: 'Stagebox', ipAddress: '10.0.0.5', macAddress: 'aa:bb:cc:dd:ee:ff' }]))
    expect(r.rows.filter((x) => x.verdict === 'missing').map((x) => x.planned)).toEqual(['Pult'])
  })

  it('ordnet NICHT zu, wenn es mehr als eine Moeglichkeit gibt', () => {
    // Regel aus orb-agent#558: nur anlegen, wenn beide Enden eindeutig sind.
    // Eine geratene Zuordnung erklaerte ein fehlendes Geraet fuer anwesend.
    const doppelt = [
      geraet('A', { ipAddress: '10.0.0.5' }),
      geraet('B', { ipAddress: '10.0.0.5' }),
    ]
    const r = reconcileNetwork(doppelt, scan([{ ipAddress: '10.0.0.5' }]))
    expect(r.rows[0].verdict).toBe('ambiguous')
    expect(r.rows[0].matchedBy).toBe('ip')
    // Und beide Plan-Zeilen bleiben „nicht gefunden" -- keine wird verbraucht.
    expect(r.counts.missing).toBe(2)
  })

  it('sieht ALLE Schnittstellen eines Geraets', () => {
    // Bedarf 19: sonst taucht die zweite Karte eines redundanten Aufbaus als
    // „nicht im Plan" auf -- und der Techniker sucht ein Geraet, das dasteht.
    const rig = [
      geraet('Stagebox', {
        ipAddress: '10.0.0.5',
        networkInterfaces: [{ id: 'n2', label: 'Dante Sec', role: 'media-secondary', ipAddress: '10.1.0.5' }],
      }),
    ]
    const r = reconcileNetwork(rig, scan([{ ipAddress: '10.1.0.5' }]))
    expect(r.rows[0].verdict).toBe('match')
    expect(r.rows[0].planned).toBe('Stagebox · Dante Sec')
  })

  it('traegt Zeitpunkt und Quelle mit', () => {
    // „Deliberate, timestamped, user-initiated." Ein Bericht ohne beides
    // liesse sich zwei Wochen spaeter nicht mehr einordnen.
    const r = reconcileNetwork(plan(), scan([]))
    expect(r.takenAt).toBe('2026-09-06T08:00:00.000Z')
    expect(r.source).toBe('arp.txt')
  })

  it('zaehlt jede Sorte', () => {
    const r = reconcileNetwork(
      plan(),
      scan([
        { name: 'Stagebox', ipAddress: '10.0.0.5', macAddress: 'aa:bb:cc:dd:ee:ff' },
        { name: 'Fremd', ipAddress: '10.0.0.99' },
      ]),
    )
    expect(r.counts.match).toBe(1)
    expect(r.counts.unexpected).toBe(1)
    expect(r.counts.missing).toBe(1)
  })
})

describe('das Modul beruehrt kein Geraet', () => {
  it('kennt weder fetch noch IPC', async () => {
    // „Deliberate, timestamped, user-initiated -- never a live feed." Der
    // Bedarf sagt es, und die Dossiers sagen warum: Dantes API ist
    // lizenz-gebunden, die offene Alternative erklaert sich selbst fuer
    // untauglich, und die offene ST-2110-Analyse ist eingestellt.
    const quelle = (await import('../src/renderer/lib/networkReconcile.ts?raw')).default as string
    expect(quelle).not.toMatch(/fetch\(|ipcRenderer|\.invoke\(|axios|WebSocket/)
  })
})

describe('CSV des Berichts', () => {
  it('nennt Befund, Plan, Fund und die Zuordnungsgrundlage', () => {
    const r = reconcileNetwork(
      [geraet('Stagebox', { ipAddress: '10.0.0.5', macAddress: 'aa:bb:cc:dd:ee:ff' })],
      scan([{ name: 'Stagebox (2)', ipAddress: '10.0.0.5', macAddress: 'aa:bb:cc:dd:ee:ff' }]),
    )
    const t = reconcileTable(r)
    expect(t.headers[0]).toBe('Befund')
    expect(t.rows[0][0]).toBe('umbenannt (Kollisionsform)')
    expect(t.rows[0][6]).toBe('MAC')
  })
})
