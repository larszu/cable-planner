import { Check, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { APP_VERSION } from '../../lib/appInfo'
import { useUiStore } from '../../store/uiStore'
import { useModule } from '../../store/settingsStore'
import { useCollabStore } from '../../store/collabStore'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation, format } from '../../lib/i18n'
import { runDrawingChecks } from '../../lib/drawingChecks'
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
  return { label: t('statusbar.complexity.new', 'Neu'), tone: 'bg-cp-surface-4 text-cp-text-bright' }
}

/** #471 — Macht eine laufende Live-Session im Haupt-UI sichtbar. Klick öffnet
 *  die Einstellungen direkt auf dem Netzwerk-Sync-Tab. */
const CollabStatusBadge = () => {
  const t = useTranslation()
  const status = useCollabStore((s) => s.status)
  const peers = useCollabStore((s) => s.peers)
  if (status !== 'on' && status !== 'connecting') return null
  return (
    <button
      type="button"
      onClick={() => useUiStore.getState().openSettings('sync')}
      title={t('statusbar.collab.title', 'Live-Kollaboration aktiv — Klick für Teilnehmer & Einladung')}
      className="flex items-center gap-1 whitespace-nowrap rounded bg-emerald-700/80 px-1.5 py-0.5 text-cp-xs font-medium text-emerald-50 hover:bg-emerald-600"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-300" />
      {t('statusbar.collab.live', 'Live')} · {Math.max(peers.length, 1)}
    </button>
  )
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
  // #411 — Live-Plan-Check-Badge. Findings direkt aus dem Store (Equipment +
  // Cables); ein Klick oeffnet/schliesst die Plan-Check-Palette.
  const equipment = useProjectStore((s) => s.project.equipment)
  const cables = useProjectStore((s) => s.project.cables)
  const drumKit = useProjectStore((s) => s.project.drumKit)
  const togglePlanCheck = useUiStore((s) => s.togglePlanCheck)
  const { errorCount, warningCount } = runDrawingChecks({ equipment, cables, drumKit })
  const checkTone =
    errorCount > 0
      ? 'bg-red-700 text-red-50'
      : warningCount > 0
        ? 'bg-amber-600 text-amber-50'
        : 'bg-emerald-700 text-emerald-50'
  const checkIcon = errorCount > 0 ? AlertCircle : warningCount > 0 ? AlertTriangle : CheckCircle2
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
                  : 'text-cp-text-faint'
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
        <button
          type="button"
          onClick={() => togglePlanCheck()}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-cp-xs font-bold ${checkTone}`}
          title={t('statusbar.planCheck.title', 'Plan-Check öffnen: Live-Validierung (Fehler/Warnungen)')}
        >
          <Icon icon={checkIcon} size="xs" />
          {errorCount > 0 || warningCount > 0
            ? format(t('statusbar.planCheck.counts', '{errors}⚠'), { errors: errorCount + warningCount })
            : t('statusbar.planCheck.ok', 'OK')}
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {/* v7.9.4 — Rentman-Badge nur sichtbar wenn die Integration
            in den Einstellungen aktiviert ist. */}
        <CollabStatusBadge />
        {useModule('rentman') && (
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
