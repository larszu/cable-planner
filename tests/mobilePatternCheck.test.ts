import { describe, expect, it } from 'vitest'
import {
  PATTERN_OBSERVATIONS,
  PATTERN_OBSERVATION_LABEL,
} from '../src/renderer/types/patternCheck'
import { patternSharePlan, patternSharePlanJson } from '../src/renderer/lib/patternSharePlan'
import type { CablePlannerProject } from '../src/renderer/types/project'
import type { Cable } from '../src/renderer/types/cable'
import type { EquipmentItem, Port } from '../src/renderer/types/equipment'
import type { PatternCheck } from '../src/renderer/types/patternCheck'
import serverSrc from '../src/main/services/mobileShareServer.ts?raw'
import walkSrc from '../src/mobile/PatternWalk.tsx?raw'
import appSrc from '../src/renderer/App.tsx?raw'

// ───────────────────────────────────────────────────────────────────────────
// B-42 Inkrement 2b — die Rueckmeldung vom Rundgang kommt vom TELEFON.
//
// Der Techniker steht vor dem Monitor, nicht vor dem Rechner. Bisher konnte er
// nur am Canvas melden — also erst hinterher, aus dem Gedaechtnis, und genau
// dabei geht die eine Angabe verloren, auf die es ankommt: WELCHER Name auf
// dem falschen Bild stand.
//
// Was diese Datei prueft, sind die drei Stellen, an denen dieser Weg kippen
// koennte:
//
//   1. Die Erwartung darf am Telefon nicht wie eine Rueckmeldung aussehen
//      (Invariante 16). Diese App hat keinen Videoeingang.
//   2. Die Rechnung „wo muesste es ankommen" darf es nur EINMAL geben. Eine
//      zweite auf dem Telefon liefe bei der ersten ungesetzten Kreuzschiene
//      auseinander, und dann stuende dort ein Ankunftsort, den der Plan am
//      Rechner nicht kennt.
//   3. Der Zeitstempel darf nicht vom Telefon kommen. Dessen Uhr kann
//      beliebig falsch gehen, und ein Beleg mit erfundener Uhrzeit ist
//      schlimmer als einer mit der Empfangszeit.
// ───────────────────────────────────────────────────────────────────────────

const ohneKommentare = (src: string): string =>
  src
    .split('\n')
    .filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z))
    .join('\n')

const port = (id: string): Port =>
  ({ id, name: id, type: 'video', connectorType: 'bnc' }) as unknown as Port

const eq = (id: string, over: Partial<EquipmentItem> = {}): EquipmentItem =>
  ({ id, name: id, category: 'Video', x: 0, y: 0, inputs: [], outputs: [], ...over }) as unknown as EquipmentItem

const kabel = (id: string, from: [string, string], to: [string, string]): Cable =>
  ({
    id,
    fromEquipmentId: from[0],
    fromPortId: from[1],
    toEquipmentId: to[0],
    toPortId: to[1],
  }) as unknown as Cable

/**
 * Kamera 1 -> Verteiler -> zwei Eingaenge der Kreuzschiene.
 *
 * Der eine Weg endet am Monitor (ein ZIEL), der andere an einem geschalteten
 * Ausgang ohne Kabel (ein OFFENER Weg). Beide braucht die Pruefung: die
 * offenen Wege sind der Grund, warum das Blatt sie mitfuehrt.
 */
const anlage = (checks: PatternCheck[] = []): CablePlannerProject =>
  ({
    metadata: { name: 'Test', description: '', createdAt: '', updatedAt: '' },
    equipment: [
      eq('cam1', { name: 'Kamera 1', outputs: [port('c1out')] }),
      eq('da', {
        name: 'Verteiler',
        isDistributionAmp: true,
        inputs: [port('dain')],
        outputs: [port('da0'), port('da1')],
      }),
      eq('hub', {
        name: 'Smart Videohub 12x12',
        inputs: [port('i0'), port('i1')],
        outputs: [port('o0'), port('o1')],
        videohubRouting: { planned: { 0: 0, 1: 1 }, salvos: [] },
      }),
      eq('mon1', { name: 'Monitor Regie', inputs: [port('m1in')] }),
    ],
    cables: [
      kabel('k1', ['cam1', 'c1out'], ['da', 'dain']),
      kabel('k2', ['da', 'da0'], ['hub', 'i0']),
      kabel('k3', ['da', 'da1'], ['hub', 'i1']),
      kabel('k4', ['hub', 'o0'], ['mon1', 'm1in']),
    ],
    canvasState: { x: 0, y: 0, zoom: 1 },
    patternChecks: checks,
  }) as unknown as CablePlannerProject

describe('Der Plan fuer das Telefon traegt die ERWARTUNG', () => {
  it('je Ankunftsort steht der Name, der laut Plan dort stehen muesste', () => {
    const plan = patternSharePlan(anlage(), 'cam1', '2026-09-08T10:00:00.000Z')!
    expect(plan.quellName).toBe('Kamera 1')
    expect(plan.ziele).toHaveLength(1)
    expect(plan.ziele[0]).toMatchObject({
      equipmentName: 'Monitor Regie',
      erwartung: 'Kamera 1',
      geprueft: false,
      befund: '',
    })
  })

  it('das Feld heisst `erwartung` und nicht `bild`', () => {
    // Ein Feld namens `bild` liest sich am Telefon wie eine Rueckmeldung vom
    // Geraet — genau die Falle aus Invariante 16.
    const plan = patternSharePlan(anlage(), 'cam1', 'x')!
    expect(plan.ziele[0]).toHaveProperty('erwartung')
    expect(plan.ziele[0]).not.toHaveProperty('bild')
  })

  it('was schon gemeldet wurde, steht dabei', () => {
    // Sonst prueft der Zweite dieselben drei Monitore noch einmal und der
    // achte bleibt liegen.
    const plan = patternSharePlan(
      anlage([
        {
          at: '2026-09-08T09:00:00.000Z',
          quelleId: 'cam1',
          equipmentId: 'mon1',
          gesehen: 'stimmt',
        },
      ]),
      'cam1',
      'x',
    )!
    expect(plan.ziele[0].geprueft).toBe(true)
    expect(plan.ziele[0].befund).not.toBe('')
  })

  it('die offenen Wege fahren MIT, samt Grund', () => {
    // Eine Liste, die nur die sauberen Wege zeigt, schickt jemanden an sieben
    // Monitore und verschweigt den achten.
    const plan = patternSharePlan(anlage(), 'cam1', 'x')!
    expect(plan.offen.length).toBeGreaterThan(0)
    expect(plan.offen[0].hinweis).not.toBe('')
  })

  it('ohne Quelle kommt `null` und keine leere Liste', () => {
    // „Keine Quelle gewaehlt" und „nirgends erwartet" sind verschiedene
    // Aussagen, und die zweite waere gelogen.
    expect(patternSharePlan(anlage(), null, 'x')).toBeNull()
    expect(patternSharePlan(anlage(), 'gibt-es-nicht', 'x')).toBeNull()
    expect(patternSharePlanJson(anlage(), null, 'x')).toBeNull()
  })

  it('der Stand kommt vom Aufrufer, nicht aus der Ableitung', () => {
    // Ein Dokument, das sich selbst stempelt, sieht bei jedem Aufruf anders
    // aus — und dann ist nicht mehr feststellbar, welcher Stand am Telefon lag.
    const plan = patternSharePlan(anlage(), 'cam1', '2026-09-08T10:00:00.000Z')!
    expect(plan.stand).toBe('2026-09-08T10:00:00.000Z')
    const src = ohneKommentare(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      String((patternSharePlan as unknown as { toString(): string }).toString()),
    )
    expect(src).not.toMatch(/new Date\(/)
  })
})

describe('Es gibt nur EINE Rechnung', () => {
  it('die Mobile-Seite rechnet den Weg nicht selbst', () => {
    // Eine zweite Traversierung liefe bei der ersten Kreuzschiene ohne
    // gesetzten Kreuzpunkt auseinander, und dann stuende am Telefon ein
    // Ankunftsort, den der Plan am Rechner nicht kennt.
    const src = ohneKommentare(walkSrc)
    expect(src).not.toMatch(/signalChains|patternRouting|videohubRouting/)
    expect(src).toMatch(/apiFetch\('\/pattern\.json'\)/)
  })

  it('der Hauptprozess haelt den Plan nur, er baut ihn nicht', () => {
    const src = ohneKommentare(serverSrc)
    expect(src).not.toMatch(/signalChains|patternRouting/)
    expect(src).toMatch(/state\.patternPlan/)
  })

  it('der Renderer schickt ihn — samt Quelle in den Abhaengigkeiten', () => {
    // Ohne `patternQuelleId` in der Liste bliebe am Telefon die Quelle von
    // vorhin stehen, und der Rundgang liefe zur falschen Erwartung.
    const src = ohneKommentare(appSrc)
    expect(src).toMatch(/setPatternPlan\(\s*patternSharePlanJson\(project, patternQuelleId,/)
    expect(src).toMatch(/\}, \[project, patternQuelleId\]\)/)
  })
})

describe('Der Rueckweg nimmt nur an, was er versteht', () => {
  const src = ohneKommentare(serverSrc)

  it('er haengt AN, er ersetzt nicht — deshalb ein eigener Weg', () => {
    // `/checks` schickt einen vollstaendigen Zustand und ersetzt den vorigen.
    // Fuer eine Beobachtung waere das falsch: „gestern ging es, heute nicht"
    // ist die Auskunft, die den Fehler findet.
    expect(src).toMatch(/pathname === '\/pattern-checks' && req\.method === 'POST'/)
    expect(src).toMatch(/state\.onPatternCheck\?\.\(/)
  })

  it('er haengt an derselben Engstelle wie die anderen Schreibwege', () => {
    const stelle = src.slice(src.indexOf("pathname === '/pattern-checks' && req.method === 'POST'"))
    const kopf = stelle.slice(0, 400)
    expect(kopf).toMatch(/if \(!authed\(req, url\)\) return denyUnauthorized/)
    expect(kopf).toMatch(/if \(!writeAllowed\(req, res\)\) return/)
    expect(stelle.slice(0, 2000)).toMatch(/if \(!showOk\(parsed\)\) return/)
  })

  it('eine unbekannte Beobachtung wird abgewiesen', () => {
    expect(src).toMatch(/PATTERN_OBSERVATIONS\.includes\(gesehen\)/)
  })

  it('kein Zeitstempel vom Telefon', () => {
    // Weder der Server noch die Mobile-Seite schicken einen; der Renderer
    // stempelt beim Empfang.
    const stelle = src.slice(src.indexOf("pathname === '/pattern-checks'"))
    expect(stelle.slice(0, 2500)).not.toMatch(/\bat\b\s*:/)
    expect(ohneKommentare(walkSrc)).not.toMatch(/\bat:\s/)
    expect(ohneKommentare(appSrc)).toMatch(/at: new Date\(\)\.toISOString\(\)/)
  })

  it('ohne gewaehlte Quelle antwortet der Plan-Weg mit 503, nicht mit leer', () => {
    expect(src).toMatch(/state\.patternPlan \? 200 : 503/)
  })

  it('die Erwartung wird nicht zwischengespeichert', () => {
    // Sie aendert sich waehrend des Rundgangs; eine zwischengespeicherte
    // schickt jemanden an den falschen Monitor.
    const stelle = src.slice(src.indexOf("pathname === '/pattern.json'"))
    expect(stelle.slice(0, 600)).toMatch(/'Cache-Control', 'no-store'/)
  })
})

describe('Beide Listen der Beobachtungen bleiben gleich', () => {
  it('Hauptprozess und Renderer kennen dieselben vier Werte', () => {
    // Der Hauptprozess baut gegen eine eigene tsconfig und darf nicht in den
    // Renderer-Baum hineinreichen — die Liste steht deshalb zweimal. Laufen
    // sie auseinander, bleibt eine Rueckmeldung vom Handy am Server haengen,
    // waehrend der Techniker schon weitergegangen ist.
    const block = serverSrc.slice(
      serverSrc.indexOf('const PATTERN_OBSERVATIONS'),
      serverSrc.indexOf('interface MobileShareState'),
    )
    const imServer = [...block.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]).sort()
    expect(imServer).toEqual([...PATTERN_OBSERVATIONS].sort())
  })

  it('die Mobile-Seite bietet genau diese vier an', () => {
    const block = walkSrc.slice(
      walkSrc.indexOf('export const BEOBACHTUNGEN'),
      walkSrc.indexOf('export type Beobachtung'),
    )
    const imWalk = [...block.matchAll(/wert: '([a-z-]+)'/g)].map((m) => m[1]).sort()
    expect(imWalk).toEqual([...PATTERN_OBSERVATIONS].sort())
    // …und jede traegt eine Beschriftung, die ein Mensch versteht.
    expect(Object.keys(PATTERN_OBSERVATION_LABEL).sort()).toEqual([...PATTERN_OBSERVATIONS].sort())
  })
})

describe('Das Telefon zeigt die Erwartung ALS Erwartung', () => {
  const src = ohneKommentare(walkSrc)

  it('der Satz steht ueber der Liste und nicht nur im Kommentar', () => {
    // Invariante 16: ein Telefon, das eine Erwartung wie eine Rueckmeldung
    // darstellt, ist die gefaehrlichste Sorte Anzeige — man liest „KAMERA 1",
    // haelt es fuer bestaetigt und hat den Plan zweimal gelesen.
    expect(src).toMatch(/was laut Plan ankommen müsste/)
    expect(src).toMatch(/sieht kein Bild/)
  })

  it('je Ankunftsort steht „laut Plan", nicht ein blosser Name', () => {
    expect(src).toMatch(/Laut Plan müsste hier stehen/)
  })

  it('der gesehene Name wird gefragt, nicht freigestellt', () => {
    // „Falsches Bild" allein ist ein Symptom; der Name macht daraus den Befund.
    expect(src).toMatch(/Welcher Name steht drauf\?/)
    expect(src).toMatch(/melde\(stop, 'falsches-bild', gesehenerName\.trim\(\)\)/)
  })

  it('ein gescheiterter Versuch bleibt sichtbar', () => {
    // Der Techniker geht weiter, sobald er gedrueckt hat. Ein stiller
    // Fehlschlag hiesse: er glaubt, gemeldet zu haben.
    expect(src).toMatch(/nicht angekommen/)
  })

  it('im Nur-Lesen-Modus sagt die Seite es, statt Knoepfe wegzulassen', () => {
    // Ein fehlender Knopf ohne Grund laesst den Nutzer die App fuer kaputt
    // halten (dieselbe Regel wie bei Bedarf 109 auf der Patchliste).
    expect(src).toMatch(/Der Rückweg ist zu/)
  })
})
