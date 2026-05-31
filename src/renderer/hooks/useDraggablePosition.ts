import { useCallback, useEffect, useRef, useState } from 'react'
import { DIALOG_LIMITS } from '../lib/layoutConstants'

/**
 * Persistable drag-to-move position state for modal dialogs. Returns props that
 * the dialog wires up to:
 *  - the inner content `<div>` (gets `style`, including the persisted offset)
 *  - the header bar that should act as the drag handle (gets `headerProps`)
 *
 * The position is stored normalized as the top-left offset relative to the
 * centered baseline (i.e. {x:0, y:0} == still centered). That way the modal
 * stays centered for first-time users and only persists explicit moves.
 *
 * Position is clamped on every drag and on window resize so the dialog never
 * disappears off-screen when the layout changes between sessions.
 */
export const useDraggablePosition = (storageKey: string, open: boolean) => {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number } | null>(null)

  // Hydrate from localStorage when the modal opens.
  useEffect(() => {
    if (!open) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as { x: number; y: number }
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Persistierten Offset beim Öffnen aus localStorage hydrieren
        setOffset(parsed)
      }
    } catch {
      /* ignore corrupted entries */
    }
  }, [open, storageKey])

  // Persist whenever the user dropped the modal at a new position.
  useEffect(() => {
    if (!open) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(offset))
    } catch {
      /* localStorage may be full or disabled — silently ignore */
    }
  }, [offset, open, storageKey])

  const clampOffset = useCallback((x: number, y: number) => {
    const el = containerRef.current
    if (!el) return { x, y }
    const rect = el.getBoundingClientRect()
    // Halte mindestens DIALOG_LIMITS.MIN_VISIBLE_STRIP_PX vom Dialog
    // sichtbar an jeder Kante, damit der User das Dialog auch nach
    // einem off-screen-Drag zurückholen kann.
    const margin = DIALOG_LIMITS.MIN_VISIBLE_STRIP_PX
    const maxX = (window.innerWidth - margin) / 2 - rect.width / 2 + rect.width - margin
    const minX = -((window.innerWidth - margin) / 2 - rect.width / 2 + rect.width - margin)
    const maxY = (window.innerHeight - margin) / 2 - rect.height / 2 + rect.height - margin
    const minY = -((window.innerHeight - margin) / 2 - rect.height / 2 + rect.height - margin)
    return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) }
  }, [])

  // Re-clamp when the window is resized so a previously valid position
  // doesn't leave the dialog off-screen on smaller viewports.
  useEffect(() => {
    if (!open) return
    const onResize = () => setOffset((current) => clampOffset(current.x, current.y))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, clampOffset])

  const onHeaderPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Ignore drags that start on a button/input inside the header so the
      // close-button etc. stay clickable.
      const target = event.target as HTMLElement
      if (target.closest('button, input, select, textarea, a')) return
      event.preventDefault()
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      }
      ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    },
    [offset.x, offset.y],
  )

  const onHeaderPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      setOffset(clampOffset(drag.offsetX + dx, drag.offsetY + dy))
    },
    [clampOffset],
  )

  const onHeaderPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null
      ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
    }
  }, [])

  const reset = useCallback(() => setOffset({ x: 0, y: 0 }), [])

  return {
    containerRef,
    containerStyle: { transform: `translate(${offset.x}px, ${offset.y}px)` } as const,
    headerProps: {
      onPointerDown: onHeaderPointerDown,
      onPointerMove: onHeaderPointerMove,
      onPointerUp: onHeaderPointerUp,
      onPointerCancel: onHeaderPointerUp,
      style: { cursor: 'move', touchAction: 'none' } as const,
    },
    resetPosition: reset,
  }
}
