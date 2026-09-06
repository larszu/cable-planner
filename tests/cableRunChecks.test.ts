import { describe, expect, it } from 'vitest'
import {
  BUNDLED_SERVICES,
  MOVE_TOLERANCE_PX,
  bundledServices,
  cableRunFindings,
  cableRunTable,
  runFindingText,
} from '../src/renderer/lib/cableRunChecks'
import { estimateAllCableLengths, DEFAULT_LENGTH_ESTIMATION } from '../src/renderer/lib/cableLengthEstimate'
import { cableCatalog } from '../src/renderer/types/cableSpec'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import quelle from '../src/renderer/lib/cableRunChecks.ts?raw'
import sliceQuelle from '../src/renderer/store/slices/cableSlice.ts?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'
import analyseQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'
import { stripComments } from './support/stripComments'

// ---------------------------------------------------------------------------
// Bedarf 13 -- die Kabellaenge als abgeleitete Groesse.
//
//   > Run lengths are assumed, drums are picked by hand, and a moved position
//   > SILENTLY invalidates the cable call; one wrong SMPTE run kills video,
//   > return, comms, tally and power at once.
//
// Der teuerste Fehler waere, jede Abweichung zwischen einer von Hand
// eingetragenen Laenge und der Luftlinie zu melden: ein echter Kabelweg wird
// verlegt und nicht gespannt. Der groesste Teil dieser Tests haelt fest, was
// NICHT gemeldet wird.
// ---------------------------------------------------------------------------

const eq = (id: string, x: number, y: number): EquipmentItem =>
  ({ id, name: id, category: 'Sonstiges', x, y, width: 200, height: 100, inputs: [], outputs: [] }) as unknown as EquipmentItem

const cable = (over: Partial<Cable> = {}): Cable =>
  ({
    id: 'c1',
    name: 'CAM 1 → CCU',
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

const smpteSpec = cableCatalog.find((s) => s.id === 'smpte-304m-lemo')!
const sdiSpec = cableCatalog.find((s) => s.standards.includes('SDI-3G') && !s.standards.includes('SMPTE-304M'))!

describe('was NICHT gemeldet wird', () => {
  it('eine von Hand eingetragene Laenge, die nicht zur Luftlinie passt', () => {
    // Der Normalfall. Ein echter Kabelweg laeuft an der Wand entlang und durch
    // die Kabelrinne; ihn gegen die Luftlinie zu halten meldete auf jedem
    // gepflegten Plan jede Zeile.
    const c = cable({ length: 240 })
    expect(cableRunFindings([c], [eq('A', 0, 0), eq('B', 300, 0)])).toEqual([])
  })

  it('eine abgeleitete Laenge, deren Geraete stehen geblieben sind', () => {
    const geraete = [eq('A', 0, 0), eq('B', 500, 0)]
    const { updates, origins } = estimateAllCableLengths([cable()], geraete, DEFAULT_LENGTH_ESTIMATION)
    const c = cable({ length: updates.get('c1')!, lengthDerivedFrom: origins.get('c1') })
    expect(cableRunFindings([c], geraete)).toEqual([])
  })

  it('einen Versatz unterhalb der Toleranz', () => {
    // Darunter liegt die Genauigkeit, mit der jemand ein Geraet auf dem Canvas
    // platziert -- ein nachgezogener Knoten ist kein Befund.
    const geraete = [eq('A', 0, 0), eq('B', 500, 0)]
    const { updates, origins } = estimateAllCableLengths([cable()], geraete, DEFAULT_LENGTH_ESTIMATION)
    const c = cable({ length: updates.get('c1')!, lengthDerivedFrom: origins.get('c1') })
    const kaum = [eq('A', MOVE_TOLERANCE_PX - 1, 0), eq('B', 500, 0)]
    expect(cableRunFindings([c], kaum)).toEqual([])
  })

  it('ein Funk-Kabel', () => {
    expect(cableRunFindings([cable({ wireless: true, length: 99999 })], [])).toEqual([])
  })

  it('eine Laenge innerhalb der Reichweite', () => {
    const c = cable({ cableSpecId: sdiSpec.id, length: 1 })
    expect(cableRunFindings([c], [eq('A', 0, 0), eq('B', 10, 0)])).toEqual([])
  })
})

describe('das stille Veralten', () => {
  const geraete = [eq('A', 0, 0), eq('B', 500, 0)]
  const abgeleitet = (): Cable => {
    const { updates, origins } = estimateAllCableLengths([cable()], geraete, DEFAULT_LENGTH_ESTIMATION)
    return cable({ length: updates.get('c1')!, lengthDerivedFrom: origins.get('c1') })
  }

  it('meldet den Versatz mit alter und neuer Schaetzung', () => {
    const verschoben = [eq('A', 0, 0), eq('B', 1500, 0)]
    const [f] = cableRunFindings([abgeleitet()], verschoben)
    expect(f.kind).toBe('derived-length-stale')
    expect(Number(f.values[1])).toBeGreaterThan(Number(f.values[0]))
    expect(Number(f.values[2])).toBe(1000)
  })

  it('rechnet die neue Schaetzung mit dem Massstab von DAMALS', () => {
    // Sonst vermischte die Meldung zwei Aenderungen -- ein Verschieben und
    // eine geaenderte Skala -- und benennte keine von beiden.
    const c = abgeleitet()
    const verschoben = [eq('A', 0, 0), eq('B', 1500, 0)]
    const [f] = cableRunFindings([c], verschoben)
    const erwartet = Math.ceil((1500 / 100) * c.lengthDerivedFrom!.metersPer100px * (1 + c.lengthDerivedFrom!.slackPercent / 100))
    expect(Number(f.values[1])).toBe(erwartet)
  })

  it('meldet ein fehlendes Endgeraet als eigenen Fall', () => {
    const [f] = cableRunFindings([abgeleitet()], [eq('A', 0, 0)])
    expect(f.kind).toBe('endpoint-missing')
  })
})

describe('ein Strang, fuenf Dienste', () => {
  it('nennt sie bei einem Hybrid-Kamerakabel', () => {
    // Der Befund woertlich: „one wrong SMPTE run kills video, return, comms,
    // tally and power at once."
    expect(bundledServices(smpteSpec)).toEqual(['Bild', 'Rueckbild', 'Intercom', 'Tally', 'Strom'])
    expect(bundledServices(smpteSpec)!.length).toBe(5)
  })

  it('nennt KEINE bei einem Kabel, das genau einen Dienst traegt', () => {
    // Eine Liste an jedem Kabel machte aus dem Befund eine Floskel.
    expect(bundledServices(sdiSpec)).toBeNull()
    expect(bundledServices(undefined)).toBeNull()
  })

  it('haengt die Dienste an den Befund, nicht nur an den Katalog', () => {
    const c = cable({ cableSpecId: smpteSpec.id, length: smpteSpec.maxLengthMeters! + 1 })
    const [f] = cableRunFindings([c], [eq('A', 0, 0), eq('B', 10, 0)])
    expect(f.services).toHaveLength(5)
    expect(runFindingText(f)).toContain('5 Dienste')
    expect(runFindingText(f)).toContain('Tally')
  })

  it('fuehrt nur belegte Buendel', () => {
    // Nur SMPTE 304M/311M -- dafuer nennt die Recherche die fuenf Dienste.
    // Wer hier etwas ergaenzt, braucht dieselbe Art Beleg.
    expect(Object.keys(BUNDLED_SERVICES).sort()).toEqual(['SMPTE-304M', 'SMPTE-311M'])
  })
})

describe('die Reichweite', () => {
  it('meldet eine Laenge ueber der Katalog-Grenze', () => {
    const c = cable({ cableSpecId: sdiSpec.id, length: sdiSpec.maxLengthMeters! + 1 })
    const [f] = cableRunFindings([c], [eq('A', 0, 0), eq('B', 10, 0)])
    expect(f.kind).toBe('over-max-length')
    expect(f.source).toBeTruthy()
  })

  it('gilt fuer gemessene Laengen genauso wie fuer geschaetzte', () => {
    // Die Grenze ist eine Eigenschaft des KABELS und nicht der Herkunft der
    // Zahl. Sie nur auf Schaetzungen anzuwenden liesse den gefaehrlicheren
    // Fall durch: die von Hand eingetragene, zu lange Strecke.
    const c = cable({ cableSpecId: sdiSpec.id, length: sdiSpec.maxLengthMeters! + 1 })
    expect(c.lengthDerivedFrom).toBeUndefined()
    expect(cableRunFindings([c], [eq('A', 0, 0), eq('B', 10, 0)])).toHaveLength(1)
  })
})

describe('das Blatt', () => {
  it('fuehrt Befund, Beschreibung und die Dienste', () => {
    const c = cable({ cableSpecId: smpteSpec.id, length: smpteSpec.maxLengthMeters! + 1 })
    const t = cableRunTable([c], [eq('A', 0, 0), eq('B', 10, 0)])
    expect(t.headers).toEqual(['Kabel', 'Befund', 'Beschreibung', 'Dienste auf dem Strang'])
    expect(String(t.rows[0][3])).toContain('Tally')
  })

  it('sortiert stabil', () => {
    const a = cable({ id: 'x', name: 'Zebra', cableSpecId: sdiSpec.id, length: 9999 })
    const b = cable({ id: 'y', name: 'Anton', cableSpecId: sdiSpec.id, length: 9999 })
    const geraete = [eq('A', 0, 0), eq('B', 10, 0)]
    expect(cableRunTable([a, b], geraete).rows.map((r) => r[0])).toEqual(['Anton', 'Zebra'])
    expect(cableRunTable([b, a], geraete).rows.map((r) => r[0])).toEqual(['Anton', 'Zebra'])
  })
})

describe('die Herkunft wird gefuehrt', () => {
  it('die Schaetzung schreibt sie mit', () => {
    const { origins } = estimateAllCableLengths([cable()], [eq('A', 0, 0), eq('B', 500, 0)], DEFAULT_LENGTH_ESTIMATION)
    const o = origins.get('c1')!
    // Der URSPRUNG der Geraete, nicht der Mittelpunkt: nur er ueberlebt die
    // Raster-Heilung beim Laden unveraendert.
    expect(o).toEqual({ fromX: 0, fromY: 0, toX: 500, toY: 0, metersPer100px: 1, slackPercent: 15 })
  })

  it('der Store haengt sie an das Kabel', () => {
    expect(sliceQuelle).toMatch(/lengthDerivedFrom: origins\.get\(c\.id\)/)
  })

  it('eine von HAND gesetzte Laenge loescht sie', () => {
    // Ohne diese Regel bliebe eine berichtigte Laenge als „ueberholte
    // Schaetzung" stehen, und der Befund waere unbeirrbar: man koennte ihn
    // nicht abstellen, indem man die Zahl korrigiert.
    expect(sliceQuelle).toMatch(/patch\.length !== undefined && patch\.lengthDerivedFrom === undefined/)
    expect(sliceQuelle).toMatch(/delete \(merged as \{ lengthDerivedFrom\?: unknown \}\)\.lengthDerivedFrom/)
  })

  it('die Raster-Heilung fasst sie mit an', () => {
    // Ohne diese Zeilen meldete ein Projekt, das nur GELADEN wurde, seine
    // Schaetzungen als ueberholt: das Raster hat die Geraete verschoben, die
    // gespeicherte Herkunft nicht.
    expect(storeQuelle).toMatch(/if \(patched\.lengthDerivedFrom\)/)
    expect(storeQuelle).toMatch(/fromX: r\(o\.fromX\)/)
  })
})

describe('was die Datei NICHT tut', () => {
  it('holt sich weder Zeit noch Store', () => {
    expect(quelle).not.toMatch(/new Date\(\)|Date\.now\(\)|useProjectStore|useUiStore/)
  })
})

// ---------------------------------------------------------------------------
// ERREICHBARKEIT. Ein Befund, den kein Reiter zeigt, bleibt genauso still wie
// das Veralten, das er meldet.
// ---------------------------------------------------------------------------
describe('Erreichbarkeit in der Analyse', () => {
  it('hat einen eigenen Reiter', () => {
    expect(analyseQuelle).toContain("id: 'runs'")
    expect(analyseQuelle).toContain('<RunsTab projectName={projectName} />')
    expect(analyseQuelle).toMatch(/cableRunFindings\(cables, equipment\)/)
  })

  it('gibt die Befunde als Blatt aus', () => {
    expect(analyseQuelle).toMatch(/csvFromTable\(cableRunTable\(cables, equipment\)\)/)
  })

  it('setzt die Befundtexte NICHT dynamisch zusammen', () => {
    // `stripComments`, weil der Kommentar daneben die verbotene Form ZITIERT,
    // um zu erklaeren, warum sie nicht benutzt wird. Genau dieser Fehler ist
    // in dieser Sitzung schon dreimal passiert.
    expect(stripComments(analyseQuelle)).not.toMatch(/t\(`analysis\.runs\./)
    for (const key of [
      'analysis.runs.stale',
      'analysis.runs.overMax',
      'analysis.runs.endpointMissing',
      'analysis.runs.bundled',
    ]) {
      expect(analyseQuelle).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })

  it('sagt ausdruecklich, wenn es nichts zu melden gibt', () => {
    // Ein leerer Reiter beantwortet die Frage „habe ich das schon geprueft?"
    // nicht. Ein Satz tut es.
    expect(analyseQuelle).toContain("'analysis.runs.none'")
  })
})
