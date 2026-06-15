/**
 * #467 — Einheitliche Tooltip-Strategie.
 *
 * Vorher: ~472× natives `title=` als Tooltip *und* als einziges Label.
 * Native title-Tooltips haben keine kontrollierbare Verzögerung, kein
 * Styling, erscheinen nicht bei Keyboard-Fokus und sind auf Touch
 * unbrauchbar.
 *
 * KONVENTION (wann was):
 *   - `aria-label`  → der barrierefreie *Name* eines Icon-only-Controls.
 *                     IMMER setzen, wenn der Button keinen sichtbaren Text
 *                     hat. Das ist KEIN Tooltip.
 *   - `<Tooltip>`   → eine *ergänzende* Erklärung/Hinweis, der beim
 *                     Hovern UND beim Fokussieren (Keyboard) erscheint,
 *                     mit Delay, Positionierung und role="tooltip".
 *   - natives title → nur noch für dichte/unkritische Fälle vertretbar,
 *                     wo ein React-Portal-Tooltip Overkill wäre. Niemals
 *                     als *einziges* Label eines interaktiven Elements.
 *
 * Das Popover rendert via Portal an document.body (fixed, aus dem Trigger-
 * Rect positioniert), damit es nicht von scrollenden Modal-Bodies geclippt
 * wird — analog zu ConnectorPicker.
 */
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  /** Tooltip-Inhalt (Text oder kleine Knoten). Leer/undefined → kein Tooltip. */
  label: ReactNode
  /** Das umschlossene interaktive Element (genau ein Kind). */
  children: ReactElement
  /** Bevorzugte Seite. Default 'top', kippt bei Platzmangel automatisch. */
  side?: 'top' | 'bottom'
  /** Verzögerung vor dem Einblenden beim Hovern (ms). Default 400. */
  delay?: number
}

type Pos = { left: number; top: number; placement: 'top' | 'bottom' }

export const Tooltip = ({ label, children, side = 'top', delay = 400 }: TooltipProps) => {
  const id = useId()
  const triggerRef = useRef<HTMLElement | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)

  const clearTimer = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const show = (immediate: boolean) => {
    clearTimer()
    if (immediate) setOpen(true)
    else timer.current = window.setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    clearTimer()
    setOpen(false)
  }

  const place = () => {
    const el = triggerRef.current
    const tip = tipRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const th = tip?.offsetHeight ?? 28
    const tw = tip?.offsetWidth ?? 0
    const spaceAbove = r.top
    const placement: 'top' | 'bottom' =
      side === 'top' ? (spaceAbove < th + 10 ? 'bottom' : 'top') : spaceAbove > window.innerHeight - r.bottom ? 'top' : 'bottom'
    const top = placement === 'top' ? r.top - th - 6 : r.bottom + 6
    const left = Math.min(Math.max(8, r.left + r.width / 2 - tw / 2), window.innerWidth - tw - 8)
    setPos({ left, top, placement })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    const onScroll = () => place()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => clearTimer(), [])

  if (!isValidElement(label) && (label == null || label === '')) return children

  // aria-describedby an das Kind hängen, ohne ein bestehendes zu zerstören.
  const childProps = children.props as Record<string, unknown>
  const describedBy = [childProps['aria-describedby'], open ? id : null].filter(Boolean).join(' ') || undefined

  // Ref-Merge für das umschlossene Kind: unser triggerRef (für Positionierung)
  // UND der evtl. vom Aufrufer am Kind gesetzte Original-Ref. Der Callback läuft
  // im COMMIT (nicht im Render); das Ziel-Ref-Objekt gehört dem Aufrufer und ist
  // genau dafür da, mutiert zu werden. Die react-hooks/refs- bzw. /immutability-
  // Regeln können diesen Forwarding-Fall nicht von echtem Render-Ref-Zugriff
  // unterscheiden → hier bewusst lokal unterdrückt.
  // eslint-disable-next-line react-hooks/refs
  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node
      // React 19: ref ist ein normales Prop → vom Kind über props.ref lesen
      // (children.ref ist entfernt/deprecated und lieferte hier nichts mehr,
      // wodurch der Original-Ref des Kindes still NICHT mehr weitergereicht
      // wurde). Forward an Funktions- wie Objekt-Refs.
      const r = (children.props as { ref?: unknown }).ref
      if (typeof r === 'function') (r as (n: HTMLElement | null) => void)(node)
      // eslint-disable-next-line react-hooks/immutability
      else if (r && typeof r === 'object') (r as { current: HTMLElement | null }).current = node
    },
    'aria-describedby': describedBy,
    onMouseEnter: (e: React.MouseEvent) => {
      ;(childProps.onMouseEnter as ((e: React.MouseEvent) => void) | undefined)?.(e)
      show(false)
    },
    onMouseLeave: (e: React.MouseEvent) => {
      ;(childProps.onMouseLeave as ((e: React.MouseEvent) => void) | undefined)?.(e)
      hide()
    },
    onFocus: (e: React.FocusEvent) => {
      ;(childProps.onFocus as ((e: React.FocusEvent) => void) | undefined)?.(e)
      show(true)
    },
    onBlur: (e: React.FocusEvent) => {
      ;(childProps.onBlur as ((e: React.FocusEvent) => void) | undefined)?.(e)
      hide()
    },
  } as Record<string, unknown>)

  return (
    <>
      {trigger}
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className="pointer-events-none fixed z-[var(--cp-z-popover)] max-w-xs rounded-cp-control border border-cp-border bg-cp-surface-2 px-2 py-1 text-cp-xs text-cp-text shadow-xl"
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
          >
            {label}
          </div>,
          document.body,
        )}
    </>
  )
}
