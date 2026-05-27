import { useProjectStore } from '../../../store/projectStore'
import type { EquipmentItem } from '../../../types/equipment'

const RESOLUTION_PRESETS = [
  '1280x720',
  '1920x1080',
  '2560x1440',
  '3840x2160',
  '4096x2160',
  '5120x2880',
  '7680x4320',
]

/**
 * #306 — Monitor/Display Properties Block (resolution + size).
 * Shown when the device looks like a display based on category, name, or
 * when the user has already set one of these fields. Rendert null wenn
 * keines der Heuristik-Kriterien greift.
 */
export const DisplayPropertiesBlock = ({ equipment }: { equipment: EquipmentItem }) => {
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const category = equipment.category.toLowerCase()
  const name = equipment.name.toLowerCase()
  const looksLikeDisplay =
    /monitor|display|screen|tv|oled|lcd|led|multiviewer|projector|beamer/.test(category) ||
    /monitor|display|screen|tv|oled|lcd|led\b|projector|beamer/.test(name) ||
    equipment.resolution !== undefined ||
    equipment.displaySizeInch !== undefined
  if (!looksLikeDisplay) return null
  return (
    <fieldset className="rounded border border-slate-700 p-2">
      <legend className="px-1 text-[11px] uppercase tracking-wide text-slate-400">
        Display
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-slate-300">Auflösung</span>
          <input
            list="display-resolution-options"
            value={equipment.resolution ?? ''}
            onChange={(event) =>
              updateEquipment(equipment.id, { resolution: event.target.value || undefined })
            }
            placeholder="1920x1080"
            className="w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono"
          />
          <datalist id="display-resolution-options">
            {RESOLUTION_PRESETS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-slate-300">Diagonale (Zoll)</span>
          <input
            type="number"
            min={1}
            step="0.1"
            value={equipment.displaySizeInch ?? ''}
            onChange={(event) => {
              const value = event.target.value
              updateEquipment(equipment.id, {
                displaySizeInch: value === '' ? undefined : Number(value),
              })
            }}
            placeholder="27"
            className="w-full rounded border border-slate-700 bg-slate-900 p-2"
          />
        </label>
      </div>
    </fieldset>
  )
}
