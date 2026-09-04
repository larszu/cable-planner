// ───────────────────────────────────────────────────────────────────────────
// Kein Dokument darf die eigene Software als Open Source ausgeben.
//
// WARUM ES DAS GIBT. Gemessen 2026-09-04: `README.md` Zeile 44 sagte
// „CablePlanner is free, open-source broadcast cable planning software", waehrend
// `LICENSE` und Zeile 273 desselben Dokuments proprietaer sagen. Dieselbe Aussage
// stand in der JSON-LD-Beschreibung von `docs/index.html` (die Google als
// Rich-Result ausliefert) und im Download-Absatz derselben Seite als
// „Free, open source, proprietary (free to use)" — ein Satz, der sich selbst
// widerspricht. `scripts/generate-notices.mjs` schrieb ausserdem weiterhin
// „Cable Planner (eigener Code: MIT)"; die erzeugte Datei war von Hand
// korrigiert, ihre Quelle nicht — der naechste Lauf haette es zurueckgeschrieben.
//
// Das ist keine Formulierungsfrage. Eine Lizenzangabe ist eine Rechtsaussage:
// wer „open source" liest, darf forken und weiterverbreiten. Genau das erlaubt
// die Lizenz nicht.
//
// WIE ER PRUEFT. Nicht gegen eine Liste bekannter Stellen — die waere am Tag
// ihrer Niederschrift vollstaendig und am naechsten nicht mehr. Er laeuft ueber
// JEDES nutzerseitige Dokument (README + alles unter `docs/`) und meldet jedes
// Open-Source-Wort, das nicht verneint ist.
//
// AUSNAHMEN stehen nicht hier, sondern als Marker `lizenzaussage: fremd` IM
// jeweiligen Dokument — dort sieht sie, wer die Datei liest, und nicht nur, wer
// diesen Test liest. Drei Dokumente reden legitim ueber FREMDE Lizenzen
// (Fremdpaket-Notices, Konkurrenzvergleich, Bedarfsanalyse mit NetBox). Ihre
// Zahl wird mitgezaehlt: wer einen vierten Marker setzt, faellt hier auf und
// muss ihn begruenden, statt den Guard still auszuhebeln.
//
// WAS ER NICHT PRUEFT: ob die Lizenz die richtige ist. Er prueft, dass die
// Dokumente dieselbe Aussage machen wie `LICENSE`.
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

/** Marker, mit dem ein Dokument sich als „redet ueber fremde Lizenzen" ausweist. */
const FREMD_MARKER = 'lizenzaussage: fremd'

/**
 * Woerter, die eine Open-Source-Lizenzierung behaupten. Bewusst nur die
 * Behauptung, nicht jede Lizenznennung: „Apache 2.0" oder „GPL" neben einem
 * Fremdprodukt ist eine Tatsache ueber das Fremdprodukt, nicht ueber uns.
 */
const BEHAUPTUNG_QUELLE = 'open[-\\s]?source|opensource|quelloffen|MIT[-\\s](?:Lizenz|lizenziert|licen[cs]e[d]?)'
/** Frisch pro Aufruf: ein geteiltes /g/-RegExp traegt `lastIndex` mit und ueberspringt Treffer. */
const behauptung = () => new RegExp(BEHAUPTUNG_QUELLE, 'gi')

/** Verneinung unmittelbar davor — „not open source" ist die Klarstellung, nicht der Fehler. */
const VERNEINT = /\b(?:not|no|nicht|kein|keine|keinen)\b[^.!?\n]{0,40}$/i

const nutzerDokumente = (): string[] => {
  const treffer: string[] = []
  const lauf = (verzeichnis: string) => {
    for (const eintrag of readdirSync(verzeichnis)) {
      const pfad = join(verzeichnis, eintrag)
      if (statSync(pfad).isDirectory()) {
        if (eintrag === 'node_modules' || eintrag.startsWith('.')) continue
        lauf(pfad)
        continue
      }
      if (/\.(md|html)$/i.test(eintrag)) treffer.push(pfad)
    }
  }
  for (const datei of readdirSync(ROOT)) {
    const pfad = join(ROOT, datei)
    if (statSync(pfad).isFile() && /\.md$/i.test(datei)) treffer.push(pfad)
  }
  lauf(join(ROOT, 'docs'))
  return treffer
}

type Fund = { datei: string; zeile: number; text: string }

const behauptungenIn = (pfad: string): Fund[] => {
  const inhalt = readFileSync(pfad, 'utf8')
  const funde: Fund[] = []
  inhalt.split('\n').forEach((zeile, i) => {
    // Der Marker selbst enthaelt kein Behauptungswort, aber der Kommentar um ihn
    // herum koennte eines enthalten — die Marker-Zeile zaehlt nie als Befund.
    if (zeile.includes(FREMD_MARKER)) return
    for (const treffer of zeile.matchAll(behauptung())) {
      const davor = zeile.slice(0, treffer.index)
      if (VERNEINT.test(davor)) continue
      funde.push({ datei: relative(ROOT, pfad), zeile: i + 1, text: zeile.trim().slice(0, 140) })
    }
  })
  return funde
}

describe('Lizenzaussage in der Dokumentation', () => {
  const dokumente = nutzerDokumente()

  it('die Praemisse stimmt noch: LICENSE ist proprietaer', () => {
    // Wuerde die Lizenz auf Open Source wechseln, waere dieser ganze Test falsch
    // herum. Er soll dann rot werden und gelesen — nicht still zur Attrappe.
    const lizenz = readFileSync(join(ROOT, 'LICENSE'), 'utf8')
    expect(lizenz).toMatch(/PROPRIET/i)
  })

  it('findet ueberhaupt Dokumente', () => {
    // Ein leerer Suchlauf ist gruen und wertlos. Der haeufigste Weg dorthin ist
    // ein umbenanntes Verzeichnis, nicht eine geloeschte Doku.
    expect(dokumente.length).toBeGreaterThan(10)
    expect(dokumente.some((d) => d.endsWith('README.md'))).toBe(true)
    expect(dokumente.some((d) => d.endsWith(join('docs', 'index.html')))).toBe(true)
  })

  it('genau drei Dokumente sind als „redet ueber fremde Lizenzen" markiert', () => {
    const markiert = dokumente
      .filter((d) => readFileSync(d, 'utf8').includes(FREMD_MARKER))
      .map((d) => relative(ROOT, d))
      .sort()
    expect(
      markiert,
      'Ein neuer Marker schaltet ein ganzes Dokument aus der Pruefung. ' +
        'Wer einen setzt, traegt ihn hier nach und begruendet ihn im Commit.',
    ).toEqual([
      'THIRD-PARTY-LICENSES.md',
      join('docs', 'comparison.html'),
      join('docs', 'festinstallation-readiness.md'),
    ])
  })

  it('kein unmarkiertes Dokument behauptet Open Source', () => {
    const funde = dokumente
      .filter((d) => !readFileSync(d, 'utf8').includes(FREMD_MARKER))
      .flatMap(behauptungenIn)
    expect(
      funde.map((f) => `${f.datei}:${f.zeile}  ${f.text}`),
      'LICENSE sagt proprietaer. Entweder die Stelle umformulieren, oder — wenn ' +
        'sie ueber ein Fremdprodukt spricht — das Dokument mit „' +
        FREMD_MARKER +
        '" markieren.',
    ).toEqual([])
  })

  it('auch der Generator der Fremdpaket-Notices behauptet nichts Falsches', () => {
    // THIRD-PARTY-LICENSES.md ist generiert. Eine Korrektur an der Datei haelt
    // nur bis zum naechsten `node scripts/generate-notices.mjs`; die Aussage muss
    // in der Quelle stehen. Genau daran ist die MIT-Behauptung ueberlebt.
    const generator = readFileSync(join(ROOT, 'scripts', 'generate-notices.mjs'), 'utf8')
    // Nicht nur die eine Ausgabezeile: der Kopfkommentar desselben Skripts sagte
    // ebenfalls „App-Lizenz: MIT". Eine Behauptung ueber die EIGENE Lizenz darf im
    // Generator an keiner Stelle MIT lauten — egal ob Kommentar oder Ausgabe.
    expect(generator).not.toMatch(/(?:App-Lizenz|eigene[rs]? (?:Code|Lizenz))\s*[:=]\s*MIT/i)
    expect(generator).toMatch(/eigener Code:\s*proprietär/i)
    expect(generator).toContain(FREMD_MARKER)
  })

  it('die Verneinungs-Ausnahme greift nur bei echter Verneinung', () => {
    // Selbstprobe: sonst waere „kein" irgendwo weiter vorn in der Zeile ein
    // Freifahrtschein fuer eine Behauptung dahinter.
    expect(VERNEINT.test('It is proprietary software, not ')).toBe(true)
    expect(VERNEINT.test('CablePlanner is free, ')).toBe(false)
    expect(behauptung().test('free, open-source broadcast')).toBe(true)
  })
})
