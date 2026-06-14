/**
 * Free-floating draggable wrapper for the side panels (Library /
 * Properties / Annotations). When the user "detaches" a panel from its
 * grid column, we render it through this shell instead: an absolute-
 * positioned overlay that can be moved around the canvas without pushing it.
 *
 * Persistence: caller supplies a stored {x,y} + setter; we apply that
 * as the initial position and call back on drag-stop so localStorage
 * keeps the placement across sessions.
 *
 * #427 — Das Panel ist:
 *   • per Header-Drag frei verschiebbar,
 *   • über die Ecke unten-rechts frei skalierbar (responsive),
 *   • durch Ziehen an die zugehörige Bildschirmkante (dockEdge) wieder
 *     andockbar — beim Überfahren der Zone erscheint ein Drop-Indikator,
 *     beim Loslassen dort wird `onDock()` ausgelöst,
 *   • optional in ein separates OS-Fenster auslagerbar (onPopout).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { GripVertical, Pin, ExternalLink } from 'lucide-react'
import { useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'

interface FloatingPanelShellProps {
  /** Stored position; we clamp it to the viewport on mount + window resize. */
  position: { x: number; y: number }
  /** Called whenever the user drops the panel at a new position. */
  onMove: (next: { x: number; y: number }) => void
  /** Click handler for the dock button — caller flips its floating flag. */
  onDock: () => void
  /** #427 — Optional: in ein separates OS-Fenster auslagern. */
  onPopout?: () => void
  /** #427 — Bildschirmkante, an der dieses Panel wieder andockt. Beim
   *  Ziehen des Panels in diese Zone erscheint ein Drop-Indikator. */
  dockEdge?: 'left' | 'right'
  /** #427 — Persistiert eine neue Breite nach dem Resize (z. B. libraryWidth). */
  onResize?: (width: number) => void
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
const MIN_W = 240
const MIN_H = 200
/** Breite des "Andock"-Streifens an der Bildschirmkante. */
const DOCK_ZONE = 76

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

const maxW = () => Math.round(window.innerWidth * 0.95)
const maxH = () => Math.round(window.innerHeight * 0.88)

export const FloatingPanelShell = ({
  position,
  onMove,
  onDock,
  onPopout,
  dockEdge,
  onResize,
  title,
  width,
  height = '70vh',
  children,
}: FloatingPanelShellProps) => {
  const t = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState(position)
  // #427 — Frei skalierbare Größe (responsive). Höhe als String (z. B.
  // '70vh') wird beim Mount in px aufgelöst.
  const [size, setSize] = useState(() => ({
    width,
    height:
      typeof height === 'number'
        ? height
        : Math.min(maxH(), Math.round(window.innerHeight * 0.7)),
  }))
  // Zeigt den Andock-Streifen, während das Panel über der Dock-Zone schwebt.
  const [overDock, setOverDock] = useState(false)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const resizeStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startW: number
    startH: number
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
      const clamped = clamp(position, size.width)
      if (current.x === clamped.x && current.y === clamped.y) {
        return current
      }
      return clamped
    })
  }, [position.x, position.y, size.width])

  // Breiten-Prop (z. B. via Splitter geändert) in die lokale Größe übernehmen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Prop→State Sync der Breite
    setSize((s) => (s.width === width ? s : { ...s, width }))
  }, [width])

  // Re-clamp on resize so a previously valid position doesn't leave the
  // panel off-screen on smaller viewports.
  useEffect(() => {
    const onResizeWin = () => {
      setPos((current) => {
        const next = clamp(current, size.width)
        if (next.x === current.x && next.y === current.y) return current
        onMove(next)
        return next
      })
      // Größe ebenfalls in die neuen Viewport-Grenzen clampen.
      setSize((s) => {
        const w = Math.min(s.width, maxW())
        const h = Math.min(s.height, maxH())
        return w === s.width && h === s.height ? s : { width: w, height: h }
      })
    }
    window.addEventListener('resize', onResizeWin)
    return () => window.removeEventListener('resize', onResizeWin)
  }, [size.width, onMove])

  const inDockZone = useCallback(
    (clientX: number): boolean => {
      if (!dockEdge) return false
      return dockEdge === 'left'
        ? clientX <= DOCK_ZONE
        : clientX >= window.innerWidth - DOCK_ZONE
    },
    [dockEdge],
  )

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
        size.width,
      )
      setPos(next)
      if (dockEdge) setOverDock(inDockZone(event.clientX))
    },
    [size.width, dockEdge, inDockZone],
  )

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current
      if (drag && drag.pointerId === event.pointerId) {
        dragStateRef.current = null
        ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
        if (dockEdge && inDockZone(event.clientX)) {
          setOverDock(false)
          onDock()
          return
        }
        setOverDock(false)
        onMove(pos)
      }
    },
    [onMove, pos, dockEdge, inDockZone, onDock],
  )

  // --- Resize (untere rechte Ecke) ---------------------------------------
  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      resizeStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startW: size.width,
        startH: size.height,
      }
      ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    },
    [size.width, size.height],
  )

  const onResizePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const rs = resizeStateRef.current
    if (!rs || rs.pointerId !== event.pointerId) return
    const w = Math.max(MIN_W, Math.min(maxW(), rs.startW + (event.clientX - rs.startX)))
    const h = Math.max(MIN_H, Math.min(maxH(), rs.startH + (event.clientY - rs.startY)))
    setSize({ width: w, height: h })
  }, [])

  const onResizePointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const rs = resizeStateRef.current
      if (rs && rs.pointerId === event.pointerId) {
        resizeStateRef.current = null
        ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
        onResize?.(size.width)
      }
    },
    [onResize, size.width],
  )

  return (
    <>
      {/* #427 — Andock-Streifen an der Zielkante, sichtbar während über der Zone. */}
      {overDock && dockEdge && (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 z-30 flex h-screen items-center justify-center border-sky-400/70 bg-sky-500/15"
          style={{
            [dockEdge]: 0,
            width: Math.min(size.width, Math.round(window.innerWidth * 0.33)),
            borderLeftWidth: dockEdge === 'right' ? 2 : 0,
            borderRightWidth: dockEdge === 'left' ? 2 : 0,
            borderStyle: 'dashed',
          }}
        >
          <span className="rounded bg-sky-600/90 px-2 py-1 text-cp-xs font-medium text-white shadow-lg">
            {t('panel.dropToDock', 'Loslassen zum Andocken')}
          </span>
        </div>
      )}
      <aside
        ref={containerRef}
        className="pointer-events-auto fixed z-40 flex flex-col rounded-cp-modal border border-[var(--cp-border)] bg-cp-surface-3/95 text-[var(--cp-text)] shadow-2xl backdrop-blur-md"
        style={{
          left: pos.x,
          top: pos.y,
          width: size.width,
          maxWidth: '95vw',
          maxHeight: '88vh',
          height: size.height,
        }}
      >
        <header
          className="flex shrink-0 items-center justify-between border-b border-[var(--cp-border-muted)] bg-cp-surface-1/80 px-2 py-1.5 text-cp-xs"
          style={{ cursor: 'move', touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icon icon={GripVertical} size="sm" className="shrink-0 text-[var(--cp-text-faint)]" />
            <span className="truncate font-medium text-cp-text-bright">{title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onPopout && (
              <button
                type="button"
                onClick={onPopout}
                title={t('panel.popoutTitle', 'In separates Fenster auslagern (weiterer Monitor)')}
                aria-label={t('panel.popout', 'Auslagern')}
                className="inline-flex items-center gap-1 rounded-cp-control border border-[var(--cp-border)] bg-[var(--cp-surface-1)] px-2 py-0.5 text-cp-xs text-[var(--cp-text-secondary)] transition-colors hover:border-sky-500 hover:bg-[var(--cp-surface-2)] hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <Icon icon={ExternalLink} size="xs" />
              </button>
            )}
            <button
              type="button"
              onClick={onDock}
              title={t('panel.dockTitle', 'Andocken (zurück zur Seiten-Spalte)')}
              aria-label={t('panel.dock', 'Andocken')}
              className="inline-flex items-center gap-1 rounded-cp-control border border-[var(--cp-border)] bg-[var(--cp-surface-1)] px-2 py-0.5 text-cp-xs text-[var(--cp-text-secondary)] transition-colors hover:border-sky-500 hover:bg-[var(--cp-surface-2)] hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Icon icon={Pin} size="xs" /> {t('panel.dock', 'Andocken')}
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        {/* #427 — Resize-Griff unten rechts (responsive). */}
        <div
          role="separator"
          aria-label={t('panel.resize', 'Größe ändern')}
          title={t('panel.resize', 'Größe ändern')}
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
          className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-nwse-resize"
          style={{ touchAction: 'none' }}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-full w-full text-[var(--cp-text-faint)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          >
            <path d="M11 15 L15 11 M7 15 L15 7" />
          </svg>
        </div>
      </aside>
    </>
  )
}
