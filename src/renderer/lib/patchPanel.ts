// ───────────────────────────────────────────────────────────────────────────
// ISSUE #664 — „Patchbays als Geraetekategorie erstellen und mehrere Ebenen
// der Verkabelung anzeigbar machen fuer Festinstallationen."
//
// Diese Datei ist die EINE Stelle, die beantwortet: ist dieses Geraet eine
// Patchblende, und welcher Anschluss auf der anderen Seite gehoert zu diesem?
//
// Sie hat genau einen Grund zu existieren: die Antwort wurde vorher an drei
// Stellen VERSCHIEDEN gegeben. `detectDeviceKind` hielt eine 24er-Blende fuer
// eine Kreuzschiene (die Struktur-Heuristik „>= 8 BNC rein, >= 8 BNC raus"
// trifft auf jede Blende zu), die Rueckwaertssuche in `labelDerivation`
// verlangte GENAU EINEN passenden Eingang und fand vierundzwanzig, und die
// Patchliste folgte nur Wandlern mit genau einem Ausgangskabel. Ergebnis: die
// Kette brach an jeder Blende, und auf dem Blatt stand die Blende als Quelle
// statt der Kamera.
//
// ─── WARUM DER DURCHGANG KEIN RATEN IST ────────────────────────────────────
//
// Eine Patchblende IST die positionsweise Durchleitung: Buchse n hinten liegt
// auf Buchse n vorn. Das ist ihre Bauart, kein Betriebszustand. Deshalb darf
// sie abgeleitet werden — anders als beim Router (`routedInput`), wo der
// Kreuzpunkt geschaltet wird und ohne gesetzten Plan nichts ableitbar ist.
//
// ─── WO ES AUFHOERT ────────────────────────────────────────────────────────
//
// Sind vorn und hinten verschieden viele Buchsen, ist die Zuordnung nicht mehr
// die Position — dann gibt es null und die Kette haelt an der Blende an wie
// bisher. Und ein gestecktes Rangierkabel, das die Normalisierung aufhebt,
// weiss der Plan nicht: er beschreibt die geplante Verkabelung, nicht das, was
// jemand vor Ort umgesteckt hat.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem, Port } from '../types/equipment'

/**
 * Die Geraetekategorie aus der Ueberschrift des Issues.
 *
 * Sie steht in `DEFAULT_CATEGORIES` (libraryPersist.ts) und ist der zweite
 * Weg, ein Geraet als Blende auszuweisen — der erste ist das Flag
 * `isPatchPanel`, das der Rack-Builder-Dialog setzt.
 */
export const PATCH_PANEL_CATEGORY = 'Patchfelder'

/** Nur die Kategorie, ohne das Flag — die UI braucht beide Haelften getrennt. */
export const categoryIsPatchPanel = (category: string | undefined): boolean =>
  (category ?? '').trim().toLowerCase() === PATCH_PANEL_CATEGORY.toLowerCase()

/**
 * Ist dieses Geraet eine Patchblende?
 *
 * ZWEI WEGE, EINE ANTWORT: das Flag `isPatchPanel` (vom Rack-Builder gesetzt,
 * in den Properties umschaltbar) ODER die Kategorie „Patchfelder". Wer ein
 * Geraet in diese Kategorie legt, hat damit gesagt, was es ist; ein zweites
 * Haekchen zu verlangen waere eine Falle. Die Properties-Sektion zeigt das
 * Haekchen deshalb als gesetzt UND gesperrt, wenn die Kategorie es schon sagt.
 */
export const isPatchPanelDevice = (
  device: Pick<EquipmentItem, 'category'> & { isPatchPanel?: boolean },
): boolean => device.isPatchPanel === true || categoryIsPatchPanel(device.category)

/**
 * Der Anschluss auf der anderen Seite — Position n gegen Position n.
 *
 * Beidseitig: von einem Ausgang kommt der gleichnummerige Eingang zurueck und
 * umgekehrt. Die Rueckwaertssuche (`labelDerivation`) braucht die eine
 * Richtung, die Vorwaertskette (`signalChain`) die andere; zwei Funktionen
 * waeren zwei Wahrheiten.
 *
 * null heisst „nicht ableitbar", nie „keine Verbindung": ungleiche
 * Buchsenzahlen, kein Blende-Geraet, oder der Port gehoert gar nicht dazu.
 */
export const patchPanelCounterpart = (
  device: EquipmentItem,
  port: Pick<Port, 'id'>,
): Port | null => {
  if (!isPatchPanelDevice(device)) return null
  if (device.inputs.length !== device.outputs.length) return null
  if (device.inputs.length === 0) return null

  const outIdx = device.outputs.findIndex((p) => p.id === port.id)
  if (outIdx >= 0) return device.inputs[outIdx] ?? null

  const inIdx = device.inputs.findIndex((p) => p.id === port.id)
  if (inIdx >= 0) return device.outputs[inIdx] ?? null

  return null
}
