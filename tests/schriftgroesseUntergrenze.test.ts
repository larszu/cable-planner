import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// ---------------------------------------------------------------------------
// Fliesstext faellt nicht unter 12px (UI-Pruefung, Phase 2).
//
// Der Befund stand in `docs/ui-audit.md` und war als TODO formuliert:
//
//   > `text-[10px]`/`text-[11px]`/`text-[9px]` flaechendeckend auf Typo-Skala
//   > migrieren … Fliesstext-Mindestgroesse 12px. (Rein dekorative
//   > Micro-Glyphen wie MenuBar-Caret `▾` bleiben.)
//
// ─── WARUM DIESER WAECHTER UEBERHAUPT EXISTIERT ────────────────────────────
//
// Weil das TODO seit seinem Eintrag RUECKWAERTS gelaufen ist. Gemessen ueber
// dieselbe Baumsuche, die hier laeuft:
//
//   * 743 Stellen beim ersten Commit des Audits (955da7e, 2026-06-15)
//   * 881 Stellen drei Monate spaeter (2026-09-10)
//
// Also 138 Stellen MEHR, nachdem jemand aufgeschrieben hatte, dass es weniger
// werden sollen. Ein TODO in einer Datei bremst nichts; niemand liest es beim
// Schreiben einer neuen Komponente. Das ist keine Nachlaessigkeit einzelner
// Aenderungen, sondern die vorhersehbare Folge davon, dass die Grenze nur in
// Prosa stand.
//
// Der Weg zurueck lief in vier Schritten — 881 → 828 (`src/mobile`) → 705
// (die drei groessten Einzeldateien) → 515 (die naechsten neun) → 0.
//
// ─── VON DER RATSCHE ZUR REGEL ─────────────────────────────────────────────
//
// Solange noch hunderte Stellen offen waren, stand hier eine Zahl: die
// Barriere durfte sinken, nie steigen. Das war die richtige Form fuer eine
// laufende Migration und die falsche fuer eine fertige — eine Zahl sagt
// nicht, WARUM eine Stelle bleiben darf, und wer eine neue anlegt, koennte
// sie mit einer Migration anderswo verrechnen.
//
// Geprueft wird deshalb jetzt eine REGEL: jede verbliebene Stelle unter 12px
// muss ein rein dekorativer Micro-Glyph sein. Das ist die Ausnahme, die das
// Audit selbst nennt (MenuBar-Caret `▾`), und sie ist nachpruefbar statt
// ermessensabhaengig — der sichtbare Text der Zeile darf keinen Buchstaben
// und keine Ziffer enthalten. Ein Pfeil hat keine Lesbarkeitsuntergrenze,
// ein Wort hat eine.
//
// Wer morgen einen neuen Caret braucht, bleibt gruen. Wer eine Beschriftung
// auf 10px setzt, wird rot — und zwar sofort und ohne Verrechnung.
//
// ─── WAS GEMESSEN WIRD, UND WAS NICHT ──────────────────────────────────────
//
// Gemessen wird `text-[<n>px]` mit n < 12 ueber den GANZEN `src`-Baum. Nicht
// ueber eine Liste von Dateien: dieselbe Lehre wie bei den Dialogen
// (`dialogTastaturbedienung.test.ts`) — DIE DOMAENE IST DER ORDNER, NICHT
// EINE LISTE IM WAECHTER.
//
// NICHT gemessen werden relative Groessen (`text-[0.85em]`, zwei Stellen).
// Ob ein `em` unter 12px landet, haengt am Elternknoten und ist per Textsuche
// nicht entscheidbar. Das hier ehrlich zu benennen ist besser, als eine Zahl
// zu melden, die zwei Faelle stillschweigend auslaesst.
// ---------------------------------------------------------------------------

const WURZEL = join(process.cwd(), 'src')

/** Fliesstext-Untergrenze aus dem Audit. Was darunter liegt, zaehlt. */
const UNTERGRENZE_PX = 12

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const pfad = join(dir, eintrag)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.(tsx|ts|css|html)$/.test(pfad) ? [pfad] : []
  })

const GROESSE = /text-\[(\d+(?:\.\d+)?)px\]/g

interface Fund {
  datei: string
  zeile: number
  text: string
}

/**
 * Eine reine Kommentarzeile ist keine Klasse.
 *
 * `index.css` erklaert in ihrem Kopf, wozu die Typo-Skala da ist, und nennt
 * dabei `text-[10px]`/`text-[11px]` beim Namen — die erste Fassung dieses
 * Waechters meldete genau diesen Satz als Verstoss. Wer eine Regel
 * aufschreibt, soll sie nicht dadurch brechen, dass er sie aufschreibt.
 */
const nurKommentar = (z: string): boolean => /^\s*(\/\/|\/\*|\*)/.test(z)

/** Jede Stelle unter der Untergrenze, mit ihrer Zeile. */
const zuKlein = (): Fund[] => {
  const funde: Fund[] = []
  for (const pfad of dateien(WURZEL)) {
    const zeilen = readFileSync(pfad, 'utf8').split('\n')
    zeilen.forEach((z, i) => {
      if (nurKommentar(z)) return
      for (const m of z.matchAll(GROESSE)) {
        if (Number(m[1]) < UNTERGRENZE_PX) {
          funde.push({ datei: relative(WURZEL, pfad).split(sep).join('/'), zeile: i + 1, text: z })
        }
      }
    })
  }
  return funde
}

/**
 * Der sichtbare Text einer JSX-Zeile: erst die Laeufe zwischen `>` und `<`,
 * und wenn die leer sind (weil dort ein Ausdruck steht), die Zeichenketten
 * aus den geschweiften Klammern.
 *
 * Attribute bleiben aussen vor — `className="…"` und `title={t('…','Pinned')}`
 * sind nichts, was jemand LIEST; sie wuerden jede Zeile mit Buchstaben
 * fuellen und die Regel unbrauchbar machen.
 */
const sichtbarerText = (zeile: string): string[] => {
  const laeufe = [...zeile.matchAll(/>([^<>{}]*)</g)].map((m) => m[1].trim()).filter(Boolean)
  if (laeufe.length > 0) return laeufe
  const inKlammern = [...zeile.matchAll(/\{[^}]*\}/g)].map((m) => m[0]).join(' ')
  return [...inKlammern.matchAll(/'([^']*)'|"([^"]*)"/g)]
    .map((m) => (m[1] ?? m[2] ?? '').trim())
    .filter(Boolean)
}

/** Ein Glyph traegt keine Buchstaben und keine Ziffern. */
const nurGlyph = (s: string): boolean => !/[\p{L}\p{N}]/u.test(s)

describe('Fliesstext-Untergrenze 12px', () => {
  it('sieht ueberhaupt Dateien — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waere die Regel auch dann erfuellt, wenn die
    // Baumsuche nichts mehr findet: eine leere Menge erfuellt jede Regel.
    // Ein Waechter, der bei kaputtem Muster gruen wird, ist schlechter als
    // keiner — er behauptet eine Deckung, die es nicht gibt.
    expect(dateien(WURZEL).length).toBeGreaterThan(150)
  })

  it('greift auf eine feste Probe — sonst prueft die Regel nichts', () => {
    // Zweite Haelfte derselben Zusicherung: Dateien zu finden reicht nicht,
    // das Muster muss auch greifen.
    //
    // BIS 2026-09-10 STAND HIER `zuKlein().length > 0` — gemessen am Repo.
    // Damals waren noch sechs dekorative Stellen uebrig (vier Carets, ein
    // Sortier-Dreieck, eine Pin-Markierung), und die Zeile darueber sagte
    // ausdruecklich: faellt der Wert auf null, ist entweder die letzte
    // Ausnahme weg oder `GROESSE` trifft nicht mehr. Genau das ist
    // eingetreten — die sechs Stellen sind jetzt `<Icon />` und tragen ihre
    // Groesse als Zahl, nicht als CSS-Klasse.
    //
    // Eine Zusicherung, die am Repo haengt, geht mit dem letzten Fund
    // verloren: „keine Stelle unter 12px" waere ab dann auch bei kaputtem
    // Muster erfuellt, und Nichts saehe aus wie ein Ergebnis. Die Probe ist
    // deshalb FEST und unabhaengig vom Bestand — dieselbe Form wie im
    // Sprachmix-Zaehler (`scripts/quellsprache.mjs`).
    const PROBE = [
      '<span className="text-[9px] leading-none">x</span>',
      '<div className="text-[11px]">Hinweis</div>',
      '<div className="text-[12px]">gerade noch erlaubt</div>',
      '<div className="text-cp-xs">ueber die Skala</div>',
    ]
    const getroffen = PROBE.filter((z) =>
      [...z.matchAll(GROESSE)].some((m) => Number(m[1]) < UNTERGRENZE_PX),
    )
    expect(getroffen).toEqual([PROBE[0], PROBE[1]])

    // Und die Urteilsregel selbst: ein Glyph ist ohne Buchstabe und Ziffer.
    expect(sichtbarerText(PROBE[1]).every(nurGlyph)).toBe(false)
    expect(sichtbarerText('<span className="text-[9px]">▾</span>').every(nurGlyph)).toBe(true)
  })

  it('jede Stelle unter 12px ist ein rein dekorativer Glyph', () => {
    const mitText = zuKlein().filter((f) => {
      const sichtbar = sichtbarerText(f.text)
      if (sichtbar.length === 0) return true
      return !sichtbar.every(nurGlyph)
    })
    const liste = mitText
      .map((f) => `${f.datei}:${f.zeile} „${sichtbarerText(f.text).join(' ')}"`)
      .join('\n  ')
    expect(
      mitText,
      `Text unter ${UNTERGRENZE_PX}px — die Typo-Skala nutzen ` +
        `(text-cp-xs/-sm/-base/-lg) statt einer eigenen px-Angabe:\n  ${liste}`,
    ).toEqual([])
  })
})

describe('die Skala selbst', () => {
  const css = readFileSync(join(WURZEL, 'renderer', 'index.css'), 'utf8')

  it('faengt bei genau der Untergrenze an', () => {
    // WICHTIG, UND NICHT NUR EINE VERDOPPLUNG DES CSS.
    //
    // Die Regel oben prueft nur eigene px-Angaben. Setzte jemand
    // `--text-cp-xs` auf 0.625rem, waere jede Migration nach `text-cp-xs`
    // ein Schritt UNTER die Untergrenze — und der Waechter saehe zu, weil
    // dort gar keine px-Angabe mehr steht. Ein Waechter, der denselben
    // Defekt hat wie das Gepruefte, ist auf diesem Defekt gruen.
    const m = /--text-cp-xs:\s*([\d.]+)rem/.exec(css)
    expect(m, '--text-cp-xs nicht in index.css gefunden').not.toBeNull()
    expect(Number(m![1]) * 16).toBe(UNTERGRENZE_PX)
  })

  it('steigt danach', () => {
    // Eine Skala, deren Stufen zusammenfallen, ist keine: dann traegt die
    // Groesse keine Hierarchie mehr, und wer sie braucht, greift wieder zur
    // eigenen px-Angabe — genau die Bewegung, die diese Datei bremst.
    const stufe = (name: string): number => {
      const m = new RegExp(`--text-cp-${name}:\\s*([\\d.]+)rem`).exec(css)
      expect(m, `--text-cp-${name} fehlt`).not.toBeNull()
      return Number(m![1])
    }
    const werte = ['xs', 'sm', 'base', 'lg'].map(stufe)
    for (let i = 1; i < werte.length; i += 1) {
      expect(werte[i], `Stufe ${i} ist nicht groesser als die davor`).toBeGreaterThan(werte[i - 1])
    }
  })
})
