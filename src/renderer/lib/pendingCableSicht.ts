// ─── WAS EIN GERAET VON DER ANGEFANGENEN LINIE WISSEN MUSS ──────────────────
//
// NUTZER-MELDUNG: „wenn man reingezoomt ist, dass er beim Linien zeichnen sich
// etwas aufgehaengt hat. also nicht abgestuerzt sondern nur aufgehaengt."
//
// GEMESSEN (48 Geraete, 117 Kabel, Entwicklungsbau, 1600x1000): jeder Klick
// beim Zeichnen — der erste auf die Buchse und JEDER Knick danach — hielt den
// Hauptthread 60 bis 400 ms an, weil der gesamte ReactFlow-Baum neu rendert:
// `NodeRenderer` 95 ms, 768 Port-Griffe, 117 Kanten. Bei vier, fuenf Knicken
// hintereinander ist das genau das, was jemand als „haengt" meldet.
//
// DIE URSACHE IST DIE FORM DES ABONNEMENTS, NICHT DIE MENGE DER ARBEIT.
// `uiStore.pendingCable` ist ein Objekt, und `addPendingWaypoint` ersetzt es
// bei jedem Knick (`{ ...state.pendingCable, waypoints: [...] }`). Wer das
// ganze Objekt abonniert, rendert bei jedem Knick neu — auch wenn ihn die
// Knicke nichts angehen. Das traf `EquipmentNode` (jedes Geraet) und
// `CanvasArea` (und damit die `nodes`-Liste, die ReactFlow jedes Mal fuer neu
// haelt).
//
// Ein Geraet braucht von der angefangenen Linie genau eine Auskunft: liegt
// IHRE Startbuchse bei mir, und welche. Das ist ein String und aendert sich
// beim Knicken nicht. Die Knicke selbst zeichnet `PendingCableOverlay` — die
// eine Komponente, die sie wirklich braucht.

/** Die angefangene Linie, so wie sie im `uiStore` liegt. */
export interface GezeichneteLinie {
  nodeId: string
  handleId: string
  handleType: 'source' | 'target'
  waypoints: { x: number; y: number }[]
  abgelehnt?: 'inputToInput' | 'outputToOutput'
}

/**
 * Die Startbuchse der angefangenen Linie, sofern sie an DIESEM Geraet sitzt —
 * als Schluessel `handleId|handleType`, sonst `null`.
 *
 * Der Rueckgabewert ist absichtlich ein String und kein Objekt: zustand
 * vergleicht das Ergebnis des Selektors mit `Object.is`, ein frisches Objekt
 * waere also bei jeder Store-Aenderung „neu".
 */
export const startBuchseAm = (
  linie: GezeichneteLinie | null | undefined,
  geraetId: string,
): string | null =>
  linie && linie.nodeId === geraetId ? `${linie.handleId}|${linie.handleType}` : null

/** Ist diese Buchse die Startbuchse der angefangenen Linie? */
export const istStartBuchse = (
  startBuchse: string | null,
  handleId: string,
  handleType: 'source' | 'target',
): boolean => startBuchse === `${handleId}|${handleType}`
