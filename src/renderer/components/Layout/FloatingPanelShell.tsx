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
import { GripVertical, Pin } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'

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
  const t = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState(position)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    offsetX: number
    offsetY: number
  } | null>(null)

  // Sync local pos with prop ONLY when the actual coordinates change.
  // Without the value-comparison guard, a parent re-render that passes
  // a fresh {x,y} object with the same values would still trigger
  // setPos → re-render → fresh prop ref → setPos → loop. This is a
  // textbook React #185 "max update depth" recipe.
  // v7.9.0 / Issue #108 — also clamp on mount so a persisted off-screen
  // position (e.g. saved from a larger monitor) doesn't strand the
  // panel where the user can't see it. clamp() uses the current
  // viewport bounds.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Persistierte Position in den aktuellen Viewport clampen
    setPos((current) => {
      const clamped = clamp(position, width)
      if (
        current.x === clamped.x &&
        current.y === clamped.y
      ) {
        return current
      }
      return clamped
    })
  }, [position.x, position.y, width, height])

  // Re-clamp on resize so a previously valid position doesn't leave the
  // panel off-screen on smaller viewports.
  useEffect(() => {
    const onResize = () => {
      setPos((current) => {
        const next = clamp(current, width)
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
      className="pointer-events-auto fixed z-40 flex flex-col rounded-lg border border-[var(--cp-border)] bg-slate-950/95 text-[var(--cp-text)] shadow-2xl backdrop-blur-md"
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
        className="flex shrink-0 items-center justify-between border-b border-[var(--cp-border-muted)] bg-slate-900/80 px-2 py-1.5 text-cp-xs"
        style={{ cursor: 'move', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Icon icon={GripVertical} size="sm" className="shrink-0 text-[var(--cp-text-faint)]" />
          <span className="truncate font-medium text-slate-200">{title}</span>
        </div>
        <button
          type="button"
          onClick={onDock}
          title={t('panel.dockTitle', 'Andocken (zurück zur Seiten-Spalte)')}
          aria-label={t('panel.dock', 'Andocken')}
          className="inline-flex items-center gap-1 rounded border border-[var(--cp-border)] bg-[var(--cp-surface-1)] px-2 py-0.5 text-cp-xs text-[var(--cp-text-secondary)] transition-colors hover:border-sky-500 hover:bg-[var(--cp-surface-2)] hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Icon icon={Pin} size="xs" /> {t('panel.dock', 'Andocken')}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </aside>
  )
}
