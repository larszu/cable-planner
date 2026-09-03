/**
 * Kommentare aus Quelltext entfernen, Strings unangetastet lassen.
 *
 * WARUM ES DAS GIBT. Die Quelltext-Guards in diesem Verzeichnis pruefen, was
 * eine Stelle TUT. Ein guter Kommentar an derselben Stelle nennt aber gerade,
 * was sie NICHT mehr tut — „hier stand `setDraft(merged)`" ist die
 * Archaeologie, die den Rueckbau verhindert. Ein Guard, der den Quelltext roh
 * durchsucht, faellt darauf herein und meldet den Fehler, den der Kommentar
 * beschreibt. Gemessen: alle drei Lese-Guards schlugen beim ersten Lauf
 * genau daran fehl.
 *
 * Die Alternative waere gewesen, die Kommentare zu entschaerfen. Das haette
 * den Guard gruen gemacht und die Begruendung geloescht — die falsche von
 * beiden Reparaturen.
 *
 * GRENZE. Ein Regex-Literal, das mit `/` beginnt, kann wie ein
 * Kommentar-Anfang aussehen (`/\/\//`). Dieser Schneider unterscheidet das
 * nicht; fuer Funktionsrumpf-Guards reicht es, und wo es nicht reicht, faellt
 * es auf — nicht still, sondern als abgeschnittener Rumpf.
 */
export const stripComments = (src: string): string => {
  let out = ''
  let i = 0
  let quote: string | null = null
  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') {
        out += next ?? ''
        i += 2
        continue
      }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
      i += 1
      continue
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1
      i += 2
      // Der Zeilenumbruch bleibt erhalten, damit Zeilennummern nicht wandern.
      out += ' '
      continue
    }
    out += c
    i += 1
  }
  return out
}
