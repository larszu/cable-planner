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
// ─── WAS DIESER WAECHTER PRUEFT — UND WO ER ES NICHT KONNTE (2026-09-10) ───
//
// Die erste Fassung stuetzte sich allein auf `klassifiziere()` aus
// `scripts/quellsprache.mjs`. Diese Funktion kennt bewusst nur Woerter, die es
// in der jeweils anderen Sprache nicht gibt, und laesst Fachbegriffe
// (`Tally`, `Timecode`, `NMOS`, `PoE-Budget`, `Dual-Link`) als „ohne Merkmal"
// durch — ein Waechter, der bei `Rigging` anschlaegt, wird abgeschaltet statt
// gelesen. Diese Zurueckhaltung ist richtig und bleibt.
//
// NUR: sie kennt AUCH KEINEN der zwoelf Werte, um die es hier geht.
// Nachgemessen — `klassifiziere()` gibt fuer `Kameras`, `Monitore`,
// `Netzwerk`, `Sonstiges`, `Konverter`, `Patchblende`, `Stromverteilung`,
// `Mischpult`, `Mikrofone`, `Funkstrecke`, `Strom` und `Sync/Referenz` jedes
// Mal `null` zurueck. Der Waechter, der die Umbenennung sichern sollte, hat
// an keinem einzigen von ihnen je angeschlagen.
//
// Die Folge stand vier Wochen in der Auslieferung: `Kameras`, `Monitore`,
// `Netzwerk` und `Sonstiges` wurden weiter ausgeliefert — teils ueber eine
// Konstante, die das Muster nicht sah, teils ausserhalb von `lib/`, wo gar
// nicht gesucht wurde. In der Seitenleiste standen sie neben ihren englischen
// Nachbarn.
//
// Die tragende Regel ist deshalb jetzt eine andere, und sie braucht keine
// Wortliste: KEIN ausgelieferter Kategorie-Wert darf in
// `LEGACY_CATEGORY_RENAMES` als ALTER Name stehen. Das ist entscheidbar,
// vollstaendig und sprachunabhaengig. Die Sprachpruefung bleibt daneben
// stehen — sie faengt einen NEUEN deutschen Wert, den noch niemand in die
// Umbenennungstabelle eingetragen hat.
//
// Geprueft werden die Stellen, an denen ausgelieferte Daten entstehen: die
// Geraete-Kataloge (auch ueber Konstanten), die Rueckfaelle beim Import, die
// Vorgabe des Anlege-Dialogs, das Beispielprojekt und die Vorgabe-Kategorien.
// ---------------------------------------------------------------------------

const LIB = join(process.cwd(), 'src', 'renderer', 'lib')
// GANZ `src/renderer`, nicht nur `lib/`. Die erste Fassung sah nur die
// Kataloge — und die Vorgabe des Anlege-Dialogs (`LibraryPanel.tsx`) sowie der
// Kategorie-Rueckfall beim Einfuegen (`useCanvasKeyboardShortcuts.tsx`) liegen
// woanders. Beide schrieben nach #822 weiter den alten deutschen Wert.
const RENDERER = join(process.cwd(), 'src', 'renderer')

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

/**
 * Jeder ausgelieferte `category:`-Wert, mit seiner Datei.
 *
 * ─── DIE INDIREKTION UEBER EINE KONSTANTE ──────────────────────────────────
 *
 * `category: 'Kameras'` findet ein Muster. `const CAM = 'Kameras'` und
 * `category: CAM` findet es nicht — und genau so schreiben die drei groessten
 * Kataloge (`cameraCatalog`, `monitorCatalog`, `ubiquitiCatalog`): ein
 * Kuerzel oben, dann hundertfach benutzt. Die erste Fassung dieses Waechters
 * las an ihnen vorbei.
 *
 * Aufgeloest werden deshalb auch Bezeichner, die in derselben Datei als
 * einfache Zeichenketten-Konstante stehen. Mehr braucht es nicht: eine
 * Kategorie, die aus einer Funktion kommt, ist keine ausgelieferte Angabe
 * mehr, sondern eine berechnete.
 */
const kategorienIn = (wurzel: string): Fund[] => {
  const funde: Fund[] = []
  for (const pfad of dateien(wurzel)) {
    const quelle = readFileSync(pfad, 'utf8')
    const konstanten = new Map<string, string>()
    for (const m of quelle.matchAll(/^const ([A-Za-z_][A-Za-z0-9_]*) = '([^']+)'/gm)) {
      konstanten.set(m[1], m[2])
    }
    const datei = relative(process.cwd(), pfad).split(sep).join('/')
    for (const m of quelle.matchAll(/\bcategory: (?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))/g)) {
      const wert = m[1] ?? konstanten.get(m[2])
      if (wert) funde.push({ datei, wert })
    }
    // Der Rueckfall beim Import („was keine Kategorie hat, bekommt diese").
    // Er ist genauso eine ausgelieferte Angabe wie ein Katalog-Eintrag: er
    // landet unveraendert in der Bibliothek des Nutzers.
    for (const m of quelle.matchAll(/(?:category[^\n]{0,40}?(?:\|\||\?\?)\s*|FALLBACK_CATEGORY = )'([^']+)'/g)) {
      funde.push({ datei, wert: m[1] })
    }
  }
  return funde
}

const kategorien = (): Fund[] => kategorienIn(LIB)

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

  it('KEIN ausgelieferter Wert ist ein bereits umbenannter', () => {
    // ─── DIE ZUSICHERUNG, DIE #822 GEBRAUCHT HAETTE ────────────────────────
    //
    // GEMESSEN am 2026-09-10: `klassifiziere()` gibt fuer ALLE ZWOELF Werte,
    // die #822 von Hand umbenannt hat, `null` zurueck — `Kameras`,
    // `Monitore`, `Netzwerk`, `Sonstiges`, `Konverter`, `Patchblende`,
    // `Stromverteilung`, `Mischpult`, `Mikrofone`, `Funkstrecke`, `Strom`,
    // `Sync/Referenz`. Die Wortlisten kennen sie schlicht nicht.
    //
    // Der Waechter aus #822 hat also nie an einem einzigen von ihnen
    // angeschlagen. Er sah aus wie eine Deckung und war keine — und vier
    // deutsche Werte standen danach WEITER in der Auslieferung, sichtbar in
    // der Bibliotheks-Seitenleiste neben ihren englischen Nachbarn.
    //
    // Diese Regel braucht keine Wortliste. Ein Wert, der in
    // `LEGACY_CATEGORY_RENAMES` als ALTER Name steht, ist per Definition
    // umbenannt worden; ihn danach noch auszuliefern heisst, die Migration
    // gegen die eigene Auslieferung laufen zu lassen. Das ist entscheidbar,
    // vollstaendig, und unabhaengig davon, welche Sprache jemand spricht.
    const veraltet = kategorienIn(RENDERER)
      .filter((f) => LEGACY_CATEGORY_RENAMES[f.wert])
      .map((f) => `${f.datei}: '${f.wert}' -> '${LEGACY_CATEGORY_RENAMES[f.wert]}'`)
    expect(
      [...new Set(veraltet)],
      'Diese Stellen liefern einen Kategorie-Wert aus, der laengst umbenannt ' +
        'ist. Die Migration schreibt ihn im Projekt des Nutzers um — und die ' +
        'Auslieferung traegt ihn gleich wieder herein. Ergebnis: zwei Zeilen ' +
        'mit derselben Bedeutung in der Seitenleiste, und man sucht den ' +
        'Unterschied. Auf den neuen Wert stellen:\n  ' +
        veraltet.join('\n  '),
    ).toEqual([])
  })

  it('sieht dabei mehr als nur die Kataloge', () => {
    // Ohne diese Zusicherung waere die Regel oben auch dann erfuellt, wenn der
    // Scan wieder auf `lib/` zurueckfiele — und genau dort lagen zwei der
    // vier Fundstellen NICHT.
    const ausserhalbLib = kategorienIn(RENDERER).filter(
      (f) => !f.datei.startsWith('src/renderer/lib/'),
    )
    expect(ausserhalbLib.length).toBeGreaterThan(0)
  })

  it('loest Kategorien auf, die ueber eine Konstante laufen', () => {
    // Die zweite Haelfte derselben Luecke. `cameraCatalog.ts` schreibt
    // `const CAM = ...` und dann hundertfach `category: CAM`. Ein Scan, der
    // nur Zeichenketten sieht, findet dort NICHTS — und meldet trotzdem
    // „geprueft".
    const ausKonstante = kategorienIn(LIB).filter((f) =>
      f.datei.endsWith('cameraCatalog.ts'),
    )
    expect(
      ausKonstante.length,
      'Der Kamera-Katalog vergibt seine Kategorie ueber eine Konstante. ' +
        'Wenn hier nichts ankommt, liest der Waechter an ihm vorbei.',
    ).toBeGreaterThan(10)
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
    const quelle = readFileSync(join(LIB, 'demoProject.ts'), 'utf8')
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
