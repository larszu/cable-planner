import { describe, expect, it } from 'vitest'
import { videohubLinks } from '../src/renderer/lib/videohubLinks'
import { edgeFlow, EMPTY_LIVE } from '../src/renderer/lib/signalAnimation'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem } from '../src/renderer/types/equipment'

// ───────────────────────────────────────────────────────────────────────────
// Der Kreuzpunkt-Zustand des Videohubs auf den Kanten.
//
// DIE GRENZE IST DIE ZUSICHERUNG. Ein Videohub meldet, welchen Eingang er auf
// welchen Ausgang schaltet — und NICHTS darüber, ob dort Signal anliegt. Kein
// Lock, kein Format, keine Signalerkennung; das Protokoll kennt sie nicht.
//
// Ein Kreuzpunkt steht auch dann, wenn upstream die Kamera aus ist. Ihn als
// „Signal liegt an" zu zeigen, machte aus einer Router-EINSTELLUNG eine
// Aussage über die Anlage. Deshalb `routed` und nie `carrying` — und nie
// `down`, weil der Hub Verbindungsverlust gar nicht melden kann.
// ───────────────────────────────────────────────────────────────────────────

const port = (id: string) => ({ id, name: id, type: 'port' as const, connectorType: 'BNC' as const })

const hub = {
  id: 'hub',
  inputs: [port('in1'), port('in2'), port('in3')],
  outputs: [port('out1'), port('out2')],
} as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
  }) as unknown as Cable

const JETZT = 9000

describe('Videohub → Kanten', () => {
  it('meldet eine geroutete Zuleitung als `routed`, nicht als `carrying`', () => {
    const c = kabel('k1', ['cam1', 'out'], ['hub', 'in1'])
    const l = videohubLinks(hub, [c], { routing: { 1: 1 } }, JETZT)
    expect(l).toEqual([{ cableId: 'k1', state: 'routed', at: JETZT, source: 'videohub' }])
  })

  it('meldet eine nicht geroutete Zuleitung als `idle`, nicht als `down`', () => {
    // Die Strecke ist da, es laeuft nur nichts darueber. `down` koennte der
    // Hub gar nicht belegen.
    const c = kabel('k1', ['cam1', 'out'], ['hub', 'in2'])
    const l = videohubLinks(hub, [c], { routing: { 1: 1 } }, JETZT)
    expect(l[0].state).toBe('idle')
  })

  it('meldet einen belegten Ausgang als `routed`', () => {
    const c = kabel('k2', ['hub', 'out1'], ['atem', 'in'])
    const l = videohubLinks(hub, [c], { routing: { 1: 3 } }, JETZT)
    expect(l[0].state).toBe('routed')
  })

  it('meldet einen unbelegten Ausgang als `idle`', () => {
    const c = kabel('k2', ['hub', 'out2'], ['atem', 'in'])
    const l = videohubLinks(hub, [c], { routing: { 1: 3 } }, JETZT)
    expect(l[0].state).toBe('idle')
  })

  it('meldet NIE `carrying` und NIE `down`', () => {
    // Die Grenze in einer Zeile. Wer hier eine dritte Sorte einbaut, faellt auf.
    const cs = [
      kabel('a', ['cam1', 'o'], ['hub', 'in1']),
      kabel('b', ['cam2', 'o'], ['hub', 'in2']),
      kabel('c', ['hub', 'out1'], ['atem', 'i']),
      kabel('d', ['hub', 'out2'], ['mon', 'i']),
    ]
    const l = videohubLinks(hub, cs, { routing: { 1: 1 } }, JETZT)
    expect(l.length).toBe(4)
    for (const eintrag of l) {
      expect(['routed', 'idle']).toContain(eintrag.state)
    }
  })

  it('sagt über Kabel, die den Hub nicht berühren, nichts', () => {
    // Und `edgeFlow` zeigt fuer eine Kante ohne Eintrag das Schema, nicht
    // „aus" — die beiden Regeln greifen ineinander.
    const c = kabel('fremd', ['cam1', 'o'], ['atem', 'i'])
    expect(videohubLinks(hub, [c], { routing: { 1: 1 } }, JETZT)).toEqual([])
  })

  it('sagt nichts ohne Hub-Zustand oder ohne Hub im Plan', () => {
    const c = kabel('k1', ['cam1', 'o'], ['hub', 'in1'])
    expect(videohubLinks(hub, [c], null, JETZT)).toEqual([])
    expect(videohubLinks(hub, [c], {}, JETZT)).toEqual([])
    expect(videohubLinks(undefined, [c], { routing: { 1: 1 } }, JETZT)).toEqual([])
  })

  it('überspringt einen Port, den der Hub nicht führt', () => {
    // Ein Kabel auf einen Port, den es am Hub nicht (mehr) gibt: keine
    // Nummer, keine Aussage. Eine geratene Nummer traefe die falsche Kante.
    const c = kabel('k1', ['cam1', 'o'], ['hub', 'gibtEsNicht'])
    expect(videohubLinks(hub, [c], { routing: { 1: 1 } }, JETZT)).toEqual([])
  })
})

describe('Wie `routed` auf der Kante ankommt', () => {
  const c = { id: 'k1', bidirectional: false }

  it('bewegt sich wie ein Weg — der Router schaltet ja durch', () => {
    const f = edgeFlow(
      c,
      { links: [{ cableId: 'k1', state: 'routed', at: JETZT, source: 'videohub' }], tally: [], lastContactAt: JETZT },
      JETZT,
      { motion: true },
    )
    expect(f.kind).toBe('live-routed')
    expect(f.animate).toBe(true)
    expect(f.dimmed).toBe(false)
  })

  it('bleibt als eigene Sorte erkennbar, nicht als `carrying`', () => {
    // Der Unterschied steckt in `kind` und wird dort gelesen, wo er etwas
    // aendert. In der Bewegung koennte er nicht stecken: die bedeutete dann
    // dreierlei.
    const f = edgeFlow(
      c,
      { links: [{ cableId: 'k1', state: 'routed', at: JETZT, source: 'videohub' }], tally: [], lastContactAt: JETZT },
      JETZT,
      { motion: true },
    )
    expect(f.kind).not.toBe('live-carrying')
  })

  it('faellt ohne Kontakt weiter aufs Schema zurück', () => {
    expect(edgeFlow(c, EMPTY_LIVE, JETZT, { motion: true }).kind).toBe('schema')
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Zwei Quellen, zwei Hälften — und was passiert, wenn eine ausfällt.
//
// Der Mischer meldet Tally, der Router meldet Kreuzpunkte. Fällt einer aus,
// fällt nicht der andere aus. Wer das nicht trennt, macht aus einem toten
// Router einen toten Mischer — und der Nutzer sucht den Fehler am falschen
// Gerät.
// ───────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { useLiveStore } from '../src/renderer/store/liveStore'
import { resolve } from 'node:path'

const lies = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8')

describe('Ausfall einer Quelle', () => {
  it('jeder Einspeiser meldet NUR seine eigene Haelfte ab', () => {
    expect(lies('src/renderer/hooks/useAtemTallyFeed.ts')).toContain("verbindungWeg('tally')")
    expect(lies('src/renderer/hooks/useVideohubLinkFeed.ts')).toContain("verbindungWeg('links')")
  })

  it('der Store raeumt bei einem Teil-Ausfall nur diesen Teil', () => {
    // VERHALTEN, nicht Quelltext. Der erste Anlauf dieses Tests las die zwei
    // Zeilen aus `liveStore.ts` — und blieb GRUEN, als eine Gegenprobe ein
    // `return EMPTY_LIVE` DAVOR setzte: die Zeilen standen weiter da, nur
    // unerreichbar. Ein Waechter, der die Form liest statt der Wirkung,
    // bewacht nichts.
    const s = useLiveStore.getState()
    s.melde(
      {
        links: [{ cableId: 'k1', state: 'routed', at: JETZT, source: 'videohub' }],
        tally: [{ equipmentId: 'cam1', state: 'program', at: JETZT, source: 'atem' }],
      },
      JETZT,
    )

    useLiveStore.getState().verbindungWeg('links')
    const nachRouter = useLiveStore.getState().snapshot
    expect(nachRouter.links).toEqual([])
    expect(nachRouter.tally).toHaveLength(1)
    // Und der Gesamtkontakt bleibt: die andere Quelle meldet ja noch.
    expect(nachRouter.lastContactAt).toBe(JETZT)

    useLiveStore.getState().verbindungWeg('tally')
    expect(useLiveStore.getState().snapshot.tally).toEqual([])

    // Ohne Argument: alles, samt Gesamtkontakt.
    useLiveStore.getState().melde({ tally: [{ equipmentId: 'c', state: 'off', at: JETZT, source: 'atem' }] }, JETZT)
    useLiveStore.getState().verbindungWeg()
    expect(useLiveStore.getState().snapshot.lastContactAt).toBeUndefined()
  })

  it('der Router wird langsamer gefragt als der Mischer', () => {
    // `videohub:read-state` oeffnet je Aufruf eine TCP-Verbindung zu einem
    // Geraet, das im Signalweg steht. Der Takt bleibt innerhalb des
    // Frische-Fensters, ist also Hoeflichkeit und keine Korrektheitsfrage.
    const feed = lies('src/renderer/hooks/useVideohubLinkFeed.ts')
    const takt = /HUB_TICK_MS = (\d+)/.exec(feed)
    expect(takt).not.toBeNull()
    expect(Number(takt![1])).toBeGreaterThan(1000)
    expect(Number(takt![1])).toBeLessThan(5000)
  })

  it('fragt keinen Hub ohne Adresse', () => {
    // Eine geratene Adresse waere ein Verbindungsversuch zu einem fremden
    // Geraet im Kundennetz.
    expect(lies('src/renderer/hooks/useVideohubLinkFeed.ts')).toContain("(e.ipAddress ?? '').trim() !== ''")
  })
})
