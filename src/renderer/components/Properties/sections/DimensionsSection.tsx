import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { SortableSection } from '../SortableSection'
import { PanelHint } from '../../shared/PanelHint'

/**
 * #306 — DimensionsSection aus EquipmentProperties ausgelagert.
 * Eigenständige Sortable-Sektion fuer die physischen Aussenmaße
 * (Breite × Höhe × Tiefe in mm). Verwendet vom 3D-Rack-Renderer.
 */
export const DimensionsSection = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((s) => s.updateEquipment)
  const wMm = equipment.widthMm
  const hMm = equipment.heightMm
  const dMm = equipment.depthMm
  const summary =
    typeof wMm === 'number' || typeof hMm === 'number' || typeof dMm === 'number'
      ? `${wMm ?? '?'} × ${hMm ?? '?'} × ${dMm ?? '?'} mm`
      : '–'
  const parseMm = (raw: string): number | undefined => {
    if (!raw) return undefined
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return undefined
    return Math.round(n)
  }
  return (
    <SortableSection id="dimensions" title={t('dims.title', 'Dimensions')} subtitle={summary}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-cp-xs">
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">{t('dims.width', 'Width (mm)')}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={wMm ?? ''}
            placeholder={t('dims.widthPlaceholder', 'e.g. 482')}
            onChange={(e) =>
              updateEquipment(equipment.id, { widthMm: parseMm(e.target.value) })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">{t('dims.height', 'Height (mm)')}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={hMm ?? ''}
            placeholder={t('dims.heightPlaceholder', 'e.g. 44')}
            onChange={(e) =>
              updateEquipment(equipment.id, { heightMm: parseMm(e.target.value) })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">{t('dims.depth', 'Depth (mm)')}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={dMm ?? ''}
            placeholder={t('dims.depthPlaceholder', 'e.g. 400')}
            onChange={(e) =>
              updateEquipment(equipment.id, { depthMm: parseMm(e.target.value) })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
      </div>
      <PanelHint
        className="mt-2 text-cp-xs text-cp-text-muted"
        text={t(
          'dims.hint',
          'Physical outer dimensions. 19" rack device: 1 U = 44.45 mm, standard width 482 mm, typical depth 400-600 mm. Used by the 3D rack renderer + logistics tools.',
        )}
      />
    </SortableSection>
  )
}
