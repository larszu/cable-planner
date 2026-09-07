import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RECORD_SCHEME,
  MAX_NAME_LENGTH,
  RECORD_NAME_FINDING_LABEL,
  recordNamePlan,
  recordNameSheet,
  type RecordNamingScheme,
} from '../src/renderer/lib/recordNaming'
import { BLACKMAGIC_CATALOG } from '../src/renderer/lib/blackmagicCatalog'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import type { SourceIdentity } from '../src/renderer/types/sourceIdentity'

// ───────────────────────────────────────────────────────────────────────────
// Bedarf 100 — der Aufnahmename kommt aus dem Plan.
//
//   > automated filename building FAILS SILENTLY while the button label still
//   > renders correctly
//
// Der groesste Teil dieser Tests haelt fest, was NICHT still passiert: ein
// Name, den ein Datentraeger ablehnt, zwei Aufzeichnungen unter demselben
// Namen, eine Rolle ohne Recorder. Alle drei enden ohne Befund in einer
// leeren Karte — und das faellt erst in der Post auf.
// ───────────────────────────────────────────────────────────────────────────

const port = (id: string, name: string) =>
  ({ id, name, type: 'video', connectorType: 'BNC' }) as never

const geraet = (id: string, name: string, extra: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name, type: 'camera', x: 0, y: 0, inputs: [], outputs: [], ...extra }) as unknown as EquipmentItem

const kabel = (id: string, from: string, fromPort: string, to: string, toPort: string): Cable =>
  ({ id, fromEquipmentId: from, fromPortId: fromPort, toEquipmentId: to, toPortId: toPort }) as unknown as Cable

const rolle = (id: string, name: string, number?: number): SourceIdentity =>
  ({ id, name, ...(number !== undefined ? { number } : {}) }) as SourceIdentity

const HYPERDECK = BLACKMAGIC_CATALOG.find((e) => e.template.name.includes('Hyperdeck'))!

const metadata = { name: 'Herbstgala', description: '', createdAt: '', updatedAt: '' }

/** Zwei Kameras auf zwei HyperDeck-Eingaenge — der Fall aus dem Beleg. */
const aufbau = (namen: [string, string] = ['Kamera 1', 'Kamera 2']) => {
  const cam1 = geraet('cam1', namen[0], {
    sourceIdentityId: 'r1',
    outputs: [port('cam1-out', 'SDI Out')],
  } as never)
  const cam2 = geraet('cam2', namen[1], {
    sourceIdentityId: 'r2',
    outputs: [port('cam2-out', 'SDI Out')],
  } as never)
  const deck = geraet('rec1', 'HyperDeck A', {
    type: 'recorder',
    deviceTypeId: HYPERDECK.deviceTypeId,
    inputs: [port('rec1-in1', 'SDI In 1'), port('rec1-in2', 'SDI In 2')],
  } as never)
  return {
    metadata,
    equipment: [cam1, cam2, deck],
    cables: [
      kabel('c1', 'cam1', 'cam1-out', 'rec1', 'rec1-in1'),
      kabel('c2', 'cam2', 'cam2-out', 'rec1', 'rec1-in2'),
    ],
    sourceIdentities: [rolle('r1', namen[0], 1), rolle('r2', namen[1], 2)],
  }
}

const arten = (p: ReturnType<typeof recordNamePlan>) => p.findings.map((f) => f.kind)

describe('der Name kommt aus dem Plan, nicht von der Konfigurationsseite des Decks', () => {
  const plan = recordNamePlan(aufbau(), { ...DEFAULT_RECORD_SCHEME, take: 3 })

  it('bildet <show>_<take>_<sourcename>, wie die Massnahme es nennt', () => {
    expect(plan.rows.map((r) => r.name)).toEqual(['Herbstgala_03_Kamera 1', 'Herbstgala_03_Kamera 2'])
  })

  it('nennt Recorder und Eingang aus dem Kabelgraphen', () => {
    expect(plan.rows[0].recorder).toBe('HyperDeck A')
    expect(plan.rows[0].channel).toBe(1)
    expect(plan.rows[1].channel).toBe(2)
  })

  it('zählt die Take-Nummer EINMAL für das Projekt', () => {
    // Das Hochzählen an sechzehn Konfigurationsseiten ist der Schaden aus dem
    // Beleg. Eine Nummer je Deck baute ihn nach.
    const namen = plan.rows.map((r) => r.name.split('_')[1])
    expect(new Set(namen).size).toBe(1)
  })

  it('nimmt eine andere Take-Nummer ohne weiteres Zutun in alle Namen', () => {
    const vier = recordNamePlan(aufbau(), { ...DEFAULT_RECORD_SCHEME, take: 4 })
    expect(vier.rows.every((r) => r.name.includes('_04_'))).toBe(true)
  })
})

describe('was still schiefginge, wird benannt', () => {
  it('meldet zwei Aufzeichnungen unter demselben Namen', () => {
    // Der Fehler, nach dem niemand sucht: zwei Decks schreiben dieselbe
    // Datei, und welche Karte am Ende in der Post liegt, entscheidet die
    // Reihenfolge des Einlesens.
    const p = recordNamePlan(aufbau(['Kamera 1', 'Kamera 1']), {
      ...DEFAULT_RECORD_SCHEME,
      take: 1,
    })
    expect(arten(p).filter((k) => k === 'duplicate-name')).toHaveLength(2)
    expect(p.findings.find((f) => f.kind === 'duplicate-name')?.detail).toContain('Kamera 1')
  })

  it('meldet ein Zeichen, das ein Datenträger ablehnt', () => {
    const p = recordNamePlan(aufbau(['Kamera/1', 'Kamera 2']), {
      ...DEFAULT_RECORD_SCHEME,
      take: 1,
    })
    expect(arten(p)).toContain('illegal-character')
    expect(p.findings.find((f) => f.kind === 'illegal-character')?.detail).toBe('/')
  })

  it('meldet ein Leerzeichen genauso — es überlebt nicht jede Kette', () => {
    // „Kamera 1" traegt eins. Das ist kein Formfehler, sondern der Grund,
    // warum ein Deck den zusammengesetzten Namen ablehnen kann.
    const p = recordNamePlan(aufbau(), { ...DEFAULT_RECORD_SCHEME, take: 1 })
    expect(arten(p)).toContain('illegal-character')
  })

  it('meldet einen Namen über der Längengrenze', () => {
    const lang = 'K'.repeat(MAX_NAME_LENGTH + 10)
    const p = recordNamePlan(aufbau([lang, 'Kamera2']), { ...DEFAULT_RECORD_SCHEME, take: 1 })
    expect(arten(p)).toContain('too-long')
  })

  it('meldet eine Take-Nummer, die das Schema verlangt und das Projekt nicht hat', () => {
    const p = recordNamePlan(aufbau(), DEFAULT_RECORD_SCHEME)
    expect(arten(p)).toContain('take-missing')
    // Und trägt KEINE Null ein: eine erfundene Null stünde auf jeder Karte.
    expect(p.rows[0].name).not.toContain('_00_')
  })

  it('meldet eine Rolle, die keinen Recorder erreicht', () => {
    const ohne = aufbau()
    const p = recordNamePlan({ ...ohne, cables: [ohne.cables[0]] }, {
      ...DEFAULT_RECORD_SCHEME,
      take: 1,
    })
    expect(arten(p)).toContain('no-recorder')
    expect(p.rows.find((r) => r.roleName === 'Kamera 2')?.recorder).toBeUndefined()
  })

  it('meldet eine Rolle ohne Namen — und setzt keinen Platzhalter ein', () => {
    // Ein „unknown" im Dateinamen sieht aus wie ein Name und wird nie
    // nachgetragen. Die Lücke fällt auf, der Platzhalter nicht.
    const p = recordNamePlan(aufbau(['', 'Kamera 2']), { ...DEFAULT_RECORD_SCHEME, take: 1 })
    expect(arten(p)).toContain('source-unnamed')
    expect(p.rows[0].name.toLowerCase()).not.toContain('unknown')
    expect(p.rows[0].name).toBe('Herbstgala_01')
  })

  it('hat für jeden Befund einen deutschen Satz', () => {
    for (const f of Object.values(RECORD_NAME_FINDING_LABEL)) expect(f.length).toBeGreaterThan(10)
  })
})

describe('kein Segment erfindet etwas', () => {
  const schema = (segments: RecordNamingScheme['segments']): RecordNamingScheme => ({
    segments,
    separator: '_',
    take: 1,
  })

  it('lässt eine fehlende Rollennummer aus, statt eine Null zu setzen', () => {
    const ohneNummer = {
      ...aufbau(),
      sourceIdentities: [rolle('r1', 'Kamera 1'), rolle('r2', 'Kamera 2')],
    }
    const p = recordNamePlan(ohneNummer, schema([{ part: 'source' }, { part: 'sourceNumber', pad: 2 }]))
    expect(p.rows[0].name).toBe('Kamera 1')
  })

  it('lässt den Recorder aus, wenn die Rolle keinen erreicht', () => {
    const ohne = aufbau()
    const p = recordNamePlan(
      { ...ohne, cables: [ohne.cables[0]] },
      schema([{ part: 'source' }, { part: 'recorder' }]),
    )
    expect(p.rows.find((r) => r.roleName === 'Kamera 2')?.name).toBe('Kamera 2')
  })

  it('meldet eine Zeile, für die aus dem Schema gar kein Name entsteht', () => {
    const p = recordNamePlan(aufbau(), schema([{ part: 'literal', literal: '' }]))
    expect(arten(p)).toContain('empty-name')
  })

  it('füllt Take und Kanal auf die verlangte Stellenzahl', () => {
    const p = recordNamePlan(aufbau(), schema([{ part: 'take', pad: 3 }, { part: 'channel', pad: 2 }]))
    expect(p.rows[0].name).toBe('001_01')
  })
})

describe('der Zettel fürs Deck', () => {
  it('führt je Aufzeichnung eine Zeile mit Name, Recorder und Befund', () => {
    const t = recordNameSheet(recordNamePlan(aufbau(), { ...DEFAULT_RECORD_SCHEME, take: 2 }))
    expect(t[0]).toEqual(['Rolle', 'Recorder', 'Kanal', 'Dateiname', 'Befund'])
    expect(t[1][0]).toBe('Kamera 1')
    expect(t[1][1]).toBe('HyperDeck A')
    expect(t[1][3]).toBe('Herbstgala_02_Kamera 1')
  })

  it('sagt im Klartext, wenn kein Recorder im Plan steht', () => {
    const ohne = aufbau()
    const t = recordNameSheet(
      recordNamePlan({ ...ohne, cables: [ohne.cables[0]] }, { ...DEFAULT_RECORD_SCHEME, take: 1 }),
    )
    expect(t.some((z) => z[1] === 'kein Recorder im Plan')).toBe(true)
  })
})
