import { describe, expect, it } from 'vitest'
import {
  EMPTY_LIVE,
  LIVE_STALE_AFTER_MS,
  edgeFlow,
  liveFreshness,
  tallyChain,
  tallyOf,
  type LiveSnapshot,
} from '../src/renderer/lib/signalAnimation'

// ───────────────────────────────────────────────────────────────────────────
// Der animierte Signalfluss im Canvas (Eigentümer-Entscheidung 2026-09-08).
//
// DIE ZUSICHERUNG, die hier hängt, ist eine einzige, und sie ist die
// Bedingung, unter der die Animation überhaupt gebaut werden durfte:
//
//   Der Canvas behauptet nie einen Anlagenzustand, für den es keinen
//   frischen Beleg gibt.
//
// Eine laufende Animation IST eine Behauptung. Niemand liest daneben eine
// Zahl, niemand klickt ein Warndreieck weg — man sieht, dass es fließt, und
// glaubt es. Das ist ADR-003 an dieser Stelle, und es ist die Auflage aus
// E-23 („do NOT build a live monitoring dashboard").
//
// Die Zusicherung zerfällt in vier Fälle, und der dritte ist der, den man
// beim Bauen übersieht:
//
//   1. kein Kontakt         → Schema
//   2. Kontakt zu alt       → Schema
//   3. Kontakt frisch, aber über DIESE Strecke nichts bekannt → Schema
//      (nicht „aus"! Das wäre eine Aussage über ein ungemessenes Kabel)
//   4. Meldung frisch       → der gemeldete Zustand
// ───────────────────────────────────────────────────────────────────────────

const JETZT = 1_000_000

const snap = (over: Partial<LiveSnapshot> = {}): LiveSnapshot => ({
  links: [],
  tally: [],
  lastContactAt: JETZT,
  ...over,
})

const kabel = { id: 'c1', bidirectional: false }
const opts = { motion: true }

describe('Betriebsart — gilt Live?', () => {
  it('ohne Kontakt gilt Live nicht, und das Alter ist unbekannt', () => {
    expect(liveFreshness(EMPTY_LIVE, JETZT)).toEqual({ live: false, ageMs: null })
    expect(liveFreshness(null, JETZT)).toEqual({ live: false, ageMs: null })
  })

  it('frischer Kontakt gilt, alter nicht — und das Alter steht in beiden Fällen da', () => {
    expect(liveFreshness(snap(), JETZT)).toEqual({ live: true, ageMs: 0 })
    const knapp = liveFreshness(snap({ lastContactAt: JETZT - LIVE_STALE_AFTER_MS }), JETZT)
    expect(knapp.live).toBe(true)
    const drueber = liveFreshness(snap({ lastContactAt: JETZT - LIVE_STALE_AFTER_MS - 1 }), JETZT)
    expect(drueber).toEqual({ live: false, ageMs: LIVE_STALE_AFTER_MS + 1 })
  })

  it('rechnet ein Alter nie negativ', () => {
    // Uhren laufen auseinander. Eine negative Zahl in der Anzeige („vor -3 s")
    // sieht aus wie ein Fehler der App und schickt die Suche in die falsche
    // Richtung.
    expect(liveFreshness(snap({ lastContactAt: JETZT + 5000 }), JETZT).ageMs).toBe(0)
  })
})

describe('Kante — die vier Fälle', () => {
  it('1. ohne Kontakt: Schema', () => {
    const f = edgeFlow(kabel, EMPTY_LIVE, JETZT, opts)
    expect(f.kind).toBe('schema')
    expect(f.ageMs).toBeNull()
  })

  it('2. Kontakt zu alt: Schema, auch wenn eine Meldung dasteht', () => {
    const f = edgeFlow(
      kabel,
      snap({
        lastContactAt: JETZT - 60_000,
        links: [{ cableId: 'c1', state: 'carrying', at: JETZT - 60_000, source: 'atem' }],
      }),
      JETZT,
      opts,
    )
    expect(f.kind).toBe('schema')
  })

  it('3. Kontakt frisch, diese Strecke unbekannt: Schema — NICHT „aus"', () => {
    // Der Fall, den man beim Bauen übersieht. Eine Kante als tot zu zeichnen,
    // weil niemand sie gemessen hat, ist genau die Falschaussage, gegen die
    // die ganze Konstruktion steht.
    const f = edgeFlow(kabel, snap({ links: [] }), JETZT, opts)
    expect(f.kind).toBe('schema')
    expect(f.dimmed).toBe(false)
  })

  it('3b. auch eine EINZELNE veraltete Meldung fällt aufs Schema zurück', () => {
    const f = edgeFlow(
      kabel,
      snap({ links: [{ cableId: 'c1', state: 'down', at: JETZT - 60_000, source: 'videohub' }] }),
      JETZT,
      opts,
    )
    expect(f.kind).toBe('schema')
    expect(f.dimmed).toBe(false)
  })

  it('4. frische Meldung: der gemeldete Zustand, mit Alter und Quelle', () => {
    const f = edgeFlow(
      kabel,
      snap({ links: [{ cableId: 'c1', state: 'carrying', at: JETZT - 200, source: 'atem' }] }),
      JETZT,
      opts,
    )
    expect(f.kind).toBe('live-carrying')
    expect(f.animate).toBe(true)
    expect(f.ageMs).toBe(200)
    expect(f.source).toBe('atem')
  })
})

describe('Was Bewegung bedeutet', () => {
  it('„steht, fließt nicht" bewegt sich NICHT', () => {
    // Sonst hiesse Bewegung zweierlei, und das Bild ist nur noch Dekoration.
    const f = edgeFlow(
      kabel,
      snap({ links: [{ cableId: 'c1', state: 'idle', at: JETZT, source: 'videohub' }] }),
      JETZT,
      opts,
    )
    expect(f.kind).toBe('live-idle')
    expect(f.animate).toBe(false)
    expect(f.dimmed).toBe(false)
  })

  it('„keine Verbindung" wird gedämpft, nicht nur stillgestellt', () => {
    // „Vorhanden, aber tot" muss sich von „vorhanden" unterscheiden, und
    // Stillstand allein ist dafür zu leise.
    const f = edgeFlow(
      kabel,
      snap({ links: [{ cableId: 'c1', state: 'down', at: JETZT, source: 'videohub' }] }),
      JETZT,
      opts,
    )
    expect(f.kind).toBe('live-down')
    expect(f.animate).toBe(false)
    expect(f.dimmed).toBe(true)
  })

  it('ohne Bewegungs-Erlaubnis animiert nichts — auch nicht Live', () => {
    // `prefers-reduced-motion` und der Schalter in den Einstellungen. Die
    // AUSSAGE bleibt: `kind` ist weiter `live-carrying`, nur ohne Bewegung.
    const f = edgeFlow(
      kabel,
      snap({ links: [{ cableId: 'c1', state: 'carrying', at: JETZT, source: 'atem' }] }),
      JETZT,
      { motion: false },
    )
    expect(f.kind).toBe('live-carrying')
    expect(f.animate).toBe(false)
  })

  it('gedämpft gibt es NUR mit Beleg — nie im Schema', () => {
    expect(edgeFlow(kabel, EMPTY_LIVE, JETZT, opts).dimmed).toBe(false)
    expect(edgeFlow(kabel, null, JETZT, opts).dimmed).toBe(false)
  })
})

describe('Tally', () => {
  it('meldet Zustand und Alter, wenn frisch', () => {
    const t = tallyOf(
      'cam1',
      snap({ tally: [{ equipmentId: 'cam1', state: 'program', at: JETZT - 100, source: 'atem' }] }),
      JETZT,
    )
    expect(t).toEqual({ state: 'program', ageMs: 100 })
  })

  it('gibt null statt „off", wenn nichts bekannt ist', () => {
    // Eine Kamera ohne Meldung darf nicht wie eine aussehen, von der bekannt
    // ist, dass sie nicht auf Sendung ist — das ist der gefährlichste Irrtum
    // an einer Tally-Anzeige.
    expect(tallyOf('cam1', snap({ tally: [] }), JETZT)).toBeNull()
    expect(tallyOf('cam1', EMPTY_LIVE, JETZT)).toBeNull()
  })

  it('gibt null bei veralteter Meldung', () => {
    expect(
      tallyOf(
        'cam1',
        snap({ tally: [{ equipmentId: 'cam1', state: 'program', at: JETZT - 60_000, source: 'atem' }] }),
        JETZT,
      ),
    ).toBeNull()
  })
})

describe('Die Kette bis zum Mischer', () => {
  const c = (id: string, from: string, to: string) => ({ id, fromEquipmentId: from, toEquipmentId: to })

  it('folgt den Kabeln vorwärts', () => {
    const kanten = tallyChain('cam1', [c('k1', 'cam1', 'conv'), c('k2', 'conv', 'atem'), c('k3', 'x', 'y')])
    expect([...kanten].sort()).toEqual(['k1', 'k2'])
  })

  it('erfindet keinen Weg, den der Plan nicht kennt', () => {
    // Endet die Verkabelung, endet die Kette. Sie „bis zum Mischer"
    // weiterzumalen hiesse, eine Strecke zu behaupten.
    expect([...tallyChain('cam1', [c('k1', 'cam1', 'conv')])]).toEqual(['k1'])
    expect([...tallyChain('cam1', [])]).toEqual([])
  })

  it('läuft bei einem Rückweg im Plan nicht endlos', () => {
    // Mischer → Monitor → Mischer ist eine gewöhnliche Verkabelung.
    const kanten = tallyChain('a', [c('k1', 'a', 'b'), c('k2', 'b', 'a')])
    expect([...kanten].sort()).toEqual(['k1', 'k2'])
  })

  it('hört nach der Sprung-Obergrenze auf', () => {
    const lang = Array.from({ length: 30 }, (_, i) => c(`k${i}`, `e${i}`, `e${i + 1}`))
    expect(tallyChain('e0', lang, 3).size).toBe(3)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Die Verdrahtung im Canvas — geprüft an der Quelle, weil `vitest` hier nicht
// rendert.
//
// Was hier hängt, ist NICHT „wie sieht die Kante aus" (Farbe, Strichlänge und
// Anordnung dürfen sich ändern, ohne dass eine Zusicherung fällt), sondern die
// eine Aussage, ohne die die ganze Konstruktion sinnlos wäre:
//
//   Wo sich etwas bewegt, steht auch, WONACH dieses Bild zu lesen ist.
//
// Die Animation sieht im Schema und im Live-Betrieb gleich aus. Ein Canvas,
// der sie zeigt und die Betriebsart verschweigt, behauptet einen Zustand, für
// den es keinen Beleg gibt — dieselbe Form wie E-13 (die Vorschau, die nicht
// sagte, dass sie eine ist).
// ───────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const lies = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')

describe('Canvas — wo Bewegung ist, steht die Betriebsart', () => {
  it('die Kante entscheidet die Bewegung nicht selbst', () => {
    // `useEdgeFlow` ist die Engstelle: dort steckt die Rückfall-Regel. Eine
    // Kante, die `cp-flow` an einer eigenen Bedingung aufhängt, umgeht sie.
    const edge = lies('src/renderer/components/Canvas/CableEdge.tsx')
    expect(edge).toContain('useEdgeFlow')
    const flowStellen = [...edge.matchAll(/cp-flow/g)]
    expect(flowStellen.length, 'cp-flow wird gerendert').toBeGreaterThan(0)
    // Die Klasse steht nur innerhalb des `flow?.animate`-Zweigs.
    const abschnitt = edge.slice(edge.indexOf('flow?.animate'), edge.indexOf('flow?.animate') + 600)
    expect(abschnitt).toContain('cp-flow')
  })

  it('die Werkzeugleiste zeigt die Betriebsart an', () => {
    const toolbar = lies('src/renderer/components/Canvas/CanvasToolbar.tsx')
    expect(toolbar).toContain('<FlowModeChip')
  })

  it('die Anzeige nennt beide Betriebsarten und das Alter', () => {
    // „Live" ohne Zeitangabe ist dieselbe Behauptung wie eine laufende
    // Animation ohne Beleg, nur in Textform.
    const chip = lies('src/renderer/components/Canvas/FlowModeChip.tsx')
    expect(chip).toContain("'canvas.flow.live'")
    expect(chip).toContain("'canvas.flow.schema'")
    expect(chip).toContain('ageMs')
  })

  it('Bewegung verlangt die Zustimmung von Nutzer UND System', () => {
    const hooks = lies('src/renderer/hooks/useCanvasFlow.ts')
    expect(hooks).toContain('useReducedMotion')
    expect(hooks).toContain('canvasMotion')
    // Beide, nicht eines von beiden.
    expect(hooks).toMatch(/gewuenscht\s*&&\s*!reduziert/)
  })

  it('die Beobachtungen liegen NICHT im Projekt-Store', () => {
    // Sonst liefen sie durch Undo/Redo, die Autospeicherung und in die
    // Projektdatei — eine Ablesung, die als Absicht gespeichert wird, ist der
    // Fehler, den ADR-003 und E-4 benennen.
    // Geprueft werden die IMPORTE, nicht der Fliesstext: der Kopfkommentar
    // des Live-Stores nennt `projectStore` ausdruecklich, um zu sagen, dass er
    // nicht dorthin gehoert. Ein Waechter, der Begruendungen verbietet, macht
    // die Begruendung zum Fehler.
    const store = lies('src/renderer/store/liveStore.ts')
    const importe = [...store.matchAll(/^import .*$/gm)].map((m) => m[0]).join('\n')
    expect(importe).not.toContain('projectStore')
    expect(importe).not.toContain('persist')
    const projekt = lies('src/renderer/store/projectStore.ts')
    expect(projekt).not.toContain('LiveSnapshot')
  })
})
