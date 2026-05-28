import { useProjectStore } from '../../../store/projectStore'
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
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const numberInputClass = 'w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono'
  const setDim = (field: 'dimensionHmm' | 'dimensionWmm' | 'dimensionDmm') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    updateEquipment(equipment.id, { [field]: v === '' ? undefined : Number(v) })
  }
  return (
    <fieldset className="rounded border border-slate-700 p-2">
      <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
        Abmessungen (mm)
      </legend>
      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-slate-300">Hoehe</span>
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
          <span className="mb-1 block text-slate-300">Breite</span>
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
          <span className="mb-1 block text-slate-300">Tiefe</span>
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
          Rack-Geraet · {equipment.rackUnits} HE. Wenn Hoehe leer, wird
          {' '}{equipment.rackUnits * 44}{' '}mm als physische Hoehe angenommen
          (1 HE ≈ 44,45 mm).
        </p>
      )}
    </fieldset>
  )
}
