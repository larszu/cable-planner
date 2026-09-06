import { describe, expect, it } from 'vitest'
import { changeImpact, changeImpactSummary } from '../src/renderer/lib/changeImpact'
import {
  DOCUMENT_STANDS,
  DOCUMENT_LABELS,
  UNJUDGEABLE_DOCUMENTS,
} from '../src/renderer/lib/documentRegistry'
import registrySrc from '../src/renderer/lib/documentRegistry.ts?raw'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// Roadmap-Initiative 5, Inkrement 1 — „was macht diese Änderung ungültig?"
//
// Bis hierhin konnte man nur die RÜCKWÄRTS-Frage stellen: mit dem Blatt in der
// Hand, per Stempel, „gilt dieser Ausdruck noch?" (`docStandStatus`). Die
// VORWÄRTS-Frage konnte niemand stellen — „ich habe gerade das geändert,
// welche Blätter sind damit hin?" —, und genau die ist der Schmerzpunkt: der
// Rehearsal-Day-Edit, nach dem niemand weiss, welche der zwölf ausgedruckten
// Listen noch stimmen.
//
// Dieses Inkrement persistiert nichts: reine Funktion über zwei Projekt-Stände.
// Dieselbe Reihenfolge wie in ADR-001, wo genau diese Wahl zwei Fehler gefunden
// hat, die kein Diff-Review gefunden hätte.

const eq = (id: string, name: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({
    id,
    name,
    category: 'Sonstiges',
    inputs: [{ id: `${id}-in`, name: 'IN 1', type: 'port', connectorType: 'BNC' }],
    outputs: [{ id: `${id}-out`, name: 'OUT 1', type: 'port', connectorType: 'BNC' }],
    x: 0, y: 0, width: 200, height: 100,
    ...over,
  }) as unknown as EquipmentItem

const cable = (id: string, over: Partial<Cable> = {}): Cable =>
  ({
    id, name: `Kabel ${id}`, type: 'SDI', length: 10, color: '#fff',
    fromEquipmentId: 'A', fromPortId: 'A-out',
    toEquipmentId: 'B', toPortId: 'B-in', notes: '',
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

const verdictOf = (impact: ReturnType<typeof changeImpact>, docId: string) =>
  impact.documents.find((d) => d.docId === docId)?.verdict

describe('changeImpact — die Vorwärts-Frage', () => {
  it('nennt keine Auswirkung, wenn sich nichts geändert hat', () => {
    const p = project()
    const impact = changeImpact(p, p)
    expect(impact.invalidated).toBe(0)
    expect(impact.planChanged).toBe(false)
    // „Keine Auswirkung" heisst NICHT „alles unberührt": die Kabel-Stückliste
    // bleibt unbeurteilbar, und die Zusammenfassung sagt das auch. Eine
    // Freigabe, die das verschweigt, waere die schlechtere Antwort.
    expect(impact.documents.filter((d) => d.verdict === 'unaffected').length).toBe(
      Object.keys(DOCUMENT_STANDS).length,
    )
    expect(impact.unknown).toBe(Object.keys(UNJUDGEABLE_DOCUMENTS).length)
    expect(changeImpactSummary(impact)).toBe('1 nicht beurteilbar')
  })

  it('erkennt, dass ein geänderter Kabel-Typ die Pull-Liste überholt', () => {
    const before = project()
    const after = project({ cables: [cable('c1', { type: 'Cat6' })] })
    const impact = changeImpact(before, after)
    expect(verdictOf(impact, 'pull-liste')).toBe('invalidated')
    expect(impact.planChanged).toBe(true)
    expect(impact.invalidated).toBeGreaterThan(0)
  })

  it('gibt für jedes betroffene Dokument beide Stände an', () => {
    // Ohne die zwei Fingerabdrücke ist die Meldung nicht nachprüfbar — und der
    // Nutzer soll den Stand auf dem Blatt wiedererkennen können.
    const impact = changeImpact(project(), project({ cables: [cable('c1', { length: 42 })] }))
    const hit = impact.documents.find((d) => d.verdict === 'invalidated')!
    expect(hit.before).toMatch(/^[0-9a-f]{8}$/)
    expect(hit.after).toMatch(/^[0-9a-f]{8}$/)
    expect(hit.before).not.toBe(hit.after)
  })

  it('trifft nicht alle Dokumente pauschal', () => {
    // Der Punkt der Ableitung: eine Änderung an einem Kabel berührt die
    // Kabel-Listen und nicht zwangsläufig das Asset-Register. Eine Heuristik
    // über angefasste Felder könnte das nicht unterscheiden.
    const impact = changeImpact(project(), project({ cables: [cable('c1', { length: 42 })] }))
    expect(verdictOf(impact, 'asset-register')).toBe('unaffected')
  })

  it('sortiert das zu Erledigende nach oben', () => {
    const impact = changeImpact(project(), project({ cables: [cable('c1', { type: 'Cat6' })] }))
    const order = impact.documents.map((d) => d.verdict)
    const firstUnaffected = order.indexOf('unaffected')
    const lastInvalidated = order.lastIndexOf('invalidated')
    if (firstUnaffected >= 0 && lastInvalidated >= 0) {
      expect(lastInvalidated).toBeLessThan(firstUnaffected)
    }
    // Bei gleichem Urteil stabil nach Bezeichner — sonst springt die Liste.
    const invalidated = impact.documents.filter((d) => d.verdict === 'invalidated').map((d) => d.docId)
    expect(invalidated).toEqual([...invalidated].sort())
  })

  it('nennt eine Ableitung, die scheitert, „unknown" statt „unberührt"', () => {
    // Ein Projekt ohne `equipment` bringt die Tabellen-Ableitungen zum
    // Stolpern. Das Ergebnis muss „weiss ich nicht" sein — als „unberührt"
    // gefuehrt wuerde es wie eine Freigabe aussehen.
    const broken = { metadata: { name: 'x' } } as unknown as CablePlannerProject
    const impact = changeImpact(broken, broken)
    expect(impact.documents.filter((d) => d.verdict === 'unknown').length).toBeGreaterThan(1)
    // Ausgenommen sind die Ableitungen, die NICHT an `equipment` haengen und
    // deshalb auch auf diesem Torso ein gueltiges (leeres) Ergebnis liefern.
    // `plan` war das von Anfang an; `ausspielung` (Initiative 9) kam dazu, weil
    // ihr Inhalt allein aus `deliveryDestinations` folgt, und `ablaufblatt`
    // (Bedarf 33) aus demselben Grund -- es ist dieselbe Datenquelle in einer
    // anderen Spaltenform. Sie hier zu erzwingen hiesse, ein ehrliches „leer"
    // in ein „weiss ich nicht" zu faelschen -- und genau das wirft dieser Test
    // dem Gegenteil vor.
    //
    // Die Liste ist bewusst benannt und nicht „alles, was durchkommt": waechst
    // sie um einen Bezeichner, der doch an `equipment` haengt, faellt das beim
    // Eintragen auf statt still.
    const ohneGeraetebezug = new Set(['plan', 'ausspielung', 'ablaufblatt'])
    expect(
      impact.documents.some((d) => d.verdict === 'unaffected' && !ohneGeraetebezug.has(d.docId)),
    ).toBe(false)
    // Zwei verschiedene Gruende fuer dasselbe Urteil — die Meldung darf sie
    // nicht vermischen.
    const reasons = new Set(
      impact.documents.filter((d) => d.verdict === 'unknown').map((d) => d.reason),
    )
    expect(reasons.size).toBe(2)
  })

  it('die Zusammenfassung verschweigt das Unbeurteilbare nicht', () => {
    const broken = { metadata: { name: 'x' } } as unknown as CablePlannerProject
    expect(changeImpactSummary(changeImpact(broken, broken))).toContain('nicht beurteilbar')
  })
})

describe('der Guard: das Register ist die einzige Liste', () => {
  it('beurteilt genau die registrierten Dokumente — beide Listen, nicht mehr', () => {
    const impact = changeImpact(project(), project())
    expect(impact.documents.map((d) => d.docId).sort()).toEqual(
      [...Object.keys(DOCUMENT_STANDS), ...Object.keys(UNJUDGEABLE_DOCUMENTS)].sort(),
    )
  })

  it('kein Dokument steht in beiden Listen', () => {
    // Beides gleichzeitig waere ein Widerspruch: reproduzierbar UND nicht
    // beurteilbar. Der Vorrang liegt bei DOCUMENT_STANDS, aber der
    // Widerspruch soll auffallen statt still aufgelöst zu werden.
    const both = Object.keys(UNJUDGEABLE_DOCUMENTS).filter((id) => id in DOCUMENT_STANDS)
    expect(both).toEqual([])
  })

  it('jedes beurteilte Dokument hat einen lesbaren Namen', () => {
    for (const d of changeImpact(project(), project()).documents) {
      expect(d.label, `Label fehlt fuer ${d.docId}`).toBeTruthy()
      expect(d.label).toBe(DOCUMENT_LABELS[d.docId])
    }
  })

  it('kabel-bom wird als „nicht beurteilbar" GENANNT, nicht weggelassen', () => {
    // Vorher stand diese Kenntnis nur im Kommentar über DOCUMENT_STANDS. Ein
    // Kommentar kann eine Freigabe-Liste nicht warnen: sie hätte kabel-bom
    // einfach nicht genannt, und Verschweigen sieht aus wie „unberührt".
    expect(Object.keys(DOCUMENT_STANDS)).not.toContain('kabel-bom')
    const bom = changeImpact(project(), project()).documents.find((d) => d.docId === 'kabel-bom')
    expect(bom).toBeDefined()
    expect(bom!.verdict).toBe('unknown')
    expect(bom!.reason).toMatch(/Reserve-Aufschlag/)
    expect(bom!.label).toBe('Kabel-Stückliste')
  })

  // Der Revisions-Vergleich im PlanCompareDialog spannt einen `RevisionSnapshot`
  // mit `revisions: []` zu einem Projekt auf — der Snapshot fuehrt das Feld per
  // Typ nicht. Das ist nur so lange harmlos, wie keine Dokument-Ableitung die
  // Revisionsliste liest. Heute liest keine sie; `buildHandoverManifest` tut es
  // (As-Built-Zeilen), steht aber bewusst nicht in DOCUMENT_STANDS.
  //
  // Ohne diesen Test waere das eine stille Annahme: wer eine revisions-
  // abhaengige Ableitung eintraegt, brauchte nichts davon zu wissen, und jeder
  // Revisions-Vergleich meldete danach ein Blatt als ueberholt, das sich nur
  // deshalb unterscheidet, weil die Liste leer ist. Eine erfundene Abweichung
  // ist derselbe Schaden wie ein erfundener Zustand (ADR-003).
  it('keine Dokument-Ableitung haengt an der Revisionsliste', () => {
    const withRevisions = project({
      revisions: [
        {
          id: 'r1',
          label: 'Rev 1',
          note: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          asBuilt: true,
          snapshot: project(),
        },
      ],
    } as Partial<CablePlannerProject>)
    const ohne = { ...withRevisions, revisions: [] } as CablePlannerProject
    for (const [docId, derive] of Object.entries(DOCUMENT_STANDS)) {
      expect(derive(ohne), `${docId} haengt an project.revisions`).toBe(derive(withRevisions))
    }
  })

  it('ein Revisions-Snapshot meldet gegen sich selbst nichts als ueberholt', () => {
    // Die Probe auf dieselbe Annahme, aber von der Nutzerseite: derselbe Stand,
    // einmal als Projekt und einmal als aufgespannter Snapshot.
    const base = project()
    const alsSnapshot = { ...base, revisions: [] } as CablePlannerProject
    const mitRevisionen = {
      ...base,
      revisions: [
        {
          id: 'r1',
          label: 'Rev 1',
          note: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          asBuilt: false,
          snapshot: base,
        },
      ],
    } as unknown as CablePlannerProject
    expect(changeImpact(alsSnapshot, mitRevisionen).invalidated).toBe(0)
  })

  it('der Grund steht als Daten da, nicht nur als Prosa', () => {
    expect(registrySrc).toContain('UNJUDGEABLE_DOCUMENTS')
    for (const [id, reason] of Object.entries(UNJUDGEABLE_DOCUMENTS)) {
      expect(reason, `Grund fehlt fuer ${id}`).toBeTruthy()
      expect(DOCUMENT_LABELS[id], `Label fehlt fuer ${id}`).toBeTruthy()
    }
  })
})
