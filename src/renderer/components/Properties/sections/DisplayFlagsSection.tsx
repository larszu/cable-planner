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
    <SortableSection id="flags" title={t('flags.title', 'Darstellung & Flags')} subtitle={t('flags.subtitle', 'kompakt · Farbe · gepackt')}>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[12px] text-cp-text-secondary">
          <input
            type="checkbox"
            checked={!!equipment.collapsed}
            onChange={(event) =>
              updateEquipment(equipment.id, { collapsed: event.target.checked || undefined })
            }
          />
          {t('eq.field.compact', 'Kompakte Darstellung')}{' '}
          <span className="text-cp-text-faint">({t('eq.field.compactHint', 'nur Icon + Name, Ports als Punkte')})</span>
        </label>

        <ColorField
          layout="inline"
          label={t('eq.field.color', 'Gerätefarbe')}
          value={equipment.nodeColor ?? '#475569'}
          onChange={(nodeColor) => updateEquipment(equipment.id, { nodeColor })}
          onReset={equipment.nodeColor ? () => updateEquipment(equipment.id, { nodeColor: undefined }) : undefined}
          title={t('flags.colorTitle', 'Farbe des Geräte-Knotens')}
        />

        {/* #419 — "Ports spiegeln" gehoert zur Inputs-&-Outputs-Sektion
            (siehe PortsSection); nicht mehr hier. */}
        <label
          className="flex items-center gap-2 text-[11px] text-cp-text-secondary"
          title={t('flags.packedTitle', 'Markiert das Gerät als gepackt. Erscheint als ✓ auf dem Canvas und als eigene Spalte in der Geräte-BOM.')}
        >
          <input
            type="checkbox"
            checked={!!equipment.packed}
            onChange={(event) => updateEquipment(equipment.id, { packed: event.target.checked || undefined })}
          />
          {t('flags.packed', 'Gepackt / Pack-Status')}
        </label>
        {/* #285 — Wandler-Flag. Wenn aktiv, "ueberspringt" die
            Patchliste dieses Geraet und zeigt direkt das naechste
            echte Ziel ("Kamera -> [Konverter] -> ATEM"). Nur fuer
            eindeutige 1-In/1-Out-Wandler relevant; bei mehrdeutigen
            Geraeten wird trotzdem ohne Pass-Through angezeigt. */}
        <label
          className="flex items-center gap-2 text-[11px] text-cp-text-secondary"
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
          {t('flags.converter', 'Wandler (Patchliste folgt Durchgangskabel)')}
        </label>
        <label
          className="flex items-center gap-2 text-[11px] text-cp-text-secondary"
          title={t('flags.daTitle', 'Verteilverstärker: 1 Eingang wird aktiv auf mehrere Ausgänge derselben Quelle verteilt (1→N).')}
        >
          <input
            type="checkbox"
            checked={!!equipment.isDistributionAmp}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                isDistributionAmp: event.target.checked || undefined,
              })
            }
          />
          {t('flags.da', 'Verteilverstärker (1→N)')}
        </label>
        {/* #359/#360/#366 — Signal-Flow-Rollen (Timecode / Tally / Embedding). */}
        <div className="grid grid-cols-3 gap-1 border-t border-cp-border-muted pt-2">
          <label className="block text-[10px]">
            <span className="mb-0.5 block text-cp-text-muted">{t('roles.tc', 'Timecode')}</span>
            <select
              value={equipment.tcRole ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, {
                  tcRole: (event.target.value || undefined) as 'source' | 'sink' | undefined,
                })
              }
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1"
            >
              <option value="">—</option>
              <option value="source">{t('roles.source', 'Quelle')}</option>
              <option value="sink">{t('roles.sink', 'Senke')}</option>
            </select>
          </label>
          <label className="block text-[10px]">
            <span className="mb-0.5 block text-cp-text-muted">{t('roles.tally', 'Tally')}</span>
            <select
              value={equipment.tallyRole ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, {
                  tallyRole: (event.target.value || undefined) as 'source' | 'sink' | undefined,
                })
              }
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1"
            >
              <option value="">—</option>
              <option value="source">{t('roles.source', 'Quelle')}</option>
              <option value="sink">{t('roles.sink', 'Senke')}</option>
            </select>
          </label>
          <label className="block text-[10px]">
            <span className="mb-0.5 block text-cp-text-muted">{t('roles.embed', 'Embedding')}</span>
            <select
              value={equipment.embedderRole ?? ''}
              onChange={(event) =>
                updateEquipment(equipment.id, {
                  embedderRole: (event.target.value || undefined) as
                    | 'embedder'
                    | 'deembedder'
                    | undefined,
                })
              }
              className="w-full rounded border border-cp-border bg-cp-surface-3 p-1"
            >
              <option value="">—</option>
              <option value="embedder">{t('roles.embedder', 'Embedder')}</option>
              <option value="deembedder">{t('roles.deembedder', 'De-Embedder')}</option>
            </select>
          </label>
        </div>
      </div>
    </SortableSection>
  )
}
