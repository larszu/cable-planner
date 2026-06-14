import { useEffect, useRef } from 'react'
import { useTranslation } from '../../lib/i18n'

interface SplitterProps {
  /**
   * Which side the splitter is attached to. `left` means the splitter sits on
   * the right edge of a left panel — dragging right grows that panel.
   * `right` means it sits on the left edge of a right panel — dragging left
   * grows that panel.
   */
  side: 'left' | 'right'
  onResize: (deltaPx: number) => void
}

/**
 * 4-px wide vertical drag handle for resizing side panels. Captures the
 * pointer, streams deltas, and applies them via the supplied callback.
 */
export const Splitter = ({ side, onResize }: SplitterProps) => {
  const t = useTranslation()
  const startX = useRef<number | null>(null)

  useEffect(() => {
    const up = () => {
      startX.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    startX.current = event.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    ;(event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current == null) return
    const delta = event.clientX - startX.current
    startX.current = event.clientX
    onResize(side === 'left' ? delta : -delta)
  }

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      className="h-full w-1 cursor-col-resize bg-cp-surface-2 hover:bg-sky-600"
      title={t('splitter.resize', 'Spalte verbreitern')}
    />
  )
}
