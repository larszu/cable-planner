import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// ---------------------------------------------------------------------------
// Eine Meldung ist Oberflaeche, auch wenn sie in `lib/` entsteht (#837).
//
// ─── DER BEFUND ────────────────────────────────────────────────────────────
//
// `drawingChecks.ts` schrieb seine `message:`-Texte als ROHE Zeichenketten und
// durchgehend auf Deutsch — in einem Repo, dessen Quellsprache seit E-28 `en`
// ist. Dieselben Saetze stehen im Plan-Check-Panel UND auf gedruckten
// Blaettern. Die `category:`-Werte daneben waren laengst englisch
// (`Open ports`, `Duplicate IP`): wer das Panel oeffnete, las eine englische
// Spalte neben einem deutschen Satz.
//
// `npm run lang:check` meldete dabei 0 Verstoesse, und das war kein Fehler des
// Waechters, sondern seine Grenze: er liest `t()`-Aufrufe, und das hier waren
// keine — es waren Daten.
//
// ─── WARUM DIESE PRUEFUNG STRUKTURELL IST UND NICHT SPRACHLICH ─────────────
//
// Der naheliegende Weg waere, die Meldungen zu klassifizieren. Genau das kann
// `klassifiziere()` aus `scripts/quellsprache.mjs` hier nicht zuverlaessig,
// und zwar in BEIDE Richtungen (gemessen 2026-09-10):
//
//     'Steckdosenleiste 6-fach'  -> null   (deutsch, nicht erkannt)
//     'Netzwerk', 'Kameras'      -> null   (deutsch, nicht erkannt)
//     'Allen & Heath SQ-5'       -> 'de'   (ein Herstellername)
//     'Jünger Audio DAP8'        -> 'de'   (ein Herstellername)
//
// Ein Waechter, der Hersteller meldet und deutsche Produktnamen durchlaesst,
// wird nach dem zweiten Fehlalarm abgeschaltet statt gelesen. Deshalb fragt
// dieser Test NICHT nach der Sprache, sondern nach der FORM: steht hinter
// `message:` / `text:` ein Literal, oder ein Aufruf? Das ist entscheidbar,
// braucht keine Wortliste und hat keine Fehlalarme.
//
// ─── DIE AUSNAHMELISTE IST DER PUNKT, NICHT DER MAKEL ──────────────────────
//
// 32 Module tragen heute noch rohe Meldungen. Sie stehen unten mit ihrer
// gemessenen ANZAHL, und der Test besteht darauf, dass keine davon WAECHST.
// Eine Liste, die nur „diese Datei ist ausgenommen" sagt, deckt ab morgen auch
// die naechste neue Meldung darin; eine Liste mit Zahlen deckt genau den
// Bestand und nichts weiter.
//
// Wer eine Datei aufraeumt, zieht ihre Zahl nach unten — der Test verlangt das
// sogar: eine Zahl ueber dem Ist ist derselbe Deckel wie eine zu hohe
// MIX_GRENZE und gibt den Platz frei, den der naechste Zuwachs still fuellt.
// ---------------------------------------------------------------------------

const WURZEL = join(process.cwd(), 'src', 'renderer')

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const voll = join(dir, eintrag)
    if (statSync(voll).isDirectory()) return dateien(voll)
    return /\.tsx?$/.test(eintrag) ? [voll] : []
  })

/**
 * `message:` oder `text:` mit einem LITERAL dahinter — einfach, doppelt oder
 * als Template. Ein Zeilenumbruch zwischen Doppelpunkt und Literal zaehlt mit:
 * der Formatierer bricht lange Zeilen genau dort um, und eine Meldung, die
 * dem Umbruch entkommt, waere die naechste stille Luecke.
 */
const ROHE_MELDUNG = /\b(?:message|text)\s*:\s*(?:\n\s*)?(['"`])/g

/**
 * Ein Literal ist in Ordnung, wenn im selben Objekt ein `schluessel:` steht.
 *
 * Das ist die Form, die `types/adapter.ts` und die anderen Urteils-Module
 * tragen: der englische Satz IST der Fallback, uebersetzt wird beim Anzeigen
 * ueber `schluessel` und `werte`. Ohne diese Ausnahme muesste dort ein
 * `einsetzen('…', {})` ohne Platzhalter stehen — Zierrat, nur damit der Test
 * schweigt, und ein Test, der zu solchen Zeilen zwingt, wird abgeschaltet.
 *
 * Geprueft wird ein Fenster von sechs Zeilen um den Treffer. Objekt-Grenzen
 * sauber zu bestimmen hiesse, TypeScript zu parsen; das Fenster deckt jede
 * Form ab, die der Formatierer dieses Repos erzeugt, und ein Literal SECHS
 * Zeilen von einem fremden `schluessel:` entfernt gibt es hier nicht.
 */
const NEBEN_SCHLUESSEL = 6

/** Kommentare raus: sie folgen der Repo-Konvention, nicht der Oberflaeche. */
const ohneKommentare = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

/**
 * Der gemessene Bestand am 2026-09-10, Datei fuer Datei. Diese Zahlen duerfen
 * SINKEN und nicht steigen.
 */
const BESTAND: Record<string, number> = {
  'lib/eventMetadata.ts': 11,
  'lib/circuitSuggest.ts': 11,
  'lib/transmissionRecord.ts': 10,
  'lib/bridge.ts': 9,
  'lib/tallyPosition.ts': 8,
  'lib/costComparison.ts': 8,
  'lib/namingScheme.ts': 7,
  'lib/labourCost.ts': 7,
  'lib/tallyMap.ts': 6,
  'lib/multicastPlan.ts': 6,
  'lib/micAssignment.ts': 6,
  'lib/graphml/parser.ts': 6,
  'lib/crewNetworkSheet.ts': 6,
  'lib/addressTemplate.ts': 6,
  'lib/textProtocol.ts': 5,
  'lib/ptpPlan.ts': 5,
  'lib/networkSegments.ts': 5,
  'lib/jobHandover.ts': 5,
  'lib/fallbackPlan.ts': 5,
  'lib/dantePatch.ts': 5,
  'lib/spectrumScan.ts': 4,
  'lib/channelIdentity.ts': 4,
  'lib/salvoSheet.ts': 3,
  'lib/rfCoordination.ts': 3,
  'lib/mvSheet.ts': 3,
  'lib/clientSummary.ts': 3,
  'lib/templateScope.ts': 2,
  'lib/exportPdf.ts': 2,
  'lib/receiptRead.ts': 1,
  'lib/portLabel.ts': 1,
  'lib/patternSharePlan.ts': 1,
  'lib/exportGreengo.ts': 1,
}

/**
 * Die Module, die mit #837 gewickelt wurden. Sie stehen NICHT im Bestand: fuer
 * sie gilt null, und der Test sagt das ausdruecklich noch einmal. Ohne diese
 * Liste waere ein Rueckfall dort nur „eine Datei mehr im Bestand" — hier ist
 * er ein benannter Rueckschritt.
 */
const GEWICKELT = [
  'lib/drawingChecks.ts',
  // #838 — kam mit dem Plan-Check fuer Port-Gruppen dazu. Der Satz zum Befund
  // steht seither in `portGroups.ts` statt dreimal im JSX der
  // Eigenschaften-Leiste; er traegt `schluessel` und `werte` wie die anderen.
  'lib/portGroups.ts',
  'lib/labelDerivation.ts',
  'lib/exportPdfVector.ts',
  'types/cableSpec.ts',
  'types/adapter.ts',
  'types/conductor.ts',
  'types/displayCapability.ts',
]

const zaehle = (): Map<string, number> => {
  const treffer = new Map<string, number>()
  for (const datei of dateien(WURZEL)) {
    const rel = relative(WURZEL, datei).split('\\').join('/')
    if (!rel.startsWith('lib/') && !rel.startsWith('types/')) continue
    // Das Woerterbuch IST eine Sammlung von Literalen — das ist sein Zweck.
    if (rel.includes('i18n')) continue
    const quelle = ohneKommentare(readFileSync(datei, 'utf8'))
    const zeilen = quelle.split('\n')
    let n = 0
    for (const m of quelle.matchAll(ROHE_MELDUNG)) {
      const zeile = quelle.slice(0, m.index).split('\n').length - 1
      const fenster = zeilen
        .slice(Math.max(0, zeile - NEBEN_SCHLUESSEL), zeile + NEBEN_SCHLUESSEL)
        .join('\n')
      if (/\bschluessel:/.test(fenster)) continue
      n += 1
    }
    if (n > 0) treffer.set(rel, n)
  }
  return treffer
}

describe('Meldungen aus lib/ und types/ sind gewickelt', () => {
  it('kein Modul traegt mehr rohe Meldungen als der eingefrorene Bestand', () => {
    const ist = zaehle()
    const zuwachs: string[] = []
    for (const [datei, n] of ist) {
      const erlaubt = BESTAND[datei] ?? 0
      if (n > erlaubt) zuwachs.push(`${datei}: ${n} statt ${erlaubt}`)
    }
    expect(
      zuwachs,
      'Neue rohe `message:`/`text:`-Literale in lib/ oder types/. Sie erscheinen ' +
        'im Plan-Check-Panel UND auf gedruckten Blaettern — der Sprach-Waechter ' +
        'sieht sie nicht, weil sie keine `t()`-Aufrufe sind. Entweder ueber ' +
        '`tr(key, en)` wickeln (siehe drawingChecks.ts) oder, wenn es wirklich ' +
        'kein Oberflaechen-Text ist, die Zahl unten mit Begruendung anheben.',
    ).toEqual([])
  })

  it('die gewickelten Module bleiben gewickelt', () => {
    const ist = zaehle()
    const rueckfall = GEWICKELT.filter((d) => (ist.get(d) ?? 0) > 0).map(
      (d) => `${d}: ${ist.get(d)}`,
    )
    expect(
      rueckfall,
      'Ein mit #837 gewickeltes Modul traegt wieder rohe Meldungen. Das ist kein ' +
        'Zuwachs im Bestand, sondern ein Rueckschritt an einer Stelle, die schon ' +
        'einmal durchgegangen wurde.',
    ).toEqual([])
  })

  it('der Bestand ist nicht ueber dem Ist — sonst deckt er kuenftigen Zuwachs', () => {
    const ist = zaehle()
    const zuHoch: string[] = []
    for (const [datei, erlaubt] of Object.entries(BESTAND)) {
      const n = ist.get(datei) ?? 0
      if (n < erlaubt) zuHoch.push(`${datei}: gemessen ${n}, eingetragen ${erlaubt}`)
    }
    expect(
      zuHoch,
      'Eine Bestandszahl liegt ueber dem gemessenen Ist. Das ist derselbe Deckel ' +
        'wie eine zu hohe MIX_GRENZE: wer aufraeumt und die Zahl stehen laesst, ' +
        'gibt den Platz frei, den der naechste Zuwachs still fuellt. Zahl auf den ' +
        'neuen Wert setzen (oder den Eintrag loeschen, wenn er auf 0 ist).',
    ).toEqual([])
  })

  it('die Pruefung sieht ueberhaupt etwas — Gegenprobe zum Muster', () => {
    // Ohne sie waere ein kaputtes Muster die gefaehrlichste Art gruen: es
    // findet nichts, und Nichts sieht hier aus wie ein Ergebnis.
    const gesamt = [...zaehle().values()].reduce((a, b) => a + b, 0)
    expect(gesamt).toBeGreaterThan(100)
  })
})
