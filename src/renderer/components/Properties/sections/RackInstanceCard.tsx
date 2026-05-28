import { useUiStore } from '../../../store/uiStore'
import type { EquipmentItem } from '../../../types/equipment'

/**
 * #306 — Karte fuer Geraete die zu einer Rack-Instanz gehoeren.
 * Oeffnet den Rack-Editor (Sub-Canvas auf das eine Rack gefiltert)
 * und zeigt die HU-Position. Rendert nichts wenn das Geraet kein
 * Rack-Member ist.
 */
export const RackInstanceCard = ({ equipment }: { equipment: EquipmentItem }) => {
  const openRackEditor = useUiStore((state) => state.openRackEditor)
  if (!equipment.rackInstanceId) return null

  return (
    <div className="rounded border border-cyan-700 bg-cyan-950/30 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-cyan-300">
        Rack-Instanz · {equipment.rackInstanceLabel ?? 'Rack'}
      </div>
      <p className="mb-2 text-[10px] text-slate-400">
        Dieses Gerät gehört zu einer Rack-Instanz. Der Rack-Editor zeigt eine
        gefilterte Sub-Canvas mit nur diesem Rack — Änderungen an der Position werden
        beim Loslassen auf ganze HU gerundet.
      </p>
      <button
        type="button"
        onClick={() => openRackEditor(equipment.rackInstanceId!)}
        className="w-full rounded bg-cyan-700 px-2 py-1 text-xs text-white hover:bg-cyan-600"
      >
        🗄 Rack-Editor öffnen
      </button>
      {typeof equipment.rackInstanceStartUnit === 'number' && (
        <div className="mt-1 text-[10px] text-slate-500">
          Position: ab HU {equipment.rackInstanceStartUnit + 1}
          {equipment.rackUnits ? ` (${equipment.rackUnits} HE)` : ''}
        </div>
      )}
    </div>
  )
}
