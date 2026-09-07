// ───────────────────────────────────────────────────────────────────────────
// DER VERTRAG ZWISCHEN PLAN UND LAGER (ADR-006, Schritt 1 und 2).
//
// ADR-006 schneidet „Lager & Logistik" aus dem Cable-Planner heraus, weil der
// Bereich alle vier Bedingungen erfuellt: eigene Stammdaten, eigener Bediener,
// kein Kabelgraph noetig — und, die vierte, die hier eingeloest wird:
//
//   > die Verbindung zum Plan laesst sich auf wenige benannte Fragen
//   > reduzieren … *Deckt der Bestand den Bedarf? Was steht auf dem
//   > Ausgabeschein? Ist das Stueck fremdes Material?*
//
// DIESE DATEI IST DIESE LISTE, in Code. Sie ist die EINZIGE Tuer: alles
// ausserhalb von `lager/` und ausserhalb der unten genannten Domaenen-Module
// importiert hier — nie ein Lager-Internum direkt. `tests/lagerVertrag.test.ts`
// haelt das fest und nennt jeden Verstoss beim Namen.
//
// WARUM DIE TUER VOR DEM UMZUG KOMMT. ADR-006 verbietet den „grossen Wurf":
// erst das Paket, dann das Repo, mit gruenem CI dazwischen. Solange 26 Module
// quer durch den Planer greifbar sind, ist der Umzug ein Grossumbau mit
// unbekanntem Ende. Steht die Tuer, ist er eine Textersetzung an EINER Stelle
// — und was danach an dieser Tuer nicht vorbeikommt, ist der Beweis, dass es
// im Planer bleiben muss.
//
// WAS HIER ABSICHTLICH NICHT STEHT:
//
//   `lib/pickFile.ts` — ein generischer Datei-Dialog mit fuenf Aufrufern quer
//   durch den Planer (Videohub-Export, Bibliothek, Abgleich, Konfigurationen,
//   Bild-Import). Er ist im Lager-Import entstanden, ist aber keine
//   Lager-Frage. Waere er Teil des Vertrags, muesste sich der Planer nach dem
//   Umzug seinen Datei-Dialog aus einem fremden Repo holen.
//
//   `mergeDefined` — aus demselben Grund nach `lib/mergeDefined.ts` gezogen.
//   Sein eigener Kommentar sagte es bereits: „Die Regel ist nicht auf das
//   Lager beschraenkt."
//
//   `lib/handoverPackage.ts` — das Uebergabe-/Closeout-Paket der
//   Festinstallation. Klingt nach Ausgabeschein, ist aber die andere Domaene
//   aus ADR-006 (Issues #665–#667), mit anderer Norm und anderem Lebenszyklus.
//
//   `lib/actionItems.ts` — die Handlungsliste liest das Lager, gehoert ihm
//   aber nicht: sie zaehlt auch Plan-, Netz- und Geld-Befunde zusammen. Sie
//   ist Verbraucher dieses Vertrags, nicht sein Inhalt.
//
// WAS DER VERTRAG NICHT TUT: rechnen. Jede Zahl kommt aus genau einem Modul
// der Domaene; diese Datei reicht sie durch. Eine zweite Ableitung auf der
// Planer-Seite ist der Defekt, gegen den ADR-001 geschrieben ist und vor dem
// ADR-006 Punkt 4 ausdruecklich warnt („Nichts wird zweimal gerechnet").
// ───────────────────────────────────────────────────────────────────────────

import { useInventoryStore } from './store/inventoryStore'
import { useCheckoutStore } from './store/checkoutStore'
import type { InventoryItem, InventoryUnit, StorageNode } from './types/inventory'
import type { CheckoutRecord } from './types/checkout'

// ───────────────────────────────────────────────────────────────────────────
// DER BESTAND, WIE DER PLAN IHN SIEHT
//
// Vier Lesungen und ein Schreibweg — mehr fragt der Planer den Bestand nicht.
// Als benannte Haken statt als roher Store-Zugriff, damit nach dem Umzug die
// Zustand-Store-Form nicht Teil des Vertrags ist: `useInventoryStore((s) =>
// s.items)` an sieben Stellen hiesse, sieben Komponenten kennen die innere
// Gestalt des Lagers. Jeder Haken gibt dieselbe Referenz zurueck wie der
// Selektor vorher, das Neuzeichnen aendert sich also nicht.
// ───────────────────────────────────────────────────────────────────────────

/** Die Lager-Artikel (Modell mit Menge N) — projektuebergreifend. */
export const useBestand = (): InventoryItem[] => useInventoryStore((s) => s.items)

/** Die einzeln gefuehrten Einheiten (Seriennummer/Hausreferenz). */
export const useEinheiten = (): InventoryUnit[] => useInventoryStore((s) => s.units)

/** Der Lagerbaum: Plaetze, Cases, Transport-Cases. */
export const useLagerorte = (): StorageNode[] => useInventoryStore((s) => s.nodes)

/** Die Ausgabescheine, offene wie geschlossene. */
export const useAusgaben = (): CheckoutRecord[] => useCheckoutStore((s) => s.records)

/**
 * Der EINZIGE Schreibweg vom Plan ins Lager: eine Lager-Position bekommt die
 * Katalog-Identitaet bestaetigt, die der Abgleich nur vorgeschlagen hatte.
 *
 * Das ist kein Bestands-Schreiben — Menge, Ort und Zustand bleiben Sache des
 * Lagers. Es ist die Antwort auf `proposed-by-name`: ein Mensch hat gesagt,
 * dass die beiden dasselbe Geraet meinen, und diese Aussage gehoert an die
 * Lager-Position, sonst wird sie beim naechsten Abgleich wieder geraten.
 */
export const useTypBestaetigen = (): ((itemId: string, deviceTypeId: string) => void) => {
  const updateItem = useInventoryStore((s) => s.updateItem)
  return (itemId, deviceTypeId) => updateItem(itemId, { deviceTypeId })
}

// ───────────────────────────────────────────────────────────────────────────
// FRAGE 1 — „Deckt der Bestand den Bedarf?"
//
// Der Plan sagt, was er braucht; das Lager sagt, was es hat. Die Antwort ist
// nie zweiwertig: `matched-by-type` ist eine Tatsache, `proposed-by-name` ein
// Vorschlag, `unmatched` ein Fehlbestand. Wer den Vorschlag zur Deckung
// befoerdert, baut die Kommissionierliste, die in neun von zehn Faellen
// stimmt und deshalb nicht mehr gelesen, sondern geglaubt wird.
// ───────────────────────────────────────────────────────────────────────────

export { deriveDemand, resolveCoverage, normaliseName } from './lib/inventoryCoverage'
export type {
  CoverageLine,
  CoverageOutcome,
  CoverageResult,
  CoverageSource,
  DemandLine,
} from './lib/inventoryCoverage'

export { buildPlanBom, outcomeLabel, planBomCsv, pickListCsv } from './lib/planBom'
export type { PlanBom, PlanBomRow } from './lib/planBom'

/** Derselbe Abgleich gegen die ERP-Reservierung — in beide Richtungen. */
export { reconcileErp, erpReconcileTable } from './lib/erpReconcile'
export type { ErpBasis, ErpLine, ErpReport, ErpRow, ErpVerdict } from './lib/erpReconcile'

// ───────────────────────────────────────────────────────────────────────────
// FRAGE 2 — „Was steht auf dem Ausgabeschein?"
//
// Und die Kehrseite, die der Ausgabeschein allein nicht beantwortet: WELCHE
// Kiste steht im Plan-Platz. Eine Stagebox gegen die gleiche zu tauschen ist
// fuer den Plan unsichtbar und fuer die Adressvergabe entscheidend.
// ───────────────────────────────────────────────────────────────────────────

export { overdueCheckouts, openCheckouts } from './lib/containerCheckout'

export {
  assessAssetIdentity,
  assetIdentityTable,
  identityAnchors,
  ASSET_FINDING_LABEL,
  IDENTITY_ANCHOR_LABEL,
} from './lib/assetIdentity'
export type {
  AssetFinding,
  AssetFindingKind,
  AssetIdentityAssessment,
  AssetIdentityInput,
  AssetIdentityRow,
  IdentityAnchor,
} from './lib/assetIdentity'

/** Wie eine Einheit heisst — je nachdem, wer liest (Haus oder Fremdfirma). */
export { unitLabel } from './lib/unitIdentity'
export type { IdentityAudience } from './lib/unitIdentity'

// ───────────────────────────────────────────────────────────────────────────
// FRAGE 3 — „Ist das Stueck fremdes Material?"
//
// Sub-Hire traegt bis aufs Blatt: was nicht dem Haus gehoert, muss auf jeder
// Liste als solches erkennbar sein und hat ein Rueckgabedatum, das nicht der
// Abbautag ist.
// ───────────────────────────────────────────────────────────────────────────

export { ownershipNote, overdueSubhire, isForeign, subhireStatus, OWNERSHIP_LABEL } from './lib/ownership'
export type { OverdueLine, SubhireStatus } from './lib/ownership'

// ───────────────────────────────────────────────────────────────────────────
// DIE OBERFLAECHE
//
// Ein Einstieg, nicht mehr: der Lager-Dialog. Nach dem Umzug wird daraus ein
// Fenster der Suite; bis dahin haengt er wie bisher in `App.tsx`.
// ───────────────────────────────────────────────────────────────────────────

export { InventoryDialog } from './ui/InventoryDialog'

// ───────────────────────────────────────────────────────────────────────────
// DIE DATENTYPEN, die ueber die Tuer gehen. Bewusst nur die, die ein Aufrufer
// ausserhalb wirklich in der Hand haelt — nicht das ganze Modell.
// ───────────────────────────────────────────────────────────────────────────

export type { InventoryItem, InventoryUnit, StorageNode, InventoryOwnership } from './types/inventory'
export type { CheckoutRecord } from './types/checkout'
