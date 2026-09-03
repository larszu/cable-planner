// ───────────────────────────────────────────────────────────────────────────
// Feld-Namen eines TS-Interface zur LAUFZEIT aus der Quelle lesen.
//
// WARUM NICHT AUF TYP-EBENE. Der naheliegende Weg waere
// `const _x: Record<keyof T, true> = { ... }` — ein tsc-Fehler, sobald jemand
// ein Feld hinzufuegt. Der greift hier aber nicht: `tests/` liegt bewusst
// ausserhalb aller Emit-tsconfigs (siehe vitest.config.ts: kein Test-File in
// dist/), `npx tsc -p tsconfig.app.json` sieht die Testdateien also nie, und
// vitest streift Typen ueber esbuild ohne sie zu pruefen. Nachgemessen an
// einem eingebauten Zusatzfeld: beide Wege blieben gruen.
//
// Ein Contract-Guard, der eine nie ausgefuehrte Pruefung enthaelt, ist
// schlimmer als keiner — er behauptet Sicherheit, die es nicht gibt. Also
// wird der Interface-Rumpf aus dem Quelltext gelesen. Das laeuft unter
// `npm test` und damit in CI.
//
// GRENZEN, ausdruecklich: bewusst simpel gehalten — ein Interface ohne
// Vererbung (`extends`) und ohne verschachtelte Objekt-Literale im Rumpf.
// Genau so sind die Austauschformat-Interfaces geschnitten. Trifft das
// nicht mehr zu, faellt `interfaceKeys` mit einer klaren Meldung, statt
// still eine falsche Menge zu liefern.
// ───────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Feld-Namen des Interface `name` aus der Datei `relPath` (repo-relativ). */
export const interfaceKeys = (relPath: string, name: string): string[] => {
  const src = readFileSync(resolve(__dirname, '..', '..', relPath), 'utf8')
  const head = new RegExp(`\\binterface\\s+${name}\\b([^{]*)\\{`)
  const m = head.exec(src)
  if (!m) throw new Error(`Interface ${name} nicht in ${relPath} gefunden`)
  if (m[1].includes('extends')) {
    throw new Error(`${name} benutzt extends — interfaceKeys kann das nicht aufloesen`)
  }

  // Rumpf bis zur passenden schliessenden Klammer.
  const start = m.index + m[0].length
  let depth = 1
  let i = start
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') depth--
  }
  if (depth !== 0) throw new Error(`Rumpf von ${name} in ${relPath} nicht geschlossen`)
  const body = src.slice(start, i - 1)

  if (/\{/.test(body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) {
    throw new Error(`${name} hat verschachtelte Objekt-Literale — interfaceKeys ist dafuer zu simpel`)
  }

  return [
    ...body
      // Kommentare raus, sonst zaehlen Doku-Zeilen als Felder.
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .matchAll(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/gm),
  ]
    .map((k) => k[1])
    .sort()
}
