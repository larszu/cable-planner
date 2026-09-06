import { describe, expect, it } from 'vitest'
import { lookUpSheet } from '../src/renderer/lib/sheetLookup'
import { DOCUMENT_STANDS, UNJUDGEABLE_DOCUMENTS } from '../src/renderer/lib/documentRegistry'
import { buildDocQrPayload } from '../src/renderer/lib/qrPayload'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import quelle from '../src/renderer/lib/sheetLookup.ts?raw'
import analyseQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Bedarf 27 -- der Rueckweg vom Papier.
//
//   > Pick lists, call sheets ... stay paper because paper needs no battery,
//   > works in a basement and can be signed. But NOTHING CROSSES BACK.
//
// ADR-004 hat den Stempel auf jedes Blatt gesetzt, und `docStandStatus` /
// `findByStand` beantworten genau die Frage „gilt dieses Blatt noch?". Nur
// rief sie NICHTS auf: gemessen war die einzige Fundstelle ausserhalb ihrer
// eigenen Dateien ein Kommentar.
// ---------------------------------------------------------------------------

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

const standVon = (docId: string, p: CablePlannerProject) => DOCUMENT_STANDS[docId](p)

describe('der ganze Code — die beste Eingabe', () => {
  it('nennt das Dokument und sagt, dass es aktuell ist', () => {
    const p = project()
    const code = buildDocQrPayload('pull-liste', standVon('pull-liste', p))
    const r = lookUpSheet(code, p)
    expect(r.kind).toBe('identified')
    expect(r.docId).toBe('pull-liste')
    expect(r.status).toBe('current')
  })

  it('sagt UEBERHOLT, wenn der Plan seither weiter ist', () => {
    // Der eigentliche Zweck. Ein Blatt in der Hand, zwei Stunden vor Doors.
    const alt = project()
    const code = buildDocQrPayload('pull-liste', standVon('pull-liste', alt))
    const neu = project({ cables: [cable('c1', { type: 'Cat6' })] })
    const r = lookUpSheet(code, neu)
    expect(r.status).toBe('stale')
    expect(r.docId).toBe('pull-liste')
  })

  it('sagt „nicht beurteilbar" MIT dem Grund aus dem Register', () => {
    // Zwei Formulierungen derselben Regel laufen auseinander; der Grund wird
    // deshalb geholt und nicht neu geschrieben.
    const p = project()
    const code = buildDocQrPayload('kabel-bom', 'aaaaaaaa')
    const r = lookUpSheet(code, p)
    expect(r.status).toBe('unknown')
    expect(r.reason).toBe(UNJUDGEABLE_DOCUMENTS['kabel-bom'])
  })

  it('reicht das Revisions-Label vom Blatt durch', () => {
    const p = project()
    const code = buildDocQrPayload('pull-liste', standVon('pull-liste', p), 'Rev C')
    expect(lookUpSheet(code, p).revision).toBe('Rev C')
  })
})

describe('nur der Stand — abgetippt vom Fuss des Blatts', () => {
  it('findet das Dokument ueber den Stand allein', () => {
    const p = project()
    const r = lookUpSheet(standVon('pull-liste', p), p)
    expect(r.kind).toBe('matched-by-stand')
    expect(r.docId).toBe('pull-liste')
    expect(r.status).toBe('current')
  })

  it('nimmt die Raute, Leerzeichen und Grossbuchstaben an', () => {
    // Sie kommen vom Abtippen und sind kein Fehler. Wer daran scheitert,
    // scheitert an der Eingabe statt an der Sache.
    const p = project()
    const s = standVon('pull-liste', p)
    for (const eingabe of [`#${s}`, ` ${s} `, s.toUpperCase(), `# ${s.toUpperCase()} `]) {
      expect(lookUpSheet(eingabe, p).kind).toBe('matched-by-stand')
    }
  })

  it('BENENNT den ueberholten Ausdruck, statt „nicht gefunden" zu sagen', () => {
    // Der wichtigste Fall. „Passt zu keinem Dokument von jetzt" heisst fast
    // immer „das Blatt ist alt" -- ein blosses `null` klaenge nach Tippfehler.
    const r = lookUpSheet('deadbeef', project())
    expect(r.kind).toBe('stale-or-foreign')
    expect(r.stand).toBe('deadbeef')
    // Kein Dokument benannt -- und das ist die Aussage, nicht eine Luecke.
    expect(r.docId).toBeUndefined()
  })
})

describe('was keine Ausnahme wirft', () => {
  it('leere und unsinnige Eingabe liefert ein Ergebnis', () => {
    // „Das ist kein Dokument-Code" ist eine Auskunft und kein Fehlerfall. Wer
    // sie wirft, zwingt jeden Aufrufer zu einem try/catch fuer das Vertippen.
    for (const raw of ['', '   ', 'Guten Morgen', '123', 'xyzxyzxy']) {
      expect(lookUpSheet(raw, project()).kind).toBe('unreadable')
    }
  })

  it('liefert fuer jede Eingabeform eine benannte Art', () => {
    // Vier Wege, vier Arten -- keine faellt in einen Sammeltopf.
    const p = project()
    expect(lookUpSheet('', p).kind).toBe('unreadable')
    expect(lookUpSheet('deadbeef', p).kind).toBe('stale-or-foreign')
    expect(lookUpSheet(standVon('pull-liste', p), p).kind).toBe('matched-by-stand')
    expect(lookUpSheet(buildDocQrPayload('pull-liste', standVon('pull-liste', p)), p).kind).toBe(
      'identified',
    )
  })
})

describe('was die Datei NICHT tut', () => {
  it('holt sich weder Zeit noch Store', () => {
    expect(quelle).not.toMatch(/new Date\(\)|Date\.now\(\)|useProjectStore|useUiStore/)
  })

  it('schreibt den Unbeurteilbar-Grund nicht neu', () => {
    // Er kommt aus `UNJUDGEABLE_DOCUMENTS`. Zwei Formulierungen derselben
    // Regel laufen auseinander, und die zweite merkt es niemand.
    expect(quelle).toContain('UNJUDGEABLE_DOCUMENTS[ref.docId]')
  })
})

describe('Erreichbarkeit — der Grund, warum es diese Datei gibt', () => {
  it('wird im Analyse-Dialog aufgerufen und TREIBT die Anzeige', () => {
    // Der Aufruf UND seine Wirkung: ein Guard auf den blossen Bezeichner
    // prueft nur, dass er vorkommt (gemessen an Bedarf 16, wo genau das eine
    // Gegenprobe gruen liess).
    expect(analyseQuelle).toMatch(/setTreffer\(lookUpSheet\(draft, project\)\)/)
    expect(analyseQuelle).toMatch(/\{treffer && <div className=\{`text-cp-sm \$\{ton\(treffer\)\}`\}>\{text\(treffer\)\}/)
  })

  it('hat einen eigenen Reiter', () => {
    expect(analyseQuelle).toContain("id: 'sheet'")
    expect(analyseQuelle).toContain('<SheetTab />')
  })

  it('nennt die Eingabeform, statt sie raten zu lassen', () => {
    for (const key of ['analysis.sheet.intro', 'analysis.sheet.placeholder']) {
      expect(analyseQuelle).toContain(`'${key}'`)
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
