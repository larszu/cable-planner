import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { exportDevicePatchSheet } from '../../../lib/exportDevicePdf'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Printer } from 'lucide-react'
import { GeraeteDatenblattDialog } from '../GeraeteDatenblattDialog'
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
  const locations = useProjectStore((state) => state.project.locations)
  const floors = useProjectStore((state) => state.project.floors)
  const [datenblatt, setDatenblatt] = useState(false)

  return (
    <SortableSection
      id="print"
      title={t('printSection.title', 'Print / documentation')}
      subtitle={t('printSection.subtitle', 'Datasheet, patch sheet A4/A3')}
    >
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setDatenblatt(true)}
          className="w-full border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text hover:bg-cp-surface-3"
          title={t(
            'printSection.datasheetTitle',
            'One A4 page for this device with photo and the properties you tick — print or save as PDF.',
          )}
        >
          <Icon icon={FileText} size="xs" className="mr-1 inline-block align-text-bottom" />
          {t('printSection.datasheetBtn', 'Device datasheet (A4)…')}
        </button>
        {/* Portal: die Leiste steckt in einem `fieldset`, das im gesperrten
            Projekt alles darin sperrt — ein Datenblatt drucken ist keine
            Aenderung. */}
        {datenblatt &&
          createPortal(
            <GeraeteDatenblattDialog equipmentIds={[equipment.id]} onClose={() => setDatenblatt(false)} />,
            document.body,
          )}
        <button
          type="button"
          onClick={() =>
            void exportDevicePatchSheet(equipment, allEquipment, allCables, {
              format: 'a4',
              locations,
              floors,
            })
          }
          className="w-full bg-sky-700 px-2 py-1 text-cp-xs text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          title={t(
            'printSection.a4Title',
            'Generates a single-page A4 patch list with all ports + connected cables — to stick on the device.',
          )}
        >
          <Icon icon={Printer} size="xs" className="mr-1 inline-block align-text-bottom" />
          {t('printSection.a4Btn', 'Print patch sheet (A4 PDF)')}
        </button>
        <button
          type="button"
          onClick={() =>
            void exportDevicePatchSheet(equipment, allEquipment, allCables, {
              format: 'a3',
              locations,
              floors,
            })
          }
          className="w-full bg-sky-800 px-2 py-1 text-cp-xs text-white hover:bg-sky-700"
          title={t('printSection.a3Title', 'A3 variant for devices with many ports.')}
        >
          <Icon icon={Printer} size="xs" className="mr-1 inline-block align-text-bottom" />
          {t('printSection.a3Btn', 'Print patch sheet (A3 PDF)')}
        </button>
      </div>
    </SortableSection>
  )
}
