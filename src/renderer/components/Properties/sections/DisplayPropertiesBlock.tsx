import { useState } from 'react'
import { useProjectStore } from '../../../store/projectStore'
import { useTranslation } from '../../../lib/i18n'
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
  const t = useTranslation()
  const updateEquipment = useProjectStore((state) => state.updateEquipment)
  const category = equipment.category.toLowerCase()
  const name = equipment.name.toLowerCase()
  const looksLikeDisplay =
    /monitor|display|screen|tv|oled|lcd|led|multiviewer|projector|beamer/.test(category) ||
    /monitor|display|screen|tv|oled|lcd|led\b|projector|beamer/.test(name) ||
    equipment.resolution !== undefined ||
    equipment.displaySizeInch !== undefined
  // Ein-/ausklappbar (wie SDI-Caps / Abmessungen). Default offen, wenn schon
  // Werte gesetzt sind, sonst eingeklappt. <summary> statt Form-Control, damit
  // das Toggle auch im gesperrten (viewer/finalized) Fieldset bedienbar bleibt.
  // WICHTIG: useState MUSS vor dem `return null` stehen (Rules of Hooks) —
  // sonst aendert sich die Hook-Anzahl wenn `looksLikeDisplay` beim Wechsel
  // des selektierten Geraets umschlaegt ("Rendered more hooks than...").
  const [open, setOpen] = useState(
    equipment.resolution !== undefined || equipment.displaySizeInch !== undefined,
  )
  if (!looksLikeDisplay) return null
  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded border border-cp-border [&_summary]:cursor-pointer"
    >
      <summary className="flex items-center gap-1 px-2 py-1.5 text-[11px] uppercase tracking-wide text-cp-text-muted hover:text-cp-text-bright [&::-webkit-details-marker]:hidden">
        <span className="text-cp-text-faint">{open ? '▾' : '▸'}</span>
        <span className="flex-1">{t('display.title', 'Display')}</span>
      </summary>
      <div className="px-2 pb-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('display.resolution', 'Auflösung')}</span>
          <input
            list="display-resolution-options"
            value={equipment.resolution ?? ''}
            onChange={(event) =>
              updateEquipment(equipment.id, { resolution: event.target.value || undefined })
            }
            placeholder="1920x1080"
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2 font-mono"
          />
          <datalist id="display-resolution-options">
            {RESOLUTION_PRESETS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-cp-text-secondary">{t('display.diagonal', 'Diagonale (Zoll)')}</span>
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
            className="w-full rounded border border-cp-border bg-cp-surface-1 p-2"
          />
        </label>
      </div>
      </div>
    </details>
  )
}
