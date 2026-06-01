import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { exportDevicePatchSheet } from '../../../lib/exportDevicePdf'
import { Printer } from 'lucide-react'
import { useTranslation } from '../../../lib/i18n'
import { SortableSection } from '../SortableSection'
import { Icon } from '../../shared/Icon'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — "Druck / Dokumentation"-SortableSection. Zwei PDF-Buttons:
 * A4- und A3-Patch-Sheet fuer das aktuelle Geraet. Liest equipment +
 * cables reactive aus dem Store damit die PDF immer den aktuellen
 * Verkabelungs-Stand spiegelt.
 */
export const PrintSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const allEquipment = useProjectStore((state) => state.project.equipment)
  const allCables = useProjectStore((state) => state.project.cables)

  return (
    <SortableSection
      id="print"
      title={t('printSection.title', 'Druck / Dokumentation')}
      subtitle={t('printSection.subtitle', 'Patch-Sheet A4/A3')}
    >
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() =>
            void exportDevicePatchSheet(equipment, allEquipment, allCables, {
              format: 'a4',
            })
          }
          className="w-full rounded bg-sky-700 px-2 py-1 text-cp-xs text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          title={t(
            'printSection.a4Title',
            'Erzeugt eine einseitige A4-Patch-Liste mit allen Ports + verbundenen Kabeln — zum Aufkleben am Gerät.',
          )}
        >
          <Icon icon={Printer} size="xs" className="mr-1 inline-block align-text-bottom" />
          {t('printSection.a4Btn', 'Patch-Sheet (A4 PDF) drucken')}
        </button>
        <button
          type="button"
          onClick={() =>
            void exportDevicePatchSheet(equipment, allEquipment, allCables, {
              format: 'a3',
            })
          }
          className="w-full rounded bg-sky-800 px-2 py-1 text-cp-xs text-white hover:bg-sky-700"
          title={t('printSection.a3Title', 'A3-Variante für Geräte mit vielen Ports.')}
        >
          <Icon icon={Printer} size="xs" className="mr-1 inline-block align-text-bottom" />
          {t('printSection.a3Btn', 'Patch-Sheet (A3 PDF) drucken')}
        </button>
      </div>
    </SortableSection>
  )
}
