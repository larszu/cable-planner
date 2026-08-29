import { describe, expect, it } from 'vitest'
import {
  buildGraphContext,
  deriveLabels,
  labelTargetIssues,
  resolveSignalSource,
} from '../src/renderer/lib/labelDerivation'
import { runDrawingChecks } from '../src/renderer/lib/drawingChecks'
import { createDemoProject } from '../src/renderer/lib/demoProject'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'

const port = (id: string, name: string, over: Partial<Port> = {}): Port => ({
  id,
  name,
  type: 'BNC',
  connectorType: 'BNC',
  ...over,
})

const eq = (over: Partial<EquipmentItem>): EquipmentItem => ({
  id: 'e1',
  name: 'Gerät',
  category: 'Video',
  inputs: [],
  outputs: [],
  x: 0,
  y: 0,
  width: 200,
  height: 160,
  ...over,
})

const cable = (from: [string, string], to: [string, string], id = `${from[1]}->${to[1]}`): Cable => ({
  id,
  name: id,
  type: 'BNC',
  length: 10,
  color: '#fff',
  fromEquipmentId: from[0],
  fromPortId: from[1],
  toEquipmentId: to[0],
  toPortId: to[1],
  notes: '',
})

const atem = (inputs: Port[]) =>
  eq({ id: 'atem', name: 'ATEM Mini Extreme', category: 'Video', inputs })

const camera = (id: string, name: string, extra: Partial<EquipmentItem> = {}) =>
  eq({
    id,
    name,
    category: 'Kameras',
    outputs: [port(`${id}-out`, 'SDI Out')],
    ...extra,
  })

describe('resolveSignalSource', () => {
  it('findet die direkt verkabelte Quelle', () => {
    const equipment = [atem([port('in1', '1 SDI 3G')]), camera('cam1', 'Kamera 1')]
    const cables = [cable(['cam1', 'cam1-out'], ['atem', 'in1'])]
    const ctx = buildGraphContext(equipment, cables)
    expect(resolveSignalSource('in1', ctx)).toEqual({ equipmentId: 'cam1', hops: 0 })
  })

  it('laeuft durch einen Konverter hindurch bis zur Kamera', () => {
    const conv = eq({
      id: 'conv',
      name: 'SDI-Konverter',
      inputs: [port('conv-in', 'SDI In')],
      outputs: [port('conv-out', 'SDI Out')],
    })
    const equipment = [atem([port('in1', '1 SDI 3G')]), camera('cam1', 'Kamera 1'), conv]
    const cables = [
      cable(['cam1', 'cam1-out'], ['conv', 'conv-in']),
      cable(['conv', 'conv-out'], ['atem', 'in1']),
    ]
    const ctx = buildGraphContext(equipment, cables)
    expect(resolveSignalSource('in1', ctx)).toEqual({ equipmentId: 'cam1', hops: 1 })
  })

  it('laeuft NICHT durch den Genlock-Eingang einer Kamera hindurch', () => {
    // Der Trugschluss, den diese Regel verhindert: eine Kamera mit genau einem
    // verkabelten Eingang sieht strukturell aus wie ein Konverter. Ohne die
    // Referenz-Port-Regel traegt der ATEM-Eingang am Ende den Namen des
    // Sync-Generators statt den der Kamera.
    const cam = camera('cam1', 'Kamera 1', { inputs: [port('cam1-ref', 'Genlock In')] })
    const sync = eq({ id: 'sync', name: 'Sync-Generator', outputs: [port('sync-out', 'Ref Out')] })
    const equipment = [atem([port('in1', '1 SDI 3G')]), cam, sync]
    const cables = [
      cable(['sync', 'sync-out'], ['cam1', 'cam1-ref']),
      cable(['cam1', 'cam1-out'], ['atem', 'in1']),
    ]
    const ctx = buildGraphContext(equipment, cables)
    expect(resolveSignalSource('in1', ctx)).toEqual({ equipmentId: 'cam1', hops: 0 })
  })

  it('haelt bei mehrdeutiger Speisung am Zwischengeraet an', () => {
    const mixer = eq({
      id: 'mix',
      name: 'Umschalter',
      inputs: [port('mix-a', 'In A'), port('mix-b', 'In B')],
      outputs: [port('mix-out', 'Out')],
    })
    const equipment = [
      atem([port('in1', '1 SDI 3G')]),
      camera('cam1', 'Kamera 1'),
      camera('cam2', 'Kamera 2'),
      mixer,
    ]
    const cables = [
      cable(['cam1', 'cam1-out'], ['mix', 'mix-a']),
      cable(['cam2', 'cam2-out'], ['mix', 'mix-b']),
      cable(['mix', 'mix-out'], ['atem', 'in1']),
    ]
    const ctx = buildGraphContext(equipment, cables)
    expect(resolveSignalSource('in1', ctx)).toEqual({ equipmentId: 'mix', hops: 0 })
  })

  it('liefert null fuer einen unverkabelten Eingang', () => {
    const equipment = [atem([port('in1', '1 SDI 3G')])]
    expect(resolveSignalSource('in1', buildGraphContext(equipment, []))).toBeNull()
  })

  it('laeuft sich in einer Schleife nicht fest', () => {
    const a = eq({
      id: 'a',
      name: 'Konverter A',
      inputs: [port('a-in', 'In')],
      outputs: [port('a-out', 'Out')],
    })
    const b = eq({
      id: 'b',
      name: 'Konverter B',
      inputs: [port('b-in', 'In')],
      outputs: [port('b-out', 'Out')],
    })
    const equipment = [atem([port('in1', 'In 1')]), a, b]
    const cables = [
      cable(['a', 'a-out'], ['b', 'b-in']),
      cable(['b', 'b-out'], ['a', 'a-in']),
      cable(['a', 'a-out'], ['atem', 'in1'], 'a-to-atem'),
    ]
    const ctx = buildGraphContext(equipment, cables)
    const resolved = resolveSignalSource('in1', ctx)
    expect(resolved).not.toBeNull()
    expect(resolved!.hops).toBeLessThanOrEqual(8)
  })
})

describe('deriveLabels', () => {
  const scene = () => {
    const equipment = [
      atem([port('in1', '1 SDI 3G'), port('in2', '2 SDI 3G')]),
      camera('cam1', 'Kamera 1'),
      camera('cam2', 'Kamera 10'),
    ]
    const cables = [
      cable(['cam1', 'cam1-out'], ['atem', 'in1']),
      cable(['cam2', 'cam2-out'], ['atem', 'in2']),
    ]
    return { equipment, cables }
  }

  it('behauptet nur, was der ATEM-Export wirklich sendet', () => {
    // Treue-Regel: der Kandidat ist `shortenForAtem(portDisplayLabel(port))` —
    // exakt die Kette aus AtemDialog. Die aufgeloeste Quelle waere ein
    // schoenerer Text, aber kein Geraet bekaeme ihn je zu sehen.
    const { candidates } = deriveLabels(scene())
    const long = candidates.find((c) => c.key === 'atem-long:in1')
    expect(long).toMatchObject({ raw: '3G', provenance: 'port-name' })
  })

  it('loest die Quelle trotzdem auf — sie traegt UMD-Text und Anker', () => {
    const { candidates, sources } = deriveLabels(scene())
    expect(sources.map((s) => s.sourceEquipmentId)).toEqual(['cam1', 'cam2'])
    const umd = candidates.filter((c) => c.targetId === 'tsl-umd-v31')
    expect(umd.map((c) => c.raw)).toEqual(['K1', 'K10'])
  })

  it('liefert den UMD-Text auch fuer einen Eingang ganz ohne Label', () => {
    const equipment = [
      eq({ id: 'atem', name: 'ATEM Mini Extreme', inputs: [port('in1', '')] }),
      camera('cam1', 'Kamera 1'),
    ]
    const cables = [cable(['cam1', 'cam1-out'], ['atem', 'in1'])]
    const { candidates } = deriveLabels({ equipment, cables })
    expect(candidates.map((c) => c.targetId)).toEqual(['tsl-umd-v31'])
  })

  it('laesst ein gesetztes contentLabel gewinnen — das ist eine Aussage', () => {
    const { equipment, cables } = scene()
    equipment[0].inputs[0] = port('in1', '1 SDI 3G', { contentLabel: 'PGM' })
    const { candidates } = deriveLabels({ equipment, cables })
    const long = candidates.find((c) => c.key === 'atem-long:in1')
    expect(long).toMatchObject({ raw: 'PGM', provenance: 'port-content-label' })
  })

  it('nutzt den Portnamen, wenn kein contentLabel gesetzt ist', () => {
    const equipment = [atem([port('in1', 'SDI 1')])]
    const { candidates } = deriveLabels({ equipment, cables: [] })
    expect(candidates.find((c) => c.key === 'atem-long:in1')).toMatchObject({
      raw: 'SDI 1',
      provenance: 'port-name',
    })
  })

  it('merkt sich die Eingangsnummer — die adressiert der ATEM auf dem Draht', () => {
    const { sources } = deriveLabels(scene())
    expect(sources).toEqual([
      { sinkEquipmentId: 'atem', sinkPortId: 'in1', inputIndex: 1, sourceEquipmentId: 'cam1', hops: 0 },
      { sinkEquipmentId: 'atem', sinkPortId: 'in2', inputIndex: 2, sourceEquipmentId: 'cam2', hops: 0 },
    ])
  })

  it('meldet die UMD-Adresse als offen — die kann kein Graph beantworten', () => {
    const { unanswered } = deriveLabels(scene())
    expect(unanswered.map((u) => u.equipmentId)).toEqual(['cam1', 'cam2'])
    expect(unanswered[0]).toMatchObject({ field: 'umd-address' })
    expect(unanswered[0].reason).toContain('Eingang 1')
  })

  it('vergibt je Quelle genau einen UMD-Kandidaten, auch bei Mehrfachspeisung', () => {
    // Eine Kamera auf zwei Mischer-Eingaengen (z. B. Haupt- und Reserveweg)
    // ist EIN Display-Text, nicht zwei.
    const equipment = [
      atem([port('in1', 'In 1'), port('in2', 'In 2')]),
      camera('cam1', 'Kamera 1', {
        outputs: [port('cam1-out', 'SDI Out 1'), port('cam1-out2', 'SDI Out 2')],
      }),
    ]
    const cables = [
      cable(['cam1', 'cam1-out'], ['atem', 'in1']),
      cable(['cam1', 'cam1-out2'], ['atem', 'in2']),
    ]
    const { candidates } = deriveLabels({ equipment, cables })
    const umd = candidates.filter((c) => c.targetId === 'tsl-umd-v31')
    expect(umd.map((c) => c.equipmentId)).toEqual(['cam1'])
  })

  it('erzeugt fuer einen Videohub Labels aus Ein- UND Ausgaengen, aber kein UMD', () => {
    const vh = eq({
      id: 'vh',
      name: 'Smart Videohub 12x12',
      inputs: [port('vh-in1', 'In 1', { contentLabel: 'Kamera 1' })],
      outputs: [port('vh-out1', 'Out 1', { contentLabel: 'Regie' })],
    })
    const { candidates } = deriveLabels({ equipment: [vh], cables: [] })
    expect(candidates.map((c) => c.targetId)).toEqual(['videohub-label', 'videohub-label'])
    expect(candidates.map((c) => c.raw)).toEqual(['Kamera 1', 'Regie'])
  })

  it('erzeugt nichts fuer Geraete ohne Zielsystem', () => {
    const { candidates } = deriveLabels({ equipment: [camera('cam1', 'Kamera 1')], cables: [] })
    expect(candidates).toEqual([])
  })
})

describe('labelTargetIssues', () => {
  it('meldet zwei Eingaenge, die im ATEM-Kurznamen ununterscheidbar werden', () => {
    const equipment = [
      atem([
        port('in1', '1 SDI 3G', { contentLabel: 'Kamera 1' }),
        port('in2', '2 SDI 3G', { contentLabel: 'Kamera 10' }),
      ]),
    ]
    const issues = labelTargetIssues({ equipment, cables: [] })
    const collision = issues.find((i) => i.category === 'ATEM-Namenskollision')
    expect(collision?.severity).toBe('error')
    expect(collision?.message).toContain('"Kamera 1"')
    expect(collision?.message).toContain('"Kamera 10"')
    expect(collision?.message).toContain('"KAME"')
  })

  it('meldet auch die stille Variante: zwei Ports, die gleich heissen wollen', () => {
    // Ohne contentLabel bleibt vom technischen Portnamen im ATEM-Langnamen
    // "3G" uebrig — auf beiden Eingaengen. Das faellt sonst erst auf dem
    // Multiviewer auf.
    const equipment = [atem([port('in1', '1 SDI 3G'), port('in2', '2 SDI 3G')])]
    const issues = labelTargetIssues({ equipment, cables: [] })
    expect(issues.some((i) => i.category === 'ATEM-Namenskollision')).toBe(true)
  })

  it('meldet Abschneiden allein NICHT — das ist der Normalfall', () => {
    const equipment = [
      atem([port('in1', 'In 1', { contentLabel: 'Weitwinkel Buehne' })]),
    ]
    const issues = labelTargetIssues({ equipment, cables: [] })
    expect(issues.some((i) => i.category === 'ATEM-Namenskollision')).toBe(false)
  })

  it('warnt vor einem Komma im Videohub-Label — es zerlegt die Labels.txt', () => {
    const vh = eq({
      id: 'vh',
      name: 'Smart Videohub 12x12',
      inputs: [port('vh-in1', 'In 1', { contentLabel: 'Kamera 1, links' })],
    })
    const issues = labelTargetIssues({ equipment: [vh], cables: [] })
    const charset = issues.find((i) => i.category === 'Videohub-Zeichensatz')
    expect(charset?.severity).toBe('warning')
    expect(charset?.message).toContain('","')
  })

  it('bleibt bei einem sauberen Plan still', () => {
    const equipment = [
      atem([
        port('in1', 'In 1', { contentLabel: 'CAM1' }),
        port('in2', 'In 2', { contentLabel: 'CAM2' }),
      ]),
      camera('cam1', 'Kamera 1', { shortName: 'CAM1' }),
      camera('cam2', 'Kamera 2', { shortName: 'CAM2' }),
    ]
    const cables = [
      cable(['cam1', 'cam1-out'], ['atem', 'in1']),
      cable(['cam2', 'cam2-out'], ['atem', 'in2']),
    ]
    expect(labelTargetIssues({ equipment, cables })).toEqual([])
  })
})

describe('labelTargetIssues — Dante', () => {
  it('meldet zwei Geraete, deren Dante-konforme Namen zusammenfallen', () => {
    // "Pult Regie" und "Pult-Regie" sind im Plan zwei Geraete; DNS-SD-konform
    // gemacht sind beide "Pult-Regie", und mDNS loest ohne Ruecksicht auf
    // Gross-/Kleinschreibung auf.
    const equipment = [
      eq({ id: 'a', name: 'Pult Regie', ipAddress: '10.0.0.10' }),
      eq({ id: 'b', name: 'pult-regie', ipAddress: '10.0.0.11' }),
    ]
    const issues = labelTargetIssues({ equipment, cables: [] })
    const collision = issues.find((i) => i.category === 'Dante-Namenskollision')
    expect(collision?.severity).toBe('error')
    expect(collision?.message).toContain('"Pult Regie"')
  })

  it('laesst Geraete ohne Netzwerkadresse aus', () => {
    const equipment = [
      eq({ id: 'a', name: 'Pult Regie' }),
      eq({ id: 'b', name: 'pult-regie' }),
    ]
    expect(labelTargetIssues({ equipment, cables: [] })).toEqual([])
  })

  it('meldet keinen Zeichensatz-Verstoss am Vorschlag selbst', () => {
    // Der Vorschlag ist per Konstruktion konform — eine Warnung darueber
    // waere eine Warnung ueber den eigenen Rat.
    const equipment = [eq({ id: 'a', name: 'Pult Bühne 1', ipAddress: '10.0.0.10' })]
    const issues = labelTargetIssues({ equipment, cables: [] })
    expect(issues.some((i) => i.category === 'Dante-Zeichensatz')).toBe(false)
  })
})

describe('Signalquellen-Rollen (Inkrement 2)', () => {
  const scene = (over: Partial<EquipmentItem> = {}) => {
    const equipment = [
      atem([port('in1', 'In 1')]),
      camera('cam1', 'Kamera 1 (Blech)', over),
    ]
    const cables = [cable(['cam1', 'cam1-out'], ['atem', 'in1'])]
    return { equipment, cables }
  }

  it('laesst die Rolle gegen den Geraetenamen gewinnen', () => {
    // Genau dafuer gibt es die Rolle: "Kamera 1" bleibt "Kamera 1", auch
    // wenn das Geraet dahinter die Havarie-Kamera ist.
    const { equipment, cables } = scene({ sourceIdentityId: 'r1' })
    const { candidates } = deriveLabels({
      equipment,
      cables,
      sourceIdentities: [{ id: 'r1', name: 'Kamera 1', umdAddress: 1 }],
    })
    const umd = candidates.find((c) => c.targetId === 'tsl-umd-v31')
    expect(umd).toMatchObject({ raw: 'Kamera 1', provenance: 'source-identity' })
  })

  it('meldet nichts mehr als offen, sobald die Adresse steht', () => {
    const { equipment, cables } = scene({ sourceIdentityId: 'r1' })
    const { unanswered } = deriveLabels({
      equipment,
      cables,
      sourceIdentities: [{ id: 'r1', name: 'Kamera 1', umdAddress: 1 }],
    })
    expect(unanswered).toEqual([])
  })

  it('unterscheidet "keine Rolle" von "Rolle ohne Adresse"', () => {
    const ohneRolle = deriveLabels(scene()).unanswered
    expect(ohneRolle[0].sourceIdentityId).toBeUndefined()
    expect(ohneRolle[0].reason).toContain('ohne gebundene Rolle')

    const { equipment, cables } = scene({ sourceIdentityId: 'r1' })
    const ohneAdresse = deriveLabels({
      equipment,
      cables,
      sourceIdentities: [{ id: 'r1', name: 'Kamera 1' }],
    }).unanswered
    expect(ohneAdresse[0]).toMatchObject({ sourceIdentityId: 'r1' })
    expect(ohneAdresse[0].reason).toContain('keine UMD-Adresse')
  })

  it('ignoriert eine Bindung auf eine Rolle, die es nicht gibt', () => {
    const { candidates } = deriveLabels({ ...scene({ sourceIdentityId: 'weg' }) })
    const umd = candidates.find((c) => c.targetId === 'tsl-umd-v31')
    expect(umd?.provenance).toBe('device-short-name')
  })

  it('meldet zwei Rollen auf derselben UMD-Adresse als Fehler', () => {
    const issues = labelTargetIssues({
      equipment: [],
      cables: [],
      sourceIdentities: [
        { id: 'a', name: 'Kamera 1', umdAddress: 3 },
        { id: 'b', name: 'Kamera 2', umdAddress: 3 },
      ],
    })
    const clash = issues.find((i) => i.category === 'UMD-Adresse doppelt')
    expect(clash?.severity).toBe('error')
    expect(clash?.message).toContain('"Kamera 1"')
    expect(clash?.message).toContain('"Kamera 2"')
  })

  it('meldet Rollen-Kollisionen auch ohne jedes Geraet im Plan', () => {
    // Die Rolle ist ein Projekt-Objekt, kein Geraete-Feld. Eine doppelte
    // Adresse ist auch dann falsch, wenn noch nichts verkabelt ist.
    const { errorCount } = runDrawingChecks({
      equipment: [],
      cables: [],
      sourceIdentities: [
        { id: 'a', name: 'Kamera 1', umdAddress: 3 },
        { id: 'b', name: 'Kamera 2', umdAddress: 3 },
      ],
    })
    expect(errorCount).toBe(1)
  })
})

describe('runDrawingChecks — Verdrahtung', () => {
  it('traegt die Label-Befunde in die Plan-Check-Liste', () => {
    const equipment = [
      atem([
        port('in1', 'In 1', { contentLabel: 'Kamera 1' }),
        port('in2', 'In 2', { contentLabel: 'Kamera 10' }),
      ]),
    ]
    const { findings, errorCount } = runDrawingChecks({ equipment, cables: [] })
    expect(findings.some((f) => f.category === 'ATEM-Namenskollision')).toBe(true)
    expect(errorCount).toBeGreaterThan(0)
  })
})

describe('Demo-Projekt', () => {
  it('bleibt still, weil dort gar kein Zielsystem steckt', () => {
    // Das Demo enthaelt einen generischen "Bildmischer" (4 BNC in), keinen
    // ATEM, keinen Videohub und kein adressiertes Netzwerkgeraet — die
    // Ableitung hat dort nichts zu sagen, und genau das steht hier.
    //
    // Der Test ist trotzdem ein Waechter: sobald `detectDeviceKind` weiter
    // greift oder ein Ziel dazukommt, faellt er auf und die Wirkung auf das
    // Erste, was ein neuer Nutzer sieht, wird eine bewusste Entscheidung.
    const demo = createDemoProject()
    const input = { equipment: demo.equipment, cables: demo.cables }
    expect(deriveLabels(input).candidates).toEqual([])
    expect(labelTargetIssues(input)).toEqual([])
  })
})
