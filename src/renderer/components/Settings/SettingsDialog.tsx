import { ExternalLink } from 'lucide-react'
import { Icon } from '../shared/Icon'
import { useDraggablePosition } from '../../hooks/useDraggablePosition'
import { useDialogA11y } from '../../hooks/useDialogA11y'
import { useTranslation } from '../../lib/i18n'
import { openPanelPopout } from '../../lib/panelPopout'
import { SettingsBody } from './SettingsBody'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  /** Tab, der beim Öffnen aktiv ist (z. B. 'sync' von der StatusBar aus). */
  initialSection?: string
}

export const SettingsDialog = ({ open, onClose, initialSection }: SettingsDialogProps) => {
  const drag = useDraggablePosition('cable-planner:modal-pos:settings', open)
  const t = useTranslation()
  const { panelRef, titleId, dialogProps } = useDialogA11y(open, onClose, {
    ref: drag.containerRef,
  })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-6">
      <div
        ref={panelRef}
        aria-labelledby={titleId}
        {...dialogProps}
        style={drag.containerStyle}
        // v7.9.2 — Fix-große Höhe statt max-h, damit der Viewport nicht
        // pro Tab variabel groß ist. Inner-Scroll greift immer.
        className="flex h-[85vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded border border-cp-border bg-cp-surface-1 text-cp-text shadow-2xl outline-none sm:flex-row"
      >
        <SettingsBody
          onClose={onClose}
          initialSection={initialSection}
          headerProps={drag.headerProps}
          titleId={titleId}
          headerAction={
            // #427 — In ein separates OS-Fenster auslagern (weiterer Monitor).
            <button
              type="button"
              onClick={() => {
                openPanelPopout('settings')
                onClose()
              }}
              title={t('panel.popoutTitle', 'In separates Fenster auslagern (weiterer Monitor)')}
              aria-label={t('panel.popout', 'Auslagern')}
              className="inline-flex items-center justify-center rounded px-2 py-1 text-[var(--cp-text-muted)] hover:bg-[var(--cp-surface-2)] hover:text-sky-300"
            >
              <Icon icon={ExternalLink} size="sm" />
            </button>
          }
        />
      </div>
    </div>
  )
}
