import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { klassifiziere } from '../scripts/quellsprache.mjs'

// ---------------------------------------------------------------------------
// Die Saetze der sprachfreien Module stehen in der Quellsprache (#837, #838).
//
// ─── DIE LUECKE, GEMESSEN ──────────────────────────────────────────────────
//
// Seit #837 rechnen `types/adapter.ts`, `types/conductor.ts`,
// `types/displayCapability.ts`, `types/cableSpec.ts`, `lib/labelDerivation.ts`
// und `lib/portGroups.ts` sprachfrei: sie liefern `schluessel`, `werte` und
// einen englischen `text`, den `einsetzen(...)` zusammensetzt. Uebersetzt wird
// beim Anzeigen.
//
// Das ist richtig — es haelt `lib/i18n.ts` (mit `de.ts`, 316 KB) aus dem
// Importgraphen der Mobile-Ansicht. Es hat aber einen Preis, und der wurde am
// 2026-09-10 nachgemessen: DER SPRACH-WAECHTER SIEHT DIESE SAETZE NICHT.
// `npm run lang:check` liest `t()`- und `tr()`-Aufrufe; ein Argument von
// `einsetzen(...)` ist keiner. Zur Gegenprobe wurde ein Satz in
// `portGroups.ts` versuchsweise auf Deutsch gesetzt — `lang:check` meldete
// weiterhin „0 deutsch".
//
// Es ist dieselbe Form wie bei den Kategorie-Werten (#822) und den
// Vorlagen-Namen (#837): der Waechter steht an der Tuer, und die Sprache kommt
// durchs Fenster.
//
// ─── WARUM HIER `klassifiziere()` TRAEGT, WO ES DAS SONST NICHT TUT ────────
//
// `tests/pruefMeldungenGewickelt.test.ts` sagt ausdruecklich, dass
// `klassifiziere()` fuer seine Frage untauglich ist — es haelt
// „Allen & Heath SQ-5" fuer deutsch und „Steckdosenleiste 6-fach" fuer
// merkmalslos. Beide Fehler betreffen KURZE Bezeichner: Produkt- und
// Herstellernamen.
//
// Hier geht es um etwas anderes. Geprueft wird das erste Argument von
// `einsetzen(...)` — und das ist nie ein Bezeichner, sondern immer ein ganzer
// Satz mit Funktionswoertern („the", „does not", „is not stated"). Genau
// darauf ist die Wortliste ausgelegt. Deshalb ist die Frage hier entscheidbar,
// und deshalb steht sie in einem eigenen Test statt im anderen.
//
// Gemeldet wird nur `de` — nicht „ohne Merkmal". Ein Satz ohne deutsche
// Marker ist kein Verstoss, sondern ein Satz aus Fachbegriffen, und wer ihn
// meldete, brauchte eine Ausnahmeliste, die niemand pflegt.
// ---------------------------------------------------------------------------

const WURZEL = join(process.cwd(), 'src', 'renderer')

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const voll = join(dir, eintrag)
    if (statSync(voll).isDirectory()) return dateien(voll)
    return /\.tsx?$/.test(eintrag) ? [voll] : []
  })

/**
 * Das erste Argument von `einsetzen(` — die Vorlage, in die die Werte gehen.
 *
 * Einfache und doppelte Anfuehrungszeichen sowie Template-Literale, jeweils
 * auch nach einem Zeilenumbruch: der Formatierer bricht genau dort um, und
 * eine Vorlage, die dem Umbruch entkommt, waere die naechste stille Luecke.
 */
const VORLAGE =
  /\beinsetzen\(\s*(?:\n\s*)?(?:'((?:[^'\\]|\\.)+?)'|"((?:[^"\\]|\\.)+?)"|`((?:[^`\\]|\\.)+?)`)/g

/**
 * Die ZWEITE Form: ein Woerterbuch-Schluessel, direkt gefolgt vom Satz.
 *
 * `lib/dmx/adressierung.ts` reicht beides an einen eigenen `befund()`-Bauer
 * weiter, statt `einsetzen` mit einem Literal aufzurufen — das Muster oben
 * sieht davon nichts. Gemessen beim Bau des Moduls (2026-09-10): sieben
 * englische Saetze standen dort und waren fuer BEIDE Waechter unsichtbar,
 * fuer `lang:check` wie fuer diesen Test.
 *
 * Entscheidbar ist es trotzdem: ein Schluessel sieht aus wie `'bereich.name'`,
 * und was als naechstes Literal folgt, ist der Satz dazu. Kein Ermessen, keine
 * Wortliste.
 */
const SCHLUESSEL_UND_SATZ =
  /'([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+)',\s*(?:\n\s*)?(?:'((?:[^'\\]|\\.){12,}?)'|"((?:[^"\\]|\\.){12,}?)")/g

const ohneKommentare = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')

interface Fund {
  datei: string
  satz: string
}

const saetze = (): Fund[] => {
  const gefunden: Fund[] = []
  for (const datei of dateien(WURZEL)) {
    const rel = relative(WURZEL, datei).split('\\').join('/')
    // Das Woerterbuch IST die Uebersetzung — dort steht Deutsch mit Absicht.
    if (rel.includes('i18n')) continue
    const quelle = ohneKommentare(readFileSync(datei, 'utf8'))
    for (const m of quelle.matchAll(VORLAGE)) {
      gefunden.push({ datei: rel, satz: m[1] ?? m[2] ?? m[3] ?? '' })
    }
    for (const m of quelle.matchAll(SCHLUESSEL_UND_SATZ)) {
      gefunden.push({ datei: rel, satz: m[2] ?? m[3] ?? '' })
    }
  }
  return gefunden
}

describe('Die Saetze der sprachfreien Urteils-Module', () => {
  it('keiner von ihnen ist deutsch', () => {
    const deutsch = saetze()
      .filter((f) => klassifiziere(f.satz) === 'de')
      .map((f) => `${f.datei}: ${f.satz.slice(0, 70)}`)
    expect(
      deutsch,
      'Eine deutsche Vorlage in einem sprachfreien Modul. Sie erscheint im ' +
        'Plan-Check-Panel und auf gedruckten Blaettern, und `npm run lang:check` ' +
        'sieht sie NICHT — das Argument von `einsetzen(...)` ist kein ' +
        '`t()`-Aufruf. Den englischen Satz hier eintragen und die deutsche ' +
        'Fassung unter dem `schluessel` in `lib/i18n/de.ts`.',
    ).toEqual([])
  })

  it('die Pruefung sieht ueberhaupt etwas — Gegenprobe zum Muster', () => {
    // Ohne sie waere ein kaputtes Muster die gefaehrlichste Art gruen: es
    // findet nichts, und Nichts sieht hier aus wie ein Ergebnis.
    const gefunden = saetze()
    expect(gefunden.length).toBeGreaterThan(30)
    // Und die Module, um die es geht, sind wirklich dabei.
    const dateienMitSatz = new Set(gefunden.map((f) => f.datei))
    for (const modul of [
      'types/adapter.ts',
      'types/conductor.ts',
      'types/displayCapability.ts',
      'lib/labelDerivation.ts',
      'lib/portGroups.ts',
      // Ueber die zweite Form gefunden — steht hier, damit ein Rueckfall auf
      // ein Muster, das sie nicht mehr sieht, auffaellt.
      'lib/dmx/adressierung.ts',
    ]) {
      expect(dateienMitSatz.has(modul), `${modul} liefert keinen Satz mehr`).toBe(true)
    }
  })

  it('und sie erkennt einen deutschen Satz, wenn einer kaeme', () => {
    // Der Beweis, dass die erste Pruefung nicht nur deshalb gruen ist, weil
    // `klassifiziere()` hier grundsaetzlich schweigt.
    expect(
      klassifiziere(
        'Die Gruppe hat zweimal dieselbe Rolle und ist deshalb kein Stereo-Paar.',
      ),
    ).toBe('de')
  })
})
