/**
 * #1206 — Unterkategorien als Pfad in `category` ("Audio/Lautsprecher").
 *
 * Ein Pfad statt eines zweiten Felds: Vorlagen, Projektdateien, Exporte und
 * die Geraetebibliothek tragen weiter genau eine Kategorie, und alles, was nur
 * die Oberkategorie kennt (Fachfelder, Symbole), findet sie ueber
 * `oberkategorie`.
 */
export const KATEGORIE_TRENNER = '/'

const teile = (cat: string): string[] =>
  cat.split(KATEGORIE_TRENNER).map((s) => s.trim()).filter(Boolean)

/** "Audio/Lautsprecher" → "Audio"; ohne Trenner die Kategorie selbst. */
export const oberkategorie = (cat: string): string => teile(cat)[0] ?? cat

/** Letztes Glied fuer die Anzeige: "Audio/Lautsprecher" → "Lautsprecher". */
export const kategorieBlatt = (cat: string): string => {
  const t = teile(cat)
  return t[t.length - 1] ?? cat
}

export const kategorieTiefe = (cat: string): number => Math.max(0, teile(cat).length - 1)

/** Alle Vorfahren, naechster zuerst: "A/B/C" → ["A/B", "A"]. */
export const kategorieVorfahren = (cat: string): string[] => {
  const t = teile(cat)
  const out: string[] = []
  for (let i = t.length - 1; i > 0; i--) out.push(t.slice(0, i).join(KATEGORIE_TRENNER))
  return out
}

export const unterkategorieVon = (eltern: string, name: string): string =>
  [...teile(eltern), ...teile(name)].join(KATEGORIE_TRENNER)

/** Liegt `cat` in `eltern` oder ist es selbst? */
export const liegtIn = (cat: string, eltern: string): boolean =>
  cat === eltern || cat.startsWith(eltern + KATEGORIE_TRENNER)

/**
 * Baumordnung fuer die Liste: jede Unterkategorie direkt unter ihrer
 * Oberkategorie, Geschwister in der Reihenfolge der Eingabe. Fehlt eine
 * Oberkategorie, wird sie ergaenzt — sonst haette die Unterkategorie keinen
 * Platz zum Einklappen.
 */
export const ordneKategorienBaum = (cats: readonly string[]): string[] => {
  const alle: string[] = []
  const gesehen = new Set<string>()
  for (const c of cats) {
    for (const v of [...kategorieVorfahren(c)].reverse()) {
      if (!gesehen.has(v)) { gesehen.add(v); alle.push(v) }
    }
    if (!gesehen.has(c)) { gesehen.add(c); alle.push(c) }
  }
  const kinder = new Map<string, string[]>()
  const wurzeln: string[] = []
  for (const c of alle) {
    const eltern = kategorieVorfahren(c)[0]
    if (eltern === undefined) wurzeln.push(c)
    else kinder.set(eltern, [...(kinder.get(eltern) ?? []), c])
  }
  const out: string[] = []
  const besuche = (c: string) => {
    out.push(c)
    for (const k of kinder.get(c) ?? []) besuche(k)
  }
  wurzeln.forEach(besuche)
  return out
}
