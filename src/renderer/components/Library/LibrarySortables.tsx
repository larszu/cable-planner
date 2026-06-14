import React, { type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from '../../lib/i18n'

/**
 * #305 — Sortable-Wrapper aus LibraryPanel ausgelagert. Beide Komponenten
 * sind dnd-kit-Sortable-Items (Drag-Grip + transform/transition); der
 * Caller muss sie innerhalb eines SortableContext mounten (siehe
 * LibraryDndWrappers).
 */

// v7.9.5 — Sortable-Kategorie-Section. Wenn manualSort aktiv, hängt es
// einen Drag-Grip an die obere linke Ecke (greift via Pointer-Listener);
// useSortable übernimmt Transform/Transition. Im 'asc'/'desc' Sort-Mode
// ist DnD disabled.
export const SortableCategorySection = ({
  cat,
  manualSort,
  onDragOverTemplate,
  onDropTemplate,
  children,
}: {
  cat: string
  manualSort: boolean
  onDragOverTemplate: (event: React.DragEvent<HTMLElement>) => void
  onDropTemplate: (event: React.DragEvent<HTMLElement>) => void
  children: ReactNode
}) => {
  const t = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat,
    disabled: !manualSort,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
  }
  return (
    <section
      ref={setNodeRef}
      style={style}
      onDragOver={onDragOverTemplate}
      onDrop={onDropTemplate}
      className="rounded border border-cp-border-muted"
    >
      {manualSort && (
        <span
          {...attributes}
          {...listeners}
          aria-label={t('library.sortables.categoryAria', 'Kategorie verschieben')}
          title={t('library.sortables.dragTitle', 'Per Drag&Drop verschieben')}
          role="button"
          tabIndex={0}
          className="absolute left-0.5 top-0.5 z-10 flex h-5 w-3 cursor-grab items-center justify-center text-cp-text-faint hover:text-cp-text-bright active:cursor-grabbing"
        >
          <svg width="6" height="12" viewBox="0 0 6 12" fill="currentColor">
            <circle cx="1.5" cy="2" r="1" />
            <circle cx="4.5" cy="2" r="1" />
            <circle cx="1.5" cy="6" r="1" />
            <circle cx="4.5" cy="6" r="1" />
            <circle cx="1.5" cy="10" r="1" />
            <circle cx="4.5" cy="10" r="1" />
          </svg>
        </span>
      )}
      {children}
    </section>
  )
}

// v7.9.6 — Reusable sortable wrapper for group / rack preset cards.
// Provides a 6×12 dotted drag handle in the top-left corner; the
// content (action buttons) keeps full pointer-events. Disabling is
// handled by *not* wrapping in a DndContext rather than per-item.
export const SortablePresetCard = ({
  id,
  children,
  nativeDragData,
  onCardClick,
  clickTitle,
}: {
  id: string
  children: ReactNode
  /** v7.9.15 — Optional: HTML5-native drag-Daten, damit die Karte zusätzlich
   *  zum dnd-kit-Sort-Drag auf den Canvas gezogen werden kann. Der dnd-kit-
   *  Drag-Handle nutzt PointerEvents, der HTML5-Drag-Path nutzt
   *  dragstart/dragend — Konflikte gibt es keine. */
  nativeDragData?: { mime: string; data: string }
  /** v7.9.16 — Klick auf die Karte (außerhalb von Action-Buttons)
   *  triggert diesen Callback. Analog zu LibraryItem.onAdd — Click
   *  platziert, Drag-Drop platziert an der Drop-Position. */
  onCardClick?: () => void
  clickTitle?: string
}) => {
  const t = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    position: 'relative',
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded border border-cp-border bg-cp-surface-1 p-2 pl-5 text-cp-xs ${
        onCardClick ? 'cursor-grab hover:bg-cp-surface-2 active:cursor-grabbing' : ''
      }`}
      draggable={!!nativeDragData}
      onDragStart={(event) => {
        if (!nativeDragData) return
        event.dataTransfer.effectAllowed = 'copy'
        event.dataTransfer.setData(nativeDragData.mime, nativeDragData.data)
      }}
      onClick={
        onCardClick
          ? (event) => {
              // Klicks auf Action-Buttons (mit stopPropagation darin)
              // werden NICHT durchgereicht. Reine Klicks auf Card-Body
              // landen hier.
              if (event.defaultPrevented) return
              onCardClick()
            }
          : undefined
      }
      role={onCardClick ? 'button' : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onKeyDown={
        onCardClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onCardClick()
              }
            }
          : undefined
      }
      title={onCardClick ? clickTitle : undefined}
    >
      <span
        {...attributes}
        {...listeners}
        aria-label={t('library.sortables.moveAria', 'Verschieben')}
        title={t('library.sortables.dragTitle', 'Per Drag&Drop verschieben')}
        role="button"
        tabIndex={0}
        className="absolute left-0.5 top-0.5 z-10 flex h-5 w-3 cursor-grab items-center justify-center text-cp-text-faint hover:text-cp-text-bright active:cursor-grabbing"
      >
        <svg width="6" height="12" viewBox="0 0 6 12" fill="currentColor">
          <circle cx="1.5" cy="2" r="1" />
          <circle cx="4.5" cy="2" r="1" />
          <circle cx="1.5" cy="6" r="1" />
          <circle cx="4.5" cy="6" r="1" />
          <circle cx="1.5" cy="10" r="1" />
          <circle cx="4.5" cy="10" r="1" />
        </svg>
      </span>
      {children}
    </div>
  )
}
