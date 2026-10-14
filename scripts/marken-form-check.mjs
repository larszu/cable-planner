#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────────────────
// Die FORM der Oberflaeche — Rundungen und Schatten NUR ueber Tokens.
// Lauf: `npm run form:check`.
//
// ─── WARUM ES DAS GIBT (umgebaut 2026-10-13) ──────────────────────────────
//
// Bis 2026-10-13 hiess die Regel „keine Rundungen, keine Schatten" (ADR-007
// Abschnitt 3 in der alten Fassung). Der Design-Vertrag 2026-10 und das am
// selben Tag geaenderte ADR-007 (lz-planner-suite) heben das auf: die
// Oberflaeche hat weiche Rundungen (6/10/20/24/voll) und drei weiche
// Schatten — aber jede davon kommt aus EINEM Token. Der Waechter bleibt, nur
// seine Frage ist eine andere: nicht mehr „ist das null?", sondern „kommt das
// aus der Token-Schicht?".
//
// Warum das weiter einen Waechter braucht, steht in der Geschichte dieser
// Datei: am 2026-09-11 zaehlte er 1854 rohe `rounded`-Utilities in diesem
// Repo, die Tailwind mit 4 px aufloeste, neben drei Tokens, die kaum jemand
// benutzte. Ohne Pruefung waechst so wieder ein Feld aus 4, 6, 8 und 12 px —
// und acht Werkzeuge, die gleich aussehen sollen, laufen auseinander.
//
// ─── WAS ER PRUEFT ────────────────────────────────────────────────────────
//
//   TSX/TS   Klassenlisten: `rounded*`/`shadow*` nur als Token-Utility
//            (`rounded-cp-s|control|card|modal|full`, auch mit Seite wie
//            `rounded-t-cp-modal`; `shadow-cp-1|2|3`) oder als Verneinung.
//            Tailwind-Standard (`rounded-lg`, `shadow-xl`) und Werte in
//            eckigen Klammern fallen.
//   CSS      `border-radius`: 0, 50 % (Kreis) oder `var(--cp-r-*)` /
//            `var(--radius-cp-*)`. `box-shadow`: none, ein Ring
//            (`0 0 0 Npx`) oder `var(--cp-shadow-N)`, auch kombiniert.
//   TSX/TS   Stilobjekte (`borderRadius`, `boxShadow`) nach denselben Regeln;
//            ein Wert aus einer Variablen faellt, weil er nicht pruefbar ist.
//
// ─── UND WAS AUSDRUECKLICH ERLAUBT IST ────────────────────────────────────
//
//   ring-*                            der Fokusring ist Pflicht, nicht Dekor.
//   box-shadow: 0 0 0 Npx <farbe>     ein RING traegt eine Meldung (Tally,
//                                     abgelehnter Zug), er behauptet keine
//                                     Tiefe.
//   borderRadius: '50%'               ein KREIS bildet etwas Rundes ab
//                                     (Buchse, LED, Anfasser).
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
// Bibliothek oder ein CSS-Text in einer Zeichenkette (`'border-radius:…'`).
// Was er zusagt, ist der Quelltext dieses Repos.
// ───────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')

export const BEHALTEN =
  /^(?:rounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?-(?:cp-(?:s|control|card|modal|full)|none)|shadow-(?:none|cp-[123]))$/
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

/**
 * Werte einer CSS-Eigenschaft.
 *
 * `!important` faellt vorher weg. Sonst waere `border-radius: 0 !important`
 * ein anderer Wert als `border-radius: 0` — und der Lauf meldete eine
 * Rundung, wo ausdruecklich keine steht. Eine falsche Anschuldigung kostet
 * einen Waechter sein Ansehen schneller als ein Durchrutscher; gemessen im
 * `multicam-planner`, wo die FlexLayout-Regeln durchweg `!important`
 * tragen und drei von vier Meldungen Fehltreffer waren.
 */
export const werte = (quelle, eigenschaft) =>
  [...quelle.matchAll(new RegExp(`${eigenschaft}\\s*:\\s*([^;}]+)`, 'g'))].map((m) =>
    m[1].replace(/!important/g, '').trim(),
  )

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

/**
 * Die Ausdruecke hinter `eigenschaft:` in Stilobjekten — bis zum Komma oder
 * zur schliessenden Klammer auf derselben Tiefe; Zeichenketten werden dabei
 * uebersprungen, damit `rgba(0, 0, 0, .4)` den Ausdruck nicht zerteilt.
 */
export function stilAusdruecke(quelle, eigenschaft) {
  const raus = []
  for (const m of quelle.matchAll(new RegExp(`\\b${eigenschaft}\\s*:`, 'g'))) {
    const start = m.index + m[0].length
    let tiefe = 0
    let zeichen = null
    let i = start
    for (; i < quelle.length; i += 1) {
      const c = quelle[i]
      if (zeichen) {
        if (c === '\\') i += 1
        else if (c === zeichen) zeichen = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') zeichen = c
      else if ('([{'.includes(c)) tiefe += 1
      else if (')]}'.includes(c)) {
        if (tiefe === 0) break
        tiefe -= 1
      } else if (c === ',' && tiefe === 0) break
    }
    raus.push(quelle.slice(start, i).trim())
  }
  return raus
}

/** Ein Rundungswert aus der Token-Schicht: 0, Kreis oder `var(--cp-r-*)`. */
const RUNDUNG_TEIL = /^(?:0|0px|50%|var\(--(?:cp-r-(?:s|m|l|xl|full)|radius-cp-(?:s|control|card|modal|full))\)|inherit)$/
export const rundungsWertErlaubt = (w) =>
  w.trim().split(/\s+(?![^(]*\))/).every((t) => RUNDUNG_TEIL.test(t))

const ATOM = /^(?:0|undefined|'([^'\\]*)'|"([^"\\]*)"|`([^`$]*)`)$/
const atomErlaubt = (a) => {
  const m = ATOM.exec(a.trim())
  if (!m) return false
  const lit = m[1] ?? m[2] ?? m[3]
  return lit === undefined || rundungsWertErlaubt(lit)
}
/**
 * Ein `borderRadius`-Ausdruck: ein erlaubtes Atom oder `bedingung ? a : b`
 * aus zwei erlaubten Atomen. Alles andere (eine Variable, eine Rechnung) ist
 * nicht pruefbar und faellt.
 */
export function rundungErlaubt(ausdruck) {
  const q = ausdruck.indexOf('?')
  if (q < 0) return atomErlaubt(ausdruck)
  const zweige = ausdruck.slice(q + 1).split(':')
  return zweige.length === 2 && zweige.every(atomErlaubt)
}

/** Eine Schatten-Ebene: Ring oder Token. */
const ebeneErlaubt = (ebene) =>
  ebene === '' || /^var\(--cp-shadow-[123]\)$/.test(ebene) || istRing(ebene)

/** Ein CSS-`box-shadow`-Wert: jede Ebene ist Ring oder Token. */
export const schattenWertErlaubt = (w) =>
  w === 'none' ||
  w
    .split(/,(?![^(]*\))/)
    .map((e) => e.trim().replace(/^inset\s+/, ''))
    .every(ebeneErlaubt)

/**
 * Ein `boxShadow`-Ausdruck ist erlaubt, wenn er `undefined` ist oder jede
 * Zeichenkette darin nur aus Ringen und Schatten-Tokens besteht. Platzhalter
 * `${…}` zaehlen als `1` — ein berechneter Versatz oder eine berechnete
 * Unschaerfe fallen also.
 */
export function schattenErlaubt(ausdruck) {
  if (ausdruck === 'undefined') return true
  const literale = [...ausdruck.matchAll(/'([^'\\]*)'|"([^"\\]*)"|`([^`]*)`/g)].map((m) =>
    (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, '1'),
  )
  if (!literale.length) return false
  // Ohne Ziffer ist eine Zeichenkette kein Schatten, sondern ein Vergleich
  // (`highlight === 'pgm'`) oder ein Trenner (`.join(', ')`).
  return literale.filter((l) => /\d/.test(l)).every(schattenWertErlaubt)
}

const funde = []
let klassenGeprueft = 0
let cssGeprueft = 0
let stileGeprueft = 0

for (const f of alle(join(WURZEL, 'src'))) {
  const kurz = relative(WURZEL, f)
  const quelle = ohneKommentare(readFileSync(f, 'utf8'))
  if (f.endsWith('.css')) {
    cssGeprueft += 1
    for (const w of werte(quelle, 'border-radius')) {
      if (!rundungsWertErlaubt(w)) funde.push(`${kurz}  border-radius: ${w}`)
    }
    for (const w of werte(quelle, 'box-shadow')) {
      if (!schattenWertErlaubt(w)) funde.push(`${kurz}  box-shadow: ${w}`)
    }
  } else {
    for (const a of stilAusdruecke(quelle, 'borderRadius')) {
      stileGeprueft += 1
      if (!rundungErlaubt(a)) funde.push(`${kurz}  borderRadius: ${a}`)
    }
    for (const a of stilAusdruecke(quelle, 'boxShadow')) {
      stileGeprueft += 1
      if (!schattenErlaubt(a)) funde.push(`${kurz}  boxShadow: ${a.replace(/\s+/g, ' ')}`)
    }
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
assert.ok(stileGeprueft >= 10, `nur ${stileGeprueft} Stilobjekt-Werte gelesen — der Scan ist kaputt`)

// 1. Das Muster faengt wirklich, wonach es sucht.
const trifft = (s) => (s.match(UTILITY) ?? []).filter((t) => !BEHALTEN.test(t)).length
assert.equal(trifft('p-2 rounded border'), 1, 'bare rounded faellt nicht auf')
assert.equal(trifft('rounded-full'), 1)
assert.equal(trifft('shadow-2xl'), 1)
assert.equal(trifft('rounded-[3px]'), 1, 'ein Wert in eckigen Klammern faellt nicht auf')
assert.equal(trifft('rounded-cp-control rounded-none shadow-none'), 0, 'die Ausnahmen greifen nicht')
assert.equal(trifft('rounded-cp-full rounded-t-cp-modal shadow-cp-3 hover:shadow-cp-2'), 0, 'die Tokens greifen nicht')
assert.equal(trifft('shadow-cp-4 rounded-cp-xxl'), 2, 'ein erfundener Token kommt durch')
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

// `!important` darf den Wert nicht zu einem anderen machen.
assert.deepEqual(werte('a { border-radius: 0 !important; }', 'border-radius'), ['0'])
assert.deepEqual(werte('a { box-shadow: none !important; }', 'box-shadow'), ['none'])
assert.deepEqual(werte('a { border-radius: 8px; }', 'border-radius'), ['8px'])
assert.ok(rundungsWertErlaubt('var(--cp-r-m)') && !rundungsWertErlaubt('8px'), 'CSS-Rundung falsch bewertet')
assert.ok(schattenWertErlaubt('var(--cp-shadow-3)') && !schattenWertErlaubt('0 4px 16px black'), 'CSS-Schatten falsch bewertet')

// 3. Klassenlisten werden gefunden, und NUR sie.
{
  assert.deepEqual(klassenListen('<a className="x y" />'), ['x y'])
  assert.deepEqual(klassenListen('<a class=\'x\' />'), ['x'])
  assert.deepEqual(klassenListen('<a className={`x ${b} y`} />'), ['`x ${b} y`'])
  assert.deepEqual(klassenListen('light.shadow.mapSize = 2048'), [], 'ausserhalb wird gelesen')
}

// 3b. Stilobjekte (#1041).
{
  assert.deepEqual(stilAusdruecke('{ borderRadius: 6, padding: 2 }', 'borderRadius'), ['6'])
  assert.deepEqual(
    stilAusdruecke("{ boxShadow: a ? '0 2px 6px rgba(0,0,0,.4)' : undefined }", 'boxShadow'),
    ["a ? '0 2px 6px rgba(0,0,0,.4)' : undefined"],
    'ein Komma in rgba() zerteilt den Ausdruck',
  )
  assert.ok(!rundungErlaubt('6'), 'eine Rundung im Stilobjekt kommt durch')
  assert.ok(!rundungErlaubt("'5px 5px 0 0'"))
  assert.ok(!rundungErlaubt('r'), 'ein nicht pruefbarer Wert kommt durch')
  assert.ok(rundungErlaubt('0') && rundungErlaubt("'50%'"), 'Null oder Kreis wird abgelehnt')
  assert.ok(rundungErlaubt("'var(--cp-r-m)'"), 'ein Token wird abgelehnt')
  assert.ok(rundungErlaubt("a ? 'var(--cp-r-l) var(--cp-r-l) 0 0' : 0"), 'ein Token im Ternaer wird abgelehnt')
  assert.ok(!rundungErlaubt("'var(--cp-r-m) 4px'"), 'ein roher px-Wert neben einem Token kommt durch')
  assert.ok(schattenErlaubt("'var(--cp-shadow-1)'"), 'ein Schatten-Token wird abgelehnt')
  assert.ok(schattenErlaubt("'0 0 0 3px red, var(--cp-shadow-2)'"), 'Ring plus Token wird abgelehnt')
  assert.ok(!schattenErlaubt("'var(--cp-shadow-1), 0 2px 4px black'"), 'ein roher Schatten neben einem Token kommt durch')
  assert.ok(!schattenErlaubt("isLight ? '0 2px 6px rgba(0,0,0,0.12)' : '0 2px 6px rgba(0,0,0,0.4)'"))
  assert.ok(!schattenErlaubt('glow'), 'ein Schatten aus einer Variablen kommt durch')
  assert.ok(!schattenErlaubt("'0 0 0 2px red, 0 2px 4px black'"), 'eine zweite Ebene kommt durch')
  assert.ok(
    !schattenErlaubt('`0 0 ${n}px ${m}px rgba(1, 2, 3, ${a})`'),
    'eine berechnete Unschaerfe kommt durch',
  )
  assert.ok(schattenErlaubt('`0 0 0 ${n}px rgba(1, 2, 3, ${a})`'), 'ein berechneter Ring wird abgelehnt')
  assert.ok(schattenErlaubt('h ? `inset 0 0 0 2px ${h}` : undefined'), 'ein Innenring wird abgelehnt')
  assert.ok(schattenErlaubt('undefined'))
  assert.ok(
    schattenErlaubt("h === 'pgm' ? 'inset 0 0 0 2px red' : undefined"),
    'ein Vergleich wird als Schatten gelesen',
  )
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
    '\nDesign-Vertrag 2026-10 / ADR-007 (geaendert 2026-10-13): Rundungen und Schatten ' +
      'nur ueber Tokens — rounded-cp-s/-control/-card/-modal/-full, shadow-cp-1/2/3, ' +
      'var(--cp-r-*) und var(--cp-shadow-*).',
  )
  process.exit(1)
}

console.log(
  `form:check ok — Rundungen und Schatten nur ueber Tokens ` +
    `(${klassenGeprueft} Klassenlisten, ${stileGeprueft} Stilobjekt-Werte, ` +
    `${cssGeprueft} Stilblatt-Datei(en) geprueft).`,
)
console.log(
  'NICHT gemessen: Rundungen, die zur Laufzeit entstehen (Bibliotheks-Stile, ' +
    'CSS-Text in Zeichenketten) — ein Schatten in einer 3D-Szene ist Inhalt, keine Flaeche.',
)
