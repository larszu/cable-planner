import { useCanvasProjectStore as useProjectStore } from '../../../store/projectStoreContext'
import { useTranslation } from '../../../lib/i18n'
import {
  PATCH_PANEL_CATEGORY,
  categoryIsPatchPanel,
  isPatchPanelDevice,
} from '../../../lib/patchPanel'
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
  // ISSUE #664 — die Kategorie „Patchfelder" sagt es bereits; dann ist das
  // Haekchen gesetzt UND gesperrt, statt eine zweite, widersprechbare
  // Wahrheit anzubieten.
  const ausKategorie = categoryIsPatchPanel(equipment.category)

  return (
    <SortableSection id="flags" title={t('flags.title', 'Display & flags')} subtitle={t('flags.subtitle', 'compact · colour · packed')}>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-[12px] text-cp-text-secondary">
          <input
            type="checkbox"
            checked={!!equipment.collapsed}
            onChange={(event) =>
              updateEquipment(equipment.id, { collapsed: event.target.checked || undefined })
            }
          />
          {t('eq.field.compact', 'Compact display')}{' '}
          <span className="text-cp-text-faint">({t('eq.field.compactHint', 'icon + name only, ports as dots')})</span>
        </label>

        <ColorField
          layout="inline"
          label={t('eq.field.color', 'Device colour')}
          value={equipment.nodeColor ?? '#475569'}
          onChange={(nodeColor) => updateEquipment(equipment.id, { nodeColor })}
          onReset={equipment.nodeColor ? () => updateEquipment(equipment.id, { nodeColor: undefined }) : undefined}
          title={t('flags.colorTitle', 'Device node colour')}
        />

        {/* #419 — "Ports spiegeln" gehoert zur Inputs-&-Outputs-Sektion
            (siehe PortsSection); nicht mehr hier. */}
        <label
          className="flex items-center gap-2 text-[11px] text-cp-text-secondary"
          title={t('flags.packedTitle', 'Marks the device as packed. Shown as ✓ on the canvas and as a column in the device BOM.')}
        >
          <input
            type="checkbox"
            checked={!!equipment.packed}
            onChange={(event) => updateEquipment(equipment.id, { packed: event.target.checked || undefined })}
          />
          {t('flags.packed', 'Packed / pack status')}
        </label>
        {/* #285 — Wandler-Flag. Wenn aktiv, "ueberspringt" die
            Patchliste dieses Geraet und zeigt direkt das naechste
            echte Ziel ("Kamera -> [Konverter] -> ATEM"). Nur fuer
            eindeutige 1-In/1-Out-Wandler relevant; bei mehrdeutigen
            Geraeten wird trotzdem ohne Pass-Through angezeigt. */}
        <label
          className="flex items-center gap-2 text-[11px] text-cp-text-secondary"
          title={t('flags.converterTitle', 'Converter marker: the patch list skips this device and shows the next real target directly. Useful for SDI-HDMI converters, format converters, embedders/de-embedders.')}
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
          {t('flags.converter', 'Converter (patch list follows pass-through cable)')}
        </label>
        {/* #664 — Patchblenden-Marker. Setzt den positionsweisen Durchgang
            (Buchse n hinten auf Buchse n vorn), dem Patchliste, Signalweg
            und Namens-Ableitung folgen. */}
        <label
          className="flex items-center gap-2 text-[11px] text-cp-text-secondary"
          title={
            ausKategorie
              ? t(
                  'flags.patchPanelByCategory',
                  `Die Kategorie „${PATCH_PANEL_CATEGORY}" weist dieses Gerät bereits als Patchfeld aus.`,
                )
              : t(
                  'flags.patchPanelTitle',
                  'Patch panel: rear socket n lands on front socket n. The signal path and the patch list follow that through-path instead of stopping at the panel. Requires an equal number of inputs and outputs.',
                )
          }
        >
          <input
            type="checkbox"
            checked={isPatchPanelDevice(equipment)}
            disabled={ausKategorie}
            onChange={(event) =>
              updateEquipment(equipment.id, {
                isPatchPanel: event.target.checked || undefined,
              })
            }
          />
          {t('flags.patchPanel', 'Patch panel (through-path follows the position)')}
        </label>
        <label
          className="flex items-center gap-2 text-[11px] text-cp-text-secondary"
          title={t('flags.daTitle', 'Distribution amplifier: one input is actively split to several outputs of the same source (1→N).')}
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
          {t('flags.da', 'Distribution amp (1→N)')}
        </label>
        {/* #359/#360/#366 — Signal-Flow-Rollen (Timecode / Tally / Embedding). */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 border-t border-cp-border-muted pt-2">
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
              <option value="source">{t('roles.source', 'Source')}</option>
              <option value="sink">{t('roles.sink', 'Sink')}</option>
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
              <option value="source">{t('roles.source', 'Source')}</option>
              <option value="sink">{t('roles.sink', 'Sink')}</option>
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
              <option value="deembedder">{t('roles.deembedder', 'De-embedder')}</option>
            </select>
          </label>
        </div>
      </div>
    </SortableSection>
  )
}
