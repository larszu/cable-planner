// v7.9.44 — Modal-Shell Wrapper.
//
// Vorher hatte praktisch jeder Dialog (Settings, Print, Export, About,
// ModeEditor, RentmanImport, Calculators, …) seinen eigenen
// "fixed inset-0 z-50 bg-black/60"-Container + Drag-Header + Close-
// Button. Inkonsistente max-width, padding-Werte, header-Styles waren
// die Folge.
//
// Jetzt: ModalShell kapselt das Boilerplate. Pflichtfelder sind open,
// onClose, title, children. Optional draggable (über useDraggablePosition)
// und Footer-Slot.

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useTranslation } from '../../lib/i18n'
import { Icon } from './Icon'

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | 'full'

const MAX_WIDTH_CLASS: Record<MaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-none',
}

interface ModalShellProps {
  open: boolean
  onClose: () => void
  /** Header text. Use titleIcon for the optional emoji/icon prefix. */
  title: ReactNode
  titleIcon?: ReactNode
  /** Tailwind max-w-* size. Default 'md'. */
  maxWidth?: MaxWidth
  /** Wenn gesetzt → Dialog ist draggable; der String ist die
   *  Persistenz-Key (siehe useDraggablePosition). */
  draggableKey?: string
  /** Optional footer rendered below the body, separated by border. */
  footer?: ReactNode
  /** Default: body scrollt mit max-h-[80vh]. Auf false setzen wenn der
   *  Body selber das Scroll-Layout managt (z.B. RackBuilder mit eigener
   *  flex-Struktur). */
  scrollBody?: boolean
  /** Optional z-index override (default z-50). Manche Dialoge müssen
   *  über andere drüber liegen — dafür z-[60] o.ä. */
  zIndex?: number
  /** Klick-Außen schließt den Dialog. Default true. */
  closeOnBackdrop?: boolean
  children: ReactNode
}

export const ModalShell = ({
  open,
  onClose,
  title,
  titleIcon,
  maxWidth = 'md',
  draggableKey,
  footer,
  scrollBody = true,
  zIndex = 50,
  closeOnBackdrop = true,
  children,
}: ModalShellProps) => {
  const t = useTranslation()
  // Hook MUST be called unconditionally (Rules of Hooks). Wenn nicht
  // draggable, geben wir einen Dummy-Key — useDraggablePosition no-ops
  // bei `open=false`.
  const drag = useDraggablePosition(
    draggableKey ?? 'cable-planner:modal-pos:__nodrag__',
    open && !!draggableKey,
  )
  // a11y: role/aria-modal, Escape-to-close (analog closeOnBackdrop),
  // Focus-Trap + Fokus-Rückgabe. Die Drag-Container-Ref wird direkt
  // mitgenutzt, damit Focus-Trap und Draggen denselben Knoten teilen.
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, onClose, {
    closeOnEscape: closeOnBackdrop,
    ref: draggableKey ? drag.containerRef : undefined,
  })

  if (!open) return null

  return (
    <div
      className="cp-modal-backdrop fixed inset-0 flex items-center justify-center bg-black/60 p-4"
      style={{ zIndex }}
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        style={draggableKey ? drag.containerStyle : undefined}
        className={`cp-modal-panel flex max-h-[90vh] w-full ${MAX_WIDTH_CLASS[maxWidth]} flex-col overflow-hidden rounded-cp-modal border border-cp-border bg-cp-surface-1 text-cp-text shadow-2xl outline-none`}
      >
        <header
          {...(draggableKey ? drag.headerProps : {})}
          className="flex items-center justify-between border-b border-cp-border px-cp-4 py-cp-3 select-none"
        >
          <h2 id={titleId} className="flex items-center text-cp-xl font-semibold">
            {titleIcon && <span className="mr-2">{titleIcon}</span>}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-cp-control px-2 py-1 text-cp-text-muted hover:bg-cp-surface-2 hover:text-cp-text"
            aria-label={t('common.close', 'Schließen')}
          >
            <Icon icon={X} size="md" />
          </button>
        </header>
        <div className={`flex-1 ${scrollBody ? 'overflow-y-auto' : 'overflow-hidden'} px-cp-4 py-cp-3`}>
          {children}
        </div>
        {footer && (
          <footer className="border-t border-cp-border px-cp-4 py-cp-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
