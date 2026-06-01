/**
 * #427 — "Herausziehen" eines gedockten Panels.
 *
 * Liefert pointer-Handler für den Header eines GEDOCKTEN Panels. Zieht der
 * Nutzer den Header weiter als `threshold` Pixel, wird das Panel abgedockt
 * (floating) und folgt danach dem Cursor bis zum Loslassen — ein durchgehender
 * "tear-off"-Drag wie bei Browser-Tabs.
 *
 * Bewusst window-basiert (nicht setPointerCapture): beim Übergang
 * gedockt → floating verschwindet das ursprüngliche Header-Element aus dem
 * DOM. Würde der Drag an dessen Pointer-Capture hängen, bräche er ab. Die
 * window-Listener überleben den Re-Render der umgebenden Komponente.
 */
import { useCallback, useEffect, useRef } from 'react'

interface TearOffOptions {
  /** Einmalig aufgerufen, sobald die Schwelle überschritten ist. */
  onUndock: (pos: { x: number; y: number }) => void
  /** Bei jeder Mausbewegung nach dem Abdocken — Panel dem Cursor folgen lassen. */
  onDragMove: (pos: { x: number; y: number }) => void
  /** Beim Loslassen, falls tatsächlich abgedockt wurde. */
  onDrop?: () => void
  /** Pixel, die der Zeiger wandern muss, bevor abgedockt wird. */
  threshold?: number
}

export const usePanelTearOff = ({ onUndock, onDragMove, onDrop, threshold = 26 }: TearOffOptions) => {
  /** Wird true, sobald in dieser Geste abgedockt wurde — der nachfolgende
   *  click-Event auf dem Button kann das so unterdrücken (kein Doppel-Float). */
  const draggedRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Listener bei Unmount sicher entfernen.
  useEffect(() => () => cleanupRef.current?.(), [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Nur primäre Maustaste / Touch.
      if (event.button !== 0 && event.pointerType === 'mouse') return
      const target = event.target as HTMLElement
      // Klicks auf echte Bedienelemente NICHT als Drag werten (außer der
      // Aufrufer hängt den Handler direkt an den Abdock-Button).
      if (target.dataset.tearoff !== 'handle' && target.closest('input, select, textarea, a')) return

      const rect = event.currentTarget.getBoundingClientRect()
      const grabX = event.clientX - rect.left
      const grabY = event.clientY - rect.top
      const startX = event.clientX
      const startY = event.clientY
      draggedRef.current = false
      let undocked = false

      const move = (e: PointerEvent) => {
        const pos = { x: e.clientX - grabX, y: e.clientY - grabY }
        if (!undocked) {
          if (Math.hypot(e.clientX - startX, e.clientY - startY) < threshold) return
          undocked = true
          draggedRef.current = true
          onUndock(pos)
        } else {
          onDragMove(pos)
        }
      }
      const up = () => {
        cleanupRef.current?.()
        cleanupRef.current = null
        if (undocked) onDrop?.()
      }

      const cleanup = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
      cleanupRef.current = cleanup
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
    [onUndock, onDragMove, onDrop, threshold],
  )

  return { onPointerDown, draggedRef }
}
