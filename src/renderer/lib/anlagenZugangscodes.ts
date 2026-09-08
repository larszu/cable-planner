/**
 * Die Zugangscodes der Intercom-Anlage aus dem Roh-Dokument des Herstellers
 * herauslesen (E-3).
 *
 * WOZU. `cable#656` hat das Roh-Dokument (`GreenGoConfig.basePreset`) aus
 * allem herausgenommen, was den Rechner verlaesst: seine Zugangsdaten heissen
 * `ConfigPassword`, `AdminPassword`, `TechPincode` und `Security.Pincode`,
 * keiner dieser Namen steht in `SECRET_KEYS`, und deshalb gingen sie vorher in
 * die Viewer-Datei und an jedes Handy im WLAN.
 *
 * Der Eigentuemer hat am 2026-09-08 entschieden, dass der Techniker vor Ort
 * trotzdem an den Code kommen soll — hinter einem eigenen Token. Diese Datei
 * liefert dafuer die Werte, und zwar NUR diese: sie liest gezielt vier Pfade
 * statt das Dokument nach „irgendwas mit Passwort" abzusuchen.
 *
 * WARUM GEZIELT UND NICHT SUCHEND. Eine Suche ueber alle Felder faende beim
 * naechsten Firmware-Stand mehr, als jemand entschieden hat herzugeben — und
 * das ist die falsche Richtung, um sich zu irren. Ein Feld, das hier fehlt,
 * fehlt sichtbar (der Techniker fragt nach); eines, das versehentlich
 * mitgeht, faellt niemandem auf.
 *
 * WAS HIER NICHT PASSIERT: nichts wird gespeichert, geloggt oder verschickt.
 * Die Werte gehen von hier ueber EINEN IPC-Aufruf in den Hauptprozess und
 * leben dort nur im Speicher, solange der Zugriff eingeschaltet ist.
 */

/** Ein Code, wie ihn die Mobile-Ansicht anzeigt. */
export interface AnlagenZugangscode {
  label: string
  value: string
}

/**
 * Die vier Pfade, die als Zugangsmittel gelten — Pfad, Beschriftung.
 *
 * Als Tabelle und nicht als vier `if`: wer einen fuenften Pfad aufnimmt,
 * schreibt eine Zeile und keine Verzweigung, und die Beschriftung steht
 * daneben statt in der Oberflaeche.
 */
export const ZUGANGSCODE_PFADE: { pfad: string[]; label: string }[] = [
  { pfad: ['Security', 'Pincode'], label: 'Anlagen-Pincode' },
  { pfad: ['TechPincode'], label: 'Technik-Pincode' },
  { pfad: ['AdminPassword'], label: 'Admin-Passwort' },
  { pfad: ['ConfigPassword'], label: 'Konfigurations-Passwort' },
]

const lies = (quelle: unknown, pfad: string[]): string | null => {
  let aktuell: unknown = quelle
  for (const teil of pfad) {
    if (!aktuell || typeof aktuell !== 'object') return null
    aktuell = (aktuell as Record<string, unknown>)[teil]
  }
  if (typeof aktuell === 'string' && aktuell.trim() !== '') return aktuell
  // Zahlen kommen vor: ein Pincode ist im Herstellerdokument gern `4711` ohne
  // Anfuehrungszeichen. Ihn deshalb zu verschweigen waere die schlechteste
  // Art, genau zu sein.
  if (typeof aktuell === 'number' && Number.isFinite(aktuell)) return String(aktuell)
  return null
}

/**
 * Die vorhandenen Zugangscodes, in der Reihenfolge der Tabelle. Leere Felder
 * fallen weg — ein leerer Pincode ist kein Geheimnis, und ihn als „—" zu
 * zeigen liesse den Techniker glauben, er habe den richtigen Wert vor sich.
 */
export const anlagenZugangscodes = (basePreset: unknown): AnlagenZugangscode[] => {
  if (!basePreset || typeof basePreset !== 'object') return []
  const out: AnlagenZugangscode[] = []
  for (const { pfad, label } of ZUGANGSCODE_PFADE) {
    const wert = lies(basePreset, pfad)
    if (wert !== null) out.push({ label, value: wert })
  }
  return out
}
