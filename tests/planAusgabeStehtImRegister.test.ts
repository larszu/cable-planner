import { describe, expect, it } from 'vitest'
import { stripComments } from './support/stripComments'

// WAS HIER SCHIEFLIEF (gemessen 2026-09-04, Gegenrunde zu Runde 10).
//
// Initiative 5 verspricht die Vorwaerts-Frage: „welches ausgeteilte Blatt ist
// hin". `documentRegistry` fuehrt `plan` als vollwertiges Dokument mit
// berechenbarem Stand (`DOCUMENT_STANDS.plan = planFingerprint`),
// `changeImpact` hat ein eigenes Feld `planChanged`, und der Papier-Rueckweg
// rechnet ausdruecklich damit, dass jemand einen GEDRUCKTEN PLAN in der Hand
// haelt und dessen acht Zeichen eintippt.
//
// `recordEmission` hatte trotzdem genau EINEN Aufrufer: den
// Installations-Dialog. Die vier Wege, die ein Plan-PDF ausgeben — Datei,
// Vektor-Datei, Drucken, Rentman-Anhang — schrieben nichts ins Register.
//
// Der Schaden ist der, den der Code selbst benennt: „eine Luecke in einem
// Register sieht aus wie 'nicht ausgegeben'". Wer den Plan druckte, danach
// eine Kabellaenge aenderte und „Ausgegebene Dokumente" oeffnete, las „Fuer
// dieses Projekt wurde noch nichts ausgegeben" — falsche Beruhigung ueber das
// Blatt, das beim Kunden liegt.
//
// Dieselbe Form wie beim Stempel selbst (tests/planDruckIstGestempelt.ts): die
// Absicht steht als Kommentar an EINER Stelle, die Nachbarn gehen daran
// vorbei. Ein Guard, der `recordEmission` bloss irgendwo im Text sucht, waere
// gruen geblieben — es stand ja da, im Installations-Dialog. Dieser hier
// zaehlt die Plan-Ausgabewege und verlangt fuer jeden eine Aufzeichnung.

const sources = import.meta.glob('../src/renderer/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Jeder Weg, auf dem ein Plan-PDF entsteht — Raster wie Vektor. */
const AUSGABE = /\bexportCanvasToPdf(?:Bytes|Vector)?\s*\(/g
const AUFZEICHNUNG = /\brecordPlanEmission\s*\(\s*\)/g

const treffer = (re: RegExp) => {
  const out: string[] = []
  for (const [pfad, roh] of Object.entries(sources)) {
    const s = stripComments(roh)
    for (const m of s.matchAll(re)) out.push(`${pfad.split('/src/renderer/')[1]}@${m.index}`)
  }
  return out
}

describe('jeder Plan-Ausgabeweg steht im Dokument-Register', () => {
  it('findet die Renderer-Quellen ueberhaupt', () => {
    // Ohne diese Zeile prueft der Guard bei kaputtem Glob still nichts.
    expect(Object.keys(sources).length).toBeGreaterThan(100)
  })

  it('es gibt mindestens die vier bekannten Ausgabewege', () => {
    // Untergrenze, damit der Guard nicht dadurch gruen wird, dass jemand die
    // Ausgabe verschiebt und beide Zahlen auf null fallen.
    expect(treffer(AUSGABE).length).toBeGreaterThanOrEqual(4)
  })

  it('auf jeden Ausgabeweg kommt genau eine Aufzeichnung', () => {
    expect(treffer(AUFZEICHNUNG).length).toBe(treffer(AUSGABE).length)
  })

  it('die Aufzeichnung geht wirklich ins Register, unter dem Schluessel plan', () => {
    // Sonst waere `recordPlanEmission` eine Funktion, die den Guard bedient
    // und sonst nichts tut.
    const app = stripComments(
      Object.entries(sources).find(([p]) => p.endsWith('/src/renderer/App.tsx'))?.[1] ?? '',
    )
    expect(app).toMatch(/const recordPlanEmission[\s\S]{0,400}recordEmission\(/)
    expect(app).toMatch(/const recordPlanEmission[\s\S]{0,400}'plan'/)
  })

  it('plan ist im Register ueberhaupt ein Dokument mit Stand', () => {
    // Haette `plan` keinen Stand, liefe recordEmission wirkungslos durch
    // (documentLog.ts kehrt ohne Stand zurueck) und der Guard waere Theater.
    const reg = stripComments(
      Object.entries(sources).find(([p]) => p.endsWith('lib/documentRegistry.ts'))?.[1] ?? '',
    )
    expect(reg).toMatch(/DOCUMENT_STANDS[\s\S]{0,600}\bplan:/)
  })
})
