import { describe, expect, it } from 'vitest'
import { stripComments } from './support/stripComments'

// Punkt 41 des UX-Audits: „keine nativen confirm/alert/prompt mehr in
// Komponenten". Der Punkt stand als erledigt abgehakt — und war es nicht:
// `CollabPanel.onJoin` fragte weiter per `window.confirm`, ausgerechnet vor
// der Aktion, die den lokalen Plan ersetzt.
//
// Eine abgehakte Zeile in einem Dokument ist der Kenntnisstand ihres Autors.
// Dieser Test ist der Zustand des Programms: er rechnet die Stellen aus dem
// Quelltext, statt sie aufzuzaehlen, und nennt jede neue namentlich.
//
// Warum ueberhaupt: die drei Ersatz-Dialoge sind nicht bloss huebscher. Sie
// tragen ein Theme, Fokus-Fallen und Tastatur-Bedienung, sie koennen einen
// destruktiven Knopf rot faerben -- und `window.prompt` ist in Electron
// wirkungslos (gibt kommentarlos null zurueck).

const sources = import.meta.glob('../src/renderer/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Die drei Ersatz-Dialoge selbst duerfen die nativen Namen nennen. */
const ERSATZ = /\/lib\/(confirmDialog|infoDialog|promptDialog)\.tsx$/

/**
 * Beide Schreibweisen, und das ist der Punkt.
 *
 * Die erste Fassung dieses Tests suchte nur `window.alert(`. Sie meldete
 * daraufhin null Treffer, waehrend drei rohe `alert(`-Aufrufe im selben
 * durchsuchten Baum standen (`BulkConnectDialog`, `RackBuilderDialogExportMenu`
 * zweimal). `window.` ist optional -- die globalen Funktionen heissen einfach
 * `alert`, `confirm`, `prompt`, und so werden sie ueblicherweise auch
 * geschrieben.
 *
 * Ein Guard, der die haeufigere Schreibweise nicht kennt, ist schlimmer als
 * keiner: er beantwortet die Frage mit „nein" statt mit „weiss ich nicht".
 * Gefunden hat das nicht dieser Test, sondern ein Durchlauf, der Suite- und
 * Upstream-Fassungen verglich -- die Suite hatte die drei Stellen laengst
 * ersetzt.
 *
 * `[^.\w$]` davor schliesst Eigenschaftszugriffe (`foo.alert(`) und laengere
 * Bezeichner (`confirmDialog(`, `onConfirm(`) aus; das optionale `window.`
 * holt die qualifizierte Schreibweise wieder herein. Beim Reparieren hatte ich
 * genau die verloren -- eine Blindstelle gegen die andere getauscht. Der
 * Gegentest unten faehrt deshalb alle vier Formen durch.
 */
const NATIVE_CALL = /(^|[^.\w$])(?:window\.)?(confirm|alert|prompt)\s*\(/g

const nativeCalls = (): string[] => {
  const hits: string[] = []
  for (const [path, src] of Object.entries(sources)) {
    if (ERSATZ.test(path)) continue
    const code = stripComments(src)
    for (const m of code.matchAll(NATIVE_CALL)) {
      const line = code.slice(0, m.index).split('\n').length
      hits.push(`${path.replace('../', '')}:${line} — ${m[2]}()`)
    }
  }
  return hits.sort()
}

describe('native Browser-Dialoge im Renderer', () => {
  it('findet ueberhaupt Quelltext (sonst prueft der Test nichts)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200)
  })

  it('keine Komponente ruft window.confirm/alert/prompt auf', () => {
    expect(nativeCalls()).toEqual([])
  })

  it('die Ersatz-Dialoge sind vorhanden', () => {
    for (const name of ['confirmDialog', 'infoDialog', 'promptDialog']) {
      expect(
        Object.keys(sources).some((p) => p.endsWith(`/lib/${name}.tsx`)),
        `${name} fehlt`,
      ).toBe(true)
    }
  })
})
