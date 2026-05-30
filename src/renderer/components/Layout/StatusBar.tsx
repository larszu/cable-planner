import { Check } from 'lucide-react'
import { APP_VERSION } from '../../lib/appInfo'
import { useUiStore } from '../../store/uiStore'
import { useTranslation, format } from '../../lib/i18n'
import { Icon } from '../shared/Icon'

interface StatusBarProps {
  projectName: string
  zoom: number
  hasToken: boolean
  equipmentCount: number
  cableCount: number
  locationCount: number
  packedCount?: number
  rentmanProjectName?: string
}

/** H2R-style coarse complexity badge so users get a feel for project
 *  size at a glance. Thresholds are heuristic; the badge is purely
 *  informational. */
const complexityFor = (
  devices: number,
  cables: number,
  t: (key: string, fallback?: string) => string,
): { label: string; tone: string } => {
  const score = devices + cables
  if (score >= 200) return { label: t('statusbar.complexity.xl', 'XL'), tone: 'bg-purple-700 text-purple-100' }
  if (score >= 80) return { label: t('statusbar.complexity.large', 'Groß'), tone: 'bg-amber-600 text-amber-50' }
  if (score >= 30) return { label: t('statusbar.complexity.medium', 'Mittel'), tone: 'bg-sky-700 text-sky-50' }
  if (score >= 8) return { label: t('statusbar.complexity.small', 'Klein'), tone: 'bg-emerald-700 text-emerald-50' }
  return { label: t('statusbar.complexity.new', 'Neu'), tone: 'bg-slate-700 text-slate-200' }
}

export const StatusBar = ({
  projectName,
  zoom,
  hasToken,
  equipmentCount,
  cableCount,
  locationCount,
  packedCount,
  rentmanProjectName,
}: StatusBarProps) => {
  const t = useTranslation()
  const complexity = complexityFor(equipmentCount, cableCount, t)
  return (
    <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--cp-border)] bg-[var(--cp-surface-3)] px-3 py-1 text-cp-xs text-[var(--cp-text-secondary)]">
      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
        <span className="truncate font-medium text-[var(--cp-text)]">{projectName}</span>
        <span className="text-[var(--cp-text-faint)]" aria-hidden="true">|</span>
        <span className="whitespace-nowrap">{format(t('statusbar.equipment', '{count} Geräte'), { count: equipmentCount })}</span>
        <span className="whitespace-nowrap">{format(t('statusbar.cables', '{count} Kabel'), { count: cableCount })}</span>
        <span className="hidden whitespace-nowrap lg:inline">{format(t('statusbar.locations', '{count} Rahmen'), { count: locationCount })}</span>
        {packedCount !== undefined && equipmentCount > 0 && (
          <span
            className={`hidden shrink-0 items-center gap-1 whitespace-nowrap xl:inline-flex ${
              packedCount === equipmentCount
                ? 'text-emerald-300'
                : packedCount > 0
                  ? 'text-amber-300'
                  : 'text-slate-500'
            }`}
            title={t('statusbar.packedTitle', "Geräte, die in den Eigenschaften als 'gepackt' markiert sind")}
          >
            <Icon icon={Check} size="xs" />
            {format(t('statusbar.packed', '{packed}/{total} gepackt'), {
              packed: packedCount,
              total: equipmentCount,
            })}
          </span>
        )}
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-cp-xs font-bold ${complexity.tone}`}
          title={t(
            'statusbar.complexity.title',
            'Komplexität: heuristisch aus (Geräte + Kabel)-Anzahl. Hilft beim Einschätzen von Übersichtlichkeit + Performance.',
          )}
        >
          {complexity.label}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* v7.9.4 — Rentman-Badge nur sichtbar wenn die Integration
            in den Einstellungen aktiviert ist. */}
        {useUiStore((s) => s.rentmanEnabled) && (
          <span className={`hidden whitespace-nowrap lg:inline ${rentmanProjectName ? 'text-orange-300' : hasToken ? 'text-[var(--cp-text-muted)]' : 'text-[var(--cp-text-faint)]'}`}>
            {t('statusbar.rentman.label', 'Rentman:')}{' '}
            {rentmanProjectName ??
              (hasToken
                ? t('statusbar.rentman.tokenReady', 'Token bereit')
                : t('statusbar.rentman.standalone', 'Standalone'))}
          </span>
        )}
        <span>
          {t('statusbar.zoom', 'Zoom:')} {(zoom * 100).toFixed(0)}%
        </span>
        <button
          type="button"
          onClick={() => useUiStore.getState().openAboutDialog()}
          className="rounded bg-[var(--cp-surface-2)] px-1.5 py-0.5 font-mono text-cp-xs text-[var(--cp-text-muted)] hover:bg-[var(--cp-border)] hover:text-[var(--cp-text)]"
          title={t('statusbar.aboutTitle', 'Über Cable Planner')}
        >
          v{APP_VERSION}
        </button>
      </div>
    </footer>
  )
}
