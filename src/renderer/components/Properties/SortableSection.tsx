import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * #306 — SortableSection-Wrapper aus EquipmentProperties ausgelagert.
 * Pure Component, kein Store-Subscribe — wird vom Hauptcontainer
 * innerhalb eines SortableContext mit `id` aus equipmentSectionOrder
 * gemountet.
 */
export const SortableSection = ({
  id,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  id: string
  title: ReactNode
  subtitle?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, index } =
    useSortable({ id })
  return (
    <details
      ref={setNodeRef}
      open={defaultOpen}
      className={`rounded border border-slate-700 bg-slate-900/40 [&_summary]:cursor-pointer ${
        isDragging ? 'opacity-60 shadow-xl shadow-slate-950/50' : ''
      }`}
      style={{
        order: index < 0 ? 999 : index,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <summary className="flex items-center gap-2 px-2 py-1.5 text-[11px] uppercase tracking-wide text-slate-400 hover:text-slate-200">
        <span
          {...attributes}
          {...listeners}
          title="Sektion ziehen, um Reihenfolge zu ändern"
          className="cursor-grab text-slate-500 hover:text-slate-300 active:cursor-grabbing"
          aria-label="Sektion verschieben"
          role="button"
        >
          ⋮⋮
        </span>
        <span className="flex-1">{title}</span>
        {subtitle && (
          <span className="normal-case text-[10px] text-slate-500">{subtitle}</span>
        )}
      </summary>
      <div className="border-t border-slate-800 p-2">{children}</div>
    </details>
  )
}
