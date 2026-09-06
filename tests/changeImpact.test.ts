import { describe, expect, it } from 'vitest'
import { changeImpact, changeImpactSummary } from '../src/renderer/lib/changeImpact'
import {
  DOCUMENT_LABELS,
  DOCUMENT_STANDS,
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
    // Aus dem Register abgeleitet und nicht als Zahl getippt: die Liste der
    // unbeurteilbaren Dokumente WAECHST (Bedarf 26 hat vier dazugelegt), und
    // eine feste Zahl haette hier nur gesagt, dass jemand sie nachtippt.
    expect(changeImpactSummary(impact)).toBe(
      `${Object.keys(UNJUDGEABLE_DOCUMENTS).length} nicht beurteilbar`,
    )
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
    //
    // `ausspielweg` (Bedarf 32) steht hier mit einem ANDEREN Grund als die
    // beiden davor, und der ist wichtig genug, um ihn nicht zu verwischen: er
    // haengt sehr wohl an `equipment` — nur nicht, solange es kein einziges
    // Ausspielziel gibt. Dann ist das leere Blatt die wahre Antwort und kein
    // Ausweichen. Sobald ein Ziel existiert, ist er ohne Geraete unbeurteilbar;
    // genau das haelt der Test unter diesem hier fest, damit die Zeile nicht
    // als „haengt nie an Geraeten" missverstanden wird.
    //
    // `event-metadaten` (Bedarf 88) kam mit dem Grund der ersten beiden dazu:
    // Titel, Beginn und Sichtbarkeit stehen am Projekt, die Zeilen kommen aus
    // `deliveryDestinations`. Kein Geraet wird dafuer angefasst — auch nicht
    // mittelbar, denn anders als beim `ausspielweg` wird kein Encoder-Zeiger
    // aufgeloest.
    //
    // `sendebericht` (Bedarf 87) steht hier mit einer Einschraenkung, die
    // wichtig ist: die BEWERTUNG des Sendeberichts fasst sehr wohl Geraete an
    // (sie vergleicht gegen das As-Built), aber das BLATT tut es nicht — es
    // traegt nur die Eintraege und die Ziel-Namen. Der Stand haengt am Blatt,
    // also gehoert der Bezeichner hierher. Wer die Abweichungen einmal MIT auf
    // das Blatt nimmt, muss ihn wieder herausnehmen.
    const ohneGeraetebezug = new Set([
      'plan',
      'ausspielung',
      'ablaufblatt',
      'ausspielweg',
      'event-metadaten',
      'sendebericht',
      // `kosten-vergleich` (Bedarf 79) haengt zwar an `equipment` — der Anker
      // einer Position kann ein Geraet sein —, aber nur, wenn es Positionen
      // GIBT. Auf einem Torso ohne Kostenplan ist das leere Blatt die wahre
      // Antwort und kein Ausweichen; dieselbe Lage wie beim `ausspielweg`.
      'kosten-vergleich',
      // `umbenennungssatz` (Bedarf 74) haengt an `equipment` — aber nur, wenn
      // eine Namensregel im Projekt steht. Auf einem Torso ohne Regel ist der
      // leere Satz die wahre Antwort: es gibt nichts umzubenennen.
      'umbenennungssatz',
      // `tally-vorshow` (Bedarf 105) haengt ABSICHTLICH nicht an `equipment`:
      // die Lampe haengt am PLATZ, nicht am Blech. Die Zeile fuehrt die Rolle
      // („Kamera 1"), und die ueberlebt den Geraetetausch — das ist der Grund,
      // warum es Rollen ueberhaupt gibt (ADR-001). Ein Geraetewechsel aendert
      // die Tally-KARTE (Eingangsnummer) und nicht diese Liste; wer das
      // umdreht, muss den Bezeichner hier wieder herausnehmen.
      'tally-vorshow',
    ])
    expect(
      impact.documents.some((d) => d.verdict === 'unaffected' && !ohneGeraetebezug.has(d.docId)),
    ).toBe(false)
    // JEDER unbeurteilbare Grund steht fuer sich, und die gescheiterte
    // Ableitung ist noch einer dazu — die Meldung darf sie nicht vermischen.
    // Fruehe Fassung: `toBe(2)`, als es genau ein unbeurteilbares Dokument
    // gab. Das war dieselbe Aussage, nur nachgetippt; sie wird jetzt
    // gerechnet, damit ein neuer Eintrag im Register sie nicht falsch macht,
    // sondern mitnimmt.
    const reasons = new Set(
      impact.documents.filter((d) => d.verdict === 'unknown').map((d) => d.reason),
    )
    expect(reasons.size).toBe(Object.keys(UNJUDGEABLE_DOCUMENTS).length + 1)
  })

  it('der Ausspielweg ist ohne Geraete unbeurteilbar, SOBALD es ein Ziel gibt', () => {
    // Die Ausnahme oben gilt nur dem leeren Register. Ein Torso MIT Ziel darf
    // nicht „unberuehrt" melden: ohne Geraete und Kabel gibt es keinen Weg zu
    // pruefen, und „unberuehrt" laese sich als Freigabe lesen.
    const mitZiel = {
      metadata: { name: 'x' },
      deliveryDestinations: [
        { id: 'd1', name: 'YouTube', platform: 'custom', transport: 'RTMP', encoding: {} },
      ],
    } as unknown as CablePlannerProject
    const impact = changeImpact(mitZiel, mitZiel)
    const weg = impact.documents.find((d) => d.docId === 'ausspielweg')
    expect(weg?.verdict).toBe('unknown')
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

// ---------------------------------------------------------------------------
// Bedarf 26 -- die Blaetter, die bei einer spaeten Aenderung vergessen werden.
//
//   > One late change (e.g. a fifth camera 48h out) touches roughly 30
//   > artefacts ... The ones that get missed are OMISSIONS, not errors:
//   > multiviewer window, comms position, tally, truck plan, check-in list.
//   > Nothing links them.
//
// `changeImpact` gab es schon -- aber es kannte nur die Dokumente im Register,
// und die vom Bedarf genannten standen NICHT darin. Ein Blatt, das die Liste
// gar nicht nennt, ist in ihr nicht „unberuehrt", sondern unsichtbar; und
// genau das nennt der Bedarf: Auslassungen, keine Fehler.
// ---------------------------------------------------------------------------
describe('Bedarf 26 — die vergessenen Blaetter stehen jetzt in der Liste', () => {
  it('die Tally-Karte ist reproduzierbar und wird beurteilt', () => {
    // Sie leitet allein aus `equipment`, `cables` und `sourceIdentities` ab —
    // keine Nutzer-Einstellung, keine Sprache. Also gehoert sie nicht unter
    // „weiss ich nicht", sondern unter die beurteilbaren.
    expect(Object.keys(DOCUMENT_STANDS)).toContain('tally-karte')
    expect(DOCUMENT_LABELS['tally-karte']).toBeTruthy()
  })

  it('die Tally-Karte reagiert auf eine Aenderung am Plan', () => {
    // Der eigentliche Punkt: nicht dass sie im Register STEHT, sondern dass
    // ihr Stand sich bewegt, wenn sich der Plan bewegt.
    //
    // Der erste Anlauf benannte einfach ein Geraet des Standard-Projekts um --
    // und blieb gleich. Zu Recht: `buildTallyMap` laeuft ueber
    // `sourceIdentities`, und das Fixture hat keine, die Karte ist also leer.
    // Ein Test, der eine leere Karte gegen eine leere Karte haelt, prueft
    // nichts. Hier steht deshalb eine Rolle mit einem Geraet daran.
    const mitRolle = (name: string): CablePlannerProject =>
      project({
        equipment: [{ ...eq('A', name), sourceIdentityId: 'src1' } as EquipmentItem, eq('B', 'Switcher')],
        sourceIdentities: [{ id: 'src1', name: 'CAM 1', number: 1 }],
      } as Partial<CablePlannerProject>)

    const before = mitRolle('Kamera 1')
    const after = mitRolle('Kamera 1 NEU')
    expect(DOCUMENT_STANDS['tally-karte'](before)).not.toBe(DOCUMENT_STANDS['tally-karte'](after))
    // Und sie bleibt gleich, wenn sich nichts bewegt -- sonst waere der
    // Stempel Rauschen und der Vergleich wertlos.
    expect(DOCUMENT_STANDS['tally-karte'](before)).toBe(DOCUMENT_STANDS['tally-karte'](mitRolle('Kamera 1')))
  })

  it('die Blaetter je Geraet sind BENANNT statt weggelassen', () => {
    // Videohub-Labels, MV-Layout und Port-Karte gibt es je GERAET; das
    // Register fuehrt einen Stand je Bezeichner. Sie sind deshalb nicht
    // beurteilbar — aber sie zu verschweigen sieht in einer Impact-Liste aus
    // wie „unberuehrt", und das ist die schlechtere Antwort.
    for (const id of ['videohub-labels', 'atem-mv-layout', 'switch-port-karte', 'stueckliste']) {
      expect(Object.keys(UNJUDGEABLE_DOCUMENTS)).toContain(id)
      expect(UNJUDGEABLE_DOCUMENTS[id].length).toBeGreaterThan(30)
      expect(DOCUMENT_LABELS[id]).toBeTruthy()
    }
  })

  it('kein Bezeichner steht in BEIDEN Registern', () => {
    // Beurteilbar UND unbeurteilbar zugleich waere eine Aussage, die sich
    // selbst widerspricht.
    for (const id of Object.keys(UNJUDGEABLE_DOCUMENTS)) {
      expect(Object.keys(DOCUMENT_STANDS)).not.toContain(id)
    }
  })
})
