import { describe, expect, it, beforeEach } from 'vitest'
import {
  JOB_BASIS_LABEL,
  JOB_FINDING_LABEL,
  assessJobHandover,
  jobHandoverTable,
  latestAsBuilt,
} from '../src/renderer/lib/jobHandover'
import {
  DOCUMENT_STANDS,
  UNJUDGEABLE_DOCUMENTS,
} from '../src/renderer/lib/documentRegistry'
import { saveUserTemplate } from '../src/renderer/lib/projectTemplates'
import type { CablePlannerProject, ProjectRevision } from '../src/renderer/types/project'
import docsQuelle from '../src/renderer/components/Export/InstallationDocsDialog.tsx?raw'
import tplDialogQuelle from '../src/renderer/components/Project/TemplatesDialog.tsx?raw'
import tplQuelle from '../src/renderer/lib/projectTemplates.ts?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Woraus naechstes Jahr geplant wird (Bedarf 84, P2).
//
//   > Show files on USB sticks, photos in WhatsApp, marked-up plans in a skip.
//   > Next year the same event is re-planned from the QUOTE, not from what was
//   > actually built, and every on-site fix is rediscovered.
//
// Die Datei gab es schon — die `.avplan` ist verlustfrei (ADR-005). Was
// fehlte, ist der Satz, den der Bedarf woertlich sagt: sie traegt den
// ANGEBOTSSTAND und sieht aus wie der Bauzustand.
// ---------------------------------------------------------------------------

const geraet = (id: string, name: string, over: Record<string, unknown> = {}) =>
  ({ id, name, x: 0, y: 0, inputs: [], outputs: [], ...over }) as never

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', siteAddress: 'Halle A' },
    equipment: [],
    cables: [],
    locations: [],
    ...over,
  }) as never

const revision = (
  label: string,
  asBuilt: boolean,
  snapshot: CablePlannerProject,
  createdAt = '2026-01-01T00:00:00.000Z',
): ProjectRevision =>
  ({ id: `rev-${label}`, label, note: '', createdAt, asBuilt, snapshot }) as never

// ---------------------------------------------------------------------------
describe('die drei Zustaende', () => {
  it('meldet ohne As-Built „wie geplant" — der Fall aus dem Bedarf', () => {
    const a = assessJobHandover(projekt())
    expect(a.basis).toBe('as-quoted')
    expect(a.asBuilt).toBeUndefined()
    expect(a.findings.some((f) => f.kind === 'no-as-built')).toBe(true)
  })

  it('NENNT DIE FOLGE: jede Aenderung vor Ort wird ein zweites Mal gefunden', () => {
    const f = assessJobHandover(projekt()).findings.find((x) => x.kind === 'no-as-built')!
    expect(f.text).toMatch(/Angebot/)
    expect(f.text).toMatch(/zweites Mal/)
  })

  it('meldet ein unveraendertes As-Built als „wie gebaut"', () => {
    const stand = projekt({ equipment: [geraet('e1', 'Kamera 1')] })
    const p = { ...stand, revisions: [revision('As-Built', true, stand)] } as CablePlannerProject
    const a = assessJobHandover(p)
    expect(a.basis).toBe('as-built')
    expect(a.changedSince).toBe(0)
    expect(a.findings.some((f) => f.kind === 'as-built-stale')).toBe(false)
  })

  it('MELDET EIN UEBERHOLTES As-Built — der teuerste Zustand', () => {
    // Das Blatt traegt das Wort „As-Built" und stimmt nicht mehr. Teurer als
    // gar keines, weil niemand nachfragt.
    const stand = projekt({ equipment: [geraet('e1', 'Kamera 1')] })
    const p = {
      ...stand,
      equipment: [geraet('e1', 'Kamera 1'), geraet('e2', 'Kamera 2')],
      revisions: [revision('As-Built', true, stand)],
    } as CablePlannerProject
    const a = assessJobHandover(p)
    expect(a.basis).toBe('drifted')
    expect(a.changedSince).toBeGreaterThan(0)
    const f = a.findings.find((x) => x.kind === 'as-built-stale')!
    expect(f.text).toContain('As-Built')
    expect(f.text).toMatch(/niemand nachfragt/)
  })

  it('nimmt NUR substantielle Aenderungen — eine verschobene Position ist kein Bauzustand', () => {
    // „Substantiell" kommt aus `planDiff` (ADR-005, Design-Frage 2). Zwei
    // Vorstellungen davon, was zaehlt, waeren hier besonders teuer.
    const stand = projekt({ equipment: [geraet('e1', 'Kamera 1', { x: 0, y: 0 })] })
    const p = {
      ...stand,
      equipment: [geraet('e1', 'Kamera 1', { x: 500, y: 300 })],
      revisions: [revision('As-Built', true, stand)],
    } as CablePlannerProject
    expect(assessJobHandover(p).basis).toBe('as-built')
  })

  it('ignoriert eine Revision, die KEIN As-Built ist', () => {
    const stand = projekt()
    const p = { ...stand, revisions: [revision('Rev A', false, stand)] } as CablePlannerProject
    expect(assessJobHandover(p).basis).toBe('as-quoted')
  })

  it('nimmt die JUENGSTE As-Built-Revision', () => {
    const alt = projekt({ equipment: [geraet('e1', 'A')] })
    const neu = projekt({ equipment: [geraet('e1', 'A'), geraet('e2', 'B')] })
    const p = {
      ...neu,
      revisions: [
        revision('Alt', true, alt, '2026-01-01T00:00:00.000Z'),
        revision('Neu', true, neu, '2026-06-01T00:00:00.000Z'),
      ],
    } as CablePlannerProject
    expect(latestAsBuilt(p)?.label).toBe('Neu')
    // Gegen die juengste gemessen ist nichts offen.
    expect(assessJobHandover(p).basis).toBe('as-built')
  })

  it('meldet ein Projekt mit As-Built nicht allein wegen der Revisionsliste als ueberholt', () => {
    // Der Snapshot fuehrt `revisions` per Typ nicht; das Projekt schon. Waere
    // dieser Unterschied ein Bauzustand, meldete JEDES Projekt mit As-Built
    // sofort „ueberholt".
    //
    // Diese Zusicherung haelt heute auch ohne die Normalisierung in
    // `assessJobHandover`, weil `planDiff.substantive` die `sections` gar
    // nicht mitzaehlt (Gegenprobe `drift-includes-revisions` blieb gruen).
    // Der Test steht trotzdem hier: er sichert das ERGEBNIS, nicht den Weg.
    const stand = projekt({ equipment: [geraet('e1', 'Kamera 1')] })
    const p = { ...stand, revisions: [revision('As-Built', true, stand)] } as CablePlannerProject
    expect(assessJobHandover(p).changedSince).toBe(0)
  })

  it('haelt die Etiketten kanonisch deutsch', () => {
    expect(JOB_BASIS_LABEL['as-quoted']).toBe('Wie geplant (kein As-Built)')
    expect(JOB_FINDING_LABEL['as-built-stale']).toBe('Das As-Built ist überholt')
  })
})

// ---------------------------------------------------------------------------
describe('was sonst naechstes Jahr fehlt', () => {
  it('meldet offene Fragen ans Haus — die werden ein zweites Mal gestellt', () => {
    const p = projekt({
      metadata: {
        name: 'x',
        siteAddress: 'Halle A',
        venueAnswers: [
          { key: 'ports', status: 'pending' },
          { key: 'vlan', status: 'granted' },
        ],
      },
    } as never)
    const f = assessJobHandover(p).findings.find((x) => x.kind === 'open-questions')!
    expect(f).toBeDefined()
    expect(f.text).toContain('1 Frage')
    expect(f.text).toMatch(/zweites Mal/)
  })

  it('zaehlt eine beantwortete Frage NICHT als offen', () => {
    const p = projekt({
      metadata: { name: 'x', siteAddress: 'H', venueAnswers: [{ key: 'a', status: 'refused' }] },
    } as never)
    expect(assessJobHandover(p).findings.some((f) => f.kind === 'open-questions')).toBe(false)
  })

  it('meldet offene Anmerkungen — gebaut, verworfen oder vergessen ist unklar', () => {
    const p = projekt({
      annotations: [
        { id: 'a1', author: 'x', createdAt: 'y', text: 'Kabel umlegen', status: 'open', anchor: { type: 'free', x: 0, y: 0 } },
        { id: 'a2', author: 'x', createdAt: 'y', text: 'ok', status: 'built', anchor: { type: 'free', x: 0, y: 0 } },
      ],
    } as never)
    const f = assessJobHandover(p).findings.find((x) => x.kind === 'unbuilt-notes')!
    expect(f).toBeDefined()
    expect(f.text).toContain('1 Anmerkung')
  })

  it('meldet einen fehlenden Ort und verweist auf die Haus-Antworten', () => {
    const p = projekt({ metadata: { name: 'x' } } as never)
    const f = assessJobHandover(p).findings.find((x) => x.kind === 'no-venue')!
    expect(f).toBeDefined()
    expect(f.text).toMatch(/85|91/)
  })

  it('meldet einen vorhandenen Ort nicht', () => {
    expect(assessJobHandover(projekt()).findings.some((f) => f.kind === 'no-venue')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
describe('das Blatt', () => {
  it('nennt Grundlage, As-Built und die Zahl der Aenderungen', () => {
    const stand = projekt({ equipment: [geraet('e1', 'A')] })
    const p = {
      ...stand,
      equipment: [geraet('e1', 'A'), geraet('e2', 'B')],
      revisions: [revision('As-Built', true, stand)],
    } as CablePlannerProject
    const t = jobHandoverTable(p)
    expect(t.headers).toEqual(['Grundlage', 'As-Built', 'Änderungen seither', 'Befund'])
    expect(t.rows[0][0]).toBe('As-Built veraltet')
    expect(String(t.rows[0][1])).toContain('As-Built')
    expect(Number(t.rows[0][2])).toBeGreaterThan(0)
  })

  it('schreibt „keins" statt einer leeren Zelle', () => {
    expect(jobHandoverTable(projekt()).rows[0][1]).toBe('keins')
  })
})

// ---------------------------------------------------------------------------
describe('das Register: NICHT reproduzierbar, und das steht da', () => {
  it('steht in UNJUDGEABLE_DOCUMENTS und NICHT in DOCUMENT_STANDS', () => {
    // Der erste Wurf trug es in DOCUMENT_STANDS, und der Guard „keine
    // Dokument-Ableitung haengt an der Revisionsliste" hat es gefangen: der
    // Revisions-Vergleich spannt Snapshots ohne diese Liste auf, und ein
    // revisions-abhaengiger Stand meldete danach JEDES Blatt als ueberholt.
    expect(DOCUMENT_STANDS['job-grundlage']).toBeUndefined()
    expect(UNJUDGEABLE_DOCUMENTS['job-grundlage']).toBeDefined()
  })

  it('nennt den Grund und nicht nur die Tatsache', () => {
    expect(UNJUDGEABLE_DOCUMENTS['job-grundlage']).toMatch(/Revisionsliste/)
    expect(UNJUDGEABLE_DOCUMENTS['job-grundlage']).toMatch(/als überholt/)
  })
})

// ---------------------------------------------------------------------------
describe('die Vorlage friert die Grundlage EIN', () => {
  beforeEach(() => localStorage.clear())

  it('schreibt „wie geplant" an eine Vorlage ohne As-Built', () => {
    const tpl = saveUserTemplate('Zweikamera', '', projekt(), 'neutral')
    expect(tpl.basis).toBe('as-quoted')
  })

  it('schreibt „wie gebaut", wenn eines vorliegt', () => {
    const stand = projekt({ equipment: [geraet('e1', 'A')] })
    const p = { ...stand, revisions: [revision('As-Built', true, stand)] } as CablePlannerProject
    expect(saveUserTemplate('Halle A', '', p, 'venue').basis).toBe('as-built')
  })

  it('LIEST AUS DEM QUELL-PROJEKT, nicht aus der gestrippten Kopie', () => {
    // Die Kopie hat die Revisionen verloren (Geschichte einer anderen Show).
    // Aus ihr gelesen waere JEDE Vorlage „wie geplant" — die Auskunft waere
    // immer dieselbe und damit keine.
    const stand = projekt({ equipment: [geraet('e1', 'A')] })
    const p = { ...stand, revisions: [revision('As-Built', true, stand)] } as CablePlannerProject
    const tpl = saveUserTemplate('X', '', p, 'venue')
    expect(tpl.basis).toBe('as-built')
    expect(tpl.project.revisions).toBeUndefined()
    expect(tplQuelle).toContain('const basis = assessJobHandover(project).basis')
  })

  it('friert ein: das Quell-Projekt zieht weiter, die Vorlage nicht', () => {
    const stand = projekt({ equipment: [geraet('e1', 'A')] })
    const p = { ...stand, revisions: [revision('As-Built', true, stand)] } as CablePlannerProject
    const tpl = saveUserTemplate('X', '', p, 'venue')
    // Das Projekt zieht weiter — die gespeicherte Vorlage bleibt, was sie war.
    p.equipment = [geraet('e1', 'A'), geraet('e2', 'B')]
    expect(assessJobHandover(p).basis).toBe('drifted')
    expect(tpl.basis).toBe('as-built')
  })
})

// ---------------------------------------------------------------------------
describe('Erreichbarkeit', () => {
  it('steht GANZ OBEN im Uebergabe-Dialog, vor allem anderen', () => {
    // Wer die Uebergabe baut, muss wissen, ob sie den Bauzustand traegt.
    //
    // Als REIHENFOLGE gepruefet, nicht als Nachbarschaft: eine Regex mit
    // Abstandsfenster blieb gruen, als der Abschnitt nur verschoben wurde
    // (Gegenprobe `ui-docs-section-moved`). Positionen vergleichen faengt das.
    expect(docsQuelle).toContain('assessJobHandover(project)')
    const grundlage = docsQuelle.indexOf("t('docs.job.title'")
    const bearbeiter = docsQuelle.indexOf('{/* Bearbeiter-Identität */}')
    const exporte = docsQuelle.indexOf('{/* Listen / Exporte */}')
    expect(grundlage).toBeGreaterThan(-1)
    expect(bearbeiter).toBeGreaterThan(-1)
    expect(exporte).toBeGreaterThan(-1)
    expect(grundlage).toBeLessThan(bearbeiter)
    expect(grundlage).toBeLessThan(exporte)
  })

  it('faerbt den Kasten, wenn die Grundlage NICHT der Bauzustand ist', () => {
    expect(docsQuelle).toMatch(/job\.basis === 'as-built'\n\s*\? 'border-cp-border/)
  })

  it('zeigt die Befunde und nicht nur das Etikett', () => {
    expect(docsQuelle).toMatch(
      /\{job\.findings\.length > 0 && \([\s\S]{0,600}JOB_FINDING_LABEL\[f\.kind\]/,
    )
  })

  it('zeigt die Grundlage auf der Vorlagen-Karte', () => {
    expect(tplDialogQuelle).toMatch(/\{tpl\.basis && \(/)
    expect(tplDialogQuelle).toContain("t('templates.basis'")
    expect(tplDialogQuelle).toContain('JOB_BASIS_LABEL[tpl.basis]')
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of ['docs.job.title', 'docs.job.intro', 'templates.basis']) {
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
