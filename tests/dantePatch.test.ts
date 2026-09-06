import { describe, expect, it } from 'vitest'
import {
  DANTE_DIFF_LABEL,
  DANTE_FINDING_LABEL,
  assessDantePatch,
  danteDiffTable,
  dantePatchTable,
  diffDantePatches,
  parseDanteMatrix,
} from '../src/renderer/lib/dantePatch'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { EquipmentItem } from '../src/renderer/types/equipment'
import libQuelle from '../src/renderer/lib/dantePatch.ts?raw'
import typenQuelle from '../src/renderer/types/dantePatch.ts?raw'
import dialogQuelle from '../src/renderer/components/Analysis/AnalysisDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Der Dante-Patch als lesbares, vergleichbares Dokument (Bedarf 94, P2).
//
//   > Repetitive changes require opening many pages in Dante Controller;
//   > renaming machines or channels LOSES THE EXISTING PATCH; the only way to
//   > make a patch readable off the network is to export XML and convert it to
//   > an Excel matrix.                (Mamat79/Dante-Config-Editor, 2026-08-24)
//
// Gebaut wird die Dokumentations-Haelfte, die die Bedarfs-Datenbank verlangt.
// NICHT gebaut wird der XML-Leser: das Schema liegt in diesem Korpus nicht vor.
// ---------------------------------------------------------------------------

const CSV = `Rx Device;Rx Channel;Tx Device;Tx Channel
Stagebox A;01;Pult;Out 1
Stagebox A;02;Pult;Out 2
Stagebox A;03;;
Amp Rack;01;Pult;Out 5
`

const eq = (name: string, dante = true): EquipmentItem =>
  ({
    id: name,
    name,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    category: 'Audio',
    inputs: [],
    outputs: [],
    ...(dante
      ? { networkInterfaces: [{ id: 'n', label: 'Dante', role: 'dante-primary' }] }
      : {}),
  }) as never

const projekt = (namen: string[]): CablePlannerProject =>
  ({
    metadata: { name: 'Show', description: '', createdAt: '', updatedAt: '' },
    equipment: namen.map((n) => eq(n)),
    cables: [],
    canvasState: { x: 0, y: 0, zoom: 1 },
  }) as CablePlannerProject

const arten = (p: Parameters<typeof assessDantePatch>[0], plan?: CablePlannerProject): string[] =>
  assessDantePatch(p, plan).map((f) => f.kind)

// ── 1. Die Grenze: kein XML, kein Netz ─────────────────────────────────────

describe('die Grenze', () => {
  it('liest kein Preset-XML und tut nicht so', () => {
    // Das Schema haengt an der Controller-Version, diese Anwendung hat nie
    // eines gesehen. Ein Parser nach Vermutung saehe aus, als koennte er es.
    expect(libQuelle).not.toMatch(/DOMParser|parseFromString|<\?xml|querySelector/)
    expect(typenQuelle).toMatch(/das Schema des\s*\n?\/\/ Dante-Preset-XML liegt in diesem Korpus NICHT vor/)
  })

  it('geht nicht ins Netz und benennt nichts um', () => {
    expect(libQuelle).not.toMatch(/fetch\(|WebSocket|mdns|bonjour|subscribe\(/i)
  })
})

// ── 2. Die Matrix lesen ────────────────────────────────────────────────────

describe('parseDanteMatrix', () => {
  it('liest die vier Spalten über ihre ÜBERSCHRIFT', () => {
    const p = parseDanteMatrix(CSV)
    expect(p.subscriptions).toHaveLength(4)
    expect(p.subscriptions[0]).toEqual({
      rxDevice: 'Stagebox A',
      rxChannel: '01',
      txDevice: 'Pult',
      txChannel: 'Out 1',
    })
  })

  it('findet die Spalten auch umsortiert', () => {
    // Eine Datei, deren Spalten jemand umsortiert hat, ist dieselbe Datei —
    // eine positionsfeste Lesung machte daraus stillschweigend einen anderen
    // Patch, Sender und Empfänger vertauscht.
    const p = parseDanteMatrix('Tx Device;Rx Device;Tx Channel;Rx Channel\nPult;Box;Out 1;01\n')
    expect(p.subscriptions[0]).toEqual({
      rxDevice: 'Box',
      rxChannel: '01',
      txDevice: 'Pult',
      txChannel: 'Out 1',
    })
  })

  it('BEHÄLT einen unabonnierten Empfangskanal', () => {
    // „Welcher Kanal hängt an nichts" ist eine der beiden Fragen, um die es
    // hier geht.
    const frei = parseDanteMatrix(CSV).subscriptions.find((s) => s.rxChannel === '03')
    expect(frei).toEqual({ rxDevice: 'Stagebox A', rxChannel: '03' })
  })

  it('liest ohne Rx-Spalten GAR NICHTS und zählt JEDE Datenzeile als unlesbar', () => {
    // Die Zahl ist die Aussage: eine Datei ohne Empfänger-Spalte ist nicht
    // „leer", sondern unbrauchbar, und wie viele Zeilen dabei verloren gehen,
    // steht daneben.
    const p = parseDanteMatrix('Tx Device;Tx Channel\nPult;Out 1\nPult;Out 2\nPult;Out 3\n')
    expect(p.subscriptions).toHaveLength(0)
    expect(p.unreadable).toBe(3)
  })

  it('zählt Zeilen ohne Empfänger als unlesbar', () => {
    const p = parseDanteMatrix('Rx Device;Rx Channel\nBox;01\n;02\n')
    expect(p.subscriptions).toHaveLength(1)
    expect(p.unreadable).toBe(1)
  })

  it('erkennt Komma UND Semikolon', () => {
    expect(parseDanteMatrix('Rx Device,Rx Channel\nBox,01\n').subscriptions).toHaveLength(1)
    expect(parseDanteMatrix('Rx Device;Rx Channel\nBox;01\n').subscriptions).toHaveLength(1)
  })

  it('nimmt deutsche und englische Überschriften', () => {
    expect(parseDanteMatrix('Empfänger;Empfangskanal\nBox;01\n').subscriptions).toHaveLength(1)
    expect(parseDanteMatrix('Receiver;Destination\nBox;01\n').subscriptions).toHaveLength(1)
  })

  it('nimmt eine leere Datei ohne zu stolpern', () => {
    expect(parseDanteMatrix('')).toEqual({ subscriptions: [], unreadable: 0 })
  })
})

// ── 3. Die Befunde ─────────────────────────────────────────────────────────

describe('assessDantePatch', () => {
  it('meldet einen doppelt belegten Empfangskanal', () => {
    // Ein Empfangskanal kann nur ein Abo haben.
    const p = parseDanteMatrix('Rx Device;Rx Channel;Tx Device;Tx Channel\nBox;01;A;1\nBox;01;B;2\n')
    expect(arten(p)).toContain('rx-duplicate')
  })

  it('meldet ein halbes Abo', () => {
    const p = parseDanteMatrix('Rx Device;Rx Channel;Tx Device;Tx Channel\nBox;01;Pult;\n')
    expect(arten(p)).toContain('half-subscription')
  })

  it('meldet einen Patch, in dem gar nichts abonniert ist', () => {
    const p = parseDanteMatrix('Rx Device;Rx Channel\nBox;01\nBox;02\n')
    expect(arten(p)).toContain('nothing-subscribed')
  })

  it('meldet ein Gerät, das der Plan nicht kennt', () => {
    // Nach einer Umbenennung steht genau so der alte Name im Patch und der
    // neue im Plan.
    const p = parseDanteMatrix(CSV)
    expect(arten(p, projekt(['Stagebox A', 'Pult']))).toContain('device-not-in-plan')
  })

  it('meldet ein Dante-Gerät des Plans, das im Patch fehlt', () => {
    const p = parseDanteMatrix(CSV)
    expect(arten(p, projekt(['Stagebox A', 'Amp Rack', 'Pult', 'Monitorpult']))).toContain(
      'plan-device-unpatched',
    )
  })

  it('schweigt beim Abgleich, wenn der Plan KEIN Dante-Gerät führt', () => {
    // Sonst schlüge der Befund bei jedem Namen an, und ein Befund, der immer
    // anschlägt, wird nach der dritten Zeile weggeklickt.
    const ohne = {
      ...projekt([]),
      equipment: [eq('Irgendwas', false)],
    } as CablePlannerProject
    expect(arten(parseDanteMatrix(CSV), ohne)).not.toContain('device-not-in-plan')
  })

  it('gibt ohne Plan dasselbe wie mit einem Plan OHNE Dante-Geräte', () => {
    // Beide sagen „es gibt nichts zu vergleichen". Der früh zurückkehrende
    // Zweig für `!plan` spart nur Arbeit — er darf keine andere Antwort geben.
    const p = parseDanteMatrix(CSV)
    const ohneDante = {
      ...projekt([]),
      equipment: [eq('Irgendwas', false)],
    } as CablePlannerProject
    expect(arten(p)).toEqual(arten(p, ohneDante))
    expect(arten(p)).not.toContain('device-not-in-plan')
    expect(arten(p)).not.toContain('plan-device-unpatched')
  })

  it('gibt jeder Befundart eine Beschriftung', () => {
    for (const k of Object.keys(DANTE_FINDING_LABEL)) {
      expect(DANTE_FINDING_LABEL[k as never]).toBeTruthy()
    }
  })
})

// ── 4. Der Vergleich ───────────────────────────────────────────────────────

describe('diffDantePatches', () => {
  const a = parseDanteMatrix(CSV)

  it('meldet eine neu abonnierte Quelle', () => {
    const b = parseDanteMatrix(CSV.replace('Stagebox A;03;;', 'Stagebox A;03;Pult;Out 3'))
    expect(diffDantePatches(a, b)).toEqual([
      {
        rx: 'Stagebox A / 03',
        kind: 'subscribed',
        before: 'nichts',
        after: 'Pult / Out 3',
      },
    ])
  })

  it('meldet ein entferntes Abo', () => {
    const b = parseDanteMatrix(CSV.replace('Stagebox A;01;Pult;Out 1', 'Stagebox A;01;;'))
    expect(diffDantePatches(a, b)[0]).toMatchObject({ kind: 'unsubscribed' })
  })

  it('meldet eine andere Quelle am gleichen Kanal', () => {
    const b = parseDanteMatrix(CSV.replace('Pult;Out 1', 'Pult;Out 9'))
    expect(diffDantePatches(a, b)[0]).toMatchObject({
      kind: 'changed',
      before: 'Pult / Out 1',
      after: 'Pult / Out 9',
    })
  })

  it('meldet einen weggefallenen Empfangskanal', () => {
    const b = parseDanteMatrix(CSV.replace('Amp Rack;01;Pult;Out 5\n', ''))
    expect(diffDantePatches(a, b)[0]).toMatchObject({ kind: 'rx-removed' })
  })

  it('lässt beidseitig unabonnierte Kanäle WEG', () => {
    // In einem 64-Kanal-Patch wären das die meisten Zeilen.
    expect(diffDantePatches(a, a)).toEqual([])
  })

  it('gibt jeder Änderungsart eine Beschriftung', () => {
    for (const k of Object.keys(DANTE_DIFF_LABEL)) {
      expect(DANTE_DIFF_LABEL[k as never]).toBeTruthy()
    }
  })
})

// ── 5. Die Blätter und die Oberfläche ──────────────────────────────────────

describe('die Blätter', () => {
  it('geben jeder leeren Zelle einen NAMEN', () => {
    const zeile = dantePatchTable(parseDanteMatrix(CSV)).rows[2].map(String)
    expect(zeile).toContain('nichts')
    expect(zeile).toContain('kein Kanal')
    expect(zeile.every((z) => z.trim() !== '')).toBe(true)
  })

  it('nennen die Änderung beim Namen', () => {
    const b = parseDanteMatrix(CSV.replace('Pult;Out 1', 'Pult;Out 9'))
    const t = danteDiffTable(diffDantePatches(parseDanteMatrix(CSV), b))
    expect(t.rows[0].map(String)).toContain('auf andere Quelle gelegt')
  })

  it('tragen kanonisches Deutsch', () => {
    expect(libQuelle).not.toContain("t('")
  })
})

describe('die Oberfläche', () => {
  it('vergleicht erst, wenn zwei Stände vorliegen', () => {
    expect(dialogQuelle).toMatch(/patchA && patchB \? diffDantePatches\(patchA, patchB\) : \[\]/)
  })

  it('behält den ERSTEN Import als Bezugsstand', () => {
    expect(dialogQuelle).toMatch(/if \(!patchA\) setPatchA\(gelesen\)\s*\n?\s*else setPatchB\(gelesen\)/)
  })

  it('sagt ausdrücklich, wenn sich nichts geändert hat', () => {
    expect(dialogQuelle).toMatch(/patchB && unterschiede\.length === 0 && \(/)
  })

  it('zeigt die Zahl der unlesbaren Zeilen', () => {
    expect(dialogQuelle).toMatch(/aktuell\.unreadable > 0 && \(/)
  })

  it('zeigt jeden Befund mit seiner Beschriftung', () => {
    expect(dialogQuelle).toMatch(
      /befunde\.length > 0 && \([\s\S]*DANTE_FINDING_LABEL\[f\.kind\][\s\S]*f\.text/,
    )
  })
})
