import { describe, expect, it } from 'vitest'
import {
  diagnoseSumme,
  diagnoseZeilen,
  juengsteChecks,
  patternDiagnose,
} from '../src/renderer/lib/patternDiagnose'
import {
  PATTERN_OBSERVATION_LABEL,
  PATTERN_OBSERVATIONS,
  normalisePatternChecks,
} from '../src/renderer/types/patternCheck'
import type { PatternCheck } from '../src/renderer/types/patternCheck'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import checkRowSrc from '../src/renderer/components/Canvas/PatternCheckRow.tsx?raw'
import nodeSrc from '../src/renderer/components/Canvas/EquipmentNode.tsx?raw'
import metaSliceSrc from '../src/renderer/store/slices/metaSlice.ts?raw'
import projectStoreSrc from '../src/renderer/store/projectStore.ts?raw'

// ───────────────────────────────────────────────────────────────────────────
// Aus einer Sichtpruefung einen Befund machen (B-42, Inkrement 2).
//
// DIE PRUEFUNG, an der sich der Nutzen entscheidet, ist die VERTAUSCHUNG.
// „Falsches Bild" ist ein Symptom. „Es steht KAMERA 3 drauf, und drueben
// steht KAMERA 1" ist die Ursache — zwei Ausgaenge sind getauscht. Genau
// diese Verdichtung macht das Verfahren brauchbar; ohne sie bleibt eine
// Liste von „stimmt nicht", die beim Umpatchen unter Zeitdruck niemand
// gegeneinanderhaelt.
//
// Was hier NICHT geprueft wird, weil es die App nicht kann: ob wirklich ein
// Bild ankam. Sie hat keinen Videoeingang; das IST kommt von einem Menschen.
// ───────────────────────────────────────────────────────────────────────────

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

const check = (over: Partial<PatternCheck> & Pick<PatternCheck, 'quelleId' | 'equipmentId' | 'gesehen'>): PatternCheck => ({
  at: '2026-09-08T10:00:00.000Z',
  ...over,
})

/**
 * Zwei Kameras, eine Kreuzschiene, zwei Monitore.
 * Geplant: Kamera 1 -> Monitor Regie, Kamera 2 -> Monitor Buehne.
 */
const anlage = (checks: PatternCheck[] = []): CablePlannerProject =>
  ({
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    // BEWUSST NICHT nach Id sortiert. Mit einer sortierten Liste waere ein
    // Umsortieren an Ort und Stelle nicht messbar, und die Gegenprobe „die
    // Diagnose fasst das Projekt an" kaeme gruen zurueck — dieselbe Falle
    // wie bei der Import-Vorschau in light#98.
    equipment: [
      eq('mon2', { name: 'Monitor Buehne', inputs: [port('m2in')] }),
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('cam2', { name: 'Kamera 2', outputs: [port('c2out')] }),
      eq('hub', {
        name: 'Smart Videohub 12x12',
        inputs: [port('hin0'), port('hin1')],
        outputs: [port('hout0'), port('hout1')],
        videohubRouting: { planned: { 0: 0, 1: 1 }, salvos: [] },
      }),
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
    ],
    cables: [
      kabel('k1', ['cam1', 'c1out'], ['hub', 'hin0']),
      kabel('k2', ['cam2', 'c2out'], ['hub', 'hin1']),
      kabel('k3', ['hub', 'hout0'], ['mon1', 'm1in']),
      kabel('k4', ['hub', 'hout1'], ['mon2', 'm2in']),
    ],
    canvasState: { x: 0, y: 0, zoom: 1 },
    patternChecks: checks,
  }) as unknown as CablePlannerProject

describe('Ohne Pruefung wird nichts behauptet', () => {
  it('ein ungeprueftes Ziel steht als ungeprueft in der Liste', () => {
    // MIT DRIN und nicht weggelassen: eine Liste, die nur die geprueften
    // zeigt, sieht nach abgeschlossener Abnahme aus, sobald jemand drei von
    // zwoelf Monitoren angesehen hat.
    const b = patternDiagnose(anlage(), 'cam1')
    expect(b).toHaveLength(1)
    expect(b[0].art).toBe('noch-offen')
    expect(b[0].text).toContain('Noch nicht geprüft')
  })

  it('ohne Quelle gibt es keine Liste', () => {
    expect(patternDiagnose(anlage(), undefined)).toEqual([])
  })
})

describe('DIE VERTAUSCHUNG — der Fall, wegen dem es das Verfahren gibt', () => {
  const vertauscht = () =>
    anlage([
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'falsches-bild', gesehenerName: 'Kamera 2' }),
      check({ quelleId: 'cam2', equipmentId: 'mon2', gesehen: 'falsches-bild', gesehenerName: 'Kamera 1' }),
    ])

  it('wird als Vertauschung erkannt und benennt den Gegenort', () => {
    const b = patternDiagnose(vertauscht(), 'cam1')
    expect(b[0].art).toBe('vertauscht')
    expect(b[0].vertauschtMit?.equipmentName).toBe('Monitor Buehne')
    expect(b[0].text).toContain('Vertauscht mit Monitor Buehne')
  })

  it('und von der anderen Seite genauso', () => {
    const b = patternDiagnose(vertauscht(), 'cam2')
    expect(b[0].art).toBe('vertauscht')
    expect(b[0].vertauschtMit?.equipmentName).toBe('Monitor Regie')
  })

  it('OHNE GEGENSTUECK ist es keine Vertauschung, sondern ein fremdes Bild', () => {
    // Der Unterschied ist wichtig: „vertauscht" sagt, was zu tun ist (die
    // beiden tauschen). „Fremdes Bild" sagt nur, dass hier etwas anderes
    // steht — der Gegenort ist noch ungeprueft, oder es ist gar kein Tausch.
    const p = anlage([
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'falsches-bild', gesehenerName: 'Kamera 2' }),
    ])
    const b = patternDiagnose(p, 'cam1')
    expect(b[0].art).toBe('fremdes-bild')
    expect(b[0].vertauschtMit).toBeUndefined()
    expect(b[0].text).toContain('Hier steht Kamera 2')
  })
})

describe('Der gesehene Name wird nicht zurechtgeraten', () => {
  it('Gross-/Kleinschreibung und Randleerzeichen zaehlen nicht', () => {
    const p = anlage([
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'falsches-bild', gesehenerName: '  kamera 2 ' }),
      check({ quelleId: 'cam2', equipmentId: 'mon2', gesehen: 'falsches-bild', gesehenerName: 'KAMERA 1' }),
    ])
    expect(patternDiagnose(p, 'cam1')[0].art).toBe('vertauscht')
  })

  it('ein Name, den der Plan nicht kennt, bleibt ein fremdes Bild', () => {
    // Kein unscharfer Vergleich. Wer hier „enthaelt" oder Levenshtein
    // rechnete, machte aus einer Beobachtung eine Vermutung — und die stuende
    // dann als Befund da.
    const p = anlage([
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'falsches-bild', gesehenerName: 'Kamera 27' }),
    ])
    const b = patternDiagnose(p, 'cam1')
    expect(b[0].art).toBe('fremdes-bild')
    expect(b[0].text).toContain('Kamera 27')
  })

  it('ein doppelt vergebener Name loest nicht auf', () => {
    // Zwei Geraete duerfen denselben Namen tragen (Haupt und Backup). Dann
    // ist nicht feststellbar, welches gemeint war — und geraten wird nicht.
    const p = anlage([
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'falsches-bild', gesehenerName: 'Kamera 2' }),
      check({ quelleId: 'cam2', equipmentId: 'mon2', gesehen: 'falsches-bild', gesehenerName: 'Kamera 1' }),
    ])
    p.equipment.push(eq('cam2b', { name: 'Kamera 2', outputs: [port('c2bout')] }))
    expect(patternDiagnose(p, 'cam1')[0].art).toBe('fremdes-bild')
  })
})

describe('Die uebrigen Beobachtungen', () => {
  it('stimmt', () => {
    const b = patternDiagnose(anlage([check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'stimmt' })]), 'cam1')
    expect(b[0].art).toBe('stimmt')
    expect(b[0].text).toContain('Kamera 1 steht an')
  })

  it('kein Bild', () => {
    const b = patternDiagnose(anlage([check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'kein-bild' })]), 'cam1')
    expect(b[0].art).toBe('kein-bild')
  })

  it('KEIN MONITOR ist ein Befund ueber den PLAN, nicht ueber das Signal', () => {
    // Wer das als „kein Bild" meldete, schickte jemanden auf die Suche nach
    // einem Kabelfehler, den es nicht gibt.
    const b = patternDiagnose(anlage([check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'kein-monitor' })]), 'cam1')
    expect(b[0].art).toBe('kein-monitor')
    expect(b[0].text).toContain('kein Monitor')
  })
})

describe('Die juengste Pruefung gilt', () => {
  it('gestern ging es, heute nicht', () => {
    const p = anlage([
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'stimmt', at: '2026-09-07T10:00:00.000Z' }),
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'kein-bild', at: '2026-09-08T10:00:00.000Z' }),
    ])
    expect(patternDiagnose(p, 'cam1')[0].art).toBe('kein-bild')
  })

  it('und die aeltere bleibt im Projekt stehen', () => {
    // Die Liste IST die Historie. Wer sie ueberschreibt, loescht die
    // Auskunft, die den Fehler findet.
    const p = anlage([
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'kein-bild', at: '2026-09-08T10:00:00.000Z' }),
      check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'stimmt', at: '2026-09-07T10:00:00.000Z' }),
    ])
    expect(p.patternChecks).toHaveLength(2)
    expect(juengsteChecks(p.patternChecks!, 'cam1').get('mon1')?.gesehen).toBe('kein-bild')
  })

  it('Pruefungen einer ANDEREN Quelle zaehlen nicht mit', () => {
    const p = anlage([check({ quelleId: 'cam2', equipmentId: 'mon1', gesehen: 'stimmt' })])
    expect(patternDiagnose(p, 'cam1')[0].art).toBe('noch-offen')
  })
})

describe('Die Zusammenfassung', () => {
  it('zaehlt jede Art einzeln', () => {
    const b = patternDiagnose(
      anlage([check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'kein-bild' })]),
      'cam1',
    )
    expect(diagnoseSumme(b)).toEqual({
      stimmt: 0,
      vertauscht: 0,
      fremd: 0,
      keinBild: 1,
      keinMonitor: 0,
      ungeprueft: 0,
    })
  })

  it('das Blatt fuehrt Befund, gesehenen Namen und Zeitpunkt', () => {
    const b = patternDiagnose(
      anlage([
        check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'falsches-bild', gesehenerName: 'Kamera 2' }),
      ]),
      'cam1',
    )
    const [zeile] = diagnoseZeilen(b)
    expect(zeile.geraet).toBe('Monitor Regie')
    expect(zeile.gesehen).toBe('Kamera 2')
    expect(zeile.zeitpunkt).toBe('2026-09-08T10:00:00.000Z')
    expect(zeile.befund).toContain('Kamera 2')
  })

  it('eine ungeprueft gebliebene Zeile traegt keinen Zeitpunkt', () => {
    const [zeile] = diagnoseZeilen(patternDiagnose(anlage(), 'cam1'))
    expect(zeile.zeitpunkt).toBe('')
  })
})

describe('Die Beobachtungs-Tabelle ist vollstaendig', () => {
  it('jede Beobachtung hat eine Beschriftung', () => {
    expect(PATTERN_OBSERVATIONS.length).toBe(Object.keys(PATTERN_OBSERVATION_LABEL).length)
    for (const o of PATTERN_OBSERVATIONS) expect(PATTERN_OBSERVATION_LABEL[o]).toBeTruthy()
  })
})

describe('Die Diagnose fasst das Projekt nicht an', () => {
  it('rechnet ohne Nebenwirkung', () => {
    const p = anlage([check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'stimmt' })])
    const kopie = JSON.parse(JSON.stringify(p)) as CablePlannerProject
    patternDiagnose(p, 'cam1')
    expect(p).toEqual(kopie)
  })
})


/** Kommentarzeilen weg: ein Waechter, der Prosa liest, ist von einem Satz zu haben. */
const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

describe('Der Weg ist verdrahtet', () => {
  const row = ohneKommentare(checkRowSrc)

  it('die Rueckmeldung haengt am Ankunftsort', () => {
    expect(ohneKommentare(nodeSrc)).toMatch(/<PatternCheckRow equipmentId=\{id\} \/>/)
  })

  it('alle vier Beobachtungen sind erreichbar', () => {
    // „Kein Monitor" faellt am ehesten weg, weil es sich wie ein Sonderfall
    // anfuehlt — es ist aber der einzige Befund ueber den PLAN.
    for (const o of ['stimmt', 'falsches-bild', 'kein-bild', 'kein-monitor']) {
      expect(row, o).toContain(`'${o}'`)
    }
  })

  it('DER GESEHENE NAME WIRD ABGEFRAGT, nicht freigestellt', () => {
    // Ohne ihn bleibt die Meldung „irgendetwas stimmt nicht"; mit ihm wird
    // sie zur Vertauschungs-Diagnose. Deshalb fragt der Knopf danach.
    //
    // KEIN einziger Aufruf ohne Namen. Erster Anlauf pruefte nur, dass es
    // EINEN Aufruf mit Namen gibt — und war damit von einem der beiden
    // Aufrufsstellen zu haben, waehrend die andere (die Eingabetaste) den
    // Namen fallen liess. Die Gegenprobe kam gruen zurueck.
    expect(row).not.toMatch(/melde\('falsches-bild'\s*\)/)
    expect(row.match(/melde\('falsches-bild', name\.trim\(\)\)/g)?.length).toBe(2)
    expect(row).toMatch(/canvas\.pattern\.check\.seenPlaceholder'/)
  })

  it('kein window.prompt', () => {
    // Dieselbe Entscheidung wie bei E-15: eine Frage, die den Rest der App
    // anhaelt und deren Abbrechen mehrdeutig ist, gehoert hier nicht hin.
    expect(row).not.toMatch(/window\.(prompt|confirm)/)
  })

  it('der Zeitpunkt kommt vom Aufrufer, nicht aus dem Store', () => {
    // Sonst stempelte dieselbe Beobachtung bei jedem Aufruf anders.
    expect(row).toMatch(/at: new Date\(\)\.toISOString\(\)/)
    const slice = ohneKommentare(metaSliceSrc)
    const stelle = slice.slice(slice.indexOf('recordPatternCheck:'))
    expect(stelle.slice(0, 600)).not.toMatch(/new Date\(/)
  })

  it('die Pruefung wird ANGEHAENGT, nie ersetzt', () => {
    const slice = ohneKommentare(metaSliceSrc)
    expect(slice).toMatch(/patternChecks: \[check, \.\.\.\(state\.project\.patternChecks \?\? \[\]\)\]/)
  })

  it('die Heilung ist verdrahtet', () => {
    // Nur die VERDRAHTUNG steht hier; die Regel selbst ist unten am
    // Verhalten geprueft. Ein Quelltext-Scan beweist keine Erreichbarkeit —
    // ein eingeschleustes `return true` liesse die gescannte Zeile stehen.
    expect(ohneKommentare(projectStoreSrc)).toMatch(
      /normalisePatternChecks\(project\.patternChecks, geraeteIds,/,
    )
  })
})

describe('Beim Laden faellt, was ins Leere zeigt — und wird gemeldet', () => {
  const ids = new Set(['cam1', 'mon1'])
  const drops = () => {
    const raus: { reason: string; label: string }[] = []
    return { raus, on: (d: { reason: string; label: string }) => raus.push(d) }
  }

  it('behaelt, was auf vorhandene Geraete zeigt', () => {
    const d = drops()
    const rein = [check({ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'stimmt' })]
    expect(normalisePatternChecks(rein, ids, d.on)).toEqual(rein)
    expect(d.raus).toEqual([])
  })

  it('verwirft einen geloeschten ANKUNFTSORT und sagt warum', () => {
    // Er stuende sonst im Abnahme-Blatt als gepruefter Ankunftsort und
    // zeigte ins Leere.
    const d = drops()
    const rein = [check({ quelleId: 'cam1', equipmentId: 'weg', gesehen: 'stimmt' })]
    expect(normalisePatternChecks(rein, ids, d.on)).toEqual([])
    expect(d.raus).toEqual([{ reason: 'dangling-ref', label: '2026-09-08T10:00:00.000Z' }])
  })

  it('verwirft auch eine geloeschte QUELLE', () => {
    // Ohne sie ist nicht mehr feststellbar, welches Bild erwartet wurde —
    // die Zeile im Blatt waere eine Abnahme ohne Gegenstand.
    const d = drops()
    const rein = [check({ quelleId: 'weg', equipmentId: 'mon1', gesehen: 'stimmt' })]
    expect(normalisePatternChecks(rein, ids, d.on)).toEqual([])
    expect(d.raus[0].reason).toBe('dangling-ref')
  })

  it('nennt den gesehenen Namen als Griff, wo es einen gibt', () => {
    // „Welchen Datensatz habe ich verloren?" ist sonst nicht beantwortbar.
    const d = drops()
    normalisePatternChecks(
      [check({ quelleId: 'cam1', equipmentId: 'weg', gesehen: 'falsches-bild', gesehenerName: 'Kamera 9' })],
      ids,
      d.on,
    )
    expect(d.raus[0].label).toBe('Kamera 9')
  })

  it('verwirft, was gar keine Beobachtung traegt', () => {
    const d = drops()
    expect(normalisePatternChecks([{ at: '2026-09-08T10:00:00.000Z', quelleId: 'cam1', equipmentId: 'mon1' }], ids, d.on)).toEqual([])
    expect(d.raus[0].reason).toBe('missing-required')
  })

  it('verwirft, was keinen Zeitpunkt traegt', () => {
    // Eine Pruefung ohne Zeitpunkt ist keine: „gestern ging es, heute nicht"
    // laesst sich damit nicht mehr sagen.
    const d = drops()
    expect(normalisePatternChecks([{ quelleId: 'cam1', equipmentId: 'mon1', gesehen: 'stimmt' }], ids, d.on)).toEqual([])
    expect(d.raus[0].reason).toBe('missing-required')
  })

  it('eine fehlende Liste ist kein Fehler', () => {
    expect(normalisePatternChecks(undefined, ids)).toEqual([])
    expect(normalisePatternChecks(null, ids)).toEqual([])
  })
})
