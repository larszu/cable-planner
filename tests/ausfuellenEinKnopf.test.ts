import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { AUSFUELL_QUELLEN, AUSFUELL_VORGABE } from '../src/renderer/lib/felderAusfuellen'

// ---------------------------------------------------------------------------
// cable#858 — die drei Zusagen dieses Zuges, und was dieser Lauf davon misst.
//
// Nutzer-Meldung: „Beim anlegen neuer Geraete soll man schon vorhandene
// Geraete als preset nehmen koennen um die Felder vorauszufuellen und nur noch
// Teile davon anpassen zu muessen. Und heuristik funktioniert nicht, kann also
// weg. Ebenso muss es nur einen mit ausfuellen Knopf geben den man in den
// Einstellungen konfigurieren kann."
//
// Drei Zusagen also:
//   1. Eine vorhandene Vorlage kann die Felder fuellen.
//   2. Die Heuristik ist weg — nicht versteckt, weg.
//   3. Es gibt EINEN Ausfuellen-Knopf, und die Quelle steht in den
//      Einstellungen.
//
// WARUM GERECHNET UND NICHT AUFGEZAEHLT. Bei (2) und (3) ist die Zahl der
// Stellen der ganze Punkt. Ein Test, der nur den Anlegen-Dialog ansieht,
// bliebe gruen, waehrend der Rentman-Assistent weiter zwei Knoepfe fuehrt —
// und genau so war der Zustand vorher: drei Flaechen, sechs Knoepfe, und die
// Absicht „nur einer" stand nirgends als Messung.
//
// NICHT GEMESSEN, und das ausdruecklich:
//
//   * Ob eine Quelle GUT raet. Web und Modell raten beide; dieser Lauf haelt
//     nur fest, dass sie ihre Herkunft mitgeben. Ob die Zahl stimmt, sagt ein
//     Datenblatt und kein Test.
//   * Wie die Oberflaeche aussieht. Gemessen wird der Quelltext, nicht das
//     Fenster: dass der Knopf sichtbar, erreichbar und gross genug ist, sieht
//     dieser Lauf nicht.
//   * Die NetBox-Einfuhr. Sie fuellt auch Felder eines neuen Geraets, ist aber
//     keine ratende Quelle, sondern eine Abfrage an ein gepflegtes
//     Bestandsverzeichnis — dort steht, was dort eingetragen wurde. Sie faellt
//     deshalb nicht unter „ein Ausfuellen-Knopf".
// ---------------------------------------------------------------------------

const RENDERER = resolve(__dirname, '..', 'src', 'renderer')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(entry) ? [full] : []
  })

const dateien = walk(RENDERER).map((f) => ({
  pfad: relative(RENDERER, f).split(sep).join('/'),
  text: readFileSync(f, 'utf8'),
}))

const lies = (pfad: string): string => {
  const treffer = dateien.find((d) => d.pfad === pfad)
  if (!treffer) throw new Error(`${pfad} gibt es nicht — der Test zeigt ins Leere`)
  return treffer.text
}

// ─── Zusage 2: die Heuristik ist weg ───────────────────────────────────────

describe('die Heuristik ist entfernt und nicht nur ausgeblendet', () => {
  it('das Modul exportiert sie nicht mehr', () => {
    const lib = lies('lib/portSuggestions.ts')
    expect(lib).not.toContain('export const suggestPortGroups')
    // Die Regeln selbst auch nicht — ein Knopf weniger vor einer Rechnung,
    // die bleibt, ist kein entfernter Rechenweg.
    expect(lib).not.toMatch(/const rules\s*:/)
  })

  it('keine einzige Datei ruft sie noch auf', () => {
    const rufer = dateien.filter((d) => /suggestPortGroups\s*\(/.test(d.text)).map((d) => d.pfad)
    expect(rufer, 'ruft die entfernte Heuristik').toEqual([])
  })

  it('was BLEIBT, bleibt: die Form und der Weg zur Vorlage', () => {
    // Die Gegenprobe zur Loeschung. `PortGroupHint` ist die Sprache, in der
    // beide uebrigen Quellen antworten, und `buildTemplateFromHints` der Weg
    // von dort zu einer Vorlage. Wer beim Aufraeumen zu weit greift, nimmt
    // den Quellen ihr Ziel.
    const lib = lies('lib/portSuggestions.ts')
    expect(lib).toContain('export interface PortGroupHint')
    expect(lib).toContain('export const buildTemplateFromHints')
  })

  it('der Rentman-Assistent fuellt nicht mehr ungefragt beim Schrittwechsel', () => {
    // Das war die stillste der sechs Stellen: kein Knopf, kein Klick, und
    // weil die Heuristik nie leer lieferte, stand nach jedem Schrittwechsel
    // etwas Erfundenes in den Gruppen.
    const src = lies('components/Rentman/NewRentmanDeviceWizard.tsx')
    const effekt = src.slice(src.indexOf('useEffect(() => {'), src.indexOf('const progress'))
    expect(effekt).toContain('setGroups([])')
    expect(effekt).not.toContain('hintsToDrafts(')
  })
})

// ─── Zusage 3: EIN Knopf, Quelle aus den Einstellungen ─────────────────────

describe('es gibt einen Ausfuellen-Knopf und eine Stelle, die ihn steuert', () => {
  /** Die drei Flaechen, die vorher zusammen sechs Knoepfe fuehrten. */
  const FLAECHEN = [
    'components/Library/LibraryPanel.tsx',
    'components/Rentman/NewRentmanDeviceWizard.tsx',
    'components/Properties/sections/PortAiSuggestButton.tsx',
  ]

  it('jede der drei Flaechen ruft die eine Weiche', () => {
    for (const f of FLAECHEN) expect(lies(f), f).toContain('felderAusfuellen(')
  })

  it('und keine ruft eine Quelle noch direkt', () => {
    // Sonst gaebe es die Einstellung zwar, aber eine Flaeche hoerte nicht
    // darauf — genau der Zustand, in dem `PortAiSuggestButton` war: er fragte
    // immer das Modell, auch wenn der Nutzer die Websuche gewaehlt hatte.
    for (const f of FLAECHEN) {
      expect(lies(f), `${f} ruft suggestFromAI direkt`).not.toMatch(/suggestFromAI\s*\(/)
      expect(lies(f), `${f} ruft suggestFromWeb direkt`).not.toMatch(/suggestFromWeb\s*\(/)
    }
  })

  it('jede Flaeche liest die Quelle aus den Einstellungen', () => {
    for (const f of FLAECHEN) expect(lies(f), f).toContain('s.ausfuellQuelle')
  })

  it('die Weiche kennt genau zwei Quellen, und die Vorgabe braucht keinen Schluessel', () => {
    expect(AUSFUELL_QUELLEN).toEqual(['web', 'ki'])
    // Die Web-Vorgabe ist kein Geschmack: mit `ki` waere der erste Klick
    // jedes neuen Nutzers eine Fehlermeldung „kein API-Key".
    expect(AUSFUELL_VORGABE).toBe('web')
  })

  it('die Einstellung ist erreichbar und nicht nur vorhanden', () => {
    const tab = lies('components/Settings/tabs/IntegrationsTab.tsx')
    expect(tab).toContain('setAusfuellQuelle')
    expect(tab).toContain('<AusfuellQuelleCard />')
  })

  it('ein alter Speicherwert fuehrt nicht zu einer Quelle, die es nicht gibt', () => {
    // Wer „Heuristik" gewaehlt hatte, traegt sie noch im localStorage. Ein
    // blosses `typeof === 'string'` liesse den Wert stehen, und der Knopf
    // fragte dann niemanden.
    const store = lies('store/settingsStore.ts')
    expect(store).toContain('AUSFUELL_QUELLEN.includes(')
  })
})

// ─── Zusage 1: von einer vorhandenen Vorlage ausgehen ──────────────────────

describe('eine vorhandene Vorlage kann die Felder fuellen', () => {
  const src = () => lies('components/Library/LibraryPanel.tsx')

  it('der Anlegen-Dialog hat eine Vorlagen-Auswahl', () => {
    expect(src()).toContain('presetUebernehmen')
    expect(src()).toContain('library.create.preset')
  })

  it('sie fuellt ALLE Felder, nicht nur den Namen', () => {
    const fn = src().slice(src().indexOf('const presetUebernehmen'), src().indexOf('const hintsToLocalDrafts'))
    for (const setzer of ['setName(', 'setCategory(', 'setIsRackDeviceDraft(', 'setRackUnitsDraft(', 'setGroups(']) {
      expect(fn, setzer).toContain(setzer)
    }
  })

  it('die Ports werden zu GRUPPEN zusammengefasst', () => {
    // Sonst stuenden nach dem Uebernehmen acht Einzelzeilen da, die der
    // Nutzer von Hand zusammenfassen muesste — genau die Arbeit, die ihm die
    // Vorlage abnehmen soll.
    expect(src()).toContain('portsZuGruppen(')
  })

  it('der Name bekommt einen Zusatz, damit das Original nicht ueberschrieben wird', () => {
    // `addCustomTemplate` schreibt nach NAME. Ohne Zusatz truege die neue
    // Vorlage denselben Namen wie die alte, und das Original waere still
    // weg — beim Abschreiben, also genau dann, wenn niemand damit rechnet.
    expect(src()).toContain("library.create.preset.suffix")
  })

  it('die Herkunft wandert mit', () => {
    // Wer aus einer Vorlage abschreibt, deren Ports geraten waren, erbt die
    // Vermutung — und soll das sehen. Ohne diese Zeile wuerden geratene Ports
    // beim Kopieren zu Tatsachen.
    expect(src()).toContain("library.origin.preset")
  })
})
