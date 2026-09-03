// ---------------------------------------------------------------------------
// Feld-Namen eines TS-Interface zur LAUFZEIT lesen — auch wenn Felder einen
// verschachtelten Objekt-Typ haben.
//
// WARUM NICHT `interfaceKeys`. Der Nachbar in `./interfaceKeys.ts` kann das
// ausdruecklich nicht: sein Docstring nennt die Grenze („ohne verschachtelte
// Objekt-Literale im Rumpf") und er faellt mit klarer Meldung, statt still
// eine falsche Menge zu liefern. Nachgemessen, nicht vermutet — er faellt an
// ALLEN drei Domaenen-Typen (`Cable`, `EquipmentItem`, `ProjectMetadata`).
// Und er bleibt so: er ist zeichengleich zur Kopie im multicam-planner, damit
// derselbe Wire-Contract auf beiden Seiten geprueft wird. Wer ihn hier
// erweitert, bricht dieses „wortgleich nachpruefbar".
//
// DER FEHLER, DEN DIESE DATEI IM ERSTEN ANLAUF SELBST HATTE. Der naive Weg
// (Zeile mitschreiben, solange die Klammertiefe 0 ist) verschluckt genau die
// Felder, um die es geht: bei `libraryRef?: {` steigt die Tiefe noch in der
// Schluessel-Zeile, und beim Zeilenende ist sie nicht mehr 0 — die Zeile wird
// verworfen. Gemessen an `EquipmentItem`: 94 statt 97 Felder, still. Deshalb
// wird hier zuerst JEDE Klammergruppe zu einem Platzhalter eingeschmolzen und
// erst danach zeilenweise gesucht.
//
// GRENZEN, ausdruecklich: ein Interface ohne `extends`. Doppelte Feldnamen
// sind ein Fehler und keine Menge — die Funktion faellt dann, statt sie
// stillschweigend zu einem zu vereinigen.
// ---------------------------------------------------------------------------

/** Alle Klammergruppen durch `_` ersetzen, damit jedes Feld auf einer Zeile steht. */
const collapseGroups = (body: string): string => {
  let out = ''
  let depth = 0
  for (const ch of body) {
    if (ch === '{' || ch === '(' || ch === '[') {
      if (depth === 0) out += '_'
      depth += 1
      continue
    }
    if (ch === '}' || ch === ')' || ch === ']') {
      depth -= 1
      continue
    }
    if (depth === 0) out += ch
  }
  return out
}

/**
 * Feld-Namen der obersten Ebene des Interface `name` im Quelltext `src`
 * (via `?raw`-Import geladen), sortiert.
 */
export const topLevelKeys = (src: string, name: string): string[] => {
  const head = new RegExp(`\\binterface\\s+${name}\\b([^{]*)\\{`)
  const m = head.exec(src)
  if (!m) throw new Error(`Interface ${name} nicht im Quelltext gefunden`)
  if (m[1].includes('extends')) {
    throw new Error(`${name} benutzt extends — topLevelKeys kann das nicht aufloesen`)
  }

  const start = m.index + m[0].length
  let depth = 1
  let i = start
  for (; i < src.length && depth > 0; i += 1) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') depth -= 1
  }
  if (depth !== 0) throw new Error(`Rumpf von ${name} nicht geschlossen`)

  const body = src
    .slice(start, i - 1)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')

  const keys = collapseGroups(body)
    .split('\n')
    .map((line) => /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1])

  const dupes = keys.filter((k, n) => keys.indexOf(k) !== n)
  if (dupes.length > 0) {
    throw new Error(`doppelte Felder in ${name}: ${[...new Set(dupes)].join(', ')}`)
  }
  return keys.sort()
}
