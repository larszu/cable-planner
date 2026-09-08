import { describe, expect, it } from 'vitest'
import {
  KreuzpunktFehler,
  buildCrosspointCommand,
  kreuzpunktKlartext,
  pruefeKreuzpunkte,
} from '../src/renderer/lib/videohubCrosspoint'
import { buildVideohubRoutingCommand } from '../src/renderer/lib/exportVideohub'
import {
  actionKlartext,
  atemBefehlText,
  controlActions,
  eintraegeFuerAction,
  schaltbareWege,
  sendebereit,
} from '../src/renderer/lib/controlActions'
import { PROTOCOL_INFO } from '../src/renderer/types/switcherControl'
import switcherTypesSrc from '../src/main/services/switcherControl/types.ts?raw'
import rendererTypesSrc from '../src/renderer/types/switcherControl.ts?raw'
import atemDriverSrc from '../src/main/services/switcherControl/atemDriver.ts?raw'
import videohubDriverSrc from '../src/main/services/switcherControl/videohubDriver.ts?raw'
import indexSrc from '../src/main/services/switcherControl/index.ts?raw'
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

/** Dieselbe Anlage, aber mit erklaertem Protokoll — sonst wird nichts gesendet. */
const mitProtokoll = (): CablePlannerProject => {
  const p = anlage()
  for (const e of p.equipment) {
    if (e.id.startsWith('hub')) e.controlProtocol = 'videohub'
  }
  return p
}

/**
 * Ein ATEM: zwei Eingaenge mit Quellen-Nummern, ein Aux und der Programm-Bus.
 * Kamera 1 haengt an Eingang 1 (Quelle 1), der Aux geht an den Monitor.
 */
const mitMischer = (over: { adressen?: boolean } = {}): CablePlannerProject => {
  const adressen = over.adressen ?? true
  const inPort = (id: string, address: number) =>
    adressen
      ? ({ ...port(id), control: { role: 'input' as const, address } })
      : port(id)
  const outPort = (id: string, role: 'program' | 'aux', address: number) =>
    adressen ? ({ ...port(id), control: { role, address } }) : port(id)
  return {
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    equipment: [
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('cam2', { name: 'Kamera 2', outputs: [port('c2out')] }),
      eq('mix', {
        name: 'ATEM Mini Extreme',
        ipAddress: '10.0.0.9',
        controlProtocol: 'atem',
        inputs: [inPort('x_in0', 1), inPort('x_in1', 2)],
        outputs: [outPort('x_pgm', 'program', 0), outPort('x_aux1', 'aux', 0)],
        plannedCrosspoints: { x_aux1: 'x_in0' },
      }),
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
    ],
    cables: [
      kabel('k1', ['cam1', 'c1out'], ['mix', 'x_in0']),
      kabel('k2', ['cam2', 'c2out'], ['mix', 'x_in1']),
      kabel('k3', ['mix', 'x_aux1'], ['mon1', 'm1in']),
    ],
    canvasState: { x: 0, y: 0, zoom: 1 },
  } as unknown as CablePlannerProject
}

describe('Die Kreuzpunkte werden abgelesen, nicht neu gesucht', () => {
  const routing = patternRouting(anlage(), 'cam1')
  const weg = routing.ziele.find((z) => z.equipmentId === 'mon1')

  it('der Weg zum Monitor laeuft ueber beide Kreuzschienen', () => {
    expect(weg).toBeTruthy()
    expect(weg!.kreuzpunkte.map((k) => k.equipmentId)).toEqual(['hubA', 'hubB'])
  })

  it('sie tragen ANSCHLUESSE, keine Protokollnummern', () => {
    // Die Uebersetzung Anschluss -> Adresse gehoert dorthin, wo das Protokoll
    // bekannt ist. Stuenden hier Indizes, waeren sie eine stille Festlegung
    // auf den Videohub — und beim Mischer der Befehl an den falschen Bus.
    const [a, b] = weg!.kreuzpunkte
    expect(a).toMatchObject({ inputPortId: 'a_in0', outputPortId: 'a_out0', ipAddress: '10.0.0.5' })
    expect(b).toMatchObject({ inputPortId: 'b_in0', outputPortId: 'b_out1', ipAddress: '10.0.0.6' })
    expect(a).not.toHaveProperty('input')
    expect(a).not.toHaveProperty('output')
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

  it('zwei Kreuzschienen ergeben zwei Befehle, in der Reihenfolge des Wegs', () => {
    const plan = controlActions(mitProtokoll(), weg.kreuzpunkte)
    expect(plan.hindernisse).toEqual([])
    expect(plan.actions.map((a) => a.equipmentId)).toEqual(['hubA', 'hubB'])
  })

  it('kein Befehl nennt einen fremden Ausgang', () => {
    // DIE eigentliche Zusicherung, am ganzen Weg statt am Baustein: Hub B hat
    // laut Modell 80 Ausgaenge, der Weg braucht einen. Genau einer steht drin.
    const plan = controlActions(mitProtokoll(), weg.kreuzpunkte)
    for (const a of plan.actions) {
      expect(a.vorschau.trim().split('\n').slice(1)).toHaveLength(1)
    }
    expect(plan.actions[1].vorschau).toBe('VIDEO OUTPUT ROUTING:\n1 0\n\n')
  })

  it('zweimal dieselbe Kreuzschiene ergibt einen Auftrag mit zwei Zeilen', () => {
    const p = anlage()
    const hubA = p.equipment.find((e) => e.id === 'hubA')!
    hubA.controlProtocol = 'videohub'
    hubA.outputs = [port('a_out0'), port('a_out1'), port('a_out2'), port('a_out3')]
    const punkte: HubKreuzpunkt[] = [
      {
        equipmentId: 'hubA',
        equipmentName: 'Hub A',
        ipAddress: '10.0.0.5',
        inputPortId: 'a_in0',
        inputName: 'in0',
        outputPortId: 'a_out0',
        outputName: 'out0',
      },
      {
        equipmentId: 'hubA',
        equipmentName: 'Hub A',
        ipAddress: '10.0.0.5',
        inputPortId: 'a_in1',
        inputName: 'in1',
        outputPortId: 'a_out3',
        outputName: 'out3',
      },
    ]
    const plan = controlActions(p, punkte)
    expect(plan.actions).toHaveLength(1)
    const a = plan.actions[0]
    expect(a.protocol).toBe('videohub')
    expect(a.vorschau.trim().split('\n').slice(1)).toEqual(['0 0', '3 1'])
    expect(actionKlartext(a, punkte)).toHaveLength(2)
  })

  it('eine fehlende Adresse wird BENANNT, nicht nur ausgegraut', () => {
    const p = mitProtokoll()
    p.equipment.find((e) => e.id === 'hubA')!.ipAddress = ''
    const plan = controlActions(p, weg.kreuzpunkte)
    expect(plan.hindernisse[0].grund).toMatch(/IP-Adresse/)
  })

  it('ein Geraet ohne erklaertes Protokoll bekommt keinen Befehl, sondern einen Satz', () => {
    // ADR-002: welches Protokoll ein Geraet spricht, steht nicht im Namen. Ein
    // Geraet „Videohub Ersatz" bekaeme sonst einen Videohub-Befehl auf 9990.
    const plan = controlActions(anlage(), weg.kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse).toHaveLength(2)
    expect(plan.hindernisse[0].grund).toMatch(/Steuer-Protokoll/)
  })
})

describe('Der ATEM spricht seine eigenen Nummern', () => {
  it('der Aux-Weg ergibt setAuxSource mit Bus und Quelle', () => {
    const p = mitMischer()
    const routing = patternRouting(p, 'cam1')
    const weg = routing.ziele.find((z) => z.equipmentId === 'mon1')!
    const plan = controlActions(p, weg.kreuzpunkte)
    expect(plan.hindernisse).toEqual([])
    const a = plan.actions[0]
    expect(a.protocol).toBe('atem')
    expect(a).toMatchObject({ art: 'aufruf', host: '10.0.0.9' })
    expect(a.protocol === 'atem' && a.befehle).toEqual([{ kind: 'aux', bus: 0, source: 1 }])
    expect(a.vorschau).toBe('setAuxSource(1, Aux 1)')
  })

  it('OHNE eingetragene Nummern wird NICHT gesendet — und der Grund nennt den Anschluss', () => {
    // Die Position in der Liste als Nummer zu nehmen ergaebe einen Befehl an
    // den falschen Bus, und der ginge an eine laufende Anlage.
    const p = mitMischer({ adressen: false })
    const routing = patternRouting(p, 'cam1')
    const weg = routing.ziele.find((z) => z.equipmentId === 'mon1')!
    const plan = controlActions(p, weg.kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Quellen-Nummer/)
  })

  it('fehlt nur die Ausgangs-Rolle, sagt der Grund genau das', () => {
    const p = mitMischer()
    const mix = p.equipment.find((e) => e.id === 'mix')!
    mix.outputs = mix.outputs.map((o) =>
      o.id === 'x_aux1' ? (({ control: _weg, ...rest }) => rest)(o) : o,
    )
    const routing = patternRouting(p, 'cam1')
    const weg = routing.ziele.find((z) => z.equipmentId === 'mon1')!
    const plan = controlActions(p, weg.kreuzpunkte)
    expect(plan.actions).toEqual([])
    expect(plan.hindernisse[0].grund).toMatch(/Programm, Vorschau oder ein Aux/)
  })

  it('die Vorschau nennt AUFRUFE und behauptet keinen gesendeten Text', () => {
    // Der ATEM spricht kein Text-Protokoll. Ein erfundener Textblock waere
    // genau die Sorte Behauptung, gegen die der ganze Weg gebaut ist.
    expect(atemBefehlText({ kind: 'program', me: 0, source: 3 })).toBe('changeProgramInput(3, ME 1)')
    expect(atemBefehlText({ kind: 'preview', me: 1, source: 2 })).toBe('changePreviewInput(2, ME 2)')
    expect(atemBefehlText({ kind: 'aux', bus: 2, source: 8 })).toBe('setAuxSource(8, Aux 3)')
    expect(atemBefehlText({ kind: 'cut', me: 0 })).toBe('cut(ME 1)')
  })

  it('das Protokoll sagt selbst, dass seine Nummern erklaert werden muessen', () => {
    expect(PROTOCOL_INFO.atem.adressen).toBe('declared')
    expect(PROTOCOL_INFO.videohub.adressen).toBe('index')
    // Und der ATEM hat keinen einstellbaren Port — die Bibliothek legt ihn fest.
    expect(PROTOCOL_INFO.atem).not.toHaveProperty('defaultPort')
    expect(PROTOCOL_INFO.videohub.defaultPort).toBe(9990)
  })
})

describe('Die Treiber senden nur, was der Befehl sagt', () => {
  const atemDriver = ohneKommentare(atemDriverSrc)
  const videohubDriver = ohneKommentare(videohubDriverSrc)

  it('der Videohub-Treiber baut den Block NICHT neu', () => {
    // Ein zweiter Bauer waere die Defektform `zwei-rechnungen` — mit einer
    // laufenden Anlage als Schauplatz. Er sendet, was der Renderer geprueft hat.
    expect(videohubDriver).not.toMatch(/VIDEO OUTPUT ROUTING:/)
    expect(videohubDriver).not.toMatch(/buildVideohubRoutingCommand|buildCrosspointCommand/)
    expect(videohubDriver).toMatch(/socket\.write\(vorschau\)/)
  })

  it('der ATEM-Treiber benutzt die EINE Sitzung, nicht eine eigene Verbindung', () => {
    // Eine zweite Verbindung zum selben Mischer ginge am Connect-Lock vorbei,
    // und der Fehler waere ein sporadischer.
    expect(atemDriver).toMatch(/from '\.\.\/atemSession\.js'/)
    expect(atemDriver).not.toMatch(/new Atem\(/)
  })

  it('der ATEM-Treiber sendet an die Adresse des BEFEHLS, nicht an die verbundene', () => {
    // Stillschweigend an den gerade verbundenen Mischer zu senden waere ein
    // Befehl an das FALSCHE Geraet.
    expect(atemDriver).toMatch(/atemStatus\(\)\.ip !== host/)
  })

  it('kein Treiber wiederholt einen Schaltbefehl', () => {
    // Ein wiederholter Schaltbefehl ist kein harmloser Doppelklick: zwischen
    // den Versuchen kann jemand anders geschaltet haben.
    for (const src of [atemDriver, videohubDriver]) {
      expect(src).not.toMatch(/retry|versuch\s*<|for \(let v = 0/i)
    }
  })

  it('jedes Protokoll aus dem Typ hat einen Treiber', () => {
    // `satisfies Record<…>` im Modul haelt es zur Bauzeit; hier steht, dass
    // die beiden Seiten dieselbe Liste meinen.
    const treiber = ohneKommentare(indexSrc)
    for (const k of Object.keys(PROTOCOL_INFO)) {
      expect(treiber, k).toMatch(new RegExp(`${k}: `))
    }
  })

  it('die Befehls-Form ist auf beiden Seiten der Bruecke dieselbe', () => {
    // Der Hauptprozess baut gegen eine eigene tsconfig und darf nicht in den
    // Renderer-Baum hineinreichen; die Form steht deshalb zweimal. Dass sie
    // gleich bleibt, haelt dieser Waechter — sonst faellt es erst auf, wenn
    // ein Feld beim Geraet fehlt.
    const felder = /protocol|equipmentId|equipmentName|host|port|vorschau|art|punkte|befehle/g
    const haupt = (ohneKommentare(switcherTypesSrc).match(felder) ?? []).sort()
    const rend = (ohneKommentare(rendererTypesSrc).match(felder) ?? []).sort()
    for (const f of new Set(haupt)) expect(rend, f).toContain(f)
    for (const f of ['punkte', 'befehle', 'vorschau', 'art']) {
      expect(haupt, f).toContain(f)
    }
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
    expect(dialog).toMatch(/controlActions\(/)
  })

  it('der Haken muss gesetzt sein, bevor gesendet werden kann', () => {
    // Am VERHALTEN, nicht an der Form des Ausdrucks: ein Waechter, der
    // `hindernisse.length === 0 && verstanden` im Quelltext sucht, wird bei
    // einer richtigen Umstellung rot und dann geaendert statt gelesen.
    const p = mitProtokoll()
    const weg = patternRouting(p, 'cam1').ziele.find((z) => z.equipmentId === 'mon1')!
    const plan = controlActions(p, weg.kreuzpunkte)
    expect(sendebereit(plan, false)).toBe(false)
    expect(sendebereit(plan, true)).toBe(true)
    expect(sendebereit({ actions: [], hindernisse: [] }, true)).toBe(false)
    // Ein Hindernis sperrt, auch wenn es daneben Befehle gaebe.
    const ohneIp = mitProtokoll()
    ohneIp.equipment.find((e) => e.id === 'hubA')!.ipAddress = ''
    const planOhne = controlActions(ohneIp, weg.kreuzpunkte)
    expect(planOhne.actions.length).toBeGreaterThan(0)
    expect(sendebereit(planOhne, true)).toBe(false)
    // …und der Dialog fragt tatsaechlich danach, statt selbst zu entscheiden.
    expect(dialog).toMatch(/sendebereit\(plan, verstanden\)/)
  })

  it('der gesendete Befehl steht sichtbar im Dialog — und wird richtig benannt', () => {
    // Wer einen Befehl an eine laufende Anlage bestaetigt, soll ihn lesen
    // koennen. Die Ueberschrift unterscheidet Text-Protokoll und Aufrufe:
    // ein „wortwoertlich gesendet" ueber einem Binaerprotokoll waere gelogen.
    expect(dialog).toMatch(/\{a\.vorschau\}/)
    expect(dialog).toMatch(/a\.art === 'text'/)
    expect(dialog).toMatch(/sentCalls/)
  })

  it('auch der gescheiterte Versuch wird aufgezeichnet', () => {
    // Am VERHALTEN: wer nur Erfolge aufzeichnet, liest spaeter eine Anlage,
    // an der nie jemand etwas versucht hat.
    const p = mitProtokoll()
    const weg = patternRouting(p, 'cam1').ziele.find((z) => z.equipmentId === 'mon1')!
    const plan = controlActions(p, weg.kreuzpunkte)
    const raus = eintraegeFuerAction(
      plan.actions[0],
      weg.kreuzpunkte,
      { ok: false, message: 'timeout' },
      { at: '2026-09-08T10:00:00.000Z', quelleId: 'cam1', by: '  Lars  ' },
    )
    expect(raus).toHaveLength(1)
    expect(raus[0]).toMatchObject({
      at: '2026-09-08T10:00:00.000Z',
      equipmentId: 'hubA',
      protocol: 'videohub',
      output: 0,
      input: 0,
      quelleId: 'cam1',
      by: 'Lars',
      ok: false,
      message: 'timeout',
      befehl: '0 0',
    })
    // Ein Name aus lauter Leerzeichen wird nicht zu einem Pruefer.
    const ohneNamen = eintraegeFuerAction(plan.actions[0], weg.kreuzpunkte, { ok: true }, { at: 'x', by: '   ' })
    expect(ohneNamen[0]).not.toHaveProperty('by')
    expect(ohneNamen[0]).not.toHaveProperty('message')
    // …und der Dialog geht tatsaechlich durch diese Funktion.
    expect(dialog).toMatch(/eintraegeFuerAction\(/)
  })

  it('der ATEM-Eintrag traegt sein Protokoll und den Aufruf', () => {
    // Ohne `protocol` zaehlte das Blatt spaeter ab 1 und machte aus Quelle 1
    // die Quelle 2.
    const p = mitMischer()
    const weg = patternRouting(p, 'cam1').ziele.find((z) => z.equipmentId === 'mon1')!
    const plan = controlActions(p, weg.kreuzpunkte)
    const raus = eintraegeFuerAction(plan.actions[0], weg.kreuzpunkte, { ok: true }, { at: 'x' })
    expect(raus[0]).toMatchObject({
      protocol: 'atem',
      output: 0,
      input: 1,
      befehl: 'setAuxSource(1, Aux 1)',
    })
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

  it('der Knopf erscheint nur, wenn ueberhaupt ein schaltendes Geraet im Weg liegt', () => {
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
