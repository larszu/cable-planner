// ADR-001, Inkrement 2 — die persistierten Anker.
//
// Eine `SourceIdentity` ist eine ROLLE, kein Geraet: „Kamera 1" bleibt
// „Kamera 1", auch wenn die Havarie-Kamera einspringt. Deshalb haengt der
// Anker nicht an `EquipmentItem.id` — ein Haupt-/Backup-Paar ist eine Rolle
// mit zwei Geraeten, und eine Tally-Adresse gehoert der Rolle, nicht dem
// Blech. Genau daran war die Alternative „Identitaet an die Geraete-Id
// binden" in ADR-001 gescheitert.
//
// EIGENTUMSREGEL (ADR-001): Hier steht ausschliesslich, was KEINE Runtime
// besitzt. Die ATEM-Source-Id, der Videohub-Slot und das MV-Fenster gehoeren
// dem jeweiligen Geraet und werden ueber den Kabelgraph aufgeloest
// (`lib/labelDerivation.ts`), niemals gespeichert — sonst entstuende genau die
// zweite Wahrheit, die wir dem Markt vorwerfen.
//
// Das Schema bleibt bewusst klein: Inkrement 1 hat genau EIN Feld als
// unbeantwortbar nachgewiesen (die UMD-Adresse), und nur dafuer gibt es
// `labelTargets.ts` ein belegtes Zielsystem. ISO-Praefix und Comms-Kanal
// kommen mit ihrem Ziel, nicht davor.

export interface SourceIdentity {
  id: string
  /** Redaktioneller Name — was in der Regie gesagt wird („Kamera 1"). */
  name: string
  /** Redaktionelle Nummer, wo die Produktion mit Nummern arbeitet. */
  number?: number
  /** TSL-UMD-Adresse (v3.1), auf die ein Display hoert. 0–126. */
  umdAddress?: number
}
