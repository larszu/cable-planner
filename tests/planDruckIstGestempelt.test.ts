import { describe, expect, it } from 'vitest'
import { stripComments } from './support/stripComments'

// WAS HIER SCHIEFLIEF (gemessen 2026-09-04).
//
// Initiative 4 heisst „gestempelter Druck": auf jedem Blatt steht, welchem
// Planstand es entspricht, damit niemand nach einem Ausdruck von gestern
// arbeitet. `lib/documentStamp.ts` und der Titelblock in `lib/exportPdf.ts`
// waren gebaut, `stampForPlan` wurde aufgerufen — an EINER von drei Stellen.
//
//   App.tsx  Datei speichern     exportCanvasToPdf       stamp gesetzt ✓
//   App.tsx  Drucken             exportCanvasToPdfBytes  ohne stamp ✗
//   App.tsx  Rentman-Anhang      exportCanvasToPdfBytes  ohne stamp ✗
//
// Der Druck-Knopf druckte also ungestempelt — der Knopf, dem die ganze
// Initiative gilt. Und das Rentman-PDF haengt am Kundenprojekt.
//
// Dieselbe Form wie der Native-Dialoge-Guard und `sync:write-file`: die
// Absicht stand als Kommentar an der einen Stelle, die Nachbarn gingen daran
// vorbei. Ein Guard, der `stampForPlan` bloss irgendwo im Text sucht, waere
// gruen geblieben — er stand ja da. Dieser hier rechnet deshalb die Liste der
// AUFRUFE aus und verlangt von jedem einzelnen den Stempel.

const sources = import.meta.glob('../src/renderer/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Der PDF-Bauer der Plan-Canvas, in beiden Ausfuehrungen. */
const BAUER = /\bexportCanvasToPdf(?:Bytes)?\s*\(/g

interface Aufruf {
  datei: string
  index: number
  optionen: string
}

/**
 * Die Optionen-Objekte aller Aufrufe — tiefenbewusst geklammert.
 *
 * Ein Regex bis zur naechsten `}` wuerde beim ersten verschachtelten Objekt
 * (`onProgress`-Rumpf, `customPalette`) abbrechen und den Stempel uebersehen,
 * der dahinter steht.
 */
const aufrufe = (): Aufruf[] => {
  const out: Aufruf[] = []
  for (const [pfad, roh] of Object.entries(sources)) {
    const s = stripComments(roh)
    for (const m of s.matchAll(BAUER)) {
      // Vom letzten `{` des Arguments bis zur passenden `}`.
      const start = s.indexOf('{', m.index! + m[0].length)
      if (start < 0) continue
      let tiefe = 0
      let ende = start
      for (let i = start; i < s.length; i += 1) {
        if (s[i] === '{') tiefe += 1
        else if (s[i] === '}') {
          tiefe -= 1
          if (tiefe === 0) { ende = i; break }
        }
      }
      out.push({ datei: pfad.replace('../src/renderer/', ''), index: m.index!, optionen: s.slice(start, ende + 1) })
    }
  }
  return out
}

describe('jeder Plan-Ausdruck traegt den Stempel', () => {
  it('findet ueberhaupt Aufrufe — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waere der Test auch dann gruen, wenn der Bauer
    // umbenannt wird und `aufrufe()` leer zurueckkommt.
    expect(aufrufe().length).toBeGreaterThanOrEqual(3)
  })

  it('setzt an JEDEM Aufruf `stamp`', () => {
    const ohne = aufrufe()
      .filter((a) => !/\bstamp\s*:/.test(a.optionen))
      .map((a) => `${a.datei}@${a.index}`)
    expect(
      ohne,
      `Plan-PDF ohne Stempel: ${ohne.join(', ')}. Initiative 4 verspricht, dass ` +
        'jedes Blatt seinen Planstand nennt — ein ungestempelter Ausdruck ist genau ' +
        'das Blatt, das niemand einordnen kann.',
    ).toEqual([])
  })

  it('nimmt den Stempel aus `stampForPlan`, nicht aus einem Literal', () => {
    // Ein handgebautes Stempel-Objekt haette denselben Titelblock und einen
    // erfundenen Fingerabdruck — schlimmer als kein Stempel, weil es
    // Aktualitaet behauptet.
    const falsch = aufrufe()
      .filter((a) => /\bstamp\s*:/.test(a.optionen) && !/stamp:\s*stampForPlan\(/.test(a.optionen))
      .map((a) => `${a.datei}@${a.index}`)
    expect(falsch).toEqual([])
  })
})
