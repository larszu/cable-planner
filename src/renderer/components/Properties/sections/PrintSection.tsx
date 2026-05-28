import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { exportDevicePatchSheet } from '../../../lib/exportDevicePdf'
import { SortableSection } from '../SortableSection'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — "Druck / Dokumentation"-SortableSection. Zwei PDF-Buttons:
 * A4- und A3-Patch-Sheet fuer das aktuelle Geraet. Liest equipment +
 * cables reactive aus dem Store damit die PDF immer den aktuellen
 * Verkabelungs-Stand spiegelt.
 */
export const PrintSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const allEquipment = useProjectStore((state) => state.project.equipment)
  const allCables = useProjectStore((state) => state.project.cables)

  return (
    <SortableSection
      id="print"
      title="Druck / Dokumentation"
      subtitle="Patch-Sheet A4/A3"
    >
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() =>
            void exportDevicePatchSheet(equipment, allEquipment, allCables, {
              format: 'a4',
            })
          }
          className="w-full rounded bg-sky-700 px-2 py-1 text-xs text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          title="Erzeugt eine einseitige A4-Patch-Liste mit allen Ports + verbundenen Kabeln — zum Aufkleben am Gerät."
        >
          🖨 Patch-Sheet (A4 PDF) drucken
        </button>
        <button
          type="button"
          onClick={() =>
            void exportDevicePatchSheet(equipment, allEquipment, allCables, {
              format: 'a3',
            })
          }
          className="w-full rounded bg-sky-800 px-2 py-1 text-xs text-white hover:bg-sky-700"
          title="A3-Variante für Geräte mit vielen Ports."
        >
          🖨 Patch-Sheet (A3 PDF) drucken
        </button>
      </div>
    </SortableSection>
  )
}
