import { describe, expect, it } from 'vitest'
import {
  SCENE_DIFF_LABEL,
  diffScenes,
  matchTable,
  matchToPlan,
  parseSceneFile,
  sceneDiffTable,
  sceneTable,
} from '../src/renderer/lib/sceneImport'
import { SCENE_FORMAT_LABEL } from '../src/renderer/types/sceneImport'
import libQuelle from '../src/renderer/lib/sceneImport.ts?raw'
import typenQuelle from '../src/renderer/types/sceneImport.ts?raw'
import dialogQuelle from '../src/renderer/components/Patch/PatchListDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Die Kanalliste aus der Datei lesen, die das Pult ohnehin schreibt
// (Bedarf 92, P2).
//
//   > The authoritative channel names live in the console show file; the
//   > paperwork is typed by hand from memory or from an older PDF. NOTHING
//   > FLOWS BACK FROM THE DESK after rehearsal changes.
//
// Der Beleg (computi71/bandregie#11) nennt das Format: `/ch/NN/config "Name"`,
// „can be parsed reliably", WING schreibt dieselben Zeilen. Und er nennt den
// zweiten Teil: „offer a diff between uploads".
// ---------------------------------------------------------------------------

const SZENE = `#4.0# "Probe" "" %000000000 1
/ch/01/config "Kick" 1 RD 1
/ch/02/config "Snare" 2 RD 2
/ch/03/config "Bass DI" 3 BL 3
/ch/04/config "" 1 OFF 4
/ch/05/config "Vox Lead" 5 YE 5
`

describe('parseSceneFile — das Format aus dem Beleg', () => {
  it('liest Nummer, Name und Farbe', () => {
    const s = parseSceneFile(SZENE)
    expect(s.channels).toHaveLength(5)
    expect(s.channels[0]).toEqual({ ch: 1, name: 'Kick', color: 'RD' })
    expect(s.channels[4]).toEqual({ ch: 5, name: 'Vox Lead', color: 'YE' })
  })

  it('BEHÄLT einen unbeschrifteten Kanal', () => {
    // Ein leerer Name heisst „am Pult unbeschriftet", NICHT „gibt es nicht".
    // Ein Import, der ihn wegliesse, machte aus einem Loch im
    // Beschriftungsstreifen ein Loch in der Liste.
    const s = parseSceneFile(SZENE)
    // Ohne Farbe: das X32 schreibt `OFF` fuer einen Streifen ohne Farbe, und
    // die wird nicht als Farbe gefuehrt.
    expect(s.channels.find((c) => c.ch === 4)).toEqual({ ch: 4, name: '' })
  })

  it('erkennt X32 und WING', () => {
    expect(parseSceneFile(SZENE).format).toBe('x32')
    expect(parseSceneFile('#2.0# "WING Show"\n/ch/01/config "Kick" 1 RD 1\n').format).toBe('wing')
  })

  it('rät das Format NICHT, liest die Kanäle aber trotzdem', () => {
    // Eine erfundene Marke auf dem Blatt waere schlechter als ein ehrliches
    // „nicht erkannt": jemand suchte den Fehler beim falschen Pult.
    const s = parseSceneFile('irgendwas\n')
    expect(s.format).toBe('unknown')
    expect(SCENE_FORMAT_LABEL.unknown).toBe('nicht erkannt')
  })

  it('zählt unlesbare Kanalzeilen, statt sie still zu schlucken', () => {
    // Eine Datei, aus der die Haelfte nicht gelesen wurde, saehe sonst aus wie
    // ein Pult mit wenigen Kanaelen.
    const s = parseSceneFile('/ch/01/config "Kick" 1 RD 1\n/ch/02/config abgeschnitten\n')
    expect(s.channels).toHaveLength(1)
    expect(s.unreadable).toBe(1)
  })

  it('lässt bei doppelter Kanalzeile die ERSTE gewinnen', () => {
    const s = parseSceneFile('/ch/01/config "Erst" 1 RD 1\n/ch/01/config "Dann" 1 GN 1\n')
    expect(s.channels[0].name).toBe('Erst')
  })

  it('nimmt eine Zahl an der Farbstelle NICHT als Farbe', () => {
    expect(parseSceneFile('/ch/01/config "Kick" 1 7 1\n').channels[0].color).toBeUndefined()
  })

  it('führt `OFF` NICHT als Farbe', () => {
    // Das X32 schreibt `OFF` fuer einen Streifen ohne Farbe. Als Farbe geführt
    // meldete der Vergleich eine Farbänderung, wo jemand nur eine Farbe
    // entfernt hat.
    expect(parseSceneFile('/ch/01/config "Kick" 1 OFF 1\n').channels[0].color).toBeUndefined()
    const a = parseSceneFile('/ch/01/config "Kick" 1 RD 1\n')
    const b = parseSceneFile('/ch/01/config "Kick" 1 OFF 1\n')
    const d = diffScenes(a, b)[0]
    expect(d.kind).toBe('recolored')
    expect(d.beforeColor).toBe('RD')
    // Kein `afterColor`: die Farbe wurde entfernt, nicht gewechselt.
    expect(d.afterColor).toBeUndefined()
  })

  it('liest Anführungszeichen im Namen', () => {
    expect(parseSceneFile('/ch/01/config "Gt \\"Amp\\"" 1 RD 1\n').channels[0].name).toBe('Gt "Amp"')
  })

  it('verwirft Kanal 0', () => {
    const s = parseSceneFile('/ch/00/config "Nichts" 1 RD 1\n')
    expect(s.channels).toHaveLength(0)
    expect(s.unreadable).toBe(1)
  })

  it('nimmt den Mute-Zustand mit, wo die Datei ihn führt', () => {
    const s = parseSceneFile('/ch/01/config "Kick" 1 RD 1\n/ch/01/mix OFF -oo OFF +0 OFF\n')
    expect(s.channels[0].muted).toBe(true)
  })

  it('sortiert nach Kanalnummer, nicht nach Dateireihenfolge', () => {
    const s = parseSceneFile('/ch/03/config "C" 1 RD 1\n/ch/01/config "A" 1 RD 1\n')
    expect(s.channels.map((c) => c.ch)).toEqual([1, 3])
  })
})

// ── Der Vergleich zweier Uploads ───────────────────────────────────────────

describe('diffScenes — die Änderungsliste aus der Probe', () => {
  const a = parseSceneFile(SZENE)

  it('meldet einen umbenannten Kanal', () => {
    const b = parseSceneFile(SZENE.replace('"Bass DI"', '"Bass Amp"'))
    const d = diffScenes(a, b)
    expect(d).toEqual([{ ch: 3, kind: 'renamed', before: 'Bass DI', after: 'Bass Amp' }])
  })

  it('meldet einen neu beschrifteten Kanal', () => {
    const b = parseSceneFile(SZENE.replace('/ch/04/config ""', '/ch/04/config "Toms"'))
    expect(diffScenes(a, b)[0]).toMatchObject({ ch: 4, kind: 'added', after: 'Toms' })
  })

  it('meldet eine entfernte Beschriftung', () => {
    const b = parseSceneFile(SZENE.replace('"Vox Lead"', '""'))
    expect(diffScenes(a, b)[0]).toMatchObject({ ch: 5, kind: 'removed', before: 'Vox Lead' })
  })

  it('meldet eine Farbänderung bei gleichem Namen', () => {
    // Die Farbe ist am Pult die Gruppierung. Ein Kanal, der von Rot nach Gelb
    // gewandert ist, ist von den Drums zu den Vocals umgezogen — auf einem
    // Blatt, das nur Namen vergleicht, ist das unsichtbar.
    const b = parseSceneFile(SZENE.replace('"Snare" 2 RD 2', '"Snare" 2 YE 2'))
    expect(diffScenes(a, b)).toEqual([
      { ch: 2, kind: 'recolored', before: 'Snare', after: 'Snare', beforeColor: 'RD', afterColor: 'YE' },
    ])
  })

  it('lässt beidseitig unbeschriftete Kanäle WEG', () => {
    // Bei 32 oder 48 Kanaelen waeren das die meisten Zeilen, und eine
    // Aenderungsliste, in der fast nichts eine Aenderung ist, wird nicht
    // gelesen.
    expect(diffScenes(a, a)).toEqual([])
  })

  it('gibt jeder Änderungsart eine Beschriftung', () => {
    for (const k of Object.keys(SCENE_DIFF_LABEL)) {
      expect(SCENE_DIFF_LABEL[k as never]).toBeTruthy()
    }
  })
})

// ── Die Zuordnung zum Plan ─────────────────────────────────────────────────

describe('matchToPlan — die Nummer ist keine Gleichung', () => {
  const scene = parseSceneFile(SZENE)
  const plan = [
    { ch: 1, source: 'Bass DI' },
    { ch: 2, source: 'Kick' },
  ]

  it('ordnet über den Namen zu — eine Beobachtung', () => {
    const m = matchToPlan(scene, plan, 'by-name')
    expect(m.find((x) => x.sceneCh === 1)?.planCh).toBe(2)
    expect(m.find((x) => x.sceneCh === 3)?.planCh).toBe(1)
  })

  it('ordnet über die Nummer NUR auf Ansage zu', () => {
    // Ein Pult zaehlt seine Eingaenge, der Plan zaehlt seine Kabel, und beide
    // beginnen bei 1. Ueber die Nummer ist die Zuordnung eine Behauptung ueber
    // die Verkabelung.
    const m = matchToPlan(scene, plan, 'by-number')
    expect(m.find((x) => x.sceneCh === 1)?.planCh).toBe(1)
    expect(m.find((x) => x.sceneCh === 1)?.planSource).toBe('Bass DI')
  })

  it('lässt unzugeordnet, was sich nicht findet', () => {
    const m = matchToPlan(scene, plan, 'by-name')
    const vox = m.find((x) => x.sceneCh === 5)
    expect(vox?.planCh).toBeUndefined()
    expect(vox?.planSource).toBeUndefined()
  })

  it('ignoriert Gross-/Kleinschreibung und Mehrfach-Leerzeichen', () => {
    const s = parseSceneFile('/ch/01/config "  bass   di " 1 RD 1\n')
    expect(matchToPlan(s, plan, 'by-name')[0].planCh).toBe(1)
  })

  it('lässt bei zwei gleichnamigen Plan-Kanälen den ERSTEN gewinnen', () => {
    const doppelt = [
      { ch: 7, source: 'SM58' },
      { ch: 9, source: 'SM58' },
    ]
    const s = parseSceneFile('/ch/01/config "SM58" 1 RD 1\n')
    expect(matchToPlan(s, doppelt, 'by-name')[0].planCh).toBe(7)
  })
})

// ── Die Blätter ────────────────────────────────────────────────────────────

describe('die Blätter', () => {
  it('geben jeder leeren Zelle einen NAMEN', () => {
    const t = sceneTable(parseSceneFile('/ch/04/config "" 1 OFF 4\n'))
    const zeile = t.rows[0].map(String)
    expect(zeile).toContain('unbeschriftet')
    expect(zeile).toContain('keine Farbe')
    expect(zeile).toContain('nicht angegeben')
    expect(zeile.every((z) => z.trim() !== '')).toBe(true)
  })

  it('nennen eine fehlende Zuordnung beim Namen', () => {
    const m = matchToPlan(parseSceneFile('/ch/01/config "Kick" 1 RD 1\n'), [], 'by-name')
    const zeile = matchTable(m).rows[0].map(String)
    expect(zeile).toContain('nicht zugeordnet')
    expect(zeile).toContain('nicht im Plan')
  })

  it('zeigen bei einer Farbänderung die FARBEN, nicht zweimal denselben Namen', () => {
    const a = parseSceneFile('/ch/01/config "Kick" 1 RD 1\n')
    const b = parseSceneFile('/ch/01/config "Kick" 1 YE 1\n')
    const zeile = sceneDiffTable(diffScenes(a, b)).rows[0].map(String)
    expect(zeile).toContain('RD')
    expect(zeile).toContain('YE')
  })

  it('tragen kanonisches Deutsch', () => {
    expect(libQuelle).not.toContain("t('")
  })
})

// ── Die Grenzen ────────────────────────────────────────────────────────────

describe('ein Leser, kein Schreiber', () => {
  it('erzeugt keine Szenendatei und schickt nichts ans Pult', () => {
    expect(libQuelle).not.toMatch(/fetch\(|WebSocket|osc|udp|\/ch\/\$\{/i)
    expect(typenQuelle).toMatch(/Ein LESER, kein Schreiber/)
  })

  it('bietet den Vergleich erst an, wenn zwei Stände vorliegen', () => {
    expect(dialogQuelle).toMatch(/szeneA && szeneB \? diffScenes\(szeneA, szeneB\) : \[\]/)
  })

  it('sagt ausdrücklich, wenn sich nichts geändert hat', () => {
    // Ein leerer Block läse sich als „noch nicht verglichen".
    expect(dialogQuelle).toMatch(/szeneB && szeneDiff\.length === 0 && \(/)
    expect(dialogQuelle).toMatch(/scene\.noChange/)
  })

  it('behält den ERSTEN Import als Bezugsstand', () => {
    expect(dialogQuelle).toMatch(/if \(!szeneA\) setSzeneA\(gelesen\)\s*\n?\s*else setSzeneB\(gelesen\)/)
  })

  it('leert das Dateifeld, damit dieselbe Datei zweimal gewählt werden kann', () => {
    expect(dialogQuelle).toMatch(/e\.target\.value = ''/)
  })

  it('zeigt die Zahl der unlesbaren Zeilen an', () => {
    expect(dialogQuelle).toMatch(/szeneAktuell\.unreadable > 0 && \(/)
  })
})
