import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useCanvasProjectStore as useProjectStore } from '../../store/projectStoreContext'
import { useUiStore } from '../../store/uiStore'
import { CategorySelect } from '../shared/CategorySelect'
import { useTranslation } from '../../lib/i18n'
import { DimensionsSection } from './sections/DimensionsSection'
import { PowerConsumptionSection } from './sections/PowerConsumptionSection'
import { DisplayPropertiesBlock } from './sections/DisplayPropertiesBlock'
import { DeviceConfigsBlock } from './sections/DeviceConfigsBlock'
import { NetworkAccessSection } from './sections/NetworkAccessSection'
import { DeviceKindCards } from './sections/DeviceKindCards'
import { OptionalFieldsSection } from './sections/OptionalFieldsSection'
import { DisplayFlagsSection } from './sections/DisplayFlagsSection'
import { RentmanSyncBadge } from './sections/RentmanSyncBadge'
import { PortsSection } from './sections/PortsSection'
import { LibrarySaveSection } from './sections/LibrarySaveSection'
import { PrintSection } from './sections/PrintSection'
import { RackSection } from './sections/RackSection'
import { IdentityBlock } from './sections/IdentityBlock'
import { NetworkConfigSection } from './sections/NetworkConfigSection'
import { ModesSection } from './sections/ModesSection'
import { RackInstanceCard } from './sections/RackInstanceCard'
import { DimensionsBlock } from './sections/DimensionsBlock'

/** Module-level sensor options so re-renders don't churn the sensor
 *  instances. Stable references are critical for DnDContext's
 *  internal subscriptions — fresh sensor objects on every render
 *  was a known #185 contributor before. */
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } } as const
const KEYBOARD_SENSOR_OPTIONS = {
  coordinateGetter: sortableKeyboardCoordinates,
} as const

/**
 * v7.4.0 / v7.6.0 — drag-reorderable accordion section. Each section
 * lives in its own `<details>` for independent collapse, and uses
 * dnd-kit's `useSortable` to participate in the parent's drag
 * context. We rely on `useSortable`'s `index` (the position in the
 * SortableContext items array) for CSS `order` so that ALL sections
 * don't need to subscribe to the uiStore order array — that was
 * causing every section to re-render on every reorder and possibly
 * trigping React #185 during heavy drag activity.
 *
 * The `⋮⋮` handle on the summary triggers drag via spread attributes
 * + listeners (dnd-kit's contract); the rest of the summary keeps
 * the click-to-toggle behaviour for the accordion.
 */
// SortableSection lebt in eigener Datei (#306).



// v7.9.7 — Device-Level "SDI Fähigkeiten" Block entfernt. Quad-Link
// passiert jetzt pro Port via `port.quadLinkGroup`. Level A/B + Max
// Single-Link bleiben pro BNC-Port erhalten. Falls die Device-Level
// API noch von Importern / Exportern gelesen wird (z.B. Rentman-
// Templates), bleibt das Datenmodell-Feld `equipment.sdiCaps`
// vorerst bestehen — nur die UI ist weg.



/**
 * Monitor/display properties block (resolution + size).
 * Shown when the device looks like a display based on category, name, or
 * when the user has already set one of these fields.
 */
/**
 * v7.9.131 / Issue #216 — Physische Geraete-Dimensionen (Hoehe x Breite x Tiefe).
 * Optional, nur zur Information / fuer spaetere 3D-Rack-Layouts. Schritt
 * waehlbar in mm. Tab-Reihenfolge: H -> B -> T.
 */


/**
 * v7.5.0 / v7.6.0 — Operating-mode picker + inline editor for multi-mode
 * devices (media servers, modular processors like Pixelhue P20, Parco
 * S3, Brompton Tessera).
 *
 * Workflow:
 *   1. Edit ports normally with the PortList accordion → layout A.
 *   2. Click "+ aus aktuellem Layout" → name it "Layout A". Now the
 *      current ports are captured as a mode, and that mode is active.
 *   3. Edit ports → layout B → "+ aus aktuellem Layout" → "Layout B".
 *   4. Switch modes via the cards. Each card has rename + delete.
 *
 * Switching activates the mode and copies its snapshot to the live
 * inputs/outputs (via setActiveDeviceMode in the store). Editing the
 * ports later doesn't automatically sync back to the mode — there's
 * an "Aktuelle Ports in Modus übernehmen" button per active mode for
 * that, so the user controls when a mode definition is updated.
 */

/**
 * v7.9.108 / Issue #225 — AI-Suggest-Button im Ports-Panel.
 *
 * Sitzt oben im Inputs/Outputs-Bereich der EquipmentProperties-Sidebar.
 * Klick → ruft suggestFromAI(equipment.name, equipment.category) via
 * den im Settings → AI konfigurierten Provider (Gemini / Claude /
 * OpenAI). Wenn die KI Port-Vorschlaege liefert, kann der User:
 *  - Vorhandene Ports ERSETZEN (zerstoerende Aktion, mit Confirm)
 *  - Vorschlaege ANHAENGEN an die bestehenden Ports (additive Aktion)
 * Fehler werden inline ausgegeben.
 */

/**
 * v7.9.105 / Issue #216 — Physische Dimensionen (Hoehe / Breite / Tiefe
 * in mm). Bisher waren widthMm/heightMm/depthMm im Schema definiert,
 * aber nur ueber den Rack-Builder editierbar. Jetzt auch im
 * Eigenschaften-Panel — sinnvoll fuer Rack-Planung, Logistik, Platzbedarf.
 */

export const EquipmentProperties = () => {
  const t = useTranslation()
  const selectedEquipmentId = useProjectStore((state) => state.selectedEquipmentId)
  const equipment = useProjectStore((state) =>
    state.project.equipment.find((item) => item.id === selectedEquipmentId),
  )
  // Reactive selector statt useProjectStore.getState() (das gibt's auf der
  // Context-Variante nicht). Werden in den Patch-Sheet-Druck-Buttons unten
  // benoetigt; durch Selector aktualisieren sich die PDFs automatisch wenn
  // sich Verkabelung aendert.
  const updateEquipment = useProjectStore((state) => state.updateEquipment)

  if (!equipment) {
    return <div className="text-xs text-slate-400">Select an equipment node.</div>
  }


  // v7.4.0 — sortable accordion sections. The parent is `flex flex-col`
  // so CSS `order` works. Non-movable elements (device-kind cards,
  // Name, Category, Rentman badge) have no `order` declared → they
  // default to 0 → render first in JSX order. Each SortableSection
  // sets its own `order` based on the uiStore-persisted user order.
  const sectionOrder = useUiStore((s) => s.equipmentSectionOrder)
  const setSectionOrder = useUiStore((s) => s.setEquipmentSectionOrder)
  const dragSensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  )
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sectionOrder.indexOf(String(active.id))
    const newIndex = sectionOrder.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setSectionOrder(arrayMove(sectionOrder, oldIndex, newIndex))
  }

  // v7.9.5 — Property-Panel im Lock-Modus visuell + funktional sperren.
  // fieldset/disabled blockiert ALLE Form-Controls darunter; das CSS
  // greift dann mit grauerem Look (pointer-events:none + opacity).
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')
  const projectIsLocked = projectMode === 'finalized' || projectMode === 'viewer'

  return (
    <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
    <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
    <fieldset
      disabled={projectIsLocked}
      className="flex flex-col gap-3 text-xs disabled:cursor-default disabled:opacity-60"
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      {projectIsLocked && (
        <div className="rounded border border-amber-700/60 bg-amber-900/30 px-2 py-1.5 text-[11px] text-amber-200">
          {projectMode === 'viewer'
            ? 'Viewer-Modus — Felder können nicht bearbeitet werden.'
            : 'Plan abgeschlossen — Felder gesperrt. Im Canvas-Banner „Bearbeitung freigeben" klicken.'}
        </div>
      )}
      <DeviceKindCards equipment={equipment} />

      <IdentityBlock equipment={equipment} />

      <OptionalFieldsSection equipment={equipment} />

      <DisplayFlagsSection equipment={equipment} />

      <RentmanSyncBadge equipment={equipment} />
      <label className="block">
        <span className="mb-1 block text-slate-300">{t('eq.field.category', 'Kategorie')}</span>
        <CategorySelect
          value={equipment.category}
          onChange={(category) => updateEquipment(equipment.id, { category })}
          extraOptions={[equipment.category]}
        />
      </label>

      <DisplayPropertiesBlock equipment={equipment} />
      <DimensionsBlock equipment={equipment} />

      <NetworkAccessSection equipment={equipment} />

      <PowerConsumptionSection equipment={equipment} />

      {/* v7.9.105 / Issue #216 — Physische Dimensionen (Breite/Höhe/Tiefe). */}
      <DimensionsSection equipment={equipment} />

      <NetworkConfigSection equipment={equipment} />

      <ModesSection equipment={equipment} />

      <PortsSection equipment={equipment} />

      <RackSection equipment={equipment} />

      <LibrarySaveSection equipment={equipment} />

      <RackInstanceCard equipment={equipment} />

      <DeviceConfigsBlock equipmentId={equipment.id} />

      <PrintSection equipment={equipment} />

    </fieldset>
    </SortableContext>
    </DndContext>
  )
}
