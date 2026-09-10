import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

// ---------------------------------------------------------------------------
// Fliesstext faellt nicht unter 12px (UI-Pruefung, Phase 2).
//
// Der Befund steht in `docs/ui-audit.md` und ist als TODO formuliert:
//
//   > `text-[10px]`/`text-[11px]`/`text-[9px]` flaechendeckend auf Typo-Skala
//   > migrieren … Fliesstext-Mindestgroesse 12px.
//
// ─── WARUM DIESER WAECHTER UEBERHAUPT EXISTIERT ────────────────────────────
//
// Weil das TODO seit seinem Eintrag RUECKWAERTS gelaufen ist. Gemessen ueber
// dieselbe Baumsuche, die hier laeuft:
//
//   * 743 Stellen beim ersten Commit des Audits (955da7e, 2026-06-15)
//   * 881 Stellen bei HEAD dieses Zweiges (2026-09-10)
//
// Also 138 Stellen MEHR, nachdem jemand aufgeschrieben hatte, dass es weniger
// werden sollen. Ein TODO in einer Datei bremst nichts; niemand liest es beim
// Schreiben einer neuen Komponente. Das ist keine Nachlaessigkeit einzelner
// Aenderungen, sondern die vorhersehbare Folge davon, dass die Grenze nur in
// Prosa stand.
//
// Dieser Test macht daraus eine Ratsche: die Zahl darf sinken, nie steigen.
// Er ersetzt das TODO nicht, er traegt es — der Rest der Migration bleibt
// Arbeit, aber sie kann nicht mehr lautlos zunichte gemacht werden.
//
// ─── WAS GEMESSEN WIRD, UND WAS NICHT ──────────────────────────────────────
//
// Gemessen wird `text-[<n>px]` mit n < 12, ueber den GANZEN `src`-Baum. Nicht
// ueber eine Liste von Dateien: dieselbe Lehre wie bei den Dialogen
// (`dialogTastaturbedienung.test.ts`) — DIE DOMAENE IST DER ORDNER, NICHT EINE
// LISTE IM WAECHTER. Wer morgen eine Komponente anlegt, faellt hier auf, ohne
// dass jemand eine Liste pflegt.
//
// NICHT gemessen werden relative Groessen (`text-[0.85em]`, zwei Stellen).
// Ob ein `em` unter 12px landet, haengt am Elternknoten und ist per Textsuche
// nicht entscheidbar. Das hier ehrlich zu benennen ist besser, als eine
// Zahl zu melden, die zwei Faelle stillschweigend auslaesst.
//
// Das Audit nimmt rein dekorative Micro-Glyphen (MenuBar-Caret `▾`) aus der
// Migration aus — zu Recht, ein Pfeil hat keine Lesbarkeitsuntergrenze. Die
// Ratsche zaehlt sie trotzdem mit, denn „ist das dekorativ?" laesst sich nicht
// suchen, und ein Waechter mit einer Ermessensklausel prueft am Ende nichts.
// Wer einen neuen Glyph braucht, migriert im selben Schritt eine Textstelle:
// die Zahl bleibt dann gleich, und die Untergrenze bleibt gedeckt.
// ---------------------------------------------------------------------------

const WURZEL = join(process.cwd(), 'src')

/** Fliesstext-Untergrenze aus dem Audit. Was darunter liegt, zaehlt. */
const UNTERGRENZE_PX = 12

/**
 * Stand 2026-09-10, gemessen mit genau der Suche unten. Sinken darf die Zahl —
 * dann ist die rote Zeile die Erinnerung, sie hier nachzuziehen.
 *
 * Bisherige Staende: 828 (nach `src/mobile`), 705 (nach GreenGoExportDialog,
 * CalculatorsDialog, CableProperties). Die Reihenfolge ist die nach Groesse:
 * die dichten Tabellen und Rechner-Raster zuerst, weil dort die kleinste
 * Schrift und die meiste Zahl zusammenkommen.
 */
const BARRIERE = 705

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const pfad = join(dir, eintrag)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return /\.(tsx|ts|css|html)$/.test(pfad) ? [pfad] : []
  })

const GROESSE = /text-\[(\d+(?:\.\d+)?)px\]/g

/** Alle Fundstellen unter der Untergrenze, nach Datei. */
const zuKlein = (): Map<string, number> => {
  const treffer = new Map<string, number>()
  for (const pfad of dateien(WURZEL)) {
    const src = readFileSync(pfad, 'utf8')
    let n = 0
    for (const m of src.matchAll(GROESSE)) {
      if (Number(m[1]) < UNTERGRENZE_PX) n += 1
    }
    if (n > 0) treffer.set(relative(WURZEL, pfad), n)
  }
  return treffer
}

const summe = (m: Map<string, number>): number =>
  [...m.values()].reduce((s, n) => s + n, 0)

describe('Fliesstext-Untergrenze 12px', () => {
  it('sieht ueberhaupt Dateien — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waere die Ratsche auch dann gruen, wenn die
    // Baumsuche nichts mehr findet: 0 <= 828 ist wahr. Ein Waechter, der bei
    // kaputtem Muster gruen wird, ist schlechter als keiner — er behauptet
    // eine Deckung, die es nicht gibt.
    expect(dateien(WURZEL).length).toBeGreaterThan(150)
  })

  it('findet die bekannten Fundstellen — sonst passt das Muster nicht mehr', () => {
    // Zweite Haelfte derselben Zusicherung: Dateien zu finden reicht nicht,
    // das Muster muss auch greifen. Faellt der Wert auf 0, ist die Migration
    // entweder fertig (dann darf diese Zeile weg) oder das Muster ist tot.
    expect(summe(zuKlein())).toBeGreaterThan(0)
  })

  it('die Ratsche: die Zahl steigt nicht', () => {
    const treffer = zuKlein()
    const jetzt = summe(treffer)
    const groesste = [...treffer.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([datei, n]) => `${datei} (${n})`)
      .join(', ')
    expect(
      jetzt,
      `Schriftgroessen unter ${UNTERGRENZE_PX}px: ${jetzt} statt hoechstens ${BARRIERE}. ` +
        `Groesste Posten: ${groesste}. Neue Stellen nutzen die Typo-Skala ` +
        `(text-cp-xs/-sm/-base/-lg) statt einer eigenen px-Angabe.`,
    ).toBeLessThanOrEqual(BARRIERE)
  })

  it('die Mobile-Ansicht bleibt sauber', () => {
    // Sie ist migriert (58 Stellen) und wird auf einem Telefon im dunklen
    // Truck gelesen — dort tut die Untergrenze am meisten. Ohne diese Zeile
    // koennte sie zurueckfallen, waehrend anderswo etwas migriert wird, und
    // die Gesamtzahl bliebe gleich. Die Ratsche allein sieht das nicht.
    const rueckfall = [...zuKlein().keys()].filter((d) => d.startsWith(`mobile${sep}`))
    expect(rueckfall, `Mobile-Ansicht wieder unter der Untergrenze: ${rueckfall.join(', ')}`)
      .toEqual([])
  })
})

describe('die Skala selbst', () => {
  const css = readFileSync(join(WURZEL, 'renderer', 'index.css'), 'utf8')

  it('faengt bei genau der Untergrenze an', () => {
    // WICHTIG, UND NICHT NUR EINE VERDOPPLUNG DES CSS.
    //
    // Die Ratsche zaehlt nur eigene px-Angaben. Setzte jemand
    // `--text-cp-xs` auf 0.625rem, waere jede Migration nach `text-cp-xs`
    // ein Schritt UNTER die Untergrenze — und die Ratsche saehe dabei zu,
    // wie ihre Zahl sinkt. Ein Waechter, der denselben Defekt hat wie das
    // Gepruefte, ist auf diesem Defekt gruen.
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
