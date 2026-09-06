import { beforeEach, describe, expect, it } from 'vitest'
import {
  REACH_HEADERS,
  ROLE_TEXT,
  SEGMENT_HEADERS,
  normaliseNetworkSegments,
  roleFitsPurpose,
  segmentFindings,
  segmentReachTable,
  segmentTable,
  segmentViews,
  vlansInUse,
} from '../src/renderer/lib/networkSegments'
import {
  NO_GATEWAY,
  NO_PTP_IN_SEGMENT,
  NO_SEGMENT_NAME,
  type NetworkSegment,
} from '../src/renderer/types/networkSegment'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { NetworkInterface, NetworkInterfaceRole } from '../src/renderer/types/network'
import libQuelle from '../src/renderer/lib/networkSegments.ts?raw'
import typenQuelle from '../src/renderer/types/networkSegment.ts?raw'
import panelQuelle from '../src/renderer/components/Network/SegmentsPanel.tsx?raw'
import dialogQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'

// ---------------------------------------------------------------------------
// Segmente: welche VLAN wofuer da ist (Bedarf 116, P3).
//
//   > A systems tech must reach VuNET, the mixer app, Dante Controller, Lake
//   > Controller and Shure WWB ON SEPARATE VLANs FROM ONE MACHINE, while
//   > keeping amp control off Dante PTP and stopping Waves SoundGrid
//   > attaching to the wrong segment.
//
// Belegt an `misnow1/vunet-dante-combiner-2000` (2026-08-13, sieben offene
// Punkte): ein tragbares Mgmt-VLAN-Gateway, gebaut, damit EIN Steuer-Rechner
// alle fuenf Anwendungen erreicht — ohne zweite Netzkarte.
//
// Die Massnahme der Bedarfs-Datenbank ist woertlich: „model VLANs, PTP domain
// and control-vs-media segregation as part of the plan, SO THE NETWORK DESIGN
// IS DOCUMENTED BEFORE THE LAPTOP IS ON SITE."
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

const seg = (over: Partial<NetworkSegment> & { vlanId: number }): NetworkSegment => ({
  name: 'Segment',
  purpose: 'unspecified',
  ...over,
})

// ── 1. Rolle gegen Zweck ───────────────────────────────────────────────────

describe('roleFitsPurpose — „attaching to the wrong segment"', () => {
  it('laesst durch, wo niemand etwas gesagt hat', () => {
    // Wer nichts gesagt hat, hat nichts Falsches gesagt. Sonst meldete jeder
    // halbfertige Plan einen Fehler, und ein Check, der immer meckert, wird
    // weggeklickt statt gelesen.
    expect(roleFitsPurpose('unspecified', 'media-primary')).toBe(true)
    expect(roleFitsPurpose('control', 'unspecified')).toBe(true)
  })

  it('laesst die gleiche Rolle durch', () => {
    for (const r of ['media-primary', 'control', 'management'] as NetworkInterfaceRole[]) {
      expect(roleFitsPurpose(r, r)).toBe(true)
    }
  })

  it('trennt Medien von Steuerung — der Satz aus dem Beleg', () => {
    expect(roleFitsPurpose('control', 'media-primary')).toBe(false)
    expect(roleFitsPurpose('media-primary', 'control')).toBe(false)
  })

  it('trennt die beiden Medien-Beine voneinander', () => {
    // Ein 2022-7-Aufbau, dessen beide Beine im selben VLAN liegen, ist kein
    // redundanter Aufbau mehr, sondern ein doppelter.
    expect(roleFitsPurpose('media-primary', 'media-secondary')).toBe(false)
    expect(roleFitsPurpose('media-secondary', 'media-primary')).toBe(false)
  })

  it('laesst Management und Steuerung zusammen — das Mgmt-VLAN IST der Weg', () => {
    expect(roleFitsPurpose('management', 'control')).toBe(true)
    expect(roleFitsPurpose('control', 'management')).toBe(true)
  })

  it('haelt Management aus dem Medien-Segment heraus', () => {
    expect(roleFitsPurpose('management', 'media-primary')).toBe(false)
  })
})

// ── 2. Die Sicht ───────────────────────────────────────────────────────────

describe('segmentViews', () => {
  const welt = [
    eq('sw', 'Switch', [nic({ id: 'sw#nic1', role: 'management', vlanId: 99 })]),
    eq('cam', 'Kamera 1', [nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 10 })]),
  ]

  it('nennt die benutzten VLANs aufsteigend', () => {
    expect(vlansInUse(welt)).toEqual([10, 99])
  })

  it('vereinigt benutzte Ids UND hinterlegte Datensaetze', () => {
    // Nur die eine Richtung zu nehmen verloere entweder den Entwurf, den noch
    // niemand bestueckt hat, oder das VLAN, in dem jemand ohne Entwurf ein
    // Geraet angemeldet hat — und das zweite ist genau der Zustand aus dem
    // Beleg.
    const v = segmentViews(welt, [seg({ vlanId: 20, name: 'Steuerung' })])
    expect(v.map((x) => x.vlanId)).toEqual([10, 20, 99])
    expect(v.find((x) => x.vlanId === 20)?.members).toEqual([])
    expect(v.find((x) => x.vlanId === 10)?.segment).toBeUndefined()
  })

  it('nennt das Mitglied mit der vorhandenen Vokabel', () => {
    const welt2 = [
      eq('cam', 'Kamera 1', [
        nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 10, label: 'Dante Prim' }),
      ]),
    ]
    expect(segmentViews(welt2, [])[0].members[0].where).toBe('Kamera 1 · Dante Prim')
  })

  it('ignoriert Schnittstellen ohne VLAN', () => {
    const ohne = [eq('x', 'X', [nic({ id: 'x#nic1', role: 'control', ipAddress: '10.0.0.1' })])]
    expect(segmentViews(ohne, [])).toEqual([])
  })
})

// ── 3. Die Befunde ─────────────────────────────────────────────────────────

describe('segmentFindings', () => {
  it('meldet die benutzte VLAN ohne Namen', () => {
    // „VLAN 30" beantwortet nicht, ob Dante dort hin darf.
    const welt = [eq('cam', 'Kamera 1', [nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 30 })])]
    const f = segmentFindings(welt, [])
    expect(f.find((x) => x.kind === 'unnamed-segment')?.vlanId).toBe(30)
  })

  it('meldet KEIN leeres Segment als Fehler', () => {
    // Die Planung faengt oft mit den Segmenten an und fuellt die Geraete
    // spaeter.
    const f = segmentFindings([], [seg({ vlanId: 10, name: 'Dante Prim', purpose: 'media-primary' })])
    expect(f).toEqual([])
  })

  it('meldet den namenlosen UND unbenutzten Datensatz als Rest', () => {
    const f = segmentFindings([], [seg({ vlanId: 10, name: '  ' })])
    expect(f.map((x) => x.kind)).toEqual(['orphan-segment'])
  })

  it('meldet Medien UND Steuerung im selben Segment als FEHLER', () => {
    // Der Satz „on separate VLANs" aus dem Beleg, verneint.
    const welt = [
      eq('cam', 'Kamera 1', [nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 10 })]),
      eq('pc', 'Regie-PC', [nic({ id: 'pc#nic1', role: 'control', vlanId: 10 })]),
    ]
    const f = segmentFindings(welt, [seg({ vlanId: 10, name: 'Dante Prim' })])
    const gemischt = f.find((x) => x.kind === 'mixed-segment')
    expect(gemischt?.severity).toBe('error')
    expect(gemischt?.message).toContain('PTP')
  })

  it('meldet die Schnittstelle im falschen Segment und NENNT beide Seiten', () => {
    // „Tally kaputt" schickt niemanden zum richtigen Geraet — hier gilt
    // dasselbe: der Befund muss sagen, was wo liegt.
    const welt = [eq('amp', 'Endstufe', [nic({ id: 'amp#nic1', role: 'control', vlanId: 10 })])]
    const f = segmentFindings(welt, [
      seg({ vlanId: 10, name: 'Dante Prim', purpose: 'media-primary' }),
    ])
    const treffer = f.find((x) => x.kind === 'role-mismatch')
    expect(treffer?.severity).toBe('error')
    expect(treffer?.message).toContain('Endstufe')
    expect(treffer?.message).toContain(ROLE_TEXT.control)
    expect(treffer?.message).toContain(ROLE_TEXT['media-primary'])
  })

  it('meldet den Widerspruch zwischen geplanter und eingetragener PTP-Domaene', () => {
    // Genau das kann `ptpPlan.ts` NICHT sehen: es kennt Domaenen und Profile,
    // aber keine Segmente.
    const welt = [
      eq('cam', 'Kamera 1', [
        nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 10, ptpDomain: 127 }),
      ]),
    ]
    const f = segmentFindings(welt, [
      seg({ vlanId: 10, name: 'Dante Prim', purpose: 'media-primary', ptpDomain: 0 }),
    ])
    const treffer = f.find((x) => x.kind === 'ptp-mismatch')
    expect(treffer?.severity).toBe('error')
    expect(treffer?.message).toContain('0')
    expect(treffer?.message).toContain('127')
  })

  it('meldet KEINEN PTP-Widerspruch, wo das Geraet nichts sagt', () => {
    const welt = [eq('cam', 'Kamera 1', [nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 10 })])]
    const f = segmentFindings(welt, [
      seg({ vlanId: 10, name: 'Dante Prim', purpose: 'media-primary', ptpDomain: 0 }),
    ])
    expect(f.some((x) => x.kind === 'ptp-mismatch')).toBe(false)
  })

  it('meldet KEINEN PTP-Widerspruch, wo das Segment nichts plant', () => {
    const welt = [
      eq('cam', 'Kamera 1', [
        nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 10, ptpDomain: 127 }),
      ]),
    ]
    const f = segmentFindings(welt, [seg({ vlanId: 10, name: 'D', purpose: 'media-primary' })])
    expect(f.some((x) => x.kind === 'ptp-mismatch')).toBe(false)
  })

  it('meldet nichts bei einem sauber entworfenen Segment', () => {
    const welt = [
      eq('cam', 'Kamera 1', [
        nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 10, ptpDomain: 0 }),
      ]),
    ]
    expect(
      segmentFindings(welt, [
        seg({ vlanId: 10, name: 'Dante Prim', purpose: 'media-primary', ptpDomain: 0 }),
      ]),
    ).toEqual([])
  })
})

// ── 4. Die Blaetter ────────────────────────────────────────────────────────

describe('segmentTable', () => {
  it('haelt den Spaltenkopf fest', () => {
    expect(segmentTable([], []).headers).toEqual([...SEGMENT_HEADERS])
  })

  it('schreibt einen NAMEN statt einer leeren Zelle', () => {
    const welt = [eq('cam', 'Kamera 1', [nic({ id: 'cam#nic1', role: 'media-primary', vlanId: 10 })])]
    const [zeile] = segmentTable(welt, []).rows
    expect(zeile[1]).toBe(NO_SEGMENT_NAME)
    expect(zeile[2]).toBe(ROLE_TEXT.unspecified)
    expect(zeile[3]).toBe(NO_PTP_IN_SEGMENT)
    expect(zeile[4]).toBe(NO_GATEWAY)
  })

  it('setzt den Gateway-NAMEN ein, nicht die Id', () => {
    // Eine Id auf dem Blatt schickt niemanden irgendwohin.
    const welt = [
      eq('gw', 'Mgmt-Gateway', [nic({ id: 'gw#nic1', role: 'management', vlanId: 99 })]),
    ]
    const [zeile] = segmentTable(welt, [
      seg({ vlanId: 99, name: 'Mgmt', purpose: 'management', gatewayEquipmentId: 'gw' }),
    ]).rows
    expect(zeile[4]).toBe('Mgmt-Gateway')
  })
})

describe('segmentReachTable — „from one machine"', () => {
  it('haelt den Spaltenkopf fest', () => {
    expect(segmentReachTable([], []).headers).toEqual([...REACH_HEADERS])
  })

  it('fuehrt ein Geraet mit fuenf Segmenten in fuenf Zeilen', () => {
    // Das ist die Antwort auf den Beleg: ein Steuer-Rechner, der fuenf
    // Anwendungen erreichen soll, steht hier mit fuenf Zeilen — oder eben mit
    // einer, und dann weiss man es VOR dem Aufbau.
    const pc = eq(
      'pc',
      'Systemtechnik-Laptop',
      [10, 20, 30, 40, 99].map((v, i) =>
        nic({ id: `pc#nic${i}`, role: 'control', vlanId: v, label: `VLAN ${v}` }),
      ),
    )
    expect(segmentReachTable([pc], []).rows).toHaveLength(5)
  })

  it('laesst Schnittstellen OHNE VLAN weg', () => {
    // Das Blatt beantwortet „wer steht in welchem Segment". Eine
    // Schnittstelle ohne VLAN stuende dort mit einer leeren Zelle in der
    // Spalte, um die es geht — und eine leere Zelle liest sich wie eine
    // Antwort.
    const welt = [
      eq('pc', 'Regie-PC', [
        nic({ id: 'pc#nic1', role: 'control', vlanId: 20 }),
        nic({ id: 'pc#nic2', role: 'control', ipAddress: '10.0.0.9' }),
      ]),
    ]
    const rows = segmentReachTable(welt, []).rows
    expect(rows).toHaveLength(1)
    expect(rows[0][2]).toBe(20)
  })

  it('sortiert nach Geraet und dann nach VLAN', () => {
    const welt = [
      eq('z', 'Zebra', [nic({ id: 'z#nic1', role: 'control', vlanId: 20 })]),
      eq('a', 'Anton', [
        nic({ id: 'a#nic1', role: 'control', vlanId: 30 }),
        nic({ id: 'a#nic2', role: 'control', vlanId: 10 }),
      ]),
    ]
    expect(segmentReachTable(welt, []).rows.map((r) => [r[0], r[2]])).toEqual([
      ['Anton', 10],
      ['Anton', 30],
      ['Zebra', 20],
    ])
  })
})

// ── 5. Was beim Laden ueberlebt ────────────────────────────────────────────

describe('normaliseNetworkSegments', () => {
  it('wirft eine VLAN-Id ausserhalb des nutzbaren Bereichs weg', () => {
    // 0 und 4095 sind reserviert. Ein Datensatz darauf zeigt auf kein VLAN,
    // das jemand einrichten kann.
    for (const v of [0, 4095, -1, 1.5, 'zehn']) {
      expect(normaliseNetworkSegments([{ vlanId: v, name: 'x' }])).toEqual([])
    }
    expect(normaliseNetworkSegments([{ vlanId: 1 }])).toHaveLength(1)
    expect(normaliseNetworkSegments([{ vlanId: 4094 }])).toHaveLength(1)
  })

  it('nimmt bei zwei Datensaetzen fuer dieselbe VLAN den ersten', () => {
    const out = normaliseNetworkSegments([
      { vlanId: 10, name: 'erst' },
      { vlanId: 10, name: 'dann' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('erst')
  })

  it('macht aus einem erfundenen Zweck „unspecified"', () => {
    expect(normaliseNetworkSegments([{ vlanId: 10, purpose: 'zauberei' }])[0].purpose).toBe(
      'unspecified',
    )
  })

  it('wirft eine PTP-Domaene ausserhalb 0..127 weg', () => {
    expect('ptpDomain' in normaliseNetworkSegments([{ vlanId: 10, ptpDomain: 128 }])[0]).toBe(false)
    expect(normaliseNetworkSegments([{ vlanId: 10, ptpDomain: 127 }])[0].ptpDomain).toBe(127)
    expect(normaliseNetworkSegments([{ vlanId: 10, ptpDomain: 0 }])[0].ptpDomain).toBe(0)
  })

  it('laesst leere Felder weg statt sie leer zu fuehren', () => {
    const [s] = normaliseNetworkSegments([{ vlanId: 10, gatewayEquipmentId: '  ', note: '' }])
    expect('gatewayEquipmentId' in s).toBe(false)
    expect('note' in s).toBe(false)
  })

  it('sortiert aufsteigend', () => {
    expect(normaliseNetworkSegments([{ vlanId: 99 }, { vlanId: 10 }]).map((s) => s.vlanId)).toEqual(
      [10, 99],
    )
  })
})

// ── 6. Der Store ───────────────────────────────────────────────────────────

describe('der Store', () => {
  beforeEach(() => {
    useProjectStore.setState((s) => ({ project: { ...s.project, networkSegments: [] } }))
  })

  it('setzt die ganze Liste auf einmal', () => {
    useProjectStore.getState().setNetworkSegments([seg({ vlanId: 10, name: 'Dante' })])
    expect(useProjectStore.getState().project.networkSegments).toHaveLength(1)
  })

  it('raeumt beim Laden den Gateway-Zeiger ins Leere weg — das Segment bleibt', () => {
    // Ein Zeiger ins Leere saehe auf dem Blatt aus wie ein Weg in das Segment
    // hinein, und genau danach sucht jemand vor Ort. Der ENTWURF gilt auch
    // ohne Gateway.
    expect(storeQuelle).toContain('gatewayEquipmentId && !geraeteIds.has(s.gatewayEquipmentId)')
    expect(storeQuelle).toContain('normaliseNetworkSegments(project.networkSegments)')
  })
})

// ── 7. Reinheit und Erreichbarkeit ─────────────────────────────────────────

describe('das Modul und die Oberflaeche', () => {
  it('nimmt keine Uhr und keinen Store', () => {
    expect(libQuelle).not.toContain('new Date(')
    expect(libQuelle).not.toContain('useProjectStore')
  })

  it('fuehrt EINE Vokabel fuer die Rolle, nicht zwei', () => {
    // Ein zweiter Satz Woerter fuer dieselbe Sache waere genau die Krankheit,
    // die das Spaltenlexikon bei Spaltennamen abgestellt hat.
    expect(typenQuelle).toContain("purpose: NetworkInterfaceRole")
    expect(typenQuelle).not.toContain('SegmentPurpose')
  })

  it('traegt kanonisches Deutsch in den Tabellen, nicht die Oberflaechensprache', () => {
    // Ein Blatt, dessen Inhalt sich mit dem Sprachschalter aendert, meldet
    // jedes gedruckte Exemplar als veraltet.
    expect(libQuelle).not.toContain("useTranslation")
    expect(libQuelle).toContain('ROLE_TEXT')
  })

  it('ist im Netz-Reiter erreichbar', () => {
    expect(dialogQuelle).toContain('<SegmentsPanel projectName={projectName} />')
  })

  it('raet den Zweck NICHT beim Uebernehmen', () => {
    // Geraten waere er die stille Zusage, gegen die dieser Bedarf gebaut ist.
    const block = panelQuelle.slice(
      panelQuelle.indexOf('const uebernehmen'),
      panelQuelle.indexOf('const entfernen'),
    )
    expect(block).toContain("purpose: 'unspecified' as const")
    expect(block).toContain("name: ''")
  })

  it('haelt die Befunde in der Oberflaeche, statt sie zu verschweigen', () => {
    expect(panelQuelle).toContain('segmentFindings(equipment, segments)')
  })
})
