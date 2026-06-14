import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from '../../lib/i18n'

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
  const t = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, index } =
    useSortable({ id })
  return (
    <details
      ref={setNodeRef}
      open={defaultOpen}
      className={`rounded border border-cp-border bg-cp-surface-1/40 [&_summary]:cursor-pointer ${
        isDragging ? 'opacity-60 shadow-xl shadow-slate-950/50' : ''
      }`}
      style={{
        order: index < 0 ? 999 : index,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <summary className="flex items-center gap-2 px-2 py-1.5 text-[11px] uppercase tracking-wide text-cp-text-muted hover:text-cp-text-bright">
        {/* #421 — Drag-Handle deutlicher: groesseres ⠿-Glyph, hellere Farbe,
            breitere Klickflaeche; sichtbar auf jeder Sektion damit klar ist,
            dass die Reihenfolge per Drag&Drop am Handle aenderbar ist. */}
        <span
          {...attributes}
          {...listeners}
          title={t('props.section.dragTitle', 'Sektion ziehen, um Reihenfolge zu ändern (geräteübergreifend persistiert).')}
          className="-my-1 inline-flex h-5 w-5 cursor-grab items-center justify-center rounded text-cp-lg leading-none text-cp-text-muted hover:bg-cp-surface-4/40 hover:text-cp-text-bright active:cursor-grabbing"
          aria-label={t('props.section.dragAria', 'Sektion verschieben')}
          role="button"
          onClick={(e) => e.preventDefault()}
        >
          ⠿
        </span>
        <span className="flex-1">{title}</span>
        {subtitle && (
          <span className="normal-case text-[10px] text-cp-text-muted">{subtitle}</span>
        )}
      </summary>
      <div className="border-t border-cp-border-muted p-2">{children}</div>
    </details>
  )
}
