import { useTranslation, format } from '../../lib/i18n'

/** v7.9.9 — Sticky-Konflikt+Save-Error-Banner. Bleibt beim
 *  Scrollen im Properties-Panel oben sichtbar, damit der User
 *  sieht ob sein Edit den Konflikt aufgelöst hat.
 *
 *  Issue #310 — aus RackBuilderDialog ausgelagert. Rendert nichts
 *  wenn weder Conflicts noch SaveError vorliegen. */

export interface RackConflictBadgesProps {
  conflicts: string[]
  saveError: string | null
  onDismissSaveError: () => void
}

export const RackConflictBadges = ({
  conflicts,
  saveError,
  onDismissSaveError,
}: RackConflictBadgesProps) => {
  const t = useTranslation()
  if (conflicts.length === 0 && !saveError) return null
  return (
    <div className="sticky top-0 z-20 mb-3 rounded border border-red-700/60 bg-red-900/40 px-3 py-2 text-cp-xs text-red-100 shadow-lg backdrop-blur-sm">
      {saveError && (
        <div className="mb-2 flex items-start gap-2">
          <span className="font-semibold">{t('rack.saveBlocked', 'Speichern blockiert:')}</span>
          <span className="whitespace-pre-wrap flex-1">{saveError}</span>
          <button
            type="button"
            onClick={onDismissSaveError}
            className="rounded bg-red-800/80 px-1.5 text-[10px] hover:bg-red-700"
            title={t('common.hide', 'Ausblenden')}
          >
            ×
          </button>
        </div>
      )}
      {conflicts.length > 0 && (
        <>
          <div className="font-semibold">
            {format(t('rack.conflicts', 'Konflikte ({count})'), { count: conflicts.length })}
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {conflicts.map((issue, index) => (
              <li key={`${issue}-${index}`}>{issue}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
