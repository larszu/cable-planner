import { beforeEach, describe, expect, it } from 'vitest'
import {
  RANGE_HEADERS,
  addressTemplateFindings,
  addressTemplateTable,
  normaliseAddressLayers,
  normaliseAddressRange,
  proposeReaddress,
  resolveLayers,
  type AddressTemplateFindingKind,
} from '../src/renderer/lib/addressTemplate'
import {
  addressInRange,
  cidrContains,
  cidrsOverlap,
  hostPart,
  ipToNumber,
  numberToIp,
  parseCidr,
  rangeSize,
  rangeToCidr,
  withHostPart,
} from '../src/renderer/lib/subnet'
import {
  ADDRESS_RANGE_KINDS,
  type AddressLayer,
  type AddressRange,
} from '../src/renderer/types/addressTemplate'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { NetworkInterface } from '../src/renderer/types/network'
import { useProjectStore } from '../src/renderer/store/projectStore'
import libQuelle from '../src/renderer/lib/addressTemplate.ts?raw'
import typenQuelle from '../src/renderer/types/addressTemplate.ts?raw'
import panelQuelle from '../src/renderer/components/Network/AddressTemplatePanel.tsx?raw'
import dialogQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'

// ---------------------------------------------------------------------------
// BEDARF 20 (P1) — schichtbare Adressbereichs-Vorlagen.
//
//   > Layerable address-range templates: a truck/rig standing plan plus a
//   > per-venue overlay, with live conflict validation.
//
// Der Schaden aus der Bedarfs-Datenbank: doppelte IPs „could freeze up part of
// your network", eine unpassende Maske erzeugt „pings from here but not from
// there".
//
// WAS DIESE DATEI VOR ALLEM ABSICHERT, ist nicht, dass die Befunde kommen —
// das ist die leichte Haelfte —, sondern dass die drei Fehlalarme AUSBLEIBEN,
// die im Kopf von `addressTemplate.ts` begruendet sind: keine Meldung ueber
// zwei Praefixe auf einer VLAN, keine ueber einen stehenden Bereich, den das
// Haus nicht ersetzt, und keine ueber ein Geraet ausserhalb aller Bereiche,
// solange fuer seine Rolle gar keiner geplant ist.
// ---------------------------------------------------------------------------

const nic = (over: Partial<NetworkInterface> & { id: string }): NetworkInterface => ({
  role: 'unspecified',
  ...over,
})

const eq = (id: string, name: string, nics: NetworkInterface[]): EquipmentItem =>
  ({
    id,
    name,
    category: 'Netzwerk',
    inputs: [],
    outputs: [],
    x: 0,
    y: 0,
    width: 200,
    height: 160,
    networkInterfaces: nics,
  }) as unknown as EquipmentItem

const range = (over: Partial<AddressRange> & { id: string; cidr: string }): AddressRange => ({
  key: over.id,
  name: over.id,
  role: 'unspecified',
  kind: 'assignable',
  ...over,
})

const layer = (over: Partial<AddressLayer> & { id: string }): AddressLayer => ({
  kind: 'standing',
  name: over.id,
  ranges: [],
  ...over,
})

const kinds = (f: { kind: AddressTemplateFindingKind }[]): AddressTemplateFindingKind[] =>
  f.map((x) => x.kind)

// ── 1. Die Rechenbasis ─────────────────────────────────────────────────────

describe('CIDR-Rechnung in subnet.ts', () => {
  it('rechnet oberhalb von 127.x.x.x richtig — die Vorzeichen-Falle', () => {
    // `192 << 24` ist in JavaScript negativ. Waere hier mit Bit-Operatoren
    // gerechnet, laege 192.168.1.1 VOR 10.0.0.1, und jede Enthaltensein-
    // Pruefung im gesamten privaten Bereich 192.168/16 antwortete falsch.
    expect(ipToNumber('192.168.1.1')).toBe(3232235777)
    expect(ipToNumber('255.255.255.255')).toBe(4294967295)
    expect(ipToNumber('10.0.0.1')).toBeLessThan(ipToNumber('192.168.1.1') as number)
    expect(numberToIp(3232235777)).toBe('192.168.1.1')
    const gross = parseCidr('192.168.0.0/16')
    expect(addressInRange('192.168.255.254', gross!)).toBe(true)
    expect(addressInRange('10.0.0.1', gross!)).toBe(false)
  })

  it('rundet eine nicht-kanonische Schreibweise auf ihr Netz', () => {
    const r = parseCidr('10.0.5.7/24')
    expect(rangeToCidr(r!)).toBe('10.0.5.0/24')
    expect(rangeSize(r!)).toBe(256)
  })

  it('kennt die Randlaengen /0, /31 und /32', () => {
    expect(rangeSize(parseCidr('0.0.0.0/0')!)).toBe(4294967296)
    expect(rangeSize(parseCidr('10.0.0.0/31')!)).toBe(2)
    const einzel = parseCidr('10.0.0.7/32')!
    expect(rangeSize(einzel)).toBe(1)
    expect(addressInRange('10.0.0.7', einzel)).toBe(true)
    expect(addressInRange('10.0.0.8', einzel)).toBe(false)
  })

  it('lehnt ab, was kein CIDR ist', () => {
    for (const schrott of ['', '10.0.0.0', '10.0.0.0/33', '10.0.0.0/x', 'abc/24', '10.0.0.0/24/8']) {
      expect(parseCidr(schrott)).toBeNull()
    }
  })

  it('enthaelt und ueberlappt so, wie ein Intervall es tut', () => {
    const acht = parseCidr('10.0.0.0/8')!
    const vierundzwanzig = parseCidr('10.0.5.0/24')!
    const fremd = parseCidr('172.16.0.0/12')!
    expect(cidrContains(acht, vierundzwanzig)).toBe(true)
    expect(cidrContains(vierundzwanzig, acht)).toBe(false)
    expect(cidrContains(acht, acht)).toBe(true)
    expect(cidrsOverlap(acht, vierundzwanzig)).toBe(true)
    expect(cidrsOverlap(acht, fremd)).toBe(false)
    // Beruehrende, aber getrennte Nachbarn duerfen NICHT ueberlappen —
    // das ist der Off-by-one, an dem Intervall-Vergleiche sterben.
    expect(cidrsOverlap(parseCidr('10.0.0.0/25')!, parseCidr('10.0.0.128/25')!)).toBe(false)
  })

  it('haelt den Host-Anteil fest und setzt ihn woanders wieder ein', () => {
    expect(hostPart('10.2.0.57', 24)).toBe(57)
    expect(withHostPart(parseCidr('172.20.5.0/24')!, 57)).toBe('172.20.5.57')
    // Passt nicht: .200 gibt es in einem /29 nicht.
    expect(withHostPart(parseCidr('172.20.5.0/29')!, 200)).toBeNull()
  })
})

// ── 2. Die Ueberlagerung ───────────────────────────────────────────────────

const stehend = layer({
  id: 'wagen',
  kind: 'standing',
  name: 'Uebertragungswagen 2',
  ranges: [
    range({ id: 'r1', key: 'control', name: 'Steuerung', cidr: '10.2.0.0/16', role: 'control' }),
    range({
      id: 'r2',
      key: 'dante-pri',
      name: 'Dante primaer',
      cidr: '10.3.0.0/16',
      role: 'media-primary',
    }),
    range({ id: 'r3', key: 'mgmt', name: 'Mgmt', cidr: '192.168.10.0/24', role: 'management' }),
  ],
})

const haus = layer({
  id: 'halle',
  kind: 'venue',
  name: 'Stadthalle',
  ranges: [
    range({ id: 'h1', key: 'control', name: 'Haus-Steuerung', cidr: '172.20.5.0/24', role: 'control' }),
  ],
})

describe('resolveLayers — die Haus-Ebene gewinnt', () => {
  it('ersetzt genau den Bereich mit demselben Schluessel und laesst die anderen stehen', () => {
    const geltend = resolveLayers([stehend, haus])
    expect(geltend).toHaveLength(3)
    const control = geltend.find((r) => r.key === 'control')!
    expect(control.cidr).toBe('172.20.5.0/24')
    expect(control.from).toBe('venue')
    expect(control.replaces).toEqual({
      cidr: '10.2.0.0/16',
      name: 'Steuerung',
      layerName: 'Uebertragungswagen 2',
    })
    // Die anderen beiden gelten unveraendert weiter — das ist der Normalfall
    // einer Ueberlagerung und KEIN Befund.
    expect(geltend.find((r) => r.key === 'dante-pri')!.cidr).toBe('10.3.0.0/16')
    expect(geltend.find((r) => r.key === 'mgmt')!.from).toBe('standing')
  })

  it('gewinnt auch, wenn sie im Array VOR dem stehenden Plan steht', () => {
    // Die Array-Reihenfolge ist eine Anzeige-Eigenschaft. Duerfte sie
    // entscheiden, haenge die Adresse, die die Crew eintippt, daran, in
    // welcher Reihenfolge jemand die Ebenen angelegt hat.
    const geltend = resolveLayers([haus, stehend])
    expect(geltend.find((r) => r.key === 'control')!.cidr).toBe('172.20.5.0/24')
    expect(geltend.find((r) => r.key === 'control')!.replaces?.cidr).toBe('10.2.0.0/16')
  })

  it('laesst Bereiche ohne Schluessel nebeneinander stehen', () => {
    // Ohne Schluessel gibt es keine Zuordnung. Beide gelten additiv; einen
    // von beiden stillschweigend zu verwerfen waere eine erfundene Zuordnung.
    const ohne = layer({
      id: 'x',
      ranges: [
        range({ id: 'a', key: '', cidr: '10.8.0.0/16' }),
        range({ id: 'b', key: '  ', cidr: '10.9.0.0/16' }),
      ],
    })
    expect(resolveLayers([ohne])).toHaveLength(2)
  })

  it('wirft einen Bereich weg, dessen CIDR keiner ist', () => {
    const kaputt = layer({ id: 'x', ranges: [range({ id: 'a', key: 'k', cidr: 'kein CIDR' })] })
    expect(resolveLayers([kaputt])).toHaveLength(0)
  })
})

// ── 3. Die Befunde ─────────────────────────────────────────────────────────

describe('addressTemplateFindings — Bereiche gegeneinander', () => {
  it('meldet zwei vergebbare Bereiche, die sich ueberschneiden', () => {
    const l = layer({
      id: 'x',
      ranges: [
        range({ id: 'a', key: 'a', cidr: '10.0.0.0/16' }),
        range({ id: 'b', key: 'b', cidr: '10.0.5.0/24' }),
      ],
    })
    expect(kinds(addressTemplateFindings([l]))).toEqual(['overlap'])
  })

  it('meldet NICHT, wenn eine Klammer ihren Unterbereich enthaelt', () => {
    // Das ist die Aufgabe einer Klammer. Sie zu melden hiesse, jede saubere
    // Hierarchie als Fehler auszugeben — und dann klickt niemand mehr hin.
    const l = layer({
      id: 'x',
      ranges: [
        range({ id: 'a', key: 'haus', cidr: '10.0.0.0/8', kind: 'container' }),
        range({ id: 'b', key: 'b', cidr: '10.0.5.0/24' }),
      ],
    })
    expect(addressTemplateFindings([l])).toHaveLength(0)
  })

  it('meldet zwei Bereiche mit demselben CIDR, von denen keiner Klammer ist', () => {
    const l = layer({
      id: 'x',
      ranges: [
        range({ id: 'a', key: 'a', cidr: '10.0.0.0/16' }),
        range({ id: 'b', key: 'b', cidr: '10.0.0.0/16' }),
      ],
    })
    expect(kinds(addressTemplateFindings([l]))).toEqual(['overlap'])
  })

  it('kennt keinen halb ueberlappenden Fall — CIDR-Bereiche schachteln sich', () => {
    // Zwei CIDR-Bereiche sind entweder disjunkt oder der eine liegt
    // vollstaendig im anderen. Das ist der Grund, warum der Befund im
    // Klartext „der aeussere ist keine Klammer" heisst und nicht „sie
    // ueberschneiden sich teilweise": diesen dritten Fall gibt es nicht.
    // Faellt die Eigenschaft weg, faellt die Begruendung des Befundes weg.
    const beispiele: [string, string][] = [
      ['10.0.0.0/16', '10.0.128.0/9'],
      ['192.168.1.128/25', '192.168.0.0/16'],
      ['172.16.4.0/22', '172.16.5.0/24'],
    ]
    for (const [x, y] of beispiele) {
      const a = parseCidr(x)!
      const b = parseCidr(y)!
      if (!cidrsOverlap(a, b)) continue
      expect(cidrContains(a, b) || cidrContains(b, a)).toBe(true)
    }
  })

  it('meldet denselben Schluessel zweimal IN EINER Ebene', () => {
    const l = layer({
      id: 'x',
      ranges: [
        range({ id: 'a', key: 'control', cidr: '10.1.0.0/16' }),
        range({ id: 'b', key: 'control', cidr: '10.2.0.0/16' }),
      ],
    })
    const f = addressTemplateFindings([l])
    expect(f.filter((x) => x.kind === 'key-twice')).toHaveLength(1)
    expect(f[0].message).toContain('nicht entscheidbar')
  })

  it('meldet denselben Schluessel UEBER Ebenen hinweg nicht — das ist der Zweck', () => {
    expect(kinds(addressTemplateFindings([stehend, haus]))).toEqual([])
  })

  it('meldet einen Haus-Bereich, der nichts ersetzt UND kollidiert', () => {
    // Der Tippfehler-Fall: „contol" statt „control". Die gemeinte Ersetzung
    // findet nicht statt, der Wagen-Bereich gilt weiter — und die Crew
    // adressiert nach dem Wagen, waehrend das Haus etwas anderes zugesagt hat.
    const vertippt = layer({
      id: 'halle',
      kind: 'venue',
      ranges: [range({ id: 'h1', key: 'contol', cidr: '10.2.9.0/24' })],
    })
    const f = addressTemplateFindings([stehend, vertippt])
    expect(kinds(f)).toContain('venue-orphan')
    expect(f.find((x) => x.kind === 'venue-orphan')!.message).toContain('vertippt')
  })

  it('meldet einen Haus-Bereich in freiem Raum NICHT', () => {
    // Das Haus stellt einen Bereich, den der Wagen nicht vorgesehen hatte.
    // Voellig normal — und ohne Ueberschneidung auch harmlos.
    const zusatz = layer({
      id: 'halle',
      kind: 'venue',
      ranges: [range({ id: 'h1', key: 'gaeste-wlan', cidr: '192.168.99.0/24' })],
    })
    expect(addressTemplateFindings([stehend, zusatz])).toHaveLength(0)
  })
})

describe('addressTemplateFindings — Geraete gegen die Bereiche', () => {
  it('meldet ein Geraet ausserhalb des Bereichs, der fuer SEINE Rolle geplant ist', () => {
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'control', ipAddress: '10.99.0.5' })]),
    ]
    const f = addressTemplateFindings([stehend], geraete)
    expect(kinds(f)).toEqual(['device-outside'])
    expect(f[0].message).toContain('Steuerung')
  })

  it('schweigt, wenn es fuer die Rolle gar keinen Bereich gibt', () => {
    // Kein Plan, gegen den verstossen wuerde. Ein Befund hier meckerte bei
    // jedem halbfertigen Entwurf — und ein Check, der immer meckert, wird
    // weggeklickt, mitsamt den richtigen daneben.
    const nurSteuerung = layer({
      id: 'x',
      ranges: [range({ id: 'a', key: 'control', cidr: '10.2.0.0/16', role: 'control' })],
    })
    const geraete = [
      eq('m1', 'Mischer', [nic({ id: 'm1#a', role: 'media-primary', ipAddress: '10.99.0.5' })]),
    ]
    expect(addressTemplateFindings([nurSteuerung], geraete)).toHaveLength(0)
  })

  it('schweigt auch, wenn der Bereich fuer die Rolle nur eine Klammer ist', () => {
    // Eine Klammer vergibt nicht. Sie als Ziel zu zaehlen hiesse, ein Geraet
    // dafuer zu ruegen, dass es nicht in einer Klammer steht — wo es ohnehin
    // nicht hingehoert.
    const nurKlammer = layer({
      id: 'x',
      ranges: [
        range({ id: 'a', key: 'control', cidr: '10.2.0.0/16', role: 'control', kind: 'container' }),
      ],
    })
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'control', ipAddress: '10.99.0.5' })]),
    ]
    expect(addressTemplateFindings([nurKlammer], geraete)).toHaveLength(0)
  })

  it('meldet ein Geraet, das direkt in einer Klammer steht', () => {
    const l = layer({
      id: 'x',
      ranges: [
        range({ id: 'a', key: 'haus', cidr: '10.0.0.0/8', kind: 'container' }),
        range({ id: 'b', key: 'control', cidr: '10.2.0.0/16', role: 'control' }),
      ],
    })
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'unspecified', ipAddress: '10.7.0.5' })]),
    ]
    const f = addressTemplateFindings([l], geraete)
    expect(kinds(f)).toEqual(['container-holds-device'])
    expect(f[0].message).toContain('Unterbereich')
  })

  it('meldet den Widerspruch zwischen VLAN an der Schnittstelle und am Bereich', () => {
    const l = layer({
      id: 'x',
      ranges: [range({ id: 'a', key: 'control', cidr: '10.2.0.0/16', role: 'control', vlanId: 20 })],
    })
    const geraete = [
      eq('c1', 'Kamera 1', [
        nic({ id: 'c1#a', role: 'control', ipAddress: '10.2.0.5', vlanId: 30 }),
      ]),
    ]
    const f = addressTemplateFindings([l], geraete)
    expect(kinds(f)).toEqual(['vlan-mismatch'])
    expect(f[0].message).toContain('VLAN 30')
    expect(f[0].message).toContain('VLAN 20')
  })

  it('schweigt, wenn die Schnittstelle gar keine VLAN nennt', () => {
    // Eine Warnung ohne Ursache wird nicht gezeigt: wer nichts gesagt hat,
    // hat nichts Falsches gesagt. Ohne diese Bedingung meldete jedes Geraet
    // ohne VLAN-Eintrag einen Widerspruch gegen den Bereich, in dem es liegt
    // — und das ist der Normalzustand eines halb gepflegten Plans.
    const l = layer({
      id: 'x',
      ranges: [range({ id: 'a', key: 'control', cidr: '10.2.0.0/16', role: 'control', vlanId: 20 })],
    })
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'control', ipAddress: '10.2.0.5' })]),
    ]
    expect(addressTemplateFindings([l], geraete)).toHaveLength(0)
  })

  it('schweigt auch, wenn der Bereich keine VLAN plant', () => {
    const l = layer({
      id: 'x',
      ranges: [range({ id: 'a', key: 'control', cidr: '10.2.0.0/16', role: 'control' })],
    })
    const geraete = [
      eq('c1', 'Kamera 1', [
        nic({ id: 'c1#a', role: 'control', ipAddress: '10.2.0.5', vlanId: 30 }),
      ]),
    ]
    expect(addressTemplateFindings([l], geraete)).toHaveLength(0)
  })

  it('meldet ZWEI Praefixe auf derselben VLAN nicht', () => {
    // Sekundaeres Adressieren ist dokumentiert erlaubt: „A VLAN may have
    // multiple prefixes assigned to it" (NetBox, docs/models/ipam/prefix.md).
    // Ein Befund darauf waere ein Fehlalarm gegen eine richtige Konfiguration.
    const l = layer({
      id: 'x',
      ranges: [
        range({ id: 'a', key: 'a', cidr: '10.1.0.0/16', vlanId: 20 }),
        range({ id: 'b', key: 'b', cidr: '10.2.0.0/16', vlanId: 20 }),
      ],
    })
    expect(addressTemplateFindings([l])).toHaveLength(0)
  })

  it('meldet gar nichts an einem leeren Plan', () => {
    expect(addressTemplateFindings([], [])).toHaveLength(0)
    expect(addressTemplateFindings([layer({ id: 'x' })], [])).toHaveLength(0)
  })
})

// ── 4. Der Vorschlag ───────────────────────────────────────────────────────

describe('proposeReaddress — der Host-Anteil bleibt', () => {
  const zielEbene = [
    stehend,
    layer({
      id: 'halle',
      kind: 'venue',
      ranges: [
        range({ id: 'h1', key: 'control', name: 'Haus', cidr: '172.20.5.0/24', role: 'control' }),
      ],
    }),
  ]

  it('zieht 10.2.0.57 nach 172.20.5.57 um und nennt die Maske', () => {
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'control', ipAddress: '10.2.0.57' })]),
    ]
    const [v] = proposeReaddress(zielEbene, geraete)
    expect(v.to).toBe('172.20.5.57')
    expect(v.mask).toBe('255.255.255.0')
    expect(v.rangeName).toBe('Haus')
    expect(v.refusal).toBeUndefined()
  })

  it('sagt „liegt schon richtig", statt zu schweigen', () => {
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'control', ipAddress: '172.20.5.57' })]),
    ]
    expect(proposeReaddress(zielEbene, geraete)[0].refusal).toBe('already-inside')
  })

  it('lehnt ab, wenn der Host-Anteil der ALTEN Maske nicht ins Ziel passt', () => {
    // 10.2.1.5 in einem /16 hat den Host-Anteil 1.5 (= 261). In ein /24
    // passt der nicht. Wuerde stattdessen gegen die Ziel-Laenge gerechnet,
    // fiele die Adresse auf .5 — und zusammen mit 10.2.0.5 auf dieselbe
    // Adresse. Das Werkzeug baute die Doppel-IP, die es verhindern soll.
    const geraete = [
      eq('c1', 'Kamera 1', [
        nic({ id: 'c1#a', role: 'control', ipAddress: '10.2.1.5', subnetMask: '255.255.0.0' }),
      ]),
    ]
    expect(proposeReaddress(zielEbene, geraete)[0].refusal).toBe('host-does-not-fit')
  })

  it('laesst zwei Vorschlaege nicht auf derselben Adresse landen', () => {
    // Ohne Maske ist die Ziel-Laenge das einzig Bekannte, und dann koennen
    // zwei Geraete auf dieselbe Zieladresse fallen. Der zweite Vorschlag
    // muss das sehen — sonst kollidieren die Vorschlaege miteinander statt
    // mit dem Bestand, und beide sehen einzeln richtig aus.
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'control', ipAddress: '10.2.0.5' })]),
      eq('c2', 'Kamera 2', [nic({ id: 'c2#a', role: 'control', ipAddress: '10.2.1.5' })]),
    ]
    const v = proposeReaddress(zielEbene, geraete)
    expect(v[0].to).toBe('172.20.5.5')
    expect(v[1].to).toBeUndefined()
    expect(v[1].refusal).toBe('already-taken')
  })

  it('lehnt einen Vorschlag auf der Netz- oder Broadcast-Adresse ab', () => {
    const geraete = [
      eq('a', 'Netz', [nic({ id: 'a#a', role: 'control', ipAddress: '10.2.0.0' })]),
      eq('b', 'Broadcast', [nic({ id: 'b#a', role: 'control', ipAddress: '10.2.0.255' })]),
    ]
    expect(proposeReaddress(zielEbene, geraete).map((v) => v.refusal)).toEqual([
      'network-or-broadcast',
      'network-or-broadcast',
    ])
  })

  it('erlaubt genau das auf einem Bereich mit `firstLastUsable`', () => {
    // NetBox' `is_pool`: „the first and last IP addresses within the prefix
    // […] will be considered usable". Ein Werkzeug, das eine richtige
    // NAT-Pool-Konfiguration verweigert, wird umgangen.
    const pool = [
      layer({
        id: 'x',
        ranges: [
          range({
            id: 'a',
            key: 'control',
            cidr: '172.20.5.0/24',
            role: 'control',
            firstLastUsable: true,
          }),
        ],
      }),
    ]
    const geraete = [eq('a', 'Netz', [nic({ id: 'a#a', role: 'control', ipAddress: '10.2.0.0' })])]
    expect(proposeReaddress(pool, geraete)[0].to).toBe('172.20.5.0')
  })

  it('lehnt ab, wenn die vorgeschlagene Adresse schon jemandem gehoert', () => {
    // Ein Vorschlag, der eine Doppel-IP baut, ist genau der Schaden, den
    // dieser Bedarf verhindern soll: „could freeze up part of your network".
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'control', ipAddress: '10.2.0.57' })]),
      eq('c2', 'Kamera 2', [nic({ id: 'c2#a', role: 'management', ipAddress: '172.20.5.57' })]),
    ]
    expect(proposeReaddress(zielEbene, geraete)[0].refusal).toBe('already-taken')
  })

  it('nennt „kein Bereich" und „keine Adresse" beim Namen', () => {
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'media-secondary', ipAddress: '10.2.0.5' })]),
      eq('c2', 'Kamera 2', [nic({ id: 'c2#a', role: 'control', subnetMask: '255.255.255.0' })]),
    ]
    const v = proposeReaddress(zielEbene, geraete)
    expect(v.map((x) => x.refusal)).toEqual(['no-range', 'no-address'])
  })

  it('rechnet auch ohne die alte Maske — der Zielbereich bestimmt den Host-Anteil', () => {
    // `missing-mask` ist ein eigener Befund im Adressplan. Der Umzugs-
    // Vorschlag darf daran nicht scheitern: die alte Maske geht in die
    // Rechnung gar nicht ein.
    const geraete = [
      eq('c1', 'Kamera 1', [nic({ id: 'c1#a', role: 'control', ipAddress: '10.2.0.57' })]),
    ]
    expect(proposeReaddress(zielEbene, geraete)[0].to).toBe('172.20.5.57')
  })
})

// ── 5. Die Schema-Migrationsschicht ────────────────────────────────────────

describe('normaliseAddressLayers', () => {
  it('kanonisiert den CIDR sichtbar auf die Netz-Adresse', () => {
    const [l] = normaliseAddressLayers([
      { id: 'x', kind: 'standing', name: 'X', ranges: [{ id: 'a', key: 'k', cidr: '10.0.5.7/24' }] },
    ])
    expect(l.ranges[0].cidr).toBe('10.0.5.0/24')
  })

  it('wirft einen Bereich ohne rechenbaren CIDR weg, die leere Ebene aber nicht', () => {
    const out = normaliseAddressLayers([
      { id: 'x', kind: 'standing', name: 'X', ranges: [{ id: 'a', key: 'k', cidr: 'nichts' }] },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].ranges).toHaveLength(0)
  })

  it('entfernt ein Gateway ausserhalb seines eigenen Bereichs', () => {
    // Es stehen zu lassen saehe auf dem Merkblatt aus wie ein Weg hinaus —
    // und genau danach sucht jemand vor Ort.
    expect(
      normaliseAddressRange({ id: 'a', key: 'k', cidr: '10.0.5.0/24', gateway: '10.9.9.1' })
        ?.gateway,
    ).toBeUndefined()
    expect(
      normaliseAddressRange({ id: 'a', key: 'k', cidr: '10.0.5.0/24', gateway: '10.0.5.1' })
        ?.gateway,
    ).toBe('10.0.5.1')
  })

  it('faellt auf `assignable` und `standing` zurueck, nicht auf Unsinn', () => {
    const [l] = normaliseAddressLayers([
      { id: 'x', kind: 'quatsch', name: 'X', ranges: [{ id: 'a', key: 'k', cidr: '10.0.0.0/8', kind: 'quatsch' }] },
    ])
    expect(l.kind).toBe('standing')
    expect(l.ranges[0].kind).toBe('assignable')
  })

  it('verwirft eine VLAN-Id ausserhalb 1..4094', () => {
    for (const v of [0, 4095, 1.5, -1]) {
      expect(normaliseAddressRange({ id: 'a', key: 'k', cidr: '10.0.0.0/8', vlanId: v })?.vlanId)
        .toBeUndefined()
    }
    expect(normaliseAddressRange({ id: 'a', key: 'k', cidr: '10.0.0.0/8', vlanId: 20 })?.vlanId)
      .toBe(20)
  })

  it('wirft weg, was gar kein Datensatz ist', () => {
    expect(normaliseAddressLayers(null)).toEqual([])
    expect(normaliseAddressLayers([null, 3, 'x', [], { kind: 'venue' }])).toEqual([])
    expect(normaliseAddressRange({ key: 'k', cidr: '10.0.0.0/8' })).toBeNull()
  })
})

// ── 6. Das Blatt ───────────────────────────────────────────────────────────

describe('addressTemplateTable', () => {
  it('traegt je geltendem Bereich eine Zeile, mit dem Ersetzten als Beleg', () => {
    const t = addressTemplateTable([stehend, haus])
    expect(t.headers).toEqual([...RANGE_HEADERS])
    expect(t.rows).toHaveLength(3)
    const control = t.rows.find((r) => r[1] === 'control')!
    expect(control).toHaveLength(RANGE_HEADERS.length)
    expect(control[0]).toBe('Haus · Stadthalle')
    expect(control[3]).toBe('172.20.5.0/24')
    expect(control[8]).toBe('Steuerung (10.2.0.0/16)')
  })
})

// ── 7. Die Engstellen ──────────────────────────────────────────────────────

describe('Engstellen', () => {
  it('nennt keine eigene Art „pool" — der Name gehoert NetBox', () => {
    // NetBox' `is_pool` bedeutet „erste und letzte Adresse sind benutzbar",
    // NICHT „hier wird vergeben". Haette die eigene Art denselben Namen,
    // bildete ein Import oder Export ein Feld auf ein gleichnamiges mit
    // anderer Bedeutung ab — die Sorte Fehler, die spaeter niemand findet.
    // Das ist eine PRUEFBARE Zusicherung und nicht nur ein Kommentar:
    // wer die Art umbenennt, faellt hier auf.
    //
    // Geprueft wird die TYP-UNION im Quelltext und nicht nur die Laufzeit-
    // Liste: die beiden sind zwei getrennte Deklarationen und koennen
    // auseinanderlaufen. Wer nur die Liste prueft, uebersieht genau die
    // Umbenennung, um die es hier geht.
    const union = typenQuelle
      .split('export type AddressRangeKind =')[1]
      .split('\n')[0]
    const ausUnion = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
    expect(ausUnion).toEqual(['container', 'assignable'])
    expect(ADDRESS_RANGE_KINDS).toEqual(ausUnion)
    expect(ausUnion.some((k) => /pool/i.test(k))).toBe(false)
    // Und die Begruendung dazu bleibt am Typ stehen, samt Quelle.
    expect(typenQuelle).toContain('is_pool')
    expect(typenQuelle).toContain('Dieselbe Wortmarke')
    expect(typenQuelle).toContain('bedeutet etwas voellig')
    expect(typenQuelle).toContain('docs/models/ipam/prefix.md')
  })

  it('haelt fest, welche Befunde es NICHT gibt', () => {
    // Ein Befund mehr ist billig anzulegen und teuer im Betrieb. Diese Liste
    // ist die Bremse: wer einen hinzufuegt, muss diesen Test anfassen und
    // dabei an den Fehlalarm denken.
    const erwartet = [
      'overlap',
      'key-twice',
      'venue-orphan',
      'device-outside',
      'container-holds-device',
      'vlan-mismatch',
    ]
    const union = libQuelle
      .split('export type AddressTemplateFindingKind =')[1]
      .split('export interface')[0]
    const gefunden = [...union.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
    expect(gefunden).toEqual(erwartet)
  })

  it('vergibt nirgends selbst eine Adresse', () => {
    // Die Datei darf rechnen, was eine Adresse WAERE. Schreiben tut sie
    // nichts — das ist die E-5-Entscheidung und die Haltung aus Bedarf 96.
    expect(libQuelle).not.toMatch(/\bipAddress\s*[:=]\s*[^=]/)
    expect(libQuelle).toContain('ES WIRD NICHTS GESCHRIEBEN')
  })
})

// ── 8. Store und Oberflaeche ───────────────────────────────────────────────

describe('Store', () => {
  beforeEach(() => {
    useProjectStore.setState((s) => ({
      project: { ...s.project, addressLayers: [], equipment: [] },
    }))
  })

  it('legt Ebene und Bereich an und kanonisiert dabei wie beim Laden', () => {
    const store = useProjectStore.getState()
    const ebene = store.addAddressLayer({ name: 'Wagen', kind: 'standing' })!
    expect(ebene).toBeTruthy()
    const bereich = store.addAddressRange(ebene, {
      cidr: '10.2.0.7/16',
      key: 'control',
      role: 'control',
    })
    expect(bereich).toBeTruthy()
    const l = useProjectStore.getState().project.addressLayers![0]
    expect(l.ranges[0].cidr).toBe('10.2.0.0/16')
  })

  it('legt keinen Bereich an, dessen CIDR keiner ist', () => {
    // Die Oberflaeche darf nicht an der Engstelle vorbeischreiben. Sonst
    // gaebe es zwei Wahrheiten darueber, was ein gueltiger Bereich ist —
    // und die laxere stuende im Projekt, bis sie beim naechsten Laden
    // verschwindet.
    const store = useProjectStore.getState()
    const ebene = store.addAddressLayer({ name: 'Wagen' })!
    expect(store.addAddressRange(ebene, { cidr: 'Unsinn' })).toBeUndefined()
    expect(useProjectStore.getState().project.addressLayers![0].ranges).toHaveLength(0)
  })

  it('laesst einen Bereich stehen, wenn eine Aenderung ihn zerstoeren wuerde', () => {
    const store = useProjectStore.getState()
    const ebene = store.addAddressLayer({ name: 'Wagen' })!
    const bereich = store.addAddressRange(ebene, { cidr: '10.2.0.0/16', key: 'control' })!
    useProjectStore.getState().updateAddressRange(ebene, bereich, { cidr: 'Unsinn' })
    expect(useProjectStore.getState().project.addressLayers![0].ranges[0].cidr).toBe('10.2.0.0/16')
  })

  it('schreibt Schnittstelle 0 in die Alt-Felder und nicht in networkInterfaces', () => {
    // Die Alt-Felder am Geraet SIND Schnittstelle 0. Wer sie stattdessen in
    // `networkInterfaces` schriebe, erzeugte eine zweite Adresse desselben
    // Geraets — und der Adressplan meldete danach eine Doppel-IP, die es nur
    // im Werkzeug gibt.
    const geraet = {
      ...eq('c1', 'Kamera 1', []),
      ipAddress: '10.2.0.57',
      subnetMask: '255.255.0.0',
      networkInterfaces: undefined,
    } as unknown as EquipmentItem
    useProjectStore.setState((s) => ({ project: { ...s.project, equipment: [geraet] } }))
    const ok = useProjectStore
      .getState()
      .applyReaddress('c1', 'c1#nic0', '172.20.5.57', '255.255.255.0')
    expect(ok).toBe(true)
    const nachher = useProjectStore.getState().project.equipment[0]
    expect(nachher.ipAddress).toBe('172.20.5.57')
    expect(nachher.subnetMask).toBe('255.255.255.0')
    expect(nachher.networkInterfaces).toBeUndefined()
  })

  it('schreibt eine zweite Karte an ihrem eigenen Ort', () => {
    const geraet = eq('c1', 'Kamera 1', [
      nic({ id: 'c1#b', role: 'control', ipAddress: '10.2.0.57' }),
    ])
    useProjectStore.setState((s) => ({ project: { ...s.project, equipment: [geraet] } }))
    expect(
      useProjectStore.getState().applyReaddress('c1', 'c1#b', '172.20.5.57', '255.255.255.0'),
    ).toBe(true)
    const nachher = useProjectStore.getState().project.equipment[0]
    expect(nachher.ipAddress).toBeUndefined()
    expect(nachher.networkInterfaces![0].ipAddress).toBe('172.20.5.57')
  })

  it('heilt die Ebenen beim Laden — die Schema-Migrationsschicht', () => {
    // `healProjectPositions` laeuft auf JEDES geladene Projekt. Laeuft die
    // Normalisierung dort nicht mit, kommt ein von Hand oder von einer
    // aelteren Fassung geschriebenes Projekt mit unrechenbaren Bereichen
    // herein — und jede Pruefung muesste sie einzeln ueberspringen.
    const roh = {
      ...useProjectStore.getState().project,
      addressLayers: [
        {
          id: 'x',
          kind: 'quatsch',
          name: 'Wagen',
          ranges: [
            { id: 'a', key: 'control', cidr: '10.2.0.7/16' },
            { id: 'b', key: 'kaputt', cidr: 'kein CIDR' },
          ],
        },
        { kind: 'venue', name: 'ohne Id', ranges: [] },
      ],
    }
    useProjectStore.getState().loadProject(roh as unknown as CablePlannerProject)
    const geladen = useProjectStore.getState().project.addressLayers!
    expect(geladen).toHaveLength(1)
    expect(geladen[0].kind).toBe('standing')
    expect(geladen[0].ranges).toHaveLength(1)
    expect(geladen[0].ranges[0].cidr).toBe('10.2.0.0/16')
  })

  it('schreibt nichts an eine Schnittstelle, die es nicht gibt', () => {
    const geraet = eq('c1', 'Kamera 1', [nic({ id: 'c1#b', ipAddress: '10.2.0.57' })])
    useProjectStore.setState((s) => ({ project: { ...s.project, equipment: [geraet] } }))
    expect(
      useProjectStore.getState().applyReaddress('c1', 'c1#gibtsnicht', '172.20.5.1', '255.255.255.0'),
    ).toBe(false)
  })
})

describe('Erreichbarkeit', () => {
  it('haengt im Netz-Teil der Analyse', () => {
    // Ein Panel, das niemand oeffnen kann, ist gebaut und nicht geliefert.
    // Der Import allein genuegt nicht — das Panel muss auch gerendert werden.
    expect(dialogQuelle).toContain('<AddressTemplatePanel projectName={projectName} />')
  })

  it('haelt die Rechnung aus der Oberflaeche heraus', () => {
    // Die Oberflaeche ruft auf, sie rechnet nicht selbst. Sonst gaebe es
    // eine zweite Fassung der Ueberlagerung, die niemand testet.
    expect(panelQuelle).toContain('resolveLayers')
    expect(panelQuelle).toContain('proposeReaddress')
    expect(panelQuelle).not.toContain('parseCidr')
  })

  it('uebernimmt Vorschlaege einzeln und nie im Rudel', () => {
    // Ein Knopf, der zwanzig Adressen auf einmal umschreibt, ist kein
    // Vorschlag mehr, sondern eine Vergabe mit Bestaetigungsdialog.
    expect(panelQuelle).not.toMatch(/vorschlaege\.(map|forEach)\([^)]*applyReaddress/s)
    // Genau EINE Aufrufstelle: der Knopf in der Vorschlags-Zeile.
    expect((panelQuelle.match(/applyReaddress\(/g) ?? []).length).toBe(1)
  })

  it('rechnet ohne Store und ohne Uhr', () => {
    expect(libQuelle).not.toContain('useProjectStore')
    expect(libQuelle).not.toContain('new Date')
  })
})
