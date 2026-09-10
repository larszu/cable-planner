// ───────────────────────────────────────────────────────────────────────────
// Wann eine Port-Änderung zurückgemeldet wird (#833).
//
// Steht hier und nicht in `RackInternalCanvas.tsx`, weil eine Datei mit
// Komponenten UND Hilfsfunktionen den Fast-Refresh des Renderers ausschaltet
// (`react-refresh/only-export-components`) — und weil eine reine Funktion
// prüfbar ist, ohne dass ein Canvas dafür laufen muss.
// ───────────────────────────────────────────────────────────────────────────
import type { EquipmentItem } from '../types/equipment'

/**
 * Sind zwei Port-Saetze inhaltlich gleich? (#833)
 *
 * Verglichen wird, was der Builder-Draft traegt und was im Rack-Preset landet:
 * Id, Name, Steckertyp, Signal-Standard. Ein Vergleich ueber `JSON.stringify`
 * des ganzen Ports haette auch fluechtige Felder erfasst und den Rueckruf bei
 * jedem Renderdurchgang gefeuert.
 */
export const portsGleich = (
  vorherEin: EquipmentItem['inputs'],
  jetztEin: EquipmentItem['inputs'],
  vorherAus: EquipmentItem['outputs'],
  jetztAus: EquipmentItem['outputs'],
): boolean => {
  const kern = (ports: EquipmentItem['inputs']) =>
    ports.map((p) => `${p.id}|${p.name}|${p.connectorType}|${p.standard ?? ''}`).join('\u0000')
  return kern(vorherEin) === kern(jetztEin) && kern(vorherAus) === kern(jetztAus)
}
