import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { klassifiziere } from '../scripts/quellsprache.mjs'
import { LEGACY_CATEGORY_RENAMES } from '../src/renderer/lib/categoryTranslations'
import { DEFAULT_CATEGORIES } from '../src/renderer/store/libraryPersist'

// ---------------------------------------------------------------------------
// Ausgelieferte DATEN stehen in der Quellsprache — nicht nur die Beschriftungen.
//
// ─── DER BEFUND (#822, gemessen 2026-09-10) ────────────────────────────────
//
// `npm run lang:check` meldete fuer alle drei Browser-Ordner 0 Verstoesse, und
// die Oberflaeche sah trotzdem gemischt aus. Der Grund: der Waechter liest
// `t()`-Fallbacks, und diese Zeichenketten sind keine Aufrufe, sondern DATEN.
//
// 12 der 64 ausgelieferten `category:`-Werte waren deutsch — `Kameras`,
// `Konverter`, `Patchblende`, `Stromverteilung`, `Funkstrecke`,
// `Sync/Referenz`, `Mikrofone`, `Mischpult`, `Monitore`, `Netzwerk`, `Strom`,
// `Sonstiges` —, und sie standen in der Bibliotheks-Seitenleiste direkt neben
// ihren englischen Nachbarn `Video`, `Networking`, `IP/NDI`, `IT/Server`.
//
// Dazu das eingebaute Beispielprojekt: `Beispiel: Kleines Studio-Setup`,
// `Kamera 1`, `Bildmischer`, `Regie-Monitor`. Das ist das ERSTE, was ein
// neuer Nutzer sieht.
//
// ─── WAS DIESER WAECHTER PRUEFT ────────────────────────────────────────────
//
// Dieselbe Klassifizierung, die auch `scripts/quellsprache.mjs` benutzt — NICHT
// eine zweite daneben. Sie kennt nur Woerter, die es in der jeweils anderen
// Sprache nicht gibt, und laesst Fachbegriffe (`Tally`, `Timecode`, `NMOS`,
// `PoE-Budget`, `Dual-Link`) als „ohne Merkmal" durch. Ein Waechter, der bei
// `Rigging` anschlaegt, wird abgeschaltet statt gelesen.
//
// Geprueft werden die Stellen, an denen ausgelieferte Daten entstehen:
// die Geraete-Kataloge, das Beispielprojekt, die Vorgabe-Kategorien und die
// Kategorien der Plan-Pruefung.
// ---------------------------------------------------------------------------

const WURZEL = join(process.cwd(), 'src', 'renderer', 'lib')

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const pfad = join(dir, eintrag)
    if (statSync(pfad).isDirectory()) {
      // Das Woerterbuch ist per Definition in der anderen Sprache.
      return eintrag === 'i18n' ? [] : dateien(pfad)
    }
    return /\.tsx?$/.test(pfad) ? [pfad] : []
  })

interface Fund {
  datei: string
  wert: string
}

/** Jeder ausgelieferte `category:`-Wert, mit seiner Datei. */
const kategorien = (): Fund[] => {
  const funde: Fund[] = []
  for (const pfad of dateien(WURZEL)) {
    const quelle = readFileSync(pfad, 'utf8')
    for (const m of quelle.matchAll(/\bcategory: '([^']+)'/g)) {
      funde.push({ datei: relative(process.cwd(), pfad).split(sep).join('/'), wert: m[1] })
    }
  }
  return funde
}

describe('Ausgelieferte Daten stehen in der Quellsprache', () => {
  it('sieht ueberhaupt Kategorien — sonst prueft der Test nichts', () => {
    // Ohne diese Zusicherung waere die Regel unten auch dann erfuellt, wenn
    // das Muster nicht mehr greift. Eine leere Menge erfuellt jede Regel.
    expect(kategorien().length).toBeGreaterThan(50)
  })

  it('kein ausgelieferter category-Wert ist deutsch', () => {
    const deutsch = kategorien()
      .filter((f) => klassifiziere(f.wert) === 'de')
      .map((f) => `${f.datei}: '${f.wert}'`)
    expect(
      [...new Set(deutsch)],
      'Ausgelieferte Kategorien sind DATEN und stehen in der Projektdatei des ' +
        'Nutzers. Sie gehoeren in die Quellsprache (E-28); die Uebersetzung ' +
        'steht in `categoryTranslations.ts` bzw. unter `check.category.*` im ' +
        'Woerterbuch. Wer hier umbenennt, traegt den alten Wert in ' +
        '`LEGACY_CATEGORY_RENAMES` nach — sonst verlieren bestehende Plaene ' +
        'ihre Zuordnung:\n  ' +
        deutsch.join('\n  '),
    ).toEqual([])
  })

  it('keine Vorgabe-Kategorie ist deutsch', () => {
    const deutsch = DEFAULT_CATEGORIES.filter((c) => klassifiziere(c) === 'de')
    expect(deutsch).toEqual([])
  })

  it('das Beispielprojekt ist in der Quellsprache', () => {
    // Es ist das ERSTE, was ein neuer Nutzer sieht — und der Grund, warum die
    // README-Bilder seit v8.1.0 nicht aufgefrischt werden konnten: eine
    // englische Oberflaeche mit deutschen Inhalten ist nicht besser als ein
    // altes Bild, nur anders falsch.
    const quelle = readFileSync(join(WURZEL, 'demoProject.ts'), 'utf8')
    const werte = [...quelle.matchAll(/\bname: '([^']+)'/g)].map((m) => m[1])
    expect(werte.length, 'Keine Namen im Beispielprojekt gefunden').toBeGreaterThan(5)
    const deutsch = werte.filter((w) => klassifiziere(w) === 'de')
    expect(deutsch, `Deutsch im Beispielprojekt: ${deutsch.join(', ')}`).toEqual([])
  })

  it('jede Umbenennung zeigt auf einen Wert, den es wirklich gibt', () => {
    // GEGENPROBE zur Migration. Ein Eintrag in `LEGACY_CATEGORY_RENAMES`, der
    // auf eine Kategorie zeigt, die es nicht mehr gibt, schreibt bestehende
    // Plaene auf einen toten Wert um — schlimmer als gar nicht migrieren,
    // weil es danach wie eine gepflegte Zuordnung aussieht.
    const vorhanden = new Set([
      ...kategorien().map((f) => f.wert),
      ...DEFAULT_CATEGORIES,
      // Nur im Rack-Builder-Dialog erzeugt, nicht in einem Katalog.
      'Patch panels (adapter)',
    ])
    const insLeere = Object.entries(LEGACY_CATEGORY_RENAMES)
      .filter(([, neu]) => !vorhanden.has(neu))
      .map(([alt, neu]) => `${alt} -> ${neu}`)
    expect(insLeere, `Umbenennung ohne Ziel: ${insLeere.join(', ')}`).toEqual([])
  })

  it('keine Umbenennung zeigt auf sich selbst', () => {
    // Ein Eintrag `X -> X` waere wirkungslos und saehe beim Lesen aus wie eine
    // Migration. Dieselbe Regel wie bei den erklaerten Ausnahmen im
    // Glyphen-Waechter: was nichts deckt, gehoert nicht in die Liste.
    const eitel = Object.entries(LEGACY_CATEGORY_RENAMES)
      .filter(([alt, neu]) => alt === neu)
      .map(([alt]) => alt)
    expect(eitel).toEqual([])
  })
})
