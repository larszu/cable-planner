import { describe, expect, it } from 'vitest'
import {
  KreuzpunktFehler,
  buildCrosspointCommand,
  kreuzpunktKlartext,
  pruefeKreuzpunkte,
} from '../src/renderer/lib/videohubCrosspoint'
import { buildVideohubRoutingCommand } from '../src/renderer/lib/exportVideohub'
import {
  auftragHindernis,
  eintraegeFuerAuftrag,
  hubAuftraege,
  schaltbareWege,
  sendebereit,
} from '../src/renderer/lib/hubSwitchPlan'
import {
  kreuzpunkteDerKette,
  patternRouting,
  type HubKreuzpunkt,
} from '../src/renderer/lib/patternRouting'
import type { SignalChain } from '../src/renderer/lib/signalChain'
import { normaliseHubSwitches, hubSwitchZeilen } from '../src/renderer/types/hubSwitch'
import type { HubSwitch } from '../src/renderer/types/hubSwitch'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import dialogSrc from '../src/renderer/components/Canvas/HubSwitchDialog.tsx?raw'
import chipSrc from '../src/renderer/components/Canvas/PatternChip.tsx?raw'
import metaSliceSrc from '../src/renderer/store/slices/metaSlice.ts?raw'
import projectStoreSrc from '../src/renderer/store/projectStore.ts?raw'

// ───────────────────────────────────────────────────────────────────────────
// „Den Weg schalten" — der Eingriff an der Kreuzschiene (B-42, Inkrement 3).
//
// DIE ZUSICHERUNG, UM DIE ES GEHT, ist eine NEGATIVE: ein Ausgang, ueber den
// niemand etwas gesagt hat, kommt im gesendeten Text NICHT vor. Alles andere
// in dieser Datei haengt daran.
//
// Warum sie zaehlt: `buildVideohubRoutingCommand` — der Bauer, den es schon
// gab und den man hier naheliegenderweise wiederverwendet haette — schreibt
// eine Zeile fuer JEDEN Ausgang und setzt jeden fehlenden Eintrag auf Eingang
// 0. Fuer den vollstaendigen Export ist das richtig. Fuer „schalte Ausgang 7"
// hiesse es: 39 weitere Ausgaenge mitnehmen und alles Unerwaehnte
// schwarzschalten, darunter womoeglich den, auf dem gerade gesendet wird.
//
// Die Gegenprobe dazu steht ausdruecklich mit im Test (`der alte Bauer wuerde
// genau das tun`): ohne sie waere „Ausgang 3 steht im Block" eine Zusicherung,
// die auch der falsche Bauer erfuellt.
// ───────────────────────────────────────────────────────────────────────────

const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const port = (id: string): Port =>
  ({ id, name: id, type: 'video', connectorType: 'bnc' }) as unknown as Port

const eq = (id: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name: id, category: 'Video', x: 0, y: 0, inputs: [], outputs: [], ...over }) as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
  }) as unknown as Cable

describe('Gesendet wird nur, was benannt wurde', () => {
  it('ein Block fuer Ausgang 7 nennt keinen anderen Ausgang', () => {
    const block = buildCrosspointCommand([{ output: 7, input: 2 }])
    expect(block).toContain('7 2')
    const zeilen = block.trim().split('\n').slice(1)
    expect(zeilen).toEqual(['7 2'])
  })

  it('der alte Bauer wuerde genau das tun — deshalb wird er hier nicht benutzt', () => {
    // GEGENPROBE zur Zusicherung darueber. Haette `buildCrosspointCommand`
    // intern `buildVideohubRoutingCommand` aufgerufen, waere der Test oben
    // rot; dass er es NICHT ist, ist nur dann eine Aussage, wenn der
    // Unterschied hier belegt ist.
    const alt = buildVideohubRoutingCommand({ 7: 2 }, 12)
    expect(alt).toContain('7 2')
    expect(alt).toContain('0 0') // Ausgang 0 auf Eingang 0 — ungefragt
    expect(alt.trim().split('\n').slice(1)).toHaveLength(12)
  })

  it('leere Liste ergibt keinen Block, nicht einen leeren', () => {
    // Ein Block ohne Zeilen sieht aus wie ein Befehl und ist keiner.
    expect(buildCrosspointCommand([])).toBe('')
  })

  it('die Zeilen stehen nach Ausgang sortiert, der Block endet mit Leerzeile', () => {
    const block = buildCrosspointCommand([
      { output: 5, input: 1 },
      { output: 2, input: 3 },
    ])
    expect(block).toBe('VIDEO OUTPUT ROUTING:\n2 3\n5 1\n\n')
  })

  it('derselbe Kreuzpunkt zweimal ergibt eine Zeile', () => {
    const block = buildCrosspointCommand([
      { output: 4, input: 1 },
      { output: 4, input: 1 },
    ])
    expect(block.trim().split('\n').slice(1)).toEqual(['4 1'])
  })

  it('ein widerspruechlicher Ausgang wirft, statt eine Haelfte zu raten', () => {
    expect(() =>
      buildCrosspointCommand([
        { output: 4, input: 1 },
        { output: 4, input: 2 },
      ]),
    ).toThrow(KreuzpunktFehler)
  })

  it('keine Zahl, negative Zahl, Bruch — alles wirft', () => {
    expect(() => pruefeKreuzpunkte([{ output: -1, input: 0 }])).toThrow(KreuzpunktFehler)
    expect(() => pruefeKreuzpunkte([{ output: 0, input: -3 }])).toThrow(KreuzpunktFehler)
    expect(() => pruefeKreuzpunkte([{ output: 1.5, input: 0 }])).toThrow(KreuzpunktFehler)
    expect(() =>
      pruefeKreuzpunkte([{ output: NaN, input: 0 }]),
    ).toThrow(KreuzpunktFehler)
  })
})

describe('Der Klartext nennt Namen und Nummern', () => {
  it('die Nummern zaehlen ab 1, die Namen stehen dabei', () => {
    const text = kreuzpunktKlartext({
      output: 2,
      outputName: 'Regie links',
      input: 0,
      inputName: 'Kamera 1',
      vonName: 'Kamera 2',
    })
    expect(text).toBe('Ausgang 3 (Regie links) von Kamera 2 auf Eingang 1 (Kamera 1)')
  })

  it('ohne gelesenen Ist-Zustand steht dort kein erfundener Wert', () => {
    // Die App liest den Hub nicht automatisch. Ein aus dem Plan gesetztes
    // „von Eingang 1" saehe aus wie eine Messung.
    const text = kreuzpunktKlartext({ output: 0, outputName: '', input: 1, inputName: '' })
    expect(text).toBe('Ausgang 1 vom aktuellen Stand (ungelesen) auf Eingang 2')
    expect(text).not.toMatch(/von Eingang/)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Zwei Kameras, zwei Kreuzschienen in Reihe, zwei Monitore.
// Geplant: Kamera 1 -> Hub A Ausgang 0 -> Hub B Ausgang 1 -> Monitor Regie.
// ───────────────────────────────────────────────────────────────────────────
const anlage = (): CablePlannerProject =>
  ({
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    equipment: [
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('hubA', {
        name: 'Smart Videohub 12x12',
        ipAddress: '10.0.0.5',
        inputs: [port('a_in0'), port('a_in1')],
        outputs: [port('a_out0'), port('a_out1')],
        videohubRouting: { planned: { 0: 0, 1: 1 }, salvos: [] },
      }),
      eq('hubB', {
        name: 'Universal Videohub 80',
        ipAddress: '10.0.0.6',
        inputs: [port('b_in0'), port('b_in1')],
        outputs: [port('b_out0'), port('b_out1')],
        videohubRouting: { planned: { 1: 0 }, salvos: [] },
      }),
    ],
    cables: [
      kabel('k1', ['cam1', 'c1out'], ['hubA', 'a_in0']),
      kabel('k2', ['hubA', 'a_out0'], ['hubB', 'b_in0']),
      kabel('k3', ['hubB', 'b_out1'], ['mon1', 'm1in']),
    ],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

describe('Die Kreuzpunkte werden abgelesen, nicht neu gesucht', () => {
  const routing = patternRouting(anlage(), 'cam1')
  const weg = routing.ziele.find((z) => z.equipmentId === 'mon1')

  it('der Weg zum Monitor laeuft ueber beide Kreuzschienen', () => {
    expect(weg).toBeTruthy()
    expect(weg!.kreuzpunkte.map((k) => k.equipmentId)).toEqual(['hubA', 'hubB'])
  })

  it('die Nummern stammen aus den Anschlusslisten der Geraete', () => {
    const [a, b] = weg!.kreuzpunkte
    expect(a).toMatchObject({ input: 0, output: 0, ipAddress: '10.0.0.5' })
    expect(b).toMatchObject({ input: 0, output: 1, ipAddress: '10.0.0.6' })
  })

  it('ein Weg ohne Kreuzschiene hat nichts zu schalten', () => {
    const p = anlage()
    p.equipment = [
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
    ]
    p.cables = [kabel('k1', ['cam1', 'c1out'], ['mon1', 'm1in'])]
    const r = patternRouting(p, 'cam1')
    expect(r.ziele).toHaveLength(1)
    expect(r.ziele[0].kreuzpunkte).toEqual([])
  })

  it('ein geplanter Kreuzpunkt ins Leere ergibt keinen Schaltauftrag', () => {
    // Der Ausgang, auf den `planned` zeigt, ist weg. Die Kette endet dann an
    // der Kreuzschiene, und ein Weg, der dort endet, hat nichts zu schalten.
    const p = anlage()
    const hubB = p.equipment.find((e) => e.id === 'hubB')!
    hubB.outputs = [port('b_out0')] // b_out1 entfernt, das Kabel bleibt
    const r = patternRouting(p, 'cam1')
    const alle = [...r.ziele, ...r.offen].flatMap((z) => z.kreuzpunkte)
    expect(alle.some((k) => k.equipmentId === 'hubB')).toBe(false)
  })

  it('ein Anschluss, den das Geraet nicht kennt, ergibt keine geratene Nummer', () => {
    // DIREKT an `kreuzpunkteDerKette`, nicht ueber `patternRouting`: dort ist
    // dieser Fall heute nicht erreichbar, weil `forwardFrom` einen
    // Weiterweg nur ueber vorhandene Anschluesse findet. Der Gegenversuch
    // (Pruefung entfernen) blieb deshalb ueber `patternRouting` gruen — die
    // Zusicherung war unverdient. Sie bleibt trotzdem im Code: faellt sie
    // weg und aendert sich `forwardFrom` einmal, ginge eine geratene Nummer
    // als BEFEHL an eine laufende Anlage.
    const hub = eq('hubA', {
      inputs: [port('a_in0')],
      outputs: [port('a_out0')],
    })
    const kette = {
      id: 'x',
      levels: 1,
      end: 'ziel',
      endNote: '',
      steps: [
        {
          cableId: 'k1',
          cableLabel: 'k1',
          fromEquipmentId: 'cam1',
          fromEquipmentName: 'Kamera 1',
          fromPortId: 'c1out',
          fromPortName: 'out',
          toEquipmentId: 'hubA',
          toEquipmentName: 'Hub A',
          toPortId: 'gibt-es-nicht',
          toPortName: 'weg',
          through: 'router',
        },
        {
          cableId: 'k2',
          cableLabel: 'k2',
          fromEquipmentId: 'hubA',
          fromEquipmentName: 'Hub A',
          fromPortId: 'a_out0',
          fromPortName: 'out0',
          toEquipmentId: 'mon1',
          toEquipmentName: 'Monitor',
          toPortId: 'm1in',
          toPortName: 'in',
          through: null,
        },
      ],
    } as unknown as SignalChain
    expect(kreuzpunkteDerKette(kette, new Map([['hubA', hub]]))).toEqual([])

    // Gegenprobe zur Gegenprobe: mit vorhandenem Anschluss kommt sehr wohl
    // ein Kreuzpunkt heraus — sonst waere die Zusicherung oben trivial.
    kette.steps[0].toPortId = 'a_in0'
    expect(kreuzpunkteDerKette(kette, new Map([['hubA', hub]]))).toHaveLength(1)
  })
})

describe('Ein Auftrag je Kreuzschiene', () => {
  const routing = patternRouting(anlage(), 'cam1')
  const weg = routing.ziele.find((z) => z.equipmentId === 'mon1')!

  it('zwei Kreuzschienen ergeben zwei Auftraege, in der Reihenfolge des Wegs', () => {
    const auftraege = hubAuftraege(weg.kreuzpunkte)
    expect(auftraege.map((a) => a.equipmentId)).toEqual(['hubA', 'hubB'])
  })

  it('kein Auftrag nennt einen fremden Ausgang', () => {
    // DIE eigentliche Zusicherung, am ganzen Weg statt am Baustein: Hub B hat
    // laut Modell 80 Ausgaenge, der Weg braucht einen. Genau einer steht drin.
    const auftraege = hubAuftraege(weg.kreuzpunkte)
    for (const a of auftraege) {
      const zeilen = a.block.trim().split('\n').slice(1)
      expect(zeilen).toHaveLength(1)
    }
    expect(auftraege[1].block).toBe('VIDEO OUTPUT ROUTING:\n1 0\n\n')
  })

  it('zweimal dieselbe Kreuzschiene ergibt einen Auftrag mit zwei Zeilen', () => {
    const k = (over: Partial<HubKreuzpunkt>): HubKreuzpunkt => ({
      equipmentId: 'hubA',
      equipmentName: 'Hub A',
      ipAddress: '10.0.0.5',
      input: 0,
      inputName: 'in',
      output: 0,
      outputName: 'out',
      ...over,
    })
    const auftraege = hubAuftraege([k({}), k({ input: 1, output: 3 })])
    expect(auftraege).toHaveLength(1)
    expect(auftraege[0].block.trim().split('\n').slice(1)).toEqual(['0 0', '3 1'])
    expect(auftraege[0].klartext).toHaveLength(2)
  })

  it('eine fehlende Adresse wird BENANNT, nicht nur ausgegraut', () => {
    const auftraege = hubAuftraege([
      {
        equipmentId: 'hubA',
        equipmentName: 'Hub A',
        ipAddress: '',
        input: 0,
        inputName: 'in',
        output: 0,
        outputName: 'out',
      },
    ])
    expect(auftragHindernis(auftraege[0])).toMatch(/Hub A/)
    expect(auftragHindernis(auftraege[0])).toMatch(/IP-Adresse/)
  })
})

describe('Der Eingriff steht im Projekt und aendert den Plan nicht', () => {
  const dialog = ohneKommentare(dialogSrc)

  it('der Dialog schreibt nichts an das geplante Routing (ADR-001)', () => {
    // Negative Zusicherung, und deshalb per Quelltext haltbar: einen Aufruf,
    // den es nicht gibt, kann kein eingeschleustes `return` verstecken.
    expect(dialog).not.toMatch(/updateEquipment\(/)
    expect(dialog).not.toMatch(/videohubRouting/)
    expect(dialog).not.toMatch(/planned/)
  })

  it('der Dialog benutzt nicht den vollstaendigen Routing-Bauer', () => {
    expect(dialog).not.toMatch(/buildVideohubRoutingCommand/)
    expect(dialog).toMatch(/hubAuftraege\(/)
  })

  it('der Haken muss gesetzt sein, bevor gesendet werden kann', () => {
    // Am VERHALTEN, nicht an der Form des Ausdrucks: ein Waechter, der
    // `hindernisse.length === 0 && verstanden` im Quelltext sucht, wird bei
    // einer richtigen Umstellung rot und dann geaendert statt gelesen.
    const auftraege = hubAuftraege([
      {
        equipmentId: 'hubA',
        equipmentName: 'Hub A',
        ipAddress: '10.0.0.5',
        input: 0,
        inputName: 'in',
        output: 0,
        outputName: 'out',
      },
    ])
    expect(sendebereit(auftraege, false)).toBe(false)
    expect(sendebereit(auftraege, true)).toBe(true)
    expect(sendebereit([], true)).toBe(false)
    const ohneIp = hubAuftraege([
      {
        equipmentId: 'hubA',
        equipmentName: 'Hub A',
        ipAddress: '',
        input: 0,
        inputName: 'in',
        output: 0,
        outputName: 'out',
      },
    ])
    expect(sendebereit(ohneIp, true)).toBe(false)
    // …und der Dialog fragt tatsaechlich danach, statt selbst zu entscheiden.
    expect(dialog).toMatch(/sendebereit\(auftraege, verstanden\)/)
  })

  it('der gesendete Text steht sichtbar im Dialog', () => {
    // Wer einen Befehl an eine laufende Anlage bestaetigt, soll ihn lesen
    // koennen und nicht nur seine Beschreibung.
    expect(dialog).toMatch(/\{a\.block\}/)
  })

  it('auch der gescheiterte Versuch wird aufgezeichnet', () => {
    // Am VERHALTEN: wer nur Erfolge aufzeichnet, liest spaeter eine Anlage,
    // an der nie jemand etwas versucht hat.
    const auftrag = hubAuftraege([
      {
        equipmentId: 'hubA',
        equipmentName: 'Hub A',
        ipAddress: '10.0.0.5',
        input: 1,
        inputName: 'Kamera 2',
        output: 2,
        outputName: 'Regie',
      },
    ])[0]
    const raus = eintraegeFuerAuftrag(
      auftrag,
      { ok: false, message: 'timeout' },
      { at: '2026-09-08T10:00:00.000Z', quelleId: 'cam2', by: '  Lars  ' },
    )
    expect(raus).toHaveLength(1)
    expect(raus[0]).toMatchObject({
      at: '2026-09-08T10:00:00.000Z',
      equipmentId: 'hubA',
      output: 2,
      input: 1,
      outputName: 'Regie',
      inputName: 'Kamera 2',
      quelleId: 'cam2',
      by: 'Lars',
      ok: false,
      message: 'timeout',
    })
    // Ein Name aus lauter Leerzeichen wird nicht zu einem Pruefer.
    const ohneNamen = eintraegeFuerAuftrag(auftrag, { ok: true }, { at: 'x', by: '   ' })
    expect(ohneNamen[0]).not.toHaveProperty('by')
    expect(ohneNamen[0]).not.toHaveProperty('message')
    // …und der Dialog geht tatsaechlich durch diese Funktion.
    expect(dialog).toMatch(/eintraegeFuerAuftrag\(/)
  })

  it('der Zeitpunkt kommt vom Aufrufer, nicht aus dem Store', () => {
    expect(dialog).toMatch(/const at = new Date\(\)\.toISOString\(\)/)
    const slice = ohneKommentare(metaSliceSrc)
    const stelle = slice.slice(slice.indexOf('recordHubSwitch:'))
    expect(stelle.slice(0, 600)).not.toMatch(/new Date\(/)
  })

  it('der Eintrag wird ANGEHAENGT, nie ersetzt', () => {
    expect(ohneKommentare(metaSliceSrc)).toMatch(
      /hubSwitches: \[eintrag, \.\.\.\(state\.project\.hubSwitches \?\? \[\]\)\]/,
    )
  })

  it('die Heilung ist verdrahtet', () => {
    expect(ohneKommentare(projectStoreSrc)).toMatch(
      /normaliseHubSwitches\(project\.hubSwitches, geraeteIds,/,
    )
  })

  it('der Knopf erscheint nur, wenn ueberhaupt eine Kreuzschiene im Weg liegt', () => {
    // Am VERHALTEN. Ein Quelltext-Scan auf die Bedingung waere gruen
    // geblieben, haette jemand `schaltbar` auf `true` festgenagelt — und
    // genau das ist der Fehler, der weh taete: ein Knopf, hinter dem eine
    // leere Liste steht.
    const mit = patternRouting(anlage(), 'cam1')
    expect(schaltbareWege(mit.ziele).length).toBeGreaterThan(0)

    const p = anlage()
    p.equipment = [
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
    ]
    p.cables = [kabel('k1', ['cam1', 'c1out'], ['mon1', 'm1in'])]
    const ohne = patternRouting(p, 'cam1')
    expect(ohne.ziele).toHaveLength(1)
    expect(schaltbareWege(ohne.ziele)).toEqual([])

    // Streifen und Dialog fragen dieselbe Funktion — zwei gleichlautende
    // Filter liefen irgendwann auseinander.
    const chip = ohneKommentare(chipSrc)
    expect(chip).toMatch(/schaltbareWege\(routing\.ziele\)/)
    expect(dialog).toMatch(/schaltbareWege\(routing\.ziele\)/)
  })
})

describe('Beim Laden faellt, was ins Leere zeigt — und wird gemeldet', () => {
  const ids = new Set(['hubA'])
  const eintrag = (over: Partial<HubSwitch> = {}): HubSwitch => ({
    at: '2026-09-08T10:00:00.000Z',
    equipmentId: 'hubA',
    output: 0,
    input: 1,
    outputName: 'Regie',
    inputName: 'Kamera 1',
    ok: true,
    ...over,
  })

  it('ein Eintrag auf eine geloeschte Kreuzschiene faellt, mit Grund', () => {
    const gruende: string[] = []
    const raus = normaliseHubSwitches(
      [eintrag(), eintrag({ equipmentId: 'weg' })],
      ids,
      (d) => gruende.push(d.reason),
    )
    expect(raus).toHaveLength(1)
    expect(gruende).toEqual(['dangling-ref'])
  })

  it('ohne Ergebnis, ohne Zeitpunkt oder mit krummer Nummer faellt er auch', () => {
    const gruende: string[] = []
    const raus = normaliseHubSwitches(
      [
        eintrag({ ok: undefined as unknown as boolean }),
        eintrag({ at: '' }),
        eintrag({ output: -1 }),
        eintrag({ input: 1.5 }),
        eintrag(),
      ],
      ids,
      (d) => gruende.push(d.reason),
    )
    expect(raus).toHaveLength(1)
    expect(gruende).toEqual([
      'missing-required',
      'missing-required',
      'missing-required',
      'missing-required',
    ])
  })

  it('was kein Array ist, ergibt eine leere Liste statt eines Absturzes', () => {
    expect(normaliseHubSwitches(undefined, ids)).toEqual([])
    expect(normaliseHubSwitches({ a: 1 }, ids)).toEqual([])
  })

  it('die Reihenfolge bleibt, wie sie war', () => {
    // Der jüngste Eintrag steht vorn, weil er vorn angehaengt wurde. Ein
    // Umsortieren beim Laden vertauschte „wer zuletzt geschaltet hat".
    const a = eintrag({ at: '2026-09-08T09:00:00.000Z' })
    const b = eintrag({ at: '2026-09-08T11:00:00.000Z' })
    expect(normaliseHubSwitches([b, a], ids).map((s) => s.at)).toEqual([b.at, a.at])
  })

  it('die Protokoll-Zeile zaehlt ab 1 und nennt das Ergebnis', () => {
    const zeilen = hubSwitchZeilen([eintrag({ ok: false, message: 'timeout' })], () => 'Hub A')
    expect(zeilen[0]).toMatchObject({
      geraet: 'Hub A',
      ausgang: '1 (Regie)',
      eingang: '2 (Kamera 1)',
      ergebnis: 'abgelehnt: timeout',
    })
  })
})
