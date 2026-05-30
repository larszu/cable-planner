// v7.9.45 — Geteiltes Mount-/Style-Fundament für die imperativen
// Promise-basierten Modal-Dialoge (confirmDialog, infoDialog,
// promptDialog). Vorher hatte jeder dieser drei Dateien sein eigenes
// createRoot-Lifecycle + Backdrop-Styles + Modal-Card-Styles + Keyboard-
// Handler — ~50 Zeilen Boilerplate pro Datei, mit subtilen Style-
// Abweichungen die mit der Zeit auseinandergedriftet sind.
//
// Jetzt: mountModal() kümmert sich um createRoot+unmount+container-
// remove. Die Style-Konstanten + Keyboard-Hook leben hier zentral.

import { useEffect, type ReactNode, type CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'

/** Mount an imperative one-shot modal. Returns a promise that resolves
 *  when the modal calls its resolver. The render function gets a
 *  `resolve` callback — call it with the result value to dismiss the
 *  modal and resolve the promise. */
export const mountModal = <T,>(
  render: (resolve: (value: T) => void) => ReactNode,
): Promise<T> => {
  return new Promise<T>((resolve) => {
    // a11y: Fokus beim Schließen an das auslösende Element zurückgeben.
    const prevFocus = document.activeElement as HTMLElement | null
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const done = (value: T) => {
      root.unmount()
      container.remove()
      prevFocus?.focus?.()
      resolve(value)
    }
    root.render(render(done))
  })
}

// Geteilte Styles. Inline-Style-Objekte statt Tailwind, weil diese
// Komponenten via createRoot in einen ad-hoc-Container gemountet werden
// — wir können nicht garantieren dass Tailwind-Styles dort sicher
// greifen (bei Print-to-PDF-Pipelines etc. wird das DOM separat
// gerendert). Inline ist robust.

export const MODAL_BACKDROP: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
}

export const MODAL_CARD: CSSProperties = {
  background: '#1e293b',
  color: '#e2e8f0',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: 16,
  minWidth: 320,
  maxWidth: 560,
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
}

export const MODAL_BUTTON_SECONDARY: CSSProperties = {
  padding: '6px 14px',
  background: '#334155',
  border: 'none',
  borderRadius: 4,
  color: '#e2e8f0',
  cursor: 'pointer',
  fontSize: 13,
}

export const modalButtonPrimary = (color: string): CSSProperties => ({
  padding: '6px 14px',
  background: color,
  border: 'none',
  borderRadius: 4,
  color: '#ffffff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
})

/** Wire Escape + (optional) Enter zur Promise-Resolver-Funktion. */
export const useModalKeyboard = (
  onEscape: () => void,
  onEnter?: () => void,
): void => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscape()
      } else if (onEnter && e.key === 'Enter') {
        e.preventDefault()
        onEnter()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEscape, onEnter])
}

/** Helper für onMouseDown am Backdrop: ruft onClose nur dann auf, wenn
 *  der Klick wirklich am Backdrop war (nicht durchgereicht aus dem
 *  Modal-Inhalt). */
export const backdropMouseDown = <E extends React.MouseEvent<HTMLElement>>(
  onClose: () => void,
) => (e: E) => {
  if (e.target === e.currentTarget) onClose()
}

export type { ReactNode }
