// ───────────────────────────────────────────────────────────────────────────
// Der Stempel des Uebergabe-Dokuments deckt, was auf dem Blatt steht.
//
// WAS SCHIEFLIEF (gemessen 2026-09-04, Gegenrunde zu Runde 10). Der
// Fingerabdruck lief ueber Asset-Register und Kabel-Stueckliste; der Kommentar
// begruendete das damit, der Rest des Blattes aendere sich zwischen Revisionen
// nicht. Abschnitt 2 zaehlt aber `project.locations`, Abschnitt 3 liest
// `installStatus`, `testResult` und die As-Built-Revisionen — und keine dieser
// Groessen kam in einer der beiden Tabellen vor.
//
// Der Fehlgang, beide Enden ueber die Oberflaeche erreichbar: Uebergabe
// drucken, dann in den Kabel-Eigenschaften den Status setzen. Abschnitt 3 des
// ausgeteilten Blattes ist falsch, und der Stand bleibt gleich.
//
// Der alte Test wies die Drift nur ueber `cable('c1', { length: 25 })` nach —
// die Laenge steht in der Stueckliste und war deshalb die eine Groesse, die
// ohnehin schon zaehlte. Ein Fixture, das nur den gedeckten Fall trifft,
// prueft die Luecke nicht.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest'
import { stampForRows } from '../src/renderer/lib/documentStamp'
import { handoverTable } from '../src/renderer/lib/handoverPackage'
import type { CablePlannerProject, ProjectRevision } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

const NOW = new Date('2026-02-01T12:00:00.000Z')

const eq = (id: string, name: string): EquipmentItem =>
  ({
    id,
    name,
    category: 'Sonstiges',
    inputs: [{ id: `${id}-in`, name: 'IN 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: `${id}-out`, name: 'OUT 1', type: 'port', connectorType: 'BNC' }],
    x: 0,
    y: 0,
    width: 200,
    height: 100,
  }) as unknown as EquipmentItem

const cable = (id: string, over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: `Kabel ${id}`,
    type: 'SDI',
    length: 10,
    color: '#fff',
    fromEquipmentId: 'A',
    fromPortId: 'A-out',
    toEquipmentId: 'B',
    toPortId: 'B-in',
    notes: '',
    ...over,
  }) as Cable

const project = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Testanlage', description: '', createdAt: '', updatedAt: '' },
    equipment: [eq('A', 'Kamera 1'), eq('B', 'Switcher')],
    cables: [cable('c1')],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

const revision = (snapshotOf: CablePlannerProject): ProjectRevision => {
  const { revisions: _ignored, ...snapshot } = snapshotOf
  void _ignored
  return {
    id: 'r1',
    label: 'Rev 1',
    note: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    snapshot,
  } as ProjectRevision
}

/** Stand nach einer Aenderung gegenueber dem festgeschriebenen Ausgangsstand. */
const driftetNach = (aendern: (p: CablePlannerProject) => Partial<CablePlannerProject>) => {
  const basis = project()
  const rev = revision(basis)
  const geaendert = { ...basis, ...aendern(basis), revisions: [rev] } as CablePlannerProject
  return stampForRows(geaendert, handoverTable, NOW)?.drifted
}

describe('was auf dem Blatt steht, geht in den Fingerabdruck', () => {
  it('ohne Aenderung driftet nichts', () => {
    // Gegenprobe zum Rest: sonst waere jeder Test unten trivial gruen.
    const basis = project()
    const p = { ...basis, revisions: [revision(basis)] } as CablePlannerProject
    expect(stampForRows(p, handoverTable, NOW)?.drifted).toBe(false)
  })

  it('ein gesetzter Installations-Status driftet', () => {
    expect(driftetNach(() => ({ cables: [cable('c1', { installStatus: 'installed' })] }))).toBe(true)
  })

  it('ein eingetragenes Testergebnis driftet', () => {
    expect(
      driftetNach(() => ({
        cables: [
          cable('c1', {
            testResult: { result: 'pass', testedAt: '2026-01-15T00:00:00.000Z' },
          } as Partial<Cable>),
        ],
      })),
    ).toBe(true)
  })

  it('ein zusaetzlicher, LEERER Raum driftet', () => {
    // Weit weg von jedem Geraet — sonst ordnet `locationOf` das Geraet
    // geometrisch zu, die Asset-Zeile aendert sich dadurch ohnehin, und der
    // Test waere aus dem falschen Grund gruen. Genau diese Falle ist mir hier
    // beim ersten Anlauf aufgefallen: die Fassung mit x/y = 0 bestand auch
    // gegen den ALTEN Code.
    expect(
      driftetNach(() => ({
        locations: [{ id: 'l1', name: 'Lager', x: 5000, y: 5000, width: 100, height: 100 }],
      } as Partial<CablePlannerProject>)),
    ).toBe(true)
  })

  it('ein geaenderter Notfallkontakt driftet', () => {
    // Steht gedruckt in Abschnitt 1 und ist ueber die Projekt-Metadaten
    // aenderbar. „Aendert sich zwischen Revisionen nicht" war eine Annahme,
    // keine Eigenschaft.
    expect(
      driftetNach((p) => ({
        metadata: { ...p.metadata, emergencyContact: '0170 1234567' },
      })),
    ).toBe(true)
  })

  it('die Kabel-Reihenfolge driftet NICHT', () => {
    // Der Stand muss eine Funktion des Plans sein, nicht des
    // Bearbeitungsverlaufs — derselbe Fehler hat in dieser Runde die
    // Tally-Karte getroffen.
    const basis = project({ cables: [cable('c1'), cable('c2', { length: 20 })] })
    const rev = revision(basis)
    const gedreht = {
      ...basis,
      cables: [cable('c2', { length: 20 }), cable('c1')],
      revisions: [rev],
    } as CablePlannerProject
    expect(stampForRows(gedreht, handoverTable, NOW)?.drifted).toBe(false)
  })
})
