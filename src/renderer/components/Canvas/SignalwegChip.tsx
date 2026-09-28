/**
 * #914 — zeigt, dass ein Signalweg hervorgehoben ist, und hebt ihn wieder auf.
 *
 * Ohne diesen Chip gaebe es nach dem Abwaehlen des Kabels keinen sichtbaren
 * Weg zurueck: der Canvas bliebe gedimmt, und niemand wuesste, warum.
 * Escape hebt ebenfalls auf.
 */
import { useEffect } from 'react'
import { Route, X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { format, useTranslation } from '../../lib/i18n'
import { Icon } from '../shared/Icon'

export const SignalwegChip = () => {
  const t = useTranslation()
  const signalweg = useUiStore((s) => s.signalweg)
  const setSignalweg = useUiStore((s) => s.setSignalweg)

  useEffect(() => {
    if (!signalweg) return
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSignalweg(null)
    }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [signalweg, setSignalweg])

  if (!signalweg) return null
  return (
    <button
      type="button"
      onClick={() => setSignalweg(null)}
      title={t('canvas.signalweg.clearTitle', 'End the signal path view (Esc)')}
      className="inline-flex h-6 items-center gap-1 border border-cp-accent bg-cp-accent/15 px-2 text-cp-xs font-medium text-cp-accent"
    >
      <Icon icon={Route} size="xs" />
      <span>
        {format(t('canvas.signalweg.chip', 'Signal path: {kabel} cables, {geraete} devices'), {
          kabel: signalweg.kabelIds.length,
          geraete: signalweg.geraetIds.length,
        })}
      </span>
      <Icon icon={X} size="xs" />
    </button>
  )
}
