/**
 * Ersten Satz eines Erklaertextes abtrennen — die Rechnung hinter `PanelHint`.
 *
 * WARUM IN `lib/` UND NICHT IN DER KOMPONENTE: eine Datei, die neben ihrer
 * Komponente noch eine Funktion exportiert, bricht Fast-Refresh
 * (`react-refresh/only-export-components`). Und der Test kommt so an die
 * Rechnung, ohne etwas zu rendern.
 */

/**
 * Ersten Satz abtrennen.
 *
 * Gesucht wird ein Satzende, dem ein Leerzeichen und ein Grossbuchstabe
 * folgen — sonst zerschnitte „z. B." oder „192.168.1.0/24" den Text mitten
 * im Wort. Findet sich keines, gibt es keinen Rest und der Hinweis bleibt,
 * wie er ist.
 */
export function teile(text: string): { kopf: string; rest: string } {
  // Kein Schnitt hinter einer Ziffer: „Intermodulation 3. Ordnung" ist eine
  // Ordnungszahl und kein Satzende — der Hinweis endete sonst mitten im
  // Begriff („Geprueft: Traegerabstand + Intermodulation 3."). Dasselbe gilt
  // fuer „1. Januar" und „19. Zoll".
  const m = /(?<![0-9])([.!?])\s+(?=[A-ZÄÖÜ])/.exec(text)
  if (!m || m.index < 20) return { kopf: text, rest: '' }
  const schnitt = m.index + 1
  return { kopf: text.slice(0, schnitt).trim(), rest: text.slice(schnitt).trim() }
}
