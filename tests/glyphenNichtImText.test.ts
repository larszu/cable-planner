import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
// @ts-expect-error — reines JS-Modul ohne Typen
import { fallbackMuster } from '../scripts/quellsprache.mjs'

// ---------------------------------------------------------------------------
// Ein Symbol am Rand einer Beschriftung ist ein Icon und gehoert ins JSX —
// nicht in die Zeichenkette (UI-Pruefung, Phase 4).
//
// ─── DER BEFUND ────────────────────────────────────────────────────────────
//
// 71 `t()`-Fallbacks fingen mit einem Symbol an oder hoerten mit einem auf:
// „✕ Reset", „↻ Refresh", „✓ linked", „Apply →", „📂 Choose a file…",
// „🏷 Labels PDF". Das Audit hatte es als TODO notiert; `Icon.tsx` sagt in
// seinem eigenen Kopf, warum es die Datei ueberhaupt gibt:
//
//   > Vorher: funktionale Icons waren Emojis (✕, ⚠, ✎, ⇢/⇠ …), die je nach
//   > Plattform/Font inkonsistent rendern.
//
// Das ist der ganze Grund, und er gilt fuer eine Zeichenkette genauso wie
// fuer ein JSX-Kind. Ein `✕` im Text rendert auf einem Windows-Rechner
// anders als auf einem Mac, faellt bei fehlendem Font ganz aus, hat keine
// Stroke-Breite und keine Themen-Farbe — und ein Emoji („📤") bringt
// zusaetzlich seine eigene Farbe mit, die neben einer Icon-Reihe fremd
// aussieht.
//
// ─── UND DER GRUND, DER NUR UEBERSETZUNGEN BETRIFFT ────────────────────────
//
// Das Symbol steht sonst in JEDEM Woerterbuch noch einmal. Gemessen: die
// deutschen Entsprechungen trugen dieselben 71 Symbole ein zweites Mal mit
// sich. Wer das Icon aendert, muss es in jeder Sprache aendern — und wer
// eine neue Sprache anlegt, tippt sie ab. Ein Icon ist keine Sprache.
//
// ─── WAS BLEIBEN DARF, UND WARUM DAS EINE LISTE IST ────────────────────────
//
// Nicht jedes Symbol ist Zierrat. Drei Sorten tragen Bedeutung:
//
//   * `♂`/`♀` an der Steckerbauart — die Kennzeichnung auf dem Stecker
//     selbst; es gibt dafuer kein Icon, und ein Wort waere eine Uebersetzung
//     der Norm.
//   * `◄`/`►` in der Pfeilspitzen-Auswahl — das Symbol IST der Wert, den man
//     dort waehlt.
//   * `↓`/`↑` in der Sortier-Auswahl — dasselbe: die Richtung ist der
//     Zustand, nicht seine Verzierung.
//
// Deshalb steht hier eine Liste und keine ausnahmslose Regel. Sie ist eine
// ERKLAERUNG je Eintrag („dieses Symbol ist der Inhalt"), so wie die
// `HARMLOS`-Liste in `asciiDrift.test.ts` — und sie ist kurz genug, dass ein
// neuer Eintrag auffaellt.
//
// NICHT geprueft werden Symbole MITTEN im Satz („from source → destination",
// „Settings → Rentman", „{a} ↔ {b}"). Dort ist der Pfeil ein Wort: er sagt
// „fuehrt zu". Ihn herauszuloesen hiesse, den Satz aus zwei `t()`-Aufrufen
// zusammenzusetzen — genau das, was `CLAUDE.md` verbietet, weil die
// Wortstellung zur Sprache gehoert.
//
// ─── WAS DIESER WAECHTER NICHT SIEHT, UND DAS STEHT HIER MIT ABSICHT ───────
//
// Er liest `t()`-Fallbacks. Ein Symbol, das ROH im JSX steht (`<span>🔄</span>`,
// `{open ? '▾' : '▸'}`, `★ Custom Cable…`), geht ihn nichts an — gemessen am
// 2026-09-10: **106 solche Stellen in 47 Dateien**, ein guter Teil davon
// legitim (die Caret-Dreiecke der Menues, die Richtungspfeile des
// Off-Page-Symbols, ein Zustandspunkt).
//
// Das hier hinzuschreiben ist kein Eingestaendnis, sondern der Punkt: ein
// Waechter, der seine Grenze verschweigt, wird als Deckung gelesen, die er
// nicht hat. Genau daran ist `lang:check` gescheitert, als es nur
// `src/renderer` ansah und trotzdem „0 Verstoesse" meldete.
// ---------------------------------------------------------------------------

const WURZEL = join(process.cwd(), 'src')

/**
 * Symbole, die als Icon gemeint sind: Pfeile, geometrische Formen,
 * Dingbats, Emoji — plus die beiden Geschlechtszeichen.
 *
 * Buchstaben, Ziffern und Satzzeichen sind ausdruecklich NICHT dabei: ein
 * „+ as rack" oder ein „…" am Ende ist Text und kein Icon.
 */
const GLYPH = /[←-⇿⌀-⏿■-➿⬀-⯿♀♂\u{1F000}-\u{1FAFF}]/u

/** Schluessel, deren Symbol den Inhalt traegt — mit dem Grund daneben. */
const SYMBOL_IST_INHALT: Record<string, string> = {
  'ports.gender.male': 'Die Kennzeichnung am Stecker selbst (IEC/Norm), kein Icon dafuer.',
  'ports.gender.female': 'Die Kennzeichnung am Stecker selbst (IEC/Norm), kein Icon dafuer.',
  'cable.field.arrowStart': 'Die Pfeilspitze IST der gewaehlte Wert.',
  'cable.field.arrowEnd': 'Die Pfeilspitze IST der gewaehlte Wert.',
  'rentman.import.sortDateDesc': 'Die Richtung ist der Sortier-Zustand, nicht sein Schmuck.',
  'rentman.import.sortDateAsc': 'Die Richtung ist der Sortier-Zustand, nicht sein Schmuck.',
}

/**
 * `\u{1F39B}` ist dasselbe Zeichen wie `🎛` — nur anders geschrieben.
 *
 * Und genau so ist eine Stelle durchgerutscht: die Quelle in
 * `PatchListDialog` trug den Escape, das erste Zeichen der Zeichenkette war
 * damit ein Backslash, und die Regel unten sah nichts. Gefunden hat sie die
 * ZWEITE Pruefung, die das deutsche Woerterbuch liest — dort stand das
 * Symbol ausgeschrieben. Ein Waechter, der nur eine Schreibweise kennt,
 * prueft die Schreibweise und nicht das Zeichen.
 */
const entschluesselt = (text: string): string =>
  text
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const pfad = join(dir, eintrag)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.tsx?$/.test(pfad) ? [pfad] : []
  })

interface Fund {
  datei: string
  key: string
  text: string
}

/** Jeder `t()`-Fallback, dessen erstes oder letztes Zeichen ein Symbol ist. */
const amRand = (): Fund[] => {
  const funde: Fund[] = []
  for (const pfad of dateien(WURZEL)) {
    const quelle = readFileSync(pfad, 'utf8')
    for (const m of quelle.matchAll(fallbackMuster() as RegExp)) {
      // Gruppe 3 ist der Fallback-Text, die Gruppe davor der Schluessel.
      const text: string = entschluesselt(m[3])
      const key = /(['"])([^'"]+)\1\s*,\s*(['"])/.exec(m[0])?.[2] ?? '?'
      const zeichen = [...text]
      if (zeichen.length === 0) continue
      if (!GLYPH.test(zeichen[0]) && !GLYPH.test(zeichen[zeichen.length - 1])) continue
      funde.push({ datei: relative(WURZEL, pfad).split(sep).join('/'), key, text })
    }
  }
  return funde
}

describe('Symbole am Rand einer Beschriftung', () => {
  it('sieht ueberhaupt Fallbacks — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waere die Regel unten auch dann erfuellt, wenn
    // das Muster nicht mehr greift: eine leere Menge hat keine Verstoesse.
    let gesamt = 0
    for (const pfad of dateien(WURZEL)) {
      gesamt += [...readFileSync(pfad, 'utf8').matchAll(fallbackMuster() as RegExp)].length
    }
    expect(gesamt).toBeGreaterThan(1000)
  })

  it('findet die erklaerten Ausnahmen — sonst passt das Symbol-Muster nicht mehr', () => {
    // Zweite Haelfte derselben Zusicherung: Fallbacks zu finden reicht nicht,
    // `GLYPH` muss auch greifen. Die sechs erklaerten Stellen sind der Beleg.
    // Faellt der Wert auf 0, ist entweder auch die letzte Ausnahme weg — dann
    // darf diese Zeile gehen — oder das Muster trifft nicht mehr.
    expect(amRand().length).toBeGreaterThan(0)
  })

  it('sind Icons im JSX, nicht Zeichen im Text', () => {
    const offen = amRand()
      .filter((f) => !(f.key in SYMBOL_IST_INHALT))
      .map((f) => `${f.datei}: ${f.key} = ${JSON.stringify(f.text)}`)
    expect(
      offen,
      `Ein Symbol am Rand einer Beschriftung ist ein Icon: <Icon icon={…} /> ` +
        `ins JSX, Symbol aus dem Fallback UND aus jedem Woerterbuch. Traegt es ` +
        `wirklich Bedeutung, gehoert es mit Begruendung in SYMBOL_IST_INHALT:\n  ` +
        `${offen.join('\n  ')}`,
    ).toEqual([])
  })

  it('jede Erklaerung deckt eine Stelle, die es wirklich gibt', () => {
    // Eine Ausnahme ohne Fund ist kein Schutz mehr, sondern ein Rest: sie
    // sieht beim Lesen aus wie eine Deckung fuer eine Stelle, die es nicht
    // mehr gibt — dieselbe Regel wie beim Light-Theme-Remap.
    const gefunden = new Set(amRand().map((f) => f.key))
    const ohneStelle = Object.keys(SYMBOL_IST_INHALT).filter((k) => !gefunden.has(k))
    expect(
      ohneStelle,
      `Erklaerte Ausnahmen ohne Fundstelle — entweder ist die Stelle weg ` +
        `(dann darf die Zeile gehen) oder sie heisst inzwischen anders: ` +
        `${ohneStelle.join(', ')}`,
    ).toEqual([])
  })
})

describe('Das Woerterbuch traegt die Symbole nicht nach', () => {
  it('kein deutscher Eintrag faengt mit einem Icon an oder hoert damit auf', () => {
    // Die Regel oben sieht nur die Fallbacks. Bliebe das Symbol in der
    // Uebersetzung stehen, saehe die deutsche Oberflaeche weiter aus wie
    // vorher — Icon UND Zeichen nebeneinander — und niemand wuerde rot.
    const woerterbuecher = [
      'renderer/lib/i18n/de.ts',
      'mobile/i18n.ts',
      'viewer/i18n.ts',
    ]
    const funde: string[] = []
    for (const rel of woerterbuecher) {
      const quelle = readFileSync(join(WURZEL, rel), 'utf8')
      for (const m of quelle.matchAll(/^\s*'([\w.]+)':\s*$|^\s*'([\w.]+)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)) {
        const key = m[1] ?? m[2]
        const text = m[3] === undefined ? undefined : entschluesselt(m[3])
        if (!key || text === undefined || text.length === 0) continue
        if (key in SYMBOL_IST_INHALT) continue
        const zeichen = [...text]
        if (GLYPH.test(zeichen[0]) || GLYPH.test(zeichen[zeichen.length - 1])) {
          funde.push(`${rel}: ${key} = ${JSON.stringify(text)}`)
        }
      }
    }
    expect(
      funde,
      `Uebersetzung mit Icon-Zeichen am Rand — das Icon steht im JSX und ` +
        `gehoert nicht zusaetzlich in den Text:\n  ${funde.join('\n  ')}`,
    ).toEqual([])
  })
})
