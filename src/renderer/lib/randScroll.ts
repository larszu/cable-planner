/**
 * #1227 — Wie weit eine Liste beim Ziehen am Rand weiterlaufen soll.
 *
 * Die Bibliothek ist laenger als ihr Fenster; wer ein Geraet in eine
 * Unterkategorie weiter unten ziehen will, kommt ohne Mitlaufen nicht hin.
 * Der Browser scrollt beim nativen Ziehen nur in einem schmalen Saum und je
 * nach Plattform gar nicht. Hier: innerhalb von `zone` Pixeln zum oberen oder
 * unteren Rand ein Schritt, der zum Rand hin bis `max` waechst.
 *
 * Negativ = nach oben, positiv = nach unten, 0 = stehen bleiben.
 */
export const randScrollSchritt = (
  y: number,
  oben: number,
  unten: number,
  zone = 48,
  max = 18,
): number => {
  const z = Math.min(zone, (unten - oben) / 3)
  if (z <= 0) return 0
  if (y < oben + z) return -Math.ceil(max * Math.min(1, (oben + z - y) / z))
  if (y > unten - z) return Math.ceil(max * Math.min(1, (y - (unten - z)) / z))
  return 0
}
