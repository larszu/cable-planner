/**
 * Faktor fuer das Schriftfeld unten rechts im PDF. Das Feld ist fuer ein
 * A3-Querblatt bemessen und waechst mit der Blattflaeche mit — sonst schrumpft
 * es auf grossen Plaenen zur Briefmarke. Nie kleiner als 1, nie breiter als
 * knapp die Haelfte des Blatts.
 *
 * `unitsPerPt` rechnet die Blatteinheit um: 1 fuer pt, 4/3 fuer CSS-px.
 */
export const titleBlockScale = (
  pageWidth: number,
  pageHeight: number,
  baseWidth: number,
  unitsPerPt = 1,
): number => {
  const a3W = 1191 * unitsPerPt
  const a3H = 842 * unitsPerPt
  const byArea = Math.sqrt((pageWidth * pageHeight) / (a3W * a3H))
  const byWidth = (pageWidth * 0.45) / baseWidth
  return Math.max(1, Math.min(byArea, byWidth))
}
