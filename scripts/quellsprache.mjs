// ───────────────────────────────────────────────────────────────────────────
// Die Quellsprache messen — statt sie zu behaupten (E-17/E-20).
//
// WAS DIE QUELLSPRACHE IST. Der Text, der im JSX steht und bei fehlendem
// Schluessel erscheint: das zweite Argument von `t('key', 'Fallback')`. Nicht
// die Sprache der Oberflaeche (die waehlt der Nutzer), nicht die des
// Woerterbuchs (das ist die Uebersetzung) — die des QUELLTEXTS.
//
// WARUM SIE GEMESSEN UND NICHT NUR ERKLAERT WIRD. Der Eigentuemer hat am
// 2026-09-08 entschieden (E-17/E-20): cable-planner und light-planner sind
// deutsch-quellig, multicam-planner und sony-camera-bridge englisch-quellig,
// und die Quellsprache ist eine Eigenschaft des REPOS, nicht der Suite. Der
// Anlass war ein konkreter Schaden: ohne diese Festlegung „berichtigt" der
// naechste Durchgang die Abweichung und fasst ~500 Zeichenketten an, weil
// eine andere Stelle etwas anderes nahelegt.
//
// Eine Erklaerung allein verhindert das nicht. Sie steht in `CLAUDE.md`, wo
// sie jemand liest — oder ueberliest. Deshalb gibt es zusaetzlich diese
// Messung: sie liest die Fallbacks und faellt, wenn die Mehrheit nicht mehr
// zur Deklaration passt. Ein einziger fremdsprachiger Fallback ist dabei
// schon zu viel: er ist der Anfang, aus dem der Sprachmix wird, den B-26
// im sony-camera-bridge beschreibt (englische und deutsche Beschriftungen im
// selben Dialog).
//
// WAS SIE NICHT KANN, UND WARUM DAS IN ORDNUNG IST. Kurze Beschriftungen
// („Aktualisieren", „Rack/Gruppe") tragen kein Merkmal, an dem sich die
// Sprache erkennen liesse — sie bleiben UNKLAR und zaehlen nicht. Gemessen
// im cable-planner: 2194 deutsch, 0 englisch, 2601 unklar. Die Messung deckt
// also gut die Haelfte ab, und das reicht: fuer einen Sprachwechsel muesste
// jemand hunderte Zeichenketten drehen, und die tragen dann Merkmale.
//
// Die Wortlisten enthalten NUR Woerter, die es in der jeweils anderen Sprache
// nicht gibt. Das ist der Grund, warum `a`, `an`, `was`, `will`, `also`, `in`,
// `so`, `man` und `only` NICHT darin stehen: sie kommen in beiden Sprachen vor
// (oder in Fachbegriffen wie „read-only") und haben in einer frueheren Fassung
// deutsche Zeilen als englisch gemeldet — „Was funkt", „gepinnt an",
// „{a} ↔ {b}: gleicher Kanal". Ein Waechter, der bei richtigen Zeilen
// anschlaegt, wird abgeschaltet und nicht gelesen.
//
// Platzhalter (`{n}`, `{from}`) werden vorher entfernt: `{from} → {to}` ist
// keine englische Zeile, sondern zwei Feldnamen.
// ───────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/** Woerter, die es nur im Deutschen gibt. */
const DEUTSCH = [
  'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'oder', 'nicht', 'kein',
  'keine', 'keinen', 'ist', 'sind', 'wird', 'werden', 'wurde', 'für', 'fuer',
  'mit', 'von', 'vom', 'zum', 'zur', 'beim', 'aus', 'eine', 'einen', 'einem',
  'einer', 'nur', 'noch', 'schon', 'wenn', 'dann', 'auch', 'kann', 'muss',
  'darf', 'soll', 'sollen', 'steht', 'gibt', 'sich', 'dieser', 'diese',
  'dieses', 'nach', 'bei', 'über', 'ueber', 'ohne', 'durch', 'gegen', 'sowie',
  'damit', 'wieder', 'immer', 'jede', 'jeder', 'jedes', 'alle', 'allen',
  // ── 2026-09-10: Inhaltswoerter dazu, nicht nur Funktionswoerter ─────────
  //
  // WARUM. Die Liste bestand aus Bindewoertern, und die kommen in kurzen
  // Beschriftungen nicht vor. „Kabel bearbeiten", „+ Neuer Stecker-Typ…",
  // „Verbindung" standen deshalb als ROHER JSX-Text im Haupt-Dialog von
  // `App.tsx` — mitten in einem Repo mit Quellsprache `en` — und der
  // Sprachmix-Zaehler meldete trotzdem 0. Er hat sie gesehen und als
  // „unklar" abgelegt, weil kein Wort auf der Liste stand.
  //
  // Es sind dieselbe Sorte Woerter wie oben: solche, die es im Englischen
  // NICHT gibt. Gemessen gegen alle 4622 englischen Fallbacks in
  // `src/renderer` — kein einziger wuerde durch sie faelschlich als deutsch
  // gelten. Das ist die Bedingung, unter der eine Erweiterung hier
  // hineindarf; eine, die richtige Zeilen rot macht, schaltet den Waechter
  // ab statt ihn zu schaerfen.
  'neuer', 'neue', 'neues', 'neuen', 'bearbeiten', 'speichern', 'abbrechen',
  'verbindung', 'stecker', 'kabel', 'notizen', 'anmerkung', 'anmerkungen',
  'einstellungen', 'ansicht', 'auswahl', 'vorlage', 'vorlagen', 'datei',
  'dateien', 'suche', 'suchen', 'farbe', 'nummer', 'zeile', 'spalte',
  'ordner',
]

/** Woerter, die es nur im Englischen gibt. */
const ENGLISCH = [
  'the', 'and', 'not', 'with', 'for', 'from', 'this', 'that', 'these',
  'those', 'your', 'you', 'are', 'been', 'have', 'has', 'if', 'then', 'than',
  'when', 'which', 'what', 'who', 'how', 'there', 'into', 'about', 'before',
  'after', 'each', 'every', 'any', 'some', 'please', 'cannot', 'does',
  'doesn', 'isn', 'aren', 'would', 'should', 'could', 'must', 'select',
  'missing', 'unknown',
]

const wortMuster = (woerter) =>
  new RegExp(`(^|[^\\p{L}])(${woerter.join('|')})([^\\p{L}]|$)`, 'iu')

const DE_MUSTER = wortMuster(DEUTSCH)
const EN_MUSTER = wortMuster(ENGLISCH)
const UMLAUTE = /[äöüßÄÖÜ]/

/**
 * Die Sprache EINER Zeichenkette — oder `null`, wenn sie kein Merkmal traegt.
 *
 * Traegt eine Zeile Merkmale BEIDER Sprachen, ist sie ebenfalls `null` und
 * nicht etwa „gemischt": das sind fast immer deutsche Saetze mit einem
 * englischen Fachbegriff darin („Viewer-Datei — read-only"), und die als
 * Verstoss zu melden hiesse, Fachsprache zu verbieten.
 */
export const klassifiziere = (roh) => {
  const text = String(roh).replace(/\{[^}]*\}/g, ' ')
  if (text.trim().length < 4) return null
  const de = UMLAUTE.test(text) || DE_MUSTER.test(text)
  const en = EN_MUSTER.test(text)
  if (de && !en) return 'de'
  if (en && !de) return 'en'
  return null
}

/**
 * Das Muster, an dem ein Fallback-Text erkannt wird: `t('key', '…')`,
 * `tr('key', '…')` und `translate(lang, 'key', '…')`, beide
 * Anfuehrungszeichen.
 *
 * `tr` FEHLTE HIER, und das war ein blinder Fleck mit Folgen (gemessen
 * 2026-09-09). `tr` ist der Uebersetzer ausserhalb von React — Module wie
 * `lib/intercomMatrixXlsx.ts` und `lib/importGreengo.ts` rufen ihn, weil dort
 * kein Hook laufen kann. Der Ausdruck kannte nur `t` und `translate`; `\bt\(`
 * trifft `tr(` nicht, weil hinter dem `t` ein `r` steht. Sechs deutsche
 * Fallbacks sind so durch die Sprachdrehung (E-28) hindurchgegangen und der
 * Waechter blieb dabei auf 0.
 *
 * Der Schaden ist nicht theoretisch: es sind FEHLERMELDUNGEN beim Import.
 * Ein englischer Nutzer, dessen XLSX nicht gelesen werden kann, bekam die
 * Begruendung auf Deutsch — also genau dann, wenn er sie am dringendsten
 * braucht.
 *
 * Der Anker `(?=\s*[,)])` am Ende ist die zweite Korrektur desselben Tages.
 * Ohne ihn hoert der Ausdruck am ersten schliessenden Anfuehrungszeichen auf
 * und liest von `t('k', 'Teil eins ' + 'Teil zwei')` nur die erste Haelfte —
 * eine zweite Haelfte in der anderen Sprache waere unsichtbar geblieben.
 *
 * Als FUNKTION, weil ein `/g`-Ausdruck seinen Suchstand mitschleppt und ein
 * geteiltes Exemplar bei der zweiten Datei mitten im Text weitersuchen wuerde.
 *
 * Exportiert, damit der Test dieselbe Fassung benutzt und nicht eine zweite
 * daneben schreibt. Genau daran ist die erste Fassung dieses Waechters
 * gescheitert: die Nach-Pruefung „das Woerterbuch enthaelt keinen Aufruf" war
 * breiter gefasst als die Messung und schlug auf einem KOMMENTAR an, in dem
 * `translate('de', k, fallback)` als Beispiel steht. Zwei Fassungen desselben
 * Musters sind die Defektform `zwei-rechnungen` im Kleinen.
 */
export const fallbackMuster = () =>
  /\b(?:t|tr|translate)\(\s*(?:[A-Za-z]+\s*,\s*)?(['"])[^'"]+\1\s*,\s*(['"])((?:[^\\]|\\.)*?)\2(?=\s*[,)])/g

const dateien = (dir) =>
  readdirSync(dir).flatMap((eintrag) => {
    const voll = join(dir, eintrag)
    if (statSync(voll).isDirectory()) {
      return eintrag === 'node_modules' ? [] : dateien(voll)
    }
    return /\.tsx?$/.test(eintrag) ? [voll] : []
  })

/**
 * Alle Fallback-Texte unter `wurzel`, klassifiziert.
 *
 * Erfasst `t('key', '…')` und `translate(lang, 'key', '…')` in beiden
 * Anfuehrungszeichen.
 *
 * OHNE AUSNAHMELISTE, und das ist eine Zusicherung und keine Nachlaessigkeit.
 * Die naheliegende Sorge ist das `en`-Woerterbuch: es ist voller englischer
 * Zeilen, und das ist richtig so — es ist die Uebersetzung, nicht die Quelle.
 * Es faellt aber nicht auf, weil man es ausnimmt, sondern weil ein
 * Woerterbuch ein OBJEKT-LITERAL ist (`'key': 'value'`) und kein Aufruf.
 * Nachgemessen am 2026-09-08: mit und ohne Ausnahme fuer `lib/i18n` ergibt
 * die Messung dieselben Zahlen (2202/0/2697).
 *
 * Eine Ausnahmeliste, die nichts aendert, waere schlimmer als keine: sie sieht
 * aus wie ein Schutz, deckt aber in Wahrheit nichts ab, und beim naechsten Mal
 * traegt jemand einen Pfad ein, der doch etwas verdeckt. `tests/quellsprache.test.ts`
 * haelt stattdessen fest, dass die Woerterbuch-Datei keinen `t(`-Aufruf enthaelt.
 */
export const messeQuellsprache = (wurzel) => {
  const treffer = { de: 0, en: 0, unklar: 0 }
  const fremde = []
  for (const datei of dateien(wurzel)) {
    const quelle = readFileSync(datei, 'utf8')
    for (const m of quelle.matchAll(fallbackMuster())) {
      const sprache = klassifiziere(m[3])
      if (!sprache) {
        treffer.unklar += 1
        continue
      }
      treffer[sprache] += 1
      fremde.push({
        sprache,
        datei: relative(wurzel, datei).split(sep).join('/'),
        text: m[3].slice(0, 120),
      })
    }
  }
  return {
    ...treffer,
    /** Nur die Stellen, deren Sprache erkannt wurde — mit Datei und Text. */
    stellen: fremde,
  }
}

/** Die Stellen, die NICHT in der erwarteten Quellsprache stehen. */
export const abweichungen = (messung, quellsprache) =>
  messung.stellen.filter((s) => s.sprache !== quellsprache)

// ── Sprachmix: sichtbarer Text, der GAR NICHT gewickelt ist (B-61/B-63) ────
//
// Die Messung oben sieht nur die Fallbacks in `t()`. Beschriftungen, die
// niemand gewickelt hat, sieht sie nicht — und genau die sind der Sprachmix,
// den E-17 fuer `sony-camera-bridge` als Fehler benannt hat: wer die andere
// Sprache waehlt, bekommt eine Oberflaeche, in der ein Teil umschaltet und
// der Rest stehenbleibt.
//
// ZWEI FEHLER DES LAUFS IM `sony-camera-bridge` SIND HIER VERMIEDEN, weil sie
// drueben Geld gekostet haben:
//   1. Er sah Kommentare fuer Literale. Kommentare werden vor dem Messen
//      entfernt.
//   2. Er sah nur Attribute, nicht den JSX-Text. Hier wird beides gelesen.

/** Kommentare raus — sie folgen der Repo-Konvention, nicht der Oberflaeche. */
const ohneKommentare = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

const SICHTBARE_ATTRIBUTE =
  /\b(?:title|aria-label|placeholder|label|alt|summary|submitLabel|hint)=(?:"([^"]{4,})"|\{\s*'((?:[^'\\]|\\.){4,}?)'\s*\})/g

/**
 * JSX-Textknoten — und zwar NUR die.
 *
 * Die erste Fassung war `/>([^<>{}]{4,})</g`. Sie trifft in einer .tsx-Datei
 * auch CODE: `>` und `<` sind Vergleichsoperatoren, und dazwischen steht dann
 * ein Stueck Quelltext (`if (clipped.length > 2)`, `arr.filter(n => n.id)`).
 * Gemessen mit dem lockeren Muster: 35 solche Fehltreffer im cable-planner,
 * 12 im light-planner — ausnahmslos Code, kein einziger echter Fund.
 *
 * ZWEI BEDINGUNGEN MACHEN DARAUS EIN TAG-MUSTER:
 *   • Das `>` muss ein Tag-Ende sein: davor ein Bezeichner, ein
 *     Anfuehrungszeichen, eine geschweifte Klammer oder ein Schraegstrich —
 *     nie ein Leerzeichen, `=`, `<` oder `!`. Damit fallen `a > b`, `=>` und
 *     `<=` heraus.
 *   • Das schliessende `<` muss ein Tag beginnen: `</` oder `<Buchstabe`.
 * Was danach noch durchkommt, sind Generics (`useState<Foo>(null)`); die
 * faengt `NACH_CODE`.
 */
const JSX_TEXT = /[^\s=<!>]>([^<>{}]{4,})<[/A-Za-z]/g

/**
 * Was ein JSX-Textknoten NIE enthaelt, ein Code-Schnipsel dagegen fast immer.
 * Greift ausschliesslich auf JSX-Text, nicht auf Attribute: dort steht
 * durchaus ein `=` in der Oberflaeche („Shift = frei, Mausrad = Stufe").
 */
const NACH_CODE = /[;=]|\b(?:const|let|var|function|await|async)\b/

/**
 * Auch das Template-Literal, nicht nur die Anfuehrungszeichen. Eine Rueckfrage
 * mit eingesetztem Namen steht praktisch immer im Backtick — ausgerechnet die
 * Form also, die eine erste Fassung nicht kannte (gefunden ueber den
 * `dialogs:native`-Waechter der Suite, nicht ueber diesen Lauf).
 */
const RUFE =
  /\b(?:alert|confirm|prompt)\(\s*(?:(['"])((?:[^\\]|\\.){4,}?)\1|`((?:[^`\\]|\\.){4,}?)`)/g

/** Sichtbarer Text einer Datei, der NICHT in einem `t()`-Fallback steht. */
export const sichtbareTexte = (quelle, jsx) => {
  const text = ohneKommentare(quelle).replace(fallbackMuster(), ' ')
  const raus = []
  for (const m of text.matchAll(SICHTBARE_ATTRIBUTE)) raus.push(m[1] ?? m[2])
  for (const m of text.matchAll(RUFE)) raus.push(m[2] ?? m[3])
  if (jsx) {
    for (const m of text.matchAll(JSX_TEXT)) {
      const t = m[1].trim()
      if (t && !t.startsWith('{') && !NACH_CODE.test(t)) raus.push(t)
    }
  }
  return raus
}

/**
 * Die Obergrenze, nicht das Ziel.
 *
 * GEMESSEN am 2026-09-09 mit dem strengen JSX-Muster: NULL. Das ist ein
 * Ergebnis und keine Selbstverstaendlichkeit — die offene Frage aus B-63 war
 * genau diese, und sie war bis dahin nicht gemessen, sondern vermutet.
 *
 * Sie darf SINKEN und nicht steigen: wer eine englische Beschriftung
 * hinzufuegt, faellt durch; wer uebersetzt und die Zahl stehen laesst,
 * ebenfalls. Auf null bedeutet: JEDE neue Zeichenkette in der anderen
 * Sprache faellt sofort auf.
 */
export const MIX_GRENZE = 0

/**
 * Ungewickelter sichtbarer Text in der jeweils anderen Sprache.
 *
 * Gibt AUSSERDEM zurueck, wie viel sichtbarer Text ueberhaupt geprueft wurde.
 * Die Zahl steht in der Ausgabe, damit die Null darueber zu deuten ist — als
 * Angabe, nicht als Schwelle: sie faellt, je mehr gewickelt wird, und waere
 * als Untergrenze deshalb nach dem zweiten Nachziehen nur noch Zierrat. Dass
 * das Muster ueberhaupt findet, belegt die feste Probe im CLI-Teil.
 */
export const messeSprachmix = (wurzel, quellsprache) => {
  const ziel = quellsprache === 'de' ? 'en' : 'de'
  const funde = []
  let gesehen = 0
  for (const datei of dateien(wurzel)) {
    const rel = relative(wurzel, datei).split(sep).join('/')
    // Das Woerterbuch ist per Definition in der anderen Sprache, Tests sind
    // keine Oberflaeche. Eine Zahl, die niemand auf null bringen kann, liest
    // niemand.
    if (rel.includes('i18n') || rel.includes('__tests__') || rel.includes('.test.')) continue
    for (const roh of sichtbareTexte(readFileSync(datei, 'utf8'), datei.endsWith('.tsx'))) {
      gesehen += 1
      if (klassifiziere(roh) === ziel) funde.push({ datei: rel, text: roh.slice(0, 100) })
    }
  }
  return { funde, gesehen }
}

// CLI: `node scripts/quellsprache.mjs <wurzel> <sprache>`
if (process.argv[1] && process.argv[1].endsWith('quellsprache.mjs')) {
  const [, , wurzel, sprache] = process.argv
  if (!wurzel || !sprache) {
    console.error('Aufruf: node scripts/quellsprache.mjs <wurzel> <de|en>')
    process.exit(2)
  }
  const messung = messeQuellsprache(wurzel)
  const falsch = abweichungen(messung, sprache)
  console.log(
    `${wurzel}: ${messung.de} deutsch, ${messung.en} englisch, ${messung.unklar} ohne Merkmal`,
  )
  for (const s of falsch) console.log(`  ${s.sprache.toUpperCase()} ${s.datei}: ${s.text}`)
  if (falsch.length > 0) {
    console.error(
      `\n${falsch.length} Fallback(s) nicht in der Quellsprache „${sprache}". ` +
        'Entweder die Zeile uebersetzen oder — wenn die Quellsprache wirklich ' +
        'wechseln soll — die Deklaration in package.json UND CLAUDE.md aendern.',
    )
    process.exit(1)
  }

  // ── Die Gegenprobe zum Messwerkzeug selbst — an fester Probe, nicht am Repo.
  //
  // WARUM NICHT AM REPO. Der naheliegende Weg waere eine Untergrenze auf der
  // Zahl der gefundenen Texte („mindestens N"). Der Wert davon faellt aber
  // genau dann, wenn die Arbeit gelingt: je mehr gewickelt ist, desto weniger
  // ungewickelter Text bleibt uebrig. Eine solche Schwelle muesste bei jedem
  // Fortschritt nachgezogen werden und waere nach dem zweiten Nachziehen nur
  // noch Zierrat.
  //
  // Die Probe dagegen ist unabhaengig von der Repo-Groesse und haelt genau die
  // Fehlformen fest, die diesen Zaehler Zeit gekostet haben: der Kommentar als
  // Literal, das Vergleichs-`>` als Tag-Ende, die Rueckfrage im Backtick. Ohne
  // sie waere ein kaputtes Muster die gefaehrlichste Art gruen: es findet
  // nichts, und Nichts sieht hier aus wie ein Ergebnis.
  const PROBE = [
    '<button title="Delete this cable">',
    '<span>Not connected yet</span>',
    'window.confirm(`Delete "${name}" and its ${n} shots?`)',
    // Die beiden Kommentar-Zeilen tragen mit Absicht Muster, die OHNE den
    // Kommentarfilter treffen wuerden — eine ohne waere wirkungslos: was kein
    // `>` und kein `title=` enthaelt, findet der Zaehler ohnehin nicht, und die
    // Probe belegte dann nichts.
    '// title="Legacy tooltip, no longer shown"',
    '/* <b>Old markup left in a comment</b> */',
    'if (a.length > 2) return b < c',
    'const n = a>b ? 1 : 2; const m = c<d',
    "t('cable.remove', 'Delete this cable')",
  ].join('\n')

  // Sortiert verglichen: in welcher Reihenfolge Attribute, Rueckfragen und
  // Textknoten herausfallen, ist eine Eigenschaft der Schleifen und keine
  // Zusicherung — ein Waechter, der bei einer umgestellten Schleife anschlaegt,
  // meldet Fehlalarme.
  const gefunden = sichtbareTexte(PROBE, true).slice().sort()
  const erwartet = [
    'Delete "${name}" and its ${n} shots?',
    'Delete this cable',
    'Not connected yet',
  ].sort()
  if (gefunden.length !== erwartet.length || erwartet.some((e, i) => gefunden[i] !== e)) {
    console.error(
      '\nDie Probe des Sprachmix-Musters schlaegt fehl.\n' +
        `  erwartet: ${JSON.stringify(erwartet)}\n` +
        `  gefunden: ${JSON.stringify(gefunden)}\n` +
        'Das Muster findet entweder echte Beschriftungen nicht mehr oder wieder ' +
        'Kommentare und Quelltext. Beides macht die Zahl unten wertlos.',
    )
    process.exit(1)
  }

  const { funde: mix, gesehen } = messeSprachmix(wurzel, sprache)
  console.log(
    `Sprachmix: ${mix.length} ungewickelte Zeichenkette(n) in der anderen Sprache ` +
      `(Grenze ${MIX_GRENZE}, ${gesehen} sichtbare Texte geprueft).`,
  )
  if (mix.length > MIX_GRENZE) {
    console.error(`\n${mix.length - MIX_GRENZE} mehr als erlaubt:`)
    for (const f of mix.slice(0, 40)) console.error(`  ${f.datei}: ${f.text}`)
    if (mix.length > 40) console.error(`  … und ${mix.length - 40} weitere`)
    console.error(
      '\nEntweder wickeln und uebersetzen — oder, wenn es wirklich so bleiben ' +
        'soll, MIX_GRENZE mit Begruendung anheben. Das Anheben ist die Ausnahme; ' +
        'das Senken ist der Normalfall.',
    )
    process.exit(1)
  }
  if (mix.length < MIX_GRENZE) {
    console.error(
      `\nDie Grenze steht auf ${MIX_GRENZE}, gemessen sind ${mix.length}. ` +
        'MIX_GRENZE auf den neuen Wert setzen — eine Grenze ueber dem Ist deckt ' +
        'ab morgen wieder Zuwachs.',
    )
    process.exit(1)
  }
}
