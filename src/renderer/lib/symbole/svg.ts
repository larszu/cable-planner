// SVG aus fremder Hand: Datei-Import und KI-Antwort.
//
// Gezeichnet wird jedes Symbol ueber <img src="data:image/svg+xml,…">. Dort
// fuehrt der Browser weder Skripte noch Event-Handler aus und laedt keine
// externen Ressourcen — das ist die eigentliche Sicherung. Das Bereinigen
// hier haelt die Projektdatei sauber, die das SVG weitertraegt (Viewer,
// Export an Dritte), und macht aus einer Modellantwort mit Begleittext ein
// verwendbares Zeichen.

/** Groesste zulaessige SVG-Quelle. Ein Planzeichen ist wenige KB gross;
 *  alles darueber ist ein eingebettetes Foto und gehoert als Bild importiert. */
export const SVG_MAX_ZEICHEN = 200_000

export const svgAusText = (text: string): string | null => {
  const start = text.search(/<svg[\s>]/i)
  const ende = text.toLowerCase().lastIndexOf('</svg>')
  if (start < 0 || ende < start) return null
  return text.slice(start, ende + 6)
}

export const svgBereinigen = (roh: string): string | null => {
  const quelle = svgAusText(roh)
  if (!quelle || quelle.length > SVG_MAX_ZEICHEN) return null
  let s = quelle
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("|')\s*(?!#|data:image\/)[^"']*\1/gi, '')
  // Ohne viewBox skaliert ein SVG nicht mit dem Knoten, sondern wird
  // abgeschnitten. Aus width/height ableiten, wo es geht.
  if (!/viewBox\s*=/i.test(s)) {
    const w = /<svg[^>]*\swidth\s*=\s*["']?([\d.]+)/i.exec(s)?.[1]
    const h = /<svg[^>]*\sheight\s*=\s*["']?([\d.]+)/i.exec(s)?.[1]
    if (w && h) s = s.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`)
  }
  if (!/xmlns\s*=/i.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  return s
}

export const svgDataUrl = (svg: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
