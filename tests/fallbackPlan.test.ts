import { describe, expect, it } from 'vitest'
import {
  FALLBACK_FINDING_LABEL,
  assessFallback,
  fallbackSkeleton,
  fallbackTable,
  isLoopback,
  normaliseFallbackPlan,
  plannedKbps,
} from '../src/renderer/lib/fallbackPlan'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { DeliveryDestination } from '../src/renderer/types/delivery'
import type { FallbackPlan } from '../src/renderer/types/fallback'
import dialogQuelle from '../src/renderer/components/Delivery/DeliveryDialog.tsx?raw'
import registerQuelle from '../src/renderer/lib/documentRegistry.ts?raw'
import storeQuelle from '../src/renderer/store/projectStore.ts?raw'
import metaQuelle from '../src/renderer/store/slices/metaSlice.ts?raw'
import dictsQuelle from '../src/renderer/lib/i18n/dicts.ts?raw'

// ---------------------------------------------------------------------------
// Das Sicherheitsnetz, einmal erklaert (Bedarf 89, P2).
//
//   > Scene names exist in the OBS scene collection, again in hand-edited
//   > NOALBS JSON, and again in the operator's memory during the show; the
//   > safety net's characteristic failure is parking the show on a slate while
//   > the stream is fine.
//
// Belege: NOALBS #178 (2024-10-23, offen) — der Waechter erreicht
// `http://localhost/stat` nicht, obwohl dieselbe URL im Browser antwortet, und
// schaltet dauerhaft auf offline, waehrend RTMP laeuft. NOALBS #119
// (2022-09-14) — eine klebende Offline-Szene.
//
// Der Bedarf sagt auch, wie: „Record the intended fallback behaviour
// (thresholds, scene names, which destination it protects) as part of the plan
// […]; name-consistency checking between plan and exported config is a cheap
// win."
// ---------------------------------------------------------------------------

const geraet = (id: string, name: string) =>
  ({ id, name, x: 0, y: 0, width: 10, height: 10, category: 'Video', inputs: [], outputs: [] }) as never

const ziel = (
  id: string,
  name: string,
  over: Partial<DeliveryDestination> = {},
): DeliveryDestination =>
  ({
    id,
    name,
    platform: 'custom',
    transport: 'RTMP',
    encoding: {
      width: 1920,
      height: 1080,
      fps: 50,
      videoCodec: 'H.264',
      videoBitrateKbps: 6000,
      keyframeSec: 2,
      audioCodec: 'AAC',
      audioSampleRate: 48000,
      audioBitrateKbps: 160,
    },
    ...over,
  }) as never

const projekt = (over: Partial<CablePlannerProject> = {}): CablePlannerProject =>
  ({
    metadata: { name: 'Show' },
    equipment: [],
    cables: [],
    locations: [],
    ...over,
  }) as never

const plan = (over: Partial<FallbackPlan> = {}): FallbackPlan => ({
  scenes: [],
  rules: [],
  ...over,
})

// ---------------------------------------------------------------------------
describe('ohne Ausspielung gibt es nichts zu schuetzen', () => {
  it('meldet nichts und sagt, dass es keine Ziele gibt', () => {
    const a = assessFallback(projekt())
    expect(a.findings).toEqual([])
    expect(a.hasDestinations).toBe(false)
    expect(a.unprotected).toEqual([])
  })

  it('haelt ein ungeschuetztes Ziel AUS den Befunden heraus', () => {
    // Ein Plan ohne Sicherheitsnetz ist eine Entscheidung. Je Ziel eine
    // Warnung wuerde die sechs echten Befunde darunter begraben — dieselbe
    // Haltung wie `withoutDomain` beim Zeit-Plan.
    const a = assessFallback(projekt({ deliveryDestinations: [ziel('d1', 'YouTube')] }))
    expect(a.findings).toEqual([])
    expect(a.unprotected).toEqual(['d1'])
  })
})

// ---------------------------------------------------------------------------
describe('der Namensabgleich — die billige Pruefung, die niemand macht', () => {
  it('meldet eine Szene, die der Encoder nicht kennt', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['Programm', 'Be Right Back'],
          rules: [{ id: 'r1', destinationId: 'd1', sceneOffline: 'BRB', sceneNormal: 'Programm' }],
        }),
      }),
    )
    const f = a.findings.find((x) => x.kind === 'scene-unknown')!
    expect(f).toBeDefined()
    expect(f.text).toContain('BRB')
    expect(f.ruleId).toBe('r1')
  })

  it('prueft ALLE DREI Szenen, nicht nur die Offline-Szene', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['Programm'],
          rules: [
            {
              id: 'r1',
              destinationId: 'd1',
              sceneNormal: 'Programm',
              sceneLow: 'Sparsam',
              sceneOffline: 'Tafel',
            },
          ],
        }),
      }),
    )
    const unbekannt = a.findings.filter((f) => f.kind === 'scene-unknown')
    expect(unbekannt).toHaveLength(2)
    expect(unbekannt.map((f) => f.text.includes('Sparsam')).some(Boolean)).toBe(true)
    expect(unbekannt.map((f) => f.text.includes('Tafel')).some(Boolean)).toBe(true)
  })

  it('SAGT, wenn die Szenenliste fehlt, statt still durchzulaufen', () => {
    // Ein stiller Durchlauf saehe aus wie „geprueft", und das ist der
    // teuerste Zustand von allen.
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({ rules: [{ id: 'r1', destinationId: 'd1', sceneOffline: 'BRB' }] }),
      }),
    )
    expect(a.findings.some((f) => f.kind === 'scenes-unknown')).toBe(true)
    // Und der Namensabgleich behauptet dann NICHTS.
    expect(a.findings.some((f) => f.kind === 'scene-unknown')).toBe(false)
  })

  it('meldet die fehlende Liste NICHT, solange es keine Regel gibt', () => {
    const a = assessFallback(
      projekt({ deliveryDestinations: [ziel('d1', 'YouTube')], fallback: plan() }),
    )
    expect(a.findings).toEqual([])
  })

  it('nennt die FOLGE, nicht nur den Namen', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['Programm'],
          rules: [{ id: 'r1', destinationId: 'd1', sceneNormal: 'Programm', sceneOffline: 'BRB' }],
        }),
      }),
    )
    const f = a.findings.find((x) => x.kind === 'scene-unknown')!
    expect(f.text).toMatch(/Show bleibt stehen|niemand sieht/)
  })
})

// ---------------------------------------------------------------------------
describe('der Rueckweg — NOALBS #119', () => {
  it('meldet eine Ausweichszene ohne Normalbetrieb', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({ scenes: ['Tafel'], rules: [{ id: 'r1', destinationId: 'd1', sceneOffline: 'Tafel' }] }),
      }),
    )
    const f = a.findings.find((x) => x.kind === 'no-return-path')!
    expect(f).toBeDefined()
    expect(f.text).toMatch(/nie zurück/)
  })

  it('meldet nichts, wenn der Rueckweg benannt ist', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['Tafel', 'Programm'],
          rules: [{ id: 'r1', destinationId: 'd1', sceneOffline: 'Tafel', sceneNormal: 'Programm' }],
        }),
      }),
    )
    expect(a.findings.filter((f) => f.kind === 'no-return-path')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('die Schwellen', () => {
  it('meldet offline UEBER niedrig als verkehrt herum', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['P'],
          rules: [{ id: 'r1', destinationId: 'd1', lowKbps: 1000, offlineKbps: 2000 }],
        }),
      }),
    )
    const f = a.findings.find((x) => x.kind === 'threshold-order')!
    expect(f).toBeDefined()
    expect(f.text).toContain('2000')
    expect(f.text).toContain('1000')
  })

  it('meldet gleiche Schwellen ebenfalls — der Zwischenzustand faellt weg', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['P'],
          rules: [{ id: 'r1', destinationId: 'd1', lowKbps: 1000, offlineKbps: 1000 }],
        }),
      }),
    )
    expect(a.findings.some((f) => f.kind === 'threshold-order')).toBe(true)
  })

  it('MISST DIE SCHWELLE AN DER GEPLANTEN BITRATE', () => {
    // 6000 Video + 160 Audio. Eine Schwelle „niedrig" bei 6500 liegt vom
    // ersten Moment an vor und geht nie weg — das Netz haengt in der
    // Ausweichszene fest, waehrend nichts fehlt.
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({ scenes: ['P'], rules: [{ id: 'r1', destinationId: 'd1', lowKbps: 6500 }] }),
      }),
    )
    const f = a.findings.find((x) => x.kind === 'threshold-above-bitrate')!
    expect(f).toBeDefined()
    expect(f.text).toContain('6160')
    expect(f.text).toContain('6500')
  })

  it('rechnet Video UND Audio, nicht nur Video', () => {
    expect(plannedKbps(ziel('d1', 'Y'))).toBe(6160)
    // Genau zwischen Video und Video+Audio: eine reine Video-Rechnung meldete
    // hier faelschlich.
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({ scenes: ['P'], rules: [{ id: 'r1', destinationId: 'd1', lowKbps: 6100 }] }),
      }),
    )
    expect(a.findings.filter((f) => f.kind === 'threshold-above-bitrate')).toEqual([])
  })

  it('meldet eine sinnvolle Schwelle nicht', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['P'],
          rules: [{ id: 'r1', destinationId: 'd1', lowKbps: 3000, offlineKbps: 200 }],
        }),
      }),
    )
    expect(a.findings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('`localhost` ist eine Annahme — NOALBS #178', () => {
  it('erkennt jede Schreibweise der Rueckschleife', () => {
    for (const url of ['http://localhost/stat', 'https://127.0.0.1:8080/x', 'localhost:9999', '::1/stat']) {
      expect(isLoopback(url), url).toBe(true)
    }
    for (const url of ['http://10.0.0.20/stat', 'http://encoder.local/stat', undefined]) {
      expect(isLoopback(url), String(url)).toBe(false)
    }
  })

  it('NENNT DIE BEIDEN MASCHINEN, wenn Waechter und Encoder verschieden sind', () => {
    const a = assessFallback(
      projekt({
        equipment: [geraet('pc', 'Streaming-PC'), geraet('enc', 'Encoder im Rack')],
        deliveryDestinations: [ziel('d1', 'YouTube', { encoderEquipmentId: 'enc' })],
        fallback: plan({
          scenes: ['P'],
          statsUrl: 'http://localhost/stat',
          watcherEquipmentId: 'pc',
          rules: [{ id: 'r1', destinationId: 'd1' }],
        }),
      }),
    )
    const f = a.findings.find((x) => x.kind === 'stats-loopback')!
    expect(f).toBeDefined()
    expect(f.text).toContain('Streaming-PC')
    expect(f.text).toContain('Encoder im Rack')
    expect(f.text).toContain('#178')
  })

  it('sagt bei unbenanntem Waechter, dass die Maschine NICHT IM PLAN STEHT', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['P'],
          statsUrl: 'http://localhost/stat',
          rules: [{ id: 'r1', destinationId: 'd1' }],
        }),
      }),
    )
    const f = a.findings.find((x) => x.kind === 'stats-loopback')!
    expect(f.text).toMatch(/steht nicht im Plan/)
  })

  it('BEHAUPTET NICHT, dass die URL antwortet — auch nicht im guten Fall', () => {
    // Ob der Waechter die Statistik erreicht, ist eine Messung an der
    // Maschine. Eine geratene Antwort saehe wie eine aus.
    const a = assessFallback(
      projekt({
        equipment: [geraet('pc', 'Streaming-PC')],
        deliveryDestinations: [ziel('d1', 'YouTube', { encoderEquipmentId: 'pc' })],
        fallback: plan({
          scenes: ['P'],
          statsUrl: 'http://localhost/stat',
          watcherEquipmentId: 'pc',
          rules: [{ id: 'r1', destinationId: 'd1' }],
        }),
      }),
    )
    const f = a.findings.find((x) => x.kind === 'stats-loopback')!
    expect(f.text).toMatch(/Messung an der Maschine/)
  })

  it('meldet eine echte Adresse nicht', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({
          scenes: ['P'],
          statsUrl: 'http://10.0.0.20/stat',
          rules: [{ id: 'r1', destinationId: 'd1' }],
        }),
      }),
    )
    expect(a.findings).toEqual([])
  })

  it('meldet die Rueckschleife nicht, solange es keine Regel gibt', () => {
    const a = assessFallback(
      projekt({
        deliveryDestinations: [ziel('d1', 'YouTube')],
        fallback: plan({ statsUrl: 'http://localhost/stat' }),
      }),
    )
    expect(a.findings).toEqual([])
  })

  it('haelt die Etiketten kanonisch deutsch', () => {
    expect(FALLBACK_FINDING_LABEL['stats-loopback']).toBe(
      'localhost ist eine Annahme über die Maschine',
    )
  })
})

// ---------------------------------------------------------------------------
describe('das Blatt und das Geruest', () => {
  const voll = () =>
    projekt({
      equipment: [geraet('pc', 'Streaming-PC')],
      deliveryDestinations: [ziel('d1', 'YouTube', { encoderEquipmentId: 'pc' })],
      fallback: plan({
        scenes: ['Programm', 'Tafel'],
        statsUrl: 'http://10.0.0.20/stat',
        watcherEquipmentId: 'pc',
        rules: [
          {
            id: 'r1',
            destinationId: 'd1',
            sceneNormal: 'Programm',
            sceneOffline: 'Tafel',
            lowKbps: 3000,
            offlineKbps: 200,
            note: 'Regie fragen',
          },
        ],
      }),
    })

  it('traegt alles, was der Bedarf nennt — plus die geplante Bitrate', () => {
    const t = fallbackTable(voll())
    expect(t.headers).toEqual([
      'Ziel',
      'Normalbetrieb',
      'Niedrige Bitrate',
      'Offline',
      'Schwelle niedrig (kbit/s)',
      'Schwelle offline (kbit/s)',
      'Geplant (kbit/s)',
      'Anmerkung',
    ])
    expect(t.rows[0]).toEqual(['YouTube', 'Programm', '', 'Tafel', 3000, 200, 6160, 'Regie fragen'])
  })

  it('SAGT IN DER DATEI, dass es kein einspielbares Geruest ist', () => {
    // Der Satz muss IN der Ausgabe stehen: jemand schickt sie weiter, und der
    // Hinweis daneben bleibt im Chat zurueck.
    const j = JSON.parse(fallbackSkeleton(voll()))
    expect(j._hinweis).toMatch(/KEINE einspielbare Konfiguration/)
    expect(j._hinweis).toMatch(/Stream-Keys/)
  })

  it('TRAEGT KEINEN STREAM-KEY UND KEINE INGEST-URL', () => {
    // Eine exportierte Konfiguration ist eine Datei, die per Mail geht.
    const p = voll()
    p.deliveryDestinations![0] = {
      ...p.deliveryDestinations![0],
      ingestUrl: 'rtmp://a.rtmp.youtube.com/live2',
      hasStreamKey: true,
    }
    const roh = fallbackSkeleton(p)
    expect(roh).not.toContain('rtmp://')
    expect(roh.toLowerCase()).not.toContain('streamkey')
    expect(roh).not.toContain('hasStreamKey')
  })

  it('nennt Geraete beim NAMEN, nicht bei der Id', () => {
    const j = JSON.parse(fallbackSkeleton(voll()))
    expect(j.waechter.geraet).toBe('Streaming-PC')
    expect(j.regeln[0].encoder).toBe('Streaming-PC')
    expect(j.regeln[0].geplantKbps).toBe(6160)
  })

  it('legt die Befunde MIT in die Datei', () => {
    const p = voll()
    p.fallback = plan({ scenes: [], rules: [{ id: 'r1', destinationId: 'd1' }] })
    const j = JSON.parse(fallbackSkeleton(p))
    expect(j.befunde.map((b: { art: string }) => b.art)).toContain('scenes-unknown')
  })
})

// ---------------------------------------------------------------------------
describe('der Lade-Pfad', () => {
  it('verwirft eine Regel ohne Ziel und meldet sie', () => {
    const drops: { reason: string }[] = []
    const p = normaliseFallbackPlan(
      { scenes: ['A'], rules: [{ id: 'r1' }, { id: 'r2', destinationId: 'd1' }] },
      (d) => drops.push(d),
    )
    expect(p?.rules).toHaveLength(1)
    expect(drops[0].reason).toBe('missing-required')
  })

  it('BEHAELT eine Regel mit einem Szenennamen, den es nicht gibt', () => {
    // Sie hier wegzuwerfen hiesse, den Fehler zu verstecken statt ihn zu
    // zeigen — dafuer gibt es `scene-unknown`.
    const p = normaliseFallbackPlan({
      scenes: ['A'],
      rules: [{ id: 'r1', destinationId: 'd1', sceneOffline: 'gibt-es-nicht' }],
    })
    expect(p?.rules[0].sceneOffline).toBe('gibt-es-nicht')
  })

  it('meldet eine doppelte Regel-Id, der erste Eintrag gilt', () => {
    const drops: { reason: string }[] = []
    const p = normaliseFallbackPlan(
      {
        scenes: [],
        rules: [
          { id: 'r1', destinationId: 'd1', sceneOffline: 'A' },
          { id: 'r1', destinationId: 'd2', sceneOffline: 'B' },
        ],
      },
      (d) => drops.push(d),
    )
    expect(p?.rules).toHaveLength(1)
    expect(p?.rules[0].destinationId).toBe('d1')
    expect(drops[0].reason).toBe('duplicate-id')
  })

  it('entdoppelt und trimmt die Szenenliste', () => {
    const p = normaliseFallbackPlan({ scenes: [' A ', 'A', '', 'B'], rules: [] })
    expect(p?.scenes).toEqual(['A', 'B'])
  })

  it('nimmt keine negative Schwelle', () => {
    const p = normaliseFallbackPlan({
      scenes: [],
      rules: [{ id: 'r1', destinationId: 'd1', lowKbps: -5, offlineKbps: 200 }],
    })
    expect(p?.rules[0].lowKbps).toBeUndefined()
    expect(p?.rules[0].offlineKbps).toBe(200)
  })

  it('heilt ein Objekt ohne alles zu `undefined`', () => {
    expect(normaliseFallbackPlan({ scenes: [], rules: [] })).toBeUndefined()
    expect(normaliseFallbackPlan(undefined)).toBeUndefined()
    expect(normaliseFallbackPlan('nein')).toBeUndefined()
  })

  it('haengt in `healProjectPositions`', () => {
    expect(storeQuelle).toContain('normaliseFallbackPlan(project.fallback')
    expect(storeQuelle).toMatch(/kind: 'fallback-rule', reason: d\.reason, label: d\.label/)
    expect(storeQuelle).toMatch(/^\s*fallback,$/m)
  })
})

// ---------------------------------------------------------------------------
describe('Erreichbarkeit', () => {
  it('steht im Ausspiel-Dialog, dort wo die Ziele stehen', () => {
    expect(dialogQuelle).toContain('assessFallback(project)')
    expect(dialogQuelle).toMatch(/\{list\.length > 0 && \(/)
    expect(dialogQuelle).toContain("t('delivery.fb.title'")
  })

  it('bietet BEIDE Ausgaben an — Blatt und Geruest', () => {
    expect(dialogQuelle).toContain('onClick={exportFallback}')
    expect(dialogQuelle).toContain('onClick={exportSkeleton}')
    expect(dialogQuelle).toContain('fallbackSkeleton(project)')
  })

  it('warnt am Geruest-Knopf, dass es nicht einspielbar ist', () => {
    // Als AUFRUFFORM, nicht als Teilzeichenkette: der Schluessel steht im
    // Quelltext auf einer eigenen Zeile hinter `t(`.
    expect(dialogQuelle).toMatch(/title=\{t\(\s*'delivery\.fb\.skeletonHint',/)
  })

  it('nimmt die Szenenliste per EINFUEGEN entgegen, zeilen- oder kommagetrennt', () => {
    // Der Planer liest keine Szenensammlung. Ein Feld je Szene waere bei
    // zwanzig Szenen unbenutzbar.
    expect(dialogQuelle).toMatch(/\.split\(\/\[\\n,;\]\+\/\)/)
    expect(dialogQuelle).toContain('patchFallback({ scenes: namen })')
  })

  it('setzt den Store ueber einen Setter, der den GANZEN Plan nimmt', () => {
    // Der ganze Rumpf am Stueck: ein `toContain` auf `scheduleProjectAutosave`
    // traefe jeden anderen Setter derselben Datei mit.
    expect(metaQuelle).toMatch(
      /setFallbackPlan: \(plan\) =>\n\s*set\(\(state\) => \{\n\s*const updated = \{ \.\.\.state\.project, fallback: plan \}\n\s*scheduleProjectAutosave\(updated\)\n\s*return \{ project: updated \}\n\s*\}\),/,
    )
  })

  it('ist ein Dokument mit Stand', () => {
    expect(registerQuelle).toContain("'ausweich-plan': ofTable(fallbackTable)")
    expect(registerQuelle).toContain("'ausweich-plan': 'Ausweich-Plan (Sicherheitsnetz)'")
  })

  it('hat fuer jeden neuen Text einen EN-Eintrag', () => {
    for (const key of [
      'delivery.fb.title',
      'delivery.fb.intro',
      'delivery.fb.export',
      'delivery.fb.skeleton',
      'delivery.fb.skeletonHint',
      'delivery.fb.watcher',
      'delivery.fb.watcherNone',
      'delivery.fb.stats',
      'delivery.fb.scenes',
      'delivery.fb.scenesPh',
      'delivery.fb.scenesApply',
      'delivery.fb.protect',
      'delivery.fb.remove',
      'delivery.fb.sceneNormal',
      'delivery.fb.sceneLow',
      'delivery.fb.sceneOffline',
      'delivery.fb.low',
      'delivery.fb.offline',
      'app.loadReport.fallbackRule',
    ]) {
      expect(dictsQuelle).toContain(`'${key}'`)
    }
  })
})
