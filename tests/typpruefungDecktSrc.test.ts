import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

// ---------------------------------------------------------------------------
// Jede Quelldatei unter `src/` wird von mindestens einem tsconfig geprueft.
//
// ─── DER BEFUND, DER DIESEN WAECHTER AUSGELOEST HAT ────────────────────────
//
// `src/mobile` stand in KEINEM der fuenf tsconfigs. Nicht in `app` (das nannte
// `src/renderer` und `src/viewer`), nicht in `main`, nicht in `node`, nicht in
// `preload`. Der Ordner war damit vollstaendig aus der Typpruefung heraus —
// und weil `build:renderer` schlicht `vite build` ist und Vite TypeScript nur
// transpiliert statt es zu pruefen, war auch der Build gruen.
//
// Was in dieser Luecke ueberlebt hat: `ProjectView` las `writeMode` als
// FREIEN BEZEICHNER (vier Stellen, seit Bedarf 109 / d3ca31c). Der Zustand
// dazu lag in `MobileApp` und wurde nie durchgereicht. Das ist kein falsch
// gesetzter Knopf, sondern ein `ReferenceError` beim ersten Rendern mit
// Projekt: DIE MOBILE-ANSICHT WAR WEISS, SOBALD EIN PLAN GELADEN WURDE.
// Gemessen im Browser gegen `dist/renderer/mobile.html`; `tsc` meldete den
// Fehler in derselben Sekunde, in der der Ordner ins tsconfig kam.
//
// CLAUDE.md verlangt `npx tsc -p tsconfig.app.json --noEmit` vor jedem Push,
// und diese Pruefung war gruen — sie sah den Ordner ja nicht an. Genau das
// macht die Luecke gefaehrlicher als den einzelnen Defekt: eine Pruefung, die
// weniger prueft als ihr Name sagt, wird geglaubt.
//
// ─── WARUM HIER `tsc` LAEUFT UND NICHT DIE `include`-MUSTER GELESEN WERDEN ─
//
// Die erste Fassung dieses Waechters las die `include`-Eintraege und bildete
// sie auf Regexe ab. Das war falsch, und zwar nachgemessen: `src/main*.ts`
// deckt in Wahrheit `src/main/ipc/atemIpc.ts` mit ab — geprueft mit einer
// Wegwerfdatei `src/main/zzz-probe.ts`, die einen Typfehler trug und von
// `tsc -p tsconfig.main.json` gemeldet wurde. Nach der Dokumentation
// („`*` matcht keinen Pfadtrenner") haette sie durchfallen muessen.
//
// Ein Waechter, der die Regel NACHBAUT, prueft am Ende seine eigene Lesart.
// Deshalb fragt dieser hier den Compiler selbst: `--listFilesOnly` gibt genau
// die Dateien aus, die ein Lauf anfassen wuerde — inklusive der ueber Importe
// hinzugezogenen, die ja ebenfalls geprueft werden.
//
// Kosten: rund sieben Sekunden fuer alle vier Konfigurationen (gemessen —
// `--listFilesOnly` ueberspringt die Pruefung selbst; mit `--listFiles`
// waeren es 47). Das ist der Preis dafuer, dass die Antwort stimmt.
//
// ─── DIE DOMAENE IST DER ORDNER, NICHT EINE LISTE IM WAECHTER ──────────────
//
// Dieselbe Lehre wie bei `dialogTastaturbedienung.test.ts`: geprueft wird der
// BAUM, nicht eine gepflegte Aufzaehlung. Wer morgen `src/kiosk/` anlegt und
// vergisst, ihn einzutragen, wird hier rot — nicht erst, wenn jemand den
// weissen Bildschirm meldet.
// ---------------------------------------------------------------------------

const WURZEL = process.cwd()
const SRC = join(WURZEL, 'src')

/** Was TypeScript pruefen kann und deshalb geprueft werden muss. */
const QUELLE = /\.(ts|tsx|cts|mts)$/

const dateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((eintrag) => {
    const pfad = join(dir, eintrag)
    if (statSync(pfad).isDirectory()) return dateien(pfad)
    return QUELLE.test(pfad) ? [pfad] : []
  })

const tsconfigs = (): string[] =>
  readdirSync(WURZEL)
    .filter((f) => /^tsconfig.*\.json$/.test(f))
    .sort()

/**
 * Die Dateien, die ein Lauf gegen dieses tsconfig anfassen wuerde.
 *
 * `tsconfig.json` selbst ist die Solution-Root: sie hat `files: []` und nur
 * `references`. Ein Lauf dagegen fasst nichts an, und das ist richtig so —
 * die Referenzen zeigen auf die anderen vier, die hier einzeln laufen.
 */
const angefasst = (konfig: string): Set<string> => {
  const roh = execFileSync('npx', ['tsc', '-p', konfig, '--listFilesOnly'], {
    cwd: WURZEL,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  return new Set(
    roh
      .split('\n')
      .map((z) => z.trim())
      .filter(Boolean)
      .map((z) => resolve(WURZEL, z)),
  )
}

/** Einmal messen, dann alle Zusicherungen darauf. Sieben Sekunden reichen. */
const gepruefte = (): Set<string> => {
  const alle = new Set<string>()
  for (const k of tsconfigs()) {
    for (const d of angefasst(k)) alle.add(d)
  }
  return alle
}

const alsAnzeige = (abs: string): string => relative(WURZEL, abs).split(sep).join('/')

describe('die Typpruefung deckt src', () => {
  const imBaum = dateien(SRC)
  let gedeckt: Set<string>

  it('faehrt ueberhaupt einen Compiler-Lauf', { timeout: 180_000 }, () => {
    // Ohne diese Zusicherung waere alles Weitere gruen, wenn `tsc` gar nichts
    // ausgibt: eine leere Menge deckt eine leere Menge. Und ohne die zweite
    // waere es gruen, wenn die Baumsuche nichts findet.
    gedeckt = gepruefte()
    expect(tsconfigs().length).toBeGreaterThanOrEqual(5)
    expect(gedeckt.size).toBeGreaterThan(500)
    expect(imBaum.length).toBeGreaterThan(100)
  })

  it('keine Quelldatei faellt zwischen die tsconfigs', () => {
    const offen = imBaum
      .filter((d) => !gedeckt.has(d))
      .map(alsAnzeige)
      .sort()
    expect(
      offen,
      `Diese Dateien prueft kein tsconfig — sie koennen jeden Typfehler ` +
        `tragen, ohne dass eine Pruefung rot wird: ${offen.join(', ')}`,
    ).toEqual([])
  })

  it('und kein ganzer Ordner unter src', () => {
    // Zweite Sicht auf dieselbe Frage, und die schaerfere: eine EINZELNE
    // ungedeckte Datei ist ein Versehen, ein ganzer ungedeckter Ordner ist
    // genau der Befund von oben. Die Zeile nennt ihn beim Namen, statt ihn
    // in einer langen Dateiliste zu verstecken.
    const ordner = [
      ...new Set(
        imBaum
          .filter((d) => !gedeckt.has(d))
          .map(alsAnzeige)
          .map((rel) => rel.split('/').slice(0, 2).join('/')),
      ),
    ].sort()
    expect(ordner, `ganz ausserhalb der Typpruefung: ${ordner.join(', ')}`).toEqual([])
  })
})
