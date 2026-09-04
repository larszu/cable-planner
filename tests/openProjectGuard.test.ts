import { describe, expect, it } from 'vitest'
import { looksLikeProject } from '../src/renderer/lib/looksLikeProject'
import { useProjectStore } from '../src/renderer/store/projectStore'
import type { CablePlannerProject } from '../src/renderer/types/project'
import hookSrc from '../src/renderer/hooks/useProject.ts?raw'

// Eine Datei, die gueltiges JSON ist, aber kein Projekt, liess den Renderer
// abstuerzen: `healProjectPositions` greift ungeschuetzt auf `equipment` und
// `cables` zu. Der Autosave-Pfad prueft das seit laengerem und nennt den
// Absturz im eigenen Kommentar -- die Datei-Tuer hatte dieselbe Pruefung nicht.
//
// Diese Datei haelt beide Haelften fest: dass der Store ohne Pruefung wirklich
// wirft (sonst wuerde die Pruefung etwas Erfundenes abwehren), und dass die
// Tuer sie hat.

const bad: Array<[string, unknown]> = [
  ['fehlendes equipment', { metadata: { name: 'x' }, cables: [] }],
  ['fehlende cables', { metadata: { name: 'x' }, equipment: [] }],
  ['fehlende metadata', { equipment: [], cables: [] }],
  ['equipment ist kein Array', { metadata: {}, equipment: {}, cables: [] }],
  ['leeres Objekt', {}],
  ['null', null],
  ['eine Zahl', 42],
  ['ein Array', []],
]

describe('looksLikeProject', () => {
  for (const [name, value] of bad) {
    it(`weist ab: ${name}`, () => expect(looksLikeProject(value)).toBe(false))
  }

  it('laesst ein mageres, aber echtes Projekt durch', () => {
    // Bewusst schwach: die Pruefung soll den Fehlgriff abfangen, nicht das
    // Schema validieren. Ein altes Projekt ohne neuere Felder muss laden.
    expect(looksLikeProject({ metadata: { name: 'A' }, equipment: [], cables: [] })).toBe(true)
  })
})

describe('der Schaden, den die Pruefung abwehrt, ist echt', () => {
  it('loadProject wirft bei fehlendem equipment', () => {
    // Faellt dieser Test, weil nichts mehr wirft, ist die Pruefung an der Tuer
    // vielleicht ueberfluessig geworden -- dann hier nachsehen, nicht einfach
    // den Test streichen.
    const fremd = { metadata: { name: 'x' }, cables: [] } as unknown as CablePlannerProject
    expect(() => useProjectStore.getState().loadProject(fremd, '/tmp/x.cableplan')).toThrow(
      /Cannot read properties of undefined/,
    )
  })
})

describe('die Tuer selbst', () => {
  it('der gemeinsame Oeffnen-Pfad prueft, bevor er laedt', () => {
    // Quelltext-Guard: `applyOpenedProject` ist der einzige Loader fuer Dialog,
    // Kaltstart-Doppelklick und Doppelklick bei laufender App. Verschwindet die
    // Pruefung dort, faellt dieser Test -- nicht erst ein Nutzer.
    expect(hookSrc).toContain('looksLikeProject(result.data)')
    const i = hookSrc.indexOf('looksLikeProject(result.data)')
    const j = hookSrc.indexOf('loadProject(incoming, result.filePath)')
    expect(i).toBeGreaterThan(0)
    expect(j).toBeGreaterThan(i)
  })
})
