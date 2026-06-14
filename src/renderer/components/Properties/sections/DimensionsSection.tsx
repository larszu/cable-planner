import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'
import { SortableSection } from '../SortableSection'

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
    <SortableSection id="dimensions" title={t('dims.title', 'Dimensionen')} subtitle={summary}>
      <div className="grid grid-cols-3 gap-2 text-cp-xs">
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">{t('dims.width', 'Breite (mm)')}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={wMm ?? ''}
            placeholder={t('dims.widthPlaceholder', 'z. B. 482')}
            onChange={(e) =>
              updateEquipment(equipment.id, { widthMm: parseMm(e.target.value) })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">{t('dims.height', 'Höhe (mm)')}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={hMm ?? ''}
            placeholder={t('dims.heightPlaceholder', 'z. B. 44')}
            onChange={(e) =>
              updateEquipment(equipment.id, { heightMm: parseMm(e.target.value) })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-muted">{t('dims.depth', 'Tiefe (mm)')}</span>
          <input
            type="number"
            min={0}
            step={1}
            value={dMm ?? ''}
            placeholder={t('dims.depthPlaceholder', 'z. B. 400')}
            onChange={(e) =>
              updateEquipment(equipment.id, { depthMm: parseMm(e.target.value) })
            }
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
        </label>
      </div>
      <p className="mt-2 text-[10px] text-cp-text-muted">
        {t(
          'dims.hint',
          'Physische Aussenmaße. 19" Rack-Gerät: 1 HE = 44.45 mm, Standard-Breite 482 mm, typische Tiefe 400-600 mm. Wird vom 3D-Rack-Renderer + Logistik-Tools genutzt.',
        )}
      </p>
    </SortableSection>
  )
}
