#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Die FORM der Oberflaeche — keine Rundungen, keine Schatten (ADR-007
// Abschnitt 3). Lauf: `npm run form:check`.
//
// ─── WARUM ES DIESEN LAUF ERST SEIT HEUTE GIBT ────────────────────────────
//
// Dieses Repo ist der Massstab, an dem die uebrigen Apps ausgerichtet werden
// — und es war das einzige der fuenf OHNE einen Form-Waechter. Gemessen am
// 2026-09-11, nur in Klassenlisten und ohne Kommentare:
//
//   cable-planner              1854 Rundungen, 74 Schatten
//   multicam-planner            237 Rundungen, 10 Schatten
//   light-planner                 0             0
//   inventory-planner             0             0
//   larszu-facility-planner       0             0
//
// Drei von fuenf hielten die Regel genau ein; die beiden, die sie brachen,
// waren die beiden mit den grossen Oberflaechen — und der schlimmste Fall war
// der Massstab selbst. Die Tokens `--radius-cp-control/-card/-modal` standen
// laengst auf null, nur hat sie kaum jemand benutzt: daneben lebten 1854 rohe
// `rounded`-Utilities weiter, die Tailwind mit 4 px aufloest.
//
// ─── WAS ER PRUEFT ────────────────────────────────────────────────────────
//
//   TSX/TS   Klassenlisten (`className=…`, `class=…`) auf rohe
//            `rounded*`/`shadow*`-Utilities.
//   CSS      `border-radius` mit einem anderen Wert als 0, und `box-shadow`
//            mit Unschaerfe oder Versatz.
//
// ─── UND WAS AUSDRUECKLICH ERLAUBT IST ────────────────────────────────────
//
//   rounded-cp-control/-card/-modal   Haus-Token. Ihr Wert ist null; ADR-007
//                                     sagt ausdruecklich, dass die NAMEN
//                                     bleiben, damit kein Aufrufer umgebaut
//                                     werden muss.
//   rounded-none / shadow-none        eine Verneinung ist kein Verstoss.
//   ring-*                            der Fokusring ist Pflicht, nicht Dekor.
//   box-shadow: 0 0 0 Npx <farbe>     ein RING ohne Unschaerfe und ohne
//                                     Versatz. Er traegt eine Meldung (der
//                                     abgelehnte Zug blitzt rot), er
//                                     behauptet keine Tiefe. Sobald eine
//                                     Unschaerfe oder ein Versatz dazukommt,
//                                     ist es ein Schlagschatten und faellt.
//
// ─── WAS ER NICHT SIEHT, UND DAS IST WICHTIG ──────────────────────────────
//
// Er liest NUR Klassenlisten. `light.shadow.mapSize` einer 3D-Szene ist ein
// Schatten im BILD und keine Flaeche der Oberflaeche — ein Waechter, der ihn
// mitzaehlt, beschuldigt den Inhalt und wird nach dem zweiten Fehlalarm
// abgeschaltet. Genau daran ist die erste Fassung der Messung gescheitert:
// sie meldete 15 „Schatten" im `light-planner`, und alle fuenfzehn waren
// Three.js.
//
// Er sieht auch keine Rundung, die zur Laufzeit entsteht — ein Stil aus einer
// Bibliothek, ein `style={{ borderRadius }}` aus einer Variablen. Was er
// zusagt, ist der Quelltext dieses Repos.
// ───────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')

export const BEHALTEN = /^(?:rounded-(?:cp-(?:control|card|modal)|none)|shadow-none)$/
export const UTILITY = /(?<![\w-])(?:rounded|shadow)(?:-[a-z0-9/.%]+)*(?:-\[[^\]]*\])?(?![\w-])/g

const alle = (d, out = []) => {
  for (const e of readdirSync(d)) {
    if (['node_modules', 'dist', 'build', 'release'].includes(e)) continue
    const p = join(d, e)
    const s = statSync(p)
    if (s.isDirectory()) alle(p, out)
    else if (/\.(tsx?|css)$/.test(e)) out.push(p)
  }
  return out
}

/** Kommentare weg — ein Beleg, der eine Klasse NENNT, ist kein Verstoss. */
export const ohneKommentare = (q) =>
  q.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/[^\n]*/gm, ' ')

/**
 * Der Inhalt aller Klassen-Attribute einer Datei, aneinandergehaengt.
 *
 * Absichtlich grob: eine `className={…}`-Klammer kann Code enthalten, und der
 * darf hier mitgelesen werden — eine Klasse steht darin genauso als Zeichen.
 * Was NICHT mitgelesen wird, ist alles ausserhalb.
 */
export function klassenListen(quelle) {
  const raus = []
  const ATTR = /\bclass(?:Name)?\s*=\s*/g
  let i = 0
  for (;;) {
    ATTR.lastIndex = i
    const m = ATTR.exec(quelle)
    if (!m) break
    const start = m.index + m[0].length
    const c = quelle[start]
    if (c === '"' || c === "'") {
      const e = quelle.indexOf(c, start + 1)
      if (e < 0) break
      raus.push(quelle.slice(start + 1, e))
      i = e
    } else if (c === '{') {
      let tiefe = 0
      let e = start
      for (; e < quelle.length; e += 1) {
        if (quelle[e] === '{') tiefe += 1
        else if (quelle[e] === '}') {
          tiefe -= 1
          if (tiefe === 0) break
        }
      }
      raus.push(quelle.slice(start + 1, e))
      i = e
    } else {
      i = start
    }
  }
  return raus
}

/** Werte einer CSS-Eigenschaft. */
export const werte = (quelle, eigenschaft) =>
  [...quelle.matchAll(new RegExp(`${eigenschaft}\\s*:\\s*([^;}]+)`, 'g'))].map((m) => m[1].trim())

/**
 * Ist dieser `box-shadow` ein Ring (erlaubt) oder ein Schlagschatten?
 *
 * Ring heisst: kein Versatz, keine Unschaerfe — `0 0 0 <n> <farbe>`. Sobald
 * eine der ersten drei Laengen ungleich null ist, behauptet der Wert Tiefe.
 */
export function istRing(wert) {
  if (wert === 'none') return true
  const teile = wert.trim().split(/\s+/)
  if (teile.length < 4) return false
  const [x, y, weich] = teile
  return [x, y, weich].every((v) => v === '0' || v === '0px')
}

const funde = []
let klassenGeprueft = 0
let cssGeprueft = 0

for (const f of alle(join(WURZEL, 'src'))) {
  const kurz = relative(WURZEL, f)
  const quelle = ohneKommentare(readFileSync(f, 'utf8'))
  if (f.endsWith('.css')) {
    cssGeprueft += 1
    for (const w of werte(quelle, 'border-radius')) {
      if (w !== '0' && w !== '0px') funde.push(`${kurz}  border-radius: ${w}`)
    }
    for (const w of werte(quelle, 'box-shadow')) {
      if (!istRing(w)) funde.push(`${kurz}  box-shadow: ${w}`)
    }
  } else {
    for (const liste of klassenListen(quelle)) {
      klassenGeprueft += 1
      for (const t of liste.match(UTILITY) ?? []) {
        if (!BEHALTEN.test(t)) funde.push(`${kurz}  ${t}`)
      }
    }
  }
}

// ─── Gegenproben ───────────────────────────────────────────────────────────

// 0. Es wurde ueberhaupt gelesen. Ein leerer Pfad waere still gruen — die
//    schlimmste Sorte gruen, weil sie nach Arbeit aussieht.
assert.ok(klassenGeprueft > 2000, `nur ${klassenGeprueft} Klassenlisten gelesen — der Scan ist kaputt`)
assert.ok(cssGeprueft >= 1, `keine CSS-Datei gelesen`)

// 1. Das Muster faengt wirklich, wonach es sucht.
const trifft = (s) => (s.match(UTILITY) ?? []).filter((t) => !BEHALTEN.test(t)).length
assert.equal(trifft('p-2 rounded border'), 1, 'bare rounded faellt nicht auf')
assert.equal(trifft('rounded-full'), 1)
assert.equal(trifft('shadow-2xl'), 1)
assert.equal(trifft('rounded-[3px]'), 1, 'ein Wert in eckigen Klammern faellt nicht auf')
assert.equal(trifft('rounded-cp-control rounded-none shadow-none'), 0, 'die Ausnahmen greifen nicht')
assert.equal(trifft('ring-2 ring-sky-400'), 0, 'der Fokusring wird beschuldigt')
assert.equal(trifft('surrounded rounder'), 0, 'das Muster liest aus laengeren Woertern heraus')

// 2. Der Ring-Test unterscheidet Meldung von Tiefe.
assert.ok(istRing('0 0 0 2px var(--cp-signal)'), 'ein Ring wird abgelehnt')
assert.ok(istRing('none'))
assert.ok(!istRing('0 2px 6px rgba(0,0,0,0.4)'), 'ein Schlagschatten kommt durch')
assert.ok(!istRing('0 0 16px #ef444488'), 'eine Unschaerfe kommt durch')
// `0 0 0 2px` ohne Farbe ist ebenfalls ein Ring — die Farbe faellt dann auf
// `currentColor` zurueck. Was ihn zum Schatten macht, ist Versatz oder
// Unschaerfe, nicht die fehlende Farbe.
assert.ok(istRing('0 0 0 2px'), 'ein Ring ohne Farbangabe wird abgelehnt')
assert.ok(!istRing('0 0 6px var(--cp-signal)'), 'eine Unschaerfe ohne Versatz kommt durch')
assert.ok(!istRing('inset 0 0 0 2px red'), 'ein Wert mit Schluesselwort ist kein geprueftes Muster')

// 3. Klassenlisten werden gefunden, und NUR sie.
{
  assert.deepEqual(klassenListen('<a className="x y" />'), ['x y'])
  assert.deepEqual(klassenListen('<a class=\'x\' />'), ['x'])
  assert.deepEqual(klassenListen('<a className={`x ${b} y`} />'), ['`x ${b} y`'])
  assert.deepEqual(klassenListen('light.shadow.mapSize = 2048'), [], 'ausserhalb wird gelesen')
}

// 4. Kommentare zaehlen nicht mit — sonst duerfte dieser Kopf die Klassen
//    nicht beim Namen nennen, und ein Waechter, den man nicht erklaeren darf,
//    wird abgeschaltet.
assert.equal(trifft(ohneKommentare('/* rounded-full */ p-2')), 0)
assert.equal(trifft(ohneKommentare('  // shadow-lg\n  p-2')), 0)

if (funde.length) {
  console.error(`\n${funde.length} rohe Rundung(en)/Schatten in der Oberflaeche:`)
  for (const f of funde.slice(0, 40)) console.error(`  ${f}`)
  if (funde.length > 40) console.error(`  … ${funde.length - 40} weitere`)
  console.error(
    '\nADR-007 Abschnitt 3: „Keine Rundungen, keine Schatten." Struktur entsteht ' +
      'durch Linie und Weissraum. Fuer Flaechen, die einen Namen brauchen, gibt es ' +
      'rounded-cp-control/-card/-modal — ihr Wert ist null.',
  )
  process.exit(1)
}

console.log(
  `form:check ok — keine rohe Rundung, kein Schlagschatten ` +
    `(${klassenGeprueft} Klassenlisten, ${cssGeprueft} Stilblatt-Datei(en) geprueft).`,
)
console.log(
  'NICHT gemessen: Rundungen, die zur Laufzeit entstehen (Bibliotheks-Stile, ' +
    '`style={{ borderRadius }}` aus einer Variablen) und alles ausserhalb von ' +
    'Klassenlisten — ein Schatten in einer 3D-Szene ist Inhalt, keine Flaeche.',
)
