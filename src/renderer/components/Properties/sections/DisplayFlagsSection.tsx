import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation } from '../../../lib/i18n'
import { ColorField } from '../../shared/ColorField'
import { SortableSection } from '../SortableSection'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — "Darstellung & Flags"-SortableSection. Boolean-Flags fuer
 * Canvas-Erscheinungsbild (collapsed, portsFlipped, packed,
 * isConverter) + Geraetefarbe.
 *
 * isConverter (#285) ist hier weil's funktional ein Patchlisten-
 * Verhalten-Marker ist und zu den restlichen Geraete-Marker-Flags
 * passt.
 */
export const DisplayFlagsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)

  return (
    <SortableSection id="flags" title={t('flags.title', 'Darstellung & Flags')} subtitle={t('flags.subtitle', 'kompakt · Farbe · Ports spiegeln · gepackt')}>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[12px] text-slate-300">
          <input
            type="checkbox"
            checked={!!equipment.collapsed}
            onChange={(event) =>
              updateEquipment(equipment.id, { collapsed: event.target.checked || undefined })
            }
          />
          {t('eq.field.compact', 'Kompakte Darstellung')}{' '}
          <span className="text-slate-500">({t('eq.field.compactHint', 'nur Icon + Name, Ports als Punkte')})</span>
        </label>

        <ColorField
          layout="inline"
          label={t('eq.field.color', 'Gerätefarbe')}
          value={equipment.nodeColor ?? '#475569'}
          onChange={(nodeColor) => updateEquipment(equipment.id, { nodeColor })}
          onReset={equipment.nodeColor ? () => updateEquipment(equipment.id, { nodeColor: undefined }) : undefined}
          title={t('flags.colorTitle', 'Farbe des Geräte-Knotens')}
        />

        <label className="flex items-center gap-2 text-[11px] text-slate-300">
          <input
            type="checkbox"
            checked={!!equipment.portsFlipped}
            onChange={(event) => updateEquipment(equipment.id, { portsFlipped: event.target.checked || undefined })}
          />
          Ports spiegeln (Inputs rechts, Outputs links)
        </label>
        <label
          className="flex items-center gap-2 text-[11px] text-slate-300"
          title={t('flags.packedTitle', 'Markiert das Gerät als gepackt. Erscheint als ✓ auf dem Canvas und als eigene Spalte in der Geräte-BOM.')}
        >
          <input
            type="checkbox"
            checked={!!equipment.packed}
            onChange={(event) => updateEquipment(equipment.id, { packed: event.target.checked || undefined })}
          />
          Gepackt / Pack-Status
        </label>
        {/* #285 — Wandler-Flag. Wenn aktiv, "ueberspringt" die
            Patchliste dieses Geraet und zeigt direkt das naechste
            echte Ziel ("Kamera -> [Konverter] -> ATEM"). Nur fuer
            eindeutige 1-In/1-Out-Wandler relevant; bei mehrdeutigen
            Geraeten wird trotzdem ohne Pass-Through angezeigt. */}
        <label
          className="flex items-center gap-2 text-[11px] text-slate-300"
          title={t('flags.converterTitle', 'Wandler-Marker: in der Patchliste wird dieses Gerät übersprungen und das nächste echte Ziel direkt angezeigt. Sinnvoll für SDI-HDMI-Konverter, Format-Wandler, Embedder/De-Embedder etc.')}
        >
          <input
            type="checkbox"
            checked={!!equipment.isConverter}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                isConverter: event.target.checked || undefined,
              })
            }
          />
          Wandler (Patchliste folgt Durchgangskabel)
        </label>
      </div>
    </SortableSection>
  )
}
