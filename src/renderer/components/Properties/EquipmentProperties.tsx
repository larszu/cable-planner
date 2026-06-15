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
import { CategoryPropsSection } from './sections/CategoryPropsSection'
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
import { ReplaceDeviceSection } from './sections/ReplaceDeviceSection'
import { LifecycleSection } from './sections/LifecycleSection'

/** Module-level sensor options so re-renders don't churn the sensor
 *  instances. Stable references are critical for DnDContext's
 *  internal subscriptions — fresh sensor objects on every render
 *  was a known #185 contributor before. */
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 6 } } as const
const KEYBOARD_SENSOR_OPTIONS = {
  coordinateGetter: sortableKeyboardCoordinates,
} as const

/**
 * #306 — God-Component-Reduktion. Vorher 2758 LOC mit allen Sektionen
 * inline. Jetzt nur noch DnD-Setup + die Section-Reihenfolge. Alle
 * Sektionen liegen in `sections/`, der gemeinsame `<details>`-Wrapper
 * `SortableSection` ist eine eigene Datei.
 *
 * Order-Persistenz laeuft via uiStore.equipmentSectionOrder; jede
 * SortableSection liest sie selbstaendig — der Parent-Component
 * mutiert sie nur beim DragEnd.
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

  // v7.4.0 — sortable accordion sections. The parent is `flex flex-col`
  // so CSS `order` works. Non-movable elements (device-kind cards,
  // Name, Category, Rentman badge) have no `order` declared → they
  // default to 0 → render first in JSX order. Each SortableSection
  // sets its own `order` based on the uiStore-persisted user order.
  //
  // WICHTIG: ALLE Hooks (sectionOrder/sensors/projectMode) MUESSEN vor dem
  // `if (!equipment)`-Early-Return stehen (Rules of Hooks) — sonst aendert
  // sich die Hook-Anzahl wenn die Auswahl zwischen "kein Geraet" und "Geraet"
  // wechselt ("Rendered more hooks than during the previous render").
  const sectionOrder = useUiStore((s) => s.equipmentSectionOrder)
  const setSectionOrder = useUiStore((s) => s.setEquipmentSectionOrder)
  const dragSensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  )
  // v7.9.5 — Property-Panel im Lock-Modus visuell + funktional sperren.
  // fieldset/disabled blockiert ALLE Form-Controls darunter; das CSS
  // greift dann mit grauerem Look (pointer-events:none + opacity).
  const projectMode = useProjectStore((s) => s.project.mode ?? 'editing')

  if (!equipment) {
    return <div className="text-cp-xs text-cp-text-muted">{t('inspector.selectEquipment', 'Wähle ein Gerät auf dem Canvas.')}</div>
  }

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sectionOrder.indexOf(String(active.id))
    const newIndex = sectionOrder.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    setSectionOrder(arrayMove(sectionOrder, oldIndex, newIndex))
  }

  const projectIsLocked = projectMode === 'finalized' || projectMode === 'viewer'

  return (
    <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
    <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
    <fieldset
      disabled={projectIsLocked}
      className="flex flex-col gap-3 text-cp-xs disabled:cursor-default disabled:opacity-50"
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      {projectIsLocked && (
        <div className="rounded border border-amber-700/60 bg-amber-900/30 px-2 py-1.5 text-[11px] text-amber-200">
          {projectMode === 'viewer'
            ? t('inspector.viewerLocked', 'Viewer-Modus — Felder können nicht bearbeitet werden.')
            : t('inspector.finalizedLocked', 'Plan abgeschlossen — Felder gesperrt. Im Canvas-Banner „Bearbeitung freigeben" klicken.')}
        </div>
      )}
      <DeviceKindCards equipment={equipment} />

      <IdentityBlock equipment={equipment} />

      <OptionalFieldsSection equipment={equipment} />

      <DisplayFlagsSection equipment={equipment} />

      <RentmanSyncBadge equipment={equipment} />
      <label className="block">
        <span className="mb-1 block text-cp-text-secondary">{t('eq.field.category', 'Kategorie')}</span>
        <CategorySelect
          value={equipment.category}
          onChange={(category) => updateEquipment(equipment.id, { category })}
          extraOptions={[equipment.category]}
        />
      </label>

      <DisplayPropertiesBlock equipment={equipment} />
      <CategoryPropsSection equipment={equipment} />

      <NetworkAccessSection equipment={equipment} />

      <LifecycleSection equipment={equipment} />

      <PowerConsumptionSection equipment={equipment} />

      {/* #216/#422 — Physische Dimensionen (Breite/Höhe/Tiefe in mm). Eine
          einzige Sektion (frueher gab es zusaetzlich einen Inline-Block mit
          Legacy-Feldern dimensionHmm/Wmm/Dmm — die werden beim Project-Load
          in heightMm/widthMm/depthMm migriert, siehe healProjectPositions). */}
      <DimensionsSection equipment={equipment} />

      <NetworkConfigSection equipment={equipment} />

      <ModesSection equipment={equipment} />

      <PortsSection equipment={equipment} />

      <RackSection equipment={equipment} />

      <LibrarySaveSection equipment={equipment} />

      <ReplaceDeviceSection equipment={equipment} />

      <RackInstanceCard equipment={equipment} />

      <DeviceConfigsBlock equipmentId={equipment.id} />

      <PrintSection equipment={equipment} />

    </fieldset>
    </SortableContext>
    </DndContext>
  )
}
