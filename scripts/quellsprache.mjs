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
 * Das Muster, an dem ein Fallback-Text erkannt wird: `t('key', '…')` und
 * `translate(lang, 'key', '…')`, beide Anfuehrungszeichen.
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
  /\b(?:t|translate)\(\s*(?:[A-Za-z]+\s*,\s*)?(['"])[^'"]+\1\s*,\s*(['"])((?:[^\\]|\\.)*?)\2/g

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
}
