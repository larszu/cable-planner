import { useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { format, useTranslation } from '../../../lib/i18n'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * v7.9.131 / Issue #216 / #306 — Physische Geraete-Dimensionen (Hoehe ×
 * Breite × Tiefe in mm). Optional, nur zur Information / fuer spaetere
 * 3D-Rack-Layouts. Tab-Reihenfolge: H -> B -> T.
 *
 * Hinweis: Es gibt zwei Dimensionen-Sektionen im Properties-Panel:
 *  - `DimensionsBlock` (diese hier): legacy dimensionH/W/Dmm-Felder als
 *    fieldset, INLINE in der Hauptkomponente eingebunden.
 *  - `DimensionsSection`: sortierbare Top-Level-Sektion mit
 *    widthMm/heightMm/depthMm — neuere Variante.
 */
export const DimensionsBlock = ({ equipment }: { equipment: EquipmentItem }) => {
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const numberInputClass = 'w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono'
  const setDim = (field: 'dimensionHmm' | 'dimensionWmm' | 'dimensionDmm') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    updateEquipment(equipment.id, { [field]: v === '' ? undefined : Number(v) })
  }
  // Ein-/ausklappbar wie die übrigen Properties-Sektionen. <details>/<summary>
  // statt <fieldset>, damit das Toggle auch im gesperrten (viewer/finalized)
  // Properties-Fieldset bedienbar bleibt — ein <summary> ist kein Form-Control.
  const [open, setOpen] = useState(false)
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded border border-slate-700 [&_summary]:cursor-pointer"
    >
      <summary className="flex items-center gap-1 px-2 py-1.5 text-[11px] uppercase tracking-wide text-slate-400 hover:text-slate-200 [&::-webkit-details-marker]:hidden">
        <span className="text-slate-500">{open ? '▾' : '▸'}</span>
        <span className="flex-1">{t('dimsBlock.title', 'Abmessungen (mm)')}</span>
      </summary>
      <div className="px-2 pb-2">
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-slate-300">{t('dimsBlock.height', 'Höhe')}</span>
          <input
            type="number"
            min={0}
            step="1"
            value={equipment.dimensionHmm ?? ''}
            onChange={setDim('dimensionHmm')}
            placeholder="44"
            className={numberInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-300">{t('dimsBlock.width', 'Breite')}</span>
          <input
            type="number"
            min={0}
            step="1"
            value={equipment.dimensionWmm ?? ''}
            onChange={setDim('dimensionWmm')}
            placeholder="482"
            className={numberInputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-300">{t('dimsBlock.depth', 'Tiefe')}</span>
          <input
            type="number"
            min={0}
            step="1"
            value={equipment.dimensionDmm ?? ''}
            onChange={setDim('dimensionDmm')}
            placeholder="305"
            className={numberInputClass}
          />
        </label>
      </div>
      {equipment.isRackDevice && equipment.rackUnits && (
        <p className="mt-1 text-[10px] text-slate-500">
          {format(
            t(
              'dimsBlock.rackHint',
              'Rack-Gerät · {he} HE. Wenn Höhe leer, wird {mm} mm als physische Höhe angenommen (1 HE ≈ 44,45 mm).',
            ),
            { he: equipment.rackUnits, mm: equipment.rackUnits * 44 },
          )}
        </p>
      )}
      </div>
    </details>
  )
}
