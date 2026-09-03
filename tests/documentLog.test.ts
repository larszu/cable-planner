import { describe, expect, it } from 'vitest'
import { reviewLog, reviewSummary, type DocumentLogFile } from '../src/renderer/lib/documentLog'
import { DOCUMENT_STANDS, UNJUDGEABLE_DOCUMENTS, currentStand } from '../src/renderer/lib/documentRegistry'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import docsDialogSrc from '../src/renderer/components/Export/InstallationDocsDialog.tsx?raw'
import serviceSrc from '../src/main/services/documentLog.ts?raw'

// ---------------------------------------------------------------------------
// Roadmap-Initiative 5, letztes Stueck — das Register der ausgegebenen
// Dokumente, und was es beantwortet.
//
// `changeImpact` konnte zwei GEGEBENE Plan-Staende vergleichen. Die eigentlich
// gewuenschte Frage — „welches der Blaetter, die ich ausgeteilt habe, ist
// jetzt hin?" — brauchte ein Gedaechtnis dafuer, dass ein Dokument je
// ausgegeben wurde. `INITIATIVE-5-SCOPING.md` hat gemessen, dass es das nicht
// gab, und die vier Fragen daran dem Eigentuemer vorgelegt. Entschieden:
// getrennte Protokolldatei plus einsehbares Log im Menue.
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

const logWith = (entries: DocumentLogFile['entries'], dropped = 0): DocumentLogFile => ({
  version: 1,
  entries,
  dropped,
})

const entry = (docId: string, stand: string, over: Record<string, unknown> = {}) => ({
  docId,
  label: docId,
  stand,
  emittedAt: '2026-09-03T10:00:00Z',
  project: 'Testanlage',
  ...over,
})

describe('das Register gegen den offenen Plan halten', () => {
  it('nennt ein Blatt aktuell, solange der Stand derselbe ist', () => {
    const p = project()
    const stand = currentStand('pull-liste', p) as string
    const reviewed = reviewLog(logWith([entry('pull-liste', stand)]), p)
    expect(reviewed).toHaveLength(1)
    expect(reviewed[0].status).toBe('current')
    expect(reviewSummary(reviewed)).toBe('alle aktuell')
  })

  it('nennt es ueberholt, sobald sich die Ableitung geaendert hat', () => {
    const before = project()
    const stand = currentStand('pull-liste', before) as string
    // Dieselbe Aenderung, die den Rehearsal-Day-Edit ausmacht: eine Laenge.
    const after = project({ cables: [cable('c1', { length: 25 })] })
    const reviewed = reviewLog(logWith([entry('pull-liste', stand)]), after)
    expect(reviewed[0].status).toBe('superseded')
    expect(reviewed[0].standNow).toBe(currentStand('pull-liste', after))
    expect(reviewSummary(reviewed)).toBe('1 überholt')
  })

  it('fuehrt ein nicht reproduzierbares Dokument als unknown, nicht als aktuell', () => {
    // `kabel-bom` haengt am Reserve-Aufschlag, der nicht im Plan steht. Es als
    // „aktuell" zu fuehren waere eine Freigabe, die niemand gegeben hat —
    // dieselbe Regel wie in `changeImpact`.
    const p = project()
    const reviewed = reviewLog(logWith([entry('kabel-bom', 'a1b2c3d4')]), p)
    expect(reviewed[0].status).toBe('unknown')
    expect(reviewed[0].standNow).toBeUndefined()
    expect(reviewSummary(reviewed)).toBe('1 nicht beurteilbar')
  })

  it('unterscheidet leer von „nichts ausgegeben"', () => {
    expect(reviewSummary([])).toBe('nichts ausgegeben')
  })

  it('ordnet ueber den Pfad zu, wo es einen gibt', () => {
    // Zwei Projekte gleichen Namens sind keine Seltenheit („Testanlage").
    // Der Pfad ist die staerkere Zuordnung und gewinnt deshalb.
    const p = project()
    const stand = currentStand('pull-liste', p) as string
    const log = logWith([
      entry('pull-liste', stand, { projectPath: '/a/plan.cableplan' }),
      entry('pull-liste', stand, { projectPath: '/b/plan.cableplan' }),
    ])
    expect(reviewLog(log, p, '/a/plan.cableplan')).toHaveLength(1)
  })

  it('faellt auf den Namen zurueck, wenn kein Pfad bekannt ist', () => {
    const p = project()
    const stand = currentStand('pull-liste', p) as string
    const log = logWith([entry('pull-liste', stand), entry('pull-liste', stand, { project: 'Andere' })])
    expect(reviewLog(log, p)).toHaveLength(1)
  })

  it('zeigt das juengste zuerst', () => {
    const p = project()
    const stand = currentStand('pull-liste', p) as string
    const log = logWith([
      entry('pull-liste', stand, { emittedAt: '2026-09-01T10:00:00Z' }),
      entry('asset-register', currentStand('asset-register', p) as string, {
        emittedAt: '2026-09-03T10:00:00Z',
      }),
    ])
    expect(reviewLog(log, p).map((e) => e.docId)).toEqual(['asset-register', 'pull-liste'])
  })
})

describe('was das Register nicht verschweigen darf', () => {
  it('zaehlt, was der Verfall entfernt hat', () => {
    // Ein still gekuerztes Protokoll waere seine eigene kleine Luege: es
    // saehe vollstaendig aus.
    expect(serviceSrc).toContain('dropped: log.dropped + overflow')
    expect(serviceSrc).toMatch(/MAX_ENTRIES = \d+/)
  })

  it('schreibt keinen Eintrag ohne Stand', () => {
    // Ein Eintrag ohne Stand koennte nie beantworten, ob er noch gilt — er
    // waere eine Protokoll-Zeile, die wie eine Aussage aussieht.
    expect(docsDialogSrc).toContain('recordEmission(project, suffix, filePath)')
  })
})

describe('der Bezeichner ist derselbe wie im Dateinamen', () => {
  it('jeder Export-Suffix im Doku-Dialog ist ein bekannter Dokument-Bezeichner', () => {
    // Darauf beruht die ganze Aufzeichnung an einer Stelle: `save(suffix)`
    // schreibt `suffix` als docId. Laufen die beiden auseinander, landen
    // Eintraege im Register, die keine Ableitung mehr finden — und stuenden
    // dann fuer immer als „nicht beurteilbar" da.
    const suffixes = [...docsDialogSrc.matchAll(/suffix: '([^']+)'/g)].map((m) => m[1])
    expect(suffixes.length).toBeGreaterThanOrEqual(6)
    const known = new Set([
      ...Object.keys(DOCUMENT_STANDS),
      ...Object.keys(UNJUDGEABLE_DOCUMENTS),
    ])
    for (const suffix of suffixes) {
      expect(known.has(suffix), `${suffix} ist kein bekannter Dokument-Bezeichner`).toBe(true)
    }
  })
})
