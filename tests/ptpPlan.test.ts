import { describe, expect, it } from 'vitest'
import {
  FAMILY_LABEL,
  PTP_FINDING_LABEL,
  buildPtpPlan,
  familiesByDevice,
  ptpTable,
} from '../src/renderer/lib/ptpPlan'
import { PTP_PROFILE_DEFAULT_DOMAIN, interfaceIsEmpty } from '../src/renderer/types/network'
import { deviceInterfaces, normaliseNetworkInterface } from '../src/renderer/lib/networkInterfaces'
import { NETWORK_INTERFACE_ROLES, type NetworkInterfaceRole } from '../src/renderer/types/network'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import analyseQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import nicPanelQuelle from '../src/renderer/components/Properties/sections/ExtraInterfacesPanel.tsx?raw'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'

// ---------------------------------------------------------------------------
// Der Zeit-Plan (Bedarf 73, P2).
//
//   > PTP domain number, grandmaster and boundary-clock topology live
//   > nowhere. No Excel network-documentation template in the German or
//   > English source set has a column for them. ST 2059-2 defaults to domain
//   > 127 while AES67 commonly uses domain 0, so mixed 2110/AES67 rigs
//   > receive packets with wrong media clocks.
//
// Der Bedarf nennt es „a rule a human violates blind and a tool enforces for
// free". Die Betonung liegt auf ENFORCE als PRUEFUNG: der Plan stellt die
// Frage und setzt keine Zahlen — welche Domaene richtig ist, entscheidet ein
// Mensch mit einem Boundary-Clock-Switch.
// ---------------------------------------------------------------------------

const nic = (over: Record<string, unknown>) => ({ id: 'n', role: 'media-primary', ...over })

const geraet = (
  id: string,
  name: string,
  nics: Array<Record<string, unknown>> = [],
): EquipmentItem =>
  ({
    id,
    name,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    category: 'Netzwerk',
    inputs: [],
    outputs: [],
    networkInterfaces: nics.map((n, i) => nic({ ...n, id: `${id}#nic${i + 1}` })),
  }) as unknown as EquipmentItem

const kabel = (id: string, from: string, to: string, standard: string): Cable =>
  ({
    id,
    name: id,
    type: 'cat',
    length: 5,
    color: '#fff',
    fromEquipmentId: from,
    fromPortId: `${from}-p`,
    toEquipmentId: to,
    toPortId: `${to}-p`,
    notes: '',
    standard,
  }) as unknown as Cable

describe('Bedarf 73 — die Essenz-Familie kommt aus dem Kabelgraph', () => {
  it('erkennt Audio und Video getrennt', () => {
    const eq = [geraet('mic', 'Stagebox'), geraet('cam', 'Kamera'), geraet('sw', 'Switch')]
    const fam = familiesByDevice(eq, [
      kabel('k1', 'mic', 'sw', 'Dante'),
      kabel('k2', 'cam', 'sw', 'ST2110-20'),
    ])
    expect(fam.get('mic')).toEqual(['audio'])
    expect(fam.get('cam')).toEqual(['video'])
    expect(fam.get('sw')).toEqual(['audio', 'video'])
  })

  it('zaehlt Licht ueber IP NICHT mit', () => {
    // sACN/Art-Net haengen an keinem PTP-Takt. Sie mitzuzaehlen wuerde einen
    // Widerspruch melden, den es nicht gibt.
    const eq = [geraet('dim', 'Dimmer'), geraet('sw', 'Switch')]
    const fam = familiesByDevice(eq, [kabel('k1', 'dim', 'sw', 'sACN')])
    expect(fam.size).toBe(0)
  })

  it('ignoriert ein Kabel ins Leere', () => {
    const eq = [geraet('cam', 'Kamera')]
    const fam = familiesByDevice(eq, [kabel('k1', 'cam', 'weg', 'ST2110-20')])
    expect(fam.get('cam')).toEqual(['video'])
    expect(fam.has('weg')).toBe(false)
  })
})

describe('Bedarf 73 — der belegte Schaden: zwei Familien auf einer Domaene', () => {
  const gemischt = () => {
    const eq = [
      geraet('mic', 'Stagebox', [{ ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'grandmaster' }]),
      geraet('cam', 'Kamera', [{ ptpDomain: 0, ptpProfile: 'aes67' }]),
      geraet('sw', 'Switch'),
    ]
    const cab = [kabel('k1', 'mic', 'sw', 'AES67'), kabel('k2', 'cam', 'sw', 'ST2110-20')]
    return buildPtpPlan(eq, cab)
  }

  it('meldet den Zusammenstoss und nennt beide Familien', () => {
    const p = gemischt()
    const f = p.findings.find((x) => x.kind === 'domain-clash')
    expect(f).toBeDefined()
    expect(f!.domain).toBe(0)
    expect(f!.text).toContain(FAMILY_LABEL.audio)
    expect(f!.text).toContain(FAMILY_LABEL.video)
    // Die Zahlen, um die es geht, stehen im Text — sonst muss sie jemand
    // nachschlagen, und dann liest er den Befund nicht zu Ende.
    expect(f!.text).toContain('127')
    expect(f!.text).toContain('0')
  })

  it('nennt die beteiligten Geraete, damit man springen kann', () => {
    const f = gemischt().findings.find((x) => x.kind === 'domain-clash')!
    expect(f.deviceIds.sort()).toEqual(['cam', 'mic'])
  })

  it('meldet NICHT, wenn die Familien in getrennten Domaenen liegen', () => {
    const eq = [
      geraet('mic', 'Stagebox', [{ ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'grandmaster' }]),
      geraet('cam', 'Kamera', [{ ptpDomain: 127, ptpProfile: 'st2059-2', ptpRole: 'grandmaster' }]),
      geraet('sw', 'Switch'),
    ]
    const p = buildPtpPlan(eq, [
      kabel('k1', 'mic', 'sw', 'AES67'),
      kabel('k2', 'cam', 'sw', 'ST2110-20'),
    ])
    expect(p.findings.filter((f) => f.kind === 'domain-clash')).toHaveLength(0)
  })
})

describe('Bedarf 73 — die uebrigen vier Befunde', () => {
  it('meldet KEINEN Profil-Konflikt, wenn nur eines erklaert ist', () => {
    // Der Normalfall in jedem bestehenden Plan: ein Geraet ist gepflegt, das
    // daneben nicht. `unspecified` ist keine zweite Meinung, sondern gar
    // keine. Eine Gegenprobe, die den Filter entfernte, blieb zunaechst gruen.
    const eq = [
      geraet('a', 'A', [{ ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'grandmaster' }]),
      geraet('b', 'B', [{ ptpDomain: 0 }]),
      geraet('sw', 'Switch'),
    ]
    const p = buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'Dante'), kabel('k2', 'b', 'sw', 'Dante')])
    expect(p.findings.some((f) => f.kind === 'profile-clash')).toBe(false)
  })

  it('zwei Profile auf einer Domaene', () => {
    const eq = [
      geraet('a', 'A', [{ ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'grandmaster' }]),
      geraet('b', 'B', [{ ptpDomain: 0, ptpProfile: 'default' }]),
      geraet('sw', 'Switch'),
    ]
    const p = buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'Dante'), kabel('k2', 'b', 'sw', 'Dante')])
    expect(p.findings.some((f) => f.kind === 'profile-clash')).toBe(true)
  })

  it('Domaene weicht von der Profil-Vorgabe ab — mit der Vorgabe im Text', () => {
    const eq = [geraet('a', 'A', [{ ptpDomain: 5, ptpProfile: 'st2059-2', ptpRole: 'grandmaster' }]), geraet('sw', 'S')]
    const p = buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'ST2110-20')])
    const f = p.findings.find((x) => x.kind === 'off-default')
    expect(f).toBeDefined()
    expect(f!.text).toContain(String(PTP_PROFILE_DEFAULT_DOMAIN['st2059-2']))
    // Und ausdruecklich KEIN Fehler: abweichende Domaenen sind ueblich.
    expect(f!.text).toContain('kein Fehler')
  })

  it('meldet keine Abweichung, wenn Profil und Domaene zusammenpassen', () => {
    const eq = [geraet('a', 'A', [{ ptpDomain: 127, ptpProfile: 'st2059-2', ptpRole: 'grandmaster' }]), geraet('sw', 'S')]
    const p = buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'ST2110-20')])
    expect(p.findings.some((f) => f.kind === 'off-default')).toBe(false)
  })

  it('Domaene ohne erklaerte Uhr', () => {
    const eq = [geraet('a', 'A', [{ ptpDomain: 0, ptpProfile: 'aes67' }]), geraet('sw', 'S')]
    const p = buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'Dante')])
    expect(p.findings.some((f) => f.kind === 'no-grandmaster')).toBe(true)
  })

  it('Domaene mit zwei erklaerten Uhren', () => {
    const eq = [
      geraet('a', 'A', [{ ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'grandmaster' }]),
      geraet('b', 'B', [{ ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'grandmaster' }]),
      geraet('sw', 'S'),
    ]
    const p = buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'Dante'), kabel('k2', 'b', 'sw', 'Dante')])
    const f = p.findings.find((x) => x.kind === 'two-grandmaster')
    expect(f).toBeDefined()
    expect(f!.text).toContain('A')
    expect(f!.text).toContain('B')
  })

  it('jeder Befund hat eine Beschriftung', () => {
    for (const k of Object.keys(PTP_FINDING_LABEL)) {
      expect(PTP_FINDING_LABEL[k as keyof typeof PTP_FINDING_LABEL].length).toBeGreaterThan(0)
    }
  })
})

describe('Bedarf 73 — `unspecified` ist nirgends ein Befund', () => {
  it('ein Geraet ohne PTP-Angabe erzeugt keine Warnung', () => {
    // Sonst waere jeder bestehende Plan eine Wand aus Warnungen, und die
    // fuenf echten Befunde lagen darin begraben.
    const eq = [geraet('a', 'A', [{ ptpDomain: 0 }]), geraet('sw', 'S')]
    const p = buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'Dante')])
    expect(p.findings.filter((f) => f.kind === 'profile-clash')).toHaveLength(0)
    expect(p.findings.filter((f) => f.kind === 'off-default')).toHaveLength(0)
  })

  it('ein Profil ohne Vorgabe-Domaene erzeugt keine Abweichung', () => {
    expect(PTP_PROFILE_DEFAULT_DOMAIN.unspecified).toBeNull()
  })
})

describe('Bedarf 73 — wer keine Domaene nennt, steht auf einer eigenen Liste', () => {
  it('fuehrt nur Geraete mit PTP-abhaengiger Essenz auf', () => {
    const eq = [
      geraet('cam', 'Kamera', [{ ipAddress: '10.0.0.5' }]),
      geraet('laptop', 'Laptop', [{ ipAddress: '10.0.0.6' }]),
      geraet('sw', 'Switch'),
    ]
    const p = buildPtpPlan(eq, [
      kabel('k1', 'cam', 'sw', 'ST2110-20'),
      kabel('k2', 'laptop', 'sw', 'Eth-1G'),
    ])
    expect(p.withoutDomain).toContain('cam')
    expect(p.withoutDomain).not.toContain('laptop')
  })

  it('ist kein Befund — die Liste steht neben den Befunden, nicht darin', () => {
    const eq = [geraet('cam', 'Kamera', [{ ipAddress: '10.0.0.5' }]), geraet('sw', 'S')]
    const p = buildPtpPlan(eq, [kabel('k1', 'cam', 'sw', 'ST2110-20')])
    expect(p.withoutDomain).toEqual(['cam'])
    expect(p.findings).toHaveLength(0)
  })

  it('nennt jedes Geraet nur einmal, auch bei zwei Schnittstellen', () => {
    const eq = [
      geraet('cam', 'Kamera', [{ ipAddress: '10.0.0.5' }, { ipAddress: '10.0.1.5' }]),
      geraet('sw', 'S'),
    ]
    const p = buildPtpPlan(eq, [kabel('k1', 'cam', 'sw', 'ST2110-20')])
    expect(p.withoutDomain).toEqual(['cam'])
  })
})

describe('Bedarf 73 — needsPtp trennt den SDI-Aufbau vom IP-Aufbau', () => {
  it('ein reiner SDI-Plan braucht den Abschnitt nicht', () => {
    const eq = [geraet('cam', 'Kamera'), geraet('mix', 'Mischer')]
    const p = buildPtpPlan(eq, [kabel('k1', 'cam', 'mix', 'SDI-3G')])
    expect(p.needsPtp).toBe(false)
    expect(p.findings).toHaveLength(0)
  })

  it('ein Dante-Kabel reicht', () => {
    const eq = [geraet('a', 'A'), geraet('b', 'B')]
    expect(buildPtpPlan(eq, [kabel('k1', 'a', 'b', 'Dante')]).needsPtp).toBe(true)
  })
})

describe('Bedarf 73 — das Blatt', () => {
  it('fuehrt eine Zeile je Schnittstelle in einer Domaene', () => {
    const eq = [
      geraet('a', 'A', [{ ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'grandmaster', label: 'Dante Pri' }]),
      geraet('sw', 'S'),
    ]
    const tab = ptpTable(buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'Dante')]))
    expect(tab.headers).toEqual(['Domaene', 'Schnittstelle', 'Profil', 'Rolle', 'Essenz'])
    expect(tab.rows).toHaveLength(1)
    expect(tab.rows[0][0]).toBe(0)
    expect(String(tab.rows[0][1])).toContain('Dante Pri')
  })

  it('traegt KEINE Befunde — die tragen Fliesstext', () => {
    // Ein Blatt, dessen Stand sich mit jeder Umformulierung aendert, meldete
    // jedes gedruckte Exemplar als veraltet.
    const eq = [geraet('a', 'A', [{ ptpDomain: 0, ptpProfile: 'aes67' }]), geraet('sw', 'S')]
    const p = buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'Dante')])
    expect(p.findings.length).toBeGreaterThan(0)
    const tab = ptpTable(p)
    const alles = tab.rows.flat().map(String).join(' ')
    for (const f of p.findings) expect(alles).not.toContain(f.text)
  })

  it('setzt keinen Platzhalter, wo keine Rolle steht', () => {
    const eq = [geraet('a', 'A', [{ ptpDomain: 0 }]), geraet('sw', 'S')]
    const tab = ptpTable(buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'Dante')]))
    expect(tab.rows[0]).not.toContain('unspecified')
  })

  it('sortiert die Domaenen aufsteigend', () => {
    const eq = [
      geraet('a', 'A', [{ ptpDomain: 127, ptpProfile: 'st2059-2', ptpRole: 'grandmaster' }]),
      geraet('b', 'B', [{ ptpDomain: 0, ptpProfile: 'aes67', ptpRole: 'grandmaster' }]),
      geraet('sw', 'S'),
    ]
    const tab = ptpTable(
      buildPtpPlan(eq, [kabel('k1', 'a', 'sw', 'ST2110-20'), kabel('k2', 'b', 'sw', 'Dante')]),
    )
    expect(tab.rows.map((r) => r[0])).toEqual([0, 127])
  })
})

describe('Bedarf 73 — verdrahtet', () => {
  it('der Netz-Tab baut den Zeit-Plan und exportiert ihn', () => {
    expect(analyseQuelle).toMatch(/buildPtpPlan\(equipment, cables\)/)
    expect(analyseQuelle).toMatch(/csvFromTable\(ptpTable\(ptp\)\)/)
  })

  it('die Schnittstelle hat Felder fuer alle drei Angaben des Bedarfs', () => {
    for (const feld of ['ptpDomain', 'ptpProfile', 'ptpRole']) {
      expect(nicPanelQuelle).toContain(`patch(n.id, {\n                        ${feld}:`)
    }
  })

  it('kein Feld wird vorbelegt — auch nicht in der ANZEIGE', () => {
    // Die beiden Profile setzen VERSCHIEDENE Vorgabe-Domaenen; eine geratene
    // waere genau der Widerspruch, den die Pruefung suchen soll.
    //
    // Die Anzeige zaehlt mit: eine Gegenprobe setzte `value={n.ptpDomain ?? 127}`
    // und blieb gruen, weil die Zusicherung nur den SCHREIB-Pfad ansah. Auf
    // dem Bildschirm haette dann 127 gestanden, ohne dass es irgendwo
    // gespeichert ist -- und der naechste Leser haette es geglaubt.
    expect(nicPanelQuelle).not.toMatch(/ptpDomain:\s*127/)
    expect(nicPanelQuelle).not.toMatch(/ptpDomain:\s*0\b/)
    expect(nicPanelQuelle).not.toMatch(/ptpProfile:\s*'st2059-2'/)
    expect(nicPanelQuelle).toContain("value={n.ptpDomain ?? ''}")
    expect(nicPanelQuelle).toContain("value={n.ptpProfile ?? 'unspecified'}")
    expect(nicPanelQuelle).toContain("value={n.ptpRole ?? 'unspecified'}")
  })

  it('das Blatt ist als Dokument registriert und beschriftet', () => {
    // Am REGISTER pruefen, nicht am Quelltext: eine erste Fassung suchte
    // `'ptp-plan':` im Text von `documentRegistry.ts` und blieb gruen, als
    // der Stand-Eintrag umbenannt wurde -- die Beschriftungs-Zeile darunter
    // enthaelt dieselbe Zeichenfolge und hat die Zusicherung erfuellt.
    expect(typeof DOCUMENT_STANDS['ptp-plan']).toBe('function')
    expect(DOCUMENT_LABELS['ptp-plan']).toBe('Zeit-Plan (PTP)')
  })
})

describe('Bedarf 73 — die Felder ueberleben Laden und Speichern', () => {
  // Beide Luecken hier waren echt und sind beim Bauen der Tests aufgefallen.
  // Sie haetten dieselbe Form gehabt wie jeder stille Verlust: die Eingabe
  // steht auf dem Bildschirm, ist beim naechsten Oeffnen weg, und nirgends
  // steht warum.

  it('eine Schnittstelle mit NUR einer PTP-Domaene gilt nicht als leer', () => {
    // `deviceInterfaces` wirft leere Schnittstellen weg. Ohne diese Regel
    // waere die Eingabe „nur die Domaene" beim naechsten Laden verschwunden.
    expect(interfaceIsEmpty({ id: 'n1', role: 'unspecified', ptpDomain: 127 })).toBe(false)
    expect(interfaceIsEmpty({ id: 'n1', role: 'unspecified', ptpProfile: 'aes67' })).toBe(false)
    expect(interfaceIsEmpty({ id: 'n1', role: 'unspecified', ptpRole: 'grandmaster' })).toBe(false)
    expect(interfaceIsEmpty({ id: 'n1', role: 'unspecified' })).toBe(true)
  })

  it('eine PTP-only-Schnittstelle kommt bei deviceInterfaces an', () => {
    const e = geraet('a', 'A', [{ ptpDomain: 0 }])
    expect(deviceInterfaces(e)).toHaveLength(1)
  })

  const roleOk = (r: unknown): r is NetworkInterfaceRole =>
    typeof r === 'string' && (NETWORK_INTERFACE_ROLES as readonly string[]).includes(r)

  it('die Normalisierung uebernimmt alle drei Felder', () => {
    const n = normaliseNetworkInterface(
      { id: 'n1', role: 'media-primary', ptpDomain: 127, ptpProfile: 'st2059-2', ptpRole: 'grandmaster' },
      'fb',
      roleOk,
    )
    expect(n).toMatchObject({ ptpDomain: 127, ptpProfile: 'st2059-2', ptpRole: 'grandmaster' })
  })

  it('speichert `unspecified` NICHT — das ist die Abwesenheit einer Angabe', () => {
    const n = normaliseNetworkInterface(
      { id: 'n1', role: 'media-primary', ipAddress: '10.0.0.1', ptpProfile: 'unspecified', ptpRole: 'unspecified' },
      'fb',
      roleOk,
    )
    expect(n && 'ptpProfile' in n).toBe(false)
    expect(n && 'ptpRole' in n).toBe(false)
  })

  it('verwirft einen erfundenen Profilnamen', () => {
    const n = normaliseNetworkInterface(
      { id: 'n1', role: 'media-primary', ipAddress: '10.0.0.1', ptpProfile: 'ptpv3' },
      'fb',
      roleOk,
    )
    expect(n && 'ptpProfile' in n).toBe(false)
  })

  it('liest eine Domaene ueber 127 GROSSZUEGIG', () => {
    // Die Oberflaeche bietet 0..127, weil die beiden relevanten Profile dort
    // liegen. IEEE 1588-2019 laesst mehr zu; eine gespeicherte 200 stammt von
    // irgendwo her, und sie wegzuwerfen waere ein stiller Verlust.
    const n = normaliseNetworkInterface(
      { id: 'n1', role: 'media-primary', ptpDomain: 200 },
      'fb',
      roleOk,
    )
    expect(n?.ptpDomain).toBe(200)
  })

  it('verwirft eine Domaene ausserhalb jedes gueltigen Bereichs', () => {
    for (const bad of [-1, 256, 1.5, '0']) {
      const n = normaliseNetworkInterface(
        { id: 'n1', role: 'media-primary', ipAddress: '10.0.0.1', ptpDomain: bad },
        'fb',
        roleOk,
      )
      expect(n && 'ptpDomain' in n).toBe(false)
    }
  })
})
