/**
 * Free-floating draggable wrapper for the side panels (Library /
 * Properties). When the user "detaches" a panel from its grid column,
 * we render it through this shell instead: an absolute-positioned
 * overlay that can be moved around the canvas without pushing it.
 *
 * Persistence: caller supplies a stored {x,y} + setter; we apply that
 * as the initial position and call back on drag-stop so localStorage
 * keeps the placement across sessions.
 *
 * The header gets a 'dock' button next to a 'close-to-hide' button.
 * Closing a floating panel re-docks it (collapses the panel back into
 * the grid in its non-floating form).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface FloatingPanelShellProps {
  /** Stored position; we clamp it to the viewport on mount + window resize. */
  position: { x: number; y: number }
  /** Called whenever the user drops the panel at a new position. */
  onMove: (next: { x: number; y: number }) => void
  /** Click handler for the dock button — caller flips its floating flag. */
  onDock: () => void
  /** Panel title rendered in the drag handle. */
  title: ReactNode
  /** Initial width in pixels — also persisted by caller (libraryWidth /
   *  propertiesWidth in uiStore). */
  width: number
  /** Initial height; defaults to 70 vh which is plenty for both panels. */
  height?: number | string
  children: ReactNode
}

const MIN_MARGIN = 40

const clamp = (
  pos: { x: number; y: number },
  width: number,
  height: number,
): { x: number; y: number } => {
  const maxX = window.innerWidth - MIN_MARGIN
  const maxY = window.innerHeight - MIN_MARGIN
  const minX = -(width - MIN_MARGIN)
  const minY = 0
  return {
    x: Math.max(minX, Math.min(maxX, pos.x)),
    y: Math.max(minY, Math.min(maxY, pos.y)),
  }
}

export const FloatingPanelShell = ({
  position,
  onMove,
  onDock,
  title,
  width,
  height = '70vh',
  children,
}: FloatingPanelShellProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState(position)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    offsetX: number
    offsetY: number
  } | null>(null)

  useEffect(() => setPos(position), [position])

  // Re-clamp on resize so a previously valid position doesn't leave the
  // panel off-screen on smaller viewports.
  useEffect(() => {
    const onResize = () => {
      setPos((current) => {
        const next = clamp(current, width, typeof height === 'number' ? height : 400)
        if (next.x === current.x && next.y === current.y) return current
        onMove(next)
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [width, height, onMove])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      // Let users still click buttons inside the header.
      if (target.closest('button, input, select, textarea, a')) return
      event.preventDefault()
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: pos.x,
        offsetY: pos.y,
      }
      ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    },
    [pos.x, pos.y],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const next = clamp(
        {
          x: drag.offsetX + (event.clientX - drag.startX),
          y: drag.offsetY + (event.clientY - drag.startY),
        },
        width,
        typeof height === 'number' ? height : 400,
      )
      setPos(next)
    },
    [width, height],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current
      if (drag && drag.pointerId === event.pointerId) {
        dragStateRef.current = null
        ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
        onMove(pos)
      }
    },
    [onMove, pos],
  )

  return (
    <aside
      ref={containerRef}
      className="pointer-events-auto fixed z-40 flex flex-col rounded-lg border border-slate-700 bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-md"
      style={{
        left: pos.x,
        top: pos.y,
        width,
        maxWidth: '95vw',
        maxHeight: '88vh',
        height,
      }}
    >
      <header
        className="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-2 py-1.5 text-xs"
        style={{ cursor: 'move', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-[10px] text-slate-500">⋮⋮</span>
          <span className="truncate font-medium text-slate-200">{title}</span>
        </div>
        <button
          type="button"
          onClick={onDock}
          title="Andocken (zurück zur Seiten-Spalte)"
          aria-label="Andocken"
          className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 transition-colors hover:border-sky-500 hover:bg-slate-800 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          📌 Andocken
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </aside>
  )
}
