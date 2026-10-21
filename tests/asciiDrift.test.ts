import { beforeAll, describe, expect, it } from 'vitest'
import ts from 'typescript'
// @ts-expect-error — reines JS-Modul ohne Typen
import { klassifiziere } from '../scripts/quellsprache.mjs'

// ── Meldungstexte in richtigem Deutsch ─────────────────────────────────────
//
// Die Anwendung schrieb ihre eigene Sprache in ASCII-Ersatzformen: „Geraet",
// „Domaene", „traegt", „Laenge". Das stand nicht in Kommentaren, sondern in
// den Texten selbst — in Befunden, in Fehlermeldungen, in Spalten von
// Blaettern, die beim Kunden auf dem Tisch landen. Ein deutscher Text mit
// „ue" statt „ü" liest sich wie eine unfertige Uebersetzung, und genau das
// hat der Nutzer am 2026-09-07 an der Oberflaeche beanstandet.
//
// DIESER GUARD DREHT DIE BEWEISLAST UM. Er kennt keine Liste falscher
// Woerter — die waere immer unvollstaendig und wuerde beim naechsten neuen
// Wort stillschweigend durchlassen. Er kennt stattdessen die Liste der
// Woerter, in denen „ae/oe/ue" KEIN Umlaut-Ersatz ist: englische Begriffe
// („value", „issue"), Silbenregeln fuer deutsche Woerter mit echter
// Vokalfolge („neue", „Steuerung", „Quelle" — `istEchteFolge`) und
// Hex-Ziffernfolgen. Alles andere ist ein Befund.
// Wer ein neues englisches Wort einfuehrt, traegt es unten ein; wer eine neue
// ASCII-Ersatzform einfuehrt, faellt auf.
//
// KOMMENTARE SIND NICHT DABEI. Die bleiben ASCII, wie im ganzen Repo — sie
// stehen nie auf einem Blatt und nie in einem Dialog.

const roh = {
  // Ohne `vendor/`: lz-scopes ist eine Kopie fremden Codes mit eigener
  // Rechtschreibung (`VENDOR.md`), Treffer dort waeren nicht hier zu beheben —
  // und „Bluetooth" ist kein Umlaut-Ersatz.
  // Ebenso ohne `avplan/scene3d/` (#997): byte-genaue Suite-Kopie (ADR-015),
  // Korrekturen gehoeren in die Suite.
  ...(import.meta.glob(['../src/renderer/**/*.ts', '!../src/renderer/vendor/**', '!../src/renderer/avplan/scene3d/**'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>),
  ...(import.meta.glob('../src/renderer/**/*.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>),
  ...(import.meta.glob('../src/main/**/*.{ts,cts}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>),
  // `.tsx` GEHOERT DAZU, und zwar seit dem 2026-09-10 auch wirklich.
  //
  // Bis dahin stand hier `**/*.ts` — und die gesamte Oberflaeche der
  // Mobile-Ansicht liegt in `.tsx` (`MobileApp.tsx`, `PatternWalk.tsx`).
  // Der Guard sah von diesem Ordner also die Hilfsmodule und keinen einzigen
  // Text, den jemand liest. Aufgefallen ist es erst, als die Beschriftungen
  // ins Woerterbuch `mobile/i18n.ts` wanderten: dieselben Saetze, dieselbe
  // Schreibweise, ploetzlich geprueft. Ein Glob, der die Endung der
  // interessanten Dateien nicht kennt, ist die leiseste Form von blind.
  ...(import.meta.glob('../src/mobile/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>),
  ...(import.meta.glob('../src/viewer/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>),
}

/** Die Stellen im Literal, an denen der Text steht — ohne Anfuehrungszeichen,
 *  ohne `${`/`}`. Damit bleibt ein Bezeichner in `${hatGeraet}` aussen vor:
 *  er ist Code, kein Text. */
const INNEN: Partial<Record<ts.SyntaxKind, [number, number]>> = {
  [ts.SyntaxKind.StringLiteral]: [1, -1],
  [ts.SyntaxKind.NoSubstitutionTemplateLiteral]: [1, -1],
  [ts.SyntaxKind.TemplateHead]: [1, -2],
  [ts.SyntaxKind.TemplateMiddle]: [1, -2],
  [ts.SyntaxKind.TemplateTail]: [1, -1],
  // Text zwischen JSX-Tags ist genauso Anzeige wie ein Literal — und war in
  // der ersten Fassung dieses Guards nicht dabei.
  [ts.SyntaxKind.JsxText]: [0, 0],
}

/**
 * Woerter, in denen „ae/oe/ue" kein Umlaut-Ersatz ist und die keine
 * Silbenregel (`istEchteFolge`) erklaert — praktisch nur noch Englisch und
 * Eigennamen. Deutsche Woerter mit echter Vokalfolge (Quelle, Steuer, Dauer,
 * aktuell) gehoeren NICHT hierher, sondern sind eine Regel. Wer hier etwas
 * eintraegt, sagt: dieses Wort ist so richtig geschrieben.
 */
const HARMLOS = new Set(
  [
    // Englisch — Fachbegriffe, Feldnamen im Klartext, Fliesstext in Belegen.
    // camelCase-Bezeichner zerfallen vorher in Teile (`withoutValue` →
    // „value"), deshalb steht hier nur das Grundwort. Alles mit „qu" davor
    // (request, query, unique, frequency, sequence …) erklaeren die
    // Silbenregeln oben.
    'does', 'goes', 'value', 'values', 'issue', 'issues', 'issued', 'due', 'overdue',
    'analogue', 'catalogue', 'colleague', 'continue', 'discontinued', 'cues', 'guess',
    'guessed', 'whoever', 'true', 'blue', 'bluebird', 'bluemic', 'venue', 'venues',
    // Kleingeschriebene Modul-/Komponentennamen im Klartext
    'venuescopedialog', 'catalogueevidence',
    // Eigennamen, Protokolle, Einheiten. 2026-09-28, mit dem Cisco-Katalog:
    // „UPOE" ist Ciscos Schreibweise fuer Universal PoE — das U davor macht
    // aus dem „OE" kein „Ö".
    'segoe', 'poe', 'poestandard', 'poestandards', 'poebudget', 'poebudgetw',
    'erpoe', 'upoe', 'aes', 'aea', 'aearibbonmics',
    // Ein Paar fuer sich ist nie ein deutsches Wort: es kommt aus einer UUID,
    // aus einem URL-Pfad („/ue_US/") oder aus `danteNaming`, das genau diese
    // Ersetzung VORNIMMT, weil Dante-Namen ASCII sein muessen.
    'ae', 'oe', 'ue',
  ].map((w) => w.toLowerCase()),
)

/**
 * Literale, die eine ASCII-Ersatzform tragen DUERFEN, mit dem Grund. Sie sind
 * keine Anzeige: die Alias-Listen nehmen fremde Spaltenueberschriften
 * ENTGEGEN — andere Programme schreiben „Geraet", und wer das nicht liest,
 * verliert die Spalte. Die Ids stehen in gespeicherten Dateien; sie
 * umzubenennen braeche die Daten und nicht die Schreibweise.
 */
/**
 * Kennungen, die als Wert in Dateien und in QR-Codes stehen: die Dokument-Ids
 * aus `documentRegistry` und die Dateinamen der Ausgaben. Sie sind keine
 * Anzeige — sie werden verglichen. Ein „rack-tür" fiele gegen jedes frueher
 * gedruckte Blatt durch, und ein Umlaut im Dateinamen laeuft ueber drei
 * Betriebssysteme unterschiedlich.
 */
const KENNUNGEN = new Set([
  'geraete-identitaet', 'rack-tuer', 'kunden-uebersicht', 'dante-aenderungen',
  'gewicht-waerme', 'ausweich-geruest', 'geraete-bom', 'uebergabe',
  'post-uebergabe', 'pult-aenderungen', 'pult-kanaele', 'stueckliste',
  'rueckgabe-befunde.csv', 'schaeden.csv',
  // Fehlercode aus @avplan/floorplan (ADR-015, Kopie unter avplan/). Er wird
  // verglichen, nicht angezeigt — und die Kopie darf hier nicht geaendert
  // werden; die Meldung dazu steht uebersetzt in `planUebernahme.ts`.
  'pdf-nicht-verfuegbar',
])

const AUSNAHMEN: Record<string, readonly string[]> = {
  'renderer/lib/csvImportPlan.ts': ['geraet', 'hoeheneinheiten'],
  'renderer/lib/dantePatch.ts': ['rxgeraet', 'txgeraet', 'empfaenger'],
  'renderer/lib/networkReconcile.ts': ['geraet'],
  'renderer/lib/documentRegistry.ts': ['post-uebergabe', 'kunden-uebersicht'],
  // Die Dokument-Kennung im QR-Code. Sie wird gescannt und verglichen, nicht
  // gelesen — ein Blatt mit „übergabe" fiele gegen jedes frueher gedruckte
  // durch.
  'renderer/lib/handoverPackage.ts': ['uebergabe'],
  // Der Ordnername der Anhänge-Ablage, wie er auf der Platte steht. Er ist
  // absichtlich ASCII (`src/main/services/attachmentStore.ts`): ein „ä" kommt
  // zwischen macOS und Linux verschieden normalisiert an, und der Ordner
  // wäre nach dem Kopieren nicht mehr zu finden. Die Texte nennen ihn so,
  // wie der Nutzer ihn im Dateimanager sieht.
  'renderer/lib/dataDictionary.ts': ['anhaenge'],
  'renderer/lib/i18n/de.ts': ['anhaenge'],
}

/** Hex-Folgen (Farben, Fingerabdruecke) bestehen nur aus a-f und Ziffern. */
const istHex = (wort: string) => wort.length >= 3 && /^[0-9a-f]+$/i.test(wort)

/**
 * camelCase-Bezeichner zerfallen in ihre Teile: `toEquipmentId` traegt „oE"
 * ueber eine Grenze hinweg, `withoutValue` ist „without" + „Value". Ein Paar
 * zaehlt nur innerhalb eines Teils und nur gleich geschrieben („ae", „Ae", „AE").
 */
const teilwoerter = (wort: string): string[] => wort.split(/(?<=[a-zäöüß])(?=[A-ZÄÖÜ])/)

/**
 * Silbenregeln: wann ein „ae/oe/ue" eine echte Vokalfolge ist und KEIN
 * Umlaut-Ersatz. Sie gelten je Fundstelle, nicht je Wort — „Steuerfuehrung"
 * bleibt ein Befund, obwohl „Steuer" harmlos ist.
 *
 * Frueher stand jede Zusammensetzung einzeln in HARMLOS (Signalquelle,
 * Schallquelle, Mittenfrequenz, Frequenztabelle, Steuersystem …), und jedes
 * neue Kompositum war ein Fehlalarm. Die Regeln treffen den Wortbaustein, also
 * auch das naechste Kompositum:
 *  - „qu" + e: Quelle, Frequenz, quer, Request, unique — nach q steht im
 *    Deutschen nie ein ü.
 *  - Diphthong + e: „eu"/„au" vor e — Steuer, Feuer, neue, treue, Dauer,
 *    bauen, genaue. „eü"/„aü" kommt nicht vor.
 *  - „-uell" nach t/n/s/d: aktuell, manuell, visuell, individuell. Nicht
 *    nach f: „fuellen" ist „füllen".
 *  - „ko-ex": Koexistenz, coexist.
 *  - „zu-er": zuerst — Vorsilbe „zu" vor „er".
 */
const istEchteFolge = (klein: string, i: number): boolean => {
  const vor = klein[i - 1] ?? ''
  if (klein.startsWith('ue', i)) {
    if (vor === 'q') return true
    if (vor === 'e' || vor === 'a') return true
    if ('tnsd'.includes(vor) && vor !== '' && klein.startsWith('ll', i + 2)) return true
    if (i === 1 && vor === 'z' && klein[i + 2] === 'r') return true
  }
  if (klein.startsWith('oe', i) && (vor === 'k' || vor === 'c') && klein[i + 2] === 'x') return true
  return false
}

/** Traegt dieses Teilwort ein Paar, das keine Silbenregel erklaert? */
const hatErsatzform = (teil: string): boolean => {
  const klein = teil.toLowerCase()
  for (const m of teil.matchAll(/ae|oe|ue|Ae|Oe|Ue|AE|OE|UE/g)) {
    if (!istEchteFolge(klein, m.index!)) return true
  }
  return false
}

interface Befund {
  datei: string
  wort: string
  text: string
}

/**
 * Ein i18n-SCHLUESSEL ist Code, kein Text.
 *
 * BEFUND 2026-09-08: der Waechter meldete `'app.loadReport.unknownValue'`,
 * weil „Value" auf „ue" endet. Das ist kein Umlaut-Ersatz, sondern ein
 * englisches Wort in einem Bezeichner, den niemand liest — er wird
 * NACHGESCHLAGEN. Der Ausweg war zweimal, den Schluessel umzubenennen; beim
 * dritten Mal waere jemand auf die Idee gekommen, den Waechter zu entschaerfen.
 *
 * Die Form ist eng gefasst: nur ASCII, Punkte als Trenner, mindestens zwei
 * Teile, keine Leerzeichen. Ein deutscher Anzeigetext sieht so nie aus — und
 * ein ASCII-Ersatz IM ANZEIGETEXT bleibt damit weiter ein Befund.
 */
const istSchluessel = (text: string): boolean =>
  /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/.test(text.trim())

const scanne = (): { befunde: Befund[]; literale: number } => {
  const befunde: Befund[] = []
  let literale = 0
  for (const [pfad, src] of Object.entries(roh)) {
    const kurz = pfad.replace(/^.*\/src\//, '')
    const erlaubt = new Set((AUSNAHMEN[kurz] ?? []).map((w) => w.toLowerCase()))
    const sf = ts.createSourceFile(kurz, src, ts.ScriptTarget.Latest, true)
    const lauf = (node: ts.Node): void => {
      // Ein Modul-Pfad ist Code: `import … from '../lib/venueScopeDialog'`.
      const eltern = node.parent as ts.Node | undefined
      const modulPfad =
        !!eltern &&
        (ts.isImportDeclaration(eltern) || ts.isExportDeclaration(eltern)) &&
        eltern.moduleSpecifier === node
      const spanne = modulPfad ? undefined : INNEN[node.kind]
      if (spanne) {
        const text = src.slice(node.getStart(sf) + spanne[0], node.getEnd() + spanne[1])
        literale += 1
        // Platzhalter sind Code, kein Text: `format()` schlaegt `{laenge}` als
        // SCHLUESSEL nach. Wer daraus `{länge}` macht, bricht die Einsetzung
        // und bekommt die geschweifte Klammer im Dialog zu sehen — der
        // Uebersetzungs-Eintrag im en-Dict war genau so kaputtgegangen.
        const ohnePlatzhalter = text.replace(/\{[^}]*\}/g, ' ')
        // NUR AUF DEUTSCHEM TEXT, und das ist seit E-28 (2026-09-09) der
        // Unterschied zwischen einem Waechter und einem Fehlalarm-Generator.
        //
        // Dieser Lauf sucht UMLAUT-ERSATZFORMEN: „ue" fuer „ü", „oe" fuer
        // „ö". Solange Deutsch die Quellsprache war, war jedes „ue" im
        // Quelltext verdaechtig. Seit der Drehung ist der Quelltext
        // ENGLISCH — und dort ist „ue" ein voellig normaler Buchstabenlauf:
        // Guest, value, question, issue, queue, true, due, continue, blue,
        // argue. Gemessen: von zwoelf gepruefen englischen Alltagswoertern
        // treffen ZEHN das Muster.
        //
        // Der Schaden ist deshalb nicht verschwunden, er ist UMGEZOGEN: er
        // sitzt jetzt im deutschen Woerterbuch. Dort greift der Lauf
        // weiterhin, weil `klassifiziere` deutsche Zeilen erkennt — und dort
        // ist ein „ue" wieder das, was es war.
        const istDeutsch = klassifiziere(ohnePlatzhalter) === 'de'
        if (istDeutsch && !erlaubt.has(text.toLowerCase()) && !KENNUNGEN.has(text.trim()) && !istSchluessel(text)) {
          for (const wort of ohnePlatzhalter.match(/[A-Za-zÄÖÜäöüß]+/g) ?? []) {
            for (const teil of teilwoerter(wort)) {
              if (HARMLOS.has(teil.toLowerCase()) || erlaubt.has(teil.toLowerCase()) || istHex(teil)) continue
              if (!hatErsatzform(teil)) continue
              befunde.push({ datei: kurz, wort: teil, text: text.slice(0, 70) })
            }
          }
        }
      }
      ts.forEachChild(node, lauf)
    }
    lauf(sf)
  }
  return { befunde, literale }
}

describe('Silbenregeln: echte Vokalfolge oder Umlaut-Ersatz', () => {
  // Die Regeln sind eine LOECHERBEDINGUNG wie die Schluessel-Form unten:
  // was sie durchlassen, prueft niemand mehr. Deshalb stehen beide Seiten hier.
  it('laesst richtige deutsche Woerter durch', () => {
    for (const w of [
      'Schallquelle', 'Quellhöhe', 'Frequenzband', 'Mittenfrequenz', 'Frequenztabelle',
      'quer', 'Steuerung', 'Feuerwehr', 'neue', 'Dauerleistung', 'bauen', 'genaue',
      'aktuell', 'manuell', 'visuell', 'individuelle', 'Koexistenz', 'zuerst',
    ]) expect(hatErsatzform(w), w).toBe(false)
  })

  it('meldet ASCII-Ersatzformen weiter', () => {
    for (const w of [
      'fuer', 'Groesse', 'Aenderung', 'Geraet', 'Laenge', 'fuellen', 'Uebergabe',
      'Steuerfuehrung', 'Rueckgabe', 'hoeher', 'Menue', 'zurueck',
    ]) expect(hatErsatzform(w), w).toBe(true)
  })

  it('zerlegt camelCase, damit Paare ueber die Grenze nicht zaehlen', () => {
    expect(teilwoerter('toEquipmentId')).toEqual(['to', 'Equipment', 'Id'])
    expect(teilwoerter('withoutValue')).toEqual(['without', 'Value'])
  })
})

describe('was als Schluessel durchgeht, und was nicht', () => {
  // Die Ausnahme fuer i18n-Schluessel ist eine LOECHERBEDINGUNG: was sie
  // durchlaesst, prueft der Waechter nicht mehr. Sie an echten Literalen zu
  // messen reicht nicht — heute enthaelt kein deutscher Text einen Punkt und
  // eine Ersatzform zugleich, also waere jede zu weite Form gruen. Geprueft
  // wird deshalb die Bedingung selbst.
  it('nimmt einen i18n-Schluessel an', () => {
    expect(istSchluessel('app.loadReport.unknownValue')).toBe(true)
    expect(istSchluessel('canvas.circuit.label')).toBe(true)
  })

  it('nimmt keinen Satz an, auch keinen mit Punkt', () => {
    expect(istSchluessel('Der Bestand wird ersetzt. Das laesst sich nicht widerrufen.')).toBe(false)
    expect(istSchluessel('Schaltbild fuer Raeume')).toBe(false)
    // Zwei Woerter mit Punkt dazwischen sind noch kein Schluessel, wenn ein
    // Leerzeichen darin steht — genau hier waere die Form zu weit.
    expect(istSchluessel('Kein Treffer. Erneut suchen')).toBe(false)
  })

  it('nimmt ein einzelnes Wort nicht an', () => {
    // Ohne Punkt ist es kein Schluessel, sondern ein Wort — und ein Wort ist
    // genau das, was dieser Waechter liest.
    expect(istSchluessel('Wechselschalter')).toBe(false)
    expect(istSchluessel('Geraet')).toBe(false)
  })
})

describe('die Texte stehen in richtigem Deutsch, nicht in ASCII-Ersatzformen', () => {
  // EIN Lauf fuer alle Faelle, im Hook und mit eigener Frist. Der Lauf parst
  // jede Datei unter src/ mit dem TypeScript-Parser; das dauert allein gut
  // eine Sekunde und unter Last (volle Suite, andere Prozesse) mehrere. Frueher
  // lief er in JEDEM Fall neu und riss das 5-s-Limit von Vitest, ohne dass
  // der Code falsch war. Die Frist gilt nur dem Einlesen; die Faelle selbst
  // pruefen danach ein fertiges Ergebnis.
  let ergebnis: ReturnType<typeof scanne>
  beforeAll(() => {
    ergebnis = scanne()
  }, 60_000)

  it('scannt ueberhaupt etwas (sonst prueft dieser Test nichts)', () => {
    const { literale } = ergebnis
    expect(Object.keys(roh).length).toBeGreaterThan(80)
    expect(literale).toBeGreaterThan(2000)
  })

  it('findet keine ASCII-Ersatzform in einem String-Literal', () => {
    const { befunde } = ergebnis
    const liste = befunde.map((b) => `${b.datei}: „${b.wort}" in "${b.text}"`)
    expect(liste, `ASCII-Ersatzformen: ${liste.join(' | ')}`).toEqual([])
  })
})
