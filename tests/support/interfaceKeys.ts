// ───────────────────────────────────────────────────────────────────────────
// Feld-Namen eines TS-Interface zur LAUFZEIT aus dem Quelltext lesen.
//
// Zeichengleich zu multicam-planner src/__tests__/support/interfaceKeys.ts
// (bis auf die Semikolon-Konvention), damit die Contract-Guards beider Repos
// dieselbe Pruefung machen und „wortgleich“ nachpruefbar bleibt. Der Aufrufer
// laedt die Quelle per `?raw`-Import — die Funktion selbst fasst kein
// Dateisystem an und braucht darum weder @types/node noch eine gemeinsame
// Pfad-Konvention.
//
// WARUM ZUR LAUFZEIT. Der naheliegende Weg waere
// `const _x: Record<keyof T, true> = { ... }` — ein tsc-Fehler, sobald jemand
// ein Feld hinzufuegt. HIER greift das nicht: tests/ liegt bewusst ausserhalb
// aller Emit-tsconfigs (siehe vitest.config.ts: kein Test-File in dist/),
// `npx tsc -p tsconfig.app.json` sieht die Testdateien also nie, und vitest
// streift Typen ueber esbuild ohne sie zu pruefen. Nachgemessen an einem
// eingebauten Zusatzfeld: beide Wege blieben gruen.
//
// Im multicam-planner WUERDE der Typ-Weg greifen (tsconfig `include: ["src"]`,
// Tests unter src/__tests__). Eine Pruefung, die nur auf EINER Seite eines
// zweiseitigen Vertrags laeuft, taugt aber nicht — deshalb dort wie hier
// derselbe Laufzeit-Weg.
//
// GRENZEN, ausdruecklich: bewusst simpel gehalten — ein Interface ohne
// Vererbung (`extends`) und ohne verschachtelte Objekt-Literale im Rumpf.
// Genau so sind die Austauschformat-Interfaces geschnitten. Trifft das nicht
// mehr zu, faellt `interfaceKeys` mit einer klaren Meldung, statt still eine
// falsche Menge zu liefern.
// ───────────────────────────────────────────────────────────────────────────

/** Feld-Namen des Interface `name` im Quelltext `src` (via `?raw` geladen). */
export const interfaceKeys = (src: string, name: string): string[] => {
  const head = new RegExp(`\\binterface\\s+${name}\\b([^{]*)\\{`)
  const m = head.exec(src)
  if (!m) throw new Error(`Interface ${name} nicht im Quelltext gefunden`)
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
  if (depth !== 0) throw new Error(`Rumpf von ${name} nicht geschlossen`)
  const body = src.slice(start, i - 1)

  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  if (/\{/.test(stripped)) {
    throw new Error(`${name} hat verschachtelte Objekt-Literale — interfaceKeys ist dafuer zu simpel`)
  }

  return [...stripped.matchAll(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/gm)]
    .map((k) => k[1])
    .sort()
}
