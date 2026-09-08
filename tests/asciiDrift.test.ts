import { describe, expect, it } from 'vitest'
import ts from 'typescript'

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
// („value", „request"), deutsche Woerter mit echter Vokalfolge („neue",
// „Steuerung", „Quelle") und Hex-Ziffernfolgen. Alles andere ist ein Befund.
// Wer ein neues englisches Wort einfuehrt, traegt es unten ein; wer eine neue
// ASCII-Ersatzform einfuehrt, faellt auf.
//
// KOMMENTARE SIND NICHT DABEI. Die bleiben ASCII, wie im ganzen Repo — sie
// stehen nie auf einem Blatt und nie in einem Dialog.

const roh = {
  ...(import.meta.glob('../src/renderer/**/*.ts', {
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
  ...(import.meta.glob('../src/mobile/**/*.ts', {
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
 * Woerter, in denen „ae/oe/ue" kein Umlaut-Ersatz ist. Wer hier etwas
 * eintraegt, sagt: dieses Wort ist so richtig geschrieben.
 */
const HARMLOS = new Set(
  [
    // Englisch — Fachbegriffe, Feldnamen im Klartext, Fliesstext in Belegen
    'does', 'doesNotFit', 'goes', 'value', 'values', 'withoutValue', 'typeValue',
    'renderValue', 'roleValue', 'kpiValue', 'manualValues', 'request', 'requests',
    'requestFailed', 'issue', 'issues', 'issued', 'issueHint', 'unique', 'due',
    'dueBack', 'newDueBack', 'moveDueBack', 'overdue', 'overdueSince', 'returnDue',
    'returnOverdue', 'query',
    'querySelector', 'querySelectorAll', 'querier', 'igmpQuerier', 'sequence',
    'question', 'questions', 'technique', 'analogue', 'catalogue', 'colleague',
    'coexist', 'continue', 'cues', 'guess', 'guessed', 'whoever', 'true', 'blue',
    'bluebird', 'bluemic', 'venue', 'venues', 'newVenue', 'addVenue', 'venueAnswer',
    'venueAnswers', 'venueNetworkRequest', 'frequency', 'frequencies',
    'frequencyMhz', 'frequencyLabel', 'frequencyPlaceholder',
    // Deutsch mit echter Vokalfolge — kein Umlaut dahinter
    'neu', 'neue', 'neuer', 'neues', 'neuen', 'neuerdings', 'aktuell', 'aktuelle',
    'aktuellen', 'aktueller', 'aktuelles', 'aktuellste', 'quelle', 'quellen',
    'quell', 'signalquelle', 'produktionsquelle', 'steuer', 'steuern', 'steuert',
    'steuersatz', 'steuersätze', 'steuerbetrag', 'mehrwertsteuer', 'umsatzsteuer',
    'steuerbar', 'steuerbare', 'steuerbaren', 'steuerbares',
    'steuerung', 'steueradern', 'steuerverkehr', 'geraetesteuerung', 'frequenz',
    // S-3 (2026-09-08): „Steuerzeichen" ist richtiges Deutsch und wurde
    // gemeldet — die Silbengrenze faellt in „Ste-uer" mitten in ein „ue".
    // Dasselbe gilt fuer die uebrigen Zusammensetzungen mit „Steuer-", die
    // in dieser Liste noch fehlten.
    'steuerzeichen', 'steuerbefehl', 'steuerbefehle', 'steuerprotokoll',
    'steuerprotokolle', 'steuerport', 'steuerweg', 'steuerwege',
    'frequenzen', 'frequenzgang', 'frequenzabstand', 'funkfrequenz',
    'sendefrequenz', 'bauen', 'dauerhaft', 'dauerhafte', 'genaue', 'teuerste',
    'auszugrauen', 'koexistenz', 'manuell', 'manuelle', 'manuellen', 'individuell',
    'eventuell', 'virtuell', 'treue', 'feuer', 'europa', 'euro',
    // Eigennamen, Protokolle, Einheiten
    'segoe', 'poe', 'poestandard', 'poestandards', 'poebudget', 'poebudgetw',
    'erpoe', 'aes', 'aea', 'aearibbonmics', 'gerätesteuerung',
    // Ein Paar fuer sich ist nie ein deutsches Wort: es kommt aus einer UUID,
    // aus einem URL-Pfad („/ue_US/") oder aus `danteNaming`, das genau diese
    // Ersetzung VORNIMMT, weil Dante-Namen ASCII sein muessen.
    'ae', 'oe', 'ue',
    // Deutsch, und richtig geschrieben — „ue"/„ae"/„oe" ueber eine Silben-
    // oder Wortgrenze hinweg.
    'zuerst', 'neuere', 'neueren', 'neueste', 'querschnitt', 'dauer',
    'störquelle', 'signalquelle', 'signalquellen', 'frequenzbänder',
    'frequenzregulierung', 'koexistieren', 'graues', 'visuell', 'visuelle',
    'virtuelle', 'individuelle', 'aktuellem', 'nachbauen', 'zuerste',
    'queueconnection', 'venuescopedialog', 'catalogueevidence',
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
}

/** Hex-Folgen (Farben, Fingerabdruecke) bestehen nur aus a-f und Ziffern. */
const istHex = (wort: string) => wort.length >= 3 && /^[0-9a-f]+$/i.test(wort)

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
        if (!erlaubt.has(text.toLowerCase()) && !KENNUNGEN.has(text.trim()) && !istSchluessel(text)) {
          for (const wort of ohnePlatzhalter.match(/[A-Za-zÄÖÜäöüß]+/g) ?? []) {
            // Auf dem WORT in seiner Schreibweise, nicht auf der Kleinform:
            // `toEquipmentId` traegt „oE" ueber eine camelCase-Grenze hinweg,
            // und das ist kein Umlaut-Ersatz. Nur gleich geschriebene Paare
            // zaehlen — „ae", „Ae", „AE".
            if (!/ae|oe|ue|Ae|Oe|Ue|AE|OE|UE/.test(wort)) continue
            const klein = wort.toLowerCase()
            if (HARMLOS.has(klein) || erlaubt.has(klein) || istHex(wort)) continue
            befunde.push({ datei: kurz, wort, text: text.slice(0, 70) })
          }
        }
      }
      ts.forEachChild(node, lauf)
    }
    lauf(sf)
  }
  return { befunde, literale }
}

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
  it('scannt ueberhaupt etwas (sonst prueft dieser Test nichts)', () => {
    const { literale } = scanne()
    expect(Object.keys(roh).length).toBeGreaterThan(80)
    expect(literale).toBeGreaterThan(2000)
  })

  it('findet keine ASCII-Ersatzform in einem String-Literal', () => {
    const { befunde } = scanne()
    const liste = befunde.map((b) => `${b.datei}: „${b.wort}" in "${b.text}"`)
    expect(liste, `ASCII-Ersatzformen: ${liste.join(' | ')}`).toEqual([])
  })
})
