import { describe, expect, it } from 'vitest'
import {
  allDeltas,
  audioMatrixAssignments,
  compareAssignments,
  hasDifference,
  mvAssignments,
} from '../src/renderer/lib/atemLiveCompare'
import { stripComments } from './support/stripComments'
import audioDialogSrc from '../src/renderer/components/Atem/AtemAudioRouterDialog.tsx?raw'
import mvDialogSrc from '../src/renderer/components/Atem/AtemMvConfigDialog.tsx?raw'
import videohubDialogSrc from '../src/renderer/components/Export/VideohubExportDialog.tsx?raw'

// ---------------------------------------------------------------------------
// Initiative 10 — Confirmed-State-Disziplin.
//
// Der Marktbefund, den ADR-003 traegt, kommt aus fuenf Segmenten und lautet
// jedes Mal gleich: *„read the device's real state, do not just display the
// last command sent."* Die Umkehrung ist genauso schaedlich und war hier
// gebaut: den abgelesenen Zustand still zur Absicht machen. Danach ist die
// Absicht weg — und der Plan behauptet, jemand haette genau das geplant, was
// die Maschine ohnehin gerade tut.
// ---------------------------------------------------------------------------

const A = (key: string, sourceId: number, label = key) => ({ key, label, sourceId })

describe('compareAssignments', () => {
  it('trennt Abweichung, Nur-Plan und Nur-Geraet', () => {
    const c = compareAssignments(
      [A('out:1', 10), A('out:2', 20), A('out:3', 30)],
      [A('out:1', 10), A('out:2', 99), A('out:4', 40)],
    )
    expect(c.agreeing).toBe(1)
    expect(c.deltas).toEqual([
      { key: 'out:2', label: 'out:2', planned: 20, confirmed: 99 },
    ])
    expect(c.onlyPlanned).toEqual([{ key: 'out:3', label: 'out:3', planned: 30 }])
    expect(c.onlyConfirmed).toEqual([{ key: 'out:4', label: 'out:4', confirmed: 40 }])
    expect(allDeltas(c)).toHaveLength(3)
    expect(hasDifference(c)).toBe(true)
  })

  it('meldet Gleichstand als Gleichstand', () => {
    const c = compareAssignments([A('out:1', 10)], [A('out:1', 10)])
    expect(hasDifference(c)).toBe(false)
    expect(c.agreeing).toBe(1)
  })

  it('unterscheidet „geplant auf 0" von „nicht gemeldet"', () => {
    // Der Unterschied, der die ganze Initiative traegt. `sourceId: 0` heisst
    // „No Audio" — eine Aussage. Ein fehlender Schluessel heisst, das Geraet
    // hat dazu nichts gesagt. Beides als dasselbe zu fuehren waere genau die
    // erfundene Bestaetigung, gegen die ADR-003 geschrieben ist.
    const gemeldet = compareAssignments([A('out:1', 5)], [A('out:1', 0)])
    expect(gemeldet.deltas[0]).toEqual({
      key: 'out:1',
      label: 'out:1',
      planned: 5,
      confirmed: 0,
    })
    const geschwiegen = compareAssignments([A('out:1', 5)], [])
    expect(geschwiegen.deltas).toEqual([])
    expect(geschwiegen.onlyPlanned[0]).toEqual({
      key: 'out:1',
      label: 'out:1',
      planned: 5,
    })
    expect(geschwiegen.onlyPlanned[0].confirmed).toBeUndefined()
  })

  it('nimmt bei Abweichung den Namen des Geraets, wenn es einen hat', () => {
    const c = compareAssignments([A('out:1', 5, 'Out 1')], [A('out:1', 6, 'Monitor Regie')])
    expect(c.deltas[0].label).toBe('Monitor Regie')
    const leer = compareAssignments([A('out:1', 5, 'Out 1')], [A('out:1', 6, '')])
    expect(leer.deltas[0].label).toBe('Out 1')
  })
})

describe('audioMatrixAssignments', () => {
  it('macht aus jedem Output eine Zuweisung', () => {
    const a = audioMatrixAssignments({
      sources: [],
      outputs: [
        { id: 1, sourceId: 10010, name: 'Out 1 (Program)' },
        { id: 2, sourceId: 0, name: '' },
      ],
    })
    expect(a).toEqual([
      { key: 'out:1', label: 'Out 1 (Program)', sourceId: 10010 },
      { key: 'out:2', label: 'Out 2', sourceId: 0 },
    ])
  })

  it('vertraegt eine fehlende Matrix', () => {
    expect(audioMatrixAssignments(undefined)).toEqual([])
  })
})

describe('mvAssignments', () => {
  it('haelt gleichnamige Fenster verschiedener MV auseinander', () => {
    // Die Drift, gegen die der Schluessel den MV-Index traegt: Fenster 3 auf
    // MV 1 und Fenster 3 auf MV 2 sind verschiedene Ziele. Ohne den Index
    // ueberschriebe das eine still das andere — und die Differenz zeigte
    // eine Abweichung statt zweien.
    const zwei = [
      { index: 0, layout: 0, windows: [{ windowIndex: 3, sourceId: 1 }] },
      { index: 1, layout: 0, windows: [{ windowIndex: 3, sourceId: 2 }] },
    ]
    expect(mvAssignments(zwei).map((a) => a.key)).toEqual([
      'mv:0:win:3',
      'mv:1:win:3',
    ])
    const c = compareAssignments(
      mvAssignments(zwei),
      mvAssignments([
        { index: 0, layout: 0, windows: [{ windowIndex: 3, sourceId: 9 }] },
        { index: 1, layout: 0, windows: [{ windowIndex: 3, sourceId: 8 }] },
      ]),
    )
    expect(c.deltas).toHaveLength(2)
  })

  it('vertraegt einen MV ohne Fenster', () => {
    expect(mvAssignments([{ index: 0, layout: 0, windows: [] }])).toEqual([])
    expect(mvAssignments(undefined)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Der eigentliche Guard: die Lese-Knoepfe duerfen den Plan nicht anfassen.
//
// Die Bibliothek oben kann man richtig bauen und trotzdem nebenan wieder
// `setDraft(merged)` schreiben — genau so ist der Fehler entstanden. Deshalb
// wird die Stelle selbst geprueft, nicht nur ihr Werkzeug.
// ---------------------------------------------------------------------------

/**
 * Den Rumpf einer `const name = async () => { … }`-Funktion herausschneiden —
 * ohne Kommentare.
 *
 * Die Kommentar-Entfernung ist nicht Kosmetik, sondern der Kern: die
 * geheilten Stellen nennen in ihrem Kommentar ausdruecklich, was dort frueher
 * stand („hier stand `setDraft(merged)`"). Beim ersten Lauf sind alle drei
 * Guards genau daran gescheitert. Den Kommentar zu entschaerfen haette den
 * Test gruen gemacht und die Begruendung geloescht.
 */
export const functionBody = (src: string, name: string): string => {
  src = stripComments(src)
  const head = src.indexOf(`const ${name} = `)
  if (head === -1) throw new Error(`${name} nicht gefunden`)
  const start = src.indexOf('{', head)
  if (start === -1) throw new Error(`${name} hat keinen Rumpf`)
  let depth = 0
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  throw new Error(`${name} ist nicht geschlossen`)
}

describe('die Lese-Knoepfe legen ab, statt zu ueberschreiben', () => {
  it('der Audio-Dialog schreibt beim Lesen nicht in den Entwurf', () => {
    const body = functionBody(audioDialogSrc, 'handleReadFromAtem')
    expect(body).toContain('setLive(')
    expect(body).not.toContain('setDraft(')
  })

  it('der MV-Dialog schreibt beim Lesen nicht in die Konfiguration', () => {
    const body = functionBody(mvDialogSrc, 'handleReadFromAtem')
    expect(body).toContain('setLive(')
    expect(body).not.toContain('setConfig(')
  })

  it('die Uebernahme gibt es weiter — sie ist nur ein eigener Klick', () => {
    // Ohne diese Haelfte waere der Guard oben auch dann gruen, wenn jemand
    // die Uebernahme ersatzlos entfernt haette. Ein Lesen ohne jede
    // Uebernahme-Moeglichkeit ist keine Loesung, sondern ein Funktionsverlust.
    expect(functionBody(audioDialogSrc, 'handleAdoptLive')).toContain('setDraft(')
    expect(functionBody(mvDialogSrc, 'adoptLive')).toContain('setConfig(')
    // Und beide fragen vorher.
    expect(functionBody(audioDialogSrc, 'handleAdoptLive')).toContain('confirmDialog(')
    expect(functionBody(mvDialogSrc, 'adoptLive')).toContain('confirmDialog(')
  })

  it('der Videohub-Dialog bleibt die dritte geheilte Stelle', () => {
    // Inkrement 0 hat sie geheilt und die Begruendung dort hinterlassen.
    // Wer sie zurueckbaut, kommt hier vorbei.
    const body = functionBody(videohubDialogSrc, 'handleReadState')
    expect(body).toContain('setHubState(')
    expect(body).not.toContain('setRouting(')
  })

  it('liest Code, nicht Prosa', () => {
    // Die Gegenprobe zur Kommentar-Entfernung: ein Kommentar, der den alten
    // Aufruf beim Namen nennt, darf den Guard NICHT ausloesen — und ein
    // gleichlautender String im Code auch nicht verschwinden.
    const mitKommentar = `
      const leser = async () => {
        // Hier stand setDraft(merged) — Initiative 10.
        /* und hier auch: setDraft(x) */
        setLive(await read())
        log('setLive gerufen')
      }
    `
    const body = functionBody(mitKommentar, 'leser')
    expect(body).toContain('setLive(')
    expect(body).not.toContain('setDraft(')
    expect(body).toContain("log('setLive gerufen')")
  })

  it('der Guard schlaegt an, wenn die Drift zurueckkommt', () => {
    // Gegenprobe: der Rumpf-Schneider muss den alten Zustand wirklich
    // erkennen, sonst waeren die vier Tests oben nur gruene Deko.
    const zurueckgebaut = `
      const handleReadFromAtem = async () => {
        const live = await read()
        const merged = { ...draft, matrix: live.matrix ?? draft?.matrix }
        setDraft(merged)
      }
    `
    expect(functionBody(zurueckgebaut, 'handleReadFromAtem')).toContain('setDraft(')
  })

  it('der Rumpf-Schneider hoert am Ende der Funktion auf', () => {
    // Sonst fiele der Guard auf ein `setDraft(` herein, das erst hinter der
    // Funktion steht — und meldete einen Fehler, den es nicht gibt.
    const zwei = `
      const erste = async () => {
        if (x) { setLive(1) }
      }
      const zweite = () => { setDraft(2) }
    `
    const body = functionBody(zwei, 'erste')
    expect(body).toContain('setLive(')
    expect(body).not.toContain('setDraft(')
  })
})
