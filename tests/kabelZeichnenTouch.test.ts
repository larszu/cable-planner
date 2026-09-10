import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { useUiStore } from '../src/renderer/store/uiStore'

// ---------------------------------------------------------------------------
// #834 — „Auf touch Oberfläche gibt es keine Möglichkeit die Kabel Linie mit
// Klicks zu zeichnen zu beenden" (Meldung des Eigentümers, 2026-09-10).
//
// GEMESSEN, bevor gebaut wurde. Wer eine Kabellinie anfing, kam auf genau
// zwei Wegen wieder heraus:
//
//   1. einen zweiten Port antippen — legt ein Kabel an, das man
//      möglicherweise gar nicht wollte
//   2. Escape drücken — auf einem Tablet gibt es diese Taste nicht
//
// Das Band oben am Bild nannte ausdrücklich nur den zweiten Weg („Esc zum
// Abbrechen") und stand auf `pointerEvents: 'none'` — es war Text, kein
// Bedienelement. Dazu hörte die gestrichelte Vorschau auf `mousemove`, das
// ein Finger nicht auslöst: die Linie klebte am Startpunkt.
//
// Dieselbe Lehre wie B-44 Teil 2: ein Weg, den nur eine Taste öffnet, ist für
// den halben Saal zu. Die beiden Knöpfe stehen deshalb für ALLE da.
// ---------------------------------------------------------------------------

const RENDERER = resolve(__dirname, '..', 'src', 'renderer')
const lies = (...pfad: string[]) => readFileSync(join(RENDERER, ...pfad), 'utf8')

describe('Einen gesetzten Knick wieder loswerden', () => {
  const start = { nodeId: 'geraet-1', handleId: 'port-1', handleType: 'source' as const }

  it('nimmt den letzten Knick zurück und lässt die übrigen stehen', () => {
    const s = useUiStore.getState()
    s.startPendingCable(start)
    s.addPendingWaypoint({ x: 10, y: 10 })
    s.addPendingWaypoint({ x: 20, y: 20 })
    useUiStore.getState().removeLastPendingWaypoint()
    expect(useUiStore.getState().pendingCable?.waypoints).toEqual([{ x: 10, y: 10 }])
  })

  it('bricht die Linie NICHT ab, wenn kein Knick mehr da ist', () => {
    // DIE GEGENPROBE. Ein „Zurück", das beim letzten Druck die ganze Linie
    // wegwirft, bestraft genau den Griff, der eine Fehleingabe berichtigen
    // sollte — und auf einem Touchscreen ist die Fehleingabe der Normalfall.
    const s = useUiStore.getState()
    s.startPendingCable(start)
    useUiStore.getState().removeLastPendingWaypoint()
    expect(useUiStore.getState().pendingCable).not.toBeNull()
    expect(useUiStore.getState().pendingCable?.waypoints).toEqual([])
  })

  it('tut nichts, wenn gar keine Linie läuft', () => {
    useUiStore.getState().clearPendingCable()
    useUiStore.getState().removeLastPendingWaypoint()
    expect(useUiStore.getState().pendingCable).toBeNull()
  })

  it('lässt Start-Port und Richtung unangetastet', () => {
    const s = useUiStore.getState()
    s.startPendingCable(start)
    s.addPendingWaypoint({ x: 1, y: 1 })
    useUiStore.getState().removeLastPendingWaypoint()
    const p = useUiStore.getState().pendingCable
    expect(p?.nodeId).toBe('geraet-1')
    expect(p?.handleId).toBe('port-1')
    expect(p?.handleType).toBe('source')
  })
})

describe('Das Band ist ein Bedienelement und kein Aushang', () => {
  const src = lies('components', 'Canvas', 'PendingCableOverlay.tsx')
  // Ohne Kommentare geprüft: der Kopf dieser Datei nennt `pointermove` und
  // „Esc" wörtlich, und ein Wächter, der seinen eigenen Kommentar findet, ist
  // keiner — dieselbe Falle wie in `touchErreichbar.test.ts`.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('trägt einen Abbrechen-Knopf', () => {
    expect(code).toMatch(/onClick=\{\(\) => clearPendingCable\(\)\}/)
  })

  it('trägt einen Knopf, der den letzten Knick zurücknimmt', () => {
    expect(code).toMatch(/onClick=\{\(\) => removeLastPendingWaypoint\(\)\}/)
  })

  it('nimmt Zeiger-Ereignisse an — sonst wären die Knöpfe Bilder', () => {
    expect(code).toMatch(/pointerEvents: 'auto'/)
  })

  it('die Knöpfe sind fingergroß (WCAG 2.5.5)', () => {
    expect(code).toMatch(/minHeight: 44/)
  })
})

describe('Die Vorschau folgt auch einem Finger', () => {
  it('das Overlay hört auf `pointermove` statt nur auf `mousemove`', () => {
    // `pointermove` deckt Maus, Finger und Stift mit einem Ereignis ab.
    // Blieb es bei `mousemove`, stand die gestrichelte Linie auf einem
    // Touchscreen still — sie zeigte dann eine Strecke, die es nicht gab.
    const code = lies('components', 'Canvas', 'PendingCableOverlay.tsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(code).not.toMatch(/addEventListener\('mousemove'/)
    expect(code.match(/addEventListener\('pointermove'/g)?.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Die allgemeine Form dieses Fehlers: ein Zustand, aus dem nur eine TASTE
// herausführt. Der Wächter zählt sie, damit der nächste nicht dieselbe Falle
// baut.
// ---------------------------------------------------------------------------

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const voll = join(dir, eintrag)
    return statSync(voll).isDirectory()
      ? dateien(voll)
      : /\.tsx$/.test(eintrag)
        ? [voll]
        : []
  })

describe('Kein Zustand, den nur Escape verlässt', () => {
  /**
   * Was als zweiter Weg zählt: irgendein Klick-Ziel in derselben Datei, das
   * denselben Zustand räumt. Wie es aussieht, entscheidet die Stelle — ein
   * Knopf, ein Kreuz, ein Klick auf den Hintergrund.
   */
  const ZWEITE_WEGE = ['onClick', 'useBackdropClose', 'onPointerDown', 'backdropMouseDown']

  // `backdropMouseDown` steht mit in der Liste, weil `lib/modalRoot.tsx` ein
  // HILFSMODUL ist: es traegt beide Wege nebeneinander (`useModalKeyboard` und
  // den Klick auf den Hintergrund) und bindet selbst kein `onClick`. Die erste
  // Fassung dieses Waechters meldete es deshalb — und haette jemanden dazu
  // gebracht, einen dritten Weg zu bauen, den es schon gibt.

  it('jede Escape-Rückgängigmachung hat einen Weg ohne Tastatur', () => {
    const nurEscape = dateien(RENDERER)
      .map((f) => ({ datei: relative(RENDERER, f).split(sep).join('/'), text: readFileSync(f, 'utf8') }))
      .filter((q) => /key === 'Escape'/.test(q.text))
      .filter((q) => !ZWEITE_WEGE.some((w) => q.text.includes(w)))
      .map((q) => q.datei)
    expect(
      nurEscape,
      'Diese Dateien lassen einen Zustand nur über die Escape-Taste verlassen. ' +
        'Auf einem Tablet gibt es diese Taste nicht — einen sichtbaren Weg daneben stellen.',
    ).toEqual([])
  })
})
