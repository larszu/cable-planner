import { describe, expect, it } from 'vitest'
import {
  allDeviceInterfaces,
  deviceInterfaces,
  deviceInterfacesIncludingEmpty,
  isPrimaryInterface,
  isNetworkInterfaceRole,
  normaliseNetworkInterface,
  primaryInterfaceId,
} from '../src/renderer/lib/networkInterfaces'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ---------------------------------------------------------------------------
// Mehrere Netzwerk-Schnittstellen je Geraet (Bedarf 19, P1).
//
// Der Bedarf sagt, was fehlte, und warnt im selben Atemzug vor dem Zeitpunkt:
//
//   > Real AV devices have 2-4 NICs: Dante primary/secondary, 2110 red/blue
//   > media plus separate control … Getting this wrong at schema level is
//   > expensive to fix later.
//
// Die Regel dieses Moduls ist eine einzige, und alles darunter prueft sie:
// DIE ALT-FELDER SIND SCHNITTSTELLE 0. Es gibt je Adresse genau ein Zuhause;
// `networkInterfaces` haelt 1..n. Wer das umdreht, bekommt zwei Wahrheiten
// ueber dieselbe IP -- und die Doppel-IP-Pruefung des Adressplans meldet
// danach jedes Geraet gegen sich selbst.
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

describe('die Alt-Felder sind Schnittstelle 0', () => {
  it('macht aus ipAddress/Maske/Gateway/MAC die erste Schnittstelle', () => {
    const nics = deviceInterfaces(
      geraet('Kamera', {
        ipAddress: '10.0.0.5',
        subnetMask: '255.255.255.0',
        gateway: '10.0.0.1',
        macAddress: 'aa:bb:cc:dd:ee:ff',
      }),
    )
    expect(nics).toHaveLength(1)
    expect(nics[0]).toMatchObject({
      ipAddress: '10.0.0.5',
      subnetMask: '255.255.255.0',
      gateway: '10.0.0.1',
      macAddress: 'aa:bb:cc:dd:ee:ff',
    })
    expect(nics[0].id).toBe(primaryInterfaceId('id-Kamera'))
  })

  it('nimmt das Management-VLAN als VLAN der ersten Schnittstelle', () => {
    const nics = deviceInterfaces(geraet('Switch', { ipAddress: '10.0.0.2', managementVlanId: 99 }))
    expect(nics[0].vlanId).toBe(99)
  })

  it('raet die Rolle NICHT', () => {
    // Ob die eine IP einer Kamera ihre Steuerung oder ihr Medienweg ist, weiss
    // der Plan nicht. Eine geratene Rolle erschiene in jeder Liste als Aussage.
    expect(deviceInterfaces(geraet('Kamera', { ipAddress: '10.0.0.5' }))[0].role).toBe('unspecified')
  })

  it('nimmt eine gesetzte Rolle fuer die erste Schnittstelle', () => {
    const e = geraet('Kamera', { ipAddress: '10.0.0.5', primaryInterfaceRole: 'control' })
    expect(deviceInterfaces(e)[0].role).toBe('control')
  })

  it('laesst die erste Schnittstelle weg, wenn dort nichts steht', () => {
    // Ein Geraet, das nur eine zweite Karte gepflegt hat, soll keine leere
    // erste vorgesetzt bekommen -- sonst zaehlt jede Liste eine Schnittstelle
    // mehr, als es gibt.
    const e = geraet('Stagebox', {
      networkInterfaces: [{ id: 'n2', role: 'media-secondary', ipAddress: '10.1.0.5' }],
    })
    const nics = deviceInterfaces(e)
    expect(nics).toHaveLength(1)
    expect(nics[0].id).toBe('n2')
  })

  it('zeigt der Oberflaeche die leere erste trotzdem', () => {
    // Sonst gaebe es kein Formular, in das jemand die erste Adresse eintraegt.
    expect(deviceInterfacesIncludingEmpty(geraet('Neu'))).toHaveLength(1)
  })
})

describe('mehrere Schnittstellen', () => {
  const danteRig = () =>
    geraet('Stagebox', {
      ipAddress: '10.0.0.5',
      subnetMask: '255.255.255.0',
      primaryInterfaceRole: 'media-primary',
      networkInterfaces: [
        { id: 'n2', label: 'Dante Sec', role: 'media-secondary', ipAddress: '10.1.0.5' },
        { id: 'n3', label: 'Control', role: 'control', ipAddress: '192.168.1.5' },
      ],
    })

  it('liefert alle drei, die erste zuerst', () => {
    const nics = deviceInterfaces(danteRig())
    expect(nics.map((n) => n.ipAddress)).toEqual(['10.0.0.5', '10.1.0.5', '192.168.1.5'])
    expect(nics.map((n) => n.role)).toEqual(['media-primary', 'media-secondary', 'control'])
  })

  it('sagt, welche die erste ist', () => {
    const e = danteRig()
    const nics = deviceInterfaces(e)
    expect(isPrimaryInterface(e, nics[0].id)).toBe(true)
    expect(isPrimaryInterface(e, nics[1].id)).toBe(false)
  })

  it('zaehlt keine Adresse doppelt', () => {
    // Der Fehler, den eine Spiegelung machen wuerde: die Alt-Felder AUCH in
    // `networkInterfaces` zu fuehren. Dann meldete die Doppel-IP-Pruefung
    // jedes Geraet gegen sich selbst.
    const adressen = deviceInterfaces(danteRig()).map((n) => n.ipAddress)
    expect(new Set(adressen).size).toBe(adressen.length)
  })

  it('ueberspringt leere Zusatz-Schnittstellen', () => {
    const e = geraet('X', {
      ipAddress: '10.0.0.5',
      networkInterfaces: [{ id: 'n2', role: 'unspecified' }],
    })
    expect(deviceInterfaces(e)).toHaveLength(1)
  })

  it('BEHAELT eine Schnittstelle, an der nur die ROLLE steht (Bedarf 72)', () => {
    // Aufgefallen beim Multicast-Adressplan: waehrend der Planung hat noch
    // keine der beiden Medien-Karten eine Adresse — es steht nur die Rolle da.
    // Bis Bedarf 72 galt so eine Schnittstelle als leer und flog raus, und der
    // Adressplan haette anschliessend behauptet, dieser Fluss brauche nur EIN
    // 2022-7-Bein. Dieselbe Begruendung wie beim Etikett eine Zeile weiter
    // unten: eine ausgesprochene Rolle IST eine Aussage.
    const e = geraet('X', {
      ipAddress: '10.0.0.5',
      networkInterfaces: [{ id: 'n2', role: 'media-secondary' }],
    })
    expect(deviceInterfaces(e)).toHaveLength(2)
  })

  it('sammelt sie ueber den ganzen Plan mit ihrem Geraet', () => {
    const alle = allDeviceInterfaces([danteRig(), geraet('Kamera', { ipAddress: '10.0.0.9' })])
    expect(alle).toHaveLength(4)
    expect(alle.filter((d) => d.primary)).toHaveLength(2)
    expect(alle[0].equipment.name).toBe('Stagebox')
  })
})

describe('Normalisierung beim Laden', () => {
  // Derselbe Waechter, den der Store benutzt — zwei Listen waeren zwei
  // Wahrheiten darueber, welche Rollen es gibt.
  const roleOk = isNetworkInterfaceRole

  it('faellt bei unbekannter Rolle auf unspecified zurueck', () => {
    const n = normaliseNetworkInterface({ id: 'n2', role: 'telepathy', ipAddress: '10.0.0.5' }, 'x', roleOk)
    expect(n?.role).toBe('unspecified')
  })

  it('vergibt eine Id, wenn die Datei keine mitbringt', () => {
    expect(normaliseNetworkInterface({ ipAddress: '10.0.0.5' }, 'gen-3', roleOk)?.id).toBe('gen-3')
  })

  it('wirft eine voellig leere Schnittstelle weg', () => {
    // Ballast in jedem Projektfile, und in der Port-Karte eine Zeile ohne Inhalt.
    // „Voellig leer" heisst: auch OHNE ausgesprochene Rolle — `unspecified` ist
    // die Abwesenheit einer Angabe und traegt nichts bei.
    expect(normaliseNetworkInterface({ id: 'n2', role: 'unspecified' }, 'x', roleOk)).toBeNull()
    expect(normaliseNetworkInterface({ id: 'n2' }, 'x', roleOk)).toBeNull()
    // Eine nur beschriftete bleibt: „SFP+ 2" ohne Adresse ist eine Aussage.
    expect(normaliseNetworkInterface({ id: 'n2', label: 'SFP+ 2' }, 'x', roleOk)).not.toBeNull()
    // Und eine nur mit Rolle genauso — Bedarf 72. Sie hier zu verwerfen liesse
    // das Sekundaernetz beim naechsten Laden verschwinden.
    expect(normaliseNetworkInterface({ id: 'n2', role: 'media-secondary' }, 'x', roleOk)?.role).toBe(
      'media-secondary',
    )
  })

  it('nimmt nur VLAN-Ids, die es geben kann', () => {
    for (const bad of [-1, 4095, 1.5, '12']) {
      expect(
        normaliseNetworkInterface({ ipAddress: '10.0.0.5', vlanId: bad }, 'x', roleOk)?.vlanId,
        `VLAN ${String(bad)}`,
      ).toBeUndefined()
    }
    expect(normaliseNetworkInterface({ ipAddress: '10.0.0.5', vlanId: 100 }, 'x', roleOk)?.vlanId).toBe(100)
  })

  it('gibt bei Unsinn null statt zu werfen', () => {
    expect(normaliseNetworkInterface(null, 'x', roleOk)).toBeNull()
    expect(normaliseNetworkInterface('nein', 'x', roleOk)).toBeNull()
  })
})
