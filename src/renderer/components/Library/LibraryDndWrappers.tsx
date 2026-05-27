import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ReactNode } from 'react'

/**
 * #305 — DnD-Wrapper fuer die Library-Panel-Sortierung. Aus LibraryPanel
 * extrahiert. Beide Wrapper haben dieselbe Logik (Sensors + handleDragEnd
 * + SortableContext), aber unterschiedlichen Item-Type-Kontext — die Trennung
 * macht den Caller leichter lesbar.
 */

export const PresetDndWrapper = ({
  ids,
  onReorder,
  children,
}: {
  ids: string[]
  onReorder: (newOrder: string[]) => void
  children: ReactNode
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(ids, oldIndex, newIndex))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

// v7.9.5 — Wrapper mit DnD-Context+SortableContext nur wenn manueller
// Sort-Modus aktiv ist. Sonst transparent durchreichen.
export const CategoryDndWrapper = ({
  cats,
  onReorder,
  children,
}: {
  cats: string[]
  onReorder: (newOrder: string[]) => void
  children: ReactNode
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = cats.indexOf(active.id as string)
    const newIndex = cats.indexOf(over.id as string)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(cats, oldIndex, newIndex))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={cats} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}
