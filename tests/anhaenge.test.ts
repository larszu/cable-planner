import { afterAll, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { ATTACHMENT_MAX_BYTES, attachFile, attachmentsPresent } from '../src/main/services/attachmentStore'
import mainSrc from '../src/main/services/attachmentStore.ts?raw'
import ablageSrc from '../src/main/util/projektAblage.ts?raw'
import ipcSrc from '../src/main/ipc/attachmentIpc.ts?raw'
import rendererSrc from '../src/renderer/types/anhang.ts?raw'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { ProjektAnhang } from '../src/renderer/types/anhang'
import { anhaengeTable, messungenOhneProtokoll, normaliseAnhaenge } from '../src/renderer/lib/anhaenge'
import { DOCUMENT_LABELS, DOCUMENT_STANDS } from '../src/renderer/lib/documentRegistry'
import { stripComments } from './support/stripComments'

// ---------------------------------------------------------------------------
// Die Anhänge-Ablage: Messprotokolle, Herstellerunterlagen und
// Konfig-Sicherungen neben dem Projekt, im Projekt nur der Verweis.
// ---------------------------------------------------------------------------

const tmp: string[] = []
const ordner = async () => {
  const d = await mkdtemp(path.join(tmpdir(), 'anhang-'))
  tmp.push(d)
  return d
}
afterAll(async () => {
  for (const d of tmp) await rm(d, { recursive: true, force: true })
})

describe('Ablage in main', () => {
  it('legt jede Endung in Anhaenge/ ab und nennt Unbekanntes octet-stream', async () => {
    const d = await ordner()
    const projectPath = path.join(d, 'Haus.avplan')
    const quelle = path.join(d, 'Messung Saal.flw')
    await writeFile(quelle, 'LinkWare')
    const r = await attachFile(projectPath, quelle, '2026-09-27T10:00:00Z')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.file.storedAs).toMatch(/^Anhaenge\/[0-9a-f]{12}-Messung_Saal\.flw$/)
    expect(r.file.mediaType).toBe('application/octet-stream')
    expect(r.file).not.toHaveProperty('inhalt')
    expect(await readFile(path.join(d, r.file.storedAs), 'utf8')).toBe('LinkWare')
  })

  it('erkennt ein PDF und legt dieselben Bytes nur einmal ab', async () => {
    const d = await ordner()
    const projectPath = path.join(d, 'Haus.avplan')
    const quelle = path.join(d, 'Handbuch.pdf')
    await writeFile(quelle, '%PDF-1.7')
    const a = await attachFile(projectPath, quelle, 'a')
    const b = await attachFile(projectPath, quelle, 'b')
    expect(a.ok && b.ok && a.file.storedAs === b.file.storedAs).toBe(true)
    if (a.ok) expect(a.file.mediaType).toBe('application/pdf')
  })

  it('lehnt benannt ab: ungespeichertes Projekt, zu gross', async () => {
    expect(await attachFile(undefined, '/tmp/x.pdf', 'a')).toEqual({ ok: false, reason: 'no-project-path' })
    const d = await ordner()
    const quelle = path.join(d, 'gross.bin')
    await writeFile(quelle, Buffer.alloc(ATTACHMENT_MAX_BYTES + 1))
    expect(await attachFile(path.join(d, 'H.avplan'), quelle, 'a')).toEqual({ ok: false, reason: 'too-large' })
  })

  it('meldet vorhanden und fehlend — und sieht ausserhalb des Projekts gar nicht erst nach', async () => {
    const d = await ordner()
    const projectPath = path.join(d, 'Haus.avplan')
    const quelle = path.join(d, 'a.txt')
    await writeFile(quelle, 'x')
    const r = await attachFile(projectPath, quelle, 'a')
    if (!r.ok) throw new Error('nicht abgelegt')
    const da = await attachmentsPresent(projectPath, [r.file.storedAs, 'Anhaenge/fehlt.pdf', '../a.txt'])
    expect(da).toEqual({ [r.file.storedAs]: true, 'Anhaenge/fehlt.pdf': false, '../a.txt': false })
  })

  it('öffnet nie eine Datei — es gibt nur Ablegen, Nachsehen und Zeigen', () => {
    const c = stripComments(ipcSrc)
    expect(c).not.toMatch(/openPath|openExternal|readFile/)
    expect([...c.matchAll(/ipcMain\.handle\('([^']+)'/g)].map((m) => m[1]).sort()).toEqual([
      'attachment:pick',
      'attachment:present',
      'attachment:reveal',
    ])
  })
})

// Main und Renderer teilen keine Typen. Wer drüben ein Feld ergänzt und hier
// nicht, verliert es beim ersten Speichern.
const felderVon = (quelle: string, name: string): string[] => {
  const i = quelle.indexOf(`interface ${name} {`)
  if (i < 0) throw new Error(`${name} nicht gefunden`)
  const koerper = quelle.slice(i, quelle.indexOf('\n}', i))
  return [...koerper.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]).sort()
}

describe('die beiden Abschriften', () => {
  it('tragen dieselben Felder', () => {
    expect(felderVon(rendererSrc, 'AnhangDatei')).toEqual(felderVon(mainSrc, 'AttachmentFile'))
  })

  it('nennen dieselben Ablehnungsgründe', () => {
    const gruende = (q: string, typ: string) =>
      [...q.slice(q.indexOf(`type ${typ} =`)).matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).slice(0, 6).sort()
    expect(gruende(rendererSrc, 'AnhangAblehnung')).toEqual(gruende(ablageSrc, 'AblageAblehnung'))
  })
})

// ─── Im Projekt ────────────────────────────────────────────────────────────

const datei = (storedAs: string, over: Record<string, unknown> = {}) => ({
  sha256: 'ab'.repeat(32),
  fileName: storedAs.split('/').pop(),
  storedAs,
  mediaType: 'application/pdf',
  bytes: 2048,
  addedAt: '2026-09-27T10:00:00Z',
  ...over,
})

describe('normaliseAnhaenge', () => {
  it('verwirft Pfade ausserhalb des Projektordners, Dubletten und Einträge ohne Hash', () => {
    const r = normaliseAnhaenge([
      { id: 'a', art: 'messprotokoll', titel: 'Saal', datei: datei('Anhaenge/a.pdf') },
      { id: 'a', art: 'messprotokoll', titel: 'doppelt', datei: datei('Anhaenge/b.pdf') },
      { id: 'b', art: 'messprotokoll', datei: datei('../geheim.pdf') },
      { id: 'c', art: 'messprotokoll', datei: datei('/etc/passwd') },
      { id: 'd', art: 'messprotokoll', datei: datei('C:\\x.pdf') },
      { id: 'e', art: 'messprotokoll', datei: { storedAs: 'Anhaenge/e.pdf' } },
      { id: 'f', art: 'erfunden', datei: datei('Anhaenge/f.pdf'), ziel: { type: 'rack', id: 'x' } },
    ])
    expect(r!.map((a) => a.id)).toEqual(['a', 'f'])
    expect(r![1].art).toBe('sonstiges')
    expect(r![1]).not.toHaveProperty('ziel')
  })

  it('macht aus leer undefined', () => {
    expect(normaliseAnhaenge([])).toBeUndefined()
    expect(normaliseAnhaenge(undefined)).toBeUndefined()
  })
})

const kabel = (id: string, over: Partial<Cable> = {}): Cable =>
  ({ id, name: id, cableNumber: id, fromEquipmentId: 'a', fromPortId: 'a', toEquipmentId: 'b', toPortId: 'b', ...over }) as Cable

const haus = (anhaenge: ProjektAnhang[]): CablePlannerProject =>
  ({
    metadata: { name: 'Haus', createdAt: '', updatedAt: '' },
    equipment: [{ id: 'atem', name: 'ATEM', category: 'Video', inputs: [], outputs: [], x: 0, y: 0, width: 1, height: 1 }],
    cables: [
      kabel('K-1', { testResult: { result: 'pass' } }),
      kabel('K-2', { testResult: { result: 'pass', reportRef: 'LinkWare 12' } }),
      kabel('K-3', { testResult: { result: 'fail' } }),
      kabel('K-4'),
    ],
    anhaenge,
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as unknown as CablePlannerProject

describe('Anhänge-Verzeichnis', () => {
  const liste: ProjektAnhang[] = [
    { id: '1', art: 'messprotokoll', titel: 'Messung K-1', datei: datei('Anhaenge/k1.pdf') as ProjektAnhang['datei'], ziel: { type: 'cable', id: 'K-1' } },
    { id: '2', art: 'herstellerunterlage', titel: '', datei: datei('Anhaenge/atem.pdf') as ProjektAnhang['datei'], ziel: { type: 'equipment', id: 'atem' } },
    { id: '3', art: 'konfig-backup', titel: 'Alt', datei: datei('Anhaenge/alt.xml') as ProjektAnhang['datei'], ziel: { type: 'equipment', id: 'weg' } },
  ]

  it('fragt nur nach Messungen ohne Protokoll — Anhang oder Verweis im Messergebnis zählen', () => {
    expect(messungenOhneProtokoll(haus(liste))).toEqual(['K-3'])
  })

  it('führt jeden Anhang mit Ziel und Prüfsumme, die fehlenden Protokolle und verlorene Ziele', () => {
    const t = anhaengeTable(haus(liste))
    expect(t.headers).toEqual(['Art', 'Titel', 'Betrifft', 'Datei', 'Größe (KB)', 'SHA-256', 'Angehängt', 'Befund'])
    expect(t.rows).toContainEqual(['Herstellerunterlage', 'atem.pdf', 'ATEM', 'Anhaenge/atem.pdf', 2, 'ab'.repeat(32), '2026-09-27', ''])
    expect(t.rows).toContainEqual(['Messprotokoll', '', 'K-3', '', '', '', '', 'Messung eingetragen, Protokoll fehlt'])
    expect(t.rows.find((r) => r[1] === 'Alt')![7]).toBe('Ziel nicht mehr im Plan')
  })

  it('hängt nicht an der Reihenfolge der Anhänge', () => {
    expect(anhaengeTable(haus([...liste].reverse()))).toEqual(anhaengeTable(haus(liste)))
  })

  it('steht im Register', () => {
    expect(DOCUMENT_LABELS.anhaenge).toBe('Anhänge-Verzeichnis')
    expect(DOCUMENT_STANDS.anhaenge(haus(liste))).not.toBe(DOCUMENT_STANDS.anhaenge(haus(liste.slice(1))))
  })
})

describe('im Store', () => {
  it('heilt beim Laden, entfernt nur den Verweis und lässt ein leeres Feld weg', async () => {
    const { useProjectStore } = await import('../src/renderer/store/projectStore')
    const p = haus([
      ...(normaliseAnhaenge([{ id: 'x', art: 'messprotokoll', titel: '', datei: datei('Anhaenge/x.pdf') }]) ?? []),
      { id: 'y', art: 'messprotokoll', titel: '', datei: datei('../raus.pdf') } as unknown as ProjektAnhang,
    ])
    useProjectStore.getState().loadProject(p)
    expect(useProjectStore.getState().project.anhaenge?.map((a) => a.id)).toEqual(['x'])

    useProjectStore.getState().updateAnhang('x', { ziel: { type: 'cable', id: 'K-3' } })
    expect(useProjectStore.getState().project.anhaenge?.[0].ziel).toEqual({ type: 'cable', id: 'K-3' })
    // K-3 hat jetzt sein Protokoll; K-1 hat in DIESEM Projekt keins.
    expect(messungenOhneProtokoll(useProjectStore.getState().project)).toEqual(['K-1'])
    useProjectStore.getState().updateAnhang('x', { ziel: undefined })
    expect(useProjectStore.getState().project.anhaenge?.[0]).not.toHaveProperty('ziel')

    useProjectStore.getState().removeAnhang('x')
    expect(useProjectStore.getState().project.anhaenge).toBeUndefined()
  })
})
