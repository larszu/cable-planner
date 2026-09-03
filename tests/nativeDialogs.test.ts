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

const nativeCalls = (): string[] => {
  const hits: string[] = []
  for (const [path, src] of Object.entries(sources)) {
    if (ERSATZ.test(path)) continue
    const code = stripComments(src)
    for (const m of code.matchAll(/window\.(confirm|alert|prompt)\s*\(/g)) {
      const line = code.slice(0, m.index).split('\n').length
      hits.push(`${path.replace('../', '')}:${line} — window.${m[1]}()`)
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
