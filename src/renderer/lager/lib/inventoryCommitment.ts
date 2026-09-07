// ───────────────────────────────────────────────────────────────────────────
// Was gerade auf einem anderen Job ist (Bedarf 80, P2).
//
// WAS DER BEDARF SAGT:
//
//   > A number meaning 'stock' is read as a number meaning 'available'.
//   > Index shows '5 pcs' while detail shows '0 available'; index says
//   > 'Partial custody' (on site) while detail says 'Partially checked out'
//   > (gone on a booking). THE PM PROMISES GEAR THEY DO NOT HAVE.
//
// Belegt mit sechs unabhaengigen Fehlern von vier Meldern ueber fuenfzehn
// Monate (shelf.nu#1761, #1817, #2724 u. a.).
//
// Und die Entwurfsregel dazu, woertlich: „every quantity carries its
// availability qualifier in the same glyph run ('5 pcs · 0 available'), and
// conflicts are labelled ON THE OBJECT THAT HAS THEM, never announced as a
// disabled button."
//
// ─── WARUM DAS HIER ENTSTEHEN KANN ─────────────────────────────────────────
//
// Seit `cable#707` gibt es das Ausgabe-Register: welcher Container ist raus,
// an wen, fuer welche Show, und WAS TATSAECHLICH DRIN WAR (eingefroren, nicht
// aus der Kit-Vorlage). Damit ist „wie viele Stueck dieses Artikels sind
// gerade draussen" eine ableitbare Zahl.
//
// `resolveCoverage` wusste davon nichts. Sein `available` war der LAGERBESTAND
// abzueglich defekter Einheiten — und zaehlte damit Geraete mit, die
// physisch auf einer anderen Show stehen. Genau der Satz aus dem Befund: die
// Produktionsleitung sagt Technik zu, die sie nicht hat.
//
// ─── ZWEI FALLSTRICKE, DIE HIER BEWUSST BEHANDELT SIND ─────────────────────
//
// 1. VERSCHACHTELTE CONTAINER NICHT DOPPELT ZAEHLEN. Eine Ausgabe fuehrt ein
//    Case IM Case als eigene Zeile UND seinen Inhalt einzeln (Bedarf 15).
//    Wer die `node`-Zeilen mitzaehlt, zaehlt denselben Inhalt zweimal.
//
// 2. EINE EINHEIT GEHOERT ZU EINEM ARTIKEL. Die Ausgabe-Zeile einer
//    serialisierten Einheit traegt ihre eigene Id, nicht die des Artikels —
//    das ist Absicht („children keep their own ERP identities"). Fuer die
//    Bestandsrechnung muss sie ueber `units` aufgeloest werden, sonst
//    reduziert eine ausgegebene Funkstrecke den Bestand ihres Modells nicht.
//
// REIN: keine Uhr, kein Store, kein IO.
// ───────────────────────────────────────────────────────────────────────────

import type { CheckoutRecord } from '../types/checkout'
import type { InventoryUnit } from '../types/inventory'

export interface Commitment {
  /** Stueckzahl dieses Artikels auf offenen Ausgaben. */
  quantity: number
  /**
   * Woher die Bindung kommt — je offener Vorgang eine Zeile.
   *
   * Der Bedarf verlangt, dass ein Konflikt AN DEM OBJEKT steht, das ihn hat,
   * „never announced as a disabled button". Eine blosse Zahl sagt „zwei sind
   * weg"; erst der Vorgang sagt, WOHIN — und nur damit kann jemand
   * entscheiden, ob er sie zurueckholt oder umplant.
   */
  on: Array<{ recordId: string; nodeLabel: string; projectName?: string; quantity: number }>
}

/**
 * Wie viele Stueck je Artikel gerade auf einer offenen Ausgabe stehen.
 *
 * `units` wird gebraucht, um die Zeile einer serialisierten Einheit ihrem
 * Artikel zuzuordnen. Fehlt die Einheit im heutigen Bestand (geloescht,
 * seither umgebucht), zaehlt sie nichts — sie ist dann auch im Bestand nicht
 * mehr drin, den sie mindern wuerde.
 */
export const committedByItem = (
  records: CheckoutRecord[],
  units: InventoryUnit[] = [],
): Map<string, Commitment> => {
  const itemOfUnit = new Map(units.map((u) => [u.id, u.itemId]))
  const out = new Map<string, Commitment>()

  for (const r of records) {
    if (r.in) continue // zurueck = nicht mehr gebunden
    for (const line of r.contents) {
      // Fallstrick 1: der Inhalt des verschachtelten Cases steht schon
      // einzeln in derselben Liste.
      if (line.kind === 'node') continue
      const itemId = line.kind === 'unit' ? itemOfUnit.get(line.refId) : line.refId
      if (!itemId) continue
      const menge = Number.isFinite(line.quantity) && line.quantity > 0 ? line.quantity : 0
      if (menge === 0) continue
      const vorhanden = out.get(itemId)
      const eintrag = {
        recordId: r.id,
        nodeLabel: r.nodeLabel,
        ...(r.out.projectName ? { projectName: r.out.projectName } : {}),
        quantity: menge,
      }
      if (vorhanden) {
        vorhanden.quantity += menge
        const gleicherVorgang = vorhanden.on.find((o) => o.recordId === r.id)
        if (gleicherVorgang) gleicherVorgang.quantity += menge
        else vorhanden.on.push(eintrag)
      } else {
        out.set(itemId, { quantity: menge, on: [eintrag] })
      }
    }
  }
  return out
}

/**
 * Die Zusatz-Angabe fuer eine Zeile, in kanonischem Deutsch.
 *
 * Der Bedarf will die Qualifizierung „in the same glyph run" — nicht in einer
 * Fussnote, nicht in einem Tooltip. Deshalb ist das ein Textstueck und keine
 * eigene Spalte: es steht da, wo die Zahl steht.
 */
export const commitmentNote = (c: Commitment | undefined): string => {
  if (!c || c.quantity === 0) return ''
  const wohin = c.on
    .map((o) => `${o.quantity}× ${o.projectName ?? o.nodeLabel}`)
    .join(', ')
  return `${c.quantity} auf offener Ausgabe (${wohin})`
}
