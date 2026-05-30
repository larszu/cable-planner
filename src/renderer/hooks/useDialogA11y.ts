// Phase 3 — Wiederverwendbare Dialog-Accessibility.
//
// Kapselt das, was jeder modale Dialog für Tastatur-Bedienbarkeit
// braucht:
//   • Fokus beim Öffnen in den Dialog ziehen (erstes fokussierbares
//     Element, sonst der Container selbst)
//   • Fokus-Rückgabe an das auslösende Element beim Schließen
//   • Escape schließt (optional abschaltbar, z. B. analog closeOnBackdrop)
//   • Tab / Shift+Tab zyklisch INNERHALB des Dialogs gefangen (Focus-Trap)
//
// Verwendung:
//   const { panelRef, titleId, dialogProps } = useDialogA11y(open, onClose)
//   <div ref={panelRef} aria-labelledby={titleId} {...dialogProps}> … </div>
//   <h2 id={titleId}>Titel</h2>
//
// `dialogProps` enthält role/aria-modal/tabIndex/onKeyDown. `aria-labelledby`
// bleibt beim Aufrufer, damit Dialoge ohne Titel-Element stattdessen ein
// eigenes aria-label setzen können.

import { useCallback, useEffect, useId, useRef, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogA11yOptions {
  /** Escape schließt den Dialog. Default true. */
  closeOnEscape?: boolean
  /** Externe Container-Ref mitnutzen (z. B. die Drag-Container-Ref aus
   *  useDraggablePosition), damit Focus-Trap + Drag denselben Knoten
   *  referenzieren — ohne Ref-Merge/Mutation. */
  ref?: RefObject<HTMLDivElement | null>
}

export const useDialogA11y = (
  open: boolean,
  onClose: () => void,
  { closeOnEscape = true, ref }: DialogA11yOptions = {},
) => {
  const titleId = useId()
  const internalRef = useRef<HTMLDivElement | null>(null)
  const panelRef = ref ?? internalRef
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  // Fokus beim Öffnen in den Dialog ziehen, beim Schließen zurückgeben.
  useEffect(() => {
    if (!open) return
    lastFocusedRef.current = (document.activeElement as HTMLElement | null) ?? null
    const panel = panelRef.current
    if (panel) {
      const first = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(first ?? panel).focus()
    }
    return () => {
      lastFocusedRef.current?.focus?.()
    }
  }, [open, panelRef])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [closeOnEscape, onClose, panelRef],
  )

  const dialogProps = {
    role: 'dialog' as const,
    'aria-modal': true,
    tabIndex: -1,
    onKeyDown,
  }

  return { panelRef, titleId, dialogProps }
}
