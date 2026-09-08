import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @ts-expect-error — reines JS-Hilfsmodul ohne Typen, absichtlich
import {
  klassifiziere,
  messeQuellsprache,
  abweichungen,
  fallbackMuster,
} from '../scripts/quellsprache.mjs'

// ---------------------------------------------------------------------------
// E-17/E-20 — die Quellsprache ist erklaert UND gemessen.
//
// DIE ENTSCHEIDUNG (Eigentuemer, 2026-09-08): cable-planner und light-planner
// sind deutsch-quellig, multicam-planner und sony-camera-bridge
// englisch-quellig, und die Quellsprache ist eine Eigenschaft des REPOS, nicht
// der Suite.
//
// DER SCHADEN, GEGEN DEN SIE STEHT, ist konkret und im Backlog vermessen: ohne
// Festlegung „vereinheitlicht" der naechste Durchgang die Abweichung und fasst
// ~500 Zeichenketten an, weil eine andere Stelle etwas anderes nahelegt. Die
// Richtung spaeter zu drehen heisst, jede davon erneut anzufassen — und der
// Nutzer saehe keinen Unterschied.
//
// WARUM DREI ZUSICHERUNGEN UND NICHT EINE. Eine Deklaration in `package.json`
// allein liest niemand; eine Zeile in `CLAUDE.md` allein prueft niemand; eine
// Messung allein sagt nicht, was gewollt ist. Erst zusammen ergeben sie eine
// Regel: die Absicht steht doppelt, an beiden Stellen, die jemand liest, und
// der Quelltext muss dazu passen.
//
// Die vierte Zusicherung ist die unbequeme: der KLASSIFIZIERER selbst wird
// geprueft. Ohne sie liesse sich dieser Test gruen machen, indem man die
// Wortlisten leert — die Messung faende dann nichts und der Waechter meldete
// Ruhe. Genau diese Sorte stiller Abschaltung ist es, gegen die die
// Gegenproben in diesem Repo geschrieben sind.
// ---------------------------------------------------------------------------

const WURZEL = resolve(__dirname, '..')
const RENDERER = resolve(WURZEL, 'src', 'renderer')

const ERLAUBT = ['de', 'en'] as const

const paket = JSON.parse(readFileSync(resolve(WURZEL, 'package.json'), 'utf8')) as {
  avplan?: { sourceLanguage?: string }
}

describe('die Quellsprache ist erklaert', () => {
  it('steht maschinenlesbar in package.json', () => {
    expect(paket.avplan?.sourceLanguage, 'package.json: avplan.sourceLanguage fehlt').toBeDefined()
    expect(ERLAUBT as readonly string[]).toContain(paket.avplan!.sourceLanguage!)
  })

  it('steht in CLAUDE.md — und sagt dasselbe', () => {
    // Beide Stellen, weil beide gelesen werden: das Feld von Werkzeugen, die
    // Zeile von Menschen. Gehen sie auseinander, glaubt jede Seite etwas
    // anderes, und das ist schlimmer als eine fehlende Angabe.
    const claude = readFileSync(resolve(WURZEL, 'CLAUDE.md'), 'utf8')
    const treffer = claude.match(/\*\*Quellsprache: `([a-z]{2})`\*\*/)
    expect(treffer, 'CLAUDE.md nennt die Quellsprache nicht').not.toBeNull()
    expect(treffer![1]).toBe(paket.avplan!.sourceLanguage)
  })
})

describe('die Quellsprache ist gemessen', () => {
  const messung = messeQuellsprache(RENDERER)

  it('kein Fallback steht in einer anderen Sprache', () => {
    // Ein einzelner reicht: aus einem englischen Fallback in einem deutschen
    // Dialog wird der Sprachmix, den B-26 im sony-camera-bridge beschreibt —
    // englische und deutsche Beschriftungen nebeneinander, ohne Schalter.
    const falsch = abweichungen(messung, paket.avplan!.sourceLanguage)
    expect(
      falsch.map((s: { datei: string; text: string }) => `${s.datei}: ${s.text}`),
    ).toEqual([])
  })

  it('das Woerterbuch faellt nicht hinein — ohne Ausnahmeliste', () => {
    // WARUM DAS HIER STEHT. Das `en`-Dict ist voller englischer Zeilen, und das
    // ist richtig so: es ist die Uebersetzung. Die naheliegende Loesung waere
    // eine Ausnahmeliste — und die waere unverdient, denn gemessen aendert sie
    // nichts (2202/0/2697 mit wie ohne). Sie saehe aus wie ein Schutz und
    // deckte nichts ab, und der Naechste traegt einen Pfad ein, der doch etwas
    // verdeckt.
    //
    // Was das Woerterbuch wirklich heraushaelt, ist seine FORM: es ist ein
    // Objekt-Literal und kein Aufruf. Genau das steht hier als negative
    // Zusicherung — eine Abwesenheit ist per Quelltext-Suche belegbar.
    // Geprueft mit DEMSELBEN Muster, das auch misst — nicht mit einem zweiten
    // daneben. Die erste Fassung hier war breiter und schlug auf einem
    // KOMMENTAR an, in dem `translate('de', k, fallback)` als Beispiel steht.
    const dicts = readFileSync(resolve(RENDERER, 'lib', 'i18n', 'dicts.ts'), 'utf8')
    expect([...dicts.matchAll(fallbackMuster())]).toEqual([])
  })

  it('misst ueberhaupt etwas — sonst waere die Ruhe oben wertlos', () => {
    // Die Gegenprobe zur Gegenprobe. Ein kaputtes Muster faende null Stellen
    // und der Test darueber bliebe gruen. Die Zahl ist bewusst weit unter dem
    // Ist-Stand (2202 am 2026-09-08): sie soll einen Totalausfall fangen, nicht
    // bei jeder Umformulierung anschlagen.
    expect(messung.de + messung.en).toBeGreaterThan(1500)
  })
})

describe('der Klassifizierer selbst', () => {
  it('erkennt deutsche Zeilen', () => {
    for (const s of [
      'Kabel konnte nicht angelegt werden',
      'Die geplante Schaltung legt dieses Signal auf keinen Ausgang',
      'Gerät auswählen',
      'Ausgang und Eingang zeigen auf dieselbe Variable.',
    ]) {
      expect(klassifiziere(s), s).toBe('de')
    }
  })

  it('erkennt englische Zeilen', () => {
    for (const s of [
      'Remove from library',
      '{n} updated from reviewer changes.',
      'Please select a device before continuing.',
      'This project has unsaved changes.',
    ]) {
      expect(klassifiziere(s), s).toBe('en')
    }
  })

  it('meldet deutsche Zeilen mit Fachbegriff NICHT als englisch', () => {
    // Die vier, an denen eine fruehere Fassung danebengriff. Sie stehen hier
    // namentlich, weil ein Waechter, der bei richtigen Zeilen anschlaegt,
    // abgeschaltet und nicht gelesen wird — dieselbe Erfahrung wie beim
    // ascii-drift-Guard mit dem Wort „Steuerzeichen".
    for (const s of ['Was funkt', 'gepinnt an', '{a} ↔ {b}: gleicher Kanal {ch}']) {
      expect(klassifiziere(s), s).not.toBe('en')
    }
    // Deutscher Satz mit englischem Fachbegriff: unklar, nicht „englisch".
    expect(klassifiziere('Viewer-Datei — read-only')).not.toBe('en')
  })

  it('laesst Platzhalter nicht als Sprache durchgehen', () => {
    // `{from} → {to}` sind zwei Feldnamen und keine englische Zeile.
    expect(klassifiziere('{from} → {to}')).toBeNull()
    expect(klassifiziere('{source} · {when}')).toBeNull()
  })

  it('gibt kurzen Beschriftungen keine Sprache', () => {
    // „Aktualisieren" ist deutsch, traegt aber kein Merkmal. Lieber unklar als
    // geraten: eine falsche Zuordnung waere ein Fehlalarm, und Fehlalarme
    // kosten den Waechter.
    expect(klassifiziere('Rack/Gruppe')).toBeNull()
    expect(klassifiziere('OK')).toBeNull()
  })
})
