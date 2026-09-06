import { describe, expect, it } from 'vitest'
import {
  CLIENT_SUMMARY_FINDING_LABEL,
  NOT_REPORTED,
  SUMMARY_BASIS_LABEL,
  clientSummary,
  clientSummaryTable,
  share,
} from '../src/renderer/lib/clientSummary'
import { UNJUDGEABLE_DOCUMENTS, DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import type { CablePlannerProject, ProjectRevision } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import type { Cable } from '../src/renderer/types/cable'
import libQuelle from '../src/renderer/lib/clientSummary.ts?raw'
import dialogQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Die Kunden-Übersicht (Bedarf 81, zweite Haelfte).
//
//   > reports lack „helpful graphics or added calculations like Percentage
//   > breakdowns"
//
// Drei Regeln, und zwei davon sind der ganze Unterschied zu einem CSV-Dump:
// jeder Anteil nennt seinen Nenner, jede Zeile nennt ihre Grundlage, und
// „niemand hat gemeldet" ist nicht „nichts gebaut".
// ---------------------------------------------------------------------------

const eq = (id: string, kat: string): EquipmentItem =>
  ({ id, name: id, x: 0, y: 0, width: 10, height: 10, category: kat, inputs: [], outputs: [] }) as never

const cable = (id: string, typ: string, len = 10, over: Partial<Cable> = {}): Cable =>
  ({
    id,
    name: id,
    type: typ,
    length: len,
    fromDeviceId: 'A',
    toDeviceId: 'B',
    fromPortId: 'a',
    toPortId: 'b',
    notes: '',
    ...over,
  }) as never

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: [],
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
    ...over,
  }) as CablePlannerProject

const revision = (snapshot: Partial<CablePlannerProject>): ProjectRevision =>
  ({
    id: 'r1',
    label: 'As-Built',
    createdAt: '2026-09-12T10:00+02:00',
    asBuilt: true,
    snapshot: {
      metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
      equipment: [],
      cables: [],
      canvasState: { x: 0, y: 0, zoom: 1 },
      ...snapshot,
    },
  }) as unknown as ProjectRevision

const zeile = (p: CablePlannerProject, kennzahl: string) =>
  clientSummary(p).rows.find((r) => r.kennzahl === kennzahl)

describe('share — der Nenner steht immer dabei', () => {
  it('nennt Teil, Ganzes und Prozent', () => {
    expect(share(3, 12)).toBe('3 von 12 (25 %)')
  })

  it('rechnet bei leerem Nenner KEINEN Prozentsatz', () => {
    // 0 von 0 ist keine Null, sondern keine Aussage.
    expect(share(0, 0)).toBe('keine Grundlage')
  })

  it('gibt nie einen nackten Prozentsatz aus', () => {
    // Genau die Sorte Zahl, die in einer Kundenbesprechung zu einer
    // Diskussion fuehrt, die niemand gewinnen kann.
    expect(share(1, 4)).toMatch(/von/)
  })
})

describe('clientSummary — jede Zeile nennt ihre Grundlage', () => {
  it('nennt Planzahlen „aus dem Plan", solange kein As-Built vorliegt', () => {
    const p = projekt({ equipment: [eq('a', 'Video')] })
    expect(zeile(p, 'Geräte gesamt')?.basis).toBe('plan')
    expect(clientSummary(p).findings.map((f) => f.kind)).toContain('no-as-built')
  })

  it('nennt sie „aus dem As-Built", wenn eine gueltige Festschreibung vorliegt', () => {
    const base = projekt({ equipment: [eq('a', 'Video')] })
    const p = { ...base, revisions: [revision({ equipment: [eq('a', 'Video')] })] } as CablePlannerProject
    expect(zeile(p, 'Geräte gesamt')?.basis).toBe('as-built')
  })

  it('zaehlt ein VERALTETES As-Built als Plan, nicht als Bauzustand', () => {
    // Ein veraltetes As-Built als Bauzustand auszugeben waere genau die
    // Behauptung, gegen die Bedarf 84 geschrieben ist.
    const p = projekt({
      equipment: [eq('a', 'Video'), eq('b', 'Audio')],
      revisions: [revision({ equipment: [eq('a', 'Video')] })],
    })
    expect(clientSummary(p).basis).toBe('drifted')
    expect(zeile(p, 'Geräte gesamt')?.basis).toBe('plan')
  })

  it('schluesselt Geraete nach Kategorie mit Anteil auf', () => {
    const p = projekt({ equipment: [eq('a', 'Video'), eq('b', 'Video'), eq('c', 'Audio')] })
    expect(zeile(p, 'Video')?.anteil).toBe('2 von 3 (67 %)')
    expect(zeile(p, 'Audio')?.anteil).toBe('1 von 3 (33 %)')
  })

  it('nennt geschaetzte Kabellaengen als solche', () => {
    // Ein Kunde liest eine Meterzahl auf einem Blatt als gemessen.
    const p = projekt({
      cables: [cable('c1', 'sdi'), cable('c2', 'sdi', 10, { lengthDerivedFrom: 'canvas' } as never)],
    })
    expect(zeile(p, 'davon Länge geschätzt')?.anteil).toBe('1 von 2 (50 %)')
  })
})

describe('„nicht gemeldet" ist nicht „0 %"', () => {
  it('sagt beim Aufbau „nicht gemeldet", wenn nichts zurueckkam', () => {
    const p = projekt({ cables: [cable('c1', 'sdi')] })
    expect(zeile(p, 'Gesteckte Kabel')?.wert).toBe(NOT_REPORTED)
    expect(zeile(p, 'Gesteckte Kabel')?.anteil).toBe(NOT_REPORTED)
    expect(zeile(p, 'Gesteckte Kabel')?.basis).toBe('unreported')
    expect(clientSummary(p).findings.map((f) => f.kind)).toContain('progress-unreported')
  })

  it('rechnet, sobald etwas gemeldet ist', () => {
    const p = projekt({
      cables: [cable('c1', 'sdi'), cable('c2', 'sdi')],
      checkState: { ports: {}, cables: { c1: true } },
    })
    expect(zeile(p, 'Gesteckte Kabel')?.wert).toBe('1')
    expect(zeile(p, 'Gesteckte Kabel')?.anteil).toBe('1 von 2 (50 %)')
    expect(zeile(p, 'Gesteckte Kabel')?.basis).toBe('reported')
    expect(clientSummary(p).findings.map((f) => f.kind)).not.toContain('progress-unreported')
  })

  it('behandelt einen leeren Check-Block wie „nichts gemeldet"', () => {
    // Ein Block, den irgendwer einmal angelegt hat, ist keine Meldung.
    const p = projekt({ cables: [cable('c1', 'sdi')], checkState: { ports: {}, cables: {} } })
    expect(zeile(p, 'Gesteckte Kabel')?.wert).toBe(NOT_REPORTED)
  })

  it('behandelt abgehakt-dann-abgewaehlt wie „nichts gemeldet"', () => {
    const p = projekt({
      cables: [cable('c1', 'sdi')],
      checkState: { ports: {}, cables: { c1: false } },
    })
    expect(zeile(p, 'Gesteckte Kabel')?.wert).toBe(NOT_REPORTED)
  })

  it('meldet einen leeren Plan als solchen', () => {
    expect(clientSummary(projekt()).findings.map((f) => f.kind)).toContain('empty-plan')
  })

  it('gibt jeder Befundart eine Beschriftung', () => {
    for (const k of Object.keys(CLIENT_SUMMARY_FINDING_LABEL)) {
      expect(CLIENT_SUMMARY_FINDING_LABEL[k as never]).toBeTruthy()
    }
  })
})

describe('das Blatt', () => {
  it('traegt die Grundlage als eigene Spalte', () => {
    const t = clientSummaryTable(projekt({ equipment: [eq('a', 'Video')] }))
    expect(t.headers).toEqual(['Bereich', 'Kennzahl', 'Wert', 'Anteil', 'Grundlage'])
    expect(t.rows[0].map(String)).toContain(SUMMARY_BASIS_LABEL.plan)
  })

  it('haelt die Reihenfolge stabil — sonst springt das Blatt zwischen Exporten', () => {
    const p = projekt({ equipment: [eq('a', 'Audio'), eq('b', 'Video'), eq('c', 'Video')] })
    const einmal = clientSummaryTable(p).rows.map((r) => String(r[1]))
    const nochmal = clientSummaryTable(p).rows.map((r) => String(r[1]))
    expect(einmal).toEqual(nochmal)
    // Groesste Gruppe zuerst, bei Gleichstand alphabetisch.
    expect(einmal.indexOf('Video')).toBeLessThan(einmal.indexOf('Audio'))
  })

  it('zeichnet keine Grafik aus Zeichen', () => {
    // Der Bedarf nennt „bar and pie graphs" — ein CSV traegt keine, und ein
    // erfundenes Balkendiagramm aus Rautezeichen waere schlechter als die
    // Zahl daneben.
    const t = clientSummaryTable(projekt({ equipment: [eq('a', 'Video')] }))
    expect(JSON.stringify(t)).not.toMatch(/[#█▇▆▅]{3}/)
  })

  it('traegt kanonisches Deutsch', () => {
    expect(libQuelle).not.toContain("t('")
  })

  it('ist ausdruecklich als NICHT beurteilbar registriert, mit Grund', () => {
    // Die Spalte „Grundlage" macht das Blatt von der Revisionsliste abhaengig.
    // Sie wegzulassen, um einen Stand zu bekommen, hiesse jede Planzahl wie
    // einen Leistungsnachweis aussehen zu lassen.
    expect(DOCUMENT_STANDS['kunden-uebersicht']).toBeUndefined()
    expect(UNJUDGEABLE_DOCUMENTS['kunden-uebersicht']).toMatch(/Grundlage|Revisionsliste/)
    expect(DOCUMENT_LABELS['kunden-uebersicht']).toBeTruthy()
  })
})

describe('die Oberflaeche', () => {
  it('zeigt Anteil und Grundlage als eigene Spalten', () => {
    expect(dialogQuelle).toContain('SUMMARY_BASIS_LABEL[r.basis]')
    expect(dialogQuelle).toMatch(/\{r\.anteil\}/)
  })

  it('zeigt jeden Befund mit seiner Beschriftung', () => {
    expect(dialogQuelle).toMatch(
      /summary\.findings\.length > 0 &&[\s\S]*CLIENT_SUMMARY_FINDING_LABEL\[f\.kind\][\s\S]*f\.text/,
    )
  })
})
